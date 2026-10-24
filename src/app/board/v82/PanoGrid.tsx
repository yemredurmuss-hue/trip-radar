// The Pano's cards (plan v81 "kartlar hep aynı boy", mk83.js gridCard and group): every option of an intent one size (220 px),
// a single option no larger. A card: its picture or its carrier's mark, where it's from, where it stands; its site (to its page),
// its name, one grey line; its price and fit; the heart and who liked it, and Seç / + Plana koy. A group's head: the intent, its
// line and how many, "Yan yana karşılaştır ›" where options compare.
import { L } from "../../../lib/i18n";
import { inView, recordsText, type PanoNeed, type PanoOption } from "../../../lib/panoBoard";
import { isDeck, PanoDeck } from "./PanoDeck";
import { Likes, PickButton, Score, SourceBadge, StateChip, tintOf, Visual } from "./parts";

export function PanoCard({ option, need, fresh }: { option: PanoOption; need: PanoNeed; fresh: boolean }) {
  const site = option.brand ? (
    option.url ? (
      <a className="q-pgbn" href={option.url} target="_blank" rel="noreferrer" title={L(`${option.brand} sayfasını aç`, `Open it on ${option.brand}`)}>
        {option.brand} ↗{fresh && <b className="q-new">{L("Yeni", "New")}</b>}
      </a>
    ) : (
      <span className="q-pgbn">
        {option.brand}
        {fresh && <b className="q-new">{L("Yeni", "New")}</b>}
      </span>
    )
  ) : fresh ? (
    <span className="q-pgbn">
      <b className="q-new">{L("Yeni", "New")}</b>
    </span>
  ) : null;
  return (
    <article className={`q-pg${option.current ? " cur" : ""}${fresh ? " ar-new" : ""}`} id={`pn-${option.id}`} aria-label={option.item.name} data-item-id={option.id} style={tintOf(need.section)}>
      <div className={`q-ph${option.mark ? " lg" : ""}`}>
        <Visual option={option} />
        <SourceBadge source={option.source} />
        <StateChip option={option} multi={need.multi} />
      </div>
      <div className="q-pgb">
        {site}
        <b>{option.name}</b>
        {option.sub && <small>{option.sub}</small>}
        <div className="q-pgm">
          {option.price ? (
            <span className="q-pr">
              <b>{option.price.big}</b>
              {option.price.unit && <small>{option.price.unit}</small>}
            </span>
          ) : (
            <span />
          )}
          <Score option={option} />
        </div>
        <div className="q-pgf">
          <Likes option={option} />
          <PickButton option={option} need={need} />
        </div>
      </div>
    </article>
  );
}

/**
 * One intent's cards under its head. `showWord`: in the mixed lists (Tümü, Biriktirdiklerim, AI önerileri) the line starts with its
 * category or kind ("Konaklama · 3 gece · 2–5 Nis · 4 kayıt"). `filter`: only what this list shows. `bare`: the intent's own page
 * (its head is the page's).
 */
export function PanoGroup({ need, filter = "all", showWord = false, bare = false, fresh, onCompare, onReveal, onAsk }: {
  need: PanoNeed;
  filter?: "all" | "mine" | "ai";
  showWord?: boolean;
  bare?: boolean;
  fresh: ReadonlySet<string>;
  onCompare: (need: PanoNeed) => void;
  /** "Plan'da gör" on a deck's head, "Yeni bul" (the drawer's card on the Pano, PanoDeck). */
  onReveal?: (itemId: string) => void;
  onAsk?: (need: PanoNeed) => void;
}) {
  if (!bare && isDeck(need)) return <PanoDeck need={need} filter={filter} fresh={fresh} onReveal={onReveal} onAsk={onAsk} />;
  const options = need.options.filter((o) => inView(filter, o));
  if (!options.length) return null;
  const line = [showWord ? need.word : null, need.info || null, recordsText(options.length)].filter(Boolean).join(" · ");
  return (
    <section className="q-grp" data-need={need.key} aria-label={need.name}>
      {!bare && (
        <div className="q-gh">
          <b>{need.name}</b>
          <small>{line}</small>
          <span className="q-sp" />
          {need.compare && (
            <button type="button" className="q-cmpb" onClick={() => onCompare(need)}>
              {L("Yan yana karşılaştır ›", "Compare side by side ›")}
            </button>
          )}
        </div>
      )}
      <div className="q-pgrid">
        {options.map((o) => (
          <PanoCard key={o.id} option={o} need={need} fresh={fresh.has(o.id)} />
        ))}
      </div>
    </section>
  );
}
