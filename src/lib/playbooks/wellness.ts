// A wellness trip or retreat (a yoga retreat in Bali, a wellness festival in Sweden): the programme on its fixed
// days first, then the way there and a quiet stay; few activities suggested, the programme fills the days.
import { L } from "../i18n";
import { card, daysOf, firstStay, transferTo } from "./cards";
import type { Playbook } from "./index";

export const wellness: Playbook = {
  kind: "wellness",
  skeleton: (ctx) => {
    const it = ctx.intent;
    const stay = firstStay(ctx);
    const place = it?.place ?? stay?.city ?? null;
    const days = it?.dates ? { date: it.dates.start, end_date: it.dates.end } : daysOf(stay, ctx.dates);
    return [
      card({
        kind: "activity",
        title: it?.kind === "event" && it.name ? it.name : L("Wellness programı", "Wellness programme"),
        city: place,
        ...days,
        note: it?.url ? L(`Resmî site: ${it.url}`, `Official site: ${it.url}`) : null,
      }),
      ...transferTo(ctx, stay?.city ?? place, stay?.date ?? days.date),
    ];
  },
  blocked: { words: /(^| )(tur|turu|tour|tours|excursion|gunubirlik|day trip|party|parti\w*|nightlife|gece hayati)( |$)/, few: ["activity"] },
  prep: () => [L("Rahat kıyafet", "Comfortable clothes"), L("Yoga matı", "Yoga mat"), L("Matara", "Water bottle"), L("Kitap ya da defter", "A book or a notebook")],
  tip: () => L("Program başlamadan bir gün önce varırsan ilk güne dinlenmiş başlarsın.", "Arrive the day before the programme starts and you begin rested."),
  questions: () => [
    L("Programa kaydını yaptın mı?", "Are you signed up for the programme yet?"),
    L("Konaklama programın içinde mi?", "Is the stay part of the programme?"),
  ],
  tone: () => L("Sakin ve dingin; yavaş tempo, az ama öz.", "Calm and unhurried; slow pace, few words."),
  avoid: () => L("En fazla bir aktivite öner; tur, parti ya da yoğun gezi önerme.", "Suggest at most one activity; no tours, parties or busy sightseeing."),
};
