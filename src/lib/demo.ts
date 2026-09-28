// Sample trip so the board can be explored before anything is captured.
import { db, newId, notifyChanged } from "./db";
import type { Category, ChatMessage, Item, Trip } from "./types";

export async function loadDemoTrip(): Promise<string> {
  const d = await db();
  const now = Date.now();
  const trip: Trip = {
    id: newId(),
    title: "Portekiz (örnek)",
    confirmedDates: { start: "2026-10-08", end: "2026-10-14" },
    budget: { amount: 1500, currency: "EUR" },
    heroImage: null,
    createdAt: now,
    updatedAt: now,
  };
  await d.put("trips", trip);

  const item = (
    category: Category,
    needKey: string,
    name: string,
    amount: number | null,
    extra: Partial<Item> = {},
  ): Item => ({
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
    highlights: [],
    concerns: [],
    reviewSummary: null,
    missing: [],
    status: "saved",
    statusNote: null,
    recommendation: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });

  const noDates = { start: null, end: null, source: "none" as const };
  const items: Item[] = [
    item("flight", "flight:ist-opo", "İstanbul → Porto", 148, {
      summary: "8 Ekim · Direkt",
      provider: "Pegasus",
      dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 },
      cancellation: { summary: "İade yok, ücretli değişiklik", freeUntil: null, source: "page" },
    }),
    item("stay", "stay:porto", "Jardim Stay", 285, {
      provider: "Booking.com",
      summary: "Baixa, Ribeira'ya 8 dk",
      location: { address: null, area: "Baixa", approximate: false },
      rating: { value: 8.9, scale: 10, count: 1204, source: "page" },
      recommendation: "Casa Azul'dan €45 fazla ama kaydettiğin 4 yere yürüme mesafesinde.",
      highlights: ["Merkezi konum", "Sessiz odalar"],
    }),
    item("stay", "stay:porto", "Casa Azul", 240, {
      provider: "Airbnb",
      summary: "Daha ekonomik",
      location: { address: null, area: "Bonfim", approximate: true },
      rating: { value: 4.8, scale: 5, count: 96, source: "page" },
      concerns: ["Merkeze 25 dk yürüme"],
    }),
    item("stay", "stay:porto", "Ribeira Rooms", 330, {
      provider: "Booking.com",
      summary: "Merkeze yakın",
      location: { address: null, area: "Ribeira", approximate: false },
      rating: { value: 9.2, scale: 10, count: 640, source: "page" },
      cancellation: { summary: "İade yok", freeUntil: null, source: "page" },
    }),
    item("activity", "activity:porto", "Tiyatro", 36, { dates: noDates }),
    item("activity", "activity:porto", "Douro tekne turu", 25, { dates: noDates }),
    item("activity", "activity:porto", "Livraria Lello", 10, { dates: noDates }),
    item("activity", "activity:porto", "Serralves Müzesi", 22, { dates: noDates }),
    item("food", "food:porto", "Majestic Café", null, { dates: noDates }),
    item("esim", "esim:portugal", "Airalo Portekiz 5 GB", 9, { dates: noDates, summary: "7 gün" }),
    item("esim", "esim:portugal", "Holafly sınırsız", 19, { dates: noDates, summary: "7 gün" }),
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
      "Jardim Stay iyi bir denge.\nCasa Azul'dan €45 fazla,\nama gezmek istediğin yerlere daha yakın.\n\nBunu planına alalım mı?",
      ["Evet, ekleyelim", "Diğerlerini konuşalım"],
      2,
    ),
  );
  notifyChanged();
  return trip.id;
}
