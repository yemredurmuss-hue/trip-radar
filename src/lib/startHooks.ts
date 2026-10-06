// Where the start chat meets the suggestions (spec §1), without depending on them: the suggestions code,
// when it is there, registers its review here once (`setSuggestionsReview(review)` at module load, imported
// by the board), and "Gezimi oluştur" runs it as its last step. Until then that step isn't shown at all.

import type { Item, Trip } from "./types";

/** Reviews a newly made trip and leaves its suggestions on it; resolves to how many it left. */
export type SuggestionsReview = (tripId: string) => Promise<number>;

let review: SuggestionsReview | null = null;

export function setSuggestionsReview(fn: SuggestionsReview | null): void {
  review = fn;
}

export const suggestionsReview = (): SuggestionsReview | null => review;

/**
 * The rules' suggestions for a trip that isn't made yet (the start chat's preview, item 7): their titles, worked
 * out in memory from what "Oluştur" would write. Registered the same way; no preview of them until it is.
 */
export type RulesPreview = (trip: Trip, items: Item[], home: string | null) => string[];

let rules: RulesPreview | null = null;

export function setRulesPreview(fn: RulesPreview | null): void {
  rules = fn;
}

export const rulesPreview = (): RulesPreview | null => rules;
