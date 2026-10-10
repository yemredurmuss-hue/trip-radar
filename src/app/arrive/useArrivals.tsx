// Content arriving on the board, made visible (spec: "içerik gelirken"): while a link or a file is read, a
// quiet waiting card sits at the top of the section it will most likely land in (or under the Plan's
// header when that can't be guessed); when its card appears it slides in with a soft ring that fades, the
// section's count gives a tiny pop, and a card that landed out of sight gets a toast with "Göster".
// Kept to one hook for TripPanel (a few lines there), the drawing in ArriveViews.tsx.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arrivedText, diffArrivals, pendingSlot, predictSection, siteOf, hostOf, type Seen } from "../../lib/arrive";
import { findInSections, planSectionOfItem, type CatSection, type SectionId } from "../../lib/categories";
import type { Todo } from "../../lib/progress";
import type { Capture, Item } from "../../lib/types";
import { findTarget } from "../Progress";
import { ArriveToast, PendingCard, type Pending } from "./ArriveViews";
import { captureById, endIntake, intakeNow, onRevealRequest, useIntake } from "./intake";

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
        capturedAt: c.capturedAt,
        since: null,
      });
    }
    for (const e of intake) {
      if (e.kind !== "file" || e.tripId !== tripId || e.state !== "reading") continue;
      out.push({ key: e.id, kind: "file", status: "processing", section: null, host: null, site: null, title: e.name, thumb: null, error: null, captureId: null, capturedAt: e.at, since: e.at });
    }
    return out;
  }, [openCaptures, intake, tripId]);
  // When each started being read (a queued one waits on its first line). The card keeps its own small timer.
  const now = Date.now();
  for (const p of pending) if (p.status === "processing" && !since.current.has(p.key)) since.current.set(p.key, p.since ?? now);

  // A section with a waiting card opens while it waits, on screen only (never remembered), and stays open
  // for the card that lands in it until the traveller closes it or leaves the trip.
  const waitingIn = useMemo(() => new Set(pending.filter((p) => pendingSlot(p) !== "lead").map((p) => p.section!)), [pending]);
  const [shown, setShown] = useState<{ tripId: string; open: ReadonlySet<SectionId>; closed: ReadonlySet<SectionId> }>({ tripId, open: new Set(), closed: new Set() });
  const own = shown.tripId === tripId ? shown : { tripId, open: new Set<SectionId>(), closed: new Set<SectionId>() };
  useEffect(() => {
    const add = [...waitingIn].filter((s) => !own.open.has(s) && !own.closed.has(s));
    const done = [...own.closed].filter((s) => !waitingIn.has(s)); // a closed one may open for the next arrival
    if (add.length || done.length || shown.tripId !== tripId) {
      setShown({ tripId, open: new Set([...own.open, ...add]), closed: new Set([...own.closed].filter((s) => waitingIn.has(s))) });
    }
  }, [waitingIn, tripId, own, shown.tripId]);
  const forced = (id: SectionId) => (own.open.has(id) || waitingIn.has(id)) && !own.closed.has(id);
  const openNow = (s: CatSection) => forced(s.id) || isOpen(s);
  const onOpen = (id: SectionId, open: boolean) => {
    const section = sections.find((s) => s.id === id);
    if (forced(id)) {
      // The traveller's own tap ends the arrival's hold on it.
      const nextOpen = new Set(own.open);
      nextOpen.delete(id);
      setShown({ tripId, open: nextOpen, closed: open ? own.closed : new Set(own.closed).add(id) });
      // Opened only for an arrival and closed again: back as it was, nothing remembered.
      if (!open && section && !isOpen(section)) return;
    }
    setOpened(id, open);
  };

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
    const { items, sections } = live.current;
    const placed = ids.flatMap((id) => {
      const item = items.find((i) => i.id === id);
      if (!item || item.status === "dismissed") return [];
      return [{ id, name: item.name, section: findInSections(sections, { item: id })?.section ?? planSectionOfItem(item) }];
    });
    if (!placed.length) return;
    // A section opened for its waiting card stays open for the card (on screen only, see `shown`). One closed
    // on its own (İlham, one the traveller closed) stays closed: the count pops and the toast says where.
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
      // Landed (or removed): what the page kept of its handing-over starts its keeping clock (intake.ts).
      const ended = new Set(gone.filter((_, i) => rows[i] == null || rows[i]!.status === "done"));
      for (const e of intakeNow()) if ((e.kind === "link" || e.state === "screenshot") && e.captureId && ended.has(e.captureId)) endIntake(e.id);
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
    list.length ? list.map((p) => <PendingCard key={p.key} p={{ ...p, since: since.current.get(p.key) ?? null }} />) : null;
  // A failed one always under the Plan's header (pendingSlot): never inside a section that may be closed.
  const known = new Set(sections.map((s) => s.id));
  const slotOf = (p: Pending) => {
    const raw = pendingSlot(p);
    // v11: a restaurant being read waits atop Yapılacak şeyler.
    const slot = raw === "food" ? "todo" : raw;
    return slot !== "lead" && known.has(slot) ? slot : "lead";
  };
  const bySection: Partial<Record<SectionId, ReactNode>> = {};
  for (const s of new Set(pending.map(slotOf))) if (s !== "lead") bySection[s] = cards(pending.filter((p) => slotOf(p) === s));
  const lead = cards(pending.filter((p) => slotOf(p) === "lead"));

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
