// The traveller's word on one thing read about a place: "Sorun değil" (it stops counting against the
// place) or "Önemli, kalsın" (it rules the place out). One or the other, never both; the assistant
// learns it as a note.
import { db, newId, notifyChanged } from "../lib/db";
import { acceptKey } from "../lib/listing";
import type { Finding, Item, Listing } from "../lib/types";
import { updateTrip } from "./actions";

export type FindingVerdict = "fine" | "matters" | null;

const NOTES: Record<"fine" | "matters", (f: Finding) => string> = {
  fine: (f) => `"${f.text}" benim için sorun değil`,
  matters: (f) => `"${f.text}" benim için önemli`,
};

export async function setFindingVerdict(item: Item, listing: Pick<Listing, "key">, f: Finding, verdict: FindingVerdict): Promise<void> {
  const key = acceptKey(listing.key, f);
  const without = (list: string[] | undefined) => (list ?? []).filter((k) => k !== key);
  await updateTrip(item.tripId, (t) => ({
    ...t,
    acceptedFindings: verdict === "fine" ? [...without(t.acceptedFindings), key] : without(t.acceptedFindings),
    confirmedFindings: verdict === "matters" ? [...without(t.confirmedFindings), key] : without(t.confirmedFindings),
  }));
  const d = await db();
  const notes = new Set(Object.values(NOTES).map((note) => note(f)));
  for (const p of await d.getAll("preferences")) if (p.tripId === item.tripId && notes.has(p.text)) await d.delete("preferences", p.id);
  if (verdict) await d.put("preferences", { id: newId(), tripId: item.tripId, text: NOTES[verdict](f), createdAt: Date.now() });
  notifyChanged();
}
