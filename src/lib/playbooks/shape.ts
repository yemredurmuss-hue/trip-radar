// Gezi biçimi (v82 geçişi spec §1.4; v83 "Gezi biçimi ve omurga", docs/mockups/plan-v83-turler/turler.html): the Plan
// doesn't know a trip's kind by its name, it reads the trip's shape. Eleven signals say it (where the nights are spent, a
// package, a pass or a rented car, a moving base, the nearest airport, a right for each day, the focus, gear, papers and
// health, who goes, the time), each on the trip record as it already is or in the playbook's optional fields; nothing new
// is stored apart. A familiar kind (a festival, a ski week, a liveaboard…) is only a ready mix of those signals: it gives
// the defaults, and what the model writes for the trip wins. A trip the code has no name for is made the same way from
// the model's signals alone; with none, only what is certain is made (the flights, a stay per run of nights, the papers).
//
// Here: the eleven mixes, the signals of a trip (`signalsOf`), its resolved shape (`shapeOf`), the parts a mix opens for
// the four kinds the model names as its nearest (a liveaboard, a day out, a business trip, a safari), and the words a
// covered box says ("Dahil · festival biletiyle", "Festival biletini aç"). Pure.
import { L } from "../i18n";
import { capitalize } from "../i18nText";
import type { CustomCard, CustomPlaybook, GroundWay, ItemPart, PartSection, PlaybookKind, ShapePreset, Trip } from "../types";
import type { PbQuestion } from "./questions";

/** The eleven mixes in the order the design lists them. */
export const SHAPE_PRESETS: readonly ShapePreset[] = ["festival", "dive", "ski", "wellness", "cruise", "road", "day", "business", "safari", "honeymoon", "classic"];
export const isShapePreset = (v: unknown): v is ShapePreset => typeof v === "string" && (SHAPE_PRESETS as readonly string[]).includes(v);

/** Where the nights are spent (CustomPlaybook.stayType). */
export type SleepAt = CustomPlaybook["stayType"];
export const SLEEP_TYPES: readonly SleepAt[] = ["hotel", "boat", "camp", "cabin", "vehicle", "none"];

/** The eleven signals (v83 "Sinyaller"), in the design's order. */
export type SignalId = "sleep" | "package" | "pass" | "movingBase" | "gateway" | "perDay" | "focus" | "gear" | "papers" | "who" | "time";
export const SIGNAL_IDS: readonly SignalId[] = ["sleep", "package", "pass", "movingBase", "gateway", "perDay", "focus", "gear", "papers", "who", "time"];

/**
 * When a category's short line (kısa bilgi satırı) is true of the trip as it stands: a box another one covers is there
 * ("covered"), the trip has nights of the shape's own kind ("own": the boat, the camp, the cabin), a box the shape opened
 * is there ("parts"), the shape's focus keeps other suggestions away ("focus"), the category is closed by it ("closed").
 */
export type InfoWhen = "covered" | "own" | "parts" | "focus" | "closed";

interface Mix {
  sleep: SleepAt;
  focus: "only" | "around";
  movingBase?: boolean;
  /** The part that is a right for each day of the stay. */
  perDay?: string;
  /** The categories' short lines (v83 türler INFO), each with when it holds. */
  info?: Partial<Record<PartSection, { when: InfoWhen; text: () => string }>>;
  /** Who goes, when the mix says it (a honeymoon: two; a business trip: one). */
  who?: "solo" | "couple" | "family" | "group";
  /** A category the mix closes ("Gerek yok"), with its reason. */
  closes?: Partial<Record<PartSection, () => string>>;
}

/** The ready mixes (v83 türler: SIG and INFO). Only the defaults: a trip's own signals win. */
export const MIXES: Readonly<Record<ShapePreset, Mix>> = {
  festival: {
    sleep: "camp",
    focus: "only",
    info: {
      stay: { when: "covered", text: () => L("Festival gezisi: festival günlerinde konaklama bilete dahil kamp olarak kuruldu, otel aranmaz.", "Festival trip: on the festival days you stay in the camp the ticket includes, no hotel to look for.") },
      activity: { when: "focus", text: () => L("Odak festival: başka tur ve etkinlik önerilmez.", "The festival is the focus: no other tours or activities are suggested.") },
    },
  },
  dive: {
    sleep: "boat",
    focus: "only",
    info: { stay: { when: "own", text: () => L("Dalış teknesi: konaklama, yemek ve dalışlar tekne paketinde; otel aranmaz.", "Liveaboard: the nights, the meals and the dives are in the boat's package, no hotel to look for.") } },
  },
  ski: {
    sleep: "hotel",
    focus: "around",
    perDay: "pass",
    info: { activity: { when: "parts", text: () => L("Kayak: skipass konaklama günleri boyunca; ekipman ve okul cevabına göre açılır.", "Ski trip: the ski pass covers the days of the stay; gear and lessons follow your answers.") } },
  },
  wellness: {
    sleep: "hotel",
    focus: "only",
    info: { stay: { when: "covered", text: () => L('Retreat: program konaklamayı ve transferi kapsıyorsa onlar "Dahil" olur.', 'Retreat: when the programme includes the stay and the transfer, they are "Included".') } },
  },
  cruise: {
    sleep: "cabin",
    focus: "around",
    movingBase: true,
    info: { transport: { when: "own", text: () => L("Kruvaziyer: limanlar arası yolculuk kabine dahil; yalnız limana transfer karar ister.", "Cruise: sailing between the ports comes with the cabin; only the transfer to the port is yours to decide.") } },
  },
  road: {
    sleep: "hotel",
    focus: "around",
    movingBase: true,
    info: { transport: { when: "covered", text: () => L("Yol gezisi: kiralık araç şehirler arası yolculukları kapsar.", "Road trip: the rental car covers the drives between the cities.") } },
  },
  day: {
    sleep: "none",
    focus: "around",
    info: { stay: { when: "closed", text: () => L("Günübirlik: aynı gün dönüş, konaklama kapandı.", "Day trip: back the same day, so no stay.") } },
    closes: { stay: () => L("aynı gün dönüş", "back the same day") },
  },
  business: { sleep: "hotel", focus: "around", who: "solo" },
  safari: {
    sleep: "camp",
    focus: "around",
    info: { stay: { when: "own", text: () => L("Safari: işletilen kamp rezervasyon ister; kendiliğinden alındı sayılmaz.", "Safari: a run camp takes a booking; it never counts as booked by itself.") } },
  },
  honeymoon: {
    sleep: "hotel",
    focus: "around",
    who: "couple",
    info: { transport: { when: "parts", text: () => L('Resort transferi çoğu zaman pakette; onay sayfası söylerse "Dahil" olur.', 'The resort transfer is often in the package; when the confirmation says so it is "Included".') } },
  },
  classic: { sleep: "hotel", focus: "around" },
};

// --- the parts the four kinds the model names as its nearest open (their skeleton, as a model-made playbook's) ----------

/** A card of a ready mix, said the way the model says its own. */
const part = (c: Omit<CustomCard, "place"> & { place?: string | null }): CustomCard => ({ place: null, ...c });

/**
 * The cards a mix with no playbook of its own opens when the model gives none (dive, day, business, safari), in the
 * language now. The built-in kinds open their own skeleton (playbooks/festival.ts…).
 */
export function mixCards(preset: ShapePreset): CustomCard[] {
  switch (preset) {
    case "dive":
      return [
        part({ ref: "transfer", kind: "transfer", title: L("Limana transfer", "Transfer to the marina"), anchor: "arrive", section: "transport", frame: "ticket", word: L("Transfer", "Transfer"), by: "stay" }),
        part({ ref: "dives", kind: "activity", title: L("Dalışlar · günde 3–4 dalış", "Dives · 3–4 a day"), anchor: "stay", section: "activity", frame: "collection", word: L("Dalış", "Dive"), pick: "multi", by: "stay" }),
        part({ ref: "gear", kind: "activity", title: L("Dalış ekipmanı kiralama", "Dive gear rental"), anchor: "stay", section: "todo", frame: "stay", word: L("Ekipman", "Gear"), pick: "single" }),
        part({ ref: "insurance", kind: "insurance", title: L("Dalış sigortası", "Dive insurance"), anchor: "arrive", section: "other", frame: "stay", word: L("Sigorta", "Insurance") }),
      ];
    case "business":
      return [
        part({ ref: "transfer", kind: "transfer", title: L("Havalimanı → otel", "Airport → hotel"), anchor: "arrive", section: "transport", frame: "ticket", word: L("Transfer", "Transfer") }),
        part({ ref: "fair", kind: "activity", title: L("Fuar bileti", "Trade fair ticket"), anchor: "stay", section: "activity", frame: "collection", word: L("Fuar", "Fair"), pick: "multi" }),
        part({ ref: "meetings", kind: "todo", title: L("Toplantılar", "Meetings"), anchor: "stay", section: "todo", frame: "collection", word: L("Toplantı", "Meeting"), pick: "multi" }),
      ];
    case "safari":
      return [
        part({ ref: "hop", kind: "transfer", title: L("Küçük uçakla kampa", "Light aircraft to the camp"), anchor: "arrive", section: "transport", frame: "ticket", word: L("Uçuş", "Flight") }),
        part({ ref: "drives", kind: "activity", title: L("Safari (game drive)", "Safari game drives"), anchor: "stay", section: "activity", frame: "stay", word: "Safari", pick: "single", by: "stay" }),
        part({ ref: "health", kind: "other", title: L("Sarıhumma aşı kartı", "Yellow fever vaccination card"), anchor: "arrive", section: "other", frame: "stay", word: L("Sağlık", "Health") }),
      ];
    default:
      return [];
  }
}

/** The questions such a mix asks when the model gives none (a liveaboard: your own gear?). */
export function mixQuestions(preset: ShapePreset): PbQuestion[] {
  if (preset !== "dive") return [];
  return [
    {
      id: "gear",
      text: { tr: "Kendi ekipmanın var mı?", en: "Do you have your own gear?" },
      chips: [
        { value: "own", label: { tr: "Var", en: "Yes" }, aliases: ["var", "kendi", "own", "mine"], effects: [{ op: "dropCard", card: "gear" }] },
        { value: "rent", label: { tr: "Kiralayacağım", en: "I'll rent" }, aliases: ["kira", "rent", "hire"], effects: [] },
      ],
    },
  ];
}

/** The preparation list such a mix gives when the model gives none. */
export function mixPrep(preset: ShapePreset): string[] {
  switch (preset) {
    case "dive":
      return [L("Dalış sertifikası", "Dive certification card"), L("Log book", "Logbook"), L("Deniz tutması ilacı", "Seasickness tablets")];
    case "business":
      return [L("Kartvizit", "Business cards"), L("Fatura bilgileri", "Invoice details")];
    case "safari":
      return [L("Sıtma ilacı", "Malaria tablets"), L("Nötr renkli kıyafet", "Neutral-coloured clothes"), L("Dürbün", "Binoculars")];
    default:
      return [];
  }
}

// --- a card as a part ----------------------------------------------------------------------------------------------

/**
 * The part a card stands for (its gezi biçimi fields). Every card a playbook opens is one, even with none of them said:
 * a thing to book of the trip's shape, never an idea ticked off by its day (H1); its category then goes by its kind.
 */
export function partOfCard(c: Pick<CustomCard, "ref" | "section" | "frame" | "word" | "pick" | "covers" | "by">): ItemPart {
  const out: ItemPart = { ref: c.ref };
  if (c.section) out.section = c.section;
  if (c.frame) out.frame = c.frame;
  if (c.word) out.word = c.word;
  if (c.pick) out.pick = c.pick;
  if (c.by) out.by = c.by;
  if (c.covers?.length) out.covers = [...c.covers];
  return out;
}

// --- the trip's shape ----------------------------------------------------------------------------------------------

export interface TripShape {
  /** The mix it is read with: the kind's own, the model's nearest, else classic. */
  preset: ShapePreset;
  sleep: SleepAt;
  gateway: string | null;
  movingBase: boolean;
  perDay: string | null;
  focus: "only" | "around";
  who: Mix["who"] | null;
  /** The categories' short lines, in the language now, each with when it holds. */
  info: Partial<Record<PartSection, { when: InfoWhen; text: string }>>;
  /** The categories the shape closes, with the reason ("aynı gün dönüş"). */
  closes: Partial<Record<PartSection, string>>;
}

const BUILT_IN: readonly PlaybookKind[] = ["festival", "ski", "honeymoon", "wellness", "cruise", "road", "classic"];

/** The way there by land, in a word ("otobüsle"). */
const WAY_WORDS: Readonly<Record<GroundWay, () => string>> = {
  bus: () => L("otobüsle", "by bus"),
  train: () => L("trenle", "by train"),
  ferry: () => L("vapurla", "by ferry"),
  car: () => L("arabayla", "by car"),
};

/**
 * The trip's shape as the Plan reads it: a built-in kind's mix, or the model's playbook over its nearest mix (each of its
 * signals wins where it says one), with what the start read of the time and the way (a day out closes Konaklama, a way
 * there by land closes Uçuş: D4). A trip with no kind is classic: hotels, nothing covered, nothing closed.
 */
export function shapeOf(trip: Pick<Trip, "intent" | "startGuide"> | null | undefined): TripShape {
  const intent = trip?.intent ?? null;
  const custom = intent?.playbook === "custom" ? (intent.custom ?? null) : null;
  // The start's road mode is a road trip whatever kind was read (its car covers the drives).
  const kind: ShapePreset = custom ? custom.base : intent && (BUILT_IN as readonly string[]).includes(intent.playbook) ? (intent.playbook as ShapePreset) : "classic";
  const preset: ShapePreset = kind === "classic" && trip?.startGuide?.road ? "road" : kind;
  const mix = MIXES[preset];
  const info: TripShape["info"] = {};
  for (const [k, v] of Object.entries(mix.info ?? {}) as [PartSection, NonNullable<Mix["info"]>[PartSection]][]) if (v) info[k] = { when: v.when, text: v.text() };
  // The model's own lines are about this trip: they hold wherever a box of its shape stands.
  for (const [k, text] of Object.entries(custom?.info ?? {}) as [PartSection, string][]) if (text) info[k] = { when: "parts", text };
  const guide = trip?.startGuide ?? null;
  const sleep = guide?.dayTrip ? "none" : (custom?.stayType ?? mix.sleep);
  const closes: TripShape["closes"] = {};
  for (const [k, v] of Object.entries(mix.closes ?? {}) as [PartSection, () => string][]) closes[k] = v();
  if (sleep === "none" && !closes.stay) {
    closes.stay = L("aynı gün dönüş", "back the same day");
    info.stay ??= { when: "closed", text: MIXES.day.info!.stay!.text() };
  }
  if (guide?.way) {
    const word = WAY_WORDS[guide.way]();
    closes.flight = word;
    info.flight ??= { when: "closed", text: L(`${capitalize(word)} gidiliyor; uçuş aranmaz.`, `Going ${word}: no flights to look for.`) };
  }
  return {
    preset,
    sleep,
    gateway: custom?.gateway ?? null,
    movingBase: custom?.movingBase ?? mix.movingBase ?? false,
    perDay: custom?.perDay ?? mix.perDay ?? null,
    focus: custom?.focus ?? mix.focus,
    who: mix.who ?? null,
    info,
    closes,
  };
}

/** One signal as the trip has it: its value in short, or null when the trip doesn't say it. */
export interface Signal {
  id: SignalId;
  value: string | null;
}

/**
 * The eleven signals of a trip (the design's "sinyal çipleri"), from its shape and its records' parts: where the nights
 * are spent, what a package covers, what a pass or a car covers, a moving base, the nearest airport, a right for each
 * day, the focus, gear to rent, papers and health, who goes, the time.
 */
export function signalsOf(trip: Pick<Trip, "intent" | "travellers" | "confirmedDates">, parts: readonly ItemPart[] = []): Signal[] {
  const s = shapeOf(trip);
  const covering = parts.filter((p) => p.covers?.length);
  const pkg = covering.filter((p) => !p.covers!.includes("legs")).map((p) => p.ref);
  const pass = covering.filter((p) => p.covers!.includes("legs")).map((p) => p.ref);
  const gear = parts.filter((p) => /gear|rental|ekipman/i.test(p.ref)).map((p) => p.ref);
  const papers = parts.filter((p) => p.section === "other").map((p) => p.ref);
  const n = trip.travellers?.count ?? trip.travellers?.names.length ?? null;
  const who = s.who ?? (n === 1 ? "solo" : n === 2 ? "couple" : n && n > 2 ? "group" : null);
  const dates = trip.confirmedDates;
  const time = s.sleep === "none" || (dates && dates.start === dates.end) ? "day" : dates ? null : "undated";
  const v = (x: string | null | undefined | false) => (x ? x : null);
  return [
    { id: "sleep", value: s.sleep },
    { id: "package", value: v(pkg.join(", ")) },
    { id: "pass", value: v(pass.join(", ")) },
    { id: "movingBase", value: s.movingBase ? "yes" : null },
    { id: "gateway", value: s.gateway },
    { id: "perDay", value: s.perDay },
    { id: "focus", value: s.focus === "only" ? "only" : null },
    { id: "gear", value: v(gear.join(", ")) },
    { id: "papers", value: v(papers.join(", ")) },
    { id: "who", value: who },
    { id: "time", value: time },
  ];
}

// --- what a covered box says --------------------------------------------------------------------------------------

/** How a covering part is said, by its ref: "Dahil · festival biletiyle", "Festival biletini aç". */
const COVER_WORDS: Readonly<Record<string, () => { by: string; open: string }>> = {
  ticket: () => ({ by: L("festival biletiyle", "with the festival ticket"), open: L("Festival biletini aç", "Open the festival ticket") }),
  programme: () => ({ by: L("retreat programıyla", "with the retreat programme"), open: L("Programı aç", "Open the programme") }),
  car: () => ({ by: L("kiralık araçla", "with the rental car"), open: L("Aracı aç", "Open the car") }),
  cabin: () => ({ by: L("kabinle", "with the cabin"), open: L("Kabini aç", "Open the cabin") }),
};
/** The nights that cover a box ("stay"), by the kind of nights they are. */
const STAY_COVER: Readonly<Partial<Record<SleepAt, () => { by: string; open: string }>>> = {
  boat: () => ({ by: L("tekne paketiyle", "in the boat's package"), open: L("Tekneyi aç", "Open the boat") }),
  camp: () => ({ by: L("lodge paketiyle", "in the lodge's package"), open: L("Kampı aç", "Open the camp") }),
  cabin: () => ({ by: L("kabinle", "with the cabin"), open: L("Kabini aç", "Open the cabin") }),
  hotel: () => ({ by: L("resort paketiyle", "in the resort's package"), open: L("Konaklamayı aç", "Open the stay") }),
};

/**
 * The words of a box another one covers: "festival biletiyle" and its button "Festival biletini aç"; the nights it sits in
 * by their kind ("tekne paketiyle", "kabinle"); a pass by its own name ("Hakone Free Pass ile", "Pass'i aç"); a rented
 * car "kiralık araçla"; anything else by its name.
 */
export function coverWords(coverer: { part?: ItemPart | null; name: string } | null, as: { sleep?: SleepAt; pass?: boolean; rental?: boolean } = {}): { by: string; open: string } {
  const ref = coverer?.part?.ref ?? null;
  if (ref === "stay" || !coverer) return (STAY_COVER[as.sleep ?? "hotel"] ?? STAY_COVER.hotel!)();
  if (ref && COVER_WORDS[ref]) return COVER_WORDS[ref]();
  // Its name without what follows it ("Interrail Global Pass · 15 gün" is "Interrail Global Pass").
  const name = coverer.name.split(" · ")[0].trim() || coverer.name;
  if (as.pass || ref === "pass") return { by: L(`${name} ile`, `with the ${name}`), open: L("Pass'i aç", "Open the pass") };
  if (as.rental) return COVER_WORDS.car();
  return { by: L(`${name} ile`, `with ${name}`), open: L("Kapsayanı aç", "Open what covers it") };
}
