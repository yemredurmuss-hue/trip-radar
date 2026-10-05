// "Douro tekne turu silindi · Geri al" for 8 seconds (ulasim-v3 .toast), and the same for a one-tap add
// ("Otobüs eklendi · Geri al") and nights hidden. No confirm dialog. An undo that couldn't be done ("Bu ayar
// sonra yine değişti") says so in the same place.
import { L } from "../../lib/i18n";
import { undoText, type Undoable } from "../../lib/undoables";

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
    </div>
  );
}
