import { describe, expect, it } from "vitest";
import { createLayoutStyleVars, skinLayoutTokens } from "../src/ui/skinLayoutTokens";

describe("skin layout tokens", () => {
  it("keeps each skin on explicit layout proportions", () => {
    expect(skinLayoutTokens.chatgpt.sidebarWidth).toBe(320);
    expect(skinLayoutTokens.chatgpt.topbarHeight).toBe(52);
    expect(skinLayoutTokens.chatgpt.messageWidth).toBe(720);
    expect(skinLayoutTokens.chatgpt.composerWidth).toBe(880);
    expect(skinLayoutTokens.chatgpt.assistantFontSize).toBe(16);
    expect(skinLayoutTokens.chatgpt.userFontSize).toBe(16);
    expect(skinLayoutTokens.chatgpt.navFontSize).toBe(15);
    expect(skinLayoutTokens.chatgpt.recentFontSize).toBe(15);
    expect(skinLayoutTokens.chatgpt.brandFontSize).toBe(20);
    expect(skinLayoutTokens.chatgpt.composerMinHeight).toBe(118);
    expect(skinLayoutTokens.gemini.sidebarWidth).toBe(292);
    expect(skinLayoutTokens.gemini.topbarHeight).toBe(56);
    expect(skinLayoutTokens.gemini.messageWidth).toBe(880);
    expect(skinLayoutTokens.gemini.composerWidth).toBe(660);
    expect(skinLayoutTokens.gemini.assistantFontSize).toBe(18);
    expect(skinLayoutTokens.gemini.userFontSize).toBe(17);
    expect(skinLayoutTokens.gemini.navFontSize).toBe(14);
    expect(skinLayoutTokens.deepseek.sidebarWidth).toBe(300);
    expect(skinLayoutTokens.deepseek.topbarHeight).toBe(56);
    expect(skinLayoutTokens.deepseek.messageWidth).toBe(760);
    expect(skinLayoutTokens.deepseek.composerWidth).toBe(880);
    expect(skinLayoutTokens.deepseek.assistantFontSize).toBe(17);
    expect(skinLayoutTokens.deepseek.userFontSize).toBe(17);
    expect(skinLayoutTokens.doubao.sidebarWidth).toBe(280);
    expect(skinLayoutTokens.doubao.topbarHeight).toBe(56);
    expect(skinLayoutTokens.doubao.messageWidth).toBe(760);
    expect(skinLayoutTokens.doubao.composerWidth).toBe(800);
    expect(skinLayoutTokens.doubao.assistantFontSize).toBe(17);
    expect(skinLayoutTokens.doubao.userFontSize).toBe(16);
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
      "--sidebar-width": "320px",
      "--message-width": "840px",
      "--font-scale": "1.1",
      "--assistant-font-size-scaled": "17.6px",
      "--user-font-size-scaled": "17.6px",
      "--nav-font-size": "15px",
      "--recent-font-size": "15px",
      "--brand-font-size": "20px",
      "--composer-min-height": "118px",
      "--density-gap": "24px",
    });
  });
});
