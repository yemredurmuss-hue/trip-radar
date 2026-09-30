// The judge across listings: one passing problem two guests reported doesn't sink the best option, and
// what the reviews say is weighed against the others, not alone.
import { describe, expect, it } from "vitest";
import { decideGroup, makeContext } from "../src/lib/decision";
import type { Trip } from "../src/lib/types";
import { scaffoldingScene, TODAY } from "./fixtures/scaffolding";

/** The scene decided, with trip settings that may name the scaffolding finding's key. */
function decide(over: (key: string) => Partial<Trip> = () => ({})) {
  const scene = scaffoldingScene();
  const key = `item:${scene.a.id}#condition:negative`;
  const trip = { ...scene.trip, ...over(key) };
  const ctx = makeContext(trip, scene.items, { listings: scene.listings, today: TODAY });
  const d = decideGroup(scene.items, ctx);
  const ranked = d.options.filter((o) => !o.excluded);
  const place = ranked.findIndex((o) => o.item.id === scene.a.id) + 1;
  return { ...scene, ctx, d, ranked, place, casa: ranked[place - 1], key };
}

describe("the scaffolding case", () => {
  it("keeps the best option near the top when one passing issue from March isn't mentioned since", () => {
    const { casa, place, ranked } = decide();
    expect(casa.eliminated).toBeNull();
    expect(casa.fit).not.toBe("unfit");
    expect(place).toBeLessThanOrEqual(2);
    expect(place).not.toBe(ranked.length);
  });

  it("rules it out only when the traveller says the scaffolding matters to them; 'sorun değil' takes it off", () => {
    const out = decide((key) => ({ confirmedFindings: [key] }));
    expect(out.place).toBe(out.ranked.length);
    expect(out.casa).toMatchObject({ fit: "unfit", eliminated: { reason: "Dışarıda iskele kuruldu (2 yorum); önemli dedin" } });
    const fine = decide((key) => ({ acceptedFindings: [key] }));
    expect(fine.place).toBe(1);
    expect(fine.casa.penalties).toEqual([]);
    expect(fine.casa.fitNotes).toEqual([]);
  });
});
