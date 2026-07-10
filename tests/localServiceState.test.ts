import { describe, expect, it } from "vitest";
import {
  createLocalServiceState,
  drainPendingImports,
  enqueuePendingImports,
  withLibraryFolderPath,
  withLibraryFolderScan,
  withLocalLibrary,
} from "../electron/localServiceState";
import type { DesktopImportFile } from "../src/domain/desktopImport";

const firstImport: DesktopImportFile = {
  name: "first.txt",
  bytes: new TextEncoder().encode("第一章\n文本"),
};

describe("local service state", () => {
  it("starts with an empty library surface", () => {
    const state = createLocalServiceState();

    expect(state.books).toEqual([]);
    expect(state.meta.activeBookId).toBeNull();
    expect(state.pendingImports).toEqual([]);
  });

  it("queues and drains Open With imports exactly once", () => {
    const queued = enqueuePendingImports(createLocalServiceState(), [firstImport]);

    expect(queued.pendingImports).toHaveLength(1);
    const drained = drainPendingImports(queued);
    expect(drained.imports).toEqual([firstImport]);
    expect(drained.state.pendingImports).toEqual([]);
  });

  it("keeps folder book progress cached when a file disappears and returns", () => {
    const book = {
      id: "folder-stable",
      title: "stable",
      format: "txt" as const,
      updatedAt: 1,
      chapters: [
        { id: "c1", title: "第一章", text: "一" },
        { id: "c2", title: "第二章", text: "二" },
      ],
    };
    const folderState = withLibraryFolderPath(createLocalServiceState(), "C:\\Books");
    const scanned = withLibraryFolderScan(folderState, { books: [book], errors: [], scannedAt: 1 });
    const progressed = withLocalLibrary(scanned, {
      books: [book],
      meta: { activeBookId: book.id, activeChapterIndex: 1, chapterReadOffset: 0 },
    });
    const deleted = withLibraryFolderScan(progressed, { books: [], errors: [], scannedAt: 2 });
    const restored = withLibraryFolderScan(deleted, { books: [book], errors: [], scannedAt: 3 });

    expect(deleted.books).toEqual([]);
    expect(restored.meta.activeBookId).toBe(book.id);
    expect(restored.meta.activeChapterIndex).toBe(1);
  });
});
