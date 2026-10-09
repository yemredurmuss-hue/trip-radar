// Loads the built extension in Chromium and checks the page reader, the capture queue and the board.
// Usage: npm run build && xvfb-run -a node scripts/e2e.mjs   (screenshots go to e2e-output/)
import { build } from "esbuild";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

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
const HEADLESS_ARGS = process.env.E2E_HEADED ? [] : ["--headless=new"];

// The sample trip's dates are fixed (8–14 October 2026): the pages read the calendar as on 5 October, so the
// run doesn't change with the day it's run on (it broke on 6 October: a free cancellation "past"). Time flows on.
const frozen = (ctx) => ctx.clock.install({ time: new Date("2026-10-05T10:00:00") });
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
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
  await app.getByText("İlk seçeneğini kaydet").waitFor();
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
  // The hero (v9, docs/superpowers/specs/2026-10-05-hero-v9-design.md): a photo per city with a switcher and the
  // countdown on it, the title, the dates, one sentence, the plan in four cells, "Rezervasyonların", and the card.
  const hero = app.locator(".hx");
  const flat = (texts) => texts.map((t) => t.replace(/\s+/g, " ").trim());
  // Aşamalar (lifecycle.ts): the box says "Planlananların %X'i rezerve" over "N ihtiyaç karar bekliyor · M rezerve
  // edilecek"; the bar's label names every number. Read off the page and compared with the list it opens: the same
  // needs, so the same counts (one screen once showed three different "karar" counts). A heading counts needs; its
  // rows can be more (one per person).
  const heroNumbersOnPage = async () => {
    const head = flat([await app.locator(".hx .hx-progress-head > b").innerText()])[0];
    const meta = flat([await app.locator(".hx .hx-progress-meta").innerText()])[0];
    const label = await app.locator(".hx .hx-bar").getAttribute("aria-label");
    const of = (text, words) => Number(text.match(new RegExp(`(\\d+) ${words}`))?.[1] ?? 0);
    return { head, meta, label, booked: of(label, "rezerve,"), planned: of(label, "planlandı"), open: of(label, "ihtiyaç karar bekliyor"), pct: Number(await app.locator(".hx .hx-bar").getAttribute("aria-valuenow")) };
  };
  const listMatchesHero = async (where) => {
    const s = await heroNumbersOnPage();
    const list = app.locator(".hx + .todo-list");
    const wasOpen = (await list.count()) > 0;
    if (!wasOpen) await app.locator(".hx button.hx-progress-count").click();
    const heads = Object.fromEntries(flat(await list.locator(".todo-head").allInnerTexts()).map((t) => [t.replace(/ \d+$/, ""), Number(t.match(/(\d+)$/)[1])]));
    const rows = (label) => list.locator(".todo-group", { has: app.locator(".todo-head", { hasText: label }) }).locator("li").count();
    const said = JSON.stringify({ ...s, heads });
    assert.equal(heads["Karar bekliyor"] ?? 0, s.open, `${where}: the needs waiting for a decision, in the box and the list (${said})`);
    assert.equal(heads["Rezerve edilecek"] ?? 0, s.planned, `${where}: the needs planned in the box are "Rezerve edilecek" in the list (${said})`);
    assert.ok((heads["Belge eksik"] ?? 0) <= s.booked, `${where}: "Belge eksik" is some of what's booked (${said})`);
    // The words say the same numbers.
    if (s.open) assert.ok(`${s.head} ${s.meta}`.includes(`${s.open} ihtiyaç karar bekliyor`), `${where}: "N ihtiyaç karar bekliyor" (${said})`);
    if (s.planned) assert.ok(s.meta.includes(`${s.planned} rezerve edilecek`), `${where}: "N rezerve edilecek" (${said})`);
    for (const label of ["Karar bekliyor", "Rezerve edilecek", "Belge eksik"]) assert.ok((await rows(label)) >= (heads[label] ?? 0), `${where}: a row at least per need under ${label}`);
    if (!wasOpen) await app.locator(".hx button.hx-progress-count").click();
    return { ...s, heads };
  };
  assert.deepEqual(await hero.locator(".hx-cities button").allInnerTexts(), ["Porto", "Lizbon"]);
  assert.match(await hero.locator(".hx-count").innerText(), /^(\d+ gün kaldı|Yarın|\d+\. gün \/ 7|Bitti)$/);
  assert.equal(flat([await hero.locator(".hx-when").innerText()])[0], "8–14 Ekim · 7 gün");
  // The plan in four cells: icon, number, name; each a button to its section. The numbers are what the Plan's
  // sections hold (each header's "x/y": y; an idea section's "N fikir"), so they always agree: deneyim is
  // Etkinlikler + Yapılacak + Restoranlar.
  const sectionTotal = async (...ids) => {
    let n = 0;
    for (const id of ids) {
      const count = app.locator(`.cat-sec[data-section="${id}"] .cat-count`);
      const ideas = app.locator(`.cat-sec[data-section="${id}"] .cat-ideas`);
      if (await count.count()) n += Number((await count.innerText()).replace(/\s/g, "").split("/")[1]);
      else if (await ideas.count()) n += Number((await ideas.innerText()).match(/^\d+/)[0]);
    }
    return n;
  };
  await app.locator(".cat-sec .cat-count").first().waitFor();
  const tallyWant = [
    `${await sectionTotal("flight")} uçuş`,
    `${await sectionTotal("stay")} konaklama`,
    `${await sectionTotal("transport")} ulaşım`,
    `${await sectionTotal("activity", "todo", "food")} deneyim`,
  ];
  assert.deepEqual(flat(await hero.locator(".hx-tally button").allInnerTexts()), tallyWant);
  assert.deepEqual(tallyWant.slice(0, 2), ["2 uçuş", "2 konaklama"]);
  assert.ok(Number(tallyWant[3].split(" ")[0]) >= 4, "every activity and restaurant on the Plan counts, chosen or not");
  // The box counts the stages, so no sentence of counts above it ("3 karar ve 1 rezervasyon bekliyor" said another 3).
  assert.equal(await hero.locator(".hx-lead").count(), 0, "no second set of numbers in the lead");
  // The hero's % (spec aşamalar): over what's planned only, (Rezerve + Hazır) ÷ (Planlandı + Rezerve + Hazır); what
  // waits for a decision is a count beside it. The sample: 2 booked, the boat tour planned, 7 decisions to make.
  // The ideas (Yapılacak şeyler, Restoranlar, İlham) have no "3/4" and are never needs (0.35.3).
  assert.equal(await app.locator('.cat-sec[data-section="todo"] .cat-count, .cat-sec[data-section="food"] .cat-count').count(), 0, "an idea section has no x/y");
  const atStart = await listMatchesHero("the sample");
  console.log(`  hero: ${atStart.head} · ${atStart.meta}`);
  assert.deepEqual([atStart.booked, atStart.planned, atStart.open], [2, 1, 7], JSON.stringify(atStart));
  assert.equal(atStart.pct, Math.round((atStart.booked / (atStart.booked + atStart.planned)) * 100));
  assert.equal(atStart.head, `Planlananların %${atStart.pct}'si rezerve`);
  assert.equal(atStart.meta, "7 ihtiyaç karar bekliyor · 1 rezerve edilecek", JSON.stringify(atStart));
  assert.deepEqual([atStart.heads["Karar bekliyor"], atStart.heads["Rezerve edilecek"], atStart.heads["Belge eksik"]], [7, 1, 2]);
  // The transfers nobody said anything about are asked apart, outside the stages.
  assert.ok(atStart.heads["Ulaşım · nasıl gidilecek"] > 0, `the transfers' own group (${JSON.stringify(atStart.heads)})`);
  // The bar: one progressbar, the planned set in two tones from the left, booked (dark) inside it (light, whole).
  const planBar = hero.locator(".hx-bar");
  assert.equal(await planBar.getAttribute("role"), "progressbar");
  assert.equal(await planBar.getAttribute("aria-label"), `${atStart.head}: 2 rezerve, 1 planlandı, 7 ihtiyaç karar bekliyor`);
  const fills = await planBar.evaluate((el) => {
    const of = (sel) => {
      const i = el.querySelector(sel);
      const cs = getComputedStyle(i);
      return { width: parseFloat(i.style.width), left: cs.left, paint: `${cs.backgroundColor} ${cs.backgroundImage}` };
    };
    return { booked: of(".hx-bar-booked"), planned: of(".hx-bar-planned"), count: el.children.length };
  });
  assert.equal(fills.count, 2, "two fills");
  assert.ok(Math.abs(fills.booked.width - (2 / 3) * 100) < 0.1, `the dark fill is what's booked of the planned set (${JSON.stringify(fills)})`);
  assert.equal(fills.planned.width, 100, "the light fill is the whole planned set");
  assert.ok(fills.booked.left === "0px" && fills.planned.left === "0px", "both start from the left");
  assert.notEqual(fills.booked.paint, fills.planned.paint, "two tones");
  assert.equal(flat([await hero.locator(".hx-go").innerText()])[0], "Planı tamamla");
  assert.match(await hero.locator(".hx-go").getAttribute("title"), /^\S.*: \S/); // the next step in words ("Karar ver: …", "Lisboa Loft: ücretsiz iptal …")
  const side = hero.locator(".hx-side");
  // Who goes: two adults read from the saves (the sample isn't shared: no names, no invite).
  assert.equal(await side.locator(".hx-avatars i").count(), 2);
  assert.equal(await side.locator(".hx-who-text b").innerText(), "2 kişi");
  // A tap says who goes (0.37, part 5 below); the sample can't be shared, so no "Birini davet et" under it.
  assert.equal(await side.locator("button.hx-people").count(), 1, "who goes opens its box");
  assert.equal(await side.locator(".hx-who-text small").count(), 0, "the sample trip can't be shared");
  // The style: no model key here, so only the budget's word (€1.500 for 2 people, 7 days ≈ €107 a day each).
  assert.deepEqual(await side.locator(".hx-styles span").allInnerTexts(), ["Orta bütçe"]);
  assert.match(flat([await side.locator(".hx-countries").innerText()])[0], /^🇵🇹 ?Portekiz$/);
  // The small things in one row: money (its rate on hover), plug, time, language.
  assert.equal(flat([await side.locator(".hx-minis").innerText()])[0], "Euro C/F priz −2 saat Portekizce");
  assert.match(await side.locator(".hx-minis span", { hasText: "Euro" }).getAttribute("title"), /^€1 = ₺/);
  await side.locator(".hx-prefs .hx-h", { hasText: "Tercihler" }).waitFor();
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
  // 0.35.4: a few tags, one topic each, never wider than the card; the level on hover, the details in the window.
  const prefTags = side.locator(".hx-ptag");
  await prefTags.filter({ hasText: "Odada mutlaka bir…" }).waitFor();
  assert.deepEqual(flat(await prefTags.allInnerTexts()).sort(), ["Odada mutlaka bir…", "Sessizlik"]);
  assert.equal(await prefTags.filter({ hasText: "Sessizlik" }).getAttribute("title"), "Sessizlik · Önemli");
  const sideBox = await side.boundingBox();
  for (const b of await prefTags.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) assert.ok(b <= sideBox.x + sideBox.width, "a tag stays inside the card");
  await side.locator(".hx-prefs-link").click();
  await side.locator(".hx-prefs-pop li", { hasText: "uzaktan çalışacağız ve iyi internet şart" }).waitFor(); // the full text stays in the window
  await app.mouse.click(5, 5);
  await side.locator(".hx-prefs-pop").waitFor({ state: "detached" });
  await hero.scrollIntoViewIfNeeded();
  await app.waitForTimeout(1500); // the city photos come from Wikipedia
  await app.mouse.move(0, 0); // no hover left on a cell from the clicks before
  // The card ends level with "Rezervasyonların" (the grid row stretches it; its blocks spread), and nothing in it
  // is clipped: its content is no taller than the story.
  const heroBox = () =>
    app.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const card = document.querySelector(".hx-side");
      const content = [...card.children].reduce((n, c) => n + c.getBoundingClientRect().height, 0);
      return { card: box(".hx-side").bottom, progress: box(".hx-progress").bottom, overflow: card.scrollHeight - card.clientHeight, content, inner: card.clientHeight };
    });
  const aligned = await heroBox();
  assert.ok(Math.abs(aligned.card - aligned.progress) <= 2, `1440: the card ends level with the progress box (${JSON.stringify(aligned)})`);
  assert.ok(aligned.overflow <= 0, "nothing in the card is clipped");
  // The plan line: one row of four at 1440, each cell one line, in Turkish and with the widest English labels.
  const tallyRow = () =>
    app.evaluate(() => {
      const cells = [...document.querySelectorAll(".hx-tally button")];
      const tops = new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)));
      const lines = cells.map((c) => {
        const span = c.querySelector("span");
        return span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight === "normal" ? `${parseFloat(getComputedStyle(span).fontSize) * 1.25}` : getComputedStyle(span).lineHeight);
      });
      const row = document.querySelector(".hx-tally");
      return { rows: tops.size, lines, spill: row.scrollWidth - row.clientWidth };
    });
  const trRow = await tallyRow();
  assert.equal(trRow.rows, 1, "1440 TR: the four cells in one row");
  assert.ok(trRow.lines.every((n) => n < 1.5), `1440 TR: every cell on one line (${trRow.lines})`);
  assert.ok(trRow.spill <= 0, "1440 TR: the row fits");
  const withLabels = (labels) =>
    app.evaluate((ls) => {
      const spans = [...document.querySelectorAll(".hx-tally button span")];
      const before = spans.map((s) => s.textContent);
      spans.forEach((s, n) => (s.textContent = ls[n]));
      return before;
    }, labels);
  // English, the widest realistic: two-digit counts (the board's own EN words, TripHero.tsx).
  const trLabels = await withLabels(["12 flights", "12 stays", "12 transport", "12 experiences"]);
  const enRow = await tallyRow();
  await withLabels(["12 uçuş", "12 konaklama", "12 ulaşım", "12 deneyim"]);
  const trWide = await tallyRow();
  await withLabels(trLabels);
  assert.equal(enRow.rows, 1, "1440 EN (12 experiences): one row");
  assert.ok(enRow.lines.every((n) => n < 1.5) && enRow.spill <= 0, `1440 EN: every cell on one line, the row fits (${JSON.stringify(enRow)})`);
  assert.ok(trWide.rows === 1 && trWide.lines.every((n) => n < 1.5) && trWide.spill <= 0, `1440 TR (12 konaklama): one row, one line each (${JSON.stringify(trWide)})`);
  // The style words (hero fix 2): the two longest styles share one line in the card, the budget's word may go under
  // them, and no chip is cut. Measured on a copy of the row with the longest Turkish and English words, at the card's
  // own width and at 272 px (the card beside the open chat on Emre's ~1455 px window, where "Romantic" and
  // "Adventure" broke into two lines in 0.35.3).
  const styleRow = (labels, width) =>
    app.evaluate(({ ls, w }) => {
      const row = document.querySelector(".hx-side .hx-styles");
      const copy = row.cloneNode(true);
      const template = row.querySelector("span");
      copy.replaceChildren(
        ...ls.map((l) => {
          const chip = template.cloneNode(true);
          chip.lastChild.nodeValue = l;
          return chip;
        }),
      );
      if (w) copy.style.width = `${w}px`;
      row.after(copy);
      const box = copy.getBoundingClientRect();
      const chips = [...copy.children].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), right: c.getBoundingClientRect().right, cut: c.scrollWidth > c.clientWidth + 1, h: c.getBoundingClientRect().height, font: getComputedStyle(c).fontSize }));
      copy.remove();
      return { width: Math.round(box.width), chips, right: box.right };
    }, { ls: labels, w: width });
  const checkStyles = async (where) => {
    for (const labels of [["Gastronomi", "Romantik", "Yüksek bütçe"], ["Eğlence", "Gastronomi", "Orta bütçe"], ["Nightlife", "Adventure", "High budget"], ["Adventure", "Romantic", "Mid-range"]]) {
      for (const width of [null, 272]) {
        const r = await styleRow(labels, width);
        const at = `${where}${width ? ` (${width} px card)` : ` (${r.width} px card)`} ${labels.join(" + ")}`;
        assert.equal(r.chips[0].top, r.chips[1].top, `${at}: the two styles on one line (${JSON.stringify(r)})`);
        assert.ok(r.chips.every((c) => !c.cut && c.right <= r.right + 1), `${at}: no chip cut or out of the card`);
        assert.ok(r.chips.every((c) => c.font === "14px" && Math.round(c.h) === 34), `${at}: 14 px words, 34 px chips`);
      }
    }
  };
  await checkStyles("1440");
  await app.screenshot({ path: `${out}/2b-hero.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await hero.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/2d-hero-narrow.png` });
  const heroLines = ".hx-tally span, .hx-progress-head, .hx-progress-meta, .hx-when, .hx-who-text b, .hx-styles span, .hx-budget-line, .hx-ptag, .hx-minis span, .hx-weather > span, .card-alert";
  assert.deepEqual(await uncut(heroLines), [], "the hero's lines and a card's warning wrap, never cut");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow hero");
  // Nothing runs out of its cell: a plan cell's label (two by two until there's room for four), and the small
  // things with the longest real names (Switzerland's languages, the UAE's money), wrapped inside their cell.
  const spilled = () =>
    app.evaluate(() => {
      const out = [];
      const outside = (el, box) => {
        const r = box.getBoundingClientRect();
        return [...el.querySelectorAll("*")].some((c) => {
          const k = c.getBoundingClientRect();
          return k.width > 0 && (k.left < r.left - 1 || k.right > r.right + 1);
        });
      };
      for (const b of document.querySelectorAll(".hx-tally button")) if (b.scrollWidth > b.clientWidth + 1 || outside(b, b)) out.push(b.textContent);
      const minis = document.querySelector(".hx-minis");
      const texts = [...minis.querySelectorAll(":scope > span")].map((s) => s.lastChild);
      const before = texts.map((t) => t.nodeValue);
      texts[0].nodeValue = "Birleşik Arap Emirlikleri Dirhemi";
      texts.at(-1).nodeValue = "Almanca, Fransızca, İtalyanca";
      // The text itself, measured (a row's first divider sits outside the card on purpose, hidden).
      const box = minis.parentElement.getBoundingClientRect();
      for (const t of texts) {
        const range = document.createRange();
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (t.parentElement.scrollWidth > t.parentElement.clientWidth + 1 || r.left < box.left - 1 || r.right > box.right + 1) out.push(t.nodeValue);
      }
      texts.forEach((t, n) => (t.nodeValue = before[n]));
      return out;
    });
  assert.deepEqual(await spilled(), [], "narrow: every hero cell's text stays inside it");
  await app.setViewportSize({ width: 1280, height: 800 });
  await hero.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/2h-hero-1280.png` });
  assert.deepEqual(await spilled(), [], "1280 px: every hero cell's text stays inside it");
  await checkStyles("1280");
  const at1280 = await heroBox();
  console.log(`  1280: card bottom ${at1280.card.toFixed(1)}, progress bottom ${at1280.progress.toFixed(1)}`);
  assert.ok(Math.abs(at1280.card - at1280.progress) <= 2, `1280: the card ends level with the progress box (${JSON.stringify(at1280)})`);
  // The box keeps the height it had (0.36.30: 53 px of words and bar over the button): "Planlama %N" and the bar
  // share a line, the three stages one line under them.
  const progressRow = () =>
    app.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      const [title, bar, meta, main] = [r(".hx-progress-head > b"), r(".hx-progress .hx-bar"), r(".hx-progress-meta"), r(".hx-progress-main")];
      const barBeside = bar.left > title.right && Math.abs(bar.top + bar.height / 2 - (title.top + title.height / 2)) < 3;
      return { oneLine: barBeside && meta.height < 30 && meta.top >= title.bottom, main: Math.round(main.height), box: Math.round(r(".hx-progress").height) };
    });
  const row1280 = await progressRow();
  assert.ok(row1280.oneLine && row1280.main <= 53, `1280: the bar beside the headline, the stages one line under, no taller than before (${JSON.stringify(row1280)})`);
  await app.locator(".hx").screenshot({ path: `${out}/28a-hero-planned.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  const row1440 = await progressRow();
  // 1440 beside the chat: the button beside the words leaves them less room, so the bar may go under the headline
  // and the stages take two lines; the box still no taller than at 1280 (where the button is under it).
  assert.ok(row1440.main <= 100 && row1440.box <= row1280.box, `1440: the headline, the bar and the stages in four short lines at most (${JSON.stringify({ row1280, row1440 })})`);
  assert.deepEqual(await spilled(), [], "1440 px: every hero cell's text stays inside it");
  await putNote(null);
  await prefTags.filter({ hasText: "Odada mutlaka bir…" }).waitFor({ state: "detached" });
  await app.getByText("Jardim Stay").first().waitFor();
  // 0.34: the Plan by category — a section per kind in this order (the empty ones are chips at the bottom),
  // each a timeline of its blocks: the day on the left, the cards on the right.
  assert.equal(await app.locator(".day-strip").count(), 0, "no band of nights");
  const sec = (id) => app.locator(`.cat-sec[data-section="${id}"]`);
  assert.deepEqual(await app.locator(".cat-sec").evaluateAll((els) => els.map((e) => e.getAttribute("data-section"))), ["flight", "stay", "transport", "activity", "todo", "other"]);
  // v11: the restaurant is drawn under Yapılacak şeyler, so no section of the sample is left as a chip.
  assert.deepEqual(await app.locator(".cat-more .cat-chip").allInnerTexts(), []);
  assert.deepEqual((await sec("stay").locator(".cat-date").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")), ["8 Eki Per Porto", "11 Eki Paz Lizbon"]);
  // kategoriler-v4: one white sheet, the sections divided by hairlines, no tint of their own. An open header:
  // icon, name and under it its needs in stage words (v11: "1 rezerve · 2 seçildi · 1 aranıyor"), "+ Ekle", the bar of
  // settled of all, "0/4", the arrow.
  assert.equal(await app.locator(".cat-plan .cat-sheet").count(), 1);
  assert.equal(await sec("activity").evaluate((el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)", "no tinted section");
  assert.equal(await app.locator(".cat-tile, .cat-state").count(), 0, "no icon tiles, no status pills");
  assert.match(await sec("activity").locator(".cat-head").innerText(), /^Etkinlik ve turlar\s*[^\n]*\s*Ekle\s*0\/4$/);
  assert.equal(await sec("activity").locator(".cat-st").innerText(), "1 seçildi · 3 aranıyor");
  assert.match(await sec("flight").locator(".cat-head").innerText(), /^Uçuş\s*[^\n]*\s*Ekle\s*1\/2$/);
  assert.equal(await sec("flight").locator(".cat-st").innerText(), "1 rezerve · 1 aranıyor");
  assert.equal(await app.locator(".cat-wait").count(), 0, "no amber line: the stage line says it");
  assert.equal(await sec("flight").locator(".cat-bar > span").evaluate((el) => el.style.width), "50%");
  // No page-bottom lists: what's out of the way waits at the end of its own section.
  assert.equal(await app.locator(".row-name", { hasText: /Kapanan seçenekler|Elenenler|Gizlenenler/ }).count(), 0, "no page-bottom hidden blocks");
  await app.locator(".stay-block.booked", { hasText: "Lisboa Loft" }).waitFor();
  const hiddenLink = (id) => sec(id).locator(".cat-hidden-link button");
  assert.equal(await sec("stay").locator(".cat-hidden-link").innerText(), "Gizlenenler · 1 göster");
  await hiddenLink("stay").click();
  assert.match(await sec("stay").locator(".cat-hidden-row.closed").innerText(), /Alfama Suites[\s\S]*Lisboa Loft rezervasyonu bu geceleri kapsıyor/);
  await hiddenLink("stay").click();
  await sec("stay").locator(".cat-hidden-rows").waitFor({ state: "detached" });
  assert.equal(await app.locator(".stay-block", { hasText: "Alfama Suites" }).count(), 0, "a booking closes its alternatives");
  // A block for each thing, in its section: the flights in and home, the stays, the train, the boat tour.
  const kinds = await app.locator(".cat-card").evaluateAll((els) => els.map((e) => `${e.closest(".cat-sec").dataset.section}:${[...e.classList].find((c) => c.startsWith("tl-")) ?? "item"}`));
  assert.deepEqual(kinds, ["flight:tl-travel", "flight:tl-travel", "stay:tl-stay", "stay:tl-stay", "transport:tl-travel", "activity:tl-event", "activity:item", "activity:item", "activity:item", "other:item"]);
  // The restaurant is a row of the ideas' list, not a card (0.35.3); v11: under Yapılacak şeyler.
  assert.equal(await sec("todo").locator(".il-row").count(), 1);
  // No days, no check-in lines, no transfers without a plan.
  assert.equal(await app.locator(".cat-plan .tl-day, .cat-plan .leg, .cat-plan .pk-leg").count(), 0);
  // The itinerary, a tab away (0.34.7): a card a day (its photo, its title, the whole day as a timeline, check-in
  // and transfers too; free days in a row are one card). One switch, Liste | Kartlar (0.34.8): Kartlar shows
  // every day as the Plan's cards under a header that stays on top; no day opens or closes on its own.
  const tab = (name) => app.getByRole("tab", { name, exact: true });
  await tab("Gün gün").click();
  const dcMode = (name) => app.locator(".dc-seg").getByRole("tab", { name, exact: true });
  const listMode = () => dcMode("Liste").click();
  // A day is the same section in both views (its header, then its lines): .list in Liste, .cards in Kartlar.
  const dayCard = (n) => app.locator(".dc-cday.list", { has: app.locator(".dc-pill", { hasText: new RegExp(`^${n}\\. gün$`) }) });
  const cardsDay = (n) => app.locator(".dc-cday.cards", { has: app.locator(".dc-pill", { hasText: new RegExp(`^${n}\\. gün$`) }) });
  let dayPage = cardsDay(1);
  // A day as cards: Kartlar, then that day's section (the strip jumps there).
  const openDay = async (n) => {
    await dcMode("Kartlar").click();
    dayPage = cardsDay(n);
    await app.locator(".dc-strip").getByRole("button", { name: String(n), exact: true }).click();
    await dayPage.waitFor();
  };
  const dayTitles = () => dayPage.locator(".dc-tl > [data-title]").evaluateAll((els) => els.map((e) => e.getAttribute("data-title")));
  const dayTimes = () => dayPage.locator(".dc-tl > li").evaluateAll((els) => els.map((e) => e.querySelector(".t")?.textContent ?? ""));
  // A line by its title in the standard (NE · HANGİSİ, dayRowTitle.ts); the nth when two read the same ("Transfer").
  const flowCard = (title, nth = 0) => dayPage.locator(`.dc-tl > li[data-title="${title}"]`).nth(nth);
  const flowTime = (title) => flowCard(title).locator("> .t");
  // Open, a line is its Plan card: a tap on its body opens its details there.
  const openCard = (title, nth = 0) => flowCard(title, nth).locator(".pk-body").first().click();
  assert.deepEqual(await app.locator(".dc-pill").allInnerTexts(), ["1. gün", "2. gün", "3. gün", "4. gün", "5–6. gün", "7. gün"]);
  assert.deepEqual(await app.locator(".dc-strip button").allInnerTexts(), ["1", "2", "3", "4", "5–6", "7"]);
  // Liste as Emre's reference: a card a day, its photo on the left with "N. gün" on it, the title, the hours.
  assert.equal(await app.locator(".dc-raillab").count(), 0, "no rail in the list");
  // Standard titles by the code (0.35.5): "Porto 1. Gün" and the kind of day beside it; the route under it.
  assert.deepEqual(flat(await app.locator(".dl-head .ttl").allInnerTexts()), ["Porto 1. Gün Varış", "Porto 2. Gün", "Porto 3. Gün Boş gün", "Lizbon 4. Gün Yolculuk", "Lizbon 5–6. Gün Boş günler", "Lizbon 7. Gün Dönüş"]);
  await dayCard(4).locator(".dl-date", { hasText: "Porto → Lizbon" }).waitFor();
  const photoBox = await dayCard(4).locator(".dl-photo").boundingBox();
  const bodyBox = await dayCard(4).locator(".dl-body").boundingBox();
  assert.ok(photoBox.x < bodyBox.x && Math.abs(photoBox.height - bodyBox.height) < 1, "the photo on the left, as tall as the day");
  // Every line the same (satır standardı v2): NE · HANGİSİ by the code ("Tren · Porto → Lizbon", never a code), a
  // check-out like a train, each with its icon, the same height; no dot, no dotted line.
  const lines = await dayCard(4).locator(".dc-tl > .dc-step").evaluateAll((els) => els.map((e) => [e.dataset.title, !!e.querySelector(".dc-tile svg"), Math.round(e.getBoundingClientRect().height)]));
  assert.deepEqual(lines.map(([t]) => t), ["Check-out · Porto konaklaması", "Transfer", "Tren · Porto → Lizbon", "Transfer", "Check-in · Lisboa Loft"]);
  assert.ok(lines.every(([, icon]) => icon), "every line has its icon");
  assert.equal(new Set(lines.map(([, , h]) => h)).size, 1, `every line the same height (${lines.map(([, , h]) => h)})`);
  assert.deepEqual(
    await dayCard(4).locator(".dc-tl > .dc-step").evaluateAll((els) => els.map((e) => e.querySelector(".name small")?.textContent ?? "")),
    // Short (0.36.27): the route the title says and a worked-out time's reason aren't repeated; two pieces at most.
    ["yer seçilmedi", "planlanmadı", "varış 16:04 · 1 seçenek", "planlanmadı", "3 gece"],
  );
  // 0.36.13: a worked-out time says where it comes from, on its grey line (the lines stay one height).
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
  const loftIn = dayCard(4).locator('.dc-tl > li[data-title="Check-in · Lisboa Loft"]');
  await loftIn.locator(".t .t-hint", { hasText: "varıştan sonra" }).waitFor();
  // Why it has no clock: on the time, on hover (the list's grey line stays short, 0.36.27).
  assert.match(await loftIn.locator("> .t").getAttribute("title"), /varış saati yok/);
  await dayCard(4).getByRole("button", { name: "Varış saati?" }).click();
  const arriveBox = dayCard(4).getByRole("textbox", { name: /varış saati/ }).or(dayCard(4).locator('.dc-arrive input[type="time"]'));
  await arriveBox.fill("16:04");
  await arriveBox.blur();
  await app.waitForFunction(() => [...document.querySelectorAll('.dc-cday.list li[data-title="Check-in · Lisboa Loft"] > .t')].some((t) => t.textContent === "~17:14"), null, { timeout: 10000 });
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
  assert.equal(await dayCard(4).locator(".dc-tl .dot").count(), 0, "no dot on a line of the list");
  assert.equal(await dayCard(4).locator(".dc-tl").evaluate((el) => getComputedStyle(el, "::before").display), "none", "no dotted line");
  assert.equal(await app.locator(".dc-cday .dc-free").count(), 2);
  await dayCard(7).locator('.dc-step[data-title="Uçuş · Lizbon → İstanbul"]').locator(".dc-tile i.done").waitFor();
  assert.equal(await dayCard(7).locator('.dc-step[data-title="Uçuş · Lizbon → İstanbul"] .name small').innerText(), "varış 01:35 (+1) · TP 1760"); // short (0.36.27): the airports the title says aren't repeated
  // Closed, nothing is folded: check-out, the transfer to the airport, the flight.
  assert.deepEqual(await dayCard(7).locator(".dc-tl > [data-title]").evaluateAll((els) => els.map((e) => e.getAttribute("data-title"))), ["Check-out · Lisboa Loft", "Havalimanı transferi", "Uçuş · Lizbon → İstanbul"]);
  // 0.35.6: a line without a time is moved by its grip (drag, or ↑ ↓); the day keeps that order, in both views.
  const day1 = () => dayCard(1).locator(".dc-tl > li").evaluateAll((els) => els.map((e) => e.dataset.title));
  assert.deepEqual(await day1(), ["Uçuş · İstanbul → Porto", "Havalimanı transferi", "Check-in · Porto konaklaması"]);
  const checkIn = dayCard(1).locator('.dc-tl > li[data-title="Check-in · Porto konaklaması"]');
  // The grip shows on hover only.
  await app.mouse.move(1, 1);
  await app.waitForFunction((el) => getComputedStyle(el).opacity === "0", await checkIn.locator(".dc-grip").elementHandle());
  await checkIn.hover();
  await app.waitForFunction((el) => getComputedStyle(el).opacity === "1", await checkIn.locator(".dc-grip").elementHandle());
  await checkIn.locator(".dc-grip").dragTo(dayCard(1).locator('.dc-tl > li[data-title="Uçuş · İstanbul → Porto"]'), { targetPosition: { x: 200, y: 4 } });
  await app.waitForFunction(() => document.querySelector(".dc-cday.list .dc-tl > li")?.getAttribute("data-title") === "Check-in · Porto konaklaması");
  assert.deepEqual(await day1(), ["Check-in · Porto konaklaması", "Uçuş · İstanbul → Porto", "Havalimanı transferi"]);
  await dcMode("Kartlar").click();
  assert.deepEqual(await cardsDay(1).locator(".dc-tl > li").evaluateAll((els) => els.map((e) => e.dataset.title)), ["Check-in · Porto konaklaması", "Uçuş · İstanbul → Porto", "Havalimanı transferi"]);
  await listMode();
  // Back down with the keyboard, one step at a time.
  await checkIn.locator(".dc-grip").focus();
  await app.keyboard.press("ArrowDown");
  await app.waitForFunction(() => document.querySelector(".dc-cday.list .dc-tl > li")?.getAttribute("data-title") === "Uçuş · İstanbul → Porto");
  await checkIn.locator(".dc-grip").focus();
  await app.keyboard.press("ArrowDown");
  await app.waitForFunction(() => [...document.querySelectorAll(".dc-cday.list")][0].querySelector(".dc-tl > li:last-child")?.getAttribute("data-title") === "Check-in · Porto konaklaması");
  assert.deepEqual(await day1(), ["Uçuş · İstanbul → Porto", "Havalimanı transferi", "Check-in · Porto konaklaması"]);
  // A line with a time moves too (0.35.10): it stays where it's dropped, its time hidden; "×" puts it back on its time.
  const day7 = () => dayCard(7).locator(".dc-tl > li").evaluateAll((els) => els.map((e) => `${e.querySelector(".t")?.textContent} ${e.dataset.title}`));
  assert.deepEqual(await day7(), ["~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi", "19:40 Uçuş · Lizbon → İstanbul"]);
  const flight7 = dayCard(7).locator('.dc-tl > li[data-title="Uçuş · Lizbon → İstanbul"]');
  await flight7.hover();
  await flight7.locator(".dc-grip").dragTo(dayCard(7).locator('.dc-tl > li[data-title="Check-out · Lisboa Loft"]'), { targetPosition: { x: 200, y: 4 } });
  await flight7.locator("button.t.freed").waitFor();
  // Untimed, the cell is blank.
  assert.deepEqual(await day7(), [" Uçuş · Lizbon → İstanbul", "~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi"]);
  assert.match(await flight7.locator("button.t").getAttribute("title"), /Elle taşındı \(saati 19:40\)/);
  await flight7.locator("button.t").click();
  assert.equal(await flight7.locator('input[type="time"]').inputValue(), "19:40");
  await flight7.getByRole("button", { name: "×" }).click();
  await flight7.locator("button.t.freed").waitFor({ state: "detached" });
  assert.deepEqual(await day7(), ["~11:00 Check-out · Lisboa Loft", "~15:40 Havalimanı transferi", "19:40 Uçuş · Lizbon → İstanbul"]);
  await app.screenshot({ path: `${out}/3e-itinerary.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await dayCard(4).scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-itinerary-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in the list");
  await app.setViewportSize({ width: 1440, height: 900 });
  await openDay(4);
  // Kartlar as the trip goes: arrival, Porto's days, the move, Lisbon's days, home.
  assert.deepEqual((await app.locator(".dc-raillab b").allInnerTexts()), ["Varış", "2–3. gün", "Yolculuk", "5–6. gün", "Dönüş"]);
  assert.deepEqual(await dayTitles(), ["Check-out · Porto konaklaması", "Transfer", "Tren · Porto → Lizbon", "Transfer", "Check-in · Lisboa Loft"]);
  // A line that isn't a card of its own reads the same in Kartlar: NE in bold, which, the grey line.
  assert.equal(await flowCard("Check-out · Porto konaklaması").locator(".txt").innerText(), "Check-out · Porto konaklaması · yer seçilmedi");
  await openDay(7);
  assert.deepEqual(await dayTimes(), ["~11:00", "~15:40", "19:40"]); // at the airport ideally by 16:40 (leaving Schengen: 3 h), the transfer an hour before
  await flowCard("Uçuş · Lizbon → İstanbul").locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // A time of one's own (dayTimes.ts): kept, a late one warned about in red; "×" gives the worked-out one back.
  const going = flowCard("Havalimanı transferi");
  // Emre: abroad 2 h at the least, 3 h ideally: the time worked out from the ideal, a warning only past the latest.
  assert.match(await going.locator("> button.t").getAttribute("title"), /İdeali 16:40, en geç 17:40 havalimanında; transfer ~1 sa/);
  await going.locator("> button.t").click();
  await going.locator('input[type="time"]').fill("17:00");
  await going.locator(".dc-warn", { hasText: "17:40'ta havalimanında olmalısın" }).waitFor();
  await going.getByRole("button", { name: "×" }).click();
  await going.locator(".dc-warn").waitFor({ state: "detached" });
  assert.equal(await going.locator("> button.t").innerText(), "~15:40");
  await app.screenshot({ path: `${out}/3f-day-page.png` });
  // A line in the list takes you to its card in Kartlar.
  await listMode();
  await dayCard(4).locator(".dc-line", { hasText: "Tren · Porto → Lizbon" }).click();
  await cardsDay(4).locator('.dc-tl > li[data-title="Tren · Porto → Lizbon"]').waitFor();
  assert.equal(await dcMode("Kartlar").getAttribute("aria-selected"), "true");
  await tab("Plan").click();
  // Where each plan stands is on top of its card: booked in green, planned in amber.
  await app.locator(".cat-card.tl-stay .status-bar.st-booked", { hasText: "Rezerve edildi" }).waitFor();
  // Undecided needs are a numbered list, best first: each card with its place and score, what it's
  // strongest on, why it stands there (against the first; the first against the second), a mark per
  // thing asked for, and what speaks for and against it.
  const card = (name) => app.locator(`.swipe-card[aria-label="${name}"]`);
  const stayCard = app.locator(".stay-block .reco-line.headline").first();
  assert.equal(await stayCard.locator("p").innerText(), "Önerim Jardim Stay: en sessiz; 2.'ye göre €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu. Tasarruf için 3. Casa Azul (1.'ye göre €45 daha ucuz).");
  const porto = app.locator(".stay-block.open .option-grid").first();
  assert.deepEqual(await porto.locator(".swipe-card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), ["Jardim Stay", "Ribeira Rooms", "Casa Azul"]);
  assert.deepEqual(await porto.locator(".opt-rank").allInnerTexts(), ["1", "2", "3"]);
  assert.deepEqual(await porto.locator(".opt-score b").allInnerTexts(), ["83", "55", "53"]);
  await card("Jardim Stay").locator(".opt-label", { hasText: "En sessiz" }).waitFor();
  // The site's name is the way to the page: one click, a new tab, the board stays.
  const site = card("Jardim Stay").locator("a.sc-source");
  assert.match(await site.innerText(), /Booking\.com\s*↗$/);
  assert.equal(await site.getAttribute("target"), "_blank");
  assert.match(await site.getAttribute("href"), /^https:\/\/www\.booking\.com\//);
  assert.equal(await card("Jardim Stay").locator(".opt-meta").innerText(), "Otel odası · 8,9 Çok iyi · 1.204 yorum");
  assert.match(await card("Jardim Stay").locator(".sc-price").innerText(), /€285\s*3 gece toplam\s*€95 \/ gece/);
  // Why here: the first against the second, the second against the first.
  assert.match(await card("Jardim Stay").locator(".opt-trade").innerText(), /^2\.'ye göre\s*€45 daha ucuz \(gecelik −€15\) · sessiz odalar, iyi uyku · 3 yorum, 5 Eki'ye kadar ücretsiz iptal, daha konforlu · eksiği: yorumları daha zayıf/);
  assert.match(await card("Ribeira Rooms").locator(".opt-trade").innerText(), /^1\.'ye göre\s*\+€45 \(gecelik \+€15\) · yorumlar daha iyi \(9,2\/10 – 8,9\/10\), odadan nehir manzarası · 3 yorum · eksiği: hafta sonu gece gürültüsü · 3 yorum/);
  // A mark for each thing asked for (the words on hover and in the details), then the pros and cons in full.
  assert.deepEqual(await card("Jardim Stay").locator(".opt-checks .need.yes > span").allInnerTexts(), ["Sessiz"]);
  assert.equal(await card("Jardim Stay").locator(".opt-checks .need.yes").getAttribute("title"), "Sessiz odalar, iyi uyku · 3 yorum");
  assert.deepEqual(await card("Jardim Stay").locator(".sc-col.pros li > span").allInnerTexts(), ["Kahvaltı çok iyi", "Gezeceğin yerlere 6 dk", "Ücretsiz iptal · son gün 5 Ekim"]);
  await card("Jardim Stay").locator(".sc-col.pros li.unique", { hasText: "yalnız bunda" }).waitFor();
  await card("Ribeira Rooms").locator(".sc-col.pros li.unique", { hasText: "Odadan nehir manzarası" }).waitFor();
  assert.match(await card("Jardim Stay").locator(".sc-col.cons li > span").first().innerText(), /^Odalar küçük/);
  // The assistant can't rule a place out on what it read (only the traveller can, 0.28): the construction
  // it would have ruled Casa Azul out on is a thing to check before choosing.
  await card("Casa Azul").locator(".opt-status", { hasText: "Seçmeden kontrol et" }).filter({ hasText: "Yan binada inşaat var; sessiz bir yer istiyorsun" }).waitFor();
  assert.equal(await card("Casa Azul").locator(".opt-status.unfit").count(), 0);
  // The picture sits beside the name; one card a row, wide enough to read.
  const media = await card("Jardim Stay").locator(".opt-img").boundingBox();
  const title = await card("Jardim Stay").locator(".opt-name").boundingBox();
  assert.ok(title.x > media.x + media.width - 1, "the picture sits beside the name");
  const boxes = await porto.locator(".swipe-card").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), width: r.width })));
  assert.ok(boxes.every((b, i) => i === 0 || b.top > boxes[i - 1].top), "best first, top to bottom");
  assert.ok(boxes.every((b) => b.width >= 420), `cards wide enough to read: ${boxes.map((b) => b.width)}`);
  // Flights: one card with ‹ 1/2 ›, the pick and its reasons in the details.
  const pk = (name) => app.locator(`.pk-card[aria-label="${name}"]`);
  const pegasus = pk("Pegasus · direkt");
  assert.match(await pegasus.locator(".pk-foot").innerText(), /2 seçenek[\s\S]*1\/2[\s\S]*Önerim[\s\S]*€\d+[\s\S]*Plana koy/);
  await pegasus.locator(".pk-body").click();
  assert.equal(await pegasus.locator(".pk-why.trade").innerText(), "2.'ye göre+€30 · bagaj dahil, direkt, saatleri daha uygun · eksiği: iade yok, ücretli değişiklik");
  await pegasus.locator(".pk-body").click();
  await pegasus.getByRole("button", { name: "Sonraki seçenek" }).click();
  const tap = pk("TAP · Lizbon aktarmalı");
  await tap.locator(".pk-body").click();
  assert.equal(await tap.locator(".pk-badges").innerText(), "En ekonomik");
  await tap.locator(".pk-body").click();
  await tap.getByRole("button", { name: "Önceki seçenek" }).click();
  // "Planı tamamla" goes to the next step; "2 rezerve · 1 planlandı · …" lists every to-do under the hero in groups
  // (Karar bekliyor and Rezerve edilecek: the box's own needs; then the transfers, then the cancellations), a tap
  // goes there; tapped again, the list closes.
  const todoCount = app.locator(".hx-progress-count");
  const todoList = app.locator(".hx + .todo-list");
  await app.locator(".hx-go").click();
  await app.locator(".flash").first().waitFor();
  await todoCount.click();
  const now = await listMatchesHero("after the comparisons");
  const group = (label) => todoList.locator(".todo-group", { has: app.locator(".todo-head", { hasText: label }) });
  assert.equal(await group("Rezerve edilecek").locator("li", { hasText: "Rezerve et: " }).count(), now.planned, "what's to book under Rezerve edilecek");
  assert.equal(await group("Karar bekliyor").locator("li", { hasText: "Rezerve et: " }).count(), 0, "nothing to book among the decisions");
  // The transfers: "nasıl?", in their own group, never among the decisions the box counts.
  assert.equal(await group("Karar bekliyor").locator("li", { hasText: "transferi" }).count(), 0);
  assert.ok((await group("Ulaşım · nasıl gidilecek").locator("li", { hasText: "transferi" }).count()) >= 4);
  await todoList.locator("button", { hasText: "Porto konaklama · 8–11 Ekim" }).click();
  await app.locator(".tl-stay.flash").waitFor();
  assert.match(await todoList.innerText(), /Varış transferi · 8 Ekim[\s\S]*nasıl\?/);
  await todoCount.click();
  assert.equal(await todoList.count(), 0);
  // Cancellations running out get their own "⏳ N" there (the sample trip is dated, so only when those dates are near).
  // And the money: booked, planned and free a line each against the budget; a tap splits it and adds a guess for what's open.
  const budget = app.locator(".hx-budget");
  assert.match((await budget.innerText()).replace(/\s+/g, " "), /^Bütçe €1\.500 (Rezerve|Planlanan) €\d[\d.]*.* Boşta €923$/);
  await budget.click();
  assert.match(await budget.locator(".hx-pop").innerText(), /Kalan\s*€923[\s\S]*yaklaşık €442 daha eklenir/);
  await budget.click();
  await budget.locator(".hx-pop").waitFor({ state: "detached" });
  // Decided already: the boat tour on the 9th and the flight home.
  const douro = app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douro.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  const home = app.locator(".tl-travel.role-departure .pk-card");
  await home.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // A misclick on "Bileti aldım" can be taken back (in the details), and redone.
  // v11 phase 3: a booking opens its own window; "Rezervasyonu geri al" is there.
  await home.locator(".pk-body").click();
  await app.getByRole("dialog").getByRole("button", { name: "Rezervasyonu geri al" }).click();
  await home.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  await home.getByRole("button", { name: "Bileti aldım" }).click();
  await home.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // Its window: the booking's rows (the flight, from and to with their hours), its files or "Belge eksik · ekle",
  // Değiştir · İptal ettim · Rezervasyonu geri al · Tüm detaylar · Kapat; Esc closes it.
  await home.locator(".pk-body").click();
  const bk = app.locator(".bk-sheet");
  await bk.waitFor();
  assert.match(await bk.locator(".bk-rows").innerText(), /Kalkış[\s\S]*Lizbon LIS[\s\S]*19:40[\s\S]*Varış[\s\S]*İstanbul IST/);
  assert.deepEqual(await bk.locator(".bk-foot button").allInnerTexts(), ["Değiştir", "İptal ettim", "Rezervasyonu geri al", "Tüm detaylar", "Kapat"]);
  await app.screenshot({ path: `${out}/31a-booking-sheet.png` });
  await app.keyboard.press("Escape");
  await bk.waitFor({ state: "detached" });

  // The cities big, the airport codes and hours small; the landing day only because it's the next day.
  assert.match(await home.locator(".pk-mid").innerText(), /Lizbon\s*LIS · 19:40[\s\S]*4 sa 55 dk · direkt[\s\S]*İstanbul\s*IST · 15 Ekim · 01:35/);
  // Opening a card shows its details on the card (0.33: a tap on its picture; its title is edited where it stands).
  await douro.locator(".pk-vis").click();
  await douro.locator(".pk-detail").getByRole("button", { name: "Tüm detaylar" }).waitFor();
  await douro.locator(".pk-vis").click();
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/3-board.png` });

  // "Detaylar" opens the card in place, kept short: where it stands, the facts, what's for and against it.
  await card("Jardim Stay").getByRole("button", { name: "Detaylar ▾" }).click();
  const jardimDetails = card("Jardim Stay").locator(".card-details");
  await jardimDetails.locator(".cd-verdict").waitFor();
  await jardimDetails.locator(".cd-list.needs li.yes", { hasText: "Sessiz: Sessiz odalar, iyi uyku · 3 yorum" }).waitFor();
  assert.match(await jardimDetails.locator(".cd-facts").innerText(), /Tarih\s*8–11 Ekim · 3 gece[\s\S]*Puan\s*8,9 \/ 10 · 1\.204 yorum[\s\S]*İptal/i);
  await jardimDetails.locator(".small-note", { hasText: "5 yorum incelendi (sitede 1.204)" }).waitFor();
  await app.screenshot({ path: `${out}/3-cards.png` });
  await card("Jardim Stay").getByRole("button", { name: "Kapat ▴" }).click();
  await card("Ribeira Rooms").getByRole("button", { name: "Detaylar ▾" }).click();
  await card("Ribeira Rooms").locator(".card-details .cd-list.needs li.no", { hasText: "Hafta sonu gece gürültüsü" }).waitFor();
  await card("Ribeira Rooms").getByRole("button", { name: "Kapat ▴" }).click();

  // The evidence behind a finding is one tap deeper ("Tüm detaylar"), with "sorun değil": the
  // construction then no longer needs checking.
  await card("Casa Azul").getByRole("button", { name: "Detaylar ▾" }).click();
  await card("Casa Azul").locator(".card-details .cd-list.cons li", { hasText: "Kontrol gerekiyor: Yan binada inşaat var; sessiz bir yer istiyorsun" }).waitFor();
  await card("Casa Azul").getByRole("button", { name: "Tüm detaylar" }).click();
  const casaDrawer = app.getByRole("dialog");
  const construction = casaDrawer.locator(".pc-line", { hasText: "Yan binada inşaat gürültüsü" });
  await construction.getByText("3 yorum · en yenisi Eyl 2026", { exact: false }).waitFor();
  await construction.getByRole("button", { name: "Kanıt" }).click();
  await construction.locator("blockquote", { hasText: "Construction next door starts at 8 every morning" }).waitFor();
  await app.screenshot({ path: `${out}/3a-evidence.png` });
  await construction.getByRole("button", { name: "Sorun değil" }).click();
  await casaDrawer.locator(".pc-line.accepted", { hasText: "Yan binada inşaat gürültüsü" }).waitFor();
  await casaDrawer.getByRole("button", { name: "Kapat" }).click();
  await card("Casa Azul").locator(".opt-status", { hasText: "Seçmeden kontrol et" }).waitFor({ state: "detached" });
  await card("Casa Azul").getByRole("button", { name: "Kapat ▴" }).click();
  // How it understood the traveller so far: what they said (incl. "sorun değil"); a pattern in the saved
  // stays is asked about, and counts only after a yes.
  // On the hero's card it's "Tercihler": two rows, "+N tercih ›" (· 1 soru) opens the window over the card.
  const intent = app.locator(".hx-prefs");
  await intent.locator(".hx-prefs-link", { hasText: "1 soru" }).click();
  const guess = intent.locator(".hx-prefs-pop .ask", { hasText: "İptal esnekliği senin için daha mı önemli?" });
  await guess.waitFor();
  await guess.getByRole("button", { name: "Evet" }).click();
  await guess.waitFor({ state: "detached" });
  await intent.locator(".hx-prefs-pop li", { hasText: "ücretsiz iptalli" }).waitFor();
  await intent.locator(".hx-prefs-pop li", { hasText: "Sorun değil: Yan binada inşaat gürültüsü" }).waitFor();
  await intent.locator(".hx-prefs-link").click();
  await intent.locator(".hx-prefs-pop").waitFor({ state: "detached" });
  assert.ok((await intent.locator(".hx-ptag").count()) >= 1, "what was understood, in short tags");
  await app.screenshot({ path: `${out}/3b-card.png` });

  // Comparison: numbers side by side, the weights the user controls, and why.
  await stayCard.getByRole("button", { name: "Karşılaştır →" }).click();
  const compare = app.getByRole("dialog", { name: "Karşılaştırma" });
  // 0.37: stays open on the board (Kartlar): a card per option, its badge, score, price and biggest pros/cons.
  await compare.locator(".cmp-views [role=tab].on", { hasText: "Kartlar" }).waitFor();
  const boardCard = (name) => compare.locator(`.bd-card[aria-label="${name}"]`);
  await boardCard("Jardim Stay").locator(".bd-badge", { hasText: "Önerim" }).waitFor();
  assert.match(await boardCard("Jardim Stay").locator(".bd-score").innerText(), /^\d+\s*puan$/);
  await boardCard("Jardim Stay").locator(".bd-needs .need.yes", { hasText: "Sessiz" }).waitFor(); // what they asked for, checked
  assert.ok((await boardCard("Jardim Stay").locator(".bd-pc li").count()) >= 2, "its biggest pros and cons");
  assert.ok((await compare.locator(".bd-card:not(.bd-add)").count()) >= 2, "every option a card");
  await app.setViewportSize({ width: 1440, height: 1100 });
  await app.screenshot({ path: `${out}/3c-board.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
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
  // The verdict is one line; the rest under "Neden?".
  assert.equal(await compare.locator(".cmp-verdict-detail").count(), 0, "the verdict starts as one line");
  await compare.locator(".cmp-verdict-more").click();
  await compare.getByText("güncellemek için Ayarlar'dan ücretsiz Gemini anahtarı ekle", { exact: false }).waitFor(); // no key yet
  await app.screenshot({ path: `${out}/3c-compare.png`, fullPage: true });
  // Quiet, which they asked for, is its own row now ("Sessizlik: Önemli" from their note). Location and quiet
  // stop mattering and price matters most → the cheaper stay wins, and the view says what would flip it back.
  const quietRow = compare.locator("tr:has(.crit-col > div:text-is('Sessizlik')) select");
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

  await card("Jardim Stay").getByRole("button", { name: "Detaylar ▾" }).click();
  await card("Jardim Stay").getByRole("button", { name: "Tüm detaylar" }).click();
  await app.getByRole("dialog").waitFor();
  await app.locator(".breakdown .score-big").waitFor(); // per-criterion breakdown in the drawer
  await app.screenshot({ path: `${out}/4-drawer.png` });
  await app.getByRole("dialog").getByRole("button", { name: "Plana al", exact: true }).click();
  await app.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();
  await app.getByText("Jardim Stay plana alındı").waitFor();
  // Chosen: the cards fold into one card; a tap on it brings the other options back, ⓘ opens its details.
  const jardimRow = app.locator(".stay-block.chosen .settled-card", { hasText: "Jardim Stay" });
  await jardimRow.locator(".status-bar").getByText("rezerve edilmedi").waitFor();
  assert.equal(await app.locator(".stay-block.chosen .swipe-card").count(), 0);
  // 0.37: the chosen stay's options open on the board ("Seçenekleri karşılaştır"); a tap on the card still unfolds them.
  await jardimRow.getByRole("button", { name: "Seçenekleri karşılaştır (3)" }).click();
  const fromPlan = app.getByRole("dialog", { name: "Karşılaştırma" });
  await fromPlan.locator('.bd-card.chosen[aria-label="Jardim Stay"]').getByRole("button", { name: "✓ Seçili" }).waitFor();
  await fromPlan.getByRole("button", { name: "Kapat" }).click();
  await fromPlan.waitFor({ state: "detached" });
  await jardimRow.locator(".stc-main").click();
  await app.locator(".stay-block.chosen .swipe-card").first().waitFor();
  await card("Jardim Stay").getByRole("button", { name: "Planda ✓" }).waitFor();
  await jardimRow.getByRole("button", { name: "Kapat" }).click();
  assert.equal(await app.locator(".stay-block.chosen .swipe-card").count(), 0);
  await jardimRow.getByRole("button", { name: "Detaylar", exact: true }).click();
  await jardimRow.locator(".stc-details .card-details").waitFor();
  await jardimRow.getByRole("button", { name: "Detaylar", exact: true }).click();
  // "Seç" on a flight card: the flight folds into a line, and its landing time reaches the transfer to the hotel.
  await pk("Pegasus · direkt").getByRole("button", { name: "Plana koy" }).click();
  await app.locator(".tl-travel.role-arrival .pk-card", { hasText: "IST" }).locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  // Porto chosen, Lisbon booked: in the itinerary the transfers lay themselves out (the saved train is
  // the move, with a station transfer on each side), and the way home says what's easy to miss.
  await tab("Gün gün").click();
  // Landing 10:05: the transfer then, check-in from 14:00 as the page says.
  await openDay(1);
  const arrive = flowCard("Havalimanı transferi");
  assert.equal(await flowTime("Havalimanı transferi").innerText(), "~10:50"); // landing 10:05 + 45 min out of the airport
  assert.match(await arrive.innerText(), /Planlanmadı/);
  // Check-in opens to the stay's own card, as on the Plan.
  assert.equal(await flowTime("Check-in · Jardim Stay").innerText(), "14:00");
  await flowCard("Check-in · Jardim Stay").locator(".settled-card", { hasText: "Jardim Stay" }).waitFor();
  // A transfer with no plan opens right there: what's easy to miss, how to go, "Gerek yok".
  await openCard("Havalimanı transferi");
  await arrive.locator(".leg-note", { hasText: "Varış 10:05, giriş en erken 14:00 (sayfada yazıyor)" }).waitFor();
  // "Metroyla gideceğim": nothing to book, so the transfer becomes a line of the day, its way as which.
  await arrive.getByRole("button", { name: "🚇 Metro" }).click();
  await dayPage.locator('.dc-step.info[data-title="Havalimanı transferi · Metro"]', { hasText: "planlandı" }).waitFor();
  await openDay(4);
  // Two transfers read the same ("Transfer"): the first is to the station.
  assert.match(await flowCard("Transfer").innerText(), /Porto Campanhã/);
  await openDay(7);
  await openCard("Havalimanı transferi");
  await flowCard("Havalimanı transferi").locator(".leg-note", { hasText: "arada ~5 saat boşluk" }).waitFor();
  // "Gerek yok": a transfer they don't need leaves the day (and the to-dos), and comes back from "Gizlenenler".
  await openDay(4);
  const lisbonIn = flowCard("Transfer", 1);
  await openCard("Transfer", 1);
  await lisbonIn.getByRole("button", { name: "Gerek yok · gizle" }).click();
  await lisbonIn.waitFor({ state: "detached" });
  await tab("Plan").click();
  // It waits at the end of Ulaşım: "Gizlenenler · 1 göster" opens it there, "Geri getir" brings it back.
  if (await sec("transport").locator(".cat-body").count() === 0) await sec("transport").locator(".cat-title").click();
  assert.equal(await sec("transport").locator(".cat-hidden-link").innerText(), "Gizlenenler · 1 göster");
  await sec("transport").locator(".cat-hidden-link button").click();
  const hiddenLeg = sec("transport").locator(".cat-hidden-row.leg");
  assert.match(await hiddenLeg.innerText(), /Varış transferi[\s\S]*→/);
  await hiddenLeg.getByRole("button", { name: "Geri getir", exact: true }).click();
  await sec("transport").locator(".cat-hidden").waitFor({ state: "detached" });
  await tab("Gün gün").click();
  await openDay(4);
  await lisbonIn.waitFor();
  await app.screenshot({ path: `${out}/5b-legs.png` });
  await openDay(1);
  await app.screenshot({ path: `${out}/5-legs.png` });
  await openDay(4);
  // A narrow window: nothing spills out sideways.
  const wide = app.viewportSize();
  await app.setViewportSize({ width: 820, height: 900 });
  await dayPage.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll");
  await app.setViewportSize(wide);
  // Back on the plan, without the train Porto → Lizbon is a move to plan: by plane it reads as a flight, with its status on it.
  await tab("Plan").click();
  // "Çıkar" in the card's menu: it leaves the options and waits at the end of its section, under "Gizlenenler".
  const train = pk("CP Alfa Pendular · Porto → Lizbon");
  await train.getByRole("button", { name: "Kart menüsü" }).click();
  await train.getByRole("menuitem", { name: "Çıkar" }).click();
  await sec("transport").locator(".cat-hidden-link", { hasText: "Gizlenenler · 1 göster" }).waitFor();
  await sec("transport").locator(".cat-hidden-link button").click();
  const ruledOut = sec("transport").locator(".cat-hidden-row.dismissed", { hasText: "CP Alfa Pendular" });
  assert.match(await ruledOut.innerText(), /Elendi/);
  await ruledOut.getByRole("button", { name: "Geri al", exact: true }).waitFor();
  assert.equal(await app.locator(".row-name", { hasText: /Elenenler/ }).count(), 0);
  const move = app.locator('.pk-leg[aria-label="Porto → Lizbon"]');
  await sec("transport").locator('.pk-leg[aria-label="Porto → Lizbon"]').waitFor();
  await move.locator(".pk-ring.open").waitFor();
  // Nothing said for it: its empty card (boş kartlar), "Nasıl gideceğin belli değil", the directions to search; tapped, how to go.
  await move.locator(".ek-foot", { hasText: "Nasıl gideceğin belli değil" }).waitFor();
  assert.match(await move.locator(".ek-route").innerText(), /Porto[\s\S]*Lizbon/);
  assert.equal(new URL(await move.getByRole("link", { name: "Yol tarifi" }).getAttribute("href")).searchParams.get("destination"), "Lizbon");
  await move.locator(".pk-body").click();
  await move.getByRole("button", { name: "✈ Uçak" }).click();
  // By plane it's a flight: it leaves Ulaşım for Uçuş, and the page follows it there with a flash.
  await sec("flight").locator(".cat-card.flash", { has: app.locator('.pk-leg[aria-label="Porto → Lizbon"]') }).waitFor();
  assert.equal(await sec("transport").locator('.pk-leg[aria-label="Porto → Lizbon"]').count(), 0, "a flight never sits in Ulaşım");
  assert.equal(await move.locator(".pk-kind").innerText(), "Uçuş");
  await move.locator(".pk-ring.half").waitFor();
  // Its details open again in its new place.
  // Opened as an empty card, it stays open as the full card the way picked made it.
  await move.getByRole("link", { name: "Uçuş ara ↗" }).waitFor();
  assert.equal(await move.locator(".pk-body").getAttribute("aria-expanded"), "true");
  await move.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  assert.equal(
    decodeURIComponent(await move.getByRole("link", { name: "Uçuş ara ↗" }).getAttribute("href")),
    "https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11",
  );
  await move.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/5d-move.png` });
  await move.getByRole("button", { name: "Bileti aldım" }).click();
  await move.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // By plane there's an airport at each end: the itinerary's day 4 now has them, around the flight.
  await tab("Gün gün").click();
  await openDay(4);
  await flowCard("Havalimanı transferi", 1).waitFor();
  assert.deepEqual(await dayTitles(), ["Check-out · Jardim Stay", "Havalimanı transferi", "Uçuş · Porto → Lizbon", "Havalimanı transferi", "Check-in · Lisboa Loft"]);
  await flowCard("Uçuş · Porto → Lizbon").locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  await tab("Plan").click();
  // What still needs booking without a day: Etkinlikler's "Tarihsiz · Porto", one card under another (Majestic
  // Café, a café with no booking, is a restaurant card instead).
  // (Lizbon, with no activity yet, is an empty card on its own line after them: .ek-line.)
  const undatedActs = sec("activity").locator(".cat-line:not(.ek-line) .cat-day.undated");
  assert.match(await undatedActs.locator(".cat-date").innerText(), /Tarihsiz\s*Porto/);
  assert.deepEqual(await undatedActs.locator(".pk-card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), ["Livraria Lello", "Serralves Müzesi", "Tiyatro"]);
  assert.equal(await app.locator(".pk-card", { hasText: "Majestic Café" }).count(), 0);
  await sec("todo").locator('.il-row[aria-label="Majestic Café"]').waitFor();
  assert.equal(await app.locator(".crash").count(), 0, "board crashed after chat updates");
  await app.screenshot({ path: `${out}/5-chosen.png` });
  // 4b. Plan cards: a file on a card, delete + undo (the file comes back), add from a template, narrow.
  const douroCard = () => app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douroCard().locator("input.pk-file").first().setInputFiles({ name: "bilet.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });
  // The chip is short ("Belge"); the file's name on hover (0.36.20).
  const pill = douroCard().locator('.pk-docpill[title^="bilet.pdf"]', { hasText: "Belge" });
  await pill.waitFor();
  const [docTab] = await Promise.all([context.waitForEvent("page"), pill.click()]);
  assert.match(docTab.url(), /^blob:chrome-extension:\/\//);
  await docTab.close();
  await douroCard().getByRole("button", { name: "Kart menüsü" }).click();
  await douroCard().getByRole("menuitem", { name: "Sil" }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().locator('.pk-docpill[title^="bilet.pdf"]').waitFor();
  await app.getByRole("button", { name: "Ekle", exact: true }).first().click();
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
  const bus = pk("Otobüs · Lizbon → Lagos");
  await bus.locator(".pk-price", { hasText: "18" }).waitFor();
  await bus.locator(".pk-kind", { hasText: "Otobüs" }).waitFor();
  await bus.locator(".pk-foot", { hasText: "Planlandı" }).waitFor();
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
  const arrivalLeg = app.locator('.pk-leg[aria-label="OPO havalimanı → Jardim Stay"]');
  await arrivalLeg.locator(".pk-body").click();
  await arrivalLeg.getByRole("button", { name: "🚕 Taksi" }).click();
  await arrivalLeg.locator(".pk-kind", { hasText: "Taksi · transfer" }).waitFor();
  const inbound = app.locator(".tl-travel.role-arrival .pk-card").first();
  assert.equal(await inbound.locator(".pk-kind").innerText(), "Uçuş");
  assert.match(await inbound.locator(".pk-mid").innerText(), /İstanbul\s*IST · 07:10[\s\S]*Porto\s*OPO · 10:05/);
  // The flight and, under the stay, the taxi transfer in one picture.
  await app.setViewportSize({ width: 1440, height: 1400 });
  await inbound.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4e-flight-after-taxi.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  // × on hover: a plan card, then a stay; v11: "Gerek yok" (hidden under Gizlenenler, not deleted); each comes back with "Geri al".
  // Read after the .15s fade.
  const opacity = (loc) => loc.evaluate((el) => new Promise((done) => setTimeout(() => done(getComputedStyle(el).opacity), 300)));
  await douroCard().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douroCard().hover();
  assert.equal(await opacity(douroCard().locator(".pk-x")), "1");
  await app.screenshot({ path: `${out}/4f-hover-x.png` });
  await douroCard().getByRole("button", { name: "Douro tekne turu: gerek yok" }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu: gerek yok, gizlendi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().waitFor();
  // A transport card has the same × and undo.
  await bus.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await bus.hover();
  // The card may be drawn again just after its edits land ("güncellendi"): the pointer comes back once if so.
  for (let i = 0; i < 3 && (await opacity(bus.locator(".pk-x"))) !== "1"; i++) {
    await app.mouse.move(0, 0);
    await bus.hover();
  }
  assert.equal(await opacity(bus.locator(".pk-x")), "1");
  await bus.getByRole("button", { name: "Otobüs · Lizbon → Lagos: gerek yok" }).click();
  await bus.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Lagos" }).getByRole("button", { name: "Geri al" }).click();
  await bus.waitFor();
  const jardim = app.locator(".stay-block.chosen .settled-card", { hasText: "Jardim Stay" });
  await jardim.getByRole("button", { name: "Kart menüsü" }).click();
  // Planlandı (aşamalar, lifecycle.ts): Değiştir takes it back to its options.
  assert.deepEqual(await jardim.getByRole("menuitem").allInnerTexts(), ["Değiştir", "Sil"]);
  await jardim.getByRole("button", { name: "Kart menüsü" }).click();
  await jardim.hover();
  await jardim.getByRole("button", { name: "Jardim Stay: gerek yok" }).click();
  await jardim.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Jardim Stay: gerek yok, gizlendi" }).getByRole("button", { name: "Geri al" }).click();
  await jardim.waitFor();
  // Rezerve edildi: Belge ekle, İptal ettim, Değiştir; Sil asks first ("İptal ettiysen 'İptal ettim' de"), and
  // nothing goes when the answer is no. İptal ettim takes it off the plan (its nights to find again), Geri al
  // brings the booking back.
  const loft = app.locator(".stay-block .settled-card", { hasText: "Lisboa Loft" });
  await loft.scrollIntoViewIfNeeded();
  await loft.getByRole("button", { name: "Kart menüsü" }).click();
  assert.deepEqual(await loft.getByRole("menuitem").allInnerTexts(), ["Belge ekle", "İptal ettim", "Değiştir", "Sil"]);
  // v11: the board's own window asks, not the browser's confirm().
  const ask = app.getByRole("alertdialog");
  await loft.getByRole("menuitem", { name: "Sil" }).click();
  assert.match(await ask.innerText(), /Bu rezervasyon onaylı/, "deleting a booking asks first");
  await ask.getByRole("button", { name: "Vazgeç" }).click();
  await ask.waitFor({ state: "detached" });
  assert.equal(await loft.count(), 1, "no: it stays");
  // Its × asks too: "İptal ettin mi?" ("İptal ettim, kaldır" cancels it); Vazgeç leaves it.
  await loft.hover();
  await loft.getByRole("button", { name: "Lisboa Loft: kaldır" }).click();
  assert.match(await ask.innerText(), /Bu rezervasyon onaylı[\s\S]*iptal ettin mi\?[\s\S]*İptal ettim, kaldır/);
  await app.keyboard.press("Escape");
  await ask.waitFor({ state: "detached" });
  assert.equal(await loft.count(), 1, "Vazgeç: it stays");
  await loft.getByRole("button", { name: "Kart menüsü" }).click();
  await loft.getByRole("menuitem", { name: "İptal ettim" }).click();
  await loft.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Lisboa Loft iptal edildi" }).getByRole("button", { name: "Geri al" }).click();
  await loft.waitFor();
  // "+": always there (faint), each with the right city and day.
  const sheetWhere = async (button) => {
    await button.click();
    const where = await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).locator("header span").innerText();
    await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Kapat" }).click();
    return where;
  };
  const plus = (scope) => scope.locator(".pk-insert button").first();
  await app.mouse.move(0, 0);
  assert.equal(await opacity(plus(sec("stay"))), "0.35", "the + shows without a hover");
  // After Porto's stay: Porto (its last night is picked in the form).
  assert.equal(await sheetWhere(plus(sec("stay").locator(".cat-card.tl-stay").first())), "Porto");
  // In Ulaşım, after the airport taxi: Porto on the 8th, and only Ulaşım's own kinds.
  await plus(sec("transport").locator(".cat-card.tl-leg").first()).click();
  const only = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  assert.equal(await only.locator("header span").innerText(), "Porto · 8 Ekim");
  assert.equal(await only.getByRole("button", { name: "Otel", exact: true }).count(), 0, "a section's + offers only its own kinds");
  await only.getByRole("button", { name: "Otobüs", exact: true }).waitFor();
  await only.getByRole("button", { name: "Kapat" }).click();
  // One kind (Uçuş, Etkinlikler): added at once, there; "Geri al" takes it away.
  const cardCount = () => app.locator(".cat-card").count();
  const before = await cardCount();
  await plus(sec("flight").locator(".cat-card.tl-travel").last()).click();
  await app.locator(".pk-undo", { hasText: "Uçuş eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await app.waitForFunction((n) => document.querySelectorAll(".cat-card").length === n, before);
  await sec("activity").getByRole("button", { name: "Etkinlik ve turlar: ekle" }).click();
  await box("Ad").waitFor();
  await box("Ad").press("Escape");
  await app.locator(".pk-undo", { hasText: "Etkinlik · tur eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await app.waitForFunction((n) => document.querySelectorAll(".cat-card").length === n, before);
  // On a day of the itinerary: that day and its city. A to-do added there is a thin line of the day.
  await tab("Gün gün").click();
  // Day 3 is empty ("boş gün"): its card has the "+".
  await listMode();
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
  await sec("todo").locator('.il-row[aria-label="Bolhão pazarı"]').waitFor();
  await tab("Gün gün").click();
  await listMode();
  // An idea without an hour is a line of the day like the rest (0.35.6), never hidden.
  await dayCard(3).locator(".dc-tl > .dc-step.idea", { hasText: "Bolhão pazarı" }).waitFor();
  // Yapılacak şeyler and Restoranlar (0.34, where Fikirler was): the quick line at the top, a day for a
  // restaurant (with its meal), done, moved to Etkinlikler.
  await tab("Plan").click();
  const todos = sec("todo");
  const quick = todos.getByRole("textbox", { name: "Bir şey yaz" });
  // The city the line names is the card's city, not part of its title.
  for (const [line, title] of [
    ["Lizbon'da pastel de nata", "Pastel de nata"],
    ["Porto'da Dom Luís köprüsünden gün batımı", "Dom Luís köprüsünden gün batımı"],
    ["Porto'da Livraria Lello, giriş bileti var", "Livraria Lello, giriş bileti var"],
  ]) {
    await quick.fill(line);
    await quick.press("Enter");
    await app.locator(`.cat-plan [aria-label="${title}"]`).waitFor();
  }
  const food = sec("todo");
  // Restaurants and things to do as one list by city (0.35.3): a row each, the trip's cities in order, what's on a day first.
  const names = (loc) => loc.locator(".il-row .il-main b").allInnerTexts();
  // v11: restaurants are drawn under Yapılacak şeyler: one list, by city.
  assert.deepEqual(await names(food), ["Bolhão pazarı", "Majestic Café", "Dom Luís köprüsünden gün batımı", "Livraria Lello, giriş bileti var", "Pastel de nata"]);
  assert.deepEqual((await food.locator(".il-head b").allInnerTexts()), ["Porto", "Lizbon"]);
  assert.equal(await todos.locator('.il-row[aria-label="Bolhão pazarı"] .fk-day.set').innerText(), "10 Eki");
  await todos.locator('.il-group[data-group="Porto"] .il-row[aria-label="Dom Luís köprüsünden gün batımı"]').waitFor();
  // No bar, no "güne eklenmedi": a neutral count.
  assert.equal(await todos.locator(".cat-ideas").innerText(), "5 fikir · 1 tanesi bir güne kondu");
  assert.equal(await todos.locator(".cat-wait").count(), 0);
  const majestic = food.locator('.il-row[aria-label="Majestic Café"]');
  assert.match(await majestic.getByRole("link", { name: "Majestic Café: haritada aç" }).getAttribute("href"), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=41\.1471%2C-8\.6066$/);
  const pic = await majestic.locator(".il-ic, .il-img").first().boundingBox();
  assert.deepEqual([Math.round(pic.width), Math.round(pic.height)], [34, 34]);
  await majestic.getByRole("button", { name: "+ Güne ekle" }).click();
  await majestic.getByRole("radio", { name: "öğle" }).click();
  await majestic.getByRole("dialog", { name: "Hangi gün?" }).getByRole("button", { name: /^9 Eki/ }).click();
  await majestic.locator(".fk-day.set", { hasText: "9 Eki öğle" }).waitFor();
  // On its day now: still in Porto, first there.
  assert.equal(await food.locator('.il-group[data-group="Porto"] .il-row').first().getAttribute("aria-label"), "Majestic Café");
  // Its name is edited where it stands.
  await majestic.getByRole("button", { name: "Ad: düzenle" }).click();
  await box("Ad").fill("Majestic Café Porto");
  await box("Ad").press("Enter");
  const majesticPorto = food.locator('.il-row[aria-label="Majestic Café Porto"]');
  await majesticPorto.waitFor();
  await majesticPorto.getByRole("button", { name: "Ad: düzenle" }).click();
  await box("Ad").fill("Majestic Café");
  await box("Ad").press("Enter");
  await majestic.waitFor();
  // An idea has no tick box: its day, its map, its page (a web search when it has none) and an optional "Yaptım".
  const market = todos.locator('.il-row[aria-label="Bolhão pazarı"]');
  assert.equal(await market.getByRole("checkbox").count(), 0, "an idea has no tick");
  assert.match(await market.getByRole("link", { name: "Bolhão pazarı: haritada aç" }).getAttribute("href"), /google\.com\/maps\/search/);
  // Fikir havuzu v1: one map link (the name and "Harita" go to the same place), no web search, no second pin.
  assert.equal(await market.locator(".il-name a").getAttribute("href"), await market.getByRole("link", { name: "Bolhão pazarı: haritada aç" }).getAttribute("href"));
  assert.equal(await market.getByRole("link", { name: /web'de ara/ }).count(), 0);
  // The tabs filter by where an idea stands, with their counts; the chips by kind, read from its words.
  assert.deepEqual(flat(await todos.locator(".il-tabs button").allInnerTexts()), ["Hepsi 5", "Havuzda 3", "Günü var 2", "Yapıldı 0"]);
  await todos.getByRole("tab", { name: "Günü var 2" }).click();
  assert.deepEqual(await names(todos), ["Majestic Café", "Bolhão pazarı"]);
  await todos.getByRole("tab", { name: "Hepsi 5" }).click();
  assert.equal(await market.locator(".il-kind").innerText(), "Pazar & alışveriş");
  assert.deepEqual(flat(await todos.locator(".il-chips button").allInnerTexts()), ["Hepsi", "Manzara 1", "Kültür 1", "Pazar & alışveriş 1", "Kahvaltı & kahve 1", "Tatlı 1"]);
  await todos.locator(".il-chips button", { hasText: "Manzara" }).click();
  assert.deepEqual(await names(todos), ["Dom Luís köprüsünden gün batımı"]);
  await todos.locator(".il-chips button", { hasText: "Hepsi" }).click();
  // The kind is changed from the row ("Otomatik" gives the words' one back).
  await market.locator(".il-kind").click();
  await market.getByRole("menuitemradio", { name: "Gezinti" }).click();
  await market.locator(".il-kind", { hasText: "Gezinti" }).waitFor();
  await market.locator(".il-kind").click();
  await market.getByRole("menuitem", { name: "Otomatik" }).click();
  await market.locator(".il-kind", { hasText: "Pazar & alışveriş" }).waitFor();
  // Yaptım: under "Yapıldı" at the end; undone, back on its day.
  await market.getByRole("button", { name: "Bolhão pazarı: yaptım" }).click();
  const doneGroup = todos.locator(".il-group.done");
  await doneGroup.waitFor();
  assert.match(await doneGroup.locator(".il-head").innerText(), /Yapıldı\s*1/);
  assert.equal(await todos.locator(".cat-ideas").innerText(), "5 fikir · 1 tanesi bir güne kondu · 1 yapıldı");
  await doneGroup.getByRole("button", { name: "Bolhão pazarı: geri al" }).click();
  await doneGroup.waitFor({ state: "detached" });
  assert.equal(await todos.locator('.il-row[aria-label="Bolhão pazarı"] .fk-day.set').innerText(), "10 Eki");
  // Long names stay one line: every row is as tall as the others.
  const heights = await app.locator('.cat-sec[data-section="todo"] .il-row, .cat-sec[data-section="food"] .il-row').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  assert.equal(new Set(heights).size, 1, `idea rows line up (${heights})`);
  const lello = todos.locator('.il-row[aria-label="Livraria Lello, giriş bileti var"]');
  await lello.getByRole("button", { name: /Etkinliklere taşı/ }).waitFor();
  await app.setViewportSize({ width: 1440, height: 1400 });
  await todos.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4g-todo-food.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await todos.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4h-todo-food-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in Yapılacak şeyler and Restoranlar");
  await app.setViewportSize({ width: 1440, height: 900 });
  // A to-do deleted with ×, then brought back.
  const sunset = todos.locator(".il-row", { hasText: "gün batımı" });
  await sunset.hover();
  await sunset.getByRole("button", { name: "Dom Luís köprüsünden gün batımı: sil" }).click();
  await sunset.waitFor({ state: "detached" });
  await app.locator(".pk-undo").getByRole("button", { name: "Geri al" }).click();
  await sunset.waitFor();
  await lello.getByRole("button", { name: "Etkinliklere taşı" }).click();
  await lello.waitFor({ state: "detached" });
  // The restaurant on its day is a thin line of the itinerary; the moved one is a booking in Etkinlikler.
  await tab("Gün gün").click();
  await listMode();
  // Its meal is its NE: "Öğle yemeği · Majestic Café".
  await dayCard(2).locator('.dc-step.idea[data-title="Öğle yemeği · Majestic Café"]').waitFor();
  await app.screenshot({ path: `${out}/4k-itinerary-032.png` });
  await tab("Plan").click();
  assert.match(await sec("activity").locator(".cat-count").innerText(), /^\d+\/5$/);
  // A to-do moved to Etkinlikler is a thing to do with a ticket there, not a "Yapılacak".
  const lelloCard = sec("activity").locator('.pk-card[aria-label="Livraria Lello, giriş bileti var"]');
  await lelloCard.waitFor();
  assert.match(await lelloCard.locator(".pk-kind").innerText(), /Etkinlik/);
  // The panel scrolls inside the page: scroll the list to the top, then take the window.
  await app.setViewportSize({ width: 1440, height: 1400 });
  await sec("activity").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4l-activities.png` });
  // 0.35.11: a GetYourGuide search per city under Etkinlikler; a booking with no file says "Belge eksik" (and picks one).
  // Boş kartlar: Lizbon has no activity yet, so it's the activity's empty card with its three searches instead.
  assert.deepEqual(await sec("activity").locator(".cat-search-link").evaluateAll((els) => els.map((a) => [a.textContent, a.getAttribute("href")])), [
    ["Porto etkinliklerini ara ↗", "https://www.getyourguide.com/s/?q=Porto"],
  ]);
  const lisbonActs = sec("activity").locator('.ek-card[aria-label="Lizbon\'da tur ve bilet"]');
  assert.equal(await lisbonActs.locator(".ek-state").innerText(), "Henüz yok");
  assert.deepEqual(await lisbonActs.locator(".ek-link").evaluateAll((els) => els.map((a) => a.getAttribute("href"))), [
    "https://www.getyourguide.com/s/?q=Lizbon",
    "https://www.viator.com/searchResults/all?text=Lizbon",
    "https://www.klook.com/search/result/?query=Lizbon",
  ]);
  assert.equal(await sec("activity").locator(".ek-card").count(), 1, "Porto has its activities: no empty card there");
  assert.ok((await app.locator(".cat-plan .pk-docmiss", { hasText: "Belge eksik" }).count()) > 0, "a booking without its ticket says so");
  await app.setViewportSize({ width: 1440, height: 900 });
  // Narrow: the + and × are there without a hover.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.mouse.move(0, 0);
  assert.equal(await opacity(douroCard().locator(".pk-x")), "0.55");
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
  console.log("✓ 0.32: flight stays a flight after a taxi transfer; × + undo on a card and a stay; + with the section's kind, city and day; Yapılacak şeyler and Restoranlar: quick line, day + meal, done, moved to Etkinlikler, thin line in the day");

  // 4m. 0.33: a tile adds at once and the card opens for editing; Enter saves, Esc leaves it, Geri al takes it away;
  // a saved page's card corrected where it stands ("sayfadaki: … · geri al"); a transfer's ends short; × on night blocks.
  await tab("Plan").click();
  // "+" after the flight in → Otobüs: "Porto → ?", where it goes ready; Esc leaves it as it is; "Geri al" takes it away.
  await plus(sec("transport").locator(".cat-card.tl-leg").first()).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otobüs", exact: true }).click();
  await box("Nereye").waitFor();
  const portoBus = pk("Otobüs · Porto → ?");
  await portoBus.waitFor();
  assert.ok(await box("Nereye").evaluate((el) => el === document.activeElement), "the first empty field has the cursor");
  await app.screenshot({ path: `${out}/4m0-instant-add.png` });
  await box("Nereye").fill("Braga");
  await box("Nereye").press("Escape");
  await box("Nereye").waitFor({ state: "detached" });
  // Left with nothing concrete on it (no hour, no price, no page): the bus's empty card (boş kartlar), where it goes still to say.
  assert.match(await portoBus.locator(".ek-route").innerText(), /Porto[\s\S]*Nereye/);
  assert.match(await portoBus.locator(".ek-state").innerText(), /^Bilet yok/);
  assert.equal(await portoBus.locator(".pk-foot, .pk-price").count(), 0, "no price on an empty card");
  await app.locator(".pk-undo", { hasText: "Otobüs eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await portoBus.waitFor({ state: "detached" });
  // "+" after Porto's stay → Otel: its last night, a stay apart, its name ready; the check-in moved keeps one night.
  await plus(sec("stay").locator(".cat-card.tl-stay").first()).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otel", exact: true }).click();
  await box("Ad").fill("Casa do Rio");
  await box("Ad").press("Enter");
  const apart = app.locator(".stay-open", { hasText: "Casa do Rio" });
  await apart.waitFor();
  assert.equal(await apart.evaluate((el) => el.closest(".stay-block").id), "block-2026-10-10");
  await app.setViewportSize({ width: 1440, height: 1400 });
  await apart.getByRole("button", { name: "Fiyat: düzenle" }).click();
  await box("Fiyat").fill("95");
  await app.screenshot({ path: `${out}/4m-inline-edit.png` });
  await box("Fiyat").press("Enter");
  await apart.getByText("€95").waitFor();
  await apart.getByRole("button", { name: "Giriş: düzenle" }).click();
  await box("Giriş").fill("2026-10-09");
  await box("Giriş").press("Enter");
  await app.locator("#block-2026-10-09 .stay-open", { hasText: "Casa do Rio" }).waitFor();
  assert.match(await apart.innerText(), /9 Ekim – 10 Ekim · 1 gece/);
  // × on the stay apart: gone (its night goes back to Jardim Stay), then back with "Geri al", then gone for good.
  await apart.hover();
  await apart.getByRole("button", { name: "Casa do Rio: sil" }).click();
  await apart.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Casa do Rio silindi" }).getByRole("button", { name: "Geri al" }).click();
  await apart.waitFor();
  await apart.hover();
  await apart.getByRole("button", { name: "Casa do Rio: sil" }).click();
  await apart.waitFor({ state: "detached" });
  // A saved page corrected where it stands: the title, then the page's value back from the hint.
  const douroId = await douroCard().getAttribute("data-item-id");
  const douroPage = app.locator(`.pk-card[data-item-id="${douroId}"]`);
  await douroPage.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douroPage.locator("h3").getByRole("button", { name: "Ad: düzenle" }).click();
  await box("Ad").fill("Douro gün batımı turu");
  await box("Ad").press("Enter");
  await douroPage.locator("h3", { hasText: "Douro gün batımı turu" }).waitFor();
  await douroPage.locator("h3 .pk-ed").hover();
  const hint = douroPage.locator("h3 .pk-ed-hint");
  assert.match(await hint.innerText(), /sayfadaki: Douro tekne turu · geri al/);
  await app.screenshot({ path: `${out}/4n-page-correction.png` });
  // The hint shows under the pointer: point at the title again if the card was drawn anew meanwhile, then take the
  // page's value back (the title coming back proves the click).
  for (let i = 0; i < 3 && !(await hint.getByRole("button", { name: "geri al" }).isVisible()); i++) {
    await app.mouse.move(0, 0);
    await douroPage.locator("h3 .pk-ed").hover();
  }
  await hint.getByRole("button", { name: "geri al" }).click({ force: true });
  await douroPage.locator("h3", { hasText: "Douro tekne turu" }).waitFor();
  // A transfer's ends, short: "Porto Havalimanı" over OPO, "Booking.com" over the stay's name.
  assert.match(await arrivalLeg.locator(".pk-mid").innerText(), /Porto Havalimanı\s*OPO[\s\S]*Booking\.com\s*Jardim Stay/);
  // One word isn't broken in the middle ("Booking.co / m"): the end stays on one line.
  assert.ok(await arrivalLeg.locator(".pk-stop.r b").evaluate((el) => el.getClientRects().length <= 1 && el.offsetHeight < 1.6 * parseFloat(getComputedStyle(el).fontSize)), "Booking.com on one line");
  // Empty nights (the trip a night longer): × hides them ("Gerek yok"), Gizlenenler brings them back.
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
  await setEnd("2026-10-15");
  const extra = app.locator("#block-2026-10-14 .stay-open");
  await extra.waitFor();
  await extra.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/4o-empty-nights.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await extra.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.mouse.move(0, 0);
  assert.equal(await opacity(extra.locator(".stay-x")), "0.55");
  await app.screenshot({ path: `${out}/4p-empty-nights-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with night blocks");
  await app.setViewportSize({ width: 1440, height: 1400 });
  await extra.hover();
  await extra.getByRole("button", { name: /: gerek yok$/ }).click();
  await app.locator(".pk-undo", { hasText: "gizlendi" }).waitFor();
  await app.locator("#block-2026-10-14").waitFor({ state: "detached" }); // hidden nights leave the plan
  // They wait at the end of Konaklama, with the option the Lisboa Loft booking closed.
  assert.equal(await sec("stay").locator(".cat-hidden-link").innerText(), "Gizlenenler · 2 göster");
  await sec("stay").locator(".cat-hidden-link button").click();
  const nightsRow = sec("stay").locator(".cat-hidden-row.nights", { hasText: "Geceler" });
  await sec("stay").locator(".cat-hidden").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/4q-hidden-open.png` });
  assert.match(await nightsRow.innerText(), /14–15 Ekim/);
  await nightsRow.getByRole("button", { name: "Geri getir" }).click();
  await app.locator("#block-2026-10-14 .stay-open").waitFor();
  await setEnd("2026-10-14");
  await app.locator("#block-2026-10-14").waitFor({ state: "detached" });
  await app.setViewportSize({ width: 1440, height: 900 });
  console.log("✓ 0.33: a tile adds at once and opens for editing (Tab, Enter, Esc, Geri al); a stay apart edited, moved and deleted with ×; a saved page corrected and taken back; short transfer ends; empty nights hidden and brought back");

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
  const todoRow = (name) => sec("todo").locator(`.il-row[aria-label="${name}"]`);
  await todoRow("Porto Belo Pazarı").waitFor();
  await todoRow("Outdoor alışverişi").waitFor();
  // 0.34.6: Yapılacak şeyler is what's done there; a chore typed in the quick box goes to Hazırlık (its own section since v11).
  const quickBox = sec("todo").locator(".fk-quick input");
  await quickBox.fill("Decathlon'dan yağmurluk al");
  await quickBox.press("Enter");
  await quickBox.fill("Dom Luís'te gün batımı");
  await quickBox.press("Enter");
  await todoRow("Dom Luís'te gün batımı").waitFor();
  if (await sec("prep").evaluate((el) => el.classList.contains("closed"))) await sec("prep").locator(".cat-title").click();
  const prepRow = sec("prep").locator(`.prep-row[aria-label="Decathlon'dan yağmurluk al"]`);
  await prepRow.waitFor();
  assert.equal(await app.locator(`.il-row[aria-label="Decathlon'dan yağmurluk al"]`).count(), 0, "a chore is never a thing to do");
  assert.equal(await sec("prep").locator(`.prep-row[aria-label="Dom Luís'te gün batımı"]`).count(), 0, "an experience is never a chore");
  // Moved by hand both ways (0.35.9): "Hazırlığa taşı" on a thing to do, "Orada yapılacak" back from Hazırlık.
  if (await sec("prep").evaluate((el) => el.classList.contains("closed"))) await sec("prep").locator(".cat-title").click();
  await todoRow("Dom Luís'te gün batımı").hover();
  await todoRow("Dom Luís'te gün batımı").getByRole("button", { name: "Dom Luís'te gün batımı: Hazırlık'a taşı" }).click();
  const sunsetPrep = sec("prep").locator(`.prep-row[aria-label="Dom Luís'te gün batımı"]`);
  await sunsetPrep.waitFor();
  await todoRow("Dom Luís'te gün batımı").waitFor({ state: "detached" });
  await sunsetPrep.hover();
  await sunsetPrep.getByRole("button", { name: "Dom Luís'te gün batımı: Yapılacak şeyler'e taşı" }).click();
  await todoRow("Dom Luís'te gün batımı").waitFor();
  await sunsetPrep.waitFor({ state: "detached" });
  // v11: no amber line; the list says how many are ready.
  assert.equal(await sec("prep").locator(".prep-head span").innerText(), "0/1 hazır");
  await app.locator(".pk-undo").waitFor({ state: "detached", timeout: 10000 }); // an earlier "Geri al" over the list
  await app.setViewportSize({ width: 1440, height: 1500 });
  await sec("prep").screenshot({ path: `${out}/5f-diger-hazirlik.png` });
  await app.setViewportSize({ width: 560, height: 1500 });
  await sec("prep").screenshot({ path: `${out}/5g-diger-hazirlik-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with Hazırlık");
  await app.setViewportSize({ width: 1440, height: 900 });
  // Ticked: done, struck through; then both lines go again, so the rest of the run sees the sample as it was.
  await prepRow.locator(".prep-check").click();
  await sec("prep").locator(".prep-row.done").waitFor();
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
  console.log("✓ 0.34.6: a chore typed in the quick box lands in Hazırlık (ticked off there), an experience in Yapılacak şeyler");
  assert.equal(await sec("activity").locator('.pk-card[aria-label="Porto Belo Pazarı"]').count(), 0, "a market is never a booking");
  // Icons from the words (a bag for a market and shopping); the Maps pin shows its photo instead.
  assert.equal(await todoRow("Porto Belo Pazarı").locator(".il-ic svg").count(), 1);
  const pinPhoto = todoRow("Jardins do Palácio de Cristal").locator("img.il-img");
  await pinPhoto.scrollIntoViewIfNeeded();
  assert.ok(await pinPhoto.evaluate(async (img) => (await img.decode(), img.naturalWidth > 0)), "the pin's photo loads");
  // Its name starts where the ones with an icon do (the picture the same size).
  const titleX = async (name) => (await todoRow(name).locator(".il-main b").boundingBox()).x;
  assert.ok(Math.abs((await titleX("Jardins do Palácio de Cristal")) - (await titleX("Porto Belo Pazarı"))) < 1, "names in one column");
  await todoRow("Jardins do Palácio de Cristal").locator(".il-sub", { hasText: "Maps'ten" }).waitFor();
  assert.equal(await todoRow("Jardins do Palácio de Cristal").locator(".il-kind").innerText(), "Doğa");
  // Saved from Maps: the map link is its own Maps page.
  assert.equal(await todoRow("Jardins do Palácio de Cristal").getByRole("link", { name: "Jardins do Palácio de Cristal: haritada aç" }).getAttribute("href"), "https://maps.app.goo.gl/e2e");
  await app.setViewportSize({ width: 1440, height: 1100 });
  await sec("todo").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5d-todo.png` });
  await app.setViewportSize({ width: 560, height: 1100 });
  await sec("todo").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5e-todo-narrow.png` });
  assert.deepEqual(await app.locator(".cat-sec").evaluateAll((els) => els.map((e) => e.getAttribute("data-section"))), ["flight", "stay", "transport", "activity", "todo", "other", "inspo"]);
  // İlham (0.35.3): the Reel waits at the very end as a tile with its platform; never a thing to do or a booking.
  // v11: open at first look like every section.
  const inspo = sec("inspo");
  assert.ok(!(await inspo.evaluate((el) => el.classList.contains("closed"))), "İlham opens at first look (v11)");
  assert.equal(await inspo.locator(".cat-ideas").innerText(), "1 kayıt");
  assert.equal(await todoRow("Ribeira'da gün batımı").count(), 0);
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
  await todoRow("Ribeira'da gün batımı").locator(".fk-day.set", { hasText: "9 Eki" }).waitFor();
  await inspo.waitFor({ state: "detached" });
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
  // Turkish passport to Portugal needs a Schengen visa, amber with its source; ticked, "Vize alındı", green.
  const visaRow = sec("other").locator(".visa-row");
  assert.match((await visaRow.innerText()).replace(/\s+/g, " "), /^Vize gerekiyor · Schengen vizesi Resmi kaynak ↗$/);
  assert.equal(await app.locator(".prep .visa-row, .prep-visa").count(), 0, "not in Hazırlık");
  await visaRow.getByRole("checkbox").click();
  await sec("other").locator(".visa-row.ok", { hasText: "Vize alındı" }).waitFor();
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
  await visaRow.getByRole("checkbox").click();
  await sec("other").locator(".visa-row:not(.ok)", { hasText: "Vize gerekiyor" }).waitFor();
  await app.setViewportSize({ width: 1440, height: 3600 });
  await app.setViewportSize({ width: 560, height: 3600 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5b-categories-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with the sections");
  // A day's date column goes above its cards on a narrow board.
  const dayBox = await sec("stay").locator(".cat-day").first().locator(".cat-date").boundingBox();
  const firstCard = await sec("stay").locator(".cat-day").first().locator(".cat-card").first().boundingBox();
  assert.ok(dayBox.y + dayBox.height <= firstCard.y + 1, "the day sits above its cards when narrow");
  await app.setViewportSize({ width: 1440, height: 1400 });
  const openTitles = app.locator(".cat-sec:not(.closed) .cat-title");
  while (await openTitles.count()) await openTitles.first().click();
  assert.equal(await app.locator(".cat-sec.closed").count(), 6);
  // One arrow, pointing right when closed and down when open, turned on the arrow itself (never mid-turn).
  const turn = (scope) => scope.locator(".cat-chev svg").evaluate((el) => getComputedStyle(el).transform);
  assert.match(await turn(sec("todo")), /^matrix\([^,]+, -1, 1,/);
  assert.equal(await sec("todo").locator(".cat-chev").evaluate((el) => getComputedStyle(el).transform), "none");
  // Closed, a section is its header line alone, the same in every section: icon, name … bar, settled of all, the arrow;
  // an idea section (Yapılacak şeyler) its neutral count in place of the bar and "x/y"; v11: the stage line under the name.
  assert.equal(await app.locator(".cat-sec.closed .cat-body, .cat-sec.closed .cat-card, .cat-sec.closed .il-row, .cat-sec.closed li, .cat-sec.closed .cat-wait, .cat-sec.closed .cat-hidden").count(), 0, "nothing under a closed header");
  const counts = [];
  for (const id of ["flight", "stay", "transport", "activity", "todo", "other"]) {
    const head = await sec(id).boundingBox();
    assert.ok(head.height < 80, `${id}: one compact line when closed (${head.height}px)`);
    // Öneriler (2026-10-06): a section's suggestions say "1 öneri" before its count, never inside it.
    const sg = (await sec(id).locator(".sg-count").count()) ? ["sg-count"] : [];
    if (sg.length) assert.match(await sec(id).locator(".sg-count").innerText(), /^\d+ öneri$/);
    if (id === "todo" || id === "food") {
      assert.match(await sec(id).locator(".cat-head").innerText(), /^[^\d]+\s*(\d+ öneri\s*)?\d+ fikir( · .+)?$/, `${id}: the name and how many ideas`);
      assert.deepEqual(await sec(id).locator(".cat-head").evaluate((el) => [...el.querySelectorAll(".cat-title > *, .cat-end > *")].map((c) => c.className || c.tagName.toLowerCase())), ["cat-ic", "cat-tt", ...sg, "cat-ideas", "cat-chev"]);
      const box = await sec(id).locator(".cat-ideas").boundingBox();
      counts.push(Math.round(box.x + box.width));
      continue;
    }
    assert.match(await sec(id).locator(".cat-count").innerText(), /^\d+\/\d+$/);
    const stage = String.raw`(\s*\d+ (?:rezerve|seçildi|aranıyor)(?: · \d+ (?:rezerve|seçildi|aranıyor))*)?`;
    assert.match(await sec(id).locator(".cat-head").innerText(), new RegExp(String.raw`^[^\d]+?${stage}\s*(\d+ öneri\s*)?\d+\/\d+$`), `${id}: the name, its stage line, the count, no other words`);
    assert.equal(await sec(id).locator(".cat-add").count(), 0, `${id}: no "+ Ekle" when closed`);
    assert.deepEqual(
      await sec(id).locator(".cat-head").evaluate((el) => [...el.querySelectorAll(".cat-title > *, .cat-end > *")].map((c) => c.className || c.tagName.toLowerCase())),
      ["cat-ic", "cat-tt", ...sg, "cat-bar" + ((await sec(id).locator(".cat-bar.done").count()) ? " done" : ""), "cat-count", "cat-chev"],
      `${id}: icon · name … bar · count · arrow`,
    );
    // Complete: the bar full and green.
    if (await sec(id).locator(".cat-bar.done").count()) {
      assert.equal(await sec(id).locator(".cat-bar.done > span").evaluate((el) => [el.style.width, getComputedStyle(el).backgroundColor].join(" ")), "100% rgb(31, 143, 78)");
    }
    const box = await sec(id).locator(".cat-count").boundingBox();
    counts.push(Math.round(box.x + box.width));
  }
  assert.equal(new Set(counts).size, 1, `the counts line up on the right (${counts})`);
  assert.equal(await sec("stay").locator(".cat-head").innerText(), "Konaklama\n1 rezerve · 1 seçildi\n1/2");
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-collapsed.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-collapsed-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with closed sections");
  for (const id of ["flight", "other"]) assert.ok((await sec(id).locator(".cat-head").boundingBox()).height < 80, `${id}: one line when closed and narrow`);
  await app.setViewportSize({ width: 1440, height: 1400 });
  // Remembered for the trip: closed after a reload.
  await app.reload();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await sec("activity").waitFor();
  assert.equal(await app.locator(".cat-sec.closed").count(), 6);
  // The header opens it (its cards come back) and closes it again.
  await sec("activity").locator(".cat-head").click({ position: { x: 300, y: 20 } });
  await sec("activity").locator('.pk-card[aria-label="Tiyatro"]').waitFor();
  assert.doesNotMatch(await sec("activity").getAttribute("class"), /closed/);
  await sec("activity").locator(".cat-head").click({ position: { x: 300, y: 20 } });
  await sec("activity").and(app.locator(".closed")).waitFor();
  await sec("activity").locator(".cat-title").click();
  await sec("activity").locator(".cat-card").first().waitFor();
  assert.match(await turn(sec("activity")), /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  // A to-do in a closed section: the hero's list opens it there.
  assert.match(await sec("stay").getAttribute("class"), /closed/);
  await app.locator(".hx-progress-count").click();
  await listMatchesHero("after a reload");
  await app.locator(".hx + .todo-list button", { hasText: "Rezerve et: Jardim Stay" }).click();
  await sec("stay").locator(".flash").waitFor();
  assert.doesNotMatch(await sec("stay").getAttribute("class"), /closed/);
  await app.locator(".hx-progress-count").click();
  // The ruled-out train: "Geri al" at the end of Ulaşım puts it back among the options; nothing hidden is left there.
  if (await sec("transport").locator(".cat-body").count() === 0) await sec("transport").locator(".cat-title").click();
  await sec("transport").locator(".cat-hidden-link button").click();
  await sec("transport").locator(".cat-hidden-row.dismissed", { hasText: "CP Alfa Pendular" }).getByRole("button", { name: "Geri al", exact: true }).click();
  await sec("transport").locator(".cat-hidden").waitFor({ state: "detached" });
  // A cell of the hero's plan line: the Plan, that section opened and brought into view.
  if (!/closed/.test(await sec("flight").getAttribute("class"))) await sec("flight").locator(".cat-title").click();
  await sec("flight").and(app.locator(".closed")).waitFor();
  await app.locator(".hx").scrollIntoViewIfNeeded();
  await app.locator(".hx-tally button", { hasText: "uçuş" }).click();
  await sec("flight").locator(".cat-body").waitFor();
  await app.waitForFunction(() => {
    const top = document.querySelector('.cat-sec[data-section="flight"]')?.getBoundingClientRect().top ?? -1;
    return top >= 0 && top < window.innerHeight / 2;
  });
  console.log("✓ 0.34 (kategoriler-v4): seven sections on one sheet, open while something's left, closed is icon · name · bar · settled/all · arrow (remembered after a reload), the header opens it, a to-do opens its section, what's hidden waits at its section's end and comes back");
  console.log("✓ board: demo trip, decision labels, comparison with priorities, drawer, status change and chat event");

  // A trip with nothing in it yet (hero v9): every block says what will come; nothing is made up. Then what
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
  const bare = app.locator(".hx");
  await bare.locator(".hx-ph", { hasText: "Şehir belli olunca fotoğrafı gelir" }).waitFor();
  assert.equal(await bare.locator(".hx-count, .hx-cities").count(), 0, "no dates, no countdown; no cities, no switcher");
  assert.equal(await bare.locator(".hx-when").innerText(), "Tarihler kaydettikçe netleşir");
  // The date line says it already: no second sentence saying the same (gece denetimi 15a).
  assert.equal(await bare.locator(".hx-lead").count(), 0, "the same sentence never twice");
  assert.deepEqual(flat(await bare.locator(".hx-tally button.zero").allInnerTexts()), ["0 uçuş", "0 konaklama", "0 ulaşım", "0 deneyim"]);
  assert.equal(flat([await bare.locator(".hx-progress-main").innerText()])[0], "Planlama Henüz kayıt yok");
  assert.equal(flat([await bare.locator(".hx-go").innerText()])[0], "İlk kaydı ekle");
  const bareSide = bare.locator(".hx-side");
  assert.equal(flat([await bareSide.locator(".hx-who-text").innerText()])[0], "Kimler gidiyor? Kişi sayısı kayıtlardan anlaşılır");
  assert.equal(await bareSide.locator(".hx-styles .empty").innerText(), "Tarzın konuştukça belirir");
  assert.equal(flat([await bareSide.locator(".hx-budget").innerText()])[0], "Bütçe — Fiyatlı kayıtlar geldikçe toplanır");
  assert.equal(await bareSide.locator(".hx-prefs .hx-empty").innerText(), "Konuştukça ve seçtikçe seni tanıyacağım.");
  assert.equal(await bareSide.locator(".hx-place .hx-empty").innerText(), "Ülke ve hava, şehir belli olunca gelir");
  assert.equal(await bareSide.locator(".hx-minis").count(), 0);
  await app.screenshot({ path: `${out}/2e-hero-empty.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await bare.screenshot({ path: `${out}/2f-hero-empty-narrow.png` });
  assert.deepEqual(await uncut(heroLines), [], "the empty hero's lines wrap, never cut");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow empty hero");
  await app.setViewportSize({ width: 1440, height: 900 });
  // "İlk kaydı ekle" opens the Plan's own "+ Ekle" sheet.
  await bare.locator(".hx-go").click();
  const firstSheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  await firstSheet.waitFor();
  await firstSheet.getByRole("button", { name: "Kapat" }).click();
  await firstSheet.waitFor({ state: "detached" });
  await putTrip({ ...blank, priorities: { price: 4, location: 4 }, updatedAt: Date.now() });
  const prefs = bareSide.locator(".hx-prefs");
  await prefs.locator(".hx-prefs-body.hx-appear").waitFor();
  assert.deepEqual(flat(await prefs.locator(".hx-ptag.strong").allInnerTexts()), ["Fiyat", "Konum"]);
  await prefs.locator(".hx-prefs-link", { hasText: "Düzenle" }).click();
  await app.screenshot({ path: `${out}/2g-hero-prefs.png` });
  await prefs.locator(".hx-prefs-pop").getByRole("button", { name: "Konum: Çok önemli kaldır" }).click();
  await prefs.locator(".hx-prefs-pop li", { hasText: "Konum" }).waitFor({ state: "detached" });
  await app.mouse.click(5, 5); // outside: the window closes
  await prefs.locator(".hx-prefs-pop").waitFor({ state: "detached" });
  assert.deepEqual(flat(await prefs.locator(".hx-ptag.strong").allInnerTexts()), ["Fiyat"]);
  console.log('✓ hero v9: four cells open their Plan sections, "Planlama %N" is what needs a booking in two greens (booked, planned) and lists the to-dos in groups, "Planı tamamla" goes to the next, Tercihler (tags, window, ×), a new trip\'s empty blocks fill as information arrives');

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
  await app.locator(".hx .hx-cities button", { hasText: "Madeira" }).waitFor();
  assert.deepEqual(await app.locator(".hx .hx-cities button").allInnerTexts(), ["Porto", "Madeira"], "Gaula is Madeira's on the hero, with no model");
  await app.locator(".hx .hx-cities button", { hasText: "Madeira" }).click();
  await app.waitForTimeout(1200); // the island's photo, when the network has one
  await app.locator(".hx").screenshot({ path: `${out}/2i-hero-madeira.png` });
  await madeiraItems({ ...madeira, put: false });
  console.log('✓ hero fix 2: Porto + a campervan picked up in Gaula is "Porto | Madeira" with no model; two style chips fit one line at 1280/1440 and in a 272 px card');

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
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  // The trip map (MapLibre) needs WebGL 2: headless Chromium draws it in software.
  args: [...HEADLESS_ARGS, LANG_ARG, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The offers' live data source answers nothing here: no test depends on live prices.
await flow.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
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
    if (last.includes("functionResponse")) return route.fulfill(reply([{ text: last.includes("plan_item") ? "Panoyu güncelledim." : "Fiyatı konaklamada çok önemli yaptım." }]));
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
  await board.getByText("İlk seçeneğini kaydet").waitFor({ timeout: 10000 }); // modal closed by itself
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
  const casaCard = board.locator('.swipe-card[aria-label="Casa Azul"]');
  // The analysis would rule it out; only the traveller can (0.28), so it's a thing to check before choosing.
  await casaCard.locator(".opt-status", { hasText: "Seçmeden kontrol et" }).filter({ hasText: "Yan binada inşaat" }).waitFor({ timeout: 40000 });
  assert.ok(analysisPrompts.some((p) => p.includes("Yan binada inşaat gürültüsü") && p.includes('"count":2')), "analysis sees findings and counts");
  await casaCard.getByRole("button", { name: "Detaylar ▾" }).click();
  const casaDetails = casaCard.locator(".card-details");
  await casaDetails.locator(".small-note", { hasText: "3 yorum incelendi (sitede 96)" }).waitFor();
  await casaDetails.locator(".cd-list.pros li", { hasText: "Altında çok iyi bir İtalyan restoranı · 1 yorum" }).waitFor();
  // Everything read, with the evidence behind it, is one tap deeper.
  await casaCard.getByRole("button", { name: "Tüm detaylar" }).click();
  const casaBody = board.getByRole("dialog");
  // A serious, recent problem costs points outright, and says so.
  await casaBody.locator(".pc-line.serious", { hasText: "Yan binada inşaat gürültüsü" }).getByText("puandan −8", { exact: false }).waitFor();
  const unverifiedPool = casaBody.locator(".pc-line.unverified", { hasText: "Çatı havuzu" });
  await unverifiedPool.getByText("sayfada doğrulanamadı").waitFor();
  await casaBody.getByText("Sayfada bulunamayan 2 alıntı gösterilmedi.").waitFor(); // the invented review and quote
  await casaBody.locator(".pc-line", { hasText: "Yan binada inşaat gürültüsü" }).first().getByRole("button", { name: "Kanıt" }).click();
  await casaBody.locator("blockquote", { hasText: "The building work next to the flat was loud all day" }).first().waitFor();
  await board.screenshot({ path: `${out}/8a-flow-reading.png`, fullPage: true });
  await casaBody.getByRole("button", { name: "Kapat" }).click();
  await casaCard.getByRole("button", { name: "Kapat ▴" }).click();
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
  const loftCard = board.locator('.stay-block.open .swipe-card[aria-label="Ribeira Loft"]');
  await loftCard.waitFor({ timeout: 20000 });
  assert.equal(await board.getByText("tarih seçilmemiş").count(), 0, "the undated stay is not set aside");
  await loftCard.locator(".sc-price", { hasText: "geçici" }).waitFor();
  await loftCard.getByRole("button", { name: "Detaylar ▾" }).click();
  await loftCard.locator(".card-details .cd-list.cons", { hasText: "Tarihsiz kaydedildi: bu gecelerin fiyatı belli değil" }).waitFor();
  const reopen = await loftCard.getByRole("link", { name: "Tarihlerle aç ↗" }).getAttribute("href");
  assert.match(reopen, /airbnb\.com\.tr\/rooms\/777\?.*check_in=2026-10-08&check_out=2026-10-11&adults=2/);
  await board.screenshot({ path: `${out}/8c-flow-undated.png`, fullPage: true });
  await loftCard.getByRole("button", { name: "Kapat ▴" }).click();
  console.log("✓ flow: an undated Airbnb page joins the same nights' comparison, provisionally, with a link to add the dates");

  // Two stays → the engine ranks them and the worker asks Gemini for the written analysis.
  await board.locator(".reco-line").getByRole("button", { name: "Karşılaştır →" }).click({ timeout: 20000 });
  let compare = board.getByRole("dialog", { name: "Karşılaştırma" });
  await compare.getByRole("tab", { name: /Tablo/ }).click();
  await compare.getByText("Jardim Stay merkezde ve yorumları tutarlı", { exact: false }).waitFor({ timeout: 20000 });
  await compare.locator("tr", { hasText: "AI değerlendirmesi" }).waitFor(); // fresh analysis → counts, labelled
  await compare.locator(".cell-value", { hasText: "merkeze 5 dk yürüme" }).waitFor(); // geocoded, measured from the city centre
  await compare.getByText("Airbnb ölçeği", { exact: false }).first().waitFor();
  await board.screenshot({ path: `${out}/8b-flow-compare.png`, fullPage: true });
  await compare.getByRole("button", { name: "Kapat" }).click();
  console.log("✓ flow: two options → ranked with geocoded distance, AI analysis fetched, shown and counted");

  await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("Hangisi daha mantıklı?");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.getByText("Fiyatı konaklamada çok önemli yaptım.").waitFor({ timeout: 20000 });
  assert.ok(chatPrompts[0].includes("decisions") && chatPrompts[0].includes("would_change_if"), "chat sees the engine's result");
  // Remembered as something the traveller said: a tag of the hero's "Tercihler" (scope and level in its window, removable there).
  await board.locator('.hx-ptag.strong[title="Fiyat · Çok önemli"]').waitFor();
  await board.locator(".reco-line").getByRole("button", { name: "Karşılaştır →" }).click();
  compare = board.getByRole("dialog", { name: "Karşılaştırma" });
  await compare.getByRole("tab", { name: /Tablo/ }).click();
  assert.equal(await compare.locator("tr", { hasText: "Fiyat" }).locator("select").inputValue(), "4");
  await compare.getByRole("button", { name: "Kapat" }).click();
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
  await say("Porto'da 8'i gecesi ayrı, 9-11 ayrı kalalım", "Panoyu güncelledim.");
  await board.locator("#block-2026-10-09").waitFor({ timeout: 10000 });
  await say("Porto tek blok olsun 8-11; 11 Ekim'e uçak bileti, otelden havalimanına taksi, eSIM de alalım", "Panoyu güncelledim.");
  await board.locator("#block-2026-10-09").waitFor({ state: "detached", timeout: 10000 });
  await board.locator("#block-2026-10-08 .slot-note").waitFor();
  await board.locator('.pk-card[aria-label="Uçuş"]').waitFor();
  // Nothing left to do in Ulaşım (the taxi is planned): its header all settled; v11: open at first look all the same.
  const transportSec = board.locator('.cat-sec[data-section="transport"]');
  assert.match(await transportSec.locator(".cat-count").innerText(), /^(\d+)\/\1$/);
  assert.doesNotMatch(await transportSec.getAttribute("class"), /closed/);
  await board.getByText("Taksi · Otel → Havalimanı").first().waitFor();
  const esim = board.locator('.pk-card[aria-label="eSIM"]');
  await esim.waitFor();
  await esim.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/9b-chat-plan.png` });
  await esim.getByRole("button", { name: "Kart menüsü" }).click();
  await esim.getByRole("menuitem", { name: "Sil" }).click();
  await esim.waitFor({ state: "detached" });
  await board.locator(".pk-undo", { hasText: "eSIM silindi" }).getByRole("button", { name: "Geri al" }).click();
  await esim.waitFor();
  await esim.getByRole("button", { name: "Kart menüsü" }).click();
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
  const otherSec = board.locator('.cat-sec[data-section="other"]');
  await otherSec.waitFor();
  if (await otherSec.evaluate((el) => el.classList.contains("closed"))) await otherSec.locator(".cat-title").click();
  const policyCard = otherSec.locator('.pk-card[aria-label="Seyahat sağlık sigortası · Allianz"]');
  await policyCard.locator(".pk-ring.done").waitFor();
  await policyCard.locator('.pk-docpill[title^="allianz-police.pdf"]').waitFor();
  assert.equal(await board.locator('.cat-sec[data-section="todo"] [aria-label="Seyahat sağlık sigortası · Allianz"]').count(), 0, "a policy is never a thing to do");
  await otherSec.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/13a-policy-card.png` });
  // Insurance isn't part of a day (satır standardı v2): no line of it in Günlük akış, in Liste or in Kartlar.
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  for (const view of ["Liste", "Kartlar"]) {
    await board.locator(".dc-seg").getByRole("tab", { name: view, exact: true }).click();
    await board.locator(".dc-tl > li").first().waitFor();
    assert.equal(await board.locator(".dc-tl > li", { hasText: /Allianz|sigorta/i }).count(), 0, `no insurance in the day (${view})`);
  }
  assert.equal(await board.locator(".dl-more, .dl-sub").count(), 0);
  await board.locator(".dc-seg").getByRole("tab", { name: "Liste", exact: true }).click();

  await board.getByRole("tab", { name: "Belgeler", exact: true }).click();
  const docRow = (name) => board.locator(`.doc-row[aria-label="${name}"]`);
  await board.locator('.doc-group[data-group="insurance"]').locator(`.doc-row[aria-label="allianz-police.pdf"]`).waitFor();
  assert.equal(await docRow("allianz-police.pdf").locator(".doc-go").innerText(), "Seyahat sağlık sigortası · Allianz →");
  await dropFile("rezervasyon-notu.pdf", "%PDF-1.4 e2e-other");
  await board.locator(".msg-assistant", { hasText: "rezervasyon-notu.pdf Belgeler'e kaydedildi" }).waitFor({ timeout: 20000 });
  await board.locator('.doc-group[data-group="other"]').locator('.doc-row[aria-label="rezervasyon-notu.pdf"] select.doc-link').waitFor();
  await board.locator(".pk-undo").waitFor({ state: "detached", timeout: 10000 }); // the eSIM's "Geri al" from before
  await board.locator(".doc-tab").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/13-belgeler.png` });
  await board.setViewportSize({ width: 560, height: 1000 });
  await board.locator(".doc-tab").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/13b-belgeler-narrow.png` });
  assert.ok(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in Belgeler");
  await board.setViewportSize({ width: 1440, height: 900 });
  // Linked by hand: it moves to its card's group and names it.
  const jardimLabel = await docRow("rezervasyon-notu.pdf").locator("select.doc-link option", { hasText: "Jardim Stay" }).first().innerText();
  await docRow("rezervasyon-notu.pdf").locator("select.doc-link").selectOption({ label: jardimLabel });
  await board.locator('.doc-group[data-group="stay"]').locator('.doc-row[aria-label="rezervasyon-notu.pdf"] .doc-go', { hasText: "Jardim Stay" }).waitFor();
  // Deleted, then taken back with "Geri al": back with its card.
  await docRow("rezervasyon-notu.pdf").hover();
  await docRow("rezervasyon-notu.pdf").locator(".doc-x").click();
  await docRow("rezervasyon-notu.pdf").waitFor({ state: "detached" });
  await board.locator(".pk-undo", { hasText: "rezervasyon-notu.pdf silindi" }).getByRole("button", { name: "Geri al" }).click();
  await docRow("rezervasyon-notu.pdf").locator(".doc-go", { hasText: "Jardim Stay" }).waitFor();
  await board.locator(".doc-tab").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/13c-belgeler-linked.png` });
  // From Belgeler to the card: the Plan, its section open, the card in view with a flash.
  await docRow("allianz-police.pdf").locator(".doc-go").click();
  await board.locator('[role="tab"][aria-selected="true"]', { hasText: "Plan" }).waitFor();
  await policyCard.and(board.locator(".flash")).waitFor({ timeout: 5000 });
  console.log("✓ 0.34.6: a policy PDF dropped in the chat → booked insurance in Diğer with its file; Belgeler groups it, goes to its card; an unplaced file linked by hand; deleted and taken back");

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
  // A lone option has nothing to be compared with: no score, but its measured criteria are one click away.
  await board.locator(".verdict-line", { hasText: "bir seçenek daha kaydet" }).click();
  await board.getByRole("dialog", { name: "Karşılaştırma" }).getByText("Puan, karşılaştırınca çıkar").waitFor();
  await board.getByRole("dialog", { name: "Karşılaştırma" }).getByRole("button", { name: "Kapat" }).click();
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
    () => JSON.stringify([...document.querySelectorAll(".hx-cities button")].map((b) => b.textContent)) === JSON.stringify(["Porto", "Madeira"]),
    null,
    { timeout: 15000 },
  );
  const stays = board.locator('.cat-sec[data-section="stay"]');
  if ((await stays.locator(".cat-body").count()) === 0) await stays.locator(".cat-title").click();
  await stays.locator(".cat-date", { hasText: "Gaula" }).waitFor();
  await stays.locator(".cat-date", { hasText: "Funchal" }).waitFor();
  assert.equal(await board.locator(".hx-cities button", { hasText: "Gaula" }).count(), 0, "a town on Madeira isn't a destination of its own");
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
  await board.locator(".hx").scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/14-hero-main-places.png` });
  // Günlük akış says the routes the hero's way (display only): "Porto → Madeira", never "Porto → Funchal"; within
  // one main place the places themselves ("Funchal → Gaula", never "Madeira → Madeira"); nothing saved, a "Yolculuk".
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".dc-seg").getByRole("tab", { name: "Liste", exact: true }).click();
  await board.locator(".dl-date", { hasText: "Porto → Madeira" }).first().waitFor();
  const routes = await board.locator(".dl-date, .dc-ttl").allInnerTexts();
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
  await board.locator(".hx").scrollIntoViewIfNeeded();
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
  const waitingStay = board.locator('.cat-sec[data-section="stay"] .ar-pending', { hasText: "airbnb.com" });
  await waitingStay.waitFor({ timeout: 8000 });
  assert.match(await waitingStay.innerText(), /Airbnb okunuyor…|Fiyat ve tarihler bulunuyor…|Plana yerleşiyor…/);
  assert.equal(await board.locator(".ar-lead .ar-pending", { hasText: "airbnb.com" }).count(), 0, "a link from Airbnb waits in Konaklama, not under the header");
  // The chat shows the link as sent, its chip working.
  const arriveChip = board.locator(".ar-sent", { hasText: "e2e-arrive" }).locator(".ar-chip");
  await arriveChip.locator(".ar-spin").waitFor();
  await waitingStay.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/15a-arrive-pending.png` });
  // It lands: the waiting card gives way, the new card comes in with the arrival class.
  const landed = board.locator(".ar-new", { hasText: "Casa Verde" });
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
  await board.locator(".hx").scrollIntoViewIfNeeded();
  await arriveChip.getByRole("button", { name: "göster" }).click();
  await board.locator('[data-item-id].flash, [data-option-ids].flash').first().waitFor({ state: "attached", timeout: 5000 });
  // A link that couldn't be read: its card stays in sight under the Plan's header, even though its guessed
  // section (Konaklama) is closed, with "Tekrar dene" and "Kaldır"; Kaldır takes it away.
  const staySec = board.locator('.cat-sec[data-section="stay"]');
  if (!(await staySec.evaluate((el) => el.classList.contains("closed")))) await staySec.locator(".cat-title").click();
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
  assert.ok(await staySec.evaluate((el) => el.classList.contains("closed")), "its guessed section stays closed");
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
  const sgSec = (id) => board.locator(`.cat-sec[data-section="${id}"]`);
  const openSec = async (id) => {
    if (await sgSec(id).evaluate((el) => el.classList.contains("closed"))) await sgSec(id).locator(".cat-title").click();
  };
  await sgSec("transport").locator(".sg-count", { hasText: "1 öneri" }).waitFor({ timeout: 10000 });
  // Only suggested: drawn for its card, with nothing to count (no bar, no "x/y").
  assert.equal(await sgSec("transport").locator(".cat-count, .cat-bar").count(), 0, "a suggestion is never counted");
  assert.ok(await sgSec("transport").evaluate((el) => el.classList.contains("closed")), "a section with only suggestions stays closed");
  await openSec("transport");
  const rentalCard = sgSec("transport").locator(".sg-card", { hasText: "Aylık motor ya da araç kiralama" });
  await rentalCard.waitFor();
  // Ubud is Bali's (the hero's main place, from the table of regions): the nights are counted for Bali.
  assert.match(await rentalCard.innerText(), /25 gece Bali'de kalıyorsun/);
  assert.doesNotMatch(await rentalCard.innerText(), /%/, "no invented percentage");
  // Insurance is a suggestion ("1 öneri"); the eSIM is its empty card (boş kartlar), Airalo and Holafly for Indonesia.
  await sgSec("other").locator(".sg-count", { hasText: "1 öneri" }).waitFor();
  await openSec("other");
  const esimCard = sgSec("other").locator('.ek-card[data-suggestion="rule:esim"]');
  await esimCard.waitFor();
  assert.equal(await esimCard.locator(".ek-txt b").innerText(), "eSIM · Endonezya");
  assert.equal(await esimCard.locator(".ek-state").innerText(), "Alınmadı");
  assert.deepEqual(await esimCard.locator(".ek-link").evaluateAll((els) => els.map((a) => a.getAttribute("href"))), ["https://www.airalo.com/indonesia-esim", "https://esim.holafly.com/esim-indonesia/"]);
  assert.equal(await sgSec("other").locator(".sg-card", { hasText: "eSIM" }).count(), 0, "the eSIM is never a suggestion card too");
  await sgSec("transport").scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/19-suggestions.png` });
  // Plana ekle: the rental is a real card in Ulaşım now; the suggestion is done.
  await rentalCard.getByRole("button", { name: "Plana koy" }).click();
  await rentalCard.waitFor({ state: "detached" });
  // The rental's card (kind "Motosiklet", the place's days), planned and not booked: a real "0/1" now.
  await sgSec("transport").getByText("Motosiklet", { exact: true }).first().waitFor();
  assert.match(await sgSec("transport").locator(".cat-count").innerText(), /^0\/1$/);
  await sgSec("transport").locator(".cat-count").waitFor();
  assert.equal(await sgSec("transport").locator(".sg-count").count(), 0);
  // Gerek yok: the eSIM's empty card goes (its suggestion dismissed), the insurance suggestion stays.
  await esimCard.getByRole("button", { name: "Gerek yok" }).click();
  await esimCard.waitFor({ state: "detached" });
  await sgSec("other").locator(".sg-count", { hasText: "1 öneri" }).waitFor();
  await board.waitForTimeout(300); // the trip write lands
  await board.reload();
  await board.getByRole("heading", { name: "Bali" }).waitFor();
  await sgSec("other").locator(".sg-count", { hasText: "1 öneri" }).waitFor({ timeout: 10000 });
  await openSec("other");
  await sgSec("other").locator(".sg-card", { hasText: "Seyahat sağlık sigortası" }).waitFor();
  assert.equal(await sgSec("other").locator('.sg-card:has-text("eSIM"), .ek-card[data-suggestion="rule:esim"]').count(), 0, "Gerek yok is for good");
  assert.equal(await sgSec("transport").locator(".sg-card").count(), 0, "the added suggestion doesn't come back");
  await sgSec("transport").getByText("Motosiklet", { exact: true }).first().waitFor();
  assert.equal(reviewPrompts.filter((p) => p.includes("Ubud")).length, 1, "the AI review is asked once for the trip");
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
  await board.locator(".st-msg-bot", { hasText: "Nereden yola çıkıyorsun?" }).waitFor();
  // Only what the first message left out is asked (item 2).
  const side = board.locator(".st-side");
  const list = side.locator(".st-list");
  await list.getByText("Bali · Endonezya").waitFor();
  await list.getByText("10 Aralık – 10 Ocak · 31 gece").waitFor();
  await list.getByText("Sabine ile · 2 kişi").waitFor();
  assert.equal(await answers.locator(".st-chip").first().innerText(), "İstanbul", "the origin's guess comes first");
  await answers.getByRole("button", { name: "İstanbul", exact: true }).click();
  // The essentials known: the countdown (6 s, the style question shows); stopped here to go on by hand.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-msg-bot", { hasText: "Bu gezide en çok ne istiyorsun?" }).waitFor();
  await answers.getByRole("button", { name: /Doğa/ }).click();
  await answers.getByRole("button", { name: /Deniz/ }).click();
  await answers.getByRole("button", { name: /Orta/ }).click();
  await answers.getByRole("button", { name: "Tamam" }).click();
  await board.locator(".st-msg-bot", { hasText: "Rota önerim: Ubud 12 · Canggu 10 · Uluwatu 9 gece. Bu olsun mu?" }).waitFor();
  assert.equal(startPrompts.length, 2, "the model read the one typed line and was asked for the route once (prepared in the background as soon as Bali and 31 nights were known)");
  assert.equal(replyPrompts.length, 0, "a quick answer costs no model call");
  await board.screenshot({ path: `${out}/20b-start-interview.png` });
  // Narrow (item 9): the list folds into a bar above the chat.
  await board.setViewportSize({ width: 560, height: 900 });
  await board.locator(".st-bar", { hasText: "Gezin şekilleniyor" }).waitFor();
  assert.equal(await side.isVisible(), false, "no side list on a narrow screen");
  await board.screenshot({ path: `${out}/20b2-start-narrow.png` });
  await board.setViewportSize({ width: 1440, height: 900 });
  await answers.getByRole("button", { name: "Bu olsun" }).click();
  await board.locator(".st-msg-bot", { hasText: "Hazırım, birkaç saniye içinde oluşturuyorum. Eklemek istediğin bir şey varsa yaz." }).waitFor();
  // Stopped, the line says it waits; "oluştur" typed makes it at once.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  // "Tamam, bekliyorum…", or just "Bekliyorum…" right after another "Tamam" (never twice in a row); hasText ignores case.
  await board.locator(".st-msg-bot", { hasText: "bekliyorum. Hazır olunca Oluştur'a bas ya da 'oluştur' yaz." }).waitFor();
  assert.equal(await board.locator(".st-msg-bot", { hasText: "Hazırım" }).count(), 0, "the ready line said as waiting");
  await watchGen();
  await board.locator(".st-chat").getByLabel("Mesaj").fill("oluştur");
  await board.locator(".st-chat").getByLabel("Mesaj").press("Enter");
  await board.locator(".st-gen", { hasText: "Bali Gezisi planlanıyor" }).waitFor();
  await board.screenshot({ path: `${out}/20c-start-generating.png` });
  // The board: the trip, its nights by stop and its flights to plan, the start card, the same conversation.
  await board.getByRole("heading", { name: "Bali Gezisi" }).waitFor({ timeout: 20000 });
  const baliGen = await genSeen();
  assert.equal(baliGen.sub, "İstanbul → Ubud → Canggu → Uluwatu · 31 gece");
  for (const step of ["Gezi açıldı: Bali Gezisi", "İstanbul ⇄ Denpasar uçuşları için yer açıldı", "Rota çizildi: Ubud 12 gece → Canggu 10 gece → Uluwatu 9 gece"]) assert.ok(baliGen.steps.includes(step), `step "${step}" (${baliGen.steps.join(" | ")})`);
  // The suggestions' review is the last real step (the same review the board runs, so it isn't asked again there).
  assert.ok(baliGen.steps.some((x) => /öneri bölümlerinde|Şimdilik öneri yok/.test(x)), "the suggestions' step");
  const guide = board.locator(".st-guide");
  await guide.getByText("Uçuşları bul").waitFor();
  await guide.getByText("Konaklamaları seç").waitFor();
  const made = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => t.title === "Bali Gezisi");
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
  // The hero tells the truth: the flights and nights are still to fill (no "Uçuşlar hazır"); the style words picked,
  // who goes and the country are there at once.
  const hero = board.locator(".hx");
  await hero.getByText("2 uçuş ve 31 gece seni bekliyor.").waitFor();
  // The review ran once, in the generating step; the board, opening on the same main places and key, didn't ask again.
  await board.waitForTimeout(1500);
  assert.equal(reviewPrompts.filter((p) => p.includes("Uluwatu")).length, 1, "the start's review is the board's: asked once");
  assert.equal(await hero.getByText("Uçuşlar hazır", { exact: false }).count(), 0, "placeholders are not chosen flights");
  await hero.getByText("Doğa", { exact: true }).first().waitFor();
  await hero.getByText("Deniz", { exact: true }).first().waitFor();
  await hero.getByText("Sabine", { exact: false }).first().waitFor();
  await hero.getByText("Endonezya", { exact: false }).first().waitFor();
  assert.equal(await hero.getByText("Ülke ve hava, şehir belli olunca gelir").count(), 0, "the country is known");
  const panel = board.locator(".panel");
  for (const city of ["Ubud", "Canggu", "Uluwatu"]) await panel.locator("[data-section='stay']").getByText(city, { exact: false }).first().waitFor();
  await panel.locator("[data-section='flight']").getByText("Denpasar", { exact: false }).first().waitFor();
  await board.locator(".chat .msg-user", { hasText: "Sabine'yle 10 Aralık'tan 1 ay Bali" }).waitFor();
  // "oluştur" typed is kept as said (not swapped for the button's words).
  await board.locator(".chat .msg-user", { hasText: /^oluştur$/ }).waitFor();
  await board.locator(".chat .msg-assistant", { hasText: "Bali Gezisi hazır: 31 gece, 3 durak." }).waitFor();
  await guide.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/20d-start-board.png` });
  // × closes the start card for good.
  await guide.getByRole("button", { name: "Başlangıç kartını kapat" }).click();
  await guide.waitFor({ state: "detached" });
  console.log("✓ start by chat: one line fills who/when/where, chips finish it, the route agreed → Bali Gezisi with Ubud 12 · Canggu 10 · Uluwatu 9 nights, İstanbul ⇄ Denpasar flights to fill (not chosen), Emre & Sabine, Doğa · Deniz, Indonesia, the suggestions' review, the start card and the same conversation");

  // 22. Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): the new trip's needs with nothing booked or saved are
  // the approved cards made plain: dashed, white, one grey word, then "Ara:" and the brands' searches, prefilled with
  // the cities, the dates and the two who go. No AI source is connected, so no "✨ Senin için N öneri" row.
  const ekSec = (id) => panel.locator(`.cat-sec[data-section="${id}"]`);
  const ekOpen = async (id) => {
    if (await ekSec(id).evaluate((el) => el.classList.contains("closed"))) await ekSec(id).locator(".cat-title").click();
    await ekSec(id).locator(".cat-body").waitFor();
  };
  const hrefs = (scope) => scope.locator(".ek-link").evaluateAll((els) => els.map((a) => [a.dataset.brand, a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
  for (const id of ["flight", "stay", "transport", "other"]) await ekOpen(id);
  // Emre's rule: what the start made (startGuide.placeholders) is never the yellow "Seçildi · bilet alınmadı" card.
  assert.equal(await panel.locator(".cat-plan .pk-card.pk-sand, .cat-plan .settled-card").count(), 0, "no yellow card for a placeholder: only empty cards");
  assert.equal(await panel.locator(".cat-plan .pk-cta", { hasText: /Bileti aldım|Rezerve ettim/ }).count(), 0);
  // Uçuş: İstanbul → Denpasar and back, "Bilet yok · 2 kişi"; Google Flights by city, Skyscanner and Kayak by airport.
  const [outFlight, backFlight] = [ekSec("flight").locator(".ek-card").nth(0), ekSec("flight").locator(".ek-card").nth(1)];
  assert.equal(await ekSec("flight").locator(".ek-card").count(), 2, "both flights the start made are empty cards");
  assert.equal(await ekSec("flight").locator(".pk-card:not(.ek-card)").count(), 0, "no full flight card yet");
  assert.match(await outFlight.locator(".ek-route").innerText(), /İstanbul[\s\S]*Denpasar/);
  assert.equal(await outFlight.locator(".ek-state").innerText(), "Bilet yok · 2 kişi");
  assert.equal(await outFlight.locator(".ek-ara").innerText(), "Ara:");
  assert.equal(await outFlight.locator(".pk-cta, .pk-price").count(), 0, "no price, no Bileti aldım");
  const out1 = await hrefs(outFlight);
  assert.deepEqual(out1.map(([b, , t, r]) => [b, t, r]), [["gflights", "_blank", "noopener noreferrer"], ["skyscanner", "_blank", "noopener noreferrer"], ["kayak", "_blank", "noopener noreferrer"]]);
  assert.equal(new URL(out1[0][1]).searchParams.get("q"), "Flights from İstanbul to Denpasar on 2026-12-10 one way");
  assert.equal(out1[1][1], "https://www.skyscanner.net/transport/flights/ist/dps/261210/?adultsv2=2&rtn=0");
  assert.equal(out1[2][1], "https://www.kayak.com/flights/IST-DPS/2026-12-10/2adults");
  const back1 = await hrefs(backFlight);
  assert.equal(new URL(back1[0][1]).searchParams.get("q"), "Flights from Denpasar to İstanbul on 2027-01-10 one way");
  assert.equal(back1[2][1], "https://www.kayak.com/flights/DPS-IST/2027-01-10/2adults");
  // Konaklama: each stop's nights, "Henüz otel yok"; Booking and Airbnb with the nights and 2 adults.
  const ubud = ekSec("stay").locator(".ek-card", { hasText: "Ubud" }).first();
  assert.equal(await ubud.locator(".ek-state").innerText(), "Henüz otel yok");
  assert.match(await ubud.locator(".ek-txt").innerText(), /Ubud\s*12 gece · 2 kişi · otel seçilmedi/);
  const ubudLinks = await hrefs(ubud);
  assert.deepEqual(ubudLinks.map(([b, u]) => [b, u]), [
    ["booking", "https://www.booking.com/searchresults.html?ss=Ubud&checkin=2026-12-10&checkout=2026-12-22&group_adults=2&no_rooms=1"],
    ["airbnb", "https://www.airbnb.com/s/Ubud/homes?checkin=2026-12-10&checkout=2026-12-22&adults=2"],
  ]);
  assert.equal(await ekSec("stay").locator(".ek-card").count(), 3, "three stops, three empty stays");
  // Ulaşım: the transfers and changes of city with no plan, "Nasıl gideceğin belli değil", Uber and the directions.
  const transfers = ekSec("transport").locator(".ek-card.pk-leg");
  assert.ok((await transfers.count()) >= 2, "the transfers with no plan are empty cards");
  const firstLeg = transfers.first();
  assert.equal(await firstLeg.locator(".ek-state").innerText(), "Nasıl gideceğin belli değil");
  const legLinks = await hrefs(firstLeg);
  assert.deepEqual(legLinks.map(([b]) => b), ["uber", "maps"]);
  assert.match(decodeURIComponent(legLinks[0][1]), /^https:\/\/m\.uber\.com\/ul\/\?action=setPickup&.*dropoff\[formatted_address\]=/);
  assert.equal(await firstLeg.getByRole("link", { name: "Yol tarifi" }).count(), 1);
  // Diğer: the eSIM for Indonesia, "Alınmadı", Airalo and Holafly.
  const esimEmpty = ekSec("other").locator('.ek-card[data-suggestion="rule:esim"]');
  assert.equal(await esimEmpty.locator(".ek-state").innerText(), "Alınmadı");
  assert.deepEqual((await hrefs(esimEmpty)).map(([, u]) => u), ["https://www.airalo.com/indonesia-esim", "https://esim.holafly.com/esim-indonesia/"]);
  // Etkinlikler: a card per stop with nothing booked there.
  await ekOpen("activity");
  assert.equal(await ekSec("activity").locator(".ek-card").count(), 3);
  assert.deepEqual((await hrefs(ekSec("activity").locator(".ek-card", { hasText: "Canggu" }))).map(([, u]) => u), [
    "https://www.getyourguide.com/s/?q=Canggu",
    "https://www.viator.com/searchResults/all?text=Canggu",
    "https://www.klook.com/search/result/?query=Canggu",
  ]);
  // The source finds nothing (routed empty): no offers' row anywhere; the logos are drawn here (no request to a brand's site).
  assert.equal(await panel.locator(".ek-offers").count(), 0, "no offers' row when the source finds nothing");
  assert.equal(await panel.locator(".ek-card img").count(), 0, "no brand image fetched");
  // The look: a white ground in a dashed frame, the cities 17 px.
  assert.deepEqual(await outFlight.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopStyle, getComputedStyle(el.querySelector(".ek-end b")).fontSize]), ["rgb(255, 255, 255)", "dashed", "17px"]);
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/22a-empty-cards.png` });
  await board.setViewportSize({ width: 560, height: 1400 });
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/22b-empty-cards-narrow.png` });
  assert.ok(await board.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll with empty cards");
  await board.setViewportSize({ width: 1440, height: 900 });
  // Günlük akış keeps its own markup: no empty card there.
  await board.getByRole("tab", { name: "Gün gün", exact: true }).click();
  await board.locator(".panel .dc-bar").waitFor();
  assert.equal(await panel.locator(".ek-card, .ek-route, .ek-foot, .ek-find, .ek-link, .ek-line").count(), 0, "no empty card in Günlük akış");
  await board.getByRole("tab", { name: "Plan", exact: true }).click();
  await ekSec("flight").waitFor();
  // A placeholder's day edited where it stands: still nothing concrete, so still the empty card (never the yellow one).
  const backId = await ekSec("flight").locator(".ek-card").nth(1).getAttribute("data-item-id");
  const back = panel.locator(`.ek-card[data-item-id="${backId}"]`);
  await back.getByRole("button", { name: "Tarih: düzenle" }).click();
  await board.locator('.pk-ed-input[aria-label="Tarih"]').fill("2027-01-09");
  await board.locator('.pk-ed-input[aria-label="Tarih"]').press("Enter");
  await board.locator('.pk-ed-input[aria-label="Tarih"]').waitFor({ state: "detached" });
  await back.locator(".pk-date", { hasText: "9 Ocak" }).waitFor();
  assert.equal(await panel.locator(`[data-item-id="${backId}"].pk-sand, [data-item-id="${backId}"] .pk-sand, .cat-plan .settled-card`).count(), 0, "an edited placeholder stays an empty card");
  assert.equal(new URL((await hrefs(back))[0][1]).searchParams.get("q"), "Flights from Denpasar to İstanbul on 2027-01-09 one way");
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
      const trip = (await all("trips")).find((x) => x.title === t);
      return { trip, items: (await all("items")).filter((i) => i.tripId === trip.id) };
    }, title);
  const bali = await tripRecords("Bali Gezisi");
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
  // Sabine's own flight there: an empty card with her badge, searched from Alicante for one.
  const hers = ekSec("flight").locator('.ek-card[aria-label="Uçuş · Alicante → Denpasar"]');
  await hers.waitFor({ timeout: 10000 });
  const badge = hers.locator(".pk-top .wh-badge");
  assert.equal(await badge.locator(".wh-label").innerText(), "Sabine'in bileti");
  assert.equal(await badge.locator(".wh-av").innerText(), "S", "her initial: no photo given");
  assert.deepEqual(await badge.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopColor, getComputedStyle(el).color]), ["rgb(255, 255, 255)", "rgb(230, 225, 247)", "rgb(75, 63, 176)"]);
  assert.equal(await hers.locator(".ek-state").innerText(), "Bilet yok · 1 kişi");
  const herLinks = await hrefs(hers);
  assert.equal(new URL(herLinks[0][1]).searchParams.get("q"), "Flights from Alicante to Denpasar on 2026-12-10 one way");
  assert.equal(herLinks[1][1], "https://www.skyscanner.net/transport/flights/alc/dps/261210/?adultsv2=1&rtn=0");
  assert.equal(herLinks[2][1], "https://www.kayak.com/flights/ALC-DPS/2026-12-10/1adults");
  // The trip's own flight there is the rest's now: "Emre'nin bileti", for one.
  const mainOut = ekSec("flight").locator('.ek-card[aria-label="Uçuş · İstanbul → Denpasar"]');
  assert.equal(await mainOut.locator(".ek-state").innerText(), "Bilet yok · 1 kişi");
  await mainOut.locator(".wh-badge .wh-label", { hasText: "Emre'nin bileti" }).waitFor({ timeout: 10000 });
  assert.equal(await mainOut.locator(".wh-av").innerText(), "E");
  assert.match((await hrefs(mainOut))[1][1], /adultsv2=1&/);
  // The section counts each ticket on its own (no route dedupe): three flights to book now.
  assert.match(await ekSec("flight").locator(".cat-count").innerText(), /^0\/3$/);
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.waitForTimeout(1500); // the new card's arrival glow fades
  await board.screenshot({ path: `${out}/23a-per-person-flight.png` });
  // The hero's people box: "Alicante'den" under Sabine.
  await board.locator(".hx .hx-side button.hx-people").click();
  const whoBox = board.getByRole("dialog", { name: "Kimler gidiyor?" });
  await whoBox.locator(".hx-who-list li", { hasText: "Sabine" }).locator(".wh-from", { hasText: "Alicante'den" }).waitFor();
  await board.screenshot({ path: `${out}/23b-per-person-who.png` });
  await board.keyboard.press("Escape");
  await whoBox.waitFor({ state: "detached" });
  // "Evet, Alicante": answered by the code, her flight home opened the same way.
  await board.locator(".choices").getByRole("button", { name: "Evet, Alicante" }).click();
  await board.locator(".msg-assistant", { hasText: "Sabine'in dönüşünü ekledim: Denpasar → Alicante" }).waitFor({ timeout: 10000 });
  assert.equal(chipCalls.length, 0, "a chip of the code's question costs no model call");
  const herHome = ekSec("flight").locator('.ek-card[aria-label="Uçuş · Denpasar → Alicante"]');
  await herHome.waitFor({ timeout: 10000 });
  assert.equal(await herHome.locator(".wh-label").innerText(), "Sabine'in bileti");
  const mainBack = ekSec("flight").locator(`.ek-card[data-item-id="${mainHome.id}"]`);
  assert.equal(await mainBack.locator(".ek-state").innerText(), "Bilet yok · 1 kişi");
  await mainBack.locator(".wh-badge .wh-label", { hasText: "Emre'nin bileti" }).waitFor({ timeout: 10000 });
  // Its own "Geri al" (the board's toast): her flight home goes, the trip's own is everyone's again; then again.
  const backToast = board.locator(".pk-undo", { hasText: "Sabine'in dönüşü eklendi: Denpasar → Alicante" });
  await backToast.getByRole("button", { name: "Geri al" }).click();
  await herHome.waitFor({ state: "detached", timeout: 10000 });
  await mainBack.locator(".wh-badge").waitFor({ state: "detached" });
  assert.equal(await mainBack.locator(".ek-state").innerText(), "Bilet yok · 2 kişi");
  // "bu bilet Sabine'in" on an existing flight: its badge appears.
  await chatBox.fill("bu bilet Sabine'in, İstanbul'a dönüş");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.locator(".msg-assistant", { hasText: "Tamam, dönüş bileti artık Sabine'in." }).waitFor({ timeout: 20000 });
  assert.ok(perPersonPrompts[1].includes(String.raw`\"from\":{\"Sabine\":\"Alicante\"}`), "the model sees who comes from where");
  assert.ok(perPersonPrompts[1].includes(String.raw`\"for_who\":[\"Sabine\"]`), "and whose each plan is");
  const marked = ekSec("flight").locator(`.ek-card[data-item-id="${mainHome.id}"]`);
  await marked.locator(".wh-badge .wh-label", { hasText: "Sabine'in bileti" }).waitFor({ timeout: 10000 });
  // The stays are everyone's: no badge on any of them.
  assert.equal(await ekSec("stay").locator(".wh-badge").count(), 0, "the shared stays show nothing");
  await ekSec("flight").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/23c-per-person-owner.png` });
  const after = await tripRecords("Bali Gezisi");
  assert.deepEqual(after.trip.travellers.from, { Sabine: "Alicante" });
  assert.deepEqual(after.items.find((i) => i.id === mainHome.id).forWho, ["Sabine"]);
  await flow.unroute("https://generativelanguage.googleapis.com/**", perPerson);
  // 23b. Üç akıllı konaklama önerisi (stayPicks.ts, owner-approved MVP): the source's candidates for Ubud (fixed here,
  // €40/47/103/155/173/209 by the night) narrowed to three labelled cards under its empty card, "Sana en uygun",
  // "Daha ekonomik", "Daha konforlu", each with its price and scope and one line of why; Favorile saves one as an
  // option of the need.
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
  await board.locator(".panel .dc-bar").waitFor();
  await board.getByRole("tab", { name: "Plan", exact: true }).click();
  await ekOpen("stay");
  const ubudCard = ekSec("stay").locator(".ek-card", { hasText: "Ubud" }).first();
  // The row sits right under its card (EmptyCard draws it after the card itself).
  const picksRow = ekSec("stay").locator('.ek-card:has-text("Ubud") + .ek-offers.ek-picks').first();
  await picksRow.waitFor({ timeout: 10000 });
  assert.ok(candidatesAsked.length >= 1 && candidatesAsked.every((u) => /start=2026-12-10/.test(u) && /end=2026-12-22/.test(u)), "Ubud's candidates asked for its nights");
  // Closed at first: the count only.
  assert.equal(await picksRow.locator(".ek-offers-head").innerText().then((t) => t.replace(/\s+/g, " ").trim()), "✨ Senin için 3 öneri ▾");
  assert.equal(await picksRow.locator(".ek-pick").count(), 0, "closed by default");
  await picksRow.locator(".ek-offers-head").click();
  const pickCards = picksRow.locator(".ek-pick");
  await pickCards.first().waitFor();
  assert.equal(await pickCards.count(), 3, "three cards");
  assert.deepEqual(await picksRow.locator(".ek-pick-label").allInnerTexts(), ["Sana en uygun", "Daha ekonomik", "Daha konforlu"]);
  assert.deepEqual(await picksRow.locator(".ek-pick-name").allInnerTexts(), ["Alaya Resort", "Bucu View", "Mandapa"]);
  assert.match(await pickCards.nth(1).innerText(), /★ 4,3[\s\S]*380 yorum[\s\S]*€40 \/ gece · 12 gece €480[\s\S]*Bulduklarımın en ucuzu, ★4,3/);
  assert.match(await pickCards.nth(2).innerText(), /Gecelik €106 daha fazla ama ★4,9/);
  assert.equal(await pickCards.nth(0).getByRole("link", { name: "İncele ↗" }).getAttribute("href"), "https://www.booking.com/hotel/id/e2e-alaya.html");
  // Wide: three side by side, the best one accented.
  const tops = await pickCards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  assert.equal(new Set(tops).size, 1, "three columns when wide");
  assert.equal(await pickCards.nth(0).locator(".ek-pick-label").evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
  await ubudCard.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await board.screenshot({ path: `${out}/29a-stay-picks.png` });
  // Narrow: stacked.
  await board.setViewportSize({ width: 560, height: 1400 });
  const narrowTops = await pickCards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  assert.equal(new Set(narrowTops).size, 3, "stacked when narrow");
  await ubudCard.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await board.screenshot({ path: `${out}/29b-stay-picks-narrow.png` });
  await board.setViewportSize({ width: 1440, height: 900 });
  // Favorile: "Daha ekonomik" saved as an option of Ubud's nights, its page, rating and reviews, price for the nights.
  await pickCards.nth(1).getByRole("button", { name: "Bucu View: favorile" }).click();
  let favoured = [];
  for (let i = 0; i < 50 && !favoured.length; i++) {
    favoured = (await tripRecords("Bali Gezisi")).items.filter((x) => x.name === "Bucu View");
    if (!favoured.length) await board.waitForTimeout(100);
  }
  assert.deepEqual(
    favoured.map((x) => [x.category, x.status, x.city, x.dates.start, x.dates.end, x.url, x.provider, x.rating.value, x.rating.count, x.price.amount]),
    [["stay", "saved", "Ubud", "2026-12-10", "2026-12-22", "https://www.booking.com/hotel/id/e2e-bucu.html", "Booking", 4.3, 380, 480]],
  );
  await board.screenshot({ path: `${out}/29c-stay-picks-favoured.png` });
  await flow.unroute("**/functions/v1/offers**", candidatesFn);
  console.log("✓ stay picks: Ubud's six candidates narrowed to 'Sana en uygun' Alaya Resort, 'Daha ekonomik' Bucu View (€40 / gece · 12 gece €480), 'Daha konforlu' Mandapa (€106 more, ★4,9); closed at first, 3 columns wide, stacked narrow; Favorile saves Bucu View as Ubud's option");
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
  await board.locator(".cat-sec").first().waitFor();
  assert.equal(await board.locator(".wh-badge").count(), 0, "a one-person trip shows no badge");
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
  if (await other27.evaluate((el) => el.classList.contains("closed"))) await other27.locator(".cat-title").click();
  const booked27Cards = other27.locator(".pk-card", { has: board.locator(".pk-kind", { hasText: "eSIM" }) });
  const booked27Card = other27.locator('.pk-card[data-item-id="e2e-esim"]');
  await booked27Card.locator("h3", { hasText: "10 GB · Portekiz" }).waitFor({ timeout: 10000 });
  assert.equal(await booked27Cards.count(), 1, "one eSIM card, never a second");
  assert.match(await booked27Card.innerText(), /Kuruldu/, "still bought and installed");
  const booked27Row = other27.locator(".cat-day", { has: board.locator('.pk-card[data-item-id="e2e-esim"]') });
  assert.equal(await booked27Row.locator(".cat-date b").innerText(), "Tüm gezi");
  assert.equal(await other27.locator(".cat-date b", { hasText: "Tarihsiz" }).count(), 0, "not under 'Tarihsiz'");
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
  const asideHero = await board.locator(".hx .hx-bar").getAttribute("aria-label");
  // What's still "Rezerve edilecek", by name, for the message.
  await board.locator(".hx button.hx-progress-count").click();
  const asideLeft = await board.locator(".hx + .todo-list .todo-group", { has: board.locator(".todo-head", { hasText: "Rezerve edilecek" }) }).locator("li").allInnerTexts();
  await board.locator(".hx button.hx-progress-count").click();
  console.log("  left to book:", JSON.stringify(asideLeft), JSON.stringify(asideAfter.filter((i) => i.status === "chosen").map((i) => [i.name, i.category, i.plannedKind ?? null, i.noBooking ?? null])));
  assert.ok(!/(\d+) planlandı/.test(asideHero ?? "") || /\b0 planlandı/.test(asideHero ?? ""), `nothing left planned to book (${asideHero})`);
  await board.screenshot({ path: `${out}/27c-aside-done.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", asideModel);
  console.log(`✓ chat 'gerisi fikir olarak kalsın': ${asideBefore.length} unbooked plans set aside one step at a time, the steps shown as it worked, none left to book (${asideHero})`);

  // 20d1c. The plan as a PDF file (0.36.51; a file since 0.36.55): at %100 the hero's main button is "Planı PDF olarak
  // indir"; the page laid out for paper (the hero as drawn, the bookings, every day's lines) is saved as a PDF named
  // after the trip, no print window.
  await board.locator(".hx-go", { hasText: "Planı PDF olarak indir" }).waitFor({ timeout: 10000 });
  await board.evaluate(() => {
    window.__printed = 0;
    window.print = () => void (window.__printed += 1);
  });
  const [pdfFile] = await Promise.all([board.waitForEvent("download", { timeout: 30000 }), board.locator(".hx-go", { hasText: "Planı PDF olarak indir" }).click()]);
  assert.match(pdfFile.suggestedFilename(), /^Portekiz .*Trip Radar\.pdf$/, "named after the trip");
  await pdfFile.saveAs(`${out}/27d-plan.pdf`);
  const pdfBytes = readFileSync(`${out}/27d-plan.pdf`);
  assert.equal(pdfBytes.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  const pdfPages = (pdfBytes.toString("latin1").match(/\/Type \/Page /g) ?? []).length;
  assert.ok(pdfPages >= 2, `the hero and the days on their pages (${pdfPages})`);
  assert.equal(await board.evaluate(() => window.__printed), 0, "no print window");
  await board.locator(".print-plan").waitFor({ state: "detached" });
  console.log(`✓ plan as PDF: at %100 the main button saves the plan as a file (${pdfPages} pages, ${Math.round(pdfBytes.length / 1024)} KB) → ${out}/27d-plan.pdf`);
  // The photo's credit (0.36.54): a small ⓘ on the photo, the credit on hover; on paper in full.
  const creditBox = board.locator(".hx > .hx-left .hx-credit").first();
  if (await creditBox.count()) {
    assert.equal(await creditBox.locator(".hx-credit-text").isVisible(), false, "only the ⓘ until hovered");
    await creditBox.hover();
    assert.match(await creditBox.locator(".hx-credit-text").innerText(), /^Fotoğraf: /);
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
  await chatCards.nth(0).getByRole("button", { name: "Pensão Favorita: seçeneklere ekle" }).click();
  await chatCards.nth(0).getByRole("button", { name: "Pensão Favorita eklendi" }).waitFor({ timeout: 5000 });
  await board.screenshot({ path: `${out}/27f-chat-offers.png` });
  const offerSaved = (await tripRecords("Portekiz")).items.filter((i) => i.name === "Pensão Favorita");
  assert.deepEqual(offerSaved.map((i) => [i.category, i.status, i.provider, i.url]), [["stay", "saved", "Tripadvisor", "https://www.tripadvisor.com/Hotel_Review-e2e-favorita"]]);
  await flow.unroute("https://generativelanguage.googleapis.com/**", offersModel);
  await flow.unroute("**/functions/v1/offers**", offersFn);
  console.log("✓ find_offers: 'daha ucuz öneriler getir' shows 'Fiyatlara bakıyorum…', then 3 real offers as cards ('★ 4,7', '8,9', source, why, €90 / gece); Ekle saves Pensão Favorita as an option");

  // 20e. Words with a link on the home: the link is saved, the words go on ("Linki kaydettim; geri kalanını konuşalım").
  // A month only is never a day made up: the day is asked next; "Ortası" is said back and marked roughly.
  await board.getByRole("button", { name: /Seyahatlerim/ }).first().click();
  await board.getByLabel("Gezi kutusu").fill("Lizbon https://www.booking.com/hotel/pt/e2e-lizbon.html");
  await board.getByRole("button", { name: /Planlamaya başla/ }).click();
  await board.locator(".st-msg-bot", { hasText: "Linki kaydettim; geri kalanını konuşalım." }).waitFor();
  await board.locator(".st-msg-bot", { hasText: "Lizbon kulağa harika geliyor: Lizbon'un tepeleri" }).waitFor();
  const skipQ = () => answers.getByRole("button", { name: "Atla" }).click();
  // Rev 3: when before where from (most important first); the day, not needed, after where from.
  await board.locator(".st-msg-bot", { hasText: "Lizbon için kaç gün?" }).waitFor();
  await answers.getByRole("button", { name: "1 hafta", exact: true }).click();
  await answers.getByRole("button", { name: "Aralık", exact: true }).click();
  await board.locator(".st-msg-bot", { hasText: "Nereden yola çıkıyorsun?" }).waitFor();
  // "Aralık · 1 hafta" is a done row already (the day is asked, not needed).
  await list.locator(".st-row.done", { hasText: "Aralık · 1 hafta" }).waitFor();
  await skipQ(); // where from
  // Who is an essential (2026-10-06): asked before the day. Skipped, the essentials are in: the countdown starts, and
  // "Vazgeç" stops it.
  await board.locator(".st-msg-bot .st-q", { hasText: "Kimle gidiyorsun?" }).waitFor();
  await skipQ();
  await board.locator(".st-msg-bot", { hasText: "Aralık ayının hangi günü başlıyor?" }).waitFor();
  // The plan said back while it counts (2026-10-07): the route and the days; gone once stopped.
  await board.locator(".st-summary", { hasText: "Lizbon" }).waitFor();
  assert.deepEqual(await board.locator(".st-summary dt").allInnerTexts(), ["Rota", "Tarih"]);
  await board.waitForTimeout(400);
  await board.screenshot({ path: `${out}/20d2-start-summary.png` });
  await board.locator(".st-auto", { hasText: "Oluşturuyorum…" }).getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-summary").waitFor({ state: "detached" });
  await board.locator(".st-auto").waitFor({ state: "detached" });
  assert.deepEqual(await answers.locator(".st-chip").allInnerTexts(), ["Ayın başı", "Ortası", "Sonu"]);
  await answers.locator("input[type=date]").waitFor();
  await board.screenshot({ path: `${out}/20e-start-day.png` });
  await answers.getByRole("button", { name: "Ortası" }).click();
  await board.locator(".st-msg-bot", { hasText: "15 Aralık'ı başlangıç aldım, değiştirebilirsin." }).waitFor();
  await list.getByText("15–22 Aralık · 7 gece (yaklaşık)").waitFor();
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
        reply: { text: "Sabine ile Koh Phangan kulağa harika geliyor: palmiyeli koylar, orman şelaleleri ve dolunay sahilleri.", question: "Nereden yola çıkıyorsunuz?" },
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
  await board.locator(".st-side .st-row.reading", { hasText: "NEREDEN" }).waitFor();
  // The row is its own polite status, outside the conversation's log.
  await board.locator(".st-status[role=status][aria-live=polite] .st-thinking").waitFor();
  assert.equal(await board.locator(".st-msgs .st-thinking, [role=log] [role=status]").count(), 0, "the status row is not inside the log");
  await board.waitForTimeout(500); // the lines' fade-in done, the model still writing (1.5 s)
  await board.screenshot({ path: `${out}/21b-start-thinking.png` });
  // ... the model read it as Koh Phangan: its line replaces the code's, in the same element (not made anew).
  await board.locator(".st-msg-bot", { hasText: "palmiyeli koylar, orman şelaleleri ve dolunay sahilleri. Nereden yola çıkıyorsun?" }).waitFor();
  assert.match(await firstLine.evaluate((n) => n.isConnected && n.textContent), /palmiyeli koylar/, "the replaced line keeps its element");
  await board.locator(".st-thinking").waitFor({ state: "detached" });
  assert.equal(await board.locator(".st-side .st-row.reading").count(), 0, "the reading is over: no row reads");
  // The route's row pressed while the proposal is still on its way (rev 3): the chat says it's drawing it and goes
  // on; only the ROTA row says "Rotayı çiziyor…"; "Oluştur" can be pressed meanwhile; the proposal is said when it comes.
  await board.locator(".st-side .st-row", { hasText: "ROTA" }).click();
  await board.locator(".st-msg-bot", { hasText: "Rotayı çiziyorum; hazır olunca burada öneririm." }).waitFor();
  await board.locator(".st-side .st-row.drawing .st-row-drawing", { hasText: "Rotayı çiziyor…" }).waitFor();
  assert.equal(await board.locator(".st-thinking[data-call=read]").count(), 0, "the chat isn't held by the route");
  // The route call running: its own step line (v5), never a reading one.
  await board.locator(".st-thinking[data-call=route]", { hasText: "Rotayı düşünüyorum…" }).waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true, "Oluştur works while the route is drawn");
  await board.locator(".st-msg-bot", { hasText: "Rota önerim: Koh Phangan 21 · Koh Samui 10 gece. Bu olsun mu?" }).waitFor({ timeout: 15000 });
  await board.locator(".st-side .st-row-drawing").waitFor({ state: "detached" });
  // Back to where from (the route stays a proposal).
  await board.locator(".st-side .st-row", { hasText: "NEREDEN" }).click();
  await board.locator(".st-msg-bot", { hasText: /^Nereden yola çıkıyorsun\?$/ }).waitFor();
  const revList = board.locator(".st-side .st-list");
  await revList.getByText("Koh Phangan · Tayland").waitFor();
  await revList.getByText(/10 Ocak – 10 Şubat · 31 gece/).waitFor();
  // The preview fills in while chatting: the route proposed in the background, the dates, who, the flights, photos.
  const pv = board.locator(".st-pv");
  await pv.getByText("Koh Phangan 21 gece → Koh Samui 10 gece").waitFor({ timeout: 15000 });
  await pv.getByText("Rota önerisi").waitFor();
  await pv.getByText(/10 Ocak – 10 Şubat · 31 gece/).waitFor();
  await pv.getByText(/Sabine/).first().waitFor();
  await pv.locator(".st-pv-photo img.in").first().waitFor({ timeout: 15000 });
  const genBtn = board.locator(".st-side .st-gen-btn");
  assert.match(await genBtn.innerText(), /Şimdilik bununla oluştur/, "before the list is full the button says it's for now");
  assert.equal(await genBtn.isEnabled(), true, "it works with the destination known");
  // "İstanbul" to "Nereden?": where from, never the destination.
  await chat.getByLabel("Mesaj").fill("İstanbul");
  await chat.getByLabel("Mesaj").press("Enter");
  await board.locator(".st-msg-bot", { hasText: "Bu gezide en çok ne istiyorsun?" }).waitFor();
  await board.locator(".st-msg-bot", { hasText: "İstanbul'dan Koh Phangan'a uzun ama keyifli bir yol. Bu gezide en çok ne arıyorsunuz?" }).waitFor();
  // Where, when, where from and who known: the trip would make itself in 3 s (2026-10-06); stopped here to look.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-auto").waitFor({ state: "detached" });
  await revList.getByText("Koh Phangan · Tayland").waitFor();
  assert.equal(await revList.locator(".st-row").first().innerText().then((t) => /İstanbul/.test(t)), false, "the destination is not İstanbul");
  await revList.locator(".st-row", { hasText: "NEREDEN" }).getByText("İstanbul", { exact: true }).waitFor();
  await pv.getByText("İstanbul ⇄ Koh Samui").waitFor();
  assert.match(await genBtn.innerText(), /Şimdilik bununla oluştur/);
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
  await board.locator(".st-gen", { hasText: "Koh Phangan Gezisi planlanıyor" }).waitFor();
  assert.equal(await board.locator(".st-gen-foot").innerText().then((t) => /%/.test(t)), false, "no percentages");
  await board.screenshot({ path: `${out}/21c-start-generating.png` });
  await board.getByRole("heading", { name: "Koh Phangan Gezisi", exact: true }).waitFor({ timeout: 20000 });
  const kpGen = await genSeen();
  // The map speaks the chat's language on the English board; the bundled world as SVG; no canvas (no MapLibre).
  assert.equal(kpGen.credit, "Harita: Natural Earth");
  assert.equal(kpGen.land, 3, "the bundled world, as SVG (three times side by side, for the date line)");
  assert.equal(kpGen.canvas, 0, "no canvas (no MapLibre) on the generating screen");
  // The big steps: 28 px marks (their layout size: a tick popping in is scaled for a moment).
  assert.equal(kpGen.mark, 28, "28 px step icons");
  // Rev 3: "Oluştur" builds the proposal on screen (the model's, kept in the background) rather than one stop.
  for (const step of ["Gezi açıldı: Koh Phangan Gezisi", "Rota çizildi: Koh Phangan 21 gece → Koh Samui 10 gece", "İstanbul ⇄ Koh Samui uçuşları için yer açıldı"]) assert.ok(kpGen.steps.includes(step), `step "${step}" (${kpGen.steps.join(" | ")})`);
  assert.ok(kpGen.steps.some((x) => x.startsWith("2 kişi")), "who goes");
  const kp = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => t.title === "Koh Phangan Gezisi");
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
  await board.locator(".hx").getByText("Thailand", { exact: false }).first().waitFor();
  await board.locator(".chat .msg-assistant", { hasText: "Koh Phangan Gezisi hazır: 31 gece, 2 durak." }).waitFor();
  await board.screenshot({ path: `${out}/21d-start-board.png` });
  await flow.unroute("https://generativelanguage.googleapis.com/**", revModel);
  await flow.unroute(/wikipedia\.org\/api\/rest_v1\//, wiki);
  await flow.unroute(/upload\.wikimedia\.org\/e2e\//, upload);
  await flow.unroute(/functions\/v1\/city-image/, proxy);
  await switchLang("tr");
  console.log(`✓ start rev 3 on rev 2's conversation: the ROTA row says "Rotayı çiziyor…" while the chat goes on and Oluştur works; the proposal is built (Koh Phangan 21 · Koh Samui 10)`);

  // 22. Rev 3, the Sri Lanka report: the owner's exact sentence with a slow model (its reading comes after 9 s, its
  // route after 12 s). The code reads it at once (Sri Lanka, Sabine, 20 Kasım – 4 Aralık · 14 gece); the chat goes
  // on with chips while the model is slow; the classic circuit is proposed at once; "Şimdilik bununla oluştur" is
  // pressed while the ROTA row still says "Rotayı çiziyor…"; the trip is built with the circuit; the generating
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
  await board.locator(".st-msg-bot .st-q", { hasText: "Nereden yola çıkıyorsun?" }).waitFor({ timeout: 3000 });
  assert.ok(Date.now() - sentAt < 4000, "captured before the model answered");
  assert.equal(await board.locator(".st-msg-bot", { hasText: "Nereye gidiyoruz?" }).count(), 0, "where to isn't asked again");
  // The chat goes on while the model is still reading (chips, no waiting).
  await answers.getByRole("button", { name: "İstanbul", exact: true }).click();
  // The essentials known: the countdown (6 s, the style question shows); stopped here to go on by hand.
  await board.locator(".st-auto").getByRole("button", { name: "Vazgeç" }).click();
  await board.locator(".st-msg-bot .st-q", { hasText: "Bu gezide en çok ne istiyorsun?" }).waitFor();
  await answers.getByRole("button", { name: /Doğa/ }).click();
  await answers.getByRole("button", { name: "Tamam" }).click();
  // The classic circuit at once; the model's route still on its way (the ROTA row says so).
  const lkProposal = board.locator(".st-msg-bot", { hasText: /Rota önerim: Sigiriya \d+ · Kandy \d+ · Ella \d+ · Mirissa \d+ gece\. Bu olsun mu\?/ });
  await lkProposal.waitFor({ timeout: 3000 });
  const drawingRow = board.locator(".st-side .st-row.drawing .st-row-drawing", { hasText: "Rotayı çiziyor…" });
  await drawingRow.waitFor();
  const lkGen = board.locator(".st-side .st-gen-btn");
  assert.equal(await lkGen.isEnabled(), true, "Oluştur works while the route is drawn");
  assert.equal(await lkGen.evaluate((b) => getComputedStyle(b).backgroundColor), "rgb(34, 27, 58)", "and it looks it (not greyed)");
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/23a-start-srilanka-circuit.png` });
  // Pressed while "Rotayı çiziyor…" shows: the circuit is built.
  await watchGen();
  await lkGen.click();
  await board.locator(".st-gen", { hasText: "Sri Lanka Gezisi planlanıyor" }).waitFor();
  // Pictures along the way (best effort: the board opens by itself a few seconds in).
  await board.locator(".st-gen .gm[data-phase=flying]").waitFor({ timeout: 6000 }).then(() => board.screenshot({ path: `${out}/23b-start-map-midflight.png` })).catch(() => undefined);
  await board.locator(".st-gen .gm[data-phase=landed]").waitFor({ timeout: 6000 }).then(() => board.screenshot({ path: `${out}/23c-start-map-landed.png` })).catch(() => undefined);
  await board.getByRole("heading", { name: "Sri Lanka Gezisi", exact: true }).waitFor({ timeout: 20000 });
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
    const trip = (await all("trips")).filter((t) => t.title === "Sri Lanka Gezisi").at(-1);
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
  assert.equal(lk.message, 1, "one reading call");
  assert.equal(lk.route, 1, "one route call");
  await flow.unroute("https://generativelanguage.googleapis.com/**", lkModel);
  console.log("✓ start rev 3, Sri Lanka: the exact sentence read at once with a slow model (Sri Lanka, Sabine, 20 Kasım – 4 Aralık · 14 gece); chips go on while it reads; the classic circuit at once; Oluştur pressed while the ROTA row draws builds Sigiriya · Kandy · Ella · Mirissa with İstanbul ⇄ Kolombo; the map flies İstanbul → Sri Lanka with an arc and a plane, the stops dotted, then the photos");

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
  // WHERE TO is filled at once, marked to check (not the done tick), counted; Generate works with it.
  const tentativeRow = pngList.locator(".st-row.tentative", { hasText: "Papua New Guinea?" });
  await tentativeRow.waitFor({ timeout: 3000 });
  await tentativeRow.getByText("· check").waitFor();
  assert.equal(await pngList.locator(".st-row.tentative.done").count(), 0, "not ticked");
  assert.equal(await pngList.locator(".st-row", { hasText: "WHERE TO" }).getByText("· needed").count(), 0, "not 'needed'");
  await pngList.getByText("3 of 6 captured").waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true, "Generate works with the guess");
  assert.equal(await board.locator(".st-top-title").innerText(), "Papua New Guinea · new trip");
  await board.waitForTimeout(600); // the lines and rows faded in
  await board.screenshot({ path: `${out}/23e-start-png-captured.png` });
  await answers.getByRole("button", { name: "Yes", exact: true }).click();
  await board.locator(".st-msg-bot", { hasText: "Papua New Guinea, 3 weeks in November with a friend." }).waitFor();
  await board.locator(".st-msg-bot .st-q", { hasText: "Where are you leaving from?" }).last().waitFor();
  assert.equal(await board.locator(".st-top-title").innerText(), "Papua New Guinea · new trip", "the country's own name, never the typing");
  await pngList.locator(".st-row.done", { hasText: "Papua New Guinea" }).waitFor();
  assert.equal(await board.locator(".st-side .st-gen-btn").isEnabled(), true);
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/23f-start-png-from.png` });
  await chat.getByLabel("Message").fill("London");
  await chat.getByLabel("Message").press("Enter");
  await board.locator(".st-msg-bot .st-q", { hasText: "Which day in November does it start?" }).waitFor();
  await answers.getByRole("button", { name: "Skip" }).click();
  await board.locator(".st-msg-bot .st-q", { hasText: "What are you after on this trip?" }).waitFor();
  await answers.getByRole("button", { name: "Skip" }).click();
  // Never a names question in the start chat; never "Got it: With friends. Who's coming?".
  const pngLines = await board.locator(".st-msg-bot").allInnerTexts();
  for (const line of pngLines) {
    assert.doesNotMatch(line, /\bnames?\b|Who's coming/i, `asked for names before the trip: ${line}`);
    assert.doesNotMatch(line, /Got it:/, `an echo: ${line}`);
  }
  await board.locator(".st-side .st-gen-btn").click();
  await board.getByRole("heading", { name: "Papua New Guinea trip", exact: true }).waitFor({ timeout: 20000 });
  await board.locator(".chat .msg-assistant", { hasText: "Tell me their names if you like." }).waitFor();
  console.log("✓ start rev 3, the second report (English): \"Papua New Gune\" asked back as Papua New Guinea, a friend, November · 3 weeks at once; then where from; no names before the trip; the board's chat asks them once");

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
  await board.locator(".st-msg-bot .st-q", { hasText: "Nereden yola çıkıyorsun?" }).waitFor({ timeout: 3000 });
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
  await abList.locator(".st-row.reading", { hasText: "WHERE FROM" }).waitFor();
  assert.deepEqual(await answers.locator(".st-chip").allInnerTexts(), ["Just AfrikaBurn (7 days)", "+2 days in Cape Town", "+4 days in Cape Town", "These dates are right", "📅 Different dates"]);
  await board.waitForTimeout(600);
  await board.screenshot({ path: `${out}/26a-intent-afrikaburn.png` });
  await answers.getByRole("button", { name: "+4 days in Cape Town" }).click();
  await board.locator(".st-msg-bot", { hasText: /The trip: \d+ April – \d+ May · 10 nights \(estimated\) \(Cape Town 2 · Tankwa Karoo 6 · Cape Town 2 nights\)\./ }).waitFor();
  await board.locator(".st-msg-bot .st-q", { hasText: "Where are you leaving from?" }).last().waitFor();
  await abList.locator(".st-row.done", { hasText: "ROUTE" }).getByText("Cape Town 2 · Tankwa Karoo 6 · Cape Town 2 nights").waitFor();
  // Typed (the origin's guess depends on the trips before this one).
  await chat.getByLabel("Message").fill("Istanbul");
  await chat.getByLabel("Message").press("Enter");
  await board.locator(".st-msg-bot .st-q", { hasText: "How many of you are going, you included?" }).waitFor();
  assert.equal(await board.locator(".st-auto").count(), 0, "not before how many");
  await answers.getByRole("button", { name: "4", exact: true }).click();
  const autoRow = board.locator(".st-auto", { hasText: "Generating…" });
  await autoRow.waitFor();
  const autoLength = () => autoRow.locator(".st-auto-bar span").evaluate((n) => n.style.animationDuration);
  assert.equal(await autoLength(), "6s", "6 s while the festival's own question shows");
  assert.equal(await board.locator(".st-msg-bot a.st-link").first().innerText(), "Official site ↗", "in the chat's language");
  await board.waitForTimeout(450); // the row faded in
  await board.screenshot({ path: `${out}/26b-intent-countdown.png` });
  // The festival's own questions (2026-10-07) show first, with their chips: each skipped starts the countdown over,
  // never stops it; then the style question.
  for (const q of ["Camping, or a hotel?", "Have you got your ticket yet?", "How many days before the festival would you like to arrive?"]) {
    await board.locator(".st-msg-bot .st-q", { hasText: q }).last().waitFor();
    await answers.getByRole("button", { name: "Skip" }).click();
  }
  await board.locator(".st-msg-bot .st-q", { hasText: "What are you after on this trip?" }).last().waitFor();
  assert.equal(await autoRow.count(), 1, "the festival's questions skipped: still counting");
  assert.equal(await autoLength(), "6s", "6 s while the style question shows");
  // A style tapped: from 3 s again, not stopped.
  await answers.getByRole("button", { name: /Adventure/ }).click();
  await board.waitForFunction(() => document.querySelector(".st-auto-bar span")?.style.animationDuration === "3s");
  assert.equal(await autoRow.count(), 1, "a style chip doesn't stop it");
  // A letter typed: stopped, and nothing is made.
  await chat.getByLabel("Message").fill("x");
  await autoRow.waitFor({ state: "detached" });
  await board.waitForTimeout(3500);
  assert.equal(await board.locator(".st-gen").count(), 0, "stopped: nothing made");
  await chat.getByLabel("Message").fill("");
  // A later full checklist starts it again (Adventure is still picked); then it makes itself.
  await watchGen();
  await answers.getByRole("button", { name: "Done" }).click();
  await board.locator(".st-msg-bot", { hasText: "I'm ready and will build it in a few seconds. Write if you want to add anything." }).waitFor();
  await autoRow.waitFor();
  await board.locator(".st-gen h2", { hasText: /^Planning AfrikaBurn 20\d\d$/ }).waitFor({ timeout: 6000 });
  await board.screenshot({ path: `${out}/26c-intent-generating.png` });
  await board.getByRole("heading", { name: /^AfrikaBurn 20\d\d$/ }).waitFor({ timeout: 20000 });
  const abGen = await genSeen();
  assert.equal(abGen.sub, "Istanbul → Cape Town → Tankwa Karoo 🎪 → Cape Town · 10 nights");
  assert.deepEqual(abGen.fest, ["Tankwa Karoo"], "the festival's stop is pink");
  assert.deepEqual(abGen.stops, ["Cape Town", "Tankwa Karoo"], "Cape Town once (its nights added up), the festival");
  assert.ok(abGen.steps.includes("Route drawn: Cape Town 2 nights → Tankwa Karoo 6 nights → Cape Town 2 nights"), `the route (${abGen.steps.join(" | ")})`);
  const ab = await board.evaluate(async () => {
    const database = await new Promise((resolve) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => resolve(q.result); });
    const all = (store) => new Promise((resolve) => { const q = database.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); });
    const trip = (await all("trips")).find((t) => /^AfrikaBurn 20\d\d$/.test(t.title));
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
  console.log("✓ start rev 3, the second report (Turkish): Papua Yeni Gine, Bir arkadaşınla · 2 kişi, Kasım · 3 hafta at once; \"Nereden yola çıkıyorsun?\" next, in bold");
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
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
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
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
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
  const when = app.locator(".hx .hx-when");
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

  // A card deleted → Geçmiş shows it → Çöp kutusu → "Geri getir" → it's on the board again.
  const douro = app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douro.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douro.getByRole("button", { name: "Kart menüsü" }).click();
  await douro.getByRole("menuitem", { name: "Sil" }).click();
  await douro.waitFor({ state: "detached" });
  await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
  await app.locator(".menu").getByRole("button", { name: "Geçmiş ve çöp kutusu" }).click();
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
  await app.waitForFunction((want) => document.querySelector(".hx .hx-when")?.innerText.replace(/\s+/g, " ").trim() === want, datesBefore, { timeout: 10000 });
  console.log("✓ notice: Sabine's change of the dates shows above the tabs; Geri al puts mine back");

  // Deleting the shared trip asks first (only this computer, 30 days in the trash); Vazgeç keeps it.
  const deleteTrip = async () => {
    await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
    await app.locator(".menu").getByRole("button", { name: "Bu geziyi sil" }).click();
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
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
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
  // My profile name (Ayarlar → Profilim): "Ben (Emre)" in the box, "Emre" in the hero.
  await app.evaluate(() => chrome.storage.local.set({ shareName: "Emre" }));
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  const side = app.locator(".hx .hx-side");
  const whoText = async () => (await side.locator(".hx-who-text").innerText()).replace(/\s+/g, " ").trim();
  assert.equal(await whoText(), "2 kişi");
  await side.locator("button.hx-people").click();
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
  await app.waitForFunction(() => document.querySelector(".hx .hx-side .hx-who-text")?.innerText.replace(/\s+/g, " ").trim() === "Emre & Sabine 2 kişi", null, { timeout: 10000 });
  const said = `${await side.locator(".hx-who-text b").innerText()} · ${await side.locator(".hx-who-text small").innerText()}`;
  assert.equal(said, "Emre & Sabine · 2 kişi");
  assert.equal(await side.locator(".hx-avatars i").first().innerText(), "E");
  assert.equal(await nameBox.inputValue(), "", "the box is ready for the next name");
  // 0.37: a photo for Sabine, from her line in the box: kept on this computer, shown in the hero's circles.
  const sabinePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAM0lEQVR4nG3CoREAIQADwSssRbxGo9Gv0WhqurJoIDuLX2ocqXGmxpUa/9S4U+NJjTf1A3y1XcEwJbHpAAAAAElFTkSuQmCC", "base64");
  await box.locator(".hx-who-list li", { hasText: "Sabine" }).locator('input[type="file"]').setInputFiles({ name: "sabine.png", mimeType: "image/png", buffer: sabinePng });
  await box.locator(".hx-who-list li", { hasText: "Sabine" }).locator(".who-av img").waitFor();
  await side.locator(".hx-avatars img").first().waitFor();
  assert.match(await side.locator(".hx-avatars img").first().getAttribute("src"), /^data:image\/jpeg;base64,/);
  assert.equal(await side.locator(".hx-avatars img").count(), 1, "only Sabine's circle has a photo");
  await app.screenshot({ path: `${out}/18a-traveller-photo.png` });
  await box.getByRole("button", { name: "Sabine: fotoğrafı kaldır" }).click();
  await side.locator(".hx-avatars img").waitFor({ state: "detached" });
  assert.equal(await side.locator(".hx-share").count(), 0, "naming someone shares nothing");
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
  await app.waitForFunction(() => document.querySelector(".hx .hx-side .hx-who-text")?.innerText.replace(/\s+/g, " ").trim() === "2 kişi", null, { timeout: 10000 });
  assert.deepEqual((await box.locator(".hx-who-list li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()), ["Ben (Emre)"]);
  await app.screenshot({ path: `${out}/18b-travellers-removed.png` });
  await app.keyboard.press("Escape");
  await box.waitFor({ state: "detached" });
  assert.ok(await side.locator("button.hx-people").evaluate((el) => el === document.activeElement), "Esc gives the focus back to the people");
  // Geçmiş (the trip isn't shared): "Gidenler: Sabine çıkarıldı" has its own Geri al; Sabine comes back, the line
  // says "geri alındı".
  await app.getByRole("button", { name: "Gezi menüsü" }).first().click();
  await app.locator(".menu").getByRole("button", { name: "Geçmiş ve çöp kutusu" }).click();
  const history = app.getByRole("dialog", { name: "Geçmiş" });
  const removedLine = history.locator(".hs-ev", { hasText: "Gidenler: Sabine çıkarıldı" });
  await removedLine.getByRole("button", { name: "Geri al" }).click();
  await removedLine.locator(".hs-tag", { hasText: "geri alındı" }).waitFor();
  await app.screenshot({ path: `${out}/18c-travellers-history-undo.png` });
  await history.getByRole("button", { name: "Kapat" }).click();
  await history.waitFor({ state: "detached" });
  await app.waitForFunction(() => document.querySelector(".hx .hx-side .hx-who-text")?.innerText.replace(/\s+/g, " ").trim() === "Emre & Sabine 2 kişi", null, { timeout: 10000 });
  console.log("✓ travellers: the hero's people box names Sabine without sharing (Emre & Sabine · 2 kişi), × takes her off, Esc closes it; Geçmiş's Geri al brings her back");
} finally {
  await whoGoes.close();
}

// ---------------------------------------------------------------------------------------------
// Part 6: a flight's real data on its day (0.36.15/0.36.18), in its own browser with the calendar on the flight's
// day (14 October): changing the clock of a page the other parts go on with left its "today" behind.
const flightDay = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-live-")), {
  executablePath,
  headless: false,
  // The owner's home time (the hero's "−2 saat" to Portugal): the same wherever the Mac is.
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
  await tab("Gün gün").click();
  await app.locator(".dc-seg").getByRole("tab", { name: "Liste", exact: true }).click();
  const dayCard = (n) => app.locator(".dc-cday.list", { has: app.locator(".dc-pill", { hasText: new RegExp(`^${n}\\. gün$`) }) });
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
  const live = dayCard(7).locator(".dc-live.alert");
  await live.waitFor();
  assert.equal(await live.innerText(), "Yeni kalkış 20:05 (+25 dk) · Kapı 14 · Veri: AeroDataBox");
  await live.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-flight-live.png` });
  await tab("Plan").click();
  const tpCard = app.locator('.pk-card[aria-label*="Lizbon → İstanbul"]').first();
  await tpCard.locator(".pk-live").waitFor();
  assert.ok(await tpCard.evaluate((el) => el.classList.contains("pk-alert")), "late: the card goes red");
  assert.deepEqual(flat(await tpCard.locator(".pk-lv").allInnerTexts()), ["Yeni kalkış 20:05+25 dk", "Kapı 14"]);
  assert.match(flat([await tpCard.locator(".pk-top").innerText()])[0], /TAP TP1760/);
  assert.match(flat([await tpCard.locator(".pk-foot").innerText()])[0], /Rötar: plan yeni saate göre kaydı.*AeroDataBox/);
  assert.match(flat([await tpCard.locator(".pk-stop").first().innerText()])[0], /LIS T1 · 20:05/);
  await tpCard.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/3e-flight-card-live.png` });
  console.log("✓ flight on its day: late in red with its new time and gate, in the day's line and as boxes on the Plan's card, the source named");
} finally {
  await flightDay.close();
}
