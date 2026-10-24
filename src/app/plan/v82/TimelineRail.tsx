// An open v82 category's inside (plan v82 "açık kategoride durum çizgisi"): its intents one under another on a vertical
// rail, each one's dot its state's colour (CSS, `data-st`); first the category's short note when the trip's form changed
// something there (spec §1.4, CategoryInfo: only when said), then what is being read into it and its warnings, then the
// visa (Belgeler ve internet), the intents, and last its "Gizlenenler · n".
import { useMemo, useState, type ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { useCardEnv } from "../../cards/PlanCard";
import { RowOpenContext } from "./IntentRow";

/** The one-line note at a category's start (q-tinfo): drawn only with something to say. */
export function CategoryInfo({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p className="q-tinfo">
      <i aria-hidden>i</i>
      <span>{text}</span>
    </p>
  );
}

const CLOSED_KEY = (tripId: string) => `trip-radar:rows-closed:${tripId}`;
function readClosed(tripId: string): ReadonlySet<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CLOSED_KEY(tripId)) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}
function writeClosed(tripId: string, closed: ReadonlySet<string>): void {
  try {
    // (the last 200: rows of a trip, never a growing list)
    localStorage.setItem(CLOSED_KEY(tripId), JSON.stringify([...closed].slice(-200)));
  } catch {
    // (no storage: closed for this visit only)
  }
}

export function TimelineRail({ info, lead, children, hidden, dated = false }: {
  /** Uçuş, Konaklama, Ulaşım (plan v14): the intents on the date rail (.q-tl), one row open at a time. */
  dated?: boolean;
  info?: string | null;
  /** Before the intents and off the rail's dots: a link being read, a warning. */
  lead?: ReactNode;
  children: ReactNode;
  /** "Gizlenenler · n", at the end. */
  hidden?: ReactNode;
}) {
  const { tripId } = useCardEnv();
  const [open, setOpen] = useState<string | null>(null);
  // (the rows that come open by themselves, closed by the traveller: Karar Masası's chosen flights), kept for the trip:
  // the category shut and opened again builds this anew, and a row closed stays closed (2026-10-24, "kapattıysam kapalı kalsın")
  const [closed, setClosedNow] = useState<ReadonlySet<string>>(() => readClosed(tripId));
  const setClosed = (next: (c: ReadonlySet<string>) => ReadonlySet<string>) =>
    setClosedNow((c) => {
      const n = next(c);
      if (n !== c) writeClosed(tripId, n);
      return n;
    });
  const rows = useMemo(
    () => ({
      open,
      // (opened on purpose, a row that was closed opens again: a pick, "Aldım")
      set: (key: string | null) => {
        setOpen(key);
        if (key) setClosed((c) => (c.has(key) ? new Set([...c].filter((k) => k !== key)) : c));
      },
      closed,
      shut: (key: string, yes: boolean) => setClosed((c) => (yes === c.has(key) ? c : yes ? new Set(c).add(key) : new Set([...c].filter((k) => k !== key)))),
    }),
    [open, closed],
  );
  return (
    <RowOpenContext.Provider value={rows}>
    <div className={dated ? "q-ints q-tl" : "q-ints"}>
      <CategoryInfo text={info} />
      {lead}
      {children}
      {/* The route notes' heading (plan v13, K85): drawn only when the category has one (CSS :has, card13.css). */}
      <p className="z-nh">
        <b>{L("Yol notları", "Route notes")}</b>
        <span>{L("Rezervasyon gerekmez · aracı değiştirmek için dokun", "Nothing to book · tap to change the way")}</span>
      </p>
      {hidden}
    </div>
    </RowOpenContext.Provider>
  );
}
