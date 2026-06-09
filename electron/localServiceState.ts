import type { DesktopImportFile } from "../src/domain/desktopImport";
import { defaultSettings } from "../src/domain/readerState";
import type { NovelSource, ReaderSettings } from "../src/domain/types";
import { toPersistedSettings, type SettingsDraft } from "../src/storage/persistence";

export type LocalServiceMeta = {
  activeBookId: string | null;
  activeChapterIndex: number;
  chapterReadOffset: number;
  settings: ReaderSettings;
};

export type LocalServiceState = {
  books: NovelSource[];
  meta: LocalServiceMeta;
  pendingImports: DesktopImportFile[];
};

export function createLocalServiceState(): LocalServiceState {
  return {
    books: [],
    meta: {
      activeBookId: null,
      activeChapterIndex: 0,
      chapterReadOffset: 0,
      settings: defaultSettings,
    },
    pendingImports: [],
  };
}

export function withLocalLibrary(
  state: LocalServiceState,
  library: {
    books: NovelSource[];
    meta: Omit<LocalServiceMeta, "settings">;
  },
): LocalServiceState {
  return {
    ...state,
    books: library.books,
    meta: {
      ...state.meta,
      activeBookId: library.meta.activeBookId,
      activeChapterIndex: library.meta.activeChapterIndex,
      chapterReadOffset: library.meta.chapterReadOffset,
    },
  };
}

export function withLocalSettings(state: LocalServiceState, settings: SettingsDraft): LocalServiceState {
  return {
    ...state,
    meta: {
      ...state.meta,
      settings: toPersistedSettings(settings),
    },
  };
}

export function enqueuePendingImports(
  state: LocalServiceState,
  imports: DesktopImportFile[],
): LocalServiceState {
  return {
    ...state,
    pendingImports: [...state.pendingImports, ...imports],
  };
}

export function drainPendingImports(state: LocalServiceState): {
  state: LocalServiceState;
  imports: DesktopImportFile[];
} {
  return {
    state: { ...state, pendingImports: [] },
    imports: state.pendingImports,
  };
}
