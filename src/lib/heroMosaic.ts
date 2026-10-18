// The hero's mosaic (v82 "Hero = mozaik", v83 C7 and C19): a big cover on the left, and on the right up to six tiles of
// what the trip will be like. The tiles are the places on the plan (an activity, a thing to do, a meal or a stay chosen
// or booked) that have a photo, from different cities first; with too few of those (a backbone that's new, nothing
// picked yet) they are the trip's cities instead, each with its nights. A photo that isn't there is never drawn: no
// photo at all is one cover alone. Each photo carries its credit only when one is known (C7). Pure.
import { cityKeyOf } from "./plan";
import type { IntentVM } from "./intents";
import type { PhotoCredit } from "./types";

export interface MosaicPhoto {
  image: string;
  /** Who took it and where it is from (cityImages.creditOf); null: no "i" on it. */
  credit: PhotoCredit | null;
}

export interface MosaicTile extends MosaicPhoto {
  key: string;
  /** The big line: the place, or the city. */
  name: string;
  /** The small one: the place's city, or the city's nights ("3 gece"). */
  sub: string | null;
}

export interface Mosaic {
  /** The cover's photo; null: the plain cover (no photo yet). */
  cover: MosaicPhoto | null;
  tiles: MosaicTile[];
  /** What the tiles are: places on the plan, the trip's cities, or none (the cover alone). */
  kind: "place" | "city" | null;
}

export interface MosaicCity {
  name: string;
  image: string | null;
  credit: PhotoCredit | null;
  /** Its nights' words ("3 gece"), when it has nights. */
  nights: string | null;
}

export interface MosaicPlace {
  key: string;
  name: string;
  city: string | null;
  image: string | null;
  credit: PhotoCredit | null;
  /** Booked before chosen. */
  booked: boolean;
}

/** The grid takes one row of up to three, or two rows of two or three: five would leave a hole. */
export const MOSAIC_MAX = 6;
/** Fewer places on the plan than this and the tiles are the cities (a new backbone, v83 "omurga yeni"). */
export const PLACES_MIN = 4;

/** How many tiles of `n` the grid draws: up to three in a row, two rows of two or three (five would leave a hole). */
export const fitTiles = (n: number): number => (n >= 6 ? 6 : n === 5 ? 4 : Math.max(0, n));

/**
 * Up to `max` places, from different cities before a second from the same one (booked before chosen, then in their
 * order), each photo and each name once.
 */
function spread(places: MosaicPlace[], max: number): MosaicPlace[] {
  const seenImage = new Set<string>();
  const seenName = new Set<string>();
  const usable = [...places]
    .filter((p) => p.image)
    .sort((a, b) => Number(b.booked) - Number(a.booked))
    .filter((p) => {
      const name = p.name.trim().toLocaleLowerCase();
      if (seenImage.has(p.image!) || seenName.has(name)) return false;
      seenImage.add(p.image!);
      seenName.add(name);
      return true;
    });
  const byCity = new Map<string, MosaicPlace[]>();
  for (const p of usable) {
    const key = cityKeyOf(p.city) ?? "";
    byCity.set(key, [...(byCity.get(key) ?? []), p]);
  }
  const out: MosaicPlace[] = [];
  for (let round = 0; out.length < max && [...byCity.values()].some((l) => l.length > round); round++) {
    for (const list of byCity.values()) if (list[round] && out.length < max) out.push(list[round]);
  }
  return out;
}

export function mosaicOf({ cities, places, max = MOSAIC_MAX }: { cities: MosaicCity[]; places: MosaicPlace[]; max?: number }): Mosaic {
  const first = cities.find((c) => c.image) ?? null;
  const cover = first ? { image: first.image!, credit: first.credit } : null;
  const picked = spread(places.filter((p) => p.image !== cover?.image), max);
  if (picked.length >= PLACES_MIN) {
    return {
      cover,
      kind: "place",
      tiles: picked.slice(0, fitTiles(picked.length)).map((p) => ({ key: `place:${p.key}`, name: p.name, sub: p.city, image: p.image!, credit: p.credit })),
    };
  }
  // The cities, but never the cover's own photo a second time.
  const seen = new Set(cover ? [cover.image] : []);
  const others = cities.filter((c) => {
    if (!c.image || seen.has(c.image)) return false;
    seen.add(c.image);
    return true;
  });
  const tiles = others.slice(0, fitTiles(Math.min(others.length, max))).map((c) => ({ key: `city:${c.name}`, name: c.name, sub: c.nights, image: c.image!, credit: c.credit }));
  return { cover, tiles, kind: tiles.length ? "city" : null };
}

/**
 * The places on the plan as the intents hold them: a row of cards' "Planında" (an activity, a thing to do, a meal) and
 * a stay chosen or booked, with their photos.
 */
export function placesOfIntents(intents: readonly Pick<IntentVM, "section" | "frame" | "status" | "chosen" | "planned" | "head">[], creditOf: (image: string | null) => PhotoCredit | null): MosaicPlace[] {
  return intents.flatMap((i): MosaicPlace[] => {
    if (i.frame === "collection")
      return i.planned.map((o) => ({ key: o.id, name: o.title, city: o.item.city ?? i.head.city, image: o.image, credit: creditOf(o.image), booked: o.item.status === "booked" }));
    if (i.section === "stay" && (i.status === "booked" || i.status === "chosen") && i.chosen)
      return [{ key: i.chosen.id, name: i.chosen.title, city: i.head.city, image: i.chosen.image, credit: creditOf(i.chosen.image), booked: i.status === "booked" }];
    return [];
  });
}
