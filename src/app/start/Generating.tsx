// "Koh Phangan Gezisi planlanıyor" (spec §2, Layla's generating screen): fanned photos of the places (prepared
// while chatting, item 7; the rest from the city-image proxy; a gradient where none), and the steps, each real work
// ticked as it finishes (startCreate.ts) with what it wrote ("Koh Phangan'a 31 gece yazıldı"). Revision 2 (item 3):
// every step stays on screen long enough to be read, its tick eases in, the bar fills smoothly with the steps done
// (no jumping percentages), photos fade in as they load; with reduced motion nothing moves. A step that fails stops
// there with its reason: "Tekrar dene" runs it again (nothing is made twice), "Yine de aç" opens what's made so far.
//
// Rev 3: a map first (FlightMap: the flight from where they leave to where they land, drawn on a bundled world
// map), the stops' photos fanning in under it once the plane lands; the steps tick alongside as the work finishes.
// v5 (spec 2026-10-06-niyet-planlayici §1, mockup v5): the centred column on lavender again: the title, a line with
// the route and its nights, the light SVG map card (GenMap: the bundled world, no map library; MapLibre stays on the
// board's Harita tab only), the big steps, the bar. The trip is made at its own pace and every step ticks as its work
// finishes, never waiting on the animation; the map plays alongside. The board opens once it's made and the plane has
// landed, or OPEN_CAP_MS after the map started, whichever comes first.
import { useEffect, useMemo, useRef, useState } from "react";
import { creditFor, keptCredits } from "../../lib/cityImages";
import { cityKeyOf } from "../../lib/plan";
import { L, withLang } from "../../lib/i18n";
import { genSubLine, runStep, stepsFor, type StepId } from "../../lib/startCreate";
import { fliesBetween, genTimeline, openDelay, tripPoints, type GenTimeline } from "../../lib/startMap";
import { creationOf, preparedPhotos, stopsOf, type StartState } from "../../lib/startTrip";
import { updateTrip } from "../actions";
import { loadWorld, type WorldMap } from "./FlightMap";
import { GenMap, type GenMapProps, type GenStop } from "./GenMap";
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

  // The map (bundled, read once, local): "loading" keeps its room; null (it can't be read, or no place on it) shows
  // the photos alone and the steps tick as their work finishes.
  const [world, setWorld] = useState<WorldMap | null | "loading">("loading");
  const [plan, setPlan] = useState<{ map: Omit<GenMapProps, "world" | "photos" | "lang" | "still">; timeline: GenTimeline; t0: number } | null>(null);
  const still = useMemo(() => reduced(), []);
  useEffect(() => {
    let live = true;
    void loadWorld().then((w) => {
      if (!live) return;
      const made = w ? T(() => mapPlan(state, w)) : null;
      setPlan(made);
      setWorld(w && made ? w : null);
    });
    return () => {
      live = false;
    };
  }, []);

  // The map's clock, for the board's opening (none without it, or with reduced motion).
  const clock = useRef<{ shown: number; t0: number } | null>(null);
  // As far as the photos when that's within the cap (a short trip shows its stops), at least the landing.
  clock.current = plan && !still ? { shown: Math.max(plan.timeline.land, plan.timeline.photos), t0: plan.t0 } : null;

  async function run(from: number) {
    setFailed(null);
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
    // Made: the board opens once the plane has landed, or at the cap (never later), else after a breath.
    const c = clock.current;
    await wait(c ? openDelay(c.shown, performance.now() - c.t0) : still ? 300 : 800);
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
      (t) => {
        const next = {
          ...t,
          heroImage: t.heroImage ?? found[0].url,
          cityImages: { ...Object.fromEntries(found.map((p) => [cityKeyOf(p.place)!, p.url])), ...t.cityImages },
        };
        // Who took them, as the proxy said while they were found.
        return { ...next, photoCredits: keptCredits(next, found.map((p) => ({ url: p.url, credit: creditFor(p.url) }))) };
      },
      { touch: false },
    ).catch(() => undefined);
  }
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // At once: the trip is made at its own pace, whatever the map is doing.
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
  // The map's photos: the stops' own when found, in the stops' order, else what there is (three at most).
  const mapPhotos = plan
    ? (() => {
        const byStop = plan.map.stops.map((s) => photos.find((p) => cityKeyOf(p.place) === cityKeyOf(s.name)) ?? null).filter((p): p is { place: string; url: string } => !!p);
        const rest = photos.filter((p) => !byStop.includes(p));
        const list = [...byStop, ...rest].slice(0, 3);
        return list.length ? list : plan.map.stops.slice(0, 3).map((s) => ({ place: s.name, url: null }));
      })()
    : [];

  return T(() => (
    <div className="st-gen" role="status" aria-live="polite">
      <h2>{state.intent ? L(`${creation?.title} planlanıyor`, `Planning ${creation?.title}`) : L(`${place} Gezisi planlanıyor`, `Planning your ${place} trip`)}</h2>
      {creation && <div className="st-gen-sub">{genSubLine(state, creation)}</div>}
      <div className={`st-gen-stage${world === null ? " no-map" : ""}`}>
        {world === "loading" ? (
          <div className="gm gm-wait" aria-hidden />
        ) : world && plan ? (
          <GenMap world={world} {...plan.map} photos={mapPhotos} lang={state.lang} still={still} />
        ) : (
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
 * What the map draws for this trip: home, where the plane lands, the stops (once each, a place come back to with its
 * nights added up; the event's own pink), the ground route through them in order, the destination's label, and its
 * timeline (started now). Null when nothing can be placed on the map.
 */
function mapPlan(state: StartState, world: WorldMap): { map: Omit<GenMapProps, "world" | "photos" | "lang" | "still">; timeline: GenTimeline; t0: number } | null {
  const points = tripPoints(state, world.centroids);
  const to = points.to;
  if (!to) return null;
  const nights = new Map<string, number>();
  for (const s of stopsOf(state)) nights.set(cityKeyOf(s.city) ?? s.city, (nights.get(cityKeyOf(s.city) ?? s.city) ?? 0) + s.nights);
  const it = state.intent;
  const fest = (name: string) => Boolean(it?.kind === "event" && cityKeyOf(name) === cityKeyOf(it.place));
  const route = points.stops.length >= 2 ? points.stops : [];
  const seen = new Set<string>();
  const marks: GenStop[] = [];
  for (const p of route.length ? route : [to]) {
    const key = cityKeyOf(p.name) ?? p.name;
    if (seen.has(key)) continue;
    seen.add(key);
    marks.push({ name: p.name, lat: p.lat, lng: p.lng, nights: nights.get(key) ?? (route.length ? null : stopsOf(state).reduce((a, x) => a + x.nights, 0) || null), fest: fest(p.name) });
  }
  const where = state.where?.place ?? to.name;
  const label = it && it.name !== where ? `${it.name} · ${where}` : [where, state.where?.country].filter((x, k, all) => x && all.indexOf(x) === k).join(" · ");
  const flies = fliesBetween(points.from, to);
  const timeline = genTimeline(flies, marks.length, Math.max(0, route.length - 1));
  // The map and the steps beside it run on the same clock, from now.
  const t0 = performance.now();
  return { map: { from: points.from, to, label, stops: marks, ground: route, timeline, t0 }, timeline, t0 };
}
