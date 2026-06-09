import { chromium } from "playwright";
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outputDir = path.join(root, "tmp");
const screenshotPath = path.join(outputDir, "novelchat-smoke.png");
const pickerImportPath = path.join(outputDir, "smoke-picker-import.txt");
const dragImportName = "smoke-drag-import.txt";

await mkdir(outputDir, { recursive: true });
await writeFile(pickerImportPath, "第一章 导入\n从文件选择导入。", "utf8");
const server = await createStaticServer(distDir);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(server.url);
await page.getByText("ChatGPT", { exact: false }).first().waitFor({ timeout: 10000 });
const fileChooserPromise = page.waitForEvent("filechooser");
await page.getByLabel("import novel").first().click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(pickerImportPath);
await page.getByRole("button", { name: "smoke-picker-import", exact: true }).waitFor();

const dataTransfer = await page.evaluateHandle(({ name }) => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(["第一章 拖入\n从拖拽导入。"], name, { type: "text/plain" }));
  return transfer;
}, { name: dragImportName });
await page.dispatchEvent(".app", "dragenter", { dataTransfer });
await page.locator(".drop-overlay").waitFor();
await page.dispatchEvent(".app", "drop", { dataTransfer });
await page.getByRole("button", { name: "smoke-drag-import", exact: true }).waitFor();

await page.getByRole("button", { name: "WCCI 2026 准备事项", exact: true }).click();
if ((await page.locator(".chapter-menu").count()) === 0) {
  await page.locator(".book-row-wrap").first().hover();
  await page.locator(".book-menu-button").first().click({ force: true });
}
await page.locator(".chapter-menu").waitFor();
await page.locator(".chapter-list button").nth(1).click();
await page.locator(".chapter-pill").getByLabel("next chapter").click();
await page.getByLabel("more").click();
await page.locator(".skin-switcher").getByRole("button", { name: "Gemini" }).click();
await page.getByLabel("more").click();
await page.locator(".skin-switcher").getByRole("button", { name: "deepseek" }).click();
await page.getByLabel("more").click();
await page.locator(".skin-switcher").getByRole("button", { name: "豆包" }).click();
await page.screenshot({ path: screenshotPath, fullPage: true });

await browser.close();
await server.close();
console.log(`Visual smoke passed. Screenshot: ${screenshotPath}`);

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
