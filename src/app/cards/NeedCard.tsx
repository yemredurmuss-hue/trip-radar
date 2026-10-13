// A need with options to choose from (v11 phase 2b, docs/mockups/2026-10-08-japonya-web-v11.html): the card stays
// the need itself, one size however many links come ("İstanbul → Porto", "3 seçenek · €118'den"), its foot the
// faces of who saved them and "3 seçenek ›". That opens the choice window: "Senin için" when the comparison has a
// pick, the options saved by the travellers first, the alternative a data source found apart (dashed, "Sizin
// linklerinizin dışında"), each with "+ Plana koy"; Karşılaştır (the full comparison) and Pano'da gör at its foot.
// Not for stays (their nights keep the comparison block) nor a need with one option (that card is the option).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { cardKind, cardKindColor, isTransportKind } from "../../lib/cardKinds";
import { topDate, transportFace } from "../../lib/cardView";
import type { Choice } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { lookWord } from "../../lib/stageWords";
import { adderOf, isAiOption, needTitleOf } from "../../lib/pano";
import { groupKeyOf, rangeOfGroupKey, stayRange } from "../../lib/plan";
import { estimatedRange, rangeLabel } from "../../lib/estRange";
import { nightsBetween } from "../../lib/items";
import { nNights } from "../../lib/i18nText";
import { sameName } from "../../lib/tripSettings";
import type { Item } from "../../lib/types";
import { addArrangedLike, chooseItem, setNeedNotNeeded } from "../actions";
import { useMyName } from "../Profile";
import { CardShell } from "./CardShell";
import { useCardEnv } from "./PlanCard";
import { useStageMenu } from "./stageMenu";
import { AskButton } from "./AskButton";
import { TransportCardBody } from "./TransportCard";
import { ILLUS, illusOf, StayDrawing, stayArtOf } from "./MediaCard";
import { useWhoMenu } from "./whoMenu";
import { FallbackImg } from "../FallbackImg";
import { brandOf } from "../../lib/brands";
import { BrandPill } from "./RideCard";
import { SearchRow } from "./EmptyCard";
import { headCount, needSearchLinks } from "../../lib/searchLinks";
import { peopleOf } from "../../lib/whose";
import { useWhoCtx } from "./WhoseBadge";
import { KindIcon, TransportArt, UiIcon } from "./Silhouettes";
import { SavedFace, usePhotoOf, WhoAvatar } from "./WhoseBadge";
import { datedLink, stayRatingOf, TradeLine } from "./parts";

function Faces({ items }: { items: Item[] }) {
  const myName = useMyName();
  const photoOf = usePhotoOf();
  const adders = [...new Set(items.map(adderOf).map((a) => a ?? "\u0000me"))].sort((a, b) => Number(a === "ai") - Number(b === "ai")).slice(0, 3);
  return (
    <span className="nd-faces" aria-hidden>
      {adders.map((a) =>
        a === "ai" ? (
          <span key={a} className="nd-ai">✨</span>
        ) : (
          <WhoAvatar key={a} name={a === "\u0000me" ? myName || L("Ben", "Me") : a} photo={photoOf(a === "\u0000me" ? myName : a)} />
        ),
      )}
    </span>
  );
}

/**
 * v11 "what we're looking for" on a need still to find: what the traveller said for the trip (the stay's "Sakin semt",
 * "Ücretsiz iptal"), three at most; none for other kinds (what's said is about the stay).
 */
function useWants(item: Item): string[] {
  const env = useCardEnv();
  if (item.category !== "stay") return [];
  return (env.decisions?.ctx.preferences ?? []).slice(0, 3);
}

/** The searches for this need, prefilled ("Kendin ara"), with the trip's people. */
function useSelfLinks(item: Item) {
  const env = useCardEnv();
  const who = useWhoCtx();
  return needSearchLinks(item, headCount(peopleOf(env.trip, who).length));
}

export function NeedCard({ items, decision, choice, open, onOpen, onClose, onCompare }: {
  /** The need's options, best first. */
  items: Item[];
  decision?: GroupDecision;
  choice: Choice | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCompare?: () => void;
}) {
  const env = useCardEnv();
  const first = items[0];
  const kind = cardKind(first, env.legModes.get(first.id) ?? null);
  const cheapest = items.filter((i) => i.price.amount != null && i.price.amount > 0).sort((a, b) => a.price.amount! - b.price.amount!)[0];
  const lowText = cheapest ? (cardFacts(cheapest, decision, env.decisions?.ctx).price?.text ?? null) : null;
  const title = needTitleOf(first);
  const n = items.length;
  const wants = useWants(first);
  const self = useSelfLinks(first);
  // One option only: its own ••• (Çıkar, Sil…), as its card had.
  const single = useStageMenu(first);
  const forWho = useWhoMenu(first);
  // v30: a stay, an eSIM, insurance still to choose is the empty card's shape (a drawing, the name large, "Arıyoruz", "N seçenek ⌄"),
  // with a range only from three or more real prices ("tahmini"), else the real "from €X".
  const shaped = kind === "stay" || kind === "esim" || kind === "insurance";
  const own = first.category === "stay" ? (rangeOfGroupKey(groupKeyOf(first)) ?? stayRange(first)) : null;
  const nights = own ? nightsBetween(own.start, own.end) : null;
  const est = shaped ? estimatedRange(items, nights) : null;
  const arranged = () => void addArrangedLike(first, title);
  const face = isTransportKind(kind) ? transportFace(first, kind as Parameters<typeof transportFace>[1], env.legEnds.get(first.id)) : null;
  const route = face && (face.from || face.to) ? { ...face, from: face.from && { ...face.from, time: null }, to: face.to && { ...face.to, time: null }, middle: null, logo: null } : null;
  // v30: "N seçenek ›" turns the card in place: its back is the options (the row's whole width).
  if (open) return <ChoiceSheet items={items} decision={decision} choice={choice} title={title} kind={kind} onClose={onClose} onCompare={onCompare} />;
  return (
    <>
      <CardShell
        kind={kind}
        ring="open"
        date={topDate(first, kind)}
        ariaLabel={title}
        itemId={first.id}
        extraClass="nd-card"
        onDelete={() => void setNeedNotNeeded(items).then(env.offer)}
        onArranged={arranged}
        deleteLabel={L("Gerek yok", "Not needed")}
        topAction={<span className="pk-lab open">{lookWord("search")}</span>}
        menu={[
          { label: L("Değiştir", "Change"), run: onOpen },
          { label: L("Ben hallettim", "I've got it"), run: arranged },
          ...(n === 1 ? [...forWho, ...single.menu].map((e, i) => ({ ...e, sep: i === 0 })) : []),
        ]}
        open={false}
        onToggle={onOpen}
        body={
          shaped ? (
            <div className={`nd-body nd-shaped${kind === "stay" ? " nd-stay" : " nd-pic"}`}>
              {kind === "stay" ? (
                <span className="ek-band" aria-hidden>
                  <StayDrawing art={stayArtOf(first)} />
                </span>
              ) : (
                <span className="ek-tile ek-ill" aria-hidden>
                  <img src={`illus/${ILLUS[kind]}.png`} alt="" />
                </span>
              )}
              <div className="ek-txt">
                <h3>{first.category === "stay" && first.city ? first.city : title}</h3>
                {kind === "stay" && (wants.length > 0 || nights) && <small>{[nights ? nNights(nights) : null, ...wants].filter(Boolean).join(" · ")}</small>}
                {!est && lowText && <p className="nd-sub">{L(`${lowText}'den başlıyor`, `from ${lowText}`)}</p>}
              </div>
              {self.length > 0 && <div className="nd-self"><SearchRow links={self} /></div>}
            </div>
          ) : (
          <div className={`nd-body${ILLUS[kind] ? " nd-has-art" : ""}${route ? " nd-route" : ""}`}>
            {ILLUS[kind] && <img className="nd-art" src={`illus/${ILLUS[kind]}.png`} alt="" />}
            {/* v11: a ticket still to find shows its ends (no hours yet); a stay its city (the nights are on the top line). */}
            {route ? <TransportCardBody face={route} title={title} art={kind !== "transport" ? <TransportArt mode={kind as Parameters<typeof TransportArt>[0]["mode"]} /> : null} /> : <h3>{first.category === "stay" && first.city ? first.city : title}</h3>}
            {lowText && <p className="nd-sub">{L(`${lowText}'den başlıyor`, `from ${lowText}`)}</p>}
            {wants.length > 0 && (
              <ul className="nd-wants" aria-label={L("Aradığımız", "What we're looking for")}>
                {wants.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            {self.length > 0 && <div className="nd-self"><SearchRow links={self} /></div>}
          </div>
          )
        }
        foot={
          <div className="pk-foot nd-foot">
            <button type="button" className={`nd-opts${shaped ? " nd-chip" : ""}`} onClick={(e) => (e.stopPropagation(), onOpen())} aria-haspopup="dialog">
              <Faces items={items} />
              {L(`${n} seçenek`, `${n} option${n === 1 ? "" : "s"}`)}
              <UiIcon name="right" size={13} />
            </button>
            <AskButton text={L(`${title} için öneri bul`, `Find options for ${title}`)} />
            {est && (
              <span className="nd-est" title={L(`Tahmini · kaynaklardaki ${est.n} gerçek teklife göre`, `Estimate · from ${est.n} real offers in the sources`)}>
                <b>{rangeLabel(est)}</b>
                {est.unit !== "total" && <small> / {est.unit === "night" ? L("gece", "night") : L("kişi", "person")}</small>}
                <i>{L("tahmini", "estimate")}</i>
              </span>
            )}
            {n === 1 && single.field}
          </div>
        }
        detail={null}
      />
    </>
  );
}

/**
 * The card's back (plan v30): the card turns in place and its options are a grid of small cards across the whole row,
 * each with its picture, where it's from (the site's label), what guests thought, its price and "Seç"; who saved it is
 * the face on its picture. Yours and the alternative a data source found sit in one grid (the ✨ face tells them apart).
 * What the window held stays: what's wanted, "Senin için", "Seçmeden kontrol et", "Neden?", Karşılaştır, Kendin ara.
 * "Pano'da aç" is at the top, and the grid's last tile.
 */
const BACK_MAX = 7;

export function ChoiceSheet({ items, decision, choice, title, kind, onClose, onCompare }: {
  items: Item[];
  decision?: GroupDecision;
  choice: Choice | null;
  title: string;
  kind: ReturnType<typeof cardKind>;
  onClose: () => void;
  onCompare?: () => void;
}) {
  const env = useCardEnv();
  const myName = useMyName();
  const photoOf = usePhotoOf();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const mine = items.filter((i) => !isAiOption(i));
  const found = items.filter(isAiOption);
  const ordered = [...mine, ...found];
  const shown = ordered.slice(0, BACK_MAX);
  // v30: ‹ › and the arrow keys go through the options (the grid keeps one in focus; it starts on the one on the plan).
  const [cur, setCur] = useState(() => Math.max(0, shown.findIndex((i) => i.status === "chosen" || i.status === "booked")));
  const count = shown.length;
  const step = (by: -1 | 1) => setCur((c) => (c + by + count) % count);
  useEffect(() => {
    if (count < 2) return;
    const onArrow = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    document.addEventListener("keydown", onArrow);
    return () => document.removeEventListener("keydown", onArrow);
  }, [count]);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (count > 1) (grid.current?.querySelectorAll(".ch-row.ch-tile")[cur] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cur]);
  const more = ordered.length - shown.length;
  const date = topDate(items[0], kind);
  const wants = useWants(items[0]);
  const self = useSelfLinks(items[0]);
  const [why, setWhy] = useState<string | null>(null);
  const currency = env.decisions?.ctx.currency ?? "EUR";
  const art = ILLUS[kind] ?? illusOf(kind);
  const goPano = () => (onClose(), env.onPano(groupKeyOf(items[0])));
  const tile = (item: Item, index: number): ReactNode => {
    const facts = cardFacts(item, decision, env.decisions?.ctx);
    const ranked = choice?.ranked.find((r) => r.option.item.id === item.id);
    const badge = ranked?.badges[0] ?? null;
    // Saved without dates: priced for these nights for now; its page again with the dates gets the real price.
    const { url: datedUrl } = datedLink(item, decision);
    const open = why === item.id;
    const score = decision?.options.find((o) => o.item.id === item.id)?.score ?? null;
    const on = item.status === "chosen" || item.status === "booked";
    const who = adderOf(item);
    const isMe = !who || (myName && sameName(who, myName));
    const time = item.flight?.departure?.slice(11, 16);
    const brand = brandOf(facts.source?.label, facts.source?.host);
    const rating = item.category === "stay" ? stayRatingOf(item) : null;
    const stops = item.category === "flight" && item.flight?.stops != null ? (item.flight.stops === 0 ? L("Direkt", "Direct") : L(`${item.flight.stops} aktarma`, `${item.flight.stops} stop${item.flight.stops === 1 ? "" : "s"}`)) : null;
    const drawing = art ? <img className="ch-ill" src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={44} className="ch-kind" />;
    return (
      <div key={item.id} className={`ch-row ch-tile${on ? " on" : ""}${who === "ai" ? " ai" : ""}${count > 1 && index === cur ? " cur" : ""}`} aria-current={count > 1 && index === cur ? "true" : undefined}>
        <div className="ch-ph">
          {facts.image ? <FallbackImg className="ch-img" src={facts.image} fallback={drawing} /> : item.category === "flight" && time && /^\d\d:\d\d$/.test(time) ? <span className="ch-fl">{time}{item.flight?.arrival?.slice(11, 16) ? ` → ${item.flight.arrival.slice(11, 16)}` : ""}</span> : drawing}
          <span className="ch-by"><SavedFace item={item} /></span>
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
            ) : stops ? (
              <small>{stops}</small>
            ) : null}
          </span>
          <b>
            {item.url ? (
              <a className="ch-name" href={item.url} target="_blank" rel="noreferrer" title={item.name}>
                {item.name}
              </a>
            ) : (
              <span className="ch-name" title={item.name}>{item.name}</span>
            )}
            {time && /^\d\d:\d\d$/.test(time) && item.category !== "flight" ? <span className="ch-time"> · {time}</span> : null}
          </b>
          <span className="ch-sub">{[brand ? null : item.provider, item.city].filter(Boolean).join(" · ")}</span>
          <span className="ch-who">
            {who === "ai" ? (
              <>✨ {L("AI önerisi", "AI pick")}</>
            ) : isMe ? (
              L("Sen kaydettin", "You saved it")
            ) : (
              L(`${who} kaydetti`, `${who} saved it`)
            )}
          </span>
          {facts.needs.length > 0 && (
            <span className="ch-needs">
              {facts.needs.map((n) => (
                <span key={n.key} className={`ch-need ${n.state}`} title={n.text}>
                  {n.state === "yes" ? "✓" : n.state === "no" ? "✕" : "?"} {n.label}
                </span>
              ))}
            </span>
          )}
          {facts.status && <span className={`ch-status ${facts.status.tone}`}>{facts.status.text}</span>}
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
            {on ? (
              <span className="ch-on">
                <UiIcon name="check" size={13} />
                {L("Planda", "On the plan")}
              </span>
            ) : (
              <button type="button" className="ch-put" onClick={() => void chooseItem(item, items).then(onClose)} aria-label={`${L("Seç", "Choose")} · ${item.name}`} title={L("Seç ve plana koy", "Choose and add to the plan")}>
                {L("Seç", "Choose")}
              </button>
            )}
          </div>
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
          {open && (
            <div className="ch-detail">
              {ranked && <TradeLine ranked={ranked} currency={currency} className="ch-trade" />}
              {facts.pros.length > 0 && (
                <ul className="ch-pros">
                  {facts.pros.map((p) => (
                    <li key={p.text}>
                      <span>{p.text}</span>
                      {p.unique && <i>{L("yalnız bunda", "only this one")}</i>}
                    </li>
                  ))}
                </ul>
              )}
              {facts.cons.length > 0 && (
                <ul className="ch-cons">
                  {facts.cons.map((c) => (
                    <li key={c.text}>
                      <span>{c.text}</span>
                      {c.unique && <i>{L("yalnız bunda", "only this one")}</i>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  return (
    <section
      className="ch-back"
      role="group"
      aria-labelledby="ch-title"
      // Empty space on the back turns the card over again (plan v30); a tile, a button or a link keeps its own click.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a, input, textarea, label, .ch-tile, .bk-tt, .ch-for, .ch-verify, .ch-wants")) onClose();
      }}
      style={{ "--c": cardKindColor(kind) } as React.CSSProperties}>
      <header className="ch-head">
        <span className="bk-ic" aria-hidden>
          <KindIcon kind={kind} size={20} />
        </span>
        <div className="bk-tt">
          <h3 id="ch-title">{title}</h3>
          <p>{[date, L(`${items.length} seçenek`, `${items.length} option${items.length === 1 ? "" : "s"}`)].filter(Boolean).join(" · ")}</p>
        </div>
        {count > 1 && (
          <span className="ch-nav" role="group" aria-label={L("Seçenekler arasında gez", "Go through the options")}>
            <button type="button" aria-label={L("Önceki seçenek", "Previous option")} onClick={() => step(-1)}>
              <UiIcon name="left" size={13} />
            </button>
            <span aria-live="polite">{cur + 1}/{count}</span>
            <button type="button" aria-label={L("Sonraki seçenek", "Next option")} onClick={() => step(1)}>
              <UiIcon name="right" size={13} />
            </button>
          </span>
        )}
        <button type="button" className="ch-pano" onClick={goPano} title={L("Bütün seçenekleri Pano'da büyük gör", "See every option large on the Board")}>
          <UiIcon name="board" size={15} />
          {L("Pano'da aç", "Open on the Board")}
        </button>
        <button type="button" className="bk-x" aria-label={L("Kapat", "Close")} onClick={onClose} autoFocus>
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
      <div className="ch-grid" ref={grid}>
        {shown.map(tile)}
        <button type="button" className="ch-tile ch-panotile" onClick={goPano}>
          <UiIcon name="board" size={24} />
          <b>{more > 0 ? L(`+${more} daha`, `+${more} more`) : L("Pano", "Board")}</b>
          <span>{L("Pano'da büyük aç", "Open large on the Board")}</span>
        </button>
      </div>
      <footer className="bk-foot ch-foot">
        {env.ask && (
          <button type="button" className="bk-btn ch-more" onClick={() => (onClose(), env.ask!(L(`${title} için daha fazla öneri bul`, `Find more options for ${title}`)))}>
            ✨ {L("Daha fazla bul", "Find more")}
          </button>
        )}
        {onCompare && (
          <button type="button" className="bk-btn" onClick={() => (onClose(), onCompare())}>
            {L("Karşılaştır", "Compare")}
          </button>
        )}
        <span className="bk-sp" />
        {self.length > 0 && (
          <span className="ch-self">
            <SearchRow links={self} />
          </span>
        )}
      </footer>
    </section>
  );
}

/** A need's card with its own window (a stay's options, v11): the heading above it as the group's, the state kept here. */
export function NeedGroup({ items, heading, nested, decision, choice, onCompare }: {
  items: Item[];
  heading: ReactNode;
  nested: boolean;
  decision?: GroupDecision;
  choice: Choice | null;
  onCompare?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={nested ? "group nested" : "section"} data-option-ids={items.map((i) => i.id).join(" ")}>
      {heading && <div className={nested ? "group-head" : "section-head"}>{heading}</div>}
      <NeedCard items={items} decision={decision} choice={choice} open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} onCompare={onCompare} />
    </div>
  );
}
