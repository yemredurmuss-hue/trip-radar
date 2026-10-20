#!/usr/bin/env node
// Checks src/data/countryApps.json (the "Telefonuna kur" country table, docs/arastirma/2026-10-21-ulke-uygulamalari.md).
//   node scripts/check-country-apps.mjs            schema + store-URL shape
//   node scripts/check-country-apps.mjs --net 40   also asks the stores about 40 random links (iTunes lookup, Play page 200)
//   node scripts/check-country-apps.mjs --net all  every link
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../src/data/countryApps.json", import.meta.url));
const CATS = ["ride", "rail", "transit", "food", "pay", "map", "chat", "other"];
const CONF = ["high", "medium", "low"];
const ESIM = ["local", "regional", "none", "unknown"];
const IOS = /^https:\/\/apps\.apple\.com\/app\/id\d{6,}$/;
const ANDROID = /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const URL_RE = /^https?:\/\/[^\s]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

const doc = JSON.parse(readFileSync(FILE, "utf8"));
if (!DATE.test(doc.updated ?? "")) err("updated", `not YYYY-MM-DD: ${doc.updated}`);
if (!doc.catalog || typeof doc.catalog !== "object") err("catalog", "missing");
if (!doc.countries || typeof doc.countries !== "object") err("countries", "missing");

for (const [id, a] of Object.entries(doc.catalog ?? {})) {
  const w = `catalog.${id}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err(w, "id must be a lowercase slug");
  if (!a.name) err(w, "name missing");
  if (!CATS.includes(a.cat) && a.cat !== "intent") err(w, `bad cat ${a.cat}`);
  if (a.ios && !IOS.test(a.ios)) err(w, `bad iOS URL ${a.ios}`);
  if (a.android && !ANDROID.test(a.android)) err(w, `bad Play URL ${a.android}`);
  if (!a.ios && !a.android) warn(w, "no store link at all");
}

for (const [p, v] of Object.entries(doc.esimProviders ?? {})) {
  if (v.ios && !IOS.test(v.ios)) err(`esimProviders.${p}`, `bad iOS URL ${v.ios}`);
  if (v.android && !ANDROID.test(v.android)) err(`esimProviders.${p}`, `bad Play URL ${v.android}`);
}

const used = new Set();
for (const [cc, c] of Object.entries(doc.countries ?? {})) {
  const w = `countries.${cc}`;
  if (!/^[A-Z]{2}$/.test(cc)) err(w, "key must be ISO 3166-1 alpha-2");
  if (!c.name?.tr || !c.name?.en) err(w, "name.tr / name.en missing");
  if (![1, 2].includes(c.tier)) err(w, `tier must be 1 or 2, got ${c.tier}`);
  if (!Array.isArray(c.apps)) { err(w, "apps must be an array"); continue; }
  if (!Array.isArray(c.notes)) err(w, "notes must be an array");
  if (c.tier === 1 && c.apps.length < 3) warn(w, `tier 1 with only ${c.apps.length} apps`);
  if (!c.apps.some((a) => a.cat === "chat")) warn(w, "no chat app");
  if (!c.apps.some((a) => a.cat === "ride")) warn(w, "no ride app");
  const seen = new Set();
  for (const a of c.apps) {
    const wa = `${w}.${a.id}`;
    if (!doc.catalog?.[a.id]) err(wa, "id not in catalog");
    if (seen.has(a.id)) err(wa, "listed twice");
    seen.add(a.id);
    used.add(a.id);
    if (!CATS.includes(a.cat)) err(wa, `bad cat ${a.cat}`);
    if (!a.why) err(wa, "why missing");
    else if (a.why.length > 120) warn(wa, `why is ${a.why.length} chars`);
    if (typeof a.verified !== "boolean") err(wa, "verified must be boolean");
    if (!CONF.includes(a.confidence)) err(wa, `bad confidence ${a.confidence}`);
    if (a.verified && !URL_RE.test(a.source ?? "")) err(wa, "verified without a source URL");
    if (a.source && !URL_RE.test(a.source)) err(wa, `source is not a URL: ${a.source}`);
  }
  for (const [p, v] of Object.entries(c.esim ?? {})) if (!ESIM.includes(v)) err(`${w}.esim.${p}`, `bad value ${v}`);
}
// trip-type apps (hiking, diving, festival...): same row rules, no country, optional `countries` for regional picks
for (const [key, it] of Object.entries(doc.intents ?? {})) {
  const w = `intents.${key}`;
  if (!it.name?.tr || !it.name?.en) err(w, "name.tr / name.en missing");
  if (!Array.isArray(it.apps) || !it.apps.length) err(w, "apps must be a non-empty array");
  for (const a of [...(it.apps ?? []), ...(it.regional ?? [])]) {
    const wa = `${w}.${a.id}`;
    if (!doc.catalog?.[a.id]) err(wa, "id not in catalog");
    used.add(a.id);
    if (!a.why) err(wa, "why missing");
    if (typeof a.verified !== "boolean") err(wa, "verified must be boolean");
    if (!CONF.includes(a.confidence)) err(wa, `bad confidence ${a.confidence}`);
    if (a.verified && !URL_RE.test(a.source ?? "")) err(wa, "verified without a source URL");
    for (const cc of a.countries ?? []) if (!/^[A-Z]{2}$/.test(cc)) err(wa, `bad country ${cc}`);
  }
  for (const a of it.regional ?? []) if (!a.countries?.length) err(`${w}.${a.id}`, "regional pick without countries");
}

for (const id of Object.keys(doc.catalog ?? {})) if (!used.has(id)) warn(`catalog.${id}`, "not used by any country");

const rows = Object.values(doc.countries ?? {}).flatMap((c) => c.apps ?? []);
const tier1 = Object.values(doc.countries ?? {}).filter((c) => c.tier === 1).length;
console.log(`countries ${Object.keys(doc.countries ?? {}).length} (tier 1: ${tier1}) · intents ${Object.keys(doc.intents ?? {}).length} · catalog ${Object.keys(doc.catalog ?? {}).length} · rows ${rows.length} · unverified ${rows.filter((a) => !a.verified).length}`);

// --- optional network sample ---------------------------------------------------------------------------------------
const netArg = process.argv.indexOf("--net");
if (netArg > -1) {
  const want = process.argv[netArg + 1] ?? "30";
  const links = Object.entries(doc.catalog).flatMap(([id, a]) => [a.ios && { id, url: a.ios, kind: "ios" }, a.android && { id, url: a.android, kind: "android" }].filter(Boolean));
  const pick = want === "all" ? links : links.sort(() => Math.random() - 0.5).slice(0, Number(want));
  let bad = 0;
  // stores answer per storefront: without one Play uses the caller's country, so an app absent there 404s. Ask the US
  // storefront first, then the countries that list the app (China, Korea, Russia, Iran apps are often storefront-limited)
  const storefronts = (id) => ["us", ...Object.entries(doc.countries).filter(([, c]) => c.apps.some((x) => x.id === id)).map(([k]) => k.toLowerCase()).slice(0, 3)];
  const check = async ({ id, url, kind }) => {
    try {
      let ok = false;
      let status = 0;
      for (const cc of storefronts(id)) {
        if (kind === "ios") {
          const r = await fetch(`https://itunes.apple.com/lookup?id=${url.match(/id(\d+)$/)[1]}&country=${cc}`);
          status = r.status;
          ok = r.ok && (await r.json()).resultCount > 0;
        } else {
          const r = await fetch(`${url}&hl=en&gl=${cc}`, { headers: { "user-agent": "Mozilla/5.0" } });
          status = r.status;
          ok = r.status === 200;
        }
        if (ok) break;
      }
      if (!ok) { bad++; console.log(`  ✗ ${id} ${kind} ${status} ${url}`); }
    } catch (e) {
      bad++;
      console.log(`  ✗ ${id} ${kind} network error ${e.message}`);
    }
  };
  for (let i = 0; i < pick.length; i += 8) await Promise.all(pick.slice(i, i + 8).map(check));
  console.log(`net: ${pick.length - bad}/${pick.length} links answered`);
  if (bad) errors.push(`net: ${bad} store links failed`);
}

for (const w of warns.slice(0, 40)) console.log(`  · ${w}`);
if (warns.length > 40) console.log(`  · …and ${warns.length - 40} more warnings`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`${errors.length} error(s)`);
  process.exit(1);
}
console.log(`ok (${warns.length} warnings)`);
