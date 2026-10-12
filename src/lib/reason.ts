// "Gezinin sebebi" (plan v30): on a trip with a purpose (a festival, a burn, a ski week), the ticket or tour that is the reason
// for going leads Etkinlik ve turlar, pinned. It's found among the activities on the plan, not stored: the start made it
// from the intent's own words ("Festival bileti", the event's name). A classic trip has none. Pure.
import { L } from "./i18n";
import type { Item, Trip } from "./types";

/** Accents and Turkish dotted/dotless letters folded away, lower case, words only: "Özora" and "Ozora" are one. */
const fold = (text: string): string =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Words that say a title is the ticket to the trip's purpose. */
const TICKETISH = /\b(festival|festivali|bileti|bilet|ticket|kayak pasi|lift pass|ski pass)\b/;

/** The activity that is the trip's reason, or null (no purpose, or nothing on the plan reads like it). */
export function reasonItemOf(trip: Pick<Trip, "intent">, items: Item[]): Item | null {
  const intent = trip.intent;
  if (!intent || intent.playbook === "classic") return null;
  const name = fold(intent.name ?? "");
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  let best: { item: Item; score: number } | null = null;
  for (const item of items) {
    if (item.category !== "activity" || item.status === "dismissed") continue;
    const title = fold(item.name);
    let score = 0;
    if (name && title.includes(name)) score += 4;
    else if (words.length && words.every((w) => title.includes(w))) score += 3;
    else if (words.some((w) => title.includes(w))) score += 1;
    if (TICKETISH.test(title)) score += 2;
    if (score === 0) continue;
    if (item.status === "booked") score += 1;
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 2 ? best.item : null;
}

/**
 * The line a trip kind with its tour suggestions closed says in Etkinlik ve turlar ("Festival gezisi: tur önerisi kapalı;
 * sonrası için dinlenme önerdik"). `rest`: there is a stop after the festival to rest in (the line says so only then).
 */
export function closedNoteOf(kind: string, rest: boolean): string {
  if (kind === "festival") {
    return rest
      ? L("Festival gezisi: tur önerisi kapalı; sonrası için dinlenme önerdik", "Festival trip: tour suggestions are off; we suggested rest for after it")
      : L("Festival gezisi: tur önerisi kapalı", "Festival trip: tour suggestions are off");
  }
  return L("Bu gezide tur ve gezi önerilmez: gezinin sebebi bu.", "No tours or sightseeing are suggested on this trip: this is what it's for.");
}
