// The options beside the plan (plan v13, spec 2026-10-21 K82–K84): a need's every option in a drawer from the right, never
// inside its card. Its head says the route or the place and when, "İsteklerin" one line of what was asked for, the tabs
// (Tümü · Kaydettiklerin · AI önerileri), the count with the day (a flight over several days) and the order; then one card
// per option in the plan card's own language: a stay's picture, its fit, its rating and who saved it, the wants it answers
// ✓ or misses ⚠, what its reviews say, its price and one "Seç" ("✓ Seçili" on the one chosen); a flight's ticket. Flights
// spread over several days are compared by what decides (K83: price, length, stops, bag) and their hours go under; a boat,
// a train, a bus are a timetable's rows. At its end the source's picks (OfferRow), "Bulamadın mı?" (the sites, the AI) and
// the Büyük Pano in its head. Seç chooses at once; the box says "X yerine Y seçildi · Geri al".
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { choiceOf } from "../../../lib/choice";
import { bagAll, compareMode, drawerList, optionDay, optionDays, optionTab, pickReason, totalAmount, winners, type DrawerTab, type SortKey } from "../../../lib/drawerView";
import { L } from "../../../lib/i18n";
import { shortDay } from "../../../lib/ideas";
import { headName, optionPrice, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { formatPrice } from "../../../lib/items";
import { rowFace } from "../../../lib/ticketFrame";
import type { Need } from "../../../lib/offerSource";
import type { Item } from "../../../lib/types";
import { OfferRow } from "../../cards/OfferRow";
import { useCardEnv } from "../../cards/PlanCard";
import { decisionOf } from "./DetailLayer";
import { Ic, Mark, type IconName } from "./icons";
import { Rating, SourceBadge, type Typical } from "./OptionCompact";
import { BagIcon, CarrierLogo } from "./OptionRow";

const SORTS: Readonly<Record<"stay" | "flight" | "ticket", [SortKey, string][]>> = {
  stay: [["fit", L("Sana en uygun", "Best for you")], ["price", L("En ucuz", "Cheapest")], ["score", L("En yüksek puan", "Top rated")], ["dist", L("Merkeze en yakın", "Closest to the centre")]],
  flight: [["fit", L("Sana en uygun", "Best for you")], ["price", L("En ucuz", "Cheapest")], ["mins", L("En kısa", "Shortest")]],
  ticket: [["fit", L("Sana en uygun", "Best for you")], ["price", L("En ucuz", "Cheapest")], ["mins", L("En kısa", "Shortest")]],
};

const OpenRecord = createContext<((o: OptionVM) => void) | null>(null);
const useOpenRecord = () => useContext(OpenRecord);

const fitText = (o: OptionVM) => (o.score != null ? L(`%${o.score} uyum`, `${o.score}% fit`) : null);
const money = (o: OptionVM, n: number | null) => (n == null ? null : formatPrice(n, o.item.price?.currency ?? "EUR"));
const dayText = (d: string | null) => (d ? shortDay(d) : null);

function Fit({ o }: { o: OptionVM }) {
  const t = fitText(o);
  return t ? <span className={`dr-fit${(o.score ?? 0) >= 85 ? "" : " mid"}`} title={L("İsteklerine uyum", "Fit to what you asked")}>{t}</span> : null;
}

function Pick({ o, current, onPick }: { o: OptionVM; current: boolean; onPick: () => void }) {
  return current ? (
    <span className="dr-chosen" aria-label={L(`${o.title}: seçili`, `${o.title}: chosen`)}>
      <Ic name="check" size={14} stroke={3} /> {L("Seçili", "Chosen")}
    </span>
  ) : (
    <button type="button" className="q-pick dr-sec" onClick={onPick} aria-label={L(`${o.title}: seç`, `Choose ${o.title}`)}>
      {L("Seç", "Choose")}
    </button>
  );
}

/** "✨ Önerim. <why>" on our pick (mockup v13's opwhy): the pick's own reasons from the comparison. */
function Why({ text }: { text: string | null }) {
  return text ? (
    <p className="dr-why">
      <Ic name="spark" size={13} />
      <span>
        <b>{L("Önerim.", "Our pick.")}</b> {text}
      </span>
    </p>
  ) : null;
}

/** B14: an option's name opens its record (Tüm detaylar), where the evidence behind a finding is; the drawer gives way to it. */
function Name({ o }: { o: OptionVM }) {
  const open = useOpenRecord();
  return open ? (
    <button type="button" className="dr-nm" title={o.title} onClick={() => open(o)} aria-label={L(`${o.title}: tüm detaylar`, `${o.title}: all details`)}>
      {o.title}
    </button>
  ) : (
    <b title={o.title}>{o.title}</b>
  );
}

function SiteLink({ o }: { o: OptionVM }) {
  if (!o.item.url) return null;
  return (
    <a className="dr-src" href={o.item.url} target="_blank" rel="noreferrer">
      {o.brand?.label ?? L("Sayfası", "Its page")} <span aria-hidden>↗</span>
    </a>
  );
}

/** The wants an option answers ✓ and misses ⚠, its cancellation and its nearest place: one fact a line, the asks' order. */
function Facts({ o }: { o: OptionVM }) {
  const rows: { ok: "y" | "w" | "n"; text: string }[] = [
    ...o.checks.map((c) => ({ ok: c.ok ? ("y" as const) : ("w" as const), text: c.ok ? c.label : c.text || c.label })),
    ...(o.cancel ? [{ ok: (/Ücretsiz|Free/.test(o.cancel) ? "y" : "n") as "y" | "n", text: o.cancel }] : []),
    ...o.near.slice(0, 1).map((t) => ({ ok: "n" as const, text: t })),
  ];
  if (!rows.length) return null;
  return (
    <span className="dr-fts">
      {rows.map((r) => (
        <span key={r.text} className={`dr-ft ${r.ok}`}>
          {r.ok === "y" ? <Ic name="check" size={13} stroke={2.6} /> : r.ok === "w" ? <span aria-hidden>⚠</span> : <span aria-hidden>·</span>}
          <span>{r.text}</span>
        </span>
      ))}
    </span>
  );
}

function StayOption({ o, art, current, typical, why, onPick }: { o: OptionVM; art: string; current: boolean; typical: Typical | null; why: string | null; onPick: () => void }) {
  const p = optionPrice(o.price);
  const usual = p ? null : (typical?.(o) ?? null);
  return (
    <article className={`dr-op${current ? " cur" : ""}`} data-item-id={o.id}>
      <div className="dr-ph">
        <img className={o.image ? "ph" : "art"} src={o.image ?? art} alt="" />
        {o.ours && <span className="dr-badge">✨ {L("Önerimiz", "Our pick")}</span>}
        {o.item.url && (
          <a className="dr-site" href={o.item.url} target="_blank" rel="noreferrer">
            {o.brand?.label ?? L("Sayfası", "Its page")} <span aria-hidden>↗</span>
          </a>
        )}
      </div>
      <div className="dr-in">
        <span className="dr-r1">
          <Name o={o} />
          <Fit o={o} />
        </span>
        <span className="dr-r2">
          <Rating rating={o.rating} />
          {o.where && <span className="dr-dim">{o.where}</span>}
          <SourceBadge option={{ ...o, ours: false }} />
        </span>
        <Facts o={o} />
        <Why text={why} />
        {o.topics.length > 0 && (
          <p className="dr-rv">
            {L("Yorumlarda:", "Reviews:")}{" "}
            {o.topics.map((t, i) => (
              <b key={t.label} className={t.up ? "up" : "dn"}>
                {i > 0 ? ", " : ""}
                {t.label} {t.up ? "↑" : "↓"}
              </b>
            ))}
          </p>
        )}
      </div>
      <footer className="dr-f">
        {p ? (
          <span className="q-pr">
            <b>{p.amount}</b>
            {/* Saved without its dates: priced for these nights for now ("geçici"; its page opens with them). */}
            {(p.unit || o.price?.provisional) && (
              <small>
                {p.unit}
                {o.price?.provisional && <i className="z-prov">{p.unit ? " · " : ""}{L("geçici", "provisional")}</i>}
              </small>
            )}
          </span>
        ) : usual ? (
          <span className="q-pr" title={usual.title}>
            <b>{usual.amount}</b>
            <small>{usual.unit}</small>
          </span>
        ) : (
          <span className="dr-dim">{L("Fiyat yok", "No price")}</span>
        )}
        <Pick o={o} current={current} onPick={onPick} />
      </footer>
    </article>
  );
}

/** A flight on one day: its ticket, the hours in front (K82). */
function FlightOption({ o, vm, art, current, why, onPick }: { o: OptionVM; vm: IntentVM; art: string; current: boolean; why: string | null; onPick: () => void }) {
  const f = rowFace(o, vm.kind);
  return (
    <article className={`dr-op dr-tk${current ? " cur" : ""}`} data-item-id={o.id}>
      <header className="dr-th">
        <CarrierLogo mark={f.mark} art={art} />
        <span className="dr-tn">
          <Name o={{ ...o, title: f.name }} />
          <small>{[dayText(optionDay(o)), f.sub].filter(Boolean).join(" · ")}</small>
        </span>
        <SourceBadge option={{ ...o, ours: false }} />
        <Fit o={o} />
      </header>
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
      <Why text={why} />
      <Facts o={o} />
      <footer className="dr-f">
        <span className="q-pr">
          <b>{o.ticket?.total ?? f.price?.text ?? "–"}</b>
          {o.ticket?.each && <small>{L(`kişi başı ${o.ticket.each}`, `${o.ticket.each} each`)}</small>}
        </span>
        <span className="dr-fa">
          <SiteLink o={o} />
          <Pick o={o} current={current} onPick={onPick} />
        </span>
      </footer>
    </article>
  );
}

/** A flight among others on other days: what decides first (K83), the hours under it. */
function CompareOption({ o, vm, art, current, why, won, cheapest, people, bagSaid, onPick }: { o: OptionVM; vm: IntentVM; art: string; current: boolean; why: string | null; won: ReturnType<typeof winners>; cheapest: number | null; people: number; bagSaid: boolean; onPick: () => void }) {
  const f = rowFace(o, vm.kind);
  const total = totalAmount(o, people);
  const stops = o.item.flight?.stops;
  const bag = o.item.metrics?.checkedBagIncluded;
  const cell = (label: string, value: ReactNode, sub: ReactNode, cls: string, win: string | null) => (
    <span className={`dr-cc ${cls}`}>
      <small>{label}</small>
      <b>{value}</b>
      <span>{sub}</span>
      {win && <em className="dr-win">{win}</em>}
    </span>
  );
  return (
    <article className={`dr-op dr-tk dr-cmp${current ? " cur" : ""}`} data-item-id={o.id}>
      <header className="dr-th">
        <CarrierLogo mark={f.mark} art={art} />
        <span className="dr-tn">
          <Name o={{ ...o, title: f.name }} />
          <small>
            <strong>{dayText(optionDay(o))}</strong>
            {f.sub ? ` · ${f.sub}` : ""}
          </small>
        </span>
        <SourceBadge option={{ ...o, ours: false }} />
        <Fit o={o} />
      </header>
      <div className={`dr-ccs${bagSaid ? " c3" : ""}`}>
        {cell(L("FİYAT", "PRICE"), money(o, total) ?? "—", total != null && cheapest != null && total > cheapest ? <><i className="dr-dif">+{money(o, total - cheapest)}</i> {L("fazla", "more")}</> : o.ticket?.each ? L(`kişi başı ${o.ticket.each}`, `${o.ticket.each} each`) : " ", "", won.price === o.id ? L("en ucuz", "cheapest") : null)}
        {cell(L("SÜRE", "LENGTH"), f.duration ?? "—", L("kapıdan kapıya", "door to door"), "", won.mins === o.id ? L("en kısa", "shortest") : null)}
        {cell(L("AKTARMA", "STOPS"), stops == null ? "—" : stops === 0 ? L("direkt", "direct") : L(`${stops} aktarma`, `${stops} stop${stops > 1 ? "s" : ""}`), f.from && f.to ? `${f.from} → ${f.to}` : " ", f.stops?.tone === "warn" ? "w" : "", won.stops === o.id ? L("en az", "fewest") : null)}
        {!bagSaid && cell(L("BAGAJ", "BAG"), bag == null ? "—" : bag ? L("dahil", "included") : L("ek ücretli", "extra"), f.bag ?? " ", bag === false ? "w" : "", null)}
      </div>
      <Why text={why} />
      <Facts o={{ ...o, cancel: null, near: [] }} />
      <footer className="dr-f">
        <span className="dr-tl">
          {f.dep ?? "–"} {f.from ?? ""} → {f.arr ?? "–"} {f.to ?? ""}
        </span>
        <span className="dr-fa">
          <SiteLink o={o} />
          <Pick o={o} current={current} onPick={onPick} />
        </span>
      </footer>
    </article>
  );
}

/** A boat, a train, a bus: a timetable's row (K84). */
function SailingOption({ o, vm, current, onPick, icon }: { o: OptionVM; vm: IntentVM; current: boolean; onPick: () => void; icon: IconName }) {
  const f = rowFace(o, vm.kind);
  return (
    <article className={`dr-op dr-sail${current ? " cur" : ""}`} data-item-id={o.id}>
      <span className="dr-st" aria-hidden>
        <Ic name={icon} size={20} />
      </span>
      <div className="dr-sm">
        <span className="dr-sl">
          <b>{f.dep ?? "–"}</b>
          <i aria-hidden />
          <b>{f.arr ?? "–"}</b>
        </span>
        <span className="dr-ss">
          <strong>{dayText(optionDay(o))}</strong>
          {[f.duration, f.stops?.text, f.from && f.to ? `${f.from} → ${f.to}` : null].filter(Boolean).map((t) => ` · ${t}`).join("")}
        </span>
        <span className="dr-ss">
          <SourceBadge option={{ ...o, ours: false }} /> <SiteLink o={o} />
        </span>
      </div>
      <div className="dr-sp">
        <Fit o={o} />
        <b>{o.ticket?.total ?? f.price?.text ?? "–"}</b>
        {o.ticket?.each && <small>{L(`kişi başı ${o.ticket.each}`, `${o.ticket.each} each`)}</small>}
        <Pick o={o} current={current} onPick={onPick} />
      </div>
    </article>
  );
}

const MODE_ICON: Readonly<Record<string, IconName>> = { ferry: "ship", train: "train", bus: "bus", transfer: "car", car: "car", pass: "train" };

export function IntentDrawer({ vm, options, chosenId, art, links, typical, need, placeholder = null, people, onPick, onClose, onPano, onAsk, onOffer }: {
  vm: IntentVM;
  options: OptionVM[];
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
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<DrawerTab>("all");
  const [day, setDay] = useState<string | "all">("all");
  const ticketMode = vm.ticket?.mode ?? null;
  const family: "stay" | "flight" | "ticket" = vm.frame !== "ticket" ? "stay" : vm.kind === "flight" ? "flight" : "ticket";
  const [sort, setSort] = useState<SortKey>("fit");
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);
  const counts = useMemo(() => ({ all: options.length, mine: options.filter((o) => optionTab(o) === "mine").length, ai: options.filter((o) => optionTab(o) === "ai").length }), [options]);
  const inTab = drawerList(options, tab, "all", sort, people);
  const days = family === "flight" ? optionDays(inTab, people) : [];
  const list = drawerList(options, tab, day, sort, people);
  const cmp = compareMode(list, vm.kind);
  const won = cmp ? winners(list, people) : {};
  const cheapest = cmp ? (list.map((o) => totalAmount(o, people)).filter((n): n is number => n != null).sort((a, b) => a - b)[0] ?? null) : null;
  const bagSaid = cmp && bagAll(list);
  const best = (k: SortKey) => drawerList(list, "all", "all", k, people)[0] ?? null;
  const title = vm.head.route && vm.frame === "ticket" ? `${vm.head.route.from} → ${vm.head.route.to}` : headName(vm);
  const sub = [vm.head.kindWord, ...vm.head.parts].filter(Boolean).join(" · ");
  const pick = (o: OptionVM) => {
    onPick(o);
  };
  // Our pick's reasons, said once on its card (choice.ts, as the details over the card say them).
  const env = useCardEnv();
  const ours = options.find((o) => o.ours) ?? null;
  const reason = useMemo(() => {
    if (!ours) return null;
    const decision = decisionOf(env.decisions?.byGroup, ours.item);
    const ctx = env.decisions?.ctx;
    const choice = decision && ctx && decision.options.filter((d) => !d.excluded).length > 1 ? choiceOf(decision, ctx) : null;
    return pickReason(choice?.headline ?? null, ours.item.name);
  }, [ours, env.decisions]);
  const card = (o: OptionVM) => {
    const current = o.id === chosenId;
    const why = o.ours ? reason : null;
    const props = { o, vm, art, current, why, onPick: () => pick(o) };
    if (family === "stay") return <StayOption key={o.id} o={o} art={art} current={current} typical={typical} why={why} onPick={() => pick(o)} />;
    if (family === "flight") return cmp ? <CompareOption key={o.id} {...props} won={won} cheapest={cheapest} people={people} bagSaid={bagSaid} /> : <FlightOption key={o.id} {...props} />;
    return <SailingOption key={o.id} o={o} vm={vm} current={current} onPick={() => pick(o)} icon={MODE_ICON[ticketMode ?? "train"] ?? "train"} />;
  };
  const tabBtn = (k: DrawerTab, label: string, icon: IconName | null) => (
    <button key={k} type="button" role="tab" className="dr-tab" aria-selected={tab === k} onClick={() => (setTab(k), setDay("all"))}>
      {icon && <Ic name={icon} size={14} />}
      {label} <b>{counts[k]}</b>
    </button>
  );
  const node = (
    <>
      <div className="dr-scrim" onClick={onClose} aria-hidden />
      <aside className="dr" role="dialog" aria-modal="true" aria-labelledby={titleId} data-kind={vm.kind} data-intent={vm.key}>
        <div className="dr-h">
          <div className="dr-top">
            <span className="dr-t">
              <b id={titleId}>{title}</b>
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
          {vm.head.wants.length > 0 && (
            <div className="dr-wants" aria-label={L("İsteklerin", "What you asked for")}>
              <span>{L("İsteklerin", "You asked for")}</span>
              {vm.head.wants.map((w) => (
                <span key={w.label} className={`dr-want${w.must ? " req" : ""}`}>{w.label}</span>
              ))}
            </div>
          )}
          <div className="dr-tabs" role="tablist">
            {tabBtn("all", L("Tümü", "All"), null)}
            {tabBtn("mine", L("Kaydettiklerin", "Your saves"), "bookmark")}
            {tabBtn("ai", L("AI önerileri", "AI picks"), "spark")}
          </div>
          <div className="dr-ctl">
            <span className="dr-cnt">{L(`${list.length} seçenek`, `${list.length} options`)}</span>
            {days.length > 1 && (
              <label className="dr-sel">
                <Ic name="cal" size={14} />
                <select data-dsel aria-label={L("Gün", "Day")} value={day} onChange={(e) => setDay(e.target.value)}>
                  <option value="all">{L("Bütün günler", "Every day")}</option>
                  {days.map((d) => (
                    <option key={d.day} value={d.day}>
                      {dayText(d.day)}
                      {d.cheapest != null ? L(` · en ucuz ${formatPrice(d.cheapest, options[0]?.item.price?.currency ?? "EUR")}`, ` · from ${formatPrice(d.cheapest, options[0]?.item.price?.currency ?? "EUR")}`) : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!cmp && (
              <label className="dr-sel">
                <span>{L("Sırala", "Sort")}</span>
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
          {cmp && (
            <div className="dr-hl" role="group" aria-label={L("Sırala", "Sort")}>
              <span>{L("Farklı günler: neye göre sıralayayım?", "Different days: sort by what?")}</span>
              <span className="dr-seg">
                {(["fit", "price", "mins"] as SortKey[]).map((k) => {
                  const b = best(k);
                  const label = k === "fit" ? L("Sana en uygun", "Best for you") : k === "price" ? L("En ucuz", "Cheapest") : L("En kısa", "Shortest");
                  const said = !b ? "" : k === "fit" ? [fitText(b), rowFace(b, vm.kind).name].filter(Boolean).join(" · ") : k === "price" ? [money(b, totalAmount(b, people)), dayText(optionDay(b))].filter(Boolean).join(" · ") : [rowFace(b, vm.kind).duration, rowFace(b, vm.kind).name].filter(Boolean).join(" · ");
                  return (
                    <button key={k} type="button" className="dr-hlb" data-hl={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                      <small>{label}</small>
                      <b>{said || "—"}</b>
                    </button>
                  );
                })}
              </span>
              <span className={`dr-bag${bagSaid ? "" : " w"}`}>
                <BagIcon size={14} />
                {bagSaid ? L("Hepsinde bagaj dahil", "Bag included in all") : L(`${list.filter((o) => o.item.metrics?.checkedBagIncluded === true).length}/${list.length} seçenekte bagaj dahil`, `Bag included in ${list.filter((o) => o.item.metrics?.checkedBagIncluded === true).length} of ${list.length}`)}
              </span>
            </div>
          )}
          {list.length ? <div className={`dr-ops${family === "stay" ? " two" : ""}`}>{list.map(card)}</div> : <p className="dr-empty">{L("Bu sekmede seçenek yok.", "Nothing in this tab.")}</p>}
          {need && (
            <div className="dr-offers">
              <OfferRow key={need.key} need={need} onChoose={onOffer} placeholder={placeholder} chosen={chosenId != null} hasOptions={options.length > 0} />
            </div>
          )}
          <div className="dr-more">
            <span>
              <b>{L("Bulamadın mı?", "Didn't find it?")}</b>
              <small>{L("AI aynı isteklerle yeniden arasın ya da kendin ara; beğendiğini kaydet, buraya düşer.", "Let the AI look again with the same asks, or search yourself; what you save lands here.")}</small>
            </span>
            <span className="dr-mrow">
              {onAsk && (
                <button type="button" className="dr-ai" onClick={onAsk}>
                  <Ic name="spark" size={14} /> {L("AI yeniden arasın", "Ask the AI again")}
                </button>
              )}
              {links.map((l) => (
                <a key={l.id} className="dr-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <Mark color={l.color} letter={l.letter} small />
                  {l.name} <span aria-hidden>↗</span>
                </a>
              ))}
            </span>
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
