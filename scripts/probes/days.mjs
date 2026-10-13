const { app, T, log, step, open, tab, shot, over } = P;
for (const key of ["sample", "ozora"]) {
  await open(T[key]);
  await tab("Gün gün");
  await app.waitForTimeout(800);
  const modes = await app.locator(".days-mode button").allInnerTexts();
  log(key, "modes", JSON.stringify(modes));
  // ghost copy / empty cards in Kompakt
  await app.evaluate(() => localStorage.removeItem("trip-radar:days-view"));
  await app.reload(); await app.waitForTimeout(1500); await tab("Gün gün");
  await app.waitForTimeout(150);
  log(key, "compact early ek-* count", await app.locator(".panel .ek-card, .panel .ek-route, .panel .ek-foot, .panel .ek-find, .panel .ek-link, .panel .ek-line").count());
  await app.waitForTimeout(500);
  log(key, "compact late ek-* count", await app.locator(".panel .ek-card, .panel .ek-route, .panel .ek-foot, .panel .ek-find, .panel .ek-link, .panel .ek-line").count(), "dg", await app.locator(".panel .dg").count());
  for (const m of ["Liste", "Kartlar", "Kompakt"]) {
    await app.locator(".days-mode").getByRole("button", { name: m, exact: true }).click(); await app.waitForTimeout(700);
    log(key, m, "pressed", await app.locator(".days-mode button[aria-pressed=true]").innerText(), "ls", await app.evaluate(() => localStorage.getItem("trip-radar:days-view")));
    if (m !== "Kompakt") {
      await app.reload(); await app.waitForTimeout(1500);
      log(key, m, "after reload: view tab", await app.locator("[role=tab][aria-selected=true]").allInnerTexts(), "pressed", await app.locator(".days-mode button[aria-pressed=true]").allInnerTexts().catch(() => "none"));
      if (!(await app.locator(".days-mode").count())) { await tab("Gün gün"); await app.waitForTimeout(700); log(key, m, "after reload+tab: pressed", await app.locator(".days-mode button[aria-pressed=true]").innerText()); }
    }
  }
  await app.locator(".days-mode").getByRole("button", { name: "Harita", exact: true }).click(); await app.waitForTimeout(1500);
  log(key, "map", await app.locator(".maplibregl-map, .st-map, canvas, svg.trip-map").count(), "tab sel", await app.locator("[role=tab][aria-selected=true]").allInnerTexts());
  await shot(`days-${key}-map`);
}
