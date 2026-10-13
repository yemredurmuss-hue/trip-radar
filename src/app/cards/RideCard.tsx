// Plan v30: how a way of travel reads on a card. A flight is a ticket (FlightTicket); any other way (train, bus, ferry,
// taxi) is a ride: its drawing on the left, "Hakone → Kyoto" large, the way and its hour small beneath (RideCardBody). The
// ends and the hour stay editable where they stand, as on the ticket.
import type { End, TransportFace } from "../../lib/cardView";
import type { Brand } from "../../lib/brands";
import type { CardKind } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import { Editable, useInlineEdit } from "./InlineEdit";
import { illusOf } from "./MediaCard";
import { KindIcon } from "./Silhouettes";

/** The label of where a way comes from, on its own colour ("Booking.com", "JR"); a grey one for a name we don't know. */
export function BrandPill({ brand }: { brand: Brand | null }) {
  if (!brand) return null;
  return (
    <span className={`brand${brand.color ? "" : " plain"}`} style={brand.color ? ({ "--bc": brand.color } as React.CSSProperties) : undefined}>
      {brand.label}
    </span>
  );
}

const clockText = (e: End | null) => [e?.time && e.plus ? `${e.time} +${e.plus.days}` : e?.time, e?.sub].filter(Boolean).join(" ");

/** A way of travel that isn't a flight or a rental: drawing, "A → B", the way, the hours. */
export function RideCardBody({ face, title, kind, brand, when, line = null }: { face: TransportFace; title: string; kind: CardKind; brand: Brand | null; when: string | null; /** A rental's pick-up and return line, in place of the hours. */ line?: string | null }) {
  const api = useInlineEdit();
  const art = illusOf(kind);
  const how = [title, face.middle, when].filter(Boolean).join(" · ");
  const hours = line ?? [clockText(face.from), clockText(face.to)].filter((x) => x).join(" → ");
  const fromField = face.rental ? "city" : "from";
  const editsEnds = Boolean(api?.fields.includes(fromField));
  return (
    <div className="pk-ride">
      <span className="pk-ride-art">{art ? <img src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={40} />}</span>
      <span className="pk-ride-t">
        <b className="pk-ride-ab">
          <span className="pk-ride-end" title={face.from?.city ?? undefined}>{editsEnds ? <Editable field={fromField}>{face.from?.city}</Editable> : face.from?.city}</span>
          {face.to && <span className="pk-ride-arr" aria-hidden>→</span>}
          {face.to && <span className="pk-ride-end" title={face.to.city ?? undefined}>{editsEnds ? <Editable field="to">{face.to.city}</Editable> : face.to.city}</span>}
        </b>
        <span className="pk-ride-how" title={how}>
          <BrandPill brand={brand} />
          {how}
        </span>
        {hours && <small title={hours}>{hours}</small>}
        {!hours && editsEnds && !face.rental && api?.fields.includes("time") && (
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
