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
});
