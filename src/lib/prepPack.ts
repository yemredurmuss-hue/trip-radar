// Hazırlık's Bavul (v82 geçişi aşama 7; Etsy kararı T6 a, docs/superpowers/specs/2026-10-18-v82-gecis/etsy/etsy-kararlar.md;
// tasarım notu "v83 ek · Hazırlık"): one folded line at the end of the list, "Bavul · Emre için · Nisan havası, 16 gün ·
// 6/11 hazır · 2 alınacak". Open: what's known and asked (the bag from the flight's record, at most two questions), the
// groups with their reasons (the weather, the places on the plan, electronics, papers and money; a kind's own: camp,
// festival), a shop link on what's still to buy, "bana göre değil" (×) on every line, and the traveller's own "Her gezide
// götürdüklerin" with "+ Ekle".
//
// The list is the AI's suggestion made once for the trip (packPrompt → acceptPack, stored on trip.packing.list), else
// worked out each time from what the trip knows (rulesPack: the weather the hero read, the kind's own lines, the plugs,
// the papers). A line said "bana göre değil" is never suggested again, on any trip: the traveller's own lists live in
// chrome.storage.local (packMine), never in IndexedDB. A chore the chat or the start put on Hazırlık as a bare thing to
// take ("Çadır", "Uyku tulumu") is a Bavul line too (isPackLine), ticked on its own record. Pure, but for the two
// storage helpers (a KV passed in).
import { z } from "zod";
import type { CityWeather } from "./climate";
import { countryInfo } from "./countries";
import { L } from "./i18n";
import { locative } from "./i18nText";
import { metricsOf } from "./items";
import { isPrep } from "./prep";
import { choreText, isRental } from "./travelKinds";
import type { KV } from "./share/store";
import type { Item, PackAsk, PackGroup, PackLine, PackList, PackTip, TripIntent } from "./types";
import type { PlugFit } from "./heroInfo";
import type { Visa } from "./visa";

/** A line's identity, its words aside from case and spacing ("Priz dönüştürücü" = "priz  dönüştürücü."). */
export const packKey = (name: string): string =>
  name
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!…]+$/u, "")
    .trim();

/**
 * A Hazırlık record that is a thing to take rather than a chore: said as Hazırlık (the chat's or the start's kind `prep`),
 * a bare thing ("Çadır", "Kulak tıkacı"), no verb and no chore word ("Decathlon'dan yağmurluk al" stays a chore). One the
 * traveller moved here by hand stays a chore.
 */
export const isPackLine = (item: Item): boolean => isPrep(item) && item.plannedKind === "prep" && typeof item.prep !== "boolean" && !choreText(item.name);

// --- what the trip knows: the list without the AI -----------------------------------------------------------------

export interface PackFacts {
  /** The cities' weather as the hero read it (its cache), each once. */
  weather: CityWeather[];
  /** The trip's first and last day. */
  range: { start: string; end: string } | null;
  /** The kind's own lines (playbooks: a festival's tent, a ski trip's gloves) under its word ("Festival"). */
  kind: { title: string; lines: string[] } | null;
  /** The trip's main country and the traveller's own (ISO), and the country's name. */
  country: string | null;
  countryName: string | null;
  home: string | null;
  plug: PlugFit | null;
  visa: Visa | null;
  /** The money there by name ("Euro"), when it isn't the traveller's own. */
  money: string | null;
  /** A car rented on the plan: a driving licence goes in. */
  driving: boolean;
}

/** The trip's days, first and last counted (1–16 Nisan: 16). */
export function tripDays(range: PackFacts["range"]): number {
  if (!range) return 0;
  const n = Math.round((Date.parse(`${range.end}T12:00:00Z`) - Date.parse(`${range.start}T12:00:00Z`)) / 86_400_000) + 1;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const line = (name: string, why: string | null = null, buy = false): PackLine => ({ name, why, buy });

/** A city is rainy for packing when a third of its days have rain (or the sky says so). */
const rainy = (w: CityWeather) => w.sky === "rain" || (w.days > 0 && w.rainy / w.days >= 1 / 3);

function weatherGroup(weather: CityWeather[]): PackGroup | null {
  if (!weather.length) return null;
  const low = Math.min(...weather.map((w) => w.low));
  const high = Math.max(...weather.map((w) => w.high));
  const wet = weather.filter(rainy);
  const rainNote = wet.length === 1 ? L(`, ${locative(wet[0].city)} yağmur`, `, rain in ${wet[0].city}`) : wet.length > 1 ? L(", yağmurlu günler", ", rainy days") : "";
  const lines: PackLine[] = [];
  if (wet.length) lines.push(line(L("Yağmurluk", "Rain jacket"), wet.length === 1 ? L(`${wet[0].city} için`, `for ${wet[0].city}`) : null));
  if (low <= 8) lines.push(line(L("Kalın mont", "Warm coat"), L(`akşamları ${low}°`, `${low}° in the evenings`)));
  else if (low <= 15) lines.push(line(L("İnce mont", "Light jacket"), L(`akşamları ${low}°`, `${low}° in the evenings`)));
  if (high >= 26) lines.push(line(L("Güneş kremi, şapka", "Sunscreen, a hat"), L(`gündüz ${high}°`, `${high}° by day`)));
  if (high - low >= 10) lines.push(line(L("Kat kat giyim", "Layers")));
  return lines.length ? { title: `${L("Hava", "Weather")} · ${low}–${high}°${rainNote}`, lines } : null;
}

function plugGroup(f: PackFacts): PackGroup | null {
  if (!f.plug || f.plug === "fits") return null;
  const there = countryInfo(f.country)?.plugs ?? [];
  const mine = countryInfo(f.home)?.plugs ?? [];
  const need = there.filter((p) => !mine.includes(p));
  if (!need.length) return null;
  const types = there.join(L(" ve ", " and "));
  return {
    title: L("Elektronik", "Electronics"),
    lines: [line(L(`Priz dönüştürücü (${need[0]} tipi)`, `Plug adapter (type ${need[0]})`), f.countryName ? L(`${f.countryName} ${types} tipi`, `${f.countryName}: type ${types}`) : null, true)],
  };
}

function papersGroup(f: PackFacts): PackGroup | null {
  const lines: PackLine[] = [];
  if (f.country && f.home && f.country !== f.home) lines.push(line(L("Pasaport", "Passport")));
  if (f.visa?.kind === "visa") lines.push(line(f.visa.label, L("vize gerekiyor", "a visa is needed")));
  if (f.driving) lines.push(line(L("Ehliyet", "Driving licence"), L("plandaki araç kiralama için", "for the car rental on the plan")));
  if (f.money) lines.push(line(L(`Kart ve biraz ${f.money}`, `A card and some cash (${f.money})`)));
  return lines.length ? { title: L("Belgeler ve para", "Papers and money"), lines } : null;
}

/** The Bavul without the AI: only what the trip says (the weather read, the kind's own lines, the plugs, the papers). */
export function rulesPack(f: PackFacts): PackGroup[] {
  const kind = f.kind && f.kind.lines.length ? { title: f.kind.title, lines: f.kind.lines.map((n) => line(n)) } : null;
  return [weatherGroup(f.weather), kind, plugGroup(f), papersGroup(f)].filter((g): g is PackGroup => g != null);
}

/** The questions the trip's own list asks: washing on a long trip (its answer adds what it takes). */
export function rulesAsk(range: PackFacts["range"]): PackAsk[] {
  const days = tripDays(range);
  if (days < 8) return [];
  return [
    {
      id: "laundry",
      text: L(`${days} günde çamaşır yıkayacak mısın?`, `Will you do laundry in ${days} days?`),
      options: [
        { label: L("Evet", "Yes"), add: [line(L("Seyahat deterjanı", "Travel laundry soap"))] },
        { label: L("Hayır", "No"), add: [line(L(`${days} günlük iç çamaşırı ve çorap`, `Underwear and socks for ${days} days`))] },
      ],
    },
  ];
}

/** "Valiz · 20 kg · bagaj dahil (TP 1760)": the bag the first booked or chosen flight says it carries; null when none says. */
export function bagFact(items: Item[]): string | null {
  const flight = items
    .filter((i) => i.category === "flight" && (i.status === "booked" || i.status === "chosen") && !i.cancelledAt && metricsOf(i).checkedBagIncluded != null)
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "9").localeCompare(b.flight?.departure ?? b.dates.start ?? "9"))[0];
  if (!flight) return null;
  const no = flight.flight?.flightNumber?.trim() || flight.flight?.carrier?.trim() || null;
  const at = no ? ` (${no})` : "";
  if (!metricsOf(flight).checkedBagIncluded) return L(`Yalnız kabin bagajı${at}`, `Cabin bag only${at}`);
  const kg = [flight.optionDetail, flight.name].map((t) => t?.match(/(\d{1,2})\s?kg/i)?.[1]).find(Boolean);
  return L(`Valiz${kg ? ` · ${kg} kg` : ""} · bagaj dahil${at}`, `Suitcase${kg ? ` · ${kg} kg` : ""} · bag included${at}`);
}

const liveItem = (i: Item) => i.status !== "dismissed" && !i.cancelledAt;

/** The cities slept in, in the order of their nights, each once (the weather is read for them). */
export function stayCities(items: Item[]): string[] {
  const stays = items.filter((i) => liveItem(i) && i.category === "stay" && i.city?.trim()).sort((a, b) => (a.dates.start ?? "9").localeCompare(b.dates.start ?? "9"));
  const out: string[] = [];
  for (const s of stays) if (!out.some((c) => packKey(c) === packKey(s.city!))) out.push(s.city!.trim());
  return out;
}

/** The cities with their nights, as the model is told them ("Porto 2026-10-08–2026-10-11"). */
export function stayLines(items: Item[]): string[] {
  return stayCities(items).map((city) => {
    const there = items.filter((i) => liveItem(i) && i.category === "stay" && i.city && packKey(i.city) === packKey(city));
    const start = there.map((i) => i.dates.start).filter(Boolean).sort()[0];
    const end = there.map((i) => i.dates.end).filter(Boolean).sort().at(-1);
    return start && end ? `${city} ${start}–${end}` : city;
  });
}

/** What's on the plan that a bag hangs on, by name: the tours and tickets chosen, the things to do, a stay that isn't a room. */
export function planNames(items: Item[]): string[] {
  const named = items
    .filter((i) => liveItem(i) && (i.status === "chosen" || i.status === "booked") && (i.category === "activity" || i.plannedKind === "todo" || i.category === "transport"))
    .map((i) => i.name.trim());
  const sleeps = items
    .filter((i) => liveItem(i) && i.category === "stay")
    .map((i) => metricsOf(i).stayKind)
    .filter((k): k is "camp" | "boat" | "vehicle" => k === "camp" || k === "boat" || k === "vehicle")
    .map((k) => `stay: ${k}`);
  return [...new Set([...named, ...sleeps])].slice(0, 14);
}

/** A car rented on the plan (a driving licence goes in the bag). */
export const drivesOnTrip = (items: Item[]): boolean => items.some((i) => liveItem(i) && (i.status === "chosen" || i.status === "booked") && isRental(i));

/** The kind's word for the Bavul ("Festival", "Kayak"; a model-made kind by its own words), null for a classic trip. */
export function kindWord(intent: TripIntent | null | undefined): string | null {
  switch (intent?.playbook) {
    case "festival":
      return L("Festival", "Festival");
    case "ski":
      return L("Kayak", "Skiing");
    case "honeymoon":
      return L("Balayı", "Honeymoon");
    case "wellness":
      return L("Wellness", "Wellness");
    case "custom":
      return intent.custom?.label?.trim() || intent.label?.trim() || null;
    default:
      return null;
  }
}

// --- the list on screen: the suggestion, the records, the answers, the traveller's own --------------------------------

export interface PackRow {
  key: string;
  name: string;
  why: string | null;
  buy: boolean;
  ready: boolean;
  /** The Hazırlık record it is (ticked on itself), or null for a line of the suggestion. */
  item: Item | null;
}

export interface PackAskView {
  id: string;
  text: string;
  options: string[];
  /** The option picked, or null while it's asked. */
  answer: string | null;
}

export interface PackView {
  groups: { title: string; rows: PackRow[] }[];
  asks: PackAskView[];
  total: number;
  ready: number;
  /** Lines still to buy and not packed: "2 alınacak". */
  toBuy: number;
}

export interface PackViewInput {
  groups: PackGroup[];
  ask: PackAsk[];
  answers: Record<string, string>;
  /** Keys ticked as packed on this trip. */
  ready: readonly string[];
  /** Hazırlık's records that are things to take (isPackLine), and the group they go under when the list doesn't have them. */
  records: Item[];
  recordsTitle: string;
  /** The traveller's own: never suggested, and taken on every trip (shown apart, not counted). */
  never: readonly string[];
  always: readonly string[];
}

/** The Bavul as drawn: the groups with each line once, a record in the place of the same line, the answers' lines, the counts. */
export function packView(input: PackViewInput): PackView {
  const never = new Set(input.never.map(packKey));
  const always = new Set(input.always.map(packKey));
  const ready = new Set(input.ready);
  const seen = new Set<string>();
  const groups: { title: string; rows: PackRow[] }[] = [];
  const records = new Map(input.records.map((r) => [packKey(r.name), r]));
  const place = (title: string, l: PackLine) => {
    const key = packKey(l.name);
    if (!key || seen.has(key) || always.has(key)) return;
    const item = records.get(key) ?? null;
    // A suggested line said "bana göre değil" is gone; a record is the traveller's own and stays.
    if (!item && never.has(key)) return;
    seen.add(key);
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, rows: [] }));
    g.rows.push({ key, name: item?.name ?? l.name, why: l.why ?? (item?.summary?.trim() || null), buy: l.buy, ready: item ? Boolean(item.doneAt) : ready.has(key), item });
  };
  for (const g of input.groups) for (const l of g.lines) place(g.title, l);
  const answersTitle = L("Cevaplarına göre", "From your answers");
  for (const a of input.ask) {
    const picked = a.options.find((o) => o.label === input.answers[a.id]);
    for (const l of picked?.add ?? []) place(answersTitle, l);
  }
  for (const r of input.records) place(input.recordsTitle, line(r.name, r.summary?.trim() || null));
  const rows = groups.flatMap((g) => g.rows);
  return {
    groups: groups.filter((g) => g.rows.length),
    asks: input.ask.map((a) => ({ id: a.id, text: a.text, options: a.options.map((o) => o.label), answer: a.options.some((o) => o.label === input.answers[a.id]) ? input.answers[a.id] : null })),
    total: rows.length,
    ready: rows.filter((r) => r.ready).length,
    toBuy: rows.filter((r) => r.buy && !r.ready).length,
  };
}

/** "6/11 hazır · 2 alınacak". */
export const packCount = (v: Pick<PackView, "ready" | "total" | "toBuy">): string =>
  L(`${v.ready}/${v.total} hazır${v.toBuy ? ` · ${v.toBuy} alınacak` : ""}`, `${v.ready}/${v.total} packed${v.toBuy ? ` · ${v.toBuy} to buy` : ""}`);

/** "Emre için · Ekim havası, 7 gün, festival": whose list it is and what it goes by; only what's known. */
export function packSub(o: { name: string | null; month: string | null; weather: boolean; days: number; kind: string | null; places: boolean }): string {
  const by = [o.weather && o.month ? L(`${o.month} havası`, `${o.month} weather`) : null, o.days ? L(`${o.days} gün`, o.days === 1 ? "1 day" : `${o.days} days`) : null, o.kind, o.places ? L("plandaki yerler", "the places on the plan") : null]
    .filter((x): x is string => Boolean(x))
    .join(", ");
  const who = o.name?.trim() ? L(`${o.name.trim()} için`, `For ${o.name.trim()}`) : null;
  return [who, by].filter(Boolean).join(" · ");
}

// --- the AI's list, made once ----------------------------------------------------------------------------------------

export const PACK_LIMITS = { groups: 6, lines: 8, total: 30, ask: 2, options: 3, tips: 4 } as const;

const lineSchema = z.object({ name: z.string(), why: z.string().nullable(), buy: z.boolean() });
export const packSchema = z.object({
  groups: z.array(z.object({ title: z.string(), lines: z.array(lineSchema) })),
  ask: z.array(z.object({ id: z.string(), text: z.string(), options: z.array(z.object({ label: z.string(), add: z.array(lineSchema) })) })),
  tips: z.array(z.object({ label: z.string(), text: z.string() })),
});
export type PackAnswer = z.infer<typeof packSchema>;

export interface PackPromptInput {
  countries: string[];
  /** Each city with its days ("Porto 8–11 Eki"). */
  cities: string[];
  range: { start: string; end: string } | null;
  people: number | null;
  /** The kind of trip in words ("Festival", "Liveaboard dalış"). */
  kind: string | null;
  weather: CityWeather[];
  /** What's on the plan, by name: the tours, the tickets, the things to do, how one sleeps (a camp, a boat). */
  plan: string[];
  bag: string | null;
  plug: string | null;
  home: string | null;
  never: readonly string[];
  always: readonly string[];
}

export const packSystemPrompt = (): string =>
  L(
    [
      "Bir gezgin için bavul listesi hazırlıyorsun. Yalnız verdiğim gezi bilgilerine dayan: hava, gün sayısı, gezinin türü, plandaki yerler ve etkinlikler.",
      "En fazla 6 grup; her grubun başlığı nedenini söylesin (ör. \"Hava · 6–19°, Kyoto'da yağmur\", \"Plandaki yerler\", \"Elektronik\", \"Belgeler ve para\"; kampta \"Kamp\", festivalde \"Festival\").",
      "Her satır kısa bir eşya adı; why kısa nedeni (ör. \"Kyoto için\", \"tapınaklarda ayakkabı çıkarılır\") ya da null. Fiyat, marka, mağaza yazma.",
      "buy: yalnız çoğu kişinin evinde olmayan ve yola çıkmadan alınması gereken şey için true (priz dönüştürücü, kamp malzemesi); gerisi false.",
      "En çok 2 soru sor (ask), yalnız cevabı listeyi gerçekten değiştiriyorsa (ör. uzun gezide çamaşır yıkamak); her seçeneğin add alanına o cevapla eklenecek satırları yaz.",
      "tips: o ülkede günlük hayatta bilmeye değer en çok 4 kısa bilgi (bahşiş, ayakkabı, toplu taşıma, nakit ve kart alışkanlığı); label tek kelime, text tek cümle. Emin olmadığını yazma; acil numara, büyükelçilik, kur ve priz yazma.",
      "never listesindekileri asla önerme; always listesindekileri tekrar yazma. Türkçe yaz.",
    ].join(" "),
    [
      "You are making a packing list for a traveller. Rest only on the trip facts given: the weather, the number of days, the kind of trip, the places and activities on the plan.",
      "At most 6 groups; each group's title says its reason (e.g. \"Weather · 6–19°, rain in Kyoto\", \"Places on the plan\", \"Electronics\", \"Papers and money\"; \"Camp\" for a camp, \"Festival\" for a festival).",
      "Each line is a short item name; why is a short reason (\"for Kyoto\", \"shoes come off in temples\") or null. No prices, brands or shops.",
      "buy: true only for something most people don't have at home and must get before leaving (a plug adapter, camping gear); else false.",
      "Ask at most 2 questions (ask), only when the answer really changes the list (e.g. doing laundry on a long trip); put in each option's add the lines that answer adds.",
      "tips: at most 4 short things worth knowing for daily life in that country (tipping, shoes, public transport, cash and card habits); label one word, text one sentence. Don't write what you aren't sure of; no emergency numbers, embassy, exchange rate or plugs.",
      "Never suggest what's in the never list; don't repeat what's in the always list. Write in English.",
    ].join(" "),
  );

/** The trip as the model is told it: facts only, one per line. */
export function packPrompt(p: PackPromptInput): string {
  const rows = [
    p.countries.length ? `countries: ${p.countries.join(", ")}` : null,
    p.cities.length ? `cities: ${p.cities.join("; ")}` : null,
    p.range ? `dates: ${p.range.start} – ${p.range.end} (${tripDays(p.range)} days)` : null,
    p.people ? `people: ${p.people}` : null,
    p.kind ? `kind: ${p.kind}` : null,
    ...p.weather.map((w) => `weather ${w.city}: ${w.low}–${w.high}°C, rain on ${w.rainy}/${w.days} days (${w.source})`),
    p.plan.length ? `on the plan: ${p.plan.join("; ")}` : null,
    p.bag ? `baggage: ${p.bag}` : null,
    p.plug ? `plugs: ${p.plug}` : null,
    p.home ? `traveller's country: ${p.home}` : null,
    p.never.length ? `never: ${p.never.join("; ")}` : null,
    p.always.length ? `always: ${p.always.join("; ")}` : null,
  ];
  return `<trip>\n${rows.filter(Boolean).join("\n")}\n</trip>`;
}

/** A model's words kept short, on one line, with no link in them. */
const clip = (text: string | null | undefined, max: number): string | null => {
  const t = (text ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/**
 * The model's answer as the Bavul keeps it: within the limits, each line once (across groups), nothing said "bana göre
 * değil", empty groups and questions without two answers dropped. Null when no line is left.
 */
export function acceptPack(raw: PackAnswer, now: number, never: readonly string[] = []): PackList | null {
  const no = new Set(never.map(packKey));
  const seen = new Set<string>();
  const keep = (l: z.infer<typeof lineSchema>): PackLine | null => {
    const name = clip(l.name, 48);
    if (!name) return null;
    const key = packKey(name);
    if (seen.has(key) || no.has(key)) return null;
    seen.add(key);
    return { name, why: clip(l.why, 70), buy: Boolean(l.buy) };
  };
  let total = 0;
  const groups: PackGroup[] = [];
  for (const g of raw.groups.slice(0, PACK_LIMITS.groups)) {
    const title = clip(g.title, 48);
    if (!title) continue;
    const lines: PackLine[] = [];
    for (const l of g.lines) {
      if (lines.length >= PACK_LIMITS.lines || total >= PACK_LIMITS.total) break;
      const kept = keep(l);
      if (kept) {
        lines.push(kept);
        total++;
      }
    }
    if (lines.length) groups.push({ title, lines });
  }
  if (!groups.length) return null;
  const ask: PackAsk[] = [];
  for (const [n, a] of raw.ask.entries()) {
    if (ask.length >= PACK_LIMITS.ask) break;
    const text = clip(a.text, 90);
    const options = a.options
      .slice(0, PACK_LIMITS.options)
      .map((o) => ({ label: clip(o.label, 16), add: o.add.map(keep).filter((l): l is PackLine => l != null).slice(0, 4) }))
      .filter((o): o is { label: string; add: PackLine[] } => o.label != null);
    if (text && options.length >= 2 && new Set(options.map((o) => o.label)).size === options.length) ask.push({ id: clip(a.id, 24) ?? `q${n + 1}`, text, options });
  }
  const tips: PackTip[] = raw.tips
    .map((t) => ({ label: clip(t.label, 24), text: clip(t.text, 160) }))
    .filter((t): t is PackTip => t.label != null && t.text != null)
    .slice(0, PACK_LIMITS.tips);
  return { at: now, groups, ask, tips };
}

// --- the traveller's own lists (chrome.storage.local) -----------------------------------------------------------------

/** What goes on every trip ("Her gezide götürdüklerin") and what's never for them ("bana göre değil"), by name. */
export interface PackMine {
  always: string[];
  never: string[];
}

const MINE_KEY = "packMine";
const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : []);

export async function loadPackMine(kv: KV): Promise<PackMine> {
  const v = await kv.get<Partial<PackMine>>(MINE_KEY);
  return { always: names(v?.always), never: names(v?.never) };
}

export const savePackMine = (mine: PackMine, kv: KV): Promise<void> => kv.set(MINE_KEY, mine);

/** The list with a name added once (case and spacing aside) or taken off. */
export function withName(list: readonly string[], name: string, on: boolean): string[] {
  const key = packKey(name);
  const rest = list.filter((x) => packKey(x) !== key);
  return on && key ? [...rest, name.trim()] : rest;
}
