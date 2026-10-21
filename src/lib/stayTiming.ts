// A stay's hours against the flight or train either side of it (onay paketi, Kaçırdıklarımız 2): landing after the desk
// closes, leaving hours after check-out. legs.ts already works these out as a leg's notes (the page's own hours, else the
// usual 15:00 / 11:00); here they are found again for the stay at that end, so its card can say the one that matters on an
// amber strip with one thing to do ("Geç giriş bildir", "Geç çıkış sor"). Pure; nothing is written.
import type { CatEntry, CatSection } from "./categories";
import { L } from "./i18n";
import type { Leg } from "./legs";

export interface StayTiming {
  text: string;
  /** Arriving (the way in) or leaving (the way out). */
  end: "in" | "out";
  /** Its one button's word. */
  act: string;
}

const legOf = (e: CatEntry): Leg | null =>
  e.piece.kind === "entry" ? (e.piece.entry.kind === "leg" || e.piece.entry.kind === "travel" ? (e.piece.entry.leg ?? null) : null) : null;

/** legs.ts's notes that are about the stay's own hours (not the metro at night, not the shuttle). */
const ARRIVING = /^(Geç varış|Giriş en geç|Varış .*giriş en erken|Late arrival|Check-in until|You land at .*check-in from)/;
const LEAVING = /^(Çıkış .*gidiş|Check-out .*leaving)/;

/** For every stay record at an end of a leg, its first note about its hours, the way in before the way out. */
export function stayTimings(sections: readonly Pick<CatSection, "entries">[]): Map<string, StayTiming> {
  const out = new Map<string, StayTiming>();
  const legs = new Map<string, Leg>();
  for (const s of sections) for (const e of s.entries) {
    const leg = legOf(e);
    if (leg) legs.set(leg.key, leg);
  }
  for (const leg of legs.values()) {
    const into = leg.to.item?.id;
    const from = leg.from.item?.id;
    const inNote = into ? leg.notes.find((n) => ARRIVING.test(n)) : undefined;
    if (into && inNote && !out.has(into)) out.set(into, { text: inNote, end: "in", act: L("Geç giriş bildir", "Tell them you're late") });
    const outNote = from ? leg.notes.find((n) => LEAVING.test(n)) : undefined;
    if (from && outNote && out.get(from)?.end !== "in") out.set(from, { text: outNote, end: "out", act: L("Geç çıkış sor", "Ask for a late check-out") });
  }
  return out;
}

/** The chat line its button sends: a message to the stay, ready to send. */
export const timingAsk = (t: StayTiming, stay: string): string =>
  t.end === "in"
    ? L(`${stay} için geç giriş mesajı yaz: ${t.text}`, `Write ${stay} a late check-in message: ${t.text}`)
    : L(`${stay} için geç çıkış ya da bavul emaneti mesajı yaz: ${t.text}`, `Write ${stay} a message asking for a late check-out or luggage storage: ${t.text}`);
