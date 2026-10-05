// src/lib/cardView.ts
// What a plan card says, from the record: the ring (to decide / chosen / done), the colour of its ground,
// the bottom strip (where it stands or which option, and its one action), the date on its top line, the
// ••• menu, the two ends of a trip, a media card's lines, and a transfer as a card. Pure.
import { durationText, type CardFacts } from "./cardFacts";
import { L } from "./i18n";
import { count, nDays, nOptions, nReviews, nStops, num } from "./i18nText";
import { formatDateRange, isoDate, metricsOf, nightsBetween } from "./items";
import { clockOf, legItem, legTiming, MODE_LABELS, type Leg } from "./legs";
import { flightSearchUrl } from "./timeline";
import { isTrip } from "./travelKinds";
import { cardKindLabel, legTransportMode, RENTAL_MODES, TICKET_MODES, transportMode, type CardKind, type TransportMode } from "./cardKinds";
import type { Item } from "./types";

export type Ring = "open" | "half" | "done";
/** Nothing to book: once planned it's done (a taxi from the rank, a note, a to-do). */
const NO_BOOKING: readonly CardKind[] = ["taxi", "note", "todo"];

export function ringOf(item: Item, kind: CardKind): Ring {
  if (item.status === "booked") return "done";
  if (item.status === "chosen") return NO_BOOKING.includes(kind) ? "done" : "half";
  return "open";
}

/** The ground says what the ring says: sand until it's done, green once it is. */
export const groundOf = (ring: Ring): "sand" | "green" => (ring === "done" ? "green" : "sand");

export type FootAction = "choose" | "book" | "install" | "restore";
export type FootLeft =
  | { kind: "nav" }
  | { kind: "state"; tone: "wait" | "done" | "plain"; text: string; sub: string | null; alert: "red" | "amber" | null };
export interface FootView {
  left: FootLeft;
  action: { label: string; does: FootAction } | null;
}

const state = (tone: "wait" | "done" | "plain", text: string, sub: string | null = null): FootLeft => ({ kind: "state", tone, text, sub, alert: null });

type Words = { not: string; act: string; done: string };
const ticketWords = (): Words => ({ not: L("bilet alınmadı", "no ticket yet"), act: L("Bileti aldım", "I got the ticket"), done: L("Alındı", "Booked") });
const reserveWords = (): Words => ({ not: L("rezerve edilmedi", "not booked"), act: L("Rezerve ettim", "I booked it"), done: L("Rezerve", "Booked") });
function words(item: Item, kind: CardKind): Words {
  if ((TICKET_MODES as readonly string[]).includes(kind) || kind === "activity") return ticketWords();
  if (kind === "transport") return isTrip(item) ? ticketWords() : reserveWords();
  if (kind === "esim") return { not: L("satın alınmadı", "not bought"), act: L("Satın aldım", "I bought it"), done: L("Alındı", "Bought") };
  if (kind === "insurance") return { not: L("poliçe alınmadı", "no policy yet"), act: L("Poliçe aldım", "I got the policy"), done: L("Alındı", "Bought") };
  return reserveWords();
}

/** What a booking keeps on the card: the note said with it (a PNR, a meeting point), else until when it's free to cancel. */
function bookedSub(item: Item): string | null {
  if (item.statusNote) return item.statusNote;
  const until = isoDate(item.cancellation.freeUntil);
  return until ? L(`ücretsiz iptal: ${formatDateRange(until, null)}`, `free cancellation until ${formatDateRange(until, null)}`) : null;
}

/**
 * The bottom strip (spec's action table): an option shows the navigator (or "Karar bekliyor" alone) and
 * "Plana seç"; chosen, what's missing and the one action; done, a ✓ and what was kept. A deadline from
 * progress.dateAlert takes the small line.
 */
export function footOf(item: Item, kind: CardKind, opts: { options?: number; alert?: { tone: "red" | "amber"; text: string } | null } = {}): FootView {
  const w = words(item, kind);
  const alert = opts.alert ?? null;
  const withAlert = (left: FootLeft): FootLeft => (alert && left.kind === "state" ? { ...left, sub: alert.text, alert: alert.tone } : left);
  switch (item.status) {
    case "dismissed":
      return { left: state("plain", L("Elendi", "Ruled out")), action: { label: L("Geri al", "Undo"), does: "restore" } };
    case "saved":
      return {
        left: (opts.options ?? 1) > 1 ? { kind: "nav" } : withAlert(state("wait", L("Karar bekliyor", "To decide"))),
        action: { label: L("Plana seç", "Add to plan"), does: "choose" },
      };
    case "chosen": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), kind === "taxi" ? L("rezervasyon gerekmez", "no booking needed") : null)), action: null };
      const text = item.origin === "chat" ? L("Planlanıyor", "Planning") : L("Seçildi", "Chosen");
      return { left: withAlert(state("wait", text, w.not)), action: { label: w.act, does: "book" } };
    }
    case "booked": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), bookedSub(item))), action: null };
      if (kind === "esim" && !item.installedAt) {
        return { left: withAlert(state("wait", L("Alındı", "Bought"), L("kurulmadı", "not installed"))), action: { label: L("Kurdum", "Installed it"), does: "install" } };
      }
      if (kind === "esim") return { left: withAlert(state("done", L("Kuruldu", "Installed"), bookedSub(item))), action: null };
      return { left: withAlert(state("done", w.done, bookedSub(item))), action: null };
    }
  }
}

/** The top line's date: a day for a trip, a span for a rental, an eSIM or insurance, the hour too for an activity or a table. */
export function topDate(item: Item, kind: CardKind): string | null {
  const start = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  if (!start) return null;
  const end = isoDate(item.dates.end);
  const ranged = (RENTAL_MODES as readonly string[]).includes(kind) || kind === "esim" || kind === "insurance";
  if (ranged && end && end !== start) return formatDateRange(start, end);
  const time = kind === "activity" || kind === "food" ? clockOf(item.flight?.departure) : null;
  return time ? `${formatDateRange(start, null)} · ${time}` : formatDateRange(start, null);
}

export type MenuAction = "edit" | "dismiss" | "delete";
/** The ••• menu: change a plan made by hand or in the chat, rule out a saved option (it waits under Elenenler), delete. */
export function menuFor(item: Item): MenuAction[] {
  const out: MenuAction[] = [];
  if (item.origin === "chat") out.push("edit");
  if (item.status === "saved" && item.origin !== "chat") out.push("dismiss");
  out.push("delete");
  return out;
}

export interface End {
  city: string;
  sub: string | null;
  /** Shown bold after the sub line. */
  time: string | null;
}
export interface TransportFace {
  from: End | null;
  to: End | null;
  /** Under the drawing: duration and stops, or what's rented ("Otomatik"). */
  middle: string | null;
  rental: boolean;
}

const dayOf = (iso: string | null | undefined) => {
  const d = isoDate(iso?.slice(0, 10));
  return d ? formatDateRange(d, null) : null;
};

/** A trip as two ends (ulasim-v3): from and to with the day and the hour; a rental as where it's picked up and for how long. */
export function transportFace(item: Item, kind: TransportMode | "transport"): TransportFace {
  const m = metricsOf(item);
  if ((RENTAL_MODES as readonly string[]).includes(kind)) {
    const start = isoDate(item.dates.start);
    const end = isoDate(item.dates.end);
    const days = start && end ? nightsBetween(start, end) : 0;
    return {
      rental: true,
      from: item.city ? { city: item.city, sub: item.location.area ?? item.location.address ?? item.provider, time: dayOf(start) } : null,
      to: days > 0 ? { city: nDays(days), sub: end ? L(`iade ${dayOf(end)}`, `return ${dayOf(end)}`) : null, time: null } : null,
      middle: item.optionDetail,
    };
  }
  const f = item.flight;
  const stops = kind === "flight" && f?.stops != null ? (f.stops === 0 ? L("direkt", "direct") : nStops(f.stops)) : null;
  return {
    rental: false,
    from: f?.from ? { city: f.from, sub: dayOf(f.departure ?? item.dates.start), time: clockOf(f.departure) } : null,
    to: f?.to ? { city: f.to, sub: dayOf(f.arrival ?? f.departure ?? item.dates.start), time: clockOf(f.arrival) } : null,
    middle: [m.durationMinutes ? durationText(m.durationMinutes) : null, stops].filter(Boolean).join(" · ") || null,
  };
}

export interface MediaFace {
  title: string;
  /** The info line (place · **hour** · duration · people), joined with " · ". */
  info: { text: string; strong?: boolean }[];
  /** The source line: ★ rating, reviews, the shop, the site ↗. */
  meta: { text: string; kind: "star" | "plain" | "link"; href?: string }[];
  image: string | null;
  /** The dotted drawing shown in place of a photo (none when there's a photo). */
  silhouette: MediaDrawing | null;
  /** The kind's drawing, also the fallback when the photo fails to load (null: the kind's icon). */
  drawing: MediaDrawing | null;
}

export type MediaDrawing = "museum" | "ticket" | "esim" | "shield";

const MUSEUM = /müze|museum|museu|galeri|gallery|sergi|exhibition|saray|palace|kilise|church|katedral|cathedral/i;

/** An activity's drawing: the museum front for a museum, gallery, palace or church; a ticket for anything else. */
export const activityDrawing = (item: Pick<Item, "name" | "summary">): "museum" | "ticket" =>
  MUSEUM.test([item.name, item.summary].filter(Boolean).join(" ")) ? "museum" : "ticket";

const people = (n: number) => count(n, "kişi", "person", "people");

/** A media card's text (etkinlik-v4): title, info line, source line, and its picture (a photo or a dotted drawing). */
export function mediaFace(item: Item, kind: CardKind, source: CardFacts["source"]): MediaFace {
  const m = metricsOf(item);
  const info: MediaFace["info"] = [];
  const add = (text: string | null | undefined, strong = false) => {
    if (text) info.push(strong ? { text, strong } : { text });
  };
  let title = item.name;
  if (kind === "esim") {
    const data = m.unlimitedData ? L("Sınırsız", "Unlimited") : m.dataGb ? `${num(m.dataGb)} GB` : null;
    const where = item.country ?? item.city;
    if (data) title = where ? `${data} · ${where}` : data;
    add(m.validityDays ? nDays(m.validityDays) : null);
    if (item.status === "booked" && !item.installedAt) add(L("yola çıkmadan kur", "install before you leave"));
  } else if (kind === "insurance") {
    add(item.guests.adults ? people(item.guests.adults) : null);
    const [s, e] = [isoDate(item.dates.start), isoDate(item.dates.end)];
    add(s && e ? nDays(nightsBetween(s, e) + 1) : null);
  } else if (kind === "note" || kind === "todo" || kind === "other") {
    add(item.summary || item.statusNote);
  } else {
    add(item.location.area ?? item.location.address ?? item.city);
    add(clockOf(item.flight?.departure), true);
    add(m.durationMinutes ? durationText(m.durationMinutes) : null);
    add(item.guests.adults ? people(item.guests.adults) : null);
  }
  const meta: MediaFace["meta"] = [];
  const shop = kind === "esim" || kind === "insurance" ? item.provider : null;
  if (shop) meta.push({ text: shop, kind: "plain" });
  if (item.rating.value != null) meta.push({ text: `★ ${num(item.rating.value)}`, kind: "star" });
  if (item.rating.count) meta.push({ text: nReviews(item.rating.count), kind: "plain" });
  if (source?.url) meta.push({ text: `${shop ? (source.host ?? source.label) : source.label} ↗`, kind: "link", href: source.url });
  else if (source && source.label !== shop) meta.push({ text: source.label, kind: "plain" });
  const image = kind === "esim" || kind === "insurance" ? null : item.imageUrl;
  const drawing: MediaDrawing | null = kind === "esim" ? "esim" : kind === "insurance" ? "shield" : kind === "activity" ? activityDrawing(item) : null;
  return { title, info, meta, image, silhouette: image ? null : drawing, drawing };
}

export interface LegCardView {
  kind: TransportMode | "transport";
  /** The top line's name: the way of travel, or "Metro", "Yürüyüş", "Şehir değişimi", "Transfer". */
  label: string;
  ring: Ring;
  from: End;
  to: End;
  middle: string | null;
  foot: FootView;
  ariaLabel: string;
  /** A move by plane not booked yet: a flight search for the day. */
  searchUrl: string | null;
}

/** Ways between cities that need a ticket; everything else (taxi, transfer, metro, a city bus) is planned once said. */
const LEG_TICKETS = ["flight", "train", "bus", "ferry"];

/** A transfer (airport ↔ hotel, hotel change) or a change of city, as a transport card. */
export function legCardView(leg: Leg): LegCardView {
  const mode = leg.choice?.mode ?? leg.mode;
  const settled = legItem(leg);
  const kind = legTransportMode(mode) ?? (settled ? transportMode(settled) : null) ?? "transport";
  const move = leg.kind === "move";
  const label = kind !== "transport" ? cardKindLabel(kind) : mode ? MODE_LABELS[mode] : move ? L("Şehir değişimi", "City change") : L("Transfer", "Transfer");
  const ticketed = move && mode != null && LEG_TICKETS.includes(mode);
  const booked = leg.status === "booked" || Boolean(leg.choice?.booked);
  const planned = !booked && (mode != null || leg.status === "chosen" || leg.status === "planned");
  const from = move ? (leg.from.city ?? leg.from.label) : leg.from.label;
  const to = move ? (leg.to.city ?? leg.to.label) : leg.to.label;
  const date = move ? formatDateRange(leg.date, null) : null;
  let foot: FootView;
  if (booked) foot = { left: state("done", ticketed ? L("Alındı", "Booked") : L("Ayarlandı", "Arranged"), settled?.name ?? null), action: null };
  else if (planned && ticketed) foot = { left: state("wait", L("Planlanıyor", "Planning"), L("bilet alınmadı", "no ticket yet")), action: { label: L("Bileti aldım", "I got the ticket"), does: "book" } };
  else if (planned) foot = { left: state("done", L("Planlandı", "Planned"), settled?.name ?? L("rezervasyon gerekmez", "no booking needed")), action: null };
  else if (leg.status === "options") foot = { left: state("wait", nOptions(leg.options.length), L("birini seç", "pick one")), action: null };
  else foot = { left: state("plain", L("Planlanmadı", "Not planned"), move ? L("nasıl geçeceksiniz?", "how will you get there?") : L("nasıl gideceksin?", "how will you go?")), action: null };
  return {
    kind,
    label,
    ring: booked ? "done" : planned ? (ticketed ? "half" : "done") : "open",
    from: { city: from, sub: date, time: null },
    to: { city: to, sub: date, time: null },
    middle: legTiming(leg),
    foot,
    ariaLabel: `${from} → ${to}`,
    searchUrl: move && mode === "flight" && !booked ? flightSearchUrl("from", from, leg.date, to) : null,
  };
}
