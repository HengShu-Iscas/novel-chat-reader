import { describe, expect, it } from "vitest";
import { createBrowserBossKeyAction } from "../src/domain/browserBossKey";

describe("browser boss key action", () => {
  it("asks the companion extension first when it is available", () => {
    expect(createBrowserBossKeyAction({ target: "gemini", companionAvailable: true })).toEqual({
      type: "companion",
      target: "gemini",
      fallbackUrl: "https://gemini.google.com/app",
    });
  });

  it("falls back to navigating the focused page when no companion is available", () => {
    expect(createBrowserBossKeyAction({ target: "deepseek", companionAvailable: false })).toEqual({
      type: "navigate",
      url: "https://chat.deepseek.com/",
    });
  });
});
