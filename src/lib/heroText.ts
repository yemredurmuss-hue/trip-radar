// The trip's mood sentence: AI-written, no numbers, cached per set of cities. Facts never come from the model.

export const MOOD_MAX = 120;

export function acceptMood(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= MOOD_MAX && !/\d/.test(t);
}

/** The mood sentence's key: its cities, and its language when it isn't the one written before 0.39.1 (i18n.ts contentTag). */
export const moodKey = (cities: string[], tag = "") => `${cities.map((c) => c.trim().toLowerCase()).join("|")}${tag ? `@${tag}` : ""}`;
