// A category of the Plan (plan v82): one card, its closed row (v82/CategoryRow, 78 px, the same open or closed) and, open,
// its body folding in under it on a grid (m-bolum: 260 ms, the cards 80 ms late; shut, it folds back before it goes). The
// categories drawn the new way (CategoryPlan's V82_SECTIONS) put their intents on a rail in it; the others keep their old
// body as it was (its timeline of cards, "Gizlenenler · N göster"). At its end "+ Konaklama ekle" adds its own kind (B6).
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { formatPrice } from "../../lib/items";
import { useFold } from "../motion";
import { sectionAdding, sectionEditing, sectionLooking, type LookStore } from "../../lib/looking";
import { lookWord } from "../../lib/stageWords";
import { UiIcon } from "../cards/Silhouettes";
import { HiddenList } from "./HiddenList";
import { SECTION_META } from "./sectionMeta";
import { CategoryRow, type RowView } from "./v82/CategoryRow";

/** The word of a category's own "+ … ekle" where it isn't its short name (as drawn: "+ Yer ekle", "+ Belge ekle"). */
const ADD_WORD: Partial<Record<CatSection["id"], () => string>> = { todo: () => L("Yer", "Place"), other: () => L("Belge", "Document") };
/** The category's own add in English, said as a phrase ("Add a stay", "Add transport"). */
const ADD_EN: Partial<Record<CatSection["id"], string>> = {
  flight: "Add a flight",
  stay: "Add a stay",
  transport: "Add transport",
  activity: "Add an activity",
  todo: "Add a place",
  food: "Add a restaurant",
  other: "Add a document",
};

/** One full back and forth of the row's light: a search that answers at once (a failure too) still shows it. */
const MIN_SEEK_MS = 2600;

/**
 * A category's search (2026-10-24): `seeking` while the source is asked for anything of it (sectionLooking) or the AI
 * reviews it, open or shut, held at least one back and forth; shut, after, `fresh` how many options came meanwhile (the
 * small number on its icon), gone once it is opened.
 */
function useSectionSearch(id: string, also: boolean, found: number, open: boolean): { seeking: boolean; work: SeekWork; fresh: number } {
  const adding = useIn(sectionAdding, id);
  const editing = useIn(sectionEditing, id);
  const searching = useIn(sectionLooking, id);
  const live = adding || editing || searching || also;
  // (what the row says, the last thing it was doing kept while the motion is held)
  const said = useRef<SeekWork>("search");
  if (live) said.current = adding ? "add" : editing ? "edit" : "search";
  const [held, setHeld] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (live) {
      since.current = Date.now();
      setHeld(true);
      return;
    }
    const t = setTimeout(() => setHeld(false), Math.max(0, MIN_SEEK_MS - (Date.now() - since.current)));
    return () => clearTimeout(t);
  }, [live]);
  const seeking = live || held;
  // (what it held when the search began, shut; opened, nothing is new any more)
  const base = useRef<number | null>(null);
  if (open) base.current = null;
  else if (seeking && base.current == null) base.current = found;
  return { seeking, work: said.current, fresh: !open && !seeking && base.current != null ? Math.max(0, found - base.current) : 0 };
}

/** The row's word while it moves: Aranıyor, Ekleniyor (something put on it), Düzenleniyor (something of it changed). */
export type SeekWork = "search" | "add" | "edit";
function useIn(store: LookStore, id: string): boolean {
  const read = () => store.has(id);
  return useSyncExternalStore(store.subscribe, read, read);
}

export function Section({ section, row, v82, open, instant = false, onToggle, onAdd, onDecide, decideTip, allotNum = null, suggestions = 0, reviewing = false, found = 0, children }: {
  section: CatSection;
  row: RowView;
  /** Drawn the new way: intents on a rail (their Gizlenenler among them), no old body around them. */
  v82: boolean;
  open: boolean;
  /** Closed because another one opened (the accordion, E1): at once, so the one opening moves only once. */
  instant?: boolean;
  onToggle: () => void;
  /** "+ Konaklama ekle": this category's kind, no day. */
  onAdd: () => void;
  onDecide: () => void;
  decideTip: string[];
  /** Its share of the budget as a number and its currency: what's left of it shows in the money box. */
  allotNum?: { amount: number; currency: string } | null;
  /** Its open suggestions ("1 öneri", C28). */
  suggestions?: number;
  /** The AI's review is out for it now ("Öneriler aranıyor…"): its row shows the search too. */
  reviewing?: boolean;
  /** How many options its needs hold now (what came while it was shut is the number on its icon). */
  found?: number;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.id];
  const shut = useSectionSearch(section.id, reviewing, found, open);
  const label = meta.label();
  const fold = useFold(open);
  const mounted = instant && !open ? false : fold.mounted;
  return (
    <section className={`q-sec${open ? " open" : ""}`} id={`cat-${section.id}`} style={{ "--c": meta.color } as React.CSSProperties} aria-label={label} data-section={section.id}>
      <CategoryRow row={row} meta={meta} open={open} onToggle={onToggle} onDecide={onDecide} decideTip={decideTip}
        budgetTip={budgetTip(section, allotNum)} extraTip={suggestions > 0 ? L(`${suggestions} öneri`, `${suggestions} suggestion${suggestions === 1 ? "" : "s"}`) : null}
        seeking={shut.seeking} work={shut.work} fresh={shut.fresh} />
      {mounted && (
        <div className={`q-fold${fold.expanded ? " on" : ""}${fold.settled ? " settled" : ""}`} inert={!open}>
          <div className="q-fold-in">
            <div className={v82 ? "q-foldb" : "cat-body"} data-pit-children>
              {children}
              {!v82 && section.hidden.length > 0 && <HiddenList things={section.hidden} />}
              {meta.templates.length > 0 && (
                <button type="button" className="q-add" onClick={onAdd} aria-label={L(`${label}: ekle`, `Add to ${label}`)}>
                  <UiIcon name="plus" size={13} />
                  {L(`${(ADD_WORD[section.id] ?? meta.short)()} ekle`, ADD_EN[section.id] ?? `Add ${meta.short().toLowerCase()}`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
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
      {top && top[1].booked > 0 && line("bk", lookWord("booked"), money(top[1].booked, top[0]))}
      {top && top[1].chosen > 0 && line("ch", lookWord("chosen"), money(top[1].chosen, top[0]))}
      {left != null && line(left < 0 ? "ov" : "fr", left < 0 ? L("Aşıyor", "Over") : L("Boşta", "Free"), money(Math.abs(left), top![0]))}
      <span className="tipx-note">{L("Ayrılan pay, gezi bütçesinden beklenen maliyete göre bölünür.", "The share set aside is the trip's budget divided by what each part is likely to cost.")}</span>
    </>
  );
}

/**
 * An idea section's neutral count (0.35.3), never a "3/4": "5 fikir · 2 tanesi bir güne kondu", İlham "4 kayıt".
 * Done ones join it quietly ("· 1 yapıldı").
 */
export function ideaCount(id: CatSection["id"], { total, onDay, done }: NonNullable<CatSection["ideas"]>, entries: CatSection["entries"] = [], suggested = 0): string {
  if (id === "inspo") return L("kaydettiğin video ve gönderiler", "videos and posts you saved");
  // v46 (as drawn): Yapılacaklar says what is on the plan and what waits as an idea ("8 planda · 6 öneri"); the suggestions wait too.
  if (id === "todo") {
    const records = entries.map((e) => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null)).filter((i): i is NonNullable<typeof i> => i != null);
    const planned = records.filter((i) => !i.doneAt && (i.status === "chosen" || i.status === "booked" || Boolean(i.dates.start))).length;
    const waiting = records.filter((i) => !i.doneAt).length - planned + suggested;
    const parts = [];
    if (planned) parts.push(L(`${planned} planda`, `${planned} on the plan`));
    if (waiting) parts.push(L(`${waiting} öneri`, `${waiting} idea${waiting === 1 ? "" : "s"}`));
    if (done) parts.push(L(`${done} yapıldı`, `${done} done`));
    return parts.join(" · ");
  }
  const parts = [L(`${total} fikir`, `${total} idea${total === 1 ? "" : "s"}`)];
  if (onDay) parts.push(L(`${onDay} tanesi bir güne kondu`, `${onDay} on a day`));
  if (done) parts.push(id === "food" ? L(`${done} gidildi`, `${done} visited`) : L(`${done} yapıldı`, `${done} done`));
  return parts.join(" · ");
}
