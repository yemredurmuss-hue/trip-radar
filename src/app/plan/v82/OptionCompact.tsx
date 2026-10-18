// The options of a single choice in the frame (plan v82: Karar bekliyor, and Değiştir turning the chosen card back to them):
// "Seçenekler · 4 · ilk 3, tümü Pano'da", "Kendin ara" with the sites on the right, three cards as tall as the frame. Each
// card: its picture (who added it, our pick, En ucuz), the site's label and its rating, the name, the price and "Seç". While
// changing, the one chosen is marked ("Seçili") and "Vazgeç" turns the card back. Fewer than three: the rest asks for more.
import { L } from "../../../lib/i18n";
import { badgeWord, optionPrice, optionsHead, ratingParts, sourceBadge, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { Ic, Mark } from "./icons";

export function SelfLinks({ links, label = true }: { links: SelfSearch[]; label?: boolean }) {
  if (!links.length) return null;
  return (
    <span className="z-self">
      {label && <small>{L("Kendin ara", "Search yourself")}</small>}
      {links.map((l) => (
        <a key={l.id} className="z-pl" href={l.url} target="_blank" rel="noopener noreferrer" title={L(`${l.name}'da ara · yeni sekmede açılır`, `Search ${l.name} · opens in a new tab`)}>
          <Mark color={l.color} letter={l.letter} small />
          <span>{l.name}</span>
        </a>
      ))}
    </span>
  );
}

/** The site's label in its colour ("Booking.com"); a site we don't know on a plain grey one. */
export function BrandChip({ brand }: { brand: OptionVM["brand"] }) {
  if (!brand) return null;
  return (
    <span className={`q-brand${brand.color ? "" : " plain"}`} style={brand.color ? ({ "--bl": brand.color } as React.CSSProperties) : undefined}>
      {brand.label}
    </span>
  );
}

export function Rating({ rating }: { rating: string | null }) {
  const r = ratingParts(rating);
  if (!r) return null;
  return (
    <span className="z-rate">
      <b className={`q-rb${r.star ? " star" : ""}`}>{r.score}</b>
      {r.reviews && <small>{r.reviews}</small>}
    </span>
  );
}

export function SourceBadge({ option }: { option: OptionVM }) {
  const b = sourceBadge(option);
  if (!b) return null;
  return (
    <span className={`q-src ${b.tone}`}>
      {b.initial && <i>{b.initial}</i>}
      {b.text}
    </span>
  );
}

function OptionCard({ o, art, current, onPick, onOpen }: { o: OptionVM; art: string; current: boolean; onPick: () => void; onOpen: () => void }) {
  const price = optionPrice(o.price);
  const tag = o.badges[0];
  return (
    <article className={`q-card q-opt z-oc${current ? " is-cur" : ""}`} data-item-id={o.id} aria-label={o.title}>
      <div className={`z-op${o.image ? "" : " art"}`}>
        <img className={o.image ? "ph" : undefined} src={o.image ?? art} alt="" />
        <SourceBadge option={o} />
        {tag && <span className="q-tag on-ph">{badgeWord(tag)}</span>}
      </div>
      <div className="z-ob">
        <span className="z-l1">
          <BrandChip brand={o.brand} />
          <Rating rating={o.rating} />
        </span>
        <h3 className="z-t" title={o.title}>
          {/* B14: its name opens its record's details (Tüm detaylar). */}
          <button type="button" className="z-tb" onClick={onOpen} aria-label={L(`${o.title}: tüm detaylar`, `${o.title}: all details`)}>
            {o.title}
          </button>
        </h3>
        <div className="z-of">
          {price ? (
            <span className="q-pr">
              <b>{price.amount}</b>
              {price.unit && <small>{price.unit}</small>}
            </span>
          ) : (
            <span />
          )}
          <button type="button" className="q-pick" aria-pressed={current || undefined} aria-label={current ? L(`${o.title}: seçili`, `${o.title}: chosen`) : L(`${o.title}: seç`, `${o.title}: choose`)}
            onClick={current ? undefined : onPick}>
            {current ? L("Seçili", "Chosen") : L("Seç", "Choose")}
          </button>
        </div>
      </div>
    </article>
  );
}

export function OptionList({ vm, options, current, changing, art, links, onPick, onOpen, onCancel, onAsk }: {
  vm: IntentVM;
  options: OptionVM[];
  /** The one chosen, marked while changing. */
  current: string | null;
  changing: boolean;
  /** The kind's drawing for an option with no photo. */
  art: string;
  links: SelfSearch[];
  onPick: (o: OptionVM) => void;
  /** An option's record (its drawer). */
  onOpen: (o: OptionVM) => void;
  onCancel: () => void;
  onAsk: (() => void) | null;
}) {
  const head = optionsHead(vm, changing);
  const left = 3 - options.length;
  return (
    <div className="q-opts">
      <div className="q-oh">
        <b className="q-ot">{head.title}</b>
        {head.caption && <small className="q-oc">{head.caption}</small>}
        <span className="q-sp" />
        <SelfLinks links={links} />
        {changing && (
          <button type="button" className="q-cancel" onClick={onCancel}>
            {L("Vazgeç", "Cancel")}
          </button>
        )}
      </div>
      <div className="q-cards z-ocs">
        {options.map((o) => (
          <OptionCard key={o.id} o={o} art={art} current={o.id === current} onPick={() => onPick(o)} onOpen={() => onOpen(o)} />
        ))}
        {left > 0 && (
          <div className="z-oc0" style={{ "--span": left } as React.CSSProperties}>
            <b>{L("Daha fazla seçenek", "More options")}</b>
            <small>{L("Sohbete bir link at ya da AI'dan iste; buraya gelir.", "Send a link in the chat or ask the AI; it lands here.")}</small>
            {onAsk && (
              <button type="button" className="q-ai" onClick={onAsk}>
                <Ic name="spark" size={14} />
                {L("AI'dan öner", "Ask the AI")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
