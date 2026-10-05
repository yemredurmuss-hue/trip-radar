// The chat's three fixes (0.35.13): the trip state never shown as a reply, "Gaula → Madeira'yı kaldır" really
// removes it (a transfer hidden, a saved record ruled out, all undoable), "X iptal, yerine Y" takes X out, and
// plan_item never adds a second vehicle for days one already covers unless asked for.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { cancelledQuestion, sendMessage, systemPrompt, TOOLS, tripState } from "../src/lib/assistant";
import { setItemStatus, undo } from "../src/app/actions";
import { categorize, hiddenThings } from "../src/lib/categories";
import { db, listItems, listMessages } from "../src/lib/db";
import { buildLegs } from "../src/lib/legs";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { geminiProvider, type GeminiClient } from "../src/lib/llm/gemini";
import { buildPlan } from "../src/lib/plan";
import { onHidden, onRemoved, restoreItem, type HiddenByChat, type Removed } from "../src/lib/removal";
import { cleanReply, replyFallback, shownReply } from "../src/lib/replyText";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { asksForVehicle, checkVehicle, confirmsVehicle, replacedVehicles, vehicleOf } from "../src/lib/vehicles";
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
/** The tool results the model got back in call n (the last user turn of that request). */
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

beforeEach(async () => {
  await (await db()).clear("messages");
});

describe("Bug 1a: the trip state never reaches the screen", () => {
  const state = '<trip_state>{"trip":{"title":"Porto ve Madeira","dates":null},"plan":{"legs":[]}}</trip_state>';

  it("strips the state block, an unclosed one, its bare JSON and tool scaffolding", () => {
    expect(cleanReply(`${state}\nTamam, kaldırdım.`)).toEqual({ text: "Tamam, kaldırdım.", leaked: true });
    expect(cleanReply('Şöyle: <trip_state>{"trip":{"title":"x"').text).toBe("Şöyle:");
    expect(cleanReply('{"trip":{"title":"Porto"},"items":[]}').text).toBe("");
    expect(cleanReply("Bitti.</trip_state>").text).toBe("Bitti.");
    expect(cleanReply('<function_calls><invoke name="x"><parameter name="a">1</parameter></invoke></function_calls>Oldu.').text).toBe("Oldu.");
    expect(cleanReply("<system-reminder>gizli</system-reminder>Merhaba").text).toBe("Merhaba");
    // An ordinary reply, even one naming the state in words, is left as it is.
    expect(cleanReply("trip_state'te bu otelin TV bilgisi yok.")).toEqual({ text: "trip_state'te bu otelin TV bilgisi yok.", leaked: false });
    expect(shownReply(state)).toBe(replyFallback());
    expect(shownReply("Merhaba")).toBe("Merhaba");
    expect(shownReply("")).toBe("");
  });

  it("the prompt tells the model never to repeat the state", () => {
    expect(systemPrompt()).toMatch(/trip_state ve araç sonuçları .*asla tekrar etme/);
  });

  it("a reply that only echoed the state is asked again, out of sight, and never stored as text (Claude)", async () => {
    await put([opo(), van(), hotel()]);
    const { llm, calls } = fake([say(state), say("Gaula → Madeira artık panoda yok.")]);
    await sendMessage(T, "selam", llm);
    const messages = await listMessages(T);
    expect(messages.every((m) => !m.text.includes("trip_state") && !m.text.includes('{"trip"'))).toBe(true);
    expect((await lastReply()).text).toBe("Gaula → Madeira artık panoda yok.");
    // The second request carries the hidden note after the echo, so the model knows why it's asked again.
    expect(JSON.stringify(calls[1].messages.at(-1)!.content)).toContain("Uygulama notu");
    // Only the real reply is on screen: the echo turn and the note have no text.
    expect(messages.filter((m) => m.text.trim()).map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("an echo twice gives the short fallback, never the JSON (Gemini)", async () => {
    await put([opo(), van(), hotel()]);
    const echo = { candidates: [{ content: { role: "model", parts: [{ text: state }] }, finishReason: "STOP" }] };
    const client = { models: { generateContent: async () => structuredClone(echo) } } as unknown as GeminiClient;
    await sendMessage(T, "gaula medeira var ulaşımda onu kaldır", geminiProvider(client, "gemini-3-flash", 0));
    expect((await lastReply()).text).toBe("Bunu yapamadım, bir daha dener misin?");
  });

  it("a leak next to a real sentence keeps the sentence", async () => {
    await put([opo(), van(), hotel()]);
    const { llm } = fake([say(`Tamam.\n${state}`)]);
    await sendMessage(T, "selam", llm);
    expect((await lastReply()).text).toBe("Tamam.");
  });
});

describe("Bug 1b: 'Gaula → Madeira' in Ulaşım can be removed", () => {
  const MOVE = "2026-10-14:move:gaula>funchal";

  it("is a change of city between two places on Madeira, sent to the model with its board name and can_hide", async () => {
    await put([opo(), van(), hotel()]);
    const items = await listItems(T);
    const legs = buildLegs(buildPlan(trip, items), trip);
    expect(legs.map((l) => l.key)).toContain(MOVE);
    const state = JSON.parse(tripState(trip, items, []));
    const leg = state.plan.legs.find((l: { key: string }) => l.key === MOVE);
    expect(leg).toMatchObject({ kind: "move", cities: "Gaula → Madeira", can_hide: true, hidden: false });
    // The board's Ulaşım shows it by that name.
    const plan = buildPlan(trip, items);
    const transport = categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs }).find((s) => s.id === "transport")!;
    expect(transport.entries.map((e) => e.row.name)).toContain("Gaula → Madeira");
  });

  it("remove_from_plan hides it like 'Gerek yok'; it waits under Gizlenenler and 'Geri al' brings it back", async () => {
    await put([opo(), van(), hotel()]);
    const toasts: HiddenByChat[] = [];
    const stop = onHidden((h) => toasts.push(h));
    const { llm, calls } = fake([use({ name: "remove_from_plan", input: { target_id: MOVE } }), say("Gaula → Madeira'yı kaldırdım.")]);
    await sendMessage(T, "gaula medeira var ulaşımda onu kaldır", llm);
    stop();
    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBeFalsy();
    expect(JSON.parse(String(result.content))).toMatchObject({ hidden: MOVE, shown_as: "Gaula → Madeira" });
    const after = (await (await db()).get("trips", T))!;
    expect(after.hidden).toEqual([`leg:${MOVE}`]);

    const items = await listItems(T);
    const plan = buildPlan(after, items);
    const legs = buildLegs(plan, after);
    const hidden = new Set(after.hidden);
    const timeline = buildTimeline(plan, legs, items, hidden);
    const transport = categorize({ plan, timeline, items, legs, hidden }).find((s) => s.id === "transport")!;
    expect(transport.entries.map((e) => e.row.name)).not.toContain("Gaula → Madeira");
    expect(hiddenThings({ plan, timeline, items, legs, hidden }).map((h) => h.key)).toContain(`leg:${MOVE}`);
    // Nothing saved went missing: every stay is still on the line.
    expect(timeline.entries.filter((e) => e.kind === "stay")).toHaveLength(3);

    // The board's "Geri al" (the toast the chat announced) restores it.
    expect(toasts).toEqual([{ tripId: T, key: `leg:${MOVE}`, label: "Gaula → Madeira" }]);
    await undo({ kind: "hidden", ...toasts[0] });
    expect((await (await db()).get("trips", T))!.hidden).toEqual([]);
  });

  it("set_leg mode none works on it too (it threw 'a change of city can't be hidden' before)", async () => {
    await put([opo(), van(), hotel()]);
    const { llm, calls } = fake([use({ name: "set_leg", input: { leg_key: MOVE, mode: "none", booked: null, note: null } }), say("Tamam.")]);
    await sendMessage(T, "o transfere gerek yok", llm);
    expect(resultsOf(calls, 1)[0].is_error).toBeFalsy();
    expect((await (await db()).get("trips", T))!.hidden).toEqual([`leg:${MOVE}`]);
  });

  it("a change of city with a flight saved for it is refused truthfully and nothing changes", async () => {
    const flight = makeItem({ tripId: T, id: "fl", category: "flight", needKey: "flight:opo-fnc", name: "TAP OPO → FNC", status: "booked", flight: { from: "OPO", to: "Gaula", departure: "2026-10-11T09:00", arrival: "2026-10-11T11:00", carrier: "TAP", flightNumber: null, stops: 0 }, dates: { start: "2026-10-11", end: null, source: "page" } });
    await put([opo(), van(), hotel(), flight]);
    const legs = buildLegs(buildPlan(trip, await listItems(T)), trip);
    const withFlight = legs.find((l) => l.kind === "move" && l.travel)!;
    const { llm, calls } = fake([use({ name: "remove_from_plan", input: { target_id: withFlight.key } }), say("Kaldıramadım.")]);
    await sendMessage(T, "porto gaula geçişini kaldır", llm);
    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBe(true);
    expect(String(result.content)).toContain("gizlenmedi");
    expect(String(result.content)).toContain("TAP OPO → FNC");
    expect((await (await db()).get("trips", T))!.hidden ?? []).toEqual([]);
  });

  it("an unknown target is an error that lists the transfers, and nothing is removed", async () => {
    await put([opo(), van(), hotel()]);
    const { llm, calls } = fake([use({ name: "remove_from_plan", input: { target_id: "gaula-madeira" } }), say("Bulamadım.")]);
    await sendMessage(T, "gaula madeira'yı kaldır", llm);
    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBe(true);
    expect(String(result.content)).toContain(`${MOVE} = Gaula → Madeira`);
    expect((await stored()).size).toBe(3);
  });

  it("a saved transport record is ruled out (Gizlenenler, 'Geri al'); one said in the chat is deleted with 'Geri al'", async () => {
    const page = makeItem({ tripId: T, id: "tr", category: "transport", needKey: "transport:gaula-madeira", name: "Gaula → Madeira transfer", city: "Madeira", status: "chosen", captureIds: ["c3"], dates: { start: "2026-10-14", end: null, source: "page" } });
    const said = makeItem({ tripId: T, id: "taxi", category: "transport", needKey: "transport:x-madeira", name: "Taksi · Madeira", city: "Madeira", status: "chosen", origin: "chat", plannedKind: "taxi", dates: { start: "2026-10-14", end: null, source: "unverified" } });
    await put([opo(), van(), hotel(), page, said]);
    const removed: Removed[] = [];
    const stop = onRemoved((r) => removed.push(r));
    const { llm, calls } = fake([use({ name: "remove_from_plan", input: { target_id: "tr" } }, { name: "remove_from_plan", input: { target_id: "taxi" } }), say("İkisini de kaldırdım.")]);
    await sendMessage(T, "ulaşımdaki gaula madeira transferini ve taksiyi kaldır", llm);
    stop();
    const results = resultsOf(calls, 1);
    expect(results.map((r) => r.is_error ?? false)).toEqual([false, false]);
    expect(results.map((r) => JSON.parse(String(r.content)).how)).toEqual(["dismissed", "deleted"]);
    let items = await stored();
    expect(items.get("tr")!.status).toBe("dismissed");
    expect(items.has("taxi")).toBe(false);
    // Undo both: the ruled-out one back to the options, the deleted one restored.
    await setItemStatus(items.get("tr")!, "saved");
    await restoreItem(removed[0]);
    items = await stored();
    expect(items.get("tr")!.status).toBe("saved");
    expect(items.get("taxi")!.status).toBe("chosen");
  });

  it("the tool fits the strict schema budget and is in both languages' tool lists", () => {
    const tool = TOOLS.find((t) => t.name === "remove_from_plan")!;
    expect(tool.schema).toMatchObject({ required: ["target_id"], additionalProperties: false });
    expect((TOOLS.find((t) => t.name === "plan_item")!.schema as { required: string[] }).required).toContain("replaces");
  });
});

describe("vehicles (pure)", () => {
  it("tells a car, a campervan and a motorbike; a bike and a taxi are not vehicles for days", () => {
    expect(vehicleOf(sixt())).toBe("car");
    expect(vehicleOf(van())).toBe("camper");
    expect(vehicleOf(hotel())).toBeNull();
    expect(vehicleOf(makeItem({ category: "transport", plannedKind: "car_rental", name: "Karavan", origin: "chat" }))).toBe("camper");
    expect(vehicleOf(makeItem({ category: "transport", plannedKind: "moto_rental", name: "Motosiklet kiralama" }))).toBe("moto");
    expect(vehicleOf(makeItem({ category: "transport", plannedKind: "bike_rental", name: "Bisiklet" }))).toBeNull();
    expect(vehicleOf(makeItem({ category: "transport", plannedKind: "taxi", name: "Taksi" }))).toBeNull();
  });

  it("reads 'X iptal, yerine Y' in Turkish and English", () => {
    expect(replacedVehicles("araç kiralama iptal, yerine karavan kiraladık")).toEqual(["car"]);
    expect(replacedVehicles("The car rental is cancelled, we rented a campervan instead")).toEqual(["car"]);
    expect(replacedVehicles("we cancelled the car and got a motorhome instead")).toEqual(["car"]);
    expect(replacedVehicles("araba yerine karavan kiraladık")).toEqual(["car"]);
    expect(replacedVehicles("karavanı iptal ettik, onun yerine araba kiraladık")).toEqual(["camper"]);
    expect(replacedVehicles("araç kiralama iptal")).toEqual([]); // no "instead": just a cancel, the model removes it
    expect(replacedVehicles("otel iptal, yerine karavan kiraladık")).toEqual([]);
  });

  it("knows an explicit ask from a question or a no", () => {
    expect(asksForVehicle("bir de araba kirala", "car")).toBe(true);
    expect(asksForVehicle("Rent a car as well", "car")).toBe(true);
    expect(asksForVehicle("Madeira'yı planlayalım", "car")).toBe(false);
    expect(asksForVehicle("araba kiralamaya gerek var mı?", "car")).toBe(false);
    expect(asksForVehicle("araba istemiyoruz", "car")).toBe(false);
    expect(asksForVehicle("we don't need a car", "car")).toBe(false);
    expect(confirmsVehicle("evet", "Karavan zaten var; yine de araba ekleyeyim mi?", "car")).toBe(true);
    expect(confirmsVehicle("evet", "Porto'da kaç gece kalıyorsunuz?", "car")).toBe(false);
  });

  it("an overlapping vehicle refuses, other days pass, the one cancelled is replaced only when it is the only one", () => {
    const added = makeItem({ id: "new", category: "transport", plannedKind: "car_rental", origin: "chat", name: "Araç kiralama · Madeira", dates: { start: "2026-10-12", end: "2026-10-15", source: "unverified" } });
    const base = { added, same: null, replaces: [], previousReply: null };
    expect(checkVehicle({ ...base, items: [van()], userText: "Madeira'yı planlayalım" }).refusal).toContain("zaten bir araç var");
    const later = { ...added, dates: { start: "2026-10-18", end: "2026-10-20", source: "unverified" as const } };
    expect(checkVehicle({ ...base, added: later, items: [van()], userText: "Madeira'yı planlayalım" }).refusal).toBeNull();
    const camper = makeItem({ id: "new", category: "transport", plannedKind: "car_rental", origin: "chat", name: "Karavan", dates: { start: "2026-10-11", end: "2026-10-18", source: "unverified" } });
    expect(checkVehicle({ ...base, added: camper, items: [sixt()], userText: "araç kiralama iptal, yerine karavan kiraladık" }).dismiss.map((i) => i.id)).toEqual(["sixt"]);
    const two = checkVehicle({ ...base, added: camper, items: [sixt(), sixt({ id: "avis", name: "Avis rent a car", provider: "Avis" })], userText: "araç kiralama iptal, yerine karavan kiraladık" });
    expect(two.dismiss).toEqual([]);
    expect(two.refusal).toContain("hangisi olduğu belli değil");
  });
});

describe("Bug 2: 'X iptal, yerine Y' takes X out in the same turn", () => {
  const camperPlan = (over: object = {}) => ({
    name: "plan_item",
    input: { kind: "car_rental", date: "2026-10-11", end_date: "2026-10-18", time: null, from: null, to: null, city: "Madeira", title: "Karavan", booked: true, note: null, replaces: null, ...over },
  });

  for (const [lang, text] of [
    ["tr", "araç kiralama iptal, yerine karavan kiraladık"],
    ["en", "the car rental is cancelled, we rented a campervan instead"],
  ] as const) {
    it(`the model only adds Y: the one car rental of those days is ruled out by code (${lang})`, async () => {
      await put([opo(), hotel(), sixt()]);
      const { llm, calls } = fake([use(camperPlan()), say("Karavanı ekledim, araç kiralamayı çıkardım.")]);
      await sendMessage(T, text, llm);
      const [result] = resultsOf(calls, 1);
      expect(result.is_error).toBeFalsy();
      expect(JSON.parse(String(result.content)).replaced).toEqual(["Sixt rent a car Madeira"]);
      const items = [...(await stored()).values()];
      expect(items.find((i) => i.id === "sixt")!.status).toBe("dismissed");
      expect(items.filter((i) => i.name === "Karavan" && i.status === "booked")).toHaveLength(1);
      // No question added: nothing was left behind.
      expect((await lastReply()).choices).toEqual([]);
    });
  }

  it("replaces given by the model removes that record (and a chat plan is deleted with 'Geri al')", async () => {
    const said = sixt({ id: "car", name: "Araç kiralama · Madeira", origin: "chat", plannedKind: "car_rental", provider: null, captureIds: [], status: "chosen", dates: { start: "2026-10-11", end: "2026-10-16", source: "unverified" } });
    await put([opo(), hotel(), said]);
    const removed: Removed[] = [];
    const stop = onRemoved((r) => removed.push(r));
    const { llm, calls } = fake([use(camperPlan({ replaces: "car", kind: "stay", title: "Karavan", date: "2026-10-11", end_date: "2026-10-18" })), say("Tamam.")]);
    await sendMessage(T, "arabadan vazgeçtik, karavan aldık", llm);
    stop();
    expect(resultsOf(calls, 1)[0].is_error).toBeFalsy();
    expect((await stored()).has("car")).toBe(false);
    expect(removed.map((r) => r.item.id)).toEqual(["car"]);
    await restoreItem(removed[0]);
    expect((await stored()).has("car")).toBe(true);
  });

  it("two car rentals for those days: nothing changes and the model is told to ask which", async () => {
    await put([opo(), hotel(), sixt(), sixt({ id: "avis", name: "Avis rent a car", provider: "Avis" })]);
    const { llm, calls } = fake([use(camperPlan()), say("Hangisi iptal oldu: Sixt mi Avis mi?")]);
    await sendMessage(T, "araç kiralama iptal, yerine karavan kiraladık", llm);
    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBe(true);
    const items = await stored();
    expect([items.get("sixt")!.status, items.get("avis")!.status]).toEqual(["booked", "booked"]);
    expect([...items.values()].some((i) => i.name === "Karavan")).toBe(false);
  });

  it("the model forgets X altogether: the reply asks about it, with buttons, instead of guessing", async () => {
    const page = van({ id: "vanpage", status: "saved", dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } });
    await put([opo(), sixt(), page]);
    const { llm } = fake([use({ name: "update_items", input: { changes: [{ item_id: "vanpage", status: "booked", note: null }] } }), say("Karavanı rezerve olarak işaretledim.")]);
    await sendMessage(T, "araç kiralama iptal, yerine karavan kiraladık", llm);
    const reply = await lastReply();
    expect(reply.text).toContain("Sixt rent a car Madeira hâlâ planda");
    expect(reply.choices).toEqual(["Evet, Sixt rent a car Madeira kaldır", "Hayır, kalsın"]);
    // The question is in the model's own turn, so "Evet" next time answers it.
    expect(JSON.stringify(reply.content)).toContain("hâlâ planda");
    expect((await stored()).get("sixt")!.status).toBe("booked");
  });

  it("the check after the turn is quiet when X was removed or when nothing was said cancelled", () => {
    const turn = { removed: new Set<string>(), removedVehicles: new Set<"car">() };
    expect(cancelledQuestion("karavan kiraladık", [sixt()], turn)).toBeNull();
    expect(cancelledQuestion("araç kiralama iptal, yerine karavan kiraladık", [sixt()], { ...turn, removedVehicles: new Set(["car" as const]) })).toBeNull();
    expect(cancelledQuestion("araç kiralama iptal, yerine karavan kiraladık", [sixt({ status: "dismissed" })], turn)).toBeNull();
  });
});

describe("Bug 3: no second vehicle for days one already covers unless asked", () => {
  const carPlan = (date: string, end: string) => ({
    name: "plan_item",
    input: { kind: "car_rental", date, end_date: end, time: null, from: null, to: null, city: "Madeira", title: null, booked: false, note: null, replaces: null },
  });

  it("refused with a question when a campervan covers those days; nothing is added", async () => {
    await put([opo(), van({ dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } })]);
    const { llm, calls } = fake([use(carPlan("2026-10-12", "2026-10-15")), say("Karavanınız zaten var; yine de araba ekleyeyim mi?")]);
    await sendMessage(T, "Madeira'yı planlayalım", llm);
    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBe(true);
    expect(String(result.content)).toContain("Renault Campervan 'Bawhee'");
    expect(String(result.content)).toContain("sor");
    expect([...(await stored()).values()].some((i) => i.plannedKind === "car_rental")).toBe(false);
  });

  it("allowed on days the campervan doesn't cover", async () => {
    await put([opo(), van()]);
    const { llm, calls } = fake([use(carPlan("2026-10-14", "2026-10-18")), say("Ekledim.")]);
    await sendMessage(T, "Madeira'yı planlayalım", llm);
    expect(resultsOf(calls, 1)[0].is_error).toBeFalsy();
    expect([...(await stored()).values()].filter((i) => i.plannedKind === "car_rental")).toHaveLength(1);
  });

  for (const text of ["bir de araba kirala", "rent a car as well"]) {
    it(`allowed when asked for in this message: "${text}"`, async () => {
      await put([opo(), van({ dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } })]);
      const { llm, calls } = fake([use(carPlan("2026-10-12", "2026-10-15")), say("Ekledim.")]);
      await sendMessage(T, text, llm);
      expect(resultsOf(calls, 1)[0].is_error).toBeFalsy();
      expect([...(await stored()).values()].filter((i) => i.plannedKind === "car_rental")).toHaveLength(1);
    });
  }

  it("allowed when the user says yes to the assistant's own question about it", async () => {
    await put([opo(), van({ dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } })]);
    const first = fake([use(carPlan("2026-10-12", "2026-10-15")), say("Karavanınız zaten var; yine de araba ekleyeyim mi?")]);
    await sendMessage(T, "Madeira'yı planlayalım", first.llm);
    const second = fake([use(carPlan("2026-10-12", "2026-10-15")), say("Ekledim.")]);
    await sendMessage(T, "evet", second.llm);
    expect(resultsOf(second.calls, 1)[0].is_error).toBeFalsy();
    expect([...(await stored()).values()].filter((i) => i.plannedKind === "car_rental")).toHaveLength(1);
  });

  it("the prompt says never to add bookable things the user didn't ask for", () => {
    expect(systemPrompt()).toContain("Kullanıcının istemediği rezervasyonlu bir şeyi");
  });
});
