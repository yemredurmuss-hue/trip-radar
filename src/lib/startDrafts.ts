// An interview left halfway is kept (spec item 5): "Bali · taslak · Devam et" on Seyahatlerim.
//
// Kept apart from the trips on purpose (chrome.storage.local, "startDrafts"), not as a draft trip in the
// database: a trip record would be a place for captures to land (trips.ts chooseTrip), would be counted,
// shared, searched by the chat and the share sync, and would need a migration. A draft here is read only by
// the home and the start screen; removing the key removes every draft and nothing else.
import { chromeKV, type KV } from "./share/store";
import type { StartState } from "./startTrip";

const KEY = "startDrafts";
/** The newest few are kept. */
export const MAX_DRAFTS = 8;

const isDraft = (v: unknown): v is StartState =>
  !!v && typeof v === "object" && typeof (v as StartState).id === "string" && Array.isArray((v as StartState).messages) && typeof (v as StartState).mode === "string";

export async function listDrafts(kv: KV = chromeKV): Promise<StartState[]> {
  try {
    const rows = await kv.get<unknown[]>(KEY);
    return (Array.isArray(rows) ? rows.filter(isDraft) : []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getDraft(id: string, kv: KV = chromeKV): Promise<StartState | null> {
  return (await listDrafts(kv)).find((d) => d.id === id) ?? null;
}

/** Only an interview with something in it is worth keeping (a chip pressed and left is not). */
export const worthKeeping = (s: StartState) => Boolean(s.where || s.from || s.who || s.start || s.duration || s.styles.length || s.budget || s.tripId);

export async function saveDraft(s: StartState, kv: KV = chromeKV): Promise<void> {
  const others = (await listDrafts(kv)).filter((d) => d.id !== s.id);
  const rows = worthKeeping(s) ? [s, ...others] : others;
  await kv.set(KEY, rows.slice(0, MAX_DRAFTS));
}

export async function removeDraft(id: string, kv: KV = chromeKV): Promise<StartState | null> {
  const all = await listDrafts(kv);
  const gone = all.find((d) => d.id === id) ?? null;
  if (gone) await kv.set(KEY, all.filter((d) => d.id !== id));
  return gone;
}

/** Calls back whenever the drafts change (another tab, the start screen). */
export function onDraftsChanged(listener: () => void): () => void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return () => undefined;
  const on = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && KEY in changes) listener();
  };
  chrome.storage.onChanged.addListener(on);
  return () => chrome.storage.onChanged.removeListener(on);
}
