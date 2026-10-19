// What a row of cards needs from the Plan beyond its intent (CategoryPlan provides it for Etkinlik and Yapılacaklar): the
// plan's days and nights, for "Gün ver" (each day with the city slept in) and a city's days for the source's tours.
import { createContext, useContext } from "react";
import type { Plan } from "../../../lib/plan";

export interface CollectEnv {
  plan: Pick<Plan, "range" | "stayBlocks">;
}

export const CollectEnvContext = createContext<CollectEnv | null>(null);

/** Null outside the Plan (a row drawn elsewhere has no days to give). */
export const useCollectEnv = (): CollectEnv | null => useContext(CollectEnvContext);
