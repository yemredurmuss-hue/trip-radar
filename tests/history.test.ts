// tests/history.test.ts — Geçmiş ve çöp kutusu: four sources in one list, each row with its way back, by day.
import { afterEach, describe, expect, it } from "vitest";
import { buildHistory, dayLabel, filterRows, groupByDay, segmentsOf, type HistoryInput } from "../src/lib/history";
import { setLang } from "../src/lib/i18n";
import type { SettingsNotice } from "../src/lib/share/notices";
import { asSettings, settingsOf, type SyncedSettings } from "../src/lib/share/settings";
import type { SettingsChange } from "../src/lib/share/settingsHistory";
import type { ChatMessage, Trip, TrashEntry } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

// Local times, so "Bugün"/"Dün" don't depend on the machine's time zone.
const NOW = new Date(2026, 9, 5, 22, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const base: Trip = { id: "t1", title: "Porto", confirmedDates: { start: "2026-10-07", end: "2026-10-18" }, budget: { amount: 100000, currency: "TRY" }, heroImage: null, createdAt: 1, updatedAt: 1 };
const s = (over: Partial<SyncedSettings> = {}): SyncedSettings => ({ ...settingsOf(base), ...over });
const change = (id: number, author: string, when: number, prev: SyncedSettings, next: SyncedSettings, fields: SettingsChange["fields"]): SettingsChange => ({ id, author, prev, next, at: iso(when), fields });
const event = (id: string, text: string, when: number): ChatMessage => ({ id, tripId: "t1", role: "event", content: null, text, choices: [], createdAt: when });

const input = (over: Partial<HistoryInput>): HistoryInput => ({ me: "Emre", settings: null, notices: [], undone: [], events: [], trash: [], hidden: [], items: [], now: NOW, ...over });

const DATES_8 = { confirmedDates: { start: "2026-10-08", end: "2026-10-18" } };

describe("the history", () => {
  it("merges the server's settings, the trash, what's hidden and the history lines, newest first", () => {
    const lello = makeItem({ id: "lello", tripId: "t1", name: "Livraria Lello" });
    const bawhee = makeItem({ id: "bawhee", tripId: "t1", name: 'Renault Campervan "Bawhee"', status: "dismissed", dismissedFrom: "chosen", statusAt: at(5, 20, 12) });
    const trash: TrashEntry = { id: "tr1", tripId: "t1", kind: "item", deletedAt: at(4, 9), label: "Casa do Rio", payload: { item: makeItem({ name: "Casa do Rio" }), docs: [] } };
    const rows = buildHistory(
      input({
        settings: [
          change(2, "Sabine", at(5, 21, 40), s(), s(DATES_8), ["confirmedDates"]),
          change(1, "Sabine", at(5, 21, 38), s({ budget: { amount: 100000, currency: "TRY" } }), s({ budget: { amount: 80000, currency: "TRY" } }), ["budget"]),
        ],
        events: [
          event("e1", "Sabine gezinin ayarlarını güncelledi", at(5, 21, 41)), // said by the server rows
          event("e2", 'Renault Campervan "Bawhee" sohbetten kaldırıldı (Gizlenenler\'de)', at(5, 20, 12)),
          event("e3", "Gaula → Madeira: gerek yok denildi, gizlendi", at(5, 20, 10)),
          event("e4", "✓ Livraria Lello kaydedildi → İlham · Porto (Sabine ekledi)", at(4, 18, 20)),
          event("e5", "Casa do Rio silindi", at(4, 9) + 5), // said by the trash
          event("e6", "⚠ Okunamadı", at(4, 8)),
          event("e7", "Douro tekne turu plana alındı", at(3, 12)),
        ],
        trash: [trash],
        hidden: [
          { kind: "dismissed", item: bawhee },
          { kind: "hidden", key: "leg:gaula>madeira", label: "Gaula → Madeira", names: ["Gaula → Madeira", "Transfer"] },
        ],
        items: [lello, bawhee],
      }),
    );
    expect(rows.map((r) => [r.verb, r.text, r.who, r.action?.kind ?? null])).toEqual([
      ["Tarihler", "", "Sabine", "undo-setting"],
      ["Bütçe", "", "Sabine", "undo-setting"],
      ["Kaldırıldı", 'Renault Campervan "Bawhee"', "Emre", "restore-dismissed"],
      ["Gizlendi", "Gaula → Madeira", "Emre", "unhide"],
      ["Eklendi", "Livraria Lello", "Sabine", "show"],
      ["Silindi", "Casa do Rio", "Emre", "restore-trash"],
      [null, "Douro tekne turu plana alındı", "Emre", null],
    ]);
    expect(rows[0].parts).toEqual([{ subject: null, before: "7–18 Ekim", after: "8–18 Ekim" }]);
    expect(rows[0].how).toEqual(["ortak ayar"]);
    expect(rows[2].how).toEqual(["sohbetten", "Gizlenenler'de"]);
    expect(rows[3].at).toBe(at(5, 20, 10)); // its time from the history line
    expect(rows[4]).toMatchObject({ me: false, how: ["paylaşılan kayıt"], action: { kind: "show", itemId: "lello" } });
    expect(rows[5]).toMatchObject({ trash: true, how: ["Çöp kutusu'nda 29 gün daha"] });
  });

  it("a change put back later is grey ('geri alındı') and the putting back isn't a row of its own", () => {
    const rows = buildHistory(
      input({
        settings: [
          change(2, "Emre", at(5, 19, 5), s({ priorities: { price: 3 } }), s({ priorities: { price: 4 } }), ["priorities"]),
          change(1, "Sabine", at(5, 19, 2), s({ priorities: { price: 4 } }), s({ priorities: { price: 3 } }), ["priorities"]),
        ],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ verb: "Öncelikler", who: "Sabine", action: null, undone: { by: "Emre", at: at(5, 19, 5) } });
    expect(rows[0].parts).toEqual([{ subject: "Fiyat", before: "çok önemli", after: "önemli" }]);
  });

  it("a change taken back from a notice is grey even before the server shows the putting back", () => {
    const when = at(5, 21, 40);
    const rows = buildHistory(
      input({
        settings: [change(7, "Sabine", when, s(), s(DATES_8), ["confirmedDates"])],
        undone: [{ id: `${iso(when)}|sabine`, at: iso(when), by: "Emre", undoneAt: at(5, 21, 45) }],
      }),
    );
    expect(rows[0]).toMatchObject({ undone: { by: "Emre", at: at(5, 21, 45) }, action: null });
  });

  it("without the server's history: the notices waiting here, and the settings line stays when nothing says it", () => {
    const notice: SettingsNotice = { id: "n1", author: "Sabine", at: iso(at(5, 21, 38)), seenAt: at(5, 21, 39), prev: s(), next: s({ budget: { amount: 80000, currency: "TRY" } }), fields: ["budget"] };
    const rows = buildHistory(
      input({
        notices: [notice],
        events: [event("e1", "Sabine gezinin ayarlarını güncelledi", at(5, 21, 39)), event("e2", "Sabine gezinin ayarlarını güncelledi", at(3, 10))],
      }),
    );
    expect(rows.map((r) => [r.verb, r.who, r.me])).toEqual([
      ["Bütçe", "Sabine", false],
      [null, "Sabine", false],
    ]);
    expect(rows[0].action).toMatchObject({ kind: "undo-setting", fields: ["budget"], mark: { id: "n1" } });
  });

  it("works with no sharing at all: a local history and the trash", () => {
    const rows = buildHistory(input({ me: "", events: [event("e1", "✓ Jardim Stay kaydedildi → Konaklama · Porto", at(5, 9))] }));
    expect(rows).toMatchObject([{ verb: "Eklendi", text: "Jardim Stay", who: "Ben", me: true, how: ["Konaklama · Porto"], action: null }]);
  });

  it("reads English history lines too", () => {
    setLang("en");
    const rows = buildHistory(input({ events: [event("e1", "✓ Jardim Stay saved → Stay · Porto (added by Sabine)", at(5, 9)), event("e2", "Taxi deleted", at(5, 8))] }));
    expect(rows.map((r) => [r.verb, r.text, r.who])).toEqual([
      ["Added", "Jardim Stay", "Sabine"],
      ["Deleted", "Taxi", "Emre"],
    ]);
  });

  it("a junk server row never breaks the list", () => {
    const rows = buildHistory(input({ settings: [change(1, "Sabine", at(5, 9), asSettings(null), asSettings({ title: 3 }), ["title"])] }));
    expect(rows).toEqual([]);
  });
});

describe("days and segments", () => {
  it("groups by Bugün, Dün, a date; rows without a time last", () => {
    expect(dayLabel(at(5, 0, 5), NOW)).toBe("Bugün");
    expect(dayLabel(at(4, 23, 59), NOW)).toBe("Dün");
    expect(dayLabel(at(2, 12), NOW)).toBe("2 Ekim");
    expect(dayLabel(null, NOW)).toBe("Daha önce");
    const rows = buildHistory(
      input({
        events: [event("a", "x", at(5, 9)), event("b", "y", at(5, 8)), event("c", "z", at(4, 9)), event("d", "w", at(1, 9))],
        hidden: [{ kind: "hidden", key: "nights:2026-10-09_2026-10-10", label: "Porto 9–10 Ekim", names: ["Porto 9–10 Ekim"] }],
      }),
    );
    expect(groupByDay(rows, NOW).map((g) => [g.label, g.rows.length])).toEqual([
      ["Bugün", 2],
      ["Dün", 1],
      ["1 Ekim", 1],
      ["Daha önce", 1],
    ]);
  });

  it("Hepsi · the others · Ben · Çöp kutusu (count), and each shows its own rows", () => {
    const rows = buildHistory(
      input({
        settings: [change(1, "Sabine", at(5, 9), s(), s(DATES_8), ["confirmedDates"])],
        trash: [{ id: "tr", tripId: "t1", kind: "item", deletedAt: at(5, 8), label: "Taksi", payload: { item: makeItem(), docs: [] } }],
        events: [event("e", "✓ X kaydedildi → Diğer · Porto (Ali ekledi)", at(5, 7))],
      }),
    );
    const segments = segmentsOf(rows, ["Emre", "Sabine"], "Emre");
    expect(segments.map((x) => [x.label, x.count])).toEqual([
      ["Hepsi", null],
      ["Sabine", null],
      ["Ali", null],
      ["Ben", null],
      ["Çöp kutusu", 1],
    ]);
    expect(filterRows(rows, segments[1].segment).map((r) => r.verb)).toEqual(["Tarihler"]);
    expect(filterRows(rows, { kind: "me" }).map((r) => r.text)).toEqual(["Taksi"]);
    expect(filterRows(rows, { kind: "trash" }).map((r) => r.text)).toEqual(["Taksi"]);
    expect(filterRows(rows, { kind: "all" })).toHaveLength(3);
  });
});
