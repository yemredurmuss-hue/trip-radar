// Capture pipeline: URL facts -> model extraction -> trip assignment -> merge or insert item.
import { addEvent, db, listTrips, newId, notifyChanged } from "./db";
import type { Extraction } from "./extract";
import { describeError, getProvider } from "./llm";
import { buildItem, CATEGORY_LABELS, findDuplicate, isoDate, mergeItem } from "./items";
import { chooseTrip, profileTrips } from "./trips";
import type { PageSnapshot } from "./pagecapture";
import type { Capture, Trip } from "./types";
import { parseUrl, type UrlFacts } from "./url";

export type Extractor = (capture: Capture, facts: UrlFacts, trips: Trip[]) => Promise<Extraction>;

/** External calls, injectable so the pipeline can be tested offline. */
export interface Deps {
  extract: Extractor;
  heroImage: (place: string | null) => Promise<string | null>;
}

const defaultDeps: Deps = {
  extract: async (capture, facts, trips) => (await getProvider()).extract(capture, facts, trips),
  heroImage: destinationImage,
};

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
    capturedAt: Date.now(),
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
    const trip = await resolveTrip(extraction, trips, deps, facts);
    const incoming = buildItem(extraction, capture, facts, trip.id);

    const existing = await d.getAll("items");
    const duplicate = findDuplicate(existing, incoming);
    const item = duplicate ? mergeItem(duplicate, incoming) : incoming;
    await d.put("items", item);

    const where = [CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
    await addEvent(item.tripId, duplicate ? `↻ ${item.name} güncellendi` : `✓ ${item.name} kaydedildi → ${where}`);
    await d.put("trips", { ...trip, heroImage: trip.heroImage ?? item.imageUrl, updatedAt: Date.now() });
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
    title: choice.newTitle,
    confirmedDates: null,
    budget: null,
    heroImage: await deps.heroImage(extraction.city ?? extraction.country),
    createdAt: now,
    updatedAt: now,
  };
  await (await db()).put("trips", trip);
  return trip;
}

/** Scenic header image from Wikipedia's page summary; silently null when unavailable. */
async function destinationImage(place: string | null): Promise<string | null> {
  if (!place) return null;
  for (const lang of ["tr", "en"]) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(place)}`,
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
    await d.put("captures", { ...capture, status: "pending", error: null });
    notifyChanged();
  }
}
