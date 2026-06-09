import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startLocalWebService, type LocalWebService } from "../electron/localWebService";
import { defaultSettings } from "../src/domain/readerState";

let service: LocalWebService | null = null;
let tempDir: string | null = null;

describe("local web service", () => {
  afterEach(async () => {
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

    await postJson(`${service.url}/api/imports`, {
      files: [{ name: "from-open-with.txt", bytes: Array.from(new TextEncoder().encode("text")) }],
    });
    expect(await getJson(`${service.url}/api/imports/pending`)).toEqual({
      files: [{ name: "from-open-with.txt", bytes: Array.from(new TextEncoder().encode("text")) }],
    });
    expect(await getJson(`${service.url}/api/imports/pending`)).toEqual({ files: [] });
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
});

async function getJson(url: string) {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.json();
}

async function putJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
}
