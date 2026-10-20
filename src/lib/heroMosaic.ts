// The hero's mosaic (v82 "Hero = mozaik", v81 "kareler plandan ve birikenden", v83 C7 and C19; A · Kapak 2026-10-19: the
// cover the full width, the tiles a row of six under it, each with a dot for where it stands): the cover, and up to six tiles of what the trip will be like, taken in this order (row 14; 0.38.3): the places on the
// plan (an activity, a thing to do, a meal or a stay chosen or booked), then the photos of what was saved for the trip (the
// Pano's links), then the trip's cities each with its nights, then the connected source's tours for its cities (Viator's
// photos, the same answers the Etkinlik rows were given), then the trip's moments (a romantic evening, the food: the
// start's scenes), and last a drawing for a city with no photo yet. A source with nothing is passed over. A photo that
// isn't there is never drawn and a drawing never outnumbers the photos: no photo at all is one cover alone (C19). Each
// photo carries its credit only when one is known (C7). A photo of a thing on the plan (a record's, the source's tour) goes to
// its card when tapped (0.38.9); a city's or a moment's doesn't. Pure.
import { stopCountry } from "./collectionCards";
import { citiesOfPlan } from "./categories";
import { needKey } from "./emptyCards";
import { L } from "./i18n";
import { cityKeyOf, sameCity, type Plan } from "./plan";
import type { IntentVM } from "./intents";
import type { Need, Offer } from "./offerSource";
import type { PhotoCredit } from "./types";

export interface MosaicPhoto {
  image: string;
  /** Who took it and where it is from (cityImages.creditOf); null: no "i" on it. */
  credit: PhotoCredit | null;
}

/** Where a tile comes from, in the order they are taken. */
export type TileSource = "place" | "link" | "city" | "offer" | "moment" | "art";

/**
 * Where a tile's photo is on the plan (0.38.9): a record's card (a place on the plan, a link saved, a stay), or the
 * source's tour among a city's Öneriler. A city, a moment or a drawing has none: it isn't a thing to go to.
 */
export type TileTarget = { item: string } | { offer: string; city: string | null };

export interface MosaicTile {
  key: string;
  from: TileSource;
  /** The card a tap on it goes to; null: it isn't tapped. */
  target: TileTarget | null;
  /** The photo; null only for a drawing ("art"). */
  image: string | null;
  credit: PhotoCredit | null;
  /** The big line: the place, the city, the moment. */
  name: string;
  /** The small one: the place's city, or the city's nights ("3 gece"). */
  sub: string | null;
  /**
   * Where it stands, for the dot on its corner (A · Kapak): a place on the plan booked or only planned, a city by its
   * stay; null for what is only an idea or a picture (a saved link, the source's tour, a moment).
   */
  state: TileState;
}

export type TileState = "booked" | "planned" | null;

export interface Mosaic {
  /** The cover's photo; null: the plain cover (no photo yet). */
  cover: MosaicPhoto | null;
  tiles: MosaicTile[];
  /** What the tiles mostly are: places (on the plan, saved or the source's tours), the trip's cities, or none (the cover alone). */
  kind: "place" | "city" | null;
}

export interface MosaicCity {
  name: string;
  image: string | null;
  credit: PhotoCredit | null;
  /** Its nights' words ("3 gece"), when it has nights. */
  nights: string | null;
  /** Its stay booked or not yet (the route's dot); left out or null: no dot. */
  state?: TileState;
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

/** One of the trip's moments (startTrip photoMoments): its words and its photo. */
export interface MosaicMoment {
  name: string;
  image: string;
  credit: PhotoCredit | null;
}

/** The grid takes one row of up to three, or two rows of two or three: five would leave a hole. */
export const MOSAIC_MAX = 6;

/** How many tiles of `n` the grid draws: up to three in a row, two rows of two or three (five would leave a hole). */
export const fitTiles = (n: number): number => (n >= 6 ? 6 : n === 5 ? 4 : Math.max(0, n));

/**
 * Up to `max` places, from different cities before a second from the same one (booked before chosen, then in their
 * order).
 */
function spread(places: readonly MosaicPlace[], max: number): MosaicPlace[] {
  const usable = places.filter((p) => p.image).sort((a, b) => Number(b.booked) - Number(a.booked));
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

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * The tiles as drawn: those whose photo failed to load gone (a drawing stays), never more drawings than photos, and as
 * many as the grid takes without a hole.
 */
export function shownTiles(tiles: readonly MosaicTile[], failed: ReadonlySet<string> = new Set()): MosaicTile[] {
  const photos = tiles.filter((t) => t.image && !failed.has(t.image));
  const art = tiles.filter((t) => !t.image).slice(0, photos.length);
  const all = [...photos, ...art];
  return all.slice(0, fitTiles(all.length));
}

export function mosaicOf({ cities, places, links = [], offers = [], moments = [], max = MOSAIC_MAX }: {
  cities: readonly MosaicCity[];
  places: readonly MosaicPlace[];
  /** What was saved for the trip with a photo (the Pano's links), not on the plan. */
  links?: readonly MosaicPlace[];
  /** The connected source's tours for the trip's cities, with their photos (offerTiles). */
  offers?: readonly MosaicPlace[];
  moments?: readonly MosaicMoment[];
  max?: number;
}): Mosaic {
  const first = cities.find((c) => c.image) ?? null;
  const cover = first ? { image: first.image!, credit: first.credit } : null;
  // Each photo once (never the cover's again), each name once.
  const seenImage = new Set(cover ? [cover.image] : []);
  const seenName = new Set<string>();
  const photos: MosaicTile[] = [];
  const take = (list: MosaicTile[]) => {
    for (const t of list) {
      if (photos.length >= max) return;
      if (!t.image || seenImage.has(t.image) || seenName.has(nameKey(t.name))) continue;
      seenImage.add(t.image);
      seenName.add(nameKey(t.name));
      photos.push(t);
    }
  };
  const placeTile = (from: "place" | "link" | "offer") => (p: MosaicPlace): MosaicTile => ({
    key: `${from}:${p.key}`,
    from,
    target: from === "offer" ? { offer: p.key, city: p.city } : { item: p.key },
    name: p.name,
    sub: p.city,
    image: p.image,
    credit: p.credit,
    state: from === "place" ? (p.booked ? "booked" : "planned") : null,
  });
  take(spread(places, places.length).map(placeTile("place")));
  take(spread(links, links.length).map(placeTile("link")));
  take(cities.map((c) => ({ key: `city:${c.name}`, from: "city", target: null, name: c.name, sub: c.nights, image: c.image, credit: c.credit, state: c.state ?? null })));
  take(spread(offers, offers.length).map(placeTile("offer")));
  // P9 (F12): no abstract "moment" tiles ("Romantik akşam", "Sokaklar"): a tile is a real place, a save, a tour or a city.
  void moments;
  // Last, a city with no photo yet as a drawing (its name and nights on it), never the cover's own.
  if (first) seenName.add(nameKey(first.name));
  const art: MosaicTile[] = cities
    .filter((c) => !c.image && c.name.trim() && !seenName.has(nameKey(c.name)))
    .map((c) => ({ key: `art:${c.name}`, from: "art", target: null, name: c.name, sub: c.nights, image: null, credit: null, state: c.state ?? null }));
  const tiles = shownTiles([...photos, ...art.slice(0, Math.max(0, max - photos.length))]);
  const placed = tiles.filter((t) => t.from === "place" || t.from === "link" || t.from === "offer").length;
  return { cover, tiles, kind: !tiles.length ? null : placed * 2 >= tiles.length ? "place" : "city" };
}

/** A tile that goes to its card, in words for a reader ("ATV turu kartına git"). */
export const tileGoLabel = (tile: Pick<MosaicTile, "name">): string => L(`${tile.name} kartına git`, `Go to ${tile.name}`);

/**
 * Where on the page a tile's card is, the first found taken: a record's card (its section opened by the caller); the
 * source's tour in its city's Öneriler, else that city's Etkinlik box (Öneriler folded, the tour not among its four), else
 * Etkinlik itself.
 */
export function tileSelectors(t: TileTarget): string[] {
  const q = (v: string) => JSON.stringify(v);
  if ("item" in t) return [`[data-item-id=${q(t.item)}]`];
  return [`[data-k=${q(`o:${t.offer}`)}]`, ...(t.city ? [`[data-intent=${q(`activity:${t.city}`)}]`] : []), `[data-section="activity"]`];
}

/** The trip's moments among its photos (startTrip photoMoments: kept in `cityImages` under their own words). */
export function momentsOf(cityImages: Readonly<Record<string, string | null>> | undefined, labels: readonly { key: string; name: string }[], creditOf: (image: string) => PhotoCredit | null): MosaicMoment[] {
  if (!cityImages) return [];
  const out: MosaicMoment[] = [];
  for (const { key, name } of labels) {
    const image = cityImages[key];
    if (image && !out.some((m) => m.image === image)) out.push({ name, image, credit: creditOf(image) });
  }
  return out;
}

/**
 * What was saved for the trip with a photo and isn't on the plan (the Pano's links: a stay, a tour, a meal): the mosaic's
 * second source. Flights, transfers, eSIMs and policies say nothing of what the trip looks like.
 */
export function linksOf(items: readonly { id: string; name: string; city: string | null; imageUrl: string | null; status: string; category: string }[], creditOf: (image: string | null) => PhotoCredit | null): MosaicPlace[] {
  return items
    .filter((i) => i.imageUrl && i.status === "saved" && (i.category === "stay" || i.category === "activity" || i.category === "food"))
    .map((i) => ({ key: i.id, name: i.name, city: i.city, image: i.imageUrl, credit: creditOf(i.imageUrl), booked: false }));
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

/**
 * The questions the Etkinlik rows ask the connected source for their cities' tours (CollectionRow's useCityOffers, built
 * the same way so the hero's ask is the same one and is answered from the source's store, never a second request): one
 * for each city with an Etkinlik row, its stop's days, its country for a town the source doesn't know.
 */
export function tourNeeds(plan: Pick<Plan, "stayBlocks">, cities: readonly (string | null | undefined)[], adults: number | null): { need: Need; country: string | null }[] {
  const stops = citiesOfPlan(plan);
  const out: { need: Need; country: string | null }[] = [];
  for (const city of cities) {
    const stop = city ? stops.find((c) => sameCity(c.city, city)) : null;
    if (!stop || out.some((x) => sameCity(x.need.city ?? null, stop.city))) continue;
    out.push({
      need: { key: needKey("activity", stop.city, stop.start, stop.end), section: "activity", kind: "activity", city: stop.city, start: stop.start, end: stop.end, adults },
      country: stopCountry(plan, stop.city),
    });
  }
  return out;
}

/** The source's tours with a photo as the mosaic's places (their credit isn't known: no "i"), a tour once. */
export function offerTiles(byCity: readonly { city: string; offers: readonly Pick<Offer, "id" | "title" | "photo">[] }[]): MosaicPlace[] {
  const out: MosaicPlace[] = [];
  for (const { city, offers } of byCity)
    for (const o of offers) if (o.photo && !out.some((p) => p.key === o.id)) out.push({ key: o.id, name: o.title, city, image: o.photo, credit: null, booked: false });
  return out;
}
