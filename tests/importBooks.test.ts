import { describe, expect, it } from "vitest";
import { buildImportedBooks } from "../src/domain/importBooks";

function txtFile(name: string, text: string): File {
  return new File([new TextEncoder().encode(text)], name, { type: "text/plain" });
}

describe("buildImportedBooks", () => {
  it("imports multiple supported novels and skips unsupported files", async () => {
    const books = await buildImportedBooks([
      txtFile("first.txt", "第一章 起\n门开了。"),
      new File(["ignored"], "cover.png", { type: "image/png" }),
      txtFile("second.TXT", "第一章 夜\n雨停了。"),
    ]);

    expect(books.map((book) => book.title)).toEqual(["first", "second"]);
    expect(books.map((book) => book.format)).toEqual(["txt", "txt"]);
    expect(books[0].chapters[0].title).toBe("第一章 起");
    expect(books[1].chapters[0].title).toBe("第一章 夜");
  });
});
