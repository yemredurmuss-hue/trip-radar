// Which trip the board opens on load: "#trip=<id>" (the popup's link) that one; "#home" none, the home (its own
// reload after a language or money is picked there, so it comes back to the home and not to the trip another tab
// opened last); otherwise the last trip viewed.

export const HOME_HASH = "#home";

export function openingTrip(hash: string, lastViewed: string | null): string | null {
  if (hash === HOME_HASH) return null;
  const match = hash.match(/^#trip=([\w-]+)/);
  return match ? match[1] : lastViewed;
}
