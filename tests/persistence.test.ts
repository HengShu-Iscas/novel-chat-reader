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
      sessionKeys: { deepseek: "secret" },
    });

    expect(settings).toEqual({
      skin: "deepseek",
      bossKeyTarget: "deepseek",
      apiPolishEnabled: true,
      minChunkChars: 180,
      maxChunkChars: 350,
      interruptionEvery: 2,
    });
    expect(JSON.stringify(settings)).not.toContain("secret");
  });
});
