// Service worker: runs the capture queue and the decision analyses so they continue after the popup closes.
import { analyzeStale, isAnalyzing } from "./lib/analysis";
import {
  isProcessing,
  processPending,
  recoverStuck,
  rehomeFromDemoTrips,
  retryTransientFailures,
  reverifyFacts,
} from "./lib/process";
import { isReading, readingsDue, readPending } from "./lib/reader";
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
    // Then read each new page closely (reviews, description, rules) before judging the options.
    await readPending();
    // New options and new findings change the comparisons: refresh the AI review of affected groups.
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
  if (message?.type === "read") {
    void keepingAlive(async () => {
      await readPending({ force: Boolean(message.force) });
      await analyzeStale();
    });
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
  if (!(await updateWaiting()) || isProcessing() || isReading() || isAnalyzing()) return;
  const openPages = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.TAB, chrome.runtime.ContextType.POPUP],
  });
  if (openPages.length === 0) chrome.runtime.reload();
}

chrome.alarms.create("update-check", { periodInMinutes: 10 });
// A busy model ("high demand") or a rate limit shouldn't need a click: try again later.
chrome.alarms.create("retry-failed", { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-check") void applyUpdateIfIdle();
  if (alarm.name === "retry-failed") {
    // Only when something is actually waiting: re-queued captures, or readings whose retry time has come.
    // (A failed analysis is retried when the board asks, so a spent quota isn't hammered in the background.)
    void Promise.all([retryTransientFailures(), readingsDue()]).then(([requeued, due]) => {
      if ((requeued || due) && !isProcessing() && !isReading()) void run();
    });
  }
});
void applyUpdateIfIdle();
