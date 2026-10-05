// Taking back a trip setting changed on this computer (0.37: the money, who goes, the board's language), from
// Geçmiş or the board's "Geri al": the fields go back to their values before, written in one transaction on the
// trip as stored now, and only while they still hold what that change wrote (a later change is never undone by
// an older line). The line is marked taken back, so Geçmiş shows it "geri alındı" and offers it no more.
import { db, notifyChanged } from "./db";
import { L, saveLang } from "./i18n";
import { stableJson } from "./share/settings";
import { restoreFields } from "./tripSettings";
import type { ChatMessage, EventUndo, Trip } from "./types";

/** Thrown when the setting changed again since: nothing is written. */
export class ChangedSince extends Error {}

/** The line's change still on the trip: each field holds what the change wrote. */
export const stillAsAfter = (trip: Trip, undo: Extract<EventUndo, { kind: "fields" }>): boolean =>
  undo.fields.every((f) => stableJson(trip[f]) === stableJson(undo.after[f]));

/** Puts the line's change back. `reload`: the board's language changed (its words need the page again). */
export async function undoEvent(messageId: string): Promise<{ reload: boolean }> {
  const d = await db();
  const tx = d.transaction(["messages", "trips"], "readwrite");
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
    if (!stillAsAfter(trip, line.undo)) {
      await tx.done;
      throw new ChangedSince(L("Bu ayar sonra yine değişti; eski haline döndürülmedi.", "This setting changed again since; it wasn't put back."));
    }
    await tx.objectStore("trips").put({ ...restoreFields(trip, line.undo), updatedAt: Date.now() });
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
