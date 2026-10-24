// The trip's summary over the Plan (v82 "Hero = mozaik", v83; A · Kapak 2026-10-19), 40 px above the Plan: one round
// block of the cover (the trip's ⋯ menu, the days to go, its places, its name and its route) with the tiles a row under
// it, the summary card (when, who, the budget, ready, "Sıradaki") and one quiet row of the facts, the style words,
// Tercihler and "Özeti küçült", which folds it to one line (remembered per trip in this browser; E11: the grid folds
// and the cover glides into the small picture). Given a "Bugün" strip (gezi sırasında, D8), that stands in for the
// mosaic, the strip and the chips under the one line, as the v83 drawing has it.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { factChips, heroLine, weatherChip, whereLine, type BudgetView, type HeroCounts } from "../../lib/heroStrip";
import type { Mosaic, TileTarget } from "../../lib/heroMosaic";
import type { HeroRoute } from "../../lib/heroRoute";
import { L, locale } from "../../lib/i18n";
import type { BudgetBar } from "../../lib/progress";
import type { CountryFacts, TripFacts } from "../../lib/tripFacts";
import type { Who } from "../../lib/tripSettings";
import type { StyleChip } from "../../lib/tripStyle";
import type { Item, Trip } from "../../lib/types";
import { reducedMotion } from "../motion";
import type { Decisions } from "../useDecisions";
import { useWeather } from "../useWeather";
import { FactChips } from "./FactChips";
import { HeroMosaic } from "./HeroMosaic";
import { HeroStrip, type HeroBudgetSet, type HeroDates, type HeroDocs, type HeroNext } from "./HeroStrip";
import { XIcon } from "./icons";
import { PrefsRow } from "./PrefsRow";
import { visaDoneOf } from "../../lib/visa";
import { TripMenu, type TripMenuActions } from "./TripMenu";
import { coverWidth, sizedPhoto } from "../../lib/photoCache";

/** E11: how long folding and unfolding take (ms). */
const FOLD_MS = 260;
const FOLD_EASE = "cubic-bezier(.2,.8,.2,1)";

const foldKey = (tripId: string) => `trip-radar:hero-fold:${tripId}`;
const readFold = (tripId: string): boolean => {
  try {
    return localStorage.getItem(foldKey(tripId)) === "1";
  } catch {
    return false;
  }
};
const saveFold = (tripId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(foldKey(tripId), "1");
    else localStorage.removeItem(foldKey(tripId));
  } catch {
    /* it folds for this visit */
  }
};

export interface HeroProps {
  trip: Trip;
  /** The ref the thin bar watches and the PDF copies. */
  sectionRef: React.RefObject<HTMLElement | null>;
  /** The main places, in the order the nights go. */
  cities: string[];
  /** Home, each main place with its nights and its stay's state, home again (lib/heroRoute.ts); null: none to draw. */
  route?: HeroRoute | null;
  mood: string | null;
  mosaic: Mosaic;
  working: number;
  menu: TripMenuActions;
  dates: HeroDates | null;
  who: Who;
  items: Item[];
  onShare?: () => void;
  counts: HeroCounts;
  onFirstDecision: (() => void) | null;
  budget: { view: BudgetView; bar: BudgetBar } | null;
  /** D16: a trip with no budget sets one in the budget segment. */
  budgetSet: HeroBudgetSet | null;
  /** B15: the bookings in their last two weeks without their file. */
  docs: HeroDocs | null;
  next: HeroNext;
  /** The plan's four steps and its next things to do, for the strip's tips (onay paketi 2026-10-22). */
  steps?: import("../../lib/rowView").PlanStepsTip | null;
  facts: TripFacts;
  /** The trip's countries by name. */
  countries: string[];
  /** With several countries, each one's own facts in the same order (D9). */
  perCountry: CountryFacts[];
  /** The countries' codes, in the order of `countries` (their flags). */
  countryCodes?: string[];
  /** Each city's days, for its weather. */
  places: { city: string; start: string; end: string }[];
  /** The traveller's passport country. */
  home: string;
  /** Today, for the weather. */
  now: string;
  styles: StyleChip[];
  decisions: Decisions | null;
  /** A tap on a mosaic tile of a thing on the plan (0.38.9): the page goes to its card. */
  onTile?: (target: TileTarget) => void;
  /** Gezi sırasında: the "Bugün" strip, in place of the mosaic, the strip and the chips (phase 5 fills it). */
  today?: ReactNode;
}

export function Hero(props: HeroProps) {
  const { trip, counts, budget } = props;
  const [folded, setFolded] = useState(() => readFold(trip.id));
  const box = useRef<HTMLElement | null>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  // What the screen was before a fold, for E11 (measured before the change, played after it).
  const before = useRef<{ height: number; cover: DOMRect | null } | null>(null);

  const weather = useWeather(props.places, props.countries.length === 1 ? props.countries[0] : null, props.now);
  const month = props.dates ? new Date(`${props.dates.range.start}T12:00:00Z`).toLocaleDateString(locale(), { month: "long", timeZone: "UTC" }) : "";
  const sky = weatherChip(weather, month);
  // One country is said on the photo, over the trip's name; several keep "n ülke" and its table in the facts' row (D9).
  const chips = factChips({ facts: props.facts, countries: props.countries, cities: props.cities, weather: sky, home: props.home, visaDone: visaDoneOf(trip), perCountry: props.perCountry, codes: props.countryCodes }).filter(
    (c) => c.key !== "country" || props.countries.length > 1,
  );

  const toggle = (on: boolean) => {
    const el = box.current;
    before.current = el ? { height: el.getBoundingClientRect().height, cover: el.querySelector(".x-big")?.getBoundingClientRect() ?? null } : null;
    setFolded(on);
    saveFold(trip.id, on);
  };
  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    const el = box.current;
    if (!was || !el || reducedMotion() || typeof el.animate !== "function") return;
    const height = el.getBoundingClientRect().height;
    const grow = el.animate([{ height: `${was.height}px`, overflow: "hidden" }, { height: `${height}px`, overflow: "hidden" }], { duration: FOLD_MS, easing: FOLD_EASE });
    // Folding: the cover glides into the small picture.
    const to = thumb.current?.getBoundingClientRect();
    const from = was.cover;
    let glide: Animation | null = null;
    if (folded && from && to && to.width && from.width) {
      glide = thumb.current!.animate(
        [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "18px" }, { transform: "none" }],
        { duration: FOLD_MS, easing: FOLD_EASE },
      );
    }
    return () => {
      grow.cancel();
      glide?.cancel();
    };
  }, [folded]);

  // (the small picture is the cover itself, at the address the cover was drawn from: nothing more loaded)
  const cover = props.mosaic.cover?.image ? sizedPhoto(props.mosaic.cover.image, coverWidth(props.mosaic.cover.image)) : null;
  const during = props.today != null;
  const slimOn = folded || during;
  const line = heroLine({ range: props.dates?.range ?? null, estimated: !!props.dates?.estimated, rough: !!props.dates?.rough, people: props.who.count, counts, budget: budget?.view ?? null });
  return (
    <section
      className={`h-hero x-hero${folded && !during ? " fold" : ""}${during ? " during" : ""}`}
      aria-label={L("Gezi özeti", "Trip summary")}
      ref={(el) => {
        box.current = el;
        props.sectionRef.current = el;
      }}
    >
      {!during && (
        <>
          <HeroMosaic
            mosaic={props.mosaic}
            title={trip.title}
            where={whereLine(props.cities, props.countries, { title: trip.title, route: props.route?.stops.map((s) => s.name) })}
            mood={props.mood}
            working={props.working}
            menu={<TripMenu actions={props.menu} />}
            onTile={props.onTile}
            count={props.dates?.count ?? null}
            estimated={!!props.dates?.estimated || !!props.dates?.rough}
            route={props.route ?? null}
          />
          <HeroStrip
            dates={props.dates}
            trip={trip}
            who={props.who}
            items={props.items}
            onShare={props.onShare}
            counts={counts}
            onFirstDecision={props.onFirstDecision}
            budget={budget}
            budgetSet={props.budgetSet}
            next={props.next}
            steps={props.steps ?? null}
          />
          <div className="x-info">
            <FactChips chips={chips} sky={sky?.sky ?? null} docs={props.docs} />
            <PrefsRow trip={trip} decisions={props.decisions} styles={props.styles} folded={folded} onFold={() => toggle(true)} />
          </div>
        </>
      )}
      <div className="x-slim" hidden={!slimOn}>
        <span className="x-thumb" ref={thumb} aria-hidden>
          {cover ? <img src={cover} alt="" /> : <XIcon name="image" size={20} stroke={1.6} />}
        </span>
        {/* On the trip the mosaic and its heading give way to the Bugün strip: the trip's name is the heading here. */}
        <b role={during ? "heading" : undefined} aria-level={during ? 1 : undefined}>
          {trip.title}
        </b>
        <small>{line}</small>
        <span className="h-sp" />
        {!during && (
          <button type="button" className="x-unfold" aria-expanded={!folded} onClick={() => toggle(false)}>
            {L("Özeti aç", "Open the summary")}
            <XIcon name="chev" size={14} stroke={2.4} />
          </button>
        )}
      </div>
      {during && <div className="x-today-slot">{props.today}</div>}
    </section>
  );
}
