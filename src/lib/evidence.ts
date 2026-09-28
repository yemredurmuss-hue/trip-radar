// Anti-hallucination check. The model quotes the page for price, rating and cancellation; a fact
// counts as "page" when that quote is on the page, or, since models often reformat quotes
// ("₺21.228" for "TL 21.228"), when the value itself is on the page. Otherwise it is "unverified".
import type { FactSource } from "./types";

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s  ]+/g, " ")
    .trim();
}

export function quoteFound(quote: string | null, corpus: string): boolean {
  if (!quote) return false;
  const q = normalize(quote);
  return q.length >= 2 && normalize(corpus).includes(q);
}

/** The integer part of the amount must appear in the quote's digits ("€ 1.234" matches 1234). */
export function amountInQuote(amount: number, quote: string): boolean {
  const digits = quote.replace(/\D/g, "");
  return digits.includes(String(Math.trunc(Math.abs(amount))));
}

/** Reads "21.228", "21,228", "21 228", "1.234,56", "8,9", "285" the way a page means them. */
export function parseLocaleNumber(raw: string): number | null {
  const s = raw.replace(/[\s  ']/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    // "21.228" / "1,234,567" → grouping; "8,9" / "155.25" → decimals.
    const grouping = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = grouping ? parts.join("") : parts.join(".");
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const NUMBER = /\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
const CURRENCY = /[€$£₺¥₹]|\b(?:TL|TRY|EUR|USD|GBP|CHF|JPY|THB|US\$)\b/i;

/** Is this value written on the page? For prices a currency marker must sit right next to it. */
export function valueOnPage(value: number, corpus: string, needsCurrency: boolean): boolean {
  for (const match of corpus.matchAll(NUMBER)) {
    const parsed = parseLocaleNumber(match[0]);
    if (parsed === null || Math.abs(parsed - value) > 0.005) continue;
    if (!needsCurrency) return true;
    const at = match.index ?? 0;
    const around = corpus.slice(Math.max(0, at - 6), at + match[0].length + 6);
    if (CURRENCY.test(around)) return true;
  }
  return false;
}

/** Every meaningful word of the quote is on the page (quote reworded or reordered by the model). */
function wordsOnPage(quote: string, corpus: string): boolean {
  const page = normalize(corpus);
  const words = normalize(quote)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
  return words.length >= 2 && words.every((w) => page.includes(w));
}

export type FactKind = "price" | "rating" | "text";

export function classify(
  claimed: "page" | "screenshot" | "url" | "none",
  quote: string | null,
  corpus: string,
  value?: number | null,
  kind: FactKind = value == null ? "text" : "price",
): FactSource {
  if (claimed === "none") return "none";
  if (claimed === "url") return "url";
  const quoted = quoteFound(quote, corpus) && (value == null || amountInQuote(value, quote!));
  if (quoted) return "page";
  if (value != null && valueOnPage(value, corpus, kind === "price")) return "page";
  if (value == null && quote && wordsOnPage(quote, corpus)) return "page";
  return claimed === "screenshot" ? "screenshot" : "unverified";
}
