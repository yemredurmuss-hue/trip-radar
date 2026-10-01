// Capture pipeline: URL facts -> model extraction -> trip assignment -> merge or insert item.
import { addEvent, db, listTrips, newId, nextTime, notifyChanged } from "./db";
import type { Extraction } from "./extract";
import { describeError, getProvider } from "./llm";
import { valueOnPage } from "./evidence";
import { geocode } from "./geo";
import { L, lang } from "./i18n";
import { buildItem, CATEGORY_LABELS, corpusOf, findDuplicate, formatDateRange, isoDate, mergeItem } from "./items";
import { chooseTrip, isDemoTrip, profileTrips, uniqueTitle } from "./trips";
import type { PageSnapshot } from "./pagecapture";
import type { Capture, Geo, Item, Trip } from "./types";
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

export async function savePastedLink(url: string): Promise<Capture> {
  const capture: Capture = { ...baseCapture("paste-link"), url };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

export async function saveImage(dataUrl: string): Promise<Capture> {
  const capture: Capture = { ...baseCapture("image"), screenshot: dataUrl };
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
    const trip = forced ?? (await resolveTrip(extraction, trips, deps, facts));
    let incoming = buildItem(extraction, capture, facts, trip.id);
    // Only a screenshot: the option's photo cut out of it (a car, a room), when the model found one.
    const box = !incoming.imageUrl && capture.screenshot ? photoBox(extraction.image_box) : null;
    if (box) {
      const photo = await (deps.crop ?? cropImage)(capture.screenshot!, box).catch(() => null);
      if (photo) incoming = { ...incoming, imageUrl: photo };
    }

    // ...and only merges with that trip's options (the same hotel may sit in another, private trip).
    const existing = (await d.getAll("items")).filter((i) => !forced || i.tripId === forced.id);
    const duplicate = findDuplicate(existing, incoming);
    const item = duplicate ? mergeItem(duplicate.item, incoming, duplicate.placeOnly) : incoming;
    await d.put("items", await withGeo(item, deps.geocode ?? geocode));

    const where = [CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
    const dates = item.dates.start ? ` · ${formatDateRange(item.dates.start, item.dates.end)}` : "";
    await addEvent(
      item.tripId,
      incoming.status === "booked"
        ? L(
            `✓ ${item.name} rezerve edildi${dates} (onaydan); plan buna göre güncellendi`,
            `✓ ${item.name} booked${dates} (from the confirmation); the plan is updated`,
          )
        : duplicate
          ? L(`↻ ${item.name} güncellendi`, `↻ ${item.name} updated`)
          : L(
              `✓ ${item.name} kaydedildi → ${where}${capture.sharedBy ? ` (${capture.sharedBy} ekledi)` : ""}`,
              `✓ ${item.name} saved → ${where}${capture.sharedBy ? ` (added by ${capture.sharedBy})` : ""}`,
            ),
    );
    // The trip as stored now: it may have changed (shared, renamed) while the model was reading.
    const current = (await d.get("trips", trip.id)) ?? trip;
    await d.put("trips", { ...current, heroImage: current.heroImage ?? item.imageUrl, updatedAt: Date.now() });
    await d.put("captures", { ...capture, status: "done", error: null, itemId: item.id });
  } catch (error) {
    await d.put("captures", { ...capture, status: "error", error: describeError(error) });
  }
  notifyChanged();
}

async function resolveTrip(extraction: Extraction, trips: Trip[], deps: Deps, facts: UrlFacts): Promise<Trip> {
  const choice = chooseTrip(
    {
      countryCode: extraction.country_code,
      country: extraction.country,
      start: facts.checkIn ?? isoDate(extraction.dates.start),
      end: facts.checkOut ?? isoDate(extraction.dates.end),
      suggestedTripId: extraction.trip.existing_trip_id,
      suggestedTitle: extraction.trip.new_trip_title,
    },
    profileTrips(trips, await (await db()).getAll("items")),
  );
  if ("tripId" in choice) return trips.find((t) => t.id === choice.tripId)!;
  const now = Date.now();
  const trip: Trip = {
    id: newId(),
    title: uniqueTitle(choice.newTitle, facts.checkIn ?? isoDate(extraction.dates.start), trips),
    confirmedDates: null,
    budget: null,
    heroImage: await deps.heroImage(extraction.city ?? extraction.country),
    createdAt: now,
    updatedAt: now,
  };
  await (await db()).put("trips", trip);
  return trip;
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

/** Scenic header image from Wikipedia's page summary; silently null when unavailable. */
async function destinationImage(place: string | null): Promise<string | null> {
  if (!place) return null;
  for (const wiki of lang() === "en" ? ["en", "tr"] : ["tr", "en"]) {
    try {
      const res = await fetch(
        `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(place)}`,
      );
      if (!res.ok) continue;
      const body = (await res.json()) as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
      const src = body.originalimage?.source ?? body.thumbnail?.source;
      if (src) return src;
    } catch {
      // offline or blocked: fall back to the item image
    }
  }
  return null;
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
