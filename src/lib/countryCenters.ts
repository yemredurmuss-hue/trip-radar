// Roughly where each country is (its middle, or where travellers mostly go for the very big ones), only to
// tell "could be the same journey" (Portugal and Spain, Thailand and Bali) from "another trip altogether"
// (Portugal and Bali). Approximate on purpose: a few hundred kilometres either way change nothing here.

const C: Record<string, [number, number]> = {
  // Europe
  PT: [39.6, -8.0], ES: [40.2, -3.6], FR: [46.6, 2.4], IT: [42.8, 12.6], DE: [51.1, 10.4], NL: [52.2, 5.5], BE: [50.6, 4.6],
  LU: [49.8, 6.1], AT: [47.6, 14.1], CH: [46.8, 8.2], GB: [54.0, -2.5], IE: [53.2, -8.2], IS: [64.9, -18.6], NO: [61.5, 9.5],
  SE: [60.5, 16.0], FI: [62.5, 25.5], DK: [56.0, 10.0], EE: [58.7, 25.5], LV: [56.9, 24.9], LT: [55.3, 23.9], PL: [52.1, 19.4],
  CZ: [49.8, 15.5], SK: [48.7, 19.5], HU: [47.2, 19.4], SI: [46.1, 14.8], HR: [45.1, 15.5], BA: [44.2, 17.8], RS: [44.0, 20.8],
  ME: [42.8, 19.3], MK: [41.6, 21.7], AL: [41.1, 20.0], XK: [42.6, 20.9], GR: [39.1, 22.0], BG: [42.7, 25.2], RO: [45.9, 25.0],
  MD: [47.2, 28.5], UA: [49.0, 31.3], BY: [53.5, 28.0], MT: [35.9, 14.4], CY: [35.0, 33.2], AD: [42.5, 1.6], MC: [43.7, 7.4],
  SM: [43.9, 12.5], VA: [41.9, 12.45], LI: [47.15, 9.55], GI: [36.1, -5.35], FO: [62.0, -7.0], RU: [55.8, 37.6],
  // Türkiye, the Caucasus, the Middle East
  TR: [39.0, 35.2], GE: [42.2, 43.4], AM: [40.1, 45.0], AZ: [40.3, 47.7], IL: [31.4, 35.0], PS: [31.9, 35.2], JO: [31.2, 36.4],
  LB: [33.9, 35.9], SY: [35.0, 38.5], IQ: [33.0, 43.7], IR: [32.4, 53.7], SA: [24.0, 45.0], AE: [24.0, 54.0], QA: [25.3, 51.2],
  BH: [26.0, 50.55], KW: [29.3, 47.6], OM: [21.5, 56.0], YE: [15.6, 48.0],
  // Africa
  MA: [31.8, -7.1], DZ: [28.0, 2.6], TN: [34.0, 9.5], LY: [27.0, 17.0], EG: [26.8, 30.8], SD: [15.6, 30.2], ET: [9.1, 40.5],
  KE: [0.0, 37.9], TZ: [-6.4, 34.9], UG: [1.4, 32.3], RW: [-1.9, 29.9], ZA: [-29.0, 24.7], NA: [-22.6, 17.1], BW: [-22.3, 24.7],
  ZW: [-19.0, 29.2], ZM: [-13.1, 27.8], MZ: [-18.7, 35.5], MG: [-18.8, 46.9], MU: [-20.3, 57.6], SC: [-4.7, 55.5],
  SN: [14.5, -14.5], GH: [7.9, -1.0], NG: [9.1, 8.7], CI: [7.5, -5.5], CM: [7.4, 12.4], CV: [16.0, -24.0],
  // Asia
  IN: [22.0, 79.0], LK: [7.9, 80.8], MV: [3.2, 73.2], NP: [28.4, 84.1], BT: [27.5, 90.4], BD: [23.7, 90.4], PK: [30.4, 69.3],
  AF: [33.9, 67.7], UZ: [41.4, 64.6], KZ: [48.0, 67.0], KG: [41.2, 74.8], TJ: [38.9, 71.3], TM: [39.0, 59.6], MN: [46.9, 103.8],
  CN: [35.9, 104.2], HK: [22.3, 114.2], MO: [22.2, 113.55], TW: [23.7, 121.0], JP: [36.2, 138.3], KR: [36.5, 127.9],
  KP: [40.3, 127.5], TH: [15.9, 101.0], VN: [14.1, 108.3], LA: [19.9, 102.5], KH: [12.6, 105.0], MM: [21.9, 96.0],
  MY: [4.2, 102.0], SG: [1.35, 103.8], ID: [-2.5, 118.0], PH: [12.9, 121.8], BN: [4.5, 114.7], TL: [-8.9, 125.7],
  // Oceania
  AU: [-25.3, 133.8], NZ: [-41.0, 174.0], FJ: [-17.7, 178.1], PF: [-17.7, -149.4], NC: [-21.0, 165.6], PG: [-6.3, 143.9],
  // The Americas
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.5], GT: [15.8, -90.2], BZ: [17.2, -88.5], HN: [15.2, -86.2],
  SV: [13.8, -88.9], NI: [12.9, -85.2], CR: [9.7, -83.8], PA: [8.5, -80.8], CU: [21.5, -77.8], JM: [18.1, -77.3],
  HT: [19.0, -72.3], DO: [18.7, -70.2], PR: [18.2, -66.6], BS: [25.0, -77.4], BB: [13.2, -59.5], TT: [10.7, -61.2],
  AW: [12.5, -70.0], CW: [12.2, -69.0], CO: [4.6, -74.3], VE: [6.4, -66.6], EC: [-1.8, -78.2], PE: [-9.2, -75.0],
  BO: [-16.3, -63.6], BR: [-14.2, -51.9], PY: [-23.4, -58.4], UY: [-32.5, -55.8], AR: [-38.4, -63.6], CL: [-35.7, -71.5],
  GY: [4.9, -58.9], SR: [3.9, -56.0], GL: [72.0, -40.0],
};

/** Two countries this close can be one journey (Portugal → Spain, Thailand → Bali); farther apart is another trip. */
export const NEAR_KM = 3000;

/** Kilometres between two countries' middles; null when either isn't known here. */
export function countryDistanceKm(a: string, b: string): number | null {
  const x = C[a.toUpperCase()];
  const y = C[b.toUpperCase()];
  if (!x || !y) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(y[0] - x[0]) / 2) ** 2 + Math.cos(rad(x[0])) * Math.cos(rad(y[0])) * Math.sin(rad(y[1] - x[1]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Same country, or close enough to be the same journey. A country this table doesn't know is never "near". */
export function nearCountries(a: string, b: string): boolean {
  if (a.toUpperCase() === b.toUpperCase()) return true;
  const km = countryDistanceKm(a, b);
  return km != null && km <= NEAR_KM;
}
