import { useState } from "react";
import { db, notifyChanged } from "../lib/db";
import { updateTrip } from "./actions";
import { CRITERION_LABELS, LEVEL_LABELS, requirementLabel } from "../lib/decision";
import { activeSignals } from "../lib/intent";
import { CATEGORY_LABELS } from "../lib/items";
import type { Category, CriterionId, Trip } from "../lib/types";
import type { Decisions } from "./useDecisions";

interface Entry {
  key: string;
  /** Short form for the collapsed line. */
  short: string;
  text: string;
  detail: string;
  /** Either a change to the stored trip, or a standalone action. */
  change?: (trip: Trip) => Trip;
  action?: () => Promise<void>;
}

/** "Seni böyle anladım": what the traveller said and what was read from their saves and choices. */
export function IntentCard({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const [open, setOpen] = useState(false);
  const entries: Entry[] = [];

  for (const [c, level] of Object.entries(trip.priorities ?? {}) as [CriterionId, number][]) {
    entries.push({
      key: `p:${c}`,
      short: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level].toLocaleLowerCase("tr")}`,
      text: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
      detail: "söylediğin · tüm gezi",
      change: (t) => {
        const priorities = { ...t.priorities };
        delete priorities[c];
        return { ...t, priorities };
      },
    });
  }
  for (const [cat, levels] of Object.entries(trip.categoryPriorities ?? {}) as [Category, Partial<Record<CriterionId, number>>][]) {
    for (const [c, level] of Object.entries(levels ?? {}) as [CriterionId, number][]) {
      entries.push({
        key: `cp:${cat}:${c}`,
        short: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level].toLocaleLowerCase("tr")}`,
        text: `${CATEGORY_LABELS[cat]} · ${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
        detail: "söylediğin",
        change: (t) => {
          const categoryPriorities = { ...t.categoryPriorities, [cat]: { ...t.categoryPriorities?.[cat] } };
          delete categoryPriorities[cat]![c];
          return { ...t, categoryPriorities };
        },
      });
    }
  }
  for (const r of trip.requirements ?? []) {
    const label = requirementLabel(r);
    entries.push({
      key: `r:${label}`,
      short: `${label} şart`,
      text: `Şart: ${label}`,
      detail: "uymayan seçenek önerilmez",
      change: (t) => ({ ...t, requirements: (t.requirements ?? []).filter((x) => requirementLabel(x) !== label) }),
    });
  }
  for (const a of trip.wantedAmenities ?? []) {
    entries.push({
      key: `a:${a}`,
      short: `${a} istiyorsun`,
      text: `İstenen: ${a}`,
      detail: "olanağı olan öne geçer",
      change: (t) => ({ ...t, wantedAmenities: (t.wantedAmenities ?? []).filter((x) => x !== a) }),
    });
  }
  for (const p of decisions?.preferences ?? []) {
    entries.push({
      key: `n:${p.id}`,
      short: p.text,
      text: p.text,
      detail: p.tripId ? "not · bu gezi" : "not · tüm geziler",
      action: async () => {
        await (await db()).delete("preferences", p.id);
        notifyChanged();
      },
    });
  }
  for (const s of activeSignals(decisions?.signals ?? [], trip)) {
    entries.push({
      key: `s:${s.id}`,
      short: `${CRITERION_LABELS[s.criterion].toLocaleLowerCase("tr")} ${s.delta > 0 ? "önemli" : "ikinci planda"} (sezgi)`,
      text: s.text,
      detail: `sezdiğim: ${s.evidence}`,
      change: (t) => ({ ...t, ignoredSignals: [...new Set([...(t.ignoredSignals ?? []), s.id])] }),
    });
  }

  if (!entries.length) {
    return <div className="intent-card empty">Konuştukça ve seçtikçe seni tanıyacağım; anladıklarımı burada göreceksin.</div>;
  }
  const preview = entries.slice(0, 3).map((e) => e.short).join(" · ");
  return (
    <div className="intent-card">
      <button className="intent-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="intent-title">Seni böyle anladım</span>
        <span className="intent-preview">
          {preview}
          {entries.length > 3 && ` · +${entries.length - 3}`}
        </span>
        <span className="muted">{open ? "Gizle" : "Düzenle"}</span>
      </button>
      {open && (
        <ul className="intent-list">
          {entries.map((e) => (
            <li key={e.key}>
              <span>
                {e.text}
                <span className="muted"> · {e.detail}</span>
              </span>
              <button className="intent-remove" aria-label={`${e.text} kaldır`} title="Kaldır / yok say" onClick={() => void (e.change ? updateTrip(trip.id, e.change) : e.action?.())}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
