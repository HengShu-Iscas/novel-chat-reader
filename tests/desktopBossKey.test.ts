import { describe, expect, it } from "vitest";
import { createDesktopBossKeyAction, resolveDesktopBossKeyUrl } from "../src/domain/desktopBossKey";

describe("desktop boss key", () => {
  it("resolves each skin to its official chat entry", () => {
    expect(resolveDesktopBossKeyUrl("chatgpt")).toBe("https://chatgpt.com/");
    expect(resolveDesktopBossKeyUrl("gemini")).toBe("https://gemini.google.com/app");
    expect(resolveDesktopBossKeyUrl("deepseek")).toBe("https://chat.deepseek.com/");
    expect(resolveDesktopBossKeyUrl("doubao")).toBe("https://www.doubao.com/chat/");
  });

  it("falls back to ChatGPT for random or unknown targets", () => {
    expect(resolveDesktopBossKeyUrl("random-open-tab")).toBe("https://chatgpt.com/");
    expect(resolveDesktopBossKeyUrl("not-a-provider")).toBe("https://chatgpt.com/");
    expect(resolveDesktopBossKeyUrl(undefined)).toBe("https://chatgpt.com/");
  });

  it("creates the hide-and-open action from reader settings", () => {
    expect(createDesktopBossKeyAction({ bossKeyTarget: "deepseek", skin: "gemini" })).toEqual({
      hideWindow: true,
      url: "https://chat.deepseek.com/",
    });
  });
}
);
