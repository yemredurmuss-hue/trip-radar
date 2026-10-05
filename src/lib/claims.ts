// A reply that says something was changed when nothing was (0.37, the bug: "bütçeyi euro olarak göster" →
// "Done! I've updated your budget currency to Euro." while the hero stayed in TRY). The model is told never to
// say so without a tool call that worked; this is the cheap check behind it, on the reply's own words. Kept
// narrow on purpose: only the perfect "I've updated / I have changed…" and the Turkish first person past of a
// few board verbs; never a question, a negation, a sum ("I converted 300 USD", "300 doları euroya çevirdim"),
// or something done earlier ("I added Sabine earlier", "daha önce ekledim").
import { L } from "./i18n";

// Turkish: the verb in the first person past ("-dim/-dım/-dum/-düm", "-tim"...), whole words only. No çevir /
// dönüştür ("300 doları euroya çevirdim" is arithmetic), no yap ("bir karşılaştırma yaptım" is talk).
const TR = /(?<![\p{L}])(güncelle|değiştir|ekle|ayarla|kaydet|kaldır|sil|taşı)(d|t)(i|ı|u|ü)m(?![\p{L}])/iu;
const TR_DONE = /(?<![\p{L}])(hallettim|halloldu)(?![\p{L}])/iu;
// English: the perfect only, "I've (just) updated / I have changed…" ("Done! I've…" included); "set out" and
// "added up" are talk and sums, not changes.
const EN = /\bI(?:'ve|’ve| have)\s+(?:just\s+|now\s+|also\s+)?(?:updated|changed|switched|added(?!\s+up)|removed|set(?!\s+out))\b/i;
// Something done before this turn ("earlier", "daha önce"): not a claim about this one.
const EARLIER = /\b(?:earlier|before|previously|already)\b|(?<![\p{L}])(?:önce|az önce|daha önce|evvelce|zaten)(?![\p{L}])/iu;

/** The sentences of a reply (a question's own sentence ends with "?"). */
const sentences = (text: string) => text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Whether the reply says, as done now, that it changed something. Questions, negations, earlier things don't count. */
export function claimsChange(text: string): boolean {
  return sentences(text).some((s) => !s.endsWith("?") && !EARLIER.test(s) && (TR.test(s) || TR_DONE.test(s) || EN.test(s)));
}

/** Shown under such a reply (on screen only, never in the model's history) when no tool changed anything. */
export const noChangeNote = () =>
  L(
    "Not: bunu panoda değiştiremedim; Ayarlar'dan yapabilirsin.",
    "Note: I couldn't change this on the board; you can do it in Settings.",
  );
