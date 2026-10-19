// What an intent box draws in its fixed frame (plan v82 "niyet kutusu standardı", docs/superpowers/specs/2026-10-18-v82-gecis
// 02-spec.md §4 aşama 3a): which of the frame's forms its state takes, the state's chip and its dot on the category's rail,
// the side column's price, the words of the main action, the options shown when the chosen one turns back to them
// (Değiştir), the "Kendin ara" sites (providers.ts) and the order the plan's decisions are gone through (F5). It reads
// intents.ts's view model and decides nothing of its own: the states are intents.ts's, the sites providers.ts's.
// Pure; the boxes (app/plan/v82) only draw what it says.
import type { CardFacts } from "./cardFacts";
import type { CardKind } from "./cardKinds";
import { L } from "./i18n";
import { locative } from "./i18nText";
import { statusWord, type AccessVM, type Collection, type IntentStatus, type IntentVM, type OptionBadge, type OptionSource, type OptionVM } from "./intents";
import { shortDay } from "./ideas";
import { isEmptyRecord, needKey } from "./emptyCards";
import type { Need } from "./offerSource";
import { addDays, stayRange } from "./plan";
import { namesSomething } from "./planned";
import { providerLinks, type ProviderKind } from "./providers";
import { airportCode, BRANDS, insuranceLinks } from "./searchLinks";
import { bareChatPlan } from "./emptyCards";
import { isPlaceholder } from "./startTrip";
import type { Item, Trip } from "./types";

/**
 * The form a box's body takes: the options to pick from (Karar bekliyor, also an Aranıyor that has some), the empty frame
 * (Aranıyor), our pick, the one chosen, the booking (access), sorted out, covered by another booking. Gerek yok has none:
 * its body folds away (E7).
 */
export type FrameForm = "options" | "searching" | "suggested" | "chosen" | "booked" | "arranged" | "included";

export function frameForm(vm: Pick<IntentVM, "status" | "options">): FrameForm | null {
  switch (vm.status) {
    case "searching":
      return vm.options.length ? "options" : "searching";
    case "deciding":
      return "options";
    case "skipped":
      return null;
    default:
      return vm.status;
  }
}

/** The state's dot on the rail and the box's ground (the prototype's `data-st`): dashed, purple, sand, green, grey, teal. */
export type RailState = "todo" | "ai" | "sel" | "ok" | "arr" | "inc" | "skip";
const RAIL: Readonly<Record<IntentStatus, RailState>> = {
  searching: "todo",
  deciding: "todo",
  suggested: "ai",
  chosen: "sel",
  booked: "ok",
  arranged: "arr",
  included: "inc",
  skipped: "skip",
};
export const railState = (status: IntentStatus): RailState => RAIL[status];

/** The chip in the box's head: its tone (the prototype's `q-st` classes), its word, and a tick before it. */
export interface StatusChip {
  tone: "todo" | "none" | "ai" | "sel" | "ok" | "arr" | "inc";
  text: string;
  tick: boolean;
}

/**
 * The chip's word (0.38.5, Emre: "Aranıyor yazıyor ama bir şey aramıyor"): Aranıyor only while something looks or has
 * looked (`looking`: a source can be asked for it, or the chat was); else it says plainly there's nothing yet.
 */
export function statusChip(vm: Pick<IntentVM, "status" | "word">, looking = true): StatusChip {
  switch (vm.status) {
    case "searching":
      return { tone: "none", text: looking ? vm.word : L("Seçenek yok", "No options yet"), tick: false };
    case "skipped":
      return { tone: "none", text: vm.word, tick: false };
    case "deciding":
      return { tone: "todo", text: vm.word, tick: false };
    case "suggested":
      // Our pick waits for a yes: "✨ Önerimiz · onayla".
      return { tone: "ai", text: `✨ ${vm.word} · ${L("onayla", "confirm")}`, tick: false };
    case "chosen":
      return { tone: "sel", text: vm.word, tick: true };
    case "booked":
      return { tone: "ok", text: vm.word, tick: true };
    case "arranged":
      return { tone: "arr", text: vm.word, tick: false };
    case "included":
      return { tone: "inc", text: vm.word, tick: true };
  }
}

/** The main action's words for a chosen one: a stay is booked, an eSIM or a policy bought, anything else a ticket. */
export function bookWord(kind: CardKind): string {
  if (kind === "stay") return L("Rezerve et", "Book");
  if (kind === "esim" || kind === "insurance") return L("Satın al", "Buy");
  return L("Bileti al", "Get the ticket");
}

/** "Rezerve edildi" for a stay, "Satın alındı" for anything bought (the booked frame's first line). */
export const bookedWord = (kind: CardKind): string => (kind === "stay" ? L("Rezerve edildi", "Booked") : L("Satın alındı", "Bought"));

/** What a booked frame's file is called: a stay's confirmation, an eSIM's QR code, a policy, a ticket. */
export function docWord(kind: CardKind): { open: string; add: string } {
  switch (kind) {
    case "stay":
      return { open: L("Onay e-postası aç", "Open the confirmation"), add: L("Onayı ekle", "Add the confirmation") };
    case "esim":
      return { open: L("QR kodu aç", "Open the QR code"), add: L("QR kodu ekle", "Add the QR code") };
    case "insurance":
      return { open: L("Poliçeyi aç", "Open the policy"), add: L("Poliçeyi ekle", "Add the policy") };
    default:
      return { open: L("Bileti aç", "Open the ticket"), add: L("Bileti ekle", "Add the ticket") };
  }
}

/** The code's label in a booked frame ("Onay kodu"), its own when the booking names it ("PNR", "Rezervasyon no"). */
export const codeLabel = (access: Pick<AccessVM, "code">): string | null =>
  access.code ? (access.code.label === L("Kod", "Code") ? L("Onay kodu", "Confirmation") : access.code.label) : null;

/**
 * The side column's price: a stay by the night, large, with its nights' total under it ("€213" · "/ gece · €639"); anything
 * else as its page gives it ("€9" · "kişi başı"). Null with no price.
 */
export function sidePrice(price: CardFacts["price"]): { big: string; small: string | null } | null {
  if (!price) return null;
  if (price.perNight) {
    const [each, unit] = price.perNight.split(" / ");
    return { big: each, small: unit ? `/ ${unit} · ${price.text}` : price.text };
  }
  return { big: price.text, small: price.label };
}

/** An option card's price: a stay by the night ("€95" · "/ gece"), anything else as given. */
export function optionPrice(price: CardFacts["price"]): { amount: string; unit: string | null } | null {
  if (!price) return null;
  if (price.perNight) {
    const [each, unit] = price.perNight.split(" / ");
    return { amount: each, unit: unit ? `/ ${unit}` : null };
  }
  return { amount: price.text, unit: price.label };
}

/** The 9-ish score and its reviews ("8,9", "1.204 yorum") apart, as the frame draws them; a star rating keeps its star. */
export function ratingParts(rating: string | null): { score: string; star: boolean; reviews: string | null } | null {
  if (!rating) return null;
  const [score, reviews = null] = rating.split(" · ");
  const star = score.startsWith("★");
  return { score: star ? score.replace(/^★\s*/, "★ ") : score, star, reviews };
}

/** Who put an option on the board, as its picture's badge: our pick, the AI, the traveller's own link, a fellow traveller. */
export function sourceBadge(o: Pick<OptionVM, "ours" | "source">): { tone: "best" | "ai" | "mine"; text: string; initial: string | null } | null {
  if (o.ours) return { tone: "best", text: `✨ ${L("Önerimiz", "Our pick")}`, initial: null };
  const s: OptionSource | null = o.source;
  if (!s) return null;
  if (s.kind === "ai") return { tone: "ai", text: `✨ ${L("AI önerisi", "AI pick")}`, initial: null };
  if (s.kind === "link") return { tone: "mine", text: L("Senin linkin", "Your link"), initial: null };
  return { tone: "mine", text: L(`${s.name} ekledi`, `Added by ${s.name}`), initial: [...s.name.trim()][0]?.toLocaleUpperCase("tr") ?? null };
}

export const badgeWord = (b: OptionBadge): string => (b === "cheapest" ? L("En ucuz", "Cheapest") : L("En hızlı", "Fastest"));

/** How many options a single choice shows in its frame (the rest are on the Pano, F §6). */
export const SHOWN_OPTIONS = 3;

/**
 * Değiştir: the chosen one turns back to its options in place (v82), the one chosen among them (marked) in the order of
 * fit, at most three; when it falls beyond the third it takes the third's place. Our pick isn't "chosen": its options are
 * its need's as they stand.
 */
export function changeList(vm: Pick<IntentVM, "status" | "options" | "chosen">, n = SHOWN_OPTIONS): OptionVM[] {
  const cur = vm.status === "chosen" || vm.status === "booked" || vm.status === "arranged" ? vm.chosen : null;
  if (!cur) return vm.options.slice(0, n);
  const all = [cur, ...vm.options.filter((o) => o.id !== cur.id)].sort((a, b) => a.place - b.place);
  const top = all.slice(0, n);
  return top.includes(cur) ? top : [...top.slice(0, n - 1), cur];
}

/** The id of the option marked as the current one while changing (chosen, booked, arranged), else null. */
export const currentOption = (vm: Pick<IntentVM, "status" | "chosen">): string | null =>
  vm.status === "chosen" || vm.status === "booked" || vm.status === "arranged" ? (vm.chosen?.id ?? null) : null;

/** The options' header: "Seçenekler" and how many ("4 · ilk 3, tümü Pano'da"), or while changing "Başka bir seçenek seç". */
export function optionsHead(vm: Pick<IntentVM, "optionCount" | "status" | "chosen">, changing: boolean): { title: string; caption: string } {
  if (changing && currentOption(vm)) return { title: L("Başka bir seçenek seç", "Pick another option"), caption: L("seçtiğin işaretli", "your pick is marked") };
  const n = vm.optionCount;
  const caption = n > SHOWN_OPTIONS ? L(`${n} · ilk ${SHOWN_OPTIONS}, tümü Pano'da`, `${n} · first ${SHOWN_OPTIONS}, all on the Board`) : n ? String(n) : "";
  return { title: L("Seçenekler", "Options"), caption };
}

/**
 * A booking's when, as the booked frame's line says it: a stay's check-in and check-out with their hours when known
 * ("Giriş 9 Nis 15:00 · Çıkış 12 Nis 11:00"), else its days ("9–12 Nis"); anything else its day.
 */
export function bookedWhen(item: Item, access: Pick<AccessVM, "when" | "checkIn" | "checkOut">, kind: CardKind): string | null {
  if (kind !== "stay") return access.when;
  const range = stayRange(item);
  if (!range || !access.checkIn) return access.when;
  const out = [shortDay(range.end), access.checkOut].filter(Boolean).join(" ");
  return L(`Giriş ${shortDay(range.start)} ${access.checkIn} · Çıkış ${out}`, `Check-in ${shortDay(range.start)} ${access.checkIn} · Check-out ${out}`);
}

/**
 * The head's name: the intent's own, except nights with no city and nothing found for them yet, which are "Konaklama"
 * (the plan's row says "Konaklama yok"; what isn't there isn't written, C19).
 */
export function headName(vm: Pick<IntentVM, "kind" | "head" | "chosen" | "options">): string {
  return vm.kind === "stay" && !vm.head.city && !vm.chosen && !vm.options.length ? L("Konaklama", "Stay") : vm.head.name;
}

/** The empty frame's title: where to stay in a city ("Osaka'da nerede kalınır"), these nights with none, else the intent's name. */
export function emptyTitle(vm: Pick<IntentVM, "kind" | "head" | "chosen" | "options">): string {
  if (vm.kind === "stay") return vm.head.city ? L(`${locative(vm.head.city)} nerede kalınır`, `Where to stay in ${vm.head.city}`) : L("Bu geceler için nerede kalınır", "Where to stay these nights");
  return headName(vm);
}

/** The empty frame's second line: the estimate ("tahmini €90–160 / gece") and the kind's own word, only what is known (C19). */
export function emptyLine(vm: Pick<IntentVM, "kind" | "estimate">): string | null {
  const est = vm.estimate ? L(`tahmini ${vm.estimate.label}`, `about ${vm.estimate.label}`) : null;
  const word = vm.kind === "insurance" ? L("zorunlu değil ama önerilir", "not required, advised") : vm.kind === "esim" ? L("tüm gezi için internet", "internet for the whole trip") : null;
  return [est, word].filter(Boolean).join(" · ") || null;
}

/** A site to look on by oneself: its mark (one letter on its colour), its name and the search. */
export interface SelfSearch {
  id: string;
  name: string;
  color: string;
  letter: string;
  url: string;
  /** Its words when they say more than "…'da ara" (a rental's: "Kiralık araç ara: Canggu, 10 Ara – 10 Oca"). */
  said?: string;
}

export interface SelfSearchAt {
  /** The trip's countries abroad (ISO): a site of the place comes first, an eSIM's page is the country's. */
  countries: readonly string[];
  /** The countries' names, for a search in words (insurance). */
  countryNames: readonly string[];
  /** How many adults go (the searches' head count). */
  adults: number | null;
  /** D12: the children who go and the rooms said (a stay's search), from the trip's Kimler gidiyor. */
  children?: number | null;
  rooms?: number | null;
}

// (a bus or a boat is looked for where every way is compared, as a train; a rented car or bike on the rental sites)
const PROVIDER_KIND: Partial<Record<CardKind, ProviderKind>> = { stay: "stay", esim: "esim", flight: "flight", train: "train", bus: "train", minibus: "train", ferry: "train", activity: "activity", car: "car", rv: "car", moto: "bike", bike: "bike" };

/** A rental's search in words: what, where and which days ("Kiralık araç ara: Canggu, 10 Ara – 10 Oca"); only what is known. */
function rentalWords(kind: ProviderKind, vm: Pick<IntentVM, "head">): string | null {
  if (kind !== "car" && kind !== "bike") return null;
  const days = vm.head.parts.find((p) => /\d/.test(p) && !/→/.test(p)) ?? null;
  const where = [vm.head.city, days].filter(Boolean).join(", ");
  const what = kind === "car" ? L("Kiralık araç ara", "Search rental cars") : L("Kiralık motosiklet ara", "Search motorbike rentals");
  return where ? `${what}: ${where}` : what;
}

/**
 * "Kendin ara" for an intent (providers.ts): the site of the link the traveller sent for it first, then the place's own,
 * then the kind's defaults; insurance has no register of its own and keeps its comparison search. Agoda waits for phase 7,
 * which checks its search format before a need opens it (providers.ts).
 */
export function selfSearches(vm: Pick<IntentVM, "kind" | "head" | "options" | "chosen">, at: SelfSearchAt): SelfSearch[] {
  if (vm.kind === "insurance") {
    return insuranceLinks(at.countryNames[0]).map((l) => ({ id: l.brand, name: l.label, color: BRANDS[l.brand].color, letter: BRANDS[l.brand].letter, url: l.url }));
  }
  const kind = PROVIDER_KIND[vm.kind];
  if (!kind) return [];
  const link = vm.options[0]?.item.url ?? vm.chosen?.item.url ?? null;
  const start = vm.head.date;
  const end = start && vm.head.nights ? addDays(start, vm.head.nights) : null;
  const route = vm.head.route;
  const q = {
    city: vm.head.city,
    start,
    end,
    adults: at.adults,
    children: at.children ?? null,
    rooms: at.rooms ?? null,
    country: at.countries[0] ?? null,
    from: route ? route.from : null,
    to: route ? route.to : null,
  };
  const said = rentalWords(kind, vm);
  return providerLinks(kind, { link, country: [...at.countries] }, q)
    .filter((p) => p.provider.id !== "agoda")
    .map(({ provider, url }) => ({ id: provider.id, name: provider.name(), color: provider.logo.color, letter: provider.logo.letter, url, ...(said ? { said } : {}) }));
}

/** An area chip's search (regionHints): the first site's, looking in that area of the city ("Namba, Osaka"). */
export function areaSearch(vm: Pick<IntentVM, "kind" | "head" | "options" | "chosen">, at: SelfSearchAt, area: string): SelfSearch | null {
  const city = vm.head.city ? `${area}, ${vm.head.city}` : area;
  return selfSearches({ ...vm, head: { ...vm.head, city } }, at)[0] ?? null;
}

// --- the plan's decisions (F5) -----------------------------------------------------------------------------------

/** Everything still to decide across the categories (Aranıyor, Karar bekliyor, Önerimiz), as the plan's head counts it. */
export const decideCount = (collections: readonly Pick<Collection, "summary">[]): number => collections.reduce((n, c) => n + c.summary.counts.decide, 0);

/**
 * The first decision to go to (F5, the hero's "Sıradaki" F4): our pick waiting for a yes first, then one with options,
 * then one still to find; in the plan's order. Null when nothing waits.
 */
export function firstDecision(collections: readonly Pick<Collection, "section" | "intents">[]): { section: Collection["section"]["id"]; intent: IntentVM } | null {
  const all = collections.flatMap((c) => c.intents.map((intent) => ({ section: c.section.id, intent })));
  const pick = (test: (i: IntentVM) => boolean) => all.find((x) => test(x.intent)) ?? null;
  return pick((i) => i.status === "suggested") ?? pick((i) => i.status === "deciding" || (i.status === "searching" && i.options.length > 0)) ?? pick((i) => i.status === "searching");
}

/** The names of what waits for a decision in a category, for the row's "2 karar" tip (F5). */
export const decisionNames = (intents: readonly IntentVM[]): string[] =>
  intents.filter((i) => i.status === "suggested" || i.status === "deciding" || i.status === "searching").map((i) => i.head.name);

/** An airport's code as a ticket's end shows it small ("CMB"), else the city's main one; null when neither is known. */
const codeOf = (city: string, end: { place: string | null } | null | undefined): string | null =>
  end?.place && /^[A-Z]{3}$/.test(end.place) ? end.place : airportCode(city);

/**
 * The offers' question for an intent still to choose (offerSource.Need, the empty cards' own): a stay's city and nights, a
 * flight's two ends and its day (0.38.5: looked for by itself once the route and the day are known), a way between two
 * cities' ends and day, an eSIM's country; null for anything else or when it isn't known.
 */
export function offerNeed(vm: Pick<IntentVM, "kind" | "head"> & { ticket?: IntentVM["ticket"] }, at: SelfSearchAt): Need | null {
  const { city, date: start, nights } = vm.head;
  const end = start && nights ? addDays(start, nights) : null;
  if (vm.kind === "stay" && city && start && end) return { key: needKey("stay", city, start, end), section: "stay", kind: "stay", city, start, end, adults: at.adults, country: at.countries[0] ?? null };
  const route = vm.head.route;
  if (vm.kind === "flight" && route?.from && route.to && start) {
    const [fromCode, toCode] = [codeOf(route.from, vm.ticket?.from), codeOf(route.to, vm.ticket?.to)];
    if (!fromCode || !toCode || fromCode === toCode) return null;
    return { key: needKey("flight", route.from, route.to, start), section: "flight", kind: "flight", from: route.from, to: route.to, start, adults: at.adults, fromCode, toCode };
  }
  // A way between two places by train, bus or boat, or a change of city whose way is still open (0.39.1: asked again since
  // the v82 boxes took the old empty leg card's place, which was the only one asking): Omio's ways between the cities.
  if (TRANSFER_KINDS.has(vm.kind) && route?.from && route.to && !sameEnd(route.from, route.to)) {
    return { key: needKey("transfer", route.from, route.to, start), section: "transport", kind: "transfer", from: route.from, to: route.to, start, adults: at.adults };
  }
  const country = at.countries[0];
  if (vm.kind === "esim" && country) return { key: needKey("esim", country), section: "other", kind: "esim", country, start, end };
  return null;
}

/** What the source's ways between cities are asked for: a ticket by land or sea, or a way not said yet (never a taxi or a rental). */
const TRANSFER_KINDS: ReadonlySet<CardKind> = new Set<CardKind>(["train", "bus", "minibus", "ferry", "transport"]);
const sameEnd = (a: string, b: string) => a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");

// --- the closed row (K0) ----------------------------------------------------------------------------------------

/** One small picture of the closed row: always a real photo (a record's, an option's, a source's tour's), never a drawing. */
export interface RowThumb {
  src: string;
  kind: CardKind;
  /** The record it is the photo of; null for a source's tour. */
  item: Item | null;
}

/**
 * At most three small pictures for a category's closed row, each a real photo (0.38.3, Emre: never the kind's drawing):
 * what's on the plan first (a row's planned cards, the chosen one), then each need's first option that has a photo, then
 * the connected source's tours for the category (Viator's, for Etkinlik). A record with no photo has no picture; a row
 * with none has none at all. `more`: how many more photos there are.
 */
export function rowThumbs(intents: readonly IntentVM[], { max = 3, tours = [] }: { max?: number; tours?: readonly { image: string | null }[] } = {}): { thumbs: RowThumb[]; more: number } {
  const all: RowThumb[] = [];
  const add = (src: string | null, kind: CardKind, item: Item | null) => {
    if (src && !all.some((t) => t.src === src)) all.push({ src, kind, item });
  };
  for (const i of intents) {
    if (i.status === "skipped") continue;
    const settled = i.planned.length ? i.planned : i.chosen ? [i.chosen] : [];
    for (const o of settled) add(o.image, i.kind, o.item);
    // A need still open shows its first option that has a photo; a settled one only its own (never another's photo).
    if (!settled.length) {
      const option = i.options.find((o) => o.image);
      if (option) add(option.image, i.kind, option.item);
    }
  }
  const kind = intents[0]?.kind ?? "activity";
  for (const t of tours) add(t.image, kind, null);
  return { thumbs: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/** The row's state line in parts ("1 alındı · 1 seçildi · 2 karar"), the decisions apart (they open the first one, F5). */
export function countParts(counts: Collection["summary"]["counts"], multi: boolean): { text: string; decide: boolean }[] {
  const out: { text: string; decide: boolean }[] = [];
  if (counts.booked) out.push({ text: L(`${counts.booked} alındı`, `${counts.booked} booked`), decide: false });
  if (counts.chosen) out.push({ text: multi ? L(`${counts.chosen} planda`, `${counts.chosen} on the plan`) : L(`${counts.chosen} seçildi`, `${counts.chosen} chosen`), decide: false });
  if (counts.decide) out.push({ text: L(`${counts.decide} karar`, `${counts.decide} to decide`), decide: true });
  if (!out.length) out.push({ text: counts.arranged ? L(`${counts.arranged} ayarlandı`, `${counts.arranged} arranged`) : L("boş", "empty"), decide: false });
  return out;
}

/**
 * What the start only made room for, or a bare "Otel" added in one tap (a plan with nothing concrete and no name of its own:
 * emptyCards.isEmptyRecord, and a name saying only its kind and its places: planned.namesSomething), is never a chosen box:
 * it is still to find (Aranıyor), as the old empty card was (Emre's rule). Named by the traveller ("Casa do Rio"), it's theirs: chosen.
 */
export function unlessEmpty(vm: IntentVM, trip: Pick<Trip, "startGuide">, records: Item[], files: (id: string) => number): IntentVM {
  const item = vm.status === "chosen" ? vm.chosen?.item : null;
  if (!item || !isEmptyRecord(trip, item, files(item.id), records)) return vm;
  if (namesSomething(item)) return vm;
  return { ...vm, status: "searching", word: statusWord("searching", vm.kind), chosen: null, access: null, paid: null };
}

/**
 * The start's place to fill in a box (startTrip.isPlaceholder, or a bare plan said in the chat: emptyCards.bareChatPlan): a
 * pick chosen for the box takes its record in place (actions.fillOffer), never a second card beside it (0.38.5).
 */
export function placeholderOf(records: readonly Item[], trip: Pick<Trip, "startGuide">, category: Item["category"]): Item | null {
  return records.find((i) => i.category === category && i.status === "chosen" && (isPlaceholder(trip, i) || bareChatPlan(i))) ?? null;
}

/** The need's other options under a chosen or booked box (0.38.5): what was gathered for it beside the one taken. */
export function otherOptions(vm: Pick<IntentVM, "status" | "frame" | "options" | "chosen" | "more">): OptionVM[] {
  if (vm.frame === "collection") return [];
  const more = vm.more ?? [];
  // Settled (chosen, booked, arranged, included): every other option; still open: those past the box's three, so each
  // one can be seen and opened in any state (Emre, 0.39.0).
  const settled = vm.status === "chosen" || vm.status === "booked" || vm.status === "arranged" || vm.status === "included";
  return (settled ? [...vm.options, ...more] : more).filter((o) => o.id !== vm.chosen?.id);
}
