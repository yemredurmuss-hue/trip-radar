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
 * The trip in the order it happens, on one line down the side: getting there, each stretch of nights
 * (with the transfers between them), what's on each day, and getting home. Undecided needs show as
 * cards to swipe through; decided ones as one line.
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
        {timeline.entries.map((entry) => (
          <li key={entry.key} className={`tl-entry tl-${entry.kind}`}>
            <span className={`tl-icon${entry.kind === "leg" ? " dot" : ""}`} aria-hidden>
              {entry.kind !== "leg" && <CategoryIcon category={iconOf(entry)} size={20} />}
            </span>
            <div className="tl-content">
              <Entry entry={entry} leg={leg} renderGroup={renderGroup} card={card} settled={settled} />
            </div>
          </li>
        ))}
      </ol>
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
          <Head title={entry.title} subtitle={entry.subtitle} />
          {entry.leg && leg(entry.leg)}
          {entry.travel ? (
            renderGroup({ ...entry.travel.group, items: entry.travel.items }, null, null, true)
          ) : entry.role !== "move" ? (
            <div className="empty-slot">
              Henüz eklenmedi.{" "}
              {entry.searchUrl && (
                <a href={entry.searchUrl} target="_blank" rel="noreferrer">
                  Uçuş ara ↗
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
          <Head title={entry.title} subtitle={null} />
          {decided.map((i) => (
            <div key={i.id}>{settled(i)}</div>
          ))}
          {open.length > 0 && <Carousel label={entry.title}>{open.map((i) => card(i, entry.items))}</Carousel>}
        </div>
      );
    }
  }
}

function Head({ title, subtitle }: { title: string; subtitle: string | null }) {
  return (
    <div className="tl-head">
      <b>{title}</b>
      {subtitle && <span className="muted">{subtitle}</span>}
    </div>
  );
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
      <div className="block-head">
        <span className="block-date">
          <span className="block-range">{formatDateRange(block.range.start, block.range.end)}</span>
          <span className="block-days">
            {weekday(block.range.start)} – {weekday(block.range.end)} · {block.nights} gece
            {block.city && ` · ${block.city}`}
          </span>
        </span>
        <span className={`block-chip ${state}`}>{BLOCK_LABEL[state]}</span>
      </div>
      {block.kind === "booked" && settled(block.item)}
      {block.kind !== "booked" &&
        block.groups.map((g) =>
          renderGroup(g, null, g.range && g.range.start === block.range.start && g.range.end === block.range.end ? null : g.title, true),
        )}
      {block.kind === "open" && !block.groups.length && (
        <div className="empty-slot">
          Bu geceler için kayıtlı seçenek yok.{" "}
          <a href={block.searchUrl} target="_blank" rel="noreferrer">
            Booking'de bu tarihlerle ara ↗
          </a>
        </div>
      )}
    </div>
  );
}
