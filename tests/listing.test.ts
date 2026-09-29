import { describe, expect, it } from "vitest";
import { applyReading, clockTimes, coverageText, evidenceOf, failedReading, isDecisive, needsReading } from "../src/lib/listing";
import type { ReaderOutput } from "../src/lib/reader";
import type { Capture, Item } from "../src/lib/types";

const PAGE = `Casa Azul · Apartment in Porto
Spacious flat with a king-size bed and a fully equipped kitchen. Third floor, no elevator.
Not included: TV
House rules: Check-in from 3:00 PM · Check-out before 11:00 · Self check-in with lockbox
Guest reviews (96)
Maria · September 2026
The bed is huge and very comfortable. There is a great Italian restaurant right next door!
João · August 2026
Construction next door started at 8 every morning, very noisy. Otherwise lovely host.
Anna · March 2024
Building work across the street was loud during the day.
Tom · 2 weeks ago
Great location for the river, the Italian place downstairs is amazing.`;

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: "c1",
    kind: "extension",
    url: "https://www.airbnb.com/rooms/123",
    title: "Casa Azul",
    pageText: PAGE,
    viewportText: "",
    selection: "",
    jsonLd: [],
    meta: {},
    screenshot: null,
    capturedAt: 0,
    status: "done",
    error: null,
    itemId: "i1",
    ...overrides,
  };
}

const item = {
  id: "i1",
  key: "airbnb:123",
  name: "Casa Azul",
  category: "stay",
  status: "saved",
  captureIds: ["c1"],
} as Item;

const reading: ReaderOutput = {
  review_total: 96,
  reviews: [
    // The page says "September 2026", not "Sep 2026": the date can't be checked, so it isn't kept.
    { text: "The bed is huge and very comfortable. There is a great Italian restaurant right next door!", date_text: "Sep 2026", date: "2026-09" },
    { text: "Construction next door started at 8 every morning, very noisy.", date_text: "August 2026", date: "2026-08" },
    { text: "Building work across the street was loud during the day.", date_text: "March 2024", date: "2024-03" },
    { text: "Great location for the river, the Italian place downstairs is amazing.", date_text: "2 weeks ago", date: "2026-09" },
    // Not on the page: must be dropped.
    { text: "Terrible smell in the bathroom, would not stay again.", date_text: "July 2026", date: "2026-07" },
  ],
  findings: [
    {
      text: "Yanında çok iyi bir İtalyan restoranı",
      polarity: "positive",
      topic: "nearby",
      source: "reviews",
      severity: "medium",
      quotes: ["There is a great Italian restaurant right next door", "the Italian place downstairs is amazing"],
    },
    {
      text: "Yan binada inşaat gürültüsü",
      polarity: "negative",
      topic: "condition",
      source: "reviews",
      severity: "high",
      quotes: ["Construction next door started at 8 every morning, very noisy."],
    },
    { text: "Karşıda eski bir inşaat", polarity: "negative", topic: "noise", source: "reviews", severity: "medium", quotes: ["Building work across the street was loud"] },
    { text: "Geniş, rahat yatak", polarity: "positive", topic: "bed", source: "description", severity: "medium", quotes: ["king-size bed"] },
    { text: "TV yok", polarity: "negative", topic: "amenities", source: "amenities", severity: "low", quotes: ["Not included: TV"] },
    { text: "Asansör yok, 3. kat", polarity: "negative", topic: "access", source: "description", severity: "medium", quotes: ["Third floor, no elevator."] },
    { text: "Havuz var", polarity: "positive", topic: "facilities", source: "description", severity: "low", quotes: ["Rooftop pool open all year"] },
  ],
  house: {
    check_in_from: "15:00",
    check_in_until: "23:00", // not written anywhere: dropped
    check_out_until: "11:00",
    self_check_in: true,
    luggage_storage: null,
    airport_shuttle: null,
    quotes: ["Check-in from 3:00 PM · Check-out before 11:00 · Self check-in with lockbox"],
  },
};

const TODAY = "2026-09-29";

describe("reading a page into evidence", () => {
  const listing = applyReading(undefined, item, capture(), reading, TODAY, 1000);

  it("keeps only review excerpts that are on the page, with dates only when the page shows them", () => {
    expect(listing.key).toBe("airbnb:123");
    expect(listing.reviews).toHaveLength(4);
    expect(listing.reviews.some((r) => r.text.includes("smell"))).toBe(false);
    expect(listing.reviews.find((r) => r.text.startsWith("The bed"))?.date).toBeNull();
    expect(listing.reviews.find((r) => r.text.startsWith("Great location"))?.date).toBe("2026-09"); // "2 weeks ago", read against today
    expect(listing.reviews.find((r) => r.text.startsWith("Construction"))?.date).toBe("2026-08");
    expect(listing.reviewTotal).toBe(96);
    expect(listing.dropped).toBe(2); // the invented review and the invented pool quote
  });

  it("keeps check-in/out times only when the quoted page text shows them", () => {
    expect(listing.house).toEqual({
      checkInFrom: "15:00",
      checkInUntil: null,
      checkOutUntil: "11:00",
      selfCheckIn: true,
      luggageStorage: null,
      airportShuttle: null,
      quotes: ["Check-in from 3:00 PM · Check-out before 11:00 · Self check-in with lockbox"],
    });
    const invented = applyReading(undefined, item, capture(), { ...reading, house: { ...reading.house!, quotes: ["Check-in from 1:00 PM"] } }, TODAY, 1000);
    expect(invented.house).toBeNull();
    expect(clockTimes("Check-in 14.30 – 23:00, check-out 11 AM, 12 PM, 12 guests")).toEqual(["14:30", "23:00", "11:00", "12:00"]);
  });

  it("counts the reviews behind a finding from stored review ids, not from the model", () => {
    const italian = listing.findings.find((f) => f.topic === "nearby")!;
    expect(italian.reviewIds).toHaveLength(2);
    expect(italian.verified).toBe(true);
    const bed = listing.findings.find((f) => f.topic === "bed")!;
    expect(bed.reviewIds).toHaveLength(0);
    expect(bed.quotes).toEqual(["king-size bed"]);
    const pool = listing.findings.find((f) => f.topic === "facilities")!;
    expect(pool.verified).toBe(false);
  });

  it("treats a complaint only old reviews make as history, not evidence", () => {
    const old = listing.findings.find((f) => f.topic === "noise")!;
    expect(evidenceOf(old, listing, TODAY)).toMatchObject({ count: 1, newest: "2024-03", stale: true });
    expect(isDecisive(old, listing, TODAY)).toBe(false);
    const construction = listing.findings.find((f) => f.topic === "condition")!;
    expect(isDecisive(construction, listing, TODAY)).toBe(true);
    expect(isDecisive(listing.findings.find((f) => f.topic === "facilities")!, listing, TODAY)).toBe(false);
  });

  it("says how much was read", () => {
    expect(coverageText(listing)).toBe("4 yorum incelendi (sitede 96) · Mar 2024 – Eyl 2026");
  });

  it("grows the evidence with each save and keeps earlier findings on other topics", () => {
    const next = applyReading(
      listing,
      item,
      capture({ id: "c2", pageText: `${PAGE}\nLena · September 2026\nThe walls are thin, we heard the neighbours.` }),
      {
        review_total: 97,
        reviews: [
          { text: "The walls are thin, we heard the neighbours.", date_text: "September 2026", date: "2026-09" },
          { text: "Construction next door started at 8 every morning, very noisy.", date_text: "August 2026", date: "2026-08" },
        ],
        findings: [{ text: "İnce duvarlar", polarity: "negative", topic: "noise", source: "reviews", severity: "medium", quotes: ["The walls are thin"] }],
        house: null,
      },
      TODAY,
      2000,
    );
    expect(next.reviews).toHaveLength(5); // one new, one already known
    expect(next.readCaptureIds).toEqual(["c1", "c2"]);
    expect(next.findings[0].text).toBe("İnce duvarlar");
    expect(next.findings.some((f) => f.topic === "condition")).toBe(true);
    // The old noise finding is replaced by the new reading on that topic.
    expect(next.findings.filter((f) => f.topic === "noise")).toHaveLength(1);
  });
});

describe("when to read", () => {
  it("reads a place's newest page once, and retries failures a few times with a pause", () => {
    expect(needsReading(item, undefined)).toBe(true);
    const done = applyReading(undefined, item, capture(), reading, TODAY, 1000);
    expect(needsReading(item, done)).toBe(false);
    expect(needsReading({ ...item, captureIds: ["c1", "c2"] }, done)).toBe(true);

    const failed = failedReading(undefined, item, "Gemini meşgul (503)", 1000);
    expect(needsReading(item, failed, 1000 + 60e3)).toBe(false);
    expect(needsReading(item, failed, 1000 + 11 * 60e3)).toBe(true);
    const gaveUp = { ...failed, autoRetries: 3 };
    expect(needsReading(item, gaveUp, 1000 + 60 * 60e3)).toBe(false);
    expect(needsReading(item, gaveUp, 0, true)).toBe(true);
  });

  it("skips flights, dismissed options and items without a saved page", () => {
    expect(needsReading({ ...item, category: "flight" }, undefined)).toBe(false);
    expect(needsReading({ ...item, status: "dismissed" }, undefined)).toBe(false);
    expect(needsReading({ ...item, captureIds: [] }, undefined)).toBe(false);
  });

  it("keeps what was read when a later reading fails", () => {
    const done = applyReading(undefined, item, capture(), reading, TODAY, 1000);
    const failed = failedReading(done, { ...item, captureIds: ["c1", "c2"] }, "kota doldu", 2000);
    expect(failed.findings).toHaveLength(done.findings.length);
    expect(failed.error).toBe("kota doldu");
  });
});
