import type { ChatSegment } from "./types";

const INTERRUPTIONS = ["在忙，稍等", "继续", "收到", "这段帮我重写一下", "下一段"];

export type CreateChapterSegmentsInput = {
  chapterTitle: string;
  text: string;
  seed: string;
  minChars: number;
  maxChars: number;
  interruptionEvery: number;
};

export function createChapterSegments(input: CreateChapterSegmentsInput): ChatSegment[] {
  const random = createSeededRandom(input.seed);
  const chunks = chunkText(input.text, input.minChars, input.maxChars, random);
  const segments: ChatSegment[] = [
    {
      id: `${input.seed}-transition`,
      role: "user",
      kind: "chapter-transition",
      text: `继续：${input.chapterTitle}`,
    },
  ];

  chunks.forEach((chunk, index) => {
    segments.push({
      id: `${input.seed}-prose-${index + 1}`,
      role: "assistant",
      kind: "prose",
      text: chunk,
    });

    if (input.interruptionEvery > 0 && (index + 1) % input.interruptionEvery === 0 && index < chunks.length - 1) {
      const message = INTERRUPTIONS[Math.floor(random() * INTERRUPTIONS.length)];
      segments.push({
        id: `${input.seed}-interrupt-${index + 1}`,
        role: "user",
        kind: "interruption",
        text: message,
      });
    }
  });

  return segments;
}

function chunkText(
  text: string,
  minChars: number,
  maxChars: number,
  random: () => number,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let cursor = 0;
  const min = Math.max(8, Math.min(minChars, maxChars));
  const max = Math.max(min, maxChars);

  while (cursor < normalized.length) {
    const size = min + Math.floor(random() * (max - min + 1));
    chunks.push(normalized.slice(cursor, cursor + size));
    cursor += size;
  }

  return chunks;
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
