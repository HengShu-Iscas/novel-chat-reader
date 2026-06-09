import Dexie, { type Table } from "dexie";
import type { NovelSource, ReaderSettings } from "../domain/types";
import { toPersistedSettings } from "./persistence";

type ReaderMeta = {
  id: "reader";
  activeBookId: string | null;
  activeChapterIndex: number;
  chapterReadOffset: number;
  settings: ReaderSettings;
};

class NovelChatDb extends Dexie {
  books!: Table<NovelSource, string>;
  meta!: Table<ReaderMeta, string>;

  constructor() {
    super("novel-chat-reader");
    this.version(1).stores({
      books: "id, updatedAt, title, format",
      meta: "id",
    });
  }
}

export const libraryDb = new NovelChatDb();

export async function loadPersistedLibrary(): Promise<{ books: NovelSource[]; meta: ReaderMeta | null }> {
  const [books, meta] = await Promise.all([libraryDb.books.toArray(), libraryDb.meta.get("reader")]);
  return { books, meta: meta ? { ...meta, settings: toPersistedSettings(meta.settings) } : null };
}

export async function persistLibrary(meta: ReaderMeta, books: NovelSource[]): Promise<void> {
  await libraryDb.transaction("rw", libraryDb.books, libraryDb.meta, async () => {
    await libraryDb.books.clear();
    await libraryDb.books.bulkPut(books);
    await libraryDb.meta.put({ ...meta, settings: toPersistedSettings(meta.settings) });
  });
}

export { savePlatformSettings } from "./platformBridge";
