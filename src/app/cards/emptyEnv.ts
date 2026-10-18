// What the empty cards need from the board (TripPanel provides it on the Plan): how many go (the searches'
// head-count), the countries an eSIM is for, and the offers' data source (none connected today); the trip and its
// records for whose a plan is (kişiye özel rezervasyon: the badge, a person's own head count and place).
import { createContext, useContext } from "react";
import { NO_SOURCE, type SuggestionSource } from "../../lib/offerSource";
import type { Item, Trip } from "../../lib/types";

export interface EmptyEnv {
  tripId: string;
  /** The effective travellers (trip.travellers / whoGoes); null when unknown. */
  travellers: number | null;
  /** The trip's countries abroad (suggestions.foreignCountries), for the eSIM card's name and pages. */
  esimCountries: string[];
  offers: SuggestionSource;
  /** The trip on screen (its people and who comes from where); missing: nobody's plans are told apart. */
  trip?: Trip;
  /** The trip's records as the board shows them (an everyone's flight counts those with one of their own out). */
  items?: Item[];
}

export const EmptyEnvContext = createContext<EmptyEnv>({ tripId: "", travellers: null, esimCountries: [], offers: NO_SOURCE });
export const useEmptyEnv = (): EmptyEnv => useContext(EmptyEnvContext);
