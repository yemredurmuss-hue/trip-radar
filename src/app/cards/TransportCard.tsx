// A transport card's body (ulasim-v3): the city it leaves from on the left (30, bold; a long name 24 and
// wrapping in its column) with its code or station and **hour** under it, where it goes on the right; the way of travel drawn in the middle (.pk-art,
// behind) with the duration under it. A rental: where it's picked up, then how many days.
// On a record's card (inside InlineEdit) the ends and the hour are editable where they stand: where it
// leaves from and goes to (a rental: where it's picked up), the hour under the left end; empty ones read
// "Nereden" / "Nereye" / "Saat ekle", faint.
import type { End, TransportFace } from "../../lib/cardView";
import type { FieldKey } from "../../lib/inlineEdit";
import { Editable, useInlineEdit } from "./InlineEdit";

function Stop({ end, right, field, timed }: { end: End | null; right: boolean; field: FieldKey | null; timed: boolean }) {
  const api = useInlineEdit();
  const editable = Boolean(field && api?.fields.includes(field));
  if (!end && !editable) return <div className={`pk-stop${right ? " r" : ""}`} />;
  const time = timed && api?.fields.includes("time");
  return (
    <div className={`pk-stop${right ? " r" : ""}`}>
      <b className={(end?.city.length ?? 0) > 12 ? "long" : undefined}>{field ? <Editable field={field}>{end?.city}</Editable> : end?.city}</b>
      <span>
        {end?.sub}
        {end?.sub && (end?.time || time) ? " · " : ""}
        {time ? <Editable field="time">{end?.time && <strong>{end.time}</strong>}</Editable> : end?.time && <strong>{end.time}</strong>}
      </span>
    </div>
  );
}

export function TransportCardBody({ face, title }: { face: TransportFace; title: string }) {
  const api = useInlineEdit();
  const ends = Boolean(api?.fields.includes(face.rental ? "city" : "from"));
  if (!face.from && !face.to && !ends) return <h3 className="pk-title">{title}</h3>;
  return (
    <div className="pk-mid">
      <Stop end={face.from} right={false} field={face.rental ? "city" : "from"} timed={!face.rental} />
      <div className="pk-route">{face.middle && <small>{face.middle}</small>}</div>
      <Stop end={face.to} right field={face.rental ? null : "to"} timed={false} />
    </div>
  );
}
