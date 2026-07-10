import type { NovelSource, ReaderSettings } from "../domain/types";
import type { DesktopImportFile } from "../domain/desktopImport";
import { toPersistedSettings } from "./persistence";
import type { SettingsDraft } from "./persistence";

export type ReaderLibraryMeta = {
  activeBookId: string | null;
  activeChapterIndex: number;
  chapterReadOffset: number;
};

export type ReaderSnapshot = {
  books: NovelSource[];
  meta: ReaderLibraryMeta & {
    settings: ReaderSettings;
  };
};

export type LocalLibraryFolderStatus = {
  path: string | null;
  defaultPath: string;
  lastScanAt: number | null;
  errors: Array<{ fileName: string; message: string }>;
};

export type LocalLibraryFolderScanResult = LocalLibraryFolderStatus & {
  books?: NovelSource[];
  meta?: ReaderLibraryMeta;
  cancelled?: boolean;
};

export type PersistableReaderSnapshot = {
  books: NovelSource[];
  meta: ReaderLibraryMeta & {
    settings: ReaderSettings | SettingsDraft;
  };
};

export type StorageAdapter = {
  load(): Promise<ReaderSnapshot | null>;
  persist(snapshot: PersistableReaderSnapshot): Promise<void>;
};

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function createLocalWebStorageAdapter(
  fetchImpl: FetchLike = fetch,
): StorageAdapter {
  return {
    async load() {
      const [libraryResponse, settingsResponse] = await Promise.all([
        fetchImpl("/api/library"),
        fetchImpl("/api/settings"),
      ]);

      if (!libraryResponse.ok || !settingsResponse.ok) {
        throw new Error("Local NovelChat service returned an error while loading state");
      }

      const library = (await libraryResponse.json()) as {
        books: NovelSource[];
        meta: ReaderLibraryMeta;
      };
      const settingsBody = (await settingsResponse.json()) as { settings?: SettingsDraft } | SettingsDraft;
      const settingsDraft = isWrappedSettings(settingsBody) ? settingsBody.settings : settingsBody;
      if (!settingsDraft) {
        throw new Error("Local NovelChat service returned settings without a settings payload");
      }
      const settings = toPersistedSettings(settingsDraft);

      return {
        books: library.books,
        meta: { ...library.meta, settings },
      };
    },
    async persist(snapshot) {
      const settings = toPersistedSettings(snapshot.meta.settings);
      const libraryBody = JSON.stringify({
        books: snapshot.books,
        meta: {
          activeBookId: snapshot.meta.activeBookId,
          activeChapterIndex: snapshot.meta.activeChapterIndex,
          chapterReadOffset: snapshot.meta.chapterReadOffset,
        },
      });

      const responses = await Promise.all([
        fetchImpl("/api/library", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: libraryBody,
        }),
        fetchImpl("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
      ]);
      if (responses.some((response) => !response.ok)) {
        throw new Error("Local NovelChat service returned an error while saving state");
      }
    },
  };
}

function isWrappedSettings(value: { settings?: SettingsDraft } | SettingsDraft): value is { settings?: SettingsDraft } {
  return "settings" in value;
}

export async function fetchLocalWebPendingImports(fetchImpl: FetchLike = fetch): Promise<DesktopImportFile[]> {
  const response = await fetchImpl("/api/imports/pending");
  if (!response.ok) {
    throw new Error("Local NovelChat service returned an error while loading pending imports");
  }
  const body = (await response.json()) as {
    files?: Array<{ name: string; base64?: string; bytes?: number[] }>;
  };
  return (body.files ?? []).map((file) => ({ name: file.name, bytes: decodeImportBytes(file) }));
}

function decodeImportBytes(file: { name: string; base64?: string; bytes?: number[] }): Uint8Array {
  if (typeof file.base64 === "string") {
    const binary = atob(file.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  if (Array.isArray(file.bytes)) return new Uint8Array(file.bytes);
  throw new Error(`Local NovelChat service returned ${file.name} without an import payload`);
}

export async function fetchLocalWebLibraryFolderStatus(
  fetchImpl: FetchLike = fetch,
): Promise<LocalLibraryFolderStatus> {
  const response = await fetchImpl("/api/library-folder");
  if (!response.ok) {
    throw new Error("Local NovelChat service returned an error while loading the library folder");
  }
  return response.json() as Promise<LocalLibraryFolderStatus>;
}

export async function saveLocalWebLibraryFolderPath(
  folderPath: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<LocalLibraryFolderStatus> {
  const response = await fetchImpl("/api/library-folder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!response.ok) {
    throw new Error("Local NovelChat service returned an error while saving the library folder");
  }
  return response.json() as Promise<LocalLibraryFolderStatus>;
}

export async function selectLocalWebLibraryFolder(
  fetchImpl: FetchLike = fetch,
): Promise<LocalLibraryFolderScanResult> {
  if (typeof window !== "undefined" && window.novelChatDesktop?.selectLibraryFolder) {
    const selectedPath = await window.novelChatDesktop.selectLibraryFolder();
    if (!selectedPath) {
      return { ...(await fetchLocalWebLibraryFolderStatus(fetchImpl)), cancelled: true };
    }
    await saveLocalWebLibraryFolderPath(selectedPath, fetchImpl);
    return rescanLocalWebLibraryFolder(fetchImpl);
  }

  const response = await fetchImpl("/api/library-folder/select", { method: "POST" });
  if (!response.ok) {
    throw new Error("Local NovelChat service returned an error while selecting the library folder");
  }
  return response.json() as Promise<LocalLibraryFolderScanResult>;
}

export async function rescanLocalWebLibraryFolder(fetchImpl: FetchLike = fetch): Promise<LocalLibraryFolderScanResult> {
  const response = await fetchImpl("/api/library-folder/rescan", { method: "POST" });
  if (!response.ok) {
    throw new Error("Local NovelChat service returned an error while rescanning the library folder");
  }
  return response.json() as Promise<LocalLibraryFolderScanResult>;
}
