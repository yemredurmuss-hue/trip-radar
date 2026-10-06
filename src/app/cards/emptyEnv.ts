// What the empty cards need from the board (TripPanel provides it on the Plan): how many go (the searches'
// head-count), the countries an eSIM is for, and the offers' data source (none connected today).
import { createContext, useContext } from "react";
import { NO_SOURCE, type SuggestionSource } from "../../lib/offerSource";

export interface EmptyEnv {
  tripId: string;
  /** The effective travellers (trip.travellers / whoGoes); null when unknown. */
  travellers: number | null;
  /** The trip's countries abroad (suggestions.foreignCountries), for the eSIM card's name and pages. */
  esimCountries: string[];
  offers: SuggestionSource;
}

export const EmptyEnvContext = createContext<EmptyEnv>({ tripId: "", travellers: null, esimCountries: [], offers: NO_SOURCE });
export const useEmptyEnv = (): EmptyEnv => useContext(EmptyEnvContext);
