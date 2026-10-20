// Hazırlık's "Telefonuna kur" (0.39.7; 0.39.8 kısa liste, Emre: "çok fazla öneri olmuş, Mısır için 19 tane; sadece çok
// önemlilerini ve alakalılarını"): the apps to have on the phone for this trip. Three steps:
//   1. the table's candidates (static/data/country-apps.json, cut from the research in src/data/countryApps.json by
//      scripts/slim-country-apps.mjs): each country's apps, the trip's kinds' apps (hiking, diving, a festival), the plan's
//      ride app (an airport taxi's Uber), the eSIM providers;
//   2. the plan decides what's relevant (no AI): one app a kind and country; a train or bus app only with a train or bus
//      on the plan or two cities there; a town transit app only with two nights in a town; food only with a long stay;
//      paying only where foreign cards don't work; messaging only a local one (never WhatsApp); "other" never. At most
//      six, then one eSIM provider;
//   3. the AI (usePhoneAi), once per trip: picks and orders the six from the candidates with a reason in this trip's
//      words, and may add two the table doesn't know (labelled, a store search instead of a link: an address is never
//      made up). No key, an error, offline: step 2's list stands.
// The rest is kept under a folded "Diğer uygulamalar (N)".
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

export interface PhoneApp {
  /** The table's id, "ai:<name>" for the AI's, "esim:<provider>" for an eSIM provider. */
  key: string;
  name: string;
  /** Its kind: ride, rail, transit, map, chat, food, pay, other, intent:<kind>, esim, ai. */
  cat: string;
  why: string;
  ios: string | null;
  android: string | null;
  /** The AI's line: no store link, a search instead (`search`). */
  ai: boolean;
  search: string | null;
  /** The countries it's listed for, when the trip has more than one ("Tayland"). */
  where: string[];
  /** The table could not confirm it (the research's verified:false). */
  unsure: boolean;
  /** The kind's second app there, said on the line ("yedek: Careem"). */
  alt: string | null;
}

export interface PhoneGroup {
  key: string;
  title: string;
  apps: PhoneApp[];
}

export interface PhonePlan {
  /** The short list (at most MAIN), most important first. */
  main: PhoneApp[];
  /** One eSIM provider. */
  esim: PhoneApp | null;
  /** Everything else, by kind, folded under "Diğer uygulamalar". */
  more: PhoneGroup[];
  /** What the AI picks from (step 2's list and the next ones). */
  candidates: PhoneApp[];
}

/** Kept on the trip (Trip.phone): what's installed, what's not for me, and the AI's pick with its language. */
export interface TripPhone {
  done?: string[];
  hidden?: string[];
  ai?: {
    lang: string;
    at: number;
    /** 2: a pick from the candidates (0.39.8); without it (0.39.7) the AI's lines were extras only, and it's asked again. */
    v?: number;
    pick?: { key: string; why: string }[];
    /** The apps the table doesn't have (at most EXTRA are used). */
    list: { name: string; cat: string; why: string }[];
  } | null;
}

/** The short list's length (eSIM apart), and how many of it the AI may bring from outside the table. */
export const MAIN = 6;
const EXTRA = 2;
/** Kinds in their order of importance on a trip: getting around first. */
const ORDER = ["ride", "rail", "intent", "transit", "chat", "map", "pay", "food"];
const CAT_TITLE: Record<string, [string, string]> = {
  ride: ["Taksi ve araç çağırma", "Rides"],
  rail: ["Tren, otobüs, feribot", "Trains, buses, ferries"],
  transit: ["Şehir içi ulaşım", "Getting around town"],
  map: ["Harita", "Maps"],
  chat: ["Mesajlaşma", "Messaging"],
  food: ["Yemek", "Food"],
  pay: ["Ödeme", "Paying"],
  other: ["Diğer", "Other"],
  intent: ["Gezine göre", "For your trip"],
  esim: ["İnternet (eSIM)", "Internet (eSIM)"],
};
/** Apps everyone already has: not suggested (a local messenger is: LINE, KakaoTalk, WeChat). */
const EVERYONE_HAS = /^(whatsapp|telegram|messenger|facebook messenger|signal|google maps|gmail)$/i;
/** Where a foreign card doesn't get far and a local wallet is needed. */
const WALLET_COUNTRIES = new Set(["CN"]);
/** eSIM providers in the order shown (one is). */
const ESIM_ORDER = ["airalo", "yesim", "holafly"];
const FOOD_NIGHTS = 5;
const TOWN_NIGHTS = 2;

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
  if (items.some(isRental)) kinds.add("road-trip");
  if (["hiking", "camping", "road-trip", "skiing"].some((k) => kinds.has(k))) kinds.add("offline-maps");
  return [...kinds];
}

/** What the plan says about how the trip is lived: its stays (city, country, nights) and whether it moves by train or bus. */
export interface TripShape {
  stays: { city: string; country: string | null; nights: number }[];
  /** A train, bus, minibus or ferry on the plan. */
  moves: boolean;
}

const live = (i: Item) => i.status !== "dismissed" && !i.cancelledAt;
const dayMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const MOVE_WORDS = /(tren|train|otobüs|otobus|bus(?!\p{L})|feribot|ferry|minibüs|minibus|shinkansen)/iu;

export function tripShape(items: readonly Item[]): TripShape {
  const stays = items
    .filter((i) => live(i) && i.category === "stay" && i.city?.trim())
    .map((i) => ({
      city: i.city!.trim(),
      country: i.countryCode?.toUpperCase() ?? null,
      nights: i.dates.start && i.dates.end ? Math.max(0, Math.round((dayMs(i.dates.end) - dayMs(i.dates.start)) / 864e5)) : 0,
    }));
  const moves = items.some(
    (i) => live(i) && i.category === "transport" && (["train", "bus", "minibus", "ferry"].includes(i.plannedKind ?? "") || (!i.plannedKind && MOVE_WORDS.test(i.name))),
  );
  return { stays, moves };
}

const storeSearch = (name: string): string => `https://www.google.com/search?q=${encodeURIComponent(`${name} app`)}`;
const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "");

function appOf(table: PhoneTable, id: string, cat: string, why: string, unsure = false, where: string[] = []): PhoneApp | null {
  const a = table.apps[id];
  if (!a) return null;
  return { key: id, name: a[0], cat, why, ios: a[2], android: a[3], ai: false, search: a[2] || a[3] ? null : storeSearch(a[0]), where, unsure, alt: null };
}

export interface PhoneInput {
  table: PhoneTable;
  /** The trip's countries, the main one first (usePrep's `countries`). */
  countries: string[];
  countryName: (code: string) => string;
  kinds: string[];
  shape: TripShape;
  /** Apps the plan itself suggests (ticketFrame.ts rideApps: "Uber"). */
  rides: string[];
  days: number;
  ai: TripPhone["ai"];
  hidden: readonly string[];
  lang: "tr" | "en";
}

/** Whether a kind of app is relevant in a country on this trip (step 2). */
function relevant(cat: string, cc: string, shape: TripShape, onlyCountry: boolean): boolean {
  const here = shape.stays.filter((s) => s.country === cc || (onlyCountry && s.country == null));
  switch (cat) {
    case "ride":
    case "map":
    case "chat": // (the ones everyone has are left out by name)
      return true;
    case "rail":
      return shape.moves || new Set(here.map((s) => norm(s.city))).size >= 2;
    case "transit":
      return here.some((s) => s.nights >= TOWN_NIGHTS);
    case "food":
      return here.some((s) => s.nights >= FOOD_NIGHTS);
    case "pay":
      return WALLET_COUNTRIES.has(cc);
    default:
      return false;
  }
}

/** The short list, the eSIM and the rest (steps 1 and 2, then the AI's pick when there is one). */
export function phonePlan(input: PhoneInput): PhonePlan {
  const { table, kinds, hidden, shape } = input;
  const countries = input.countries.filter((c) => table.countries[c]);
  const onlyCountry = countries.length === 1;
  const many = countries.length > 1;
  const all = new Map<string, PhoneApp>(); // every candidate, for "Diğer"
  const remember = (app: PhoneApp | null): PhoneApp | null => {
    if (!app || hidden.includes(app.key)) return null;
    const had = all.get(app.key);
    if (had) {
      for (const w of app.where) if (!had.where.includes(w)) had.where.push(w);
      return had;
    }
    all.set(app.key, app);
    return app;
  };

  // Each country's apps by kind: the first relevant one is on the list, the rest go to "Diğer".
  const perCat = new Map<string, PhoneApp[]>();
  const push = (cat: string, app: PhoneApp) => {
    const list = perCat.get(cat) ?? [];
    if (!list.includes(app)) list.push(app);
    perCat.set(cat, list);
  };
  for (const cc of countries) {
    const byCat = new Map<string, [string, string, number][]>();
    for (const [id, why, c, verified] of table.countries[cc].a) {
      const cat = c ?? table.apps[id]?.[1] ?? "other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push([id, why, verified]);
    }
    for (const [cat, rows] of byCat) {
      const usable = rows.filter(([id]) => !EVERYONE_HAS.test(table.apps[id]?.[0] ?? ""));
      // A town's transit app: the one naming a town the trip stays in, else the first.
      if (cat === "transit") {
        const towns = shape.stays.filter((s) => s.country === cc || onlyCountry).map((s) => norm(s.city));
        const names = (why: string) => towns.some((t) => norm(why).includes(t));
        usable.sort((a, b) => Number(names(b[1])) - Number(names(a[1])));
      }
      const isRelevant = relevant(cat, cc, shape, onlyCountry);
      usable.forEach(([id, why, verified], n) => {
        const app = remember(appOf(table, id, cat, why, verified === 0, many ? [input.countryName(cc)] : []));
        if (!app) return;
        if (n === 0 && isRelevant) {
          if (cat === "ride" && usable[1] && !app.alt) app.alt = table.apps[usable[1][0]]?.[0] ?? null;
          push(cat, app);
        }
      });
    }
  }
  // The plan's ride app (an airport taxi's Uber): first where the table lists it there; left out where the table knows
  // the country and doesn't list it (Uber left Thailand); with the plan's reason only where the table knows no country.
  for (const name of input.rides) {
    const id = Object.keys(table.apps).find((k) => table.apps[k][0].toLocaleLowerCase("en") === name.toLocaleLowerCase("en"));
    if (!id) continue;
    const rides = perCat.get("ride") ?? [];
    const listed = all.get(id);
    const at = rides.indexOf(listed as PhoneApp);
    if (listed && at > 0) rides.unshift(...rides.splice(at, 1));
    else if (listed && at < 0) {
      const was = rides.shift();
      if (was) listed.alt = was.name;
      rides.unshift(listed);
    } else if (!listed && countries.length === 0) {
      const app = remember(appOf(table, id, "ride", L("Havalimanı yolu için önerdik; inince hazır olsun", "Suggested for the ride from the airport; have it ready when you land")));
      if (app) rides.unshift(app);
    }
    perCat.set("ride", rides);
  }
  // The trip's kinds: at most two on the list, one app each (a country's own first: YAMAP in Japan).
  let kindsOn = 0;
  for (const kind of kinds) {
    const k = table.intents[kind];
    if (!k) continue;
    const local = k.r.filter(([, , where]) => where.some((c) => countries.includes(c))).map(([id, why]) => [id, why] as [string, string]);
    let first = true;
    for (const [id, why] of [...local, ...k.a]) {
      const app = remember(appOf(table, id, `intent:${kind}`, why));
      if (!app) continue;
      if (first && kindsOn < 2) {
        push("intent", app);
        kindsOn++;
      }
      first = false;
    }
  }
  const chosen: PhoneApp[] = [];
  for (const cat of ORDER) for (const app of perCat.get(cat) ?? []) if (!chosen.includes(app)) chosen.push(app);

  // The AI's pick, when made in this language (0.39.8): its order and words, from the candidates only; plus its own.
  const ai = input.ai && input.ai.lang === input.lang && input.ai.v === 2 ? input.ai : null;
  let main = chosen.slice(0, MAIN);
  if (ai?.pick?.length) {
    const fromAi = ai.pick
      .map((p) => {
        const a = all.get(p.key);
        return a ? { ...a, why: p.why.trim() || a.why } : null;
      })
      .filter((a): a is PhoneApp => a != null);
    if (fromAi.length) main = fromAi;
  }
  if (ai) {
    const names = new Set([...all.values()].map((a) => a.name.toLocaleLowerCase("en")));
    const extras = ai.list
      .filter((a) => !names.has(a.name.toLocaleLowerCase("en")))
      .slice(0, EXTRA)
      .map((a): PhoneApp => ({ key: `ai:${a.name.toLocaleLowerCase("en")}`, name: a.name, cat: "ai", why: a.why, ios: null, android: null, ai: true, search: storeSearch(a.name), where: [], unsure: false, alt: null }))
      .filter((a) => !hidden.includes(a.key));
    main = [...main.slice(0, MAIN - extras.length), ...extras];
  }
  main = main.filter((a, i) => main.findIndex((b) => b.key === a.key) === i).slice(0, MAIN);

  // One eSIM provider: one that sells a local plan in every country of the trip (else in the main one).
  let esim: PhoneApp | null = null;
  const home = countries[0];
  if (home) {
    const everywhere = ESIM_ORDER.filter((p) => table.esim[p] && countries.every((c) => table.countries[c].e.includes(p)));
    const providers = everywhere.length ? everywhere : ESIM_ORDER.filter((p) => table.esim[p] && table.countries[home].e.includes(p));
    const p = providers.find((x) => !hidden.includes(`esim:${x}`));
    if (p) {
      const e = table.esim[p];
      const days = input.days > 0 ? input.days : null;
      const why = days
        ? L(`${days} günlük paketi uygulamada seç; telefonun eSIM destekliyor olmalı`, `Pick a ${days}-day plan in the app; your phone needs eSIM`)
        : L("Paketi uygulamada seç; telefonun eSIM destekliyor olmalı", "Pick the plan in the app; your phone needs eSIM");
      esim = { key: `esim:${p}`, name: e[0], cat: "esim", why, ios: e[1], android: e[2], ai: false, search: e[1] || e[2] ? null : storeSearch(e[0]), where: [], unsure: false, alt: null };
    }
  }

  // The rest, by kind, each once.
  const shown = new Set(main.map((a) => a.key));
  const groups = new Map<string, PhoneApp[]>();
  for (const a of all.values()) {
    if (shown.has(a.key)) continue;
    const g = a.cat.startsWith("intent:") ? "intent" : a.cat;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(a);
  }
  const more = [...ORDER, "other"]
    .filter((g) => groups.has(g))
    .map((g) => ({ key: g, title: L(...(CAT_TITLE[g] ?? CAT_TITLE.other)), apps: groups.get(g)! }));
  // The AI's candidates: the list, then the rest of the relevant kinds' runners-up, in order.
  const candidates = [...chosen, ...[...all.values()].filter((a) => !chosen.includes(a) && a.cat !== "other")].slice(0, 24);
  return { main, esim, more, candidates };
}

/** "1/6 kuruldu": the short list and the eSIM. */
export function phoneCount(plan: Pick<PhonePlan, "main" | "esim">, done: readonly string[]): { done: number; total: number } {
  const keys = [...plan.main.map((a) => a.key), ...(plan.esim ? [plan.esim.key] : [])];
  return { done: keys.filter((k) => done.includes(k)).length, total: keys.length };
}

/** The closed line's words: "Mısır · 5 uygulama + internet". */
export function phoneSub(countryNames: string[], plan: Pick<PhonePlan, "main" | "esim">): string {
  const apps = plan.main.length;
  const where = countryNames.slice(0, 2).join(", ") + (countryNames.length > 2 ? ` +${countryNames.length - 2}` : "");
  const what = apps ? L(`${apps} uygulama`, `${apps} apps`) + (plan.esim ? " + internet" : "") : plan.esim ? "internet" : "";
  return [where, what].filter(Boolean).join(" · ");
}

/** A line's small kind label ("Taksi ve araç çağırma", "Doğa yürüyüşü", "AI'ın önerisi"). */
export function kindTitle(cat: string, table: PhoneTable | null): string {
  if (cat === "ai") return L("AI'ın önerisi", "The AI's pick");
  if (cat.startsWith("intent:")) {
    const k = table?.intents[cat.slice(7)];
    return k ? L(k.n[0], k.n[1]) : L(...CAT_TITLE.intent);
  }
  return L(...(CAT_TITLE[cat] ?? CAT_TITLE.other));
}

// --- the AI's pick ----------------------------------------------------------------------------------------------------

export const phoneAiSchema = z.object({
  pick: z.array(z.object({ key: z.string(), why: z.string() })),
  extra: z.array(z.object({ name: z.string(), cat: z.string(), why: z.string() })),
});

export interface PhoneAiInput {
  countries: string[];
  cities: string[];
  kinds: string[];
  /** The trip in words: its kind, who goes, the money level. */
  about: string[];
  plan: string[];
  /** The candidates: key, name, kind, the table's reason. */
  candidates: { key: string; name: string; cat: string; why: string }[];
}

export const phoneAiSystemPrompt = (): string =>
  L(
    [
      `Bir gezginin telefonuna kurması gereken uygulamaları seçiyorsun. Sana aday listesi veriyorum (key, ad, tür, neden). Bu gezi için en önemli ve en alakalı en çok ${MAIN} tanesini önem sırasıyla seç.`,
      "Gezinin şehirlerine, planına, türüne ve gezginin tarzına bak: planda olmayan bir şeyin uygulamasını seçme, aynı işi gören iki uygulamayı seçme, herkesin zaten telefonunda olanı seçme, yerel banka hesabı ya da yerel telefon numarası isteyeni seçme.",
      "pick: seçtiklerin, yalnız listedeki key ile; why: bu gezi için neden, en çok 80 karakter, gezinin kendi sözleriyle (ör. \"Luxor treni planında\", \"Kahire'de 3 gece\").",
      `extra: listede olmayan ama bu gezi için gerçekten gerekli en çok ${EXTRA} uygulama (gerçekten var olan, yaygın bilinen; emin değilsen ekleme). cat: ride, rail, transit, map, chat, food, pay, intent ya da other.`,
      "Az ama doğru: gereksizse daha az seç.",
    ].join("\n"),
    [
      `You pick the apps a traveller should install. I give you candidates (key, name, kind, reason). Pick at most ${MAIN}, the most important and relevant for this trip, in order of importance.`,
      "Look at the trip's cities, plan, kind and how the traveller travels: no app for something not on the plan, never two apps doing the same job, nothing everyone already has, nothing that needs a local bank account or phone number.",
      "pick: the chosen ones, by the list's key only; why: why this trip needs it, at most 80 characters, in the trip's own terms (\"the Luxor train is on your plan\", \"3 nights in Cairo\").",
      `extra: at most ${EXTRA} apps not in the list that this trip really needs (real, widely known; if unsure, none). cat: ride, rail, transit, map, chat, food, pay, intent or other.`,
      "Fewer and right: pick fewer if the rest aren't needed.",
    ].join("\n"),
  );

export const phoneAiPrompt = (i: PhoneAiInput): string =>
  [
    `Countries: ${i.countries.join(", ") || "-"}`,
    `Cities: ${i.cities.join(", ") || "-"}`,
    `Trip kinds: ${i.kinds.join(", ") || "-"}`,
    `About the trip: ${i.about.join(", ") || "-"}`,
    `On the plan: ${i.plan.slice(0, 30).join("; ") || "-"}`,
    "Candidates:",
    ...i.candidates.map((c) => `- ${c.key} | ${c.name} | ${c.cat} | ${c.why}`),
  ].join("\n");

/** The AI's answer kept: picks only from the candidates, each once, at most MAIN; extras at most EXTRA. */
export function acceptPhoneAi(out: unknown, keys: readonly string[]): { pick: { key: string; why: string }[]; list: { name: string; cat: string; why: string }[] } | null {
  const parsed = phoneAiSchema.safeParse(out);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const pick = parsed.data.pick
    .map((p) => ({ key: p.key.trim(), why: p.why.trim().slice(0, 100) }))
    .filter((p) => keys.includes(p.key) && !seen.has(p.key) && seen.add(p.key))
    .slice(0, MAIN);
  const names = new Set<string>();
  const list = parsed.data.extra
    .map((a) => ({ name: a.name.trim().slice(0, 60), cat: a.cat.trim().toLowerCase(), why: a.why.trim().slice(0, 100) }))
    .filter((a) => a.name && a.why && !names.has(a.name.toLocaleLowerCase("en")) && names.add(a.name.toLocaleLowerCase("en")))
    .slice(0, EXTRA);
  return { pick, list };
}
