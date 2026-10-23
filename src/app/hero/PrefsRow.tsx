// The right end of the facts' row (v82, C23; A · Kapak 2026-10-19: pushed right after the facts): the trip's style words first (the model's, and the budget's level), then
// "Tercihler" (0.46.0, Emre: "görünür yapma, üstüne gelince görünür olan bir şey olsun"): the word and how many, nothing
// more; the mouse over it (a tap on a phone) opens "Seni böyle anladım": what the start chat understood (budget, who
// goes, stays asked for or ruled out) and what was understood since (each with its scope and source). Only to read
// (0.46.0, Emre: "buradan bana soru sormasın, chatte konuştukça şekillenecek"): no question, nothing typed or removed
// here; the chat changes it. Nothing understood yet: no Tercihler (C19). "Özeti küçült" ends the row.
import { useEffect, useRef } from "react";
import { L } from "../../lib/i18n";
import { wantsEntries } from "../../lib/travelWants";
import type { StyleChip } from "../../lib/tripStyle";
import type { Trip } from "../../lib/types";
import { HeroIcon } from "../Icons";
import { intentEntries } from "../IntentCard";
import { useAppear } from "../useAppear";
import type { Decisions } from "../useDecisions";
import { XIcon } from "./icons";
import { usePop } from "./usePop";

function Prefs({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const pop = usePop();
  const { entries } = intentEntries(trip, decisions);
  const said = wantsEntries(trip.wants);
  const nothing = !entries.length && !said.length;
  // (the mouse over it opens it; leaving it, a moment later it goes, unless it comes back)
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hovered = useRef(0);
  const enter = () => {
    clearTimeout(leave.current);
    if (!pop.open) hovered.current = Date.now();
    pop.show();
  };
  const away = () => (clearTimeout(leave.current), (leave.current = setTimeout(() => pop.close(), 260)));
  useEffect(() => () => clearTimeout(leave.current), []);
  // (the hero redrawn under the mouse: the browser may tell no "left" after, so the mouse is watched while open)
  useEffect(() => {
    if (!pop.open) return;
    const move = (e: PointerEvent) => {
      if (pop.box.current?.contains(e.target as Node)) clearTimeout(leave.current);
      else if (e.pointerType === "mouse") away();
    };
    document.addEventListener("pointermove", move);
    return () => document.removeEventListener("pointermove", move);
  });
  // Understood after the hero was drawn (a note, a priority said): it fades in once.
  const appear = useAppear(!nothing, !!decisions);
  // Nothing left (the chat took the last one): the window goes, so a later one doesn't come back already open.
  useEffect(() => {
    if (nothing) pop.close();
  });
  if (nothing) return null;
  const count = entries.length + said.length;
  return (
    <div className={`x-prefs${appear}`} ref={pop.box} onMouseEnter={enter} onMouseLeave={away}>
      <button ref={pop.trigger} type="button" className="x-prefb" aria-expanded={pop.open} aria-haspopup="dialog" onClick={() => Date.now() - hovered.current > 500 && pop.toggle()} onFocus={enter}>
        <span>{L("Tercihler", "Preferences")}</span>
        {count > 0 && <em className="x-pn">{count}</em>}
      </button>
      {pop.shown && (
        <div className={`x-pop x-pref-pop${pop.leaving ? " x-out" : ""}`} role="dialog" aria-label={L("Seni böyle anladım", "What I understood")}>
          <b className="x-pt">{L("Seni böyle anladım", "What I understood")}</b>
          {said.length > 0 && (
            <ul>
              {said.map((e) => (
                <li key={e.key}>
                  <span>
                    <i className="x-tag">{L("Gezi", "Trip")}</i>
                    {e.text} <small>· {L("başlarken söyledin", "said at the start")}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {entries.length > 0 && (
            <ul>
              {entries.map((e) => (
                <li key={e.key}>
                  <span>
                    <i className="x-tag">{e.scope}</i>
                    {e.text} <small>· {e.detail}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <small className="x-edit">{L("Değiştirmek, eklemek ya da çıkarmak için sohbette söylemen yeter.", "To change, add or drop one, just say it in the chat.")}</small>
        </div>
      )}
    </div>
  );
}

export function PrefsRow({ trip, decisions, styles, folded, onFold }: { trip: Trip; decisions: Decisions | null; styles: StyleChip[]; folded: boolean; onFold: () => void }) {
  return (
    <div className="x-prow">
      {styles.length > 0 && (
        <span className="x-styles" aria-label={L("Gezinin tarzı", "The trip's style")}>
          {styles.map((c) => (
            <span key={c.label} className="x-style" style={{ background: c.bg, color: c.fg }}>
              <HeroIcon name={c.icon} size={14} />
              {c.label}
            </span>
          ))}
        </span>
      )}
      <Prefs trip={trip} decisions={decisions} />
      <button type="button" className="x-fold" aria-expanded={!folded} onClick={onFold}>
        <XIcon name="up" size={15} stroke={2.4} />
        <span>{L("Özeti küçült", "Fold the summary")}</span>
      </button>
    </div>
  );
}
