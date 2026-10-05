// The Comparison window's cards view (0.37, otel panosu v2, docs/mockups/2026-10-06-otel-panosu-v2.html): the
// same decision as the table, as a board of photo cards. Each card: the picture, its one badge (Önerim, Favori,
// En ucuz, En yüksek puan), the engine's score, the name, the price a night and in all, the site and rating, the
// biggest pros and cons as the Plan's cards say them ("yalnız bunda"), the people's reactions (Olmaz · Olur ·
// Süper, on a shared trip) and Seç / Ele. Sort and filter above; tick two or three to see them side by side in
// the table; "+ Seçenek ekle" points to the chat box and the Save button.
import { useState } from "react";
import { boardBadges, boardOptions, type BoardBadge, type BoardSort } from "../../lib/board";
import { cardFacts } from "../../lib/cardFacts";
import type { DecisionContext, GroupDecision, OptionResult } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { NEED_MARK } from "../../lib/needs";
import { voteKeyOf, type VoteValue } from "../../lib/share/votes";
import type { Item } from "../../lib/types";
import { setItemStatus } from "../actions";
import { FallbackImg } from "../FallbackImg";
import { KindIcon } from "../cards/Silhouettes";
import { ratingOf } from "../cards/parts";
import { useShare } from "../Share";

const BADGE: Record<BoardBadge, [string, string, string]> = {
  pick: ["✦ Önerim", "✦ Our pick", "bd-b-pick"],
  fav: ["♥ Favori", "♥ Favourite", "bd-b-fav"],
  cheap: ["€ En ucuz", "€ Cheapest", "bd-b-cheap"],
  top: ["★ En yüksek puan", "★ Top rated", "bd-b-top"],
};

const SORTS: [BoardSort, string, string][] = [
  ["best", "Önerim", "Our pick"],
  ["price", "Fiyat ↑", "Price ↑"],
  ["rating", "Puan", "Rating"],
  ["location", "Konum", "Location"],
];

const REACTIONS: [Exclude<VoteValue, 0>, string, string, string][] = [
  [-1, "😕", "Olmaz", "No"],
  [1, "🙂", "Olur", "Fine"],
  [2, "🤩", "Süper", "Love it"],
];

export function OptionBoard({ decision, ctx, onOpenItem, onChoose, onSideBySide, onAdd }: {
  decision: GroupDecision;
  ctx?: DecisionContext;
  onOpenItem: (item: Item) => void;
  onChoose: (option: OptionResult) => void;
  /** The ticked options, side by side in the table. */
  onSideBySide: (itemIds: string[]) => void;
  /** "+ Seçenek ekle": to the chat box (a link) or the page's Save. */
  onAdd: () => void;
}) {
  const share = useShare();
  const [sort, setSort] = useState<BoardSort>("best");
  const [freeOnly, setFreeOnly] = useState(false);
  const [withOut, setWithOut] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const loves = new Map(decision.options.map((o) => [o.item.id, share?.tally(o.item).loves ?? 0]));
  const badges = boardBadges(decision, loves);
  const options = boardOptions(decision, { sort, freeOnly, withOut });
  const outCount = decision.options.filter((o) => o.excluded || o.eliminated).length;
  const voters = share ? new Set(share.votes.filter((v) => v.vote !== 0).map((v) => v.author.toLocaleLowerCase("tr"))).size : 0;
  const tick = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id].slice(-3)));
  return (
    <div className="bd">
      <div className="bd-tools">
        {SORTS.map(([s, tr, en]) => (
          <button key={s} type="button" className={`bd-chip${sort === s ? " on" : ""}`} aria-pressed={sort === s} onClick={() => setSort(s)}>
            {L(tr, en)}
          </button>
        ))}
        <span className="bd-sep" aria-hidden />
        <button type="button" className={`bd-chip f${freeOnly ? " on" : ""}`} aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
          {L("Ücretsiz iptal", "Free cancellation")}
        </button>
        {outCount > 0 && (
          <button type="button" className={`bd-chip f${withOut ? " on" : ""}`} aria-pressed={withOut} onClick={() => setWithOut(!withOut)}>
            {L(`Elenenler (${outCount})`, `Ruled out (${outCount})`)}
          </button>
        )}
        <span className="bd-count">
          {L(`${decision.options.length - outCount} seçenek`, `${decision.options.length - outCount} option${decision.options.length - outCount === 1 ? "" : "s"}`)}
          {voters > 0 && L(` · ${voters} kişi oy verdi`, ` · ${voters} voted`)}
        </span>
      </div>
      <div className="bd-grid">
        {options.map((o) => (
          <OptionCard key={o.item.id} option={o} decision={decision} ctx={ctx} badge={badges.get(o.item.id) ?? null} ticked={ticked.includes(o.item.id)}
            onTick={() => tick(o.item.id)} onOpen={() => onOpenItem(o.item)} onChoose={() => onChoose(o)} />
        ))}
        <button type="button" className="bd-card bd-add" onClick={onAdd}>
          <b aria-hidden>+</b>
          {L("Seçenek ekle", "Add an option")}
          <small>{L("Linki sohbet kutusuna bırak ya da sayfada Trip Radar'da \"Kaydet\"e bas", "Drop the link in the chat box, or press \"Save\" in Trip Radar on the page")}</small>
        </button>
      </div>
      {ticked.length >= 2 && (
        <div className="bd-bar">
          <span>{L(`${ticked.length} seçenek işaretli`, `${ticked.length} options ticked`)}</span>
          <button type="button" onClick={() => onSideBySide(ticked)}>{L("Tabloda yan yana gör →", "Side by side in the table →")}</button>
        </div>
      )}
    </div>
  );
}

function OptionCard({ option, decision, ctx, badge, ticked, onTick, onOpen, onChoose }: {
  option: OptionResult;
  decision: GroupDecision;
  ctx?: DecisionContext;
  badge: BoardBadge | null;
  ticked: boolean;
  onTick: () => void;
  onOpen: () => void;
  onChoose: () => void;
}) {
  const item = option.item;
  const facts = cardFacts(item, decision, ctx);
  const rating = ratingOf(item);
  const out = !!option.excluded || !!option.eliminated;
  const chosen = item.status === "chosen";
  const booked = item.status === "booked";
  const winner = option === decision.winner;
  const pros = facts.pros.slice(0, 2);
  const cons = facts.cons.slice(0, chosen || winner ? 1 : 2);
  const more = facts.pros.length - pros.length + facts.cons.length - cons.length;
  const tile = (
    <span className="bd-ph-ic" aria-hidden>
      <KindIcon kind="stay" size={40} />
    </span>
  );
  return (
    <div className={`bd-card${chosen || booked ? " chosen" : ""}${out ? " out" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <div className="bd-pic">
        {facts.image ? <FallbackImg className="bd-img" src={facts.image} fallback={tile} /> : tile}
        {badge && <span className={`bd-badge ${BADGE[badge][2]}`}>{L(BADGE[badge][0], BADGE[badge][1])}</span>}
        {!out && (
          <button type="button" className={`bd-tick${ticked ? " on" : ""}`} aria-pressed={ticked} title={L("Yan yana karşılaştırmak için işaretle", "Tick to compare side by side")}
            aria-label={L(`${item.name}: yan yana karşılaştırmaya ekle`, `${item.name}: add to the side-by-side`)} onClick={onTick}>
            {ticked ? "✓" : "+"}
          </button>
        )}
        {facts.score != null && !out && (
          <span className={`bd-score${winner ? " best" : facts.score < 55 ? " low" : ""}`} title={L("Önceliklerine göre puan", "Score by what matters to you")}>
            <b>{facts.score}</b>
            <small>{L("puan", "score")}</small>
          </span>
        )}
      </div>
      <div className="bd-body">
        <div className="bd-row1">
          <button type="button" className="bd-name" onClick={onOpen} title={L("Tüm detaylar", "All details")}>
            {item.name}
          </button>
          {facts.price && (
            <span className="bd-price">
              <b>{facts.price.perNight ?? facts.price.text}</b>
              <small>{facts.price.perNight ? [facts.price.text, facts.price.label].filter(Boolean).join(" ") : (facts.price.label ?? "")}</small>
            </span>
          )}
        </div>
        <div className="bd-meta">
          {facts.source && <span className="bd-src">{facts.source.label}</span>}
          {rating && (
            <span>
              <span className="bd-star" aria-hidden>★</span> <b>{rating.value}</b>
              {rating.count && ` (${rating.count})`}
            </span>
          )}
          {item.location.area && <span>{item.location.area}</span>}
          {(chosen || booked) && <span className="bd-in">{booked ? L("✓ Rezerve", "✓ Booked") : L("✓ Planında", "✓ In your plan")}</span>}
        </div>
        {/* What the traveller asked for, checked on this one ("✓ Sessiz", "✕ Mutfak"), as on the Plan's cards. */}
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
            {pros.map((p) => (
              <li key={`p${p.text}`}>
                <span className="p" aria-hidden>+</span>
                <span>{p.text}{p.unique && <i className="bd-only">{L("yalnız bunda", "only here")}</i>}</span>
              </li>
            ))}
            {cons.map((c) => (
              <li key={`c${c.text}`}>
                <span className="m" aria-hidden>−</span>
                <span>{c.text}{c.unique && <i className="bd-only m">{L("yalnız bunda", "only here")}</i>}</span>
              </li>
            ))}
            {more > 0 && (
              <li>
                <button type="button" className="bd-more" onClick={onOpen}>
                  {L(`+${more} daha`, `+${more} more`)}
                </button>
              </li>
            )}
          </ul>
        )}
        <div className="bd-foot">
          <Reactions item={item} />
          <span className="bd-act">
            {!chosen && !booked && !out && (
              <button type="button" className="bd-ele" onClick={() => void setItemStatus(item, "dismissed")}>
                {L("Ele", "Rule out")}
              </button>
            )}
            {booked ? (
              <span className="bd-pick done">{L("Rezerve ✓", "Booked ✓")}</span>
            ) : chosen ? (
              <button type="button" className="bd-pick done" onClick={onChoose} title={L("Seçimi geri al", "Undo choice")}>
                {L("✓ Seçili", "✓ Chosen")}
              </button>
            ) : (
              !out && (
                <button type="button" className="bd-pick" onClick={onChoose}>
                  {L("Seç", "Choose")}
                </button>
              )
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Olmaz · Olur · Süper on a shared trip (a tap again takes it back), and who said what. */
function Reactions({ item }: { item: Item }) {
  const share = useShare();
  const key = voteKeyOf(item);
  if (!share || !key) return null;
  const mine = share.tally(item).mine;
  const others = share.votes.filter((v) => v.itemKey === key && v.vote !== 0);
  const word = (v: VoteValue) => REACTIONS.find(([value]) => value === v);
  return (
    <span className="bd-react">
      {REACTIONS.map(([value, emoji, tr, en]) => (
        <button key={value} type="button" className={`bd-r${mine === value ? " me" : ""}`} aria-pressed={mine === value}
          aria-label={L(`${item.name}: ${tr}`, `${item.name}: ${en}`)} onClick={() => share.vote(item, mine === value ? 0 : value)}>
          <em aria-hidden>{emoji}</em>
          {L(tr, en)}
        </button>
      ))}
      {others.length > 0 && (
        <span className="bd-who">
          {others.map((v) => {
            const w = word(v.vote);
            const photo = share.photos[v.author];
            return (
              <span key={v.author} className="bd-av" title={`${v.author}: ${w ? L(w[2], w[3]) : ""}`}>
                {photo ? <img src={photo} alt="" /> : v.author.trim().charAt(0).toLocaleUpperCase("tr")}
                <i aria-hidden>{w?.[1]}</i>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
