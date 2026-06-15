import { describe, expect, it } from "vitest";
import { getDisguisedTopic, getDisguisedTopicsForBooks, topicDisguiseTopics } from "../src/domain/disguiseTopics";
import type { NovelSource } from "../src/domain/types";

const book: NovelSource = {
  id: "book-1",
  title: "真实小说名",
  format: "txt",
  updatedAt: 1,
  chapters: [{ id: "ch-1", title: "第一章", text: "正文" }],
};

describe("disguise topics", () => {
  it("keeps every built-in theme broad enough to avoid obvious repetition", () => {
    for (const topics of Object.values(topicDisguiseTopics)) {
      expect(topics.length).toBeGreaterThanOrEqual(20);
      expect(new Set(topics).size).toBe(topics.length);
    }
  });

  it("maps a book to a stable local topic for the selected theme", () => {
    const first = getDisguisedTopic(book, "work");
    const second = getDisguisedTopic(book, "work");

    expect(first).toBe(second);
    expect(topicDisguiseTopics.work).toContain(first);
  });

  it("uses the selected theme topic pool", () => {
    const topic = getDisguisedTopic(book, "coding");

    expect(topicDisguiseTopics.coding).toContain(topic);
  });

  it("avoids repeated topics within the same sidebar when the pool has room", () => {
    const books: NovelSource[] = Array.from({ length: 12 }, (_, index) => ({
      ...book,
      id: `book-${index}`,
      title: `真实小说名-${index}`,
      updatedAt: index,
    }));
    const assigned = Object.values(getDisguisedTopicsForBooks(books, "work"));

    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("does not use reading-specific words in default disguise topics", () => {
    const forbiddenWords = ["小说", "章节", "阅读", "书名", "正文", "TXT", "EPUB"];
    const allTopics = Object.values(topicDisguiseTopics).flat();

    for (const topic of allTopics) {
      expect(forbiddenWords.some((word) => topic.includes(word))).toBe(false);
    }
  });
});
