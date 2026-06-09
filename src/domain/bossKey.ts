import type { BossKeyTarget, SkinId } from "./types";

export const bossKeyUrls: Record<SkinId, string> = {
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  deepseek: "https://chat.deepseek.com/",
  doubao: "https://www.doubao.com/chat/",
};

export type BossKeyTab = {
  id: number;
  url?: string;
};

export type BossKeyInput = {
  target: BossKeyTarget;
  currentTabId: number;
  tabs: BossKeyTab[];
};

export type BossKeyAction =
  | { type: "activate-existing"; tabId: number }
  | { type: "navigate-current"; tabId: number; url: string };

export function chooseBossKeyAction(input: BossKeyInput): BossKeyAction {
  const target = input.target === "random-open-tab" ? "chatgpt" : input.target;
  const url = bossKeyUrls[target];
  const host = new URL(url).host;
  const existing = input.tabs.find((tab) => {
    if (!tab.url) return false;
    try {
      return new URL(tab.url).host === host;
    } catch {
      return false;
    }
  });

  if (existing?.id != null) {
    return { type: "activate-existing", tabId: existing.id };
  }

  return { type: "navigate-current", tabId: input.currentTabId, url };
}
