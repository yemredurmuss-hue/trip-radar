// Service worker: runs the capture queue and the decision analyses so they continue after the popup closes.
import { checkPricesDaily, listenPriceNotices } from "./lib/priceWatchWorker";
import { candidateClosed, candidateOf, showBadge } from "./lib/candidateTabs";
import { companionAnswer, syncCompanion } from "./lib/companionWorker";
import { listenContextMenu, setupContextMenu } from "./lib/contextSave";
import { popupAnswer } from "./lib/popupWorker";
import { analyzeStale, isAnalyzing } from "./lib/analysis";
import { loadLang, setLang } from "./lib/i18n";
import {
  isProcessing,
  processPending,
  recoverStuck,
  rehomeFromDemoTrips,
  retryConnectionFailures,
  retryTransientFailures,
  reverifyFacts,
} from "./lib/process";
import { isReading, readingsDue, readPending } from "./lib/reader";
import { syncAll } from "./lib/share/sync";
import { updateWaiting } from "./lib/update";

let recovery: Promise<void> | null = null;

// Texts the worker writes (events, errors, sync status) follow the board's language. Listeners must be
// registered synchronously below, so the work itself waits for this.
const langReady = loadLang().catch(() => undefined);
chrome.storage.onChanged.addListener((changes, area) => {
  const next: unknown = area === "local" ? changes.lang?.newValue : undefined;
  if (next === "tr" || next === "en") setLang(next);
});

/** Extension API calls reset the worker's idle timer while a model call is in flight. */
async function keepingAlive(work: () => Promise<void>): Promise<void> {
  const keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  try {
    await langReady;
    await work();
  } finally {
    clearInterval(keepAlive);
  }
}

function run(): Promise<void> {
  return keepingAlive(async () => {
    // Once per worker lifetime, before anything is processed.
    // Failed (the database held by an older version during an update): tried again on the next run.
    recovery ??= recoverStuck()
      .then(() => rehomeFromDemoTrips())
      .then(() => reverifyFacts())
      .catch((error: unknown) => {
        recovery = null;
        throw error;
      });
    await recovery;
    await processPending();
    // A shared trip's new captures go up (and the other traveller's come down) without waiting a minute.
    void syncShared();
    // Then read each new page closely (reviews, description, rules) before judging the options.
    await readPending();
    // New options and new findings change the comparisons: refresh the AI review of affected groups.
    await analyzeStale();
  });
}

/** Shared trips: settings, captures and votes both ways; what arrived goes through the pipeline. */
function syncShared(): Promise<void> {
  return keepingAlive(async () => {
    const received = await syncAll().catch(() => 0);
    if (received) void run();
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
  if (message?.type === "share-sync") {
    void syncShared();
    sendResponse({ ok: true });
  }
  if (message?.type === "apply-update") {
    sendResponse({ ok: true });
    // The board closes with the reload; say where to bring it back (see onInstalled).
    void chrome.storage.local.set({ reopenBoard: message.reopen ?? null }).then(() => chrome.runtime.reload());
  }
});

// Benle gezen eklenti (seviye 1, lib/candidateTabs.ts): a candidate's tab keeps its "2/3" as it loads; closed, it is
// forgotten, and if it was bought there the plan asks "Aldın mı?". Only the tabs we opened; no page is read.
chrome.tabs.onRemoved.addListener((tabId) => void candidateClosed(tabId));
// Benle gezen eklenti (seviye 2, lib/companionWorker.ts): the content script only on the sites allowed, and its questions.
chrome.permissions.onAdded.addListener(() => void syncCompanion());
chrome.permissions.onRemoved.addListener(() => void syncCompanion());
// Simgeye basınca (lib/popupWorker.ts): the popup only asks; the page is read and saved here.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const answer = popupAnswer(message, sender, () => void run());
  if (!answer) return undefined;
  void answer.then(sendResponse, () => sendResponse(null));
  return true;
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const answer = companionAnswer(message, sender, () => void run());
  if (!answer) return undefined;
  void answer.then(sendResponse, () => sendResponse(null));
  return true;
});
// Sağ tık "Trip Radar'a ekle" (lib/contextSave.ts): the page or the link saved as the toolbar saves it.
listenContextMenu(() => void run());
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete") return;
  void candidateOf(tabId).then((c) => c && showBadge(c));
});

chrome.runtime.onStartup.addListener(() => (void run(), void syncCompanion(), void langReady.then(setupContextMenu)));
chrome.runtime.onInstalled.addListener((details) => {
  // First install: the board, one tab (P10, F01): its first card's step 1 opens the free Gemini key's setup.
  if (details.reason === "install") void chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
  // Updated from the board: bring the board back where it was.
  if (details.reason === "update") void reopenBoard();
  void syncCompanion();
  void langReady.then(setupContextMenu);
  void run();
});

async function reopenBoard(): Promise<void> {
  const { reopenBoard: hash } = await chrome.storage.local.get("reopenBoard");
  if (typeof hash !== "string") return;
  await chrome.storage.local.remove("reopenBoard");
  const base = chrome.runtime.getURL("app.html");
  const open = await chrome.tabs.query({ url: `${base}*` });
  if (open.length) for (const tab of open) void chrome.tabs.reload(tab.id!);
  else await chrome.tabs.create({ url: `${base}${hash}` });
}

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

// The Mac updater checks every minute; notice its new files as quickly.
chrome.alarms.create("update-check", { periodInMinutes: 1 });
// A busy model ("high demand") or a rate limit shouldn't need a click: try again later.
chrome.alarms.create("retry-failed", { periodInMinutes: 10 });
// Shared trips: the other traveller's captures and votes arrive within a minute.
chrome.alarms.create("share-sync", { periodInMinutes: 1 });
// Fiyat izleme (lib/priceWatch.ts): what's on the plan and not bought, asked again once a day; a drop said in a notification.
chrome.alarms.create("price-watch", { delayInMinutes: 2, periodInMinutes: 6 * 60 });
listenPriceNotices();
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "price-watch") void checkPricesDaily().catch(() => undefined);
  if (alarm.name === "update-check") void applyUpdateIfIdle();
  if (alarm.name === "share-sync") void syncShared();
  if (alarm.name === "retry-failed") {
    // Only when something is actually waiting: re-queued captures, or readings whose retry time has come.
    // (A failed analysis is retried when the board asks, so a spent quota isn't hammered in the background.)
    void Promise.all([retryTransientFailures(), readingsDue()]).then(([requeued, due]) => {
      if ((requeued || due) && !isProcessing() && !isReading()) void run();
    });
  }
});
// The connection is back: what failed for want of it goes again at once (the 10-minute alarm is the fallback).
self.addEventListener("online", () => {
  void retryConnectionFailures().then((requeued) => {
    if (requeued && !isProcessing() && !isReading()) void run();
  });
});
void applyUpdateIfIdle();
