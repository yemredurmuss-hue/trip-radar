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
  parts: { text: string; decide: boolean }[];
  /** What's spent and the share set aside, in words ("€1.539", "€2.200"). */
  spent: string | null;
  allot: string | null;
  /** What's settled of all its needs, said for a screen reader (the bar shows it); none for an idea category. */
  settled: { settled: number; total: number } | null;
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
      <span className="q-ic" aria-hidden>
        <KindIcon kind={meta.icon} size={20} />
      </span>
      <button type="button" className="q-tt" aria-expanded={open} onClick={(e) => (e.stopPropagation(), onToggle())}>
        <b>{row.name}</b>
        <small className="q-kw">
          {row.line}
          {extraTip && <span className="q-sgn"> · {extraTip}</span>}
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
              ) : (
                p.text
              )}
            </span>
          ))}
        </small>
      </span>
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
