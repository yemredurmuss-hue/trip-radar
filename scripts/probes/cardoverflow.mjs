const { app, log, T, open, tab, W } = P;
for (const key of ["sample", "ozora", "states"]) {
  await open(T[key]);
  await app.setViewportSize({ width: W, height: 7000 }); await app.waitForTimeout(2500);
  for (const [view, t] of [["cat", null], ["story", "Yolculuk sırasıyla"], ["days-liste", "Gün gün"]]) {
    if (t) { await tab(t); await app.waitForTimeout(900); }
    if (view === "days-liste") { await app.locator(".days-mode").getByRole("button", { name: "Liste", exact: true }).click(); await app.waitForTimeout(900); }
    const res = await app.evaluate(() => {
      const out = {};
      for (const card of document.querySelectorAll(".pk-card, .ev-card")) {
        const c = card.getBoundingClientRect();
        if (c.width === 0) continue;
        if (card.scrollWidth > card.clientWidth + 1) (out["SCROLLW " + card.className.slice(0, 40)] ??= 0), out["SCROLLW " + card.className.slice(0, 40)]++;
        for (const el of card.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > c.right + 2 || r.left < c.left - 8) {
            const k = (el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 2).join(".")).slice(0, 50) + " <- " + card.className.split(" ").slice(0, 3).join(".");
            out[k] = (out[k] ?? 0) + 1;
          }
          if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible" && getComputedStyle(el).textOverflow !== "ellipsis") {
            const k = "CLIP " + el.tagName.toLowerCase() + "." + String(el.className).slice(0, 30) + " '" + (el.textContent || "").slice(0, 20) + "'";
            out[k] = (out[k] ?? 0) + 1;
          }
        }
      }
      return out;
    });
    log(key, W, view, JSON.stringify(res));
  }
}
