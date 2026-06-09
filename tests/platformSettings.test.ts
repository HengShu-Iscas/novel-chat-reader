import { describe, expect, it } from "vitest";
import { toPlatformSettingsPayload } from "../src/storage/persistence";

describe("platform settings payload", () => {
  it("omits session API keys before sending settings to platform bridges", () => {
    const payload = toPlatformSettingsPayload({
      skin: "doubao",
      bossKeyTarget: "doubao",
      apiPolishEnabled: true,
      minChunkChars: 240,
      maxChunkChars: 720,
      interruptionEvery: 3,
      sessionKeys: { doubao: "secret-key" },
    });

    expect(payload).toEqual({
      skin: "doubao",
      bossKeyTarget: "doubao",
      apiPolishEnabled: true,
      minChunkChars: 240,
      maxChunkChars: 720,
      interruptionEvery: 3,
    });
    expect("sessionKeys" in payload).toBe(false);
  });
});
