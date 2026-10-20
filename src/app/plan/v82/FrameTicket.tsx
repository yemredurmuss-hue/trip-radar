// The ticket family's fixed frame (plan v82 "niyet kutusu standardı" bilet; v80, v81 alındı; v83 "Diğer türler" and "Uçuş
// günü"): a flight, a train, a transfer, a bus, a boat, a rented car, a pass. On the left the ticket: the carrier's line
// (its mark, the service or the airline bold, the number or the operator and class small: "Nozomi" · "JR · Shinkansen"),
// the two ends big with the airport or the station and the hour under them, the way's drawing between them with the length
// and the stops, and under it the chips (the bag, the platform, what a pass covers) or a connecting flight's two stubs
// (D7); on its day a booked flight's chips turn into the live strip (C4). On the right the same side column as the stay
// family's (FrameCard), by state:
//   Önerimiz   what one pays and how many go · "Bunu seç" · Değiştir and the site ↗ (B11);
//   Seçildi    the price · "Bileti al ↗" · "✓ Aldım" and Değiştir;
//   Alındı     "✓ Bilet alındı", the code and copy, "€… ödendi" (B10), the e-ticket or a dashed "Bileti ekle", from 48
//              hours before the check-in (F2); the seats, or on the flight's day the new times ("Planı yeni saate kaydırdım.");
//   Ayarlandı  sorted out ("sen hallettin"), "Fiyat ekle", Değiştir;
//   Dahil      covered by a pass, a car or a package ("Hakone Free Pass ile") and the button that goes to it ("Pass'i aç");
//   Aranıyor   the two ends, the estimate, "Kendin ara" and "AI'dan öner"; a change of city nobody planned draws its ways
//              (C15, ModePicker) in the route's place, the road from an airport in another city Önerimiz's two (WayPicks).
// Only what the record says is drawn (C19); the frame is as tall in every state, live or late (288 px with its head).
import { useEffect, useState, type ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { codeLabel, emptyLine, type SelfSearch } from "../../../lib/intentFrame";
import type { OptionVM } from "../../../lib/intents";
import { flightDays, flightPrice } from "../../../lib/offerSources";
import { dayBars, daysSentence, fareEach, historyDrawing, historySentence, priceAsk, verdictOf, type DayFare, type PriceInsight, type Verdict } from "../../../lib/priceVerdict";
import type { Item } from "../../../lib/types";
import { checkinUrl, ownEnds, ticketBookedWord, ticketBookWord, ticketCodeLabel, ticketDocWord, ticketFace, ticketPrice, wayPicks, type TicketFace } from "../../../lib/ticketFrame";
import type { TicketChip, TicketEnd, TicketLive as Live, TicketMode } from "../../../lib/ticketView";
import type { LegMode } from "../../../lib/types";
import type { FieldKey } from "../../../lib/inlineEdit";
import { Editable, useInlineEdit } from "../../cards/InlineEdit";
import { useCardEnv } from "../../cards/PlanCard";
import { WhoseBadge } from "../../cards/WhoseBadge";
import { flysIn } from "../../motion";
import { CopyCode } from "./DetailLayer";
import { AgreeRoute, type FrameCardProps } from "./FrameCard";
import { Ic, Mark } from "./icons";
import { ModePicker, WayPicks } from "./ModePicker";
import { useV82Env } from "./v82Env";
import { BagIcon, CarrierLogo } from "./OptionRow";
import { LiveStage, TicketLive } from "./TicketLive";

/** What the ticket frame takes: what the stay family's does, and what only a ticket has. */
export interface FrameTicketProps extends FrameCardProps {
  /** Dahil: goes to what covers it ("Pass'i aç", "Festival biletini aç"); null when it isn't on the plan. */
  onCover: (() => void) | null;
  /** C15: a change of city nobody planned: a way picked, or "Ben hallettim". */
  ways: { pick: (mode: LegMode) => void; own: () => void } | null;
  /**
   * A change of city with only its way said (no ticket of its own): "✓ Aldım" says its ticket is bought (as its old card's
   * "Bileti aldım"), Değiştir takes the way back to the choice (C15).
   */
  onReset: (() => void) | null;
  onLegGot: (() => void) | null;
}

const NBSP = " ";

/**
 * One end of the ticket: its city big, its station or code and its hour small. A record's own end and hour edit where they
 * stand (C2: "Nereden", "Nereye", "Saat"); an end not known yet is the field's faint prompt then, else nothing.
 */
function End({ end, right = false, field = null, timed = false }: { end: TicketEnd | null; right?: boolean; field?: FieldKey | null; timed?: boolean }) {
  const edit = useInlineEdit();
  const can = (f: FieldKey | null) => f != null && Boolean(edit?.fields.includes(f));
  const cls = `q-tm big q-city${right ? " r" : ""}`;
  if (!end && !can(field)) return <span className={cls} />;
  const hour = end?.time ? <strong>{end.time}</strong> : null;
  const clock = timed && can("time");
  const small = Boolean(end?.place) || Boolean(hour) || clock;
  return (
    <span className={cls}>
      <b title={end?.city}>{field ? <Editable field={field}>{end?.city}</Editable> : end?.city}</b>
      {small && (
        <small>
          {end?.place && <span className="q-tplace" title={end.place}>{end.place}</span>}
          {end?.place && (hour || clock) ? <span className="q-tsep">{" · "}</span> : ""}
          {clock ? <Editable field="time">{hour}</Editable> : hour}
          {end?.plus ? <sup>+{end.plus}</sup> : null}
        </small>
      )}
    </span>
  );
}

/** The fields a ticket's ends edit (inlineEdit.editableFields): a trip's from, to and hour; a rental's place and its return day. */
function endFields(face: TicketFace): { from: FieldKey | null; to: FieldKey | null } {
  if (face.stubs.length) return { from: null, to: null };
  if (face.mode === "car") return { from: "city", to: "end" };
  if (face.mode === "pass") return { from: "from", to: null };
  return { from: "from", to: "to" };
}

function Chip({ chip }: { chip: TicketChip }) {
  const icon = chip.kind === "bag" ? <BagIcon /> : chip.kind === "where" || chip.kind === "platform" ? <Ic name="pin" size={12} /> : chip.kind === "covers" ? <Ic name="check" size={12} stroke={2.6} /> : chip.kind === "night" || chip.kind === "warn" ? <span aria-hidden="true">⚠</span> : null;
  return (
    <span className={chip.kind === "night" || chip.kind === "warn" ? "z-chip night" : "z-chip"} title={chip.text}>
      {icon}
      {chip.text}
    </span>
  );
}

/** The ticket's left part: the carrier's line, the route (or C15's ways), the chips, the stubs or the live strip. */
function TicketMain({ face, art, live, carrier, route, line, dated = true, badge = null, fly = false }: {
  face: TicketFace;
  /** D9: the plane glides to its route (the first time this session draws the flight). */
  fly?: boolean;
  /** Kişiye özel: whose ticket it is ("Sabine'in bileti"), after the carrier; nothing for everyone's. */
  badge?: ReactNode;
  /** The intent's head says its day; without one the carrier line holds its day's prompt (C2). */
  dated?: boolean;
  art: string;
  live: Live | null;
  /** The carrier line's text in place of the carrier's own (Aranıyor: "Henüz seçenek yok"). */
  carrier?: ReactNode;
  /** The route's place taken by something else (C15's ways). */
  route?: ReactNode;
  /** The line under the route before the chips (the estimate). */
  line?: ReactNode;
}) {
  return (
    <div className="z-tm">
      <div className="z-car">
        {carrier ? (
          <span className="z-cn">{carrier}</span>
        ) : (
          <>
            <CarrierLogo mark={face.mark} art={art} />
            <span className="z-cn">
              <b title={face.name}>{face.name}</b>
              {face.sub ? <small>{face.sub}</small> : !dated && <small><Editable field="date" /></small>}
            </span>
          </>
        )}
        {badge}
        <LiveStage live={live} />
      </div>
      {route ?? (
        <div className="q-route z-route">
          <End end={face.from} field={endFields(face).from} timed={face.mode !== "car" && face.mode !== "pass" && !face.stubs.length} />
          <span className="q-mid big">
            <small>{face.mid.top ?? NBSP}</small>
            <i>
              <img className={fly ? "z-fly" : undefined} src={art} alt="" />
            </i>
            <small className={face.mid.tone ?? undefined}>{face.mid.bottom ?? NBSP}</small>
          </span>
          <End end={face.to} field={endFields(face).to} right />
        </div>
      )}
      {live ? (
        <TicketLive live={live} />
      ) : (
        <span className="z-l3">
          {line}
          {face.stubs.map((s) => (
            <span key={s.itemId} className="z-chip z-stub" data-item-id={s.itemId} title={s.text}>
              <Ic name="plane" size={12} />
              {s.text}
            </span>
          ))}
          {face.chips.map((c) => (
            <Chip key={`${c.kind}:${c.text}`} chip={c} />
          ))}
        </span>
      )}
    </div>
  );
}

function Side({ top, primary, row }: { top: ReactNode; primary: ReactNode; row: ReactNode }) {
  return (
    <div className="z-s">
      <div className="z-top">{top}</div>
      <div className="z-bt">
        {primary}
        <div className="z-row">{row}</div>
      </div>
    </div>
  );
}

function Price({ o, mode }: { o: OptionVM; mode: TicketMode }) {
  const p = ticketPrice(o, mode);
  return (
    <Editable field="price">
      {p && (
        <span className="q-pr big">
          <b>{p.big}</b>
          {p.small && <small>{p.small}</small>}
        </span>
      )}
    </Editable>
  );
}

function Frame({ cls = "", info, title, main, side, detail }: { cls?: string; info: FrameCardProps["info"]; title: string; main: ReactNode; side: ReactNode; detail: ReactNode }) {
  return (
    <div className={`z-f z-tk${cls}`}>
      {info && (
        <button type="button" className="z-ib q-inf" aria-label={L(`${title}: ayrıntı`, `${title}: details`)} aria-expanded={info.open} title={L("Ayrıntı", "Details")} onClick={info.toggle}>
          <i>i</i>
        </button>
      )}
      {main}
      {side}
      {info?.open && detail}
    </div>
  );
}

/**
 * A flight's fare judged (spec 2026-10-19 SerpApi, items 2 and 4): asked once per route and day while the card shows a
 * fare not yet bought; null until it comes, and when there is none.
 */
function useFareInsight(item: Item | null, today: string): { insight: PriceInsight | null; days: DayFare[]; day: string | null } {
  const ask = item ? priceAsk(item, today) : null;
  const key = ask ? `${ask.from}|${ask.to}|${ask.day}` : "";
  const [got, setGot] = useState<{ key: string; insight: PriceInsight | null; days: DayFare[] } | null>(null);
  useEffect(() => {
    if (!ask) return;
    let live = true;
    // Google's judgement (item 2, 4) and the day either side (item 5) come in together; either may be missing.
    Promise.all([flightPrice(ask).catch(() => null), flightDays(ask).catch(() => [])]).then(([insight, days]) => live && setGot({ key, insight, days }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only when the route or the day changes
  }, [key]);
  return got?.key === key ? { insight: got.insight, days: got.days, day: ask?.day ?? null } : { insight: null, days: [], day: null };
}

const FARE_W = 640;
const FARE_H = 120;

/** Under the card, when its pill is tapped: the fare's last weeks, Google's usual range as a band, what it means. */
function FarePanel({ insight, verdict, each, days, day }: { insight: PriceInsight | null; verdict: Verdict; each: number | null; days: DayFare[]; day: string | null }) {
  const d = insight ? historyDrawing(insight, FARE_W, FARE_H, each) : null;
  const said = insight ? historySentence(insight, Date.now()) : null;
  const bars = day ? dayBars(days, day) : [];
  return (
    <div className="z-pvp" role="region" aria-label={L("Fiyat geçmişi", "Fare history")}>
      {d && (
      <div className="z-pvc">
      <b className="z-pvh">{L("Fiyat nasıl değişti", "How the fare moved")}</b>
      {d && (
        <svg className="z-pvg" viewBox={`-6 -6 ${FARE_W + 12} ${FARE_H + 12}`} aria-hidden="true">
          {d.band && <rect className="band" x={0} y={d.band.y} width={FARE_W} height={Math.max(2, d.band.h)} rx={4} />}
          <polyline className="line" points={d.points} />
          <circle className="dot" cx={d.last.x} cy={d.last.y} r={6} />
          {d.mark != null && each != null && (
            <>
              <line className="mark" x1={0} x2={FARE_W} y1={d.mark} y2={d.mark} />
              <text className="markt" x={4} y={d.mark > 30 ? d.mark - 8 : d.mark + 26}>
                {L(`bu kart €${Math.round(each)}`, `this card €${Math.round(each)}`)}
              </text>
            </>
          )}
        </svg>
      )}
      {(said || d?.band) && (
        <small className="z-pvs">
          {said}
          {said && d?.band ? " · " : ""}
          {d?.band ? L("mor bant: bu rota için normal aralık", "band: the usual range on this route") : ""}
        </small>
      )}
      <small className="z-pvsrc">{insight?.source === "google" ? L("Kaynak: Google Flights, kişi başı", "Source: Google Flights, per person") : L("Kaynak: Trip Radar'ın gördüğü fiyatlar", "Source: fares Trip Radar has seen")}</small>
      </div>
      )}
      {bars.length > 0 && day && (
        <div className="z-pvc">
          <b className="z-pvh">{L("Hangi gün uçarsan · kişi başı", "By the day you fly · per person")}</b>
          <div className="z-pvb" role="list">
            {bars.map((b) => (
              <span key={b.day} role="listitem" className={`z-pvbar${b.chosen ? " on" : ""}${b.cheapest ? " low" : ""}`} aria-label={`${b.label}: €${b.price}`}>
                <small>€{b.price}</small>
                <i style={{ height: `${Math.round(b.share * 84)}px` }} />
                <em>{b.label}</em>
              </span>
            ))}
          </div>
          <small className="z-pvs">{daysSentence(days, day)}</small>
          <small className="z-pvsrc">{L("Kaynak: Kiwi ve Google Flights, bu haftanın en ucuzları", "Source: Kiwi and Google Flights, the week's cheapest")}</small>
        </div>
      )}
      {verdict.sentence && <p className={`z-pvf ${verdict.tone}`}>{verdict.sentence}</p>}
    </div>
  );
}

/** "Kendin ara" and the sites' marks (the empty frame's side column, as the stay family's). */
function SelfMarks({ links }: { links: SelfSearch[] }) {
  if (!links.length) return null;
  return (
    <>
      <small className="z-lbl">{L("Kendin ara", "Search yourself")}</small>
      <span className="z-pis">
        {links.map((l) => {
          // The map's directions say so ("Yol tarifi"); a site says where it looks ("Skyscanner'da ara", as the options' header).
          const said = l.said ? `${l.said} · ${l.name}` : l.id === "maps" ? L("Yol tarifi", "Directions") : L(`${l.name}'da ara`, `Search ${l.name}`);
          return (
            <a key={l.id} className="z-pi" href={l.url} target="_blank" rel="noopener noreferrer" title={said} aria-label={said}>
              <Mark color={l.color} letter={l.letter} />
              <span className="z-pin">{l.name}</span>
            </a>
          );
        })}
      </span>
    </>
  );
}

export function FrameTicket({ vm, form, page, links, info, detail, quiet, on, onCover, onAgree = null, ways, onReset, onLegGot }: FrameTicketProps) {
  const o = vm.chosen;
  const edit = useInlineEdit();
  const env = useCardEnv();
  const { selfAt } = useV82Env();
  const face = ticketFace(vm);
  // D9: a flight's plane glides to its route the first time this session draws it (once; a new frame of it doesn't again).
  const [fly] = useState(() => face?.mode === "flight" && flysIn(o?.item.id));
  // A transfer arranged by its way (metro, a taxi): Değiştir draws the ways again where the route is, until one is tapped.
  const [rechoose, setRechoose] = useState(false);
  // Items 2 and 4: the fare's pill under the price, and its history under the card when the pill is tapped.
  const fare = useFareInsight(form === "suggested" || form === "chosen" ? (o?.item ?? null) : null, env.today);
  const insight = fare.insight;
  const [fareOpen, setFareOpen] = useState(false);
  if (!face || !vm.ticket) return null;
  // The way's own drawing (a pass a train, a rental its car), between the ends and in place of a carrier's mark.
  const draw = `illus/${vm.ticket.art}.png`;
  const mine = o?.item ?? edit?.item ?? null;
  const badge = mine ? <WhoseBadge item={mine} trip={env.trip} /> : null;
  const title = vm.head.name;
  if ((form === "suggested" || form === "chosen") && o) {
    const brand = o.brand?.label ?? null;
    const primary =
      form === "suggested" ? (
        <button type="button" className="q-pick q-take" onClick={on.take}>
          {L("Bunu seç", "Pick this")}
        </button>
      ) : page ? (
        <a className="q-cta" href={page} target="_blank" rel="noreferrer" title={brand ? L(`${brand} sitesinde aç`, `Open on ${brand}`) : undefined}>
          {face.mark && <CarrierLogo mark={face.mark} art={draw} small />}
          <span>{ticketBookWord(face.mode)}</span>
          <span className="q-ext">↗</span>
        </a>
      ) : (
        <button type="button" className="q-pick q-take" onClick={on.got}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    const row =
      form === "suggested" ? (
        <>
          {on.change && <button type="button" className="q-chg" onClick={on.change}>{L("Değiştir", "Change")}</button>}
          {o.item.url && (
            <a className="q-srcl" href={page ?? o.item.url} target="_blank" rel="noreferrer">
              {brand ?? L("Sayfası", "Its page")} ↗
            </a>
          )}
        </>
      ) : (
        <>
          {page && (
            <button type="button" className="q-got" onClick={on.got}>
              <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
            </button>
          )}
          {on.change && <button type="button" className="q-chg" onClick={on.change}>{L("Değiştir", "Change")}</button>}
        </>
      );
    // The pill: Google's judgement; without it, the day either side alone still opens (item 5).
    const judged = insight && face.mode === "flight" ? verdictOf(fareEach(o.item), insight) : null;
    const verdict: Verdict | null = judged ?? (face.mode === "flight" && fare.days.length >= 3 ? { tone: "history", pill: L("Günlere göre fiyat", "Fares by day"), sentence: null } : null);
    const top = (
      <>
        <Price o={o} mode={face.mode} />
        {verdict && (
          <button type="button" className={`z-pv ${verdict.tone}`} aria-expanded={fareOpen} title={L("Fiyat geçmişini göster", "Show the fare's history")} onClick={() => setFareOpen((v) => !v)}>
            {verdict.pill}
          </button>
        )}
      </>
    );
    return (
      <>
        <Frame info={info} title={title} main={<TicketMain face={face} art={draw} fly={fly} dated={Boolean(vm.head.date)} badge={badge} live={null} />} side={<Side top={top} primary={primary} row={row} />} detail={detail} />
        {fareOpen && verdict && <FarePanel insight={insight} verdict={verdict} each={fareEach(o.item)} days={fare.days} day={fare.day} />}
      </>
    );
  }
  if (form === "booked" && o) {
    const a = vm.access;
    const label = a ? codeLabel(a) : null;
    const code = label ? ticketCodeLabel(face.mode, label) : null;
    const live = vm.ticket?.live ?? null;
    const doc = ticketDocWord(face.mode);
    const checkin = a?.primary === "checkin" ? checkinUrl(o.item) : null;
    const top = (
      <>
        <span className="z-ok">
          <Ic name="check" size={13} stroke={3} /> {ticketBookedWord(face.mode)}
        </span>
        {a?.code && code && (
          <span className="q-code st tk">
            <span className="z-cl">{code}</span>
            <CopyCode value={a.code.value} label={code} className="q-cv" />
          </span>
        )}
        {/* P3 (F28): no price on a booking: "Ne kadar ödedin?" opens the price, which the budget then counts. */}
        <small className={`z-paid${vm.paid ? "" : " ask"}`}>
          <Editable field="price">{vm.paid ?? ""}</Editable>
        </small>
        {a?.docMissing && <small className="z-docw">{L("belge yok", "no document")}</small>}
      </>
    );
    const openDoc = on.openDoc ? (
      <button type="button" className="q-open" onClick={on.openDoc}>
        <Ic name="clip" size={14} stroke={2.2} /> {doc.open}
      </button>
    ) : (
      <button type="button" className="q-doc add" onClick={on.addDoc}>
        <Ic name="clip" size={13} stroke={2.2} /> {doc.add}
      </button>
    );
    // F2: from 48 hours before it leaves, the check-in is the main button (the PNR above it); the e-ticket stays one tap away.
    const primary = checkin ? (
      <a className="q-open q-ckin" href={checkin} target="_blank" rel="noreferrer">
        {L("Online check-in", "Online check-in")} <span className="q-ext">↗</span>
      </a>
    ) : (
      openDoc
    );
    const row = live?.shift ? (
      <small className="z-shift">{live.shift}</small>
    ) : checkin ? (
      <button type="button" className="q-alk" onClick={on.openDoc ?? on.addDoc}>
        {on.openDoc ? doc.open : `+ ${doc.add}`}
      </button>
    ) : (
      face.note && <small className="z-note">{face.note}</small>
    );
    return <Frame cls=" bk" info={info} title={title} main={<TicketMain face={face} art={draw} fly={fly} dated={Boolean(vm.head.date)} badge={badge} live={live} />} side={<Side top={top} primary={primary} row={row} />} detail={detail} />;
  }
  // A way said done with no ticket of ours ("Ben hallettim" on a train) is drawn as sorted out, with what it is.
  if (form === "arranged" || form === "included" || (form === "booked" && !o)) {
    const inc = form === "included";
    const word = inc ? L("Dahil", "Included") : form === "booked" ? ticketBookedWord(face.mode) : L("Ayarlandı", "Arranged");
    const why = inc ? (vm.cover?.by ?? vm.note) : (vm.note ?? (o ? null : L("sen hallettin", "you sorted it")));
    const top = (
      <>
        <span className={inc ? "z-inc" : "z-gr"}>
          <Ic name="check" size={13} stroke={3} /> {word}
        </span>
        {why && <small className="z-note">{why}</small>}
        {!inc && (o?.price || edit?.open === "price") && (
          <span className="z-paid">
            <Editable field="price">{o?.price?.text}</Editable>
          </span>
        )}
      </>
    );
    const primary = inc ? (
      onCover && vm.cover ? (
        <button type="button" className="q-doc add z-goinc" onClick={onCover}>
          {vm.cover.open} ›
        </button>
      ) : null
    ) : o && !o.price && edit?.open !== "price" ? (
      <button type="button" className="q-doc add" onClick={() => (edit?.fields.includes("price") ? edit.go("price") : on.edit())}>
        {L("Fiyat ekle", "Add the price")}
      </button>
    ) : null;
    // (a way a rented car covers too: its other ways one tap away, 0.38.8)
    const reways = !o && ways != null && vm.modes.length > 0;
    const back = reways ? () => setRechoose(!rechoose) : (on.unarrange ?? onReset);
    const row = back && <button type="button" className="q-chg" onClick={back}>{rechoose && reways ? L("Vazgeç", "Cancel") : L("Değiştir", "Change")}</button>;
    const done = (then: () => void) => () => {
      setRechoose(false);
      then();
    };
    const route = rechoose && reways ? <ModePicker modes={vm.modes} current={vm.ticket?.wayMode ?? null} onPick={(mode) => done(() => ways.pick(mode))()} onOwn={done(ways.own)} /> : undefined;
    return <Frame cls={inc ? " ar inc" : " ar"} info={info} title={title} main={<TicketMain face={face} art={draw} fly={fly} dated={Boolean(vm.head.date)} badge={badge} live={null} route={route} />} side={<Side top={top} primary={primary} row={row} />} detail={detail} />;
  }
  // Aranıyor: nothing to choose yet. Only what is known is written (C19); a record still being filled in shows what it says.
  const own = edit && !o ? ownEnds(edit.item) : null;
  const empty = own ? { ...face, from: face.from ?? own.from, to: face.to ?? own.to } : face;
  // The estimate, and why it's asked for when it's what the category was told is missing (C16).
  const line = [emptyLine(vm), vm.note].filter(Boolean).join(" · ") || null;
  const day = vm.head.parts.find((p) => !/→/.test(p)) ?? null;
  const picking = ways != null && vm.modes.length > 0;
  // The road from an airport in another city: Önerimiz's usual ways first, the tiles one tap away.
  const picks = picking ? wayPicks(vm, selfAt) : [];
  const carrier = (
    <>
      <b className="z-dim">{picking ? L("Nasıl gideceğin belli değil", "How you'll go isn't decided") : L("Henüz seçilmedi", "Not chosen yet")}</b>
      {day ? <small>{day}</small> : <small><Editable field="date" /></small>}
    </>
  );
  const side = (
    <Side
      top={<SelfMarks links={links} />}
      primary={
        onAgree ? (
          <AgreeRoute onAgree={onAgree} />
        ) : (
          on.ask && (
            <button type="button" className="q-ai" onClick={on.ask}>
              <Ic name="spark" size={15} /> {L("AI'dan öner", "Ask the AI")}
            </button>
          )
        )
      }
      row={
        quiet && on.ask ? (
          <small className="z-aierr">
            {L("Henüz sonuç gelmedi", "Nothing came back yet")} ·{" "}
            <button type="button" className="z-retry" onClick={on.ask}>
              {L("Tekrar dene", "Try again")}
            </button>
          </small>
        ) : (
          <>
            {onAgree && on.ask && (
              <button type="button" className="q-chg" onClick={on.ask}>
                {L("AI'dan öner", "Ask the AI")}
              </button>
            )}
            {onLegGot && (
              <button type="button" className="q-got" onClick={onLegGot}>
                <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
              </button>
            )}
            {onReset && <button type="button" className="q-chg" onClick={onReset}>{L("Değiştir", "Change")}</button>}
          </>
        )
      }
    />
  );
  return (
    <Frame
      cls=" em"
      info={null}
      title={title}
      main={<TicketMain face={empty} art={draw} dated={Boolean(vm.head.date)} badge={badge} live={null} carrier={carrier} route={picking && ways ? picks.length ? <WayPicks picks={picks} modes={vm.modes} onPick={ways.pick} onOwn={ways.own} /> : <ModePicker modes={vm.modes} onPick={ways.pick} onOwn={ways.own} /> : undefined} line={line && <span className="q-est" title={line}>{line}</span>} />}
      side={side}
      detail={null}
    />
  );
}
