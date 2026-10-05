// The trip's style on the hero's card: at most two words the model picks from a fixed list
// ("Romantik", "Dingin") for what it understood and the cities, and one for the money, worked out
// from the budget set (per person per day). Nothing outside the list is shown; no budget, no money word.
// Each word has its own icon and colours (hero v9); the money's is a neutral grey with a wallet.
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

/** A chip's icon (drawn by the hero's icon set, app/Icons.tsx). */
export type StyleIcon = "mountain" | "sparkle" | "heart" | "leaf" | "columns" | "tree" | "fork" | "wave" | "buildings" | "family" | "note" | "run" | "wallet";

/** Each style's icon and colours (background / text), from the hero v9 spec. */
export const STYLE_META: Record<StyleId, { icon: StyleIcon; bg: string; fg: string }> = {
  adventure: { icon: "mountain", bg: "#e3f3ea", fg: "#1f7a4d" },
  luxury: { icon: "sparkle", bg: "#ece8ff", fg: "#5b45e0" },
  romantic: { icon: "heart", bg: "#fde8ee", fg: "#b4235a" },
  calm: { icon: "leaf", bg: "#e6f2f1", fg: "#23786f" },
  culture: { icon: "columns", bg: "#f3ebe0", fg: "#8a5a1c" },
  nature: { icon: "tree", bg: "#e8f3e0", fg: "#3f7a1c" },
  food: { icon: "fork", bg: "#fdeee3", fg: "#b4532a" },
  beach: { icon: "wave", bg: "#e3f0fb", fg: "#1d63b8" },
  city: { icon: "buildings", bg: "#eceef3", fg: "#3d4a63" },
  family: { icon: "family", bg: "#fff3dc", fg: "#9a6400" },
  nightlife: { icon: "note", bg: "#f3e6fb", fg: "#7b2fa8" },
  active: { icon: "run", bg: "#e6f1fb", fg: "#2563c9" },
};

/** The money's chip: neutral, with a wallet. */
const BUDGET_META = { icon: "wallet", bg: "#efede8", fg: "#3a3a3c" } as const;

export interface StyleChip {
  label: string;
  icon: StyleIcon;
  bg: string;
  fg: string;
}

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

/** The hero card's chips: the style words, then the money's. */
export const styleChips = (ids: StyleId[], level: BudgetLevel | null): StyleChip[] => [
  ...ids.map((id) => ({ label: STYLES[id](), ...STYLE_META[id] })),
  ...(level ? [{ label: budgetLevelText(level), ...BUDGET_META }] : []),
];

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
