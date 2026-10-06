// Taking back a trip setting changed on this computer (0.37: the money, who goes, the board's language), from
// Geçmiş or the board's "Geri al": the fields go back to their values before, written in one transaction on the
// trip as stored now, and only while they still hold what that change wrote (a later change is never undone by
// an older line). The line is marked taken back, so Geçmiş shows it "geri alındı" and offers it no more.
import { db, notifyChanged } from "./db";
import { L, lang, saveLang } from "./i18n";
import { stableJson } from "./share/settings";
import { restoreFields } from "./tripSettings";
import type { ChatMessage, EventUndo, Trip } from "./types";

/** Thrown when the setting changed again since: nothing is written. */
export class ChangedSince extends Error {}

/** The line's change still on the trip: each field holds what the change wrote. */
export const stillAsAfter = (trip: Trip, undo: Extract<EventUndo, { kind: "fields" }>): boolean =>
  undo.fields.every((f) => stableJson(trip[f]) === stableJson(undo.after[f]));

/** A plan's owners as a change left them (kişiye özel rezervasyon): none and an empty list are the same. */
const ownersJson = (names: string[] | null | undefined) => stableJson(names?.length ? names : null);

/** Puts the line's change back. `reload`: the board's language changed (its words need the page again). */
export async function undoEvent(messageId: string): Promise<{ reload: boolean }> {
  const d = await db();
  const tx = d.transaction(["messages", "trips", "items"], "readwrite");
  const line = (await tx.objectStore("messages").get(messageId)) as ChatMessage | undefined;
  if (!line?.undo || line.undoneAt) {
    await tx.done;
    return { reload: false };
  }
  if (line.undo.kind === "fields") {
    const trip = await tx.objectStore("trips").get(line.tripId);
    if (!trip) {
      await tx.done;
      throw new Error(L("Gezi bulunamadı.", "Trip not found."));
    }
    // The plans whose owners the same change set (a name taken off, "bu bilet Sabine'in"): only while they still are.
    const owners = line.undo.owners ?? [];
    const records = await Promise.all(owners.map((o) => tx.objectStore("items").get(o.id)));
    const ownersAsAfter = owners.every((o, n) => !records[n] || ownersJson(records[n]!.forWho) === ownersJson(o.after));
    if (!stillAsAfter(trip, line.undo) || !ownersAsAfter) {
      await tx.done;
      throw new ChangedSince(L("Bu ayar sonra yine değişti; eski haline döndürülmedi.", "This setting changed again since; it wasn't put back."));
    }
    if (line.undo.fields.length) await tx.objectStore("trips").put({ ...restoreFields(trip, line.undo), updatedAt: Date.now() });
    for (const [n, o] of owners.entries()) {
      const record = records[n];
      if (!record) continue;
      const { forWho: _was, ...rest } = record;
      await tx.objectStore("items").put(o.before?.length ? { ...record, forWho: o.before, updatedAt: Date.now() } : { ...rest, updatedAt: Date.now() });
    }
    // What the change made (a person's own flight, an empty card): it goes again, unless it was booked or given a
    // price or a page since (then it's the traveller's, and stays).
    for (const id of line.undo.made ?? []) {
      const made = await tx.objectStore("items").get(id);
      if (made && made.status !== "booked" && made.price.amount == null && !made.url) await tx.objectStore("items").delete(id);
    }
  } else if (lang() === line.undo.prev) {
    // Switched back since (in Settings, or the chat again): nothing to put back, no reload.
    await tx.done;
    throw new ChangedSince(L("Bu ayar sonra yine değişti; pano zaten Türkçe.", "This setting changed again since; the board is already in English."));
  }
  await tx.objectStore("messages").put({ ...line, undoneAt: Date.now() });
  await tx.done;
  notifyChanged();
  if (line.undo.kind === "lang") {
    await saveLang(line.undo.prev);
    return { reload: true };
  }
  return { reload: false };
}

/** The newest language line of a trip not taken back yet (the board's toast after its reload marks it). */
export async function latestLangLine(tripId: string): Promise<string | null> {
  const lines = (await (await db()).getAllFromIndex("messages", "tripId", tripId)) as ChatMessage[];
  return lines.filter((m) => m.role === "event" && m.undo?.kind === "lang" && !m.undoneAt).sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
}
