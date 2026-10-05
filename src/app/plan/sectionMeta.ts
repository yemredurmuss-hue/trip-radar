// The seven sections' look and what "+ Ekle" adds in each (spec 0.34 §Bölüm kabuğu): colour, icon, name, and
// the template tiles of that kind. One tile adds at once (instant add, 0.33); more open the sheet with only those.
import { useCallback, useEffect, useState } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { OpenState, SectionId } from "../../lib/categories";
import { L } from "../../lib/i18n";
import type { TemplateId } from "../../lib/templates";

export interface SectionMeta {
  color: string;
  icon: CardKind;
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
  other: { color: "#3b6fd1", icon: "insurance", label: () => L("Diğer · sigorta ve internet", "Other · insurance and internet"), short: () => L("Sigorta · eSIM", "Insurance · eSIM"), templates: ["esim", "insurance"] },
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

/** Which sections the traveller opened or closed on this trip, remembered on this computer. */
export function useSectionOpen(tripId: string): [OpenState, (id: SectionId, open: boolean) => void] {
  const [state, setState] = useState<{ tripId: string; open: OpenState }>(() => ({ tripId, open: read(tripId) }));
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
  return [state.tripId === tripId ? state.open : read(tripId), set];
}
