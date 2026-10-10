// The playbook the start chat's model makes for this trip (spec 2026-10-07-akilli-planlayici §A): a kind with no
// playbook of its own (a liveaboard, a camper van tour, a family celebration) gets its shape from the same call that
// reads the first message. What comes back is checked here, piece by piece: an unknown card kind, a sea named as a
// city, a malformed question or operation is dropped, never a crash; with no label there is no playbook and the trip
// is made as before. The kept playbook is plain data (stored on the trip) and runs through the same generic machinery
// as the hand-made ones. What must hold ("babam merdiven çıkamaz", "özel araç") comes as structured musts that the
// stay picks, the transfer, the suggestions and the chat all read from one place. Pure.
import { z } from "zod";
import { L } from "../i18n";
import { normWords } from "../startEvents";
import type { Amenity, CustomCard, Item, CustomPlaybook, Must, MustId, PlannedKind, PlaybookKind, Requirement, SuggestionSection, TripIntent } from "../types";
import { card, daysOf, stayAt, firstStay } from "./cards";
import type { Playbook, PlaybookCtx } from "./index";
import { validQuestions, type Card } from "./questions";

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

export const planSchema = z.object({
  label: z.string(),
  base: z.string(),
  focus: z.string(),
  stay_type: z.string(),
  stay_port: z.string(),
  cards: z.array(z.object({ ref: z.string(), kind: z.string(), title: z.string(), place: z.string(), anchor: z.string() })),
  questions: z.array(z.object({ id: z.string(), text: z.string(), chips: z.array(chipSchema) })),
  blocked_sections: z.array(z.string()),
  blocked_words: z.array(z.string()),
  prep: z.array(z.string()),
  tip: z.string(),
  tone: z.string(),
  avoid: z.string(),
  musts: z.array(z.object({ id: z.string(), text: z.string() })),
});
export type RawPlan = z.infer<typeof planSchema>;

// --- the checks -------------------------------------------------------------------------------------------------

const BASES: readonly Exclude<PlaybookKind, "custom">[] = ["festival", "ski", "honeymoon", "wellness", "classic"];
const STAY_TYPES: readonly CustomPlaybook["stayType"][] = ["hotel", "boat", "camp", "vehicle"];
/** What a playbook's card may be: the ways about and the things to do; never a stay or a flight (the route makes those). */
export const CARD_KINDS: readonly PlannedKind[] = ["transfer", "taxi", "car_rental", "rv_rental", "moto_rental", "bike_rental", "minibus", "train", "bus", "ferry", "activity", "todo", "esim", "insurance", "other"];
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
export function validModelPlaybook(raw: RawPlan | null | undefined): CustomPlaybook | null {
  if (!raw || typeof raw !== "object") return null;
  const label = text(raw.label, 60);
  if (!label || label.length < 3) return null;
  const base = (BASES as readonly string[]).includes(raw.base) ? (raw.base as CustomPlaybook["base"]) : "classic";
  const focus: CustomPlaybook["focus"] = raw.focus === "only" ? "only" : "around";
  const stayType = (STAY_TYPES as readonly string[]).includes(raw.stay_type) ? (raw.stay_type as CustomPlaybook["stayType"]) : "hotel";
  const stayPort = stayType === "hotel" ? null : realPlace(raw.stay_port);

  const cards: CustomCard[] = [];
  for (const c of Array.isArray(raw.cards) ? raw.cards : []) {
    const ref = text(c?.ref, 30)?.toLowerCase().replace(/[^a-z0-9_-]/g, "") ?? "";
    const title = text(c?.title, 80);
    if (!ref || ref.startsWith("stay") || !title || !(CARD_KINDS as readonly string[]).includes(c.kind) || cards.some((x) => x.ref === ref)) continue;
    const anchor = (ANCHORS as readonly string[]).includes(c.anchor) ? (c.anchor as CustomCard["anchor"]) : "stay";
    cards.push({ ref, kind: c.kind as PlannedKind, title, place: realPlace(c.place), anchor });
    if (cards.length === 6) break;
  }

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

  return {
    label,
    base,
    focus,
    stayType,
    stayPort,
    cards,
    questions,
    blocked: { sections, words: blockedWords },
    prep,
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

/** The cards on their days: the day they arrive, over the stay, the day they leave; a ride from where the flight lands. */
function skeletonOf(c: CustomPlaybook, ctx: PlaybookCtx): Card[] {
  const home = c.stayPort ?? ctx.intent?.place ?? null;
  const stay = stayAt(ctx, home) ?? firstStay(ctx);
  const days = daysOf(stay, ctx.dates);
  const arrive = stay?.date ?? ctx.dates?.start ?? null;
  const leave = stay?.end_date ?? ctx.dates?.end ?? null;
  return c.cards.flatMap((x): Card[] => {
    const place = x.place ?? home ?? stay?.city ?? null;
    const day = x.anchor === "arrive" ? arrive : x.anchor === "leave" ? leave : days.date;
    if (MOVING.has(x.kind)) {
      // On a road trip the car goes there; a ride from the airport only when one is flown into.
      if (ctx.road && x.kind === "transfer") return [];
      const from = x.anchor === "leave" ? place : ctx.arrive && ctx.arrive !== place ? ctx.arrive : null;
      const to = x.anchor === "leave" ? (ctx.arrive && ctx.arrive !== place ? ctx.arrive : null) : place;
      return [card({ kind: x.kind, ref: x.ref, date: day, from, to, title: x.title })];
    }
    if (RENTAL.has(x.kind)) return [card({ kind: x.kind, ref: x.ref, city: place, title: x.title, ...days })];
    return [card({ kind: x.kind, ref: x.ref, city: place, title: x.title, ...(x.anchor === "stay" ? days : { date: day, end_date: null }) })];
  });
}

/** A trip for one experience only: what isn't the experience's own is never suggested (its own cards are made apart). */
const ONLY_WORDS = ["tur", "turu", "tour", "tours", "sightseeing", "sehir turu", "city tour", "excursion", "gunubirlik", "day trip", "muze", "museum"];
const onlyAvoid = (label: string) =>
  L(
    `Yolcu yalnız bu deneyim için gidiyor (${label}): tur, şehir gezisi, müze ya da başka durak önerme; yalnız deneyimin gerektirdiklerini (ulaşım, bilet, ekipman, izin, konaklama) öner.`,
    `The traveller goes for this experience only (${label}): no tours, sightseeing, museums or other stops; suggest only what the experience needs (getting there, tickets, gear, permits, the stay).`,
  );

/** The Playbook a model-made one runs as (the same machinery as the hand-made ones). */
export function customPlaybook(c: CustomPlaybook, baseTone: () => string = () => ""): Playbook {
  const only = c.focus === "only";
  const sections = [...new Set([...c.blocked.sections, ...(only ? (["activity"] as SuggestionSection[]) : [])])];
  const words = [...new Set([...c.blocked.words, ...(only ? ONLY_WORDS : [])])];
  const avoid = [c.avoid, only ? onlyAvoid(c.label) : ""].filter(Boolean).join(" ");
  return {
    kind: "custom",
    skeleton: (ctx) => skeletonOf(c, ctx),
    blocked: { ...(sections.length ? { sections } : {}), ...(words.length ? { words: blockedRe(words) } : {}) },
    prep: () => c.prep,
    tip: () => c.tip,
    questions: c.questions,
    tone: () => c.tone || baseTone(),
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
