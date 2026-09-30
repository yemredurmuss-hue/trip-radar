// Why this one, why not that one, at a glance: for every saved option, what speaks for it and what
// against it, most important first, and the reason it is out (if it is) on top. Pure.
// Two sources: how the option compares with the others on the traveller's criteria (computed), and
// what was read on its pages (findings, each with the reviews or text behind it).
import {
  amenitiesOf,
  findingWeight,
  levelFor,
  SAID_WEIGHT,
  saidTopics,
  touchesTopic,
  wantedAmenities,
  SERIOUS_PENALTY,
  TOPIC_CRITERION,
  type DecisionContext,
  type GroupDecision,
  type OptionResult,
  type Part,
} from "./decision";
import { formatDateRange, formatPrice, listingKeyOf } from "./items";
import { acceptKey, evidenceOf, isWeakFinding, monthLabel, saysSame } from "./listing";
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
const SOURCE_TEXT: Record<Finding["source"], string> = {
  reviews: "yorumlarda",
  description: "açıklamada",
  amenities: "olanaklarda",
  policy: "kurallarda",
  other: "sayfada",
};

const capital = (t: string) => (t ? t.charAt(0).toLocaleUpperCase("tr") + t.slice(1) : t);

function minutesText(m: number): string {
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return h ? `${h} sa${rest ? ` ${rest} dk` : ""}` : `${rest} dk`;
}

/** A card's words for being near or far: what the distance is measured to decides them. */
function locationWords(display: string | null): [string, string] {
  if (display?.startsWith("merkeze")) return ["Merkeze yakın", "Merkeze uzak"];
  if (display?.startsWith("konum puanı")) return ["Konumu övülüyor", "Konumu zayıf"];
  return ["Gezeceğin yerlere yakın", "Gezeceğin yerlere uzak"];
}

/** The same, as a tag: "Merkezi", "Uzak". */
function locationTags(display: string | null): [string, string] {
  if (display?.startsWith("merkeze")) return ["Merkezi", "Merkeze uzak"];
  if (display?.startsWith("konum puanı")) return ["Konum iyi", "Konum zayıf"];
  return ["Yakın", "Uzak"];
}

/** Tags for the comparisons that say the same thing for every option: [for, against]. */
const COMPARE_TAGS: Partial<Record<Part["criterion"], [string, string]>> = {
  rating: ["Puanı yüksek", "Puanı düşük"],
  comfort: ["Yorum puanları yüksek", "Yorum puanları düşük"],
  cancellation: ["Ücretsiz iptal", "İade yok"],
  duration: ["Kısa yolculuk", "Uzun yolculuk"],
  stops: ["Direkt", "Aktarmalı"],
  schedule: ["Rahat saat", "Zor saat"],
  baggage: ["Bagaj dahil", "Bagaj yok"],
  data: ["Bol veri", "Az veri"],
  validity: ["Süre yetmiyor", "Süre yetmiyor"],
};

/** What a finding is about, in a word or two, for when its own words are too long: [for, against]. */
const TOPIC_TAGS: Record<Finding["topic"], [string, string]> = {
  location: ["Konum iyi", "Konum zayıf"],
  nearby: ["Çevresi iyi", "Çevre sorunlu"],
  transport: ["Ulaşım kolay", "Ulaşım zor"],
  cleanliness: ["Temiz", "Temizlik sorunu"],
  comfort: ["Rahat", "Konforsuz"],
  bed: ["İyi yatak", "Yatak kötü"],
  noise: ["Sessiz", "Gürültülü"],
  space: ["Geniş", "Küçük"],
  view: ["Manzaralı", "Manzara yok"],
  staff: ["Güler yüzlü", "Personel sorunlu"],
  host: ["İyi ev sahibi", "Ev sahibi sorunlu"],
  food: ["Yemek iyi", "Yemek zayıf"],
  amenities: ["Olanaklar iyi", "Olanak eksik"],
  facilities: ["Tesis iyi", "Tesis eksik"],
  access: ["Erişim kolay", "Erişim zor"],
  condition: ["Bakımlı", "Yıpranmış"],
  safety: ["Güvenli", "Güvenlik sorunu"],
  value: ["Fiyatına değer", "Fiyatına değmez"],
  check_in: ["Kolay giriş", "Giriş zor"],
  accuracy: ["İlandaki gibi", "İlandan farklı"],
  other: ["Artısı var", "Dikkat"],
};

/**
 * A phrase's first clause when it's short enough ("Asansör yok, 3. kat" → "Asansör yok"), without the
 * article ("çok iyi bir restoran" → "çok iyi restoran").
 */
function fewWords(text: string, max = 3): string | null {
  const clause = text.split(/[,;:(—–]| - /)[0].trim();
  const words = clause.split(/\s+/).filter((w) => w && w.toLocaleLowerCase("tr") !== "bir");
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
    return fewWords(line.text, 5) ?? clip(line.text, 5) ?? TOPIC_TAGS[line.finding.topic][side];
  }
  return fewWords(line.short ?? line.text, line.decisive ? 5 : 4) ?? fewWords(line.text, 4) ?? (line.short ?? line.text).split(/\s+/).slice(0, 4).join(" ");
}

/** Which end of a trip is at a hard hour, said with the hour: "Erken kalkış 05:40", "Geç varış 01:35". */
function hardHour(item: Item): string {
  const at = (iso: string | null | undefined) => iso?.match(/T(\d{2}):(\d{2})/);
  const dep = at(item.flight?.departure);
  const arr = at(item.flight?.arrival);
  if (dep && Number(dep[1]) < 7) return `Erken kalkış ${dep[1]}:${dep[2]}`;
  if (arr && (Number(arr[1]) >= 23 || Number(arr[1]) < 5)) return `Geç varış ${arr[1]}:${arr[2]}`;
  if (dep && Number(dep[1]) >= 22) return `Geç kalkış ${dep[1]}:${dep[2]}`;
  return "Zor saat";
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
      tag: tag ?? COMPARE_TAGS[p.criterion]?.[list === pros ? 0 : 1] ?? short ?? text,
      detail: single ? null : "diğerleriyle kıyasla",
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
            add(pros, p, `Diğerinden ${less} ucuz`, Math.min(1, (other - p.value) / other + 0.3), `${less} daha ucuz`, `Diğerinden ${less} ucuz`);
          } else if (p.value > other * 1.03) {
            const more = formatPrice(p.value - other, currency);
            add(cons, p, `Diğerinden ${more} pahalı`, Math.min(1, (p.value - other) / other + 0.2), `${more} daha pahalı`, `Diğerinden ${more} pahalı`);
          }
          break;
        }
        const average = (p.value + values.reduce((a, b) => a + b, 0)) / (values.length + 1);
        const gap = formatPrice(Math.abs(p.value - average), currency);
        if (p.value < cheapest - 0.5) {
          add(pros, p, `En ucuz: ortalamadan ${gap} ucuz`, Math.min(1, (average - p.value) / average + 0.3), `En ucuz`, "En ucuz");
        } else if (p.value < average * 0.97) {
          add(pros, p, `Ortalamadan ${gap} ucuz`, Math.min(1, (average - p.value) / average + 0.2), `Ortalamadan ${gap} ucuz`, `Ortalamadan ${gap} ucuz`);
        } else if (p.value > average * 1.03) {
          add(cons, p, `Ortalamadan ${gap} pahalı`, Math.min(1, (p.value - average) / average + 0.2), `Ortalamadan ${gap} pahalı`, `Ortalamadan ${gap} pahalı`);
        }
        break;
      }
      case "duration": {
        if (!others.length) break;
        const shortest = Math.min(...others.map((o) => o.value!));
        if (p.value < shortest - 10) add(pros, p, `En kısa yolculuk: ${minutesText(p.value)}`, 0.7, "En kısa yolculuk", `En kısa · ${minutesText(p.value)}`);
        else if (p.value > shortest * 1.3)
          add(cons, p, `${minutesText(p.value - shortest)} daha uzun yolculuk`, Math.min(1, (p.value - shortest) / shortest), "Uzun yolculuk", `${minutesText(p.value - shortest)} daha uzun`);
        break;
      }
      case "location": {
        // The card says how far, not just "Yakın": "Gezeceğin yerlere 6 dk", "Uzak · merkeze 25 dk".
        const [near, far] = locationWords(p.display);
        const [nearTag, farTag] = locationTags(p.display);
        const exact = locationText(p.display);
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, capital(p.display ?? ""), p.s - 0.4, near, exact ?? nearTag);
        else if (p.s <= 0.4 || (!single && p.s < bestS - 0.3)) add(cons, p, capital(p.display ?? ""), Math.max(0.3, 0.8 - p.s), far, exact ? `Uzak · ${exact.toLocaleLowerCase("tr")}` : farTag);
        break;
      }
      case "rating": {
        const score = (p.display ?? "").split(" · ")[0];
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, `Puan ${p.display}`, p.s - 0.4, undefined, `Puan ${score}`);
        else if (p.s <= 0.4) add(cons, p, `Puan düşük: ${p.display}`, 0.8 - p.s, "Puanı düşük", `Puanı düşük · ${score}`);
        break;
      }
      case "comfort":
        if (p.s >= 0.75 && p.s >= bestS - 0.05) add(pros, p, capital(p.display ?? ""), p.s - 0.4, "Yorum puanları yüksek");
        else if (p.s <= 0.4) add(cons, p, capital(p.display ?? ""), 0.8 - p.s, "Yorum puanları düşük");
        break;
      case "cancellation": {
        const said = cancellationText(option.item, ctx.today).text;
        if (p.s >= 1) add(pros, p, capital(p.display ?? "Ücretsiz iptal"), 0.6, undefined, said);
        else if (p.s <= 0.3) add(cons, p, capital(p.display ?? "İade yok"), 0.7, undefined, said);
        break;
      }
      case "amenities": {
        // Only what tells options apart: an amenity others have and this one doesn't show.
        const wanted = wantedAmenities(ctx.trip);
        const mine = amenitiesOf(option.item, ctx);
        const theirs = new Set(peers.flatMap((o) => amenitiesOf(o.item, ctx)));
        const missing = wanted.filter((a) => !mine.includes(a) && theirs.has(a));
        const only = wanted.filter((a) => mine.includes(a) && peers.some((o) => !amenitiesOf(o.item, ctx).includes(a)));
        if (only.length) add(pros, p, `İstediğin: ${only.join(", ")}`, 0.6, `${capital(only[0])} var`, `${capital(only[0])} var`);
        if (missing.length) add(cons, p, `Diğerlerinde var, bunda görünmüyor: ${missing.join(", ")}`, 0.5, `${capital(missing[0])} yok`, `${capital(missing[0])} yok`);
        break;
      }
      case "stops":
        if (p.s >= 1) add(pros, p, "Direkt", 0.7, "Direkt");
        else add(cons, p, capital(p.display ?? "Aktarmalı"), 1 - p.s, undefined, capital(p.display ?? "Aktarmalı"));
        break;
      case "schedule":
        if (p.s < 0.7) add(cons, p, `Zor saat: ${p.display}`, 1 - p.s, "Zor saat", hardHour(option.item));
        else if (p.s >= 1 && others.some((o) => o.s! < 0.7)) add(pros, p, `Rahat saatler: ${p.display}`, 0.5, undefined, "Rahat saat");
        break;
      case "baggage":
        if (p.s >= 1) add(pros, p, "Bagaj dahil", 0.6);
        else add(cons, p, "Yalnız kabin bagajı", 0.6);
        break;
      case "data":
        if (p.s >= 0.9) add(pros, p, capital(p.display ?? ""), 0.6);
        else if (p.s < 0.5) add(cons, p, `Az veri: ${p.display}`, 1 - p.s, "Az veri");
        break;
      case "validity":
        if (p.s < 1) add(cons, p, `Gezi süresine yetmiyor: ${p.display}`, 1 - p.s, "Süre yetmiyor");
        break;
    }
  }
  if (option.dominatedBy) {
    cons.push({ key: "c:dominated", text: `${option.dominatedBy} her açıdan önde`, tag: "Her açıdan geride", detail: "diğerleriyle kıyasla", weight: 6, kind: "compare" });
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
  const theirs = peers.map((p) => p.findings.filter((f) => f.verified && !evidenceOf(f, p, ctx.today).stale));
  for (const f of listing.findings) {
    const e = evidenceOf(f, listing, ctx.today);
    const isAccepted = f.polarity === "negative" && accepted.has(acceptKey(listing.key, f));
    const isConfirmed = !isAccepted && f.polarity === "negative" && confirmed.has(acceptKey(listing.key, f));
    const where = e.count ? `${e.count} yorum${e.newest ? ` · en yenisi ${monthLabel(e.newest)}` : ""}` : SOURCE_TEXT[f.source];
    const penalized = penalties.has(f.id);
    const detail = !f.verified
      ? "sayfada doğrulanamadı"
      : isAccepted
        ? "sorun değil dedin"
        : isConfirmed
          ? "önemli dedin"
          : e.stale
            ? `eski: ${where}`
            : penalized
              ? `${where} · puandan −${SERIOUS_PENALTY}`
              : where;
    // What sets it apart comes first; what every place has doesn't help choose.
    const matches = theirs.map((list) => list.some((o) => saysSame(f, o)));
    const unique = f.verified && theirs.length > 0 && !matches.some(Boolean);
    const common = theirs.length > 0 && matches.every(Boolean);
    const weak = isWeakFinding(f, listing, ctx.today);
    const weight =
      findingWeight(f, listing, ctx.today) * relevance(f, item, ctx) * (f.verified ? 1 : 0.3) * (isAccepted ? 0.2 : 1) * (unique ? 1.6 : common ? 0.6 : 1) * (weak ? 0.5 : 1);
    (f.polarity === "positive" ? pros : cons).push({
      key: `f:${f.id}`,
      text: f.text,
      detail,
      weight,
      kind: "finding",
      ...(f.verified ? {} : { unverified: true }),
      ...(e.stale ? { stale: true } : {}),
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
    cons.push({
      key: "x:eliminated",
      text: `Elendi: ${option.eliminated.reason}`,
      short: option.eliminated.reason,
      tag: `Elendi: ${fewWords(option.eliminated.reason, 5) ?? TOPIC_TAGS[option.eliminated.findings[0]?.topic ?? "other"][1]}`,
      detail: count ? `${count} yorum` : SOURCE_TEXT[option.eliminated.findings[0]?.source ?? "other"],
      weight: 1000,
      kind: "elimination",
      decisive: true,
      finding: option.eliminated.findings[0],
    });
  }
  for (const label of option?.unmet ?? []) {
    cons.push({ key: `r:${label}`, text: `Şartın karşılanmıyor: ${label}`, short: `Şart: ${label}`, tag: `Şart: ${label}`, detail: null, weight: 900, kind: "requirement", decisive: true });
  }
  for (const c of decision?.checks.filter((c) => c.itemId === item.id) ?? []) {
    cons.push({ key: `k:${c.reason}`, text: `Kontrol gerekiyor: ${c.reason}`, tag: "Kontrol et", detail: "sayfada doğrulanamadı", weight: 8, kind: "check", unverified: true });
  }
  for (const label of option?.limited ?? []) {
    const text =
      label === "kur bilgisi"
        ? "Fiyat başka para biriminde; kur gelince karşılaştırılır"
        : label === "bu gecelerin fiyatı"
          ? "Tarihsiz kaydedildi: bu gecelerin fiyatı belli değil"
          : `${capital(label)} eksik; sayfayı tarih seçiliyken tekrar kaydet`;
    cons.push({ key: `l:${label}`, text, short: label === "kur bilgisi" ? "Kur bekleniyor" : "Fiyat geçici", detail: null, weight: 7, kind: "check" });
  }
  if (option?.coverage) {
    const c = option.coverage;
    cons.push({
      key: "v:coverage",
      text: `Yalnız ${formatDateRange(c.range.start, c.range.end)} (${c.nights}/${c.of} gece): kalan ${c.of - c.nights} gece için ayrıca yer gerekir`,
      short: `Yalnız ${c.nights}/${c.of} gece`,
      detail: "fiyatı gece başına kıyaslandı",
      weight: 6,
      kind: "compare",
    });
  }
  for (const label of option?.unsure ?? []) {
    cons.push({ key: `u:${label}`, text: `Kontrol et: ${label} sayfada görünmüyor`, tag: `${capital(label)}?`, detail: null, weight: 2.5, kind: "check" });
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
    item.highlights.forEach((h, i) => pros.push({ key: `s:+${i}`, text: h, detail: "sayfa özeti", weight: 1.5, kind: "summary" }));
    item.concerns.forEach((h, i) => cons.push({ key: `s:-${i}`, text: h, detail: "sayfa özeti", weight: 1.5, kind: "summary" }));
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
    !l.unverified && !l.stale && !l.accepted && !l.weak && !(l.common && !l.serious) && l.key !== "v:coverage" && (l.kind !== "check" || l.key.startsWith("l:"));
  const decisive = pc.cons.filter((l) => l.decisive);
  return {
    pros: pc.pros.filter(shown).slice(0, max),
    cons: [...decisive, ...pc.cons.filter((l) => !l.decisive && shown(l))].slice(0, max),
  };
}

/** A line's card text. */
export const shortText = (l: ProCon) => l.short ?? l.text;
