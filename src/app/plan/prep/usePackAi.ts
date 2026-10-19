// The Bavul's list from the AI (v82 T6 a): asked once for the trip, ahead in the model's line once the board shows the trip
// with its days and places known (PackPrefetch, 0.39.4), or first when Hazırlık is opened before it came, through the traveller's own model (llm/getProvider), and kept on the trip (trip.packing.list). No key,
// an error, offline: nothing is kept and the list stays the one the trip itself gives (prepPack.ts rulesPack). While it's
// asked, the Bavul says "Bavul listesi hazırlanıyor…" (lib/looking.ts packLooking; 0.38.8). Written in the board's
// language; a list made in another one and not touched yet is made again in it, once (prepPack.ts packRedo; 0.39.1).
import { useEffect, useMemo } from "react";
import type { CityWeather } from "../../../lib/climate";
import { countryInfo } from "../../../lib/countries";
import { contentLang, withLang } from "../../../lib/i18n";
import { getProvider, MissingKeyError, promoteAi, type AiPriority } from "../../../lib/llm";
import { packLooking } from "../../../lib/looking";
import { acceptPack, bagFact, kindWord, packPrompt, packRedo, packSchema, packSystemPrompt, planNames, stayCities, stayLines, type PackPromptInput } from "../../../lib/prepPack";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";
import { useEmptyEnv } from "../../cards/emptyEnv";
import { useCardEnv } from "../../cards/PlanCard";
import { usePrep, type PrepModel } from "./usePrep";

/**
 * Asked in this page already, by trip and language (a trip's list is asked once per language; a failure isn't asked
 * again until the board opens again).
 */
const asked = new Set<string>();

/** The model's line key for a trip's list in a language (llm/queue.ts): made ahead, pulled forward when Hazırlık opens. */
const packKey = (at: string) => `pack:${at}`;

/**
 * What the Bavul's list is asked with (the trip's countries, its cities and days, the weather, what's on the plan, the
 * bags, the plugs, the passport, what the traveller never or always packs), and whether enough is known to ask it: the
 * days, and a place. One for Hazırlık open and for the list asked ahead (PackPrefetch).
 */
export function packInputOf(model: Pick<PrepModel, "trip" | "items" | "range" | "countries" | "facts" | "mine" | "plug" | "passport">, weather: CityWeather[], people: number | null): { input: PackPromptInput & { weather: CityWeather[] }; ready: boolean } {
  const { trip, items, range, countries, facts, mine } = model;
  const cities = stayCities(items);
  const plugs = countryInfo(facts.country)?.plugs;
  return {
    input: {
      countries,
      cities: stayLines(items),
      range,
      people,
      kind: kindWord(trip.intent),
      weather,
      plan: planNames(items),
      bag: bagFact(items),
      plug: plugs?.length && model.plug ? `${plugs.join("/")} (${model.plug === "fits" ? "the traveller's plugs fit" : "an adapter is needed"})` : null,
      home: model.passport,
      never: mine.never,
      always: mine.always,
    },
    ready: range != null && (cities.length > 0 || countries.length > 0),
  };
}

/**
 * The Bavul's list asked ahead (0.39.4, Emre: "kategoriye basmadan AI çalışsın"): drawn on the board whatever is open, it
 * asks the trip's list in the model's line after the suggestions review and before the board's other AI jobs ("ahead"), so Hazırlık opens with it made; opened
 * first, Hazırlık's own ask pulls it to the front. Draws nothing.
 */
export function PackPrefetch(): null {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const model = usePrep([]);
  const cities = useMemo(() => stayCities(model.items), [model.items]);
  const weather = cities.map((c) => env.weather?.(c) ?? null).filter((w): w is CityWeather => w != null);
  const { input, ready } = packInputOf(model, weather, travellers);
  usePackAi(model.trip, input, ready, "ahead");
  return null;
}

export function usePackAi(trip: Trip, input: PackPromptInput & { weather: CityWeather[] }, ready: boolean, priority: AiPriority = "now"): void {
  const write = contentLang(trip.lang);
  const has = trip.packing?.list != null && !packRedo(trip.packing, write);
  useEffect(() => {
    const at = `${trip.id}:${write}`;
    if (has || !ready || trip.demo) return;
    // Asked ahead and still waiting in the line: Hazırlık opened, so it goes first.
    if (asked.has(at)) {
      if (priority === "now") promoteAi(packKey(at));
      return;
    }
    asked.add(at);
    void packLooking.track(trip.id, (async () => {
      try {
        const llm = await getProvider({ priority, key: packKey(at) });
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
  }, [trip.id, has, ready, write, priority]);
}
