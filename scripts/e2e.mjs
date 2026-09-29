// Loads the built extension in Chromium and checks the page reader, the capture queue and the board.
// Usage: npm run build && xvfb-run -a node scripts/e2e.mjs   (screenshots go to e2e-output/)
import { build } from "esbuild";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const out = path.resolve("e2e-output");
mkdirSync(out, { recursive: true });
const extension = path.resolve("dist");
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-")), {
  executablePath,
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: [
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
  console.log("✓ capture queue: worker processed the capture and the board shows the missing-key error");

  // 4. Demo trip, a group expanded, and the detail drawer.
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // The trip at a glance beside its picture.
  assert.deepEqual(await app.locator(".hero-stats li").allInnerTexts(), ["7 gün", "2 şehir", "5 etkinlik", "1 konaklama", "1 ulaşım"]);
  await app.getByText("Jardim Stay").first().waitFor();
  // A block per city (Porto, Lisbon) with its transfers, nights and days; the flights and the train between them.
  assert.equal(await app.locator(".day-strip").count(), 0, "no band of nights");
  const cities = await app.locator(".city-block .city-head").allInnerTexts();
  assert.deepEqual(cities.map((t) => t.replace(/\s+/g, " ")), ["1 Porto 8–11 Ekim · 3 gece", "2 Lizbon 11–14 Ekim · 3 gece"]);
  assert.match(await app.locator(".tl-stay .tl-label").first().innerText(), /Konaklama\s*8–11 Ekim\s*3 gece/);
  await app.locator(".stay-block.booked", { hasText: "Lisboa Loft" }).waitFor();
  await app.getByText("Kapanan seçenekler (1)").waitFor();
  assert.equal(await app.locator(".stay-block", { hasText: "Alfama Suites" }).count(), 0, "a booking closes its alternatives");
  // The trip in order: day 1 on the way in, Porto (its stay, then a card for each day), day 4 on the move, Lisbon, day 7 home.
  const heads = await app.locator(".trip-line .tl-label b").allInnerTexts();
  assert.deepEqual(heads, ["1. gün", "Konaklama", "2. gün", "3. gün", "4. gün", "Konaklama", "5. gün", "6. gün", "7. gün"]);
  assert.deepEqual(
    await app.locator(".city-block").evaluateAll((els) => els.map((e) => [...e.querySelectorAll(".tl-label b")].map((b) => b.textContent).join(","))),
    ["Konaklama,2. gün,3. gün", "Konaklama,5. gün,6. gün"],
  );
  // Days with nothing yet say so; the 9th has its boat tour.
  assert.equal(await app.locator(".tl-day .day-card.empty").count(), 3);
  // A day on the move is one card on the line between the cities: its steps in order, each with its time and where it stands.
  const journey = (n) => app.locator(".tl-journey", { has: app.locator(".tl-label b", { hasText: new RegExp(`^${n}\\. gün$`) }) });
  const titles = (n) => journey(n).locator(".dr").evaluateAll((els) => els.map((e) => e.dataset.title));
  const states = (n) => journey(n).locator(".dr").evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith("st-"))));
  const dayRow = (n, title) => journey(n).locator(`.dr[data-title="${title}"]`);
  assert.equal(await journey(4).locator(".journey-head b").innerText(), "Porto → Lizbon");
  assert.deepEqual(await titles(4), ["Check-out", "Otel → Gar", "Tren Porto → Lizbon", "Gar → Otel", "Check-in"]);
  assert.deepEqual(await journey(7).locator(".dr-time > b").allInnerTexts(), ["~11:00", "17:40", "19:40"]);
  // Information is a line; a booking is a card until it's booked, then a ✓ line.
  assert.deepEqual(await states(7), ["st-info", "st-open", "st-done"]);
  await dayRow(7, "Uçuş LIS → IST").locator(".dr-line", { hasText: "TAP · Lizbon → İstanbul · 19:40 → 01:35" }).waitFor();
  // Transfers read like a ticket: "Havalimanı → Otel", the names under it.
  assert.equal(await dayRow(1, "Havalimanı → Otel").locator(".leg-title").innerText(), "Havalimanı → Otel");
  await dayRow(1, "Havalimanı → Otel").locator(".leg-sub", { hasText: "OPO havalimanı →" }).waitFor();
  // Where each plan stands is on top of its card: booked in green, planned in amber.
  await app.locator(".tl-stay.st-booked .status-bar.st-booked", { hasText: "Rezerve edildi" }).waitFor();
  // Undecided needs are decision cards to swipe through, best first; decided ones are one line.
  const card = (name) => app.locator(`.swipe-card[aria-label="${name}"]`);
  await card("Jardim Stay").locator(".sc-score.best").waitFor();
  assert.match(await card("Jardim Stay").locator(".sc-source").innerText(), /Booking\.com$/);
  assert.equal(await card("Jardim Stay").locator(".sc-sub").innerText(), "Otel odası");
  assert.match(await card("Jardim Stay").locator(".sc-price").innerText(), /€285\s*3 gece toplam\s*€95 \/ gece/);
  // For it on the left, against it on the right, a few words a line, the biggest first.
  assert.deepEqual((await card("Jardim Stay").locator(".sc-col.pros li > span").allInnerTexts()).map((t) => t.replace("★", "")), ["Yakın", "Ücretsiz iptal", "Sessiz odalar", "Kahvaltı çok iyi"]);
  assert.equal(await card("Jardim Stay").locator(".sc-col.cons li > span").first().innerText(), "Odalar küçük");
  // Closed cards side by side stand the same height.
  const heights = await app.locator(".stay-block.open .option-grid .swipe-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  assert.equal(new Set(heights).size, 1, `card heights ${heights}`);
  // Casa Azul is out for this traveller (asked for somewhere quiet): the reason leads its cons, and it goes last.
  await card("Casa Azul").locator(".sc-col.cons li.strong", { hasText: "Elendi: Yan binada inşaat var" }).waitFor();
  await card("Casa Azul").locator(".sc-flag.warning", { hasText: "Elendi" }).waitFor();
  // Side by side, no swiping: all three at once, best first, the one that's out last.
  const porto = app.locator(".stay-block.open .option-grid");
  assert.deepEqual(await porto.locator(".swipe-card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), ["Jardim Stay", "Ribeira Rooms", "Casa Azul"]);
  const tops = await porto.locator(".swipe-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  assert.equal(new Set(tops).size, 1, "the options sit in one row");
  // The recommendation in one line above them, with what makes it the one.
  const stayCard = app.locator(".stay-block .reco-line");
  assert.match(await stayCard.innerText(), /Önerim Jardim Stay:\s*Ribeira Rooms karşısında €45 daha ucuz; yakın, ücretsiz iptal ve sessiz odalar/);
  // ★ where the traveller's own priorities are: free cancellation (their pattern), quiet (they said so).
  assert.deepEqual(
    await card("Jardim Stay").locator(".sc-col.pros li:has(.mine) > span").allInnerTexts(),
    ["Ücretsiz iptal★", "Sessiz odalar★"],
  );
  // The slim strip under the summary: what to decide, book and plan, counted; a chip lists them, a tap goes there.
  const todo = app.locator(".todo-wrap");
  const chip = (kind) => todo.locator(`.todo-chip.k-${kind}`);
  assert.deepEqual(
    await Promise.all(["decide", "book", "plan"].map((k) => chip(k).locator("b").innerText())),
    ["3", "1", "4"],
  );
  await chip("decide").click();
  await todo.locator(".todo-list button", { hasText: "Porto konaklama · 8–11 Ekim" }).click();
  await app.locator(".tl-stay.flash").waitFor();
  await chip("plan").click();
  assert.match(await todo.locator(".todo-list").innerText(), /Varış transferi · 8 Ekim[\s\S]*nasıl\?/);
  await chip("plan").click();
  assert.equal(await todo.locator(".todo-list").count(), 0);
  // Cancellations running out show up there too (the sample trip is dated, so only when those dates are near).
  // And the money: booked, chosen and a guess for what's open, against the budget.
  assert.match(await app.locator(".budget").innerText(), /\/ €1\.500 bütçe/);
  // Decided already: the boat tour on the 9th and the flight home.
  const douro = app.locator(".tl-day .settled-card", { hasText: "Douro tekne turu" });
  await douro.locator(".status-bar").getByText("bilet alınmadı").waitFor();
  await dayRow(7, "Uçuş LIS → IST").locator(".dr-line").click();
  const home = app.locator(".tl-travel.role-departure .settled-card");
  await home.locator(".status-bar.st-booked", { hasText: "Bilet alındı" }).waitFor();
  // A misclick on "Bileti aldım" can be taken back, and redone.
  await home.getByRole("button", { name: "Geri al" }).click();
  await home.locator(".status-bar").getByText("bilet alınmadı").waitFor();
  await home.getByRole("button", { name: "Bileti aldım" }).click();
  await home.locator(".status-bar.st-booked", { hasText: "Bilet alındı" }).waitFor();
  assert.match(await home.locator(".route").innerText(), /LIS[\s\S]*19:40 · 14 Ekim[\s\S]*4 sa 55 dk[\s\S]*Direkt[\s\S]*IST[\s\S]*01:35 · 15 Ekim/);
  // A decided card opens on a tap, with its details.
  await douro.locator(".stc-main").click();
  await douro.locator(".stc-details").getByRole("button", { name: "Tüm detaylar" }).waitFor();
  await douro.locator(".stc-main").click();
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/3-board.png` });

  // "Detaylar" opens the card in place, kept short: where it stands, the facts, what's for and against it.
  await card("Jardim Stay").getByRole("button", { name: "Detaylar ▾" }).click();
  const jardimDetails = card("Jardim Stay").locator(".card-details");
  await jardimDetails.locator(".cd-verdict").waitFor();
  await jardimDetails.locator(".cd-list.pros li", { hasText: "Sessiz odalar, iyi uyku · 3 yorum" }).waitFor();
  assert.match(await jardimDetails.locator(".cd-facts").innerText(), /Tarih\s*8–11 Ekim · 3 gece[\s\S]*Puan\s*8,9 \/ 10 · 1\.204 yorum[\s\S]*İptal/i);
  await jardimDetails.locator(".small-note", { hasText: "5 yorum incelendi (sitede 1.204)" }).waitFor();
  await app.screenshot({ path: `${out}/3-cards.png` });
  await card("Jardim Stay").getByRole("button", { name: "Kapat ▴" }).click();
  await card("Ribeira Rooms").getByRole("button", { name: "Detaylar ▾" }).click();
  await card("Ribeira Rooms").locator(".card-details .cd-list.cons", { hasText: "Hafta sonu gece gürültüsü" }).waitFor();
  await card("Ribeira Rooms").getByRole("button", { name: "Kapat ▴" }).click();

  // The evidence behind a finding is one tap deeper ("Tüm detaylar"), with "sorun değil": the
  // construction then no longer rules Casa Azul out.
  await card("Casa Azul").getByRole("button", { name: "Detaylar ▾" }).click();
  await card("Casa Azul").locator(".card-details .cd-list.cons li.strong", { hasText: "sessiz bir yer istiyorsun" }).waitFor();
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
  await card("Casa Azul").locator(".sc-flag.warning", { hasText: "Elendi" }).waitFor({ state: "detached" });
  await card("Casa Azul").getByRole("button", { name: "Kapat ▴" }).click();
  // How it understood the traveller so far: what they said (incl. "sorun değil") and a pattern in the saved stays.
  await app.locator(".intent-card .intent-head").click();
  await app.locator(".intent-list", { hasText: "ücretsiz iptalli" }).waitFor();
  await app.locator(".intent-list", { hasText: "Sorun değil: Yan binada inşaat gürültüsü" }).waitFor();
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
  // Location stops mattering → the cheaper stay wins, and the view says what would flip it back.
  await compare.locator("tr", { hasText: "Konum" }).locator("select").selectOption("0");
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
  await card("Pegasus · direkt").getByRole("button", { name: "Seç" }).click();
  await app.locator(".tl-travel.role-arrival .settled-card", { hasText: "IST" }).locator(".status-bar").getByText("bilet alınmadı").waitFor();
  // Porto chosen, Lisbon booked: the transfers between them lay themselves out (the saved train is
  // the move, with a station transfer on each side), and the way home says what's easy to miss.
  const leg = (names) => app.locator(".leg", { has: app.locator(".leg-sub", { hasText: names }) });
  const landing = leg("OPO havalimanı → Jardim Stay");
  await landing.locator(".leg-chip.st-empty").waitFor();
  // Landing 10:05: the transfer then, check-in from 14:00 as the page says.
  assert.match(await dayRow(1, "Havalimanı → Otel").locator(".dr-time").innerText(), /10:05\s*iniş/);
  assert.match(await dayRow(1, "Check-in").innerText(), /14:00\s*en erken[\s\S]*Jardim Stay/);
  // The notes wait behind a tap (a small ⓘ says there are some).
  assert.equal(await landing.locator(".leg-note").count(), 0);
  await landing.locator(".leg-hint").waitFor();
  await landing.locator(".leg-head").click();
  await landing.locator(".leg-note", { hasText: "Varış 10:05, giriş en erken 14:00 (sayfada yazıyor)" }).waitFor();
  await leg("Jardim Stay → Porto Campanhã").waitFor();
  assert.equal(await leg("Jardim Stay → Porto Campanhã").locator(".leg-title").innerText(), "Otel → Gar");
  await app.locator(".tl-travel.role-move .swipe-card", { hasText: "CP Alfa Pendular" }).waitFor(); // the move is the saved train, still to pick
  await leg("Lisboa Santa Apolónia → Lisboa Loft").waitFor();
  assert.match(await dayRow(7, "Otel → Havalimanı").locator(".dr-time").innerText(), /17:40\s*en geç havalimanında/);
  await leg("Lisboa Loft → LIS havalimanı").locator(".leg-head").click();
  await leg("Lisboa Loft → LIS havalimanı").locator(".leg-note", { hasText: "arada ~6 saat boşluk" }).waitFor();
  // "Metroyla gideceğim": nothing to book, so the transfer folds into a ✓ line.
  await landing.getByRole("button", { name: "🚇 Metro" }).click();
  await journey(1).locator('.dr.st-done[data-title="Havalimanı → Otel"] .dr-line', { hasText: "Metro · planlandı" }).waitFor();
  // "Gerek yok": a transfer they don't need leaves the line (and the to-dos), and comes back from "Gizlenenler".
  const lisbonIn = leg("Lisboa Santa Apolónia → Lisboa Loft");
  await lisbonIn.locator(".leg-head").click();
  await lisbonIn.getByRole("button", { name: "Gerek yok · gizle" }).click();
  await lisbonIn.waitFor({ state: "detached" });
  const hiddenRow = app.locator(".section", { has: app.locator(".row-name", { hasText: "Gizlenenler (1)" }) });
  await hiddenRow.locator(".row").click();
  await hiddenRow.getByRole("button", { name: "Geri getir", exact: true }).click();
  await lisbonIn.waitFor();
  assert.equal(await app.locator(".row-name", { hasText: "Gizlenenler" }).count(), 0);
  await journey(1).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5-legs.png` });
  await journey(4).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5b-legs.png` });
  // A narrow window: the cards still swipe, nothing spills out sideways.
  const wide = app.viewportSize();
  await app.setViewportSize({ width: 820, height: 900 });
  await journey(4).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/5c-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll");
  await app.setViewportSize(wide);
  // Without the train, Porto → Lizbon is a move to plan: by plane it reads as a flight, with its status on it.
  // "Ele" right on the card: it leaves the options and waits under "Elenenler".
  await card("CP Alfa Pendular · Porto → Lizbon").getByRole("button", { name: "Ele", exact: true }).click();
  await app.locator(".row-name", { hasText: "Elenenler (1)" }).waitFor();
  const move = app.locator(".move-card");
  await move.locator(".status-bar.st-open", { hasText: "Planlanmadı" }).waitFor();
  assert.match(await move.locator(".route").innerText(), /Porto[\s\S]*Lizbon/);
  await move.locator(".stc-main").click();
  await move.getByRole("button", { name: "✈ Uçak" }).click();
  await dayRow(4, "Uçuş Porto → Lizbon").waitFor();
  await move.locator(".status-bar.st-planned", { hasText: "Planlanıyor" }).waitFor();
  await move.locator(".status-bar").getByText("bilet alınmadı").waitFor();
  assert.equal(
    decodeURIComponent(await move.getByRole("link", { name: "Uçuş ara ↗" }).getAttribute("href")),
    "https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11",
  );
  // By plane there's an airport at each end: the transfers show up.
  await leg("Jardim Stay → Porto havalimanı").waitFor();
  await move.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/5d-move.png` });
  await move.getByRole("button", { name: "Bileti aldım" }).click();
  // Bought: the card folds into a ✓ line; a tap opens it again.
  const bought = dayRow(4, "Uçuş Porto → Lizbon").locator(".dr-line", { hasText: "Uçak · bilet alındı" });
  await bought.click();
  await move.locator(".status-bar.st-booked", { hasText: "Bilet alındı" }).waitFor();
  // Places without a day stay together, as cards to browse.
  await app.getByText("Etkinlikler").click();
  await card("Tiyatro").waitFor();
  assert.equal(await app.locator(".crash").count(), 0, "board crashed after chat updates");
  await app.screenshot({ path: `${out}/5-chosen.png` });
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
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
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
      { text: "Yan binada inşaat gürültüsü", polarity: "negative", topic: "condition", source: "reviews", severity: "high", quotes: ["Construction next door starts at 8 every morning", "The building work next to the flat was loud all day"] },
      { text: "Altında çok iyi bir İtalyan restoranı", polarity: "positive", topic: "nearby", source: "reviews", severity: "medium", quotes: ["Great Italian restaurant right downstairs"] },
      { text: "Geniş, rahat yatak", polarity: "positive", topic: "bed", source: "description", severity: "medium", quotes: ["King-size bed"] },
      { text: "Çatı havuzu", polarity: "positive", topic: "facilities", source: "description", severity: "low", quotes: ["Rooftop pool with a view"] },
    ],
  };
  const jardimReading = {
    review_total: 1204,
    reviews: [],
    findings: [
      { text: "Bahçe manzaralı oda", polarity: "positive", topic: "view", source: "description", severity: "low", quotes: ["Deluxe Double with Garden View"] },
      { text: "Sessiz odalar", polarity: "positive", topic: "noise", source: "reviews", severity: "medium", quotes: ['Guest reviews: "Great location", "Quiet rooms"'] },
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
    if (text.includes("functionResponse")) return route.fulfill(reply([{ text: "Fiyatı konaklamada çok önemli yaptım." }]));
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
  // Ruled out on that evidence by the analysis, which sees the findings with their counts.
  const casaCard = board.locator('.swipe-card[aria-label="Casa Azul"]');
  await casaCard.locator(".sc-col.cons li.strong", { hasText: "Elendi: Yan binada inşaat" }).waitFor({ timeout: 40000 });
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
  console.log("✓ flow: pages read closely → verified findings with counts; invented quotes dropped; ruled out with evidence");

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
  await board.locator(".intent-card .intent-head", { hasText: "Fiyat: çok önemli" }).waitFor();
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
  args: [`--disable-extensions-except=${installDir}`, `--load-extension=${installDir}`],
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
