import { contextBridge, ipcRenderer } from "electron";
import type { DesktopImportFile } from "../src/domain/desktopImport";
import type { ReaderSettings } from "../src/domain/types";

contextBridge.exposeInMainWorld("novelChatDesktop", {
  platform: "electron",
  openFiles: () => ipcRenderer.invoke("novel-chat:open-files-dialog") as Promise<DesktopImportFile[]>,
  onOpenFiles: (listener: (files: DesktopImportFile[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, files: DesktopImportFile[]) => listener(files);
    ipcRenderer.on("novel-chat:open-files", handler);
    return () => ipcRenderer.off("novel-chat:open-files", handler);
  },
  saveSettings: (settings: ReaderSettings) => ipcRenderer.invoke("novel-chat:save-settings", settings),
  triggerBossKey: () => ipcRenderer.invoke("novel-chat:boss-key"),
});
