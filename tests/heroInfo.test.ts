// The hero's tally line, its facts (countries, plugs, time difference, money's name) and the weather
// next to the cities: the forecast close to the trip, the last five years' same days before that.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { cityWeather, skyOf, summarize, weatherQuery, weatherTitle, type Daily } from "../src/lib/climate";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { countryNames, currencyName, heroTally, initials, offsetText, plugFit } from "../src/lib/heroInfo";
import { setLang } from "../src/lib/i18n";
import { buildPlan } from "../src/lib/plan";

afterEach(() => setLang("tr"));

describe("hero tally", () => {
  it("counts each need once on the sample trip", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const tally = heroTally(buildPlan(trip, items), items);
    expect(tally.flight).toBeGreaterThanOrEqual(1);
    expect(tally.stay).toBe(2); // Porto and Lisbon
    expect(tally.experience).toBeGreaterThanOrEqual(1); // the Douro boat tour is on the plan
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
  it("writes the time difference short, and nothing when it's the same", () => {
    expect(offsetText(-2)).toBe("−2 sa");
    expect(offsetText(5.5)).toBe("+5,5 sa");
    expect(offsetText(0)).toBeNull();
    expect(offsetText(null)).toBeNull();
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
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const plan = buildPlan(trip, items);
    expect(countriesOf(items)).toEqual(["Portekiz"]);
    expect(cityRanges(plan, ["Porto", "Lizbon"], plan.range)).toEqual([
      { city: "Porto", start: "2026-10-08", end: "2026-10-11" },
      { city: "Lizbon", start: "2026-10-11", end: "2026-10-14" },
    ]);
  });
});
