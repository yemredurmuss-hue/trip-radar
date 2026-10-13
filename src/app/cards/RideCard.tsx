// Plan v30: how a way of travel reads on a card. A flight's middle is a curved dashed route with the plane in a white
// circle (RouteArc); any other way (train, bus, ferry, taxi) is a ride (RideCardBody, F5a): "Hakone → Kyoto" large, when and
// by what in a capsule, the hours with the way drawn between them. The ends and the hour stay editable where they stand.
import type { ReactNode } from "react";
import { rideName, type End, type TransportFace } from "../../lib/cardView";
import type { Brand } from "../../lib/brands";
import type { CardKind } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import { Editable, useInlineEdit } from "./InlineEdit";
import { illusOf } from "./MediaCard";
import { KindIcon, UiIcon } from "./Silhouettes";

/** A curved dashed route, the two ends as dots and the plane over its middle. A stop (a connection) is a ring on the curve. */
export function RouteArc({ stops = false }: { stops?: boolean }) {
  return (
    <span className="pk-arc" aria-hidden>
      <svg viewBox="0 0 160 44" preserveAspectRatio="none">
        <path d="M4 40 Q80 -8 156 40" vectorEffect="non-scaling-stroke" />
      </svg>
      <i className="pk-arc-a" />
      <i className="pk-arc-b" />
      {stops && <i className="pk-arc-stop" />}
      <span className={`pk-arc-pl${stops ? " off" : ""}`}>
        <KindIcon kind="flight" size={18} />
      </span>
    </span>
  );
}

/** The label of where a way comes from, on its own colour ("Booking.com", "JR"); a grey one for a name we don't know. */
export function BrandPill({ brand }: { brand: Brand | null }) {
  if (!brand) return null;
  return (
    <span className={`brand${brand.color ? "" : " plain"}`} style={brand.color ? ({ "--bc": brand.color } as React.CSSProperties) : undefined}>
      {brand.label}
    </span>
  );
}

/** A trip's end under its hour: the station or airport, left out when it only repeats the city already in the title. */
const stopOf = (end: End | null): string | null => (end?.sub && end.sub.trim().toLocaleLowerCase("tr") !== (end.city ?? "").trim().toLocaleLowerCase("tr") ? end.sub : null);

/**
 * F5a (mockup v43/v46): a way of travel that isn't a flight or a rental, read left to right. The title is "A → B" (the arrow in
 * the card's amber), under it the capsule with when ("1 Nis · 20:05", the day editable where it stands) and the way with its
 * site label ("Keikyu treni"); then the hour and the stop at each end with the way drawn between them over a line, how long
 * under it. Nothing moves on hover. A rental: where it's picked up, then what and for how long, and its pick-up and return line.
 */
export function RideCardBody({ face, title, kind, brand, when = null, line = null }: { face: TransportFace; title: string; kind: CardKind; brand: Brand | null; /** The capsule's content: the day (and hour), as the card's top line used to say it. */ when?: ReactNode; /** A rental's pick-up and return line, in place of the hours. */ line?: string | null }) {
  const api = useInlineEdit();
  const art = illusOf(kind);
  const fromField = face.rental ? "city" : "from";
  const editsEnds = Boolean(api?.fields.includes(fromField));
  const editsTime = Boolean(api?.fields.includes("time")) && !face.rental;
  const how = [rideName(title), face.rental ? face.middle : null].filter(Boolean).join(" · ");
  const row = !face.rental && (face.from?.time || face.to?.time || stopOf(face.from) || stopOf(face.to) || face.middle || editsTime);
  const hour = (end: End | null, editable: boolean) => {
    const text = end?.time ? (
      <b className="pk-rd-h">{end.time}{end.plus && <sup className="pk-plus" title={end.plus.date}>+{end.plus.days}</sup>}</b>
    ) : null;
    return editable ? <Editable field="time">{text}</Editable> : text;
  };
  return (
    <div className="pk-rd">
      <h3 className="pk-rd-ttl" title={[face.from?.city, face.to?.city].filter(Boolean).join(" → ")}>
        <span className="pk-rd-end">{editsEnds ? <Editable field={fromField}>{face.from?.city}</Editable> : face.from?.city}</span>
        {face.to && <span className="pk-rd-arr" aria-hidden>→</span>}
        {face.to && <span className="pk-rd-end">{editsEnds ? <Editable field="to">{face.to.city}</Editable> : face.to.city}</span>}
      </h3>
      {(when || how) && (
        <div className="pk-rd-w">
          {when && (
            <span className="pk-rd-when">
              <UiIcon name="cal" size={13} />
              {when}
            </span>
          )}
          {how && (
            <span className="pk-rd-how" title={how}>
              <BrandPill brand={brand} />
              <span>{how}</span>
            </span>
          )}
        </div>
      )}
      {row && (
        <div className="pk-rd-r">
          <span className="pk-rd-c">
            {hour(face.from, editsTime)}
            {stopOf(face.from) && <small>{stopOf(face.from)}</small>}
          </span>
          <span className="pk-rd-mid">
            <span className="pk-rd-line" aria-hidden>
              <i />
              {art ? <img src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={28} />}
              <i />
            </span>
            {face.middle && <small>{face.middle}</small>}
          </span>
          <span className="pk-rd-c r">
            {hour(face.to, false)}
            {stopOf(face.to) && <small>{stopOf(face.to)}</small>}
          </span>
        </div>
      )}
      {line && <small className="pk-rd-line-t" title={line}>{line}</small>}
    </div>
  );
}

/** "Nasıl gideceğin belli değil": what the model couldn't know; the ways to pick from are drawn by EmptyLegCard. */
export const unknownHow = () => L("Nasıl gideceğin belli değil", "How you'll get there isn't set");
