// An interview left halfway is kept (spec item 5): "Bali · taslak · Devam et" on Seyahatlerim.
//
// Kept apart from the trips on purpose (chrome.storage.local, "startDrafts"), not as a draft trip in the
// database: a trip record would be a place for captures to land (trips.ts chooseTrip), would be counted,
// shared, searched by the chat and the share sync, and would need a migration. A draft here is read only by
// the home and the start screen; removing the key removes every draft and nothing else.
import { lang } from "./i18n";
import { chromeKV, type KV } from "./share/store";
import { knownStyles, noPrep, type Prepared, type StartRoute, type StartState } from "./startTrip";

const KEY = "startDrafts";
/** The newest few are kept. */
export const MAX_DRAFTS = 8;

const isDraft = (v: unknown): v is StartState =>
  !!v && typeof v === "object" && typeof (v as StartState).id === "string" && Array.isArray((v as StartState).messages) && typeof (v as StartState).mode === "string";

/** A stored draft as the screens can use it: styles only from the list, the lists always lists. */
const clean = (d: StartState): StartState => ({
  ...d,
  styles: knownStyles(d.styles),
  skipped: Array.isArray(d.skipped) ? d.skipped : [],
  who: d.who
    ? {
        kind: d.who.kind ?? null,
        names: Array.isArray(d.who.names) ? d.who.names.filter((n) => typeof n === "string") : [],
        // How many go (asked for a group): kept, or it would be asked again.
        ...(typeof d.who.count === "number" && d.who.count > 0 ? { count: d.who.count } : {}),
      }
    : null,
  // What the trip is for (2026-10-06): only in its shape.
  intent: d.intent && typeof d.intent.name === "string" && typeof d.intent.place === "string" ? d.intent : null,
  route: d.route && Array.isArray(d.route.stops) ? d.route : null,
  messages: d.messages.filter((m) => m && typeof m.text === "string" && (m.role === "user" || m.role === "assistant")),
  // Drafts from before revision 2: the board's language, nothing prepared.
  lang: d.lang === "tr" || d.lang === "en" ? d.lang : lang(),
  langFixed: d.langFixed === true,
  prepared: cleanPrepared(d.prepared),
  guess:
    d.guess && typeof d.guess.typed === "string" && typeof d.guess.place?.place === "string" && (d.guess.slot === "where" || d.guess.slot === "from") ? d.guess : null,
});

/** What was prepared, only in its shape (anything else is dropped and prepared again). */
function cleanPrepared(p: unknown): Prepared {
  const out = noPrep();
  if (!p || typeof p !== "object") return out;
  const v = p as Partial<Prepared>;
  if (v.photos && typeof v.photos.for === "string" && v.photos.urls && typeof v.photos.urls === "object") {
    const urls = Object.fromEntries(Object.entries(v.photos.urls).filter(([, u]) => u === null || (typeof u === "string" && /^https:\/\//.test(u))));
    out.photos = { for: v.photos.for, urls };
  }
  if (v.routes && typeof v.routes === "object")
    out.routes = Object.fromEntries(Object.entries(v.routes).filter(([, r]) => r === null || (!!r && typeof r === "object" && Array.isArray((r as StartRoute).stops))));
  if (v.rules && typeof v.rules.key === "string" && Array.isArray(v.rules.titles)) out.rules = { key: v.rules.key, titles: v.rules.titles.filter((t) => typeof t === "string") };
  return out;
}

async function read(kv: KV): Promise<StartState[]> {
  try {
    const rows = await kv.get<unknown[]>(KEY);
    return (Array.isArray(rows) ? rows.filter(isDraft).map(clean) : []).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

// Every change is a read-modify-write of one key: they run one after another (two screens saving at once can't
// lose either change).
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

export const listDrafts = (kv: KV = chromeKV): Promise<StartState[]> => serial(() => read(kv));

export async function getDraft(id: string, kv: KV = chromeKV): Promise<StartState | null> {
  return (await listDrafts(kv)).find((d) => d.id === id) ?? null;
}

/** Only an interview with something in it is worth keeping (a chip pressed and left is not). */
export const worthKeeping = (s: StartState) => Boolean(s.where || s.from || s.who || s.start || s.duration || s.styles.length || s.budget || s.tripId);

export function saveDraft(s: StartState, kv: KV = chromeKV): Promise<void> {
  return serial(async () => {
    const others = (await read(kv)).filter((d) => d.id !== s.id);
    const rows = worthKeeping(s) ? [s, ...others] : others;
    await kv.set(KEY, rows.slice(0, MAX_DRAFTS));
  });
}

export function removeDraft(id: string, kv: KV = chromeKV): Promise<StartState | null> {
  return serial(async () => {
    const all = await read(kv);
    const gone = all.find((d) => d.id === id) ?? null;
    if (gone) await kv.set(KEY, all.filter((d) => d.id !== id));
    return gone;
  });
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
