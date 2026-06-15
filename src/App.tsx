import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  FilePlus2,
  Mic,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Share2,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileFromDesktopImport } from "./domain/desktopImport";
import { getDisguisedTopicsForBooks, topicDisguiseThemeLabels } from "./domain/disguiseTopics";
import { buildImportedBooks } from "./domain/importBooks";
import { filterSupportedNovelFiles } from "./domain/importSource";
import { createChapterSegments } from "./domain/segments";
import {
  createInitialReaderState,
  addImportedBooks,
  getActiveBook,
  getActiveChapter,
  mergeFolderLibrarySnapshot,
  selectBook,
  selectChapter,
  stepChapter,
} from "./domain/readerState";
import { createBrowserBossKeyAction } from "./domain/browserBossKey";
import type { ApiProvider, NovelSource, ReaderSettings, SkinId } from "./domain/types";
import { loadPersistedLibrary, persistLibrary, savePlatformSettings } from "./storage/libraryDb";
import {
  createLocalWebStorageAdapter,
  fetchLocalWebLibraryFolderStatus,
  fetchLocalWebPendingImports,
  rescanLocalWebLibraryFolder,
  saveLocalWebLibraryFolderPath,
  selectLocalWebLibraryFolder,
  type LocalLibraryFolderScanResult,
  type LocalLibraryFolderStatus,
} from "./storage/storageAdapter";
import { getCurrentRuntime, type RuntimeMode } from "./runtime/runtimeAdapter";
import { createLayoutStyleVars } from "./ui/skinLayoutTokens";
import { skinSpecs } from "./ui/skinSpecs";

const providerLabels: Record<ApiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  doubao: "豆包",
};

type AnchorRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type ChapterMenuState = {
  bookId: string;
  anchorRect: AnchorRect;
};

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageStreamRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const persistQueueRef = useRef(Promise.resolve());
  const [reader, setReader] = useState(() => createInitialReaderState([]));
  const [chapterMenu, setChapterMenu] = useState<ChapterMenuState | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionKeys, setSessionKeys] = useState<Partial<Record<ApiProvider, string>>>({});
  const [draft, setDraft] = useState("");
  const [draggingImport, setDraggingImport] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [libraryFolder, setLibraryFolder] = useState<LocalLibraryFolderStatus | null>(null);

  const activeBook = getActiveBook(reader);
  const activeChapter = getActiveChapter(reader);
  const chapterMenuBook = chapterMenu ? reader.books.find((book) => book.id === chapterMenu.bookId) ?? null : null;
  const chapterMenuActiveIndex = chapterMenuBook?.id === reader.activeBookId ? reader.activeChapterIndex : 0;
  const spec = skinSpecs[reader.settings.skin];
  const runtime = useMemo(() => getCurrentRuntime(), []);
  const localWebStorage = useMemo(() => (runtime === "local-web" ? createLocalWebStorageAdapter() : null), [runtime]);
  const layoutStyle = useMemo(
    () => createLayoutStyleVars(reader.settings.skin, reader.settings.display),
    [reader.settings.display, reader.settings.skin],
  );

  const segments = useMemo(() => {
    if (!activeBook || !activeChapter) return [];
    return createChapterSegments({
      chapterTitle: activeChapter.title,
      text: activeChapter.text,
      seed: `${activeBook.id}:${activeChapter.id}`,
      minChars: reader.settings.minChunkChars,
      maxChars: reader.settings.maxChunkChars,
      interruptionEvery: reader.settings.interruptionEvery,
    });
  }, [activeBook, activeChapter, reader.settings.interruptionEvery, reader.settings.maxChunkChars, reader.settings.minChunkChars]);

  const importFiles = useCallback(async (files: Iterable<File>) => {
    const importedBooks = await buildImportedBooks(files);
    if (importedBooks.length === 0) return;

    setReader((current) => addImportedBooks(current, importedBooks));
    setChapterMenu(null);
  }, []);

  const openImportPicker = useCallback(async () => {
    if (window.novelChatDesktop?.openFiles) {
      const desktopFiles = await window.novelChatDesktop.openFiles();
      await importFiles(desktopFiles.map(createFileFromDesktopImport));
      return;
    }

    fileInputRef.current?.click();
  }, [importFiles]);

  const applyLocalWebLibraryFolderResult = useCallback((result: LocalLibraryFolderScanResult, options = { preserveActiveSelection: false }) => {
    setLibraryFolder({
      path: result.path,
      defaultPath: result.defaultPath,
      lastScanAt: result.lastScanAt,
      errors: result.errors,
    });

    if (!result.books || !result.meta) return;
    setReader((current) =>
      mergeFolderLibrarySnapshot(current, result.books ?? current.books, result.meta!, options),
    );
    setChapterMenu(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
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
          setChapterMenu(null);
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
        setChapterMenu(null);
      } catch {
        // Local persistence should never block the reading surface.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    loadLibrary().catch(() => undefined);
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
    const timer = window.setInterval(() => {
      pullPendingImports().catch(() => undefined);
    }, 1800);

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
      if (disposed) return;
      applyLocalWebLibraryFolderResult(result, { preserveActiveSelection: true });
    };

    const timer = window.setInterval(() => {
      pullFolderLibrary().catch(() => undefined);
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [applyLocalWebLibraryFolderResult, hydrated, libraryFolder?.path, runtime]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      const action = createBrowserBossKeyAction({
        target: reader.settings.bossKeyTarget,
        companionAvailable: false,
      });
      window.location.href = action.type === "companion" ? action.fallbackUrl : action.url;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reader.settings.bossKeyTarget]);

  useEffect(() => {
    if (!chapterMenu) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChapterMenu(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapterMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const atStart = reader.activeChapterIndex <= 0;
      const atEnd = !activeBook || reader.activeChapterIndex >= activeBook.chapters.length - 1;
      if ((delta === -1 && atStart) || (delta === 1 && atEnd)) return;

      event.preventDefault();
      setReader((current) => stepChapter(current, delta));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeBook, reader.activeChapterIndex]);

  useEffect(() => {
    messageStreamRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeBook?.id, activeChapter?.id]);

  function updateSettings(patch: Partial<ReaderSettings>) {
    setReader((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function chooseBook(bookId: string) {
    setReader((current) => selectBook(current, bookId));
    setChapterMenu(null);
  }

  function chooseChapterForBook(bookId: string, index: number) {
    setReader((current) => {
      const state = current.activeBookId === bookId ? current : selectBook(current, bookId);
      return selectChapter(state, index);
    });
    setChapterMenu(null);
  }

  function toggleChapterMenu(bookId: string, anchorElement: HTMLElement) {
    const rect = anchorElement.getBoundingClientRect();
    setChapterMenu((current) =>
      current?.bookId === bookId
        ? null
        : {
            bookId,
            anchorRect: toAnchorRect(rect),
          },
    );
  }

  function submitComposerDraft() {
    if (!activeBook || draft.trim().length === 0 || reader.activeChapterIndex >= activeBook.chapters.length - 1) return;
    setReader((current) => stepChapter(current, 1));
    setDraft("");
  }

  async function chooseLibraryFolder() {
    if (runtime !== "local-web") return;
    const result = await selectLocalWebLibraryFolder();
    if (!result.cancelled) {
      applyLocalWebLibraryFolderResult(result);
    }
  }

  async function useDefaultLibraryFolder() {
    if (runtime !== "local-web" || !libraryFolder?.defaultPath) return;
    const status = await saveLocalWebLibraryFolderPath(libraryFolder.defaultPath);
    setLibraryFolder(status);
    applyLocalWebLibraryFolderResult(await rescanLocalWebLibraryFolder());
  }

  async function saveLibraryFolderPath(folderPath: string) {
    if (runtime !== "local-web") return;
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    const status = await saveLocalWebLibraryFolderPath(trimmed);
    setLibraryFolder(status);
    applyLocalWebLibraryFolderResult(await rescanLocalWebLibraryFolder());
  }

  async function refreshLibraryFolder() {
    if (runtime !== "local-web" || !libraryFolder?.path) return;
    applyLocalWebLibraryFolderResult(await rescanLocalWebLibraryFolder());
  }

  async function clearLibraryFolder() {
    if (runtime !== "local-web") return;
    setLibraryFolder(await saveLocalWebLibraryFolderPath(null));
  }

  return (
    <div
      className={`app skin-${reader.settings.skin}`}
      style={layoutStyle}
      onDragEnter={(event) => {
        if (!hasFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDraggingImport(true);
      }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setDraggingImport(false);
        }
      }}
      onDragOver={(event) => {
        if (!hasFileDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDraggingImport(false);
        const files = filterSupportedNovelFiles(event.dataTransfer.files);
        importFiles(files).catch(() => undefined);
      }}
    >
      <Sidebar
        activeBookId={reader.activeBookId}
        books={reader.books}
        chapterMenuBookId={chapterMenu?.bookId ?? null}
        onBookMenu={toggleChapterMenu}
        onCloseChapterMenu={() => setChapterMenu(null)}
        onSelectBook={chooseBook}
        spec={spec}
        topicDisguiseTheme={reader.settings.topicDisguiseTheme}
      />
      <main className="chat-main">
        <TopBar
          onImport={() => openImportPicker().catch(() => undefined)}
          moreOpen={moreOpen}
          onMoreOpen={setMoreOpen}
          onSettings={() => {
            setSettingsOpen(true);
            setMoreOpen(false);
          }}
          settings={reader.settings}
          updateSettings={updateSettings}
        />
        <section className="message-stream" aria-label="conversation" ref={messageStreamRef}>
          {activeBook ? (
            segments.map((segment) => <Message key={segment.id} segment={segment} />)
          ) : (
            <EmptyImportState
              inputPlaceholder={spec.inputPlaceholder}
              onImport={() => openImportPicker().catch(() => undefined)}
              skin={reader.settings.skin}
            />
          )}
        </section>
        {activeBook && (
          <Composer
            canNext={reader.activeChapterIndex < activeBook.chapters.length - 1}
            draft={draft}
            inputPlaceholder={spec.inputPlaceholder}
            onDraft={setDraft}
            onSubmit={submitComposerDraft}
            skin={reader.settings.skin}
          />
        )}
      </main>
      {chapterMenu && chapterMenuBook && (
        <ChapterMenuOverlay
          activeChapterIndex={chapterMenuActiveIndex}
          anchorRect={chapterMenu.anchorRect}
          book={chapterMenuBook}
          onClose={() => setChapterMenu(null)}
          onSelectChapter={(index) => chooseChapterForBook(chapterMenuBook.id, index)}
          onStep={(delta) => chooseChapterForBook(chapterMenuBook.id, chapterMenuActiveIndex + delta)}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          keys={sessionKeys}
          onClose={() => setSettingsOpen(false)}
          onKeyChange={(provider, value) => setSessionKeys((current) => ({ ...current, [provider]: value }))}
          libraryFolder={libraryFolder}
          onChooseLibraryFolder={() => chooseLibraryFolder().catch(() => undefined)}
          onClearLibraryFolder={() => clearLibraryFolder().catch(() => undefined)}
          settings={reader.settings}
          onRefreshLibraryFolder={() => refreshLibraryFolder().catch(() => undefined)}
          onSaveLibraryFolderPath={(folderPath) => saveLibraryFolderPath(folderPath).catch(() => undefined)}
          onUseDefaultLibraryFolder={() => useDefaultLibraryFolder().catch(() => undefined)}
          runtime={runtime}
          updateSettings={updateSettings}
        />
      )}
      {draggingImport && (
        <div className="drop-overlay" aria-live="polite">
          <div>
            <Upload size={24} />
            <span>添加文件</span>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".txt,.epub,text/plain,application/epub+zip"
        onChange={(event) => {
          const files = filterSupportedNovelFiles(event.target.files ?? []);
          if (files.length > 0) {
            importFiles(files).catch(() => undefined);
          }
          event.currentTarget.value = "";
        }}
        multiple
      />
    </div>
  );
}

const doubaoHomeSuggestions = [
  "整理本周项目风险",
  "生成会议纪要模板",
  "分析竞品更新重点",
  "规划一次技术分享",
  "把任务拆成待办",
  "翻译一段材料",
];

function EmptyImportState(props: { inputPlaceholder: string; onImport(): void; skin: SkinId }) {
  if (props.skin === "gemini") {
    return (
      <div className="empty-import-state empty-gemini-home">
        <h1>认识 Gemini：你的私人 AI 助理</h1>
        <button className="empty-prompt-bar" onClick={props.onImport}>
          <FilePlus2 size={22} />
          <span>{props.inputPlaceholder}</span>
          <Mic size={18} />
        </button>
      </div>
    );
  }

  if (props.skin === "doubao") {
    return (
      <div className="empty-import-state empty-doubao-home">
        <h1>你好，我是豆包</h1>
        <div className="empty-suggestion-grid">
          {doubaoHomeSuggestions.map((suggestion) => (
            <button key={suggestion} onClick={props.onImport}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (props.skin === "deepseek") {
    return (
      <div className="empty-import-state empty-deepseek-home">
        <div className="empty-deepseek-logo">deepseek</div>
        <button className="empty-prompt-bar" onClick={props.onImport}>
          <FilePlus2 size={21} />
          <span>{props.inputPlaceholder}</span>
          <ArrowUp size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="empty-import-state">
      <button onClick={props.onImport}>
        <FilePlus2 size={21} />
        <span>上传文件</span>
      </button>
    </div>
  );
}

function hasFileDrag(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.items.length === 0) return dataTransfer.types.includes("Files");
  return Array.from(dataTransfer.items).some((item) => item.kind === "file");
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}

function Sidebar(props: {
  activeBookId: string | null;
  books: NovelSource[];
  chapterMenuBookId: string | null;
  onBookMenu(bookId: string, anchorElement: HTMLElement): void;
  onCloseChapterMenu(): void;
  onSelectBook(bookId: string): void;
  spec: typeof skinSpecs[SkinId];
  topicDisguiseTheme: ReaderSettings["topicDisguiseTheme"];
}) {
  const disguisedTopics = useMemo(
    () => getDisguisedTopicsForBooks(props.books, props.topicDisguiseTheme),
    [props.books, props.topicDisguiseTheme],
  );

  return (
    <aside className="sidebar" onScroll={props.onCloseChapterMenu}>
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true">
          {props.spec.id === "gemini" ? "✦" : props.spec.id === "doubao" ? "豆" : props.spec.id === "deepseek" ? "d" : "◎"}
        </div>
        <div className="brand-text">
          {props.spec.brand}
          {props.spec.subBrand && <span>{props.spec.subBrand}</span>}
        </div>
        <button className="icon-button" aria-label="toggle sidebar">
          <PanelsIcon />
        </button>
      </div>
      <nav className="nav-list" aria-label="primary">
        {props.spec.navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button className={`nav-item ${index === 0 ? "active" : ""}`} key={item.label}>
              <Icon size={22} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <section className="recent-section">
        <h2>{props.spec.recentLabel}</h2>
        <div className="recent-list">
          {props.books.map((book) => {
            const disguisedTopic = disguisedTopics[book.id] ?? "任务进度同步";
            return (
              <div className="book-row-wrap" key={book.id}>
                <button
                  className={`book-row ${book.id === props.activeBookId ? "selected" : ""}`}
                  aria-label={disguisedTopic}
                  onClick={() => props.onSelectBook(book.id)}
                >
                  <span className="book-title-disguise">{disguisedTopic}</span>
                  <span className="book-title-real">{book.title}</span>
                </button>
                <button
                  className="book-menu-button"
                  aria-label={`${disguisedTopic} menu`}
                  aria-expanded={props.chapterMenuBookId === book.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onBookMenu(book.id, event.currentTarget);
                  }}
                >
                  <Ellipsis size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <div className="sidebar-footer">
        <span className="avatar">{props.spec.id === "doubao" ? "豆" : "E"}</span>
        <span>{props.spec.id === "chatgpt" ? "Evelyn Sherrell" : props.spec.brand}</span>
        <Settings size={17} />
      </div>
    </aside>
  );
}

function ChapterMenuOverlay(props: {
  activeChapterIndex: number;
  anchorRect: AnchorRect;
  book: NovelSource;
  onClose(): void;
  onSelectChapter(index: number): void;
  onStep(delta: -1 | 1): void;
}) {
  const currentChapterRef = useRef<HTMLButtonElement | null>(null);
  const menuStyle = getChapterMenuStyle(props.anchorRect);

  useEffect(() => {
    currentChapterRef.current?.scrollIntoView({ block: "nearest" });
  }, [props.activeChapterIndex, props.book.id]);

  return (
    <div className="chapter-menu-layer" onMouseDown={props.onClose}>
      <div className="chapter-menu" role="menu" style={menuStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div className="chapter-menu-title">{props.book.title}</div>
        <div className="chapter-menu-subtitle">当前：{props.book.chapters[props.activeChapterIndex]?.title ?? "正文"}</div>
        <div className="chapter-menu-actions">
          <button disabled={props.activeChapterIndex <= 0} onClick={() => props.onStep(-1)}>
            <ChevronLeft size={18} /> 上一章
          </button>
          <button
            disabled={props.activeChapterIndex >= props.book.chapters.length - 1}
            onClick={() => props.onStep(1)}
          >
            下一章 <ChevronRight size={18} />
          </button>
        </div>
        <div className="chapter-list">
          {props.book.chapters.map((chapter, index) => (
            <button
              className={index === props.activeChapterIndex ? "current" : ""}
              key={chapter.id}
              onClick={() => props.onSelectChapter(index)}
              ref={index === props.activeChapterIndex ? currentChapterRef : null}
            >
              <span>{chapter.title}</span>
              {index === props.activeChapterIndex && <Check size={16} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function toAnchorRect(rect: DOMRect): AnchorRect {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function getChapterMenuStyle(anchorRect: AnchorRect) {
  const width = 280;
  const estimatedHeight = Math.min(440, window.innerHeight - 24);
  const left = Math.max(12, Math.min(anchorRect.right + 8, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min(anchorRect.top, window.innerHeight - estimatedHeight - 12));

  return { left, top } as const;
}

function TopBar(props: {
  moreOpen: boolean;
  onImport(): void;
  onMoreOpen(open: boolean): void;
  onSettings(): void;
  settings: ReaderSettings;
  updateSettings(patch: Partial<ReaderSettings>): void;
}) {
  const title = props.settings.skin === "chatgpt" ? "ChatGPT Pro" : skinSpecs[props.settings.skin].brand;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span>{title}</span>
        {props.settings.skin === "doubao" && <small>内容由豆包 AI 生成，请仔细甄别</small>}
      </div>
      <div className="topbar-actions">
        {props.settings.skin === "gemini" && <button className="upgrade-button">登录</button>}
        {props.settings.skin === "doubao" && (
          <button className="download-button">
            <Download size={16} /> 下载电脑版
          </button>
        )}
        <button className="icon-button" aria-label="import novel" onClick={props.onImport}>
          {props.settings.skin === "deepseek" || props.settings.skin === "doubao" ? <Share2 size={19} /> : <Upload size={19} />}
        </button>
        {props.settings.skin === "doubao" && <button className="login-button">登录</button>}
        <button className="icon-button" aria-label="more" onClick={() => props.onMoreOpen(!props.moreOpen)}>
          <MoreHorizontal size={22} />
        </button>
        {props.moreOpen && (
          <div className="more-menu">
            <button onClick={props.onImport}>
              <Upload size={18} /> 添加文件
            </button>
            <div className="menu-split" />
            <div className="menu-label">皮肤</div>
            <div className="skin-switcher">
              {(["chatgpt", "gemini", "deepseek", "doubao"] as SkinId[]).map((skin) => (
                <button
                  className={props.settings.skin === skin ? "selected" : ""}
                  key={skin}
                  onClick={() => {
                    props.updateSettings({ skin, bossKeyTarget: skin });
                    props.onMoreOpen(false);
                  }}
                >
                  {skinSpecs[skin].brand}
                </button>
              ))}
            </div>
            <button onClick={() => props.updateSettings({ apiPolishEnabled: !props.settings.apiPolishEnabled })}>
              <Wand2 size={18} /> API {props.settings.apiPolishEnabled ? "已启用" : "未启用"}
            </button>
            <button onClick={props.onSettings}>
              <Settings size={18} /> 设置
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Message(props: { segment: { role: "assistant" | "user"; kind: string; text: string } }) {
  if (props.segment.role === "user") {
    return (
      <article className="message user-message">
        <div className="user-bubble">{props.segment.text}</div>
      </article>
    );
  }

  return (
    <article className="message assistant-message">
      <div className="assistant-content">
        <p>{props.segment.text}</p>
        <div className="message-actions">
          <Copy size={18} />
          <ThumbsUp size={18} />
          <ThumbsDown size={18} />
          <RefreshCw size={17} />
          <MoreHorizontal size={18} />
        </div>
      </div>
    </article>
  );
}

function Composer(props: {
  canNext: boolean;
  draft: string;
  inputPlaceholder: string;
  onDraft(value: string): void;
  onSubmit(): void;
  skin: SkinId;
}) {
  const hasDraft = props.draft.trim().length > 0;
  const canSend = hasDraft && props.canNext;

  function submit() {
    if (!canSend) return;
    props.onSubmit();
  }

  return (
    <div className="composer-shell">
      <div className="composer-box">
        <textarea
          value={props.draft}
          onChange={(event) => props.onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            submit();
          }}
          placeholder={props.inputPlaceholder}
          rows={2}
        />
        <div className="composer-tools">
          <div className="tool-left">
            <button className="composer-icon-button" aria-label="attach file" type="button">
              <Paperclip size={20} />
            </button>
            {props.skin === "deepseek" && (
              <>
                <button>深度思考</button>
                <button>联网搜索</button>
              </>
            )}
            {props.skin === "doubao" && (
              <>
                <button>快速</button>
                <button>翻译</button>
                <button>更多</button>
              </>
            )}
          </div>
          <button
            className={`send-button ${hasDraft ? "" : "voice-button"}`}
            disabled={hasDraft && !props.canNext}
            onClick={hasDraft ? submit : undefined}
            aria-label={hasDraft ? "send message" : "voice input"}
            type="button"
          >
            {hasDraft ? <ArrowUp size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </div>
      {props.skin === "gemini" && <div className="composer-disclaimer">Gemini can make mistakes.</div>}
      {props.skin === "deepseek" && <ArrowDown className="scroll-cue" size={19} />}
    </div>
  );
}

function SettingsPanel(props: {
  keys: Partial<Record<ApiProvider, string>>;
  libraryFolder: LocalLibraryFolderStatus | null;
  onClose(): void;
  onChooseLibraryFolder(): void;
  onClearLibraryFolder(): void;
  onKeyChange(provider: ApiProvider, value: string): void;
  onRefreshLibraryFolder(): void;
  onSaveLibraryFolderPath(folderPath: string): void;
  onUseDefaultLibraryFolder(): void;
  runtime: RuntimeMode;
  settings: ReaderSettings;
  updateSettings(patch: Partial<ReaderSettings>): void;
}) {
  const [folderDraft, setFolderDraft] = useState(props.libraryFolder?.path ?? props.libraryFolder?.defaultPath ?? "");

  function updateDisplay(patch: Partial<ReaderSettings["display"]>) {
    props.updateSettings({ display: { ...props.settings.display, ...patch } });
  }

  useEffect(() => {
    setFolderDraft(props.libraryFolder?.path ?? props.libraryFolder?.defaultPath ?? "");
  }, [props.libraryFolder?.defaultPath, props.libraryFolder?.path]);

  return (
    <div className="settings-backdrop">
      <section className="settings-panel" aria-label="settings">
        <div className="settings-header">
          <h2>设置</h2>
          <button className="icon-button" onClick={props.onClose}>
            <X size={20} />
          </button>
        </div>
        <label>
          最小分段
          <input
            type="number"
            value={props.settings.minChunkChars}
            onChange={(event) => props.updateSettings({ minChunkChars: Number(event.target.value) })}
          />
        </label>
        <label>
          最大分段
          <input
            type="number"
            value={props.settings.maxChunkChars}
            onChange={(event) => props.updateSettings({ maxChunkChars: Number(event.target.value) })}
          />
        </label>
        <label>
          打断频率
          <input
            type="number"
            value={props.settings.interruptionEvery}
            onChange={(event) => props.updateSettings({ interruptionEvery: Number(event.target.value) })}
          />
        </label>
        <div className="settings-group">
          <span>高级显示</span>
          <label>
            字号
            <input
              type="range"
              min="0.9"
              max="1.2"
              step="0.05"
              value={props.settings.display.fontScale}
              onChange={(event) => updateDisplay({ fontScale: Number(event.target.value) })}
            />
          </label>
          <label>
            消息宽度
            <input
              type="number"
              min="620"
              max="980"
              value={props.settings.display.messageWidth}
              onChange={(event) => updateDisplay({ messageWidth: Number(event.target.value) })}
            />
          </label>
          <label>
            密度
            <select
              value={props.settings.display.density}
              onChange={(event) => updateDisplay({ density: event.target.value as ReaderSettings["display"]["density"] })}
            >
              <option value="compact">紧凑</option>
              <option value="comfortable">标准</option>
              <option value="spacious">宽松</option>
            </select>
          </label>
          <label>
            侧边栏
            <select
              value={props.settings.display.sidebarMode}
              onChange={(event) =>
                updateDisplay({ sidebarMode: event.target.value as ReaderSettings["display"]["sidebarMode"] })
              }
            >
              <option value="full">完整</option>
              <option value="compact">窄栏</option>
            </select>
          </label>
          <label>
            侧栏话题
            <select
              value={props.settings.topicDisguiseTheme}
              onChange={(event) =>
                props.updateSettings({
                  topicDisguiseTheme: event.target.value as ReaderSettings["topicDisguiseTheme"],
                })
              }
            >
              {(Object.keys(topicDisguiseThemeLabels) as ReaderSettings["topicDisguiseTheme"][]).map((theme) => (
                <option key={theme} value={theme}>
                  {topicDisguiseThemeLabels[theme]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {props.runtime === "local-web" && (
          <div className="settings-group">
            <span>本地目录</span>
            <label>
              当前路径
              <input
                value={folderDraft}
                onChange={(event) => setFolderDraft(event.target.value)}
                placeholder="未启用"
              />
            </label>
            <div className="settings-actions">
              <button type="button" onClick={() => props.onSaveLibraryFolderPath(folderDraft)} disabled={!folderDraft.trim()}>
                保存路径
              </button>
              <button type="button" onClick={props.onChooseLibraryFolder}>
                选择目录
              </button>
              <button type="button" onClick={props.onUseDefaultLibraryFolder}>
                使用默认
              </button>
              <button type="button" onClick={props.onRefreshLibraryFolder} disabled={!props.libraryFolder?.path}>
                重新扫描
              </button>
              <button type="button" onClick={props.onClearLibraryFolder} disabled={!props.libraryFolder?.path}>
                停用
              </button>
            </div>
            {props.libraryFolder?.errors.length ? (
              <div className="settings-errors" role="status">
                {props.libraryFolder.errors.slice(0, 3).map((error) => (
                  <div key={`${error.fileName}:${error.message}`}>
                    {error.fileName}: {error.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="settings-note">只扫描目录顶层的 TXT / EPUB 文件，删除文件后侧栏会同步移除。</div>
            )}
          </div>
        )}
        <div className="settings-group">
          <span>会话密钥</span>
          {(["openai", "gemini", "deepseek", "doubao"] as ApiProvider[]).map((provider) => (
            <label key={provider}>
              {providerLabels[provider]}
              <input
                type="password"
                value={props.keys[provider] ?? ""}
                onChange={(event) => props.onKeyChange(provider, event.target.value)}
                placeholder="仅当前会话保存"
              />
            </label>
          ))}
        </div>
        <div className="settings-note">Alt+B 会切换到当前皮肤对应的公开聊天入口。</div>
      </section>
    </div>
  );
}

function PanelsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 5v14" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
