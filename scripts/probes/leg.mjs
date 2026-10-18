const { app, T, log, open, tab } = P;
const grab = () => app.evaluate(() => [...document.querySelectorAll(".pk-card")].map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 70)).filter((t) => /Transfer|→|➔/.test(t) && /Airbnb|Booking|Havali/.test(t)));
for (const key of ["sample", "ozora"]) {
  await open(T[key]);
  log(key, "category:", JSON.stringify(await grab()));
  await tab("Yolculuk sırasıyla"); await app.waitForTimeout(900);
  log(key, "story:", JSON.stringify(await grab()));
  await tab("Gün gün"); await app.waitForTimeout(700);
  for (const m of ["Liste", "Kartlar"]) { await app.locator(".days-mode").getByRole("button", { name: m, exact: true }).click(); await app.waitForTimeout(900); log(key, m + ":", JSON.stringify(await grab())); }
  await app.locator(".days-mode").getByRole("button", { name: "Kompakt", exact: true }).click();
  log(key, "compact leg rows:", JSON.stringify(await app.evaluate(() => [...document.querySelectorAll(".dg-tl li")].map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 80)).filter((t) => /ransfer/.test(t)))));
}
