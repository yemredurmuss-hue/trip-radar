// "Koh Phangan Gezisi planlanıyor" (spec §2, Layla's generating screen): fanned photos of the places (prepared
// while chatting, item 7; the rest from the city-image proxy; a gradient where none), and the steps, each real work
// ticked as it finishes (startCreate.ts) with what it wrote ("Koh Phangan'a 31 gece yazıldı"). Revision 2 (item 3):
// every step stays on screen long enough to be read, its tick eases in, the bar fills smoothly with the steps done
// (no jumping percentages), photos fade in as they load; with reduced motion nothing moves. A step that fails stops
// there with its reason: "Tekrar dene" runs it again (nothing is made twice), "Yine de aç" opens what's made so far.
//
// Rev 3: a map first (FlightMap: the flight from where they leave to where they land, drawn on a bundled world
// map), the stops' photos fanning in under it once the plane lands; the steps tick alongside as the work finishes.
// The map is now a real one (TripMap, MapLibre on the globe: the plane flies home → destination, a pulse, the stops
// with their photos); the bundled FlightMap stands in when it can't be drawn (no WebGL, offline, no tiles in ~4 s).
import { useEffect, useMemo, useRef, useState } from "react";
import { cityKeyOf } from "../../lib/plan";
import { L, withLang } from "../../lib/i18n";
import { runStep, stepsFor, type StepId } from "../../lib/startCreate";
import { tripPoints, type TripPoints } from "../../lib/startMap";
import { creationOf, preparedPhotos, stopsOf, type StartState } from "../../lib/startTrip";
import { updateTrip } from "../actions";
import { FlightMap, loadWorld, type WorldMap } from "./FlightMap";
import { TripMap, type TripMapLeg, type TripMapStop } from "../map/TripMap";
import { placePhotos } from "./model";

/** A step is seen running at least this long, so a quick one doesn't flash past (the work itself is often quicker). */
export const MIN_STEP_MS = 600;
/** Then its tick shows a moment before the next step starts. */
const TICK_MS = 220;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type StepState = "wait" | "run" | "done" | "error";

interface Props {
  state: StartState;
  /** The trip record is made: kept on the draft, so a retry continues it. */
  onTripId: (tripId: string) => void;
  /** Made (or opened anyway): `keepDraft` when the conversation couldn't move to the trip (the draft keeps it). */
  onFinished: (tripId: string, keepDraft?: boolean) => void;
  /** Back to the conversation (nothing made yet, or made and left as it is). */
  onBack: () => void;
}

/** A photo card: the gradient (and the place's name) first, the photo fading in over it once loaded. */
function Card({ i, place, url }: { i: number; place: string; url: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`st-photo st-photo-${i}`}>
      <span>{place}</span>
      {url && !failed && <img src={url} alt="" referrerPolicy="no-referrer" className={loaded ? "in" : ""} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    </div>
  );
}

export function Generating({ state, onTripId, onFinished, onBack }: Props) {
  const T = <R,>(fn: () => R): R => withLang(state.lang, fn);
  // Made once from the interview as it was when "Oluştur" was pressed.
  const [creation] = useState(() => T(() => creationOf(state)));
  const [steps] = useState(() => (creation ? stepsFor(state, creation) : []));
  const [status, setStatus] = useState<Record<string, StepState>>({});
  const [failed, setFailed] = useState<{ id: StepId; text: string } | null>(null);
  const [lines, setLines] = useState<Record<string, string>>({});
  // What was prepared while chatting shows at once; the rest is looked for now.
  const [photos, setPhotos] = useState<{ place: string; url: string }[]>(() => preparedPhotos(state));
  const current = useRef(state);
  const started = useRef(false);
  const place = state.where?.place ?? "";

  const [places] = useState(() => {
    const names = [...stopsOf(state).map((s) => s.city), place, state.where?.country ?? ""].filter(Boolean);
    return [...new Map(names.map((n) => [cityKeyOf(n), n])).values()].slice(0, 4);
  });

  useEffect(() => {
    let live = true;
    const have = new Set(photos.map((p) => cityKeyOf(p.place)));
    const missing = places.filter((p) => !have.has(cityKeyOf(p)));
    if (missing.length && photos.length < 4) void placePhotos(missing, state).then((found) => live && found.length && setPhotos((now) => [...now, ...found].slice(0, 4)));
    return () => {
      live = false;
    };
    // Once, for the places as they were when it opened.
  }, [places]);

  // The map (bundled, read once): "loading" keeps its room; null shows the photos alone.
  const [world, setWorld] = useState<WorldMap | null | "loading">("loading");
  const [points, setPoints] = useState<TripPoints | null>(null);
  // The photos fan in once the plane lands (at once without a map).
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    let live = true;
    void loadWorld().then((w) => {
      if (!live) return;
      const p = w ? tripPoints(state, w.centroids) : null;
      setPoints(p);
      setWorld(w && p?.to ? w : null);
    });
    return () => {
      live = false;
    };
  }, []);
  const showPhotos = landed || world === null;
  // The real map first; the bundled one when it can't be drawn.
  const [bundled, setBundled] = useState(false);
  const real = useMemo(() => (points?.to ? realMap(points, state, photos) : null), [points]);

  async function run(from: number) {
    setFailed(null);
    const still = reduced();
    for (let i = from; i < steps.length; i++) {
      const step = steps[i];
      setStatus((s) => ({ ...s, [step.id]: "run" }));
      const began = Date.now();
      try {
        const out = await runStep(step.id, current.current);
        if (step.id === "trip") {
          current.current = { ...current.current, tripId: out.tripId };
          onTripId(out.tripId);
        }
        // A step with its own words now ("3 öneri bölümlerinde").
        if (out.done) setLines((l) => ({ ...l, [step.id]: out.done! }));
      } catch (error) {
        setStatus((s) => ({ ...s, [step.id]: "error" }));
        setFailed({ id: step.id, text: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (!still) await wait(Math.max(0, MIN_STEP_MS - (Date.now() - began)));
      setStatus((s) => ({ ...s, [step.id]: "done" }));
      if (!still) await wait(TICK_MS);
    }
    const tripId = current.current.tripId;
    if (!tripId) return;
    await keepPhotos(tripId);
    await wait(still ? 300 : 800);
    onFinished(tripId);
  }

  /**
   * "Yine de aç": what's made so far opens. Who goes, the style and the conversation are written first when that
   * step hadn't run (best effort); if they still can't be, the draft keeps the conversation.
   */
  async function openAnyway() {
    const tripId = current.current.tripId;
    if (!tripId) return;
    let keep = false;
    if (status.people !== "done") {
      try {
        await runStep("people", current.current);
      } catch {
        keep = true;
      }
    }
    onFinished(tripId, keep);
  }

  /** The photos found are the hero's too (asked once, not again when the board opens). */
  async function keepPhotos(tripId: string) {
    const found = photosRef.current;
    if (!found.length) return;
    await updateTrip(
      tripId,
      (t) => ({
        ...t,
        heroImage: t.heroImage ?? found[0].url,
        cityImages: { ...Object.fromEntries(found.map((p) => [cityKeyOf(p.place)!, p.url])), ...t.cityImages },
      }),
      { touch: false },
    ).catch(() => undefined);
  }
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    if (started.current || !creation) return;
    started.current = true;
    void run(0);
  });

  const done = steps.filter((s) => status[s.id] === "done").length;
  const running = steps.some((s) => status[s.id] === "run") ? 0.5 : 0;
  // Filled by the steps done (half a step for the one running), eased by CSS: it never jumps back or leaps ahead.
  const fill = steps.length ? Math.min(1, (done + running) / steps.length) : 0;
  const cards = Array.from({ length: Math.max(1, Math.min(4, places.length)) }, (_, i) => photos[i] ?? { place: i === 0 ? place : "", url: null });

  return T(() => (
    <div className="st-gen" role="status" aria-live="polite">
      <h2>{L(`${place} Gezisi planlanıyor`, `Planning your ${place} trip`)}</h2>
      <div className={`st-gen-stage${world === null ? " no-map" : ""}`}>
        {world === "loading" ? <div className="st-map st-map-wait" aria-hidden /> : world && points?.to ? (
          bundled || !real ? (
            <FlightMap from={points.from} to={points.to} stops={points.stops} lang={state.lang} onLanded={() => setLanded(true)} />
          ) : (
            <TripMap mode="generate" stops={real.stops} legs={real.legs} home={points.from} lang={state.lang} onLanded={() => setLanded(true)} onUnavailable={() => setBundled(true)} />
          )
        ) : null}
        {showPhotos && (
          <div className="st-photos" aria-hidden>
            {cards.map((p, i) => (
              <Card key={`${i}:${p.place}`} i={i} place={p.place || (i === 0 ? place : "")} url={p.url} />
            ))}
          </div>
        )}
      </div>
      <ol className="st-steps">
        {steps.map((s) => {
          const st = status[s.id] ?? "wait";
          return (
            <li key={s.id} className={`st-step ${st}`} data-step={s.id}>
              <span className="st-step-mark" aria-hidden>
                {st === "done" ? <span className="st-tick">✓</span> : st === "error" ? "!" : ""}
              </span>
              <span className="st-step-text">{st === "done" ? (lines[s.id] ?? s.done) : s.running}</span>
            </li>
          );
        })}
      </ol>
      {failed ? (
        <div className="st-gen-error" role="alert">
          <p>
            {L("Bu adımda durdu: ", "It stopped at this step: ")}
            {failed.text}
          </p>
          <div className="st-gen-actions">
            <button type="button" className="st-chip" onClick={() => void run(steps.findIndex((s) => s.id === failed.id))}>
              {L("Tekrar dene", "Try again")}
            </button>
            {current.current.tripId ? (
              <button type="button" className="st-primary" onClick={() => void openAnyway()}>
                {L("Yine de aç", "Open it anyway")}
              </button>
            ) : (
              <button type="button" className="st-chip" onClick={onBack}>
                {L("Sohbete dön", "Back to the chat")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="st-gen-foot">
          <div className="st-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={L("İlerleme", "Progress")}>
            <span style={{ transform: `scaleX(${fill})` }} />
          </div>
          <div className="st-gen-note">{done === steps.length && steps.length ? L("Hazır, pano açılıyor…", "Ready, opening the board…") : L("Birkaç saniye…", "A few seconds…")}</div>
        </div>
      )}
    </div>
  ));
}

/**
 * The generating screen's real map: the flight from home to the destination, then the stops (their nights from the
 * route, their photos as prepared, else asked for by name) joined by a dashed line; the destination itself when
 * the route has fewer than two stops.
 */
function realMap(points: TripPoints, state: StartState, photos: { place: string; url: string }[]): { stops: TripMapStop[]; legs: TripMapLeg[] } {
  const to = points.to!;
  const nights = new Map(stopsOf(state).map((s) => [cityKeyOf(s.city), s.nights]));
  const photo = (name: string) => photos.find((p) => cityKeyOf(p.place) === cityKeyOf(name))?.url ?? null;
  const places = points.stops.length >= 2 ? points.stops : [to];
  const stops: TripMapStop[] = places.map((p, i) => ({
    key: `${i}:${cityKeyOf(p.name)}`, name: p.name, lat: p.lat, lng: p.lng, nights: nights.get(cityKeyOf(p.name)) ?? null, photo: photo(p.name), photoQuery: p.name,
  }));
  const legs: TripMapLeg[] = [];
  if (points.from) legs.push({ key: "out", from: points.from, to, mode: "flight", minutes: null, booked: false });
  for (let i = 1; i < stops.length; i++) legs.push({ key: `stop:${i}`, from: stops[i - 1], to: stops[i], mode: null, minutes: null, booked: false });
  return { stops, legs };
}
