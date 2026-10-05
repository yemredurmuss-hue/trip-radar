// The Plan tab (spec 0.34, docs/mockups/2026-10-05-kategoriler-v4.html): the trip by category — Uçuş,
// Konaklama, Ulaşım, Etkinlikler, Yapılacak şeyler, Restoranlar, Diğer — each a band of one white sheet that
// opens and closes (remembered per trip), with the approved cards in a timeline inside and what's out of the
// way at its end. A section with nothing in it (and nothing hidden) isn't drawn; it's one chip in the "Ekle"
// line at the bottom.
import { sectionOfItem, type CatSection, type SectionId } from "../../lib/categories";
import { L } from "../../lib/i18n";
import type { Plan } from "../../lib/plan";
import type { InsertAt } from "../../lib/templates";
import { AddButton } from "../cards/AddSheet";
import { KindIcon } from "../cards/Silhouettes";
import { Section } from "./Section";
import { SECTION_META } from "./sectionMeta";
import { SectionTimeline, type SectionCards } from "./SectionTimeline";

export function CategoryPlan({ plan, sections, isOpen, onOpen, tripId, cities, cards, onAdd }: {
  plan: Plan;
  sections: CatSection[];
  /** Open now: the traveller's choice, else the first look (sectionMeta.useSectionOpen). */
  isOpen: (section: CatSection) => boolean;
  onOpen: (id: SectionId, open: boolean) => void;
  tripId: string;
  cities: string[];
  cards: SectionCards;
  /** Adds in a section (its kind; at a day and city when given), or (null) anything from the plan's head. */
  onAdd: (section: SectionId | null, at: InsertAt | null) => void;
}) {
  const n = plan.nights;
  const parts = [n.booked && L(`${n.booked} rezerve`, `${n.booked} booked`), n.chosen && L(`${n.chosen} seçildi`, `${n.chosen} chosen`), n.open && L(`${n.open} açık`, `${n.open} open`)].filter(Boolean);
  const shown = sections.filter((s) => s.entries.length || s.hidden.length);
  const empty = sections.filter((s) => !s.entries.length && !s.hidden.length);
  return (
    <div className="section trip-plan cat-plan">
      <div className="section-head">
        <span>{L("Gezi planı", "Trip plan")}</span>
        {n.total > 0 && <span className="muted">{[L(`${n.total} gece`, `${n.total} night${n.total === 1 ? "" : "s"}`), ...parts].join(" · ")}</span>}
        <AddButton onClick={() => onAdd(null, null)} />
      </div>
      {plan.notices.map((x) => (
        <div key={x.text} className="notice">
          ⚠ {x.text}
        </div>
      ))}
      {shown.length > 0 && (
        <div className="cat-sheet">
          {shown.map((s) => {
            const opened = isOpen(s);
            return (
              <Section key={s.id} section={s} open={opened} onToggle={() => onOpen(s.id, !opened)} onAdd={() => onAdd(s.id, null)}>
                <SectionTimeline section={s} plan={plan} tripId={tripId} cities={cities} cards={cards} onAdd={(at) => onAdd(s.id, at)} onIdea={(item) => onOpen(sectionOfItem(item), true)} />
              </Section>
            );
          })}
        </div>
      )}
      {empty.length > 0 && (
        <div className="cat-more" aria-label={L("Başka bir şey ekle", "Add something else")}>
          <span>{L("Ekle:", "Add:")}</span>
          {empty.map((s) => (
            <button key={s.id} type="button" className="cat-chip" data-section-chip={s.id} style={{ "--c": SECTION_META[s.id].color } as React.CSSProperties} onClick={() => onAdd(s.id, null)}>
              <KindIcon kind={SECTION_META[s.id].icon} size={15} />
              {SECTION_META[s.id].short()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
