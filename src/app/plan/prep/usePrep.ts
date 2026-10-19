// What Hazırlık reads from the board (v82 aşama 7): the trip and its records (the plan's EmptyEnv), the passport and the
// traveller's own country and name (chrome.storage.local), their own Bavul lists, and from those the dated chores
// (lib/prepDays.ts). Hazırlık's closed row says the same as its open list: `usePrepSummary` is the one number and line.
import { useEffect, useMemo, useState } from "react";
import { recordOf, type CatEntry } from "../../../lib/categories";
import { displayCurrency } from "../../../lib/displayCurrency";
import { countryCodesOf, currencyName, plugFit } from "../../../lib/heroInfo";
import { lang } from "../../../lib/i18n";
import { tripDateRange } from "../../../lib/items";
import { loadHome, loadPassport } from "../../../lib/passport";
import { prepSummary, prepTasks, type PrepSummary, type PrepTask } from "../../../lib/prepDays";
import { isPackLine, loadPackMine, savePackMine, type PackMine } from "../../../lib/prepPack";
import { chromeKV } from "../../../lib/share/store";
import { homeFromFlights } from "../../../lib/suggestions";
import { homeCurrencyOf, tripFacts, type TripFacts } from "../../../lib/tripFacts";
import type { Item, Trip } from "../../../lib/types";
import { useEmptyEnv } from "../../cards/emptyEnv";
import { useCardEnv } from "../../cards/PlanCard";
import { useMyName } from "../../Profile";

/** Reads chrome.storage.local now and again when one of `keys` changes (Settings, another tab); nothing on a plain page. */
function useStored<T>(read: () => Promise<T>, initial: T, keys: string[]): T {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    let gone = false;
    const load = () => void read().then((v) => !gone && setValue(v), () => undefined);
    load();
    const onChange = (changes: Record<string, unknown>) => keys.some((k) => k in changes) && load();
    try {
      chrome.storage.onChanged.addListener(onChange);
      return () => {
        gone = true;
        chrome.storage.onChanged.removeListener(onChange);
      };
    } catch {
      return () => void (gone = true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, then on a change of the keys
  }, []);
  return value;
}

const MINE_EMPTY: PackMine = { always: [], never: [] };

export interface PrepModel {
  trip: Trip;
  items: Item[];
  today: string;
  /** The chores, by day, and the closed row's count and line. */
  tasks: PrepTask[];
  summary: PrepSummary;
  /** Hazırlık's records that are things to take: the Bavul's own lines. */
  packs: Item[];
  range: { start: string; end: string } | null;
  /** The trip's countries (ISO), the main one first. */
  countries: string[];
  facts: TripFacts;
  passport: string;
  /** The country whose shops a thing to buy opens (Settings → Pasaport, else where the first flight leaves). */
  shopHome: string | null;
  /** The traveller's name ("Emre"): whose Bavul it is. */
  name: string | null;
  mine: PackMine;
  saveMine: (next: PackMine) => void;
  /** The money there and the plugs, as the hero has them. */
  money: { name: string; rate: string | null; own: boolean } | null;
  plug: ReturnType<typeof plugFit>;
}

export function usePrep(entries: CatEntry[]): PrepModel {
  const env = useCardEnv();
  const empty = useEmptyEnv();
  const trip = empty.trip ?? env.trip;
  const items = useMemo(() => empty.items ?? [], [empty.items]);
  const passport = useStored(loadPassport, "TR", ["passport"]);
  const home = useStored(loadHome, null, ["passport"]);
  const stored = useStored(() => loadPackMine(chromeKV), MINE_EMPTY, ["packMine"]);
  // What was just saved here, until storage says it back.
  const [mine, setMine] = useState<PackMine | null>(null);
  useEffect(() => setMine(null), [stored]);
  const name = useMyName().trim() || null;
  const records = useMemo(() => entries.map(recordOf).filter((i): i is Item => i != null), [entries]);
  const packs = useMemo(() => records.filter(isPackLine), [records]);
  const chores = useMemo(() => records.filter((r) => !isPackLine(r)), [records]);
  const range = trip.confirmedDates ?? tripDateRange(items);
  const rates = env.decisions?.ctx.rates ?? null;
  const currency = env.decisions?.ctx.currency ?? "EUR";
  const facts = useMemo(
    () => tripFacts(items, { passport, homeCurrency: displayCurrency() ?? homeCurrencyOf(passport, currency), rates, homeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, start: range?.start ?? null }),
    [items, passport, currency, rates, range?.start],
  );
  const countries = useMemo(() => {
    const all = [...countryCodesOf(items), ...empty.esimCountries.map((c) => c.toUpperCase())];
    const main = facts.country;
    return [...new Set(main ? [main, ...all] : all)];
  }, [items, empty.esimCountries, facts.country]);
  const tasks = useMemo(
    () => prepTasks({ chores, items, trip, range, passport, countries, today: env.today }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the trip's fields it reads
    [chores, items, trip.prepDone, trip.hidden, trip.visaDone, range?.start, range?.end, passport, countries, env.today],
  );
  const local = facts.local;
  return {
    trip,
    items,
    today: env.today,
    tasks,
    summary: prepSummary(tasks),
    packs,
    range,
    countries,
    facts,
    passport,
    shopHome: home ?? homeFromFlights(items) ?? (lang() === "tr" ? "TR" : null),
    name,
    mine: mine ?? stored,
    saveMine: (next) => {
      setMine(next);
      void savePackMine(next, chromeKV).catch(() => undefined);
    },
    money: local ? { name: currencyName(local.currency), rate: local.rateText, own: local.currency === (displayCurrency() ?? homeCurrencyOf(passport, currency)) } : null,
    plug: facts.country ? plugFit(passport, facts.country) : null,
  };
}

/**
 * Hazırlık's closed row (K0): "Gezi öncesi 6 iş · sıradaki: Yen bozdur, 1 Nis'ten önce" and "2/6 hazır", the same count as
 * the open list. For the category row's shell (aşama 2): `collectionSummary`'s Hazırlık line and bar.
 */
export const usePrepSummary = (entries: CatEntry[]): PrepSummary => usePrep(entries).summary;
