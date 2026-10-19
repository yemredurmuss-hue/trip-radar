// A box still to choose: its ⋯ takes one candidate off (0.39.4, Emre: "eklediğim oteli çıkaramıyorum"). "Gerek yok" closes
// the whole need (every night of it); "Kaldır" deletes only the record, with the board's own Sil and its "Geri al"
// (env.remove). Nothing on the card changes: it is one more line in the menu it already has.
import { L } from "../../../lib/i18n";
import type { Item } from "../../../lib/types";
import type { MenuEntry } from "../../cards/CardShell";

/**
 * The box's records that are only candidates (saved, not chosen, not booked, not taken off), each with its "Kaldır": one
 * says "Kaldır"; several are named under a "Kaldır" heading. None: no entry.
 */
export function removeEntries(options: readonly { item: Item }[], byId: ReadonlyMap<string, Item>, remove: (item: Item) => void): MenuEntry[] {
  const seen = new Set<string>();
  const candidates = options
    .map((o) => byId.get(o.item.id))
    .filter((i): i is Item => i != null && i.status !== "dismissed" && i.status !== "chosen" && i.status !== "booked" && !seen.has(i.id) && Boolean(seen.add(i.id)));
  if (!candidates.length) return [];
  if (candidates.length === 1) return [{ label: L("Kaldır", "Remove"), run: () => remove(candidates[0]), danger: true }];
  return [
    { label: L("Kaldır", "Remove"), heading: true, run: () => undefined },
    ...candidates.map((item, n) => ({ label: candidates.findIndex((c) => c.name === item.name) === n ? item.name : `${item.name} (${n + 1})`, run: () => remove(item), danger: true })),
  ];
}
