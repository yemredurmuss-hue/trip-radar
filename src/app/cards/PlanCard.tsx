// A plan card for one record (not a stay): a transport card for a way of travel, a media card for an
// activity, an eSIM, insurance, a restaurant or a note. NavGroup shows a need's options as one card with
// ‹ 1/2 › in its bottom strip (stays keep their side-by-side cards). CardEnv carries what every card needs
// from the board (decisions, files, delete with undo, the add sheet) without threading it through Timeline.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cardFacts, durationText } from "../../lib/cardFacts";
import { cardKind, isTransportKind, type LegEnds } from "../../lib/cardKinds";
import { footOf, mediaFace, ringOf, topDate, transportFace } from "../../lib/cardView";
import type { Choice, Ranked } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { dateAlert } from "../../lib/progress";
import type { CardFocus } from "../../lib/inlineEdit";
import type { DateRange } from "../../lib/plan";
import type { InsertAt } from "../../lib/templates";
import type { DocMeta, Item, LegMode, Trip } from "../../lib/types";
import type { Undoable } from "../../lib/undoables";
import { chooseItem, setInstalled, setItemStatus, setOwner } from "../actions";
import { CopyText } from "../CopyButton";
import { dropsIn, useJustBecame, useJustChanged } from "../motion";
import type { CityWeather } from "../../lib/climate";
import { flightPeek } from "../../lib/cardPeek";
import { FlightPeekBox } from "./Peek";
import { WhoAvatar, WhoseBadge, usePhotoOf, useWhoCtx } from "./WhoseBadge";
import { isUnnamedMe, peopleOf, whoseOf } from "../../lib/whose";
import { sameName } from "../../lib/tripSettings";
import { useShare } from "../Share";
import type { Decisions } from "../useDecisions";
import { CardDate } from "./CardDate";
import { BookingSheet } from "./BookingSheet";
import { ChoiceSheet, NeedCard } from "./NeedCard";
import { needTitleOf } from "../../lib/pano";
import { CardDetail } from "./CardDetail";
import { CardFoot, CardShell, type MenuEntry, type Nav } from "./CardShell";
import { nightsBetween } from "../../lib/items";
import { DocAccess, openDoc, DocPickButton } from "./DocAccess";
import { InlineEdit } from "./InlineEdit";
import { groupKeyOf } from "../../lib/plan";
import { useStageMenu } from "./stageMenu";
import { MediaCardBody } from "./MediaCard";
import { datedLink } from "./parts";
import { TransportArt, UiIcon } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";
import { FlightTiles } from "./FlightLive";
import { flightAlert, flightTiles, sourceText, ticketDiff } from "../../lib/flightData";
import { flightNumber } from "../../../supabase/functions/flight/shape";

export interface CardEnv {
  tripId: string;
  /** The trip (its people: whose a plan is, kişiye özel rezervasyon). */
  trip: Trip;
  decisions: Decisions | null;
  today: string;
  /** The way chosen for each record's transfer (cardKinds.legModeByItem). */
  legModes: Map<string, LegMode>;
  /** The cities each trip links on the plan (cardKinds.legEndsByItem), for the big text at its ends. */
  legEnds: Map<string, LegEnds>;
  /** A card's files (its own and those of the plans it replaced). */
  docsFor: (itemId: string) => DocMeta[];
  /** Deletes with an 8-second "Geri al". */
  remove: (item: Item) => void;
  /** Shows the one "Geri al" for what a card just did ("İptal ettim"). */
  offer: (u: Undoable) => void;
  /** Empty nights' ×: "Gerek yok" for them, with an 8-second "Geri al". */
  hideNights: (range: DateRange, label: string) => void;
  /** Opens the add sheet (null: from the plan's header). */
  add: (at: InsertAt | null) => void;
  /** Opens the add sheet's form for a plan ("Düzenle"). */
  edit: (item: Item) => void;
  /** The card being edited in place and its open field (cards/InlineEdit.tsx). */
  focus: CardFocus | null;
  setFocus: (focus: CardFocus | null) => void;
  onOpenItem: (item: Item) => void;
  onCompare: (groupKey: string) => void;
  /** v11: the Pano, opened on this need's group ("Pano'da gör"). */
  onPano: (groupKey: string) => void;
  /** The city's weather as the hero has it (read from its cache, nothing asked): a transfer card's peek. */
  weather?: (city: string | null) => CityWeather | null;
  /** v11: a line for the trip's chat ("Daha fazla fikir", a card's ✨); absent where there's no chat. */
  ask?: (text: string) => void;
}

export const CardEnvContext = createContext<CardEnv | null>(null);
export function useCardEnv(): CardEnv {
  const env = useContext(CardEnvContext);
  if (!env) throw new Error("Plan cards need CardEnvContext (TripPanel provides it).");
  return env;
}

/** Every record's card is edited where it stands (spec 0.33 §3): its day, ends, title, city, price. */
export function PlanCard(props: Parameters<typeof PlanCardFace>[0]) {
  return (
    <InlineEdit item={props.item}>
      <PlanCardFace {...props} />
    </InlineEdit>
  );
}

function PlanCardFace({ item, group, decision, ranked, nav, onChange, changing = false, onCompare, headline = null }: {
  item: Item;
  /** The options it's compared with (a choice replaces another chosen one among them). */
  group: Item[];
  decision?: GroupDecision;
  ranked?: Ranked;
  nav?: Nav;
  /** A decided card whose other options can come back ("Diğer N seçenek"). */
  onChange?: () => void;
  changing?: boolean;
  onCompare?: () => void;
  headline?: Choice | null;
}) {
  const env = useCardEnv();
  const who = useWhoCtx();
  const photoOf = usePhotoOf();
  const [open, setOpen] = useState(false);
  // v11 phase 3: a booking opens its own window (reference, times, files, Değiştir / İptal ettim), not the decision.
  const [sheet, setSheet] = useState(false);
  // Shared trip: both travellers said 👎 → it steps back like "Ele" (a vote undoes it).
  const allNo = useShare()?.tally(item).allNo ?? false;
  const kind = cardKind(item, env.legModes.get(item.id) ?? null);
  const facts = cardFacts(item, decision, env.decisions?.ctx);
  const alert = dateAlert(item, env.today);
  const ring = ringOf(item, kind);
  const docs = env.docsFor(item.id);
  const foot = footOf(item, kind, { options: nav?.total ?? 1, alert, docs: docs.length });
  const stageMenu = useStageMenu(item);
  const { url: datedUrl } = datedLink(item, decision);
  const page = datedUrl ?? item.url;
  const best = ranked?.rank === 1;
  // v11: planned and not bought yet, "✓ Aldım" moves to the top line and the strip's action is the page to book on.
  const bookTop = foot.action?.does === "book";
  const goLabel = ["flight", "train", "bus", "minibus", "ferry", "activity"].includes(kind)
    ? L("Bileti al ↗", "Get the ticket ↗")
    : kind === "esim" || kind === "insurance"
      ? L("Satın al ↗", "Buy ↗")
      : L("Rezerve et ↗", "Book ↗");
  const act = () => {
    const does = foot.action?.does;
    if (does === "choose") void chooseItem(item, group);
    else if (does === "book") void setItemStatus(item, "booked");
    else if (does === "install") void setInstalled(item, true);
    else if (does === "restore") void setItemStatus(item, "saved");
  };
  // "Kimin için?" (kişiye özel rezervasyon): everyone, or some of the trip's people, ticked; on a trip of two or more.
  const people = peopleOf(env.trip, who);
  const whose = whoseOf(item, env.trip, who);
  const owners = whose?.names ?? [];
  const setFor = (names: string[]) => void setOwner(item.id, names.length && names.length < people.length ? names : null);
  const forWho: MenuEntry[] =
    people.length < 2
      ? []
      : [
          { label: L("Kimin için?", "Who's it for?"), heading: true, run: () => undefined },
          { label: L("Herkes", "Everyone"), checked: !whose, run: () => setFor([]) },
          ...people.map((n) => {
            const on = owners.some((o) => sameName(o, n));
            return {
              label: isUnnamedMe(n, who) ? L("Ben", "Me") : n,
              checked: on,
              lead: <WhoAvatar name={n} photo={photoOf(n)} />,
              run: () => setFor(on ? owners.filter((o) => !sameName(o, n)) : whose ? [...owners, n] : [n]),
            };
          }),
        ];
  const menu: MenuEntry[] = [...forWho, ...stageMenu.menu.map((e, i) => ({ ...e, sep: forWho.length > 0 && i === 0 }))];
  const alternatives = onChange ? Math.max(0, group.length - 1) : 0;
  // v11: chosen, not bought yet: its other options are a link by the price ("Pano'da 2 alternatif").
  const altCount = item.status === "chosen" ? group.filter((g) => g.id !== item.id && g.status !== "dismissed").length : 0;
  const bookedCard = item.status === "booked";
  // The motion dictionary: a card that turns booked pops its tick (mühür), a change glows (parlama), one the chat just added drops in (düşüş).
  const sealed = useJustBecame(bookedCard);
  const glow = useJustChanged(item.updatedAt);
  const [drop] = useState(() => dropsIn(item.id, item.createdAt, item.origin === "chat"));
  const actions = (
    <>
      {onCompare && <button type="button" onClick={onCompare}>{L("Karşılaştır →", "Compare →")}</button>}
      {page && <a href={page} target="_blank" rel="noreferrer">{datedUrl ? L("Tarihlerle aç ↗", "Open with dates ↗") : L("Kaydettiğin sayfa ↗", "Your saved page ↗")}</a>}
      <button type="button" onClick={() => env.onOpenItem(item)}>{L("Tüm detaylar", "All details")}</button>
      <button type="button" onClick={() => env.onPano(groupKeyOf(item))}>
        {alternatives > 0 ? L(`Pano'da ${alternatives} alternatif`, `${alternatives} alternative${alternatives === 1 ? "" : "s"} on the Board`) : L("Pano'da gör", "See on the Board")}
      </button>
      <DocPickButton item={item}>{L("Belge ekle", "Add a document")}</DocPickButton>
      {alternatives > 0 && (
        <button type="button" aria-expanded={changing} onClick={onChange}>
          {changing ? L("Kapat", "Close") : L(`Diğer ${alternatives} seçenek`, `${alternatives} other option${alternatives === 1 ? "" : "s"}`)}
        </button>
      )}
      {item.status === "chosen" && item.origin !== "chat" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "saved")}>{L("Seçimi geri al", "Undo choice")}</button>}
      {item.status === "booked" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "chosen")}>{L("Rezervasyonu geri al", "Mark as not booked")}</button>}
      {kind === "esim" && item.installedAt && <button type="button" className="quiet" onClick={() => void setInstalled(item, false)}>{L("Kurulmadı", "Not installed")}</button>}
      <button type="button" className="del" onClick={stageMenu.remove}>{L("Sil", "Delete")}</button>
    </>
  );
  const transport = isTransportKind(kind);
  const flightFacts = kind === "flight" ? flightPeek(item) : [];
  // A booked flight's real data (0.36.18): its number in the header, the terminals by the codes, boxes for
  // what's known on its day, red when it's late; the ticket against the schedule and the source at the foot.
  const booked = kind === "flight" && item.status === "booked";
  const live = booked ? (item.flightLive ?? null) : null;
  // The number and the logo on any flight that has one (an option too, as on flight search sites).
  const number = kind === "flight" ? (live?.number ?? flightNumber(item.flight?.flightNumber)) : null;
  const tag = number ? [live?.airline ?? item.flight?.carrier, number].filter(Boolean).join(" ") : null;
  const tiles = flightTiles(live);
  const red = flightAlert(live);
  const face = transport ? transportFace(item, kind, env.legEnds.get(item.id)) : null;
  // The airline's logo by its code (the flight number's first two letters), beside the duration; none when it
  // won't load.
  if (face && number) {
    face.logo = `https://images.kiwi.com/airlines/64/${number.slice(0, 2)}.png`;
    face.logo2 = `https://pics.avs.io/128/128/${number.slice(0, 2)}.png`;
  }
  // No duration on the page: the schedule's (gate to gate, by UTC).
  if (face && !face.middle && live?.minutes) face.middle = [durationText(live.minutes), item.flight?.stops === 0 ? L("direkt", "direct") : null].filter(Boolean).join(" · ");
  if (face && live) {
    const term = (t: string | null) => (t ? ` T${t}` : "");
    // Red only where a new time came (a landing not yet re-estimated stays as it was).
    if (face.from) face.from = { ...face.from, sub: `${face.from.sub ?? ""}${term(live.departure.terminal)}`.trim(), late: red && !!live.departure.revised };
    if (face.to) face.to = { ...face.to, sub: `${face.to.sub ?? ""}${term(live.arrival.terminal)}`.trim(), late: red && !!live.arrival.revised };
  }
  const liveFoot = live
    ? red
      ? { note: L("Rötar: plan yeni saate göre kaydı", "Delayed: the plan moved with it"), tone: "bad" as const, source: sourceText(live) }
      : { note: ticketDiff(live), tone: "warn" as const, source: tiles.length ? sourceText(live) : null }
    : null;
  return (
    <CardShell
      kind={kind}
      ring={ring}
      date={
        <>
          <CardDate item={item} kind={kind} />
          {tag && ` · ${tag}`}
        </>
      }
      ariaLabel={item.name}
      itemId={item.id}
      badge={<WhoseBadge item={item} trip={env.trip} />}
      extraClass={[allNo ? "pk-all-no" : "", red ? "pk-alert" : "", bookedCard ? "pk-booked" : "", sealed ? "pk-seal" : "", glow ? "pk-glow" : "", drop ? "pk-drop" : ""].filter(Boolean).join(" ") || undefined}
      art={
        <>
          {/* v11: a booking's stamp, the green ✓ turned a little, faint, in its corner (a ticket's ends fill that corner: none there). */}
          {bookedCard && !transport && <span className="pk-stamp" aria-hidden><UiIcon name="check" size={16} /></span>}
        </>
      }
      docs={bookedCard ? null : <DocAccess item={item} docs={docs} />}
      onDelete={stageMenu.hide}
      deleteLabel={stageMenu.booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")}
      topAction={
        bookTop ? (
          <button type="button" className="pk-aldim" aria-label={L(`${item.name}: ${foot.action!.label}`, `${item.name}: ${foot.action!.label}`)} title={foot.action!.label}
            onClick={(e) => { e.stopPropagation(); act(); }}>
            ✓ {L("Aldım", "Got it")}
          </button>
        ) : bookedCard ? (
          <span className="pk-lab booked">{L("Rezerve", "Booked")}</span>
        ) : null
      }
      menu={menu}
      peek={flightFacts.length ? <FlightPeekBox facts={flightFacts} /> : null}
      open={open}
      onToggle={() => (item.status === "booked" && !["taxi", "note", "todo"].includes(kind) ? setSheet(true) : setOpen(!open))}
      body={
        transport ? (
          <>
            <TransportCardBody face={face!} title={item.name} art={kind !== "transport" ? <TransportArt mode={kind} /> : null} />
            <FlightTiles tiles={tiles} />
          </>
        ) : (
          <MediaCardBody face={mediaFace(item, kind, facts.source)} kind={kind} score={facts.score} best={best} city={item.city}
            nights={kind === "stay" && item.dates.start && item.dates.end ? nightsBetween(item.dates.start.slice(0, 10), item.dates.end.slice(0, 10)) : null} />
        )
      }
      foot={
        <>
          <CardFoot view={bookTop ? { ...foot, action: null } : foot} nav={nav} best={best} price={facts.price} onAction={act} live={liveFoot}
            go={bookTop && page ? { href: page, label: goLabel } : null}
            alt={altCount > 0 ? { count: altCount, onClick: () => env.onPano(groupKeyOf(item)) } : null}
            quietWait={item.status === "chosen"}
            docs={
              bookedCard ? (
                docs.length === 1 ? (
                  <button type="button" className="pk-docname" title={docs[0].name} onClick={(e) => { e.stopPropagation(); void openDoc(docs[0].id); }}>
                    <UiIcon name="clip" size={12} />
                    <span>{docs[0].name}</span>
                  </button>
                ) : (
                  <DocAccess item={item} docs={docs} />
                )
              ) : null
            }
            more={bookedCard && !["taxi", "note", "todo"].includes(kind) ? () => setSheet(true) : undefined} />
          {/* v11: a booked flight's stub under a dashed line — the airline, the booking code, how many go — and its stamp. */}
          {bookedCard && kind === "flight" && (
            <div className="pk-stub">
              <span>{item.flight?.carrier ?? item.provider ?? L("Uçuş", "Flight")}</span>
              {item.bookingRef && <b><CopyText value={item.bookingRef} label={L("Rezervasyon kodu", "Booking code")}>{item.bookingRef}</CopyText></b>}
              {item.guests.adults ? <span>{L(`${item.guests.adults} yolcu`, `${item.guests.adults} passenger${item.guests.adults === 1 ? "" : "s"}`)}</span> : null}
              <span className="pk-stamp" aria-hidden><UiIcon name="check" size={14} /></span>
            </div>
          )}
          {stageMenu.field}
          {sheet && (
            <BookingSheet item={item} kind={kind} facts={facts} docs={docs} date={topDate(item, kind)}
              onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
          )}
        </>
      }
      detail={<CardDetail item={item} group={group} decision={decision} decisions={env.decisions} ranked={ranked} headline={headline} facts={facts} alert={alert} docs={docs} actions={actions} />}
    />
  );
}

/**
 * A need's options (not a stay) as one card: best first, ‹ 1/2 › to go through them. Decided, the chosen
 * one alone (its details bring the others back: "Diğer N seçenek"). The wrapper names every option's id,
 * so a to-do can find the card of one not on screen (Progress.findTarget).
 */
export function NavGroup({ items, heading, nested, decision, choice, decided, onChange, changing, rankedOf, onCompare }: {
  items: Item[];
  heading: ReactNode;
  nested: boolean;
  decision?: GroupDecision;
  choice: Choice | null;
  decided: Item | null;
  onChange?: () => void;
  changing: boolean;
  rankedOf: (item: Item) => Ranked | undefined;
  onCompare?: () => void;
}) {
  const [index, setIndex] = useState(0);
  // v11 phase 2b: the choice window (a need's "N seçenek ›", a decided card's "Diğer N seçenek").
  const [choosing, setChoosing] = useState(false);
  const ids = items.map((i) => i.id).join(" ");
  useEffect(() => setIndex(0), [ids]);
  // Bringing the options back starts at the chosen one.
  useEffect(() => {
    if (changing && decided) setIndex(Math.max(0, items.findIndex((i) => i.id === decided.id)));
  }, [changing]);
  const single = decided && !changing;
  // Not decided and more than one option: the need's own card, one size, its options in the choice window (v11).
  if (!decided && items.length >= 1) {
    return (
      <div className={nested ? "group nested" : "section"} data-option-ids={ids}>
        {heading && <div className={nested ? "group-head" : "section-head"}>{heading}</div>}
        <NeedCard items={items} decision={decision} choice={choice} open={choosing} onOpen={() => setChoosing(true)} onClose={() => setChoosing(false)} onCompare={onCompare} />
      </div>
    );
  }
  // Decided, "Diğer N seçenek": the chosen card stays, the choice window opens over it.
  if (decided && changing) {
    return (
      <div className={nested ? "group nested" : "section"} data-option-ids={ids}>
        {heading && <div className={nested ? "group-head" : "section-head"}>{heading}</div>}
        <PlanCard key={decided.id} item={decided} group={items} decision={decision} ranked={rankedOf(decided)} onChange={onChange} changing={changing} onCompare={onCompare} headline={null} />
        <ChoiceSheet items={items} decision={decision} choice={choice} title={needTitleOf(decided)} kind={cardKind(decided)} onClose={() => onChange?.()} onCompare={onCompare} />
      </div>
    );
  }
  const shown = single ? decided : items[Math.min(index, items.length - 1)];
  // A group emptied under us (its last option deleted, the board not yet redrawn): nothing to show.
  if (!shown) return null;
  const nav: Nav | undefined =
    !single && items.length > 1 ? { index: Math.min(index, items.length - 1), total: items.length, go: (step) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + step))) } : undefined;
  const ranked = rankedOf(shown);
  return (
    <div className={nested ? "group nested" : "section"} data-option-ids={ids}>
      {heading && <div className={nested ? "group-head" : "section-head"}>{heading}</div>}
      {changing && (
        <button type="button" className="link-btn pk-close" onClick={onChange}>
          {L("Kapat", "Close")}
        </button>
      )}
      <PlanCard
        key={shown.id}
        item={shown}
        group={items}
        decision={decision}
        ranked={ranked}
        nav={nav}
        onChange={single ? onChange : undefined}
        changing={changing}
        onCompare={onCompare}
        headline={ranked?.rank === 1 ? choice : null}
      />
    </div>
  );
}
