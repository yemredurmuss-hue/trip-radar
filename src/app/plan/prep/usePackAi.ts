// The Bavul's list from the AI (v82 T6 a): asked once for the trip, when Hazırlık is first opened with its days and
// places known, through the traveller's own model (llm/getProvider), and kept on the trip (trip.packing.list). No key,
// an error, offline: nothing is kept and the list stays the one the trip itself gives (prepPack.ts rulesPack). While it's
// asked, the Bavul says "Bavul listesi hazırlanıyor…" (lib/looking.ts packLooking; 0.38.8). Written in the board's
// language; a list made in another one and not touched yet is made again in it, once (prepPack.ts packRedo; 0.39.1).
import { useEffect } from "react";
import type { CityWeather } from "../../../lib/climate";
import { contentLang, withLang } from "../../../lib/i18n";
import { getProvider, MissingKeyError } from "../../../lib/llm";
import { packLooking } from "../../../lib/looking";
import { acceptPack, packPrompt, packRedo, packSchema, packSystemPrompt, type PackPromptInput } from "../../../lib/prepPack";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";

/**
 * Asked in this page already, by trip and language (a trip's list is asked once per language; a failure isn't asked
 * again until the board opens again).
 */
const asked = new Set<string>();

export function usePackAi(trip: Trip, input: PackPromptInput & { weather: CityWeather[] }, ready: boolean): void {
  const write = contentLang(trip.lang);
  const has = trip.packing?.list != null && !packRedo(trip.packing, write);
  useEffect(() => {
    const at = `${trip.id}:${write}`;
    if (has || !ready || trip.demo || asked.has(at)) return;
    asked.add(at);
    void packLooking.track(trip.id, (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(withLang(write, packSystemPrompt), packPrompt(input), packSchema);
        const made = acceptPack(out, Date.now(), input.never);
        if (!made) return;
        const list = { ...made, lang: write };
        // Kept unless a list is there meanwhile that stays (made in this language, or ticked since).
        await updateTrip(trip.id, (t) => (t.packing?.list && !packRedo(t.packing, write) ? t : { ...t, packing: { ...t.packing, list } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("packing list", error); // the trip's own list stands
      }
    })());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per trip and language, when it's ready
  }, [trip.id, has, ready, write]);
}
