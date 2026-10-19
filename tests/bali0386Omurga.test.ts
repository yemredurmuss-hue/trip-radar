// 0.38.6 (W2): Emre's Bali start ("Bali'de 1 ay kalırız canggu da sabit sabinle bunu planla", from Bodrum, 1 Aralık –
// 1 Ocak, Canggu only). Picking a pick changes the spine, no second card: the flight the source found (BJV → DPS) is the
// start's Bodrum → Denpasar, one box; the road from the airport starts at Denpasar, not "Bali"; a taxi said for it hides
// the AI's "Havalimanı transferi ayarlayın"; "Uzun dönem motor kiralama" is a motorbike for Canggu's month; a stay chosen
// for most of the start's nights sets that place aside.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addOffer, chooseItem, setItemStatus } from "../src/app/actions";
import { modeOfText } from "../src/lib/cardKinds";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang } from "../src/lib/i18n";
import { collectionsOf, stayPlaceholdersTaken, type IntentInput } from "../src/lib/intents";
import { buildLegs, farEnd } from "../src/lib/legs";
import type { Need, Offer } from "../src/lib/offerSource";
import { buildPlan, cityKeyOf } from "../src/lib/plan";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, applyText, creationOf, isPlaceholder, newStart, parseStartText, type StartState } from "../src/lib/startTrip";
import { arrangedTransfer, shownSuggestions } from "../src/lib/suggestions";
import { ticketFace } from "../src/lib/ticketFrame";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Suggestion, Trip } from "../src/lib/types";

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

/** "Gezimi oluştur" on the real steps: the trip and the start's places (two flights, Canggu's 31 nights). */
async function create(): Promise<Trip> {
  let state = interview();
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  return (await (await db()).get("trips", state.tripId!))!;
}

function board(trip: Trip, items: Item[], suggestions: Suggestion[] = []) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const shown = shownSuggestions(suggestions, [], items, legs);
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx, suggestions: { transport: shown.filter((s) => s.section === "transport") } };
  const all = collectionsOf(input);
  const of = (id: string) => all.find((c) => c.section.id === id)?.intents ?? [];
  return { of, legs, plan, shown };
}

const need: Need = { key: "flight:bodrum:denpasar:2026-12-01", section: "flight", kind: "flight", from: "Bodrum", to: "Denpasar", start: "2026-12-01", adults: 2, fromCode: "BJV", toCode: "DPS" };
const offer: Offer = {
  id: "tk", kind: "flight", title: "Turkish Airlines", url: "https://www.aviasales.com/search/BJV0112DPS2", why: "", source: "Aviasales", fetchedAt: 1, price: 1200, currency: "EUR",
  carrier: "Turkish Airlines", depart: "02:25", arrive: "20:05", fromCode: "BJV", toCode: "DPS", stops: 1,
};
const aiSuggestion = (title: string, template: string, over: Partial<NonNullable<Suggestion["payload"]>> = {}): Suggestion => ({
  key: `ai:transport:${template}:${title}`, section: "transport", kind: "add", title, why: "Canggu'da ulaşım için", source: "ai", template, payload: { city: null, start: "2026-12-01", end: null, title, ...over }, createdAt: 1, state: "open",
});

describe("Emre's Bali: picking changes the spine", () => {
  it("the source's flight (BJV → DPS) is the start's Bodrum → Denpasar: one box, and choosing it leaves one card", async () => {
    expect(cityKeyOf("BJV")).toBe(cityKeyOf("Bodrum"));
    const trip = await create();
    const added = await addOffer(trip.id, offer, need);
    let items = await listItems(trip.id);
    const out = () => board(trip, items).of("flight").filter((i) => i.head.name.startsWith("Bodrum"));
    expect(out()).toHaveLength(1);
    expect(out()[0].itemIds).toContain(added.id);
    await chooseItem(added, items.filter((i) => i.category === "flight"));
    items = await listItems(trip.id);
    const r = board(trip, items);
    const flights = r.of("flight").filter((i) => i.head.name.startsWith("Bodrum"));
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ status: "chosen", itemIds: [added.id] });
    // The start's place said its job is done (Gizlenenler, back if the choice is undone).
    expect(r.plan.closed.map((c) => c.reason)).toContain("Yerine Turkish Airlines geldi");

    // The road from the airport: Denpasar (DPS) → Canggu, never the island's name at its start.
    const arrival = r.legs.find((l) => l.kind === "arrival")!;
    expect(farEnd(arrival)).toEqual({ city: "Denpasar", code: "DPS" });
    const road = r.of("transport").find((i) => i.legKey === arrival.key)!;
    expect(road.head.name).toBe("Denpasar → Canggu");
    expect(road.ticket?.from).toMatchObject({ city: "Denpasar", place: "DPS" });

    // A taxi said for that road: the AI's airport transfer for the same day is not asked again.
    const transfer = aiSuggestion("Havalimanı transferi ayarlayın", "taxi", { city: "Canggu" });
    const open = board(trip, items, [transfer]);
    expect(open.shown.map((s) => s.key)).toEqual([transfer.key]);
    // 0.39.1: while that road is open the AI's transfer is that road's own box (its ends, the landing's hour), not a second, empty one.
    expect(open.of("transport").map((i) => i.key)).not.toContain(`suggestion:${transfer.key}`);
    expect(open.of("transport").filter((i) => i.legKey === arrival.key)).toHaveLength(1);
    const taxi: Trip = { ...trip, legs: { [arrival.key]: { mode: "taxi", booked: false, note: null, updatedAt: 2 } } };
    const sorted = board(taxi, items, [transfer]);
    expect(arrangedTransfer(transfer, sorted.legs)).toMatchObject({ kind: "arrival", date: "2026-12-01" });
    expect(sorted.shown).toEqual([]);
    expect(sorted.of("transport").map((i) => i.key)).not.toContain(`suggestion:${transfer.key}`);
  });

  it("'Uzun dönem motor kiralama' is a motorbike rental for Canggu's month, its ends from the trip", async () => {
    expect(modeOfText("Uzun dönem motor kiralama")).toBe("moto");
    expect(modeOfText("Motorhome kiralama")).toBe("rv");
    expect(modeOfText("Motor boat tour")).not.toBe("moto");
    const trip = await create();
    const items = await listItems(trip.id);
    const s = aiSuggestion("Uzun dönem motor kiralama", "moto");
    const box = board(trip, items, [s]).of("transport").find((i) => i.key === `suggestion:${s.key}`)!;
    expect(box.kind).toBe("moto");
    expect(box.ticket?.art).toBe("motosiklet");
    expect(box.head.parts).toEqual(["1 Aralık – 1 Ocak"]);
    const face = ticketFace(box)!;
    expect(face.from).toMatchObject({ city: "Canggu" });
    expect(face.to).toMatchObject({ city: "1 Ocak", place: "iade" });
    expect(face.mid.top).toBe("31 gün");
  });

  it("a stay chosen for most of the start's nights sets that place aside; one for a few leaves it", async () => {
    const trip = await create();
    const items = await listItems(trip.id);
    const ph = items.find((i) => i.category === "stay")!;
    const villa = (start: string, end: string): Item => ({
      ...ph, id: `villa-${start}-${end}`, name: "Villa Canggu", origin: undefined, plannedKind: undefined, provider: "Airbnb", url: "https://www.airbnb.com/rooms/1", status: "saved", dates: { start, end, source: "url" },
    });
    expect(stayPlaceholdersTaken(villa("2026-12-01", "2026-12-06"), items, trip)).toEqual([]);
    // The whole stay: the plan closes the place itself.
    expect(stayPlaceholdersTaken(villa("2026-12-01", "2027-01-01"), items, trip)).toEqual([]);
    const most = villa("2026-12-02", "2027-01-01");
    expect(stayPlaceholdersTaken(most, items, trip).map((i) => i.id)).toEqual([ph.id]);
    await (await db()).put("items", most);
    await chooseItem(most, [...items, most]);
    const after = await listItems(trip.id);
    expect(after.find((i) => i.id === ph.id)).toMatchObject({ status: "dismissed", dismissedFrom: "chosen" });
    const stays = board(trip, after).of("stay");
    expect(stays.filter((i) => i.status === "chosen").map((i) => i.itemIds)).toEqual([[most.id]]);
  });

  it("that choice undone (back to the options): the place set aside comes back as it was (0.39.0, Emre: evet)", async () => {
    const trip = await create();
    const items = await listItems(trip.id);
    const ph = items.find((i) => i.category === "stay")!;
    const villa = (id: string): Item => ({
      ...ph, id, name: `Villa ${id}`, origin: undefined, plannedKind: undefined, provider: "Airbnb", url: `https://www.airbnb.com/rooms/${id}`, status: "saved", dates: { start: "2026-12-02", end: "2027-01-01", source: "url" },
    });
    const a = villa("a");
    const b = villa("b");
    await (await db()).put("items", a);
    await (await db()).put("items", b);
    await chooseItem(a, [...items, a, b]);
    // Another chosen instead: the place stays aside, now for that one.
    await chooseItem(b, [...items, a, b]);
    expect((await listItems(trip.id)).find((i) => i.id === ph.id)).toMatchObject({ status: "dismissed", replacedBy: "b" });
    await setItemStatus((await listItems(trip.id)).find((i) => i.id === "b")!, "saved");
    expect((await listItems(trip.id)).find((i) => i.id === ph.id)).toMatchObject({ status: "chosen" });
    expect((await listItems(trip.id)).find((i) => i.id === ph.id)?.replacedBy).toBeUndefined();
  });
});
