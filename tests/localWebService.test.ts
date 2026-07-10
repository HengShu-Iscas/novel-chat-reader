import { mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanLibraryFolder } from "../electron/libraryFolder";
import { isPathInsideDirectory, startLocalWebService, type LocalWebService } from "../electron/localWebService";
import { defaultSettings } from "../src/domain/readerState";

let service: LocalWebService | null = null;
let tempDir: string | null = null;
const sessionCookies = new Map<string, string>();

describe("local web service", () => {
  afterEach(async () => {
    sessionCookies.clear();
    if (service) {
      await service.close();
      service = null;
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("serves health, library, sanitized settings, and one-shot pending imports", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
    });

    const health = await getJson(`${service.url}/health`);
    expect(health).toMatchObject({ name: "novel-chat-reader" });

    const library = await getJson(`${service.url}/api/library`);
    expect(library).toEqual({
      books: [],
      meta: { activeBookId: null, activeChapterIndex: 0, chapterReadOffset: 0 },
    });

    await putJson(`${service.url}/api/settings`, { ...defaultSettings, sessionKeys: { openai: "secret" } });
    expect(await getJson(`${service.url}/api/settings`)).toEqual(defaultSettings);
    expect(JSON.stringify(await getJson(`${service.url}/api/settings`))).not.toContain("secret");
    expect((await readdir(tempDir)).filter((name) => name.includes(".tmp"))).toEqual([]);

    await postJson(`${service.url}/api/imports`, {
      files: [{ name: "from-open-with.txt", bytes: Array.from(new TextEncoder().encode("text")) }],
    });
    expect(await getJson(`${service.url}/api/imports/pending`)).toEqual({
      files: [{ name: "from-open-with.txt", base64: Buffer.from("text").toString("base64") }],
    });
    expect(await getJson(`${service.url}/api/imports/pending`)).toEqual({ files: [] });

    await postJson(`${service.url}/api/imports`, {
      files: [{ name: "base64.txt", base64: Buffer.from("next").toString("base64") }],
    });
    expect(await getJson(`${service.url}/api/imports/pending`)).toEqual({
      files: [{ name: "base64.txt", base64: Buffer.from("next").toString("base64") }],
    });
  });

  it("keeps discovery/settings public and protects private local APIs with cookie and Origin checks", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
    });

    expect((await fetch(`${service.url}/health`)).status).toBe(200);
    expect((await fetch(`${service.url}/api/settings`)).status).toBe(200);
    expect((await fetch(`${service.url}/api/library`)).status).toBe(401);
    expect(await requestStatus(`${service.url}/health`, { Host: `example.com:${service.port}` })).toBe(403);

    const cookie = await getSessionCookie(`${service.url}/api/library`);
    const forbidden = await fetch(`${service.url}/api/library`, {
      headers: { Cookie: cookie, Origin: "https://example.com" },
    });
    expect(forbidden.status).toBe(403);

    const allowed = await fetch(`${service.url}/api/library`, {
      headers: { Cookie: cookie, Origin: service.url },
    });
    expect(allowed.status).toBe(200);
  });

  it("rejects oversized JSON bodies, files, file counts, and import batches with 413", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
      limits: { maxJsonBodyBytes: 256, maxFileBytes: 4, maxFiles: 2, maxBatchBytes: 5 },
    });

    expect((await authenticatedFetch(`${service.url}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(300) }),
    })).status).toBe(413);
    expect(await requestChunkedStatus(
      `${service.url}/api/settings`,
      await getSessionCookie(`${service.url}/api/settings`),
      JSON.stringify({ padding: "x".repeat(300) }),
    )).toBe(413);

    expect((await authenticatedFetch(`${service.url}/api/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [{ name: "large.txt", base64: Buffer.from("12345").toString("base64") }] }),
    })).status).toBe(413);

    expect((await authenticatedFetch(`${service.url}/api/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          { name: "one.txt", base64: Buffer.from("123").toString("base64") },
          { name: "two.txt", base64: Buffer.from("456").toString("base64") },
        ],
      }),
    })).status).toBe(413);

    expect((await authenticatedFetch(`${service.url}/api/imports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          { name: "one.txt", base64: "MQ==" },
          { name: "two.txt", base64: "Mg==" },
          { name: "three.txt", base64: "Mw==" },
        ],
      }),
    })).status).toBe(413);
  });

  it("normalizes older local state files that do not have display settings", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    const { display: _display, ...oldSettings } = defaultSettings;
    await writeFile(
      path.join(tempDir, "novelchat-local-state.json"),
      JSON.stringify({
        books: [],
        meta: {
          activeBookId: null,
          activeChapterIndex: 0,
          chapterReadOffset: 0,
          settings: oldSettings,
        },
        pendingImports: [],
      }),
      "utf8",
    );

    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
    });

    expect(await getJson(`${service.url}/api/settings`)).toEqual(defaultSettings);
  });

  it("falls back safely when the local state file is corrupted", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    await writeFile(path.join(tempDir, "novelchat-local-state.json"), "{not-json", "utf8");

    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
    });

    expect(await getJson(`${service.url}/api/library`)).toEqual({
      books: [],
      meta: { activeBookId: null, activeChapterIndex: 0, chapterReadOffset: 0 },
    });
  });

  it("serializes folder rescans and library saves so the latest selected book wins", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    const booksDir = path.join(tempDir, "books");
    await mkdir(booksDir, { recursive: true });
    await writeFile(path.join(booksDir, "first.txt"), "First body.", "utf8");
    await writeFile(path.join(booksDir, "second.txt"), "Second body.", "utf8");

    let delayNextScan = false;
    const scanGate: { markStarted?: () => void; release?: () => void } = {};
    const delayedScanStarted = new Promise<void>((resolve) => {
      scanGate.markStarted = resolve;
    });
    const delayedScanReleased = new Promise<void>((resolve) => {
      scanGate.release = resolve;
    });

    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
      scanLibraryFolder: async (...args) => {
        if (delayNextScan) {
          scanGate.markStarted?.();
          await delayedScanReleased;
        }
        return scanLibraryFolder(...args);
      },
    });

    await putJson(`${service.url}/api/library-folder`, { path: booksDir });
    const folderSnapshot = await postJson(`${service.url}/api/library-folder/rescan`, {});
    const firstId = folderSnapshot.books.find((book: { title: string }) => book.title === "first").id;
    const secondId = folderSnapshot.books.find((book: { title: string }) => book.title === "second").id;
    await putJson(`${service.url}/api/library`, {
      books: folderSnapshot.books,
      meta: { activeBookId: firstId, activeChapterIndex: 0, chapterReadOffset: 0 },
    });

    delayNextScan = true;
    const rescan = postJson(`${service.url}/api/library-folder/rescan`, {});
    await delayedScanStarted;
    const saveSecond = putJson(`${service.url}/api/library`, {
      books: folderSnapshot.books,
      meta: { activeBookId: secondId, activeChapterIndex: 0, chapterReadOffset: 0 },
    });
    scanGate.release?.();
    await Promise.all([rescan, saveSecond]);

    const library = await getJson(`${service.url}/api/library`);
    expect(library.meta.activeBookId).toBe(secondId);
  });

  it("saves and rescans a folder library without keeping deleted files", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    const booksDir = path.join(tempDir, "books");
    await mkdir(booksDir, { recursive: true });
    await writeFile(path.join(booksDir, "folder-book.txt"), "第一章 目录\n正文。", "utf8");

    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
    });

    const status = await putJson(`${service.url}/api/library-folder`, { path: booksDir });
    expect(status).toMatchObject({ path: booksDir, errors: [] });

    const library = await getJson(`${service.url}/api/library`);
    expect(library.books).toHaveLength(1);
    expect(library.books[0].title).toBe("folder-book");

    await unlink(path.join(booksDir, "folder-book.txt"));
    const rescanned = await postJson(`${service.url}/api/library-folder/rescan`, {});
    expect(rescanned.books).toEqual([]);
  });

  it("uses the native folder selector callback when exposed by the launcher", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "novelchat-service-"));
    const booksDir = path.join(tempDir, "selected-books");
    await mkdir(booksDir, { recursive: true });
    await writeFile(path.join(booksDir, "selected.txt"), "正文。", "utf8");

    service = await startLocalWebService({
      staticDir: tempDir,
      userDataDir: tempDir,
      preferredPort: 0,
      openBrowser: false,
      selectLibraryFolder: async () => booksDir,
    });

    const selected = await postJson(`${service.url}/api/library-folder/select`, {});

    expect(selected.cancelled).toBe(false);
    expect(selected.path).toBe(booksDir);
    expect(selected.books.map((book: { title: string }) => book.title)).toEqual(["selected"]);
  });
});

describe("local web static path guard", () => {
  it("accepts files inside the static directory", () => {
    const staticRoot = path.resolve("dist");
    const filePath = path.join(staticRoot, "assets", "index.js");

    expect(isPathInsideDirectory(filePath, staticRoot)).toBe(true);
  });

  it("rejects sibling directories with the same prefix", () => {
    const staticRoot = path.resolve("dist");
    const sibling = path.resolve("dist-evil", "index.html");

    expect(isPathInsideDirectory(sibling, staticRoot)).toBe(false);
  });
});

async function getJson(url: string) {
  const response = await authenticatedFetch(url);
  expect(response.ok).toBe(true);
  return response.json();
}

async function putJson(url: string, body: unknown) {
  const response = await authenticatedFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function postJson(url: string, body: unknown) {
  const response = await authenticatedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", await getSessionCookie(url));
  return fetch(url, { ...init, headers });
}

async function getSessionCookie(url: string): Promise<string> {
  const origin = new URL(url).origin;
  const cached = sessionCookies.get(origin);
  if (cached) return cached;

  const response = await fetch(`${origin}/`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  expect(cookie).toMatch(/^novelchat_session=/);
  sessionCookies.set(origin, cookie!);
  return cookie!;
}

async function requestStatus(url: string, headers: http.OutgoingHttpHeaders): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
  });
}

async function requestChunkedStatus(url: string, cookie: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
    request.write(body.slice(0, 200));
    request.end(body.slice(200));
  });
}
