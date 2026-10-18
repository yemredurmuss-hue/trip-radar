const { app, T, log, open, tab, shot, W } = P;
for (const key of ["sample", "ozora", "states"]) {
  await open(T[key]);
  const w = await app.locator(".pk-why").evaluateAll((els) => els.map((e) => [e.closest("[aria-label]")?.getAttribute("aria-label")?.slice(0, 40), e.textContent, e.getAttribute("data-why")]));
  log(key, "pk-why", w.length, JSON.stringify(w));
  log(key, "cards", await app.locator(".pk-card").count());
}
// compare table stars (sample)
await open(T.sample);
const sec = app.locator('.cat-sec[data-section="stay"]');
await sec.locator(".pk-alt").first().click(); await app.waitForTimeout(700);
log("back .mine-star", await sec.locator(".mine-star").count(), "why in back", await sec.locator(".pk-why").count());
await sec.getByRole("button", { name: /Karşılaştır/ }).first().click(); await app.waitForTimeout(900);
const dlg = app.getByRole("dialog", { name: "Karşılaştırma" });
log("cards view stars", await dlg.locator(".mine-star").count());
await dlg.getByRole("tab", { name: /Tablo/ }).click(); await app.waitForTimeout(700);
log("table stars", await dlg.locator(".mine-star").count(), "legend", await dlg.locator(".mine-legend").count());
await shot("why-table");
