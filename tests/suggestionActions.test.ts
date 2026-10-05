// "Plana ekle" and "Gerek yok" on a suggestion, their 8-second "Geri al", and Geçmiş's "Geri getir".
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addSuggested, dismissSuggestion, restoreSuggestion, undo } from "../src/app/actions";
import { db, listItems, listMessages } from "../src/lib/db";
import { buildHistory, type HistoryInput } from "../src/lib/history";
import { shownSuggestions } from "../src/lib/suggestions";
import type { Suggestion, Trip } from "../src/lib/types";
import { undoText, undoTrip } from "../src/lib/undoables";

const trip = (id: string): Trip => ({ id, title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });
const monthly = (): Suggestion => ({
  key: "rule:monthly-vehicle:ubud", section: "transport", kind: "add", title: "Aylık motor ya da araç kiralama", why: "31 gece Ubud'da kalıyorsun.",
  source: "rule", template: "moto", payload: { city: "Ubud", start: "2026-12-10", end: "2027-01-10" }, createdAt: 0, state: "open",
});
const esim = (): Suggestion => ({ key: "rule:esim", section: "other", kind: "add", title: "eSIM (Endonezya)", why: "Planda eSIM yok.", source: "rule", template: "esim", payload: { title: "eSIM (Endonezya)" }, createdAt: 0, state: "open" });
const stored = async (id: string) => (await (await db()).get("trips", id))!;

describe("Plana ekle", () => {
  it("adds the real record through its template, marks the suggestion added, and Geri al takes both back", async () => {
    await (await db()).put("trips", trip("sa1"));
    const u = (await addSuggested("sa1", monthly(), "rental-1"))!;
    expect(undoTrip(u)).toBe("sa1");
    expect(undoText(u)).toMatch(/plana eklendi$/);
    const items = await listItems("sa1");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "rental-1", plannedKind: "moto_rental", city: "Ubud", status: "chosen", dates: { start: "2026-12-10", end: "2027-01-10" } });
    expect((await stored("sa1")).suggestions).toMatchObject([{ key: "rule:monthly-vehicle:ubud", state: "added" }]);
    expect(shownSuggestions((await stored("sa1")).suggestions, [monthly()])).toEqual([]);

    await undo(u);
    expect(await listItems("sa1")).toEqual([]);
    expect((await stored("sa1")).suggestions).toEqual([]); // a rule's card shows again while the rule holds
    expect(shownSuggestions((await stored("sa1")).suggestions, [monthly()]).map((s) => s.key)).toEqual(["rule:monthly-vehicle:ubud"]);
    // Nothing of the traveller's went to the trash.
    expect(await (await db()).getAll("trash")).toEqual([]);
  });

  it("has nothing to add for a warning", async () => {
    await (await db()).put("trips", trip("sa2"));
    const warning: Suggestion = { key: "rule:short-layover:a:b", section: "flight", kind: "warning", title: "Kısa aktarma: 40 dk (DOH)", why: "Ayrı biletler.", source: "rule", createdAt: 0, state: "open" };
    expect(await addSuggested("sa2", warning)).toBeNull();
    expect(await listItems("sa2")).toEqual([]);
  });
});

describe("Gerek yok", () => {
  it("is kept on the trip, shows in Geçmiş with Geri getir, and comes back from there (or from Geri al)", async () => {
    await (await db()).put("trips", trip("sa3"));
    const u = await dismissSuggestion("sa3", esim());
    expect(undoText(u)).toBe("eSIM (Endonezya): gerek yok");
    let t = await stored("sa3");
    expect(t.suggestions).toMatchObject([{ key: "rule:esim", state: "dismissed" }]);
    expect(shownSuggestions(t.suggestions, [esim()])).toEqual([]);

    const events = await listMessages("sa3");
    const input: HistoryInput = {
      me: "", settings: null, notices: [], undone: [], events, trash: [], items: [], current: null, now: Date.now(),
      hidden: (t.suggestions ?? []).filter((s) => s.state === "dismissed").map((s) => ({ kind: "suggestion" as const, key: s.key, label: s.title, at: s.stateAt ?? null })),
    };
    const rows = buildHistory(input);
    // One row with its way back; the history line isn't shown a second time.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verb: "Gerek yok", text: "eSIM (Endonezya)", action: { kind: "restore-suggestion", key: "rule:esim" } });

    await restoreSuggestion("sa3", "rule:esim", "eSIM (Endonezya)");
    t = await stored("sa3");
    expect(t.suggestions).toEqual([]);
    expect(shownSuggestions(t.suggestions, [esim()]).map((s) => s.key)).toEqual(["rule:esim"]);

    // Geri al does the same.
    const again = await dismissSuggestion("sa3", esim());
    await undo(again);
    expect((await stored("sa3")).suggestions).toEqual([]);
  });

  it("keeps a chat suggestion's record when it opens again", async () => {
    await (await db()).put("trips", trip("sa4"));
    const chat: Suggestion = { ...esim(), key: "chat:todo:todo:pirinc", section: "todo", template: "todo", source: "chat", title: "Pirinç terasları" };
    await (await db()).put("trips", { ...trip("sa4"), suggestions: [chat] });
    await dismissSuggestion("sa4", chat);
    expect((await stored("sa4")).suggestions).toMatchObject([{ key: chat.key, state: "dismissed" }]);
    await restoreSuggestion("sa4", chat.key, chat.title);
    expect((await stored("sa4")).suggestions).toMatchObject([{ key: chat.key, state: "open" }]);
  });
});
