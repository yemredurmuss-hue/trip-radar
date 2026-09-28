// Sample trip so the board and the decision view can be explored before anything is captured.
import { db, newId, notifyChanged } from "./db";
import { EMPTY_METRICS } from "./items";
import type { Category, ChatMessage, Item, ItemMetrics, Trip } from "./types";

export async function loadDemoTrip(): Promise<string> {
  const d = await db();
  const now = Date.now();
  const trip: Trip = {
    id: newId(),
    title: "Portekiz (örnek)",
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
      country: "Portekiz",
      countryCode: "PT",
      location: { address: null, area: null, approximate: false },
      dates: { start: "2026-10-08", end: "2026-10-11", source: "url" },
      guests: { adults: 2, children: null, rooms: 1 },
      price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: now },
      priceHistory: [],
      cancellation: { summary: "5 Eki'ye kadar ücretsiz iptal", freeUntil: "2026-10-05", source: "page" },
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
    item("flight", "flight:ist-opo", "Pegasus · direkt", 148, {
      summary: "8 Ekim 07:10 · Direkt",
      provider: "Pegasus",
      optionDetail: "Avantajlı paket (20 kg bagaj)",
      dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 },
      cancellation: { summary: "İade yok, ücretli değişiklik", freeUntil: null, source: "page" },
      metrics: { durationMinutes: 295, checkedBagIncluded: true, cancellationType: "non_refundable" },
    }),
    item("flight", "flight:ist-opo", "TAP · Lizbon aktarmalı", 118, {
      summary: "8 Ekim 05:40 · 1 aktarma",
      provider: "TAP Air Portugal",
      optionDetail: "Discount (yalnız kabin bagajı)",
      dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T05:40", arrival: "2026-10-08T12:50", carrier: "TAP", flightNumber: "TP 1761", stops: 1 },
      cancellation: { summary: "Ücret kesintisiyle iade", freeUntil: null, source: "page" },
      metrics: { durationMinutes: 490, checkedBagIncluded: false, cancellationType: "partial" },
    }),
    item("stay", "stay:porto", "Jardim Stay", 285, {
      provider: "Booking.com",
      summary: "Baixa, Ribeira'ya 8 dk",
      location: { address: null, area: "Baixa", approximate: false },
      geo: geo(41.1455, -8.611),
      rating: { value: 8.9, scale: 10, count: 1204, source: "page" },
      highlights: ["Merkezi konum", "Sessiz odalar", "Kahvaltı dahil"],
      concerns: ["Odalar küçük"],
      reviewSummary: "Konum ve temizlik çok övülüyor; odalar küçük ama sessiz, personel yardımsever.",
      metrics: {
        cancellationType: "free",
        reviewAspects: [
          { aspect: "location", score: 9.5, scale: 10, sentiment: "positive" },
          { aspect: "cleanliness", score: 9.1, scale: 10, sentiment: "positive" },
          { aspect: "comfort", score: 8.6, scale: 10, sentiment: "positive" },
          { aspect: "staff", score: 9.3, scale: 10, sentiment: "positive" },
        ],
        amenities: ["klima", "ücretsiz wifi", "kahvaltı dahil", "asansör"],
      },
    }),
    item("stay", "stay:porto", "Casa Azul", 240, {
      provider: "Airbnb",
      summary: "Bonfim, mutfaklı daire",
      location: { address: null, area: "Bonfim", approximate: true },
      geo: geo(41.162, -8.589),
      rating: { value: 4.8, scale: 5, count: 96, source: "page" },
      highlights: ["Geniş daire", "Mutfak", "İlgili ev sahibi"],
      concerns: ["Merkeze yokuş yukarı 25 dk", "Konum rezervasyondan sonra netleşiyor"],
      reviewSummary: "Ev sahibi çok ilgili, daire geniş ve temiz; merkeze dönüş yokuş yukarı ve uzun.",
      metrics: {
        cancellationType: "free",
        reviewAspects: [
          { aspect: "cleanliness", score: 4.9, scale: 5, sentiment: "positive" },
          { aspect: "location", score: 4.5, scale: 5, sentiment: "mixed" },
          { aspect: "communication", score: 4.9, scale: 5, sentiment: "positive" },
        ],
        amenities: ["mutfak", "çamaşır makinesi", "ücretsiz wifi", "balkon/teras"],
      },
    }),
    item("stay", "stay:porto", "Ribeira Rooms", 330, {
      provider: "Booking.com",
      summary: "Nehir kıyısı, manzaralı",
      location: { address: null, area: "Ribeira", approximate: false },
      geo: geo(41.141, -8.613),
      rating: { value: 9.2, scale: 10, count: 640, source: "page" },
      cancellation: { summary: "İade yok", freeUntil: null, source: "page" },
      highlights: ["Nehir manzarası", "Tarihi bina"],
      concerns: ["Hafta sonu gece gürültüsü", "Asansör yok"],
      reviewSummary: "Manzara ve konum harika; hafta sonları gece sokak gürültüsü şikâyeti tekrar ediyor.",
      metrics: {
        cancellationType: "non_refundable",
        reviewAspects: [
          { aspect: "cleanliness", score: 9.0, scale: 10, sentiment: "positive" },
          { aspect: "comfort", score: 9.1, scale: 10, sentiment: "positive" },
          { aspect: "noise", score: null, scale: null, sentiment: "negative" },
        ],
        amenities: ["klima", "ücretsiz wifi", "manzara"],
      },
    }),
    item("activity", "activity:porto", "Tiyatro", 36, { dates: noDates, geo: geo(41.1437, -8.6076) }),
    item("activity", "activity:porto", "Douro tekne turu", 25, { dates: noDates, geo: geo(41.1405, -8.612) }),
    item("activity", "activity:porto", "Livraria Lello", 10, { dates: noDates, geo: geo(41.1469, -8.6149) }),
    item("activity", "activity:porto", "Serralves Müzesi", 22, { dates: noDates, geo: geo(41.1597, -8.6597) }),
    item("food", "food:porto", "Majestic Café", null, { dates: noDates, geo: geo(41.1471, -8.6066) }),
    item("esim", "esim:portugal", "Airalo Portekiz 5 GB", 9, {
      dates: noDates,
      summary: "5 GB · 7 gün",
      metrics: { dataGb: 5, validityDays: 7 },
    }),
    item("esim", "esim:portugal", "Holafly sınırsız", 19, {
      dates: noDates,
      summary: "Sınırsız · 7 gün",
      metrics: { unlimitedData: true, validityDays: 7 },
    }),
  ];
  for (const i of items) await d.put("items", i);

  const message = (role: ChatMessage["role"], text: string, choices: string[] = [], offset = 0): ChatMessage => ({
    id: newId(),
    tripId: trip.id,
    role,
    content: role === "event" ? null : [{ type: "text", text }],
    text,
    choices,
    createdAt: now + offset,
  });
  await d.put("messages", message("user", "Merkezi olsun ama bütçeyi de aşmayalım.", [], 1));
  await d.put(
    "messages",
    message(
      "assistant",
      "Jardim Stay öne çıkıyor: kaydettiğin yerlere birkaç dakika yürüme ve ücretsiz iptal var.\nCasa Azul €45 daha ucuz ama merkeze yokuş yukarı 25 dk.\n\nKarşılaştır'dan önceliklerini değiştirip sonucu görebilirsin. Jardim'i planına alalım mı?",
      ["Evet, ekleyelim", "Diğerlerini konuşalım"],
      2,
    ),
  );
  notifyChanged();
  return trip.id;
}
