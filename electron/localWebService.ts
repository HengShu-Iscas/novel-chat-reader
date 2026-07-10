import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { DesktopImportFile } from "../src/domain/desktopImport";
import {
  assertImportBatchWithinLimits,
  defaultImportLimits,
  ImportLimitError,
  resolveImportLimits,
  type ImportLimits,
} from "../src/domain/importLimits";
import type { ReaderSettings } from "../src/domain/types";
import { toPersistedSettings, type SettingsDraft } from "../src/storage/persistence";
import {
  ensureLibraryFolder,
  getDefaultLibraryFolderPath,
  scanLibraryFolder as scanLibraryFolderDefault,
  type LibraryFolderScanCache,
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
  base64?: string;
  bytes?: number[];
};

export type LocalWebServiceLimits = ImportLimits & {
  maxJsonBodyBytes: number;
};

export const defaultLocalWebServiceLimits: LocalWebServiceLimits = Object.freeze({
  ...defaultImportLimits,
  maxJsonBodyBytes: 88 * 1024 * 1024,
});

const SESSION_COOKIE_NAME = "novelchat_session";

type ScanContext = {
  scanLibraryFolder: typeof scanLibraryFolderDefault;
  scanCacheRef: { current: LibraryFolderScanCache };
};

export type StartLocalWebServiceOptions = {
  staticDir: string;
  userDataDir: string;
  preferredPort: number;
  openBrowser?: false | ((url: string) => void | Promise<void>);
  selectLibraryFolder?: false | (() => Promise<string | null>);
  scanLibraryFolder?: typeof scanLibraryFolderDefault;
  limits?: Partial<LocalWebServiceLimits>;
};

export type LocalWebService = {
  port: number;
  url: string;
  close(): Promise<void>;
};

export async function startLocalWebService(options: StartLocalWebServiceOptions): Promise<LocalWebService> {
  await mkdir(options.userDataDir, { recursive: true });
  const importLimits = resolveImportLimits(options.limits);
  const limits: LocalWebServiceLimits = {
    ...importLimits,
    maxJsonBodyBytes: options.limits?.maxJsonBodyBytes ?? defaultLocalWebServiceLimits.maxJsonBodyBytes,
  };
  const sessionToken = randomBytes(32).toString("base64url");
  const scanContext: ScanContext = {
    scanLibraryFolder: options.scanLibraryFolder ?? scanLibraryFolderDefault,
    scanCacheRef: { current: {} },
  };
  let state = await readLocalServiceState(options.userDataDir);
  state = await maybeScanLibraryFolder(options.userDataDir, state, scanContext);
  let stateQueue: Promise<void> = Promise.resolve();

  const withStateQueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = stateQueue.catch(() => undefined).then(operation);
    stateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const waitForStateQueue = async (): Promise<void> => {
    await stateQueue.catch(() => undefined);
  };

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const method = request.method ?? "GET";
      const publicEndpoint = isPublicEndpoint(url.pathname, method);

      if (!isAllowedLocalHost(request.headers.host, getServerPort(server))) {
        writeJson(response, 403, { error: "Local service Host header is forbidden" });
        return;
      }

      if (publicEndpoint) applyPublicCors(response);
      if (method === "OPTIONS") {
        if (isPublicPreflight(url.pathname, request)) {
          applyPublicCors(response);
          response.writeHead(204, { "Access-Control-Allow-Methods": "GET" });
          response.end();
          return;
        }
        writeJson(response, 403, { error: "Cross-origin local service access is forbidden" });
        return;
      }

      if (url.pathname.startsWith("/api/") && !publicEndpoint) {
        const authorizationError = authorizeProtectedRequest(request, sessionToken, getServerPort(server));
        if (authorizationError) {
          writeJson(response, authorizationError.statusCode, { error: authorizationError.message });
          return;
        }
      }

      if (url.pathname === "/health" && method === "GET") {
        writeJson(response, 200, { name: "novel-chat-reader", mode: "local-web" });
        return;
      }

      if (url.pathname === "/api/library" && request.method === "GET") {
        const snapshot = await withStateQueue(async () => {
          state = await maybeScanLibraryFolder(options.userDataDir, state, scanContext);
          return getLibrarySnapshot(state);
        });
        writeJson(response, 200, snapshot);
        return;
      }

      if (url.pathname === "/api/library" && request.method === "PUT") {
        await withStateQueue(async () => {
          const body = (await readJson(request, limits.maxJsonBodyBytes)) as Parameters<typeof withLocalLibrary>[1];
          state = withLocalLibrary(state, body);
          await writeLocalServiceState(options.userDataDir, state);
        });
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/library-folder" && request.method === "GET") {
        await waitForStateQueue();
        writeJson(response, 200, getLibraryFolderStatus(state));
        return;
      }

      if (url.pathname === "/api/library-folder" && request.method === "PUT") {
        const status = await withStateQueue(async () => {
          const body = (await readJson(request, limits.maxJsonBodyBytes)) as { path?: string | null };
          state = await setLibraryFolderPath(options.userDataDir, state, body.path ?? null, scanContext);
          return getLibraryFolderStatus(state);
        });
        writeJson(response, 200, status);
        return;
      }

      if (url.pathname === "/api/library-folder/rescan" && request.method === "POST") {
        const snapshot = await withStateQueue(async () => {
          state = await maybeScanLibraryFolder(options.userDataDir, state, scanContext, true);
          return getLibraryFolderSnapshot(state);
        });
        writeJson(response, 200, snapshot);
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
        const snapshot = await withStateQueue(async () => {
          state = await setLibraryFolderPath(options.userDataDir, state, selectedPath, scanContext);
          return getLibraryFolderSnapshot(state);
        });
        writeJson(response, 200, { cancelled: false, ...snapshot });
        return;
      }

      if (url.pathname === "/api/settings" && request.method === "GET") {
        await waitForStateQueue();
        writeJson(response, 200, state.meta.settings);
        return;
      }

      if (url.pathname === "/api/settings" && request.method === "PUT") {
        await withStateQueue(async () => {
          const body = (await readJson(request, limits.maxJsonBodyBytes)) as ReaderSettings;
          state = withLocalSettings(state, body);
          await writeLocalServiceState(options.userDataDir, state);
        });
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/imports" && request.method === "POST") {
        await withStateQueue(async () => {
          const body = (await readJson(request, limits.maxJsonBodyBytes)) as { files?: JsonImportFile[] };
          const imports = parseJsonImportBatch(body.files ?? [], limits);
          state = enqueuePendingImports(state, imports);
          await writeLocalServiceState(options.userDataDir, state);
        });
        writeJson(response, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/imports/pending" && request.method === "GET") {
        const imports = await withStateQueue(async () => {
          const drained = drainPendingImports(state);
          state = drained.state;
          await writeLocalServiceState(options.userDataDir, state);
          return drained.imports;
        });
        writeJson(response, 200, { files: imports.map(importToJson) });
        return;
      }

      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        setSessionCookie(response, sessionToken);
      }
      await serveStatic(options.staticDir, url.pathname, response);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : error instanceof ImportLimitError ? 413 : 500;
      writeJson(response, statusCode, { error: error instanceof Error ? error.message : "Unknown local service error" });
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
    let pendingImports: DesktopImportFile[] = [];
    try {
      pendingImports = parseJsonImportBatch(parsed.pendingImports ?? [], defaultImportLimits);
    } catch {
      pendingImports = [];
    }
    return {
      ...base,
      ...parsed,
      books: parsed.books ?? base.books,
      meta: {
        ...base.meta,
        ...parsed.meta,
        settings: parsed.meta?.settings ? toPersistedSettings(parsed.meta.settings) : base.meta.settings,
      },
      pendingImports,
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
  const statePath = getStatePath(userDataDir);
  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(
      tempPath,
      JSON.stringify({ ...state, pendingImports: state.pendingImports.map(importToJson) }, null, 2),
      "utf8",
    );
    await rename(tempPath, statePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

function getStatePath(userDataDir: string): string {
  return path.join(userDataDir, "novelchat-local-state.json");
}

function importToJson(importFile: DesktopImportFile): JsonImportFile {
  return { name: importFile.name, base64: Buffer.from(importFile.bytes).toString("base64") };
}

function importFromJson(importFile: JsonImportFile): DesktopImportFile {
  if (!importFile || typeof importFile.name !== "string" || !importFile.name.trim()) {
    throw new HttpError(400, "Import file name is required");
  }

  if (typeof importFile.base64 === "string") {
    return { name: importFile.name, bytes: decodeBase64(importFile.base64) };
  }

  if (Array.isArray(importFile.bytes) && importFile.bytes.every(isByte)) {
    return { name: importFile.name, bytes: new Uint8Array(importFile.bytes) };
  }

  throw new HttpError(400, `Import payload is missing for ${importFile.name}`);
}

function parseJsonImportBatch(files: unknown, limits: ImportLimits): DesktopImportFile[] {
  if (!Array.isArray(files)) {
    throw new HttpError(400, "Import files must be an array");
  }

  const imports = files.map((file) => importFromJson(file as JsonImportFile));
  assertImportBatchWithinLimits(
    imports.map((file) => ({ name: file.name, size: file.bytes.byteLength })),
    limits,
  );
  return imports;
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new HttpError(400, "Import payload is not valid base64");
  }

  const buffer = Buffer.from(value, "base64");
  if (buffer.toString("base64").replace(/=+$/, "") !== normalized) {
    throw new HttpError(400, "Import payload is not valid base64");
  }
  return new Uint8Array(buffer);
}

function isByte(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;
}

async function setLibraryFolderPath(
  userDataDir: string,
  state: LocalServiceState,
  folderPath: string | null,
  scanContext: ScanContext,
): Promise<LocalServiceState> {
  const normalizedPath = normalizeLibraryFolderPath(folderPath);
  let next = withLibraryFolderPath(state, normalizedPath);
  if (normalizedPath) {
    await ensureLibraryFolder(normalizedPath);
    scanContext.scanCacheRef.current = {};
    next = await maybeScanLibraryFolder(userDataDir, next, scanContext, true);
  } else {
    scanContext.scanCacheRef.current = {};
    await writeLocalServiceState(userDataDir, next);
  }
  return next;
}

async function maybeScanLibraryFolder(
  userDataDir: string,
  state: LocalServiceState,
  scanContext: ScanContext,
  force = false,
): Promise<LocalServiceState> {
  if (!state.libraryFolder.path) return state;
  if (!force && state.libraryFolder.lastScanAt && Date.now() - state.libraryFolder.lastScanAt < 1200) {
    return state;
  }

  try {
    await ensureLibraryFolder(state.libraryFolder.path);
    const scan = await scanContext.scanLibraryFolder(
      state.libraryFolder.path,
      Date.now(),
      scanContext.scanCacheRef.current,
    );
    scanContext.scanCacheRef.current = scan.cache;
    const next = withLibraryFolderScan(state, scan);
    if (scan.changed || !sameScanErrors(state.libraryFolder.errors, scan.errors)) {
      await writeLocalServiceState(userDataDir, next);
    }
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
    ...getLibrarySnapshot(state),
  };
}

function getLibrarySnapshot(state: LocalServiceState) {
  return {
    books: state.books,
    meta: {
      activeBookId: state.meta.activeBookId,
      activeChapterIndex: state.meta.activeChapterIndex,
      chapterReadOffset: state.meta.chapterReadOffset,
    },
  };
}

function sameScanErrors(left: LibraryFolderScanError[], right: LibraryFolderScanError[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readJson(request: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    request.resume();
    throw new HttpError(413, `JSON request body exceeds the ${maxBytes}-byte limit`);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      request.resume();
      throw new HttpError(413, `JSON request body exceeds the ${maxBytes}-byte limit`);
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new HttpError(400, "JSON request body is invalid");
  }
}

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
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

function applyPublicCors(response: http.ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
}

function isPublicEndpoint(pathname: string, method: string): boolean {
  return method === "GET" && (pathname === "/health" || pathname === "/api/settings");
}

function isPublicPreflight(pathname: string, request: http.IncomingMessage): boolean {
  const requestedMethod = request.headers["access-control-request-method"];
  return requestedMethod === "GET" && (pathname === "/health" || pathname === "/api/settings");
}

function authorizeProtectedRequest(
  request: http.IncomingMessage,
  sessionToken: string,
  serverPort: number,
): { statusCode: 401 | 403; message: string } | null {
  const origin = request.headers.origin;
  if (origin && !isAllowedLocalOrigin(origin, serverPort)) {
    return { statusCode: 403, message: "Cross-origin local service access is forbidden" };
  }

  if (readCookie(request.headers.cookie, SESSION_COOKIE_NAME) !== sessionToken) {
    return { statusCode: 401, message: "Local service session is required" };
  }
  return null;
}

function isAllowedLocalOrigin(origin: string, serverPort: number): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "http:" &&
      (hostname === "127.0.0.1" || hostname === "localhost") &&
      Number(url.port) === serverPort
    );
  } catch {
    return false;
  }
}

function isAllowedLocalHost(host: string | undefined, serverPort: number): boolean {
  if (!host) return false;
  try {
    const url = new URL(`http://${host}`);
    const hostname = url.hostname.toLowerCase();
    return (
      (hostname === "127.0.0.1" || hostname === "localhost") &&
      Number(url.port) === serverPort
    );
  } catch {
    return false;
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function setSessionCookie(response: http.ServerResponse, sessionToken: string): void {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`,
  );
  response.setHeader("Cache-Control", "no-store");
}

function getServerPort(server: http.Server): number {
  const address = server.address();
  return address && typeof address !== "string" ? address.port : 0;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
