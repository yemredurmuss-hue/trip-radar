// The Plan tab (spec 0.34, docs/mockups/2026-10-05-kategoriler-v4.html): the trip by category — Uçuş,
// Konaklama, Ulaşım, Etkinlikler, Yapılacak şeyler, Restoranlar, Diğer, İlham (closed, last) — each a band of one white sheet that
// opens and closes (remembered per trip), with the approved cards in a timeline inside and what's out of the
// way at its end. A section with nothing in it (and nothing hidden) isn't drawn; it's one chip in the "Ekle"
// line at the bottom. Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): Etkinlikler has an empty card per city
// with nothing booked there, Diğer the eSIM's while a trip abroad has none (the rule's suggestion, drawn as its
// card); a section with only those is drawn and open, and they're never in its "3/4".
import type { ReactNode } from "react";
import { sectionOfItem, type CatSection, type SectionId } from "../../lib/categories";
import { activityGaps } from "../../lib/emptyCards";
import { L } from "../../lib/i18n";
import type { Plan } from "../../lib/plan";
import type { InsertAt } from "../../lib/templates";
import type { Item, Suggestion } from "../../lib/types";
import { AddButton, InsertPoint } from "../cards/AddSheet";
import { EmptyActivityCard, EmptyEsimCard } from "../cards/EmptyCard";
import { KindIcon } from "../cards/Silhouettes";
import { Section } from "./Section";
import { provisionalSection, SECTION_META } from "./sectionMeta";
import { SectionTimeline, type SectionCards } from "./SectionTimeline";
import { SuggestionCards } from "./SuggestionCards";
import type { BoardSuggestions } from "../useSuggestions";

export function CategoryPlan({ plan, sections, isOpen, onOpen, tripId, cities, cards, onAdd, today, items, pending, suggestions }: {
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
  today: string;
  items: Item[];
  /** What's being read now (arrive/useArrivals): under the header when its place can't be guessed, else atop its section (drawn even while empty). */
  pending?: { lead: ReactNode; bySection: Partial<Record<SectionId, ReactNode>> };
  /** Öneriler (useSuggestions): cards atop their section, "Plana ekle" and "Gerek yok". */
  suggestions?: Pick<BoardSuggestions, "bySection" | "add" | "dismiss" | "notes">;
}) {
  const n = plan.nights;
  const parts = [n.booked && L(`${n.booked} rezerve`, `${n.booked} booked`), n.chosen && L(`${n.chosen} seçildi`, `${n.chosen} chosen`), n.open && L(`${n.open} açık`, `${n.open} open`)].filter(Boolean);
  const waiting = (s: CatSection) => pending?.bySection[s.id] != null;
  // A section with only suggestions is drawn too (its header says "2 öneri"); they never count in its "3/4".
  // The rule's eSIM suggestion is the eSIM's empty card (its "Gerek yok" the same dismissal), not a suggestion card.
  const esim = suggestions?.bySection.other?.find((s) => s.key === ESIM_RULE) ?? null;
  const suggested = (s: CatSection) => (suggestions?.bySection[s.id] ?? []).filter((x) => x.key !== ESIM_RULE);
  const gaps = activityGaps(plan, items);
  const emptyRows = (s: CatSection): EmptyRow[] =>
    s.id === "activity"
      ? gaps.map((g) => ({ key: `activity:${g.city}`, when: L("Tarihsiz", "No date"), city: g.city, card: <EmptyActivityCard gap={g} />, at: { city: g.city, date: null } }))
      : s.id === "other" && esim && suggestions
        ? [{ key: "esim", when: L("Tüm gezi", "Whole trip"), city: null, card: <EmptyEsimCard suggestion={esim} onAdd={suggestions.add} onDismiss={suggestions.dismiss} />, at: { city: null, date: null } }]
        : [];
  const shown = sections.filter((s) => s.entries.length || s.hidden.length || waiting(s) || suggested(s).length || emptyRows(s).length);
  // İlham fills by sending links (a Reel, a pin), never by hand: no "Ekle" chip for it.
  const empty = sections.filter((s) => !s.entries.length && !s.hidden.length && !waiting(s) && !suggested(s).length && !emptyRows(s).length && SECTION_META[s.id].templates.length > 0);
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
      {pending?.lead && <div className="ar-lead">{pending.lead}</div>}
      {shown.length > 0 && (
        <div className="cat-sheet">
          {shown.map((s) => {
            // A section drawn only for its suggestions stays closed ("2 öneri" in its header) and keeps no first look,
            // so the first real card there gives it its normal one.
            const rows = emptyRows(s);
            const own = s.entries.length > 0 || s.hidden.length > 0;
            const onlySuggested = !own && !waiting(s) && !rows.length && suggested(s).length > 0;
            // Only empty cards there (a new trip's Etkinlikler, Diğer's eSIM): open at first look, something's left.
            const opened = isOpen(onlySuggested ? provisionalSection(s) : !own && rows.length ? { ...s, open: true } : s);
            return (
              <Section key={s.id} section={s} open={opened} onToggle={() => onOpen(s.id, !opened)} onAdd={() => onAdd(s.id, null)} suggestions={suggested(s).length}>
                {suggestions && <SuggestionCards list={suggested(s)} onAdd={suggestions.add} onDismiss={suggestions.dismiss} notes={suggestions.notes} />}
                {pending?.bySection[s.id]}
                {own && <SectionTimeline section={s} plan={plan} tripId={tripId} cities={cities} cards={cards} onAdd={(at) => onAdd(s.id, at)} onIdea={(item) => onOpen(sectionOfItem(item), true)} today={today} items={items} />}
                <EmptyRows rows={rows} onAdd={(at) => onAdd(s.id, at)} />
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

/** The rule's eSIM suggestion (lib/suggestions.ts), drawn as the eSIM's empty card. */
const ESIM_RULE: Suggestion["key"] = "rule:esim";

interface EmptyRow {
  key: string;
  /** The date column: "Tarihsiz", "Tüm gezi". */
  when: string;
  city: string | null;
  card: ReactNode;
  at: InsertAt;
}

/** Empty cards on the section's line, as its timeline draws a day: the date column, the dot, the card and its "+". */
function EmptyRows({ rows, onAdd }: { rows: EmptyRow[]; onAdd: (at: InsertAt) => void }) {
  if (!rows.length) return null;
  return (
    <ol className="cat-line ek-line">
      {rows.map((r) => (
        <li key={r.key} className="cat-day undated">
          <div className="cat-date">
            <b>{r.when}</b>
            {r.city && <span className="cat-date-city">{r.city}</span>}
          </div>
          <span className="cat-dot" aria-hidden />
          <div className="cat-cards">
            <div className="ek-slot">
              {r.card}
              <InsertPoint at={r.at} onAdd={onAdd} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
