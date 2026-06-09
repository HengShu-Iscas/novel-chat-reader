const TARGETS = {
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  deepseek: "https://chat.deepseek.com/",
  doubao: "https://www.doubao.com/chat/",
};

const LOCAL_SERVICE_START_PORT = 17661;
const LOCAL_SERVICE_MAX_ATTEMPTS = 20;

chrome.action.onClicked.addListener(async () => {
  const serviceUrl = await findLocalServiceUrl();
  if (serviceUrl) {
    await openOrFocusUrl(serviceUrl);
    return;
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "boss-key") return;

  const serviceUrl = await findLocalServiceUrl();
  const serviceSettings = serviceUrl ? await readLocalServiceSettings(serviceUrl) : null;
  const { novelChatSettings } = await chrome.storage.local.get("novelChatSettings");
  const settings = serviceSettings ?? novelChatSettings;
  const target = settings?.bossKeyTarget ?? settings?.skin ?? "chatgpt";
  const targetUrl = TARGETS[target] ?? TARGETS.chatgpt;

  await openOrFocusBossTarget(targetUrl);
});

async function findLocalServiceUrl() {
  for (let offset = 0; offset < LOCAL_SERVICE_MAX_ATTEMPTS; offset += 1) {
    const url = `http://127.0.0.1:${LOCAL_SERVICE_START_PORT + offset}`;
    try {
      const response = await fetch(`${url}/health`, { cache: "no-store" });
      if (!response.ok) continue;
      const body = await response.json();
      if (body?.name === "novel-chat-reader" && body?.mode === "local-web") {
        return url;
      }
    } catch {
      // Keep scanning nearby ports.
    }
  }

  return null;
}

async function readLocalServiceSettings(serviceUrl) {
  try {
    const response = await fetch(`${serviceUrl}/api/settings`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json();
    return body.settings ?? body ?? null;
  } catch {
    return null;
  }
}

async function openOrFocusUrl(url) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.startsWith(url));

  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: `${url}/` });
}

async function openOrFocusBossTarget(targetUrl) {
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
}
