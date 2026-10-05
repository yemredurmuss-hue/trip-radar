// "Douro tekne turu silindi · Geri al" for 8 seconds (ulasim-v3 .toast), and the same for a one-tap add
// ("Otobüs eklendi · Geri al") and nights hidden. No confirm dialog.
import { L } from "../../lib/i18n";
import { undoText, type Undoable } from "../../lib/undoables";

export function UndoToast({ undoable, onUndo }: { undoable: Undoable | null; onUndo: () => void }) {
  if (!undoable) return null;
  return (
    <div className="pk-undo" role="status" aria-live="polite">
      <span>{undoText(undoable)}</span>
      <button type="button" onClick={onUndo}>{L("Geri al", "Undo")}</button>
    </div>
  );
}
