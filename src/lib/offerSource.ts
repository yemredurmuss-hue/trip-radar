// Offers for an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2): "✨ Senin için N öneri ▾" under a
// need with nothing booked or saved yet, shown only while a real data source is connected. The source is an
// interface; today none is connected (NO_SOURCE.available() is false), so the row is never drawn.
//
// Offers come only from a data source (prices, ratings and photos it read), never made up by a model: whatever a
// source hands back is checked here (a page on https, a name, the source named, the kind asked for) and anything
// else is dropped. Kept apart from suggestions.ts: those say what the plan lacks and are cards of their own;
// these are priced options under one need. Pure, except the remembered open/closed state (localStorage, guarded).
import { L } from "./i18n";
import { plannedItem } from "./planned";
import type { Item, PlannedKind } from "./types";

export type OfferKind = "flight" | "stay" | "transfer" | "activity" | "esim";

/** What an empty card is waiting for, as a source would search it. Only place, dates and head-count. */
export interface Need {
  /** Stable per need on the trip ("stay:2026-12-10_2026-12-17:ubud"). */
  key: string;
  /** The Plan section it sits in: its open/closed state is remembered per section. */
  section: "flight" | "stay" | "transport" | "activity" | "other";
  kind: OfferKind;
  city?: string | null;
  from?: string | null;
  to?: string | null;
  start?: string | null;
  end?: string | null;
  adults?: number | null;
  /** ISO alpha-2, for an eSIM. */
  country?: string | null;
}

export interface Offer {
  id: string;
  kind: OfferKind;
  title: string;
  photo?: string | null;
  /** Out of 10 or 5, as the source gives it. */
  rating?: number | null;
  /** The total for the need (the nights, the people). */
  price?: number | null;
  currency?: string | null;
  nights?: number | null;
  /** The offer's own page. */
  url: string;
  /** One line why it fits, from the source's data ("BTS'ye 3 dk, €15 daha ucuz"). */
  why: string;
  /** Where it was read ("Booking"). */
  source: string;
  fetchedAt: number;
  // A flight's or transfer's row (ai-oneriler-turler-v3): who runs it, the hours, the ends' codes, how long, the stops.
  carrier?: string | null;
  depart?: string | null;
  arrive?: string | null;
  fromCode?: string | null;
  toCode?: string | null;
  durationMinutes?: number | null;
  stops?: number | null;
  /** A transfer's way ("tren + tramvay"), said under its line instead of "Direkt". */
  via?: string | null;
  // A stay's, an activity's, an eSIM's lines: the area ("Jordaan · Dam'a 10 dk"), one more line ("30 gün · 5G").
  area?: string | null;
  meta?: string | null;
}

export interface SuggestionSource {
  /** A source is connected (and allowed): the row may be drawn. */
  available(): boolean;
  offers(need: Need): Promise<Offer[]>;
  /** "Bunun gibileri gösterme": the source learns from the ×. */
  less?(offer: Offer, need: Need): void;
}

/** No source connected: no row anywhere. */
export const NO_SOURCE: SuggestionSource = { available: () => false, offers: async () => [] };

const https = (url: unknown): url is string => {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const clock = (v: unknown): string | null => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);

/**
 * The deal panel's price (ai-oneriler-turler-v3): a stay's is by the night ("€128 / gece", "7 gece · €896 toplam");
 * a flight's the total for who goes ("2 kişi toplam"); a transfer's and an activity's for them ("2 kişi"); an eSIM's
 * once ("tek seferlik"). Null without a price.
 */
export function dealPrice(offer: Pick<Offer, "kind" | "price" | "nights">, adults: number | null): { amount: number; perNight: boolean; unit: (total: string) => string } | null {
  if (offer.price == null) return null;
  const people = (n: number) => L(`${n} kişi`, n === 1 ? "1 person" : `${n} people`);
  switch (offer.kind) {
    case "stay": {
      const nights = offer.nights && offer.nights > 0 ? offer.nights : null;
      if (!nights) return { amount: offer.price, perNight: false, unit: () => L("toplam", "total") };
      return { amount: offer.price / nights, perNight: true, unit: (total) => L(`${nights} gece · ${total} toplam`, `${nights} night${nights === 1 ? "" : "s"} · ${total} total`) };
    }
    case "flight":
      return { amount: offer.price, perNight: false, unit: () => (adults ? L(`${people(adults)} toplam`, `${people(adults)} total`) : L("toplam", "total")) };
    case "esim":
      return { amount: offer.price, perNight: false, unit: () => L("tek seferlik", "one-off") };
    default:
      return { amount: offer.price, perNight: false, unit: () => (adults ? people(adults) : "") };
  }
}

/** At most three offers under a need (the mockup's rule): the source's order, well-formed ones only. */
export const MAX_OFFERS = 3;

/** What a source handed back, kept only when it's a real offer for this need: an https page, a name, its source. */
export function validOffers(list: unknown, need: Pick<Need, "kind">): Offer[] {
  if (!Array.isArray(list)) return [];
  const out: Offer[] = [];
  const seen = new Set<string>();
  for (const raw of list as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object" || raw.kind !== need.kind) continue;
    const id = text(raw.id, 200);
    const title = text(raw.title, 120);
    const source = text(raw.source, 60);
    if (!id || !title || !source || !https(raw.url) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: need.kind,
      title,
      photo: https(raw.photo) ? raw.photo : null,
      rating: num(raw.rating),
      price: num(raw.price),
      currency: text(raw.currency, 3)?.toUpperCase() ?? null,
      nights: num(raw.nights),
      url: raw.url as string,
      why: text(raw.why, 160) ?? "",
      source,
      fetchedAt: num(raw.fetchedAt) ?? 0,
      carrier: text(raw.carrier, 40),
      depart: clock(raw.depart),
      arrive: clock(raw.arrive),
      fromCode: text(raw.fromCode, 8),
      toCode: text(raw.toCode, 8),
      durationMinutes: num(raw.durationMinutes),
      stops: num(raw.stops),
      via: text(raw.via, 40),
      area: text(raw.area, 80),
      meta: text(raw.meta, 80),
    });
    if (out.length === MAX_OFFERS) break;
  }
  return out;
}

/** "✨ Senin için 2 öneri". */
export const offerCount = (n: number): string => L(`Senin için ${n} öneri`, n === 1 ? "1 offer for you" : `${n} offers for you`);

// --- open or closed, per section ------------------------------------------------------------------------

export const offersOpenKey = (tripId: string, section: Need["section"]) => `trip-radar:offers-open:${tripId}:${section}`;

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Closed unless the traveller opened it here before (no storage: closed). */
export function readOffersOpen(key: string, store: Store | null = local()): boolean {
  try {
    return store?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeOffersOpen(key: string, open: boolean, store: Store | null = local()): void {
  try {
    store?.setItem(key, open ? "1" : "0");
  } catch {
    // not remembered this time; the choice still holds on screen
  }
}

/** The row's state: new offers change the number only, never open it. */
export interface OfferRowState {
  open: boolean;
  offers: Offer[];
  /** Taken away with × ("bunun gibileri gösterme") or added: not shown again here. */
  gone: string[];
}

export const withOffers = (state: OfferRowState, offers: Offer[]): OfferRowState => ({ ...state, offers });
export const toggled = (state: OfferRowState): OfferRowState => ({ ...state, open: !state.open });
export const without = (state: OfferRowState, id: string): OfferRowState => ({ ...state, gone: state.gone.includes(id) ? state.gone : [...state.gone, id] });
export const shownOffers = (state: OfferRowState): Offer[] => state.offers.filter((o) => !state.gone.includes(o.id));

// --- "Seçeneklere ekle" ------------------------------------------------------------------------------------

const KIND_OF: Record<OfferKind, PlannedKind> = { flight: "flight", stay: "stay", transfer: "transfer", activity: "activity", esim: "esim" };

/** An offer added to the need's options: a saved option (not chosen), its page, photo, rating and price as read. */
export function offerItem(offer: Offer, need: Need, tripId: string, id: string, now: number): Item {
  // Not a plan said in the chat: no origin, no planned kind (it's an option read from a page).
  const { origin: _origin, plannedKind: _kind, ...base } = plannedItem(
    { kind: KIND_OF[offer.kind], date: need.start ?? null, end_date: need.end ?? null, time: null, from: need.from ?? null, to: need.to ?? null, city: need.city ?? null, title: offer.title, booked: false, note: null },
    tripId,
    id,
    now,
  );
  const scale = offer.rating == null ? null : offer.rating > 5 ? 10 : 5;
  return {
    ...base,
    status: "saved",
    statusNote: null,
    summary: offer.why,
    provider: offer.source,
    url: offer.url,
    imageUrl: offer.photo ?? null,
    countryCode: need.country ?? null,
    guests: { ...base.guests, adults: need.adults ?? null },
    rating: { value: offer.rating ?? null, scale, count: null, source: offer.rating == null ? "none" : "url" },
    price: { ...base.price, amount: offer.price ?? null, currency: offer.price == null ? null : (offer.currency ?? null), scope: offer.price == null ? "unknown" : "total", source: offer.price == null ? "none" : "url", observedAt: offer.fetchedAt || now },
  };
}
