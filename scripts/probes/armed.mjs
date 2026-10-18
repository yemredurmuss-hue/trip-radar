const { app, log, T, open, W, shot } = P;
await open(T.states);
await app.setViewportSize({ width: W, height: 7000 }); await app.waitForTimeout(2500);
const info = await app.evaluate(() => { const card = [...document.querySelectorAll(".pk-card.pk-arranged")].find((c) => c.scrollWidth > c.clientWidth + 1); if (!card) return null; const r = card.getBoundingClientRect(); card.scrollIntoView({ block: "center" }); return { label: card.getAttribute("aria-label"), cls: card.className, w: r.width, sw: card.scrollWidth, cw: card.clientWidth, sec: card.closest("[data-section]")?.getAttribute("data-section"), top: card.querySelector(".pk-top")?.innerText.replace(/\s+/g, " ") }; });
log("card", JSON.stringify(info));
await app.setViewportSize({ width: W, height: 1000 });
await app.waitForTimeout(500);
const el = app.locator(".pk-card.pk-arranged").filter({ has: app.locator(".pk-top") });
const n = await el.count();
for (let i = 0; i < n; i++) { const ok = await el.nth(i).evaluate((c) => c.scrollWidth > c.clientWidth + 1); if (ok) { await el.nth(i).scrollIntoViewIfNeeded(); await el.nth(i).screenshot({ path: `${P.out}/armed-card.png` }); log("shot card", i); } }
