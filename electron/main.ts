import { app, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DesktopImportFile } from "../src/domain/desktopImport";
import { resolveDesktopBossKeyUrl } from "../src/domain/desktopBossKey";
import { getSupportedNovelPaths } from "../src/domain/importSource";
import type { ReaderSettings } from "../src/domain/types";
import { detectLocalServicePortStatus, LOCAL_SERVICE_PORT } from "./localServicePorts";
import { startLocalWebService, type LocalWebService } from "./localWebService";

let tray: Tray | null = null;
let service: LocalWebService | null = null;
let serviceUrl: string | null = null;
let isQuitting = false;

function getLogDir(): string {
  return path.join(app.getPath("userData"), "logs");
}

function getLogPath(): string {
  return path.join(getLogDir(), "novelchat.log");
}

async function appendRuntimeLog(kind: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.stack ?? error.message}` : String(error);
  const entry = [
    `[${new Date().toISOString()}] ${kind}`,
    message,
    "",
  ].join("\n");
  await mkdir(getLogDir(), { recursive: true });
  await appendFile(getLogPath(), entry, "utf8");
}

async function openLogLocation(): Promise<void> {
  await mkdir(getLogDir(), { recursive: true });
  await shell.openPath(getLogDir());
}

async function readDesktopImportFiles(paths: Iterable<string>): Promise<DesktopImportFile[]> {
  const filePaths = getSupportedNovelPaths(paths);
  return Promise.all(
    filePaths.map(async (filePath) => ({
      name: path.basename(filePath),
      bytes: new Uint8Array(await readFile(filePath)),
    })),
  );
}

async function openLocalWebPage(): Promise<void> {
  if (!serviceUrl) return;
  await shell.openExternal(`${serviceUrl}/`);
}

async function selectLibraryFolderWithDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "Select library folder",
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function sendPendingImports(imports: DesktopImportFile[]): Promise<void> {
  if (!serviceUrl || imports.length === 0) return;
  await fetch(`${serviceUrl}/api/imports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: imports.map((file) => ({ name: file.name, bytes: Array.from(file.bytes) })),
    }),
  });
}

async function importPathsAndOpen(paths: Iterable<string>): Promise<void> {
  const imports = await readDesktopImportFiles(paths);
  await sendPendingImports(imports);
  await openLocalWebPage();
}

async function triggerBossKey(): Promise<void> {
  const target = await getCurrentBossKeyTarget();
  await shell.openExternal(resolveDesktopBossKeyUrl(target));
}

async function saveSettingsToLocalService(settings: ReaderSettings): Promise<void> {
  if (!serviceUrl) return;
  await fetch(`${serviceUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

async function getCurrentBossKeyTarget(): Promise<ReaderSettings["bossKeyTarget"]> {
  if (!serviceUrl) return "chatgpt";
  try {
    const response = await fetch(`${serviceUrl}/api/settings`);
    const settings = (await response.json()) as ReaderSettings;
    return settings.bossKeyTarget ?? settings.skin ?? "chatgpt";
  } catch {
    return "chatgpt";
  }
}

function registerBossKey(): void {
  const registered = globalShortcut.register("Alt+B", () => {
    void triggerBossKey();
  });

  if (!registered) {
    console.warn("Alt+B boss key could not be registered.");
  }
}

function createTray(): void {
  if (tray) return;

  const iconPath = path.join(__dirname, "../dist/icons/icon-128.svg");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("NovelChat Reader");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open NovelChat", click: () => void openLocalWebPage() },
      { label: "Boss Key", click: () => void triggerBossKey() },
      { label: "Open Logs", click: () => void openLogLocation() },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => void openLocalWebPage());
}

async function startBrowserFirstRuntime(): Promise<void> {
  const staticDir = path.join(__dirname, "../dist");
  const userDataDir = app.getPath("userData");

  for (let offset = 0; offset < 20; offset += 1) {
    const port = LOCAL_SERVICE_PORT + offset;
    const status = await detectLocalServicePortStatus(port);
    if (status === "novel-chat") {
      serviceUrl = `http://127.0.0.1:${port}`;
      return;
    }
    if (status === "occupied") continue;

    try {
      service = await startLocalWebService({
        staticDir,
        userDataDir,
        preferredPort: port,
        openBrowser: false,
        selectLibraryFolder: selectLibraryFolderWithDialog,
      });
      serviceUrl = service.url;
      return;
    } catch (error) {
      if (!isAddressInUse(error)) throw error;
    }
  }

  throw new Error("Unable to start NovelChat local web service on an available port");
}

function isAddressInUse(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE";
}

app.setAppUserModelId("io.github.hengshu.iscas.novelchatreader");

process.on("uncaughtException", (error) => {
  void appendRuntimeLog("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  void appendRuntimeLog("unhandledRejection", reason);
});

ipcMain.handle("novel-chat:open-files-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Novel files", extensions: ["txt", "epub"] }],
  });
  return result.canceled ? [] : readDesktopImportFiles(result.filePaths);
});

ipcMain.handle("novel-chat:select-library-folder", () => selectLibraryFolderWithDialog());
ipcMain.handle("novel-chat:save-settings", (_event, settings: ReaderSettings) => saveSettingsToLocalService(settings));
ipcMain.handle("novel-chat:boss-key", () => triggerBossKey());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    void importPathsAndOpen(argv);
  });

  void app.whenReady()
    .then(async () => {
      await startBrowserFirstRuntime();
      createTray();
      registerBossKey();
      await importPathsAndOpen(process.argv);
      await openLocalWebPage();
    })
    .catch((error) => {
      void appendRuntimeLog("startup", error);
    });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("quit", () => {
  if (!isQuitting) return;
  void service?.close();
});
