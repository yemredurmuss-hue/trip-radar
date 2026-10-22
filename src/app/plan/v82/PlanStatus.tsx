// "Planın durumu" and "Sıradaki işler" (onay paketi 2026-10-22, web): the dated categories' needs by the four steps (a bar
// in their colours, a line each with its mark and how many) and the next three things to do, each a tap from its row. On a
// wide page it stands beside the plan; narrower, over it, the two boxes side by side.
import { L } from "../../../lib/i18n";
import type { IntentVM } from "../../../lib/intents";
import { planSteps, type RowStage } from "../../../lib/rowView";
import { StageGlyph } from "./modeIcons";

const ORDER: readonly RowStage[] = ["ticket", "bought", "planned", "options"];
const WORD: Record<RowStage, () => string> = {
  ticket: () => L("Bilet elde", "Ticket in hand"),
  bought: () => L("Alındı", "Bought"),
  planned: () => L("Planda", "Planned"),
  options: () => L("Seçenekler", "Options"),
};

export function PlanStatus({ intents, goTo }: { intents: readonly IntentVM[]; goTo: (section: IntentVM["section"], key: string) => void }) {
  const { counts, total, next } = planSteps(intents);
  if (!total) return null;
  const decided = total - counts.options;
  const done = counts.bought + counts.ticket;
  return (
    <aside className="q-pstat" aria-label={L("Planın durumu", "The plan's state")}>
      <section className="q-psb">
        <b className="q-psh">{L("Planın durumu", "The plan's state")}</b>
        <span className="q-psbar" aria-hidden>
          {ORDER.map((st) => counts[st] > 0 && <i key={st} className={st} style={{ flexGrow: counts[st] }} />)}
        </span>
        {ORDER.map((st) => (
          <span key={st} className="q-psl">
            <StageGlyph stage={st} size={20} />
            <span>{WORD[st]()}</span>
            <b>{counts[st]}</b>
          </span>
        ))}
        <small className="q-psn">{L(`${total} parçadan ${decided}'inde karar verildi, ${done}'i alındı.`, `${decided} of ${total} decided, ${done} bought.`)}</small>
      </section>
      {next.length > 0 && (
        <section className="q-psb">
          <b className="q-psh">{L("Sıradaki işler", "Next up")}</b>
          {next.map((n) => (
            <button key={n.key} type="button" className="q-psi" onClick={() => goTo(n.section, n.key)}>
              <StageGlyph stage={n.stage} size={20} />
              <span>
                <b>
                  {n.act} · {n.text}
                </b>
                {n.sub && <small>{n.sub}</small>}
              </span>
            </button>
          ))}
        </section>
      )}
    </aside>
  );
}
