// A stay's other photos on its drawer card (onay paketi 2026-10-22, "Kalan öneriler: galeri"): two small ones and "+n" on
// its photo's corner; pressed, the photos big over the page, one at a time (←, →, Esc). Read where they are on the page
// (items.galleryOf keeps their addresses only); one that won't load goes, and none shows nothing.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { L } from "../../../lib/i18n";
import { Ic } from "./icons";

export function GalleryThumbs({ own, photos, name }: { own: string | null; photos: string[]; name: string }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [at, setAt] = useState<number | null>(null);
  const live = photos.filter((p) => !failed.has(p));
  if (!live.length) return null;
  const all = [...(own ? [own] : []), ...live];
  const shown = live.slice(0, 2);
  const more = live.length - shown.length;
  const gone = (src: string) => setFailed((f) => new Set(f).add(src));
  const open = (i: number) => (e: React.MouseEvent) => (e.stopPropagation(), setAt(i));
  return (
    <>
      <span className="dr-gal">
        {shown.map((src, i) => (
          <button key={src} type="button" className="dr-gth" onClick={open((own ? 1 : 0) + i)} aria-label={L(`Fotoğraf ${i + 2}`, `Photo ${i + 2}`)}>
            <img src={src} alt="" loading="lazy" onError={() => gone(src)} />
          </button>
        ))}
        {more > 0 && (
          <button type="button" className="dr-gth more" onClick={open((own ? 1 : 0) + shown.length)} aria-label={L(`${more} fotoğraf daha`, `${more} more photos`)}>
            +{more}
          </button>
        )}
      </span>
      {at != null && <Lightbox photos={all} at={at} name={name} onMove={setAt} onClose={() => setAt(null)} onGone={gone} />}
    </>
  );
}

function Lightbox({ photos, at, name, onMove, onClose, onGone }: { photos: string[]; at: number; name: string; onMove: (i: number) => void; onClose: () => void; onGone: (src: string) => void }) {
  const n = photos.length;
  const i = Math.min(at, n - 1);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") (e.stopImmediatePropagation(), onClose());
      else if (e.key === "ArrowRight") onMove((i + 1) % n);
      else if (e.key === "ArrowLeft") onMove((i - 1 + n) % n);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [i, n, onClose, onMove]);
  return createPortal(
    <div className="dr-lb" role="dialog" aria-modal="true" aria-label={L(`${name} fotoğrafları`, `${name}'s photos`)} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photos[i]} alt={L(`${name}, fotoğraf ${i + 1}`, `${name}, photo ${i + 1}`)} onError={() => (onGone(photos[i]), onMove(Math.max(0, i - 1)))} />
        <figcaption>
          {name} · {i + 1} / {n}
        </figcaption>
      </figure>
      {n > 1 && (
        <>
          <button type="button" className="dr-lbn prev" aria-label={L("Önceki", "Previous")} onClick={(e) => (e.stopPropagation(), onMove((i - 1 + n) % n))}>
            ‹
          </button>
          <button type="button" className="dr-lbn next" aria-label={L("Sonraki", "Next")} onClick={(e) => (e.stopPropagation(), onMove((i + 1) % n))}>
            ›
          </button>
        </>
      )}
      <button type="button" className="dr-lbx" aria-label={L("Kapat", "Close")} onClick={onClose}>
        <Ic name="x" size={18} />
      </button>
    </div>,
    document.body,
  );
}
