import type { ChatSegment } from "./types";

const INTERRUPTIONS = [
  "我先看这一段，后面接着往下",
  "这里先不用总结，继续展开后面的部分",
  "刚才这段信息量有点多，后面按原节奏继续",
  "这部分我大概明白了，先往下讲",
  "我这边处理点事，你继续把后面发出来",
  "先保持这个上下文，后面不要跳太快",
  "这个地方先记一下，继续到下一段",
  "我先对照一下前面内容，后面继续",
  "暂时不用解释概念，直接接着正文走",
  "这段先这样，继续看后面的变化",
  "我可能要回头看一眼，但你先继续",
  "后面如果有转折，直接接着发出来",
  "这里的语气先保留，继续往后看",
  "我先不追问细节，后面内容继续",
  "这段节奏可以，按这个密度继续",
  "先别切成总结，继续给后面的内容",
  "我这边先标一下，下一段继续",
  "刚才这部分有用，继续往下推进",
];

const CLOSING_QUOTES = new Set(["”", "’", "」", "』", "》", "）", ")", "】", "]"]);
const SENTENCE_PUNCTUATION = new Set(["。", "！", "？", "!", "?", "；", ";"]);
const COMMA_PUNCTUATION = new Set(["，", ",", "、", "：", ":"]);

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
  let lastInterruptionIndex = -1;
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
      const picked = pickInterruption(random, lastInterruptionIndex);
      lastInterruptionIndex = picked.index;
      segments.push({
        id: `${input.seed}-interrupt-${index + 1}`,
        role: "user",
        kind: "interruption",
        text: picked.message,
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
  const softMin = Math.max(4, Math.floor(min * 0.6));

  while (cursor < normalized.length) {
    const target = min + Math.floor(random() * (max - min + 1));
    const boundary = findChunkBoundary(normalized, cursor, softMin, max, target);
    const chunk = normalized.slice(cursor, boundary).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    cursor = skipWhitespace(normalized, boundary);
  }

  return chunks;
}

function pickInterruption(random: () => number, lastIndex: number): { index: number; message: string } {
  let index = Math.floor(random() * INTERRUPTIONS.length);
  if (INTERRUPTIONS.length > 1 && index === lastIndex) {
    index = (index + 1) % INTERRUPTIONS.length;
  }
  return { index, message: INTERRUPTIONS[index] };
}

function findChunkBoundary(text: string, cursor: number, softMin: number, max: number, target: number): number {
  const hardEnd = Math.min(text.length, cursor + max);
  const sentenceBoundary = findFirstBoundary(text, cursor, hardEnd, softMin, isSentenceBoundaryAt);
  if (sentenceBoundary !== null) {
    return sentenceBoundary;
  }

  const preferredEnd = Math.min(text.length, cursor + target);
  const commaBoundary = findNearestBoundary(text, cursor, hardEnd, preferredEnd, softMin, isCommaBoundaryAt);
  if (commaBoundary !== null) {
    return commaBoundary;
  }

  return hardEnd;
}

function findFirstBoundary(
  text: string,
  cursor: number,
  hardEnd: number,
  softMin: number,
  predicate: (text: string, index: number) => number | null,
): number | null {
  for (let index = cursor; index < hardEnd; index += 1) {
    const boundary = predicate(text, index);
    if (boundary !== null && boundary - cursor >= softMin) {
      return boundary;
    }
  }
  return null;
}

function findNearestBoundary(
  text: string,
  cursor: number,
  hardEnd: number,
  preferredEnd: number,
  softMin: number,
  predicate: (text: string, index: number) => number | null,
): number | null {
  let best: number | null = null;
  for (let index = cursor; index < hardEnd; index += 1) {
    const boundary = predicate(text, index);
    if (boundary === null || boundary - cursor < softMin) continue;
    if (best === null || Math.abs(boundary - preferredEnd) < Math.abs(best - preferredEnd)) {
      best = boundary;
    }
  }
  return best;
}

function isSentenceBoundaryAt(text: string, index: number): number | null {
  const char = text[index];
  if (char === "…") {
    let end = index + 1;
    while (text[end] === "…") end += 1;
    return advanceClosingQuotes(text, end);
  }

  if (char === ".") {
    if (isDecimalPoint(text, index)) return null;
    const next = text[index + 1];
    if (next && !/\s/.test(next) && !CLOSING_QUOTES.has(next)) return null;
    return advanceClosingQuotes(text, index + 1);
  }

  if (!SENTENCE_PUNCTUATION.has(char)) return null;
  return advanceClosingQuotes(text, index + 1);
}

function isCommaBoundaryAt(text: string, index: number): number | null {
  if (!COMMA_PUNCTUATION.has(text[index])) return null;
  return advanceClosingQuotes(text, index + 1);
}

function advanceClosingQuotes(text: string, end: number): number {
  while (CLOSING_QUOTES.has(text[end])) {
    end += 1;
  }
  return end;
}

function isDecimalPoint(text: string, index: number): boolean {
  return /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "");
}

function skipWhitespace(text: string, cursor: number): number {
  let next = cursor;
  while (next < text.length && /\s/.test(text[next])) {
    next += 1;
  }
  return next;
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
