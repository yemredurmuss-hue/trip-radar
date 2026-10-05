import { useState, type ReactNode } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange, nightsBetween } from "../lib/items";
import { isRental, type Leg } from "../lib/legs";
import type { OptionGroup, Plan, StayBlock } from "../lib/plan";
import { dayRows, daySummary, journeyTitle, rowsLeft, type DayRow } from "../lib/journey";
import { entryDomId } from "../lib/progress";
import type { Ranked } from "../lib/choice";
import { nightsKey, type RentalEntry, type Timeline, type TimelineEntry, type TimelineSection } from "../lib/timeline";
import type { Category, Item, Listing } from "../lib/types";
import { setHidden } from "./actions";
import { Carousel } from "./Carousel";
import { CategoryIcon, type IconName } from "./Icons";
import { StatusBar, type Standing } from "./Status";
import { L, locale } from "../lib/i18n";
import type { InsertAt } from "../lib/templates";
import { insertAt, insertAtCity, insertAtDay, insertAtStart } from "../lib/templates";
import { AddButton, InsertPoint } from "./cards/AddSheet";
import { DeleteX } from "./cards/CardShell";
import { useCardEnv } from "./cards/PlanCard";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, ranked?: Ranked, onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;
/** A transfer or a change of city as a card on the plan (cards/LegCard.tsx). */
export type LegCardFor = (l: Leg) => ReactNode;

const fmt = (d: string) => formatDateRange(d, null);

/** "ideas" is the Fikirler tab (ideas/IdeasView.tsx, drawn by TripPanel); this view draws the other two. */
export type TimelineMode = "plan" | "days" | "ideas";

/**
 * The trip, two ways. "plan" is its front: a block for each thing booked or to decide — flights,
 * transfers with a plan, stays, what's chosen for a day, a rented car — in order, a city at a time.
 * "days" is the itinerary: day by day, hour by hour, each booking a small block that opens its card
 * on the plan, information (check-in, the metro) a line.
 */
export function TimelineView({
  plan,
  timeline,
  tripId,
  leg,
  legCard,
  onAdd,
  renderGroup,
  card,
  settled,
  listings,
  today,
  mode,
  onShow,
}: {
  plan: Plan;
  timeline: Timeline;
  tripId: string;
  leg: LegFor;
  legCard: LegCardFor;
  /** Opens the add sheet: at a place on the plan, or (null) from the heading. */
  onAdd: (at: InsertAt | null) => void;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
  listings?: Map<string, Listing>;
  today: string;
  mode: TimelineMode;
  /** Shows a block of the plan (from the itinerary). */
  onShow: (entryKey: string) => void;
}) {
  const start = plan.range?.start ?? null;
  const n = plan.nights;
  const parts = [n.booked && L(`${n.booked} rezerve`, `${n.booked} booked`), n.chosen && L(`${n.chosen} seçildi`, `${n.chosen} chosen`), n.open && L(`${n.open} açık`, `${n.open} open`)].filter(Boolean);
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  const render = { tripId, leg, legCard, onAdd, renderGroup, card, settled, start, listings, today, rentals, onShow };
  return (
    <div className="section trip-plan">
      {mode === "plan" && (
        <>
          <div className="section-head">
            <span>{L("Gezi planı", "Trip plan")}</span>
            {n.total > 0 && <span className="muted">{[L(`${n.total} gece`, `${n.total} night${n.total === 1 ? "" : "s"}`), ...parts].join(" · ")}</span>}
            <AddButton onClick={() => onAdd(null)} />
          </div>
          {plan.notices.map((x) => (
            <div key={x.text} className="notice">
              ⚠ {x.text}
            </div>
          ))}
          <div className="trip-line">
            {/* Before the way in: a taxi to the airport, a night near it. */}
            <ol className="timeline between tl-head-insert">
              <HeadInsert at={insertAtStart(timeline.board)} onAdd={onAdd} />
            </ol>
            {timeline.board.map((section) => (
              <Section key={section.key} section={section} {...render} />
            ))}
          </div>
        </>
      )}
      {mode === "days" && <Itinerary sections={timeline.sections} {...render} />}
    </div>
  );
}

interface RenderProps {
  tripId: string;
  start: string | null;
  leg: LegFor;
  legCard: LegCardFor;
  onAdd: (at: InsertAt | null) => void;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
  listings?: Map<string, Listing>;
  today: string;
  /** The trip's rented cars: their pick-up and return are lines on those days. */
  rentals: RentalEntry[];
  onShow: (entryKey: string) => void;
}

/** A "+" on its own row, in the cards' column: at the top of the plan and of each city's block. */
function HeadInsert({ at, onAdd }: { at: InsertAt; onAdd: (at: InsertAt) => void }) {
  return (
    <li className="tl-entry tl-insert">
      <div className="tl-side" aria-hidden />
      <div className="tl-content">
        <InsertPoint at={at} onAdd={onAdd} />
      </div>
    </li>
  );
}

function Section({ section, ...render }: { section: TimelineSection } & RenderProps) {
  if (section.kind === "travel") {
    return (
      <ol className="timeline between">
        <Row entry={section.entry} {...render} />
      </ol>
    );
  }
  if (section.kind === "journey") return null; // the itinerary's; the plan's front has no days
  const range = section.range;
  return (
    <section className="city-block" aria-label={section.city ?? L("Konaklama", "Stay")}>
      <header className="city-head">
        <span className="city-no">{section.index}</span>
        <b>{section.city ?? L("Konaklama", "Stay")}</b>
        {range && (
          <span className="muted">
            {formatDateRange(range.start, range.end)} · {L(`${section.nights} gece`, `${section.nights} night${section.nights === 1 ? "" : "s"}`)}
          </span>
        )}
      </header>
      <ol className="timeline">
        <HeadInsert at={insertAtCity(section)} onAdd={render.onAdd} />
        {section.stays.map((entry) => (
          <Row key={entry.key} entry={entry} {...render} />
        ))}
        {section.entries.map((entry) => (
          <Row key={entry.key} entry={entry} {...render} />
        ))}
      </ol>
    </section>
  );
}

/** Where a row stands, for the dot on the line: booked, planned (chosen, not bought) or open. */
function standingOf(entry: TimelineEntry): Standing | null {
  switch (entry.kind) {
    case "stay":
      return entry.block.kind === "booked" ? "booked" : entry.block.kind === "chosen" ? "planned" : "open";
    case "travel": {
      const items = entry.travel?.items ?? [];
      if (items.some((i) => i.status === "booked") || entry.leg?.choice?.booked) return "booked";
      if (items.some((i) => i.status === "chosen") || entry.leg?.choice?.mode) return "planned";
      return "open";
    }
    case "leg":
      return entry.leg.status === "booked" ? "booked" : entry.leg.status === "planned" || entry.leg.status === "chosen" ? "planned" : "open";
    case "rental":
      return entry.group.items.some((i) => i.status === "booked") ? "booked" : entry.group.items.some((i) => i.status === "chosen") ? "planned" : "open";
    case "event":
      return entry.item.status === "booked" ? "booked" : "planned";
    default:
      return null;
  }
}

/** Options still to compare get the whole width, side by side; the label sits above them. */
function comparing(entry: TimelineEntry): boolean {
  const undecided = (items: Item[]) => items.length >= 2 && !items.some((i) => i.status === "chosen" || i.status === "booked");
  if (entry.kind === "stay") return entry.block.kind === "open" && entry.block.groups.some((g) => undecided(g.items));
  if (entry.kind === "travel") return Boolean(entry.travel && !entry.travel.settled && undecided(entry.travel.items));
  if (entry.kind === "rental") return undecided(entry.group.items);
  return false;
}

function Row({ entry, ...render }: { entry: TimelineEntry } & RenderProps) {
  const standing = standingOf(entry);
  return (
    <li id={entryDomId(entry.key)} className={`tl-entry tl-${entry.kind}${standing ? ` st-${standing}` : ""}${comparing(entry) ? " tl-wide" : ""}`}>
      <div className="tl-side">
        <span className="tl-icon" aria-hidden>
          <CategoryIcon category={iconOf(entry)} size={20} />
          {standing === "booked" && <span className="tl-badge">✓</span>}
        </span>
        <Label entry={entry} today={render.today} />
      </div>
      <div className="tl-content">
        <Entry entry={entry} {...render} />
        <InsertPoint at={insertAt(entry)} onAdd={render.onAdd} />
      </div>
    </li>
  );
}

const eventLabels = (): Partial<Record<Category, string>> => ({ activity: L("Etkinlik", "Activity"), food: L("Yemek", "Food"), transport: L("Ulaşım", "Transport"), other: L("Plan", "Plan") });
const legLabels = () => ({ arrival: L("Transfer", "Transfer"), departure: L("Transfer", "Transfer"), change: L("Otel değişimi", "Hotel change"), move: L("Şehir değişimi", "City change") });
const travelLabels = () => ({ arrival: L("Varış", "Arrival"), move: L("Şehir değişimi", "City change"), departure: L("Dönüş", "Return"), other: L("Ulaşım", "Transport") });

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });

/** What and when, beside the line: "Konaklama · 8–11 Ekim · 3 gece", "5. gün · 11 Ekim Cmt". */
function Label({ entry, today }: { entry: TimelineEntry; today: string }) {
  let title: string;
  let lines: (string | null)[];
  switch (entry.kind) {
    case "travel":
      title = entry.role === "other" ? entry.title.split(" · ").at(-1)! : travelLabels()[entry.role];
      lines = [fmt(entry.date)];
      break;
    case "leg":
      title = legLabels()[entry.leg.kind];
      lines = [fmt(entry.date)];
      break;
    case "stay": {
      const b = entry.block;
      title = L("Konaklama", "Stay");
      lines = [entry.days ?? null, formatDateRange(b.range.start, b.range.end), L(`${b.nights} gece`, `${b.nights} night${b.nights === 1 ? "" : "s"}`)];
      break;
    }
    case "event":
      title = eventLabels()[entry.item.category] ?? L("Plan", "Plan");
      lines = [fmt(entry.date), entry.dayNo ? L(`${entry.dayNo}. gün`, `Day ${entry.dayNo}`) : null];
      break;
    case "day":
      title = entry.title;
      lines = [`${fmt(entry.date)} ${weekday(entry.date)}`];
      break;
    case "plan":
      title = entry.items.every(isRental) ? L("Araç kiralama", "Car rental") : L("Planlar", "Plans");
      lines = [L("gün belli değil", "no date yet")];
      break;
    case "rental":
      title = L("Araç kiralama", "Car rental");
      lines = [formatDateRange(entry.date, entry.end)];
      break;
  }
  return (
    <div className="tl-label">
      <b>{title}</b>
      {lines.filter(Boolean).map((l) => (
        <span key={l}>{l}</span>
      ))}
      {entry.kind === "day" && entry.date === today && <span className="today-chip">{L("Bugün", "Today")}</span>}
    </div>
  );
}

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

function Entry({ entry, tripId, leg, legCard, renderGroup, card, settled }: { entry: TimelineEntry } & RenderProps) {
  switch (entry.kind) {
    case "leg":
      return <>{legCard(entry.leg)}</>;
    case "stay":
      return <Block block={entry.block} skipped={Boolean(entry.skipped)} tripId={tripId} renderGroup={renderGroup} settled={settled} />;
    case "travel":
      if (entry.travel) {
        return (
          <div className={`tl-travel role-${entry.role}`}>
            {renderGroup({ ...entry.travel.group, items: entry.travel.items }, null, null, true)}
          </div>
        );
      }
      return (
        <div className={`tl-travel role-${entry.role}`}>
          {entry.role === "move" && entry.leg ? (
            legCard(entry.leg)
          ) : (
            <div className="empty-card">
              <span>
                <b>{entry.subtitle ?? L("Ulaşım", "Transport")}</b>
                <span className="muted">{L(`Henüz eklenmedi · sohbette "7 Ekim'de uçuşumuz var" demen yeter`, `Not added yet · just say "we fly on 7 October" in the chat`)}</span>
              </span>
              {entry.searchUrl && (
                <a className="pill-btn outline" href={entry.searchUrl} target="_blank" rel="noreferrer">
                  {L("Uçuş ara ↗", "Search flights ↗")}
                </a>
              )}
            </div>
          )}
        </div>
      );
    case "day":
      return <DayCard entry={entry} leg={leg} card={card} settled={settled} />;
    case "rental":
      return <div className="tl-rental">{renderGroup(entry.group, null, null, true)}</div>;
    case "event":
      return <>{settled(entry.item)}</>;
    case "plan":
      return <DayCard entry={{ ...entry, legs: [], title: L("Planlar", "Plans") }} leg={leg} card={card} settled={settled} />;
  }
}

/** One day: its transfers, then what's decided, then options still to pick from; an empty day says so. */
function DayCard({
  entry,
  leg,
  card,
  settled,
}: {
  entry: { title: string; items: Item[]; legs: Leg[] };
  leg: LegFor;
  card: CardFor;
  settled: SettledFor;
}) {
  const decided = entry.items.filter((i) => i.status === "chosen" || i.status === "booked");
  const open = entry.items.filter((i) => i.status === "saved");
  if (!entry.legs.length && !entry.items.length) {
    return (
      <div className="day-card empty">
        <span>{L("Boş gün", "Free day")}</span>
        <span className="muted">{L("Bir plan kaydet ya da sohbette söyle", "Save a plan or say it in the chat")}</span>
      </div>
    );
  }
  return (
    <div className="day-card">
      {entry.legs.map((l) => (
        <div key={l.key}>{leg(l)}</div>
      ))}
      {decided.map((i) => (
        <div key={i.id}>{settled(i)}</div>
      ))}
      {open.length > 0 && (
        <Carousel label={entry.title}>{open.map((i) => card(i, entry.items.filter((x) => x.category === i.category)))}</Carousel>
      )}
    </div>
  );
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

/** A stay said apart (in the chat, or added with "+") with options under it: the line saying so, and its × (spec 0.33 §1). */
function SlotNote({ slot }: { slot: Item }) {
  const env = useCardEnv();
  return (
    <p className="slot-note muted">
      <span>{L("Bu geceler ayrı konaklama (sohbette söyledin)", "These nights are a separate stay (you said so in the chat)")}</span>
      <DeleteX name={slot.name} onDelete={() => env.remove(slot)} />
    </p>
  );
}

const blockState = (block: StayBlock) => (block.kind === "open" && !block.groups.length ? "empty" : block.kind);

function Block({ block, skipped, tripId, renderGroup, settled }: { block: StayBlock; skipped: boolean; tripId: string; renderGroup: RenderGroup; settled: SettledFor }) {
  const env = useCardEnv();
  const state = blockState(block);
  const label = `${block.city ?? L("Konaklama", "Stay")} ${formatDateRange(block.range.start, block.range.end)}`;
  // "Gerek yok" (a night bus, friends' place): the nights stay on the line, quietly, and leave the to-dos.
  if (skipped && state === "empty") {
    return (
      <div className="stay-block skipped" id={`block-${block.range.start}`}>
        <div className="empty-card quiet">
          <span className="muted">
            {formatDateRange(block.range.start, block.range.end)} · {L(`${block.nights} gece · konaklama gerekmiyor`, `${block.nights} night${block.nights === 1 ? "" : "s"} · no stay needed`)}
          </span>
          <button className="link-btn" onClick={() => void setHidden(tripId, nightsKey(block.range), false, label)}>
            {L("Geri al", "Undo")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`stay-block ${state}`} id={`block-${block.range.start}`}>
      {block.kind === "booked" && settled(block.item)}
      {block.kind === "booked" && block.clashes?.map((i) => <div key={i.id}>{settled(i)}</div>)}
      {block.kind !== "booked" &&
        block.groups.map((g) =>
          renderGroup(g, null, g.range && g.range.start === block.range.start && g.range.end === block.range.end ? null : g.title, true),
        )}
      {block.kind === "open" && block.slot && block.groups.length > 0 && <SlotNote slot={block.slot} />}
      {block.kind === "chosen" && block.gap && block.gap.length > 0 && (
        <p className="slot-note gap">
          {L(
            `${block.gap.map((r) => `${formatDateRange(r.start, r.end)} (${nightsBetween(r.start, r.end)} gece)`).join(", ")} için yer seçilmedi: bu konaklama tek blok, seçtiğin yer yalnız bir kısmını kapsıyor.`,
            `No place chosen for ${block.gap
              .map((r) => {
                const k = nightsBetween(r.start, r.end);
                return `${formatDateRange(r.start, r.end)} (${k} night${k === 1 ? "" : "s"})`;
              })
              .join(", ")}: this stay is one block and the place you chose covers only part of it.`,
          )}
        </p>
      )}
      {block.kind === "open" && !block.groups.length && (
        <div className="settled-card st-open stay-open" data-item-id={block.slot?.id}>
          {/* ×: a stay said apart is deleted (its nights go back to the stay around them); empty nights are "Gerek yok". */}
          {block.slot ? (
            <DeleteX name={block.slot.name} className="stay-x" onDelete={() => env.remove(block.slot!)} />
          ) : (
            <DeleteX name={label} hide className="stay-x" onDelete={() => env.hideNights(block.range, label)} />
          )}
          <StatusBar standing="open" text={L("Planlanmadı", "Not planned")} sub={block.slot ? L("ayrı konaklama · otel seçilmedi", "separate stay · no hotel chosen") : L("bu geceler için kayıtlı yer yok", "nothing saved for these nights")} />
          <div className="empty-card">
            <span>
              <b>{block.city ?? L("Konaklama", "Stay")}</b>
              <span className="muted">
                {formatDateRange(block.range.start, block.range.end)} · {L(`${block.nights} gece`, `${block.nights} night${block.nights === 1 ? "" : "s"}`)}
              </span>
            </span>
            <span className="sc-actions">
              {!block.slot && (
                <button className="link-btn quiet" onClick={() => env.hideNights(block.range, label)} title={L("Bu geceler için yer gerekmiyor", "No place needed for these nights")}>
                  {L("Gerek yok", "Not needed")}
                </button>
              )}
              <a className="pill-btn outline" href={block.searchUrl} target="_blank" rel="noreferrer">
                {L("Booking'de ara ↗", "Search Booking ↗")}
              </a>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
