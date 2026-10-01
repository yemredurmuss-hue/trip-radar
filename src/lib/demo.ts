// Sample trip so the board and the decision view can be explored before anything is captured.
import { loadDecisions } from "./analysis";
import { db, newId, notifyChanged } from "./db";
import { textId } from "./evidence";
import { L, lang } from "./i18n";
import { EMPTY_METRICS, listingKeyOf } from "./items";
import type { Analysis, Category, ChatMessage, Finding, Item, ItemMetrics, Listing, Trip } from "./types";

/** A sample finding; review indexes point into the reading's reviews. */
function finding(
  text: string,
  polarity: Finding["polarity"],
  topic: Finding["topic"],
  source: Finding["source"],
  severity: Finding["severity"],
  reviews: number[],
  quotes: string[] = [],
): Finding {
  return { id: `${topic}:${polarity}:${textId(text)}`, text, polarity, topic, source, severity, reviewIds: reviews.map(String), quotes, verified: true };
}

export async function loadDemoTrip(): Promise<string> {
  const d = await db();
  const now = Date.now();
  const trip: Trip = {
    id: newId(),
    title: L("Portekiz (örnek)", "Portugal (sample)"),
    confirmedDates: { start: "2026-10-08", end: "2026-10-14" },
    budget: { amount: 1500, currency: "EUR" },
    heroImage: null,
    demo: true,
    createdAt: now,
    updatedAt: now,
  };
  await d.put("trips", trip);

  const item = (
    category: Category,
    needKey: string,
    name: string,
    amount: number | null,
    extra: Omit<Partial<Item>, "metrics"> & { metrics?: Partial<ItemMetrics> } = {},
  ): Item => {
    const { metrics, ...rest } = extra;
    return {
      id: newId(),
      tripId: trip.id,
      captureIds: [],
      key: null,
      category,
      needKey,
      name,
      provider: null,
      summary: "",
      optionDetail: null,
      url: null,
      imageUrl: null,
      city: "Porto",
      country: L("Portekiz", "Portugal"),
      countryCode: "PT",
      location: { address: null, area: null, approximate: false },
      dates: { start: "2026-10-08", end: "2026-10-11", source: "url" },
      guests: { adults: 2, children: null, rooms: 1 },
      price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: now },
      priceHistory: [],
      cancellation: { summary: L("5 Eki'ye kadar ücretsiz iptal", "Free cancellation until 5 Oct"), freeUntil: "2026-10-05", source: "page" },
      rating: { value: null, scale: null, count: null, source: "none" },
      flight: null,
      metrics: { ...EMPTY_METRICS, ...metrics },
      geo: null,
      highlights: [],
      concerns: [],
      reviewSummary: null,
      missing: [],
      status: "saved",
      statusNote: null,
      createdAt: now,
      updatedAt: now,
      ...rest,
    };
  };

  const geo = (lat: number, lng: number) => ({ lat, lng, source: "page" as const });
  const noDates = { start: null, end: null, source: "none" as const };
  const items: Item[] = [
    item("flight", "flight:ist-opo", L("Pegasus · direkt", "Pegasus · direct"), 148, {
      summary: L("8 Ekim 07:10 · Direkt", "8 Oct 07:10 · Direct"),
      provider: "Pegasus",
      optionDetail: L("Avantajlı paket (20 kg bagaj)", "Advantage package (20 kg bag)"),
      dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 },
      cancellation: { summary: L("İade yok, ücretli değişiklik", "Non-refundable, changes for a fee"), freeUntil: null, source: "page" },
      metrics: { durationMinutes: 295, checkedBagIncluded: true, cancellationType: "non_refundable" },
    }),
    item("flight", "flight:ist-opo", L("TAP · Lizbon aktarmalı", "TAP · via Lisbon"), 118, {
      summary: L("8 Ekim 05:40 · 1 aktarma", "8 Oct 05:40 · 1 stop"),
      provider: "TAP Air Portugal",
      optionDetail: L("Discount (yalnız kabin bagajı)", "Discount (cabin bag only)"),
      dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T05:40", arrival: "2026-10-08T12:50", carrier: "TAP", flightNumber: "TP 1761", stops: 1 },
      cancellation: { summary: L("Ücret kesintisiyle iade", "Refund minus a fee"), freeUntil: null, source: "page" },
      metrics: { durationMinutes: 490, checkedBagIncluded: false, cancellationType: "partial" },
    }),
    item("stay", "stay:porto", "Jardim Stay", 285, {
      provider: "Booking.com",
      url: "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-08&checkout=2026-10-11&group_adults=2",
      summary: L("Baixa, Ribeira'ya 8 dk", "Baixa, 8 min to Ribeira"),
      location: { address: null, area: "Baixa", approximate: false },
      geo: geo(41.1455, -8.611),
      rating: { value: 8.9, scale: 10, count: 1204, source: "page" },
      highlights: [L("Merkezi konum", "Central location"), L("Sessiz odalar", "Quiet rooms"), L("Kahvaltı dahil", "Breakfast included")],
      concerns: [L("Odalar küçük", "Small rooms")],
      reviewSummary: L(
        "Konum ve temizlik çok övülüyor; odalar küçük ama sessiz, personel yardımsever.",
        "Location and cleanliness get lots of praise; rooms are small but quiet, staff helpful.",
      ),
      metrics: {
        cancellationType: "free",
        reviewAspects: [
          { aspect: "location", score: 9.5, scale: 10, sentiment: "positive" },
          { aspect: "cleanliness", score: 9.1, scale: 10, sentiment: "positive" },
          { aspect: "comfort", score: 8.6, scale: 10, sentiment: "positive" },
          { aspect: "staff", score: 9.3, scale: 10, sentiment: "positive" },
        ],
        amenities: ["klima", "ücretsiz wifi", "kahvaltı dahil", "asansör"],
        stayKind: "hotel_room",
      },
    }),
    item("stay", "stay:porto", "Casa Azul", 240, {
      provider: "Airbnb",
      url: "https://www.airbnb.com/rooms/48213377?check_in=2026-10-08&check_out=2026-10-11&adults=2",
      summary: L("Bonfim, mutfaklı daire", "Bonfim, flat with a kitchen"),
      location: { address: null, area: "Bonfim", approximate: true },
      geo: geo(41.162, -8.589),
      rating: { value: 4.8, scale: 5, count: 96, source: "page" },
      highlights: [L("Geniş daire", "Spacious flat"), L("Mutfak", "Kitchen"), L("İlgili ev sahibi", "Attentive host")],
      concerns: [L("Merkeze yokuş yukarı 25 dk", "25 min uphill to the centre"), L("Konum rezervasyondan sonra netleşiyor", "Exact location only after booking")],
      reviewSummary: L(
        "Ev sahibi çok ilgili, daire geniş ve temiz; merkeze dönüş yokuş yukarı ve uzun.",
        "Very attentive host, spacious and clean flat; the way back from the centre is long and uphill.",
      ),
      metrics: {
        cancellationType: "free",
        reviewAspects: [
          { aspect: "cleanliness", score: 4.9, scale: 5, sentiment: "positive" },
          { aspect: "location", score: 4.5, scale: 5, sentiment: "mixed" },
          { aspect: "communication", score: 4.9, scale: 5, sentiment: "positive" },
        ],
        amenities: ["mutfak", "çamaşır makinesi", "ücretsiz wifi", "balkon/teras"],
        stayKind: "apartment",
        bedrooms: 1,
      },
    }),
    item("stay", "stay:porto", "Ribeira Rooms", 330, {
      provider: "Booking.com",
      url: "https://www.booking.com/hotel/pt/ribeira-rooms.html?checkin=2026-10-08&checkout=2026-10-11&group_adults=2",
      summary: L("Nehir kıyısı, manzaralı", "Riverside, with a view"),
      location: { address: null, area: "Ribeira", approximate: false },
      geo: geo(41.141, -8.613),
      rating: { value: 9.2, scale: 10, count: 640, source: "page" },
      cancellation: { summary: L("İade yok", "Non-refundable"), freeUntil: null, source: "page" },
      highlights: [L("Nehir manzarası", "River view"), L("Tarihi bina", "Historic building")],
      concerns: [L("Hafta sonu gece gürültüsü", "Noise on weekend nights"), L("Asansör yok", "No lift")],
      reviewSummary: L(
        "Manzara ve konum harika; hafta sonları gece sokak gürültüsü şikâyeti tekrar ediyor.",
        "Great view and location; complaints about street noise on weekend nights keep coming up.",
      ),
      metrics: {
        cancellationType: "non_refundable",
        reviewAspects: [
          { aspect: "cleanliness", score: 9.0, scale: 10, sentiment: "positive" },
          { aspect: "comfort", score: 9.1, scale: 10, sentiment: "positive" },
          { aspect: "noise", score: null, scale: null, sentiment: "negative" },
        ],
        amenities: ["klima", "ücretsiz wifi", "manzara"],
        stayKind: "hotel_room",
      },
    }),
    // Getting to Lisbon: a saved train (the move and the station transfers show up on their own), and home by air.
    item("transport", "transport:porto-lizbon", L("CP Alfa Pendular · Porto → Lizbon", "CP Alfa Pendular · Porto → Lisbon"), 31, {
      provider: "CP",
      summary: L("11 Ekim 13:09 · 2 sa 55 dk", "11 Oct 13:09 · 2 h 55 min"),
      dates: { start: "2026-10-11", end: null, source: "page" },
      flight: { from: "Porto Campanhã", to: "Lisboa Santa Apolónia", departure: "2026-10-11T13:09", arrival: "2026-10-11T16:04", carrier: "CP", flightNumber: null, stops: 0 },
      cancellation: { summary: L("Kalkıştan 15 dk öncesine kadar iade", "Refundable until 15 min before departure"), freeUntil: null, source: "page" },
    }),
    item("flight", "flight:lis-ist", L("TAP · Lizbon → İstanbul", "TAP · Lisbon → Istanbul"), 162, {
      summary: L("14 Ekim 19:40 · Direkt", "14 Oct 19:40 · Direct"),
      provider: "TAP Air Portugal",
      status: "booked",
      city: L("İstanbul", "Istanbul"),
      dates: { start: "2026-10-14", end: null, source: "page" },
      flight: { from: "LIS", to: "IST", departure: "2026-10-14T19:40", arrival: "2026-10-15T01:35", carrier: "TAP", flightNumber: "TP 1760", stops: 0 },
      metrics: { durationMinutes: 295, checkedBagIncluded: true },
    }),
    // Lisbon is already booked: its nights are settled and the other Lisbon option is out of the way.
    item("stay", "stay:lizbon", "Lisboa Loft", 390, {
      provider: "Airbnb",
      summary: L("Alfama, rezerve edildi", "Alfama, booked"),
      city: L("Lizbon", "Lisbon"),
      status: "booked",
      dates: { start: "2026-10-11", end: "2026-10-14", source: "url" },
      location: { address: null, area: "Alfama", approximate: false },
      rating: { value: 4.9, scale: 5, count: 212, source: "page" },
      metrics: { cancellationType: "free" },
    }),
    item("stay", "stay:lizbon", "Alfama Suites", 420, {
      provider: "Booking.com",
      summary: "Alfama",
      city: L("Lizbon", "Lisbon"),
      dates: { start: "2026-10-11", end: "2026-10-14", source: "url" },
      rating: { value: 9.0, scale: 10, count: 530, source: "page" },
    }),
    item("activity", "activity:porto", L("Tiyatro", "Theatre"), 36, { dates: noDates, geo: geo(41.1437, -8.6076) }),
    item("activity", "activity:porto", L("Douro tekne turu", "Douro boat tour"), 25, {
      summary: L("Altı köprü turu", "Six bridges cruise"),
      status: "chosen",
      dates: { start: "2026-10-09", end: null, source: "page" },
      flight: { from: null, to: null, departure: "2026-10-09T16:00", arrival: null, carrier: null, flightNumber: null, stops: null },
      metrics: { durationMinutes: 50 },
      geo: geo(41.1405, -8.612),
    }),
    item("activity", "activity:porto", "Livraria Lello", 10, { dates: noDates, geo: geo(41.1469, -8.6149) }),
    item("activity", "activity:porto", L("Serralves Müzesi", "Serralves Museum"), 22, { dates: noDates, geo: geo(41.1597, -8.6597) }),
    item("food", "food:porto", "Majestic Café", null, { dates: noDates, geo: geo(41.1471, -8.6066) }),
    item("esim", "esim:portugal", L("Airalo Portekiz 5 GB", "Airalo Portugal 5 GB"), 9, {
      dates: noDates,
      summary: L("5 GB · 7 gün", "5 GB · 7 days"),
      metrics: { dataGb: 5, validityDays: 7 },
    }),
    item("esim", "esim:portugal", L("Holafly sınırsız", "Holafly unlimited"), 19, {
      dates: noDates,
      summary: L("Sınırsız · 7 gün", "Unlimited · 7 days"),
      metrics: { unlimitedData: true, validityDays: 7 },
    }),
  ];
  for (const i of items) await d.put("items", i);

  // What a close reading of the three Porto pages found (sample reviews, as a site shows them).
  const [jardim, casa, ribeira] = ["Jardim Stay", "Casa Azul", "Ribeira Rooms"].map((n) => items.find((i) => i.name === n)!);
  const listings: [Item, Listing][] = [
    [
      jardim,
      reading(jardim, 1204, [
        ["Quiet room at the back, we slept really well.", "2026-09"],
        ["Very quiet even though it is so central. Breakfast was excellent.", "2026-09"],
        ["The breakfast is fantastic, fresh pastries every morning.", "2026-08"],
        ["Room was small but spotless and quiet.", "2026-08"],
        ["Small room, barely space for two suitcases.", "2026-07"],
      ], [
        finding(L("Sessiz odalar, iyi uyku", "Quiet rooms, good sleep"), "positive", "noise", "reviews", "medium", [0, 1, 3]),
        finding(L("Kahvaltı çok iyi", "Excellent breakfast"), "positive", "food", "reviews", "medium", [1, 2]),
        finding(L("Odalar küçük", "Small rooms"), "negative", "space", "reviews", "medium", [3, 4]),
        finding(L("TV yok", "No TV"), "negative", "amenities", "amenities", "low", [], ["No TV in the rooms"]),
      ]),
    ],
    [
      casa,
      reading(casa, 96, [
        ["The bed is huge and very comfortable, and there is a great Italian restaurant right next door.", "2026-09"],
        ["Construction next door starts at 8 every morning, very noisy.", "2026-09"],
        ["Loved the host but the building work next to the flat was loud all day.", "2026-08"],
        ["Pizza place downstairs is amazing. Walk back from the river is steep uphill.", "2026-08"],
        ["Noise from the construction site next door, otherwise great.", "2026-07"],
      ], [
        finding(L("Yan binada inşaat gürültüsü", "Construction noise next door"), "negative", "condition", "reviews", "high", [1, 2, 4]),
        finding(L("Geniş, rahat yatak", "Big, comfortable bed"), "positive", "bed", "description", "medium", [], ["king-size bed"]),
        finding(L("Yanında çok iyi bir İtalyan restoranı", "Great Italian restaurant next door"), "positive", "nearby", "reviews", "medium", [0, 3]),
        finding(L("Merkezden dönüş dik yokuş", "Steep climb back from the centre"), "negative", "location", "reviews", "medium", [3]),
      ]),
    ],
    [
      ribeira,
      reading(ribeira, 640, [
        ["Waking up to the river view was unforgettable.", "2026-09"],
        ["Beautiful view of the Douro from our window. Saturday night was loud until 3am.", "2026-09"],
        ["Street noise on Friday and Saturday nights, bring earplugs.", "2026-08"],
        ["River view, great location, but noisy at the weekend.", "2026-07"],
        ["Bathroom was not very clean when we arrived.", "2024-05"],
      ], [
        finding(L("Odadan nehir manzarası", "River view from the room"), "positive", "view", "reviews", "medium", [0, 1, 3]),
        finding(L("Hafta sonu gece gürültüsü", "Noise on weekend nights"), "negative", "noise", "reviews", "medium", [1, 2, 3]),
        finding(L("Asansör yok, 3. kat", "No lift, 3rd floor"), "negative", "access", "description", "medium", [], ["Third floor, no elevator"]),
        finding(L("Banyo temizliği şikâyeti", "Complaint about bathroom cleanliness"), "negative", "cleanliness", "reviews", "low", [4]),
      ]),
    ],
  ];
  // What Jardim's page says about arriving and leaving (the transfers' notes use it).
  listings[0][1].house = {
    checkInFrom: "14:00",
    checkInUntil: "23:00",
    checkOutUntil: "11:00",
    selfCheckIn: false,
    luggageStorage: true,
    airportShuttle: null,
    quotes: ["Check-in from 14:00 until 23:00 · Check-out until 11:00 · Luggage storage available"],
  };
  for (const [, l] of listings) await d.put("listings", l);
  await d.put("preferences", { id: newId(), tripId: trip.id, text: L("Sessiz bir yer istiyoruz", "We want somewhere quiet"), createdAt: now });

  // The assistant's review of the Porto stays, made for exactly these inputs, ruling Casa Azul out
  // on the construction reviews (a sample; with a key, real reviews replace it when inputs change).
  const { decisions } = await loadDecisions(trip, items);
  const porto = [...decisions.values()].find((g) => g.options.some((o) => o.item.id === casa.id));
  if (porto) {
    const construction = listings[1][1].findings[0];
    const analysis: Analysis = {
      key: `${trip.id}|${porto.key}`,
      tripId: trip.id,
      needKey: porto.key,
      inputHash: porto.inputHash,
      createdAt: now,
      lang: lang(),
      verdict: L(
        "Jardim Stay: kaydettiğin yerlere yakın ve odaları sessiz. Casa Azul daha ucuz ama yan binadaki inşaat sessiz bir yer isteğine ters.",
        "Jardim Stay: close to the places you saved, with quiet rooms. Casa Azul is cheaper, but the construction next door goes against wanting somewhere quiet.",
      ),
      reasons: [
        L("Kaydettiğin 5 yere 5-9 dk → akşam dönüşleri kolay", "5-9 min to the 5 places you saved → easy evenings back"),
        L("3 yorum sessiz oda diyor → iyi uyku", "3 reviews say the rooms are quiet → good sleep"),
      ],
      tradeoffs: [L("Odalar küçük", "Small rooms")],
      risks: [L("Ribeira Rooms iadesiz ve hafta sonu geceleri gürültülü", "Ribeira Rooms is non-refundable and noisy on weekend nights")],
      question: null,
      aiScores: [
        { itemId: jardim.id, score: 8.5, note: L("sessiz, kahvaltı iyi", "quiet, good breakfast") },
        { itemId: casa.id, score: 4, note: L("inşaat gürültüsü", "construction noise") },
        { itemId: ribeira.id, score: 6, note: L("manzara ama gürültü", "view, but noisy") },
      ],
      eliminations: [{ itemId: casa.id, reason: L("Yan binada inşaat var; sessiz bir yer istiyorsun", "Construction next door; you want somewhere quiet"), findingIds: [construction.id] }],
    };
    await d.put("analyses", analysis);
  }

  function reading(item: Item, total: number, reviews: [string, string][], findings: Finding[]): Listing {
    const stored = reviews.map(([text, date]) => ({ id: textId(text), text, date, captureId: "demo" }));
    return {
      key: listingKeyOf(item),
      name: item.name,
      reviews: stored,
      reviewTotal: total,
      findings: findings.map((f) => ({ ...f, reviewIds: f.reviewIds.map((i) => stored[Number(i)].id) })),
      readCaptureIds: ["demo"],
      readAt: now,
      dropped: 0,
      error: null,
      errorAt: null,
      lang: lang(),
      updatedAt: now,
    };
  }

  const message = (role: ChatMessage["role"], text: string, choices: string[] = [], offset = 0): ChatMessage => ({
    id: newId(),
    tripId: trip.id,
    role,
    content: role === "event" ? null : [{ type: "text", text }],
    text,
    choices,
    createdAt: now + offset,
  });
  await d.put("messages", message("user", L("Merkezi olsun ama bütçeyi de aşmayalım.", "Somewhere central, but let's stay within budget."), [], 1));
  await d.put(
    "messages",
    message(
      "assistant",
      L(
        "Jardim Stay öne çıkıyor: kaydettiğin yerlere birkaç dakika yürüme ve ücretsiz iptal var.\nCasa Azul €45 daha ucuz ama merkeze yokuş yukarı 25 dk.\n\nKarşılaştır'dan önceliklerini değiştirip sonucu görebilirsin. Jardim'i planına alalım mı?",
        "Jardim Stay stands out: a few minutes' walk to the places you saved, and free cancellation.\nCasa Azul is €45 cheaper, but it's 25 min uphill to the centre.\n\nYou can change your priorities in Compare and see the result. Shall we add Jardim to your plan?",
      ),
      [L("Evet, ekleyelim", "Yes, add it"), L("Diğerlerini konuşalım", "Let's talk about the others")],
      2,
    ),
  );
  notifyChanged();
  return trip.id;
}
