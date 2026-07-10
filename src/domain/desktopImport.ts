import { getImportFileKind } from "./importSource";

export type DesktopImportFile = {
  name: string;
  bytes: Uint8Array;
};

export function createFileFromDesktopImport(importFile: DesktopImportFile): File {
  const buffer = importFile.bytes.buffer.slice(
    importFile.bytes.byteOffset,
    importFile.bytes.byteOffset + importFile.bytes.byteLength,
  ) as ArrayBuffer;
  return new File([buffer], importFile.name, { type: getDesktopImportMime(importFile.name) });
}

function getDesktopImportMime(fileName: string): string {
  const kind = getImportFileKind(fileName);
  if (kind === "epub") return "application/epub+zip";
  if (kind === "txt") return "text/plain";
  return "application/octet-stream";
}
