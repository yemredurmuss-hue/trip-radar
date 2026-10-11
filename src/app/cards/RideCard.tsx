// Plan v30: how a way of travel reads on a card. A flight's middle is a curved dashed route with the plane in a white
// circle (RouteArc); any other way (train, bus, ferry, taxi) is a ride: its drawing on the left, "Hakone → Kyoto" large,
// the way and its hour small beneath (RideCardBody). The ends and the hour stay editable where they stand, as on the
// ticket.
import type { End, TransportFace } from "../../lib/cardView";
import type { Brand } from "../../lib/brands";
import type { CardKind } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import { Editable, useInlineEdit } from "./InlineEdit";
import { illusOf } from "./MediaCard";
import { KindIcon } from "./Silhouettes";

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

const clockText = (e: End | null) => [e?.time, e?.sub].filter(Boolean).join(" ");

/** A way of travel that isn't a flight or a rental: drawing, "A → B", the way, the hours. */
export function RideCardBody({ face, title, kind, brand, when }: { face: TransportFace; title: string; kind: CardKind; brand: Brand | null; when: string | null }) {
  const api = useInlineEdit();
  const art = illusOf(kind);
  const how = [title, face.middle, when].filter(Boolean).join(" · ");
  const hours = [clockText(face.from), clockText(face.to)].filter((x) => x).join(" → ");
  const editsEnds = Boolean(api?.fields.includes("from"));
  return (
    <div className="pk-ride">
      <span className="pk-ride-art">{art ? <img src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={40} />}</span>
      <span className="pk-ride-t">
        <b className="pk-ride-ab">
          <span className="pk-ride-end" title={face.from?.city ?? undefined}>{editsEnds ? <Editable field="from">{face.from?.city}</Editable> : face.from?.city}</span>
          <span className="pk-ride-arr" aria-hidden>→</span>
          <span className="pk-ride-end" title={face.to?.city ?? undefined}>{editsEnds ? <Editable field="to">{face.to?.city}</Editable> : face.to?.city}</span>
        </b>
        <span className="pk-ride-how" title={how}>
          <BrandPill brand={brand} />
          {how}
        </span>
        {hours && <small title={hours}>{hours}</small>}
        {!hours && editsEnds && api?.fields.includes("time") && (
          <small>
            <Editable field="time">{null}</Editable>
          </small>
        )}
      </span>
    </div>
  );
}

/** "Nasıl gideceğin belli değil": what the model couldn't know; the ways to pick from are drawn by EmptyLegCard. */
export const unknownHow = () => L("Nasıl gideceğin belli değil", "How you'll get there isn't set");
