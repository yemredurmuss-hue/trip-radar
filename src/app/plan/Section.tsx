// A section of the Plan (kategoriler-v2 .sec): its own light tint, a header — the coloured icon tile, the
// name, how many are settled of all ("3/4"), the pill of where it stands, "+ Ekle" and the arrow — that opens
// and closes it. Open, its timeline of cards; closed, the header alone.
import type { ReactNode } from "react";
import type { CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { SECTION_META } from "./sectionMeta";

export function Section({ section, open, onToggle, onAdd, children }: {
  section: CatSection;
  open: boolean;
  onToggle: () => void;
  /** "+ Ekle" in the header: this section's kind, no day. */
  onAdd: () => void;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.id];
  const label = meta.label();
  return (
    <section className={`cat-sec${open ? "" : " closed"}`} style={{ "--c": meta.color } as React.CSSProperties} aria-label={label} data-section={section.id}>
      <div className="cat-head" onClick={onToggle}>
        <button type="button" className="cat-title" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <span className="cat-tile" aria-hidden>
            <KindIcon kind={meta.icon} size={19} />
          </span>
          <b>{label}</b>
          <span className="cat-count" aria-label={L(`${section.settled} / ${section.entries.length} tamam`, `${section.settled} of ${section.entries.length} settled`)}>
            {section.settled}/{section.entries.length}
          </span>
          {section.status && <span className={`cat-state ${section.status.tone}`}>{section.status.text}</span>}
        </button>
        <button type="button" className="cat-add" onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label={L(`${label}: ekle`, `${label}: add`)}>
          <UiIcon name="plus" size={14} />
          {L("Ekle", "Add")}
        </button>
        <span className="cat-chev" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {open && <div className="cat-body">{children}</div>}
    </section>
  );
}
