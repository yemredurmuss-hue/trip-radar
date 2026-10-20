// Gün gün (plan v30, the Plan's third way to read; drawn in docs/mockups/plan-v30, spec "Gün gün (planın görünümü)"):
// ONE COMPACT ROW A DAY. The date box (month, day, weekday, "Gün N", the look of "Yolculuk sırasıyla"), then that day's
// flights, transport and dated things to do, each with its stage (Arıyoruz · Seçildi · Rezerve · Ayarlandı) and its
// time, then "Gece: Kyoto · Gion Machiya Evi" (or "konaklama aranıyor"); a day with nothing says "Serbest gün ·
// yapılacaklardan seç". Each line is titled by the code in one standard (satır standardı v2, dayRowTitle.ts). A line's
// time can be set by hand and its place in the day moved (drag or ↑ ↓); a tap on it shows its card on the Plan.
// Insurance, the eSIM and a visa aren't part of a day: they stay in Plan → Diğer. This is Kompakt, the default;
// Liste and Kartlar (the photo, the strip of days, the day's reservations) are DayViews.tsx.
import { heldStay } from "../../lib/plan";
import { LegBody } from "../LegRow";
import { createContext, Fragment, useContext, useMemo, useState, type ReactNode } from "react";
import { dayCards, dayLinesOf, isAsideRow, isPlanRow, rowKind, stageOf, undatedStops, type DayCard, type UndatedStop } from "../../lib/dayCards";
import { cardKindColor } from "../../lib/cardKinds";
import { rowIcon, rowItem, rowTitle, simpleName, titleText, withLayovers, withMeetings, type Place, type RowTitle } from "../../lib/dayRowTitle";
import { BookedBadge } from "../cards/BookedBadge";
import { CardEnvContext } from "../cards/PlanCard";
import { WhoAvatar, usePhotoOf, useWhoCtx } from "../cards/WhoseBadge";
import { whoseOf } from "../../lib/whose";
import { RowGlyph } from "./RowGlyph";
import { mainPlaceOf, type MainPlace } from "../../lib/destinations";
import { formatDateRange } from "../../lib/items";
import { L, locale } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { movedOrder } from "../../lib/dayCards";
import { insertAtDay, type InsertAt } from "../../lib/templates";
import { updateTrip } from "../actions";
import type { RentalEntry, StayEntry, TimelineSection } from "../../lib/timeline";
import { dateBox } from "../../lib/storyDates";
import type { Item, Listing } from "../../lib/types";
import { saveArrival } from "../../lib/userEdits";
import { journeyDay } from "../../lib/dayView";
import { JourneyDay } from "./JourneyDay";
import type { LegCardFor, RenderGroup, SettledFor } from "../Timeline";
import { liveLine } from "../../lib/flightData";
import type { Plan } from "../../lib/plan";
import { DayButton } from "../ideas/DayPicker";

export interface DayCardsProps {
  sections: TimelineSection[];
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  rentals: RentalEntry[];
  /** Shows a block of the plan (its card, with every action): an entry's key, or "item:ID". */
  onShow: (key: string) => void;
  tripId: string;
  /** The traveller's own times, by row key. */
  times?: Record<string, string>;
  /** The order the traveller gave each day's lines, by date (trip.dayOrder). */
  order?: Record<string, string[]>;
  /** Lines with a time moved by hand, off the clock (trip.dayLoose). */
  loose?: string[];
  /** The hero's main places (destinations.ts): a route reads "Porto → Madeira", not "Porto → Funchal". */
  mainPlaces?: MainPlace[];
  /** The Plan's own cards (their ticket, transfer and booking cards), for the journey day and the day's reservations. */
  cards: DayPlanCards;
  /** The city's photo (the trip's), null when there is none yet: Liste and Kartlar' day photo. */
  cityImage?: (city: string | null) => string | null;
  /** The trip's records and plan, for each stop's "Tarihsiz" (lib/dayCards undatedStops). */
  undated?: { items: Item[]; plan: Pick<Plan, "range" | "stayBlocks" | "closed"> };
}

/** The Plan's own cards, so a day's journey and reservations show each thing as the Plan does. */
export interface DayPlanCards {
  legCard: LegCardFor;
  renderGroup: RenderGroup;
  settled: SettledFor;
}

/** A city as its main place, for the lines' routes (display only; the plan keeps its places). */
export const PlaceCtx = createContext<Place>((c) => c);
/** Whose a record is (kişiye özel rezervasyon): its owners by name, null for everyone's. */
export const OwnersCtx = createContext<(item: Item) => string[] | null>(() => null);
export const useOwners = () => useContext(OwnersCtx);
/** A day's lines with their layovers and meet-ups (two people landing at the same airport on their own flights). */
export const withAside = (lines: DayRow[], ownersOf: (item: Item) => string[] | null) => withMeetings(withLayovers(lines), ownersOf);
export const usePlace = () => useContext(PlaceCtx);

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
export const dateText = (c: DayCard) => `${formatDateRange(c.date, null)} ${weekday(c.date)}`;
const time = (r: DayRow) => (r.time ? `${r.estimated ? "~" : ""}${r.time}` : "");

/** The stay that holds the night of a day (its check-in day up to the day before check-out), for the "Gece:" line. */
export function nightStay(card: DayCard, stays: Map<string, StayEntry>): StayEntry | null {
  for (const st of stays.values()) if (st.block.range.start <= card.date && card.date < st.block.range.end) return st;
  return null;
}

/** The date box of a day: month, day, weekday and the trip's day ("Gün 3"), as in "Yolculuk sırasıyla". */
export function DayBox({ card }: { card: DayCard }) {
  const n = card.dayNo?.match(/\d+/)?.[0] ?? null;
  const b = dateBox(card.date, null);
  if (!b)
    return (
      <span className="dg-date nd">
        <span>{L("Gün", "Day")}</span>
        <b>{n ?? "·"}</b>
      </span>
    );
  return (
    <span className="dg-date" title={dateText(card)}>
      <span>{b.month}</span>
      <b>{b.day}</b>
      <small>{b.weekday}</small>
      {n && <i className="dg-no">{L(`Gün ${n}`, `Day ${n}`)}</i>}
    </span>
  );
}

const Bed = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20" />
  </svg>
);
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** "Gece: Kyoto · Gion Machiya Evi"; a night with no stay chosen says so; the day the trip ends, "Eve dönüş". */
export function NightLine({ card, stays }: { card: DayCard; stays: Map<string, StayEntry> }) {
  const place = usePlace();
  const st = nightStay(card, stays);
  if (!st && card.role === "departure")
    return (
      <span className="dg-n dg-home">
        <Check />
        {L("Eve dönüş", "Back home")}
      </span>
    );
  const cityName = card.city ?? st?.block.city ?? null;
  if (!st && !cityName) return null;
  const city = cityName ? place(cityName) : null;
  // An open night has no stay yet: it says it's still being looked for (its entry's title is only the dates).
  const held = st ? heldStay(st.block) : null;
  const name = !held ? L("konaklama aranıyor", "still looking for a stay") : simpleName(held.name, "stay");
  return (
    <span className="dg-n" title={[city, name].filter(Boolean).join(" · ")}>
      <Bed />
      <span className="dg-nt">
        {L("Gece", "Night")}: {city && <b>{city}</b>}
        {city && " · "}
        {name}
      </span>
    </span>
  );
}

/** The stage on a line's right, in the Plan's words and colours. */
export function Stage({ row }: { row: DayRow }) {
  const s = stageOf(row);
  return s ? <span className={`dg-lab ${s.tone}`}>{s.badge ? <BookedBadge look={s.badge.look} as={s.badge.as} small /> : s.text}</span> : null;
}

/** Lines of this day still to book, decide or plan: said once, in the foot (a count the old view had). */
export function Left({ card }: { card: DayCard }) {
  // Insurance and the eSIM aren't part of the day: not its to-dos either.
  const left = card.rows.filter((r) => isPlanRow(r) && !isAsideRow(r) && r.state !== "done" && r.state !== "info").length;
  if (!left) return null;
  return (
    <span className="dg-left" title={L("Bu günde rezerve edilecek, karar verilecek ya da planlanacak satırlar", "Lines of this day to book, decide or plan")}>
      {L(`${left} satır bekliyor`, `${left} waiting`)}
    </span>
  );
}

export const AddDay = ({ card, onAdd }: { card: DayCard; onAdd: DayCardsProps["onAdd"] }) => (
  <button type="button" className="dg-add" aria-label={L(`${formatDateRange(card.date, null)}: bu güne ekle`, `${formatDateRange(card.date, null)}: add to this day`)} onClick={() => onAdd(insertAtDay(card.date, card.city))}>
    + <span>{L("Bu güne ekle", "Add to this day")}</span>
  </button>
);

/** What a view of the days needs around them: the main places' names for a route, whose a record is. */
export function DayProviders({ mainPlaces, children }: { mainPlaces?: MainPlace[]; children: ReactNode }) {
  const place = useMemo<Place>(() => (c) => (mainPlaces?.length ? (mainPlaceOf(mainPlaces, c) ?? c) : c), [mainPlaces]);
  const env = useContext(CardEnvContext);
  const who = useWhoCtx();
  const ownersOf = useMemo(() => (item: Item) => (env ? (whoseOf(item, env.trip, who)?.names ?? null) : null), [env, who]);
  return (
    <PlaceCtx.Provider value={place}>
      <OwnersCtx.Provider value={ownersOf}>{children}</OwnersCtx.Provider>
    </PlaceCtx.Provider>
  );
}

/** The stays by their nights' first day, for each day's "Gece:" line. */
export const staysOf = (sections: TimelineSection[]) => new Map<string, StayEntry>(sections.flatMap((s) => (s.kind === "city" ? s.stays.map((st) => [st.key, st] as [string, StayEntry]) : [])));

/** The days, a row each, in order (Kompakt); under each stop's last day its "Tarihsiz". */
export function CompactDays(props: DayCardsProps) {
  // Every free day is its own row (merge: false): the trip's days are the rows.
  const cards = dayCards(props.sections, { rentals: props.rentals, listings: props.listings, times: props.times, merge: false });
  const stays = staysOf(props.sections);
  const undated = undatedOf(cards, props);
  return (
    <DayProviders mainPlaces={props.mainPlaces}>
      <div className="dg" aria-label={L("Gün gün", "Day by day")}>
        {cards.map((c) => (
          <Fragment key={c.key}>
            <DayRowCard card={c} stays={stays} isToday={c.date === props.today} {...props} />
            {undated.filter((u) => u.after === c.key).map((u) => <UndatedList key={u.key} stop={u} plan={props.undated!.plan} onShow={props.onShow} />)}
          </Fragment>
        ))}
      </div>
    </DayProviders>
  );
}

/** Each stop's "Tarihsiz" for these days. */
export function undatedOf(cards: DayCard[], props: Pick<DayCardsProps, "undated">): UndatedStop[] {
  return props.undated ? undatedStops(cards, props.undated.items, props.undated.plan) : [];
}

/**
 * "Tarihsiz" under a stop's days (0.38.7): what is on its plan with no day of its own, a plain line each, no date given
 * (its name shows its card on the Plan, "+ Gün" puts it on a day). Not a box above the days.
 */
export function UndatedList({ stop, plan, onShow }: { stop: UndatedStop; plan: Pick<Plan, "range" | "stayBlocks">; onShow: (key: string) => void }) {
  return (
    <section className="dg-und" aria-label={stop.city ? L(`${stop.city}: tarihsiz`, `${stop.city}: no date`) : L("Tarihsiz", "No date")}>
      <p className="dg-und-h">
        <b>{L("Tarihsiz", "No date")}</b>
        {stop.city && <span>{stop.city}</span>}
      </p>
      <ul className="dg-und-list">
        {stop.items.map((i) => (
          <li key={i.id} className="dg-und-row" data-item-id={i.id}>
            <button type="button" className="dg-und-name" onClick={() => onShow(`item:${i.id}`)}>
              {i.name}
            </button>
            {i.status === "booked" && <BookedBadge look="booked" as={i.category === "activity" ? "ticket" : undefined} small />}
            <DayButton item={i} plan={plan} pooled />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A day: its date box, then its card (lines in order, the night, or the free day's word). */
function DayRowCard({ card, stays, isToday, ...props }: { card: DayCard; stays: Map<string, StayEntry>; isToday: boolean } & DayCardsProps) {
  // The day's lines (insurance and the eSIM aren't among them), a layover between two connecting flights.
  const lines = dayLines(card, props);
  const flow = withAside(lines, useOwners());
  const dnd = useReorder(lines, card.date, props.tripId);
  // A day that changes city: its way, from check-out to check-in, can be opened as one card under the lines.
  const journey = journeyDay(card, flow);
  const [trip, setTrip] = useState(false);
  return (
    <section className={`dg-day${isToday ? " today" : ""}`} id={`dcd-${card.key}`} aria-label={`${card.dayNo ?? ""} ${card.title}`}>
      <div className="dg-d">
        <DayBox card={card} />
      </div>
      <div className="dg-b">
        {flow.length > 0 && (
          <ol className="dg-tl">
            {flow.map((r) => (
              <DayLine key={r.key} row={r} onTap={() => props.onShow(r.entry?.key ?? r.stayKey ?? r.key)} tripId={props.tripId} dnd={lines.includes(r) ? dnd(r) : undefined} />
            ))}
          </ol>
        )}
        {journey && trip && <JourneyDay journey={journey} card={card} cards={props.cards} onShow={props.onShow} tripId={props.tripId} />}
        <div className="dg-foot">
          {isToday && <span className="dg-today">{L("Bugün", "Today")}</span>}
          <NightLine card={card} stays={stays} />
          <Left card={card} />
          {journey && (
            <button type="button" className="dg-trip" aria-expanded={trip} onClick={() => setTrip(!trip)}>
              {L("Yolculuk günü", "Travel day")}
            </button>
          )}
          <AddDay card={card} onAdd={props.onAdd} />
        </div>
        {flow.length === 0 && <span className="dg-free">{L("Serbest gün · yapılacaklardan seç", "Free day · pick from the to-dos")}</span>}
      </div>
    </section>
  );
}

const isInfo = (r: DayRow) => !isPlanRow(r) && r.kind !== "idea";

/** NE in bold · HANGİSİ: a line's title in the standard. */
const Title = ({ t }: { t: RowTitle }) => (
  <span className="dg-ttl">
    <b className="dg-what">{t.what}</b>
    {t.which && <span className="dg-which"> · {t.which}</span>}
  </span>
);

/**
 * A line of the day: its icon, NE · HANGİSİ, the grey word (and a time, tap it to set one), whose it is, its stage on the
 * right; a flight's live data, "İniş saati?" and a late-time warning under it. A tap on the title shows its card.
 */
export function DayLine({ row, onTap, tripId, dnd }: { row: DayRow; onTap: () => void; tripId: string; dnd?: Dnd }) {
  const place = usePlace();
  const t = rowTitle(row, place);
  const kind = rowKind(row);
  // A transfer or a change of city has no card of its own on the Plan until it has a plan: its way to go (Metro, Taksi…),
  // what's easy to miss and "Gerek yok" open right under its line (the leg's own body), as the day's cards had them.
  const env = useContext(CardEnvContext);
  const [legOpen, setLegOpen] = useState(false);
  const inline = Boolean(row.leg && env && row.kind === "leg");
  if (row.layover)
    return (
      <li className="dg-i quiet" data-title={titleText(t)}>
        <span className="dg-main static">
          <span className="dg-ic" aria-hidden>
            <RowGlyph name="clock" />
          </span>
          <Title t={t} />
        </span>
        <span className="dg-meta">
          <TimeCell row={row} tripId={tripId} />
        </span>
      </li>
    );
  // Short (0.36.27): where a worked-out time comes from is on the time, on hover.
  const sub = shortDetail(t.detail);
  return (
    <li className={`dg-i${row.kind === "idea" ? " idea" : isInfo(row) ? " info quiet" : ""}${dnd?.cls ?? ""}`} data-title={titleText(t)} {...dnd?.li}>
      {dnd?.grip}
      <button type="button" className="dg-main" aria-expanded={inline ? legOpen : undefined} onClick={inline ? () => setLegOpen(!legOpen) : onTap} title={`${titleText(t)}${sub ? ` · ${sub}` : ""}`}>
        <span className="dg-ic" style={{ ["--k" as string]: cardKindColor(kind) }} aria-hidden>
          <RowGlyph name={rowIcon(row, place)} />
        </span>
        <Title t={t} />
      </button>
      <span className="dg-meta">
        {sub && <small className="dg-sub">{sub}</small>}
        <TimeCell row={row} tripId={tripId} />
        <Faces row={row} />
      </span>
      <Stage row={row} />
      {inline && legOpen && row.leg && env && (
        <div className="dg-leg">
          <LegBody leg={row.leg} tripId={tripId} onOpenItem={env.onOpenItem} onRemove={env.remove} />
          <button type="button" className="dg-leg-plan" onClick={onTap}>
            {L("Plan'da göster", "Show on the Plan")}
          </button>
        </div>
      )}
      <LiveLine row={row} />
      <ArrivalAsk row={row} />
      <RowWarn row={row} tripId={tripId} />
    </li>
  );
}

/** A line's warning ("17:40'ta havalimanında olmalısın") with the way to take back the time set by hand. */
export function RowWarn({ row, tripId }: { row: DayRow; tripId: string }) {
  if (!row.warn) return null;
  return (
    <p className="dg-warn">
      {row.warn}
      {(row.user || row.ownTime) && (
        <>
          {" "}
          <button type="button" className="link-btn" onClick={() => void clearOwnTime(tripId, row.key)}>
            {row.ownTime ? L("Elle girileni sil", "Remove the time set by hand") : L("Hesaplanan saate dön", "Back to the worked-out time")}
          </button>
        </>
      )}
    </p>
  );
}

/**
 * A line's time: "~" when worked out (why on hover), plain when fixed or set by the traveller. A tap lets them
 * set their own (the rest of the day follows it); "×" gives it back to the plan.
 */
export function TimeCell({ row, tripId }: { row: DayRow; tripId: string }) {
  const [edit, setEdit] = useState(false);
  const place = usePlace();
  // A layover's time is its first flight's landing: nothing to set.
  if (row.layover || row.meeting) return <span className="t">{row.time}</span>;
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
          aria-label={L(`${titleText(rowTitle(row, place))}: saat`, `${titleText(rowTitle(row, place))}: time`)}
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
      aria-label={time(row) ? undefined : L(`${titleText(rowTitle(row, place))}: saat ver`, `${titleText(rowTitle(row, place))}: set a time`)}
      onClick={() => setEdit(true)}>
      {/* No time: blank (a tap still gives one), or in words when it can't be a clock ("varıştan sonra", "gece ~00:45"). */}
      {time(row) || (row.hint ? <small className="t-hint">{row.hint}</small> : null)}
    </button>
  );
}

/**
 * The list's grey line, short (0.36.27, Emre: "daha mini infolar"): the route the title already says goes ("Porto
 * Campanhã → Lisboa Santa Apolónia"), and so does a worked-out time's reason (it's on the time, on hover); two
 * pieces at most: "varış 16:04 · 1 seçenek", "planlanmadı", "3 gece · yer seçilmedi".
 */
function shortDetail(detail: string): string {
  return detail
    .split(" · ")
    .filter((p) => p && !p.includes("→") && !/^(Varış|Arrives) \d/.test(p))
    .slice(0, 2)
    .join(" · ");
}

/** Whose a line is, on its right (kişiye özel rezervasyon): their faces; a meet-up shows everyone meeting. */
function Faces({ row }: { row: DayRow }) {
  const ownersOf = useOwners();
  const photoOf = usePhotoOf();
  const item = rowItem(row);
  const names = row.meeting ? row.meeting.who.flatMap((w) => w.names) : item ? ownersOf(item) : null;
  if (!names?.length) return null;
  return (
    <span className="dg-who" aria-hidden>
      {names.slice(0, 3).map((n) => (
        <WhoAvatar key={n} name={n} photo={photoOf(n)} />
      ))}
    </span>
  );
}

/** A time set by hand taken back: the plan's own again (as the time cell's ×). */
const clearOwnTime = (tripId: string, key: string) =>
  updateTrip(
    tripId,
    (t) => {
      const own = { ...(t.dayTimes ?? {}) };
      delete own[key];
      return { ...t, dayTimes: own };
    },
    { touch: false },
  );

/**
 * The flight's real data under its line (0.36.15): "Rötar 25 dk · Terminal 1 · Kapı D5 · Bant 4", red when
 * it's late, cancelled or diverted; the source named (AeroDataBox's free plan asks for it).
 */
function LiveLine({ row }: { row: DayRow }) {
  const live = liveLine(ticketOf(row)?.flightLive);
  if (!live) return null;
  return (
    <p className={`dg-live${live.alert ? " alert" : ""}`}>
      {live.text}
      <small> · {L("Veri: AeroDataBox", "Data: AeroDataBox")}</small>
    </p>
  );
}

/** The flight's ticket (the travel line's settled flight). */
const ticketOf = (row: DayRow): Item | null => {
  const t = row.kind === "travel" && row.entry?.kind === "travel" ? row.entry.travel : null;
  return t?.settled ?? (t?.items.length === 1 ? t.items[0] : null);
};

/**
 * "İniş saati?" on a flight whose page didn't say when it lands (0.36.13): the traveller types it from their
 * ticket, and the transfer and the check-in after it are worked out from it.
 */
export function ArrivalAsk({ row }: { row: DayRow }) {
  const [open, setOpen] = useState(false);
  const item = ticketOf(row);
  if (!item?.flight?.departure || item.flight.arrival) return null;
  const name = item.flight.flightNumber ?? item.name;
  const air = item.category === "flight";
  return open ? (
    <span className="dg-arrive">
      <input
        type="time"
        autoFocus
        aria-label={air ? L(`${name}: iniş saati`, `${name}: landing time`) : L(`${name}: varış saati`, `${name}: arrival time`)}
        onBlur={(e) => {
          if (e.target.value) void saveArrival(item, e.target.value);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </span>
  ) : (
    <button type="button" className="dg-arrive link-btn" onClick={() => setOpen(true)} title={L("Biletindeki iniş saati: aktarma ve check-in buna göre hesaplanır", "The landing time on your ticket: the transfer and check-in are worked out from it")}>
      {air ? L("İniş saati?", "Landing time?") : L("Varış saati?", "Arrival time?")}
    </button>
  );
}


// --- the day's order (0.35.6) ------------------------------------------------------------------------

/**
 * The day's lines in their order (the timed by the clock, the rest where put). Insurance, the eSIM and a visa
 * aren't part of a day (satır standardı v2): they stay in Plan → Diğer.
 */
export const dayLines = (card: DayCard, props: Pick<DayCardsProps, "times" | "order" | "loose">): DayRow[] => dayLinesOf(card, props);

/** What a line needs to be moved: its grip, its drop handlers, its class while dragged over. */
export interface Dnd {
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
export function useReorder(rows: DayRow[], date: string, tripId: string): (row: DayRow) => Dnd {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; after: boolean } | null>(null);
  const place = usePlace();
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
        className="dg-grip"
        draggable
        aria-label={L(`${titleText(rowTitle(row, place))}: sırasını değiştir`, `${titleText(rowTitle(row, place))}: move`)}
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
