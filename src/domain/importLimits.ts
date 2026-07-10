export type ImportLimits = {
  maxFileBytes: number;
  maxFiles: number;
  maxBatchBytes: number;
};

export const defaultImportLimits: ImportLimits = Object.freeze({
  maxFileBytes: 32 * 1024 * 1024,
  maxFiles: 16,
  maxBatchBytes: 64 * 1024 * 1024,
});

export class ImportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportLimitError";
  }
}

export function resolveImportLimits(overrides: Partial<ImportLimits> = {}): ImportLimits {
  return { ...defaultImportLimits, ...overrides };
}

export function assertImportFileWithinLimits(
  file: { name: string; size: number },
  limits: ImportLimits = defaultImportLimits,
): void {
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new ImportLimitError(`Invalid file size for ${file.name}`);
  }
  if (file.size > limits.maxFileBytes) {
    throw new ImportLimitError(
      `${file.name} exceeds the ${formatMegabytes(limits.maxFileBytes)} MiB per-file import limit`,
    );
  }
}

export function assertImportBatchWithinLimits(
  files: ArrayLike<{ name: string; size: number }>,
  limits: ImportLimits = defaultImportLimits,
): void {
  if (files.length > limits.maxFiles) {
    throw new ImportLimitError(`Import batch exceeds the ${limits.maxFiles}-file limit`);
  }

  let totalBytes = 0;
  for (const file of Array.from(files)) {
    assertImportFileWithinLimits(file, limits);
    totalBytes += file.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxBatchBytes) {
      throw new ImportLimitError(
        `Import batch exceeds the ${formatMegabytes(limits.maxBatchBytes)} MiB total limit`,
      );
    }
  }
}

function formatMegabytes(bytes: number): string {
  return String(Math.round(bytes / (1024 * 1024)));
}
