// "Bilmen gerekenler" (v82 T8 b): the first thing in the open Hazırlık. Its rows come from lib/prepKnow.ts (only what has a
// source); with none, no card.
import { L } from "../../../lib/i18n";
import type { KnowRow } from "../../../lib/prepKnow";
import { PrepIcon } from "./PrepIcons";

export function KnowCard({ rows, sub }: { rows: KnowRow[]; sub: string }) {
  if (!rows.length) return null;
  return (
    <section className="q-bm" aria-label={L("Bilmen gerekenler", "Good to know")}>
      <div className="q-bmh">
        <b>{L("Bilmen gerekenler", "Good to know")}</b>
        {sub && <small>{sub}</small>}
      </div>
      <div className="q-bmg">
        {rows.map((r) => (
          <div key={r.id} className="q-bm1" data-know={r.id}>
            <span className="q-bmi">
              <PrepIcon name={r.icon} />
            </span>
            <span>
              <b>
                {r.label}
                {r.ai && (
                  <>
                    {" "}
                    <i className="q-ptag">{L("AI'dan", "from AI")}</i>
                  </>
                )}
              </b>
              <small>
                {r.text}
                {r.link && (
                  <>
                    {" · "}
                    <a className="q-alk" href={r.link.url} target="_blank" rel="noreferrer">
                      {r.link.text} ↗
                    </a>
                  </>
                )}
              </small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
