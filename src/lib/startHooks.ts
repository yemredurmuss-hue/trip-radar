// Where the start chat meets the suggestions (spec §1), without depending on them: the suggestions code,
// when it is there, registers its review here once (`setSuggestionsReview(review)` at module load, imported
// by the board), and "Gezimi oluştur" runs it as its last step. Until then that step isn't shown at all.

/** Reviews a newly made trip and leaves its suggestions on it; resolves to how many it left. */
export type SuggestionsReview = (tripId: string) => Promise<number>;

let review: SuggestionsReview | null = null;

export function setSuggestionsReview(fn: SuggestionsReview | null): void {
  review = fn;
}

export const suggestionsReview = (): SuggestionsReview | null => review;
