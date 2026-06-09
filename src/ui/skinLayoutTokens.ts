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
  lineHeight: number;
};

export const skinLayoutTokens: Record<SkinId, SkinLayoutToken> = {
  chatgpt: {
    sidebarWidth: 360,
    compactSidebarWidth: 86,
    topbarHeight: 58,
    messageWidth: 760,
    composerWidth: 900,
    contentInset: 96,
    assistantFontSize: 19,
    userFontSize: 18,
    lineHeight: 1.68,
  },
  gemini: {
    sidebarWidth: 320,
    compactSidebarWidth: 82,
    topbarHeight: 54,
    messageWidth: 900,
    composerWidth: 900,
    contentInset: 120,
    assistantFontSize: 21,
    userFontSize: 20,
    lineHeight: 1.62,
  },
  deepseek: {
    sidebarWidth: 320,
    compactSidebarWidth: 82,
    topbarHeight: 56,
    messageWidth: 780,
    composerWidth: 930,
    contentInset: 96,
    assistantFontSize: 20,
    userFontSize: 20,
    lineHeight: 1.65,
  },
  doubao: {
    sidebarWidth: 328,
    compactSidebarWidth: 88,
    topbarHeight: 58,
    messageWidth: 760,
    composerWidth: 970,
    contentInset: 92,
    assistantFontSize: 20,
    userFontSize: 19,
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
    "--line-height": `${tokens.lineHeight}`,
    "--font-scale": `${display.fontScale}`,
    "--density-gap": `${densityGaps[display.density]}px`,
  } as CSSProperties;
}
