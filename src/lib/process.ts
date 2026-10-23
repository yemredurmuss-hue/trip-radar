// Capture pipeline: URL facts -> model extraction -> trip assignment -> merge or insert item.
import { addEvent, db, listTrips, newId, nextTime, notifyChanged } from "./db";
import { moveDocsToTrip } from "./docs";
import { today, type Extraction } from "./extract";
import { describeError, getProvider } from "./llm";
import { valueOnPage } from "./evidence";
import { geocode } from "./geo";
import { L } from "./i18n";
import { imageProxy, pickCityImage } from "./cityImages";
import { buildItem, CATEGORY_LABELS, corpusOf, findDuplicate, formatDateRange, isoDate, mergeItem, moreFlights } from "./items";
import { chooseTrip, countryCodeOf, countryName, gapDays, isDemoTrip, profileTrips, uniqueTitle, type TripChoice, type TripSignal } from "./trips";
import { askText, countriesText, datesIn, looksLikeTravel, placeCodes, placeFitOf, routeCapture, titleCodes, tripPlaceCodes, type Route } from "./placeCheck";
import { loadHome } from "./passport";
import { homeFromFlights } from "./suggestions";
import type { PageSnapshot } from "./pagecapture";
import type { Capture, Geo, HeldCapture, Item, Trip } from "./types";
import { parseUrl, type UrlFacts } from "./url";
import { loadRules, rememberTrip, ruleFor, type TripRule } from "./tripRules";

export type Extractor = (capture: Capture, facts: UrlFacts, trips: Trip[]) => Promise<Extraction>;

/** External calls, injectable so the pipeline can be tested offline. */
export interface Deps {
  extract: Extractor;
  heroImage: (place: string | null) => Promise<string | null>;
  /** Place name → coordinates (defaults to cached OpenStreetMap lookup). */
  geocode?: (query: string) => Promise<Geo | null>;
  /** Cuts the option's photo out of a screenshot (defaults to an offscreen canvas where there is one). */
  crop?: (dataUrl: string, box: Box) => Promise<string | null>;
  /** The traveller's home country when set (Settings → Pasaport): always a trip's own (placeCheck.ts). */
  home?: () => Promise<string | null>;
  /** Hangi gezi (tripRules.ts): the trips remembered per country; null where there is no storage (nothing asked then). */
  rules?: () => Promise<TripRule[] | null>;
}

const defaultDeps: Deps = {
  // The traveller watches its waiting card: first in the model's line (llm/queue.ts "now"), so its deadline is spent reading.
  extract: async (capture, facts, trips) => (await getProvider({ priority: "now" })).extract(capture, facts, trips),
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

/**
 * `bind` (benle gezen eklenti): saved from a page the plan knows (a candidate's tab, a search for a planned flight): it goes
 * into that trip and that need's deck.
 */
export async function saveSnapshot(snapshot: PageSnapshot, screenshot: string | null, bind: { forTripId?: string; forNeed?: string; idea?: boolean } = {}): Promise<Capture> {
  const capture: Capture = { ...baseCapture("extension"), ...snapshot, screenshot, ...(bind.forTripId ? { forTripId: bind.forTripId } : {}), ...(bind.forNeed ? { forNeed: bind.forNeed } : {}), ...(bind.idea ? { idea: true } : {}) };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

/**
 * `forTripId`: handed to one trip's board, it goes into that trip (as a shared trip's capture does), unless its
 * place is far from that trip's (placeCheck.ts). `fromTripId`: sent in that trip's chat (routed as any capture,
 * checked against that trip).
 */
export async function savePastedLink(url: string, forTripId?: string, fromTripId?: string, note?: string | null, forNeed?: string): Promise<Capture> {
  const capture: Capture = {
    ...baseCapture("paste-link"),
    url,
    ...(forTripId ? { forTripId } : {}),
    ...(fromTripId && !forTripId ? { fromTripId } : {}),
    ...(note?.trim() ? { note: note.trim().slice(0, 300) } : {}),
    ...(forNeed ? { forNeed } : {}),
  };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

export async function saveImage(dataUrl: string, forTripId?: string, fromTripId?: string, forNeed?: string): Promise<Capture> {
  const capture: Capture = { ...baseCapture("image"), screenshot: dataUrl, ...(forTripId ? { forTripId } : {}), ...(fromTripId && !forTripId ? { fromTripId } : {}), ...(forNeed ? { forNeed } : {}) };
  await (await db()).put("captures", capture);
  notifyChanged();
  return capture;
}

// --- processing -------------------------------------------------------------------------------

/**
 * F35 (2026-10-20: a save sat on "Plana yerleşiyor…" for 5+ minutes, no error, no retry): a capture's reading has a hard
 * deadline. The slowest reading that still ends well: its turn in the model's line (it goes first, "now": behind at most
 * the two calls already running), one Gemini answer of up to ~40 s, a busy model's 20 s wait and its second try (another
 * ~40 s), the chain's daily-quota hops (a 429 comes back at once, no wait) or the Claude backup instead (~10–40 s), then the
 * place lookups (10 s each at most, mostly cached) and, for a new trip, its photo. About 100 s at worst: 2 minutes.
 */
export const CAPTURE_DEADLINE_MS = 120_000;
/** Still "processing" this long after its reading began: nothing is behind it any more (sweepStuck). */
export const STUCK_AFTER_MS = CAPTURE_DEADLINE_MS + 30_000;
/** "Bu kayıt 2 dakikada bitmedi. 'Tekrar dene'ye bas.": the card's own Tekrar dene does the rest. */
export const timeoutMessage = (): string => {
  const minutes = Math.round(CAPTURE_DEADLINE_MS / 60_000);
  return L(`Bu kayıt ${minutes} dakikada bitmedi. 'Tekrar dene'ye bas.`, `This save didn't finish within ${minutes} minutes. Press 'Try again'.`);
};

/**
 * Reads one capture and puts it in the plan, or says why not. The reading and the deadline race for the capture: whichever
 * comes first owns it, the reading at its first write (commit), the deadline when it fires; the other writes nothing. So an
 * answer that arrives after the deadline is dropped (the capture stays "error" with Tekrar dene, never flips back to done),
 * and a reading that has begun writing finishes before the next capture starts.
 */
export async function processCapture(captureId: string, deps: Deps = defaultDeps, deadlineMs: number = CAPTURE_DEADLINE_MS): Promise<void> {
  const d = await db();
  const found = await d.get("captures", captureId);
  if (!found || found.status === "done" || found.status === "processing") return;
  // startedAt: this attempt's mark (a retry is another attempt; sweepStuck reads it).
  const capture: Capture = { ...found, status: "processing", error: null, startedAt: Date.now() };
  await d.put("captures", capture);
  notifyChanged();

  let owner: "reading" | "deadline" | null = null;
  const claim = (who: "reading" | "deadline") => (owner ??= who) === who;
  // The reading may write: it owns the attempt, and the capture is still this attempt's (not swept, not retried meanwhile).
  const commit = async () => {
    if (!claim("reading")) return false;
    const now = await d.get("captures", captureId);
    return now?.status === "processing" && now.startedAt === capture.startedAt;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"deadline">((resolve) => (timer = setTimeout(() => resolve("deadline"), deadlineMs)));
  const reading = readCapture(capture, deps, commit).then(() => "reading" as const);
  const first = await Promise.race([reading, deadline]);
  clearTimeout(timer);
  if (first === "deadline" && claim("deadline")) {
    const now = await d.get("captures", captureId);
    if (now?.status === "processing" && now.startedAt === capture.startedAt) await d.put("captures", { ...now, status: "error", error: timeoutMessage() });
  } else await reading;
  notifyChanged();
}

async function readCapture(capture: Capture, deps: Deps, commit: () => Promise<boolean>): Promise<void> {
  const d = await db();
  try {
    const facts = parseUrl(capture.url ?? "");
    const trips = await listTrips();
    const extraction = await deps.extract(capture, facts, trips);
    // A capture from a shared trip goes into that trip, wherever its country or dates would send it.
    const forced = capture.forTripId ? trips.find((t) => t.id === capture.forTripId) : undefined;
    // Where it was handed over (a trip's board or chat): what the place check measures it against.
    const anchor = forced ?? (capture.fromTripId ? trips.find((t) => t.id === capture.fromTripId) : undefined);
    const allItems = await d.getAll("items");
    const signal = tripSignal(extraction, facts);
    // Home: the passport set in Settings, else where the trips' first flights leave from (suggestions.ts, review B).
    const real = new Set(trips.filter((t) => !isDemoTrip(t)).map((t) => t.id));
    const home = (await (deps.home ?? loadHome)()) ?? homeFromFlights(allItems.filter((i) => real.has(i.tripId)));
    let choice: TripChoice = forced ? { tripId: forced.id } : chooseTrip(signal, profileTrips(trips, allItems));
    // Sent in a trip's chat and its place is that trip's own (the way there from home: the İstanbul airport hotel of
    // the Porto trip), or a country it already has a stay in (the Kenya of an Egypt + Kenya trip), on its dates or
    // none: it stays there, not in another trip of that country.
    if (anchor && !forced && !("tripId" in choice && choice.tripId === anchor.id)) {
      const probe = buildItem(extraction, capture, facts, anchor.id);
      const range = profileTrips([anchor], allItems)[0]?.range;
      const onDates = !probe.dates.start || !range || gapDays(range, probe.dates.start, probe.dates.end) <= 7;
      const codes = placeCodes(probe);
      const staysThere = allItems.some((i) => i.tripId === anchor.id && i.category === "stay" && i.status !== "dismissed" && codes.includes(countryCodeOf(i.countryCode) ?? ""));
      if (onDates && (staysThere || placeFitOf(probe, anchor.id, trips, allItems, home) === "in")) choice = { tripId: anchor.id };
    }
    // A new trip is only made once something goes into it (a page that is asked about makes none).
    const newTripId = "tripId" in choice ? null : newId();
    let incoming = buildItem(extraction, capture, facts, "tripId" in choice ? choice.tripId : newTripId!);
    // (brought to one row of the plan: that need's option, as an offer added from its box is: plan.flightNeeds)
    if (capture.forNeed && !incoming.forNeed && incoming.category === capture.forNeed.split(":")[0]) incoming = { ...incoming, forNeed: capture.forNeed };
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
    // A page's own date (a date picker's remembered day) put in a trip by its place: only if it falls in that
    // trip's dates, so it never stretches the Bali trip to the Porto dates (review #2).
    const pageDates = item.dates; // the moved note keeps them for Geri al
    const landed = trips.find((t) => t.id === item.tripId);
    if (!duplicate && signal.softDates && landed) item = { ...item, dates: datesIn(item, landed, allItems) };
    // Saved from the toolbar with more than one trip it could be and nothing that says which (two India trips, an undated
    // page; 0.39.4): asked under the button (popup) and in Bekleyen kayıtlar, never put in one by a guess. A page saved
    // before (merged) stays where it is; a chat's or a board's capture has its own trip.
    const fromToolbar = !duplicate && !anchor && !capture.sharedAt && capture.kind === "extension";
    let candidates = "tripId" in choice && fromToolbar ? (choice.candidates ?? []) : [];
    // Hangi gezi (0.41.0, tripRules.ts): this country's trip remembered → there, nothing asked; never answered for this
    // country yet → asked once which trip (its trips first), the answer remembered (routing.ts answerHeld).
    let remembered: Trip | null = null;
    const rules = fromToolbar ? await (deps.rules ?? loadRules)() : null;
    if (rules) {
      const codes = placeCodes(item);
      remembered = ruleFor(rules, codes, trips, allItems, item.dates.start, item.dates.end, today());
      if (remembered) {
        item = { ...item, tripId: remembered.id, dates: datesIn(item, remembered, allItems) };
        candidates = [];
      } else if (codes.length) {
        const ownTrips = trips.filter((t) => !isDemoTrip(t));
        const same = ownTrips.filter((t) => codes.some((c) => tripPlaceCodes(t.id, allItems).has(c) || titleCodes(t.title).has(c)));
        const byRecent = (list: Trip[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt).map((t) => t.id);
        const first = "tripId" in choice && ownTrips.some((t) => t.id === choice.tripId) ? [choice.tripId] : [];
        candidates = [...new Set([...first, ...candidates, ...byRecent(same), ...byRecent(ownTrips)])].slice(0, 4);
      }
    }
    const route: Route = capture.sharedAt || remembered
      ? { kind: "keep" }
      : candidates.length > 1 || (rules && candidates.length === 1)
        ? { kind: "ask", reason: "trip", askIn: null, candidates }
        : routeCapture({
          item,
          merged: Boolean(duplicate),
          newTrip: item.tripId === newTripId,
          anchorId: anchor?.id ?? null,
          board: Boolean(forced),
          home,
          travel: Boolean(capture.idea) || looksLikeTravel(extraction),
          trips,
          items: allItems,
        });
    if (route.kind === "ask") {
      if (!(await commit())) return;
      await holdCapture(capture, item, route, extraction, trips, allItems, Boolean(duplicate));
      return;
    }
    const before = duplicate?.item.tripId ?? null;
    // Moved: its dates only when they fall in that trip's (Geri al puts them back from the note).
    if (route.kind === "move") {
      const target = trips.find((t) => t.id === route.toTripId)!;
      item = { ...item, tripId: target.id, dates: datesIn(item, target, allItems) };
    }
    // A new trip's photo is looked up before anything is written: a slow lookup runs into the deadline, never between writes.
    const heroImage = item.tripId === newTripId ? await deps.heroImage(extraction.city ?? extraction.country) : null;
    if (!(await commit())) return; // the deadline came first: this late answer writes nothing
    if (item.tripId === newTripId) {
      const now = Date.now();
      const made: Trip = {
        id: newTripId,
        title: uniqueTitle((choice as { newTitle: string }).newTitle, facts.checkIn ?? isoDate(extraction.dates.start), trips),
        confirmedDates: null,
        budget: null,
        heroImage,
        createdAt: now,
        updatedAt: now,
      };
      await d.put("trips", made);
      // (nothing to choose from: the country's first trip, remembered as its own)
      if (rules) await rememberTrip(placeCodes(item)[0], made.id);
    }
    // Who saved it (v11 Pano's faces): a link a fellow traveller shared is theirs; the board's own owner otherwise (absent).
    if (!duplicate && capture.sharedBy) item = { ...item, addedBy: capture.sharedBy };
    await d.put("items", item);
    if (before && before !== item.tripId) await moveDocsToTrip(item.id, item.tripId);
    // (Karar Masası: a flight search's list saved, its other flights in view join the same need's deck; none twice)
    const more: Item[] = [];
    for (const m of moreFlights(extraction, item)) if (!findDuplicate([...existing, item, ...more], m)) more.push(m);
    for (const m of more) await d.put("items", m);

    await addEvent(item.tripId, savedLine(item, incoming.status === "booked", Boolean(duplicate), capture.sharedBy));
    if (more.length) await addEvent(item.tripId, L(`Aynı listeden ${more.length} uçuş daha desteye girdi.`, `${more.length} more flight${more.length > 1 ? "s" : ""} from the same list joined the deck.`));
    // The same thing saved again (Emre, 0.36.55): merged as always, and asked whether to keep it apart instead. Not a
    // booking's confirmation (it books what was saved), nor what a shared trip sends.
    if (duplicate && incoming.status !== "booked" && !capture.sharedAt) {
      const when = duplicate.item.dates.start ? ` (${formatDateRange(duplicate.item.dates.start, duplicate.item.dates.end)})` : "";
      await addEvent(
        item.tripId,
        L(`${duplicate.item.name}${when} bu gezide zaten kayıtlıydı; bu kaydı onunla birleştirdim. Ayrı mı tutayım?`, `${duplicate.item.name}${when} was already saved in this trip; I merged this save into it. Keep them apart?`),
        { routing: { kind: "duplicate", itemId: item.id, before: duplicate.item, separate: { ...incoming, id: newId(), tripId: item.tripId, dates: duplicate.placeOnly ? item.dates : incoming.dates } } },
      );
    }
    // Handed to one trip, gone to another (the trip of its place): the trip it was handed to says where, with
    // Aç · Geri al. So does the trip a record left when its place turned out to be another's (a later save).
    const noteIn = anchor && anchor.id !== item.tripId ? anchor.id : before && before !== item.tripId ? before : null;
    if (noteIn) {
      const to = (await d.get("trips", item.tripId))?.title ?? "";
      const far = placeFitOf(item, noteIn, trips, allItems, home) === "far";
      await addEvent(noteIn, movedLine(item, to), {
        routing: { kind: "moved", itemId: item.id, fromTripId: noteIn, toTripId: item.tripId, far, merged: Boolean(duplicate) && before === item.tripId, dates: pageDates },
      });
    }
    // The trip as stored now: it may have changed (shared, renamed) while the model was reading.
    const current = await d.get("trips", item.tripId);
    if (current) await d.put("trips", { ...current, heroImage: current.heroImage ?? item.imageUrl, updatedAt: Date.now() });
    await d.put("captures", { ...capture, status: "done", error: null, itemId: item.id });
  } catch (error) {
    if (await commit()) await d.put("captures", { ...capture, status: "error", error: describeError(error) });
  }
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
    today: today(),
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
  const toTripId = route.toTripId ?? null;
  const held: HeldCapture = {
    reason: route.reason,
    item: existed ? item : { ...item, tripId: route.askIn ?? item.tripId },
    tripId: route.askIn,
    newTitle,
    question,
    askedAt: Date.now(),
    ...(existed ? { existing: true } : {}),
    ...(toTripId ? { toTripId } : {}),
    ...(route.candidates?.length ? { candidates: route.candidates } : {}),
  };
  // A record already saved stays as it is (with what this save updated) until the traveller answers: never
  // removed behind their back. "Ekleme" puts it in the trash (routing.ts).
  if (existed) await d.put("items", item);
  await d.put("captures", { ...capture, status: "done", error: null, itemId: existed ? item.id : null, held });
  // No trip to ask in (no trip at all): the home's "Bekleyen kayıtlar" asks (messages of no trip, tripId "").
  await addEvent(route.askIn ?? "", question, {
    routing: { kind: "ask", captureId: capture.id, reason: route.reason, newTitle, ...(toTripId ? { toTripId } : {}), ...(route.candidates?.length ? { candidates: route.candidates } : {}) },
  });
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
  // Asked for (a save, Tekrar dene, the board opening): what is stuck past its deadline says so first (F35).
  const swept = sweepStuck().catch(() => 0);
  running ??= (async () => {
    try {
      await swept;
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

/**
 * F35: a capture still "processing" well past its deadline has nothing behind it (the request died without a word, the
 * deadline never fired) and goes to "error" with Tekrar dene, while the worker lives on. Run whenever processing is asked
 * for, which the board does as it opens (main.tsx). A fresh worker's recoverStuck comes first and queues them again instead.
 */
export async function sweepStuck(now: number = Date.now()): Promise<number> {
  const tx = (await db()).transaction("captures", "readwrite");
  let count = 0;
  for (const capture of await tx.store.index("status").getAll("processing")) {
    if (now - (capture.startedAt ?? capture.capturedAt) < STUCK_AFTER_MS) continue;
    await tx.store.put({ ...capture, status: "error", error: timeoutMessage() });
    count++;
  }
  await tx.done;
  if (count) notifyChanged();
  return count;
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

/** Busy model (503), rate limit (429), server or connection errors: worth another try later. Matched on the message in
 * either language (the board may be in English: "Couldn't reach…" was never retried before 2026-10-11). */
const TRANSIENT = /\((429|500|502|503|504)\)|kotası|hız sınırı|meşgul|geçici bir sorun|bağlanılamadı|high demand|overloaded|quota|rate limit|is busy|temporary problem|couldn't reach/i;
/** The request never got out (no internet): the board may try again within seconds, and again as the connection comes back. */
const CONNECTION = /bağlanılamadı|couldn't reach/i;
export const isTransient = (message: string | null | undefined) => !!message && TRANSIENT.test(message);
export const isConnectionError = (message: string | null | undefined) => !!message && CONNECTION.test(message);
const AUTO_RETRIES = 3;

/** Re-queues captures that failed for a temporary reason, a few times at most. Returns how many. */
export async function retryTransientFailures(): Promise<number> {
  const d = await db();
  let count = 0;
  for (const capture of await d.getAllFromIndex("captures", "status", "error")) {
    const tries = capture.autoRetries ?? 0;
    if (!isTransient(capture.error) || tries >= AUTO_RETRIES) continue;
    await d.put("captures", { ...capture, status: "pending", error: null, autoRetries: tries + 1 });
    count++;
  }
  if (count) notifyChanged();
  return count;
}

/** Re-queues the captures that failed because the request never got out (no internet), however often: the board's
 * "İnternet yok · N sn sonra tekrar deniyorum" and the connection coming back. Returns how many. */
export async function retryConnectionFailures(): Promise<number> {
  const d = await db();
  let count = 0;
  for (const capture of await d.getAllFromIndex("captures", "status", "error")) {
    if (!isConnectionError(capture.error)) continue;
    await d.put("captures", { ...capture, status: "pending", error: null });
    count++;
  }
  if (count) notifyChanged();
  return count;
}
