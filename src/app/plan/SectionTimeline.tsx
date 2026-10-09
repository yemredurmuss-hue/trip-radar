// An open section's inside (spec 0.34 §Bölüm içi zaman çizelgesi): a narrow date column ("9 Eki", the
// weekday and the city under it), a thin line with a dot per day, the cards on the right — a day's cards one
// under another in time order, "Tarihsiz" last by city. The cards are the approved ones, unchanged; "+"
// between them adds this section's kind on that day, in that city. Yapılacak şeyler and Restoranlar are a
// list by city instead (0.35.3, ideas/IdeaList), Yapılacak şeyler with the quick line on top; İlham is tiles.
import type { ReactNode } from "react";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { entryDomId } from "../../lib/progress";
import { insertAt, type InsertAt } from "../../lib/templates";
import { InsertPoint } from "../cards/AddSheet";
import type { DayGroup } from "../../lib/categories";
import { activitySearches, returnFlightSearch } from "../../lib/searchLinks";
import { activityGaps } from "../../lib/emptyCards";
import { sameCity } from "../../lib/plan";
import { InspoGrid } from "../ideas/IdeaList";
import { IdeaTiles } from "../ideas/IdeaTiles";
import { ActivityBoard } from "./ActivityBoard";
import type { CardFor, LegCardFor, RenderGroup, SettledFor } from "../Timeline";
import { PlanEntry } from "./PlanEntry";
import { PrepList } from "./PrepList";

/** How the board draws its cards (TripPanel): the same functions the plan always used. */
export interface SectionCards {
  legCard: LegCardFor;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
}



export function SectionTimeline({ section, plan, tripId, cities, cards, onAdd, onIdea, today, items, extra = [] }: {
  section: CatSection;
  /** v11: the section's empty cards (the insurance's, the eSIM's), in the same grid as its cards. */
  extra?: { key: string; card: ReactNode }[];
  plan: Pick<Plan, "range" | "stayBlocks">;
  tripId: string;
  cities: string[];
  cards: SectionCards;
  onAdd: (at: InsertAt) => void;
  /** A line typed in the quick box is saved (its section opens). */
  onIdea: (item: Item) => void;
  /** YYYY-MM-DD: "Bugün" during the trip, and a day gone by sends an idea back to its pool. */
  today: string;
  /** The trip's records (a one-way flight's "Dönüş bileti ara"). */
  items: Item[];
}) {
  if (section.id === "inspo") return <InspoGrid section={section} plan={plan} />;
  // v11 phase 4: tiles, "+ Plana koy" ↔ "✓ Planda"; no quick box (the chat adds), no day here (Gün gün gives it).
  if (section.id === "todo" || section.id === "food") return <IdeaTiles section={section} fallback={(e) => <Piece entry={e} cards={cards} />} />;
  // v11: what's on the plan as rows, the ideas as tiles under "Fikirler" (plan/ActivityBoard).
  if (section.id === "activity")
    return (
      <>
        <ActivityBoard section={section} plan={plan} fallback={(e) => <Piece entry={e} cards={cards} />} />
      </>
    );
  return (
    <>
      {/* v11: the cards in a grid (two across, transport three), in the order of their days, no date column. */}
      {(section.days.length > 0 || extra.length > 0) && (
        <div className={`cat-grid cat-in-${section.id}`}>
          {section.days.flatMap((day) =>
            day.entries.map((e) => (
              <div key={e.key} id={entryDomId(catDomKey(e))} className={`cat-card${e.piece.kind === "entry" ? ` tl-${e.piece.entry.kind}` : ""}`} data-day={day.date ?? undefined}>
                <Piece entry={e} cards={cards} />
                {/* "+" here (this card's day and city), out of sight until the card is pointed at or reached by the keyboard. */}
                <InsertPoint at={atOf(e, day)} onAdd={onAdd} />
              </div>
            )),
          )}
          {extra.map((x) => (
            <div key={x.key} className="ek-cell">{x.card}</div>
          ))}
        </div>
      )}
      {section.prep.length > 0 && <PrepList entries={section.prep} />}
      <SearchLinks section={section} plan={plan} items={items} />
    </>
  );
}

/** The "+" by a card: a block's own place (a stay: its city, its last night), else the card's day and city. */
const atOf = (e: CatEntry, day: DayGroup): InsertAt => (e.piece.kind === "entry" ? insertAt(e.piece.entry) : { city: e.city ?? day.city, date: e.date });

/** One entry's card: a block of the front, options with no block, or a record decided or still to pick. */
function Piece({ entry, cards }: { entry: CatEntry; cards: SectionCards }): ReactNode {
  const p = entry.piece;
  switch (p.kind) {
    case "entry":
      return <PlanEntry entry={p.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} plain />;
    case "group":
      return cards.renderGroup(p.group, null, p.subtitle, true);
    case "item":
      return p.settled ? cards.settled(p.item) : cards.card(p.item, p.siblings);
  }
}

/**
 * Where to look next (0.35.11, lib/searchLinks): Uçuş with a one-way flight, "Dönüş bileti ara"; Etkinlikler,
 * a GetYourGuide search per city. Links that open a search; nothing is saved.
 */
function SearchLinks({ section, plan, items }: { section: CatSection; plan: Pick<Plan, "range" | "stayBlocks">; items: Item[] }) {
  const links =
    section.id === "flight"
      ? [returnFlightSearch(items, plan)].filter((x): x is { label: string; url: string } => x != null)
      : section.id === "activity"
        ? // A city with no activity yet has its empty card (with its searches) instead.
          activitySearches(plan).filter((l) => !activityGaps(plan, items).some((g) => sameCity(g.city, l.city)))
        : [];
  if (!links.length) return null;
  return (
    <div className={`cat-search${section.id === "activity" ? " gyg" : ""}`}>
      {section.id === "activity" && <span>GetYourGuide:</span>}
      {links.map((l) => (
        <a key={l.url} className="cat-search-link" href={l.url} target="_blank" rel="noreferrer">
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
