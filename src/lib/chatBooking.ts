// A booking said in the chat for something already on the plan ("10 GB aldım", "arabayı kiraladım, Europcar",
// "Porto'daki oteli rezerve ettim"): the record on the plan is updated, never a second one made. Which record:
// the same trip, the same kind, the same place (an eSIM: its country) and the same day or none on either side;
// an eSIM and insurance are one per trip (per country), so the same kind is enough. A thing with a name of its
// own (a saved page, a tour said by name) is the same only by that name: "parti teknesi" when a boat tour was
// planned is another thing, taking its place (plan_item's replaces, plan.ts's "Yerine … geldi"). A record already
// booked is never overwritten by another purchase: another shop, price, package or person (or "daha", "another")
// is asked about or made a new record. Pure.
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

/** The kind a plan said in the chat is drawn as ("car", "esim", "stay"): what item_id's record must be too. */
export const saidKind = (said: PlannedInput, tripId: string): CardKind => cardKind(plannedItem(said, tripId, "", 0));
/** Two kinds that can be the same record: equal, or a transport whose way isn't known. */
export const sameKind = (a: CardKind, b: CardKind): boolean => a === b || (a === "transport" && TRAVEL.concat(["taxi", "car", "moto", "rv", "bike"]).includes(b)) || (b === "transport" && sameKind(b, a));

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

type Country = { name: string; code: string | null };
const fromCode = (code: string | null | undefined): Country | null =>
  code && /^[A-Za-z]{2}$/.test(code) ? { name: regionName(code.toUpperCase(), lang()) ?? code.toUpperCase(), code: code.toUpperCase() } : null;

/**
 * The country a place is in, by name in the board's language, with its code ("Porto" → Portekiz, PT); a country
 * stands for itself; a city the code doesn't know ("Madrid", "Funchal") by a record of the trip in it. Null when
 * none says: never the trip's first country for a place that isn't in it.
 */
export function countryOfPlace(place: string | null | undefined, items: Item[] = []): Country | null {
  if (!place?.trim()) return null;
  const p = knownPlaceOf(place);
  const country = p ? (p.countryTr ? L(p.countryTr, p.countryEn ?? p.countryTr) : L(p.tr, p.en)) : null;
  const code = countryCodeOfName(country ?? place);
  if (code) return { name: regionName(code, lang()) ?? country ?? place, code };
  const there = items.find((i) => i.status !== "dismissed" && i.category !== "esim" && i.city && i.countryCode && sameCity(i.city, place));
  return fromCode(there?.countryCode) ?? (country ? { name: country, code: null } : null);
}

/** The trip's countries, by code: its records' own, and those of the cities the code knows. */
export function tripCountries(items: Item[]): string[] {
  const live = items.filter((i) => i.status !== "dismissed" && i.category !== "esim" && i.category !== "flight");
  const codes = [...countryCodesOf(live), ...live.map((i) => countryOfPlace(i.city)?.code).filter((c): c is string => Boolean(c))];
  return [...new Set(codes)];
}

/**
 * An eSIM's place: its country, from the place said, else the one on its card. With no place at all, the trip's
 * country when it has only one. Null (the place kept as given) when the place isn't known: never another country.
 */
export function esimCountry(said: string | null, item: Item | null, items: Item[]): Country | null {
  if (said?.trim()) return countryOfPlace(said, items);
  const own = item?.city ?? item?.country ?? null;
  if (own) return countryOfPlace(own, items) ?? fromCode(item?.countryCode);
  if (item?.countryCode) return fromCode(item.countryCode);
  const codes = tripCountries(items);
  return codes.length === 1 ? fromCode(codes[0]) : null;
}

/** An eSIM put in its country (the add sheet's or a suggestion's city, "Porto" → Portekiz); anything else as it is. */
export function esimInCountry(item: Item, items: Item[] = []): Item {
  if (item.category !== "esim") return item;
  const country = countryOfPlace(item.city, items) ?? countryOfPlace(item.country, items);
  return country ? { ...item, city: country.name, country: country.name, countryCode: country.code ?? item.countryCode } : item;
}

const words = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
/**
 * The same name on whole words: equal, or a name of two words or more found whole in the other ("Tekne turu" in
 * "Douro tekne turu"); one word is never part of a longer name ("Tour" isn't "Boat tour").
 */
export function sameName(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return false;
  if (x.join(" ") === y.join(" ")) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 2) return false;
  return long.some((_, n) => short.every((w, k) => long[n + k] === w));
}

/** The said plan as a record, for comparing (never saved). */
const probeOf = (said: PlannedInput, tripId: string) => plannedItem(said, tripId, "", 0);

/**
 * The records on the plan a booking said in the chat could be: same kind, same place, same day (or none on
 * either side), and, for a thing with a name of its own, that name. A record ruled out, or the one it replaces,
 * never. Several: the chat asks which (decideBooking narrows by name and by what's on the plan first).
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
        const place = said.city ?? said.to;
        if (place) {
          const a = countryOfPlace(place, items)?.code;
          const b = i.countryCode ?? countryOfPlace(i.city ?? i.country, items)?.code;
          const same = a && b ? a === b : (!i.city && !i.country) || [i.city, i.country].some((x) => x && sameCity(x, place));
          if (!same) return false;
        }
      }
      // A shop named on both sides and not the same ("Holafly" said, an Airalo page saved) is another one.
      const shop = extras.provider;
      return !(shop && i.provider && fold(shop) !== fold(i.provider) && !sameName(shop, i.provider));
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

/** "5 GB daha", "ikinci bilet", "another one": maybe a purchase besides the one on the plan, maybe not ("bir gün daha kalacağız", "daha ucuza"): next to one already bought, always asked, never a record on the word alone. */
export const SECOND_PURCHASE = /(^|[^\p{L}])(daha|ikinci|another|one more|second|extra|additional)(?![\p{L}])/iu;

/** A name on the trip said in the message ("Sabine'in bileti", "for Sabine"), whole word, case aside. */
const namesIn = (text: string, names: string[]) =>
  names.filter((n) => n.trim() && new RegExp(`(^|[^\\p{L}])${n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(text));

export interface BookingContext {
  /** The traveller's message. */
  userText: string;
  /** The trip's people by name (a shared trip): a booking said for one of them is theirs. */
  names: string[];
}

/**
 * Why a booking said now is not the record already booked: another shop, another price, another package, or
 * someone else's ("Sabine'in bileti" on Emre's). Null when nothing said differs (it only adds what was missing).
 */
export function differsFromBooked(raw: Item, said: PlannedInput, extras: BookingExtras, ctx: BookingContext): string | null {
  const i = withEdits(raw);
  if (extras.provider && i.provider && !sameName(extras.provider, i.provider) && fold(extras.provider) !== fold(i.provider)) return L(`başka satıcı (${i.provider} → ${extras.provider})`, `another shop (${i.provider} → ${extras.provider})`);
  if (extras.price != null && i.price.amount != null && (extras.price !== i.price.amount || (currencyCode(extras.currency) ?? i.price.currency) !== i.price.currency)) {
    return L(`başka fiyat (${i.price.amount} → ${extras.price})`, `another price (${i.price.amount} → ${extras.price})`);
  }
  if (cardKind(i) === "esim") {
    const pack = esimPackage(`${said.title ?? ""} ${said.note ?? ""}`).dataGb;
    const had = metricsOf(i).dataGb;
    if (pack && had && pack !== had) return L(`başka paket (${had} GB → ${pack} GB)`, `another package (${had} GB → ${pack} GB)`);
  }
  if (ctx.names.length > 1) {
    const named = namesIn(`${ctx.userText} ${said.note ?? ""} ${said.title ?? ""}`, ctx.names);
    const owners = (i.forWho ?? []).map((n) => fold(n));
    const other = named.filter((n) => !owners.includes(fold(n)));
    if (other.length && named.length < ctx.names.length) return L(`${other.join(", ")} için (bu kart ${i.forWho?.join(", ") || "herkesin"})`, `for ${other.join(", ")} (this card is ${i.forWho?.join(", ") || "everyone's"})`);
  }
  return null;
}

/** What plan_item does with a booking: update one record, add (a new one, or forced new), or ask. */
export type BookingDecision =
  | { kind: "add" }
  | { kind: "update"; item: Item }
  | { kind: "which"; items: Item[] }
  | { kind: "booked"; item: Item; why: string }
  | { kind: "country"; countries: string[] };

/**
 * Which record a booking said in the chat is for (plan_item without item_id). Said bought/booked (or an eSIM or
 * insurance, one per trip): the one record it can only be is updated; several are asked about; one already
 * booked is updated only when nothing said differs, else asked about ("Bu kartı güncelle" / "Yeni kayıt ekle"),
 * "daha", "another" next to it too: only the model's item_id "new" adds one. Booked stays said over several of the chat's own,
 * all inside the nights said ("8–14 rezerve ettim" over 8–10 and 10–14), merge as before (add). An eSIM with no
 * country, on a trip of several, asks which.
 */
export function decideBooking(said: PlannedInput, extras: BookingExtras, items: Item[], tripId: string, skip: ReadonlySet<string>, ctx: BookingContext): BookingDecision {
  const kind = saidKind(said, tripId);
  const oneEsim = kind === "esim" && !(said.city ?? said.to);
  const countries = oneEsim ? tripCountries(items) : [];
  if (!said.booked && kind !== "esim" && kind !== "insurance") return { kind: "add" };
  const all = bookingCandidates(said, extras, items, tripId, skip);
  const second = SECOND_PURCHASE.test(ctx.userText);
  const why = new Map<string, string>();
  for (const i of all) {
    if (i.status !== "booked") continue;
    const reason = differsFromBooked(i, said, extras, ctx) ?? (second ? L("belki ikinci bir alım (\"daha\", \"ikinci\" dendi)", "maybe a second purchase (\"another\", \"extra\" said)") : null);
    if (reason) why.set(i.id, reason);
  }
  const found = narrowCandidates(all.filter((i) => !why.has(i.id)), said);
  if (found.length > 1 && kind === "stay" && said.date && said.end_date) {
    const r = { start: said.date, end: said.end_date };
    const inside = found.every((i) => {
      const own = i.origin === "chat" && i.status !== "booked" ? stayRange(i) : null;
      return own && own.start >= r.start && own.end <= r.end;
    });
    if (inside) return { kind: "add" };
  }
  if (found.length === 1) return { kind: "update", item: found[0] };
  if (found.length > 1) return { kind: "which", items: found };
  const booked = all.filter((i) => why.has(i.id));
  if (booked.length) return { kind: "booked", item: booked[0], why: why.get(booked[0].id)! };
  if (oneEsim && countries.length > 1) return { kind: "country", countries };
  return { kind: "add" };
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

const gbText = (n: number) => `${String(n).replace(".", ",")} GB`;

/**
 * The record on the plan with the booking said for it: booked (when said), the name or package, the shop, the
 * price and the days said; its files, owners, votes, links and its own id are kept. A saved page's card takes
 * what was said as its corrections (a page saved again can't put the page's back), the price only when the page
 * gives a total too (else the total said is the record's own, as set_price does). An eSIM's place is its country.
 * Only what really changed is in `changed`.
 */
export function bookedUpdate(raw: Item, said: PlannedInput, extras: BookingExtras, items: Item[], now: number): BookingUpdate | string {
  const view = withEdits(raw);
  const kind = cardKind(view);
  const changed: string[] = [];
  const page = fromPage(raw);
  let next: Item = { ...raw };
  const edits: Record<string, string | number | null> = {};

  if (extras.price != null && !currencyCode(extras.currency)) {
    return L(`Para birimi ISO kodu olmalı (USD, EUR, TRY...): ${extras.currency ?? "yok"}. Kullanıcıya hangi para birimi olduğunu sor; hiçbir şey değişmedi.`, `The currency must be an ISO code (USD, EUR, TRY...): ${extras.currency ?? "none"}. Ask the user which currency; nothing changed.`);
  }

  // The name: the one said, or the eSIM's package ("10 GB eSIM") when its name is only the kind's.
  const pack = kind === "esim" ? esimPackage(`${said.title ?? ""} ${said.note ?? ""}`) : null;
  const packName = pack && (pack.dataGb || pack.unlimited) ? `${pack.unlimited ? L("Sınırsız", "Unlimited") : gbText(pack.dataGb!)} eSIM` : null;
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
      if (!name || name === view.name) changed.push(gbText(pack.dataGb));
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
    const currency = currencyCode(extras.currency)!;
    const same = view.price.amount === extras.price && view.price.currency === currency && view.price.scope === "total";
    if (!same) {
      // A page's price per night or per person: the total said is the record's own (never 600 a night).
      const pageScope = view.price.amount != null ? view.price.scope : "total";
      if (page && pageScope === "total") Object.assign(edits, { price: extras.price, currency });
      else next = withoutEdits({ ...next, price: { amount: extras.price, currency, scope: "total", taxesIncluded: "unknown", source: "user", observedAt: now } }, ["price", "currency"]);
      next.priceHistory = [...raw.priceHistory, { amount: extras.price, currency, observedAt: now }];
      changed.push(`${extras.price} ${currency}`);
    }
  }

  // The days said; an eSIM's place is its country, else the place said where the card has none.
  const days = { start: said.date, end: said.end_date, time: said.time };
  const clock = view.flight?.departure?.slice(11, 16) || null;
  const newDays = (days.start && days.start !== view.dates.start) || (days.end && days.end !== view.dates.end) || (days.time && days.time !== clock);
  if (newDays) {
    if (page) Object.assign(edits, { start: days.start, end: days.end, time: days.time });
    else {
      const start = days.start ?? view.dates.start;
      next.dates = { ...next.dates, start, end: days.end ?? (days.start && days.start !== view.dates.start ? null : view.dates.end), source: "user" };
      if (days.time && start) next.flight = { ...(next.flight ?? { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }), departure: `${start}T${days.time}` };
      next = withoutEdits(next, ["start", "end", "time"]);
    }
    const r = days.start ? formatDateRange(days.start, days.end) : days.time;
    if (r) changed.push(r);
  }
  if (kind === "esim") {
    const country = esimCountry(said.city ?? said.to, view, items);
    if (country && (view.city !== country.name || view.countryCode !== (country.code ?? view.countryCode))) {
      if (page) edits.city = country.name;
      else next = withoutEdits({ ...next, city: country.name }, ["city"]);
      next.country = country.name;
      next.countryCode = country.code ?? next.countryCode;
      if (view.city !== country.name) changed.push(country.name);
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
