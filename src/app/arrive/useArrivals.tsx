// Content arriving on the board, made visible (spec: "içerik gelirken"): while a link or a file is read, a
// quiet waiting card sits at the top of the section it will most likely land in (or under the Plan's
// header when that can't be guessed); when its card appears it slides in with a soft ring that fades, the
// section's count gives a tiny pop, and a card that landed out of sight gets a toast with "Göster".
// Kept to one hook for TripPanel (a few lines there), the drawing in ArriveViews.tsx.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arrivedText, diffArrivals, predictSection, siteOf, hostOf, type Seen } from "../../lib/arrive";
import { findInSections, sectionOfItem, type CatSection, type SectionId } from "../../lib/categories";
import type { Todo } from "../../lib/progress";
import type { Capture, Item } from "../../lib/types";
import { findTarget } from "../Progress";
import { ArriveToast, PendingCard, type Pending } from "./ArriveViews";
import { captureById, onRevealRequest, useIntake } from "./intake";

/** How long the ring stays on a card that just came (the CSS animation is a little shorter). */
const RING_MS = 1900;
const POP_MS = 420;
const TOAST_MS = 5000;

/** Restarts a one-shot CSS animation class on an element (again if it's still on), and takes it off after. */
function pulse(el: Element | null, cls: string, ms: number) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/** On screen in the board's scrolling panel (and the window). */
function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const panel = el.closest(".panel")?.getBoundingClientRect();
  const top = Math.max(0, panel?.top ?? 0);
  const bottom = Math.min(window.innerHeight, panel?.bottom ?? window.innerHeight);
  return r.bottom > top + 24 && r.top < bottom - 24;
}

export interface Arrivals {
  /** The waiting cards: under the Plan's header (`lead`) and at the top of a section. */
  pending: { lead: ReactNode; bySection: Partial<Record<SectionId, ReactNode>> };
  /** isOpen and onOpen for the Plan: a section with a waiting card in it opens (not remembered). */
  isOpen: (section: CatSection) => boolean;
  onOpen: (id: SectionId, open: boolean) => void;
  toast: ReactNode;
  /** A record added by hand (a tile): it has its own "eklendi · Geri al", no ring or toast here. */
  quiet: (itemId: string) => void;
}

export function useArrivals({ tripId, items, sections, openCaptures, view, isOpen, setOpened, reveal }: {
  tripId: string;
  items: Item[];
  sections: CatSection[];
  openCaptures: Capture[];
  view: string;
  isOpen: (section: CatSection) => boolean;
  setOpened: (id: SectionId, open: boolean) => void;
  reveal: (target: Todo["target"]) => void;
}): Arrivals {
  const intake = useIntake();
  // The latest of everything, for the timers below.
  const live = useRef({ items, sections, view, isOpen, setOpened, reveal });
  live.current = { items, sections, view, isOpen, setOpened, reveal };

  // --- the waiting cards ---
  const since = useRef(new Map<string, number>());
  const pending = useMemo<Pending[]>(() => {
    const out: Pending[] = [];
    for (const c of openCaptures) {
      if (c.forTripId && c.forTripId !== tripId) continue;
      const image = c.kind === "image";
      out.push({
        key: c.id,
        kind: image ? "image" : c.kind === "paste-link" ? "link" : "page",
        status: c.status === "error" ? "error" : c.status === "processing" ? "processing" : "pending",
        section: image ? null : predictSection({ url: c.url, title: c.title }),
        host: hostOf(c.url),
        site: siteOf(c.url),
        title: c.title,
        thumb: image ? c.screenshot : null,
        error: c.error,
        captureId: c.id,
      });
    }
    for (const e of intake) {
      if (e.kind !== "file" || e.tripId !== tripId || e.state !== "reading") continue;
      out.push({ key: e.id, kind: "file", status: "processing", section: null, host: null, site: null, title: e.name, thumb: null, error: null, captureId: null });
    }
    return out;
  }, [openCaptures, intake, tripId]);
  // When each started being read (a queued one waits on its first line).
  const now = Date.now();
  for (const p of pending) if (p.status === "processing" && !since.current.has(p.key)) since.current.set(p.key, now);
  const working = pending.some((p) => p.status !== "error");
  const [, tick] = useState(0);
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [working]);

  // A section with a waiting card opens while it waits, unless the traveller closes it again.
  const [released, setReleased] = useState<ReadonlySet<SectionId>>(() => new Set());
  const waitingIn = useMemo(() => new Set(pending.filter((p) => p.section && p.status !== "error").map((p) => p.section!)), [pending]);
  useEffect(() => {
    if ([...released].some((s) => !waitingIn.has(s))) setReleased(new Set([...released].filter((s) => waitingIn.has(s))));
  }, [waitingIn, released]);
  const openNow = useCallback((s: CatSection) => (waitingIn.has(s.id) && !released.has(s.id)) || isOpen(s), [waitingIn, released, isOpen]);
  // The sections open only for a waiting card, as of the last render (read by `land` before it's updated below).
  const held = useRef<ReadonlySet<SectionId>>(new Set());
  const heldNow = new Set(sections.filter((s) => waitingIn.has(s.id) && !released.has(s.id) && !isOpen(s)).map((s) => s.id));
  const onOpen = useCallback(
    (id: SectionId, open: boolean) => {
      if (!open && waitingIn.has(id)) setReleased((r) => new Set(r).add(id));
      setOpened(id, open);
    },
    [waitingIn, setOpened],
  );

  // --- the moment a card arrives ---
  const [toast, setToast] = useState<{ text: string; itemId: string; at: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => setToast(null), [tripId]);
  const quietIds = useRef(new Set<string>());
  const land = useCallback((ids: string[], opts: { toast: boolean }) => {
    const { items, sections, setOpened } = live.current;
    const placed = ids.flatMap((id) => {
      const item = items.find((i) => i.id === id);
      if (!item || item.status === "dismissed") return [];
      return [{ id, name: item.name, section: findInSections(sections, { item: id })?.section ?? sectionOfItem(item) }];
    });
    if (!placed.length) return;
    // A section held open for its waiting card stays open for the card (else it would fold right under it).
    // One closed on its own (İlham, one the traveller closed) stays closed: the count pops, the toast says where.
    for (const sec of new Set(placed.map((p) => p.section))) if (held.current.has(sec)) setOpened(sec, true);
    setTimeout(() => {
      const els = placed.map((p) => findTarget({ item: p.id }));
      els.forEach((el) => pulse(el, "ar-new", RING_MS));
      for (const sec of new Set(placed.map((p) => p.section))) pulse(document.querySelector(`[data-section="${sec}"] :is(.cat-count, .cat-ideas)`), "ar-pop", POP_MS);
      const seen = live.current.view === "plan" && els.some((el) => el && inView(el));
      if (opts.toast && !seen) setToast({ text: arrivedText(placed), itemId: placed[0].id, at: Date.now() });
    }, 90);
  }, []);

  // New since the last look (never on the first look or another trip's; a record that comes back isn't new).
  const seen = useRef<Seen | null>(null);
  useEffect(() => {
    const { seen: next, fresh } = diffArrivals(seen.current, tripId, items.map((i) => i.id));
    seen.current = next;
    const arrived = fresh.filter((id) => !quietIds.current.delete(id));
    if (arrived.length) land(arrived, { toast: true });
  }, [tripId, items, land]);
  // After the arrivals above: this render's held sections are the next one's "last render".
  useEffect(() => {
    held.current = heldNow;
  });

  // A link that updated a card already there ("↻ … güncellendi"): no new id, so its capture says which card.
  const waitedOn = useRef<{ tripId: string; ids: Set<string> }>({ tripId, ids: new Set() });
  useEffect(() => {
    const before = waitedOn.current.tripId === tripId ? waitedOn.current.ids : new Set<string>();
    const nowIds = new Set(openCaptures.filter((c) => c.status !== "error").map((c) => c.id));
    waitedOn.current = { tripId, ids: nowIds };
    const gone = [...before].filter((id) => !nowIds.has(id));
    for (const id of gone) since.current.delete(id);
    if (!gone.length) return;
    void Promise.all(gone.map(captureById)).then((rows) => {
      const ids = rows.flatMap((c) => (c?.status === "done" && c.itemId ? [c.itemId] : []));
      const old = ids.filter((id) => live.current.items.some((i) => i.id === id && i.tripId === tripId));
      // A new card's own arrival does the ring; an updated one only gets the ring.
      setTimeout(() => {
        for (const id of old) if (!document.querySelector(`[data-item-id="${CSS.escape(id)}"].ar-new`)) pulse(findTarget({ item: id }), "ar-new", RING_MS);
      }, 200);
    });
  }, [openCaptures, tripId]);

  // The board was handed something (a drop, a paste on it): the page follows its waiting card once.
  const followed = useRef(new Set<string>());
  useEffect(() => {
    const recent = intake.filter((e) => e.source === "board" && e.tripId === tripId && Date.now() - e.at < 15000 && !followed.current.has(e.id));
    for (const e of recent) {
      const key = e.kind === "link" ? e.captureId : e.state === "screenshot" ? e.captureId : e.id;
      const el = key ? document.querySelector(`[data-arrive="${CSS.escape(key)}"]`) : null;
      if (!el) continue;
      followed.current.add(e.id);
      if (!inView(el)) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  });

  // The chat's chips and event lines ask for a card: the board goes to it.
  useEffect(() => onRevealRequest((id) => live.current.reveal({ item: id })), []);

  const cards = (list: Pending[]) =>
    list.length ? list.map((p) => <PendingCard key={p.key} p={p} elapsed={p.status === "processing" ? now - (since.current.get(p.key) ?? now) : 0} />) : null;
  const shownSections = new Set(sections.map((s) => s.id));
  const bySection: Partial<Record<SectionId, ReactNode>> = {};
  for (const s of new Set(pending.map((p) => p.section))) {
    if (s && shownSections.has(s)) bySection[s] = cards(pending.filter((p) => p.section === s));
  }
  const lead = cards(pending.filter((p) => !p.section || !shownSections.has(p.section)));

  return {
    pending: { lead, bySection },
    isOpen: openNow,
    onOpen,
    toast: toast && (
      <ArriveToast
        key={toast.at}
        text={toast.text}
        onShow={() => {
          setToast(null);
          live.current.reveal({ item: toast.itemId });
        }}
        onClose={() => setToast(null)}
      />
    ),
    quiet: (id) => void quietIds.current.add(id),
  };
}
