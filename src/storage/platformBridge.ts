import type { ReaderSettings } from "../domain/types";
import { toPlatformSettingsPayload, type SettingsDraft } from "./persistence";

type ChromeStorageBridge = {
  storage?: {
    local?: {
      set(payload: { novelChatSettings: ReaderSettings }): Promise<void>;
    };
  };
};

export async function savePlatformSettings(settings: SettingsDraft): Promise<void> {
  const payload = toPlatformSettingsPayload(settings);

  if (typeof window !== "undefined" && window.novelChatDesktop?.saveSettings) {
    await window.novelChatDesktop.saveSettings(payload);
    return;
  }

  const chromeBridge = globalThis.chrome as ChromeStorageBridge | undefined;
  if (!chromeBridge?.storage?.local) return;
  await chromeBridge.storage.local.set({ novelChatSettings: payload });
}
