import type { CSSProperties } from "react";
import type { DisplaySettings, SkinId } from "../domain/types";

export type SkinLayoutToken = {
  sidebarWidth: number;
  compactSidebarWidth: number;
  topbarHeight: number;
  messageWidth: number;
  composerWidth: number;
  contentInset: number;
  assistantFontSize: number;
  userFontSize: number;
  navFontSize: number;
  recentFontSize: number;
  brandFontSize: number;
  composerMinHeight: number;
  lineHeight: number;
};

export const skinLayoutTokens: Record<SkinId, SkinLayoutToken> = {
  chatgpt: {
    sidebarWidth: 320,
    compactSidebarWidth: 86,
    topbarHeight: 52,
    messageWidth: 720,
    composerWidth: 880,
    contentInset: 96,
    assistantFontSize: 16,
    userFontSize: 16,
    navFontSize: 15,
    recentFontSize: 15,
    brandFontSize: 20,
    composerMinHeight: 118,
    lineHeight: 1.72,
  },
  gemini: {
    sidebarWidth: 292,
    compactSidebarWidth: 56,
    topbarHeight: 56,
    messageWidth: 880,
    composerWidth: 660,
    contentInset: 128,
    assistantFontSize: 18,
    userFontSize: 17,
    navFontSize: 14,
    recentFontSize: 14,
    brandFontSize: 19,
    composerMinHeight: 76,
    lineHeight: 1.64,
  },
  deepseek: {
    sidebarWidth: 300,
    compactSidebarWidth: 64,
    topbarHeight: 56,
    messageWidth: 760,
    composerWidth: 880,
    contentInset: 94,
    assistantFontSize: 17,
    userFontSize: 17,
    navFontSize: 15,
    recentFontSize: 15,
    brandFontSize: 23,
    composerMinHeight: 118,
    lineHeight: 1.68,
  },
  doubao: {
    sidebarWidth: 280,
    compactSidebarWidth: 64,
    topbarHeight: 56,
    messageWidth: 760,
    composerWidth: 800,
    contentInset: 92,
    assistantFontSize: 17,
    userFontSize: 16,
    navFontSize: 15,
    recentFontSize: 15,
    brandFontSize: 18,
    composerMinHeight: 98,
    lineHeight: 1.66,
  },
};

const densityGaps: Record<DisplaySettings["density"], number> = {
  compact: 24,
  comfortable: 34,
  spacious: 46,
};

export function createLayoutStyleVars(skin: SkinId, display: DisplaySettings): CSSProperties {
  const tokens = skinLayoutTokens[skin];
  return {
    "--sidebar-width": `${display.sidebarMode === "compact" ? tokens.compactSidebarWidth : tokens.sidebarWidth}px`,
    "--full-sidebar-width": `${tokens.sidebarWidth}px`,
    "--compact-sidebar-width": `${tokens.compactSidebarWidth}px`,
    "--topbar-height": `${tokens.topbarHeight}px`,
    "--message-width": `${display.messageWidth || tokens.messageWidth}px`,
    "--composer-width": `${tokens.composerWidth}px`,
    "--content-inset": `${tokens.contentInset}px`,
    "--assistant-font-size": `${tokens.assistantFontSize}px`,
    "--assistant-font-size-scaled": `${tokens.assistantFontSize * display.fontScale}px`,
    "--user-font-size": `${tokens.userFontSize}px`,
    "--user-font-size-scaled": `${tokens.userFontSize * display.fontScale}px`,
    "--nav-font-size": `${tokens.navFontSize}px`,
    "--recent-font-size": `${tokens.recentFontSize}px`,
    "--brand-font-size": `${tokens.brandFontSize}px`,
    "--composer-min-height": `${tokens.composerMinHeight}px`,
    "--line-height": `${tokens.lineHeight}`,
    "--font-scale": `${display.fontScale}`,
    "--density-gap": `${densityGaps[display.density]}px`,
  } as CSSProperties;
}
