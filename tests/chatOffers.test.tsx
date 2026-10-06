// The chat's find_offers ("kalan 3 gün için daha ucuz öneriler getir"): real offers from the sources, never the
// model's own ideas. Nothing under the ceiling: asked again without it and said honestly ("bu fiyata bulamadım, en
// ucuzu gecelik €90"); at most three shown as cards under the reply; "Ekle" saves one as an option, once.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const found = vi.hoisted(() => ({ calls: [] as { need: any; narrow: any }[], answer: (_need: any, _narrow: any): any[] => [] }));
vi.mock("../src/lib/offerSources", () => ({
  findOffers: async (need: any, narrow: any = {}) => {
    found.calls.push({ need, narrow });
    return found.answer(need, narrow);
  },
}));

import { addChatOffer } from "../src/app/actions";
import { ChatOffersView } from "../src/app/ChatOffers";
import { FIND_OFFERS_RULES_EN, FIND_OFFERS_RULES_TR, offersNeed, sendMessage, systemPrompt } from "../src/lib/assistant";
import { onChatStatus, type ChatStatus } from "../src/lib/chatStatus";
import { db, listItems, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { Need, Offer } from "../src/lib/offerSource";
import { plannedItem } from "../src/lib/planned";
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
const resultOf = (calls: Anthropic.MessageCreateParams[], n: number) => (calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];

const T = "of";
const trip: Trip = { id: T, title: "Porto ve Madeira", confirmedDates: { start: "2026-10-14", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, travellers: { names: ["Sabine"], count: 2 } };
const stay = (): Item => ({
  ...plannedItem({ kind: "stay", date: "2026-10-18", end_date: "2026-10-21", time: null, from: null, to: null, city: "Funchal", title: null, booked: false, note: null }, T, "fnc", 1),
  countryCode: "PT",
});
const offer = (over: Partial<Offer> = {}): Offer => ({
  id: "o1", kind: "stay", title: "Quinta Mãe dos Homens", photo: null, rating: 4.7, price: 270, currency: "EUR", nights: 3,
  url: "https://www.tripadvisor.com/Hotel_Review-quinta?m=partner", why: "Funchal merkeze 10 dk, en ucuzu", source: "Tripadvisor", fetchedAt: 5, ...over,
});
const three = () => [
  offer(),
  offer({ id: "o2", title: "Hotel do Carmo", rating: 8.9, price: 330, source: "Booking", url: "https://www.booking.com/hotel/pt/carmo.html?aid=1", why: "Eski şehirde" }),
  offer({ id: "o3", title: "Casa Velha", rating: null, price: 450, source: "Agoda", url: "https://www.agoda.com/casa-velha", why: "" }),
];
const ask = (over: Record<string, unknown> = {}) => ({ kind: "stay", city: "Funchal", from: "", to: "", start: "2026-10-18", end: "2026-10-21", adults: 0, max_per_night: 0, prefer: "cheap", ...over });

async function put(items: Item[]) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", trip);
  for (const i of items) await d.put("items", i);
}
const lastReply = async () => (await listMessages(T)).filter((m) => m.role === "assistant" && m.text.trim()).at(-1)!;

beforeEach(() => {
  found.calls = [];
  found.answer = () => [];
});
afterEach(() => setLang("tr"));

describe("find_offers", () => {
  it("the prompt says: cheaper / alternatives for a stay or flight → find_offers first; general knowledge only marked 'kaynakta bulunamadı, tahmini'", () => {
    expect(systemPrompt()).toContain(FIND_OFFERS_RULES_TR);
    expect(FIND_OFFERS_RULES_TR).toMatch(/daha ucuz.*ÖNCE find_offers/s);
    expect(FIND_OFFERS_RULES_TR).toContain("kaynakta bulunamadı, tahmini");
    setLang("en");
    expect(systemPrompt()).toContain(FIND_OFFERS_RULES_EN);
  });

  it("the need as the empty cards build it: a stay's city and country, a flight's airports; a place typed loosely is the trip's", () => {
    const items = [stay()];
    expect(offersNeed(ask(), items, 2)).toMatchObject({ kind: "stay", section: "stay", city: "Funchal", start: "2026-10-18", end: "2026-10-21", adults: 2, country: "PT" });
    expect(offersNeed(ask({ kind: "flight", city: "", from: "Maderia", to: "İstanbul", end: "" }), items, 2)).toMatchObject({ kind: "flight", from: "Madeira", to: "İstanbul", fromCode: "FNC", toCode: "IST" });
    expect(typeof offersNeed(ask({ kind: "flight", city: "", from: "Funchal", to: "Atlantis" }), items, 2)).toBe("string");
    expect(typeof offersNeed(ask({ end: "2026-10-17" }), items, 2)).toBe("string");
  });

  it("nothing under the ceiling: asked again without it; the reply says honestly 'bu fiyata bulamadım, en ucuzu gecelik €90'; 'Fiyatlara bakıyorum…' meanwhile", async () => {
    await put([stay()]);
    found.answer = (_need, narrow) => (narrow.max ? [] : three());
    const statuses: ChatStatus[] = [];
    const stop = onChatStatus((tripId, s) => tripId === T && statuses.push(s));
    const { llm, calls } = fake([use("find_offers", ask({ max_per_night: 60 })), say("En uygun üçü aşağıda.")]);
    await sendMessage(T, "kalan 3 gün için gecesi 60 euroya daha ucuz öneriler getir", llm);
    stop();
    expect(found.calls.map((c) => c.narrow)).toEqual([{ prefer: "cheap", max: 60 }, { prefer: "cheap" }]);
    // Only the place, the days and the head-count went out (no names, no trip).
    expect(found.calls[0].need).toMatchObject({ kind: "stay", city: "Funchal", start: "2026-10-18", end: "2026-10-21", adults: 2, country: "PT" });
    expect(JSON.stringify(found.calls[0].need)).not.toContain("Sabine");
    expect(statuses).toEqual(["offers", null]);
    const result = JSON.parse(String(resultOf(calls, 1).content));
    expect(result).toMatchObject({ found: 3, over_max: "Bu fiyata bulamadım, en ucuzu gecelik €90." });
    expect(result.offers[0]).toMatchObject({ title: "Quinta Mãe dos Homens", total: "€270", per_night: "€90", rating: "4.7/5", source: "Tripadvisor" });
    const reply = await lastReply();
    expect(reply.text).toBe("Bu fiyata bulamadım, en ucuzu gecelik €90.\n\nEn uygun üçü aşağıda.");
    expect(reply.offers?.offers.map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
    expect(reply.unbacked).toBeUndefined();
  });

  it("the sources have nothing at all: found 0, no cards; the model is told to mark anything else 'tahmini'", async () => {
    await put([stay()]);
    const { llm, calls } = fake([use("find_offers", ask()), say("Kaynakta bulunamadı, tahmini: ...")]);
    await sendMessage(T, "daha ucuz otel öner", llm);
    const result = JSON.parse(String(resultOf(calls, 1).content));
    expect(result.found).toBe(0);
    expect(result.note).toContain("kaynakta bulunamadı, tahmini");
    expect((await lastReply()).offers).toBeUndefined();
  });

  it("three offers drawn as compact cards: title, total and by the night, '★ 4,7' / '8,9', source, why, Ekle; links through the offer's own URL", () => {
    const need = offersNeed(ask(), [stay()], 2) as Need;
    const html = renderToStaticMarkup(<ChatOffersView offers={[...three(), offer({ id: "o4", title: "Fourth" })]} need={need} added={["o2"]} onAdd={() => {}} />);
    expect(html.match(/class="chat-offer"/g)).toHaveLength(3);
    expect(html).not.toContain("Fourth");
    for (const part of [
      "Quinta Mãe dos Homens", "€270", "€90 / gece", '<span class="ek-of-rate">★ 4,7</span>', "Tripadvisor", "✨ Funchal merkeze 10 dk, en ucuzu",
      '<span class="ek-of-rate">8,9</span>', "Booking", "Eklendi ✓", ">Ekle<",
      'href="https://www.tripadvisor.com/Hotel_Review-quinta?m=partner"', 'href="https://www.booking.com/hotel/pt/carmo.html?aid=1"', 'rel="noopener noreferrer"',
    ]) {
      expect(html).toContain(part);
    }
  });

  it("Ekle saves the offer as an option of the need, once; the reply remembers it", async () => {
    await put([stay()]);
    found.answer = () => three();
    const { llm } = fake([use("find_offers", ask()), say("Üç seçenek buldum.")]);
    await sendMessage(T, "alternatif otel öner", llm);
    const reply = await lastReply();
    const [first] = reply.offers!.offers;
    const item = await addChatOffer(reply.id, first, reply.offers!.need);
    expect(item).toMatchObject({ tripId: T, category: "stay", status: "saved", name: "Quinta Mãe dos Homens", provider: "Tripadvisor", url: first.url, city: "Funchal", rating: { value: 4.7, scale: 5 }, price: { amount: 270, currency: "EUR" } });
    expect(item!.dates).toMatchObject({ start: "2026-10-18", end: "2026-10-21" });
    expect(await addChatOffer(reply.id, first, reply.offers!.need)).toBeNull();
    expect((await listItems(T)).filter((i) => i.name === "Quinta Mãe dos Homens")).toHaveLength(1);
    expect((await (await db()).get("messages", reply.id))!.offers!.added).toEqual(["o1"]);
  });
});
