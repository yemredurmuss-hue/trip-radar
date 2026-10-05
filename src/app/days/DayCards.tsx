// Günlük akış as cards (0.34.7): a card a day. Closed, the day's photo beside the whole day as a list, nothing
// folded: time · dot · the Plan's icon in its colour (✓ booked, an amber dot still to do) · name; check-in,
// check-out and the transfers the plan works out are lines of it. Open, the same lines in the same order, each
// as its own card on the Plan (the flight, the taxi to it with its "how", the tour): the Plan, day by day.
import { useEffect, useState, type ReactNode } from "react";
import { cardKindColor, cardKindLabel, RENTAL_MODES, TRANSPORT_MODES, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { imageProxy } from "../../lib/cityImages";
import { dayCards, dayPhoto, flowRows, highlightOf, ideaCount, isPlanRow, rowKind, rowMark, type DayCard } from "../../lib/dayCards";
import { formatDateRange } from "../../lib/items";
import { L, locale } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { insertAtDay, type InsertAt } from "../../lib/templates";
import type { RentalEntry, StayEntry, TimelineSection } from "../../lib/timeline";
import type { Listing } from "../../lib/types";
import { KindIcon, MediaSilhouette, TransportArt } from "../cards/Silhouettes";
import { PlanEntry } from "../plan/PlanEntry";
import type { LegCardFor, LegFor, RenderGroup, SettledFor } from "../Timeline";

/** The Plan's own cards, so an open day shows each thing as the Plan does. */
export interface DayPlanCards {
  legCard: LegCardFor;
  renderGroup: RenderGroup;
  settled: SettledFor;
}

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
  cards: DayPlanCards;
}

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
const dateText = (c: DayCard) => (c.end ? formatDateRange(c.date, c.end) : `${formatDateRange(c.date, null)} ${weekday(c.date)}`);
const time = (r: DayRow) => (r.time ? `${r.estimated ? "~" : ""}${r.time}` : "");
const isTransport = (k: CardKind): k is TransportMode => (TRANSPORT_MODES as readonly string[]).includes(k) && !RENTAL_MODES.includes(k as TransportMode);

type Mode = "list" | "cards";
const MODE_KEY = "trip-radar:days-mode";
const readMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === "cards" ? "cards" : "list";
  } catch {
    return "list";
  }
};

/**
 * One switch for the whole view, no day opens or closes on its own: Liste (each day's photo beside its whole
 * day) or Kartlar (every day as the Plan's cards, its header held at the top while it scrolls past). A line
 * in the list switches to the cards at that line; the strip of days jumps to a day in either.
 */
export function DayCards(props: DayCardsProps) {
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings });
  // The stays by their nights' first day: on that day the check-in line opens to the stay's own card.
  const stays = new Map<string, StayEntry>(props.sections.flatMap((s) => (s.kind === "city" ? s.stays.map((st) => [st.key, st] as [string, StayEntry]) : [])));
  const [mode, setModeState] = useState<Mode>(readMode);
  const [target, setTarget] = useState<{ id: string; flash: boolean } | null>(null);
  const setMode = (m: Mode, at: { id: string; flash: boolean } | null = null) => {
    setModeState(m);
    setTarget(at);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // a per-viewer convenience: without storage it starts on the list
    }
  };
  // After a switch or a jump: the line or the day asked for, in view (and the line marked a moment).
  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(target.id);
    el?.scrollIntoView({ block: target.flash ? "center" : "start" });
    if (!target.flash || !el) return;
    el.classList.add("dc-flash");
    const t = setTimeout(() => el.classList.remove("dc-flash"), 1600);
    return () => clearTimeout(t);
  }, [target, mode]);
  const isToday = (c: DayCard) => c.date === props.today || (!!c.end && c.date <= props.today && props.today <= c.end);
  return (
    <div className="dc">
      <div className="dc-bar">
        <div className="dc-seg" role="tablist" aria-label={L("Görünüm", "View")}>
          <button role="tab" aria-selected={mode === "list"} className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>
            {L("Liste", "List")}
          </button>
          <button role="tab" aria-selected={mode === "cards"} className={mode === "cards" ? "on" : ""} onClick={() => setMode("cards")}>
            {L("Kartlar", "Cards")}
          </button>
        </div>
        <nav className="dc-strip" aria-label={L("Günler", "Days")}>
          {cards.map((c) => (
            <button key={c.key} className={isToday(c) ? "today" : ""} title={c.title} onClick={() => setTarget({ id: `dcd-${mode}-${c.key}`, flash: false })}>
              {(c.dayNo ?? formatDateRange(c.date, null)).replace(/\.? ?gün$|^Days? /, "")}
            </button>
          ))}
        </nav>
      </div>
      {mode === "list"
        ? cards.map((c) => <ListDay key={c.key} card={c} isToday={isToday(c)} onPick={(row) => setMode("cards", row ? { id: `dc-${row}`, flash: true } : { id: `dcd-cards-${c.key}`, flash: false })} {...props} />)
        : cards.map((c) => <CardsDay key={c.key} card={c} isToday={isToday(c)} stays={stays} {...props} />)}
    </div>
  );
}

// --- the day's photo ------------------------------------------------------------------------------

const PHOTO_CACHE = "trip-radar:day-photo:";
function cachedPhoto(query: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(PHOTO_CACHE + query);
    if (!raw) return undefined;
    const { at, url } = JSON.parse(raw) as { at: number; url: string | null };
    return Date.now() - at < (url ? 30 : 1) * 86_400_000 ? url : undefined;
  } catch {
    return undefined;
  }
}
function cachePhoto(query: string, url: string | null) {
  try {
    localStorage.setItem(PHOTO_CACHE + query, JSON.stringify({ at: Date.now(), url }));
  } catch {
    // no storage: asked again next time
  }
}

/** The highlight's picture, else a search for it (the sharing server's photo proxy), else the city's. */
function useDayPhoto(card: DayCard, cityImage: DayCardsProps["cityImage"]): string | null {
  const spec = dayPhoto(card);
  const city = cityImage?.(card.city) ?? null;
  const query = spec && "query" in spec && spec.query !== card.city ? spec.query : null;
  const [found, setFound] = useState<string | null | undefined>(() => (query ? cachedPhoto(query) : undefined));
  useEffect(() => {
    if (!query) return;
    const cached = cachedPhoto(query);
    if (cached !== undefined) return setFound(cached);
    let alive = true;
    void (async () => {
      const proxy = await imageProxy();
      if (!proxy) return;
      try {
        const res = await fetch(`${proxy.url}?q=${encodeURIComponent(query)}`, { headers: proxy.headers });
        const url = res.ok ? (((await res.json()) as { url?: string } | null)?.url ?? null) : null;
        cachePhoto(query, url);
        if (alive) setFound(url);
      } catch {
        // offline: the city's photo stands in
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);
  if (spec && "url" in spec) return spec.url;
  return found ?? city;
}

// --- a day ---------------------------------------------------------------------------------------

/** The day's photo with its number and date on it. */
function DayPhoto({ card, today, photo }: { card: DayCard; today: boolean; photo: string | null }) {
  return (
    <>
      {photo && <img src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
      {card.dayNo && <span className="dc-no">{card.dayNo}</span>}
      <span className={`dc-date${today ? " today" : ""}`}>
        {today ? `${L("Bugün", "Today")} · ` : ""}
        {dateText(card)}
      </span>
    </>
  );
}

function DayChips({ card }: { card: DayCard }) {
  const ideas = ideaCount(card.rows);
  const left = card.rows.filter((r) => isPlanRow(r) && r.state !== "done" && r.state !== "info").length;
  return (
    <>
      {left > 0 && <span className="dc-left">{L(`${left} iş`, `${left} to do`)}</span>}
      {ideas > 0 && <span className="dc-ideas-n">{L(`${ideas} fikir`, `${ideas} idea${ideas === 1 ? "" : "s"}`)}</span>}
    </>
  );
}

const AddDay = ({ card, onAdd }: { card: DayCard; onAdd: DayCardsProps["onAdd"] }) => (
  <button className="dc-add" aria-label={L(`${formatDateRange(card.date, null)}: bu güne ekle`, `${formatDateRange(card.date, null)}: add to this day`)} onClick={() => onAdd(insertAtDay(card.date, card.city))}>
    + {L("Bu güne ekle", "Add to this day")}
  </button>
);

/** Liste: the day's photo beside the whole day; a line (or the day) takes you to its cards. */
function ListDay({ card, isToday, onPick, ...props }: { card: DayCard; isToday: boolean; onPick: (row: string | null) => void } & DayCardsProps) {
  const photo = useDayPhoto(card, props.cityImage);
  const flow = flowRows(card);
  const lead = highlightOf(card);
  const leadKind = lead ? rowKind(lead) : null;
  return (
    <article className="dc-day" id={`dcd-list-${card.key}`}>
      <button className="dc-photo" onClick={() => onPick(null)} aria-label={L(`${card.dayNo ?? ""} ${card.title}: kartlarda göster`, `${card.dayNo ?? ""} ${card.title}: show as cards`)}>
        <DayPhoto card={card} today={isToday} photo={photo} />
      </button>
      <div className="dc-body">
        {leadKind && flow.length <= 3 && (
          <div className="dc-art" style={{ ["--mc" as string]: cardKindColor(leadKind) }} aria-hidden>
            {isTransport(leadKind) ? <TransportArt mode={leadKind} /> : leadKind === "activity" ? <MediaSilhouette name="ticket" /> : null}
          </div>
        )}
        <div className="dc-head">
          <h3>{card.title}</h3>
          <DayChips card={card} />
        </div>
        {flow.length === 0 ? (
          <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
        ) : (
          <ol className="dc-tl">
            {flow.map((r) => (
              <Line key={r.key} row={r} onTap={() => onPick(r.key)} />
            ))}
          </ol>
        )}
        {flow.length === 0 && <AddDay card={card} onAdd={props.onAdd} />}
      </div>
    </article>
  );
}

/** Kartlar: the day's header (held at the top while its cards scroll past), then each line as its Plan card. */
function CardsDay({ card, isToday, stays, ...props }: { card: DayCard; isToday: boolean; stays: Map<string, StayEntry> } & DayCardsProps) {
  const photo = useDayPhoto(card, props.cityImage);
  const flow = flowRows(card);
  return (
    <section className="dc-cday" id={`dcd-cards-${card.key}`} aria-label={`${card.dayNo ?? ""} ${card.title}`}>
      <header className="dc-dhead">
        <span className="dc-thumb">{photo && <img src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</span>
        <b>{card.dayNo ?? dateText(card)}</b>
        <span className="ttl">{card.title}</span>
        <span className={`dc-ddate${isToday ? " today" : ""}`}>{isToday ? L("Bugün", "Today") : dateText(card)}</span>
        <DayChips card={card} />
      </header>
      {flow.length === 0 ? (
        <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
      ) : (
        <ol className="dc-tl full">
          {flow.map((r) => (
            <Full key={r.key} row={r} stay={checkInStay(r, card, stays)} {...props} />
          ))}
        </ol>
      )}
      <AddDay card={card} onAdd={props.onAdd} />
    </section>
  );
}

/** Information (check-in, check-out, the metro planned): a thin line, closed or open. */
function InfoLine({ row }: { row: DayRow }) {
  return (
    <li className="dc-step info" data-title={row.line ?? row.title}>
      <span className="t">{time(row)}</span>
      <span className="dot" />
      <span className="txt">
        <b>{row.line ?? row.title}</b>
        {row.sub && ` · ${row.sub}`}
      </span>
    </li>
  );
}

const isLine = (r: DayRow) => !isPlanRow(r) && r.kind !== "idea";

/** A line of the closed day: time · dot · the Plan's icon (✓ / amber dot) · name; a tap opens the day at its card. */
function Line({ row, onTap }: { row: DayRow; onTap: () => void }) {
  if (isLine(row)) return <InfoLine row={row} />;
  const kind = rowKind(row);
  const mark = row.kind === "idea" ? null : rowMark(row);
  return (
    <li className={`dc-step${row.kind === "idea" ? " idea" : ""}`} data-title={row.title}>
      <span className="t">{time(row)}</span>
      <span className="dot" />
      <button className="dc-line" onClick={onTap}>
        <span className="dc-tile" style={{ ["--k" as string]: cardKindColor(kind) }} title={cardKindLabel(kind)}>
          <KindIcon kind={kind} size={18} />
          {mark && <i className={mark.done ? "done" : "todo"}>{mark.done ? "✓" : ""}</i>}
        </span>
        <span className="name">
          {row.title}
          {row.kind === "idea" && row.sub && <small> · {row.sub}</small>}
        </span>
      </button>
    </li>
  );
}

/** The stay a check-in line opens to: the line names the nights that start this day. */
function checkInStay(row: DayRow, card: DayCard, stays: Map<string, StayEntry>): StayEntry | null {
  const stay = row.stayKey ? stays.get(row.stayKey) : undefined;
  return stay && stay.block.range.start === card.date ? stay : null;
}

/** A line of the open day: its time and dot, then its own card as the Plan shows it (check-in: the stay's card). */
function Full({ row, stay, cards, leg }: { row: DayRow; stay: StayEntry | null } & DayCardsProps) {
  if (stay)
    return (
      <li className="dc-full" id={`dc-${row.key}`} data-title={row.line ?? row.title}>
        <span className="t">{time(row)}</span>
        <span className="dot" />
        <div className="dc-slot">
          <PlanEntry entry={stay} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />
        </div>
      </li>
    );
  if (isLine(row)) return <InfoLine row={row} />;
  let body: ReactNode = null;
  if (row.entry) body = <PlanEntry entry={row.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />;
  else if (row.leg) body = cards.legCard(row.leg);
  else if (row.rental) body = cards.renderGroup(row.rental.group, null, null, true);
  else if (row.item) body = cards.settled(row.item);
  else if (row.leg) body = leg(row.leg, { embedded: true });
  return (
    <li className="dc-full" id={`dc-${row.key}`} data-title={row.title}>
      <span className="t">{time(row)}</span>
      <span className="dot" />
      <div className="dc-slot">{body ?? <span className="txt">{row.title}</span>}</div>
    </li>
  );
}
