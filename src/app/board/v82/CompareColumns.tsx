// One intent's options side by side (plan v81 "Karşılaştırma", mk83.js cmpCol): fixed 280 px columns whose rows line up across
// them (subgrid), best fit first: the picture and who it's from · its name · its price and whole, the fit score and its place ·
// what was asked for, ✓ or ✕ (B5) · pluses · minuses · rating, cancellation, bag · the heart, its page, Seç. Fewer than three: a
// last column for more ("Daha fazla seçenek", the AI asked in the chat). More than three scroll sideways. The order never moves
// on a choice (E report §2.10). What an option doesn't have leaves its cell empty, the rows still lined up (C19: nothing is
// written as "yok").
import { L } from "../../../lib/i18n";
import type { PanoNeed, PanoOption } from "../../../lib/panoBoard";
import { Likes, PageName, PageVisual, PickButton, Score, SourceBadge, StateChip, tintOf } from "./parts";

/** Its pluses or minuses under their label; none: the cell stays, empty. */
function Lines({ lines, label, tone }: { lines: string[]; label: string; tone: "p" | "m" }) {
  if (!lines.length) return null;
  return (
    <>
      <small className={`q-lbl ${tone}`}>{label}</small>
      <ul className={`q-pl ${tone}`}>
        {lines.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

function Column({ option, need }: { option: PanoOption; need: PanoNeed }) {
  const r = option.rating;
  return (
    <article className={`q-col${option.current ? " cur" : ""}`} id={`pn-${option.id}`} aria-label={option.item.name} data-item-id={option.id} style={tintOf(need.section)}>
      <div className={`q-c1 q-ph${option.mark ? " lg" : ""}`}>
        <PageVisual option={option} />
        <SourceBadge source={option.source} />
        <StateChip option={option} multi={need.multi} long />
      </div>
      <div className="q-c2">
        {option.brand && <span className="q-pgbn">{option.brand}</span>}
        <PageName option={option} />
        {option.sub && <small>{option.sub}</small>}
      </div>
      <div className="q-c3">
        {option.price ? (
          <span className="q-pr big">
            <b>{option.price.big}</b>
            <small>{[option.price.unit, option.price.total].filter(Boolean).join(" · ")}</small>
          </span>
        ) : (
          <span />
        )}
        <Score option={option} ranked />
      </div>
      <div className="q-c4">
        {option.checks.map((c) => (
          <span key={c.label} className={`q-mc ${c.ok ? "y" : "n"}`}>
            {c.ok ? "✓" : "✕"} {c.label}
          </span>
        ))}
      </div>
      <div className="q-c5">
        <Lines lines={option.pros} label={L("Artılar", "Pros")} tone="p" />
      </div>
      <div className="q-c6">
        <Lines lines={option.cons} label={L("Eksiler", "Cons")} tone="m" />
      </div>
      <div className="q-c7">
        {r && (
          <span className="q-rate">
            <b className={`q-rb${r.star ? " star" : ""}`}>{r.text}</b>
            {r.reviews && <span>{r.reviews}</span>}
          </span>
        )}
        {option.cancel && <span className={`q-cw ${option.cancel.tone}`}>{option.cancel.text}</span>}
        {option.bag && <span className="q-bg">{option.bag}</span>}
      </div>
      <div className="q-c8">
        <Likes option={option} />
        {option.url && (
          <a className="q-srcl" href={option.url} target="_blank" rel="noreferrer">
            {option.brand ?? L("Sayfası", "Its page")} ↗
          </a>
        )}
        <PickButton option={option} need={need} />
      </div>
    </article>
  );
}

export function CompareColumns({ need, onAsk }: { need: PanoNeed; onAsk?: (need: PanoNeed) => void }) {
  // Best fit first (the decision engine's score); the unscored keep their place after.
  const ranked = [...need.options].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  return (
    <div className="q-cmp3" style={{ "--n": ranked.length } as React.CSSProperties}>
      {ranked.map((o) => (
        <Column key={o.id} option={o} need={need} />
      ))}
      {ranked.length < 3 && (
        <div className="q-colx">
          <b>{L("Daha fazla seçenek", "More options")}</b>
          <small>{L("Sohbete bir link at ya da AI'dan iste; buraya yan yana gelir.", "Drop a link in the chat or ask the AI; it comes in here, side by side.")}</small>
          {onAsk && (
            <button type="button" className="q-ai sm" onClick={() => onAsk(need)}>
              ✨ {L("AI'dan öner", "Ask the AI")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
