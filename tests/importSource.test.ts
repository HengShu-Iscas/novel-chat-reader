import { describe, expect, it } from "vitest";
import { filterSupportedNovelFiles, getImportFileKind, getSupportedNovelPaths } from "../src/domain/importSource";

describe("import source helpers", () => {
  it("accepts TXT and EPUB names case-insensitively", () => {
    expect(getImportFileKind("story.txt")).toBe("txt");
    expect(getImportFileKind("archive.EPUB")).toBe("epub");
    expect(getImportFileKind("cover.png")).toBeNull();
  });

  it("filters command-line paths down to importable novels", () => {
    expect(
      getSupportedNovelPaths([
        "NovelChat Reader.exe",
        "E:\\books\\first.TXT",
        "--flag",
        "E:\\books\\cover.jpg",
        "E:\\books\\second.epub",
      ]),
    ).toEqual(["E:\\books\\first.TXT", "E:\\books\\second.epub"]);
  });

  it("filters browser File objects down to importable novels", () => {
    const files = [
      new File(["a"], "first.txt", { type: "text/plain" }),
      new File(["b"], "second.epub", { type: "application/epub+zip" }),
      new File(["c"], "notes.pdf", { type: "application/pdf" }),
    ];

    expect(filterSupportedNovelFiles(files).map((file) => file.name)).toEqual(["first.txt", "second.epub"]);
  });
});
