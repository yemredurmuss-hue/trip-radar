// The Pano (plan v81–v83, docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md; v82 geçişi spec §4 aşama 6):
// no longer a page of its own but a window over the plan. It grows from the middle (E8; from below on a narrow screen, a drawer on
// a phone), the plan darkened behind it; × , the scrim and Escape close it and the focus goes back where it was. A side menu (Tümü
// · Biriktirdiklerim · AI önerileri · İlham · Belgeler, then the intents by category: PanoSidebar), and what it shows: the options
// group by group (PanoGrid), one intent's options side by side (CompareColumns), the inspiration (IlhamGrid), the trip's files
// (PanoDocs). Choosing here changes the plan at once (no toast, E16); "Kartı göster" closes the window and goes to the card.
// Search, the state filter and the sort of the v11 Pano (board/Pano.tsx) are not drawn in this version (C32).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { CatSection, SectionId } from "../../../lib/categories";
import { L } from "../../../lib/i18n";
import { sectionName } from "../../../lib/intents";
import { freshIds, seenKey, withLoves } from "../../../lib/pano";
import { findNeed, inView, panoBoardOf, recordsText, type PanoAt, type PanoBoard, type PanoIdea, type PanoNeed } from "../../../lib/panoBoard";
import type { Plan } from "../../../lib/plan";
import type { DocMeta, Item, Trip } from "../../../lib/types";
import type { Undoable } from "../../../lib/undoables";
import { UiIcon } from "../../cards/Silhouettes";
import { Mascot } from "../../Mascot";
import { reducedMotion } from "../../motion";
import { useMyName } from "../../Profile";
import { useShare } from "../../Share";
import type { Decisions } from "../../useDecisions";
import { CompareColumns } from "./CompareColumns";
import { IlhamGrid } from "./IlhamGrid";
import { PanoDocs, useDocRows } from "./PanoDocs";
import { PanoGroup } from "./PanoGrid";
import { PanoSidebar, type PanoPlace } from "./PanoSidebar";

/** What this device has already seen on the trip's Pano ("Yeni" until then; localStorage, no schema change). */
const seenOnDevice = (tripId: string): Set<string> => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(seenKey(tripId)) ?? "[]"));
  } catch {
    return new Set();
  }
};

const placeOf = (at: PanoAt): PanoPlace => ({ view: at.view ?? "all", section: at.section ?? null, need: at.need ?? null });

/** The window's way out (pano.css): 180 ms, a drawer's 220. */
const leaveMs = () => (matchMedia("(max-width: 640px)").matches ? 220 : 180);

export interface PanoDialogProps {
  /** Where it opens: a top entry, a category, an intent (its key or a group of one of its records). */
  at: PanoAt;
  trip: Trip;
  plan: Plan;
  sections: CatSection[];
  items: Item[];
  today: string;
  decisions: Decisions | null;
  docsFor: (itemId: string) => DocMeta[];
  /** How many go, as the hero says it. */
  people: number | null;
  /** The plans a saved page replaced hand it their files (docs.inheritedDocs). */
  inherited: ReadonlyMap<string, readonly string[]>;
  /** Called once the window has gone (after its way out): the board drops it. */
  onClose: () => void;
  /** "Kartı göster": to the card on the plan, which flashes (TripPanel's reveal). */
  onReveal: (itemId: string) => void;
  /** A line for the trip's chat, sent as if typed ("✨ AI'dan öner", "İçinden yerleri çıkar"); absent where there is no chat. */
  onAsk?: (text: string) => void;
  /** An inspiration's ×: gone with the 8-second "Geri al". */
  onRemove: (item: Item) => void;
  /** The "Geri al" of a file deleted here. */
  offer: (u: Undoable) => void;
}

export function PanoDialog({ at, trip, plan, sections, items, today, decisions, docsFor, people, inherited, onClose, onReveal, onAsk, onRemove, offer }: PanoDialogProps) {
  const myName = useMyName();
  const me = myName || null;
  // A shared trip: each heart is a "Süper" vote, so the other traveller's hearts show here too (lib/pano withLoves).
  const share = useShare();
  const loved = useMemo(() => (share ? items.map((i) => withLoves(i, share.votes)) : items), [items, share?.votes]);
  const board = useMemo(
    () => panoBoardOf({ trip, plan, sections, items: loved, today, decisions: decisions?.byGroup, ctx: decisions?.ctx, docsFor, people, me }),
    [trip, plan, sections, loved, today, decisions, docsFor, people, me],
  );
  const docRows = useDocRows(trip.id, items, inherited);
  const docCount = docRows ? docRows.reduce((n, g) => n + g.rows.length, 0) : null;
  // "Yeni": what came after the last visit stays marked until this visit ends; the next visit has seen it.
  const [seen] = useState(() => seenOnDevice(trip.id));
  const fresh = useMemo(() => freshIds(items, seen), [items, seen]);
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(trip.id), JSON.stringify(items.map((i) => i.id)));
    } catch {
      /* the mark just shows again next time */
    }
  }, [trip.id, items]);

  const [place, setPlace] = useState<PanoPlace>(() => placeOf(at));
  useEffect(() => setPlace(placeOf(at)), [at]);
  const need = findNeed(board, place.need);
  const shown: PanoPlace = need ? { view: "all", section: null, need: need.key } : { ...place, need: null };

  // --- the window: focus in and back, Escape, the way out ---
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const [leaving, setLeaving] = useState(false);
  const going = useRef(false);
  const close = useCallback(
    (then?: () => void) => {
      if (going.current) return;
      going.current = true;
      const done = () => {
        opener?.focus({ preventScroll: true });
        onClose();
        then?.();
      };
      if (reducedMotion()) return done();
      setLeaving(true);
      setTimeout(done, leaveMs());
    },
    [opener, onClose],
  );
  useLayoutEffect(() => closeButton.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A day's small window inside closes first (DayPicker's own Escape).
      if (e.key !== "Escape" || sheet.current?.querySelector(".fk-picker")) return;
      e.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  /** Tab stays inside the window. */
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !sheet.current) return;
    const all = [...sheet.current.querySelectorAll<HTMLElement>("button, a[href], select, input, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (!all.length) return;
    const [first, last] = [all[0], all[all.length - 1]];
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  };

  // --- what its buttons do ---
  const go = (p: PanoPlace) => setPlace(p);
  const compare = (n: PanoNeed) => go({ view: "all", section: null, need: n.key });
  const reveal = (itemId: string) => close(() => setTimeout(() => onReveal(itemId), 60));
  // The chat answers behind the window: it closes so the answer is seen.
  const ask = onAsk ? (text: string) => close(() => onAsk(text)) : undefined;
  const askFor = ask ? (n: PanoNeed) => ask(L(`${n.name} için öneri bul`, `Find options for ${n.name}`)) : undefined;
  const extract = ask
    ? (idea: PanoIdea) => ask(L(`Bu kayıttaki yerleri çıkar ve plana uygun ihtiyaçlara ekle: ${idea.title}${idea.url ? ` (${idea.url})` : ""}`, `Pull out the places in this and add them where they fit the plan: ${idea.title}${idea.url ? ` (${idea.url})` : ""}`))
    : undefined;
  const removeIdea = (idea: PanoIdea) => onRemove(idea.item);

  const content = need ? (
    <NeedPage need={need} fresh={fresh} onAsk={askFor} />
  ) : shown.section ? (
    <SectionPage board={board} section={shown.section} fresh={fresh} onCompare={compare} />
  ) : shown.view === "docs" ? (
    <>
      <Head title={L("Belgeler", "Documents")} line={L("Biletler, onaylar ve gezi belgeleri · her biri kendi kartına bağlı · yalnız bu bilgisayarda", "Tickets, confirmations and travel papers · each on its own card · on this computer only")} />
      <PanoDocs tripId={trip.id} groups={docRows} items={items} onShow={reveal} offer={offer} />
    </>
  ) : shown.view === "ilham" ? (
    <>
      <Head title={L("İlham", "Inspiration")} line={L("Kaydettiğin videolar, reels ve yazılar", "The videos, reels and posts you saved")} />
      {board.ideas.length ? (
        <IlhamGrid ideas={board.ideas} plan={plan} onExtract={extract} onRemove={removeIdea} />
      ) : (
        <Empty text={L("Henüz ilham yok. Sohbete bir Reels, TikTok, YouTube ya da blog linki bırak; burada birikir.", "No inspiration yet. Drop a Reel, a TikTok, a video or a blog link in the chat; it gathers here.")} />
      )}
    </>
  ) : (
    <ListPage board={board} view={shown.view === "mine" || shown.view === "ai" ? shown.view : "all"} plan={plan} fresh={fresh} onCompare={compare} onIlham={() => go({ view: "ilham", section: null, need: null })} onExtract={extract} onRemove={removeIdea} />
  );

  return createPortal(
    <>
      <div className={`q-scrim${leaving ? " leaving" : ""}`} onClick={() => close()} aria-hidden />
      <div className={`q-sheetp${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={sheet} onKeyDown={trap}>
        <div className="q-sh">
          <div className="q-sht">
            <b id={titleId}>{L("Pano", "Board")}</b>
            <small>{L("Biriktirdiklerin, AI önerileri, belgeler ve ilham", "What you saved, the AI's picks, documents and inspiration")}</small>
          </div>
          <span className="q-sp" />
          <button type="button" className="q-x" ref={closeButton} aria-label={L("Pano'yu kapat", "Close the board")} onClick={() => close()}>
            <UiIcon name="x" size={18} />
          </button>
        </div>
        <div className="q-pbody">
          <PanoSidebar board={board} docs={docCount} at={shown} onGo={go} />
          <div className="q-pmain">
            {/* E9: the content comes in anew for each place (the key), from its top. */}
            <div className="q-sc" key={`${shown.view}|${shown.section ?? ""}|${shown.need ?? ""}`}>
              {content}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Head({ title, line, hint }: { title: string; line?: string | null; hint?: string | null }) {
  return (
    <div className="q-ph2">
      <div>
        <b>{title}</b>
        {line && <small>{line}</small>}
      </div>
      {hint && (
        <>
          <span className="q-sp" />
          <small className="q-hint2">{hint}</small>
        </>
      )}
    </div>
  );
}

function Empty({ text, sleepy = false }: { text: string; sleepy?: boolean }) {
  return (
    <p className="q-pempty">
      {/* (hareket dili) nothing saved yet: the mascot sleeps; a list that only holds nothing here: it looks puzzled */}
      <Mascot size={48} state={sleepy ? "sleepy" : "oops"} className="empty-mascot" />
      {text}
    </p>
  );
}

/** One intent: its options side by side (best fit first), or its cards where options don't compare (a row of things to do). */
function NeedPage({ need, fresh, onAsk }: { need: PanoNeed; fresh: ReadonlySet<string>; onAsk?: (need: PanoNeed) => void }) {
  const line = [need.word, need.info || null, need.compare ? null : L("biriktirdiklerin", "what you saved")].filter(Boolean).join(" · ");
  const n = need.options.length;
  const hint = need.compare ? [L("AI uyum puanına göre sıralı", "Best fit first"), L(`${n} seçenek`, `${n} options`), n > 3 ? L("yana kaydır →", "scroll sideways →") : null].filter(Boolean).join(" · ") : null;
  return (
    <>
      <Head title={need.name} line={line} hint={hint} />
      {need.compare ? <CompareColumns need={need} onAsk={onAsk} /> : <PanoGroup need={need} bare fresh={fresh} onCompare={() => undefined} />}
    </>
  );
}

function SectionPage({ board, section, fresh, onCompare }: { board: PanoBoard; section: SectionId; fresh: ReadonlySet<string>; onCompare: (n: PanoNeed) => void }) {
  const cat = board.cats.find((c) => c.section === section);
  return (
    <>
      <Head title={sectionName(section)} line={recordsText(cat?.count ?? 0)} />
      {cat ? cat.needs.map((n) => <PanoGroup key={n.key} need={n} fresh={fresh} onCompare={onCompare} />) : <Empty text={L("Burada kayıt yok.", "Nothing saved here.")} />}
    </>
  );
}

/** Tümü, Biriktirdiklerim, AI önerileri: every intent's cards that belong (Tümü ends with three of the inspiration and "Hepsi ›"). */
function ListPage({ board, view, plan, fresh, onCompare, onIlham, onExtract, onRemove }: {
  board: PanoBoard;
  view: "all" | "mine" | "ai";
  plan: Plan;
  fresh: ReadonlySet<string>;
  onCompare: (n: PanoNeed) => void;
  onIlham: () => void;
  onExtract?: (idea: PanoIdea) => void;
  onRemove: (idea: PanoIdea) => void;
}) {
  const titles = {
    all: [L("Tümü", "All"), L("Herkesin biriktirdikleri ve AI önerileri", "What everyone saved and the AI's picks")],
    mine: [L("Biriktirdiklerim", "Saved by us"), L("Senin ve arkadaşlarının eklediği linkler", "The links you and your friends added")],
    ai: [L("AI önerileri", "AI picks"), L("Niyetlerine göre AI'nın bulduğu seçenekler", "What the AI found for what you want")],
  }[view];
  const needs = board.cats.flatMap((c) => c.needs).filter((n) => n.options.some((o) => inView(view, o)));
  const ideas = view === "all" ? board.ideas : [];
  return (
    <>
      <Head title={titles[0]} line={titles[1]} />
      {needs.map((n) => (
        <PanoGroup key={n.key} need={n} filter={view} showWord fresh={fresh} onCompare={onCompare} />
      ))}
      {ideas.length > 0 && (
        <section className="q-grp" aria-label={L("İlham", "Inspiration")}>
          <div className="q-gh">
            <b>{L("İlham", "Inspiration")}</b>
            <small>{recordsText(ideas.length)}</small>
            <span className="q-sp" />
            <button type="button" className="q-cmpb" onClick={onIlham}>
              {L("Hepsi ›", "All ›")}
            </button>
          </div>
          <IlhamGrid ideas={ideas.slice(0, 3)} plan={plan} onExtract={onExtract} onRemove={onRemove} />
        </section>
      )}
      {!needs.length && !ideas.length && (
        <Empty
          sleepy={view === "all"}
          text={view === "all" ? L("Henüz kayıt yok. Eklentiyle bir sayfa kaydet ya da sohbette bir link bırak; hepsi burada birikir.", "Nothing saved yet. Save a page with the extension or drop a link in the chat; it all gathers here.") : L("Burada kayıt yok.", "Nothing saved here.")}
        />
      )}
    </>
  );
}
