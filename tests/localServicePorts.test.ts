import { describe, expect, it } from "vitest";
import { chooseLocalServicePort, LOCAL_SERVICE_PORT } from "../electron/localServicePorts";

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
});
