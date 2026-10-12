// A media card's body (etkinlik-v4): a 176×128 picture on the left (the photo, else the kind's dotted
// drawing; the fit score on its corner, blue on the pick), the title (20), the info line and the source line.
import { Fragment } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { MediaFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { FallbackImg } from "../FallbackImg";
import { Editable, useInlineEdit } from "./InlineEdit";
import type { Brand } from "../../lib/brands";
import type { CancelLine } from "../../lib/cardTime";
import { BrandPill } from "./RideCard";
import { campArt } from "../../lib/playbooks";
import type { Item } from "../../lib/types";
import { KindIcon, MediaSilhouette } from "./Silhouettes";

/** A stay's rating as the site writes it: "9,0 Muhteşem · 770 yorum" (a score out of 10) or "★ 4,9 Misafirler çok sevmiş" (out of 5). */
export interface StayRating {
  value: string;
  word: string;
  count: string | null;
  star: boolean;
}

/** The v11 drawing for a kind with no photo (static/illus; index.json lists them). */
export const ILLUS: Partial<Record<CardKind, string>> = { stay: "otel", activity: "etkinlik-tur", insurance: "sigorta", esim: "esim", food: "restoran", todo: "yapilacak", note: "not" };
/** The drawing for any kind, the ways of travel too (the Pano's cards). */
export const illusOf = (kind: CardKind): string | null =>
  ILLUS[kind] ?? ({ train: "tren", bus: "otobus", minibus: "minibus", ferry: "vapur", taxi: "taksi-transfer", transfer: "taksi-transfer", car: "arac-kiralama", moto: "motosiklet", rv: "karavan", bike: "bisiklet" } as Partial<Record<CardKind, string>>)[kind] ?? null;

/** On a record's card the title and the city are editable where they stand (the day and hour are on the top line). */
export function MediaCardBody({ face, kind, score, best, city = null, nights = null, brand = null, area = null, rating = null, cancel = null, art: artOf }: { face: MediaFace; kind: CardKind; score: number | null; best: boolean; city?: string | null; nights?: number | null; brand?: Brand | null; area?: string | null; rating?: StayRating | null; cancel?: CancelLine | null; /** v30: the stay's drawing by what it is (a flat, a caravan), null: the kind's icon; absent: the kind's. */ art?: string | null }) {
  const placed = Boolean(useInlineEdit()?.fields.includes("city"));
  // The city first, editable; the hour is on the top line then.
  const info = placed ? face.info.filter((x) => x.text !== city && !x.strong) : face.info;
  // The kind's drawing (ticket, museum, eSIM, shield) or its icon: in place of a photo, and when a photo fails.
  // v11: the drawings' pictures (static/illus) where there's one for the kind.
  const art = artOf === undefined ? ILLUS[kind] : artOf;
  const drawing = art ? <img className="pk-illus" src={`illus/${art}.png`} alt="" /> : face.drawing ? <MediaSilhouette name={face.drawing} /> : <KindIcon kind={kind} size={56} className="pk-kindbig" />;
  return (
    <div className={`pk-media${kind === "stay" ? " pk-stay" : ""}`}>
      <div className="pk-vis">
        {face.image ? <FallbackImg className="pk-img" src={face.image} fallback={drawing} /> : drawing}
        {score != null && (
          <span className={`pk-score${best ? " best" : ""}`} title={L("Uyum puanı (100 üzerinden)", "Fit score (out of 100)")}>
            {score}
          </span>
        )}
      </div>
      <div className="pk-txt">
        {/* v30: a stay says where it's from (the site's label) and where it is, then its name and what guests thought of it. */}
        {kind === "stay" && (brand || area) && (
          <div className="pk-srcrow">
            <BrandPill brand={brand} />
            {area && <span className="pk-loc">{area}</span>}
          </div>
        )}
        <h3 title={face.title}>
          <Editable field="name">{face.title}</Editable>
        </h3>
        {kind === "stay" && rating && (
          <div className="pk-rate">
            <span className={`pk-rb${rating.star ? " star" : ""}`}>{rating.star ? "★ " : ""}{rating.value}</span>
            <b>{rating.word}</b>
            {rating.count && <span>· {rating.count}</span>}
          </div>
        )}
        {(info.length > 0 || placed || nights) && (
          <p>
            {/* v11: a stay's nights as dots, then its city and "N gece". */}
            {nights ? (
              <span className="pk-moons" aria-hidden>
                {Array.from({ length: Math.min(nights, 7) }, (_, i) => <i key={i} />)}
              </span>
            ) : null}
            {placed && <Editable field="city">{city}</Editable>}
            {info.map((x, i) => (
              <Fragment key={`${i}:${x.text}`}>
                {(i > 0 || placed) && " · "}
                {x.strong ? <b>{x.text}</b> : x.text}
              </Fragment>
            ))}
            {nights ? L(` · ${nights} gece`, ` · ${nights} night${nights === 1 ? "" : "s"}`) : null}
          </p>
        )}
        {kind === "stay" && cancel && <span className={`pk-cancel ${cancel.tone}`}>{cancel.text}</span>}
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

/**
 * v30: a festival's camp (a tent, a caravan) as the stay card's body: the kind's drawing across the top, where it is,
 * its name large, the nights and what it is ("kendi çadırın"). No hotel to find, no price: the foot says it needs no booking.
 */
export function CampBody({ item, nights }: { item: Item; nights: number | null }) {
  const place = item.location.area ?? item.city;
  return (
    <div className="pk-media pk-stay pk-camp">
      <div className="pk-vis">
        <img className="pk-illus" src={campArt(item)} alt="" />
      </div>
      <div className="pk-txt">
        {place && (
          <div className="pk-srcrow">
            <span className="pk-loc">📍 {place}</span>
          </div>
        )}
        <h3 title={item.name}>
          <Editable field="name">{item.name}</Editable>
        </h3>
        <p>{[nights ? L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`) : null, item.summary || null].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}
