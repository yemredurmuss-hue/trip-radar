// The back of a card (plan v46 F4, mockup v46 "backFace"): the card turns where it stands. BackHost keeps the front in its place
// (unseen, unreachable) and the back is laid over it across the whole row of the grid, upward when the card is in the last row,
// in the flow with the full width when the grid is one column (a phone), and what it covers cannot be reached until it closes.
// Two sections, "Kaydettikleriniz" (everyone but the AI) and "Önerimiz" (the AI), three small cards at most in each and one
// action tile at the end: "Kendin ara" (the searches of Plan, prefilled) and "AI'a arat" (a line for the chat, "Arıyoruz…" meanwhile).
// A flight's option is P2's FlightOption; every other kind a tile with its picture. Esc, the × and the empty space close it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cardFacts, tripPeople } from "../../lib/cardFacts";
import { flightLeg, ticketPrices, ticketStub } from "../../lib/cardTicket";
import { cardKindColor, type cardKind } from "../../lib/cardKinds";
import { topDate } from "../../lib/cardView";
import type { Choice } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { brandOf } from "../../lib/brands";
import { isFresh, loadSeen, markSeen, onPlan, splitBack, tagOf } from "../../lib/backFace";
import { draftOf } from "../../lib/draft";
import { L } from "../../lib/i18n";
import { groupKeyOf } from "../../lib/plan";
import type { SearchLink } from "../../lib/searchLinks";
import type { Item } from "../../lib/types";
import { chooseItem } from "../actions";
import { FallbackImg } from "../FallbackImg";
import { reducedMotion } from "../motion";
import { AskButton } from "./AskButton";
import { SearchRow } from "./EmptyCard";
import { FlightOption } from "./FlightOption";
import { ILLUS, illusOf } from "./MediaCard";
import { useCardEnv } from "./PlanCard";
import { MineStar } from "./MineStar";
import { BrandPill } from "./RideCard";
import { KindIcon, UiIcon } from "./Silhouettes";
import { SavedFace } from "./WhoseBadge";
import { datedLink, stayRatingOf, TradeLine } from "./parts";
import { useSearching } from "./searching";

/** The closing turn back is this long (ms): --t-quick, with a little room. */
const CLOSE_MS = 190;

/**
 * The card and, when `open`, its back. The front stays rendered (it keeps the cell's size, so nothing below it moves), unseen and
 * `inert`; the back is the next sibling, placed by itself (BackFace) and marking the container `data-bk` "over" or "flow".
 */
export function BackHost({ open, front, back }: { open: boolean; front: ReactNode; back: ReactNode }) {
  return (
    <>
      <div className={`bk-front${open ? " off" : ""}`} inert={open}>
        {front}
      </div>
      {open && back}
    </>
  );
}

/** Lays the back over its cell and keeps what it covers out of reach; undoes both when it goes. */
function useOverlay(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    const home = el?.parentElement;
    if (!el || !home) return;
    const cell = el.closest<HTMLElement>(".cat-card, .ek-cell");
    const grid = cell?.closest<HTMLElement>(".cat-grid") ?? null;
    const covered = new Set<HTMLElement>();
    const release = () => {
      for (const c of covered) c.inert = false;
      covered.clear();
    };
    const place = () => {
      if (!cell || !grid) {
        home.dataset.bk = "flow";
        el.removeAttribute("style");
        return;
      }
      const g = grid.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const wide = g.width > c.width + 24;
      home.dataset.bk = wide ? "over" : "flow";
      if (!wide) {
        el.style.cssText = "";
      } else {
        // The last row of a grid with rows above it grows upward; any other row downward.
        const others = [...grid.children].filter((n) => n !== cell).map((n) => n.getBoundingClientRect());
        const lastRow = others.length > 0 && others.every((r) => r.top <= c.top + 2) && others.some((r) => r.top < c.top - 2);
        el.style.left = `${g.left - c.left}px`;
        el.style.width = `${g.width}px`;
        el.style.top = lastRow ? "auto" : "0";
        el.style.bottom = lastRow ? "0" : "auto";
      }
      // What the back lies over is not clickable, not focusable, until it closes.
      release();
      const b = el.getBoundingClientRect();
      for (const other of document.querySelectorAll<HTMLElement>(".cat-card, .ek-cell")) {
        if (other === cell || other.contains(el)) continue;
        const r = other.getBoundingClientRect();
        if (r.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) {
          if (!other.inert) covered.add(other);
          other.inert = true;
        }
      }
    };
    place();
    const watch = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    watch?.observe(el);
    if (grid) watch?.observe(grid);
    addEventListener("resize", place);
    return () => {
      watch?.disconnect();
      removeEventListener("resize", place);
      release();
      delete home.dataset.bk;
    };
  }, [ref]);
}

export function BackFace({ items, decision, choice, title, kind, wants, self, askKey, onClose, onCompare }: {
  /** The need's options, best first. */
  items: Item[];
  decision?: GroupDecision;
  choice: Choice | null;
  title: string;
  kind: ReturnType<typeof cardKind>;
  /** What the traveller said they want ("Sakin semt"), for a stay. */
  wants: string[];
  /** The need's own searches ("Kendin ara"). */
  self: SearchLink[];
  /** The key of the card's "Aranıyor" state (the front's and the back's are one). */
  askKey: string;
  onClose: () => void;
  onCompare?: () => void;
}) {
  const env = useCardEnv();
  const ref = useRef<HTMLElement>(null);
  useOverlay(ref);
  const [out, setOut] = useState(false);
  // Closing is a short turn back (--t-quick); with reduced motion at once.
  const close = useCallback(() => {
    if (out) return;
    if (reducedMotion()) return onClose();
    setOut(true);
    setTimeout(onClose, CLOSE_MS);
  }, [out, onClose]);

  // The one the card shows as "Önerimiz" (no draft once anything is chosen): its tile says "Kartta", and it is the one in focus.
  const drafted = draftOf(items, decision)?.id;
  const split = splitBack(items, drafted);
  const shown = [...split.mine, ...split.ai];
  const [seen] = useState(() => loadSeen(env.tripId));
  const now = Date.now();
  // Seen once it has been on a back: "Yeni" shows again at most until it is closed.
  useEffect(() => () => markSeen(env.tripId, shown.map((i) => i.id)), []);

  // ← → go through the options (the one in focus ringed); Esc closes; Tab stays on the back; focus goes in, and back to the card on close.
  const [cur, setCur] = useState(() => Math.max(0, shown.findIndex((i) => onPlan(i) || i.id === drafted)));
  const [keys, setKeys] = useState(false);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), close());
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);
  const count = shown.length;
  const go = (to: number) => {
    setCur(to);
    setKeys(true);
    ref.current?.querySelectorAll<HTMLElement>(".ch-tile")[to]?.querySelector<HTMLElement>(".ch-put, .ch-name, a, button")?.focus();
  };
  useEffect(() => {
    if (count < 2) return;
    const onArrow = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      go((cur + (e.key === "ArrowLeft" ? -1 : 1) + count) % count);
    };
    document.addEventListener("keydown", onArrow);
    return () => document.removeEventListener("keydown", onArrow);
  }, [count, cur]);
  const trap = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab") return;
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
    if (!all.length) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  };

  const [why, setWhy] = useState<string | null>(null);
  const [searching, startSearch] = useSearching(askKey);
  const currency = env.decisions?.ctx.currency ?? "EUR";
  const art = ILLUS[kind] ?? illusOf(kind);
  const flight = kind === "flight";
  const date = topDate(items[0], kind);
  const goPano = () => (onClose(), env.onPano(groupKeyOf(items[0])));

  const option = (item: Item): ReactNode => {
    const index = shown.indexOf(item);
    const facts = cardFacts(item, decision, env.decisions?.ctx);
    const ranked = choice?.ranked.find((r) => r.option.item.id === item.id);
    const badge = ranked?.badges[0] ?? null;
    // Saved without dates: priced for these nights for now; its page again with the dates gets the real price.
    const { url: datedUrl } = datedLink(item, decision);
    const open = why === item.id;
    const score = decision?.options.find((o) => o.item.id === item.id)?.score ?? null;
    const on = onPlan(item);
    const ai = item.addedBy === "ai";
    const tagKind = tagOf(item, isFresh(item, seen, now), item.id === drafted);
    const tag =
      tagKind === "selected" ? { word: L("Seçili", "Selected") } : tagKind === "onCard" ? { word: L("Kartta", "On card"), tone: "draft" as const } : tagKind === "new" ? { word: L("Yeni", "New"), tone: "new" as const } : null;
    const cls = `ch-row ch-tile${on ? " on" : ""}${item.id === drafted ? " draft" : ""}${ai ? " ai" : ""}${count > 1 && index === cur ? " cur" : ""}`;
    const current = count > 1 && index === cur ? ("true" as const) : undefined;
    const rating = item.category === "stay" ? stayRatingOf(item) : null;
    const brand = brandOf(facts.source?.label, facts.source?.host);
    const time = item.flight?.departure?.slice(11, 16);
    const needs = facts.needs.length > 0 && (
      <span className="ch-needs">
        {facts.needs.map((n) => (
          <span key={n.key} className={`ch-need ${n.state}`} title={n.text}>
            {n.state === "yes" ? "✓" : n.state === "no" ? "✕" : "?"} {n.label}
          </span>
        ))}
      </span>
    );
    const status = facts.status && <span className={`ch-status ${facts.status.tone}`}>{facts.status.text}</span>;
    const links = (
      <span className="ch-links">
        {(ranked?.trade || facts.pros.length > 0 || facts.cons.length > 0) && (
          <button type="button" className="ch-why ch-pc" aria-expanded={open} onClick={() => setWhy(open ? null : item.id)}>
            {L("Neden?", "Why?")} {open ? "▴" : "▾"}
          </button>
        )}
        {datedUrl && (
          <a className="ch-why" href={datedUrl} target="_blank" rel="noreferrer">
            {L("Tarihlerle aç ↗", "Open with dates ↗")}
          </a>
        )}
        <button type="button" className="ch-why ch-all" onClick={() => (onClose(), env.onOpenItem(item))}>
          {L("Tüm detaylar", "All details")}
        </button>
      </span>
    );
    const detail = open && (
      <div className="ch-detail">
        {ranked && <TradeLine ranked={ranked} currency={currency} className="ch-trade" />}
        {facts.pros.length > 0 && (
          <ul className="ch-pros">
            {facts.pros.map((p) => (
              <li key={p.text}>
                <span>{p.text}{p.mine && <MineStar />}</span>
                {p.unique && <i>{L("yalnız bunda", "only this one")}</i>}
              </li>
            ))}
          </ul>
        )}
        {facts.cons.length > 0 && (
          <ul className="ch-cons">
            {facts.cons.map((c) => (
              <li key={c.text}>
                <span>{c.text}{c.mine && <MineStar />}</span>
                {c.unique && <i>{L("yalnız bunda", "only this one")}</i>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
    const pick = on ? (
      <span className="ch-on"><UiIcon name="check" size={13} />{L("Planda", "On the plan")}</span>
    ) : (
      <button type="button" className="ch-put" onClick={() => void chooseItem(item, items).then(close)} aria-label={`${L("Seç", "Choose")} · ${item.name}`} title={L("Seç ve plana koy", "Choose and add to the plan")}>
        {L("Seç", "Choose")}
      </button>
    );
    const name = item.url ? <a className="ch-name" href={item.url} target="_blank" rel="noreferrer" title={item.name}>{item.name}</a> : <span className="ch-name" title={item.name}>{item.name}</span>;
    // A flight option is the small flight card (FlightOption): its row, its price, "Seç"; what the tile also kept sits under it.
    if (item.category === "flight") {
      const going = tripPeople(env.decisions?.ctx);
      const fare = ticketStub({ look: "chosen", item, prices: ticketPrices(item, facts.price, going), fallback: facts.price ? { text: facts.price.text, label: facts.price.label ?? null } : null, people: going, today: env.today });
      return (
        <FlightOption
          key={item.id}
          className={cls}
          aria-current={current}
          onFocus={() => setCur(index)}
          flightNo={item.flight?.flightNumber}
          who={<SavedFace item={item} />}
          tag={tag}
          name={name}
          leg={flightLeg(item)}
          fare={fare}
          action={pick}
          extras={
            <div className="fo-x">
              {(badge || score != null) && (
                <span className="fo-m">
                  {badge && <span className="ch-badge">{badge}</span>}
                  {score != null && <span className="ch-sc" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>{Math.round(score)}<small>{L("uyum", "fit")}</small></span>}
                </span>
              )}
              {needs}
              {status}
              {links}
              {detail}
            </div>
          }
        />
      );
    }
    const drawing = art ? <img className="ch-ill" src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={44} className="ch-kind" />;
    return (
      <div key={item.id} className={cls} aria-current={current} onFocus={() => setCur(index)}>
        <div className="ch-ph">
          {facts.image ? <FallbackImg className="ch-img" src={facts.image} fallback={drawing} /> : drawing}
          <span className="ch-by"><SavedFace item={item} /></span>
          {tag && <span className={`ch-tag${tag.tone ? ` ${tag.tone}` : ""}`}>{tag.word}</span>}
          {badge && <span className="ch-badge">{badge}</span>}
          <span className="ch-sc" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>
            {score != null ? Math.round(score) : "–"}
            <small>{L("uyum", "fit")}</small>
          </span>
        </div>
        <div className="ch-main">
          <span className="ch-src">
            <BrandPill brand={brand} />
            {rating ? (
              <span className="ch-rate">
                <span className={`pk-rb${rating.star ? " star" : ""}`}>{rating.star ? "★ " : ""}{rating.value}</span>
                {rating.count && <small>{rating.count}</small>}
              </span>
            ) : null}
          </span>
          <b>
            {name}
            {time && /^\d\d:\d\d$/.test(time) ? <span className="ch-time"> · {time}</span> : null}
          </b>
          <span className="ch-sub">{[brand ? null : item.provider, item.city].filter(Boolean).join(" · ")}</span>
          {needs}
          {status}
          <div className="ch-tf">
            {facts.price && (
              <span className="ch-pr">
                <b>{facts.price.perNight ?? facts.price.each ?? facts.price.text}</b>
                <small>
                  {facts.price.perNight
                    ? L(`${facts.price.text} toplam`, `${facts.price.text} total`)
                    : facts.price.each
                      ? L(`kişi başı · ${facts.price.text} toplam`, `per person · ${facts.price.text} total`)
                      : (facts.price.label ?? "")}
                </small>
                {facts.price.provisional && <small className="ch-prov">{L("geçici", "provisional")}</small>}
              </span>
            )}
            {pick}
          </div>
          {links}
          {detail}
        </div>
      </div>
    );
  };

  const searchTile = self.length > 0 && (
    <div className="bk-act ext">
      <SearchRow links={self} />
      <small>{L("Sitede açılır, tarihler dolu. Kaydettiğin buraya düşer.", "Opens on the site, dates filled in. What you save lands here.")}</small>
    </div>
  );
  const askText = L(`${title} için daha fazla öneri bul`, `Find more options for ${title}`);
  const askTile = env.ask && (
    <div className={`bk-act ai${searching ? " busy" : ""}`}>
      <b>✨ {searching ? L("Arıyoruz…", "Searching…") : L("AI'a arat", "Ask AI to search")}</b>
      {searching ? (
        <span className="tk-bar" role="status" aria-label={L("Aranıyor", "Searching now")}><i /></span>
      ) : (
        <>
          <small>{L("Kaynaklarda yeni seçenek bulur, buraya ekler", "Looks for new options in the sources and adds them here")}</small>
          <AskButton text={askText} label={L("Ara", "Search")} onAsk={startSearch} />
        </>
      )}
    </div>
  );

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`ch-back${out ? " out" : ""}${keys ? " keys" : ""}`}
      role="group"
      aria-modal="true"
      aria-labelledby="ch-title"
      onKeyDown={trap}
      // Empty space on the back turns the card over again (plan v30); a tile, a button or a link keeps its own click.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a, input, textarea, label, .ch-tile, .bk-act, .bk-tt, .ch-for, .ch-verify, .ch-wants")) close();
      }}
      style={{ "--c": cardKindColor(kind) } as CSSProperties}>
      <header className="ch-head">
        <span className="bk-ic" aria-hidden>
          <KindIcon kind={kind} size={20} />
        </span>
        <div className="bk-tt">
          <h3 id="ch-title">{title}</h3>
          <p>{[date, L(`${items.length} seçenek`, `${items.length} option${items.length === 1 ? "" : "s"}`)].filter(Boolean).join(" · ")}</p>
        </div>
        {onCompare && (
          <button type="button" className="ch-cmp" onClick={() => (onClose(), onCompare())}>
            {L("Karşılaştır", "Compare")}
          </button>
        )}
        <button type="button" className="ch-pano" onClick={goPano} title={L("Bütün seçenekleri Pano'da büyük gör", "See every option large on the Board")}>
          <UiIcon name="board" size={15} />
          {split.more > 0 ? L(`Pano'da aç · +${split.more}`, `Open on the Board · +${split.more}`) : L("Pano'da aç", "Open on the Board")}
        </button>
        <button type="button" className="bk-x" aria-label={L("Kapat", "Close")} onClick={close}>
          <UiIcon name="x" size={14} />
        </button>
      </header>
      {wants.length > 0 && (
        <ul className="nd-wants ch-wants" aria-label={L("Aradığımız", "What we're looking for")}>
          {wants.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {choice?.headline && <p className="ch-for">{choice.headline}</p>}
      {choice && choice.verify.length > 0 && (
        <ul className="ch-verify" aria-label={L("Seçmeden kontrol et", "Check before choosing")}>
          {choice.verify.map((v) => (
            <li key={`${v.itemId}:${v.what}`}>
              <b>{L("Seçmeden kontrol et", "Check before choosing")} · {v.name}:</b> {v.what}
            </li>
          ))}
        </ul>
      )}
      <div className="bk-sec">
        <div className="bk-sh">
          <UiIcon name="board" size={15} />
          <b>{L("Kaydettikleriniz", "What you saved")}</b>
          <span className="n">{split.mineTotal}</span>
        </div>
        {split.mineTotal === 0 && <p className="bk-empty">{L("Henüz kayıt yok. Eklentiyle kaydettiğin buraya düşer.", "Nothing yet. What you save with the extension lands here.")}</p>}
        <div className={`bk-grid${flight ? " fl" : ""}`}>
          {split.mine.map(option)}
          {searchTile}
        </div>
      </div>
      <div className="bk-sec ai">
        <div className="bk-sh">
          <span aria-hidden>✨</span>
          <b>{L("Önerimiz", "Our picks")}</b>
          <span className="n">{split.aiTotal}</span>
        </div>
        {split.aiTotal === 0 && !searching && <p className="bk-empty">{L("Sana uyan başka seçenek bulamadık.", "No other fitting option found.")}</p>}
        <div className={`bk-grid${flight ? " fl" : ""}`}>
          {split.ai.map(option)}
          {askTile}
        </div>
      </div>
    </section>
  );
}
