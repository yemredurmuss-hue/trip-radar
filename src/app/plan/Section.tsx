// A section of the Plan (kategoriler-v4 .sec): one band of the plan's single white sheet, a hairline above
// it. The header is the same in every section — the line icon in the section's colour, the name, and on the
// right a thin bar of settled of all (green once complete), "3/4", the arrow — and opens and closes it. Under the
// name, its needs in stage words (v11: "1 rezerve · 2 seçildi · 1 aranıyor"). Open, "+ Ekle" joins the header, then the timeline
// of cards and, last, "Gizlenenler · N göster" for what's out of the way.
import type { ReactNode } from "react";
import { isIdeaSection, sectionProgress, stageLine, type CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { suggestionCount } from "../../lib/suggestions";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { HiddenList } from "./HiddenList";
import { SECTION_META } from "./sectionMeta";

export function Section({ section, open, onToggle, onAdd, suggestions = 0, children }: {
  section: CatSection;
  open: boolean;
  onToggle: () => void;
  /** "+ Ekle" in the open header: this section's kind, no day. */
  onAdd: () => void;
  /** Its open suggestions: "1 öneri" in the header (never part of its "3/4"), shown open or closed. */
  suggestions?: number;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.id];
  const label = meta.label();
  const { total, pct, complete } = sectionProgress(section);
  const ideas = section.ideas;
  // v11: the header says where its needs stand in stage words ("1 rezerve · 2 seçildi · 1 aranıyor"); the ideas and
  // Hazırlık count instead.
  const line = isIdeaSection(section.id) || section.id === "prep" ? null : stageLine(section.stages);
  return (
    <section className={`cat-sec${open ? "" : " closed"}`} style={{ "--c": meta.color } as React.CSSProperties} aria-label={label} data-section={section.id}>
      <div className="cat-head" onClick={onToggle}>
        <button type="button" className="cat-title" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <span className="cat-ic" aria-hidden>
            <KindIcon kind={meta.icon} size={22} />
          </span>
          <span className="cat-tt">
            <b>{label}</b>
            {line && <small className="cat-st">{line}</small>}
          </span>
        </button>
        <span className="cat-end">
          {open && meta.templates.length > 0 && (
            <button type="button" className="cat-add" onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label={L(`${label}: ekle`, `${label}: add`)}>
              <UiIcon name="plus" size={14} />
              {L("Ekle", "Add")}
            </button>
          )}
          {suggestions > 0 && <span className="sg-count">{suggestionCount(suggestions)}</span>}
          {/* Drawn only for something being read into it (arrive) or suggested: nothing to count yet. */}
          {!section.entries.length && !section.hidden.length ? null : ideas ? (
            <span className="cat-ideas">{ideaCount(section.id, ideas, section.entries)}</span>
          ) : (
            <>
              <span className={`cat-bar${complete ? " done" : ""}`} aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="cat-count" aria-label={L(`${section.settled} / ${total} tamam`, `${section.settled} of ${total} settled`)}>
                {section.settled}
                <i>/{total}</i>
              </span>
            </>
          )}
          <span className="cat-chev" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </span>
      </div>
      {open && (
        <div className="cat-body">
          {children}
          {section.hidden.length > 0 && <HiddenList things={section.hidden} />}
        </div>
      )}
    </section>
  );
}

/**
 * An idea section's neutral count (0.35.3), never a "3/4": "5 fikir · 2 tanesi bir güne kondu", İlham "4 kayıt".
 * Done ones join it quietly ("· 1 yapıldı").
 */
export function ideaCount(id: CatSection["id"], { total, onDay, done }: NonNullable<CatSection["ideas"]>, entries: CatSection["entries"] = []): string {
  if (id === "inspo") return L(`${total} kayıt`, `${total} saved`);
  // v11 phase 4: Yapılacak şeyler counts its places, its restaurants and what's on the plan ("4 yer · 4 restoran · 3 planda").
  if (id === "todo") {
    const records = entries.map((e) => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null)).filter((i): i is NonNullable<typeof i> => i != null);
    const food = records.filter((i) => i.category === "food").length;
    const planned = records.filter((i) => !i.doneAt && (i.status === "chosen" || i.status === "booked" || Boolean(i.dates.start))).length;
    const parts = [L(`${records.length - food} yer`, `${records.length - food} place${records.length - food === 1 ? "" : "s"}`)];
    if (food) parts.push(L(`${food} restoran`, `${food} restaurant${food === 1 ? "" : "s"}`));
    if (planned) parts.push(L(`${planned} planda`, `${planned} on the plan`));
    if (done) parts.push(L(`${done} yapıldı`, `${done} done`));
    return parts.join(" · ");
  }
  const parts = [L(`${total} fikir`, `${total} idea${total === 1 ? "" : "s"}`)];
  if (onDay) parts.push(L(`${onDay} tanesi bir güne kondu`, `${onDay} on a day`));
  if (done) parts.push(id === "food" ? L(`${done} gidildi`, `${done} visited`) : L(`${done} yapıldı`, `${done} done`));
  return parts.join(" · ");
}
