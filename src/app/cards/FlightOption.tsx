// A flight option as a small card (plan v46 v42): who saved it, the airline, then one row (hour and code, how long and how
// many stops with the plane between, hour and code), and the price: what one pays large, how many go and the whole sum small,
// and one action (Seç, or the tick of the one on the plan). The back of a flight card sets three side by side; the Pano's flight
// card is the same body under its strip. What a record doesn't say isn't drawn: no hour, no stops word, no price line.
import type { ReactNode } from "react";
import { flightNumber } from "../../../supabase/functions/flight/shape";
import type { FlightLeg, TicketStub } from "../../lib/cardTicket";
import { L } from "../../lib/i18n";
import { AirlineLogo } from "./FlightTicket";

export function FlightLegRow({ leg }: { leg: FlightLeg }) {
  return (
    <span className="fx-leg">
      <span className="fx-t">
        <b className="num">{leg.dep ?? leg.from}</b>
        {leg.dep && leg.from && <small>{leg.from}</small>}
      </span>
      <span className="fx-ln">
        {leg.duration && <small className="num">{leg.duration}</small>}
        <i><img src="illus/ucus.png" alt="" /></i>
        {leg.stops && <small className={leg.stops.direct ? "dir" : "stop"}>{leg.stops.text}</small>}
      </span>
      <span className="fx-t r">
        <b className="num">
          {leg.arr ?? leg.to}
          {leg.arr && leg.plus ? <sup title={L(`${leg.plus} gün sonra`, `${leg.plus} day${leg.plus === 1 ? "" : "s"} later`)}>+{leg.plus}</sup> : null}
        </b>
        {leg.arr && leg.to && <small>{leg.to}</small>}
      </span>
    </span>
  );
}

export function FlightOption({ flightNo, name, who, tag, leg, fare, action, aside, extras, className, ...rest }: {
  /** The record's flight number, for the airline's logo. */
  flightNo: string | null | undefined;
  /** The head's name: the option's own name (a link where it has a page). */
  name: ReactNode;
  /** Who saved it (a face). */
  who?: ReactNode;
  /** "Seçili / Kartta / Yeni": the card's place among the options. */
  tag?: { word: string; tone?: "new" | "draft" } | null;
  leg: FlightLeg;
  fare: TicketStub;
  action?: ReactNode;
  /** The head's right end (the Pano's score and heart). */
  aside?: ReactNode;
  /** What else the back's card keeps (what it fits, why, the details). */
  extras?: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className">) {
  const number = flightNumber(flightNo);
  return (
    <div className={`fo${className ? ` ${className}` : ""}`} {...rest}>
      <span className="fo-h">
        {who && <span className="fo-who">{who}</span>}
        <AirlineLogo code={number ? number.replace(/\s+/g, "").slice(0, 2) : null} />
        <b>{name}</b>
        {tag && <span className={`fo-tag${tag.tone ? ` ${tag.tone}` : ""}`}>{tag.word}</span>}
        {aside && <span className="fo-aside">{aside}</span>}
      </span>
      <FlightLegRow leg={leg} />
      <span className="fo-f">
        {fare.big ? (
          <span className="fx-pr num">
            <span><b>{fare.big}</b>{fare.lines[0] ? ` ${fare.lines[0]}` : ""}</span>
            {fare.lines[1] && <small>{fare.lines[1]}</small>}
          </span>
        ) : <span />}
        {action}
      </span>
      {extras}
    </div>
  );
}
