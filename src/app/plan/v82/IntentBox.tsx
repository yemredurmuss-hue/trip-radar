// One intent (plan v82 "niyet kutusu standardı"): its head (IntentHead) and one fixed frame under it, the same size in every
// state, its ground and its dot on the category's rail the state's colour. The frame is the family's (FrameCard: a stay, an
// eSIM, insurance; FrameTicket: a flight, a train, any way of travel; CollectionRow comes with phase 4); with options to
// pick from it is three cards (OptionCompact) or, for a ticket, three rows (OptionRow), and "Değiştir" turns the chosen
// one back to them in place. A change of city or a transfer with no record of its own says "Gerek yok", "Ben hallettim"
// and its way (C15) on the leg itself (Trip.hidden, Trip.legs). Ayrıntı opens over the frame (DetailLayer);
// "Gerek yok" folds the body (E7) and the box goes under the category's "Gizlenenler · n" (F3). A record's days, name and
// price edit where they stand (C2); a thin "+ Buraya ekle" under a stay adds on its last night, in its city (C3).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isCampStay } from "../../../lib/campStay";
import { L } from "../../../lib/i18n";
import { areaSearch, changeList, currentOption, frameForm, headName, offerNeed, railState, SHOWN_OPTIONS, statusChip, unlessEmpty } from "../../../lib/intentFrame";
import type { IntentStatus, IntentVM, OptionVM } from "../../../lib/intents";
import { addDays } from "../../../lib/plan";
import { regionHints, type RegionHint } from "../../../lib/regionHints";
import { waySearches } from "../../../lib/ticketFrame";
import type { InsertAt } from "../../../lib/templates";
import type { Item, LegChoice } from "../../../lib/types";
import { entryDomId } from "../../../lib/progress";
import { withLegChoice } from "../../../lib/legs";
import { setHidden, setInstalled, setItemStatus, cancelBooking, updateTrip } from "../../actions";
import type { MenuEntry } from "../../cards/CardShell";
import { openDoc, useDocPick } from "../../cards/DocAccess";
import { useEmptyEnv } from "../../cards/emptyEnv";
import { illusOf, stayArtOf } from "../../cards/MediaCard";
import { OfferRow } from "../../cards/OfferRow";
import { InlineEdit } from "../../cards/InlineEdit";
import { datedLink } from "../../cards/parts";
import { useCardEnv } from "../../cards/PlanCard";
import { hasSearched } from "../../cards/searching";
import { useStageMenu } from "../../cards/stageMenu";
import { useWhoMenu } from "../../cards/whoMenu";
import { FOLD_MS, reducedMotion } from "../../motion";
import { CollectionRow } from "./CollectionRow";
import { decisionOf, DetailLayer, focusNear } from "./DetailLayer";
import { FrameCard } from "./FrameCard";
import { FrameTicket } from "./FrameTicket";
import { IntentHead } from "./IntentHead";
import { IntentMenu } from "./IntentMenu";
import { OptionList } from "./OptionCompact";
import { OptionRows } from "./OptionRow";
import { useCrossfade, type Entry } from "./useCrossfade";
import { useIntentActions } from "./useIntentActions";
import { useV82Env } from "./v82Env";

/** A kind's drawing (static/illus), for a frame or an option with no photo. */
export function artOf(kind: IntentVM["kind"], item: Item | null = null): string {
  if (kind === "stay") {
    const art = stayArtOf(item);
    return art === "tent" ? "illus/cadir.svg" : `illus/${art}.png`;
  }
  // A flight's plane, a way of travel nobody named the taxi's (the ticket's own drawings, ticketView.ts).
  if (kind === "flight") return "illus/ucus.png";
  if (kind === "transport") return "illus/taksi-transfer.png";
  return `illus/${illusOf(kind) ?? "not"}.png`;
}

/** How far along a state is: the chip springs once on a step forward, never back (hareket dili, kural 4). */
const TAKEOFF: readonly IntentStatus[] = ["chosen", "booked"];
const STEP: Readonly<Record<IntentStatus, number>> = { skipped: -1, searching: 0, deciding: 1, suggested: 2, chosen: 3, arranged: 4, included: 4, booked: 5 };

function useStepPop(status: IntentStatus, ms = 520, to?: readonly IntentStatus[]): boolean {
  const [pop, setPop] = useState(false);
  const was = useRef(status);
  useEffect(() => {
    const forward = STEP[status] > STEP[was.current] && (!to || to.includes(status));
    was.current = status;
    if (!forward || reducedMotion()) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), ms);
    return () => clearTimeout(t);
  }, [status]);
  return pop;
}

/** The areas the offers source's candidates are in, for an empty stay (regionHints); nothing without a source. */
function useRegionHints(vm: IntentVM, ask: boolean): RegionHint[] {
  const { offers: source } = useEmptyEnv();
  const { selfAt } = useV82Env();
  const need = ask ? offerNeed(vm, selfAt) : null;
  const [hints, setHints] = useState<{ key: string; list: RegionHint[] } | null>(null);
  useEffect(() => {
    if (!need || need.kind !== "stay" || !source.candidates || !source.available()) return;
    let alive = true;
    source.candidates(need).then(
      (list) => alive && setHints({ key: need.key, list: regionHints(list) }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [need?.key, source]);
  return need && hints?.key === need.key ? hints.list : [];
}

/** The fields a box draws (its head's days, its card's name and price): Tab never opens one that isn't there. */
const DRAWN = ["name", "date", "end", "price"] as const;
/** A ticket's: its ends and its hour where they stand, its day, its price (a rental's place and return day). */
const TICKET_DRAWN = ["from", "to", "city", "date", "end", "time", "price"] as const;

export function IntentBox({ vm: given, color, onHere = null }: {
  vm: IntentVM;
  color: string;
  /** C3: "+ Buraya ekle" under the box opens the add window at this place (null: none). */
  onHere?: ((at: InsertAt) => void) | null;
}) {
  const env = useCardEnv();
  const { byId } = useV82Env();
  const records = given.itemIds.map((id) => byId.get(id)).filter((i): i is Item => i != null);
  const vm = unlessEmpty(given, env.trip, records, (id) => env.docsFor(id).length);
  const record = vm.chosen?.item ?? null;
  // Still to find with a bare record in it (one tap's "Otel", the chat's "eSIM de alalım"): its ⋯ is the record's, and its
  // name the title's, to type where it stands.
  const held = record ? null : (given.chosen?.item ?? records.find((i) => i.status === "chosen") ?? null);
  const own = record ?? held;
  if (own) {
    return (
      <InlineEdit item={own} only={vm.frame === "ticket" ? [...TICKET_DRAWN] : record ? [...DRAWN] : ["name"]}>
        <RecordBox vm={vm} color={color} record={own} onHere={onHere} />
      </InlineEdit>
    );
  }
  return <Box vm={vm} color={color} extra={[]} field={null} pickDoc={null} cancel={null} onHere={onHere} itemId={null} />;
}

/** A stay's place for "+ Buraya ekle": its city and its last night (templates.insertAt); none without its days. */
function hereOf(vm: IntentVM): InsertAt | null {
  if (vm.kind !== "stay" || !vm.head.date || vm.head.nights < 1) return null;
  return { city: vm.head.city, date: null, night: addDays(vm.head.date, vm.head.nights - 1) };
}

/** A box with a record to show (our pick, the chosen one, the booking): its card's ••• entries and its file picker. */
function RecordBox({ vm, color, record, onHere }: { vm: IntentVM; color: string; record: Item; onHere: ((at: InsertAt) => void) | null }) {
  const env = useCardEnv();
  const stage = useStageMenu(record);
  const who = useWhoMenu(record);
  const doc = useDocPick(record);
  const booked = record.status === "booked";
  // C21: what the old card's ••• did for it, beside Ayrıntı and Gerek yok.
  const extra: MenuEntry[] = [
    ...(record.status === "chosen" && record.origin !== "chat" && !record.arranged ? [{ label: L("Seçimi geri al", "Undo choice"), run: () => void setItemStatus(record, "saved") }] : []),
    ...(booked ? [{ label: L("Rezervasyonu geri al", "Mark as not booked"), run: () => void setItemStatus(record, "chosen") }] : []),
    // An eSIM put on the phone ("Kurdum") is done, bought through the box or not (lifecycle: chosen and installed).
    ...((booked || record.status === "chosen") && vm.kind === "esim" ? [record.installedAt ? { label: L("Kurulmadı", "Not installed"), run: () => void setInstalled(record, false) } : { label: L("Kurdum", "Installed it"), run: () => void setInstalled(record, true) }] : []),
    ...stage.menu.filter((m) => m.id !== "change" && m.id !== "addDoc"),
    { label: L("Belge ekle", "Add a document"), run: doc.pick },
    ...who.map((e, i) => ({ ...e, sep: i === 0 })),
  ];
  const cancel = booked ? () => cancelBooking(record).then(env.offer) : null;
  return (
    <Box vm={vm} color={color} extra={extra} field={<>{stage.field}{doc.field}</>} pickDoc={doc.pick} cancel={cancel} askedHide={booked ? stage.hide : null} onHere={onHere} itemId={record.id} />
  );
}

function Box({ vm, color, extra, field, pickDoc, cancel, askedHide = null, onHere, itemId }: {
  vm: IntentVM;
  color: string;
  extra: MenuEntry[];
  field: ReactNode;
  pickDoc: (() => void) | null;
  /** "İptal ettim" on a booking (it's kept as cancelled, its need to find again). */
  cancel: (() => Promise<void>) | null;
  /** A booking's "Gerek yok" asks first whether it was cancelled (stageMenu.hide). */
  askedHide?: (() => void) | null;
  onHere: ((at: InsertAt) => void) | null;
  /** The record the box stands for (the one shown, or the bare one still to find): to-dos and arrivals find it by it. */
  itemId: string | null;
}) {
  const env = useCardEnv();
  const v82 = useV82Env();
  const a = useIntentActions(vm);
  const [changing, setChanging] = useState(false);
  const [detail, setDetail] = useState(false);
  const [folding, setFolding] = useState(false);
  const form = frameForm(vm);
  const showOptions = form === "options" || (changing && form != null);
  const chosenId = vm.chosen?.id ?? null;
  // A new pick, a booking, another state: the card is itself again (Değiştir and Ayrıntı close).
  useEffect(() => {
    setChanging(false);
    setDetail(false);
  }, [vm.status, chosenId]);
  const boxRef = useRef<HTMLElement>(null);
  const pop = useStepPop(vm.status);
  // K29 on a ticket (hareket dili §2.3, §2.5): a step forward to Seçildi or Alındı takes its plane off (1.1 s, after the
  // frame's 120 ms crossfade); no glow.
  const takeoff = useStepPop(vm.status, 1300, TAKEOFF);
  const chipId = useId();
  const name = headName(vm);
  const entry = useRef<Entry>("in");
  const art = artOf(vm.kind, vm.chosen?.item ?? vm.options[0]?.item ?? null);
  // C15: a way nobody planned is looked for on the sites that compare every way, a transfer on Uber and the map's directions.
  const links = waySearches(vm, v82.selfAt, itemId ? (v82.byId.get(itemId) ?? null) : null);
  const searchingNow = form === "searching" && a.searching;
  const hints = useRegionHints(vm, form === "searching");
  const record = vm.chosen?.item ?? null;
  const decision = record ? decisionOf(env.decisions?.byGroup, record) : undefined;
  const page = record ? (datedLink(record, decision).url ?? record.url) : null;
  const docs = record ? env.docsFor(record.id) : [];

  // A leg with no record of its own (an empty transfer, a change of city): what's said is said on the leg.
  const leg = vm.legKey != null && vm.itemIds.length === 0 ? vm.legKey : null;
  const onLeg = (patch: Partial<Omit<LegChoice, "updatedAt">>): Promise<void> => (leg ? updateTrip(env.tripId, (t) => withLegChoice(t, leg, patch)) : Promise.resolve());
  const skipNow = () => (leg ? void setHidden(env.tripId, `leg:${leg}`, true, name) : a.skip());
  const skip = () => {
    if (askedHide) return askedHide();
    if (reducedMotion()) return skipNow();
    setFolding(true);
    setTimeout(skipNow, FOLD_MS);
  };
  const pick = (o: OptionVM) => {
    entry.current = "morph";
    if (o.id === chosenId) return setChanging(false);
    a.choose(o.item);
  };
  const change = () => {
    entry.current = "flip";
    setChanging(true);
  };
  const cancelChange = () => {
    entry.current = "back";
    setChanging(false);
  };
  // Escape turns a card back from its options (Vazgeç), as it did from the old card's back.
  useEffect(() => {
    if (!changing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && focusNear(boxRef.current) && cancelChange();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [changing]);

  const menu: MenuEntry[] = [
    ...(record && form !== "searching" ? [{ label: L("Ayrıntı", "Details"), run: () => setDetail(true) }] : []),
    ...(a.addSuggestion ? [{ label: L("Plana koy", "Add to plan"), run: a.addSuggestion }] : []),
    ...(vm.status === "arranged" && (record || leg)
      ? [{ label: L("Ayarlandı: geri al", "Arranged: take back"), run: () => (record ? a.unarrange(record) : void onLeg({ booked: false })) }]
      : vm.status !== "booked" && vm.status !== "included"
        ? [{ label: L("Ben hallettim", "I've got it"), run: leg ? () => void onLeg({ booked: true }) : a.arranged }]
        : []),
    { label: L("Gerek yok", "Not needed"), run: skip, danger: true },
    ...extra.map((m, i) => (i === 0 ? { ...m, sep: true } : m)),
  ];

  const detailNode =
    record && vm.chosen ? (
      <DetailLayer
        vm={vm}
        option={vm.chosen}
        booked={vm.status === "booked"}
        onClose={() => setDetail(false)}
        onAddDoc={pickDoc ?? (() => undefined)}
        footer={
          <>
            {cancel && (
              <>
                <button type="button" className="q-dact" onClick={() => void cancel()}>{L("İptal ettim, değiştir", "I cancelled it, change")}</button>
                <button type="button" className="q-dact bad" onClick={() => void cancel().then(() => a.skip([record.id]))}>{L("İptal ettim, kaldır", "I cancelled it, take it off")}</button>
              </>
            )}
            <button type="button" className="q-dact" onClick={() => env.edit(record)}>{L("Düzenle", "Edit")}</button>
          </>
        }
      />
    ) : null;

  let body: ReactNode = null;
  if (searchingNow) {
    body = (
      <div className="z-skel" role="status">
        <div className="q-oh">
          <span className="z-pulse" aria-hidden />
          <b className="q-ot">{L(`AI ${name} için arıyor`, `The AI is looking for ${name}`)}</b>
          <small className="q-oc">{L("seçenekler gelince burada", "options land here")}</small>
        </div>
        {vm.frame === "ticket" ? (
          <div className="z-rows z-skr" aria-hidden>
            {[0, 1, 2].map((n) => (
              <div key={n} className="z-sk"><i /><span><i /><i /><i /></span></div>
            ))}
          </div>
        ) : (
          <div className="z-ocs" aria-hidden>
            {[0, 1, 2].map((n) => (
              <div key={n} className="z-sk"><i /><span><i /><i /><i /></span></div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (showOptions) {
    const options = changing ? changeList(vm) : vm.options.slice(0, SHOWN_OPTIONS);
    const list = { vm, options, current: changing ? currentOption(vm) : null, changing, art, links, onPick: pick, onOpen: (o: OptionVM) => env.onOpenItem(o.item), onCancel: cancelChange, onAsk: a.ask };
    body = vm.frame === "ticket" ? <OptionRows {...list} /> : <OptionList {...list} />;
  } else if (form) {
    const props = {
      vm,
      form,
      art,
      page,
      links,
      hints: hints.map((h) => ({ ...h, url: areaSearch(vm, v82.selfAt, h.area)?.url ?? links[0]?.url ?? null })),
      info: record && form !== "searching" ? { open: detail, toggle: () => setDetail(!detail) } : null,
      detail: detailNode,
      quiet: form === "searching" && hasSearched(`intent:${vm.key}`) && !a.searching,
      on: {
        take: () => {
          entry.current = "morph";
          if (record) a.choose(record);
        },
        got: () => record && a.got(record),
        change: vm.optionCount > 0 || vm.options.length > 0 ? change : null,
        openDoc: docs.length ? () => void openDoc(docs[0].id) : null,
        addDoc: pickDoc ?? (() => undefined),
        ask: a.ask,
        edit: () => record && env.edit(record),
        unarrange: vm.status === "arranged" ? (record ? () => a.unarrange(record) : leg ? () => void onLeg({ booked: false }) : null) : null,
      },
    };
    const cover = vm.cover;
    const onCover = cover?.key && cover.section ? () => v82.goTo(cover.section!, cover.key) : null;
    body =
      vm.frame === "ticket" ? (
        <FrameTicket
          {...props}
          onCover={onCover}
          // By plane a change of city is a flight: it goes to Uçuş, and the plan follows it there with a flash.
          ways={leg && vm.modes.length ? { pick: (mode) => void onLeg({ mode }).then(() => mode === "flight" && v82.goTo("flight", vm.key)), own: () => void onLeg({ booked: true }) } : null}
          // A way said on a change of city (C15) goes back to the choice.
          onReset={leg && (vm.status === "chosen" || vm.status === "booked") ? () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg, null)) : null}
          onLegGot={leg && vm.status === "chosen" ? () => void onLeg({ booked: true }) : null}
        />
      ) : (
        <FrameCard {...props} onCover={onCover} />
      );
  }
  if (vm.frame === "collection") body = <CollectionRow vm={vm} art={art} onPut={(o) => a.choose(o.item)} onTakeOff={(o) => void setItemStatus(o.item, "saved")} />;
  const key = searchingNow ? "skel" : showOptions ? `opts:${changing ? "chg" : ""}` : `${form}:${chosenId ?? ""}`;
  const xf = useCrossfade(key, body, entry.current);
  useEffect(() => {
    entry.current = "in";
  }, [key]);

  const need = form === "searching" || form === "options" ? offerNeed(vm, v82.selfAt) : null;
  const chip = statusChip(vm);
  const headArt = vm.head.image ? { src: vm.head.image, photo: true } : { src: art, photo: false };
  const camp = record != null && vm.kind === "stay" && isCampStay(record);
  const here = onHere ? hereOf(vm) : null;
  return (
    <>
      <section
        ref={boxRef}
        className={`q-int z-int${folding ? " folding" : ""}${takeoff && vm.frame === "ticket" ? " z-go" : ""}`}
        id={vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined}
        data-intent={vm.key}
        data-st={railState(vm.status)}
        data-kind={vm.kind}
        data-item-id={itemId ?? undefined}
        data-option-ids={vm.itemIds.join(" ") || undefined}
        style={{ "--k": color } as React.CSSProperties}
        aria-label={name}
        aria-describedby={chipId}
        // What just arrived wears "Yeni" while it rings (arrive/useArrivals pulses .ar-new on it, C10/C35).
        data-new={L("Yeni", "New")}
      >
        <IntentHead vm={vm} art={headArt} chip={chip} chipId={chipId} pop={pop} onPano={a.pano} menu={<IntentMenu entries={menu} name={name} />} />
        <div className="q-bwrap">
          <div className="q-body">
            <div key={xf.key} className={xf.cls}>
              {xf.node}
            </div>
          </div>
        </div>
        {field}
        {/* The need's other blocks (its nights said apart): a to-do or a link to one of them finds this box (and flashes it). */}
        {vm.domKeys.slice(1).map((k) => (
          <i key={k} className="q-anchor" id={entryDomId(k)} aria-hidden />
        ))}
        {here && onHere && (
          <div className="q-here">
            <button type="button" title={L("Buraya ekle", "Add here")} onClick={() => onHere(here)}>
              + {L("Buraya ekle", "Add here")}
            </button>
          </div>
        )}
      </section>
      {need && !camp && (
        <div className="q-offers">
          <OfferRow key={need.key} need={need} />
        </div>
      )}
    </>
  );
}
