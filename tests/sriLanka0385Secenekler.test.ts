// 0.38.5 (Z2): Emre's Ahangama stay "Harumalgoda" (9 nights, 24 Kasım – 3 Aralık) with three Airbnb pages, one booked.
// The box shows the booking big and the other two under it, the Pano and the plan the same three; a flight is looked
// for by itself once its ends and day are known; "Aranıyor" only while something looks; "Seç" on a pick takes the
// start's placeholder in place (one card); the chat's find_offers cards are the need's options too.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { chooseItem, fillOffer } from "../src/app/actions";
import { categorize } from "../src/lib/categories";
import { db } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { offerNeed, otherOptions, placeholderOf, statusChip } from "../src/lib/intentFrame";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { chatOptions, readOffersOpen, type Need, type Offer } from "../src/lib/offerSource";
import { queryOf } from "../src/lib/offerSources";
import { panoBoardOf } from "../src/lib/panoBoard";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder, placeholderPrint } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, StartGuide, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const base: Trip = {
  id: "t1", title: "Sri Lanka", confirmedDates: { start: "2026-11-24", end: "2026-12-03" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};
const at = { countries: ["LK"], countryNames: ["Sri Lanka"], adults: 2 };
const eur = (amount: number): Item["price"] => ({ amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 });
const nights = { start: "2026-11-24", end: "2026-12-03", source: "url" as const };

/** The start's place for the nights ("Ahangama Konaklama"), as startCreate makes it. */
const placeholder = () =>
  makeItem({ id: "ph", origin: "chat", status: "chosen", name: "Ahangama Konaklama", category: "stay", plannedKind: "stay", city: "Ahangama", needKey: "stay:ahangama", dates: { ...nights, source: "unverified" } });
const airbnb = (id: string, name: string, status: Item["status"], amount: number) =>
  makeItem({ id, name, category: "stay", city: "Ahangama", countryCode: "LK", needKey: "stay:ahangama", provider: "Airbnb", url: `https://www.airbnb.com/rooms/${id}`, dates: nights, guests: { adults: 2, children: null, rooms: 1 }, price: eur(amount), status });
const guide = (items: Item[]): StartGuide => ({ createdAt: 1, placeholders: Object.fromEntries(items.map((i) => [i.id, placeholderPrint(i)])) }) as StartGuide;

function board(items: Item[], trip: Trip = base) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const all = collectionsOf(input);
  const of = (id: string) => all.find((c) => c.section.id === id)?.intents ?? [];
  return { input, all, of, pano: panoBoardOf({ ...input, people: 2, me: null }) };
}

describe("Harumalgoda: the booking big, the other options under it", () => {
  const items = () => [placeholder(), airbnb("fh", "Fisherman's Hut", "booked", 20785), airbnb("sk", "Sisters Kabalana Room 4", "saved", 35573), airbnb("rn", "Remote Nest Cabins", "saved", 40979)];

  it("keeps the options a booking closed as its need's own: 1 big + 2 under it, the same 3 as the Pano", () => {
    const trip = { ...base, startGuide: guide([placeholder()]) };
    const r = board(items(), trip);
    const stays = r.of("stay");
    expect(stays).toHaveLength(1);
    const box = stays[0];
    expect(box.status).toBe("booked");
    expect(box.chosen?.id).toBe("fh");
    expect(otherOptions(box).map((o) => o.id).sort()).toEqual(["rn", "sk"]);
    expect(box.optionCount).toBe(3);
    const need = r.pano.cats.find((c) => c.section === "stay")!.needs[0];
    expect(need.options).toHaveLength(3);
    expect(need.key).toBe(box.key);
  });

  it("shows the others under a chosen one too, never under one still to decide (they are its frame)", () => {
    const chosen = board([airbnb("fh", "Fisherman's Hut", "chosen", 20785), airbnb("sk", "Sisters", "saved", 35573), airbnb("rn", "Remote Nest", "saved", 40979)]).of("stay")[0];
    expect(chosen.status).toBe("chosen");
    expect(otherOptions(chosen)).toHaveLength(2);
    const open = board([airbnb("sk", "Sisters", "saved", 35573), airbnb("rn", "Remote Nest", "saved", 40979)]).of("stay")[0];
    expect(otherOptions(open)).toEqual([]);
  });
});

describe("looked for by itself once the spine is known", () => {
  it("a flight's need: its two ends' airports and its day, the same key as the chat's", () => {
    const vm = { kind: "flight" as const, head: { route: { from: "Bodrum", to: "Kolombo" }, date: "2026-11-24", city: "Kolombo", nights: 0 } as never, ticket: { from: { place: "BJV" }, to: { place: "CMB" } } as never };
    const need = offerNeed(vm, at)!;
    expect(need).toMatchObject({ kind: "flight", section: "flight", from: "Bodrum", to: "Kolombo", fromCode: "BJV", toCode: "CMB", start: "2026-11-24", adults: 2 });
    expect(queryOf(need)).toContain("kind=flight");
    // No day yet: nothing to ask.
    expect(offerNeed({ ...vm, head: { route: { from: "Bodrum", to: "Kolombo" }, date: null } as never }, at)).toBeNull();
  });

  it("a stay's need from its nights and place, nothing without them", () => {
    const r = board([placeholder()], { ...base, startGuide: guide([placeholder()]) });
    const box = r.of("stay")[0];
    expect(offerNeed(box, at)).toMatchObject({ kind: "stay", city: "Ahangama", start: "2026-11-24", end: "2026-12-03" });
  });

  it("the row under the box is open unless the traveller closed it (asked once, the source keeps it for hours)", () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readOffersOpen("k", s, true)).toBe(true);
    store.set("k", "0");
    expect(readOffersOpen("k", s, true)).toBe(false);
    expect(readOffersOpen("x", s)).toBe(false);
  });
});

describe("Aranıyor says what is true", () => {
  it("says Aranıyor only while something looks, else that there is nothing yet", () =>
    withLang("tr", () => {
      const vm = { status: "searching" as const, word: "Aranıyor" };
      expect(statusChip(vm).text).toBe("Aranıyor");
      expect(statusChip(vm, true).text).toBe("Aranıyor");
      expect(statusChip(vm, false).text).toBe("Seçenek yok");
      expect(statusChip({ status: "booked", word: "Rezerve" }, false).text).toBe("Rezerve");
    }));
});

describe("Seç on a pick takes the start's placeholder in place", () => {
  const need: Need = { key: "stay:ahangama:2026-11-24:2026-12-03", section: "stay", kind: "stay", city: "Ahangama", start: "2026-11-24", end: "2026-12-03", adults: 2, country: "LK" };
  const offer: Offer = { id: "c1", kind: "stay", title: "Harumalgoda Villa", url: "https://www.tripadvisor.com/Hotel-x", why: "Plaja yakın", source: "Tripadvisor", fetchedAt: 1, price: 900, currency: "EUR" };

  it("finds the placeholder in the box, and choosing the filled one leaves one card, the placeholder gone", async () => {
    const ph = placeholder();
    const trip = { ...base, startGuide: guide([ph]) };
    expect(placeholderOf([ph], trip, "stay")?.id).toBe("ph");
    expect(placeholderOf([airbnb("x", "X", "chosen", 1)], trip, "stay")).toBeNull();
    await (await db()).put("items", ph);
    const filled = await fillOffer(ph, offer, need);
    expect(filled.id).toBe("ph");
    await chooseItem(filled, [ph]);
    const stored = (await (await db()).get("items", "ph"))!;
    expect(stored).toMatchObject({ name: "Harumalgoda Villa", status: "chosen", url: offer.url });
    expect(isPlaceholder(trip, stored)).toBe(false);
    const stays = board([stored], trip).of("stay");
    expect(stays).toHaveLength(1);
    expect(stays[0]).toMatchObject({ status: "chosen", itemIds: ["ph"] });
    expect(stays[0].chosen?.title).toBe("Harumalgoda Villa");
  });
});

describe("the chat's offers are the need's options", () => {
  const offer = (id: string, url = `https://www.tripadvisor.com/${id}`): Offer => ({ id, kind: "stay", title: id, url, why: "", source: "Tripadvisor", fetchedAt: 1 });

  it("saves a stay's or a flight's first three, never twice, never an activity's", () => {
    const list = [offer("a"), offer("b"), offer("c"), offer("d")];
    const had = [makeItem({ url: "https://www.tripadvisor.com/b" })];
    const out = chatOptions(list, { kind: "stay" }, had);
    expect(out.add.map((o) => o.id)).toEqual(["a", "c"]);
    expect(out.had.map((o) => o.id)).toEqual(["b"]);
    expect(chatOptions(list, { kind: "flight" }, []).add).toHaveLength(3);
    expect(chatOptions(list, { kind: "activity" }, []).add).toEqual([]);
  });
});
