import { useState, type ReactNode } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange } from "../lib/items";
import { isRental, MODE_LABELS, modesFor, withLegChoice, type Leg } from "../lib/legs";
import type { OptionGroup, Plan, StayBlock } from "../lib/plan";
import { dayRows, daySummary, journeyTitle, rowsLeft, type DayRow } from "../lib/journey";
import { entryDomId } from "../lib/progress";
import { flightSearchUrl, nightsKey, type RentalEntry, type Timeline, type TimelineEntry, type TimelineSection } from "../lib/timeline";
import type { Category, Item, LegMode, Listing } from "../lib/types";
import { setHidden, updateTrip } from "./actions";
import { Carousel } from "./Carousel";
import { CategoryIcon } from "./Icons";
import { show } from "./Progress";
import { StatusBar, type Standing } from "./Status";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, roles?: string[], onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;

const fmt = (d: string) => formatDateRange(d, null);

/**
 * The trip as it happens: a block for each city (its transfers, nights, days, a rented car), and on the
 * line between them how you get there, from the way in to the way home. Undecided needs are cards to
 * swipe through; decided ones one calm card with where they stand.
 */
export function TimelineView({
  plan,
  timeline,
  tripId,
  leg,
  renderGroup,
  card,
  settled,
  listings,
  today,
}: {
  plan: Plan;
  timeline: Timeline;
  tripId: string;
  leg: LegFor;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
  listings?: Map<string, Listing>;
  today: string;
}) {
  const start = plan.range?.start ?? null;
  const n = plan.nights;
  const parts = [n.booked && `${n.booked} rezerve`, n.chosen && `${n.chosen} seçildi`, n.open && `${n.open} açık`].filter(Boolean);
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  const render = { tripId, leg, renderGroup, card, settled, start, listings, today, rentals };
  return (
    <div className="section trip-plan">
      <div className="section-head">
        <span>Gezi planı</span>
        {n.total > 0 && <span className="muted">{[`${n.total} gece`, ...parts].join(" · ")}</span>}
      </div>
      {plan.notices.map((x) => (
        <div key={x.text} className="notice">
          ⚠ {x.text}
        </div>
      ))}
      <div className="trip-line">
        {timeline.sections.map((section) => (
          <Section key={section.key} section={section} {...render} />
        ))}
      </div>
    </div>
  );
}

interface RenderProps {
  tripId: string;
  start: string | null;
  leg: LegFor;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
  listings?: Map<string, Listing>;
  today: string;
  /** The trip's rented cars: their pick-up and return are lines on those days. */
  rentals: RentalEntry[];
}

function Section({ section, ...render }: { section: TimelineSection } & RenderProps) {
  if (section.kind === "travel") {
    return (
      <ol className="timeline between">
        <Row entry={section.entry} {...render} />
      </ol>
    );
  }
  if (section.kind === "journey") return <JourneyCard section={section} {...render} />;
  const range = section.range;
  return (
    <section className="city-block" aria-label={section.city ?? "Konaklama"}>
      <header className="city-head">
        <span className="city-no">{section.index}</span>
        <b>{section.city ?? "Konaklama"}</b>
        {range && (
          <span className="muted">
            {formatDateRange(range.start, range.end)} · {section.nights} gece
          </span>
        )}
      </header>
      <ol className="timeline">
        {section.stays.map((entry) => (
          <Row key={entry.key} entry={entry} {...render} />
        ))}
        {section.entries
          .filter((entry) => entry.kind !== "rental") // a rented car is a card of the day it starts
          .map((entry) => (
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
  if (entry.kind === "day") return <DayEntry entry={entry} {...render} />;
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
      </div>
    </li>
  );
}

const LEG_LABELS = { arrival: "Transfer", departure: "Transfer", change: "Otel değişimi", move: "Şehir değişimi" } as const;
const TRAVEL_LABELS = { arrival: "Varış", move: "Şehir değişimi", departure: "Dönüş", other: "Ulaşım" } as const;

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("tr-TR", { weekday: "short", timeZone: "UTC" });

/** What and when, beside the line: "Konaklama · 8–11 Ekim · 3 gece", "5. gün · 11 Ekim Cmt". */
function Label({ entry, today }: { entry: TimelineEntry; today: string }) {
  let title: string;
  let lines: (string | null)[];
  switch (entry.kind) {
    case "travel":
      title = entry.role === "other" ? entry.title.split(" · ").at(-1)! : TRAVEL_LABELS[entry.role];
      lines = [fmt(entry.date)];
      break;
    case "leg":
      title = LEG_LABELS[entry.leg.kind];
      lines = [fmt(entry.date)];
      break;
    case "stay": {
      const b = entry.block;
      title = "Konaklama";
      lines = [formatDateRange(b.range.start, b.range.end), `${b.nights} gece`];
      break;
    }
    case "day":
      title = entry.title;
      lines = [`${fmt(entry.date)} ${weekday(entry.date)}`];
      break;
    case "plan":
      title = entry.items.every(isRental) ? "Araç kiralama" : "Planlar";
      lines = ["gün belli değil"];
      break;
    case "rental":
      title = "Araç kiralama";
      lines = [formatDateRange(entry.date, entry.end)];
      break;
  }
  return (
    <div className="tl-label">
      <b>{title}</b>
      {lines.filter(Boolean).map((l) => (
        <span key={l}>{l}</span>
      ))}
      {entry.kind === "day" && entry.date === today && <span className="today-chip">Bugün</span>}
    </div>
  );
}

function iconOf(entry: TimelineEntry): Category {
  switch (entry.kind) {
    case "stay":
      return "stay";
    case "plan":
      return entry.items.every(isRental) ? "transport" : "activity";
    case "travel": {
      const mode = entry.travel?.mode ?? entry.leg?.mode;
      return mode && mode !== "flight" ? "transport" : entry.role === "move" && !mode ? "transport" : "flight";
    }
    default:
      return "transport";
  }
}

function Entry({ entry, tripId, leg, renderGroup, card, settled }: { entry: TimelineEntry } & RenderProps) {
  switch (entry.kind) {
    case "leg":
      return <>{leg(entry.leg)}</>;
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
            <MoveCard leg={entry.leg} tripId={tripId} />
          ) : (
            <div className="empty-card">
              <span>
                <b>{entry.subtitle ?? "Ulaşım"}</b>
                <span className="muted">Henüz eklenmedi · sohbette "7 Ekim'de uçuşumuz var" demen yeter</span>
              </span>
              {entry.searchUrl && (
                <a className="pill-btn outline" href={entry.searchUrl} target="_blank" rel="noreferrer">
                  Uçuş ara ↗
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
    case "plan":
      return <DayCard entry={{ ...entry, legs: [], title: "Planlar" }} leg={leg} card={card} settled={settled} />;
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
        <span>Boş gün</span>
        <span className="muted">Bir plan kaydet ya da sohbette söyle</span>
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

/** "4. gün · 11 Ekim Paz", today marked, how much is left; a tap folds or opens the day. */
function DayToggle({ title, date, today, left, open, onToggle }: { title: string; date: string; today: string; left: number; open: boolean; onToggle: () => void }) {
  return (
    <button className="tl-label day-toggle" aria-expanded={open} onClick={onToggle}>
      <span className="day-title">
        <b>{title}</b>
        <span className="day-chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </span>
      <span>{`${fmt(date)} ${weekday(date)}`}</span>
      {date === today && <span className="today-chip">Bugün</span>}
      {left > 0 && <span className="day-left">{left} iş</span>}
    </button>
  );
}

/**
 * One day of a city: its time on the left and, in order, what happens. Open while something is left
 * to book or pick; folded into one line once it's all set (a tap opens it again).
 */
function DayEntry({ entry, ...render }: { entry: Extract<TimelineEntry, { kind: "day" }> } & RenderProps) {
  const rows = dayRows({ day: entry, rentals: render.rentals, listings: render.listings });
  const left = rowsLeft(rows);
  const [open, setOpen] = useState(left > 0);
  const empty = rows.length === 0;
  return (
    <li id={entryDomId(entry.key)} className={`tl-entry tl-day${open && !empty ? " open" : ""}`}>
      <div className="tl-side">
        <span className="tl-icon" aria-hidden>
          <b className="tl-day-no">{entry.dayNo}</b>
        </span>
        {empty ? (
          <Label entry={entry} today={render.today} />
        ) : (
          <DayToggle title={entry.title} date={entry.date} today={render.today} left={left} open={open} onToggle={() => setOpen(!open)} />
        )}
      </div>
      <div className="tl-content">
        {empty ? (
          <div className="day-card empty">
            <span>Boş gün</span>
            <span className="muted">Bir plan kaydet ya da sohbette söyle</span>
          </div>
        ) : (
          !open && (
            <button className="day-summary" onClick={() => setOpen(true)}>
              {daySummary(rows)}
            </button>
          )
        )}
      </div>
      {/* The rows use the whole entry: times on the trip's line, cards in line with every other card. */}
      {open && !empty && <DayRows rows={rows} {...render} />}
    </li>
  );
}

/**
 * A day on the move, on the line between the cities: "4. gün · Porto → Madeira", then its rows —
 * check-out, the transfer, the flight, the transfer, check-in — like any other day.
 */
function JourneyCard({ section, ...render }: { section: Extract<TimelineSection, { kind: "journey" }> } & RenderProps) {
  const j = section.journey;
  const rows = dayRows({ journey: section, rentals: render.rentals, listings: render.listings });
  const left = rowsLeft(rows);
  const [open, setOpen] = useState(left > 0);
  const route = j.from && j.to ? `${j.from} → ${j.to}` : j.to ? `→ ${j.to}` : j.from ? `${j.from} →` : "Yolculuk";
  // Flights to pick from get the whole width, side by side.
  const wide = open && rows.some((r) => r.state === "decide" && r.entry?.kind === "travel" && (r.entry.travel?.items.length ?? 0) >= 2);
  return (
    <ol className="timeline between">
      <li id={entryDomId(j.key)} className={`tl-entry tl-journey${wide ? " tl-wide" : ""}${open ? " open" : ""}`}>
        <div className="tl-side">
          <span className="tl-icon" aria-hidden>
            {j.dayNo ? <b className="tl-day-no">{j.dayNo}</b> : <CategoryIcon category="flight" size={20} />}
          </span>
          <DayToggle title={journeyTitle(j)} date={j.date} today={render.today} left={left} open={open} onToggle={() => setOpen(!open)} />
        </div>
        <div className="tl-content">
          <p className="journey-head">{route}</p>
          {!open && (
            <button className="day-summary" onClick={() => setOpen(true)}>
              {daySummary(rows)}
            </button>
          )}
        </div>
        {open && <DayRows rows={rows} {...render} />}
      </li>
    </ol>
  );
}

function DayRows({ rows, ...render }: { rows: DayRow[] } & RenderProps) {
  return (
    <ol className="day-rows">
      {rows.map((r) => (
        <DayRowView key={r.key} row={r} {...render} />
      ))}
    </ol>
  );
}

/** The card behind a row: the flight to pick or mark bought, the transfer, the tour to book. */
function fullCard(row: DayRow, render: RenderProps, embedded: boolean): ReactNode {
  if (row.kind === "leg" && row.leg) return render.leg(row.leg, { embedded });
  if (row.kind === "item" && row.item) return render.settled(row.item);
  if (row.kind === "travel" && row.entry?.kind === "travel") {
    const e = row.entry;
    if (!e.travel && e.role === "move" && e.leg) return <MoveCard leg={e.leg} tripId={render.tripId} startOpen={embedded} />;
    return <Entry entry={e} {...render} />;
  }
  return null;
}

/**
 * A row of a day. A reservation (a flight, a taxi, a tour, a car) is its card, booked or not;
 * information (check-in, the metro to the airport, the car going back) is a line.
 */
function DayRowView({ row, ...render }: { row: DayRow } & RenderProps) {
  const [open, setOpen] = useState(false);
  // A line starts with its time; a card carries its own.
  const time = row.time ? <span className={`dr-time${row.estimated ? " est" : ""}`}>{`${row.estimated ? "~" : ""}${row.time}`}</span> : null;
  let body: ReactNode;
  if (row.kind === "leg" && row.state === "info" && row.leg) {
    // Metro, a walk: how they'll go, in a line; a tap to change it.
    body = (
      <>
        <button className="dr-info" aria-expanded={open} onClick={() => setOpen(!open)}>
          {time}
          <b>{row.line ?? row.title}</b>
          <span>{row.title}</span>
        </button>
        {open && <div className="dr-more">{render.leg(row.leg, { embedded: true, timed: true })}</div>}
      </>
    );
  } else if (row.kind === "info") {
    const text = (
      <>
        {time}
        <b>{row.title}</b>
        {row.sub && <span>{row.sub}</span>}
      </>
    );
    body = row.stayKey ? (
      <button className="dr-info" onClick={() => show(document.getElementById(entryDomId(row.stayKey!)))}>
        {text}
      </button>
    ) : (
      <p className="dr-info">{text}</p>
    );
  } else if (row.kind === "ideas") {
    body = <Carousel label="Fikirler">{row.items.map((i) => render.card(i, row.items.filter((x) => x.category === i.category)))}</Carousel>;
  } else if (row.kind === "rental" && row.rental) {
    body = <div className="tl-rental">{render.renderGroup(row.rental.group, null, null, true)}</div>;
  } else {
    body = fullCard(row, render, false);
  }
  const id = row.entry ? entryDomId(row.entry.key) : row.rental ? entryDomId(row.rental.key) : undefined;
  return (
    <li id={id} className={`dr k-${row.kind} st-${row.state}`} data-title={row.title}>
      <span className="dr-pin" aria-hidden />
      <div className="dr-body">{body}</div>
    </li>
  );
}

const MODE_ICONS: Record<LegMode, string> = { flight: "✈", train: "🚆", bus: "🚌", ferry: "⛴", metro: "🚇", taxi: "🚕", transfer: "🚐", car: "🚗", walk: "🚶" };
const TICKETED: LegMode[] = ["flight", "train", "bus", "ferry"];

/**
 * Getting from one city to the next when nothing's saved for it yet: "Porto → Madeira", and how the
 * traveller said they'll go. By plane it reads as a flight; its status is on it ("Planlanıyor · bilet
 * alınmadı"). A tap picks the way; saving a flight page for that day takes its place.
 */
function MoveCard({ leg, tripId, startOpen = false }: { leg: Leg; tripId: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const mode = leg.choice?.mode ?? leg.mode;
  const booked = Boolean(leg.choice?.booked);
  const from = leg.from.city ?? leg.from.label;
  const to = leg.to.city ?? leg.to.label;
  const save = (patch: Parameters<typeof withLegChoice>[2]) => void updateTrip(tripId, (t) => withLegChoice(t, leg.key, patch));
  // "Flights from Porto to Madeira on …": the search's "home" end is simply where this move goes.
  const search = mode === "flight" ? flightSearchUrl("from", from, leg.date, to) : null;
  const standing: Standing = booked ? "booked" : mode ? "planned" : "open";
  const state = booked
    ? { text: mode && TICKETED.includes(mode) ? "Bilet alındı" : "Ayarlandı", sub: null }
    : mode
      ? { text: "Planlanıyor", sub: TICKETED.includes(mode) ? "bilet alınmadı" : null }
      : { text: "Planlanmadı", sub: "nasıl geçeceksiniz?" };
  return (
    <div className={`settled-card move-card st-${standing}`} aria-label={`${from} → ${to}`}>
      <StatusBar standing={standing} text={state.text} sub={state.sub} />
      <div className="stc-main" role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(!open))}>
        <div className="route">
          <div className="route-line">
            <div className="route-end">
              <b className={from.length > 5 ? "long" : ""}>{from}</b>
              <span className="muted">{fmt(leg.date)}</span>
            </div>
            <div className="route-mid">
              <span>{mode ? MODE_LABELS[mode] : ""}</span>
              <span className="route-bar">
                <span className="route-mode">{mode ? MODE_ICONS[mode] : "?"}</span>
              </span>
              <span className="muted">{leg.options.length ? `${leg.options.length} seçenek` : ""}</span>
            </div>
            <div className="route-end right">
              <b className={to.length > 5 ? "long" : ""}>{to}</b>
              <span className="muted">{fmt(leg.date)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="stc-foot">
        <span className="stc-actions">
          {search && !booked && (
            <a className="pill-btn outline" href={search} target="_blank" rel="noreferrer">
              Uçuş ara ↗
            </a>
          )}
          {(mode || booked) && (
            <button className="pill-btn outline" onClick={() => save({ booked: !booked })}>
              {booked ? "Geri al" : mode && TICKETED.includes(mode) ? "Bileti aldım" : "Ayarlandı"}
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="stc-details">
          <div className="leg-modes" role="group" aria-label="Nasıl geçeceksiniz?">
            {modesFor("move").map((m) => (
              <button key={m} className={`mode-chip${mode === m ? " on" : ""}`} aria-pressed={mode === m} onClick={() => save(mode === m ? { mode: null } : { mode: m })}>
                {MODE_ICONS[m]} {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="muted small-note">Sohbette "11 Ekim'de Madeira'ya uçakla geçeceğiz" demen de yeter; o günün uçuş sayfasını kaydedince onun yerine geçer.</p>
        </div>
      )}
    </div>
  );
}

const blockState = (block: StayBlock) => (block.kind === "open" && !block.groups.length ? "empty" : block.kind);

function Block({ block, skipped, tripId, renderGroup, settled }: { block: StayBlock; skipped: boolean; tripId: string; renderGroup: RenderGroup; settled: SettledFor }) {
  const state = blockState(block);
  const label = `${block.city ?? "Konaklama"} ${formatDateRange(block.range.start, block.range.end)}`;
  // "Gerek yok" (a night bus, friends' place): the nights stay on the line, quietly, and leave the to-dos.
  if (skipped && state === "empty") {
    return (
      <div className="stay-block skipped" id={`block-${block.range.start}`}>
        <div className="empty-card quiet">
          <span className="muted">
            {formatDateRange(block.range.start, block.range.end)} · {block.nights} gece · konaklama gerekmiyor
          </span>
          <button className="link-btn" onClick={() => void setHidden(tripId, nightsKey(block.range), false, label)}>
            Geri al
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
      {block.kind === "open" && !block.groups.length && (
        <div className="settled-card st-open stay-open">
          <StatusBar standing="open" text="Planlanmadı" sub="bu geceler için kayıtlı yer yok" />
          <div className="empty-card">
            <span>
              <b>{block.city ?? "Konaklama"}</b>
              <span className="muted">
                {formatDateRange(block.range.start, block.range.end)} · {block.nights} gece
              </span>
            </span>
            <span className="sc-actions">
              <button className="link-btn quiet" onClick={() => void setHidden(tripId, nightsKey(block.range), true, label)} title="Bu geceler için yer gerekmiyor">
                Gerek yok
              </button>
              <a className="pill-btn outline" href={block.searchUrl} target="_blank" rel="noreferrer">
                Booking'de ara ↗
              </a>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
