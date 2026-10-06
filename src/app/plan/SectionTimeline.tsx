// An open section's inside (spec 0.34 §Bölüm içi zaman çizelgesi): a narrow date column ("9 Eki", the
// weekday and the city under it), a thin line with a dot per day, the cards on the right — a day's cards one
// under another in time order, "Tarihsiz" last by city. The cards are the approved ones, unchanged; "+"
// between them adds this section's kind on that day, in that city. Yapılacak şeyler and Restoranlar are a
// list by city instead (0.35.3, ideas/IdeaList), Yapılacak şeyler with the quick line on top; İlham is tiles.
import type { ReactNode } from "react";
import { catDomKey, type CatEntry, type CatSection, type DayGroup } from "../../lib/categories";
import { L, locale } from "../../lib/i18n";
import { shortDay } from "../../lib/ideas";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { entryDomId } from "../../lib/progress";
import { insertAt, type InsertAt } from "../../lib/templates";
import { activitySearches, returnFlightSearch } from "../../lib/searchLinks";
import { activityGaps } from "../../lib/emptyCards";
import { sameCity } from "../../lib/plan";
import { InsertPoint } from "../cards/AddSheet";
import { IdeaList, InspoGrid } from "../ideas/IdeaList";
import { QuickAdd } from "../ideas/QuickAdd";
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

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });

/** The "+" after a card: a block's own place (a stay: its city, its last night), else the card's day and city. */
const atOf = (e: CatEntry, day: DayGroup): InsertAt => (e.piece.kind === "entry" ? insertAt(e.piece.entry) : { city: e.city ?? day.city, date: e.date });

export function SectionTimeline({ section, plan, tripId, cities, cards, onAdd, onIdea, today, items }: {
  section: CatSection;
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
  if (section.id === "todo" || section.id === "food") {
    return (
      <>
        {section.id === "todo" && <QuickAdd tripId={tripId} cities={cities} onAdded={onIdea} />}
        {section.id === "todo" && <p className="prep-sub">{L("Orada görülecek, gezilecek, denenecek şeyler", "What to see, visit and try there")}</p>}
        <IdeaList section={section} plan={plan} today={today} fallback={(e) => <Piece entry={e} cards={cards} />} />
      </>
    );
  }
  return (
    <>
      {section.days.length > 0 && (
      <ol className={`cat-line cat-in-${section.id}`}>
        {section.days.map((day) => (
          <li key={day.key} className={`cat-day${day.date ? "" : " undated"}`}>
            <div className="cat-date">
              {day.date ? (
                <>
                  <b>{shortDay(day.date)}</b>
                  <span>{weekday(day.date)}</span>
                </>
              ) : (
                <b>{L("Tarihsiz", "No date")}</b>
              )}
              {day.city && <span className="cat-date-city">{day.city}</span>}
            </div>
            <span className="cat-dot" aria-hidden />
            <div className="cat-cards">
              <DayCards section={section} day={day} plan={plan} cards={cards} onAdd={onAdd} />
            </div>
          </li>
        ))}
      </ol>
      )}
      {section.prep.length > 0 && <PrepList entries={section.prep} />}
      <SearchLinks section={section} plan={plan} items={items} />
    </>
  );
}

function DayCards({ section, day, plan, cards, onAdd }: { section: CatSection; day: DayGroup; plan: Pick<Plan, "range" | "stayBlocks">; cards: SectionCards; onAdd: (at: InsertAt) => void }) {
  return (
    <>
      {day.entries.map((e) => (
        <div key={e.key} id={entryDomId(catDomKey(e))} className={`cat-card${e.piece.kind === "entry" ? ` tl-${e.piece.entry.kind}` : ""}`}>
          <Piece entry={e} cards={cards} />
          <InsertPoint at={atOf(e, day)} onAdd={onAdd} />
        </div>
      ))}
    </>
  );
}

/** One entry's card: a block of the front, options with no block, or a record decided or still to pick. */
function Piece({ entry, cards }: { entry: CatEntry; cards: SectionCards }): ReactNode {
  const p = entry.piece;
  switch (p.kind) {
    case "entry":
      return <PlanEntry entry={p.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />;
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
