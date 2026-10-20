// P6 (flight honesty) and P7 (the visa asked first): the UX test's F32, F37, F38, F57.
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { nextLabel, nextStep } from "../src/lib/nextStep";
import { flightWarnings } from "../src/lib/ticketView";
import { statusChip } from "../src/lib/intentFrame";
import type { Item } from "../src/lib/types";

beforeEach(() => setLang("tr"));
const leg = (from: string, to: string, departure: string, arrival: string) => ({ flight: { from, to, departure, arrival, carrier: "KL", flightNumber: "1", stops: 0 } }) as unknown as Item;

describe("P6: what a flight's own times say", () => {
  it("a long wait between two legs, landing at night, leaving before the trip", () => {
    const out = flightWarnings([leg("IST", "AMS", "2026-11-14T18:00", "2026-11-14T20:45"), leg("AMS", "OPO", "2026-11-15T10:00", "2026-11-15T01:20".replace("15T01", "16T01"))], "2026-11-15");
    expect(out.map((c) => c.text)).toEqual(["Amsterdam'da 13 sa 15 dk bekleme", "Gece varış · 01:20", "Gezi başlangıcından 1 gün önce kalkış"]);
  });
  it("nothing said without the times, nor for a short change", () => {
    expect(flightWarnings([leg("IST", "AMS", "2026-11-15T08:00", "2026-11-15T10:45"), leg("AMS", "OPO", "2026-11-15T12:00", "2026-11-15T14:00")], "2026-11-15")).toEqual([]);
    expect(flightWarnings([{ flight: null } as unknown as Item], "2026-11-15")).toEqual([]);
  });
  it("the traveller's own save waiting for a yes says so, without our sparkle", () => {
    expect(statusChip({ status: "suggested", word: "Senin kaydın", own: true })).toEqual({ tone: "todo", text: "Senin kaydın · onayla", tick: false });
    expect(statusChip({ status: "suggested", word: "Önerimiz" }).text).toBe("✨ Önerimiz · onayla");
  });
});

describe("P7: a Schengen visa never answered is a question", () => {
  it("Sıradaki asks your visa, not an appointment", () => {
    const ask = nextStep({ intents: [], saved: true, visa: true, visaAsk: true, sharable: false });
    expect(nextLabel(ask)).toBe("Sıradaki: vize durumun");
    expect(nextLabel(nextStep({ intents: [], saved: true, visa: true, sharable: false }))).toBe("Sıradaki: vize randevusu");
  });
});
