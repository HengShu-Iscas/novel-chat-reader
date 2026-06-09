const TARGETS = {
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  deepseek: "https://chat.deepseek.com/",
  doubao: "https://www.doubao.com/chat/",
};

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "boss-key") return;
  const { novelChatSettings } = await chrome.storage.local.get("novelChatSettings");
  const target = novelChatSettings?.bossKeyTarget ?? novelChatSettings?.skin ?? "chatgpt";
  const targetUrl = TARGETS[target] ?? TARGETS.chatgpt;
  const targetHost = new URL(targetUrl).host;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => {
    if (!tab.url) return false;
    try {
      return new URL(tab.url).host === targetHost;
    } catch {
      return false;
    }
  });

  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (current?.id != null) {
    await chrome.tabs.update(current.id, { url: targetUrl });
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }
});
