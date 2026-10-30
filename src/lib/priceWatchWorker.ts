// Fiyat izleme, the service worker's side (lib/priceWatch.ts): once a day what's on the plan and not bought yet is asked of
// the offers source again; the same flight or hotel found cheaper is written on its record and said in a notification
// (pressed: the trip's plan). And from "Sitede benle gel": the chosen flight seen cheaper on the site the traveller has open.
import { openBoard } from "./browser";
import { clearPriceBadge, showPriceBadge } from "./priceBadge";
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import { formatPrice } from "./items";
import { liveSource } from "./offerSources";
import type { Need, Offer } from "./offerSource";
import { candidateOffer } from "./stayPicks";
import { offerPrice, priceDrop, sameOffer, WATCH_MAX, watchable, watchNeed, withPrice } from "./priceWatch";
import type { Item, Trip } from "./types";

const LAST = "priceWatchAt";
const DAY_MS = 864e5;
const todayIso = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * A drop said once: a Chrome notification that opens the trip's plan, and the icon's badge ("−40", 0.41.0) until the plan
 * is opened, for a notification missed; the popup says it again ("Fiyatı düştü") with the plan a press away.
 */
function tell(trip: Pick<Trip, "id" | "title">, title: string, message: string, save: number): void {
  try {
    chrome.notifications?.create(`price:${trip.id}:${Date.now()}`, { type: "basic", iconUrl: "icons/icon-128.png", title, message, priority: 1 });
  } catch {
    // (no notifications: the trip's history still says it)
  }
  void showPriceBadge({ tripId: trip.id, title, said: message, save });
}

/** Pressed, a price notification opens its trip's plan. */
export function listenPriceNotices(): void {
  chrome.notifications?.onClicked.addListener((id) => {
    const m = id.match(/^price:([^:]+):/);
    if (m) void openBoard(`#trip=${encodeURIComponent(m[1])}`).then(() => clearPriceBadge());
    chrome.notifications.clear(id);
  });
}

/** Once a day at most (the alarm comes oftener; a browser closed for days asks once when it opens). */
export async function checkPricesDaily(now = Date.now()): Promise<void> {
  const got = await chrome.storage.local.get(LAST);
  if (typeof got[LAST] === "number" && now - got[LAST] < DAY_MS * 0.9) return;
  await chrome.storage.local.set({ [LAST]: now });
  await checkPrices(liveSource, now);
}

/** Asks the source for each record on the plan not bought yet (the nearest first); the drops said. How many dropped. */
/** What a watch asks: a flight's live look (the shared flight search: Kiwi finds, Google Flights checks), a stay's hotels priced for its nights. */
type WatchSource = Pick<typeof liveSource, "available" | "offers" | "find" | "candidates">;
async function asked(source: WatchSource, need: Need): Promise<Offer[]> {
  if (need.kind === "flight") {
    const live = await source.find(need, { live: true }).catch(() => [] as Offer[]);
    return live.length ? live : await source.offers(need).catch(() => [] as Offer[]);
  }
  const [offers, cands] = await Promise.all([source.offers(need).catch(() => [] as Offer[]), source.candidates(need).catch(() => [])]);
  return [...offers, ...(Array.isArray(cands) ? cands.filter((c) => c.total != null).map((c) => candidateOffer(c, "best", "")) : [])];
}

export async function checkPrices(source: WatchSource, now = Date.now()): Promise<number> {
  if (!source.available()) return 0;
  const d = await db();
  const [items, trips] = await Promise.all([d.getAll("items"), d.getAll("trips")]);
  const today = todayIso(now);
  const when = (i: Item) => i.flight?.departure ?? i.dates.start ?? "";
  const list = items.filter((i) => watchable(i, today)).sort((a, b) => when(a).localeCompare(when(b))).slice(0, WATCH_MAX);
  let drops = 0;
  for (const item of list) {
    const trip = trips.find((t) => t.id === item.tripId);
    if (!trip) continue;
    const need = watchNeed(item, trip.travellers?.count ?? item.guests.adults ?? null);
    if (!need) continue;
    const offers = await asked(source, need);
    const match = offers.find((o) => sameOffer(item, o));
    if (!match) continue;
    const price = offerPrice(match, need, item, now);
    if (price.amount == null || price.amount === item.price.amount) continue;
    const fresh = await d.get("items", item.id);
    if (!fresh || fresh.status !== "chosen" || fresh.price.amount !== item.price.amount) continue;
    // (the same kind of price only: a total for a total; one the traveller wrote stays theirs)
    if (fresh.price.source === "user" || fresh.price.scope !== price.scope || fresh.price.currency !== price.currency) continue;
    await d.put("items", withPrice(fresh, price));
    const drop = priceDrop(fresh.price, price);
    if (!drop) continue;
    drops++;
    const said = L(`${item.name}: fiyat ${formatPrice(drop.was, drop.currency)} → ${formatPrice(drop.now, drop.currency)} (${formatPrice(drop.save, drop.currency)} düştü)`, `${item.name}: price ${formatPrice(drop.was, drop.currency)} → ${formatPrice(drop.now, drop.currency)} (${formatPrice(drop.save, drop.currency)} less)`);
    await addEvent(trip.id, said);
    tell(trip, L(`${trip.title}: fiyat düştü`, `${trip.title}: a price dropped`), said, drop.save);
  }
  if (list.length) notifyChanged();
  return drops;
}
