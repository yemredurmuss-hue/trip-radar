// The hero's tally line, its facts (countries, plugs, time difference, money's name) and the weather
// next to the cities: the forecast close to the trip, the last five years' same days before that.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { cityWeather, skyOf, summarize, weatherQuery, weatherTitle, type Daily } from "../src/lib/climate";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { loadDecisions } from "../src/lib/analysis";
import { categorize, sectionProgress, type CatEntry, type CatSection } from "../src/lib/categories";
import { countryNames, currencyName, flagEmoji, initials, offsetText, plugFit, sectionTally, tallyLines, tallySection, travellersTitle } from "../src/lib/heroInfo";
import { setLang } from "../src/lib/i18n";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";

afterEach(() => setLang("tr"));

describe("hero tally", () => {
  it("counts what the Plan's sections hold, as their headers' totals do", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(trip, items);
    const plan = buildPlan(trip, items);
    const legs = buildLegs(plan, trip, ctx.listings);
    const sections = categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs });
    const total = (...ids: string[]) => sections.filter((s) => ids.includes(s.id)).reduce((n, s) => n + sectionProgress(s).total, 0);
    const tally = sectionTally(sections);
    expect(tally).toEqual({ flight: total("flight"), stay: total("stay"), transport: total("transport"), experience: total("activity", "todo", "food") });
    expect(tally.stay).toBe(2); // Porto and Lisbon
    expect(tally.transport).toBeGreaterThanOrEqual(1); // Porto → Lizbon, whatever is chosen for it
  });
  it("counts a taxi and a transfer in Ulaşım, the to-dos and restaurants as experiences, nothing hidden", () => {
    const entries = (n: number) => Array.from({ length: n }, () => ({}) as CatEntry);
    const sections = [
      { id: "flight", entries: entries(3) },
      { id: "stay", entries: entries(2) },
      { id: "transport", entries: entries(1) },
      { id: "activity", entries: entries(0) },
      { id: "todo", entries: entries(2) },
      { id: "food", entries: entries(3) },
      { id: "other", entries: entries(4) },
    ] as Pick<CatSection, "id" | "entries">[];
    expect(sectionTally(sections)).toEqual({ flight: 3, stay: 2, transport: 1, experience: 5 });
    // A tap on "deneyim" opens the first of Etkinlikler, Yapılacak şeyler, Restoranlar with something in it.
    expect(tallySection("experience", sections)).toBe("todo");
    expect(tallySection("experience", sections.filter((s) => s.id !== "todo"))).toBe("food");
    expect(tallySection("experience", [])).toBe("activity");
    expect(tallySection("transport", sections)).toBe("transport");
    expect(sectionTally([])).toEqual({ flight: 0, stay: 0, transport: 0, experience: 0 });
    // The tip over a cell names what is inside, in the Plan's order, at most six; "deneyim" takes its three sections together.
    const named = (id: string, names: string[]) => ({ id, entries: names.map((name) => ({ row: { name, status: "Alındı" } })) }) as unknown as Pick<CatSection, "id" | "entries">;
    const lines = tallyLines([named("flight", ["TK 1760", "TP 52"]), named("activity", ["Douro", "Lello"]), named("food", ["Cervejaria", "", "Time Out", "A", "B", "C", "D"]), named("stay", [])], 6);
    expect(lines.flight).toEqual([{ name: "TK 1760", status: "Alındı" }, { name: "TP 52", status: "Alındı" }]);
    expect(lines.experience.map((l) => l.name)).toEqual(["Douro", "Lello", "Cervejaria", "Time Out", "A", "B"]);
    expect(lines.stay).toEqual([]);
  });
});

describe("hero facts", () => {
  it("names countries once, in order, in the board's language", () => {
    expect(countryNames(["pt", "PT", "ES", null, "x"])).toEqual(["Portekiz", "İspanya"]);
    setLang("en");
    expect(countryNames(["PT"])).toEqual(["Portugal"]);
  });
  it("tells whether home plugs fit", () => {
    expect(plugFit("TR", "PT")).toBe("fits");
    expect(plugFit("TR", "GB")).toBe("adapter");
    expect(plugFit("TR", "CH")).toBe("some"); // a two-pin plug goes in, a Schuko doesn't
    expect(plugFit("TR", "ZZ")).toBeNull();
  });
  it("writes the time difference in hours, \"Aynı saat\" when it's the same", () => {
    expect(offsetText(-2)).toBe("−2 saat");
    expect(offsetText(5.5)).toBe("+5,5 saat");
    expect(offsetText(0)).toBe("Aynı saat");
    expect(offsetText(null)).toBeNull();
    setLang("en");
    expect(offsetText(-2)).toBe("−2 h");
    expect(offsetText(0)).toBe("Same time");
  });
  it("draws a country's flag from its code", () => {
    expect(flagEmoji("PT")).toBe("🇵🇹");
    expect(flagEmoji("es")).toBe("🇪🇸");
    expect(flagEmoji("XYZ")).toBe("");
    expect(flagEmoji("1")).toBe("");
    expect(flagEmoji(null)).toBe("");
  });
  it("titles the travellers by name, else by count, else nothing", () => {
    expect(travellersTitle(["Emre", "Sabine"], 0)).toBe("Emre & Sabine");
    expect(travellersTitle(["Emre", "Sabine", "Ali"], 2)).toBe("Emre, Sabine +1");
    expect(travellersTitle(["Emre", "Sabine", "Ali", "Ece"], 2)).toBe("Emre, Sabine +2");
    expect(travellersTitle([" Emre "], 2)).toBe("Emre");
    expect(travellersTitle([], 2)).toBe("2 kişi");
    expect(travellersTitle(["", " "], 0)).toBe("");
    setLang("en");
    expect(travellersTitle([], 3)).toBe("3 people");
  });
  it("names the money", () => {
    expect(currencyName("EUR")).toBe("Euro");
    expect(initials("Emre Durmuş")).toBe("ED");
    expect(initials(" sabine ")).toBe("S");
  });
});

const day = (high: number, low: number, rain: number, cloud: number): Daily => ({
  temperature_2m_max: [high],
  temperature_2m_min: [low],
  precipitation_sum: [rain],
  cloud_cover_mean: [cloud],
});

describe("weather", () => {
  it("picks the sky from rain first, then clouds", () => {
    expect(skyOf(4, 10, 20)).toBe("rain");
    expect(skyOf(1, 10, 70)).toBe("cloud");
    expect(skyOf(1, 10, 45)).toBe("partly");
    expect(skyOf(0, 10, 10)).toBe("sun");
  });
  it("averages several days, skipping gaps", () => {
    const w = summarize("Porto", [day(22, 14, 0, 30), day(24, 16, 3, 50), { ...day(20, 12, 0, 40), temperature_2m_max: [null] }], "average")!;
    expect(w).toMatchObject({ high: 23, low: 14, rainy: 1, days: 3, sky: "partly" });
    expect(summarize("Porto", [], "average")).toBeNull();
  });
  it("asks for the forecast within ten days, from today, as far as it reaches", () => {
    expect(weatherQuery({ start: "2026-10-08", end: "2026-10-14" }, "2026-10-05")).toEqual({ kind: "forecast", start: "2026-10-08", end: "2026-10-14" });
    expect(weatherQuery({ start: "2026-10-08", end: "2026-10-14" }, "2026-10-10")).toEqual({ kind: "forecast", start: "2026-10-10", end: "2026-10-14" });
    expect(weatherQuery({ start: "2026-10-08", end: "2026-10-14" }, "2026-10-20")).toBeNull();
  });
  it("before that, the same days in each of the last five years", () => {
    const q = weatherQuery({ start: "2026-12-28", end: "2027-01-03" }, "2026-10-05");
    expect(q).toEqual({
      kind: "average",
      windows: [
        { start: "2025-12-28", end: "2026-01-03" },
        { start: "2024-12-28", end: "2025-01-03" },
        { start: "2023-12-28", end: "2024-01-03" },
        { start: "2022-12-28", end: "2023-01-03" },
        { start: "2021-12-28", end: "2022-01-03" },
      ],
    });
  });
  it("reads a city's average from the archive and says so", async () => {
    const asked: string[] = [];
    const w = await cityWeather("Porto", { lat: 41.15, lng: -8.61 }, { start: "2026-11-20", end: "2026-11-23" }, "2026-10-05", async (u) => {
      asked.push(u);
      return day(16, 9, 2, 80);
    });
    expect(asked).toHaveLength(5);
    expect(asked[0]).toContain("archive-api.open-meteo.com/v1/archive?latitude=41.150&longitude=-8.610&start_date=2025-11-20&end_date=2025-11-23");
    expect(w).toMatchObject({ high: 16, sky: "rain", source: "average", rainy: 5, days: 5 });
    expect(weatherTitle(w!, "Kasım")).toBe("Porto · Kasım ortalaması, son 5 yıl: gündüz 16°, gece 9° · yağışlı gün 5/5");
  });
  it("shows nothing when the service has nothing", async () => {
    expect(await cityWeather("Porto", { lat: 1, lng: 1 }, { start: "2026-10-08", end: "2026-10-09" }, "2026-10-05", async () => null)).toBeNull();
  });
});

describe("hero places", () => {
  it("reads countries and each city's days from the sample trip", async () => {
    const { countriesOf, cityRanges } = await import("../src/lib/heroInfo");
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const plan = buildPlan(trip, items);
    expect(countriesOf(items)).toEqual(["Portekiz"]);
    expect(cityRanges(plan, ["Porto", "Lizbon"], plan.range)).toEqual([
      { city: "Porto", start: "2026-10-08", end: "2026-10-11" },
      { city: "Lizbon", start: "2026-10-11", end: "2026-10-14" },
    ]);
    // A main place spans its members' nights (destinations.ts): here one "destination" of both cities.
    expect(cityRanges(plan, [{ name: "Portekiz kıyısı", members: ["Porto", "Lizbon"] }], plan.range)).toEqual([
      { city: "Portekiz kıyısı", start: "2026-10-08", end: "2026-10-14" },
    ]);
  });
});
