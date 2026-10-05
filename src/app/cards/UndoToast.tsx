// "Douro tekne turu silindi · Geri al" for 8 seconds after a delete (ulasim-v3 .toast). No confirm dialog.
import { L } from "../../lib/i18n";
import type { Removed } from "../../lib/removal";

export function UndoToast({ removed, onUndo }: { removed: Removed | null; onUndo: () => void }) {
  if (!removed) return null;
  return (
    <div className="pk-undo" role="status" aria-live="polite">
      <span>{L(`${removed.item.name} silindi`, `${removed.item.name} deleted`)}</span>
      <button type="button" onClick={onUndo}>{L("Geri al", "Undo")}</button>
    </div>
  );
}
