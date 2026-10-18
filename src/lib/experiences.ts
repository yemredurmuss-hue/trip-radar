// What an experience is, by its name (0.36.24, moved out of dayRowTitle so the plan reads it too): a boat, a
// show, a museum, a tour, else an event. Words matched whole on the folded text. Pure.
import { ideaKindOf } from "./ideaKinds";
import type { Item } from "./types";

export const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

export type Experience = "boat" | "show" | "museum" | "tour" | "event";
// First match wins: a boat tour is a boat tour before it's a tour.
// Whole words of the folded text ("Kültürü" isn't a "turu", "Cooperativa" isn't an opera, a showroom isn't a show).
const EXPERIENCE_WORDS: [Experience, RegExp][] = [
  ["boat", /\b(tekne\w*|boats?|cruises?|cruzeiro|yat|yachts?|yelken\w*|sail|sailing|gulet|rabelo|catamaran|katamaran)\b/],
  ["show", /\b(gosteri\w*|shows?|konser\w*|concerts?|tiyatro\w*|theatre|theater|fado|opera|bale|ballet|performans\w*|performances?|musical|muzikal|flamenko|flamenco)\b/],
  ["museum", /\b(muze\w*|museums?|museu|museo|musee|galeri\w*|gallery|galleries|galeria)\b/],
  ["tour", /\b(tur|turu|turlari|tours?|rehberli|guided|mahzen\w*|cellars?|tadim\w*|tasting|excursions?|gezisi|safari)\b/],
];
/** By its name and option first; its summary only when they say nothing (a bookshop whose summary mentions a boat stays a bookshop). */
export function experienceOf(item: Item): Experience {
  const by = (text: string) => EXPERIENCE_WORDS.find(([, re]) => re.test(fold(text)))?.[0] ?? null;
  const own = by([item.name, item.optionDetail].filter(Boolean).join(" "));
  if (own) return own;
  // A name that already says what it is ("Livraria Lello": culture) isn't read from its summary.
  if (ideaKindOf({ ...item, summary: "", ideaKind: null })) return "event";
  return (item.summary ? by(item.summary) : null) ?? "event";
}
