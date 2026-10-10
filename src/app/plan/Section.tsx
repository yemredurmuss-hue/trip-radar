// A section of the Plan (kategoriler-v4 .sec): one band of the plan's single white sheet, a hairline above
// it. The header is the same in every section — the line icon in the section's colour, the name, and on the
// right a thin bar of settled of all (green once complete), "3/4", the arrow — and opens and closes it. Under the
// name, its needs in stage words (v11: "1 rezerve · 2 seçildi · 1 aranıyor"). Open, "+ Ekle" joins the header, then the timeline
// of cards and, last, "Gizlenenler · N göster" for what's out of the way.
import type { ReactNode } from "react";
import { isIdeaSection, sectionProgress, stageLine, type CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { formatPrice } from "../../lib/items";
import { suggestionCount } from "../../lib/suggestions";
import { HoverTip } from "../HoverTip";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { HiddenList } from "./HiddenList";
import { SECTION_META } from "./sectionMeta";

export function Section({ section, allot = null, allotNum = null, open, onToggle, onAdd, suggestions = 0, children }: {
  section: CatSection;
  /** v11: its share of the trip's budget, "€500" ("€285 · €500 ayrıldı"). */
  allot?: string | null;
  /** The same share as a number and its currency: what's left of it shows in the budget's box. */
  allotNum?: { amount: number; currency: string } | null;
  open: boolean;
  onToggle: () => void;
  /** "+ Ekle" in the open header: this section's kind, no day. */
  onAdd: () => void;
  /** Its open suggestions: "1 öneri" in the header (never part of its "3/4"), shown open or closed. */
  suggestions?: number;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.id];
  const label = meta.label();
  const { total, complete } = sectionProgress(section);
  const ideas = section.ideas;
  // v11: the header says where its needs stand in stage words ("1 rezerve · 2 seçildi · 1 aranıyor"); the ideas and
  // Hazırlık count instead.
  const line = isIdeaSection(section.id) || section.id === "prep" ? null : section.id === "activity" ? activityLine(section) : stageLine(section.stages);
  const spent = isIdeaSection(section.id) || section.id === "prep" ? null : spentOf(section);
  // v11: the bar in two colours, booked (green) then chosen (amber), out of all of its needs.
  const st = section.stages;
  const booked = st.booked + st.ready + st.used;
  const chosen = st.planned;
  const needs = booked + chosen + st.search + st.options;
  const pctOf = (n: number) => (needs ? Math.round((n / needs) * 100) : 0);
  return (
    <section className={`cat-sec${open ? "" : " closed"}`} style={{ "--c": meta.color } as React.CSSProperties} aria-label={label} data-section={section.id}>
      <div className="cat-head" onClick={onToggle}>
        <button type="button" className="cat-title" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <span className="cat-ic" aria-hidden>
            <KindIcon kind={meta.icon} size={20} />
          </span>
          <span className="cat-tt">
            <b>
              {label}
              {total > 0 && <i className="cat-n">{total}</i>}
            </b>
            {line ? <small className="cat-st">{line}</small> : ideas && (section.entries.length || section.hidden.length) ? <small className="cat-st cat-ideas">{ideaCount(section.id, ideas, section.entries)}</small> : null}
          </span>
        </button>
        <span className="cat-end">
          {suggestions > 0 && <span className="sg-count">{suggestionCount(suggestions)}</span>}
          {/* Drawn only for something being read into it (arrive) or suggested: nothing to count yet. */}
          {!section.entries.length && !section.hidden.length ? null : ideas ? null : (
            <>
              {needs > 0 && (
                <span className={`cat-bar${complete ? " done" : ""}`} aria-hidden>
                  <span className="bk" style={{ width: `${pctOf(booked)}%` }} />
                  <span className="ch" style={{ width: `${pctOf(chosen)}%` }} />
                </span>
              )}
              {/* What's settled of all, said for a screen reader (the bar shows it). */}
              <span className="cat-count sr-only" aria-label={L(`${section.settled} / ${total} tamam`, `${section.settled} of ${total} settled`)}>
                {section.settled}
                <i>/{total}</i>
              </span>
              {(spent || allot) && (
                <HoverTip below align="right" className="cat-bud-tip" tip={budgetTip(section, allotNum)}>
                  <span className="cat-bud">
                    {spent && <b className="cat-spent">{spent}</b>}
                    {allot && <small className="cat-allot">{L(`${allot} ayrıldı`, `${allot} set aside`)}</small>}
                  </span>
                </HoverTip>
              )}
            </>
          )}
          <span className="cat-chev" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </span>
      </div>
      {open && (
        <div className="cat-body">
          {children}
          {section.hidden.length > 0 && <HiddenList things={section.hidden} />}
          {/* v11: the plan's head has the one "+ Ekle"; a section adds its own kind quietly at its end. */}
          {meta.templates.length > 0 && (
            <button type="button" className="cat-add" onClick={onAdd} aria-label={L(`${label}: ekle`, `${label}: add`)}>
              <UiIcon name="plus" size={13} />
              {L("Ekle", "Add")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** v11 Etkinlik ve turlar: "2 planda · 3 fikir" (what's chosen or booked, and the ideas waiting). */
function activityLine(section: CatSection): string | null {
  const records = section.entries.map((e) => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null)).filter((i): i is NonNullable<typeof i> => i != null);
  const planned = records.filter((i) => i.status === "chosen" || i.status === "booked").length;
  const ideas = records.length - planned;
  const parts = [planned ? L(`${planned} planda`, `${planned} on the plan`) : null, ideas ? L(`${ideas} fikir`, `${ideas} idea${ideas === 1 ? "" : "s"}`) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** v11: what's chosen and booked in a section, added up in its main currency ("€2.690"); null when nothing is priced. */
function spentOf(section: CatSection): string | null {
  const by = new Map<string, number>();
  for (const e of section.entries) {
    if (e.state !== "done" && e.state !== "book") continue;
    const p = e.row.price;
    if (!p || !p.currency || !(p.amount > 0)) continue;
    by.set(p.currency, (by.get(p.currency) ?? 0) + p.amount);
  }
  const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? formatPrice(Math.round(top[1]), top[0]) : null;
}

/** The header's money box: what's booked, what's chosen, what's left of the section's share (docs/mockups/ux-katmanli-arayuz). */
function budgetTip(section: CatSection, allot: { amount: number; currency: string } | null) {
  const sums = new Map<string, { booked: number; chosen: number }>();
  for (const e of section.entries) {
    if (e.state !== "done" && e.state !== "book") continue;
    const p = e.row.price;
    if (!p || !p.currency || !(p.amount > 0)) continue;
    const cur = sums.get(p.currency) ?? { booked: 0, chosen: 0 };
    if (e.state === "done") cur.booked += p.amount;
    else cur.chosen += p.amount;
    sums.set(p.currency, cur);
  }
  const top = [...sums.entries()].sort((a, b) => b[1].booked + b[1].chosen - (a[1].booked + a[1].chosen))[0];
  const money = (n: number, cur: string) => formatPrice(Math.round(n), cur);
  const line = (cls: string, label: string, text: string) => (
    <span className="tipx-line">
      <span>
        <i className={`d ${cls}`} aria-hidden />
        {label}
      </span>
      <b>{text}</b>
    </span>
  );
  const left = top && allot && allot.currency === top[0] ? allot.amount - top[1].booked - top[1].chosen : null;
  return (
    <>
      <b className="tipx-h">{L("Bu bölümün parası", "This part's money")}</b>
      {top && top[1].booked > 0 && line("bk", L("Rezerve", "Booked"), money(top[1].booked, top[0]))}
      {top && top[1].chosen > 0 && line("ch", L("Seçildi", "Chosen"), money(top[1].chosen, top[0]))}
      {left != null && line(left < 0 ? "ov" : "fr", left < 0 ? L("Aşıyor", "Over") : L("Boşta", "Free"), money(Math.abs(left), top![0]))}
      <span className="tipx-note">{L("Ayrılan pay, gezi bütçesinden beklenen maliyete göre bölünür.", "The share set aside is the trip's budget divided by what each part is likely to cost.")}</span>
    </>
  );
}

/**
 * An idea section's neutral count (0.35.3), never a "3/4": "5 fikir · 2 tanesi bir güne kondu", İlham "4 kayıt".
 * Done ones join it quietly ("· 1 yapıldı").
 */
export function ideaCount(id: CatSection["id"], { total, onDay, done }: NonNullable<CatSection["ideas"]>, entries: CatSection["entries"] = []): string {
  if (id === "inspo") return L(`${total} kayıt`, `${total} saved`);
  // v11 phase 4: Yapılacak şeyler counts its places, its restaurants and what's on the plan ("4 yer · 4 restoran · 3 planda").
  if (id === "todo") {
    const records = entries.map((e) => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null)).filter((i): i is NonNullable<typeof i> => i != null);
    const food = records.filter((i) => i.category === "food").length;
    const planned = records.filter((i) => !i.doneAt && (i.status === "chosen" || i.status === "booked" || Boolean(i.dates.start))).length;
    const parts = records.length - food ? [L(`${records.length - food} yer`, `${records.length - food} place${records.length - food === 1 ? "" : "s"}`)] : [];
    if (food) parts.push(L(`${food} restoran`, `${food} restaurant${food === 1 ? "" : "s"}`));
    if (planned) parts.push(L(`${planned} planda`, `${planned} on the plan`));
    if (done) parts.push(L(`${done} yapıldı`, `${done} done`));
    return parts.join(" · ");
  }
  const parts = [L(`${total} fikir`, `${total} idea${total === 1 ? "" : "s"}`)];
  if (onDay) parts.push(L(`${onDay} tanesi bir güne kondu`, `${onDay} on a day`));
  if (done) parts.push(id === "food" ? L(`${done} gidildi`, `${done} visited`) : L(`${done} yapıldı`, `${done} done`));
  return parts.join(" · ");
}
