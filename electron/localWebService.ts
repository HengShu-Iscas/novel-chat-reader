import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { DesktopImportFile } from "../src/domain/desktopImport";
import type { ReaderSettings } from "../src/domain/types";
import { toPersistedSettings, type SettingsDraft } from "../src/storage/persistence";
import {
  ensureLibraryFolder,
  getDefaultLibraryFolderPath,
  scanLibraryFolder,
  type LibraryFolderScanError,
} from "./libraryFolder";
import {
  createLocalServiceState,
  drainPendingImports,
  enqueuePendingImports,
  type LocalServiceState,
  withLibraryFolderPath,
  withLibraryFolderScan,
  withLocalLibrary,
  withLocalSettings,
} from "./localServiceState";

type JsonImportFile = {
  name: string;
  bytes: number[];
};

export type StartLocalWebServiceOptions = {
  staticDir: string;
  userDataDir: string;
  preferredPort: number;
  openBrowser?: false | ((url: string) => void | Promise<void>);
  selectLibraryFolder?: false | (() => Promise<string | null>);
};

export type LocalWebService = {
  port: number;
  url: string;
  close(): Promise<void>;
};

export async function startLocalWebService(options: StartLocalWebServiceOptions): Promise<LocalWebService> {
  await mkdir(options.userDataDir, { recursive: true });
  let state = await readLocalServiceState(options.userDataDir);
  state = await maybeScanLibraryFolder(options.userDataDir, state);

  const server = http.createServer(async (request, response) => {
    try {
      applyCors(response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (url.pathname === "/health") {
        writeJson(response, 200, { name: "novel-chat-reader", mode: "local-web" });
        return;
      }

      if (url.pathname === "/api/library" && request.method === "GET") {
        state = await maybeScanLibraryFolder(options.userDataDir, state);
        writeJson(response, 200, {
          books: state.books,
          meta: {
            activeBookId: state.meta.activeBookId,
            activeChapterIndex: state.meta.activeChapterIndex,
            chapterReadOffset: state.meta.chapterReadOffset,
          },
        });
        return;
      }

      if (url.pathname === "/api/library" && request.method === "PUT") {
        const body = (await readJson(request)) as Parameters<typeof withLocalLibrary>[1];
        state = withLocalLibrary(state, body);
        await writeLocalServiceState(options.userDataDir, state);
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/library-folder" && request.method === "GET") {
        writeJson(response, 200, getLibraryFolderStatus(state));
        return;
      }

      if (url.pathname === "/api/library-folder" && request.method === "PUT") {
        const body = (await readJson(request)) as { path?: string | null };
        state = await setLibraryFolderPath(options.userDataDir, state, body.path ?? null);
        writeJson(response, 200, getLibraryFolderStatus(state));
        return;
      }

      if (url.pathname === "/api/library-folder/rescan" && request.method === "POST") {
        state = await maybeScanLibraryFolder(options.userDataDir, state, true);
        writeJson(response, 200, {
          ...getLibraryFolderStatus(state),
          books: state.books,
          meta: {
            activeBookId: state.meta.activeBookId,
            activeChapterIndex: state.meta.activeChapterIndex,
            chapterReadOffset: state.meta.chapterReadOffset,
          },
        });
        return;
      }

      if (url.pathname === "/api/library-folder/select" && request.method === "POST") {
        if (!options.selectLibraryFolder) {
          writeJson(response, 501, { error: "Native folder picker is unavailable in this runtime" });
          return;
        }
        const selectedPath = await options.selectLibraryFolder();
        if (!selectedPath) {
          writeJson(response, 200, { cancelled: true, ...getLibraryFolderStatus(state) });
          return;
        }
        state = await setLibraryFolderPath(options.userDataDir, state, selectedPath);
        writeJson(response, 200, { cancelled: false, ...getLibraryFolderSnapshot(state) });
        return;
      }

      if (url.pathname === "/api/settings" && request.method === "GET") {
        writeJson(response, 200, state.meta.settings);
        return;
      }

      if (url.pathname === "/api/settings" && request.method === "PUT") {
        const body = (await readJson(request)) as ReaderSettings;
        state = withLocalSettings(state, body);
        await writeLocalServiceState(options.userDataDir, state);
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/imports" && request.method === "POST") {
        const body = (await readJson(request)) as { files?: JsonImportFile[] };
        state = enqueuePendingImports(state, (body.files ?? []).map(importFromJson));
        await writeLocalServiceState(options.userDataDir, state);
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/imports/pending" && request.method === "GET") {
        const drained = drainPendingImports(state);
        state = drained.state;
        await writeLocalServiceState(options.userDataDir, state);
        writeJson(response, 200, { files: drained.imports.map(importToJson) });
        return;
      }

      await serveStatic(options.staticDir, url.pathname, response);
    } catch (error) {
      writeJson(response, 500, { error: error instanceof Error ? error.message : "Unknown local service error" });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.preferredPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Local service did not expose a TCP address");
  }

  const service: LocalWebService = {
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };

  if (options.openBrowser) {
    await options.openBrowser(`${service.url}/`);
  }

  return service;
}

async function readLocalServiceState(userDataDir: string): Promise<LocalServiceState> {
  try {
    const raw = await readFile(getStatePath(userDataDir), "utf8");
    const parsed = JSON.parse(raw) as Partial<Omit<LocalServiceState, "pendingImports">> & {
      meta?: Partial<Omit<LocalServiceState["meta"], "settings">> & { settings?: SettingsDraft };
      pendingImports?: JsonImportFile[];
      bookProgressById?: LocalServiceState["bookProgressById"];
      libraryFolder?: {
        path?: string | null;
        lastScanAt?: number | null;
        errors?: LibraryFolderScanError[];
      };
    };
    const base = createLocalServiceState();
    return {
      ...base,
      ...parsed,
      books: parsed.books ?? base.books,
      meta: {
        ...base.meta,
        ...parsed.meta,
        settings: parsed.meta?.settings ? toPersistedSettings(parsed.meta.settings) : base.meta.settings,
      },
      pendingImports: (parsed.pendingImports ?? []).map(importFromJson),
      bookProgressById: parsed.bookProgressById ?? base.bookProgressById,
      libraryFolder: {
        ...base.libraryFolder,
        ...parsed.libraryFolder,
        path: parsed.libraryFolder?.path ?? null,
        lastScanAt: parsed.libraryFolder?.lastScanAt ?? null,
        errors: parsed.libraryFolder?.errors ?? [],
      },
    };
  } catch {
    return createLocalServiceState();
  }
}

async function writeLocalServiceState(userDataDir: string, state: LocalServiceState): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    getStatePath(userDataDir),
    JSON.stringify({ ...state, pendingImports: state.pendingImports.map(importToJson) }, null, 2),
    "utf8",
  );
}

function getStatePath(userDataDir: string): string {
  return path.join(userDataDir, "novelchat-local-state.json");
}

function importToJson(importFile: DesktopImportFile): JsonImportFile {
  return { name: importFile.name, bytes: Array.from(importFile.bytes) };
}

function importFromJson(importFile: JsonImportFile): DesktopImportFile {
  return { name: importFile.name, bytes: new Uint8Array(importFile.bytes) };
}

async function setLibraryFolderPath(
  userDataDir: string,
  state: LocalServiceState,
  folderPath: string | null,
): Promise<LocalServiceState> {
  const normalizedPath = normalizeLibraryFolderPath(folderPath);
  let next = withLibraryFolderPath(state, normalizedPath);
  if (normalizedPath) {
    await ensureLibraryFolder(normalizedPath);
    next = await maybeScanLibraryFolder(userDataDir, next, true);
  } else {
    await writeLocalServiceState(userDataDir, next);
  }
  return next;
}

async function maybeScanLibraryFolder(
  userDataDir: string,
  state: LocalServiceState,
  force = false,
): Promise<LocalServiceState> {
  if (!state.libraryFolder.path) return state;
  if (!force && state.libraryFolder.lastScanAt && Date.now() - state.libraryFolder.lastScanAt < 1200) {
    return state;
  }

  try {
    await ensureLibraryFolder(state.libraryFolder.path);
    const scan = await scanLibraryFolder(state.libraryFolder.path);
    const next = withLibraryFolderScan(state, scan);
    await writeLocalServiceState(userDataDir, next);
    return next;
  } catch (error) {
    const next = {
      ...state,
      libraryFolder: {
        ...state.libraryFolder,
        lastScanAt: Date.now(),
        errors: [
          {
            fileName: state.libraryFolder.path,
            message: error instanceof Error ? error.message : "Unknown folder scan error",
          },
        ],
      },
    };
    await writeLocalServiceState(userDataDir, next);
    return next;
  }
}

function normalizeLibraryFolderPath(folderPath: string | null): string | null {
  const trimmed = folderPath?.trim();
  return trimmed ? path.resolve(trimmed) : null;
}

function getLibraryFolderStatus(state: LocalServiceState) {
  return {
    path: state.libraryFolder.path,
    defaultPath: getDefaultLibraryFolderPath(),
    lastScanAt: state.libraryFolder.lastScanAt,
    errors: state.libraryFolder.errors,
  };
}

function getLibraryFolderSnapshot(state: LocalServiceState) {
  return {
    ...getLibraryFolderStatus(state),
    books: state.books,
    meta: {
      activeBookId: state.meta.activeBookId,
      activeChapterIndex: state.meta.activeChapterIndex,
      chapterReadOffset: state.meta.chapterReadOffset,
    },
  };
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function serveStatic(staticDir: string, rawPath: string, response: http.ServerResponse): Promise<void> {
  const requestPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = path.resolve(staticDir, `.${decodeURIComponent(requestPath)}`);
  const staticRoot = path.resolve(staticDir);

  if (!isPathInsideDirectory(filePath, staticRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
    streamFile(response, filePath);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function streamFile(response: http.ServerResponse, filePath: string): void {
  const stream = createReadStream(filePath);
  stream.once("open", () => {
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    stream.pipe(response);
  });
  stream.once("error", () => {
    if (!response.headersSent) {
      response.writeHead(404);
    }
    response.end("Not found");
  });
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

export function isPathInsideDirectory(filePath: string, directoryPath: string): boolean {
  const relativePath = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function applyCors(response: http.ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
