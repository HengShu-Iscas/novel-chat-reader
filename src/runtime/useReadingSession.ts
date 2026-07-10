import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileFromDesktopImport } from "../domain/desktopImport";
import { buildImportedBooks } from "../domain/importBooks";
import { assertImportBatchWithinLimits, defaultImportLimits } from "../domain/importLimits";
import {
  addImportedBooks,
  createInitialReaderState,
  mergeFolderLibrarySnapshot,
  selectBook,
  selectChapter,
  stepChapter,
} from "../domain/readerState";
import type { ReaderSettings } from "../domain/types";
import { loadPersistedLibrary, persistLibrary, savePlatformSettings } from "../storage/libraryDb";
import {
  createLocalWebStorageAdapter,
  fetchLocalWebLibraryFolderStatus,
  fetchLocalWebPendingImports,
  rescanLocalWebLibraryFolder,
  saveLocalWebLibraryFolderPath,
  selectLocalWebLibraryFolder,
  type LocalLibraryFolderScanResult,
  type LocalLibraryFolderStatus,
} from "../storage/storageAdapter";
import { getCurrentRuntime } from "./runtimeAdapter";

export function useReadingSession() {
  const persistQueueRef = useRef(Promise.resolve());
  const [reader, setReader] = useState(() => createInitialReaderState([]));
  const [hydrated, setHydrated] = useState(false);
  const [libraryFolder, setLibraryFolder] = useState<LocalLibraryFolderStatus | null>(null);
  const runtime = useMemo(() => getCurrentRuntime(), []);
  const localWebStorage = useMemo(
    () => (runtime === "local-web" ? createLocalWebStorageAdapter() : null),
    [runtime],
  );

  const importFiles = useCallback(async (files: Iterable<File>) => {
    const candidates = Array.from(files);
    assertImportBatchWithinLimits(
      candidates.map((file) => ({ name: file.name, size: file.size })),
      defaultImportLimits,
    );
    const importedBooks = await buildImportedBooks(candidates);
    if (importedBooks.length === 0) return;
    setReader((current) => addImportedBooks(current, importedBooks));
  }, []);

  const applyFolderResult = useCallback(
    (result: LocalLibraryFolderScanResult, options = { preserveActiveSelection: false }) => {
      setLibraryFolder({
        path: result.path,
        defaultPath: result.defaultPath,
        lastScanAt: result.lastScanAt,
        errors: result.errors,
      });
      if (!result.books || !result.meta) return;
      setReader((current) => mergeFolderLibrarySnapshot(current, result.books!, result.meta!, options));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        if (localWebStorage) {
          const [snapshot, folderStatus] = await Promise.all([
            localWebStorage.load(),
            fetchLocalWebLibraryFolderStatus(),
          ]);
          if (cancelled || !snapshot) return;
          setLibraryFolder(folderStatus);
          setReader({
            books: snapshot.books,
            activeBookId: snapshot.meta.activeBookId,
            activeChapterIndex: snapshot.meta.activeChapterIndex,
            chapterReadOffset: snapshot.meta.chapterReadOffset,
            settings: snapshot.meta.settings,
          });
          return;
        }

        const { books, meta } = await loadPersistedLibrary();
        if (cancelled || books.length === 0 || !meta) return;
        setReader({
          books,
          activeBookId: meta.activeBookId,
          activeChapterIndex: meta.activeChapterIndex,
          chapterReadOffset: meta.chapterReadOffset,
          settings: meta.settings,
        });
      } catch {
        // Persistence failures must not block the reading surface.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrate().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [localWebStorage]);

  useEffect(() => {
    if (runtime === "local-web") return undefined;
    return window.novelChatDesktop?.onOpenFiles((desktopFiles) => {
      importFiles(desktopFiles.map(createFileFromDesktopImport)).catch(() => undefined);
    });
  }, [importFiles, runtime]);

  useEffect(() => {
    if (!hydrated || runtime !== "local-web") return undefined;
    let disposed = false;

    const pullPendingImports = async () => {
      const imports = await fetchLocalWebPendingImports();
      if (disposed || imports.length === 0) return;
      await importFiles(imports.map(createFileFromDesktopImport));
    };

    pullPendingImports().catch(() => undefined);
    const timer = window.setInterval(() => pullPendingImports().catch(() => undefined), 1800);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [hydrated, importFiles, runtime]);

  useEffect(() => {
    if (!hydrated || runtime !== "local-web" || !libraryFolder?.path) return undefined;
    let disposed = false;

    const pullFolderLibrary = async () => {
      const result = await rescanLocalWebLibraryFolder();
      if (!disposed) applyFolderResult(result, { preserveActiveSelection: true });
    };

    const timer = window.setInterval(() => pullFolderLibrary().catch(() => undefined), 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [applyFolderResult, hydrated, libraryFolder?.path, runtime]);

  useEffect(() => {
    if (!hydrated) return;
    const meta = {
      activeBookId: reader.activeBookId,
      activeChapterIndex: reader.activeChapterIndex,
      chapterReadOffset: reader.chapterReadOffset,
      settings: reader.settings,
    };

    if (localWebStorage) {
      persistQueueRef.current = persistQueueRef.current
        .catch(() => undefined)
        .then(() => localWebStorage.persist({ books: reader.books, meta }))
        .catch(() => undefined);
      return;
    }

    persistLibrary({ id: "reader", ...meta }, reader.books).catch(() => undefined);
    savePlatformSettings(reader.settings).catch(() => undefined);
  }, [hydrated, localWebStorage, reader]);

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setReader((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const chooseBook = useCallback((bookId: string) => {
    setReader((current) => selectBook(current, bookId));
  }, []);

  const chooseChapterForBook = useCallback((bookId: string, index: number) => {
    setReader((current) => {
      const state = current.activeBookId === bookId ? current : selectBook(current, bookId);
      return selectChapter(state, index);
    });
  }, []);

  const stepActiveChapter = useCallback((delta: -1 | 1) => {
    setReader((current) => stepChapter(current, delta));
  }, []);

  const chooseLibraryFolder = useCallback(async () => {
    if (runtime !== "local-web") return;
    const result = await selectLocalWebLibraryFolder();
    if (!result.cancelled) applyFolderResult(result);
  }, [applyFolderResult, runtime]);

  const useDefaultLibraryFolder = useCallback(async () => {
    if (runtime !== "local-web" || !libraryFolder?.defaultPath) return;
    setLibraryFolder(await saveLocalWebLibraryFolderPath(libraryFolder.defaultPath));
    applyFolderResult(await rescanLocalWebLibraryFolder());
  }, [applyFolderResult, libraryFolder?.defaultPath, runtime]);

  const saveLibraryFolderPath = useCallback(async (folderPath: string) => {
    if (runtime !== "local-web" || !folderPath.trim()) return;
    setLibraryFolder(await saveLocalWebLibraryFolderPath(folderPath.trim()));
    applyFolderResult(await rescanLocalWebLibraryFolder());
  }, [applyFolderResult, runtime]);

  const refreshLibraryFolder = useCallback(async () => {
    if (runtime !== "local-web" || !libraryFolder?.path) return;
    applyFolderResult(await rescanLocalWebLibraryFolder());
  }, [applyFolderResult, libraryFolder?.path, runtime]);

  const clearLibraryFolder = useCallback(async () => {
    if (runtime !== "local-web") return;
    setLibraryFolder(await saveLocalWebLibraryFolderPath(null));
  }, [runtime]);

  return {
    reader,
    runtime,
    libraryFolder,
    importFiles,
    updateSettings,
    chooseBook,
    chooseChapterForBook,
    stepActiveChapter,
    chooseLibraryFolder,
    useDefaultLibraryFolder,
    saveLibraryFolderPath,
    refreshLibraryFolder,
    clearLibraryFolder,
  };
}
