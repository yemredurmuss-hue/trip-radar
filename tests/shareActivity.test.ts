import { describe, expect, it } from "vitest";
import { actionsOf, agoText, latestOf, othersSince } from "../src/lib/share/activity";
import type { SettingsNotice } from "../src/lib/share/notices";
import type { Vote } from "../src/lib/share/votes";
import { makeItem } from "./fixtures/makeItem";

const jardim = makeItem({ id: "j", name: "Jardim Stay", key: "booking:pt/jardim", createdAt: Date.parse("2026-10-09T10:00:00Z") });
const casa = makeItem({ id: "c", name: "Casa Azul", key: "booking:pt/casa", addedBy: "Sabine", createdAt: Date.parse("2026-10-09T12:00:00Z") });
const ai = makeItem({ id: "a", name: "AI pick", key: "booking:pt/ai", addedBy: "ai", createdAt: Date.parse("2026-10-09T13:00:00Z") });
const chat = makeItem({ id: "x", name: "Chat plan", origin: "chat", createdAt: Date.parse("2026-10-09T14:00:00Z") });
const vote = (author: string, itemKey: string, v: Vote["vote"], at: string): Vote => ({ itemKey, author, vote: v, note: null, updatedAt: at });
const notice = (author: string, at: string): SettingsNotice =>
  ({ id: `${at}|${author}`, author, at, seenAt: 0, prev: {}, next: {}, fields: ["confirmedDates"] }) as unknown as SettingsNotice;
const input = {
  me: "Emre",
  items: [jardim, casa, ai, chat],
  votes: [vote("Sabine", "booking:pt/jardim", 1, "2026-10-09T15:00:00Z"), vote("Emre", "booking:pt/casa", -1, "2026-10-09T16:00:00Z"), vote("Sabine", "booking:pt/gone", 1, "2026-10-09T17:00:00Z")],
  notices: [notice("Sabine", "2026-10-09T11:00:00Z")],
};

describe("who did what", () => {
  it("lists what is recorded, newest first: votes of pages still here, pages saved by a person, settings changes; not the AI's, not the chat's", () => {
    const list = actionsOf(input);
    expect(list.map((a) => [a.who, a.text])).toEqual([
      ["Emre", "Oy verdi: 👎 Casa Azul"],
      ["Sabine", "Oy verdi: 👍 Jardim Stay"],
      ["Sabine", "Kaydetti: Casa Azul"],
      ["Sabine", "tarihleri değiştirdi"],
      ["Emre", "Kaydetti: Jardim Stay"],
    ]);
  });
  it("gives one traveller's latest action, or null for someone nothing is recorded of", () => {
    expect(latestOf("sabine", input)?.text).toBe("Oy verdi: 👍 Jardim Stay");
    expect(latestOf("Emre", input)?.text).toBe("Oy verdi: 👎 Casa Azul");
    expect(latestOf("Ayşe", input)).toBeNull();
  });
  it("tells what the others did since a time (not what I did)", () => {
    const since = Date.parse("2026-10-09T11:30:00Z");
    expect(othersSince(since, input).map((a) => a.text)).toEqual(["Oy verdi: 👍 Jardim Stay", "Kaydetti: Casa Azul"]);
    expect(othersSince(Date.parse("2026-10-10T00:00:00Z"), input)).toEqual([]);
  });
  it("says how long ago", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    expect(agoText(now - 20_000, now)).toBe("az önce");
    expect(agoText(now - 12 * 60_000, now)).toBe("12 dk önce");
    expect(agoText(now - 3 * 3600_000, now)).toBe("3 sa önce");
    expect(agoText(now - 50 * 3600_000, now)).toBe("2 gün önce");
  });
});
