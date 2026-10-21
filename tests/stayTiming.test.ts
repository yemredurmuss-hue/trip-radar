// A stay's hours against the flight either side (lib/stayTiming.ts, Kaçırdıklarımız 2): legs.ts's notes found again for the
// stay at that end, the way in first.
import { describe, expect, it } from "vitest";
import type { CatSection } from "../src/lib/categories";
import type { Leg } from "../src/lib/legs";
import { stayTimings, timingAsk } from "../src/lib/stayTiming";
import { makeItem } from "./fixtures/makeItem";

const rimping = makeItem({ id: "rim", category: "stay", name: "Rimping Village" });
const amari = makeItem({ id: "ama", category: "stay", name: "Amari Bangkok" });
const leg = (key: string, kind: Leg["kind"], from: Leg["from"]["item"], to: Leg["to"]["item"], notes: string[]) =>
  ({ key, kind, from: { label: "", city: null, item: from }, to: { label: "", city: null, item: to }, notes }) as unknown as Leg;
const section = (legs: Leg[]): Pick<CatSection, "entries"> => ({ entries: legs.map((l) => ({ piece: { kind: "entry", entry: { kind: "leg", leg: l } } })) as unknown as CatSection["entries"] });

describe("stayTimings", () => {
  it("landing late on the stay at its end; leaving hours after check-out on the one it leaves", () => {
    const m = stayTimings([
      section([
        leg("a", "arrival", null, rimping, ["Geç varış (22:35): girişin nasıl olacağını önceden sor; bu saatte toplu taşıma seyrek olabilir.", "Havalimanı servisi var"]),
        leg("d", "departure", amari, null, ["Gidiş 15:15: 12:15 civarı havalimanında olmalısın", "Çıkış 11:00 (genelde), gidiş 15:15: arada ~4 saat boşluk; bavul emaneti ya da geç çıkış sor."]),
      ]),
    ]);
    expect(m.get("rim")).toMatchObject({ end: "in", act: "Geç giriş bildir" });
    expect(m.get("ama")).toMatchObject({ end: "out", act: "Geç çıkış sor", text: "Çıkış 11:00 (genelde), gidiş 15:15: arada ~4 saat boşluk; bavul emaneti ya da geç çıkış sor." });
    expect(timingAsk(m.get("rim")!, "Rimping Village")).toMatch(/^Rimping Village için geç giriş mesajı yaz: Geç varış/);
  });
  it("notes about the metro or a shuttle aren't the stay's hours", () => {
    expect(stayTimings([section([leg("d", "departure", amari, null, ["Gidiş 05:10: 02:40 civarı havalimanında olmalısın; bu saatte metro ve otobüs çalışmıyor olabilir"])])]).size).toBe(0);
  });
});
