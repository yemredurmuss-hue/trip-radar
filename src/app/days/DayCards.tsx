// Günlük akış as cards (0.34.1, approved widget "günlük akış v4"). Closed: a card a day, the city's photo
// on the left and what happens as a short list (time · name · ✓ or what's left). Tapping it opens the
// day on its own page: the photo full height on the left and, in order, each thing as a small card
// (green booked, sand still to do, plain needs nothing); a card opens its details, and its card on the
// Plan holds every action. What needs no time (ideas) is listed under it.
import { useEffect, useRef, useState } from "react";
import { dayCards, endsOf, foldRows, ideaCount, isPlanRow, rowMark, type DayCard } from "../../lib/dayCards";
import { formatDateRange } from "../../lib/items";
import { L, locale } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { isRental } from "../../lib/legs";
import { insertAtDay, type InsertAt } from "../../lib/templates";
import type { RentalEntry, TimelineSection } from "../../lib/timeline";
import type { Listing } from "../../lib/types";
import { CategoryIcon, HeroIcon, type IconName } from "../Icons";
import type { LegFor } from "../Timeline";

export interface DayCardsProps {
  sections: TimelineSection[];
  leg: LegFor;
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  rentals: RentalEntry[];
  /** Shows a block of the plan (its card, with every action). */
  onShow: (entryKey: string) => void;
  /** The city's photo (the hero's), null when there's none yet. */
  cityImage?: (city: string | null) => string | null;
}

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
const dateText = (c: DayCard) => (c.end ? formatDateRange(c.date, c.end) : `${formatDateRange(c.date, null)} ${weekday(c.date)}`);
const time = (r: DayRow) => (r.time ? `${r.estimated ? "~" : ""}${r.time}` : "");

/** Where a row's card lives on the Plan (to open it there). */
function planKey(r: DayRow): string | null {
  if (r.entry) return r.entry.key;
  if (r.leg) return `leg:${r.leg.key}`;
  if (r.rental) return r.rental.key;
  if (r.item) return `event:${r.item.id}`;
  return r.stayKey;
}

function iconOf(r: DayRow): IconName {
  if (r.item) return isRental(r.item) ? "car" : r.item.category;
  if (r.rental) return "car";
  if (r.entry?.kind === "travel") {
    const mode = r.entry.travel?.mode ?? r.entry.leg?.mode;
    return mode && mode !== "flight" ? "transport" : "flight";
  }
  return r.kind === "leg" ? "transport" : "other";
}

const KIND_WORD: Partial<Record<IconName, () => string>> = {
  flight: () => L("Uçuş", "Flight"),
  transport: () => L("Ulaşım", "Transport"),
  car: () => L("Araç", "Car"),
  activity: () => L("Deneyim", "Experience"),
  food: () => L("Restoran", "Restaurant"),
  stay: () => L("Konaklama", "Stay"),
};

export function DayCards(props: DayCardsProps) {
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings });
  const [open, setOpen] = useState<{ key: string; row: string | null } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const day = open ? cards.find((c) => c.key === open.key) : null;
  useEffect(() => {
    if (open) top.current?.scrollIntoView({ block: "start" }); // at once: a tap right after lands where it aims
  }, [open?.key]);
  return (
    <div className="dc" ref={top}>
      {day ? (
        <DayPage card={day} focus={open?.row ?? null} onBack={() => setOpen(null)} {...props} />
      ) : (
        cards.map((c) => <ClosedDay key={c.key} card={c} onOpen={(row) => setOpen({ key: c.key, row })} {...props} />)
      )}
    </div>
  );
}

function Photo({ card, today, cityImage, full }: { card: DayCard; today: string; cityImage?: DayCardsProps["cityImage"]; full?: boolean }) {
  const src = cityImage?.(card.city) ?? null;
  const isToday = card.date === today || (!!card.end && card.date <= today && today <= card.end);
  return (
    <div className={`dc-photo${full ? " full" : ""}`}>
      {src && <img src={src} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
      {card.dayNo && <span className="dc-no">{card.dayNo}</span>}
      <span className={`dc-date${isToday ? " today" : ""}`}>
        {isToday ? `${L("Bugün", "Today")} · ` : ""}
        {dateText(card)}
      </span>
    </div>
  );
}

/** A closed day: photo, title, at most four lines, and how many ideas wait for it. */
function ClosedDay({ card, onOpen, ...props }: { card: DayCard; onOpen: (row: string | null) => void } & DayCardsProps) {
  const { shown, more } = foldRows(card.rows);
  const ideas = ideaCount(card.rows);
  const left = card.rows.filter((r) => isPlanRow(r) && r.state !== "done" && r.state !== "info").length;
  return (
    <article className="dc-day" role="button" tabIndex={0} onClick={() => onOpen(null)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(null))}>
      <Photo card={card} today={props.today} cityImage={props.cityImage} />
      <div className="dc-body">
        <div className="dc-head">
          <h3>{card.title}</h3>
          {left > 0 && <span className="dc-left">{L(`${left} iş`, `${left} to do`)}</span>}
        </div>
        {shown.length > 0 ? (
          <ul className="dc-lines">
            {shown.map((r) => {
              const mark = rowMark(r);
              return (
                <li
                  key={r.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.key);
                  }}
                >
                  <span className="t">{time(r)}</span>
                  <span className="n">{r.title}</span>
                  {mark && <span className={mark.done ? "ok" : "todo"}>{mark.text}</span>}
                </li>
              );
            })}
            {more.length > 0 && (
              <li className="more">
                <span className="t" />
                <span className="n">{L(`+${more.length} daha`, `+${more.length} more`)}</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
        )}
        <div className="dc-foot">
          {ideas > 0 && <span>{L(`${ideas} fikir`, `${ideas} idea${ideas === 1 ? "" : "s"}`)}</span>}
          <button
            className="dc-add"
            aria-label={L(`${formatDateRange(card.date, null)}: bu güne ekle`, `${formatDateRange(card.date, null)}: add to this day`)}
            onClick={(e) => {
              e.stopPropagation();
              props.onAdd(insertAtDay(card.date, card.city));
            }}
          >
            + {L("Bu güne ekle", "Add to this day")}
          </button>
        </div>
      </div>
    </article>
  );
}

/** The day on its own page: the photo full height, each thing a small card in order, ideas under them. */
function DayPage({ card, focus, onBack, ...props }: { card: DayCard; focus: string | null; onBack: () => void } & DayCardsProps) {
  const [sel, setSel] = useState<string | null>(focus);
  const ideas = card.rows.flatMap((r) => (r.kind === "ideas" ? r.items.map((i) => ({ name: i.name, sub: null as string | null })) : r.kind === "idea" ? [{ name: r.title, sub: r.sub }] : []));
  return (
    <div className="dc-page">
      <div className="dc-bar">
        <button className="dc-back" onClick={onBack}>
          ← {L("Tüm günler", "All days")}
        </button>
        <button className="dc-add" aria-label={L(`${formatDateRange(card.date, null)}: bu güne ekle`, `${formatDateRange(card.date, null)}: add to this day`)} onClick={() => props.onAdd(insertAtDay(card.date, card.city))}>
          + {L("Bu güne ekle", "Add to this day")}
        </button>
      </div>
      <div className="dc-grid">
        <Photo card={card} today={props.today} cityImage={props.cityImage} full />
        <div className="dc-flow">
          <h2>{card.title}</h2>
          {card.rows.filter((r) => r.kind !== "ideas" && r.kind !== "idea").length === 0 && <p className="dc-free">{L("Bu gün için henüz plan yok.", "Nothing planned for this day yet.")}</p>}
          {card.rows.map((r) => {
            if (r.kind === "ideas" || r.kind === "idea") return null;
            if (!isPlanRow(r))
              return (
                <div key={r.key} className="dc-info" data-title={r.line ?? r.title}>
                  <span className="t">{time(r)}</span>
                  <span>
                    <b>{r.line ?? r.title}</b>
                    {r.sub && ` · ${r.sub}`}
                  </span>
                </div>
              );
            return <FlowCard key={r.key} row={r} open={sel === r.key} onToggle={() => setSel(sel === r.key ? null : r.key)} {...props} />;
          })}
          {ideas.length > 0 && (
            <div className="dc-ideas">
              <small>{L("Diğer · saati yok", "Other · no time")}</small>
              <ul>
                {ideas.map((idea, n) => (
                  <li key={`${idea.name}-${n}`}>
                    {idea.name}
                    {idea.sub && <span className="muted"> · {idea.sub}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One thing on the day: its kind and where it stands on top, the two ends big for a trip ("Porto → Lizbon"),
 * else its name; a tap opens its details. A transfer with no plan yet is planned right here.
 */
function FlowCard({ row, open, onToggle, ...props }: { row: DayRow; open: boolean; onToggle: () => void } & DayCardsProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const icon = iconOf(row);
  const mark = rowMark(row);
  const tone = row.state === "done" ? "done" : row.state === "info" ? "plain" : "todo";
  const ends = endsOf(row.title);
  const key = planKey(row);
  const planHere = row.kind === "leg" && row.state === "open" && row.leg;
  return (
    <div className="dc-row" ref={ref}>
      <span className="t">{time(row)}</span>
      <div className={`dc-card ${tone}${open ? " open" : ""}`} data-kind={icon} data-title={row.title}>
        <button className="dc-card-face" aria-expanded={open} onClick={onToggle}>
          <span className="top">
            <CategoryIcon category={icon} size={16} />
            <span className="kind">{KIND_WORD[icon]?.() ?? L("Plan", "Plan")}</span>
            {mark && <span className={`st ${mark.done ? "ok" : "todo"}`}>{mark.done ? L("Alındı", "Booked") : row.status || mark.text}</span>}
          </span>
          {ends ? (
            <span className="ends">
              <b>{ends[0]}</b>
              <i aria-hidden>
                <CategoryIcon category={icon} size={18} />
              </i>
              <b>{ends[1]}</b>
            </span>
          ) : (
            <span className="name">{row.title}</span>
          )}
          {row.sub && <span className="sub">{row.sub}</span>}
        </button>
        {open && (
          <div className="dc-detail">
            {row.line && row.line !== row.title && <p>{row.line}</p>}
            {row.hint && <p className="muted">{row.hint}</p>}
            {!planHere && row.notes.map((n) => (
              <p key={n} className="muted">
                {n}
              </p>
            ))}
            {planHere && <div className="dc-leg">{props.leg(row.leg!, { embedded: true })}</div>}
            {key && (
              <button className="link-btn" onClick={() => props.onShow(key)}>
                {L("Plan'daki kartına git", "Open its card on the Plan")} <HeroIcon name="arrow" size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
