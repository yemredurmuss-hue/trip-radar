// The ideas' kinds (fikir havuzu v1, docs/mockups/2026-10-05-fikir-havuzu-v1.html): a thing to do is a view,
// culture, nature, a market or shopping, a walk about, or fun; a restaurant is breakfast and coffee, lunch,
// dinner, something sweet, or a bar and wine. Read from its words (then a restaurant's meal); the traveller's
// own pick (`item.ideaKind`) wins. The kind gives the row its icon and the section its filter chips. Pure.
import { L } from "./i18n";
import { isFoodIdea } from "./ideas";
import type { Item } from "./types";

export type TodoKind = "view" | "culture" | "nature" | "shop" | "walk" | "fun";
export type FoodKind = "coffee" | "lunch" | "dinner" | "sweet" | "bar";
export type IdeaKind = TodoKind | FoodKind;

export const TODO_KINDS: readonly TodoKind[] = ["view", "culture", "nature", "shop", "walk", "fun"];
export const FOOD_KINDS: readonly FoodKind[] = ["coffee", "lunch", "dinner", "sweet", "bar"];

const LABELS: Record<IdeaKind, [string, string]> = {
  view: ["Manzara", "Views"],
  culture: ["Kültür", "Culture"],
  nature: ["Doğa", "Nature"],
  shop: ["Pazar & alışveriş", "Markets & shopping"],
  walk: ["Gezinti", "Walks"],
  fun: ["Eğlence", "Fun"],
  coffee: ["Kahvaltı & kahve", "Breakfast & coffee"],
  lunch: ["Öğle", "Lunch"],
  dinner: ["Akşam", "Dinner"],
  sweet: ["Tatlı", "Sweets"],
  bar: ["Bar & şarap", "Bars & wine"],
};
export const kindLabel = (k: IdeaKind): string => L(...LABELS[k]);

/** The kind's colour (its icon on a soft square). */
export const KIND_TINT: Record<IdeaKind, string> = {
  view: "#d29a00", culture: "#6a4fe0", nature: "#2f8a4c", shop: "#c0256b", walk: "#3b6fd1", fun: "#a8336f",
  coffee: "#8a5a2b", lunch: "#c06a1e", dinner: "#b4532a", sweet: "#d0607f", bar: "#7a2e4f",
};

const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

// First match wins: a sunset from a bridge is a view, a hike to a viewpoint at dawn too.
const TODO_WORDS: [TodoKind, RegExp][] = [
  ["view", /gun batim|gun dogum|sunset|sunrise|manzara|seyir|viewpoint|miradouro|panorama|teras|terrace|lookout|belvedere/],
  ["culture", /muze|museum|museu|kitap|livraria|library|kutuphane|galeri|gallery|katedral|cathedral|kilise|church|igreja|\bse\b|saray|palace|palacio(?! de cristal)|kale|castle|castelo|tarih|history|story cent|anit|monument|sinagog|cami|mosque|azulejo/],
  ["shop", /pazar|market|mercado|alisveris|shopping|hediyelik|souvenir|carsi|outlet|magaza|dukkan|\bal\b|satin al|\bbuy\b|sarabi al|peynir/],
  ["nature", /levada|hike|hiking|trek|patika|orman|forest|selale|waterfall|park|bahce|garden|jardim|jardins|doga|nature|dag\b|mountain|plaj|beach|praia|gol\b|lake|vadi|valley|ada\b|island|magara|cave/],
  ["walk", /yuruyus|yuru|walk|eski sehir|old town|zona velha|sokak|street|mahalle|neighbou?rhood|dolas|gezinti|bisiklet|bike|tram|tramvay|teleferik|cable car|tur\b|tour/],
  ["fun", /konser|concert|tiyatro|theatre|theater|fado|show|gosteri|festival|parti|party|gece|nightlife|kumarhane|casino|lunapark|eglence|fun|spa|hamam|tekne|boat|cruise/],
];
const FOOD_WORDS: [FoodKind, RegExp][] = [
  ["sweet", /tatli|dessert|pastel de nata|nata|dondurma|gelato|ice cream|pastane|pastelaria|patisserie|bakery|firin|cikolata|chocolate|manteigaria|cake|kek|waffle|crepe/],
  ["bar", /\bbar\b|sarap|wine|vinho|kokteyl|cocktail|pub|bira|beer|port wine|tadim|tasting|rooftop/],
  ["coffee", /kahvalti|breakfast|brunch|kahve|coffee|cafe|kafe|café|espresso|cay\b|tea\b/],
];
const MEAL_KIND: Record<string, FoodKind> = { breakfast: "coffee", lunch: "lunch", dinner: "dinner" };

/** The idea's kind: the traveller's pick, else its words, else (a restaurant) its meal, else dinner; a thing to do with no words for it has none. */
export function ideaKindOf(item: Pick<Item, "name" | "summary" | "category" | "meal" | "ideaKind" | "optionDetail">): IdeaKind | null {
  const food = isFoodIdea(item as Item);
  const own = item.ideaKind as IdeaKind | null | undefined;
  if (own && (food ? FOOD_KINDS : TODO_KINDS).includes(own as never)) return own;
  const text = fold([item.name, item.optionDetail, item.summary].filter(Boolean).join(" "));
  if (food) return FOOD_WORDS.find(([, re]) => re.test(text))?.[0] ?? (item.meal ? MEAL_KIND[item.meal] : null) ?? "dinner";
  return TODO_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** The kinds a section can pick from (the chips, the row's menu). */
export const kindsFor = (food: boolean): readonly IdeaKind[] => (food ? FOOD_KINDS : TODO_KINDS);
