// "Douro tekne turu silindi · Geri al" for 8 seconds (ulasim-v3 .toast), and the same for a one-tap add
// ("Otobüs eklendi · Geri al") and nights hidden. No confirm dialog. An undo that couldn't be done ("Bu ayar
// sonra yine değişti") says so in the same place.
import { L } from "../../lib/i18n";
import { UNDO_MS } from "../../lib/undo";
import { undoText, type Undoable } from "../../lib/undoables";

// What is on the toast now gets a number, so a newer one starts the ring again (the toast itself stays mounted).
const rounds = new WeakMap<object, number>();
let round = 0;

/** The time left to "Geri al", as a ring that empties over the 8 seconds (docs/mockups/ux-katmanli-arayuz); it is only drawn, nothing waits on it. */
export function UndoRing({ of }: { of: object }) {
  if (!rounds.has(of)) rounds.set(of, ++round);
  return (
    <svg key={rounds.get(of)} className="pk-undo-ring" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="15" className="track" />
      <circle cx="18" cy="18" r="15" className="run" style={{ animationDuration: `${UNDO_MS}ms` }} transform="rotate(-90 18 18)" />
    </svg>
  );
}

export function UndoToast({ undoable, onUndo, error }: { undoable: Undoable | null; onUndo: () => void; error?: string | null }) {
  if (error) {
    return (
      <div className="pk-undo err" role="alert">
        <span>{error}</span>
      </div>
    );
  }
  if (!undoable) return null;
  return (
    <div className="pk-undo" role="status" aria-live="polite">
      <span>{undoText(undoable)}</span>
      <button type="button" onClick={onUndo}>{L("Geri al", "Undo")}</button>
      <UndoRing of={undoable} />
    </div>
  );
}
