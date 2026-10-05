// The review of the chat fixes (0.35.13): cancel clauses read only up to what comes in their place (D1), the chat
// never hard-deletes (D2, in chatFix.test), campsites aren't campervans (D3), a no / a question / a maybe isn't a
// cancel (D4); the history keeps the cleaned turn, the last step always shows a line, a move given a way since
// loses its hidden key, hiding writes on the trip as stored now, and the reply filter keeps ordinary words.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { cancelledQuestion, pruneStaleMoves, sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { cleanContent, cleanReply } from "../src/lib/replyText";
import type { Item, Trip } from "../src/lib/types";
import { asksForVehicle, checkVehicle, replacedVehicles, vehicleOf, vehicleTypesIn } from "../src/lib/vehicles";
import { makeItem } from "./fixtures/makeItem";

type Block = Anthropic.ContentBlock;
const say = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Block[] });
const use = (...calls: { name: string; input: unknown }[]): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: calls.map((c, i) => ({ type: "tool_use", id: `tu${i}-${Math.random()}`, name: c.name, input: c.input, caller: { type: "direct" } })) as Block[],
});
function fake(responses: Partial<Anthropic.Message>[], before?: () => Promise<void>) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        await before?.();
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { llm: anthropicProvider(client, "claude-opus-5"), calls };
}
const resultsOf = (calls: Anthropic.MessageCreateParams[], n: number) => calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];

const T = "trip";
const trip: Trip = { id: T, title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-18" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const stay = (over: Partial<Item>) => makeItem({ tripId: T, category: "stay", status: "booked", captureIds: ["c"], ...over });
const opo = () => stay({ id: "opo", needKey: "stay:porto", name: "OPO Vale Formoso", city: "Porto", dates: { start: "2026-10-07", end: "2026-10-11", source: "page" } });
const van = (over: Partial<Item> = {}) =>
  stay({ id: "van", needKey: "stay:gaula", name: "Renault Campervan 'Bawhee'", provider: "Indie Campers", city: "Gaula", location: { address: "Gaula, Madeira, Portugal", area: null, approximate: false }, dates: { start: "2026-10-11", end: "2026-10-14", source: "page" }, ...over });
const hotel = () => stay({ id: "fnc", needKey: "stay:madeira", name: "Hotel Madeira", city: "Madeira", dates: { start: "2026-10-14", end: "2026-10-18", source: "page" } });
const sixt = (over: Partial<Item> = {}) =>
  makeItem({ tripId: T, id: "sixt", category: "transport", needKey: "transport:car-madeira", name: "Sixt rent a car Madeira", provider: "Sixt", city: "Madeira", status: "booked", captureIds: ["c2"], dates: { start: "2026-10-11", end: "2026-10-18", source: "page" }, ...over });

async function put(items: Item[], t: Trip = trip) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", t);
  for (const i of items) await d.put("items", i);
}
const stored = async () => new Map((await listItems(T)).map((i) => [i.id, i]));
const lastReply = async () => (await listMessages(T)).filter((m) => m.role === "assistant").at(-1)!;
const MOVE = "2026-10-14:move:gaula>funchal";

beforeEach(async () => {
  await (await db()).clear("messages");
});

describe("D1: a cancel clause is read only up to what comes in its place", () => {
  it("comma-less TR and EN sentences name only the car", () => {
    expect(replacedVehicles("araç kiralamayı iptal ettik yerine karavan kiraladık")).toEqual(["car"]);
    expect(replacedVehicles("Cancelled the car rental so we got a campervan instead")).toEqual(["car"]);
    expect(replacedVehicles("we got a campervan instead because the car rental was cancelled")).toEqual(["car"]);
  });

  it("the campervan just added is never the one the check after the turn asks to remove", () => {
    const added = makeItem({ id: "newvan", category: "transport", plannedKind: "car_rental", origin: "chat", name: "Karavan", status: "booked", dates: { start: "2026-10-11", end: "2026-10-18", source: "unverified" } });
    for (const text of ["araç kiralamayı iptal ettik yerine karavan kiraladık", "Cancelled the car rental so we got a campervan instead"]) {
      expect(cancelledQuestion(text, [added], { removed: new Set(["sixt"]), removedVehicles: new Set(["car" as const]), touched: new Set(["newvan"]) })).toBeNull();
      expect(cancelledQuestion(text, [added], { removed: new Set(), removedVehicles: new Set(), touched: new Set() })).toBeNull();
    }
  });

  it("a campervan page saved before is neither ruled out nor doubled; the car rental goes", async () => {
    const vanPage = van({ id: "vanpage", status: "saved", dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } });
    await put([opo(), sixt(), vanPage]);
    const camper = { name: "plan_item", input: { kind: "car_rental", date: "2026-10-11", end_date: "2026-10-18", time: null, from: null, to: null, city: "Madeira", title: "Karavan", booked: true, note: null, replaces: null } };
    const { llm, calls } = fake([
      use(camper),
      use({ name: "update_items", input: { changes: [{ item_id: "vanpage", status: "booked", note: null }] } }, { name: "remove_from_plan", input: { target_id: "sixt" } }),
      say("Karavanı rezerve olarak işaretledim, araç kiralamayı çıkardım."),
    ]);
    await sendMessage(T, "araç kiralamayı iptal ettik yerine karavan kiraladık", llm);
    const [refused] = resultsOf(calls, 1);
    expect(refused.is_error).toBe(true);
    expect(String(refused.content)).toContain("update_items");
    const items = await stored();
    expect(items.get("vanpage")!.status).toBe("booked");
    expect(items.get("sixt")!.status).toBe("dismissed");
    expect([...items.values()].filter((i) => i.status !== "dismissed" && vehicleOf(i) === "camper")).toHaveLength(1);
    expect((await lastReply()).choices).toEqual([]);
  });
});

describe("D3: a place to park a campervan is not a campervan", () => {
  it("campsites by name aren't; a rented one is", () => {
    for (const name of ["Madeira Motorhome Park", "Camping Karavan Parkı", "Funchal RV Resort", "Wohnmobilstellplatz Funchal"]) {
      expect(vehicleOf(stay({ name, provider: "Booking.com" }))).toBeNull();
    }
    expect(vehicleOf(stay({ name: "Karavan", provider: null }))).toBeNull(); // the word alone
    expect(vehicleOf(van())).toBe("camper"); // Indie Campers
    expect(vehicleOf(stay({ name: "Kiralık karavan · Madeira" }))).toBe("camper");
  });
});

describe("D4: false readings", () => {
  it("a no, a question or a maybe is not a cancel", () => {
    expect(replacedVehicles("araç kiralamayı iptal etmedik, yerine karavan da kiraladık")).toEqual([]);
    expect(replacedVehicles("we didn't cancel the car, we got a campervan instead too")).toEqual([]);
    expect(replacedVehicles("araç kiralamayı iptal edip yerine karavan mı alsak?")).toEqual([]);
    expect(replacedVehicles("should we cancel the car and get a campervan instead?")).toEqual([]);
    expect(replacedVehicles("araç kiralama iptal olursa yerine karavan alırız")).toEqual([]);
    expect(replacedVehicles("if the car rental is cancelled we'll get a campervan instead")).toEqual([]);
  });

  it("'aracılığıyla' is no car; 'araba ile gideceğiz' asks for none", () => {
    expect(vehicleTypesIn("transferi otel aracılığıyla ayarladık").has("car")).toBe(false);
    expect(vehicleTypesIn("aracımızı iptal ettik").has("car")).toBe(true);
    expect(asksForVehicle("araba ile gideceğiz", "car")).toBe(false);
    expect(asksForVehicle("Madeira'da araba kiralarız", "car")).toBe(true);
  });

  it("a campervan said again next to a saved one is that one, unless 'bir de / another'", () => {
    const added = makeItem({ id: "new", category: "transport", plannedKind: "rv_rental", origin: "chat", name: "Karavan", dates: { start: "2026-10-12", end: "2026-10-15", source: "unverified" } });
    const base = { added, same: null, replaces: [], previousReply: null, items: [van()] };
    expect(checkVehicle({ ...base, userText: "karavan kiraladık" }).refusal).toContain("aynı türde");
    expect(checkVehicle({ ...base, userText: "bir de ikinci bir karavan kiraladık" }).refusal).toBeNull();
  });
});

describe("echo, last step, hidden moves, fresh writes, the filter", () => {
  it("the history keeps the cleaned turn, never the echoed state", async () => {
    await put([opo(), van(), hotel()]);
    const echo = '<trip_state>{"trip":{"title":"Porto ve Madeira","dates":null},"plan":{"legs":[]}}</trip_state>';
    const { llm, calls } = fake([say(echo), say("Tamam.")]);
    await sendMessage(T, "selam", llm);
    const assistantTurns = (await listMessages(T)).filter((m) => m.role === "assistant");
    expect(assistantTurns.every((m) => !JSON.stringify(m.content).includes("trip_state"))).toBe(true);
    const sent = calls[1].messages.filter((m) => m.role === "assistant");
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((m) => !JSON.stringify(m.content).includes("trip_state"))).toBe(true);
    expect(cleanContent([{ type: "text", text: echo }, { type: "tool_use", id: "x", name: "y", input: {} }])).toEqual({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
      empty: false,
    });
    expect(cleanContent([{ text: echo }]).empty).toBe(true);
    expect(cleanContent([{ text: "düşünce", thought: true }]).content).toEqual([{ text: "düşünce", thought: true }]);
  });

  it("an echo on the last allowed step still shows a line, never nothing", async () => {
    await put([opo(), van(), hotel()]);
    const echo = '<trip_state>{"trip":{"title":"x"}}</trip_state>';
    const step = () => use({ name: "offer_choices", input: { options: ["a"] } });
    const last: Partial<Anthropic.Message> = { stop_reason: "tool_use", content: [{ type: "text", text: echo, citations: null }, ...(step().content as Block[])] };
    const { llm } = fake([step(), step(), step(), step(), step(), last]);
    await sendMessage(T, "selam", llm);
    const shown = (await listMessages(T)).filter((m) => m.role === "assistant" && m.text.trim());
    expect(shown.map((m) => m.text)).toEqual(["İsteğini işledim ama yanıtımı yazamadım; panodan kontrol eder misin?"]);
  });

  it("a move hidden before and given a way since loses its hidden key for good; an empty one stays hidden", async () => {
    await put([opo(), van(), hotel()], { ...trip, hidden: [`leg:${MOVE}`], legs: { [MOVE]: { mode: "ferry", booked: false, note: null, updatedAt: 1 } } });
    await pruneStaleMoves(T);
    expect((await (await db()).get("trips", T))!.hidden).toEqual([]);
    await put([opo(), van(), hotel()], { ...trip, hidden: [`leg:${MOVE}`] });
    await pruneStaleMoves(T);
    expect((await (await db()).get("trips", T))!.hidden).toEqual([`leg:${MOVE}`]);
  });

  it("hiding keeps a change the board made to the trip during the turn (the write itself is one transaction, changeTrip)", async () => {
    await put([opo(), van(), hotel()]);
    let renamed = false;
    // The board renames the trip while the model is thinking.
    const { llm } = fake([use({ name: "remove_from_plan", input: { target_id: MOVE } }), say("Tamam.")], async () => {
      if (renamed) return;
      renamed = true;
      const d = await db();
      await d.put("trips", { ...(await d.get("trips", T))!, title: "Yeni ad" });
    });
    await sendMessage(T, "gaula madeira'yı kaldır", llm);
    const after = (await (await db()).get("trips", T))!;
    expect([after.title, after.hidden]).toEqual(["Yeni ad", [`leg:${MOVE}`]]);
  });

  it("the filter keeps words after a stray tag and a sentence quoting the state's start", () => {
    expect(cleanReply("Tamam <system> bu bir not").text).toContain("bu bir not");
    expect(cleanReply("<system>internal").text).toBe("");
    expect(cleanReply('Kodda {"trip": { diye başlayan bir veri var.').text).toBe('Kodda {"trip": { diye başlayan bir veri var.');
    const blob = `Tamam. {"trip":{"title":"Porto","dates":null,"budget":null},"preferences":[],"intent":null,"priorities":{},"wanted_amenities":[],"plan":{"nights":[],"stays":[],"legs":[]},"decisions":[],"items":[]}`;
    expect(cleanReply(blob).text).toBe("Tamam.");
  });
});
