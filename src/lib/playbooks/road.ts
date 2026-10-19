// A road trip (D11, gezi biçimi: a moving base): a rented car for the whole trip covers the drives between the cities
// (D10: "Dahil · kiralık araçla", never a decision of their own), a night or two in each town, and the driving permit.
// On the start's road mode the car is made with the travel (startTrip.creationOf), so only the permit is added here.
import { L } from "../i18n";
import { card, firstStay } from "./cards";
import type { Playbook } from "./index";

export const road: Playbook = {
  kind: "road",
  skeleton: (ctx) => {
    const first = firstStay(ctx);
    const car = ctx.road
      ? []
      : [
          card({
            kind: "car_rental",
            ref: "car",
            title: L("Araç kiralama", "Car rental"),
            city: first?.city ?? ctx.intent?.place ?? null,
            date: ctx.dates?.start ?? first?.date ?? null,
            end_date: ctx.dates?.end ?? null,
            part: { ref: "car", section: "transport", frame: "ticket", word: L("Araç", "Car"), covers: ["legs"] },
          }),
        ];
    return [
      ...car,
      card({ kind: "other", ref: "licence", title: L("Uluslararası ehliyet", "International driving permit"), part: { ref: "licence", section: "other", frame: "stay", word: L("Belge", "Document") } }),
    ];
  },
  blocked: {},
  prep: () => [L("ZTL bölgelerine bak", "Check the restricted traffic zones"), L("Otoyol ücreti için kart", "A card for the tolls"), L("Araç teslim saati", "The car's return time")],
  tip: () => L("Aracı aldığın yerde bırakırsan tek yön ücreti ödemezsin.", "Drop the car where you picked it up and there's no one-way fee."),
  questions: [],
  tone: () => L("Özgür ve meraklı; yolu seven bir arkadaş gibi.", "Free and curious, like a friend who loves the open road."),
};
