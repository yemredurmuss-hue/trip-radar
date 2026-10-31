// tests/arriveBy.test.ts: how one gets there and how one gets around are two things (omurga Tur 11b, 2026-10-31,
// Emre: Amalfi'de yol gezisi açıldı, uçuş hiç konmadı). The model reads the way there from what is said and common
// sense; a road trip only says how one moves around. The way there is never left out: a flight, one's own car, a bus.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { acceptExtraction, creationOf, mergeExtracted, newStart, type RawExtraction, type StartState } from "../src/lib/startTrip";

const raw = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "",
  start_month: 0, duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
}) as RawExtraction;

describe("the model reads the way there", () => {
  it.each([
    ["car", "car"], ["bus", "bus"], ["train", "train"], ["ferry", "ferry"],
  ])("arrive_by %s → way %s", (by, way) => expect(acceptExtraction(raw({ arrive_by: by } as Partial<RawExtraction>), "2026-10-31").way).toBe(way));

  it("the model's spine question: kept when it is a real question", () => {
    expect(acceptExtraction(raw({ spine_question: "Kulübede hangi gece kalmak istersin?" } as Partial<RawExtraction>), "2026-10-31").spineQuestion).toBe("Kulübede hangi gece kalmak istersin?");
    expect(acceptExtraction(raw({ spine_question: "ok" } as Partial<RawExtraction>), "2026-10-31").spineQuestion).toBeUndefined();
  });

  it("the spine question is one question, its answers as taps", () => {
    const e = acceptExtraction(raw({ spine_question: "Cam tavanlı kulübede hangi gece kalmak istersin?", spine_choices: ["İlk gece", "Ortadaki bir gece", "Son gece", ""] } as Partial<RawExtraction>), "2026-10-31");
    expect(e.spineQuestion).toBe("Cam tavanlı kulübede hangi gece kalmak istersin?");
    expect(e.spineChoices).toEqual(["İlk gece", "Ortadaki bir gece", "Son gece"]);
    // two questions in one are no question to tap on
    expect(acceptExtraction(raw({ spine_question: "Kulübede hangi gece kalmak istersin, husky turunu hangi güne koyalım?" } as Partial<RawExtraction>), "2026-10-31").spineQuestion).toBeUndefined();
    expect(acceptExtraction(raw({ spine_question: "Hangi gece? Hangi gün?" } as Partial<RawExtraction>), "2026-10-31").spineQuestion).toBeUndefined();
  });

  it("a plane, or unsure: no ground way", () => {
    expect(acceptExtraction(raw({ arrive_by: "plane" } as Partial<RawExtraction>), "2026-10-31").way).toBeUndefined();
    expect(acceptExtraction(raw({ arrive_by: "" } as Partial<RawExtraction>), "2026-10-31").way).toBeUndefined();
  });

  it("the words said win, else the model's reading", () => {
    const code = acceptExtraction(raw(), "2026-10-31");
    const model = acceptExtraction(raw({ arrive_by: "car" } as Partial<RawExtraction>), "2026-10-31");
    expect(mergeExtracted(code, model).way).toBe("car");
    expect(mergeExtracted({ ...code, way: "train" }, model).way).toBe("train");
  });
});

const amalfi = (over: Partial<StartState> = {}): StartState => ({
  ...newStart("s1", "road", 0, "tr"),
  where: { place: "Amalfi", country: "İtalya", code: "IT" } as StartState["where"],
  from: "İstanbul",
  duration: { unit: "day", n: 7 },
  start: { date: "2026-06-01", approx: false },
  ...over,
});
const kinds = (s: StartState) => withLang("tr", () => creationOf(s))!.travel.map((t) => t.kind);

describe("a road trip", () => {
  it("abroad, flown to: flights in and out, and the car where one lands", () => {
    const travel = withLang("tr", () => creationOf(amalfi()))!.travel;
    expect(travel.filter((t) => t.kind === "flight")).toHaveLength(2);
    expect(travel.filter((t) => t.kind === "car_rental")).toHaveLength(1);
  });

  it("from home in one's own car: no flight and no car to rent", () => {
    expect(kinds(amalfi({ way: "car" }))).toEqual([]);
  });

  it("by train there: the trains, then a car rented there", () => {
    const k = kinds(amalfi({ way: "train" }));
    expect(k.filter((x) => x === "train")).toHaveLength(2);
    expect(k).toContain("car_rental");
    expect(k).not.toContain("flight");
  });
});
