// The options board (otel panosu v2, docs/mockups/2026-10-06-otel-panosu-v2.html): the Comparison window's
// cards view. Which options show and in what order (Önerim, Fiyat, Puan, Konum; "Ücretsiz iptal" and
// "Elenenler" as filters), and the one badge each may carry: Önerim (the engine's winner), Favori (the most
// "Süper" from the people on the trip), En ucuz, En yüksek puan; a badge only when there's something to beat.
// Pure: worked out from the decision on every view.
import { ratingOutOf10, type GroupDecision, type OptionResult } from "./decision";

export type BoardSort = "best" | "price" | "rating" | "location";
export type BoardBadge = "pick" | "fav" | "cheap" | "top";

const part = (o: OptionResult, criterion: string) => o.parts.find((p) => p.criterion === criterion);
/** Its rating on a 10-point scale whatever the site's own (Airbnb's 5 stars, Booking's 10). */
const rating = (o: OptionResult): number | null => ratingOutOf10(o.item)?.value ?? null;
const out = (o: OptionResult) => !!o.excluded || !!o.eliminated;

/** "Ücretsiz iptal": a free cancellation the page told of (a date, or its words). */
export const freeCancel = (o: OptionResult): boolean =>
  !!o.item.cancellation.freeUntil || /ücretsiz iptal|free cancell?ation/i.test(o.item.cancellation.summary ?? "");

/**
 * The board's cards: the options in play, in the order asked (ties keep the engine's order); with
 * `withOut`, the ones ruled out follow, last.
 */
export function boardOptions(d: GroupDecision, opts: { sort?: BoardSort; freeOnly?: boolean; withOut?: boolean } = {}): OptionResult[] {
  const sort = opts.sort ?? "best";
  const live = d.options.filter((o) => !out(o) && (!opts.freeOnly || freeCancel(o)));
  const key = (o: OptionResult): number | null => {
    switch (sort) {
      case "best":
        return o.score;
      case "price": {
        const v = part(o, "price")?.value;
        return v == null ? null : -v; // cheapest first
      }
      case "rating":
        return rating(o);
      case "location":
        return part(o, "location")?.s ?? null;
    }
  };
  // The winner leads "Önerim" whatever the numbers say (it's the engine's call, ties and all).
  const ordered = live
    .map((o, i) => ({ o, i, k: key(o) }))
    .sort((a, b) => {
      if (sort === "best" && d.winner) {
        if (a.o === d.winner) return -1;
        if (b.o === d.winner) return 1;
      }
      if (a.k == null && b.k == null) return a.i - b.i;
      if (a.k == null) return 1;
      if (b.k == null) return -1;
      return b.k - a.k || a.i - b.i;
    })
    .map((x) => x.o);
  return opts.withOut ? [...ordered, ...d.options.filter(out)] : ordered;
}

/**
 * One badge per card, at most one card per badge, in this order: Önerim, Favori, En ucuz, En yüksek puan.
 * `loves`: how many "Süper" each option got (by item id). With one option there's nothing to badge.
 */
export function boardBadges(d: GroupDecision, loves: Map<string, number> = new Map()): Map<string, BoardBadge> {
  const live = d.options.filter((o) => !out(o));
  const badges = new Map<string, BoardBadge>();
  if (live.length < 2) return badges;
  const give = (o: OptionResult | undefined, badge: BoardBadge) => {
    if (o && !badges.has(o.item.id) && ![...badges.values()].includes(badge)) badges.set(o.item.id, badge);
  };
  if (d.winner && !out(d.winner)) give(d.winner, "pick");
  const fav = [...live].sort((a, b) => (loves.get(b.item.id) ?? 0) - (loves.get(a.item.id) ?? 0))[0];
  if ((loves.get(fav.item.id) ?? 0) > 0) give(fav, "fav");
  const best = (value: (o: OptionResult) => number | null | undefined, low: boolean) => {
    const known = live.filter((o) => value(o) != null);
    if (known.length < 2) return undefined;
    const sorted = [...known].sort((a, b) => (value(a)! - value(b)!) * (low ? 1 : -1));
    // A tie isn't a win.
    return value(sorted[0]) === value(sorted[1]) ? undefined : sorted[0];
  };
  give(best((o) => part(o, "price")?.value, true), "cheap");
  give(best(rating, false), "top");
  return badges;
}
