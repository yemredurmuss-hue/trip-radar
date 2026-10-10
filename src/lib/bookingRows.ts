// The booking's window (v11 phase 3, spec 2026-10-08-plan-pano-v11-design.md): what a booked card holds, as rows —
// its reference (PNR, ticket, policy, booking no.), the way there or the nights, the address, how many, until when
// it's free to cancel. From the record as it is (a document read fills these in, docReader.fillFromDoc). Pure.
import { cityOfAirport } from "./airports";
import type { CardKind } from "./cardKinds";
import { L } from "./i18n";
import { formatDateRange, isoDate } from "./items";
import { clockOf } from "./legs";
import type { Item } from "./types";

/** The reference said in the card's note by an older read ("PNR K7T2QX", "Rezervasyon no 88120"). */
export function refFromNote(note: string | null | undefined): string | null {
  const m = note?.match(/(?:PNR|Rezervasyon no|Booking ref|Poliçe no|Policy no|Bilet ·|Ticket ·)\s*([A-Za-z0-9][\w-]{2,})/);
  return m ? m[1] : null;
}

const refLabel = (kind: CardKind): string =>
  kind === "flight" ? "PNR" : kind === "insurance" ? L("Poliçe no", "Policy no") : kind === "activity" ? L("Bilet no", "Ticket no") : L("Rezervasyon no", "Booking ref");

const day = (iso: string | null | undefined): string | null => {
  const d = isoDate(iso?.slice(0, 10));
  return d ? formatDateRange(d, null) : null;
};

/**
 * What a row of bookingRows can hand to the clipboard, by the row's label: the reference, the address, and the airport
 * code of a flight's ends (`token`: the code as the row writes it, so the button can sit right by it). Pure.
 */
export function bookingCopies(item: Item, kind: CardKind): Record<string, { value: string; token?: string }> {
  const out: Record<string, { value: string; token?: string }> = {};
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  if (ref) out[refLabel(kind)] = { value: ref };
  const f = item.flight;
  if (kind !== "stay" && f && (f.from || f.to || f.departure)) {
    if (f.from && /^[A-Z]{3}$/.test(f.from)) out[L("Kalkış", "Departs")] = { value: f.from, token: f.from };
    if (f.to && /^[A-Z]{3}$/.test(f.to)) out[L("Varış", "Arrives")] = { value: f.to, token: f.to };
  }
  if (item.location.address) out[L("Adres", "Address")] = { value: item.location.address };
  return out;
}

export function bookingRows(item: Item, kind: CardKind): [string, string][] {
  const rows: [string, string][] = [];
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  if (ref) rows.push([refLabel(kind), ref]);
  const f = item.flight;
  if (kind === "stay") {
    const start = day(item.dates.start);
    const end = day(item.dates.end);
    if (start) rows.push([L("Giriş", "Check-in"), start]);
    if (end) rows.push([L("Çıkış", "Check-out"), end]);
  } else if (f && (f.from || f.to || f.departure)) {
    if (f.flightNumber) rows.push([kind === "flight" ? L("Uçuş", "Flight") : L("Sefer", "Service"), [f.carrier, f.flightNumber].filter(Boolean).join(" ")]);
    const end = (code: string | null, at: string | null) => [code ? `${cityOfAirport(code)}${code.length === 3 ? ` ${code}` : ""}` : null, [day(at), clockOf(at)].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
    const out = end(f.from, f.departure);
    const back = end(f.to, f.arrival);
    if (out) rows.push([L("Kalkış", "Departs"), out]);
    if (back) rows.push([L("Varış", "Arrives"), back]);
  } else if (item.dates.start) {
    const start = isoDate(item.dates.start);
    if (start) rows.push([L("Tarih", "Date"), formatDateRange(start, isoDate(item.dates.end))]);
  }
  if (item.location.address) rows.push([L("Adres", "Address"), item.location.address]);
  if (item.guests.adults) rows.push([L("Kişi", "People"), L(`${item.guests.adults} kişi`, `${item.guests.adults} ${item.guests.adults === 1 ? "person" : "people"}`)]);
  const free = day(item.cancellation.freeUntil);
  if (free) rows.push([L("Ücretsiz iptal", "Free cancellation"), L(`${free}'e kadar`, `until ${free}`)]);
  return rows;
}
