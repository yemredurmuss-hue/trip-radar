// src/lib/cardKinds.ts
// What kind of thing a plan card shows, for its colour, icon and picture: ten ways to travel (approved
// transport mockup), activities, eSIMs, insurance, restaurants, notes. Read from the record as it is, no
// new field: the planned kind, the way chosen for its transfer, the category, then the words on it. Pure.
import { liveLabels } from "./i18nText";
import type { Leg } from "./legs";
import { isInsurance, isLocalTransfer, isRental, itemText, LOCAL, RENTAL } from "./travelKinds";
import type { Item, LegMode, PlannedKind } from "./types";

export const TRANSPORT_MODES = ["flight", "train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];
/** "transport": a way of travel we couldn't tell (grey, a plain arrow, no picture). */
export type CardKind = TransportMode | "transport" | "activity" | "esim" | "insurance" | "food" | "note" | "other" | "stay";

/** Rented for days in one place: the card's right side is how long, not where to. */
export const RENTAL_MODES: readonly TransportMode[] = ["car", "moto", "rv", "bike"];
/** A ticket is bought for these ("Bileti aldım"). */
export const TICKET_MODES: readonly TransportMode[] = ["flight", "train", "bus", "minibus", "ferry"];

const FROM_PLANNED: Partial<Record<PlannedKind, TransportMode>> = {
  flight: "flight", train: "train", bus: "bus", minibus: "minibus", ferry: "ferry", transfer: "taxi", taxi: "taxi",
  car_rental: "car", moto_rental: "moto", rv_rental: "rv", bike_rental: "bike",
};
/** A transfer's chosen way; metro and walking have no picture of their own. */
const FROM_LEG: Partial<Record<LegMode, TransportMode>> = { flight: "flight", train: "train", bus: "bus", ferry: "ferry", taxi: "taxi", transfer: "taxi", car: "car" };
/** The words on a page or a plan, most specific first (a minibus isn't a bus, a scooter rental isn't a car). */
const BY_TEXT: [RegExp, TransportMode][] = [
  [/karavan|kamp aracı|camper|motorhome|motor home/i, "rv"],
  [/motosiklet|motorsiklet|scooter|moped|motorbike|motorcycle/i, "moto"],
  [/bisiklet|bicycle|\be-?bike\b|\bbike\b/i, "bike"],
  [/minibüs|dolmuş|minibus/i, "minibus"],
  [/vapur|feribot|ferry|ferri/i, "ferry"],
  [/tren|train|comboio|\brail|renfe|trenitalia|sncf|alfa pendular|intercidades/i, "train"],
  [/otobüs|\bbus\b|flixbus|coach|autocarro|rede expressos|\balsa\b/i, "bus"],
  [RENTAL, "car"],
  [LOCAL, "taxi"],
];

export const legTransportMode = (mode: LegMode | null | undefined): TransportMode | null => (mode ? (FROM_LEG[mode] ?? null) : null);

/** The way of travel: planned kind → the transfer's chosen way → a flight → its words → a rental/transfer by shape → unknown. */
export function transportMode(item: Item, legMode: LegMode | null = null): TransportMode | null {
  const planned = item.plannedKind ? FROM_PLANNED[item.plannedKind] : undefined;
  if (planned) return planned;
  const fromLeg = legTransportMode(legMode);
  if (fromLeg) return fromLeg;
  if (item.category === "flight") return "flight";
  const text = itemText(item);
  const said = BY_TEXT.find(([re]) => re.test(text));
  if (said) return said[1];
  if (isRental(item)) return "car";
  if (isLocalTransfer(item)) return "taxi";
  return null;
}

export function cardKind(item: Item, legMode: LegMode | null = null): CardKind {
  switch (item.category) {
    case "stay":
      return "stay";
    case "activity":
      return "activity";
    case "food":
      return "food";
    case "esim":
      return "esim";
    case "flight":
      return transportMode(item, legMode) ?? "flight";
    case "transport":
      return isInsurance(item) ? "insurance" : (transportMode(item, legMode) ?? "transport");
    default:
      if (isInsurance(item)) return "insurance";
      if (item.plannedKind === "note") return "note";
      if (/\besim\b|e-sim|sim kart/i.test(itemText(item))) return "esim";
      return "other";
  }
}

const COLORS: Record<CardKind, string> = {
  flight: "#6a4fe0", train: "#2563c9", bus: "#d9480f", minibus: "#e8890c", ferry: "#0e8fb0", taxi: "#d29a00",
  car: "#475467", moto: "#c0256b", rv: "#8a6534", bike: "#5d8a1c", transport: "#6e6e73",
  activity: "#a8336f", esim: "#3b6fd1", insurance: "#0f8a6a", food: "#b4532a", note: "#6e6e73", other: "#6e6e73", stay: "#23998b",
};
const LABELS = liveLabels({
  flight: ["Uçuş", "Flight"], train: ["Tren", "Train"], bus: ["Otobüs", "Bus"], minibus: ["Minibüs", "Minibus"], ferry: ["Vapur", "Ferry"],
  taxi: ["Taksi · transfer", "Taxi · transfer"], car: ["Araç kiralama", "Car rental"], moto: ["Motosiklet", "Motorbike"],
  rv: ["Karavan", "Camper van"], bike: ["Bisiklet", "Bike"], transport: ["Ulaşım", "Transport"], activity: ["Etkinlik", "Activity"],
  esim: ["eSIM", "eSIM"], insurance: ["Sigorta", "Insurance"], food: ["Restoran", "Restaurant"], note: ["Not", "Note"],
  other: ["Diğer", "Other"], stay: ["Konaklama", "Stay"],
});
export const cardKindColor = (k: CardKind): string => COLORS[k];
export const cardKindLabel = (k: CardKind): string => LABELS[k];
export const isTransportKind = (k: CardKind): k is TransportMode | "transport" => k === "transport" || (TRANSPORT_MODES as readonly string[]).includes(k);

/** The way the traveller chose for each transfer, for the records in it (its options and the trip it meets). */
export function legModeByItem(legs: Leg[]): Map<string, LegMode> {
  const out = new Map<string, LegMode>();
  for (const leg of legs) {
    const mode = leg.choice?.mode;
    if (!mode) continue;
    for (const i of [...leg.options, ...(leg.travel?.items ?? [])]) if (!out.has(i.id)) out.set(i.id, mode);
  }
  return out;
}
