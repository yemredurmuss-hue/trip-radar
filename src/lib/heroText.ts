// The trip's mood sentence: AI-written, no numbers, cached per set of cities. Facts never come from the model.

export const MOOD_MAX = 120;

export function acceptMood(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= MOOD_MAX && !/\d/.test(t);
}

export const moodKey = (cities: string[]) => cities.map((c) => c.trim().toLowerCase()).join("|");
