const { app, log, T, open, tab, over, W } = P;
for (const key of ["sample", "ozora", "states"]) {
  await open(T[key]);
  await tab("Gün gün"); await app.waitForTimeout(600);
  await app.locator(".days-mode").getByRole("button", { name: "Harita", exact: true }).click(); await app.waitForTimeout(1500);
  await over(`${key} Harita`);
}
// pulses on screen (tall viewport so many are on screen)
await open(T.states);
await app.setViewportSize({ width: 1440, height: 7000 }); await app.waitForTimeout(2500);
const r = await app.evaluate(() => [...document.querySelectorAll(".ek-card .pk-ring.open, .ek-card .pk-ring.half, .pk-card.tk.tk-search")].map((e) => [e.hasAttribute("data-np"), getComputedStyle(e).animationName]));
log("pulsers on a tall screen (still?, animation):", JSON.stringify(r));
