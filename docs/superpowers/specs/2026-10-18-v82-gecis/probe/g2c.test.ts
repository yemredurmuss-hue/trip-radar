import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { applyAnswer, fresh, made, pipeline, setLang, typed } from "./lib";
import { routeForGenerate, intentRoute } from "/home/user/trip-radar/src/lib/startTrip";
import { makeItem } from "/home/user/trip-radar/tests/fixtures/makeItem";
import type { Item, Trip } from "/home/user/trip-radar/src/lib/types";
const out: Record<string, unknown> = {};
const run = (name: string, fn: () => unknown) => { try { out[name] = fn(); } catch (e) { out[name] = { HATA: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 5) }; } };
it("g2c", () => {
  setLang("tr");
  run("02d_tomorrowland_6nights", () => {
    let s = typed(fresh(), "Tomorrowland'e 6 gece gidiyoruz, 2 kişiyiz");
    s = applyAnswer(s, { q: "event", confirm: true }, 3);
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 4);
    const r = routeForGenerate(s);
    s = r ? { ...s, route: r } : s;
    return { route: r, ir: intentRoute(s), made: made(s) };
  });
  run("02e_tomorrowland_6n_camp_early2", () => {
    let s = typed(fresh(), "Tomorrowland'e 6 gece gidiyoruz, 2 kişiyiz");
    s = applyAnswer(s, { q: "event", confirm: true }, 3);
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 4);
    s = applyAnswer(s, { q: "pb", key: "festival:stay", value: "camp" }, 5);
    s = applyAnswer(s, { q: "pb", key: "festival:early", value: "2" }, 6);
    const r = routeForGenerate(s);
    s = r ? { ...s, route: r } : s;
    return made(s);
  });
  // Açık geceler birleşiyor mu? (iptal olmadan: Kyoto seçenek, Hakone boş, Osaka seçenek)
  run("22b_open_nights_merge", () => {
    const trip: Trip = { id: "t1", title: "J", confirmedDates: { start: "2027-04-05", end: "2027-04-16" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const st = (name: string, city: string, start: string, end: string) => makeItem({ name, category: "stay", city, needKey: `stay:${city}`, dates: { start, end, source: "page" }, status: "saved" });
    const items: Item[] = [st("Gion", "Kyoto", "2027-04-05", "2027-04-09"), st("Swiss", "Osaka", "2027-04-12", "2027-04-16")];
    const p = pipeline(trip, items);
    return { blocks: p.stayBlocks, sections: p.sections };
  });
  writeFileSync("out-g2c.json", JSON.stringify(out, null, 1));
});
