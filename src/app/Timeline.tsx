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
import { StatusBar, type Standing } from "./Status";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, roles?: string[], onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;

const fmt = (d: string) => formatDateRange(d, null);

export type TimelineMode = "plan" | "days";

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
  const parts = [n.booked && `${n.booked} rezerve`, n.chosen && `${n.chosen} seçildi`, n.open && `${n.open} açık`].filter(Boolean);
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  const render = { tripId, leg, renderGroup, card, settled, start, listings, today, rentals, onShow };
  return (
    <div className="section trip-plan">
      {mode === "plan" && (
        <>
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
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
  listings?: Map<string, Listing>;
  today: string;
  /** The trip's rented cars: their pick-up and return are lines on those days. */
  rentals: RentalEntry[];
  onShow: (entryKey: string) => void;
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
      </div>
    </li>
  );
}

const EVENT_LABELS: Partial<Record<Category, string>> = { activity: "Etkinlik", food: "Yemek", transport: "Ulaşım", other: "Plan" };
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
      lines = [entry.days ?? null, formatDateRange(b.range.start, b.range.end), `${b.nights} gece`];
      break;
    }
    case "event":
      title = EVENT_LABELS[entry.item.category] ?? "Plan";
      lines = [fmt(entry.date), entry.dayNo ? `${entry.dayNo}. gün` : null];
      break;
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
    case "event":
      return <>{settled(entry.item)}</>;
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

// --- the itinerary: day by day, small blocks -----------------------------------------------------------

const ROW_ICONS: Partial<Record<DayRow["kind"], Category>> = { leg: "transport", rental: "transport" };

/** Where a row's block lives on the plan's front (to open it there). */
function planKey(row: DayRow): string | null {
  if (row.entry) return row.entry.key;
  if (row.leg) return `leg:${row.leg.key}`;
  if (row.rental) return row.rental.key;
  if (row.item) return `event:${row.item.id}`;
  return row.stayKey;
}

function rowIcon(row: DayRow): Category {
  if (row.item) return row.item.category;
  if (row.entry?.kind === "travel") return iconOf(row.entry);
  return ROW_ICONS[row.kind] ?? "other";
}

/** What a small block says of where it stands, in a word or two. */
function rowStatus(row: DayRow): string {
  if (row.state === "decide") return row.status || "karar ver";
  if (row.state === "open") return row.kind === "leg" ? "planlanmadı" : row.status || "planlanmadı";
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
          return <ItDay key={section.key} id={entryDomId(`it:${j.key}`)} title={journeyTitle(j)} date={j.date} route={route} rows={rows} {...render} />;
        }
        if (section.kind === "travel") {
          // A trip on the line outside a day (a connection the day before).
          const rows = dayRows({ journey: { kind: "journey", key: section.key, journey: { key: section.key, role: "move", date: section.entry.date, dayNo: null, from: null, to: null, out: null, in: null }, entries: [section.entry] } });
          return <ItDay key={section.key} id={entryDomId(`it:${section.key}`)} title={fmt(section.entry.date)} date={section.entry.date} route={null} rows={rows} {...render} />;
        }
        const stays = section.stays.map((st) => st.block);
        return (
          <section key={section.key} className="it-city" aria-label={section.city ?? "Konaklama"}>
            <header className="it-city-head">
              <b>{section.city ?? "Konaklama"}</b>
              {section.range && <span className="muted num">{formatDateRange(section.range.start, section.range.end)}</span>}
              {stays.map((b) => (
                <button key={b.range.start} className={`it-stay st-${b.kind}`} onClick={() => render.onShow(`stay:${b.range.start}`)}>
                  <CategoryIcon category="stay" size={15} />
                  {b.kind === "open" ? (b.groups.length ? "konaklama · karar ver" : "konaklama · planlanmadı") : b.item.name}
                  {b.kind === "booked" && " ✓"}
                </button>
              ))}
            </header>
            {section.entries.map((e) => {
              if (e.kind === "day") {
                const rows = dayRows({ day: e, rentals: render.rentals, listings: render.listings });
                return <ItDay key={e.key} id={entryDomId(`it:${e.key}`)} title={e.title} date={e.date} route={null} rows={rows} {...render} />;
              }
              if (e.kind === "plan") {
                return (
                  <p key={e.key} className="it-note">
                    {e.items.map((i) => i.name).join(", ")} · gün belli değil
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

/** A day of the itinerary: its number, date and route, then what happens, hour by hour. */
function ItDay({ id, title, date, route, rows, ...render }: { id: string; title: string; date: string; route: string | null; rows: DayRow[] } & RenderProps) {
  const left = rowsLeft(rows);
  const [open, setOpen] = useState(true);
  if (!rows.length) {
    return (
      <div className="it-day empty" id={id}>
        <b>{title}</b>
        <span className="muted num">{`${fmt(date)} ${weekday(date)}`}</span>
        <span className="muted">boş gün</span>
      </div>
    );
  }
  return (
    <article className="it-day" id={id}>
      <button className="it-day-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{title}</b>
        <span className="muted num">{`${fmt(date)} ${weekday(date)}`}</span>
        {route && <span className="it-route">{route}</span>}
        {date === render.today && <span className="today-chip">Bugün</span>}
        {left > 0 && <span className="day-left">{left} iş</span>}
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
  if (row.kind === "info" || row.kind === "ideas" || (row.kind === "leg" && row.state === "info")) {
    const text =
      row.kind === "ideas" ? (
        <>
          <b>Fikirler</b>
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
      <li className="it-row info" data-it-key={itKey ?? undefined}>
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
