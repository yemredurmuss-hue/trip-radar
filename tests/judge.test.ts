// The judge across listings: one passing problem two guests reported doesn't sink the best option, and
// what the reviews say is weighed against the others, not alone.
import { describe, expect, it } from "vitest";
import { decideGroup, makeContext } from "../src/lib/decision";
import { scaffoldingScene, TODAY } from "./fixtures/scaffolding";

describe("the scaffolding case", () => {
  // Fails before 0.28: two March reviews ruled the place out "for anyone" and sent it to the bottom.
  it.fails("keeps the best option near the top when one passing issue from March isn't mentioned since", () => {
    const { a, items, listings, trip } = scaffoldingScene();
    const ctx = makeContext(trip, items, { listings, today: TODAY });
    const d = decideGroup(items, ctx);
    const ranked = d.options.filter((o) => !o.excluded);
    const place = ranked.findIndex((o) => o.item.id === a.id) + 1;
    const casa = ranked[place - 1];
    expect(casa.eliminated).toBeNull();
    expect(casa.fit).not.toBe("unfit");
    expect(place).toBeLessThanOrEqual(2);
    expect(place).not.toBe(ranked.length);
  });
});
