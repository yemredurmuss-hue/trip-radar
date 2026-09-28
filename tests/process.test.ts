import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
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
      "✓ Casa Azul kaydedildi → Konaklama · Porto",
    ]);
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
});
