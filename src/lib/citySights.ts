// A city's sights from Google (spec 2026-10-19 SerpApi, item 3): the `offers` function's `kind=sights` gives the places
// Google lists first for a city, with their rating and photo. Two uses: an AI idea for a place Google lists takes Google's
// photo and rating (else its Wikipedia photo, as before); and when a city's "Gezilecek" ideas are fewer than three, its
// sights fill the row as ideas of their own, marked as Google's (K3: sourced, not the model's). Pure: asked through
// offerSources.
import { ratingText } from "./offerSource";
import type { Suggestion } from "./types";

export interface Sight {
  title: string;
  /** Out of 5 (Google). */
  rating: number | null;
  photo: string | null;
}

/** What the server sent, kept only when well-formed: at most eight, each named, a photo only over https. */
export function validSights(v: unknown): Sight[] {
  if (!Array.isArray(v)) return [];
  const out: Sight[] = [];
  for (const r of v as Record<string, unknown>[]) {
    const title = typeof r?.title === "string" ? r.title.trim().slice(0, 80) : "";
    if (!title) continue;
    const rating = typeof r.rating === "number" && r.rating > 0 && r.rating <= 5 ? r.rating : null;
    const photo = typeof r.photo === "string" && /^https:\/\//.test(r.photo) ? r.photo : null;
    out.push({ title, rating, photo });
    if (out.length === 8) break;
  }
  return out;
}

/** A name folded for comparing: no accents, no case, words only ("Clérigos Kilisesi" → "clerigos kilisesi"). */
export const foldName = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The sight an idea is about, by its names (placeSuggest.photoNames): the same name, or one name holding the other
 * whole ("Livraria Lello" in "Livraria Lello Bookshop"), six letters at least; a guess on a shared word ("Porto") is not
 * a match.
 */
export function matchSight(names: readonly string[], sights: readonly Sight[]): Sight | null {
  for (const n of names.map(foldName).filter((x) => x.length >= 6)) {
    const hit = sights.find((s) => {
      const t = foldName(s.title);
      return t === n || (t.length >= 6 && (` ${t} `.includes(` ${n} `) || ` ${n} `.includes(` ${t} `)));
    });
    if (hit) return hit;
  }
  return null;
}

/** A sight as an idea of the city's "Yapılacaklar": a place to see, its photo and rating Google's. */
export function sightSuggestion(city: string, s: Sight, now: number): Suggestion {
  return {
    key: `sight:${foldName(city).replace(/ /g, "-")}:${foldName(s.title).replace(/ /g, "-")}`,
    section: "todo",
    kind: "add",
    template: "todo",
    title: s.title,
    why: "",
    // A rule's: taken back ("Geri al") it simply shows again, as the row draws it from the city's sights.
    source: "rule",
    payload: { city, place: `${s.title}, ${city}`, photo: s.photo, rating: s.rating, from: "google" },
    createdAt: now,
    state: "open",
  };
}

/** The rating as the picture shows it ("★ 4,6"); null without one. */
export const sightRating = (rating: number | null | undefined): string | null => (rating != null && rating > 0 ? ratingText(rating) : null);
