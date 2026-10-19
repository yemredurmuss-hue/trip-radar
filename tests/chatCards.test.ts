// Sohbet uyumu (C34) and a link dropped in the chat (C35), lib/chatCards.ts: the record a turn put on the board as the
// Plan's compact card under its reply, "Planda göster" going to its box (the Pano, its category), "Bunu seç" taking that
// very record, at most three quick replies, and the card of a link that couldn't be read. The prototype's conversation:
// a Booking link for Tokyo, then "Kyoto için geleneksel bir yer bul".
import { beforeEach, describe, expect, it } from "vitest";
import { chatCard, chatCards, linkCard, planTarget, QUICK_MAX, quickReplies, shortUrl } from "../src/lib/chatCards";
import { setLang, withLang } from "../src/lib/i18n";
import type { ChatMessage, Item } from "../src/lib/types";
import { boardOf, JAPAN_TODAY, japan, ozora, stay, thing } from "./fixtures/v82Trips";

const msg = (id: string, role: ChatMessage["role"], text: string, createdAt: number, over: Partial<ChatMessage> = {}): ChatMessage => ({ id, tripId: "jp", role, content: null, text, choices: [], createdAt, ...over });
const when = (i: Item, createdAt: number, statusAt?: number) => Object.assign(i, { createdAt, ...(statusAt ? { statusAt } : {}) });

/** The conversation: the link saved (its line), then a turn that found three ryokans and named the best. */
function japanChat() {
  const t = japan();
  when(t.by.hyatt, 105, 106);
  when(t.by.hatanaka, 205);
  when(t.by.motonago, 206);
  when(t.by.celestine, 207);
  const messages = [
    msg("m1", "user", "booking.com/hotel/jp/hyatt-centric-ginza", 100),
    msg("m2", "event", "✓ Hyatt Centric Ginza kaydedildi → Konaklama · Tokyo", 110),
    msg("m3", "user", "Kyoto için geleneksel bir yer bul", 200),
    // The turn's step with its tools, then their results (no words of their own), then the reply.
    msg("m4", "assistant", "Bakıyorum.", 208),
    msg("m5", "user", "", 209),
    msg("m6", "assistant", "Gion'da 3 ryokan buldum. En uygunu Gion Hatanaka: kahvaltı dahil ve ücretsiz iptal. Diğer ikisi Pano'da yan yana.", 220),
  ];
  const b = boardOf(t.trip, t.items, JAPAN_TODAY);
  const cards = chatCards({ trip: t.trip, messages, items: t.items, collections: b.collections });
  return { ...t, messages, b, cards };
}

beforeEach(() => setLang("tr"));

describe("C34: the record a turn put on the board, as the Plan's compact card", () => {
  const { by, b, cards } = japanChat();

  it("one card a turn, on its last reply; the saved link's line carries its record", () => {
    expect([...cards.keys()]).toEqual(["m2", "m6"]);
  });

  it("the link's stay, already chosen: its site, score, name, line, price and unit; a chip instead of a button", () => {
    expect(cards.get("m2")).toMatchObject({
      itemId: by.hyatt.id, brand: { label: "Booking.com" }, rating: "9", title: "Hyatt Centric Ginza", sub: "Ginza", price: { amount: "€213", unit: "/ gece" },
      state: "chosen", done: "Seçildi", pick: null,
    });
  });

  it("the reply names Gion Hatanaka first: that card, and 'Bunu seç' takes Gion Hatanaka itself (not our pick)", () => {
    const card = cards.get("m6")!;
    expect(card).toMatchObject({ itemId: by.hatanaka.id, rating: "9,3", title: "Gion Hatanaka", price: { amount: "€180", unit: "/ gece" }, state: "option", done: null, pick: { itemId: by.hatanaka.id, label: "Bunu seç" } });
    const box = b.intents.find((i) => i.section === "stay" && i.head.city === "Kyoto")!;
    // Our pick is another of the three; the card still takes what the reply named.
    expect(box.chosen?.id).not.toBe(by.hatanaka.id);
    expect(card.target).toEqual({ kind: "intent", intentKey: box.key, section: "stay", domKeys: box.domKeys, itemId: by.hatanaka.id });
  });

  it("not named: what the turn put on the plan, else our pick among what it found", () => {
    const { trip, items, by: o } = japan();
    when(o.motonago, 205);
    when(o.celestine, 206);
    when(o.hatanaka, 207);
    const board = boardOf(trip, items, JAPAN_TODAY);
    const said = [msg("u", "user", "Kyoto için bir yer bul", 200), msg("a", "assistant", "Üç yer buldum, karşılaştırdım.", 220)];
    const ours = board.intents.find((i) => i.section === "stay" && i.head.city === "Kyoto")!.chosen!;
    expect(chatCards({ trip, messages: said, items, collections: board.collections }).get("a")).toMatchObject({ itemId: ours.id, state: "suggested" });
    // A turn that chose one: that one.
    const chosen = items.map((i) => (i.id === o.motonago.id ? { ...i, status: "chosen" as const, statusAt: 210 } : i));
    const after = boardOf(trip, chosen, JAPAN_TODAY);
    expect(chatCards({ trip, messages: said, items: chosen, collections: after.collections }).get("a")).toMatchObject({ itemId: o.motonago.id, state: "chosen", done: "Seçildi" });
  });

  it("a card stays on its reply once its record moves on: taken later, it says Seçildi", () => {
    const t = japan();
    when(t.by.hatanaka, 50, 205);
    const messages = [msg("u", "user", "Kyoto'da daha sakin bir yer?", 200), msg("a", "assistant", "Gion Hatanaka daha sakin.", 220)];
    const first = chatCards({ trip: t.trip, messages, items: t.items, collections: boardOf(t.trip, t.items, JAPAN_TODAY).collections });
    expect(first.get("a")).toMatchObject({ itemId: t.by.hatanaka.id, done: null, pick: { label: "Bunu seç" } });
    // Chosen from the card a minute later: its change is no longer the turn's.
    const items = t.items.map((i) => (i.id === t.by.hatanaka.id ? { ...i, status: "chosen" as const, statusAt: 900 } : i));
    const collections = boardOf(t.trip, items, JAPAN_TODAY).collections;
    expect(chatCards({ trip: t.trip, messages, items, collections }).has("a")).toBe(false);
    const kept = new Map([...first].map(([id, c]) => [id, c.itemId]));
    expect(chatCards({ trip: t.trip, messages, items, collections, kept }).get("a")).toMatchObject({ itemId: t.by.hatanaka.id, done: "Seçildi", pick: null });
    // A record gone (ruled out), or a reply no longer there: no card.
    const gone = items.map((i) => (i.id === t.by.hatanaka.id ? { ...i, status: "dismissed" as const } : i));
    expect(chatCards({ trip: t.trip, messages, items: gone, collections, kept }).has("a")).toBe(false);
    expect(chatCards({ trip: t.trip, messages: messages.slice(0, 1), items, collections, kept }).size).toBe(0);
  });

  it("a turn that touched nothing has no card", () => {
    const { trip, items } = japan();
    const board = boardOf(trip, items, JAPAN_TODAY);
    const said = [msg("u", "user", "Kyoto'da hava nasıl?", 300), msg("a", "assistant", "Nisanda gündüz 18°, Gion Hatanaka'nın bahçesi de güzel.", 310)];
    expect(chatCards({ trip, messages: said, items, collections: board.collections }).size).toBe(0);
  });

  it("Ozora: the way back the AI added, not chosen yet: 'Bunu seç' on it, to its box", () => {
    const { trip, items, by: o } = ozora();
    when(o.busBack, 20);
    const board = boardOf(trip, items, JAPAN_TODAY);
    const said = [msg("o1", "user", "Ozora'ya gidiyoruz", 10, { tripId: "oz" }), msg("o2", "assistant", "Festival omurgasını kurdum. Dönüş otobüsünü de ekledim, henüz seçilmedi.", 30, { tripId: "oz" })];
    const card = chatCards({ trip, messages: said, items, collections: board.collections }).get("o2")!;
    expect(card).toMatchObject({ itemId: o.busBack.id, brand: { label: "Ozora Shuttle" }, sub: "2 Ağustos · 12:00", price: { amount: "€35", unit: "kişi başı" }, pick: { label: "Bunu seç" }, target: { kind: "intent", section: "transport" } });
  });

  it("a card of a row of things to do: 'Plana koy'", () => {
    const { trip, items, by: o } = japan();
    const board = boardOf(trip, items, JAPAN_TODAY);
    expect(chatCard("m", o.kiyomizu, board.collections)).toMatchObject({ state: "option", pick: { label: "Plana koy", itemId: o.kiyomizu.id }, target: { kind: "intent", section: "activity" } });
    expect(chatCard("m", o.teamlab, board.collections)).toMatchObject({ state: "chosen", done: "Planda", pick: null });
    expect(chatCard("m", o.shibuya, board.collections)).toMatchObject({ state: "booked", done: "Alındı" });
  });
});

describe("'Planda göster': its box, else the Pano, else its category", () => {
  it("an option past the box's first three is on the Pano, with its box chosen there", () => {
    const { trip, items } = japan();
    const fourth = stay("Kyoto Brighton", "Kyoto", "2027-04-05", "2027-04-09", "saved", { provider: "Booking.com", price: { amount: 1400, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });
    const all = [...items, fourth];
    const board = boardOf(trip, all, JAPAN_TODAY);
    const box = board.intents.find((i) => i.section === "stay" && i.head.city === "Kyoto")!;
    expect(box.optionCount).toBe(4);
    const hidden = box.itemIds.find((id) => !box.options.some((o) => o.id === id))!;
    expect(planTarget(all.find((i) => i.id === hidden)!, board.collections)).toEqual({ kind: "pano", section: "stay", intentKey: box.key, itemId: hidden });
  });

  it("an İlham link: the Pano; a record no box holds: its category", () => {
    const { trip, items } = japan();
    const board = boardOf(trip, items, JAPAN_TODAY);
    const reel = thing("Tokyo'da 3 günde ne yenir", "activity", "Tokyo", null, "saved", { url: "https://www.instagram.com/reel/abc" });
    const withReel = boardOf(trip, [...items, reel], JAPAN_TODAY);
    expect(planTarget(reel, withReel.collections)).toEqual({ kind: "pano", section: "inspo", intentKey: null, itemId: reel.id });
    const loose = thing("Kyoto Brighton", "stay", "Kyoto", null, "saved");
    expect(planTarget(loose, board.collections)).toEqual({ kind: "section", section: "stay", itemId: loose.id });
  });
});

describe("quick replies (at most three, fit to the last card)", () => {
  it("Kyoto's three ryokans on a trip with a budget, Osaka's bed still to find", () => {
    const { trip, messages, b, cards } = japanChat();
    expect(quickReplies({ trip, messages, cards, collections: b.collections })).toEqual(["Hangisi daha iyi?", "Bütçeme uyar mı?", "Osaka için de bak"]);
    expect(QUICK_MAX).toBe(3);
    expect(withLang("en", () => quickReplies({ trip, messages, cards, collections: b.collections }))).toEqual(["Which one is better?", "Does it fit my budget?", "Look for Osaka too"]);
  });

  it("no budget: no budget question; the reply asking its own question: its chips answer it", () => {
    const { trip, messages, b, cards } = japanChat();
    expect(quickReplies({ trip: { budget: null }, messages, cards, collections: b.collections })).toEqual(["Hangisi daha iyi?", "Osaka için de bak"]);
    const asked = [...messages.slice(0, -1), { ...messages.at(-1)!, choices: ["Evet, seç", "Hayır"] }];
    expect(quickReplies({ trip, messages: asked, cards, collections: b.collections })).toEqual([]);
  });

  it("one option and no other city waiting: nothing to suggest", () => {
    const { trip, items, by: o } = ozora();
    when(o.busBack, 20);
    const board = boardOf(trip, items, JAPAN_TODAY);
    const said = [msg("o1", "user", "Ozora'ya gidiyoruz", 10, { tripId: "oz" }), msg("o2", "assistant", "Dönüş otobüsünü de ekledim.", 30, { tripId: "oz" })];
    const cards = chatCards({ trip, messages: said, items, collections: board.collections });
    expect(quickReplies({ trip, messages: said, cards, collections: board.collections })).toEqual([]);
  });
});

describe("C35: a link dropped in the chat", () => {
  const capture = { id: "c1", url: "https://www.klook.com/activity/91234-kiyomizu-night/", title: null, itemId: null };

  it("couldn't be read: dashed card, Okunamadı, what went wrong, Tekrar dene and Kaldır, in the box it would go to", () => {
    expect(linkCard({ ...capture, status: "error", error: "Sayfa yanıt vermedi. Daha sonra tekrar dene." })).toEqual({
      captureId: "c1", state: "failed", site: "Klook", label: "klook.com/activity/91…", line: "Sayfa yanıt vermedi", tag: "Okunamadı", actions: ["retry", "remove"], section: "activity", itemId: null,
    });
    // Nothing said about why: nothing made up.
    expect(linkCard({ ...capture, status: "error", error: null }).line).toBe("Okunamadı");
  });

  it("being read, then on the board", () => {
    expect(linkCard({ ...capture, status: "processing", error: null })).toMatchObject({ state: "reading", line: "Klook okunuyor…", actions: [] });
    expect(linkCard({ ...capture, status: "done", error: null, itemId: "x" }, { section: "activity" })).toMatchObject({ state: "added", line: "✓ Etkinlik ve turlar'a eklendi", itemId: "x" });
    expect(withLang("en", () => linkCard({ ...capture, status: "error", error: null }))).toMatchObject({ tag: "Couldn't read it" });
  });

  it("the address, short", () => {
    expect(shortUrl("https://www.booking.com/hotel/jp/hyatt-centric-ginza.html")).toBe("booking.com/hotel/jp…");
    expect(shortUrl("https://maps.app.goo.gl/")).toBe("maps.app.goo.gl");
    expect(shortUrl(null)).toBe("");
  });
});
