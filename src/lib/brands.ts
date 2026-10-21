// Where a card comes from, as a readable label in the source's own colour (plan v30: "Booking.com", "Airbnb", "Klook"):
// the way a flight shows its airline, a stay, a transfer and an activity show their site. Pure; the colours are the
// brands' own, picked to read white text on them.
export interface Brand {
  /** The name as written on the label. */
  label: string;
  /** The label's background (white text on it); null for a plain grey label. */
  color: string | null;
}

const BRANDS: [RegExp, string, string][] = [
  [/(^|[^a-z])booking\.com|^booking$/i, "Booking.com", "#003b95"],
  [/airbnb/i, "Airbnb", "#c8174f"],
  [/expedia/i, "Expedia", "#1a3a8f"],
  [/hotels\.com/i, "Hotels.com", "#c8102e"],
  [/agoda/i, "Agoda", "#5c2d91"],
  [/vrbo/i, "Vrbo", "#245abc"],
  [/getyourguide/i, "GetYourGuide", "#d4421a"],
  [/viator/i, "Viator", "#186b6d"],
  [/klook/i, "Klook", "#b23c00"],
  [/tripadvisor/i, "Tripadvisor", "#2e7d5b"],
  [/skyscanner/i, "Skyscanner", "#0062e3"],
  [/discovercars/i, "DiscoverCars", "#0f6b3a"],
  [/rentalcars/i, "Rentalcars", "#1b5fa8"],
  [/airalo/i, "Airalo", "#b82a30"],
  [/ubigi/i, "Ubigi", "#0a6c74"],
  [/holafly/i, "Holafly", "#5b2d90"],
  [/(^|\b)jr\b|japan rail/i, "JR", "#2a7a46"],
  [/trainline/i, "Trainline", "#00a88e"],
  [/omio/i, "Omio", "#e6007e"],
  [/flixbus/i, "FlixBus", "#73d700"],
];

/** The label for a source ("Booking.com", a provider name or a host); null when nothing says where it's from. */
export function brandOf(label: string | null | undefined, host?: string | null): Brand | null {
  const name = (label ?? "").trim();
  const site = (host ?? "").trim();
  if (!name && !site) return null;
  for (const [re, shown, color] of BRANDS) if (re.test(name) || (site && re.test(site))) return { label: shown, color };
  // A name we don't know keeps its own words on a grey label; a bare host is shown without "www.".
  return { label: name || site.replace(/^www\./, ""), color: null };
}
