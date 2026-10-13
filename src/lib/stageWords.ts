// The five looks a plan can wear and their words, in one place (plan v46, F0): a card, a count, a swatch of the key,
// a day's line and the Board all say "Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı" from here and nowhere
// else. lifecycle.ts keeps its own stage names as code names; what the traveller reads comes from this file. Pure.
import { L } from "./i18n";
import type { Stage } from "./lifecycle";

/** Searching (nothing yet) · our pick (a draft, not chosen) · chosen · bought or booked · arranged by the traveller. */
export type Look = "search" | "draft" | "chosen" | "booked" | "arranged";

/** What a stage looks like on screen: the options and the plain "to find" both read as searching. The side stages have no look. */
export function lookOf(stage: Stage, opts: { arranged?: boolean } = {}): Look | null {
  switch (stage) {
    case "search":
    case "options":
      return "search";
    case "planned":
      return opts.arranged ? "arranged" : "chosen";
    case "booked":
    case "ready":
    case "used":
      return opts.arranged ? "arranged" : "booked";
    default:
      return null;
  }
}

/**
 * The word of a look. A booked look says what was done to it: a ticket ("Bilet alındı": a flight, a train, a tour),
 * a purchase ("Alındı": an eSIM, a policy), else a reservation ("Rezerve": a stay, a car, a table).
 */
export function lookWord(look: Look, opts: { as?: "ticket" | "bought" } = {}): string {
  switch (look) {
    case "search":
      return L("Arıyoruz", "Searching");
    case "draft":
      return L("Önerimiz", "Our pick");
    case "chosen":
      return L("Seçildi", "Chosen");
    case "booked":
      return opts.as === "ticket" ? L("Bilet alındı", "Ticket bought") : opts.as === "bought" ? L("Alındı", "Bought") : L("Rezerve", "Booked");
    case "arranged":
      return L("Ayarlandı", "Arranged");
  }
}

/** The five looks in the order the key draws them. */
export const LOOKS: readonly Look[] = ["search", "draft", "chosen", "booked", "arranged"];
