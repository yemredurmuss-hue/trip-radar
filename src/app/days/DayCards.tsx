// Günlük akış as cards (0.34.5, after the reference "Günlük akış · 3 gün"): a card a day, the day's own
// photo on the left (its highlight's picture, a search for it, else the city), on the right its title and
// a timeline (time · dot · the Plan's icon in its colour · name); booked or still to do is a mark on the
// icon. A tap opens the day in place: every line, information too, the details under each, ideas, "+".
import { useEffect, useState } from "react";
import { cardKindColor, cardKindLabel, RENTAL_MODES, TRANSPORT_MODES, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { imageProxy } from "../../lib/cityImages";
import { dayCards, dayPhoto, foldRows, highlightOf, ideaCount, isPlanRow, rowKind, rowMark, type DayCard } from "../../lib/dayCards";
import { formatDateRange } from "../../lib/items";
import { L, locale } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { insertAtDay, type InsertAt } from "../../lib/templates";
import type { RentalEntry, TimelineSection } from "../../lib/timeline";
import type { Listing } from "../../lib/types";
import { KindIcon, MediaSilhouette, TransportArt } from "../cards/Silhouettes";
import { HeroIcon } from "../Icons";
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
const isTransport = (k: CardKind): k is TransportMode => (TRANSPORT_MODES as readonly string[]).includes(k) && !RENTAL_MODES.includes(k as TransportMode);

/** Where a row's card lives on the Plan (to open it there). */
function planKey(r: DayRow): string | null {
  if (r.entry) return r.entry.key;
  if (r.leg) return `leg:${r.leg.key}`;
  if (r.rental) return r.rental.key;
  if (r.item) return `event:${r.item.id}`;
  return r.stayKey;
}

export function DayCards(props: DayCardsProps) {
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings });
  const [open, setOpen] = useState<{ key: string; row: string | null } | null>(null);
  return (
    <div className="dc">
      {cards.map((c) => (
        <Day
          key={c.key}
          card={c}
          open={open?.key === c.key}
          focus={open?.key === c.key ? open.row : null}
          onToggle={(row) => setOpen(open?.key === c.key && !row ? null : { key: c.key, row })}
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

// --- a day ----------------------------------------------------------------------------------------

function Day({ card, open, focus, onToggle, ...props }: { card: DayCard; open: boolean; focus: string | null; onToggle: (row: string | null) => void } & DayCardsProps) {
  const photo = useDayPhoto(card, props.cityImage);
  const [sel, setSel] = useState<string | null>(focus);
  useEffect(() => setSel(focus), [focus, open]);
  const { shown, more } = foldRows(card.rows);
  const ideas = ideaCount(card.rows);
  const left = card.rows.filter((r) => isPlanRow(r) && r.state !== "done" && r.state !== "info").length;
  const isToday = card.date === props.today || (!!card.end && card.date <= props.today && props.today <= card.end);
  const lead = highlightOf(card);
  const leadKind = lead ? rowKind(lead) : null;
  const rows = open ? card.rows.filter((r) => r.kind !== "ideas" && r.kind !== "idea") : shown;
  const ideaList = card.rows.flatMap((r) => (r.kind === "ideas" ? r.items.map((i) => ({ name: i.name, sub: null as string | null })) : r.kind === "idea" ? [{ name: r.title, sub: r.sub }] : []));
  const add = () => props.onAdd(insertAtDay(card.date, card.city));
  return (
    <article className={`dc-day${open ? " open" : ""}`}>
      <button className="dc-photo" onClick={() => onToggle(null)} aria-label={`${card.dayNo ?? ""} ${card.title}`}>
        {photo && <img src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        {card.dayNo && <span className="dc-no">{card.dayNo}</span>}
        <span className={`dc-date${isToday ? " today" : ""}`}>
          {isToday ? `${L("Bugün", "Today")} · ` : ""}
          {dateText(card)}
        </span>
      </button>
      <div className="dc-body">
        {leadKind && (
          <div className="dc-art" style={{ ["--mc" as string]: cardKindColor(leadKind) }} aria-hidden>
            {isTransport(leadKind) ? <TransportArt mode={leadKind} /> : leadKind === "activity" ? <MediaSilhouette name="ticket" /> : null}
          </div>
        )}
        <button className="dc-head" aria-expanded={open} onClick={() => onToggle(null)}>
          <h3>{card.title}</h3>
          {left > 0 && <span className="dc-left">{L(`${left} iş`, `${left} to do`)}</span>}
          {!open && ideas > 0 && <span className="dc-ideas-n">{L(`${ideas} fikir`, `${ideas} idea${ideas === 1 ? "" : "s"}`)}</span>}
          <span className="dc-chev" aria-hidden>
            <HeroIcon name="chevDown" size={18} />
          </span>
        </button>
        {rows.length > 0 ? (
          <ol className="dc-tl">
            {rows.map((r) =>
              isPlanRow(r) ? (
                <Step
                  key={r.key}
                  row={r}
                  open={open}
                  selected={open && sel === r.key}
                  onTap={() => (open ? setSel(sel === r.key ? null : r.key) : onToggle(r.key))}
                  {...props}
                />
              ) : (
                <li key={r.key} className="dc-step info" data-title={r.line ?? r.title}>
                  <span className="t">{time(r)}</span>
                  <span className="dot" />
                  <span className="txt">
                    <b>{r.line ?? r.title}</b>
                    {r.sub && ` · ${r.sub}`}
                  </span>
                </li>
              ),
            )}
            {!open && more.length > 0 && (
              <li className="dc-step more">
                <span className="t" />
                <span className="dot" />
                <span className="txt">{L(`+${more.length} daha`, `+${more.length} more`)}</span>
              </li>
            )}
          </ol>
        ) : (
          <p className="dc-free">{L("Henüz plan yok.", "Nothing planned yet.")}</p>
        )}
        {open && ideaList.length > 0 && (
          <div className="dc-other">
            <small>{L("Diğer · saati yok", "Other · no time")}</small>
            <ul>
              {ideaList.map((idea, n) => (
                <li key={`${idea.name}-${n}`}>
                  {idea.name}
                  {idea.sub && <span> · {idea.sub}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(open || !rows.length) && (
          <button className="dc-add" aria-label={L(`${formatDateRange(card.date, null)}: bu güne ekle`, `${formatDateRange(card.date, null)}: add to this day`)} onClick={add}>
            + {L("Bu güne ekle", "Add to this day")}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * A line of the day: its time, a dot on the line, the Plan's icon in its colour (✓ booked, an amber dot
 * still to do), its name; open, its second line and where it stands, and a tap shows its details under it.
 */
function Step({ row, open, selected, onTap, ...props }: { row: DayRow; open: boolean; selected: boolean; onTap: () => void } & DayCardsProps) {
  const kind = rowKind(row);
  const mark = rowMark(row);
  const key = planKey(row);
  const planHere = row.kind === "leg" && row.state === "open" && row.leg;
  const state = mark ? (mark.done ? L("Alındı", "Booked") : row.status || mark.text) : null;
  return (
    <li className={`dc-step${selected ? " sel" : ""}`} data-title={row.title}>
      <span className="t">{time(row)}</span>
      <span className="dot" />
      <button className="dc-line" aria-expanded={open ? selected : undefined} onClick={onTap}>
        <span className="dc-tile" style={{ ["--k" as string]: cardKindColor(kind) }} title={cardKindLabel(kind)}>
          <KindIcon kind={kind} size={18} />
          {mark && <i className={mark.done ? "done" : "todo"}>{mark.done ? "✓" : ""}</i>}
        </span>
        <span className="name">
          {row.title}
          {open && (row.sub || state) && (
            <small>
              {row.sub}
              {row.sub && state && " · "}
              {state && <em className={mark?.done ? "ok" : "todo"}>{state}</em>}
            </small>
          )}
        </span>
      </button>
      {selected && (
        <div className="dc-detail">
          {row.line && row.line !== row.title && <p>{row.line}</p>}
          {row.hint && <p className="muted">{row.hint}</p>}
          {!planHere &&
            row.notes.map((n) => (
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
    </li>
  );
}
