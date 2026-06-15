import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseEpub, parseTxt } from "../src/domain/parsers";

describe("parseTxt", () => {
  it("extracts titled chapters from plain text", async () => {
    const text = "第一章 风起\n她推开门。\n\n第二章 夜雨\n雨声渐近。";

    const result = await parseTxt(new TextEncoder().encode(text).buffer, "demo.txt");

    expect(result.title).toBe("demo");
    expect(result.format).toBe("txt");
    expect(result.chapters).toEqual([
      { id: "ch-1", title: "第一章 风起", text: "她推开门。" },
      { id: "ch-2", title: "第二章 夜雨", text: "雨声渐近。" },
    ]);
  });

  it("keeps untitled text as a single body chapter", async () => {
    const text = "没有章节标题。\n但正文仍然应该可读。";

    const result = await parseTxt(new TextEncoder().encode(text).buffer, "untitled.txt");

    expect(result.chapters).toEqual([{ id: "ch-1", title: "正文", text }]);
  });

  it("creates a stable empty body chapter for blank text files", async () => {
    const result = await parseTxt(new TextEncoder().encode("").buffer, "blank.txt");

    expect(result.chapters).toEqual([{ id: "ch-1", title: "正文", text: "" }]);
  });
});

describe("parseEpub", () => {
  it("reads chapters in OPF spine order", async () => {
    const archive = zipSync({
      "META-INF/container.xml": strToU8(
        '<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>',
      ),
      "OPS/package.opf": strToU8(`
        <package>
          <metadata><dc:title>样例书</dc:title></metadata>
          <manifest>
            <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
            <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine>
            <itemref idref="chapter1"/>
            <itemref idref="chapter2"/>
          </spine>
        </package>
      `),
      "OPS/chapter1.xhtml": strToU8("<html><body><h1>第一章</h1><p>先出现。</p></body></html>"),
      "OPS/chapter2.xhtml": strToU8("<html><body><h1>第二章</h1><p>后出现。</p></body></html>"),
    });

    const result = await parseEpub(archive.buffer, "sample.epub");

    expect(result.title).toBe("样例书");
    expect(result.format).toBe("epub");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["第一章", "第二章"]);
    expect(result.chapters.map((chapter) => chapter.text)).toEqual(["先出现。", "后出现。"]);
  });
});
