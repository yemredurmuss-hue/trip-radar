// The playbook the start chat's model makes for this trip (spec 2026-10-07-akilli-planlayici §A): a kind with no
// playbook of its own (a liveaboard, a camper van tour, a family celebration) gets its shape from the same call that
// reads the first message. What comes back is checked here, piece by piece: an unknown card kind, a sea named as a
// city, a malformed question or operation is dropped, never a crash; with no label there is no playbook and the trip
// is made as before. The kept playbook is plain data (stored on the trip) and runs through the same generic machinery
// as the hand-made ones. What must hold ("babam merdiven çıkamaz", "özel araç") comes as structured musts that the
// stay picks, the transfer, the suggestions and the chat all read from one place.
//
// Gezi biçimi (v82 geçişi spec §1.4): the playbook carries the trip's shape signals too: where the nights are spent (a
// cabin, none at all), the nearest airport, a moving base, a right for each day, each card's category, frame, word, one
// choice or many, what covers it and what it covers, and a short line per category. Each is checked on its own and
// dropped alone when it doesn't hold; the nearest ready mix (playbooks/shape.ts) gives what the model leaves out. Pure.
import { z } from "zod";
import { L } from "../i18n";
import { normWords } from "../startEvents";
import type { Amenity, CustomCard, Item, CustomPlaybook, Must, MustId, PartFrame, PartSection, PlannedKind, Requirement, SuggestionSection, TripIntent } from "../types";
import { card, daysOf, stayAt, firstStay } from "./cards";
import type { Playbook, PlaybookCtx } from "./index";
import { validQuestions, type Card } from "./questions";
import { isShapePreset, MIXES, mixCards, mixPrep, mixQuestions, partOfCard, SLEEP_TYPES } from "./shape";

// --- what the model is asked for (no nullable fields: "" and [] stand for "none") ------------------------------

const effectSchema = z.object({
  op: z.string(),
  card: z.string(),
  to: z.string(),
  n: z.number(),
  amount: z.number(),
  currency: z.string(),
  items: z.array(z.string()),
});
const chipSchema = z.object({ value: z.string(), label: z.string(), aliases: z.array(z.string()), effects: z.array(effectSchema) });

const cardSchema = z.object({
  ref: z.string(),
  kind: z.string(),
  title: z.string(),
  place: z.string(),
  anchor: z.string(),
  // Gezi biçimi: where its box goes and how it's drawn, what covers it ("" and [] when the kind says it).
  section: z.string(),
  frame: z.string(),
  word: z.string(),
  pick: z.string(),
  covers: z.array(z.string()),
  by: z.string(),
});

export const planSchema = z.object({
  label: z.string(),
  // The end of the trip's title in the traveller's words ("Dalış Gezisi", "Aile Kutlaması"; tripName.ts checks it).
  title_theme: z.string(),
  base: z.string(),
  focus: z.string(),
  stay_type: z.string(),
  stay_port: z.string(),
  // Gezi biçimi: the nearest airport, a moving base, the card that is a right for each day, the short lines.
  gateway: z.string(),
  moving_base: z.boolean(),
  per_day: z.string(),
  info: z.array(z.object({ section: z.string(), text: z.string() })),
  cards: z.array(cardSchema),
  questions: z.array(z.object({ id: z.string(), text: z.string(), chips: z.array(chipSchema) })),
  blocked_sections: z.array(z.string()),
  blocked_words: z.array(z.string()),
  prep: z.array(z.string()),
  tip: z.string(),
  tone: z.string(),
  avoid: z.string(),
  musts: z.array(z.object({ id: z.string(), text: z.string() })),
});
type ShapeKeys = "gateway" | "moving_base" | "per_day" | "info" | "title_theme";
type CardShapeKeys = "section" | "frame" | "word" | "pick" | "covers" | "by";
type FullCard = z.infer<typeof cardSchema>;
/** One card as it may come: a playbook made before gezi biçimi has none of the shape's fields. */
export type RawCard = Omit<FullCard, CardShapeKeys> & Partial<Pick<FullCard, CardShapeKeys>>;
/** What the model answers (planSchema), as it may come: one made before gezi biçimi has none of the shape's fields. */
export type RawPlan = Omit<z.infer<typeof planSchema>, ShapeKeys | "cards"> & Partial<Pick<z.infer<typeof planSchema>, ShapeKeys>> & { cards: RawCard[] };

// --- the checks -------------------------------------------------------------------------------------------------

/** What a playbook's card may be: the ways about and the things to do; never a stay or a flight (the route makes those). */
export const CARD_KINDS: readonly PlannedKind[] = ["transfer", "taxi", "car_rental", "rv_rental", "moto_rental", "bike_rental", "minibus", "train", "bus", "ferry", "activity", "todo", "esim", "insurance", "other"];
const PART_SECTIONS: readonly PartSection[] = ["flight", "stay", "transport", "activity", "todo", "other"];
const PART_FRAMES: readonly PartFrame[] = ["stay", "ticket", "collection"];
/** The ways about: their box is a ticket in Ulaşım, whatever else a card says. */
const TRAVEL_KINDS = new Set<PlannedKind>(["transfer", "taxi", "car_rental", "rv_rental", "moto_rental", "bike_rental", "minibus", "train", "bus", "ferry"]);
/** What a covering card may cover besides another card: the nights at its place, the event's own nights, the ways between the stays. */
const COVER_SPECIALS = new Set(["stay", "stay:event", "legs"]);
const ANCHORS: readonly CustomCard["anchor"][] = ["arrive", "stay", "leave"];
const SECTIONS: readonly SuggestionSection[] = ["stay", "transport", "activity", "todo", "food", "other"];
const MUSTS: readonly MustId[] = ["step_free", "private_transfer", "kitchen", "quiet", "pool", "pet", "breakfast", "level", "diet", "age", "other"];

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s && s.length <= max ? s : null;
};

/** A sea, an ocean, a gulf or a coast is never a place to sleep in or drive to ("Red Sea", "Kızıldeniz", "Ege Denizi"). */
const WATER = new Set(["sea", "ocean", "gulf", "bay", "coast", "okyanus", "okyanusu", "korfez", "korfezi", "sahil", "sahili", "denizi", "region", "bolge", "bolgesi"]);
export function notAPlace(name: string): boolean {
  const words = normWords(name);
  return !words.length || words.some((w) => WATER.has(w) || /deniz$/.test(w));
}

/** A real-looking place name: letters, a few words, not a sea or a region. */
export function realPlace(v: unknown): string | null {
  const s = text(v, 50)?.split(/['’]/)[0].trim() ?? null;
  return s && /^[\p{L}][\p{L} .-]{1,48}$/u.test(s) && !notAPlace(s) ? s : null;
}

const words = (s: string) => ({ tr: s, en: s });

/**
 * The model's playbook, checked: null when there is none (no label) or nothing to keep. Each piece is kept or dropped
 * on its own: at most 6 cards, 3 questions, 8 list lines, 6 musts; an operation naming a card that isn't there goes.
 */
/** A part's category as a card may say it: one its kind can go in (a way about only in Ulaşım, an eSIM or a policy in Belgeler). */
function sectionFor(kind: PlannedKind, v: unknown): PartSection | undefined {
  if (!(PART_SECTIONS as readonly unknown[]).includes(v) || v === "flight") return undefined;
  const s = v as PartSection;
  if (TRAVEL_KINDS.has(kind)) return s === "transport" ? s : undefined;
  if (kind === "esim" || kind === "insurance") return s === "other" ? s : undefined;
  return s === "transport" ? undefined : s;
}

/** Its frame as a card may say it: a ticket only for a way about, never for one; a row of cards only in Etkinlik and Yapılacaklar. */
function frameFor(kind: PlannedKind, section: PartSection | undefined, v: unknown): PartFrame | undefined {
  if (!(PART_FRAMES as readonly unknown[]).includes(v)) return undefined;
  const f = v as PartFrame;
  if (TRAVEL_KINDS.has(kind)) return f === "ticket" ? f : undefined;
  if (f === "ticket") return undefined;
  // Where it goes when no category is said: a thing to do in Etkinlik or Yapılacaklar, anything else in Belgeler.
  const lands = section ?? (kind === "activity" ? "activity" : kind === "todo" ? "todo" : "other");
  if (f === "collection" && lands !== "activity" && lands !== "todo") return undefined;
  return f;
}

/** A card checked piece by piece: the part's fields that don't hold are dropped, the card stays. */
function validCard(c: RawCard | null | undefined, refs: readonly string[]): CustomCard | null {
  const ref = text(c?.ref, 30)?.toLowerCase().replace(/[^a-z0-9_-]/g, "") ?? "";
  const title = text(c?.title, 80);
  if (!c || !ref || ref.startsWith("stay") || ref === "legs" || !title || !(CARD_KINDS as readonly string[]).includes(c.kind) || refs.includes(ref)) return null;
  const kind = c.kind as PlannedKind;
  const anchor = (ANCHORS as readonly string[]).includes(c.anchor) ? (c.anchor as CustomCard["anchor"]) : "stay";
  const out: CustomCard = { ref, kind, title, place: realPlace(c.place), anchor };
  const section = sectionFor(kind, c.section);
  if (section) out.section = section;
  const frame = frameFor(kind, section, c.frame);
  if (frame) out.frame = frame;
  const word = text(c.word, 24);
  if (word) out.word = word;
  if (c.pick === "single" || c.pick === "multi") out.pick = c.pick;
  const covers = [...new Set((Array.isArray(c.covers) ? c.covers : []).map((x) => (typeof x === "string" ? x.trim().toLowerCase() : "")).filter((x) => x && x !== ref && x.length <= 30))];
  if (covers.length) out.covers = covers;
  const by = typeof c.by === "string" ? c.by.trim().toLowerCase() : "";
  if (by && by !== ref && by.length <= 30) out.by = by;
  return out;
}

/** What covers and is covered names only what is there: other cards, the nights ("stay"), the ways between ("legs"). */
function linkCovers(cards: CustomCard[]): CustomCard[] {
  const refs = new Set(cards.map((c) => c.ref));
  return cards.map((c) => {
    const { covers, by, ...rest } = c;
    const out: CustomCard = { ...rest };
    const kept = (covers ?? []).filter((x) => refs.has(x) || COVER_SPECIALS.has(x));
    if (kept.length) out.covers = kept;
    // Covered by a card (that covers nothing itself, no chains) or by the nights it sits in.
    if (by && (by === "stay" || (refs.has(by) && !cards.find((x) => x.ref === by)?.by))) out.by = by;
    return out;
  });
}

export function validModelPlaybook(raw: RawPlan | null | undefined): CustomPlaybook | null {
  if (!raw || typeof raw !== "object") return null;
  const label = text(raw.label, 60);
  if (!label || label.length < 3) return null;
  // The nearest ready mix: what the model leaves out comes from it (gezi biçimi).
  const base: CustomPlaybook["base"] = isShapePreset(raw.base) ? raw.base : "classic";
  const mix = MIXES[base];
  const focus: CustomPlaybook["focus"] = raw.focus === "only" ? "only" : raw.focus === "around" ? "around" : mix.focus;
  const stayType = (SLEEP_TYPES as readonly string[]).includes(raw.stay_type) ? (raw.stay_type as CustomPlaybook["stayType"]) : mix.sleep;
  const stayPort = stayType === "boat" || stayType === "camp" || stayType === "cabin" ? realPlace(raw.stay_port) : null;

  const own: CustomCard[] = [];
  for (const c of Array.isArray(raw.cards) ? raw.cards : []) {
    const kept = validCard(c, own.map((x) => x.ref));
    if (kept) own.push(kept);
    if (own.length === 6) break;
  }
  // None of its own: the mix's (a liveaboard's transfer and dives in the boat's package).
  const fromMix = !own.length;
  const cards = linkCovers(fromMix ? mixCards(base) : own);

  const refs = new Set([...cards.map((c) => c.ref), "stay:first", "stay:event"]);
  const questions = validQuestions(
    (Array.isArray(raw.questions) ? raw.questions : []).map((q) => ({
      id: q?.id,
      text: typeof q?.text === "string" ? words(q.text) : null,
      chips: (Array.isArray(q?.chips) ? q.chips : []).map((c) => ({
        value: c?.value,
        label: typeof c?.label === "string" ? words(c.label) : null,
        aliases: c?.aliases,
        effects: (Array.isArray(c?.effects) ? c.effects : [])
          .map((e) => ({ ...e, ...(typeof e?.card === "string" ? { card: e.card.toLowerCase() } : {}), items: Array.isArray(e?.items) ? e.items.filter((i): i is string => typeof i === "string").map(words) : [] }))
          // A card named by an operation must be one of this playbook's (or the stays').
          .filter((e) => !(e?.op === "dropCard" || e?.op === "markHandled") || refs.has(String(e.card ?? "").toLowerCase())),
      })),
    })),
  );

  const sections = [...new Set((Array.isArray(raw.blocked_sections) ? raw.blocked_sections : []).filter((x): x is SuggestionSection => (SECTIONS as readonly string[]).includes(x)))];
  const blockedWords = [...new Set((Array.isArray(raw.blocked_words) ? raw.blocked_words : []).map((w) => normWords(String(w ?? "")).join(" ")).filter((w) => w.length >= 3 && w.length <= 30))].slice(0, 8);
  const prep = [...new Set((Array.isArray(raw.prep) ? raw.prep : []).map((p) => text(p, 60)).filter((p): p is string => !!p))].slice(0, 8);

  const musts: Must[] = [];
  for (const m of Array.isArray(raw.musts) ? raw.musts : []) {
    const said = text(m?.text, 80);
    if (!said) continue;
    const id = (MUSTS as readonly string[]).includes(m.id) ? (m.id as MustId) : "other";
    if (!musts.some((x) => x.id === id && x.text === said)) musts.push({ id, text: said });
    if (musts.length === 6) break;
  }

  // The shape's signals, each kept alone: a real town for the airport, a moving base only when said, a right for each
  // day only when it names a card, a short line only for a category and in a sentence.
  const gateway = realPlace(raw.gateway);
  const perDay = typeof raw.per_day === "string" && cards.some((c) => c.ref === raw.per_day!.trim().toLowerCase()) ? raw.per_day.trim().toLowerCase() : fromMix ? (mix.perDay ?? null) : null;
  const info: Partial<Record<PartSection, string>> = {};
  for (const row of Array.isArray(raw.info) ? raw.info : []) {
    const said = text(row?.text, 160);
    if (said && (PART_SECTIONS as readonly unknown[]).includes(row.section) && !info[row.section as PartSection]) info[row.section as PartSection] = said;
  }

  const titleTheme = text(raw.title_theme, 40);
  return {
    label,
    ...(titleTheme ? { titleTheme } : {}),
    base,
    focus,
    stayType,
    stayPort,
    ...(gateway ? { gateway } : {}),
    ...(raw.moving_base === true ? { movingBase: true } : {}),
    ...(perDay ? { perDay } : {}),
    ...(Object.keys(info).length ? { info } : {}),
    cards,
    questions: questions.length || !fromMix ? questions : mixQuestions(base),
    blocked: { sections, words: blockedWords },
    prep: prep.length ? prep : mixPrep(base),
    tip: text(raw.tip, 200) ?? "",
    tone: text(raw.tone, 160) ?? "",
    avoid: text(raw.avoid, 200) ?? "",
    musts,
  };
}

// --- the playbook made from it ----------------------------------------------------------------------------------

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A title naming one of the blocked words (whole words, on the plain words). */
export const blockedRe = (list: string[]): RegExp | undefined => (list.length ? new RegExp(`(^| )(${list.map(escape).join("|")})( |$)`) : undefined);

const MOVING = new Set<PlannedKind>(["transfer", "taxi", "train", "bus", "ferry", "minibus"]);
const RENTAL = new Set<PlannedKind>(["car_rental", "rv_rental", "moto_rental", "bike_rental"]);

/**
 * The cards on their days: the day they arrive, over the stay, the day they leave; a ride from where the flight lands.
 * Each keeps the part it stands for (its category, frame, word, what covers it: gezi biçimi), on the record it makes.
 */
export function skeletonOf(c: Pick<CustomPlaybook, "cards" | "stayPort">, ctx: PlaybookCtx): Card[] {
  const home = c.stayPort ?? ctx.intent?.place ?? null;
  const stay = stayAt(ctx, home) ?? firstStay(ctx);
  const days = daysOf(stay, ctx.dates);
  const arrive = stay?.date ?? ctx.dates?.start ?? null;
  const leave = stay?.end_date ?? ctx.dates?.end ?? null;
  return c.cards.flatMap((x): Card[] => {
    const place = x.place ?? home ?? stay?.city ?? null;
    const day = x.anchor === "arrive" ? arrive : x.anchor === "leave" ? leave : days.date;
    const own = { part: partOfCard(x) };
    // A pass or a car that covers the ways between the stays runs over the whole trip (D10), never one ride.
    if (x.covers?.includes("legs")) return [card({ kind: x.kind, ref: x.ref, city: place, title: x.title, date: ctx.dates?.start ?? days.date, end_date: ctx.dates?.end ?? days.end_date, ...own })];
    if (MOVING.has(x.kind)) {
      // On a road trip the car goes there; a ride from the airport only when one is flown into.
      if (ctx.road && x.kind === "transfer") return [];
      const from = x.anchor === "leave" ? place : ctx.arrive && ctx.arrive !== place ? ctx.arrive : null;
      const to = x.anchor === "leave" ? (ctx.arrive && ctx.arrive !== place ? ctx.arrive : null) : place;
      return [card({ kind: x.kind, ref: x.ref, date: day, from, to, title: x.title, ...own })];
    }
    if (RENTAL.has(x.kind)) return [card({ kind: x.kind, ref: x.ref, city: place, title: x.title, ...days, ...own })];
    return [card({ kind: x.kind, ref: x.ref, city: place, title: x.title, ...(x.anchor === "stay" ? days : { date: day, end_date: null }), ...own })];
  });
}

/** A trip for one experience only: what isn't the experience's own is never suggested (its own cards are made apart). */
const ONLY_WORDS = ["tur", "turu", "tour", "tours", "sightseeing", "sehir turu", "city tour", "excursion", "gunubirlik", "day trip", "muze", "museum"];
const onlyAvoid = (label: string) =>
  L(
    `Yolcu yalnız bu deneyim için gidiyor (${label}): tur, şehir gezisi, müze ya da başka durak önerme; yalnız deneyimin gerektirdiklerini (ulaşım, bilet, ekipman, izin, konaklama) öner.`,
    `The traveller goes for this experience only (${label}): no tours, sightseeing, museums or other stops; suggest only what the experience needs (getting there, tickets, gear, permits, the stay).`,
  );

/**
 * The Playbook a model-made one runs as (the same machinery as the hand-made ones). With no cards of its own, its
 * nearest built-in kind's skeleton, questions and list stand in (gezi biçimi: the mix gives what the model leaves out).
 */
export function customPlaybook(c: CustomPlaybook, base: Playbook | null = null): Playbook {
  const only = c.focus === "only";
  const sections = [...new Set([...c.blocked.sections, ...(only ? (["activity"] as SuggestionSection[]) : [])])];
  const words = [...new Set([...c.blocked.words, ...(only ? ONLY_WORDS : [])])];
  const avoid = [c.avoid, only ? onlyAvoid(c.label) : ""].filter(Boolean).join(" ");
  const borrowed = !c.cards.length && base ? base : null;
  return {
    kind: "custom",
    skeleton: (ctx) => (borrowed ? borrowed.skeleton(ctx) : skeletonOf(c, ctx)),
    blocked: { ...(sections.length ? { sections } : {}), ...(words.length ? { words: blockedRe(words) } : {}) },
    prep: () => (c.prep.length || !borrowed ? c.prep : borrowed.prep()),
    tip: () => c.tip,
    questions: c.questions.length || !borrowed ? c.questions : borrowed.questions,
    tone: () => c.tone || (base?.tone() ?? ""),
    ...(avoid ? { avoid: () => avoid } : {}),
  };
}

// --- what must hold ---------------------------------------------------------------------------------------------

/** The stay labels a must asks for (the sources' words), and whether it rules (a must) or tips (a wish). */
const MUST_AMENITY: Partial<Record<MustId, Amenity>> = { kitchen: "mutfak", quiet: "sessiz", pool: "havuz", pet: "evcil hayvan kabul", breakfast: "kahvaltı dahil" };

/** What the musts set on the trip: the stay's hard requirements, and the amenities wanted (step-free: a lift, access). */
export function mustsOnTrip(musts: readonly Must[] | null | undefined): { requirements: Requirement[]; wantedAmenities: Amenity[] } {
  const requirements: Requirement[] = [];
  const wanted: Amenity[] = [];
  for (const m of musts ?? []) {
    const amenity = MUST_AMENITY[m.id];
    if (amenity && !requirements.some((r) => r.kind === "amenity" && r.amenity === amenity)) requirements.push({ kind: "amenity", amenity });
    if (m.id === "step_free") for (const a of ["asansör", "engelli erişimi"] as Amenity[]) if (!wanted.includes(a)) wanted.push(a);
  }
  return { requirements, wantedAmenities: wanted };
}

export const hasMust = (intent: Pick<TripIntent, "musts"> | null | undefined, id: MustId): boolean => Boolean(intent?.musts?.some((m) => m.id === id));

/** A transfer said as shared ("paylaşımlı", "shuttle", "Private-Shared"): never on a trip that wants a car of its own. */
export const SHARED_RIDE = /paylaşımlı|paylasimli|shared|shuttle|servis aracı|dolmuş|dolmus/i;

/** The kinds of stay that are a trip kind's own (a liveaboard, a camp, a camper van): never a hotel to find or price. */
const OWN_STAYS = new Set<string>(["boat", "camp", "vehicle"]);
export const isOwnStay = (item: Pick<Item, "metrics"> | null | undefined): boolean => OWN_STAYS.has(item?.metrics?.stayKind ?? "");

export { isCampStay } from "../campStay";

/** The name and the line under it of a festival's camp, by what was asked ("Çadır kampı mı, karavan mı?"). */
export function campWords(kind: "camp" | "vehicle"): { title: string; note: string } {
  return kind === "vehicle"
    ? { title: L("Karavan · festival alanı", "Caravan · festival grounds"), note: L("karavan alanı", "caravan area") }
    : { title: L("Çadır kampı · festival alanı", "Tent camp · festival grounds"), note: L("kendi çadırın", "your own tent") };
}

/** The drawing of a camp's card (static/illus): a tent, or a caravan. */
export const campArt = (item: Pick<Item, "metrics"> | null | undefined): string => (item?.metrics?.stayKind === "vehicle" ? "illus/karavan.png" : "illus/cadir.svg");
