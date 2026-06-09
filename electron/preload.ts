import { contextBridge, ipcRenderer } from "electron";
import type { ReaderSettings } from "../src/domain/types";

contextBridge.exposeInMainWorld("novelChatDesktop", {
  platform: "electron",
  saveSettings: (settings: ReaderSettings) => ipcRenderer.invoke("novel-chat:save-settings", settings),
  triggerBossKey: () => ipcRenderer.invoke("novel-chat:boss-key"),
});
