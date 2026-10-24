// One step of "Yolculuk sırasıyla" (v81, v82; mk82.js stepHtml): its day on the left, the dot of its state on the line,
// and one card: what it is and where it stands ("Konaklama · Rezerve edildi"), its name, one short line, its code, and the
// one thing to do with it now (Seçeneklere bak, Ara, Bunu seç, fiyat + Rezerve et, E-bilet aç, Bileti ekle, Check-in,
// Listeyi aç, Önerilere bak). "›" goes to its box on the Plan. What a step says is lib/journeyChapters.ts's.
import type { CSSProperties, ReactNode } from "react";
import { airlineLogos } from "../../../lib/airlines";
import { L } from "../../../lib/i18n";
import type { JourneyStep, StepAction, StepTarget } from "../../../lib/journeyChapters";
import { THUMB_W } from "../../../lib/photoCache";
import { CopyText } from "../../CopyButton";
import { DocPickButton } from "../../cards/DocAccess";
import { KindIcon, UiIcon } from "../../cards/Silhouettes";
import { FallbackImg } from "../../FallbackImg";

export interface StepHandlers {
  /** "›", and the buttons that are a way to the box (Seçeneklere bak, Ara, Önerilere bak, Listeyi aç). */
  onGo: (target: StepTarget) => void;
  /** "Bunu seç": our pick taken. */
  onTake: (itemId: string, target: StepTarget | null) => void;
  /** "E-bilet aç", "Onay e-postası aç": the booking's file. */
  onDoc: (itemId: string) => void;
}

/** The dot's (and the card's) look by the step's state: dashed to decide, purple our pick, sand chosen, green bought. */
function lookOf(s: JourneyStep): string {
  if (s.missed) return "missed";
  if (s.kind === "ideas") return "idea";
  if (s.kind === "onboard") return "night";
  if (s.kind === "prep") return "todo";
  switch (s.status) {
    case "suggested":
      return "ai";
    case "chosen":
      return "sel";
    case "booked":
      return "ok";
    case "included":
      return "inc";
    case "arranged":
    case "skipped":
      return "arr";
    default:
      return "todo";
  }
}

/** The state's word, in its colour (never colour alone: the word says it). */
const TONE: Record<string, string> = { ai: "ai", sel: "sel", ok: "ok", inc: "ok", arr: "gr", todo: "todo", missed: "gr" };

/** A site's small mark on its button ("B" in Booking.com's blue). */
function Logo({ action }: { action: StepAction }) {
  const style = action.brand?.color ? ({ "--bl": action.brand.color } as CSSProperties) : undefined;
  const chip = action.brand ? (
    <span className="q-logo" style={style} aria-hidden>
      {action.brand.label.slice(0, 1)}
    </span>
  ) : null;
  // A flight's airline known: its logo (0.38.8), the site's letter when it won't load.
  if (!action.airline) return chip;
  const [first, second] = airlineLogos(action.airline);
  return <FallbackImg className="q-logo q-air" src={first} fallback={<FallbackImg className="q-logo q-air" src={second} fallback={chip} />} />;
}

function StepButton({ step, tripId, on }: { step: JourneyStep; tripId: string; on: StepHandlers }) {
  const a = step.action;
  if (!a) return null;
  const go = () => step.target && on.onGo(step.target);
  switch (a.kind) {
    case "options":
    case "search":
      return (
        <button type="button" className="q-gob" onClick={go}>
          {a.label} ›
        </button>
      );
    case "list":
    case "ideas":
      return (
        <button type="button" className="q-go2" onClick={go}>
          {a.label} ›
        </button>
      );
    case "take":
      return a.itemId ? (
        <button type="button" className="q-pick q-take" onClick={() => on.onTake(a.itemId!, step.target)}>
          {a.label}
        </button>
      ) : null;
    case "book":
    case "checkin":
      // On its own site (the partner link is the page's, app/affiliate.ts); without one, its box says how.
      return a.url ? (
        <a className={a.kind === "checkin" ? "q-open" : "q-cta"} href={a.url} target="_blank" rel="noreferrer">
          <Logo action={a} />
          {a.label}
          <span className="q-ext" aria-hidden>
            ↗
          </span>
        </a>
      ) : (
        <button type="button" className={a.kind === "checkin" ? "q-open" : "q-cta"} onClick={go}>
          {a.label}
        </button>
      );
    case "doc":
      return a.itemId ? (
        <button type="button" className="q-open" onClick={() => on.onDoc(a.itemId!)}>
          <UiIcon name="clip" size={15} />
          {a.label}
        </button>
      ) : null;
    case "addDoc":
      return a.itemId ? (
        <DocPickButton item={{ id: a.itemId, tripId }} className="q-doc add">
          <UiIcon name="clip" size={15} />
          {a.label}
        </DocPickButton>
      ) : null;
  }
}

/** The ways to the box that are the step's own button: no "›" beside them. */
const GOES: readonly StepAction["kind"][] = ["options", "search", "list", "ideas"];

export function StepCard({ step, tripId, on }: { step: JourneyStep; tripId: string; on: StepHandlers }) {
  const look = lookOf(step);
  const plain = step.kind === "prep" || step.kind === "ideas" || step.kind === "onboard";
  const art: ReactNode = step.cardKind ? <KindIcon kind={step.cardKind} size={22} /> : null;
  const chevron = step.target && !(step.action && GOES.includes(step.action.kind));
  return (
    <div className="q-step" data-st={look} data-step={step.key}>
      <span className="q-sdate">{step.dateLabel}</span>
      <span className="q-sdot" aria-hidden />
      <div className="q-sbody">
        {/* E3: a new state's card comes in (260 ms): keyed by its look, so a choice made here sets in like the box's. */}
        <div key={look} className={`q-scard${look === "todo" && step.kind !== "prep" ? " todo" : ""}${step.kind === "ideas" ? " idea" : ""}${step.kind === "onboard" ? " night" : ""}${step.missed ? " missed" : ""}`}>
          {!plain && (
            <span className="q-sth" aria-hidden>
              <span className={`q-th${step.image ? "" : " art"}`}>{step.image ? <FallbackImg src={step.image} className="q-thimg" width={THUMB_W} fallback={art} /> : art}</span>
            </span>
          )}
          {step.kind === "onboard" && (
            <span className="q-sth" aria-hidden>
              <span className="q-th art">
                <KindIcon kind="flight" size={20} />
              </span>
            </span>
          )}
          <div className="q-sm">
            {step.kindWord && step.statusText && (
              <span className="q-skind">
                {step.kindWord} · <em className={TONE[look] ?? ""}>{step.statusText}</em>
              </span>
            )}
            <b>{step.title}</b>
            {step.sub && <small>{step.sub}</small>}
            {(step.code || step.docMissing) && (
              <span className="q-sacc">
                {step.code && (
                  <span className="q-code">
                    {step.code.label}{" "}
                    <CopyText value={step.code.value} label={step.code.label}>
                      <b>{step.code.value}</b>
                    </CopyText>
                  </span>
                )}
                {step.docMissing && <span className="q-nodoc">{L("Belge yok", "No document")}</span>}
              </span>
            )}
          </div>
          <span className="q-sp" />
          {step.price && <span className="q-spr">{step.price}</span>}
          <StepButton step={step} tripId={tripId} on={on} />
          {chevron && (
            <button type="button" className="q-chv" title={L("Planda göster", "Show on the plan")} aria-label={L(`${step.title}: planda göster`, `${step.title}: show on the plan`)} onClick={() => on.onGo(step.target!)}>
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
