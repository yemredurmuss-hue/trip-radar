// What kind of trip a transport page is: a transfer within a city (to or from the airport, a taxi), a
// car rented for days in one place, or a trip between places. Shared by the plan and the transfers.
import type { Item, PlannedKind } from "./types";

const LOCAL = /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen|transfer|shuttle|servis|taksi|taxi|uber|bolt|cabify|pick ?up|karşılama/i;
export const RENTAL = /araç kiralama|araba kiralama|rent.?a.?car|car rental|kiralık araç|car hire|autoeurope|rentalcars|discover cars|sixt|europcar|hertz|avis\b|\brentals?\b|\bcar rent\b/i;

export const itemText = (i: Item) => [i.name, i.summary, i.optionDetail, i.provider].filter(Boolean).join(" ");

/** Days between two dates (a rental runs for days; a ride doesn't). */
const span = (i: Item) => (i.dates.start && i.dates.end ? (Date.parse(i.dates.end) - Date.parse(i.dates.start)) / 86_400_000 : 0);

/** Kinds rented for days in one place. */
export const RENTAL_KINDS: readonly PlannedKind[] = ["car_rental", "moto_rental", "rv_rental", "bike_rental"];

/** A car (or bike) rented for days in one place: it belongs to that place's days, not to a trip between cities. */
export const isRental = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind
    ? RENTAL_KINDS.includes(i.plannedKind)
    : RENTAL.test(itemText(i)) || (!i.flight?.from && !i.flight?.to && span(i) >= 2));

/** A transfer within a city (to or from the airport, a taxi...) rather than a trip between cities. */
export const isLocalTransfer = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind ? i.plannedKind === "transfer" || i.plannedKind === "taxi" : LOCAL.test(itemText(i)) && !RENTAL.test(itemText(i)));

/** A trip between places (a flight, a train...): what can get the traveller in, out or to the next city. */
export const isTrip = (i: Item) => i.category === "flight" || (i.category === "transport" && !isRental(i) && !isLocalTransfer(i));

const INSURANCE = /sigorta|insurance|seguro/i;
const VISA = /(^|[^\p{L}])(vize\p{L}*|visas?|e-?visa|etias)(?![\p{L}])/iu;
export const ESIM_WORDS = /\besim\b|e-sim|sim kart/i;

// A chore before the trip (spec 0.34.6 §3): buy, apply, book, print, pack, change money... Turkish puts the
// verb last ("Decathlon'dan yağmurluk al", "vize başvurusu yap"), English first ("Buy a rain jacket"); a few
// nouns are chores on their own (döviz, bavul, pasaport). An experience ("Dom Luís'te gün batımı", "Fado
// dinle", "Porto Belo Pazarı") never matches.
const TR_STEMS = [
  "satın al", "al", "başvur", "yazdır", "paketle", "hazırla", "bozdur", "yaptır", "yenile", "indir", "doldur", "öde", "onayla",
  "sipariş ver", "sipariş et", "iptal et", "kontrol et", "rezerve et", "rezerve ed", "rezervasyon yap", "rezervasyonu yap", "rezervasyonunu yap",
  "başvuru yap", "başvurusu yap", "başvurusunu yap", "check-in yap", "checkin yap", "ödeme yap", "kayıt ol", "randevu al",
];
const TR_SUFFIXES = ["", "ın", "in", "un", "ün", "mak", "mek", "malı", "meli", "alım", "elim", "yalım", "yelim", "yın", "yin", "acağız", "eceğiz", "yacağız", "yeceğiz", "dık", "dik", "duk", "dük", "tık", "tik", "dım", "dim", "ılacak", "ilecek", "ınacak", "inecek", "ındı", "indi"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TR_CHORE = new RegExp(`(?<![\\p{L}\\p{N}])(${TR_STEMS.map(esc).join("|")})(${TR_SUFFIXES.filter(Boolean).join("|")})?$`, "u");
const EN_CHORE =
  /^(to\s+)?(buy|purchase|order|apply|renew|book|reserve|print|pack|exchange|withdraw|download|install|activate|confirm|cancel|pay|fill (in|out)|charge|arrange|sort out|check in online|do (the )?online check-?in|get (a |an |the |our |my )?(travel |health )*(visas?|insurance|e-?sims?|sim( card)?|adapters?|cash|euros?|currency|tickets?|passports?))\b/i;
const CHORE_NOUNS = /döviz|bavul|valiz|pasaport|online check-?in|adaptör|currency exchange|money exchange|passport|packing list|suitcase|travel adapter|power adapter|visa application|vize (başvuru|randevu)/i;

// Shopping is a chore before the trip ("Decathlon'dan yağmurluk al") but an experience there ("Porto şarabı al",
// "hediyelik eşya al", "Bolhão pazarından peynir al"): a buy line that names something bought there, and no sign
// it's bought at home first, goes to Yapılacak şeyler. A line that says neither ("şemsiye al") stays a chore.
const TR_BUY = new RegExp(`(?<![\\p{L}\\p{N}])(satın al|al)(${TR_SUFFIXES.filter(Boolean).join("|")})?$`, "u");
const EN_BUY = /^(to\s+)?(buy|purchase|get|pick up|grab|try)\b/i;
const BOUGHT_THERE =
  /hediyelik|hediye|souvenir|magnet|mıknatıs|yerel|yöresel|local|el yapımı|handmade|azulejo|çini|seramik|ceramic|şarap|şarab|wine|likör|liqueur|poncha|ginja|sardalya|sardine|mantar|cork|pazar|mercado|market(?!ten)|çarşı|bazaar/i;
const BOUGHT_BEFORE = /decathlon|amazon|trendyol|hepsiburada|internetten|online|yola çıkmadan|gitmeden|evden|before (the )?trip|before we go|duty ?free/i;

/** A buy line about shopping at the destination (TR or EN): a thing to do there, not a chore. */
export function shoppingThere(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/[\s.!?…]+$/u, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");
  if (!t || !(TR_BUY.test(t) || EN_BUY.test(t))) return false;
  return BOUGHT_THERE.test(t) && !BOUGHT_BEFORE.test(t);
}

/** The line names a chore to do before the trip (TR or EN), not something to see or do there. */
export function choreText(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/[\s.!?…]+$/u, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");
  if (!t || shoppingThere(t)) return false;
  return TR_CHORE.test(t) || EN_CHORE.test(t) || CHORE_NOUNS.test(t);
}

/** Said in the chat or added by hand as a thing to do (a record kind that may be read from its words). */
const LOOSE_KINDS: readonly (PlannedKind | undefined)[] = [undefined, "activity", "todo", "other"];

/**
 * Travel insurance: added from the template, said as one in the chat, or a record whose words say so
 * (a page's text for a page in Diğer or Ulaşım; only the name of a thing to do — a tour's page that
 * "includes insurance" stays a tour). Never a chore that names it ("Seyahat sigortası al").
 */
export const isInsurance = (i: Item): boolean => {
  if (i.plannedKind === "insurance") return true;
  // A saved page is what it is ("Get travel insurance · World Nomads" is a policy to compare, not a chore).
  if (!i.plannedKind && (i.category === "other" || i.category === "transport")) return INSURANCE.test(itemText(i));
  if (!LOOSE_KINDS.includes(i.plannedKind) || choreText(i.name)) return false;
  return (i.category === "other" || i.category === "activity") && INSURANCE.test(i.name);
};

/** A visa (or an ETIAS) by its name, said as a thing to do: its own record in Diğer, not a chore. */
export const isVisa = (i: Item): boolean =>
  LOOSE_KINDS.includes(i.plannedKind) && (i.category === "other" || i.category === "activity") && VISA.test(i.name) && (!i.plannedKind || !choreText(i.name));

/**
 * The papers of a trip (spec 0.34.6 §2): a policy, a visa, an eSIM said as a thing to do. Always in Diğer
 * and always something to buy or get, whatever kind the chat gave it; a chore that names one ("vize
 * başvurusu yap") is a chore instead.
 */
export const isPaperwork = (i: Item): boolean =>
  isInsurance(i) ||
  isVisa(i) ||
  (LOOSE_KINDS.includes(i.plannedKind) && (i.category === "other" || i.category === "activity") && ESIM_WORDS.test(i.name) && (!i.plannedKind || !choreText(i.name)));

export { LOCAL };
