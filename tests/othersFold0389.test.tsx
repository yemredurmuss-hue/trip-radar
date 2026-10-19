// 0.38.9 (T2, Emre: "Seç diyorum, seçenekler hâlâ orada açık kalıyor"): on his İstanbul → Şarm El-Şeyh trip, once a stay
// is chosen (or booked) the options under its box fold to "Diğer seçenekler (3)", a button that opens and closes them;
// a stay still to decide keeps its options open in its frame; a new page starts a chosen box folded.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OthersFold } from "../src/app/plan/v82/IntentBox";
import { categorize } from "../src/lib/categories";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { frameForm, otherOptions } from "../src/lib/intentFrame";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { othersLabel, othersOpen, rememberOthers } from "../src/lib/othersFold";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const trip: Trip = {
  id: "eg", title: "Mısır", confirmedDates: { start: "2026-11-10", end: "2026-11-17" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};
const nights = { start: "2026-11-10", end: "2026-11-17", source: "url" as const };
const hotel = (id: string, name: string, status: Item["status"], amount: number) =>
  makeItem({
    id, name, status, category: "stay", city: "Şarm El-Şeyh", countryCode: "EG", needKey: "stay:sarm", provider: "Booking", url: `https://www.booking.com/hotel/eg/${id}.html`, dates: nights,
    guests: { adults: 2, children: null, rooms: 1 }, price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
  });

function stayBox(items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  return collectionsOf(input).find((c) => c.section.id === "stay")!.intents[0];
}

const list = <div className="q-opts">3 cards</div>;

describe("Şarm El-Şeyh: a chosen stay's other options fold to one line", () => {
  const four = (first: Item["status"]) => [hotel("rx", "Rixos Sharm", first, 1400), hotel("sb", "Sunrise Arabian", "saved", 900), hotel("jz", "Jaz Mirabel", "saved", 1100), hotel("st", "Stella Di Mare", "saved", 1250)];

  it("chosen: three wait under it, folded at first, the line says how many", () => {
    const box = stayBox(four("chosen"));
    expect(box.status).toBe("chosen");
    const others = otherOptions(box);
    expect(others).toHaveLength(3);
    const key = `${trip.id}:${box.key}`;
    expect(othersOpen(key, true)).toBe(false);
    const html = withLang("tr", () => renderToStaticMarkup(<OthersFold count={others.length} open={false} onToggle={() => undefined}>{list}</OthersFold>));
    expect(html).toContain('<button type="button" class="q-ofold" aria-expanded="false"');
    expect(html).toContain("Diğer seçenekler (3)");
    expect(html).not.toContain("3 cards");
  });

  it("a tap opens them (remembered on this page), another folds them; a pick folds them too", () => {
    const key = `${trip.id}:${stayBox(four("chosen")).key}`;
    rememberOthers(key, true);
    expect(othersOpen(key, true)).toBe(true);
    const html = withLang("tr", () => renderToStaticMarkup(<OthersFold count={3} open onToggle={() => undefined}>{list}</OthersFold>));
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("3 cards");
    expect(html).toContain('class="q-offers q-others open"');
    rememberOthers(key, false);
    expect(othersOpen(key, true)).toBe(false);
  });

  it("booked: the same folded line", () => {
    const box = stayBox(four("booked"));
    expect(box.status).toBe("booked");
    expect(otherOptions(box)).toHaveLength(3);
  });

  it("nothing chosen yet (our pick waits, Karar bekliyor): no folded line, the options in the frame as before", () => {
    const box = stayBox(four("saved"));
    expect(frameForm(box)).toBe("suggested");
    const two = stayBox([hotel("sb", "Sunrise Arabian", "saved", 900), hotel("jz", "Jaz Mirabel", "saved", 900)]);
    expect(otherOptions(two)).toEqual([]);
    expect(otherOptions(box)).toEqual([]);
    expect(othersOpen("any", false)).toBe(true);
  });

  it("says it in English too", () => {
    expect(withLang("en", () => othersLabel(3))).toBe("Other options (3)");
  });
});
