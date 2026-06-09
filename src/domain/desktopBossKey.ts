import { bossKeyUrls } from "./bossKey";
import type { BossKeyTarget, ReaderSettings, SkinId } from "./types";

export type DesktopBossKeySettings = Partial<Pick<ReaderSettings, "bossKeyTarget" | "skin">>;

export type DesktopBossKeyAction = {
  hideWindow: true;
  url: string;
};

function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && Object.hasOwn(bossKeyUrls, value);
}

export function resolveDesktopBossKeyUrl(target: BossKeyTarget | SkinId | string | undefined): string {
  if (target === "random-open-tab" || !isSkinId(target)) {
    return bossKeyUrls.chatgpt;
  }

  return bossKeyUrls[target];
}

export function createDesktopBossKeyAction(settings: DesktopBossKeySettings | null | undefined): DesktopBossKeyAction {
  return {
    hideWindow: true,
    url: resolveDesktopBossKeyUrl(settings?.bossKeyTarget ?? settings?.skin),
  };
}
