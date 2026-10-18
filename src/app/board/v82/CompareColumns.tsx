// One intent's options side by side (plan v81 "Karşılaştırma", mk83.js cmpCol): fixed 280 px columns whose rows line up across
// them (subgrid), best fit first: the picture and who it's from · its name · its price and whole, the fit score and its place ·
// what was asked for, ✓ or ✕ (B5) · pluses · minuses · rating, cancellation, bag · the heart, its page, Seç. Fewer than three: a
// last column for more ("Daha fazla seçenek", the AI asked in the chat). More than three scroll sideways. The order never moves
// on a choice (E report §2.10).
import { L } from "../../../lib/i18n";
import type { PanoNeed, PanoOption } from "../../../lib/panoBoard";
import { Likes, PickButton, Score, SourceBadge, StateChip, tintOf, Visual } from "./parts";

const list = (lines: string[]) =>
  lines.length ? lines.map((t) => <li key={t}>{t}</li>) : <li className="q-na nb">{L("yok", "none")}</li>;

function Column({ option, need }: { option: PanoOption; need: PanoNeed }) {
  const r = option.rating;
  return (
    <article className={`q-col${option.current ? " cur" : ""}`} id={`pn-${option.id}`} aria-label={option.item.name} data-item-id={option.id} style={tintOf(need.section)}>
      <div className={`q-c1 q-ph${option.mark ? " lg" : ""}`}>
        <Visual option={option} />
        <SourceBadge source={option.source} />
        <StateChip option={option} multi={need.multi} long />
      </div>
      <div className="q-c2">
        {option.brand && <span className="q-pgbn">{option.brand}</span>}
        <b>{option.name}</b>
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
        {option.checks.length ? (
          option.checks.map((c) => (
            <span key={c.label} className={`q-mc ${c.ok ? "y" : "n"}`}>
              {c.ok ? "✓" : "✕"} {c.label}
            </span>
          ))
        ) : (
          <span className="q-na">{L("istek yok", "nothing asked")}</span>
        )}
      </div>
      <div className="q-c5">
        <small className="q-lbl p">{L("Artılar", "Pros")}</small>
        <ul className="q-pl p">{list(option.pros)}</ul>
      </div>
      <div className="q-c6">
        <small className="q-lbl m">{L("Eksiler", "Cons")}</small>
        <ul className="q-pl m">{list(option.cons)}</ul>
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
        {!r && !option.cancel && !option.bag && <span className="q-na">—</span>}
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
