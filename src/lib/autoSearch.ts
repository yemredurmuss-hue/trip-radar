// Kendiliğinden arama (0.40.1, karar 3: "hepsi kendiliğinden aranır") and what the trip's shape says against it (0.40.3,
// Emre: a camper van trip got a hotel for its 14 nights). A need is looked for by itself only when nothing about the trip
// already answers it: nights spent in the van, the camp, the boat; a day trip; a way the van or the car drives; a need a
// package covers; a route still to agree (its nights and ways change with it). Pure, tested.
import { EMPTY_METRICS } from "./items";
import type { Need } from "./offerSource";
import type { TripShape } from "./playbooks/shape";
import type { Item, StayKind } from "./types";

/** Why a need isn't looked for by itself; null when it may be. */
export type AutoSearchBlock = "covered" | "closed" | "ownStay" | "sleep" | "drives" | "route";

export function autoSearchBlock(
  need: Pick<Need, "kind" | "section">,
  shape: Pick<TripShape, "sleep" | "movingBase" | "preset" | "closes">,
  at: { ownStay: boolean; routeDraft: boolean; covered: boolean },
): AutoSearchBlock | null {
  if (at.covered) return "covered";
  if (shape.closes[need.section]) return "closed";
  if (need.kind === "stay") {
    if (at.ownStay) return "ownStay";
    if (shape.sleep !== "hotel") return "sleep";
    if (at.routeDraft) return "route";
  }
  if (need.kind === "transfer") {
    if (shape.sleep === "vehicle" || shape.movingBase || shape.preset === "road") return "drives";
    if (at.routeDraft) return "route";
  }
  return null;
}

const OWN_KIND: Partial<Record<TripShape["sleep"], StayKind>> = { vehicle: "vehicle", camp: "camp", boat: "boat", cabin: "boat" };
/** The words an own stay's title starts with, in both languages (startTrip.ownStayTitle). */
const OWN_WORD = /^(Karavan|Camper van|Kamp|Camp|Tekne|Boat|Kabin|Cabin|Liveaboard)\b/;

/**
 * The trip's own stay a hotel offer took the place of (0.40.1's kendiliğinden arama filled the start's place, the van's
 * nights, with the cheapest hotel it found): put back as the start made it, by the print the start kept of it (its days,
 * its city, its name). Null when the record is anything else (the traveller's own pick or save never changes).
 */
export function restoredOwnStay(item: Item, trip: { startGuide?: { placeholders?: Record<string, string> } | null }, sleep: TripShape["sleep"]): Item | null {
  const kind = OWN_KIND[sleep];
  const print = trip.startGuide?.placeholders?.[item.id];
  if (!kind || !print || item.category !== "stay" || item.status !== "saved" || item.addedBy !== "ai" || !item.forNeed) return null;
  const [status, start, end, , , , city, ...rest] = print.split("|");
  const name = rest.join("|");
  if (status !== "chosen" || !OWN_WORD.test(name) || name === item.name) return null;
  const { forNeed: _n, typicalNight: _t, nearby: _y, reviewTopics: _r, nightStop: _s, ...base } = item;
  return {
    ...base,
    name,
    city: city || null,
    dates: { ...item.dates, start: start || null, end: end || null },
    status: "chosen",
    statusNote: null,
    origin: "chat",
    addedBy: undefined,
    summary: "",
    provider: null,
    url: null,
    imageUrl: null,
    rating: { value: null, scale: null, count: null, source: "none" },
    price: { ...item.price, amount: null, currency: null, scope: "unknown", source: "none" },
    metrics: { ...(item.metrics ?? EMPTY_METRICS), stayKind: kind },
    part: item.part ?? { ref: "stay", section: "stay", frame: "stay", word: name.split(" · ")[0] },
  };
}
