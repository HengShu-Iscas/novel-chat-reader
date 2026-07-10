import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDisplaySettings } from "../src/domain/types";
import { savePlatformSettings } from "../src/storage/platformBridge";

const settings = {
  skin: "gemini" as const,
  bossKeyTarget: "gemini" as const,
  apiPolishEnabled: false,
  minChunkChars: 200,
  maxChunkChars: 600,
  interruptionEvery: 4,
  sessionKeys: { gemini: "session-secret" },
};

const persistedSettings = {
  skin: "gemini",
  bossKeyTarget: "gemini",
  apiPolishEnabled: false,
  minChunkChars: 200,
  maxChunkChars: 600,
  interruptionEvery: 4,
  topicDisguiseTheme: "work",
  display: defaultDisplaySettings,
};

describe("savePlatformSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends sanitized settings to the Electron bridge when available", async () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", { novelChatDesktop: { platform: "electron", saveSettings } });

    await savePlatformSettings(settings);

    expect(saveSettings).toHaveBeenCalledWith(persistedSettings);
  });

  it("falls back to Chrome extension storage when no Electron bridge exists", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", { storage: { local: { set } } });

    await savePlatformSettings(settings);

    expect(set).toHaveBeenCalledWith({ novelChatSettings: persistedSettings });
  });
});
