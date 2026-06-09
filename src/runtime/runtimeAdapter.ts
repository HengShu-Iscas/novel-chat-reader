export type RuntimeMode = "extension" | "local-web" | "static-preview";

export type RuntimeDetectionInput = {
  origin: string;
  chromeAvailable: boolean;
};

export const LOCAL_WEB_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:176\d{2}$/;

export function detectRuntime(input: RuntimeDetectionInput): RuntimeMode {
  if (input.chromeAvailable) return "extension";
  if (LOCAL_WEB_ORIGIN_PATTERN.test(input.origin)) return "local-web";
  return "static-preview";
}

export function getCurrentRuntime(): RuntimeMode {
  const chromeAvailable = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  return detectRuntime({
    origin: typeof window === "undefined" ? "" : window.location.origin,
    chromeAvailable,
  });
}
