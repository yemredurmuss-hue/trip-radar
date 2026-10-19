// 0.38.2: Emre's Sri Lanka / Ahangama trip, made by the start chat, then shaped in the board's chat ("Bodrum →
// Kolombo, Sri Lanka → Bali"). What went wrong: the start's placeholder flights stayed beside the real ones, a stop
// was named "Rota Yok Sadece Ahangama" and flown to, the trip was called "Ahangama Gezisi", and a Bali stay nobody
// asked for was opened where the flight out lands.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replacedPlaceholders, sendMessage, stayAtExit, systemPrompt, tripState } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { setLang, withLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import {
  acceptExtraction, airportsOf, applyText, creationOf, mergeExtracted, newStart, nextQuestion, parseRouteText, parseStartText, placeholderPrint, tripTitle, withTypedLang,
  type RawExtraction, type StartState,
} from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";

type Block = Anthropic.ContentBlock;
const say = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Block[] });
const use = (name: string, input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: `tu-${Math.random()}`, name, input, caller: { type: "direct" } }] as Block[],
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
const resultOf = (calls: Anthropic.MessageCreateParams[], n: number) => {
  const r = (calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  return { error: r.is_error === true, body: String(r.content) };
};

const T = "lk";
const DATES = { start: "2026-12-01", end: "2026-12-15" };
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, id: string, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, T, id, 1),
  ...over,
});
const plan = (over: Record<string, unknown>) => ({
  kind: "flight", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null,
  replaces: null, item_id: null, provider: null, price: null, currency: null, ...over,
});
/** What the start made: the stay, a flight there whose end is the stop's name (the bug), the flight home. */
const started = () => [
  said({ kind: "stay", city: "Ahangama", date: DATES.start, end_date: DATES.end }, "stay", { countryCode: "LK" }),
  said({ kind: "flight", from: "İstanbul", to: "Rota Yok Sadece Ahangama", date: DATES.start }, "out"),
  said({ kind: "flight", from: "Kolombo", to: "İstanbul", date: DATES.end }, "home"),
];
const tripWith = (items: Item[], placeholders: string[]): Trip => ({
  id: T, title: "Sri Lanka Gezisi", confirmedDates: DATES, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  startGuide: { createdAt: 1, placeholders: Object.fromEntries(items.filter((i) => placeholders.includes(i.id)).map((i) => [i.id, placeholderPrint(i)])) },
});

async function put(trip: Trip, items: Item[]) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", trip);
  for (const i of items) await d.put("items", i);
}

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("a real flight said takes the place of the start's placeholder (item 2)", () => {
  it("trip_state marks the start's placeholders; the prompt says to replace or remove them", () => {
    const items = started();
    const state = JSON.parse(tripState(tripWith(items, ["stay", "out", "home"]), items, []));
    expect(state.items.filter((i: { placeholder?: boolean }) => i.placeholder).map((i: { id: string }) => i.id).sort()).toEqual(["home", "out", "stay"]);
    // Touched (booked) is no placeholder any more.
    const booked = items.map((i) => (i.id === "home" ? { ...i, status: "booked" as const } : i));
    expect(JSON.parse(tripState(tripWith(items, ["home"]), booked, [])).items.find((i: { id: string }) => i.id === "home").placeholder).toBeUndefined();
    expect(systemPrompt()).toMatch(/placeholder true.*replaces.*remove_from_plan/s);
    expect(withLang("en", systemPrompt)).toMatch(/placeholder true.*replaces = its id.*remove_from_plan/s);
  });

  it("Bodrum → Kolombo on the first day: the placeholder flight there leaves the plan (Hidden, undoable); the real flight home stays", async () => {
    const items = started();
    // The flight home is real (the traveller saved it): never closed.
    const real = said({ kind: "flight", from: "Kolombo", to: "İstanbul", date: "2026-12-14" }, "real", { status: "booked" });
    await put(tripWith(items, ["stay", "out", "home"]), [...items, real]);
    const { llm, calls } = fake([use("plan_item", plan({ from: "Bodrum", to: "Kolombo", date: "2026-12-02", booked: true })), say("Ekledim.")]);
    await sendMessage(T, "2 Aralık Bodrum → Kolombo biletimi aldım", llm);
    const r = resultOf(calls, 1);
    expect(r.error).toBe(false);
    expect(JSON.parse(r.body).replaced).toEqual(["Uçuş · İstanbul → Rota Yok Sadece Ahangama"]);
    const after = new Map((await listItems(T)).map((i) => [i.id, i]));
    expect(after.get("out")).toMatchObject({ status: "dismissed", dismissedFrom: "chosen" });
    // 13 days away, and a real one: both stay.
    expect(after.get("home")?.status).toBe("chosen");
    expect(after.get("real")?.status).toBe("booked");
    expect([...after.values()].some((i) => i.category === "flight" && i.flight?.from === "Bodrum" && i.status === "booked")).toBe(true);
  });

  it("only the start's placeholders, for the same people, within 3 days", () => {
    const items = started();
    const trip = tripWith(items, ["out", "home"]);
    const added = said({ kind: "flight", from: "Kolombo", to: "Bali", date: DATES.end }, "bali");
    expect(replacedPlaceholders(added, items, trip).map((i) => i.id)).toEqual(["home"]);
    // Sabine's own flight never closes everyone's.
    expect(replacedPlaceholders({ ...added, forWho: ["Sabine"] }, items, trip)).toEqual([]);
    // Not a placeholder (never kept as one): stays.
    expect(replacedPlaceholders(added, items, tripWith(items, []))).toEqual([]);
    // A stay is no flight.
    expect(replacedPlaceholders(said({ kind: "stay", city: "Bali", date: DATES.end }, "s"), items, trip)).toEqual([]);
  });
});

describe("a stay where the flight out lands is opened only when said (item 6a)", () => {
  const flights = () => [
    said({ kind: "stay", city: "Ahangama", date: DATES.start, end_date: DATES.end }, "stay", { countryCode: "LK" }),
    said({ kind: "flight", from: "Bodrum", to: "Kolombo", date: DATES.start, booked: true }, "in"),
    said({ kind: "flight", from: "Kolombo", to: "Bali", date: DATES.end, booked: true }, "outBali"),
  ];

  it("pure: undated or from the last day on, at the last flight's end, with no staying said → refused", () => {
    const items = flights();
    const trip = { confirmedDates: DATES };
    const bali = (date: string | null) => said({ kind: "stay", city: "Bali", date, end_date: null }, "b");
    expect(stayAtExit(bali(null), items, trip, "uçuşları ekle")).toMatch(/orada kalacağın söylenmedi; hiçbir şey eklenmedi/);
    expect(stayAtExit(bali("2026-12-15"), items, trip, "uçuşları ekle")).toMatch(/hiçbir şey eklenmedi/);
    expect(stayAtExit(bali(null), items, trip, "Bali'de 3 gece kalacağım")).toBeNull();
    expect(stayAtExit(bali(null), items, trip, "Bali'de otel bakalım")).toBeNull();
    // "kalkış" is no staying.
    expect(stayAtExit(bali(null), items, trip, "Bali uçuşunun kalkışı 10:00")).toMatch(/hiçbir şey eklenmedi/);
    // A night inside the trip, or somewhere the flight out doesn't land: not this guard's.
    expect(stayAtExit(bali("2026-12-10"), items, trip, "")).toBeNull();
    expect(stayAtExit(said({ kind: "stay", city: "Mirissa", date: null }, "m"), items, trip, "")).toBeNull();
    // One flight only: it lands where the trip stays.
    expect(stayAtExit(said({ kind: "stay", city: "Kolombo", date: null }, "k"), items.slice(0, 2), trip, "")).toBeNull();
    setLang("en");
    expect(stayAtExit(bali(null), items, trip, "add the flights")).toMatch(/staying there wasn't said; nothing was added/);
  });

  it("in the chat: 'Bali konaklaması' refused, nothing added; 'Bali'de 3 gece kalacağım' opens it", async () => {
    const items = flights();
    await put(tripWith(items, []), items);
    const first = fake([use("plan_item", plan({ kind: "stay", city: "Bali", title: "Bali konaklaması" })), say("Eklemedim.")]);
    await sendMessage(T, "Bodrum → Kolombo, Sri Lanka → Bali uçuşlarını ekledim", first.llm);
    const refused = resultOf(first.calls, 1);
    expect(refused.error).toBe(true);
    expect(refused.body).toMatch(/orada kalacağın söylenmedi; hiçbir şey eklenmedi/);
    expect((await listItems(T)).filter((i) => i.category === "stay").map((i) => i.city)).toEqual(["Ahangama"]);
    const second = fake([use("plan_item", plan({ kind: "stay", city: "Bali", date: "2026-12-15", end_date: "2026-12-18" })), say("Ekledim.")]);
    await sendMessage(T, "Bali'de 3 gece kalacağım", second.llm);
    expect(resultOf(second.calls, 1).error).toBe(false);
    expect((await listItems(T)).filter((i) => i.category === "stay").map((i) => i.city).sort()).toEqual(["Ahangama", "Bali"]);
  });
});

const TODAY = "2026-10-19";
const raw = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});
/** One typed line as the start chat takes it (startRev2.test.ts). */
function typed(s: StartState, text: string, model: RawExtraction | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(model, TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}

describe("the route typed and the trip's name (items 3, 4)", () => {
  it("'rota yok sadece ahangama 14 gece' is the stop Ahangama; a sentence is no stop", () => {
    const r = parseRouteText("rota yok sadece ahangama 14 gece", 14);
    expect("route" in r && r.route.stops).toEqual([{ city: "Ahangama", nights: 14 }]);
    const only = parseRouteText("Only Ubud 12, just Canggu 19", 31);
    expect("route" in only && only.route.stops.map((x) => x.city)).toEqual(["Ubud", "Canggu"]);
    expect(parseRouteText("Yalnızca Mirissa 5", 5)).toMatchObject({ route: { stops: [{ city: "Mirissa", nights: 5 }] } });
    expect(parseRouteText("galiba en iyisi güneyde kalmak 14", 14)).toHaveProperty("error");
    // Names of up to three words still are.
    expect(parseRouteText("Nuwara Eliya 3, Ella 2", 5)).toMatchObject({ route: { stops: [{ city: "Nuwara Eliya" }, { city: "Ella" }] } });
  });

  it("'Sri Lanka', then 'Ahangama': the title is the country's; the stay, the route and the flights' airport (Kolombo) are the town's", () => {
    const s1 = typed(newStart("sl1", "plan", 1), "Sri Lanka'ya 14 gece gitmek istiyoruz", raw({ destination: "Sri Lanka", destination_country: "Sri Lanka", destination_country_code: "LK", duration_days: 14 }));
    expect(s1.where?.place).toBe("Sri Lanka");
    const s2 = typed(s1, "Ahangama", raw({ destination: "Ahangama", destination_country: "Sri Lanka", destination_country_code: "LK" }), 3);
    expect(s2.where).toMatchObject({ place: "Ahangama", code: "LK", within: "Sri Lanka" });
    expect(withLang("tr", () => tripTitle(s2))).toBe("Sri Lanka Gezisi");
    expect(withLang("en", () => tripTitle(s2))).toBe("Sri Lanka trip");
    // The same place said again keeps it.
    expect(typed(s2, "Ahangama", raw({ destination: "Ahangama", destination_country: "Sri Lanka", destination_country_code: "LK" }), 4).where?.within).toBe("Sri Lanka");
    const s3 = { ...s2, from: "Bodrum", start: { date: "2026-12-01", approx: false } };
    const c = withLang("tr", () => creationOf(s3))!;
    expect(c.title).toBe("Sri Lanka Gezisi");
    expect(c.stays.map((x) => x.city)).toEqual(["Ahangama"]);
    expect(c.travel.map((x) => `${x.from}→${x.to}`)).toEqual(["Bodrum→Kolombo", "Kolombo→Bodrum"]);
  });

  it("a stop with no airport of its own flies to the country's (Sri Lanka → Kolombo), never to the stop's name", () => {
    const route = parseRouteText("rota yok sadece ahangama 14 gece", 14);
    if (!("route" in route)) throw new Error(route.error);
    const base = { ...newStart("sl2", "plan", 1), route: route.route, duration: { unit: "day" as const, n: 14 } };
    const town = { ...base, where: { place: "Ahangama", country: "Sri Lanka", code: "LK", within: "Sri Lanka" } };
    expect(withLang("tr", () => airportsOf(town))).toEqual({ arrive: "Kolombo", leave: "Kolombo" });
    // Narrowed without the country kept (an older draft): the country's name still finds it.
    expect(withLang("tr", () => airportsOf({ ...town, where: { place: "Ahangama", country: "Sri Lanka", code: "LK" } }))).toEqual({ arrive: "Kolombo", leave: "Kolombo" });
    expect(withLang("en", () => airportsOf({ ...base, where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" } }))).toEqual({ arrive: "Colombo", leave: "Colombo" });
  });
});
