// What a line to the chat is about, by category (2026-10-24, Emre: "Uçuş ekle dediğimde aynı anda uçuş kategorisi de anime
// olmaya başlayabilir; gezi omurgası oluştururken de"): the Plan's categories its words point to, so their rows show the
// work from the moment it is sent until the answer lands (Chat → sectionLooking). Words of the whole plan ("planı kur",
// "omurga", "rota") point to every category of the backbone. Nothing named: none (a question, a thank-you moves nothing).
import type { SectionId } from "./categories";

const WORDS: [SectionId, RegExp][] = [
  ["flight", /(?<!\p{L})(uçuş|uçak|uçağ|havayol|flight|fly|plane|airline)/iu],
  ["stay", /(?<!\p{L})(otel|konaklama|kalacak|kalal[ıi]m|pansiyon|hostel|airbnb|villa|apart|kamp(?!anya)|hotel|stay|lodging|accommodation)/iu],
  ["transport", /(?<!\p{L})(ulaşım|transfer|araç|araba|kiralık|kirala|tren|otobüs|feribot|vapur|taksi|karavan|car|train|bus|ferry|taxi|rental|campervan)/iu],
  ["activity", /(?<!\p{L})(tur(?!k)|etkinlik|aktivite|deneyim|bilet|konser|festival|tour|activit|excursion|ticket|experience)/iu],
  ["todo", /(?<!\p{L})(yapılacak|restoran|yemek|kafe|görülecek|gezilecek|mekan|restaurant|food|cafe|things to do|sight)/iu],
  ["other", /(?<!\p{L})(esim|e-sim|sim kart|internet|sigorta|vize|belge|pasaport|insurance|visa|document|passport)/iu],
  ["prep", /(?<!\p{L})(bavul|valiz|hazırlık|packing|luggage)/iu],
];

/** The backbone's categories: what "planı kur" works on. */
const BACKBONE: SectionId[] = ["flight", "stay", "transport", "activity"];
const WHOLE = /(?<!\p{L})(omurga|planı (kur|oluştur|yap|hazırla|baştan)|rota(yı|mı)? (kur|oluştur|çiz|öner)|gezi(yi|mi)? planla|backbone|build (the|my) (plan|trip)|plan (the|my) trip)/iu;

export function sectionsOfWords(text: string): SectionId[] {
  const found = WORDS.filter(([, re]) => re.test(text)).map(([id]) => id);
  if (WHOLE.test(text)) for (const id of BACKBONE) if (!found.includes(id)) found.push(id);
  return found;
}

/** What a line asks to be done: added ("Uçuş ekle", "koy"), changed ("kaydır", "düzelt", "sil") or looked for (the rest). */
export type ChatWork = "add" | "edit" | "search";
const ADD = /(?<!\p{L})(ekle|koy|ekleyelim|koyalım|add|put)/iu;
const EDIT = /(?<!\p{L})(değiştir|düzelt|güncelle|kaydır|taşı|ertele|öne al|sil|kaldır|iptal|change|edit|update|move|shift|remove|delete|cancel)/iu;
export const chatWork = (text: string): ChatWork => (EDIT.test(text) ? "edit" : ADD.test(text) ? "add" : "search");
