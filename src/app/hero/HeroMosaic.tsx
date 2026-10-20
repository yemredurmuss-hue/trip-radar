// The hero's mosaic (v82 "Hero = mozaik", v83 C1, C7, C19; A · Kapak 2026-10-19): the cover the full width (its places
// and country, the trip's name big, the mood in a line when the model wrote one, the route from home through each main
// place and back, the days to go big on its top right, "N kayıt işleniyor" while saves are read) with the trip's ⋯ menu
// on its top left, and the tiles a row of six under it, each with a dot for where it stands (lib/heroMosaic.ts). A photo with a known credit has a small "i" that says it on
// hover or focus; one that fails to load is left out as if it never was (no tile, or the plain cover). The pieces join
// the trip's first opening (opening.ts: each tile 80 ms after the one before). A tile of a thing on the plan is a button to
// its card (0.38.9: the ATV tour's photo goes to the ATV tour in Etkinlik); a city's or a moment's is only a picture.
import { Fragment, useState, type ReactNode } from "react";
import { creditLine, type CreditPart } from "../../lib/cityImages";
import { countdownText, type Countdown } from "../../lib/countdown";
import { shownTiles, tileGoLabel, type Mosaic, type TileState, type TileTarget } from "../../lib/heroMosaic";
import type { HeroRoute, RouteWay } from "../../lib/heroRoute";
import { L } from "../../lib/i18n";
import { nNights } from "../../lib/i18nText";
import { MODE_LABELS } from "../../lib/legs";
import type { PhotoCredit } from "../../lib/types";
import { TipOn } from "../HoverTip";
import { WayIcon, XIcon } from "./icons";

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

/** A tile's or a stop's state in words, beside its dot (never by colour alone). */
const stateWords = (state: Exclude<TileState, null>) => (state === "booked" ? L("Alındı", "Booked") : L("Planda, henüz alınmadı", "Planned, not booked yet"));

/** The dot on a tile's corner or before a stop: green booked, amber planned; its words for a reader and on hover. */
function Dot({ state }: { state: Exclude<TileState, null> }) {
  return (
    <i className={`x-dot ${state === "booked" ? "ok" : "plan"}`} title={stateWords(state)}>
      <span className="sr-only">{stateWords(state)}</span>
    </i>
  );
}

/** The days to go, big on the cover's top right; on the trip or after it, its words small ("3. gün / 7", "Bitti"). */
function Count({ count, estimated }: { count: Countdown | null; estimated: boolean }) {
  if (!count) return null;
  if (count.kind !== "before")
    return (
      <div className="x-count small">
        <span>{countdownText(count)}</span>
      </div>
    );
  const days = L("gün kaldı", count.days === 1 ? "day to go" : "days to go");
  return (
    <div className="x-count" role="img" aria-label={`${count.days} ${days}${estimated ? L(", tahmini", ", estimated") : ""}`}>
      <b>{count.days}</b>
      <span>
        {days}
        {estimated && L(" · tahmini", " · estimated")}
      </span>
    </div>
  );
}

/** A step of the route: its way drawn (a plane, a car, a train, a ferry), else an arrow; said in words for a reader. */
function Way({ way }: { way: RouteWay }) {
  return (
    <i className="x-way">
      {way ? <WayIcon way={way} size={16} /> : <span aria-hidden>→</span>}
      <span className="sr-only">{way ? ` ${MODE_LABELS[way]} ` : " → "}</span>
    </i>
  );
}

/** Home, each main place with its nights and its stay's dot, home again (lib/heroRoute.ts). */
function Route({ route }: { route: HeroRoute }) {
  const points: { name: string; nights?: number | null; booked?: boolean }[] = [...(route.from ? [{ name: route.from }] : []), ...route.stops, ...(route.to ? [{ name: route.to }] : [])];
  return (
    <p className="x-route">
      {points.map((p, n) => (
        <Fragment key={`${n}:${p.name}`}>
          {n > 0 && <Way way={route.ways[n - 1] ?? null} />}
          <span className="x-rp">
            {p.booked != null && <Dot state={p.booked ? "booked" : "planned"} />}
            {p.nights ? `${p.name} ${nNights(p.nights)}` : p.name}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

export function HeroMosaic({ mosaic, title, where, mood, working, menu, onTile, count, estimated = false, route }: {
  mosaic: Mosaic;
  title: string;
  /** The places and the country over the title ("Tromsø · Senja, Norveç"); empty: none. */
  where: string;
  /** The model's sentence for the trip's mood; null when none. */
  mood: string | null;
  /** Saves being read now. */
  working: number;
  menu: ReactNode;
  /** A tap on a tile of a thing on the plan: the page goes to its card. */
  onTile?: (target: TileTarget) => void;
  /** Where today is against the dates; null: no dates (or only a guess of them): nothing on the cover. */
  count?: Countdown | null;
  /** The dates are read from the saves, not set. */
  estimated?: boolean;
  route?: HeroRoute | null;
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
        <Count count={count ?? null} estimated={estimated} />
        <figcaption>
          {where && <span className="x-where">{where}</span>}
          <h1>{title}</h1>
          {mood && <em className="x-mood">{mood}</em>}
          {route && <Route route={route} />}
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
            // One small line on the photo (kapak-ferah-v1); the whole name and its city or nights in the tip.
            <TipOn key={t.key} tip={t.sub ? `${t.name} · ${t.sub}` : t.name} below>
              {(bind) => (
            <figure {...bind} className={`x-t${t.image ? "" : " art"}${t.target && onTile ? " go" : ""}`}>
              {t.image ? (
                <img src={t.image} alt="" loading="lazy" onError={() => fail(t.image!)} />
              ) : (
                // A city with no photo yet, drawn (the trip's own art, never a stock picture).
                <span className="x-art" aria-hidden>
                  <XIcon name="pin" size={26} stroke={1.6} />
                </span>
              )}
              {t.state && <Dot state={t.state} />}
              <figcaption>
                <b>{t.name}</b>
              </figcaption>
              {t.target && onTile && <button type="button" className="x-tgo" aria-label={tileGoLabel(t)} onClick={() => onTile(t.target!)} />}
              {t.credit && <Credit credit={t.credit} />}
            </figure>
              )}
            </TipOn>
          ))}
        </div>
      )}
      {menu}
    </div>
  );
}
