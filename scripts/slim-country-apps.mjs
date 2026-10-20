// The phone apps' table as the extension reads it (0.39.7, "Telefonuna kur"): src/data/countryApps.json (the research,
// with its sources and checks) cut to what Hazırlık draws, into static/data/country-apps.json (copied to dist by the
// build, read with fetch when Hazırlık opens: it stays out of app.js). Run after the research file changes:
//   node scripts/slim-country-apps.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("src/data/countryApps.json", "utf8"));
const link = (u) => (typeof u === "string" && /^https:\/\/(apps\.apple\.com|play\.google\.com)\//.test(u) ? u : null);
const apps = {};
for (const [id, a] of Object.entries(src.catalog)) apps[id] = [a.name, a.cat, link(a.ios), link(a.android)];
const row = (a) => [a.id, a.why ?? "", a.cat ?? null, a.verified === false ? 0 : 1];
const countries = {};
for (const [cc, c] of Object.entries(src.countries)) {
  countries[cc] = {
    a: (c.apps ?? []).filter((a) => apps[a.id]).map(row),
    e: Object.entries(c.esim ?? {}).filter(([, v]) => v === "local").map(([k]) => k),
  };
}
const intents = {};
for (const [key, i] of Object.entries(src.intents)) {
  intents[key] = {
    n: [i.name?.tr ?? key, i.name?.en ?? key],
    a: (i.apps ?? []).filter((a) => apps[a.id]).map((a) => [a.id, a.why ?? ""]),
    r: (i.regional ?? []).filter((a) => apps[a.id]).map((a) => [a.id, a.why ?? "", a.countries ?? []]),
  };
}
const esim = {};
for (const [id, e] of Object.entries(src.esimProviders)) esim[id] = [e.name, link(e.ios), link(e.android)];
const out = { updated: src.updated, apps, countries, intents, esim };
mkdirSync("static/data", { recursive: true });
writeFileSync("static/data/country-apps.json", JSON.stringify(out));
console.log(`country-apps.json: ${Object.keys(countries).length} countries, ${Object.keys(apps).length} apps, ${Object.keys(intents).length} intents`);
