// The row under the chips (v82, C23): the trip's style words first (the model's, and the budget's level), then
// "Tercihler" with what was understood in a few words, "+N" and the waiting question's "1"; a tap opens "Seni böyle
// anladım" (each entry with its scope and source, × to remove it, the question with Evet / Hayır). Nothing understood
// yet and no question: no Tercihler (C19). "Özeti küçült" ends the row.
import { Fragment, useEffect } from "react";
import { L } from "../../lib/i18n";
import { preferenceTags } from "../../lib/preferences";
import type { StyleChip } from "../../lib/tripStyle";
import type { Trip } from "../../lib/types";
import { updateTrip } from "../actions";
import { HeroIcon } from "../Icons";
import { intentEntries } from "../IntentCard";
import { useAppear } from "../useAppear";
import type { Decisions } from "../useDecisions";
import { XIcon } from "./icons";
import { usePop } from "./usePop";

function Prefs({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const pop = usePop();
  const { entries, guess } = intentEntries(trip, decisions);
  const nothing = !entries.length && !guess;
  // Understood after the hero was drawn (a note, a priority said): it fades in once.
  const appear = useAppear(!nothing, !!decisions);
  // The last entry removed, the question answered: the window goes, so a later one doesn't come back already open.
  useEffect(() => {
    if (nothing) pop.close();
  });
  if (nothing) return null;
  const { tags, rest } = preferenceTags(entries.map((e) => e.pref), 3);
  const answer = (yes: boolean) =>
    void updateTrip(trip.id, (t) =>
      yes ? { ...t, confirmedSignals: [...new Set([...(t.confirmedSignals ?? []), guess!.id])] } : { ...t, ignoredSignals: [...new Set([...(t.ignoredSignals ?? []), guess!.id])] },
    );
  return (
    <div className={`x-prefs${appear}`} ref={pop.box}>
      <button ref={pop.trigger} type="button" className="x-prefb" aria-expanded={pop.open} aria-haspopup="dialog" onClick={pop.toggle}>
        <span>{L("Tercihler", "Preferences")}</span>
        {tags.length > 0 && (
          <b>
            {tags.map((t, n) => (
              <Fragment key={t.label}>
                {n > 0 && " · "}
                <span className={`x-ptag${t.strong ? " strong" : ""}`} title={`${t.label} · ${t.title}`}>
                  {t.label}
                </span>
              </Fragment>
            ))}
          </b>
        )}
        {rest > 0 && <em>+{rest}</em>}
        {guess && (
          <i className="x-q" title={L("1 soru", "1 question")} aria-label={L("1 soru", "1 question")}>
            1
          </i>
        )}
        <XIcon name="chev" size={14} stroke={2.2} />
      </button>
      {pop.shown && (
        <div className={`x-pop x-pref-pop${pop.leaving ? " x-out" : ""}`} role="dialog" aria-label={L("Seni böyle anladım", "What I understood")}>
          <b className="x-pt">{L("Seni böyle anladım", "What I understood")}</b>
          {entries.length > 0 && (
            <ul>
              {entries.map((e) => (
                <li key={e.key}>
                  <span>
                    <i className="x-tag">{e.scope}</i>
                    {e.text} <small>· {e.detail}</small>
                  </span>
                  <button
                    type="button"
                    className="x-rmv"
                    aria-label={L(`${e.text} kaldır`, `Remove ${e.text}`)}
                    title={L("Kaldır / yok say", "Remove / ignore")}
                    onClick={() => void (e.change ? updateTrip(trip.id, e.change) : e.action?.())}
                  >
                    <XIcon name="x" size={13} stroke={2.4} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {guess && (
            <div className="x-ask">
              <p>
                {guess.question} <small>{guess.evidence}</small>
              </p>
              <button type="button" className="x-yes" onClick={() => answer(true)}>
                {L("Evet", "Yes")}
              </button>
              <button type="button" className="x-no" onClick={() => answer(false)}>
                {L("Hayır", "No")}
              </button>
            </div>
          )}
          <small className="x-edit">{L("Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter.", "Remove what's wrong with ×; just say anything new in the chat.")}</small>
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
