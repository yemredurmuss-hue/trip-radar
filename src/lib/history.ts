// Geçmiş ve çöp kutusu (paylaşım güvenliği, 0.37, mockup panel 3): one list of what happened on a trip, from
// four places, each row with its way back:
//  (a) the server's history of the shared settings (history.sql), or the notices kept here without it → "Geri al";
//  (b) the trip's history lines (addEvent) → "Eklendi:" with "Panoda göster", the rest as they were written;
//  (c) the trash → "Geri getir";
//  (d) what is hidden: ruled-out records, transfers and nights said not needed → "Geri getir".
// A line that says the same as a row from (a), (c) or (d) isn't shown twice. Grouped by day: Bugün, Dün, a date.
// Pure: the board gathers the inputs (HistoryDialog) and runs the actions.
import { L, locale } from "./i18n";
import { formatDateRange } from "./items";
import type { SettingsNotice, UndoneMark } from "./share/notices";
import { stableJson, type SyncedField, type SyncedSettings } from "./share/settings";
import { diffSettings, fieldLabel, type DiffLine } from "./share/settingsDiff";
import type { SettingsChange } from "./share/settingsHistory";
import { daysLeft } from "./trash";
import type { ChatMessage, Item, TrashEntry } from "./types";

export type HistoryAction =
  /** Write these fields of `prev` back (a shared-settings change taken back). */
  | { kind: "undo-setting"; prev: SyncedSettings; next: SyncedSettings; fields: SyncedField[]; mark: { id: string; at: string } }
  | { kind: "restore-trash"; id: string }
  | { kind: "restore-dismissed"; item: Item }
  | { kind: "unhide"; key: string; label: string }
  /** A trip setting changed on this computer (the money, who goes, the language): its line's undo (eventUndo.ts). */
  | { kind: "undo-event"; messageId: string }
  /** A suggestion said not needed, open again. */
  | { kind: "restore-suggestion"; key: string; label: string }
  | { kind: "show"; itemId: string };

export interface HistoryRow {
  key: string;
  /** When (ms); null when nothing says (an old hidden transfer). */
  at: number | null;
  /** Who did it, as named on the trip ("Sabine"); `me` for this traveller. */
  who: string;
  me: boolean;
  /** The bold start ("Tarihler", "Silindi"); null for a history line shown as written. */
  verb: string | null;
  /** A settings change: each part's before struck through, "→", after. */
  parts: Pick<DiffLine, "subject" | "before" | "after">[] | null;
  /** The rest of the row ("Renault Campervan", or the history line itself). */
  text: string;
  /** The grey line after who and the time ("ortak ayar", "sohbetten", "Çöp kutusu'nda 29 gün daha"). */
  how: string[];
  action: HistoryAction | null;
  /** Taken back: by whom and when (the row is grey, tagged "geri alındı"). */
  undone: { by: string; at: number | null } | null;
  /** In the trash (the "Çöp kutusu" segment). */
  trash: boolean;
  /** Where it comes from: only the trip's history lines are ever cut (MAX_EVENT_ROWS). */
  source: "setting" | "trash" | "hidden" | "event";
}

/** What is hidden on the trip, as the board names it; `names`: the labels its history line may start with. */
export type HiddenInput =
  | { kind: "dismissed"; item: Item }
  | { kind: "hidden"; key: string; label: string; names: string[] }
  /** A suggestion said not needed (trip.suggestions, state "dismissed"): `at` when. */
  | { kind: "suggestion"; key: string; label: string; at: number | null };

export interface HistoryInput {
  /** This traveller's name ("" when sharing isn't set up). */
  me: string;
  /** The server's history (newest first), or null when there is none (not shared, old server, offline). */
  settings: SettingsChange[] | null;
  /** Every notice kept here, dismissed ones too (the settings rows when the server has no history). */
  notices: SettingsNotice[];
  undone: UndoneMark[];
  events: ChatMessage[];
  trash: TrashEntry[];
  hidden: HiddenInput[];
  /** The trip's cards now (for "Panoda göster"). */
  items: Item[];
  /** The shared settings now: a change whose field has changed again since has no "Geri al". */
  current: SyncedSettings | null;
  now: number;
}

/** The trip's history lines shown at most (after the segment's filter); every other row always shows. */
export const MAX_EVENT_ROWS = 300;

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const msOf = (iso: string | null | undefined): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

type FieldState = { undone: { by: string; at: number | null } | null; closed: boolean };

/**
 * One row per changed field of a settings change ("Tarihler: 7–18 Ekim → 8–18 Ekim"). Taken back: grey, no
 * action. Changed again since (or a newer change closed it): no "Geri al", said in the grey line.
 */
function settingRows(
  source: { key: string; author: string | null; at: string; prev: SyncedSettings; next: SyncedSettings; fields: SyncedField[] },
  input: HistoryInput,
  markId: (field: SyncedField) => string,
  stateOf: (field: SyncedField) => FieldState,
): HistoryRow[] {
  const lines = diffSettings(source.prev, source.next);
  const author = source.author?.trim() || L("Biri", "Someone");
  return source.fields.flatMap((field) => {
    const parts = lines.filter((l) => l.field === field);
    if (!parts.length) return [];
    const state = stateOf(field);
    const since = !state.undone && (state.closed || (input.current != null && stableJson(input.current[field]) !== stableJson(source.next[field])));
    return [
      {
        key: `${source.key}:${field}`,
        at: msOf(source.at),
        who: author,
        me: Boolean(input.me) && same(author, input.me),
        verb: fieldLabel(field),
        parts: parts.map(({ subject, before, after }) => ({ subject, before, after })),
        text: "",
        how: [L("ortak ayar", "shared setting"), ...(since ? [L("sonra yine değişti", "changed again since")] : [])],
        action: state.undone || since ? null : { kind: "undo-setting", prev: source.prev, next: source.next, fields: [field], mark: { id: markId(field), at: source.at } },
        undone: state.undone,
        trash: false,
        source: "setting",
      } satisfies HistoryRow,
    ];
  });
}

/** A field taken back from here: by its history row's id, or (from a notice) by that change's server time. */
function markFor(input: HistoryInput, rowId: string, at: number | null, field: SyncedField): UndoneMark | undefined {
  return input.undone.find(
    (m) => m.id === rowId || (!m.id.startsWith("h:") && at != null && msOf(m.at) === at && (!m.fields || m.fields.includes(field))),
  );
}

/** (a) The server's changes; a later change that only put a field back marks the earlier one "geri alındı". */
function serverRows(changes: SettingsChange[], input: HistoryInput): HistoryRow[] {
  const oldest = [...changes].sort((a, b) => a.id - b.id);
  const undoneBy = new Map<string, { by: string; at: number | null }>();
  const takenBack = new Set<string>(); // the putting-back change's own row: not shown
  for (const [i, c] of oldest.entries()) {
    for (const f of c.fields) {
      if (undoneBy.has(`${c.id}:${f}`) || takenBack.has(`${c.id}:${f}`)) continue;
      const later = oldest
        .slice(i + 1)
        .find(
          (c2) =>
            c2.fields.includes(f) &&
            !takenBack.has(`${c2.id}:${f}`) &&
            stableJson(c2.prev[f]) === stableJson(c.next[f]) &&
            stableJson(c2.next[f]) === stableJson(c.prev[f]),
        );
      if (later) {
        undoneBy.set(`${c.id}:${f}`, { by: later.author ?? "", at: msOf(later.at) });
        takenBack.add(`${later.id}:${f}`);
      }
    }
  }
  const at = (c: SettingsChange) => msOf(c.at);
  return changes.flatMap((c) =>
    settingRows(
      { ...c, fields: c.fields.filter((f) => !takenBack.has(`${c.id}:${f}`)), key: `h${c.id}` },
      input,
      (f) => `h:${c.id}:${f}`,
      (f) => {
        const mark = markFor(input, `h:${c.id}:${f}`, at(c), f);
        return { undone: undoneBy.get(`${c.id}:${f}`) ?? (mark ? { by: mark.by, at: mark.undoneAt } : null), closed: false };
      },
    ),
  );
}

/** (a) without the server's history: the notices kept here, each field as it stands now. */
function noticeRows(input: HistoryInput): HistoryRow[] {
  return input.notices.flatMap((n) =>
    settingRows({ ...n, key: `n:${n.id}` }, input, () => n.id, (f) => {
      const undone = n.undone?.fields.includes(f) ? { by: n.undone.by, at: n.undone.at } : null;
      const mark = undone ? undefined : markFor(input, n.id, msOf(n.at), f);
      return { undone: undone ?? (mark ? { by: mark.by, at: mark.undoneAt } : null), closed: (n.closed ?? []).includes(f) };
    }),
  );
}

/** (b) "✓ Jardim Stay kaydedildi → Konaklama · Porto (Sabine ekledi)" in either language. */
const ADDED = [/^✓ (.+?) kaydedildi(?: → (.*?))?(?: \((.+) ekledi\))?$/, /^✓ (.+?) saved(?: → (.*?))?(?: \(added by (.+)\))?$/];
const DELETED = [/^(.+) silindi$/, /^(.+) deleted$/];
const HIDDEN_LINE = /: (gerek yok denildi, gizlendi|marked not needed, hidden)$/;
const SETTINGS_LINE = [/^(.+) gezinin ayarlarını güncelledi$/, /^(.+) updated the trip settings$/];
const UNDONE_LINE = /^(Ortak ayar geri alındı|Shared setting undone)( |$)/;
const CHAT_REMOVED = [/ sohbetten kaldırıldı \(Gizlenenler'de\)$/, / removed in the chat \(under Hidden\)$/];

const firstMatch = (res: RegExp[], text: string) => res.map((r) => text.match(r)).find(Boolean) ?? null;

export function buildHistory(input: HistoryInput): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const me = input.me;
  const meName = me || L("Ben", "Me");
  const events = input.events.filter((m) => m.role === "event").sort((a, b) => b.createdAt - a.createdAt);
  const used = new Set<string>();

  // (a) settings
  const settings = input.settings
    ? serverRows(input.settings, input)
    : noticeRows(input);
  rows.push(...settings);

  // (c) trash
  for (const e of input.trash) {
    rows.push({
      key: `trash:${e.id}`,
      at: e.deletedAt,
      who: meName,
      me: true,
      verb: e.kind === "trip" ? L("Gezi silindi", "Trip deleted") : e.kind === "doc" ? L("Belge silindi", "File deleted") : L("Silindi", "Deleted"),
      parts: null,
      text: e.label,
      how: [L(`Çöp kutusu'nda ${daysLeft(e, input.now)} gün daha`, `${daysLeft(e, input.now)} more days in the trash`)],
      action: { kind: "restore-trash", id: e.id },
      undone: null,
      trash: true,
      source: "trash",
    });
    const line = events.find((m) => !used.has(m.id) && Math.abs(m.createdAt - e.deletedAt) < 10_000 && firstMatch(DELETED, m.text)?.[1] === e.label);
    if (line) used.add(line.id);
  }

  // (d) hidden
  for (const h of input.hidden) {
    if (h.kind === "dismissed") {
      const item = h.item;
      const line = events.find((m) => !used.has(m.id) && m.text.startsWith(`${item.name} `) && /kaldırıldı|elendi|removed|ruled out/.test(m.text));
      if (line) used.add(line.id);
      const chat = Boolean(item.dismissedFrom);
      rows.push({
        key: `dismissed:${item.id}`,
        at: item.statusAt ?? line?.createdAt ?? item.updatedAt ?? null,
        who: meName,
        me: true,
        verb: chat ? L("Kaldırıldı", "Removed") : L("Elendi", "Ruled out"),
        parts: null,
        text: item.name,
        how: chat ? [L("sohbetten", "in the chat"), L("Gizlenenler'de", "under Hidden")] : [L("Gizlenenler'de", "under Hidden")],
        action: { kind: "restore-dismissed", item },
        undone: null,
        trash: false,
        source: "hidden",
      });
    } else if (h.kind === "suggestion") {
      // A suggestion said not needed ("Gerek yok"): its line is written like a hidden transfer's.
      const line = events.find((m) => !used.has(m.id) && HIDDEN_LINE.test(m.text) && m.text.startsWith(`${h.label}:`));
      if (line) used.add(line.id);
      rows.push({
        key: `suggestion:${h.key}`,
        at: h.at ?? line?.createdAt ?? null,
        who: meName,
        me: true,
        verb: L("Gerek yok", "Not needed"),
        parts: null,
        text: h.label,
        how: [L("öneri", "suggestion")],
        action: { kind: "restore-suggestion", key: h.key, label: h.label },
        undone: null,
        trash: false,
        source: "hidden",
      });
    } else {
      const line = events.find((m) => !used.has(m.id) && HIDDEN_LINE.test(m.text) && h.names.some((n) => n && m.text.startsWith(`${n}:`)));
      if (line) used.add(line.id);
      rows.push({
        key: `hidden:${h.key}`,
        at: line?.createdAt ?? null,
        who: meName,
        me: true,
        verb: L("Gizlendi", "Hidden"),
        parts: null,
        text: h.label,
        how: [L("gerek yok", "not needed")],
        action: { kind: "unhide", key: h.key, label: h.label },
        undone: null,
        trash: false,
        source: "hidden",
      });
    }
  }

  // (b) the trip's history lines that aren't one of the rows above
  const settingsTimes = settings.map((r) => r.at).filter((t): t is number => t != null);
  for (const m of events) {
    if (used.has(m.id) || m.text.startsWith("⚠") || UNDONE_LINE.test(m.text)) continue;
    const settingsLine = firstMatch(SETTINGS_LINE, m.text);
    if (settingsLine && (input.settings || settingsTimes.some((t) => Math.abs(t - m.createdAt) < 5 * 60_000))) continue;
    if (CHAT_REMOVED.some((r) => r.test(m.text)) && input.hidden.some((h) => h.kind === "dismissed" && m.text.startsWith(`${h.item.name} `))) continue;
    const added = firstMatch(ADDED, m.text);
    const deleted = firstMatch(DELETED, m.text);
    const hidden = HIDDEN_LINE.test(m.text) ? m.text.replace(HIDDEN_LINE, "") : null;
    const sharer = added?.[3] ?? null;
    const who = sharer ?? (settingsLine ? settingsLine[1] : meName);
    const item = added ? input.items.find((i) => i.name === added[1]) : undefined;
    rows.push({
      key: `event:${m.id}`,
      at: m.createdAt,
      who,
      me: !sharer && !settingsLine,
      verb: added ? L("Eklendi", "Added") : deleted ? L("Silindi", "Deleted") : hidden ? L("Gizlendi", "Hidden") : null,
      parts: null,
      text: added ? added[1] : deleted ? deleted[1] : (hidden ?? m.text.replace(/^[✓↻]\s*/, "")),
      how: added ? [sharer ? L("paylaşılan kayıt", "shared save") : (added[2] ?? "")].filter(Boolean) : [],
      action: m.undo && !m.undoneAt ? { kind: "undo-event", messageId: m.id } : item ? { kind: "show", itemId: item.id } : null,
      undone: m.undoneAt ? { by: meName, at: m.undoneAt } : null,
      trash: false,
      source: "event",
    });
  }

  return rows.sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity));
}

// --- days and segments -------------------------------------------------------------------------------

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Bugün", "Dün", "3 Ekim"; "Daha önce" for rows without a time. */
export function dayLabel(at: number | null, now: number): string {
  if (at == null) return L("Daha önce", "Earlier");
  const day = localDay(at);
  if (day === localDay(now)) return L("Bugün", "Today");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDay(yesterday.getTime())) return L("Dün", "Yesterday");
  return formatDateRange(day, null);
}

/** Rows (newest first) in day groups, in order. */
export function groupByDay(rows: HistoryRow[], now: number): { label: string; rows: HistoryRow[] }[] {
  const groups: { label: string; rows: HistoryRow[] }[] = [];
  for (const row of rows) {
    const label = dayLabel(row.at, now);
    const last = groups.at(-1);
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

/** "21:40" in the board's language. */
export const timeText = (at: number) => new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

export type Segment = { kind: "all" } | { kind: "person"; name: string } | { kind: "me" } | { kind: "trash" };

/** Hepsi · Sabine · Ben · Çöp kutusu: the people besides me from the members and the rows. */
export function segmentsOf(rows: HistoryRow[], members: string[], me: string): { segment: Segment; label: string; count: number | null }[] {
  const others: string[] = [];
  for (const name of [...members, ...rows.filter((r) => !r.me).map((r) => r.who)]) {
    if (name && !same(name, me) && !others.some((o) => same(o, name))) others.push(name);
  }
  return [
    { segment: { kind: "all" }, label: L("Hepsi", "All"), count: null },
    ...others.map((name) => ({ segment: { kind: "person", name } as Segment, label: name, count: null })),
    { segment: { kind: "me" }, label: L("Ben", "Me"), count: null },
    { segment: { kind: "trash" }, label: L("Çöp kutusu", "Trash"), count: rows.filter((r) => r.trash).length },
  ];
}

/**
 * The segment's rows. Only the trip's history lines are cut (the newest MAX_EVENT_ROWS, after the filter): a
 * row with a way back (trash, hidden, settings) is never left out.
 */
export function filterRows(rows: HistoryRow[], segment: Segment, maxEvents = MAX_EVENT_ROWS): HistoryRow[] {
  const shown = (() => {
    switch (segment.kind) {
      case "all":
        return rows;
      case "person":
        return rows.filter((r) => !r.me && same(r.who, segment.name));
      case "me":
        return rows.filter((r) => r.me);
      case "trash":
        return rows.filter((r) => r.trash);
    }
  })();
  let events = 0;
  return shown.filter((r) => r.source !== "event" || ++events <= maxEvents);
}
