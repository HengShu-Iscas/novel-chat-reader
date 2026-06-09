import { describe, expect, it } from "vitest";
import { createFileFromDesktopImport } from "../src/domain/desktopImport";

describe("desktop import payload", () => {
  it("turns an Electron file payload into a browser File", async () => {
    const file = createFileFromDesktopImport({
      name: "desk.epub",
      bytes: new TextEncoder().encode("chapter bytes"),
    });

    expect(file.name).toBe("desk.epub");
    expect(file.type).toBe("application/epub+zip");
    expect(await file.text()).toBe("chapter bytes");
  });
});
