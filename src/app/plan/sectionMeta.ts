// The eight sections' look and what "+ Ekle" adds in each (spec 0.34 §Bölüm kabuğu): colour, icon, name, and
// the template tiles of that kind. One tile adds at once (instant add, 0.33); more open the sheet with only those.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { CatSection, OpenState, SectionId } from "../../lib/categories";
import { L } from "../../lib/i18n";
import type { TemplateId } from "../../lib/templates";

export interface SectionMeta {
  color: string;
  icon: CardKind | "inspo";
  label: () => string;
  /** The empty section's chip at the bottom ("+ Restoran"). */
  short: () => string;
  templates: readonly TemplateId[];
}

export const SECTION_META: Record<SectionId, SectionMeta> = {
  flight: { color: "#6a4fe0", icon: "flight", label: () => L("Uçuş", "Flights"), short: () => L("Uçuş", "Flight"), templates: ["flight"] },
  stay: { color: "#23998b", icon: "stay", label: () => L("Konaklama", "Stays"), short: () => L("Konaklama", "Stay"), templates: ["hotel", "home"] },
  transport: {
    color: "#2563c9",
    icon: "train",
    label: () => L("Ulaşım", "Getting around"),
    short: () => L("Ulaşım", "Transport"),
    templates: ["train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike"],
  },
  activity: { color: "#a8336f", icon: "activity", label: () => L("Etkinlikler", "Activities"), short: () => L("Etkinlik", "Activity"), templates: ["activity"] },
  todo: { color: "#5d8a1c", icon: "todo", label: () => L("Yapılacak şeyler", "Things to do"), short: () => L("Yapılacak", "To-do"), templates: ["todo"] },
  food: { color: "#b4532a", icon: "food", label: () => L("Restoranlar", "Restaurants"), short: () => L("Restoran", "Restaurant"), templates: ["food"] },
  other: { color: "#3b6fd1", icon: "insurance", label: () => L("Diğer (Sigorta, eSIM)", "Other (Insurance, eSIM)"), short: () => L("Sigorta · eSIM", "Insurance · eSIM"), templates: ["esim", "insurance"] },
  // Saved by sending a link (a Reel, a pin, a video, a blog), never added by hand: no template, no "Ekle" chip.
  inspo: { color: "#8a5cc7", icon: "inspo", label: () => L("İlham", "Inspiration"), short: () => L("İlham", "Inspiration"), templates: [] },
};

const storeKey = (tripId: string) => `trip-radar:plan-sections:${tripId}`;

function read(tripId: string): OpenState {
  try {
    const raw = localStorage.getItem(storeKey(tripId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([k, v]) => k in SECTION_META && typeof v === "boolean")) as OpenState;
  } catch {
    return {}; // no storage (a private window, a preview): every section follows its first look
  }
}

function write(tripId: string, state: OpenState) {
  try {
    localStorage.setItem(storeKey(tripId), JSON.stringify(state));
  } catch {
    // not remembered this time; the choice still holds on screen
  }
}

/**
 * Which sections are open on this trip: the traveller's own choice, remembered on this computer; else the
 * first look — open while something's left, closed once all is done — taken once per visit, so a section
 * doesn't fold away under the hand that just booked its last ticket.
 */
export function useSectionOpen(tripId: string): [(section: CatSection) => boolean, (id: SectionId, open: boolean) => void] {
  const [state, setState] = useState<{ tripId: string; open: OpenState }>(() => ({ tripId, open: read(tripId) }));
  const firstLook = useRef<{ tripId: string; open: Map<SectionId, boolean> }>({ tripId, open: new Map() });
  useEffect(() => {
    if (state.tripId !== tripId) setState({ tripId, open: read(tripId) });
  }, [tripId, state.tripId]);
  const set = useCallback(
    (id: SectionId, open: boolean) =>
      setState((prev) => {
        const next = { ...(prev.tripId === tripId ? prev.open : read(tripId)), [id]: open };
        write(tripId, next);
        return { tripId, open: next };
      }),
    [tripId],
  );
  const chosen = state.tripId === tripId ? state.open : read(tripId);
  if (firstLook.current.tripId !== tripId) firstLook.current = { tripId, open: new Map() };
  const looks = firstLook.current.open;
  const isOpen = (section: CatSection): boolean => {
    const own = chosen[section.id];
    if (own != null) return own;
    if (!looks.has(section.id)) looks.set(section.id, section.open);
    return looks.get(section.id)!;
  };
  return [isOpen, set];
}
