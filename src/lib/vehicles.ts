// A vehicle for days (a rented car, a campervan or motorhome, a motorbike) and the chat's two rules for it:
// plan_item never adds a second vehicle for days one already covers unless the traveller asked for one in
// this message, and "araç kiralama iptal, yerine karavan kiraladık" takes the car rental out when it's the
// only one it can mean. Bikes don't count: a bike next to a car is normal. Pure.
import { L } from "./i18n";
import { isoDate } from "./items";
import { addDays } from "./plan";
import { isRental, itemText } from "./travelKinds";
import type { Item } from "./types";

export type VehicleType = "car" | "camper" | "moto";

/** Words that start at a word's start (Turkish endings allowed: "karavanı", "arabayı"). */
const words = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})`, "iu");

const CAMPER = words("camper ?vans?|campervan\\p{L}*|campers?(?!\\p{L})|motor ?homes?|motorhome\\p{L}*|karavan\\p{L}*|kamp ?ara[cç]\\p{L}*|rv(?!\\p{L})|indie campers|wohnmobil");
const MOTO = words("motosiklet\\p{L}*|motorsiklet\\p{L}*|motorbikes?(?!\\p{L})|motorcycles?(?!\\p{L})|scooter\\p{L}*|sk[uü]ter\\p{L}*|moped\\p{L}*|vespa");
const BIKE = words("bisiklet\\p{L}*|bikes?(?!\\p{L})|bicycles?|e-?bikes?");
// "araç" and its endings, never "aracılığıyla" (by means of) or "aracı kurum".
const CAR = words("araba\\p{L}*|ara[cç](?!ıl)\\p{L}*|otomobil\\p{L}*|cars?(?!\\p{L})|rent ?a ?car|car hire|car rental|kiral[ıi]k ara[cç]\\p{L}*");
/** A vehicle someone rents out: the operator or rental words, on a stay saved from a campervan page. */
const RENTED_OUT = words("kirala\\p{L}*|kiral[ıi]k|rental\\p{L}*|rent(?!\\p{L})|hire(?!\\p{L})|vermiet\\p{L}*|indie campers|mcrent|roadsurfer|camperdays|motorhome republic|bawhee");
/** A place to park one, not one: "Madeira Motorhome Park", "Camping Karavan Parkı", "Funchal RV Resort". */
const SITE = words("park\\p{L}*|camping\\p{L}*|campsite\\p{L}*|kamp ?alan\\p{L}*|kamp ?yeri\\p{L}*|resort\\p{L}*|stellplatz|wohnmobilstellplatz|area de servi[cç]o|parque de campismo|glamping");

const CANCEL = words("iptal\\p{L}*|vazge[cç]\\p{L}*|cancel\\p{L}*|called off|dropp?ed");
const INSTEAD = words("yerine|instead");
/** "iptal etmedik", "iptal edilmedi", "iptal değil", "vazgeçmedik", "didn't cancel", "not cancelled". */
const NOT_CANCELLED = /(?:iptal\s+(?:et|edil|ol)m[ae]|iptal\s+de[gğ]il|vazge[cç]me|n['’]t\s+(?:been\s+|be\s+|get\s+)?(?:cancel|call)|(?<![\p{L}])(?:not|never)\s+(?:been\s+|be\s+)?(?:cancel|call))/iu;
/** "iptal olursa", "vazgeçersek", "eğer", "if / unless / in case", "might be cancelled". */
const CONDITIONAL = /(?:(?:iptal\s+\p{L}*|vazge[cç]\p{L}*)(?:rsa|rse)\p{L}*|(?<![\p{L}])(?:e[gğ]er|şayet|if|unless|in case|might|may|could|would|should)(?![\p{L}]))/iu;
const QUESTION = /\?|(?<![\p{L}])m[ıiuü](?:s[ıiuü]n|y[ıiuü]z|d[ıiuü]r)?(?![\p{L}])/iu;
const NEGATION = words("istemiyor\\p{L}*|istemeyiz|gerek yok|gerekmez|gerek kalmad\\p{L}*|kiralamay\\p{L}*|kiralam[ıi]yor\\p{L}*|almay[ıa]l[ıi]m|alm[ıi]yor\\p{L}*|no need|don'?t|do not|won'?t|not (?:rent|hire|need|book|get|want)");
/** Getting one: rent, book, add ("bir de araba kirala", "rent a car as well"); "araba ile gideceğiz" says none of these. */
const GET = words("kirala\\p{L}*|kiral[ıi]k|ekle\\p{L}*|koy(?:alım|un|sana|ar m[ıi]s[ıi]n)?(?!\\p{L})|ayarla\\p{L}*|rezerv\\p{L}*|tutal[ıi]m|tuttuk|alal[ıi]m|ald[ıi]k|rent\\p{L}*|hire\\p{L}*|book\\p{L}*|reserv\\p{L}*|add(?!\\p{L})|get(?!\\p{L})|got(?!\\p{L})");
/** "bir de", "another", "a second", "as well": one more of the same kind. */
const ANOTHER = words("bir de|ayrıca|ikinci|başka bir|bir tane daha|another|a second|one more|as well|also|too(?!\\p{L})");
const AFFIRM = /^\s*(evet|olur|tamam|ekle\p{L}*|kirala\p{L}*|koy|yes|yep|yeah|sure|ok(?:ay)?|go ahead|please do|do it)(?![\p{L}])/iu;

/** Sentences, each with its own end mark (a question stays a question). */
const sentences = (text: string) => text.split(/(?<=[.!?;\n])/u).map((s) => s.trim()).filter(Boolean);
/** A sentence's parts around what comes in place ("yerine", "instead", "so", "and got", "çünkü"...). */
const PARTS = /,|(?<![\p{L}])(?:onun yerine|bunun yerine|yerine|instead of|instead|so|and then|and (?:we )?(?:got|rented|booked|took|hired)|then|but|because|ama|fakat|çünkü|ve)(?![\p{L}])/iu;
/** A part that really says something was cancelled: not "iptal etmedik", "iptal olursa" or a question. */
const cancels = (part: string) => CANCEL.test(part) && !NOT_CANCELLED.test(part) && !CONDITIONAL.test(part);

/** The vehicle types a text names ("araç kiralama" → car, "karavan" → camper). */
export function vehicleTypesIn(text: string): Set<VehicleType> {
  const out = new Set<VehicleType>();
  if (CAMPER.test(text)) out.add("camper");
  if (MOTO.test(text)) out.add("moto");
  if (CAR.test(text.replace(/motor ?homes?|kamp ?ara[cç]\p{L}*/giu, ""))) out.add("car");
  return out;
}

/**
 * What vehicle a record is, or null: a car, motorbike or campervan rented for days (transport), or a
 * campervan saved as the stay ("Renault Campervan · Indie Campers"). Anything else, a bike included, is null.
 */
export function vehicleOf(item: Item): VehicleType | null {
  const text = itemText(item);
  // A stay counts only as a campervan rented out (a rental's page, "Indie Campers"), never by the word alone:
  // "Madeira Motorhome Park" or "Camping Karavan Parkı" is a place to stay.
  if (item.category === "stay") return CAMPER.test(text) && RENTED_OUT.test(text) && !SITE.test(item.name) ? "camper" : null;
  if (item.category !== "transport") return null;
  const kind = item.plannedKind;
  if (kind === "rv_rental") return "camper";
  if (kind === "moto_rental") return "moto";
  if (kind === "bike_rental") return null;
  if (kind && kind !== "car_rental") return null;
  if (!kind && !isRental(item) && !(CAMPER.test(text) && RENTED_OUT.test(text))) return null;
  if (!kind && SITE.test(item.name)) return null;
  if (CAMPER.test(text)) return "camper";
  if (MOTO.test(text)) return "moto";
  if (!kind && BIKE.test(text) && !CAR.test(text)) return null;
  return "car";
}

/** Days a record covers, end exclusive (a single day when it has no end); null when it has no day. */
export interface Period {
  start: string;
  end: string;
}
export function periodOf(item: Pick<Item, "dates">): Period | null {
  const start = isoDate(item.dates.start?.slice(0, 10));
  if (!start) return null;
  const end = isoDate(item.dates.end?.slice(0, 10));
  return { start, end: end && end > start ? end : addDays(start, 1) };
}

/** Whether two periods share a day. A missing day can't be ruled out, so it overlaps. */
export const overlaps = (a: Period | null, b: Period | null): boolean => !a || !b || (a.start < b.end && b.start < a.end);

/**
 * The vehicle types the traveller says were replaced ("araç kiralama iptal, yerine karavan kiraladık",
 * "we cancelled the car rental and got a campervan instead", "araba yerine karavan"); empty unless the
 * message says "yerine" / "instead".
 */
export function replacedVehicles(text: string): VehicleType[] {
  const out = new Set<VehicleType>();
  const add = (s: string) => vehicleTypesIn(s).forEach((t) => out.add(t));
  for (const sentence of sentences(text)) {
    // A question ("araba yerine karavan mı alsak?") or a maybe ("iptal olursa...") replaces nothing.
    if (!INSTEAD.test(sentence) || QUESTION.test(sentence) || CONDITIONAL.test(sentence)) continue;
    // Only the part that says what's cancelled, up to what comes in its place: "araç kiralamayı iptal ettik"
    // in "araç kiralamayı iptal ettik yerine karavan kiraladık", never the campervan after it.
    for (const part of sentence.split(PARTS)) if (part && cancels(part)) add(part);
    // "araba yerine karavan": the words just before "yerine" ("onun yerine" points back, it names nothing).
    for (const m of sentence.matchAll(/((?:[\p{L}'’]+\s+){0,2}[\p{L}'’]+)\s+yerine/giu)) {
      if (!/(?:^|\s)(onun|bunun|şunun|onların|bunların)$/iu.test(m[1]) && !CANCEL.test(m[1])) add(m[1]);
    }
    // "instead of the car".
    for (const m of sentence.matchAll(/instead of\s+((?:[\p{L}'’-]+\s*){1,4})/giu)) add(m[1].split(PARTS)[0]);
  }
  return [...out];
}

/**
 * The traveller asks for a vehicle of this type in this message: its name with a word for getting one ("bir de
 * araba kirala", "Madeira'da araba kiralarız", "rent a car as well"), not in a question, a no or a cancel.
 * "Araba ile gideceğiz" asks for nothing.
 */
export function asksForVehicle(text: string, type: VehicleType): boolean {
  return sentences(text).some((sentence) => {
    if (QUESTION.test(sentence) || CONDITIONAL.test(sentence)) return false;
    return sentence.split(PARTS).some((part) => vehicleTypesIn(part).has(type) && GET.test(part) && !NEGATION.test(part) && !CANCEL.test(part));
  });
}

/** "Bir de", "another", "as well": one more of a kind already there, said outright. */
const asksForAnother = (text: string, type: VehicleType) => asksForVehicle(text, type) && ANOTHER.test(text);

/** "Evet" / "ekle" to the assistant's own question about a vehicle ("Karavan zaten var, yine de araba ekleyeyim mi?"). */
export function confirmsVehicle(text: string, previousReply: string | null, type: VehicleType): boolean {
  return AFFIRM.test(text) && !NEGATION.test(text) && Boolean(previousReply && vehicleTypesIn(previousReply).has(type));
}

const listed = (list: Item[]) =>
  list.map((i) => {
    const p = periodOf(i);
    return `${i.name}${p ? ` (${p.start}..${i.dates.end?.slice(0, 10) ?? p.start})` : ""} id ${i.id}`;
  }).join("; ");

export interface VehicleCheck {
  /** Records to take out with this plan (the one replaced). */
  dismiss: Item[];
  /** Why nothing was added: for the model, which then asks the traveller. */
  refusal: string | null;
}

/**
 * plan_item adding `added`: the vehicles it would sit next to for the same days, and what to do about them.
 * `replaces`: what the model said this one replaces. `same`: the plan it repeats (not another vehicle).
 */
export function checkVehicle(args: {
  added: Item;
  items: Item[];
  same: Item | null;
  replaces: Item[];
  userText: string;
  previousReply: string | null;
}): VehicleCheck {
  const { added, items, same, replaces, userText, previousReply } = args;
  const type = vehicleOf(added);
  if (!type) return { dismiss: replaces, refusal: null };
  const period = periodOf(added);
  const taken = new Set(replaces.map((i) => i.id));
  const dismiss = [...replaces];
  let rest = items.filter(
    (i) => i.id !== added.id && i.id !== same?.id && !taken.has(i.id) && i.status !== "dismissed" && vehicleOf(i) && overlaps(period, periodOf(i)),
  );
  // What was cancelled is never the kind being added now ("karavan iptal, yerine karavan" is a correction, not this).
  const cancelled = replacedVehicles(userText).filter((t) => t !== type);
  if (cancelled.length && rest.length) {
    const named = rest.filter((i) => cancelled.includes(vehicleOf(i)!));
    if (named.length > 1) {
      return {
        dismiss: [],
        refusal: L(
          `Kullanıcı iptal dedi ama hangisi olduğu belli değil: ${listed(named)}. Hiçbir şey değişmedi. Kullanıcıya hangisinin iptal olduğunu sor; sonra plan_item'ı replaces ile o id'yle çağır.`,
          `The user said one was cancelled, but it's unclear which: ${listed(named)}. Nothing changed. Ask the user which one was cancelled, then call plan_item with replaces set to its id.`,
        ),
      };
    }
    if (named.length === 1) {
      dismiss.push(named[0]);
      rest = rest.filter((i) => i.id !== named[0].id);
    }
  }
  // Asked for in this message: allowed next to a vehicle of another kind; next to one of the same kind (a campervan
  // page saved before, then "karavan kiraladık") only with "bir de / another", else it is most likely that one.
  const asked = asksForVehicle(userText, type) || confirmsVehicle(userText, previousReply, type);
  const sameKind = rest.filter((i) => vehicleOf(i) === type);
  if (!rest.length || (asked && (!sameKind.length || asksForAnother(userText, type)))) return { dismiss, refusal: null };
  if (asked && sameKind.length) {
    return {
      dismiss: [],
      refusal: L(
        `Bu günler için kayıtlı aynı türde bir araç var: ${listed(sameKind)}. Kullanıcı büyük ihtimalle onu kastediyor; hiçbir şey eklenmedi. O kaydı plan_item'ı item_id = o kaydın id'siyle çağırarak güncelle (booked, şirket, fiyat); ikinci bir tane istediğinden emin değilsen sor.`,
        `A vehicle of the same kind is saved for these days: ${listed(sameKind)}. The user most likely means that one; nothing was added. Update that record by calling plan_item with item_id = its id (booked, the company, the price); if you're not sure they want a second one, ask.`,
      ),
    };
  }
  return {
    dismiss: [],
    refusal: L(
      `Bu günlerde zaten bir araç var: ${listed(rest)}. Kullanıcı bu mesajda ikinci bir araç istemedi; hiçbir şey eklenmedi. Eklemeden önce kullanıcıya kısaca sor (ör. "${rest[0].name} zaten var, yine de ekleyeyim mi?"). Kullanıcı ${rest[0].name} iptal oldu dediyse plan_item'ı replaces: "${rest[0].id}" ile tekrar çağır.`,
      `A vehicle already covers these days: ${listed(rest)}. The user didn't ask for a second one in this message; nothing was added. Ask the user briefly before adding one (e.g. "You already have ${rest[0].name}; add another anyway?"). If the user said ${rest[0].name} was cancelled, call plan_item again with replaces: "${rest[0].id}".`,
    ),
  };
}

/**
 * After the turn: the vehicles the traveller said were cancelled ("araç kiralama iptal, yerine ...") that are
 * still on the plan because nothing of that type was taken out. The chat asks about them instead of guessing.
 */
export function stillCancelled(
  userText: string,
  items: Item[],
  removedThisTurn: ReadonlySet<string>,
  removedTypes: ReadonlySet<VehicleType>,
  /** Records added, booked or chosen in this turn (the campervan just added is never the one cancelled). */
  touchedThisTurn: ReadonlySet<string> = new Set(),
): Item[] {
  const cancelled = replacedVehicles(userText).filter((t) => !removedTypes.has(t));
  if (!cancelled.length) return [];
  return items.filter(
    (i) => !removedThisTurn.has(i.id) && !touchedThisTurn.has(i.id) && i.status !== "dismissed" && cancelled.includes(vehicleOf(i) as VehicleType),
  );
}
