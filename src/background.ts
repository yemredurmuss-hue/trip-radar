// Service worker: runs the capture queue and the decision analyses so they continue after the popup closes.
import { analyzeStale, isAnalyzing } from "./lib/analysis";
import { isProcessing, processPending, recoverStuck, rehomeFromDemoTrips, reverifyFacts } from "./lib/process";
import { updateWaiting } from "./lib/update";

let recovery: Promise<void> | null = null;

/** Extension API calls reset the worker's idle timer while a model call is in flight. */
async function keepingAlive(work: () => Promise<void>): Promise<void> {
  const keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  try {
    await work();
  } finally {
    clearInterval(keepAlive);
  }
}

function run(): Promise<void> {
  return keepingAlive(async () => {
    // Once per worker lifetime, before anything is processed.
    recovery ??= recoverStuck().then(() => rehomeFromDemoTrips()).then(() => reverifyFacts());
    await recovery;
    await processPending();
    // New options change the comparisons: refresh the AI review of affected groups.
    await analyzeStale();
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "process") {
    void run();
    sendResponse({ ok: true });
  }
  if (message?.type === "analyze") {
    void keepingAlive(() => analyzeStale({ force: Boolean(message.force) }));
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
  if (!(await updateWaiting()) || isProcessing() || isAnalyzing()) return;
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
