// The v82 Pano's view model (lib/panoBoard.ts, aşama 6): the Plan's own intents with every option they gathered (a booking's closed
// alternative too), the side menu's numbers, our pick leading the cards, the comparison's order and places, ✓ / ✕ only (B5), a
// ticket drawn as its carrier's mark, a stay's night price, the cancellation said once; the inspiration; opening by an intent's key
// or an old card's group.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { withLang } from "../src/lib/i18n";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { cancelOf, dotOf, findNeed, ideasOf, inView, markLetters, nameWithout, optionName, panoBoardOf, panoCatName, type PanoOption } from "../src/lib/panoBoard";
import { buildPlan, groupKeyOf } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-05";

async function sampleBoard(me: string | null = null) {
  const id = await loadDemoTrip({ today: TODAY });
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx, decisions } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip, ctx.listings);
  const sections = categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs, today: TODAY });
  const board = panoBoardOf({ trip, plan, sections, items, today: TODAY, decisions, ctx, people: 2, me });
  const needs = board.cats.flatMap((c) => c.needs);
  const option = (name: string) => needs.flatMap((n) => n.options).find((o) => o.item.name === name)!;
  return { board, needs, items, option, need: (name: string) => needs.find((n) => n.name === name)! };
}

describe("the sample trip (Portekiz) on the Pano", () => {
  it("lists the Plan's intents by category, each with its dot, and counts the side menu", async () => {
    const { board } = await sampleBoard();
    expect(board.cats.map((c) => [c.section, c.needs.map((n) => [n.name, n.dot, n.options.length])])).toEqual([
      ["flight", [["İstanbul → Porto", "ai", 2], ["Lizbon → İstanbul", "ok", 1]]],
      ["stay", [["Porto", "ai", 3], ["Lizbon", "ok", 2]]],
      ["transport", [["Porto → Lizbon", "ai", 1]]],
      ["activity", [["Porto", "sel", 4]]],
      ["todo", [["Porto", "open", 1]]],
      ["other", [["eSIM · Portekiz", "ai", 2]]],
    ]);
    // Every saved record but the chores is somewhere: a booking's closed alternative (Alfama Suites) stays among its need's options.
    expect(board.counts).toEqual({ all: 16, mine: 16, ai: 0, ilham: 0 });
    expect(board.cats.map((c) => c.count)).toEqual([3, 5, 1, 4, 1, 2]);
  });

  it("puts our pick first and on the plan's records says where they stand", async () => {
    const { need, needs, option } = await sampleBoard();
    const porto = need("Porto");
    expect(porto.compare).toBe(true);
    expect(porto.options[0]).toMatchObject({ source: { kind: "ours" }, current: null });
    expect(option("Lisboa Loft").current).toBe("booked");
    expect(option("Alfama Suites")).toMatchObject({ current: null });
    expect(need("Lizbon").groups).toContain(groupKeyOf(option("Alfama Suites").item));
    // A row of things to do is no comparison; the one on the plan says so.
    const acts = needs.find((n) => n.section === "activity")!;
    expect(acts).toMatchObject({ multi: true, compare: false, word: "Etkinlik" });
    expect(acts.options.filter((o) => o.current).map((o) => o.item.name)).toEqual(["Douro tekne turu"]);
  });

  it("ranks the comparison by fit, says each one's place and only ✓ or ✕", async () => {
    const { need } = await sampleBoard();
    const porto = need("Porto");
    const scored = porto.options.filter((o) => o.score != null);
    expect(scored.length).toBeGreaterThan(1);
    const byRank = [...scored].sort((a, b) => a.rank! - b.rank!);
    expect(byRank.map((o) => o.rank)).toEqual(byRank.map((_, i) => i + 1));
    for (let i = 1; i < byRank.length; i++) expect(byRank[i - 1].score!).toBeGreaterThanOrEqual(byRank[i].score!);
    for (const o of porto.options) for (const c of o.checks) expect(typeof c.ok).toBe("boolean");
    // A stay's night price large, its nights and the whole small.
    const first = porto.options[0];
    expect(first.price?.unit).toBe("/ gece");
    expect(first.price?.total).toMatch(/^3 gece · €/);
    // The cancellation is said once, on its row: not again among the pluses.
    for (const o of porto.options) if (o.cancel) expect([...o.pros, ...o.cons]).not.toContain(o.cancel.text);
  });

  it("draws a flight by its carrier's mark and number, its hours, length and stops in one line", async () => {
    const { need } = await sampleBoard();
    const out = need("İstanbul → Porto");
    expect(out.compare).toBe(true);
    const pegasus = out.options.find((o) => o.item.name === "Pegasus · direkt")!;
    expect(pegasus).toMatchObject({ name: "PC 1201", image: null, mark: { letters: "PC" } });
    expect(pegasus.price).toMatchObject({ unit: "kişi başı" });
    expect(pegasus.sub).toMatch(/→ .* · direkt$/);
  });

  it("finds an intent by its key or by an old card's group, and nothing for a key it doesn't know", async () => {
    const { board, need, option } = await sampleBoard();
    const lizbon = need("Lizbon");
    expect(findNeed(board, lizbon.key)?.key).toBe(lizbon.key);
    expect(findNeed(board, groupKeyOf(option("Lisboa Loft").item))?.key).toBe(lizbon.key);
    expect(findNeed(board, "nope")).toBeNull();
    expect(findNeed(board, null)).toBeNull();
  });
});

describe("the small words", () => {
  it("drops a brand the name repeats, but not a name that only describes after it", () => {
    expect(nameWithout("Turkish Airlines TK52", "Turkish Airlines")).toBe("TK52");
    expect(nameWithout("Pegasus · direkt", "Pegasus")).toBe("Pegasus · direkt");
    expect(nameWithout("Booking.com", "Booking.com")).toBe("Booking.com");
    expect(nameWithout("Jardim Stay", null)).toBe("Jardim Stay");
    expect(optionName({ name: "TAP · Lizbon", category: "flight", flight: { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber: "TP 1761", stops: null } }, "TAP")).toBe("TP 1761");
    expect(optionName({ name: "Hyatt Centric Ginza", category: "stay", flight: null }, "Hyatt")).toBe("Centric Ginza");
  });

  it("marks a carrier by its flight number's code, else the brand's first letters", () => {
    const f = (flightNumber: string | null) => ({ flight: { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber, stops: null } });
    expect(markLetters(f("TK 52"), "Turkish Airlines")).toBe("TK");
    expect(markLetters(f("u2 1234"), "easyJet")).toBe("EA");
    expect(markLetters({ flight: null }, "CP Alfa Pendular")).toBe("CA");
    expect(markLetters({ flight: null }, "Trainline")).toBe("TR");
  });

  it("says a cancellation in its tone, and nothing the page doesn't say", () => {
    const said = (summary: string) => makeItem({ cancellation: { summary, freeUntil: null, source: "page" } });
    expect(cancelOf(said("Ücretsiz iptal"), TODAY)).toEqual({ text: "Ücretsiz iptal", tone: "ok" });
    expect(cancelOf(said("Kısmi iade"), TODAY)?.tone).toBe("warn");
    expect(cancelOf(said("İade yok"), TODAY)).toEqual({ text: "İade yok", tone: "no" });
    expect(cancelOf(makeItem(), TODAY)).toBeNull();
  });

  it("gives each state its dot", () => {
    expect([dotOf("booked"), dotOf("arranged"), dotOf("included"), dotOf("chosen"), dotOf("suggested"), dotOf("deciding"), dotOf("searching")]).toEqual(["ok", "ok", "ok", "sel", "ai", "open", "open"]);
  });

  it("splits saved from found", () => {
    const ai = { ai: true } as PanoOption;
    const mine = { ai: false } as PanoOption;
    expect([inView("all", ai), inView("all", mine), inView("ai", ai), inView("ai", mine), inView("mine", ai), inView("mine", mine)]).toEqual([true, true, true, false, false, true]);
  });

  it("names the categories in the side menu (not \"Belgeler\" alone: that is the files' entry)", () => {
    expect(panoCatName("activity")).toBe("Etkinlik");
    expect(panoCatName("other")).toBe("Belgeler ve internet");
    expect(withLang("en", () => panoCatName("todo"))).toBe("Things to do");
  });
});

describe("İlham", () => {
  const reel = (over: Partial<Item>) =>
    makeItem({ category: "activity", needKey: "activity:reel", url: "https://www.instagram.com/reel/abc/", name: "Ribeira'da gün batımı", city: "Porto", metrics: EMPTY_METRICS, ...over });
  it("lists the saved Reels, videos and blogs newest first, what each is and who saved it", () => {
    const ideas = ideasOf(
      [
        reel({ id: "a", createdAt: 1 }),
        reel({ id: "b", createdAt: 3, url: "https://medium.com/@x/porto", name: "Porto rehberi", addedBy: "ai", city: "Porto" }),
        reel({ id: "c", createdAt: 2, url: "https://youtu.be/xyz", name: "Douro", addedBy: "Sabine", city: null }),
        reel({ id: "d", createdAt: 4, status: "dismissed" }),
        makeItem({ id: "e", category: "stay", name: "Jardim Stay", url: "https://booking.com/x" }),
      ],
      "Emre",
    );
    expect(ideas.map((i) => [i.id, i.platform, i.video, i.meta, i.who])).toEqual([
      ["b", "blog", false, "Porto", "AI buldu"],
      ["c", "youtube", true, "video", "Sabine"],
      ["a", "reels", true, "Reels · Porto", "Emre"],
    ]);
  });
});
