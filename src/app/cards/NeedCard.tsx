// A need with options to choose from (v11 phase 2b, docs/mockups/2026-10-08-japonya-web-v11.html): the card stays
// the need itself, one size however many links come ("İstanbul → Porto", "3 seçenek · €118'den"), its foot the
// faces of who saved them and "3 seçenek ›". That opens the choice window: "Senin için" when the comparison has a
// pick, the options saved by the travellers first, the alternative a data source found apart (dashed, "Sizin
// linklerinizin dışında"), each with "+ Plana koy"; Karşılaştır (the full comparison) and Pano'da gör at its foot.
// Not for stays (their nights keep the comparison block) nor a need with one option (that card is the option).
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cardFacts } from "../../lib/cardFacts";
import { cardKind, cardKindColor, isTransportKind } from "../../lib/cardKinds";
import { topDate } from "../../lib/cardView";
import type { Choice } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { isAiOption, needTitleOf } from "../../lib/pano";
import { groupKeyOf } from "../../lib/plan";
import { sameName } from "../../lib/tripSettings";
import type { Item } from "../../lib/types";
import { chooseItem, setNeedNotNeeded } from "../actions";
import { useMyName } from "../Profile";
import { CardShell } from "./CardShell";
import { useCardEnv } from "./PlanCard";
import { AskButton } from "./AskButton";
import { ILLUS } from "./MediaCard";
import { SearchRow } from "./EmptyCard";
import { headCount, needSearchLinks } from "../../lib/searchLinks";
import { peopleOf } from "../../lib/whose";
import { useWhoCtx } from "./WhoseBadge";
import { KindIcon, TransportArt, UiIcon } from "./Silhouettes";
import { usePhotoOf, WhoAvatar } from "./WhoseBadge";
import { datedLink, TradeLine } from "./parts";

/** Who saved each option: "ai", a fellow traveller's name, or the board's owner (null). */
const adderOf = (item: Item): string | null => (isAiOption(item) ? "ai" : (item.addedBy ?? null));

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
  return (
    <>
      <CardShell
        kind={kind}
        ring="open"
        date={topDate(first, kind)}
        ariaLabel={title}
        itemId={first.id}
        extraClass="nd-card"
        art={isTransportKind(kind) && kind !== "transport" ? <TransportArt mode={kind} /> : null}
        onDelete={() => void setNeedNotNeeded(items).then(env.offer)}
        deleteLabel={L("Gerek yok", "Not needed")}
        topAction={<span className="pk-lab open">{L("Arıyoruz", "Searching")}</span>}
        menu={[]}
        open={false}
        onToggle={onOpen}
        body={
          <div className={`nd-body${ILLUS[kind] ? " nd-has-art" : ""}`}>
            {ILLUS[kind] && <img className="nd-art" src={`illus/${ILLUS[kind]}.png`} alt="" />}
            <h3>{title}</h3>
            {lowText && <p className="nd-sub">{L(`${lowText}'den başlıyor`, `from ${lowText}`)}</p>}
            {wants.length > 0 && (
              <ul className="nd-wants" aria-label={L("Aradığımız", "What we're looking for")}>
                {wants.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            {self.length > 0 && <div className="nd-self"><SearchRow links={self} /></div>}
          </div>
        }
        foot={
          <div className="pk-foot nd-foot">
            <button type="button" className="nd-opts" onClick={(e) => (e.stopPropagation(), onOpen())} aria-haspopup="dialog">
              <Faces items={items} />
              {L(`${n} seçenek`, `${n} options`)}
              <UiIcon name="right" size={13} />
            </button>
            <span className="pk-state wait">{L("Karar bekliyor", "To decide")}</span>
            <AskButton text={L(`${title} için öneri bul`, `Find options for ${title}`)} />
          </div>
        }
        detail={null}
      />
      {open && <ChoiceSheet items={items} decision={decision} choice={choice} title={title} kind={kind} onClose={onClose} onCompare={onCompare} />}
    </>
  );
}

/** The choice window: yours first, the found alternative apart, "+ Plana koy" on each. */
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
  const date = topDate(items[0], kind);
  const wants = useWants(items[0]);
  const self = useSelfLinks(items[0]);
  const [why, setWhy] = useState<string | null>(null);
  const currency = env.decisions?.ctx.currency ?? "EUR";
  const row = (item: Item): ReactNode => {
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
    return (
      <div key={item.id} className={`ch-row${on ? " on" : ""}`}>
        <span className="ch-sc" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>
          {score != null ? Math.round(score) : "–"}
          <small>{L("uyum", "fit")}</small>
        </span>
        <div className="ch-main">
          <b>
            {item.url ? (
              <a className="ch-name" href={item.url} target="_blank" rel="noreferrer" title={L("Sayfasını aç", "Open its page")}>
                {item.name}
              </a>
            ) : (
              <span className="ch-name">{item.name}</span>
            )}
            {time && /^\d\d:\d\d$/.test(time) ? <span className="ch-time"> · {time}</span> : null}
            {badge && <span className="ch-badge">{badge}</span>}
          </b>
          <span className="ch-sub">{[item.provider, item.city, item.rating.value != null ? String(item.rating.value).replace(".", ",") : null].filter(Boolean).join(" · ")}</span>
          <span className="ch-who">
            {who === "ai" ? (
              <>✨ {L("AI önerisi", "AI pick")}</>
            ) : (
              <>
                <WhoAvatar name={isMe ? myName || L("Ben", "Me") : who!} photo={photoOf(isMe ? myName : who!)} />
                {isMe ? L("Sen kaydettin", "You saved it") : L(`${who} kaydetti`, `${who} saved it`)}
              </>
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
          <span className="ch-links">
            {(ranked?.trade || facts.pros.length > 0 || facts.cons.length > 0) && (
              <button type="button" className="ch-why ch-pc" aria-expanded={open} onClick={() => setWhy(open ? null : item.id)}>
                {L("Neden? Artılar ve eksiler", "Why? Pros and cons")} {open ? "▴" : "▾"}
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
        <div className="ch-end">
          {facts.price && (
            <span className="ch-pr">
              <b>{facts.price.text}</b>
              {facts.price.label && <small>{facts.price.label}</small>}
              {facts.price.provisional && <small className="ch-prov">{L("geçici", "provisional")}</small>}
            </span>
          )}
          {on ? (
            <span className="ch-on">
              <UiIcon name="check" size={13} />
              {L("Planda", "On the plan")}
            </span>
          ) : (
            <button type="button" className="ch-put" onClick={() => void chooseItem(item, items).then(onClose)}>
              + {L("Plana koy", "Add to plan")}
            </button>
          )}
        </div>
      </div>
    );
  };
  return createPortal(
    <div className="modal" onClick={(e) => (e.stopPropagation(), onClose())}>
      <div className="bk-sheet ch-sheet" role="dialog" aria-modal="true" aria-labelledby="ch-title" style={{ "--c": cardKindColor(kind) } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <header className="bk-head">
          <span className="bk-ic" aria-hidden>
            <KindIcon kind={kind} size={20} />
          </span>
          <div className="bk-tt">
            <h3 id="ch-title">{title}</h3>
            <p>{[date, L(`${items.length} seçenek`, `${items.length} options`)].filter(Boolean).join(" · ")}</p>
          </div>
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
        {mine.length > 0 && (
          <section className="bk-sec">
            <h4>{L(`Kaydettikleriniz · ${mine.length}`, `Your saves · ${mine.length}`)}</h4>
            <div className="ch-list">{mine.map(row)}</div>
          </section>
        )}
        {found.length > 0 && (
          <section className="bk-sec ch-ai">
            <h4>✨ {found.length === 1 ? L("AI'nın bulduğu alternatif", "An alternative the AI found") : L(`AI'nın bulduğu ${found.length} alternatif`, `${found.length} alternatives the AI found`)}</h4>
            <p className="bk-note">{mine.length ? L("Sizin linklerinizin dışında, tercihlerinize göre.", "Beyond your links, by your preferences.") : L("Henüz link yok; tercihlerinize göre aradı.", "No links yet; found by your preferences.")}</p>
            <div className="ch-list">{found.map(row)}</div>
          </section>
        )}
        {self.length > 0 && (
          <section className="bk-sec ch-self">
            <h4>{L("Kendin ara", "Search yourself")}</h4>
            <SearchRow links={self} />
          </section>
        )}
        <footer className="bk-foot">
          {env.ask && (
            <button type="button" className="bk-btn ch-more" onClick={() => (onClose(), env.ask!(L(`${title} için daha fazla öneri bul`, `Find more options for ${title}`)))}>
              ✨ {L("Daha fazla öneri bul", "Find more options")}
            </button>
          )}
          {onCompare && (
            <button type="button" className="bk-btn" onClick={() => (onClose(), onCompare())}>
              {L("Karşılaştır", "Compare")}
            </button>
          )}
          <button type="button" className="bk-btn" onClick={() => (onClose(), env.onPano(groupKeyOf(items[0])))}>
            {L("Pano'da gör", "See on the Board")}
          </button>
          <span className="bk-sp" />
          <button type="button" className="bk-btn dark" onClick={onClose}>
            {L("Kapat", "Close")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
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
