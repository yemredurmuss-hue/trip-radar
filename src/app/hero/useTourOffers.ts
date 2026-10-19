// The connected source's tours for the trip's Etkinlik cities, for the hero's mosaic and the closed row's small pictures
// (0.38.3): the same questions the rows ask (heroMosaic.tourNeeds), so the source answers them from its store or with the
// one request already going out (offerSources: the same question asked twice at once goes out once). Nothing while no
// source is connected; a failure is no tours.
import { useEffect, useMemo, useState } from "react";
import type { Need, Offer, SuggestionSource } from "../../lib/offerSource";
import { cityTours } from "../../lib/offerSources";

export function useTourOffers(source: Pick<SuggestionSource, "offers" | "available">, needs: readonly { need: Need; country: string | null }[]): { city: string; offers: Offer[] }[] {
  const [got, setGot] = useState<Record<string, Offer[]>>({});
  const available = source.available();
  const asked = needs.map((n) => `${n.need.key}|${n.need.adults ?? ""}|${n.country ?? ""}`).join(" ");
  useEffect(() => {
    if (!available || !needs.length) return;
    let live = true;
    for (const { need, country } of needs)
      void cityTours(source, need, country).then((list) => live && setGot((g) => ({ ...g, [need.key]: list })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for other cities, days, people or countries
  }, [asked, available, source]);
  return useMemo(() => needs.map(({ need }) => ({ city: need.city ?? "", offers: got[need.key] ?? [] })), [needs, got]);
}
