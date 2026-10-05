// "Bali Gezisi planlanıyor" (spec §2, Layla's generating screen): fanned photos of the places (the city-image
// proxy; a gradient where none), and the steps, each real work ticked as it finishes (startCreate.ts). A step
// that fails stops there with its reason: "Tekrar dene" runs it again (nothing is made twice), "Yine de aç"
// opens what's made so far.
import { useEffect, useRef, useState } from "react";
import { cityKeyOf } from "../../lib/plan";
import { L } from "../../lib/i18n";
import { runStep, stepsFor, type StepId } from "../../lib/startCreate";
import { creationOf, stopsOf, type StartState } from "../../lib/startTrip";
import { updateTrip } from "../actions";
import { placePhotos } from "./model";

/** A step shown at least this long, so each tick can be read (the work itself is often quicker). */
const MIN_STEP_MS = 450;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StepState = "wait" | "run" | "done" | "error";

interface Props {
  state: StartState;
  /** The trip record is made: kept on the draft, so a retry continues it. */
  onTripId: (tripId: string) => void;
  onFinished: (tripId: string) => void;
  /** Back to the conversation (nothing made yet, or made and left as it is). */
  onBack: () => void;
}

export function Generating({ state, onTripId, onFinished, onBack }: Props) {
  // Made once from the interview as it was when "Gezimi oluştur" was pressed.
  const [creation] = useState(() => creationOf(state));
  const [steps] = useState(() => (creation ? stepsFor(state, creation) : []));
  const [status, setStatus] = useState<Record<string, StepState>>({});
  const [failed, setFailed] = useState<{ id: StepId; text: string } | null>(null);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{ place: string; url: string }[]>([]);
  const current = useRef(state);
  const started = useRef(false);
  const place = state.where?.place ?? "";

  const [places] = useState(() => {
    const names = [...stopsOf(state).map((s) => s.city), place, state.where?.country ?? ""].filter(Boolean);
    return [...new Map(names.map((n) => [cityKeyOf(n), n])).values()];
  });

  useEffect(() => {
    let live = true;
    void placePhotos(places).then((found) => live && setPhotos(found));
    return () => {
      live = false;
    };
  }, [places]);

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
      await wait(Math.max(0, MIN_STEP_MS - (Date.now() - began)));
      setStatus((s) => ({ ...s, [step.id]: "done" }));
    }
    const tripId = current.current.tripId;
    if (!tripId) return;
    await keepPhotos(tripId);
    await wait(700);
    onFinished(tripId);
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
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const cards = Array.from({ length: 4 }, (_, i) => photos[i] ?? null);

  return (
    <div className="st-gen" role="status" aria-live="polite">
      <h2>{L(`${place} Gezisi planlanıyor`, `Planning your ${place} trip`)}</h2>
      <div className="st-photos" aria-hidden>
        {cards.map((p, i) => (
          <div key={i} className={`st-photo st-photo-${i}`}>
            {/* The gradient is always there: it shows while a photo loads, and where none is found or it fails. */}
            <span>{i === 0 ? place : ""}</span>
            {p && <img src={p.url} alt="" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
          </div>
        ))}
      </div>
      <ol className="st-steps">
        {steps.map((s) => {
          const st = status[s.id] ?? "wait";
          return (
            <li key={s.id} className={`st-step ${st}`}>
              <span className="st-step-mark" aria-hidden>
                {st === "done" ? "✓" : st === "error" ? "!" : ""}
              </span>
              <span>{st === "done" ? (lines[s.id] ?? s.done) : s.running}</span>
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
              <button type="button" className="st-primary" onClick={() => onFinished(current.current.tripId!)}>
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
        <div className="st-gen-foot">{done === steps.length && steps.length ? L("Hazır, pano açılıyor…", "Ready, opening the board…") : L(`Birkaç saniye · %${pct}`, `A few seconds · ${pct}%`)}</div>
      )}
    </div>
  );
}
