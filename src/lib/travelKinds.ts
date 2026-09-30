// What kind of trip a transport page is: a transfer within a city (to or from the airport, a taxi), a
// car rented for days in one place, or a trip between places. Shared by the plan and the transfers.
import type { Item } from "./types";

const LOCAL = /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen|transfer|shuttle|servis|taksi|taxi|uber|bolt|cabify|pick ?up|karşılama/i;
export const RENTAL = /araç kiralama|araba kiralama|rent.?a.?car|car rental|kiralık araç|car hire|autoeurope|rentalcars|discover cars|sixt|europcar|hertz|avis\b|\brentals?\b|\bcar rent\b/i;

export const itemText = (i: Item) => [i.name, i.summary, i.optionDetail, i.provider].filter(Boolean).join(" ");

/** Days between two dates (a rental runs for days; a ride doesn't). */
const span = (i: Item) => (i.dates.start && i.dates.end ? (Date.parse(i.dates.end) - Date.parse(i.dates.start)) / 86_400_000 : 0);

/** A car (or bike) rented for days in one place: it belongs to that place's days, not to a trip between cities. */
export const isRental = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind
    ? i.plannedKind === "car_rental"
    : RENTAL.test(itemText(i)) || (!i.flight?.from && !i.flight?.to && span(i) >= 2));

/** A transfer within a city (to or from the airport, a taxi...) rather than a trip between cities. */
export const isLocalTransfer = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind ? i.plannedKind === "transfer" || i.plannedKind === "taxi" : LOCAL.test(itemText(i)) && !RENTAL.test(itemText(i)));

/** A trip between places (a flight, a train...): what can get the traveller in, out or to the next city. */
export const isTrip = (i: Item) => i.category === "flight" || (i.category === "transport" && !isRental(i) && !isLocalTransfer(i));

export { LOCAL };
