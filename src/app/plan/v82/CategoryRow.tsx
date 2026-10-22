// A category's closed row (K0, plan v82: 78 px, the same open or closed, E2): its icon on its tint, its name and one line
// ("4 şehir · 14 gece · 10 fikir"), up to three small pictures (real photos only, none without), the bar in two greens and "1 alındı · 1 seçildi · 2 karar"
// ("2 karar" says which on hover and goes to the first on a tap, F5), what's spent of its share ("€1.539 · €2.200 ayrıldı",
// its money on hover, C28), the arrow. A tap anywhere opens or closes it; the name is its button.
import { useState, type ReactNode } from "react";
import type { SectionId } from "../../../lib/categories";
import { L } from "../../../lib/i18n";
import type { RowThumb } from "../../../lib/intentFrame";
import { HoverTip, TipOn } from "../../HoverTip";
import { KindIcon } from "../../cards/Silhouettes";
import type { SectionMeta } from "../sectionMeta";
import { Ic } from "./icons";
import { ModeIcon, type ModeIconName } from "./modeIcons";

/** The dated categories' heads take the rows' icons (MingCute): a plane, a hotel, a train. */
const MODE_OF: Partial<Record<SectionId, ModeIconName>> = { flight: "plane", stay: "hotel", transport: "train" };

export interface RowView {
  id: SectionId;
  name: string;
  /** The one line under the name. */
  line: string;
  thumbs: RowThumb[];
  more: number;
  /** The bar's two tones, in percent; null: no bar (nothing to count). */
  bar: { booked: number; chosen: number } | null;
  /** The state line's parts ("1 alındı", "2 karar"); Hazırlık's "2/6 hazır". */
  parts: { text: string; decide: boolean; tone?: "warn" | "bad" }[];
  /** What's spent and the share set aside, in words ("€1.539", "€2.200"). */
  spent: string | null;
  allot: string | null;
  /** What's settled of all its needs, said for a screen reader (the bar shows it); none for an idea category. */
  settled: { settled: number; total: number } | null;
  /** A dated category's two counts in place of the bar (onay paketi 2026-10-22): decided of all, bought of those to buy. */
  meters?: { decided: [number, number]; bought: [number, number] } | null;
}

/** One count: its word, "3 / 4", and a segment a need. */
function Meter({ label, of, tone, onClick }: { label: string; of: [number, number]; tone: "acc" | "ok"; onClick?: () => void }) {
  const [n, total] = of;
  const body = (
    <>
      <span className="q-mt">
        <b>{label}</b>
        <em>
          {n} / {total}
        </em>
      </span>
      <span className="q-ms" aria-hidden>
        {Array.from({ length: Math.min(total, 12) }, (_, i) => (
          <i key={i} className={i < Math.round((n / total) * Math.min(total, 12)) ? "on" : undefined} />
        ))}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className={`q-meter ${tone}`} onClick={(e) => (e.stopPropagation(), onClick())} aria-label={L(`${label}: ${n} / ${total}, ilk karara git`, `${label}: ${n} of ${total}, go to the first decision`)}>
      {body}
    </button>
  ) : (
    <span className={`q-meter ${tone}`} aria-label={L(`${label}: ${n} / ${total}`, `${label}: ${n} of ${total}`)}>
      {body}
    </span>
  );
}

export function CategoryRow({ row, meta, open, onToggle, onDecide, decideTip, budgetTip, extraTip }: {
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
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  return (
    <div className="q-row1" onClick={onToggle}>
      <span className={`q-ic${MODE_OF[row.id] ? " mc" : ""}`} aria-hidden>
        {MODE_OF[row.id] ? <ModeIcon name={MODE_OF[row.id]!} size={24} /> : <KindIcon kind={meta.icon} size={20} />}
      </span>
      <button type="button" className="q-tt" aria-expanded={open} onClick={(e) => (e.stopPropagation(), onToggle())}>
        <b>{row.name}</b>
        <small className="q-kw">
          {row.line}
          {extraTip && <span className="q-sgn"> · {extraTip}</span>}
          {/* (with the two counts in the bar's place, a night's trouble is said on the line: "1 gece boş") */}
          {row.meters &&
            row.meters.decided[1] > 0 &&
            row.parts
              .filter((p) => p.tone)
              .map((p) => (
                <span key={p.text}>
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
            <img className="ph" src={t.src} alt="" onError={() => setFailed((f) => new Set(f).add(t.src))} />
          </span>
        ))}
        {row.more > 0 && <span className="q-thm">+{row.more}</span>}
      </span>
      {row.meters && row.meters.decided[1] > 0 ? (
        <span className="q-prog q-meters">
          <Meter label={L("Karar", "Decided")} of={row.meters.decided} tone="acc" onClick={row.meters.decided[0] < row.meters.decided[1] ? onDecide : undefined} />
          {row.meters.bought[1] > 0 && <Meter label={L("Bilet", "Tickets")} of={row.meters.bought} tone="ok" />}
          {row.settled && (
            <span className="q-count sr-only" aria-label={L(`${row.settled.settled} / ${row.settled.total} tamam`, `${row.settled.settled} of ${row.settled.total} settled`)}>
              {row.settled.settled}
              <i>/{row.settled.total}</i>
            </span>
          )}
        </span>
      ) : (
      <span className="q-prog">
        {row.bar && (
          <span className="q-bar" aria-hidden>
            <i className="bk" style={{ width: `${row.bar.booked}%` }} />
            <i className="ch" style={{ width: `${row.bar.chosen}%` }} />
          </span>
        )}
        {row.settled && (
          <span className="q-count sr-only" aria-label={L(`${row.settled.settled} / ${row.settled.total} tamam`, `${row.settled.settled} of ${row.settled.total} settled`)}>
            {row.settled.settled}
            <i>/{row.settled.total}</i>
          </span>
        )}
        <small className="q-pl1">
          {row.parts.map((p, n) => (
            <span key={p.text}>
              {n > 0 && " · "}
              {p.decide ? (
                <TipOn below tip={decideTip.length ? <>{decideTip.map((t) => <span key={t} className="tipx-line"><span>{t}</span></span>)}</> : null}>
                  {(bind) => (
                    <button type="button" className="q-dec" {...bind} aria-label={L(`${p.text}: ilk karara git`, `${p.text}: go to the first decision`)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDecide();
                      }}>
                      <em>{p.text}</em>
                    </button>
                  )}
                </TipOn>
              ) : p.tone ? (
                <em className={`q-alert ${p.tone}`}>{p.text}</em>
              ) : (
                p.text
              )}
            </span>
          ))}
        </small>
      </span>
      )}
      {row.spent || row.allot ? (
        <HoverTip below align="right" className="q-bud" tip={budgetTip}>
          <b className="q-spent">{row.spent ?? ""}</b>
          {row.allot && <small className="q-allot">{L(`${row.allot} ayrıldı`, `${row.allot} set aside`)}</small>}
        </HoverTip>
      ) : (
        <span className="q-bud" />
      )}
      <span className="q-chev" aria-hidden>
        <Ic name="chev" size={18} stroke={2.2} />
      </span>
    </div>
  );
}
