// A section of the Plan (kategoriler-v2 .sec): its own light tint, a header — the coloured icon tile, the
// name, how many, the pill of where it stands, "+ Ekle" and the arrow — that opens and closes it. Open, its
// timeline of cards; closed, one thin line per record.
import type { ReactNode } from "react";
import type { CatEntry, CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { Chevron } from "../Icons";
import { CollapsedRow } from "./CollapsedRow";
import { SECTION_META } from "./sectionMeta";

export function Section({ section, open, onToggle, onAdd, onGo, children }: {
  section: CatSection;
  open: boolean;
  onToggle: () => void;
  /** "+ Ekle" in the header: this section's kind, no day. */
  onAdd: () => void;
  /** A closed line pressed: open the section, go to the card. */
  onGo: (entry: CatEntry) => void;
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
          <span className="cat-count">{section.entries.length}</span>
          {section.status && <span className={`cat-state ${section.status.tone}`}>{section.status.text}</span>}
        </button>
        <button type="button" className="cat-add" onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label={L(`${label}: ekle`, `${label}: add`)}>
          <UiIcon name="plus" size={14} />
          {L("Ekle", "Add")}
        </button>
        <span className="cat-chev" aria-hidden>
          <Chevron />
        </span>
      </div>
      {open ? (
        <div className="cat-body">{children}</div>
      ) : (
        <ul className="cat-rows">
          {section.entries.map((e) => (
            <CollapsedRow key={e.key} entry={e} onGo={onGo} />
          ))}
        </ul>
      )}
    </section>
  );
}
