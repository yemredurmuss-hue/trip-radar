// Where each of the first three options stands, in a few words, and why: the best one for this
// traveller, then what each of the next two does that the first doesn't. What the traveller asked for
// comes first (a kitchen the first one lacks, the quietest), then what only that place has (a river
// view), then the usual strengths (cheapest, best reviewed, easiest to get around from). Pure.
import { needsFor } from "./cardFacts";
import { advantageOver, type DecisionContext, type GroupDecision, type OptionResult } from "./decision";
import { formatPrice } from "./items";
import { locationText } from "./needs";
import { cardLines, prosConsFor, tagOf } from "./proscons";

export interface Standing {
  /** 1, 2 or 3: best first. */
  rank: number;
  /** "Senin için en iyi", "Mutfak var", "Nehir manzarası", "En ucuz"... */
  label: string;
  /** Why, in a few words: "sessiz odalar, ücretsiz iptal", "1. seçenekte yok", "€45 daha ucuz". */
  why: string | null;
}

type Ctx = Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> & { preferences?: string[] };

const lower = (s: string) => s.charAt(0).toLocaleLowerCase("tr") + s.slice(1);
/** A need's or a line's words without the evidence ("Sessiz odalar, iyi uyku · 3 yorum" → "Sessiz odalar"). */
const gist = (text: string) => text.split(/ · |,/)[0].trim();
const part = (o: OptionResult, c: string) => o.parts.find((p) => p.criterion === c);

/** The first three options still in play, each with where it stands and why. */
export function standingsOf(d: GroupDecision, ctx: Ctx): Map<string, Standing> {
  const out = new Map<string, Standing>();
  const inPlay = d.options.filter((o) => o.score != null && !o.unmet.length && !o.eliminated && !o.excluded);
  if (inPlay.length < 2) return out;
  const top = inPlay.slice(0, 3);
  const needs = new Map(top.map((o) => [o.item.id, needsFor(o.item, d, ctx)]));
  // What only this place has, beyond what a need already says ("sessiz odalar" is the quiet it was asked for).
  const standouts = new Map(
    top.map((o) => {
      const covered = new Set(needs.get(o.item.id)!.flatMap((n) => n.covers));
      const pros = prosConsFor(o.item, d, ctx.listings, ctx)?.pros ?? [];
      return [o.item.id, pros.filter((p) => p.unique && !p.weak && !p.unverified && !covered.has(p.key)).map((p) => tagOf(p, "pro"))];
    }),
  );
  const [first] = top;
  const asked = [...needs.values()].some((list) => list.length > 0);
  const met = needs.get(first.item.id)!.filter((n) => n.state === "yes").map((n) => lower(gist(n.text)));
  // Why the first: what it answers, what only it has, then its strongest pluses ("en kısa, direkt").
  const strongest = (cardLines(prosConsFor(first.item, d, ctx.listings, ctx), 4).pros ?? [])
    .map((p) => lower(tagOf(p, "pro")))
    .filter((t) => !/ucuz|pahalı/.test(t));
  const firstWhy = [...new Set([...met, ...standouts.get(first.item.id)!.map(lower), ...strongest])].slice(0, 3).join(", ") || null;
  out.set(first.item.id, { rank: 1, label: asked ? "Senin için en iyi" : "En iyi seçim", why: firstWhy });
  const used = new Set<string>([out.get(first.item.id)!.label]);

  top.slice(1).forEach((o, i) => {
    const candidates: { label: string; why: string | null }[] = [];
    // What the traveller asked for that the first one doesn't have ("Mutfak var").
    const firstYes = new Set(needs.get(first.item.id)!.filter((n) => n.state === "yes").map((n) => n.key));
    for (const n of needs.get(o.item.id)!) if (n.state === "yes" && !firstYes.has(n.key)) candidates.push({ label: gist(n.text), why: "1. seçenekte yok" });
    // What only this place has.
    for (const s of standouts.get(o.item.id)!) candidates.push({ label: s, why: "yalnız bunda" });
    // The usual strengths, when it's the best of the three at one.
    const best = (c: string) => {
      const mine = part(o, c)?.s;
      return mine != null && top.every((x) => x === o || (part(x, c)?.s ?? -1) < mine);
    };
    if (best("price")) {
      const gap = (part(first, "price")?.value ?? 0) - (part(o, "price")?.value ?? 0);
      candidates.push({
        label: (first.score ?? 0) - (o.score ?? 0) <= 10 ? "Fiyat/performans" : "En ucuz",
        why: gap >= 1 ? `${formatPrice(gap, ctx.currency)} daha ucuz` : null,
      });
    }
    if (best("rating") || best("comfort")) candidates.push({ label: "En kaliteli", why: part(o, "rating")?.display ? `puan ${part(o, "rating")!.display!.split(" · ")[0]}` : "yorumları en iyi" });
    if (best("location")) candidates.push({ label: "En pratik konum", why: lower(locationText(part(o, "location")?.display) ?? "en yakın") });
    candidates.push({ label: "Alternatif", why: advantageOver(o, first, ctx.currency) });
    const pick = candidates.find((c) => !used.has(c.label)) ?? candidates.at(-1)!;
    used.add(pick.label);
    out.set(o.item.id, { rank: i + 2, ...pick });
  });
  return out;
}
