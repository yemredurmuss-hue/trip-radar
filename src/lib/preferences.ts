// The hero card's "Tercihler" (v9): what was understood about the traveller ("Seni böyle anladım", built in
// app/IntentCard.tsx) in at most two quiet rows, a few words on the left and a word on the right: first the
// priorities they said, grouped by level from the highest ("Fiyat + konum" · "Çok önemli"), then a category's
// own ("Konaklama · konum" · "Önemli"), the musts ("Şart"), the amenities wanted ("İstiyorsun"), the guesses
// they confirmed ("Önemli" / "İkinci planda"), their notes, what's fine ("Sorun değil") and what rules a place
// out ("Eler"). The rest is counted for the "+7 tercih ›" link.
//
// A row is a keyword, never a sentence (revizyon 1, 2026-10-05): a note is named by its topic when the
// code knows it ("Sessiz bir yer istiyoruz" → "Sessizlik" · "Önemli"), else by the 1–3 words the traveller's
// model gave it (asked once, kept on the trip as `prefLabels`), else by its first three words and "…"; a
// finding by its short tag ("Gürültülü"). The full text stays in the window. Pure.
import { textId } from "./evidence";
import { L, lang } from "./i18n";
import { capitalize, lowerText } from "./i18nText";
import { LEVEL_LABELS } from "./decision";

/** One understood thing, as the rows need it: what kind, its topic in words, and for a priority its level. */
export type Pref =
  | { kind: "priority"; topic: string; level: number }
  | { kind: "category"; scope: string; topic: string; level: number }
  | { kind: "requirement" | "amenity" | "fine" | "matters"; topic: string }
  | {
      kind: "note";
      /** The note as written. */
      topic: string;
      /** Its few words: the topic the code read in it ("Sessizlik + konum"), or the model's label; null until there is one. */
      label?: string | null;
      /** The code read a topic in it, which makes that topic "Önemli" (decision.ts noteCriteria). */
      level?: number | null;
      /** Where its model label is kept (trip.prefLabels). */
      labelKey?: string;
    }
  | { kind: "signal"; topic: string; up: boolean };

export interface PreferenceRow {
  /** "Fiyat + konum", "Konaklama · konum", "Sessizlik". */
  label: string;
  /** "Çok önemli", "Şart", "Not". */
  value: string;
  /** How many understood things the row stands for. */
  count: number;
}

/** "Fiyat + konum": the first as it is (capitalised), the others lower-case, joined with " + ". */
const joined = (topics: string[]) => topics.map((t, i) => (i ? lowerText(t) : capitalize(t))).join(" + ");

/** A note's words until it has a name: the first three, and "…" when there were more ("Odada mutlaka bir…"). */
export function firstWords(text: string, n = 3): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return capitalize(words.join(" ").replace(/[.!?,;:]+$/, ""));
  return `${capitalize(words.slice(0, n).join(" ").replace(/[.!?,;:]+$/, ""))}…`;
}

/** Where a note's model label is kept: the board's language, the note's id and its text's hash (an edited note, or the board in the other language, is asked again). */
export const noteLabelKey = (id: string, text: string): string => `${lang()}:${id}:${textId(text)}`;

/** Longest label the model may give a note (a few words, not a sentence). */
const LABEL_MAX = 32;

/** The model's label for a note, cleaned: 1–3 words (4 at most), no sentence; "" when it isn't one. */
export function acceptNoteLabel(label: string | null | undefined): string {
  const t = (label ?? "")
    .trim()
    .replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "")
    .replace(/[.!?,;:]+$/, "")
    .trim();
  if (!t || t.length > LABEL_MAX || /[\n\r]/.test(t) || t.split(/\s+/).length > 4) return "";
  return capitalize(t);
}

/** Every row in order, and how many things are left once the first `max` are shown. */
export function preferenceRows(prefs: Pref[], max = 2): { rows: PreferenceRow[]; rest: number } {
  const rows: PreferenceRow[] = [];
  // Grouped, in first-seen order inside each group.
  const group = <K>(list: Pref[], keyOf: (p: Pref) => K) => {
    const out = new Map<K, Pref[]>();
    for (const p of list) out.set(keyOf(p), [...(out.get(keyOf(p)) ?? []), p]);
    return out;
  };
  const byKind = (kind: Pref["kind"]) => prefs.filter((p) => p.kind === kind);
  const levelOf = (p: Pref) => ("level" in p ? (p.level ?? 0) : 0);

  const said = group(byKind("priority"), levelOf);
  for (const level of [...said.keys()].sort((a, b) => b - a)) {
    const list = said.get(level)!;
    rows.push({ label: joined(list.map((p) => p.topic)), value: LEVEL_LABELS[level] ?? "", count: list.length });
  }
  const scoped = group(byKind("category"), (p) => (p.kind === "category" ? p.scope : ""));
  for (const [scope, list] of scoped) {
    const levels = group(list, levelOf);
    for (const level of [...levels.keys()].sort((a, b) => b - a)) {
      const same = levels.get(level)!;
      rows.push({ label: `${capitalize(scope)} · ${same.map((p) => lowerText(p.topic)).join(" + ")}`, value: LEVEL_LABELS[level] ?? "", count: same.length });
    }
  }
  const together = (kind: Pref["kind"], value: string) => {
    const list = byKind(kind);
    if (list.length) rows.push({ label: joined(list.map((p) => p.topic)), value, count: list.length });
  };
  together("requirement", L("Şart", "Must"));
  together("amenity", L("İstiyorsun", "Wanted"));
  const signals = byKind("signal");
  for (const up of [true, false]) {
    const list = signals.filter((p) => p.kind === "signal" && p.up === up);
    if (list.length) rows.push({ label: joined(list.map((p) => p.topic)), value: up ? L("Önemli", "Important") : L("İkinci planda", "Matters less"), count: list.length });
  }
  // A note by its few words: its topic ("Önemli"), else its label or first words ("Not"). Two notes that come
  // out the same are one row.
  const notes = new Map<string, PreferenceRow>();
  for (const p of byKind("note")) {
    if (p.kind !== "note") continue;
    const label = p.label?.trim() ? capitalize(p.label.trim()) : firstWords(p.topic);
    const value = p.level != null ? (LEVEL_LABELS[p.level] ?? "") : L("Not", "Note");
    const key = `${lowerText(label)}|${value}`;
    const row = notes.get(key);
    if (row) row.count++;
    else notes.set(key, { label, value, count: 1 });
  }
  rows.push(...notes.values());
  together("fine", L("Sorun değil", "Fine"));
  together("matters", L("Eler", "Rules out"));

  const shown = rows.slice(0, max).reduce((n, r) => n + r.count, 0);
  return { rows, rest: prefs.length - shown };
}
