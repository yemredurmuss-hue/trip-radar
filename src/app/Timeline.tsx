import type { ReactNode } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange } from "../lib/items";
import type { Leg } from "../lib/legs";
import type { OptionGroup, Plan, StayBlock } from "../lib/plan";
import type { Timeline, TimelineEntry } from "../lib/timeline";
import type { Category, Item } from "../lib/types";
import { Carousel } from "./Carousel";
import { CategoryIcon } from "./Icons";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, roles?: string[], onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
export const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * The trip in the order it happens, down one line: getting there, each stretch of nights (with the
 * transfers between them), what's on each day, and getting home. On the left what and when, on the
 * right the thing itself: undecided needs as cards to swipe through, decided ones as one calm card.
 */
export function TimelineView({
  plan,
  timeline,
  leg,
  renderGroup,
  card,
  settled,
}: {
  plan: Plan;
  timeline: Timeline;
  leg: (l: Leg) => ReactNode;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
}) {
  const n = plan.nights;
  const parts = [n.booked && `${n.booked} rezerve`, n.chosen && `${n.chosen} seçildi`, n.open && `${n.open} açık`].filter(Boolean);
  const start = plan.range?.start ?? null;
  // A numbered pill where each city begins: before the way in, and after each move.
  const cities = plan.stayBlocks.map((b) => b.city).filter((c, i, all): c is string => Boolean(c) && all.indexOf(c) === i);
  let city = 0;
  const pill = (name: string | null | undefined) =>
    name ? (
      <li key={`pill:${name}:${city}`} className="tl-pill" aria-hidden>
        <span>
          <b>{++city}</b>
          {name}
        </span>
      </li>
    ) : null;
  return (
    <div className="section">
      <div className="section-head">
        <span>Gezi planı</span>
        {n.total > 0 && <span className="muted">{[`${n.total} gece`, ...parts].join(" · ")}</span>}
      </div>
      <DayStrip blocks={plan.stayBlocks} />
      {plan.notices.map((x) => (
        <div key={x.text} className="notice">
          ⚠ {x.text}
        </div>
      ))}
      <ol className="timeline">
        {timeline.entries.flatMap((entry, i) => {
          const rows: ReactNode[] = [];
          if (i === 0) rows.push(pill(cities[0]));
          rows.push(
            <li key={entry.key} className={`tl-entry tl-${entry.kind}`}>
              <div className="tl-side">
                <span className="tl-icon" aria-hidden>
                  <CategoryIcon category={iconOf(entry)} size={20} />
                </span>
                <Label entry={entry} start={start} />
              </div>
              <div className="tl-content">
                <Entry entry={entry} leg={leg} renderGroup={renderGroup} card={card} settled={settled} />
              </div>
            </li>,
          );
          if (entry.kind === "travel" && entry.role === "move") rows.push(pill(entry.leg?.to.city));
          return rows;
        })}
      </ol>
    </div>
  );
}

const LEG_LABELS = { arrival: "Transfer", departure: "Transfer", change: "Otel değişimi", move: "Şehir değişimi" } as const;
const TRAVEL_LABELS = { arrival: "Varış", move: "Şehir değişimi", departure: "Dönüş" } as const;
const DAY_WORDS: Partial<Record<Category, string>> = { activity: "Etkinlik", food: "Yeme-içme", other: "Plan" };
const fmt = (d: string) => formatDateRange(d, null);
const dayNo = (start: string | null, d: string) => (start ? Math.round((Date.parse(d) - Date.parse(start)) / 864e5) + 1 : null);

/** What and when, beside the line: "Konaklama · 1–4. gün · 8–11 Ekim · 3 gece". */
function Label({ entry, start }: { entry: TimelineEntry; start: string | null }) {
  let title: string;
  let lines: (string | null)[];
  switch (entry.kind) {
    case "travel":
      title = TRAVEL_LABELS[entry.role];
      lines = [fmt(entry.date), entry.subtitle];
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
      {entry.kind === "stay" && <span className={`block-chip ${blockState(entry.block)}`}>{BLOCK_LABEL[blockState(entry.block)]}</span>}
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

function Entry({
  entry,
  leg,
  renderGroup,
  card,
  settled,
}: {
  entry: TimelineEntry;
  leg: (l: Leg) => ReactNode;
  renderGroup: RenderGroup;
  card: CardFor;
  settled: SettledFor;
}) {
  switch (entry.kind) {
    case "leg":
      return <>{leg(entry.leg)}</>;
    case "stay":
      return <Block block={entry.block} renderGroup={renderGroup} settled={settled} />;
    case "travel":
      return (
        <div className={`tl-travel role-${entry.role}`}>
          {entry.leg && leg(entry.leg)}
          {entry.travel ? (
            renderGroup({ ...entry.travel.group, items: entry.travel.items }, null, null, true)
          ) : entry.role !== "move" ? (
            <div className="empty-card">
              <span>
                <b>{entry.subtitle ?? "Ulaşım"}</b>
                <span className="muted">Henüz eklenmedi</span>
              </span>
              {entry.searchUrl && (
                <a className="pill-btn outline" href={entry.searchUrl} target="_blank" rel="noreferrer">
                  + Uçuş ara ↗
                </a>
              )}
            </div>
          ) : null}
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

const BLOCK_LABEL = { booked: "✓ Rezerve", chosen: "Seçildi", open: "Açık", empty: "Boş" } as const;

const blockState = (block: StayBlock) => (block.kind === "open" && !block.groups.length ? "empty" : block.kind);

/** The trip's nights at a glance, one cell per night, coloured by whether it's booked, chosen or open. */
export function DayStrip({ blocks }: { blocks: StayBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="day-strip" role="list" aria-label="Geceler">
      {blocks.map((block) => {
        const state = blockState(block);
        const nights = Array.from({ length: block.nights }, (_, i) => addDay(block.range.start, i));
        return (
          <button
            key={block.range.start}
            role="listitem"
            className={`strip-block ${state}`}
            style={{ flexGrow: block.nights }}
            title={`${formatDateRange(block.range.start, block.range.end)} · ${block.nights} gece · ${BLOCK_LABEL[state]}`}
            onClick={() => document.getElementById(`block-${block.range.start}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span className="strip-days">
              {nights.map((d) => (
                <span key={d} className="strip-day">
                  <b>{dayOfMonth(d)}</b>
                  <small>{weekday(d)}</small>
                </span>
              ))}
            </span>
            <span className="strip-label">
              {block.city ? `${block.city} · ` : ""}
              {BLOCK_LABEL[state]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
