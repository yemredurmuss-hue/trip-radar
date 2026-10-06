// A booking said in the chat for something already on the plan updates that record, never a second one
// ("10 GB aldım" with an eSIM on the plan: Emre, 0.36.26). The record keeps its id, files, owners and links;
// several that could be meant are asked about; something else bought in its place takes it off the plan.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { setItemStatus } from "../src/app/actions";
import { categorize } from "../src/lib/categories";
import { cardKind } from "../src/lib/cardKinds";
import { mediaFace } from "../src/lib/cardView";
import { bookingCandidates, countryOfPlace, esimPackage } from "../src/lib/chatBooking";
import { db, listItems, listMessages } from "../src/lib/db";
import { addDoc, listDocMeta } from "../src/lib/docs";
import { setLang } from "../src/lib/i18n";
import { buildLegs } from "../src/lib/legs";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { buildPlan } from "../src/lib/plan";
import { plannedInput, plannedItem, type PlannedInput } from "../src/lib/planned";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

type Block = Anthropic.ContentBlock;
const say = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Block[] });
const use = (...calls: { name: string; input: unknown }[]): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: calls.map((c, i) => ({ type: "tool_use", id: `tu${i}-${Math.random()}`, name: c.name, input: c.input, caller: { type: "direct" } })) as Block[],
});
function fake(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { llm: anthropicProvider(client, "claude-opus-5"), calls };
}
const resultsOf = (calls: Anthropic.MessageCreateParams[], n: number) => calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
const resultText = (calls: Anthropic.MessageCreateParams[], n: number) => String(resultsOf(calls, n)[0].content);

const T = "trip";
const trip: Trip = { id: T, title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const hotel = () =>
  makeItem({ id: "opo", tripId: T, category: "stay", needKey: "stay:porto", name: "OPO Vale Formoso", city: "Porto", country: "Portugal", countryCode: "PT", status: "booked", captureIds: ["c"], dates: { start: "2026-10-08", end: "2026-10-14", source: "page" } });
let n = 0;
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, T, `p${++n}`, n),
  ...over,
});
/** plan_item's full input, as a schema-bound model sends it. */
const plan = (over: Record<string, unknown>) => ({
  kind: "esim", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null,
  replaces: null, item_id: null, provider: null, price: null, currency: null, ...over,
});

async function put(items: Item[]) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", trip);
  for (const i of items) await d.put("items", i);
}
const all = () => listItems(T);
const sectionOf = (items: Item[], id: string) => {
  const p = buildPlan(trip, items);
  const legs = buildLegs(p, trip);
  return categorize({ plan: p, timeline: buildTimeline(p, legs, items), items, legs, today: "2026-10-01" }).find((s) => s.id === id)!;
};

beforeEach(() => setLang("en"));
afterEach(() => setLang("tr"));

describe("the eSIM already on the plan: '10 GB aldım' (the report)", () => {
  // As on Emre's board: the eSIM was planned in Porto, marked bought and installed on the board, with Sabine's name.
  const esim = () => said({ kind: "esim", city: "Porto" }, { id: "esim", status: "booked", installedAt: 5, forWho: ["Sabine"], url: "https://www.airalo.com/portugal" });

  it("what the model did (update_items with the package as a note) puts the package on the card, not only in its note", async () => {
    await put([hotel(), esim()]);
    const { llm } = fake([use({ name: "update_items", input: { changes: [{ item_id: "esim", status: "booked", note: "Bought 10GB eSIM." }] } }), say("Done!")]);
    await sendMessage(T, "10 GB aldım", llm);
    const items = await all();
    const esims = items.filter((i) => cardKind(i) === "esim");
    expect(esims.map((i) => i.id)).toEqual(["esim"]);
    expect(esims[0].metrics?.dataGb).toBe(10);
    expect(mediaFace(esims[0], "esim", null).title).toBe("10 GB · Portugal");
  });

  it("plan_item with the package updates the same record: booked, the title, the country; no second eSIM; files, owners and links kept", async () => {
    await put([hotel(), esim()]);
    await addDoc({ id: "esim", tripId: T }, new File(["%PDF-1.4"], "esim.pdf", { type: "application/pdf" }));
    // The model doesn't pass item_id (and gives the country, not Porto): the code finds the one eSIM.
    const { llm, calls } = fake([use({ name: "plan_item", input: plan({ kind: "esim", title: "10 GB eSIM", city: "Portugal", booked: true }) }), say("I updated the eSIM card: 10 GB.")]);
    await sendMessage(T, "10 GB aldım", llm);
    const items = await all();
    const esims = items.filter((i) => cardKind(i) === "esim");
    expect(esims).toHaveLength(1);
    const e = esims[0];
    expect(e).toMatchObject({ id: "esim", status: "booked", name: "10 GB eSIM", city: "Portugal", country: "Portugal", countryCode: "PT", installedAt: 5, forWho: ["Sabine"], url: "https://www.airalo.com/portugal" });
    expect(e.metrics?.dataGb).toBe(10);
    expect(mediaFace(e, "esim", null).title).toBe("10 GB · Portugal");
    expect((await listDocMeta(T)).map((x) => x.itemId)).toEqual(["esim"]);
    const result = JSON.parse(resultText(calls, 1));
    expect(result).toMatchObject({ updated: "10 GB eSIM", item_id: "esim" });
    expect(result.summary).toBe("I updated the eSIM card: 10 GB eSIM, Portugal");
  });

  it("not under 'No date' on the plan: the Other section's 'Whole trip' row", async () => {
    await put([hotel(), esim()]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "esim", title: "10 GB eSIM", booked: true }) }), say("Done.")]);
    await sendMessage(T, "10 GB aldım", llm);
    const other = sectionOf(await all(), "other");
    const row = other.days.find((d) => d.entries.some((e) => e.itemIds.includes("esim")))!;
    expect(row).toMatchObject({ whole: true, date: null, city: null });
    expect(other.days.filter((d) => !d.date && !d.whole)).toEqual([]);
  });

  it("'Airalo'dan 5 GB eSIM aldım, 12 €': the shop and the price on the planned eSIM", async () => {
    await put([hotel(), said({ kind: "esim", city: "Porto" }, { id: "esim" })]);
    const { llm, calls } = fake([use({ name: "plan_item", input: plan({ kind: "esim", title: "5 GB eSIM", provider: "Airalo", price: 12, currency: "€", booked: true }) }), say("ok")]);
    await sendMessage(T, "Airalo'dan 5 GB eSIM aldım, 12 €", llm);
    const esims = (await all()).filter((i) => cardKind(i) === "esim");
    expect(esims).toHaveLength(1);
    expect(esims[0]).toMatchObject({ id: "esim", status: "booked", provider: "Airalo", name: "5 GB eSIM", price: { amount: 12, currency: "EUR", source: "user" } });
    expect(mediaFace(esims[0], "esim", null)).toMatchObject({ title: "5 GB · Portugal", meta: [{ text: "Airalo", kind: "plain" }] });
    expect(JSON.parse(resultText(calls, 1)).summary).toBe("I updated the eSIM card: 5 GB eSIM, Airalo, 12 EUR, Portugal, bought");
  });

  it("a page's eSIM gets the package as its card's correction (a page saved again can't put its own back)", async () => {
    const page = makeItem({ id: "air", tripId: T, category: "esim", needKey: "esim:portugal", name: "Airalo Portugal", provider: "Airalo", captureIds: ["c3"], status: "chosen", countryCode: "PT", country: "Portugal" });
    await put([hotel(), page]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "esim", title: "10 GB eSIM", booked: true, price: 9, currency: "EUR" }) }), say("ok")]);
    await sendMessage(T, "10 GB aldım, 9 euro", llm);
    const [e] = (await all()).filter((i) => cardKind(i) === "esim");
    expect(e).toMatchObject({ id: "air", status: "booked", name: "Airalo Portugal", userEdits: { name: "10 GB eSIM", price: 9 } });
  });
});

describe("other kinds: update, never duplicate", () => {
  it("a planned car hire + 'arabayı kiraladım, Europcar': that hire, booked, the company; no second car", async () => {
    const car = said({ kind: "car_rental", city: "Porto", date: "2026-10-09", end_date: "2026-10-12" }, { id: "car" });
    await put([hotel(), car]);
    const { llm, calls } = fake([use({ name: "plan_item", input: plan({ kind: "car_rental", provider: "Europcar", booked: true }) }), say("ok")]);
    await sendMessage(T, "arabayı kiraladım, Europcar", llm);
    const cars = (await all()).filter((i) => cardKind(i) === "car");
    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({ id: "car", status: "booked", provider: "Europcar", dates: { start: "2026-10-09", end: "2026-10-12" } });
    expect(resultText(calls, 1)).not.toContain("Error");
  });

  it("two stays it could be: nothing changes, the chat asks which, with their names as chips; the answer updates that one", async () => {
    const a = said({ kind: "stay", city: "Porto", date: "2026-10-08", end_date: "2026-10-10" }, { id: "s1" });
    const b = said({ kind: "stay", city: "Porto", date: "2026-10-10", end_date: "2026-10-14" }, { id: "s2" });
    await put([a, b]);
    const ask = fake([
      use({ name: "plan_item", input: plan({ kind: "stay", city: "Porto", title: "Hotel Infante", booked: true }) }),
      say("Which nights is Hotel Infante for?"),
    ]);
    await sendMessage(T, "Porto'da Hotel Infante'yi rezerve ettim", ask.llm);
    expect(resultsOf(ask.calls, 1)[0].is_error).toBe(true);
    expect(resultText(ask.calls, 1)).toContain("s1 = ");
    expect((await all()).map((i) => [i.id, i.status, i.name])).toEqual([
      ["s1", "chosen", a.name],
      ["s2", "chosen", b.name],
    ]);
    const reply = (await listMessages(T)).filter((m) => m.role === "assistant").at(-1)!;
    expect(reply.choices).toHaveLength(2);
    expect(reply.choices[0]).toContain("Porto");

    const pick = fake([use({ name: "plan_item", input: plan({ kind: "stay", title: "Hotel Infante", booked: true, item_id: "s2" }) }), say("ok")]);
    await sendMessage(T, reply.choices[1], pick.llm);
    const after = new Map((await all()).map((i) => [i.id, i]));
    expect(after.size).toBe(2);
    expect(after.get("s2")).toMatchObject({ status: "booked", name: "Hotel Infante", city: "Porto", dates: { start: "2026-10-10", end: "2026-10-14" } });
    expect(after.get("s1")!.status).toBe("chosen");
  });

  it("'tekne turu yerine parti teknesini aldım': the party boat is added, the tour leaves the plan (Hidden) and comes back with Geri al", async () => {
    const tour = said({ kind: "activity", title: "Douro tekne turu", city: "Porto", date: "2026-10-09" }, { id: "tour" });
    await put([hotel(), tour]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "activity", title: "River Party teknesi", city: "Porto", date: "2026-10-09", booked: true, replaces: "tour" }) }), say("ok")]);
    await sendMessage(T, "tekne turu yerine parti teknesini aldım", llm);
    const items = await all();
    const live = items.filter((i) => i.status !== "dismissed" && i.category === "activity");
    expect(live.map((i) => [i.name, i.status])).toEqual([["River Party teknesi", "booked"]]);
    const gone = items.find((i) => i.id === "tour")!;
    expect(gone).toMatchObject({ status: "dismissed", dismissedFrom: "chosen", name: "Douro tekne turu" });
    expect(sectionOf(items, "activity").hidden.map((h) => h.kind === "dismissed" && h.item.id)).toEqual(["tour"]);
    await setItemStatus(gone, "saved");
    expect((await all()).find((i) => i.id === "tour")!.status).toBe("chosen");
  });

  it("…and without replaces: never the tour renamed; the plan closes it ('Replaced by …', 0.36.25's closure covers the chat)", async () => {
    const tour = said({ kind: "activity", title: "Douro tekne turu", city: "Porto", date: "2026-10-09" }, { id: "tour" });
    await put([hotel(), tour]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "activity", title: "River Party teknesi", city: "Porto", date: "2026-10-09", booked: true }) }), say("ok")]);
    await sendMessage(T, "parti teknesini aldım", llm);
    const items = await all();
    expect(items.find((i) => i.id === "tour")).toMatchObject({ name: "Douro tekne turu", status: "chosen" });
    const closed = buildPlan(trip, items).closed;
    expect(closed.map((c) => [c.item.id, c.reason])).toEqual([["tour", "Replaced by River Party teknesi"]]);
  });

  it("the tour itself bought ('tekne turunu aldım') is that tour, booked", async () => {
    const tour = said({ kind: "activity", title: "Douro tekne turu", city: "Porto", date: "2026-10-09" }, { id: "tour" });
    await put([hotel(), tour]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "activity", title: "Douro tekne turu", city: "Porto", booked: true, price: 35, currency: "EUR" }) }), say("ok")]);
    await sendMessage(T, "tekne turunu aldım, 35 euro", llm);
    const acts = (await all()).filter((i) => i.category === "activity");
    expect(acts.map((i) => [i.id, i.status, i.price.amount])).toEqual([["tour", "booked", 35]]);
  });
});

describe("the matching itself", () => {
  const input = (over: Partial<PlannedInput>) => plannedInput({ kind: "esim", booked: true, ...over });
  const none = { provider: null, price: null, currency: null };

  it("an eSIM's place is its country, never the first city", () => {
    expect(countryOfPlace("Porto")).toEqual({ name: "Portugal", code: "PT" });
    setLang("tr");
    expect(countryOfPlace("Porto")).toEqual({ name: "Portekiz", code: "PT" });
    expect(countryOfPlace("Portekiz")).toEqual({ name: "Portekiz", code: "PT" });
  });

  it("a new eSIM said in the chat is put in its country", async () => {
    await put([hotel()]);
    const { llm } = fake([use({ name: "plan_item", input: plan({ kind: "esim", city: "Porto" }) }), say("ok")]);
    await sendMessage(T, "eSIM alalım", llm);
    const [e] = (await all()).filter((i) => i.category === "esim");
    expect(e).toMatchObject({ city: "Portugal", country: "Portugal", countryCode: "PT" });
  });

  it("an eSIM per country: one in Spain is not the Portuguese one", () => {
    const pt = said({ kind: "esim", city: "Portugal" }, { id: "pt", countryCode: "PT" });
    const es = said({ kind: "esim", city: "Spain" }, { id: "es", countryCode: "ES" });
    expect(bookingCandidates(input({ city: "Porto" }), none, [pt, es], T).map((i) => i.id)).toEqual(["pt"]);
    expect(bookingCandidates(input({}), none, [pt, es], T).map((i) => i.id)).toEqual(["pt", "es"]);
  });

  it("another day, another city, a ruled-out record or another kind is not the same thing", () => {
    const car = said({ kind: "car_rental", city: "Porto", date: "2026-10-09", end_date: "2026-10-12" }, { id: "car" });
    const old = said({ kind: "car_rental", city: "Porto" }, { id: "old", status: "dismissed" });
    const stay = said({ kind: "stay", city: "Porto" }, { id: "stay" });
    const items = [car, old, stay];
    const rent = (over: Partial<PlannedInput>) => bookingCandidates(plannedInput({ kind: "car_rental", booked: true, ...over }), none, items, T).map((i) => i.id);
    expect(rent({})).toEqual(["car"]);
    expect(rent({ city: "Lisbon" })).toEqual([]);
    expect(rent({ city: "Porto", date: "2026-10-13", end_date: "2026-10-14" })).toEqual([]);
    expect(rent({ city: "Porto", date: "2026-10-10", end_date: "2026-10-11" })).toEqual(["car"]);
  });

  it("reads the package: '10 GB', '5GB', 'sınırsız', '30 gün'", () => {
    expect(esimPackage("Bought 10GB eSIM.")).toEqual({ dataGb: 10, unlimited: false, days: null });
    expect(esimPackage("Sınırsız, 30 gün")).toEqual({ dataGb: null, unlimited: true, days: 30 });
    expect(esimPackage("3,5 GB")).toMatchObject({ dataGb: 3.5 });
  });
});
