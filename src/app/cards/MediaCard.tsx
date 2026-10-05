// A media card's body (etkinlik-v4): a 176×128 picture on the left (the photo, else the kind's dotted
// drawing; the fit score on its corner, blue on the pick), the title (20), the info line and the source line.
import { Fragment } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { MediaFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { FallbackImg } from "../FallbackImg";
import { KindIcon, MediaSilhouette } from "./Silhouettes";

export function MediaCardBody({ face, kind, score, best }: { face: MediaFace; kind: CardKind; score: number | null; best: boolean }) {
  const drawing = face.silhouette ? <MediaSilhouette name={face.silhouette} /> : <KindIcon kind={kind} size={56} className="pk-kindbig" />;
  return (
    <div className="pk-media">
      <div className="pk-vis">
        {face.image ? <FallbackImg className="pk-img" src={face.image} fallback={kind === "activity" ? <MediaSilhouette name="museum" /> : drawing} /> : drawing}
        {score != null && (
          <span className={`pk-score${best ? " best" : ""}`} title={L("Uyum puanı (100 üzerinden)", "Fit score (out of 100)")}>
            {score}
          </span>
        )}
      </div>
      <div className="pk-txt">
        <h3>{face.title}</h3>
        {face.info.length > 0 && (
          <p>
            {face.info.map((x, i) => (
              <Fragment key={`${i}:${x.text}`}>
                {i > 0 && " · "}
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
