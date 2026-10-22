// The stay family's fixed frame (plan v13, docs/superpowers/specs/2026-10-21-plan-niyet-karti-v13-design.md K79–K80: a stay,
// an eSIM, insurance) under the intent's roof (IntentHead): the picture (148) | the name and one line (64) | the foot (58:
// the price or the state on the left, one main action on the right). The same frame in every state:
//   Önerimiz   price · "Bunu seç" (B2; the other options open from the card, IntentDrawer);
//   Seçildi    price · "Rezerve et ↗" / "Satın al ↗", then "Aldın mı? ✓ Evet · Henüz değil" (K80);
//   Alındı     the green seal: "€900 ödendi" (B10) or "Ne kadar ödedin?" (P3) and "Onaylandı"; "Rezervasyonu aç" opens the
//              booking's details (its code, its file); a file missing near the day says "Belge eksik · ekle" (B15);
//   Ayarlandı  sorted out ("sen hallettin"), Dahil covered by another booking (its words, and the button that goes to it);
//   Aranıyor   the kind's drawing, the estimate, "Kendin ara" (two sites) and "Seçenek bul" (the AI looks, E13).
// A record's name and price edit where they stand (C2, inside the box's InlineEdit); elsewhere they're plain text.
import { useState, type ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { locative } from "../../../lib/i18nText";
import { bookWord, docWord, emptyLine, emptyTitle, headName, sidePrice, type FrameForm, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import type { RegionHint } from "../../../lib/regionHints";
import { formatPrice } from "../../../lib/items";
import { typicalNight } from "../../../lib/stayPicks";
import { Editable, useInlineEdit } from "../../cards/InlineEdit";
import { useCardEnv } from "../../cards/PlanCard";
import { Ic, Mark } from "./icons";
import { Rating, SourceBadge } from "./OptionCompact";

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
  /** The details layer over the frame (null: no details to show); "Rezervasyonu aç" opens it on a booking. */
  info: { open: boolean; toggle: () => void } | null;
  detail: ReactNode;
  /** The search began and nothing came within its minute: the thin line under "Seçenek bul" (E15). */
  quiet: boolean;
  /** The card's picture and lines open the options beside the plan (IntentDrawer, K82); null with nothing to open. */
  onOpen?: (() => void) | null;
  on: {
    take: () => void;
    got: () => void;
    change: (() => void) | null;
    openDoc: (() => void) | null;
    addDoc: () => void;
    /** A file dropped on the ticket's last-step zone (its booking's confirmation, its e-ticket). */
    dropDoc?: ((files: File[]) => Promise<void> | void) | null;
    ask: (() => void) | null;
    edit: () => void;
    unarrange: (() => void) | null;
    /** An eSIM bought and not on the phone yet: "Kurdum" (K87); null otherwise. */
    installed?: (() => void) | null;
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

/** Whole days from today to an ISO day (the stamp "Girişe 87 gün"); null without a day or once it has passed. */
export function daysUntil(day: string | null, today: string): number | null {
  if (!day) return null;
  const n = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The frame's zones (K79): the picture, the name and one line, the foot. The picture and the lines open the options. */
export function Zones({ cls = "", media, photo, title, meta, foot, primary, row = null, detail, onOpen = null, titleEdits = true }: {
  cls?: string;
  media: ReactNode;
  photo: boolean;
  title: string;
  meta: ReactNode;
  /** The foot's left: the price, the state, the sites to search. */
  foot: ReactNode;
  /** The foot's one main action. */
  primary: ReactNode;
  /** A small second action beside it ("Henüz değil", "Değiştir"). */
  row?: ReactNode;
  detail: ReactNode;
  onOpen?: (() => void) | null;
  titleEdits?: boolean;
}) {
  const open = onOpen ? { onClick: onOpen } : {};
  return (
    <div className={`z-f z-c z13${cls}`}>
      <div className={`z-m${photo ? "" : " art"}${onOpen ? " z-tap" : ""}`} {...open}>
        {media}
      </div>
      <div className={`z-i${onOpen ? " z-tap" : ""}`} {...open}>
        <h3 className="z-t" title={title}>
          {titleEdits ? <Editable field="name">{title}</Editable> : title}
        </h3>
        <span className="z-l1">{meta}</span>
      </div>
      <div className="z-s">
        <div className="z-top">{foot}</div>
        <div className="z-bt">
          {row && <div className="z-row">{row}</div>}
          {primary}
        </div>
      </div>
      {detail}
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

/** The option's one line under its name: its rating, its short cancellation, then the wants it checks (✓ ✕). */
function optionMeta(o: OptionVM) {
  return (
    <>
      <Rating rating={o.rating} />
      {o.cancel && <span className={`z-chip ${cancelTone(o.cancel)}`}>{o.cancel}</span>}
      {o.checks.map((c) => (
        <span key={c.label} className={`z-chip ${c.ok ? "y" : "n"}`} title={c.text}>
          {c.ok ? "✓" : "✕"} {c.label}
        </span>
      ))}
      {!o.rating && !o.cancel && !o.checks.length && o.where && <span className="z-dim">{o.where}</span>}
    </>
  );
}

const Picture = ({ o, art, children }: { o: OptionVM | null; art: string; children?: ReactNode }) => (
  <>
    <img className={o?.image ? "ph" : undefined} src={o?.image ?? art} alt="" />
    {children}
  </>
);

/** The site the page is on, at the picture's corner (as Booking's own cards say it). */
function SiteBadge({ o, page }: { o: OptionVM; page: string | null }) {
  const href = page ?? o.item.url;
  if (!o.brand && !href) return null;
  const label = o.brand?.label ?? L("Sayfası", "Its page");
  return href ? (
    <a className="z-site" href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={L(`${label} sitesinde aç`, `Open on ${label}`)}>
      {label} <span aria-hidden>↗</span>
    </a>
  ) : (
    <span className="z-site">{label}</span>
  );
}

/** "Aldın mı? ✓ Evet · Henüz değil" once the site was opened from "Rezerve et" (K80). */
export function GotAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <span className="z-gotq">
      <span>{L("Aldın mı?", "Did you book it?")}</span>
      <button type="button" className="q-got" onClick={onYes}>
        <Ic name="check" size={13} stroke={2.6} /> {L("Evet", "Yes")}
      </button>
      <button type="button" className="q-chg" onClick={onNo}>
        {L("Henüz değil", "Not yet")}
      </button>
    </span>
  );
}

export function FrameCard({ vm, form, art, page, links, hints, info, detail, quiet, on, onCover = null, onAgree = null, onOpen = null }: FrameCardProps) {
  const o = vm.chosen;
  const edit = useInlineEdit();
  const env = useCardEnv();
  const [asked, setAsked] = useState(false);
  const layer = info?.open ? detail : null;
  if ((form === "suggested" || form === "chosen") && o) {
    const brand = o.brand?.label ?? null;
    let primary: ReactNode;
    let row: ReactNode = null;
    if (form === "suggested") {
      primary = (
        <button type="button" className="q-pick q-take" onClick={on.take}>
          {L("Bunu seç", "Pick this")}
        </button>
      );
    } else if (page && asked) {
      primary = <GotAsk onYes={on.got} onNo={() => setAsked(false)} />;
    } else if (page) {
      primary = (
        <a className="q-cta" href={page} target="_blank" rel="noreferrer" onClick={() => setAsked(true)} title={brand ? L(`${brand} sitesinde aç`, `Open on ${brand}`) : undefined}>
          {o.brand && <Mark color={o.brand.color ?? "#6b6f80"} letter={[...o.brand.label][0] ?? ""} small />}
          <span>{bookWord(vm.kind)}</span>
          <span className="q-ext">↗</span>
        </a>
      );
    } else {
      primary = (
        <button type="button" className="q-pick q-take" onClick={on.got}>
          ✓ {L("Aldım", "Got it")}
        </button>
      );
    }
    if (form === "chosen" && vm.kind === "esim" && on.installed) row = <button type="button" className="q-chg" onClick={on.installed}>{L("Kurdum", "Installed it")}</button>;
    return (
      <Zones
        cls={form === "suggested" ? " sg" : " ch"}
        onOpen={onOpen}
        media={
          <Picture o={o} art={art}>
            {/* Our pick's chip says "Önerimiz" already (the roof); the picture says who saved anything else. */}
            {!(form === "suggested" && o.ours) && <SourceBadge option={o} />}
            <SiteBadge o={o} page={page} />
          </Picture>
        }
        photo={Boolean(o.image)}
        title={o.title}
        meta={optionMeta(o)}
        foot={<Price o={o} />}
        primary={primary}
        row={row}
        detail={layer}
      />
    );
  }
  if (form === "booked" && o) {
    const a = vm.access;
    const doc = docWord(vm.kind);
    const days = daysUntil(vm.head.date, env.today);
    const esimLeft = vm.kind === "esim" && o.item.installedAt == null;
    // P3 (F28): no price on a booking: "Ne kadar ödedin?" opens the price, which the budget then counts.
    const paid = (
      <span className="z-conf">
        <span className="z-seal" aria-hidden>
          <Ic name="check" size={16} stroke={3} />
        </span>
        <span className="z-cft">
          <b className={`z-paid${vm.paid ? "" : " ask"}`}>
            <Editable field="price">{vm.paid ?? ""}</Editable>
          </b>
          <small>{esimLeft ? L("Alındı · kurulmadı", "Bought · not installed") : vm.kind === "esim" ? L("Kuruldu", "Installed") : L("Onaylandı", "Confirmed")}</small>
        </span>
      </span>
    );
    const primary = esimLeft && on.installed ? (
      <button type="button" className="q-got q-inst" onClick={on.installed}>
        <Ic name="check" size={13} stroke={2.6} /> {L("Kurdum", "Installed it")}
      </button>
    ) : (
      <button type="button" className="q-got q-bopen" onClick={info ? info.toggle : (on.openDoc ?? on.addDoc)}>
        {vm.kind === "insurance" ? L("Poliçeyi aç", "Open the policy") : vm.kind === "esim" ? doc.open : L("Rezervasyonu aç", "Open the booking")}
      </button>
    );
    return (
      <Zones
        cls=" bk"
        onOpen={onOpen}
        media={
          <Picture o={o} art={art}>
            <SiteBadge o={o} page={a?.links.page ?? null} />
            {days != null && (
              <span className="z-dleft">
                <Ic name="cal" size={13} /> {vm.kind === "stay" ? L(`Girişe ${days} gün`, `${days} days to check-in`) : L(`${days} gün kaldı`, `${days} days to go`)}
              </span>
            )}
            {a?.docMissing && (
              <button type="button" className="z-docw" onClick={(e) => (e.stopPropagation(), on.addDoc())}>
                ⚠ {L("Belge eksik · ekle", "Document missing · add")}
              </button>
            )}
          </Picture>
        }
        photo={Boolean(o.image)}
        title={o.title}
        meta={a?.when ? <span className="q-aw"><Ic name="cal" size={13} />{a.when}</span> : optionMeta(o)}
        foot={paid}
        primary={primary}
        detail={layer}
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
      <Zones
        cls={inc ? " inc" : " ar"}
        onOpen={onOpen}
        media={<Picture o={o} art={art} />}
        photo={Boolean(o?.image)}
        title={title}
        meta={
          <>
            <span className={inc ? "z-inc" : "z-gr"}>{inc && <Ic name="check" size={13} stroke={3} />} {word}</span>
            {why && <span className="z-dim">· {why}</span>}
          </>
        }
        foot={
          (o?.price || edit?.open === "price") ? (
            <span className="z-paid">
              <Editable field="price">{o?.price?.text}</Editable>
            </span>
          ) : (
            <span className="z-dim">{vm.head.parts.join(" · ")}</span>
          )
        }
        primary={
          inc ? (
            onCover && vm.cover ? (
              <button type="button" className="q-got z-goinc" onClick={onCover}>
                {vm.cover.open} ›
              </button>
            ) : null
          ) : !o?.price && edit?.open !== "price" && o ? (
            <button type="button" className="q-got" onClick={() => (edit?.fields.includes("price") ? edit.go("price") : on.edit())}>
              {L("Fiyat ekle", "Add the price")}
            </button>
          ) : null
        }
        row={on.unarrange && <button type="button" className="q-chg" onClick={on.unarrange}>{L("Değiştir", "Change")}</button>}
        detail={layer}
      />
    );
  }
  // Aranıyor: nothing to choose yet. Only what is known is written (C19).
  const line = emptyLine(vm);
  const sites = links.slice(0, 2);
  return (
    <Zones
      cls=" em"
      onOpen={onOpen}
      media={
        <span className="z-ph0">
          <img src={art} alt="" />
          {(vm.routeDraft && vm.note) || vm.note ? <p className="z-why">{(vm.routeDraft && vm.note) || vm.note}</p> : null}
        </span>
      }
      photo={false}
      title={emptyTitle(vm)}
      meta={
        <>
          {line && <span className="q-est">{line}</span>}
          {hints.map((h) => (
            <a key={h.area} className="z-rg" href={(h as RegionHint & { url?: string | null }).url ?? links[0]?.url ?? undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={links[0] ? L(`${h.area} · ${locative(links[0].name)} ara`, `${h.area} · search ${links[0].name}`) : h.area}>
              {h.area}
              {h.nightly != null && <small>{formatPrice(h.nightly, h.currency)}</small>}
            </a>
          ))}
          {!line && !hints.length && vm.head.wants.map((w) => (
            <span key={w.label} className={`z-want${w.must ? " req" : ""}`}>{w.label}</span>
          ))}
          {quiet && on.ask && (
            <small className="z-aierr">
              {L("Henüz sonuç gelmedi", "Nothing came back yet")} ·{" "}
              <button type="button" className="z-retry" onClick={(e) => (e.stopPropagation(), on.ask?.())}>
                {L("Tekrar dene", "Try again")}
              </button>
            </small>
          )}
        </>
      }
      foot={
        sites.length > 0 && (
          <span className="z-pis" aria-label={L("Kendin ara", "Search yourself")}>
            {sites.map((l) => (
              <a key={l.id} className="z-pi" href={l.url} target="_blank" rel="noopener noreferrer" title={L(`${locative(l.name)} ara`, `Search ${l.name}`)} aria-label={L(`${locative(l.name)} ara`, `Search ${l.name}`)}>
                <Mark color={l.color} letter={l.letter} />
                <span className="z-pin">{l.name}</span>
              </a>
            ))}
          </span>
        )
      }
      primary={
        onAgree ? (
          <AgreeRoute onAgree={onAgree} />
        ) : (
          on.ask && (
            <button type="button" className="q-ai" onClick={on.ask}>
              <Ic name="search" size={15} /> {L("Seçenek bul", "Find options")}
            </button>
          )
        )
      }
      row={onAgree && on.ask ? <button type="button" className="q-chg" onClick={on.ask}>{L("Seçenek bul", "Find options")}</button> : null}
      detail={null}
    />
  );
}
