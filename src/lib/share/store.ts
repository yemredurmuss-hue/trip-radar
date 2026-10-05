// Where sharing keeps its small state: chrome.storage.local, so the board and the service worker both
// see it (and the board hears changes). Behind a tiny interface so tests can use a Map.
import { normalizeServerUrl } from "./code";
import type { Vote } from "./votes";

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export const chromeKV: KV = {
  async get<T>(key: string) {
    return (await chrome.storage.local.get(key))[key] as T | undefined;
  },
  set: (key, value) => chrome.storage.local.set({ [key]: value }),
  remove: (key) => chrome.storage.local.remove(key),
};

export function memoryKV(): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      const v = data.get(key);
      return (v === undefined ? undefined : structuredClone(v)) as T | undefined;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async remove(key) {
      data.delete(key);
    },
  };
}

// --- settings (Ayarlar → Paylaşım) --------------------------------------------------------------

export interface ShareConfig {
  /** Supabase project address. */
  url: string;
  /** Publishable (anon) key. */
  anonKey: string;
  /** "Adın": how the other traveller sees you ("Emre", "Sabine"). */
  name: string;
}

const CONFIG_KEYS = { url: "shareUrl", anonKey: "shareKey", name: "shareName" } as const;

export async function getShareConfig(kv: KV = chromeKV): Promise<ShareConfig> {
  const [url, anonKey, name] = await Promise.all([kv.get<string>(CONFIG_KEYS.url), kv.get<string>(CONFIG_KEYS.anonKey), kv.get<string>(CONFIG_KEYS.name)]);
  // The address as typed may have a slash or a path after it; the project's own address is used.
  return { url: normalizeServerUrl(url ?? "") ?? url ?? "", anonKey: anonKey ?? "", name: name ?? "" };
}

export async function saveShareConfig(patch: Partial<ShareConfig>, kv: KV = chromeKV): Promise<void> {
  for (const [field, key] of Object.entries(CONFIG_KEYS) as [keyof ShareConfig, string][]) {
    if (patch[field] !== undefined) await kv.set(key, patch[field]!.trim());
  }
}

/** Server and name are all set: sharing can be used. */
export const isConfigured = (c: ShareConfig) => Boolean(normalizeServerUrl(c.url) && c.anonKey && c.name);

// --- per shared trip ----------------------------------------------------------------------------

export interface SyncState {
  shareId: string;
  /** Last shared capture (server sequence) already brought here. */
  cursor: number;
  /** stableJson of the settings both sides last agreed on. */
  settingsBase: string | null;
  /** Server updated_at of those settings. */
  settingsAt: string | null;
  /** Everyone who opened the shared trip ("Emre", "Sabine"). */
  members: string[];
  /** Their profile photos by name (0.36), and when they were last fetched; the photo this computer last sent. */
  photos?: Record<string, string>;
  photosAt?: number | null;
  photoSent?: string | null;
  /** Last sync that went through (ms), and the last failure since, in Turkish. */
  lastSyncAt: number | null;
  error: string | null;
}

export const stateKey = (tripId: string) => `shareSync:${tripId}`;
export const votesKey = (shareId: string) => `shareVotes:${shareId}`;

export async function getSyncState(tripId: string, kv: KV = chromeKV): Promise<SyncState | undefined> {
  return kv.get<SyncState>(stateKey(tripId));
}

export async function setSyncState(tripId: string, state: SyncState, kv: KV = chromeKV): Promise<void> {
  await kv.set(stateKey(tripId), state);
}

export async function getVotes(shareId: string, kv: KV = chromeKV): Promise<Vote[]> {
  return (await kv.get<Vote[]>(votesKey(shareId))) ?? [];
}

export async function setVotes(shareId: string, votes: Vote[], kv: KV = chromeKV): Promise<void> {
  await kv.set(votesKey(shareId), votes);
}
