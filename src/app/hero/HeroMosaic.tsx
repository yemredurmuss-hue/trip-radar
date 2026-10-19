// The hero's mosaic (v82 "Hero = mozaik", v83 C1, C7, C19): the cover on the left (the trip's name in 30 px, its cities,
// the mood in a line when the model wrote one, "N kayıt işleniyor" while saves are read) with the trip's ⋯ menu on its
// top left, and the tiles on the right (lib/heroMosaic.ts). A photo with a known credit has a small "i" that says it on
// hover or focus; one that fails to load is left out as if it never was (no tile, or the plain cover). The pieces join
// the trip's first opening (opening.ts: each tile 80 ms after the one before). A tile of a thing on the plan is a button to
// its card (0.38.9: the ATV tour's photo goes to the ATV tour in Etkinlik); a city's or a moment's is only a picture.
import { useState, type ReactNode } from "react";
import { creditLine, type CreditPart } from "../../lib/cityImages";
import { shownTiles, tileGoLabel, type Mosaic, type TileTarget } from "../../lib/heroMosaic";
import { L } from "../../lib/i18n";
import type { PhotoCredit } from "../../lib/types";
import { TipOn } from "../HoverTip";
import { XIcon } from "./icons";

const creditText = (credit: PhotoCredit) => {
  const line = creditLine(credit);
  return `${line.label} ${line.by ? `${line.by.text} / ` : ""}${line.source.text}`;
};

/** The "i" on a photo (C7): who took it and where it is from, each a link when its page is known. */
function Credit({ credit }: { credit: PhotoCredit }) {
  const line = creditLine(credit);
  const part = (p: CreditPart) =>
    p.href ? (
      <a href={p.href} target="_blank" rel="noopener noreferrer">
        {p.text}
      </a>
    ) : (
      <span>{p.text}</span>
    );
  const said = creditText(credit);
  return (
    <TipOn
      interactive
      align="right"
      boxClass="x-crtip"
      tip={
        <span className="x-crline">
          {line.label} {line.by && <>{part(line.by)} / </>}
          {part(line.source)}
        </span>
      }
    >
      {(bind) => (
        <button {...bind} type="button" className="x-cr" aria-label={said}>
          <i aria-hidden>i</i>
        </button>
      )}
    </TipOn>
  );
}

export function HeroMosaic({ mosaic, title, cities, mood, working, menu, onTile }: {
  mosaic: Mosaic;
  title: string;
  cities: string[];
  /** The model's sentence for the trip's mood; null when none. */
  mood: string | null;
  /** Saves being read now. */
  working: number;
  menu: ReactNode;
  /** A tap on a tile of a thing on the plan: the page goes to its card. */
  onTile?: (target: TileTarget) => void;
}) {
  // A photo that doesn't load is as good as none: its tile goes, the grid takes the rest (C19).
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const fail = (src: string) => setFailed((s) => new Set(s).add(src));
  const cover = mosaic.cover && !failed.has(mosaic.cover.image) ? mosaic.cover : null;
  const tiles = shownTiles(mosaic.tiles, failed);
  const busy = L(`${working} kayıt işleniyor`, `Processing ${working}`);
  return (
    <div className={`x-mos${tiles.length ? "" : " solo"}`}>
      <figure className={`x-big${cover ? "" : " empty"}`} data-pit data-pit-photo>
        {cover ? (
          <img key={cover.image} src={cover.image} alt="" onError={() => fail(cover.image)} />
        ) : (
          <span className="x-ph" aria-hidden>
            <XIcon name="image" size={34} stroke={1.6} />
          </span>
        )}
        <figcaption>
          <h1>{title}</h1>
          {cities.length > 0 && <span>{cities.join(" · ")}</span>}
          {mood && <em className="x-mood">{mood}</em>}
        </figcaption>
        {cover?.credit && <Credit credit={cover.credit} />}
        {/* On paper the cover's credit is written out (PrintPlan copies the hero as drawn). */}
        {cover?.credit && (
          <span className="x-crprint" aria-hidden>
            {creditText(cover.credit)}
          </span>
        )}
        {working > 0 && (
          <span className="x-busy" title={busy}>
            <i aria-hidden />
            <span>{busy}</span>
          </span>
        )}
      </figure>
      {tiles.length > 0 && (
        <div className={`x-tiles ${mosaic.kind ?? "city"} n${tiles.length}`} data-pit-children data-pit-beat>
          {tiles.map((t) => (
            <figure key={t.key} className={`x-t${t.image ? "" : " art"}${t.target && onTile ? " go" : ""}`}>
              {t.image ? (
                <img src={t.image} alt="" loading="lazy" onError={() => fail(t.image!)} />
              ) : (
                // A city with no photo yet, drawn (the trip's own art, never a stock picture).
                <span className="x-art" aria-hidden>
                  <XIcon name="pin" size={26} stroke={1.6} />
                </span>
              )}
              <figcaption>
                <b>{t.name}</b>
                {t.sub && <small>{t.sub}</small>}
              </figcaption>
              {t.target && onTile && <button type="button" className="x-tgo" aria-label={tileGoLabel(t)} onClick={() => onTile(t.target!)} />}
              {t.credit && <Credit credit={t.credit} />}
            </figure>
          ))}
        </div>
      )}
      {menu}
    </div>
  );
}
