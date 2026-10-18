import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { parseStartText } from "/home/user/trip-radar/src/lib/startTrip";
import { setLang } from "/home/user/trip-radar/src/lib/i18n";
it("g2e", () => {
  setLang("tr");
  const T = "2026-10-18";
  const xs = ["Temmuzda Tomorrowland'e gidiyoruz, 2 kişi", "Porto'ya 2 kişi gidiyoruz", "Lizbon, 2 kişiyiz", "Roma 3 gece 2 kişi", "Bu hafta sonu Bursa'ya otobüsle", "Cumartesi günübirlik Şile'ye", "yazın 10 gün İtalya", "Ağustos ortası 10 gün Roma", "Kızıldeniz'de 1 hafta", "Akdeniz kruvaziyeri 7 gece"];
  writeFileSync("out-g2e.json", JSON.stringify(xs.map((x) => { const p = parseStartText(x, T); return { x, where: p.where?.place ?? null, who: p.who, start: p.start, duration: p.duration }; }), null, 1));
});
