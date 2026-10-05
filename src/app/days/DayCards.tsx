// Günlük akış: the trip day by day, two views of the same lines in the same order. Liste (0.35.4, Emre's
// reference docs/mockups/ref/2026-10-05-gunluk-akis-liste-referans.webp): a card per day, its photo on the left
// with "1. gün" on it, its title, and what happens hour by hour — time · the Plan's icon in its colour · the
// line's title — every line the same weight, a check-in like a taxi like a flight. Each line is titled by the
// code in one standard (satır standardı v2, dayRowTitle.ts): NE · HANGİSİ ("Uçuş · İstanbul → Kopenhag") and a
// grey line; no dot, no dotted line. Insurance, the eSIM and a visa aren't part of a day: they stay in Plan →
// Diğer. Kartlar (0.35.1, after Layla): a rail of stretches, each line as its own card on the Plan.
import { useEffect, useState, type ReactNode } from "react";
import { cardKindColor, cardKindLabel, RENTAL_MODES, TRANSPORT_MODES, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { imageProxy } from "../../lib/cityImages";
import { dayCards, dayPhoto, daysLabel, flowRows, groupDays, highlightOf, ideaCount, isPlanRow, movedOrder, orderRows, rowKind, rowMark, type DayCard, type DayGroup } from "../../lib/dayCards";
import { sectionOfItem } from "../../lib/categories";
import { rowTitle, titleText, withLayovers, type RowTitle } from "../../lib/dayRowTitle";
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
  /** The order the traveller gave each day's lines, by date (trip.dayOrder). */
  order?: Record<string, string[]>;
  /** Lines with a time moved by hand, off the clock (trip.dayLoose). */
  loose?: string[];
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
  // A day opened or closed in the list (today starts open): its loose ends under its hours.
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const flip = (key: string) => setFlipped((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set([...s, key])));
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
      {mode === "list" && (
        <div className="dl">
          {cards.map((c) => (
            <DayListCard key={c.key} card={c} isToday={isToday(c)} open={isToday(c) !== flipped.has(c.key)} onToggle={() => flip(c.key)} onPick={(row) => setMode("cards", { id: `dc-${row}`, flash: true })} {...props} />
          ))}
        </div>
      )}
      {mode === "cards" && groupDays(cards).map((g, n, all) => (
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
  // Insurance and the eSIM aren't part of the day: not its to-dos either.
  const left = card.rows.filter((r) => isPlanRow(r) && !isAside(r) && r.state !== "done" && r.state !== "info").length;
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
  // The day's lines (insurance and the eSIM aren't among them), a layover between two connecting flights.
  const lines = dayLines(card, props);
  const flow = withLayovers(lines);
  const dnd = useReorder(lines, card.date, props.tripId);
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
          <span className="ttl">
            {card.title}
            {card.tag && <> <em className="dl-tag">{card.tag}</em></>}
          </span>
        </span>
        <DayChips card={card} />
      </header>
      {flow.length === 0 ? (
        <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
      ) : (
        <ol className={`dc-tl${mode === "cards" ? " full" : ""}`}>
          {flow.map((r) =>
            mode === "cards" ? (
              <Full key={r.key} row={r} stay={checkInStay(r, card, stays)} dnd={lines.includes(r) ? dnd(r) : undefined} {...props} />
            ) : (
              <Line key={r.key} row={r} onTap={() => onPick(r.key)} tripId={props.tripId} dnd={lines.includes(r) ? dnd(r) : undefined} />
            ),
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
  // A layover's time is its first flight's landing: nothing to set.
  if (row.layover) return <span className="t">{row.time}</span>;
  const save = (value: string | null) =>
    void updateTrip(
      tripId,
      (t) => {
        const own = { ...(t.dayTimes ?? {}) };
        if (value) own[row.key] = value;
        else delete own[row.key];
        // A time given (or the plan's taken back) puts a line moved by hand back on the clock.
        return { ...t, dayTimes: own, dayLoose: (t.dayLoose ?? []).filter((k) => k !== row.key) };
      },
      { touch: false },
    );
  if (edit)
    return (
      <span className="t edit">
        <input
          type="time"
          defaultValue={row.time ?? row.freed ?? ""}
          autoFocus
          aria-label={L(`${titleText(rowTitle(row))}: saat`, `${titleText(rowTitle(row))}: time`)}
          onChange={(e) => e.target.value && save(e.target.value)}
          onBlur={() => setEdit(false)}
          onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setEdit(false)}
        />
        {(row.user || row.freed) && (
          <button type="button" className="t-reset" title={row.freed ? L(`Saatine geri koy (${row.freed})`, `Back on its time (${row.freed})`) : L("Otomatik saate dön", "Back to the worked-out time")} onMouseDown={(e) => e.preventDefault()} onClick={() => (save(null), setEdit(false))}>
            ×
          </button>
        )}
      </span>
    );
  return (
    <button type="button" className={`t${row.estimated ? " est" : ""}${row.user ? " own" : ""}${row.freed ? " freed" : ""}`}
      title={row.freed ? L(`Elle taşındı (saati ${row.freed}). Dokun: saat ver ya da × ile saatine geri koy`, `Moved by hand (its time ${row.freed}). Tap: set a time, or × to put it back on its time`) : (row.why ?? L("Saat ver", "Set a time"))}
      onClick={() => setEdit(true)}>
      {time(row) || "–"}
    </button>
  );
}

/** Information in Kartlar (check-in, check-out, the metro planned, a layover): a thin line, its title in the standard. */
function InfoLine({ row, tripId, dnd }: { row: DayRow; tripId: string; dnd?: Dnd }) {
  const t = rowTitle(row);
  return (
    <li className={`dc-step info${row.layover ? " quiet" : ""}${dnd?.cls ?? ""}`} id={`dc-${row.key}`} data-title={titleText(t)} {...dnd?.li}>
      {dnd?.grip}
      <TimeCell row={row} tripId={tripId} />
      <span className="dot" />
      <span className="txt">
        <b>{t.what}</b>
        {t.which && ` · ${t.which}`}
        {t.detail && <small> · {t.detail}</small>}
      </span>
    </li>
  );
}

const isLine = (r: DayRow) => !isPlanRow(r) && r.kind !== "idea";

/** NE in bold · HANGİSİ, the grey line under them (satır standardı v2). */
const RowName = ({ t }: { t: RowTitle }) => (
  <span className="name">
    <span className="dc-ttl">
      <b className="dc-what">{t.what}</b>
      {t.which && (
        <>
          {" "}
          <i className="dc-sep">·</i>{" "}
          <span className="dc-which">{t.which}</span>
        </>
      )}
    </span>
    {t.detail && <small>{t.detail}</small>}
  </span>
);

const Clock = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M10 2.5h4" />
  </svg>
);

/**
 * A line of the list: time · the Plan's icon (✓ booked / amber dot) · NE · HANGİSİ and its grey line; a check-in,
 * a planned metro, a taxi, a flight all the same. A tap opens the cards at its card. A layover is a quiet line.
 */
function Line({ row, onTap, tripId, dnd }: { row: DayRow; onTap: () => void; tripId: string; dnd?: Dnd }) {
  const info = isLine(row);
  const kind = rowKind(row);
  const mark = row.kind === "idea" || info ? null : rowMark(row);
  const t = rowTitle(row);
  if (row.layover)
    return (
      <li className="dc-step info quiet" data-title={titleText(t)}>
        <TimeCell row={row} tripId={tripId} />
        <span className="dc-line">
          <span className="dc-tile">
            <Clock />
          </span>
          <RowName t={t} />
        </span>
      </li>
    );
  return (
    <li className={`dc-step${row.kind === "idea" ? " idea" : info ? " info" : ""}${dnd?.cls ?? ""}`} data-title={titleText(t)} {...dnd?.li}>
      {dnd?.grip}
      <TimeCell row={row} tripId={tripId} />
      <button className="dc-line" onClick={onTap}>
        <span className="dc-tile" style={{ ["--k" as string]: cardKindColor(kind) }} title={cardKindLabel(kind)}>
          <KindIcon kind={kind} size={19} />
          {mark && <i className={mark.done ? "done" : "todo"}>{mark.done ? "✓" : ""}</i>}
        </span>
        <RowName t={t} />
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
function Full({ row, stay, cards, leg, tripId, dnd }: { row: DayRow; stay: StayEntry | null; dnd?: Dnd } & DayCardsProps) {
  // The line's title in the standard names it (its card keeps its own header).
  const title = titleText(rowTitle(row));
  if (stay)
    return (
      <li className={`dc-full${dnd?.cls ?? ""}`} id={`dc-${row.key}`} data-title={title} {...dnd?.li}>
        {dnd?.grip}
        <TimeCell row={row} tripId={tripId} />
        <span className="dot" />
        <div className="dc-slot">
          <PlanEntry entry={stay} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />
        </div>
      </li>
    );
  if (isLine(row)) return <InfoLine row={row} tripId={tripId} dnd={dnd} />;
  let body: ReactNode = null;
  if (row.entry) body = <PlanEntry entry={row.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />;
  else if (row.leg) body = cards.legCard(row.leg);
  else if (row.rental) body = cards.renderGroup(row.rental.group, null, null, true);
  else if (row.item) body = cards.settled(row.item);
  else if (row.leg) body = leg(row.leg, { embedded: true });
  return (
    <li className={`dc-full${dnd?.cls ?? ""}`} id={`dc-${row.key}`} data-title={title} {...dnd?.li}>
      {dnd?.grip}
      <TimeCell row={row} tripId={tripId} />
      <span className="dot" />
      <div className="dc-slot">
        {row.warn && <p className="dc-warn">{row.warn}</p>}
        {body ?? <span className="txt">{title}</span>}
      </div>
    </li>
  );
}

// --- Liste (0.35.4) ---------------------------------------------------------------------------------

/** Not an hour of the day: insurance, the eSIM, a visa, a chore (the Plan's Diğer). */
const isAside = (r: DayRow) => !!r.item && sectionOfItem(r.item) === "other";

/** The card's faint drawing on the right, from what the day is about: the sea, hills, or the town. */
type Motif = "sea" | "hills" | "town";
function motifOf(card: DayCard): Motif {
  const text = card.rows.map((r) => `${r.title} ${r.item?.name ?? ""} ${r.item?.summary ?? ""}`).join(" ");
  if (/tekne|boat|feribot|ferry|vapur|plaj|beach|sahil|deniz|\bsea\b|cruise|okyanus|ocean|kıyı|coast/i.test(text) || card.rows.some((r) => rowKind(r) === "ferry")) return "sea";
  if (/yürüyüş|hike|hiking|levada|dağ|mountain|orman|forest|park|bahçe|garden|seyir|viewpoint|miradouro|vadi|valley|şelale|waterfall/i.test(text)) return "hills";
  return "town";
}

const MOTIFS: Record<Motif, ReactNode> = {
  sea: (
    <>
      <path d="M8 118c22-10 40-10 62 0s40 10 62 0 40-10 62 0 40 10 62 0" />
      <path d="M30 138c22-10 40-10 62 0s40 10 62 0 40-10 62 0" />
      <path d="M150 104V40l40 58zM146 104h56l-8 10h-42z" />
      <path d="M40 70c30-30 60-34 96-22M210 60c14-10 30-12 46-6" />
    </>
  ),
  hills: (
    <>
      <path d="M0 132l58-70 34 40 46-62 52 66 30-30 40 56" />
      <path d="M40 132l30-30 26 30M176 132l26-26 22 26" />
      <path d="M226 132v-30M218 112l8-14 8 14M214 124l12-20 12 20" />
      <path d="M30 40c10-6 22-6 32 0M100 22c8-5 18-5 26 0" />
    </>
  ),
  town: (
    <>
      <path d="M10 132V92l22-16 22 16v40M54 132V70h34v62M88 132V98l18-14 18 14v34M124 132V56l14-16 14 16v76M152 132V86h36v46M188 132v-30l20-14 20 14v30" />
      <path d="M64 84h6M76 84h6M64 100h6M76 100h6M132 70h12M132 88h12M160 98h6M174 98h6" />
      <path d="M0 132h250" />
    </>
  ),
};

/**
 * A day of the list: the photo with "1. gün" on it, the title and the date, the arrow that opens it; its lines
 * one each (a layover between two connecting flights); opened, "+ Bu güne ekle". A line opens the cards at that line.
 */
function DayListCard({ card, isToday, open, onToggle, onPick, ...props }: { card: DayCard; isToday: boolean; open: boolean; onToggle: () => void; onPick: (row: string) => void } & DayCardsProps) {
  const photo = useDayPhoto(card, props.cityImage);
  // Every line of the day (0.35.6): with a time by the clock, without one where it was put (drag, or ↑ ↓).
  const lines = dayLines(card, props);
  const shown = withLayovers(lines);
  const dnd = useReorder(lines, card.date, props.tripId);
  const lead = highlightOf(card);
  const tint = lead ? cardKindColor(rowKind(lead)) : "#5b7fa6";
  const label = L(`${card.dayNo ?? dateText(card)}: ${open ? "kapat" : "aç"}`, `${card.dayNo ?? dateText(card)}: ${open ? "close" : "open"}`);
  return (
    <section className={`dc-cday list dl-day${open ? " open" : ""}${isToday ? " today" : ""}`} id={`dcd-list-${card.key}`} aria-label={`${card.dayNo ?? ""} ${card.title}`}>
      <div className="dl-photo">
        {photo && <img src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <b className="dc-pill">{card.dayNo ?? dateText(card)}</b>
      </div>
      <div className="dl-body" style={{ ["--m" as string]: tint }}>
        <svg className="dl-motif" viewBox="0 0 260 140" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          {MOTIFS[motifOf(card)]}
        </svg>
        <header className="dl-head">
          <span className="dl-htext">
            <span className="ttl">
              {card.title}
              {card.tag && <> <em className="dl-tag">{card.tag}</em></>}
            </span>
            <span className="dl-date">
              {card.dayNo && <span className={isToday ? "today" : ""}>{isToday ? L("Bugün", "Today") : dateText(card)}</span>}
              {card.route && <span>{card.route}</span>}
              <DayChips card={card} />
            </span>
          </span>
          <button type="button" className="dl-chev" aria-expanded={open} aria-label={label} title={label} onClick={onToggle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </header>
        {lines.length > 0 ? (
          <ol className="dc-tl">
            {shown.map((r) => (
              <Line key={r.key} row={r} onTap={() => onPick(r.key)} tripId={props.tripId} dnd={lines.includes(r) ? dnd(r) : undefined} />
            ))}
          </ol>
        ) : (
          <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
        )}
        {/* A free day has nothing to open: its "+" is there. */}
        {(open || !lines.length) && <AddDay card={card} onAdd={props.onAdd} />}
      </div>
    </section>
  );
}

// --- the day's order (0.35.6) ------------------------------------------------------------------------

/**
 * The day's lines in their order (the timed by the clock, the rest where put). Insurance, the eSIM and a visa
 * aren't part of a day (satır standardı v2): they stay in Plan → Diğer.
 */
function dayLines(card: DayCard, props: Pick<DayCardsProps, "times" | "order" | "loose">): DayRow[] {
  // A line moved by hand off its time stays where it was put, its time hidden (a time given puts it back).
  const all = flowRows(card, props.times).map((r) => (r.time && props.loose?.includes(r.key) ? { ...r, freed: r.time, time: null, estimated: false } : r));
  return orderRows(all.filter((r) => !isAside(r)), props.order?.[card.date]);
}

/** What a line needs to be moved: its grip, its drop handlers, its class while dragged over. */
interface Dnd {
  grip: ReactNode;
  li: { onDragOver: (e: React.DragEvent<HTMLLIElement>) => void; onDrop: (e: React.DragEvent<HTMLLIElement>) => void };
  cls: string;
}

/**
 * Moving a day's lines: each has a grip to drag it up or down (or ↑ ↓ on it); dropped, the day's order is kept
 * on the trip (trip.dayOrder, by date). A line with a time moved by hand comes off the clock (0.35.10, Emre:
 * "evet"): it stays where it was put, its time hidden (trip.dayLoose) and its own time forgotten; a time given,
 * or "×" on it, puts it back by the clock.
 */
function useReorder(rows: DayRow[], date: string, tripId: string): (row: DayRow) => Dnd {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; after: boolean } | null>(null);
  const move = (key: string, target: string, after: boolean) =>
    void updateTrip(
      tripId,
      (t) => {
        const timed = rows.find((r) => r.key === key)?.time;
        const own = { ...(t.dayTimes ?? {}) };
        if (timed) delete own[key];
        return {
          ...t,
          dayOrder: { ...(t.dayOrder ?? {}), [date]: movedOrder(rows, key, target, after) },
          ...(timed ? { dayLoose: [...new Set([...(t.dayLoose ?? []), key])], dayTimes: own } : {}),
        };
      },
      { touch: false },
    );
  const end = () => {
    setDrag(null);
    setOver(null);
  };
  return (row) => ({
    grip: (
      <button
        type="button"
        className="dc-grip"
        draggable
        aria-label={L(`${titleText(rowTitle(row))}: sırasını değiştir`, `${titleText(rowTitle(row))}: move`)}
        title={L("Sürükle ya da ↑ ↓ ile taşı", "Drag, or move with ↑ ↓")}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.key);
          const li = e.currentTarget.closest("li");
          if (li) e.dataTransfer.setDragImage(li, 24, 20);
          setDrag(row.key);
        }}
        onDragEnd={end}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const i = rows.indexOf(row) + (e.key === "ArrowUp" ? -1 : 1);
          if (i >= 0 && i < rows.length) move(row.key, rows[i].key, e.key === "ArrowDown");
        }}
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
          <circle cx="3.5" cy="3" r="1.4" /><circle cx="8.5" cy="3" r="1.4" /><circle cx="3.5" cy="8" r="1.4" /><circle cx="8.5" cy="8" r="1.4" /><circle cx="3.5" cy="13" r="1.4" /><circle cx="8.5" cy="13" r="1.4" />
        </svg>
      </button>
    ),
    li: {
      onDragOver: (e) => {
        if (!drag || drag === row.key) return;
        e.preventDefault();
        const box = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > box.top + box.height / 2;
        if (over?.key !== row.key || over.after !== after) setOver({ key: row.key, after });
      },
      onDrop: (e) => {
        if (!drag) return;
        e.preventDefault();
        if (over && over.key !== drag) move(drag, over.key, over.after);
        end();
      },
    },
    cls: drag === row.key ? " dragging" : over?.key === row.key ? (over.after ? " drop-after" : " drop-before") : "",
  });
}
