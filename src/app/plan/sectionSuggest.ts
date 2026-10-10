// A section's suggestions handed to its own body (v11 revision, Emre 2026-10-09: "iki farklı yerde öneri çıkıyor"):
// Etkinlik ve turlar and Yapılacak şeyler show theirs among their ideas, as tiles, not as cards over the section.
import { createContext, useContext } from "react";
import type { Suggestion } from "../../lib/types";

export interface SectionSuggest {
  list: Suggestion[];
  add: (s: Suggestion) => void;
  dismiss: (s: Suggestion) => void;
  notes: Record<string, string>;
}

export const SectionSuggestContext = createContext<SectionSuggest | null>(null);
export const useSectionSuggest = (): SectionSuggest | null => useContext(SectionSuggestContext);
