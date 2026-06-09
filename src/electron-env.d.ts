import type { ReaderSettings } from "./domain/types";

declare global {
  interface Window {
    novelChatDesktop?: {
      platform: "electron";
      saveSettings(settings: ReaderSettings): Promise<void>;
      triggerBossKey(): Promise<void>;
    };
  }
}

export {};
