// Hazırlık's "Telefonuna kur" (0.39.7, Emre: "o ülkede çok kullanılan uygulamaları da tavsiye edebiliriz", "Bali'ye
// gittiğimizde Grab indirmek gibi", "niyete göre de çıkabilir, doğa yürüyüşü için x uygulama"): the apps to have on the
// phone for this trip, from three places, in this order of trust:
//   1. the table (static/data/country-apps.json, cut from the research in src/data/countryApps.json by
//      scripts/slim-country-apps.mjs): each country's ride, train, transit, map, chat, food and pay apps, and the eSIM
//      providers that sell a local plan there; plus the apps of the trip's kinds (hiking, diving, a festival, a road trip),
//      with the kind's apps that only hold in some countries (YAMAP in Japan);
//   2. the plan itself: a way to or from the airport by taxi suggests Uber (ticketFrame.ts rideApps);
//   3. the AI (usePhoneAi): what the table doesn't know for this trip, asked once and kept on the trip, labelled as the AI's,
//      with a store search instead of a link (a store address is never made up).
// Each line: the app, why (the table's words, Turkish; the AI's in the board's language), its App Store and Google Play
// pages, "Kurdum" and × (not for me). An eSIM provider's line replaces the old plan rows' "13 GB / 20 GB": the plan is
// picked in the provider's app.
import { z } from "zod";
import { L } from "./i18n";
import { isRental } from "./travelKinds";
import type { Item, Trip } from "./types";

/** The table as the extension reads it (scripts/slim-country-apps.mjs). */
export interface PhoneTable {
  updated: string;
  /** id → [name, category, App Store URL, Google Play URL]. */
  apps: Record<string, [string, string, string | null, string | null]>;
  /** country (ISO2) → its apps [id, why, category, verified 1/0] and the eSIM providers with a local plan there. */
  countries: Record<string, { a: [string, string, string | null, number][]; e: string[] }>;
  /** kind → its name [tr, en], its apps [id, why] and the ones for some countries only [id, why, countries]. */
  intents: Record<string, { n: [string, string]; a: [string, string][]; r: [string, string, string[]][] }>;
  /** eSIM provider id → [name, App Store URL, Google Play URL]. */
  esim: Record<string, [string, string | null, string | null]>;
}

export type PhoneCat = "ride" | "rail" | "transit" | "map" | "chat" | "food" | "pay" | "other" | "intent" | "esim" | "ai";

export interface PhoneApp {
  /** The table's id, "ai:<name>" for the AI's, "esim:<provider>" for an eSIM provider. */
  key: string;
  name: string;
  why: string;
  ios: string | null;
  android: string | null;
  /** The AI's line: no store link, a search instead (`search`). */
  ai: boolean;
  search: string | null;
  /** The countries it's listed for, when the trip has more than one and it isn't in all of them ("Tayland, Vietnam"). */
  where: string[];
  /** The table could not confirm it (the research's verified:false): kept, said softly. */
  unsure: boolean;
}

export interface PhoneGroup {
  key: string;
  title: string;
  apps: PhoneApp[];
}

/** Kept on the trip (Trip.phone): what's installed, what's not for me, and the AI's lines with their language. */
export interface TripPhone {
  done?: string[];
  hidden?: string[];
  ai?: { lang: string; at: number; list: { name: string; cat: string; why: string }[] } | null;
}

const CAT_ORDER: PhoneCat[] = ["ride", "rail", "transit", "map", "chat", "food", "pay", "other"];
const CAT_TITLE: Record<string, [string, string]> = {
  ride: ["Taksi ve araç çağırma", "Rides"],
  rail: ["Tren, otobüs, feribot", "Trains, buses, ferries"],
  transit: ["Şehir içi ulaşım", "Getting around town"],
  map: ["Harita", "Maps"],
  chat: ["Mesajlaşma", "Messaging"],
  food: ["Yemek", "Food"],
  pay: ["Ödeme", "Paying"],
  other: ["Diğer", "Other"],
};
/** How many of a kind a country's group shows (the table lists more: the rest are the less used). */
const PER_CAT = 2;
const PER_INTENT = 2;
/** eSIM providers shown (the ones selling a local plan, in the table's order). */
const PER_ESIM = 2;

/** The trip's kinds the table has apps for, from what the trip is (its playbook, its name) and what's on its plan. */
const KIND_WORDS: [string, RegExp][] = [
  ["hiking", /(yürüyüş|trek|hike|hiking|patika|zirve|tırmanış|dağ evi|kamino|camino)/iu],
  ["camping", /(kamp(?!any)|camping|campsite|çad[ıi]r|tent(?!\p{L})|karavan|caravan|campervan|glamping)/iu],
  ["diving", /(dal[ıi]ş|diving|scuba|şnorkel|snorkel|liveaboard)/iu],
  ["surfing", /(sörf|surf)/iu],
  ["skiing", /(kayak merkez|kayak tatil|ski(?!p)|snowboard|piste)/iu],
  ["cycling", /(bisiklet|cycling|bike tour|bikepacking)/iu],
  ["festival", /(festival|fest(?!\p{L})|konser|concert)/iu],
  ["birding", /(kuş gözlem|birding|birdwatch)/iu],
  ["nightlife", /(gece hayat|nightlife|kulüp|club(?!\p{L})|parti|party)/iu],
  ["stargazing", /(yıldız gözlem|stargaz|astro|kuzey ışık|northern lights|aurora)/iu],
  ["sailing", /(yelken|sailing|gulet|katamaran|catamaran|mavi yolculuk)/iu],
  ["road-trip", /(road ?trip|yol gezisi|araba ile tur|araçla tur)/iu],
];

/** The kinds of this trip: the playbook's, then the words of its name, its theme and its plan. Each once. */
export function tripKinds(trip: Pick<Trip, "title" | "intent" | "wants">, items: readonly Item[]): string[] {
  const kinds = new Set<string>();
  const pb = trip.intent?.playbook;
  if (pb === "festival") kinds.add("festival");
  if (pb === "ski") kinds.add("skiing");
  const text = [trip.title, trip.intent?.label, trip.intent?.custom?.label, ...items.map((i) => i.name)].filter(Boolean).join(" · ");
  for (const [kind, re] of KIND_WORDS) if (re.test(text)) kinds.add(kind);
  if (trip.wants?.stays?.includes("camp")) kinds.add("camping");
  // A car rented for days is a road trip; the hikes and camps out there want maps that work without a signal.
  if (items.some(isRental)) kinds.add("road-trip");
  if (["hiking", "camping", "road-trip", "skiing"].some((k) => kinds.has(k))) kinds.add("offline-maps");
  return [...kinds];
}

const storeSearch = (name: string): string => `https://www.google.com/search?q=${encodeURIComponent(`${name} app`)}`;

function appOf(table: PhoneTable, id: string, why: string, unsure = false, where: string[] = []): PhoneApp | null {
  const a = table.apps[id];
  if (!a) return null;
  return { key: id, name: a[0], why, ios: a[2], android: a[3], ai: false, search: a[2] || a[3] ? null : storeSearch(a[0]), where, unsure };
}

export interface PhoneInput {
  table: PhoneTable;
  /** The trip's countries, the main one first (usePrep's `countries`). */
  countries: string[];
  countryName: (code: string) => string;
  kinds: string[];
  /** Apps the plan itself suggests (ticketFrame.ts rideApps: "Uber"). */
  rides: string[];
  days: number;
  ai: TripPhone["ai"];
  hidden: readonly string[];
  lang: "tr" | "en";
}

/** The groups to draw: the countries' kinds in their order, then the trip's kinds, then the internet, then the AI's. */
export function phoneGroups(input: PhoneInput): PhoneGroup[] {
  const { table, kinds, hidden } = input;
  const countries = input.countries.filter((c) => table.countries[c]);
  const seen = new Set<string>();
  const take = (app: PhoneApp | null): PhoneApp | null => {
    if (!app || seen.has(app.key) || hidden.includes(app.key)) return null;
    seen.add(app.key);
    return app;
  };
  const groups: PhoneGroup[] = [];
  const many = countries.length > 1;
  for (const cat of CAT_ORDER) {
    const rows: PhoneApp[] = [];
    // The apps of this kind, the main country's first, each with the countries it's listed for.
    const byId = new Map<string, { why: string; where: string[]; unsure: boolean }>();
    for (const cc of countries) {
      for (const [id, why, c, verified] of table.countries[cc].a) {
        const kind = c ?? table.apps[id]?.[1];
        if (kind !== cat) continue;
        const had = byId.get(id);
        if (had) had.where.push(cc);
        else byId.set(id, { why, where: [cc], unsure: verified === 0 });
      }
    }
    for (const [id, v] of byId) {
      if (rows.length >= PER_CAT) break;
      const where = many && v.where.length < countries.length ? v.where.map(input.countryName) : [];
      const app = take(appOf(table, id, v.why, v.unsure, where));
      if (app) rows.push(app);
    }
    // The plan's ride apps (Uber for the airport taxi): first when the table lists them there; left out where the table
    // knows the country and doesn't (Uber left Thailand); with the plan's reason only where the table knows nothing.
    if (cat === "ride") {
      for (const name of input.rides) {
        const id = Object.keys(table.apps).find((k) => table.apps[k][0].toLocaleLowerCase("en") === name.toLocaleLowerCase("en")) ?? null;
        if (!id) continue;
        const at = rows.findIndex((r) => r.key === id);
        const listed = byId.get(id);
        if (at > 0) rows.unshift(...rows.splice(at, 1));
        else if (at < 0 && listed) {
          // Listed there but past the group's first ones: the plan wants it, so it comes first.
          const app = take(appOf(table, id, listed.why, listed.unsure));
          if (app) rows.unshift(app);
        } else if (at < 0 && countries.length === 0) {
          const app = take(appOf(table, id, L("Havalimanı yolu için önerdik; inince hazır olsun", "Suggested for the ride from the airport; have it ready when you land")));
          if (app) rows.unshift(app);
        }
      }
    }
    if (rows.length) groups.push({ key: cat, title: L(...CAT_TITLE[cat]), apps: rows });
  }
  for (const kind of kinds) {
    const k = table.intents[kind];
    if (!k) continue;
    const rows: PhoneApp[] = [];
    // The ones for this trip's countries first (YAMAP in Japan), then the world's.
    for (const [id, why, where] of k.r) if (where.some((c) => countries.includes(c))) {
      const app = take(appOf(table, id, why));
      if (app) rows.push(app);
    }
    for (const [id, why] of k.a) {
      if (rows.length >= PER_INTENT) break;
      const app = take(appOf(table, id, why));
      if (app) rows.push(app);
    }
    if (rows.length) groups.push({ key: `intent:${kind}`, title: L(`Gezine göre · ${k.n[0]}`, `For your trip · ${k.n[1]}`), apps: rows.slice(0, PER_INTENT + 1) });
  }
  // The internet: the providers that sell a local plan in every country of the trip (else in the main one).
  const main = countries[0];
  if (main) {
    const everywhere = Object.keys(table.esim).filter((p) => countries.every((c) => table.countries[c].e.includes(p)));
    const providers = everywhere.length ? everywhere : table.countries[main].e;
    const days = input.days > 0 ? input.days : null;
    const rows = providers
      .slice(0, PER_ESIM)
      .map((p): PhoneApp | null => {
        const e = table.esim[p];
        if (!e) return null;
        const why = days
          ? L(`${days} günlük paketi uygulamada seç; telefonun eSIM destekliyor olmalı`, `Pick a ${days}-day plan in the app; your phone needs eSIM`)
          : L("Paketi uygulamada seç; telefonun eSIM destekliyor olmalı", "Pick the plan in the app; your phone needs eSIM");
        return take({ key: `esim:${p}`, name: e[0], why, ios: e[1], android: e[2], ai: false, search: e[1] || e[2] ? null : storeSearch(e[0]), where: [], unsure: false });
      })
      .filter((a): a is PhoneApp => a != null);
    if (rows.length) groups.push({ key: "esim", title: L("İnternet (eSIM)", "Internet (eSIM)"), apps: rows });
  }
  // The AI's: in the board's language only, each once, none the table already has.
  const ai = input.ai && input.ai.lang === input.lang ? input.ai.list : [];
  const names = new Set([...seen].map((k) => (table.apps[k]?.[0] ?? k).toLocaleLowerCase("en")));
  const rows = ai
    .filter((a) => !names.has(a.name.toLocaleLowerCase("en")))
    .map((a) => take({ key: `ai:${a.name.toLocaleLowerCase("en")}`, name: a.name, why: a.why, ios: null, android: null, ai: true, search: storeSearch(a.name), where: [], unsure: false }))
    .filter((a): a is PhoneApp => a != null);
  if (rows.length) groups.push({ key: "ai", title: L("AI'ın önerdikleri · bu gezi için", "The AI's picks · for this trip"), apps: rows });
  return groups;
}

/** "1/7 kuruldu": the lines ticked of the lines drawn. */
export function phoneCount(groups: readonly PhoneGroup[], done: readonly string[]): { done: number; total: number } {
  const keys = groups.flatMap((g) => g.apps.map((a) => a.key));
  return { done: keys.filter((k) => done.includes(k)).length, total: keys.length };
}

/** The closed line's words: "Tayland · 6 uygulama + internet". */
export function phoneSub(countryNames: string[], groups: readonly PhoneGroup[]): string {
  const apps = groups.filter((g) => g.key !== "esim").reduce((n, g) => n + g.apps.length, 0);
  const net = groups.some((g) => g.key === "esim");
  const where = countryNames.slice(0, 2).join(", ") + (countryNames.length > 2 ? L(` +${countryNames.length - 2}`, ` +${countryNames.length - 2}`) : "");
  const what = apps ? L(`${apps} uygulama`, `${apps} apps`) + (net ? L(" + internet", " + internet") : "") : net ? L("internet", "internet") : "";
  return [where, what].filter(Boolean).join(" · ");
}

// --- the AI's lines ---------------------------------------------------------------------------------------------------

export const phoneAiSchema = z.object({
  apps: z.array(z.object({ name: z.string(), cat: z.string(), why: z.string() })),
});

export interface PhoneAiInput {
  countries: string[];
  cities: string[];
  kinds: string[];
  /** The trip in words: its kind, who goes, the money level ("Festival", "sevgiliyle", "ekonomik"). */
  about: string[];
  plan: string[];
  /** What the table already gives: never suggested again. */
  have: string[];
}

export const phoneAiSystemPrompt = (): string =>
  L(
    [
      "Bir gezgine telefonuna kurması gereken uygulamaları öneriyorsun. Ülke listesindeki temel uygulamalar (taksi, harita, mesaj, yemek, eSIM) zaten verildi; onları tekrar etme.",
      "Yalnız bu gezinin kendisine özel olanları öner: gezinin türü, plandaki etkinlikler, şehirler ve gezginin tarzı (ör. dalış gezisinde hava ve akıntı uygulaması, Japonya'da tren gezisinde bir aktarma uygulaması, festivalde festivalin resmi uygulaması, ekonomik gezide yerel indirim ya da hostel uygulaması).",
      "En fazla 5 uygulama. Yalnız gerçekten var olan, yaygın bilinen uygulamalar; emin değilsen önerme. Uydurma isim yok.",
      "name: uygulamanın mağazadaki adı. cat: ride, rail, transit, map, chat, food, pay, intent ya da other. why: neden bu gezi için gerekli, en çok 90 karakter, Türkçe.",
      "Önerecek bir şey yoksa boş liste döndür.",
    ].join("\n"),
    [
      "You suggest apps a traveller should install for a trip. The basic apps of the countries (rides, maps, messaging, food, eSIM) are given already: don't repeat them.",
      "Suggest only what this trip itself needs: its kind, the activities on the plan, the cities and how the traveller travels (a dive trip's weather and current app, a Japan rail trip's route planner, a festival's official app, a budget trip's local deals or hostel app).",
      "At most 5 apps. Only apps that really exist and are widely known; if unsure, leave it out. Never make up a name.",
      "name: the app's store name. cat: ride, rail, transit, map, chat, food, pay, intent or other. why: why this trip needs it, at most 90 characters, in English.",
      "If there's nothing to add, return an empty list.",
    ].join("\n"),
  );

export const phoneAiPrompt = (i: PhoneAiInput): string =>
  [
    `Countries: ${i.countries.join(", ") || "-"}`,
    `Cities: ${i.cities.join(", ") || "-"}`,
    `Trip kinds: ${i.kinds.join(", ") || "-"}`,
    `About the trip: ${i.about.join(", ") || "-"}`,
    `On the plan: ${i.plan.slice(0, 30).join("; ") || "-"}`,
    `Already suggested (don't repeat): ${i.have.join(", ") || "-"}`,
  ].join("\n");

/** The AI's answer kept: at most 5, names and reasons trimmed, none empty, none twice. */
export function acceptPhoneAi(out: unknown): { name: string; cat: string; why: string }[] | null {
  const parsed = phoneAiSchema.safeParse(out);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  return parsed.data.apps
    .map((a) => ({ name: a.name.trim().slice(0, 60), cat: a.cat.trim().toLowerCase(), why: a.why.trim().slice(0, 120) }))
    .filter((a) => a.name && a.why && !seen.has(a.name.toLocaleLowerCase("en")) && seen.add(a.name.toLocaleLowerCase("en")))
    .slice(0, 5);
}
