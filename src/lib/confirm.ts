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

/**
 * The words a booking's confirmation page is written in (Turkish, English, a few others): the booking itself confirmed,
 * or its payment gone through ("Ödeme başarılı", "Payment successful"; Pegasus 2026-10-29).
 */
const DONE =
  /(?<![\p{L}\p{N}])(?:rezervasyon(?:unuz|un)?\s+(?:onaylandi|tamamlandi|alindi)|siparişiniz\s+(?:onaylandi|alindi)|ödeme(?:niz)?\s+(?:başarili|başariyla\s+(?:tamamlandi|alindi|gerçekleşti)|alindi|tamamlandi|onaylandi)|(?:işleminiz|satin\s+alma(?:niz)?|rezervasyon(?:unuz)?)\s+başariyla\s+(?:tamamlandi|gerçekleşti|oluşturuldu)|biletiniz\s+(?:hazir|oluşturuldu)|(?:your\s+)?(?:booking|reservation|order)\s+(?:is\s+|has\s+been\s+)?confirmed|booking\s+confirmation|(?:payment|booking|purchase|order)\s+(?:was\s+|is\s+)?(?:successful|complete(?:d)?)|thank(?:s| you)\s+for\s+(?:your\s+)?(?:booking|reservation|order|purchase)|you'?re\s+(?:all\s+)?booked|buchung\s+(?:ist\s+)?bestätigt|zahlung\s+erfolgreich|reserva\s+confirmada|pago\s+(?:realizado|confirmado)|réservation\s+confirmée|paiement\s+réussi)/iu;

/** The address a confirmation page is served at (".../payment-success", "/confirmation.html", "/thank-you"). */
const DONE_PATH =
  /(?:payment|booking|order|purchase|reservation|checkout)[-_/]?(?:success(?:ful)?|complete(?:d)?|confirmed|confirmation)|\/(?:confirmation|confirmed|thank-?you|success|bestaetigung|onay|tesekkurler)(?:[./_-]|$)/i;

/**
 * "Onay numarası 4821 993 107", "Booking reference: ABC123", "PNR XK7Q2M", "Rezervasyon (PNR) No 2JB52G": what it is
 * (a booking, a PNR), what of it (its number, code, reference), a note in brackets on either side, then the number.
 */
const LABEL =
  /(?:(?:onay|rezervasyon|bilet|sipariş|confirmation|booking|reservation|order|itinerary)(?:\s*\([^)]{1,15}\))?\s+(?:numarasi|kodu|no|number|code|reference|ref|id)|pnr(?:\s+(?:numarasi|kodu|no|code|number))?|buchungsnummer)(?![\p{L}])\.?(?:\s*\([^)]{1,15}\))?\s*[:#.]?\s*(\d{2,}(?:[ -]\d{2,})+|[A-Z0-9]{5,20})/giu;

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
export function confirmationOf(page: { text: string; jsonLd?: readonly unknown[]; title?: string | null; url?: string | null }): Confirmation | null {
  const text = page.text.replace(/\s+/g, " ").slice(0, 30_000);
  const paid = text.match(PAID)?.[1]?.trim() ?? null;
  const ld = fromLd(page.jsonLd ?? []);
  if (ld?.code) return { code: ld.code, name: ld.name, paid };
  // (Turkish dotted and dotless i read as one letter: a pattern's /i folds neither "İşleminiz" nor "BAŞARILI")
  const folded = text.replace(/[ıİ]/g, "i");
  if (!DONE.test(`${(page.title ?? "").replace(/[ıİ]/g, "i")} ${folded}`) && !DONE_PATH.test(pathOf(page.url))) return null;
  // (each labelled number in turn: "PNR No Paylaş", a label with a button after it, is passed over for the next)
  for (const m of folded.matchAll(LABEL)) {
    // (a page's text run together, "2JB52GToplam": the number ends where a word begins; read in the page's own letters,
    // never the folded ones: "2JB52Gİstanbul" folded is "2JB52Gistanbul", and its G would be taken for the word's start)
    const at = (m.index ?? 0) + m[0].length - m[1].length;
    const n = text.slice(at, at + m[1].length).replace(/[A-ZÇĞİÖŞÜ]?[a-zçğıöşü].*$/, "").trim().replace(/[ -]+$/, "");
    // (a number is digits or capitals with at least one digit: "Rezervasyonunuz onaylandı" alone, or a word, is not one)
    if (/\d/.test(n) && n.replace(/[^A-Z0-9]/gi, "").length >= 5) return { code: n, name: ld?.name ?? null, paid };
  }
  return null;
}

/** A page address's path ("/booking/payment-success"), never its host or query. */
function pathOf(url: string | null | undefined): string {
  try {
    return new URL(url ?? "").pathname;
  } catch {
    return "";
  }
}
