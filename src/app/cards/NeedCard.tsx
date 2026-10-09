// A need with options to choose from (v11 phase 2b, docs/mockups/2026-10-08-japonya-web-v11.html): the card stays
// the need itself, one size however many links come ("İstanbul → Porto", "3 seçenek · €118'den"), its foot the
// faces of who saved them and "3 seçenek ›". That opens the choice window: "Senin için" when the comparison has a
// pick, the options saved by the travellers first, the alternative a data source found apart (dashed, "Sizin
// linklerinizin dışında"), each with "+ Plana koy"; Karşılaştır (the full comparison) and Pano'da gör at its foot.
// Not for stays (their nights keep the comparison block) nor a need with one option (that card is the option).
import { useEffect, type ReactNode } from "react";
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
import { KindIcon, TransportArt, UiIcon } from "./Silhouettes";
import { usePhotoOf, WhoAvatar } from "./WhoseBadge";

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
        menu={[]}
        open={false}
        onToggle={onOpen}
        body={
          <div className="nd-body">
            <h3>{title}</h3>
            {lowText && <p className="nd-sub">{L(`${lowText}'den başlıyor`, `from ${lowText}`)}</p>}
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
  const row = (item: Item): ReactNode => {
    const facts = cardFacts(item, decision, env.decisions?.ctx);
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
            {item.name}
            {time && /^\d\d:\d\d$/.test(time) ? <span className="ch-time"> · {time}</span> : null}
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
        </div>
        <div className="ch-end">
          {facts.price && (
            <span className="ch-pr">
              <b>{facts.price.text}</b>
              {facts.price.label && <small>{facts.price.label}</small>}
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
        {choice?.headline && <p className="ch-for">{choice.headline}</p>}
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
        <footer className="bk-foot">
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
