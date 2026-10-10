// The trip's card on the home (drawing v2, "Poster", chosen by Emre 2026-10-09): the photo is the card; the people
// top-left, the days left top-right, and at the bottom the title and one line (dates · days). The title shrinks with
// its length (26, 22, 19 px) and wraps by words, three lines at most, "…" only past that; the scrim takes the photo's
// own deep tone. A draft is the same card, dashed.
import type { CSSProperties } from "react";
import { L } from "../lib/i18n";
import { initials } from "../lib/heroInfo";
import { FallbackImg } from "./FallbackImg";
import { usePhotoTint } from "./useTint";

/** The people's colours (the same name, the same colour). */
const COLOURS = ["#5b45e0", "#1d8577", "#c0256b", "#b5761c", "#2563c9", "#5d8a1c"];
const MAX_FACES = 3;

/** "", "m" or "l": the title's size step by its length. */
export const titleSize = (t: string): "" | "m" | "l" => (t.length <= 16 ? "" : t.length <= 32 ? "m" : "l");

export interface Person {
  name: string;
  photo: string | null;
}

function Faces({ people, order }: { people: Person[]; order: string[] }) {
  if (!people.length) return null;
  const shown = people.slice(0, MAX_FACES);
  const rest = people.length - shown.length;
  return (
    <span className="fc" title={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <i key={p.name} style={{ background: p.photo ? undefined : COLOURS[Math.max(0, order.indexOf(p.name)) % COLOURS.length] }}>
          {p.photo ? <img src={p.photo} alt="" /> : initials(p.name) || "?"}
        </i>
      ))}
      {rest > 0 && <i className="cn">+{rest}</i>}
    </span>
  );
}

interface CardProps {
  title: string;
  info: string;
  image: string | null;
  photoBy?: string;
  /** "330 gün kaldı". */
  left: string | null;
  people: Person[];
  /** Everyone's order, for their colour. */
  order: string[];
  onOpen: () => void;
}

export function TripCard({ title, info, image, photoBy, left, people, order, onOpen }: CardProps) {
  const tint = usePhotoTint(image);
  return (
    <button type="button" className="trip-card vcard v1" style={{ "--tint": tint } as CSSProperties} onClick={onOpen}>
      <span className="pic">
        <FallbackImg className="pic-img" src={image} title={photoBy} fallback={<span className="pic-img" />} />
        <span className="who">
          <Faces people={people} order={order} />
        </span>
        {left && <span className="vp">{left}</span>}
        <span className="foot">
          <b className={`ttl ${titleSize(title)}`} title={title}>
            {title}
          </b>
          <span className="inf">{info}</span>
        </span>
      </span>
    </button>
  );
}

interface DraftProps {
  place: string;
  done: number;
  total: number;
  onOpen: () => void;
  onRemove: () => void;
}

export function DraftCard({ place, done, total, onOpen, onRemove }: DraftProps) {
  return (
    <div className="st-draft">
      <button type="button" className="vcard v1 draft st-draft-open" onClick={onOpen}>
        <span className="pic">
          <span className="vp">{L("Taslak", "Draft")}</span>
          <span className="foot">
            <b className={`ttl ${titleSize(place)}`}>{place}</b>
            <span className="inf">{L(`${done}/${total} bilgi · yarıda kaldı · Devam et`, `${done}/${total} answers · left halfway · Continue`)}</span>
          </span>
        </span>
      </button>
      <button type="button" className="st-draft-x" aria-label={L("Taslağı sil", "Delete the draft")} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
