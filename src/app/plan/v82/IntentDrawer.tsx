// The options beside the plan (plan v13 K82–K84, its standard card: onay paketi 2026-10-21, docs/mockups/paket-ucus-konaklama
// 4, 5, 9, 16): a need's every option in a drawer from the right, never inside its card. Its head is three lines: the deck
// and who and when ("Chiang Mai · 3 gece", "27–30 Mar · Cmt → Sal · 2 kişi"), the criteria (lila what must be, grey what
// is wished, "+ ekle"), Seçenekler/Elenen and the order; a stay's and a rental's sort shows its weights as one bar. A stay
// or a rental is a card with its photo first, its score and place on it, the score's three parts under its name, the price
// beside a big Seç ("✓ Seçili" on the one chosen), five labelled slots in a fixed order and what its reviews praise and
// fault, always open. A flight, a boat, a train is the boarding pass: the hours big, the price and Seç, five slots, "Neden
// 91?"; flights over several days sit under each day's band (istenen gün, a day later). At its end the source's picks
// (OfferRow), the "Yeni bul" box (a link dropped here lands in the deck; the sites to look on; the AI) and the Pano.
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { setItemStatus } from "../../actions";
import { choiceOf } from "../../../lib/choice";
import type { GroupDecision, Part } from "../../../lib/decision";
import { dayBand, flightSlots, guestGap, guestGapText, priceAge, waySlots, groupLabel, partsWhy, placeText, prosCons, rentalSlots, reviewsHead, scoreParts, staySlots, weightShares, type CardSlot, type SlotIcon } from "../../../lib/drawerCard";
import { drawerList, optionDay, optionTab, pickReason, type DrawerTab, type SortKey } from "../../../lib/drawerView";
import { fromName, L } from "../../../lib/i18n";
import { headName, optionPrice, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { formatPrice } from "../../../lib/items";
import { railDate } from "../../../lib/railDates";
import { isRental, rowView } from "../../../lib/rowView";
import { rowFace } from "../../../lib/ticketFrame";
import type { Need } from "../../../lib/offerSource";
import type { Item } from "../../../lib/types";
import { likersOf, withLoves } from "../../../lib/pano";
import { OfferRow } from "../../cards/OfferRow";
import { useMyName } from "../../Profile";
import { useShare } from "../../Share";
import { useCardEnv } from "../../cards/PlanCard";
import { decisionOf } from "./DetailLayer";
import { GalleryThumbs } from "./Gallery";
import { WeightTuner } from "./WeightTuner";
import { Ic, Mark, type IconName } from "./icons";
import type { Typical } from "./OptionCompact";
import { CarrierLogo } from "./OptionRow";
import { broughtOf, type Brought } from "./IntentRow";
import { carriesArrival } from "../../arrive/useDropZone";
import { ModeIcon } from "./modeIcons";

export type Family = "stay" | "rental" | "ticket";

const SORTS: Readonly<Record<Family, [SortKey, string][]>> = {
  stay: [["fit", L("Ağırlıklı puan", "Weighted score")], ["price", L("En ucuz", "Cheapest")], ["score", L("En yüksek puan", "Top rated")], ["dist", L("Merkeze en yakın", "Closest to the centre")]],
  rental: [["fit", L("Ağırlıklı puan", "Weighted score")], ["price", L("En ucuz", "Cheapest")], ["score", L("En yüksek puan", "Top rated")]],
  ticket: [["fit", L("Önerimiz", "Our pick")], ["price", L("En ucuz", "Cheapest")], ["mins", L("En kısa", "Shortest")]],
};

const OpenRecord = createContext<((o: OptionVM) => void) | null>(null);
const useOpenRecord = () => useContext(OpenRecord);

const SLOT_ICON: Readonly<Record<SlotIcon, IconName>> = { food: "food", undo: "undo", pin: "pin", star: "star", link: "link", bag: "bag", cabin: "cabin", gate: "gate", shield: "shield", key: "key", clock: "clock" };

/** "91 · 1. sırada" on the photo or the pass: lila for the first, amber for a neighbouring day. */
function Rank({ o, off, solo = false }: { o: OptionVM; off?: boolean; solo?: boolean }) {
  if (o.score == null || solo) return null;
  return (
    <span className={`dr-rank${o.place === 1 && !off ? " top" : ""}${off ? " off" : ""}`} title={L("İsteklerine göre ağırlıklı puan", "Weighted score by what you asked")}>
      <b>{o.score}</b>
      <span>{off ? L("komşu gün", "next day") : placeText(o.place)}</span>
    </span>
  );
}

function Pick({ o, current, onPick, big = false }: { o: OptionVM; current: boolean; onPick: () => void; big?: boolean }) {
  return current ? (
    <span className={`dr-chosen${big ? " big" : ""}`} aria-label={L(`${o.title}: seçili`, `${o.title}: chosen`)}>
      <Ic name="check" size={14} stroke={3} /> {L("Seçili", "Chosen")}
    </span>
  ) : (
    <button type="button" className={`q-pick dr-sec${big ? " big" : ""}`} onClick={onPick} aria-label={L(`${o.title}: seç`, `Choose ${o.title}`)}>
      {L("Seç", "Choose")}
    </button>
  );
}

/** "Önerimiz. <why>" on our pick: the pick's own reasons from the comparison. */
function Why({ text }: { text: string }) {
  return (
    <p className="dr-why">
      <b>{L("Önerimiz.", "Our pick.")}</b> {text}
    </p>
  );
}

/** "Neden 91?": our pick's reasons, else the parts it does well and badly on; open on our pick. */
function Neden({ o, why, parts }: { o: OptionVM; why: string | null; parts: Part[] }) {
  const own = why ?? partsWhy(parts);
  if (!own) return null;
  return (
    <details className="dr-nd" open={why != null}>
      <summary>
        <Ic name="spark" size={13} />
        {o.score != null ? L(`Neden ${o.score}?`, `Why ${o.score}?`) : L("Neden?", "Why?")}
        <Ic name="chev" size={13} />
      </summary>
      {why ? <Why text={why} /> : <p className="dr-wyp">{own}</p>}
    </details>
  );
}

/** B14: an option's name opens its record (Tüm detaylar), where the evidence behind a finding is; the drawer gives way to it. */
function Name({ o }: { o: OptionVM }) {
  const open = useOpenRecord();
  return open ? (
    <button type="button" className="dr-nm" title={o.title} onClick={() => open(o)} aria-label={L(`${o.title}: tüm detaylar`, `${o.title}: all details`)}>
      {o.title}
    </button>
  ) : (
    <b className="dr-nm" title={o.title}>
      {o.title}
    </b>
  );
}

/** The five slots, always in the same order so the cards compare; the source opens its page. */
function Slots({ slots, url, compact = false }: { slots: CardSlot[]; url: string | null; compact?: boolean }) {
  return (
    <ul className={`dr-slots${compact ? " c" : ""}`}>
      {slots.map((s) => {
        const body = (
          <>
            <Ic name={SLOT_ICON[s.icon]} size={15} />
            <span>
              {!compact && <small>{s.label}</small>}
              <b>{compact && s.tone === "dim" && !["gate", "from", "to", "rating"].includes(s.key) && s.value === L("bilinmiyor", "unknown") ? `${s.label} ?` : s.value}</b>
            </span>
          </>
        );
        return (
          <li key={s.key} className={`dr-slt ${s.tone}`} title={compact ? `${s.label}: ${s.value}` : undefined}>
            {s.key === "source" && url ? (
              <a href={url} target="_blank" rel="noreferrer" title={L(`${s.value} sayfasında aç`, `Open on ${s.value}`)}>
                {body}
                {/* (Karar Masası: the source goes to its page) */}
                <span className="q-ext" aria-hidden>
                  ↗
                </span>
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Yorumlardan": what its reviews praise (+) and fault (−), always open. */
function Reviews({ o }: { o: OptionVM }) {
  const r = prosCons(o.item, o.topics);
  if (!r) return null;
  return (
    <div className="dr-pc">
      <small>
        <Ic name="spark" size={13} /> {reviewsHead(r.count)}
      </small>
      <ul className="up">
        {r.pros.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <ul className="dn">
        {r.cons.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Kaçırdıklarımız 4: "2 gün önce · Yenile" on a price read days ago, "Dün €71 idi" on one that fell since. */
function Fresh({ o }: { o: OptionVM }) {
  const env = useCardEnv();
  const f = priceAge(o.item, Date.now());
  if (!f.ago && !f.was) return null;
  return (
    <small>
      {f.was && <span className="dr-was">{f.was}</span>}
      {f.was && f.ago && " · "}
      {f.ago && <span className="dr-age">{f.ago}</span>}
      {f.ago && env.ask && (
        <>
          {" · "}
          <button type="button" className="dr-rf" onClick={() => env.ask?.(L(`${o.item.name} fiyatını güncelle`, `Update the price of ${o.item.name}`))}>
            {L("Yenile", "Refresh")}
          </button>
        </>
      )}
    </small>
  );
}

/** Kaçırdıklarımız (ortak gezide oylar): who liked it, a heart and their names on the photo's corner; it moves no score. */
function Hearts({ item }: { item: Item }) {
  const share = useShare();
  const me = useMyName();
  const names = likersOf(share ? withLoves(item, share.votes) : item).map((n) => (n === "me" ? me || L("Sen", "You") : n));
  if (!names.length) return null;
  return (
    <span className="dr-hearts" title={L(`${names.join(", ")} beğendi`, `Liked by ${names.join(", ")}`)}>
      <span aria-hidden>♥</span> {names.join(", ")}
    </span>
  );
}

/** A stay's or a rental's price: by the night (the day) big, the whole small; else the source's usual range; else none. */
function CardPrice({ o, typical, gap = null }: { o: OptionVM; typical: Typical | null; gap?: { was: number; now: number } | null }) {
  const p = o.price;
  if (p?.perNight) {
    const [each] = p.perNight.split(" / ");
    return (
      <span className="dr-pr">
        <b>{each}</b>
        <small>
          {L(`gece · ${p.text} toplam`, `night · ${p.text} in all`)}
          {p.provisional && <i className="z-prov"> · {L("geçici", "provisional")}</i>}
        </small>
        <Fresh o={o} />
        {gap && <small className="dr-age">{guestGapText(gap, false)}</small>}
      </span>
    );
  }
  const own = optionPrice(p);
  const usual = own ? null : (typical?.(o) ?? null);
  if (own)
    return (
      <span className="dr-pr">
        <b>{own.amount}</b>
        {own.unit && <small>{own.unit}</small>}
        <Fresh o={o} />
        {gap && <small className="dr-age">{guestGapText(gap, false)}</small>}
      </span>
    );
  if (usual)
    return (
      <span className="dr-pr" title={usual.title}>
        <b>{usual.amount}</b>
        <small>{usual.unit}</small>
      </span>
    );
  return <span className="dr-pr none">{L("Fiyat yok", "No price")}</span>;
}

/** A stay or a rental: the photo first, its score on it; the name, where, the three parts; price and Seç; slots; reviews. */
/** (exported: the Pano draws the same card, its own Seç in `pick`) */
export function CardOption({ o, art, current, typical, why, parts, rental, solo, onPick, pick = null, people = 0 }: { o: OptionVM; art: string; current: boolean; typical: Typical | null; why: string | null; parts: Part[]; rental: boolean; solo: boolean; onPick: () => void; pick?: ReactNode; people?: number }) {
  const split = scoreParts(parts);
  const slots = rental ? rentalSlots(o.item, o.brand?.label ?? null) : staySlots(o.item, o.brand?.label ?? null);
  return (
    <article className={`dr-op dr-card${current ? " cur" : ""}`} data-item-id={o.id}>
      <div className="dr-ph">
        <img className={o.image ? "ph" : "art"} src={o.image ?? art} alt="" />
        <Rank o={o} solo={solo} />
        <Hearts item={o.item} />
        {o.gallery.length > 0 && <GalleryThumbs own={o.image} photos={o.gallery} name={o.title} />}
      </div>
      <div className="dr-in">
        <span className="dr-r1">
          <Name o={o} />
          <span className="dr-r2">{[o.brand?.label ?? o.item.provider, o.where].filter(Boolean).join(" · ")}</span>
          {split.length > 0 && (
            <span className="dr-parts" aria-label={L("Puanın parçaları", "The score's parts")}>
              {split.map((s) => (
                <span key={s.group} className={s.group}>
                  {groupLabel(s.group)} <b>{s.value}</b>
                </span>
              ))}
            </span>
          )}
        </span>
        <CardPrice o={o} typical={typical} gap={rental ? null : guestGap(o.item, people)} />
        {pick ?? <Pick o={o} current={current} onPick={onPick} big />}
      </div>
      <Slots slots={slots} url={o.item.url} />
      {why && <Why text={why} />}
      <Reviews o={o} />
    </article>
  );
}

/** A flight, a boat, a train: the boarding pass (the hours big, the length and stops between), price and Seç, slots, Neden. */
export function TicketOption({ o, vm, art, current, why, parts, off, solo, onPick, pick = null }: { o: OptionVM; vm: IntentVM; art: string; current: boolean; why: string | null; parts: Part[]; off: boolean; solo: boolean; onPick: () => void; pick?: ReactNode }) {
  const f = rowFace(o, vm.kind);
  const slots = (vm.kind === "flight" ? flightSlots : waySlots)(o.item, o.brand?.label ?? null);
  return (
    <article className={`dr-op dr-tk${current ? " cur" : ""}${o.yours ? " own" : ""}`} data-item-id={o.id}>
      <header className="dr-th">
        <CarrierLogo mark={f.mark} art={art} />
        <span className="dr-tn">
          <Name o={{ ...o, title: f.name }} />
          {o.yours ? (
            // (Karar Masası: what the traveller brought stands out in gold, where it came from said)
            <small className="dr-own">
              <b>{L("Senin", "Yours")}</b>
              {o.brand?.label ? ` · ${L(`${fromName(o.brand.label)} kaydettin`, `saved ${fromName(o.brand.label)}`)}` : f.sub ? ` · ${f.sub}` : ""}
            </small>
          ) : (
            f.sub && <small>{f.sub}</small>
          )}
        </span>
        <Rank o={o} off={off} solo={solo} />
      </header>
      <div className="dr-tm">
        <div className="dr-tb">
          <span className="dr-e">
            <b>{f.dep ?? "–"}</b>
            {f.from && <small>{f.from}</small>}
          </span>
          <span className="dr-m">
            <small>{f.duration ?? " "}</small>
            <i aria-hidden />
            <small className={f.stops?.tone}>{f.stops?.text ?? " "}</small>
          </span>
          <span className="dr-e r">
            <b>
              {f.arr ?? "–"}
              {f.plus ? <sup>+{f.plus}</sup> : null}
            </b>
            {f.to && <small>{f.to}</small>}
          </span>
        </div>
        <span className="dr-pr">
          <b>{o.ticket?.each ?? o.ticket?.total ?? f.price?.text ?? "–"}</b>
          {o.ticket?.each && <small>{L(`kişi başı · ${o.ticket.total} toplam`, `each · ${o.ticket.total} in all`)}</small>}
          <Fresh o={o} />
        </span>
        {pick ?? <Pick o={o} current={current} onPick={onPick} />}
      </div>
      <Slots slots={slots} url={o.item.url} compact />
      {!solo && <Neden o={o} why={why} parts={parts} />}
    </article>
  );
}

/** A day's band over its flights: the tile, the full date, "istenen gün · 3 seçenek" (sticky as the list scrolls). */
function DayBand({ day, asked, count }: { day: string; asked: string | null; count: number }) {
  const b = dayBand(day, asked, count);
  return (
    <div className={`dr-day${b.asked ? " asked" : b.off ? " off" : ""}`}>
      <span className="dr-dt" aria-hidden>
        <b>{b.n}</b>
        <small>{b.month}</small>
      </span>
      <span className="dr-dl">
        <b>{b.title}</b>
        <small>{b.note}</small>
      </span>
      {b.asked && <span className="dr-dp">{L("istenen gün", "the day asked")}</span>}
    </div>
  );
}

/** Elenen: what was ruled out among these options, one "Geri al" from coming back. */
function Dropped({ items }: { items: Item[] }) {
  const env = useCardEnv();
  if (!items.length) return <p className="dr-empty">{L("Elenen seçenek yok.", "Nothing ruled out.")}</p>;
  return (
    <ul className="dr-drop">
      {items.map((i) => (
        <li key={i.id} data-item-id={i.id}>
          <button type="button" className="dr-nm" onClick={() => env.onOpenItem(i)}>
            {i.name}
          </button>
          <small>{[i.provider, i.statusNote, i.price.amount != null ? formatPrice(i.price.amount, i.price.currency) : null].filter(Boolean).join(" · ")}</small>
          <button type="button" className="link-btn" onClick={() => void setItemStatus(i, "saved")}>
            {L("Geri al", "Undo")}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A need's family in the drawer: a stay's card, a rental's (the same card), a ticket's boarding pass. */
export const familyOf = (vm: IntentVM): Family => (vm.frame !== "ticket" ? "stay" : isRental(vm) ? "rental" : "ticket");

/** The drawer's (and a Pano group's) head: "Chiang Mai · 3 gece" over "27–30 Mar · Cmt → Sal · 2 kişi". */
export function drawerHead(vm: IntentVM, people: number): { title: string; sub: string } {
  const family = familyOf(vm);
  const date = railDate(vm);
  const routeTitle = vm.head.route && vm.frame === "ticket" && family === "ticket" ? `${vm.head.route.from} → ${vm.head.route.to}` : null;
  const city = vm.head.city ?? headName(vm);
  const title = routeTitle ?? (family === "rental" ? `${city} · ${(vm.head.kindWord ?? L("Kiralama", "Rental")).toLocaleLowerCase(L("tr", "en"))}` : vm.kind === "stay" && vm.head.nights > 0 ? `${city} · ${L(`${vm.head.nights} gece`, `${vm.head.nights} night${vm.head.nights > 1 ? "s" : ""}`)}` : headName(vm));
  const sub = [date ? [date.when, date.sub].filter(Boolean).join(" · ") : null, family === "rental" ? date?.span : null, L(`${people} kişi`, `${people} ${people > 1 ? "people" : "person"}`)].filter(Boolean).join(" · ");
  return { title, sub };
}

/** The decision's own parts for an option (its weights, its sub-scores): the score's three parts and "Neden?". */
export const partsFor = (byGroup: ReadonlyMap<string, GroupDecision> | undefined, item: Item): Part[] => decisionOf(byGroup, item)?.options.find((d) => d.item.id === item.id)?.parts ?? [];

/** Our pick's reasons, said once on its card (choice.ts, as the details over the card say them); the Pano's deck says them too. */
export function useOursReason(options: readonly OptionVM[]): string | null {
  const env = useCardEnv();
  const ours = options.find((o) => o.ours) ?? null;
  return useMemo(() => {
    if (!ours) return null;
    const d = decisionOf(env.decisions?.byGroup, ours.item);
    const ctx = env.decisions?.ctx;
    const choice = d && ctx && d.options.filter((x) => !x.excluded).length > 1 ? choiceOf(d, ctx) : null;
    return pickReason(choice?.headline ?? null, ours.item.name);
  }, [ours, env.decisions]);
}

export function IntentDrawer({ vm, options, dropped = [], chosenId, art, links, typical, need, placeholder = null, people, onPick, onClose, onPano, onAsk, onOffer, onBring = null }: {
  vm: IntentVM;
  options: OptionVM[];
  /** Elenen: the options of this need that were ruled out ("Ele"), newest last. */
  dropped?: Item[];
  chosenId: string | null;
  art: string;
  links: SelfSearch[];
  typical: Typical | null;
  /** The source's picks for this need (OfferRow), when it has a source to ask. */
  need: Need | null;
  /** The start's empty record for this need (OfferRow fills it rather than adding another). */
  placeholder?: Item | null;
  people: number;
  onPick: (o: OptionVM) => void;
  onClose: () => void;
  onPano: (() => void) | null;
  onAsk: (() => void) | null;
  /** A source's pick taken from the drawer ("Ekle" in OfferRow). */
  onOffer: (item: Item) => void;
  /** Karar Masası, getirme anları: a link or a screenshot dropped or pasted here goes to this need. */
  onBring?: ((got: Brought) => void) | null;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const [pane, setPane] = useState<"options" | "dropped">("options");
  // (getirme anları: dragged over the drawer, its "+ Seninkini ekle" says it takes it; a paste here goes to this need too)
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!onBring) return;
    const onPaste = (e: ClipboardEvent) => {
      const at = e.target instanceof HTMLElement ? e.target : null;
      if (at && (at.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(at.tagName))) return;
      if (!asideRef.current || (at && !asideRef.current.contains(at) && at !== document.body)) return;
      const files = [...(e.clipboardData?.files ?? [])];
      const text = files.length ? "" : (e.clipboardData?.getData("text/plain") ?? "").trim();
      if (!files.length && !/^https?:\/\//i.test(text)) return;
      e.preventDefault();
      onBring({ files, links: text });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onBring]);
  const drop = onBring
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!carriesArrival(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!carriesArrival(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          setOver(false);
          const got = broughtOf(e.dataTransfer);
          if (!got) return;
          e.preventDefault();
          e.stopPropagation();
          onBring(got);
        },
      }
    : {};
  const [tab, setTab] = useState<DrawerTab>("all");
  // (a nightly price counts the need's nights when it was saved without its own)
  const nights = vm.head.nights ?? null;
  const family = familyOf(vm);
  const [sort, setSort] = useState<SortKey>("fit");
  useEffect(() => {
    closeRef.current?.focus();
    // Modal for the keyboard too (review): Escape closes it before anything else hears it; Tab goes round inside it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const box = asideRef.current;
        if (!box) return;
        const stops = [...box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, input, summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!stops.length) return;
        const first = stops[0], last = stops[stops.length - 1];
        const inside = box.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);
  const counts = useMemo(() => ({ all: options.length, mine: options.filter((o) => optionTab(o) === "mine").length, ai: options.filter((o) => optionTab(o) === "ai").length }), [options]);
  const list = drawerList(options, tab, "all", sort, people, nights);
  const env = useCardEnv();
  // The decision's own parts for each option (its weights, its sub-scores): the score's three parts and "Neden?".
  const decision = options[0] ? decisionOf(env.decisions?.byGroup, options[0].item) : undefined;
  const partsOf = (o: OptionVM): Part[] => partsFor(env.decisions?.byGroup, o.item);
  const shares = family !== "ticket" ? weightShares(decision?.options[0]?.parts ?? []) : [];
  // Our pick's reasons, said once on its card (choice.ts, as the details over the card say them).
  const reason = useOursReason(options);
  const view = rowView(vm);
  const { title, sub } = drawerHead(vm, people);
  const deck = options.slice(0, 3);
  const asked = vm.head.date ?? null;
  const solo = options.length < 2;
  const card = (o: OptionVM) => {
    const current = o.id === chosenId;
    const why = o.ours ? reason : null;
    const parts = partsOf(o);
    if (family !== "ticket") return <CardOption key={o.id} o={o} art={art} current={current} typical={typical} why={why} parts={parts} rental={family === "rental"} solo={solo} people={people} onPick={() => onPick(o)} />;
    const day = optionDay(o);
    return <TicketOption key={o.id} o={o} vm={vm} art={art} current={current} why={why} parts={parts} solo={solo} off={vm.kind === "flight" && asked != null && day != null && day !== asked} onPick={() => onPick(o)} />;
  };
  // Flights over several days: each day under its band, the day asked first.
  const byDay = (): ReactNode => {
    const days = [...new Set(list.map((o) => optionDay(o) ?? ""))];
    if (vm.kind !== "flight" || days.length < 2) return list.map(card);
    const order = days.sort((a, b) => (a === asked ? -1 : b === asked ? 1 : a.localeCompare(b)));
    return order.map((d) => {
      const here = list.filter((o) => (optionDay(o) ?? "") === d);
      return (
        <div key={d || "none"} className="dr-dg">
          {d && <DayBand day={d} asked={asked} count={here.length} />}
          {here.map(card)}
        </div>
      );
    });
  };
  const criteria = vm.head.wants;
  const node = (
    <>
      <div className="dr-scrim" onClick={onClose} aria-hidden />
      <aside ref={asideRef} className={`dr${over ? " over" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-kind={vm.kind} data-family={family} data-intent={vm.key} {...drop}>
        <div className="dr-h">
          <div className="dr-top">
            <span className="dr-deck" aria-hidden>
              {family === "ticket"
                ? deck.map((o) => <CarrierLogo key={o.id} mark={rowFace(o, vm.kind).mark} art={art} small />)
                : deck.map((o) => <img key={o.id} src={o.image ?? art} alt="" />)}
              {options.length > 0 && <b>{options.length}</b>}
            </span>
            <span className="dr-t">
              <b id={titleId}>
                {vm.kind === "flight" && family === "ticket" && vm.head.route ? (
                  <>
                    {vm.head.route.from}{" "}
                    <i className="q-rpl">
                      <ModeIcon name="plane" size={22} />
                      <span className="sr-only">→</span>
                    </i>{" "}
                    {vm.head.route.to}
                  </>
                ) : (
                  title
                )}
              </b>
              {sub && <span>{sub}</span>}
            </span>
            <button type="button" className="q-pano dr-pano" disabled={!onPano || !vm.optionCount} onClick={onPano ?? undefined} aria-label={L(`${title}: Pano'da ${vm.optionCount} seçenek`, `${title}: ${vm.optionCount} options on the Board`)}>
              <Ic name="board" size={14} />
              <span>{L("Büyük Pano", "Big board")}</span>
              <b className="q-pn">{vm.optionCount}</b>
            </button>
            <button ref={closeRef} type="button" className="dr-x" aria-label={L("Kapat", "Close")} onClick={onClose}>
              <Ic name="x" size={16} />
            </button>
          </div>
          {(criteria.length > 0 || env.ask) && (
            <div className="dr-crit" aria-label={L("Ölçütler", "Criteria")}>
              <small>{L("Ölçütler", "Criteria")}</small>
              {criteria.map((w) => (
                <span key={w.label} className={`dr-want${w.must ? " req" : ""}`} title={w.must ? L("Şart", "A must") : L("Tercih", "A wish")}>
                  {w.label}
                </span>
              ))}
              {env.ask && (
                <button type="button" className="dr-want add" onClick={() => env.ask?.(L(`${title} için bir ölçüt daha: `, `One more criterion for ${title}: `))}>
                  + {L("ekle", "add")}
                </button>
              )}
            </div>
          )}
          {shares.length > 0 && (
            <div className="dr-wt" aria-label={L("Sıralamanın ağırlıkları", "The sort's weights")}>
              <small>{L("Sıralama", "Ranking")}</small>
              <span className="dr-bar" aria-hidden>
                {shares.map((g) => (
                  <i key={g.group} className={g.group} style={{ flexGrow: g.share }} />
                ))}
              </span>
              <span className="dr-lg">
                {shares.map((g) => (
                  <span key={g.group} className={g.group}>
                    {groupLabel(g.group, true)} %{g.share}
                  </span>
                ))}
              </span>
              {options[0] && <WeightTuner trip={env.trip} category={options[0].item.category} shares={shares} />}
            </div>
          )}
          <div className="dr-ctl">
            <span className="dr-seg" role="tablist">
              <button type="button" role="tab" className="dr-tab" aria-selected={pane === "options"} onClick={() => setPane("options")}>
                {L("Seçenekler", "Options")} <b>{options.length}</b>
              </button>
              <button type="button" role="tab" className="dr-tab" aria-selected={pane === "dropped"} onClick={() => setPane("dropped")}>
                {L("Elenen", "Ruled out")} <b>{dropped.length}</b>
              </button>
            </span>
            {pane === "options" && counts.mine > 0 && counts.ai > 0 && (
              <label className="dr-sel">
                <span>{L("Kaynak", "From")}</span>
                <select aria-label={L("Kaynak", "From")} value={tab} onChange={(e) => setTab(e.target.value as DrawerTab)}>
                  <option value="all">{L(`Hepsi (${counts.all})`, `All (${counts.all})`)}</option>
                  <option value="mine">{L(`Kaydettiklerin (${counts.mine})`, `Your saves (${counts.mine})`)}</option>
                  <option value="ai">{L(`AI önerileri (${counts.ai})`, `AI picks (${counts.ai})`)}</option>
                </select>
              </label>
            )}
            {pane === "options" && (
              <label className="dr-sel">
                <span>{L("Sırala:", "Sort:")}</span>
                <select data-ssel aria-label={L("Sırala", "Sort")} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  {SORTS[family].map(([k, t]) => (
                    <option key={k} value={k}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        <div className="dr-b">
          {pane === "dropped" ? (
            <Dropped items={dropped} />
          ) : list.length ? (
            <div className="dr-ops">{byDay()}</div>
          ) : (
            <p className="dr-empty">{L("Henüz seçenek yok.", "No options yet.")}</p>
          )}
          {pane === "options" && need && (
            <div className="dr-offers">
              <OfferRow key={need.key} need={need} onChoose={onOffer} placeholder={placeholder} chosen={chosenId != null} hasOptions={options.length > 0} />
            </div>
          )}
          {pane === "options" && (
            <div className="dr-new">
              <span className="dr-ni" aria-hidden>
                <Ic name="link" size={20} />
              </span>
              <span className="dr-nt">
                {vm.kind === "flight" ? (
                  <>
                    {/* (Karar Masası: "+ Seninkini ekle", a link or a screenshot) */}
                    <b>+ {L("Seninkini ekle", "Add yours")}</b>
                    <small>{L("Bağlantıyı bırak ya da ekran görüntüsünü sürükle; desteye girer, aynı ağırlıkla puanlanır.", "Drop the link or drag the screenshot; it joins the deck, scored by the same weights.")}</small>
                  </>
                ) : (
                  <>
                <b>{family === "stay" ? L("Bulduğun otelin bağlantısını buraya bırak", "Drop the link of a place you found here") : family === "rental" ? L("Bulduğun kiralamanın bağlantısını buraya bırak", "Drop the link of a rental you found here") : L("Bulduğun biletin bağlantısını buraya bırak", "Drop the link of a ticket you found here")}</b>
                <small>{L("Kaydettiğin her sayfa desteye eklenir ve aynı ağırlıkla puanlanır.", "Every page you save joins the deck, scored by the same weights.")}</small>
                  </>
                )}
                {(links.length > 0 || onAsk) && (
                  <span className="dr-mrow">
                    {links.length > 0 && <small>{L("Bakmak için:", "Look on:")}</small>}
                    {links.map((l) => (
                      <a key={l.id} className="dr-link" href={l.url} target="_blank" rel="noopener noreferrer">
                        <Mark color={l.color} letter={l.letter} small />
                        {l.name} <span aria-hidden>↗</span>
                      </a>
                    ))}
                    {onAsk && (
                      <button type="button" className="dr-ai" onClick={onAsk}>
                        <Ic name="spark" size={14} /> {L("AI yeniden arasın", "Ask the AI again")}
                      </button>
                    )}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="dr-foot">
            <small>{pane === "options" && dropped.length > 0 ? L(`Elenen ${dropped.length}: ${dropped.map((i) => i.name).join(", ")}`, `Ruled out ${dropped.length}: ${dropped.map((i) => i.name).join(", ")}`) : view.third.map((p) => p.text).join(" · ")}</small>
            {onPano && vm.optionCount > 1 && (
              <button type="button" className="dr-cmpb" onClick={onPano}>
                {L("Pano'da karşılaştır", "Compare on the Board")} <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
  const openRecord = (o: OptionVM) => {
    onClose();
    env.onOpenItem(o.item);
  };
  return createPortal(<OpenRecord.Provider value={openRecord}>{node}</OpenRecord.Provider>, document.body);
}
