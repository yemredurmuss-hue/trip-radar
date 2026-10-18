// The sections' look and what "+ Ekle" adds in each (spec 0.34 §Bölüm kabuğu): colour, icon, name, and
// the template tiles of that kind. One tile adds at once (instant add, 0.33); more open the sheet with only those.
import { useCallback, useEffect, useState } from "react";
import type { CardKind } from "../../lib/cardKinds";
import { SECTION_ORDER, type CatSection, type OpenState, type SectionId } from "../../lib/categories";
import { openOne, withOpen } from "../../lib/planOpen";
import { L } from "../../lib/i18n";
import type { TemplateId } from "../../lib/templates";

export interface SectionMeta {
  color: string;
  icon: CardKind | "inspo" | "prep" | "map";
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
  activity: { color: "#a8336f", icon: "activity", label: () => L("Etkinlik ve turlar", "Activities and tours"), short: () => L("Etkinlik", "Activity"), templates: ["activity"] },
  // v11: restaurants are drawn here too (food stays their own record section).
  todo: { color: "#1f7a45", icon: "map", label: () => L("Yapılacaklar ve restoranlar", "Things to do and restaurants"), short: () => L("Yapılacak", "To-do"), templates: ["todo", "food"] },
  food: { color: "#b4532a", icon: "food", label: () => L("Restoranlar", "Restaurants"), short: () => L("Restoran", "Restaurant"), templates: ["food"] },
  other: { color: "#0f7a5e", icon: "insurance", label: () => L("Belgeler ve internet", "Documents and internet"), short: () => L("Sigorta · eSIM", "Insurance · eSIM"), templates: ["esim", "insurance"] },
  // The chores before the trip (v11, out of Diğer): said in the chat or moved here from Yapılacak şeyler, no template.
  prep: { color: "#475467", icon: "prep", label: () => L("Hazırlık", "Prep"), short: () => L("Hazırlık", "Prep"), templates: [] },
  // Saved by sending a link (a Reel, a pin, a video, a blog), never added by hand: no template, no "Ekle" chip.
  inspo: { color: "#c0256b", icon: "inspo", label: () => L("İlham", "Inspiration"), short: () => L("İlham", "Inspiration"), templates: [] },
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
 * Which category is open on this trip (plan v82 B8: one at a time, the last one opened remembered on this computer, all
 * closed when nothing is): opening one closes the others (lib/planOpen.withOpen).
 */
export function useSectionOpen(tripId: string): [(section: Pick<CatSection, "id">) => boolean, (id: SectionId, open: boolean) => void] {
  const [state, setState] = useState<{ tripId: string; open: OpenState }>(() => ({ tripId, open: read(tripId) }));
  useEffect(() => {
    if (state.tripId !== tripId) setState({ tripId, open: read(tripId) });
  }, [tripId, state.tripId]);
  const set = useCallback(
    (id: SectionId, open: boolean) =>
      setState((prev) => {
        const next = withOpen(prev.tripId === tripId ? prev.open : read(tripId), id, open, SECTION_ORDER);
        write(tripId, next);
        return { tripId, open: next };
      }),
    [tripId],
  );
  const one = openOne(state.tripId === tripId ? state.open : read(tripId), SECTION_ORDER);
  return [(section) => section.id === one, set];
}
