const { app, log, id, T, open, tab, shot, over, trips } = P;
const tids = await app.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  return new Promise((r) => { const q = db.transaction("trips").objectStore("trips").getAll(); q.onsuccess = () => r(q.result.map((t) => [t.id, t.title])); });
});
for (const [tid, title] of tids) {
  const key = title.slice(0, 8).replace(/\W/g, "");
  await open(tid);
  log(title, "| plan sections", await app.locator(".cat-sec").count(), "| pk-card", await app.locator(".pk-card").count(), "| ev-card", await app.locator(".ev-card").count(), "| h1", await app.locator("h1").first().innerText().catch(() => "-"));
  await shot(`old-${key}-plan`); await over(`${title} plan`);
  for (const [name, mode] of [["Kompakt", null], ["Liste", "Liste"], ["Kartlar", "Kartlar"], ["Harita", "Harita"]]) {
    await tab("Gün gün").catch(() => {}); await app.waitForTimeout(600);
    if (await app.locator(".days-mode").count()) await app.locator(".days-mode").getByRole("button", { name, exact: true }).click().catch((e) => log("  mode click fail", name));
    await app.waitForTimeout(900);
    const days = await app.evaluate(() => ({ dg: document.querySelectorAll(".dg-day").length, dv: document.querySelectorAll(".dv-day").length, empty: document.querySelector(".panel")?.innerText.replace(/\s+/g, " ").slice(0, 90) }));
    log("  ", name, JSON.stringify(days)); await over(`${title} ${name}`);
    if (title.startsWith("Tarihsiz") || title.startsWith("Portekiz")) await shot(`old-${key}-days-${name}`);
  }
  await app.locator(".days-mode").getByRole("button", { name: "Kompakt", exact: true }).click().catch(() => {});
  await tab("Yolculuk sırasıyla").catch(() => {}); await app.waitForTimeout(700); log("  story cards", await app.locator(".pk-card, .jf *").count()); await over(`${title} story`);
  await app.getByRole("tab", { name: /^Pano/ }).click().catch(() => {}); await app.waitForTimeout(900); log("  pano cards", await app.locator(".pn-card").count()); await over(`${title} pano`);
}
