// The options of a way of travel in the frame (plan v82 bilet ailesi, v79 "uçuş/tren satırı Skyscanner'a yaklaştı"): Karar
// bekliyor on a flight, a train, a bus, and Değiştir turning the chosen ticket back to them. "Seçenekler · 4 · ilk 3, tümü
// Pano'da" and "Kendin ara" on top, then one card per option, as tall as one another: the carrier's mark and name with its
// number or class, the hours with the ends under them and the length and stops between, the ribbons (Önerimiz, En hızlı,
// En ucuz), the price with the bag, who put it there (✨, a person's initial, the link) and "Seç". While changing, the one
// chosen is marked ("Seçili") and "Vazgeç" turns the ticket back. Fewer than three: the rest of the frame asks for more.
import type { ReactNode } from "react";
import { airlineLogos } from "../../../lib/airlines";
import { L } from "../../../lib/i18n";
import { optionsHead, SHOWN_OPTIONS, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { pickAria, pickWord } from "../../../lib/replaceBooking";
import { rowFace, rowWho, type CarrierMark } from "../../../lib/ticketFrame";
import { Editable, InlineEdit, useInlineEdit } from "../../cards/InlineEdit";
import { FallbackImg } from "../../FallbackImg";
import { Ic, Mark } from "./icons";
import { SelfLinks } from "./OptionCompact";

/**
 * A carrier's mark: an airline known by its code its logo (the flight card's files, airlines.ts), its letters on its colour
 * when the logo won't load; else the kind's drawing in the same square (a way with no operator known). Small: the round mark
 * in "Bileti al" (0.38.8, Emre: "o yuvarlak şeyin logo olması lazım").
 */
export function CarrierLogo({ mark, art, small = false }: { mark: CarrierMark | null; art: string; small?: boolean }) {
  if (mark?.code) {
    const [first, second] = airlineLogos(mark.code);
    const letters = <Mark color={mark.color} letter={mark.letter} small={small} />;
    const cls = small ? "q-logo sm q-air" : "q-logo q-air";
    return <FallbackImg className={cls} src={first} fallback={<FallbackImg className={cls} src={second} fallback={letters} />} />;
  }
  if (mark) return <Mark color={mark.color} letter={mark.letter} small={small} />;
  return (
    <span className="z-lgi" aria-hidden>
      <img src={art} alt="" />
    </span>
  );
}

/** The bag's small line icon (the prototype's `bag`). */
export function BagIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="i" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8h12v12H6zM9 8V5h6v3M10 12v4M14 12v4" />
    </svg>
  );
}

type RowProps = { o: OptionVM; vm: IntentVM; art: string; current: boolean; replacing: boolean; onPick: () => void; onOpen: () => void };

function OptionRow(props: RowProps) {
  return (
    <InlineEdit item={props.o.item} only={["name", "price"]}>
      <RowFace {...props} />
    </InlineEdit>
  );
}

function RowFace({ o, vm, art, current, replacing, onPick, onOpen }: RowProps) {
  const f = rowFace(o, vm.kind);
  const who = rowWho(o.source);
  const edit = useInlineEdit();
  return (
    <div className={`q-row q-opt z-r${current ? " is-cur" : ""}`} data-item-id={o.id} aria-label={o.title} data-new={L("Yeni", "New")}>
      <span className="q-air">
        <CarrierLogo mark={f.mark} art={art} />
        <span className="q-an">
          <b title={o.title}>
            {edit?.open === "name" ? (
              <Editable field="name" />
            ) : (
              // B14: its name opens its record's details (Tüm detaylar).
              <button type="button" className="z-tb" onClick={onOpen} aria-label={L(`${o.title}: tüm detaylar`, `${o.title}: all details`)}>
                {f.name}
              </button>
            )}
          </b>
          {f.sub && <small>{f.sub}</small>}
        </span>
      </span>
      <span className="q-leg">
        <span className="q-tm">
          <b>{f.dep ?? "–"}</b>
          {f.from && <small title={f.from}>{f.from}</small>}
        </span>
        <span className="q-mid">
          <small>{f.duration ?? " "}</small>
          <i />
          {f.stops ? <small className={f.stops.tone}>{f.stops.text}</small> : <small>{" "}</small>}
        </span>
        <span className="q-tm r">
          <b>
            {f.arr ?? "–"}
            {f.plus ? <sup>+{f.plus}</sup> : null}
          </b>
          {f.to && <small title={f.to}>{f.to}</small>}
        </span>
      </span>
      <span className="z-tags">
        {f.ribs.length > 0 && (
          <span className="q-ribs">
            {f.ribs.map((r) => (
              <span key={r.text} className={`q-rb1 ${r.tone}`}>
                {r.text}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="q-buy">
        <Editable field="price">
          {f.price && (
            <span className="q-pr" title={f.price.title ?? undefined}>
              <b>{f.price.text}</b>
            </span>
          )}
        </Editable>
        {f.bag && (
          <span className="q-bg">
            <BagIcon />
            {f.bag}
          </span>
        )}
      </span>
      <span className="q-sel">
        {who && (
          <span className={`q-who ${who.tone}`} title={who.title} aria-label={who.title} role="img">
            {who.tone === "link" ? <Ic name="link" size={12} stroke={2.2} /> : who.text}
          </span>
        )}
        <button type="button" className="q-pick" aria-pressed={current || undefined} aria-label={current ? L(`${o.title}: seçili`, `${o.title}: chosen`) : pickAria(o.title, replacing)}
          onClick={current ? undefined : onPick}>
          {current ? L("Seçili", "Chosen") : pickWord(replacing)}
        </button>
      </span>
    </div>
  );
}

export function OptionRows({ vm, options, current, changing, replacing = false, art, links, onPick, onOpen, onCancel, onAsk }: {
  vm: IntentVM;
  options: OptionVM[];
  /** The one chosen, marked while changing. */
  current: string | null;
  changing: boolean;
  /** A booking holds the need: "Seç" is "Bununla değiştir" (replaceBooking.ts). */
  replacing?: boolean;
  /** The kind's drawing for a carrier with no mark. */
  art: string;
  links: SelfSearch[];
  onPick: (o: OptionVM) => void;
  /** An option's record (its drawer). */
  onOpen: (o: OptionVM) => void;
  onCancel: () => void;
  onAsk: (() => void) | null;
}): ReactNode {
  const head = optionsHead(vm, changing);
  const left = SHOWN_OPTIONS - options.length;
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
      <div className="q-rows z-rows">
        {options.map((o) => (
          <OptionRow key={o.id} o={o} vm={vm} art={art} current={o.id === current} replacing={replacing} onPick={() => onPick(o)} onOpen={() => onOpen(o)} />
        ))}
        {left > 0 && (
          <div className="z-r0" style={{ "--span": left } as React.CSSProperties}>
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
