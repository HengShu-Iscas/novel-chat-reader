import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getImportFileKind, isSupportedNovelImport } from "../src/domain/importSource";
import { parseEpub, parseTxt } from "../src/domain/parsers";
import type { NovelSource } from "../src/domain/types";

export type LibraryFolderScanError = {
  fileName: string;
  message: string;
};

export type LibraryFolderScanResult = {
  books: NovelSource[];
  errors: LibraryFolderScanError[];
  scannedAt: number;
  cache: LibraryFolderScanCache;
  changed: boolean;
};

export type LibraryFolderScanCache = Record<
  string,
  {
    mtimeMs: number;
    size: number;
    book: NovelSource;
  }
>;

export function getDefaultLibraryFolderPath(): string {
  return path.join(os.homedir(), "Documents", "NovelChat Books");
}

export async function ensureLibraryFolder(folderPath: string): Promise<void> {
  await mkdir(folderPath, { recursive: true });
}

export async function scanLibraryFolder(
  folderPath: string,
  now = Date.now(),
  cache: LibraryFolderScanCache = {},
): Promise<LibraryFolderScanResult> {
  const root = path.resolve(folderPath);
  const entries = await readdir(root, { withFileTypes: true });
  const books: NovelSource[] = [];
  const errors: LibraryFolderScanError[] = [];
  const nextCache: LibraryFolderScanCache = {};
  let changed = false;

  for (const entry of entries) {
    if (!entry.isFile() || !isSupportedNovelImport(entry.name)) continue;

    const filePath = path.join(root, entry.name);
    const cacheKey = makeFolderBookId(filePath);
    try {
      const fileStat = await stat(filePath);
      const cached = cache[cacheKey];
      if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
        books.push(cached.book);
        nextCache[cacheKey] = cached;
        continue;
      }

      const bytes = await readFile(filePath);
      const parsed = await parseNovelBytes(bytes, entry.name);
      const book = {
        ...parsed,
        id: cacheKey,
        updatedAt: Math.max(1, Math.floor(fileStat.mtimeMs)),
      };
      books.push(book);
      nextCache[cacheKey] = {
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
        book,
      };
      changed = true;
    } catch (error) {
      errors.push({
        fileName: entry.name,
        message: error instanceof Error ? error.message : "Unknown scan error",
      });
    }
  }

  const previousKeys = Object.keys(cache);
  const nextKeys = Object.keys(nextCache);
  if (previousKeys.length !== nextKeys.length || previousKeys.some((key) => !nextCache[key])) {
    changed = true;
  }

  return {
    books: books.sort(compareFolderBooks),
    errors,
    scannedAt: now,
    cache: nextCache,
    changed,
  };
}

export function makeFolderBookId(filePath: string): string {
  const normalized = path.resolve(filePath).toLowerCase();
  return `folder-${createHash("sha1").update(normalized).digest("hex").slice(0, 18)}`;
}

async function parseNovelBytes(bytes: Buffer, fileName: string): Promise<NovelSource> {
  const format = getImportFileKind(fileName);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  if (format === "epub") {
    return parseEpub(arrayBuffer, fileName);
  }

  if (format === "txt") {
    return parseTxt(arrayBuffer, fileName);
  }

  throw new Error(`Unsupported file type: ${fileName}`);
}

function compareFolderBooks(left: NovelSource, right: NovelSource): number {
  return (
    right.updatedAt - left.updatedAt ||
    left.title.localeCompare(right.title, "zh-Hans-CN") ||
    left.id.localeCompare(right.id)
  );
}
