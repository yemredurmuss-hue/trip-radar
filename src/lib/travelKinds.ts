// What kind of trip a transport page is: a transfer within a city (to or from the airport, a taxi), a
// car rented for days in one place, or a trip between places. Shared by the plan and the transfers.
import type { Item } from "./types";

const LOCAL = /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen|transfer|shuttle|servis|taksi|taxi|uber|bolt|cabify|pick ?up|karşılama/i;
export const RENTAL = /araç kiralama|araba kiralama|rent a car|car rental|kiralık araç|car hire|autoeurope|rentalcars|discover cars|sixt|europcar|hertz|avis\b/i;

export const itemText = (i: Item) => [i.name, i.summary, i.optionDetail, i.provider].filter(Boolean).join(" ");

/** A car (or bike) rented for days in one place: it belongs to that place's days, not to a trip between cities. */
export const isRental = (i: Item) =>
  i.category === "transport" && (i.plannedKind ? i.plannedKind === "car_rental" : RENTAL.test(itemText(i)));

/** A transfer within a city (to or from the airport, a taxi...) rather than a trip between cities. */
export const isLocalTransfer = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind ? i.plannedKind === "transfer" : LOCAL.test(itemText(i)) && !RENTAL.test(itemText(i)));

/** A trip between places (a flight, a train...): what can get the traveller in, out or to the next city. */
export const isTrip = (i: Item) => i.category === "flight" || (i.category === "transport" && !isRental(i) && !isLocalTransfer(i));

export { LOCAL };
