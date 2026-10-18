// A festival or a burn (AfrikaBurn, Ozora, Sziget): the flight to its gateway, the way out to the site, the festival
// itself on its fixed days with its ticket to get (the official site on it), the days around it in the gateway city
// (the event route already makes them). No tours or sightseeing suggested: the festival is the trip.
import { L } from "../i18n";
import { card, daysOf, stayAt, transferTo } from "./cards";
import type { Playbook } from "./index";

export const festival: Playbook = {
  kind: "festival",
  skeleton: (ctx) => {
    const it = ctx.intent;
    const place = it?.place ?? ctx.stays[0]?.city ?? null;
    const own = stayAt(ctx, place);
    const stay = own ?? ctx.stays[0] ?? null;
    // The festival's own days when known (estimated or confirmed), else its stay's.
    const days = it?.dates ? { date: it.dates.start, end_date: it.dates.end } : daysOf(stay, ctx.dates);
    // Reached the day its own nights start; camping (no stay there), the day the trip reaches the festival's days.
    const multi = it?.dates && it.dates.end > it.dates.start ? it.dates : null;
    const reach = own?.date ?? (multi && ctx.dates ? (multi.start > ctx.dates.start ? multi.start : ctx.dates.start) : (stay?.date ?? days.date));
    return [
      // From the gateway (or the airport) to the site; on a road trip the car already goes there.
      ...transferTo(ctx, place, reach),
      card({
        kind: "activity",
        ref: "ticket",
        title: L("Festival bileti", "Festival ticket"),
        city: place,
        ...days,
        note: it?.url ? L(`Resmî site: ${it.url}`, `Official site: ${it.url}`) : null,
      }),
    ];
  },
  // On the title's plain words (no accents): "Douro tekne turu", "boat tour", "city sightseeing", "müze".
  blocked: { sections: ["activity"], words: /(^| )(tur|turu|turlari|tour|tours|cruise|tekne|boat|excursion|sightseeing|muze\w*|museum\w*|gunubirlik|day trip)( |$)/ },
  prep: () => [L("Çadır", "Tent"), L("Uyku tulumu", "Sleeping bag"), L("Kafa lambası", "Head torch"), L("Nakit", "Cash"), L("Kulak tıkacı", "Earplugs")],
  tip: () => L("Çoğu kişi 1–2 gün erken gidip iyi kamp yeri kapıyor.", "Most people arrive a day or two early to get a good camping spot."),
  questions: [
    {
      // v30: the nights at a festival are a camp by default, and the chat asks which kind (a tent, or a caravan); the old "camp or a hotel?"
      // (0.36.83) comes back as the third answer, a hotel by the site, which leaves the stay to find as on any trip.
      id: "stay",
      text: { tr: "Çadır kampı mı, karavan mı, otel mi?", en: "A tent camp, a caravan, or a hotel?" },
      chips: [
        // The camp card says "Rezervasyon gerekmez · bilete dahil": nothing to book, so no "book a spot" line either.
        { value: "camp", label: { tr: "Çadır kampı", en: "Tent camp" }, aliases: ["kamp", "camp", "camping", "çadır", "cadir", "tent"], effects: [{ op: "setStay", kind: "camp" }] },
        { value: "caravan", label: { tr: "Karavan kiralayalım", en: "Let's rent a caravan" }, aliases: ["karavan", "caravan", "camper", "van", "rv", "motorhome"], effects: [{ op: "setStay", kind: "vehicle" }] },
        { value: "hotel", label: { tr: "Otel", en: "Hotel" }, aliases: ["otel", "hotel", "pansiyon", "apart", "airbnb", "glamping"], effects: [{ op: "setStay", kind: "hotel" }] },
      ],
    },
    {
      id: "ticket",
      text: { tr: "Biletini aldın mı?", en: "Have you got your ticket yet?" },
      chips: [
        { value: "have", label: { tr: "Aldım", en: "Got it" }, aliases: ["aldık", "alındı", "aldim", "evet", "var", "yes", "bought", "got"], effects: [{ op: "markHandled", card: "ticket" }] },
        { value: "not_yet", label: { tr: "Henüz değil", en: "Not yet" }, aliases: ["almadım", "almadık", "henüz", "hayır", "yok", "no", "not yet", "nope"], effects: [] },
      ],
    },
    {
      id: "early",
      text: { tr: "Festivalden kaç gün önce gitmek istersin?", en: "How many days before the festival would you like to arrive?" },
      askIf: "eventDates",
      chips: [
        { value: "1", label: { tr: "1 gün", en: "1 day" }, aliases: ["bir gün", "one day", "1 gün önce"], effects: [{ op: "setStartOffsetDays", n: 1 }] },
        { value: "2", label: { tr: "2 gün", en: "2 days" }, aliases: ["iki gün", "two days"], effects: [{ op: "setStartOffsetDays", n: 2 }] },
        { value: "0", label: { tr: "Aynı gün", en: "Same day" }, aliases: ["aynı gün", "same day", "o gün", "ilk gün", "first day"], effects: [{ op: "setStartOffsetDays", n: 0 }] },
      ],
    },
  ],
  tone: () => L("Enerjik ve heyecanlı; festival hayatını bilen bir arkadaş gibi.", "Energetic and excited, like a friend who knows festival life."),
  avoid: () => L("Tur, tekne turu, müze ya da şehir gezisi önerme; gezinin amacı festival.", "Don't suggest tours, boat trips, museums or sightseeing; the festival is the point of the trip."),
};
