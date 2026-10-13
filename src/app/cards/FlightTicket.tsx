// A flight as a ticket (plan v46, F2): a flat frame with a notch and a tear-off stub, one head (airline logo, its name,
// the day, ⓘ on the right), the route (city, code · hour, the plane between with its time and stops, city), a foot, and the
// stub: the stage's word (no empty circle: a big green tick only once the ticket is bought, with the one BookedBadge), what one
// pays, how many go. An empty ticket says what we look for ("Aradığımız: direkt") and an estimate only from real offers.
// Rötar, the gate, the booking code on the flight's day, the "Uçuşa N gün" warning and the cancel notes stay on it; this file
// only draws: the cards (PlanCard, NeedCard, EmptyCard) say what goes in. It wears CardShell's frame (menu, ×, tap, details).
import type { ReactNode } from "react";
import type { TicketStub, TicketLook } from "../../lib/cardTicket";
import type { TransportFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { CopyText } from "../CopyButton";
import { FallbackImg } from "../FallbackImg";
import { BookedBadge } from "./BookedBadge";
import { CardShell } from "./CardShell";
import { KindIcon, UiIcon } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";

export type CardShellProps = Parameters<typeof CardShell>[0];

/** The airline's logo by its flight number's code (Kiwi, else Aviasales), else the plane in a tile (an empty ticket has no airline). */
export function AirlineLogo({ code }: { code: string | null }) {
  const tile = <span className="tk-ph" aria-hidden><KindIcon kind="flight" size={14} /></span>;
  if (!code) return tile;
  return (
    <span className="tk-logo">
      <FallbackImg className="pk-airline" src={`https://images.kiwi.com/airlines/64/${code}.png`}
        fallback={<FallbackImg className="pk-airline" src={`https://pics.avs.io/128/128/${code}.png`} fallback={tile} />} />
    </span>
  );
}

function Stub({ look, stub, action }: { look: TicketLook; stub: TicketStub; action: ReactNode }) {
  const done = look === "booked" || look === "arranged";
  return (
    <div className="tk-stub">
      {done ? (
        <>
          <span className="tk-chk" aria-hidden><UiIcon name="check" size={20} /></span>
          <BookedBadge look={look} as="ticket" small />
        </>
      ) : (
        <span className="tk-lab">
          {look === "draft" && <span aria-hidden>✨</span>}
          {look === "chosen" && <UiIcon name="check" size={12} />}
          {stub.word}
        </span>
      )}
      {stub.big && (
        <span className="tk-price">
          <b className={`num ${stub.bigKind}`}>{stub.big}</b>
          {stub.lines.map((l) => <small key={l} className="num">{l}</small>)}
        </span>
      )}
      {stub.code && (
        <span className="tk-code">
          <small>{L("Rezervasyon kodu", "Booking code")}</small>
          <b><CopyText value={stub.code} label={L("Rezervasyon kodu", "Booking code")}>{stub.code}</CopyText></b>
        </span>
      )}
      {action}
    </div>
  );
}

export function FlightTicket({ look, stub, airline, number, date, face, stops, wants, action, warn, tiles, foot, shell }: {
  look: TicketLook;
  stub: TicketStub;
  /** The airline's name (an option's carrier, the live data's); null on an empty ticket. */
  airline: string | null;
  /** The flight number ("TK 66"), small by the airline. */
  number: string | null;
  /** The head's second line: the day, editable where it stands. */
  date: ReactNode;
  face: TransportFace;
  /** How many stops the record says (null: unknown): the line under the plane is green when direct, amber when not. */
  stops: number | null;
  /** An empty ticket's "Aradığımız: direkt" (the face has no duration to show). */
  wants?: string | null;
  /** In the stub, under the price: "Rezerve et ↗" (a link), or what searches. */
  action?: ReactNode;
  /** "Uçuşa 12 gün · bilet alınmadı": a real warning, amber within 14 days. */
  warn?: { tone: "amber" | "plain"; text: string } | null;
  /** A flight's live boxes (FlightTiles). */
  tiles?: ReactNode;
  foot: ReactNode;
  shell: Omit<CardShellProps, "kind" | "ring" | "head" | "art" | "body" | "foot" | "date" | "extraClass"> & { extraClass?: string };
}) {
  const code = number ? number.replace(/\s+/g, "").slice(0, 2) : null;
  const ring = look === "booked" ? "done" : look === "chosen" || look === "arranged" ? "half" : "open";
  const middle = wants ? L(`Aradığımız: ${wants}`, `We're looking for: ${wants}`) : face.middle;
  const tone = wants ? "want" : stops == null ? undefined : stops === 0 ? "direct" : "stop";
  return (
    <CardShell
      {...shell}
      kind="flight"
      date={null}
      ring={ring}
      extraClass={["tk", `tk-${look}`, shell.extraClass].filter(Boolean).join(" ")}
      head={
        <span className="tk-head">
          <AirlineLogo code={code} />
          <span className="tk-hn">
            <b title={airline ?? undefined}>{airline ?? L("Uçuş", "Flight")}{number && <>{" "}<span className="tk-no num">{number}</span></>}</b>
            <span className="tk-when num">{date}</span>
          </span>
        </span>
      }
      art={<Stub look={look} stub={stub} action={action} />}
      body={
        <>
          <TransportCardBody face={{ ...face, middle, logo: null, logo2: null }} title={shell.ariaLabel} tone={tone}
            art={<img className="tk-plane" src="illus/ucus.png" alt="" />} />
          {tiles}
        </>
      }
      foot={
        <>
          {warn && <p className={`tk-warn ${warn.tone}`}><span aria-hidden>⏳</span> {warn.text}</p>}
          {foot}
        </>
      }
    />
  );
}
