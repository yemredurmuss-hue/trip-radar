// Why this one, why not that one, at a glance: for every saved option, what speaks for it and what
// against it, most important first, and the reason it is out (if it is) on top. Pure.
// Two sources: how the option compares with the others on the traveller's criteria (computed), and
// what was read on its pages (findings, each with the reviews or text behind it).
import {
  amenitiesOf,
  amenityLabel,
  findingWeight,
  levelFor,
  LIMITED,
  locationBasis,
  SAID_WEIGHT,
  saidTopics,
  touchesTopic,
  wantedAmenities,
  penaltyFor,
  TOPIC_CRITERION,
  type DecisionContext,
  type GroupDecision,
  type OptionResult,
  type Part,
} from "./decision";
import { L } from "./i18n";
import { capitalize, hoursMinutes, liveLabels, lowerText, nNights, nReviews } from "./i18nText";
import { formatDateRange, formatPrice, listingKeyOf } from "./items";
import { acceptKey, evidenceOf, isWeakFinding, monthLabel, saysSame, standing, stillText } from "./listing";
import { cancellationText, locationText } from "./needs";
import type { Finding, Item, Listing } from "./types";

export interface ProCon {
  key: string;
  text: string;
  /** Two to four words for a card ("€45 daha ucuz", "Merkeze yakın"); `text` when it's already short. */
  short?: string;
  /** A few words for the card front ("Yakın", "İade yok", "Karşısında genelev var"). */
  tag?: string;
  /** Where it comes from: "7 yorum · en yenisi Eyl 2026", "açıklamada", "diğerleriyle kıyasla". */
  detail: string | null;
  weight: number;
  kind: "compare" | "finding" | "summary" | "requirement" | "elimination" | "check";
  /** The reason the option is out (ruled out, or fails a requirement): shown first. */
  decisive?: boolean;
  /** A serious problem that costs the option points (shown right after decisive lines). */
  serious?: boolean;
  /** Couldn't be found on the stored page. */
  unverified?: boolean;
  /** Only reviews over a year old say it. */
  stale?: boolean;
  /** A passing thing later guests stopped mentioning: probably over (kept in the details, off the card). */
  faded?: boolean;
  /** The traveller said it's fine. */
  accepted?: boolean;
  /** The traveller said it matters to them ("Önemli, kalsın"): it rules the place out. */
  confirmed?: boolean;
  /** Only this place has it among the ones compared ("yalnız bunda"): what sets it apart, for or against. */
  unique?: boolean;
  /** Every place compared has it: true, but it doesn't help choose. */
  common?: boolean;
  /** A minor thing one review says: in the details, not on the card. */
  weak?: boolean;
  finding?: Finding;
}

export interface ProsCons {
  pros: ProCon[];
  cons: ProCon[];
}

type Ctx = Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> & { preferences?: string[] };

const LEVEL_WEIGHT = [0, 0.5, 1, 2, 3];
/** What only this place has among the ones compared weighs up to this much more (by how sure it is). */
const UNIQUE_BOOST = 0.6;
const SOURCE_TEXT: Readonly<Record<Finding["source"], string>> = liveLabels({
  reviews: ["yorumlarda", "in reviews"],
  description: ["açıklamada", "in the description"],
  amenities: ["olanaklarda", "in the amenities"],
  policy: ["kurallarda", "in the rules"],
  other: ["sayfada", "on the page"],
});

const capital = capitalize;
/** Where a comparison line comes from. */
const VS_OTHERS = () => L("diğerleriyle kıyasla", "compared with the others");
const UNVERIFIED = () => L("sayfada doğrulanamadı", "couldn't be confirmed on the page");
const minutesText = hoursMinutes;

/** A card's words for being near or far: what the distance is measured to decides them. */
function locationWords(display: string | null): [string, string] {
  const basis = locationBasis(display);
  if (basis === "centre") return [L("Merkeze yakın", "Close to the centre"), L("Merkeze uzak", "Far from the centre")];
  if (basis === "score") return [L("Konumu övülüyor", "Location praised"), L("Konumu zayıf", "Weak location")];
  return [L("Gezeceğin yerlere yakın", "Close to your places"), L("Gezeceğin yerlere uzak", "Far from your places")];
}

/** The same, as a tag: "Merkezi", "Uzak". */
function locationTags(display: string | null): [string, string] {
  const basis = locationBasis(display);
  if (basis === "centre") return [L("Merkezi", "Central"), L("Merkeze uzak", "Far from the centre")];
  if (basis === "score") return [L("Konum iyi", "Good location"), L("Konum zayıf", "Weak location")];
  return [L("Yakın", "Close"), L("Uzak", "Far")];
}

type Sides = readonly [tr: readonly [string, string], en: readonly [string, string]];
/** [for, against] in the current language. */
const sides = (s: Sides | undefined): [string, string] | undefined => (s ? [L(s[0][0], s[1][0]), L(s[0][1], s[1][1])] : undefined);

/** Tags for the comparisons that say the same thing for every option: [for, against]. */
const COMPARE_TAGS: Partial<Record<Part["criterion"], Sides>> = {
  rating: [["Puanı yüksek", "Puanı düşük"], ["High rating", "Low rating"]],
  comfort: [["Yorum puanları yüksek", "Yorum puanları düşük"], ["High review scores", "Low review scores"]],
  cancellation: [["Ücretsiz iptal", "İade yok"], ["Free cancellation", "Non-refundable"]],
  duration: [["Kısa yolculuk", "Uzun yolculuk"], ["Short journey", "Long journey"]],
  stops: [["Direkt", "Aktarmalı"], ["Direct", "With stops"]],
  schedule: [["Rahat saat", "Zor saat"], ["Easy times", "Hard hours"]],
  baggage: [["Bagaj dahil", "Bagaj yok"], ["Bag included", "No checked bag"]],
  data: [["Bol veri", "Az veri"], ["Plenty of data", "Little data"]],
  validity: [["Süre yetmiyor", "Süre yetmiyor"], ["Too short", "Too short"]],
};

/** What a finding is about, in a word or two, for when its own words are too long: [for, against]. */
const TOPIC_TAGS: Record<Finding["topic"], Sides> = {
  location: [["Konum iyi", "Konum zayıf"], ["Good location", "Weak location"]],
  nearby: [["Çevresi iyi", "Çevre sorunlu"], ["Nice area", "Rough area"]],
  transport: [["Ulaşım kolay", "Ulaşım zor"], ["Easy to get around", "Hard to get around"]],
  cleanliness: [["Temiz", "Temizlik sorunu"], ["Clean", "Cleanliness issues"]],
  comfort: [["Rahat", "Konforsuz"], ["Comfortable", "Uncomfortable"]],
  bed: [["İyi yatak", "Yatak kötü"], ["Good bed", "Bad bed"]],
  noise: [["Sessiz", "Gürültülü"], ["Quiet", "Noisy"]],
  space: [["Geniş", "Küçük"], ["Spacious", "Small"]],
  view: [["Manzaralı", "Manzara yok"], ["Has a view", "No view"]],
  staff: [["Güler yüzlü", "Personel sorunlu"], ["Friendly staff", "Staff issues"]],
  host: [["İyi ev sahibi", "Ev sahibi sorunlu"], ["Good host", "Host issues"]],
  food: [["Yemek iyi", "Yemek zayıf"], ["Good food", "Weak food"]],
  amenities: [["Olanaklar iyi", "Olanak eksik"], ["Good amenities", "Missing amenities"]],
  facilities: [["Tesis iyi", "Tesis eksik"], ["Good facilities", "Missing facilities"]],
  access: [["Erişim kolay", "Erişim zor"], ["Easy access", "Hard access"]],
  condition: [["Bakımlı", "Yıpranmış"], ["Well kept", "Worn"]],
  safety: [["Güvenli", "Güvenlik sorunu"], ["Safe", "Safety issues"]],
  value: [["Fiyatına değer", "Fiyatına değmez"], ["Good value", "Poor value"]],
  check_in: [["Kolay giriş", "Giriş zor"], ["Easy check-in", "Hard check-in"]],
  accuracy: [["İlandaki gibi", "İlandan farklı"], ["As listed", "Not as listed"]],
  other: [["Artısı var", "Dikkat"], ["A plus", "Watch out"]],
};
const topicTag = (topic: Finding["topic"], side: 0 | 1) => sides(TOPIC_TAGS[topic])![side];

/** Articles a card's few words do without: "çok iyi bir restoran" → "çok iyi restoran", "a great view" → "great view". */
const ARTICLES = new Set(["bir", "a", "an"]);

/**
 * A phrase's first clause when it's short enough ("Asansör yok, 3. kat" → "Asansör yok"), without the
 * article ("çok iyi bir restoran" → "çok iyi restoran").
 */
function fewWords(text: string, max = 3): string | null {
  const clause = text.split(/[,;:(—–]| - /)[0].trim();
  const words = clause.split(/\s+/).filter((w) => w && !ARTICLES.has(w.toLocaleLowerCase("tr")));
  return words.length && words.length <= max ? capital(words.join(" ")) : null;
}

/** The first clause, cut to a few words: "Balkondan nehir ve köprü manzarası…". */
function clip(text: string, max: number): string | null {
  const words = text.split(/[,;(—–]| - /)[0].trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return capital(words.slice(0, max).join(" ")) + (words.length > max ? "…" : "");
}

/**
 * A line as a card line, a few words: what was read keeps its own words when they're short
 * ("Karşısında genelev var", "Odalar küçük"), so the specific thing is never lost to a general word;
 * only a long sentence becomes its topic ("Gürültülü").
 */
export function tagOf(line: ProCon, polarity: "pro" | "con"): string {
  if (line.tag) return line.tag;
  const side = polarity === "pro" ? 0 : 1;
  // A finding keeps its own words, shortened if it must be ("Olanak eksik" says nothing).
  if (line.finding) {
    // Short enough whole ("Geniş, rahat yatak"): as it is; the first clause alone could say something else ("Geniş").
    if (line.text.trim().split(/\s+/).length <= 5) return capital(line.text.trim());
    return fewWords(line.text, 5) ?? clip(line.text, 5) ?? topicTag(line.finding.topic, side);
  }
  return fewWords(line.short ?? line.text, line.decisive ? 5 : 4) ?? fewWords(line.text, 4) ?? (line.short ?? line.text).split(/\s+/).slice(0, 4).join(" ");
}

/** Which end of a trip is at a hard hour, said with the hour: "Erken kalkış 05:40", "Geç varış 01:35". */
function hardHour(item: Item): string {
  const at = (iso: string | null | undefined) => iso?.match(/T(\d{2}):(\d{2})/);
  const dep = at(item.flight?.departure);
  const arr = at(item.flight?.arrival);
  if (dep && Number(dep[1]) < 7) return `${L("Erken kalkış", "Early departure")} ${dep[1]}:${dep[2]}`;
  if (arr && (Number(arr[1]) >= 23 || Number(arr[1]) < 5)) return `${L("Geç varış", "Late arrival")} ${arr[1]}:${arr[2]}`;
  if (dep && Number(dep[1]) >= 22) return `${L("Geç kalkış", "Late departure")} ${dep[1]}:${dep[2]}`;
  return L("Zor saat", "Hard hours");
}

/** Lines from comparing the option with the others in its group on the traveller's criteria. */
function comparisons(option: OptionResult, decision: GroupDecision, ctx: Ctx): { pros: ProCon[]; cons: ProCon[] } {
  const currency = ctx.currency;
  const pros: ProCon[] = [];
  const cons: ProCon[] = [];
  const peers = decision.options.filter((o) => o !== option && !o.excluded && o.parts.length);
  const single = peers.length === 0;
  const add = (list: ProCon[], p: Part, text: string, strength: number, short?: string, tag?: string) =>
    list.push({
      key: `c:${p.criterion}`,
      text,
      ...(short ? { short } : {}),
      tag: tag ?? sides(COMPARE_TAGS[p.criterion])?.[list === pros ? 0 : 1] ?? short ?? text,
      detail: single ? null : VS_OTHERS(),
      weight: p.weight * strength * 3,
      kind: "compare",
    });

  for (const p of option.parts) {
    if (p.criterion === "ai" || p.criterion === "details" || p.weight === 0 || p.s == null || p.value == null) continue;
    const others = peers.map((o) => o.parts.find((x) => x.criterion === p.criterion)).filter((x): x is Part => x?.value != null && x.s != null);
    const bestS = Math.max(p.s, ...others.map((o) => o.s!));
    switch (p.criterion) {
      case "price": {
        // Against what: the other one when there are two, the average of what was saved when more.
        if (!others.length) break;
        const values = others.map((o) => o.value!);
        const cheapest = Math.min(...values);
        if (values.length === 1) {
          const other = values[0];
          if (p.value < other - 0.5) {
            const less = formatPrice(other - p.value, currency);
            const text = L(`Diğerinden ${less} ucuz`, `${less} cheaper than the other`);
            add(pros, p, text, Math.min(1, (other - p.value) / other + 0.3), L(`${less} daha ucuz`, `${less} cheaper`), text);
          } else if (p.value > other * 1.03) {
            const more = formatPrice(p.value - other, currency);
            const text = L(`Diğerinden ${more} pahalı`, `${more} more than the other`);
            add(cons, p, text, Math.min(1, (p.value - other) / other + 0.2), L(`${more} daha pahalı`, `${more} more`), text);
          }
          break;
        }
        const average = (p.value + values.reduce((a, b) => a + b, 0)) / (values.length + 1);
        const gap = formatPrice(Math.abs(p.value - average), currency);
        const cheapestWord = L("En ucuz", "Cheapest");
        const below = L(`Ortalamadan ${gap} ucuz`, `${gap} below average`);
        const above = L(`Ortalamadan ${gap} pahalı`, `${gap} above average`);
        if (p.value < cheapest - 0.5) {
          add(pros, p, L(`En ucuz: ortalamadan ${gap} ucuz`, `Cheapest: ${gap} below average`), Math.min(1, (average - p.value) / average + 0.3), cheapestWord, cheapestWord);
        } else if (p.value < average * 0.97) {
          add(pros, p, below, Math.min(1, (average - p.value) / average + 0.2), below, below);
        } else if (p.value > average * 1.03) {
          add(cons, p, above, Math.min(1, (p.value - average) / average + 0.2), above, above);
        }
        break;
      }
      case "duration": {
        if (!others.length) break;
        const shortest = Math.min(...others.map((o) => o.value!));
        if (p.value < shortest - 10)
          add(pros, p, L(`En kısa yolculuk: ${minutesText(p.value)}`, `Shortest journey: ${minutesText(p.value)}`), 0.7, L("En kısa yolculuk", "Shortest journey"), L(`En kısa · ${minutesText(p.value)}`, `Shortest · ${minutesText(p.value)}`));
        else if (p.value > shortest * 1.3) {
          const longer = minutesText(p.value - shortest);
          add(cons, p, L(`${longer} daha uzun yolculuk`, `${longer} longer journey`), Math.min(1, (p.value - shortest) / shortest), L("Uzun yolculuk", "Long journey"), L(`${longer} daha uzun`, `${longer} longer`));
        }
        break;
      }
      case "location": {
        // The card says how far, not just "Yakın": "Gezeceğin yerlere 6 dk", "Uzak · merkeze 25 dk".
        const [near, far] = locationWords(p.display);
        const [nearTag, farTag] = locationTags(p.display);
        const exact = locationText(p.display);
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, capital(p.display ?? ""), p.s - 0.4, near, exact ?? nearTag);
        else if (p.s <= 0.4 || (!single && p.s < bestS - 0.3))
          add(cons, p, capital(p.display ?? ""), Math.max(0.3, 0.8 - p.s), far, exact ? `${L("Uzak", "Far")} · ${lowerText(exact)}` : farTag);
        break;
      }
      case "rating": {
        const score = (p.display ?? "").split(" · ")[0];
        const low = L("Puanı düşük", "Low rating");
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, `${L("Puan", "Rating")} ${p.display}`, p.s - 0.4, undefined, `${L("Puan", "Rating")} ${score}`);
        else if (p.s <= 0.4) add(cons, p, `${L("Puan düşük", "Low rating")}: ${p.display}`, 0.8 - p.s, low, `${low} · ${score}`);
        break;
      }
      case "comfort":
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, capital(p.display ?? ""), p.s - 0.4, L("Yorum puanları yüksek", "High review scores"));
        else if (p.s <= 0.4) add(cons, p, capital(p.display ?? ""), 0.8 - p.s, L("Yorum puanları düşük", "Low review scores"));
        break;
      case "cancellation": {
        const said = cancellationText(option.item, ctx.today).text;
        if (p.s >= 1) add(pros, p, capital(p.display ?? L("Ücretsiz iptal", "Free cancellation")), 0.6, undefined, said);
        else if (p.s <= 0.3) add(cons, p, capital(p.display ?? L("İade yok", "Non-refundable")), 0.7, undefined, said);
        break;
      }
      case "amenities": {
        // Only what tells options apart: an amenity others have and this one doesn't show.
        const wanted = wantedAmenities(ctx.trip);
        const mine = amenitiesOf(option.item, ctx);
        const theirs = new Set(peers.flatMap((o) => amenitiesOf(o.item, ctx)));
        const missing = wanted.filter((a) => !mine.includes(a) && theirs.has(a)).map(amenityLabel);
        const only = wanted.filter((a) => mine.includes(a) && peers.some((o) => !amenitiesOf(o.item, ctx).includes(a))).map(amenityLabel);
        if (only.length) {
          const has = L(`${capital(only[0])} var`, `Has ${only[0]}`);
          add(pros, p, L(`İstediğin: ${only.join(", ")}`, `What you want: ${only.join(", ")}`), 0.6, has, has);
        }
        if (missing.length) {
          const lacks = L(`${capital(missing[0])} yok`, `No ${missing[0]}`);
          add(cons, p, L(`Diğerlerinde var, bunda görünmüyor: ${missing.join(", ")}`, `The others have it, not shown here: ${missing.join(", ")}`), 0.5, lacks, lacks);
        }
        break;
      }
      case "stops": {
        const direct = L("Direkt", "Direct");
        const withStops = capital(p.display ?? L("Aktarmalı", "With stops"));
        if (p.s >= 1) add(pros, p, direct, 0.7, direct);
        else add(cons, p, withStops, 1 - p.s, undefined, withStops);
        break;
      }
      case "schedule":
        if (p.s < 0.7) add(cons, p, `${L("Zor saat", "Hard hours")}: ${p.display}`, 1 - p.s, L("Zor saat", "Hard hours"), hardHour(option.item));
        else if (p.s >= 1 && others.some((o) => o.s! < 0.7)) add(pros, p, `${L("Rahat saatler", "Easy times")}: ${p.display}`, 0.5, undefined, L("Rahat saat", "Easy times"));
        break;
      case "baggage":
        if (p.s >= 1) add(pros, p, L("Bagaj dahil", "Bag included"), 0.6);
        else add(cons, p, L("Yalnız kabin bagajı", "Cabin bag only"), 0.6);
        break;
      case "data":
        if (p.s >= 0.9) add(pros, p, capital(p.display ?? ""), 0.6);
        else if (p.s < 0.5) add(cons, p, `${L("Az veri", "Little data")}: ${p.display}`, 1 - p.s, L("Az veri", "Little data"));
        break;
      case "validity":
        if (p.s < 1) add(cons, p, `${L("Gezi süresine yetmiyor", "Doesn't cover the trip")}: ${p.display}`, 1 - p.s, L("Süre yetmiyor", "Too short"));
        break;
    }
  }
  if (option.dominatedBy) {
    cons.push({
      key: "c:dominated",
      text: L(`${option.dominatedBy} her açıdan önde`, `${option.dominatedBy} is ahead on everything`),
      tag: L("Her açıdan geride", "Behind on everything"),
      detail: VS_OTHERS(),
      weight: 6,
      kind: "compare",
    });
  }
  return { pros, cons };
}

/** How much a finding's topic matters to this traveller, from the level of the criterion it speaks to. */
function relevance(f: Finding, item: Item, ctx: Ctx): number {
  if ([...saidTopics(ctx.preferences ?? [])].some((t) => touchesTopic(f, t))) return SAID_WEIGHT;
  const level = levelFor(ctx.trip, item.category, TOPIC_CRITERION[f.topic], ctx.inferred);
  // Criteria that don't apply to the category (level 0 by default) still count a little: a finding is a fact.
  return Math.max(0.3, (LEVEL_WEIGHT[level] + 0.5) / 1.5);
}

function findingLines(listing: Listing, item: Item, ctx: Ctx, penalties: Set<string>, peers: Listing[] = []): { pros: ProCon[]; cons: ProCon[] } {
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  const confirmed = new Set(ctx.trip.confirmedFindings ?? []);
  const pros: ProCon[] = [];
  const cons: ProCon[] = [];
  // What the others' pages say (read ones only: an unread page says nothing either way).
  const theirs = peers.map((p) => p.findings.filter((f) => f.verified && !evidenceOf(f, p, ctx.today).faded));
  for (const f of listing.findings) {
    const e = evidenceOf(f, listing, ctx.today);
    const isAccepted = f.polarity === "negative" && accepted.has(acceptKey(listing.key, f));
    const isConfirmed = !isAccepted && f.polarity === "negative" && confirmed.has(acceptKey(listing.key, f));
    // Why a passing thing is in doubt: "son söz Mar 2026, sonraki 10 yorum bahsetmiyor".
    const doubt = f.polarity === "negative" ? stillText(e.still) : null;
    const newest = e.newest ? L(` · en yenisi ${monthLabel(e.newest)}`, ` · newest ${monthLabel(e.newest)}`) : "";
    const where = e.count ? `${nReviews(e.count)}${doubt ? ` · ${doubt}` : newest}` : SOURCE_TEXT[f.source];
    const penalized = penalties.has(f.id);
    const detail = !f.verified
      ? UNVERIFIED()
      : isAccepted
        ? L("sorun değil dedin", "you said it's not a problem")
        : isConfirmed
          ? L("önemli dedin", "you said it matters")
          : e.stale
            ? `${L("eski", "old")}: ${where}`
            : penalized
              ? `${where} · ${L("puandan", "points")} −${penaltyFor(f, listing, ctx.today)}`
              : where;
    // What sets it apart comes first; what every place has doesn't help choose.
    const matches = theirs.map((list) => list.some((o) => saysSame(f, o)));
    // Only here, and as sure as it is: a faded or one-guest minus isn't made bigger for being the only one.
    const unique = f.verified && !e.faded && theirs.length > 0 && !matches.some(Boolean);
    const common = theirs.length > 0 && matches.every(Boolean);
    const weak = isWeakFinding(f, listing, ctx.today);
    const weight =
      findingWeight(f, listing, ctx.today) * relevance(f, item, ctx) * (f.verified ? 1 : 0.3) * (isAccepted ? 0.2 : 1) * (unique ? 1 + UNIQUE_BOOST * standing(e) : common ? 0.6 : 1) * (weak ? 0.5 : 1);
    (f.polarity === "positive" ? pros : cons).push({
      key: `f:${f.id}`,
      text: f.text,
      detail,
      weight,
      kind: "finding",
      ...(f.verified ? {} : { unverified: true }),
      ...(e.stale ? { stale: true } : {}),
      ...(e.faded && !e.stale ? { faded: true } : {}),
      ...(isAccepted ? { accepted: true } : {}),
      ...(isConfirmed ? { confirmed: true } : {}),
      ...(penalized ? { serious: true } : {}),
      ...(unique ? { unique: true } : {}),
      ...(common ? { common: true } : {}),
      ...(weak ? { weak: true } : {}),
      finding: f,
    });
  }
  return { pros, cons };
}

export function prosCons(input: { item: Item; option?: OptionResult; decision?: GroupDecision; listing?: Listing; peers?: Listing[]; ctx: Ctx }): ProsCons {
  const { item, option, decision, listing, peers, ctx } = input;
  const pros: ProCon[] = [];
  const cons: ProCon[] = [];

  if (option?.eliminated) {
    const e = option.eliminated.findings.map((f) => (listing ? evidenceOf(f, listing, ctx.today) : null));
    const count = e.reduce((n, x) => n + (x?.count ?? 0), 0);
    const out = L("Elendi", "Ruled out");
    cons.push({
      key: "x:eliminated",
      text: `${out}: ${option.eliminated.reason}`,
      short: option.eliminated.reason,
      tag: `${out}: ${fewWords(option.eliminated.reason, 5) ?? topicTag(option.eliminated.findings[0]?.topic ?? "other", 1)}`,
      detail: count ? nReviews(count) : SOURCE_TEXT[option.eliminated.findings[0]?.source ?? "other"],
      weight: 1000,
      kind: "elimination",
      decisive: true,
      finding: option.eliminated.findings[0],
    });
  }
  for (const label of option?.unmet ?? []) {
    const must = `${L("Şart", "Must")}: ${label}`;
    cons.push({ key: `r:${label}`, text: L(`Şartın karşılanmıyor: ${label}`, `Doesn't meet your must: ${label}`), short: must, tag: must, detail: null, weight: 900, kind: "requirement", decisive: true });
  }
  for (const c of decision?.checks.filter((c) => c.itemId === item.id) ?? []) {
    cons.push({
      key: `k:${c.reason}`,
      text: L(`Kontrol gerekiyor: ${c.reason}`, `Needs a check: ${c.reason}`),
      tag: L("Kontrol et", "Check"),
      detail: UNVERIFIED(),
      weight: 8,
      kind: "check",
      unverified: true,
    });
  }
  for (const label of option?.limited ?? []) {
    const text =
      label === LIMITED.rate()
        ? L("Fiyat başka para biriminde; kur gelince karşılaştırılır", "Priced in another currency; compared once the rate comes in")
        : label === LIMITED.nights()
          ? L("Tarihsiz kaydedildi: bu gecelerin fiyatı belli değil", "Saved without dates: the price for these nights isn't known")
          : L(`${capital(label)} eksik; sayfayı tarih seçiliyken tekrar kaydet`, `${capital(label)} missing; save the page again with the dates picked`);
    const short = label === LIMITED.rate() ? L("Kur bekleniyor", "Waiting for the rate") : L("Fiyat geçici", "Price not final");
    cons.push({ key: `l:${label}`, text, short, detail: null, weight: 7, kind: "check" });
  }
  if (option?.coverage) {
    const c = option.coverage;
    const rest = c.of - c.nights;
    const dates = formatDateRange(c.range.start, c.range.end);
    cons.push({
      key: "v:coverage",
      text: L(
        `Yalnız ${dates} (${c.nights}/${c.of} gece): kalan ${rest} gece için ayrıca yer gerekir`,
        `Only ${dates} (${c.nights}/${c.of} nights): the other ${nNights(rest)} need${rest === 1 ? "s" : ""} another place`,
      ),
      short: L(`Yalnız ${c.nights}/${c.of} gece`, `Only ${c.nights}/${c.of} nights`),
      detail: L("fiyatı gece başına kıyaslandı", "price compared per night"),
      weight: 6,
      kind: "compare",
    });
  }
  for (const label of option?.unsure ?? []) {
    cons.push({ key: `u:${label}`, text: L(`Kontrol et: ${label} sayfada görünmüyor`, `Check: ${label} isn't on the page`), tag: `${capital(label)}?`, detail: null, weight: 2.5, kind: "check" });
  }

  if (option && decision) {
    const c = comparisons(option, decision, ctx);
    pros.push(...c.pros);
    cons.push(...c.cons);
  }

  if (listing?.readAt && listing.findings.length) {
    const f = findingLines(listing, item, ctx, new Set(option?.penalties.map((p) => p.id) ?? []), peers);
    pros.push(...f.pros);
    cons.push(...f.cons);
  } else {
    // Not read yet (or nothing to read): the extraction's short summary, labelled as such.
    const summary = L("sayfa özeti", "page summary");
    item.highlights.forEach((h, i) => pros.push({ key: `s:+${i}`, text: h, detail: summary, weight: 1.5, kind: "summary" }));
    item.concerns.forEach((h, i) => cons.push({ key: `s:-${i}`, text: h, detail: summary, weight: 1.5, kind: "summary" }));
  }

  // The reason it's out, then serious problems, then what only this place has, then the rest.
  const rank = (x: ProCon) => (x.decisive ? 3 : x.serious ? 2 : x.unique && !x.weak ? 1 : 0);
  const order = (a: ProCon, b: ProCon) => rank(b) - rank(a) || b.weight - a.weight;
  return { pros: pros.sort(order), cons: cons.sort(order) };
}

/** Pros and cons for an item from the board's decision data. */
export function prosConsFor(
  item: Item,
  decision: GroupDecision | undefined,
  listings: Map<string, Listing> | undefined,
  ctx: Ctx | undefined,
): ProsCons | null {
  if (!ctx) return null;
  const option = decision?.options.find((o) => o.item.id === item.id);
  // The other places it's weighed against, as read: what only this one has stands out.
  const peers = (decision?.options ?? [])
    .filter((o) => o.item.id !== item.id && listingKeyOf(o.item) !== listingKeyOf(item))
    .map((o) => listings?.get(listingKeyOf(o.item)))
    .filter((l): l is Listing => Boolean(l?.readAt && l.findings.length));
  return prosCons({ item, option, decision, listing: listings?.get(listingKeyOf(item)), peers, ctx });
}

/**
 * What fits on a card: the two pros and two cons that matter most, in their short form. The reason
 * an option is out comes first; unverified, outdated and "sorun değil" lines stay in the details.
 */
export function cardLines(pc: ProsCons | null, max = 2): { pros: ProCon[]; cons: ProCon[] } {
  if (!pc) return { pros: [], cons: [] };
  // Minor one-review things and what every place has stay in the details.
  const shown = (l: ProCon) =>
    !l.unverified && !l.stale && !l.faded && !l.accepted && !l.weak && !(l.common && !l.serious) && l.key !== "v:coverage" && (l.kind !== "check" || l.key.startsWith("l:"));
  const decisive = pc.cons.filter((l) => l.decisive);
  return {
    pros: pc.pros.filter(shown).slice(0, max),
    cons: [...decisive, ...pc.cons.filter((l) => !l.decisive && shown(l))].slice(0, max),
  };
}

/** A line's card text. */
export const shortText = (l: ProCon) => l.short ?? l.text;
