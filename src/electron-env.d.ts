import type { ReaderSettings } from "./domain/types";
import type { DesktopImportFile } from "./domain/desktopImport";

declare global {
  interface Window {
    novelChatDesktop?: {
      platform: "electron";
      openFiles(): Promise<DesktopImportFile[]>;
      onOpenFiles(listener: (files: DesktopImportFile[]) => void): () => void;
      saveSettings(settings: ReaderSettings): Promise<void>;
      triggerBossKey(): Promise<void>;
    };
  }
}

export {};
