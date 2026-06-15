import { mkdir, mkdtemp, rm, unlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { makeFolderBookId, scanLibraryFolder } from "../electron/libraryFolder";

let tempDir: string | null = null;

describe("folder library scanner", () => {
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("scans top-level TXT and EPUB files while ignoring unsupported files", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-folder-"));
    await writeFile(path.join(tempDir, "alpha.txt"), "第一章 开始\n正文。", "utf8");
    await writeFile(path.join(tempDir, "notes.md"), "not a book", "utf8");
    await writeFile(path.join(tempDir, "sample.epub"), createTinyEpub());

    const result = await scanLibraryFolder(tempDir);

    expect(result.errors).toEqual([]);
    expect(result.books.map((book) => book.title).sort()).toEqual(["alpha", "样例书"]);
    expect(result.books.every((book) => book.id.startsWith("folder-"))).toBe(true);
  });

  it("ignores nested files and keeps deterministic ordering for equal mtimes", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-folder-"));
    const sameTime = new Date("2026-01-01T00:00:00Z");
    await mkdir(path.join(tempDir, "nested"));
    await writeFile(path.join(tempDir, "zeta.txt"), "正文。", "utf8");
    await writeFile(path.join(tempDir, "alpha.txt"), "正文。", "utf8");
    await writeFile(path.join(tempDir, "nested", "hidden.txt"), "不应该被扫描。", "utf8");
    await utimes(path.join(tempDir, "zeta.txt"), sameTime, sameTime);
    await utimes(path.join(tempDir, "alpha.txt"), sameTime, sameTime);

    const result = await scanLibraryFolder(tempDir);

    expect(result.books.map((book) => book.title)).toEqual(["alpha", "zeta"]);
  });

  it("removes deleted files from the next scan and keeps stable IDs for the same path", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-folder-"));
    const filePath = path.join(tempDir, "same-name.txt");
    await writeFile(filePath, "正文 A", "utf8");

    const first = await scanLibraryFolder(tempDir);
    await unlink(filePath);
    const second = await scanLibraryFolder(tempDir);
    await writeFile(filePath, "正文 B", "utf8");
    const third = await scanLibraryFolder(tempDir);

    expect(first.books[0].id).toBe(makeFolderBookId(filePath));
    expect(second.books).toEqual([]);
    expect(third.books[0].id).toBe(first.books[0].id);
    expect(third.books[0].chapters[0].text).toBe("正文 B");
  });

  it("isolates broken EPUB files without blocking valid books", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-folder-"));
    await writeFile(path.join(tempDir, "valid.txt"), "可读正文。", "utf8");
    await writeFile(path.join(tempDir, "broken.epub"), "not a zip", "utf8");

    const result = await scanLibraryFolder(tempDir);

    expect(result.books.map((book) => book.title)).toEqual(["valid"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fileName).toBe("broken.epub");
  });
});

function createTinyEpub(): Buffer {
  return Buffer.from(
    zipSync({
      "META-INF/container.xml": strToU8(
        '<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>',
      ),
      "OPS/package.opf": strToU8(`
        <package>
          <metadata><dc:title>样例书</dc:title></metadata>
          <manifest>
            <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine><itemref idref="chapter1"/></spine>
        </package>
      `),
      "OPS/chapter1.xhtml": strToU8("<html><body><h1>第一章</h1><p>正文。</p></body></html>"),
    }),
  );
}
