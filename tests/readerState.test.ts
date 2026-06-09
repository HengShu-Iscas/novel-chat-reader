import { describe, expect, it } from "vitest";
import { createInitialReaderState, selectBook, selectChapter, stepChapter } from "../src/domain/readerState";
import type { NovelSource } from "../src/domain/types";

const books: NovelSource[] = [
  {
    id: "a",
    title: "诡秘之主",
    format: "txt",
    updatedAt: 10,
    chapters: [
      { id: "a1", title: "第一章", text: "一" },
      { id: "a2", title: "第二章", text: "二" },
      { id: "a3", title: "第三章", text: "三" },
    ],
  },
  {
    id: "b",
    title: "三体",
    format: "epub",
    updatedAt: 20,
    chapters: [{ id: "b1", title: "第一章", text: "一" }],
  },
];

describe("reader state", () => {
  it("selects books by recent order and switches chapters with bounds", () => {
    const initial = createInitialReaderState(books);

    expect(initial.activeBookId).toBe("b");
    expect(initial.activeChapterIndex).toBe(0);
    expect(initial.books.map((book) => book.title)).toEqual(["三体", "诡秘之主"]);

    const selected = selectBook(initial, "a");
    expect(selected.activeBookId).toBe("a");
    expect(selected.activeChapterIndex).toBe(0);

    const chapter = selectChapter(selected, 2);
    expect(chapter.activeChapterIndex).toBe(2);
    expect(chapter.chapterReadOffset).toBe(0);

    expect(stepChapter(chapter, 1).activeChapterIndex).toBe(2);
    expect(stepChapter(chapter, -1).activeChapterIndex).toBe(1);
  });
});
