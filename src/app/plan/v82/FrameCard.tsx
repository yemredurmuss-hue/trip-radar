// The stay family's fixed frame (plan v82 "niyet kutusu standardı": a stay, an eSIM, insurance): the picture (196) | four
// lines (the site and its rating or the state, the name, where or when, the chips) | the side column (232: the price or
// the code on top, the main action and a second row under it). The same frame in every state (F §2):
//   Önerimiz   price · "Bunu seç" · Değiştir and the site ↗ (B11: the site only opens the page);
//   Seçildi    price · "Rezerve et ↗" / "Satın al ↗" · "✓ Aldım" and Değiştir;
//   Alındı     the code and copy, "€900 ödendi" (B10), the file or a dashed "Onayı ekle", check-in, check-out, the address;
//   Ayarlandı  sorted out ("sen hallettin"), Dahil covered by another booking (its words, and the button that goes to it:
//              "Festival biletini aç");
//   Aranıyor   an empty picture, the estimate, the areas, "Kendin ara" and "AI'dan öner" (and its thin line when nothing came).
// A record's name and price edit where they stand (C2, inside the box's InlineEdit); elsewhere they're plain text.
import type { ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { locative } from "../../../lib/i18nText";
import { bookedWhen, bookedWord, bookWord, codeLabel, docWord, emptyLine, emptyTitle, headName, sidePrice, type FrameForm, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import type { RegionHint } from "../../../lib/regionHints";
import { formatPrice } from "../../../lib/items";
import { typicalNight } from "../../../lib/stayPicks";
import { Editable, useInlineEdit } from "../../cards/InlineEdit";
import { CopyCode } from "./DetailLayer";
import { Ic, Mark } from "./icons";
import { BrandChip, Rating, SourceBadge } from "./OptionCompact";

/** A short cancellation's tone (the chip's colour): free green, a partial refund amber, none red. */
const cancelTone = (text: string) => (text === L("Ücretsiz iptal", "Free cancellation") ? "ok" : /^(Kısmi|Partial)/.test(text) ? "warn" : "no");

export interface FrameCardProps {
  vm: IntentVM;
  form: Exclude<FrameForm, "options">;
  /** The kind's drawing, for a frame with no photo. */
  art: string;
  /** "Rezerve et ↗"'s page (with the need's nights when it was saved without them). */
  page: string | null;
  links: SelfSearch[];
  hints: RegionHint[];
  /** The ⓘ and the layer it opens over the frame (null: no details to show). */
  info: { open: boolean; toggle: () => void } | null;
  detail: ReactNode;
  /** The search began and nothing came within its minute: the thin line under "AI'dan öner" (E15). */
  quiet: boolean;
  on: {
    take: () => void;
    got: () => void;
    change: (() => void) | null;
    openDoc: (() => void) | null;
    addDoc: () => void;
    ask: (() => void) | null;
    edit: () => void;
    unarrange: (() => void) | null;
  };
  /** Dahil: goes to what covers it ("Festival biletini aç"); null when it isn't on the plan. */
  onCover?: (() => void) | null;
  /** D5: the AI's route nobody agreed yet: "Rotayı onayla" is the frame's button (the search goes on as before). */
  onAgree?: (() => void) | null;
}

/** D5: the main button of an intent made from the AI's route nobody agreed yet. */
export function AgreeRoute({ onAgree }: { onAgree: () => void }) {
  return (
    <button type="button" className="q-pick q-take q-agree" onClick={onAgree}>
      {L("Rotayı onayla", "Agree the route")}
    </button>
  );
}

function Card({ cls = "", info, media, photo, l1, title, l2, more = null, l3, top, primary, row, detail }: {
  cls?: string;
  info: FrameCardProps["info"];
  media: ReactNode;
  photo: boolean;
  l1: ReactNode;
  title: string;
  l2: ReactNode;
  /** Lines under l2 (a stay's nearby places and what its reviews say); none, nothing drawn. */
  more?: ReactNode;
  l3: ReactNode;
  top: ReactNode;
  primary: ReactNode;
  row: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className={`z-f z-c${cls}`}>
      {info && (
        <button type="button" className="z-ib q-inf" aria-label={L(`${title}: ayrıntı`, `${title}: details`)} aria-expanded={info.open} title={L("Ayrıntı", "Details")} onClick={info.toggle}>
          <i>i</i>
        </button>
      )}
      <div className={`z-m${photo ? "" : " art"}`}>{media}</div>
      <div className="z-i">
        <span className="z-l1">{l1}</span>
        <h3 className="z-t" title={title}>
          <Editable field="name">{title}</Editable>
        </h3>
        <span className="z-l2">{l2}</span>
        {more}
        <span className="z-l3">{l3}</span>
      </div>
      <div className="z-s">
        <div className="z-top">{top}</div>
        <div className="z-bt">
          {primary}
          <div className="z-row">{row}</div>
        </div>
      </div>
      {info?.open && detail}
    </div>
  );
}

function Price({ o }: { o: OptionVM }) {
  const p = sidePrice(o.price);
  // 0.39.0: a hotel chosen with no price for its dates says its source's usual range ("tipik €21–64 / gece"), as its card did.
  const usual = p ? null : typicalNight(o.item.typicalNight);
  // One child or none: with neither, Editable says "Fiyat ekle" (two empty children read as something, drawn as nothing).
  const shown = p ? (
    <span className="q-pr big">
      <b>{p.big}</b>
      {p.small && <small>{p.small}</small>}
    </span>
  ) : usual ? (
    <span className="q-pr big" title={usual.title}>
      <b>{usual.amount}</b>
      <small>{usual.unit}</small>
    </span>
  ) : null;
  return <Editable field="price">{shown}</Editable>;
}

/** The option's own lines: its site and rating, where it is, the short cancellation and the wants checked (✓ ✕, two at most). */
function optionLines(o: OptionVM) {
  return {
    l1: (
      <>
        <BrandChip brand={o.brand} />
        <Rating rating={o.rating} />
      </>
    ),
    l2: o.where,
    more: o.near.length || o.topics.length ? (
      <>
        {o.near.length > 0 && (
          <span className="z-near">
            {o.near.map((t) => <span key={t}>{t}</span>)}
          </span>
        )}
        {o.topics.length > 0 && (
          <span className="z-tops">
            {L("Yorumlarda:", "Reviews:")}{" "}
            {o.topics.map((t, i) => (
              <b key={t.label} className={t.up ? "up" : "dn"}>
                {i > 0 && (o.topics[i - 1].up !== t.up ? " · " : " ")}
                {t.label} {t.up ? "↑" : "↓"}
              </b>
            ))}
          </span>
        )}
      </>
    ) : null,
    l3: (
      <>
        {o.cancel && <span className={`z-chip ${cancelTone(o.cancel)}`}>{o.cancel}</span>}
        {o.checks.map((c) => (
          <span key={c.label} className={`z-chip ${c.ok ? "y" : "n"}`} title={c.text}>
            {c.ok ? "✓" : "✕"} {c.label}
          </span>
        ))}
      </>
    ),
  };
}

const Picture = ({ o, art, children }: { o: OptionVM | null; art: string; children?: ReactNode }) => (
  <>
    <img className={o?.image ? "ph" : undefined} src={o?.image ?? art} alt="" />
    {children}
  </>
);

export function FrameCard({ vm, form, art, page, links, hints, info, detail, quiet, on, onCover = null, onAgree = null }: FrameCardProps) {
  const o = vm.chosen;
  const edit = useInlineEdit();
  if ((form === "suggested" || form === "chosen") && o) {
    const lines = optionLines(o);
    const brand = o.brand?.label ?? null;
    const primary =
      form === "suggested" ? (
        <button type="button" className="q-pick q-take" onClick={on.take}>
          {L("Bunu seç", "Pick this")}
        </button>
      ) : page ? (
        <a className="q-cta" href={page} target="_blank" rel="noreferrer" title={brand ? L(`${brand} sitesinde aç`, `Open on ${brand}`) : undefined}>
          {o.brand && <Mark color={o.brand.color ?? "#6b6f80"} letter={[...o.brand.label][0] ?? ""} small />}
          <span>{bookWord(vm.kind)}</span>
          <span className="q-ext">↗</span>
        </a>
      ) : (
        <button type="button" className="q-pick q-take" onClick={on.got}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    const row =
      form === "suggested" ? (
        <>
          {on.change && <button type="button" className="q-chg" onClick={on.change}>{L("Değiştir", "Change")}</button>}
          {o.item.url && (
            <a className="q-srcl" href={page ?? o.item.url} target="_blank" rel="noreferrer">
              {brand ?? L("Sayfası", "Its page")} ↗
            </a>
          )}
        </>
      ) : (
        <>
          {page && (
            <button type="button" className="q-got" onClick={on.got}>
              <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
            </button>
          )}
          {on.change && <button type="button" className="q-chg" onClick={on.change}>{L("Değiştir", "Change")}</button>}
        </>
      );
    return (
      <Card info={info} media={<Picture o={o} art={art}><SourceBadge option={o} /></Picture>} photo={Boolean(o.image)} title={o.title} {...lines} top={<Price o={o} />} primary={primary} row={row} detail={detail} />
    );
  }
  if (form === "booked" && o) {
    const a = vm.access;
    const label = a ? codeLabel(a) : null;
    const when = a ? bookedWhen(o.item, a, vm.kind) : null;
    const doc = docWord(vm.kind);
    const host = a?.links.host;
    const map = a?.links.map;
    return (
      <Card
        cls=" bk"
        info={info}
        media={<Picture o={o} art={art}><span className="z-stamp" aria-hidden><Ic name="check" size={18} stroke={3} /></span></Picture>}
        photo={Boolean(o.image)}
        l1={
          <>
            {/* An eSIM put on the phone says so ("Kuruldu"; its ⋯ takes it back). */}
            <span className="z-ok"><Ic name="check" size={13} stroke={3} /> {vm.kind === "esim" && o.item.installedAt != null ? L("Kuruldu", "Installed") : bookedWord(vm.kind)}</span>
            {o.brand && <span className="z-dim">· {o.brand.label}</span>}
          </>
        }
        title={o.title}
        l2={when && <span className="q-aw"><Ic name="cal" size={13} />{when}</span>}
        l3={a?.where && <span className="q-aw"><Ic name="pin" size={13} />{a.where}</span>}
        top={
          <>
            {a?.code && label && (
              <>
                <span className="z-lbl">{label}</span>
                <CopyCode value={a.code.value} label={label} className="q-code st" />
              </>
            )}
            {/* P3 (F28): no price on a booking: "Ne kadar ödedin?" opens the price, which the budget then counts. */}
            <small className={`z-paid${vm.paid ? "" : " ask"}`}>
              <Editable field="price">{vm.paid ?? ""}</Editable>
            </small>
            {a?.docMissing && <small className="z-docw">{L("belge yok", "no document")}</small>}
          </>
        }
        primary={
          on.openDoc ? (
            <button type="button" className="q-open" onClick={on.openDoc}>
              <Ic name="clip" size={14} stroke={2.2} /> {doc.open}
            </button>
          ) : (
            <button type="button" className="q-doc add" onClick={on.addDoc}>
              <Ic name="clip" size={13} stroke={2.2} /> {doc.add}
            </button>
          )
        }
        row={
          <>
            {map && <a className="q-alk" href={map} target="_blank" rel="noreferrer">{L("Haritada aç ↗", "Open the map ↗")}</a>}
            {host && <a className="q-alk" href={host} target="_blank" rel="noreferrer">{vm.kind === "stay" ? L("Otele yaz ↗", "Write to the hotel ↗") : L("Yaz ↗", "Write ↗")}</a>}
          </>
        }
        detail={detail}
      />
    );
  }
  if (form === "arranged" || form === "included") {
    const inc = form === "included";
    const word = inc ? L("Dahil", "Included") : L("Ayarlandı", "Arranged");
    const title = o?.title ?? headName(vm);
    // Dahil says what covers it ("festival biletiyle"), else how it was arranged.
    const why = inc ? (vm.cover?.by ?? vm.note) : vm.note;
    return (
      <Card
        cls={inc ? " inc" : " ar"}
        info={info}
        media={<Picture o={o} art={art} />}
        photo={Boolean(o?.image)}
        l1={
          <>
            <span className={inc ? "z-inc" : "z-gr"}>{inc && <Ic name="check" size={13} stroke={3} />} {word}</span>
            {why && <span className="z-dim">· {why}</span>}
          </>
        }
        title={title}
        l2={vm.head.parts.join(" · ")}
        l3={null}
        top={
          <>
            <span className={inc ? "z-inc" : "z-gr"}>{inc && <Ic name="check" size={13} stroke={3} />} {word}</span>
            {why && <small className="z-note">{why}</small>}
            {(o?.price || edit?.open === "price") && (
              <span className="z-paid">
                <Editable field="price">{o?.price?.text}</Editable>
              </span>
            )}
          </>
        }
        primary={
          inc ? (
            onCover && vm.cover ? (
              <button type="button" className="q-doc add z-goinc" onClick={onCover}>
                {vm.cover.open} ›
              </button>
            ) : null
          ) : !o?.price && edit?.open !== "price" ? (
            <button type="button" className="q-doc add" onClick={() => (edit?.fields.includes("price") ? edit.go("price") : on.edit())}>
              {L("Fiyat ekle", "Add the price")}
            </button>
          ) : null
        }
        row={on.unarrange && <button type="button" className="q-chg" onClick={on.unarrange}>{L("Değiştir", "Change")}</button>}
        detail={detail}
      />
    );
  }
  // Aranıyor: nothing to choose yet. Only what is known is written (C19).
  const line = emptyLine(vm);
  return (
    <Card
      cls=" em"
      info={null}
      media={
        <span className="z-ph0">
          <img src={art} alt="" />
          <span className="z-srch" aria-hidden><Ic name="search" size={18} stroke={2.2} /></span>
        </span>
      }
      photo={false}
      l1={<span className="z-dim">{(vm.routeDraft && vm.note) || L("Henüz seçenek yok", "No options yet")}</span>}
      title={emptyTitle(vm)}
      l2={line && <span className="q-est">{line}</span>}
      l3={hints.map((h) => (
        <a key={h.area} className="z-rg" href={links[0]?.url ?? undefined} target="_blank" rel="noreferrer" title={links[0] ? L(`${h.area} · ${locative(links[0].name)} ara`, `${h.area} · search ${links[0].name}`) : h.area}>
          {h.area}
          {h.nightly != null && <small>{formatPrice(h.nightly, h.currency)}</small>}
        </a>
      ))}
      top={
        links.length > 0 && (
          <>
            <small className="z-lbl">{L("Kendin ara", "Search yourself")}</small>
            <span className="z-pis">
              {links.map((l) => (
                <a key={l.id} className="z-pi" href={l.url} target="_blank" rel="noopener noreferrer" title={L(`${locative(l.name)} ara`, `Search ${l.name}`)} aria-label={L(`${locative(l.name)} ara`, `Search ${l.name}`)}>
                  <Mark color={l.color} letter={l.letter} />
                </a>
              ))}
            </span>
          </>
        )
      }
      primary={
        onAgree ? (
          <AgreeRoute onAgree={onAgree} />
        ) : (
          on.ask && (
            <button type="button" className="q-ai" onClick={on.ask}>
              <Ic name="spark" size={15} /> {L("AI'dan öner", "Ask the AI")}
            </button>
          )
        )
      }
      row={
        quiet && on.ask ? (
          <small className="z-aierr">
            {L("Henüz sonuç gelmedi", "Nothing came back yet")} ·{" "}
            <button type="button" className="z-retry" onClick={on.ask}>
              {L("Tekrar dene", "Try again")}
            </button>
          </small>
        ) : (
          onAgree &&
          on.ask && (
            <button type="button" className="q-chg" onClick={on.ask}>
              {L("AI'dan öner", "Ask the AI")}
            </button>
          )
        )
      }
      detail={null}
    />
  );
}
