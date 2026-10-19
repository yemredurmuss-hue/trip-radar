// The Bavul's list from the AI (v82 T6 a): asked once for the trip, when Hazırlık is first opened with its days and
// places known, through the traveller's own model (llm/getProvider), and kept on the trip (trip.packing.list). No key,
// an error, offline: nothing is kept and the list stays the one the trip itself gives (prepPack.ts rulesPack). While it's
// asked, the Bavul says "Bavul listesi hazırlanıyor…" (lib/looking.ts packLooking; 0.38.8).
import { useEffect } from "react";
import type { CityWeather } from "../../../lib/climate";
import { withLang } from "../../../lib/i18n";
import { getProvider, MissingKeyError } from "../../../lib/llm";
import { packLooking } from "../../../lib/looking";
import { acceptPack, packPrompt, packSchema, packSystemPrompt, type PackPromptInput } from "../../../lib/prepPack";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";

/** Asked in this page already (a trip's list is asked once; a failure isn't asked again until the board opens again). */
const asked = new Set<string>();

export function usePackAi(trip: Trip, input: PackPromptInput & { weather: CityWeather[] }, ready: boolean): void {
  const has = trip.packing?.list != null;
  useEffect(() => {
    if (has || !ready || trip.demo || asked.has(trip.id)) return;
    asked.add(trip.id);
    void packLooking.track(trip.id, (async () => {
      try {
        const llm = await getProvider();
        // In the trip's own language (the one its start chat spoke), whatever the board's: the list is the trip's.
        const out = await llm.generateJson(withLang(trip.lang, packSystemPrompt), packPrompt(input), packSchema);
        const list = acceptPack(out, Date.now(), input.never);
        if (!list) return;
        await updateTrip(trip.id, (t) => (t.packing?.list ? t : { ...t, packing: { ...t.packing, list } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("packing list", error); // the trip's own list stands
      }
    })());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per trip, when it's ready
  }, [trip.id, has, ready]);
}
