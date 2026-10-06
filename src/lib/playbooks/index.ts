// Niyet oyun kitapları (spec 2026-10-06-niyet-planlayici §2): a kind of trip with its own shape. A festival, a ski
// trip, a honeymoon and a wellness retreat each say which cards the made plan opens besides the stays and the
// flights (its skeleton, in order), which suggestions don't belong (no Douro boat tour on a festival trip), what goes
// on the preparation list, one tip, the few questions worth asking, and the chat's tone. Every other trip is
// "classic": nothing added, nothing blocked, the trip made exactly as before. Pure data and small functions.
import { L } from "../i18n";
import { normWords, type Intent } from "../startEvents";
import type { PlannedInput } from "../planned";
import type { StartState } from "../startTrip";
import type { PlaybookKind, Suggestion, SuggestionSection, Trip, TripIntent } from "../types";
import { classic } from "./classic";
import { festival } from "./festival";
import { honeymoon } from "./honeymoon";
import { ski } from "./ski";
import { wellness } from "./wellness";

export type { PlaybookKind };

/** What a skeleton is made from: the trip as the start would make it. */
export interface PlaybookCtx {
  intent: Intent | null;
  /** The trip's days, when known. */
  dates: { start: string; end: string } | null;
  /** The stays the start makes, in order. */
  stays: PlannedInput[];
  /** Where the flight in lands (null: a road trip, or no flight). */
  arrive: string | null;
  road: boolean;
  /** The destination's country (ISO 3166-1 alpha-2). */
  code: string | null;
}

export interface Playbook {
  kind: PlaybookKind;
  /**
   * The cards the made plan opens besides the stays and flights, in order (a transfer, the festival ticket, the ski
   * pass): places to fill, each said the way the chat's plan_item says it.
   */
  skeleton: (ctx: PlaybookCtx) => PlannedInput[];
  /** Suggestions that don't belong: whole sections, words in a title, sections kept to one suggestion at most. */
  blocked: { sections?: SuggestionSection[]; words?: RegExp; few?: SuggestionSection[] };
  /** The preparation list's lines (kind prep), in the language now. */
  prep: () => string[];
  /** One short tip, said once in the start chat. */
  tip: () => string;
  /** At most three questions the kind really needs, asked only after the essentials. */
  questions: () => string[];
  /** The chat's tone, one line for the model. */
  tone: () => string;
  /** What the AI review is told not to suggest on this kind of trip, in words. */
  avoid?: () => string;
}

export const PLAYBOOKS: Readonly<Record<PlaybookKind, Playbook>> = { festival, ski, honeymoon, wellness, classic };

export const playbookOf = (kind: PlaybookKind | null | undefined): Playbook => PLAYBOOKS[kind ?? "classic"] ?? classic;

/** The table's events that are a festival (music, a burn): the rest (a Grand Prix, Hajj, Oktoberfest) stay classic. */
const FESTIVAL_IDS = new Set(["afrikaburn", "burningman", "tomorrowland", "glastonbury", "coachella", "sziget", "ozora", "primavera", "roskilde", "ultra", "edc", "lollapalooza"]);

// On the plain words (normWords: lower case, no accents, "ı" as "i", "ğ" as "g"); a Turkish ending is a word's rest.
const WELLNESS = /^(wellness|retreat\w*|yoga\w*|meditasyon\w*|meditation\w*|inziva\w*|detoks\w*|detox\w*|ayurveda\w*|spa)$/;
const HONEYMOON = /^(balayi\w*|honeymoon\w*)$/;
/** "kayak" is skiing in Turkish (kayağa, kayakta) and never "kayaking"; the resorts said alone count too. */
const SKI = /^(kayak(?!ing)\w*|kayag\w*|ski|skiing|skii\w*|snowboard\w*|bansko\w*|borovets\w*|pamporovo\w*|uludag\w*|palandoken\w*|kartalkaya\w*|sarikamis\w*|chamonix\w*|zermatt\w*|courchevel\w*|verbier\w*|niseko\w*|whistler\w*|kitzbuhel\w*|cortina\w*)$/;
const FESTIVAL = /^(festival\w*|fest|rave\w*)$/;
/** An event the model named that is not a festival: a race, a match, a pilgrimage, a fair or a concert. */
const NOT_FESTIVAL = /^(grand|prix|formula|f1|gp|mac\w*|match|final\w*|cup|kupa\w*|marathon|maraton\w*|hac|hacc|umre|hajj|umrah|pilgrimage|fuar\w*|expo|fair|konferans\w*|conference|summit|konser\w*|concert\w*)$/;

const has = (words: string[], re: RegExp) => words.some((w, i) => re.test(w) && !(re === SKI && words[i - 1] === "sea"));

/**
 * The playbook for what the trip is for: the table's festivals (and an event the model named that isn't a race, a
 * fair or a pilgrimage) are festivals; then the words said, in Turkish or English with their endings: wellness,
 * retreat, spa, yoga ("İsveç'te wellness festivali" is wellness); balayı, honeymoon; kayak, ski, snowboard, Bansko.
 * Anything else is classic.
 */
export function playbookFor(intent: Pick<Intent, "kind" | "name"> & { id?: string | null } | null | undefined, text = ""): PlaybookKind {
  if (intent?.id && FESTIVAL_IDS.has(intent.id)) return "festival";
  const name = normWords(intent?.name ?? "");
  const said = normWords(text);
  // An event's own name says what it is; what else was said ("yoga" at a burn) doesn't make it another kind.
  const words = intent?.kind === "event" ? name : [...name, ...said];
  // The table's other events and themes (a Grand Prix at Spa, Holi): never wellness by a word in their names.
  const known = Boolean(intent?.id);
  if (!known && has(words, WELLNESS)) return "wellness";
  if (has(known ? said : words, HONEYMOON)) return "honeymoon";
  if (has(known ? said : words, SKI)) return "ski";
  if (intent?.kind === "event" && !known && !has(name, NOT_FESTIVAL)) return "festival";
  if (!intent && has(said, FESTIVAL)) return "festival";
  return "classic";
}

/** The trip's playbook (classic when the start chat read none). */
export const tripPlaybook = (trip: Pick<Trip, "intent"> | null | undefined): Playbook => playbookOf(trip?.intent?.playbook);

/** The title's plain words, for the blocked words. */
const plainTitle = (s: Pick<Suggestion, "title">) => normWords(s.title).join(" ");

/**
 * The suggestions that belong on this kind of trip, in order: none of a blocked section or naming a blocked word,
 * and at most one in a section kept few (counting the ones already there).
 */
export function allowedSuggestions<S extends Pick<Suggestion, "section" | "title">>(kind: PlaybookKind | null | undefined, list: readonly S[], already: readonly Pick<Suggestion, "section" | "state">[] = []): S[] {
  const { blocked } = playbookOf(kind);
  const count = new Map<SuggestionSection, number>();
  for (const s of already) if (s.state === "open") count.set(s.section, (count.get(s.section) ?? 0) + 1);
  return list.filter((s) => {
    if (blocked.sections?.includes(s.section)) return false;
    if (blocked.words?.test(plainTitle(s))) return false;
    if (blocked.few?.includes(s.section)) {
      const n = count.get(s.section) ?? 0;
      if (n >= 1) return false;
      count.set(s.section, n + 1);
    }
    return true;
  });
}

/** For the AI review: what not to suggest on this trip, in words (empty for a classic trip). */
export function blockedWords(kind: PlaybookKind | null | undefined): string {
  return playbookOf(kind).avoid?.() ?? "";
}

/** The questions a playbook asks after the essentials (where, when, who), at most three; none for a classic trip. */
export const playbookQuestions = (kind: PlaybookKind | null | undefined): string[] => playbookOf(kind).questions().slice(0, 3);

// --- the start chat -------------------------------------------------------------------------------------------------

/** What the traveller typed in the start chat: the words a kind is read from. */
const typed = (s: Pick<StartState, "messages">) => s.messages.filter((m) => m.role === "user").map((m) => m.text).join(" \n ");

/** The start chat's playbook: from its event or theme and the words typed. */
export const startPlaybook = (s: Pick<StartState, "intent" | "messages">): PlaybookKind => playbookFor(s.intent ?? null, typed(s));

/** Trip.intent for the trip the start makes; null for a classic trip (the trip made as before). */
export function tripIntentOf(s: Pick<StartState, "intent" | "messages">): TripIntent | null {
  const playbook = startPlaybook(s);
  if (playbook === "classic") return null;
  const it = s.intent;
  return { playbook, ...(it && it.kind !== "place" ? { name: it.name, url: it.url ?? null } : {}) };
}

/**
 * The line the start chat's model is given for this kind of trip (with what is known): its tone, and its tip to say
 * once in its own reply, word for word, until a line of the chat has said it. Empty for a classic trip.
 */
export function playbookPromptLine(s: Pick<StartState, "intent" | "messages">): string {
  const kind = startPlaybook(s);
  if (kind === "classic") return "";
  const p = playbookOf(kind);
  const tip = p.tip();
  const said = s.messages.some((m) => m.role === "assistant" && m.text.includes(tip));
  const word = { festival: L("festival", "festival"), ski: L("kayak", "ski trip"), honeymoon: L("balayı", "honeymoon"), wellness: L("wellness", "wellness") }[kind];
  return [
    `${L("Gezi türü", "Kind of trip")}: ${word}`,
    `${L("ton", "tone")}: ${p.tone()}`,
    said ? "" : L(`bir kez, reply.text içinde aynen söylenecek tavsiye: "${tip}"`, `tip to say once, word for word, in reply.text: "${tip}"`),
  ].filter(Boolean).join(" · ");
}
