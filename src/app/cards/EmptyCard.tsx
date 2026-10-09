// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md, docs/mockups/2026-10-06-bos-kartlar-v1.html): the approved
// plan card made plain while a need has nothing booked or saved. The same top line (ring · kind and its colour ·
// date | •••), the same body (a trip: city — its drawing — city; a stay, an activity, an eSIM: the drawing's tile
// and the name), on a white ground in a dashed frame, the cities a size smaller, the drawing faint, no price and
// no action button. The bottom line: one grey word where it stands, then "Ara:" and the brands' searches.
// The board picks this card or the full one (TripPanel's Plan cards); the full card is untouched.
import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { addDoc, DOC_ACCEPT } from "../../lib/docs";
import { dateAlert, type DateAlert } from "../../lib/progress";
import { useLegOpen } from "./legOpen";
import { cityOfAirport } from "../../lib/airports";
import { cardKind, cardKindColor, cardKindLabel, isTransportKind, RENTAL_MODES, type CardKind, type TransportMode } from "../../lib/cardKinds";
import { activityDrawing, footOf, legCardView, legEnd, legMenuFor, transportFace, type End, type MediaDrawing } from "../../lib/cardView";
import { needKey, rangeText, type ActivityGap } from "../../lib/emptyCards";
import { countryNames, nPeople } from "../../lib/heroInfo";
import { L } from "../../lib/i18n";
import { locative, nNights } from "../../lib/i18nText";
import { formatDateRange, formatPrice, isoDate, nightsBetween } from "../../lib/items";
import { legItem, withLegChoice, type Leg } from "../../lib/legs";
import { isOwnStay } from "../../lib/playbooks";
import type { Need } from "../../lib/offerSource";
import type { StayBlock } from "../../lib/plan";
import { activityLinks, airportCode, BRANDS, esimLinks, flightLinks, stayLinks, transferLinks, type SearchLink, insuranceLinks } from "../../lib/searchLinks";
import { countryOfPlace } from "../../lib/chatBooking";
import type { Item, Suggestion } from "../../lib/types";
import { fromOf } from "../../lib/tripSettings";
import { headCountOf, whoseOf } from "../../lib/whose";
import { useWhoCtx, WhoseBadge } from "./WhoseBadge";
import { setHidden, setItemStatus, updateTrip } from "../actions";
import { kindLabel, LegBody } from "../LegRow";
import { CardMenu, DeleteX, Ring, type MenuEntry } from "./CardShell";
import { useEmptyEnv } from "./emptyEnv";
import { Editable, InlineEdit, useInlineEdit } from "./InlineEdit";
import { CardDate } from "./CardDate";
import type { FieldKey } from "../../lib/inlineEdit";
import { isGeneratedName } from "../../lib/planned";
import { OfferRow } from "./OfferRow";
import { useCardEnv } from "./PlanCard";
import { AskButton } from "./AskButton";
import { KindIcon, MediaSilhouette, TransportArt } from "./Silhouettes";
import { StayLine } from "./StayLine";

/** "Ara: [G] Google Flights [S] Skyscanner [K] Kayak": the brand's letter on its colour, drawn here (nothing fetched). */
export function SearchRow({ links }: { links: SearchLink[] }) {
  if (!links.length) return null;
  return (
    <span className="ek-find">
      <span className="ek-ara">{L("Kendin ara", "Search yourself")}</span>
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

/**
 * One end of a trip, a size smaller than the full card's; an end not known yet reads faint. On a record's card
 * (inside InlineEdit) the city is edited where it stands, as on the full card ("Nereden", "Nereye").
 */
function Stop({ end, right, missing, field }: { end: End | null; right: boolean; missing: string; field?: FieldKey | null }) {
  const api = useInlineEdit();
  const editable = Boolean(field && api?.fields.includes(field));
  return (
    <span className={`ek-end${right ? " r" : ""}`}>
      {editable ? <b><Editable field={field!}>{end?.city}</Editable></b> : end ? <b>{end.city}</b> : <b className="ek-missing">{missing}</b>}
      {end?.sub && <small>{end.sub}</small>}
    </span>
  );
}

/** A trip's body: city — the way of travel drawn faint and small — city. */
export function EmptyRoute({ from, to, art, fields }: { from: End | null; to: End | null; art: TransportMode | null; fields?: [FieldKey | null, FieldKey | null] }) {
  return (
    <div className="ek-route">
      <Stop end={from} right={false} missing={L("Nereden", "From")} field={fields?.[0]} />
      <span className="ek-sil" aria-hidden>
        {art && <TransportArt mode={art} />}
      </span>
      <Stop end={to} right missing={L("Nereye", "To")} field={fields?.[1]} />
    </div>
  );
}

/** A stay's, an activity's, an eSIM's body: the drawing's tile and the name, a grey line under it. */
export function EmptyMedia({ kind, drawing, title, sub }: { kind: CardKind; drawing?: MediaDrawing | null; title: ReactNode; sub: ReactNode }) {
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
  /** Whose it is, after the kind (kişiye özel rezervasyon: WhoseBadge, nothing for everyone's). */
  badge?: ReactNode;
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
  /** A date running out (progress.dateAlert): the status word tinted, the days after it, the sentence on hover. */
  alert?: DateAlert | null;
  /** Hidden helpers inside the card (the file picker "Belge ekle" opens). */
  extra?: ReactNode;
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
          {props.badge}
          {props.date && <span className="pk-date">· {props.date}</span>}
          <span className="pk-end">
            <span className="pk-lab open">{L("Arıyoruz", "Searching")}</span>
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
          <span className={`ek-state${props.alert ? ` alert-${props.alert.tone}` : ""}`} title={props.alert?.text}>
            {props.status}
            {props.alert && <span className="ek-when"> · ⏳ {props.alert.short}</span>}
          </span>
          <SearchRow links={props.links} />
          <AskButton text={L(`${props.ariaLabel} için öneri bul`, `Find options for ${props.ariaLabel}`)} />
          {props.onSkip && (
            <button type="button" className="ek-skip" title={props.skipTitle} onClick={(e) => { e.stopPropagation(); props.onSkip!(); }}>
              {L("Gerek yok", "Not needed")}
            </button>
          )}
        </div>
        {props.open && props.detail}
        {props.extra}
      </article>
      {props.need && <OfferRow key={props.need.key} need={props.need} />}
    </>
  );
}

const withPeople = (word: string, n: number | null) => (n ? `${word} · ${nPeople(n)}` : word);
const noTicket = (n: number | null) => withPeople(L("Bilet yok", "No ticket"), n);

/**
 * A record with no concrete option yet (lib/emptyCards isEmptyRecord): what the start made room for (flights, stays,
 * the car) or a plan said in the chat or added from a tile with no shop, price, page or hour. Edited where it
 * stands like the full card (its ends, day, name); its ••• keeps what the full card's button did ("Bileti aldım",
 * "Rezerve ettim"…), "Düzenle" and "Sil".
 */
export function EmptyRecordCard({ item }: { item: Item }) {
  return (
    <InlineEdit item={item} only={["name", "from", "to", "city", "date", "end", "time"]}>
      <EmptyRecordFace item={item} />
    </InlineEdit>
  );
}

const STATUS_WORD = (kind: CardKind, n: number | null): string => {
  if (kind === "stay") return L("Henüz otel yok", "No place yet");
  if ((RENTAL_MODES as readonly string[]).includes(kind)) return L("Kiralanmadı", "Not rented");
  if (kind === "esim" || kind === "insurance") return L("Alınmadı", "Not bought");
  if (kind === "transport") return L("Alınmadı", "Not booked");
  return noTicket(n);
};

function EmptyRecordFace({ item }: { item: Item }) {
  const env = useCardEnv();
  const { travellers, esimCountries, trip, items } = useEmptyEnv();
  const who = useWhoCtx();
  // Kişiye özel rezervasyon: a plan for some of the trip is searched for them ("1 kişi"); an everyone's flight
  // counts out those with their own flight the same way.
  const total = travellers ?? item.guests.adults ?? null;
  const n = trip ? headCountOf(item, trip, { total, items, who }) : total;
  const whose = trip ? whoseOf(item, trip, who) : null;
  // A person's own flight leaves from where they come from.
  const ownFrom = whose?.names.length === 1 ? fromOf(trip?.travellers, whose.names[0]) : null;
  const kind = cardKind(item, env.legModes.get(item.id) ?? null);
  const action = footOf(item, kind).action;
  const picker = useRef<HTMLInputElement>(null);
  const menu: MenuEntry[] = [
    ...(action?.does === "book" ? [{ label: action.label, run: () => void setItemStatus(item, "booked") }] : []),
    ...(item.origin === "chat" ? [{ label: L("Düzenle", "Edit"), run: () => env.edit(item) }] : []),
    // What the full card's details offered: a file (a ticket's PDF makes it a full card), all its details.
    { label: L("Belge ekle", "Add a document"), run: () => picker.current?.click() },
    { label: L("Tüm detaylar", "All details"), run: () => env.onOpenItem(item) },
    { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true },
  ];
  const extra = (
    <input ref={picker} className="pk-file" type="file" accept={DOC_ACCEPT} multiple hidden
      onChange={async (e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        for (const file of files) await addDoc(item, file).catch((err: Error) => console.warn("Belge eklenemedi", err.message));
      }} />
  );
  const shell = {
    kind,
    ariaLabel: item.name,
    itemId: item.id,
    menu,
    x: <DeleteX name={item.name} onDelete={() => env.remove(item)} />,
    status: STATUS_WORD(kind, n),
    alert: dateAlert(item, env.today),
    extra,
    badge: trip ? <WhoseBadge item={item} trip={trip} /> : null,
  };
  const start = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  const end = isoDate(item.dates.end);
  if (kind === "stay") {
    const nights = start && end ? nightsBetween(start, end) : 0;
    const title = isGeneratedName(item.name) ? (item.city ?? item.name) : item.name;
    // A night on the boat, in the camp or the van (a trip kind's own stay): no hotel to choose, find or price.
    const own = isOwnStay(item);
    return (
      <EmptyShell
        {...shell}
        date={<CardDate item={item} kind={kind} />}
        body={<EmptyMedia kind="stay" title={title} sub={[nights ? nNights(nights) : null, n ? nPeople(n) : null, own ? L("yer seçilmedi", "not chosen yet") : L("otel seçilmedi", "no hotel chosen")].filter(Boolean).join(" · ")} />}
        links={own ? [] : stayLinks({ city: item.city, checkin: start, checkout: end, adults: n })}
        need={own ? null : { key: needKey("stay", item.city, start, end), section: "stay", kind: "stay", city: item.city, start, end, adults: n, country: item.countryCode ?? countryOfPlace(item.city, items)?.code ?? null }}
      />
    );
  }
  if (isTransportKind(kind)) {
    const rental = (RENTAL_MODES as readonly string[]).includes(kind);
    const face = transportFace(item, kind, env.legEnds.get(item.id));
    const from = item.flight?.from ?? (kind === "flight" ? ownFrom : null) ?? null;
    const to = item.flight?.to ?? (rental ? null : item.city) ?? null;
    const links = kind === "flight" ? flightLinks({ from, to, date: start, adults: n }) : rental ? [] : transferLinks({ from, to }).filter((l) => l.brand === "maps");
    const section = kind === "flight" ? "flight" : "transport";
    return (
      <EmptyShell
        {...shell}
        date={<CardDate item={item} kind={kind} />}
        body={<EmptyRoute from={face.from} to={face.to ?? (to && !rental ? { city: to, sub: null, time: null } : null)} art={kind === "transport" ? null : kind} fields={rental ? ["city", null] : ["from", "to"]} />}
        links={links}
        need={kind === "flight" && to ? { key: needKey("flight", from, to, start), section, kind: "flight", from, to, start, adults: n, fromCode: airportCode(from), toCode: airportCode(to) } : null}
      />
    );
  }
  // An activity, an eSIM, insurance: the drawing's tile and the name.
  const drawing = kind === "esim" ? "esim" : kind === "insurance" ? "shield" : kind === "activity" ? activityDrawing(item) : null;
  const country = item.countryCode ?? esimCountries[0] ?? null;
  const links = kind === "activity" ? activityLinks(item.city) : kind === "esim" ? esimLinks(country) : [];
  const sub = kind === "esim" ? L("tüm gezi için internet", "internet for the whole trip") : kind === "activity" ? <Editable field="city">{item.city}</Editable> : null;
  return (
    <EmptyShell
      {...shell}
      date={<CardDate item={item} kind={kind} />}
      body={<EmptyMedia kind={kind} drawing={drawing} title={<Editable field="name">{item.name}</Editable>} sub={sub} />}
      links={links}
      need={
        kind === "activity" && item.city
          ? { key: needKey("activity", item.city, start, end), section: "activity", kind: "activity", city: item.city, start, end, adults: n, query: isGeneratedName(item.name) ? null : item.name }
          : kind === "esim" && country
            ? { key: needKey("esim", country), section: "other", kind: "esim", country, start, end }
            : null
      }
    />
  );
}

/** "Henüz eklenmedi": the way in or home with no flight saved at all, as the flight's empty card. */
export function EmptyTravelCard({ role, date, city, home = null }: { role: "arrival" | "departure"; date: string; city: string; home?: string | null }) {
  const env = useCardEnv();
  const { travellers: n } = useEmptyEnv();
  const at = { city, sub: null, time: null };
  // Where the trip starts and ends (the other flight's airport): the other end, so the searches have both.
  const there = home ? { city: cityOfAirport(home), sub: cityOfAirport(home) !== home ? home : null, time: null } : null;
  const [from, to] = role === "arrival" ? [there, at] : [at, there];
  const [a, b] = role === "arrival" ? [home, city] : [city, home];
  return (
    <EmptyShell
      kind="flight"
      date={formatDateRange(date, null)}
      ariaLabel={role === "arrival" ? L(`Uçuş · ${city}`, `Flight · ${city}`) : L(`Dönüş · ${city}`, `Flight home · ${city}`)}
      menu={[{ label: L("Uçuş ekle", "Add a flight"), run: () => env.add({ city, date }) }]}
      body={<EmptyRoute from={from} to={to} art="flight" />}
      status={noTicket(n)}
      links={flightLinks({ from: a, to: b, date, adults: n })}
      need={{ key: needKey("flight", a, b, date), section: "flight", kind: "flight", from: a, to: b, start: date, adults: n, fromCode: airportCode(a), toCode: airportCode(b) }}
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
  const { travellers: n, items } = useEmptyEnv();
  const slot = block.slot ?? null;
  const city = slot?.city ?? block.city;
  const hide = () => env.hideNights(block.range, label);
  // The nights on the boat, in the camp or the van (a trip kind's own stay): no hotel to find or price.
  const own = isOwnStay(slot);
  const nights = L(`${block.nights} gece`, `${block.nights} night${block.nights === 1 ? "" : "s"}`);
  // A stay said apart with nothing of its own yet (the start's nights at a stop, "Konaklama · Ubud"): the city, the
  // nights and who goes, as the empty nights read. One with a name or a price of its own keeps them, edited in place.
  const named = slot && !(isGeneratedName(slot.name) && slot.price.amount == null && !slot.url && !slot.provider?.trim());
  const body = named && slot ? (
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
    <EmptyMedia kind="stay" title={city ?? L("Konaklama", "Stay")} sub={[nights, n ? nPeople(n) : null, L("otel seçilmedi", "no hotel chosen")].filter(Boolean).join(" · ")} />
  );
  return (
    <EmptyShell
      kind="stay"
      date={formatDateRange(block.range.start, block.range.end)}
      ariaLabel={slot?.name ?? label}
      itemId={slot?.id}
      extraClass="stay-open"
      menu={slot ? [{ label: L("Düzenle", "Edit"), run: () => env.edit(slot) }, { label: L("Sil", "Delete"), run: () => env.remove(slot), danger: true }] : [{ label: L("Gerek yok", "Not needed"), run: hide }]}
      x={slot ? <DeleteX name={slot.name} className="stay-x" onDelete={() => env.remove(slot)} /> : <DeleteX name={label} hide className="stay-x" onDelete={hide} />}
      body={body}
      status={L("Henüz otel yok", "No place yet")}
      links={own ? [] : stayLinks({ city, checkin: block.range.start, checkout: block.range.end, adults: n })}
      onSkip={slot ? undefined : hide}
      skipTitle={L("Bu geceler için yer gerekmiyor", "No place needed for these nights")}
      need={city && !own ? { key: needKey("stay", city, block.range.start, block.range.end), section: "stay", kind: "stay", city, start: block.range.start, end: block.range.end, adults: n, country: countryOfPlace(city, items)?.code ?? null } : null}
    />
  );
}

/** Where a transfer's end is, as a map would find it: the stay's address (else its name and city), the airport, the city; a change of city's, the city. */
function endPlace(leg: Leg, side: "from" | "to"): string | null {
  const point = leg[side];
  // A change of city goes city to city (as its card says it).
  if (leg.kind === "move") return point.city ?? point.label;
  if (point.item) return point.item.location.address ?? [point.item.name, point.item.city].filter(Boolean).join(", ");
  const hub = (leg.kind === "arrival" && side === "from") || (leg.kind === "departure" && side === "to");
  if (hub) return legEnd(leg, side).city;
  return point.city ?? point.label;
}

/** A transfer or change of city with nothing said for it: how to go is open; tapped, the full card's choices. */
export function EmptyLegCard({ leg }: { leg: Leg }) {
  const env = useCardEnv();
  const { travellers: n } = useEmptyEnv();
  const [open, setOpen] = useLegOpen(leg.key);
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
        { label: L("Plana koy", "Add to plan"), run: () => onAdd(suggestion) },
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

/**
 * Belgeler ve internet's insurance while there's none on a trip abroad (v11 phase 6, the rule's suggestion drawn as its
 * empty card, beside the eSIM's and as large): "Seyahat sağlık sigortası", the shield, "Alınmadı", a search to compare.
 */
export function EmptyInsuranceCard({ suggestion, onAdd, onDismiss }: { suggestion: Suggestion; onAdd: (s: Suggestion) => void; onDismiss: (s: Suggestion) => void }) {
  const { esimCountries } = useEmptyEnv();
  const names = countryNames(esimCountries);
  const start = isoDate(suggestion.payload?.start ?? null);
  const end = isoDate(suggestion.payload?.end ?? null);
  const title = L("Seyahat sağlık sigortası", "Travel health insurance");
  return (
    <EmptyShell
      kind="insurance"
      date={start ? formatDateRange(start, end) : null}
      ariaLabel={title}
      data={{ "data-suggestion": suggestion.key }}
      menu={[
        { label: L("Plana koy", "Add to plan"), run: () => onAdd(suggestion) },
        { label: L("Gerek yok", "Not needed"), run: () => onDismiss(suggestion) },
      ]}
      body={<EmptyMedia kind="insurance" drawing="shield" title={title} sub={names.length ? L(`${names.join(", ")} · zorunlu değil ama önerilir`, `${names.join(", ")} · not required, advised`) : L("zorunlu değil ama önerilir", "not required, advised")} />}
      status={L("Alınmadı", "Not bought")}
      links={insuranceLinks(names[0])}
      onSkip={() => onDismiss(suggestion)}
      skipTitle={L("Sigorta gerekmiyor", "No insurance needed")}
      need={null}
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
