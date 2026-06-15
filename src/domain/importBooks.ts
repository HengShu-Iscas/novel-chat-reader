import { parseEpub, parseTxt } from "./parsers";
import { filterSupportedNovelFiles, getImportFileKind } from "./importSource";
import type { NovelSource } from "./types";

export async function buildImportedBooks(files: Iterable<File>, now = Date.now()): Promise<NovelSource[]> {
  const supportedFiles = filterSupportedNovelFiles(files);

  const results = await Promise.allSettled(
    supportedFiles.map(async (file, index) => {
      const buffer = await file.arrayBuffer();
      const kind = getImportFileKind(file.name);
      const parsed = kind === "epub" ? await parseEpub(buffer, file.name) : await parseTxt(buffer, file.name);

      return {
        ...parsed,
        id: `${parsed.id}-${now}-${index}`,
        updatedAt: now + index,
      };
    }),
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}
