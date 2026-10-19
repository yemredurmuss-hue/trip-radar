// 0.39.0 (Emre: "Seç" on another page under a booking made it vanish): with a booking in the box, picking another of its
// options is a switch. The button says so ("Bununla değiştir") and asks first; yes counts the booking as cancelled (it waits
// under Gizlenenler, "Geri getir" brings it back) and chooses the new one. Nothing is said about money or the site.
import { L } from "./i18n";
import type { Item } from "./types";

/** The booking a pick would replace: the one booked in a one-choice need, none for the one itself or with nothing booked. */
export function bookingReplaced(records: readonly Pick<Item, "id" | "status">[], next: Pick<Item, "id">, multi = false): string | null {
  if (multi) return null;
  return records.find((r) => r.status === "booked" && r.id !== next.id)?.id ?? null;
}

/** The pick button's word: "Bununla değiştir" while a booking holds the need, else "Seç". */
export const pickWord = (replacing: boolean): string => (replacing ? L("Bununla değiştir", "Switch to this") : L("Seç", "Choose"));

/** Its accessible name, with the option's name. */
export const pickAria = (title: string, replacing: boolean): string =>
  replacing ? L(`${title}: bununla değiştir`, `${title}: switch to this`) : L(`${title}: seç`, `${title}: choose`);

/** The question before switching (stageMenu's window: Vazgeç, and this answer). */
export function replaceAsk(booked: Pick<Item, "name">, next: Pick<Item, "name">): { title: string; text: string; ok: string } {
  return {
    title: L("Bununla değiştir", "Switch to this"),
    text: L(
      `${booked.name} rezervasyonun var. ${next.name} seçilirse ${booked.name} rezervasyonu iptal edildi sayılır.`,
      `You have a booking at ${booked.name}. If you choose ${next.name}, the ${booked.name} booking counts as cancelled.`,
    ),
    ok: L("Değiştir", "Switch"),
  };
}
