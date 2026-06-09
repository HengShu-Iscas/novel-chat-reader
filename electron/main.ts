import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DesktopImportFile } from "../src/domain/desktopImport";
import { createDesktopBossKeyAction } from "../src/domain/desktopBossKey";
import { getSupportedNovelPaths } from "../src/domain/importSource";
import { defaultSettings } from "../src/domain/readerState";
import type { ReaderSettings } from "../src/domain/types";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let readerSettings: ReaderSettings = defaultSettings;
let pendingDesktopImports: DesktopImportFile[] = [];

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 720,
    title: "NovelChat Reader",
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  window.webContents.on("did-finish-load", flushPendingDesktopImports);

  return window;
}

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  if (tray) return;

  const iconPath = path.join(__dirname, "../dist/icons/icon-128.svg");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("NovelChat Reader");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open NovelChat", click: showMainWindow },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
}

async function triggerBossKey(): Promise<void> {
  const action = createDesktopBossKeyAction(readerSettings);
  if (action.hideWindow) {
    mainWindow?.hide();
  }
  await shell.openExternal(action.url);
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

function flushPendingDesktopImports(): void {
  if (!mainWindow || pendingDesktopImports.length === 0 || mainWindow.webContents.isLoading()) return;
  const files = pendingDesktopImports;
  pendingDesktopImports = [];
  mainWindow.webContents.send("novel-chat:open-files", files);
  showMainWindow();
}

async function openFilesFromPaths(paths: Iterable<string>): Promise<void> {
  const files = await readDesktopImportFiles(paths);
  if (files.length === 0) return;
  pendingDesktopImports.push(...files);
  flushPendingDesktopImports();
}

function registerBossKey(): void {
  const registered = globalShortcut.register("Alt+B", () => {
    void triggerBossKey();
  });

  if (!registered) {
    console.warn("Alt+B boss key could not be registered.");
  }
}

function wireIpc(): void {
  ipcMain.handle("novel-chat:save-settings", (_event, settings: ReaderSettings) => {
    readerSettings = { ...readerSettings, ...settings };
  });
  ipcMain.handle("novel-chat:boss-key", () => triggerBossKey());
  ipcMain.handle("novel-chat:open-files-dialog", async () => {
    const dialogOptions = {
      title: "Import TXT or EPUB",
      filters: [{ name: "Novels", extensions: ["txt", "epub"] }],
      properties: ["openFile", "multiSelections"],
    } satisfies Electron.OpenDialogOptions;
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled) return [];
    return readDesktopImportFiles(result.filePaths);
  });
}

app.setAppUserModelId("io.github.hengshu.iscas.novelchatreader");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    showMainWindow();
    void openFilesFromPaths(argv);
  });

  void app.whenReady().then(() => {
    wireIpc();
    mainWindow = createWindow();
    createTray();
    registerBossKey();
    void openFilesFromPaths(process.argv);
  });
}

app.on("activate", showMainWindow);

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
