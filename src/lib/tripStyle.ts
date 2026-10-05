// The trip's style under the hero's title: at most two words the model picks from a fixed list
// ("Romantik", "Dingin") for what it understood and the cities, and one for the money, worked out
// from the budget set (per person per day). Nothing outside the list is shown; no budget, no money word.
import { convert, type Rates } from "./currency";
import { L } from "./i18n";

export const STYLES = {
  romantic: () => L("Romantik", "Romantic"),
  calm: () => L("Dingin", "Calm"),
  adventure: () => L("Macera", "Adventure"),
  luxury: () => L("Lüks", "Luxury"),
  culture: () => L("Kültür", "Culture"),
  nature: () => L("Doğa", "Nature"),
  food: () => L("Gastronomi", "Food"),
  beach: () => L("Deniz", "Beach"),
  city: () => L("Şehir", "City"),
  family: () => L("Aile", "Family"),
  nightlife: () => L("Eğlence", "Nightlife"),
  active: () => L("Aktif", "Active"),
} as const;

export type StyleId = keyof typeof STYLES;
export const STYLE_MAX = 2;

/** What the model answered, kept only where it's on the list: at most two, each once. */
export function acceptStyle(ids: string[]): StyleId[] {
  const out: StyleId[] = [];
  for (const raw of ids) {
    const id = raw.trim().toLowerCase();
    if (id in STYLES && !out.includes(id as StyleId)) out.push(id as StyleId);
    if (out.length === STYLE_MAX) break;
  }
  return out;
}

/** Asked again only when the cities or what was understood change. */
export const styleKey = (cities: string[], understood: string[]) => [cities.map((c) => c.trim().toLowerCase()).join("|"), understood.join("|")].join("#");

export type BudgetLevel = "low" | "mid" | "high";

/** Per person per day, in euros: under 70 economy, up to 180 middle, above that high. */
export function budgetLevel(budget: { amount: number; currency: string } | null | undefined, days: number, people: number | null, rates: Rates | null): BudgetLevel | null {
  if (!budget || budget.amount <= 0 || days <= 0) return null;
  const eur = convert(budget.amount, budget.currency, "EUR", rates);
  if (eur == null) return null;
  const daily = eur / days / Math.max(1, people ?? 1);
  return daily < 70 ? "low" : daily <= 180 ? "mid" : "high";
}

export const budgetLevelText = (level: BudgetLevel): string =>
  ({ low: L("Ekonomik", "Budget"), mid: L("Orta bütçe", "Mid-range"), high: L("Yüksek bütçe", "High budget") })[level];

/** The chips under the title: the style words, then the money's. */
export const styleChips = (ids: StyleId[], level: BudgetLevel | null): string[] => [...ids.map((id) => STYLES[id]()), ...(level ? [budgetLevelText(level)] : [])];

/** The model's instructions: the list it may pick from, in the board's language. */
export const stylePrompt = () =>
  L(
    `Bu gezinin tarzını en fazla ${STYLE_MAX} etiketle seç, yalnız bu listeden (id yaz): ${Object.entries(STYLES)
      .map(([id, label]) => `${id} (${label()})`)
      .join(", ")}. Emin değilsen daha az seç; hiçbiri uymuyorsa boş liste döndür.`,
    `Pick at most ${STYLE_MAX} tags for this trip's style, only from this list (write the id): ${Object.entries(STYLES)
      .map(([id, label]) => `${id} (${label()})`)
      .join(", ")}. If unsure pick fewer; if none fits return an empty list.`,
  );
