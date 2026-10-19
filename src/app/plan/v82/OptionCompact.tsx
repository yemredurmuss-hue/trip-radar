// The options of a single choice in the frame (plan v82: Karar bekliyor, and Değiştir turning the chosen card back to them):
// "Seçenekler · 4 · ilk 3, tümü Pano'da", "Kendin ara" with the sites on the right, three cards. Each card (0.38.6, Emre:
// the picks' card under the box is the right one): its photo near its own shape, 4:3 (square when narrow), never a thin
// strip, with who added it, our pick, En ucuz; the site's label and its rating, the name, the price (else the source's
// usual range, "tipik €21–64 / gece") and "Seç"; the box is as tall as its cards while they're shown. While
// changing, the one chosen is marked ("Seçili") and "Vazgeç" turns the card back. Fewer than three: the rest asks for more.
// Its name and price edit where they stand (C2): the price on a click, the name when the card was just added (or by Tab).
import { L } from "../../../lib/i18n";
import { locative } from "../../../lib/i18nText";
import { badgeWord, optionPrice, optionsHead, ratingParts, SHOWN_OPTIONS, sourceBadge, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { Editable, InlineEdit, useInlineEdit } from "../../cards/InlineEdit";
import { Ic, Mark } from "./icons";

export function SelfLinks({ links, label = true }: { links: SelfSearch[]; label?: boolean }) {
  if (!links.length) return null;
  return (
    <span className="z-self">
      {label && <small>{L("Kendin ara", "Search yourself")}</small>}
      {links.map((l) => (
        <a key={l.id} className="z-pl" href={l.url} target="_blank" rel="noopener noreferrer" title={L(`${locative(l.name)} ara · yeni sekmede açılır`, `Search ${l.name} · opens in a new tab`)}>
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

/** A stay's usual range by the night as its source gives it (stayPicks.typicalNight), for an option with no price. */
export type Typical = (o: OptionVM) => { amount: string; unit: string; title: string } | null;

type CardProps = { o: OptionVM; art: string; current: boolean; typical: Typical | null; onPick: () => void; onOpen: () => void };

function OptionCard(props: CardProps) {
  return (
    <InlineEdit item={props.o.item} only={["name", "price"]}>
      <OptionFace {...props} />
    </InlineEdit>
  );
}

function OptionFace({ o, art, current, typical, onPick, onOpen }: CardProps) {
  const price = optionPrice(o.price);
  const usual = price ? null : (typical?.(o) ?? null);
  const tag = o.badges[0];
  const edit = useInlineEdit();
  return (
    <article className={`q-card q-opt z-oc${current ? " is-cur" : ""}`} data-item-id={o.id} aria-label={o.title} data-new={L("Yeni", "New")}>
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
          {edit?.open === "name" ? (
            <Editable field="name" />
          ) : (
            // B14: its name opens its record's details (Tüm detaylar).
            <button type="button" className="z-tb" onClick={onOpen} aria-label={L(`${o.title}: tüm detaylar`, `${o.title}: all details`)}>
              {o.title}
            </button>
          )}
        </h3>
        <div className="z-of">
          <Editable field="price">
            {price && (
              <span className="q-pr">
                <b>{price.amount}</b>
                {/* Saved without its dates: priced for these nights for now ("geçici"; its page opens with them). */}
                {(price.unit || o.price?.provisional) && (
                  <small>
                    {price.unit}
                    {o.price?.provisional && <i className="z-prov">{price.unit ? " · " : ""}{L("geçici", "provisional")}</i>}
                  </small>
                )}
              </span>
            )}
            {usual && (
              <span className="q-pr" title={usual.title}>
                <b>{usual.amount}</b>
                <small>{usual.unit}</small>
              </span>
            )}
          </Editable>
          <button type="button" className="q-pick" aria-pressed={current || undefined} aria-label={current ? L(`${o.title}: seçili`, `${o.title}: chosen`) : L(`${o.title}: seç`, `${o.title}: choose`)}
            onClick={current ? undefined : onPick}>
            {current ? L("Seçili", "Chosen") : L("Seç", "Choose")}
          </button>
        </div>
      </div>
    </article>
  );
}

export function OptionList({ vm, options, current, changing, art, links, typical = null, onPick, onOpen, onCancel, onAsk }: {
  vm: IntentVM;
  options: OptionVM[];
  /** The one chosen, marked while changing. */
  current: string | null;
  changing: boolean;
  /** The kind's drawing for an option with no photo. */
  art: string;
  links: SelfSearch[];
  typical?: Typical | null;
  onPick: (o: OptionVM) => void;
  /** An option's record (its drawer). */
  onOpen: (o: OptionVM) => void;
  onCancel: () => void;
  onAsk: (() => void) | null;
}) {
  const head = optionsHead(vm, changing);
  const left = SHOWN_OPTIONS - options.length;
  return (
    <div className="q-opts z-optc">
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
          <OptionCard key={o.id} o={o} art={art} current={o.id === current} typical={typical} onPick={() => onPick(o)} onOpen={() => onOpen(o)} />
        ))}
        {left > 0 && (
          <div className="z-oc0" style={{ "--span": left } as React.CSSProperties}>
            <b>{L("Daha fazla seçenek", "More options")}</b>
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
