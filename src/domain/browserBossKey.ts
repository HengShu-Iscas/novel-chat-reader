import { bossKeyUrls } from "./bossKey";
import type { BossKeyTarget, SkinId } from "./types";

export type BrowserBossKeyInput = {
  target: BossKeyTarget;
  companionAvailable: boolean;
};

export type BrowserBossKeyAction =
  | { type: "companion"; target: SkinId; fallbackUrl: string }
  | { type: "navigate"; url: string };

export function createBrowserBossKeyAction(input: BrowserBossKeyInput): BrowserBossKeyAction {
  const target = normalizeBrowserBossKeyTarget(input.target);
  const url = bossKeyUrls[target];

  if (input.companionAvailable) {
    return { type: "companion", target, fallbackUrl: url };
  }

  return { type: "navigate", url };
}

function normalizeBrowserBossKeyTarget(target: BossKeyTarget): SkinId {
  return target === "random-open-tab" ? "chatgpt" : target;
}
