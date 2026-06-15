import { describe, expect, it, vi } from "vitest";
import {
  createLocalWebStorageAdapter,
  fetchLocalWebLibraryFolderStatus,
  fetchLocalWebPendingImports,
  rescanLocalWebLibraryFolder,
  saveLocalWebLibraryFolderPath,
  selectLocalWebLibraryFolder,
} from "../src/storage/storageAdapter";
import { defaultSettings } from "../src/domain/readerState";

describe("local-web storage adapter", () => {
  it("loads library and settings from the local service APIs", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "/api/library") {
        return jsonResponse({ books: [], meta: { activeBookId: null, activeChapterIndex: 0, chapterReadOffset: 0 } });
      }
      if (url === "/api/settings") {
        return jsonResponse({ settings: defaultSettings });
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const adapter = createLocalWebStorageAdapter(fetchImpl);
    const snapshot = await adapter.load();

    expect(snapshot).toEqual({
      books: [],
      meta: { activeBookId: null, activeChapterIndex: 0, chapterReadOffset: 0, settings: defaultSettings },
    });
  });

  it("persists library and settings without session API keys", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({ ok: true });
    });
    const adapter = createLocalWebStorageAdapter(fetchImpl);

    await adapter.persist({
      books: [],
      meta: {
        activeBookId: null,
        activeChapterIndex: 0,
        chapterReadOffset: 0,
        settings: { ...defaultSettings, sessionKeys: { openai: "secret" } },
      },
    });

    expect(calls.map((call) => call.url)).toEqual(["/api/library", "/api/settings"]);
    expect(JSON.stringify(calls)).not.toContain("secret");
  });

  it("loads pending imports from the local service as Uint8Array payloads", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/api/imports/pending");
      return jsonResponse({ files: [{ name: "queued.txt", bytes: [1, 2, 3] }] });
    });

    const imports = await fetchLocalWebPendingImports(fetchImpl);

    expect(imports).toHaveLength(1);
    expect(imports[0].name).toBe("queued.txt");
    expect(imports[0].bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(imports[0].bytes)).toEqual([1, 2, 3]);
  });

  it("loads, saves, selects, and rescans the local folder library", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/api/library-folder/select") {
        return jsonResponse({ path: "C:\\Books", defaultPath: "C:\\Default", lastScanAt: 1, errors: [], books: [] });
      }
      return jsonResponse({ path: "C:\\Books", defaultPath: "C:\\Default", lastScanAt: 1, errors: [] });
    });

    await fetchLocalWebLibraryFolderStatus(fetchImpl);
    await saveLocalWebLibraryFolderPath("C:\\Books", fetchImpl);
    await rescanLocalWebLibraryFolder(fetchImpl);
    const selected = await selectLocalWebLibraryFolder(fetchImpl);

    expect(calls.map((call) => call.url)).toEqual([
      "/api/library-folder",
      "/api/library-folder",
      "/api/library-folder/rescan",
      "/api/library-folder/select",
    ]);
    expect(calls[1].init?.method).toBe("PUT");
    expect(calls[2].init?.method).toBe("POST");
    expect(calls[3].init?.method).toBe("POST");
    expect(selected.path).toBe("C:\\Books");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}
