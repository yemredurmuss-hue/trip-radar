// A booking said in the chat for something already on the plan ("10 GB aldım", "arabayı kiraladım, Europcar",
// "Porto'daki oteli rezerve ettim"): the record on the plan is updated, never a second one made. Which record:
// the same trip, the same kind, the same place (an eSIM: its country) and the same day or none on either side;
// an eSIM and insurance are one per trip (per country), so the same kind is enough. A thing with a name of its
// own (a saved page, a tour said by name) is the same only by that name: "parti teknesi" when a boat tour was
// planned is another thing, taking its place (plan_item's replaces, plan.ts's "Yerine … geldi"). Pure.
import { cardKind, cardKindLabel, type CardKind } from "./cardKinds";
import { fold } from "./experiences";
import { L, lang } from "./i18n";
import { currencyCode, formatDateRange, isoDate, metricsOf } from "./items";
import { cityKeyOf, departureDay, sameCity, stayRange } from "./plan";
import { isGeneratedName, plannedItem, type PlannedInput } from "./planned";
import { countryCodeOfName, knownPlaceOf, regionName } from "./startTrip";
import { countryCodesOf } from "./heroInfo";
import { fromPage, saidEdits, withEdits, withoutEdits } from "./userEdits";
import type { Item } from "./types";

/** What came with the booking besides the plan: the shop, and what it cost. */
export interface BookingExtras {
  provider: string | null;
  price: number | null;
  currency: string | null;
}

/** Kinds that are bought or booked (never an idea, a chore or a note). */
const BOOKABLE: readonly CardKind[] = ["flight", "train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike", "transport", "stay", "activity", "esim", "insurance"];
/** One per trip (an eSIM per country): the same kind is the same thing, whatever its name or day. */
const ONE_PER_TRIP: readonly CardKind[] = ["esim", "insurance"];
const TRAVEL: readonly CardKind[] = ["flight", "train", "bus", "minibus", "ferry"];
const RANGED: readonly CardKind[] = ["stay", "car", "moto", "rv", "bike"];

/** A name the code made from the kind ("Konaklama · Porto", "eSIM (Portekiz)", "Travel health insurance"), not one of its own. */
export const isKindName = (name: string): boolean =>
  isGeneratedName(name) || /^e-?sim\b/i.test(name.trim()) || /^(seyahat (sağlık )?sigortası|travel (health )?insurance|sigorta|insurance)$/i.test(name.trim());

/** "10 GB", "5GB", "sınırsız/unlimited" and "30 gün/days" in what was said about an eSIM. */
export function esimPackage(text: string): { dataGb: number | null; unlimited: boolean; days: number | null } {
  const gb = text.match(/(\d+(?:[.,]\d+)?)\s*gb\b/i);
  const days = text.match(/(\d+)\s*(gün|gun|günlük|day|days)\b/i);
  return {
    dataGb: gb ? Number(gb[1].replace(",", ".")) : null,
    unlimited: /sınırsız|sinirsiz|unlimited/i.test(text),
    days: days ? Number(days[1]) : null,
  };
}

/** The country a place is in, by name in the board's language, with its code ("Porto" → Portekiz, PT); a country stands for itself. */
export function countryOfPlace(place: string | null | undefined): { name: string; code: string | null } | null {
  if (!place?.trim()) return null;
  const p = knownPlaceOf(place);
  const country = p ? (p.countryTr ? L(p.countryTr, p.countryEn ?? p.countryTr) : L(p.tr, p.en)) : null;
  const code = countryCodeOfName(country ?? place);
  if (!code) return country ? { name: country, code: null } : null;
  return { name: regionName(code, lang()) ?? country ?? place, code };
}

/** An eSIM's place: its country, said or read from the trip's places (never the first city). */
export function esimCountry(said: string | null, item: Item | null, items: Item[]): { name: string; code: string | null } | null {
  const fromCode = (code: string | null | undefined) => (code ? { name: regionName(code.toUpperCase(), lang()) ?? code, code: code.toUpperCase() } : null);
  return (
    countryOfPlace(said) ??
    fromCode(item?.countryCode) ??
    countryOfPlace(item?.country) ??
    countryOfPlace(item?.city) ??
    fromCode(countryCodesOf(items)[0]) ??
    countryOfPlace(items.find((i) => i.status !== "dismissed" && i.category === "stay" && i.city)?.city)
  );
}

/** An eSIM put in its country (the add sheet's or a suggestion's city, "Porto" → Portekiz); anything else as it is. */
export function esimInCountry(item: Item): Item {
  if (item.category !== "esim") return item;
  const country = countryOfPlace(item.city) ?? countryOfPlace(item.country);
  return country ? { ...item, city: country.name, country: country.name, countryCode: country.code ?? item.countryCode } : item;
}

const sameName = (a: string, b: string) => {
  const [x, y] = [fold(a).replace(/[^a-z0-9]+/g, " ").trim(), fold(b).replace(/[^a-z0-9]+/g, " ").trim()];
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

/** The said plan as a record, for comparing (never saved). */
const probeOf = (said: PlannedInput, tripId: string) => plannedItem(said, tripId, "", 0);

/**
 * The records on the plan a booking said in the chat could be: same kind, same place, same day (or none on
 * either side), and, for a thing with a name of its own, that name. A record ruled out, or the one it replaces,
 * never. Several: the chat asks which (bookingTarget narrows by name and by what's on the plan first).
 */
export function bookingCandidates(said: PlannedInput, extras: BookingExtras, items: Item[], tripId: string, skip: ReadonlySet<string> = new Set()): Item[] {
  const probe = probeOf(said, tripId);
  const kind = cardKind(probe);
  if (!BOOKABLE.includes(kind)) return [];
  const title = said.title && !isKindName(said.title) ? said.title : null;
  return items.filter((raw) => {
    if (raw.tripId !== tripId || raw.status === "dismissed" || skip.has(raw.id)) return false;
    const i = withEdits(raw);
    if (cardKind(i) !== kind) return false;
    if (ONE_PER_TRIP.includes(kind)) {
      if (kind === "esim") {
        const [a, b] = [countryOfPlace(said.city ?? said.to)?.code, i.countryCode ?? countryOfPlace(i.country ?? i.city)?.code];
        if (a && b && a !== b) return false;
      }
      // A shop named on both sides and not the same ("Holafly" said, an Airalo page saved) is another one.
      const shop = extras.provider ?? null;
      return !(shop && i.provider && !sameName(shop, i.provider));
    }
    // Its own name ("Tekne turu", a saved hotel page) is the same thing only by that name.
    if (title && !isKindName(i.name) && !sameName(title, i.name)) return false;
    if (TRAVEL.includes(kind)) {
      const [toA, toB] = [cityKeyOf(probe.flight?.to ?? probe.city), cityKeyOf(i.flight?.to ?? i.city)];
      const [fromA, fromB] = [cityKeyOf(probe.flight?.from), cityKeyOf(i.flight?.from)];
      if ((toA && toB && toA !== toB) || (fromA && fromB && fromA !== fromB)) return false;
    } else if (probe.city && i.city && !sameCity(probe.city, i.city)) return false;
    if (RANGED.includes(kind)) {
      const [a, b] = [rangeOf(probe), rangeOf(i)];
      return !a || !b || a.start === b.start || (a.start < b.end && b.start < a.end);
    }
    const [dayA, dayB] = [departureDay(probe), departureDay(i)];
    return !dayA || !dayB || dayA === dayB;
  });
}

const rangeOf = (i: Item) => (i.category === "stay" ? stayRange(i) : isoDate(i.dates.start) ? { start: i.dates.start!, end: isoDate(i.dates.end) ?? i.dates.start! } : null);

/** One of several: the one named, else the one on the plan (chosen or booked); null when it's still unclear. */
export function narrowCandidates(list: Item[], said: PlannedInput): Item[] {
  if (list.length < 2) return list;
  const title = said.title && !isKindName(said.title) ? said.title : null;
  const named = title ? list.filter((i) => sameName(title, withEdits(i).name)) : [];
  if (named.length) return named;
  const onPlan = list.filter((i) => i.status === "chosen" || i.status === "booked");
  return onPlan.length ? onPlan : list;
}

/** A candidate as the chip and the question name it: "Konaklama · Porto (7–9 Eki)". */
export function candidateLabel(raw: Item): string {
  const i = withEdits(raw);
  const r = rangeOf(i);
  const day = departureDay(i);
  const when = r && r.end !== r.start ? formatDateRange(r.start, r.end) : day ? formatDateRange(day, null) : null;
  const place = i.city && !fold(i.name).includes(fold(i.city)) ? i.city : null;
  return [i.name, place].filter(Boolean).join(" · ") + (when ? ` (${when})` : "");
}

/** What the update wrote, in words, for the reply ("10 GB", "alındı", "Airalo", "12 EUR"). */
export interface BookingUpdate {
  item: Item;
  changed: string[];
  /** "eSIM kartını güncelledim: 10 GB, alındı" (the card's kind in words). */
  summary: string;
}

/**
 * The record on the plan with the booking said for it: booked (when said), the name or package, the shop, the
 * price and the days said; its files, owners, votes, links and its own id are kept. A saved page's card takes
 * what was said as its corrections (a page saved again can't put the page's back). An eSIM's place is its country.
 */
export function bookedUpdate(raw: Item, said: PlannedInput, extras: BookingExtras, items: Item[], now: number): BookingUpdate | string {
  const view = withEdits(raw);
  const kind = cardKind(view);
  const changed: string[] = [];
  const page = fromPage(raw);
  let next: Item = { ...raw };
  const edits: Record<string, string | number | null> = {};

  // The name: the one said, or the eSIM's package ("10 GB eSIM") when its name is only the kind's.
  const pack = kind === "esim" ? esimPackage(`${said.title ?? ""} ${said.note ?? ""}`) : null;
  const packName = pack && (pack.dataGb || pack.unlimited) ? `${pack.unlimited ? L("Sınırsız", "Unlimited") : `${String(pack.dataGb).replace(".", ",")} GB`} eSIM` : null;
  const title = said.title && !isKindName(said.title) ? said.title.slice(0, 80) : said.title && packName ? packName : null;
  const name = title ?? (packName && isKindName(view.name) ? packName : null);
  if (name && name !== view.name) {
    if (page) edits.name = name;
    else next.name = name;
    changed.push(name);
  }
  if (pack && (pack.dataGb || pack.unlimited || pack.days)) {
    const m = { ...metricsOf(raw) };
    if (pack.dataGb && m.dataGb !== pack.dataGb) {
      m.dataGb = pack.dataGb;
      if (!name) changed.push(`${String(pack.dataGb).replace(".", ",")} GB`);
    }
    if (pack.unlimited) m.unlimitedData = true;
    if (pack.days) m.validityDays = pack.days;
    next.metrics = m;
  }
  if (extras.provider && extras.provider !== view.provider) {
    next.provider = extras.provider;
    changed.push(extras.provider);
  }
  if (extras.price != null) {
    const currency = currencyCode(extras.currency) ?? view.price.currency;
    if (!currency) return L("Fiyatın para birimini (EUR, TRY...) de yaz.", "Give the price's currency too (EUR, TRY...).");
    if (page) Object.assign(edits, { price: extras.price, currency });
    else next = withoutEdits({ ...next, price: { amount: extras.price, currency, scope: "total", taxesIncluded: "unknown", source: "user", observedAt: now } }, ["price", "currency"]);
    next.priceHistory = [...raw.priceHistory, { amount: extras.price, currency, observedAt: now }];
    changed.push(`${extras.price} ${currency}`);
  }

  // The days said; an eSIM's place is its country, else the place said where the card has none.
  const days = { start: said.date, end: said.end_date, time: said.time };
  if (days.start || days.end || days.time) {
    if (page) Object.assign(edits, { start: days.start, end: days.end, time: days.time });
    else {
      const start = days.start ?? view.dates.start;
      next.dates = { ...next.dates, start, end: days.end ?? (days.start && days.start !== view.dates.start ? null : view.dates.end), source: "user" };
      if (days.time && start) next.flight = { ...(next.flight ?? { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }), departure: `${start}T${days.time}` };
      next = withoutEdits(next, ["start", "end", "time"]);
    }
    const r = days.start ? formatDateRange(days.start, days.end) : null;
    if (r) changed.push(r);
  }
  if (kind === "esim") {
    const country = esimCountry(said.city ?? said.to, view, items);
    if (country && view.city !== country.name) {
      if (page) edits.city = country.name;
      else next = withoutEdits({ ...next, city: country.name }, ["city"]);
      next.country = country.name;
      next.countryCode = country.code ?? next.countryCode;
      changed.push(country.name);
    }
  } else if (!view.city && (said.city ?? (TRAVEL.includes(kind) ? null : said.to))) {
    const city = said.city ?? said.to;
    if (page) edits.city = city;
    else next.city = city;
    changed.push(city!);
  }
  if (said.note && said.note !== view.statusNote) next.statusNote = said.note;
  if (said.booked && raw.status !== "booked") {
    next.status = "booked";
    next.statusAt = now;
    changed.push(bookedWord(kind));
  }
  if (!raw.plannedKind && raw.origin === "chat") next.plannedKind = said.kind;
  if (page && Object.keys(edits).length) {
    const corrections = saidEdits(raw, edits);
    if (typeof edits.name === "string") corrections.name = edits.name;
    next.userEdits = corrections;
  }
  next.updatedAt = now;
  const label = cardKindLabel(kind);
  const summary = changed.length
    ? L(`${label} kartını güncelledim: ${changed.join(", ")}`, `I updated the ${label} card: ${changed.join(", ")}`)
    : L(`${label} kartı zaten böyle; değişen bir şey yok`, `The ${label} card already says this; nothing changed`);
  return { item: next, changed, summary };
}

/** "alındı" for what is bought, "rezerve edildi" for what is booked. */
const bookedWord = (kind: CardKind) =>
  kind === "esim" || kind === "insurance" || TRAVEL.includes(kind) || kind === "activity" ? L("alındı", "bought") : L("rezerve edildi", "booked");
