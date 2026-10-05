// src/lib/cardView.ts
// What a plan card says, from the record: the ring (to decide / chosen / done), the colour of its ground,
// the bottom strip (where it stands or which option, and its one action), the date on its top line, the
// ••• menu, the two ends of a trip, a media card's lines, and a transfer as a card. Pure.
import { L } from "./i18n";
import { formatDateRange, isoDate } from "./items";
import { clockOf } from "./legs";
import { isTrip } from "./travelKinds";
import { RENTAL_MODES, TICKET_MODES, type CardKind } from "./cardKinds";
import type { Item } from "./types";

export type Ring = "open" | "half" | "done";
/** Nothing to book: once planned it's done (a taxi from the rank, a note). */
const NO_BOOKING: readonly CardKind[] = ["taxi", "note"];

export function ringOf(item: Item, kind: CardKind): Ring {
  if (item.status === "booked") return "done";
  if (item.status === "chosen") return NO_BOOKING.includes(kind) ? "done" : "half";
  return "open";
}

/** The ground says what the ring says: sand until it's done, green once it is. */
export const groundOf = (ring: Ring): "sand" | "green" => (ring === "done" ? "green" : "sand");

export type FootAction = "choose" | "book" | "install" | "restore";
export type FootLeft =
  | { kind: "nav" }
  | { kind: "state"; tone: "wait" | "done" | "plain"; text: string; sub: string | null; alert: "red" | "amber" | null };
export interface FootView {
  left: FootLeft;
  action: { label: string; does: FootAction } | null;
}

const state = (tone: "wait" | "done" | "plain", text: string, sub: string | null = null): FootLeft => ({ kind: "state", tone, text, sub, alert: null });

type Words = { not: string; act: string; done: string };
const ticketWords = (): Words => ({ not: L("bilet alınmadı", "no ticket yet"), act: L("Bileti aldım", "I got the ticket"), done: L("Alındı", "Booked") });
const reserveWords = (): Words => ({ not: L("rezerve edilmedi", "not booked"), act: L("Rezerve ettim", "I booked it"), done: L("Rezerve", "Booked") });
function words(item: Item, kind: CardKind): Words {
  if ((TICKET_MODES as readonly string[]).includes(kind) || kind === "activity") return ticketWords();
  if (kind === "transport") return isTrip(item) ? ticketWords() : reserveWords();
  if (kind === "esim") return { not: L("satın alınmadı", "not bought"), act: L("Satın aldım", "I bought it"), done: L("Alındı", "Bought") };
  if (kind === "insurance") return { not: L("poliçe alınmadı", "no policy yet"), act: L("Poliçe aldım", "I got the policy"), done: L("Alındı", "Bought") };
  return reserveWords();
}

/** What a booking keeps on the card: the note said with it (a PNR, a meeting point), else until when it's free to cancel. */
function bookedSub(item: Item): string | null {
  if (item.statusNote) return item.statusNote;
  const until = isoDate(item.cancellation.freeUntil);
  return until ? L(`ücretsiz iptal: ${formatDateRange(until, null)}`, `free cancellation until ${formatDateRange(until, null)}`) : null;
}

/**
 * The bottom strip (spec's action table): an option shows the navigator (or "Karar bekliyor" alone) and
 * "Plana seç"; chosen, what's missing and the one action; done, a ✓ and what was kept. A deadline from
 * progress.dateAlert takes the small line.
 */
export function footOf(item: Item, kind: CardKind, opts: { options?: number; alert?: { tone: "red" | "amber"; text: string } | null } = {}): FootView {
  const w = words(item, kind);
  const alert = opts.alert ?? null;
  const withAlert = (left: FootLeft): FootLeft => (alert && left.kind === "state" ? { ...left, sub: alert.text, alert: alert.tone } : left);
  switch (item.status) {
    case "dismissed":
      return { left: state("plain", L("Elendi", "Ruled out")), action: { label: L("Geri al", "Undo"), does: "restore" } };
    case "saved":
      return {
        left: (opts.options ?? 1) > 1 ? { kind: "nav" } : withAlert(state("wait", L("Karar bekliyor", "To decide"))),
        action: { label: L("Plana seç", "Add to plan"), does: "choose" },
      };
    case "chosen": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), kind === "taxi" ? L("rezervasyon gerekmez", "no booking needed") : null)), action: null };
      const text = item.origin === "chat" ? L("Planlanıyor", "Planning") : L("Seçildi", "Chosen");
      return { left: withAlert(state("wait", text, w.not)), action: { label: w.act, does: "book" } };
    }
    case "booked": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), bookedSub(item))), action: null };
      if (kind === "esim" && !item.installedAt) {
        return { left: withAlert(state("wait", L("Alındı", "Bought"), L("kurulmadı", "not installed"))), action: { label: L("Kurdum", "Installed it"), does: "install" } };
      }
      if (kind === "esim") return { left: withAlert(state("done", L("Kuruldu", "Installed"), bookedSub(item))), action: null };
      return { left: withAlert(state("done", w.done, bookedSub(item))), action: null };
    }
  }
}

/** The top line's date: a day for a trip, a span for a rental, an eSIM or insurance, the hour too for an activity or a table. */
export function topDate(item: Item, kind: CardKind): string | null {
  const start = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  if (!start) return null;
  const end = isoDate(item.dates.end);
  const ranged = (RENTAL_MODES as readonly string[]).includes(kind) || kind === "esim" || kind === "insurance";
  if (ranged && end && end !== start) return formatDateRange(start, end);
  const time = kind === "activity" || kind === "food" ? clockOf(item.flight?.departure) : null;
  return time ? `${formatDateRange(start, null)} · ${time}` : formatDateRange(start, null);
}

export type MenuAction = "edit" | "dismiss" | "delete";
/** The ••• menu: change a plan made by hand or in the chat, rule out a saved option (it waits under Elenenler), delete. */
export function menuFor(item: Item): MenuAction[] {
  const out: MenuAction[] = [];
  if (item.origin === "chat") out.push("edit");
  if (item.status === "saved" && item.origin !== "chat") out.push("dismiss");
  out.push("delete");
  return out;
}
