// IndexedDB storage shared by the popup, the board page and the service worker (same extension origin).
import { L } from "./i18n";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Analysis, Capture, ChatMessage, DocRecord, Item, Listing, Preference, Settings, TrashData, TrashEntry, Trip } from "./types";

interface TripRadarDB extends DBSchema {
  trips: { key: string; value: Trip };
  captures: { key: string; value: Capture; indexes: { status: string } };
  items: { key: string; value: Item; indexes: { tripId: string; key: string } };
  messages: { key: string; value: ChatMessage; indexes: { tripId: string } };
  preferences: { key: string; value: Preference };
  analyses: { key: string; value: Analysis; indexes: { tripId: string } };
  geocache: { key: string; value: { query: string; lat: number | null; lng: number | null; at: number } };
  listings: { key: string; value: Listing };
  docs: { key: string; value: DocRecord; indexes: { itemId: string; tripId: string } };
  /** Deleted records, kept 30 days (0.37, trash.ts): a card with its files, a file, or a whole trip. Light rows… */
  trash: { key: string; value: TrashEntry; indexes: { tripId: string; deletedAt: number } };
  /** …and what each took with it, by the same id (read only to restore it). */
  trashData: { key: string; value: TrashData };
}

/** The database's version: 5 added the trash (0.37). */
export const DB_VERSION = 5;

type TripRadarDb = IDBPDatabase<TripRadarDB>;
let dbPromise: Promise<TripRadarDb> | null = null;

export function db(): Promise<TripRadarDb> {
  if (dbPromise) return dbPromise;
  let onBlocked: (error: Error) => void = () => undefined;
  const blocked = new Promise<never>((_, reject) => (onBlocked = reject));
  const opening = openDB<TripRadarDB>("trip-radar", DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore("trips", { keyPath: "id" });
        d.createObjectStore("captures", { keyPath: "id" }).createIndex("status", "status");
        const items = d.createObjectStore("items", { keyPath: "id" });
        items.createIndex("tripId", "tripId");
        items.createIndex("key", "key");
        d.createObjectStore("messages", { keyPath: "id" }).createIndex("tripId", "tripId");
        d.createObjectStore("preferences", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        d.createObjectStore("analyses", { keyPath: "key" }).createIndex("tripId", "tripId");
        d.createObjectStore("geocache", { keyPath: "query" });
      }
      if (oldVersion < 3) {
        d.createObjectStore("listings", { keyPath: "key" });
      }
      if (oldVersion < 4) {
        const docs = d.createObjectStore("docs", { keyPath: "id" });
        docs.createIndex("itemId", "itemId");
        docs.createIndex("tripId", "tripId");
      }
      if (oldVersion < 5) {
        const trash = d.createObjectStore("trash", { keyPath: "id" });
        trash.createIndex("tripId", "tripId");
        trash.createIndex("deletedAt", "deletedAt");
        d.createObjectStore("trashData", { keyPath: "id" });
      }
    },
    // An older version (before 0.31 it never lets go: a tab or the worker from before an update) holds
    // the database open: say so instead of waiting forever. The next call tries again.
    blocked() {
      onBlocked(
        new Error(
          L(
            "Trip Radar'ın eski bir sürümü hâlâ açık. Diğer Trip Radar sekmelerini kapatıp sayfayı yenile.",
            "An older version of Trip Radar is still open. Close the other Trip Radar tabs and reload this page.",
          ),
        ),
      );
    },
    // A newer version (an update) wants the database: this connection lets go right away (the one the
    // event came to, whatever dbPromise holds now); the next call opens it again.
    blocking(_current, _wanted, event) {
      (event.target as IDBDatabase).close();
      if (dbPromise === mine) dbPromise = null;
    },
  });
  const mine = Promise.race([opening, blocked]);
  dbPromise = mine;
  // Gave up (blocked) or failed: the next call starts over. Opened after giving up: not kept open.
  mine.catch(() => {
    if (dbPromise === mine) dbPromise = null;
  });
  opening.then(
    (open) => dbPromise !== mine && open.close(),
    () => undefined,
  );
  return mine;
}

export const newId = () => crypto.randomUUID();

let lastTime = 0;
/** Strictly increasing timestamp so rows created in the same millisecond keep their order. */
export const nextTime = () => (lastTime = Math.max(Date.now(), lastTime + 1));

// --- change notifications between extension pages -------------------------------------------

// BroadcastChannel reaches the other extension pages and the worker but never the sender itself,
// so listeners in this context are called directly as well.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("trip-radar") : null;
const localListeners = new Set<() => void>();
channel?.addEventListener("message", () => localListeners.forEach((l) => l()));

export function notifyChanged(): void {
  channel?.postMessage("changed");
  queueMicrotask(() => localListeners.forEach((l) => l()));
}

export function onChanged(listener: () => void): () => void {
  localListeners.add(listener);
  return () => localListeners.delete(listener);
}

// --- settings (chrome.storage so the service worker can read them too) ------------------------

export const DEFAULT_MODEL = "claude-opus-5";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

const text = (value: unknown, fallback = "") => (typeof value === "string" && value ? value : fallback);

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(["provider", "apiKey", "model", "geminiKey", "geminiModel"]);
  const apiKey = text(stored.apiKey);
  return {
    // Free Gemini is the default unless a Claude key was set up before a provider was chosen.
    provider: stored.provider === "anthropic" || (!stored.provider && apiKey) ? "anthropic" : "gemini",
    apiKey,
    model: text(stored.model, DEFAULT_MODEL),
    geminiKey: text(stored.geminiKey),
    geminiModel: text(stored.geminiModel, DEFAULT_GEMINI_MODEL),
  };
}

/** A way to the model: your own key, or (Gemini) the AI gate an invite gave you. */
export async function hasActiveKey(): Promise<boolean> {
  const s = await getSettings();
  if (s.provider === "anthropic") return Boolean(s.apiKey);
  if (s.geminiKey) return true;
  const { aiGate } = await import("./share/ai");
  return (await aiGate()) != null;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

// --- queries ---------------------------------------------------------------------------------

export async function listTrips(): Promise<Trip[]> {
  const trips = await (await db()).getAll("trips");
  return trips.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listItems(tripId: string): Promise<Item[]> {
  return (await db()).getAllFromIndex("items", "tripId", tripId);
}

export async function listMessages(tripId: string): Promise<ChatMessage[]> {
  const rows = await (await db()).getAllFromIndex("messages", "tripId", tripId);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPreferences(tripId: string): Promise<Preference[]> {
  const rows = await (await db()).getAll("preferences");
  return rows.filter((p) => p.tripId === null || p.tripId === tripId);
}

/** Pending, processing and failed captures (via the status index: done captures carry big screenshots). */
export async function listOpenCaptures(): Promise<Capture[]> {
  const d = await db();
  const rows = (
    await Promise.all(["pending", "processing", "error"].map((status) => d.getAllFromIndex("captures", "status", status)))
  ).flat();
  return rows.sort((a, b) => a.capturedAt - b.capturedAt);
}

export async function listAllItems(): Promise<Item[]> {
  return (await db()).getAll("items");
}

/** "✓ … kaydedildi" events newer than `since`, across all trips (for the "added to another trip" notice). */
export async function listArrivals(since: number): Promise<ChatMessage[]> {
  const rows = await (await db()).getAll("messages");
  return rows
    .filter((m) => m.role === "event" && m.createdAt > since && m.text.startsWith("✓"))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addEvent(tripId: string, text: string): Promise<void> {
  const message: ChatMessage = {
    id: newId(),
    tripId,
    role: "event",
    content: null,
    text,
    choices: [],
    createdAt: nextTime(),
  };
  await (await db()).put("messages", message);
}

export async function listAnalyses(tripId: string): Promise<Analysis[]> {
  return (await db()).getAllFromIndex("analyses", "tripId", tripId);
}

/** What was read about these places, by listing key (see reader.listingKeyOf). */
export async function listListings(keys: string[]): Promise<Map<string, Listing>> {
  const d = await db();
  const rows = await Promise.all([...new Set(keys)].map((k) => d.get("listings", k)));
  return new Map(rows.filter((l): l is Listing => Boolean(l)).map((l) => [l.key, l]));
}

/**
 * Everything needed to reproduce what the extension saw and concluded: pages, items, readings and
 * analyses. No settings (so no API keys), no chat, no screenshots.
 */
export async function exportDiagnostics(): Promise<string> {
  const d = await db();
  const captures = (await d.getAll("captures")).map((c) => ({ ...c, screenshot: c.screenshot ? L("(ekran görüntüsü çıkarıldı)", "(screenshot removed)") : null }));
  return JSON.stringify(
    {
      kind: "trip-radar-diagnostics",
      version: chrome.runtime?.getManifest?.().version ?? null,
      exportedAt: new Date().toISOString(),
      trips: await d.getAll("trips"),
      items: await d.getAll("items"),
      listings: await d.getAll("listings"),
      analyses: await d.getAll("analyses"),
      captures,
    },
    null,
    1,
  );
}

/** Full JSON backup of everything except screenshots and the contents of attached files (their names are listed). */
export async function exportAll(): Promise<string> {
  const d = await db();
  const captures = (await d.getAll("captures")).map((c) => ({ ...c, screenshot: null }));
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      trips: await d.getAll("trips"),
      items: await d.getAll("items"),
      preferences: await d.getAll("preferences"),
      messages: await d.getAll("messages"),
      listings: await d.getAll("listings"),
      docs: (await d.getAll("docs")).map(({ blob: _blob, ...meta }) => meta),
      captures,
      // Çöp kutusu (0.37): what is in it, with what it holds (files by name, no screenshots).
      trash: await Promise.all(
        (await d.getAll("trash")).map(async (entry) => ({ ...entry, payload: backupOf((await d.get("trashData", entry.id))?.payload) })),
      ),
    },
    null,
    2,
  );
}

/** A trash entry's contents for the backup: files without their contents, captures without screenshots. */
function backupOf(payload: TrashData["payload"] | undefined): unknown {
  if (!payload) return null;
  const noBlob = ({ blob: _blob, ...meta }: DocRecord) => meta;
  if (payload.kind === "doc") return { ...payload, doc: noBlob(payload.doc) };
  if (payload.kind === "item") return { ...payload, docs: payload.docs.map(noBlob) };
  return { ...payload, docs: payload.docs.map(noBlob), captures: payload.captures.map((c) => ({ ...c, screenshot: null })) };
}
