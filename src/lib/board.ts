// The options board (otel panosu v2, docs/mockups/2026-10-06-otel-panosu-v2.html): the Comparison window's
// cards view. Which options show and in what order (Önerim, Fiyat, Puan, Konum; "Ücretsiz iptal" and
// "Elenenler" as filters), and the one badge each may carry: Önerim (the engine's winner), Favori (the most
// "Süper" from the people on the trip), En ucuz, En yüksek puan; a badge only when there's something to beat.
// Pure: worked out from the decision on every view.
import { ratingOutOf10, type GroupDecision, type OptionResult } from "./decision";
import { L } from "./i18n";
import { nNights } from "./i18nText";
import { formatDateRange, nightsBetween } from "./items";
import { stayRange } from "./plan";

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

/**
 * A stay's own dates when they aren't the ones most options are for ("8–11 Ekim · 3 gece · 1 gün geç"): one
 * a day earlier or a few days later is still on the table, its price compared per night (decision.ts). Null
 * when it's on the usual dates, or its dates aren't known.
 */
export function otherDates(o: OptionResult, d: GroupDecision): { text: string; title: string } | null {
  const own = stayRange(o.item);
  if (!own) return null;
  const counts = new Map<string, number>();
  for (const x of d.options) {
    const r = stayRange(x.item);
    if (r) counts.set(`${r.start}|${r.end}`, (counts.get(`${r.start}|${r.end}`) ?? 0) + 1);
  }
  const usual = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!usual || usual === `${own.start}|${own.end}`) return null;
  const [start, end] = usual.split("|");
  const nights = nightsBetween(own.start, own.end);
  // "1 gün geç" when the whole stay moves; "giriş 1 gün erken" / "çıkış 2 gün geç" when one end does.
  const shift = (days: number) => L(`${Math.abs(days)} gün ${days < 0 ? "erken" : "geç"}`, `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ${days < 0 ? "early" : "late"}`);
  const dIn = nightsBetween(start, own.start);
  const dOut = nightsBetween(end, own.end);
  const how =
    dIn === dOut
      ? shift(dIn)
      : [dIn ? L(`giriş ${shift(dIn)}`, `in ${shift(dIn)}`) : "", dOut ? L(`çıkış ${shift(dOut)}`, `out ${shift(dOut)}`) : ""].filter(Boolean).join(", ");
  return {
    text: [formatDateRange(own.start, own.end), nNights(nights), how].filter(Boolean).join(" · "),
    title: L(
      `Diğerleri ${formatDateRange(start, end)} için; bu başka tarihler için fiyat. Fiyat geceye göre karşılaştırıldı.`,
      `The others are for ${formatDateRange(start, end)}; this one is priced for other dates. Prices compared per night.`,
    ),
  };
}
