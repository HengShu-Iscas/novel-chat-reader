import { chromium } from "playwright";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outputDir = path.join(root, "tmp");
const pickerImportPath = path.join(outputDir, "smoke-picker-import.txt");
const dragImportName =
  "smoke-drag-import-这是一个非常非常长的本地文件名用于验证侧栏真实书名显示时不会把三点菜单挤出可点击区域.txt";

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
    "第1章 文件选择导入",
    "她低声说：“先别动！”风从窗缝里钻进来，灯影轻轻晃了一下。",
    "第二句话应该在自然标点后断开。不是随便从中间切开。",
    "",
    "第2章 继续",
    "他问：“现在继续吗？”她点点头，说：“继续。”",
    "这里用于验证输入栏里的章节名和上下章按钮。",
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
await captureEmptyStates(page);
await switchSkin(page, "chatgpt");

const fileChooserPromise = page.waitForEvent("filechooser");
await page.getByLabel("import novel").first().click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(pickerImportPath);
await waitForBookRows(page, 1);
await assertVisibleTextDoesNotLeak(page, ["smoke-picker-import"]);

const dataTransfer = await page.evaluateHandle(({ name }) => {
  const transfer = new DataTransfer();
  transfer.items.add(
    new File(
      [
        [
          "第1章 拖拽导入",
          "长宁郡主对众人说道：“先看这一段！”厅中一时安静。",
          "这一句应该完整地出现在同一条回复中，而不是被随机切成半句。",
          "窗外雨声渐密，檐下灯火被风吹得一晃，书页边缘也跟着轻轻翻动。",
          "",
          "第2章 下一节",
          "谢尽欢仔细打量面前的金枝玉叶，准备人前显圣。",
          "她笑道：“后面继续，不要总结。”",
          "院外忽然传来一阵急促脚步声，门边的侍女抬头望去，却只看见廊下晃动的影子。",
          "长宁郡主皱眉问：“你到底看出了什么？”谢尽欢没有立刻回答，只把掌心的符纸压在桌面。",
          "符纸边缘泛起淡金色的火光，像有细小的星屑在游走。众人屏住呼吸，连杯盏轻碰的声音都停了。",
          "他这才低声道：“现在可以翻到下一页了。”这句话后面还要继续生成一段，以便验证自然断句。",
          "如果这一章被滚动到底部，最后一段正文仍然应该完整露出，不会被输入栏或章节导航遮住。",
          "这段用于验证最后一段不会被输入栏遮挡，也用于让截图里出现更接近真实阅读的正文密度。",
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
await waitForBookRows(page, 2);
await assertVisibleTextDoesNotLeak(page, ["smoke-picker-import", "smoke-drag-import"]);
await assertSidebarDisguise(page, ["smoke-drag-import"]);
await assertSidebarMenusStayPinned(page);

await page.locator(".book-row").first().click();
if ((await page.locator(".chapter-menu").count()) === 0) {
  await page.locator(".book-row-wrap").first().hover();
  await page.locator(".book-menu-button").first().click({ force: true });
}
await page.locator(".chapter-menu").waitFor();
await assertSidebarMenuGeometry(page, "chapter-menu-open");
await assertMenuInsideViewport(page);
await page.screenshot({ path: path.join(outputDir, "novelchat-smoke-menu.png"), fullPage: true });
await page.locator(".chapter-list button").first().click();
if ((await page.locator(".chapter-pill").count()) !== 0) {
  throw new Error("Old floating chapter pill is still rendered");
}
if ((await page.locator(".composer-chapter-label").count()) !== 0) {
  throw new Error("Composer still renders the chapter label");
}
if ((await page.getByLabel("next chapter").count()) !== 0 || (await page.getByLabel("previous chapter").count()) !== 0) {
  throw new Error("Composer still renders chapter navigation buttons");
}
await page.getByText("继续：第1章", { exact: false }).waitFor();
await page.keyboard.press("ArrowRight");
await page.getByText("继续：第2章", { exact: false }).waitFor();
await page.keyboard.press("ArrowLeft");
await page.getByText("继续：第1章", { exact: false }).waitFor();
await page.locator(".composer-box textarea").fill("继续");
await page.getByLabel("send message").click();
await assertActiveChapter(page, "第2章");
await page.locator(".composer-box textarea").fill("左右键测试");
await page.keyboard.press("ArrowLeft");
await assertActiveChapter(page, "第2章");
await page.locator(".composer-box textarea").fill("");
await assertLastMessageNotCovered(page);
await page.locator(".message-stream").click({ position: { x: 10, y: 10 } });
await page.keyboard.press("ArrowLeft");
await assertActiveChapter(page, "第1章");
await assertMessageStreamAtTop(page);
await page.keyboard.press("ArrowRight");
await assertActiveChapter(page, "第2章");
await assertMessageStreamAtTop(page);

for (const skin of ["chatgpt", "gemini", "deepseek", "doubao"]) {
  await switchSkin(page, skin);
  await assertPageHealthy(page, skin);
  await captureChapterMenu(page, skin);
  for (const [name, viewport] of viewports) {
    await page.setViewportSize(viewport);
    await page.locator(".app").waitFor();
    await assertLastMessageNotCovered(page);
    await page.mouse.move(viewport.width - 30, 30);
    await page.screenshot({ path: path.join(outputDir, `novelchat-smoke-${skin}-${name}.png`), fullPage: true });
  }
}
await page.screenshot({ path: path.join(outputDir, "novelchat-smoke.png"), fullPage: true });

await page.setViewportSize(viewports[0][1]);
await page.waitForTimeout(160);
await page.reload();
await page.locator(".app.skin-doubao").waitFor();
await waitForBookRows(page, 2);
await assertVisibleTextDoesNotLeak(page, ["smoke-picker-import", "smoke-drag-import"]);
await assertActiveChapter(page, "第2章");

await browser.close();
await server.close();

if (consoleErrors.length > 0) {
  throw new Error(`Visual smoke saw browser errors:\n${consoleErrors.join("\n")}`);
}

console.log(`Visual smoke passed. Screenshots: ${path.join(outputDir, "novelchat-smoke-*.png")}`);

async function captureEmptyStates(page) {
  for (const skin of ["chatgpt", "gemini", "deepseek", "doubao"]) {
    await switchSkin(page, skin);
    await page.locator(`.app.skin-${skin} .empty-import-state`).waitFor();
    if (skin !== "chatgpt" && (await page.locator(".empty-import-state", { hasText: "上传文件" }).count()) > 0) {
      throw new Error(`${skin} empty state exposes the import wording`);
    }
    await page.screenshot({ path: path.join(outputDir, `novelchat-empty-${skin}.png`), fullPage: true });
  }
}

async function switchSkin(page, skin) {
  const labels = {
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    deepseek: "deepseek",
    doubao: "豆包",
  };
  if ((await page.locator(`.app.skin-${skin}`).count()) > 0) return;
  await page.setViewportSize(viewports[0][1]);
  await page.getByLabel("more").click();
  await page.locator(".skin-switcher").getByRole("button", { name: labels[skin] }).click();
  await page.locator(`.app.skin-${skin}`).waitFor();
}

async function captureChapterMenu(page, skin) {
  await page.setViewportSize(viewports[0][1]);
  await page.locator(".book-row-wrap").first().hover();
  await page.locator(".book-menu-button").first().click({ force: true });
  await page.locator(".chapter-menu").waitFor();
  await assertMenuInsideViewport(page);
  await page.screenshot({ path: path.join(outputDir, `novelchat-smoke-${skin}-menu.png`), fullPage: true });
  await page.keyboard.press("Escape");
}

async function assertPageHealthy(page, skin) {
  await page.locator(`.app.skin-${skin}`).waitFor();
  await page.locator(".message-stream").waitFor();
  if ((await page.locator("vite-error-overlay").count()) !== 0) {
    throw new Error(`Vite error overlay is visible in ${skin}`);
  }
  const appBox = await page.locator(".app").boundingBox();
  if (!appBox || appBox.width < 300 || appBox.height < 300) {
    throw new Error(`App did not render a meaningful surface for ${skin}`);
  }
}

async function waitForBookRows(page, count) {
  await page.waitForFunction((expectedCount) => document.querySelectorAll(".book-row").length >= expectedCount, count);
}

async function assertActiveChapter(page, title) {
  await page.locator(".user-bubble").filter({ hasText: `继续：${title}` }).first().waitFor();
}

async function assertVisibleTextDoesNotLeak(page, forbiddenTexts) {
  const visibleText = await page.locator(".app").evaluate((element) => element.innerText);
  const leaked = forbiddenTexts.find((text) => visibleText.includes(text));
  if (leaked) {
    throw new Error(`Default visible page text leaks a real file name: ${leaked}`);
  }
}

async function assertSidebarDisguise(page, forbiddenTexts = []) {
  const firstBook = page.locator(".book-row").first();
  const disguise = firstBook.locator(".book-title-disguise");
  const real = firstBook.locator(".book-title-real");
  const defaultDisguiseDisplay = await disguise.evaluate((element) => getComputedStyle(element).display);
  const defaultRealDisplay = await real.evaluate((element) => getComputedStyle(element).display);
  const disguiseText = (await disguise.textContent())?.trim();

  if (defaultDisguiseDisplay === "none" || defaultRealDisplay !== "none") {
    throw new Error("Sidebar does not hide real book titles by default");
  }
  if (!disguiseText || forbiddenTexts.some((text) => disguiseText.includes(text))) {
    throw new Error(`Sidebar disguise topic was not generated: ${disguiseText ?? ""}`);
  }

  await page.locator(".sidebar").hover();
  const hoveredRealDisplay = await real.evaluate((element) => getComputedStyle(element).display);
  const hoveredDisguiseDisplay = await disguise.evaluate((element) => getComputedStyle(element).display);
  if (hoveredRealDisplay === "none" || hoveredDisguiseDisplay !== "none") {
    throw new Error("Sidebar hover does not reveal real book titles");
  }
}

async function assertSidebarMenusStayPinned(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".book-title-disguise").forEach((element) => {
      element.textContent = "短题";
    });
  });
  const viewport = page.viewportSize();
  await page.mouse.move((viewport?.width ?? 1200) - 24, 24);
  await assertSidebarMenuGeometry(page, "default");
  await page.locator(".sidebar").hover();
  await assertSidebarMenuGeometry(page, "hover");
  await page.locator(".book-row").first().click();
  await assertSidebarMenuGeometry(page, "selected");
}

async function assertSidebarMenuGeometry(page, phase) {
  const result = await page.evaluate((phaseName) => {
    const sidebar = document.querySelector(".sidebar");
    if (!(sidebar instanceof HTMLElement)) return { ok: false, reason: "missing sidebar" };

    const hasHorizontalOverflow = sidebar.scrollWidth > sidebar.clientWidth + 1;
    if (hasHorizontalOverflow) {
      return {
        ok: false,
        reason: `sidebar has horizontal overflow: ${sidebar.scrollWidth} > ${sidebar.clientWidth}`,
      };
    }
    if (sidebar.scrollLeft !== 0) {
      return { ok: false, reason: `sidebar has horizontal scroll offset: ${sidebar.scrollLeft}` };
    }

    const sidebarBox = sidebar.getBoundingClientRect();
    const rows = Array.from(document.querySelectorAll(".book-row-wrap"));
    for (const row of rows) {
      const menuButton = row.querySelector(".book-menu-button");
      const realTitle = row.querySelector(".book-title-real");
      const disguiseTitle = row.querySelector(".book-title-disguise");
      if (
        !(row instanceof HTMLElement) ||
        !(menuButton instanceof HTMLElement) ||
        !(realTitle instanceof HTMLElement) ||
        !(disguiseTitle instanceof HTMLElement)
      ) {
        return { ok: false, reason: "missing row menu or title" };
      }

      const rowBox = row.getBoundingClientRect();
      const menuBox = menuButton.getBoundingClientRect();
      const visibleTitle = getComputedStyle(realTitle).display === "none" ? disguiseTitle : realTitle;
      const titleBox = visibleTitle.getBoundingClientRect();
      if (rowBox.right > sidebarBox.right + 1 || rowBox.left < sidebarBox.left - 1) {
        return { ok: false, reason: `row is outside the sidebar during ${phaseName}` };
      }
      if (menuBox.right > sidebarBox.right - 2 || menuBox.left < sidebarBox.left) {
        return { ok: false, reason: `row menu button is outside the sidebar during ${phaseName}` };
      }
      if (titleBox.right > menuBox.left + 2) {
        return { ok: false, reason: `visible title overlaps the row menu button during ${phaseName}` };
      }
    }

    return { ok: true, reason: "" };
  }, phase);

  if (!result.ok) {
    throw new Error(`Sidebar long-title menu layout failed: ${result.reason}`);
  }
}

async function assertMenuInsideViewport(page) {
  const box = await page.locator(".chapter-menu").boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) {
    throw new Error("Chapter menu box or viewport was not available");
  }
  if (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) {
    throw new Error(`Chapter menu is clipped: ${JSON.stringify({ box, viewport })}`);
  }
  const zIndex = await page.locator(".chapter-menu").evaluate((element) => Number(getComputedStyle(element).zIndex));
  if (zIndex < 2000) {
    throw new Error(`Chapter menu z-index is too low: ${zIndex}`);
  }
}

async function assertLastMessageNotCovered(page) {
  await page.locator(".message-stream").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(80);
  const clear = await page.evaluate(() => {
    const composer = document.querySelector(".composer-box")?.getBoundingClientRect();
    const messages = Array.from(document.querySelectorAll(".message"));
    const last = messages.at(-1)?.getBoundingClientRect();
    if (!composer || !last) return false;
    return last.bottom <= composer.top - 6;
  });
  if (!clear) {
    throw new Error("Last message is covered by the composer");
  }
}

async function assertMessageStreamAtTop(page) {
  await page.waitForTimeout(80);
  const scrollTop = await page.locator(".message-stream").evaluate((element) => element.scrollTop);
  if (scrollTop > 2) {
    throw new Error(`Message stream did not return to top after chapter switch: ${scrollTop}`);
  }
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
    if (!isPathInsideDirectory(filePath, rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("not a file");
      streamFile(response, filePath);
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

function streamFile(response, filePath) {
  const stream = createReadStream(filePath);
  stream.once("open", () => {
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    stream.pipe(response);
  });
  stream.once("error", () => {
    if (!response.headersSent) {
      response.writeHead(404);
    }
    response.end("Not found");
  });
}

function isPathInsideDirectory(filePath, directoryPath) {
  const relativePath = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
