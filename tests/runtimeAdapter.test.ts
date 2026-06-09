import { describe, expect, it } from "vitest";
import { detectRuntime } from "../src/runtime/runtimeAdapter";

describe("runtime adapter detection", () => {
  it("detects installed browser mode from the local service origin", () => {
    expect(detectRuntime({ origin: "http://127.0.0.1:17661", chromeAvailable: false })).toBe("local-web");
  });

  it("keeps extension mode when Chrome extension APIs are available", () => {
    expect(detectRuntime({ origin: "chrome-extension://abc", chromeAvailable: true })).toBe("extension");
  });

  it("uses static preview for ordinary dev server origins", () => {
    expect(detectRuntime({ origin: "http://127.0.0.1:5173", chromeAvailable: false })).toBe("static-preview");
  });
});
