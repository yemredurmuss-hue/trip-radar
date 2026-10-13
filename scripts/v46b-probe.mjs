// Second audit (plan v46): small probes on a profile that scripts/v30-shots.mjs seeded (SHOTS_PROFILE). Not a test run: it prints what it finds.
// `PROBE_PROFILE=<dir> [PROBE_WIDTH=1440] [PROBE_DIST=dist] PROBE=days,... node scripts/v46b-probe.mjs <out-dir>`
import { chromium } from "playwright-core";
import path from "node:path";
import { mkdirSync } from "node:fs";

const out = path.resolve(process.argv[2] ?? "e2e-output/v46b/p");
mkdirSync(out, { recursive: true });
const W = Number(process.env.PROBE_WIDTH ?? 1440);
const EN = process.env.PROBE_LANG === "en";
const dist = path.resolve(process.env.PROBE_DIST ?? "dist");
const which = (process.env.PROBE ?? "days").split(",");
const ctx = await chromium.launchPersistentContext(process.env.PROBE_PROFILE, {
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: false, timezoneId: "Europe/Istanbul", viewport: { width: W, height: 1000 }, locale: EN ? "en-US" : "tr-TR",
  args: ["--headless=new", "--hide-scrollbars", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", EN ? "--lang=en-US" : "--lang=tr-TR", `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
await ctx.route(/functions\/v1\/(web-search|city-image|offers)/, (r) => r.fulfill({ json: { answer: null, url: null, offers: [], reason: "not-configured" } }));
await ctx.clock.install({ time: new Date("2026-10-05T10:00:00") });
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
for (const p of ctx.pages()) if (p.url().includes("app.html")) await p.close();
const app = await ctx.newPage();
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
app.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_INTERNET|ERR_NAME/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
const log = (...a) => console.log(...a);
const step = async (n, f) => { try { await f(); } catch (e) { log("FAIL", n, String(e).split("\n")[0].slice(0, 200)); } };
const tripIds = async () => {
  await app.goto(`chrome-extension://${id}/app.html`);
  return app.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
    const trips = await new Promise((r) => { const q = db.transaction("trips").objectStore("trips").getAll(); q.onsuccess = () => r(q.result); });
    return trips.map((t) => [t.id, t.title]);
  });
};
const open = async (tid) => { await app.goto(`chrome-extension://${id}/app.html#trip=${tid}`); await app.reload(); await app.waitForTimeout(2500); };
const tab = (n) => app.getByRole("tab", { name: n, exact: true }).click();
const shot = (n, o = {}) => app.screenshot({ path: `${out}/${n}.png`, ...o });
const over = async (t) => log("OVERFLOW", t, await app.evaluate(() => document.documentElement.scrollWidth - innerWidth));
const trips = await tripIds();
log("trips", JSON.stringify(trips));
const T = Object.fromEntries(trips.map(([i, t]) => [/Portekiz/.test(t) ? "sample" : /Ozora/.test(t) ? "ozora" : "states", i]));
globalThis.P = { app, ctx, T, out, W, EN, log, step, open, tab, shot, over, id, errors };
for (const name of which) { log("== probe", name); await import(`./probes/${name}.mjs`); }
log("errors:", JSON.stringify(errors));
await ctx.close();
