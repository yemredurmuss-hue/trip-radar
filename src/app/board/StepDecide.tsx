// "Sırayla karar ver" (Karar Panosu #10, docs/mockups/artifact-arsivi/karar-panosu-taslagi-Hajs4s): inside the Comparison window,
// one open decision per screen ("1 / 3 · Porto · Konaklama"), its options side by side with one line of advice, and "Seç" moves
// on; "Geri" and "Sonra" walk the queue, and the last screen says what was decided. The cards and the table stay as they are.
import { useEffect, useRef, useState } from "react";
import { cardFacts, hasMine } from "../../lib/cardFacts";
import type { DecisionContext, GroupDecision, OptionResult } from "../../lib/decision";
import { outcomeText, stepKeys, stepTitle, type DecideStep } from "../../lib/decideSteps";
import { L } from "../../lib/i18n";
import { NEED_MARK } from "../../lib/needs";
import type { ValueCard } from "../../lib/value";
import type { Item } from "../../lib/types";
import { chooseItem } from "../actions";
import { MineLegend, MineStar } from "../cards/MineStar";

/** The advice in one line: the value card's pick and why, else the engine's own summary. */
function reco(d: GroupDecision, card: ValueCard | undefined): { lead: string | null; text: string } {
  if (card && !card.tie) return { lead: `${card.kicker}: ${card.pick.item.name}`, text: card.because };
  return { lead: null, text: d.summary };
}

const SHOWN = 3;

export function StepDecide({ steps, firstKey, ctx, onOpenItem, onExit }: {
  /** Every need of the trip, live (a decision picked drops out of the open ones, so the queue keeps its own keys). */
  steps: DecideStep[];
  /** The need the window was opened on: it comes first. */
  firstKey: string;
  ctx?: DecisionContext;
  onOpenItem: (item: Item) => void;
  /** Back to the cards and the table. */
  onExit: () => void;
}) {
  const [keys] = useState(() => stepKeys(steps, firstKey));
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [later, setLater] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  const done = at >= keys.length;
  const step = done ? undefined : steps.find((s) => s.key === keys[at]);
  const decision = step?.decision;

  // A new screen: the view starts at its heading (a screen reader says "2 / 3 · …").
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
    setAll(false);
  }, [at]);

  const go = (to: number) => setAt(Math.max(0, Math.min(keys.length, to)));
  const titleOf = (key: string) => steps.find((s) => s.key === key)?.title ?? key;
  async function pick(o: OptionResult) {
    if (!decision || !step) return;
    if (o.item.status !== "chosen") await chooseItem(o.item, decision.options.map((x) => x.item));
    setPicked((p) => ({ ...p, [step.key]: o.item.name }));
    setLater((l) => l.filter((k) => k !== step.key));
    go(at + 1);
  }
  function skip() {
    if (!step) return;
    setLater((l) => (l.includes(step.key) ? l : [...l, step.key]));
    go(at + 1);
  }

  if (done) {
    const decided = keys.filter((k) => picked[k]).map((k) => ({ key: k, title: titleOf(k), name: picked[k] }));
    const left = keys.filter((k) => !picked[k] && later.includes(k)).map((k) => ({ key: k, title: titleOf(k) }));
    return (
      <div className="sd" aria-live="polite">
        <div className="sd-top">
          <h3 ref={head} tabIndex={-1}>{L("Bitti", "Done")}</h3>
          {keys.length > 0 && (
            <button type="button" className="btn-link sd-nav" onClick={() => go(keys.length - 1)}>
              {L("← Geri", "← Back")}
            </button>
          )}
        </div>
        <div className="sd-done">
          <p className="sd-done-msg">{outcomeText({ decided, later: left })}</p>
          {decided.length > 0 && (
            <ul className="sd-sum">
              {decided.map((d) => (
                <li key={d.key}>
                  <span className="sd-ok" aria-hidden>✓</span>
                  <span><b>{d.name}</b> <span className="muted">· {d.title}</span></span>
                </li>
              ))}
            </ul>
          )}
          {left.length > 0 && (
            <ul className="sd-sum later">
              {left.map((d) => (
                <li key={d.key}>
                  <span>{d.title}</span>
                  <button type="button" className="btn-link" onClick={() => go(keys.indexOf(d.key))}>{L("Karar ver", "Decide")}</button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="bd-pick sd-finish" onClick={onExit}>{L("Tamam", "Done")}</button>
        </div>
      </div>
    );
  }

  if (!step || !decision) return null;
  const advice = reco(decision, step.card);
  const options = decision.options;
  const shown = all ? options : options.slice(0, SHOWN);
  const rest = options.length - shown.length;
  return (
    <div className="sd" aria-live="polite">
      <div className="sd-top">
        <h3 ref={head} tabIndex={-1}>{stepTitle(at, keys.length, step.title)}</h3>
        <span className="sd-actions">
          {at > 0 && (
            <button type="button" className="btn-link sd-nav" onClick={() => go(at - 1)}>
              {L("← Geri", "← Back")}
            </button>
          )}
          <button type="button" className="btn-link sd-nav" onClick={skip}>
            {L("Sonra", "Later")}
          </button>
        </span>
      </div>
      <p className="sd-reco">
        <span className="sd-tick" aria-hidden>✓</span>
        <span>{advice.lead && <b>{advice.lead}. </b>}{advice.text}</span>
      </p>
      <div className="sd-cards">
        {shown.map((o) => (
          <StepOption key={o.item.id} option={o} decision={decision} ctx={ctx} winner={o === decision.winner} onOpen={() => onOpenItem(o.item)} onPick={() => void pick(o)} />
        ))}
      </div>
      {shown.some((o) => !o.excluded && !o.eliminated && hasMine(cardFacts(o.item, decision, ctx), 3)) && <MineLegend />}
      {rest > 0 && (
        <button type="button" className="bd-more sd-more" onClick={() => setAll(true)}>
          {L(`+${rest} seçenek daha`, `+${rest} more option${rest === 1 ? "" : "s"}`)}
        </button>
      )}
    </div>
  );
}

function StepOption({ option, decision, ctx, winner, onOpen, onPick }: {
  option: OptionResult;
  decision: GroupDecision;
  ctx?: DecisionContext;
  winner: boolean;
  onOpen: () => void;
  onPick: () => void;
}) {
  const item = option.item;
  const facts = cardFacts(item, decision, ctx);
  const out = !!option.excluded || !!option.eliminated;
  const chosen = item.status === "chosen";
  return (
    <article className={`sd-card${winner ? " best" : ""}${out ? " out" : ""}${chosen ? " chosen" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button type="button" className="bd-name sd-name" onClick={onOpen} title={L("Tüm detaylar", "All details")}>{item.name}</button>
      <div className="sd-meta">
        {facts.source && <span className="bd-src">{facts.source.label}</span>}
        {facts.score != null && !out && <span className="sd-score" title={L("Önceliklerine göre puan", "Score by what matters to you")}><b>{facts.score}</b> {L("uyum", "fit")}</span>}
      </div>
      {facts.price && (
        <div className="sd-price">
          <b>{facts.price.perNight ?? facts.price.text}</b>
          <small>{facts.price.perNight ? [facts.price.text, facts.price.label].filter(Boolean).join(" ") : (facts.price.label ?? "")}</small>
          {facts.price.note && <small className="sd-note">{facts.price.note}</small>}
        </div>
      )}
      {!out && facts.needs.length > 0 && (
        <ul className="opt-checks sc-needs bd-needs" aria-label={L("İstediklerin", "What you want")}>
          {facts.needs.slice(0, 3).map((n) => (
            <li key={n.key} className={`need ${n.state}`} title={n.text}>
              <i aria-hidden>{NEED_MARK[n.state]}</i>
              <span>{n.label}</span>
            </li>
          ))}
        </ul>
      )}
      {out ? (
        <p className="bd-out">{option.eliminated?.reason ?? option.excluded}</p>
      ) : (
        <ul className="bd-pc">
          {facts.pros.slice(0, 3).map((p) => (
            <li key={`p${p.text}`}><span className="p" aria-hidden>+</span><span>{p.text}{p.mine && <MineStar />}</span></li>
          ))}
          {facts.cons.slice(0, 3).map((c) => (
            <li key={`c${c.text}`}><span className="m" aria-hidden>−</span><span>{c.text}{c.mine && <MineStar />}</span></li>
          ))}
        </ul>
      )}
      <div className="sd-foot">
        <button type="button" className={`bd-pick${out ? " ghost" : ""}${chosen ? " done" : ""}`} onClick={onPick}>
          {chosen ? L("✓ Seçili, sıradaki", "✓ Chosen, next") : out ? L("Yine de seç", "Choose anyway") : L("Seç", "Choose")}
        </button>
      </div>
    </article>
  );
}
