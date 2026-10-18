// A category's "Gizlenenler · n" (lib/hiddenIntents.ts, F3): what was said not needed comes as its head (nights with the
// options said not needed with them, a transfer, a whole need, a suggestion), one Geri al from its place; an option ruled
// out beside others, one a booking closed and a cancelled booking stay one line each.
import { describe, expect, it } from "vitest";
import type { HiddenThing } from "../src/lib/categories";
import { hiddenEntries, notNeededRule } from "../src/lib/hiddenIntents";
import type { Suggestion } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const stay = (id: string, start: string, end: string, over = {}) =>
  makeItem({ id, name: id, category: "stay", city: "Porto", needKey: "stay:porto", status: "dismissed", dismissedFrom: "saved", dates: { start, end, source: "page" }, ...over });
const esim = (id: string, over = {}) => makeItem({ id, name: id, category: "esim", needKey: "esim:pt", country: "Portekiz", status: "dismissed", dismissedFrom: "saved", ...over });
const gone = (item: ReturnType<typeof makeItem>, section: HiddenThing["section"] = "stay"): HiddenThing => ({ kind: "dismissed", key: `item:${item.id}`, section, item });

describe("hiddenEntries", () => {
  it("nights said not needed take their options with them; another night's ruled-out option stays a line", () => {
    const a = stay("Jardim", "2026-10-08", "2026-10-11");
    const b = stay("Ribeira", "2026-10-08", "2026-10-11");
    const other = stay("Alfama", "2026-10-11", "2026-10-14");
    const hidden: HiddenThing[] = [gone(a), gone(b), gone(other), { kind: "nights", key: "nights:2026-10-08_2026-10-11", section: "stay", range: { start: "2026-10-08", end: "2026-10-11" }, city: "Porto" }];
    const out = hiddenEntries({ id: "stay", hidden }, []);
    expect(out.map((e) => e.type)).toEqual(["nights", "row"]);
    expect(out[0]).toMatchObject({ type: "nights", name: "Porto", parts: ["3 gece", "8–11 Ekim"], hiddenKey: "nights:2026-10-08_2026-10-11" });
    expect(out[0].type === "nights" && out[0].items.map((i) => i.id)).toEqual(["Jardim", "Ribeira"]);
    expect(out[1]).toMatchObject({ type: "row", key: "item:Alfama" });
  });
  it("a need with every option said not needed is one head; with one still on the plan its ruled-out ones are lines", () => {
    const [a, b] = [esim("Airalo"), esim("Holafly")];
    const both = hiddenEntries({ id: "other", hidden: [gone(a, "other"), gone(b, "other")] }, []);
    expect(both.map((e) => e.type)).toEqual(["need"]);
    expect(both[0]).toMatchObject({ name: "eSIM · Portekiz", kind: "esim" });
    const live = makeItem({ category: "esim", needKey: "esim:pt", status: "chosen" });
    expect(hiddenEntries({ id: "other", hidden: [gone(a, "other")] }, [live]).map((e) => e.type)).toEqual(["row"]);
  });
  it("a cancelled booking and one a booking closed are lines; a suggestion said not needed in this category a head", () => {
    const cancelled = esim("Ubigi", { dismissedFrom: "booked", cancelledAt: 5 });
    const closed: HiddenThing = { kind: "closed", key: "item:x", section: "other", item: esim("x", { status: "saved" }), reason: "kapandı" };
    const s: Suggestion = { key: "rule:insurance", section: "other", kind: "add", title: "Seyahat sağlık sigortası", why: "", source: "rule", template: "insurance", createdAt: 1, state: "dismissed", payload: { start: "2026-10-08", end: "2026-10-14" } };
    const elsewhere: Suggestion = { ...s, key: "rule:x", section: "transport" };
    const out = hiddenEntries({ id: "other", hidden: [gone(cancelled, "other"), closed] }, [], [s, elsewhere, { ...s, key: "rule:open", state: "open" }]);
    expect(out.map((e) => [e.type, e.key])).toEqual([["suggestion", "suggestion:rule:insurance"], ["row", "item:Ubigi"], ["row", "item:x"]]);
    expect(out[0]).toMatchObject({ kind: "insurance", parts: ["8–14 Ekim"] });
  });
  it("a transfer said not needed", () => {
    const leg = { key: "l1", kind: "move", date: "2026-10-11", from: { city: "Porto", label: "Porto" }, to: { city: "Lizbon", label: "Lizbon" } };
    const out = hiddenEntries({ id: "transport", hidden: [{ kind: "leg", key: "leg:l1", section: "transport", leg: leg as never }] }, []);
    expect(out[0]).toMatchObject({ type: "leg", name: "Porto → Lizbon", hiddenKey: "leg:l1" });
  });
});

describe("notNeededRule", () => {
  it("an eSIM or a policy said not needed quiets its rule; a stay has none", () => {
    expect(notNeededRule("esim", "eSIM · Portekiz")).toMatchObject({ key: "rule:esim", template: "esim", source: "rule" });
    expect(notNeededRule("insurance", "Sigorta")?.key).toBe("rule:insurance");
    expect(notNeededRule("stay", "Porto")).toBeNull();
  });
  it("the quieted rule isn't a second head beside the need", () => {
    const a = esim("Airalo");
    const rule = { ...notNeededRule("esim", "eSIM")!, state: "dismissed" as const };
    expect(hiddenEntries({ id: "other", hidden: [gone(a, "other")] }, [], [rule]).map((e) => e.type)).toEqual(["need"]);
  });
});
