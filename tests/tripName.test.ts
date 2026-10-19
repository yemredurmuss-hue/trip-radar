// The trip's title the way a traveller names it (2026-10-19): how long, where, what kind; the model's theme when it
// reads right, the rules' otherwise; no year; the theme word, then the length, dropped when it runs long.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { cleanTheme, TITLE_MAX, tripName, type TitleState } from "../src/lib/tripName";
import type { CustomPlaybook } from "../src/lib/types";

const at = (place: string, more: Partial<TitleState> = {}): TitleState => ({ where: { place, country: null }, intent: null, messages: [], ...more });
const said = (text: string) => [{ role: "user" as const, text, at: 1 }];
const theme = (titleTheme: string) => ({ label: "x", titleTheme } as unknown as CustomPlaybook);

describe("the trip's title", () => {
  it("how long, where, what kind", () => {
    expect(tripName(at("Hurgada", { duration: { unit: "day", n: 7 }, playbook: theme("dalış gezisi") }))).toBe("7 Günlük Hurgada Dalış Gezisi");
    expect(tripName(at("Bali", { duration: { unit: "day", n: 15 }, messages: said("balayı için Bali") }))).toBe("15 Günlük Bali Balayı");
    expect(tripName(at("Kapadokya", { duration: { unit: "day", n: 3 }, playbook: theme("Aile Kutlaması") }))).toBe("3 Günlük Kapadokya Aile Kutlaması");
    expect(tripName(at("Sri Lanka", { duration: { unit: "week", n: 3 }, who: { kind: "friends", names: [] } }))).toBe("3 Haftalık Sri Lanka Arkadaş Gezisi");
    expect(tripName(at("Lizbon", { duration: { unit: "weekend", n: 1 } }))).toBe("Lizbon Hafta Sonu Kaçamağı");
    expect(tripName(at("Efes", { dayTrip: true }))).toBe("Efes Günübirlik Gezisi");
    expect(tripName(at("Bali"))).toBe("Bali Gezisi");
  });

  it("an event keeps its name without the year; a theme is said after its place", () => {
    const burn: TitleState = { where: { place: "Tankwa Karoo", country: null }, intent: { kind: "event", name: "Burning Man 2027", place: "Black Rock", country: null }, messages: [], duration: { unit: "day", n: 13 }, playbook: theme("Karavan Macerası") };
    expect(tripName(burn)).toBe("13 Günlük Burning Man Karavan Macerası");
    const lights: TitleState = { where: { place: "Tromsø", country: null }, intent: { kind: "theme", name: "Kuzey Işıkları", place: "Tromsø", country: null }, messages: [], duration: { unit: "night", n: 5 } };
    expect(tripName(lights)).toBe("6 Günlük Tromsø Kuzey Işıkları Gezisi");
  });

  it("the model's theme is dropped when it names the place, has a number or runs long", () => {
    expect(cleanTheme("Bali Balayı", "Bali")).toBeNull();
    expect(cleanTheme("3 gün dalış", "Hurgada")).toBeNull();
    expect(cleanTheme("çok güzel uzun bir dalış gezisi", "Hurgada")).toBeNull();
    expect(cleanTheme("“dalış gezisi”", "Hurgada")).toBe("Dalış Gezisi");
  });

  it("too long: the theme word goes first, then the length", () => {
    const t = tripName(at("Santa Cruz de Tenerife", { duration: { unit: "day", n: 12 }, who: { kind: "family", names: [] } }));
    expect(t).toBe("12 Günlük Santa Cruz de Tenerife Gezisi");
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("in English", () => {
    expect(withLang("en", () => tripName(at("Hurghada", { duration: { unit: "day", n: 7 }, playbook: theme("diving trip") })))).toBe("7-Day Hurghada Diving Trip");
    expect(withLang("en", () => tripName(at("Lisbon", { duration: { unit: "weekend", n: 1 } })))).toBe("Lisbon Weekend Getaway");
  });
});
