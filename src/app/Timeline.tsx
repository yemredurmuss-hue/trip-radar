import { useState, type ReactNode } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange } from "../lib/items";
import { isRental, type Leg } from "../lib/legs";
import type { OptionGroup } from "../lib/plan";
import { dayRows, daySummary, journeyTitle, rowsLeft, type DayRow } from "../lib/journey";
import { entryDomId } from "../lib/progress";
import type { Ranked } from "../lib/choice";
import type { RentalEntry, Timeline, TimelineEntry, TimelineSection } from "../lib/timeline";
import type { Item, Listing } from "../lib/types";
import { CategoryIcon, type IconName } from "./Icons";
import { L, locale } from "../lib/i18n";
import type { InsertAt } from "../lib/templates";
import { insertAtDay } from "../lib/templates";
import { DayCards } from "./days/DayCards";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, ranked?: Ranked, onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;
/** A transfer or a change of city as a card on the plan (cards/LegCard.tsx). */
export type LegCardFor = (l: Leg) => ReactNode;

const fmt = (d: string) => formatDateRange(d, null);

/** The Plan (plan/CategoryPlan.tsx, sections) or the day-by-day itinerary (this view). */
export type TimelineMode = "plan" | "days";

/**
 * The itinerary: day by day, hour by hour, each booking a small block that opens its card on the plan,
 * information (check-in, the metro) a line.
 */
export function TimelineView({
  timeline,
  tripId,
  leg,
  onAdd,
  listings,
  today,
  onShow,
  cityImage,
}: {
  timeline: Timeline;
  tripId: string;
  leg: LegFor;
  /** Opens the add sheet at a day of the itinerary. */
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  /** Shows a block of the plan (from the itinerary). */
  onShow: (entryKey: string) => void;
  /** The city's photo for its day cards. */
  cityImage?: (city: string | null) => string | null;
}) {
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  // 0.34.1: the days as cards (days/DayCards.tsx); the list below (Itinerary) is no longer shown.
  return (
    <div className="section trip-plan">
      <DayCards sections={timeline.sections} leg={leg} onAdd={onAdd} listings={listings} today={today} rentals={rentals} onShow={onShow} cityImage={cityImage} />
    </div>
  );
}

interface RenderProps {
  tripId: string;
  leg: LegFor;
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  /** The trip's rented cars: their pick-up and return are lines on those days. */
  rentals: RentalEntry[];
  onShow: (entryKey: string) => void;
}

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });

function iconOf(entry: TimelineEntry): IconName {
  switch (entry.kind) {
    case "stay":
      return "stay";
    case "plan":
      return entry.items.every(isRental) ? "car" : "activity";
    case "rental":
      return "car";
    case "event":
      return entry.item.category;
    case "travel": {
      const mode = entry.travel?.mode ?? entry.leg?.mode;
      return mode && mode !== "flight" ? "transport" : entry.role === "move" && !mode ? "transport" : "flight";
    }
    default:
      return "transport";
  }
}

// --- the itinerary: day by day, small blocks -----------------------------------------------------------

const ROW_ICONS: Partial<Record<DayRow["kind"], IconName>> = { leg: "transport", rental: "car" };

/** Where a row's block lives on the plan's front (to open it there). */
function planKey(row: DayRow): string | null {
  if (row.entry) return row.entry.key;
  if (row.leg) return `leg:${row.leg.key}`;
  if (row.rental) return row.rental.key;
  if (row.item) return `event:${row.item.id}`;
  return row.stayKey;
}

function rowIcon(row: DayRow): IconName {
  if (row.item) return isRental(row.item) ? "car" : row.item.category;
  if (row.entry?.kind === "travel") return iconOf(row.entry);
  return ROW_ICONS[row.kind] ?? "other";
}

/** What a small block says of where it stands, in a word or two. */
function rowStatus(row: DayRow): string {
  if (row.state === "decide") return row.status || L("karar ver", "decide");
  if (row.state === "open") return row.kind === "leg" ? L("planlanmadı", "not planned") : row.status || L("planlanmadı", "not planned");
  // Done says so in a word; what was booked is on the block itself.
  if (row.state === "done") return `✓ ${row.status.replace(/\s*✓$/, "")}`;
  return row.status;
}

function Itinerary({ sections, ...render }: { sections: TimelineSection[] } & RenderProps) {
  return (
    <div className="itinerary">
      {sections.map((section) => {
        if (section.kind === "journey") {
          const j = section.journey;
          const route = j.from && j.to ? `${j.from} → ${j.to}` : j.to ? `→ ${j.to}` : j.from ? `${j.from} →` : null;
          const rows = dayRows({ journey: section, rentals: render.rentals, listings: render.listings });
          return <ItDay key={section.key} id={entryDomId(`it:${j.key}`)} title={journeyTitle(j)} date={j.date} city={j.role === "departure" ? j.from : j.to} route={route} rows={rows} {...render} />;
        }
        if (section.kind === "travel") {
          // A trip on the line outside a day (a connection the day before).
          const rows = dayRows({ journey: { kind: "journey", key: section.key, journey: { key: section.key, role: "move", date: section.entry.date, dayNo: null, from: null, to: null, out: null, in: null }, entries: [section.entry] } });
          return <ItDay key={section.key} id={entryDomId(`it:${section.key}`)} title={fmt(section.entry.date)} date={section.entry.date} city={null} route={null} rows={rows} {...render} />;
        }
        const stays = section.stays.map((st) => st.block);
        return (
          <section key={section.key} className="it-city" aria-label={section.city ?? L("Konaklama", "Stay")}>
            <header className="it-city-head">
              <b>{section.city ?? L("Konaklama", "Stay")}</b>
              {section.range && <span className="muted num">{formatDateRange(section.range.start, section.range.end)}</span>}
              {stays.map((b) => (
                <button key={b.range.start} className={`it-stay st-${b.kind}`} onClick={() => render.onShow(`stay:${b.range.start}`)}>
                  <CategoryIcon category="stay" size={15} />
                  {b.kind === "open" ? (b.groups.length ? L("konaklama · karar ver", "stay · decide") : L("konaklama · planlanmadı", "stay · not planned")) : b.item.name}
                  {b.kind === "booked" && " ✓"}
                </button>
              ))}
            </header>
            {section.entries.map((e) => {
              if (e.kind === "day") {
                const rows = dayRows({ day: e, rentals: render.rentals, listings: render.listings });
                return <ItDay key={e.key} id={entryDomId(`it:${e.key}`)} title={e.title} date={e.date} city={section.city} route={null} rows={rows} {...render} />;
              }
              if (e.kind === "plan") {
                return (
                  <p key={e.key} className="it-note">
                    {e.items.map((i) => i.name).join(", ")} · {L("gün belli değil", "no date yet")}
                  </p>
                );
              }
              return null;
            })}
          </section>
        );
      })}
    </div>
  );
}

/** "+" on a day of the itinerary: adds on that day, in its city. */
function DayAdd({ date, city, onAdd }: { date: string; city: string | null; onAdd: (at: InsertAt) => void }) {
  return (
    <button type="button" className="it-add" title={L("Bu güne ekle", "Add to this day")} aria-label={L(`${fmt(date)}: bu güne ekle`, `${fmt(date)}: add to this day`)} onClick={() => onAdd(insertAtDay(date, city))}>
      +
    </button>
  );
}

/** A day of the itinerary: its number, date and route, then what happens, hour by hour; "+" adds to it. */
function ItDay({ id, title, date, city, route, rows, ...render }: { id: string; title: string; date: string; city: string | null; route: string | null; rows: DayRow[] } & RenderProps) {
  const left = rowsLeft(rows);
  const [open, setOpen] = useState(true);
  if (!rows.length) {
    return (
      <div className="it-day empty" id={id}>
        <b>{title}</b>
        <span className="muted num">{`${fmt(date)} ${weekday(date)}`}</span>
        <span className="muted">{L("boş gün", "free day")}</span>
        <DayAdd date={date} city={city} onAdd={render.onAdd} />
      </div>
    );
  }
  return (
    <article className="it-day" id={id}>
      <DayAdd date={date} city={city} onAdd={render.onAdd} />
      <button className="it-day-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{title}</b>
        <span className="muted num">{`${fmt(date)} ${weekday(date)}`}</span>
        {route && <span className="it-route">{route}</span>}
        {date === render.today && <span className="today-chip">{L("Bugün", "Today")}</span>}
        {left > 0 && <span className="day-left">{L(`${left} iş`, `${left} to do`)}</span>}
        <span className="day-chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <ol className="it-rows">
          {rows.map((r) => (
            <ItRow key={r.key} row={r} {...render} />
          ))}
        </ol>
      ) : (
        <p className="it-folded">{daySummary(rows)}</p>
      )}
    </article>
  );
}

/**
 * A row of the itinerary: a small block for a booking (the flight, the taxi, the tour, the car) that
 * opens its card on the plan; a line for information. A transfer with no plan yet opens right here.
 */
function ItRow({ row, ...render }: { row: DayRow } & RenderProps) {
  const [open, setOpen] = useState(false);
  const time = row.time ? `${row.estimated ? "~" : ""}${row.time}` : "";
  const key = planKey(row);
  const itKey = row.leg ? `leg:${row.leg.key}` : key;
  if (row.kind === "info" || row.kind === "ideas" || row.kind === "idea" || (row.kind === "leg" && row.state === "info")) {
    const text =
      row.kind === "ideas" ? (
        <>
          <b>{L("Fikirler", "Ideas")}</b>
          <span>{row.items.map((i) => i.name).join(", ")}</span>
        </>
      ) : row.kind === "leg" ? (
        <>
          <b>{row.line ?? row.title}</b>
          <span>{row.title}</span>
        </>
      ) : (
        <>
          <b>{row.title}</b>
          {row.sub && <span>{row.sub}</span>}
        </>
      );
    return (
      <li className={`it-row info${row.kind === "idea" ? " idea" : ""}`} data-it-key={itKey ?? undefined}>
        <span className="it-time num">{time}</span>
        <span className="it-dot" aria-hidden />
        {row.stayKey ? (
          <button className="it-line" onClick={() => render.onShow(row.stayKey!)}>
            {text}
          </button>
        ) : (
          <span className="it-line">{text}</span>
        )}
      </li>
    );
  }
  // A transfer with nothing planned: say how, right here; everything else opens on the plan.
  const planHere = row.kind === "leg" && row.state === "open" && row.leg;
  return (
    <li className={`it-row st-${row.state}`} data-it-key={itKey ?? undefined}>
      <span className="it-time num">{time}</span>
      <span className="it-dot" aria-hidden />
      <div className="it-cell">
        <button
          className={`it-block st-${row.state}`}
          aria-expanded={planHere ? open : undefined}
          onClick={() => (planHere ? setOpen(!open) : key && render.onShow(key))}
        >
          <span className="it-ic" aria-hidden>
            <CategoryIcon category={rowIcon(row)} size={16} />
          </span>
          <span className="it-t">
            <b>{row.title}</b>
            {row.sub && <span>{row.sub}</span>}
          </span>
          <span className={`it-chip st-${row.state}`}>{rowStatus(row)}</span>
        </button>
        {planHere && open && <div className="it-more">{render.leg(row.leg!, { embedded: true })}</div>}
      </div>
    </li>
  );
}
