// Rezervasyon onayı (0.45.0, tuval 16 · E/F, Emre: "bir satın alma olduğunu fark edince onu da çekmeyi önersin"): a page that
// says a booking is done. Read by the code from what the page says (its JSON-LD's Reservation or Order, the words a
// confirmation is written in, a confirmation number), never guessed: without both a confirming word and a number it's
// nothing (the popup and the page ask only when sure). Saving it is the ordinary save: the model reads it, and its own
// rules make the record booked only with the number on the page (items.ts confirmed()). Pure; tested.

export interface Confirmation {
  /** The number as the page writes it ("4821 993 107", "ABC123"). */
  code: string;
  /** What it is for, when the page names it ("Visesa Ubud Resort"). */
  name: string | null;
  /** The amount paid, as written ("€378"). */
  paid: string | null;
}

/** The words a booking's confirmation page is written in (Turkish, English, a few others). */
const DONE =
  /\b(?:rezervasyon(?:unuz|un)?\s+(?:onaylandı|tamamlandı|alındı)|siparişiniz\s+(?:onaylandı|alındı)|ödemeniz\s+alındı|biletiniz\s+(?:hazır|oluşturuldu)|(?:your\s+)?(?:booking|reservation|order)\s+(?:is\s+|has\s+been\s+)?confirmed|booking\s+confirmation|thank(?:s| you)\s+for\s+(?:your\s+)?(?:booking|reservation|order)|you'?re\s+(?:all\s+)?booked|buchung\s+(?:ist\s+)?bestätigt|reserva\s+confirmada|réservation\s+confirmée)/i;

/** "Onay numarası 4821 993 107", "Booking reference: ABC123", "PNR XK7Q2M". */
const NUMBER =
  /(?:onay\s+(?:numarası|kodu|no)|rezervasyon\s+(?:numarası|kodu|no)|bilet\s+(?:numarası|no)|sipariş\s+(?:numarası|no)|pnr|confirmation\s+(?:number|code|no\.?)|booking\s+(?:number|reference|ref\.?|code|id)|reservation\s+(?:number|code|no\.?)|order\s+(?:number|no\.?)|itinerary\s+(?:number|no\.?)|buchungsnummer)\s*[:#.]?\s*([A-Z0-9](?:[A-Z0-9 -]{3,22}[A-Z0-9]))/i;

const PAID = /(?:ödendi|ödenen|toplam|total(?:\s+paid)?|amount\s+paid|paid)\s*[:\s]\s*((?:€|£|\$|₺|฿)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|£|\$|₺|฿|TL|EUR|USD|GBP|TRY|THB))/i;

const RESERVATION_TYPES = /^(?:Reservation|LodgingReservation|FlightReservation|TrainReservation|BusReservation|BoatReservation|EventReservation|FoodEstablishmentReservation|RentalCarReservation|TaxiReservation|TouristTripReservation|Order)$/;

/** What a JSON-LD block says of a reservation: its number and what it's for. */
function fromLd(blocks: readonly unknown[]): { code: string | null; name: string | null } | null {
  let found: { code: string | null; name: string | null } | null = null;
  const walk = (v: unknown, depth: number) => {
    if (found?.code || !v || typeof v !== "object" || depth > 5) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const o = v as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o["@type"] ?? []).filter((t): t is string => typeof t === "string");
    if (types.some((t) => RESERVATION_TYPES.test(t))) {
      const code = [o.reservationNumber, o.confirmationNumber, o.orderNumber, o.reservationId].find((x): x is string => typeof x === "string" && x.trim().length >= 4) ?? null;
      const what = (o.reservationFor ?? o.acceptedOffer) as Record<string, unknown> | undefined;
      const name = typeof what?.name === "string" ? what.name : null;
      found = { code: code?.trim() ?? null, name };
    }
    walk(o["@graph"], depth + 1);
    walk(o.mainEntity, depth + 1);
  };
  blocks.forEach((b) => walk(b, 0));
  return found;
}

/**
 * The page is a booking's confirmation: the JSON-LD's reservation with its number, or the confirming words and a
 * confirmation number in the text. Anything less is null.
 */
export function confirmationOf(page: { text: string; jsonLd?: readonly unknown[]; title?: string | null }): Confirmation | null {
  const text = page.text.replace(/\s+/g, " ").slice(0, 30_000);
  const paid = text.match(PAID)?.[1]?.trim() ?? null;
  const ld = fromLd(page.jsonLd ?? []);
  if (ld?.code) return { code: ld.code, name: ld.name, paid };
  if (!DONE.test(`${page.title ?? ""} ${text}`)) return null;
  // (a page's text run together, "107Toplam": the number ends where a word begins)
  const n = text.match(NUMBER)?.[1]?.replace(/[A-ZÇĞİÖŞÜ]?[a-zçğıöşü].*$/, "").trim().replace(/[ -]+$/, "");
  // (a number is digits or capitals with at least one digit: "Rezervasyonunuz onaylandı" alone, or a word, is not one)
  if (!n || !/\d/.test(n) || n.replace(/[^A-Z0-9]/gi, "").length < 5) return null;
  return { code: n, name: ld?.name ?? null, paid };
}
