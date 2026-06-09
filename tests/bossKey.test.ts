import { describe, expect, it } from "vitest";
import { chooseBossKeyAction } from "../src/domain/bossKey";

describe("chooseBossKeyAction", () => {
  it("activates an existing target tab before navigating the current tab", () => {
    expect(
      chooseBossKeyAction({
        target: "gemini",
        currentTabId: 3,
        tabs: [
          { id: 1, url: "https://example.com" },
          { id: 2, url: "https://gemini.google.com/app/abc" },
        ],
      }),
    ).toEqual({ type: "activate-existing", tabId: 2 });
  });

  it("navigates current tab when no target tab exists", () => {
    expect(
      chooseBossKeyAction({
        target: "deepseek",
        currentTabId: 3,
        tabs: [{ id: 1, url: "https://example.com" }],
      }),
    ).toEqual({ type: "navigate-current", tabId: 3, url: "https://chat.deepseek.com/" });
  });
});
