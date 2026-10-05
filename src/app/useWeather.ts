// The hero's weather row: each city's likely weather for its days, fetched once a day per city and
// cached in this browser. A city with no answer (offline, not found) is left out.
import { useEffect, useState } from "react";
import { cacheWeather, cachedWeather, cityWeather, type CityWeather } from "../lib/climate";
import { geocode } from "../lib/geo";

export function useWeather(places: { city: string; start: string; end: string }[], country: string | null, today: string): CityWeather[] {
  const key = places.map((p) => `${p.city}|${p.start}|${p.end}`).join(";");
  const [found, setFound] = useState<Record<string, CityWeather | null>>({});
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const p of places) {
        const k = `${p.city}|${p.start}|${p.end}|${today}`;
        const cached = cachedWeather(k);
        if (cached !== undefined) {
          if (alive) setFound((f) => ({ ...f, [p.city]: cached }));
          continue;
        }
        try {
          const at = await geocode(country ? `${p.city}, ${country}` : p.city);
          const w = at ? await cityWeather(p.city, at, p, today) : null;
          cacheWeather(k, w);
          if (alive) setFound((f) => ({ ...f, [p.city]: w }));
        } catch {
          // offline or the service is down: no row for this city, asked again next time
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, country, today]);
  return places.map((p) => found[p.city]).filter((w): w is CityWeather => !!w);
}
