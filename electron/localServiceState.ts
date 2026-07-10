import type { DesktopImportFile } from "../src/domain/desktopImport";
import { defaultSettings } from "../src/domain/readerState";
import type { NovelSource, ReaderSettings } from "../src/domain/types";
import { toPersistedSettings, type SettingsDraft } from "../src/storage/persistence";
import type { LibraryFolderScanError } from "./libraryFolder";

export type LocalServiceMeta = {
  activeBookId: string | null;
  activeChapterIndex: number;
  chapterReadOffset: number;
  settings: ReaderSettings;
};

export type LocalServiceState = {
  books: NovelSource[];
  meta: LocalServiceMeta;
  pendingImports: DesktopImportFile[];
  bookProgressById: Record<string, { activeChapterIndex: number; chapterReadOffset: number }>;
  libraryFolder: {
    path: string | null;
    lastScanAt: number | null;
    errors: LibraryFolderScanError[];
  };
};

export function createLocalServiceState(): LocalServiceState {
  return {
    books: [],
    meta: {
      activeBookId: null,
      activeChapterIndex: 0,
      chapterReadOffset: 0,
      settings: defaultSettings,
    },
    pendingImports: [],
    bookProgressById: {},
    libraryFolder: {
      path: null,
      lastScanAt: null,
      errors: [],
    },
  };
}

export function withLocalLibrary(
  state: LocalServiceState,
  library: {
    books: NovelSource[];
    meta: Omit<LocalServiceMeta, "settings">;
  },
): LocalServiceState {
  const books = state.libraryFolder.path ? state.books : library.books;
  const activeBookId = normalizeActiveBookId(books, library.meta.activeBookId);
  const activeBook = books.find((book) => book.id === activeBookId) ?? null;
  const bookProgressById = rememberProgress(state, library.meta.activeBookId, {
    activeChapterIndex: library.meta.activeChapterIndex,
    chapterReadOffset: library.meta.chapterReadOffset,
  });

  return {
    ...state,
    books,
    bookProgressById,
    meta: {
      ...state.meta,
      activeBookId,
      activeChapterIndex: clampChapterIndex(activeBook, library.meta.activeChapterIndex),
      chapterReadOffset: library.meta.chapterReadOffset,
    },
  };
}

export function withLocalSettings(state: LocalServiceState, settings: SettingsDraft): LocalServiceState {
  return {
    ...state,
    meta: {
      ...state.meta,
      settings: toPersistedSettings(settings),
    },
  };
}

export function enqueuePendingImports(
  state: LocalServiceState,
  imports: DesktopImportFile[],
): LocalServiceState {
  return {
    ...state,
    pendingImports: [...state.pendingImports, ...imports],
  };
}

export function withLibraryFolderPath(state: LocalServiceState, folderPath: string | null): LocalServiceState {
  return {
    ...state,
    libraryFolder: {
      ...state.libraryFolder,
      path: folderPath,
      errors: folderPath ? state.libraryFolder.errors : [],
      lastScanAt: folderPath ? state.libraryFolder.lastScanAt : null,
    },
  };
}

export function withLibraryFolderScan(
  state: LocalServiceState,
  scan: { books: NovelSource[]; errors: LibraryFolderScanError[]; scannedAt: number },
): LocalServiceState {
  const bookProgressById = rememberProgress(state, state.meta.activeBookId, {
    activeChapterIndex: state.meta.activeChapterIndex,
    chapterReadOffset: state.meta.chapterReadOffset,
  });
  const activeBookId = normalizeActiveBookId(scan.books, state.meta.activeBookId);
  const activeBook = scan.books.find((book) => book.id === activeBookId) ?? null;
  const cachedProgress = activeBookId ? bookProgressById[activeBookId] : null;

  return {
    ...state,
    books: scan.books,
    bookProgressById,
    meta: {
      ...state.meta,
      activeBookId,
      activeChapterIndex: clampChapterIndex(activeBook, cachedProgress?.activeChapterIndex ?? state.meta.activeChapterIndex),
      chapterReadOffset: activeBook ? cachedProgress?.chapterReadOffset ?? state.meta.chapterReadOffset : 0,
    },
    libraryFolder: {
      ...state.libraryFolder,
      lastScanAt: scan.scannedAt,
      errors: scan.errors,
    },
  };
}

export function drainPendingImports(state: LocalServiceState): {
  state: LocalServiceState;
  imports: DesktopImportFile[];
} {
  return {
    state: { ...state, pendingImports: [] },
    imports: state.pendingImports,
  };
}

function normalizeActiveBookId(books: NovelSource[], activeBookId: string | null): string | null {
  if (activeBookId && books.some((book) => book.id === activeBookId)) {
    return activeBookId;
  }
  return books[0]?.id ?? null;
}

function clampChapterIndex(book: NovelSource | null, chapterIndex: number): number {
  if (!book) return 0;
  return Math.min(Math.max(0, chapterIndex), Math.max(0, book.chapters.length - 1));
}

function rememberProgress(
  state: LocalServiceState,
  bookId: string | null,
  progress: { activeChapterIndex: number; chapterReadOffset: number },
): LocalServiceState["bookProgressById"] {
  if (!bookId) return state.bookProgressById;
  return {
    ...state.bookProgressById,
    [bookId]: {
      activeChapterIndex: Math.max(0, progress.activeChapterIndex),
      chapterReadOffset: Math.max(0, progress.chapterReadOffset),
    },
  };
}
