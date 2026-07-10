import { describe, expect, it } from "vitest";
import {
  assertImportBatchWithinLimits,
  ImportLimitError,
  resolveImportLimits,
} from "../src/domain/importLimits";

describe("import limits", () => {
  it("accepts a batch within every configured limit", () => {
    const limits = resolveImportLimits({ maxFileBytes: 4, maxFiles: 2, maxBatchBytes: 6 });

    expect(() =>
      assertImportBatchWithinLimits(
        [
          { name: "one.txt", size: 3 },
          { name: "two.epub", size: 3 },
        ],
        limits,
      ),
    ).not.toThrow();
  });

  it.each([
    {
      files: [{ name: "large.txt", size: 5 }],
      limits: { maxFileBytes: 4, maxFiles: 2, maxBatchBytes: 10 },
    },
    {
      files: [{ name: "one.txt", size: 1 }, { name: "two.txt", size: 1 }, { name: "three.txt", size: 1 }],
      limits: { maxFileBytes: 4, maxFiles: 2, maxBatchBytes: 10 },
    },
    {
      files: [{ name: "one.txt", size: 3 }, { name: "two.txt", size: 3 }],
      limits: { maxFileBytes: 4, maxFiles: 2, maxBatchBytes: 5 },
    },
  ])("rejects files or batches outside configured limits", ({ files, limits }) => {
    expect(() => assertImportBatchWithinLimits(files, limits)).toThrow(ImportLimitError);
  });
});
