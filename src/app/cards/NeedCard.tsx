// A need with options to choose from (v11 phase 2b, docs/mockups/2026-10-08-japonya-web-v11.html): the card stays
// the need itself, one size however many links come ("İstanbul → Porto", "3 seçenek · €118'den"), its foot the
// faces of who saved them and "3 seçenek ›". That turns the card in place (BackFace): "Kaydettikleriniz" and "Önerimiz",
// three small cards at most each, "Seç" on each, "Kendin ara" and "AI'a arat" at the end of the two.
// Not for stays (their nights keep the comparison block) nor a need with one option (that card is the option).
import { useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { flightWants, ticketStub } from "../../lib/cardTicket";
import { cardKind, isTransportKind } from "../../lib/cardKinds";
import { topDate, transportFace } from "../../lib/cardView";
import type { Choice } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { lookWord } from "../../lib/stageWords";
import { adderOf, needTitleOf } from "../../lib/pano";
import { groupKeyOf, rangeOfGroupKey, stayRange } from "../../lib/plan";
import { estimatedRange, rangeLabel } from "../../lib/estRange";
import { nightsBetween } from "../../lib/items";
import { nNights } from "../../lib/i18nText";
import type { Item } from "../../lib/types";
import { addArrangedLike, setNeedNotNeeded } from "../actions";
import { useMyName } from "../Profile";
import { CardShell } from "./CardShell";
import { FlightTicket } from "./FlightTicket";
import { useSearching } from "./searching";
import { useCardEnv } from "./PlanCard";
import { useStageMenu } from "./stageMenu";
import { AskButton } from "./AskButton";
import { TransportCardBody } from "./TransportCard";
import { ILLUS, StayDrawing, stayArtOf } from "./MediaCard";
import { useWhoMenu } from "./whoMenu";
import { BackFace, BackHost } from "./BackFace";
import { SearchRow } from "./EmptyCard";
import { headCount, needSearchLinks } from "../../lib/searchLinks";
import { peopleOf } from "../../lib/whose";
import { useWhoCtx } from "./WhoseBadge";
import { TransportArt, UiIcon } from "./Silhouettes";
import { usePhotoOf, WhoAvatar } from "./WhoseBadge";

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
  const askKey = `${first.needKey}:${n}`;
  const [searching, startSearch] = useSearching(askKey);
  const face = isTransportKind(kind) ? transportFace(first, kind as Parameters<typeof transportFace>[1], env.legEnds.get(first.id)) : null;
  const route = face && (face.from || face.to) ? { ...face, from: face.from && { ...face.from, time: null }, to: face.to && { ...face.to, time: null }, middle: null, logo: null } : null;
  const optionsFoot = (
    <div className="pk-foot nd-foot">
      <button type="button" className={`nd-opts${shaped ? " nd-chip" : ""}`} onClick={(e) => (e.stopPropagation(), onOpen())} aria-haspopup="dialog">
        <Faces items={items} />
        {L(`${n} seçenek`, `${n} option${n === 1 ? "" : "s"}`)}
        <UiIcon name="right" size={13} />
      </button>
      {kind === "flight" && searching ? <span className="tk-bar" role="status" aria-label={L("Aranıyor", "Searching now")}><i /></span> : <AskButton text={L(`${title} için öneri bul`, `Find options for ${title}`)} onAsk={kind === "flight" ? startSearch : undefined} />}
      {est && (
        <span className="nd-est" title={L(`Tahmini · kaynaklardaki ${est.n} gerçek teklife göre`, `Estimate · from ${est.n} real offers in the sources`)}>
          <b>{rangeLabel(est)}</b>
          {est.unit !== "total" && <small> / {est.unit === "night" ? L("gece", "night") : L("kişi", "person")}</small>}
          <i>{L("tahmini", "estimate")}</i>
        </span>
      )}
      {n === 1 && single.field}
    </div>
  );
  const menu = [
    { label: L("Değiştir", "Change"), run: onOpen },
    { label: L("Ben hallettim", "I've got it"), run: arranged },
    ...(n === 1 ? [...forWho, ...single.menu].map((e, i) => ({ ...e, sep: i === 0 })) : []),
  ];
  // F2: a flight still to choose is the empty ticket: "Arıyoruz" (or "Aranıyor" while the AI looks), what we look for, an estimate only from three real prices.
  const flightEst = kind === "flight" ? estimatedRange(items) : null;
  const front = kind === "flight" ? (
      <FlightTicket
        look={searching ? "searching" : "search"}
        stub={ticketStub({ look: searching ? "searching" : "search", prices: null, estimate: flightEst, from: lowText, today: env.today })}
        airline={null}
        number={null}
        date={topDate(first, kind)}
        face={route ?? { from: null, to: null, middle: null, rental: false }}
        stops={null}
        wants={flightWants(env.trip, env.decisions?.ctx.preferences)[0] ?? null}
        shell={{
          ariaLabel: title,
          itemId: first.id,
          extraClass: "nd-card",
          onDelete: () => void setNeedNotNeeded(items).then(env.offer),
          onArranged: arranged,
          deleteLabel: L("Gerek yok", "Not needed"),
          menu,
          open: false,
          onToggle: onOpen,
          detail: null,
        }}
        foot={
          <>
            {self.length > 0 && <div className="nd-self"><SearchRow links={self} /></div>}
            {optionsFoot}
          </>
        }
      />
  ) : (
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
        menu={menu}
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
        foot={optionsFoot}
        detail={null}
      />
  );
  // v30: "N seçenek ›" turns the card in place: its back is the options (BackFace, over the row, the front kept under it).
  return <BackHost open={open} front={front} back={<NeedBack items={items} decision={decision} choice={choice} title={title} kind={kind} askKey={askKey} onClose={onClose} onCompare={onCompare} />} />;
}

/** The need's back (BackFace) with what a need adds to it: what is wanted and its own searches. */
export function NeedBack({ items, decision, choice, title, kind, askKey, onClose, onCompare }: {
  items: Item[];
  decision?: GroupDecision;
  choice: Choice | null;
  title: string;
  kind: ReturnType<typeof cardKind>;
  askKey: string;
  onClose: () => void;
  onCompare?: () => void;
}) {
  const wants = useWants(items[0]);
  const self = useSelfLinks(items[0]);
  return <BackFace items={items} decision={decision} choice={choice} title={title} kind={kind} wants={wants} self={self} askKey={askKey} onClose={onClose} onCompare={onCompare} />;
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
