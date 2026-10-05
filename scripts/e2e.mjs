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

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-")), {
  executablePath,
  headless: false,
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
  // The trip at a glance beside its picture: when and where in the order it goes, then what's settled of what's needed.
  // The hero: a photo per city with a switcher, the countdown and route, what's confirmed, and the facts column.
  const hero = app.locator(".hx");
  assert.deepEqual(await hero.locator(".hx-cities button").allInnerTexts(), ["Porto", "Lizbon"]);
  assert.match(await hero.locator(".hx-tab").innerText(), /(gün kaldı|Yarın|\. gün \/ 7|Bitti)\s*·\s*Porto → Lizbon ↗/);
  assert.deepEqual((await hero.locator(".hx-stats > div").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")), ["1 uçuş", "1 konaklama", "1 etkinlik"]);
  assert.equal(await hero.locator(".hx-lead").innerText(), "3 karar ve 1 rezervasyon bekliyor.");
  const side = hero.locator(".hx-side");
  assert.match(await side.locator(".hx-row", { hasText: "Tarihler" }).innerText(), /8–14 Ekim · 7 gün/);
  assert.match(await side.locator(".hx-row", { hasText: "Vize" }).innerText(), /Schengen vizesi ↗/);
  await hero.locator(".hx-intent-toggle", { hasText: "Seni böyle anladım" }).waitFor();
  await hero.scrollIntoViewIfNeeded();
  await app.waitForTimeout(1500); // the city photos come from Wikipedia
  await app.screenshot({ path: `${out}/2b-hero.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await hero.scrollIntoViewIfNeeded();
  await app.screenshot({ path: `${out}/2d-hero-narrow.png` });
  assert.deepEqual(await uncut(".hx-intent-toggle, .hx-intent-toggle > *, .card-alert"), [], "the hero's lines and a card's warning wrap, never cut");
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow hero");
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.getByText("Jardim Stay").first().waitFor();
  // A block per city (Porto, Lisbon) with its transfers, nights and days; the flights and the train between them.
  assert.equal(await app.locator(".day-strip").count(), 0, "no band of nights");
  const cities = await app.locator(".city-block .city-head").allInnerTexts();
  assert.deepEqual(cities.map((t) => t.replace(/\s+/g, " ")), ["1 Porto 8–11 Ekim · 3 gece", "2 Lizbon 11–14 Ekim · 3 gece"]);
  assert.match(await app.locator(".tl-stay .tl-label").first().innerText(), /Konaklama\s*1–4\. gün\s*8–11 Ekim\s*3 gece/);
  await app.locator(".stay-block.booked", { hasText: "Lisboa Loft" }).waitFor();
  await app.getByText("Kapanan seçenekler (1)").waitFor();
  assert.equal(await app.locator(".stay-block", { hasText: "Alfama Suites" }).count(), 0, "a booking closes its alternatives");
  // The plan's front, a block for each thing: the flight in, Porto's stay and the boat tour, the train, Lisbon's stay, home.
  const heads = await app.locator(".trip-line .tl-label b").allInnerTexts();
  assert.deepEqual(heads, ["Varış", "Konaklama", "Etkinlik", "Şehir değişimi", "Konaklama", "Dönüş"]);
  // No days, no check-in lines, no transfers without a plan on the front.
  assert.equal(await app.locator(".trip-line .tl-day, .trip-line .leg, .trip-line .pk-leg").count(), 0);
  // The itinerary, a tab away: day by day, hour by hour; each booking a small block, information a line.
  const tab = (name) => app.getByRole("tab", { name, exact: true });
  await tab("Günlük akış").click();
  const day = (n) => app.locator(".it-day", { has: app.locator(".it-day-head b", { hasText: new RegExp(`^${n}\\. gün$`) }) });
  const dayTitles = (n) => day(n).locator(".it-row").evaluateAll((els) => els.map((e) => e.querySelector(".it-t b, .it-line b")?.textContent));
  const itRow = (n, title) => day(n).locator(".it-row", { has: app.locator(".it-t b", { hasText: title }) });
  assert.equal(await day(4).locator(".it-route").innerText(), "Porto → Lizbon");
  assert.deepEqual(await dayTitles(4), ["Check-out", "Otel → Gar", "Tren Porto → Lizbon", "Gar → Otel", "Check-in"]);
  assert.deepEqual(await day(7).locator(".it-time").allInnerTexts(), ["~11:00", "17:40", "19:40"]);
  await day(7).locator(".it-block.st-done", { hasText: "Uçuş LIS → IST" }).waitFor();
  assert.equal(await app.locator(".it-day.empty").count(), 3);
  await app.screenshot({ path: `${out}/3e-itinerary.png` });
  // A block opens its card on the plan.
  await day(7).locator(".it-block", { hasText: "Uçuş LIS → IST" }).click();
  await app.locator("li.tl-travel.flash").waitFor();
  // Where each plan stands is on top of its card: booked in green, planned in amber.
  await app.locator(".tl-stay.st-booked .status-bar.st-booked", { hasText: "Rezerve edildi" }).waitFor();
  // Undecided needs are a numbered list, best first: each card with its place and score, what it's
  // strongest on, why it stands there (against the first; the first against the second), a mark per
  // thing asked for, and what speaks for and against it.
  const card = (name) => app.locator(`.swipe-card[aria-label="${name}"]`);
  const stayCard = app.locator(".stay-block .reco-line.headline").first();
  assert.equal(await stayCard.locator("p").innerText(), "Önerim Jardim Stay: en sessiz; €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu. Tasarruf için 3. Casa Azul (€45 daha ucuz).");
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
  assert.match(await pegasus.locator(".pk-foot").innerText(), /2 seçenek[\s\S]*1\/2[\s\S]*Önerim[\s\S]*€\d+[\s\S]*Plana seç/);
  await pegasus.locator(".pk-body").click();
  assert.equal(await pegasus.locator(".pk-why.trade").innerText(), "2.'ye göre+€30 · bagaj dahil, direkt, saatleri daha uygun · eksiği: iade yok, ücretli değişiklik");
  await pegasus.locator(".pk-body").click();
  await pegasus.getByRole("button", { name: "Sonraki seçenek" }).click();
  const tap = pk("TAP · Lizbon aktarmalı");
  await tap.locator(".pk-body").click();
  assert.equal(await tap.locator(".pk-badges").innerText(), "En ekonomik");
  await tap.locator(".pk-body").click();
  await tap.getByRole("button", { name: "Önceki seçenek" }).click();
  // The quiet line under the next step: what to decide, book and plan, counted; a count lists them under
  // the hero, a tap goes there.
  const todo = app.locator(".hx-todo");
  const chip = (label) => todo.locator("button", { hasText: label });
  const todoList = app.locator(".hx + .todo-list");
  assert.deepEqual(await Promise.all(["Karar ver", "Rezerve et", "Planla"].map((k) => chip(k).locator("b").innerText())), ["3", "1", "4"]);
  assert.match(await app.locator(".hx-next").innerText(), /Sıradaki adım\s*\S.*: /);
  await chip("Karar ver").click();
  await todoList.locator("button", { hasText: "Porto konaklama · 8–11 Ekim" }).click();
  await app.locator(".tl-stay.flash").waitFor();
  await chip("Planla").click();
  assert.match(await todoList.innerText(), /Varış transferi · 8 Ekim[\s\S]*nasıl\?/);
  await chip("Planla").click();
  assert.equal(await todoList.count(), 0);
  // Cancellations running out show up there too (the sample trip is dated, so only when those dates are near).
  // And the money: booked and chosen against the budget; a tap splits it and adds a guess for what's open.
  const budget = app.locator(".hx-row.click", { hasText: "Bütçe" });
  assert.match(await budget.innerText(), /€577 \/ €1\.500/);
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
  await home.locator(".pk-body").click();
  await home.getByRole("button", { name: "Rezervasyonu geri al" }).click();
  await home.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  await home.getByRole("button", { name: "Bileti aldım" }).click();
  await home.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // The cities big, the airport codes and hours small; the landing day only because it's the next day.
  assert.match(await home.locator(".pk-mid").innerText(), /Lizbon\s*LIS · 19:40[\s\S]*4 sa 55 dk · direkt[\s\S]*İstanbul\s*IST · 15 Ekim · 01:35/);
  await home.locator(".pk-body").click();
  // Opening a card shows its details on the card (0.33: a tap on its picture; its title is edited where it stands).
  await douro.locator(".pk-vis").click();
  await douro.locator(".pk-detail").getByRole("button", { name: "Tüm detaylar" }).waitFor();
  await douro.locator(".pk-vis").click();
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
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
  const intent = app.locator(".hx-intent");
  await intent.locator(".hx-intent-toggle", { hasText: "1 soru" }).click();
  const guess = intent.locator(".hx-intent-pop .ask", { hasText: "İptal esnekliği senin için daha mı önemli?" });
  await guess.waitFor();
  await guess.getByRole("button", { name: "Evet" }).click();
  await guess.waitFor({ state: "detached" });
  await intent.locator(".hx-intent-pop li", { hasText: "ücretsiz iptalli" }).waitFor();
  await intent.locator(".hx-intent-pop li", { hasText: "Sorun değil: Yan binada inşaat gürültüsü" }).waitFor();
  await intent.locator(".hx-intent-toggle").click();
  await intent.locator(".hx-intent-pop").waitFor({ state: "detached" });
  await app.screenshot({ path: `${out}/3b-card.png` });

  // Comparison: numbers side by side, the weights the user controls, and why.
  await stayCard.getByRole("button", { name: "Karşılaştır →" }).click();
  const compare = app.getByRole("dialog", { name: "Karşılaştırma" });
  const winner = compare.locator("thead th.win .opt-name");
  assert.equal(await winner.innerText(), "Jardim Stay");
  await compare.getByText("Neden Jardim Stay?").waitFor();
  // Pros and cons per column, and the sample AI review kept (dated) now that the inputs changed.
  await compare.locator(".pc-row .pc-col.pros", { hasText: "Sessiz odalar, iyi uyku" }).waitFor().catch(async (e) => {
    console.log("pros/cons row:", await compare.locator(".pc-row").innerText());
    throw e;
  });
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
  await jardimRow.getByRole("button", { name: "Diğer 2 seçenek" }).waitFor();
  await jardimRow.locator(".stc-main").click();
  await app.locator(".stay-block.chosen .swipe-card").first().waitFor();
  await card("Jardim Stay").getByRole("button", { name: "Planda ✓" }).waitFor();
  await jardimRow.getByRole("button", { name: "Kapat" }).click();
  assert.equal(await app.locator(".stay-block.chosen .swipe-card").count(), 0);
  await jardimRow.getByRole("button", { name: "Detaylar", exact: true }).click();
  await jardimRow.locator(".stc-details .card-details").waitFor();
  await jardimRow.getByRole("button", { name: "Detaylar", exact: true }).click();
  // "Seç" on a flight card: the flight folds into a line, and its landing time reaches the transfer to the hotel.
  await pk("Pegasus · direkt").getByRole("button", { name: "Plana seç" }).click();
  await app.locator(".tl-travel.role-arrival .pk-card", { hasText: "IST" }).locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  // Porto chosen, Lisbon booked: in the itinerary the transfers lay themselves out (the saved train is
  // the move, with a station transfer on each side), and the way home says what's easy to miss.
  await tab("Günlük akış").click();
  // Landing 10:05: the transfer then, check-in from 14:00 as the page says.
  assert.equal(await itRow(1, "Havalimanı → Otel").locator(".it-time").innerText(), "10:05");
  await itRow(1, "Havalimanı → Otel").locator(".it-t", { hasText: "OPO havalimanı → Jardim Stay" }).waitFor();
  assert.match(await day(1).locator(".it-row.info", { hasText: "Check-in" }).innerText(), /14:00\s*Check-in\s*Jardim Stay/);
  // A transfer with no plan opens right there: what's easy to miss, how to go, "Gerek yok".
  await itRow(1, "Havalimanı → Otel").locator(".it-block").click();
  await itRow(1, "Havalimanı → Otel").locator(".leg-note", { hasText: "Varış 10:05, giriş en erken 14:00 (sayfada yazıyor)" }).waitFor();
  assert.equal(await itRow(4, "Otel → Gar").locator(".it-t span").innerText(), "Jardim Stay → Porto Campanhã");
  await itRow(7, "Otel → Havalimanı").locator(".it-block").click();
  await itRow(7, "Otel → Havalimanı").locator(".leg-note", { hasText: "arada ~6 saat boşluk" }).waitFor();
  // "Metroyla gideceğim": nothing to book, so the transfer becomes a line of the day.
  await itRow(1, "Havalimanı → Otel").getByRole("button", { name: "🚇 Metro" }).click();
  await day(1).locator(".it-row.info", { hasText: "Metro · planlandı" }).waitFor();
  // "Gerek yok": a transfer they don't need leaves the day (and the to-dos), and comes back from "Gizlenenler".
  const lisbonIn = itRow(4, "Gar → Otel");
  await lisbonIn.locator(".it-block").click();
  await lisbonIn.getByRole("button", { name: "Gerek yok · gizle" }).click();
  await lisbonIn.waitFor({ state: "detached" });
  await tab("Plan").click();
  const hiddenRow = app.locator(".section", { has: app.locator(".row-name", { hasText: "Gizlenenler (1)" }) });
  await hiddenRow.locator(".row").click();
  await hiddenRow.getByRole("button", { name: "Geri getir", exact: true }).click();
  await hiddenRow.waitFor({ state: "detached" });
  await tab("Günlük akış").click();
  await lisbonIn.waitFor();
  await day(1).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5-legs.png` });
  await day(4).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5b-legs.png` });
  // A narrow window: nothing spills out sideways.
  const wide = app.viewportSize();
  await app.setViewportSize({ width: 820, height: 900 });
  await day(4).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll");
  await app.setViewportSize(wide);
  // Back on the plan, without the train Porto → Lizbon is a move to plan: by plane it reads as a flight, with its status on it.
  await tab("Plan").click();
  // "Ele" in the card's menu: it leaves the options and waits under "Elenenler".
  const train = pk("CP Alfa Pendular · Porto → Lizbon");
  await train.getByRole("button", { name: "Kart menüsü" }).click();
  await train.getByRole("menuitem", { name: "Ele" }).click();
  await app.locator(".row-name", { hasText: "Elenenler (1)" }).waitFor();
  const move = app.locator('.pk-leg[aria-label="Porto → Lizbon"]');
  await move.locator(".pk-ring.open").waitFor();
  await move.locator(".pk-foot", { hasText: "Planlanmadı" }).waitFor();
  assert.match(await move.locator(".pk-mid").innerText(), /Porto[\s\S]*Lizbon/);
  await move.locator(".pk-body").click();
  await move.getByRole("button", { name: "✈ Uçak" }).click();
  await move.locator(".pk-ring.half").waitFor();
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
  await tab("Günlük akış").click();
  await itRow(4, "Otel → Havalimanı").waitFor();
  await day(4).locator(".it-block.st-done", { hasText: "Uçuş Porto → Lizbon" }).waitFor();
  await tab("Plan").click();
  // What still needs booking without a day: "Rezerve edilecekler", one card under another (Majestic Café,
  // a café with no booking, is in Fikirler instead).
  const toBook = app.locator(".pk-tobook");
  assert.match(await toBook.locator(".section-head").innerText(), /Rezerve edilecekler\s*3 · 0 alındı/);
  assert.deepEqual((await toBook.locator(".pk-card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).sort(), ["Livraria Lello", "Serralves Müzesi", "Tiyatro"]);
  assert.equal(await app.locator(".pk-card", { hasText: "Majestic Café" }).count(), 0);
  assert.equal(await app.locator(".crash").count(), 0, "board crashed after chat updates");
  await app.screenshot({ path: `${out}/5-chosen.png` });
  // 4b. Plan cards: a file on a card, delete + undo (the file comes back), add from a template, narrow.
  const douroCard = () => app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douroCard().locator("input.pk-file").first().setInputFiles({ name: "bilet.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });
  const pill = douroCard().locator(".pk-docpill", { hasText: "bilet.pdf" });
  await pill.waitFor();
  const [docTab] = await Promise.all([context.waitForEvent("page"), pill.click()]);
  assert.match(docTab.url(), /^blob:chrome-extension:\/\//);
  await docTab.close();
  await douroCard().getByRole("button", { name: "Kart menüsü" }).click();
  await douroCard().getByRole("menuitem", { name: "Sil" }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().locator(".pk-docpill", { hasText: "bilet.pdf" }).waitFor();
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
  await bus.locator(".pk-foot", { hasText: "Planlanıyor" }).waitFor();
  // The panel scrolls inside the page, so a tall window shows the whole plan in one picture.
  await app.setViewportSize({ width: 1440, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4b-plan-cards.png` });
  // Below 860 px the board is one column; at 560 px the panel is under 620 px and the narrow card layout applies.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
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
  // "Geri al"; "+" at the top, at a city's head, after a stay and on a day, each with its city and day; Fikirler.
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
  // × on hover: a plan card, then a stay; each comes back with "Geri al".
  // Read after the .15s fade.
  const opacity = (loc) => loc.evaluate((el) => new Promise((done) => setTimeout(() => done(getComputedStyle(el).opacity), 300)));
  await douroCard().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await douroCard().hover();
  assert.equal(await opacity(douroCard().locator(".pk-x")), "1");
  await app.screenshot({ path: `${out}/4f-hover-x.png` });
  await douroCard().getByRole("button", { name: "Douro tekne turu: sil" }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().waitFor();
  // A transport card has the same × and undo.
  await bus.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await bus.hover();
  assert.equal(await opacity(bus.locator(".pk-x")), "1");
  await bus.getByRole("button", { name: "Otobüs · Lizbon → Lagos: sil" }).click();
  await bus.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Lagos" }).getByRole("button", { name: "Geri al" }).click();
  await bus.waitFor();
  const jardim = app.locator(".stay-block.chosen .settled-card", { hasText: "Jardim Stay" });
  await jardim.getByRole("button", { name: "Kart menüsü" }).click();
  assert.deepEqual(await jardim.getByRole("menuitem").allInnerTexts(), ["Sil"]);
  await jardim.getByRole("button", { name: "Kart menüsü" }).click();
  await jardim.hover();
  await jardim.getByRole("button", { name: "Jardim Stay: sil" }).click();
  await jardim.waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Jardim Stay silindi" }).getByRole("button", { name: "Geri al" }).click();
  await jardim.waitFor();
  // "+": always there (faint), each with the right city and day.
  const sheetWhere = async (button) => {
    await button.click();
    const where = await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).locator("header span").innerText();
    await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Kapat" }).click();
    return where;
  };
  const plus = (scope) => scope.locator(".pk-insert button").first();
  await app.mouse.move(0, 0);
  assert.equal(await opacity(plus(app.locator(".tl-head-insert"))), "0.35", "the + shows without a hover");
  assert.equal(await sheetWhere(plus(app.locator(".tl-head-insert"))), "8 Ekim");
  assert.equal(await sheetWhere(plus(app.locator("li.tl-entry.tl-travel").first())), "Porto · 8 Ekim");
  assert.equal(await sheetWhere(plus(app.locator('.city-block[aria-label="Porto"] .tl-insert'))), "Porto · 8 Ekim");
  assert.equal(await sheetWhere(plus(app.locator('.city-block[aria-label="Porto"] li.tl-stay'))), "Porto");
  assert.equal(await sheetWhere(plus(app.locator('.city-block[aria-label="Lizbon"] .tl-insert'))), "Lizbon · 11 Ekim");
  assert.equal(await sheetWhere(plus(app.locator("li.tl-entry.tl-travel").last())), "14 Ekim");
  // On a day of the itinerary: that day and its city. A to-do added there is a thin line of the day.
  await tab("Günlük akış").click();
  // Day 3 is empty ("boş gün"): its "+" is on that line.
  await app.locator(".it-day.empty").getByRole("button", { name: "10 Ekim: bu güne ekle" }).click();
  const addSheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  assert.equal(await addSheet.locator("header span").innerText(), "Porto · 10 Ekim");
  // 0.33: added at once; it needs no booking, so it goes to Fikirler and the tab stays: "Göster" opens it there, its title ready.
  await addSheet.getByRole("button", { name: "Yapılacak", exact: true }).click();
  await addSheet.waitFor({ state: "detached" });
  await tab("Günlük akış").and(app.locator('[aria-selected="true"]')).waitFor();
  await app.locator(".pk-undo", { hasText: "Yapılacak Fikirler'e eklendi" }).getByRole("button", { name: "Göster" }).click();
  await box("Ad").fill("Bolhão pazarı");
  await box("Ad").press("Enter");
  await app.locator('.fk .fk-city-block', { hasText: "Porto" }).locator('.fk-row[aria-label="Bolhão pazarı"]').waitFor();
  await tab("Günlük akış").click();
  await day(3).locator(".it-row.idea", { hasText: "Bolhão pazarı" }).waitFor();
  // Fikirler: the quick line, the filters, a day for a restaurant (with its meal), done, moved to bookings.
  await tab("Fikirler").click();
  const ideas = app.locator(".fk");
  assert.match(await ideas.locator(".fk-sec").innerText(), /Fikirler ve yapılacaklar\s*rezervasyon gerekmez/);
  const quick = ideas.getByRole("textbox", { name: "Bir fikir yaz" });
  // The city the line names is the card's city, not part of its title.
  for (const [line, title] of [
    ["Lizbon'da pastel de nata", "Pastel de nata"],
    ["Porto'da Dom Luís köprüsünden gün batımı", "Dom Luís köprüsünden gün batımı"],
    ["Porto'da Livraria Lello, giriş bileti var", "Livraria Lello, giriş bileti var"],
  ]) {
    await quick.fill(line);
    await quick.press("Enter");
    await ideas.locator(`[aria-label="${title}"]`).waitFor();
  }
  const cityBlock = (name) => ideas.locator(".fk-city-block", { has: app.locator(".fk-city b", { hasText: name }) });
  await cityBlock("Lizbon").locator('.fk-eat[aria-label="Pastel de nata"]').waitFor();
  assert.deepEqual(await cityBlock("Porto").locator(".fk-eat > b").allInnerTexts(), ["Majestic Café"]);
  assert.deepEqual(await cityBlock("Porto").locator(".fk-row .fk-t > b").allInnerTexts(), ["Bolhão pazarı", "Dom Luís köprüsünden gün batımı", "Livraria Lello, giriş bileti var"]);
  assert.equal(await cityBlock("Porto").locator('.fk-row[aria-label="Bolhão pazarı"] .fk-day.set').innerText(), "10 Eki");
  await ideas.getByRole("button", { name: "Yeme-içme" }).click();
  assert.equal(await ideas.locator(".fk-row").count(), 0);
  await ideas.getByRole("button", { name: "Hepsi" }).click();
  const majestic = cityBlock("Porto").locator('.fk-eat[aria-label="Majestic Café"]');
  assert.match(await majestic.locator(".fk-map").getAttribute("href"), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=41\.1471%2C-8\.6066$/);
  await majestic.getByRole("button", { name: "+ Güne ekle" }).click();
  await majestic.getByRole("radio", { name: "öğle" }).click();
  await majestic.getByRole("dialog", { name: "Hangi gün?" }).getByRole("button", { name: /^9 Eki/ }).click();
  await majestic.locator(".fk-day.set", { hasText: "9 Eki öğle" }).waitFor();
  const market = cityBlock("Porto").locator('.fk-row[aria-label="Bolhão pazarı"]');
  await market.getByRole("checkbox", { name: "Bolhão pazarı: yapıldı" }).click();
  await market.locator(".fk-t > span", { hasText: /^Yapıldı · / }).waitFor();
  assert.match(await market.getAttribute("class"), /done/);
  const lello = cityBlock("Porto").locator('.fk-row[aria-label="Livraria Lello, giriş bileti var"]');
  await lello.locator(".fk-t > span", { hasText: "Giriş bileti gerekiyor" }).waitFor();
  await app.setViewportSize({ width: 1440, height: 1400 });
  await ideas.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4g-ideas.png` });
  await app.setViewportSize({ width: 560, height: 1400 });
  await ideas.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4h-ideas-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll in Fikirler");
  await app.setViewportSize({ width: 1440, height: 900 });
  // An idea deleted with ×, then brought back.
  const sunset = cityBlock("Porto").locator(".fk-row", { hasText: "gün batımı" });
  await sunset.hover();
  await sunset.getByRole("button", { name: "Dom Luís köprüsünden gün batımı: sil" }).click();
  await sunset.waitFor({ state: "detached" });
  await app.locator(".pk-undo").getByRole("button", { name: "Geri al" }).click();
  await sunset.waitFor();
  await lello.getByRole("button", { name: "Rezerve edileceklere taşı" }).click();
  await lello.waitFor({ state: "detached" });
  // The restaurant on its day is a thin line of the itinerary; the moved one is a booking on the Plan.
  await tab("Günlük akış").click();
  await day(2).locator(".it-row.idea", { hasText: "Majestic Café" }).locator(".it-line", { hasText: "öğle" }).waitFor();
  await day(2).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4k-itinerary-032.png` });
  await tab("Plan").click();
  assert.match(await app.locator(".pk-tobook .section-head").innerText(), /Rezerve edilecekler\s*4 · 0 alındı/);
  // A to-do moved to the bookings is a thing to do with a ticket there, not a "Yapılacak".
  const lelloCard = app.locator('.pk-tobook .pk-card[aria-label="Livraria Lello, giriş bileti var"]');
  await lelloCard.waitFor();
  assert.match(await lelloCard.locator(".pk-kind").innerText(), /Etkinlik/);
  // The panel scrolls inside the page: scroll the list to the top, then take the window.
  await app.setViewportSize({ width: 1440, height: 1400 });
  await app.locator(".pk-tobook").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4l-tobook.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  // Narrow: the + and × are there without a hover.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.mouse.move(0, 0);
  assert.equal(await opacity(douroCard().locator(".pk-x")), "0.55");
  await app.screenshot({ path: `${out}/4i-plan-narrow-032.png` });
  await app.setViewportSize({ width: 1440, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4j-plan-032.png` });
  await app.setViewportSize({ width: 1440, height: 900 });
  const ref032 = await context.newPage();
  for (const name of ["2026-10-05-fikirler-v1", "2026-10-05-ulasim-v3", "2026-10-05-etkinlik-v4"]) {
    for (const width of [1440, 560]) {
      await ref032.setViewportSize({ width, height: 900 });
      await ref032.goto(pathToFileURL(path.resolve(`docs/mockups/${name}.html`)).href);
      await ref032.screenshot({ path: `${out}/ref-${name}-${width}.png`, fullPage: true });
    }
  }
  await ref032.close();
  console.log("✓ 0.32: flight stays a flight after a taxi transfer; × + undo on a card and a stay; + with the right city and day everywhere; Fikirler: quick line, filter, day + meal, done, moved to bookings, thin line in the day");

  // 4m. 0.33: a tile adds at once and the card opens for editing; Enter saves, Esc leaves it, Geri al takes it away;
  // a saved page's card corrected where it stands ("sayfadaki: … · geri al"); a transfer's ends short; × on night blocks.
  await tab("Plan").click();
  // "+" after the flight in → Otobüs: "Porto → ?", where it goes ready; Esc leaves it as it is; "Geri al" takes it away.
  await plus(app.locator("li.tl-entry.tl-travel").first()).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otobüs", exact: true }).click();
  await box("Nereye").waitFor();
  const portoBus = pk("Otobüs · Porto → ?");
  await portoBus.waitFor();
  await box("Nereye").fill("Braga");
  await box("Nereye").press("Escape");
  await box("Nereye").waitFor({ state: "detached" });
  assert.match(await portoBus.locator(".pk-mid").innerText(), /Porto[\s\S]*Saat ekle[\s\S]*Nereye/);
  assert.match(await portoBus.locator(".pk-foot").innerText(), /Fiyat ekle/);
  await app.locator(".pk-undo", { hasText: "Otobüs eklendi" }).getByRole("button", { name: "Geri al" }).click();
  await portoBus.waitFor({ state: "detached" });
  // "+" at Porto's head → Otel: one night of its own (a stay apart), its name ready; the check-in moved keeps one night.
  await plus(app.locator('.city-block[aria-label="Porto"] .tl-insert')).click();
  await app.getByRole("dialog", { name: "Ne eklemek istersin?" }).getByRole("button", { name: "Otel", exact: true }).click();
  await box("Ad").fill("Casa do Rio");
  await box("Ad").press("Enter");
  const apart = app.locator(".stay-open", { hasText: "Casa do Rio" });
  await apart.waitFor();
  assert.equal(await apart.evaluate((el) => el.closest(".stay-block").id), "block-2026-10-08");
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
  await hint.getByRole("button", { name: "geri al" }).click();
  await douroPage.locator("h3", { hasText: "Douro tekne turu" }).waitFor();
  // A transfer's ends, short: "Porto Havalimanı" over OPO, "Booking.com" over the stay's name.
  assert.match(await arrivalLeg.locator(".pk-mid").innerText(), /Porto Havalimanı\s*OPO[\s\S]*Booking\.com\s*Jardim Stay/);
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
  await app.setViewportSize({ width: 1440, height: 1400 });
  await extra.hover();
  await extra.getByRole("button", { name: /: gerek yok$/ }).click();
  await app.locator(".pk-undo", { hasText: "gizlendi" }).waitFor();
  await app.locator("#block-2026-10-14.skipped").waitFor();
  await app.getByRole("button", { name: /Gizlenenler/ }).click();
  const nightsRow = app.locator(".hidden-row", { hasText: "Geceler" });
  assert.match(await nightsRow.innerText(), /14–15 Ekim/);
  await nightsRow.getByRole("button", { name: "Geri getir" }).click();
  await app.locator("#block-2026-10-14 .stay-open").waitFor();
  await setEnd("2026-10-14");
  await app.locator("#block-2026-10-14").waitFor({ state: "detached" });
  await app.setViewportSize({ width: 1440, height: 900 });
  console.log("✓ 0.33: a tile adds at once and opens for editing (Tab, Enter, Esc, Geri al); a stay apart edited, moved and deleted with ×; a saved page corrected and taken back; short transfer ends; empty nights hidden and brought back");
  console.log("✓ board: demo trip, decision labels, comparison with priorities, drawer, status change and chat event");

  // 5. Settings dialog.
  await app.goto(`chrome-extension://${id}/app.html#settings`);
  await app.getByText("Gemini API anahtarı").waitFor(); // free Gemini is the default provider
  await app.screenshot({ path: `${out}/6-settings.png` });
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
  viewport: { width: 1440, height: 900 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
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
      const prompt = body.contents[0].parts.map((p) => p.text ?? "").join("");
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
  // Remembered as something the traveller said, and removable from "Seni böyle anladım".
  await board.locator(".hx-intent-toggle", { hasText: "Fiyat: çok önemli" }).waitFor();
  await board.locator(".reco-line").getByRole("button", { name: "Karşılaştır →" }).click();
  compare = board.getByRole("dialog", { name: "Karşılaştırma" });
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
  viewport: { width: 1200, height: 800 },
  ...TURKISH,
  args: [...HEADLESS_ARGS, LANG_ARG, `--disable-extensions-except=${installDir}`, `--load-extension=${installDir}`],
});
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
