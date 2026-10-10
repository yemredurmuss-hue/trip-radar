// The Plan tab (spec 0.34, docs/mockups/2026-10-05-kategoriler-v4.html; v11, 2026-10-08-plan-pano-v11-design.md): the trip by
// category — Uçuş, Konaklama, Ulaşım, Etkinlik ve turlar, Yapılacak şeyler, Belgeler ve internet, Hazırlık, İlham — each a band of one white sheet that
// opens and closes (remembered per trip), with the approved cards in a timeline inside and what's out of the
// way at its end. A section with nothing in it (and nothing hidden) isn't drawn; it's one chip in the "Ekle"
// line at the bottom. Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): Etkinlikler has an empty card per city
// with nothing booked there, Diğer the eSIM's while a trip abroad has none (the rule's suggestion, drawn as its
// card); a section with only those is drawn and open, and they're never in its "3/4".
import type { ReactNode } from "react";
import { planSectionOfItem, type CatSection, type SectionId } from "../../lib/categories";
import { activityGaps } from "../../lib/emptyCards";
import { L } from "../../lib/i18n";
import { nightsSummary } from "../../lib/lifecycle";
import type { Plan } from "../../lib/plan";
import type { InsertAt } from "../../lib/templates";
import type { Item, Suggestion } from "../../lib/types";
import type { Visa } from "../../lib/visa";
import { AddButton } from "../cards/AddSheet";
import { EmptyActivityCard, EmptyEsimCard, EmptyInsuranceCard } from "../cards/EmptyCard";
import { KindIcon } from "../cards/Silhouettes";
import { Section } from "./Section";
import { provisionalSection, SECTION_META } from "./sectionMeta";
import { SectionTimeline, type SectionCards } from "./SectionTimeline";
import { SuggestionCards } from "./SuggestionCards";
import { VisaRow } from "./VisaRow";
import { ActivityBoard } from "./ActivityBoard";
import { IdeaTiles } from "../ideas/IdeaTiles";
import { SectionSuggestContext } from "./sectionSuggest";
import { TripShape, type ShapeExtras } from "./TripShape";
import type { JourneyHop, JourneyStop } from "../../lib/tripShape";
import type { BoardSuggestions } from "../useSuggestions";
import type { BudgetSlice } from "../../lib/progress";
import { formatPrice } from "../../lib/items";

/** The sections whose suggestions are tiles among their ideas. */
const TILED: SectionId[] = ["activity", "todo"];

const SLICE: Partial<Record<SectionId, BudgetSlice>> = { flight: "flight", stay: "stay", transport: "transport", activity: "activity", other: "other" };

export function CategoryPlan({ allot = null, plan, sections, isOpen, onOpen, tripId, cities, cards, onAdd, today, items, pending, suggestions, visa = null, visaDone = false, onVisaDone, shape = null, onStop, onJourneyOrder }: {
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
  /** The traveller's visa for the trip's country: Belgeler ve internet's first line (v11), drawn even with nothing else there. */
  visa?: Visa | null;
  visaDone?: boolean;
  onVisaDone?: (done: boolean) => void;
  /** The trip's shape under the head (v11): its stops, a tap opens a stop's place. */
  shape?: ({ stops: JourneyStop[]; hops: JourneyHop[] } & ShapeExtras) | null;
  onStop?: (stop: JourneyStop) => void;
  /** "Yolculuk sırasıyla": the trip in the order it's lived (Gün gün). */
  onJourneyOrder?: () => void;
  /** v11: the budget shared out by section ("€500 ayrıldı"), when the trip has one. */
  allot?: { by: Record<BudgetSlice, number>; currency: string } | null;
}) {
  const n = plan.nights;
  const waiting = (s: CatSection) => pending?.bySection[s.id] != null;
  // A section with only suggestions is drawn too (its header says "2 öneri"); they never count in its "3/4".
  // The rule's eSIM suggestion is the eSIM's empty card (its "Gerek yok" the same dismissal), not a suggestion card.
  const esim = suggestions?.bySection.other?.find((s) => s.key === ESIM_RULE) ?? null;
  // v11 phase 6: the insurance's suggestion is its empty card too, beside the eSIM's and as large.
  const insurance = suggestions?.bySection.other?.find((s) => s.key === INS_RULE) ?? null;
  // v11: a restaurant's suggestion sits atop Yapılacak şeyler, where restaurants are drawn.
  const suggested = (s: CatSection) => [...(suggestions?.bySection[s.id] ?? []), ...(s.id === "todo" ? (suggestions?.bySection.food ?? []) : [])].filter((x) => x.key !== ESIM_RULE && x.key !== INS_RULE);
  const gaps = activityGaps(plan, items);
  const emptyRows = (s: CatSection): EmptyRow[] =>
    s.id === "activity"
      ? gaps.map((g) => ({ key: `activity:${g.city}`, when: L("Tarihsiz", "No date"), city: g.city, card: <EmptyActivityCard gap={g} />, at: { city: g.city, date: null } }))
      : s.id === "other" && suggestions
        ? [
            ...(insurance ? [{ key: "cover:insurance", when: L("Tüm gezi", "Whole trip"), city: null, card: <EmptyInsuranceCard suggestion={insurance} onAdd={suggestions.add} onDismiss={suggestions.dismiss} />, at: { city: null, date: null } }] : []),
            ...(esim ? [{ key: "cover:esim", when: L("Tüm gezi", "Whole trip"), city: null, card: <EmptyEsimCard suggestion={esim} onAdd={suggestions.add} onDismiss={suggestions.dismiss} />, at: { city: null, date: null } }] : []),
          ]
        : [];
  const visaLine = (s: CatSection) => s.id === "other" && visa != null && visa.kind !== "none";
  const shown = sections.filter((s) => s.entries.length || s.hidden.length || waiting(s) || suggested(s).length || emptyRows(s).length || visaLine(s));
  // İlham fills by sending links (a Reel, a pin), never by hand: no "Ekle" chip for it.
  const empty = sections.filter((s) => !s.entries.length && !s.hidden.length && !waiting(s) && !suggested(s).length && !emptyRows(s).length && !visaLine(s) && SECTION_META[s.id].templates.length > 0);
  return (
    <div className="section trip-plan cat-plan">
      {/* v11 plan bar: "Plan", the order switch, "+ Ekle", the colours' key on the right; one line. */}
      <div className="section-head plan-bar" title={n.total > 0 ? nightsSummary(n) : undefined}>
        <strong className="plan-h">{L("Plan", "Plan")}</strong>
        {onJourneyOrder && (
          <span className="plan-order" role="group" aria-label={L("Sıra", "Order")}>
            <button type="button" aria-pressed="true">{L("Kategoriye göre", "By category")}</button>
            <button type="button" aria-pressed="false" onClick={onJourneyOrder}>{L("Yolculuk sırasıyla", "In trip order")}</button>
          </span>
        )}
        <AddButton onClick={() => onAdd(null, null)} />
        <span className="plan-key" aria-label={L("Renklerin anlamı", "What the colours say")}>
          <span><i className="pk-sw open" />{L("Arıyoruz", "Searching")}</span>
          <span><i className="pk-sw chosen" />{L("Seçildi", "Chosen")}</span>
          <span><i className="pk-sw booked" />{L("Rezerve", "Booked")}</span>
        </span>
      </div>
      {shape && shape.stops.length > 1 && <TripShape {...shape} onStop={(s) => onStop?.(s)} />}
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
            const opened = isOpen(onlySuggested ? provisionalSection(s) : !own && (rows.length || visaLine(s)) ? { ...s, open: true } : s);
            return (
              <Section key={s.id} section={s} allot={allot && SLICE[s.id] && allot.by[SLICE[s.id]!] > 0 ? formatPrice(allot.by[SLICE[s.id]!], allot.currency) : null} allotNum={allot && SLICE[s.id] && allot.by[SLICE[s.id]!] > 0 ? { amount: allot.by[SLICE[s.id]!], currency: allot.currency } : null} open={opened} onToggle={() => onOpen(s.id, !opened)} onAdd={() => onAdd(s.id, null)} suggestions={suggested(s).length}>
                <SectionSuggestContext.Provider value={suggestions && TILED.includes(s.id) ? { list: suggested(s), add: suggestions.add, dismiss: suggestions.dismiss, notes: suggestions.notes } : null}>
                {visaLine(s) && <VisaRow visa={visa} done={visaDone} onDone={(d) => onVisaDone?.(d)} />}
                {/* Etkinlik ve turlar and Yapılacak şeyler show their suggestions among their ideas, as tiles (sectionSuggest). */}
                {suggestions && !TILED.includes(s.id) && <SuggestionCards list={suggested(s)} onAdd={suggestions.add} onDismiss={suggestions.dismiss} notes={suggestions.notes} />}
                {pending?.bySection[s.id]}
                {/* The empty cards join the section's own grid (side by side with its cards), except Etkinlikler's. */}
                {own && <SectionTimeline section={s} plan={plan} tripId={tripId} cities={cities} cards={cards} onAdd={(at) => onAdd(s.id, at)} onIdea={(item) => onOpen(planSectionOfItem(item), true)} today={today} items={items} extra={s.id === "activity" ? [] : rows} />}
                {s.id === "activity" ? (
                  // v11: the tours and tickets come from the source as the shelf's tiles (plan/ActivityBoard), no empty card.
                  own ? null : <ActivityBoard section={s} plan={plan} fallback={() => null} />
                ) : s.id === "todo" && !own ? (
                  // Only suggestions so far: they're tiles under "Fikirler ve öneriler" all the same.
                  <IdeaTiles section={s} fallback={() => null} />
                ) : own ? null : (
                  <EmptyRows rows={rows} onAdd={(at) => onAdd(s.id, at)} />
                )}
                </SectionSuggestContext.Provider>
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
/** The rule's insurance suggestion, drawn as the insurance's empty card (v11 phase 6). */
const INS_RULE: Suggestion["key"] = "rule:insurance";

interface EmptyRow {
  key: string;
  /** The date column: "Tarihsiz", "Tüm gezi". */
  when: string;
  city: string | null;
  card: ReactNode;
  at: InsertAt;
}

/** Empty cards in the section's grid (v11: no date column), each card a cell; "+ Ekle" is at the section's end. */
function EmptyRows({ rows }: { rows: EmptyRow[]; onAdd?: (at: InsertAt) => void }) {
  if (!rows.length) return null;
  return (
    <div className="cat-grid ek-grid">
      {rows.map((r) => (
        <div key={r.key} className="ek-cell">{r.card}</div>
      ))}
    </div>
  );
}
