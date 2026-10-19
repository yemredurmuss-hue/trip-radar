// Loads the built extension in Chromium and checks the page reader, the capture queue and the board.
// Usage: npm run build && xvfb-run -a node scripts/e2e.mjs   (screenshots go to e2e-output/)
import { build } from "esbuild";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

// The Plan's "sihirli açılış" (src/app/opening.ts) plays the first time a trip is opened in a session and would catch every check half way
// (pieces fade in over about 2.5 s): it is switched off in every context but the one that checks it (Part 5, `openingOn`).
let openingOn = false;
const launchPersistent = chromium.launchPersistentContext.bind(chromium);
// A trip's title as tripName.ts writes it (0.39.3): the length, the place, a theme word, the kind ("1 Aylık Bali Doğa
// Tatili", "3-Week Papua New Guinea Friends Trip"). The scenarios check the place is in it, not the words around it.
const titled = (place) => new RegExp(`^(\\d+ (Günlük|Haftalık|Aylık) |\\d+-(Day|Week|Month) )?${place}( \\S+)*$`);
chromium.launchPersistentContext = async (...args) => {
  const ctx = await launchPersistent(...args);
  if (!openingOn) await ctx.addInitScript(() => { try { sessionStorage.setItem("trip-radar:opening-off", "1"); } catch {} });
  ctx.on("page", settledShots);
  // The rate source is a live network call: a sandbox without outbound access would leave the hero without its rate tip.
  await ctx.route(/frankfurter/, (route) => route.fulfill({ json: { date: "2026-09-28", rates: { TRY: 40, THB: 38, USD: 1.1 } } }));
  // E2E_OFFLINE=1 (a sandbox with no outbound network): the sources the pages ask for on their own (Wikipedia photos, the sharing
  // server's functions) answer "nothing found", as they do for a trip with no photo; a real network is used otherwise.
  if (process.env.E2E_OFFLINE) {
    // Anything else on the web: a quick "not found" (the PDF maker's picture of the page rejects on a refused connection, not on a 404).
    await ctx.route(/^https?:\/\/(?!generativelanguage\.googleapis|api\.anthropic|api\.frankfurter|zjkesdsbructiyflzqvq)/, (route) =>
      route.request().resourceType() === "image" || /\.(png|jpe?g|webp|gif|ico)(\?|$)/i.test(route.request().url())
        ? route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") })
        : route.fulfill({ status: 404, body: "" }));
    await ctx.route(/wikipedia\.org|wikimedia\.org/, (route) => route.fulfill({ status: 404, json: {} }));
    await ctx.route(/supabase\.co\/functions/, (route) => route.fulfill({ json: { answer: null, url: null, offers: [], reason: "not-configured" } }));
  }
  return ctx;
};
// The motion language (app.css "Hareket dili", mv-* keyframes) fades windows and drawers in: a page screenshot waits for those
// entrances to end, or a window is caught half see-through. Looping ones (dots, spinner) and the opening's own pieces are left alone.
function settledShots(page) {
  const shot = page.screenshot.bind(page);
  page.screenshot = async (options) => {
    await page
      .evaluate(() => {
        const entering = document.getAnimations().filter((a) => a.animationName?.startsWith("mv-") && a.effect?.getComputedTiming().iterations !== Infinity);
        return Promise.race([Promise.all(entering.map((a) => a.finished.catch(() => undefined))), new Promise((done) => setTimeout(done, 2000))]);
      })
      .catch(() => undefined);
    // A busy machine can stall a capture past 30 s: one more try, longer, before it counts as a failure.
    return shot(options).catch((e) => (/Timeout/.test(String(e)) ? shot({ ...options, timeout: 120000 }) : Promise.reject(e)));
  };
}

const out = path.resolve("e2e-output");
mkdirSync(out, { recursive: true });
const extension = path.resolve("dist");
// CHROMIUM_PATH wins. On a Mac, Playwright's "Chrome for Testing" (branded Chrome no longer loads
// --load-extension); elsewhere the sandbox's Chromium.
function macChromium() {
  const cache = path.join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))) {
    for (const arch of ["chrome-mac-arm64", "chrome-mac", "chrome-mac-x64"]) {
      const exe = path.join(cache, dir, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}
const executablePath =
  process.env.CHROMIUM_PATH ?? (process.platform === "darwin" ? macChromium() : null) ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
// The checks below read the Turkish texts: pin the browser to Turkish (an en-US Chromium would start the
// board in English, see browserLang in src/lib/i18n.ts).
const TURKISH = { locale: "tr-TR" };
const LANG_ARG = "--lang=tr-TR";
// No window on the owner's screen: Chromium's new headless mode (extensions load in it). E2E_HEADED=1 shows the browser.
// Mac scrollbars overlay the page (a classic one takes 15px the layout checks do not expect); a sandbox without a mouse reports (hover: none), which turns every hover tip into a tap tip: say a mouse is there.
// The layout checks were tuned on a Mac's system font; Inter (the sandbox's) is a little wider: a few px of slack there.
const FONT_SLACK = process.platform === "darwin" ? 0 : 20;
// v82: the old comparison window (CompareView: its board, table and weights) is C11's karar yardımı, not reached from the Plan or
// the Pano in this version (spec §1.1, row 199; bu sürümde arayüzden düştü). Its checks are kept behind this for its return.
const CMP_SHOWN = false;
// v82: the start card (C18) is not in this version (spec §1.1, row 200; bu sürümde arayüzden düştü).
const START_CARD_SHOWN = false;
const HEADLESS_ARGS = process.env.E2E_HEADED ? [] : ["--headless=new", "--hide-scrollbars", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"];

// The sample trip's dates are fixed (8–14 October 2026): the pages read the calendar as on 5 October, so the
// run doesn't change with the day it's run on (it broke on 6 October: a free cancellation "past"). Time flows on.
const frozen = (ctx) => ctx.clock.install({ time: new Date("2026-10-05T10:00:00") });
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [
    ...HEADLESS_ARGS,
    LANG_ARG,
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    // e.g. --ignore-certificate-errors-spki-list=<hash> to trust a sandbox proxy's own CA
    ...(process.env.E2E_CHROMIUM_ARGS?.split(" ").filter(Boolean) ?? []),
  ],
  // Behind a proxy (CI/sandbox), route the browser through it so real API calls can be checked.
  ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
});
// The offers' live data source answers nothing here: no test depends on live prices.
await context.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await context.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The hero's photo proxy answers "no photo" unless a test routes it: never the live server.
await context.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(context);

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  console.log("extension id:", id);

  // 0. First install opens the one-step setup.
  const setupTab = context.pages().find((p) => p.url().endsWith("app.html#settings")) ??
    (await context.waitForEvent("page", { predicate: (p) => p.url().endsWith("app.html#settings"), timeout: 10000 }));
  await setupTab.getByText("Google'dan ücretsiz anahtar al").waitFor();
  await setupTab.screenshot({ path: `${out}/0-setup.png` });
  // A pasted key is checked against Google right away (a fake one must be rejected with a clear message).
  await setupTab.getByPlaceholder("AIza… (yapıştır)").fill("AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY123");
  const verdict = await setupTab
    .getByText(/anahtarı geçersiz|bağlanılamadı|Gemini hatası/)
    .first()
    .textContent({ timeout: 20000 });
  if (process.env.E2E_EXPECT_LIVE) assert.match(verdict ?? "", /anahtarı geçersiz/);
  console.log("✓ setup: opens on install; pasted key checked live →", verdict?.trim());
  await setupTab.close();

  // 1. Page reader on a hotel-like page, scrolled to the room the user is looking at.
  const reader = (
    // Minified like the shipped popup bundle, so a minifier-introduced outer reference would fail here.
    await build({ entryPoints: ["src/lib/pagecapture.ts"], bundle: true, write: false, format: "iife", globalName: "PC", target: "es2022", minify: true })
  ).outputFiles[0].text;
  const page = await context.newPage();
  await page.goto(pathToFileURL(path.resolve("tests/fixtures/hotel.html")).href);
  await page.locator("#rooms").scrollIntoViewIfNeeded();
  // Run it the way chrome.scripting does: from its source text, without the bundle's scope.
  const source = await page.evaluate(`${reader}; PC.collectPage.toString()`);
  const snap = await page.evaluate(`(${source})()`);
  assert.equal(snap.meta["og:title"], "Jardim Stay, Porto");
  assert.match(snap.jsonLd[0], /"ratingValue":"8.9"/);
  assert.match(snap.pageText, /Free cancellation before 5 October 2026/);
  assert.doesNotMatch(snap.pageText, /Hidden promo/);
  assert.match(snap.viewportText, /Deluxe Double with Garden View/);
  assert.doesNotMatch(snap.viewportText, /Footer links/);
  console.log("✓ page reader: JSON-LD, meta, full text and viewport text captured");

  // 2. Board empty state. Newer Chrome returns a Promise from scrollIntoView; mimic it so an effect
  // that leaks that value as its "cleanup" crashes here too (it blanked the board in real Chrome).
  const app = await context.newPage();
  await app.addInitScript(() => {
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      scroll.apply(this, args);
      return Promise.resolve();
    };
  });
  await app.goto(`chrome-extension://${id}/app.html`);
  // (v82, row 163: the empty home's words follow the new start, a sentence or a link in the box)
  await app.getByText("İlk gezini başlat").waitFor();
  await app.screenshot({ path: `${out}/1-empty.png` });

  // 3. Queue a capture without an API key: the worker must pick it up and report a readable error.
  await app.evaluate(async (snapshot) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({
      ...snapshot,
      id: "e2e-capture",
      kind: "extension",
      screenshot: null,
      capturedAt: Date.now(),
      status: "pending",
      error: null,
      itemId: null,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
    await chrome.runtime.sendMessage({ type: "process" });
  }, snap);
  await app.getByText("API anahtarı yok", { exact: false }).first().waitFor({ timeout: 15000 });
  await app.screenshot({ path: `${out}/2-missing-key.png` });
  // No text is cut (DESIGN.md): at 560 px an error wraps instead of ending in "…".
  const uncut = (selector) =>
    app.evaluate((sel) => [...document.querySelectorAll(sel)].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent), selector);
  await app.setViewportSize({ width: 560, height: 900 });
  await app.screenshot({ path: `${out}/2c-missing-key-narrow.png` });
  assert.deepEqual(await uncut(".error-text"), [], "an error is read in full on a narrow board");
  await app.setViewportSize({ width: 1440, height: 900 });
  console.log("✓ capture queue: worker processed the capture and the board shows the missing-key error");

  // 4. Demo trip, a group expanded, and the detail drawer.
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // The hero (v82 aşama 1, docs/superpowers/specs/2026-10-18-v82-gecis/02-spec.md; A · Kapak 2026-10-19): the cover the full
  // width (the trip's name, its places and country, the days to go, the route), the tiles a row under it, the summary card
  // (when, who, the budget, ready, "Sıradaki"), and the quiet row of the facts, the style words and Tercihler.
  const hero = app.locator(".x-hero");
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  // v82: the Plan's categories, one open at a time (B8); a category's name in its closed row is the button that opens it.
  const sec = (id) => app.locator(`.q-sec[data-section="${id}"]`);
  const openSec = async (id) => {
    const s = sec(id);
    if (!(await s.evaluate((el) => el.classList.contains("open")))) await s.locator(".q-tt").click();
    await s.locator(".q-fold.settled").waitFor();
    return s;
  };
  // B9: the bar's sentence (its label, the tip), "Hazır %X" and "%Y alındı · n alınacak" say the same numbers: every need,
  // planned, booked, to decide. Read off the page and checked against each other (one screen once showed three different counts).
  const heroNumbersOnPage = async () => {
    const label = await app.locator(".x-hero .x-bar").getAttribute("aria-label");
    const m = label.match(/^Omurganın %(\d+)'\S* planda \((\d+) ihtiyaçtan (\d+)'\S*\), %(\d+)'\S* alındı \((\d+)\)\. (?:(\d+) karar bekliyor|Karar bekleyen yok)\.$/);
    assert.ok(m, `the bar says it in a sentence (${label})`);
    const [, planPct, total, planned, bookedPct, booked, open] = m;
    const words = flat([await app.locator(".x-hero .x-ps").innerText()])[0];
    const pct = flat([await app.locator(".x-hero .x-pct").innerText()])[0];
    return { label, words, pct, planPct: +planPct, total: +total, planned: +planned, bookedPct: +bookedPct, booked: +booked, open: +(open ?? 0), now: Number(await app.locator(".x-hero .x-bar").getAttribute("aria-valuenow")) };
  };
  const heroAgrees = async (where) => {
    const s = await heroNumbersOnPage();
    const said = JSON.stringify(s);
    assert.equal(s.planPct, Math.round((s.planned / s.total) * 100), `${where}: "%planda" is what's planned of every need (${said})`);
    assert.equal(s.bookedPct, Math.round((s.booked / s.total) * 100), `${where}: "%alındı" is what's booked of every need (${said})`);
    assert.equal(s.now, s.planPct, `${where}: the bar's value (${said})`);
    assert.equal(s.pct, `%${s.planPct}`, `${where}: "Hazır" is the planned share (${said})`);
    assert.equal(s.words, [`%${s.bookedPct} alındı`, s.planned > s.booked ? `${s.planned - s.booked} alınacak` : null].filter(Boolean).join(" · "), `${where}: the card's words (${said})`);
    assert.ok(s.booked <= s.planned && s.planned + s.open === s.total, `${where}: booked is some of planned; planned and to decide are every need (${said})`);
    return s;
  };
  assert.equal(await hero.locator(".x-big h1").innerText(), "Portekiz (örnek)");
  assert.equal(await hero.locator(".x-big .x-where").innerText(), "Porto · Lizbon, Portekiz");
  assert.equal(await hero.locator(".x-s1 b").innerText(), "8–14 Ekim");
  assert.equal(flat([await hero.locator(".x-s1 small").innerText()])[0], "7 gün");
  // A · Kapak: the days to go big on the photo; the route from home through each place (its nights, its stay's dot: Lizbon's
  // booked, Porto's not yet) and home again, a plane at the ends and the train between.
  assert.equal(flat([await hero.locator(".x-big .x-count").innerText()])[0], "3 gün kaldı");
  assert.deepEqual(
    await hero.locator(".x-route").evaluate((el) => [
      [...el.querySelectorAll(".x-rp")].map((p) => [p.lastChild.nodeValue, p.querySelector(".x-dot")?.className ?? null]),
      [...el.querySelectorAll(".x-way")].map((w) => (w.querySelector("svg") ? w.querySelector(".sr-only").textContent.trim() : "→")),
    ]),
    [
      [["İstanbul", null], ["Porto 3 gece", "x-dot plan"], ["Lizbon 3 gece", "x-dot ok"], ["İstanbul", null]],
      ["Uçak", "Tren", "Uçak"],
    ],
  );
  // With no photo to be had (offline) the cover stands alone, plain, and no "i" says a credit there isn't (C19, C7).
  if (process.env.E2E_OFFLINE) {
    assert.equal(await hero.locator(".x-mos.solo .x-big.empty").count(), 1, "no photo: the cover alone");
    assert.equal(await hero.locator(".x-tiles, .x-cr").count(), 0, "no tile and no credit without a photo");
  }
  // The ⋯ menu on the cover's top left (C1).
  assert.equal(await hero.locator(".x-mos > .x-tmenu .x-tmb").count(), 1);
  // The backbone's two shares: the sample's 9 needs, 3 on the plan (2 booked and the boat tour), 6 to decide. F7 (S2): the
  // flight and the Porto stay stand as "Önerimiz" and are among the 6: our pick isn't on the plan until it's taken (B9).
  // v82: the flight a ticket box (3b), the stay an intent box, each standing as "Önerimiz" (data-st="ai").
  await openSec("flight");
  assert.equal(await sec("flight").locator('.q-ints > .q-int[data-st="ai"] .z-tk').count(), 1, "the flight's draft on the sample's Plan");
  await openSec("stay");
  assert.equal(await sec("stay").locator('.q-int[data-st="ai"]').count(), 1, "the Porto stay's draft on the sample's Plan");
  // The ideas (Yapılacak şeyler, Restoranlar, İlham) have no "3/4" and are never needs (0.35.3); a category's closed row
  // says its needs' "settled/all" for a screen reader (.q-count).
  await app.locator(".q-sec .q-count").first().waitFor({ state: "attached" });
  assert.equal(await app.locator('.q-sec[data-section="todo"] .q-count, .q-sec[data-section="food"] .q-count').count(), 0, "an idea section has no x/y");
  const atStart = await heroAgrees("the sample");
  console.log(`  hero: ${atStart.words} · ${atStart.label}`);
  assert.deepEqual([atStart.total, atStart.planned, atStart.booked, atStart.open], [9, 3, 2, 6], JSON.stringify(atStart));
  // The bar: from the left booked (green) then planned (amber, A · Kapak), each as wide as its share.
  const fills = await hero.locator(".x-bar").evaluate((el) => [...el.children].map((i) => ({ cls: i.className, width: Math.round(parseFloat(i.style.width)), paint: getComputedStyle(i).backgroundColor })));
  assert.deepEqual(fills.map((f) => [f.cls, f.width]), [["bk", atStart.bookedPct], ["ch", atStart.planPct - atStart.bookedPct]], JSON.stringify(fills));
  assert.notEqual(fills[0].paint, fills[1].paint, "two tones");
  // F4: a visa to get comes before everything (a Turkish passport for Portugal: Schengen); C25: its chip is amber.
  assert.equal(flat([await hero.locator(".x-next").innerText()])[0], "Sıradaki Vize randevusu");
  // Who goes: two adults read from the saves (no names: two plain faces, the count big, "kişi" under it; the sample isn't
  // shared, so no invite).
  assert.equal(await hero.locator(".x-s2 .x-face").count(), 2);
  assert.equal(await hero.locator(".x-whob").innerText(), "2");
  assert.equal(await hero.locator(".x-s2 .x-sl").innerText(), "kişi");
  // The style (C23, at the start of Tercihler's row): no model key here, so only the budget's word (€1.500 for 2 people, 7 days ≈ €107 a day each).
  assert.deepEqual(await hero.locator(".x-styles .x-style").allInnerTexts(), ["Orta bütçe"]);
  // The facts: the money, the plug (its socket drawn), the time, the language (its flag) and the visa (the weather too where the
  // network has it); the one country is on the photo.
  assert.deepEqual(flat(await hero.locator(".x-chips .x-chip:not(.c-weather):not(.c-docs)").allInnerTexts()), ["Euro", "C/F priz", "−2 sa", "🇵🇹 Portekizce", "Schengen vizesi gerekiyor"]);
  assert.equal(await hero.locator(".x-chip.c-plug svg.x-plug").count(), 1, "the plug's own socket");
  assert.equal(await hero.locator(".x-chip.c-visa.warn").count(), 1, "the visa to get is amber");
  // B15: beside it, in the same amber, the bookings in their last two weeks still without their file (the Lizbon stay and
  // the way home); a tap goes to the first.
  assert.equal(flat([await hero.locator(".x-chips button.x-chip.c-docs.warn").innerText()])[0], "2 belge yok");
  // (the rate is a tip over the money, drawn on hover, not a native title)
  await hero.locator(".x-chip.c-money").hover();
  assert.match(await app.locator(".tipx-box").innerText(), /^€1 = ₺/);
  await app.mouse.move(2, 2);
  await hero.locator(".x-prefb", { hasText: "Tercihler" }).waitFor();
  // Revizyon 1: Tercihler rows are keywords, never sentences. The sample's note "Sessiz bir yer istiyoruz" goes by
  // its topic; a long note the code can't name (no model key here) by its first three words.
  const putNote = (text) =>
    app.evaluate(async (t) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
      const tripId = trips.find((x) => x.title === "Portekiz (örnek)").id;
      const tx = database.transaction("preferences", "readwrite");
      if (t) tx.objectStore("preferences").put({ id: "e2e-long-note", tripId, text: t, createdAt: Date.now() });
      else tx.objectStore("preferences").delete("e2e-long-note");
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, text);
  await putNote("Odada mutlaka bir çalışma masası olsun çünkü ikimiz de gezinin birkaç gününde uzaktan çalışacağız ve iyi internet şart");
  // 0.35.4: a few tags, one topic each, never wider than the hero; the level on hover, the details in the window.
  const prefTags = hero.locator(".x-prefb .x-ptag");
  await prefTags.filter({ hasText: "Odada mutlaka bir…" }).waitFor();
  assert.deepEqual(flat(await prefTags.allInnerTexts()).sort(), ["Odada mutlaka bir…", "Sessizlik"]);
  assert.equal(await prefTags.filter({ hasText: "Sessizlik" }).getAttribute("title"), "Sessizlik · Önemli");
  const heroRect = await hero.boundingBox();
  for (const b of await prefTags.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) assert.ok(b <= heroRect.x + heroRect.width, "a tag stays inside the hero");
  await hero.locator(".x-prefb").click();
  await hero.locator(".x-pref-pop li", { hasText: "uzaktan çalışacağız ve iyi internet şart" }).waitFor(); // the full text stays in the window
  await app.mouse.click(5, 5);
  await hero.locator(".x-pref-pop").waitFor({ state: "detached" });
  await hero.scrollIntoViewIfNeeded();
  await app.waitForTimeout(1500); // the city photos come from Wikipedia
  await app.mouse.move(0, 0); // no hover left on a chip from the clicks before
  // One box (v82 hizalama): no two parts of the strip overlap, every part stays inside the hero, and no line in it is cut
  // (a word may end in "…" only in the shares' line, which says it in full in its tip).
  const heroLayout = () =>
    app.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const root = document.querySelector(".x-hero");
      const h = box(root);
      const problems = [];
      for (const e of root.querySelectorAll(".x-mos, .x-strip, .x-chips, .x-prow, .x-seg, .x-next, .x-chip, .x-style, .x-prefb, .x-fold")) {
        const r = box(e);
        if (r.width > 0 && (r.left < h.left - 1 || r.right > h.right + 1)) problems.push(`outside: ${e.className} ${Math.round(r.left)}–${Math.round(r.right)}`);
      }
      const segs = [...root.querySelectorAll(".x-strip > .x-seg, .x-strip > .x-next")].map(box);
      for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++) {
          const [a, b] = [segs[i], segs[j]];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) problems.push(`overlap ${i}/${j}`);
        }
      for (const e of root.querySelectorAll(".x-sv b, .x-sv small, .x-nl, .x-chip, .x-style, .x-big h1")) if (e.scrollWidth > e.clientWidth + 1) problems.push(`cut: ${e.textContent}`);
      return { problems, rows: new Set(segs.map((s) => Math.round(s.top))).size };
    });
  const at1440 = await heroLayout();
  assert.deepEqual(at1440.problems, [], `1440: the hero's parts fit (${JSON.stringify(at1440)})`);
  // The style words (hero fix 2, now at the start of Tercihler's row): the two longest styles and the budget's word in one
  // line and none cut. Measured on a copy of the row with the longest Turkish and English words.
  const styleRow = (labels) =>
    app.evaluate((ls) => {
      const row = document.querySelector(".x-hero .x-styles");
      const copy = row.cloneNode(true);
      const template = row.querySelector(".x-style");
      copy.replaceChildren(
        ...ls.map((l) => {
          const chip = template.cloneNode(true);
          chip.lastChild.nodeValue = l;
          return chip;
        }),
      );
      row.after(copy);
      const chips = [...copy.children].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), right: c.getBoundingClientRect().right, cut: c.scrollWidth > c.clientWidth + 1, h: Math.round(c.getBoundingClientRect().height), font: getComputedStyle(c).fontSize }));
      copy.remove();
      return { chips, right: document.querySelector(".x-hero").getBoundingClientRect().right };
    }, labels);
  const checkStyles = async (where) => {
    for (const labels of [["Gastronomi", "Romantik", "Yüksek bütçe"], ["Eğlence", "Gastronomi", "Orta bütçe"], ["Nightlife", "Adventure", "High budget"], ["Adventure", "Romantic", "Mid-range"]]) {
      const r = await styleRow(labels);
      const at = `${where} ${labels.join(" + ")}`;
      assert.equal(new Set(r.chips.map((c) => c.top)).size, 1, `${at}: the styles on one line (${JSON.stringify(r)})`);
      assert.ok(r.chips.every((c) => !c.cut && c.right <= r.right + 1), `${at}: no chip cut or out of the hero`);
      // (13,5 px: the plan's 9-step scale, row 155)
      assert.ok(r.chips.every((c) => c.font === "13.5px" && c.h === 30), `${at}: 13,5 px words, 30 px chips`);
    }
  };
  await checkStyles("1440");
  await app.screenshot({ path: `${out}/2b-hero.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await hero.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/2d-hero-narrow.png` });
  const heroLines = [".x-sv b", ".x-sv small", ".x-nl", ".x-chip", ".x-style", ".x-big h1", ".x-big .x-where", ".x-pct", ".x-sl"].map((sel) => `.x-hero ${sel}`).concat(".card-alert").join(", ");
  assert.deepEqual(await uncut(heroLines), [], "the hero's lines and a card's warning wrap, never cut");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow hero");
  // Nothing runs out of the hero: the chips with the longest real names (the UAE's money, Switzerland's languages) go to a row of their own.
  const spilled = () =>
    app.evaluate(() => {
      const chips = [...document.querySelectorAll(".x-hero .x-chips .x-chip")];
      const money = chips.find((c) => c.classList.contains("c-money"));
      const lang = chips.find((c) => c.classList.contains("c-lang"));
      const before = [money.lastChild.nodeValue, lang.lastChild.nodeValue];
      money.lastChild.nodeValue = "Birleşik Arap Emirlikleri Dirhemi";
      lang.lastChild.nodeValue = "Almanca, Fransızca, İtalyanca";
      const h = document.querySelector(".x-hero").getBoundingClientRect();
      const out = chips.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.left < h.left - 1 || r.right > h.right + 1 || c.scrollWidth > c.clientWidth + 1;
      }).map((c) => c.textContent);
      [money.lastChild.nodeValue, lang.lastChild.nodeValue] = before;
      return out;
    });
  assert.deepEqual(await spilled(), [], "narrow: every chip stays inside the hero");
  assert.deepEqual((await heroLayout()).problems, [], "560 px: the hero's parts fit");
  await app.setViewportSize({ width: 1280, height: 800 });
  await hero.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/2h-hero-1280.png` });
  assert.deepEqual(await spilled(), [], "1280 px: every chip stays inside the hero");
  await checkStyles("1280");
  // The summary card (A · Kapak): one row on a board over 900 px; beside the chat at 1280 two by two with "Sıradaki" the full
  // width under them. "Hazır"'s bar is under its share, its words under the bar.
  const peopleRow = () =>
    app.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      const [s1, s2, s3, s4, next, strip, bar, pct, ps] = [r(".x-s1"), r(".x-s2"), r(".x-s3"), r(".x-s4"), r(".x-next"), r(".x-strip"), r(".x-prog"), r(".x-pct"), r(".x-ps")];
      const mid = (b) => b.top + b.height / 2;
      return {
        oneRow: [s1, s2, s3, s4, next].every((b) => Math.abs(mid(b) - mid(strip)) < 4),
        twoByTwo: Math.abs(s1.top - s2.top) < 2 && Math.abs(s3.top - s4.top) < 2 && s3.top >= s1.bottom - 1 && s2.left >= s1.right - 1,
        barUnder: bar.top >= pct.bottom - 1 && ps.top >= bar.bottom - 1,
        nextUnder: next.top >= s3.bottom - 1,
        nextWhole: next.width >= strip.width - 40,
      };
    });
  const row1280 = await peopleRow();
  assert.ok(row1280.twoByTwo && row1280.barUnder && row1280.nextUnder && row1280.nextWhole, `1280: ${JSON.stringify(row1280)}`);
  assert.deepEqual((await heroLayout()).problems, [], "1280 px: the hero's parts fit");
  await app.locator(".x-hero").screenshot({ path: `${out}/28a-hero-planned.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  const row1440 = await peopleRow();
  assert.ok(row1440.oneRow && row1440.barUnder, `1440: ${JSON.stringify(row1440)}`);
  assert.deepEqual(await spilled(), [], "1440 px: every chip stays inside the hero");
  await putNote(null);
  await prefTags.filter({ hasText: "Odada mutlaka bir…" }).waitFor({ state: "detached" });
  await app.getByText("Jardim Stay").first().waitFor();
  // 0.34: the Plan by category — a section per kind in this order (the empty ones are chips at the bottom),
  // each a timeline of its blocks: the day on the left, the cards on the right.
  assert.equal(await app.locator(".day-strip").count(), 0, "no band of nights");
  // v82 (aşama 7): Hazırlık on every trip, no chore saved: its list works out the chores from the trip (the booked flight's
  // check-in, the Schengen visa), and its closed row says what the list does ("Gezi öncesi 2 iş · sıradaki: …", "0/2 hazır").
  assert.deepEqual(await app.locator(".q-sec").evaluateAll((els) => els.map((e) => e.getAttribute("data-section"))), ["flight", "stay", "transport", "activity", "todo", "other", "prep"]);
  {
    const prepLine = flat([await sec("prep").locator(".q-kw").innerText()])[0];
    // (its day went by, 5 October against 23 September: the closed row says so, as the row does)
    const said = prepLine.match(/^Gezi öncesi (\d+) iş · sıradaki: Schengen vizesine başvur, 23 Eyl'e kadar · geçti$/);
    assert.ok(said, `Hazırlık's line (${prepLine})`);
    assert.equal(flat([await sec("prep").locator(".q-pl1").innerText()])[0], `0/${said[1]} hazır`);
  }
  // v82: the Plan's head is "Plan", "Gezinin omurgası · n karar bekliyor" and the three ways to read it. The trip's shape
  // under the head, its cities' tips and the stages' key are no longer drawn (B6: bu sürümde arayüzden düştü).
  assert.equal(await app.locator(".q-planbar h2").innerText(), "Plan");
  assert.match(flat([await app.locator(".q-pbt small").innerText()])[0], /^Gezinin omurgası · \d+ karar bekliyor$/);
  assert.deepEqual(await app.locator(".q-planbar .plan-order button").allInnerTexts(), ["Kategoriye göre", "Yolculuk sırasıyla", "Gün gün"]);
  assert.equal(await app.locator(".ts-strip, .plan-key").count(), 0, "no trip shape, no key of the colours (B6)");
  // v82 (B6): no chips for empty kinds; one "+ Yeni ihtiyaç ekle" at the plan's end adds any kind.
  assert.equal(await app.locator(".cat-more .cat-chip").count(), 0);
  assert.equal(await app.locator(".q-addall").innerText(), "+ Yeni ihtiyaç ekle");
  // v82: the stays one box each, on the rail in the order of their nights, the head's line saying them; no date column.
  await openSec("stay");
  assert.deepEqual(flat(await sec("stay").locator(".q-ints > .q-int .q-ln").allInnerTexts()).map((t) => t.match(/\d+–\d+ Ekim/)?.[0]), ["8–11 Ekim", "11–14 Ekim"]);
  assert.equal(await app.locator(".cat-plan .cat-date, .cat-plan .cat-dot").count(), 0, "no date column");
  // The page itself never scrolls past the window (Emre 2026-10-09: the chat and all went up, blank under it): what's
  // placed absolutely inside the panel stays inside it; only the panel scrolls.
  assert.ok(await app.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1), "the page doesn't scroll, the panel does");
  // v11 as drawn: each section its own white card; its head: the icon on its tint, the name and how many ("Uçuş 2"),
  // under it the stage words, on the right the bar (green booked, amber chosen), what's spent and its share of the budget.
  assert.equal(await sec("activity").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
  assert.equal(await sec("activity").evaluate((el) => getComputedStyle(el).borderTopLeftRadius), "18px");
  assert.equal(await app.locator(".cat-tile, .cat-state").count(), 0, "no icon tiles, no status pills");
  // v82: the closed row (78 px): the name and its one line, the bar and where its needs stand, what's spent of its share.
  assert.match(await sec("activity").locator(".q-row1").innerText(), /^Etkinlik ve turlar\s*1 şehir için · 4 fikir\s*(\d+\/\d+\s*)?1 planda\s*€25\s*€[\d.,]+ ayrıldı/);
  assert.equal(Math.round(await sec("activity").locator(".q-row1").evaluate((el) => el.getBoundingClientRect().height)), 78, "the closed row is 78 px");
  assert.match(await sec("stay").locator(".q-allot").innerText(), /^€[\d.,]+ ayrıldı$/);
  // The layered interface (drawing: ux-katmanli-arayuz): the header's money box on hover, nothing hidden meanwhile; the
  // hero's tips; a thin bar over the panel once the hero has scrolled away.
  await sec("stay").locator(".q-bud").hover();
  const budTip = app.locator(".tipx-box");
  await budTip.waitFor({ state: "visible" });
  assert.match(await budTip.innerText(), /Bu bölümün parası[\s\S]*Ayrılan pay/);
  await app.waitForTimeout(350);
  await app.screenshot({ path: `${out}/36a-tip-section-money.png` });
  await app.mouse.move(2, 2);
  await budTip.waitFor({ state: "detached" });
  assert.match(await sec("stay").locator(".q-allot").innerText(), /^€[\d.,]+ ayrıldı$/, "the share is still there, tip or not");
  const heroTips = app.locator(".x-hero .x-chips .x-chip[tabindex]");
  if (await heroTips.count()) {
    await heroTips.first().hover();
    await app.locator(".tipx-box").waitFor({ state: "visible" });
    await app.waitForTimeout(350);
    await app.screenshot({ path: `${out}/36b-tip-hero.png` });
    await app.mouse.move(2, 2);
    await app.locator(".tipx-box").waitFor({ state: "detached" });
  } else console.log("  (no hero tips on this trip: no rate or plug known)");
  assert.equal(await app.locator(".h-mini.on").count(), 0, "the thin bar waits while the hero is in view");
  await app.locator(".panel").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await app.locator(".h-mini.on").waitFor({ timeout: 4000 });
  await app.waitForTimeout(350);
  await app.screenshot({ path: `${out}/36c-sticky-bar.png` });
  assert.ok((await app.locator(".h-mini.on .h-mt").innerText()).length > 0, "the bar names the trip");
  // C24: the hero's own numbers, the Plan | Pano switch and "Sıradaki".
  assert.equal(flat([await app.locator(".h-mini.on .h-mp").innerText()])[0], `%${atStart.planPct} planda · ${atStart.open} karar`);
  assert.equal(await app.locator(".h-mini.on .h-tabs button").count(), 2);
  assert.equal(flat([await app.locator(".h-mini.on .h-next").innerText()])[0], "Sıradaki vize randevusu");
  await app.locator(".panel").evaluate((el) => (el.scrollTop = 0));
  await app.locator(".h-mini.on").waitFor({ state: "detached", timeout: 4000 });
  console.log("✓ layered interface: the section's money box on hover, the hero's tips, the thin bar while the hero is scrolled away");
  // Round 2 (F5): the backbone's shares say which on hover, in a whole sentence, and the strip doesn't move. (The hero's four
  // counters are gone with v82: each category's closed row says its own.)
  {
    const prog = app.locator(".x-hero .x-prog");
    const before = await app.locator(".x-hero .x-strip").boundingBox();
    await prog.hover();
    const tip = app.locator(".tipx-box");
    await tip.waitFor({ state: "visible" });
    assert.match(await tip.innerText(), /^Omurganın %\d+'\S* planda \(\d+ ihtiyaçtan \d+'\S*\), %\d+'\S* alındı \(\d+\)\. \d+ karar bekliyor\.$/, "the bar's tip says it in a whole sentence");
    await app.waitForTimeout(350);
    await app.screenshot({ path: `${out}/37a-tip-hero-tally.png` });
    await app.mouse.move(2, 2);
    await tip.waitFor({ state: "detached" });
    assert.deepEqual(await app.locator(".x-hero .x-strip").boundingBox(), before, "the strip looks the same");
  }
  // v82: where a category's needs stand is in its closed row, in the new words ("1 alındı · 1 karar"), the bar in two greens.
  assert.equal(flat([await sec("activity").locator(".q-pl1").innerText()])[0], "1 planda");
  // F7: the flight with a real priced option saved is "Önerimiz", a decision still to make, no longer "aranıyor"; the bar doesn't move.
  assert.match(await sec("flight").locator(".q-row1").innerText(), /^Uçuş\s*2 uçuş · gidiş ve dönüş · 3 fikir/);
  assert.equal(flat([await sec("flight").locator(".q-pl1").innerText()])[0], "1 alındı · 1 karar");
  assert.equal(await app.locator(".cat-wait").count(), 0, "no amber line: the row says it");
  assert.equal(await sec("flight").locator(".q-bar > .bk").evaluate((el) => el.style.width), "50%");
  assert.equal(await sec("flight").locator(".q-row1 .q-add").count(), 0, "\"+ Uçuş ekle\" is at the category's end, not in its row");
  // No page-bottom lists: what's out of the way waits at the end of its own category.
  assert.equal(await app.locator(".row-name", { hasText: /Kapanan seçenekler|Elenenler|Gizlenenler/ }).count(), 0, "no page-bottom hidden blocks");
  // v82 (F3, C17): "Gizlenenler · n" at the end of its category's rail; Alfama Suites, which the Lisboa Loft booking closed, a row in it.
  await openSec("stay");
  await sec("stay").locator('.q-ints > .q-int[data-st="ok"]', { hasText: "Lisboa Loft" }).waitFor();
  assert.equal(await sec("stay").locator(".q-hid > summary").innerText(), "Gizlenenler · 1");
  await sec("stay").locator(".q-hid > summary").click();
  assert.match(await sec("stay").locator(".q-hid .cat-hidden-row.closed").innerText(), /Alfama Suites[\s\S]*Lisboa Loft rezervasyonu bu geceleri kapsıyor/);
  await sec("stay").locator(".q-hid > summary").click();
  assert.equal(await sec("stay").locator(".q-ints > .q-int", { hasText: "Alfama Suites" }).count(), 0, "a booking closes its alternatives");
  // A box for each thing: the flights in and home, the stays, the train, the eSIM, the policy still to find (C16).
  const kinds = [];
  for (const id of ["flight", "stay", "transport", "other"]) {
    await openSec(id);
    kinds.push(...(await sec(id).evaluate((el) => [...el.querySelectorAll(".cat-card, .q-ints > .q-int")].map((e) => `${el.dataset.section}:${e.classList.contains("q-int") ? e.dataset.kind : ([...e.classList].find((c) => c.startsWith("tl-")) ?? "item")}`))));
  }
  assert.deepEqual(kinds, ["flight:flight", "flight:flight", "stay:stay", "stay:stay", "transport:train", "other:esim", "other:insurance"]);
  await openSec("activity");
  // v82 aşama 4 (izlenebilirlik 119): Etkinlik ve turlar city by city, each city one box with two rows of cards of one size:
  // what's on the plan in "Planında" (the boat tour), the ideas in "Öneriler" with "+ Plana koy".
  const cardNames = (loc) => loc.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const portoAct = sec("activity").locator('.q-int.multi[data-intent="activity:Porto"]');
  assert.deepEqual(await cardNames(portoAct.locator('[data-row="plan"] > .z-k[data-item-id]')), ["Douro tekne turu"]);
  assert.deepEqual(await cardNames(portoAct.locator('[data-row="ideas"] > .z-k[data-item-id]')), ["Livraria Lello", "Serralves Müzesi", "Tiyatro"]);
  assert.deepEqual(flat(await portoAct.locator('[data-row="ideas"] .q-pick').allInnerTexts()), ["+ Plana koy", "+ Plana koy", "+ Plana koy"]);
  // Its head counts them (the city, its days, "1 planda"); Öneriler says how many; Lizbon has none yet and asks the chat.
  assert.match(await portoAct.locator(".z-h").innerText(), /Porto\s+8–11 Ekim[\s\S]*1 planda/);
  assert.equal((await portoAct.locator(".q-opts .q-oc").innerText()).trim(), "3");
  assert.equal(await portoAct.locator(".q-planw .q-ot").innerText(), "Planında", "H1: what's on the plan says so in words");
  assert.equal(await sec("activity").locator('.q-gapl[data-city="Lizbon"] .z-ask', { hasText: "AI'a arat" }).count(), 1, "an empty city: AI'a arat");
  // Every card is one height in every state (0.38.8, option A: the picture 4:3 on top, its height follows the width; it was
  // 224 px), four cells a row (the plan's three unseen ones hold their places).
  assert.equal(new Set(await portoAct.locator(".z-k").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)))).size, 1, "every card of the box is one height");
  for (const [w, h] of await portoAct.locator(".z-k[data-item-id] .z-kp").evaluateAll((els) => els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]))) {
    assert.ok(Math.abs(h - (w * 3) / 4) <= 1, `the picture is 4:3 (${w}×${h})`);
  }
  assert.equal(await portoAct.locator('[data-row="plan"] > *').count(), 4);
  // C26: the ideas fold away (remembered in this browser), and come back.
  await portoAct.locator(".z-fold").click();
  assert.equal(await portoAct.locator('[data-row="ideas"] .z-k').count(), 0, "folded away");
  await portoAct.locator(".z-fold").click();
  await portoAct.locator('[data-row="ideas"] .z-k').first().waitFor();
  assert.equal(await portoAct.locator('[data-row="plan"] .z-k[data-item-id] .z-kp img').count(), 1, "a card has its picture");
  // v82 (izlenebilirlik 120): a bought ticket keeps the card's size: the green band, its day and hour and its meeting place
  // (to the map), its code to copy, "Bileti aç" opening its file; ⓘ opens Ayrıntı over the card, where files are added too.
  // (Tiyatro for a moment, put back as it was after.)
  const tiyatroId = await portoAct.locator('.z-k[aria-label="Tiyatro"]').getAttribute("data-item-id");
  const writeItem = (change) =>
    app.evaluate(async ({ id, change }) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction(["items", "docs"], "readwrite");
      const item = await new Promise((resolve) => (tx.objectStore("items").get(id).onsuccess = (e) => resolve(e.target.result)));
      if (change === "book") {
        window.__tiyatro = item;
        tx.objectStore("items").put({ ...item, status: "booked", bookingRef: "KL-90231", location: { address: "Teatro Nacional São João", area: null, approximate: false }, dates: { start: "2026-10-10", end: null, source: "page" }, flight: { from: null, to: null, departure: "2026-10-10T21:00", arrival: null, carrier: null, flightNumber: null, stops: null } });
      } else {
        tx.objectStore("items").put(window.__tiyatro);
        const docs = await new Promise((resolve) => (tx.objectStore("docs").getAll().onsuccess = (e) => resolve(e.target.result)));
        for (const d of docs) if (d.itemId === id) tx.objectStore("docs").delete(d.id);
      }
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, { id: tiyatroId, change });
  await writeItem("book");
  const bought = portoAct.locator('[data-row="plan"] .z-k.done[aria-label="Tiyatro"]');
  await bought.waitFor();
  // (its 2 px edge included: the height is the row's, as a ticket not bought yet)
  assert.equal(Math.round((await bought.boundingBox()).height), Math.round((await portoAct.locator('[data-row="plan"] .z-k[aria-label="Douro tekne turu"]').boundingBox()).height), "a bought ticket doesn't grow");
  assert.match(await bought.locator(".q-vband").innerText(), /Bilet alındı/);
  assert.match(flat([await bought.locator(".q-acc").innerText()])[0], /^10 Eki 21:00 Teatro Nacional São João$/);
  assert.match(await bought.locator(".q-acc a.q-aw").getAttribute("href"), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.equal(await bought.locator(".q-code > span").first().innerText(), "KL-90231");
  await bought.locator(".q-code .q-cp").click();
  await bought.locator('.q-code .q-cp:is([aria-label="Kopyalandı"], [aria-label^="Seçildi"])').waitFor();
  await bought.locator("input.pk-file").first().setInputFiles({ name: "tiyatro.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });
  const ticketOpen = bought.locator('.q-open[title^="tiyatro.pdf"]', { hasText: "Bileti aç" });
  await ticketOpen.waitFor();
  const [ticketTab] = await Promise.all([context.waitForEvent("page"), ticketOpen.click()]);
  assert.match(ticketTab.url(), /^blob:chrome-extension:\/\//);
  await ticketTab.close();
  await bought.getByRole("button", { name: "Tiyatro: ayrıntı" }).click();
  const boughtDetail = bought.getByRole("dialog", { name: "Tiyatro: ayrıntı" });
  await boughtDetail.waitFor();
  assert.match(await boughtDetail.innerText(), /KL-90231[\s\S]*Teatro Nacional São João[\s\S]*tiyatro\.pdf[\s\S]*Belge ekle/);
  await app.keyboard.press("Escape");
  await boughtDetail.waitFor({ state: "detached" });
  await writeItem("back");
  await portoAct.locator('[data-row="ideas"] .z-k[aria-label="Tiyatro"]').waitFor();
  // The restaurant is a card of Yapılacaklar' ideas (0.35.3); nothing on its plan yet: no empty slots, one line in Planında's
  // head, "Henüz plana koymadın · önerilerden + Plana koy" (0.38.2).
  await openSec("todo");
  assert.deepEqual(await cardNames(sec("todo").locator(".z-k[data-item-id]")), ["Majestic Café"]);
  assert.equal(await sec("todo").locator('[data-row="plan"] > .z-k0').count(), 0);
  assert.match(await sec("todo").locator(".q-planw .q-oh .z-pe").first().innerText(), /Henüz plana koymadın · önerilerden “\+ Plana koy”/);
  // No days, no check-in lines, no transfers without a plan.
  assert.equal(await app.locator(".cat-plan .tl-day, .cat-plan .leg, .cat-plan .pk-leg").count(), 0);
  // Gün gün, the Plan's third view (plan v30): ONE COMPACT ROW A DAY: the date box, the day's lines (icon, NE · HANGİSİ,
  // the grey word, a time, the stage on the right), "Gece: şehir · konaklama", or "Serbest gün" for a day with nothing.
  const tab = (name) => app.getByRole("tab", { name, exact: true });
  await tab("Gün gün").click();
  // A day is a row, found by the "Gün N" in its date box.
  const dayCard = (n) => app.locator(".dg-day", { has: app.locator(".dg-no", { hasText: new RegExp(`^Gün ${n}$`) }) });
  const lineOf = (n, title, nth = 0) => dayCard(n).locator(`.dg-tl > li[data-title="${title}"]`).nth(nth);
  const dayTitlesOf = (n) => dayCard(n).locator(".dg-tl > [data-title]").evaluateAll((els) => els.map((e) => e.getAttribute("data-title")));
  const dayTimesOf = (n) => dayCard(n).locator(".dg-tl > li").evaluateAll((els) => els.map((e) => e.querySelector(".t")?.textContent ?? ""));
  // The seven days of the trip, each its own row (the two free days in Lisbon too), in order, each with its date box.
  assert.deepEqual(await app.locator(".dg-day .dg-no").allInnerTexts(), ["Gün 1", "Gün 2", "Gün 3", "Gün 4", "Gün 5", "Gün 6", "Gün 7"]);
  assert.deepEqual(flat(await app.locator(".dg-day .dg-date").allInnerTexts()), ["Eki 8 Per Gün 1", "Eki 9 Cum Gün 2", "Eki 10 Cmt Gün 3", "Eki 11 Paz Gün 4", "Eki 12 Pzt Gün 5", "Eki 13 Sal Gün 6", "Eki 14 Çar Gün 7"]);
  assert.equal(await app.locator(".dg-day").count(), 7);
  // One row a day: a row is its date box and a card, no photo, no strip of days, no Liste | Kartlar switch.
  assert.equal(await app.locator(".dg-day img, .dc-strip, .dc-seg, .dc-cday").count(), 0, "no photo cards, no strip, no switch");
  // The night's line: the city and the stay ("konaklama aranıyor" while none is chosen); the last day, home.
  assert.equal(flat(await dayCard(1).locator(".dg-n").allInnerTexts())[0], "Gece: Porto · konaklama aranıyor");
  assert.equal(flat(await dayCard(4).locator(".dg-n").allInnerTexts())[0], "Gece: Lizbon · Lisboa Loft");
  assert.equal(flat(await dayCard(7).locator(".dg-n").allInnerTexts())[0], "Eve dönüş");
  // A free day says so, every one of them its own row (no merged "5–6. gün").
  assert.deepEqual(flat(await app.locator(".dg-free").allInnerTexts()), ["Serbest gün · yapılacaklardan seç", "Serbest gün · yapılacaklardan seç", "Serbest gün · yapılacaklardan seç"]);
  assert.match(await dayCard(5).innerText(), /Gece: Lizbon/);
  // The day's lines in the standard (NE · HANGİSİ, never a code), each with its icon; a stage on the plans (Arıyoruz · Seçildi · Rezerve), none on a check-in.
  assert.deepEqual(await dayTitlesOf(4), ["Check-out · Porto konaklaması", "Transfer", "Tren · Porto → Lizbon", "Transfer", "Check-in · Lisboa Loft"]);
  assert.equal(await dayCard(4).locator(".dg-tl > li .dg-ic svg").count(), 5, "every line has its icon");
  assert.deepEqual(
    await dayCard(4).locator(".dg-tl > li").evaluateAll((els) => els.map((e) => e.querySelector(".dg-lab")?.textContent ?? "")),
    ["", "Arıyoruz", "Arıyoruz", "Arıyoruz", ""],
  );
  assert.equal(await lineOf(2, "Tekne turu · Douro").locator(".dg-lab").innerText(), "Seçildi");
  assert.equal(await lineOf(7, "Uçuş · Lizbon → İstanbul").locator(".dg-lab").innerText(), "Bilet alındı");
  // The grey word is short (0.36.27): the route the title says and a worked-out time's reason aren't repeated; two pieces at most.
  assert.deepEqual(
    await dayCard(4).locator(".dg-tl > li").evaluateAll((els) => els.map((e) => e.querySelector(".dg-sub")?.textContent ?? "")),
    ["yer seçilmedi", "planlanmadı", "varış 16:04 · 1 seçenek", "planlanmadı", "3 gece"],
  );
  // 0.36.13: a worked-out time says where it comes from, on the time (hover).
  // The train in without its arrival time: no hotel hour while still on the train, "varıştan sonra"; the
  // line asks for it, and from the time typed the check-in is worked out again.
  const setTrainArrival = (arrival) =>
    app.evaluate(async (arrival) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
      const items = await new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
      const train = items.find((i) => i.flight?.from === "Porto Campanhã");
      train.flight.arrival = arrival;
      await new Promise((resolve) => (database.transaction("items", "readwrite").objectStore("items").put(train).onsuccess = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, arrival);
  await setTrainArrival(null);
  const loftIn = lineOf(4, "Check-in · Lisboa Loft");
  await loftIn.locator(".t .t-hint", { hasText: "varıştan sonra" }).waitFor();
  assert.match(await loftIn.locator(".t").getAttribute("title"), /varış saati yok/);
  await dayCard(4).getByRole("button", { name: "Varış saati?" }).click();
  const arriveBox = dayCard(4).getByRole("textbox", { name: /varış saati/ }).or(dayCard(4).locator('.dg-arrive input[type="time"]'));
  await arriveBox.fill("16:04");
  await arriveBox.blur();
  await app.waitForFunction(() => [...document.querySelectorAll('.dg-day li[data-title="Check-in · Lisboa Loft"] .t')].some((t) => t.textContent === "~17:14"), null, { timeout: 10000 });
  await app.screenshot({ path: `${out}/3e-arrival-asked.png` });
  // Typed by hand, kept as a correction: the record's own arrival is the page's (empty here); put it back.
  await setTrainArrival("2026-10-11T16:04");
  // (A flight's real data on its day is checked in its own browser at the end: Part 6.)
  // Flights with a ticket bought are followed (0.36.16); the sample's never are, so here it's a real trip for a
  // moment (the server answered here, not asked).
  const setTrip = (patch) =>
    app.evaluate(async (patch) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
      const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
      const trip = trips.find((t) => t.title === "Portekiz (örnek)");
      Object.assign(trip, patch);
      await new Promise((resolve) => (database.transaction("trips", "readwrite").objectStore("trips").put(trip).onsuccess = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, patch);
  const asked = [];
  await app.route("**/functions/v1/flight**", (route) => (asked.push(route.request().url()), route.fulfill({ json: { flight: null } })));
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(asked.length, 0, "the sample's flights are never asked about");
  await setTrip({ demo: false });
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(asked.some((u) => u.includes("number=TP1760&day=2026-10-14")), `the booked flight asked about (${asked.join(", ")})`);
  assert.ok(!asked.some((u) => u.includes("TP1761") || u.includes("PC1201")), "an option without a ticket isn't");
  await setTrip({ demo: true });
  await app.unroute("**/functions/v1/flight**");
  assert.equal(await dayCard(7).locator('.dg-tl > li[data-title="Uçuş · Lizbon → İstanbul"] .dg-sub').innerText(), "varış 01:35 (+1) · TP 1760"); // short (0.36.27): the airports the title says aren't repeated
  // Nothing is folded: check-out, the transfer to the airport, the flight.
  assert.deepEqual(await dayTitlesOf(7), ["Check-out · Lisboa Loft", "Havalimanı transferi", "Uçuş · Lizbon → İstanbul"]);
  // 0.35.6: a line without a time is moved by its grip (drag, or ↑ ↓); the day keeps that order.
  const day1 = () => dayTitlesOf(1);
  assert.deepEqual(await day1(), ["Uçuş · İstanbul → Porto", "Havalimanı transferi", "Check-in · Porto konaklaması"]);
  const checkIn = lineOf(1, "Check-in · Porto konaklaması");
  // The grip shows on hover only.
  await app.mouse.move(1, 1);
  await app.waitForFunction((el) => getComputedStyle(el).opacity === "0", await checkIn.locator(".dg-grip").elementHandle());
  await checkIn.hover();
  await app.waitForFunction((el) => getComputedStyle(el).opacity === "1", await checkIn.locator(".dg-grip").elementHandle());
  // The line scrolls to below the sticky bar (scroll-margin), where the drop can land; dragTo's own scroll would leave it behind the bar.
  await lineOf(1, "Uçuş · İstanbul → Porto").evaluate((el) => el.scrollIntoView({ block: "center" })); // "IfNeeded" leaves a visible line under the sticky bar
  await checkIn.locator(".dg-grip").dragTo(lineOf(1, "Uçuş · İstanbul → Porto"), { targetPosition: { x: 200, y: 4 } });
  await app.waitForFunction(() => document.querySelector(".dg-day .dg-tl > li")?.getAttribute("data-title") === "Check-in · Porto konaklaması");
  assert.deepEqual(await day1(), ["Check-in · Porto konaklaması", "Uçuş · İstanbul → Porto", "Havalimanı transferi"]);
  // Back down with the keyboard, one step at a time.
  await checkIn.locator(".dg-grip").focus();
  await app.keyboard.press("ArrowDown");
  await app.waitForFunction(() => document.querySelector(".dg-day .dg-tl > li")?.getAttribute("data-title") === "Uçuş · İstanbul → Porto");
  await checkIn.locator(".dg-grip").focus();
  await app.keyboard.press("ArrowDown");
  await app.waitForFunction(() => [...document.querySelectorAll(".dg-day")][0].querySelector(".dg-tl > li:last-child")?.getAttribute("data-title") === "Check-in · Porto konaklaması");
  assert.deepEqual(await day1(), ["Uçuş · İstanbul → Porto", "Havalimanı transferi", "Check-in · Porto konaklaması"]);
  // A line with a time moves too (0.35.10): it stays where it's dropped, its time hidden; "×" puts it back on its time.
  const day7 = () => dayCard(7).locator(".dg-tl > li").evaluateAll((els) => els.map((e) => `${e.querySelector(".t")?.textContent} ${e.dataset.title}`));
  assert.deepEqual(await day7(), ["~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi", "19:40 Uçuş · Lizbon → İstanbul"]);
  const flight7 = lineOf(7, "Uçuş · Lizbon → İstanbul");
  await flight7.hover();
  await flight7.locator(".dg-grip").dragTo(lineOf(7, "Check-out · Lisboa Loft"), { targetPosition: { x: 200, y: 4 } });
  await flight7.locator("button.t.freed").waitFor();
  // Untimed, the cell is blank.
  assert.deepEqual(await day7(), [" Uçuş · Lizbon → İstanbul", "~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi"]);
  assert.match(await flight7.locator("button.t").getAttribute("title"), /Elle taşındı \(saati 19:40\)/);
  await flight7.locator("button.t").click();
  assert.equal(await flight7.locator('input[type="time"]').inputValue(), "19:40");
  await flight7.getByRole("button", { name: "×" }).click();
  await flight7.locator("button.t.freed").waitFor({ state: "detached" });
  assert.deepEqual(await day7(), ["~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi", "19:40 Uçuş · Lizbon → İstanbul"]);
  // A time of one's own (dayTimes.ts): kept, a late one warned about in red; "×" gives the worked-out one back.
  const going = lineOf(7, "Havalimanı transferi");
  // Emre: abroad 2 h at the least, 3 h ideally: the time worked out from the ideal, a warning only past the latest.
  assert.match(await going.locator("button.t").getAttribute("title"), /İdeali 16:40, en geç 17:40 havalimanında; transfer ~1 sa/);
  await going.locator("button.t").click();
  await going.locator('input[type="time"]').fill("17:00");
  await going.locator(".dg-warn", { hasText: "17:40'ta havalimanında olmalısın" }).waitFor();
  await going.getByRole("button", { name: "×" }).click();
  await going.locator(".dg-warn").waitFor({ state: "detached" });
  assert.equal(await going.locator("button.t").innerText(), "~15:40");
  await app.screenshot({ path: `${out}/3e-itinerary.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await dayCard(4).scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-itinerary-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in the list");
  await app.setViewportSize({ width: 1440, height: 900 });
  // Gün gün's three ways to read (r-gungun): Kompakt (the default, the one above) | Liste (the city's photo beside the day) | Kartlar
  // (the day on a rail) | Harita; the choice is the traveller's own, kept on the device (localStorage, never the trip).
  const modes = app.locator(".days-mode");
  assert.deepEqual(await modes.getByRole("button").allInnerTexts(), ["Kompakt", "Liste", "Kartlar", "Harita"]);
  // 0.38.7: no key of the looks above the days (Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı), as in the other two views.
  assert.equal(await app.locator(".plan-key").count(), 0, "Gün gün has no key of the colours on top");
  assert.equal(await modes.getByRole("button", { name: "Kompakt" }).getAttribute("aria-pressed"), "true", "Kompakt is the default");
  await modes.getByRole("button", { name: "Liste", exact: true }).click();
  await app.locator(".dv-day").first().waitFor();
  assert.equal(await app.locator(".dv-day").count(), 7);
  assert.equal(await app.locator(".dg-day").count(), 0, "the compact rows are off");
  assert.deepEqual(await app.locator(".dv-pill").allInnerTexts(), ["Gün 1", "Gün 2", "Gün 3", "Gün 4", "Gün 5", "Gün 6", "Gün 7"]);
  assert.equal(await app.locator(".dv-strip button").count(), 7, "the strip of days");
  assert.equal(await app.locator(".dv-day").nth(0).locator(".dv-photo").count(), 1, "the day's photo (or its faint drawing)");
  assert.equal(flat(await app.locator(".dv-day").nth(0).locator(".dg-n").allInnerTexts())[0], "Gece: Porto · konaklama aranıyor");
  assert.equal(await app.locator(".dv-day").nth(0).locator(".dv-part-label", { hasText: "Günün akışı" }).count(), 1);
  assert.equal(await app.locator(".dv-day").nth(0).locator(".dv-part-label", { hasText: "Günün rezervasyonları" }).count(), 1);
  // Day 4 changes city: its way is one card (check-out, transfer, the train as the Plan's ticket, transfer, check-in).
  const jd = app.locator(".dv-day").nth(3).locator(".jd");
  await jd.waitFor();
  assert.equal(flat(await jd.locator(".jd-head").allInnerTexts())[0].startsWith("Yolculuk günü Porto → Lizbon"), true);
  assert.equal(await jd.locator(".jd-ticket .pk-card, .jd-ticket .cat-card, .jd-ticket [class*=card]").count() > 0, true, "the trip is the Plan's own card");
  assert.deepEqual(await jd.locator(".dg-tl > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-title"))), ["Check-out · Porto konaklaması", "Transfer", "Transfer", "Check-in · Lisboa Loft"]);
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll in Liste (1440)");
  await app.setViewportSize({ width: 390, height: 844 });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll in Liste (390)");
  // v46 E2: at 390 px no plan card's top line runs past its card (the status, the clip and the ••• stay inside).
  assert.deepEqual(await app.evaluate(() => [...document.querySelectorAll(".pk-card > .pk-top")].filter((t) => { const edge = t.parentElement.getBoundingClientRect().right + 1; return [...t.children].some((c) => !c.classList.contains("pk-x") && c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().right > edge); }).map((t) => t.textContent)), [], "a card's top line fits at 390");
  // v46 E4 (v82): at 390 px the cover's ⋯ sits on the cover, and the hero's parts stay inside it (none cut to a few letters).
  assert.deepEqual(await app.evaluate(() => { const m = document.querySelector(".x-hero .x-tmb"); const c = document.querySelector(".x-hero .x-big"); if (!m || !c) return ["missing"]; const a = m.getBoundingClientRect(); const b = c.getBoundingClientRect(); return a.left < b.left || a.right > b.right || a.top < b.top ? ["menu"] : []; }), [], "the cover's menu is on the cover at 390");
  assert.deepEqual((await heroLayout()).problems, [], "390 px: the hero's parts fit");
  await app.locator(".dv-day").nth(3).scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e2-gungun-liste-narrow.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.locator(".dv-strip button").nth(3).click();
  assert.equal(await app.evaluate(() => localStorage.getItem("trip-radar:days-view")), "list", "the choice is remembered on the device");
  await modes.getByRole("button", { name: "Kartlar" }).click();
  await app.locator(".dv-chead").first().waitFor();
  assert.equal(await app.locator(".dv-chead").count(), 7);
  assert.equal(await app.locator(".dv-rail").count(), 7);
  assert.equal(await app.locator(".dv-photo").count(), 0, "Kartlar: a small photo by the title, not the big one");
  await app.locator(".dv-day").nth(3).locator(".jd").waitFor();
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll in Kartlar (1440)");
  await app.setViewportSize({ width: 390, height: 844 });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll in Kartlar (390)");
  await app.setViewportSize({ width: 1440, height: 900 });
  // The choice stays across the Plan tab and back, and Harita keeps working.
  await tab("Plan").click();
  await tab("Gün gün").click();
  await app.locator(".dv-chead").first().waitFor();
  assert.equal(await modes.getByRole("button", { name: "Kartlar" }).getAttribute("aria-pressed"), "true");
  await modes.getByRole("button", { name: "Harita" }).click();
  await modes.getByRole("button", { name: "Kompakt" }).click();
  await app.locator(".dg-day").first().waitFor();
  assert.equal(await app.locator(".dv-day").count(), 0);
  // Kompakt: a day that changes city has a "Yolculuk günü" that opens its card under the lines (the others have none).
  assert.equal(await app.locator(".dg-trip").count(), 1);
  await dayCard(4).locator(".dg-trip").click();
  await dayCard(4).locator(".jd").waitFor();
  assert.equal(await dayCard(4).locator(".dg-trip").getAttribute("aria-expanded"), "true");
  await dayCard(4).locator(".dg-trip").click();
  assert.equal(await dayCard(4).locator(".jd").count(), 0);
  // A line is clickable: a tap shows its card on the Plan (the Plan tab is on, the card in view).
  await lineOf(4, "Tren · Porto → Lizbon").locator(".dg-main").click();
  await tab("Plan").and(app.locator('[aria-selected="true"]')).waitFor();
  await tab("Plan").click();
  // v82: where each intent stands is its head's chip and its box's ground: the booked stay "✓ Rezerve".
  await openSec("stay");
  await sec("stay").locator('.q-ints > .q-int[data-st="ok"] .q-st', { hasText: "Rezerve" }).waitFor();
  // F7 (S3), v82: an undecided stay with a real priced option is "Önerimiz · onayla": the best option in the fixed frame (its site and
  // rating, its name, the price by the night and the nights' total), "Bunu seç" with "Değiştir" and the site ↗ under it (B11), no
  // "Aldım". Değiştir turns the card back to the options in place (three cards, best first, "Vazgeç"); ⓘ opens the details over it:
  // the pick in a sentence and this one against the next (C12), what to check before choosing, its pluses, why it's here in the
  // traveller's own word (K6).
  const portoDraft = sec("stay").locator('.q-ints > .q-int[data-st="ai"]', { has: app.locator(".z-t", { hasText: "Jardim Stay" }) });
  await portoDraft.waitFor();
  assert.equal(flat([await portoDraft.locator(".q-st").innerText()])[0], "✨ Önerimiz · onayla");
  assert.equal(await portoDraft.locator(".z-bt .q-take").innerText(), "Bunu seç");
  assert.equal(await portoDraft.locator(".q-got").count(), 0, "no ✓ Aldım: nothing is chosen yet");
  assert.match(flat([await portoDraft.locator(".z-top .q-pr").innerText()])[0], /^€\d+ \/ gece · €\d+$/, "its real price by the night, and the nights' total");
  assert.equal(await portoDraft.locator(".q-pn").innerText(), "3", "Pano 3: every option of the need");
  const site = portoDraft.locator(".z-row .q-srcl");
  assert.equal(await site.getAttribute("target"), "_blank");
  assert.match(await site.getAttribute("href"), /^https:\/\/www\.booking\.com\//);
  // The fixed frame (v82): 76 + 196 and the box's edges, the same at 1440 and 390 px keeps its order (A8).
  assert.equal(Math.round((await portoDraft.boundingBox()).height), 288, "the box is 288 px (head 76, body 196)");
  await app.setViewportSize({ width: 390, height: 844 });
  const cardBox = await portoDraft.boundingBox();
  const priceBox = await portoDraft.locator(".z-top").boundingBox();
  assert.ok(priceBox && cardBox && priceBox.x >= cardBox.x - 1 && priceBox.x + priceBox.width <= cardBox.x + cardBox.width + 1, "the side column stays inside its box at 390 px");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with the box at 390 px");
  await app.setViewportSize({ width: 1440, height: 900 });
  await portoDraft.scrollIntoViewIfNeeded();
  await portoDraft.screenshot({ path: `${out}/40a-draft-stay.png` });
  await portoDraft.locator(".z-ib").click();
  const stayChoice = portoDraft.locator(".z-det");
  await stayChoice.waitFor();
  assert.equal(await stayChoice.locator(".q-dwhy").innerText(), "Önerim Jardim Stay: en sessiz; 2.'ye göre €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu. Tasarruf için 3. Casa Azul (1.'ye göre €45 daha ucuz).");
  assert.match(await stayChoice.locator(".q-dtrade").innerText(), /^2\.'ye göre\s*€45 daha ucuz \(gecelik −€15\)/);
  // (a ★ marks what touches a priority the traveller gave, C12)
  assert.deepEqual((await stayChoice.locator(".q-pl.p li").allInnerTexts()).map((t) => t.replace(/^★\s*/, "")), ["Kahvaltı çok iyi", "Gezeceğin yerlere 6 dk", "Ücretsiz iptal · son gün 5 Ekim", "Yorum puanları yüksek"]);
  await stayChoice.locator(".q-dverify li", { hasText: "Yan binada inşaat var; sessiz bir yer istiyorsun" }).waitFor();
  assert.match(await stayChoice.innerText(), /Uyum puanı 83\/100 · 1\. sırada/);
  assert.deepEqual(await stayChoice.locator(".q-mc.y").allInnerTexts(), ["✓ Sessiz"]);
  // K6 "neden": one line in their own word (the quiet they asked for).
  assert.equal(await stayChoice.locator(".pk-why").innerText(), "Sessiz · “Sessiz bir yer istiyoruz” dediğin için");
  assert.equal(Math.round((await portoDraft.boundingBox()).height), 288, "the details open over the card, never making it taller");
  await app.screenshot({ path: `${out}/34a-stay-choice.png` });
  await app.keyboard.press("Escape");
  await stayChoice.waitFor({ state: "detached" });
  await portoDraft.getByRole("button", { name: "Değiştir" }).click();
  const optionCards = portoDraft.locator(".q-opts .z-oc");
  await optionCards.first().waitFor();
  assert.deepEqual(await portoDraft.locator(".q-opts .z-oc .z-t").allInnerTexts(), ["Jardim Stay", "Ribeira Rooms", "Casa Azul"], "the options best first");
  assert.equal(flat([await portoDraft.locator(".q-opts .z-oc").first().locator(".q-src").innerText()])[0], "✨ Önerimiz");
  assert.equal(await portoDraft.locator(".q-opts .q-tag", { hasText: "En ucuz" }).count(), 1);
  // 0.38.6 (Emre: the picks' card is the right one): the options in place are the picks' cards, their photo 4:3, never the
  // thin strip; the box is as tall as they are while they're shown, and 288 px again once it's turned back.
  const optRatio = await optionCards.first().locator(".z-op").evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  assert.ok(optRatio > 1.25 && optRatio < 1.42, `Değiştir's option photo is 4:3 (${optRatio.toFixed(2)})`);
  await portoDraft.getByRole("button", { name: "Vazgeç" }).click();
  await portoDraft.locator(".z-bt .q-take").waitFor();
  assert.equal(Math.round((await portoDraft.boundingBox()).height), 288, "turned back, the box is 288 px again");
  await openSec("flight");
  // Flights (v82 bilet ailesi, F7): the need with two real priced options is our pick, the Pegasus (the engine's), drawn as the
  // ticket: the airline's mark, its name and number with the day small, İstanbul and Porto big with the airport code and the
  // hour under them, the length and "direkt" around the plane, the bag under it; "Önerimiz · onayla" on its chip, what one pays
  // and how many go, "Bunu seç", Değiştir under it, no "Aldım". Değiştir turns it to its options in place, one row each
  // (Skyscanner's: the airline, the hours over the codes, the length and stops, our pick and En hızlı / En ucuz ribboned,
  // the price and the bag, "Seç"), the box 288 px all along; Vazgeç turns it back.
  const outDraftKey = await sec("flight").locator('.q-ints > .q-int[data-st="ai"]', { has: app.locator(".z-car", { hasText: "Pegasus" }) }).getAttribute("data-intent");
  // (by its key: its options' rows draw no carrier line)
  const outDraft = sec("flight").locator(`.q-ints > .q-int[data-intent="${outDraftKey}"]`);
  assert.equal(flat([await outDraft.locator(".q-st").innerText()])[0], "✨ Önerimiz · onayla");
  // 0.38.7: an airline known by its code wears its logo (the flight card's files), its letters only if it won't load.
  assert.equal(flat([await outDraft.locator(".z-car").innerText()])[0], "Pegasus PC 1201 · 8 Ekim");
  assert.match(await outDraft.locator(".z-car img.q-air").getAttribute("src"), /\/airlines\/64\/PC\.png$/, "the airline's logo by its code");
  assert.match(flat([await outDraft.locator(".z-route").innerText()])[0], /^İstanbul IST · 07:10 4 sa 55 dk direkt Porto OPO · 10:05$/);
  assert.equal(await outDraft.locator(".z-tm .z-l3 .z-chip").innerText(), "1 bagaj dahil");
  assert.match(flat([await outDraft.locator(".z-top .q-pr").innerText()])[0], /^€\d+ kişi başı · 2 kişi €\d+$/, "what one pays, how many go and the whole sum");
  assert.equal(await outDraft.locator(".z-bt .q-take").innerText(), "Bunu seç");
  assert.equal(await outDraft.locator(".q-got").count(), 0, "no ✓ Aldım on our pick");
  assert.equal(await outDraft.locator(".z-tk").evaluate((el) => getComputedStyle(el).borderTopStyle), "solid", "no dashed frame on a ticket");
  // (C16: the ticket carries no warning line; "Uçuşa 3 gün · bilet alınmadı" is Hazırlık's day now, as every rule's note.)
  assert.equal(await outDraft.locator(".tk-warn, .z-warn").count(), 0, "no warning line on the ticket");
  assert.equal(Math.round((await outDraft.boundingBox()).height), 288, "the ticket box is 288 px (head 76, body 196)");
  await outDraft.scrollIntoViewIfNeeded();
  await outDraft.screenshot({ path: `${out}/32b-draft-ticket.png` });
  await outDraft.getByRole("button", { name: "Değiştir" }).click();
  const flightRows = outDraft.locator(".q-opts .z-r");
  await flightRows.first().waitFor();
  assert.deepEqual(await outDraft.locator(".q-opts .z-r .q-an b").allInnerTexts(), ["Pegasus", "TAP"], "the options best first");
  assert.deepEqual(await flightRows.nth(0).locator(".q-rb1").allInnerTexts(), ["✨ Önerimiz", "En hızlı"]);
  assert.deepEqual(await flightRows.nth(1).locator(".q-rb1").allInnerTexts(), ["En ucuz"]);
  assert.equal(flat([await flightRows.nth(1).locator(".q-leg").innerText()])[0], "05:40 IST 8 sa 10 dk 1 aktarma 12:50 OPO");
  assert.equal(await flightRows.nth(1).locator(".q-bg").innerText(), "Yalnız el bagajı");
  assert.equal(await outDraft.locator(".q-opts .z-r .q-pick").count(), 2);
  const rowHeights = await flightRows.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  assert.equal(new Set(rowHeights).size, 1, `the rows as tall as one another (${rowHeights})`);
  assert.equal(Math.round((await outDraft.boundingBox()).height), 288, "Değiştir turns the ticket into its rows in place: the box doesn't grow");
  await app.screenshot({ path: `${out}/32a-choice-window.png` });
  await outDraft.getByRole("button", { name: "Vazgeç" }).click();
  await outDraft.locator(".z-bt .q-take").waitFor();
  // "Sıradaki" goes to the next step (F4): here the visa to get, its row in Belgeler ve internet, with a flash. (The to-do
  // list under the hero, its groups and "⏳ N", left the interface in this version: spec §1.1, C8; not checked here.)
  await app.locator(".x-hero .x-next").click();
  await app.locator("[data-visa].flash").waitFor();
  await heroAgrees("after the comparisons");
  // And the money: what it will likely cost against the budget; a tap opens booked, planned and free a line each, each
  // person's share (T5), the split by kind and what the open decisions will likely add.
  const budget = app.locator(".x-hero .x-s3");
  assert.match(flat([await budget.locator(".x-budb").innerText()])[0], /^~€[\d.]+$/);
  assert.match(flat([await budget.locator(".x-sl").innerText()])[0], /^€1\.500 bütçeden €[\d.]+ kaldı$/);
  await budget.locator(".x-budb").click();
  assert.match(await budget.locator(".x-bud-pop").innerText(), /Bütçe · €1\.500[\s\S]*Boşta\s*€923[\s\S]*Kişi başı\s*~€\d[\d.]* · 2 kişi[\s\S]*Konaklama[\s\S]*yaklaşık €442 daha eklenir/);
  await budget.locator(".x-budb").click();
  await budget.locator(".x-bud-pop").waitFor({ state: "detached" });
  // Decided already: the boat tour on the 9th and the flight home.
  await openSec("activity");
  const douro = sec("activity").locator('.z-k[aria-label="Douro tekne turu"]');
  await douro.getByRole("button", { name: "Aldım", exact: true }).waitFor();
  await openSec("flight");
  // Alındı (v81, v82 bilet): the flight home bought is its ticket, "✓ Bilet alındı" on the side column with what was paid (B10),
  // "Bileti ekle" dashed while it has no file; the cities big with the airport codes and hours small, the landing day only
  // because it's the next day; the frame solid and green. A misclick on "Aldım" is taken back from its ⋯ ("Rezervasyonu geri
  // al") and redone.
  const home = sec("flight").locator(".q-ints > .q-int", { has: app.locator(".q-nm", { hasText: "Lizbon" }) });
  await home.locator(".z-top .z-ok", { hasText: "Bilet alındı" }).waitFor();
  assert.equal(await home.getAttribute("data-st"), "ok");
  assert.match(flat([await home.locator(".z-top .z-paid").innerText()])[0], /^€\d+ ödendi$/, "B10: what was paid");
  assert.match(flat([await home.locator(".z-route").innerText()])[0], /^Lizbon LIS · 19:40 .*İstanbul IST · 01:35 ?\+1$/);
  assert.equal(await home.locator(".z-bt .q-doc.add").innerText(), "Bileti ekle");
  assert.equal(await home.locator(".z-tk.bk").evaluate((el) => getComputedStyle(el).borderTopStyle), "solid");
  await home.locator(".z-h .z-mb").click();
  await home.getByRole("menuitem", { name: "Rezervasyonu geri al" }).click();
  await sec("flight").locator('.q-ints > .q-int[data-st="sel"]', { has: app.locator(".q-nm", { hasText: "Lizbon" }) }).waitFor();
  // Chosen, not bought (no page to buy it on): "✓ Aldım" is its main button.
  await home.locator(".z-bt").getByRole("button", { name: "✓ Aldım" }).click();
  await home.locator(".z-top .z-ok", { hasText: "Bilet alındı" }).waitFor();
  // B1: a booking's code is there long before the flight's day (nine days off here), with its copy button; the box keeps its size.
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
    const tx = database.transaction(["items"], "readwrite");
    const all = await new Promise((resolve) => (tx.objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tp = all.find((i) => i.category === "flight" && i.status === "booked" && /TAP/.test(i.name));
    tx.objectStore("items").put({ ...tp, bookingRef: "ABC123" });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const pnr = home.locator(".z-top .q-code", { hasText: "ABC123" });
  await pnr.waitFor();
  assert.equal(flat([await pnr.innerText()])[0], "PNR ABC123");
  await pnr.locator(".q-cp").click();
  await app.waitForFunction(() => /^(Kopyalandı|Seçildi, ⌘C ile kopyala)$/.test(document.querySelector('.q-sec[data-section="flight"] .z-top .q-code .q-cp')?.getAttribute("aria-label") ?? ""), null, { timeout: 3000 });
  assert.equal(Math.round((await home.boundingBox()).height), 288, "a booked ticket is 288 px");
  await home.screenshot({ path: `${out}/37f-copy-card.png` });
  // Ayrıntı (ⓘ) opens over the ticket, never making it taller: the booking's code, its day and hour, where it leaves from, what
  // was paid, its files; "İptal ettim, değiştir" (a booking has no Değiştir of its own). Escape closes it, the focus back on ⓘ.
  await home.locator(".z-tk > .z-ib").click();
  const homeDetail = home.locator(".z-det");
  await homeDetail.waitFor();
  assert.match(flat([await homeDetail.innerText()])[0], /PNR ABC123[\s\S]*Ne zaman 14 Eki 19:40[\s\S]*Lizbon LIS[\s\S]*Ödenen €\d+ ödendi[\s\S]*Belge ekle/);
  await homeDetail.getByRole("button", { name: "İptal ettim, değiştir" }).waitFor();
  assert.equal(await home.locator(".z-bt .q-chg, .z-row .q-chg").count(), 0, "a booking's frame has no Değiştir");
  assert.equal(Math.round((await home.boundingBox()).height), 288, "the details open over the ticket");
  await app.screenshot({ path: `${out}/37g-peek-flight.png` });
  await app.keyboard.press("Escape");
  await homeDetail.waitFor({ state: "detached" });
  // (put the record back as it was: later checks read it)
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
    const tx = database.transaction(["items"], "readwrite");
    const all = await new Promise((resolve) => (tx.objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tp = all.find((i) => i.category === "flight" && i.status === "booked" && /TAP/.test(i.name));
    const { bookingRef, ...rest } = tp;
    tx.objectStore("items").put(rest);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await pnr.waitFor({ state: "detached" });
  // v11: a row on the plan opens its record (a tap anywhere but its controls; its title is edited where it stands).
  await openSec("activity");
  await douro.locator(".z-kmb").click();
  await app.locator(".z-kpop").getByRole("menuitem", { name: "Tüm detaylar" }).click();
  const douroDrawer = app.getByRole("dialog");
  await douroDrawer.waitFor();
  await douroDrawer.getByRole("button", { name: "Kapat" }).first().click();
  await douroDrawer.waitFor({ state: "detached" });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/3-board.png` });

  // v82: what each was asked for is a mark on the stay's card with its words on hover; an option's name (Değiştir shows them in
  // place) opens its record's drawer, where the evidence behind a finding is, with "sorun değil": the construction then no
  // longer needs checking before choosing (the details over the card say what to check, C12).
  const porto = async () => {
    await openSec("stay");
    const box = sec("stay").locator(".q-ints > .q-int", { has: app.locator(".z-h .q-nm", { hasText: "Porto" }) });
    await box.waitFor();
    return box;
  };
  const openStayChoice = async () => {
    const box = await porto();
    if (!(await box.locator(".z-det").count())) await box.locator(".z-ib").click();
    await box.locator(".z-det").waitFor();
    return box.locator(".z-det");
  };
  let portoBox = await porto();
  assert.equal(await portoBox.locator(".z-l3 .z-chip.y", { hasText: "Sessiz" }).getAttribute("title"), "Sessiz odalar, iyi uyku · 3 yorum");
  await app.screenshot({ path: `${out}/3-cards.png` });
  await portoBox.getByRole("button", { name: "Değiştir" }).click();
  await portoBox.getByRole("button", { name: "Casa Azul: tüm detaylar" }).click();
  const casaDrawer = app.getByRole("dialog");
  const construction = casaDrawer.locator(".pc-line", { hasText: "Yan binada inşaat gürültüsü" });
  await construction.getByText("3 yorum · en yenisi Eyl 2026", { exact: false }).waitFor();
  await construction.getByRole("button", { name: "Kanıt" }).click();
  await construction.locator("blockquote", { hasText: "Construction next door starts at 8 every morning" }).waitFor();
  await app.screenshot({ path: `${out}/3a-evidence.png` });
  await construction.getByRole("button", { name: "Sorun değil" }).click();
  await casaDrawer.locator(".pc-line.accepted", { hasText: "Yan binada inşaat gürültüsü" }).waitFor();
  await casaDrawer.getByRole("button", { name: "Kapat" }).click();
  await portoBox.getByRole("button", { name: "Vazgeç" }).click();
  let stayWin = await openStayChoice();
  assert.equal(await stayWin.locator(".q-dverify li", { hasText: "Yan binada inşaat" }).count(), 0, "accepted: nothing to check before choosing");
  await app.keyboard.press("Escape");
  await stayWin.waitFor({ state: "detached" });
  // How it understood the traveller so far: what they said (incl. "sorun değil"); a pattern in the saved
  // stays is asked about, and counts only after a yes.
  // On the hero it's "Tercihler": a few tags and the question's "1"; a tap opens "Seni böyle anladım" under it.
  const intent = app.locator(".x-hero .x-prefs");
  await intent.locator(".x-prefb", { has: app.locator(".x-q") }).click();
  const guess = intent.locator(".x-pref-pop .x-ask", { hasText: "İptal esnekliği senin için daha mı önemli?" });
  await guess.waitFor();
  await guess.getByRole("button", { name: "Evet" }).click();
  await guess.waitFor({ state: "detached" });
  await intent.locator(".x-pref-pop li", { hasText: "ücretsiz iptalli" }).waitFor();
  await intent.locator(".x-pref-pop li", { hasText: "Sorun değil: Yan binada inşaat gürültüsü" }).waitFor();
  await intent.locator(".x-prefb").click();
  await intent.locator(".x-pref-pop").waitFor({ state: "detached" });
  assert.equal(await intent.locator(".x-q").count(), 0, "the question answered: no \"1\" left");
  assert.ok((await intent.locator(".x-ptag").count()) >= 1, "what was understood, in short tags");
  await app.screenshot({ path: `${out}/3b-card.png` });

  // Comparison (the details' "Karşılaştır", C12). v82, B12: the comparison is the Pano's; the old window (its Kartlar, the table,
  // the weights the traveller sets, "Neden?", Sırayla karar ver) is C11's karar yardımı, not in this version (spec §1.1, row 199:
  // bu sürümde arayüzden düştü). "Karşılaştır" opens the Pano on the intent: its options side by side, best fit first, what was
  // asked for ✓ / ✕, their pluses and minuses. The old window's checks below wait, as they were, for the version that brings it back.
  stayWin = await openStayChoice();
  await stayWin.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  const cmpPano = app.getByRole("dialog", { name: "Pano" });
  const cmpCol = (name) => cmpPano.locator(`.q-cmp3 .q-col[aria-label="${name}"]`);
  await cmpCol("Jardim Stay").waitFor();
  assert.equal(await app.getByRole("dialog", { name: "Karşılaştırma" }).count(), 0, "row 199: the old comparison window is not opened");
  assert.equal(await cmpPano.locator(".q-cmp3 .q-col").first().getAttribute("aria-label"), "Jardim Stay", "best fit first");
  assert.match(await cmpCol("Jardim Stay").locator(".q-score").innerText(), /^\d+\s*\/100/);
  await cmpCol("Jardim Stay").locator(".q-mc.y", { hasText: "Sessiz" }).waitFor(); // what they asked for, checked
  await cmpCol("Ribeira Rooms").locator(".q-mc.n", { hasText: "Sessiz" }).waitFor();
  assert.ok((await cmpCol("Jardim Stay").locator(".q-pl li").count()) >= 2, "its pros and cons");
  assert.ok((await cmpPano.locator(".q-cmp3 .q-col").count()) >= 2, "every option a column");
  await app.setViewportSize({ width: 1440, height: 1100 });
  await app.screenshot({ path: `${out}/3c-board.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  await cmpPano.getByRole("button", { name: "Pano'yu kapat" }).click();
  await cmpPano.waitFor({ state: "detached" });
  if (CMP_SHOWN) {
    const compare = app.getByRole("dialog", { name: "Karşılaştırma" });
    // 0.37: stays open on the board (Kartlar): a card per option, its badge, score, price and biggest pros/cons.
    await compare.locator(".cmp-views [role=tab].on", { hasText: "Kartlar" }).waitFor();
    const boardCard = (name) => compare.locator(`.bd-card[aria-label="${name}"]`);
    await boardCard("Jardim Stay").locator(".bd-badge", { hasText: "Önerim" }).waitFor();
    assert.match(await boardCard("Jardim Stay").locator(".bd-score").innerText(), /^\d+\s*puan$/);
    await boardCard("Jardim Stay").locator(".bd-needs .need.yes", { hasText: "Sessiz" }).waitFor(); // what they asked for, checked
    // (what the old card's ✕ said on hover: the board says it on the option's own mark)
    await boardCard("Ribeira Rooms").locator('.bd-needs .need.no[title^="Hafta sonu gece gürültüsü"]').waitFor();
    assert.ok((await boardCard("Jardim Stay").locator(".bd-pc li").count()) >= 2, "its biggest pros and cons");
    assert.ok((await compare.locator(".bd-card:not(.bd-add)").count()) >= 2, "every option a card");
    await app.setViewportSize({ width: 1440, height: 1100 });
    await app.screenshot({ path: `${out}/3c-board.png` });
    await app.setViewportSize({ width: 1440, height: 900 });
    // Karar Panosu #10 "Sırayla karar ver": one open decision per screen ("1 / N"), the options side by side with one line of advice;
    // "Sonra" passes one on, "Geri" comes back, the last screen says what is left; the cards and the table stay as they were.
    // v82: C11 (karar yardımı) is out of this version's interface (spec §1.1, bu sürümde arayüzden düştü): the button is not offered,
    // its code (board/StepDecide) stays. The walk below waits, as it was, for the version that brings it back.
    const C11_SHOWN = false;
    assert.equal(await compare.getByRole("button", { name: "Sırayla karar ver" }).count(), 0, "C11: Sırayla karar ver is not offered in this version");
    if (C11_SHOWN) {
      await compare.getByRole("button", { name: "Sırayla karar ver" }).click();
      const stepHead = compare.locator(".sd-top h3");
      assert.match(await stepHead.innerText(), /^1 \/ \d+ · Konaklama/, "the window's decision comes first");
      await compare.locator(".sd-reco").waitFor();
      assert.ok((await compare.locator(".sd-card").count()) >= 2, "its options side by side");
      await compare.locator('.sd-card[aria-label="Jardim Stay"] .sd-price').waitFor(); // the price is never hidden
      await app.screenshot({ path: `${out}/3c-step.png` });
      await app.setViewportSize({ width: 390, height: 844 });
      assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in the one-by-one view at 390 px");
      assert.ok(await compare.locator(".compare-card, .sd").first().evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "the window doesn't spill at 390 px");
      await app.screenshot({ path: `${out}/3c-step-390.png` });
      await app.setViewportSize({ width: 1440, height: 900 });
      await compare.getByRole("button", { name: "Sonra", exact: true }).click();
      while (!(await compare.getByRole("heading", { name: "Bitti" }).count())) {
        await compare.getByRole("button", { name: "Sonra", exact: true }).click();
      }
      await compare.getByText(/karar sonraya kaldı/).waitFor();
      await compare.getByRole("button", { name: "← Geri" }).click();
      assert.match(await stepHead.innerText(), /^\d+ \/ \d+ · /, "Geri comes back to the last decision");
      await compare.getByRole("button", { name: "Sonra", exact: true }).click();
      await compare.getByRole("button", { name: "Tamam" }).click();
      await compare.locator(".cmp-views [role=tab].on", { hasText: "Kartlar" }).waitFor();
    }
    console.log("✓ compare: Sırayla karar ver is not offered (C11, bu sürümde arayüzden düştü); the one-by-one walk is kept for when it comes back");
    // Two ticked → side by side in the table, just those; "Hepsini göster" brings the rest back.
    await boardCard("Jardim Stay").locator(".bd-tick").click();
    await boardCard("Casa Azul").locator(".bd-tick").click();
    await compare.getByRole("button", { name: "Tabloda yan yana gör →" }).click();
    assert.deepEqual(await compare.locator("thead .opt-name").allInnerTexts(), ["Jardim Stay", "Casa Azul"]);
    await compare.getByRole("button", { name: "Hepsini göster" }).click();
    const winner = compare.locator("thead th.win .opt-name");
    assert.equal(await winner.innerText(), "Jardim Stay");
    await compare.getByText("Neden Jardim Stay?").waitFor();
    // Pros and cons per column, and the sample AI review kept (dated) now that the inputs changed.
    await compare.locator(".pc-row .pc-col.pros", { hasText: "Sessiz odalar, iyi uyku" }).waitFor().catch(async (e) => {
      console.log("pros/cons row:", await compare.locator(".pc-row").innerText());
      throw e;
    });
    // Karar Panosu #2/#4 "★ öncelik": the quiet they asked for carries the star (its plus, its row); what nobody asked for doesn't.
    await compare.locator('.pc-row .pc-line:has-text("Sessiz odalar, iyi uyku") .mine-star').first().waitFor();
    assert.ok((await compare.locator(".pc-row .pc-line .mine-star").count()) < (await compare.locator(".pc-row .pc-line").count()), "only some of the lines are starred");
    await compare.locator("tr:has(.crit-col > div:text-matches('^Sessizlik')) .crit-col .mine-star").waitFor();
    assert.equal(await compare.locator(".mine-star").first().getAttribute("aria-label"), "Senin için önemli");
    await compare.locator(".mine-legend").waitFor();
    await app.setViewportSize({ width: 390, height: 844 });
    assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with the stars at 390 px");
    await app.setViewportSize({ width: 1440, height: 900 });
    // The verdict is one line; the rest under "Neden?".
    assert.equal(await compare.locator(".cmp-verdict-detail").count(), 0, "the verdict starts as one line");
    await compare.locator(".cmp-verdict-more").click();
    await compare.getByText("güncellemek için Ayarlar'dan ücretsiz Gemini anahtarı ekle", { exact: false }).waitFor(); // no key yet
    await app.screenshot({ path: `${out}/3c-compare.png`, fullPage: true });
    // Quiet, which they asked for, is its own row now ("Sessizlik: Önemli" from their note). Location and quiet
    // stop mattering and price matters most → the cheaper stay wins, and the view says what would flip it back.
    const quietRow = compare.locator("tr:has(.crit-col > div:text-matches('^Sessizlik')) select");
    await quietRow.waitFor();
    assert.equal(await quietRow.inputValue(), "3");
    await compare.locator("tr", { hasText: "Konum" }).locator("select").selectOption("0");
    await quietRow.selectOption("0");
    await compare.locator("tr", { hasText: "Fiyat" }).first().locator("select").selectOption("4");
    await compare.locator("thead th.win .opt-name", { hasText: "Casa Azul" }).waitFor();
    await compare.getByText("Konum çok önemli olursa").waitFor();
    await app.screenshot({ path: `${out}/3d-compare-priority.png`, fullPage: true });
    await compare.getByText("Önemleri varsayılana döndür").click();
    await compare.locator("thead th.win .opt-name", { hasText: "Jardim Stay" }).waitFor();
    await compare.getByRole("button", { name: "Kapat" }).click();
  }
  console.log("✓ compare: Karşılaştır opens the Pano's comparison (B12); the old window's weights and table are not offered (C11, row 199, bu sürümde arayüzden düştü)");

  // A stay chosen from its record's drawer ("Plana al"): the details' "Tüm detaylar ›" opens it, with its breakdown.
  stayWin = await openStayChoice();
  await stayWin.getByRole("button", { name: "Tüm detaylar ›" }).click();
  await app.getByRole("dialog").waitFor();
  await app.locator(".breakdown .score-big").waitFor(); // per-criterion breakdown in the drawer
  await app.screenshot({ path: `${out}/4-drawer.png` });
  await app.getByRole("dialog").getByRole("button", { name: "Plana al", exact: true }).click();
  await app.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();
  // The chat folds a run of change lines ("N değişiklik ▾", drawing ux-katmanli-arayuz); open it to read them.
  const changeFold = app.locator(".chat .ev-fold-btn").last();
  await changeFold.waitFor();
  assert.match(await changeFold.innerText(), /\d+ değişiklik/);
  await app.screenshot({ path: `${out}/36d-chat-fold-closed.png` });
  if ((await changeFold.getAttribute("aria-expanded")) !== "true") await changeFold.click();
  await app.screenshot({ path: `${out}/36e-chat-fold-open.png` });
  await app.getByText("Jardim Stay plana alındı").waitFor();
  // v82: chosen, the stay's box says "Seçildi" (sand), its side column the price, "Rezerve et ↗" and "✓ Aldım · Değiştir"; Değiştir
  // turns the card back to its options in place, the chosen one marked "Seçili" (no back over the row, no arrow keys: the cards are
  // buttons in the tab order); Vazgeç or Escape turns it back.
  portoBox = await porto();
  await portoBox.locator('[data-st="sel"], .q-st.sel').first().waitFor();
  const jardimRow = sec("stay").locator('.q-ints > .q-int[data-st="sel"]');
  assert.equal(flat([await jardimRow.locator(".q-st").innerText()])[0], "Seçildi", "H1: a chosen stay says Seçildi in words");
  assert.equal(await jardimRow.locator(".z-t").innerText(), "Jardim Stay");
  assert.match(await jardimRow.locator(".z-bt .q-cta").innerText(), /Rezerve et/);
  await jardimRow.locator(".z-row .q-got", { hasText: "Aldım" }).waitFor();
  assert.equal(await app.locator(".swipe-card").count(), 0);
  await sec("stay").screenshot({ path: `${out}/35-stay-chosen-v11.png` });
  await jardimRow.getByRole("button", { name: "Değiştir" }).click();
  const otherStays = jardimRow.locator(".q-opts");
  await otherStays.locator(".z-oc", { hasText: "Jardim Stay" }).waitFor();
  assert.equal(await otherStays.locator(".z-oc").count(), 3, "three small cards in place of the chosen one");
  assert.equal(await otherStays.locator(".z-oc.is-cur .q-pick").innerText(), "Seçili");
  assert.equal(await otherStays.locator(".q-oc").innerText(), "seçtiğin işaretli");
  // (0.38.6: the options' cards with their 4:3 photo, the box as tall as they are while changing, 288 px turned back)
  assert.ok(await otherStays.locator(".z-oc .z-op").first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.width / r.height > 1.25 && r.width / r.height < 1.42; }), "the options' photo is 4:3 while changing");
  await otherStays.getByRole("button", { name: "Vazgeç" }).click();
  await otherStays.waitFor({ state: "detached" });
  assert.equal(Math.round((await jardimRow.boundingBox()).height), 288, "turned back, the box is 288 px again");
  await jardimRow.getByRole("button", { name: "Değiştir" }).click();
  await otherStays.waitFor();
  await app.keyboard.press("Escape");
  await otherStays.waitFor({ state: "detached" });
  await openSec("flight");
  // F7 (S1, S2): "✓ Bunu seç" on the flight's draft makes it Seçildi: the flight turns into the chosen ticket, and its landing time reaches the
  // transfer to the hotel. The hero's shares moved only now (the draft was a decision waiting: 6 of them at the start), by one.
  const beforePick = await heroNumbersOnPage();
  const pegBox = sec("flight").locator(".q-ints > .q-int", { has: app.locator(".z-car", { hasText: "Pegasus" }) });
  await pegBox.locator(".z-bt .q-take", { hasText: "Bunu seç" }).click();
  await sec("flight").locator('.q-ints > .q-int[data-st="sel"]', { has: app.locator(".z-car", { hasText: "Pegasus" }) }).waitFor();
  assert.equal(await sec("flight").locator('.q-ints > .q-int[data-st="ai"]').count(), 0, "chosen: no draft left on the flight");
  const afterPick = await heroAgrees("after a pick");
  assert.deepEqual([afterPick.total, afterPick.booked, afterPick.planned, afterPick.open], [beforePick.total, beforePick.booked, beforePick.planned + 1, beforePick.open - 1], `${JSON.stringify(beforePick)} → ${JSON.stringify(afterPick)}`);
  assert.ok(afterPick.planPct > beforePick.planPct && afterPick.bookedPct === beforePick.bookedPct, "the planned share rises with what is chosen, the booked one waits (a draft left both alone)");
  // F2, v82: a chosen flight is its ticket: "Seçildi" on its chip, what one pays and how many go, "✓ Aldım" its main button (no page
  // to buy it on), the frame solid. (C16: no warning line under the route; the days left are Hazırlık's.)
  assert.equal(flat([await pegBox.locator(".q-st").innerText()])[0], "Seçildi");
  assert.match(flat([await pegBox.locator(".z-top .q-pr").innerText()])[0], /^€\d+ kişi başı · 2 kişi €\d+$/);
  assert.equal(await pegBox.locator(".z-bt").getByRole("button", { name: "✓ Aldım" }).count(), 1, "✓ Aldım is its main button");
  assert.equal(await pegBox.locator(".z-tk").evaluate((el) => getComputedStyle(el).borderTopStyle), "solid", "Seçildi: a solid frame, no dashes");
  // Ayarlandı: ⋯ "Ben hallettim" makes the ticket grey, nothing left to do (no ✓ Aldım); "Ayarlandı: geri al" takes that back.
  await pegBox.locator(".z-h .z-mb").click();
  await pegBox.getByRole("menuitem", { name: "Ben hallettim" }).click();
  await pegBox.locator(".z-top .z-gr", { hasText: "Ayarlandı" }).waitFor();
  assert.equal(await pegBox.getAttribute("data-st"), "arr", "Ayarlandı is grey");
  assert.equal(await pegBox.locator(".z-bt").getByRole("button", { name: "✓ Aldım" }).count(), 0, "Ayarlandı: nothing left to do");
  await pegBox.locator(".z-h .z-mb").click();
  await pegBox.getByRole("menuitem", { name: "Ayarlandı: geri al" }).click();
  await pegBox.locator(".z-bt").getByRole("button", { name: "✓ Aldım" }).waitFor();
  // Porto chosen, Lisbon booked: in the itinerary the transfers lay themselves out (the saved train is
  // the move, with a station transfer on each side), and the way home says what's easy to miss.
  await tab("Gün gün").click();
  // Landing 10:05: the transfer then, check-in from 14:00 as the page says.
  const arrive = dayCard(1).locator('.dg-tl > li[data-title="Havalimanı transferi"]');
  assert.equal(await arrive.locator(".t").innerText(), "~10:50"); // landing 10:05 + 45 min out of the airport
  assert.match(await arrive.innerText(), /planlanmadı/);
  assert.equal(await dayCard(1).locator('.dg-tl > li[data-title="Check-in · Jardim Stay"] .t').innerText(), "14:00");
  assert.equal(flat(await dayCard(1).locator(".dg-n").allInnerTexts())[0], "Gece: Porto · Jardim Stay");
  // Two transfers read the same ("Transfer"): the route is on the transfer's card on the Plan (a line stays short, 0.36.27).
  // A transfer with no plan opens right under its line: what's easy to miss, how to go.
  await arrive.locator(".dg-main").click();
  await arrive.locator(".leg-note", { hasText: "Varış 10:05, giriş en erken 14:00 (sayfada yazıyor)" }).waitFor();
  // "Metroyla gideceğim": nothing to book, so the transfer becomes a plan, its way as which.
  await arrive.getByRole("button", { name: "🚇 Metro" }).click();
  await dayCard(1).locator('.dg-tl > li[data-title="Havalimanı transferi · Metro"]').waitFor();
  await dayCard(1).scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/5-legs.png` });
  // A narrow window: nothing spills out sideways.
  const wide = app.viewportSize();
  await app.setViewportSize({ width: 820, height: 900 });
  await dayCard(4).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll");
  await app.setViewportSize(wide);
  // Back on the plan, without the train Porto → Lizbon is a move to plan: by plane it reads as a flight, with its status on it.
  await tab("Plan").click();
  // "Çıkar" in the ⋯: it leaves the options and waits at the end of its category, under "Gizlenenler · 1" (F3).
  // v82 (B2): the one train saved is our pick on its ticket; its ⋯ is that option's.
  await openSec("transport");
  const train = sec("transport").locator(".q-ints > .q-int", { has: app.locator(".z-car", { hasText: "Alfa Pendular" }) });
  assert.equal(flat([await train.locator(".q-st").innerText()])[0], "✨ Önerimiz · onayla");
  // Tren adlandırma (v81): the operator's mark, the service bold, the operator small; the plan's cities big, the stations under them.
  assert.equal(flat([await train.locator(".z-car").innerText()])[0], "CP Alfa Pendular CP · 11 Ekim");
  assert.match(flat([await train.locator(".z-route").innerText()])[0], /^Porto Porto Campanhã · 13:09 .*aktarmasız Lizbon Lisboa Santa Apolónia · 16:04$/);
  assert.equal(Math.round((await train.boundingBox()).height), 288);
  await train.locator(".z-h .z-mb").click();
  await train.getByRole("menuitem", { name: "Çıkar" }).click();
  await sec("transport").locator(".q-hid > summary", { hasText: "Gizlenenler · 1" }).click();
  // v82 (F3): its only option ruled out, its need folds down there as its head ("Gerek yok dedin · Geri al").
  const ruledOut = sec("transport").locator('.q-hid .q-int.skip[data-hidden^="need:"]');
  assert.match(flat([await ruledOut.locator(".q-nm").innerText()])[0], /^Tren/);
  assert.match(await ruledOut.locator(".q-skipl").innerText(), /Gerek yok dedin/);
  await ruledOut.locator(".q-undo").waitFor();
  assert.equal(await app.locator(".row-name", { hasText: /Elenenler/ }).count(), 0);
  // Nothing said for the change of city now (C15): Aranıyor, "Nasıl gideceğin belli değil", its ways drawn where the route
  // would be (Tren · Otobüs · Araba · Uçak · Ben hallettim), the sites that compare every way under "Kendin ara".
  const moveOf = (id) => sec(id).locator(".q-ints > .q-int", { has: app.locator(".q-nm", { hasText: "Porto → Lizbon" }) });
  const move = moveOf("transport");
  await move.locator(".z-ways").waitFor();
  assert.equal(await move.getAttribute("data-st"), "todo");
  assert.match(flat([await move.locator(".z-car").innerText()])[0], /^Nasıl gideceğin belli değil/);
  assert.deepEqual(flat(await move.locator(".z-way").allInnerTexts()), ["Tren", "Otobüs", "Araba", "Uçak", "Ben hallettim"]);
  assert.equal(await move.locator('.z-pi[aria-label="Rome2rio\'da ara"]').getAttribute("href"), "https://www.rome2rio.com/map/Porto/Lizbon");
  assert.equal(Math.round((await move.boundingBox()).height), 288, "the ways in the frame: the box stays 288 px");
  await move.locator(".z-way", { hasText: "Uçak" }).click();
  // By plane it's a flight: it leaves Ulaşım for Uçuş, and the plan follows it there with a flash.
  const flown = moveOf("flight");
  await sec("flight").locator(".q-ints > .q-int.flash", { has: app.locator(".q-nm", { hasText: "Porto → Lizbon" }) }).waitFor();
  assert.equal(await moveOf("transport").count(), 0, "a flight never sits in Ulaşım");
  assert.equal(flat([await flown.locator(".q-st").innerText()])[0], "Seçildi");
  assert.equal(await flown.getAttribute("data-kind"), "flight");
  // Its way said, its ticket still to buy: the flight's sites under "Kendin ara", "✓ Aldım" and Değiştir (back to the ways).
  assert.match(decodeURIComponent(await flown.locator('.z-pi[aria-label="Google Uçuşlar\'da ara"]').getAttribute("href")), /^https:\/\/www\.google\.com\/travel\/flights\?q=Flights from OPO to LIS on 2026-10-11/);
  await flown.getByRole("button", { name: "Değiştir" }).waitFor();
  await flown.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/5d-move.png` });
  await flown.getByRole("button", { name: "Aldım" }).click();
  await flown.locator(".z-top", { hasText: "Bilet alındı" }).waitFor();
  // By plane there's an airport at each end: the itinerary's day 4 now has them, around the flight.
  await tab("Gün gün").click();
  await dayCard(4).locator('.dg-tl > li[data-title="Havalimanı transferi"]').nth(1).waitFor();
  assert.deepEqual(await dayTitlesOf(4), ["Check-out · Jardim Stay", "Havalimanı transferi", "Uçuş · Porto → Lizbon", "Havalimanı transferi", "Check-in · Lisboa Loft"]);
  await lineOf(4, "Uçuş · Porto → Lizbon").locator(".dg-lab", { hasText: "Bilet alındı" }).waitFor();
  await tab("Plan").click();
  // What still needs booking without a day: Etkinlikler's "Tarihsiz · Porto", one card under another (Majestic
  // Café, a café with no booking, is a restaurant card instead).
  // (Lizbon, with no activity yet, is an empty card on its own line after them: .ek-line.)
  // v82: the ideas, cards in their city's Öneriler ("+ Plana koy").
  await openSec("activity");
  const actTiles = sec("activity").locator('[data-row="ideas"] > .z-k[data-item-id]');
  assert.deepEqual(await actTiles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), ["Livraria Lello", "Serralves Müzesi", "Tiyatro"]);
  await actTiles.first().locator(".q-pick", { hasText: "+ Plana koy" }).waitFor();
  assert.equal(await app.locator(".pk-card", { hasText: "Majestic Café" }).count(), 0);
  await openSec("todo");
  await sec("todo").locator('.z-k[aria-label="Majestic Café"]').waitFor();
  assert.equal(await app.locator(".crash").count(), 0, "board crashed after chat updates");
  await openSec("activity");
  await app.screenshot({ path: `${out}/5-chosen.png` });
  // 4b. Plan cards: a file on a card, delete + undo (the file comes back), add from a template, narrow.
  const douroCard = () => app.locator('.z-k[aria-label="Douro tekne turu"]');
  await douroCard().locator("input.pk-file").first().setInputFiles({ name: "bilet.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });
  // v82: its file opens from the card's foot ("Bileti aç", where the site's link was); the file's name on hover (0.36.20).
  const pill = douroCard().locator('.q-open[title^="bilet.pdf"]', { hasText: "Bileti aç" });
  await pill.waitFor();
  const [docTab] = await Promise.all([context.waitForEvent("page"), pill.click()]);
  assert.match(docTab.url(), /^blob:chrome-extension:\/\//);
  await docTab.close();
  await douroCard().getByRole("button", { name: "Douro tekne turu: diğer" }).click();
  await app.locator(".z-kpop").getByRole("menuitem", { name: "Sil" }).click();
  await douroCard().waitFor({ state: "detached" });
  // Round 2: the toast carries a ring that empties over the 8 seconds; the button works as before.
  {
    const toast = app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" });
    const ring = toast.locator(".pk-undo-ring .run");
    await ring.waitFor();
    assert.equal(await ring.evaluate((el) => getComputedStyle(el).animationDuration), "8s", "the ring runs for the 8 seconds of the undo");
    await app.waitForTimeout(350);
    await app.screenshot({ path: `${out}/37d-undo-ring.png` });
  }
  await app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().locator('.q-open[title^="bilet.pdf"]').waitFor();
  // v82 (B6): "+ Yeni ihtiyaç ekle" at the plan's end opens every kind.
  await app.locator(".q-addall").click();
  const sheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  await sheet.getByRole("button", { name: "Otobüs", exact: true }).waitFor();
  await app.screenshot({ path: `${out}/4d-add-sheet.png` });
  // 0.33: a tile adds at once, no form; the card opens with its first empty field ready, Tab goes on.
  await sheet.getByRole("button", { name: "Otobüs", exact: true }).click();
  await sheet.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Otobüs eklendi" }).waitFor();
  const box = (label) => app.locator(`.pk-ed-input[aria-label="${label}"]`);
  for (const [label, value] of [["Nereden", "Lizbon"], ["Nereye", "Lagos"], ["Tarih", "2026-10-13"], ["Saat", "10:00"]]) {
    await box(label).fill(value);
    await box(label).press("Tab");
  }
  await box("Fiyat").fill("18");
  await box("Fiyat").press("Enter");
  await box("Fiyat").waitFor({ state: "detached" });
  // v82: the bus is its ticket box in Ulaşım, its ends and hour edited where they stand (C2).
  const bus = sec("transport").locator(".q-ints > .q-int", { has: app.locator(".q-nm", { hasText: "Lizbon → Lagos" }) });
  await bus.locator(".z-top .q-pr", { hasText: "18" }).waitFor();
  assert.equal(await bus.locator(".z-h .z-kind").innerText(), "Otobüs");
  assert.match(flat([await bus.locator(".z-route").innerText()])[0], /^Lizbon 10:00 .*Lagos$/);
  await bus.locator(".z-bt").getByRole("button", { name: "✓ Aldım" }).waitFor();
  assert.equal(flat([await bus.locator(".q-st").innerText()])[0], "Seçildi", "H1: a chosen ride says Seçildi in words");
  assert.equal(await bus.getAttribute("data-st"), "sel", "chosen: the sand ground");
  assert.equal(Math.round((await bus.boundingBox()).height), 288);
  // The panel scrolls inside the page, so a tall window shows the whole plan in one picture.
  await app.setViewportSize({ width: 1440, height: 2600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4b-plan-cards.png` });
  // Below 860 px the board is one column; at 560 px the panel is under 620 px and the narrow card layout applies.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4c-plan-cards-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow board");
  await app.setViewportSize({ width: 1440, height: 900 });
  // The approved mockups beside the screenshots, for a side-by-side look.
  const ref = await context.newPage();
  for (const name of ["2026-10-05-ulasim-v3", "2026-10-05-etkinlik-v4"]) {
    await ref.goto(pathToFileURL(path.resolve(`docs/mockups/${name}.html`)).href);
    await ref.screenshot({ path: `${out}/ref-${name}.png`, fullPage: true });
  }
  await ref.close();
  console.log("✓ plan cards: a file opens in a tab, delete + undo brings the card and its file back, a bus added from the template, narrow board");

  // 4e. 0.32: a flight stays a flight once its airport transfer is a taxi; × on hover (a card, a stay) with
  // "Geri al"; "+" in each section with its kind, city and day; Yapılacak şeyler and Restoranlar.
  // v82: the airport transfer said by metro in the itinerary above is its ticket in Ulaşım: "Ayarlandı · rezervasyon gerekmez"
  // (nothing to book), the airport its one word with its code and city under it, the way on its carrier line. Değiştir brings
  // back its ways where the route would be (Metro · Otobüs · Tren · Taksi · Transfer · Ben hallettim, as its old card's
  // chips); "Taksi" says it, its day stays on its head, the box its size.
  await openSec("transport");
  const arrivalLeg = sec("transport").locator(".q-ints > .q-int", { has: app.locator(".q-nm", { hasText: "Havalimanı →" }) }).first();
  assert.equal(await arrivalLeg.getAttribute("data-st"), "arr", "a way said with nothing to book: Ayarlandı");
  assert.equal(flat([await arrivalLeg.locator(".z-h .z-kind").innerText()])[0], "Metro");
  assert.match(flat([await arrivalLeg.locator(".z-top").innerText()])[0], /Ayarlandı rezervasyon gerekmez/);
  assert.match(flat([await arrivalLeg.locator(".z-route").innerText()])[0], /^Havalimanı OPO · Porto /);
  const transferSize = await arrivalLeg.boundingBox();
  await arrivalLeg.getByRole("button", { name: "Değiştir" }).click();
  await arrivalLeg.locator(".z-ways").waitFor();
  assert.deepEqual(flat(await arrivalLeg.locator(".z-way").allInnerTexts()), ["Metro", "Otobüs", "Tren", "Taksi", "Transfer", "Ben hallettim"]);
  assert.equal(await arrivalLeg.locator('.z-way[aria-pressed="true"]').innerText(), "Metro", "the way said is marked");
  assert.match(flat([await arrivalLeg.locator(".z-h .q-ln").innerText()])[0], /8 Eki/);
  await arrivalLeg.locator(".z-way", { hasText: "Taksi" }).click();
  await arrivalLeg.locator(".z-h .z-kind", { hasText: "Taksi · transfer" }).waitFor();
  await arrivalLeg.locator(".z-ways").waitFor({ state: "detached" });
  const transferNow = await arrivalLeg.boundingBox();
  assert.equal(Math.round(transferNow.height), Math.round(transferSize.height), "the box is the size it was");
  await app.screenshot({ path: `${out}/37i-peek-transfer.png` });
  await openSec("flight");
  const inbound = sec("flight").locator(".q-ints > .q-int", { has: app.locator(".z-car", { hasText: "Pegasus" }) });
  assert.equal(await inbound.getAttribute("data-kind"), "flight", "a flight stays a flight once its airport transfer is a taxi");
  assert.match(flat([await inbound.locator(".z-car").innerText()])[0], /Pegasus PC 1201 · 8 Ekim/, "F2: the ticket's head names the airline and the day");
  assert.match(flat([await inbound.locator(".z-route").innerText()])[0], /^İstanbul IST · 07:10 .*Porto OPO · 10:05$/);
  await app.setViewportSize({ width: 1440, height: 1400 });
  await inbound.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4e-flight-after-taxi.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  // × on hover: a plan card, then a stay; v11: "Gerek yok" (hidden under Gizlenenler, not deleted); each comes back with "Geri al".
  // Read after the .15s fade.
  const opacity = (loc) => loc.evaluate((el) => new Promise((done) => setTimeout(() => done(getComputedStyle(el).opacity), 300)));
  await openSec("activity");
  await douroCard().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douroCard().hover();
  assert.equal(await opacity(douroCard().locator(".q-rm")), "1");
  await app.screenshot({ path: `${out}/4f-hover-x.png` });
  // v30: on a plan card the × folds it in place and asks why; "Gerek yok" is what hides it (Geri al on the fold keeps it).
  // v82 (E §2.6): a row's card has × "Plandan çıkar" (back to the ideas, quietly) and "Gerek yok" in its ⋯ (hidden, Geri al).
  const foldNo = () => app.locator(".pk-fold").getByRole("button", { name: "Gerek yok", exact: true }).click();
  await douroCard().getByRole("button", { name: "Douro tekne turu: plandan çıkar" }).click();
  await sec("activity").locator('[data-row="ideas"] .z-k[aria-label="Douro tekne turu"]').waitFor();
  await douroCard().getByRole("button", { name: "+ Plana koy" }).click();
  await sec("activity").locator('[data-row="plan"] .z-k[aria-label="Douro tekne turu"]').waitFor();
  await douroCard().locator(".z-kmb").click();
  await app.locator(".z-kpop").getByRole("menuitem", { name: "Gerek yok", exact: true }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu: gerek yok, gizlendi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().waitFor();
  // A way of travel the same, from its ⋯ (v82, B13: the ×'s "Gerek yok" and "Ben hallettim" are the menu's): Gerek yok folds it
  // under Gizlenenler, the toast's Geri al brings it back; "Ben hallettim" keeps it on the plan as Ayarlandı (grey, nothing left
  // to do); "Ayarlandı: geri al" takes that back.
  await openSec("transport");
  await bus.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await bus.locator(".z-h .z-mb").click();
  await bus.getByRole("menuitem", { name: "Gerek yok" }).click();
  await bus.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Lagos" }).getByRole("button", { name: "Geri al" }).click();
  await bus.waitFor();
  await bus.locator(".z-h .z-mb").click();
  await bus.getByRole("menuitem", { name: "Ben hallettim" }).click();
  await bus.locator(".z-top .z-gr", { hasText: "Ayarlandı" }).waitFor();
  assert.equal(await bus.getAttribute("data-st"), "arr");
  await bus.locator(".z-h .z-mb").click();
  await bus.getByRole("menuitem", { name: "Ayarlandı: geri al" }).click();
  await bus.locator(".z-top .z-gr").waitFor({ state: "detached" });
  // v82: an intent's ⋯ has Ayrıntı, Ben hallettim and Gerek yok (B13), then what its card's ••• had (C21): Seçimi geri al, Değiştir's
  // way back to the options is in the frame. "Gerek yok" folds the body and the box goes under Gizlenenler (F3, E7); "Geri al" brings it back.
  await openSec("stay");
  const jardim = sec("stay").locator('.q-ints > .q-int[data-st="sel"]', { has: app.locator(".z-t", { hasText: "Jardim Stay" }) });
  const menuOf = (box) => box.locator(".z-h .z-mb");
  await menuOf(jardim).click();
  const jardimMenu = flat(await jardim.getByRole("menuitem").allInnerTexts());
  assert.deepEqual(jardimMenu.slice(0, 3), ["Ayrıntı", "Ben hallettim", "Gerek yok"], JSON.stringify(jardimMenu));
  assert.ok(jardimMenu.includes("Seçimi geri al") && jardimMenu.includes("Sil"), `C21: the card's own entries (${jardimMenu})`);
  await app.keyboard.press("Escape");
  await jardim.getByRole("menu").waitFor({ state: "detached" });
  await menuOf(jardim).click();
  await jardim.getByRole("menuitem", { name: "Gerek yok" }).click();
  await jardim.waitFor({ state: "detached" });
  assert.equal(await sec("stay").locator(".q-hid > summary").innerText(), "Gizlenenler · 2", "the nights said not needed wait under Gizlenenler");
  await app.locator(".pk-undo", { hasText: "Jardim Stay: gerek yok, gizlendi" }).getByRole("button", { name: "Geri al" }).click();
  await jardim.waitFor();
  // Rezerve edildi: its ⋯ has Belge ekle, İptal ettim, Sil; Sil asks first ("İptal ettiysen 'İptal ettim' de"), and nothing goes
  // when the answer is no; Gerek yok asks whether it was cancelled. İptal ettim takes it off the plan (its nights to find again),
  // Geri al brings the booking back.
  const loft = sec("stay").locator('.q-ints > .q-int[data-st="ok"]', { has: app.locator(".z-t", { hasText: "Lisboa Loft" }) });
  await loft.scrollIntoViewIfNeeded();
  // A booking says so in its chip and its first line (v82), with the stamp on its picture.
  assert.equal(flat([await loft.locator(".q-st").innerText()])[0], "Rezerve");
  assert.match(await loft.locator(".z-l1").innerText(), /Rezerve edildi/);
  await menuOf(loft).click();
  const loftMenu = flat(await loft.getByRole("menuitem").allInnerTexts());
  for (const want of ["Rezervasyonu geri al", "Belge ekle", "İptal ettim", "Sil"]) assert.ok(loftMenu.includes(want), `${want} in a booking's ⋯ (${loftMenu})`);
  // v11: the board's own window asks, not the browser's confirm().
  const ask = app.getByRole("alertdialog");
  await loft.getByRole("menuitem", { name: "Sil" }).click();
  assert.match(await ask.innerText(), /Bu rezervasyon onaylı/, "deleting a booking asks first");
  await ask.getByRole("button", { name: "Vazgeç" }).click();
  await ask.waitFor({ state: "detached" });
  assert.equal(await loft.count(), 1, "no: it stays");
  // Its Gerek yok asks too: "İptal ettin mi?" ("İptal ettim, kaldır" cancels it); Escape leaves it.
  await menuOf(loft).click();
  await loft.getByRole("menuitem", { name: "Gerek yok" }).click();
  assert.match(await ask.innerText(), /Bu rezervasyon onaylı[\s\S]*iptal ettin mi\?[\s\S]*İptal ettim, kaldır/);
  await app.keyboard.press("Escape");
  await ask.waitFor({ state: "detached" });
  assert.equal(await loft.count(), 1, "Vazgeç: it stays");
  await menuOf(loft).click();
  await loft.getByRole("menuitem", { name: "İptal ettim" }).click();
  await loft.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Lisboa Loft iptal edildi" }).getByRole("button", { name: "Geri al" }).click();
  await loft.waitFor();
  // v11: no "+" between the cards (the drawing has none); v82: a category adds its own kind at its end ("+ Ulaşım ekle").
  const sectionAdd = async (id) => (await openSec(id)).locator(".q-fold .q-add");
  // The "+" by a card adds there (its day and city); out of sight until the card is pointed at. v82 (C3): under a stay,
  // a thin "+ Buraya ekle" in the gap before the next box.
  const plus = (scope) => scope.locator(".pk-insert button").first();
  const here = (box) => box.locator(".q-here button");
  await openSec("stay");
  await app.mouse.move(0, 0);
  await app.waitForTimeout(400); // (the + fades out; read after the fade)
  assert.equal(await sec("stay").locator(".q-ints > .q-int > .q-here").first().evaluate((el) => getComputedStyle(el).opacity), "0", "no + on the drawing until pointed at");
  assert.equal(await sec("stay").locator(".pk-insert").count(), 0, "v82: the intents have no card's +");
  await (await sectionAdd("transport")).click();
  const only = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  assert.equal(await only.getByRole("button", { name: "Otel", exact: true }).count(), 0, "a section's + offers only its own kinds");
  await only.getByRole("button", { name: "Otobüs", exact: true }).waitFor();
  await only.getByRole("button", { name: "Kapat" }).click();
  // One kind (Uçuş, Etkinlikler): added at once, there; "Geri al" takes it away.
  // (a card, or a box in a category drawn the new way)
  const cardCount = () => app.locator(".cat-card, .q-ints > .q-int").count();
  await openSec("flight");
  let before = await cardCount();
  await (await sectionAdd("flight")).click();
  await app.waitForFunction((n) => document.querySelectorAll(".cat-card, .q-ints > .q-int").length === n + 1, before);
  await app.locator(".pk-undo", { hasText: "Uçuş eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await app.waitForFunction((n) => document.querySelectorAll(".cat-card, .q-ints > .q-int").length === n, before);
  await openSec("activity");
  before = await cardCount();
  await sec("activity").getByRole("button", { name: "Etkinlik ve turlar: ekle" }).click();
  await box("Ad").waitFor();
  await box("Ad").press("Escape");
  await app.locator(".pk-undo", { hasText: "Etkinlik · tur eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await app.waitForFunction((n) => document.querySelectorAll(".cat-card, .q-ints > .q-int").length === n, before);
  // On a day of the itinerary: that day and its city. A to-do added there is a thin line of the day.
  await tab("Gün gün").click();
  // Day 3 is empty ("boş gün"): its row has the "+".
  await dayCard(3).getByRole("button", { name: "10 Ekim: bu güne ekle" }).click();
  const addSheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  assert.equal(await addSheet.locator("header span").innerText(), "Porto · 10 Ekim");
  // 0.34: added at once on the Plan, in Yapılacak şeyler (a section of its own now), its title ready.
  await addSheet.getByRole("button", { name: "Yapılacak", exact: true }).click();
  await addSheet.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Yapılacak eklendi" }).waitFor();
  await tab("Plan").and(app.locator('[aria-selected="true"]')).waitFor();
  await box("Ad").fill("Bolhão pazarı");
  await box("Ad").press("Enter");
  await sec("todo").locator('[data-row="plan"] .z-k[aria-label="Bolhão pazarı"]').waitFor();
  await tab("Gün gün").click();
  // An idea without an hour is a line of the day like the rest (0.35.6), never hidden.
  await dayCard(3).locator(".dg-tl > li.idea", { hasText: "Bolhão pazarı" }).waitFor();
  // v11 phase 4: Yapılacak şeyler as tiles, restaurants with the things to do; no quick box (the chat adds: the run
  // writes three ideas as the chat would), no day here (Gün gün's "Planda, günü yok" gives it); the rest in the •••.
  await tab("Plan").click();
  const todos = await openSec("todo");
  assert.equal(await todos.getByRole("textbox", { name: "Bir şey yaz" }).count(), 0, "no quick box: the chat adds");
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(["trips", "items"], "readwrite");
    const trips = await new Promise((resolve) => (tx.objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tripId = trips.find((t) => t.title === "Portekiz (örnek)").id;
    const now = Date.now();
    const base = (over) => ({
      tripId, captureIds: [], key: null, provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, country: null, countryCode: null,
      location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "unverified" }, guests: { adults: null, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], statusNote: null, createdAt: now, updatedAt: now, origin: "chat", booking: "none", ...over,
    });
    const items = tx.objectStore("items");
    items.put(base({ id: "e2e-nata", category: "food", needKey: "food:lizbon", name: "Pastel de nata", city: "Lizbon", status: "saved", plannedKind: "food" }));
    items.put(base({ id: "e2e-sunset", category: "activity", needKey: "activity:porto", name: "Dom Luís köprüsünden gün batımı", city: "Porto", status: "saved", plannedKind: "todo" }));
    items.put(base({ id: "e2e-lello", category: "activity", needKey: "activity:porto", name: "Livraria Lello, giriş bileti var", city: "Porto", status: "saved", plannedKind: "todo" }));
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const food = todos;
  const tile = (name) => todos.locator(`.z-k[aria-label="${name}"]`);
  await tile("Pastel de nata").waitFor();
  const names = (loc) => loc.locator(".z-k[data-item-id]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  assert.deepEqual(await names(todos), ["Bolhão pazarı", "Majestic Café", "Dom Luís köprüsünden gün batımı", "Livraria Lello, giriş bileti var", "Pastel de nata"]);
  // v82 (C20): by city in trip order, one box each; Planında's head has Hepsi · Gezilecek · Restoranlar, with their numbers.
  const portoTodo = todos.locator('.q-int.multi[data-intent="todo:Porto"]');
  assert.deepEqual(flat(await portoTodo.locator(".z-fchips button[aria-pressed]").allInnerTexts()), ["Hepsi 4", "Gezilecek 3", "Restoranlar 1"]);
  assert.deepEqual(flat(await todos.locator('.q-int.multi[data-intent="todo:Lizbon"] .z-fchips button').allInnerTexts()), ["Hepsi 1", "Gezilecek 0", "Restoranlar 1"]);
  // What's on the plan first (Planında), the ideas after (Öneriler, "+ Plana koy").
  assert.deepEqual(await names(portoTodo.locator('[data-row="plan"]')), ["Bolhão pazarı"]);
  await portoTodo.locator(".z-fchips button", { hasText: "Restoranlar" }).click();
  assert.deepEqual(await names(portoTodo), ["Majestic Café"]);
  assert.equal(flat([await portoTodo.locator('.z-fchips button[aria-pressed="true"]').innerText()])[0], "Restoranlar 1");
  await portoTodo.locator(".z-fchips button", { hasText: "Hepsi" }).click();
  assert.deepEqual(await names(portoTodo), ["Bolhão pazarı", "Majestic Café", "Dom Luís köprüsünden gün batımı", "Livraria Lello, giriş bileti var"]);
  // The header counts places, restaurants and what's on the plan; no bar, no amber line.
  assert.match(flat([await todos.locator(".q-kw").innerText()])[0], /^Gezilecek yerler ve restoranlar · \d+ fikir$/);
  assert.match(flat([await todos.locator(".q-pl1").innerText()])[0], /^1 planda/);
  assert.equal(await todos.locator(".cat-wait").count(), 0);
  // The •••: a card's ⋯, its menu over the page (C20: Yaptım, Haritada aç, taşı, Daha fazla öner).
  const tileMenu = async (t, label) => {
    // A card's ⋯ opens over the page; Hazırlık's row keeps its own menu (C29).
    if (await t.locator(".z-kmb").count()) {
      await t.locator(".z-kmb").click();
      await app.locator(".z-kpop").getByRole("menuitem", { name: label, exact: true }).click();
      return;
    }
    await t.getByRole("button", { name: "Kart menüsü" }).click();
    await t.getByRole("menuitem", { name: label }).click();
  };
  // A place's map: its "Haritada aç" opens it in a new tab (window.open is watched here: no page is loaded offline).
  const openedBy = async (run) => {
    await app.evaluate(() => {
      window.__opened = [];
      window.__open = window.open;
      window.open = (url) => (window.__opened.push(String(url)), null);
    });
    await run();
    return app.evaluate(() => ((window.open = window.__open), window.__opened));
  };
  const majestic = tile("Majestic Café");
  const mapOpened = await openedBy(() => tileMenu(majestic, "Haritada aç"));
  assert.equal(mapOpened.length, 1);
  assert.match(mapOpened[0], /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=41\.1471%2C-8\.6066$/);
  await majestic.locator(".z-kmb").click();
  // 0.39.0: no "Adını değiştir" (the chat corrects a name; Emre).
  assert.deepEqual(await app.locator(".z-kpop .z-mi").allInnerTexts(), ["Gittim", "Haritada aç", "Daha fazla öner", "Sil"]);
  await app.keyboard.press("Escape");
  await app.locator(".z-kpop").waitFor({ state: "detached" });
  assert.equal(await majestic.locator(".z-kmb").evaluate((el) => el === document.activeElement), true, "Escape closes the menu and the focus goes back to ⋯");
  // "+ Plana koy" ↔ "✓ Planda": it goes to Planında.
  await majestic.getByRole("button", { name: "+ Plana koy" }).click();
  await portoTodo.locator('[data-row="plan"] .z-k[aria-label="Majestic Café"] .z-okc', { hasText: "Planda" }).waitFor();
  // Its day in Gün gün: under Porto's days, "Tarihsiz" (0.38.7: not a strip above the days), a day and a meal, then it's on that day.
  await tab("Gün gün").click();
  const undated = app.locator(".dg-und", { hasText: "Tarihsiz" });
  const majesticUndated = undated.locator(".dg-und-row", { hasText: "Majestic Café" });
  assert.equal(await app.locator(".ud-strip").count(), 0, "no strip of the undated above the days");
  await majesticUndated.getByRole("button", { name: "+ Güne ekle" }).click();
  await majesticUndated.getByRole("radio", { name: "öğle" }).click();
  await majesticUndated.getByRole("dialog", { name: "Hangi gün?" }).getByRole("button", { name: /^9 Eki/ }).click();
  await majesticUndated.waitFor({ state: "detached" });
  await tab("Plan").click();
  await majestic.locator(".q-day", { hasText: "9 Eki öğle" }).waitFor();
  // "Gün ver ›" on the Plan too (row 119): the trip's days with the city slept in; Escape closes it, the focus goes back.
  const market0 = tile("Bolhão pazarı");
  await market0.locator(".q-day", { hasText: "10 Eki" }).click();
  const dayWin = app.getByRole("dialog", { name: "Hangi gün?" });
  assert.match(await dayWin.innerText(), /9 Eki[\s\S]*Porto/);
  await app.keyboard.press("Escape");
  await dayWin.waitFor({ state: "detached" });
  await market0.locator(".q-day", { hasText: "10 Eki" }).click();
  await dayWin.getByRole("button", { name: /^9 Eki/ }).click();
  await market0.locator(".q-day", { hasText: "9 Eki" }).waitFor();
  await market0.locator(".q-day").click();
  await dayWin.getByRole("button", { name: /^10 Eki/ }).click();
  await market0.locator(".q-day", { hasText: "10 Eki" }).waitFor();
  // 0.39.0: a name isn't edited where it stands (no pencil, no name to press or Tab to; the chat corrects it).
  assert.equal(await majestic.locator(".z-t .pk-ed").count(), 0, "no pencil on the tile's name");
  assert.equal(await majestic.getByRole("button", { name: "Ad: düzenle" }).count(), 0, "no name to edit on the tile");
  const market = tile("Bolhão pazarı");
  await tileMenu(market, "Yaptım");
  await market.locator(".z-okc", { hasText: "Yapıldı" }).waitFor();
  // v82: the row's line is the category's summary (collectionSummary: its places and ideas); the done one says so on its card,
  // and the closed row counts it apart ("1 yapıldı").
  assert.match(flat([await todos.locator(".q-kw").innerText()])[0], /fikir$/);
  assert.match(flat([await todos.locator(".q-row1").innerText()])[0], /1 yapıldı/);
  await tileMenu(market, "Yapılmadı olarak geri al");
  await market.locator(".z-okc", { hasText: "Yapıldı" }).waitFor({ state: "detached" });
  const lello = tile("Livraria Lello, giriş bileti var");
  await app.setViewportSize({ width: 1440, height: 1400 });
  await todos.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4g-todo-food.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await todos.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4h-todo-food-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in Yapılacak şeyler");
  await app.setViewportSize({ width: 1440, height: 900 });
  // An idea deleted (its ⋯ "Sil"), then brought back.
  const sunset = tile("Dom Luís köprüsünden gün batımı");
  await sunset.hover();
  await tileMenu(sunset, "Sil");
  await sunset.waitFor({ state: "detached" });
  await app.locator(".pk-undo").getByRole("button", { name: "Geri al" }).click();
  await sunset.waitFor();
  await tileMenu(lello, "Etkinliklere taşı (bileti var)");
  await lello.waitFor({ state: "detached" });
  // The restaurant on its day is a thin line of the itinerary; the moved one is a booking in Etkinlikler.
  await tab("Gün gün").click();
  // Its meal is its NE: "Öğle yemeği · Majestic Café"; put on the plan ("Plana koy"), it's a line of the plan, not an idea.
  await dayCard(2).locator('.dg-tl > li[data-title="Öğle yemeği · Majestic Café"]').waitFor();
  await app.screenshot({ path: `${out}/4k-itinerary-032.png` });
  await tab("Plan").click();
  assert.match(await sec("activity").locator(".q-count").textContent(), /^\d+\/5$/);
  await openSec("activity");
  // A to-do moved to Etkinlikler is a thing to do with a ticket there, not a "Yapılacak".
  const lelloCard = sec("activity").locator('[data-item-id][aria-label="Livraria Lello, giriş bileti var"]');
  await lelloCard.waitFor();
  // The panel scrolls inside the page: scroll the list to the top, then take the window.
  await app.setViewportSize({ width: 1440, height: 1400 });
  await sec("activity").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4l-activities.png` });
  // v11: the tours and tickets come from the source as cards; with none (no offers here), each city's own searches ("Kendin ara"):
  // Porto's in its Öneriler head, Lizbon (nothing there yet) on its thin line; no empty card.
  assert.deepEqual(await sec("activity").locator('.q-int.multi[data-intent="activity:Porto"] .q-opts .z-pl').evaluateAll((els) => els.map((a) => a.getAttribute("href"))), [
    "https://www.getyourguide.com/s/?q=Porto",
    "https://www.viator.com/searchResults/all?text=Porto",
    "https://www.klook.com/search/result/?query=Porto",
  ]);
  assert.deepEqual(await sec("activity").locator('.q-gapl[data-city="Lizbon"] .z-pl').evaluateAll((els) => els.map((a) => a.getAttribute("href"))), [
    "https://www.getyourguide.com/s/?q=Lizbon",
    "https://www.viator.com/searchResults/all?text=Lizbon",
    "https://www.klook.com/search/result/?query=Lizbon",
  ]);
  assert.equal(await sec("activity").locator(".ek-card").count(), 0, "no empty card in Etkinlik ve turlar");
  // v82: the sites' chips (the prototype's "Kendin ara") carry their mark and name; a hover doesn't grow the line.
  {
    const row = sec("activity").locator('.q-gapl[data-city="Lizbon"]');
    const chip = row.locator(".z-pl").first();
    const h = (await row.boundingBox()).height;
    assert.match(await chip.innerText(), /GetYourGuide/);
    await chip.hover();
    await app.waitForTimeout(300);
    assert.equal((await row.boundingBox()).height, h, "the row doesn't grow");
    await app.screenshot({ path: `${out}/37e-self-chip.png` });
    await app.mouse.move(2, 2);
  }
  // B15: a booking with no file, its day two weeks away or less, says so (the Lisboa Loft, in six days: "belge yok").
  await openSec("stay");
  assert.ok((await app.locator(".cat-plan :is(.pk-docmiss, .z-docw)", { hasText: /belge yok/i }).count()) > 0, "a booking without its ticket says so");
  await openSec("activity");
  await app.setViewportSize({ width: 1440, height: 900 });
  // Narrow: the + and × are there without a hover.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.mouse.move(0, 0);
  assert.equal(await opacity(douroCard().locator(".z-kmb")), "1", "an activity card's tools are there without a hover when narrow");
  // v82: a city's rows keep their cells (two across here); nothing scrolls sideways, inside the rows or the page.
  // (v46's sideways-scrolling row is gone with the fixed four cells.)
  assert.ok(await sec("activity").locator('[data-row="plan"]').first().evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "a city's row fits its box");
  assert.ok(await app.locator(".panel").evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "no sideways scroll of the page");
  assert.equal(await opacity(douroCard().locator(".q-rm")), "1");
  await app.screenshot({ path: `${out}/4i-plan-narrow-032.png` });
  await app.setViewportSize({ width: 1440, height: 2600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4j-plan-032.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  const ref032 = await context.newPage();
  for (const name of ["2026-10-05-kategoriler-v2", "2026-10-05-kategoriler-v4", "2026-10-05-fikirler-v1", "2026-10-05-ulasim-v3", "2026-10-05-etkinlik-v4"]) {
    if (!existsSync(path.resolve(`docs/mockups/${name}.html`))) continue;
    for (const width of [1440, 560]) {
      await ref032.setViewportSize({ width, height: 900 });
      await ref032.goto(pathToFileURL(path.resolve(`docs/mockups/${name}.html`)).href);
      await ref032.screenshot({ path: `${out}/ref-${name}-${width}.png`, fullPage: true });
    }
  }
  await ref032.close();
  console.log("✓ 0.32: flight stays a flight after a taxi transfer; × + undo on a card, Gerek yok + undo on a stay (⋯); + with the category's kind, city and day; Yapılacak şeyler and Restoranlar: quick line, day + meal, done, moved to Etkinlikler, thin line in the day");

  // 4m. 0.33: a tile adds at once and the card opens for editing; Enter saves, Esc leaves it, Geri al takes it away;
  // a saved page's card corrected where it stands ("sayfadaki: … · geri al"); a transfer's ends short; × on night blocks.
  await tab("Plan").click();
  // v82: a way of travel is added at its category's end ("+ Ulaşım ekle"; a ticket has no "+" by it) → Otobüs: its box opens with
  // where it leaves from ready, Tab goes on to where it goes; Esc leaves a field as it was; "Geri al" takes it away.
  await (await sectionAdd("transport")).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otobüs", exact: true }).click();
  await box("Nereden").waitFor();
  assert.ok(await box("Nereden").evaluate((el) => el === document.activeElement), "the first empty field has the cursor");
  await app.screenshot({ path: `${out}/4m0-instant-add.png` });
  await box("Nereden").fill("Porto");
  await box("Nereden").press("Tab");
  await box("Nereye").fill("Braga");
  await box("Nereye").press("Escape");
  await box("Nereye").waitFor({ state: "detached" });
  // Left with nothing concrete on it (no hour, no price, no page): its Aranıyor ticket, from Porto, where it goes still to say.
  const portoBus = sec("transport").locator('.q-ints > .q-int[data-kind="bus"][data-st="todo"]');
  await portoBus.waitFor();
  assert.match(flat([await portoBus.locator(".z-route").innerText()])[0], /^Porto .*Nereye$/);
  assert.equal(await portoBus.locator(".z-top .q-pr").count(), 0, "no price on an empty ticket");
  await app.locator(".pk-undo", { hasText: "Otobüs eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await portoBus.waitFor({ state: "detached" });
  // The trip's dates, moved by hand (as the trip's own form would): the nights after the last stay are empty nights.
  const setEnd = (end) =>
    app.evaluate(async (end) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction("trips", "readwrite");
      const store = tx.objectStore("trips");
      const all = await new Promise((resolve) => (store.getAll().onsuccess = (e) => resolve(e.target.result)));
      const trip = all.find((t) => t.title === "Portekiz (örnek)");
      store.put({ ...trip, confirmedDates: { ...trip.confirmedDates, end } });
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, end);
  // v82 (C3): "+ Buraya ekle" under empty nights (the trip two nights longer) → Otel: their last night, its name ready in the
  // box's title (C2); its price and its check-in edit where they stand, the box the same height; the check-in moved keeps one night.
  await setEnd("2026-10-16");
  await openSec("stay");
  const nightsBox = (date) => sec("stay").locator(`.q-ints > .q-int[data-intent="stay:${date}"]`);
  await nightsBox("2026-10-14").waitFor();
  assert.equal(await nightsBox("2026-10-14").getAttribute("data-st"), "todo", "empty nights: Aranıyor");
  assert.equal(await nightsBox("2026-10-14").locator(".q-nm").innerText(), "Konaklama", "C19: never \"Konaklama yok\"");
  await nightsBox("2026-10-14").hover();
  await here(nightsBox("2026-10-14")).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otel", exact: true }).click();
  await box("Ad").fill("Casa do Rio");
  await box("Ad").press("Enter");
  const apart = sec("stay").locator(".q-ints > .q-int", { has: app.locator(".z-t", { hasText: "Casa do Rio" }) });
  await apart.waitFor();
  assert.equal(await apart.getAttribute("data-intent"), "stay:2026-10-15", "the last of the empty nights");
  assert.equal(await apart.getAttribute("data-st"), "sel");
  // The night before is spent on the flight home (TP 1760 leaves 14 Oct 19:40 and lands the next day, D14, aşama 3b): no bed
  // to find for it, so no box of its own.
  await nightsBox("2026-10-14").waitFor({ state: "detached" });
  assert.equal(await sec("stay").locator('.q-ints > .q-int[data-st="todo"]', { hasText: "14–15 Ekim" }).count(), 0, "D14: the night aboard is no empty night");
  await app.setViewportSize({ width: 1440, height: 1400 });
  await apart.scrollIntoViewIfNeeded();
  await apart.getByRole("button", { name: "Fiyat: düzenle" }).click();
  await box("Fiyat").fill("95");
  await app.screenshot({ path: `${out}/4m-inline-edit.png` });
  assert.equal(await apart.evaluate((el) => el.offsetHeight), 288, "editing, the box keeps its height");
  await box("Fiyat").press("Enter");
  await apart.locator(".z-top .q-pr b", { hasText: "€95" }).waitFor();
  await apart.getByRole("button", { name: "Giriş: düzenle" }).click();
  await box("Giriş").fill("2026-10-14");
  await box("Giriş").press("Enter");
  await sec("stay").locator('.q-int[data-intent="stay:2026-10-14"] .z-t', { hasText: "Casa do Rio" }).waitFor();
  assert.match(flat([await apart.locator(".q-ln").innerText()])[0], /1 gece\s*14–15 Ekim/);
  // Gerek yok (⋯): it folds into Gizlenenler and the toast's "Geri al" brings it back as it stood; Sil deletes it (its night empty again).
  await menuOf(apart).click();
  await apart.getByRole("menuitem", { name: "Gerek yok" }).click();
  await apart.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Casa do Rio: gerek yok, gizlendi" }).getByRole("button", { name: "Geri al" }).click();
  await apart.waitFor();
  await menuOf(apart).click();
  await apart.getByRole("menuitem", { name: "Sil" }).click();
  await apart.waitFor({ state: "detached" });
  await nightsBox("2026-10-14").waitFor();
  assert.equal(await nightsBox("2026-10-14").getAttribute("data-st"), "todo", "deleted: the nights are to find again");
  // A saved page's title isn't corrected where it stands any more (0.39.0, Emre: the chat corrects it): no pencil,
  // no focusable name; the title is plain text.
  await openSec("activity");
  const douroId = await douroCard().getAttribute("data-item-id");
  const douroPage = app.locator(`.z-k[data-item-id="${douroId}"]`);
  await douroPage.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douroPage.locator(".z-t", { hasText: "Douro tekne turu" }).waitFor();
  assert.equal(await douroPage.locator(".z-t .pk-ed").count(), 0, "no pencil on the title");
  assert.equal(await douroPage.locator(".z-t").getByRole("button", { name: "Ad: düzenle" }).count(), 0, "no name to edit");
  assert.equal(await app.locator('.pk-ed[aria-label^="Ad:"]').count(), 0, "no name editable anywhere on the Plan");
  await app.screenshot({ path: `${out}/4n-page-correction.png` });
  // A transfer's ends (F5a; v82 as the design's ticket): "Havalimanı" and "Booking.com" large, the airport's code and city
  // and the stay's name under them.
  await openSec("transport");
  assert.match(flat([await arrivalLeg.locator(".z-route").innerText()])[0], /^Havalimanı OPO · Porto .*Booking\.com Jardim Stay$/);
  // One word isn't broken in the middle ("Booking.co / m"): the end stays on one line.
  assert.ok(await arrivalLeg.locator(".z-route .q-city.r > b").evaluate((el) => el.getClientRects().length <= 1 && el.offsetHeight < 1.6 * parseFloat(getComputedStyle(el).fontSize)), "Booking.com on one line");
  // Empty nights (the trip two nights longer): ⋯ Gerek yok hides them, "Gizlenenler · n" brings them back (F3).
  await openSec("stay");
  const extra = nightsBox("2026-10-14");
  await extra.waitFor();
  await extra.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/4o-empty-nights.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await extra.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.mouse.move(0, 0);
  assert.ok(await menuOf(extra).isVisible(), "its ⋯ is there without a hover when narrow");
  await app.screenshot({ path: `${out}/4p-empty-nights-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with empty nights");
  await app.setViewportSize({ width: 1440, height: 1400 });
  await menuOf(extra).click();
  await extra.getByRole("menuitem", { name: "Gerek yok" }).click();
  await app.locator(".pk-undo", { hasText: "gizlendi" }).waitFor();
  await extra.waitFor({ state: "detached" }); // hidden nights leave the plan
  // They wait at the end of Konaklama, with the option the Lisboa Loft booking closed.
  assert.equal(await sec("stay").locator(".q-hid > summary").innerText(), "Gizlenenler · 2");
  await sec("stay").locator(".q-hid > summary").click();
  const nightsHead = sec("stay").locator(".q-hid .q-int.skip", { hasText: "Konaklama" });
  await sec("stay").locator(".q-hid").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/4q-hidden-open.png` });
  assert.match(flat([await nightsHead.innerText()])[0], /2 gece\s*14–16 Ekim/);
  await nightsHead.getByRole("button", { name: "Geri al" }).click();
  await extra.waitFor();
  await setEnd("2026-10-14");
  await extra.waitFor({ state: "detached" });
  await app.setViewportSize({ width: 1440, height: 900 });
  console.log("✓ 0.33: a tile adds at once and opens for editing (Tab, Enter, Esc, Geri al); a stay added with \"+ Buraya ekle\", edited in place (C2), moved, said not needed and deleted from its ⋯; a saved page corrected and taken back; short transfer ends; empty nights hidden and brought back");

  // 4q. 0.34: the Plan by category — every section open while something's left; closed, the header line
  // alone ("Etkinlikler 1/5 · 1 bilet yok"); the choice remembered for the trip; the header opens it again.
  await tab("Plan").click();
  // A market the chat said as an activity it "marked as booked" (stored by older versions as a booking),
  // a walk said as one, and a Maps pin with its photo: all three are things to do, the pin shows its photo.
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(["trips", "items"], "readwrite");
    const trips = await new Promise((resolve) => (tx.objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tripId = trips.find((t) => t.title === "Portekiz (örnek)").id;
    const now = Date.now();
    const base = (over) => ({
      tripId, captureIds: [], key: null, provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, country: null, countryCode: null,
      location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "unverified" }, guests: { adults: null, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], statusNote: null, createdAt: now, updatedAt: now, ...over,
    });
    const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#e9b872"/><stop offset="1" stop-color="#3f6e8c"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/><circle cx="58" cy="22" r="9" fill="#fff6d8"/></svg>')}`;
    const items = tx.objectStore("items");
    items.put(base({ id: "e2e-market", category: "activity", needKey: "activity:porto", name: "Porto Belo Pazarı", city: "Porto", status: "booked", origin: "chat", plannedKind: "activity", booking: "needed" }));
    items.put(base({ id: "e2e-walk", category: "activity", needKey: "activity:porto", name: "Outdoor alışverişi", city: "Porto", status: "chosen", origin: "chat", plannedKind: "activity", booking: "needed" }));
    items.put(base({ id: "e2e-pin", category: "activity", needKey: "activity:porto", name: "Jardins do Palácio de Cristal", city: "Porto", status: "saved", url: "https://maps.app.goo.gl/e2e", imageUrl: photo, booking: "none" }));
    items.put(base({ id: "e2e-reel", category: "activity", needKey: "activity:porto", name: "Ribeira'da gün batımı", city: "Porto", status: "saved", url: "https://www.instagram.com/reel/e2e/", imageUrl: photo, booking: "none" }));
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const todoRow = (name) => sec("todo").locator(`.z-k[aria-label="${name}"]`);
  await openSec("todo");
  await todoRow("Porto Belo Pazarı").waitFor();
  await todoRow("Outdoor alışverişi").waitFor();
  // 0.34.6: Yapılacak şeyler is what's done there; a chore said (in the chat, v11: no quick box) goes to Hazırlık.
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(["trips", "items"], "readwrite");
    const trips = await new Promise((resolve) => (tx.objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tripId = trips.find((t) => t.title === "Portekiz (örnek)").id;
    const now = Date.now();
    const base = (over) => ({
      tripId, captureIds: [], key: null, provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, country: null, countryCode: null,
      location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "unverified" }, guests: { adults: null, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], statusNote: null, createdAt: now, updatedAt: now, origin: "chat", booking: "none", status: "saved", ...over,
    });
    const items = tx.objectStore("items");
    items.put(base({ id: "e2e-rain", category: "other", needKey: "other:prep", name: "Decathlon'dan yağmurluk al", city: "Porto", plannedKind: "prep" }));
    items.put(base({ id: "e2e-sunset2", category: "activity", needKey: "activity:porto", name: "Dom Luís'te gün batımı", city: "Porto", plannedKind: "todo" }));
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await todoRow("Dom Luís'te gün batımı").waitFor();
  await openSec("prep");
  // v82 (aşama 7): Hazırlık's rows are the prototype's .q-pr1, the chores by their day.
  const prepRow = sec("prep").locator(`.q-pr1[aria-label="Decathlon'dan yağmurluk al"]`);
  await prepRow.waitFor();
  assert.equal(await app.locator(`.z-k[aria-label="Decathlon'dan yağmurluk al"]`).count(), 0, "a chore is never a thing to do");
  assert.equal(await sec("prep").locator(`.q-pr1[aria-label="Dom Luís'te gün batımı"]`).count(), 0, "an experience is never a chore");
  // Moved by hand both ways (0.35.9): "Hazırlığa taşı" on a thing to do; back from Hazırlık in the row's ⋯ (C29).
  // (v82: one category open at a time; the one moved to opens.)
  await openSec("todo");
  await todoRow("Dom Luís'te gün batımı").waitFor();
  assert.equal(await sec("todo").locator(`.z-k[aria-label="Decathlon'dan yağmurluk al"]`).count(), 0, "a chore is never a thing to do (Yapılacak şeyler open)");
  await tileMenu(todoRow("Dom Luís'te gün batımı"), "Hazırlık'a taşı");
  await todoRow("Dom Luís'te gün batımı").waitFor({ state: "detached" });
  await openSec("prep");
  const sunsetPrep = sec("prep").locator(`.q-pr1[aria-label="Dom Luís'te gün batımı"]`);
  await sunsetPrep.waitFor();
  await sunsetPrep.hover();
  await tileMenu(sunsetPrep, "Yapılacak şeyler'e taşı");
  await sunsetPrep.waitFor({ state: "detached" });
  await openSec("todo");
  await todoRow("Dom Luís'te gün batımı").waitFor();
  await openSec("prep");
  // T3 a: the chores worked out from the trip carry their day and where they came from (the booked TAP flight's
  // check-in opens 24 hours before; a Turkish passport to Portugal applies for the Schengen visa 15 days ahead), the list
  // goes by day and what has none comes last, "tarih yok" is never written; the count is the list's.
  const prepRows = sec("prep").locator(".q-prows > .q-pr1");
  const checkin = sec("prep").locator('.q-pr1[data-task^="checkin:"]');
  await checkin.waitFor();
  assert.match((await checkin.innerText()).replace(/\s+/g, " "), /Online check-in · TP 1760 .*kalkıştan 24 saat önce açılır uçuş kartından 13 Eki 19:40/);
  // Row 144: a day gone by is said "geçti" (grey), never the orange of a near one.
  assert.match((await sec("prep").locator('.q-pr1[data-task="visa:schengen"]').innerText()).replace(/\s+/g, " "), /Schengen vizesine başvur .*vize kuralından 23 Eyl'e kadar · geçti Resmî site/);
  assert.equal(await sec("prep").locator('.q-pr1[data-task="visa:schengen"] .q-pday').getAttribute("class"), "q-pday past");
  assert.equal(await checkin.locator(".q-pday").getAttribute("class"), "q-pday soon");
  const days = await prepRows.evaluateAll((els) => els.map((e) => e.getAttribute("data-day")));
  assert.deepEqual(days, [...days].sort((a, b) => (a == null) - (b == null)), "the chores with a day first, the rest after");
  assert.equal(days.at(-1), null, "the chore said without a day is last");
  assert.ok(!(await sec("prep").innerText()).includes("tarih yok"), "no 'tarih yok'");
  assert.equal(await sec("prep").locator(".q-pc2").innerText(), `0/${await prepRows.count()} hazır`);
  // The closed row counts the same chores (the Bavul's lines apart) and names the next one by its day.
  assert.equal(flat([await sec("prep").locator(".q-pl1").innerText()])[0], `0/${await prepRows.count()} hazır`);
  assert.equal(flat([await sec("prep").locator(".q-kw").innerText()])[0], `Gezi öncesi ${await prepRows.count()} iş · sıradaki: Schengen vizesine başvur, 23 Eyl'e kadar · geçti`);
  // T8 b: "Bilmen gerekenler" on top, only what has a source: the EU's 112, the money, the plugs, the embassy as a map search.
  const know = sec("prep").locator(".q-bm");
  assert.equal(await know.locator('[data-know="emergency"] small').innerText(), "112 (AB ortak numara)");
  assert.match(await know.locator('[data-know="embassy"] a').getAttribute("href"), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=T%C3%BCrkiye%20B%C3%BCy%C3%BCkel%C3%A7ili%C4%9Fi%20Portekiz$/);
  assert.equal(await know.locator('[data-know^="tip:"]').count(), 0, "no AI note without the AI");
  // T6 a: the Bavul is the list's last line, folded, with its count; open, its groups with their reasons, a tick, and
  // "bana göre değil" folding a line with its own "Geri al" (no toast).
  const bavul = sec("prep").locator(".q-bvli");
  assert.equal(await sec("prep").locator(".q-prows > li").last().getAttribute("class"), "q-bvli");
  const bavulCount = async () => (await bavul.locator(".q-bvn").innerText()).trim();
  assert.match(await bavulCount(), /^0\/\d+ hazır$/);
  await bavul.getByRole("button", { name: /^Bavul/ }).click();
  assert.equal(await bavul.locator(".q-bvs").getAttribute("aria-expanded"), "true");
  const passport = bavul.locator('.q-bv1[aria-label="Pasaport"]');
  await passport.getByRole("checkbox").click();
  await bavul.locator('.q-bv1.done[aria-label="Pasaport"]').waitFor();
  assert.match(await bavulCount(), /^1\/\d+ hazır$/);
  await passport.getByRole("checkbox").click();
  await bavul.locator('.q-bv1:not(.done)[aria-label="Pasaport"]').waitFor();
  const money = bavul.locator('.q-bv1[aria-label="Kart ve biraz Euro"]');
  await app.locator(".pk-undo").waitFor({ state: "detached", timeout: 10000 }); // an earlier "Geri al" over the list
  await money.hover();
  await money.getByRole("button", { name: "Kart ve biraz Euro: bana göre değil" }).click();
  await money.waitFor({ state: "detached" });
  assert.equal(await app.locator(".pk-undo").count(), 0, "no toast for it");
  await bavul.locator(".q-bv1.gone").getByRole("button", { name: "Geri al" }).click();
  await money.waitFor();
  await bavul.getByRole("button", { name: /^Bavul/ }).click();
  await bavul.locator(".q-bvb").waitFor({ state: "detached" });
  await app.locator(".pk-undo").waitFor({ state: "detached", timeout: 10000 }); // an earlier "Geri al" over the list
  await app.setViewportSize({ width: 1440, height: 1500 });
  await sec("prep").screenshot({ path: `${out}/5f-diger-hazirlik.png` });
  await app.setViewportSize({ width: 560, height: 1500 });
  await sec("prep").screenshot({ path: `${out}/5g-diger-hazirlik-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with Hazırlık");
  await app.setViewportSize({ width: 1440, height: 900 });
  // Ticked: done, struck through; then both lines go again, so the rest of the run sees the sample as it was.
  await prepRow.locator(".q-ck").click();
  await sec("prep").locator('.q-pr1.done[aria-label="Decathlon\'dan yağmurluk al"]').waitFor();
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("items", "readwrite");
    const all = await new Promise((resolve) => (tx.objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    for (const i of all) if (["Decathlon'dan yağmurluk al", "Dom Luís'te gün batımı"].includes(i.name)) tx.objectStore("items").delete(i.id);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await prepRow.waitFor({ state: "detached" });
  await todoRow("Dom Luís'te gün batımı").waitFor({ state: "detached" });
  console.log("✓ 0.34.6: a chore said lands in Hazırlık (ticked off there), an experience in Yapılacak şeyler");
  await openSec("activity");
  assert.equal(await sec("activity").locator('.pk-card[aria-label="Porto Belo Pazarı"]').count(), 0, "a market is never a booking");
  await openSec("todo");
  // v11 as drawn: with no photo, the drawing (a place to see: the map and compass; a restaurant: the table); the Maps
  // pin shows its photo instead.
  assert.equal(await todoRow("Porto Belo Pazarı").locator(".z-kp img.art").getAttribute("src"), "illus/yapilacak.png");
  const pinPhoto = todoRow("Jardins do Palácio de Cristal").locator(".z-kp img.ph");
  await pinPhoto.scrollIntoViewIfNeeded();
  assert.ok(await pinPhoto.evaluate(async (img) => (await img.decode(), img.naturalWidth > 0)), "the pin's photo loads");
  // The picture is the same size on every tile, a photo or the kind's mark.
  const picH = async (name) => Math.round((await todoRow(name).locator(".z-kp").boundingBox()).height);
  const cardH = async (name) => Math.round((await todoRow(name).boundingBox()).height);
  // (0.38.8, option A: every card of a row is one size, its picture 4:3 on top, on the plan or not; it was 224 px with a 92 px picture.)
  const pinBox = await todoRow("Jardins do Palácio de Cristal").locator(".z-kp").boundingBox();
  assert.ok(Math.abs(pinBox.height - (pinBox.width * 3) / 4) <= 1, "a card's picture is 4:3, a photo or not");
  assert.equal(await picH("Porto Belo Pazarı"), await picH("Jardins do Palácio de Cristal"), "on the plan or not, every card is one size");
  assert.equal(await cardH("Porto Belo Pazarı"), await cardH("Jardins do Palácio de Cristal"));
  // Saved from Maps: "Maps" on its picture, its kind in the grey line, "Haritada aç" its own Maps page.
  assert.equal(await todoRow("Jardins do Palácio de Cristal").locator(".z-kp .q-src").innerText(), "Maps");
  assert.match(await todoRow("Jardins do Palácio de Cristal").locator(".z-l2").innerText(), /Doğa/);
  assert.deepEqual(await openedBy(() => tileMenu(todoRow("Jardins do Palácio de Cristal"), "Haritada aç")), ["https://maps.app.goo.gl/e2e"]);
  await app.setViewportSize({ width: 1440, height: 1100 });
  await sec("todo").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5d-todo.png` });
  await app.setViewportSize({ width: 560, height: 1100 });
  await sec("todo").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5e-todo-narrow.png` });
  assert.deepEqual(await app.locator(".q-sec").evaluateAll((els) => els.map((e) => e.getAttribute("data-section"))), ["flight", "stay", "transport", "activity", "todo", "other", "prep", "inspo"]);
  assert.equal(await todoRow("Ribeira'da gün batımı").count(), 0);
  // İlham (0.35.3): the Reel waits at the very end as a tile with its platform; never a thing to do or a booking.
  // v82 (B8): one category open at a time; İlham opens like any other, the one open before closes.
  const inspo = await openSec("inspo");
  assert.equal(await app.locator(".q-sec.open").count(), 1, "one category open at a time");
  assert.equal(flat([await inspo.locator(".q-kw").innerText()])[0], "kaydettiğin video ve gönderiler");
  const reel = inspo.locator('.ins-tile[aria-label="Ribeira\'da gün batımı"]');
  assert.equal(await reel.locator(".ins-badge").innerText(), "Reels");
  assert.equal(await reel.locator(".ins-city").innerText(), "Porto");
  assert.equal(await reel.locator(".ins-ph").getAttribute("href"), "https://www.instagram.com/reel/e2e/");
  await app.setViewportSize({ width: 1440, height: 1100 });
  await inspo.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5h-ilham.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  // Put on a day, it becomes a thing to do there.
  await reel.getByRole("button", { name: "+ Güne ekle" }).click();
  await reel.getByRole("dialog", { name: "Hangi gün?" }).getByRole("button", { name: /^9 Eki/ }).click();
  await inspo.waitFor({ state: "detached" });
  await openSec("todo");
  await todoRow("Ribeira'da gün batımı").locator(".q-day", { hasText: "9 Eki" }).waitFor();
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("items", "readwrite");
    tx.objectStore("items").delete("e2e-reel");
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await todoRow("Ribeira'da gün batımı").waitFor({ state: "detached" });
  assert.equal(await app.locator(".cat-more").count(), 0, "no empty section left to offer");
  await app.setViewportSize({ width: 1440, height: 3600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5a-categories.png` });
  // v11: the visa is Belgeler ve internet's first line (Emre: where the papers are, and something to tick): a
  // Turkish passport to Portugal needs a Schengen visa, amber with its source; marked "Var", "Vize tamam", green (0.39.1).
  await openSec("prep");
  assert.equal(await sec("prep").locator(".q-pbody").count(), 1, "Hazırlık open");
  assert.equal(await app.locator(".q-pbody .z-visa, .q-pbody .visa-row, .prep-visa").count(), 0, "not in Hazırlık");
  await openSec("other");
  const visaRow = sec("other").locator(".z-visa");
  // v11 as drawn: one full-width line; 0.39.1: the answer said directly, the source small beside it, and "Var" / "Yok" like a
  // plan's "Aldım" (v83 C25: amber while "Yok").
  assert.match((await visaRow.innerText()).replace(/\s+/g, " "), /^! Vize gerekli · başvuru Schengen vizesi Resmî kaynak ↗ Var Yok$/);
  assert.ok(await visaRow.evaluate((el) => el.classList.contains("need")), "C25: amber");
  await visaRow.getByRole("button", { name: "Var", exact: true }).click();
  await sec("other").locator(".z-visa.ok", { hasText: "Vize tamam" }).waitFor();
  // The records read again (as after any save): nothing "moves" (a restaurant drawn under Yapılacak şeyler, a chore
  // under Hazırlık stay where they are), so the page doesn't scroll to one of them on its own (0.36.56's bug).
  await app.evaluate(() => {
    window.__scrolls = 0;
    const own = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      window.__scrolls++;
      return own.apply(this, args);
    };
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await app.waitForTimeout(800);
  assert.equal(await app.evaluate(() => window.__scrolls), 0, "the page didn't scroll on its own after the records were read again");
  await app.setViewportSize({ width: 1440, height: 900 });
  await sec("other").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5i-visa.png` });
  await visaRow.getByRole("button", { name: "Yok", exact: true }).click();
  await sec("other").locator(".z-visa.need", { hasText: "Vize gerekli · başvuru" }).waitFor();
  // v82 (aşama 6): the Pano is a window over the plan (E8), no longer a tab of its own: the plan stays behind it and the Pano tab reads
  // as chosen while it is open. Its side menu (Tümü · Biriktirdiklerim · AI önerileri · İlham · Belgeler, then the intents by category
  // with their dots); every option a card of one size (220 px), group by group; an intent's options side by side (280 px columns that
  // line up, best fit first with "n. sırada", ✓ / ✕ only); Seç changes the plan at once; the heart; Belgeler's "Kartı göster" closes the
  // window and the card flashes on the plan; a plan card's "Pano'da aç" opens it on that intent; Escape and × close it, the focus goes
  // back. Not in this version (bu sürümde arayüzden düştü): C32 (arama, durum süzgeci, sıralama, "Plan'da gör"), Beğenilenler and
  // "+ Link ekle" (B6): only that they are not there is checked.
  await app.setViewportSize({ width: 1440, height: 1400 });
  const panoTab = app.getByRole("tab", { name: "Pano", exact: true });
  await panoTab.click();
  const pano = app.getByRole("dialog", { name: "Pano" });
  await pano.waitFor();
  // (sizes are read once it has grown in: E8, 260 ms)
  const settled = () => pano.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))));
  await settled();
  assert.ok((await app.locator(".x-hero").count()) > 0 && (await app.locator(".cat-plan").count()) > 0, "the plan stays behind the window");
  assert.equal(await panoTab.getAttribute("aria-selected"), "true", "the Pano tab reads as chosen while the window is open");
  assert.equal(await app.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Pano'yu kapat", "the focus goes into the window, on its ×");
  const pside = pano.locator(".q-side");
  assert.deepEqual((await pside.locator(".q-st1").allInnerTexts()).map((t) => t.replace(/\s*\d*\s*$/, "").trim()), ["Tümü", "Biriktirdiklerim", "AI önerileri", "İlham", "Belgeler"]);
  assert.equal(Number(await pside.locator('.q-st1[data-v="all"] i').innerText()), await pano.locator(".q-pg").count(), "Tümü counts every card");
  assert.ok((await pside.locator(".q-sgh").count()) >= 4, "İhtiyaçlar: the categories");
  assert.deepEqual([...new Set(await pside.locator(".q-si .q-sd").evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c !== "q-sd"))))].every((c) => ["ok", "sel", "ai", "open"].includes(c)), true, "each intent has its dot");
  // C32 and B6: no search, no filter, no sort, no "+ Link ekle", no "Plan'da gör", no Beğenilenler.
  assert.equal(await pano.getByRole("searchbox").count(), 0, "C32: no search in this version");
  assert.equal(await pano.getByText(/^Sırala|Karar bekleyen|Beğenilenler|Plan'da gör|Link ekle/).count(), 0, "C32, B6: no filter, sort, Plan'da gör or link form");
  // Every card one size, its price row and button in line with the others in its row.
  const widths = await pano.locator(".q-pg").evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().width)))]);
  assert.deepEqual(widths, [220], `every Pano card is 220 px wide (${widths})`);
  const rows = await pano.locator(".q-pgrid").evaluateAll((gs) => gs.map((g) => [...g.querySelectorAll(".q-pg")].map((c) => Math.round(c.querySelector(".q-pgf").getBoundingClientRect().bottom - c.getBoundingClientRect().bottom))));
  assert.ok(rows.every((r) => new Set(r).size === 1), `the price rows line up (${JSON.stringify(rows)})`);
  await app.screenshot({ path: `${out}/30a-pano.png` });
  // A flight: its carrier's mark instead of a picture, its price per person from the record's passengers; the cards of one intent one height.
  await pside.locator('.q-sgh[data-cat="flight"]').click();
  await pano.locator(".q-ph2 b", { hasText: "Uçuş" }).waitFor();
  const panoFlight = pano.locator(".q-pg", { hasText: "TAP" }).first();
  assert.equal(await panoFlight.locator(".q-bigl").innerText(), "TP", "F2: a flight shows its carrier's mark");
  assert.equal(await panoFlight.locator(".q-pr small").innerText(), "kişi başı");
  const heights = await pano.locator(".q-pgrid").evaluateAll((gs) => gs.map((g) => [...g.querySelectorAll(".q-pg")].map((c) => Math.round(c.getBoundingClientRect().height))).filter((h) => h.length > 1));
  assert.ok(heights.length > 0 && heights.every((h) => new Set(h).size === 1), `the flight cards of a row are one height (${JSON.stringify(heights)})`);
  await app.screenshot({ path: `${out}/30a2-pano-flight.png` });
  // Konaklama: its options by intent; "Yan yana karşılaştır ›" puts one intent's options side by side.
  await pside.locator('.q-sgh[data-cat="stay"]').click();
  await pano.locator(".q-ph2 b", { hasText: "Konaklama" }).waitFor();
  assert.ok((await pano.locator(".q-grp").count()) >= 1, "stays grouped by intent");
  await app.screenshot({ path: `${out}/30b-pano-stays.png` });
  await pano.locator(".q-cmpb", { hasText: "Yan yana karşılaştır" }).first().click();
  const cols = pano.locator(".q-cmp3 .q-col");
  await cols.first().waitFor();
  await settled();
  assert.ok((await cols.count()) >= 2, "two or more options side by side");
  assert.equal(await pside.locator(".q-si.on, .q-si[aria-current='true']").count(), 1, "the side menu says which intent this is");
  assert.deepEqual([...new Set(await cols.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width))))], [280], "the columns are 280 px");
  const lined = await cols.evaluateAll((els) => [".q-c3", ".q-c5", ".q-c8"].map((r) => new Set(els.map((e) => Math.round(e.querySelector(r).getBoundingClientRect().top))).size));
  assert.deepEqual(lined, [1, 1, 1], "the rows line up across the columns (subgrid)");
  const ranks = await cols.evaluateAll((els) => els.map((e) => e.querySelector(".q-score em")?.textContent ?? null).filter(Boolean));
  assert.equal(ranks[0], "1. sırada", `best fit first (${ranks})`);
  assert.ok((await cols.locator(".q-mc").allInnerTexts()).every((t) => /^[✓✕] /.test(t)), "B5: what was asked for is ✓ or ✕, never ?");
  await app.screenshot({ path: `${out}/30d-pano-compare.png` });
  // Seç: the plan changes at once (no toast, E16); chosen again, it is as it was.
  const current = cols.and(app.locator(".cur"));
  assert.equal(await current.count(), 1, "the stay chosen on the plan is the one marked");
  assert.equal(await current.locator(".q-stc").innerText(), "Şu an seçili");
  const was = await current.getAttribute("aria-label");
  const other = cols.and(app.locator(":not(.cur)")).first();
  const otherName = await other.getAttribute("aria-label");
  await other.locator("button.q-pick", { hasText: "Seç" }).click();
  await pano.locator(`.q-col.cur[aria-label="${otherName}"]`).waitFor();
  assert.equal(await pano.locator(`.q-col.cur[aria-label="${was}"]`).count(), 0, "one choice: the one before goes back to the options");
  assert.equal(await app.locator(".pk-undo, .toast", { hasText: "seçildi" }).count(), 0, "E16: no toast on a choice");
  await pano.locator(`.q-col[aria-label="${was}"] button.q-pick`).click();
  await pano.locator(`.q-col.cur[aria-label="${was}"]`).waitFor();
  // The heart: a like, with its face; taken back, gone again.
  const heart = current.locator(".q-like");
  await heart.click();
  await current.locator(".q-like.on", { hasText: "1" }).waitFor();
  assert.ok((await current.locator(".q-avs i").count()) >= 1, "who liked it");
  await current.locator(".q-like.on").click();
  await current.locator(".q-like:not(.on)").waitFor();
  // Belgeler (C5): by kind, each file on its card; it opens in a tab; "Kartı göster" closes the window and the card flashes on the plan.
  await pside.locator('.q-st1[data-v="docs"]').click();
  const panoDoc = pano.locator('.q-dg[data-group="event"] .q-d1[data-state="ok"]', { hasText: "bilet.pdf" });
  await panoDoc.waitFor();
  assert.match(await panoDoc.locator(".q-dm small").innerText(), /Douro tekne turu kartına bağlı/);
  const [panoDocTab] = await Promise.all([context.waitForEvent("page"), panoDoc.getByRole("button", { name: "bilet.pdf", exact: true }).click()]);
  assert.match(panoDocTab.url(), /^blob:chrome-extension:\/\//);
  await panoDocTab.close();
  await app.screenshot({ path: `${out}/30e-pano-docs.png` });
  await panoDoc.getByRole("button", { name: "Kartı göster ›" }).click();
  await pano.waitFor({ state: "detached" });
  await app.locator(".flash").first().waitFor({ timeout: 5000 });
  assert.equal(await panoTab.getAttribute("aria-selected"), "false", "shut: the Plan tab is chosen again");
  const shownName = "Douro tekne turu";
  // From an intent's head (v82; the old card's "Değiştir N" → "Pano'da aç"): "Pano n" opens the window on its intent.
  await openSec("flight");
  const fromBox = sec("flight").locator(".q-ints > .q-int", { has: app.locator(".z-car", { hasText: "Pegasus" }) });
  assert.match(flat([await fromBox.locator(".z-h .q-pano").innerText()])[0], /^Pano \d+$/);
  await fromBox.locator(".z-h .q-pano").click();
  await pano.waitFor();
  await pside.locator(".q-si[aria-current='true']").waitFor();
  assert.ok((await pano.locator(".q-cmp3 .q-col, .q-pg").count()) >= 1, "its options are there");
  // × closes it; Escape too, and the focus goes back where it was (the Pano tab).
  await pano.getByRole("button", { name: "Pano'yu kapat" }).click();
  await pano.waitFor({ state: "detached" });
  await app.locator(".cat-plan").waitFor();
  // Narrow: a drawer from below, the side menu one row; nothing spills sideways.
  await app.setViewportSize({ width: 560, height: 1400 });
  await panoTab.click();
  await pano.waitFor();
  // (once it has come up: E8's drawer moves in over 320 ms)
  await settled();
  const drawer = await pano.evaluate((el) => { const r = el.getBoundingClientRect(); return { bottom: Math.round(r.bottom), width: Math.round(r.width) }; });
  assert.deepEqual(drawer, { bottom: 1400, width: 560 }, "narrow: the window is a drawer from below");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on the Pano");
  await app.screenshot({ path: `${out}/30c-pano-narrow.png` });
  await app.keyboard.press("Escape");
  await pano.waitFor({ state: "detached" });
  assert.equal(await app.evaluate(() => document.activeElement?.getAttribute("role")), "tab", "Escape: the focus is back on the Pano tab");
  await app.setViewportSize({ width: 1440, height: 3600 });
  console.log(`✓ v82 Pano: a window over the plan (the tab chosen while open), the side menu with its numbers and dots, cards of one size in line, a flight's mark, stays by intent, side by side in 280 px columns best fit first, Seç and back, the heart, Belgeler → Kartı göster (${shownName}) flashes on the plan, a card's "Pano'da aç" on its intent, × and Escape with the focus back, a drawer when narrow; C32 and "+ Link ekle" not in this version`);
  await app.setViewportSize({ width: 1440, height: 3600 });
  await app.setViewportSize({ width: 560, height: 3600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5b-categories-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with the sections");
  // Narrow: the intents one under another, one column.
  await openSec("stay");
  const [stayA, stayB] = await sec("stay").locator(".q-ints > .q-int").evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().toJSON()));
  assert.ok(stayB.top >= stayA.bottom - 1 && Math.abs(stayA.left - stayB.left) < 2, "one column when narrow");
  await app.setViewportSize({ width: 1440, height: 1400 });
  // v82 (B8): one category open at a time; its row closes it again, and then all are closed.
  const rowH = (await sec("stay").locator(".q-row1").boundingBox()).height;
  await sec("stay").locator(".q-tt").click();
  await app.waitForFunction(() => !document.querySelector(".q-sec.open"));
  assert.equal(await app.locator(".q-sec").count(), 7, "six categories and Hazırlık");
  assert.equal((await sec("stay").locator(".q-row1").boundingBox()).height, rowH, "E2: the row is the same open or closed");
  // One arrow, pointing right when closed and down when open (it turns in 260 ms: read once it has settled).
  const turn = async (scope) => {
    const chev = scope.locator(".q-chev");
    await chev.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))));
    await app.waitForTimeout(300);
    return chev.evaluate((el) => getComputedStyle(el).transform);
  };
  assert.equal(await turn(sec("todo")), "none");
  // Closed, a category is its row alone (K0, 78 px), the same in every category: icon, name and its line, three small
  // pictures, the bar in two greens and its state line, what's spent of its share, the arrow; nothing under it.
  // (a category folds shut over 260 ms, its body drawn until it has folded: m-bolum)
  const underClosed = ".q-sec:not(.open) .q-fold";
  await app.waitForFunction((sel) => document.querySelectorAll(sel).length === 0, underClosed, { timeout: 3000 });
  assert.equal(await app.locator(underClosed).count(), 0, "nothing under a closed row");
  const counts = [];
  for (const id of ["flight", "stay", "transport", "activity", "todo", "other", "prep"]) {
    const row = await sec(id).locator(".q-row1").boundingBox();
    assert.equal(row.height, 78, `${id}: the closed row is 78 px (${row.height}px)`);
    // Öneriler (C28): a category's suggestions say "1 öneri" after its line, and in its tip.
    if (await sec(id).locator(".q-sgn").count()) assert.match(await sec(id).locator(".q-sgn").innerText(), /^ · \d+ öneri$/);
    const kids = await sec(id).locator(".q-row1").evaluate((el) => [...el.children].map((c) => ["q-ic", "q-tt", "q-ths", "q-prog", "q-bud", "q-chev"].find((k) => c.classList.contains(k)) ?? c.className));
    assert.deepEqual(kids, ["q-ic", "q-tt", "q-ths", "q-prog", "q-bud", "q-chev"], `${id}: icon · name … pictures · bar · spent · arrow`);
    assert.ok((await sec(id).locator(".q-th").count()) <= 3, `${id}: three pictures at most`);
    // 0.38.3: the small pictures are real photos only (a record's, an option's, a tour's), never the kind's drawing.
    assert.equal(await sec(id).locator('.q-th img:not(.ph), .q-th img[src^="illus/"]').count(), 0, `${id}: no drawing among the small pictures`);
    assert.equal(await sec(id).locator(".q-add").count(), 0, `${id}: no "+ ekle" when closed`);
    if (id !== "todo") assert.match(await sec(id).locator(".q-count").textContent(), /^\d+\/\d+$/, `${id}: settled of all, for a screen reader`);
    const box = await sec(id).locator(".q-chev").boundingBox();
    counts.push(Math.round(box.x + box.width));
  }
  assert.equal(new Set(counts).size, 1, `the arrows line up on the right (${counts})`);
  assert.match(flat([await sec("stay").locator(".q-row1").innerText()])[0], /^Konaklama 2 şehir · 6 gece[^€]*?(\d+\/\d+ )?1 alındı · 1 seçildi €[\d.,]+/);
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-collapsed.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-collapsed-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with closed categories");
  for (const id of ["flight", "other"]) assert.ok((await sec(id).locator(".q-row1").boundingBox()).height <= 100, `${id}: compact when closed and narrow`);
  await app.setViewportSize({ width: 1440, height: 1400 });
  // Remembered for the trip (B8): all closed after a reload; the one opened last comes back open.
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await sec("activity").waitFor();
  assert.equal(await app.locator(".q-sec.open").count(), 0);
  // The row opens it (its cards come back) and closes it again.
  await sec("activity").locator(".q-row1").click({ position: { x: 300, y: 20 } });
  await sec("activity").locator('[data-row="ideas"] .z-k[aria-label="Tiyatro"]').waitFor();
  assert.match(await sec("activity").getAttribute("class"), /\bopen\b/);
  await sec("activity").locator(".q-row1").click({ position: { x: 300, y: 20 } });
  await app.waitForFunction(() => !document.querySelector('.q-sec[data-section="activity"].open'));
  await sec("activity").locator(".q-tt").click();
  await sec("activity").locator('[data-row="plan"] .z-k[data-item-id]').first().waitFor();
  assert.match(await turn(sec("activity")), /^matrix\([^,]+, 1, -1,/);
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await sec("activity").locator('[data-row="plan"] .z-k[data-item-id]').first().waitFor();
  assert.equal(await app.locator(".q-sec.open").count(), 1, "the one opened last, open again after a reload");
  // F5: the hero's numbers open their place in a closed category (and the open one closes): "%X planda" goes to the first
  // decision, here the visa's line.
  assert.doesNotMatch(await sec("other").getAttribute("class"), /\bopen\b/);
  await heroAgrees("after a reload");
  await app.locator(".x-hero button.x-ps").click();
  await app.locator("[data-visa].flash").waitFor();
  assert.match(await sec("other").getAttribute("class"), /\bopen\b/);
  assert.equal(await app.locator(".q-sec.open").count(), 1);
  // The ruled-out train: "Geri al" at the end of Ulaşım puts it back among the options; nothing hidden is left there.
  await openSec("transport");
  if (!(await sec("transport").locator(".q-hid").evaluate((el) => el.open))) await sec("transport").locator(".q-hid > summary").click();
  await sec("transport").locator('.q-hid .q-int.skip[data-hidden^="need:"] .q-undo').click();
  await sec("transport").locator(".q-hid").waitFor({ state: "detached" });
  // F4: "Sıradaki" updates itself. The visa ticked as got, its chip turns green and the next need takes its place; a tap opens
  // that need's category (closed here: one is open at a time, Belgeler ve internet's) and brings it into view with a flash.
  await openSec("other");
  await sec("other").locator("[data-visa]").getByRole("button", { name: "Var", exact: true }).click();
  await app.locator(".x-hero .x-chip.c-visa.ok", { hasText: "Vize alındı" }).waitFor();
  await app.waitForFunction(() => !/vize/i.test(document.querySelector(".x-hero .x-next")?.textContent ?? "vize"));
  const nextNow = flat([await app.locator(".x-hero .x-next").innerText()])[0];
  assert.match(nextNow, /^Sıradaki \S/, `the next need named (${nextNow})`);
  await app.locator(".x-hero").scrollIntoViewIfNeeded();
  await app.locator(".x-hero .x-next").click();
  const flashed = app.locator(".q-sec .flash, .q-sec.flash").first();
  await flashed.waitFor();
  assert.match(await flashed.evaluate((el) => el.closest(".q-sec").className), /\bopen\b/, "its category is open");
  assert.equal(await app.locator(".q-sec.open").count(), 1);
  await app.waitForFunction(() => {
    const el = document.querySelector(".q-sec .flash, .q-sec.flash");
    const r = el?.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.top < window.innerHeight;
  });
  console.log(`  next after the visa: ${nextNow}`);
  console.log("✓ 0.34 (kategoriler-v4, v82): the categories on one sheet, one open at a time (the last opened remembered after a reload), closed is a 78 px row (icon · name and line · pictures · two-tone bar and state · spent · arrow), the row opens it, a to-do opens its category, what's hidden waits at its category's end and comes back");
  console.log("✓ board: demo trip, decision labels, comparison with priorities, drawer, status change and chat event");

  // A trip with nothing in it yet (hero v9, v82 C19): only what is known is drawn; nothing is made up. Then what
  // was understood arrives (it fades in) and × takes one back.
  const putTrip = (trip) =>
    app.evaluate(async (t) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction("trips", "readwrite");
      tx.objectStore("trips").put(t);
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, trip);
  const blank = { id: "e2e-empty", title: "Yeni gezi", confirmedDates: null, budget: null, heroImage: null, createdAt: Date.now(), updatedAt: Date.now() };
  await putTrip(blank);
  await app.locator(".trip-switch").click();
  await app.locator(".trip-card", { hasText: "Yeni gezi" }).click();
  await app.getByRole("heading", { name: "Yeni gezi" }).waitFor();
  // C19: what isn't known isn't written as "yok" and has no place: the plain cover with the name, who goes, "İlk kaydı ekle";
  // no dates, no countdown, no cities, no shares, no money, no chips, no Tercihler.
  const bare = app.locator(".x-hero");
  await bare.locator(".x-mos.solo .x-big.empty h1", { hasText: "Yeni gezi" }).waitFor();
  assert.equal(await bare.locator(".x-big .x-where, .x-big .x-route, .x-big .x-count, .x-big .x-mood, .x-tiles").count(), 0, "no cities, no route, no days to go, no mood, no tiles");
  assert.equal(await bare.locator(".x-s1, .x-prog, .x-ps").count(), 0, "no dates, no countdown, no shares");
  // D16: no budget yet: the budget's place is the way to set one, an action, not a "bütçe yok" (C19).
  assert.equal(flat([await bare.locator(".x-s3 .x-budb.set").innerText()])[0], "Bütçe belirle");
  assert.equal(await bare.locator(".x-chips, .x-prefs, .x-styles").count(), 0, "no chips, no Tercihler, no style yet");
  assert.equal(await bare.locator(".x-whob").innerText(), "Kimler gidiyor?");
  assert.equal(await bare.locator(".x-face.none").count(), 1, "one dashed face to start from");
  assert.equal(flat([await bare.locator(".x-next").innerText()])[0], "Sıradaki İlk kaydı ekle");
  assert.equal(await bare.getByText(/yok$/).count(), 0, "nothing said to be missing");
  await app.screenshot({ path: `${out}/2e-hero-empty.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await bare.screenshot({ path: `${out}/2f-hero-empty-narrow.png` });
  assert.deepEqual(await uncut(heroLines), [], "the empty hero's lines wrap, never cut");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow empty hero");
  await app.setViewportSize({ width: 1440, height: 900 });
  // "İlk kaydı ekle" opens the Plan's own "+ Ekle" sheet.
  await bare.locator(".x-next").click();
  const firstSheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  await firstSheet.waitFor();
  await firstSheet.getByRole("button", { name: "Kapat" }).click();
  await firstSheet.waitFor({ state: "detached" });
  // What was understood arrives (it fades in) and × takes one back.
  await putTrip({ ...blank, priorities: { price: 4, location: 4 }, updatedAt: Date.now() });
  const prefs = bare.locator(".x-prefs");
  await bare.locator(".x-prefs.hx-appear").waitFor();
  assert.deepEqual(flat(await prefs.locator(".x-ptag.strong").allInnerTexts()), ["Fiyat", "Konum"]);
  await prefs.locator(".x-prefb").click();
  await app.screenshot({ path: `${out}/2g-hero-prefs.png` });
  await prefs.locator(".x-pref-pop").getByRole("button", { name: "Konum: Çok önemli kaldır" }).click();
  await prefs.locator(".x-pref-pop li", { hasText: "Konum" }).waitFor({ state: "detached" });
  await app.mouse.click(5, 5); // outside: the window closes
  await prefs.locator(".x-pref-pop").waitFor({ state: "detached" });
  assert.deepEqual(flat(await prefs.locator(".x-ptag.strong").allInnerTexts()), ["Fiyat"]);
  // "Özeti küçült" folds it to one line (E11), remembered for the trip after a reload; "Özeti aç" brings it back.
  await bare.locator(".x-fold").click();
  await bare.locator(".x-slim:not([hidden])", { hasText: "Yeni gezi" }).waitFor();
  assert.equal(await bare.locator(".x-mos").isVisible(), false, "folded: the mosaic is away");
  await app.reload();
  // (folded, the cover's heading is out of the page's tree: the line says the trip)
  await app.locator(".x-hero.fold .x-slim:not([hidden])", { hasText: "Yeni gezi" }).waitFor();
  await app.locator(".x-hero .x-unfold").click();
  await app.locator(".x-hero:not(.fold) .x-mos").waitFor();
  assert.equal(await app.locator(".x-hero .x-slim").isVisible(), false, "unfolded: the line is away");
  console.log('✓ hero v82: a new trip\'s hero shows only what is known (the plain cover, who goes, "İlk kaydı ekle" opening the sheet), Tercihler fades in when understood (window, ×), "Özeti küçült" folds it to one line, remembered, "Özeti aç" brings it back');

  // Hero fix 2: a stay in Gaula, a parish on Madeira, is Madeira's on the hero with no model to ask (no key here):
  // a Porto stay and a campervan picked up in Gaula show "Porto | Madeira", never "Porto | Gaula".
  const madeiraItems = (trip) =>
    app.evaluate(async ({ t, put }) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction(["trips", "items"], "readwrite");
      const now = Date.now();
      const stay = (over) => ({
        tripId: t.id, captureIds: ["e2e-cap"], key: null, category: "stay", provider: null, summary: "", optionDetail: null, url: null, imageUrl: null,
        country: "Portekiz", countryCode: "PT", guests: { adults: 1, children: null, rooms: null },
        price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
        cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null,
        highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: now, updatedAt: now, ...over,
      });
      if (put) {
        tx.objectStore("trips").put(t);
        tx.objectStore("items").put(stay({ id: "e2e-opo", needKey: "stay:porto", name: "OPO Vale Formoso I", city: "Porto", location: { address: "Rua de Vale Formoso, Porto, Portugal", area: null, approximate: false }, dates: { start: "2026-10-07", end: "2026-10-11", source: "page" } }));
        tx.objectStore("items").put(stay({ id: "e2e-van", needKey: "stay:gaula", name: "Renault Campervan 'Bawhee'", provider: "Indie Campers", city: "Gaula", location: { address: "Gaula, Madeira, Portugal", area: null, approximate: false }, dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } }));
      } else {
        tx.objectStore("trips").delete(t.id);
        for (const i of ["e2e-opo", "e2e-van"]) tx.objectStore("items").delete(i);
      }
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, { t: trip, put: trip.put });
  const madeira = { id: "e2e-madeira", title: "Porto ve Madeira Gezisi", confirmedDates: { start: "2026-10-07", end: "2026-10-18" }, budget: null, heroImage: null, createdAt: Date.now(), updatedAt: Date.now() };
  await madeiraItems({ ...madeira, put: true });
  await app.locator(".trip-switch").click();
  await app.locator(".trip-card", { hasText: "Porto ve Madeira Gezisi" }).click();
  await app.getByRole("heading", { name: "Porto ve Madeira Gezisi" }).waitFor();
  const coverCities = app.locator(".x-hero .x-big .x-where");
  await coverCities.filter({ hasText: "Madeira" }).waitFor();
  assert.match(await coverCities.innerText(), /^Porto · Madeira(, Portekiz)?$/, "Gaula is Madeira's on the hero, with no model");
  await app.waitForTimeout(1200); // the island's photo, when the network has one
  await app.locator(".x-hero").screenshot({ path: `${out}/2i-hero-madeira.png` });
  await madeiraItems({ ...madeira, put: false });
  console.log('✓ hero fix 2: Porto + a campervan picked up in Gaula is "Porto · Madeira" with no model; the style chips fit one line at 1280/1440');

  // 5. Settings dialog.
  await app.goto(`chrome-extension://${id}/app.html#settings`);
  await app.getByText("Gemini API anahtarı").waitFor(); // free Gemini is the default provider
  // 0.36 Profilim: a name and a photo (made a small square JPEG here), no account.
  const profile = app.locator(".profile-set");
  await profile.getByRole("textbox").fill("Emre");
  await profile.getByRole("textbox").blur();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAM0lEQVR4nG3CoREAIQADwSssRbxGo9Gv0WhqurJoIDuLX2ocqXGmxpUa/9S4U+NJjTf1A3y1XcEwJbHpAAAAAElFTkSuQmCC", "base64");
  await profile.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await profile.locator(".profile-photo img").waitFor();
  assert.match(await profile.locator(".profile-photo img").getAttribute("src"), /^data:image\/jpeg;base64,/);
  // The AI gate's place for its owner, folded.
  await app.locator(".ai-gate").getByRole("button", { name: /AI kapısı/ }).waitFor();
  await app.screenshot({ path: `${out}/6-settings.png` });
  await profile.getByRole("button", { name: "Fotoğrafı kaldır" }).click();
  await profile.locator(".profile-photo img").waitFor({ state: "detached" });
  await app.getByRole("radio", { name: /Claude/ }).click();
  await app.getByText("Claude API anahtarı").waitFor();
  await app.getByRole("radio", { name: /Gemini/ }).click();
  await app.getByPlaceholder("AIza… (yapıştır)").fill("test-key");
  await app.getByRole("button", { name: "Kaydet", exact: true }).click();
  const stored = await app.evaluate(() => chrome.storage.local.get(["provider", "geminiKey", "geminiModel"]));
  assert.deepEqual(stored, { provider: "gemini", geminiKey: "test-key", geminiModel: "gemini-3-flash-preview" });
  console.log("✓ settings: Gemini default, provider switch, key saved");

  // 6. Popup refuses non-web pages with a clear message.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 260 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.getByText("Burası pano", { exact: false }).waitFor();
  await popup.screenshot({ path: `${out}/7-popup.png` });
  console.log("✓ popup: renders and guides when clicked on the board itself");
} finally {
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// Part 2: the real first-use flow against a simulated Gemini API (fresh profile).
// Paste key → connect → capture a hotel page → Gemini extraction → trip on the board → chat.
// ---------------------------------------------------------------------------------------------
const flow = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-flow-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  // The trip map (MapLibre) needs WebGL 2: headless Chromium draws it in software.
  args: [...HEADLESS_ARGS, LANG_ARG, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
// The source answers nothing, except one Viator tour for Uluwatu's activities (the Bali trip's Etkinlik ve turlar tiles).
const tourOffer = { id: "e2e-viator-1", kind: "activity", title: "Uluwatu gün batımı ve kecak dansı", photo: null, price: 90, currency: "EUR", url: "https://www.viator.com/tours/e2e-kecak", why: "", source: "Viator", fetchedAt: Date.now(), durationMinutes: 240 };
await flow.route("**/functions/v1/offers**", (route) => {
  const q = new URL(route.request().url()).searchParams;
  return route.fulfill({ json: { offers: q.get("kind") === "activity" && q.get("city") === "Uluwatu" ? [tourOffer] : [] } });
});
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await flow.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The trip map's tiles (OpenFreeMap), simulated: a small style of its own and empty tiles, so no run depends on (or
// loads) the real service. The worker's tile requests come through here too. `tileAsks` counts what was asked.
const tileAsks = { style: 0, tiles: 0 };
await flow.route(/tiles\.openfreemap\.org/, (route) => {
  const url = route.request().url();
  if (/\/styles\//.test(url)) {
    tileAsks.style++;
    return route.fulfill({
      json: {
        version: 8,
        name: "e2e",
        sources: { openmaptiles: { type: "vector", tiles: ["https://tiles.openfreemap.org/planet/e2e/{z}/{x}/{y}.pbf"], maxzoom: 6, attribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" } },
        glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#a9c8f5" } },
          { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#a9c8f5" } },
          { id: "place", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"] } },
        ],
      },
    });
  }
  tileAsks.tiles++;
  return route.fulfill({ status: 200, contentType: "application/x-protobuf", body: Buffer.alloc(0) });
});
// MV3's CSP on the extension's pages: the map's library and worker must load without a violation.
const cspErrors = [];
const watchCsp = (p) => p.on("console", (m) => m.type() === "error" && /Content Security Policy|Refused to (load|execute|create)/i.test(m.text()) && cspErrors.push(m.text()));
flow.pages().forEach(watchCsp);
flow.on("page", watchCsp);
// Not frozen: its worker writes analyses on the real clock, and the board judges their freshness by it.
try {
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  const geminiBodies = [];
  const extraction = {
    category: "stay", name: "Jardim Stay", provider: "Booking.com", summary: "Baixa, Ribeira'ya 8 dk",
    option_detail: "Deluxe Double with Garden View", city: "Porto", country: "Portekiz", country_code: "PT",
    location: { address: "Rua do Almada 10, Porto", area: "Baixa", approximate: false },
    dates: { start: "8 Ekim", end: null, source: "page" }, // deliberately malformed: must not break the board
    guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 285, currency: "€", scope: "total", taxes_included: "yes", source: "page", evidence: "€ 285 total · includes taxes and fees" },
    cancellation: { summary: "5 Eki'ye kadar ücretsiz iptal", free_until: "2026-10-05", source: "page", evidence: "Free cancellation before 5 October 2026" },
    rating: { value: 8.9, scale: 10, count: 1204, source: "page", evidence: "Scored 8.9" },
    flight: null, metrics: null, highlights: ["Merkezi", "Sessiz"], concerns: [], review_summary: "Konum çok övülüyor.",
    image_url: "/relative.jpg", missing: [], trip: { existing_trip_id: null, new_trip_title: "Portekiz" }, need_key: "stay:porto",
  };
  const bangkokExtraction = {
    ...extraction, name: "Bangkok River Hotel", city: "Bangkok", country: "Tayland", country_code: "TH",
    summary: "Nehir kenarı", need_key: "stay:bangkok", dates: { start: "2027-01-10", end: "2027-01-14", source: "page" },
    price: { ...extraction.price, amount: 3200, currency: "THB", evidence: "฿ 3,200" },
    trip: { existing_trip_id: null, new_trip_title: "Tayland" },
  };
  const casaExtraction = {
    ...extraction, name: "Casa Azul", provider: "Airbnb", summary: "Bonfim, mutfaklı daire", option_detail: null,
    location: { address: null, area: "Bonfim", approximate: true },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "page" },
    price: { ...extraction.price, amount: 240, evidence: "€ 240 total" },
    rating: { value: 4.8, scale: 5, count: 96, source: "page", evidence: "4.8 · 96 reviews" },
    review_summary: "Ev sahibi ilgili; merkeze dönüş yokuş yukarı.", image_url: null,
  };
  // An Airbnb page saved before picking dates: no dates, a per-night price.
  const loftExtraction = {
    ...casaExtraction, name: "Ribeira Loft", summary: "Ribeira, nehir kenarı daire",
    dates: { start: null, end: null, source: "none" },
    price: { ...extraction.price, amount: 90, scope: "per_night", evidence: "€ 90 night" },
    rating: { value: 4.9, scale: 5, count: 210, source: "page", evidence: "4.9 · 210 reviews" },
  };
  const chatPrompts = [];
  const analysisPrompts = [];
  // Revizyon 1: what the hero asks the model (the main places, a note's few words), one ask each.
  const placePrompts = [];
  const notePrompts = [];
  // Öneriler: the AI reviews asked (one per trip state, at most once a day).
  const reviewPrompts = [];
  const policyReading = {
    doc_type: "insurance", provider: "Allianz", title: "Seyahat sağlık sigortası", travellers: ["Emre Durmuş", "Ayşe Durmuş"],
    start_date: "2026-10-07", end_date: "2026-10-21", time: null, from: null, to: null, city: null, booking_ref: "AZ-998877",
    flight_number: null, amount: 48.5, currency: "EUR",
  };
  const reply = (parts) => ({ json: { candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] } });
  // The Reader's answer for the Casa Azul page: real excerpts, plus a review and a quote that aren't
  // on the page (code must drop both).
  const casaReading = {
    review_total: 96,
    reviews: [
      { text: "Construction next door starts at 8 every morning, very noisy.", date_text: "September 2026", date: "2026-09" },
      { text: "The building work next to the flat was loud all day. Lovely host though.", date_text: "August 2026", date: "2026-08" },
      { text: "Great Italian restaurant right downstairs, and the bed is huge.", date_text: "August 2026", date: "2026-08" },
      { text: "The pool was freezing cold all week.", date_text: "July 2026", date: "2026-07" },
    ],
    findings: [
      { text: "Yan binada inşaat gürültüsü", polarity: "negative", topic: "condition", source: "reviews", severity: "high", nature: "event", quotes: ["Construction next door starts at 8 every morning", "The building work next to the flat was loud all day"] },
      { text: "Altında çok iyi bir İtalyan restoranı", polarity: "positive", topic: "nearby", source: "reviews", severity: "medium", nature: "lasting", quotes: ["Great Italian restaurant right downstairs"] },
      { text: "Geniş, rahat yatak", polarity: "positive", topic: "bed", source: "description", severity: "medium", nature: "stated", quotes: ["King-size bed"] },
      { text: "Çatı havuzu", polarity: "positive", topic: "facilities", source: "description", severity: "low", nature: "stated", quotes: ["Rooftop pool with a view"] },
    ],
  };
  const jardimReading = {
    review_total: 1204,
    reviews: [],
    findings: [
      { text: "Bahçe manzaralı oda", polarity: "positive", topic: "view", source: "description", severity: "low", nature: "stated", quotes: ["Deluxe Double with Garden View"] },
      { text: "Sessiz odalar", polarity: "positive", topic: "noise", source: "reviews", severity: "medium", nature: "lasting", quotes: ['Guest reviews: "Great location", "Quiet rooms"'] },
    ],
  };
  // Free geocoding and exchange rates, simulated (the worker calls them while processing).
  await flow.route("https://nominatim.openstreetmap.org/**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    const at = /almada/i.test(q) ? [41.1466, -8.6116] : /casa azul/i.test(q) ? [41.162, -8.589] : /porto/i.test(q) ? [41.1496, -8.6109] : null;
    return route.fulfill({ json: at ? [{ lat: String(at[0]), lon: String(at[1]) }] : [] });
  });
  await flow.route(/frankfurter/, (route) => route.fulfill({ json: { date: "2026-09-28", rates: { TRY: 40, THB: 38, USD: 1.1 } } }));
  await flow.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ json: { models: [
        // REST field name; the SDK maps it to Model.supportedActions.
        { name: "models/gemini-3-flash-preview", supportedGenerationMethods: ["generateContent", "countTokens"] },
        { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      ] } });
    }
    const body = request.postDataJSON();
    geminiBodies.push({ url: request.url(), body });
    if (body.generationConfig?.responseJsonSchema) {
      // 0.34.6: a document read (the file inline): a policy, or something it can't place.
      const file = body.contents[0].parts.map((p) => p.inlineData ?? p.inline_data).find(Boolean);
      if (file) {
        const content = Buffer.from(file.data, "base64").toString();
        return route.fulfill(reply([{ text: JSON.stringify(content.includes("e2e-policy") ? policyReading : { ...policyReading, doc_type: "other", provider: null, title: null, travellers: [], start_date: null, end_date: null, booking_ref: null, amount: null, currency: null }) }]));
      }
      const prompt = body.contents[0].parts.map((p) => p.text ?? "").join("");
      if (prompt.includes("<suggest_review>")) {
        // Öneriler: the AI review of a trip. Nothing to add here: the rules' cards are what step 19 checks.
        reviewPrompts.push(prompt);
        return route.fulfill(reply([{ text: JSON.stringify({ suggestions: [] }) }]));
      }
      if (prompt.includes("<engine_result>")) {
        // Decision analysis: a verdict in words, a 0–10 fit score per option, and, once the pages
        // have been read, Casa Azul ruled out on the construction finding (cited by id).
        analysisPrompts.push(prompt);
        const options = JSON.parse(prompt.match(/<options>(.*)<\/options>/)[1]);
        const casaOption = options.find((o) => o.name === "Casa Azul");
        const construction = casaOption?.findings?.find((f) => f.text.includes("inşaat"));
        return route.fulfill(reply([{ text: JSON.stringify({
          verdict: "Jardim Stay merkezde ve yorumları tutarlı; Casa Azul daha ucuz ama dönüşü yokuş.",
          reasons: ["Merkeze 5 dk → akşam dönüşleri kolay"], tradeoffs: ["€45 daha pahalı"],
          risks: ["Casa Azul'un konumu rezervasyondan sonra netleşiyor"], question: "Akşamları geç mi döneceksiniz?",
          ai_scores: options.map((o) => ({ item_id: o.id, score: o.name === "Jardim Stay" ? 8 : 6, note: "test notu" })),
          eliminations: construction ? [{ item_id: casaOption.id, reason: "Yan binada inşaat; sessizlik istiyorsun", finding_ids: [construction.ref] }] : [],
        }) }]));
      }
      if (prompt.includes("<places>")) {
        // The hero's main places: a town on Madeira (and Funchal, its capital) belong to Madeira.
        placePrompts.push(prompt);
        const places = prompt.split("\n").slice(1, -1).map((l) => l.replace(/ \(.*\)$/, ""));
        return route.fulfill(reply([{ text: JSON.stringify({ places: places.map((place) => ({ place, parent: /^(gaula|funchal)$/i.test(place) ? "Madeira" : null })) }) }]));
      }
      if (prompt.includes("<notes>")) {
        // A note the code can't name, in a few words.
        notePrompts.push(prompt);
        const notes = prompt.split("\n").slice(1, -1).map((l) => JSON.parse(l));
        return route.fulfill(reply([{ text: JSON.stringify({ labels: notes.map((n) => ({ id: n.id, label: /şarap/i.test(n.text) ? "Şarap tadımı" : "Bir not" })) }) }]));
      }
      if (prompt.includes("<place>")) {
        // The Reader: a close reading of one saved page.
        return route.fulfill(reply([{ text: JSON.stringify(prompt.includes('"name":"Casa Azul"') ? casaReading : jardimReading) }]));
      }
      const casa = prompt.includes("Casa Azul");
      const bangkok = prompt.includes("Bangkok River Hotel");
      const loft = prompt.includes("Ribeira Loft");
      return route.fulfill(reply([{ text: JSON.stringify(bangkok ? bangkokExtraction : loft ? loftExtraction : casa ? casaExtraction : extraction) }]));
    }
    const text = JSON.stringify(body.contents);
    chatPrompts.push(text);
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse")) return route.fulfill(reply([{ text: last.includes("plan_item") ? "Panoyu güncelledim." : "Fiyatı konaklamada çok önemli yaptım. Jardim Stay öne çıkıyor." }]));
    // The plan shaped from the chat: nights said apart, then one block, a ticket, a taxi and an eSIM.
    const plan = (id, args) => ({ functionCall: { id, name: "plan_item", args: { kind: "stay", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...args } } });
    if (last.includes("ayrı kalalım")) {
      return route.fulfill(reply([plan("fc-2", { date: "2026-10-08", end_date: "2026-10-09", city: "Porto" }), plan("fc-3", { date: "2026-10-09", end_date: "2026-10-11", city: "Porto" })]));
    }
    if (last.includes("Madeira'ya geçelim")) {
      return route.fulfill(reply([plan("fc-8", { date: "2026-10-11", end_date: "2026-10-13", city: "Funchal" }), plan("fc-9", { date: "2026-10-13", end_date: "2026-10-15", city: "Gaula" })]));
    }
    if (last.includes("tek blok")) {
      return route.fulfill(reply([
        plan("fc-4", { date: "2026-10-08", end_date: "2026-10-11", city: "Porto" }),
        plan("fc-5", { kind: "flight", date: "2026-10-11" }),
        plan("fc-6", { kind: "taxi", date: "2026-10-11", from: "Otel", to: "Havalimanı", city: "Porto" }),
        plan("fc-7", { kind: "esim" }),
      ]));
    }
    return route.fulfill(reply([
      { text: "Fiyatı öne alalım." },
      { functionCall: { id: "fc-1", name: "set_priorities", args: { changes: [{ criterion: "price", level: "cok_onemli", category: "stay" }], wanted_amenities: null } }, thoughtSignature: "c2ln" },
    ]));
  });

  const worker = flow.serviceWorkers()[0] ?? (await flow.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const board = flow.pages().find((p) => p.url().endsWith("app.html#settings")) ??
    (await flow.waitForEvent("page", { predicate: (p) => p.url().endsWith("app.html#settings") }));

  await board.getByPlaceholder("AIza… (yapıştır)").fill("AIzaSyTESTTESTTESTTESTTESTTESTTESTTEST12");
  await board.getByText("✓ Bağlandı (gemini-3-flash-preview)").waitFor({ timeout: 15000 }).catch(async (e) => {
    console.log("setup status:", await board.locator(".modal-card").innerText());
    console.log("intercepted:", geminiBodies.length, "requests");
    throw e;
  });
  await board.getByText("İlk gezini başlat").waitFor({ timeout: 10000 }); // modal closed by itself
  console.log("✓ flow: pasted key connects and saves (models listed via SDK)");

  const reader = (await build({ entryPoints: ["src/lib/pagecapture.ts"], bundle: true, write: false, format: "iife", globalName: "PC", target: "es2022" })).outputFiles[0].text;
  const hotel = await flow.newPage();
  await hotel.goto(pathToFileURL(path.resolve("tests/fixtures/hotel.html")).href + "?checkin=2026-10-08&checkout=2026-10-11&group_adults=2");
  const snap = await hotel.evaluate(`${reader}; PC.collectPage()`);
  snap.url = "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-08&checkout=2026-10-11&group_adults=2";
  await hotel.close();
  await board.bringToFront();
  await board.evaluate(async (snapshot) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({ ...snapshot, id: "flow-1", kind: "extension", screenshot: null, capturedAt: Date.now(), status: "pending", error: null, itemId: null });
    // A second option for the same stay, so there is something to compare.
    tx.objectStore("captures").put({
      id: "flow-1b", kind: "extension", url: "https://www.airbnb.com/rooms/123?check_in=2026-10-08&check_out=2026-10-11&adults=2",
      title: "Casa Azul",
      pageText: [
        "Casa Azul", "Entire flat in Bonfim · King-size bed · Fully equipped kitchen", "€ 240 total",
        "Free cancellation before 5 October 2026", "4.8 · 96 reviews", "Reviews",
        "Ana · September 2026", "Construction next door starts at 8 every morning, very noisy.",
        "Pedro · August 2026", "The building work next to the flat was loud all day. Lovely host though.",
        "Lena · August 2026", "Great Italian restaurant right downstairs, and the bed is huge.",
      ].join("\n"),
      viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: null, capturedAt: Date.now() + 1, status: "pending", error: null, itemId: null,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    await chrome.runtime.sendMessage({ type: "process" });
  }, snap);
  // The new trip appears as a card on "Seyahatlerim"; opening it shows its own board.
  await board.locator(".trip-card", { hasText: "Portekiz" }).click({ timeout: 20000 });
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  await board.getByText("Jardim Stay").first().waitFor();
  assert.equal(await board.locator(".crash").count(), 0, "board must not crash on real-shaped data");
  const extractionCall = geminiBodies.find((b) => b.body.generationConfig?.responseJsonSchema);
  assert.ok(extractionCall.url.includes("gemini-3-flash-preview:generateContent"));
  assert.ok(extractionCall.body.systemInstruction, "system instruction sent");
  assert.equal(extractionCall.body.generationConfig.responseMimeType, "application/json");
  await board.screenshot({ path: `${out}/8-flow-board.png` });
  console.log("✓ flow: capture → Gemini extraction (SDK request shape checked) → trip on the board");

  // Each page is then read closely (any site): findings with the reviews behind them, counted by code.
  // Weighed by the analysis, which sees the findings with their counts.
  // v11: the stay's window says it ("Seçmeden kontrol et · Casa Azul: …"); its pros under "Neden?"; "Tüm detaylar"
  // opens the record with the evidence.
  // F7: the Porto nights have a real priced option, so their box is the draft "Önerimiz". v82 (C12, B12): its details over the
  // card say what to check before choosing ("Casa Azul: …"); Değiştir shows the options in place, a name opens its record.
  const bsec = (id) => board.locator(`.q-sec[data-section="${id}"]`);
  const bopen = async (id) => {
    const s = bsec(id);
    await s.waitFor({ timeout: 20000 });
    if (!(await s.evaluate((el) => el.classList.contains("open")))) await s.locator(".q-tt").click();
    await s.locator(".q-fold.on").waitFor(); // (a page behind another has its timers held back: the fold is open, "settled" may come late)
    return s;
  };
  const portoB = async () => {
    await bopen("stay");
    const box = bsec("stay").locator(".q-ints > .q-int", { has: board.locator(".z-h .q-nm", { hasText: "Porto" }) });
    await box.waitFor({ timeout: 20000 });
    return box;
  };
  /** The Porto box's details (ⓘ), open again whenever the box was drawn anew (a new analysis, a new option). */
  const portoDetail = async (until, timeout = 40000) => {
    const end = Date.now() + timeout;
    for (;;) {
      const box = await portoB();
      if (!(await box.locator(".z-det").count()) && (await box.locator(".z-ib").count())) await box.locator(".z-ib").click().catch(() => undefined);
      if (await box.locator(".z-det").count() && (await until(box.locator(".z-det")))) return box.locator(".z-det");
      if (Date.now() > end) throw new Error("the Porto box's details never said it");
      await board.waitForTimeout(400);
    }
  };
  const casaWin = await portoDetail(async (det) => (await det.locator(".q-dverify li", { hasText: "Casa Azul" }).filter({ hasText: "Yan binada inşaat" }).count()) > 0);
  assert.ok(analysisPrompts.some((p) => p.includes("Yan binada inşaat gürültüsü") && p.includes('"count":2')), "analysis sees findings and counts");
  await board.keyboard.press("Escape");
  await casaWin.waitFor({ state: "detached" });
  // Everything read, with the evidence behind it, is one tap deeper: the option's name (Değiştir) opens its record.
  // (B12: the old card's back with each option's pros and cons is gone; the biggest of them are in the details.)
  let pbox = await portoB();
  await pbox.getByRole("button", { name: "Değiştir" }).click();
  await pbox.getByRole("button", { name: "Casa Azul: tüm detaylar" }).click();
  const casaBody = board.getByRole("dialog");  await casaBody.locator(".pc-line", { hasText: "Altında çok iyi bir İtalyan restoranı" }).first().waitFor();
  // A serious, recent problem costs points outright, and says so.
  await casaBody.locator(".pc-line.serious", { hasText: "Yan binada inşaat gürültüsü" }).getByText("puandan −8", { exact: false }).waitFor();
  const unverifiedPool = casaBody.locator(".pc-line.unverified", { hasText: "Çatı havuzu" });
  await unverifiedPool.getByText("sayfada doğrulanamadı").waitFor();
  await casaBody.getByText("Sayfada bulunamayan 2 alıntı gösterilmedi.").waitFor(); // the invented review and quote
  await casaBody.locator(".pc-line", { hasText: "Yan binada inşaat gürültüsü" }).first().getByRole("button", { name: "Kanıt" }).click();
  await casaBody.locator("blockquote", { hasText: "The building work next to the flat was loud all day" }).first().waitFor();
  await board.screenshot({ path: `${out}/8a-flow-reading.png`, fullPage: true });
  await casaBody.getByRole("button", { name: "Kapat" }).click();
  await pbox.getByRole("button", { name: "Vazgeç" }).click();
  console.log("✓ flow: pages read closely → verified findings with counts; invented quotes dropped; flagged to check, with evidence");

  // An Airbnb page saved without dates joins the same Porto nights (whatever the site), provisionally,
  // and offers to reopen the page with those dates to get the real price.
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({
      id: "flow-loft", kind: "extension", url: "https://www.airbnb.com.tr/rooms/777?source_impression_id=p3",
      title: "Ribeira Loft", pageText: "Ribeira Loft\n€ 90 night\n4.9 · 210 reviews", viewportText: "", selection: "", jsonLd: [], meta: {},
      screenshot: null, capturedAt: Date.now(), status: "pending", error: null, itemId: null,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    await chrome.runtime.sendMessage({ type: "process" });
  });
  // v11: it joins the Porto nights' options, priced for them for now ("geçici"); v82: its page opens with those dates from
  // its own link ("Rezerve et ↗" once it's the one, C33 "Tarihlerle aç" kept, unseen).
  pbox = await portoB();
  await pbox.locator(".q-pn", { hasText: "3" }).waitFor({ timeout: 20000 });
  await pbox.getByRole("button", { name: "Değiştir" }).click();
  const loftRow = pbox.locator(".z-oc", { has: board.locator(".z-t", { hasText: "Ribeira Loft" }) });
  await loftRow.waitFor({ timeout: 20000 });
  assert.equal(await board.getByText("tarih seçilmemiş").count(), 0, "the undated stay is not set aside");
  await loftRow.locator(".z-prov", { hasText: "geçici" }).waitFor();
  await board.screenshot({ path: `${out}/8c-flow-undated.png`, fullPage: true });
  await loftRow.getByRole("button", { name: "Ribeira Loft: seç" }).click();
  await pbox.locator('.z-c .z-t', { hasText: "Ribeira Loft" }).waitFor();
  const reopen = await pbox.locator("a.q-cta").getAttribute("href");
  assert.match(reopen, /airbnb\.com\.tr\/rooms\/777\?.*check_in=2026-10-08&check_out=2026-10-11&adults=2/);
  await pbox.locator(".z-h .z-mb").click();
  await pbox.getByRole("menuitem", { name: "Seçimi geri al" }).click();
  await pbox.locator(".q-take", { hasText: "Bunu seç" }).waitFor();
  console.log("✓ flow: an undated Airbnb page joins the same nights' comparison, provisionally, with a link to add the dates");

  // Two stays → the engine ranks them and the worker asks Gemini for the written analysis (the details' "Karşılaştır", C12).
  // v82 (B12): "Karşılaştır" is the Pano's comparison, the options ranked side by side; the analysis is counted in the score and
  // shown, with the geocoded distance, in a record's breakdown ("Tüm detaylar"). The old window's table, its written verdict and
  // the rating scale's note are C11's karar yardımı (spec §1.1, row 199: bu sürümde arayüzden düştü): kept below for its return.
  const cmpWin = await portoDetail(async (det) => (await det.getByRole("button", { name: "Karşılaştır", exact: true }).count()) > 0, 20000);
  await cmpWin.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  const cmpPano = board.getByRole("dialog", { name: "Pano" });
  await cmpPano.locator(".q-cmp3 .q-col").nth(1).waitFor();
  assert.equal((await cmpPano.locator(".q-cmp3 .q-col .q-score em").allInnerTexts())[0], "1. sırada", "ranked, best fit first");
  assert.equal(await board.getByRole("dialog", { name: "Karşılaştırma" }).count(), 0, "row 199: not the old window");
  await cmpPano.getByRole("button", { name: "Pano'yu kapat" }).click();
  await cmpPano.waitFor({ state: "detached" });
  const jardimBox = await portoB();
  await jardimBox.getByRole("button", { name: "Değiştir" }).click();
  await jardimBox.getByRole("button", { name: "Jardim Stay: tüm detaylar" }).click();
  const jardimDrawer = board.getByRole("dialog");
  await jardimDrawer.locator(".breakdown p", { hasText: /AI değerlendirmesi: \d+\/10 · test notu/ }).waitFor({ timeout: 20000 }); // fresh analysis → counts, labelled
  await jardimDrawer.locator(".breakdown .part-value", { hasText: "merkeze 5 dk yürüme" }).waitFor(); // geocoded, measured from the city centre
  await board.screenshot({ path: `${out}/8b-flow-compare.png`, fullPage: true });
  await jardimDrawer.getByRole("button", { name: "Kapat" }).click();
  await jardimDrawer.waitFor({ state: "detached" });
  if (await jardimBox.getByRole("button", { name: "Vazgeç" }).count()) await jardimBox.getByRole("button", { name: "Vazgeç" }).click();
  let compare = board.getByRole("dialog", { name: "Karşılaştırma" });
  if (CMP_SHOWN) {
    await compare.getByRole("tab", { name: /Tablo/ }).click();
    await compare.getByText("Jardim Stay merkezde ve yorumları tutarlı", { exact: false }).waitFor({ timeout: 20000 });
    await compare.locator("tr", { hasText: "AI değerlendirmesi" }).waitFor();
    await compare.locator(".cell-value", { hasText: "merkeze 5 dk yürüme" }).waitFor();
    await compare.getByText("Airbnb ölçeği", { exact: false }).first().waitFor();
    await compare.getByRole("button", { name: "Kapat" }).click();
  }
  console.log("✓ flow: two options → ranked side by side in the Pano with geocoded distance, AI analysis fetched, shown and counted");

  await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("Hangisi daha mantıklı?");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.getByText("Fiyatı konaklamada çok önemli yaptım.").waitFor({ timeout: 20000 });
  // Karar Panosu #9: the name of an option in the reply is a button to its card; the card glows when the page gets there.
  const nameRef = board.locator(".msg-assistant", { hasText: "Jardim Stay öne çıkıyor." }).locator(".chat-ref");
  assert.equal(await nameRef.count(), 1, "only the real option's name is a button");
  assert.equal(await nameRef.filter({ hasText: "Fiyatı" }).count(), 0, "nothing else in the reply is");
  assert.match(await board.locator(".msg-assistant", { hasText: "Jardim Stay öne çıkıyor." }).innerText(), /Jardim Stay öne çıkıyor\./, "the reply reads as it was written");
  await nameRef.click();
  await board.locator(".flash").first().waitFor({ timeout: 5000 });
  const wide = board.viewportSize();
  await board.setViewportSize({ width: 390, height: 844 });
  assert.ok(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with the name buttons at 390 px");
  await board.setViewportSize(wide ?? { width: 1440, height: 900 });
  assert.ok(chatPrompts[0].includes("decisions") && chatPrompts[0].includes("would_change_if"), "chat sees the engine's result");
  // Remembered as something the traveller said: a tag of the hero's "Tercihler" (scope and level in its window, removable there).
  await board.locator('.x-hero .x-ptag.strong[title="Fiyat · Çok önemli"]').waitFor();
  await board.keyboard.press("Escape");
  // The weight the chat set, in the record's breakdown ("Fiyat · çok önemli"); the old table's select is C11's (row 199).
  await (await portoDetail(async (det) => (await det.getByRole("button", { name: "Tüm detaylar ›" }).count()) > 0, 20000)).getByRole("button", { name: "Tüm detaylar ›" }).click();
  await board.getByRole("dialog").locator(".breakdown .part-label", { hasText: "Fiyat · çok önemli" }).waitFor();
  await board.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();
  if (CMP_SHOWN) {
    await (await portoDetail(async (det) => (await det.getByRole("button", { name: "Karşılaştır", exact: true }).count()) > 0, 20000)).getByRole("button", { name: "Karşılaştır", exact: true }).click();
    compare = board.getByRole("dialog", { name: "Karşılaştırma" });
    await compare.getByRole("tab", { name: /Tablo/ }).click();
    assert.equal(await compare.locator("tr", { hasText: "Fiyat" }).locator("select").inputValue(), "4");
    await compare.getByRole("button", { name: "Kapat" }).click();
  }
  const chatCalls = geminiBodies.filter((b) => !b.body.generationConfig?.responseJsonSchema);
  assert.equal(chatCalls.length, 2);
  const second = chatCalls[1].body.contents;
  assert.deepEqual(second.map((c) => c.role), ["user", "model", "user"]);
  assert.equal(second[1].parts[1].thoughtSignature, "c2ln");
  assert.equal(second[2].parts[0].functionResponse.id, "fc-1");
  assert.match(JSON.stringify(second[2].parts[0].functionResponse.response), /stay@2026-10-08_2026-10-11/); // new ranking returned to the model
  assert.ok(chatCalls[0].body.tools[0].functionDeclarations.some((f) => f.name === "update_items"));
  await board.screenshot({ path: `${out}/9-flow-chat.png` });
  console.log("✓ flow: chat → set_priorities → comparison reweighted; history replayed with signatures");

  // The plan shaped from the chat: Porto said as two stays shows two blocks; "tek blok" makes it one,
  // and a ticket, a taxi and an eSIM said in the same message are on the board, each removable there.
  let nth = 0;
  const say = async (text, done) => {
    await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill(text);
    await board.getByRole("button", { name: "Gönder" }).click();
    await board.locator(".msg-assistant", { hasText: done }).nth(nth++).waitFor({ timeout: 20000 });
  };
  // v82: a city's nights back to back are one need, so one box; its second block is an anchor of the box (it finds it).
  // (The stay said apart's own note comes back with row 105, phase 3b.)
  await bopen("stay");
  await say("Porto'da 8'i gecesi ayrı, 9-11 ayrı kalalım", "Panoyu güncelledim.");
  await board.locator("#tl-stay-2026-10-09").waitFor({ state: "attached", timeout: 10000 });
  await say("Porto tek blok olsun 8-11; 11 Ekim'e uçak bileti, otelden havalimanına taksi, eSIM de alalım", "Panoyu güncelledim.");
  await board.locator("#tl-stay-2026-10-09").waitFor({ state: "detached", timeout: 10000 });
  await board.locator("#tl-stay-2026-10-08").waitFor();
  await bopen("flight");
  // v82: the ticket said with nothing concrete is its flight box, still to find (its record held in it).
  await bsec("flight").locator('.q-ints > .q-int[data-kind="flight"][data-item-id]').first().waitFor();
  // Nothing left to do in Ulaşım (the taxi is planned): its row all settled; v82: closed until opened (one at a time).
  const transportSec = bsec("transport");
  assert.match(await transportSec.locator(".q-count").textContent(), /^(\d+)\/\1$/);
  await bopen("transport");
  await bsec("transport").locator('.q-ints > .q-int[data-kind="taxi"]').first().waitFor();
  // The eSIM is Belgeler ve internet's box (v82): its ⋯ deletes it, the toast's "Geri al" brings it back.
  await bopen("other");
  const esim = bsec("other").locator('.q-ints > .q-int[data-kind="esim"][data-item-id]');
  await esim.waitFor();
  await esim.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/9b-chat-plan.png` });
  await esim.locator(".z-h .z-mb").click();
  await esim.getByRole("menuitem", { name: "Sil" }).click();
  await esim.waitFor({ state: "detached" });
  await board.locator(".pk-undo", { hasText: "eSIM silindi" }).getByRole("button", { name: "Geri al" }).click();
  await esim.waitFor();
  await esim.locator(".z-h .z-mb").click();
  await esim.getByRole("menuitem", { name: "Sil" }).click();
  await esim.waitFor({ state: "detached" });
  console.log("✓ flow: chat shapes the plan — two Porto stays merge into one block; ticket, taxi and eSIM added; a plan deleted, undone, deleted");

  // 0.34.6: a policy PDF dropped in the chat is read by the (simulated) model: booked insurance in Diğer with
  // its file, one sentence in the chat; Belgeler lists it and goes to its card; a file it can't place is
  // linked by hand; deleted and taken back.
  const dropFile = (name, body) =>
    board.locator("section.chat").evaluate((el, [n, b]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([b], n, { type: "application/pdf" }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, [name, body]);
  await dropFile("allianz-police.pdf", "%PDF-1.4 e2e-policy");
  await board.locator(".msg-assistant", { hasText: "Allianz seyahat sağlık sigortası poliçeni Belgeler ve internet'e ekledim, 7–21 Ekim, 2 kişi. Belgeler'de duruyor." }).waitFor({ timeout: 20000 });
  await board.locator(".msg-user", { hasText: "📎 allianz-police.pdf" }).waitFor();
  assert.ok(geminiBodies.some((b) => JSON.stringify(b.body.contents).includes("application/pdf")), "the PDF went to the model inline");
  const otherSec = await bopen("other");
  const policyCard = otherSec.locator(".q-ints > .q-int[data-kind=\"insurance\"]", { has: board.locator(".z-t", { hasText: "Allianz" }) });
  await policyCard.locator(".q-st", { hasText: "Alındı" }).waitFor();
  // v82: a booking's file opens from its box ("Poliçeyi aç"); the details over the card name it.
  await policyCard.locator(".q-open", { hasText: "Poliçeyi aç" }).waitFor();
  await policyCard.locator(".z-ib").click();
  await policyCard.locator(".z-det .q-dl", { hasText: "allianz-police.pdf" }).waitFor();
  await board.keyboard.press("Escape");
  await policyCard.locator(".z-det").waitFor({ state: "detached" });
  assert.equal(await board.locator('.q-sec[data-section="todo"] [aria-label="Seyahat sağlık sigortası · Allianz"]').count(), 0, "a policy is never a thing to do");
  await otherSec.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/13a-policy-card.png` });
  // Insurance isn't part of a day (satır standardı v2): no line of it in Gün gün.
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".dg-tl > li").first().waitFor();
  assert.equal(await board.locator(".dg-tl > li", { hasText: /Allianz|sigorta/i }).count(), 0, "no insurance in the day");

  // v82 (C5): Belgeler is in the Pano window's side menu (no tab of its own); the trip's ••• menu opens the window there.
  await board.getByRole("button", { name: "Gezi menüsü" }).click();
  await board.locator(".x-tm-pop").getByRole("menuitem", { name: "Belgeler", exact: true }).click();
  const docsWin = board.getByRole("dialog", { name: "Pano" });
  await docsWin.locator('.q-st1[data-v="docs"][aria-current="true"]').waitFor();
  const docRow = (name) => docsWin.locator(`.q-d1[aria-label="${name}"]`);
  await docsWin.locator('.q-dg[data-group="insurance"]').locator('.q-d1[aria-label="allianz-police.pdf"]').waitFor();
  assert.equal(await docRow("allianz-police.pdf").locator(".q-dst").innerText(), "Karta bağlı");
  assert.match(await docRow("allianz-police.pdf").locator(".q-dm small").innerText(), /^PDF · Seyahat sağlık sigortası · Allianz kartına bağlı · /);
  await dropFile("rezervasyon-notu.pdf", "%PDF-1.4 e2e-other");
  await board.locator(".msg-assistant", { hasText: "rezervasyon-notu.pdf Belgeler'e kaydedildi" }).waitFor({ timeout: 20000 });
  // A file the reader couldn't place: under Bağlanmamış, "Karta bağla".
  await docsWin.locator('.q-dg[data-group="unlinked"]').locator('.q-d1[aria-label="rezervasyon-notu.pdf"] select.q-dgo').waitFor();
  await board.locator(".pk-undo").waitFor({ state: "detached", timeout: 10000 }); // the eSIM's "Geri al" from before
  await board.screenshot({ path: `${out}/13-belgeler.png` });
  await board.setViewportSize({ width: 560, height: 1000 });
  await board.waitForTimeout(400);
  await board.screenshot({ path: `${out}/13b-belgeler-narrow.png` });
  assert.ok(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in Belgeler");
  await board.setViewportSize({ width: 1440, height: 900 });
  // Linked by hand: it moves to its card's group and names it.
  const jardimLabel = await docRow("rezervasyon-notu.pdf").locator("select.q-dgo option", { hasText: "Jardim Stay" }).first().innerText();
  await docRow("rezervasyon-notu.pdf").locator("select.q-dgo").selectOption({ label: jardimLabel });
  await docsWin.locator('.q-dg[data-group="stay"]').locator('.q-d1[aria-label="rezervasyon-notu.pdf"]', { hasText: "Jardim Stay" }).waitFor();
  // Deleted, then taken back with "Geri al" (the toast sits over the window): back with its card.
  await docRow("rezervasyon-notu.pdf").locator(".q-dx").click();
  await docRow("rezervasyon-notu.pdf").waitFor({ state: "detached" });
  await board.locator(".pk-undo", { hasText: "rezervasyon-notu.pdf silindi" }).getByRole("button", { name: "Geri al" }).click();
  await docRow("rezervasyon-notu.pdf").locator(".q-dm small", { hasText: "Jardim Stay" }).waitFor();
  await board.screenshot({ path: `${out}/13c-belgeler-linked.png` });
  // From Belgeler to the card ("Kartı göster"): the window closes; the Plan, its section open, the card in view with a flash.
  await docRow("allianz-police.pdf").getByRole("button", { name: "Kartı göster ›" }).click();
  await docsWin.waitFor({ state: "detached" });
  await board.locator('[role="tab"][aria-selected="true"]', { hasText: "Plan" }).waitFor();
  await policyCard.and(board.locator(".flash")).waitFor({ timeout: 5000 });
  console.log("✓ 0.34.6 + C5: a policy PDF dropped in the chat → booked insurance in Diğer with its file; Pano > Belgeler groups it on its card, an unplaced file under Bağlanmamış linked by hand, deleted and taken back, Kartı göster goes to the card");

  // A Thailand hotel saved while the Portugal trip is open → its own trip, and a notice to go there.
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({
      id: "flow-2", kind: "extension", url: "https://www.booking.com/hotel/th/bangkok-river.html?checkin=2027-01-10&checkout=2027-01-14",
      title: "Bangkok River Hotel", pageText: "Bangkok River Hotel\n฿ 3,200 total", viewportText: "", selection: "", jsonLd: [], meta: {},
      screenshot: null, capturedAt: Date.now(), status: "pending", error: null, itemId: null,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    await chrome.runtime.sendMessage({ type: "process" });
  });
  await board.locator(".toast", { hasText: "Tayland" }).waitFor({ timeout: 20000 });
  await board.screenshot({ path: `${out}/11-toast.png` });
  await board.locator(".toast").getByRole("button", { name: "Aç" }).click();
  await board.getByRole("heading", { name: "Tayland" }).waitFor();
  assert.equal(await board.getByText("Jardim Stay").count(), 0, "Portugal items must not show in the Thailand trip");
  // A lone option has nothing to be compared with: no score, but its measured criteria are one click away (v11: its
  // need's card (F7: with a real price, its draft "Önerimiz": the card itself turns), then the window's "Karşılaştır").
  // v82 (B12): the comparison is the Pano's, and with one option there is none: its details offer no "Karşılaştır";
  // "Tüm detaylar ›" has what is measured. (The old window's "Puan, karşılaştırınca çıkar" is C11's, row 199.)
  await bopen("stay");
  const lone = bsec("stay").locator(".q-ints > .q-int").first();
  await lone.locator(".z-ib").click();
  assert.equal(await lone.locator(".z-det").getByRole("button", { name: "Karşılaştır", exact: true }).count(), 0, "a lone option: nothing to compare");
  await lone.locator(".z-det").getByRole("button", { name: "Tüm detaylar ›" }).click();
  const loneDrawer = board.getByRole("dialog");
  await loneDrawer.getByText("Tek seçenek · bir tane daha kaydedince puanlanır").waitFor();
  assert.equal(await loneDrawer.getByRole("button", { name: "Karşılaştır →" }).count(), 0, "nor in its drawer");
  await loneDrawer.getByRole("button", { name: "Kapat" }).click();
  await loneDrawer.waitFor({ state: "detached" });
  if (CMP_SHOWN) {
    await lone.locator(".z-ib").click();
    await lone.locator(".z-det").getByRole("button", { name: "Karşılaştır", exact: true }).click();
    await board.getByRole("dialog", { name: "Karşılaştırma" }).getByText("Puan, karşılaştırınca çıkar").waitFor();
    await board.getByRole("dialog", { name: "Karşılaştırma" }).getByRole("button", { name: "Kapat" }).click();
  }
  await board.getByRole("button", { name: /Seyahatlerim/ }).click();
  await board.locator(".trip-card").nth(1).waitFor();
  assert.equal(await board.locator(".trip-card").count(), 2);
  await board.screenshot({ path: `${out}/12-trips.png` });
  console.log("✓ flow: Thailand capture → separate trip + notice; overview lists both trips, each with its own board");

  // Revizyon 1: the hero's destinations are the main places. Stays said in Funchal and in Gaula (a parish on
  // Madeira) make the hero say "Porto | Madeira" once the model has said which is inside which; the Plan keeps Gaula.
  // A note the code can't name gets a few words from the model, asked once, kept on the trip.
  await board.locator(".trip-card", { hasText: "Portekiz" }).click();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const tripId = trips.find((x) => x.title === "Portekiz").id;
    const tx = database.transaction("preferences", "readwrite");
    tx.objectStore("preferences").put({ id: "e2e-wine", tripId, text: "Akşamları şarap tadımına gitmek istiyoruz", createdAt: Date.now() });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const updated = board.locator(".msg-assistant", { hasText: "Panoyu güncelledim." });
  const before = await updated.count();
  await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("Porto'dan sonra Madeira'ya geçelim: 11-13 Funchal, 13-15 Gaula");
  await board.getByRole("button", { name: "Gönder" }).click();
  await updated.nth(before).waitFor({ timeout: 20000 });
  await board.waitForFunction(
    () => /^Porto · Madeira(, \S+)?$/.test(document.querySelector(".x-hero .x-big .x-where")?.textContent ?? ""),
    null,
    { timeout: 15000 },
  );
  const stays = await bopen("stay");
  await stays.locator(".q-ints > .q-int", { hasText: "Gaula" }).first().waitFor();
  await stays.locator(".q-ints > .q-int", { hasText: "Funchal" }).first().waitFor();
  assert.equal(await board.locator(".x-hero .x-big .x-where", { hasText: "Gaula" }).count(), 0, "a town on Madeira isn't a destination of its own");
  assert.equal(new Set(placePrompts).size, placePrompts.length, "the main places are asked once per set of cities");
  assert.match(placePrompts.at(-1), /Porto[\s\S]*Funchal[\s\S]*Gaula/);
  const labels = await board.waitForFunction(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const t = trips.find((x) => x.title === "Portekiz");
    return t.placeParents && t.prefLabels && Object.values(t.prefLabels).includes("Şarap tadımı") ? { parents: t.placeParents.parents, labels: t.prefLabels } : null;
  }, null, { timeout: 15000 });
  // Porto answered null is kept as "" (0.35.6 review): the region table never folds a place the model kept.
  assert.deepEqual((await labels.jsonValue()).parents, { funchal: "Madeira", gaula: "Madeira", porto: "" });
  assert.equal(notePrompts.filter((p) => p.includes("şarap tadımına")).length, 1, "a note is named once");
  await board.locator(".x-hero").scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/14-hero-main-places.png` });
  // Günlük akış says the routes the hero's way (display only): "Porto → Madeira", never "Porto → Funchal"; within
  // one main place the places themselves ("Funchal → Gaula", never "Madeira → Madeira"); nothing saved, a "Yolculuk".
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".dg-ttl", { hasText: "Porto → Madeira" }).first().waitFor();
  const routes = await board.locator(".dg-ttl").allInnerTexts();
  assert.ok(!routes.some((t) => /Porto → (Funchal|Gaula)|Madeira → Madeira/.test(t)), `routes by main place (${routes.filter((t) => t.includes("→"))})`);
  assert.ok(routes.includes("Uçuş · Porto → Madeira") && routes.includes("Yolculuk · Funchal → Gaula"), `routes (${routes.filter((t) => t.includes("→"))})`);
  await board.getByRole("tab", { name: "Plan", exact: true }).click();
  console.log('✓ revizyon 1: stays in Funchal and Gaula → the hero says "Porto | Madeira" (asked once), the Plan keeps Gaula; a note named by the model once');

  // 15. Content arriving (src/app/arrive): an Airbnb link sent in the chat waits as a quiet card at the top of
  // Konaklama (the section guessed from the address) while it's read, then its card slides in with a ring and
  // the chat's chip under the link says where it went ("göster" goes to it). The model answers a little late
  // here, so the waiting card can be seen.
  const arriveExtraction = {
    ...casaExtraction, name: "Casa Verde", summary: "Funchal, okyanus manzaralı daire", city: "Funchal",
    location: { address: null, area: "Sé", approximate: true }, dates: { start: "2026-10-11", end: "2026-10-13", source: "page" },
    price: { ...casaExtraction.price, amount: 210, evidence: "€ 210 total" }, need_key: "stay:funchal",
  };
  await flow.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const request = route.request();
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    const extracting = body?.generationConfig?.responseJsonSchema && prompt.includes("e2e-arrive") && !/<place>|<engine_result>|<places>|<notes>/.test(prompt);
    if (!extracting) return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return route.fulfill(reply([{ text: JSON.stringify(arriveExtraction) }]));
  });
  await board.locator(".x-hero").scrollIntoViewIfNeeded();
  // The stays the chat just added had their own toast ("2 kayıt plana eklendi"); it goes by itself.
  await board.locator(".ar-toast").waitFor({ state: "detached", timeout: 8000 });
  const itemNames = () => board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    return new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result.map((i) => `${i.id}:${i.name}`))));
  });
  const namesBefore = await itemNames();
  await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("https://www.airbnb.com/rooms/4242?e2e-arrive");
  await board.getByRole("button", { name: "Gönder" }).click();
  const waitingStay = bsec("stay").locator(".ar-pending", { hasText: "airbnb.com" });
  await waitingStay.waitFor({ timeout: 8000 });
  assert.match(await waitingStay.innerText(), /Airbnb okunuyor…|Fiyat ve tarihler bulunuyor…|Plana yerleşiyor…/);
  assert.equal(await board.locator(".ar-lead .ar-pending", { hasText: "airbnb.com" }).count(), 0, "a link from Airbnb waits in Konaklama, not under the header");
  // The chat shows the link as sent, its chip working.
  const arriveChip = board.locator(".ar-sent", { hasText: "e2e-arrive" }).locator(".ar-chip");
  await arriveChip.locator(".ar-spin").waitFor();
  await waitingStay.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/15a-arrive-pending.png` });
  // It lands: the waiting card gives way, the new card comes in with the arrival class.
  // v11: it joins its need's card ("N seçenek ›"): that card is the one that rings.
  const landed = bsec("stay").locator(".ar-new");
  await landed.first().waitFor({ state: "attached", timeout: 25000 });
  assert.equal(await waitingStay.count(), 0, "the waiting card gives way to the card");
  await landed.first().scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/15b-arrive-landed.png` });
  // The chip says where it went, and goes there.
  await arriveChip.locator(".ar-chip-text", { hasText: "✓ Konaklama'ya eklendi" }).waitFor({ timeout: 5000 });
  // Saved once, as a new record (a listing id of its own: not merged into an earlier save of the same page).
  await board.locator(".chat .msg-event", { hasText: "✓ Casa Verde kaydedildi" }).waitFor({ timeout: 5000 });
  assert.equal(await board.locator(".chat .msg-event", { hasText: "Casa Verde güncellendi" }).count(), 0, "no second pass over the same link");
  const toast = board.locator(".ar-toast");
  if (await toast.count()) {
    const added = (await itemNames()).filter((n) => !namesBefore.includes(n));
    assert.match(await toast.innerText(), /Konaklama'ya eklendi: Casa Verde/, `new records: ${added.join(", ")}`);
  }
  await board.locator(".chat").screenshot({ path: `${out}/15c-chat-chip.png` });
  await board.locator(".x-hero").scrollIntoViewIfNeeded();
  await arriveChip.getByRole("button", { name: "göster" }).click();
  await board.locator('[data-item-id].flash, [data-option-ids].flash').first().waitFor({ state: "attached", timeout: 5000 });
  // A link that couldn't be read: its card stays in sight under the Plan's header, even though its guessed
  // section (Konaklama) is closed, with "Tekrar dene" and "Kaldır"; Kaldır takes it away.
  const staySec = bsec("stay");
  if (await staySec.evaluate((el) => el.classList.contains("open"))) await staySec.locator(".q-tt").click();
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({
      id: "e2e-arrive-fail", kind: "paste-link", url: "https://www.airbnb.com/rooms/5150", title: null, pageText: "", viewportText: "", selection: "",
      jsonLd: [], meta: {}, screenshot: null, capturedAt: Date.now(), status: "error", error: "Sayfa açılamadı (e2e)", itemId: null,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const failedCard = board.locator(".ar-lead .ar-failed", { hasText: "airbnb.com" });
  await failedCard.waitFor();
  assert.ok(!(await staySec.evaluate((el) => el.classList.contains("open"))), "its guessed section stays closed");
  assert.match(await failedCard.innerText(), /Okunamadı[\s\S]*Sayfa açılamadı \(e2e\)/);
  await failedCard.getByRole("button", { name: "Tekrar dene" }).waitFor();
  await failedCard.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/15e-arrive-failed.png` });
  await failedCard.getByRole("button", { name: "Kaldır" }).click();
  await failedCard.waitFor({ state: "detached" });

  // A file dragged over the board: a calm overlay over the panel, gone when it leaves.
  const dragged = await board.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["%PDF-1.4"], "bilet.pdf", { type: "application/pdf" }));
    return dt;
  });
  await board.dispatchEvent(".panel", "dragenter", { dataTransfer: dragged });
  await board.locator(".ar-drop", { hasText: "Bırak, okuyup doğru yere koyayım" }).waitFor();
  await board.waitForTimeout(300); // its fade-in
  await board.screenshot({ path: `${out}/15d-drop-overlay.png` });
  await board.dispatchEvent(".panel", "dragleave", { dataTransfer: dragged });
  await board.locator(".ar-drop").waitFor({ state: "detached" });
  console.log("✓ arrivals: an Airbnb link waits in Konaklama while read, lands with a ring; the chat's chip says where and goes there; a drop overlay over the board");

  // 24a. The owner's report (2026-10-06): a Bali tour from Tripadvisor ("Nusa Penida 2Day 1Night", Denpasar, the
  // page's date picker on 8 October) sent while the Portugal trip is open lands in the Bali trip, never on the
  // Portugal trip's 8 October; the Portugal chat says where it went (Aç · Geri al). A place with no trip of its own
  // is asked about ("Bu yer Japonya'da, gezin Portekiz'de"); a page that isn't travel (humanoid robots) too.
  const routedNames = (title) => board.evaluate(async (title) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = (store) => new Promise((resolve) => (database.transaction(store).objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result)));
    const trips = await all("trips");
    const trip = trips.find((t) => t.title === title);
    return trip ? (await all("items")).filter((i) => i.tripId === trip.id).map((i) => i.name) : null;
  }, title);
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction(["trips", "items"], "readwrite");
    const now = Date.now();
    tx.objectStore("trips").put({ id: "e2e-route-bali", title: "Bali", confirmedDates: { start: "2027-01-10", end: "2027-01-20" }, budget: null, heroImage: null, createdAt: now, updatedAt: 1 });
    tx.objectStore("items").put({
      id: "e2e-route-sanur", tripId: "e2e-route-bali", captureIds: [], key: null, category: "stay", needKey: "stay:sanur", name: "Sanur Villa", provider: null, summary: "", optionDetail: null,
      url: null, imageUrl: null, city: "Sanur", country: "Endonezya", countryCode: "ID", location: { address: null, area: null, approximate: false },
      dates: { start: "2027-01-10", end: "2027-01-20", source: "user" }, guests: { adults: 2, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: now, updatedAt: now,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const routedExtraction = (over) => ({
    ...casaExtraction, category: "activity", provider: "Tripadvisor", summary: "2 gün 1 gece tur", option_detail: null,
    location: { address: null, area: null, approximate: false }, guests: { adults: 2, children: null, rooms: null },
    price: { ...casaExtraction.price, amount: 73, currency: "USD", scope: "per_person", evidence: null, source: "screenshot" },
    rating: { value: 5, scale: 5, count: 4, source: "screenshot", evidence: null }, metrics: null, highlights: [], concerns: [],
    dates: { start: "2026-10-08", end: null, source: "page" }, ...over,
  });
  const nusaExtraction = routedExtraction({
    name: "Nusa Penida 2Day 1Night With Accomodation", city: "Denpasar", country: "Endonezya", country_code: "ID",
    trip: { existing_trip_id: null, new_trip_title: "Bali" }, need_key: "activity:denpasar",
  });
  const kyotoExtraction = routedExtraction({
    name: "Kyoto Tea Ceremony", city: "Kyoto", country: "Japonya", country_code: "JP", trip: { existing_trip_id: null, new_trip_title: "Japonya" }, need_key: "activity:kyoto",
  });
  const robotsExtraction = routedExtraction({
    category: "other", name: "Realbotix Echo Humanoid Robots", city: null, country: "ABD", country_code: "US", dates: { start: null, end: null, source: "none" },
    price: { ...casaExtraction.price, amount: null, evidence: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none", evidence: null },
    trip: { existing_trip_id: null, new_trip_title: null }, need_key: "other:robots", travel: false,
  });
  const routedModel = async (route) => {
    const request = route.request();
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    const extracting = body?.generationConfig?.responseJsonSchema && !/<place>|<engine_result>|<places>|<notes>|<suggest_review>/.test(prompt);
    const page = extracting && (prompt.includes("e2e-nusa") ? nusaExtraction : prompt.includes("e2e-kyoto") ? kyotoExtraction : prompt.includes("e2e-robots") ? robotsExtraction : null);
    return page ? route.fulfill(reply([{ text: JSON.stringify(page) }])) : route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", routedModel);
  const composer = board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…");
  await composer.fill("https://www.tripadvisor.com/AttractionProductReview-g297694-d23-Nusa_Penida_2Day_1Night.html?e2e-nusa");
  await board.getByRole("button", { name: "Gönder" }).click();
  const moved = board.locator('.chat .msg-route[data-routing="moved"]', { hasText: "Nusa Penida" });
  await moved.waitFor({ timeout: 25000 });
  assert.match(await moved.innerText(), /Nusa Penida 2Day 1Night With Accomodation Bali gezine eklendi \(yeri Endonezya\)/);
  await moved.getByRole("button", { name: "Aç" }).waitFor();
  await moved.getByRole("button", { name: "Geri al" }).waitFor();
  // The board's own notice (a capture that landed in another trip), and the chip under the link.
  await board.locator(".toast", { hasText: "Bali" }).waitFor({ timeout: 10000 });
  await board.locator(".ar-sent", { hasText: "e2e-nusa" }).locator(".ar-chip-text", { hasText: "✓ Bali gezisine eklendi" }).waitFor({ timeout: 5000 });
  assert.deepEqual((await routedNames("Bali")).sort(), ["Nusa Penida 2Day 1Night With Accomodation", "Sanur Villa"]);
  assert.ok(!(await routedNames("Portekiz")).some((n) => n.startsWith("Nusa Penida")), "the Portugal trip has no Nusa Penida");
  assert.equal(await board.locator(".panel", { hasText: "Nusa Penida" }).count(), 0, "nothing of it on the Portugal board (Etkinlikler, its days)");
  await board.locator(".chat").screenshot({ path: `${out}/24a-routed-chat.png` });
  await board.screenshot({ path: `${out}/24a-routed-board.png` });

  // No trip of its place: asked, nothing added, no trip made behind the scenes.
  await composer.fill("https://www.tripadvisor.com/AttractionProductReview-g298564-d7-Tea_Ceremony.html?e2e-kyoto");
  await board.getByRole("button", { name: "Gönder" }).click();
  const placeAsk = board.locator('.chat .msg-route.ask', { hasText: "Kyoto Tea Ceremony" });
  await placeAsk.waitFor({ timeout: 25000 });
  assert.match(await placeAsk.innerText(), /Kyoto Tea Ceremony: bu yer Japonya'da, gezin Portekiz.*Nereye ekleyeyim\?/);
  await placeAsk.getByRole("button", { name: "Bu geziye yine de ekle" }).waitFor();
  await placeAsk.getByRole("button", { name: "Yeni gezi: Japonya" }).waitFor();
  await board.locator(".ar-sent", { hasText: "e2e-kyoto" }).locator(".ar-chip-text", { hasText: "Eklenmedi" }).waitFor({ timeout: 5000 });
  assert.equal(await routedNames("Japonya"), null, "no Japan trip made without asking");
  await board.locator(".chat").screenshot({ path: `${out}/24a-ask-place.png` });
  await placeAsk.getByRole("button", { name: "Ekleme" }).click();
  await board.locator('.chat .msg-route[data-routing="ask"]', { hasText: "Kyoto Tea Ceremony" }).getByText("Eklenmedi").waitFor();
  assert.ok(!(await routedNames("Portekiz")).includes("Kyoto Tea Ceremony"));

  // Not travel at all: asked, not added.
  await composer.fill("https://www.realbotix.com/echo?e2e-robots");
  await board.getByRole("button", { name: "Gönder" }).click();
  const notTravel = board.locator('.chat .msg-route.ask', { hasText: "Realbotix" });
  await notTravel.waitFor({ timeout: 25000 });
  assert.match(await notTravel.innerText(), /bu sayfa bir gezi planına benzemiyor\. Yine de eklensin mi\?/);
  assert.ok(!(await routedNames("Portekiz")).includes("Realbotix Echo Humanoid Robots"));
  await board.locator(".chat").screenshot({ path: `${out}/24a-ask-travel.png` });
  await notTravel.getByRole("button", { name: "Ekleme" }).click();
  await board.locator('.chat .msg-route[data-routing="ask"]', { hasText: "Realbotix" }).getByText("Eklenmedi").waitFor();

  // Aç goes to the Bali trip, where the tour is; back to Portugal for what follows.
  await moved.getByRole("button", { name: "Aç" }).click();
  await board.getByRole("heading", { name: "Bali" }).waitFor();
  // (v82, B8: the trip's categories closed at first look; the tour is in Etkinlik ve turlar)
  const baliActs = board.locator('.q-sec[data-section="activity"]');
  if (!(await baliActs.evaluate((el) => el.classList.contains("open")))) await baliActs.locator(".q-tt").click();
  await board.locator(".panel", { hasText: "Nusa Penida" }).first().waitFor();
  await board.screenshot({ path: `${out}/24a-bali-trip.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", routedModel);
  await board.getByRole("button", { name: /Seyahatlerim/ }).click();
  await board.locator(".trip-card", { hasText: "Portekiz" }).click();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  // 24b. Saved before the check: a Bali tour already in the Portugal trip. On the board's next open the trip asks
  // once ("Bu başka bir geziye ait görünüyor: … (Endonezya)") with [Bali gezisine taşı] [Burada kalsın] [Plandan
  // çıkar]; nothing moves by itself; the chip moves it.
  await board.evaluate(async () => {
    history.replaceState(null, "", location.pathname); // Aç left the Bali trip in the address: the reload opens Portekiz
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = (store) => new Promise((resolve) => (database.transaction(store).objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result)));
    const portugal =(await all("trips")).find((t) => t.title === "Portekiz");
    const stray = (await all("items")).find((i) => i.id === "e2e-route-sanur");
    const tx = database.transaction(["trips", "items"], "readwrite");
    const { strayCheckedAt: _seen, ...unchecked } = portugal;
    tx.objectStore("trips").put(unchecked);
    tx.objectStore("items").put({ ...stray, id: "e2e-old-stray", tripId: portugal.id, name: "Kecak Fire Dance", category: "activity", city: "Uluwatu", status: "saved", dates: { start: null, end: null, source: "none" } });
    await new Promise((resolve) => (tx.oncomplete = resolve));
  });
  await board.reload();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  const strayLine = board.locator('.chat .msg-route[data-routing="stray"]', { hasText: "Kecak Fire Dance" });
  await strayLine.waitFor({ timeout: 10000 });
  assert.match(await strayLine.innerText(), /Bu başka bir geziye ait görünüyor: Kecak Fire Dance \(Endonezya\)/);
  await strayLine.getByRole("button", { name: "Burada kalsın" }).waitFor();
  await strayLine.getByRole("button", { name: "Plandan çıkar" }).waitFor();
  assert.ok((await routedNames("Portekiz")).includes("Kecak Fire Dance"), "nothing moves by itself");
  await board.locator(".chat").screenshot({ path: `${out}/24b-stray-ask.png` });
  await strayLine.getByRole("button", { name: "Bali gezisine taşı" }).click();
  await strayLine.getByText("taşındı").waitFor();
  assert.ok((await routedNames("Bali")).includes("Kecak Fire Dance"));
  assert.ok(!(await routedNames("Portekiz")).includes("Kecak Fire Dance"));
  // Asked once: another open doesn't ask again.
  await board.reload();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  await board.waitForTimeout(500);
  assert.equal(await board.locator('.chat .msg-route[data-routing="stray"]').count(), 1, "the line is asked once");
  console.log("✓ 24b strays: a Bali record saved before the check is asked about once in the Portugal chat; 'Bali gezisine taşı' moves it");

  // The steps after this one know two trips: the Bali one goes, and the address no longer names it.
  await board.evaluate(async () => {
    history.replaceState(null, "", location.pathname);
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction(["trips", "items", "messages"], "readwrite");
    tx.objectStore("trips").delete("e2e-route-bali");
    for (const store of ["items", "messages"]) {
      tx.objectStore(store).getAll().onsuccess = (e) => {
        for (const row of e.target.result) if (row.tripId === "e2e-route-bali") tx.objectStore(store).delete(row.id);
      };
    }
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  console.log("✓ 24a trip routing: a Bali tour sent in the Portugal chat lands in the Bali trip (Aç · Geri al, the board's notice), not on Portugal's days; a place with no trip and a non-travel page are asked about, nothing added");

  // 19. Öneriler (spec 2026-10-06 §1): a trip with 25 nights in one city and no vehicle shows the monthly rental as
  // a card atop Ulaşım ("1 öneri" in its header, never in a count); "Plana ekle" adds a rental card; another
  // suggestion's "Gerek yok" takes it away, and it doesn't come back after a reload. The passport is set (as in
  // Settings): insurance and eSIM are suggested only for a home country the traveller chose, never the default.
  await board.evaluate(() => chrome.storage.local.set({ passport: "TR" }));
  await board.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction(["trips", "items"], "readwrite");
    const now = Date.now();
    tx.objectStore("trips").put({ id: "e2e-bali", title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-04" }, budget: null, heroImage: null, createdAt: now, updatedAt: now });
    tx.objectStore("items").put({
      id: "e2e-ubud", tripId: "e2e-bali", captureIds: [], key: null, category: "stay", needKey: "stay:ubud", name: "Ubud Villa", provider: null, summary: "",
      optionDetail: null, url: null, imageUrl: null, city: "Ubud", country: "Endonezya", countryCode: "ID",
      location: { address: null, area: null, approximate: false }, dates: { start: "2026-12-10", end: "2027-01-04", source: "page" },
      guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 1500, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: now, updatedAt: now,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await board.getByRole("button", { name: /Seyahatlerim/ }).click();
  await board.locator(".trip-card", { hasText: "Bali" }).click();
  await board.getByRole("heading", { name: "Bali" }).waitFor();
  const sgSec = (id) => board.locator(`.q-sec[data-section="${id}"]`);
  const openSec = async (id) => {
    if (!(await sgSec(id).evaluate((el) => el.classList.contains("open")))) await sgSec(id).locator(".q-tt").click();
    await sgSec(id).locator(".q-fold.on").waitFor(); // (a page behind another has its timers held back: the fold is open, "settled" may come late)
  };
  // Only suggested: nothing of its own settled to count (no "x/y"); v82 (C16): what's missing is an intent, one to decide.
  await sgSec("transport").locator(".q-pl1", { hasText: "1 karar" }).waitFor({ timeout: 10000 });
  assert.equal(await sgSec("transport").locator(".q-count").count(), 0, "a suggestion is never counted as settled");
  assert.equal(flat([await sgSec("transport").locator(".q-pl1").innerText()])[0], "1 karar");
  assert.ok(!(await sgSec("transport").evaluate((el) => el.classList.contains("open"))), "a category with only suggestions stays closed");
  await openSec("transport");
  const rentalCard = sgSec("transport").locator(".q-ints > .q-int", { has: board.locator(".q-nm", { hasText: "Aylık motor ya da araç kiralama" }) });
  await rentalCard.waitFor();
  // (0.38.5: no source looks for a rental, so its chip says so instead of "Aranıyor"; still a box to find, data-st todo)
  assert.equal(flat([await rentalCard.locator(".q-st").innerText()])[0], "Seçenek yok");
  assert.equal(await rentalCard.getAttribute("data-st"), "todo");
  // Ubud is Bali's (the hero's main place, from the table of regions): the nights are counted for Bali, said as why it's there.
  assert.match(await rentalCard.locator(".q-est").getAttribute("title"), /25 gece Bali'de kalıyorsun/);
  assert.doesNotMatch(await rentalCard.innerText(), /%/, "no invented percentage");
  assert.equal(await sgSec("transport").locator(".sg-card").count(), 0, "what's missing is never a suggestion card too");
  await sgSec("transport").scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/19-suggestions.png` });
  // Plana koy (its ⋯): the rental is a real record in Ulaşım now; the suggestion is done.
  await rentalCard.locator(".z-h .z-mb").click();
  await rentalCard.getByRole("menuitem", { name: "Plana koy" }).click();
  await rentalCard.waitFor({ state: "detached" });
  // The rental's box (kind "Motosiklet", the place's days), planned and not booked: a real "0/1" now.
  await sgSec("transport").getByText("Motosiklet", { exact: true }).first().waitFor();
  assert.match(await sgSec("transport").locator(".q-count").textContent(), /^0\/1$/);
  assert.equal(await sgSec("transport").locator(".q-sgn").count(), 0);
  // v82 (C16): insurance and the eSIM are Belgeler ve internet's intents, Aranıyor, as large as any box: insurance with a
  // search to compare, the eSIM with Airalo and Holafly for Indonesia ("Kendin ara").
  await openSec("other");
  const insCard = sgSec("other").locator('.q-ints > .q-int[data-intent="suggestion:rule:insurance"]');
  await insCard.waitFor();
  assert.equal(await insCard.locator(".q-nm").innerText(), "Seyahat sağlık sigortası");
  // (0.38.5: nothing looks for insurance by itself: "Seçenek yok", not "Aranıyor"; the eSIM's source is asked: Aranıyor)
  assert.equal(flat([await insCard.locator(".q-st").innerText()])[0], "Seçenek yok");
  assert.ok((await insCard.locator(".z-pi").evaluateAll((els) => els.map((a) => a.getAttribute("href")))).some((h) => /^https:\/\/www\.google\.com\/search\?q=seyahat%20sa%C4%9Fl%C4%B1k%20sigortas%C4%B1%20Endonezya$/.test(h)), "insurance's search to compare");
  assert.equal(await sgSec("other").locator(".sg-card", { hasText: "sigorta" }).count(), 0, "insurance is never a suggestion card too");
  const esimCard = sgSec("other").locator('.q-ints > .q-int[data-intent="suggestion:rule:esim"]');
  await esimCard.waitFor();
  assert.match(await esimCard.locator(".q-nm").innerText(), /eSIM/);
  assert.equal(flat([await esimCard.locator(".q-st").innerText()])[0], "Aranıyor");
  assert.deepEqual(await esimCard.locator(".z-pi").evaluateAll((els) => els.map((a) => a.getAttribute("href"))), ["https://www.airalo.com/indonesia-esim", "https://esim.holafly.com/esim-indonesia/"]);
  assert.equal(await sgSec("other").locator(".sg-card", { hasText: "eSIM" }).count(), 0, "the eSIM is never a suggestion card too");
  // Gerek yok (⋯): the eSIM's box goes (its suggestion dismissed, under Gizlenenler), the insurance's stays.
  const esimRect = await esimCard.boundingBox();
  const insRect = await insCard.boundingBox();
  assert.ok(Math.abs(esimRect.height - insRect.height) < 2, `insurance and eSIM as large (${JSON.stringify([esimRect, insRect])})`);
  await esimCard.locator(".z-h .z-mb").click();
  await esimCard.getByRole("menuitem", { name: "Gerek yok" }).click();
  await esimCard.waitFor({ state: "detached" });
  await insCard.waitFor();
  await board.waitForTimeout(300); // the trip write lands
  await board.reload();
  await board.getByRole("heading", { name: "Bali" }).waitFor();
  await sgSec("other").waitFor({ timeout: 10000 });
  await openSec("other");
  await insCard.waitFor();
  assert.equal(await sgSec("other").locator('.sg-card:has-text("eSIM"), .q-ints > .q-int[data-intent="suggestion:rule:esim"]').count(), 0, "Gerek yok is for good");
  await sgSec("other").locator(".q-hid > summary", { hasText: "Gizlenenler · 1" }).waitFor();
  await openSec("transport");
  assert.equal(await sgSec("transport").locator('.sg-card, .q-ints > .q-int[data-intent^="suggestion:"]').count(), 0, "the added suggestion doesn't come back");
  await sgSec("transport").getByText("Motosiklet", { exact: true }).first().waitFor();
  // Asked once for each route and days (0.38.5: other places or dates are asked again; a new stay waits a day).
  const ubudAsks = reviewPrompts.filter((p) => p.includes("Ubud")).map((p) => { const d = JSON.parse(p.split("\n")[1]); return JSON.stringify([d.places.map((x) => x.name).sort(), d.dates]); });
  assert.ok(ubudAsks.length >= 1 && new Set(ubudAsks).size === ubudAsks.length, `the AI review is asked once per route and days (${ubudAsks.join(" | ")})`);
  await openSec("other");
  await sgSec("other").scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/19b-suggestions-after.png` });
  console.log("✓ öneriler: 25 nights in Ubud and no vehicle → monthly rental card atop Ulaşım (not counted); Plana ekle adds the rental; Gerek yok on the eSIM holds after a reload; the AI review asked once");

  // 20. Starting a trip by chat (spec 2026-10-06 §2): one message on the home fills who, when and where; the
  // chips finish it (Nereden İstanbul, a style, the route "Bu olsun"); Gezimi oluştur → the board shows the
  // nights by stop and the flights to plan, the start card above the plan, the interview as the trip's chat.
  const startPrompts = [];
  // A quick answer's reply in the model's words (revision 2): here none comes back, so the code's lines stand.
  const replyPrompts = [];
  await flow.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const request = route.request();
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    if (prompt.includes("<start_message>")) {
      startPrompts.push(prompt);
      const first = prompt.includes("Sabine'yle 10 Aralık");
      return route.fulfill(reply([{ text: JSON.stringify({
        destination: first ? "Bali" : "", destination_country: first ? "Endonezya" : "", destination_country_code: first ? "ID" : "", origin: "", companions: "", names: first ? ["Sabine"] : [],
        start_date: first ? "2026-12-10" : "", start_month: 0, duration_days: 0, duration_months: first ? 1 : 0, styles: [], budget: "",
        reply: { text: "", question: "" },
      }) }]));
    }
    if (prompt.includes("<start_reply>")) {
      replyPrompts.push(prompt);
      // Lizbon's month tapped (step 20e): the day asked in the model's words, after the 6 s the old wait gave it (0.38.5).
      if (prompt.includes("Lizbon") && prompt.includes("→ Aralık")) {
        await new Promise((r) => setTimeout(r, 7000));
        return route.fulfill(reply([{ text: JSON.stringify({ text: "", question: "Aralık'ta Lizbon güzel olur; ayın kaçında yola çıkmayı düşünüyorsun?" }) }]));
      }
      return route.fulfill(reply([{ text: JSON.stringify({ text: "", question: "" }) }]));
    }
    if (prompt.includes("<route_request>")) {
      startPrompts.push(prompt);
      return route.fulfill(reply([{ text: JSON.stringify({
        stops: [{ city: "Ubud", nights: 12, country_code: "ID" }, { city: "Canggu", nights: 10, country_code: "ID" }, { city: "Uluwatu", nights: 9, country_code: "ID" }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar",
      }) }]));
    }
    return route.fallback();
  });
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.locator(".st-hello").waitFor();
  await board.screenshot({ path: `${out}/20a-start-home.png` });
  await board.getByLabel("Gezi kutusu").fill("Sabine'yle 10 Aralık'tan 1 ay Bali");
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  // A trip called "Bali" is there already (step 19): add to it, or a new trip? (item 4) → a new one.
  const ask = board.locator(".st-ask", { hasText: "Bali'ye mi ekleyeyim, yeni gezi mi?" });
  await ask.waitFor();
  await ask.getByRole("button", { name: "Yeni gezi" }).click();
  const answers = board.locator(".st-answers");
  // The generating screen opens the board by itself a few seconds in (v5: the trip is made at its own pace, the board
  // opens once made and landed, at most 6 s after the map starts), so what it shows is recorded as it happens (a
  // MutationObserver set before "Oluştur") and checked afterwards: a slow screenshot never makes a check miss it.
  const watchGen = () =>
    board.evaluate(() => {
      const seen = { phases: [], steps: [], plane: false, home: false, ring: false, stops: [], fest: [], stopsIn: 0, cards: 0, canvas: 0, land: 0, credit: "", sub: "", title: "", mark: 0 };
      window.__gen = seen;
      const look = () => {
        const gen = document.querySelector(".st-gen");
        if (!gen) return;
        seen.title = gen.querySelector("h2")?.textContent ?? seen.title;
        seen.sub = gen.querySelector(".st-gen-sub")?.textContent ?? seen.sub;
        seen.canvas = Math.max(seen.canvas, gen.querySelectorAll("canvas").length);
        const mark = gen.querySelector(".st-step-mark");
        if (mark) seen.mark = mark.offsetWidth;
        for (const s of gen.querySelectorAll(".st-step.done .st-step-text")) if (!seen.steps.includes(s.textContent)) seen.steps.push(s.textContent);
        const gm = gen.querySelector(".gm");
        if (!gm) return;
        if (seen.phases.at(-1) !== gm.dataset.phase) seen.phases.push(gm.dataset.phase);
        seen.land = Math.max(seen.land, gm.querySelectorAll("svg .gm-land").length);
        seen.credit = gm.querySelector(".gm-credit")?.textContent ?? seen.credit;
        seen.plane ||= Boolean(gm.querySelector(".gm-plane"));
        seen.home ||= Boolean(gm.querySelector(".gm-home.in"));
        seen.ring ||= Boolean(gm.querySelector(".gm-ring.go"));
        seen.stops = [...gm.querySelectorAll(".gm-stop")].map((n) => n.dataset.name);
        seen.fest = [...gm.querySelectorAll(".gm-stop.fest")].map((n) => n.dataset.name);
        seen.stopsIn = Math.max(seen.stopsIn, gm.querySelectorAll(".gm-stop.in").length);
        seen.cards = Math.max(seen.cards, gm.querySelectorAll(".gm-photos .gm-card.in").length);
        // Stops never drop before the plane lands.
        if (gm.dataset.phase === "flying" && gm.querySelector(".gm-stop.in")) seen.early = true;
      };
      new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  // Read once the generating screen has closed (the board is open).
  const genSeen = async () => {
    await board.locator(".st-gen").waitFor({ state: "detached", timeout: 20000 });
    return board.evaluate(() => window.__gen);
  };
  // K4 (2026-10-09): what they want comes first, where from is asked last. Only what the first message left out is asked (item 2).
  // (0.38.5: the place and the company in the question, never a form's fixed words.)
  await board.locator(".st-msg-bot", { hasText: "Bali'de en çok ne yapmak istersiniz?" }).waitFor();
  const side = board.locator(".st-side");
  const list = side.locator(".st-list");
  await list.getByText("Bali · Endonezya").waitFor();
  await list.getByText("10 Aralık – 10 Ocak · 31 gece").waitFor();
  await list.getByText("Sabine ile · 2 kişi").waitFor();
  await answers.getByRole("button", { name: /Doğa/ }).click();
  await answers.getByRole("button", { name: /Deniz/ }).click();
  await answers.getByRole("button", { name: /Orta/ }).click();
  await answers.getByRole("button", { name: "Tamam" }).click();
  await board.locator(".st-msg-bot", { hasText: "Rota önerim: Ubud 12 · Canggu 10 · Uluwatu 9 gece. Bu olsun mu?" }).waitFor();
  assert.equal(startPrompts.length, 2, "the model read the one typed line and was asked for the route once (prepared in the background as soon as Bali and 31 nights were known)");
  // 0.38.5: a chip's next question may be asked in the model's words, but never the route's (its stops are the code's).
  assert.equal(replyPrompts.length, 0, "the style chips lead to the route: no model call for its words");
  await board.screenshot({ path: `${out}/20b-start-interview.png` });
  // Narrow (item 9): the list folds into a bar above the chat.
  await board.setViewportSize({ width: 560, height: 900 });
  await board.locator(".st-bar", { hasText: "Gezin şekilleniyor" }).waitFor();
  assert.equal(await side.isVisible(), false, "no side list on a narrow screen");
  await board.screenshot({ path: `${out}/20b2-start-narrow.png` });
  await board.setViewportSize({ width: 1440, height: 900 });
  await answers.getByRole("button", { name: "Bu olsun" }).click();
  // Where from is the last question: the origin's guess first. (0.38.4: asked for this trip and these two, never a bare "Nereden?".)
  await board.locator(".st-msg-bot", { hasText: "Bali'ye nereden yola çıkıyorsunuz?" }).waitFor();
  assert.equal(await answers.locator(".st-chip").first().innerText(), "İstanbul", "the origin's guess comes first");
  await answers.getByRole("button", { name: "İstanbul", exact: true }).click();
  await board.locator(".st-msg-bot", { hasText: "Hazırım, birkaç saniye içinde oluşturuyorum. Eklemek istediğin bir şey varsa yaz." }).waitFor();
  // Stopped, the line says it waits; "oluştur" typed makes it at once.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  // "Tamam, bekliyorum…", or just "Bekliyorum…" right after another "Tamam" (never twice in a row); hasText ignores case.
  await board.locator(".st-msg-bot", { hasText: "bekliyorum. Hazır olunca Oluştur'a bas ya da 'oluştur' yaz." }).waitFor();
  assert.equal(await board.locator(".st-msg-bot", { hasText: "Hazırım" }).count(), 0, "the ready line said as waiting");
  await watchGen();
  await board.locator(".st-chat").getByLabel("Mesaj").fill("oluştur");
  await board.locator(".st-chat").getByLabel("Mesaj").press("Enter");
  await board.locator(".st-gen", { hasText: /Bali.* planlanıyor/ }).waitFor();
  await board.screenshot({ path: `${out}/20c-start-generating.png` });
  // The board: the trip, its nights by stop and its flights to plan, the start card, the same conversation.
  await board.getByRole("heading", { name: titled("Bali") }).waitFor({ timeout: 20000 });
  const baliGen = await genSeen();
  assert.equal(baliGen.sub, "İstanbul → Ubud → Canggu → Uluwatu · 31 gece");
  assert.ok(baliGen.steps.some((x) => /^Gezi açıldı: .*Bali/.test(x)), "the trip opened");
  for (const step of ["İstanbul ⇄ Denpasar uçuşları için yer açıldı", "Rota çizildi: Ubud 12 gece → Canggu 10 gece → Uluwatu 9 gece"]) assert.ok(baliGen.steps.includes(step), `step "${step}" (${baliGen.steps.join(" | ")})`);
  // The suggestions' review is started as the last step and not waited for (2026-10-09): the board opens and they keep
  // arriving there (the same review the board runs, claimed first, so it isn't asked again there).
  assert.ok(baliGen.steps.some((x) => /Öneriler hazırlanıyor; panoda gelmeye devam edecek/.test(x)), "the suggestions' step");
  // (C18: the start card, its "Uçuşları bul" and "Konaklamaları seç", is not drawn in this version: only that is checked, below.)
  const guide = board.locator(".st-guide");
  if (START_CARD_SHOWN) {
    await guide.getByText("Uçuşları bul").waitFor();
    await guide.getByText("Konaklamaları seç").waitFor();
  }
  const made = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => /Bali/.test(t.title));
    const items = (await all("items")).filter((i) => i.tripId === trip.id);
    return {
      dates: trip.confirmedDates,
      stays: items.filter((i) => i.category === "stay").map((i) => `${i.city} ${i.dates.start}..${i.dates.end}`).sort(),
      flights: items.filter((i) => i.category === "flight").map((i) => `${i.dates.start} ${i.flight.from}→${i.flight.to}`).sort(),
      people: [...new Set(items.map((i) => i.guests.adults))],
      travellers: trip.travellers,
      style: trip.style.ids,
      countries: [...new Set(items.filter((i) => i.category === "stay").map((i) => i.countryCode))],
      notes: (await all("preferences")).filter((p) => p.tripId === trip.id).length,
    };
  });
  assert.deepEqual(made, {
    dates: { start: "2026-12-10", end: "2027-01-10" },
    stays: ["Canggu 2026-12-22..2027-01-01", "Ubud 2026-12-10..2026-12-22", "Uluwatu 2027-01-01..2027-01-10"],
    flights: ["2026-12-10 İstanbul→Denpasar", "2027-01-10 Denpasar→İstanbul"],
    people: [2],
    travellers: { names: ["Sabine"], count: 2 },
    style: ["nature", "beach"],
    countries: ["ID"],
    notes: 0,
  });
  // The hero tells the truth: a new backbone, its needs still to fill (C19: "N ihtiyaç", no "%0"; no "Uçuşlar hazır"), "Sıradaki"
  // the way out; the style words picked, who goes and the country are there at once.
  const hero = board.locator(".x-hero");
  await hero.locator(".x-ps", { hasText: /^\d+ ihtiyaç/ }).waitFor();
  assert.match((await hero.locator(".x-next").innerText()).replace(/\s+/g, " ").trim(), /^Sıradaki .*(uçuşu|konaklaması)$/);
  // The review ran once, in the generating step; the board, opening on the same main places and key, didn't ask again.
  await board.waitForTimeout(1500);
  assert.equal(reviewPrompts.filter((p) => p.includes("Uluwatu")).length, 1, "the start's review is the board's: asked once");
  assert.equal(await hero.getByText("Uçuşlar hazır", { exact: false }).count(), 0, "placeholders are not chosen flights");
  await hero.getByText("Doğa", { exact: true }).first().waitFor();
  await hero.getByText("Deniz", { exact: true }).first().waitFor();
  await hero.locator('.x-face[aria-label^="Sabine"]').waitFor();
  await hero.getByText("Endonezya", { exact: false }).first().waitFor();
  assert.equal(await hero.getByText("Ülke ve hava, şehir belli olunca gelir").count(), 0, "the country is known");
  const panel = board.locator(".panel");
  // (v82, B8: closed at first look; each opened in turn)
  const openHere = async (id) => {
    const sec = panel.locator(`.q-sec[data-section="${id}"]`);
    if (!(await sec.evaluate((el) => el.classList.contains("open")))) await sec.locator(".q-tt").click();
    await sec.locator(".q-fold.on").waitFor(); // (a page behind another has its timers held back: the fold is open, "settled" may come late)
  };
  await openHere("stay");
  for (const city of ["Ubud", "Canggu", "Uluwatu"]) await panel.locator("[data-section='stay']").getByText(city, { exact: false }).first().waitFor();
  await openHere("flight");
  await panel.locator("[data-section='flight']").getByText("Denpasar", { exact: false }).first().waitFor();
  await board.locator(".chat .msg-user", { hasText: "Sabine'yle 10 Aralık'tan 1 ay Bali" }).waitFor();
  // "oluştur" typed is kept as said (not swapped for the button's words).
  await board.locator(".chat .msg-user", { hasText: /^oluştur$/ }).waitFor();
  await board.locator(".chat .msg-assistant", { hasText: /Bali.* hazır: 31 gece, 3 durak\./ }).waitFor();
  if (START_CARD_SHOWN) await guide.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/20d-start-board.png` });
  if (START_CARD_SHOWN) {
    // × closes the start card for good.
    await guide.getByRole("button", { name: "Başlangıç kartını kapat" }).click();
    await guide.waitFor({ state: "detached" });
  } else assert.equal(await guide.count(), 0, "C18 (row 200): no start card above the plan in this version");
  console.log("✓ start by chat: one line fills who/when/where, chips finish it, the route agreed → Bali Gezisi with Ubud 12 · Canggu 10 · Uluwatu 9 nights, İstanbul ⇄ Denpasar flights to fill (not chosen), Emre & Sabine, Doğa · Deniz, Indonesia, the suggestions' review, no start card (C18) and the same conversation");

  // 22. Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): the new trip's needs with nothing booked or saved are
  // the approved cards made plain: dashed, white, one grey word, then "Ara:" and the brands' searches, prefilled with
  // the cities, the dates and the two who go. No AI source is connected, so no "✨ Senin için N öneri" row.
  const ekSec = (id) => panel.locator(`.q-sec[data-section="${id}"]`);
  const ekOpen = async (id) => {
    if (!(await ekSec(id).evaluate((el) => el.classList.contains("open")))) await ekSec(id).locator(".q-tt").click();
    await ekSec(id).locator(".q-fold.on").waitFor(); // (a page behind another has its timers held back: the fold is open, "settled" may come late)
  };
  const hrefs = (scope) => scope.locator(".ek-link").evaluateAll((els) => els.map((a) => [a.dataset.brand, a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
  // Emre's rule: what the start made (startGuide.placeholders) is never a chosen "Seçildi · bilet alınmadı" card (v82: never
  // a Seçildi box either). One category open at a time (B8): each in turn.
  for (const id of ["flight", "stay", "transport", "other"]) {
    await ekOpen(id);
    assert.equal(await panel.locator('.cat-plan .pk-card.pk-r-half, .cat-plan .pk-card.pk-r-open:not(.ek-card), .cat-plan .settled-card, .cat-plan .q-int[data-st="sel"]').count(), 0, `${id}: no chosen card for a placeholder, only empty ones`);
    assert.equal(await panel.locator(".cat-plan .pk-cta", { hasText: /Bileti aldım|Rezerve ettim/ }).count(), 0);
  }
  await ekOpen("flight");
  // Uçuş (v82): İstanbul → Denpasar and back, each an Aranıyor ticket (the two cities, "Henüz seçenek yok"), no price, no
  // "Aldım"; "Kendin ara" (providers.ts): Skyscanner by airport, Google Uçuşlar by city, for the two who go.
  const flightBoxes = ekSec("flight").locator(".q-ints > .q-int");
  assert.equal(await flightBoxes.count(), 2, "both flights the start made are boxes still to find");
  const [outFlight, backFlight] = [flightBoxes.nth(0), flightBoxes.nth(1)];
  assert.equal(await outFlight.getAttribute("data-st"), "todo");
  assert.equal(flat([await outFlight.locator(".q-st").innerText()])[0], "Aranıyor");
  assert.match(flat([await outFlight.locator(".z-route").innerText()])[0], /^İstanbul .*Denpasar$/);
  assert.match(flat([await outFlight.locator(".z-car").innerText()])[0], /^Henüz seçenek yok/);
  assert.equal(await outFlight.locator(".z-top .q-pr, .q-got, .q-cta").count(), 0, "no price, no Aldım");
  // (a v82 box's "Kendin ara" marks: their words, where they go)
  const pis = (scope) => scope.locator(".z-pi").evaluateAll((els) => els.map((a) => [a.getAttribute("aria-label"), a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
  const out1 = await pis(outFlight);
  assert.deepEqual(out1.map(([n, , t, r]) => [n, t, r]), [["Skyscanner'da ara", "_blank", "noopener noreferrer"], ["Google Uçuşlar'da ara", "_blank", "noopener noreferrer"]]);
  assert.equal(out1[0][1], "https://www.skyscanner.net/transport/flights/ist/dps/261210/?adultsv2=2&rtn=0");
  assert.equal(new URL(out1[1][1]).searchParams.get("q"), "Flights from IST to DPS on 2026-12-10 one way");
  const back1 = await pis(backFlight);
  assert.equal(new URL(back1[1][1]).searchParams.get("q"), "Flights from DPS to IST on 2027-01-10 one way");
  assert.equal(back1[0][1], "https://www.skyscanner.net/transport/flights/dps/ist/270110/?adultsv2=2&rtn=0");
  for (const f of [outFlight, backFlight]) assert.equal(Math.round((await f.boundingBox()).height), 288);
  await ekSec("flight").screenshot({ path: `${out}/20f-empty-flight.png` });
  // Konaklama (v82): each stop's nights an Aranıyor box ("Ubud'da nerede kalınır"); "Kendin ara": Booking and Airbnb with
  // the nights and 2 adults.
  await ekOpen("stay");
  const ubud = ekSec("stay").locator('.q-ints > .q-int[aria-label="Ubud"]');
  assert.equal(await ubud.getAttribute("data-st"), "todo");
  assert.equal(flat([await ubud.locator(".q-st").innerText()])[0], "Aranıyor");
  assert.match(flat([await ubud.locator(".q-ln").innerText()])[0], /^12 gece/);
  assert.equal(await ubud.locator(".z-t").innerText(), "Ubud'da nerede kalınır");
  const ubudLinks = await ubud.locator(".z-pi").evaluateAll((els) => els.map((a) => [a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
  for (const want of ["https://www.booking.com/searchresults.html?ss=Ubud&checkin=2026-12-10&checkout=2026-12-22&group_adults=2&no_rooms=1", "https://www.airbnb.com/s/Ubud/homes?checkin=2026-12-10&checkout=2026-12-22&adults=2"]) {
    assert.ok(ubudLinks.some(([u, t, r]) => u === want && t === "_blank" && r === "noopener noreferrer"), `Kendin ara: ${want} (${JSON.stringify(ubudLinks)})`);
  }
  assert.equal(await ekSec("stay").locator(".q-ints > .q-int").count(), 3, "three stops, three empty stays");
  await ekSec("stay").screenshot({ path: `${out}/20f-empty-stay.png` });
  // Ulaşım (v82, C15): the changes of city with no plan, Aranıyor, "Nasıl gideceğin belli değil" and their ways drawn
  // (Tren · Otobüs · Araba · Uçak · Ben hallettim), looked for on the sites that compare every way. (An airport transfer with
  // no plan is a line of the itinerary, not a box of the plan, as it was.)
  await ekOpen("transport");
  const transfers = ekSec("transport").locator('.q-ints > .q-int[data-st="todo"]', { has: board.locator(".z-ways") });
  assert.ok((await transfers.count()) >= 2, "the changes of city with no plan are boxes still to find");
  const firstLeg = transfers.first();
  assert.match(flat([await firstLeg.locator(".z-car").innerText()])[0], /^Nasıl gideceğin belli değil/);
  assert.deepEqual(flat(await firstLeg.locator(".z-way").allInnerTexts()), ["Tren", "Otobüs", "Araba", "Uçak", "Ben hallettim"]);
  const legLinks = await pis(firstLeg);
  assert.ok(legLinks.length > 0 && legLinks.every(([n]) => /'da ara$/.test(n) && n !== "Uber'da ara"), `the sites that compare every way (${JSON.stringify(legLinks)})`);
  assert.equal(Math.round((await firstLeg.boundingBox()).height), 288);
  // Diğer (v82): the eSIM for Indonesia an Aranıyor box, "Kendin ara": Airalo and Holafly.
  await ekOpen("other");
  const esimEmpty = ekSec("other").locator('.q-ints > .q-int[data-intent="suggestion:rule:esim"]');
  assert.equal(flat([await esimEmpty.locator(".q-st").innerText()])[0], "Aranıyor");
  assert.deepEqual(await esimEmpty.locator(".z-pi").evaluateAll((els) => els.map((a) => a.getAttribute("href"))), ["https://www.airalo.com/indonesia-esim", "https://esim.holafly.com/esim-indonesia/"]);
  // Etkinlikler (v11): the source's tours as cards; with none, each stop's own searches ("Kendin ara"), no empty card.
  // v82: a stop with nothing yet is one thin line (AI'a arat, Kendin ara); Uluwatu's source answers one Viator tour: it's a
  // card under its line (the brand's label, where it was found, how long, the price a person, "+ Plana koy"); put on the
  // plan, Uluwatu has its box. 0.38.4: the trip's other stops in Indonesia have few of their own, so Uluwatu's tour is
  // theirs too, saying where ("Viator · Uluwatu"); once it's on the plan it leaves them and they're thin lines again.
  await ekOpen("activity");
  assert.equal(await ekSec("activity").locator(".ek-card").count(), 0);
  const tourIn = (city) => ekSec("activity").locator(`.q-gapl[data-city="${city}"] .z-k[data-offer][aria-label="Uluwatu gün batımı ve kecak dansı"]`);
  const tourTile = tourIn("Uluwatu");
  await tourTile.waitFor({ timeout: 10000 });
  // 0.38.8 (option A): the brand's label and where it was found are one chip on the picture, with the site's mark.
  assert.equal(await tourTile.locator(".z-kp .q-src .q-logo").innerText(), "V");
  assert.match(await tourTile.locator(".z-kp .q-src").innerText(), /^V\s*Viator · Uluwatu$/);
  assert.equal(await tourTile.locator(".q-brand").count(), 0, "the source's chip names the site: no second label");
  assert.match(await tourTile.locator(".z-l2").innerText(), /^4 sa · €45\s+kişi başı$/);
  assert.equal(await ekSec("activity").locator('.q-gapl.has-offers[data-city="Uluwatu"]').locator(".z-k[data-offer]").count(), 1, "the tour is in its city's place");
  await tourIn("Canggu").waitFor({ timeout: 10000 });
  assert.match(await tourIn("Canggu").locator(".q-src").innerText(), /^V\s*Viator · Uluwatu$/, "a nearby stop's row says where its tour is");
  await tourTile.getByRole("button", { name: "+ Plana koy" }).click();
  await ekSec("activity").locator('[data-row="plan"] .z-k[aria-label="Uluwatu gün batımı ve kecak dansı"]').waitFor();
  await tourTile.waitFor({ state: "detached" });
  await tourIn("Canggu").waitFor({ state: "detached" });
  assert.equal(await ekSec("activity").locator(".q-gapl:not(.has-offers)").count(), 2, "the stops the source found nothing more for: their own searches");
  const selfHrefs = (scope) => scope.locator(".z-pl").evaluateAll((els) => els.map((a) => ["", a.getAttribute("href")]));
  // (v82 providers.ts: in Asia Klook comes first, the design note's "Klook (Asya) · GetYourGuide · Viator".)
  assert.deepEqual((await selfHrefs(ekSec("activity").locator(".q-gapl", { hasText: "Canggu" }))).map(([, u]) => u), [
    "https://www.klook.com/search/result/?query=Canggu",
    "https://www.getyourguide.com/s/?q=Canggu",
    "https://www.viator.com/searchResults/all?text=Canggu",
  ]);
  // The source finds nothing (routed empty): no offers' row anywhere; the logos are drawn here (no request to a brand's site).
  assert.equal(await panel.locator(".ek-offers").count(), 0, "no offers' row when the source finds nothing");
  assert.equal(await panel.locator('.ek-card img:not([src^="illus/"])').count(), 0, "no brand image fetched (the drawings are the app's own files)");
  // The look (F2): the ticket a white ground in a flat solid frame (no dashes on a ticket; the box around it says it's to find), the cities large.
  await ekOpen("flight");
  assert.deepEqual(await outFlight.locator(".z-tk").evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopStyle, parseFloat(getComputedStyle(el.querySelector(".q-city b")).fontSize) >= 16]), ["rgb(255, 255, 255)", "solid", true]);
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/22a-empty-cards.png` });
  await board.setViewportSize({ width: 560, height: 1400 });
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/22b-empty-cards-narrow.png` });
  assert.ok(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with empty cards");
  await board.setViewportSize({ width: 1440, height: 900 });
  // Günlük akış keeps its own markup: no empty card there.
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".panel .dg").waitFor();
  // (the copy of the plan that was just left fades for 120 ms: wait for it)
  await board.waitForFunction(() => document.querySelectorAll(".panel .ek-card, .panel .ek-route, .panel .ek-foot, .panel .ek-find, .panel .ek-link, .panel .ek-line").length === 0, null, { timeout: 3000 });
  assert.equal(await panel.locator(".ek-card, .ek-route, .ek-foot, .ek-find, .ek-link, .ek-line").count(), 0, "no empty card in Günlük akış");
  await board.getByRole("tab", { name: "Plan", exact: true }).click();
  await ekSec("flight").waitFor();
  await ekOpen("flight");
  // A placeholder's day edited where it stands (its head's day, C2): still nothing concrete, so still to find (never Seçildi).
  const backId = await ekSec("flight").locator(".q-ints > .q-int").nth(1).getAttribute("data-item-id");
  const back = ekSec("flight").locator(`.q-ints > .q-int[data-item-id="${backId}"]`);
  await back.getByRole("button", { name: "Tarih: düzenle" }).click();
  await board.locator('.pk-ed-input[aria-label="Tarih"]').fill("2027-01-09");
  await board.locator('.pk-ed-input[aria-label="Tarih"]').press("Enter");
  await board.locator('.pk-ed-input[aria-label="Tarih"]').waitFor({ state: "detached" });
  await back.locator(".z-h .q-ln", { hasText: "9 Oca" }).waitFor();
  assert.equal(await back.getAttribute("data-st"), "todo", "an edited placeholder is still to find");
  assert.equal(new URL((await pis(back))[1][1]).searchParams.get("q"), "Flights from DPS to IST on 2027-01-09 one way");
  console.log("✓ boş kartlar: a new trip's flights, stays, transfers, eSIM and activities are plain cards with Ara: and branded searches (cities, dates, 2 people), no AI row; none in Günlük akış; a placeholder's day edited stays empty");


  // 23. Kişiye özel rezervasyon (spec 2026-10-06-kisiye-ozel-rezervasyon-design.md, mockup v1): on this two-person
  // trip (me & Sabine) the chat "Sabine Alicante'den geliyor" opens Sabine's own empty flight there with the badge
  // "Sabine'in bileti", its searches from Alicante for 1, the trip's own flight there "Emre'nin bileti" (my name asked first, in bold, as no profile name is set); the way home is asked in
  // bold with chips the code answers ("Evet, Alicante" adds it); "bu bilet Sabine'in" marks an existing flight; the
  // shared stays show nothing; a one-person trip shows no badge anywhere.
  const tripRecords = (title) =>
    board.evaluate(async (t) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const all = (store) => new Promise((resolve) => (database.transaction(store).objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result)));
      const trip = (await all("trips")).find((x) => x.title.includes(t));
      return { trip, items: (await all("items")).filter((i) => i.tripId === trip.id) };
    }, title);
  const bali = await tripRecords("Bali");
  const mainHome = bali.items.find((i) => i.category === "flight" && i.flight?.from === "Denpasar" && i.status !== "dismissed");
  assert.ok(mainHome, "the start's flight home is there");
  const perPersonPrompts = [];
  const chipCalls = [];
  const perPerson = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("set_travellers")) return route.fulfill(reply([{ text: "Not ettim: Sabine Alicante'den geliyor; onun için ayrı bir gidiş kartı açtım." }]));
    if (last.includes("functionResponse") && last.includes("set_owner")) return route.fulfill(reply([{ text: "Tamam, dönüş bileti artık Sabine'in." }]));
    if (last.includes("Alicante'den geliyor")) {
      perPersonPrompts.push(JSON.stringify(body.contents));
      return route.fulfill(reply([{ functionCall: { id: "pp-1", name: "set_travellers", args: { add: [], remove: [], count: 0, from: [{ name: "Sabine", place: "Alicante" }], rename: [] } } }]));
    }
    if (last.includes("Evet, Alicante")) chipCalls.push(last);
    if (last.includes("bu bilet Sabine'in")) {
      perPersonPrompts.push(JSON.stringify(body.contents));
      return route.fulfill(reply([{ functionCall: { id: "pp-2", name: "set_owner", args: { item_ids: [mainHome.id], names: ["Sabine"] } } }]));
    }
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", perPerson);
  const chatBox = board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…");
  await chatBox.fill("Sabine Alicante'den geliyor");
  await board.getByRole("button", { name: "Gönder" }).click();
  // No profile name on this computer: never "Ben" on a badge or the toast; my name is asked first, in bold.
  const nameAsked = board.locator(".msg-assistant", { hasText: "Sana ne diyeyim?" });
  await nameAsked.waitFor({ timeout: 20000 });
  assert.ok((await nameAsked.innerText()).startsWith("Not ettim: Sabine Alicante'den geliyor"), "the model's own words first");
  assert.equal(await nameAsked.locator("strong, b", { hasText: "Sana ne diyeyim?" }).count(), 1, "my name asked in bold");
  assert.equal(await board.locator(".choices button").count(), 0);
  await board.locator(".pk-undo", { hasText: "Gidenler: Sabine · 2 kişi" }).waitFor();
  assert.equal(await board.locator(".pk-undo", { hasText: "Ben" }).count(), 0, "no 'Ben' in the toast");
  assert.equal(await panel.locator(".wh-badge", { hasText: "Ben" }).count(), 0, "no 'Ben' on a badge");
  await chatBox.fill("Emre");
  await board.getByRole("button", { name: "Gönder" }).click();
  const asked = board.locator(".msg-assistant", { hasText: "Sabine dönüşte de Alicante'ye mi?" });
  await asked.waitFor({ timeout: 20000 });
  assert.ok((await asked.innerText()).startsWith("Tamam, Emre; adını profiline kaydettim."), "the name said back");
  assert.equal(await board.evaluate(async () => (await chrome.storage.local.get("shareName")).shareName), "Emre", "saved as the profile name");
  assert.equal(await asked.locator("strong, b", { hasText: "Sabine dönüşte de Alicante'ye mi?" }).count(), 1, "the way home asked in bold");
  assert.deepEqual(await board.locator(".choices button").allInnerTexts(), ["Evet, Alicante", "Hayır, İstanbul'a", "Henüz belli değil"]);
  // Sabine's own flight there: a ticket still to find with her badge on its carrier line, searched from Alicante for one.
  const flightTo = (route) => ekSec("flight").locator(".q-ints > .q-int", { has: board.locator(".q-nm", { hasText: route }) });
  const hers = flightTo("Alicante → Denpasar");
  await hers.waitFor({ timeout: 10000 });
  const badge = hers.locator(".z-car .wh-badge");
  assert.equal(await badge.locator(".wh-label").innerText(), "Sabine'in bileti");
  assert.equal(await badge.locator(".wh-av").innerText(), "S", "her initial: no photo given");
  assert.deepEqual(await badge.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopColor, getComputedStyle(el).color]), ["rgb(255, 255, 255)", "rgb(230, 225, 247)", "rgb(75, 63, 176)"]);
  assert.match(flat([await hers.locator(".z-h .q-ln").innerText()])[0], /1 kişi/, "her ticket is for one (the trip's two aren't)");
  const herLinks = await pis(hers);
  assert.equal(new URL(herLinks[1][1]).searchParams.get("q"), "Flights from ALC to DPS on 2026-12-10 one way");
  assert.equal(herLinks[0][1], "https://www.skyscanner.net/transport/flights/alc/dps/261210/?adultsv2=1&rtn=0");
  // The trip's own flight there is the rest's now: "Emre'nin bileti", for one.
  const mainOut = flightTo("İstanbul → Denpasar");
  assert.match(flat([await mainOut.locator(".z-h .q-ln").innerText()])[0], /1 kişi/);
  await mainOut.locator(".wh-badge .wh-label", { hasText: "Emre'nin bileti" }).waitFor({ timeout: 10000 });
  assert.equal(await mainOut.locator(".wh-av").innerText(), "E");
  assert.match((await pis(mainOut))[0][1], /adultsv2=1&/);
  // The section counts each ticket on its own (no route dedupe): three flights to book now.
  assert.match(await ekSec("flight").locator(".q-count").textContent(), /^0\/3$/);
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.waitForTimeout(1500); // the new card's arrival glow fades
  await board.screenshot({ path: `${out}/23a-per-person-flight.png` });
  // The hero's people box: "Alicante'den" under Sabine.
  await board.locator(".x-hero .x-whob").click();
  const whoBox = board.getByRole("dialog", { name: "Kimler gidiyor?" });
  await whoBox.locator(".hx-who-list li", { hasText: "Sabine" }).locator(".wh-from", { hasText: "Alicante'den" }).waitFor();
  await board.screenshot({ path: `${out}/23b-per-person-who.png` });
  await board.keyboard.press("Escape");
  await whoBox.waitFor({ state: "detached" });
  // "Evet, Alicante": answered by the code, her flight home opened the same way.
  await board.locator(".choices").getByRole("button", { name: "Evet, Alicante" }).click();
  await board.locator(".msg-assistant", { hasText: "Sabine'in dönüşünü ekledim: Denpasar → Alicante" }).waitFor({ timeout: 10000 });
  assert.equal(chipCalls.length, 0, "a chip of the code's question costs no model call");
  const herHome = flightTo("Denpasar → Alicante");
  await herHome.waitFor({ timeout: 10000 });
  assert.equal(await herHome.locator(".wh-label").innerText(), "Sabine'in bileti");
  const mainBack = ekSec("flight").locator(`.q-ints > .q-int[data-item-id="${mainHome.id}"]`);
  assert.match(flat([await mainBack.locator(".z-h .q-ln").innerText()])[0], /1 kişi/);
  await mainBack.locator(".wh-badge .wh-label", { hasText: "Emre'nin bileti" }).waitFor({ timeout: 10000 });
  // Its own "Geri al" (the board's toast): her flight home goes, the trip's own is everyone's again; then again.
  const backToast = board.locator(".pk-undo", { hasText: "Sabine'in dönüşü eklendi: Denpasar → Alicante" });
  await backToast.getByRole("button", { name: "Geri al" }).click();
  await herHome.waitFor({ state: "detached", timeout: 10000 });
  await mainBack.locator(".wh-badge").waitFor({ state: "detached" });
  assert.doesNotMatch(flat([await mainBack.locator(".z-h .q-ln").innerText()])[0], /kişi/, "everyone's again: the trip's own two aren't said");
  // "bu bilet Sabine'in" on an existing flight: its badge appears.
  await chatBox.fill("bu bilet Sabine'in, İstanbul'a dönüş");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".msg-assistant", { hasText: "Tamam, dönüş bileti artık Sabine'in." }).waitFor({ timeout: 20000 });
  assert.ok(perPersonPrompts[1].includes(String.raw`\"from\":{\"Sabine\":\"Alicante\"}`), "the model sees who comes from where");
  assert.ok(perPersonPrompts[1].includes(String.raw`\"for_who\":[\"Sabine\"]`), "and whose each plan is");
  const marked = ekSec("flight").locator(`.q-ints > .q-int[data-item-id="${mainHome.id}"]`);
  await marked.locator(".wh-badge .wh-label", { hasText: "Sabine'in bileti" }).waitFor({ timeout: 10000 });
  // The stays are everyone's: no badge on any of them.
  assert.equal(await ekSec("stay").locator(".wh-badge").count(), 0, "the shared stays show nothing");
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/23c-per-person-owner.png` });
  const after = await tripRecords("Bali");
  assert.deepEqual(after.trip.travellers.from, { Sabine: "Alicante" });
  assert.deepEqual(after.items.find((i) => i.id === mainHome.id).forWho, ["Sabine"]);
  await flow.unroute("https://generativelanguage.googleapis.com/**", perPerson);
  // 23b. Üç akıllı konaklama önerisi (stayPicks.ts, owner-approved MVP): the source's candidates for Ubud (fixed here,
  // €40/47/103/155/173/209 by the night) narrowed to three labelled cards under its empty card, "Sana en uygun",
  // "Daha ekonomik", "Daha konforlu", each with its price by the night (its nights in the tooltip) and its why as the
  // card's tooltip; 0.38.4: the plan's option cards (OptionCompact), "Seç" puts one on the plan as Ubud's and chooses it.
  const pickCand = (id, name, nightly, rating, reviews) => ({
    id, name, rating, reviews, photo: null, geo: null, area: "Otel", labels: [], url: `https://www.booking.com/hotel/id/${id}.html`,
    nightly, total: nightly * 12, nights: 12, priceRange: null, source: "Booking", currency: "EUR", fetchedAt: Date.now(),
  });
  const ubudCandidates = [
    pickCand("e2e-bucu", "Bucu View", 40, 4.3, 380),
    pickCand("e2e-hostel", "Ubud Hostel", 47, 3.9, 900),
    pickCand("e2e-alaya", "Alaya Resort", 103, 4.5, 2100),
    pickCand("e2e-komaneka", "Komaneka", 155, 4.6, 1240),
    pickCand("e2e-maya", "Maya Ubud", 173, 4.8, 3000),
    pickCand("e2e-mandapa", "Mandapa", 209, 4.9, 640),
  ];
  const candidatesAsked = [];
  const candidatesFn = (route) => {
    const url = new URL(route.request().url());
    const mine = url.searchParams.get("kind") === "stay" && url.searchParams.get("city") === "Ubud" && url.searchParams.get("candidates") === "1";
    if (mine) candidatesAsked.push(url.toString());
    return route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: mine ? { offers: [], candidates: ubudCandidates } : { offers: [] } });
  };
  await flow.route("**/functions/v1/offers**", candidatesFn);
  // The empty answers asked so far are kept for hours: forgotten, and the Plan drawn again (each card asks anew).
  await board.evaluate(() => chrome.storage.local.remove("offersSeen"));
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".panel .dg").waitFor();
  await board.getByRole("tab", { name: "Plan", exact: true }).click();
  await ekOpen("stay");
  const ubudCard = ekSec("stay").locator('.q-ints > .q-int[aria-label="Ubud"]');
  // The row sits right under its box (v82: after the box, outside its fixed frame).
  const picksRow = ekSec("stay").locator('.q-ints > .q-int[aria-label="Ubud"] + .q-offers .ek-offers.ek-picks').first();
  await picksRow.waitFor({ timeout: 10000 });
  assert.ok(candidatesAsked.length >= 1 && candidatesAsked.every((u) => /start=2026-12-10/.test(u) && /end=2026-12-22/.test(u)), "Ubud's candidates asked for its nights");
  // Open at first (0.38.5, Emre: the options right under the box), the count on its head; its head still closes it.
  assert.equal(await picksRow.locator(".ek-offers-head").innerText().then((t) => t.replace(/\s+/g, " ").trim()), "✨ Senin için 3 öneri ▾");
  assert.equal(await picksRow.locator(".ek-offers-head").getAttribute("aria-expanded"), "true", "open by default");
  await picksRow.locator(".ek-offers-head").click();
  assert.equal(await picksRow.locator(".z-oc[data-pick]").count(), 0, "closed on its head");
  await picksRow.locator(".ek-offers-head").click();
  const pickCards = picksRow.locator(".z-oc[data-pick]");
  await pickCards.first().waitFor();
  assert.equal(await pickCards.count(), 3, "three cards");
  assert.deepEqual(await picksRow.locator(".z-op .q-src").allInnerTexts(), ["✨ Sana en uygun", "Daha ekonomik", "Daha konforlu"]);
  assert.deepEqual(await picksRow.locator(".z-t").allInnerTexts(), ["Alaya Resort", "Bucu View", "Mandapa"]);
  assert.match(await pickCards.nth(1).innerText(), /★ 4,3[\s\S]*380 yorum[\s\S]*Bucu View[\s\S]*€40[\s\S]*\/ gece[\s\S]*Seç/);
  assert.equal(await pickCards.nth(1).locator(".q-pr").getAttribute("title"), "12 gece €480");
  assert.equal(await pickCards.nth(1).getAttribute("title"), "Bulduklarımın en ucuzu, ★4,3");
  assert.match(await pickCards.nth(2).getAttribute("title"), /Gecelik €106 daha fazla ama ★4,9/);
  // The name is the hotel's page; no Favorile, no İncele (not in the design).
  assert.equal(await pickCards.nth(0).getByRole("link", { name: "Alaya Resort" }).getAttribute("href"), "https://www.booking.com/hotel/id/e2e-alaya.html");
  assert.equal(await picksRow.getByText(/Favori|İncele/).count(), 0, "only the option card's own buttons");
  // Wide: three side by side, the best one accented.
  const tops = await pickCards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  // The frame's three columns (OptionCompact), and no card squeezed.
  const pickCols = await picksRow.locator(".ek-pcs").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  assert.equal(new Set(tops).size, Math.ceil(3 / pickCols), "the cards fill the columns the card's width allows");
  assert.ok(await pickCards.evaluateAll((els) => els.every((el) => el.getBoundingClientRect().width >= 190)), "no pick card is squeezed");
  assert.equal(await pickCards.nth(0).locator(".z-op .q-src").evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
  // The photo near its own shape (4:3), not a strip.
  const photoBox = await pickCards.nth(0).locator(".z-op").evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  assert.ok(photoBox > 1.25 && photoBox < 1.42, `the pick's photo is 4:3 (${photoBox.toFixed(2)})`);
  await ubudCard.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await board.screenshot({ path: `${out}/29a-stay-picks.png` });
  // Narrow: stacked.
  await board.setViewportSize({ width: 560, height: 1400 });
  const narrowTops = await pickCards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  assert.ok(new Set(narrowTops).size >= 2, "wraps instead of squeezing when narrow");
  assert.ok(await pickCards.evaluateAll((els) => els.every((el) => el.getBoundingClientRect().width >= 190)), "no pick card is squeezed when narrow");
  await ubudCard.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/29b-stay-picks-narrow.png` });
  await board.setViewportSize({ width: 1440, height: 900 });
  // Seç: "Daha ekonomik" put on the plan as Ubud's nights and chosen, its page, rating and reviews, price for the nights.
  await pickCards.nth(1).getByRole("button", { name: "Bucu View: seç" }).click();
  let favoured = [];
  // (added first, then chosen: waited for until it is)
  for (let i = 0; i < 50 && !favoured.some((x) => x.status === "chosen"); i++) {
    favoured = (await tripRecords("Bali")).items.filter((x) => x.name === "Bucu View");
    if (!favoured.some((x) => x.status === "chosen")) await board.waitForTimeout(100);
  }
  assert.deepEqual(
    favoured.map((x) => [x.category, x.status, x.city, x.dates.start, x.dates.end, x.url, x.provider, x.rating.value, x.rating.count, x.price.amount]),
    [["stay", "chosen", "Ubud", "2026-12-10", "2026-12-22", "https://www.booking.com/hotel/id/e2e-bucu.html", "Booking", 4.3, 380, 480]],
  );
  await board.screenshot({ path: `${out}/29c-stay-picks-favoured.png` });
  await flow.unroute("**/functions/v1/offers**", candidatesFn);
  console.log("✓ stay picks: Ubud's six candidates narrowed to 'Sana en uygun' Alaya Resort, 'Daha ekonomik' Bucu View (€40 / gece · 12 gece €480), 'Daha konforlu' Mandapa (€106 more, ★4,9); open at first, the plan's option cards (4:3 photo), 3 columns wide, stacked narrow; Seç puts Bucu View on the plan as Ubud's and chooses it");
  // The profile name said here goes again: the later steps start as before (no name on this computer).
  await board.evaluate(() => chrome.storage.local.remove("shareName"));
  // A one-person trip: a plan written for someone (as a stale share could leave it) shows no badge anywhere.
  const solo = await tripRecords("Portekiz");
  assert.ok(solo.trip && !(solo.trip.travellers?.names ?? []).length, "Portekiz names nobody");
  await board.evaluate(async (tripId) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("items", "readwrite");
    const store = tx.objectStore("items");
    const items = await new Promise((resolve) => (store.getAll().onsuccess = (e) => resolve(e.target.result)));
    for (const i of items.filter((x) => x.tripId === tripId)) store.put({ ...i, forWho: ["Sabine"] });
    await new Promise((resolve) => (tx.oncomplete = resolve));
  }, solo.trip.id);
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.locator(".trip-card", { hasText: "Portekiz" }).first().click();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  await board.locator(".q-sec").first().waitFor();
  // (one category open at a time: each in turn)
  for (const id of ["flight", "stay", "transport", "other"]) {
    if (!(await ekSec(id).count())) continue;
    await ekOpen(id);
    assert.equal(await board.locator(".wh-badge").count(), 0, `a one-person trip shows no badge (${id})`);
  }
  await board.screenshot({ path: `${out}/23d-per-person-solo.png` });
  console.log("✓ kişiye özel: no profile name → 'Sana ne diyeyim?' in bold, no 'Ben' on a badge or toast, 'Emre' saved; Sabine's empty flight from Alicante ('Sabine'in bileti', searched for 1), the trip's own 'Emre'nin bileti', 0/3; the way home asked in bold, 'Evet, Alicante' by the code with its own Geri al; 'bu bilet Sabine'in' marks a flight; stays and a one-person trip show nothing");

  // 27a. A booking said for what's already on the plan updates it (Emre: "10 GB aldım" with the trip's eSIM bought
  // and installed left the card "eSIM · Porto · Tarihsiz", the 10 GB only in its note): the same card, its title
  // the package and the country, still bought and installed, in Diğer's "Tüm gezi" row, never "Tarihsiz".
  await board.evaluate(async (tripId) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("items", "readwrite");
    const store = tx.objectStore("items");
    const items = await new Promise((resolve) => (store.getAll().onsuccess = (e) => resolve(e.target.result)));
    const base = items.find((x) => x.tripId === tripId);
    const { forWho: _who, userEdits: _edits, ...rest } = base;
    store.put({
      ...rest, id: "e2e-esim", category: "esim", plannedKind: "esim", origin: "chat", needKey: "esim:porto", name: "eSIM · Porto", city: "Porto",
      country: null, countryCode: null, provider: null, url: null, captureIds: [], summary: "", statusNote: null, status: "booked", installedAt: 1,
      dates: { start: null, end: null, source: "unverified" }, flight: null, metrics: { ...rest.metrics, dataGb: null, unlimitedData: null, validityDays: null },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 }, priceHistory: [], createdAt: 1, updatedAt: 1,
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
  }, solo.trip.id);
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.locator(".trip-card", { hasText: "Portekiz" }).first().click();
  await board.getByRole("heading", { name: "Portekiz" }).waitFor();
  const esimPrompts = [];
  const esimModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("e2e-esim")) {
      esimPrompts.push(last);
      return route.fulfill(reply([{ text: "eSIM kartını güncelledim: 10 GB, Portekiz." }]));
    }
    if (last.includes("10 GB aldım")) {
      const args = { kind: "esim", date: null, end_date: null, time: null, from: null, to: null, city: null, title: "10 GB eSIM", booked: true, note: null, replaces: null, item_id: null, provider: null, price: null, currency: null };
      return route.fulfill(reply([{ functionCall: { id: "es-1", name: "plan_item", args } }]));
    }
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", esimModel);
  const esimBox = board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…");
  await esimBox.fill("10 GB aldım");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".msg-assistant", { hasText: "eSIM kartını güncelledim: 10 GB, Portekiz." }).waitFor({ timeout: 20000 });
  assert.ok(esimPrompts[0].includes("I updated the eSIM card") || esimPrompts[0].includes("eSIM kartını güncelledim"), "the tool says what changed");
  const other27 = ekSec("other");
  await other27.waitFor();
  await ekOpen("other");
  // v82: Belgeler ve internet's eSIM box, its record the one updated (one box, never a second).
  const booked27Cards = other27.locator('.q-ints > .q-int[data-kind="esim"][data-item-id]');
  const booked27Card = other27.locator('.q-ints > .q-int[data-item-id="e2e-esim"]');
  await booked27Card.locator(".z-t", { hasText: "10 GB eSIM" }).waitFor({ timeout: 10000 });
  assert.equal(await booked27Card.locator(".q-nm").innerText(), "eSIM · Portekiz");
  assert.equal(await booked27Cards.count(), 1, "one eSIM box, never a second");
  assert.match(await booked27Card.locator(".z-l1").innerText(), /Kuruldu/, "still bought and installed");
  // Its head says the trip's days (no "Tarihsiz").
  assert.match(flat([await booked27Card.locator(".q-ln").innerText()])[0], /\d+–\d+ Ekim/);
  assert.doesNotMatch(await booked27Card.locator(".q-ln").innerText(), /Tarihsiz/);
  const booked27After = (await tripRecords("Portekiz")).items.filter((i) => i.category === "esim" && i.status !== "dismissed");
  assert.equal(booked27After.length, 1);
  assert.deepEqual([booked27After[0].id, booked27After[0].status, booked27After[0].name, booked27After[0].city, booked27After[0].countryCode, booked27After[0].metrics.dataGb], ["e2e-esim", "booked", "10 GB eSIM", "Portekiz", "PT", 10]);
  await booked27Card.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/27a-esim-updated.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", esimModel);
  console.log("✓ chat bookings: '10 GB aldım' with the eSIM on the plan updates that card (10 GB · Portekiz, still installed), one eSIM, in Diğer's 'Tüm gezi' row");

  // 20d1b. "Book etmemiz gerekenleri yaptık, gerisi fikir olarak kalsın" (0.36.47): the chat sets every unbooked plan
  // aside with set_booking_need; while it works the chat lists its steps ("X fikre alınıyor", ticked as it goes) and
  // the board changes with each; then nothing is left to book: the hero's % is 100 and the cards say "Fikir".
  const asideBefore = (await tripRecords("Portekiz")).items.filter((i) => i.status === "chosen" && i.noBooking == null);
  let asideReplied = false;
  const asideModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("kept_as_ideas")) {
      // The reply comes a little later, so the steps can be seen on screen while it's written.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      asideReplied = true;
      return route.fulfill(reply([{ text: "Rezerve edilmeyenleri planda fikir olarak bıraktım." }]));
    }
    if (last.includes("gerisi fikir olarak kalsın")) {
      return route.fulfill(reply([{ functionCall: { id: "nb-1", name: "set_booking_need", args: { all_unbooked: true, item_ids: [], leg_keys: [], needed: false } } }]));
    }
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", asideModel);
  await esimBox.fill("book etmemiz gerekenleri yaptık, gerisi fikir olarak kalsın");
  await board.getByRole("button", { name: "Gönder" }).click();
  if (asideBefore.length) {
    await board.locator(".chat-steps li.done", { hasText: "fikre alınıyor" }).first().waitFor({ timeout: 15000 });
    await board.screenshot({ path: `${out}/27b-aside-steps.png` });
    assert.ok(!asideReplied, "the steps show before the reply");
  }
  await board.locator(".msg-assistant", { hasText: "Rezerve edilmeyenleri planda fikir olarak bıraktım." }).waitFor({ timeout: 20000 });
  assert.equal(await board.locator(".chat-steps").count(), 0, "the steps go once the reply is there");
  const asideAfter = (await tripRecords("Portekiz")).items;
  // Every concrete plan set aside; an empty one ("Konaklama · Porto", no hotel) stays a gap to find.
  assert.ok(asideAfter.some((i) => i.noBooking != null), "something set aside");
  assert.equal(asideAfter.filter((i) => asideBefore.some((b) => b.id === i.id) && i.status !== "chosen").length, 0, "nothing ruled out or deleted");
  // The hero's sentence: everything on the plan is booked or sorted (planned = booked). (The to-do list's "Rezerve edilecek"
  // left the interface in this version: spec §1.1, C8.)
  const asideHero = await board.locator(".x-hero .x-bar").getAttribute("aria-label");
  console.log("  left to book:", JSON.stringify(asideAfter.filter((i) => i.status === "chosen").map((i) => [i.name, i.category, i.plannedKind ?? null, i.noBooking ?? null])));
  const asideShares = /\((\d+) ihtiyaçtan (\d+)'\S*\), %\d+'\S* alındı \((\d+)\)/.exec(asideHero ?? "");
  assert.ok(asideShares && asideShares[2] === asideShares[3], `nothing left planned to book (${asideHero})`);
  await board.screenshot({ path: `${out}/27c-aside-done.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", asideModel);
  console.log(`✓ chat 'gerisi fikir olarak kalsın': ${asideBefore.length} unbooked plans set aside one step at a time, the steps shown as it worked, none left to book (${asideHero})`);

  // 20d1c. The plan as a PDF file (0.36.51; a file since 0.36.55): "Planı PDF indir" in the trip's ⋯ menu (v83 C1; the main
  // button turns into it only once nothing is left to decide or book, F4, tests/nextStep.test.ts); the page laid out for
  // paper (the hero as drawn, the bookings, every day's lines) is saved as a PDF named after the trip, no print window.
  await board.locator(".x-hero").scrollIntoViewIfNeeded();
  await board.evaluate(() => {
    window.__printed = 0;
    window.print = () => void (window.__printed += 1);
  });
  board.on("console", (m) => { if (/\[print\]|PDF/i.test(m.text())) console.log("  page said:", m.text().slice(0, 400)); });
  await board.getByRole("button", { name: "Gezi menüsü" }).click();
  const [pdfFile] = await Promise.all([board.waitForEvent("download", { timeout: 120000 }), board.locator(".x-tm-pop").getByRole("menuitem", { name: "Planı PDF indir" }).click()]);
  // (a sandbox Chromium names a blob download plain "download": the name itself is unit-tested, tests/printName.test.ts)
  assert.match(pdfFile.suggestedFilename(), process.env.E2E_OFFLINE ? /^(download|Portekiz .*Trip Radar\.pdf)$/ : /^Portekiz .*Trip Radar\.pdf$/, "named after the trip");
  await pdfFile.saveAs(`${out}/27d-plan.pdf`);
  const pdfBytes = readFileSync(`${out}/27d-plan.pdf`);
  assert.equal(pdfBytes.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  const pdfPages = (pdfBytes.toString("latin1").match(/\/Type \/Page /g) ?? []).length;
  assert.ok(pdfPages >= 2, `the hero and the days on their pages (${pdfPages})`);
  assert.equal(await board.evaluate(() => window.__printed), 0, "no print window");
  await board.locator(".print-plan").waitFor({ state: "detached" });
  console.log(`✓ plan as PDF: the trip menu's "Planı PDF indir" saves the plan as a file (${pdfPages} pages, ${Math.round(pdfBytes.length / 1024)} KB) → ${out}/27d-plan.pdf`);
  // The photo's credit (0.36.54): a small ⓘ on the photo, the credit on hover; on paper in full.
  // (v83 C7: on every photo of the mosaic whose source is known; none without a photo)
  const creditBox = board.locator(".x-hero .x-big .x-cr").first();
  if (await creditBox.count()) {
    assert.equal(await creditBox.evaluate((el) => getComputedStyle(el).opacity), "0", "only the photo until hovered");
    await board.locator(".x-hero .x-big").hover();
    await creditBox.hover();
    assert.match(await board.locator(".tipx-box").innerText(), /^Fotoğraf: /);
    await board.screenshot({ path: `${out}/27e-credit-hover.png` });
    await board.mouse.move(5, 5);
  }
  console.log("✓ photo credit: a small ⓘ on the photo, the credit on hover");

  // 20d2. Web search: "Ozora 2027 tarihlerini araştır" → the chat calls web_search; while it runs the thinking line
  // says "Web'de arıyorum…"; the answer ends with "Kaynak:" and the site's link. Only the question goes out.
  const searched = [];
  const searchFn = async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    searched.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        answer: "Ozora Festival 2027: 26 Temmuz – 2 Ağustos, Dádpuszta.",
        sources: [{ title: "ozorafestival.eu", url: "https://ozorafestival.eu/" }],
        kind: "event_dates",
        cached: false,
        at: "2026-10-05T10:00:00Z",
        event: { start: "2027-07-26", end: "2027-08-02", place: "Dádpuszta, Hungary", official_url: "https://ozorafestival.eu/", confidence: "high" },
      },
    });
  };
  const searchModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("ozorafestival.eu")) {
      return route.fulfill(reply([{ text: "Ozora 2027, 26 Temmuz – 2 Ağustos arası Dádpuszta'da." }]));
    }
    if (last.includes("Ozora 2027 tarihlerini araştır")) {
      return route.fulfill(reply([{ functionCall: { id: "ws-1", name: "web_search", args: { query: "Ozora Festival 2027 dates", kind: "event_dates", why: "festival tarihi canlı bilgi" } } }]));
    }
    return route.fallback();
  };
  await flow.route(/functions\/v1\/web-search/, searchFn);
  await flow.route("https://generativelanguage.googleapis.com/**", searchModel);
  await esimBox.fill("Ozora 2027 tarihlerini araştır");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".thinking", { hasText: "Web'de arıyorum…" }).waitFor({ timeout: 15000 });
  await board.screenshot({ path: `${out}/27b-web-searching.png` });
  const searchReply = board.locator(".msg-assistant", { hasText: "Ozora 2027, 26 Temmuz – 2 Ağustos arası Dádpuszta'da." });
  await searchReply.waitFor({ timeout: 20000 });
  assert.match(await searchReply.innerText(), /Kaynak: ozorafestival\.eu/, "the reply ends with its source");
  assert.equal(await searchReply.locator('a[href="https://ozorafestival.eu/"]').count(), 1, "the source is a link");
  assert.deepEqual(searched, [{ q: "Ozora Festival 2027 dates", lang: "tr", kind: "event_dates", year: 2027 }], "only the question goes out");
  await board.screenshot({ path: `${out}/27c-web-search-answer.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", searchModel);
  await flow.unroute(/functions\/v1\/web-search/, searchFn);
  console.log("✓ web search: 'Ozora 2027 tarihlerini araştır' shows 'Web'de arıyorum…', then the answer with 'Kaynak: ozorafestival.eu' as a link; only the question went out");

  // 20d3. A slow search (a fresh one takes 10-30 s): the turn ends after 8 s with a short reply, "Web'de arıyorum…"
  // stays, the traveller writes on and is answered, and the result lands as its own line with its source.
  const slowFn = async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    await new Promise((resolve) => setTimeout(resolve, 11000));
    return route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { answer: "Livraria Lello her gün 09:00–19:00 açık.", sources: [{ title: "livrarialello.pt", url: "https://www.livrarialello.pt/" }], kind: "fact", cached: false, at: "2026-10-05T10:00:00Z" },
    });
  };
  const slowModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("pending")) return route.fulfill(reply([{ text: "Araştırıyorum, sonuç birazdan burada." }]));
    if (last.includes("Lello açılış saatlerini araştır")) {
      return route.fulfill(reply([{ functionCall: { id: "ws-2", name: "web_search", args: { query: "Livraria Lello opening hours", kind: "fact", why: "açılış saati canlı bilgi" } } }]));
    }
    if (last.includes("teşekkürler")) return route.fulfill(reply([{ text: "Rica ederim." }]));
    return route.fallback();
  };
  await flow.route(/functions\/v1\/web-search/, slowFn);
  await flow.route("https://generativelanguage.googleapis.com/**", slowModel);
  await esimBox.fill("Lello açılış saatlerini araştır");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".msg-assistant", { hasText: "Araştırıyorum, sonuç birazdan burada." }).waitFor({ timeout: 20000 });
  await board.locator(".thinking", { hasText: "Web'de arıyorum…" }).waitFor({ timeout: 2000 });
  await esimBox.fill("teşekkürler");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".msg-assistant", { hasText: "Rica ederim." }).waitFor({ timeout: 10000 });
  assert.equal(await board.locator(".thinking", { hasText: "Web'de arıyorum…" }).count(), 1, "the search's line stays while the traveller writes on");
  await board.screenshot({ path: `${out}/27d-web-search-slow.png` });
  const landedReply = board.locator(".msg-assistant", { hasText: "Livraria Lello her gün 09:00–19:00 açık." });
  await landedReply.waitFor({ timeout: 20000 });
  assert.match(await landedReply.innerText(), /Kaynak: livrarialello\.pt/, "the landed line ends with its source");
  await board.locator(".thinking").waitFor({ state: "detached", timeout: 5000 });
  await board.screenshot({ path: `${out}/27e-web-search-landed.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", slowModel);
  await flow.unroute(/functions\/v1\/web-search/, slowFn);
  console.log("✓ web search, slow: the reply comes after 8 s, 'Web'de arıyorum…' stays while 'teşekkürler' is answered, then the result lands with 'Kaynak: livrarialello.pt'");

  // 20d4. find_offers: "daha ucuz öneriler getir" asks the offers' source (never the model's own ideas): "Fiyatlara
  // bakıyorum…" while it's asked, then the real offers as cards under the reply ("★ 4,7", "8,9", the source, why);
  // "Ekle" saves one as an option of the trip.
  const offersAsked = [];
  const offersFn = async (route) => {
    offersAsked.push(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const offer = (id, title, rating, price, source, url, why) => ({ id, kind: "stay", title, photo: null, rating, price, currency: "EUR", nights: 3, url, why, source, fetchedAt: Date.now() });
    return route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        offers: [
          offer("e2e-o1", "Pensão Favorita", 4.7, 270, "Tripadvisor", "https://www.tripadvisor.com/Hotel_Review-e2e-favorita", "Ribeira'ya 8 dk, en ucuzu"),
          offer("e2e-o2", "Hotel da Música", 8.9, 330, "Booking", "https://www.booking.com/hotel/pt/e2e-musica.html", "Metroya 2 dk"),
          offer("e2e-o3", "Casa do Conto", null, 450, "Agoda", "https://www.agoda.com/e2e-conto", ""),
        ],
      },
    });
  };
  const offersModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (!body?.contents || body.generationConfig?.responseJsonSchema) return route.fallback();
    const last = JSON.stringify(body.contents.at(-1));
    if (last.includes("functionResponse") && last.includes("Pensão Favorita")) return route.fulfill(reply([{ text: "Kaynaklarda üç uygun yer var; en ucuzu Pensão Favorita." }]));
    if (last.includes("daha ucuz öneriler getir")) {
      const args = { kind: "stay", city: "Porto", from: "", to: "", start: "2026-12-10", end: "2026-12-13", adults: 0, max_per_night: 0, prefer: "cheap" };
      return route.fulfill(reply([{ functionCall: { id: "fo-1", name: "find_offers", args } }]));
    }
    return route.fallback();
  };
  await flow.route("**/functions/v1/offers**", offersFn);
  await flow.route("https://generativelanguage.googleapis.com/**", offersModel);
  await esimBox.fill("Porto için daha ucuz öneriler getir");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".thinking", { hasText: "Fiyatlara bakıyorum…" }).waitFor({ timeout: 15000 });
  const offersReply = board.locator(".msg-assistant", { hasText: "Kaynaklarda üç uygun yer var; en ucuzu Pensão Favorita." });
  await offersReply.waitFor({ timeout: 20000 });
  const chatCards = offersReply.locator(".chat-offer");
  assert.equal(await chatCards.count(), 3, "three offers as cards under the reply");
  assert.match(await chatCards.nth(0).innerText(), /Pensão Favorita[\s\S]*★ 4,7[\s\S]*Tripadvisor[\s\S]*Ribeira'ya 8 dk[\s\S]*€270[\s\S]*€90 \/ gece/);
  assert.match(await chatCards.nth(1).innerText(), /8,9/);
  assert.equal(await chatCards.nth(0).locator('a[href="https://www.tripadvisor.com/Hotel_Review-e2e-favorita"]').count(), 2, "its page through the offer's own link");
  // A stay with no ceiling asks its candidates first (the three picks); none here, so the cheapest as before.
  const offersOnly = offersAsked.filter((u) => !/candidates=1/.test(u));
  assert.ok(offersAsked.length > offersOnly.length, "the stay's candidates asked first");
  assert.ok(offersOnly.length >= 1 && offersOnly.every((u) => /kind=stay/.test(u) && /city=Porto/.test(u) && /prefer=cheap/.test(u)), "the source asked for Porto's cheapest");
  // 0.38.5: what the chat shows is saved as the need's options without a tap (Pano and the box show it), said "Eklendi ✓".
  await chatCards.nth(0).getByRole("button", { name: "Pensão Favorita eklendi" }).waitFor({ timeout: 5000 });
  await board.screenshot({ path: `${out}/27f-chat-offers.png` });
  const offerSaved = (await tripRecords("Portekiz")).items.filter((i) => i.name === "Pensão Favorita");
  assert.deepEqual(offerSaved.map((i) => [i.category, i.status, i.provider, i.url]), [["stay", "saved", "Tripadvisor", "https://www.tripadvisor.com/Hotel_Review-e2e-favorita"]]);
  await flow.unroute("https://generativelanguage.googleapis.com/**", offersModel);
  await flow.unroute("**/functions/v1/offers**", offersFn);
  console.log("✓ find_offers: 'daha ucuz öneriler getir' shows 'Fiyatlara bakıyorum…', then 3 real offers as cards ('★ 4,7', '8,9', source, why, €90 / gece); shown is saved: Pensão Favorita is an option, 'Eklendi ✓'");

  // 20e. Words with a link on the home: the link is saved, the words go on ("Linki kaydettim; geri kalanını konuşalım").
  // A month only is never a day made up: the day is asked next; "Ortası" is said back and marked roughly.
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.getByLabel("Gezi kutusu").fill("Lizbon https://www.booking.com/hotel/pt/e2e-lizbon.html");
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  await board.locator(".st-msg-bot", { hasText: "Linki kaydettim; geri kalanını konuşalım." }).waitFor();
  await board.locator(".st-msg-bot", { hasText: "Lizbon kulağa harika geliyor: Lizbon'un tepeleri" }).waitFor();
  const skipQ = () => answers.getByRole("button", { name: "Atla" }).click();
  // K4 (2026-10-09): where, how long, the start, the day, what you want, the route, who, and where from last.
  await board.locator(".st-msg-bot", { hasText: "Lizbon'da kaç gün kalmak istersin?" }).waitFor();
  await answers.getByRole("button", { name: "1 hafta", exact: true }).click();
  await answers.getByRole("button", { name: "Aralık", exact: true }).click();
  // The code's line at once, then the model's words in its place (a slower model too: 7 s here).
  await board.locator(".st-msg-bot", { hasText: "Lizbon'a Aralık'ta hangi gün çıkıyorsun?" }).waitFor();
  await board.locator(".st-msg-bot", { hasText: "Aralık'ta Lizbon güzel olur; ayın kaçında yola çıkmayı düşünüyorsun?" }).waitFor({ timeout: 15000 });
  assert.deepEqual(await answers.locator(".st-chip").allInnerTexts(), ["Ayın başı", "Ortası", "Sonu"]);
  await answers.locator("input[type=date]").waitFor();
  await board.screenshot({ path: `${out}/20e-start-day.png` });
  await answers.getByRole("button", { name: "Ortası" }).click();
  await board.locator(".st-msg-bot", { hasText: "15 Aralık'ı başlangıç aldım, değiştirebilirsin." }).waitFor();
  await list.getByText("15–22 Aralık · 7 gece (yaklaşık)").waitFor();
  await skipQ(); // what you want
  await board.locator(".st-msg-bot", { hasText: "Tek durak öneriyorum: Lizbon 7 gece. Bu olsun mu?" }).waitFor();
  await answers.getByRole("button", { name: "Bu olsun" }).click(); // the route
  // Who is an essential (2026-10-06): skipped, then where from (skipped); the essentials are in: the countdown starts,
  // and "Vazgeç" stops it.
  await board.locator(".st-msg-bot .st-q", { hasText: "Lizbon'a kimle gidiyorsun?" }).waitFor();
  await skipQ();
  await board.locator(".st-msg-bot", { hasText: "Lizbon'a nereden yola çıkıyorsun?" }).waitFor();
  await skipQ(); // where from
  // The plan said back while it counts (2026-10-07): the route and the days; gone once stopped.
  await board.locator(".st-summary", { hasText: "Lizbon" }).waitFor();
  assert.deepEqual(await board.locator(".st-summary dt").allInnerTexts(), ["Rota", "Tarih"]);
  await board.waitForTimeout(400);
  await board.screenshot({ path: `${out}/20d2-start-summary.png` });
  await board.locator(".st-auto", { hasText: "Oluşturuyorum…" }).getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-summary").waitFor({ state: "detached" });
  await board.locator(".st-auto").waitFor({ state: "detached" });
  // Left halfway: a draft on the home.
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.locator(".st-draft", { hasText: "Lizbon" }).waitFor();
  console.log("✓ start by chat: a link typed with words is saved and the words go on; a month only asks the day (Ortası → \"15 Aralık'ı başlangıç aldım\", roughly); left halfway, a draft");

  // 21. Revision 2 (the reported conversation): on an ENGLISH board, the owner's exact Turkish sentence. The chat
  // answers in Turkish; "İstanbul" to "Nereden?" is where from (the model even calls it the destination too, as it
  // did), the trip stays Koh Phangan, Thailand; a row says what it's doing while the model writes; the preview on the
  // right fills in (photos, the route proposal prepared in the background, dates, who, flights); "Şimdilik bununla
  // oluştur" works before the list is full; generating shows real steps; the board has Koh Phangan Gezisi.
  const sentence = "Sabine ile beraber Tayland Kohphandan 1 ay 10 ocak civarları gitmeyi düşünüyorum";
  const todayIso = new Date().toISOString().slice(0, 10);
  const jan10 = `${Number(todayIso.slice(0, 4)) + (todayIso.slice(5) > "01-10" ? 1 : 0)}-01-10`;
  const feb10 = `${jan10.slice(0, 4)}-02-10`;
  const rev = { message: 0, reply: 0, route: 0, routeFor: [] };
  const later = (ms) => new Promise((r) => setTimeout(r, ms));
  const json = (route, value) => route.fulfill(reply([{ text: JSON.stringify(value) }]));
  const empty = { destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0, duration_days: 0, duration_months: 0, styles: [], budget: "" };
  const revModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    if (prompt.includes("<start_message>") && prompt.includes("Kohphandan")) {
      rev.message++;
      await later(1500); // slow enough to see the row that says it is writing
      return json(route, {
        ...empty, destination: "Koh Phangan", destination_country: "Tayland", destination_country_code: "TH", names: ["Sabine"], start_date: jan10, duration_months: 1,
        reply: { text: "Sabine ile Koh Phangan kulağa harika geliyor: palmiyeli koylar, orman şelaleleri ve dolunay sahilleri.", question: "Bu gezide en çok ne istiyorsunuz?" },
      });
    }
    if (prompt.includes("<start_message>") && prompt.includes("İstanbul") && !prompt.includes("Kohphandan")) {
      rev.message++;
      await later(900);
      // The model of the bug: İstanbul as the destination and the origin both.
      return json(route, {
        ...empty, destination: "İstanbul", destination_country: "Türkiye", destination_country_code: "TR", origin: "İstanbul",
        reply: { text: "İstanbul'dan Koh Phangan'a uzun ama keyifli bir yol.", question: "Bu gezide en çok ne arıyorsunuz?" },
      });
    }
    if (prompt.includes("<route_request>") && prompt.includes("Koh Phangan")) {
      rev.route++;
      rev.routeFor.push(prompt);
      await later(4000); // slow, so the route's row pressed meanwhile waits for it ("Rotayı çiziyor…")
      return json(route, { stops: [{ city: "Koh Phangan", nights: 21, country_code: "TH" }, { city: "Koh Samui", nights: 10, country_code: "TH" }], arrival_airport_city: "Koh Samui", departure_airport_city: "Koh Samui" });
    }
    if (prompt.includes("<start_reply>")) {
      rev.reply++;
      return json(route, { text: "", question: "" });
    }
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", revModel);
  // The places' photos (the city-image proxy, else Wikipedia): a coloured picture for each.
  const photoSvg = (hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="hsl(${hue},60%,55%)"/></svg>`;
  const wiki = (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "x");
    return route.fulfill({ json: route.request().url().includes("/summary/") ? { originalimage: { source: `https://upload.wikimedia.org/e2e/${encodeURIComponent(name)}.jpg` } } : { items: [] } });
  };
  const upload = (route) => route.fulfill({ contentType: "image/svg+xml", body: photoSvg(Math.round(Math.random() * 360)) });
  const proxy = (route) => route.fulfill({ status: 404, json: {} });
  await flow.route(/wikipedia\.org\/api\/rest_v1\//, wiki);
  await flow.route(/upload\.wikimedia\.org\/e2e\//, upload);
  await flow.route(/functions\/v1\/city-image/, proxy);
  // The board reloads itself when its language changes (main.tsx).
  const switchLang = (to) => Promise.all([board.waitForEvent("load"), board.evaluate((l) => chrome.storage.local.set({ lang: l }), to).catch(() => undefined)]);
  await switchLang("en");
  await board.getByRole("button", { name: /My trips/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await board.locator(".st-hello").waitFor();
  await board.getByLabel("Trip box").fill(sentence);
  await board.getByRole("button", { name: /Start planning/ }).click();
  // A trip named "Tayland" may be there already (step 19's capture): a new one.
  await board.locator(".st-ask, .st-screen").first().waitFor();
  if (await board.locator(".st-ask").count()) await board.locator(".st-ask").getByRole("button", { name: "New trip", exact: true }).click();
  const chat = board.locator(".st-chat");
  // The code's line at once, in Turkish; the row says it's writing; then the model's line over it.
  // "Kohphandan" is a loose spelling: the code asks back, never takes it silently ...
  await board.locator(".st-msg-bot", { hasText: "Koh Phangan mı demek istedin?" }).waitFor();
  const firstLine = await board.locator(".st-msg-bot").first().elementHandle();
  // v5: the step line names what the running call reads; the row the message can still fill reads too.
  await board.locator(".st-thinking[data-call=read]", { hasText: "Koh Phangan'ı tanıyorum…" }).waitFor();
  await board.locator(".st-side .st-row.reading", { hasText: "Nereden" }).waitFor();
  // The row is its own polite status, outside the conversation's log.
  await board.locator(".st-status[role=status][aria-live=polite] .st-thinking").waitFor();
  assert.equal(await board.locator(".st-msgs .st-thinking, [role=log] [role=status]").count(), 0, "the status row is not inside the log");
  await board.waitForTimeout(500); // the lines' fade-in done, the model still writing (1.5 s)
  await board.screenshot({ path: `${out}/21b-start-thinking.png` });
  // ... the model read it as Koh Phangan: its line replaces the code's, in the same element (not made anew).
  await board.locator(".st-msg-bot", { hasText: "palmiyeli koylar, orman şelaleleri ve dolunay sahilleri. Koh Phangan'da en çok ne yapmak istersiniz?" }).waitFor();
  assert.match(await firstLine.evaluate((n) => n.isConnected && n.textContent), /palmiyeli koylar/, "the replaced line keeps its element");
  await board.locator(".st-thinking").waitFor({ state: "detached" });
  assert.equal(await board.locator(".st-side .st-row.reading").count(), 0, "the reading is over: no row reads");
  // The route's row pressed while the proposal is still on its way (rev 3): the chat says it's drawing it and goes
  // on; only the Rota row says "Rotayı çiziyor…"; "Oluştur" can be pressed meanwhile; the proposal is said when it comes.
  await board.locator(".st-side .st-row", { hasText: "Rota" }).click();
  await board.locator(".st-msg-bot", { hasText: "Rotayı çiziyorum; hazır olunca burada öneririm." }).waitFor();
  await board.locator(".st-side .st-row.drawing .st-row-drawing", { hasText: "Rotayı çiziyor…" }).waitFor();
  assert.equal(await board.locator(".st-thinking[data-call=read]").count(), 0, "the chat isn't held by the route");
  // The route call running: its own step line (v5), never a reading one.
  await board.locator(".st-thinking[data-call=route]", { hasText: "Rotayı düşünüyorum…" }).waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true, "Oluştur works while the route is drawn");
  await board.locator(".st-msg-bot", { hasText: "Rota önerim: Koh Phangan 21 · Koh Samui 10 gece. Bu olsun mu?" }).waitFor({ timeout: 15000 });
  await board.locator(".st-side .st-row-drawing").waitFor({ state: "detached" });
  // Back to where from (the route stays a proposal).
  await board.locator(".st-side .st-row", { hasText: "Nereden" }).click();
  await board.locator(".st-msg-bot", { hasText: /^Koh Phangan'a nereden yola çıkıyorsunuz\?$/ }).waitFor();
  const revList = board.locator(".st-side .st-list");
  await revList.getByText("Koh Phangan · Tayland").waitFor();
  await revList.getByText(/10 Ocak – 10 Şubat · 31 gece/).waitFor();
  // The preview fills in while chatting: the route proposed in the background, the dates, who, the flights, photos.
  // One card (drawing v3): the route and the flights sit in their rows, the photos on top of the list.
  await revList.getByText("Öneri: Koh Phangan 21 · Koh Samui 10 gece").waitFor({ timeout: 15000 });
  await revList.getByText(/10 Ocak – 10 Şubat · 31 gece/).waitFor();
  await revList.getByText(/Sabine/).first().waitFor();
  await revList.locator(".st-pv-photo img.in").first().waitFor({ timeout: 15000 });
  // The photos are a mosaic (one big, two beside it) by default; the strip is the other layout, kept in this browser.
  assert.equal(await revList.locator(".st-pv-mosaic .st-pv-photo").count(), 3, "the trip's photos sit in a mosaic of three");
  assert.equal(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "the mosaic doesn't widen the page");
  await revList.getByRole("button", { name: /Strip|Şerit/ }).click();
  assert.equal(await revList.locator(".st-pv-mosaic").count(), 0, "the strip replaces the mosaic");
  assert.ok((await revList.locator(".st-pv-photos .st-pv-photo").count()) >= 1, "the photo strip is still there");
  await revList.getByRole("button", { name: /Mosaic|Mozaik/ }).click();
  assert.equal(await revList.locator(".st-pv-mosaic").count(), 1, "and back to the mosaic");
  assert.equal(await board.locator(".st-pv").count(), 0, "no second box: the preview is part of the list");
  const genBtn = board.locator(".st-side .st-gen-btn");
  assert.match(await genBtn.innerText(), /Oluştur/, "one word at every step: what is missing is said under the button");
  assert.match(await board.locator(".st-side .st-gen-card p").innerText(), /Elimdekiyle kurarım, eksikleri panoda sorarım\. Ya da konuşmaya devam et\./);
  assert.equal(await genBtn.isEnabled(), true, "it works with the destination known");
  // "İstanbul" to "Nereden?": where from, never the destination.
  await chat.getByLabel("Mesaj").fill("İstanbul");
  await chat.getByLabel("Mesaj").press("Enter");
  await board.locator(".st-msg-bot", { hasText: "İstanbul'dan Koh Phangan'a uzun ama keyifli bir yol. Bu gezide en çok ne arıyorsunuz?" }).waitFor();
  // Where, when, where from and who known: the trip would make itself in 3 s (2026-10-06); stopped here to look.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-auto").waitFor({ state: "detached" });
  await revList.getByText("Koh Phangan · Tayland").waitFor();
  assert.equal(await revList.locator(".st-row").first().innerText().then((t) => /İstanbul/.test(t)), false, "the destination is not İstanbul");
  await revList.locator(".st-row", { hasText: "Nereden" }).getByText(/^İstanbul/).first().waitFor();
  await revList.getByText("Uçuş: İstanbul ⇄ Koh Samui").waitFor();
  assert.match(await genBtn.innerText(), /Oluştur/);
  await board.screenshot({ path: `${out}/21a-start-interview-preview.png` });
  // Every assistant line is Turkish on the English board.
  const lines = await board.locator(".st-msg-bot").allInnerTexts();
  for (const line of lines) {
    assert.doesNotMatch(line, /\b(Got it|Where|people|nights|Great|sounds|What|Generate)\b/, `an English line: ${line}`);
    assert.match(line, /[çğıöşüİ]/, `not Turkish: ${line}`);
  }
  assert.equal(await board.locator(".st-top-title").innerText(), "Koh Phangan · yeni gezi");
  // The model budget for this interview: one call per typed message, one route call for Koh Phangan · 31 nights.
  assert.equal(rev.message, 2, "one read-and-reply call per typed message");
  assert.equal(rev.route, 1, "the route asked once, for the destination (never the origin)");
  assert.ok(!rev.routeFor[0].includes("Yer: İstanbul"), "the route is for Koh Phangan");
  // Generate with what there is; the steps say what they really wrote. v5: the light SVG map (the bundled world, drawn
  // three times side by side for the date line), never a map library on this screen.
  await watchGen();
  await genBtn.click();
  await board.locator(".st-gen", { hasText: /Koh Phangan.* planlanıyor/ }).waitFor();
  assert.equal(await board.locator(".st-gen-foot").innerText().then((t) => /%/.test(t)), false, "no percentages");
  await board.screenshot({ path: `${out}/21c-start-generating.png` });
  await board.getByRole("heading", { name: titled("Koh Phangan") }).waitFor({ timeout: 20000 });
  const kpGen = await genSeen();
  // The map speaks the chat's language on the English board; the bundled world as SVG; no canvas (no MapLibre).
  assert.equal(kpGen.credit, "Harita: Natural Earth");
  assert.ok(kpGen.land >= 1, "the bundled world, as SVG (only the copies in view: the side ones near the date line)");
  assert.equal(kpGen.canvas, 0, "no canvas (no MapLibre) on the generating screen");
  // The big steps: 28 px marks (their layout size: a tick popping in is scaled for a moment).
  assert.equal(kpGen.mark, 28, "28 px step icons");
  // Rev 3: "Oluştur" builds the proposal on screen (the model's, kept in the background) rather than one stop.
  assert.ok(kpGen.steps.some((x) => /^Gezi açıldı: .*Koh Phangan/.test(x)), "the trip opened");
  for (const step of ["Rota çizildi: Koh Phangan 21 gece → Koh Samui 10 gece", "İstanbul ⇄ Koh Samui uçuşları için yer açıldı"]) assert.ok(kpGen.steps.includes(step), `step "${step}" (${kpGen.steps.join(" | ")})`);
  assert.ok(kpGen.steps.some((x) => x.startsWith("2 kişi")), "who goes");
  const kp = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => /Koh Phangan/.test(t.title));
    const items = (await all("items")).filter((i) => i.tripId === trip.id);
    return {
      dates: trip.confirmedDates,
      stays: items.filter((i) => i.category === "stay").map((i) => `${i.city} ${i.countryCode}`).sort(),
      flights: items.filter((i) => i.category === "flight").map((i) => `${i.flight.from}→${i.flight.to}`).sort(),
      travellers: trip.travellers,
      hero: Boolean(trip.heroImage),
      istanbulTrips: (await all("trips")).filter((t) => /istanbul/i.test(t.title)).length,
    };
  });
  assert.deepEqual(kp, {
    dates: { start: jan10, end: feb10 },
    stays: ["Koh Phangan TH", "Koh Samui TH"],
    flights: ["Koh Samui→İstanbul", "İstanbul→Koh Samui"],
    travellers: { names: ["Sabine"], count: 2 },
    hero: true,
    istanbulTrips: 0,
  });
  await board.locator(".x-hero").getByText("Thailand", { exact: false }).first().waitFor();
  await board.locator(".chat .msg-assistant", { hasText: /Koh Phangan.* hazır: 31 gece, 2 durak\./ }).waitFor();
  await board.screenshot({ path: `${out}/21d-start-board.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", revModel);
  await flow.unroute(/wikipedia\.org\/api\/rest_v1\//, wiki);
  await flow.unroute(/upload\.wikimedia\.org\/e2e\//, upload);
  await flow.unroute(/functions\/v1\/city-image/, proxy);
  await switchLang("tr");
  console.log(`✓ start rev 3 on rev 2's conversation: the Rota row says "Rotayı çiziyor…" while the chat goes on and Oluştur works; the proposal is built (Koh Phangan 21 · Koh Samui 10)`);

  // 22. Rev 3, the Sri Lanka report: the owner's exact sentence with a slow model (its reading comes after 9 s, its
  // route after 12 s). The code reads it at once (Sri Lanka, Sabine, 20 Kasım – 4 Aralık · 14 gece); the chat goes
  // on with chips while the model is slow; the classic circuit is proposed at once; "Şimdilik bununla oluştur" is
  // pressed while the Rota row still says "Rotayı çiziyor…"; the trip is built with the circuit; the generating
  // screen flies İstanbul → Sri Lanka on the bundled map, then fans in the stops' photos.
  const lkSentence = "Sabine ile beraber 20 kasım civarı Sri lankaya gitmek isityorum 2 hafta";
  const lk = { message: 0, route: 0 };
  const fulfillLate = async (route, ms, value) => {
    await later(ms);
    // Stopped by the page meanwhile (the trip is being made): nothing to answer.
    await json(route, value).catch(() => undefined);
  };
  const lkModel = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    if (prompt.includes("<start_message>")) {
      lk.message++;
      return fulfillLate(route, 9000, { ...empty, destination: "Sri Lanka", destination_country: "Sri Lanka", destination_country_code: "LK", names: ["Sabine"], reply: { text: "", question: "" } });
    }
    if (prompt.includes("<route_request>")) {
      lk.route++;
      return fulfillLate(route, 12000, { stops: [{ city: "Kandy", nights: 4, country_code: "LK" }, { city: "Ella", nights: 4, country_code: "LK" }, { city: "Galle", nights: 6, country_code: "LK" }], arrival_airport_city: "Kolombo", departure_airport_city: "Kolombo" });
    }
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", lkModel);
  await flow.route(/wikipedia\.org\/api\/rest_v1\//, wiki);
  await flow.route(/upload\.wikimedia\.org\/e2e\//, upload);
  await flow.route(/functions\/v1\/city-image/, proxy);
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await board.locator(".st-hello").waitFor();
  await board.getByLabel("Gezi kutusu").fill(lkSentence);
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  await board.locator(".st-ask, .st-screen").first().waitFor();
  if (await board.locator(".st-ask").count()) await board.locator(".st-ask").getByRole("button", { name: "Yeni gezi", exact: true }).click();
  const lkList = board.locator(".st-side .st-list");
  // At once, without the model (it answers in 9 s): where, who, when.
  const sentAt = Date.now();
  await lkList.locator(".st-row.done", { hasText: "Sri Lanka" }).waitFor({ timeout: 3000 });
  await lkList.locator(".st-row.done", { hasText: "Sabine ile · 2 kişi" }).waitFor({ timeout: 3000 });
  await lkList.locator(".st-row.done", { hasText: "20 Kasım – 4 Aralık · 14 gece" }).waitFor({ timeout: 3000 });
  // K4: what they want comes first, then the route, and where from last.
  await board.locator(".st-msg-bot .st-q", { hasText: "Sri Lanka'da en çok ne yapmak istersiniz?" }).waitFor({ timeout: 3000 });
  assert.ok(Date.now() - sentAt < 4000, "captured before the model answered");
  assert.equal(await board.locator(".st-msg-bot", { hasText: "Nereye gidiyoruz?" }).count(), 0, "where to isn't asked again");
  // The chat goes on while the model is still reading (chips, no waiting).
  await answers.getByRole("button", { name: /Doğa/ }).click();
  await answers.getByRole("button", { name: "Tamam" }).click();
  // The classic circuit at once; the model's route still on its way (the Rota row says so).
  const lkProposal = board.locator(".st-msg-bot", { hasText: /Rota önerim: Sigiriya \d+ · Kandy \d+ · Ella \d+ · Mirissa \d+ gece\. Bu olsun mu\?/ });
  await lkProposal.waitFor({ timeout: 3000 });
  const drawingRow = board.locator(".st-side .st-row.drawing .st-row-drawing", { hasText: "Rotayı çiziyor…" });
  await drawingRow.waitFor();
  // Where from by its row, while the route is still drawn; the essentials known: the countdown, stopped to go on by hand.
  await board.locator(".st-side .st-row", { hasText: "Nereden" }).click();
  await board.locator(".st-msg-bot .st-q", { hasText: "Sri Lanka'ya nereden yola çıkıyorsunuz?" }).last().waitFor();
  await answers.getByRole("button", { name: "İstanbul", exact: true }).click();
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  await drawingRow.waitFor();
  const lkGen = board.locator(".st-side .st-gen-btn");
  assert.equal(await lkGen.isEnabled(), true, "Oluştur works while the route is drawn");
  assert.equal(await lkGen.evaluate((b) => getComputedStyle(b).backgroundColor), "rgb(34, 27, 58)", "and it looks it (not greyed)");
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/23a-start-srilanka-circuit.png` });
  // Pressed while "Rotayı çiziyor…" shows: the circuit is built.
  await watchGen();
  await lkGen.click();
  await board.locator(".st-gen", { hasText: /Sri Lanka.* planlanıyor/ }).waitFor();
  // Pictures along the way (best effort: the board opens by itself a few seconds in).
  await board.locator(".st-gen .gm[data-phase=flying]").waitFor({ timeout: 6000 }).then(() => board.screenshot({ path: `${out}/23b-start-map-midflight.png` })).catch(() => undefined);
  await board.locator(".st-gen .gm[data-phase=landed]").waitFor({ timeout: 6000 }).then(() => board.screenshot({ path: `${out}/23c-start-map-landed.png` })).catch(() => undefined);
  await board.getByRole("heading", { name: titled("Sri Lanka") }).waitFor({ timeout: 20000 });
  // v5: the light SVG map: home, the white plane flying the arc to Sri Lanka, a ring where it lands, then the stops
  // (never before it lands) and the photos inside the card; no canvas.
  const lkGenSeen = await genSeen();
  assert.deepEqual(lkGenSeen.phases.filter((p) => ["flying", "landed"].includes(p)), ["flying", "landed"], `the map's phases (${lkGenSeen.phases.join(" → ")})`);
  assert.ok(lkGenSeen.plane && lkGenSeen.home && lkGenSeen.ring, "the plane, home, the landing ring");
  assert.ok(!lkGenSeen.early, "the stops wait for the landing");
  assert.deepEqual(lkGenSeen.stops, ["Sigiriya", "Kandy", "Ella", "Mirissa"]);
  assert.equal(lkGenSeen.canvas, 0, "no canvas (no MapLibre)");
  // The trip is made at its own pace (never waiting on the map).
  assert.ok(lkGenSeen.steps.some((x) => /^Klasik rota çizildi: Sigiriya \d+ gece → Kandy \d+ gece → Ella \d+ gece → Mirissa \d+ gece$/.test(x)), `the classic route (${lkGenSeen.steps.join(" | ")})`);
  const lkMade = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).filter((t) => /Sri Lanka/.test(t.title)).at(-1);
    const items = (await all("items")).filter((i) => i.tripId === trip.id);
    return {
      dates: trip.confirmedDates,
      stays: items.filter((i) => i.category === "stay").sort((a, b) => a.dates.start.localeCompare(b.dates.start)).map((i) => `${i.city} ${i.countryCode}`),
      flights: items.filter((i) => i.category === "flight").map((i) => `${i.flight.from}→${i.flight.to}`).sort(),
      travellers: trip.travellers,
    };
  });
  assert.deepEqual(lkMade.stays, ["Sigiriya LK", "Kandy LK", "Ella LK", "Mirissa LK"]);
  assert.deepEqual(lkMade.flights, ["Kolombo→İstanbul", "İstanbul→Kolombo"]);
  assert.equal(lkMade.dates.start.slice(5), "11-20");
  assert.deepEqual(lkMade.travellers, { names: ["Sabine"], count: 2 });
  await board.screenshot({ path: `${out}/23d-start-srilanka-board.png` });
  // D5 (K12 a): Oluştur was pressed while the route was only proposed: the circuit's stays are Önerimiz with nothing chosen,
  // still looked for as before ("Kendin ara"), "Rotayı onayla" their button; agreed once, they are the stays to find.
  const lkStay = board.locator('.q-sec[data-section="stay"]');
  if (!(await lkStay.evaluate((el) => el.classList.contains("open")))) await lkStay.locator(".q-tt").click();
  await lkStay.locator(".q-fold.on").waitFor();
  const lkFirst = lkStay.locator('.q-ints > .q-int[aria-label="Sigiriya"]');
  assert.equal(await lkFirst.getAttribute("data-st"), "ai", "a proposed route's stay is our pick's colour");
  assert.equal(flat([await lkFirst.locator(".q-st").innerText()])[0], "✨ Önerimiz · onayla");
  assert.ok((await lkFirst.locator(".z-pi").count()) > 0, "still looked for: Kendin ara");
  assert.equal(await lkFirst.locator(".z-bt .q-agree").innerText(), "Rotayı onayla");
  assert.equal(Math.round((await lkFirst.boundingBox()).height), 288);
  await lkFirst.locator(".z-bt .q-agree").click();
  await lkStay.locator('.q-ints > .q-int[data-st="ai"]').first().waitFor({ state: "detached" });
  assert.equal(flat([await lkFirst.locator(".q-st").innerText()])[0], "Aranıyor", "agreed: the stays to find");
  assert.equal(await lkFirst.locator(".q-agree").count(), 0);
  assert.equal(lk.message, 1, "one reading call");
  assert.equal(lk.route, 1, "one route call");
  await flow.unroute("https://generativelanguage.googleapis.com/**", lkModel);
  console.log("✓ start rev 3, Sri Lanka: the exact sentence read at once with a slow model (Sri Lanka, Sabine, 20 Kasım – 4 Aralık · 14 gece); chips go on while it reads; the classic circuit at once; Oluştur pressed while the Rota row draws builds Sigiriya · Kandy · Ella · Mirissa with İstanbul ⇄ Kolombo, Önerimiz until Rotayı onayla (D5); the map flies İstanbul → Sri Lanka with an arc and a plane, the stops dotted, then the photos");

  // 23. The owner's second report: "Lets go to Papua New Gune with my friend for 3 weeks on nov" on an English board
  // captured nothing. Now, without waiting for the model (it never answers here): Papua New Guinea asked back, a
  // friend, November · 3 weeks; then where from; no names question before the trip is made (asked once on the
  // board's chat). And the Turkish equivalent, exact, taken at once.
  const silent = async (route) => {
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    const prompt = JSON.stringify(body?.contents ?? "");
    if (prompt.includes("<start_message>")) return fulfillLate(route, 30000, { ...empty, reply: { text: "", question: "" } });
    if (prompt.includes("<route_request>")) return route.fulfill({ status: 500, json: { error: { code: 500, message: "e2e", status: "INTERNAL" } } });
    return route.fallback();
  };
  await flow.route("https://generativelanguage.googleapis.com/**", silent);
  await switchLang("en");
  await board.getByRole("button", { name: /My trips/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await board.locator(".st-hello").waitFor();
  await board.getByLabel("Trip box").fill("Lets go to Papua New Gune with my friend for 3 weeks on nov");
  await board.getByRole("button", { name: /Start planning/ }).click();
  await board.locator(".st-ask, .st-screen").first().waitFor();
  if (await board.locator(".st-ask").count()) await board.locator(".st-ask").getByRole("button", { name: "New trip", exact: true }).click();
  const pngList = board.locator(".st-side .st-list");
  await board.locator(".st-msg-bot .st-q", { hasText: "Did you mean Papua New Guinea?" }).waitFor({ timeout: 3000 });
  await pngList.locator(".st-row.done", { hasText: "With a friend · 2 people" }).waitFor({ timeout: 3000 });
  await pngList.locator(".st-row.done", { hasText: "November · 3 weeks" }).waitFor({ timeout: 3000 });
  await board.locator(".st-msg-bot", { hasText: "3 weeks in November with a friend." }).waitFor();
  // "Where to" is filled at once, marked to check (not the done tick), counted; Generate works with it.
  const tentativeRow = pngList.locator(".st-row.tentative", { hasText: "Papua New Guinea?" });
  await tentativeRow.waitFor({ timeout: 3000 });
  await tentativeRow.getByText("· check").waitFor();
  assert.equal(await pngList.locator(".st-row.tentative.done").count(), 0, "not ticked");
  assert.equal(await pngList.locator(".st-row", { hasText: "Where to" }).getByText("· needed").count(), 0, "not 'needed'");
  await pngList.getByText("3 of 6 captured").waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true, "Generate works with the guess");
  assert.equal(await board.locator(".st-top-title").innerText(), "Papua New Guinea · new trip");
  await board.waitForTimeout(600); // the lines and rows faded in
  await board.screenshot({ path: `${out}/23e-start-png-captured.png` });
  await answers.getByRole("button", { name: "Yes", exact: true }).click();
  await board.locator(".st-msg-bot", { hasText: "Papua New Guinea, 3 weeks in November with a friend." }).waitFor();
  // K4 (2026-10-09): the day first (a month only), then what you want; where from is asked last.
  await board.locator(".st-msg-bot .st-q", { hasText: "Which day in November are you setting off for Papua New Guinea?" }).last().waitFor();
  assert.equal(await board.locator(".st-top-title").innerText(), "Papua New Guinea · new trip", "the country's own name, never the typing");
  await pngList.locator(".st-row.done", { hasText: "Papua New Guinea" }).waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true);
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/23f-start-png-from.png` });
  await answers.getByRole("button", { name: "Skip" }).click();
  await board.locator(".st-msg-bot .st-q", { hasText: "What would you most like to do in Papua New Guinea?" }).waitFor();
  await answers.getByRole("button", { name: "Skip" }).click();
  await board.locator(".st-msg-bot", { hasText: "I'd keep it to one stop: Papua New Guinea 21 nights. Go with it?" }).waitFor();
  await answers.getByRole("button", { name: "Go with it" }).click(); // the route
  await board.locator(".st-msg-bot .st-q", { hasText: "Where are you setting off for Papua New Guinea from?" }).last().waitFor();
  await chat.getByLabel("Message").fill("London");
  await chat.getByLabel("Message").press("Enter");
  // Never a names question in the start chat; never "Got it: With friends. Who's coming?".
  const pngLines = await board.locator(".st-msg-bot").allInnerTexts();
  for (const line of pngLines) {
    assert.doesNotMatch(line, /\bnames?\b|Who's coming/i, `asked for names before the trip: ${line}`);
    assert.doesNotMatch(line, /Got it:/, `an echo: ${line}`);
  }
  await board.locator(".st-side .st-gen-btn").click();
  await board.getByRole("heading", { name: titled("Papua New Guinea") }).waitFor({ timeout: 20000 });
  await board.locator(".chat .msg-assistant", { hasText: "Tell me their names if you like." }).waitFor();
  console.log("✓ start rev 3, the second report (English): \"Papua New Gune\" asked back as Papua New Guinea, a friend, November · 3 weeks at once; then the day, what they want, where from last; no names before the trip; the board's chat asks them once");

  // The Turkish equivalent: exact, taken at once.
  await switchLang("tr");
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await board.locator(".st-hello").waitFor();
  await board.getByLabel("Gezi kutusu").fill("Kasımda arkadaşımla 3 haftalığına Papua Yeni Gine'ye gidelim");
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  await board.locator(".st-ask, .st-screen").first().waitFor();
  if (await board.locator(".st-ask").count()) await board.locator(".st-ask").getByRole("button", { name: "Yeni gezi", exact: true }).click();
  const trList = board.locator(".st-side .st-list");
  await trList.locator(".st-row.done", { hasText: "Papua Yeni Gine" }).waitFor({ timeout: 3000 });
  await trList.locator(".st-row.done", { hasText: "Bir arkadaşınla · 2 kişi" }).waitFor({ timeout: 3000 });
  await trList.locator(".st-row.done", { hasText: "Kasım · 3 hafta" }).waitFor({ timeout: 3000 });
  await board.locator(".st-msg-bot", { hasText: "Bir arkadaşınla Papua Yeni Gine, Kasım'da 3 hafta." }).waitFor({ timeout: 3000 });
  await board.locator(".st-msg-bot .st-q", { hasText: "Papua Yeni Gine'ye Kasım'da hangi gün çıkıyorsunuz?" }).waitFor({ timeout: 3000 });
  assert.equal(await board.locator(".st-top-title").innerText(), "Papua Yeni Gine · yeni gezi");
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/23g-start-png-tr.png` });
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();

  // 25. The board's Harita tab: a Denmark–Netherlands trip, every journey in date order. Out from Istanbul (booked),
  // Copenhagen → Amsterdam by plane (booked), a train to Rotterdam (not booked: dashed; Rotterdam isn't in the
  // city table, so it's geocoded), home from Rotterdam, and a chosen day trip to a place no one can find (listed under it; one only saved would not be drawn).
  const rotterdam = (route) => (/rotterdam/i.test(new URL(route.request().url()).searchParams.get("q") ?? "") ? route.fulfill({ json: [{ lat: "51.92", lon: "4.48" }] }) : route.fallback());
  await flow.route("https://nominatim.openstreetmap.org/**", rotterdam);
  await board.evaluate(async () => {
    const database = await new Promise((resolve, reject) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    const tx = database.transaction(["trips", "items"], "readwrite");
    const now = Date.now();
    const t = { id: "e2e-map", title: "Danimarka ve Hollanda", confirmedDates: { start: "2026-10-08", end: "2026-10-18" }, budget: null, heroImage: null, createdAt: now, updatedAt: now };
    const base = (over) => ({
      tripId: t.id, captureIds: ["e2e-cap"], key: null, category: "stay", provider: null, summary: "", optionDetail: null, url: null, imageUrl: null,
      country: null, countryCode: null, guests: { adults: 2, children: null, rooms: null }, location: { address: null, area: null, approximate: false },
      price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null,
      highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: now, updatedAt: now, ...over,
    });
    const flight = (id, from, to, dep, arr, status) =>
      base({ id, category: "flight", name: `${from} → ${to}`, needKey: `flight:${from}-${to}`.toLowerCase(), status, dates: { start: dep.slice(0, 10), end: null, source: "page" }, flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 } });
    tx.objectStore("trips").put(t);
    for (const i of [
      flight("e2e-map-1", "IST", "CPH", "2026-10-08T07:10", "2026-10-08T09:45", "booked"),
      base({ id: "e2e-map-2", name: "Hotel Nyhavn", city: "Kopenhag", countryCode: "DK", needKey: "stay:kopenhag", dates: { start: "2026-10-08", end: "2026-10-12", source: "page" } }),
      flight("e2e-map-3", "CPH", "AMS", "2026-10-12T11:00", "2026-10-12T12:25", "booked"),
      base({ id: "e2e-map-4", name: "Canal House", city: "Amsterdam", countryCode: "NL", needKey: "stay:amsterdam", status: "chosen", dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }),
      flight("e2e-map-5", "AMS", "Zzyzx", "2026-10-13T08:00", "2026-10-13T09:00", "chosen"),
      base({ id: "e2e-map-6", category: "transport", name: "NS Intercity train Amsterdam → Rotterdam", city: "Rotterdam", countryCode: "NL", needKey: "transport:rotterdam", status: "saved", dates: { start: "2026-10-15", end: null, source: "page" } }),
      base({ id: "e2e-map-7", name: "Hotel New York", city: "Rotterdam", countryCode: "NL", needKey: "stay:rotterdam", dates: { start: "2026-10-15", end: "2026-10-18", source: "page" } }),
      flight("e2e-map-8", "RTM", "IST", "2026-10-18T18:00", "2026-10-18T22:40", "saved"),
    ]) tx.objectStore("items").put(i);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const mapAsked = tileAsks.style;
  await board.goto(`chrome-extension://${id}/app.html#trip=e2e-map`);
  await board.getByRole("heading", { name: "Danimarka ve Hollanda" }).waitFor();
  assert.equal(await board.locator(".tm canvas").count(), 0, "no map until the tab opens");
  assert.equal(tileAsks.style, mapAsked, "nor its style asked for");
  assert.equal(await board.evaluate(() => Boolean(document.querySelector('script[src*="maplibre"]'))), false, "nor its library loaded");
  // v11: the map is Gün gün's own switch (Liste | Harita), no tab of its own.
  assert.equal(await board.getByRole("tab", { name: "Harita" }).count(), 0);
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".days-mode").getByRole("button", { name: "Harita" }).click();
  const tm = board.locator("figure.tm-board");
  await board.locator(".tm-board[data-phase=ready]").waitFor({ timeout: 8000 });
  await tm.locator("canvas").waitFor();
  // Rotterdam comes once it's geocoded; the place no one finds is said under the map.
  await tm.locator(".tm-stop", { hasText: "Rotterdam" }).waitFor({ timeout: 8000 });
  await board.locator(".tm-missing", { hasText: "1 yolculuk haritada yok: yeri bilinmiyor" }).waitFor({ timeout: 8000 });
  assert.match(await board.locator(".tm-missing-list").innerText(), /Amsterdam → Zzyzx/);
  assert.deepEqual(await tm.locator(".tm-stop").evaluateAll((n) => n.map((x) => x.dataset.name)), ["Kopenhag", "Amsterdam", "Rotterdam"]);
  assert.equal(await tm.locator(".tm-stop", { hasText: "Kopenhag" }).locator(".tm-n").innerText(), "4", "Copenhagen's nights");
  assert.equal(await tm.locator(".tm-home").count(), 1, "home");
  const pills = await tm.locator(".tm-dur").evaluateAll((n) => n.map((x) => `${x.dataset.from} → ${x.dataset.to} ${x.dataset.mode} ${x.dataset.booked === "true" ? "booked" : "planned"}`));
  assert.deepEqual(pills, [
    "İstanbul → Kopenhag flight booked",
    "Kopenhag → Amsterdam flight booked",
    "Amsterdam → Rotterdam train planned",
    "Rotterdam → İstanbul flight planned",
  ], "every journey in date order: out, the city-to-city flight, the train, home");
  assert.match(await tm.locator(".tm-dur[data-from=Kopenhag]").innerText(), /^~1 sa \d+ dk$/, "a flight's time worked out from the distance");
  await tm.scrollIntoViewIfNeeded();
  await board.waitForTimeout(800);
  await board.screenshot({ path: `${out}/25a-board-map.png` });
  // A stop's dates and nights.
  await tm.locator(".tm-stop", { hasText: "Kopenhag" }).click();
  const pop = tm.locator(".tm-pop");
  await pop.waitFor();
  assert.deepEqual((await pop.innerText()).split("\n").map((x) => x.trim()).filter(Boolean), ["Kopenhag", "8–12 Ekim", "4 gece"]);
  await board.screenshot({ path: `${out}/25b-board-map-stop.png` });
  // ▶ plays the trip: the plane flies the journeys, the camera following it.
  await tm.getByRole("button", { name: "Geziyi oynat" }).click();
  await tm.locator(".tm-plane").waitFor();
  assert.equal(await tm.getAttribute("data-playing"), "true");
  await board.waitForTimeout(1500);
  await board.screenshot({ path: `${out}/25c-board-map-playing.png` });
  await tm.getByRole("button", { name: "Durdur" }).click();
  await tm.locator(".tm-plane").waitFor({ state: "detached" });
  // Narrow: the map fits the column.
  await board.setViewportSize({ width: 560, height: 900 });
  await board.waitForTimeout(500);
  assert.ok((await tm.boundingBox()).width <= 560, "no wider than the board");
  await board.screenshot({ path: `${out}/25d-board-map-narrow.png` });
  await board.setViewportSize({ width: 1440, height: 900 });
  await flow.unroute("https://nominatim.openstreetmap.org/**", rotterdam);
  assert.deepEqual(cspErrors, [], "the map's library and worker load under the extension's CSP");
  console.log("✓ trip map (MapLibre): the generating screen flies home → Sri Lanka on the globe (the bundled map without WebGL); Harita draws every journey in date order (CPH → AMS by plane, a train, out and home), booked solid / planned dashed, stops with their nights and dates, ▶ plays it; an unplaceable journey is listed; no CSP errors; tiles simulated");

  // 26. Intent (2026-10-06, the owner's English test): "I want to go burning man africa with my friends and partner".
  // At once, without the model (it never answers here): AfrikaBurn in the Tankwa Karoo, South Africa; its dates said
  // as an estimate with the official site; the next question is the total length (its own chips). "+4 days in Cape
  // Town", where from, how many: the essentials known, "Generating… 3 · Cancel"; a typed letter stops it; a style
  // picked fills the checklist and it starts again; the trip makes itself: "AfrikaBurn 20xx", Cape Town 2 → Tankwa
  // Karoo 6 → Cape Town 2, İstanbul ⇄ Cape Town, 4 people.
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await board.locator(".st-hello").waitFor();
  await board.getByLabel("Gezi kutusu").fill("I want to go burning man africa with my friends and partner");
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  await board.locator(".st-ask, .st-screen").first().waitFor();
  if (await board.locator(".st-ask").count()) await board.locator(".st-ask").getByRole("button", { name: "Yeni gezi", exact: true }).click();
  const abList = board.locator(".st-side .st-list");
  await abList.locator(".st-row.done", { hasText: "AfrikaBurn · Tankwa Karoo · South Africa" }).waitFor({ timeout: 3000 });
  await abList.locator(".st-row", { hasText: /\d+ April – \d+ May \(estimated\) · how many days in all\?/ }).waitFor({ timeout: 3000 });
  await abList.locator(".st-row", { hasText: "With friends" }).waitFor({ timeout: 3000 });
  await board.locator(".st-msg-bot", { hasText: /AfrikaBurn 20\d\d usually runs late April to early May \(estimated \d+ April – \d+ May; check the official site\)\./ }).waitFor({ timeout: 3000 });
  assert.equal(await board.locator(".st-msg-bot a.st-link").getAttribute("href"), "https://www.afrikaburn.org", "the official site linked");
  await board.locator(".st-msg-bot .st-q", { hasText: "How many days in total: just AfrikaBurn, or some days in Cape Town before and after?" }).waitFor();
  assert.equal(await board.locator(".st-msg-bot", { hasText: "Where are we going?" }).count(), 0, "where to isn't asked");
  assert.equal(await board.locator(".st-top-title").innerText(), "AfrikaBurn · new trip");
  // v5: while the model reads (it never answers here), the step line names the event and the row it can still fill reads.
  await board.locator(".st-thinking[data-call=read]", { hasText: "Recognising AfrikaBurn…" }).waitFor();
  await abList.locator(".st-row.reading", { hasText: "Where from" }).waitFor();
  assert.deepEqual(await answers.locator(".st-chip").allInnerTexts(), ["Just AfrikaBurn (7 days)", "+2 days in Cape Town", "+4 days in Cape Town", "These dates are right", "📅 Different dates"]);
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/26a-intent-afrikaburn.png` });
  await answers.getByRole("button", { name: "+4 days in Cape Town" }).click();
  await board.locator(".st-msg-bot", { hasText: /The trip: \d+ April – \d+ May · 10 nights \(estimated\) \(Cape Town 2 · Tankwa Karoo 6 · Cape Town 2 nights\)\./ }).waitFor();
  await board.locator(".st-msg-bot .st-q", { hasText: "A tent camp, a caravan, or a hotel?" }).last().waitFor();
  await abList.locator(".st-row.done", { hasText: "Route" }).getByText("Cape Town 2 · Tankwa Karoo 6 · Cape Town 2 nights").waitFor();
  // K4 (2026-10-09): the festival's own questions (2026-10-07) first, each with its chips, then the style, how many,
  // and where from last. The countdown starts only when the essentials are in, so not before the last answer.
  // 0.36.83's "camp or a hotel?" is back as the festival question's third answer, beside the tent and the caravan.
  for (const chipName of ["Tent camp", "Let's rent a caravan", "Hotel"]) await answers.getByRole("button", { name: chipName, exact: true }).waitFor();
  for (const q of ["A tent camp, a caravan, or a hotel?", "Have you got your ticket yet?", "How many days before the festival would you like to arrive?"]) {
    await board.locator(".st-msg-bot .st-q", { hasText: q }).last().waitFor();
    await answers.getByRole("button", { name: "Skip" }).click();
  }
  await board.locator(".st-msg-bot .st-q", { hasText: "What are you after on this trip?" }).last().waitFor();
  await answers.getByRole("button", { name: "Skip" }).click(); // (answered later by its row: a changed checklist starts the countdown again)
  await board.locator(".st-msg-bot .st-q", { hasText: "How many of you are going, you included?" }).waitFor();
  assert.equal(await board.locator(".st-auto").count(), 0, "not before how many");
  await answers.getByRole("button", { name: "4", exact: true }).click();
  await board.locator(".st-msg-bot .st-q", { hasText: "Where are you setting off for AfrikaBurn from?" }).last().waitFor();
  assert.equal(await board.locator(".st-auto").count(), 0, "not before where from");
  // Typed (the origin's guess depends on the trips before this one).
  await chat.getByLabel("Message").fill("Istanbul");
  await chat.getByLabel("Message").press("Enter");
  const autoRow = board.locator(".st-auto", { hasText: "Generating…" });
  await autoRow.waitFor();
  assert.equal(await board.locator(".st-msg-bot a.st-link").first().innerText(), "Official site ↗", "in the chat's language");
  await board.waitForTimeout(450); // the row faded in
  await board.screenshot({ path: `${out}/26b-intent-countdown.png` });
  // A letter typed: stopped, and nothing is made.
  await chat.getByLabel("Message").fill("x");
  await autoRow.waitFor({ state: "detached" });
  await board.waitForTimeout(3500);
  assert.equal(await board.locator(".st-gen").count(), 0, "stopped: nothing made");
  await chat.getByLabel("Message").fill("");
  // A later full checklist starts it again (Adventure is still picked); then it makes itself.
  await watchGen();
  await board.locator(".st-side .st-row", { hasText: "What you're after" }).click();
  await answers.getByRole("button", { name: /Adventure/ }).click();
  await answers.getByRole("button", { name: "Done" }).click();
  await board.locator(".st-msg-bot", { hasText: "I'm ready and will build it in a few seconds. Write if you want to add anything." }).last().waitFor();
  // (the 3 s countdown may be over by the time we look: the generating screen is what counts)
  // (best effort: the generating screen may already be over; window.__gen keeps what it showed)
  await board.locator(".st-gen h2", { hasText: /^Planning .*AfrikaBurn/ }).waitFor({ timeout: 4000 }).then(() => board.screenshot({ path: `${out}/26c-intent-generating.png` })).catch(() => undefined);
  await board.getByRole("heading", { name: titled("AfrikaBurn") }).waitFor({ timeout: 20000 });
  const abGen = await genSeen();
  assert.equal(abGen.sub, "Istanbul → Cape Town → Tankwa Karoo 🎪 → Cape Town · 10 nights");
  assert.deepEqual(abGen.fest, ["Tankwa Karoo"], "the festival's stop is pink");
  assert.deepEqual(abGen.stops, ["Cape Town", "Tankwa Karoo"], "Cape Town once (its nights added up), the festival");
  assert.ok(abGen.steps.includes("Route drawn: Cape Town 2 nights → Tankwa Karoo 6 nights → Cape Town 2 nights"), `the route (${abGen.steps.join(" | ")})`);
  const ab = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => /AfrikaBurn/.test(t.title));
    const items = (await all("items")).filter((i) => i.tripId === trip.id);
    return {
      nights: Math.round((Date.parse(trip.confirmedDates.end) - Date.parse(trip.confirmedDates.start)) / 86400000),
      stays: items.filter((i) => i.category === "stay").sort((a, b) => a.dates.start.localeCompare(b.dates.start)).map((i) => `${i.city} ${i.countryCode}`),
      flights: items.filter((i) => i.category === "flight").map((i) => `${i.flight.from}→${i.flight.to}`).sort(),
      travellers: trip.travellers,
      style: trip.style?.ids,
      approx: trip.startGuide?.approxStart === trip.confirmedDates.start,
    };
  });
  assert.deepEqual(ab, {
    nights: 10,
    stays: ["Cape Town ZA", "Tankwa Karoo ZA", "Cape Town ZA"],
    flights: ["Cape Town→Istanbul", "Istanbul→Cape Town"],
    travellers: { names: [], count: 4 },
    style: ["adventure"],
    approx: true,
  });
  await board.waitForTimeout(800);
  await board.screenshot({ path: `${out}/26d-intent-board.png` });
  console.log("✓ intent (the owner's English test): AfrikaBurn at once (Tankwa Karoo · South Africa, the dates estimated with the official site, the length next); +4 days, Istanbul, 4 → the countdown; a typed letter stops it; a full checklist starts it again and the trip makes itself: AfrikaBurn 20xx, Cape Town 2 → Tankwa Karoo 6 → Cape Town 2, Istanbul ⇄ Cape Town, 4 people");
  await board.getByRole("button", { name: /Seyahatlerim|My trips/ }).first().click({ timeout: 3000 }).catch(() => undefined);
  await flow.unroute("https://generativelanguage.googleapis.com/**", silent);
  await flow.unroute(/wikipedia\.org\/api\/rest_v1\//, wiki);
  await flow.unroute(/upload\.wikimedia\.org\/e2e\//, upload);
  await flow.unroute(/functions\/v1\/city-image/, proxy);
  console.log("✓ start rev 3, the second report (Turkish): Papua Yeni Gine, Bir arkadaşınla · 2 kişi, Kasım · 3 hafta at once; \"Papua Yeni Gine'ye Kasım'da hangi gün çıkıyorsunuz?\" next, in bold");
  console.log(`✓ start rev 2: on an English board the Turkish sentence gets Turkish lines; "İstanbul" to Nereden is where from (the model calling it the destination changes nothing); Koh Phangan, Tayland, ${jan10} → ${feb10}; "Yazıyor…" while the model writes; the preview fills (route proposed in the background, photos, dates, flights İstanbul ⇄ Koh Samui); "Şimdilik bununla oluştur"; 2 read-and-reply calls, 1 route call`);
  console.log(`screenshots: ${out}`);
} finally {
  await flow.close();
}

// ---------------------------------------------------------------------------------------------
// Part 3: self-update. The installed folder is swapped for a newer version (as scripts/mac/update.sh
// does); the open board offers the update and the extension reloads into the new version.
// ---------------------------------------------------------------------------------------------
const installDir = path.join(mkdtempSync(path.join(tmpdir(), "trip-radar-install-")), "TripRadar");
cpSync(extension, installDir, { recursive: true });
const updating = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-upd-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1200, height: 800 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${installDir}`, `--load-extension=${installDir}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
await updating.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await updating.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The hero's photo proxy answers "no photo" unless a test routes it: never the live server.
await updating.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(updating);
try {
  const worker = updating.serviceWorkers()[0] ?? (await updating.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const board = await updating.newPage();
  // Settings open: an update must not reload the page under an open dialog.
  await board.goto(`chrome-extension://${id}/app.html#settings`);
  await board.locator(".modal-card").waitFor();
  const before = await board.evaluate(() => chrome.runtime.getManifest().version);

  const next = `${installDir}.new`;
  cpSync(installDir, next, { recursive: true });
  const manifest = JSON.parse(readFileSync(path.join(next, "manifest.json"), "utf8"));
  manifest.version = "99.0.0";
  writeFileSync(path.join(next, "manifest.json"), JSON.stringify(manifest));
  renameSync(installDir, `${installDir}.old`);
  renameSync(next, installDir);
  rmSync(`${installDir}.old`, { recursive: true });

  await board.evaluate(() => window.dispatchEvent(new Event("focus")));
  await board.getByText("Yeni sürüm hazır (99.0.0)").waitFor({ timeout: 10000 });
  await board.screenshot({ path: `${out}/10-update-banner.png` });
  // Dialog closed, nothing typed: it updates by itself after a short notice and asks to come back
  // to the same place. (The reload itself is stubbed; see below.)
  await board.evaluate(() => {
    window.__sent = [];
    chrome.runtime.sendMessage = (message) => {
      window.__sent.push(message);
      return Promise.resolve({ ok: true });
    };
  });
  await board.locator(".modal").click({ position: { x: 5, y: 5 } });
  await board.evaluate(() => window.dispatchEvent(new Event("focus")));
  await board.getByText("Yeni sürüm (99.0.0) yükleniyor…").waitFor({ timeout: 10000 });
  await board.waitForFunction(() => window.__sent.some((m) => m.type === "apply-update"), null, { timeout: 6000 });
  // The reload itself (chrome.runtime.reload) can't be exercised here: extensions loaded with
  // --load-extension do not come back after a runtime reload in this Chromium, even without changes.
  // In Chrome, "Load unpacked" extensions reload normally (the same call hot-reload tools use).
  console.log(`✓ self-update: board noticed ${before} → 99.0.0 on disk; waits while a dialog is open, then updates by itself`);
} finally {
  await updating.close();
}

// ---------------------------------------------------------------------------------------------
// Part 4: paylaşım güvenliği (0.37, docs/mockups/2026-10-05-paylasim-guvenligi-v1.png). No sharing server here:
// the shared state a sync would leave (the trip's shareId, the members, the other traveller's change kept as a
// notice) is written straight into storage, and sharing stays unset, so nothing goes to a server.
//  - the notice above the tabs; "Geri al" puts the dates back;
//  - a deleted card waits in Geçmiş → Çöp kutusu and "Geri getir" brings it back on the board;
//  - deleting a shared trip asks first; "Sil" puts it in the trash, "Geri al" brings it back.
// ---------------------------------------------------------------------------------------------
const safety = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-safe-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
await safety.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await safety.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The hero's photo proxy answers "no photo" unless a test routes it: never the live server.
await safety.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(safety);
try {
  const worker = safety.serviceWorkers()[0] ?? (await safety.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await safety.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const when = app.locator(".x-hero .x-s1 b");
  const datesBefore = (await when.innerText()).replace(/\s+/g, " ").trim();

  // Shared with Sabine, and her change of the dates already pulled (the board shows hers, the notice keeps mine).
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const trip = trips.find((t) => t.title === "Portekiz (örnek)");
    const fields = ["title", "confirmedDates", "budget", "priorities", "categoryPriorities", "wantedAmenities", "requirements"];
    const settings = (t) => Object.fromEntries(fields.map((f) => [f, t[f] ?? null]));
    const prev = settings(trip);
    const start = new Date(`${prev.confirmedDates.start}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    const next = { ...prev, confirmedDates: { ...prev.confirmedDates, start: start.toISOString().slice(0, 10) } };
    const shareId = "3f1c2b8e-9a4d-4e7f-8b21-5c6d7e8f9a0b";
    const tx = database.transaction("trips", "readwrite");
    tx.objectStore("trips").put({ ...trip, ...next, shareId, updatedAt: Date.now() });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    const at = new Date(Date.now() - 2 * 60_000).toISOString();
    await chrome.storage.local.set({
      [`shareSync:${trip.id}`]: { shareId, cursor: 0, settingsBase: null, settingsAt: at, members: ["Sabine"], lastSyncAt: Date.now(), error: null },
      [`shareNotices:${trip.id}`]: { notices: [{ id: `${at}|sabine`, author: "Sabine", at, seenAt: Date.now(), prev, next, fields: ["confirmedDates"] }], undone: [] },
    });
  });
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const notice = app.locator(".hs-notice");
  await notice.waitFor();
  assert.match((await notice.innerText()).replace(/\s+/g, " "), /^S Sabine tarihleri değiştirdi: \d+–\d+ Ekim → \d+–\d+ Ekim \d\d:\d\d · senin panona da geldi/);
  assert.notEqual((await when.innerText()).replace(/\s+/g, " ").trim(), datesBefore, "the board shows Sabine's dates");
  // v11: the tabs lead the board; the notice sits under them, above the plan.
  const noticeY = (await notice.boundingBox()).y;
  assert.ok(noticeY > (await app.locator(".view-tabs").boundingBox()).y, "the notice sits under the tabs");
  assert.ok(noticeY < (await app.locator(".cat-plan").boundingBox()).y, "the notice sits above the plan");
  await notice.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/15-share-notice.png` });

  // Layered interface, batch C: who did what. On a face, the person's latest recorded action (here Sabine's change of the
  // dates); the same line in the box a tap opens. Then the Pano tab's dot once she votes, its tip, and opening it clears the dot.
  {
    const tip = app.locator(".tipx-box");
    await app.locator(".view-tabs").evaluate((el) => el.scrollIntoView({ block: "start" }));
    const faces = app.locator(".x-hero .x-s2 .x-face");
    let said = "";
    for (let n = 0; n < (await faces.count()); n++) {
      await app.mouse.move(2, 2);
      await faces.nth(n).hover();
      await app.waitForTimeout(250);
      if (await tip.count()) said += await tip.innerText();
    }
    await app.mouse.move(2, 2);
    assert.match(said, /Sabine[\s\S]*tarihleri değiştirdi[\s\S]*önce/, "a face says what its person did last and when");
    await app.waitForTimeout(250);
    const people = app.locator(".x-hero .x-whob");
    await people.click();
    await app.locator(".hx-who-pop .who-name small.wh-last", { hasText: "tarihleri değiştirdi" }).waitFor();
    await app.keyboard.press("Escape");
    // The Pano's dot: nothing is new yet; Sabine votes now; the dot comes on the tab, the tip lists it, opening the Pano clears it.
    assert.equal(await app.locator(".view-tabs .tab-dot").count(), 0, "nothing new on the first look");
    await app.evaluate(async () => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
      const items = await new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
      const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
      const trip = trips.find((t) => t.title === "Portekiz (örnek)");
      // (the sample's records have no shared key: give one stay its place's key, as a saved page has)
      const stay = items.find((i) => i.tripId === trip.id && i.category === "stay" && i.status !== "dismissed");
      const tx = database.transaction("items", "readwrite");
      tx.objectStore("items").put({ ...stay, key: "booking:pt/e2e-stay" });
      await new Promise((resolve) => (tx.oncomplete = resolve));
      await chrome.storage.local.set({ [`shareVotes:${trip.shareId}`]: [{ itemKey: "booking:pt/e2e-stay", author: "Sabine", vote: 1, note: null, updatedAt: new Date().toISOString() }] });
      new BroadcastChannel("trip-radar").postMessage("changed");
    });
    await app.locator(".view-tabs .tab-dot").waitFor({ timeout: 5000 });
    const panoTab = app.getByRole("tab", { name: "Pano" });
    await panoTab.hover();
    await tip.waitFor({ state: "visible" });
    assert.match(await tip.innerText(), /Son ziyaretten beri 1 şey[\s\S]*Sabine · Oy verdi: 👍/);
    await app.waitForTimeout(350);
    await app.screenshot({ path: `${out}/37j-pano-dot.png` });
    await app.mouse.move(2, 2);
    await panoTab.click();
    // (v82: the Pano is a window over the plan; Escape shuts it)
    await app.getByRole("dialog", { name: "Pano" }).waitFor();
    await app.locator(".view-tabs .tab-dot").waitFor({ state: "detached" });
    await app.keyboard.press("Escape");
    await app.getByRole("dialog", { name: "Pano" }).waitFor({ state: "detached" });
    assert.equal(await app.locator(".view-tabs .tab-dot").count(), 0, "seen: no dot after the Pano was open");
  }

  // A card deleted → Geçmiş shows it → Çöp kutusu → "Geri getir" → it's on the board again.
  // (v82, B8: closed at first look; Etkinlik ve turlar opened)
  const acts = app.locator('.q-sec[data-section="activity"]');
  if (!(await acts.evaluate((el) => el.classList.contains("open")))) await acts.locator(".q-tt").click();
  const douro = app.locator('.z-k[aria-label="Douro tekne turu"]');
  await douro.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douro.locator(".z-kmb").click();
  await app.locator(".z-kpop").getByRole("menuitem", { name: "Sil" }).click();
  await douro.waitFor({ state: "detached" });
  await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
  await app.locator(".x-tm-pop").getByRole("menuitem", { name: "Geçmiş ve çöp kutusu" }).click();
  const history = app.getByRole("dialog", { name: "Geçmiş" });
  const deleted = history.locator(".hs-ev", { hasText: "Douro tekne turu" }).filter({ hasText: "Silindi:" });
  await deleted.waitFor();
  assert.match((await deleted.innerText()).replace(/\s+/g, " "), /Silindi: Douro tekne turu Ben · \d\d:\d\d · Çöp kutusu'nda 30 gün daha Kalıcı sil Geri getir/);
  assert.deepEqual(await history.locator(".hs-seg button").allInnerTexts(), ["Hepsi", "Sabine", "Ben", "Çöp kutusu · 1"]);
  assert.equal(await history.locator(".hs-day").first().innerText(), "BUGÜN");
  await app.screenshot({ path: `${out}/16-history.png` });
  await history.getByRole("tab", { name: "Çöp kutusu · 1" }).click();
  assert.equal(await history.locator(".hs-ev").count(), 1);
  await app.screenshot({ path: `${out}/16b-history-trash.png` });
  await history.locator(".hs-ev", { hasText: "Douro tekne turu" }).getByRole("button", { name: "Geri getir" }).click();
  await history.getByText("Çöp kutusu boş.").waitFor();
  await history.getByRole("button", { name: "Kapat" }).click();
  await history.waitFor({ state: "detached" });
  await douro.waitFor();
  console.log("✓ trash: a deleted card is in Geçmiş → Çöp kutusu, and Geri getir puts it back on the board");

  // The notice's "Geri al": my dates are back, the notice goes.
  await notice.getByRole("button", { name: "Geri al" }).click();
  await notice.waitFor({ state: "detached" });
  await app.waitForFunction((want) => document.querySelector(".x-hero .x-s1 b")?.innerText.replace(/\s+/g, " ").trim() === want, datesBefore, { timeout: 10000 });
  console.log("✓ notice: Sabine's change of the dates shows above the tabs; Geri al puts mine back");

  // Deleting the shared trip asks first (only this computer, 30 days in the trash); Vazgeç keeps it.
  const deleteTrip = async () => {
    await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
    await app.locator(".x-tm-pop").getByRole("menuitem", { name: "Geziyi sil" }).click();
  };
  await deleteTrip();
  const ask = app.getByRole("alertdialog");
  await ask.getByText('"Portekiz (örnek)" silinsin mi?').waitFor();
  const askText = (await ask.innerText()).replace(/\s+/g, " ");
  assert.match(askText, /Sabine ile paylaşılıyor/);
  assert.match(askText, /Yalnız senin bilgisayarından silinir\. Sabine'deki kopya ve ortak kayıtlar sunucuda kalır\./);
  assert.match(askText, /30 gün Çöp kutusu'nda durur, tek tıkla geri gelir\./);
  assert.match(askText, /Paylaşım senin tarafında durur; istersen kodla yeniden katılırsın\./);
  assert.equal(await ask.getByRole("button", { name: "Sil" }).evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(192, 57, 43)", "Sil is red");
  await app.screenshot({ path: `${out}/17-delete-shared.png` });
  await ask.getByRole("button", { name: "Vazgeç" }).click();
  await ask.waitFor({ state: "detached" });
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // Sil: to the overview, the trip in the trash with "Geri al" for a few seconds.
  await deleteTrip();
  await ask.getByRole("button", { name: "Sil" }).click();
  const gone = app.locator(".pk-undo", { hasText: "Portekiz (örnek) silindi" });
  await gone.waitFor();
  assert.equal(await app.locator(".trip-card", { hasText: "Portekiz (örnek)" }).count(), 0);
  await app.screenshot({ path: `${out}/17b-trip-deleted.png` });
  await gone.getByRole("button", { name: "Geri al" }).click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await douro.waitFor();
  console.log("✓ delete: a shared trip asks first (only here, 30 days in the trash); Sil → overview with Geri al, which brings it all back");
} finally {
  await safety.close();
}

// ---------------------------------------------------------------------------------------------
// Part 5: who goes, without sharing (0.37; "Sabine'yi eklemek istiyorum, onunla paylaşmadan"). The hero's people
// open a small box: "Ben (Emre)", "İsim ekle" Sabine + Enter → the hero says "Emre & Sabine · 2 kişi", nothing is
// shared; × takes her off again; Esc closes it.
// ---------------------------------------------------------------------------------------------
const whoGoes = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-who-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
await whoGoes.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await whoGoes.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The hero's photo proxy answers "no photo" unless a test routes it: never the live server.
await whoGoes.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(whoGoes);
try {
  const worker = whoGoes.serviceWorkers()[0] ?? (await whoGoes.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await whoGoes.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  // My profile name (Ayarlar → Profilim): "Ben (Emre)" in the box, "E" on my face in the hero.
  await app.evaluate(() => chrome.storage.local.set({ shareName: "Emre" }));
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // (A · Kapak: the count big by the faces and who under it, the names on the faces and in the box a tap opens)
  const side = app.locator(".x-hero .x-s2");
  const whoText = async () => `${await side.locator(".x-whob").innerText()} · ${await side.locator(".x-sl").innerText()}`.replace(/\s+/g, " ").trim();
  assert.equal(await whoText(), "2 · kişi");
  await side.locator(".x-whob").click();
  const box = side.getByRole("dialog", { name: "Kimler gidiyor?" });
  await box.waitFor();
  assert.deepEqual((await box.locator(".hx-who-list li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()), ["Ben (Emre)"]);
  assert.equal(await box.getByRole("button", { name: /çıkar$/ }).count(), 0, "me: never removable");
  const nameBox = box.getByRole("textbox", { name: "İsim ekle" });
  // My own name typed is just "Ben": not added a second time.
  await nameBox.fill("emre");
  await nameBox.press("Enter");
  await box.getByText('emre sensin: zaten "Ben" olarak sayılıyorsun.').waitFor();
  assert.equal(await box.locator(".hx-who-list li").count(), 1);
  await nameBox.fill("Sabine");
  await nameBox.press("Enter");
  await box.locator(".hx-who-list li", { hasText: "Sabine" }).waitFor();
  await app.waitForFunction(() => [...document.querySelectorAll(".x-hero .x-s2 .x-face")].map((e) => e.textContent.trim()).join(",") === "E,S", null, { timeout: 10000 });
  assert.equal(await whoText(), "2 · Sen ve Sabine");
  assert.deepEqual(await side.locator(".x-face").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), ["Emre · Kimler gidiyor", "Sabine · Kimler gidiyor"]);
  assert.equal(await nameBox.inputValue(), "", "the box is ready for the next name");
  // 0.37: a photo for Sabine, from her line in the box: kept on this computer, shown in the hero's circles.
  const sabinePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAM0lEQVR4nG3CoREAIQADwSssRbxGo9Gv0WhqurJoIDuLX2ocqXGmxpUa/9S4U+NJjTf1A3y1XcEwJbHpAAAAAElFTkSuQmCC", "base64");
  await box.locator(".hx-who-list li", { hasText: "Sabine" }).locator('input[type="file"]').setInputFiles({ name: "sabine.png", mimeType: "image/png", buffer: sabinePng });
  await box.locator(".hx-who-list li", { hasText: "Sabine" }).locator(".who-av img").waitFor();
  await side.locator(".x-face img").first().waitFor();
  assert.match(await side.locator(".x-face img").first().getAttribute("src"), /^data:image\/jpeg;base64,/);
  assert.equal(await side.locator(".x-face img").count(), 1, "only Sabine's circle has a photo");
  await app.screenshot({ path: `${out}/18a-traveller-photo.png` });
  await box.getByRole("button", { name: "Sabine: fotoğrafı kaldır" }).click();
  await side.locator(".x-face img").waitFor({ state: "detached" });
  assert.equal(await side.locator(".x-shline").count(), 0, "naming someone shares nothing");
  assert.equal(await box.getByRole("button", { name: "Birini davet et (paylaş)" }).count(), 0, "the sample can't be shared");
  const stored = await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const trips = await new Promise((resolve) => (database.transaction("trips").objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
    const trip = trips.find((t) => t.title === "Portekiz (örnek)");
    return { shareId: trip.shareId ?? null, travellers: trip.travellers };
  });
  assert.deepEqual(stored, { shareId: null, travellers: { names: ["Sabine"] } });
  await app.screenshot({ path: `${out}/18-travellers.png` });
  // × takes her off; the hero is back to the saves' two.
  await box.getByRole("button", { name: "Sabine çıkar" }).click();
  await app.waitForFunction(() => [...document.querySelectorAll(".x-hero .x-s2 .x-face")].map((e) => e.textContent.trim()).join(",") === ",", null, { timeout: 10000 });
  assert.equal(await whoText(), "2 · kişi");
  assert.deepEqual((await box.locator(".hx-who-list li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()), ["Ben (Emre)"]);
  await app.screenshot({ path: `${out}/18b-travellers-removed.png` });
  await app.keyboard.press("Escape");
  await box.waitFor({ state: "detached" });
  assert.ok(await side.locator(".x-whob").evaluate((el) => el === document.activeElement), "Esc gives the focus back to the people");
  // Geçmiş (the trip isn't shared): "Gidenler: Sabine çıkarıldı" has its own Geri al; Sabine comes back, the line
  // says "geri alındı".
  await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
  await app.locator(".x-tm-pop").getByRole("menuitem", { name: "Geçmiş ve çöp kutusu" }).click();
  const history = app.getByRole("dialog", { name: "Geçmiş" });
  const removedLine = history.locator(".hs-ev", { hasText: "Gidenler: Sabine çıkarıldı" });
  await removedLine.getByRole("button", { name: "Geri al" }).click();
  await removedLine.locator(".hs-tag", { hasText: "geri alındı" }).waitFor();
  await app.screenshot({ path: `${out}/18c-travellers-history-undo.png` });
  await history.getByRole("button", { name: "Kapat" }).click();
  await history.waitFor({ state: "detached" });
  await app.waitForFunction(() => [...document.querySelectorAll(".x-hero .x-s2 .x-face")].map((e) => e.textContent.trim()).join(",") === "E,S", null, { timeout: 10000 });
  console.log("✓ travellers: the hero's people box names Sabine without sharing (E · S, 2 kişi), × takes her off, Esc closes it; Geçmiş's Geri al brings her back");
} finally {
  await whoGoes.close();
}

// ---------------------------------------------------------------------------------------------
// Part 6: a flight's real data on its day (0.36.15/0.36.18), in its own browser with the calendar on the flight's
// day (14 October): changing the clock of a page the other parts go on with left its "today" behind.
const flightDay = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-live-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 sa" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
await flightDay.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
// Web search is off unless a test routes it (the start chat looks up an event's dates): never the live server, and
// "not-configured" is never cached (a "no-result" would be, and answer a later test's search for the same event).
await flightDay.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
// The hero's photo proxy answers "no photo" unless a test routes it: never the live server.
await flightDay.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
// The sample trip starts three days after the day it's loaded (demo.ts): loaded on 5 October it's as written
// (8–14 October), then the calendar moves on to the flight's day.
await flightDay.clock.install({ time: new Date("2026-10-05T10:00:00") });
try {
  const worker = flightDay.serviceWorkers()[0] ?? (await flightDay.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await flightDay.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await flightDay.clock.setSystemTime(new Date("2026-10-14T12:00:00"));
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  const tab = (name) => app.getByRole("tab", { name, exact: true });
  // v83 "gezi sırasında" (D8, row 126): the hero's place holds the Bugün strip (the date, the day's lines by the hour, the
  // flight home's row), and the Plan opens in trip order, today's chapter (the way home) saying "Bugün", the ones behind folded.
  const today = app.locator(".x-hero .x-today");
  await today.waitFor();
  assert.match(flat([await today.locator(".xt-d small").innerText()])[0], /^14 Ekim Çarşamba · Lizbon · eve dönüş$/);
  assert.equal(await app.locator(".x-hero .x-mos, .x-hero .x-strip").count(), 0, "no mosaic, no strip: the day stands in for them");
  const tpRow = today.locator(".xt-r", { hasText: "TP1760" });
  assert.equal(flat([await tpRow.locator("time").innerText()])[0], "19:40");
  assert.equal(await tab("Yolculuk sırasıyla").getAttribute("aria-selected"), "true", "on the trip the Plan opens in trip order");
  await app.locator(".q-trip .q-chap.now .q-chap-now", { hasText: "Bugün" }).waitFor();
  assert.match(flat([await app.locator(".q-trip .q-chap.now .q-chap-h b").innerText()])[0], /^Lizbon → İstanbul$/);
  await app.locator(".q-trip .q-past .q-pastb[aria-expanded=false]").waitFor();
  await app.screenshot({ path: `${out}/3e-today-strip.png` });
  await tab("Gün gün").click();
  const dayCard = (n) => app.locator(".dg-day", { has: app.locator(".dg-no", { hasText: new RegExp(`^Gün ${n}$`) }) });
  // 0.36.15/0.36.18: a flight's real data (as the server would give it) on its day: late in red, its gate, the
  // source, in the day view's line and as boxes on the Plan's card.
  await app.evaluate(async () => {
    const end = (iata, t) => ({ iata, airport: null, scheduled: t, revised: null, actual: null, terminal: null, gate: null });
    const flight = {
      number: "TP1760", airline: "TAP", status: "Delayed",
      departure: { ...end("LIS", "2026-10-14T19:40"), revised: "2026-10-14T20:05", terminal: "1", gate: "14" },
      arrival: { ...end("IST", "2026-10-15T01:35"), belt: null },
      fetchedAt: "t",
    };
    await chrome.storage.local.set({ flightLive: { "TP1760|2026-10-14": { flight, at: Date.now() } } });
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const live = dayCard(7).locator(".dg-live.alert");
  await live.waitFor();
  assert.equal(await live.innerText(), "Yeni kalkış 20:05 (+25 dk) · Kapı 14 · Veri: AeroDataBox");
  // C4 on the Bugün strip: the day's flight as its data says it (the new time, the gate), and the plan moved with it.
  const strip = today.locator(".xt-live.alert");
  await strip.waitFor();
  assert.deepEqual(flat(await strip.locator(".xt-tile").allInnerTexts()), ["Yeni kalkış 20:05 +25 dk", "Kapı 14"]);
  assert.match(flat([await strip.locator(".xt-shift").innerText()])[0], /^Planı yeni saate göre kaydırdım/);
  assert.match(flat([await today.locator(".xt-r", { hasText: "TP1760" }).locator(".xt-m small").innerText()])[0], /Rötar \+25 dk · Kapı 14/);
  await live.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-flight-live.png` });
  await tab("Plan").click();
  // (v82, B8: closed at first look; the flights opened)
  const flights = app.locator('.q-sec[data-section="flight"]');
  if (!(await flights.evaluate((el) => el.classList.contains("open")))) await flights.locator(".q-tt").click();
  // v82 (C4, row 95): on its day the ticket's chip line is the live strip ("Canlı" late in amber, the gate, the delay, the
  // terminal, the source named), the route at the new time, the side column's new times and "Planı yeni saate kaydırdım.";
  // F2: hours before it leaves, the main button is the online check-in (the PNR above it). Late, the box is as tall as ever.
  const tpBox = flights.locator(".q-ints > .q-int", { has: app.locator(".q-nm", { hasText: "Lizbon" }) });
  const boxStrip = tpBox.locator(".z-live");
  await boxStrip.waitFor();
  assert.deepEqual(flat(await boxStrip.locator(":scope > span").allInnerTexts()), ["Canlı", "Kapı 14", "Rötar +25 dk", "LIS T1"]);
  assert.ok(await boxStrip.locator(".z-ldot.late").count(), "late: the live dot is amber");
  assert.match(await boxStrip.locator(".z-lsrc").innerText(), /AeroDataBox/);
  // H4: nothing in the strip is cut ("Yeni kal…", "+25 dk"): every part holds its words.
  assert.deepEqual(await boxStrip.locator(":scope > span").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent)), [], "H4: the live strip cuts nothing");
  assert.match(flat([await tpBox.locator(".z-car").innerText()])[0], /TAP TP 1760/);
  assert.match(flat([await tpBox.locator(".z-route").innerText()])[0], /^Lizbon LIS · 20:05 /, "the plan moved to the new time");
  assert.equal(flat([await tpBox.locator(".z-shift").innerText()])[0], "Yeni kalkış 20:05. Planı yeni saate kaydırdım.");
  assert.equal(new URL(await tpBox.locator(".z-bt .q-ckin").getAttribute("href")).searchParams.get("q"), "TAP online check-in", "F2: the check-in is the main button");
  assert.equal(Math.round((await tpBox.boundingBox()).height), 288, "late: the box is 288 px");
  await tpBox.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-flight-card-live.png` });
  // The stage AeroDataBox names ("Biniş başladı"), only while the answer is fresh and only when the data says so: nothing above (status Delayed).
  assert.equal(await tpBox.locator(".z-lst").count(), 0, "no stage without the data");
  await app.evaluate(async () => {
    const stored = (await chrome.storage.local.get("flightLive")).flightLive;
    const e = stored["TP1760|2026-10-14"];
    e.flight = { ...e.flight, status: "Boarding", fetchedAt: new Date().toISOString() };
    await chrome.storage.local.set({ flightLive: stored });
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const stage = tpBox.locator(".z-car .z-lst");
  await stage.waitFor();
  assert.equal(await stage.innerText(), "Biniş başladı");
  assert.equal(Math.round((await tpBox.boundingBox()).height), 288, "boarding: the box is 288 px");
  console.log("✓ flight on its day: the Bugün strip in the hero's place and the Plan in trip order from today (D8); late with its new time and gate, in the day's line, on the strip and on the Plan's ticket (the live strip, Biniş başladı, the check-in, 288 px), the source named");
} finally {
  await flightDay.close();
}

// ---------------------------------------------------------------------------------------------
// Part 6c (v82 D): "Yolculuk sırasıyla" (v81-v83, rows 124-125), the chat's cards and quick replies (C34, row 140), a link
// the chat couldn't read (C35), the drawer under 860 px (A7, row 38) and a trip with no dates (D15, row 32), in its own
// browser on a fresh sample trip (8-14 October, loaded on the 5th).
const journeyCtx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-journey-")), {
  executablePath,
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
await journeyCtx.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
await journeyCtx.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
await journeyCtx.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(journeyCtx);
try {
  const worker = journeyCtx.serviceWorkers()[0] ?? (await journeyCtx.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await journeyCtx.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  const statusOf = (name) => app.evaluate(async (n) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = await new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    return all.find((i) => i.name === n)?.status ?? null;
  }, name);
  const flashed = () => app.locator(".panel .flash").first().waitFor({ state: "attached", timeout: 5000 });

  // Rows 124-125: the chapters in the order the trip is lived; a city with its photo's place, its days and "n hazır · n karar".
  await app.getByRole("tab", { name: "Yolculuk sırasıyla", exact: true }).click();
  const journey = app.locator(".panel .q-trip");
  await journey.waitFor();
  assert.deepEqual(flat(await journey.locator(".q-chap-h b").allInnerTexts()), ["Yola çıkmadan", "İstanbul → Porto", "Porto", "Lizbon", "Lizbon → İstanbul"]);
  const porto = journey.locator(".q-chap", { has: app.locator(".q-chap-h b", { hasText: /^Porto$/ }) });
  assert.match(flat([await porto.locator(".q-chap-h small").innerText()])[0], /^8–11 Ekim · 3 gece$/);
  assert.equal(await porto.locator(".q-chap-img").count(), 1, "a city's chapter has its picture's place (the hero's photo, a quiet tile without one)");
  assert.equal(await journey.locator(".q-chap-now").count(), 0, "before the trip no chapter is today's");
  // Each step: its day, its state's dot, "kind · state", its name and one button; "Uçakta" for the night on the plane (D14).
  const stayStep = porto.locator(".q-step", { has: app.locator(".q-sm b", { hasText: "Jardim Stay" }) });
  assert.equal(await stayStep.getAttribute("data-st"), "ai");
  assert.match(flat([await stayStep.locator(".q-skind").innerText()])[0], /^Konaklama · Önerimiz, onayla$/);
  assert.equal(flat([await stayStep.locator(".q-sdate").innerText()])[0], "8 Eki");
  await journey.locator(".q-step[data-st=night]", { hasText: "Uçakta" }).waitFor();
  await porto.locator(".q-scard.idea", { hasText: "Porto için 3 etkinlik önerisi" }).getByRole("button", { name: /Önerilere bak/ }).waitFor();
  await app.screenshot({ path: `${out}/6c-journey.png` });
  // A choice made here is the Plan's at once: "Bunu seç" takes our pick; the step says Seçildi and offers the booking.
  await stayStep.getByRole("button", { name: "Bunu seç" }).click();
  await porto.locator('.q-step[data-st="sel"]', { has: app.locator(".q-sm b", { hasText: "Jardim Stay" }) }).waitFor();
  await porto.locator(".q-step", { hasText: "Jardim Stay" }).locator("a.q-cta", { hasText: "Rezerve et" }).waitFor();
  assert.equal(await statusOf("Jardim Stay"), "chosen", "chosen in the Plan too");
  // "›" goes to the step's box on the Plan by category, with a flash.
  await porto.locator(".q-step", { hasText: "Douro tekne turu" }).getByRole("button", { name: "Douro tekne turu: planda göster" }).click();
  await app.getByRole("tab", { name: "Kategoriye göre", exact: true, selected: true }).waitFor();
  await flashed();

  // C34: a turn that touched a record carries its card under the reply; at most three quick replies over the box.
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = (store) => new Promise((resolve) => (database.transaction(store).objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result)));
    const put = (store, v) => new Promise((resolve) => { const tx = database.transaction(store, "readwrite"); tx.objectStore(store).put(v); tx.oncomplete = resolve; });
    const trip = (await all("trips"))[0];
    const stay = (await all("items")).find((i) => i.tripId === trip.id && i.name === "Casa Azul");
    const t = Date.now() + 1000;
    const msg = (id, role, text, at) => ({ id, tripId: trip.id, role, content: [{ type: "text", text }], text, choices: [], createdAt: at });
    await put("messages", msg("e2e-d-u", "user", "Porto için daha sakin bir yer?", t));
    await put("items", { ...stay, statusAt: t + 1, updatedAt: t + 1 });
    await put("messages", msg("e2e-d-a", "assistant", "Casa Azul daha sakin: arka sokakta ve gecesi daha ucuz.", t + 2));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const card = app.locator(".chat .msg-assistant", { hasText: "Casa Azul daha sakin" }).locator(".c-card");
  await card.waitFor();
  assert.match(flat([await card.innerText()])[0], /Airbnb.*Casa Azul.*€\d+.*\/ gece.*Planda göster.*Bunu seç/);
  const quick = app.locator(".chat .c-quick .c-q");
  assert.ok((await quick.count()) >= 1 && (await quick.count()) <= 3, `one to three quick replies (${await quick.count()})`);
  assert.equal(await app.locator(".chat .c-quick").evaluate((el) => el.nextElementSibling?.classList.contains("composer")), true, "the quick replies sit over the box");
  await app.locator(".chat").screenshot({ path: `${out}/6c-chat-card.png` });
  // "Planda göster": the box comes into view and flashes; "Bunu seç" takes it there, the card says Seçildi.
  await card.getByRole("button", { name: "Casa Azul: planda göster" }).click();
  await flashed();
  await card.getByRole("button", { name: "Casa Azul: Bunu seç" }).click();
  await card.locator(".c-done", { hasText: "Seçildi" }).waitFor();
  assert.equal(await statusOf("Casa Azul"), "chosen");
  assert.equal(await statusOf("Jardim Stay"), "saved", "one stay for the nights: the one chosen before goes back to the options");
  // A quick reply goes the way a typed line goes (no key here: the chat says it couldn't reach the assistant).
  const asked = flat([await quick.first().innerText()])[0];
  await quick.first().click();
  await app.locator(".chat .chat-banner", { hasText: "Asistana bağlanamadım" }).waitFor({ timeout: 8000 });
  assert.ok(asked.length > 0);

  // C35: a link sent in the chat that couldn't be read is a dashed card: Okunamadı, why, Tekrar dene, Kaldır.
  await app.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("https://www.klook.com/activity/91234-e2e-unread/");
  await app.getByRole("button", { name: "Gönder" }).click();
  const unread = app.locator(".chat .ar-sent", { hasText: "e2e-unread" }).locator(".c-link.failed");
  await unread.waitFor({ timeout: 25000 });
  assert.match(flat([await unread.innerText()])[0], /^Okunamadı klook\.com\/activity\/\d*… .+ Tekrar dene Kaldır$/);
  await unread.getByRole("button", { name: "Tekrar dene" }).waitFor();
  await app.locator(".chat").screenshot({ path: `${out}/6c-chat-unread.png` });
  await unread.getByRole("button", { name: "Kaldır" }).click();
  await unread.waitFor({ state: "detached" });
  await app.locator(".chat .ar-sent", { hasText: "e2e-unread" }).locator(".ar-chip-text", { hasText: "Kaldırıldı" }).waitFor();

  // A7 (row 38): at 820 px the plan comes first, its hero in the first screen; the chat is a drawer shut at the bottom.
  await app.setViewportSize({ width: 820, height: 900 });
  await app.evaluate(() => window.scrollTo(0, 0));
  const handle = app.locator(".chat .c-handle");
  assert.equal(await handle.getAttribute("aria-expanded"), "false");
  assert.match(flat([await handle.innerText()])[0], /^Asistan \S/, "the handle: Asistan and the last thing said");
  assert.ok((await app.locator(".x-hero").boundingBox()).y < 900, "the hero is in the first screen");
  assert.equal(await app.locator(".chat .messages").isVisible(), false, "shut: no conversation, only the handle and the box");
  await app.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").waitFor();
  const sheetHeight = () => app.locator(".chat .c-sheet").evaluate((el) => Math.round(el.getBoundingClientRect().height));
  assert.ok((await sheetHeight()) < 180, `shut, it is a strip (${await sheetHeight()} px)`);
  await app.screenshot({ path: `${out}/6c-drawer-shut.png` });
  await handle.click();
  assert.equal(await handle.getAttribute("aria-expanded"), "true");
  await app.waitForFunction(() => Math.abs(document.querySelector(".chat .c-sheet").getBoundingClientRect().height - innerHeight * 0.82) < 3);
  await app.locator(".chat .messages .c-card").first().waitFor();
  // "← Seyahatlerim" stays on top while it's open.
  const back = await app.locator(".trip-switch").boundingBox();
  const sheetTop = await app.locator(".chat .c-sheet").evaluate((el) => el.getBoundingClientRect().top);
  assert.ok(back && back.y >= 0 && back.y + back.height <= sheetTop, "Seyahatlerim above the open drawer");
  await app.screenshot({ path: `${out}/6c-drawer-open.png` });
  // Escape shuts it, the focus back on the handle.
  await app.keyboard.press("Escape");
  assert.equal(await handle.getAttribute("aria-expanded"), "false");
  assert.equal(await app.evaluate(() => document.activeElement?.classList.contains("c-handle")), true, "the focus goes back to the handle");
  // "Planda göster" from the drawer shuts it and goes to the box.
  await handle.click();
  await app.locator(".chat .messages .c-card .c-go").first().click();
  assert.equal(await handle.getAttribute("aria-expanded"), "false", "Planda göster shuts the drawer");
  await flashed();
  await app.setViewportSize({ width: 1440, height: 900 });

  // D15 (row 32): a trip with no dates has no trip order: the switch shows it faded, says why, and isn't pressed.
  await app.evaluate(async () => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction("trips", "readwrite");
    tx.objectStore("trips").put({ id: "e2e-nodates", title: "Yazın bir ara", confirmedDates: null, budget: null, heroImage: null, createdAt: Date.now(), updatedAt: Date.now() });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  await app.locator(".trip-switch").click();
  await app.locator(".trip-card", { hasText: "Yazın bir ara" }).click();
  await app.getByRole("heading", { name: "Yazın bir ara" }).waitFor();
  const shut = app.getByRole("tab", { name: /^Yolculuk sırasıyla/ });
  assert.equal(await shut.getAttribute("aria-disabled"), "true");
  assert.equal(await shut.getAttribute("title"), "Tarihler belli olunca açılır");
  await shut.click({ force: true });
  assert.equal(await app.getByRole("tab", { name: "Kategoriye göre", exact: true }).getAttribute("aria-selected"), "true", "not pressed");
  assert.equal(await app.locator(".panel .q-trip").count(), 0);
  console.log("✓ v82 D: Yolculuk sırasıyla in chapters (Bunu seç is the Plan's choice, › goes to the box); the chat's card (Planda göster, Bunu seç → Seçildi), quick replies, an unread link's card (Kaldır); the drawer at 820 px (Escape, focus, Planda göster shuts it); no dates, no trip order");
} finally {
  await journeyCtx.close();
}

// ---------------------------------------------------------------------------------------------
// Part 6b (F7): the draft "Önerimiz", in its own browser on a fresh sample trip. A flight or a stay with a real priced option saved shows its
// best one as the card; it writes nothing and is no choice (the Board says "Önerimiz · kartta", never "Planda"; the hero's % waits); it is taken with
// "✓ Bunu seç" or "Rezerve et ↗" (S1: choosing first, then the page), and goes with its need ("Gerek yok").
const draftCtx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-draft-")), {
  executablePath,
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
await draftCtx.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
await draftCtx.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
await draftCtx.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await draftCtx.clock.install({ time: new Date("2026-10-05T10:00:00") });
try {
  const worker = draftCtx.serviceWorkers()[0] ?? (await draftCtx.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await draftCtx.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  // The hero's sentence (B9): "Omurganın %X'i planda (N ihtiyaçtan P'si), %Y'si alındı (A). K karar bekliyor."
  const heroNow = async () => {
    const label = await app.locator(".x-hero .x-bar").getAttribute("aria-label");
    const m = label.match(/^Omurganın %(\d+)'\S* planda \((\d+) ihtiyaçtan (\d+)'\S*\), %\d+'\S* alındı \((\d+)\)\. (?:(\d+) karar bekliyor|Karar bekleyen yok)\.$/);
    assert.ok(m, label);
    return { pct: +m[1], total: +m[2], planned: +m[3], booked: +m[4], open: +(m[5] ?? 0) };
  };
  // v82: one category open at a time (B8).
  const openCat = async (id) => {
    const sec = app.locator(`.q-sec[data-section="${id}"]`);
    if (!(await sec.evaluate((el) => el.classList.contains("open")))) await sec.locator(".q-tt").click();
    await sec.locator(".q-fold.settled").waitFor();
  };
  const stayDraft = app.locator('.q-sec[data-section="stay"] .q-ints > .q-int[data-st="ai"]', { has: app.locator(".z-t", { hasText: "Jardim Stay" }) });
  const flightDraft = app.locator('.q-sec[data-section="flight"] .q-ints > .q-int[data-st="ai"]', { has: app.locator(".z-car", { hasText: "Pegasus" }) });
  await openCat("flight");
  await flightDraft.waitFor();
  await openCat("stay");
  await stayDraft.waitFor();
  // A draft is not on the plan (B9): the hero says 9 needs, 3 planned (2 booked), 6 to decide; v82: the category's row
  // counts it as one to decide (our pick is on the plan once it's said yes to).
  const before = await heroNow();
  assert.deepEqual([before.total, before.planned, before.booked, before.open], [9, 3, 2, 6]);
  assert.equal(flat([await app.locator('.q-sec[data-section="stay"] .q-pl1').innerText()])[0], "1 alındı · 1 karar");
  // The Board (v82: the Pano window): our pick wears "✨ Önerimiz" and still says "Seç": it is not on the plan (no "Seçili", no green),
  // its intent's dot is our pick's (purple); on the plan are the two bookings and the activity only. ("Plan'da gör" and the state
  // filter are C32: not in this version, bu sürümde arayüzden düştü.)
  await app.getByRole("tab", { name: "Pano", exact: true }).click();
  const draftPano = app.getByRole("dialog", { name: "Pano" });
  const panoFlight = draftPano.locator('.q-pg[aria-label="Pegasus · direkt"]');
  await panoFlight.waitFor();
  assert.match(await panoFlight.locator(".q-src.best").innerText(), /Önerimiz/);
  assert.equal(await panoFlight.locator("button.q-pick").innerText(), "Seç");
  assert.equal(await panoFlight.evaluate((el) => el.classList.contains("cur")), false, "not 'Seçili'");
  assert.equal(await panoFlight.locator(".q-stc").count(), 0);
  const panoStay = draftPano.locator('.q-pg[aria-label="Jardim Stay"]');
  assert.match(await panoStay.locator(".q-src.best").innerText(), /Önerimiz/);
  assert.equal(await panoStay.locator(".q-stc").count(), 0);
  assert.ok((await draftPano.locator(".q-si .q-sd.ai").count()) >= 2, "the drafts' intents wear our pick's dot");
  const onPlan = await draftPano.locator(".q-pg.cur").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  assert.equal(onPlan.length, 3, `the draft is not counted as on the plan (${onPlan})`);
  await app.screenshot({ path: `${out}/40c-draft-pano.png` });
  await app.keyboard.press("Escape");
  await draftPano.waitFor({ state: "detached" });
  await openCat("stay");
  // v82 (B11, in place of S1): the site's link on our pick only opens its page (here the navigation is held back): still Önerimiz.
  await stayDraft.locator(".q-srcl").evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await stayDraft.locator(".q-srcl").click();
  await app.waitForTimeout(400);
  assert.equal(await stayDraft.count(), 1, "the site's link is no choice");
  const still = await heroNow();
  assert.deepEqual([still.total, still.planned, still.booked, still.open], [before.total, before.planned, before.booked, before.open], "the hero didn't move");
  // "Bunu seç" chooses: the box is Seçildi, "Rezerve et ↗" and "✓ Aldım" on it.
  await stayDraft.locator(".q-take", { hasText: "Bunu seç" }).click();
  const stayChosen = app.locator('.q-sec[data-section="stay"] .q-ints > .q-int[data-st="sel"]', { has: app.locator(".z-t", { hasText: "Jardim Stay" }) });
  await stayChosen.locator(".q-got", { hasText: "Aldım" }).waitFor();
  assert.equal(await app.locator('.q-sec[data-section="stay"] .q-int[data-st="ai"]').count(), 0, "chosen: the draft is gone");
  const chosen = await heroNow();
  assert.deepEqual([chosen.total, chosen.planned, chosen.booked, chosen.open], [9, 4, 2, 5], "the hero moved only with the choice");
  assert.ok(chosen.pct > before.pct);
  // The flight's draft goes with its need: "Gerek yok" in its ⋯ is the need's, and nothing is left of our pick.
  await openCat("flight");
  await flightDraft.locator(".z-h .z-mb").click();
  await flightDraft.getByRole("menuitem", { name: "Gerek yok" }).click();
  await flightDraft.waitFor({ state: "detached" });
  assert.equal(await app.locator('.q-sec[data-section="flight"] .q-ints > .q-int[data-st="ai"]').count(), 0, "a need set aside has no draft");
  console.log("✓ draft: the best real option is the card (\"Önerimiz\"), no choice (hero, Pano \"✨ Önerimiz\", Seç); \"✓ Bunu seç\" chooses, the site's link only opens it (B11); it goes with its need");
} finally {
  await draftCtx.close();
}

// ---------------------------------------------------------------------------------------------
// Part 5: the motion dictionary (src/app/motion.ts, drawing ux-katmanli-arayuz "Altı hareketlik sözlük"), with motion on.
// Each movement has its own meaning and none moves the layout:
//  - yükselme: a card lifts 3 px on hover; nabız: an empty card's ring pulses;
//  - mühür + parlama: a card that turns booked pops its tick and glows; düşüş: a card the chat added drops in;
//  - sayaç: the budget's figure counts to its new value.
// ---------------------------------------------------------------------------------------------
const motion = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-motion-")), {
  executablePath,
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  locale: "tr-TR",
  reducedMotion: "no-preference",
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
await motion.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
await motion.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
await motion.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
await frozen(motion);
try {
  const worker = motion.serviceWorkers()[0] ?? (await motion.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await motion.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await app.locator(".cat-plan").waitFor();
  // (the page's policy allows no eval: the writes are named here and done inside one function)
  const idb = (mode, arg) =>
    app.evaluate(
      async ([m, a]) => {
        const request = indexedDB.open("trip-radar");
        const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
        const tx = database.transaction(["trips", "items"], "readwrite");
        const trips = await new Promise((resolve) => (tx.objectStore("trips").getAll().onsuccess = (e) => resolve(e.target.result)));
        const all = await new Promise((resolve) => (tx.objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
        const trip = trips.find((t) => t.title === "Portekiz (örnek)");
        const items = all.filter((i) => i.tripId === trip.id);
        const now = Date.now();
        if (m === "book") {
          const it = items.find((i) => i.id === a);
          tx.objectStore("items").put({ ...it, status: "booked", statusAt: now, updatedAt: now });
        } else if (m === "status") {
          const it = items.find((i) => i.name === a[0]);
          tx.objectStore("items").put({ ...it, status: a[1], statusAt: now, updatedAt: now });
        } else if (m === "dearer") {
          const it = items.find((i) => i.name === a);
          tx.objectStore("items").put({ ...it, price: { ...it.price, amount: (it.price.amount ?? 0) + 600 }, updatedAt: now });
        } else if (m === "chatEsim") {
          tx.objectStore("items").put({
            id: "e2e-motion-esim", tripId: trip.id, captureIds: [], key: null, category: "esim", needKey: "esim", name: "Hareket eSIM", provider: null, summary: "", optionDetail: null, url: null,
            imageUrl: null, city: null, country: null, countryCode: null, location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "unverified" },
            guests: { adults: null, children: null, rooms: null }, price: { amount: 12, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "none", observedAt: now }, priceHistory: [],
            cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null, geo: null, highlights: [], concerns: [],
            reviewSummary: null, missing: [], status: "chosen", statusNote: null, createdAt: now, updatedAt: now, origin: "chat", plannedKind: "esim", booking: "needed",
          });
        }
        await new Promise((resolve) => (tx.oncomplete = resolve));
        new BroadcastChannel("trip-radar").postMessage("changed");
      },
      [mode, arg],
    );
  const animating = (loc, name) => loc.evaluate((el, n) => el.getAnimations().some((a) => a.animationName === n), name);
  // v82 (B8): one category open at a time.
  const openCat = async (id) => {
    const sec = app.locator(`.q-sec[data-section="${id}"]`);
    if (!(await sec.evaluate((el) => el.classList.contains("open")))) await sec.locator(".q-tt").click();
    await sec.locator(".q-fold.settled").waitFor();
  };

  // rt-fly (D9): a flight's plane glided to its route when the ticket was first drawn (.9 s, from 18 px left); it is on the
  // sample's flights (v82: read while the flights are open the first time; drawn again they don't fly again).
  await openCat("flight");
  const glide = await app.locator('.q-sec[data-section="flight"] .z-tk .q-mid.big img.z-fly').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.animationName, cs.animationDuration, cs.animationTimingFunction, el.getAnimations()[0]?.effect.getKeyframes()[0].marginLeft];
  });
  assert.deepEqual(glide, ["pk-fly", "0.9s", "cubic-bezier(0.16, 1, 0.3, 1)", "-18px"], "rt-fly: the plane glides to its route on the first draw");

  // yükselme (v82, E §425): an option lifts 3 px while pointed at (the flight Önerimiz's options, Değiştir); the intent box
  // itself stays where it is, and the page's layout (the row's place in the flow) stays.
  const porto = app.locator('.q-sec[data-section="flight"] .q-ints > .q-int', { has: app.locator(".q-nm", { hasText: "Porto" }) }).first();
  await porto.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await porto.locator(".z-bt .q-chg").click();
  const flight = porto.locator(".q-row.z-r:not(.is-cur)").first();
  await flight.waitFor();
  await app.waitForTimeout(500); // (the rows set in, 60 ms apart)
  await app.mouse.move(2, 2);
  const at0 = await flight.evaluate((el) => getComputedStyle(el).transform);
  await flight.hover({ position: { x: 60, y: 20 } });
  // (the lift takes 180 ms; a busy machine may take longer to show it: wait for it)
  await app.waitForFunction((el) => getComputedStyle(el).transform === "matrix(1, 0, 0, 1, 0, -3)", await flight.elementHandle(), { timeout: 4000 });
  assert.equal(await flight.evaluate((el) => getComputedStyle(el).transform), "matrix(1, 0, 0, 1, 0, -3)", "yükselme: the option lifts 3 px on hover");
  assert.equal(at0, "none");
  assert.equal(await porto.evaluate((el) => getComputedStyle(el).transform), "none", "yükselme: the intent box doesn't");
  await app.mouse.move(2, 2);
  await porto.getByRole("button", { name: "Vazgeç" }).click();
  await porto.locator(".z-tk").waitFor();

  // nabız: slowly, forever (box-shadow only: nothing moves). v82 (E §377): only while the AI really looks for an intent: the
  // policy still to find, "AI'dan öner" pressed, pulses while it looks; an intent merely still to find doesn't.
  await openCat("other");
  const askedKey = await app.locator('.q-ints > .q-int[data-st="todo"]', { has: app.locator(".q-ai") }).first().getAttribute("data-intent");
  const asked = app.locator(`.q-ints > .q-int[data-intent="${askedKey}"]`);
  assert.equal(await asked.locator(".z-pulse").count(), 0, "nothing pulses before the AI looks");
  await asked.locator(".q-ai").click();
  const ring = asked.locator(".z-pulse");
  await ring.waitFor();
  assert.equal(await ring.evaluate((el) => getComputedStyle(el).animationName), "pk-pulse", "nabız: the box the AI looks for pulses");
  assert.equal(await ring.evaluate((el) => getComputedStyle(el).animationDuration), "2.4s", "m-nabiz: slowly, 2.4 s a breath (the drawing's)");

  // düşüş: a card the chat just made drops in (an old one, from before, never does).
  // düşüş, v82: the box the chat just made comes in with the arrival's ring and "Yeni" (arrive/useArrivals); an old one never does.
  await openCat("other");
  await app.evaluate(() => {
    window.__came = { box: false, others: false };
    new MutationObserver(() => {
      const box = document.querySelector('.q-int[data-item-id="e2e-motion-esim"]');
      if (box?.classList.contains("ar-new")) window.__came.box = true;
      if (document.querySelector('.q-int.ar-new:not([data-item-id="e2e-motion-esim"])')) window.__came.others = true;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
  });
  await idb("chatEsim");
  const esim = app.locator('.q-ints > .q-int[data-item-id="e2e-motion-esim"]');
  await esim.waitFor({ timeout: 5000 });
  await app.waitForFunction(() => window.__came.box, null, { timeout: 5000 });
  assert.equal(await esim.evaluate((el) => getComputedStyle(el, "::after").content), '"Yeni"', "the box that came says Yeni while it rings");
  assert.equal(await app.evaluate(() => window.__came.others), false, "an old box doesn't");

  // mühür + parlama (v82: K29, E3): the chosen eSIM becomes booked: its chip springs once and its new frame comes in (the old one
  // fades in 120 ms, the new one 260 ms), each for a moment, then both are still. (Recorded as it happens: a busy machine looks late.)
  await app.evaluate(() => {
    window.__moment = { booked: false, pop: false, frame: false };
    new MutationObserver(() => {
      const box = document.querySelector('.q-int[data-item-id="e2e-motion-esim"]');
      if (!box) return;
      if (box.dataset.st === "ok") window.__moment.booked = true;
      window.__moment.pop ||= Boolean(box.querySelector(".q-st.pop"));
      window.__moment.frame ||= Boolean(box.querySelector(".z-xf.out, .z-xf.in"));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "data-st"], childList: true });
  });
  // (its layout height: a ring or a frame coming in scales what's drawn, not the box's place)
  const h0 = await esim.evaluate((el) => el.offsetHeight);
  await idb("book", "e2e-motion-esim");
  await app.waitForFunction(() => window.__moment.booked && window.__moment.pop, null, { timeout: 5000 });
  const moment = await app.evaluate(() => window.__moment);
  assert.ok(moment.frame, "parlama: the new frame comes in (E3)");
  assert.ok(moment.pop, "mühür: its chip springs");
  assert.equal(await esim.evaluate((el) => el.offsetHeight), h0, "the box keeps its height");
  await app.waitForTimeout(350);
  await app.screenshot({ path: `${out}/38a-motion-seal.png` });
  await app.waitForFunction(() => {
    const box = document.querySelector('.q-int[data-item-id="e2e-motion-esim"]');
    return box && !box.querySelector(".q-st.pop") && !box.querySelector(".z-xf").getAnimations().some((a) => a.playState === "running");
  }, null, { timeout: 3000 });
  assert.equal(await esim.locator(".q-st.pop").count(), 0, "…and it is over within a moment");

  // sayaç: the budget's figure counts to its new value (it passes through numbers between), then stands.
  await app.locator(".panel").evaluate((el) => (el.scrollTop = 0));
  // (v82: the strip's budget, what the plan will likely cost)
  const total = app.locator(".x-hero .x-budb b");
  const before = await total.innerText();
  const seen = new Set();
  const sampler = (async () => {
    for (let n = 0; n < 40; n++) {
      seen.add(await total.innerText().catch(() => ""));
      await app.waitForTimeout(40);
    }
  })();
  await idb("dearer", "Lisboa Loft");
  await sampler;
  const after = await total.innerText();
  assert.notEqual(after, before, "the likely sum changed");
  assert.ok(seen.size >= 3, `sayaç: the figure passed through numbers on its way (${[...seen].join(" → ")})`);

  // × katlama (#7), v82 (E7, F3): "Gerek yok" folds the box's body (its rows to nothing, 260 ms), the box goes under Gizlenenler;
  // "Geri al" puts it back.
  await openCat("other");
  const folding = app.locator('.q-ints > .q-int[data-st="todo"]').first();
  const foldName = await folding.getAttribute("aria-label");
  await folding.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await folding.locator(".z-h .z-mb").click();
  await folding.getByRole("menuitem", { name: "Gerek yok" }).click();
  const folded = app.locator(".q-int.folding .q-bwrap").first();
  await folded.waitFor({ state: "attached" });
  assert.deepEqual(await folded.evaluate((el) => [getComputedStyle(el).transitionProperty.split(",")[0].trim(), getComputedStyle(el).transitionDuration.split(",")[0].trim()]), ["grid-template-rows", "0.26s"], "Gerek yok: the body folds in 260 ms");
  await app.locator('.q-sec[data-section="other"] .q-hid > summary').waitFor();
  await app.locator(".pk-undo").getByRole("button", { name: "Geri al" }).click();
  await app.locator(`.q-ints > .q-int[aria-label="${foldName}"]`).waitFor();

  // Geri alma bildirimi (#15): comes up from 20 px in 300 ms (--e-out), the countdown ring is still 8 s; when it goes it fades with a still copy.
  await openCat("activity");
  const douro = app.locator('.z-k[aria-label="Douro tekne turu"]').first();
  await douro.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douro.locator(".z-kmb").click();
  await app.locator(".z-kpop").getByRole("menuitem", { name: "Sil" }).click();
  const toast = app.locator(".pk-undo:not(.mv-leaving)", { hasText: "Douro tekne turu silindi" });
  await toast.waitFor();
  assert.deepEqual(await toast.evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDuration]), ["mv-toast", "0.3s"], "toast: comes up in 300 ms");
  assert.equal(await toast.locator(".pk-undo-ring .run").evaluate((el) => getComputedStyle(el).animationDuration), "8s", "toast: the countdown ring is unchanged");
  await toast.getByRole("button", { name: "Geri al" }).click();
  await app.locator(".pk-undo.mv-leaving").first().waitFor({ state: "attached", timeout: 3000 });
  await app.waitForFunction(() => !document.querySelector(".pk-undo.mv-leaving"), null, { timeout: 3000 });

  // Sohbet mesajı girişi (#14), ⓘ balonu (#16): the rules the chat's messages and the balloon carry (a message is only drawn while a chat runs).
  const rules = await app.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "msg-assistant";
    document.body.appendChild(probe);
    const msg = [getComputedStyle(probe).animationName, getComputedStyle(probe).animationDuration];
    probe.remove();
    const tip = document.createElement("div");
    tip.className = "tipx-box";
    document.body.appendChild(tip);
    const balloon = [getComputedStyle(tip).animationName, getComputedStyle(tip).animationDuration];
    tip.remove();
    return { msg, balloon };
  });
  assert.deepEqual(rules, { msg: ["mv-rise-s", "0.26s"], balloon: ["tipx-in", "0.14s"] }, "chat message rises in 260 ms; the ⓘ balloon in 140 ms");

  // Pano (v82 window): "Yeni" until seen (with the ring of a card that just came), the heart springs. The v11 strips' own opening and a
  // card's "Neden?" are not in the v82 Pano (E8 grows the window instead; the pluses and minuses are the comparison's own rows): only that
  // they are gone is checked.
  await app.getByRole("tab", { name: /Pano/ }).click();
  const motionPano = app.getByRole("dialog", { name: "Pano" });
  await motionPano.locator(".q-pg").first().waitFor();
  assert.equal(await motionPano.locator("[data-pit-children]").count(), 0, "v82: no strip opening of its own (E8 grows the window)");
  assert.ok((await motionPano.locator(".q-pg.ar-new .q-new").count()) > 0, "Pano: what came since the last visit says Yeni and carries the ring");
  const heartMotion = await motionPano.locator(".q-like").first().evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el).transitionTimingFunction]);
  assert.deepEqual(heartMotion, ["0.25s", "cubic-bezier(0.2, 1.6, 0.4, 1)"], "the heart springs in 250 ms");
  assert.equal(await motionPano.getByRole("button", { name: /^Neden\?/ }).count(), 0, "v82: no Neden? on a card (the comparison has Artılar and Eksiler)");
  // E8: Escape takes it away in 180 ms, shrinking to 97% (--e-in); the scrim lightens with it.
  const goes = await app.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return [".q-sheetp", ".q-scrim"].map((sel) => [...document.querySelectorAll(sel)].flatMap((g) => g.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration])));
  });
  assert.deepEqual(goes, [[["q-sheet-out", 180]], [["q-fade-out", 180]]], `E8: the window goes in 180 ms (${JSON.stringify(goes)})`);
  await motionPano.waitFor({ state: "detached" });
  // A second visit has seen it all: no "Yeni", no ring.
  await app.getByRole("tab", { name: /Pano/ }).click();
  await motionPano.locator(".q-pg").first().waitFor();
  assert.equal(await motionPano.locator(".q-new, .q-pg.ar-new").count(), 0, "Pano: seen once, no Yeni the next time");
  await app.keyboard.press("Escape");
  await motionPano.waitFor({ state: "detached" });
  // E report §2.10: a choice made in the window shows on the plan once it has gone: while it is open the plan keeps still; then the box
  // the choice changed glows where it stands (pk-glow, 1.1 s). (A stay box with two or more options, on screen; put back as it was after.)
  await openCat("stay");
  const manyStay = app.locator('.q-sec[data-section="stay"] .q-int[data-option-ids*=" "]').first();
  await manyStay.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const stayIds = (await manyStay.getAttribute("data-option-ids")).split(" ");
  const stayCur = await manyStay.getAttribute("data-item-id");
  const statusesOf = (ids) => app.evaluate(async (ids) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = await new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    return Object.fromEntries(all.filter((i) => ids.includes(i.id)).map((i) => [i.id, i.status]));
  }, ids);
  const stayWas = await statusesOf(stayIds);
  await app.evaluate(() => {
    window.__glow = null;
    new MutationObserver(() => {
      const box = document.querySelector(".panel .q-int.pk-glow");
      if (box && !window.__glow) window.__glow = { ids: box.getAttribute("data-option-ids"), anim: `${getComputedStyle(box).animationName} ${getComputedStyle(box).animationDuration}` };
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await app.getByRole("tab", { name: /Pano/ }).click();
  await motionPano.locator('.q-sgh[data-cat="stay"]').click();
  await motionPano.locator(".q-pg").first().waitFor();
  // (one of the box's options that can still be chosen here)
  const pickId = await motionPano.evaluate((el, [ids, cur]) => ids.find((id) => id !== cur && el.querySelector(`[data-item-id="${CSS.escape(id)}"] button.q-pick`)) ?? null, [stayIds, stayCur]);
  assert.ok(pickId, `a stay of that box to choose in the Pano (${stayIds})`);
  await motionPano.locator(`[data-item-id="${pickId}"] button.q-pick`).first().click();
  await motionPano.locator(`[data-item-id="${pickId}"] span.q-pick`).first().waitFor();
  assert.equal(await app.evaluate(() => window.__glow), null, "§2.10: while the window is open the plan keeps still");
  await app.keyboard.press("Escape");
  await motionPano.waitFor({ state: "detached" });
  await app.waitForFunction(() => window.__glow, null, { timeout: 3000 });
  const glowed = await app.evaluate(() => window.__glow);
  assert.ok(glowed.ids.split(" ").includes(pickId) && glowed.anim === "pk-glow 1.1s", `§2.10: once it has gone, the box it changed glows 1.1 s (${JSON.stringify(glowed)})`);
  await app.waitForFunction(() => !document.querySelector(".panel .q-int.pk-glow"), null, { timeout: 3000 });
  await app.evaluate(async (was) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const tx = database.transaction("items", "readwrite");
    const all = await new Promise((resolve) => (tx.objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    for (const it of all) if (it.id in was && it.status !== was[it.id]) tx.objectStore("items").put({ ...it, status: was[it.id], updatedAt: Date.now() });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    new BroadcastChannel("trip-radar").postMessage("changed");
  }, stayWas);
  await app.waitForFunction(async ([ids, was]) => {
    const request = indexedDB.open("trip-radar");
    const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
    const all = await new Promise((resolve) => (database.transaction("items").objectStore("items").getAll().onsuccess = (e) => resolve(e.target.result)));
    return all.filter((i) => ids.includes(i.id)).every((i) => i.status === was[i.id]);
  }, [stayIds, stayWas], { timeout: 3000 });

  // ---- F8b Hareket Dili (docs/mockups/artifact-arsivi/hareket-dili-P2qVN5; Emre's m-* decisions): one short claim for each movement ----
  const named = "(el) => el.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration])"; // (run in the page)
  // m-sekme: the pair's highlight is one piece that slides to the chosen segment (260 ms --e-out); the new view comes in 12 px from the side
  // it was chosen on (260 ms), the one left stays a moment as a still copy that fades (120 ms).
  await app.getByRole("tab", { name: /^Plan/ }).first().click();
  await app.locator(".cat-plan").waitFor();
  await app.locator(".panel").evaluate((el) => (el.scrollTop = 0));
  const viewTabs = app.locator(".view-tabs");
  assert.ok(await viewTabs.evaluate((el) => el.classList.contains("has-ind")), "m-sekme: the pair carries a sliding highlight");
  assert.deepEqual(await viewTabs.evaluate((el) => { const cs = getComputedStyle(el, "::before"); return [cs.transitionDuration.split(",")[0].trim(), cs.transitionTimingFunction.match(/cubic-bezier\([^)]*\)/)[0]]; }), ["0.26s", "cubic-bezier(0.16, 1, 0.3, 1)"], "m-sekme: the highlight slides 260 ms, --e-out");
  // v82 (E8): the Pano tab opens the Pano window over the plan: it grows from the middle (from 96%, 260 ms) as the plan darkens behind it;
  // the plan stays where it is (E report §3.9: no fading copy of it, nothing comes in from the side). The tabs' highlight still slides to Pano.
  const toPano = await app.evaluate(async () => {
    [...document.querySelectorAll(".view-tabs [role=tab]")].find((b) => /Pano/.test(b.textContent)).click();
    const ghosts = document.querySelectorAll(".mv-ghost").length;
    for (let i = 0; i < 100 && !document.querySelector(".q-sheetp"); i++) await new Promise((r) => requestAnimationFrame(r));
    const anim = (sel) => [...document.querySelectorAll(sel)].flatMap((g) => g.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration]));
    return { sheet: anim(".q-sheetp"), scrim: anim(".q-scrim"), plan: document.querySelectorAll(".panel .cat-plan").length, dir: document.documentElement.style.getPropertyValue("--tab-dir"), ghosts };
  });
  assert.deepEqual(toPano.sheet, [["q-sheet-in", 260]], `E8: the Pano window grows in over 260 ms (${JSON.stringify(toPano.sheet)})`);
  assert.deepEqual(toPano.scrim, [["q-fade-in", 260]], "E8: the plan darkens behind it over the same 260 ms");
  assert.equal(toPano.plan, 1, "the plan stays behind the window");
  assert.deepEqual([toPano.ghosts, toPano.dir], [0, ""], "§3.9: no copy of the plan fades and nothing comes in from the side for the Pano");
  await app.waitForFunction(() => !document.querySelector(".mv-ghost"), null, { timeout: 2000 });
  await app.waitForFunction(() => { const el = document.querySelector(".view-tabs"); return Math.abs(new DOMMatrix(getComputedStyle(el, "::before").transform).m41 - el.querySelector('[aria-selected="true"]').offsetLeft) < 1.5; }, null, { timeout: 5000 });
  const slid = await viewTabs.evaluate((el) => [new DOMMatrix(getComputedStyle(el, "::before").transform).m41, el.querySelector('[aria-selected="true"]').offsetLeft, el.querySelector('[aria-selected="true"]').textContent]);
  assert.ok(Math.abs(slid[0] - slid[1]) < 1.5 && /Pano/.test(slid[2]), `m-sekme: the highlight has slid to the chosen segment (${slid})`);
  const toPlan = await app.evaluate(() => { [...document.querySelectorAll(".view-tabs [role=tab]")].find((b) => /^Plan/.test(b.textContent)).click(); return [document.querySelectorAll(".mv-ghost").length, document.documentElement.style.getPropertyValue("--tab-dir")]; });
  assert.deepEqual(toPlan, [0, ""], "§3.9: …nor on the way back to the Plan (it was there all along)");
  await app.locator(".cat-plan").waitFor();
  assert.equal(await app.getByRole("dialog", { name: "Pano" }).count(), 0, "the Plan tab shuts the Pano window");
  // The copy of the view left and the new one from the side: a view's own change (Kategoriye göre → Yolculuk sırasıyla) still has both.
  const toTrip = await app.evaluate(async () => {
    [...document.querySelectorAll(".plan-order [role=tab]")].find((b) => /Yolculuk/.test(b.textContent)).click();
    const out = {
      ghost: [...document.querySelectorAll(".mv-ghost")].flatMap((g) => g.getAnimations().map((a) => ["fade", a.effect.getComputedTiming().duration, a.effect.getComputedTiming().easing])),
      inside: document.querySelectorAll(".mv-ghost *").length,
      view: [],
    };
    // (Yolculuk sırasıyla is drawn within a frame or two of the press: its own .q-trip, the plan's other .trip-plan pieces were there before)
    for (let i = 0; i < 100 && !document.querySelector(".panel .q-trip.trip-plan"); i++) await new Promise((r) => requestAnimationFrame(r));
    out.view = [...document.querySelectorAll(".panel .q-trip.trip-plan")].flatMap((g) => g.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration]));
    return out;
  });
  assert.ok(toTrip.ghost.some(([, d, easing]) => d === 120 && easing === "cubic-bezier(0.5, 0, 0.75, 0)"), `m-sekme: the old view fades 120 ms, --e-in (${JSON.stringify(toTrip.ghost)})`);
  assert.equal(toTrip.inside, 0, "m-sekme: the copy of the old view is out of every query's reach (a closed shadow tree)");
  assert.ok(toTrip.view.some(([n, d]) => n === "mv-tab-in" && d === 260), `m-sekme: the new view comes in over 260 ms (${JSON.stringify(toTrip.view)})`);
  await app.waitForFunction(() => !document.querySelector(".mv-ghost"), null, { timeout: 2000 });
  assert.ok(await app.locator(".plan-order").evaluate((el) => el.classList.contains("has-ind")), "m-sekme: the Plan's three ways to read carry the highlight too");
  await app.getByRole("tab", { name: "Kategoriye göre", exact: true }).click();
  await app.locator(".cat-plan").waitFor();

  // m-bolum: a category folds on a grid (rows 0fr and 1fr, 260 ms); its cards come in 80 ms late (180 ms); shut, the body stays drawn until it has folded.
  const flightSec = app.locator('.q-sec[data-section="flight"]');
  await flightSec.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await openCat("flight");
  const shutting = await flightSec.evaluate(async (sec) => {
    sec.querySelector(".q-tt").click();
    for (let i = 0; i < 60 && sec.classList.contains("open"); i++) await new Promise((r) => requestAnimationFrame(r));
    const fold = sec.querySelector(".q-fold");
    const cs = fold && getComputedStyle(fold);
    return fold && { on: fold.classList.contains("on"), inert: fold.inert, prop: cs.transitionProperty, dur: cs.transitionDuration, closed: !sec.classList.contains("open") };
  });
  assert.deepEqual(shutting, { on: false, inert: true, prop: "grid-template-rows", dur: "0.26s", closed: true }, "m-bolum: shutting, the body is still drawn while its rows fold (260 ms)");
  await app.waitForFunction(() => !document.querySelector('.q-sec[data-section="flight"] .q-fold'), null, { timeout: 3000 });
  await flightSec.locator(".q-tt").click();
  await flightSec.locator(".q-fold.on").waitFor({ timeout: 3000 });
  assert.deepEqual(await flightSec.locator(".q-fold-in > *").first().evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el).transitionDelay]), ["0.18s", "0.08s"], "m-bolum: the cards come in 80 ms late, over 180 ms");
  await flightSec.locator(".q-fold.settled").waitFor({ timeout: 3000 });

  // m-iskelet + m-isik + m-kurallar: a link being read. Under 0.4 s there is no skeleton; after it the card is a dashed skeleton with a light
  // over it; a thin light runs along the top; the home's pill counts it and, when it is over, says "1 kayıt eklendi ✓" and fades.
  const captureRow = (status) =>
    app.evaluate(async (st) => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
      const tx = database.transaction("captures", "readwrite");
      if (st === "gone") tx.objectStore("captures").delete("e2e-motion-wait");
      else tx.objectStore("captures").put({ id: "e2e-motion-wait", kind: "paste-link", url: "https://www.airbnb.com/rooms/4242", title: null, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: null, capturedAt: Date.now(), status: st, error: null, itemId: null });
      await new Promise((resolve) => (tx.oncomplete = resolve));
      new BroadcastChannel("trip-radar").postMessage("changed");
    }, status);
  await captureRow("processing");
  const waiting = app.locator(".ar-pending", { hasText: "airbnb.com" });
  await waiting.waitFor({ timeout: 5000 });
  assert.equal(await app.locator(".ar-pending.ar-skel, .ar-ph").count(), 0, "m-kurallar: a wait under 0.4 s shows no skeleton");
  await app.locator(".ar-pending.ar-skel").waitFor({ timeout: 5000 });
  const skel = await app.locator(".ar-pending.ar-skel").evaluate((el) => [getComputedStyle(el).borderTopStyle, getComputedStyle(el, "::after").animationDuration, el.querySelectorAll(".ar-ph i").length]);
  assert.deepEqual(skel, ["dashed", "1.3s", 2], "m-iskelet: a dashed skeleton, the light passing over it in 1.3 s");
  assert.deepEqual(await app.locator(".work-line.on i").evaluate(new Function("el", `return (${named})(el)`)), [["mv-indet", 1200]], "m-isik: a thin light runs along the top, 1.2 s a pass");
  assert.equal(await app.locator(".work-line").evaluate((el) => getComputedStyle(el).height), "3px");
  const swapIn = await app.locator(".pk-card, .q-ints > .q-int").first().evaluate((el) => {
    el.classList.add("ar-new");
    const r = el.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration]);
    el.classList.remove("ar-new");
    return r;
  });
  assert.ok(swapIn.some(([n, d]) => n === "mv-swap-in" && d === 380), `m-iskelet: the real card sets in over 380 ms (${JSON.stringify(swapIn)})`);
  await app.getByRole("button", { name: "Seyahatlerim" }).first().click();
  const pill = app.locator(".work-pill");
  await pill.waitFor({ timeout: 5000 });
  assert.equal(await app.locator(".work-slot").evaluate((el) => getComputedStyle(el).position), "fixed", "m-isik: the pill is at the top right, where it stays");
  await pill.locator(".work-spin").waitFor({ timeout: 3000 });
  await captureRow("gone");
  await app.locator(".work-pill.done", { hasText: "1 kayıt eklendi ✓" }).waitFor({ timeout: 3000 });
  assert.deepEqual(await app.locator(".work-pill.done").evaluate(new Function("el", `return (${named})(el)`)), [["mv-pill-bye", 2200]], "m-isik: the pill says what was added, then fades");
  await app.locator(".work-pill").waitFor({ state: "detached", timeout: 5000 });
  await app.getByText("Portekiz (örnek)").first().click();
  await app.locator(".cat-plan").waitFor();

  // m-maskot: "Oldu" hops (900 ms, alternating); m-sert: the seal is pressed down from big (420 ms), the banner comes down whole (380 ms) and is
  // pulled up (200 ms), the notice ends in #16311f; m-cekmece: the drawer 320 ms in, 220 ms out; m-kurallar: dots wait 400 ms.
  const probes = await app.evaluate(async () => {
    const pick = (el, ...keys) => keys.map((k) => getComputedStyle(el)[k]);
    const add = (tag, cls, parent = document.body) => {
      const el = document.createElement(tag);
      el.className = cls;
      parent.appendChild(el);
      return el;
    };
    const mascot = add("span", "ms-wrap");
    mascot.dataset.state = "done";
    mascot.innerHTML = '<svg class="ms" viewBox="0 0 48 48" width="34" height="34"></svg>';
    const out = { hop: pick(mascot.querySelector(".ms"), "animationName", "animationDuration", "animationIterationCount", "animationDirection") };
    mascot.remove();
    const okt = add("div", "pk-seal");
    const seal = add("span", "okt", okt);
    out.seal = pick(seal, "animationName", "animationDuration");
    okt.remove();
    const chat = document.querySelector(".chat") ?? document.body;
    const banner = add("div", "chat-banner settings", chat);
    out.bannerIn = pick(banner, "animationName", "animationDuration", "animationTimingFunction");
    banner.remove();
    await new Promise((r) => setTimeout(r, 0)); // (the page's observer sees the removal)
    const gone = document.querySelector(".mv-banner-out");
    out.bannerOut = gone ? pick(gone, "animationName", "animationDuration") : null;
    gone?.remove();
    const ok = add("div", "reconnect ok");
    out.ok = pick(ok, "backgroundColor");
    ok.remove();
    const drawer = add("aside", "drawer");
    out.drawerIn = pick(drawer, "animationName", "animationDuration");
    drawer.classList.add("mv-leaving");
    out.drawerOut = pick(drawer, "animationName", "animationDuration");
    drawer.remove();
    const thinking = add("div", "thinking");
    out.thinking = pick(thinking, "animationName", "animationDelay");
    thinking.remove();
    return out;
  });
  assert.deepEqual(probes.hop, ["ms-hop", "0.9s", "infinite", "alternate"], "m-maskot: Oldu hops, 900 ms");
  assert.deepEqual(probes.seal, ["mv-stamp", "0.42s"], "m-sert: the seal is pressed down from big, 420 ms");
  assert.deepEqual(probes.bannerIn, ["mv-banner-in", "0.38s", "cubic-bezier(0.16, 1, 0.3, 1)"], "m-sert: the banner comes down whole, 380 ms --e-out");
  assert.deepEqual(probes.bannerOut, ["mv-banner-up", "0.2s"], "m-sert: solved, it is pulled up in 200 ms");
  assert.equal(probes.ok[0], "rgb(22, 49, 31)", "m-sert: the notice ends in #16311f");
  assert.deepEqual(probes.drawerIn, ["mv-drawer", "0.32s"], "m-cekmece: the drawer comes in over 320 ms");
  assert.deepEqual(probes.drawerOut, ["mv-drawer-out", "0.22s"], "m-cekmece: and leaves over 220 ms");
  assert.deepEqual(probes.thinking, ["mv-fade", "0.4s"], "m-kurallar: the dots come in after 400 ms");

  // m-cekmece: the trip's photo takes 420 ms back to its card (and 600 ms in: the way is on the page while it runs).
  const photoWay = await app.evaluate(async () => {
    const back = [...document.querySelectorAll("button")].find((b) => /Seyahatlerim/.test(b.textContent));
    back.click();
    const seen = { way: document.documentElement.dataset.photo, ms: null };
    for (let i = 0; i < 40 && !seen.ms; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const a = document.documentElement.getAnimations({ subtree: true }).find((x) => x.effect?.pseudoElement === "::view-transition-old(trip-photo)");
      if (a) seen.ms = a.effect.getComputedTiming().duration;
    }
    return seen;
  });
  assert.equal(photoWay.way, "back", "m-cekmece: the way back is set");
  assert.ok(photoWay.ms == null || photoWay.ms === 420, `m-cekmece: the photo goes back over 420 ms (${photoWay.ms})`);
  await app.getByText("Portekiz (örnek)").first().click();
  await app.locator(".cat-plan").waitFor();

  // m-planakoy: the card's small copy flies in an arc (420 ms) to the number of its section, which jumps 1.35x (380 ms); with no section in
  // sight (the Pano) it flies to the Plan tab as before. (a stand-in button, so nothing is put on the plan)
  // (v82: the category's row; its number is its state line, "1 planda")
  const actSec = app.locator('.q-sec[data-section="activity"]');
  await actSec.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.waitForTimeout(300);
  const flew = await app.evaluate(async () => {
    const sec = document.querySelector('.q-sec[data-section="activity"]');
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "+ Plana koy";
    sec.querySelector(".q-row1").insertAdjacentElement("afterend", b);
    const calls = [];
    const real = Element.prototype.animate;
    Element.prototype.animate = function (k, o) {
      calls.push([this, k, o]);
      return real.call(this, k, o);
    };
    b.click();
    const chip = document.querySelector(".mv-fly");
    const mark = sec.querySelector(".q-row1 .q-pl1");
    const keys = chip?.getAnimations()[0]?.effect.getKeyframes().map((k) => k.transform) ?? [];
    const timing = chip?.getAnimations()[0]?.effect.getComputedTiming().duration;
    let bump = null;
    for (let i = 0; i < 100 && !bump; i++) {
      await new Promise((r) => setTimeout(r, 40));
      bump = calls.find(([el, k]) => el === mark && k.some((f) => f.scale === "1.35"))?.[2].duration ?? null;
    }
    Element.prototype.animate = real;
    b.remove();
    return { keys, timing, bump, toMark: Boolean(mark), seen: calls.map(([el, k]) => `${el.className}|${el.tagName}|${JSON.stringify(k).slice(0, 60)}`), box: JSON.stringify(mark?.getBoundingClientRect()) };
  });
  assert.ok(flew.toMark && flew.timing === 420, `m-planakoy: the copy flies 420 ms to the section's number (${JSON.stringify(flew)})`);
  assert.ok(/scale\(0?\.9\)/.test(flew.keys[1]) && /scale\(0?\.6\)/.test(flew.keys[2]), `m-planakoy: from the drawing: .9 at the top of the arc, .6 at the end (${flew.keys})`);
  assert.equal(flew.bump, 380, `m-planakoy: the number jumps 1.35x over 380 ms (${JSON.stringify(flew)})`);
  await app.locator(".panel").evaluate((el) => (el.scrollTop = 0));
  await app.getByRole("tab", { name: /Pano/ }).click();
  await app.locator(".q-sheetp .q-pg").first().waitFor();
  const flewTab = await app.evaluate(async () => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "+ Plana koy";
    document.querySelector(".q-sheetp .q-sc").prepend(b);
    const calls = [];
    const real = Element.prototype.animate;
    Element.prototype.animate = function (k, o) {
      calls.push([this, k, o]);
      return real.call(this, k, o);
    };
    b.click();
    const tab = document.querySelector(".view-tabs [role=tab]");
    let bump = null;
    for (let i = 0; i < 100 && !bump; i++) {
      await new Promise((r) => setTimeout(r, 40));
      bump = calls.find(([el, k]) => el === tab && k.some((f) => f.scale === "1.18"))?.[2].duration ?? null;
    }
    Element.prototype.animate = real;
    b.remove();
    return bump;
  });
  assert.equal(flewTab, 380, "m-planakoy: on the Pano, where no section is drawn, the Plan tab is still the target");
  await app.keyboard.press("Escape");
  await app.locator(".q-sheetp").waitFor({ state: "detached" });
  await app.locator(".cat-plan").waitFor();

  // E6 (izlenebilirlik 123): in a city's row the card itself flies from Öneriler to its slot in Planında (420 ms), Planında's
  // count jumps (1.35x, 380 ms) and goes up by one; no toast (E16). "Plandan çıkar" puts it back quietly. With "Hareketi
  // duraklat" it is simply there, with a 2 px edge.
  const e6Was = await app.locator(".q-sec.open").evaluateAll((els) => els.map((e) => e.dataset.section));
  await openCat("activity");
  const e6Row = app.locator('.q-int.multi[data-intent="activity:Porto"]');
  const e6Card = () => e6Row.locator('.z-k[aria-label="Tiyatro"]');
  await e6Card().scrollIntoViewIfNeeded();
  const e6Count = async () => Number((await e6Row.locator(".q-planw .q-ppn").innerText()).trim() || 0);
  const e6Before = await e6Count();
  await app.evaluate(() => {
    const seen = (window.__e6 = { fly: null, bump: null });
    const mo = new MutationObserver(() => {
      const f = document.querySelector(".z-fly");
      if (f?.style.transform) seen.fly = { transform: f.style.transform, duration: getComputedStyle(f).transitionDuration.split(",")[0].trim() };
      const b = document.querySelector('.q-int[data-intent="activity:Porto"] .q-ppn.bump');
      if (b) seen.bump = getComputedStyle(b).animationDuration;
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    window.__e6stop = () => mo.disconnect();
  });
  await e6Card().getByRole("button", { name: "+ Plana koy" }).click();
  await e6Row.locator('[data-row="plan"] .z-k[aria-label="Tiyatro"]').waitFor();
  await app.waitForFunction(() => window.__e6.bump && !document.querySelector(".z-fly"), null, { timeout: 3000 });
  const e6 = await app.evaluate(() => (window.__e6stop(), window.__e6));
  assert.match(e6.fly?.transform ?? "", /^translate\(-?\d+px, -?\d+px\) scale\(1, 1\)$/, `E6: the card flies to its slot (${JSON.stringify(e6)})`);
  assert.equal(e6.fly.duration, "0.42s", "E6: 420 ms");
  assert.equal(e6.bump, "0.38s", "E6: Planında's count jumps over 380 ms");
  assert.equal(await e6Count(), e6Before + 1, "E6: one more on the plan");
  assert.equal(await app.locator(".pk-undo", { hasText: "Tiyatro" }).count(), 0, "E16: no toast for a pick");
  await e6Row.locator('[data-row="plan"] .z-k[aria-label="Tiyatro"] .q-rm').click();
  await e6Row.locator('[data-row="ideas"] .z-k[aria-label="Tiyatro"]').waitFor();
  await app.evaluate(() => {
    localStorage.setItem("trip-radar:still", "1");
    document.body.classList.add("still");
  });
  await e6Card().getByRole("button", { name: "+ Plana koy" }).click();
  await e6Row.locator('[data-row="plan"] .z-k.landed[aria-label="Tiyatro"]').waitFor();
  assert.equal(await app.locator(".z-fly").count(), 0, "Hareketi duraklat: nothing flies");
  await app.evaluate(() => {
    localStorage.removeItem("trip-radar:still");
    document.body.classList.remove("still");
  });
  await e6Row.locator('[data-row="plan"] .z-k[aria-label="Tiyatro"] .q-rm').click();
  await e6Row.locator('[data-row="ideas"] .z-k[aria-label="Tiyatro"]').waitFor();
  // The plan as it was for what follows: the category open before this one.
  if (e6Was[0] && e6Was[0] !== "activity") await openCat(e6Was[0]);
  else if (!e6Was.length) await app.locator('.q-sec[data-section="activity"] .q-tt').click();
  await app.waitForTimeout(600); // E1: the category's one scroll into place (380 ms) is over before the next check scrolls

  // m-kurallar: at most two pulsing frames on screen (the third and later keep still); a window open, the cards behind keep still (one focus).
  // (v82: the empty cards' rings went with the cards; what pulses is an empty ticket's frame, Gün gün's flight in its search look.)
  const rings = await app.evaluate(async () => {
    const panel = document.querySelector(".panel");
    panel.scrollTop = 0;
    const fakes = [];
    for (let i = 0; i < 4; i++) {
      const card = document.createElement("div");
      card.className = "pk-card tk tk-search";
      card.style.cssText = "position:absolute;left:" + (200 + i * 40) + "px;top:" + (120 + i * 24) + "px;width:30px;height:30px;min-height:0;z-index:5";
      panel.appendChild(card);
      fakes.push(card);
    }
    for (let i = 0; i < 75 && fakes.filter((f) => f.hasAttribute("data-np")).length < 2; i++) await new Promise((r) => setTimeout(r, 40));
    const still = fakes.filter((f) => f.hasAttribute("data-np")).length;
    const names = fakes.map((f) => getComputedStyle(f).animationName);
    const modal = document.createElement("div");
    modal.className = "modal";
    document.body.appendChild(modal);
    const paused = fakes.slice(0, 2).map((f) => f.getAnimations()[0]?.playState ?? "none");
    modal.remove();
    const running = fakes.slice(0, 2).map((f) => f.getAnimations()[0]?.playState ?? "none");
    fakes.forEach((f) => f.remove());
    return { still, names, paused, running };
  });
  assert.equal(rings.still, 2, `m-kurallar: of four frames on screen two keep still (${JSON.stringify(rings)})`);
  assert.deepEqual(rings.names, ["pk-pulse", "pk-pulse", "none", "none"], "m-kurallar: the first two pulse, the third and fourth do not");
  assert.deepEqual(rings.paused, ["paused", "paused"], "m-kurallar: a window open, the frames behind keep still");
  assert.deepEqual(rings.running, ["running", "running"], "m-kurallar: closed, they pulse again");

  // Yer tutucu cümleler (#12, ana-sayfa-v1): one line at a time over the home box while it is empty and left alone, the next every 3.2 s
  // with a soft fade; focus stops them and the first stays.
  await app.getByRole("button", { name: "Seyahatlerim" }).first().click();
  const homeBox = app.getByLabel("Gezi kutusu");
  await homeBox.waitFor();
  assert.equal(await app.locator(".st-ph").count(), 1, "one hint line over the box");
  const firstHint = await app.locator(".st-ph").textContent();
  await app.waitForFunction((was) => (document.querySelector(".st-ph")?.textContent ?? was) !== was, firstHint, { timeout: 8000 });
  assert.equal(await app.locator(".st-ph").evaluate((el) => getComputedStyle(el).transitionDuration.split(", ")[0]), "0.45s", "the line fades over .45 s");
  await homeBox.focus();
  assert.equal(await app.locator(".st-ph").count(), 0, "focus stops the turning");
  assert.match(await homeBox.getAttribute("placeholder"), /^Şubat'ta Tromsø/, "…and the first hint stays");
  await homeBox.blur();

  // Fikir çipleri (ana-sayfa-v1): six ideas, Sürpriz bir yer and Başka fikirler under the box (no Yeni gezi planla, no Paylaşılan geziye
  // katıl). An idea writes its sentence into the box, typed in, and leaves the caret at its end; the chat doesn't start. Başka fikirler
  // brings the other six.
  assert.equal(await app.locator(".hm-ideas .hm-idea:not(.hm-more)").count(), 7, "six ideas and Sürpriz bir yer");
  assert.equal(await app.locator(".hm-ideas .hm-idea-th:not(.hm-idea-ic) svg").count(), 6, "each idea with its drawing");
  assert.equal(await app.locator(".hm-ideas").getByText("Sürpriz bir yer").count(), 1, "Sürpriz bir yer");
  await app.locator(".hm-idea", { hasText: "Lizbon" }).click();
  const lisbon = "Bu cuma Lizbon'a 3 gecelik kaçamak: en uygun uçuş ve Alfama'da küçük bir otel.";
  await app.waitForFunction((full) => {
    const ta = document.querySelector(".st-ta textarea");
    return ta?.value === full && document.activeElement === ta && ta.selectionStart === full.length;
  }, lisbon, { timeout: 5000 });
  assert.equal(await app.locator(".st-hello").count(), 1, "the chip only writes: the home stays");
  const firstIdea = await app.locator(".hm-ideas .hm-idea").first().textContent();
  await app.locator(".hm-more").click();
  await app.locator(".hm-idea", { hasText: "İzlanda" }).waitFor();
  assert.notEqual(await app.locator(".hm-ideas .hm-idea").first().textContent(), firstIdea, "Başka fikirler: the other six");
  await homeBox.fill("");
  await homeBox.blur();
  await app.getByText("Portekiz (örnek)").first().click();
  await app.locator(".cat-plan").waitFor();

  // K29 aşama geçişi (v82, E §2.3–2.5): the booked flight taken back to Seçildi is a step back, quiet (no takeoff, no spring);
  // booked again, the ticket's plane takes off (1.1 s), the tick by Bilet alındı is stamped (420 ms) and the chip springs (.5 s).
  // No glow: the ticket is in sight. (Recorded as it happens: a busy machine looks late.)
  await openCat("flight");
  await app.evaluate(() => {
    window.__lisbon = () => [...document.querySelectorAll('.q-sec[data-section="flight"] .q-ints > .q-int')].find((b) => b.querySelector(".q-nm")?.textContent.includes("Lizbon"));
    window.__stage = {};
    new MutationObserver(() => {
      const box = window.__lisbon();
      if (!box) return;
      const anim = (sel) => {
        const el = box.querySelector(sel);
        const cs = el && getComputedStyle(el);
        return cs ? [cs.animationName, cs.animationDuration, cs.animationTimingFunction].join(" ") : null;
      };
      window.__stage.back ||= box.dataset.st !== "ok" && box.classList.contains("z-go");
      // (the booked frame comes in 120 ms after the chosen one fades)
      if (!box.classList.contains("z-go") || box.dataset.st !== "ok" || !box.querySelector(".z-tk.bk .z-ok svg")) return;
      window.__stage.booked ||= { plane: anim(".z-tk .q-mid.big img"), tick: anim(".z-tk .z-ok svg"), glow: box.classList.contains("pk-glow") || box.classList.contains("pk-stage") };
      window.__stage.pop ||= Boolean(box.querySelector(".q-st.pop"));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "data-st"], childList: true });
  });
  const TAP_OUT = "TAP · Lizbon → İstanbul";
  const tapOut = app.locator('.q-sec[data-section="flight"] .q-ints > .q-int', { has: app.locator(".q-nm", { hasText: "Lizbon" }) }).first();
  await idb("status", [TAP_OUT, "chosen"]);
  await tapOut.locator(".z-tk:not(.bk)").waitFor({ timeout: 5000 });
  await app.waitForTimeout(400);
  await idb("status", [TAP_OUT, "booked"]);
  await app.waitForFunction(() => window.__stage.booked && window.__stage.pop, null, { timeout: 5000 });
  const stage = await app.evaluate(() => window.__stage);
  const E = "cubic-bezier(0.16, 1, 0.3, 1)";
  assert.equal(stage.back, false, "K29: the step back is quiet");
  assert.equal(stage.booked.plane, `pk-takeoff 1.1s ${E}`, "K29: the plane takes off");
  assert.equal(stage.booked.tick, "mv-stamp 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.3)", "K29: the tick is stamped");
  assert.equal(stage.booked.glow, false, "K29: no glow, the ticket is in sight");
  assert.ok(stage.pop, "K29: the chip springs");
  await app.waitForFunction(() => !window.__lisbon()?.classList.contains("z-go"), null, { timeout: 4000 });
  assert.equal(await tapOut.getAttribute("data-st"), "ok", "…and it stays booked once the moment is over");

  // Canlı dot (D10): a flight late on the data's word has the pulse on its live strip (1.6 s, ring 4 > 7 px), amber; it is only the dot that moves.
  await app.evaluate(async () => {
    const end = (iata, t) => ({ iata, airport: null, scheduled: t, revised: null, actual: null, terminal: null, gate: null });
    const flight = { number: "TP1760", airline: "TAP", status: "Delayed", departure: { ...end("LIS", "2026-10-14T19:40"), revised: "2026-10-14T20:25" }, arrival: { ...end("IST", "2026-10-15T01:35"), belt: null }, fetchedAt: "t" };
    await chrome.storage.local.set({ flightLive: { "TP1760|2026-10-14": { flight, at: Date.now() } } });
    new BroadcastChannel("trip-radar").postMessage("changed");
  });
  const dot = tapOut.locator(".z-live .z-ldot.late");
  await dot.waitFor({ timeout: 5000 });
  const pulse = await dot.evaluate((el) => {
    const cs = getComputedStyle(el, "::before");
    const keys = el.getAnimations({ subtree: true })[0].effect.getKeyframes();
    return [cs.animationName, cs.animationDuration, cs.animationIterationCount, cs.boxShadow.includes("4px"), keys.some((k) => String(k.boxShadow).includes("7px")), el.textContent];
  });
  assert.deepEqual(pulse, ["pk-live-pulse", "1.6s", "infinite", true, true, "Canlı"], "Canlı dot: 1.6 s, ring 4 to 7 px");

  // The window leaves with a still copy (exitMotion.ts): out of the flow, hidden from readers, without ids, gone within a moment.
  const settingsTab = await motion.newPage();
  await settingsTab.goto(`chrome-extension://${id}/app.html#settings`);
  await settingsTab.locator(".modal-card").waitFor();
  await settingsTab.locator(".modal").click({ position: { x: 5, y: 5 } });
  await settingsTab.locator(".mv-leaving").first().waitFor({ state: "attached", timeout: 1000 });
  const leaving = await settingsTab.locator(".mv-leaving").first().evaluate((el) => ({ inert: el.inert, hidden: el.getAttribute("aria-hidden"), ids: el.querySelectorAll("[id]").length + (el.id ? 1 : 0) }));
  assert.deepEqual(leaving, { inert: true, hidden: "true", ids: 0 }, "exit: the copy is inert, aria-hidden and carries no id");
  await settingsTab.waitForFunction(() => !document.querySelector(".mv-leaving"), null, { timeout: 1000 });
  assert.equal(await settingsTab.locator(".modal-card").count(), 0, "exit: the real window is gone, not the copy only");

  // Hareketi duraklat (Settings): body.still, kept in this browser, stops the lift on hover.
  await settingsTab.goto("about:blank");
  await settingsTab.goto(`chrome-extension://${id}/app.html#settings`);
  await settingsTab.locator(".modal-card").waitFor();
  await settingsTab.getByLabel("Hareketi duraklat", { exact: false }).check();
  assert.equal(await settingsTab.evaluate(() => [document.body.classList.contains("still"), localStorage.getItem("trip-radar:still")]).then((v) => v.join()), "true,1", "duraklat: body.still and the saved choice");
  await app.reload();
  await app.locator(".q-sec").first().waitFor();
  await openCat("flight");
  const portoStill = app.locator('.q-sec[data-section="flight"] .q-ints > .q-int', { has: app.locator(".q-nm", { hasText: "Porto" }) }).first();
  await portoStill.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await portoStill.locator(".z-bt .q-chg").click();
  const still = portoStill.locator(".q-row.z-r:not(.is-cur)").first();
  await still.waitFor();
  await still.hover({ position: { x: 60, y: 20 } });
  await app.waitForTimeout(400);
  assert.equal(await still.evaluate((el) => getComputedStyle(el).transform), "none", "duraklat: the option no longer lifts");
  await portoStill.getByRole("button", { name: "Vazgeç" }).click();
  await settingsTab.getByLabel("Hareketi duraklat", { exact: false }).uncheck();
  assert.equal(await settingsTab.evaluate(() => localStorage.getItem("trip-radar:still")), null);
  await settingsTab.close();
  console.log("✓ motion: yükselme, nabız, mühür + parlama, düşüş, sayaç, Gerek yok katlanması (v82), geri alma bildirimi, sohbet mesajı, ⓘ balonu, yer tutucu cümleler, Pano (Yeni, kalp, pencerenin gelişi ve gidişi E8, seçim sonrası kutunun parlaması §2.10), each on its own and over within a moment");

  console.log("✓ motion: yükselme, nabız, mühür + parlama, düşüş, sayaç, aşama geçişi (kalkış), rt-fly, Canlı noktası, each on its own and over within a moment");
} finally {
  await motion.close();
}

// ---------------------------------------------------------------------------------------------
// Part 6: the "sihirli açılış" (src/app/opening.ts, docs/mockups/acilis-v2, B · Ritim ve sayaçlar), with its switch off for everything else.
// The first time a trip's Plan is open: what is in view comes in from the first frame and the counters count up, all of it in within about
// a second; the panel never scrolls on its own; what is below the fold waits and comes in as it is scrolled into view; a reload doesn't
// play it again; a key press ends it at once.
// ---------------------------------------------------------------------------------------------
openingOn = true;
const opening = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-open-")), {
  executablePath,
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  locale: "tr-TR",
  reducedMotion: "no-preference",
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
openingOn = false;
await opening.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
await opening.route(/functions\/v1\/web-search/, (route) => route.fulfill({ json: { answer: null, reason: "not-configured" } }));
await opening.route(/functions\/v1\/city-image/, (route) => route.fulfill({ json: { url: null, reason: "no-photo" } }));
// (the rates come after the opening here, as they may: on this software-rendered machine the re-render they bring, landing just as
// the opening ends, can hold the page's main thread for most of a second (a compositor commit wait; neither half of the v82 board
// showed it alone), and the flourish's sparks are lost in it. Prices arriving when they arrive is the opening's own rule.)
await opening.route(/frankfurter/, async (route) => {
  await new Promise((r) => setTimeout(r, 1500));
  await route.fulfill({ json: { date: "2026-09-28", rates: { TRY: 40, THB: 38, USD: 1.1 } } }).catch(() => undefined);
});
await frozen(opening);
try {
  const worker = opening.serviceWorkers()[0] ?? (await opening.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const app = await opening.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  // The flourish is recorded in the page as it plays (the burst lives 600 ms: a round trip from here, on a loaded machine, can
  // land after it), with the frames the page's main thread was held up for (a held-up frame stretches the flourish by its
  // own length, which says nothing of the flourish's timing; they are taken off its measured length below).
  await app.evaluate(() => {
    const fx = (window.__fx = { added: null, removed: null, burst: null, held: [] });
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (now - last > 100) fx.held.push([last, now]);
      last = now;
      if (fx.removed == null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          if (n.classList.contains("op-fx") && fx.added == null) fx.added = performance.now();
          if (n.classList.contains("op-spark") && !fx.burst) {
            // (the whole burst is appended in one go: read it once it's all in)
            queueMicrotask(() => {
              const layer = document.querySelector(".op-fx");
              fx.burst = {
                sparks: [...(layer?.querySelectorAll(".op-spark") ?? [])].filter((x) => x.getBoundingClientRect().width > 0).length,
                stars: layer?.querySelectorAll(".op-star").length ?? 0,
                away: document.querySelectorAll(".mascot-seat.away").length,
              };
            });
          }
        }
        for (const n of r.removedNodes) if (n instanceof HTMLElement && n.classList.contains("op-fx") && fx.removed == null) fx.removed = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // (the opening's own animations are script ones: no CSS animation name)
  const scripted = () => app.evaluate(() => document.getAnimations().filter((x) => !("animationName" in x) && !("transitionProperty" in x)).length);
  const PIECES = ".x-big, .x-tiles > .x-t, .x-strip > .x-seg, .x-strip > .x-next, .x-chips > .x-chip, .ts-item, .q-sec";
  const faint = () => app.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0 && Number(getComputedStyle(e).opacity) < 1).length, PIECES);
  // Coming in from the first frame (no wait before it): pieces are on their way while the counters count.
  await app.waitForFunction(() => document.getAnimations().some((x) => !("animationName" in x)), null, { timeout: 3000 });
  // The flourish over it (orb, sparks, glint): the mascot's orb is out of its seat, a burst of sparks and stars goes off, and all of it
  // is over within 1.2 s, leaving the mascot back in its seat; the panel is not scrolled by it.
  await app.waitForFunction(() => window.__fx.added != null, null, { timeout: 3000 });
  const fx = await (await app.waitForFunction(() => window.__fx.removed != null && window.__fx, null, { timeout: 6000 })).jsonValue();
  assert.ok(fx.burst, "a burst of sparks went off");
  assert.ok(fx.burst.sparks > 0 && fx.burst.stars > 0, `the burst has stars as well as sparks (${JSON.stringify(fx.burst)})`);
  assert.equal(fx.burst.away, 1, "the orb has left the mascot's seat");
  const flourishMs = fx.removed - fx.added;
  const heldMs = fx.held.reduce((n, [from, to]) => n + Math.max(0, Math.min(to, fx.removed) - Math.max(from, fx.added) - 16), 0);
  assert.ok(flourishMs > 0, "the flourish was measured while it played");
  assert.ok(flourishMs - heldMs <= 1200, `the flourish is over within 1.2 s (${Math.round(flourishMs)} ms, of which ${Math.round(heldMs)} ms in held-up frames)`);
  assert.equal(await app.locator(".mascot-seat.away").count(), 0, "the mascot is back in its seat");
  await app.screenshot({ path: `${out}/39a-opening-mid.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1), "the page doesn't scroll while it plays");
  // Within about a second what is in view is in: full opacity, the counters read their figures, the panel hasn't moved.
  await app.waitForTimeout(1600);
  assert.equal(await app.locator(".panel").evaluate((el) => el.scrollTop), 0, "the panel never scrolls on its own");
  const inView = await app.evaluate((sel) => {
    const edge = document.querySelector(".panel").getBoundingClientRect().bottom - 24;
    return [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().top < edge && e.getBoundingClientRect().height > 0 && Number(getComputedStyle(e).opacity) < 1).length;
  }, PIECES);
  assert.equal(inView, 0, "what is in view is in within about a second");
  assert.match(await app.locator(".x-hero .x-pct").innerText(), /^%\d+$/, "the counters read as numbers again");
  await app.screenshot({ path: `${out}/39b-opening-done.png` });
  // What is below the fold waits, and comes in as it is scrolled into view.
  const waitingBelow = await faint();
  assert.ok(waitingBelow > 0, "what is below the fold waits for the scroll");
  // (scrolled the way a traveller does, a screen at a time: a piece the panel jumps over hasn't been seen, and waits)
  await app.locator(".panel").evaluate(async (el) => {
    while (el.scrollTop + el.clientHeight < el.scrollHeight - 2) {
      el.scrollBy({ top: el.clientHeight * 0.7 });
      await new Promise((r) => setTimeout(r, 180));
    }
  });
  await app.waitForFunction((sel) => [...document.querySelectorAll(sel)].every((e) => e.getBoundingClientRect().bottom < 0 || Number(getComputedStyle(e).opacity) === 1), PIECES, { timeout: 4000 });
  await app.screenshot({ path: `${out}/39c-opening-scrolled.png` });
  await app.locator(".panel").evaluate((el) => el.scrollTo({ top: 0 }));
  await app.waitForTimeout(1500);
  assert.equal(await faint(), 0, "every piece is at full opacity once it has been seen");
  assert.equal(await scripted(), 0, "nothing of the opening is left running");

  // A reload: no second opening.
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await app.waitForTimeout(400);
  assert.equal(await scripted(), 0, "a reload doesn't play it again");
  assert.equal(await app.locator(".op-fx").count(), 0, "a reload brings no orb or sparks");
  assert.equal(await faint(), 0, "a reload shows everything at once");

  // v82 (E8): the Pano has no scripted opening of its own (the v11 one, its cards one by one, is gone): it is a window that grows in, the
  // same each time, and nothing of it is left running.
  await app.getByRole("tab", { name: /Pano/ }).click();
  await app.getByRole("dialog", { name: "Pano" }).waitFor();
  assert.ok(await app.locator(".q-sheetp").evaluate((el) => el.getAnimations().some((a) => a.animationName === "q-sheet-in")), "E8: the window grows in");
  await app.waitForTimeout(1500);
  assert.equal(await scripted(), 0, "the Pano's opening ends by itself");
  await app.keyboard.press("Escape");
  await app.getByRole("dialog", { name: "Pano" }).waitFor({ state: "detached" });
  await app.getByRole("tab", { name: /Pano/ }).click();
  await app.waitForTimeout(300);
  assert.equal(await scripted(), 0, "the Pano doesn't open a second time");
  await app.keyboard.press("Escape");
  await app.getByRole("dialog", { name: "Pano" }).waitFor({ state: "detached" });

  // A key ends it at once: opened afresh, one key press and everything is in place, below the fold too.
  await app.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("trip-radar:opened:")).forEach((k) => localStorage.removeItem(k)));
  await app.getByRole("button", { name: "Seyahatlerim" }).first().click();
  await app.getByText("Portekiz (örnek)").first().click();
  // (the hero's own pieces: another script animation on the way in must not stand in for the opening)
  await app.waitForFunction(() => document.getAnimations().some((x) => !("animationName" in x) && !("transitionProperty" in x) && x.effect?.target?.closest?.(".x-hero")), null, { timeout: 5000 });
  await app.keyboard.press("Shift");
  await app.waitForTimeout(150);
  assert.equal(await scripted(), 0, "ended at once: nothing left running");
  assert.equal(await app.locator(".op-fx").count(), 0, "ended at once: the orb and sparks are gone");
  assert.equal(await app.locator(".mascot-seat.away").count(), 0, "ended at once: the mascot is back in its seat");
  assert.equal(await faint(), 0, "ended at once: everything is in place");
  console.log("✓ opening: what is in view comes in from the first frame with the counters counting, the panel never scrolls itself, below the fold comes in as it is scrolled to, a reload doesn't repeat it, a key press ends it at once");
} finally {
  await opening.close();
}

// H2/H3: at 390 px the page never scrolls sideways: the Plan (three views), Ozora-like trips with many stops, the back of a card.
{
  const narrow = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-narrow-")), {
    executablePath,
    headless: false,
    timezoneId: "Europe/Istanbul",
    viewport: { width: 390, height: 900 },
    locale: "tr-TR",
    reducedMotion: "no-preference",
    args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await frozen(narrow);
  try {
    const worker = narrow.serviceWorkers()[0] ?? (await narrow.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    const app = await narrow.newPage();
    await app.goto(`chrome-extension://${id}/app.html`);
    await app.getByText("Örnek geziyi yükle →").click();
    await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
    await app.waitForTimeout(1800);
    const over = () => app.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    for (const view of ["Gün gün", "Yolculuk", "Pano", "Plan"]) {
      const t = app.getByRole("tab", { name: new RegExp(view === "Plan" ? "^Plan" : view) }).first();
      if (await t.count()) { await t.click(); await app.waitForTimeout(600); }
      assert.ok((await over()) <= 0, `390 px: no sideways scroll on ${view}`);
      // (v82: the Pano is a window over the plan; Escape shuts it before the next view)
      if (view === "Pano" && (await app.getByRole("dialog", { name: "Pano" }).count())) {
        await app.keyboard.press("Escape");
        await app.getByRole("dialog", { name: "Pano" }).waitFor({ state: "detached" });
      }
    }
    assert.ok((await over()) <= 0, "390 px: no sideways scroll on the Plan");
    // v82: a category open, its intents one under another (the stays, Belgeler ve internet), never wider than the page.
    for (const id of ["stay", "other"]) {
      const sec = app.locator(`.q-sec[data-section="${id}"]`);
      if (!(await sec.evaluate((el) => el.classList.contains("open")))) await sec.locator(".q-tt").click();
      await sec.locator(".q-fold.settled").waitFor();
      assert.ok((await over()) <= 0, `390 px: no sideways scroll with ${id} open`);
    }
    // B6: the route strip is gone from the Plan (bu sürümde arayüzden düştü).
    const strip = app.locator(".ts-strip").first();
    if (await strip.count()) assert.ok(await strip.evaluate((el) => el.scrollWidth >= el.clientWidth), "the shape strip scrolls inside itself");
    console.log("✓ 390 px: no sideways scroll (Plan views, a category open)");
  } finally {
    await narrow.close();
  }
}
