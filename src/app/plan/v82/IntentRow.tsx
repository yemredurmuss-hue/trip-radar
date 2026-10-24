// An intent of a dated category as the approved drawings draw it (plan v14, onay paketi 2026-10-21, docs/mockups/
// paket-ucus-konaklama): on the category's date rail (RailCol: the day, or a stay's nights as one slice with a notch a
// night), a flight or a way of travel as one 72 px row (TicketRow: its mark, the kind's word, its two ends, one line, one
// figure and one thing on the right; pressed, its ticket opens under it, one row open at a time), a stay or a rental as a
// 120 px card that doesn't fold (StayCard: its picture on the left, its city or kind over its name; pressed, the drawer
// opens beside the plan, a booking's details under it), and a short open stretch between two stays as an amber empty night.
// What a row says is lib/rowView.ts's; what it does stays IntentBox's (its menu, drawer, details, inline edit).
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { carriesArrival, droppedLinks } from "../../arrive/useDropZone";
import { L } from "../../../lib/i18n";
import { ratingParts, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { weekdayLong, type RailDate } from "../../../lib/railDates";
import { shortDay } from "../../../lib/ideas";
import { deckLead, type RowPart, type RowView } from "../../../lib/rowView";
import { carrierMark, ticketFace } from "../../../lib/ticketFrame";
import { Editable } from "../../cards/InlineEdit";
import { Ic, Mark } from "./icons";
import { ModeIcon, modeIconOf, StageBadge, Stamp } from "./modeIcons";
import { SelfLinks } from "./OptionCompact";
import { CarrierLogo } from "./OptionRow";

/**
 * One row open at a time in a category (onay paketi: "aynı anda bir satır açık"); Karar Masası's chosen and bought
 * flights come open on their own (karar 6: "açık gelir, kapanabilir"; bought ones no longer, 2026-10-24), each until it is
 * closed (`closed`, kept for the trip: a category shut and opened again, or the page again, finds it closed).
 */
export const RowOpenContext = createContext<{ open: string | null; set: (key: string | null) => void; closed?: ReadonlySet<string>; shut?: (key: string, closed: boolean) => void } | null>(null);

export function useRowOpen(key: string, auto = false): [boolean, (open: boolean) => void] {
  const ctx = useContext(RowOpenContext);
  const [own, setOwn] = useState(auto);
  // A row open on its own that stops being so while on screen (a flight chosen, then bought: "Aldım") stays open: it is
  // only a bought one coming into view that comes closed (2026-10-24).
  const was = useRef(auto);
  useEffect(() => {
    if (was.current && !auto && ctx && ctx.open == null && !ctx.closed?.has(key)) ctx.set(key);
    was.current = auto;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when it stops coming open on its own
  }, [auto]);
  if (!ctx) return [own, setOwn];
  if (auto && ctx.closed && ctx.shut) return [ctx.open === key || !ctx.closed.has(key), (open) => (ctx.shut!(key, !open), !open && ctx.open === key && ctx.set(null))];
  // (in the moment it stops, before the effect above says so: no frame closed in between)
  const keep = was.current && !auto && ctx.open == null && !ctx.closed?.has(key);
  return [ctx.open === key || keep, (open) => ctx.set(open ? key : ctx.open === key ? null : ctx.open)];
}

/** The date column beside an intent: its day over its weekday, or a stay's range, weekdays and nights on a slice. */
export function RailCol({ date, editable, blank = false }: { date: RailDate | null; editable: boolean; blank?: boolean }) {
  // (no day yet: on its own plan the day is typed here; else the rail is quiet)
  // (a ticket's own day is typed on its ticket under the row: only a card asks for it here)
  if (!date)
    return editable && blank ? (
      <div className="q-tld none">
        <b>
          <Editable field="date" />
        </b>
        <small>{L("tarihi yok", "no date")}</small>
      </div>
    ) : (
      <div className="q-tld none" aria-hidden />
    );
  const when = editable ? <Editable field="date">{date.when}</Editable> : date.when;
  return (
    <div className={`q-tld${date.notches ? " span" : ""}`}>
      <b>{when}</b>
      {date.sub && <small>{date.sub}</small>}
      {date.span && <span className="q-tlspan">{date.span}</span>}
      {date.notches > 0 && (
        <span className="q-slice" aria-hidden>
          {Array.from({ length: Math.min(date.notches, 14) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      )}
      {date.notches > 0 && <span className="q-tlend" aria-hidden />}
    </div>
  );
}

function Parts({ parts, cls = "q-rln" }: { parts: RowPart[]; cls?: string }) {
  if (!parts.length) return null;
  return (
    <span className={cls}>
      {parts.map((p, i) => (
        <span key={`${i}:${p.text}`} className={p.tone ? `t-${p.tone}` : undefined}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

/** A ticket in hand (onay paketi 2026-10-22): its code on a stub at the row's end, a dashed tear and two notches. */
function Stub({ fig }: { fig: NonNullable<RowView["figure"]> }) {
  return (
    <span className={`q-rstub${fig.plain ? " plain" : ""}`}>
      {fig.top && <small>{fig.top}</small>}
      <b className={fig.plain ? "q-rbig" : "q-rcode"}>{fig.big}</b>
      {fig.small && <small>{fig.small}</small>}
    </span>
  );
}

/** The kind's word and the step's ("Tren · Planda"), over the name. */
function Lead({ view }: { view: RowView }) {
  return (
    <span className="q-rlead">
      {view.lead && <span className="q-rkind">{view.lead}</span>}
      <span className="q-rstage">{view.stageWord}</span>
    </span>
  );
}

/** The figure: the price (its own field, edited where it stands), the estimate, the code. */
function Figure({ fig, editable, blank = false }: { fig: RowView["figure"]; editable: boolean; blank?: boolean }) {
  // (no price yet on one's own plan: "Fiyat ekle", typed where the price will stand)
  if (!fig)
    return blank ? (
      <span className="q-rfig">
        <b>
          <Editable field="price" />
        </b>
      </span>
    ) : (
      <span className="q-rfig" />
    );
  const big = fig.code ? <b className="q-rcode">{fig.big}</b> : <b>{editable ? <Editable field="price">{fig.big}</Editable> : fig.big}</b>;
  return (
    <span className={`q-rfig${fig.code ? " code" : ""}`}>
      {big}
      {fig.small && <small>{fig.small}</small>}
    </span>
  );
}

export interface SlotOn {
  ask: (() => void) | null;
  pick: () => void;
  take: () => void;
  got: () => void;
  /** The chosen one's page (Satın al ↗ / Rezerve et ↗), else none: "✓ Aldım" is the button. */
  page: string | null;
  /** The page's site, for its title. */
  brand: string | null;
  /** "Tarih ver": its day typed where the rail says it (the record's own date), else asked in the chat. */
  date?: (() => void) | null;
  /** "Bileti ekle" / "Onayı ekle": its file picked (and read), the last step once bought. */
  proof?: (() => void) | null;
  /** The site's "Satın al ↗" pressed: "Aldın mı?" asked under the row (its proof box). */
  asked?: (() => void) | null;
  /** Karar Masası: "Kendin ara ↗", the first site filled with the route and the day (else "Ara" stays). */
  self?: SelfSearch | null;
  /** Karar Masası: the "+" on the mark's corner, what one found brought here (the drawer, its "+ Seninkini ekle"). */
  add?: (() => void) | null;
  /** An empty box's other search, the AI's ("AI ara"), beside "Ara" / "Kendin ara ↗"; busy while it looks. */
  ai?: (() => void) | null;
  aiBusy?: boolean;
}

/** "AI ara": the chat looks for it (busy while it does); the same in an empty box's slot and an empty flight's. */
function aiSearch(on: SlotOn): ReactNode {
  if (!on.ai) return null;
  return (
    <button type="button" className="q-pick q-rbtn q-ai2" disabled={on.aiBusy} onClick={(e) => (e.stopPropagation(), on.ai?.())} title={L("AI senin için arasın, bulduklarını seçeneklere koysun", "Let the AI look and add what it finds to the options")}>
      <Ic name="spark" size={14} />
      <span>{on.aiBusy ? L("AI arıyor…", "AI is looking…") : L("AI ara", "AI search")}</span>
    </button>
  );
}

/**
 * The one thing on the right (118 px): Ara and AI ara (an empty box's two searches) · Seç and the count · Bunu seç · Satın
 * al ↗ / Rezerve et ↗ · the state's hap.
 */
function Slot({ view, on, logo }: { view: RowView; on: SlotOn; logo: ReactNode }) {
  const s = view.slot;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  switch (s.kind) {
    case "date":
      return (
        <button type="button" className="q-pick q-rbtn" onClick={(e) => (stop(e), (on.date ?? on.ask)?.())}>
          {L("Tarih ver", "Set a date")}
        </button>
      );
    case "self":
      // (two searches, both always there: on a site yourself, or the AI looks and brings options back to the deck)
      if (on.self || on.ai)
        return (
          <span className="q-two">
            {on.self && (
              <a className="q-pick q-rbtn q-self q-srch" href={on.self.url} target="_blank" rel="noreferrer" onClick={stop} title={L(`${on.self.name} sitesinde ara`, `Search on ${on.self.name}`)}>
                <Ic name="search" size={14} stroke={2.4} />
                <span>{L("Kendin ara", "Search yourself")}</span>
                <span className="q-ext">↗</span>
              </a>
            )}
            {aiSearch(on)}
          </span>
        );
      return on.ask ? (
        <button type="button" className="q-pick q-rbtn" onClick={(e) => (stop(e), on.ask?.())}>
          {L("Ara", "Search")}
        </button>
      ) : null;
    case "ask": {
      // (an empty box's two searches: "Ara" (the drawer: the source's picks and the sites; else a site of its own, "↗") and
      // "AI ara" (the chat looks); one alone when that is all there is)
      const drawer = on.ask && on.ask !== on.ai ? on.ask : null;
      const search = drawer ? (
        <button type="button" className="q-pick q-rbtn q-self q-srch" onClick={(e) => (stop(e), drawer())}>
          <Ic name="search" size={14} stroke={2.4} />
          <span>{L("Ara", "Search")}</span>
        </button>
      ) : on.self ? (
        <a className="q-pick q-rbtn q-self q-srch" href={on.self.url} target="_blank" rel="noreferrer" onClick={stop} title={L(`${on.self.name} sitesinde ara`, `Search on ${on.self.name}`)}>
          <Ic name="search" size={14} stroke={2.4} />
          <span>{L("Ara", "Search")}</span>
          <span className="q-ext">↗</span>
        </a>
      ) : null;
      const ai = aiSearch(on);
      if (search || ai)
        return (
          <span className="q-two">
            {search}
            {ai}
          </span>
        );
      return on.ask ? (
        <button type="button" className="q-pick q-rbtn q-srch" onClick={(e) => (stop(e), on.ask?.())}>
          {L("Ara", "Search")}
        </button>
      ) : null;
    }
    case "pick":
      return (
        <button type="button" className="q-pick q-rbtn q-rsec" onClick={(e) => (stop(e), on.pick())} aria-label={L(`Seç · ${s.count} seçenek`, `Choose · ${s.count} options`)}>
          {L("Seç", "Choose")}
          {s.count > 1 && <b className="q-rmini">{s.count}</b>}
        </button>
      );
    case "take":
      // (one option waiting for a yes: picked, it's in the plan; "Bunu seç" no more, onay paketi 2026-10-22)
      return (
        <button type="button" className="q-pick q-take q-rbtn" onClick={(e) => (stop(e), on.take())}>
          {L("Seç", "Choose")}
        </button>
      );
    case "book":
      return on.page ? (
        <a className="q-cta q-rbtn" href={on.page} target="_blank" rel="noreferrer" onClick={(e) => (stop(e), on.asked?.())} title={on.brand ? L(`${on.brand} sitesinde aç`, `Open on ${on.brand}`) : undefined}>
          {logo}
          <span>{s.word}</span>
          <span className="q-ext">↗</span>
        </a>
      ) : (
        <button type="button" className="q-pick q-take q-rbtn" onClick={(e) => (stop(e), on.got())}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    case "got":
      return (
        <button type="button" className="q-got q-rbtn" onClick={(e) => (stop(e), on.got())}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    case "proof":
      // (Karar Masası: bought, the button goes; a green stub with its stamp, "Bileti ekle" a link on it)
      if (view.stamp)
        return (
          <span className="q-rstub q-rkoc">
            <Stamp word={view.stamp.word} day={view.stamp.day} />
            {on.proof ? (
              <button type="button" className="q-proof q-lnk" onClick={(e) => (stop(e), on.proof?.())}>
                {s.word}
              </button>
            ) : (
              <small>{view.stageWord}</small>
            )}
          </span>
        );
      return on.proof ? (
        <button type="button" className="q-proof q-rbtn" onClick={(e) => (stop(e), on.proof?.())}>
          <Ic name="clip" size={14} stroke={2.2} />
          {s.word}
        </button>
      ) : (
        <span className="q-st q-rhap ok">
          <Ic name="check" size={12} stroke={3.2} />
          {view.stageWord}
        </span>
      );
    case "onsite":
      return (
        <span className="q-onsite q-rhap">
          <Ic name="pin" size={14} />
          {s.text}
        </span>
      );
    case "none":
      return view.figure?.code ? <Stub fig={view.figure} /> : null;
    case "hap":
      return (
        <span className={`q-st q-rhap ${s.tone}`}>
          {s.tone !== "arr" && <Ic name="check" size={12} stroke={3.2} />}
          {s.text}
        </span>
      );
  }
}

/**
 * The mark on a row's left: the carrier's logo once one is known, else the kind's icon (MingCute, dark on a soft tile: a train
 * from the side, a taxi from the front); the step's mark on its corner (onay paketi 2026-10-22).
 */
function TicketMark({ vm, view, art, add = null }: { vm: IntentVM; view: RowView; art: string; add?: (() => void) | null }) {
  const face = ticketFace(vm);
  const known = vm.chosen && face?.mark && face.mode !== "car";
  // (Karar Masası: nothing found yet, the corner is a "+" to bring what one found; chosen, its mark half full)
  const plus = view.desk && view.slot.kind === "self" && add;
  return (
    <span className={`q-rmark${known ? " carr" : " ic"}${view.busy ? " busy" : ""}`}>
      <span className="q-rmi" aria-hidden>
        {known ? <CarrierLogo mark={face!.mark} art={art} /> : <ModeIcon name={modeIconOf(vm.kind, vm.ticket?.mode ?? null)} />}
      </span>
      {plus ? (
        <button
          type="button"
          className="q-sb q-sadd"
          aria-label={L("Bulduğunu ekle", "Add what you found")}
          title={L("Bulduğunu ekle: bağlantı ya da ekran görüntüsü", "Add what you found: a link or a screenshot")}
          onClick={(e) => (e.stopPropagation(), add())}
          onKeyDown={(e) => e.stopPropagation()}
        >
          +
        </button>
      ) : (
        <StageBadge stage={view.stage} half={view.desk && view.stage === "planned" && vm.status === "chosen"} />
      )}
    </span>
  );
}

/**
 * Karar Masası's deck (karar 4, "deste C"): three of its cards fanned on the mark's place, the best one in front, its
 * carrier's logo on each; two thin lilac sheets under the card say there are more (CSS).
 */
function DeckFan({ options, art }: { options: OptionVM[]; art: string }) {
  const best = deckLead(options);
  const top = [...(best ? [best] : []), ...options.filter((o) => o !== best)].slice(0, 3).reverse();
  const turn = top.length === 3 ? [-16, 0, 16] : top.length === 2 ? [-9, 9] : [0];
  return (
    <span className="q-rmark q-fan" aria-hidden>
      {top.map((o, i) => (
        <span key={o.id} style={{ "--turn": `${turn[i]}deg` } as React.CSSProperties}>
          <CarrierLogo mark={carrierMark(o.carrier, o.item)} art={art} small />
        </span>
      ))}
    </span>
  );
}

/** A deck of the options' carriers (three logos crossed), for a ticket's Birikenler. */
function CarrierDeck({ options, art }: { options: OptionVM[]; art: string }) {
  return (
    <span className="q-rdeck" aria-hidden>
      {options.slice(0, 3).map((o) => (
        <i key={o.id}>{o.carrier?.brand ? <Mark color={o.carrier.brand.color ?? "#6b6f80"} letter={(o.carrier.brand.label ?? o.title).slice(0, 2)} small /> : <img src={art} alt="" />}</i>
      ))}
    </span>
  );
}

export interface TicketRowProps {
  vm: IntentVM;
  view: RowView;
  art: string;
  date: RailDate | null;
  on: SlotOn;
  /** Its ticket under it once pressed (FrameTicket in its row's form); null while there's nothing to show but the search. */
  ticket: ReactNode;
  links: SelfSearch[];
  /** The options' list beside the plan (IntentDrawer). */
  onDrawer: (() => void) | null;
  /** Its menu (⋯): Değiştir, Ayrıntı, Pano'da aç, Ben hallettim, Gerek yok. */
  menu: ReactNode;
  /** Under the open ticket: Aldım, Değiştir, the source. */
  acts: ReactNode;
  chipId: string;
  editable: boolean;
  /** The details (⋯ Ayrıntı) under the row, open or not. */
  under?: ReactNode;
  /** Opened from outside: a field of its ticket to fill in place (a plan just added, its first empty field). */
  focused?: boolean;
  /** "Aldım"'s box under the row (ProofAsk): its code or its file, or marked without. */
  ask?: ReactNode;
  /** What its open state follows: its record (the intent's key changes as its ends are typed), else the intent. */
  openKey?: string;
  /** Karar Masası, getirme anları: a link or a screenshot dropped on the row goes to it. */
  bring?: ((got: Brought) => void) | null;
  /** Under the row: what was brought, being read, then where it stands ("Kiwi.com okundu · 5. aday"). */
  brought?: ReactNode;
}

/** What a drop or a paste carries: its files, else its links. */
export interface Brought {
  files: File[];
  links: string;
}

/** The files or the links a drop carries; null when it carries neither (a drag from the page itself). */
export function broughtOf(dt: DataTransfer): Brought | null {
  if (!carriesArrival(dt)) return null;
  const files = [...dt.files];
  const links = files.length ? "" : droppedLinks(dt);
  return files.length || links ? { files, links } : null;
}

/** A flight, a train, a bus, a boat, a transfer: one thin row; pressed, its ticket (or its search) opens under it. */
export function TicketRow({ vm, view, art, date, on, ticket, links, onDrawer, menu, acts, chipId, editable, under = null, focused = false, openKey, ask = null, bring = null, brought = null }: TicketRowProps) {
  // (Karar Masası: chosen, the flight comes open as its ticket; it can be closed. Bought, it stays closed until opened:
  // 2026-10-24, Emre: "uçak bileti book edildiyse kategoriyi açınca otomatik açılmasın")
  const [open, setOpen] = useRowOpen(openKey ?? vm.key, view.desk && vm.status === "chosen");
  // (getirme anları: dragged over, the row says it will take it; dropped, it is this row's, never the board's guess)
  const [over, setOver] = useState(false);
  const drop = bring
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!carriesArrival(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!carriesArrival(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          setOver(false);
          const got = broughtOf(e.dataTransfer);
          if (!got) return;
          e.preventDefault();
          e.stopPropagation();
          bring(got);
        },
      }
    : {};
  // (its ends and hour edit on the ticket under it: opened when a field there is asked for)
  useEffect(() => {
    if (focused && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on being asked only
  }, [focused]);
  const panelId = useId();
  const face = ticketFace(vm);
  const logo = face?.mark && face.mode !== "car" ? <CarrierLogo mark={face.mark} art={art} small /> : null;
  const deciding = view.slot.kind === "pick";
  // (Karar Masası: a flight's deck opens the drawer itself, "Seç 7"; the row has nothing of its own to unfold)
  const deck = view.desk && deciding;
  const press = () => (deck ? on.pick() : setOpen(!open));
  // (Karar Masası: while the AI or the source looks, the hours and the price load where they will stand)
  const loading = Boolean(view.busy) && !deciding;
  const all = [...(vm.chosen ? [vm.chosen] : []), ...vm.options, ...(vm.more ?? [])].filter((o, i, list) => list.findIndex((x) => x.id === o.id) === i);
  // (Karar Masası: chosen, the deck stays under it; "↩ 6 seçenek daha" opens the drawer, the chosen one marked there)
  const rest = view.desk && !deck && onDrawer ? (view.rest ?? 0) : 0;
  const body = deck ? null : deciding ? (
    <div className="q-rp2">
      <div className="q-rhalf">
        <span className="q-rht">{L("Birikenler", "Saved so far")}</span>
        <div className="q-rhb">
          <CarrierDeck options={all} art={art} />
          <span className="q-rhs">
            <b>{L(`${view.count} seçenek`, `${view.count} options`)}</b>
            {view.figure && <span>{[view.figure.big, view.figure.small].filter(Boolean).join(" · ")}</span>}
          </span>
        </div>
        <button type="button" className="q-pick" onClick={() => on.pick()}>
          {L("Seçenekleri aç", "Open the options")}
        </button>
      </div>
      <div className="q-rhalf">
        <span className="q-rht">{L("Yeni bul", "Find more")}</span>
        <SelfLinks links={links} label={false} />
        {onDrawer && (
          <button type="button" className="q-chg" onClick={onDrawer}>
            {L("Bağlantı bırak", "Drop a link")}
          </button>
        )}
      </div>
    </div>
  ) : (
    ticket
  );
  return (
    <div className={`q-row${open && !deck ? " open" : ""}${over ? " drop" : ""}${rest ? " rest" : ""}`} data-face="ticket" {...drop}>
      <RailCol date={date} editable={editable} />
      <div className="q-rcard">
        <div
          className="q-rrow"
          role="button"
          tabIndex={0}
          aria-expanded={deck ? undefined : open}
          aria-haspopup={deck ? "dialog" : undefined}
          aria-controls={open && !deck ? panelId : undefined}
          aria-describedby={chipId}
          onClick={press}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            press();
          }}
        >
          {deck ? <DeckFan options={all} art={art} /> : <TicketMark vm={vm} view={view} art={art} add={on.add} />}
          <span className="q-rhd">
            <Lead view={view} />
            <h4 className="q-nm" title={view.title}>
              {view.route && view.desk ? (
                <>
                  {view.route.from}{" "}
                  <i className={`q-rpl${modeIconOf(vm.kind, face?.mode ?? null) === "plane" ? " fly" : ""}`}>
                    <ModeIcon name={modeIconOf(vm.kind, face?.mode ?? null)} size={15} />
                    {/* (said as the arrow it stands for: a screen reader's and a search's "Porto → Lizbon") */}
                    <span className="sr-only">→</span>
                  </i>{" "}
                  {view.route.to}
                </>
              ) : view.route ? (
                <>
                  {view.route.from} <i>→</i> {view.route.to}
                </>
              ) : (
                view.title
              )}
            </h4>
            {face?.name && vm.chosen && face.mode !== "car" && <span className="z-carl sr-only">{[face.name, face.sub].filter(Boolean).join(" ")}</span>}
            <Parts parts={view.line} />
            {loading && <i className="q-rsk w64" aria-hidden />}
          </span>
          {loading ? (
            <span className="q-rfig" aria-hidden>
              <i className="q-rsk w52" />
            </span>
          ) : (
            <Figure fig={view.slot.kind === "none" ? null : view.figure} editable={editable && (vm.status === "chosen" || vm.status === "suggested" || vm.status === "arranged")} blank={editable && vm.status === "arranged" && !vm.selfArranged} />
          )}
          <span className="q-rslot" id={chipId}>
            <Slot view={view} on={on} logo={logo} />
          </span>
          <span className="q-rmenu" onClick={(e) => e.stopPropagation()}>
            {menu}
          </span>
        </div>
        {over && (
          <div className="q-rdrop" aria-hidden>
            <b>{L("Bırak: bu satıra", "Drop it on this row")}</b>
            <small>{L("bağlantı ya da ekran görüntüsü; okuyup desteye koyarız", "a link or a screenshot; we read it and add it to the deck")}</small>
          </div>
        )}
        {brought}
        {ask}
        <div className="q-rp" id={panelId} hidden={!open || deck}>
          {open && body}
          {open && acts && <div className="q-racts">{acts}</div>}
        </div>
        {under}
        {rest > 0 && onDrawer && (
          <button type="button" className="q-more" onClick={onDrawer} aria-label={L(`Öteki ${rest} seçenek`, `The other ${rest} options`)}>
            {L(`↩ ${rest} seçenek daha`, `↩ ${rest} more ${rest === 1 ? "option" : "options"}`)}
          </button>
        )}
      </div>
    </div>
  );
}

/** A stay's picture (its first photo, else its kind's drawing), its site's score in the corner, the seal once booked. */
function StayPhoto({ vm, view, art }: { vm: IntentVM; view: RowView; art: string }) {
  const o = vm.chosen ?? null;
  const photo = o?.image ?? vm.head.image ?? null;
  const rating = ratingParts(o?.rating ?? null);
  // (a deck: nothing chosen yet, or our pick among several in front of it, 0.40.5)
  const deck = view.slot.kind === "pick" && (!o || vm.status === "suggested");
  if (deck) {
    // (the hotels' own photos when they have them, our pick in front; a drawing only for a deck with no photo at all)
    const every = [...(o ? [o] : []), ...vm.options, ...(vm.more ?? [])].filter((x, i, list) => list.findIndex((y) => y.id === x.id) === i);
    const shot = every.filter((x) => x.image);
    const all = (shot.length ? shot : every).slice(0, 3);
    return (
      <span className="q-rph deck" aria-hidden>
        {all.map((x, i) => (
          <i key={x.id} style={{ "--n": i } as React.CSSProperties}>
            {x.image ? <img src={x.image} alt="" /> : <img className="art" src={art} alt="" />}
          </i>
        ))}
        <StageBadge stage={view.stage} />
      </span>
    );
  }
  return (
    <span className={`q-rph${photo ? " photo" : ""}${vm.status === "searching" ? " todo" : ""}`} aria-hidden>
      {photo ? <img src={photo} alt="" /> : <img className="art" src={art} alt="" />}
      {rating && <b className={`q-rb${rating.star ? " star" : ""}`}>{rating.score}</b>}
      <StageBadge stage={view.stage} />
    </span>
  );
}

export interface StayCardProps {
  vm: IntentVM;
  view: RowView;
  art: string;
  date: RailDate | null;
  on: SlotOn;
  /** Pressing the card: the drawer (its options; Değiştir once chosen), a booking's details, or the search. */
  onPress: (() => void) | null;
  menu: ReactNode;
  /** Under it: a booking's green strip, a rental's licence, the details' layer. */
  foot: ReactNode;
  under: ReactNode;
  chipId: string;
  editable: boolean;
  /** "Aldım"'s box under the card, in its foot's place (ProofAsk). */
  ask?: ReactNode;
  /** Its notes folded to one small line while the card is closed ("⏱ Giriş saati"); pressed, the card opens. */
  hint?: ReactNode;
}

/** A stay or a rental: a card that doesn't fold; its picture on the left, three lines, one figure, one thing on the right. */
export function StayCard({ vm, view, art, date, on, onPress, menu, foot, under, chipId, editable, ask = null, hint = null }: StayCardProps) {
  const press = onPress
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onPress,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onPress();
        },
      }
    : {};
  // (chosen among several: the deck stays under it, "↩ 2 seçenek daha" opens the drawer, as a flight's: 0.40.5)
  const rest = onPress ? (view.rest ?? 0) : 0;
  return (
    <div className={`q-row${rest ? " rest" : ""}`} data-face="card">
      <RailCol date={date} editable={editable} blank />
      <div className="q-rcard">
        <div className={`q-rrow card${onPress ? " tap" : ""}`} aria-describedby={chipId} {...press}>
          <StayPhoto vm={vm} view={view} art={art} />
          <span className="q-rhd">
            <Lead view={view} />
            <h4 className="q-nm" title={view.title}>
              {editable ? <Editable field="name">{view.title}</Editable> : view.title}
            </h4>
            <Parts parts={view.line} />
            {view.wants.length > 0 ? (
              <span className="q-rwants">
                {view.wants.slice(0, 3).map((w) => (
                  <span key={w.label} className={w.must ? "must" : undefined}>
                    {w.label}
                  </span>
                ))}
                {view.wants.length > 3 && <span>+{view.wants.length - 3}</span>}
              </span>
            ) : (
              <Parts parts={view.third} cls="q-rln q-r3" />
            )}
            {hint}
          </span>
          <Figure fig={view.slot.kind === "none" ? null : view.figure} editable={editable && (vm.status === "chosen" || vm.status === "suggested")} blank={editable && vm.status === "chosen"} />
          <span className="q-rslot" id={chipId}>
            <Slot view={view} on={on} logo={null} />
          </span>
          <span className="q-rmenu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {menu}
          </span>
        </div>
        {ask ?? foot}
        {under}
        {rest > 0 && onPress && (
          <button type="button" className="q-more" onClick={onPress} aria-label={L(`Öteki ${rest} seçenek`, `The other ${rest} options`)}>
            {L(`↩ ${rest} seçenek daha`, `↩ ${rest} more ${rest === 1 ? "option" : "options"}`)}
          </button>
        )}
      </div>
    </div>
  );
}

/** A short open stretch between two stays (onay paketi: "boş gece amber"): which night, why, and its one button. */
export function EmptyNight({ date, title, line, onAsk, menu }: { date: RailDate | null; title: string; line: string | null; onAsk: (() => void) | null; menu: ReactNode }) {
  return (
    <div className="q-row gap" data-face="gap">
      <RailCol date={date} editable={false} />
      <div className="q-rcard gap">
        <div className="q-rrow gap">
          <span className="q-rgi" aria-hidden>
            <Ic name="moon" size={16} />
          </span>
          <span className="q-rhd">
            <h4 className="q-nm">{title}</h4>
            {line && <span className="q-rln">{line}</span>}
          </span>
          <span className="q-rslot">
            {onAsk && (
              <button type="button" className="q-got q-rbtn" onClick={onAsk}>
                {L("Ara", "Search")}
              </button>
            )}
          </span>
          <span className="q-rmenu">{menu}</span>
        </div>
      </div>
    </div>
  );
}

/** Two stays for one night (Kaçırdıklarımız 3): the empty night's opposite, red, with its one way out. */
export function OverlapRow({ title, line, night, onFix }: { title: string; line: string; night: string; onFix: (() => void) | null }) {
  return (
    <div className="q-row clash" data-face="clash" role="alert">
      <RailCol date={{ when: shortDay(night), sub: weekdayLong(night), span: null, notches: 0 }} editable={false} />
      <div className="q-rcard clash">
        <div className="q-rrow gap">
          <span className="q-rgi" aria-hidden>
            ⚠
          </span>
          <span className="q-rhd">
            <h4 className="q-nm">{title}</h4>
            <span className="q-rln">{line}</span>
          </span>
          <span className="q-rslot">
            {onFix && (
              <button type="button" className="q-got q-rbtn" onClick={onFix}>
                {L("Birini kısalt", "Shorten one")}
              </button>
            )}
          </span>
          <span className="q-rmenu" />
        </div>
      </div>
    </div>
  );
}
