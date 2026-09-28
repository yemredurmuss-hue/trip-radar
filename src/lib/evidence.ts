// Anti-hallucination check: the model must quote the page verbatim for price, rating and
// cancellation. If the quote is not in what we captured, the fact is marked "unverified".
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

export function classify(
  claimed: "page" | "screenshot" | "url" | "none",
  quote: string | null,
  corpus: string,
  amount?: number | null,
): FactSource {
  if (claimed === "none") return "none";
  if (claimed === "url" || claimed === "screenshot") return claimed;
  if (!quoteFound(quote, corpus)) return "unverified";
  if (amount != null && !amountInQuote(amount, quote!)) return "unverified";
  return "page";
}
