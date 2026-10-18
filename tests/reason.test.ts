import { describe, expect, it } from "vitest";
import { reasonItemOf } from "../src/lib/reason";

const act = (name: string, status = "chosen") => ({ id: name, name, category: "activity", status }) as never;
const trip = (playbook: string, name: string | null = "Ozora Festivali") => ({ intent: { playbook, name } }) as never;

describe("reasonItemOf", () => {
  it("is none on a classic trip", () => {
    expect(reasonItemOf(trip("classic"), [act("Festival bileti")])).toBeNull();
    expect(reasonItemOf({ intent: null } as never, [act("Festival bileti")])).toBeNull();
  });
  it("finds the festival ticket among the activities", () => {
    expect(reasonItemOf(trip("festival"), [act("Douro tekne turu"), act("Festival bileti")])?.name).toBe("Festival bileti");
  });
  it("prefers the one that names the event", () => {
    expect(reasonItemOf(trip("festival"), [act("Festival bileti"), act("Ozora Festivali · 7 günlük bilet")])?.name).toBe("Ozora Festivali · 7 günlük bilet");
  });
  it("reads accents loosely", () => {
    expect(reasonItemOf(trip("festival", "Özora Festivali"), [act("Ozora Festivali bileti")])?.name).toBe("Ozora Festivali bileti");
  });
  it("skips what was ruled out", () => {
    expect(reasonItemOf(trip("festival"), [act("Festival bileti", "dismissed")])).toBeNull();
  });
  it("is none when nothing reads like the reason", () => {
    expect(reasonItemOf(trip("festival"), [act("Douro tekne turu")])).toBeNull();
  });
});
