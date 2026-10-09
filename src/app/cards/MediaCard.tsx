// A media card's body (etkinlik-v4): a 176×128 picture on the left (the photo, else the kind's dotted
// drawing; the fit score on its corner, blue on the pick), the title (20), the info line and the source line.
import { Fragment } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { MediaFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { FallbackImg } from "../FallbackImg";
import { Editable, useInlineEdit } from "./InlineEdit";
import { KindIcon, MediaSilhouette } from "./Silhouettes";

/** The v11 drawing for a kind with no photo (static/illus; index.json lists them). */
const ILLUS: Partial<Record<CardKind, string>> = { stay: "otel", activity: "etkinlik-tur", insurance: "sigorta", esim: "esim", food: "restoran", todo: "yapilacak", note: "not" };

/** On a record's card the title and the city are editable where they stand (the day and hour are on the top line). */
export function MediaCardBody({ face, kind, score, best, city = null }: { face: MediaFace; kind: CardKind; score: number | null; best: boolean; city?: string | null }) {
  const placed = Boolean(useInlineEdit()?.fields.includes("city"));
  // The city first, editable; the hour is on the top line then.
  const info = placed ? face.info.filter((x) => x.text !== city && !x.strong) : face.info;
  // The kind's drawing (ticket, museum, eSIM, shield) or its icon: in place of a photo, and when a photo fails.
  // v11: the drawings' pictures (static/illus) where there's one for the kind.
  const art = ILLUS[kind];
  const drawing = art ? <img className="pk-illus" src={`illus/${art}.png`} alt="" /> : face.drawing ? <MediaSilhouette name={face.drawing} /> : <KindIcon kind={kind} size={56} className="pk-kindbig" />;
  return (
    <div className="pk-media">
      <div className="pk-vis">
        {face.image ? <FallbackImg className="pk-img" src={face.image} fallback={drawing} /> : drawing}
        {score != null && (
          <span className={`pk-score${best ? " best" : ""}`} title={L("Uyum puanı (100 üzerinden)", "Fit score (out of 100)")}>
            {score}
          </span>
        )}
      </div>
      <div className="pk-txt">
        <h3>
          <Editable field="name">{face.title}</Editable>
        </h3>
        {(info.length > 0 || placed) && (
          <p>
            {placed && <Editable field="city">{city}</Editable>}
            {info.map((x, i) => (
              <Fragment key={`${i}:${x.text}`}>
                {(i > 0 || placed) && " · "}
                {x.strong ? <b>{x.text}</b> : x.text}
              </Fragment>
            ))}
          </p>
        )}
        {face.meta.length > 0 && (
          <div className="pk-meta">
            {face.meta.map((m) =>
              m.kind === "link" ? (
                <a key={m.text} href={m.href} target="_blank" rel="noreferrer">{m.text}</a>
              ) : (
                <span key={m.text} className={m.kind === "star" ? "star" : undefined}>{m.text}</span>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
