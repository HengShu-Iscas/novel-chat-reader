import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  Mic,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Send,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileFromDesktopImport } from "./domain/desktopImport";
import { buildImportedBooks } from "./domain/importBooks";
import { filterSupportedNovelFiles } from "./domain/importSource";
import { createChapterSegments } from "./domain/segments";
import {
  createInitialReaderState,
  getActiveBook,
  getActiveChapter,
  selectBook,
  selectChapter,
  stepChapter,
} from "./domain/readerState";
import type { ApiProvider, NovelSource, ReaderSettings, SkinId } from "./domain/types";
import { sampleBooks } from "./data/sampleLibrary";
import { loadPersistedLibrary, persistLibrary, savePlatformSettings } from "./storage/libraryDb";
import { skinSpecs } from "./ui/skinSpecs";

const providerLabels: Record<ApiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  doubao: "豆包",
};

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [reader, setReader] = useState(() => createInitialReaderState(sampleBooks));
  const [chapterMenuBookId, setChapterMenuBookId] = useState<string | null>(reader.activeBookId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionKeys, setSessionKeys] = useState<Partial<Record<ApiProvider, string>>>({});
  const [draft, setDraft] = useState("");
  const [draggingImport, setDraggingImport] = useState(false);

  const activeBook = getActiveBook(reader);
  const activeChapter = getActiveChapter(reader);
  const spec = skinSpecs[reader.settings.skin];

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

    setReader((current) => createInitialReaderState([...importedBooks, ...current.books]));
    setChapterMenuBookId(importedBooks[importedBooks.length - 1].id);
  }, []);

  const openImportPicker = useCallback(async () => {
    if (window.novelChatDesktop?.openFiles) {
      const desktopFiles = await window.novelChatDesktop.openFiles();
      await importFiles(desktopFiles.map(createFileFromDesktopImport));
      return;
    }

    fileInputRef.current?.click();
  }, [importFiles]);

  useEffect(() => {
    let cancelled = false;
    loadPersistedLibrary()
      .then(({ books, meta }) => {
        if (cancelled || books.length === 0 || !meta) return;
        setReader({
          books,
          activeBookId: meta.activeBookId,
          activeChapterIndex: meta.activeChapterIndex,
          chapterReadOffset: meta.chapterReadOffset,
          settings: meta.settings,
        });
        setChapterMenuBookId(meta.activeBookId);
      })
      .catch(() => {
        // Local persistence should never block the reading surface.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.novelChatDesktop?.onOpenFiles((desktopFiles) => {
      importFiles(desktopFiles.map(createFileFromDesktopImport)).catch(() => undefined);
    });
  }, [importFiles]);

  useEffect(() => {
    persistLibrary(
      {
        id: "reader",
        activeBookId: reader.activeBookId,
        activeChapterIndex: reader.activeChapterIndex,
        chapterReadOffset: reader.chapterReadOffset,
        settings: reader.settings,
      },
      reader.books,
    ).catch(() => undefined);
    savePlatformSettings(reader.settings).catch(() => undefined);
  }, [reader]);

  function updateSettings(patch: Partial<ReaderSettings>) {
    setReader((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function chooseBook(bookId: string) {
    setReader((current) => selectBook(current, bookId));
    setChapterMenuBookId(bookId);
  }

  function chooseChapter(index: number) {
    setReader((current) => selectChapter(current, index));
    setChapterMenuBookId(null);
  }

  return (
    <div
      className={`app skin-${reader.settings.skin}`}
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
        chapterMenuBookId={chapterMenuBookId}
        onBookMenu={setChapterMenuBookId}
        onSelectBook={chooseBook}
        onSelectChapter={chooseChapter}
        reader={reader}
        spec={spec}
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
        <section className="message-stream" aria-label="conversation">
          {segments.map((segment) => (
            <Message key={segment.id} segment={segment} />
          ))}
        </section>
        <Composer
          activeChapterTitle={activeChapter?.title ?? "正文"}
          canPrev={reader.activeChapterIndex > 0}
          canNext={Boolean(activeBook && reader.activeChapterIndex < activeBook.chapters.length - 1)}
          draft={draft}
          inputPlaceholder={spec.inputPlaceholder}
          onDraft={setDraft}
          onImport={() => openImportPicker().catch(() => undefined)}
          onPrev={() => setReader((current) => stepChapter(current, -1))}
          onNext={() => setReader((current) => stepChapter(current, 1))}
          skin={reader.settings.skin}
        />
      </main>
      {settingsOpen && (
        <SettingsPanel
          keys={sessionKeys}
          onClose={() => setSettingsOpen(false)}
          onKeyChange={(provider, value) => setSessionKeys((current) => ({ ...current, [provider]: value }))}
          settings={reader.settings}
          updateSettings={updateSettings}
        />
      )}
      {draggingImport && (
        <div className="drop-overlay" aria-live="polite">
          <div>
            <Upload size={24} />
            <span>导入 TXT / EPUB</span>
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

function hasFileDrag(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.items.length === 0) return dataTransfer.types.includes("Files");
  return Array.from(dataTransfer.items).some((item) => item.kind === "file");
}

function Sidebar(props: {
  activeBookId: string | null;
  books: NovelSource[];
  chapterMenuBookId: string | null;
  onBookMenu(bookId: string | null): void;
  onSelectBook(bookId: string): void;
  onSelectChapter(index: number): void;
  reader: ReturnType<typeof createInitialReaderState>;
  spec: typeof skinSpecs[SkinId];
}) {
  const activeBook = props.books.find((book) => book.id === props.activeBookId) ?? null;
  const menuBook = props.books.find((book) => book.id === props.chapterMenuBookId) ?? activeBook;

  return (
    <aside className="sidebar">
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
          {props.books.map((book) => (
            <div className="book-row-wrap" key={book.id}>
              <button
                className={`book-row ${book.id === props.activeBookId ? "selected" : ""}`}
                onClick={() => props.onSelectBook(book.id)}
              >
                <span>{book.title}</span>
              </button>
              <button
                className="book-menu-button"
                aria-label={`${book.title} chapters`}
                onClick={() => props.onBookMenu(props.chapterMenuBookId === book.id ? null : book.id)}
              >
                <Ellipsis size={18} />
              </button>
              {props.chapterMenuBookId === book.id && menuBook && (
                <ChapterMenu
                  activeChapterIndex={book.id === props.activeBookId ? props.reader.activeChapterIndex : 0}
                  book={menuBook}
                  onSelectChapter={props.onSelectChapter}
                  onStep={(delta) => props.onSelectChapter(props.reader.activeChapterIndex + delta)}
                />
              )}
            </div>
          ))}
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

function ChapterMenu(props: {
  activeChapterIndex: number;
  book: NovelSource;
  onSelectChapter(index: number): void;
  onStep(delta: -1 | 1): void;
}) {
  return (
    <div className="chapter-menu" role="menu">
      <div className="chapter-menu-title">{props.book.title}</div>
      <div className="chapter-menu-subtitle">当前：{props.book.chapters[props.activeChapterIndex]?.title ?? "正文"}</div>
      <div className="chapter-menu-actions">
        <button onClick={() => props.onStep(-1)}>
          <ChevronLeft size={18} /> 上一章
        </button>
        <button onClick={() => props.onStep(1)}>
          下一章 <ChevronRight size={18} />
        </button>
      </div>
      <div className="chapter-list">
        {props.book.chapters.map((chapter, index) => (
          <button
            className={index === props.activeChapterIndex ? "current" : ""}
            key={chapter.id}
            onClick={() => props.onSelectChapter(index)}
          >
            <span>{chapter.title}</span>
            {index === props.activeChapterIndex && <Check size={16} />}
          </button>
        ))}
      </div>
    </div>
  );
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
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="import novel" onClick={props.onImport}>
          <Upload size={19} />
        </button>
        <button className="icon-button" aria-label="more" onClick={() => props.onMoreOpen(!props.moreOpen)}>
          <MoreHorizontal size={22} />
        </button>
        {props.moreOpen && (
          <div className="more-menu">
            <button onClick={props.onImport}>
              <Upload size={18} /> 导入文件
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
  activeChapterTitle: string;
  canPrev: boolean;
  canNext: boolean;
  draft: string;
  inputPlaceholder: string;
  onDraft(value: string): void;
  onImport(): void;
  onPrev(): void;
  onNext(): void;
  skin: SkinId;
}) {
  return (
    <div className="composer-shell">
      <div className="chapter-pill">
        <button disabled={!props.canPrev} onClick={props.onPrev} aria-label="previous chapter">
          <ArrowLeft size={15} />
        </button>
        <span>{props.activeChapterTitle}</span>
        <button disabled={!props.canNext} onClick={props.onNext} aria-label="next chapter">
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="composer-box">
        <textarea
          value={props.draft}
          onChange={(event) => props.onDraft(event.target.value)}
          placeholder={props.inputPlaceholder}
          rows={2}
        />
        <div className="composer-tools">
          <div className="tool-left">
            <button aria-label="import novel" onClick={props.onImport}>
              <Paperclip size={21} />
            </button>
            {props.skin === "doubao" && (
              <>
                <button>快速</button>
                <button>翻译</button>
                <button>更多</button>
              </>
            )}
          </div>
          <button className="send-button" aria-label="send">
            {props.skin === "doubao" ? <Mic size={20} /> : <Send size={18} />}
          </button>
        </div>
      </div>
      {props.skin === "deepseek" && <ArrowDown className="scroll-cue" size={19} />}
    </div>
  );
}

function SettingsPanel(props: {
  keys: Partial<Record<ApiProvider, string>>;
  onClose(): void;
  onKeyChange(provider: ApiProvider, value: string): void;
  settings: ReaderSettings;
  updateSettings(patch: Partial<ReaderSettings>): void;
}) {
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
