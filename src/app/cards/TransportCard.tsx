// A transport card's body (ulasim-v3): the city it leaves from on the left (30, bold; a long name 24 and
// wrapping in its column) with its code or station and **hour** under it, where it goes on the right; the way of travel drawn in the middle (.pk-art,
// behind) with the duration under it. A rental: where it's picked up, then how many days.
import type { End, TransportFace } from "../../lib/cardView";

function Stop({ end, right }: { end: End | null; right: boolean }) {
  if (!end) return <div className={`pk-stop${right ? " r" : ""}`} />;
  return (
    <div className={`pk-stop${right ? " r" : ""}`}>
      <b className={end.city.length > 12 ? "long" : undefined}>{end.city}</b>
      <span>
        {end.sub}
        {end.sub && end.time ? " · " : ""}
        {end.time && <strong>{end.time}</strong>}
      </span>
    </div>
  );
}

export function TransportCardBody({ face, title }: { face: TransportFace; title: string }) {
  if (!face.from && !face.to) return <h3 className="pk-title">{title}</h3>;
  return (
    <div className="pk-mid">
      <Stop end={face.from} right={false} />
      <div className="pk-route">{face.middle && <small>{face.middle}</small>}</div>
      <Stop end={face.to} right />
    </div>
  );
}
