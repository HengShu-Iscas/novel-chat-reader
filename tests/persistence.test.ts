import { describe, expect, it } from "vitest";
import { toPersistedSettings } from "../src/storage/persistence";

describe("toPersistedSettings", () => {
  it("persists extension settings without API secrets", () => {
    const settings = toPersistedSettings({
      skin: "deepseek",
      bossKeyTarget: "deepseek",
      apiPolishEnabled: true,
      minChunkChars: 180,
      maxChunkChars: 350,
      interruptionEvery: 2,
      display: {
        fontScale: 1.05,
        messageWidth: 820,
        density: "comfortable",
        sidebarMode: "full",
        composerPosition: "bottom",
      },
      sessionKeys: { deepseek: "secret" },
    });

    expect(settings).toEqual({
      skin: "deepseek",
      bossKeyTarget: "deepseek",
      apiPolishEnabled: true,
      minChunkChars: 180,
      maxChunkChars: 350,
      interruptionEvery: 2,
      display: {
        fontScale: 1.05,
        messageWidth: 820,
        density: "comfortable",
        sidebarMode: "full",
        composerPosition: "bottom",
      },
    });
    expect(JSON.stringify(settings)).not.toContain("secret");
  });
});
