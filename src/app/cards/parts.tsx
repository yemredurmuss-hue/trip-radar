// Pieces every card uses (the decision cards, the stays, the plan cards): where it's from, what was asked for, pros and cons, the opened details, links and the price.
import { cardDetails, type CardFacts } from "../../lib/cardFacts";
import { moneyText, tradeText, type Ranked } from "../../lib/choice";
import { ratingOutOf10, type GroupDecision } from "../../lib/decision";
import { L, locale } from "../../lib/i18n";
import { listingKeyOf } from "../../lib/items";
import { readingLine } from "../../lib/listing";
import { NEED_MARK, type NeedCheck } from "../../lib/needs";
import { rangeOfGroupKey, stayRange } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { withDates } from "../../lib/url";
import { FallbackImg } from "../FallbackImg";
import type { Decisions } from "../useDecisions";

/** The site it's from, with the site's own icon (the traveller has been there), else its first letter. */
/** Where it's from; with a page, one click opens it in a new tab (the board stays where it is). */
export function SourceBadge({ source, href }: { source: CardFacts["source"]; href?: string | null }) {
  if (!source) return null;
  const url = href ?? source.url;
  const inner = (
    <>
      <FallbackImg
        className="sc-favicon"
        src={source.host ? `https://${source.host}/favicon.ico` : null}
        fallback={<span className="sc-favicon letter">{source.label.charAt(0).toLocaleUpperCase(locale())}</span>}
      />
      {source.label}
    </>
  );
  if (!url) return <span className="sc-source">{inner}</span>;
  return (
    <a
      className="sc-source link"
      href={url}
      target="_blank"
      rel="noreferrer"
      title={L(`${source.label} sayfasını yeni sekmede aç`, `Open ${source.label} in a new tab`)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {inner}
      <span className="sc-open" aria-hidden>
        ↗
      </span>
    </a>
  );
}

/** What the traveller asked for, checked on this one: ✓ there, ✕ not, ? the page doesn't say. */
export function Needs({ needs, max = 4 }: { needs: NeedCheck[]; max?: number }) {
  if (!needs.length) return null;
  const shown = needs.slice(0, max);
  return (
    <div className="sc-needs">
      <span className="sc-needs-head">{L("İstediklerin", "What you want")}</span>
      <ul aria-label={L("İstediklerin", "What you want")}>
        {shown.map((n) => (
          <li key={n.key} className={`need ${n.state}`} title={`${n.label}: ${n.text}`}>
            <i aria-hidden>{NEED_MARK[n.state]}</i>
            <span>{n.text}</span>
          </li>
        ))}
        {needs.length > max && <li className="need more">+{needs.length - max}</li>}
      </ul>
    </div>
  );
}

/** Saved without dates but compared for a group's nights: the page reopened with those dates. */
export function datedLink(item: Item, decision: GroupDecision | undefined) {
  const nights = decision && item.category === "stay" && !stayRange(item) ? rangeOfGroupKey(decision.key) : null;
  return { nights, url: nights ? withDates(item.url, nights, item.guests.adults) : null };
}

/**
 * What speaks for it and against it, a few words a line: the pluses, then what to mind, each list
 * with its biggest on top (the reason an option is out always leads). A wide card puts them side by
 * side; a narrow one one under the other, so no line is squeezed into a column two words wide.
 */
export function ProsCons({ pros, cons }: { pros: CardFacts["pros"]; cons: CardFacts["cons"] }) {
  if (!pros.length && !cons.length) return null;
  return (
    <div className="sc-pc">
      {pros.length > 0 && (
        <ul className="sc-col pros" aria-label={L("Artıları", "Pros")}>
          {pros.slice(0, 3).map((p) => (
            <li key={p.text} className={p.unique ? "unique" : undefined} title={p.text}>
              <i aria-hidden>+</i>
              <span>{p.text}</span>
              {p.unique && <em className="only-here">{L("yalnız bunda", "only this one")}</em>}
            </li>
          ))}
        </ul>
      )}
      {cons.length > 0 && (
        <ul className="sc-col cons" aria-label={L("Eksileri", "Cons")}>
          {cons.slice(0, 3).map((c) => (
            <li key={c.text} className={[c.strong ? "strong" : "", c.unique ? "unique" : ""].filter(Boolean).join(" ") || undefined} title={c.text}>
              <i aria-hidden>−</i>
              <span>{c.text}</span>
              {c.unique && !c.strong && <em className="only-here">{L("yalnız bunda", "only this one")}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * An opened card: one line on where it stands, the facts that decide (only what's known), and the few
 * things for and against it that matter. Everything read about it is in "Tüm detaylar".
 */
export function Details({
  item,
  decision,
  decisions,
  status = null,
}: {
  item: Item;
  decision?: GroupDecision;
  decisions: Decisions | null;
  status?: CardFacts["status"];
}) {
  const d = cardDetails(item, decision, decisions?.ctx);
  const listing = decisions?.ctx.listings.get(listingKeyOf(item));
  const reading = readingLine(item, listing);
  return (
    <div className="card-details">
      {d.verdict ? <p className="cd-verdict">{d.verdict}</p> : status && <p className={`small-note tone-${status.tone}`}>{status.text}</p>}
      {d.facts.length > 0 && (
        <dl className="cd-facts">
          {d.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.needs.length > 0 && (
        <div className="cd-list needs">
          <h4>{L("İstediklerin", "What you want")}</h4>
          <ul>
            {d.needs.map((n) => (
              <li key={n.key} className={`need ${n.state}`}>
                <i aria-hidden>{NEED_MARK[n.state]}</i> <b>{n.label}:</b> {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.pros.length > 0 && (
        <div className="cd-list pros">
          <h4>{L("Artıları", "Pros")}</h4>
          <ul>
            {d.pros.map((p) => (
              <li key={p.text}>
                {p.text}
                {p.detail && <span className="muted"> · {p.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.cons.length > 0 && (
        <div className="cd-list cons">
          <h4>{L("Dikkat", "Watch out")}</h4>
          <ul>
            {d.cons.map((c) => (
              <li key={c.text} className={c.strong ? "strong" : undefined}>
                {c.text}
                {c.detail && <span className="muted"> · {c.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {reading && <p className={`small-note tone-${reading.tone}`}>{reading.text}</p>}
    </div>
  );
}

export function Links({ item, decision, onOpen, onCompare }: { item: Item; decision?: GroupDecision; onOpen: () => void; onCompare?: () => void }) {
  const { url } = datedLink(item, decision);
  return (
    <div className="sc-links">
      {onCompare && (
        <button className="link-btn" onClick={onCompare}>
          {L("Karşılaştır →", "Compare →")}
        </button>
      )}
      <button className="link-btn" onClick={onOpen}>
        {L("Tüm detaylar", "All details")}
      </button>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {L("Tarihlerle aç ↗", "Open with dates ↗")}
        </a>
      ) : (
        item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            {L("Sayfayı aç ↗", "Open page ↗")}
          </a>
        )
      )}
    </div>
  );
}

export function Price({ price, compact = false, dated }: { price: CardFacts["price"]; compact?: boolean; dated: boolean }) {
  // With its dates known, the price is simply missing: saying it in the chat is enough.
  if (!price) return <span className="muted">{dated ? L("Fiyat yok · sohbette yazabilirsin", "No price · you can type it in the chat") : L("Fiyat yok · tarih seçip tekrar kaydet", "No price · pick dates and save again")}</span>;
  return (
    <span className={`price-block${compact ? " compact" : ""}`}>
      <span className="price-main">
        <b>{price.text}</b>
        {price.label && <span className="muted">{price.label}</span>}
        {price.provisional && <span className="tone-warning">{L("· geçici", "· provisional")}</span>}
      </span>
      {price.perNight && <span className="price-night">{price.perNight}</span>}
      {price.note && <span className="price-note">{price.note}</span>}
    </span>
  );
}

export const ratingWords = (): [number, string][] => [
  [9, L("Harika", "Wonderful")],
  [8, L("Çok iyi", "Very good")],
  [7, L("İyi", "Good")],
  [0, L("Fena değil", "Okay")],
];

/** "9,4 · Harika · 1.002 yorum" from the page's rating, on a 10-point scale. */
export function ratingOf(item: Item): { value: string; word: string; count: string | null } | null {
  const r = item.rating;
  const ten = ratingOutOf10(item)?.value;
  if (r.value == null || ten == null) return null;
  return {
    value: r.value.toLocaleString(locale(), { maximumFractionDigits: 1 }),
    word: ratingWords().find(([min]) => ten >= min)![1],
    count: r.count ? L(`${r.count.toLocaleString(locale())} yorum`, `${r.count.toLocaleString(locale())} review${r.count === 1 ? "" : "s"}`) : null,
  };
}

/** "2.'ye göre +€30 · bagaj dahil, direkt · eksiği: iade yok": why it stands where it does, against the one it's weighed with. */
export function TradeLine({ ranked, currency, className }: { ranked: Ranked; currency: string; className: string }) {
  const trade = ranked.trade;
  if (!trade || !ranked.vsRank || !(trade.money || trade.gains.length || trade.losses.length)) return null;
  return (
    <p className={className} title={L(`${trade.vs} ile karşılaştırınca: ${tradeText(trade, currency)}`, `Compared with ${trade.vs}: ${tradeText(trade, currency)}`)}>
      <span className="opt-vs">{L(`${ranked.vsRank}.'ye göre`, `vs #${ranked.vsRank}`)}</span>
      {[
        trade.money && (
          <b key="m" className={trade.diff != null && trade.diff < 0 ? "cheaper" : ""}>
            {moneyText(trade, currency)}
          </b>
        ),
        trade.gains.length > 0 && <span key="g">{trade.gains.join(", ")}</span>,
        trade.losses.length > 0 && (
          <span key="l" className="opt-loss">
            {L("eksiği", "lacks")}: {trade.losses.join(", ")}
          </span>
        ),
      ]
        .filter(Boolean)
        .flatMap((node, i) => (i ? [<span key={`s${i}`} className="sep">{" · "}</span>, node] : [node]))}
    </p>
  );
}
