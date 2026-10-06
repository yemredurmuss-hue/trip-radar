// What a trip is for, when it is an event or a theme (2026-10-06, "burning man africa"): a small built-in table of
// major recurring events and seasons, read by the code at once (no model needed). Each entry has its names in Turkish
// and English (endings typed on read too: "AfrikaBurn'e", "Oktoberfest'e"), the place and its country, the gateway
// city flights land in, a rule for its usual dates (computed for the next time it comes after today) and the official
// site. Dates are never presented as confirmed: they are the usual pattern, always "tahmini", with the link to check.
// Pure; nothing but i18n.
//
// The lunar and irregular dates (Holi, Diwali, Chinese New Year, Hajj) come from year tables that run to 2028–29
// (TABLE_LAST_YEAR); tests/startIntent.test.ts fails once today passes the last year of any of them: extend them then.
import { L, lang, type Lang } from "./i18n";

/** What the traveller is going for: an event (fixed dates), a place, or a theme (a season, a sight). */
export interface Intent {
  kind: "event" | "place" | "theme";
  /** "AfrikaBurn", "Kuzey Işıkları" (in the chat's language). */
  name: string;
  /** Where it happens: "Tankwa Karoo" (the trip's destination). */
  place: string;
  country: string | null;
  code?: string | null;
  /** Its dates the next time it comes (inclusive days); approx unless the traveller confirmed them. Null: a season or unknown. */
  dates?: { start: string; end: string; approx: boolean } | null;
  url?: string | null;
  /** The table's id, when it came from the table. */
  id?: string | null;
  /** The city flights land in and the days around it are spent in ("Cape Town"); null when it is the place itself. */
  gateway?: string | null;
  /** A theme's places, in travel order (the route). */
  places?: { city: string; code?: string | null }[];
  /** Its usual time in words ("Nisan sonu – Mayıs başı"). */
  typical?: string | null;
}

type Pair = [string, string];
type Span = [string, string];

export interface EventEntry {
  id: string;
  kind: "event" | "theme";
  name: Pair;
  aliases: string[];
  /** On the normalised text: the entry matches (above any alias of one word). */
  match?: RegExp;
  /** On the normalised text: never this entry ("burning man africa" is not Burning Man). */
  notIf?: RegExp;
  place: Pair;
  code: string;
  gateway?: Pair;
  places?: { name: Pair; code?: string }[];
  typical: Pair;
  /** The inclusive days it runs in a year, or null (none that year). */
  occur?: (y: number) => Span | null;
  /** The next time after today, for one that comes more often than yearly (a full moon). */
  next?: (today: string) => Span | null;
  url: string;
}

// --- dates (UTC, "YYYY-MM-DD") ---------------------------------------------------------------------------------------

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export const plusDays = (date: string, n: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
/** Days from a to b. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** The first `weekday` (0 Sun … 6 Sat) on or after the day. */
const onOrAfter = (y: number, m: number, d: number, weekday: number) => {
  const first = ymd(y, m, d);
  return plusDays(first, (weekday - dow(first) + 7) % 7);
};
/** The n-th `weekday` of the month (n = -1: the last). */
const nth = (y: number, m: number, weekday: number, n: number) => {
  if (n > 0) return plusDays(onOrAfter(y, m, 1, weekday), 7 * (n - 1));
  const last = ymd(y, m + 1, 0);
  return plusDays(last, -((dow(last) - weekday + 7) % 7));
};
const span = (start: string, days: number): Span => [start, plusDays(start, days - 1)];
/** Easter Sunday (the Gregorian computus). */
export function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}
const fromEaster = (y: number, from: number, to: number): Span => [plusDays(easter(y), from), plusDays(easter(y), to)];
/** The last year each event's year table knows (its dates by a lunar or irregular calendar). */
export const TABLE_LAST_YEAR: Record<string, number> = {};
const lastYear = (id: string, table: Record<number, unknown>) => (TABLE_LAST_YEAR[id] = Math.max(...Object.keys(table).map(Number)));
/** By a table of years (lunar calendars); none for a year it doesn't list. */
function byYear(id: string, table: Record<number, Span>) {
  lastYear(id, table);
  return (y: number): Span | null => table[y] ?? null;
}
/** A table of each year's main day, and the days around it. */
function dayTable(id: string, table: Record<number, string>, before: number, after: number) {
  lastYear(id, table);
  return (y: number): Span | null => (table[y] ? [plusDays(table[y], -before), plusDays(table[y], after)] : null);
}

/** The next full moon after today (in Thailand's time), and the morning after. */
export function nextFullMoon(today: string): Span {
  const ref = Date.UTC(2000, 0, 21, 4, 40); // a full moon (the lunar eclipse of 21 January 2000)
  const period = 29.530588853 * 86_400_000;
  const t = Date.parse(`${today}T00:00:00Z`);
  let k = Math.ceil((t - ref) / period);
  for (;;) {
    const local = new Date(ref + k * period + 7 * 3_600_000).toISOString().slice(0, 10);
    if (local > today) return [local, plusDays(local, 1)];
    k++;
  }
}

/** Oktoberfest: the first Saturday on or after 16 September, to the first Sunday of October (3 October when later). */
function oktoberfest(y: number): Span {
  const start = onOrAfter(y, 9, 16, 6);
  const sunday = nth(y, 10, 0, 1);
  return [start, sunday < ymd(y, 10, 3) ? ymd(y, 10, 3) : sunday];
}

// --- the table -------------------------------------------------------------------------------------------------------

const F1_WORDS = ["f1", "formula 1", "formula one", "formula bir", "grand prix", "gp"];
const f1 = (...places: string[]) => F1_WORDS.flatMap((w) => places.flatMap((p) => [`${w} ${p}`, `${p} ${w}`]));
/** Friday to Sunday of the race weekend whose Sunday is given. */
const raceWeekend = (sunday: string): Span => [plusDays(sunday, -2), sunday];

const E = (e: EventEntry) => e;
/** "burning man africa", "burning man in south africa", "afrika'da burning man": AfrikaBurn ("with my african friends" isn't). */
const AFRIKABURN = /burning ?man (in |to |at )?(the )?(south |guney )?afri[ck]a(n|da|de|ya)?\b|\bafri[ck]an? (da |de )?burning ?man/;

export const EVENTS: EventEntry[] = [
  E({
    id: "afrikaburn", kind: "event", name: ["AfrikaBurn", "AfrikaBurn"],
    aliases: ["afrikaburn", "afrika burn", "africa burn", "africaburn", "afrikaburns", "burning man africa", "burning man afrika", "african burning man", "afrika burning man", "africa burning man", "burning man south africa", "burning man güney afrika"],
    match: AFRIKABURN,
    place: ["Tankwa Karoo", "Tankwa Karoo"], code: "ZA", gateway: ["Cape Town", "Cape Town"],
    typical: ["Nisan sonu – Mayıs başı", "late April to early May"],
    occur: (y) => span(nth(y, 4, 1, -1), 7), url: "https://www.afrikaburn.org",
  }),
  E({
    id: "burningman", kind: "event", name: ["Burning Man", "Burning Man"], aliases: ["burning man", "burningman", "black rock city"], notIf: AFRIKABURN,
    place: ["Black Rock City", "Black Rock City"], code: "US", gateway: ["Reno", "Reno"],
    typical: ["Ağustos sonu – Eylül'ün ilk pazartesisi", "late August to Labor Day"],
    occur: (y) => [plusDays(nth(y, 9, 1, 1), -8), nth(y, 9, 1, 1)], url: "https://burningman.org",
  }),
  E({
    id: "tomorrowland", kind: "event", name: ["Tomorrowland", "Tomorrowland"], aliases: ["tomorrowland", "tomorrow land"],
    place: ["Boom", "Boom"], code: "BE", gateway: ["Brüksel", "Brussels"], typical: ["Temmuz'un son iki hafta sonu", "the last two weekends of July"],
    occur: (y) => [plusDays(nth(y, 7, 5, -1), -7), plusDays(nth(y, 7, 5, -1), 2)], url: "https://www.tomorrowland.com",
  }),
  E({
    id: "oktoberfest", kind: "event", name: ["Oktoberfest", "Oktoberfest"], aliases: ["oktoberfest", "octoberfest", "october fest", "wiesn"],
    place: ["Münih", "Munich"], code: "DE", typical: ["Eylül ortası – Ekim'in ilk pazarı", "mid-September to the first Sunday of October"],
    occur: oktoberfest, url: "https://www.oktoberfest.de",
  }),
  E({
    id: "glastonbury", kind: "event", name: ["Glastonbury Festivali", "Glastonbury Festival"], aliases: ["glastonbury", "glasto", "glastonbury festival", "glastonbury festivali"],
    place: ["Glastonbury", "Glastonbury"], code: "GB", gateway: ["Bristol", "Bristol"], typical: ["Haziran'ın son haftası (bazı yıllar ara verilir)", "the last week of June (some years are fallow)"],
    // 2026 is a fallow year.
    occur: (y) => (y === 2026 ? null : span(onOrAfter(y, 6, 21, 3), 5)), url: "https://www.glastonburyfestivals.co.uk",
  }),
  E({
    id: "coachella", kind: "event", name: ["Coachella", "Coachella"], aliases: ["coachella"],
    place: ["Indio", "Indio"], code: "US", gateway: ["Los Angeles", "Los Angeles"], typical: ["Nisan'da iki hafta sonu", "two weekends in April"],
    occur: (y) => span(nth(y, 4, 5, 2), 10), url: "https://www.coachella.com",
  }),
  E({
    id: "rio-carnival", kind: "event", name: ["Rio Karnavalı", "Rio Carnival"],
    aliases: ["rio carnival", "rio karnavalı", "rio carnaval", "carnaval do rio", "rio de janeiro carnival", "rio de janeiro karnavalı", "brezilya karnavalı", "brazil carnival", "brazilian carnival"],
    place: ["Rio de Janeiro", "Rio de Janeiro"], code: "BR", typical: ["Şubat ya da Mart, Paskalya'dan önce", "February or March, before Lent"],
    occur: (y) => fromEaster(y, -51, -46), url: "https://visit.rio",
  }),
  E({
    id: "venice-carnival", kind: "event", name: ["Venedik Karnavalı", "Venice Carnival"],
    aliases: ["venice carnival", "carnival of venice", "carnevale di venezia", "carnevale venezia", "venedik karnavalı"],
    place: ["Venedik", "Venice"], code: "IT", typical: ["Ocak sonu – Şubat, Paskalya'dan önce", "late January to February, before Lent"],
    occur: (y) => fromEaster(y, -57, -47), url: "https://www.carnevale.venezia.it",
  }),
  E({
    id: "tomatina", kind: "event", name: ["La Tomatina", "La Tomatina"], aliases: ["la tomatina", "tomatina", "domates festivali", "tomato festival"],
    place: ["Buñol", "Buñol"], code: "ES", gateway: ["Valencia", "Valencia"], typical: ["Ağustos'un son çarşambası", "the last Wednesday of August"],
    occur: (y) => span(nth(y, 8, 3, -1), 1), url: "https://www.latomatina.info",
  }),
  E({
    id: "sanfermin", kind: "event", name: ["San Fermín", "San Fermín"],
    aliases: ["san fermin", "sanfermin", "running of the bulls", "pamplona bull run", "bull run pamplona", "boğa koşusu", "boğa koşuları"],
    place: ["Pamplona", "Pamplona"], code: "ES", typical: ["6–14 Temmuz", "6–14 July"], occur: (y) => [ymd(y, 7, 6), ymd(y, 7, 14)], url: "https://www.pamplona.es",
  }),
  E({
    id: "holi", kind: "event", name: ["Holi", "Holi"], aliases: ["holi", "holi festival", "holi festivali", "festival of colours", "festival of colors", "renkler festivali"],
    place: ["Mathura", "Mathura"], code: "IN", gateway: ["Delhi", "Delhi"], typical: ["Mart'ta, dolunaya göre", "in March, by the full moon"],
    occur: dayTable("holi", { 2026: "2026-03-04", 2027: "2027-03-22", 2028: "2028-03-11" }, 1, 0), url: "https://www.incredibleindia.gov.in",
  }),
  E({
    id: "songkran", kind: "event", name: ["Songkran", "Songkran"], aliases: ["songkran", "thai new year", "tayland yeni yılı"],
    place: ["Bangkok", "Bangkok"], code: "TH", typical: ["13–15 Nisan", "13–15 April"], occur: (y) => [ymd(y, 4, 13), ymd(y, 4, 15)], url: "https://www.tourismthailand.org",
  }),
  E({
    id: "fullmoon", kind: "event", name: ["Full Moon Party", "Full Moon Party"], aliases: ["full moon party", "fullmoon party", "full moon partisi", "dolunay partisi"],
    place: ["Koh Phangan", "Koh Phangan"], code: "TH", typical: ["her ay dolunayda", "every month at the full moon"], next: nextFullMoon, url: "https://www.tourismthailand.org",
  }),
  E({
    id: "diwali", kind: "event", name: ["Diwali", "Diwali"], aliases: ["diwali", "deepavali", "divali"],
    place: ["Jaipur", "Jaipur"], code: "IN", gateway: ["Delhi", "Delhi"], typical: ["Ekim sonu ya da Kasım, ay takvimine göre", "late October or November, by the lunar calendar"],
    occur: dayTable("diwali", { 2026: "2026-11-08", 2027: "2027-10-29", 2028: "2028-10-17" }, 2, 2), url: "https://www.incredibleindia.gov.in",
  }),
  E({
    id: "cny", kind: "event", name: ["Çin Yeni Yılı", "Chinese New Year"], aliases: ["chinese new year", "lunar new year", "çin yeni yılı", "cny hong kong"],
    place: ["Hong Kong", "Hong Kong"], code: "HK", typical: ["Ocak sonu – Şubat, ay takvimine göre", "late January or February, by the lunar calendar"],
    occur: dayTable("cny", { 2026: "2026-02-17", 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13" }, 1, 2), url: "https://www.discoverhongkong.com",
  }),
  E({
    id: "northern-lights", kind: "theme", name: ["Kuzey Işıkları", "Northern Lights"], aliases: ["northern lights", "aurora borealis", "kuzey ışıkları", "kutup ışıkları", "aurora hunting"],
    place: ["Tromsø", "Tromsø"], code: "NO", typical: ["Eylül sonu – Mart, karanlık gecelerde", "late September to March, on dark nights"], url: "https://www.visitnorway.com",
  }),
  E({
    id: "cherry-blossom", kind: "theme", name: ["Kiraz Çiçekleri", "Cherry Blossom"], aliases: ["cherry blossom", "cherry blossoms", "sakura", "hanami", "kiraz çiçekleri", "kiraz çiçeği"],
    place: ["Japonya", "Japan"], code: "JP", places: [{ name: ["Tokyo", "Tokyo"] }, { name: ["Kyoto", "Kyoto"] }, { name: ["Osaka", "Osaka"] }],
    typical: ["Mart sonu – Nisan başı", "late March to early April"], occur: (y) => [ymd(y, 3, 25), ymd(y, 4, 7)], url: "https://www.japan.travel",
  }),
  E({
    id: "sziget", kind: "event", name: ["Sziget", "Sziget"], aliases: ["sziget", "sziget festival", "sziget festivali"],
    place: ["Budapeşte", "Budapest"], code: "HU", typical: ["Ağustos'un ikinci haftası", "the second week of August"], occur: (y) => span(onOrAfter(y, 8, 5, 3), 6), url: "https://szigetfestival.com",
  }),
  E({
    id: "primavera", kind: "event", name: ["Primavera Sound", "Primavera Sound"], aliases: ["primavera sound", "primavera festival"],
    place: ["Barselona", "Barcelona"], code: "ES", typical: ["Mayıs sonu – Haziran başı", "late May to early June"], occur: (y) => span(onOrAfter(y, 5, 29, 3), 5), url: "https://www.primaverasound.com",
  }),
  E({
    id: "roskilde", kind: "event", name: ["Roskilde Festivali", "Roskilde Festival"], aliases: ["roskilde festival", "roskilde festivali"],
    place: ["Roskilde", "Roskilde"], code: "DK", gateway: ["Kopenhag", "Copenhagen"], typical: ["Haziran sonu – Temmuz başı", "late June to early July"], occur: (y) => span(nth(y, 6, 6, -1), 8), url: "https://www.roskilde-festival.dk",
  }),
  E({
    id: "ultra", kind: "event", name: ["Ultra Miami", "Ultra Miami"], aliases: ["ultra miami", "ultra music festival", "ultra festival miami"],
    place: ["Miami", "Miami"], code: "US", typical: ["Mart'ın son hafta sonu", "the last weekend of March"], occur: (y) => span(nth(y, 3, 5, -1), 3), url: "https://ultramusicfestival.com",
  }),
  E({
    id: "edc", kind: "event", name: ["EDC Las Vegas", "EDC Las Vegas"], aliases: ["edc las vegas", "edc vegas", "electric daisy carnival", "edc"],
    place: ["Las Vegas", "Las Vegas"], code: "US", typical: ["Mayıs ortası", "mid-May"], occur: (y) => span(nth(y, 5, 5, 3), 3), url: "https://lasvegas.electricdaisycarnival.com",
  }),
  E({
    id: "f1-monaco", kind: "event", name: ["Formula 1 Monako GP", "Formula 1 Monaco GP"], aliases: f1("monaco", "monako"),
    place: ["Monako", "Monaco"], code: "MC", gateway: ["Nice", "Nice"], typical: ["Mayıs sonu ya da Haziran başı", "late May or early June"],
    occur: (y) => (y === 2026 ? [ymd(2026, 6, 5), ymd(2026, 6, 7)] : raceWeekend(nth(y, 5, 0, -1))), url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "f1-turkey", kind: "event", name: ["Formula 1 Türkiye GP", "Formula 1 Turkish GP"], aliases: f1("istanbul", "türkiye", "turkiye", "turkey", "turkish", "istanbul park"),
    place: ["İstanbul", "Istanbul"], code: "TR", typical: ["takvim her yıl açıklanır", "the calendar is announced each year"], url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "f1-britain", kind: "event", name: ["Formula 1 Britanya GP", "Formula 1 British GP"], aliases: f1("silverstone", "british", "britanya", "ingiltere"),
    place: ["Silverstone", "Silverstone"], code: "GB", gateway: ["Londra", "London"], typical: ["Temmuz başı", "early July"], occur: (y) => raceWeekend(nth(y, 7, 0, 1)), url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "f1-italy", kind: "event", name: ["Formula 1 İtalya GP", "Formula 1 Italian GP"], aliases: f1("monza", "italian", "italya", "italy"),
    place: ["Monza", "Monza"], code: "IT", gateway: ["Milano", "Milan"], typical: ["Eylül başı", "early September"], occur: (y) => raceWeekend(nth(y, 9, 0, 1)), url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "f1-belgium", kind: "event", name: ["Formula 1 Belçika GP", "Formula 1 Belgian GP"], aliases: f1("spa", "belgian", "belçika", "belgium", "spa francorchamps"),
    place: ["Spa-Francorchamps", "Spa-Francorchamps"], code: "BE", gateway: ["Brüksel", "Brussels"], typical: ["Temmuz sonu", "late July"], occur: (y) => raceWeekend(nth(y, 7, 0, -1)), url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "f1-abudhabi", kind: "event", name: ["Formula 1 Abu Dabi GP", "Formula 1 Abu Dhabi GP"], aliases: f1("abu dhabi", "abu dabi", "yas marina"),
    place: ["Abu Dabi", "Abu Dhabi"], code: "AE", typical: ["Kasım sonu – Aralık başı, sezonun son yarışı", "late November or early December, the season's last race"],
    occur: (y) => raceWeekend(nth(y, 12, 0, 1)), url: "https://www.formula1.com/en/racing",
  }),
  E({
    id: "wimbledon", kind: "event", name: ["Wimbledon", "Wimbledon"], aliases: ["wimbledon"],
    place: ["Londra", "London"], code: "GB", typical: ["Haziran sonu – Temmuz ortası", "late June to mid-July"], occur: (y) => span(onOrAfter(y, 6, 26, 1), 14), url: "https://www.wimbledon.com",
  }),
  E({
    id: "fringe", kind: "event", name: ["Edinburgh Fringe", "Edinburgh Fringe"], // (Never "fringe festival" alone: Adelaide's, Brighton's… are their own.)
    aliases: ["edinburgh fringe", "edinburgh fringe festival", "edinburgh festival"],
    place: ["Edinburgh", "Edinburgh"], code: "GB", typical: ["Ağustos boyunca", "throughout August"], occur: (y) => span(nth(y, 8, 5, 1), 25), url: "https://www.edfringe.com",
  }),
  E({
    id: "day-of-the-dead", kind: "event", name: ["Ölüler Günü", "Day of the Dead"], aliases: ["day of the dead", "dia de muertos", "dia de los muertos", "ölüler günü"],
    place: ["Oaxaca", "Oaxaca"], code: "MX", gateway: ["Meksiko", "Mexico City"], typical: ["31 Ekim – 2 Kasım", "31 October to 2 November"],
    occur: (y) => [ymd(y, 10, 31), ymd(y, 11, 2)], url: "https://www.visitmexico.com",
  }),
  E({
    id: "mardi-gras", kind: "event", name: ["Mardi Gras", "Mardi Gras"], aliases: ["mardi gras", "new orleans mardi gras"],
    place: ["New Orleans", "New Orleans"], code: "US", typical: ["Şubat ya da Mart, Paskalya'ya göre", "February or March, by Easter"], occur: (y) => fromEaster(y, -52, -47), url: "https://www.neworleans.com",
  }),
  E({
    id: "notting-hill", kind: "event", name: ["Notting Hill Karnavalı", "Notting Hill Carnival"], aliases: ["notting hill carnival", "notting hill karnavalı"],
    place: ["Londra", "London"], code: "GB", typical: ["Ağustos'un son hafta sonu", "the last weekend of August"], occur: (y) => [plusDays(nth(y, 8, 1, -1), -1), nth(y, 8, 1, -1)], url: "https://nhcarnival.org",
  }),
  E({
    id: "dubai-shopping", kind: "event", name: ["Dubai Alışveriş Festivali", "Dubai Shopping Festival"], aliases: ["dubai shopping festival", "dubai alışveriş festivali"],
    place: ["Dubai", "Dubai"], code: "AE", typical: ["Aralık başı – Ocak ortası", "early December to mid-January"], url: "https://www.mydsf.ae",
  }),
  E({
    id: "hajj", kind: "event", name: ["Hac", "Hajj"], aliases: ["hajj", "haj", "hac", "hacc", "hacca", "hac ibadeti", "hac ziyareti"],
    place: ["Mekke", "Mecca"], code: "SA", gateway: ["Cidde", "Jeddah"], typical: ["Zilhicce ayında, ay takvimine göre", "in Dhu al-Hijjah, by the lunar calendar"],
    occur: byYear("hajj", { 2026: ["2026-05-25", "2026-05-30"], 2027: ["2027-05-14", "2027-05-19"], 2028: ["2028-05-03", "2028-05-08"] }), url: "https://www.haj.gov.sa",
  }),
  E({
    id: "kumbh", kind: "event", name: ["Kumbh Mela", "Kumbh Mela"], aliases: ["kumbh mela", "kumbh", "kumbha mela", "maha kumbh"],
    place: ["Haridwar", "Haridwar"], code: "IN", gateway: ["Delhi", "Delhi"], typical: ["kutsal yıkanma günlerine göre değişir (sıradakiler 2027'de)", "it follows the holy bathing days (the next ones in 2027)"],
    url: "https://kumbh.gov.in",
  }),
  E({
    id: "fete-des-lumieres", kind: "event", name: ["Işıklar Festivali (Lyon)", "Fête des Lumières"],
    aliases: ["fete des lumieres", "festival of lights lyon", "lyon festival of lights", "lyon ışık festivali", "lyon ışıklar festivali", "ışıklar festivali lyon"],
    place: ["Lyon", "Lyon"], code: "FR", typical: ["8 Aralık civarında 4 gün", "four days around 8 December"], occur: (y) => [ymd(y, 12, 5), ymd(y, 12, 8)], url: "https://www.fetedeslumieres.lyon.fr",
  }),
  E({
    id: "christmas-markets", kind: "theme", name: ["Noel Pazarları", "Christmas Markets"],
    aliases: ["christmas markets", "christmas market", "noel pazarları", "noel pazarı", "yılbaşı pazarları", "weihnachtsmarkt", "christkindlmarkt", "christkindlesmarkt"],
    place: ["Nürnberg", "Nuremberg"], code: "DE", places: [{ name: ["Nürnberg", "Nuremberg"], code: "DE" }, { name: ["Prag", "Prague"], code: "CZ" }, { name: ["Viyana", "Vienna"], code: "AT" }],
    typical: ["Kasım sonu – 23 Aralık", "late November to 23 December"], url: "https://www.christkindlesmarkt.de",
  }),
  E({
    id: "balloon-fiesta", kind: "event", name: ["Albuquerque Balon Festivali", "Albuquerque Balloon Fiesta"], aliases: ["balloon fiesta", "albuquerque balloon fiesta", "albuquerque balon festivali"],
    place: ["Albuquerque", "Albuquerque"], code: "US", typical: ["Ekim'in ilk haftası", "the first week of October"], occur: (y) => span(nth(y, 10, 6, 1), 9), url: "https://balloonfiesta.com",
  }),
  E({
    id: "lollapalooza", kind: "event", name: ["Lollapalooza", "Lollapalooza"], aliases: ["lollapalooza", "lollapalooza chicago", "lolla chicago"],
    place: ["Chicago", "Chicago"], code: "US", typical: ["Temmuz sonu – Ağustos başı", "late July to early August"], occur: (y) => span(onOrAfter(y, 7, 30, 4), 4), url: "https://www.lollapalooza.com",
  }),
];

// --- reading it in a message -----------------------------------------------------------------------------------------

/** Lower case, no accents, "ı" as "i", words apart by single spaces (the same words as the text's tokens). */
export const normWords = (s: string): string[] =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * A Turkish ending typed onto the last word ("oktoberfeste", "tomorrowlanda", "holiye"; "sziget'te" is a token apart),
 * with its buffer letter after a possessive ("festivaline", "karnavalına", "ışıklarını", "yılında", "partisine"). Read on
 * the plain words (ı → i, ü → u).
 */
const ENDING = /^[nys]?(a|e|i|u|ya|ye|yi|yu|da|de|ta|te|dan|den|tan|ten|in|un|nin|nun|ni|nu|na|ne|nda|nde|ndan|nden|la|le|yla|yle)$/;
/** A word typed as the name with an ending on it; a name of three letters only with a whole ending ("edcye", never "hacı"). */
const withEnding = (typed: string, name: string) => {
  if (name.length < 3 || !typed.startsWith(name)) return false;
  const rest = typed.slice(name.length);
  return ENDING.test(rest) && (name.length >= 4 || rest.length >= 2);
};

interface Compiled {
  entry: EventEntry;
  aliases: string[][];
}
const COMPILED: Compiled[] = EVENTS.map((entry) => ({ entry, aliases: [...new Set(entry.aliases.map((a) => normWords(a).join(" ")))].map((a) => a.split(" ")) }));

export interface EventHit {
  entry: EventEntry;
  /** The words it was named by, as token indexes in the text: [first, after the last). */
  at: [number, number];
}

/** The event or theme a message names, if any: the most specific name wins ("burning man africa" over "burning man"). */
export function findEvent(text: string): EventHit | null {
  const words = normWords(text);
  const joined = words.join(" ");
  let best: { hit: EventHit; score: number } | null = null;
  for (const { entry, aliases } of COMPILED) {
    if (entry.notIf?.test(joined)) continue;
    for (const alias of aliases) {
      for (let i = 0; i + alias.length <= words.length; i++) {
        const ok = alias.every((w, k) => {
          const typed = words[i + k];
          if (typed === w) return true;
          // The ending on the last word only.
          return k === alias.length - 1 && withEnding(typed, w);
        });
        if (!ok) continue;
        const score = alias.length * 100 + alias.join(" ").length;
        if (!best || score > best.score) best = { hit: { entry, at: [i, i + alias.length] }, score };
      }
    }
    if (entry.match?.test(joined)) {
      // Above a name of one or two words, below a listed name of three ("burning man in south africa").
      const score = 250;
      if (!best || score > best.score) {
        const named = words.flatMap((w, k) => (/^(burning|burningman|man|afri[ck]an?|afri[ck]a(da|de|ya)|south|guney)$/.test(w) ? [k] : []));
        best = { hit: { entry, at: [named[0] ?? 0, (named.at(-1) ?? words.length - 1) + 1] }, score };
      }
    }
  }
  return best?.hit ?? null;
}

/** The dates it runs the next time it starts after today (inclusive days), or null (a season, unknown). */
export function nextOccurrence(entry: EventEntry, today: string): Span | null {
  if (entry.next) return entry.next(today);
  if (!entry.occur) return null;
  const y = Number(today.slice(0, 4));
  for (let k = 0; k < 4; k++) {
    const got = entry.occur(y + k);
    if (got && got[0] > today) return got;
  }
  return null;
}

function regionOf(code: string, l: Lang): string | null {
  try {
    const n = new Intl.DisplayNames([l], { type: "region" }).of(code);
    return n && n !== code ? n : null;
  } catch {
    return null;
  }
}
const pick = (p: Pair) => L(p[0], p[1]);

/** The entry as the trip's intent, in the language now; its dates the next time, estimated. */
export function intentOf(entry: EventEntry, today: string): Intent {
  const dates = nextOccurrence(entry, today);
  const place = pick(entry.place);
  const own = regionOf(entry.code, lang());
  return {
    kind: entry.kind,
    id: entry.id,
    name: pick(entry.name),
    place,
    country: own,
    code: entry.code,
    dates: dates ? { start: dates[0], end: dates[1], approx: true } : null,
    url: entry.url,
    gateway: entry.gateway ? pick(entry.gateway) : null,
    ...(entry.places ? { places: entry.places.map((p) => ({ city: pick(p.name), code: p.code ?? entry.code })) } : {}),
    typical: pick(entry.typical),
  };
}

export const eventById = (id: string | null | undefined): EventEntry | null => (id ? (EVENTS.find((e) => e.id === id) ?? null) : null);

/** Days it runs (inclusive). */
export const eventDays = (dates: { start: string; end: string }): number => daysBetween(dates.start, dates.end) + 1;

/** The trip's title from its intent: "AfrikaBurn 2027", "Kiraz Çiçekleri 2027", "Kuzey Işıkları Gezisi". */
export function intentTitle(intent: Pick<Intent, "name" | "dates" | "kind">): string {
  const year = intent.dates?.start.slice(0, 4);
  if (year && !/\b(19|20)\d{2}\b/.test(intent.name)) return `${intent.name} ${year}`;
  if (intent.kind === "theme") return L(`${intent.name} Gezisi`, `${intent.name} trip`);
  return intent.name;
}

