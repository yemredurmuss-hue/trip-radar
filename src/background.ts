// Service worker: runs the capture queue so processing continues after the popup closes.
import { isProcessing, processPending, recoverStuck } from "./lib/process";
import { updateWaiting } from "./lib/update";

let recovery: Promise<void> | null = null;

async function run(): Promise<void> {
  // Extension API calls reset the worker's idle timer while a model call is in flight.
  const keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  try {
    recovery ??= recoverStuck(); // once per worker lifetime, before anything is processed
    await recovery;
    await processPending();
  } finally {
    clearInterval(keepAlive);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "process") {
    void run();
    sendResponse({ ok: true });
  }
  if (message?.type === "apply-update") {
    sendResponse({ ok: true });
    chrome.runtime.reload();
  }
});

chrome.runtime.onStartup.addListener(() => void run());
chrome.runtime.onInstalled.addListener((details) => {
  // First install: open the one-step setup (free Gemini key) right away.
  if (details.reason === "install") void chrome.tabs.create({ url: chrome.runtime.getURL("app.html#settings") });
  void run();
});

// --- self-update -------------------------------------------------------------------------------
// New files on disk (written by the Mac updater) are applied by reloading. If the board is open,
// it shows a "new version" banner instead so nothing typed gets lost; a capture in progress waits.
async function applyUpdateIfIdle(): Promise<void> {
  if (!(await updateWaiting()) || isProcessing()) return;
  const openPages = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.TAB, chrome.runtime.ContextType.POPUP],
  });
  if (openPages.length === 0) chrome.runtime.reload();
}

chrome.alarms.create("update-check", { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-check") void applyUpdateIfIdle();
});
void applyUpdateIfIdle();
