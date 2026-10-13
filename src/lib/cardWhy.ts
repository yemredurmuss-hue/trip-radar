// The card's "neden" line (K6, docs/urun-yol-haritasi.md): one short line saying why this card is on the plan in the traveller's
// own word: "Direkt · direkt şart dediğin için", "Sessiz · "Sessiz bir yer istiyoruz" dediğin için". It is only ever made from
// what they said or did (a must, an amenity they ticked, a note they wrote, a level they gave, a guess they confirmed); when
// nothing of theirs stands behind the card there is no line. Pure.
import { CRITERION_LABELS, LEVEL_LABELS } from "./decision";
import { L } from "./i18n";
import { lowerText } from "./i18nText";
import type { NeedCheck, NeedSource } from "./needs";
import type { Item } from "./types";

export interface CardWhy {
  /** What the card has, in a word or two ("Sessiz", "Direkt"). */
  what: string;
  /** Why, in their word ("direkt şart dediğin için"). */
  because: string;
  /** More on where the guess came from (a guess they confirmed): the tooltip. */
  title?: string;
  source: NeedSource["kind"] | "word";
}

const NOTE_WORDS = 6;
/** A note's first words as written, for the quote ("Sessiz bir yer istiyoruz", "Odada mutlaka bir şarap…"). */
function quote(text: string): string {
  const words = text.trim().replace(/[.!?,;:]+$/, "").split(/\s+/).filter(Boolean);
  return words.length <= NOTE_WORDS ? words.join(" ") : `${words.slice(0, NOTE_WORDS).join(" ")}…`;
}

function becauseOf(need: NeedCheck, source: NeedSource): Pick<CardWhy, "because" | "title"> {
  const word = lowerText(need.label);
  switch (source.kind) {
    case "requirement":
      return { because: L(`${word} şart dediğin için`, `you made ${word} a must`) };
    case "amenity":
      return { because: L(`${word} istediğin için`, `you wanted ${word}`) };
    case "note":
      return { because: L(`“${quote(source.text)}” dediğin için`, `you said “${quote(source.text)}”`) };
    case "level": {
      const level = lowerText(LEVEL_LABELS[source.level] ?? "");
      const criterion = lowerText(CRITERION_LABELS[source.criterion]);
      return { because: L(`${criterion} ${level} dediğin için`, `you said ${criterion} is ${level}`) };
    }
    case "inferred":
      return { because: L("seçimlerinden anladığım için", "I read it from your choices"), title: source.evidence || undefined };
  }
}

/** Words that say nothing about a thing in a note ("istiyoruz", "mutlaka", "olsun"): never what a card is matched on. */
const FILLER_WORDS = ["istiyoruz", "istiyorum", "isterim", "isteriz", "olsun", "olmalı", "mutlaka", "güzel", "gibi", "biraz", "ayrıca", "lazım", "gerek", "yapmak", "gitmek", "görmek", "wants", "would", "should", "please", "really"];
const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const FILLER = new Set(FILLER_WORDS.map((w) => fold(w)));
const wordsOf = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 5 && !FILLER.has(w));

/**
 * A note's own word in the card's name ("şarap" in "Douro şarap turu"): whole words from five letters, the first five letters
 * compared (so "şarabı" and "şarap" meet). Only the traveller's words and the card's own name; nothing else is matched.
 */
function noteWord(item: Item, notes: string[]): { word: string; note: string } | null {
  // A thing to do or eat, not a stay or a ticket (their place and way are the needs'), and not the city's own name.
  if (!["activity", "food", "other"].includes(item.category)) return null;
  const place = new Set(wordsOf(`${item.city ?? ""} ${item.country ?? ""}`).map((w) => w.slice(0, 5)));
  const name = new Set(wordsOf(item.name).map((w) => w.slice(0, 5)).filter((w) => !place.has(w)));
  for (const note of notes) {
    for (const w of wordsOf(note)) {
      if (name.has(w.slice(0, 5))) {
        const shown = note.trim().split(/[^\p{L}\p{N}]+/u).find((x) => fold(x).slice(0, 5) === w.slice(0, 5));
        return shown ? { word: shown, note } : null;
      }
    }
  }
  return null;
}

/**
 * Why this card, in one line, or null. The first of the traveller's needs the card meets (they are in the order they matter:
 * musts, amenities, notes, levels); a card nobody's words stand behind says nothing. A thing that isn't met is not a reason.
 */
export function cardWhy(item: Item, needs: NeedCheck[], notes: string[] = []): CardWhy | null {
  const met = needs.find((n) => n.state === "yes" && n.source);
  if (met?.source) return { what: met.label, source: met.source.kind, ...becauseOf(met, met.source) };
  const hit = noteWord(item, notes);
  if (hit) {
    const what = hit.word.charAt(0).toLocaleUpperCase("tr") + hit.word.slice(1);
    return { what, source: "word", because: L(`“${quote(hit.note)}” dediğin için`, `you said “${quote(hit.note)}”`) };
  }
  return null;
}

/** The line as it is read. */
export const whyText = (w: CardWhy): string => `${w.what} · ${w.because}`;
