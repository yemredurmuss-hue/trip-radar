// The chat's change lines ("Jardim Stay plana alındı", ...) pile up while the assistant works on the board: a run of
// FOLD_MIN or more is gathered under one line, "12 değişiklik ▾", that opens to the same lines (docs/mockups/ux-katmanli-arayuz).
import { useState, type ReactNode } from "react";
import { L } from "../lib/i18n";

/** P8 (F29, T8): two change lines in a row are already gathered; the chat keeps to the talk and the decisions. */
export const FOLD_MIN = 2;

/** The fold's words from its lines: "3 kaydedildi, 1 güncellendi", else "4 değişiklik". */
export function foldLabel(texts: readonly string[]): string {
  const saved = texts.filter((t) => /kaydedildi|saved/i.test(t)).length;
  const updated = texts.filter((t) => /güncellendi|updated/i.test(t)).length;
  const rest = texts.length - saved - updated;
  const parts = [
    saved ? L(`${saved} kaydedildi`, `${saved} saved`) : "",
    updated ? L(`${updated} güncellendi`, `${updated} updated`) : "",
    rest && (saved || updated) ? L(`${rest} değişiklik`, `${rest} ${rest === 1 ? "change" : "changes"}`) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : L(`${texts.length} değişiklik`, `${texts.length} changes`);
}

export function EventFold({ count, label, icon = "✓", children }: { count: number; label?: string; icon?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ev-fold${open ? " open" : ""}`}>
      <button type="button" className="ev-fold-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden>{icon}</span>
        {label ?? L(`${count} değişiklik`, `${count} changes`)}
        <span className="ev-fold-chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="ev-fold-list">{children}</div>}
    </div>
  );
}

/**
 * The rows in order, each run of FOLD_MIN or more foldable ones gathered into one `{ fold }`; everything else, and
 * runs that are shorter, stay `{ row }` as they were.
 */
export function foldRuns<T>(rows: readonly T[], foldable: (row: T) => boolean): ({ row: T } | { fold: T[] })[] {
  const out: ({ row: T } | { fold: T[] })[] = [];
  let run: T[] = [];
  const flush = () => {
    if (run.length >= FOLD_MIN) out.push({ fold: run });
    else run.forEach((row) => out.push({ row }));
    run = [];
  };
  for (const row of rows) {
    if (foldable(row)) run.push(row);
    else {
      flush();
      out.push({ row });
    }
  }
  flush();
  return out;
}
