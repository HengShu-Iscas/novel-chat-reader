import { chromium } from "playwright";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outputDir = path.join(root, "tmp");
const pickerImportPath = path.join(outputDir, "smoke-picker-import.txt");
const dragImportName = "smoke-drag-import.txt";

const viewports = [
  ["desktop", { width: 1920, height: 1080 }],
  ["laptop", { width: 1366, height: 768 }],
  ["compact", { width: 900, height: 700 }],
  ["mobile", { width: 390, height: 844 }],
];

await mkdir(outputDir, { recursive: true });
await writeFile(
  pickerImportPath,
  [
    "Chapter 1 Imported from picker",
    "The picker import should appear in the sidebar.",
    "",
    "Chapter 2 Continue",
    "The second chapter is used by the chapter switcher smoke test.",
  ].join("\n"),
  "utf8",
);

const server = await createStaticServer(distDir);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: viewports[0][1] });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

await page.goto(server.url);
await page.getByText("ChatGPT", { exact: false }).first().waitFor({ timeout: 10000 });
await page.locator(".empty-import-state").waitFor({ timeout: 10000 });

const fileChooserPromise = page.waitForEvent("filechooser");
await page.getByLabel("import novel").first().click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(pickerImportPath);
await page.getByRole("button", { name: "smoke-picker-import", exact: true }).waitFor();

const dataTransfer = await page.evaluateHandle(({ name }) => {
  const transfer = new DataTransfer();
  transfer.items.add(
    new File(
      [
        [
          "Chapter 1 Drag import",
          "The drag import should become a recent sidebar item.",
          "",
          "Chapter 2 Next drag chapter",
          "The composer arrow should switch to this chapter.",
        ].join("\n"),
      ],
      name,
      { type: "text/plain" },
    ),
  );
  return transfer;
}, { name: dragImportName });
await page.dispatchEvent(".app", "dragenter", { dataTransfer });
await page.locator(".drop-overlay").waitFor();
await page.dispatchEvent(".app", "drop", { dataTransfer });
await page.getByRole("button", { name: "smoke-drag-import", exact: true }).waitFor();

await page.getByRole("button", { name: "smoke-drag-import", exact: true }).click();
if ((await page.locator(".chapter-menu").count()) === 0) {
  await page.locator(".book-row-wrap").first().hover();
  await page.locator(".book-menu-button").first().click({ force: true });
}
await page.locator(".chapter-menu").waitFor();
await page.locator(".chapter-list button").first().click();
await page.locator(".chapter-pill").getByLabel("next chapter").click();

await switchSkin(page, "Gemini");
await switchSkin(page, "deepseek");
await switchSkinByIndex(page, 3);

for (const [name, viewport] of viewports) {
  await page.setViewportSize(viewport);
  await page.locator(".app").waitFor();
  await page.screenshot({ path: path.join(outputDir, `novelchat-smoke-${name}.png`), fullPage: true });
}
await page.screenshot({ path: path.join(outputDir, "novelchat-smoke.png"), fullPage: true });

await browser.close();
await server.close();

if (consoleErrors.length > 0) {
  throw new Error(`Visual smoke saw browser errors:\n${consoleErrors.join("\n")}`);
}

console.log(`Visual smoke passed. Screenshots: ${path.join(outputDir, "novelchat-smoke-*.png")}`);

async function switchSkin(page, label) {
  await page.getByLabel("more").click();
  await page.locator(".skin-switcher").getByRole("button", { name: label }).click();
}

async function switchSkinByIndex(page, index) {
  await page.getByLabel("more").click();
  await page.locator(".skin-switcher button").nth(index).click();
}

async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ channel: "chrome", headless: true }),
    () => chromium.launch({ channel: "msedge", headless: true }),
    () => chromium.launch({ headless: true }),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function createStaticServer(rootDir) {
  const server = http.createServer(async (request, response) => {
    const rawPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (rawPath === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const safePath = rawPath === "/" ? "/index.html" : rawPath;
    const filePath = path.join(rootDir, decodeURIComponent(safePath));
    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("not a file");
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
