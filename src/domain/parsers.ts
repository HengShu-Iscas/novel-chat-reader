import { unzipSync } from "fflate";
import type { Chapter, NovelFormat, NovelSource } from "./types";

const CHAPTER_HEADING =
  /^(第[零〇一二两三四五六七八九十百千万\d]+[章节卷回部篇].*|Chapter\s+\d+.*)$/i;

export async function parseTxt(buffer: ArrayBuffer, filename: string): Promise<NovelSource> {
  const text = decodeText(buffer);
  const title = stripExtension(filename);
  const chapters = splitPlainTextChapters(text);

  return {
    id: makeId(title),
    title,
    format: "txt",
    chapters,
    updatedAt: Date.now(),
  };
}

export async function parseEpub(buffer: ArrayBuffer, filename: string): Promise<NovelSource> {
  const files = unzipSync(new Uint8Array(buffer));
  const container = readZipText(files, "META-INF/container.xml");
  const opfPath = attr(container, "full-path") ?? firstPathEnding(files, ".opf");

  if (!opfPath) {
    throw new Error("EPUB package document not found");
  }

  const opf = readZipText(files, opfPath);
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const title = textBetween(opf, "dc:title") ?? textBetween(opf, "title") ?? stripExtension(filename);
  const manifest = parseManifest(opf);
  const spine = parseSpine(opf);
  const ordered = spine
    .map((idref) => manifest.get(idref))
    .filter((href): href is string => Boolean(href));

  const chapters = ordered.map((href, index) => {
    const path = normalizeZipPath(base + href);
    const xhtml = readZipText(files, path);
    return parseXhtmlChapter(xhtml, index);
  });

  return {
    id: makeId(title),
    title: decodeEntities(title.trim()),
    format: "epub",
    chapters: chapters.length > 0 ? chapters : [{ id: "ch-1", title: "正文", text: "" }],
    updatedAt: Date.now(),
  };
}

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("gb18030").decode(buffer);
  }
}

function splitPlainTextChapters(text: string): Chapter[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const chapters: Chapter[] = [];
  let currentTitle = "正文";
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body || chapters.length === 0) {
      chapters.push({
        id: `ch-${chapters.length + 1}`,
        title: currentTitle.trim(),
        text: body,
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line && CHAPTER_HEADING.test(line)) {
      if (currentLines.length > 0 || chapters.length > 0) {
        flush();
      }
      currentTitle = line;
      currentLines = [];
    } else {
      currentLines.push(rawLine);
    }
  }

  flush();
  return chapters.filter((chapter) => chapter.title !== "正文" || chapter.text.length > 0);
}

function parseManifest(opf: string): Map<string, string> {
  const manifest = new Map<string, string>();
  const itemPattern = /<item\b([^>]+)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(opf))) {
    const id = attr(match[1], "id");
    const href = attr(match[1], "href");
    if (id && href) {
      manifest.set(id, href);
    }
  }

  return manifest;
}

function parseSpine(opf: string): string[] {
  const idrefs: string[] = [];
  const itemRefPattern = /<itemref\b([^>]+)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRefPattern.exec(opf))) {
    const idref = attr(match[1], "idref");
    if (idref) {
      idrefs.push(idref);
    }
  }

  return idrefs;
}

function parseXhtmlChapter(xhtml: string, index: number): Chapter {
  const heading =
    textBetween(xhtml, "h1") ??
    textBetween(xhtml, "h2") ??
    textBetween(xhtml, "title") ??
    `第 ${index + 1} 章`;
  const body = textBetween(xhtml, "body") ?? xhtml;
  const withoutHeadings = body.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  const text = htmlToText(withoutHeadings);

  return {
    id: `ch-${index + 1}`,
    title: decodeEntities(stripTags(heading)).trim(),
    text,
  };
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim(),
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function textBetween(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return pattern.exec(xml)?.[1] ?? null;
}

function attr(xml: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return pattern.exec(xml)?.[1] ?? null;
}

function readZipText(files: Record<string, Uint8Array>, path: string): string {
  const file = files[normalizeZipPath(path)];
  if (!file) {
    throw new Error(`EPUB file missing: ${path}`);
  }
  return new TextDecoder("utf-8").decode(file);
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function firstPathEnding(files: Record<string, Uint8Array>, suffix: string): string | null {
  return Object.keys(files).find((path) => path.toLowerCase().endsWith(suffix)) ?? null;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function makeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
