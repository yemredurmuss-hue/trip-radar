// Kişiye özel rezervasyon (spec docs/superpowers/specs/2026-10-06-kisiye-ozel-rezervasyon-design.md, mockup
// docs/mockups/2026-10-06-kisiye-ozel-v1.html): whose a plan is, said only for the exception. A plan for everyone
// shows nothing; a plan for some of the trip's people (never all of them) reads "Sabine'in bileti", always by name
// ("senin" never: a shared trip reads the same on both computers); a trip with one person shows nothing. Pure.
//
// The API the cards' session builds on (keep these signatures stable):
//
//   peopleOf(trip, who?)            → string[]   the trip's people by name, me first (tripSettings.whoGoes)
//   whoseOf(item, trip, who?)       → Whose | null
//       null unless item.forWho, matched case aside, is a strict, non-empty part of peopleOf(trip, who): a plan
//       for everyone, for a name not on the trip, or on a one-person trip is null. `names` in the trip's spelling
//       and order, `label` "Sabine'in bileti" / "Emre ve Ali'nin" / "Sabine's ticket", `partial` true when it's
//       several people (still short of everyone), false for one.
//   genitive(name)                  → "Emre'nin", "Sabine'in", "Can'ın" (Turkish; the English "'s" is in labels)
//   headCountOf(item, trip, opts)   → number | null   how many a plan is for ("1 kişi" on its price, its searches)
//   ownersFromDoc(names, people)    → string[] | "everyone" | "ask" | null   a document's names to the trip's people
//   ownersByOrigin(item, trip, items, who?) → string[] | null   a flight from where only some come from
//   tripOrigin(items) / firstStop(trip, items) / lastStop(trip, items)
//
// `who` is my name (the profile's or the sharing name) as a string, or { me, members, shared } on a shared trip,
// as whoGoes takes them. The React side is cards/WhoseBadge.tsx (<WhoseBadge item trip />); the write is
// app/actions.ts setOwner(itemId, names | null).
import { cityOfAirport } from "./airports";
import { L } from "./i18n";
import { tripDateRange } from "./items";
import { sameCity } from "./plan";
import { isRental } from "./travelKinds";
import { sameName, whoGoes } from "./tripSettings";
import type { Item, Trip } from "./types";

/** My name, or everything whoGoes needs on a shared trip. */
export type WhoCtx = string | null | undefined | { me?: string | null; members?: string[]; shared?: boolean };

const ctxOf = (who: WhoCtx) => (who && typeof who === "object" ? who : { me: who ?? null });

/** My name on this computer, or null (no profile name yet). */
export const meOf = (who: WhoCtx): string | null => ctxOf(who).me?.trim() || null;

/**
 * The stand-in whoGoes puts first when I have no name ("Ben" / "Me"): fine in a list ("Ben", "Ben (Emre)"), never
 * in a badge or a toast. A plan that would be mine waits for my name ("Sana ne diyeyim?").
 */
export const isUnnamedMe = (name: string, who: WhoCtx): boolean => !meOf(who) && !ctxOf(who).shared && /^(ben|me)$/i.test(name.trim());

/** The trip's people by name, me first ("Ben" when I have no name and the trip isn't shared); [] when nobody is named. */
export function peopleOf(trip: Pick<Trip, "travellers">, who?: WhoCtx): string[] {
  const c = ctxOf(who);
  return whoGoes({ travellers: trip.travellers, me: c.me ?? null, members: c.members ?? [], shared: c.shared }).names;
}

export interface Whose {
  /** The owners, as the trip spells them, in the trip's order. */
  names: string[];
  /** "Sabine'in bileti", "Emre'nin rezervasyonu", "Ali'nin", "Emre ve Ali'nin"; "Sabine's ticket"… */
  label: string;
  /** Several people (but not everyone): the badge stacks their faces. */
  partial: boolean;
}

// --- Turkish genitive ---------------------------------------------------------------------------------

const VOWELS = "aeıioöuüâîûéèêàáóôúíë";
const HARMONY: Record<string, string> = { a: "ı", ı: "ı", â: "ı", à: "ı", á: "ı", o: "u", u: "u", ó: "u", ô: "u", û: "u", ú: "u", e: "i", i: "i", î: "i", é: "i", è: "i", ê: "i", ë: "i", í: "i", ö: "ü", ü: "ü" };

/**
 * Names whose last e is silent (French and German ones, as they are said in Turkish): "Sabine" is said "Sabin",
 * so Sabine'in, not Sabine'nin. Turkish names ending in e say it (Emre'nin, Ayşe'nin, Emine'nin).
 */
const SILENT_E = new Set([
  "sabine", "caroline", "justine", "nadine", "christine", "kristine", "janine", "josephine", "catherine", "katherine", "pauline",
  "celine", "céline", "jacqueline", "madeleine", "claire", "nicole", "michelle", "isabelle", "danielle", "gabrielle",
  "simone", "yvonne", "jeanne", "louise", "charlotte", "juliette", "colette", "bernadette", "antoinette", "mireille",
  "solange", "pierre", "philippe", "etienne", "étienne", "jérôme", "jerome", "maxime", "sophie",
]);

/**
 * A name's Turkish genitive with its apostrophe, by the last vowel heard (big vowel harmony) and the buffer n after a
 * vowel: Emre'nin, Sabine'in, Ali'nin, Mert'in, Oğuz'un, Ümüt'ün, Duru'nun, Ayşe'nin, Can'ın. Several words: the
 * last one decides ("Emre Durmuş'un").
 */
export function genitive(name: string): string {
  const n = name.trim();
  if (!n) return n;
  const lower = n.toLocaleLowerCase("tr-TR");
  const word = lower.split(/\s+/).at(-1) ?? lower;
  // "Sophie" is said "Sofi": the i before the silent e is the last vowel heard, and it ends in a vowel.
  const heard = SILENT_E.has(word) ? word.slice(0, -1) : word;
  const letters = [...heard].filter((ch) => /\p{L}/u.test(ch));
  const last = [...letters].reverse().find((ch) => VOWELS.includes(ch));
  const vowel = last ? (HARMONY[last] ?? "i") : "i";
  const vowelEnd = letters.length > 0 && VOWELS.includes(letters[letters.length - 1]);
  return `${n}'${vowelEnd ? "n" : ""}${vowel}n`;
}

/** "Sabine's", "James's". */
const possessive = (name: string) => `${name.trim()}'s`;

/** The word after the owner: a ticket (a flight, a way of travel, an activity), a booking (a stay, a rental), else none. */
function nounOf(item: Item): "ticket" | "booking" | null {
  if (item.category === "stay" || isRental(item)) return "booking";
  if (item.category === "flight" || item.category === "transport" || item.category === "activity") return "ticket";
  return null;
}

/** "Emre ve Ali'nin" / "Emre and Ali's"; one name with its noun: "Sabine'in bileti" / "Sabine's ticket". */
export function whoseLabel(names: string[], noun: "ticket" | "booking" | null): string {
  if (!names.length) return "";
  if (names.length > 1) {
    const head = names.slice(0, -1).join(", ");
    const last = names[names.length - 1];
    return L(`${head} ve ${genitive(last)}`, `${head} and ${possessive(last)}`);
  }
  const [one] = names;
  if (noun === "ticket") return L(`${genitive(one)} bileti`, `${possessive(one)} ticket`);
  if (noun === "booking") return L(`${genitive(one)} rezervasyonu`, `${possessive(one)} booking`);
  return L(genitive(one), possessive(one));
}

/** A change of owners in words, for Geçmiş and the toast: "Ryanair: Sabine'in bileti", "Ryanair: herkesin". */
export function ownerWords(item: Item, owners: string[] | null): string {
  return owners?.length ? `${item.name}: ${whoseLabel(owners, nounOf(item))}` : L(`${item.name}: herkesin`, `${item.name}: everyone's`);
}

/** The plan's owners as the trip spells them, or null when one of them isn't on the trip. */
function ownersOn(forWho: string[], people: string[]): string[] | null {
  const out: string[] = [];
  for (const n of forWho) {
    const p = people.find((x) => sameName(x, n));
    if (!p) return null;
    if (!out.includes(p)) out.push(p);
  }
  return people.filter((p) => out.includes(p));
}

/** Whose the plan is, when it's some of the trip's people and not all of them; null otherwise (see the top). */
export function whoseOf(item: Item, trip: Pick<Trip, "travellers">, who?: WhoCtx): Whose | null {
  const forWho = (item.forWho ?? []).filter((n) => typeof n === "string" && n.trim());
  if (!forWho.length) return null;
  const people = peopleOf(trip, who);
  if (people.length < 2) return null;
  const names = ownersOn(forWho, people);
  if (!names || !names.length || names.length >= people.length) return null;
  // Never "Ben'in bileti": a plan of mine shows once I have a name.
  if (names.some((n) => isUnnamedMe(n, who))) return null;
  return { names, label: whoseLabel(names, nounOf(item)), partial: names.length > 1 };
}

// --- where the trip goes from, and the ends of its way -------------------------------------------------

const live = (i: Item) => i.status !== "dismissed";
const dayOf = (i: Item) => i.flight?.departure?.slice(0, 10) ?? i.dates.start ?? null;
const byDay = (a: Item, b: Item) => (a.flight?.departure ?? a.dates.start ?? "9").localeCompare(b.flight?.departure ?? b.dates.start ?? "9");
const place = (s: string | null | undefined) => (s?.trim() ? cityOfAirport(s.trim()) : null);
const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(place(a) && place(b) && sameCity(place(a), place(b)));

/**
 * The trip's own flights, live, in order: with the trip, those not to or from where someone comes from on their own
 * (Sabine's Alicante flights aside; the trip's own may have owners, the rest of the people); without it, everyone's.
 */
const mainFlights = (items: Item[], trip?: Pick<Trip, "travellers">) => {
  const places = Object.values(trip?.travellers?.from ?? {});
  const personal = (f: Item) => (trip ? places.some((p) => same(f.flight?.from, p) || same(f.flight?.to ?? f.city, p)) : (f.forWho ?? []).length > 0);
  return items.filter((i) => live(i) && i.category === "flight" && !personal(i)).sort(byDay);
};

/** Where the trip leaves from: the first of its own flights' start ("İstanbul"); null when no such flight says it. */
export function tripOrigin(items: Item[], trip?: Pick<Trip, "travellers">): string | null {
  return place(mainFlights(items, trip).find((f) => f.flight?.from)?.flight?.from) ?? null;
}

/** Where the trip's way in lands (its first flight's end), else its first stay's city; and its first day. */
export function firstStop(trip: Pick<Trip, "confirmedDates" | "travellers">, items: Item[]): { city: string | null; date: string | null } {
  const flight = mainFlights(items, trip).find((f) => f.flight?.to);
  const stay = items.filter((i) => live(i) && i.category === "stay" && i.city).sort(byDay)[0];
  const date = (flight ? dayOf(flight) : null) ?? trip.confirmedDates?.start ?? tripDateRange(items)?.start ?? null;
  return { city: place(flight?.flight?.to) ?? stay?.city ?? null, date };
}

/** Where the way home leaves from (the last everyone's flight back to where the trip leaves from), else the last stay's city; and the last day. */
export function lastStop(trip: Pick<Trip, "confirmedDates" | "travellers">, items: Item[]): { city: string | null; date: string | null } {
  const origin = tripOrigin(items, trip);
  const flights = mainFlights(items, trip);
  const home = [...flights].reverse().find((f) => origin && same(f.flight?.to, origin) && f.flight?.from);
  const stays = items.filter((i) => live(i) && i.category === "stay" && i.city).sort(byDay);
  const date = (home ? dayOf(home) : null) ?? trip.confirmedDates?.end ?? tripDateRange(items)?.end ?? null;
  return { city: place(home?.flight?.from) ?? stays.at(-1)?.city ?? null, date };
}

// --- how many a plan is for ----------------------------------------------------------------------------

/**
 * How many a plan is for (its price's "1 kişi", its searches' head count): its owners when it's someone's; on an
 * everyone's flight, everyone but those with a flight of their own the same way (Sabine's Alicante → Porto takes
 * her off İstanbul → Porto: they go to the same place, or leave from the same one). `total`: how many go.
 */
export function headCountOf(item: Item, trip: Pick<Trip, "travellers">, opts: { total: number | null; items?: Item[]; who?: WhoCtx }): number | null {
  const whose = whoseOf(item, trip, opts.who);
  if (whose) return whose.names.length;
  const total = opts.total;
  if (!total || item.category !== "flight" || !opts.items) return total;
  if (peopleOf(trip, opts.who).length < 2) return total;
  return Math.max(1, total - awayOf(item, trip, opts.items, opts.who).length);
}

/** The people with a flight of their own the same way as this one (to the same place, or from the same one). */
export function awayOf(item: Item, trip: Pick<Trip, "travellers">, items: Item[], who?: WhoCtx): string[] {
  const away = new Set<string>();
  for (const other of items) {
    if (other.id === item.id || !live(other) || other.category !== "flight") continue;
    const owners = whoseOf(other, trip, who);
    if (!owners) continue;
    const sameWay = same(other.flight?.to ?? other.city, item.flight?.to ?? item.city) || same(other.flight?.from, item.flight?.from);
    if (sameWay) owners.names.forEach((n) => away.add(n));
  }
  return [...away];
}

/**
 * The trip's own flights whose way someone has a flight of their own for: they go to the rest of the people
 * (İstanbul → Denpasar is "Emre'nin bileti" once Sabine flies from Alicante), so no card reads "1 kişi" unexplained.
 * `needName`: the rest would be me while I have no name yet (never "Ben'in bileti": the chat asks first).
 */
export function restOwners(trip: Pick<Trip, "travellers">, items: Item[], who?: WhoCtx): { changes: { item: Item; owners: string[] }[]; needName: boolean } {
  const people = peopleOf(trip, who);
  const changes: { item: Item; owners: string[] }[] = [];
  let needName = false;
  if (people.length < 2) return { changes, needName };
  for (const flight of mainFlights(items, trip)) {
    if ((flight.forWho ?? []).length) continue;
    const away = awayOf(flight, trip, items, who);
    if (!away.length) continue;
    const rest = people.filter((p) => !away.includes(p));
    if (!rest.length) continue;
    if (rest.some((p) => isUnnamedMe(p, who))) {
      needName = true;
      continue;
    }
    changes.push({ item: flight, owners: rest });
  }
  return { changes, needName };
}

// --- who it is, worked out (never guessed) ---------------------------------------------------------------

const TITLES = new Set(["mr", "mrs", "ms", "miss", "mstr", "dr", "bay", "bayan", "sn", "herr", "frau", "mme", "mlle", "m"]);

/** Case, accents and Turkish letters aside: "SABINE MÜLLER" → "sabine muller", "Şule" → "sule", "İsmail" → "ismail". */
export function foldName(name: string): string {
  return name
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

/** A name on a document as words, the given names first ("MULLER/SABINE MS" → ["sabine", "muller"]), titles off. */
function docWords(raw: string): string[] {
  const folded = foldName(raw);
  const [surname, given] = folded.includes("/") ? folded.split("/", 2) : [null, folded];
  const words = (s: string | null) => (s ?? "").split(/\s+/).filter((w) => w && !TITLES.has(w));
  return [...words(given), ...words(surname)];
}

/**
 * A document's names (docReader `travellers`) as the trip's people: the first names, case and accents aside
 * ("SABINE MULLER" → Sabine; a person written with a surname needs it on the document too). Only when every
 * name on it is one of the trip's people, each one person:
 * - some of them → their names; all of them → "everyone";
 * - a name that isn't on the trip, or one that could be two people → "ask" ("Bu Ryanair bileti kimin?");
 * - no names, or a trip with one person → null (nothing to say: it stays as it is).
 */
export function ownersFromDoc(names: string[], people: string[]): string[] | "everyone" | "ask" | null {
  const said = names.map((n) => n.trim()).filter(Boolean);
  if (!said.length || people.length < 2) return null;
  const found = new Set<string>();
  for (const raw of said) {
    const words = docWords(raw);
    if (!words.length) return "ask";
    const matches = people.filter((p) => {
      const mine = foldName(p).split(/\s+/).filter(Boolean);
      if (!mine.length || mine[0] !== words[0]) return false;
      // "Emre Durmuş" on the trip: the document says Durmuş too.
      return mine.slice(1).every((w) => words.slice(1).includes(w));
    });
    if (matches.length !== 1) return "ask";
    found.add(matches[0]);
  }
  if (found.size >= people.length) return "everyone";
  return people.filter((p) => found.has(p));
}

/**
 * A flight from where only some of the trip come from (travellers.from), not from where the trip leaves: theirs
 * (Ryanair Alicante → Porto is Sabine's when she comes from Alicante and the trip from İstanbul). Null otherwise:
 * a flight from the trip's own start, or a place nobody comes from, says nothing.
 */
export function ownersByOrigin(item: Item, trip: Pick<Trip, "travellers">, items: Item[], who?: WhoCtx): string[] | null {
  if (item.category !== "flight" || !item.flight?.from) return null;
  const from = trip.travellers?.from ?? {};
  const people = peopleOf(trip, who);
  if (people.length < 2) return null;
  const origin = tripOrigin(items.filter((i) => i.id !== item.id), trip);
  if (origin && same(item.flight.from, origin)) return null;
  const owners = people.filter((p) => {
    const key = Object.keys(from).find((k) => sameName(k, p));
    return key != null && same(from[key], item.flight!.from);
  });
  return owners.length && owners.length < people.length ? owners : null;
}
