// Gün gün in its three ways to read (plan v46): Kompakt is one row a day (DayCards.tsx); Liste (0.36.83, docs/envanter/kayip/img)
// is a card a day with the city's big photo, "Gün N" on it, the day's lines beside it and the night under its title;
// Kartlar is the day on a rail, its photo a small one by the title. Under the lines of both, the day is two parts:
// "Günün akışı" (what happens when) and "Günün rezervasyonları" (the day's tickets, stays and tours as the Plan's own
// cards; a day with everything booked closes to "✓ hazır"). The strip of days jumps to a day. A day that changes city
// shows its way as one card (JourneyDay.tsx). The lines are Kompakt's own (DayLine): their times, stages, drag and warnings.
import { useState, type ReactNode } from "react";
import { dayCards, type DayCard } from "../../lib/dayCards";
import { dayPhotoUrl, journeyDay, motifOf, reservationRows, reservationsReady, type Motif } from "../../lib/dayView";
import { placeRoute } from "../../lib/dayRowTitle";
import { formatDateRange } from "../../lib/items";
import { L } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import type { StayEntry } from "../../lib/timeline";
import { UiIcon } from "../cards/Silhouettes";
import { PlanEntry } from "../plan/PlanEntry";
import { AddDay, CompactDays, DayLine, DayProviders, Left, NightLine, dateText, dayLines, staysOf, useOwners, usePlace, useReorder, withAside, type DayCardsProps, type DayPlanCards } from "./DayCards";
import { useDayMode } from "./dayMode";
import { JourneyDay } from "./JourneyDay";

/** Gün gün's days, in the way the traveller chose to read them. */
export function DayCards(props: DayCardsProps) {
  const mode = useDayMode();
  if (mode === "compact") return <CompactDays {...props} />;
  return <RichDays {...props} mode={mode} />;
}

function RichDays({ mode, ...props }: DayCardsProps & { mode: "list" | "cards" }) {
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings, times: props.times, merge: false });
  const stays = staysOf(props.sections);
  return (
    <DayProviders mainPlaces={props.mainPlaces}>
      <div className={`dv dv-${mode}`} aria-label={L("Gün gün", "Day by day")}>
        <Strip cards={cards} mode={mode} today={props.today} />
        {cards.map((c) => (
          <RichDay key={c.key} card={c} mode={mode} stays={stays} isToday={c.date === props.today} {...props} />
        ))}
      </div>
    </DayProviders>
  );
}

const dayNumber = (card: DayCard) => card.dayNo?.match(/\d+/)?.[0] ?? null;

/** The strip of days ("Günler"): a button a day, the city's name where it changes, today marked; a tap brings the day into view. */
function Strip({ cards, mode, today }: { cards: DayCard[]; mode: string; today: string }) {
  const place = usePlace();
  return (
    <nav className="dv-strip" aria-label={L("Günler", "Days")}>
      {cards.map((c, n) => (
        <span key={c.key} className="dv-strip-item">
          {c.city && c.city !== cards[n - 1]?.city && <small>{place(c.city)}</small>}
          <button type="button" className={c.date === today ? "today" : ""} title={c.title} aria-label={c.title} onClick={() => document.getElementById(`dvd-${mode}-${c.key}`)?.scrollIntoView({ block: "start" })}>
            {dayNumber(c) ?? formatDateRange(c.date, null)}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** The faint drawing a day has in the place of a photo it doesn't have: the sea, hills or the town. */
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

/** The day's picture: its photo when it has one, over its faint drawing (which shows when there is no photo, or it doesn't load). */
function Picture({ card, cityImage }: { card: DayCard; cityImage: DayCardsProps["cityImage"] }) {
  const photo = dayPhotoUrl(card, cityImage);
  return (
    <>
      <svg className="dv-motif" viewBox="0 0 260 140" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {MOTIFS[motifOf(card)]}
      </svg>
      {photo && <img src={photo} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />}
    </>
  );
}

type DayProps = { card: DayCard; mode: "list" | "cards"; stays: Map<string, StayEntry>; isToday: boolean } & DayCardsProps;

function RichDay({ card, mode, stays, isToday, ...props }: DayProps) {
  const n = dayNumber(card);
  const dayNo = n ? L(`Gün ${n}`, `Day ${n}`) : null;
  const lines = dayLines(card, props);
  const flow = withAside(lines, useOwners());
  const dnd = useReorder(lines, card.date, props.tripId);
  const place = usePlace();
  // A day that changes city shows its way as one card; the flow keeps what else the day has.
  const journey = journeyDay(card, flow);
  const rest = journey ? journey.rest : flow;
  const reservations = reservationRows(rest);
  const title = (
    <h3 className="dv-ttl">
      {card.title}
      {card.tag && <em>{card.tag}</em>}
    </h3>
  );
  const meta = (
    <span className="dv-meta">
      {dateText(card)}
      {card.route && <> · {placeRoute(card.route, place)}</>}
    </span>
  );
  const content = (
    <>
      {journey && <JourneyDay journey={journey} card={card} cards={props.cards} onShow={props.onShow} tripId={props.tripId} />}
      {rest.length > 0 ? (
        <div className="dv-part">
          <span className="dv-part-label">{L("Günün akışı", "The day's flow")}</span>
          <ol className="dg-tl dv-flow">
            {rest.map((r) => (
              <DayLine key={r.key} row={r} onTap={() => props.onShow(r.entry?.key ?? r.stayKey ?? r.key)} tripId={props.tripId} dnd={lines.includes(r) ? dnd(r) : undefined} />
            ))}
          </ol>
        </div>
      ) : (
        !journey && <span className="dg-free">{L("Serbest gün · yapılacaklardan seç", "Free day · pick from the to-dos")}</span>
      )}
    </>
  );
  const foot = (
    <div className="dg-foot">
      {isToday && <span className="dg-today">{L("Bugün", "Today")}</span>}
      <NightLine card={card} stays={stays} />
      <Left card={card} />
      <AddDay card={card} onAdd={props.onAdd} />
    </div>
  );
  const rez = <Reservations rows={reservations} cards={props.cards} />;
  const label = `${dayNo ?? ""} ${card.title}`.trim();
  if (mode === "list")
    return (
      <section className={`dv-day${isToday ? " today" : ""}`} id={`dvd-list-${card.key}`} aria-label={label}>
        <div className="dv-card">
          <div className="dv-photo">
            <Picture card={card} cityImage={props.cityImage} />
            {dayNo && <i className="dv-pill">{dayNo}</i>}
          </div>
          <div className="dv-body">
            <header className="dv-head">
              {title}
              {meta}
            </header>
            {content}
            {foot}
          </div>
        </div>
        {rez}
      </section>
    );
  return (
    <section className={`dv-day${isToday ? " today" : ""}`} id={`dvd-cards-${card.key}`} aria-label={label}>
      <header className="dv-chead">
        <span className="dv-thumb">
          <Picture card={card} cityImage={props.cityImage} />
        </span>
        <span className="dv-ctext">
          {title}
          {meta}
        </span>
      </header>
      <div className="dv-rail">
        {content}
        {rez}
        {foot}
      </div>
    </section>
  );
}

/** A reservation's card, as the Plan draws it. */
function ReservationCard({ row, cards }: { row: DayRow; cards: DayPlanCards }) {
  if (row.entry) return <PlanEntry entry={row.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />;
  if (row.leg) return <>{cards.legCard(row.leg)}</>;
  if (row.rental) return <>{cards.renderGroup(row.rental.group, null, null, true)}</>;
  if (row.item) return <>{cards.settled(row.item)}</>;
  return null;
}

/** "Günün rezervasyonları": the day's tickets, stays and tours, a card each; a day with all of them booked is closed to "✓ hazır". */
function Reservations({ rows, cards }: { rows: DayRow[]; cards: DayPlanCards }) {
  const [asked, setAsked] = useState<boolean | null>(null);
  if (!rows.length) return null;
  const { ready, total, all } = reservationsReady(rows);
  const open = asked ?? !all;
  return (
    <div className="dv-part dv-rez">
      <button type="button" className="dv-rez-head" aria-expanded={open} onClick={() => setAsked(!open)}>
        <span className="dv-part-label">{L("Günün rezervasyonları", "The day's reservations")}</span>
        {all ? (
          <span className="dv-ready">
            <UiIcon name="check" size={13} />
            {L("hazır", "ready")}
          </span>
        ) : (
          <span className="dv-wait">{L(`${total - ready} bekliyor`, `${total - ready} waiting`)}</span>
        )}
        <i className="dv-chev" aria-hidden />
      </button>
      {open && (
        <div className="dv-rcards">
          {rows.map((r) => (
            <div key={r.key} className={`dv-rc${r.kind === "travel" ? " wide" : ""}`} id={`dvr-${r.key}`}>
              <ReservationCard row={r} cards={cards} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
