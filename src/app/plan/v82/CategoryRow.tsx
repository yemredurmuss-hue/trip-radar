// A category's closed row (K0, plan v82: 78 px, the same open or closed, E2): its icon on its tint, its name and one line
// ("4 şehir · 14 gece · 10 fikir"), up to three small pictures (real photos only, none without), what's spent of its share
// ("€1.539 · €2.200 ayrıldı", its money on hover, C28), and at its end the plan ring (Bitti ve yaklaştı, 2026-10-23): each
// plan a part, dark green bought, light green chosen, empty to decide; all bought, a green disc with a tick (lib/planRing.ts).
// The words ("1 alındı · 1 seçildi · 2 karar") are kept for a screen reader; with a decision waiting the ring is a button
// that says which on hover and goes to the first on a tap (F5). A tap anywhere opens or closes it; the name is its button.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { chime } from "../../chime";
import { reducedMotion } from "../../motion";
import type { SectionId } from "../../../lib/categories";
import { L } from "../../../lib/i18n";
import type { RowThumb } from "../../../lib/intentFrame";
import { HoverTip, TipOn } from "../../HoverTip";
import { KindIcon } from "../../cards/Silhouettes";
import type { SectionMeta } from "../sectionMeta";
import { ModeIcon, type ModeIconName } from "./modeIcons";
import type { CarrierMark } from "../../../lib/ticketFrame";
import { CarrierLogo } from "./OptionRow";
import { ringArcs, ringDone, ringParts, type PlanRing } from "../../../lib/planRing";
import { sizedPhoto, THUMB_W } from "../../../lib/photoCache";
import { SearchDots } from "./Searching";

/** The dated categories' heads take the rows' icons (MingCute): a plane, a hotel, a train. */
const MODE_OF: Partial<Record<SectionId, ModeIconName>> = { flight: "plane", stay: "hotel", transport: "train" };

export interface RowView {
  id: SectionId;
  name: string;
  /** The one line under the name. */
  line: string;
  thumbs: RowThumb[];
  more: number;
  /** Uçuş closed: the airlines of the flights chosen or bought, their logos in the pictures' place (Karar Masası). */
  logos?: CarrierMark[];
  /** The bar's two tones, in percent; null: no bar (nothing to count). */
  bar: { booked: number; chosen: number } | null;
  /** The state line's parts ("1 alındı", "2 karar"); Hazırlık's "2/6 hazır". */
  parts: { text: string; decide: boolean; tone?: "warn" | "bad" }[];
  /** What's spent and the share set aside, in words ("€1.539", "€2.200"). */
  spent: string | null;
  allot: string | null;
  /** What's settled of all its needs, said for a screen reader (the bar shows it); none for an idea category. */
  settled: { settled: number; total: number } | null;
  /** A dated category's needs by the four steps (onay paketi 2026-10-22): the bar in the steps' colours in place of the two greens. */
  stages?: Record<"options" | "planned" | "bought" | "ticket", number> | null;
  /** The plan ring (Bitti ve yaklaştı): its plans bought, chosen and all; total 0: ideas only (a dashed ring); null: none. */
  ring?: PlanRing | null;
}

/** The ring itself, 44 px: a part a plan, or the disc and its tick, or a dashed ring for a category of ideas. */
export function RingMark({ ring }: { ring: PlanRing }) {
  if (ringDone(ring)) {
    return (
      <svg className="q-ringsvg" viewBox="0 0 100 100" width="44" height="44" aria-hidden>
        <circle cx="50" cy="50" r="46" className="q-rdisc" />
        <path d="M31 51l13 13 25-27" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const arcs = ringArcs(ringParts(ring));
  return (
    <svg className="q-ringsvg" viewBox="0 0 100 100" width="44" height="44" aria-hidden>
      {arcs.length ? arcs.map((a, i) => <path key={i} d={a.d} className={`q-rp-${a.part}`} fill="none" strokeWidth="12" strokeLinecap="round" />) : <circle cx="50" cy="50" r="38" className="q-ridea" fill="none" strokeWidth="7" strokeDasharray="4 9" strokeLinecap="round" />}
    </svg>
  );
}

/** Tamamlandı (0.47.0): how long the light crosses the row and the tick settles (category.css `q-win`). */
const WIN_MS = 900;

/**
 * True for a moment when the category turns complete while it's on screen (never as the board opens, never twice for
 * the same row: undone and done again stays quiet), with the small chime.
 */
function useCompleted(done: boolean): boolean {
  const was = useRef(done);
  const played = useRef(false);
  // (the board's records still arriving as it opens is no completion)
  const since = useRef(Date.now());
  const [on, setOn] = useState(false);
  useEffect(() => {
    const turned = done && !was.current;
    was.current = done;
    if (!turned || played.current || Date.now() - since.current < 2000) return;
    played.current = true;
    chime();
    if (reducedMotion()) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), WIN_MS);
    return () => clearTimeout(t);
  }, [done]);
  return on;
}

export function CategoryRow({ row, meta, open, onToggle, onDecide, decideTip, budgetTip, extraTip, seeking = false, fresh = 0 }: {
  row: RowView;
  meta: SectionMeta;
  open: boolean;
  onToggle: () => void;
  /** "2 karar": the category opens on its first decision (F5). */
  onDecide: () => void;
  /** What waits for a decision, by name (the tip over "2 karar"). */
  decideTip: string[];
  /** The money box on hover ("Bu bölümün parası"). */
  budgetTip: ReactNode;
  /** C28: its open suggestions ("1 öneri"), said in the tip too. */
  extraTip: string | null;
  /** Shut, while the source looks for its needs: a light goes over the row, its icon sends a ring, "Aranıyor" with the dots. */
  seeking?: boolean;
  /** Shut, after: how many options came, a small number on its icon until it is opened. */
  fresh?: number;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const said = row.parts.map((p) => p.text).join(" · ");
  const alerts = row.parts.filter((p) => p.tone);
  const win = useCompleted(Boolean(row.ring && ringDone(row.ring)));
  return (
    <div className={`q-row1${win ? " q-win" : ""}${seeking ? " q-seek" : ""}`} onClick={onToggle}>
      <span className={`q-ic${MODE_OF[row.id] ? " mc" : ""}`} aria-hidden>
        {MODE_OF[row.id] ? <ModeIcon name={MODE_OF[row.id]!} size={24} /> : <KindIcon kind={meta.icon} size={20} />}
        {fresh > 0 && <b className="q-fresh">{fresh > 9 ? "9+" : fresh}</b>}
      </span>
      <button type="button" className="q-tt" aria-expanded={open} onClick={(e) => (e.stopPropagation(), onToggle())}>
        <b>{row.name}</b>
        <small className="q-kw">
          {row.line}
          {extraTip && <span className="q-sgn"> · {extraTip}</span>}
          {seeking && (
            <span className="q-seekw" role="status">
              {" · "}
              <SearchDots />
              {L("Aranıyor", "Searching")}
            </span>
          )}
          {fresh > 0 && <span className="sr-only">{L(` · ${fresh} yeni seçenek`, ` · ${fresh} new option${fresh === 1 ? "" : "s"}`)}</span>}
          {alerts.map((p) => (
            <span key={p.text} aria-hidden>
              {" · "}
              <em className={`q-alert ${p.tone}`}>{p.text}</em>
            </span>
          ))}
        </small>
      </button>
      <span className="q-ths" aria-hidden>
        {/* Only real photos (0.38.3): a photo that doesn't load goes, and no drawing stands in for one. */}
        {row.thumbs.filter((t) => !failed.has(t.src)).map((t) => (
          <span key={t.src} className="q-th" style={{ "--bc": meta.color } as React.CSSProperties}>
            <img className="ph" src={sizedPhoto(t.src, THUMB_W)} alt="" onError={() => setFailed((f) => new Set(f).add(t.src))} />
          </span>
        ))}
        {row.logos?.map((m, i) => (
          <span key={`${m.code ?? m.letter}-${i}`} className="q-th q-thl">
            <CarrierLogo mark={m} art="" small />
          </span>
        ))}
        {row.more > 0 && <span className="q-thm">+{row.more}</span>}
      </span>
      {row.spent || row.allot ? (
        <HoverTip below align="right" className="q-bud" tip={budgetTip}>
          <b className="q-spent">{row.spent ?? ""}</b>
          {row.allot && <small className="q-allot">{L(`${row.allot} ayrıldı`, `${row.allot} set aside`)}</small>}
        </HoverTip>
      ) : (
        <span className="q-bud" />
      )}
      <span className="q-prog">
        {row.ring ? (
          decideTip.length || row.parts.some((p) => p.decide) ? (
            <TipOn below tip={decideTip.length ? <>{decideTip.map((t) => <span key={t} className="tipx-line"><span>{t}</span></span>)}</> : null}>
              {(bind) => (
                <button type="button" className="q-ring q-dec" {...bind} aria-label={L(`${said}: ilk karara git`, `${said}: go to the first decision`)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDecide();
                  }}>
                  <RingMark ring={row.ring!} />
                </button>
              )}
            </TipOn>
          ) : (
            <span className="q-ring" role="img" aria-label={said || L("Fikirler", "Ideas")}>
              <RingMark ring={row.ring} />
            </span>
          )
        ) : (
          <span className="q-ring" />
        )}
        {row.settled && (
          <span className="q-count sr-only" aria-label={L(`${row.settled.settled} / ${row.settled.total} tamam`, `${row.settled.settled} of ${row.settled.total} settled`)}>
            {row.settled.settled}
            <i>/{row.settled.total}</i>
          </span>
        )}
        {/* (the words the ring stands for, for a screen reader and the tests) */}
        <small className="q-pl1 sr-only">{said}</small>
      </span>
    </div>
  );
}
