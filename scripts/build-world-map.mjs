// Makes static/map/world.json, the generating screen's map (no network, no map API): Natural Earth's 1:110m
// countries (public domain), as redistributed by world-atlas 2 (ISC), projected equirectangular to one land path
// and one path of the borders between countries, rounded and simplified; plus each country's centroid (its largest
// polygon's) by ISO 3166-1 alpha-2 code. Run once when the map should change; the output is checked in.
//
//   npm pack world-atlas@2 && tar xzf world-atlas-2.*.tgz
//   node scripts/build-world-map.mjs package/countries-110m.json
//
// The projection here must stay the one in src/lib/startMap.ts (MAP_W, LAT_TOP, LAT_BOTTOM).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/build-world-map.mjs <countries-110m.json>");
const topo = JSON.parse(readFileSync(src, "utf8"));

const W = 1000;
const LAT_TOP = 84;
const LAT_BOTTOM = -57;
const H = Math.round((W * (LAT_TOP - LAT_BOTTOM)) / 360);
const px = (lng) => ((lng + 180) / 360) * W;
const py = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;

// --- TopoJSON decoding (quantized, delta-encoded arcs) ----------------------------------------------------------
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => ((x += dx), (y += dy), [x * scale[0] + translate[0], y * scale[1] + translate[1]]));
});
const arcPoints = (i) => (i < 0 ? [...arcs[~i]].reverse() : arcs[i]);
const ring = (indices) => {
  const out = [];
  for (const [k, i] of indices.entries()) {
    const pts = arcPoints(i);
    out.push(...(k ? pts.slice(1) : pts));
  }
  return unwrap(out);
};
/**
 * A ring or line that crosses the date line (Fiji, Chukotka) made continuous: each step of more than 180° in
 * longitude is taken the other way round, so the ring runs past ±180° instead of a stripe across the whole map. The
 * screen draws the map three times side by side, so what runs past the edge shows on the other side.
 */
function unwrap(points) {
  let shift = 0;
  return points.map(([lng, lat], k) => {
    if (k) {
      const prev = points[k - 1][0];
      if (lng - prev > 180) shift -= 360;
      else if (prev - lng > 180) shift += 360;
    }
    return [lng + shift, lat];
  });
}
/** A longitude back in [-180, 180]. */
const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;
const polygonsOf = (g) => (g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : []);

// --- path writing: absolute start, relative steps rounded to 0.1 px, tiny steps merged -------------------------
const r1 = (v) => Math.round(v * 10) / 10;
function pathOf(points, close) {
  const xy = points.map(([lng, lat]) => [r1(px(lng)), r1(py(Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat))))]);
  let d = `M${xy[0][0]} ${xy[0][1]}`;
  let [cx, cy] = xy[0];
  for (let k = 1; k < xy.length; k++) {
    const [x, y] = xy[k];
    const last = k === xy.length - 1;
    // Steps under 0.6 px are dropped (the map is drawn a few hundred pixels wide), but never the last point.
    if (!last && Math.hypot(x - cx, y - cy) < 0.6) continue;
    const dx = r1(x - cx);
    const dy = r1(y - cy);
    if (!dx && !dy) continue;
    d += `l${dx} ${dy}`.replace(/ -/g, "-");
    [cx, cy] = [x, y];
  }
  return close ? `${d}z` : d;
}

// Land: every polygon of the land collection, Antarctica left out (below the map).
const land = topo.objects.land.geometries.flatMap(polygonsOf).flatMap((poly) =>
  poly.map(ring).filter((pts) => pts.some(([, lat]) => lat > LAT_BOTTOM + 1)).map((pts) => pathOf(pts, true)),
);

// Borders: the arcs two countries share.
const uses = new Map();
for (const g of topo.objects.countries.geometries)
  for (const poly of polygonsOf(g)) for (const r of poly) for (const i of r) {
    const a = i < 0 ? ~i : i;
    uses.set(a, (uses.get(a) ?? 0) + 1);
  }
const borders = [...uses].filter(([, n]) => n > 1).map(([a]) => pathOf(unwrap(arcs[a]), false));

// Centroids by code: the largest polygon's outer ring (planar, in degrees), named through Intl.
const FIX = {
  "United States of America": "US", "Dem. Rep. Congo": "CD", Congo: "CG", "Central African Rep.": "CF", "S. Sudan": "SS", "Bosnia and Herz.": "BA",
  "Dominican Rep.": "DO", "Eq. Guinea": "GQ", "Solomon Is.": "SB", "Falkland Is.": "FK", "Fr. S. Antarctic Lands": "TF", "W. Sahara": "EH",
  "Côte d'Ivoire": "CI", eSwatini: "SZ", Macedonia: "MK", "North Macedonia": "MK", Czechia: "CZ", "Timor-Leste": "TL", Kosovo: "XK", Palestine: "PS",
  Taiwan: "TW", Myanmar: "MM", "Bahamas": "BS", "Gambia": "GM", "Turkey": "TR", "Brunei": "BN", "Vietnam": "VN", "Russia": "RU", "Laos": "LA",
  "South Korea": "KR", "North Korea": "KP", "Iran": "IR", "Syria": "SY", "Moldova": "MD", "Tanzania": "TZ", "Bolivia": "BO", "Venezuela": "VE", "Trinidad and Tobago": "TT",
};
const byName = new Map();
const names = new Intl.DisplayNames(["en"], { type: "region" });
for (let i = 0; i < 26; i++)
  for (let j = 0; j < 26; j++) {
    const code = String.fromCharCode(65 + i, 65 + j);
    try {
      const n = names.of(code);
      if (n && n !== code && !byName.has(n)) byName.set(n, code);
    } catch {
      // not a region
    }
  }
const area = (pts) => {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    x += (x0 + x1) * f;
    y += (y0 + y1) * f;
  }
  return { a: a / 2, x: x / (3 * a), y: y / (3 * a) };
};
const centroids = {};
const missed = [];
for (const g of topo.objects.countries.geometries) {
  const name = g.properties?.name ?? "";
  const code = FIX[name] ?? byName.get(name);
  if (!code) {
    missed.push(name);
    continue;
  }
  let best = null;
  for (const poly of polygonsOf(g)) {
    const c = area(ring(poly[0]));
    if (Number.isFinite(c.x) && (!best || Math.abs(c.a) > Math.abs(best.a))) best = c;
  }
  if (best) centroids[code] = [Math.round(wrapLng(best.x) * 100) / 100, Math.round(best.y * 100) / 100];
}
// Countries round the date line or spread over islands: their main land by hand ([lng, lat]).
Object.assign(centroids, { FJ: [178.07, -17.75], RU: [96.7, 61.5], KI: [172.98, 1.45] });

mkdirSync("static/map", { recursive: true });
const out = { w: W, h: H, top: LAT_TOP, bottom: LAT_BOTTOM, source: "Natural Earth 1:110m (public domain), via world-atlas 2", land: land.join(""), borders: borders.join(""), centroids };
const text = JSON.stringify(out);
writeFileSync("static/map/world.json", text);
console.log(`static/map/world.json: ${(text.length / 1024).toFixed(1)} KB, ${land.length} land rings, ${borders.length} borders, ${Object.keys(centroids).length} centroids`);
if (missed.length) console.log(`no code for: ${missed.join(", ")}`);
