import { describe, expect, it } from "vitest";
import { chooseLocalServicePort, detectLocalServicePortStatus, LOCAL_SERVICE_PORT } from "../electron/localServicePorts";

describe("local service port selection", () => {
  it("uses the preferred fixed port when it is free", () => {
    expect(chooseLocalServicePort({ [LOCAL_SERVICE_PORT]: "free" })).toEqual({
      port: LOCAL_SERVICE_PORT,
      reuseExisting: false,
    });
  });

  it("reuses the fixed port when an existing NovelChat service is already there", () => {
    expect(chooseLocalServicePort({ [LOCAL_SERVICE_PORT]: "novel-chat" })).toEqual({
      port: LOCAL_SERVICE_PORT,
      reuseExisting: true,
    });
  });

  it("chooses the next free port when the fixed port belongs to another process", () => {
    expect(
      chooseLocalServicePort({
        [LOCAL_SERVICE_PORT]: "occupied",
        [LOCAL_SERVICE_PORT + 1]: "occupied",
        [LOCAL_SERVICE_PORT + 2]: "free",
      }),
    ).toEqual({ port: LOCAL_SERVICE_PORT + 2, reuseExisting: false });
  });

  it("detects an existing NovelChat service from /health", async () => {
    const status = await detectLocalServicePortStatus(17661, async (url) => {
      expect(url).toBe("http://127.0.0.1:17661/health");
      return new Response(JSON.stringify({ name: "novel-chat-reader", mode: "local-web" }), {
        headers: { "Content-Type": "application/json" },
      });
    });

    expect(status).toBe("novel-chat");
  });

  it("treats non-NovelChat /health responses as occupied", async () => {
    await expect(
      detectLocalServicePortStatus(17661, async () => new Response(JSON.stringify({ name: "other-service" }))),
    ).resolves.toBe("occupied");
  });

  it("treats refused health probes as free for service startup", async () => {
    await expect(
      detectLocalServicePortStatus(17661, async () => {
        throw new TypeError("fetch failed");
      }),
    ).resolves.toBe("free");
  });
});
