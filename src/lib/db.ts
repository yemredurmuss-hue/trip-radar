// IndexedDB storage shared by the popup, the board page and the service worker (same extension origin).
import { L } from "./i18n";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Analysis, Capture, ChatMessage, Item, Listing, Preference, Settings, Trip } from "./types";

interface TripRadarDB extends DBSchema {
  trips: { key: string; value: Trip };
  captures: { key: string; value: Capture; indexes: { status: string } };
  items: { key: string; value: Item; indexes: { tripId: string; key: string } };
  messages: { key: string; value: ChatMessage; indexes: { tripId: string } };
  preferences: { key: string; value: Preference };
  analyses: { key: string; value: Analysis; indexes: { tripId: string } };
  geocache: { key: string; value: { query: string; lat: number | null; lng: number | null; at: number } };
  listings: { key: string; value: Listing };
}

let dbPromise: Promise<IDBPDatabase<TripRadarDB>> | null = null;

export function db(): Promise<IDBPDatabase<TripRadarDB>> {
  dbPromise ??= openDB<TripRadarDB>("trip-radar", 3, {
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
    },
  });
  return dbPromise;
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

export async function hasActiveKey(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s.provider === "gemini" ? s.geminiKey : s.apiKey);
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

/** Full JSON backup of everything except screenshots. */
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
      captures,
    },
    null,
    2,
  );
}
