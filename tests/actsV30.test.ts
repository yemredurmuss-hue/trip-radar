// Plan v30, the acts (Etkinlik ve turlar, Yapılacaklar, the festival's camp): the pure parts.
import { describe, expect, it } from "vitest";
import { isCampStay } from "../src/lib/campStay";
import { footOf, ringOf } from "../src/lib/cardView";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { buildPlan } from "../src/lib/plan";
import { campWords, stayKindSet, validEffect } from "../src/lib/playbooks";
import { closedNoteOf } from "../src/lib/reason";
import { activityLinks, restLinks } from "../src/lib/searchLinks";
import { wayName } from "../src/lib/tripShape";
import { restCityOf } from "../src/app/plan/ActivityBoard";
import { EMPTY_METRICS } from "../src/lib/items";
import { makeItem } from "./fixtures/makeItem";

const camp = (kind: "camp" | "vehicle" = "camp") =>
  makeItem({
    name: "Çadır kampı · festival alanı",
    category: "stay",
    status: "chosen",
    origin: "chat",
    city: "Ozora",
    dates: { start: "2027-07-25", end: "2027-08-02", source: "page" },
    metrics: { ...EMPTY_METRICS, stayKind: kind },
    noBooking: 1,
  });

describe("the festival's camp", () => {
  it("is a stay of the camp or the caravan kind, and nothing else is", () => {
    expect(isCampStay(camp())).toBe(true);
    expect(isCampStay(camp("vehicle"))).toBe(true);
    expect(isCampStay(makeItem({ category: "stay" }))).toBe(false);
    expect(isCampStay(null)).toBe(false);
  });
  it("its answer is an operation the validator knows (a tent or a caravan, nothing else)", () => {
    expect(validEffect({ op: "setStay", kind: "vehicle" })).toEqual({ op: "setStay", kind: "vehicle" });
    expect(validEffect({ op: "setStay", kind: "hotel" })).toBeNull();
    expect(stayKindSet([{ op: "setStay", kind: "camp" }, { op: "setStay", kind: "vehicle" }])).toBe("vehicle");
    expect(stayKindSet([])).toBeNull();
  });
  it("has its own words in both languages", () => {
    expect(withLang("tr", () => campWords("camp"))).toEqual({ title: "Çadır kampı · festival alanı", note: "kendi çadırın" });
    expect(withLang("en", () => campWords("vehicle")).title).toBe("Caravan · festival grounds");
  });
  it("is never an empty card or an open hotel to find: its nights are one chosen stay", () => {
    expect(isEmptyRecord({ startGuide: undefined }, camp())).toBe(false);
    const plan = buildPlan({ id: "t", title: "Ozora", confirmedDates: { start: "2027-07-25", end: "2027-08-02" } } as never, [camp()]);
    expect(plan.stayBlocks.map((b) => b.kind)).toEqual(["chosen"]);
  });
  it("says at its foot that nothing is to be booked, as a chosen plan; 'bilete dahil' on a festival trip", () => {
    expect(ringOf(camp())).toBe("half");
    const plain = withLang("tr", () => footOf(camp(), "stay"));
    expect(plain.action).toBeNull();
    expect(plain.left).toMatchObject({ kind: "state", tone: "done", text: "Rezervasyon gerekmez" });
    const festival = withLang("tr", () => footOf(camp(), "stay", { included: true }));
    expect(festival.left).toMatchObject({ text: "Rezervasyon gerekmez · bilete dahil" });
  });
});

describe("the type note and the rest after a festival", () => {
  it("says the tours are closed, and that rest was suggested only when there is a stop to rest in", () => {
    expect(withLang("tr", () => closedNoteOf("festival", true))).toBe("Festival gezisi: tur önerisi kapalı; sonrası için dinlenme önerdik");
    expect(withLang("tr", () => closedNoteOf("festival", false))).toBe("Festival gezisi: tur önerisi kapalı");
    expect(withLang("en", () => closedNoteOf("festival", true))).toMatch(/^Festival trip: tour suggestions are off/);
    expect(withLang("tr", () => closedNoteOf("wellness", false))).toMatch(/gezinin sebebi bu/);
  });
  const block = (city: string, start: string, end: string) => ({ kind: "open", range: { start, end }, nights: 2, city, groups: [], searchUrl: "" }) as never;
  it("rests in the last stop after the festival's own place", () => {
    expect(restCityOf({ stayBlocks: [block("Ozora", "2027-07-25", "2027-08-02"), block("Budapeşte", "2027-08-02", "2027-08-04")] }, "Ozora")).toBe("Budapeşte");
  });
  it("has none when the trip stays at the festival, or the festival is last", () => {
    expect(restCityOf({ stayBlocks: [block("Ozora", "2027-07-25", "2027-08-02")] }, "Ozora")).toBeNull();
    expect(restCityOf({ stayBlocks: [block("Budapeşte", "2027-07-24", "2027-07-25"), block("Ozora", "2027-07-25", "2027-08-02")] }, "Ozora")).toBeNull();
    expect(restCityOf({ stayBlocks: [] }, "Ozora")).toBeNull();
  });
  it("only searches (a link set with the city and the word), never a made-up place", () => {
    const links = withLang("tr", () => restLinks("Budapeşte"));
    expect(links.map((l) => l.brand)).toEqual(activityLinks("Budapeşte").map((l) => l.brand));
    expect(links.every((l) => decodeURIComponent(l.url).includes("Budapeşte termal hamam spa"))).toBe(true);
    expect(restLinks(null)).toEqual([]);
  });
});

describe("the way between two cities, in the transport card's own words", () => {
  it("drops the route and the brand's prefix", () => {
    expect(wayName({ name: "JR Shinkansen Hikari · Odawara → Kyoto", provider: "JR" })).toBe("Shinkansen Hikari");
    expect(wayName({ name: "Romancecar · Shinjuku → Odawara", provider: "Odakyu" })).toBe("Romancecar");
    expect(wayName({ name: "Odawara → Kyoto", provider: null })).toBeNull();
    expect(wayName(null)).toBeNull();
  });
});
