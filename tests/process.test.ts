import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import { answerDuplicate } from "../src/lib/routing";
import type { Extraction } from "../src/lib/extract";
import {
  processPending,
  retryCapture,
  retryTransientFailures,
  saveImage,
  savePastedLink,
  saveSnapshot,
  type Deps,
  type Extractor,
} from "../src/lib/process";

const base: Extraction = {
  category: "stay",
  name: "Jardim Stay",
  provider: "Booking.com",
  summary: "Ribeira'ya 10 dk",
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

const snapshot = (url: string, text: string) => ({
  url,
  title: "t",
  pageText: text,
  viewportText: "",
  selection: "",
  jsonLd: [],
  meta: {},
  coords: [],
});

describe("capture pipeline", () => {
  it("creates a trip, merges re-captures, and reuses the trip for new items", async () => {
    const seen: string[][] = [];
    const extractor: Extractor = async (capture, _facts, trips) => {
      seen.push(trips.map((t) => t.title));
      const trip = { existing_trip_id: trips[0]?.id ?? null, new_trip_title: trips[0] ? null : "Portekiz" };
      if (capture.kind === "image") return { ...base, name: "Casa Azul", price: { ...base.price, amount: 240, source: "screenshot", evidence: null }, trip };
      if (capture.pageText.includes("270")) return { ...base, price: { ...base.price, amount: 270, evidence: "€ 270" }, trip };
      return { ...base, trip };
    };

    const deps: Deps = { extract: extractor, heroImage: async () => null, geocode: async () => null };
    const url = "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-08&checkout=2026-10-11";
    await saveSnapshot(snapshot(url, "Jardim Stay € 285"), null);
    await processPending(deps);
    await saveSnapshot(snapshot(url, "Jardim Stay € 270"), null);
    await saveImage("data:image/jpeg;base64,AAAA");
    await processPending(deps);

    const trips = await listTrips();
    expect(trips.map((t) => t.title)).toEqual(["Portekiz"]);
    expect(seen).toEqual([[], ["Portekiz"], ["Portekiz"]]);

    const items = await listItems(trips[0].id);
    expect(items.map((i) => i.name).sort()).toEqual(["Casa Azul", "Jardim Stay"]);
    const jardim = items.find((i) => i.name === "Jardim Stay")!;
    expect(jardim.price.amount).toBe(270);
    expect(jardim.priceHistory.map((p) => p.amount)).toEqual([285, 270]);
    expect(jardim.dates).toEqual({ start: "2026-10-08", end: "2026-10-11", source: "url" });
    expect(items.find((i) => i.name === "Casa Azul")!.price.source).toBe("screenshot");

    const events = (await listMessages(trips[0].id)).map((m) => m.text);
    expect(events).toEqual([
      "✓ Jardim Stay kaydedildi → Konaklama · Porto",
      "↻ Jardim Stay güncellendi",
      // Saved twice (0.36.55): merged, and asked whether to keep them apart instead.
      "Jardim Stay (8–11 Ekim) bu gezide zaten kayıtlıydı; bu kaydı onunla birleştirdim. Ayrı mı tutayım?",
      "✓ Casa Azul kaydedildi → Konaklama · Porto",
    ]);

    // "Ayrı tut": the one saved goes back to what it was (€285), this save stands beside it (€270).
    const ask = (await listMessages(trips[0].id)).find((m) => m.routing?.kind === "duplicate")!;
    await answerDuplicate(ask.id, "separate");
    const apart = (await listItems(trips[0].id)).filter((i) => i.name === "Jardim Stay");
    expect(apart.map((i) => i.price.amount).sort()).toEqual([270, 285]);
    expect((await listMessages(trips[0].id)).find((m) => m.id === ask.id)!.routing).toMatchObject({ kind: "duplicate", answer: "separate" });
    // Answered once: a second tap changes nothing.
    await answerDuplicate(ask.id, "separate");
    expect((await listItems(trips[0].id)).filter((i) => i.name === "Jardim Stay")).toHaveLength(2);
  });

  it("a booking's confirmation of what was saved isn't asked about: it books it", async () => {
    const d = await db();
    for (const store of ["items", "messages", "trips", "captures"] as const) await d.clear(store);
    const extractor: Extractor = async (capture, _facts, trips) => {
      const trip = { existing_trip_id: trips[0]?.id ?? null, new_trip_title: trips[0] ? null : "Portekiz" };
      return capture.pageText.includes("Onaylandı") ? { ...base, booked: true, booking_reference: "4031.552.187", booking_quote: "Rezervasyonunuz onaylandı", trip } : { ...base, trip };
    };
    const deps: Deps = { extract: extractor, heroImage: async () => null, geocode: async () => null };
    const url = "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-08&checkout=2026-10-11";
    await saveSnapshot(snapshot(url, "Jardim Stay € 285"), null);
    await processPending(deps);
    await saveSnapshot(snapshot(url, "Jardim Stay Onaylandı"), null);
    await processPending(deps);
    const trip = (await listTrips())[0];
    expect((await listItems(trip.id)).map((i) => i.status)).toEqual(["booked"]);
    expect((await listMessages(trip.id)).some((m) => m.routing?.kind === "duplicate")).toBe(false);
  });

  it("records a readable error and leaves the capture retryable", async () => {
    const capture = await savePastedLink("https://example.com/x");
    await processPending({
      extract: async () => {
        throw new Error("API anahtarı yok.");
      },
      heroImage: async () => null,
      geocode: async () => null,
    });
    const stored = await (await db()).get("captures", capture.id);
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe("API anahtarı yok.");
  });

  it("re-queues busy/rate-limit failures by itself, a few times, but not real errors", async () => {
    const d = await db();
    const failed = (id: string, error: string, autoRetries?: number) => ({
      id, kind: "paste-link" as const, url: null, title: id, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {},
      screenshot: null, capturedAt: 1, status: "error" as const, error, itemId: null, autoRetries,
    });
    await d.put("captures", failed("busy", 'Gemini hatası (503): {"message":"This model is currently experiencing high demand."}'));
    await d.put("captures", failed("badkey", "Gemini API anahtarı geçersiz. Ayarlardan kontrol et."));
    await d.put("captures", failed("tired", "Gemini hatası (503): high demand", 3));
    expect(await retryTransientFailures()).toBe(1);
    expect((await d.get("captures", "busy"))!).toMatchObject({ status: "pending", autoRetries: 1 });
    expect((await d.get("captures", "badkey"))!.status).toBe("error");
    expect((await d.get("captures", "tired"))!.status).toBe("error"); // gave up after 3 tries...
    await retryCapture("tired"); // ...until the user asks again
    expect((await d.get("captures", "tired"))!).toMatchObject({ status: "pending", autoRetries: 0 });
    for (const id of ["busy", "badkey", "tired"]) await d.delete("captures", id);
  });
  it("cuts the option's photo out of a screenshot (a rented car), and trusts a web address only from a page", async () => {
    const d = await db();
    for (const c of await d.getAll("captures")) await d.delete("captures", c.id);
    const cropped: [string, number[]][] = [];
    const extractor: Extractor = async (capture) =>
      capture.kind === "image"
        ? { ...base, category: "transport", name: "Hyundai Bayon", need_key: "transport:car-funchal", image_url: "https://made.up/car.jpg", image_box: [300, 50, 600, 400] }
        : { ...base, name: "Casa Verde", image_url: "https://cdn.example/room.jpg" };
    const deps: Deps = {
      extract: extractor,
      heroImage: async () => null,
      geocode: async () => null,
      crop: async (dataUrl, box) => (cropped.push([dataUrl, box]), "data:image/jpeg;base64,CAR"),
    };
    await saveImage("data:image/jpeg;base64,SHOT");
    await saveSnapshot(snapshot("https://www.booking.com/hotel/pt/casa-verde.html", "Casa Verde"), null);
    await processPending(deps);
    const items = await d.getAll("items");
    // A screenshot has no web address to give: the model's box is cut out of it instead.
    expect(items.find((i) => i.name === "Hyundai Bayon")!.imageUrl).toBe("data:image/jpeg;base64,CAR");
    expect(cropped).toEqual([["data:image/jpeg;base64,SHOT", [300, 50, 600, 400]]]);
    expect(items.find((i) => i.name === "Casa Verde")!.imageUrl).toBe("https://cdn.example/room.jpg");
  });

  it("takes a box only when it could be a photo", async () => {
    const { photoBox } = await import("../src/lib/process");
    expect(photoBox([300, 50, 600, 400])).toEqual([300, 50, 600, 400]);
    expect(photoBox([0, 0, 1000, 1000])).toBeNull(); // the whole screenshot
    expect(photoBox([100, 100, 120, 500])).toBeNull(); // a sliver
    expect(photoBox([100, 100, 200])).toBeNull();
    expect(photoBox(null)).toBeNull();
  });
});

describe("the queue under repeated triggers", () => {
  it("reads each capture once when processing is asked for twice at the same time", async () => {
    const calls: string[] = [];
    const deps: Deps = {
      extract: async (capture) => {
        calls.push(capture.id);
        await new Promise((resolve) => setTimeout(resolve, 20)); // a slow model: the second trigger lands mid-read
        return { ...base, name: `Once ${capture.id}` };
      },
      heroImage: async () => null,
      geocode: async () => null,
    };
    const a = await savePastedLink("https://www.airbnb.com/rooms/9001");
    const b = await savePastedLink("https://www.airbnb.com/rooms/9002");
    await Promise.all([processPending(deps), processPending(deps), processPending(deps)]);
    expect(calls).toEqual([a.id, b.id]);
    const events = (await (await db()).getAll("messages")).map((m) => m.text).filter((t) => t.includes("Once "));
    expect(events.filter((t) => t.startsWith("✓"))).toHaveLength(2);
    expect(events.filter((t) => t.startsWith("↻"))).toEqual([]);
  });
});
