// Two stays on the plan in the same city, on nights that don't meet (Emre, 0.36.55: "plana alınmışsa ikisi de ayrı
// tutulsun"): each is its own block, neither ruled out as "Farklı tarih için fiyat"; an option saved for the second's
// nights is compared with the second only.
import { describe, expect, it } from "vitest";
import { decideTrip, makeContext } from "../src/lib/decision";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const T = "trip";
const trip: Trip = { id: T, title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-19" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const stay = (id: string, name: string, start: string, end: string, status: "chosen" | "saved") =>
  makeItem({ tripId: T, id, name, category: "stay", city: "Porto", needKey: "stay:porto", dates: { start, end, source: "url" }, status });

describe("two stays on the plan, on nights apart", () => {
  it("are two blocks, both kept; the option for the later nights goes with the later one", () => {
    const items = [stay("a", "Jardim Stay", "2026-10-08", "2026-10-11", "chosen"), stay("b", "Ribeira Loft", "2026-10-16", "2026-10-19", "chosen"), stay("c", "Casa Azul", "2026-10-16", "2026-10-19", "saved")];
    const plan = buildPlan(trip, items);
    const blocks = buildTimeline(plan, buildLegs(plan, trip), items)
      .entries.filter((e) => e.kind === "stay")
      .map((e) => (e.kind === "stay" ? [e.block.kind, e.block.range.start, e.block.kind === "open" ? null : e.block.item.name] : null));
    expect(blocks).toEqual([
      ["chosen", "2026-10-08", "Jardim Stay"],
      ["open", "2026-10-11", null],
      ["chosen", "2026-10-16", "Ribeira Loft"],
    ]);
    const excluded = [...decideTrip(items, makeContext(trip, items)).values()].flatMap((d) => d.options.filter((o) => o.excluded).map((o) => o.item.name));
    expect(excluded).toEqual([]);
  });
});
