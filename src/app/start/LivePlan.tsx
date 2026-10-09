// "Plan taslağı" (2026-10-09, Emre: "şablonu çıkarsın, sağ tarafta oluşmaya devam etsin, tık tık tık"): while the
// chat goes on, the plan "Oluştur" would make (startCreate.wouldMake, in memory, nothing stored) drawn in the board's
// v11 sections and card material: dashed = still to find. A card appears the moment its answer is known (staggered,
// one after another), and a card an answer changes glows once (roadmap K5: every answer visibly changes the board).
// With reduced motion the cards are simply there and a change is a steady outline.
import { useEffect, useMemo, useRef, useState } from "react";
import { planSectionOfItem, type SectionId } from "../../lib/categories";
import { cardKind } from "../../lib/cardKinds";
import { L, withLang, type Lang } from "../../lib/i18n";
import { formatDateRange, nightsBetween } from "../../lib/items";
import { wouldMake } from "../../lib/startCreate";
import type { StartState } from "../../lib/startTrip";
import type { Item } from "../../lib/types";
import { KindIcon } from "../cards/Silhouettes";
import { SECTION_META } from "../plan/sectionMeta";

/** The sections the start makes cards in, in the board's order. */
const ORDER: SectionId[] = ["flight", "stay", "transport", "activity", "todo", "other", "prep"];
/** How long a changed card glows. */
const GLOW_MS = 1400;

interface Card {
  key: string;
  section: SectionId;
  item: Item;
  title: string;
  sub: string;
  /** What, when it changes, the glow says changed. */
  sig: string;
}

function cardOf(item: Item, flightNo: number): Card {
  const section = planSectionOfItem(item);
  const kind = cardKind(item);
  const start = item.dates?.start ?? null;
  const end = item.dates?.end ?? null;
  const nights = start && end ? nightsBetween(start, end) : 0;
  const when = start ? formatDateRange(start, item.category === "stay" ? end : null) : null;
  let title = item.name;
  let sub = when ?? L("Tarih bekliyor", "Waiting for the dates");
  if (kind === "flight" && item.flight) {
    const { from, to } = item.flight;
    // Home not said yet: the way out is "Gidiş · Denpasar", the way back "Dönüş · Denpasar".
    title = from && to ? `${from} → ${to}` : to ? L(`Gidiş · ${to}`, `Out · ${to}`) : from ? L(`Dönüş · ${from}`, `Back · ${from}`) : item.name;
    if (!from || !to) sub = L(`${when ? `${when} · ` : ""}nereden çıkacağın bekleniyor`, `${when ? `${when} · ` : ""}waiting for where you leave from`);
  } else if (item.category === "stay") {
    title = item.city ?? item.name;
    sub = nights ? `${when} · ${L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`)}` : L("Geceler tarihle gelir", "The nights come with the dates");
  } else if (item.category === "transport" && item.flight && (item.flight.from || item.flight.to)) {
    title = item.name;
    sub = [when, [item.flight.from, item.flight.to].filter(Boolean).join(" → ")].filter(Boolean).join(" · ");
  } else if (section === "prep") {
    sub = L("Hazırlık listesine", "On the prep list");
  }
  // The same need keeps its card across answers (a stay is its city, a flight its direction).
  // (The flights by their order: the way out first, the way back second, whatever home turns out to be.)
  const who = item.category === "stay" ? `stay:${(item.city ?? "").toLocaleLowerCase()}` : kind === "flight" ? `flight:${flightNo}` : `${section}:${item.name}`;
  return { key: who, section, item, title, sub, sig: `${title}|${sub}` };
}

export function LivePlan({ state, lang }: { state: StartState; lang: Lang }) {
  const cards = useMemo(() => withLang(lang, () => {
    const made = wouldMake(state);
    if (!made) return [];
    const seen = new Set<string>();
    let flights = 0;
    return made.items.map((item) => cardOf(item, cardKind(item) === "flight" ? flights++ : -1)).map((c) => {
      // Two flights from nowhere yet: told apart by their order.
      let key = c.key;
      for (let n = 2; seen.has(key); n++) key = `${c.key}#${n}`;
      seen.add(key);
      return { ...c, key };
    });
  }), [state, lang]);

  // Which cards an answer just changed (their words differ from the last time they were drawn).
  const last = useRef<Map<string, string>>(new Map());
  const [glow, setGlow] = useState<Set<string>>(new Set());
  useEffect(() => {
    const changed = cards.filter((c) => last.current.has(c.key) && last.current.get(c.key) !== c.sig).map((c) => c.key);
    last.current = new Map(cards.map((c) => [c.key, c.sig]));
    if (!changed.length) return;
    setGlow(new Set(changed));
    const t = setTimeout(() => setGlow(new Set()), GLOW_MS);
    return () => clearTimeout(t);
  }, [cards]);

  // New cards come in one after another, in the board's order (a short beat each, a whole plan in under a second).
  const order = useRef<Map<string, number>>(new Map());
  let fresh = 0;
  for (const c of cards) if (!order.current.has(c.key)) order.current.set(c.key, fresh++);
  const delay = (key: string) => {
    const n = order.current.get(key) ?? 0;
    return `${Math.min(n, 8) * 90}ms`;
  };
  useEffect(() => {
    // Drawn once: from now on these are old cards (a later answer's new ones start their own count).
    const t = setTimeout(() => {
      for (const c of cards) order.current.set(c.key, 0);
    }, 900);
    return () => clearTimeout(t);
  }, [cards]);

  if (!cards.length) return null;
  const sections = ORDER.map((id) => ({ id, cards: cards.filter((c) => c.section === id) })).filter((s) => s.cards.length);

  return withLang(lang, () => (
    <section className="lp" aria-label={L("Plan taslağı", "Draft plan")}>
      <div className="lp-head">
        <h3>{L("Plan taslağı", "Draft plan")}</h3>
        <span className="lp-count">{L(`${cards.length} kart`, `${cards.length} card${cards.length === 1 ? "" : "s"}`)}</span>
      </div>
      <p className="lp-note">{L("Cevapladıkça kartlar dolar; Oluştur'a basınca hepsi panona geçer.", "The cards fill as you answer; Create puts them all on your board.")}</p>
      {sections.map((s) => {
        const meta = SECTION_META[s.id];
        return (
          <div key={s.id} className="lp-sec" data-sec={s.id}>
            <div className="lp-sec-h">
              <span className="lp-sec-icon" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, #fff)` }}>
                <KindIcon kind={meta.icon} size={17} />
              </span>
              <b>{meta.label()}</b>
              <span className="lp-sec-n">{s.cards.length}</span>
            </div>
            <div className={`lp-cards${s.id === "prep" ? " lp-prep" : ""}`}>
              {s.cards.map((c) =>
                s.id === "prep" ? (
                  <div key={c.key} className="lp-chip" style={{ animationDelay: delay(c.key) }}>
                    <span className="lp-box" aria-hidden />
                    {c.title}
                  </div>
                ) : (
                  <div key={c.key} className={`lp-card${glow.has(c.key) ? " glow" : ""}`} style={{ animationDelay: delay(c.key) }} data-key={c.key}>
                    <div className="lp-card-top">
                      <span className="lp-ring" aria-hidden />
                      <span className="lp-kind" style={{ color: meta.color }}>
                        <KindIcon kind={cardKind(c.item)} size={15} />
                      </span>
                      <span className="lp-stage">{L("Arıyoruz", "Searching")}</span>
                    </div>
                    <div className="lp-title">{c.title}</div>
                    <div className="lp-sub">{c.sub}</div>
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}
    </section>
  ));
}
