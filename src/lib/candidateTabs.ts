// Benle gezen eklenti, seviye 1 (docs/superpowers/plans/2026-10-23-karar-masasi-gecis.md): a deck's candidates opened in
// one Chrome tab group named for the route ("Bangkok ✈ İstanbul"), each tab's toolbar icon saying which one it is ("2/3");
// the popup pressed on such a tab knows the candidate ("Buna karar ver", "Burada satın al"); a tab it was bought in, once
// closed, has the plan ask "Aldın mı?". Nothing on the sites is read or changed: the tabs are ours because we opened them
// (PRIVACY.md §4). The map lives in chrome.storage.session (gone with the browser).
import { L } from "./i18n";

export interface CandidateTab {
  tabId: number;
  tripId: string;
  intentKey: string;
  itemId: string;
  /** Its place among those opened, and how many ("2/3"). */
  n: number;
  of: number;
  name: string;
  price: string | null;
  /** The route as the group is named ("Bangkok ✈ İstanbul"). */
  route: string;
  /** "Burada satın al" pressed: closed, the plan asks "Aldın mı?". */
  buying?: boolean;
}

export interface CandidateLink {
  itemId: string;
  url: string;
  name: string;
  price: string | null;
}

/** "Aldın mı?" waiting for a record, set when its buying tab closes; the Plan asks and clears it. */
export interface AskBought {
  itemId: string;
  tripId: string;
  at: number;
}

const MAP = "tr:candidates";
export const ASK_BOUGHT = "tr:askBought";
/** At most this many candidates go in one group (the deck's best first). */
export const CANDIDATES_MAX = 3;

const session = (): chrome.storage.StorageArea | null => (typeof chrome !== "undefined" && chrome.storage?.session) || null;

export async function loadCandidates(): Promise<Record<string, CandidateTab>> {
  const area = session();
  if (!area) return {};
  const got = await area.get(MAP);
  return (got[MAP] as Record<string, CandidateTab> | undefined) ?? {};
}

async function saveCandidates(map: Record<string, CandidateTab>): Promise<void> {
  await session()?.set({ [MAP]: map });
}

export async function candidateOf(tabId: number | undefined): Promise<CandidateTab | null> {
  if (tabId == null) return null;
  return (await loadCandidates())[String(tabId)] ?? null;
}

/** Whether this browser can group tabs (the permission and the API are there). */
export const canGroupTabs = (): boolean => typeof chrome !== "undefined" && typeof chrome.tabs?.group === "function" && typeof chrome.tabGroups?.update === "function";

/** The toolbar icon's word on a candidate's tab: "2/3". */
export const badgeOf = (c: Pick<CandidateTab, "n" | "of">): string => `${c.n}/${c.of}`;

export async function showBadge(c: CandidateTab): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId: c.tabId, color: "#5b45e0" });
    await chrome.action.setBadgeText({ tabId: c.tabId, text: badgeOf(c) });
    await chrome.action.setTitle({ tabId: c.tabId, title: L(`Trip Radar · aday ${badgeOf(c)} · ${c.route}`, `Trip Radar · candidate ${badgeOf(c)} · ${c.route}`) });
  } catch {
    // (the tab went before its badge: nothing to say)
  }
}

/**
 * Opens the deck's best candidates (those with a page) in one tab group named for the route, the first one in front; each
 * tab remembered with its place, its badge set. Returns how many were opened.
 */
export async function openCandidates(at: { tripId: string; intentKey: string; route: string }, links: readonly CandidateLink[]): Promise<number> {
  const list = links.filter((l) => /^https?:\/\//i.test(l.url)).slice(0, CANDIDATES_MAX);
  if (!list.length || !canGroupTabs()) return 0;
  const tabs: chrome.tabs.Tab[] = [];
  for (const [i, l] of list.entries()) tabs.push(await chrome.tabs.create({ url: l.url, active: i === 0 }));
  const ids = tabs.map((t) => t.id).filter((id): id is number => id != null);
  if (!ids.length) return 0;
  const groupId: number = await chrome.tabs.group({ tabIds: ids as [number, ...number[]] });
  await chrome.tabGroups.update(groupId, { title: at.route, color: "purple", collapsed: false });
  const map = await loadCandidates();
  const made: CandidateTab[] = [];
  tabs.forEach((t, i) => {
    if (t.id == null) return;
    const c: CandidateTab = { tabId: t.id, tripId: at.tripId, intentKey: at.intentKey, itemId: list[i].itemId, n: i + 1, of: list.length, name: list[i].name, price: list[i].price, route: at.route };
    map[String(t.id)] = c;
    made.push(c);
  });
  await saveCandidates(map);
  for (const c of made) await showBadge(c);
  return made.length;
}

/** "Burada satın al": this tab is where it is bought; closed, the plan asks "Aldın mı?". */
export async function markBuying(tabId: number): Promise<void> {
  const map = await loadCandidates();
  const c = map[String(tabId)];
  if (!c) return;
  map[String(tabId)] = { ...c, buying: true };
  await saveCandidates(map);
}

/** A candidate's tab closed (background): forgotten; bought there, "Aldın mı?" is left for the plan. */
export async function candidateClosed(tabId: number): Promise<void> {
  const map = await loadCandidates();
  const c = map[String(tabId)];
  if (!c) return;
  delete map[String(tabId)];
  await saveCandidates(map);
  if (c.buying) await chrome.storage.local.set({ [ASK_BOUGHT]: { itemId: c.itemId, tripId: c.tripId, at: Date.now() } satisfies AskBought });
}
