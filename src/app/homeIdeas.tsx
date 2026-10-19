// The home's idea chips (docs/mockups/ana-sayfa-v1, approved 2026-10-19): twelve trips to dream of in two sets of six, each with a
// small drawing of its own (ours, no photo quota), a short name and its place on the chip, the sentence a press writes into the
// box and the start mode that sentence goes on in. No prices, nothing looked up: the list is fixed here (K3).
import { useId } from "react";
import { L } from "../lib/i18n";
import type { StartMode } from "../lib/startTrip";

export type IdeaArtName = "aurora" | "bali" | "kyoto" | "sahara" | "amalfi" | "lisbon" | "iceland" | "vienna" | "patagonia" | "kenya" | "festival" | "maldives";

/** [tr, en] */
type Both = readonly [string, string];

export interface HomeIdea {
  art: IdeaArtName;
  /** What the chat starts as when the sentence is sent (TripsHome remembers it until the box is emptied). */
  mode: StartMode;
  /** The good months, 0 = January, in the season's order (the first and the last make "Eyl–Mar"). */
  months: readonly number[];
  /** On the chip: the short name and, small and muted, the place. */
  title: Both;
  place: Both;
  /** On hover (the chip's title): the long name and what it is. */
  long: Both;
  meta: Both;
  /** What a press writes into the box. */
  say: Both;
}

const ALL_YEAR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const IDEAS: readonly (readonly HomeIdea[])[] = [
  [
    {
      art: "aurora",
      mode: "plan",
      months: [8, 9, 10, 11, 0, 1, 2],
      title: ["Kuzey ışıkları", "Northern lights"],
      place: ["Tromsø", "Tromsø"],
      long: ["Kuzey ışıkları peşinde", "Chasing the northern lights"],
      meta: ["Tromsø · 5 gece", "Tromsø · 5 nights"],
      say: [
        "Şubat'ta Tromsø'da 5 gece, kuzey ışıklarını görmek istiyoruz. Bir gece cam tavanlı kulübede kalalım, bir gün de husky turu olsun.",
        "Five nights in Tromsø in February, we want to see the northern lights. One night in a glass-roofed cabin, and a day out with huskies.",
      ],
    },
    {
      art: "bali",
      mode: "plan",
      months: [3, 4, 5, 6, 7, 8, 9],
      title: ["15 gün balayı", "15-day honeymoon"],
      place: ["Bali", "Bali"],
      long: ["15 gün Bali balayı", "A 15-day Bali honeymoon"],
      meta: ["Ubud → Uluwatu", "Ubud → Uluwatu"],
      say: [
        "Balayı: 15 gün Bali, Mayıs'ta. Önce Ubud'da ormana bakan havuzlu bir villa, sonra Uluwatu'da okyanus manzaralı bir otel.",
        "Honeymoon: 15 days in Bali in May. First a villa with a pool looking out over the jungle in Ubud, then a hotel with an ocean view in Uluwatu.",
      ],
    },
    {
      art: "kyoto",
      mode: "plan",
      months: [10],
      title: ["Kızıl yapraklar", "Autumn leaves"],
      place: ["Kyoto", "Kyoto"],
      long: ["Kyoto'da kızıl yapraklar", "Autumn colours in Kyoto"],
      meta: ["Tokyo + Kyoto · 10 gün", "Tokyo + Kyoto · 10 days"],
      say: [
        "Kasım sonunda 10 gün Japonya: önce Tokyo'da 3 gece, sonra Kyoto'da kızıl yapraklar ve bir gece ryokan.",
        "Ten days in Japan at the end of November: 3 nights in Tokyo first, then the autumn leaves in Kyoto and a night in a ryokan.",
      ],
    },
    {
      art: "sahara",
      mode: "road",
      months: [9, 10, 11, 0, 1, 2, 3],
      title: ["Çölde bir gece", "A night in the desert"],
      place: ["Merzouga", "Merzouga"],
      long: ["Sahra'da çöl gecesi", "A night in the Sahara"],
      meta: ["Marakeş → Merzouga · 6 gün", "Marrakesh → Merzouga · 6 days"],
      say: [
        "Marakeş'ten başlayıp 6 günde Sahra'ya: Atlas dağlarından geçen bir yol ve Merzouga'da bir gece çölde kamp.",
        "From Marrakesh to the Sahara in 6 days: a road over the Atlas Mountains and a night camping in the desert at Merzouga.",
      ],
    },
    {
      art: "amalfi",
      mode: "road",
      months: [4, 5, 8],
      title: ["Kıyı yolu arabayla", "Coast road by car"],
      place: ["Amalfi", "Amalfi"],
      long: ["Amalfi kıyısı arabayla", "The Amalfi Coast by car"],
      meta: ["Napoli → Positano · 7 gün", "Naples → Positano · 7 days"],
      say: [
        "Haziran'da 7 gün Amalfi kıyısı: Napoli'den araç kiralayıp Positano ve Ravello, bir gün de tekneyle Capri.",
        "Seven days on the Amalfi Coast in June: a rental car from Naples to Positano and Ravello, and a day on a boat to Capri.",
      ],
    },
    {
      art: "lisbon",
      mode: "lastminute",
      months: ALL_YEAR,
      title: ["Hafta sonu kaçamağı", "Weekend escape"],
      place: ["Lizbon", "Lisbon"],
      long: ["Bu hafta sonu Lizbon", "Lisbon this weekend"],
      meta: ["Cuma çıkış · 3 gece", "Leave on Friday · 3 nights"],
      say: [
        "Bu cuma Lizbon'a 3 gecelik kaçamak: en uygun uçuş ve Alfama'da küçük bir otel.",
        "A 3-night escape to Lisbon this Friday: the best-value flight and a small hotel in Alfama.",
      ],
    },
  ],
  [
    {
      art: "iceland",
      mode: "road",
      months: [5, 6, 7],
      title: ["Çevre yolu", "Ring Road"],
      place: ["İzlanda", "Iceland"],
      long: ["İzlanda çevre yolu", "Iceland's Ring Road"],
      meta: ["Reykjavík'ten tur · 10 gün", "A loop from Reykjavík · 10 days"],
      say: [
        "Temmuz'da 10 gün İzlanda çevre yolu: Reykjavík'ten araç kiralayıp şelaleler, siyah kum plajı ve buzul gölü.",
        "Ten days on Iceland's Ring Road in July: a rental car from Reykjavík, waterfalls, a black sand beach and the glacier lagoon.",
      ],
    },
    {
      art: "vienna",
      mode: "plan",
      months: [10, 11],
      title: ["Noel pazarları", "Christmas markets"],
      place: ["Viyana", "Vienna"],
      long: ["Viyana Noel pazarları", "Vienna's Christmas markets"],
      meta: ["3 gece · Aralık", "3 nights · December"],
      say: [
        "Aralık başında 3 gece Viyana: Noel pazarları, bir akşam konser, eski şehirde yürüme mesafesinde bir otel.",
        "Three nights in Vienna in early December: the Christmas markets, a concert one evening, a hotel within walking distance of the old town.",
      ],
    },
    {
      art: "patagonia",
      mode: "plan",
      months: [10, 11, 0, 1, 2],
      title: ["Buzul yürüyüşü", "Glacier hiking"],
      place: ["Patagonya", "Patagonia"],
      long: ["Patagonya'da yürüyüş", "Hiking in Patagonia"],
      meta: ["El Chaltén · 12 gün", "El Chaltén · 12 days"],
      say: [
        "Ocak'ta 12 gün Patagonya: El Chaltén'de Fitz Roy yürüyüşü, sonra El Calafate'de buzul. İkimiz de yürümeyi seviyoruz.",
        "Twelve days in Patagonia in January: the Fitz Roy hike from El Chaltén, then the glacier at El Calafate. We both love walking.",
      ],
    },
    {
      art: "kenya",
      mode: "plan",
      months: [6, 7, 8, 9],
      title: ["Safari", "Safari"],
      place: ["Masai Mara", "Masai Mara"],
      long: ["Masai Mara safarisi", "A Masai Mara safari"],
      meta: ["Nairobi · 8 gün", "Nairobi · 8 days"],
      say: [
        "Ağustos'ta 8 gün Kenya: büyük göç zamanı Masai Mara'da 3 gece çadır kamp, sonra Diani'de deniz.",
        "Eight days in Kenya in August: 3 nights in a tented camp in the Masai Mara during the great migration, then the beach at Diani.",
      ],
    },
    {
      art: "festival",
      mode: "plan",
      months: [7],
      title: ["Festival ve kamp", "Festival and camping"],
      place: ["Sziget", "Sziget"],
      long: ["Festival ve kamp", "Festival and camping"],
      meta: ["Sziget, Budapeşte · 5 gece", "Sziget, Budapest · 5 nights"],
      say: [
        "Ağustos'ta Sziget festivali, 5 gece kamp, 4 arkadaşız. Festival bileti, kamp alanı ve Budapeşte'ye uçuş lazım.",
        "Sziget festival in August, 5 nights camping, 4 of us. We need festival tickets, a camping spot and flights to Budapest.",
      ],
    },
    {
      art: "maldives",
      mode: "plan",
      months: [10, 11, 0, 1, 2, 3],
      title: ["Su üstü villa", "Overwater villa"],
      place: ["Maldivler", "Maldives"],
      long: ["Maldivler'de tek ada", "One island in the Maldives"],
      meta: ["7 gece · su üstü villa", "7 nights · overwater villa"],
      say: [
        "Şubat'ta 7 gece Maldivler: tek bir adada su üstü villa, deniz uçağıyla transfer, şnorkel.",
        "Seven nights in the Maldives in February: an overwater villa on a single island, a seaplane transfer, snorkelling.",
      ],
    },
  ],
];

/** The text of a pair in the board's language. */
export const inLang = (pair: Both): string => L(pair[0], pair[1]);

/** In its season this month (an all-year idea never counts: it would always come first). */
export const inSeason = (idea: HomeIdea, month: number): boolean => idea.months.length < 12 && idea.months.includes(month);

/** A set as shown: the ones whose good months include this one first, otherwise in their order; nothing marks them. */
export function ideasFor(set: number, month: number): HomeIdea[] {
  return [...IDEAS[set % IDEAS.length]].sort((a, b) => Number(inSeason(b, month)) - Number(inSeason(a, month)));
}

const MONTHS: Both[] = [
  ["Oca", "Jan"], ["Şub", "Feb"], ["Mar", "Mar"], ["Nis", "Apr"], ["May", "May"], ["Haz", "Jun"],
  ["Tem", "Jul"], ["Ağu", "Aug"], ["Eyl", "Sep"], ["Eki", "Oct"], ["Kas", "Nov"], ["Ara", "Dec"],
];

/** "Eyl–Mar", "Kas", "her ay": the good months in a few letters, shown on hover. */
export function monthSpan(months: readonly number[]): string {
  if (months.length >= 12) return L("her ay", "every month");
  if (months.length === 1) return inLang(MONTHS[months[0]]);
  return `${inLang(MONTHS[months[0]])}–${inLang(MONTHS[months[months.length - 1]])}`;
}

/** The chip's hover line: "Kuzey ışıkları peşinde · Tromsø · 5 gece · Eyl–Mar". */
export const ideaTip = (idea: HomeIdea): string => `${inLang(idea.long)} · ${inLang(idea.meta)} · ${monthSpan(idea.months)}`;

/** The box's placeholder lines, turning while it is empty and left alone; the first is the one that stays (and the reduced-motion one). */
export const HINTS: (() => string)[] = [
  () => L("Şubat'ta Tromsø, kuzey ışıkları…", "Tromsø in February, northern lights…"),
  () => L("15 gün Bali, balayı, Mayıs'ta…", "15 days in Bali, a honeymoon, in May…"),
  () => L("Bu hafta sonu kaçamak, 3 gece…", "A weekend escape, 3 nights…"),
  () => L("Ya da bir link, bir ekran görüntüsü yapıştır", "Or paste a link or a screenshot"),
];

// The drawings, 200 × 260, cut to a circle by the chip. Each takes an id prefix: two of the same drawing on one page (or the same
// chip drawn again) must not share their gradients' ids.
const ART: Record<IdeaArtName, (p: string) => string> = {
  aurora: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050d1f"/><stop offset="1" stop-color="#173563"/></linearGradient><filter id="${p}b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <g fill="#fff">${[[22, 22], [60, 14], [150, 30], [178, 12], [110, 20], [36, 58], [184, 62], [132, 8]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}" opacity=".85"/>`).join("")}</g>
    <g filter="url(#${p}b)" fill="none"><path d="M-20 128 C30 70 80 150 128 82 S196 60 230 36" stroke="#3ff0a6" stroke-width="30" opacity=".85"/><path d="M-20 96 C40 40 96 112 150 52 S210 36 230 22" stroke="#8a6bff" stroke-width="16" opacity=".6"/><path d="M10 150 C60 110 110 160 170 110" stroke="#25d1c4" stroke-width="12" opacity=".5"/></g>
    <path d="M0 196 L38 150 L58 166 L96 120 L132 160 L156 142 L200 178 V260 H0Z" fill="#0b1830"/>
    <path d="M96 120 L84 135 L92 133 L98 138 L106 131 L111 135Z M38 150 L30 160 L40 158 L46 162Z" fill="#c9d6ea" opacity=".8"/>
    <path d="M0 212 Q90 196 200 214 V260 H0Z" fill="#dbe5f3"/>
    <path d="M128 201 h30 v15 h-30z" fill="#1a2440"/><path d="M124 202 L143 189 L162 202Z" fill="#101a33"/><rect x="134" y="205" width="7" height="6" fill="#ffcf6b"/><rect x="146" y="205" width="7" height="6" fill="#ffcf6b"/>`,
  bali: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3fb8"/><stop offset=".5" stop-color="#ff7b86"/><stop offset=".72" stop-color="#ffc37a"/></linearGradient><linearGradient id="${p}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a7a"/><stop offset="1" stop-color="#3a2468"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/><circle cx="100" cy="150" r="34" fill="#fff0c4" opacity=".95"/>
    <rect y="172" width="200" height="88" fill="url(#${p}w)"/>
    <g stroke="#ffd9a8" stroke-width="2" opacity=".55"><path d="M76 182 h48"/><path d="M84 192 h32"/><path d="M90 202 h20"/></g>
    <path d="M52 172 V112 h8 v-10 h6 v-12 h6 v-12 h5 v-14 h4 V172Z M148 172 V112 h-8 v-10 h-6 v-12 h-6 v-12 h-5 v-14 h-4 V172Z" fill="#2a1638"/>
    <path d="M0 172 V120 q10 -6 16 4 V172Z M200 172 V124 q-10 -4 -14 6 V172Z" fill="#2a1638"/>
    <path d="M12 260 C14 220 22 190 36 160" stroke="#2a1638" stroke-width="5" fill="none"/><path d="M36 160 c-20 -6 -34 2 -40 12 M36 160 c-6 -18 -22 -24 -34 -22 M36 160 c14 -16 32 -14 40 -6 M36 160 c20 2 28 14 28 24" stroke="#2a1638" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  kyoto: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde9cc"/><stop offset="1" stop-color="#f09a62"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <path d="M0 222 Q60 198 120 214 T200 206 V260 H0Z" fill="#8b2a2a"/>
    <g fill="#3a1c28">${[0, 1, 2, 3, 4].map((i) => { const y = 206 - i * 27, w = 78 - i * 11, c = 124; return `<rect x="${c - w / 2 + 10}" y="${y - 14}" width="${w - 20}" height="14"/><path d="M${c - w / 2} ${y - 12} Q${c} ${y - 22} ${c + w / 2} ${y - 12} L${c + w / 2 - 7} ${y - 18} Q${c} ${y - 26} ${c - w / 2 + 7} ${y - 18}Z"/>`; }).join("")}<rect x="122.5" y="66" width="3" height="40"/></g>
    <g>${([[30, 40, "#d6332f"], [56, 78, "#e8642c"], [22, 120, "#c22a2a"], [70, 30, "#f08a2c"], [176, 52, "#d6332f"], [46, 160, "#e8642c"], [168, 100, "#c22a2a"], [88, 120, "#d6332f"]] as const).map(([x, y, c], i) => `<path transform="translate(${x} ${y}) rotate(${i * 41}) scale(${i % 2 ? 0.9 : 1.25})" d="M0 -9 L3 -3 L9 -4 L5 1 L8 7 L1 4 L0 10 L-1 4 L-8 7 L-5 1 L-9 -4 L-3 -3Z" fill="${c}"/>`).join("")}</g>`,
  sahara: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241446"/><stop offset=".55" stop-color="#b8577a"/><stop offset=".8" stop-color="#f4a259"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <g fill="#fff">${[[20, 24], [48, 50], [90, 18], [130, 40], [170, 22], [186, 70], [70, 80], [150, 74]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 0.9 : 1.3}" opacity=".9"/>`).join("")}</g>
    <path d="M150 36 a18 18 0 1 0 14 30 a14 14 0 1 1 -14 -30Z" fill="#fff3d6"/>
    <path d="M0 176 Q50 140 110 168 T200 158 V260 H0Z" fill="#e8904f"/>
    <path d="M0 206 Q70 178 130 200 T200 192 V260 H0Z" fill="#c96a37"/>
    <path d="M0 236 Q60 216 120 232 T200 226 V260 H0Z" fill="#9e4a25"/>
    <path d="M58 176 L72 160 L86 176Z" fill="#3b1f2c"/><circle cx="72" cy="172" r="12" fill="#ffcf6b" opacity=".25"/>`,
  amalfi: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe4f6"/><stop offset="1" stop-color="#f7e6cf"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <path d="M0 150 H200 V260 H0Z" fill="#2283c2"/><path d="M0 150 H200 V158 H0Z" fill="#5fb0dd"/>
    <path d="M86 260 L104 190 L128 150 L150 110 L176 84 L200 74 V260Z" fill="#b98e66"/>
    <g>${([[118, 170, "#f6c8b0"], [132, 150, "#f3e1a0"], [146, 128, "#fff"], [160, 108, "#f0b8a8"], [176, 92, "#f3e1a0"], [140, 176, "#fff"], [158, 156, "#f6c8b0"], [172, 134, "#fff"], [186, 114, "#f0b8a8"], [156, 190, "#f3e1a0"], [176, 176, "#f0b8a8"], [188, 150, "#fff"]] as const).map(([x, y, c]) => `<rect x="${x}" y="${y}" width="15" height="14" fill="${c}"/><rect x="${x + 4}" y="${y + 4}" width="3" height="4" fill="#5a6f86"/><rect x="${x + 9}" y="${y + 4}" width="3" height="4" fill="#5a6f86"/>`).join("")}</g>
    <path d="M30 196 h36 l-6 8 h-26z" fill="#fff"/><path d="M46 196 V172 L60 194Z" fill="#fff"/>
    <circle cx="34" cy="44" r="13" fill="#f6d34a"/><path d="M42 34 q8 -8 16 -2 q-8 6 -16 2Z" fill="#4d8a3a"/>`,
  lisbon: (p) => `<defs><pattern id="${p}t" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#eef3fb"/><path d="M14 2 Q20 14 14 26 Q8 14 14 2Z M2 14 Q14 20 26 14 Q14 8 2 14Z" fill="#2a5db0" opacity=".85"/><circle cx="14" cy="14" r="3" fill="#eef3fb"/><path d="M0 0h4v4H0z M24 0h4v4h-4z M0 24h4v4H0z M24 24h4v4h-4z" fill="#2a5db0"/></pattern></defs>
    <rect width="200" height="260" fill="url(#${p}t)"/>
    <path d="M0 40 L200 22" stroke="#1d2433" stroke-width="1.5"/><path d="M110 31 L118 70" stroke="#1d2433" stroke-width="1.5"/>
    <path d="M0 210 L200 180 V260 H0Z" fill="#c9c2b4"/>
    <g transform="rotate(-8 110 160)"><rect x="40" y="106" width="140" height="74" rx="12" fill="#f5c02a"/><rect x="40" y="148" width="140" height="8" fill="#fff"/><g fill="#d8ecff">${[52, 80, 108, 136, 160].map((x) => `<rect x="${x}" y="118" width="18" height="22" rx="3"/>`).join("")}</g><rect x="96" y="70" width="40" height="36" fill="none" stroke="#1d2433" stroke-width="1.5"/><circle cx="72" cy="184" r="8" fill="#1d2433"/><circle cx="150" cy="184" r="8" fill="#1d2433"/><rect x="40" y="162" width="140" height="18" fill="#e3ab12"/><text x="150" y="173" font-size="9" font-family="sans-serif" font-weight="700" fill="#1d2433">28</text></g>`,
  iceland: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fbfd3"/><stop offset="1" stop-color="#e8eff3"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <path d="M0 150 L0 70 Q40 60 70 76 L84 150Z M112 150 L120 74 Q160 60 200 80 V150Z" fill="#2f4a3a"/>
    <rect x="84" y="78" width="28" height="78" fill="#f4f8fb"/><g stroke="#cfe0ea" stroke-width="2"><path d="M90 84 v66"/><path d="M100 80 v72"/><path d="M106 84 v66"/></g>
    <ellipse cx="98" cy="158" rx="42" ry="8" fill="#e6f0f5"/>
    <path d="M0 160 H200 V260 H0Z" fill="#2a2f36"/>
    <path d="M200 260 C150 230 70 220 20 170" stroke="#4a515b" stroke-width="26" fill="none"/>
    <path d="M200 260 C150 230 70 220 20 170" stroke="#f2c94c" stroke-width="2" stroke-dasharray="8 8" fill="none"/>`,
  vienna: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121735"/><stop offset="1" stop-color="#2c2a5a"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <path d="M40 120 V60 L60 30 L80 60 V120Z M120 120 V50 L140 18 L160 50 V120Z" fill="#1b1f44"/><rect x="0" y="110" width="200" height="40" fill="#1b1f44"/>
    <path d="M-10 70 Q100 120 210 64" stroke="#3a3d6a" stroke-width="1" fill="none"/>
    <g fill="#ffd27a">${Array.from({ length: 13 }, (_, i) => { const x = -6 + i * 17, y = 70 + Math.sin((i / 12) * Math.PI) * 44 - (i === 0 || i === 12 ? 6 : 0); return `<circle cx="${x}" cy="${y}" r="2.2"/>`; }).join("")}</g>
    ${[[6, 150], [72, 156], [138, 150]].map(([x, y]) => `<path d="M${x} ${y} L${x + 28} ${y - 26} L${x + 56} ${y}Z" fill="#8b2b2b"/><rect x="${x + 4}" y="${y}" width="48" height="42" fill="#3a1f2a"/><rect x="${x + 9}" y="${y + 6}" width="38" height="18" fill="#ffcf7a"/>`).join("")}
    <path d="M0 200 H200 V260 H0Z" fill="#e9edf6"/><g fill="#fff">${[[20, 40], [90, 90], [170, 30], [60, 140], [150, 120], [110, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join("")}</g>`,
  patagonia: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ee"/><stop offset="1" stop-color="#f6efe6"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <path d="M0 170 L30 120 L52 136 L78 60 L92 92 L104 40 L118 86 L132 70 L150 118 L176 100 L200 140 V180 H0Z" fill="#3e4c63"/>
    <path d="M78 60 L70 84 L82 78 L88 88Z M104 40 L98 64 L106 58 L112 70Z M132 70 L126 88 L136 84Z" fill="#fff"/>
    <path d="M0 176 H200 V206 H0Z" fill="#4aa0b5"/><path d="M0 200 Q100 186 200 204 V260 H0Z" fill="#a8925f"/>
    <path d="M100 260 C110 236 90 222 104 204" stroke="#e8dcc0" stroke-width="3" stroke-dasharray="2 5" fill="none"/>`,
  kenya: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7c66b"/><stop offset=".7" stop-color="#e2653c"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/><circle cx="120" cy="150" r="44" fill="#ffe2a0" opacity=".9"/>
    <path d="M0 186 Q100 176 200 190 V260 H0Z" fill="#3a1d10"/>
    <path d="M58 186 C60 160 62 140 56 120" stroke="#2a140b" stroke-width="5" fill="none"/><ellipse cx="62" cy="114" rx="50" ry="10" fill="#2a140b"/><ellipse cx="74" cy="104" rx="30" ry="6" fill="#2a140b"/>
    <path d="M150 186 v-22 h3 v-20 l2 -18 l5 -3 l1 6 l-4 2 l0 34 h10 v21 h-3 v-17 h-8 v17Z" fill="#2a140b"/>`,
  festival: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0b3d"/><stop offset="1" stop-color="#4a1d6e"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/>
    <g opacity=".45"><path d="M100 120 L20 0 H50Z" fill="#ff6bd5"/><path d="M100 120 L150 0 H180Z" fill="#6bd4ff"/><path d="M100 120 L90 0 H115Z" fill="#ffe36b"/></g>
    <rect x="60" y="110" width="80" height="34" fill="#160830"/><rect x="66" y="116" width="68" height="4" fill="#ff6bd5"/>
    <path d="M0 170 ${Array.from({ length: 21 }, (_, i) => `Q${i * 10 + 5} ${150 + (i % 3) * 4} ${i * 10 + 10} 170`).join(" ")} V200 H0Z" fill="#12062a"/>
    <path d="M0 200 H200 V260 H0Z" fill="#1a3a2a"/>
    ${([[14, 236, "#ffb347"], [70, 244, "#6bd4ff"], [130, 238, "#ff6bd5"]] as const).map(([x, y, c]) => `<path d="M${x} ${y} L${x + 26} ${y - 30} L${x + 52} ${y}Z" fill="${c}"/><path d="M${x + 26} ${y - 30} L${x + 20} ${y} L${x + 32} ${y}Z" fill="#12062a" opacity=".5"/>`).join("")}`,
  maldives: (p) => `<defs><linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff0ff"/><stop offset="1" stop-color="#eafcff"/></linearGradient><linearGradient id="${p}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46d0d0"/><stop offset="1" stop-color="#127fa6"/></linearGradient></defs>
    <rect width="200" height="260" fill="url(#${p}s)"/><path d="M0 120 H200 V260 H0Z" fill="url(#${p}w)"/>
    <path d="M-10 210 L210 150" stroke="#c9a77a" stroke-width="5"/>
    ${[[24, 190], [78, 175], [132, 160], [180, 148]].map(([x, y]) => `<path d="M${x - 4} ${y} v24 M${x + 20} ${y} v24" stroke="#7a5a3a" stroke-width="2"/><rect x="${x - 6}" y="${y - 14}" width="28" height="14" fill="#f4e6cf"/><path d="M${x - 10} ${y - 14} L${x + 8} ${y - 28} L${x + 26} ${y - 14}Z" fill="#a8743f"/>`).join("")}
    <g stroke="#fff" stroke-width="1.5" opacity=".6" fill="none"><path d="M20 240 q10 -4 20 0"/><path d="M120 236 q10 -4 20 0"/><path d="M70 252 q10 -4 20 0"/></g>`,
};

/** The drawing's markup with its ids prefixed (exported for the tests). */
export const ideaArtMarkup = (art: IdeaArtName, prefix: string): string => ART[art](prefix);

/** An idea's drawing, filling its round thumbnail; its ids are its own (useId), so the same drawing twice never shares a gradient. */
export function IdeaArt({ art }: { art: IdeaArtName }) {
  const prefix = `ia${useId().replace(/[^\w-]/g, "")}`;
  return <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" aria-hidden dangerouslySetInnerHTML={{ __html: ART[art](prefix) }} />;
}

/** "Sürpriz bir yer": a die on the lavender circle. */
export function DiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="8.5" r="1.4" />
        <circle cx="15.5" cy="15.5" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
      </g>
    </svg>
  );
}

/** "Başka fikirler": the arrow that turns once when the set changes. */
export function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />
    </svg>
  );
}
