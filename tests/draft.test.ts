// "Önerimiz" (plan v46, F7): a need still to choose, with a real option to show, has a draft on its card. It is only a way
// of looking: it never writes, it is no choice (the budget and the percentage don't count it, the headers say "önerimiz"),
// and it goes when anything is chosen, booked or set aside.
import { describe, expect, it } from "vitest";
import { categorize, planProgress, planStages, stageLine, type CatSection } from "../src/lib/categories";
import { decideGroup, makeContext } from "../src/lib/decision";
import { draftOf } from "../src/lib/draft";
import { heroNumbers } from "../src/lib/lifecycle";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder, placeholderPrint } from "../src/lib/startTrip";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { panoEntries, panoGroups } from "../src/lib/pano";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip: Trip = { id: "t1", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const paid = (amount: number | null): Item["price"] => ({ amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 });

let n = 0;
const stay = (name: string, status: Item["status"], amount: number | null, over: Partial<Item> = {}) =>
  makeItem({ id: `s${++n}`, name, category: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, price: paid(amount), status, ...over });
const flight = (name: string, status: Item["status"], amount: number | null, over: Partial<Item> = {}) =>
  makeItem({
    id: `f${++n}`,
    name,
    category: "flight",
    needKey: "flight:ist-opo",
    city: "Porto",
    dates: { start: "2026-10-08", end: null, source: "page" },
    price: paid(amount),
    status,
    flight: { from: "IST", to: "OPO", departure: "2026-10-08T09:00", arrival: "2026-10-08T12:00", carrier: null, flightNumber: null, stops: 0 },
    ...over,
  });

const decisionOf = (items: Item[]) => decideGroup(items, makeContext(trip, items));

describe("draftOf", () => {
  it("a flight or a stay with a priced option saved has a draft: one option is enough", () => {
    const one = stay("Jardim Stay", "saved", 285);
    expect(draftOf([one])).toBe(one);
    const f = flight("TK 1449", "saved", 148);
    expect(draftOf([f], decisionOf([f]))).toBe(f);
  });

  it("the pick is the decision's winner, else the first the card shows", () => {
    const dear = stay("Ribeira Rooms", "saved", 330);
    const cheap = stay("Casa Azul", "saved", 240);
    const items = [dear, cheap];
    const d = decisionOf(items);
    expect(d.winner).not.toBeNull();
    expect(draftOf(items, d)).toBe(d.winner!.item);
    // No decision at hand: the lowest price.
    expect(draftOf(items)).toBe(cheap);
    // A decision with no winner (a tie, too little to compare): the order the card shows them in.
    const noWinner = { winner: null, options: [...d.options].reverse() };
    expect(draftOf(items, noWinner)).toBe(noWinner.options[0].item);
  });

  it("an option with no price, or no real price, never makes a draft: nothing is made up", () => {
    expect(draftOf([stay("Jardim Stay", "saved", null)])).toBeNull();
    expect(draftOf([stay("Jardim Stay", "saved", 0)])).toBeNull();
    const priced = stay("Casa Azul", "saved", 240);
    expect(draftOf([stay("Jardim Stay", "saved", null), priced])).toBe(priced);
  });

  it("only a flight or a stay: an eSIM, a train, a tour have none", () => {
    expect(draftOf([makeItem({ category: "esim", needKey: "esim:pt", price: paid(12) })])).toBeNull();
    expect(draftOf([makeItem({ category: "transport", needKey: "transport:x", price: paid(30) })])).toBeNull();
    expect(draftOf([makeItem({ category: "activity", needKey: "activity:x", price: paid(30) })])).toBeNull();
  });

  it("it goes once anything is chosen or booked there", () => {
    const saved = stay("Casa Azul", "saved", 240);
    expect(draftOf([saved, stay("Jardim Stay", "chosen", 285)])).toBeNull();
    expect(draftOf([saved, stay("Jardim Stay", "booked", 285)])).toBeNull();
  });

  it("a need set aside, or an option ruled out, is no draft", () => {
    expect(draftOf([stay("Casa Azul", "dismissed", 240), stay("Jardim Stay", "dismissed", 285)])).toBeNull();
    const ruled = stay("Ribeira Rooms", "dismissed", 100);
    const kept = stay("Casa Azul", "saved", 240);
    expect(draftOf([ruled, kept])).toBe(kept);
  });

  it("an option the comparison rules out (priced for other dates) can't be the pick", () => {
    const other = stay("Casa Azul", "saved", 100, { dates: { start: "2026-12-01", end: "2026-12-04", source: "url" } });
    const right = stay("Jardim Stay", "saved", 285);
    const items = [other, right, stay("Ribeira Rooms", "saved", 330)];
    const d = decideGroup(items, makeContext(trip, items), "stay@2026-10-08_2026-10-11");
    expect(d.options.find((o) => o.item.id === other.id)?.excluded).toBeTruthy();
    expect(draftOf(items, d)?.id).not.toBe(other.id);
  });

  it("the start's placeholder is no draft: it is a chosen record with nothing on it", () => {
    const home = flight("Dönüş", "chosen", null, { origin: "chat" });
    const t: Trip = { ...trip, startGuide: { placeholders: { [home.id]: placeholderPrint(home) } } as Trip["startGuide"] };
    expect(isPlaceholder(t, home)).toBe(true);
    expect(draftOf([home])).toBeNull();
    // Even beside a real option saved: the card already has its (placeholder) choice.
    expect(draftOf([home, flight("TK 1450", "saved", 120)])).toBeNull();
  });
});

function sectionsOf(items: Item[]): CatSection[] {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items, new Set());
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items) });
  const d = new Map(plan.groups.map((g) => [g.key, decideGroup(g.items, makeContext(trip, items))] as const));
  const of = (list: Item[]) => [...d.values()].find((x) => x.options.some((o) => o.item.id === list[0]?.id));
  return categorize({ plan, timeline, items, legs, today: "2026-10-01", stageCtx, draftFor: (list) => draftOf(list, of(list)) });
}
const only = (sections: CatSection[], id: CatSection["id"]) => sections.find((s) => s.id === id)!;

describe("the count", () => {
  it("a draft is a need waiting for a decision, never a choice: the header says önerimiz, the percentage and progress don't move", () => {
    const withOptions = [flight("Gidiş", "booked", 148), stay("Casa Azul", "saved", 240), stay("Ribeira Rooms", "saved", 330)];
    const bare = [flight("Gidiş", "booked", 148), stay("Casa Azul", "saved", null), stay("Ribeira Rooms", "saved", null)];
    const drafted = sectionsOf(withOptions);
    const waiting = sectionsOf(bare);
    const st = only(drafted, "stay");
    expect(st.drafts).toBe(1);
    expect(only(waiting, "stay").drafts).toBe(0);
    // Still Seçenekler as far as the numbers go, exactly as with no draft.
    expect(st.stages).toEqual(only(waiting, "stay").stages);
    expect(planStages(drafted)).toEqual(planStages(waiting));
    expect(planProgress(drafted)).toEqual(planProgress(waiting));
    const hero = heroNumbers(planStages(drafted));
    expect(hero.planned).toBe(0);
    expect(hero.pct).toBe(100);
    expect(hero.open).toBeGreaterThan(0);
    // Its entry knows it, and says it.
    expect(st.entries.some((e) => e.draft)).toBe(true);
    expect(stageLine(st.stages, st.drafts)).toBe("1 önerimiz");
  });

  it("the header line: rezerve · önerimiz · seçildi · aranıyor, the drafts out of the aranıyor", () => {
    const stages = { search: 1, options: 2, planned: 1, booked: 1, ready: 1, cancelled: 0, notNeeded: 0, used: 0 };
    expect(stageLine(stages, 2)).toBe("2 rezerve · 2 önerimiz · 1 seçildi · 1 aranıyor");
    expect(stageLine(stages)).toBe("2 rezerve · 1 seçildi · 3 aranıyor");
    expect(stageLine({ ...stages, search: 0, options: 1 }, 1)).toBe("2 rezerve · 1 önerimiz · 1 seçildi");
  });

  it("choosing the draft makes it Seçildi: the draft is gone and the need is planned", () => {
    const before = sectionsOf([stay("Casa Azul", "saved", 240), stay("Ribeira Rooms", "saved", 330)]);
    expect(only(before, "stay").drafts).toBe(1);
    const after = sectionsOf([stay("Casa Azul", "chosen", 240), stay("Ribeira Rooms", "saved", 330)]);
    expect(only(after, "stay").drafts).toBe(0);
    expect(only(after, "stay").stages.planned).toBe(1);
    expect(stageLine(only(after, "stay").stages, only(after, "stay").drafts)).toBe("1 seçildi");
  });

  it("a need set aside has no draft, and the start's placeholder flight is not one", () => {
    expect(only(sectionsOf([stay("Casa Azul", "dismissed", 240), stay("Ribeira Rooms", "dismissed", 330)]), "stay").drafts).toBe(0);
    const home = flight("Dönüş", "chosen", null, { origin: "chat", needKey: "flight:opo-ist", flight: { from: "OPO", to: "IST", departure: "2026-10-11T09:00", arrival: "2026-10-11T12:00", carrier: null, flightNumber: null, stops: 0 }, dates: { start: "2026-10-11", end: null, source: "page" } });
    const sections = sectionsOf([home]);
    expect(only(sections, "flight").drafts).toBe(0);
    expect(only(sections, "flight").entries.every((e) => !e.draft)).toBe(true);
  });
});

describe("the Board", () => {
  it("the pick is marked as the draft, not as on the plan; it stays among the decisions waiting", () => {
    const items = [stay("Casa Azul", "saved", 240), stay("Ribeira Rooms", "saved", 330)];
    const d = new Map([[`stay@2026-10-08_2026-10-11`, decisionOf(items)]]);
    const entries = panoEntries(items, d);
    const pick = entries.filter((e) => e.draft);
    expect(pick).toHaveLength(1);
    expect(pick[0].inPlan).toBeNull();
    expect(pick[0].open).toBe(true);
    const group = panoGroups(entries)[0];
    expect(group.draft?.item.id).toBe(pick[0].item.id);
    expect(group.chosen).toBeNull();
    // Chosen, it is on the plan and the draft is gone.
    const chosen = panoEntries([{ ...items[0], status: "chosen" }, items[1]], d);
    expect(chosen.some((e) => e.draft)).toBe(false);
  });
});
