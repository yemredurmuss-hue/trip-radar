// "★ öncelik": a plus or a minus gets the star only when the traveller's own words stand behind it.
import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { cardFacts, criterionMatters, hasMine, touchesPriority } from "../src/lib/cardFacts";
import { prosConsFor, type ProCon } from "../src/lib/proscons";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import type { Trip } from "../src/lib/types";

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T10:00:00Z") }));
afterAll(() => vi.useRealTimers());

const trip = (over: Partial<Trip> = {}) => ({ id: "t", title: "T", confirmedDates: null, budget: null, heroImage: null, ...over }) as Trip;
const none = new Map();

describe("criterionMatters", () => {
  it("defaults don't count: nothing was said", () => {
    expect(criterionMatters("price", "stay", { trip: trip(), inferred: none, preferences: [] })).toBe(false);
    expect(criterionMatters("quiet", "stay", { trip: trip(), inferred: none, preferences: [] })).toBe(false);
  });

  it("a note that asks for it counts: 'sessiz bir yer istiyoruz' is quiet, 'merkezi olsun' is location, 'iade olsun' is cancellation", () => {
    const ctx = (preferences: string[]) => ({ trip: trip(), inferred: none, preferences });
    expect(criterionMatters("quiet", "stay", ctx(["sessiz bir yer istiyoruz"]))).toBe(true);
    expect(criterionMatters("location", "stay", ctx(["merkezi olsun"]))).toBe(true);
    expect(criterionMatters("cancellation", "stay", ctx(["ücretsiz iptal olsun"]))).toBe(true);
    expect(criterionMatters("quiet", "stay", ctx(["merkezi olsun"]))).toBe(false);
  });

  it("a level the traveller set counts from Önemli up, not below", () => {
    const set = (level: 0 | 1 | 2 | 3 | 4) => ({ trip: trip({ priorities: { price: level } }), inferred: none, preferences: [] });
    expect(criterionMatters("price", "stay", set(4))).toBe(true);
    expect(criterionMatters("price", "stay", set(3))).toBe(true);
    expect(criterionMatters("price", "stay", set(2))).toBe(false);
  });

  it("without a context nothing is starred", () => {
    expect(criterionMatters("quiet", "stay", undefined)).toBe(false);
  });
});

describe("the sample trip's cards", () => {
  it("only what the traveller's words stand behind carries the star", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const tr = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const result = await loadDecisions(tr, items);
    const decisionOf = (name: string) => [...result.decisions.values()].find((d) => d.options.some((o) => o.item.name === name))!;
    const factsWith = (name: string, ctx = result.ctx) => cardFacts(items.find((i) => i.name === name)!, decisionOf(name), ctx);
    const starred = (list: { text: string; mine: boolean }[]) => list.filter((l) => l.mine).map((l) => l.text);
    const lines = (name: string, ctx = result.ctx) => {
      const item = items.find((i) => i.name === name)!;
      const pc = prosConsFor(item, decisionOf(name), ctx.listings, ctx)!;
      const mine = (l: ProCon) => touchesPriority(l, item, ctx);
      return { pros: pc.pros.filter(mine).map((l) => l.text), cons: pc.cons.filter(mine).map((l) => l.text), all: pc.pros.length + pc.cons.length };
    };
    // "Sessiz bir yer istiyoruz" was said: the quiet reading is starred, the breakfast and the walk nobody asked for are not.
    expect(lines("Jardim Stay").pros).toEqual(["Sessiz odalar, iyi uyku"]);
    expect(lines("Jardim Stay").all).toBeGreaterThan(2);
    // The construction noise next door, against that quiet, is a starred minus.
    expect(lines("Casa Azul").cons).toEqual(["Yan binada inşaat gürültüsü", "Kontrol gerekiyor: Yan binada inşaat var; sessiz bir yer istiyorsun"]);
    // A note that also asks for breakfast stars what the page says about it.
    const breakfast = { ...result.ctx, preferences: [...result.ctx.preferences, "kahvaltı olsun"] };
    expect(lines("Jardim Stay", breakfast).pros).toEqual(["Sessiz odalar, iyi uyku", "Kahvaltı çok iyi"]);
    const withLevel = (priorities: Trip["priorities"]) => ({ ...result.ctx, trip: { ...result.ctx.trip, priorities } });
    // Nothing was asked of a flight, and the levels the defaults give star nothing: no star on a card nobody's words stand behind.
    expect(hasMine(factsWith("Pegasus · direkt"))).toBe(false);
    expect(hasMine(factsWith("Pegasus · direkt", withLevel({ duration: 2, price: 2 })))).toBe(false);
    // What they set is read from the card's lines the cards keep: location "Çok önemli" stars the restaurant next door (a finding about what's near).
    expect(starred(factsWith("Casa Azul", withLevel({ location: 4 })).pros)).toEqual(["Yanında çok iyi bir İtalyan restoranı"]);
  });
});
