// The hero card's "Tercihler" (v9): what was understood about the traveller ("Seni böyle anladım", built in
// app/IntentCard.tsx) in at most two quiet rows, a label on the left and a word on the right: first the
// priorities they said, grouped by level from the highest ("Fiyat + konum" · "Çok önemli"), then a category's
// own ("Konaklama · konum" · "Önemli"), the musts ("Şart"), the amenities wanted ("İstiyorsun"), the guesses
// they confirmed ("Önemli" / "İkinci planda"), their notes ("Not"), what's fine ("Sorun değil") and what rules
// a place out ("Eler"). The rest is counted for the "+7 tercih ›" link. Pure.
import { L } from "./i18n";
import { capitalize, lowerText } from "./i18nText";
import { LEVEL_LABELS } from "./decision";

/** One understood thing, as the rows need it: what kind, its topic in words, and for a priority its level. */
export type Pref =
  | { kind: "priority"; topic: string; level: number }
  | { kind: "category"; scope: string; topic: string; level: number }
  | { kind: "requirement" | "amenity" | "note" | "fine" | "matters"; topic: string }
  | { kind: "signal"; topic: string; up: boolean };

export interface PreferenceRow {
  /** "Fiyat + konum", "Konaklama · konum". */
  label: string;
  /** "Çok önemli", "Şart", "Not". */
  value: string;
  /** How many understood things the row stands for. */
  count: number;
}

/** "Fiyat + konum": the first as it is (capitalised), the others lower-case, joined with " + ". */
const joined = (topics: string[]) => topics.map((t, i) => (i ? lowerText(t) : capitalize(t))).join(" + ");

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
  const levelOf = (p: Pref) => ("level" in p ? p.level : 0);

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
  // A note is a sentence of its own: one row each.
  for (const p of byKind("note")) rows.push({ label: capitalize(p.topic), value: L("Not", "Note"), count: 1 });
  together("fine", L("Sorun değil", "Fine"));
  together("matters", L("Eler", "Rules out"));

  const shown = rows.slice(0, max).reduce((n, r) => n + r.count, 0);
  return { rows, rest: prefs.length - shown };
}
