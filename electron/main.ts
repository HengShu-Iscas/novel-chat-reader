import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import path from "node:path";
import { createDesktopBossKeyAction } from "../src/domain/desktopBossKey";
import { defaultSettings } from "../src/domain/readerState";
import type { ReaderSettings } from "../src/domain/types";

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let readerSettings: ReaderSettings = defaultSettings;

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
}

app.setAppUserModelId("io.github.hengshu.iscas.novelchatreader");

void app.whenReady().then(() => {
  wireIpc();
  mainWindow = createWindow();
  createTray();
  registerBossKey();
});

app.on("activate", showMainWindow);

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
