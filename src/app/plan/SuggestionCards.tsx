// A section's suggestions (spec 2026-10-06 §1, mockup sohbetle-gezi-v1 panel 4): soft cards at the top of its body,
// above its own cards — ✨ · the title · one line why · [Plana ekle] [Gerek yok]. A warning (a short layover) has
// only "Anladım". Never part of the plan: nothing here is counted.
import type { Suggestion } from "../../lib/types";
import { L } from "../../lib/i18n";

export function SuggestionCards({ list, onAdd, onDismiss, notes = {} }: {
  list: Suggestion[];
  onAdd: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
  /** Why "Plana ekle" didn't add it (a vehicle already covers those days), by key: said under the card. */
  notes?: Record<string, string>;
}) {
  if (!list.length) return null;
  return (
    <div className="sg-list" aria-label={L("Öneriler", "Suggestions")}>
      {list.map((s) => (
        <div key={s.key} className={`sg-card${s.kind === "warning" ? " warn" : ""}`} data-suggestion={s.key}>
          <span className="sg-mark" aria-hidden>
            {s.kind === "warning" ? "⚠" : "✨"}
          </span>
          <span className="sg-text">
            <b>{s.title}</b>
            <span className="sg-why">{s.why}</span>
            {notes[s.key] && (
              <span className="sg-note" role="status">
                {notes[s.key]}
              </span>
            )}
          </span>
          <span className="sg-actions">
            {s.kind === "add" && (
              <button type="button" className="sg-add" onClick={() => onAdd(s)}>
                {L("Plana ekle", "Add to plan")}
              </button>
            )}
            <button type="button" className="sg-no" onClick={() => onDismiss(s)} aria-label={L(`${s.title}: gerek yok`, `${s.title}: not needed`)}>
              {s.kind === "warning" ? L("Anladım", "Got it") : L("Gerek yok", "Not needed")}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
