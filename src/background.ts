// Service worker: runs the capture queue so processing continues after the popup closes.
import { processPending, recoverStuck } from "./lib/process";

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
});

chrome.runtime.onStartup.addListener(() => void run());
chrome.runtime.onInstalled.addListener(() => void run());
