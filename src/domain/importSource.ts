import type { NovelFormat } from "./types";

const supportedImportExtensions: Record<string, NovelFormat> = {
  ".epub": "epub",
  ".txt": "txt",
};

export function getImportFileKind(fileName: string): NovelFormat | null {
  const normalized = fileName.toLowerCase();
  const extension = Object.keys(supportedImportExtensions).find((suffix) => normalized.endsWith(suffix));
  return extension ? supportedImportExtensions[extension] : null;
}

export function isSupportedNovelImport(fileName: string): boolean {
  return getImportFileKind(fileName) !== null;
}

export function filterSupportedNovelFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter((file) => isSupportedNovelImport(file.name));
}

export function getSupportedNovelPaths(paths: Iterable<string>): string[] {
  return Array.from(paths).filter(isSupportedNovelImport);
}
