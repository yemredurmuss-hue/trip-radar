// What a plan card shows when opened (white panel inside the card, ulasim-v3 .detail): everything the old
// decision card said (badges, score and place, why — against the next one or the group's pick —, what to
// check, the fit note, the pivot, the needs, pros and cons, what was read, votes), the price in full, the
// card's files, and what can be done with it.
import type { ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import type { Choice, Ranked } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import type { DocMeta, Item } from "../../lib/types";
import { PivotNote } from "../PivotNote";
import { VoteBar } from "../Share";
import type { Decisions } from "../useDecisions";
import { DocList } from "./DocAccess";
import { datedLink, Details, TradeLine } from "./parts";

const fitWords = () => ({ check: L("Seçmeden kontrol et", "Check before choosing"), partial: L("Kısmi", "Partial"), unfit: L("Uygun değil", "Doesn't fit") });

export function CardDetail({ item, group, decision, decisions, ranked, headline, facts, alert, docs, actions }: {
  item: Item;
  group: Item[];
  decision?: GroupDecision;
  decisions: Decisions | null;
  ranked?: Ranked;
  /** The group's recommendation, on its first option. */
  headline: Choice | null;
  facts: CardFacts;
  alert: { tone: "red" | "amber"; text: string } | null;
  docs: DocMeta[];
  actions: ReactNode;
}) {
  const option = decision?.options.find((o) => o.item.id === item.id);
  const fit = option?.fit ?? "fit";
  const { nights } = datedLink(item, decision);
  const currency = decisions?.ctx.currency ?? "EUR";
  const price = facts.price;
  const priceText = price && [price.text, price.label, price.perNight, price.note, price.provisional ? L("geçici", "provisional") : null].filter(Boolean).join(" · ");
  const pages = new Map(group.map((i) => [i.id, i.url]));
  const placeLine = [facts.score != null ? L(`Uyum puanı ${facts.score}/100`, `Fit score ${facts.score}/100`) : null, ranked?.rank ? L(`${ranked.rank}. sırada`, `ranked #${ranked.rank}`) : null].filter(Boolean).join(" · ");
  return (
    <div className="pk-detail">
      {alert && <p className={`pk-alert ${alert.tone}`}>⏳ {alert.text}</p>}
      {ranked && ranked.badges.length > 0 && <p className="pk-badges">{ranked.badges.join(" · ")}</p>}
      {placeLine && <p className="pk-score-line">{placeLine}</p>}
      {priceText && (
        <dl className="pk-dl">
          <dt>{L("Fiyat", "Price")}</dt>
          <dd>{priceText}</dd>
        </dl>
      )}
      {headline?.headline && <p className="pk-why headline">{headline.headline}</p>}
      {headline && headline.verify.length > 0 && (
        <ul className="pk-verify" aria-label={L("Seçmeden kontrol et", "Check before choosing")}>
          {headline.verify.map((v) => (
            <li key={`${v.itemId}:${v.what}`}>
              <b>{v.name}:</b> {v.what}
              {pages.get(v.itemId) && <a href={pages.get(v.itemId)!} target="_blank" rel="noreferrer">{" "}{L("Sayfada bak ↗", "See on page ↗")}</a>}
            </li>
          ))}
        </ul>
      )}
      {ranked && <TradeLine ranked={ranked} currency={currency} className="pk-why trade" />}
      {ranked && ranked.unknown.length > 0 && (
        <p className="pk-why unknown">
          ? {ranked.unknown.join(", ")}: {L("diğerlerinin yorumlarında geçiyor, bunda hiç geçmiyor; bilinmiyor, sayfada bak", "mentioned in the others' reviews, never in this one's; unknown, check the page")}
        </p>
      )}
      {fit !== "fit" && option && option.fitNotes.length > 0 && (
        <p className={`opt-status ${fit}`}>
          <b>{fitWords()[fit]}:</b> {option.fitNotes.join(" · ")}
        </p>
      )}
      {ranked?.pivot && item.status === "saved" && <PivotNote item={item} pivot={ranked.pivot} />}
      <Details item={item} decision={decision} decisions={decisions} status={facts.status} />
      {nights && (
        <p className="muted small-note">
          {L(
            `Tarihsiz kaydedildi; ${formatDateRange(nights.start, nights.end)} için geçici karşılaştırılıyor. Tarihlerle açıp tekrar kaydedersen gerçek fiyat işlenir.`,
            `Saved without dates; compared for ${formatDateRange(nights.start, nights.end)} for now. Open it with dates and save again to get the real price.`,
          )}
        </p>
      )}
      <VoteBar item={item} />
      {docs.length > 0 && <DocList docs={docs} />}
      <div className="pk-acts">{actions}</div>
    </div>
  );
}
