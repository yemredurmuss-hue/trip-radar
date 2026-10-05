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
const CAR = words("araba\\p{L}*|ara[cç]\\p{L}*|otomobil\\p{L}*|cars?(?!\\p{L})|rent ?a ?car|car hire|car rental|kiral[ıi]k ara[cç]\\p{L}*");

const CANCEL = words("iptal\\p{L}*|vazge[cç]\\p{L}*|cancel\\p{L}*|called off|dropp?ed");
const INSTEAD = words("yerine|instead");
const NEGATION = words("istemiyor\\p{L}*|istemeyiz|gerek yok|gerekmez|gerek kalmad\\p{L}*|kiralamay\\p{L}*|kiralam[ıi]yor\\p{L}*|almay[ıa]l[ıi]m|alm[ıi]yor\\p{L}*|no need|don'?t|do not|won'?t|not (?:rent|hire|need|book|get|want)");
const QUESTION = /\?|(?<![\p{L}])m[ıiuü](?:s[ıiuü]n|y[ıiuü]z)?(?![\p{L}])/iu;
const AFFIRM = /^\s*(evet|olur|tamam|ekle\p{L}*|kirala\p{L}*|koy|yes|yep|yeah|sure|ok(?:ay)?|go ahead|please do|do it)(?![\p{L}])/iu;

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
  if (item.category === "stay") return CAMPER.test(text) ? "camper" : null;
  if (item.category !== "transport") return null;
  const kind = item.plannedKind;
  if (kind === "rv_rental") return "camper";
  if (kind === "moto_rental") return "moto";
  if (kind === "bike_rental") return null;
  if (kind && kind !== "car_rental") return null;
  if (!kind && !isRental(item) && !CAMPER.test(text)) return null;
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
  if (!INSTEAD.test(text)) return [];
  const out = new Set<VehicleType>();
  const add = (s: string) => vehicleTypesIn(s).forEach((t) => out.add(t));
  // The clause that says what's cancelled: "araç kiralama iptal", "we cancelled the car".
  for (const clause of text.split(/[,.;!?\n]|\s(?:ama|fakat|but|and|ve)\s/iu)) if (CANCEL.test(clause)) add(clause);
  // "araba yerine karavan": the words just before "yerine" ("onun yerine" points back, it names nothing).
  for (const m of text.matchAll(/((?:[\p{L}'’]+\s+){0,2}[\p{L}'’]+)\s+yerine/giu)) {
    if (!/(?:^|\s)(onun|bunun|şunun|onların|bunların)$/iu.test(m[1])) add(m[1]);
  }
  // "instead of the car".
  for (const m of text.matchAll(/instead of\s+((?:[\p{L}'’-]+\s*){1,4})/giu)) add(m[1]);
  return [...out];
}

/** The traveller asks for a vehicle of this type in this message ("bir de araba kirala", "Madeira'da araba kiralarız"). */
export function asksForVehicle(text: string, type: VehicleType): boolean {
  return vehicleTypesIn(text).has(type) && !NEGATION.test(text) && !CANCEL.test(text) && !QUESTION.test(text);
}

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
  const cancelled = replacedVehicles(userText);
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
  if (!rest.length || asksForVehicle(userText, type) || confirmsVehicle(userText, previousReply, type)) return { dismiss, refusal: null };
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
export function stillCancelled(userText: string, items: Item[], removedThisTurn: ReadonlySet<string>, removedTypes: ReadonlySet<VehicleType>): Item[] {
  const cancelled = replacedVehicles(userText).filter((t) => !removedTypes.has(t));
  if (!cancelled.length) return [];
  return items.filter((i) => !removedThisTurn.has(i.id) && i.status !== "dismissed" && cancelled.includes(vehicleOf(i) as VehicleType));
}
