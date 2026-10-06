// The day-by-day view as cards: one a day in order, a moving day titled by its route, free days in a
// row merged, at most four lines on a closed card.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { orderRows, movedOrder, dayCards, endsOf, foldRows, highlightOf, isAsideRow, isPlanRow, rowMark, tieredRows, tierOf, type DayCard } from "../src/lib/dayCards";
import { makeItem } from "./fixtures/makeItem";
import { loadDemoTrip } from "../src/lib/demo";
import type { DayRow } from "../src/lib/journey";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";

async function demoCards() {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
  return dayCards(timeline.sections, { listings: ctx.listings });
}

describe("day cards", () => {
  it("one card a day of the sample trip, in order, free days merged", async () => {
    const cards = await demoCards();
    // Standard titles, by the code (0.35.5): the city and the day, the kind of day beside it.
    const line = cards.map((c) => `${c.dayNo} ${c.date}${c.end ? `–${c.end}` : ""} ${c.title}${c.tag ? ` [${c.tag}]` : ""}`);
    expect(line[0]).toBe("1. gün 2026-10-08 Porto 1. Gün [Varış]");
    expect(line[1]).toBe("2. gün 2026-10-09 Porto 2. Gün");
    expect(line).toContain("3. gün 2026-10-10 Porto 3. Gün [Boş gün]");
    expect(line).toContain("4. gün 2026-10-11 Lizbon 4. Gün [Yolculuk]");
    expect(line.at(-1)).toBe("7. gün 2026-10-14 Lizbon 7. Gün [Dönüş]");
    expect(cards.find((c) => c.tag === "Yolculuk")?.route).toBe("Porto → Lizbon");
    // Every date of the trip is on exactly one card.
    const covered = cards.flatMap((c) => (c.end ? [c.date, c.end] : [c.date]));
    expect(new Set(covered).size).toBe(covered.length);
    // Lisbon's two free days are one card.
    expect(cards.find((c) => c.end)).toMatchObject({ title: "Lizbon 5–6. Gün", tag: "Boş günler" });
  });
  it("folds a long day to three lines and the rest", () => {
    const r = (key: string, kind: DayRow["kind"] = "item", state: DayRow["state"] = "done") => ({ key, kind, state }) as DayRow;
    const rows = [r("a"), r("i", "info", "info"), r("b"), r("c"), r("d"), r("e"), r("x", "ideas", "info")];
    expect(rows.filter(isPlanRow).map((x) => x.key)).toEqual(["a", "b", "c", "d", "e"]);
    const { shown, more } = foldRows(rows);
    expect(shown.map((x) => x.key)).toEqual(["a", "b", "c"]);
    expect(more.map((x) => x.key)).toEqual(["d", "e"]);
    expect(foldRows(rows.slice(0, 5)).more).toEqual([]);
  });
  it("marks booked with ✓, says what's left in a word, nothing for information", () => {
    expect(rowMark({ state: "done" } as DayRow)).toEqual({ done: true, text: "✓" });
    expect(rowMark({ state: "pending" } as DayRow)?.text).toBe("rezerve et");
    expect(rowMark({ state: "open" } as DayRow)?.text).toBe("planla");
    expect(rowMark({ state: "info" } as DayRow)).toBeNull();
  });
});

describe("a trip's ends", () => {
  it("leave the kind's word out", () => {
    expect(endsOf("Uçuş LIS → IST")).toEqual(["LIS", "IST"]);
    expect(endsOf("Tren Porto → Lizbon")).toEqual(["Porto", "Lizbon"]);
    expect(endsOf("Otel → Gar")).toEqual(["Otel", "Gar"]);
    expect(endsOf("Douro tekne turu")).toBeNull();
  });
});

describe("a day's look", () => {
  it("each row has the Plan's kind; the photo comes from the day's highlight, else its city", async () => {
    const { rowKind, highlightOf, dayPhoto } = await import("../src/lib/dayCards");
    const cards = await demoCards();
    const move = cards.find((c) => c.route === "Porto → Lizbon")!;
    expect(move.rows.filter(isPlanRow).map(rowKind)).toEqual(["taxi", "train", "taxi"]);
    expect(dayPhoto(move)).toEqual({ query: "Lizbon" });
    expect(rowKind(highlightOf(move)!)).toBe("train"); // the train, not the taxi to the station
    expect(rowKind(highlightOf(cards.at(-1)!)!)).toBe("flight");
    const porto = cards.find((c) => c.dayNo === "2. gün")!;
    expect(highlightOf(porto)?.title).toBe("Douro tekne turu");
    expect(dayPhoto(porto)).toEqual({ query: "Douro tekne turu Porto" });
  });
});

describe("the whole day", () => {
  it("lists every line, ideas one by one, nothing folded", async () => {
    const { flowRows } = await import("../src/lib/dayCards");
    const r = (key: string, kind: DayRow["kind"], extra: Partial<DayRow> = {}) => ({ key, kind, state: "info", title: key, items: [], ...extra }) as DayRow;
    const card = { rows: [r("out", "info"), r("taxi", "leg", { state: "open" }), r("ideas", "ideas", { items: [{ id: "1", name: "Casa Guedes" }, { id: "2", name: "Jardim do Morro" }] as never })] } as never;
    expect(flowRows(card).map((x) => `${x.kind}:${x.title}`)).toEqual(["info:out", "leg:taxi", "idea:Casa Guedes", "idea:Jardim do Morro"]);
  });
});

describe("the trip as it goes", () => {
  it("travel days alone, a city's days together, in order", async () => {
    const { groupDays, daysLabel } = await import("../src/lib/dayCards");
    const cards = await demoCards();
    const groups = groupDays(cards);
    expect(groups.map((g) => (g.kind === "travel" ? `✈ ${g.card.route}` : `📍 ${g.city} ${daysLabel(g.cards)}`))).toEqual([
      "✈ İstanbul → Porto",
      "📍 Porto 2–3. gün",
      "✈ Porto → Lizbon",
      "📍 Lizbon 5–6. gün",
      "✈ Lizbon → İstanbul",
    ]);
  });
});

describe("a day's order (0.35.6)", () => {
  const r = (key: string, time: string | null = null) => ({ key, kind: "item", state: "done", title: key, time, items: [] }) as unknown as DayRow;
  const keys = (rows: DayRow[]) => rows.map((x) => x.key);
  const day = [r("out", "11:00"), r("cafe"), r("tour", "16:00"), r("market")];

  it("as the plan put it until moved; the timed by the clock", () => {
    expect(keys(orderRows(day))).toEqual(["out", "cafe", "tour", "market"]);
    expect(keys(orderRows([r("tour", "16:00"), r("cafe"), r("out", "11:00")]))).toEqual(["out", "tour", "cafe"]); // the café stays after the tour
  });
  it("a line without a time stays where it was put; a new one after its neighbour; a gone one is gone", () => {
    const saved = movedOrder(day, "market", "out", false); // to the top
    expect(saved).toEqual(["market", "out", "cafe", "tour"]);
    expect(keys(orderRows(day, saved))).toEqual(["market", "out", "cafe", "tour"]);
    expect(keys(orderRows([...day, r("museum")], saved))).toEqual(["market", "out", "cafe", "tour", "museum"]);
    expect(keys(orderRows([r("new"), ...day], saved))).toEqual(["market", "new", "out", "cafe", "tour"]); // before "out", as in the plan
    expect(keys(orderRows(day.filter((x) => x.key !== "cafe"), saved))).toEqual(["market", "out", "tour"]);
    expect(keys(orderRows(day, movedOrder(day, "cafe", "tour", true)))).toEqual(["out", "tour", "cafe", "market"]);
  });
  it("given a time, a line moves to it; the lines without one keep their neighbour", () => {
    const timed = day.map((x) => (x.key === "market" ? r("market", "09:00") : x));
    expect(keys(orderRows(timed))).toEqual(["market", "out", "cafe", "tour"]);
  });
});

describe("what isn't part of a day", () => {
  const insurance = { key: "item:ins", kind: "item", state: "pending", title: "Seyahat sağlık sigortası", item: makeItem({ category: "other", name: "Seyahat sağlık sigortası", plannedKind: "insurance", status: "chosen" }) } as DayRow;
  const taxi = { key: "leg:x", kind: "leg", state: "open", title: "Havalimanı → Otel", item: null } as DayRow;
  it("insurance is an aside: never the day's highlight (its colour, its photo)", () => {
    expect(isAsideRow(insurance)).toBe(true);
    expect(isAsideRow(taxi)).toBe(false);
    expect(highlightOf({ rows: [insurance, taxi] } as DayCard)?.key).toBe("leg:x");
    expect(highlightOf({ rows: [insurance] } as DayCard)).toBeNull();
  });
});

describe("the day's groups (0.36.24): settled first, then what's not booked, the ideas last", () => {
  const r = (key: string, over: Partial<DayRow>) => ({ key, kind: "item", state: "done", time: null, estimated: false, hint: null, otherDay: null, title: key, sub: null, line: null, status: "", notes: [], entry: null, leg: null, item: null, items: [], rental: null, stayKey: null, ...over }) as DayRow;
  it("Emre's Porto day 3: the booked boat on top with its time, the tour without a ticket next, the ideas last", () => {
    const rows = [
      r("pazar", { kind: "idea" }),
      r("bisiklet", { state: "pending", time: "10:00" }),
      r("outdoor", { kind: "idea" }),
      r("serralves", { kind: "idea" }),
      r("tekne", { state: "done", time: "16:00" }),
      r("fado", { state: "pending" }),
    ];
    expect(tieredRows(rows).map((x) => x.key)).toEqual(["tekne", "bisiklet", "fado", "pazar", "outdoor", "serralves"]);
  });
  it("a travel day keeps its order: trips and transfers stay in the frame whatever their state", () => {
    const rows = [r("out", { kind: "info", state: "info" }), r("taxi", { kind: "leg", state: "open" }), r("fly", { kind: "travel", state: "decide" }), r("in", { kind: "info", state: "info" })];
    expect(tieredRows(rows).map((x) => x.key)).toEqual(["out", "taxi", "fly", "in"]);
    expect(rows.map(tierOf)).toEqual([0, 0, 0, 0]);
  });
});
