// A reply that says something was changed when nothing was (0.37, the bug: "bütçeyi euro olarak göster" →
// "Done! I've updated your budget currency to Euro." while the hero stayed in TRY). The model is told never to
// say so without a tool call that worked; this is the cheap check behind it, on the reply's own words. Kept
// narrow on purpose: first-person past tense ("güncelledim", "I've updated", "Done!"), never a question
// ("Değiştireyim mi?", "Should I change it?") and never a negation ("değiştiremedim", "I haven't changed").
import { L } from "./i18n";

// Turkish: the verb in the first person past ("-dim/-dım/-dum/-düm", "-tim"...), whole words only.
// ("yaptım" is left out: "bir karşılaştırma yaptım" is talk, not a change.)
const TR = /(?<![\p{L}])(güncelle|değiştir|ekle|ayarla|çevir|kaydet|kaldır|sil|taşı|dönüştür)(d|t)(i|ı|u|ü)m(?![\p{L}])/iu;
// "Tamamdır, hallettim" said as a done deal.
const TR_DONE = /(?<![\p{L}])(hallettim|halloldu)(?![\p{L}])/iu;
// English: "I('ve| have) updated/changed/switched/set/added/converted/renamed/removed" ("added up" is sums, not a change).
const EN = /\bI(?:'ve| have)?\s+(?:just\s+|now\s+|also\s+)?(?:updated|changed|switched|set|added(?!\s+up)|converted|renamed|removed)\b/i;
// "Done!" opening a sentence (not "Well done!"), "has been updated", "is now set to".
const EN_DONE = /^(?:all\s+)?done\b[!.,]|\b(?:has|have) been (?:updated|changed|switched)\b|\bis now (?:set|switched|changed) to\b/i;

/** The sentences of a reply (a question's own sentence ends with "?"). */
const sentences = (text: string) => text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Whether the reply says, as done, that it changed something. Questions and negations don't count. */
export function claimsChange(text: string): boolean {
  return sentences(text).some((s) => !s.endsWith("?") && (TR.test(s) || TR_DONE.test(s) || EN.test(s) || EN_DONE.test(s)));
}

/** Added under such a reply when no tool changed anything in the turn. */
export const noChangeNote = () =>
  L(
    "Not: bunu panoda değiştiremedim; Ayarlar'dan yapabilirsin.",
    "Note: I couldn't change this on the board; you can do it in Settings.",
  );
