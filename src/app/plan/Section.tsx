// A section of the Plan (kategoriler-v4 .sec): one band of the plan's single white sheet, a hairline above
// it. The header is the same in every section — the line icon in the section's colour, the name, and on the
// right a thin bar of settled of all (green once complete), "3/4", the arrow — and opens and closes it. Open,
// "+ Ekle" joins the header, one amber line says what's waiting ("1 bilet yok · 2 karar"), then the timeline
// of cards and, last, "Gizlenenler · N göster" for what's out of the way.
import type { ReactNode } from "react";
import { sectionProgress, type CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { HiddenList } from "./HiddenList";
import { SECTION_META } from "./sectionMeta";

export function Section({ section, open, onToggle, onAdd, children }: {
  section: CatSection;
  open: boolean;
  onToggle: () => void;
  /** "+ Ekle" in the open header: this section's kind, no day. */
  onAdd: () => void;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.id];
  const label = meta.label();
  const { total, pct, complete } = sectionProgress(section);
  const waiting = section.status?.tone === "wait" ? section.status.text : null;
  return (
    <section className={`cat-sec${open ? "" : " closed"}`} style={{ "--c": meta.color } as React.CSSProperties} aria-label={label} data-section={section.id}>
      <div className="cat-head" onClick={onToggle}>
        <button type="button" className="cat-title" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <span className="cat-ic" aria-hidden>
            <KindIcon kind={meta.icon} size={22} />
          </span>
          <b>{label}</b>
        </button>
        <span className="cat-end">
          {open && (
            <button type="button" className="cat-add" onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label={L(`${label}: ekle`, `${label}: add`)}>
              <UiIcon name="plus" size={14} />
              {L("Ekle", "Add")}
            </button>
          )}
          <span className={`cat-bar${complete ? " done" : ""}`} aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="cat-count" aria-label={L(`${section.settled} / ${total} tamam`, `${section.settled} of ${total} settled`)}>
            {section.settled}
            <i>/{total}</i>
          </span>
          <span className="cat-chev" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </span>
      </div>
      {open && waiting && <p className="cat-wait">{waiting}</p>}
      {open && (
        <div className="cat-body">
          {children}
          {section.hidden.length > 0 && <HiddenList things={section.hidden} />}
        </div>
      )}
    </section>
  );
}
