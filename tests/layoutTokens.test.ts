import { describe, expect, it } from "vitest";
import { createLayoutStyleVars, skinLayoutTokens } from "../src/ui/skinLayoutTokens";

describe("skin layout tokens", () => {
  it("keeps each skin on explicit layout proportions", () => {
    expect(skinLayoutTokens.chatgpt.sidebarWidth).toBe(360);
    expect(skinLayoutTokens.gemini.sidebarWidth).toBe(320);
    expect(skinLayoutTokens.deepseek.messageWidth).toBe(780);
    expect(skinLayoutTokens.doubao.composerWidth).toBe(970);
  });

  it("turns display overrides into CSS variables", () => {
    expect(
      createLayoutStyleVars("chatgpt", {
        fontScale: 1.1,
        messageWidth: 840,
        density: "compact",
        sidebarMode: "full",
        composerPosition: "bottom",
      }),
    ).toMatchObject({
      "--sidebar-width": "360px",
      "--message-width": "840px",
      "--font-scale": "1.1",
      "--assistant-font-size-scaled": "20.900000000000002px",
      "--user-font-size-scaled": "19.8px",
      "--density-gap": "24px",
    });
  });
});
