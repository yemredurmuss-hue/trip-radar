// Günlük akış (0.35.1): the trip as it goes, day by day (after Layla). A rail of stretches (arrival, a city's
// days, home); each day a section with its header held at the top. Two views of the same lines in the same
// order: Liste, one short line each (time · the Plan's icon in its colour, ✓ booked or an amber dot · name);
// Kartlar, each as its own card on the Plan (the flight, the taxi to it with its "how", the tour).
import { useEffect, useState, type ReactNode } from "react";
import { cardKindColor, cardKindLabel, RENTAL_MODES, TRANSPORT_MODES, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { imageProxy } from "../../lib/cityImages";
import { dayCards, dayPhoto, daysLabel, flowRows, groupDays, highlightOf, ideaCount, isPlanRow, rowKind, rowMark, type DayCard, type DayGroup } from "../../lib/dayCards";
import { formatDateRange } from "../../lib/items";
import { L, locale } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { insertAtDay, type InsertAt } from "../../lib/templates";
import { updateTrip } from "../actions";
import type { RentalEntry, StayEntry, TimelineSection } from "../../lib/timeline";
import type { Listing } from "../../lib/types";
import { KindIcon } from "../cards/Silhouettes";
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
  tripId: string;
  /** The traveller's own times, by row key. */
  times?: Record<string, string>;
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
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings, times: props.times });
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
          {cards.map((c, n) => (
            <span key={c.key} className="dc-strip-item">
              {c.city && c.city !== cards[n - 1]?.city && <small>{c.city}</small>}
              <button className={isToday(c) ? "today" : ""} title={c.title} onClick={() => setTarget({ id: `dcd-${mode}-${c.key}`, flash: false })}>
                {(c.dayNo ?? formatDateRange(c.date, null)).replace(/\.? ?gün$|^Days? /, "")}
              </button>
            </span>
          ))}
        </nav>
      </div>
      {groupDays(cards).map((g, n, all) => (
        <Group
          key={g.key}
          group={g}
          mode={mode}
          at={n === 0 ? "first" : n === all.length - 1 ? "last" : "middle"}
          isToday={isToday}
          stays={stays}
          onPick={(row) => setMode("cards", { id: `dc-${row}`, flash: true })}
          {...props}
        />
      ))}
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

/**
 * Kartlar, as the trip goes (after Layla): a rail on the left with a round icon per stretch, a day that travels
 * (✈ "Varış · 8 Eki") on its own, a city's days together under the city's name (📍 "2–3. gün"); day by day inside.
 */
function Group({ group, mode, at, isToday, stays, onPick, ...props }: { group: DayGroup; mode: Mode; at: "first" | "middle" | "last"; isToday: (c: DayCard) => boolean; stays: Map<string, StayEntry>; onPick: (row: string) => void } & DayCardsProps) {
  const first = group.kind === "travel" ? group.card : group.cards[0];
  const last = group.kind === "travel" ? group.card : group.cards.at(-1)!;
  const lead = group.kind === "travel" ? highlightOf(group.card) : null;
  const kind = lead ? rowKind(lead) : null;
  const travelWord = at === "first" ? L("Varış", "Arrival") : at === "last" ? L("Dönüş", "Return") : L("Yolculuk", "On the move");
  const label = group.kind === "travel" ? travelWord : daysLabel(group.cards);
  const end = last.end ?? last.date;
  const dates = first.date === end ? formatDateRange(first.date, null) : formatDateRange(first.date, end);
  return (
    <section className={`dc-grp ${group.kind}`}>
      <aside className="dc-rail">
        <span className="dc-railic" aria-hidden>
          {group.kind === "city" ? <KindIcon kind="other" size={20} /> : <KindIcon kind={kind && isTransport(kind) ? kind : "transport"} size={20} />}
        </span>
        <span className="dc-raillab">
          <b>{label}</b>
          <small>{dates}</small>
        </span>
      </aside>
      <div className="dc-grp-body">
        {group.kind === "city" && (
          <header className="dc-city">
            <h2>{group.city ?? L("Konaklama", "Stay")}</h2>
            <span>{L(`${spanDays(group.cards)} gün`, `${spanDays(group.cards)} days`)}</span>
          </header>
        )}
        {(group.kind === "travel" ? [group.card] : group.cards).map((c) => (
          <DaySection key={c.key} card={c} mode={mode} isToday={isToday(c)} stays={stays} onPick={onPick} {...props} />
        ))}
      </div>
    </section>
  );
}

/** How many days the cards cover (a merged "5–6. gün" counts two). */
const spanDays = (cards: DayCard[]) => cards.reduce((n, c) => n + (c.end ? Math.round((Date.parse(c.end) - Date.parse(c.date)) / 86_400_000) + 1 : 1), 0);

/**
 * A day, the same in both views: its header (held at the top while the day scrolls past), then its lines in
 * order: Liste one short line each (time · icon · name · ✓ or what's left; a tap shows it in Kartlar), Kartlar
 * each as its Plan card.
 */
function DaySection({ card, mode, isToday, stays, onPick, ...props }: { card: DayCard; mode: Mode; isToday: boolean; stays: Map<string, StayEntry>; onPick: (row: string) => void } & DayCardsProps) {
  const photo = useDayPhoto(card, props.cityImage);
  const flow = flowRows(card);
  const experiences = flow.filter((r) => r.item && (r.item.category === "activity" || r.item.category === "food")).length;
  return (
    <section className={`dc-cday ${mode}`} id={`dcd-${mode}-${card.key}`} aria-label={`${card.dayNo ?? ""} ${card.title}`}>
      <header className="dc-dhead">
        <span className="dc-thumb">{photo && <img src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</span>
        <span className="dc-dtext">
          <span className="dc-dmeta">
            <b className="dc-pill">{card.dayNo ?? dateText(card)}</b>
            {card.dayNo && <span className={isToday ? "today" : ""}>{isToday ? L("Bugün", "Today") : dateText(card)}</span>}
            {experiences > 0 && <span>{L(`${experiences} deneyim`, `${experiences} experience${experiences === 1 ? "" : "s"}`)}</span>}
          </span>
          <span className="ttl">{card.title}</span>
        </span>
        <DayChips card={card} />
      </header>
      {flow.length === 0 ? (
        <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
      ) : (
        <ol className={`dc-tl${mode === "cards" ? " full" : ""}`}>
          {flow.map((r) =>
            mode === "cards" ? <Full key={r.key} row={r} stay={checkInStay(r, card, stays)} {...props} /> : <Line key={r.key} row={r} onTap={() => onPick(r.key)} tripId={props.tripId} />,
          )}
        </ol>
      )}
      <AddDay card={card} onAdd={props.onAdd} />
    </section>
  );
}

/**
 * A line's time: "~" when worked out (why on hover), plain when fixed or set by the traveller. A tap lets them
 * set their own (the rest of the day follows it); "×" gives it back to the plan.
 */
function TimeCell({ row, tripId }: { row: DayRow; tripId: string }) {
  const [edit, setEdit] = useState(false);
  const save = (value: string | null) =>
    void updateTrip(
      tripId,
      (t) => {
        const own = { ...(t.dayTimes ?? {}) };
        if (value) own[row.key] = value;
        else delete own[row.key];
        return { ...t, dayTimes: own };
      },
      { touch: false },
    );
  if (edit)
    return (
      <span className="t edit">
        <input
          type="time"
          defaultValue={row.time ?? ""}
          autoFocus
          aria-label={L(`${row.title}: saat`, `${row.title}: time`)}
          onChange={(e) => e.target.value && save(e.target.value)}
          onBlur={() => setEdit(false)}
          onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setEdit(false)}
        />
        {row.user && (
          <button type="button" className="t-reset" title={L("Otomatik saate dön", "Back to the worked-out time")} onMouseDown={(e) => e.preventDefault()} onClick={() => (save(null), setEdit(false))}>
            ×
          </button>
        )}
      </span>
    );
  return (
    <button type="button" className={`t${row.estimated ? " est" : ""}${row.user ? " own" : ""}`} title={row.why ?? L("Saat ver", "Set a time")} onClick={() => setEdit(true)}>
      {time(row) || "–"}
    </button>
  );
}

/** Information (check-in, check-out, the metro planned): a thin line, closed or open. */
function InfoLine({ row, tripId }: { row: DayRow; tripId: string }) {
  return (
    <li className="dc-step info" data-title={row.line ?? row.title}>
      <TimeCell row={row} tripId={tripId} />
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
function Line({ row, onTap, tripId }: { row: DayRow; onTap: () => void; tripId: string }) {
  if (isLine(row)) return <InfoLine row={row} tripId={tripId} />;
  const kind = rowKind(row);
  const mark = row.kind === "idea" ? null : rowMark(row);
  return (
    <li className={`dc-step${row.kind === "idea" ? " idea" : ""}`} data-title={row.title}>
      <TimeCell row={row} tripId={tripId} />
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
      {row.warn && <p className="dc-warn">{row.warn}</p>}
    </li>
  );
}

/** The stay a check-in line opens to: the line names the nights that start this day. */
function checkInStay(row: DayRow, card: DayCard, stays: Map<string, StayEntry>): StayEntry | null {
  const stay = row.stayKey ? stays.get(row.stayKey) : undefined;
  return stay && stay.block.range.start === card.date ? stay : null;
}

/** A line of the open day: its time and dot, then its own card as the Plan shows it (check-in: the stay's card). */
function Full({ row, stay, cards, leg, tripId }: { row: DayRow; stay: StayEntry | null } & DayCardsProps) {
  if (stay)
    return (
      <li className="dc-full" id={`dc-${row.key}`} data-title={row.line ?? row.title}>
        <TimeCell row={row} tripId={tripId} />
        <span className="dot" />
        <div className="dc-slot">
          <PlanEntry entry={stay} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />
        </div>
      </li>
    );
  if (isLine(row)) return <InfoLine row={row} tripId={tripId} />;
  let body: ReactNode = null;
  if (row.entry) body = <PlanEntry entry={row.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />;
  else if (row.leg) body = cards.legCard(row.leg);
  else if (row.rental) body = cards.renderGroup(row.rental.group, null, null, true);
  else if (row.item) body = cards.settled(row.item);
  else if (row.leg) body = leg(row.leg, { embedded: true });
  return (
    <li className="dc-full" id={`dc-${row.key}`} data-title={row.title}>
      <TimeCell row={row} tripId={tripId} />
      <span className="dot" />
      <div className="dc-slot">
        {row.warn && <p className="dc-warn">{row.warn}</p>}
        {body ?? <span className="txt">{row.title}</span>}
      </div>
    </li>
  );
}
