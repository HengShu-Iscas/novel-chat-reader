import { describe, expect, it } from "vitest";
import { createChapterSegments } from "../src/domain/segments";

describe("createChapterSegments", () => {
  it("starts a chapter with a user transition and splits prose with deterministic interruptions", () => {
    const text =
      "夜色沉在长街上。克莱恩抬起手，敲了敲门。屋内没有回应，只有钟声从远处传来。风吹过窗缝，像一声压低的叹息。";

    const segments = createChapterSegments({
      chapterTitle: "第十二章 旧神的低语",
      text,
      seed: "book-a:12",
      minChars: 16,
      maxChars: 26,
      interruptionEvery: 2,
    });

    expect(segments[0]).toEqual({
      id: "book-a:12-transition",
      role: "user",
      kind: "chapter-transition",
      text: "继续：第十二章 旧神的低语",
    });
    expect(segments.some((segment) => segment.kind === "interruption")).toBe(true);
    expect(segments.filter((segment) => segment.role === "assistant").length).toBeGreaterThan(1);
    expect(segments.map((segment) => segment.text).join("")).toContain("克莱恩抬起手");
  });

  it("preserves spaces in prose chunks", () => {
    const segments = createChapterSegments({
      chapterTitle: "Chapter 1",
      text: "Words keep their spaces when chunked.",
      seed: "spaces",
      minChars: 100,
      maxChars: 120,
      interruptionEvery: 0,
    });

    expect(segments.find((segment) => segment.kind === "prose")?.text).toBe("Words keep their spaces when chunked.");
  });

  it("splits prose on natural Chinese sentence endings", () => {
    const segments = createChapterSegments({
      chapterTitle: "第1章",
      text: "第一句到了。第二句继续！第三句发问？第四句收束。",
      seed: "natural-cn",
      minChars: 7,
      maxChars: 12,
      interruptionEvery: 0,
    });
    const prose = segments.filter((segment) => segment.kind === "prose").map((segment) => segment.text);

    expect(prose).toEqual(["第一句到了。", "第二句继续！", "第三句发问？", "第四句收束。"]);
  });

  it("keeps dialogue punctuation attached to the closing quote", () => {
    const segments = createChapterSegments({
      chapterTitle: "第2章",
      text: "他说：“先别动！”她停在原地。风从门缝里钻进来。",
      seed: "dialogue",
      minChars: 8,
      maxChars: 14,
      interruptionEvery: 0,
    });
    const prose = segments.filter((segment) => segment.kind === "prose").map((segment) => segment.text);

    expect(prose[0]).toBe("他说：“先别动！”");
    expect(prose[1]).toBe("她停在原地。");
  });

  it("does not split English decimals as sentence endings", () => {
    const segments = createChapterSegments({
      chapterTitle: "Chapter 3",
      text: "The value is 3.14 today. Then it ends.",
      seed: "decimal",
      minChars: 12,
      maxChars: 24,
      interruptionEvery: 0,
    });
    const prose = segments.filter((segment) => segment.kind === "prose").map((segment) => segment.text);

    expect(prose[0]).toBe("The value is 3.14 today.");
  });

  it("uses deterministic varied user interruptions without consecutive repeats", () => {
    const segments = createChapterSegments({
      chapterTitle: "第4章",
      text: "甲句结束。乙句结束。丙句结束。丁句结束。戊句结束。己句结束。庚句结束。辛句结束。",
      seed: "interruptions",
      minChars: 5,
      maxChars: 6,
      interruptionEvery: 1,
    });
    const interruptions = segments.filter((segment) => segment.kind === "interruption").map((segment) => segment.text);

    expect(interruptions.length).toBeGreaterThan(2);
    expect(new Set(interruptions).size).toBeGreaterThan(2);
    for (let index = 1; index < interruptions.length; index += 1) {
      expect(interruptions[index]).not.toBe(interruptions[index - 1]);
    }
    expect(interruptions.every((message) => message.length >= 10)).toBe(true);
  });
});
