// Where the trip's decisions stand (the strip under the summary), the date alerts on cards, and the
// money bar, on the sample trip seen from 29 September.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { budgetBar, dateAlert, decisionProgress, nextStepText, type Todo, sectionAllotments } from "../src/lib/progress";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";

const TODAY = "2026-09-29";

async function demo() {
  const id = await loadDemoTrip({ today: "2026-10-05" });
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx, decisions } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
  return { trip, items, ctx, decisions, plan, timeline };
}

describe("to-do strip", () => {
  it("lists what to decide, book and plan, and the cancellations running out", async () => {
    const { items, decisions, plan, timeline } = await demo();
    const p = decisionProgress(timeline, items, plan, decisions, TODAY);
    expect(p.count).toEqual({ decide: 3, book: 1, plan: 4, deadline: 2 });
    expect(p.todos.map((t) => [t.kind, t.title, t.note, t.days])).toEqual([
      ["deadline", "Lisboa Loft", "ücretsiz iptal 5 Ekim'e kadar", 6],
      ["deadline", "TAP · Lizbon → İstanbul", "ücretsiz iptal 5 Ekim'e kadar", 6],
      ["decide", "Gidiş uçuşu · 8 Ekim", "2 seçenek · Pegasus · direkt önde", 9],
      ["decide", "Porto konaklama · 8–11 Ekim", "3 seçenek · Jardim Stay önde", 9],
      ["plan", "Varış transferi · 8 Ekim", "OPO havalimanı → Porto konaklaması · nasıl?", 9],
      ["book", "Douro tekne turu", "bilet alınmadı · 9 Ekim · ücretsiz iptalli", 10],
      ["plan", "Ayrılış transferi · 11 Ekim", "Porto konaklaması → Porto Campanhã · nasıl?", 12],
      ["decide", "Porto → Lizbon · 11 Ekim", "1 seçenek · seç ya da başka ekle", 12],
      ["plan", "Varış transferi · 11 Ekim", "Lisboa Santa Apolónia → Lisboa Loft · nasıl?", 12],
      ["plan", "Ayrılış transferi · 14 Ekim", "Lisboa Loft → LIS havalimanı · nasıl?", 15],
    ]);
    // Within two weeks is marked; the last transfer isn't.
    expect(p.todos.filter((t) => !t.soon).map((t) => t.title)).toEqual(["Ayrılış transferi · 14 Ekim"]);
    // Each one points at its place on the board.
    const legKeys = new Set(timeline.entries.flatMap((e) => (e.kind === "leg" ? [e.leg.key] : e.kind === "day" ? e.legs.map((l) => l.key) : [])));
    for (const t of p.todos) {
      if (t.target.entry) expect(timeline.entries.some((e) => e.key === t.target.entry)).toBe(true);
      if (t.target.leg) expect(legKeys.has(t.target.leg)).toBe(true);
      expect(t.target.entry ?? t.target.leg).toBeTruthy();
    }
    // Far from the dates, no cancellation nags.
    expect(decisionProgress(timeline, items, plan, decisions, "2026-06-01").count.deadline).toBe(0);
  });

  it("drops a transfer or nights said not needed, and lists a chat plan to book even without a day", async () => {
    const { trip, items, decisions, plan, ctx } = await demo();
    const legs = buildLegs(plan, trip, ctx.listings);
    const transfer = legs.find((l) => l.kind === "arrival")!;
    const hidden = new Set([`leg:${transfer.key}`]);
    const timeline = buildTimeline(plan, legs, items, hidden);
    const p = decisionProgress(timeline, items, plan, decisions, TODAY);
    expect(p.todos.some((t) => t.target.leg === transfer.key)).toBe(false);
    expect(p.count.plan).toBe(3);

    const car: Item = { ...items.find((i) => i.name === "Douro tekne turu")!, id: "car", name: "Araç kiralama · Porto", category: "transport", dates: { start: null, end: null, source: "unverified" }, flight: null, origin: "chat", status: "chosen", cancellation: { summary: null, freeUntil: null, source: "none" } };
    const withCar = [...items, car];
    const q = decisionProgress(buildTimeline(buildPlan(trip, withCar), legs, withCar), withCar, buildPlan(trip, withCar), decisions, TODAY);
    expect(q.todos.find((t) => t.key === "book:car")).toMatchObject({ kind: "book", note: "rezerve edilmedi · gün belli değil", days: null, soon: false });
  });
});

describe("an idea is never a booking to make", () => {
  it("a chosen restaurant (even one whose page asks for a table, 0.36.25) or to-do isn't on the 'Rezerve et' list", async () => {
    const { trip, items, decisions, ctx } = await demo();
    const douro = items.find((i) => i.name === "Douro tekne turu")!;
    const idea = (id: string, over: Partial<Item>): Item => ({ ...douro, id, status: "chosen", price: { ...douro.price, amount: null }, cancellation: { summary: null, freeUntil: null, source: "none" }, ...over });
    const more = [
      ...items,
      // A restaurant is never a booking to make (Emre: a table booked is said in the chat).
      idea("cafe", { name: "Majestic Café", category: "food", booking: "none" }),
      idea("market", { name: "Bolhão pazarı", category: "other", plannedKind: "todo" }),
      idea("table", { name: "Belcanto", category: "food", booking: "needed" }),
    ];
    const plan = buildPlan(trip, more);
    const p = decisionProgress(buildTimeline(plan, buildLegs(plan, trip, ctx.listings), more), more, plan, decisions, TODAY);
    const books = p.todos.filter((t) => t.kind === "book").map((t) => t.title);
    expect(books).toContain("Douro tekne turu");
    expect(books).not.toContain("Belcanto");
    expect(books).not.toContain("Majestic Café");
    expect(books).not.toContain("Bolhão pazarı");
  });
});

describe("the next step, as a thing to do", () => {
  const todo = (kind: Todo["kind"], title: string, days: number | null = 3): Todo => ({ key: "k", kind, target: {}, title, note: "", date: null, days, soon: true });
  it("a verb first; a cancellation says when it ends", () => {
    expect(nextStepText(todo("decide", "Porto konaklama · 8–11 Ekim"))).toBe("Karar ver: Porto konaklama · 8–11 Ekim");
    expect(nextStepText(todo("book", "Douro tekne turu"))).toBe("Rezerve et: Douro tekne turu");
    expect(nextStepText(todo("plan", "Varış transferi · 8 Ekim"))).toBe("Planla: Varış transferi · 8 Ekim");
    expect(nextStepText(todo("deadline", "Lisboa Loft", 6))).toBe("Lisboa Loft: ücretsiz iptal 6 gün içinde biter");
    expect(nextStepText(todo("deadline", "Lisboa Loft", 0))).toBe("Lisboa Loft: ücretsiz iptal bugün bitiyor");
  });
});

describe("date alerts", () => {
  const base = (over: Partial<Item>): Item => ({
    id: "x", tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "Jardim", provider: null, summary: "", optionDetail: null,
    url: null, imageUrl: null, city: "Porto", country: null, countryCode: null, location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 285, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "chosen", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  });

  it("says when a free cancellation ends, and when a chosen stay still isn't booked", () => {
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: "2026-10-01", source: "page" } }), TODAY)).toEqual({ tone: "red", text: "Ücretsiz iptal için 2 gün kaldı (1 Ekim)", short: "iptale 2 gün" });
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: TODAY, source: "page" } }), TODAY)?.text).toBe("Ücretsiz iptal bugün bitiyor");
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: "2026-09-01", source: "page" } }), TODAY)).toBeNull(); // over
    expect(dateAlert(base({}), TODAY)).toEqual({ tone: "amber", text: "Rezerve edilmedi · girişe 9 gün", short: "9 gün" });
    expect(dateAlert(base({ dates: { start: "2027-03-01", end: "2027-03-04", source: "url" } }), TODAY)).toBeNull(); // far off
    expect(dateAlert(base({ status: "saved" }), TODAY)).toBeNull();
  });
});

describe("budget bar", () => {
  it("adds up what's booked, what's chosen and the leading option of each open decision", async () => {
    const { items, ctx, decisions, plan } = await demo();
    const bar = budgetBar(plan, items, ctx, decisions);
    expect(bar).toMatchObject({ currency: "EUR", total: 1500, uncounted: 0 });
    expect(bar.booked).toBeGreaterThan(0);
    expect(bar.chosen).toBe(25); // the boat tour
    // Open: the Pegasus flight in, Jardim Stay for Porto, the train to Lisbon.
    const lead = (name: string) => items.find((i) => i.name === name)!;
    expect(bar.open).toBeGreaterThanOrEqual((lead("Jardim Stay").price.amount ?? 0) + (lead("Pegasus · direkt").price.amount ?? 0));
  });
  it("splits what's known by category and adds up to the same total", async () => {
    const { plan, items, ctx, decisions } = await demo();
    const bar = budgetBar(plan, items, ctx, decisions);
    const known = Object.values(bar.byCategory).reduce((a, b) => a + b, 0);
    expect(Math.round(known)).toBe(Math.round(bar.booked + bar.chosen));
    expect(bar.byCategory.stay).toBeGreaterThan(0);
  });
});

describe("sectionAllotments (v11 '€500 ayrıldı')", () => {
  const expected = { flight: 300, stay: 700, transport: 0, activity: 100, other: 0 };
  it("shares the budget out by what each part is likely to cost, to the nearest 10", () => {
    expect(sectionAllotments({ total: 2200, expected })).toEqual({ flight: 600, stay: 1400, transport: 0, activity: 200, other: 0 });
  });
  it("nothing with no budget or nothing priced", () => {
    expect(sectionAllotments({ total: null, expected })).toBeNull();
    expect(sectionAllotments({ total: 1000, expected: { flight: 0, stay: 0, transport: 0, activity: 0, other: 0 } })).toBeNull();
  });
});
