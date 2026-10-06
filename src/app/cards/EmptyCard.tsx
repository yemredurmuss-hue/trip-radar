// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md, docs/mockups/2026-10-06-bos-kartlar-v1.html): the approved
// plan card made plain while a need has nothing booked or saved. The same top line (ring · kind and its colour ·
// date | •••), the same body (a trip: city — its drawing — city; a stay, an activity, an eSIM: the drawing's tile
// and the name), on a white ground in a dashed frame, the cities a size smaller, the drawing faint, no price and
// no action button. The bottom line: one grey word where it stands, then "Ara:" and the brands' searches.
// The board picks this card or the full one (TripPanel's Plan cards); the full card is untouched.
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { cardKindColor, cardKindLabel, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { legCardView, legEnd, legMenuFor, topDate, transportFace, type End } from "../../lib/cardView";
import { needKey, rangeText, type ActivityGap } from "../../lib/emptyCards";
import { countryNames, nPeople } from "../../lib/heroInfo";
import { L } from "../../lib/i18n";
import { locative, nNights } from "../../lib/i18nText";
import { formatDateRange, formatPrice, isoDate, nightsBetween } from "../../lib/items";
import { legItem, withLegChoice, type Leg } from "../../lib/legs";
import type { Need } from "../../lib/offerSource";
import type { StayBlock } from "../../lib/plan";
import { activityLinks, BRANDS, esimLinks, flightLinks, stayLinks, transferLinks, type SearchLink } from "../../lib/searchLinks";
import type { Item, Suggestion } from "../../lib/types";
import { setHidden, setItemStatus, updateTrip } from "../actions";
import { kindLabel, LegBody } from "../LegRow";
import { CardMenu, DeleteX, Ring, type MenuEntry } from "./CardShell";
import { useEmptyEnv } from "./emptyEnv";
import { Editable, InlineEdit } from "./InlineEdit";
import { OfferRow } from "./OfferRow";
import { useCardEnv } from "./PlanCard";
import { KindIcon, MediaSilhouette, TransportArt } from "./Silhouettes";
import { StayLine } from "./StayLine";

/** "Ara: [G] Google Flights [S] Skyscanner [K] Kayak": the brand's letter on its colour, drawn here (nothing fetched). */
export function SearchRow({ links }: { links: SearchLink[] }) {
  if (!links.length) return null;
  return (
    <span className="ek-find">
      <span className="ek-ara">{L("Ara:", "Search:")}</span>
      {links.map((l) => (
        <a key={l.url} className="ek-link" data-brand={l.brand} href={l.url} target="_blank" rel="noopener noreferrer"
          title={L(`${l.label} · yeni sekmede açılır`, `${l.label} · opens in a new tab`)}>
          <span className="ek-lg" style={{ background: BRANDS[l.brand].color }} aria-hidden>
            {BRANDS[l.brand].letter}
          </span>
          {l.label}
        </a>
      ))}
    </span>
  );
}

/** One end of a trip, a size smaller than the full card's; an end not known yet reads faint. */
function Stop({ end, right, missing }: { end: End | null; right: boolean; missing: string }) {
  return (
    <span className={`ek-end${right ? " r" : ""}`}>
      {end ? <b>{end.city}</b> : <b className="ek-missing">{missing}</b>}
      {end?.sub && <small>{end.sub}</small>}
    </span>
  );
}

/** A trip's body: city — the way of travel drawn faint and small — city. */
export function EmptyRoute({ from, to, art }: { from: End | null; to: End | null; art: TransportMode | null }) {
  return (
    <div className="ek-route">
      <Stop end={from} right={false} missing={L("Nereden", "From")} />
      <span className="ek-sil" aria-hidden>
        {art && <TransportArt mode={art} />}
      </span>
      <Stop end={to} right missing={L("Nereye", "To")} />
    </div>
  );
}

/** A stay's, an activity's, an eSIM's body: the drawing's tile and the name, a grey line under it. */
export function EmptyMedia({ kind, drawing, title, sub }: { kind: CardKind; drawing?: "ticket" | "esim" | null; title: ReactNode; sub: ReactNode }) {
  return (
    <div className="ek-media">
      <span className="ek-tile" aria-hidden>
        {drawing ? <MediaSilhouette name={drawing} /> : <KindIcon kind={kind} size={26} />}
      </span>
      <span className="ek-txt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

export function EmptyShell(props: {
  kind: CardKind;
  label?: string;
  date: ReactNode;
  ariaLabel: string;
  itemId?: string;
  domId?: string;
  extraClass?: string;
  menu: MenuEntry[];
  /** The hover × (a record's: deletes with "Geri al"; empty nights': hides them). */
  x?: ReactNode;
  body: ReactNode;
  status: string;
  links: SearchLink[];
  /** "Gerek yok" at the end of the bottom line (stays, transfers, eSIM). */
  onSkip?: () => void;
  skipTitle?: string;
  /** A transfer opens like the full card (how to go, what's easy to miss). */
  open?: boolean;
  onToggle?: () => void;
  detail?: ReactNode;
  /** The offers' row under the card (drawn only with a data source connected). */
  need?: Need | null;
  data?: Record<string, string>;
}) {
  const style = { "--mc": cardKindColor(props.kind) } as CSSProperties;
  const tap = (e: MouseEvent) => {
    if (!props.onToggle || (e.target as HTMLElement).closest("button, a, input, select, label, .pk-detail, .pk-menu, .pk-doclist")) return;
    props.onToggle();
  };
  const toggle = props.onToggle;
  return (
    <>
      <article
        className={`pk-card ek-card${props.open ? " pk-open" : ""}${toggle ? "" : " ek-still"}${props.extraClass ? ` ${props.extraClass}` : ""}`}
        style={style}
        aria-label={props.ariaLabel}
        data-item-id={props.itemId}
        id={props.domId}
        onClick={tap}
        {...props.data}
      >
        <div className="pk-top">
          <Ring state="open" />
          <span className="pk-kind">
            <KindIcon kind={props.kind} size={15} />
            {props.label ?? cardKindLabel(props.kind)}
          </span>
          {props.date && <span className="pk-date">· {props.date}</span>}
          <span className="pk-end">
            {props.x}
            <CardMenu entries={props.menu} />
          </span>
        </div>
        {toggle ? (
          <div className="pk-body ek-body" role="button" tabIndex={0} aria-expanded={Boolean(props.open)}
            aria-label={props.open ? L(`${props.ariaLabel}: ayrıntıyı kapat`, `${props.ariaLabel}: close details`) : L(`${props.ariaLabel}: ayrıntı`, `${props.ariaLabel}: details`)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
            {props.body}
          </div>
        ) : (
          <div className="pk-body ek-body">{props.body}</div>
        )}
        <div className="ek-foot">
          <span className="ek-state">{props.status}</span>
          <SearchRow links={props.links} />
          {props.onSkip && (
            <button type="button" className="ek-skip" title={props.skipTitle} onClick={(e) => { e.stopPropagation(); props.onSkip!(); }}>
              {L("Gerek yok", "Not needed")}
            </button>
          )}
        </div>
        {props.open && props.detail}
      </article>
      {props.need && <OfferRow key={props.need.key} need={props.need} />}
    </>
  );
}

const withPeople = (word: string, n: number | null) => (n ? `${word} · ${nPeople(n)}` : word);
const noTicket = (n: number | null) => withPeople(L("Bilet yok", "No ticket"), n);

/**
 * A record with nothing chosen for it yet: a flight the start made room for or one said in the chat without a
 * real flight, a stay the start made. Its ••• keeps what the full card could do ("Bileti aldım", "Düzenle", "Sil").
 */
export function EmptyRecordCard({ item }: { item: Item }) {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const n = travellers ?? item.guests.adults ?? null;
  const menu: MenuEntry[] = [
    ...(item.category === "flight" ? [{ label: L("Bileti aldım", "I got the ticket"), run: () => void setItemStatus(item, "booked") }] : []),
    ...(item.origin === "chat" ? [{ label: L("Düzenle", "Edit"), run: () => env.edit(item) }] : []),
    { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true },
  ];
  const x = <DeleteX name={item.name} onDelete={() => env.remove(item)} />;
  if (item.category === "stay") {
    const start = isoDate(item.dates.start);
    const end = isoDate(item.dates.end);
    const nights = start && end ? nightsBetween(start, end) : 0;
    return (
      <EmptyShell
        kind="stay"
        date={start ? formatDateRange(start, end) : null}
        ariaLabel={item.name}
        itemId={item.id}
        menu={menu}
        x={x}
        body={<EmptyMedia kind="stay" title={item.city ?? item.name} sub={[nights ? nNights(nights) : null, n ? nPeople(n) : null, L("otel seçilmedi", "no hotel chosen")].filter(Boolean).join(" · ")} />}
        status={L("Yer yok", "No place yet")}
        links={stayLinks({ city: item.city, checkin: start, checkout: end, adults: n })}
        need={{ key: needKey("stay", item.city, start, end), section: "stay", kind: "stay", city: item.city, start, end, adults: n }}
      />
    );
  }
  const face = transportFace(item, "flight", env.legEnds.get(item.id));
  const day = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  const from = item.flight?.from ?? null;
  const to = item.flight?.to ?? item.city ?? null;
  return (
    <EmptyShell
      kind="flight"
      date={topDate(item, "flight")}
      ariaLabel={item.name}
      itemId={item.id}
      menu={menu}
      x={x}
      body={<EmptyRoute from={face.from} to={face.to ?? (to ? { city: to, sub: null, time: null } : null)} art="flight" />}
      status={noTicket(n)}
      links={flightLinks({ from, to, date: day, adults: n })}
      need={to ? { key: needKey("flight", from, to, day), section: "flight", kind: "flight", from, to, start: day, adults: n } : null}
    />
  );
}

/** "Henüz eklenmedi": the way in or home with no flight saved at all, as the flight's empty card. */
export function EmptyTravelCard({ role, date, city }: { role: "arrival" | "departure"; date: string; city: string }) {
  const env = useCardEnv();
  const { travellers: n } = useEmptyEnv();
  const at = { city, sub: null, time: null };
  const [from, to] = role === "arrival" ? [null, at] : [at, null];
  return (
    <EmptyShell
      kind="flight"
      date={formatDateRange(date, null)}
      ariaLabel={role === "arrival" ? L(`Uçuş · ${city}`, `Flight · ${city}`) : L(`Dönüş · ${city}`, `Flight home · ${city}`)}
      menu={[{ label: L("Uçuş ekle", "Add a flight"), run: () => env.add({ city, date }) }]}
      body={<EmptyRoute from={from} to={to} art="flight" />}
      status={noTicket(n)}
      links={flightLinks(role === "arrival" ? { from: null, to: city, date, adults: n } : { from: city, to: null, date, adults: n })}
      need={role === "arrival" ? { key: needKey("flight", null, city, date), section: "flight", kind: "flight", to: city, start: date, adults: n } : { key: needKey("flight", city, null, date), section: "flight", kind: "flight", from: city, start: date, adults: n }}
    />
  );
}

/**
 * Nights with no place (a stay said apart with no hotel, or nights nothing covers): the stay's empty card.
 * A stay said apart keeps what it had: its name, city, dates and price edited where they stand, its × deletes;
 * empty nights' × and "Gerek yok" hide them.
 */
export function EmptyStayBlock({ block, label }: { block: Extract<StayBlock, { kind: "open" }>; label: string }) {
  const env = useCardEnv();
  const { travellers: n } = useEmptyEnv();
  const slot = block.slot ?? null;
  const city = slot?.city ?? block.city;
  const hide = () => env.hideNights(block.range, label);
  const nights = L(`${block.nights} gece`, `${block.nights} night${block.nights === 1 ? "" : "s"}`);
  const body = slot ? (
    <InlineEdit item={slot}>
      <EmptyMedia
        kind="stay"
        title={<Editable field="name">{slot.name}</Editable>}
        sub={
          <>
            <StayLine item={slot} /> · {nights} ·{" "}
            <Editable field="price">{slot.price.amount != null ? formatPrice(slot.price.amount, slot.price.currency) : null}</Editable>
          </>
        }
      />
    </InlineEdit>
  ) : (
    <EmptyMedia kind="stay" title={block.city ?? L("Konaklama", "Stay")} sub={[nights, n ? nPeople(n) : null, L("otel seçilmedi", "no hotel chosen")].filter(Boolean).join(" · ")} />
  );
  return (
    <EmptyShell
      kind="stay"
      date={formatDateRange(block.range.start, block.range.end)}
      ariaLabel={slot?.name ?? label}
      itemId={slot?.id}
      extraClass="stay-open"
      menu={slot ? [{ label: L("Sil", "Delete"), run: () => env.remove(slot), danger: true }] : [{ label: L("Gerek yok", "Not needed"), run: hide }]}
      x={slot ? <DeleteX name={slot.name} className="stay-x" onDelete={() => env.remove(slot)} /> : <DeleteX name={label} hide className="stay-x" onDelete={hide} />}
      body={body}
      status={L("Yer yok", "No place yet")}
      links={stayLinks({ city, checkin: block.range.start, checkout: block.range.end, adults: n })}
      onSkip={slot ? undefined : hide}
      skipTitle={L("Bu geceler için yer gerekmiyor", "No place needed for these nights")}
      need={city ? { key: needKey("stay", city, block.range.start, block.range.end), section: "stay", kind: "stay", city, start: block.range.start, end: block.range.end, adults: n } : null}
    />
  );
}

/** Where a transfer's end is, as a map would find it: the stay's address (else its name and city), the airport, the city. */
function endPlace(leg: Leg, side: "from" | "to"): string | null {
  const point = leg[side];
  if (point.item) return point.item.location.address ?? [point.item.name, point.item.city].filter(Boolean).join(", ");
  const hub = (leg.kind === "arrival" && side === "from") || (leg.kind === "departure" && side === "to");
  if (hub) return legEnd(leg, side).city;
  return point.city ?? point.label;
}

/** A transfer or change of city with nothing said for it: how to go is open; tapped, the full card's choices. */
export function EmptyLegCard({ leg }: { leg: Leg }) {
  const env = useCardEnv();
  const { travellers: n } = useEmptyEnv();
  const [open, setOpen] = useState(false);
  const v = legCardView(leg);
  const own = legItem(leg);
  const hide = () => void setHidden(env.tripId, `leg:${leg.key}`, true, kindLabel()[leg.kind]);
  const menu: MenuEntry[] = legMenuFor(leg).map((a) =>
    a === "hide"
      ? { label: L("Gerek yok", "Not needed"), run: hide }
      : a === "clear"
        ? { label: L("Planı temizle", "Clear the plan"), run: () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg.key, null)) }
        : { label: L("Sil", "Delete"), run: () => own && env.remove(own), danger: true },
  );
  const move = leg.kind === "move";
  const from = endPlace(leg, "from");
  const to = endPlace(leg, "to");
  return (
    <EmptyShell
      kind={v.kind}
      label={v.label}
      date={formatDateRange(leg.date, null)}
      ariaLabel={v.ariaLabel}
      domId={`leg-${leg.key}`}
      extraClass="pk-leg"
      menu={menu}
      body={<EmptyRoute from={move ? { ...v.from, sub: null } : v.from} to={move ? { ...v.to, sub: null } : v.to} art={v.kind !== "transport" ? v.kind : move ? null : "taxi"} />}
      status={L("Nasıl gideceğin belli değil", "How you'll go isn't decided")}
      links={transferLinks({ from, to })}
      onSkip={move ? undefined : hide}
      skipTitle={L("Bu transfer gerekmiyor", "This transfer isn't needed")}
      open={open}
      onToggle={() => setOpen(!open)}
      detail={
        <div className="pk-detail">
          <LegBody leg={leg} tripId={env.tripId} onOpenItem={env.onOpenItem} onRemove={env.remove} />
        </div>
      }
      need={to ? { key: needKey("transfer", from, to, leg.date), section: "transport", kind: "transfer", from, to, start: leg.date, adults: n } : null}
    />
  );
}

/** Diğer's eSIM while there's none on a trip abroad (the rule's suggestion, drawn as the eSIM's empty card). */
export function EmptyEsimCard({ suggestion, onAdd, onDismiss }: { suggestion: Suggestion; onAdd: (s: Suggestion) => void; onDismiss: (s: Suggestion) => void }) {
  const { esimCountries } = useEmptyEnv();
  const names = countryNames(esimCountries);
  const start = isoDate(suggestion.payload?.start ?? null);
  const end = isoDate(suggestion.payload?.end ?? null);
  const title = names.length ? `eSIM · ${names.join(", ")}` : suggestion.title;
  return (
    <EmptyShell
      kind="esim"
      date={start ? formatDateRange(start, end) : null}
      ariaLabel={title}
      data={{ "data-suggestion": suggestion.key }}
      menu={[
        { label: L("Plana ekle", "Add to plan"), run: () => onAdd(suggestion) },
        { label: L("Gerek yok", "Not needed"), run: () => onDismiss(suggestion) },
      ]}
      body={<EmptyMedia kind="esim" drawing="esim" title={title} sub={L("tüm gezi için internet", "internet for the whole trip")} />}
      status={L("Alınmadı", "Not bought")}
      links={esimLinks(esimCountries[0])}
      onSkip={() => onDismiss(suggestion)}
      skipTitle={L("eSIM gerekmiyor", "No eSIM needed")}
      need={esimCountries[0] ? { key: needKey("esim", esimCountries[0]), section: "other", kind: "esim", country: esimCountries[0], start, end } : null}
    />
  );
}

/** Etkinlikler's empty card for a city with nothing booked there yet: "Amsterdam'da tur ve bilet". */
export function EmptyActivityCard({ gap }: { gap: ActivityGap }) {
  const env = useCardEnv();
  const title = L(`${locative(gap.city)} tur ve bilet`, `Tours and tickets in ${gap.city}`);
  return (
    <EmptyShell
      kind="activity"
      date={rangeText(gap.range)}
      ariaLabel={title}
      menu={[{ label: L("Etkinlik ekle", "Add an activity"), run: () => env.add({ city: gap.city, date: null }) }]}
      body={<EmptyMedia kind="activity" drawing="ticket" title={title} sub={L("tur, müze, gösteri · bilet gereken her şey", "tours, museums, shows · anything with a ticket")} />}
      status={L("Henüz yok", "None yet")}
      links={activityLinks(gap.city)}
      need={{ key: needKey("activity", gap.city, gap.range.start, gap.range.end), section: "activity", kind: "activity", city: gap.city, start: gap.range.start, end: gap.range.end }}
    />
  );
}
