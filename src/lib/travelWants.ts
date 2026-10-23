// The traveller's intent for the whole trip (0.39.4, Emre: "hostel örneği verdim, akıllı AI dedim, sadece tür ekleyerek
// çözme"): what the start chat and the trip's chat heard said about how they travel — the money level ("Ekonomik", "Orta",
// "Lüks"), who goes, the kinds of place to stay in asked for or ruled out (any kind: a hostel, a villa, a camp, a flat), and
// the wishes said about where (the centre, by the sea). Kept on the trip (Trip.wants) so every suggestion reads the same
// thing: the stay picks and their fit (stayPicks), the hotels' search (its words: stayQueryOf), the AI review's prompt
// (suggestReview) and the chat's (assistant). Only what was said; nothing is guessed from it.
import { L } from "./i18n";
import type { BudgetLevel } from "./tripStyle";
import type { Companions, StartState } from "./startTrip";

/** A kind of place to stay a traveller says ("hostelde kalırız", "villa kiralayacağız"). */
export type StayWish = "hostel" | "villa" | "apartment" | "house" | "guesthouse" | "camp" | "resort" | "boutique" | "bungalow" | "hotel";

export interface TripWants {
  /** The money level said ("Ekonomik" low, "Orta" mid, "Lüks"/"Yüksek bütçe" high); null when not said. */
  budget?: BudgetLevel | null;
  /** Who goes, as said at the start (alone, a partner, friends, family). */
  company?: Companions | null;
  /** Kinds of stay asked for, in the order said: they always pass the fit and come first among the picks. */
  stays?: StayWish[];
  /** Kinds of stay ruled out ("hostel olmasın"): never suggested. */
  avoid?: StayWish[];
  /** Wishes about where to stay, as short words the hotels' search reads ("city centre", "beachfront"). */
  near?: string[];
}

/** Each kind: how it is said (Turkish and English, any suffix: "hostelde", "villada") and how a hotel search asks for it. */
const KINDS: [StayWish, RegExp, string][] = [
  ["hostel", /(?<!\p{L})(hostel|hostal|dorm|backpacker|yatakhane|sırt çantalı)/iu, "hostels"],
  ["villa", /(?<!\p{L})villa/iu, "villas"],
  ["apartment", /(?<!\p{L})(apart(?!man)|apartment|flat(?!\p{L})|serviced apartment|daire|stüdyo)/iu, "apartments"],
  ["house", /(?<!\p{L})(kiral[ıi]k ev|ev kirala|bütün ev|tüm ev|müstakil ev|evde kal|airbnb|holiday home|whole house|cottage|chalet|dağ evi)/iu, "holiday homes"],
  ["guesthouse", /(?<!\p{L})(pansiyon|guest ?house|homestay|b&b|bed and breakfast)/iu, "guesthouses"],
  ["camp", /(?<!\p{L})(kamp(?!any)|camping|campsite|glamping|çad[ıi]r|tent(?!\p{L}))/iu, "campsites"],
  ["resort", /(?<!\p{L})(resort|her şey dahil|all[- ]inclusive)/iu, "resorts"],
  ["boutique", /(?<!\p{L})(butik otel|boutique hotel)/iu, "boutique hotels"],
  ["bungalow", /(?<!\p{L})(bungalov|bungalow)/iu, "bungalows"],
  ["hotel", /(?<!\p{L})(otel|hotel)/iu, "hotels"],
];
const WORD: Record<StayWish, string> = Object.fromEntries(KINDS.map(([k, , w]) => [k, w])) as Record<StayWish, string>;

/** A wish said and taken back in the same breath: "hostel olmasın", "no hostels", "hostel istemiyoruz". */
const NOT_AFTER = /^\p{L}*\s*(?:\S+\s+){0,2}?(olmas[ıi]n|istemiyor|istemem|istemeyiz|hariç|değil|asla|please not)/iu;
const NOT_BEFORE = /(?:(?<!\p{L})(no|not|without|never|hiç|asla|istemiyorum)\s+(?:a\s+|an\s+)?)$/iu;

/** Where to stay said in words: the search's own words for it. */
const NEAR: [RegExp, string][] = [
  [/(şehir merkez|merkezde|merkeze yakın|city cent|town cent|downtown|central)/iu, "city centre"],
  [/(deniz kenar|sahil|plaja yakın|plaj kenar|beachfront|by the beach|near the beach|on the beach)/iu, "beachfront"],
  [/(eski şehir|old town|tarihi merkez|historic centre)/iu, "old town"],
  [/(havaliman[ıi]na yakın|near the airport)/iu, "near the airport"],
  [/(sessiz|sakin bir yer|quiet)/iu, "quiet"],
];

/** The money level said in words; null when none ("ekonomik", "lüks", "orta bütçe"). */
export function budgetIn(text: string): BudgetLevel | null {
  if (/(ekonomik|ucuz|düşük bütçe|kısıtlı bütçe|öğrenci bütçe|budget trip|cheap|on a budget|low budget|backpack)/iu.test(text)) return "low";
  if (/(lüks|yüksek bütçe|bol bütçe|high budget|splurge|luxury|5 yıldız|five[- ]star)/iu.test(text)) return "high";
  if (/(orta bütçe|orta halli|mid-range|mid range|moderate budget)/iu.test(text)) return "mid";
  return null;
}

/** The kinds of stay a text asks for and rules out ("Bu hosteli ekle" asks a hostel; "hostel olmasın" rules one out). */
export function stayWishesIn(text: string): { stays: StayWish[]; avoid: StayWish[] } {
  const stays: StayWish[] = [];
  const avoid: StayWish[] = [];
  for (const [kind, re] of KINDS) {
    const g = new RegExp(re.source, "giu");
    for (const m of text.matchAll(g)) {
      const at = m.index ?? 0;
      const no = NOT_AFTER.test(text.slice(at + m[0].length, at + m[0].length + 40)) || NOT_BEFORE.test(text.slice(Math.max(0, at - 20), at));
      const into = no ? avoid : stays;
      if (!into.includes(kind)) into.push(kind);
    }
  }
  return { stays: stays.filter((k) => !avoid.includes(k)), avoid };
}

/** Everything a text says of the trip's intent: the money, the kinds of stay, where. */
export function wantsIn(text: string): TripWants {
  const { stays, avoid } = stayWishesIn(text);
  const near = NEAR.filter(([re]) => re.test(text)).map(([, w]) => w);
  const budget = budgetIn(text);
  return { ...(budget ? { budget } : {}), ...(stays.length ? { stays } : {}), ...(avoid.length ? { avoid } : {}), ...(near.length ? { near } : {}) };
}

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];

/**
 * The trip's intent with something newly said on top: a money level said again replaces the old one; a kind asked for
 * now is no longer ruled out (and the other way round); wishes add up. Null when nothing at all is known.
 */
export function mergeWants(old: TripWants | null | undefined, add: TripWants | null | undefined): TripWants | null {
  const a = old ?? {};
  const b = add ?? {};
  const newStays = b.stays ?? [];
  const newAvoid = b.avoid ?? [];
  const stays = uniq([...newStays, ...(a.stays ?? []).filter((k) => !newAvoid.includes(k))]);
  const avoid = uniq([...newAvoid, ...(a.avoid ?? []).filter((k) => !newStays.includes(k))]);
  const near = uniq([...(a.near ?? []), ...(b.near ?? [])]).slice(0, 4);
  const budget = b.budget ?? a.budget ?? null;
  const company = b.company ?? a.company ?? null;
  const out: TripWants = {
    ...(budget ? { budget } : {}),
    ...(company ? { company } : {}),
    ...(stays.length ? { stays } : {}),
    ...(avoid.length ? { avoid } : {}),
    ...(near.length ? { near } : {}),
  };
  return Object.keys(out).length ? out : null;
}

/**
 * What the start chat heard (0.39.4: only the budget's amount reached the trip, "Ekonomik" was lost): the money level picked
 * or said, who goes, and what the traveller's own lines said of where and how to stay.
 */
export function wantsFromStart(s: Pick<StartState, "budget" | "who" | "messages">): TripWants | null {
  let out: TripWants | null = null;
  for (const m of s.messages ?? []) if (m.role === "user") out = mergeWants(out, wantsIn(m.text));
  return mergeWants(out, { ...(s.budget ? { budget: s.budget } : {}), ...(s.who?.kind ? { company: s.who.kind } : {}) });
}

/** Whether a text says anything of the trip's intent. */
export const saysWants = (w: TripWants | null | undefined): boolean => !!w && Object.keys(w).length > 0;

/** The kinds a stay's name or labels say it is ("Mad Monkey Hostel": hostel). */
export const stayKindsOf = (words: string): StayWish[] => stayWishesIn(words).stays;

/**
 * What a stay search asks the hotels' source for, in words (Google Hotels reads them: "hostels", "villas city centre"):
 * the wish said for this search first ("villa with a pool"), else the kinds the trip asked for; an economical trip with no
 * kind said asks for hostels beside the budget hotels, so a hostel is among the picks without being asked; where to stay
 * said is added. Null: the source's own (hotels).
 */
export function stayQueryOf(wants: TripWants | null | undefined, said?: string | null): string | null {
  const own = cleanWish(said);
  const w = wants ?? {};
  const kinds = own ? null : w.stays?.length ? w.stays.slice(0, 2).map((k) => WORD[k]).join(" and ") : w.budget === "low" && !w.avoid?.includes("hostel") ? "budget hotels and hostels" : null;
  const near = own ? [] : (w.near ?? []).slice(0, 1);
  const words = [own ?? kinds ?? (near.length ? "hotels" : null), ...near].filter(Boolean).join(" ");
  return words ? words.slice(0, 60) : null;
}

/** A wish typed for a search, safe for a query: letters, digits, spaces and a few marks, at most 60 characters. */
export function cleanWish(text: string | null | undefined): string | null {
  const t = (text ?? "").normalize("NFC").replace(/[^\p{L}\p{N}\s&'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return t || null;
}

const COMPANY: Record<Companions, () => string> = {
  solo: () => L("yalnız", "alone"),
  partner: () => L("partneriyle", "with a partner"),
  friends: () => L("arkadaşlarla", "with friends"),
  family: () => L("aileyle", "with family"),
};
const BUDGET: Record<BudgetLevel, () => string> = { low: () => L("ekonomik", "budget"), mid: () => L("orta", "mid-range"), high: () => L("lüks / yüksek bütçe", "luxury / high budget") };

/**
 * The intent as one line for a model's prompt ("Gezginin niyeti: bütçe ekonomik; arkadaşlarla; istenen konaklama: hostel;
 * yer: city centre."), or null when nothing is known. In the current language.
 */
/** What the start chat understood, one entry each (the hero's Tercihler): its words and the wants without it (its ×). */
export function wantsEntries(wants: TripWants | null | undefined): { key: string; text: string; without: (w: TripWants) => TripWants }[] {
  const w = wants ?? {};
  const out: { key: string; text: string; without: (w: TripWants) => TripWants }[] = [];
  if (w.budget) out.push({ key: "budget", text: L(`Bütçe: ${BUDGET[w.budget]()}`, `Budget: ${BUDGET[w.budget]()}`), without: (x) => ({ ...x, budget: null }) });
  if (w.company) out.push({ key: "company", text: COMPANY[w.company](), without: (x) => ({ ...x, company: null }) });
  for (const s of w.stays ?? []) out.push({ key: `stay:${s}`, text: L(`Konaklama: ${s}`, `Stay: ${s}`), without: (x) => ({ ...x, stays: (x.stays ?? []).filter((y) => y !== s) }) });
  for (const s of w.avoid ?? []) out.push({ key: `avoid:${s}`, text: L(`${s} olmasın`, `No ${s}`), without: (x) => ({ ...x, avoid: (x.avoid ?? []).filter((y) => y !== s) }) });
  for (const s of w.near ?? []) out.push({ key: `near:${s}`, text: L(`Yer: ${s}`, `Where: ${s}`), without: (x) => ({ ...x, near: (x.near ?? []).filter((y) => y !== s) }) });
  return out;
}

export function wantsLine(wants: TripWants | null | undefined): string | null {
  const w = wants ?? {};
  const parts = [
    w.budget ? `${L("bütçe", "budget")} ${BUDGET[w.budget]()}` : null,
    w.company ? COMPANY[w.company]() : null,
    w.stays?.length ? `${L("istenen konaklama", "stay asked for")}: ${w.stays.join(", ")}` : null,
    w.avoid?.length ? `${L("istemediği", "ruled out")}: ${w.avoid.join(", ")}` : null,
    w.near?.length ? `${L("yer", "where")}: ${w.near.join(", ")}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return L(`Gezginin niyeti (kendisi söyledi; her öneri buna uyar): ${parts.join("; ")}.`, `The traveller's intent (said by them; every suggestion keeps to it): ${parts.join("; ")}.`);
}
