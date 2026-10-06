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
    const stay = stayAt(ctx, place) ?? ctx.stays[0] ?? null;
    // The festival's own days when known (estimated or confirmed), else its stay's.
    const days = it?.dates ? { date: it.dates.start, end_date: it.dates.end } : daysOf(stay, ctx.dates);
    return [
      // From the gateway (or the airport) to the site; on a road trip the car already goes there.
      ...transferTo(ctx, place, stay?.date ?? days.date),
      card({
        kind: "activity",
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
  questions: () => [
    L("Kamp mı yapacaksın, otelde mi kalacaksın?", "Camping, or a hotel?"),
    L("Biletini aldın mı?", "Have you got your ticket yet?"),
    L("Festivalden kaç gün önce gitmek istersin?", "How many days before the festival would you like to arrive?"),
  ],
  tone: () => L("Enerjik ve heyecanlı; festival hayatını bilen bir arkadaş gibi.", "Energetic and excited, like a friend who knows festival life."),
  avoid: () => L("Tur, tekne turu, müze ya da şehir gezisi önerme; gezinin amacı festival.", "Don't suggest tours, boat trips, museums or sightseeing; the festival is the point of the trip."),
};
