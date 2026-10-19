// 0.38.7 (V2): Emre's Bali (Bodrum → Bali, Sabin and him, Canggu only; the start made 1 Aralık – 1 Ocak, the chat moved it
// to 10 Aralık – 10 Ocak). "AI'ın önerdiği bir şeyi ekleyince uçuş kartlarının sayısı arttı ... şu an 5 uçuş kartı var":
// each offer added was a box of its own, as its need key (the ends as the chat or the source said them) or its day (the
// 10th, the start's place still on the 1st) was not the start's. The way out is one need: one box, the options under it.
// "Turkish Airlines yazısı geliyor ama logosu gelmiyor": an airline known by its name has its logo, its code chip red.
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addOffer, chooseItem } from "../src/app/actions";
import { CarrierLogo } from "../src/app/plan/v82/OptionRow";
import { airportCityOf } from "../src/lib/airports";
import { airlineCode } from "../src/lib/airlines";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import type { Need, Offer } from "../src/lib/offerSource";
import { buildPlan, flightNeeds } from "../src/lib/plan";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, applyText, creationOf, isPlaceholder, newStart, parseStartText, type StartState } from "../src/lib/startTrip";
import { carrierMark } from "../src/lib/ticketFrame";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

setLang("tr");
const TODAY = "2026-10-19";
const LINE = "Bali'de 1 ay kalırız canggu da sabit sabinle bunu planla";

function interview(): StartState {
  let s = newStart(`s-${Math.random()}`, "plan", 1, "tr");
  s = { ...s, messages: [{ role: "user", text: LINE, at: 1 }] };
  s = applyText(s, LINE, parseStartText(LINE, TODAY, "where"), 2, "where").state;
  s = applyAnswer(s, { q: "from", city: "Bodrum" }, 3);
  s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: false }, 4);
  return applyAnswer(s, { q: "want", styles: ["romantic", "nature"], budget: null }, 5);
}

async function create(): Promise<Trip> {
  let state = interview();
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  return (await (await db()).get("trips", state.tripId!))!;
}

function flights(trip: Trip, items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const intents = collectionsOf(input).find((c) => c.section.id === "flight")?.intents ?? [];
  return { plan, out: intents.filter((i) => i.head.name.startsWith("Bodrum")), intents };
}

// The need each offer came with: the chat's find_offers said "Bali", the row's box "Denpasar", a source only the codes.
const need = (from: string, to: string): Need => ({
  key: `flight:${from}:${to}:2026-12-10`, section: "flight", kind: "flight", from, to, start: "2026-12-10", adults: 2, fromCode: "BJV", toCode: "DPS",
});
const offer = (id: string, carrier: string, over: Partial<Offer> = {}): Offer => ({
  id, kind: "flight", title: carrier, url: `https://www.aviasales.com/search/BJV1012DPS2?${id}`, why: "", source: "Aviasales", fetchedAt: 1, price: 1200, currency: "EUR",
  carrier, depart: "02:25", arrive: "20:05", fromCode: "BJV", toCode: "DPS", stops: 1, ...over,
});

/** The three offers Emre added: TK by the chat (to "Bali"), one via İstanbul by the box (to "Denpasar"), Qatar with no codes. */
async function addThree(trip: Trip) {
  const tk = await addOffer(trip.id, offer("tk", "Turkish Airlines"), need("Bodrum", "Bali"));
  const ist = await addOffer(trip.id, offer("ist", "Turkish Airlines", { url: "https://www.aviasales.com/search/ist", via: "İstanbul" }), need("Bodrum", "Denpasar"));
  const qr = await addOffer(trip.id, offer("qr", "Qatar Airways", { fromCode: null, toCode: null }), need("BJV", "DPS"));
  return { tk, ist, qr };
}

describe("Emre's Bali: one flight out, the offers its options", () => {
  it("an airport said by its code, town or other name is its city's", () => {
    expect(airportCityOf("DPS")).toBe("Bali");
    expect(airportCityOf("Denpasar")).toBe("Bali");
    expect(airportCityOf("BJV")).toBe("Bodrum");
    expect(airportCityOf("Milas")).toBe("Bodrum");
    expect(airportCityOf("Milas-Bodrum")).toBe("Bodrum");
    expect(airportCityOf("Canggu")).toBeNull();
  });

  it("the start's Bodrum → Denpasar on 1 Aralık and three offers on the 10th: one box out, three options under it", async () => {
    const trip = await create();
    const { tk, ist, qr } = await addThree(trip);
    const items = await listItems(trip.id);
    expect(new Set([tk, ist, qr].map((i) => i.needKey)).size).toBe(3);
    const r = flights(trip, items);
    // Two needs: the way out and the way home.
    expect(r.plan.groups.filter((g) => g.category === "flight")).toHaveLength(2);
    expect(r.out).toHaveLength(1);
    expect(r.out[0].options.map((o) => o.id).sort()).toEqual([tk.id, ist.id, qr.id].sort());

    // The logo: Turkish Airlines by its name (no flight number from the source), red; Qatar's too.
    const row = r.out[0].options.find((o) => o.id === tk.id)!;
    expect(carrierMark(row.carrier, row.item)).toEqual({ color: "#c8102e", letter: "TK", code: "TK" });
    const qatar = r.out[0].options.find((o) => o.id === qr.id)!;
    expect(carrierMark(qatar.carrier, qatar.item)?.code).toBe("QR");
    const html = renderToStaticMarkup(<CarrierLogo mark={carrierMark(row.carrier, row.item)} art="illus/ucus.png" />);
    expect(html).toContain('src="https://images.kiwi.com/airlines/64/TK.png"');
  });

  it("the dates moved to 10 Aralık – 10 Ocak: the offers said as Bali, Denpasar and BJV → DPS are one box; choosing one leaves one", async () => {
    const made = await create();
    const trip: Trip = { ...made, confirmedDates: { start: "2026-12-10", end: "2027-01-10" } };
    await (await db()).put("trips", trip);
    // The start's places with the new dates (what moving the dates does to them).
    for (const i of await listItems(trip.id)) {
      const start = i.category === "flight" ? (i.flight?.to === "Bodrum" ? "2027-01-10" : "2026-12-10") : "2026-12-10";
      await (await db()).put("items", { ...i, dates: { ...i.dates, start, end: i.category === "stay" ? "2027-01-10" : i.dates.end } });
    }
    const { tk, ist, qr } = await addThree(trip);
    let items = await listItems(trip.id);
    const r = flights(trip, items);
    expect(r.out).toHaveLength(1);
    expect(r.out[0].options.map((o) => o.id).sort()).toEqual([tk.id, ist.id, qr.id].sort());

    await chooseItem(tk, items.filter((i) => i.category === "flight"));
    items = await listItems(trip.id);
    const after = flights(trip, items);
    expect(after.out).toHaveLength(1);
    expect(after.out[0]).toMatchObject({ status: "chosen" });
    expect(after.out[0].itemIds).toEqual(expect.arrayContaining([tk.id, ist.id, qr.id]));
    expect(after.plan.closed.map((c) => c.reason)).toContain("Yerine Turkish Airlines geldi");
  });

  it("an airline we don't list keeps its letters and no logo (nothing made up)", () => {
    expect(airlineCode("Türk Hava Yolları")).toBe("TK");
    expect(airlineCode("Skyline Air")).toBeNull();
    expect(airlineCode("Skyline Air", "SK 12")).toBe("SK");
    const mark = carrierMark({ brand: { label: "Skyline Air", color: null }, name: "Skyline Air" });
    expect(mark?.code).toBeUndefined();
    expect(renderToStaticMarkup(<CarrierLogo mark={mark} art="illus/ucus.png" />)).not.toContain("kiwi");
  });

  it("only flights settled on for days apart are two needs the same way", async () => {
    const trip = await create();
    const tk = await addOffer(trip.id, offer("tk", "Turkish Airlines"), need("Bodrum", "Bali"));
    const items = await listItems(trip.id);
    const placeholder = items.find((i) => i.category === "flight" && i.flight?.from === "Bodrum")!;
    const byNeed = (list: Item[]) => {
      const m = new Map<string, Item[]>();
      for (const i of list) m.set(i.needKey, [...(m.get(i.needKey) ?? []), i]);
      return m;
    };
    // The start's place and an option 9 days apart: one need, the start's key.
    expect(flightNeeds(byNeed([placeholder, tk]))).toEqual([{ key: placeholder.needKey, items: expect.arrayContaining([placeholder, tk]) }]);
    // Two bookings the same way, ten days apart: two flights, an option joining the nearer.
    const first: Item = { ...tk, id: "b1", status: "booked", dates: { ...tk.dates, start: "2026-12-10" }, flight: { ...tk.flight!, departure: "2026-12-10T02:25" } };
    const second: Item = { ...tk, id: "b2", status: "booked", dates: { ...tk.dates, start: "2026-12-20" }, flight: { ...tk.flight!, departure: "2026-12-20T02:25" } };
    const late: Item = { ...tk, id: "o3", dates: { ...tk.dates, start: "2026-12-18" }, flight: { ...tk.flight!, departure: "2026-12-18T02:25" } };
    const needs = flightNeeds(byNeed([first, second, late]));
    expect(needs.map((n) => n.items.map((i) => i.id))).toEqual([["b1"], ["b2", "o3"]]);
    expect(new Set(needs.map((n) => n.key)).size).toBe(2);
  });
});
