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
import { budgetBar, dateAlert, decisionProgress } from "../src/lib/progress";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";

const TODAY = "2026-09-29";

async function demo() {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx, decisions } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
  return { trip, items, ctx, decisions, plan, timeline };
}

describe("decision queue", () => {
  it("lists what's still open in date order, the near ones marked, with the leading option", async () => {
    const { items, decisions, plan, timeline } = await demo();
    const p = decisionProgress(timeline, items, plan, decisions, TODAY);
    expect([p.made, p.total]).toEqual([2, 5]);
    expect(p.open.map((o) => [o.title, o.note, o.days, o.soon])).toEqual([
      ["Varış · 8 Ekim", "2 seçenek · Pegasus · direkt önde", 9, true],
      ["Porto konaklama · 8–11 Ekim", "3 seçenek · Jardim Stay önde", 9, true],
      ["Porto → Lizbon · 11 Ekim", "kayıtlı: CP Alfa Pendular · Porto → Lizbon", 12, true],
    ]);
    // Each one points at its place on the line.
    for (const o of p.open) expect(timeline.entries.some((e) => e.key === o.target)).toBe(true);
  });

  it("reminds of free cancellations running out first, then what's chosen but not booked", async () => {
    const { items, decisions, plan, timeline } = await demo();
    const p = decisionProgress(timeline, items, plan, decisions, TODAY);
    expect(p.reminders.map((r) => [r.tone, r.text])).toEqual([
      ["red", "Lisboa Loft: ücretsiz iptal için 6 gün kaldı (5 Ekim)"],
      ["red", "TAP · Lizbon → İstanbul: ücretsiz iptal için 6 gün kaldı (5 Ekim)"],
      ["amber", "Douro tekne turu: bilet alınmadı · etkinliğe 10 gün · ücretsiz iptalli, şimdi ayırmak risksiz"],
    ]);
    // Far from the dates, nothing nags.
    expect(decisionProgress(timeline, items, plan, decisions, "2026-06-01").reminders).toEqual([]);
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
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: "2026-10-01", source: "page" } }), TODAY)).toEqual({ tone: "red", text: "Ücretsiz iptal için 2 gün kaldı (1 Ekim)" });
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: TODAY, source: "page" } }), TODAY)?.text).toBe("Ücretsiz iptal bugün bitiyor");
    expect(dateAlert(base({ status: "booked", cancellation: { summary: null, freeUntil: "2026-09-01", source: "page" } }), TODAY)).toBeNull(); // over
    expect(dateAlert(base({}), TODAY)).toEqual({ tone: "amber", text: "Rezerve edilmedi · girişe 9 gün" });
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
});
