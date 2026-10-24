// "Ayarla" beside the drawer's sort (onay paketi 2026-10-22, Kalan öneriler): "Neye göre sıralayalım?", four presets
// (Dengeli · Fiyat önce · Yorumlar önce · Konum önce) and the three weights as dials (Yorumlar · Özellikler · Fiyat). A dial
// sets its group's criteria for this category on the trip (decision.withPriorities); the cards re-rank at once.
import { useEffect, useRef, useState } from "react";
import { resetPriorities, withPriorities } from "../../../lib/decision";
import { dialLevels, DIAL_MAX, groupDial, groupLabel, presetLabel, presetLevels, type ScoreGroup, type WeightPreset } from "../../../lib/drawerCard";
import { L } from "../../../lib/i18n";
import type { Category, Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";
import { Ic } from "./icons";

const GROUPS: readonly ScoreGroup[] = ["reviews", "features", "price"];
const PRESETS: readonly WeightPreset[] = ["balanced", "price", "reviews", "location"];

export function WeightTuner({ trip, category, shares }: { trip: Trip; category: Category; shares: { group: ScoreGroup; share: number }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), setOpen(false));
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key, true);
    return () => (document.removeEventListener("mousedown", away), window.removeEventListener("keydown", key, true));
  }, [open]);
  const set = (change: (t: Trip) => Trip) => void updateTrip(trip.id, change);
  const preset = (p: WeightPreset) => {
    const levels = presetLevels(category, p);
    set((t) => (levels ? withPriorities(resetPriorities(t, category), levels) : resetPriorities(t, category)));
  };
  const share = (g: ScoreGroup) => shares.find((s) => s.group === g)?.share ?? 0;
  return (
    <div className="dr-tune" ref={box}>
      <button type="button" className="dr-tuneb" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ic name="spark" size={13} /> {L("Ayarla", "Adjust")}
      </button>
      {open && (
        <div className="dr-tunep" role="dialog" aria-label={L("Neye göre sıralayalım?", "What should the order follow?")}>
          <div className="dr-tuneh">
            <b>{L("Neye göre sıralayalım?", "What should the order follow?")}</b>
            <button type="button" className="dr-tunex" aria-label={L("Kapat", "Close")} onClick={() => setOpen(false)}>
              <Ic name="x" size={14} />
            </button>
          </div>
          <div className="dr-presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="dr-preset" onClick={() => preset(p)}>
                {presetLabel(p)}
              </button>
            ))}
          </div>
          {GROUPS.map((g) => (
            <label key={g} className={`dr-dial ${g}`}>
              <span>
                <span>
                  <i aria-hidden /> {groupLabel(g, true)}
                </span>
                <b>%{share(g)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={DIAL_MAX}
                step={1}
                defaultValue={groupDial(trip, category, g)}
                aria-valuetext={L(`${groupLabel(g, true)} yüzde ${share(g)}`, `${groupLabel(g, true)} ${share(g)} percent`)}
                onChange={(e) => {
                  const dial = Number(e.target.value);
                  set((t) => withPriorities(t, dialLevels(category, g, dial)));
                }}
              />
            </label>
          ))}
          <small className="dr-tunen">{L("Sıra kartlarda hemen değişir; bu gezi için saklanır.", "The cards re-rank at once; kept for this trip.")}</small>
        </div>
      )}
    </div>
  );
}
