// Kişiye özel rezervasyon (spec 2026-10-06): only the exception is marked ("Sabine'in bileti", always by name), a
// plan for everyone or on a one-person trip shows nothing; the Turkish genitive; who a document or a flight is for,
// never guessed; renaming and removing people; the chat's set_travellers `from` and set_owner, and their undo.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeTravellers, setOwner } from "../src/app/actions";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { placeDoc, readDocument, type DocFacts } from "../src/lib/docReader";
import { addTripDoc } from "../src/lib/docs";
import { geminiProvider, type GeminiClient } from "../src/lib/llm/gemini";
import { undoEvent } from "../src/lib/eventUndo";
import { setLang } from "../src/lib/i18n";
import { ablative } from "../src/lib/i18nText";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { applySettings, settingsOf } from "../src/lib/share/settings";
import { diffSettings, lineText } from "../src/lib/share/settingsDiff";
import { flightLinks } from "../src/lib/searchLinks";
import { fromOf, namesChanged, ownersAfter, withTravellers } from "../src/lib/tripSettings";
import { onTripChange, type TripChange } from "../src/lib/tripUndo";
import type { Item, Trip } from "../src/lib/types";
import { firstStop, foldName, genitive, headCountOf, isTripStop, lastStop, ownersByOrigin, ownersFromDoc, peopleOf, restOwners, tripOrigin, whoseLabel, whoseOf } from "../src/lib/whose";
import { nameSaid } from "../src/lib/whoseChat";

const trip = (over: Partial<Trip> = {}): Trip => ({ id: "p1", title: "Porto", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });
const two = trip({ travellers: { names: ["Sabine"] } });
const said = (over: Partial<PlannedInput> & Pick<PlannedInput, "kind">, id: string, tripId = "p1", forWho?: string[]): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over }, tripId, id, 1),
  ...(forWho ? { forWho } : {}),
});

describe("the Turkish genitive", () => {
  it("follows the last vowel heard, with the buffer n after a vowel and an apostrophe", () => {
    const cases: [string, string][] = [
      ["Emre", "Emre'nin"], ["Sabine", "Sabine'in"], ["Ali", "Ali'nin"], ["Mert", "Mert'in"], ["Oğuz", "Oğuz'un"],
      ["Ümüt", "Ümüt'ün"], ["Duru", "Duru'nun"], ["Ayşe", "Ayşe'nin"], ["Can", "Can'ın"],
      // a/ı → ın, o/u → un, e/i → in, ö/ü → ün after a consonant; a name with a surname: the last word decides.
      ["Burak", "Burak'ın"], ["Işıl", "Işıl'ın"], ["Onur", "Onur'un"], ["Selin", "Selin'in"], ["Gül", "Gül'ün"], ["Göktürk", "Göktürk'ün"],
      ["Oya", "Oya'nın"], ["Doğu", "Doğu'nun"], ["Özge", "Özge'nin"], ["Emine", "Emine'nin"], ["Emre Durmuş", "Emre Durmuş'un"],
    ];
    for (const [name, want] of cases) expect(genitive(name)).toBe(want);
  });

  it("labels by kind, several names, and in English", () => {
    expect(whoseLabel(["Sabine"], "ticket")).toBe("Sabine'in bileti");
    expect(whoseLabel(["Emre"], "booking")).toBe("Emre'nin rezervasyonu");
    expect(whoseLabel(["Ali"], null)).toBe("Ali'nin");
    expect(whoseLabel(["Emre", "Ali"], "ticket")).toBe("Emre ve Ali'nin");
    expect(whoseLabel(["Emre", "Ali", "Can"], "ticket")).toBe("Emre, Ali ve Can'ın");
    setLang("en");
    try {
      expect(whoseLabel(["Sabine"], "ticket")).toBe("Sabine's ticket");
      expect(whoseLabel(["Sabine"], "booking")).toBe("Sabine's booking");
      expect(whoseLabel(["Emre", "Ali"], "ticket")).toBe("Emre and Ali's");
    } finally {
      setLang("tr");
    }
  });

  it("says where someone comes from", () => {
    expect(ablative("Alicante")).toBe("Alicante'den");
    expect(ablative("İstanbul")).toBe("İstanbul'dan");
    expect(ablative("Paris")).toBe("Paris'ten");
  });
});

describe("whoseOf: only the exception", () => {
  const ryanair = said({ kind: "flight", from: "Alicante", to: "Porto" }, "f1", "p1", ["sabine"]);
  it("a strict part of the trip's people: by name, in the trip's spelling", () => {
    expect(whoseOf(ryanair, two, "Emre")).toEqual({ names: ["Sabine"], label: "Sabine'in bileti", partial: false });
    const stay = said({ kind: "stay", city: "Porto" }, "s1", "p1", ["Emre"]);
    expect(whoseOf(stay, two, "Emre")?.label).toBe("Emre'nin rezervasyonu");
    const three = trip({ travellers: { names: ["Sabine", "Ali"] } });
    expect(whoseOf({ ...ryanair, forWho: ["Emre", "Ali"] }, three, "Emre")).toEqual({ names: ["Emre", "Ali"], label: "Emre ve Ali'nin", partial: true });
    // A shared trip: me and the people on the share.
    expect(whoseOf(ryanair, trip(), { me: "Emre", members: ["Emre", "Sabine"], shared: true })?.label).toBe("Sabine'in bileti");
  });
  it("nothing for everyone's, for everyone named, for a name not on the trip, or on a one-person trip", () => {
    expect(whoseOf({ ...ryanair, forWho: undefined }, two, "Emre")).toBeNull();
    expect(whoseOf({ ...ryanair, forWho: [] }, two, "Emre")).toBeNull();
    expect(whoseOf({ ...ryanair, forWho: ["Emre", "Sabine"] }, two, "Emre")).toBeNull();
    expect(whoseOf({ ...ryanair, forWho: ["Zeynep"] }, two, "Emre")).toBeNull();
    expect(whoseOf({ ...ryanair, forWho: ["Sabine", "Zeynep"] }, two, "Emre")).toBeNull();
    expect(whoseOf(ryanair, trip(), "Emre")).toBeNull(); // nobody named: one person
    expect(whoseOf({ ...ryanair, forWho: ["Emre"] }, trip({ travellers: { names: [], count: 2 } }), "Emre")).toBeNull();
    expect(peopleOf(two, null)).toEqual(["Ben", "Sabine"]);
  });
});

describe("how many a plan is for", () => {
  const main = said({ kind: "flight", date: "2026-12-10", from: "İstanbul", to: "Denpasar" }, "m1");
  const home = said({ kind: "flight", date: "2027-01-10", from: "Denpasar", to: "İstanbul" }, "m2");
  const hers = said({ kind: "flight", date: "2026-12-10", from: "Alicante", to: "Denpasar" }, "s1", "p1", ["Sabine"]);
  it("a person's plan: them; everyone's flight the same way: one fewer; the other way: all", () => {
    const items = [main, home, hers];
    expect(headCountOf(hers, two, { total: 2, items, who: "Emre" })).toBe(1);
    expect(headCountOf(main, two, { total: 2, items, who: "Emre" })).toBe(1);
    expect(headCountOf(home, two, { total: 2, items, who: "Emre" })).toBe(2);
    expect(headCountOf(main, trip(), { total: 2, items, who: "Emre" })).toBe(2); // nobody named: as before
    expect(tripOrigin(items)).toBe("İstanbul");
  });
  it("the person's searches go from their place, for one", () => {
    const [google, sky] = flightLinks({ from: "Alicante", to: "Denpasar", date: "2026-12-10", adults: 1 });
    expect(new URL(google.url).searchParams.get("q")).toBe("Flights from Alicante to Denpasar on 2026-12-10 one way");
    expect(sky.url).toBe("https://www.skyscanner.net/transport/flights/alc/dps/261210/?adultsv2=1&rtn=0");
  });
});

describe("who it is, worked out, never guessed", () => {
  const people = ["Emre Durmuş", "Sabine", "Şule"];
  it("a document's names by first name, case, accents and Turkish letters aside", () => {
    expect(foldName("SABINE MÜLLER")).toBe("sabine muller");
    expect(ownersFromDoc(["SABINE MULLER"], people)).toEqual(["Sabine"]);
    expect(ownersFromDoc(["MULLER/SABINE MS"], people)).toEqual(["Sabine"]);
    expect(ownersFromDoc(["Sule Yilmaz"], people)).toEqual(["Şule"]);
    expect(ownersFromDoc(["EMRE DURMUS"], people)).toEqual(["Emre Durmuş"]);
    expect(ownersFromDoc(["Emre Durmuş", "Sabine Müller", "ŞULE"], people)).toBe("everyone");
  });
  it("a name not on the trip, a surname that disagrees, or one name for two people: ask", () => {
    expect(ownersFromDoc(["Sabine Muller", "Hans Muller"], people)).toBe("ask");
    expect(ownersFromDoc(["EMRE YILMAZ"], people)).toBe("ask"); // the trip's Emre is a Durmuş
    expect(ownersFromDoc(["EMRE DURMUS"], ["Emre", "Emre Durmuş", "Sabine"])).toBe("ask"); // two could be meant
    expect(ownersFromDoc([], people)).toBeNull(); // no names: it stays as it is
    expect(ownersFromDoc(["Sabine"], ["Sabine"])).toBeNull(); // one person: nothing to mark
  });
  it("a flight from where only someone comes from is theirs; from the trip's own start, nobody's", () => {
    const t = trip({ travellers: { names: ["Sabine"], from: { Sabine: "Alicante" } } });
    const main = said({ kind: "flight", date: "2026-10-07", from: "IST", to: "OPO" }, "m1");
    const ryanair = said({ kind: "flight", date: "2026-10-07", from: "Alicante", to: "OPO" }, "r1");
    expect(ownersByOrigin(ryanair, t, [main, ryanair], "Emre")).toEqual(["Sabine"]);
    expect(ownersByOrigin(main, t, [main, ryanair], "Emre")).toBeNull();
    expect(ownersByOrigin(ryanair, trip({ travellers: { names: ["Sabine"] } }), [main, ryanair], "Emre")).toBeNull();
  });
  it("a ticket dropped in: the names on it make it theirs, or the chat asks", () => {
    const t = trip({ travellers: { names: ["Sabine"] } });
    const facts: DocFacts = {
      doc_type: "flight", provider: "Ryanair", title: null, travellers: ["SABINE MULLER"], start_date: "2026-10-07", end_date: null, time: "10:35",
      from: "ALC", to: "OPO", city: null, booking_ref: "RY12", flight_number: "FR123", amount: 60, currency: "EUR",
    };
    const out = placeDoc(facts, [], "p1", "new", 5, { trip: t, who: "Emre" });
    expect(out).toMatchObject({ kind: "created", item: { forWho: ["Sabine"] } });
    const unknown = placeDoc({ ...facts, travellers: ["HANS MULLER"] }, [], "p1", "new2", 5, { trip: t, who: "Emre" });
    expect(unknown).toMatchObject({ kind: "created", ask: true });
    expect((unknown as { item: Item }).item.forWho).toBeUndefined();
    // Without the trip's people (an older caller): as before.
    expect((placeDoc(facts, [], "p1", "new3", 5) as { item: Item }).item.forWho).toBeUndefined();
  });
});

describe("renaming and taking people off", () => {
  it("`from` per name: said, changed with the name, gone with it; a name said to come is added, never me", () => {
    const a = withTravellers({ names: ["Sabine"] }, { from: [{ name: "sabine", place: "Alicante" }, { name: "Emre", place: "İzmir" }], me: "Emre" });
    expect(a).toEqual({ travellers: { names: ["Sabine"], from: { Sabine: "Alicante", Emre: "İzmir" } }, missing: [] });
    if (typeof a === "string") throw new Error(a);
    expect(fromOf(a.travellers, "SABINE")).toBe("Alicante");
    const b = withTravellers(a.travellers, { rename: [{ from: "Sabine", to: "Sabina" }] });
    expect(b).toMatchObject({ travellers: { names: ["Sabina"], from: { Sabina: "Alicante", Emre: "İzmir" } } });
    const c = withTravellers(a.travellers, { remove: ["Sabine"], from: [{ name: "Emre", place: "" }] });
    expect(c).toEqual({ travellers: { names: [] }, missing: [] });
    expect(withTravellers(undefined, { from: [{ name: "Ali", place: "Ankara" }] })).toMatchObject({ travellers: { names: ["Ali"], from: { Ali: "Ankara" } } });
  });
  it("their plans follow: a new name is written on them, a name off leaves them, nobody left is everyone's", () => {
    const items = [said({ kind: "flight" }, "x1", "p1", ["Sabine"]), said({ kind: "stay" }, "x2", "p1", ["Sabine", "Ali"]), said({ kind: "stay" }, "x3")];
    expect(ownersAfter(items, namesChanged({ names: ["Sabine", "Ali"] }, { rename: [{ from: "sabine", to: "Sabina" }] })).map((c) => [c.item.id, c.after])).toEqual([
      ["x1", ["Sabina"]],
      ["x2", ["Sabina", "Ali"]],
    ]);
    expect(ownersAfter(items, namesChanged({ names: ["Sabine", "Ali"] }, { remove: ["SABINE"] })).map((c) => [c.item.id, c.after])).toEqual([
      ["x1", null],
      ["x2", ["Ali"]],
    ]);
  });
  it("syncs with the settings, cleaned, and reads in Geçmiş", () => {
    const mine = trip({ travellers: { names: ["Sabine"], from: { Sabine: "Alicante" } } });
    expect(settingsOf(mine).travellers).toEqual({ names: ["Sabine"], from: { Sabine: "Alicante" } });
    expect(applySettings(trip(), { ...settingsOf(mine), travellers: { names: ["Sabine"], from: { Sabine: "Alicante", Bad: 3 as unknown as string } } }).travellers).toEqual({ names: ["Sabine"], from: { Sabine: "Alicante" } });
    expect(diffSettings(settingsOf(trip({ travellers: { names: ["Sabine"] } })), settingsOf(mine)).map(lineText)).toEqual(["Gidenler: Sabine → Sabine (Alicante'den)"]);
  });
  it("the hero's × on a name: the plans that were theirs only are everyone's again, said in a line; Geri al puts it all back", async () => {
    const d = await db();
    await d.put("trips", trip({ id: "rm", travellers: { names: ["Sabine"], from: { Sabine: "Alicante" } } }));
    await d.put("items", said({ kind: "flight", from: "Alicante", to: "Porto" }, "rm-f", "rm", ["Sabine"]));
    expect(await changeTravellers("rm", { remove: ["Sabine"] }, "Gidenler: Sabine çıkarıldı")).toBe(true);
    expect((await d.get("items", "rm-f"))!.forWho).toBeUndefined();
    expect((await d.get("trips", "rm"))!.travellers).toEqual({ names: [] });
    const lines = (await listMessages("rm")).filter((m) => m.role === "event");
    expect(lines.map((m) => m.text)).toEqual(["Gidenler: Sabine çıkarıldı", "Uçuş · Alicante → Porto: artık herkesin"]);
    await undoEvent(lines[0].id);
    expect((await d.get("items", "rm-f"))!.forWho).toEqual(["Sabine"]);
    expect((await d.get("trips", "rm"))!.travellers).toEqual({ names: ["Sabine"], from: { Sabine: "Alicante" } });
  });
});

// --- the chat ---------------------------------------------------------------------------------------------

function fakeClient(responses: Partial<Anthropic.Message>[]) {
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
  return { client, calls };
}
const toolCall = (id: string, name: string, input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const reply = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const toolResult = (call: Anthropic.MessageCreateParams) => JSON.parse((call.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);

/** Bali: Emre (my profile name) and Sabine, İstanbul ⇄ Denpasar, the start's two flights and a shared stay. */
async function seedBali(id: string): Promise<void> {
  const d = await db();
  await d.put("trips", trip({ id, title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, travellers: { names: ["Sabine"] } }));
  await d.put("items", said({ kind: "flight", date: "2026-12-10", from: "İstanbul", to: "Denpasar" }, `${id}-out`, id));
  await d.put("items", said({ kind: "flight", date: "2027-01-10", from: "Denpasar", to: "İstanbul" }, `${id}-home`, id));
  await d.put("items", said({ kind: "stay", date: "2026-12-10", end_date: "2027-01-10", city: "Ubud" }, `${id}-stay`, id));
}

describe("the chat: set_travellers from and set_owner", () => {
  let store: Record<string, unknown> = {};
  let changes: TripChange[] = [];
  let off = () => {};
  beforeEach(() => {
    store = { shareName: "Emre" };
    vi.stubGlobal("chrome", { storage: { local: { get: async (key: string) => ({ [key]: store[key] }), set: async (v: Record<string, unknown>) => void Object.assign(store, v) } } });
    changes = [];
    off = onTripChange((c) => changes.push(c));
  });
  afterEach(() => {
    off();
    vi.unstubAllGlobals();
  });

  it("'Sabine Alicante'den geliyor': her own empty flight there, the main one for one fewer, the way home asked in bold; Evet adds it; Geri al takes it all back", async () => {
    await seedBali("b1");
    const { client, calls } = fakeClient([
      toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }),
      reply("Not ettim: Sabine Alicante'den geliyor, onun için ayrı bir gidiş kartı açtım."),
    ]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("b1", "Sabine Alicante'den geliyor", llm);
    // The model is told my name, so owners are written by name.
    expect(JSON.stringify(calls[0].messages)).toContain(String.raw`\"me\":\"Emre\"`);
    const d = await db();
    expect((await d.get("trips", "b1"))!.travellers).toEqual({ names: ["Sabine"], from: { Sabine: "Alicante" } });
    const items = await listItems("b1");
    const hers = items.find((i) => i.forWho?.includes("Sabine"))!;
    expect(hers).toMatchObject({ forWho: ["Sabine"], flight: { from: "Alicante", to: "Denpasar" }, dates: { start: "2026-12-10" }, status: "chosen", origin: "chat" });
    const bali = (await d.get("trips", "b1"))!;
    expect(whoseOf(hers, bali, "Emre")?.label).toBe("Sabine'in bileti");
    expect(headCountOf(items.find((i) => i.id === "b1-out")!, bali, { total: 2, items, who: "Emre" })).toBe(1);
    // The trip's own flight there is the rest's now: "Emre'nin bileti", never a bare "1 kişi".
    expect(items.find((i) => i.id === "b1-out")!.forWho).toEqual(["Emre"]);
    expect(whoseOf(items.find((i) => i.id === "b1-out")!, bali, "Emre")?.label).toBe("Emre'nin bileti");
    expect(items.find((i) => i.id === "b1-home")!.forWho).toBeUndefined();
    expect(changes[0].label).toBe("Gidenler: Emre & Sabine · 2 kişi");
    expect(whoseOf(items.find((i) => i.id === "b1-stay")!, bali, "Emre")).toBeNull();
    const result = toolResult(calls[1]);
    expect((await listMessages("b1")).some((m) => m.role === "event" && m.text === "Gidenler: Sabine (Alicante'den) (sohbetten)")).toBe(true);
    expect(result.flights_opened).toHaveLength(1);
    expect(result.shown).toMatch(/Sabine için Alicante → Denpasar boş uçuş kartı açıldı \(10 Aralık\), rozeti "Sabine'in bileti"\. Uçuş · İstanbul → Denpasar artık "Emre'nin bileti"\./);
    const last = (await listMessages("b1")).filter((m) => m.role === "assistant").at(-1)!;
    expect(last.text).toBe("Not ettim: Sabine Alicante'den geliyor, onun için ayrı bir gidiş kartı açtım.\n\n**Sabine dönüşte de Alicante'ye mi?**");
    expect(last.choices).toEqual(["Evet, Alicante", "Hayır, İstanbul'a", "Henüz belli değil"]);
    expect(last.ask).toMatchObject({ kind: "return", name: "Sabine", place: "Alicante", leave: "Denpasar", date: "2027-01-10", origin: "İstanbul" });
    // "Evet, Alicante": answered by the code (no model call), her flight home made.
    await sendMessage("b1", "Evet, Alicante", llm);
    expect(calls).toHaveLength(2);
    const home = (await listItems("b1")).find((i) => i.forWho?.includes("Sabine") && i.flight?.to === "Alicante")!;
    expect(home).toMatchObject({ flight: { from: "Denpasar", to: "Alicante" }, dates: { start: "2027-01-10" } });
    expect((await listMessages("b1")).filter((m) => m.role === "assistant").at(-1)!.text).toMatch(/^Sabine'in dönüşünü ekledim: Denpasar → Alicante, 10 Ocak, boş kart olarak/);
    expect((await d.get("items", "b1-home"))!.forWho).toEqual(["Emre"]);
    // Its own Geri al (the board's toast): her flight home goes, and the trip's own is everyone's again.
    expect(changes).toHaveLength(2);
    expect(changes[1].label).toBe("Sabine'in dönüşü eklendi: Denpasar → Alicante");
    await undoEvent(changes[1].eventId!);
    expect(await d.get("items", home.id)).toBeUndefined();
    expect((await d.get("items", "b1-home"))!.forWho).toBeUndefined();
    // Geri al on the travellers' change: her place goes, the flight it opened with it, and the owner it wrote.
    await undoEvent(changes[0].eventId!);
    expect((await d.get("trips", "b1"))!.travellers).toEqual({ names: ["Sabine"] });
    expect((await d.get("items", hers.id))).toBeUndefined();
    expect((await d.get("items", "b1-out"))!.forWho).toBeUndefined();
  });

  it("'Hayır, İstanbul'a' and 'Henüz belli değil' change nothing and say so", async () => {
    await seedBali("b2");
    const { client } = fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }), reply("Tamam.")]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("b2", "Sabine Alicante'den geliyor", llm);
    const before = (await listItems("b2")).length;
    await sendMessage("b2", "Hayır, İstanbul'a", llm);
    expect((await listItems("b2")).length).toBe(before);
    expect((await listMessages("b2")).filter((m) => m.role === "assistant").at(-1)!.text).toBe("Tamam: Sabine dönüşte sizinle İstanbul'a uçuyor; dönüş kartı herkesin kalıyor.");
  });

  it("set_owner: 'bu bilet Sabine'in' makes it hers; a name not on the trip is refused; 'herkesin' and Geri al", async () => {
    await seedBali("b3");
    const { client, calls } = fakeClient([
      toolCall("t1", "set_owner", { item_ids: ["b3-home"], names: ["sabine"] }),
      toolCall("t2", "set_owner", { item_ids: ["b3-home"], names: ["Zeynep"] }),
      reply("Dönüş bileti artık Sabine'in."),
    ]);
    await sendMessage("b3", "bu dönüş bileti Sabine'in", anthropicProvider(client, "claude-opus-5"));
    const d = await db();
    expect((await d.get("items", "b3-home"))!.forWho).toEqual(["Sabine"]);
    expect(toolResult(calls[1])).toMatchObject({ set: ["Uçuş · Denpasar → İstanbul"], owners: ["Sabine"], shown: expect.stringContaining("Sabine'in bileti") });
    const refused = (calls[2].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(refused.is_error).toBe(true);
    expect(refused.content).toMatch(/Bu adlar gezide yok: Zeynep\. Gezidekiler: Emre, Sabine/);
    expect((await d.get("items", "b3-home"))!.forWho).toEqual(["Sabine"]);
    expect(changes.at(-1)!.label).toBe("Uçuş · Denpasar → İstanbul: Sabine'in bileti");
    await undoEvent(changes.at(-1)!.eventId!);
    expect((await d.get("items", "b3-home"))!.forWho).toBeUndefined();
    // The board's own way (the ••• menu's "Kimin için?"), and back to everyone.
    expect(await setOwner("b3-home", ["Emre"])).toBe(true);
    expect((await d.get("items", "b3-home"))!.forWho).toEqual(["Emre"]);
    expect(await setOwner("b3-home", null)).toBe(true);
    expect((await d.get("items", "b3-home"))!.forWho).toBeUndefined();
    expect(await setOwner("b3-home", null)).toBe(false);
  });

  it("without a name: never 'Ben' on a badge or a toast; 'Sana ne diyeyim?' in bold, the name saved to the profile, then the flight is mine and the way home asked", async () => {
    store = {};
    await seedBali("b5");
    const { client } = fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }), reply("Not ettim.")]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("b5", "Sabine Alicante'den geliyor", llm);
    const d = await db();
    expect((await d.get("items", "b5-out"))!.forWho).toBeUndefined(); // never "Ben'in bileti"
    expect(changes.at(-1)!.label).toBe("Gidenler: Sabine · 2 kişi");
    let last = (await listMessages("b5")).filter((m) => m.role === "assistant").at(-1)!;
    expect(last.text).toBe("Not ettim.\n\n**Sana ne diyeyim?**");
    expect(last.choices).toEqual([]);
    expect(last.ask).toMatchObject({ kind: "name", then: { ask: { kind: "return", name: "Sabine" } } });
    // "Emre": saved as the profile name (Ayarlar → Profilim's), the trip's flight there his, then the way home.
    await sendMessage("b5", "Emre", llm);
    expect(store.shareName).toBe("Emre");
    expect((await d.get("items", "b5-out"))!.forWho).toEqual(["Emre"]);
    last = (await listMessages("b5")).filter((m) => m.role === "assistant").at(-1)!;
    expect(last.text).toBe('Tamam, Emre; adını profiline kaydettim. Uçuş · İstanbul → Denpasar artık "Emre\'nin bileti".\n\n**Sabine dönüşte de Alicante\'ye mi?**');
    expect(last.choices).toEqual(["Evet, Alicante", "Hayır, İstanbul'a", "Henüz belli değil"]);
    await undoEvent(changes.at(-1)!.eventId!);
    expect((await d.get("items", "b5-out"))!.forWho).toBeUndefined();
  });

  it("set_owner: 'benim' without a name asks it in bold and makes the plan mine once said; nothing before", async () => {
    store = {};
    await seedBali("b4");
    const { client, calls } = fakeClient([toolCall("t1", "set_owner", { item_ids: ["b4-home"], names: ["ben"] }), reply("Tamam.")]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("b4", "dönüş bileti benim", llm);
    expect(toolResult(calls[1])).toMatchObject({ unchanged: true });
    expect((await (await db()).get("items", "b4-home"))!.forWho).toBeUndefined();
    expect((await listMessages("b4")).filter((m) => m.role === "assistant").at(-1)!.text).toBe("Tamam.\n\n**Sana ne diyeyim?**");
    await sendMessage("b4", "Bana Emre de", llm);
    expect((await (await db()).get("items", "b4-home"))!.forWho).toEqual(["Emre"]);
    expect(calls).toHaveLength(2);
  });
});

describe("a ticket whose names can't be placed", () => {
  it("is asked about in the chat: 'Bu Ryanair bileti kimin?' with the trip's people and Herkes; a chip answers it", async () => {
    const d = await db();
    await d.put("trips", trip({ id: "dq", travellers: { names: ["Sabine"] } }));
    const doc = await addTripDoc("dq", new File(["%PDF-1.4 ticket"], "ryanair.pdf", { type: "application/pdf" }), 5);
    const reading: DocFacts = {
      doc_type: "flight", provider: "Ryanair", title: null, travellers: ["HANS MULLER"], start_date: "2026-10-07", end_date: null, time: "10:35",
      from: "ALC", to: "OPO", city: null, booking_ref: "RY12", flight_number: "FR123", amount: 60, currency: "EUR",
    };
    const client: GeminiClient = {
      models: { generateContent: (async () => ({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(reading) }] }, finishReason: "STOP" }] })) as never },
    };
    const llm = geminiProvider(client, "gemini-test", 0);
    const out = await readDocument("dq", doc.id, { llm, today: "2026-10-05" });
    expect(out).toMatchObject({ kind: "created", ask: true });
    const last = (await listMessages("dq")).at(-1)!;
    expect(last.text).toMatch(/\n\n\*\*Bu Ryanair bileti kimin\?\*\*$/);
    expect(last.choices).toEqual(["Ben", "Sabine", "Herkes"]);
    // The chip is answered by the code (no model call).
    await sendMessage("dq", "Sabine", llm);
    const ticket = (await listItems("dq")).find((i) => i.category === "flight")!;
    expect(ticket.forWho).toEqual(["Sabine"]);
    expect((await listMessages("dq")).filter((m) => m.role === "assistant").at(-1)!.text).toBe(`Tamam: ${ticket.name}: Sabine'in bileti.`);
  });
});

// --- review (2026-10-06): probes 1–4 as tests ------------------------------------------------------------

describe("review: the genitive by how a name is said (probe 1–2)", () => {
  it("front l, English spellings, a final y, capitals and digits", () => {
    const cases: [string, string][] = [
      ["Kemal", "Kemal'in"], ["Celal", "Celal'in"], ["Cemal", "Cemal'in"], ["Bilal", "Bilal'in"],
      ["Mike", "Mike'ın"], ["Kate", "Kate'in"], ["Steve", "Steve'in"], ["George", "George'un"], ["Grace", "Grace'in"],
      ["Ivy", "Ivy'nin"], ["Amy", "Amy'nin"], ["Isabelle", "Isabelle'in"], ["ISABELLE", "ISABELLE'in"],
      ["7", "7'nin"], ["Agent 7", "Agent 7'nin"], ["R2D2", "R2D2'nin"], ["Kerem 9", "Kerem 9'un"],
      // unchanged
      ["Emre", "Emre'nin"], ["Sabine", "Sabine'in"], ["Can", "Can'ın"], ["Ay", "Ay'ın"],
    ];
    for (const [name, want] of cases) expect(genitive(name), name).toBe(want);
  });
});

describe("review: only the trip's way in and home are given away (probe 3)", () => {
  const fl = (id: string, from: string, to: string, day: string, forWho?: string[]) => said({ kind: "flight", date: day, from, to }, id, "p1", forWho);
  const trip3 = trip({ travellers: { names: ["Sabine"], from: { Sabine: "Alicante" } } });
  const legs = [fl("m1", "İstanbul", "Porto", "2026-11-01"), fl("m2", "Porto", "Funchal", "2026-11-04"), fl("m3", "Funchal", "Porto", "2026-11-08"), fl("m4", "Porto", "İstanbul", "2026-11-10")];
  const hersOut = fl("s1", "Alicante", "Porto", "2026-11-01", ["Sabine"]);
  const hersHome = fl("s2", "Porto", "Alicante", "2026-11-10", ["Sabine"]);
  it("Funchal → Porto stays everyone's, for 2; only İstanbul → Porto goes to Emre", () => {
    const items = [...legs, hersOut];
    expect(restOwners(trip3, items, "Emre").changes.map((c) => [c.item.id, c.owners])).toEqual([["m1", ["Emre"]]]);
    expect(legs.map((i) => headCountOf(i, trip3, { total: 2, items, who: "Emre" }))).toEqual([1, 2, 2, 2]);
    expect(restOwners(trip3, [...items, hersHome], "Emre").changes.map((c) => c.item.id)).toEqual(["m1", "m4"]);
    expect([tripOrigin(items, trip3), firstStop(trip3, items).city, lastStop(trip3, items).city]).toEqual(["İstanbul", "Porto", "Porto"]);
  });
  it("her flight another day doesn't take her off the trip's", () => {
    const items = [...legs, fl("s1", "Alicante", "Porto", "2026-11-02", ["Sabine"])];
    expect(restOwners(trip3, items, "Emre").changes).toEqual([]);
    expect(headCountOf(legs[0], trip3, { total: 2, items, who: "Emre" })).toBe(2);
  });
  it("more go than are named: nobody gets the rest, the count says total − away (probe 2)", () => {
    const t = trip({ travellers: { names: ["Sabine"], count: 4, from: { Sabine: "Alicante" } } });
    const items = [legs[0], legs[3], hersOut];
    expect(restOwners(t, items, "Emre").changes).toEqual([]);
    expect(headCountOf(legs[0], t, { total: 4, items, who: "Emre" })).toBe(3);
  });
});

describe("review: places, not anyone's (probe 4)", () => {
  const fl = (id: string, from: string, to: string, day: string, forWho?: string[]) => said({ kind: "flight", date: day, from, to }, id, "p1", forWho);
  it("my own place is the trip's start: the start stays, its flight is nobody's", () => {
    const t = trip({ travellers: { names: ["Sabine"], from: { Sabine: "Alicante", Emre: "İstanbul" } } });
    const items = [fl("m1", "İstanbul", "Porto", "2026-11-01"), fl("m4", "Porto", "İstanbul", "2026-11-10")];
    expect(tripOrigin(items, t)).toBe("İstanbul");
    expect(firstStop(t, items).city).toBe("Porto");
    expect(ownersByOrigin(fl("n", "İstanbul", "Porto", "2026-11-01"), t, items, "Emre")).toBeNull();
  });
  it("from a stop of the trip: she joins there; Lizbon → Porto is everyone's", () => {
    const t = trip({ travellers: { names: ["Sabine"], from: { Sabine: "Lizbon" } } });
    const items = [fl("m1", "İstanbul", "Lizbon", "2026-11-01"), fl("m2", "Lizbon", "Porto", "2026-11-04"), fl("m3", "Porto", "İstanbul", "2026-11-08")];
    expect(isTripStop("Lizbon", t, items)).toBe(true);
    expect(isTripStop("Alicante", t, items)).toBe(false);
    expect(firstStop(t, items).city).toBe("Lizbon");
    expect(ownersByOrigin(items[1], t, items, "Emre")).toBeNull();
  });
  it("'Ben' in from is me by name, or nothing: never a traveller called Ben (probe 2)", () => {
    expect(withTravellers({ names: ["Sabine"] }, { from: [{ name: "Ben", place: "Berlin" }], me: null })).toEqual({ travellers: { names: ["Sabine"] }, missing: [] });
    expect(withTravellers({ names: ["Sabine"] }, { from: [{ name: "ben", place: "Berlin" }], me: "Emre" })).toEqual({ travellers: { names: ["Sabine"], from: { Emre: "Berlin" } }, missing: [] });
    expect(withTravellers({ names: [] }, { add: ["Ben", "me"] })).toEqual({ travellers: { names: [] }, missing: [] });
  });
});

describe("review: what counts as a name", () => {
  it("1–2 capitalised words, or after ben / adım / I'm; never an answer word", () => {
    expect(["Emre", "Ana María", "ben emre", "Adım Emre", "I'm Emre", "bana Emre de", "Emre."].map(nameSaid)).toEqual(["Emre", "Ana María", "Emre", "Emre", "Emre", "Emre", "Emre"]);
    expect(["Hayır", "tamam", "otel öner", "ben de", "Evet", "ok", "emre", "Emre Can Yılmaz", "Emre!?", "Ben"].map(nameSaid)).toEqual(Array(10).fill(null));
  });
});

describe("review: the chat's questions (probes 2–3)", () => {
  let store: Record<string, unknown> = {};
  let changes: TripChange[] = [];
  let off = () => {};
  beforeEach(() => {
    store = { shareName: "Emre" };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (v: Record<string, unknown>) => void Object.assign(store, v),
          remove: async (key: string) => void delete store[key],
        },
      },
    });
    changes = [];
    off = onTripChange((c) => changes.push(c));
  });
  afterEach(() => {
    off();
    vi.unstubAllGlobals();
  });
  const comes = () => fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }), reply("Not ettim.")]);
  const lastReply = async (id: string) => (await listMessages(id)).filter((m) => m.role === "assistant").at(-1)!;

  it("undo cascades: the travellers line takes back her flight home and the owners the chip gave", async () => {
    await seedBali("r1");
    const llm = anthropicProvider(comes().client, "claude-opus-5");
    await sendMessage("r1", "Sabine Alicante'den geliyor", llm);
    await sendMessage("r1", "Evet, Alicante", llm);
    const d = await db();
    const herHome = (await listItems("r1")).find((i) => i.forWho?.includes("Sabine") && i.flight?.to === "Alicante")!;
    expect((await d.get("items", "r1-home"))!.forWho).toEqual(["Emre"]);
    await undoEvent(changes[0].eventId!); // the travellers line, first
    expect(await d.get("items", herHome.id)).toBeUndefined();
    expect((await d.get("items", "r1-home"))!.forWho).toBeUndefined();
    expect((await d.get("items", "r1-out"))!.forWho).toBeUndefined();
    expect((await listItems("r1")).filter((i) => i.forWho?.length)).toEqual([]);
  });

  it("a stale chip does nothing: after Geri al, 'Evet, Alicante' says the question no longer applies", async () => {
    await seedBali("r2");
    const llm = anthropicProvider(comes().client, "claude-opus-5");
    await sendMessage("r2", "Sabine Alicante'den geliyor", llm);
    await undoEvent(changes[0].eventId!);
    const before = (await listItems("r2")).length;
    await sendMessage("r2", "Evet, Alicante", llm);
    expect((await listItems("r2")).length).toBe(before);
    expect((await lastReply("r2")).text).toBe("Bu soru artık geçerli değil (sonradan değişti); hiçbir şey yapmadım.");
  });

  it("'Sana ne diyeyim?': 'tamam' or a traveller's name is asked once more, then left to the model; the name goes back with Geri al", async () => {
    store = {};
    await seedBali("r3");
    const { client, calls } = fakeClient([
      toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }),
      reply("Not ettim."),
      reply("Anladım."),
    ]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("r3", "Sabine Alicante'den geliyor", llm);
    await sendMessage("r3", "Sabine", llm);
    expect(store.shareName).toBeUndefined();
    expect((await lastReply("r3")).text).toBe("**Sabine gezide başka biri olarak var; senin adın ne?**");
    await sendMessage("r3", "tamam", llm); // asked once more already: the model answers
    expect(store.shareName).toBeUndefined();
    expect(calls).toHaveLength(3);
    expect((await (await db()).get("items", "r3-out"))!.forWho).toBeUndefined();

    // A fresh ask, answered: the name and the owners in one line, and its Geri al puts the name back.
    await seedBali("r4");
    const second = fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] }), reply("Not ettim.")]);
    const llm2 = anthropicProvider(second.client, "claude-opus-5");
    await sendMessage("r4", "Sabine Alicante'den geliyor", llm2);
    await sendMessage("r4", "ben Emre", llm2);
    expect(store.shareName).toBe("Emre");
    expect(changes.at(-1)!.label).toBe("Adın: Emre · Uçuş · İstanbul → Denpasar artık \"Emre'nin bileti\".");
    await undoEvent(changes.at(-1)!.eventId!);
    expect(store.shareName).toBe("");
    expect((await (await db()).get("items", "r4-out"))!.forWho).toBeUndefined();
  });

  it("coming from where the trip leaves from is no exception: nothing kept, no flight", async () => {
    await seedBali("r5");
    const { client } = fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "Emre", place: "İstanbul" }], rename: [] }), reply("Tamam.")]);
    await sendMessage("r5", "ben de İstanbul'danım", anthropicProvider(client, "claude-opus-5"));
    expect((await (await db()).get("trips", "r5"))!.travellers).toEqual({ names: ["Sabine"] });
    expect((await listItems("r5")).length).toBe(3);
  });

  it("'ben Berlin'den geliyorum' with no name: no 'Ben' traveller; my name asked in bold", async () => {
    store = {};
    await seedBali("r6");
    const { client } = fakeClient([toolCall("t1", "set_travellers", { add: [], remove: [], count: 0, from: [{ name: "ben", place: "Berlin" }], rename: [] }), reply("Tamam.")]);
    await sendMessage("r6", "ben Berlin'den geliyorum", anthropicProvider(client, "claude-opus-5"));
    expect((await (await db()).get("trips", "r6"))!.travellers).toEqual({ names: ["Sabine"] });
    expect((await lastReply("r6")).text).toBe("Tamam.\n\n**Sana ne diyeyim?**");
  });
});
