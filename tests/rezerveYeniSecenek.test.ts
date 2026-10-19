// 0.39.0 (S1): Emre's Ahangama stay booked on Airbnb, a second Airbnb saved later from the extension for the same nights (or a
// night less). It is always one of the box's other options ("Diğer seçenekler (1)") and on the Pano; "Seç" under the booking
// is "Bununla değiştir", asked first: yes counts the booking cancelled (under Gizlenenler, Geri getir books it again) and
// chooses the new one, both still on the Pano; no leaves everything. In a box only chosen, "Seç" switches as before.
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { CardEnvContext, type CardEnv } from "../src/app/cards/PlanCard";
import { OptionList } from "../src/app/plan/v82/OptionCompact";
import { chooseItem, replaceBooking, setItemStatus } from "../src/app/actions";
import { categorize } from "../src/lib/categories";
import { db } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { otherOptions } from "../src/lib/intentFrame";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { othersLabel } from "../src/lib/othersFold";
import { panoBoardOf } from "../src/lib/panoBoard";
import { buildPlan } from "../src/lib/plan";
import { bookingReplaced, pickWord, replaceAsk } from "../src/lib/replaceBooking";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const trip: Trip = {
  id: "t1", title: "Sri Lanka", confirmedDates: { start: "2026-11-24", end: "2026-12-03" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};
const nights = { start: "2026-11-24", end: "2026-12-03", source: "url" as const };
const airbnb = (id: string, name: string, status: Item["status"], dates: Item["dates"] = nights) =>
  makeItem({ id, tripId: "t1", name, category: "stay", city: "Ahangama", countryCode: "LK", needKey: "stay:ahangama", provider: "Airbnb", url: `https://www.airbnb.com/rooms/${id}`, dates, status });

function board(items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const stays = collectionsOf(input).find((c) => c.section.id === "stay")?.intents ?? [];
  const pano = panoBoardOf({ ...input, people: 2, me: null });
  const panoStays = pano.cats.find((c) => c.section === "stay")?.needs ?? [];
  return { stays, panoStays, sections };
}

const booked = () => airbnb("fh", "Fisherman's Hut", "booked");
const added = (dates: Item["dates"] = nights) => airbnb("rn", "Remote Nest Cabins", "saved", dates);
const all = async () => (await (await db()).getAll("items")).filter((i) => i.tripId === "t1");

beforeEach(async () => {
  const d = await db();
  for (const i of await d.getAll("items")) await d.delete("items", i.id);
  await d.put("trips", trip);
});

describe("a page saved later under a booking is always one of its options", () => {
  it("same nights: Diğer seçenekler (1) in the box, 2 on the Pano", () =>
    withLang("tr", () => {
      const r = board([booked(), added()]);
      expect(r.stays).toHaveLength(1);
      expect(r.stays[0].status).toBe("booked");
      expect(otherOptions(r.stays[0]).map((o) => o.id)).toEqual(["rn"]);
      expect(othersLabel(otherOptions(r.stays[0]).length)).toBe("Diğer seçenekler (1)");
      expect(r.panoStays.flatMap((n) => n.options.map((o) => o.id)).sort()).toEqual(["fh", "rn"]);
    }));

  it("a night less (the page's own dates): still under the booking that closed it, and on the Pano", () => {
    const r = board([booked(), added({ start: "2026-11-25", end: "2026-12-03", source: "url" })]);
    expect(otherOptions(r.stays[0]).map((o) => o.id)).toEqual(["rn"]);
    expect(r.panoStays.flatMap((n) => n.options.map((o) => o.id)).sort()).toEqual(["fh", "rn"]);
  });

  it("chosen under the booking (the old Seç): never gone, in the box and on the Pano", () => {
    const r = board([booked(), airbnb("rn", "Remote Nest Cabins", "chosen")]);
    expect(r.stays[0].chosen?.id).toBe("fh");
    expect(otherOptions(r.stays[0]).map((o) => o.id)).toEqual(["rn"]);
    expect(r.panoStays.flatMap((n) => n.options.map((o) => o.id)).sort()).toEqual(["fh", "rn"]);
  });
});

describe("Bununla değiştir", () => {
  it("the button and its question say what happens, nothing about money", () =>
    withLang("tr", () => {
      expect(pickWord(true)).toBe("Bununla değiştir");
      expect(pickWord(false)).toBe("Seç");
      expect(bookingReplaced([booked(), added()], added())).toBe("fh");
      expect(bookingReplaced([airbnb("a", "A", "chosen"), added()], added())).toBeNull();
      expect(bookingReplaced([booked()], booked())).toBeNull();
      const ask = replaceAsk(booked(), added());
      expect(ask.text).toBe("Fisherman's Hut rezervasyonun var. Remote Nest Cabins seçilirse Fisherman's Hut rezervasyonu iptal edildi sayılır.");
      expect(ask.ok).toBe("Değiştir");
      expect(ask.text).not.toMatch(/iade|para/i);
    }));

  it("Değiştir: the new one chosen, the booking cancelled under Gizlenenler, both on the Pano; Geri getir books it again", async () => {
    const d = await db();
    for (const i of [booked(), added()]) await d.put("items", i);
    await withLang("tr", () => replaceBooking(added(), booked(), [booked(), added()]));
    const after = await all();
    const old = after.find((i) => i.id === "fh")!;
    expect(old).toMatchObject({ status: "dismissed", dismissedFrom: "booked" });
    expect(old.cancelledAt).toBeTypeOf("number");
    expect(after.find((i) => i.id === "rn")!.status).toBe("chosen");
    const r = board(after);
    expect(r.stays[0]).toMatchObject({ status: "chosen" });
    expect(r.stays[0].chosen?.id).toBe("rn");
    expect(r.sections.find((s) => s.id === "stay")!.hidden.some((h) => h.kind === "dismissed" && h.item.id === "fh")).toBe(true);
    const pano = r.panoStays.flatMap((n) => n.options);
    expect(pano.map((o) => o.id).sort()).toEqual(["fh", "rn"]);
    expect(pano.find((o) => o.id === "fh")?.cancelled).toBe(true);
    const lines = (await d.getAll("messages")).filter((m) => m.tripId === "t1" && m.role === "event").map((m) => m.text);
    expect(lines).toContain("Fisherman's Hut iptal edildi sayıldı, yerine Remote Nest Cabins seçildi");
    // Gizlenenler's "Geri getir" (setItemStatus saved on a cancelled booking): booked again, the new one under it.
    await setItemStatus(old, "saved");
    const back = await all();
    expect(back.find((i) => i.id === "fh")!.status).toBe("booked");
    expect(back.find((i) => i.id === "fh")!.cancelledAt).toBeUndefined();
    const again = board(back);
    expect(again.stays[0].chosen?.id).toBe("fh");
    expect(otherOptions(again.stays[0]).map((o) => o.id)).toEqual(["rn"]);
  });

  it("the box's cards say Bununla değiştir under a booking, Seç otherwise", () =>
    withLang("tr", () => {
      const box = board([booked(), added()]).stays[0];
      const others = otherOptions(box);
      const draw = (replacing: boolean) =>
        renderToStaticMarkup(
          createElement(
            CardEnvContext.Provider,
            { value: { focus: null, setFocus: () => undefined } as unknown as CardEnv },
            createElement(OptionList, { vm: box, options: others, current: null, changing: false, replacing, art: "", links: [], onPick: () => undefined, onOpen: () => undefined, onCancel: () => undefined, onAsk: null }),
          ),
        );
      expect(draw(true)).toContain(">Bununla değiştir</button>");
      expect(draw(true)).toContain('aria-label="Remote Nest Cabins: bununla değiştir"');
      expect(draw(false)).toContain(">Seç</button>");
    }));
});

describe("a box only chosen: Seç switches and the one before stays an option", () => {
  it("the previous choice goes back to the options, in the fold and on the Pano", async () => {
    const d = await db();
    const first = airbnb("fh", "Fisherman's Hut", "chosen");
    for (const i of [first, added()]) await d.put("items", i);
    await chooseItem(added(), [first, added()]);
    const after = await all();
    expect(after.find((i) => i.id === "fh")!.status).toBe("saved");
    const r = board(after);
    expect(r.stays[0].chosen?.id).toBe("rn");
    expect(otherOptions(r.stays[0]).map((o) => o.id)).toEqual(["fh"]);
    expect(r.panoStays.flatMap((n) => n.options.map((o) => o.id)).sort()).toEqual(["fh", "rn"]);
  });
});
