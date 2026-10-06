// A plan card for one record (not a stay): a transport card for a way of travel, a media card for an
// activity, an eSIM, insurance, a restaurant or a note. NavGroup shows a need's options as one card with
// ‹ 1/2 › in its bottom strip (stays keep their side-by-side cards). CardEnv carries what every card needs
// from the board (decisions, files, delete with undo, the add sheet) without threading it through Timeline.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { cardKind, isTransportKind, type LegEnds } from "../../lib/cardKinds";
import { footOf, mediaFace, menuFor, ringOf, transportFace } from "../../lib/cardView";
import type { Choice, Ranked } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { dateAlert } from "../../lib/progress";
import type { CardFocus } from "../../lib/inlineEdit";
import type { DateRange } from "../../lib/plan";
import type { InsertAt } from "../../lib/templates";
import type { DocMeta, Item, LegMode } from "../../lib/types";
import { chooseItem, setInstalled, setItemStatus } from "../actions";
import { useShare } from "../Share";
import type { Decisions } from "../useDecisions";
import { CardDate } from "./CardDate";
import { CardDetail } from "./CardDetail";
import { CardFoot, CardShell, type MenuEntry, type Nav } from "./CardShell";
import { DocAccess, DocPickButton } from "./DocAccess";
import { InlineEdit } from "./InlineEdit";
import { MediaCardBody } from "./MediaCard";
import { datedLink } from "./parts";
import { TransportArt } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";
import { FlightTiles } from "./FlightLive";
import { FallbackImg } from "../FallbackImg";
import { flightAlert, flightTiles, sourceText, ticketDiff } from "../../lib/flightData";
import { flightNumber } from "../../../supabase/functions/flight/shape";

export interface CardEnv {
  tripId: string;
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
  const [open, setOpen] = useState(false);
  // Shared trip: both travellers said 👎 → it steps back like "Ele" (a vote undoes it).
  const allNo = useShare()?.tally(item).allNo ?? false;
  const kind = cardKind(item, env.legModes.get(item.id) ?? null);
  const facts = cardFacts(item, decision, env.decisions?.ctx);
  const alert = dateAlert(item, env.today);
  const ring = ringOf(item, kind);
  const foot = footOf(item, kind, { options: nav?.total ?? 1, alert });
  const docs = env.docsFor(item.id);
  const { url: datedUrl } = datedLink(item, decision);
  const page = datedUrl ?? item.url;
  const best = ranked?.rank === 1;
  const act = () => {
    const does = foot.action?.does;
    if (does === "choose") void chooseItem(item, group);
    else if (does === "book") void setItemStatus(item, "booked");
    else if (does === "install") void setInstalled(item, true);
    else if (does === "restore") void setItemStatus(item, "saved");
  };
  const menu: MenuEntry[] = menuFor(item).map((a) =>
    a === "edit"
      ? { label: L("Düzenle", "Edit"), run: () => env.edit(item) }
      : a === "dismiss"
        ? { label: L("Ele", "Rule out"), run: () => void setItemStatus(item, "dismissed") }
        : { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true },
  );
  const alternatives = onChange ? Math.max(0, group.length - 1) : 0;
  const actions = (
    <>
      {onCompare && <button type="button" onClick={onCompare}>{L("Karşılaştır →", "Compare →")}</button>}
      {page && <a href={page} target="_blank" rel="noreferrer">{datedUrl ? L("Tarihlerle aç ↗", "Open with dates ↗") : L("Kaydettiğin sayfa ↗", "Your saved page ↗")}</a>}
      <button type="button" onClick={() => env.onOpenItem(item)}>{L("Tüm detaylar", "All details")}</button>
      <DocPickButton item={item}>{L("Belge ekle", "Add a document")}</DocPickButton>
      {alternatives > 0 && (
        <button type="button" aria-expanded={changing} onClick={onChange}>
          {changing ? L("Kapat", "Close") : L(`Diğer ${alternatives} seçenek`, `${alternatives} other option${alternatives === 1 ? "" : "s"}`)}
        </button>
      )}
      {item.status === "chosen" && item.origin !== "chat" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "saved")}>{L("Seçimi geri al", "Undo choice")}</button>}
      {item.status === "booked" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "chosen")}>{L("Rezervasyonu geri al", "Mark as not booked")}</button>}
      {kind === "esim" && item.installedAt && <button type="button" className="quiet" onClick={() => void setInstalled(item, false)}>{L("Kurulmadı", "Not installed")}</button>}
      <button type="button" className="del" onClick={() => env.remove(item)}>{L("Sil", "Delete")}</button>
    </>
  );
  const transport = isTransportKind(kind);
  // A booked flight's real data (0.36.18): its number in the header, the terminals by the codes, boxes for
  // what's known on its day, red when it's late; the ticket against the schedule and the source at the foot.
  const booked = kind === "flight" && item.status === "booked";
  const live = booked ? (item.flightLive ?? null) : null;
  const number = booked ? (live?.number ?? flightNumber(item.flight?.flightNumber)) : null;
  const tag = number ? [live?.airline ?? item.flight?.carrier, number].filter(Boolean).join(" ") : null;
  const tiles = flightTiles(live);
  const red = flightAlert(live);
  const face = transport ? transportFace(item, kind, env.legEnds.get(item.id)) : null;
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
          {tag && (
            <>
              {" · "}
              {/* The airline's logo by its code (the flight number's first two letters); none when it won't load. */}
              <FallbackImg className="pk-airline" src={`https://images.kiwi.com/airlines/64/${number!.slice(0, 2)}.png`} fallback={null} />
              {tag}
            </>
          )}
        </>
      }
      ariaLabel={item.name}
      itemId={item.id}
      extraClass={[allNo ? "pk-all-no" : "", red ? "pk-alert" : ""].filter(Boolean).join(" ") || undefined}
      art={transport && kind !== "transport" ? <TransportArt mode={kind} /> : null}
      docs={<DocAccess item={item} docs={docs} />}
      onDelete={() => env.remove(item)}
      menu={menu}
      open={open}
      onToggle={() => setOpen(!open)}
      body={
        transport ? (
          <>
            <TransportCardBody face={face!} title={item.name} />
            <FlightTiles tiles={tiles} />
          </>
        ) : (
          <MediaCardBody face={mediaFace(item, kind, facts.source)} kind={kind} score={facts.score} best={best} city={item.city} />
        )
      }
      foot={<CardFoot view={foot} nav={nav} best={best} price={facts.price} onAction={act} live={liveFoot} />}
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
  const ids = items.map((i) => i.id).join(" ");
  useEffect(() => setIndex(0), [ids]);
  // Bringing the options back starts at the chosen one.
  useEffect(() => {
    if (changing && decided) setIndex(Math.max(0, items.findIndex((i) => i.id === decided.id)));
  }, [changing]);
  const single = decided && !changing;
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
