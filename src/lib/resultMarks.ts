// ✓ hatırlanır (tek Kaydet v3): the prints of results saved with their "+", per page, in chrome.storage.local (small:
// no screenshots, no texts). A print stands while its save does: taken back ("Geri al") or its card deleted from the
// Pano, it is gone without anyone keeping this list in step (each is checked against the save when asked for).
import { db } from "./db";
import { resultPage, sameResult, type ResultPrint } from "./resultMark";

const KEY = "resultMarks";
const PAGES = 300;
const DAYS = 45;

interface Mark {
  p: ResultPrint;
  captureId: string;
  at: number;
}
type Marks = Record<string, Mark[]>;

export interface SavedMark {
  p: ResultPrint;
  captureId: string;
  tripId: string | null;
}

async function load(): Promise<Marks> {
  try {
    const got = (await chrome.storage.local.get(KEY))[KEY];
    return got && typeof got === "object" ? (got as Marks) : {};
  } catch {
    return {};
  }
}

/** Its save still stands (the capture, and the card it made): with the trip it is in now. */
async function standing(m: Mark): Promise<SavedMark | null> {
  const d = await db();
  const capture = await d.get("captures", m.captureId);
  if (!capture) return null;
  const item = capture.itemId ? await d.get("items", capture.itemId) : undefined;
  if (capture.itemId && !item) return null;
  return { p: m.p, captureId: m.captureId, tripId: item?.tripId ?? capture.forTripId ?? null };
}

/** The results saved on this page that still stand. */
export async function marksOn(url: string): Promise<SavedMark[]> {
  const page = resultPage(url);
  if (!page) return [];
  const all = await load();
  const here = all[page] ?? [];
  const kept = (await Promise.all(here.map(standing))).filter((x): x is SavedMark => x !== null);
  if (kept.length !== here.length) {
    const ids = new Set(kept.map((k) => k.captureId));
    const left = here.filter((m) => ids.has(m.captureId));
    if (left.length) all[page] = left;
    else delete all[page];
    await chrome.storage.local.set({ [KEY]: all }).catch(() => undefined);
  }
  return kept;
}

/**
 * Already saved here? The standing save of the same result, unless it is in another trip than the one this save is for
 * (the same hotel kept for two trips is two saves).
 */
export async function savedAlready(url: string, p: ResultPrint, tripId: string | null): Promise<SavedMark | null> {
  for (const m of await marksOn(url)) if (sameResult(m.p, p) && (!tripId || !m.tripId || m.tripId === tripId)) return m;
  return null;
}

/** A save's print kept for its page; the oldest pages and those older than 45 days go. */
export async function markSaved(url: string, p: ResultPrint, captureId: string, now = Date.now()): Promise<void> {
  const page = resultPage(url);
  if (!page) return;
  const all = await load();
  all[page] = [...(all[page] ?? []).filter((m) => m.captureId !== captureId), { p, captureId, at: now }].slice(-60);
  const fresh = Object.entries(all)
    .map(([k, v]) => [k, v.filter((m) => now - m.at < DAYS * 86_400_000)] as const)
    .filter(([, v]) => v.length)
    .sort((a, b) => Math.max(...b[1].map((m) => m.at)) - Math.max(...a[1].map((m) => m.at)))
    .slice(0, PAGES);
  await chrome.storage.local.set({ [KEY]: Object.fromEntries(fresh) }).catch(() => undefined);
}
