const { app, T, log, open, tab, shot, W } = P;
await open(T.sample);
const refs = await app.locator(".chat-ref").allInnerTexts();
log("chat-ref", JSON.stringify(refs));
await app.locator(".panel").evaluate((e) => (e.scrollTop = 0));
await app.locator(".chat-ref").first().click();
for (const ms of [150, 500, 1200]) {
  await app.waitForTimeout(ms === 150 ? 150 : 350);
  log(`t+${ms}`, JSON.stringify(await app.evaluate(() => [...document.querySelectorAll(".flash, .pk-glow, .pk-stage")].map((e) => (e.getAttribute("aria-label") || e.className).slice(0, 60)))), "panel scroll", await app.locator(".panel").evaluate((e) => e.scrollTop));
}
await shot("chatref-after");
await tab("Pano");
await app.waitForTimeout(800);
await app.locator(".chat-ref").first().click();
await app.waitForTimeout(500);
log("from Pano: view tabs", JSON.stringify(await app.locator("[role=tab][aria-selected=true]").allInnerTexts()), JSON.stringify(await app.evaluate(() => [...document.querySelectorAll(".flash, .pk-glow, .pn-flash")].map((e) => (e.getAttribute("aria-label") || e.className).slice(0, 60)))));
await shot("chatref-pano");
