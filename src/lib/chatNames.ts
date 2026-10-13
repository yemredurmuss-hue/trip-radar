// "Sohbette seçenek adı tıklanır" (Karar Panosu #9): the name of an option the assistant mentions in a reply ("Jardim Stay")
// becomes a button that takes the traveller to its card. Matched against the real names of the trip's records only, whole
// words, longest name first; a short form ("Pegasus" for "Pegasus · direkt") only when it can mean one record. Pure.
import type { Item } from "./types";

export interface NameTarget {
  id: string;
  name: string;
}

/** A piece of the reply: plain text, or an option's name with the record it is. */
export type NamePiece = string | { text: string; id: string };

const MIN = 3;
const MIN_SHORT = 5;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/** The names that can be linked: this trip's records that are still options or on the plan (a ruled-out one has no card to go to). */
export function nameTargets(items: Item[], tripId: string): NameTarget[] {
  const seen = new Set<string>();
  const out: NameTarget[] = [];
  for (const i of items) {
    const name = i.name.trim();
    if (i.tripId !== tripId || i.status === "dismissed" || name.length < MIN) continue;
    const key = fold(name);
    // The same name twice is the same thing said twice: the first record takes it.
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: i.id, name });
  }
  return out;
}

/** The part of a name before its first " · " ("Pegasus" of "Pegasus · direkt"), when it names one record only. */
function shortForms(targets: NameTarget[]): NameTarget[] {
  const count = new Map<string, number>();
  const firsts = targets.flatMap((t) => {
    const head = t.name.split(" · ")[0].trim();
    if (head === t.name || head.length < MIN_SHORT) return [];
    count.set(fold(head), (count.get(fold(head)) ?? 0) + 1);
    return [{ id: t.id, name: head }];
  });
  const full = new Set(targets.map((t) => fold(t.name)));
  return firsts.filter((t) => count.get(fold(t.name)) === 1 && !full.has(fold(t.name)));
}

/** The reply cut into plain text and linked names. No names to match: the text whole. */
export function splitNames(text: string, targets: NameTarget[]): NamePiece[] {
  const all = [...targets, ...shortForms(targets)].sort((a, b) => b.name.length - a.name.length);
  if (!all.length || !text) return [text];
  const byName = new Map(all.map((t) => [fold(t.name), t.id]));
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${all.map((t) => escape(t.name).replace(/\s+/g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out: NamePiece[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const id = byName.get(fold(m[1]));
    if (!id) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ text: m[1], id });
    last = m.index + m[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}
