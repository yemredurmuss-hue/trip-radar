import type { ReactNode } from "react";
// A transport card's body (ulasim-v3): the city it leaves from on the left (30, bold; a long name 24 and
// wrapping in its column) with its code or station and **hour** under it, where it goes on the right; the way of travel drawn in the middle (.pk-art,
// behind) with the duration under it. A rental: where it's picked up, then how many days.
// On a record's card (inside InlineEdit) the ends and the hour are editable where they stand: where it
// leaves from and goes to (a rental: where it's picked up), the hour under the left end; empty ones read
// "Nereden" / "Nereye" / "Saat ekle", faint.
import type { End, TransportFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import type { FieldKey } from "../../lib/inlineEdit";
import { Editable, useInlineEdit } from "./InlineEdit";
import { CopyText } from "../CopyButton";
import { FallbackImg } from "../FallbackImg";
import { KindIcon } from "./Silhouettes";

// A long name, or one long word that can't wrap ("Booking.com", "Hostelworld"), goes down to 24 so it
// isn't broken in the middle of the word.
const isLong = (name: string): boolean => name.length > 12 || name.split(/\s+/).some((w) => w.length > 9);

// The airport code a trip's end starts with ("LIS", "IST · 15 Ekim"): its copy button sits by it.
const codeOf = (end: End | null): string | null => /^[A-Z]{3}(?![\p{L}\p{N}])/u.exec(end?.sub ?? "")?.[0] ?? null;

function Stop({ end, right, field, timed, codes }: { end: End | null; right: boolean; field: FieldKey | null; timed: boolean; codes: boolean }) {
  const api = useInlineEdit();
  const editable = Boolean(field && api?.fields.includes(field));
  if (!end && !editable) return <div className={`pk-stop${right ? " r" : ""}`} />;
  const time = timed && api?.fields.includes("time");
  const code = codes ? codeOf(end) : null;
  return (
    <div className={`pk-stop${right ? " r" : ""}`}>
      <b className={isLong(end?.city ?? "") ? "long" : undefined}>{field ? <Editable field={field}>{end?.city}</Editable> : end?.city}</b>
      <span>
        {codes && code ? (
          <>
            <CopyText value={code} side={right ? "left" : "right"} label={L("Havalimanı kodu", "Airport code")}>{code}</CopyText>
            {end!.sub!.slice(code.length)}
          </>
        ) : (
          end?.sub
        )}
        {end?.sub && (end?.time || time) ? " · " : ""}
        {time ? (
          <Editable field="time">{end?.time && <strong className={end.late ? "pk-late" : undefined}>{end.time}</strong>}</Editable>
        ) : (
          end?.time && <strong className={end.late ? "pk-late" : undefined}>{end.time}</strong>
        )}
      </span>
    </div>
  );
}

/** `art`: the way's drawing, in the middle between the two ends (v11: in the flow, so nothing lies over it). */
export function TransportCardBody({ face, title, art = null }: { face: TransportFace; title: string; art?: ReactNode }) {
  const api = useInlineEdit();
  const ends = Boolean(api?.fields.includes(face.rental ? "city" : "from"));
  if (!face.from && !face.to && !ends) return <h3 className="pk-title">{title}</h3>;
  return (
    <div className={`pk-mid${face.logo ? " has-logo" : ""}`}>
      {/* The airline's logo first, as on flight search sites (an empty box when it won't load keeps the grid). */}
      {face.logo && <span className="pk-logo"><FallbackImg className="pk-airline" src={face.logo} fallback={face.logo2 ? <FallbackImg className="pk-airline" src={face.logo2} fallback={<KindIcon kind="flight" size={20} />} /> : <KindIcon kind="flight" size={20} />} /></span>}
      <Stop end={face.from} right={false} field={face.rental ? "city" : "from"} timed={!face.rental} codes={!face.rental} />
      <div className="pk-route">
        {art}
        {face.middle && <small>{face.middle}</small>}
      </div>
      <Stop end={face.to} right field={face.rental ? null : "to"} timed={false} codes={!face.rental} />
    </div>
  );
}
