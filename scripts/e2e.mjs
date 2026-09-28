// Loads the built extension in Chromium and checks the page reader, the capture queue and the board.
// Usage: npm run build && xvfb-run -a node scripts/e2e.mjs   (screenshots go to e2e-output/)
import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
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

  // 2. Board empty state.
  const app = await context.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("İlk seçeneğini kaydet").waitFor();
  await app.screenshot({ path: `${out}/1-empty.png` });

  // 3. Queue a capture without an API key: the worker must pick it up and report a readable error.
  await app.evaluate(async (snapshot) => {
    const request = indexedDB.open("trip-radar", 1);
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
  await app.getByText("Portekiz (örnek)").waitFor();
  await app.getByText("Jardim Stay").first().waitFor();
  await app.screenshot({ path: `${out}/3-board.png` });
  await app.getByRole("button", { name: /Jardim Stay/ }).click();
  await app.getByRole("dialog").waitFor();
  await app.screenshot({ path: `${out}/4-drawer.png` });
  await app.getByRole("button", { name: "Plana al" }).click();
  await app.getByRole("button", { name: "Kapat" }).click();
  await app.getByText("Jardim Stay plana alındı").waitFor();
  await app.getByText("Etkinlikler").click();
  await app.screenshot({ path: `${out}/5-chosen.png` });
  console.log("✓ board: demo trip, drawer, status change and chat event");

  // 5. Settings dialog.
  await app.goto(`chrome-extension://${id}/app.html#settings`);
  await app.getByText("Gemini API anahtarı").waitFor(); // free Gemini is the default provider
  await app.screenshot({ path: `${out}/6-settings.png` });
  await app.getByRole("radio", { name: /Claude/ }).click();
  await app.getByText("Claude API anahtarı").waitFor();
  await app.getByRole("radio", { name: /Gemini/ }).click();
  await app.getByPlaceholder("AIza… (yapıştır)").fill("test-key");
  await app.getByRole("button", { name: "Kaydet" }).click();
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
    flight: null, highlights: ["Merkezi", "Sessiz"], concerns: [], review_summary: "Konum çok övülüyor.",
    image_url: "/relative.jpg", missing: [], trip: { existing_trip_id: null, new_trip_title: "Portekiz" }, need_key: "stay:porto",
  };
  const reply = (parts) => ({ json: { candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] } });
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
    if (body.generationConfig?.responseJsonSchema) return route.fulfill(reply([{ text: JSON.stringify(extraction) }]));
    const text = JSON.stringify(body.contents);
    if (text.includes("functionResponse")) return route.fulfill(reply([{ text: "Jardim Stay'i öneri olarak işaretledim." }]));
    const state = JSON.parse(text.match(/<trip_state>(.*?)<\/trip_state>/)[1].replace(/\\"/g, '"'));
    return route.fulfill(reply([
      { text: "Merkezi ve iptal esnek: Jardim Stay iyi bir seçim." },
      { functionCall: { id: "fc-1", name: "recommend", args: { item_id: state.items[0].id, reason: "Merkezi, ücretsiz iptal" } }, thoughtSignature: "c2ln" },
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
    const request = indexedDB.open("trip-radar", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction("captures", "readwrite");
    tx.objectStore("captures").put({ ...snapshot, id: "flow-1", kind: "extension", screenshot: null, capturedAt: Date.now(), status: "pending", error: null, itemId: null });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    await chrome.runtime.sendMessage({ type: "process" });
  }, snap);
  await board.getByRole("heading", { name: "Portekiz" }).waitFor({ timeout: 20000 });
  await board.getByText("Jardim Stay").first().waitFor();
  assert.equal(await board.locator(".crash").count(), 0, "board must not crash on real-shaped data");
  const extractionCall = geminiBodies.find((b) => b.body.generationConfig?.responseJsonSchema);
  assert.ok(extractionCall.url.includes("gemini-3-flash-preview:generateContent"));
  assert.ok(extractionCall.body.systemInstruction, "system instruction sent");
  assert.equal(extractionCall.body.generationConfig.responseMimeType, "application/json");
  await board.screenshot({ path: `${out}/8-flow-board.png` });
  console.log("✓ flow: capture → Gemini extraction (SDK request shape checked) → trip on the board");

  await board.getByPlaceholder("Bir link bırak, görsel yapıştır veya yaz…").fill("Hangisi daha mantıklı?");
  await board.getByRole("button", { name: "Gönder" }).click();
  await board.getByText("Jardim Stay'i öneri olarak işaretledim.").waitFor({ timeout: 20000 });
  await board.getByText("Senin için önerilen").waitFor();
  const chatCalls = geminiBodies.filter((b) => !b.body.generationConfig?.responseJsonSchema);
  assert.equal(chatCalls.length, 2);
  const second = chatCalls[1].body.contents;
  assert.deepEqual(second.map((c) => c.role), ["user", "model", "user"]);
  assert.equal(second[1].parts[1].thoughtSignature, "c2ln");
  assert.equal(second[2].parts[0].functionResponse.id, "fc-1");
  assert.ok(chatCalls[0].body.tools[0].functionDeclarations.some((f) => f.name === "update_items"));
  await board.screenshot({ path: `${out}/9-flow-chat.png` });
  console.log("✓ flow: chat → function call → recommendation shown; history replayed with signatures");
  console.log(`screenshots: ${out}`);
} finally {
  await flow.close();
}
