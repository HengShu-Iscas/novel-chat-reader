import { describe, expect, it } from "vitest";
import { createSessionKeyStore } from "../src/domain/apiSession";

describe("session API key store", () => {
  it("keeps keys in memory and exports settings without secrets", () => {
    const store = createSessionKeyStore();

    store.setKey("openai", "sk-test");

    expect(store.getKey("openai")).toBe("sk-test");
    expect(store.exportPersistableSettings()).toEqual({ configuredProviders: ["openai"] });
  });
});
