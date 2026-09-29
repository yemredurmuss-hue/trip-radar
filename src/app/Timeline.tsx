import { useState, type ReactNode } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange } from "../lib/items";
import { MODE_LABELS, modesFor, withLegChoice, type Leg } from "../lib/legs";
import type { OptionGroup, Plan, StayBlock } from "../lib/plan";
import { flightSearchUrl, type Timeline, type TimelineEntry, type TimelineSection } from "../lib/timeline";
import type { Category, Item, LegMode } from "../lib/types";
import { updateTrip } from "./actions";
import { Carousel } from "./Carousel";
import { CategoryIcon } from "./Icons";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, roles?: string[], onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;

const fmt = (d: string) => formatDateRange(d, null);
const dayNo = (start: string | null, d: string) => (start ? Math.round((Date.parse(d) - Date.parse(start)) / 864e5) + 1 : null);

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
}: {
  plan: Plan;
  timeline: Timeline;
  tripId: string;
  leg: (l: Leg) => ReactNode;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
}) {
  const start = plan.range?.start ?? null;
  const n = plan.nights;
  const parts = [n.booked && `${n.booked} rezerve`, n.chosen && `${n.chosen} seçildi`, n.open && `${n.open} açık`].filter(Boolean);
  const render = { tripId, leg, renderGroup, card, settled, start };
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
  leg: (l: Leg) => ReactNode;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
}

function Section({ section, ...render }: { section: TimelineSection } & RenderProps) {
  if (section.kind === "travel") {
    return (
      <ol className="timeline between">
        <Row entry={section.entry} {...render} />
      </ol>
    );
  }
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
        {section.entries.map((entry) => (
          <Row key={entry.key} entry={entry} {...render} />
        ))}
      </ol>
    </section>
  );
}

function Row({ entry, ...render }: { entry: TimelineEntry } & RenderProps) {
  return (
    <li className={`tl-entry tl-${entry.kind}`}>
      <div className="tl-side">
        <span className="tl-icon" aria-hidden>
          <CategoryIcon category={iconOf(entry)} size={20} />
        </span>
        <Label entry={entry} start={render.start} />
      </div>
      <div className="tl-content">
        <Entry entry={entry} {...render} />
      </div>
    </li>
  );
}

const LEG_LABELS = { arrival: "Transfer", departure: "Transfer", change: "Otel değişimi", move: "Şehir değişimi" } as const;
const TRAVEL_LABELS = { arrival: "Varış", move: "Şehir değişimi", departure: "Dönüş", other: "Ulaşım" } as const;
const DAY_WORDS: Partial<Record<Category, string>> = { activity: "Etkinlik", food: "Yeme-içme", other: "Plan", transport: "Araç kiralama" };

/** What and when, beside the line: "Konaklama · 1–4. gün · 8–11 Ekim · 3 gece". */
function Label({ entry, start }: { entry: TimelineEntry; start: string | null }) {
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
      const [from, to] = [dayNo(start, b.range.start), dayNo(start, b.range.end)];
      title = "Konaklama";
      lines = [from && to ? `${from}–${to}. gün` : null, formatDateRange(b.range.start, b.range.end), `${b.nights} gece`];
      break;
    }
    case "day":
      title = DAY_WORDS[entry.category] ?? "Plan";
      lines = [fmt(entry.date)];
      break;
  }
  return (
    <div className="tl-label">
      <b>{title}</b>
      {lines.filter(Boolean).map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

function iconOf(entry: TimelineEntry): Category {
  switch (entry.kind) {
    case "stay":
      return "stay";
    case "day":
      return entry.category;
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
      return <Block block={entry.block} renderGroup={renderGroup} settled={settled} />;
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
    case "day": {
      const decided = entry.items.filter((i) => i.status === "chosen" || i.status === "booked");
      const open = entry.items.filter((i) => i.status === "saved");
      return (
        <div className="tl-day">
          {decided.map((i) => (
            <div key={i.id}>{settled(i)}</div>
          ))}
          {open.length > 0 && <Carousel label={entry.title}>{open.map((i) => card(i, entry.items))}</Carousel>}
        </div>
      );
    }
  }
}

const MODE_ICONS: Record<LegMode, string> = { flight: "✈", train: "🚆", bus: "🚌", ferry: "⛴", metro: "🚇", taxi: "🚕", transfer: "🚐", car: "🚗", walk: "🚶" };
const TICKETED: LegMode[] = ["flight", "train", "bus", "ferry"];

/**
 * Getting from one city to the next when nothing's saved for it yet: "Porto → Madeira", and how the
 * traveller said they'll go. By plane it reads as a flight; its status is on it ("Planlanıyor · bilet
 * alınmadı"). A tap picks the way; saving a flight page for that day takes its place.
 */
function MoveCard({ leg, tripId }: { leg: Leg; tripId: string }) {
  const [open, setOpen] = useState(false);
  const mode = leg.choice?.mode ?? leg.mode;
  const booked = Boolean(leg.choice?.booked);
  const from = leg.from.city ?? leg.from.label;
  const to = leg.to.city ?? leg.to.label;
  const save = (patch: Parameters<typeof withLegChoice>[2]) => void updateTrip(tripId, (t) => withLegChoice(t, leg.key, patch));
  // "Flights from Porto to Madeira on …": the search's "home" end is simply where this move goes.
  const search = mode === "flight" ? flightSearchUrl("from", from, leg.date, to) : null;
  const state = booked
    ? { text: mode && TICKETED.includes(mode) ? "Bilet alındı ✓" : "Ayarlandı ✓", tone: "booked" }
    : mode
      ? { text: "Planlanıyor", tone: "chosen", sub: TICKETED.includes(mode) ? "bilet alınmadı" : null }
      : { text: "Boş", tone: "empty", sub: "nasıl geçeceksiniz?" };
  return (
    <div className={`settled-card move-card${booked ? " booked" : ""}`} aria-label={`${from} → ${to}`}>
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
        <span className="stc-state">
          <span className={`state-chip ${state.tone}`}>{state.text}</span>
          {"sub" in state && state.sub && <small className="muted">{state.sub}</small>}
        </span>
        <span className="stc-actions">
          {search && !booked && (
            <a className="pill-btn outline" href={search} target="_blank" rel="noreferrer">
              Uçuş ara ↗
            </a>
          )}
          {mode && (
            <button className="pill-btn outline" onClick={() => save({ booked: !booked })}>
              {booked ? "Geri al" : TICKETED.includes(mode) ? "Bileti aldım" : "Ayarlandı"}
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

function Block({ block, renderGroup, settled }: { block: StayBlock; renderGroup: RenderGroup; settled: SettledFor }) {
  const state = blockState(block);
  return (
    <div className={`stay-block ${state}`} id={`block-${block.range.start}`}>
      {block.kind === "booked" && settled(block.item)}
      {block.kind !== "booked" &&
        block.groups.map((g) =>
          renderGroup(g, null, g.range && g.range.start === block.range.start && g.range.end === block.range.end ? null : g.title, true),
        )}
      {block.kind === "open" && !block.groups.length && (
        <div className="empty-card">
          <span>
            <b>{block.city ?? "Konaklama"}</b>
            <span className="muted">Bu geceler için kayıtlı seçenek yok</span>
          </span>
          <a className="pill-btn outline" href={block.searchUrl} target="_blank" rel="noreferrer">
            Booking'de ara ↗
          </a>
        </div>
      )}
    </div>
  );
}
