import { defaultDisplaySettings, type NovelSource, type ReaderSettings, type ReaderState } from "./types";

export const defaultSettings: ReaderSettings = {
  skin: "chatgpt",
  bossKeyTarget: "chatgpt",
  apiPolishEnabled: false,
  minChunkChars: 180,
  maxChunkChars: 350,
  interruptionEvery: 2,
  topicDisguiseTheme: "work",
  display: defaultDisplaySettings,
};

export function createInitialReaderState(books: NovelSource[]): ReaderState {
  const sorted = sortBooksByRecent(books);

  return {
    books: sorted,
    activeBookId: sorted[0]?.id ?? null,
    activeChapterIndex: 0,
    chapterReadOffset: 0,
    settings: defaultSettings,
  };
}

export function sortBooksByRecent(books: NovelSource[]): NovelSource[] {
  return [...books].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function selectBook(state: ReaderState, bookId: string): ReaderState {
  if (!state.books.some((book) => book.id === bookId)) {
    return state;
  }

  return {
    ...state,
    activeBookId: bookId,
    activeChapterIndex: 0,
    chapterReadOffset: 0,
    books: sortBooksByRecent(
      state.books.map((book) => (book.id === bookId ? { ...book, updatedAt: Date.now() } : book)),
    ),
  };
}

export function addImportedBooks(state: ReaderState, importedBooks: NovelSource[]): ReaderState {
  if (importedBooks.length === 0) return state;
  const books = sortBooksByRecent([...importedBooks, ...state.books]);
  return {
    ...state,
    books,
    activeBookId: books[0]?.id ?? null,
    activeChapterIndex: 0,
    chapterReadOffset: 0,
  };
}

export function selectChapter(state: ReaderState, chapterIndex: number): ReaderState {
  const book = getActiveBook(state);
  if (!book) return state;
  const bounded = clamp(chapterIndex, 0, Math.max(0, book.chapters.length - 1));

  return {
    ...state,
    activeChapterIndex: bounded,
    chapterReadOffset: 0,
  };
}

export function stepChapter(state: ReaderState, delta: -1 | 1): ReaderState {
  return selectChapter(state, state.activeChapterIndex + delta);
}

export function mergeFolderLibrarySnapshot(
  state: ReaderState,
  books: NovelSource[],
  meta: {
    activeBookId: string | null;
    activeChapterIndex: number;
    chapterReadOffset: number;
  },
  options: { preserveActiveSelection: boolean },
): ReaderState {
  const currentBook = state.activeBookId
    ? books.find((book) => book.id === state.activeBookId) ?? null
    : null;

  if (options.preserveActiveSelection && currentBook) {
    return {
      ...state,
      books,
      activeBookId: currentBook.id,
      activeChapterIndex: clamp(state.activeChapterIndex, 0, Math.max(0, currentBook.chapters.length - 1)),
      chapterReadOffset: state.chapterReadOffset,
    };
  }

  const fallbackBookId =
    meta.activeBookId && books.some((book) => book.id === meta.activeBookId)
      ? meta.activeBookId
      : books[0]?.id ?? null;
  const fallbackBook = books.find((book) => book.id === fallbackBookId) ?? null;

  return {
    ...state,
    books,
    activeBookId: fallbackBookId,
    activeChapterIndex: clamp(meta.activeChapterIndex, 0, Math.max(0, (fallbackBook?.chapters.length ?? 1) - 1)),
    chapterReadOffset: fallbackBook ? Math.max(0, meta.chapterReadOffset) : 0,
  };
}

export function getActiveBook(state: ReaderState): NovelSource | null {
  return state.books.find((book) => book.id === state.activeBookId) ?? null;
}

export function getActiveChapter(state: ReaderState) {
  const book = getActiveBook(state);
  return book?.chapters[state.activeChapterIndex] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
