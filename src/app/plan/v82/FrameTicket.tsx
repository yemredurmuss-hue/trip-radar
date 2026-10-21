// The ticket family's fixed frame (plan v13, spec 2026-10-21 K79–K81, K84): a flight, a train, a transfer, a bus, a boat, a
// rented car, a pass, under the intent's roof (IntentHead says the route and, once chosen, the carrier). The picture zone
// (148) is the ticket itself: the two ends big with the airport or the station and the hour under them, the way's line between
// them in its mode's own drawing (a boat's waves, a train's rails, a bus's road; data-mode) with the length and the stops; a
// rented car its car. The line zone (64) holds the chips (the bag, the platform, what a pass covers), a connecting flight's
// stubs (D7) or, on its day, the live strip (C4), and the fare's pill (SerpApi items 2, 4, 5: its history opens over the
// card). The foot (58) by state:
//   Önerimiz   what one pays · "Bunu seç" (B2);
//   Seçildi    the price · "Bileti al ↗", then "Aldın mı? ✓ Evet · Henüz değil" (K80);
//   Alındı     the green seal: "€… ödendi" (B10) or "Ne kadar ödedin?" (P3) and "Onaylandı", or on the travel day the PNR
//              (show when needed); from 48 hours before it leaves the check-in is the main button (F2), else "Bileti aç";
//   Ayarlandı  sorted out ("sen hallettin"), "Fiyat ekle", Değiştir; Dahil the button that goes to what covers it;
//   Aranıyor   the two ends, the estimate, "Kendin ara" (two sites) and "Seçenek bul"; a change of city nobody planned
//              draws its ways (C15, ModePicker) in the route's place, the road from another city's airport Önerimiz's two.
// Only what the record says is drawn (C19); the frame is as tall in every state, live or late.
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
import { AgreeRoute, daysUntil, GotAsk, type FrameCardProps } from "./FrameCard";
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
 * One end of the ticket (K81, K84). A flight's speaks in airports: its hour big once known, else its code, the city dark
 * under it ("07:40" · "SAW İstanbul"); a boat's, a train's, a bus's in cities, its pier or station under it. A record's own
 * end and hour edit where they stand (C2: "Nereden", "Nereye", "Saat"); an end not known yet is the field's faint prompt.
 */
function End({ end, right = false, field = null, timed = false, air = false }: { end: TicketEnd | null; right?: boolean; field?: FieldKey | null; timed?: boolean; air?: boolean }) {
  const edit = useInlineEdit();
  const can = (f: FieldKey | null) => f != null && Boolean(edit?.fields.includes(f));
  const cls = `q-tm big q-city${right ? " r" : ""}`;
  if (!end && !can(field)) return <span className={cls} />;
  const clock = timed && can("time");
  const city = field ? <Editable field={field}>{end?.city}</Editable> : end?.city;
  if (air) {
    const code = end?.place && end.place.length <= 4 ? end.place : null;
    const hour = end?.time ? <>{end.time}{end?.plus ? <sup>+{end.plus}</sup> : null}</> : null;
    const big = hour ? (clock ? <Editable field="time">{hour}</Editable> : hour) : (code ?? city);
    return (
      <span className={`${cls} air`}>
        <b title={end?.city}>{big}</b>
        <small>
          {hour && code && <span className="q-tplace">{code}</span>}
          {(hour || code) && <span className="z-cty">{city}</span>}
          {!hour && !code && end?.place && <span className="q-tplace">{end.place}</span>}
        </small>
      </span>
    );
  }
  const hour = end?.time ? <strong>{end.time}</strong> : null;
  const small = Boolean(end?.place) || Boolean(hour) || clock;
  return (
    <span className={cls}>
      <b title={end?.city}>{city}</b>
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

/** The ticket's picture zone: its two ends and the way between them (or C15's ways in the route's place). */
function TicketMain({ face, art, route, fly = false }: { face: TicketFace; art: string; route?: ReactNode; fly?: boolean }) {
  if (route) return <div className="z-tm z-tmw">{route}</div>;
  if (face.mode === "car") {
    // A rented car is its car (K84): the drawing, as a stay's picture.
    return (
      <div className="z-tm z-car13">
        <img src={art} alt="" />
      </div>
    );
  }
  return (
    <div className="z-tm">
      <div className="q-route z-route">
        <End end={face.from} field={endFields(face).from} timed={face.mode !== "pass" && !face.stubs.length} air={face.mode === "flight"} />
        <span className="q-mid big">
          <small>{face.mid.top ?? NBSP}</small>
          <i>
            <img className={fly ? "z-fly" : undefined} src={art} alt="" />
          </i>
          <small className={face.mid.tone ?? undefined}>{face.mid.bottom ?? NBSP}</small>
        </span>
        <End end={face.to} field={endFields(face).to} right air={face.mode === "flight"} />
      </div>
    </div>
  );
}

/** The line zone: the live strip on the day, else the stubs and chips (and the estimate), with whose ticket it is. */
function TicketLine({ face, live, line = null, badge = null, after = null, fields = [] }: { face: TicketFace; live: Live | null; line?: ReactNode; badge?: ReactNode; after?: ReactNode; fields?: [string, string][] }) {
  // Nothing on the record to chip (no bag, no platform): the ticket's plain fields (K81: TARİH · YOLCU · SÜRE).
  if (!live && !line && !face.chips.length && !face.stubs.length && fields.length && face.mode !== "car") {
    return (
      <span className="z-fields z-f3">
        {fields.map(([k, v]) => (
          <span key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </span>
        ))}
        {badge}
        {after}
      </span>
    );
  }
  if (face.mode === "car" && (face.from || face.to)) {
    return (
      <span className="z-fields">
        {face.from && (
          <span>
            <small>{L("ALIŞ", "PICK-UP")}</small>
            <b>
              <Editable field={endFields(face).from ?? "city"}>{face.from.city}</Editable>
              {face.from.time ? ` · ${face.from.time}` : ""}
            </b>
          </span>
        )}
        {face.to && (
          <span>
            <small>{L("BIRAKIŞ", "RETURN")}</small>
            <b>{face.to.city}{face.to.time ? ` · ${face.to.time}` : ""}</b>
          </span>
        )}
        {after}
      </span>
    );
  }
  return (
    <span className="z-l3">
      {live ? (
        <>
          <LiveStage live={live} />
          <TicketLive live={live} />
        </>
      ) : (
        <>
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
        </>
      )}
      {badge}
      {after}
    </span>
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

function Frame({ cls = "", mode, main, line, foot, primary, row = null, layer, onOpen = null }: { cls?: string; mode: TicketMode; main: ReactNode; line: ReactNode; foot: ReactNode; primary: ReactNode; row?: ReactNode; layer: ReactNode; onOpen?: (() => void) | null }) {
  const open = onOpen ? { onClick: onOpen } : {};
  return (
    <div className={`z-f z-tk z13${cls}`} data-mode={mode}>
      <div className={`z-m${onOpen ? " z-op" : ""}`} {...open}>
        {main}
      </div>
      <div className={`z-i${onOpen ? " z-op" : ""}`} {...open}>
        {line}
      </div>
      <div className="z-s">
        <div className="z-top">{foot}</div>
        <div className="z-bt">
          {row && <div className="z-row">{row}</div>}
          {primary}
        </div>
      </div>
      {layer}
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

/** "Kendin ara": two sites' marks in the foot (as the stay family's), the map's directions said so. */
function SelfMarks({ links }: { links: SelfSearch[] }) {
  if (!links.length) return null;
  return (
    <span className="z-pis" aria-label={L("Kendin ara", "Search yourself")}>
      {links.slice(0, 2).map((l) => {
        const said = l.said ? `${l.said} · ${l.name}` : l.id === "maps" ? L("Yol tarifi", "Directions") : L(`${l.name}'da ara`, `Search ${l.name}`);
        return (
          <a key={l.id} className="z-pi" href={l.url} target="_blank" rel="noopener noreferrer" title={said} aria-label={said}>
            <Mark color={l.color} letter={l.letter} />
            <span className="z-pin">{l.name}</span>
          </a>
        );
      })}
    </span>
  );
}

export function FrameTicket({ vm, form, page, links, info, detail, quiet, on, onCover, onAgree = null, ways, onReset, onLegGot, onOpen = null }: FrameTicketProps) {
  const o = vm.chosen;
  const edit = useInlineEdit();
  const env = useCardEnv();
  const { selfAt } = useV82Env();
  const face = ticketFace(vm);
  // D9: a flight's plane glides to its route the first time this session draws it (once; a new frame of it doesn't again).
  const [fly] = useState(() => face?.mode === "flight" && flysIn(o?.item.id));
  // A transfer arranged by its way (metro, a taxi): Değiştir draws the ways again where the route is, until one is tapped.
  const [rechoose, setRechoose] = useState(false);
  const [asked, setAsked] = useState(false);
  // Items 2 and 4: the fare's pill on the line, and its history over the card when the pill is tapped.
  const fare = useFareInsight(form === "suggested" || form === "chosen" ? (o?.item ?? null) : null, env.today);
  const insight = fare.insight;
  const [fareOpen, setFareOpen] = useState(false);
  if (!face || !vm.ticket) return null;
  // The way's own drawing (a pass a train, a rental its car), between the ends and in place of a carrier's mark.
  const draw = `illus/${vm.ticket.art}.png`;
  const mine = o?.item ?? edit?.item ?? null;
  const badge = mine ? <WhoseBadge item={mine} trip={env.trip} /> : null;
  const layer = info?.open ? detail : null;
  const day = vm.head.parts.find((p) => !/→/.test(p) && !/gece|night/i.test(p)) ?? null;
  const people = vm.people ?? null;
  const fields: [string, string][] = [
    ...(day ? [[L("TARİH", "DATE"), day] as [string, string]] : []),
    ...(people ? [[L("YOLCU", "TRAVELLERS"), L(`${people} kişi`, `${people}`)] as [string, string]] : []),
    ...(face.mid.top ? [[L("SÜRE", "LENGTH"), face.mid.top] as [string, string]] : []),
  ];
  if ((form === "suggested" || form === "chosen") && o) {
    const brand = o.brand?.label ?? null;
    const primary =
      form === "suggested" ? (
        <button type="button" className="q-pick q-take" onClick={on.take}>
          {L("Bunu seç", "Pick this")}
        </button>
      ) : page && asked ? (
        <GotAsk onYes={on.got} onNo={() => setAsked(false)} />
      ) : page ? (
        <a className="q-cta" href={page} target="_blank" rel="noreferrer" onClick={() => setAsked(true)} title={brand ? L(`${brand} sitesinde aç`, `Open on ${brand}`) : undefined}>
          {face.mark && <CarrierLogo mark={face.mark} art={draw} small />}
          <span>{ticketBookWord(face.mode)}</span>
          <span className="q-ext">↗</span>
        </a>
      ) : (
        <button type="button" className="q-pick q-take" onClick={on.got}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    // The pill: Google's judgement; without it, the day either side alone still opens (item 5).
    const judged = insight && face.mode === "flight" ? verdictOf(fareEach(o.item), insight) : null;
    const verdict: Verdict | null = judged ?? (face.mode === "flight" && fare.days.length >= 3 ? { tone: "history", pill: L("Günlere göre fiyat", "Fares by day"), sentence: null } : null);
    const pill = verdict && (
      <button type="button" className={`z-pv ${verdict.tone}`} aria-expanded={fareOpen} title={L("Fiyat geçmişini göster", "Show the fare's history")} onClick={(e) => (e.stopPropagation(), setFareOpen((v) => !v))}>
        {verdict.pill}
      </button>
    );
    const fareLayer = fareOpen && verdict ? (
      <div className="z-det z-pvl" role="dialog" aria-label={L("Fiyat geçmişi", "Fare history")}>
        <button type="button" className="z-dx" aria-label={L("Kapat", "Close")} onClick={() => setFareOpen(false)}>
          <Ic name="x" size={14} />
        </button>
        <FarePanel insight={insight} verdict={verdict} each={fareEach(o.item)} days={fare.days} day={fare.day} />
      </div>
    ) : null;
    // A flight leaving from another airport than the one asked for says so on its line (K81: "SAW'dan kalkıyor").
    return (
      <Frame
        cls={form === "suggested" ? " sg" : " ch"}
        mode={face.mode}
        onOpen={onOpen}
        main={<TicketMain face={face} art={draw} fly={fly} />}
        line={<TicketLine face={face} live={null} badge={badge} after={pill} fields={fields} />}
        foot={<Price o={o} mode={face.mode} />}
        primary={primary}
        layer={fareLayer ?? layer}
      />
    );
  }
  if (form === "booked" && o) {
    const a = vm.access;
    const label = a ? codeLabel(a) : null;
    const code = label ? ticketCodeLabel(face.mode, label) : null;
    const live = vm.ticket?.live ?? null;
    const doc = ticketDocWord(face.mode);
    const checkin = a?.primary === "checkin" ? checkinUrl(o.item) : null;
    // Show when needed (plan-v29): the code on the card only on the travel day; always in the booking's details.
    const today = vm.head.date != null && vm.head.date === env.today;
    const days = daysUntil(vm.head.date, env.today);
    const foot = (
      <span className="z-conf">
        <span className="z-seal" aria-hidden>
          <Ic name="check" size={16} stroke={3} />
        </span>
        <span className="z-cft">
          {today && a?.code && code ? (
            <span className="q-code st tk">
              <span className="z-cl">{code}</span>
              <CopyCode value={a.code.value} label={code} className="q-cv" />
            </span>
          ) : (
            // P3 (F28): no price on a booking: "Ne kadar ödedin?" opens the price, which the budget then counts.
            <b className={`z-paid${vm.paid ? "" : " ask"}`}>
              <Editable field="price">{vm.paid ?? ""}</Editable>
            </b>
          )}
          <small>{live?.shift ?? L("Bilet onaylı", "Ticket confirmed")}</small>
        </span>
      </span>
    );
    // F2: from 48 hours before it leaves, the check-in is the main button; the e-ticket stays one tap away (its details).
    const primary = checkin ? (
      <a className="q-open q-ckin" href={checkin} target="_blank" rel="noreferrer">
        {L("Online check-in", "Online check-in")} <span className="q-ext">↗</span>
      </a>
    ) : on.openDoc ? (
      <button type="button" className="q-got q-bopen" onClick={on.openDoc}>
        <Ic name="clip" size={14} stroke={2.2} /> {doc.open}
      </button>
    ) : (
      <button type="button" className="q-got q-bopen" onClick={info ? info.toggle : on.addDoc}>
        {doc.open}
      </button>
    );
    const missing = a?.docMissing ? (
      <button type="button" className="z-docw" onClick={(e) => (e.stopPropagation(), on.addDoc())}>
        ⚠ {L(`${doc.add} · eksik`, `${doc.add} · missing`)}
      </button>
    ) : days != null && !live ? (
      <span className="z-days">
        <Ic name="cal" size={13} /> {L(`${days} gün kaldı`, `${days} days to go`)}
      </span>
    ) : null;
    return (
      <Frame cls=" bk" mode={face.mode} onOpen={onOpen} main={<TicketMain face={face} art={draw} fly={fly} />} line={<TicketLine face={face} live={live} badge={badge} after={missing} fields={fields} />} foot={foot} primary={primary} row={face.note ? <small className="z-note">{face.note}</small> : null} layer={layer} />
    );
  }
  // A way said done with no ticket of ours ("Ben hallettim" on a train) is drawn as sorted out, with what it is.
  if (form === "arranged" || form === "included" || (form === "booked" && !o)) {
    const inc = form === "included";
    const word = inc ? L("Dahil", "Included") : form === "booked" ? ticketBookedWord(face.mode) : L("Ayarlandı", "Arranged");
    const why = inc ? (vm.cover?.by ?? vm.note) : (vm.note ?? (o ? null : L("sen hallettin", "you sorted it")));
    const foot = (
      <span className="z-cft">
        <span className={inc ? "z-inc" : "z-gr"}>
          <Ic name="check" size={13} stroke={3} /> {word}
        </span>
        {!inc && (o?.price || edit?.open === "price") ? (
          <span className="z-paid">
            <Editable field="price">{o?.price?.text}</Editable>
          </span>
        ) : (
          why && <small className="z-note">{why}</small>
        )}
      </span>
    );
    const primary = inc ? (
      onCover && vm.cover ? (
        <button type="button" className="q-got z-goinc" onClick={onCover}>
          {vm.cover.open} ›
        </button>
      ) : null
    ) : o && !o.price && edit?.open !== "price" ? (
      <button type="button" className="q-got" onClick={() => (edit?.fields.includes("price") ? edit.go("price") : on.edit())}>
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
    return <Frame cls={inc ? " ar inc" : " ar"} mode={face.mode} onOpen={onOpen} main={<TicketMain face={face} art={draw} fly={fly} route={route} />} line={<TicketLine face={face} live={null} badge={badge} fields={fields} />} foot={foot} primary={primary} row={row} layer={layer} />;
  }
  // Aranıyor: nothing to choose yet. Only what is known is written (C19); a record still being filled in shows what it says.
  const own = edit && !o ? ownEnds(edit.item) : null;
  const empty = own ? { ...face, from: face.from ?? own.from, to: face.to ?? own.to } : face;
  // The estimate, and why it's asked for when it's what the category was told is missing (C16).
  const line = [emptyLine(vm), vm.note].filter(Boolean).join(" · ") || null;
  const picking = ways != null && vm.modes.length > 0;
  // The road from an airport in another city: Önerimiz's usual ways first, the tiles one tap away.
  const picks = picking ? wayPicks(vm, selfAt) : [];
  const said = (
    <>
      {picking && <b className="z-dim">{L("Nasıl gideceğin belli değil", "How you'll go isn't decided")}</b>}
      {line && <span className="q-est" title={line}>{line}</span>}
      {!vm.head.date && <small><Editable field="date" /></small>}
      {quiet && on.ask && (
        <small className="z-aierr">
          {L("Henüz sonuç gelmedi", "Nothing came back yet")} ·{" "}
          <button type="button" className="z-retry" onClick={(e) => (e.stopPropagation(), on.ask?.())}>
            {L("Tekrar dene", "Try again")}
          </button>
        </small>
      )}
    </>
  );
  const primary = onAgree ? (
    <AgreeRoute onAgree={onAgree} />
  ) : (
    on.ask && (
      <button type="button" className="q-ai" onClick={on.ask}>
        <Ic name="search" size={15} /> {L("Seçenek bul", "Find options")}
      </button>
    )
  );
  const row = (
    <>
      {onAgree && on.ask && (
        <button type="button" className="q-chg" onClick={on.ask}>
          {L("Seçenek bul", "Find options")}
        </button>
      )}
      {onLegGot && (
        <button type="button" className="q-got" onClick={onLegGot}>
          <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
        </button>
      )}
      {onReset && <button type="button" className="q-chg" onClick={onReset}>{L("Değiştir", "Change")}</button>}
    </>
  );
  return (
    <Frame
      cls=" em"
      mode={face.mode}
      onOpen={onOpen}
      main={<TicketMain face={empty} art={draw} route={picking && ways ? (picks.length ? <WayPicks picks={picks} modes={vm.modes} onPick={ways.pick} onOwn={ways.own} /> : <ModePicker modes={vm.modes} onPick={ways.pick} onOwn={ways.own} />) : undefined} />}
      line={<TicketLine face={empty} live={null} line={said} badge={badge} />}
      foot={<SelfMarks links={links} />}
      primary={primary}
      row={onLegGot || onReset || (onAgree && on.ask) ? row : null}
      layer={null}
    />
  );
}
