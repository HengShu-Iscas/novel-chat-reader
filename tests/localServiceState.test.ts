import { describe, expect, it } from "vitest";
import { createLocalServiceState, drainPendingImports, enqueuePendingImports } from "../electron/localServiceState";
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
});
