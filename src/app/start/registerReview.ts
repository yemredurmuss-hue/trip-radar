// The suggestions' review as the start chat's last step ("Öneriler"), registered through startHooks so the start
// code never depends on the suggestions code directly: the only file that knows both. It runs the same AI review
// the board runs (suggestReview.ts, for the same key, so the board doesn't ask again when it opens) and says how
// many suggestions the board will show (the rules' and the stored ones).
import { db, listItems } from "../../lib/db";
import { withLang } from "../../lib/i18n";
import { sectionOfItem } from "../../lib/categories";
import { buildLegs } from "../../lib/legs";
import { loadHome } from "../../lib/passport";
import { cityKeyOf } from "../../lib/plan";
import { boardMains } from "../../lib/startBoard";
import { setRulesPreview, setSuggestionsReview } from "../../lib/startHooks";
import { reviewKey, reviewPrompt, runReview } from "../../lib/suggestReview";
import { boardRules, ruleSuggestions, shownSuggestions } from "../../lib/suggestions";
import type { Item, Trip } from "../../lib/types";
import { buildTimeline } from "../../lib/timeline";
import { whoGoes } from "../../lib/tripSettings";
import { updateTrip } from "../actions";

export async function reviewNewTrip(tripId: string): Promise<number> {
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip) return 0;
  const items = await listItems(tripId);
  const { plan, mains } = boardMains(trip, items);
  const range = plan.range ?? trip.confirmedDates ?? null;
  const key = reviewKey(mains, range, items);
  const nights: Record<string, number> = {};
  for (const m of mains) {
    const keys = new Set([m.name, ...m.members].map(cityKeyOf));
    nights[cityKeyOf(m.name) ?? m.name] = plan.stayBlocks.filter((b) => b.city && keys.has(cityKeyOf(b.city))).reduce((n, b) => n + b.nights, 0);
  }
  const travellers = whoGoes({ travellers: trip.travellers, adults: null }).count || null;
  const prompt = withLang(trip.lang, () => reviewPrompt({ mains, nights, range, items, sectionOf: sectionOfItem, suggestions: trip.suggestions ?? [], travellers }));
  // Claims the review for this key first ({ key, at, state: "running" }), so the board opening meanwhile waits
  // instead of asking too; "skipped" when it was claimed already, "no-key" without a model: the rules still show.
  await runReview({ key, prompt, lang: trip.lang, playbook: trip.intent, save: (change) => updateTrip(tripId, change, { touch: false }) });
  const after = (await d.get("trips", tripId)) ?? trip;
  const legs = buildLegs(plan, after);
  const timeline = buildTimeline(plan, legs, items, new Set(after.hidden ?? []));
  const today = new Date().toISOString().slice(0, 10);
  const rules = ruleSuggestions({ trip: after, plan, items, timeline, legs, mains, home: await loadHome(), today });
  return shownSuggestions(after.suggestions, rules).length;
}

setSuggestionsReview(reviewNewTrip);

/** The rules' suggestions for what "Oluştur" would write (in memory, never stored): their titles for the preview. */
export function previewRules(trip: Trip, items: Item[], home: string | null): string[] {
  const today = new Date().toISOString().slice(0, 10);
  return boardRules(trip, items, home, today).map((s) => s.title).slice(0, 4);
}

setRulesPreview(previewRules);
