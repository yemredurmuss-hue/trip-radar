// The PDF's "Rezervasyonlar" (row 24, A2 §4): beside each booking's name, day and price, what one needs on the way, as the
// booked box has it (B1): its reference, a stay's check-in and check-out hours (a way's time of leaving), its address. Only
// what the record (or its page's rules) says; nothing is written for what it doesn't. Pure.
import { bookingCopies, refFromNote } from "./bookingRows";
import type { CardKind } from "./cardKinds";
import { checkInTimeOf } from "./cardTime";
import { L } from "./i18n";
import { clockOf } from "./legs";
import type { HouseRules, Item } from "./types";

export interface PrintAccess {
  /** "Rezervasyon no 88120", "PNR K7T2QX". */
  code: string | null;
  /** "Giriş 15:00 · Çıkış 11:00"; a way's "Kalkış 07:10". */
  hours: string | null;
  address: string | null;
}

export function printAccess(item: Item, kind: CardKind, house?: Pick<HouseRules, "checkInFrom" | "checkOutUntil"> | null): PrintAccess {
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  const label = ref ? (Object.entries(bookingCopies(item, kind)).find(([, v]) => v.value === ref)?.[0] ?? null) : null;
  // Said in its note already ("PNR K7T2QX" under the name): not twice.
  const code = ref && !item.statusNote?.includes(ref) ? [label, ref].filter(Boolean).join(" ") : null;
  let hours: string | null = null;
  if (kind === "stay") {
    const inAt = checkInTimeOf(item, house);
    const outAt = house?.checkOutUntil ? checkInTimeOf({ dates: { start: null, end: null, source: "none" } }, { checkInFrom: house.checkOutUntil }) : null;
    hours = [inAt ? L(`Giriş ${inAt}`, `Check-in ${inAt}`) : null, outAt ? L(`Çıkış ${outAt}`, `Check-out ${outAt}`) : null].filter(Boolean).join(" · ") || null;
  } else {
    const leaves = clockOf(item.flight?.departure);
    hours = leaves ? L(`Kalkış ${leaves}`, `Leaves ${leaves}`) : null;
  }
  return { code, hours, address: item.location.address ?? item.location.area ?? null };
}
