import "fake-indexeddb/auto";
// F35 (2026-10-20): after "Tekrar dene" a save sat on "Plana yerleşiyor…" for 5+ minutes with no error and no way on. Each
// reading now has a hard deadline: past it the capture is "error" with Tekrar dene; a capture left "processing" with nothing
// behind it is swept to "error" the next time processing is asked for; an answer that arrives after the deadline writes
// nothing (no second card, no error flipping back to done). Fake timers; the model is a promise the test settles by hand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { CAPTURE_DEADLINE_MS, processPending, retryCapture, savePastedLink, STUCK_AFTER_MS, sweepStuck, timeoutMessage, type Deps } from "../src/lib/process";
import type { Capture } from "../src/lib/types";

const base: Extraction = {
  category: "stay",
  name: "Jardim Stay",
  provider: "Booking.com",
  summary: "",
  option_detail: null,
  city: "Porto",
  country: "Portekiz",
  country_code: "PT",
  location: { address: null, area: null, approximate: false },
  dates: { start: null, end: null, source: "none" },
  guests: { adults: null, children: null, rooms: null },
  price: { amount: 285, currency: "EUR", scope: "total", taxes_included: "yes", source: "page", evidence: "€ 285" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null,
  metrics: null,
  highlights: [],
  concerns: [],
  review_summary: null,
  image_url: null,
  missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Portekiz" },
  need_key: "stay:porto",
};

/** A model call the test answers (or fails) by hand, whenever it likes. */
function deferred() {
  let resolve!: (e: Extraction) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Extraction>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

/** IndexedDB (fake-indexeddb) moves on setImmediate, which the fake timers leave real: wait on it until `check` holds. */
async function until(check: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (await check()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error("never settled");
}
const settle = async (rounds = 50) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
};
const captureOf = async (id: string) => (await (await db()).get("captures", id))!;

async function clean() {
  const d = await db();
  for (const store of ["captures", "items", "trips", "messages"] as const) await d.clear(store);
}

beforeEach(async () => {
  await clean();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(Date.parse("2026-10-20T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("a capture's deadline", () => {
  it("a reading that never ends: error with Tekrar dene at the deadline, not a minute later", async () => {
    const model = deferred();
    const deps: Deps = { extract: () => model.promise, heroImage: async () => null, geocode: async () => null };
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    const run = processPending(deps);
    await until(async () => (await captureOf(c.id)).status === "processing");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS - 1000);
    expect((await captureOf(c.id)).status).toBe("processing");
    await vi.advanceTimersByTimeAsync(1000);
    await run;
    expect(await captureOf(c.id)).toMatchObject({ status: "error", error: timeoutMessage() });
    expect(timeoutMessage()).toBe("Bu kayıt 2 dakikada bitmedi. 'Tekrar dene'ye bas.");
  });

  it("an answer after the deadline writes nothing: no card, no trip, the error stays", async () => {
    const model = deferred();
    const deps: Deps = { extract: () => model.promise, heroImage: async () => null, geocode: async () => null };
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    const run = processPending(deps);
    await until(async () => (await captureOf(c.id)).status === "processing");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS);
    await run;
    model.resolve(base); // the late answer
    await settle();
    const d = await db();
    expect(await d.getAll("items")).toEqual([]);
    expect(await listTrips()).toEqual([]);
    expect(await d.getAll("messages")).toEqual([]);
    expect(await captureOf(c.id)).toMatchObject({ status: "error", error: timeoutMessage(), itemId: null });
  });

  it("a failure after the deadline doesn't overwrite it either", async () => {
    const model = deferred();
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    const run = processPending({ extract: () => model.promise, heroImage: async () => null, geocode: async () => null });
    await until(async () => (await captureOf(c.id)).status === "processing");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS);
    await run;
    model.reject(new Error("Gemini hatası (500)"));
    await settle();
    expect((await captureOf(c.id)).error).toBe(timeoutMessage());
  });

  it("Tekrar dene after a timeout: the new reading lands once, the old one's late answer is dropped", async () => {
    const calls = [deferred(), deferred()];
    let n = 0;
    const deps: Deps = { extract: () => calls[n++].promise, heroImage: async () => null, geocode: async () => null };
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    const first = processPending(deps);
    await until(async () => (await captureOf(c.id)).status === "processing");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS);
    await first;
    await retryCapture(c.id);
    const second = processPending(deps);
    await until(async () => n === 2);
    calls[0].resolve({ ...base, name: "Old answer" }); // the first attempt's answer, very late, while the second reads
    await settle();
    expect((await captureOf(c.id)).status).toBe("processing");
    calls[1].resolve(base);
    await second;
    const items = await (await db()).getAll("items");
    expect(items.map((i) => i.name)).toEqual(["Jardim Stay"]);
    expect(await captureOf(c.id)).toMatchObject({ status: "done", error: null, itemId: items[0].id });
    // Its deadline is over for good: time passing changes nothing.
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS * 2);
    expect((await captureOf(c.id)).status).toBe("done");
  });

  it("a reading in time is untouched by its deadline", async () => {
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    await processPending({ extract: async () => base, heroImage: async () => null, geocode: async () => null });
    expect((await captureOf(c.id)).status).toBe("done");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS + 1000);
    expect((await captureOf(c.id)).status).toBe("done");
    expect(await (await db()).getAll("items")).toHaveLength(1);
  });

  it("a new trip's photo that never comes is inside the deadline too, and nothing is half-written", async () => {
    const c = await savePastedLink("https://www.booking.com/hotel/pt/jardim.html");
    const run = processPending({ extract: async () => base, heroImage: () => new Promise(() => undefined), geocode: async () => null });
    await until(async () => (await captureOf(c.id)).status === "processing");
    await vi.advanceTimersByTimeAsync(CAPTURE_DEADLINE_MS);
    await run;
    expect((await captureOf(c.id)).error).toBe(timeoutMessage());
    expect(await listTrips()).toEqual([]);
    expect(await (await db()).getAll("items")).toEqual([]);
  });
});

describe("the sweep (worker alive, nothing behind a 'processing' capture)", () => {
  const stuck = (id: string, startedAt: number | undefined, capturedAt = Date.now() - 3_600_000): Capture => ({
    id, kind: "paste-link", url: "https://example.com", title: id, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {},
    screenshot: null, capturedAt, status: "processing", error: null, itemId: null, ...(startedAt != null ? { startedAt } : {}),
  });

  it("past its deadline and margin: error with Tekrar dene; a reading still in its time is left alone", async () => {
    const d = await db();
    const now = Date.now();
    await d.put("captures", stuck("dead", now - STUCK_AFTER_MS - 1));
    await d.put("captures", stuck("live", now - 5_000));
    await d.put("captures", stuck("old", undefined)); // from before startedAt: its capture time counts
    expect(await sweepStuck(now)).toBe(2);
    expect(await captureOf("dead")).toMatchObject({ status: "error", error: timeoutMessage() });
    expect(await captureOf("old")).toMatchObject({ status: "error", error: timeoutMessage() });
    expect((await captureOf("live")).status).toBe("processing");
  });

  it("asking for processing sweeps (the board asks as it opens), and the swept capture can be tried again", async () => {
    const d = await db();
    await d.put("captures", stuck("dead", Date.now() - STUCK_AFTER_MS - 1));
    await processPending({ extract: async () => base, heroImage: async () => null, geocode: async () => null });
    expect((await captureOf("dead")).status).toBe("error");
    await retryCapture("dead");
    await processPending({ extract: async () => base, heroImage: async () => null, geocode: async () => null });
    expect((await captureOf("dead")).status).toBe("done");
  });
});
