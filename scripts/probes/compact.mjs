import fs from "node:fs";
const { app, open, tab } = P;
const tids = await app.evaluate(async () => { const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction("trips").objectStore("trips").getAll(); q.onsuccess = () => r(q.result.map((t) => [t.id, t.title])); }); });
const out = {};
for (const [tid, title] of tids.slice(0, 3)) {
  await open(tid); await tab("Gün gün"); await app.waitForTimeout(1200);
  out[title] = await app.evaluate(() => [...document.querySelectorAll(".dg-day")].map((d) => d.innerText.replace(/\s+/g, " ").trim()));
}
fs.writeFileSync(process.env.COMPACT_OUT, JSON.stringify(out, null, 1));
