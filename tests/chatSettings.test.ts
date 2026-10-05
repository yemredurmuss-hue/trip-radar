// The chat changes the trip's settings truthfully (0.37): "bütçeyi euro olarak göster" really converts the budget
// (the bug: "Done! I've updated your budget currency to Euro." while the hero stayed in TRY), the board's language
// switches, a missing rate is refused, and a reply claiming a change no tool made gets a note under it.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { claimsChange } from "../src/lib/claims";
import { db, listMessages } from "../src/lib/db";
import { makeContext } from "../src/lib/decision";
import { lang, setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { currencyOf, restoreFields, withCurrency } from "../src/lib/tripSettings";
import { onTripChange, type TripChange } from "../src/lib/tripUndo";
import { undo } from "../src/app/actions";
import { ChangedSince, undoEvent } from "../src/lib/eventUndo";
import { buildHistory } from "../src/lib/history";
import type { Item, Trip } from "../src/lib/types";

const today = new Date().toISOString().slice(0, 10);
const RATES = { base: "EUR" as const, date: today, rates: { EUR: 1, TRY: 47.5, USD: 1.08, GBP: 0.86 } };

/** chrome.storage.local in memory: the day's rates and the chosen language live there. */
let store: Record<string, unknown> = {};
function stubChrome(withRates: boolean) {
  store = withRates ? { rates: { ...RATES, fetched: today } } : {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (values: Record<string, unknown>) => void Object.assign(store, values),
      },
    },
  });
  // No network in tests: a rate that isn't stored can't be fetched.
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline (test)");
  });
}

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
const reply = (text: string): Partial<Anthropic.Message> => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[],
});

let n = 0;
async function seed(budget: Trip["budget"]): Promise<{ trip: Trip; items: Item[] }> {
  const d = await db();
  const id = `cs${++n}`;
  const trip: Trip = { id, title: "Porto ve Madeira", confirmedDates: null, budget, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  const item: Item = {
    id: `${id}-a`, tripId: id, captureIds: [], key: null, category: "flight", needKey: "flight:ist-opo", name: "IST → OPO", provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-07", end: null, source: "url" },
    guests: { adults: 1, children: null, rooms: null },
    price: { amount: 18000, currency: "TRY", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, highlights: [], concerns: [],
    reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: 1, updatedAt: 1,
  };
  await d.put("items", item);
  return { trip, items: [item] };
}

const stored = async (id: string) => (await (await db()).get("trips", id))!;
const lastReply = async (id: string) => (await listMessages(id)).filter((m) => m.role === "assistant").at(-1)!.text;
const toolResults = (call: Anthropic.MessageCreateParams) => call.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];

let changes: TripChange[] = [];
let off: () => void = () => {};
beforeEach(() => {
  changes = [];
  off = onTripChange((c) => changes.push(c));
});
afterEach(() => {
  off();
  setLang("tr");
  vi.unstubAllGlobals();
});

describe("the trip's money", () => {
  it("reads a currency said in words or as a code", () => {
    expect(["euro", "Euro", "avro", "EUR", "€"].map(currencyOf)).toEqual(["EUR", "EUR", "EUR", "EUR", "EUR"]);
    expect(["TL", "lira", "dolar", "usd"].map(currencyOf)).toEqual(["TRY", "TRY", "USD", "USD"]);
    expect(currencyOf("bitcoinish")).toBeNull();
  });

  it("converts the budget and its ceiling, keeps the same money as no change, and never writes a guessed amount", () => {
    const trip: Trip = { id: "x", title: "x", confirmedDates: null, budget: { amount: 95000, currency: "TRY", ceiling: 100000 }, heroImage: null, createdAt: 1, updatedAt: 1 };
    const done = withCurrency(trip, "euro", "TRY", RATES);
    expect(done && typeof done === "object" && done.trip.budget).toEqual({ amount: 2000, currency: "EUR", ceiling: 2105 });
    expect(done && typeof done === "object" && done.trip.currency).toBe("EUR");
    expect(withCurrency(trip, "TRY", "TRY", RATES)).toBeNull();
    expect(withCurrency(trip, "EUR", "TRY", null)).toMatch(/Kur bilgisi yok/);
    expect(withCurrency(trip, "EUR", "TRY", { ...RATES, rates: { EUR: 1 } })).toMatch(/TRY için kur bilgisi yok/);
    expect(withCurrency(trip, "XYZ", "TRY", RATES)).toMatch(/XYZ için kur bilgisi yok/);
    // Without a budget only the money shown changes (no rate needed to convert nothing, but both must be known).
    const bare = withCurrency({ ...trip, budget: null }, "EUR", "TRY", RATES);
    expect(bare && typeof bare === "object" && bare.trip).toMatchObject({ currency: "EUR", budget: null });
    // The undo puts exactly the fields back, a field that wasn't there goes again.
    expect(restoreFields({ ...trip, currency: "EUR" }, { fields: ["currency", "budget"], before: { currency: undefined, budget: trip.budget } })).toEqual(trip);
  });

  it("'bütçeyi euro yap' converts the budget, the board compares in euros, and Geri al puts TRY back", async () => {
    stubChrome(true);
    const { trip, items } = await seed({ amount: 81755, currency: "TRY" });
    const { client, calls } = fakeClient([
      toolCall("s1", "set_settings", { currency: "EUR", language: "" }),
      reply("Tamam, bütçeyi euroya çevirdim: artık €1.721."),
    ]);
    await sendMessage(trip.id, "bütçeyi euro yap", anthropicProvider(client, "claude-opus-5"));
    const after = await stored(trip.id);
    expect(after.budget).toEqual({ amount: 1721, currency: "EUR" });
    expect(after.currency).toBe("EUR");
    expect(makeContext(after, items).currency).toBe("EUR");
    const result = JSON.parse(toolResults(calls[1])[0].content as string);
    expect(result.currency).toMatchObject({ from: "TRY", to: "EUR" });
    // A tool changed it: no note under the reply.
    expect(await lastReply(trip.id)).toBe("Tamam, bütçeyi euroya çevirdim: artık €1.721.");
    // Geçmiş's line, and the board's "Geri al".
    expect((await listMessages(trip.id)).some((m) => m.role === "event" && /^Para birimi TRY → EUR \(bütçe/.test(m.text))).toBe(true);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ tripId: trip.id, fields: ["currency", "budget"], label: "Para birimi: EUR" });
    await undo({ kind: "trip", change: changes[0] });
    const back = await stored(trip.id);
    expect(back.budget).toEqual({ amount: 81755, currency: "TRY" });
    expect("currency" in back).toBe(false);
    expect(makeContext(back, items).currency).toBe("TRY");
  });

  it("Geçmiş's Geri al puts the money back on an unshared trip, once, and never over a later change", async () => {
    stubChrome(true);
    const { trip, items } = await seed({ amount: 81755, currency: "TRY" });
    const history = async () =>
      buildHistory({ me: "", settings: null, notices: [], undone: [], events: await listMessages(trip.id), trash: [], hidden: [], items: [], current: null, now: Date.now() });
    const turn = () => fakeClient([toolCall("s1", "set_settings", { currency: "EUR", language: "" }), reply("Euroya çevirdim.")]);
    await sendMessage(trip.id, "bütçeyi euro yap", anthropicProvider(turn().client, "claude-opus-5"));
    const row = (await history()).find((r) => r.text.startsWith("Para birimi TRY → EUR"))!;
    expect(row.action).toMatchObject({ kind: "undo-event" });
    expect(row.undone).toBeNull();
    await undoEvent((row.action as { messageId: string }).messageId);
    expect((await stored(trip.id)).budget).toEqual({ amount: 81755, currency: "TRY" });
    expect(makeContext(await stored(trip.id), items).currency).toBe("TRY");
    const after = (await history()).find((r) => r.key === row.key)!;
    expect(after.action).toBeNull();
    expect(after.undone).toMatchObject({ by: "Ben" });
    // Taken back already: a second click changes nothing.
    await expect(undoEvent((row.action as { messageId: string }).messageId)).resolves.toEqual({ reload: false });

    // Changed again since (the budget said anew): the older line doesn't overwrite it.
    await sendMessage(trip.id, "bütçeyi euro yap", anthropicProvider(turn().client, "claude-opus-5"));
    const again = (await history()).find((r) => r.text.startsWith("Para birimi TRY → EUR") && r.action)!;
    await (await db()).put("trips", { ...(await stored(trip.id)), budget: { amount: 2500, currency: "EUR" } });
    await expect(undoEvent((again.action as { messageId: string }).messageId)).rejects.toBeInstanceOf(ChangedSince);
    expect((await stored(trip.id)).budget).toEqual({ amount: 2500, currency: "EUR" });

    // The board's toast goes through the same line: Geçmiş then says "geri alındı".
    const t2 = await seed({ amount: 47500, currency: "TRY" });
    await sendMessage(t2.trip.id, "euro", anthropicProvider(turn().client, "claude-opus-5"));
    const change = changes.find((c) => c.tripId === t2.trip.id)!;
    expect(change.eventId).toBeTruthy();
    await undo({ kind: "trip", change });
    expect((await stored(t2.trip.id)).budget).toEqual({ amount: 47500, currency: "TRY" });
    expect((await listMessages(t2.trip.id)).find((m) => m.id === change.eventId)!.undoneAt).toBeTypeOf("number");
  });

  it("update_trip with only a currency and no budget (the 0.36.6 'ok' that changed nothing) now changes the money shown", async () => {
    stubChrome(true);
    const { trip, items } = await seed(null);
    const { client, calls } = fakeClient([
      toolCall("u1", "update_trip", { title: null, start: null, end: null, budget_amount: null, budget_currency: "EUR", budget_ceiling: null }),
      reply("Pano artık euro gösteriyor."),
    ]);
    await sendMessage(trip.id, "bütçeyi euro olarak göster hero da", anthropicProvider(client, "claude-opus-5"));
    const after = await stored(trip.id);
    expect(makeContext(after, items).currency).toBe("EUR");
    expect(JSON.parse(toolResults(calls[1])[0].content as string).currency).toMatchObject({ from: "TRY", to: "EUR", budget: null });
  });

  it("refuses without a rate: nothing changes, the model is told why", async () => {
    stubChrome(false);
    const { trip, items } = await seed({ amount: 81755, currency: "TRY" });
    const { client, calls } = fakeClient([
      toolCall("s1", "set_settings", { currency: "EUR", language: "" }),
      reply("Şu an kur bilgisi yok, sonra tekrar deneyelim."),
    ]);
    await sendMessage(trip.id, "bütçeyi euro yap", anthropicProvider(client, "claude-opus-5"));
    const [result] = toolResults(calls[1]);
    expect(result.is_error).toBe(true);
    expect(result.content).toMatch(/Kur bilgisi yok/);
    const after = await stored(trip.id);
    expect(after.budget).toEqual({ amount: 81755, currency: "TRY" });
    expect(makeContext(after, items).currency).toBe("TRY");
    expect(changes).toHaveLength(0);
  });
});

describe("the board's language", () => {
  it("'İngilizceden Türkçeye geç' switches the board to Turkish, kept as Settings keeps it; the reply after is in Turkish", async () => {
    stubChrome(true);
    setLang("en");
    const { trip } = await seed(null);
    const { client, calls } = fakeClient([
      toolCall("l1", "set_settings", { currency: "", language: "tr" }),
      reply("Tamam, pano artık Türkçe."),
    ]);
    await sendMessage(trip.id, "İngilizceden Türkçeye geç", anthropicProvider(client, "claude-opus-5"));
    expect(lang()).toBe("tr");
    expect(store.lang).toBe("tr");
    // The first step was asked in English, the one after the switch in Turkish (system prompt and tools).
    expect(JSON.stringify(calls[0].system)).toMatch(/You are the user's travel companion/);
    expect(JSON.stringify(calls[1].system)).toMatch(/Sen kullanıcının seyahat arkadaşı/);
    expect((await listMessages(trip.id)).some((m) => m.role === "event" && m.text === "Panonun dili Türkçe oldu (sohbetten)")).toBe(true);
    // The same language again changes nothing, and says so.
    const again = fakeClient([toolCall("l2", "set_settings", { currency: "", language: "tr" }), reply("Pano zaten Türkçe.")]);
    await sendMessage(trip.id, "Türkçe olsun", anthropicProvider(again.client, "claude-opus-5"));
    expect(JSON.parse(toolResults(again.calls[1])[0].content as string)).toMatchObject({ unchanged: true });
    // Geçmiş's Geri al: English again (the board reloads into it).
    const line = (await listMessages(trip.id)).find((m) => m.undo?.kind === "lang")!;
    await expect(undoEvent(line.id)).resolves.toEqual({ reload: true });
    expect(lang()).toBe("en");
    expect(store.lang).toBe("en");
  });
});

describe("the language's Geri al across the reload", () => {
  it("reloads only when the turn switched the language, and hands its undo to the board once", async () => {
    const { reloadIfLangChanged, takeLangUndo } = await import("../src/app/langSwitch");
    const session = new Map<string, string>();
    const reload = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
      removeItem: (k: string) => void session.delete(k),
    });
    vi.stubGlobal("location", { reload });
    setLang("tr");
    reloadIfLangChanged("t1", "tr");
    expect(reload).not.toHaveBeenCalled();
    setLang("en"); // the chat's set_settings switched it during the turn
    reloadIfLangChanged("t1", "tr");
    expect(reload).toHaveBeenCalledOnce();
    expect(takeLangUndo("other")).toBeNull(); // another trip on screen: not its undo (and it's used up)
    reloadIfLangChanged("t1", "tr");
    expect(takeLangUndo("t1")).toEqual({ prev: "tr", label: "The board is now in English" });
    expect(takeLangUndo("t1")).toBeNull(); // once
  });
});

describe("honesty: a change claimed with no tool", () => {
  it("finds a claim of a change, not a question or a negation", () => {
    for (const yes of [
      "Done! I've updated your budget currency to Euro.",
      "I updated the budget.",
      "I've switched the board to Turkish.",
      "Bütçeyi euroya çevirdim.",
      "Tamam, para birimini güncelledim.",
      "Sabine'yi ekledim, artık iki kişisiniz.",
      "Hallettim.",
      "The currency is now set to EUR.",
    ]) expect(claimsChange(yes), yes).toBe(true);
    for (const no of [
      "Bütçeyi euroya çevireyim mi?",
      "Should I change the currency to EUR?",
      "Bunu panoda değiştiremedim.",
      "I haven't changed anything yet.",
      "I couldn't update it.",
      "Bir karşılaştırma yaptım: Jardim daha merkezi.",
      "I've added up the prices: about €1,900 so far.",
      "Well done! Porto in October is lovely.",
      "Have you updated the dates?",
      "Önerim Jardim Stay: en iyi konum.",
    ]) expect(claimsChange(no), no).toBe(false);
  });

  it("adds the note under a reply that claims a change no tool made, and not under a question", async () => {
    const { trip } = await seed(null);
    const { client } = fakeClient([reply("Done! I've updated your budget currency to Euro. Everything on the board will now be shown in EUR.")]);
    await sendMessage(trip.id, "bütçeyi euro olarak göster hero da", anthropicProvider(client, "claude-opus-5"));
    expect(await lastReply(trip.id)).toMatch(/Everything on the board will now be shown in EUR\.\n\nNot: bunu panoda değiştiremedim; Ayarlar'dan yapabilirsin\.$/);

    const asked = fakeClient([reply("Bütçeyi euroya çevireyim mi?")]);
    await sendMessage(trip.id, "bütçe euro mu olsun?", anthropicProvider(asked.client, "claude-opus-5"));
    expect(await lastReply(trip.id)).toBe("Bütçeyi euroya çevireyim mi?");

    // A tool that read the page doesn't make "I updated" true.
    const looked = fakeClient([toolCall("o1", "offer_choices", { options: ["Evet", "Hayır"] }), reply("Para birimini güncelledim.")]);
    await sendMessage(trip.id, "euro yap", anthropicProvider(looked.client, "claude-opus-5"));
    expect(await lastReply(trip.id)).toMatch(/Not: bunu panoda değiştiremedim/);
  });
});
