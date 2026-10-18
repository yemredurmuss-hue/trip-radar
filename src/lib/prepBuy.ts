// Hazırlık's "Amazon ↗" (v11, docs/mockups/2026-10-08-japonya-web-v11.html prepBody): a chore that is a thing to buy
// before the trip — an adapter, a power bank, a rain jacket — gets a search for it on Amazon; one that names its own
// shop ("Decathlon'dan yağmurluk al") or isn't a thing (a visa, cash, a booking) gets none.
import { lang } from "./i18n";

/** Things one buys for a trip (stems: "adaptör", "adaptörü", "adapter" all match). */
const THINGS = [
  "adaptör", "adapter", "priz", "plug", "şarj", "charger", "powerbank", "power bank", "kablo", "cable", "kulaklık", "headphone", "earplug", "kulak tıkacı",
  "kilit", "lock", "boyun yastığı", "neck pillow", "yastık", "pillow", "şemsiye", "umbrella", "yağmurluk", "rain jacket", "panço", "poncho",
  "ayakkabı", "shoes", "sandalet", "sandal", "terlik", "slipper", "çorap", "socks", "güneş kremi", "sunscreen", "sinek", "repellent",
  "valiz", "suitcase", "bavul", "çanta", "bag", "sırt çantası", "backpack", "etiket", "luggage tag", "matara", "water bottle",
  "havlu", "towel", "gözlük", "sunglasses", "şapka", "hat", "mont", "jacket", "polar", "fleece", "eldiven", "gloves", "bere", "beanie",
  "ilk yardım", "first aid", "dezenfektan", "sanitizer", "tartı", "luggage scale", "organizer", "düzenleyici", "vakum", "compression",
];
/** A shop said by name: the chore is to buy it there. */
const SHOPS = ["decathlon", "ikea", "migros", "carrefour", "a101", "bim", "şok", "boyner", "lc waikiki", "mediamarkt", "teknosa", "uniqlo", "zara", "h&m", "eczane", "pharmacy"];

/** The Amazon search for a chore that's a thing to buy, else null. */
export function amazonLink(name: string): string | null {
  const n = name.toLocaleLowerCase("tr");
  if (SHOPS.some((s) => n.includes(s))) return null;
  const thing = THINGS.find((t) => n.includes(t));
  if (!thing) return null;
  // The words that say what to buy, without the verb ("al", "satın al", "buy") and the filler.
  const query = name.replace(/\b(satın al|al|almak|alınacak|buy|get|pack)\b\.?$/i, "").replace(/\s+/g, " ").trim();
  const host = lang() === "tr" ? "www.amazon.com.tr" : "www.amazon.com";
  return `https://${host}/s?k=${encodeURIComponent(query || thing)}`;
}
