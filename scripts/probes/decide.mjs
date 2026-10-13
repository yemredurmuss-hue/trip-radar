const { app, T, log, step, open, tab, shot, over, W } = P;
for (const key of ["sample", "states"]) {
  await open(T[key]);
  await app.setViewportSize({ width: W, height: 1000 });
  const sec = app.locator('.cat-sec[data-section="stay"]');
  await sec.scrollIntoViewIfNeeded();
  const alt = sec.locator(".pk-alt").first();
  log(key, "pk-alt count", await alt.count());
  if (!(await alt.count())) continue;
  await alt.click(); await app.waitForTimeout(900);
  await shot(`decide-${key}-back`);
  log(key, "back stars", await app.evaluate(() => (document.querySelector(".cat-sec[data-section=stay]")?.innerText.match(/★/g) || []).length), "texts", (await sec.locator(".cat-sheet, .bf").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300));
  const cmp = sec.getByRole("button", { name: /Karşılaştır/ });
  log(key, "karşılaştır in back", await cmp.count());
  if (!(await cmp.count())) continue;
  await cmp.first().click(); await app.waitForTimeout(1200);
  const dlg = app.getByRole("dialog", { name: "Karşılaştırma" });
  log(key, "dialog", await dlg.count());
  if (!(await dlg.count())) continue;
  await shot(`decide-${key}-compare`);
  log(key, "stars in compare", await dlg.evaluate((e) => (e.innerText.match(/★/g) || []).length));
  const seq = dlg.getByRole("button", { name: "Sırayla karar ver" });
  log(key, "sırayla", await seq.count());
  if (await seq.count()) {
    await seq.click(); await app.waitForTimeout(900);
    for (let i = 1; i < 8; i++) {
      log(key, `step${i}`, (await dlg.locator(".sd-top h3").innerText().catch(() => "-")), "| window h2:", (await dlg.locator("h2").first().innerText().catch(() => "-")), "| stars", await dlg.evaluate((e) => (e.innerText.match(/★/g) || []).length));
      await shot(`decide-${key}-step${i}`);
      await over(`${key} step${i}`);
      const next = dlg.getByRole("button", { name: "Sonra", exact: true });
      if (!(await next.count())) break;
      await next.click(); await app.waitForTimeout(600);
    }
  }
  await app.keyboard.press("Escape"); await app.waitForTimeout(400);
}
