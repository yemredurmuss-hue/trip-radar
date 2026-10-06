// Capture pipeline: URL facts -> model extraction -> trip assignment -> merge or insert item.
import { addEvent, db, listTrips, newId, nextTime, notifyChanged } from "./db";
import { moveDocsToTrip } from "./docs";
import type { Extraction } from "./extract";
import { describeError, getProvider } from "./llm";
import { valueOnPage } from "./evidence";
import { geocode } from "./geo";
import { L } from "./i18n";
import { imageProxy, pickCityImage } from "./cityImages";
import { buildItem, CATEGORY_LABELS, corpusOf, findDuplicate, formatDateRange, isoDate, mergeItem } from "./items";
import { chooseTrip, countryCodeOf, countryName, isDemoTrip, profileTrips, uniqueTitle, type TripChoice, type TripSignal } from "./trips";
import { askText, countriesText, looksLikeTravel, placeCodes, placeFit, routeCapture, titleCodes, tripPlaceCodes, type Route } from "./placeCheck";
import type { PageSnapshot } from "./pagecapture";
import type { Capture, Geo, HeldCapture, Item, Trip } from "./types";
import { parseUrl, type UrlFacts } from "./url";

export type Extractor = (capture: Capture, facts: UrlFacts, trips: Trip[]) => Promise<Extraction>;

/** External calls, injectable so the pipeline can be tested offline. */
export interface Deps {
  extract: Extractor;
  heroImage: (place: string | null) => Promise<string | null>;
  /** Place name → coordinates (defaults to cached OpenStreetMap lookup). */
  geocode?: (query: string) => Promise<Geo | null>;
  /** Cuts the option's photo out of a screenshot (defaults to an offscreen canvas where there is one). */
  crop?: (dataUrl: string, box: Box) => Promise<string | null>;
}

const defaultDeps: Deps = {
  extract: async (capture, facts, trips) => (await getProvider()).extract(capture, facts, trips),
  heroImage: destinationImage,
  crop: cropImage,
};

/** [ymin, xmin, ymax, xmax], 0–1000 of the image. */
export type Box = [number, number, number, number];

/**
 * A box the model gave for the option's photo, if it's a plausible one: inside the image, a real
 * photo's size (not a sliver, not the whole screenshot), not too long or tall.
 */
export function photoBox(box: number[] | null | undefined): Box | null {
  if (!box || box.length !== 4 || box.some((v) => !Number.isFinite(v))) return null;
  const [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, v)));
  const [h, w] = [y1 - y0, x1 - x0];
  if (h < 60 || w < 60 || (h > 950 && w > 950)) return null;
  if (w / h > 4 || h / w > 3) return null;
  return [y0, x0, y1, x1];
}

/** The box cut out of a data URL image as a small JPEG data URL (at most 640 px wide). */
export async function cropImage(dataUrl: string, box: Box): Promise<string | null> {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return null;
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const [y0, x0, y1, x1] = box;
  const sx = (x0 / 1000) * bitmap.width;
  const sy = (y0 / 1000) * bitmap.height;
  const sw = ((x1 - x0) / 1000) * bitmap.width;
  const sh = ((y1 - y0) / 1000) * bitmap.height;
  const scale = Math.min(1, 640 / sw);
  const canvas = new OffscreenCanvas(Math.round(sw * scale), Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

// --- creating captures ------------------------------------------------------------------------

function baseCapture(kind: Capture["kind"]): Capture {
  return {
    id: newId(),
    kind,
    url: null,
    title: null,
    pageText: "",
    viewportText: "",
    selection: "",
    jsonLd: [],
    meta: {},
    screenshot: null,
    capturedAt: nextTime(), // strictly increasing: captures are processed in click order
    status: "pending",
    error: null,
    itemId: null,
  };
}

export async function saveSnapshot(snapshot: PageSnapshot, screenshot: string | null): Promise<Capture> {
  const capture: Capture = { ...baseCapture("extension"), ...snapshot, screenshot };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

/**
 * `forTripId`: handed to one trip's board, it goes into that trip (as a shared trip's capture does), unless its
 * place is far from that trip's (placeCheck.ts). `fromTripId`: sent in that trip's chat (routed as any capture,
 * checked against that trip).
 */
export async function savePastedLink(url: string, forTripId?: string, fromTripId?: string): Promise<Capture> {
  const capture: Capture = { ...baseCapture("paste-link"), url, ...(forTripId ? { forTripId } : {}), ...(fromTripId && !forTripId ? { fromTripId } : {}) };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

export async function saveImage(dataUrl: string, forTripId?: string, fromTripId?: string): Promise<Capture> {
  const capture: Capture = { ...baseCapture("image"), screenshot: dataUrl, ...(forTripId ? { forTripId } : {}), ...(fromTripId && !forTripId ? { fromTripId } : {}) };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

// --- processing -------------------------------------------------------------------------------

export async function processCapture(captureId: string, deps: Deps = defaultDeps): Promise<void> {
  const d = await db();
  const capture = await d.get("captures", captureId);
  if (!capture || capture.status === "done" || capture.status === "processing") return;
  await d.put("captures", { ...capture, status: "processing", error: null });
  notifyChanged();

  try {
    const facts = parseUrl(capture.url ?? "");
    const trips = await listTrips();
    const extraction = await deps.extract(capture, facts, trips);
    // A capture from a shared trip goes into that trip, wherever its country or dates would send it.
    const forced = capture.forTripId ? trips.find((t) => t.id === capture.forTripId) : undefined;
    // Where it was handed over (a trip's board or chat): what the place check measures it against.
    const anchor = forced ?? (capture.fromTripId ? trips.find((t) => t.id === capture.fromTripId) : undefined);
    const allItems = await d.getAll("items");
    const choice: TripChoice = forced ? { tripId: forced.id } : chooseTrip(tripSignal(extraction, facts), profileTrips(trips, allItems));
    // A new trip is only made once something goes into it (a page that is asked about makes none).
    const newTripId = "tripId" in choice ? null : newId();
    let incoming = buildItem(extraction, capture, facts, "tripId" in choice ? choice.tripId : newTripId!);
    // Only a screenshot: the option's photo cut out of it (a car, a room), when the model found one.
    const box = !incoming.imageUrl && capture.screenshot ? photoBox(extraction.image_box) : null;
    if (box) {
      const photo = await (deps.crop ?? cropImage)(capture.screenshot!, box).catch(() => null);
      if (photo) incoming = { ...incoming, imageUrl: photo };
    }

    // ...and only merges with that trip's options (the same hotel may sit in another, private trip).
    const existing = allItems.filter((i) => !forced || i.tripId === forced.id);
    const duplicate = findDuplicate(existing, incoming);
    let item = await withGeo(duplicate ? mergeItem(duplicate.item, incoming, duplicate.placeOnly) : incoming, deps.geocode ?? geocode);

    // Does it belong where it is going? (placeCheck.ts) A shared trip's capture was checked on the computer it
    // was saved on: what arrives from the server goes where its sender put it.
    const route: Route = capture.sharedAt
      ? { kind: "keep" }
      : routeCapture({
          item,
          merged: Boolean(duplicate),
          newTrip: item.tripId === newTripId,
          anchorId: anchor?.id ?? null,
          travel: looksLikeTravel(extraction),
          trips,
          items: allItems,
        });
    if (route.kind === "ask") {
      await holdCapture(capture, item, route, extraction, trips, allItems, Boolean(duplicate));
      notifyChanged();
      return;
    }
    const before = duplicate?.item.tripId ?? null;
    if (route.kind === "move") item = { ...item, tripId: route.toTripId };
    if (item.tripId === newTripId) {
      const now = Date.now();
      const made: Trip = {
        id: newTripId,
        title: uniqueTitle((choice as { newTitle: string }).newTitle, facts.checkIn ?? isoDate(extraction.dates.start), trips),
        confirmedDates: null,
        budget: null,
        heroImage: await deps.heroImage(extraction.city ?? extraction.country),
        createdAt: now,
        updatedAt: now,
      };
      await d.put("trips", made);
    }
    await d.put("items", item);
    if (before && before !== item.tripId) await moveDocsToTrip(item.id, item.tripId);

    await addEvent(item.tripId, savedLine(item, incoming.status === "booked", Boolean(duplicate), capture.sharedBy));
    // Handed to one trip, gone to another (the trip of its place): the trip it was handed to says where, with
    // Aç · Geri al. So does the trip a record left when its place turned out to be another's (a later save).
    const noteIn = anchor && anchor.id !== item.tripId ? anchor.id : before && before !== item.tripId ? before : null;
    if (noteIn) {
      const to = (await d.get("trips", item.tripId))?.title ?? "";
      const far = placeFit(placeCodes(item), tripPlaceCodes(noteIn, allItems, item.id)) === "far";
      await addEvent(noteIn, movedLine(item, to), {
        routing: { kind: "moved", itemId: item.id, fromTripId: noteIn, toTripId: item.tripId, far, merged: Boolean(duplicate) && before === item.tripId },
      });
    }
    // The trip as stored now: it may have changed (shared, renamed) while the model was reading.
    const current = await d.get("trips", item.tripId);
    if (current) await d.put("trips", { ...current, heroImage: current.heroImage ?? item.imageUrl, updatedAt: Date.now() });
    await d.put("captures", { ...capture, status: "done", error: null, itemId: item.id });
  } catch (error) {
    await d.put("captures", { ...capture, status: "error", error: describeError(error) });
  }
  notifyChanged();
}

/** What the model and the address say about where and when, for chooseTrip. */
function tripSignal(extraction: Extraction, facts: UrlFacts): TripSignal {
  const code = countryCodeOf(extraction.country_code) ?? placeCodes({ category: extraction.category, countryCode: null, country: extraction.country, city: extraction.city, flight: null })[0] ?? null;
  return {
    countryCode: code,
    country: extraction.country,
    start: facts.checkIn ?? isoDate(extraction.dates.start),
    end: facts.checkOut ?? isoDate(extraction.dates.end),
    suggestedTripId: extraction.trip.existing_trip_id,
    suggestedTitle: extraction.trip.new_trip_title,
    // An activity's or a restaurant's date from its page (a date picker remembers the last search) isn't the trip's.
    softDates: !facts.checkIn && ["activity", "food", "other"].includes(extraction.category),
  };
}

/** "✓ Casa Azul kaydedildi → Konaklama · Porto" (or booked, or updated): the trip's line for a saved page. */
export function savedLine(item: Item, booked: boolean, updated: boolean, sharedBy?: string): string {
  const where = [CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
  const dates = item.dates.start ? ` · ${formatDateRange(item.dates.start, item.dates.end)}` : "";
  if (booked) {
    return L(
      `✓ ${item.name} rezerve edildi${dates} (onaydan); plan buna göre güncellendi`,
      `✓ ${item.name} booked${dates} (from the confirmation); the plan is updated`,
    );
  }
  if (updated) return L(`↻ ${item.name} güncellendi`, `↻ ${item.name} updated`);
  return L(
    `✓ ${item.name} kaydedildi → ${where}${sharedBy ? ` (${sharedBy} ekledi)` : ""}`,
    `✓ ${item.name} saved → ${where}${sharedBy ? ` (added by ${sharedBy})` : ""}`,
  );
}

/** "↪ Nusa Penida … Bali gezine eklendi (yeri Endonezya)": the line in the trip it was handed to. */
export function movedLine(item: Item, toTitle: string): string {
  const country = countriesText(placeCodes(item).slice(0, 1));
  return L(
    `↪ ${item.name} ${toTitle} gezine eklendi${country ? ` (yeri ${country})` : ""}`,
    `↪ ${item.name} went to your ${toTitle} trip${country ? ` (it's in ${country})` : ""}`,
  );
}

/**
 * Not added: the record is kept on the capture (a record already saved leaves the plan with it) and the trip
 * asks in its chat; with no trip to ask in, only the popup asks.
 */
async function holdCapture(capture: Capture, item: Item, route: Extract<Route, { kind: "ask" }>, extraction: Extraction, trips: Trip[], allItems: Item[], existed: boolean): Promise<void> {
  const d = await db();
  const codes = placeCodes(item);
  const newTitle =
    extraction.trip.new_trip_title?.trim() || extraction.country?.trim() || countryName(codes[0] ?? null) || extraction.city?.trim() || L("Yeni gezi", "New trip");
  const tripCodes = route.askIn ? tripPlaceCodes(route.askIn, allItems, item.id) : new Set<string>();
  const asked = trips.find((t) => t.id === route.askIn);
  const question = askText(route.reason, item.name, codes, tripCodes.size ? tripCodes : asked ? titleCodes(asked.title) : []);
  const held: HeldCapture = { reason: route.reason, item: { ...item, tripId: route.askIn ?? item.tripId }, tripId: route.askIn, newTitle, question, askedAt: Date.now() };
  if (existed) {
    await d.delete("items", item.id);
    await addEvent(item.tripId, L(`${item.name} plandan çıkarıldı: yeri bu gezinin değil`, `${item.name} taken off the plan: its place isn't this trip's`));
  }
  await d.put("captures", { ...capture, status: "done", error: null, itemId: null, held });
  if (route.askIn) await addEvent(route.askIn, question, { routing: { kind: "ask", captureId: capture.id, reason: route.reason, newTitle } });
}

/**
 * Coordinates for distance comparisons: the page's own if it had them, else a lookup by address or
 * name. The city centre is looked up too (cached) as the fallback reference point.
 */
async function withGeo(item: Item, lookup: (q: string) => Promise<Geo | null>): Promise<Item> {
  const place = [item.city, item.country].filter(Boolean).join(", ");
  if (place) await lookup(place).catch(() => null); // warms the centre cache used by the board
  if (item.geo || !["stay", "activity", "food", "other"].includes(item.category)) return item;
  const queries = [item.location.address, [item.name, place].filter(Boolean).join(", ")].filter(Boolean) as string[];
  for (const q of queries) {
    const geo = await lookup(q).catch(() => null);
    if (geo) return { ...item, geo };
  }
  return item;
}

/** Scenic header image (sharing-server proxy first, then Wikipedia); silently null when unavailable. */
export async function destinationImage(place: string | null): Promise<string | null> {
  if (!place) return null;
  return pickCityImage(place, { proxy: await imageProxy() });
}

let running: Promise<void> | null = null;

export const isProcessing = () => running !== null;

/** Processes every pending capture one at a time. Safe to call repeatedly. */
export function processPending(deps?: Deps): Promise<void> {
  running ??= (async () => {
    try {
      const d = await db();
      for (;;) {
        const next = (await d.getAllFromIndex("captures", "status", "pending"))
          .sort((a, b) => a.capturedAt - b.capturedAt)[0];
        if (!next) break;
        await processCapture(next.id, deps);
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Re-checks facts marked "unverified" against the stored page text with the current rules. */
export async function reverifyFacts(): Promise<void> {
  const d = await db();
  let changed = false;
  for (const item of await d.getAll("items")) {
    const needsPrice = item.price.source === "unverified" && item.price.amount != null;
    const needsRating = item.rating.source === "unverified" && item.rating.value != null;
    if (!needsPrice && !needsRating) continue;
    const capture = await d.get("captures", item.captureIds.at(-1) ?? "");
    if (!capture) continue;
    const corpus = corpusOf(capture);
    const next = { ...item };
    if (needsPrice && valueOnPage(item.price.amount!, corpus, true)) next.price = { ...item.price, source: "page" };
    if (needsRating && valueOnPage(item.rating.value!, corpus, false)) next.rating = { ...item.rating, source: "page" };
    if (next.price !== item.price || next.rating !== item.rating) {
      await d.put("items", next);
      changed = true;
    }
  }
  if (changed) notifyChanged();
}

/**
 * Real captures that landed in a sample trip (before sample trips were excluded from routing)
 * move to where they belong. Safe to run repeatedly.
 */
export async function rehomeFromDemoTrips(heroImage: Deps["heroImage"] = destinationImage): Promise<void> {
  const d = await db();
  const trips = await listTrips();
  const demoIds = new Set(trips.filter(isDemoTrip).map((t) => t.id));
  if (!demoIds.size) return;
  const strays = (await d.getAll("items")).filter((i) => demoIds.has(i.tripId) && i.captureIds.length > 0);
  for (const item of strays) {
    const current = await listTrips();
    const choice = chooseTrip(
      {
        countryCode: item.countryCode,
        country: item.country,
        start: item.dates.start,
        end: item.dates.end,
        suggestedTripId: null,
        suggestedTitle: item.country,
      },
      profileTrips(current, await d.getAll("items")),
    );
    let tripId: string;
    if ("tripId" in choice) tripId = choice.tripId;
    else {
      const now = Date.now();
      const trip: Trip = {
        id: newId(),
        title: uniqueTitle(choice.newTitle, item.dates.start, current),
        confirmedDates: null,
        budget: null,
        heroImage: (await heroImage(item.city ?? item.country)) ?? item.imageUrl,
        createdAt: now,
        updatedAt: now,
      };
      await d.put("trips", trip);
      tripId = trip.id;
    }
    await d.put("items", { ...item, tripId, updatedAt: Date.now() });
    await moveDocsToTrip(item.id, tripId);
    await addEvent(tripId, L(`✓ ${item.name} örnek geziden buraya taşındı`, `✓ ${item.name} moved here from the sample trip`));
  }
  if (strays.length) notifyChanged();
}

/**
 * A service worker can be stopped mid-call. Call once when a fresh worker starts, before any
 * processing: whatever is still "processing" belonged to the previous worker and goes back in the queue.
 */
export async function recoverStuck(): Promise<void> {
  const d = await db();
  for (const capture of await d.getAllFromIndex("captures", "status", "processing")) {
    await d.put("captures", { ...capture, status: "pending" });
  }
}

/** Puts every failed capture back in the queue (e.g. after a key was added or a quota reset). */
export async function retryAllFailed(): Promise<void> {
  const d = await db();
  for (const capture of await d.getAllFromIndex("captures", "status", "error")) {
    await d.put("captures", { ...capture, status: "pending", error: null });
  }
  notifyChanged();
}

export async function retryCapture(captureId: string): Promise<void> {
  const d = await db();
  const capture = await d.get("captures", captureId);
  if (capture?.status === "error") {
    await d.put("captures", { ...capture, status: "pending", error: null, autoRetries: 0 });
    notifyChanged();
  }
}

/** Busy model (503), rate limit (429), server or connection errors: worth another try later. */
const TRANSIENT = /\((429|500|502|503|504)\)|kotası|hız sınırı|bağlanılamadı|high demand|overloaded/i;
const AUTO_RETRIES = 3;

/** Re-queues captures that failed for a temporary reason, a few times at most. Returns how many. */
export async function retryTransientFailures(): Promise<number> {
  const d = await db();
  let count = 0;
  for (const capture of await d.getAllFromIndex("captures", "status", "error")) {
    const tries = capture.autoRetries ?? 0;
    if (!capture.error || !TRANSIENT.test(capture.error) || tries >= AUTO_RETRIES) continue;
    await d.put("captures", { ...capture, status: "pending", error: null, autoRetries: tries + 1 });
    count++;
  }
  if (count) notifyChanged();
  return count;
}
