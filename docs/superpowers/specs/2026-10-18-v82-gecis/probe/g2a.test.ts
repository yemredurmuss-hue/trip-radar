// Görev 2 (a): başlangıç sohbetinden oluşan omurga. Model okuması elle verilir (AI çağrısı yok); "AI yok" hali de denenir.
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { applyAnswer, eff, fresh, made, plan, setLang, typed } from "./lib";
import { parseStartText } from "/home/user/trip-radar/src/lib/startTrip";
import { TODAY } from "./lib";

const out: Record<string, unknown> = {};
const run = (name: string, fn: () => unknown) => {
  try { out[name] = fn(); } catch (e) { out[name] = { HATA: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 4) }; }
};
const from = (s: ReturnType<typeof fresh>) => applyAnswer(s, { q: "from", city: "İstanbul" }, 3);

it("g2a", () => {
  setLang("tr");
  const LIVEABOARD = plan({
    label: "Kızıldeniz liveaboard dalış gezisi", focus: "only", stay_type: "boat", stay_port: "Hurgada",
    cards: [
      { ref: "transfer", kind: "transfer", title: "Limana transfer", place: "Hurgada", anchor: "arrive" },
      { ref: "gear", kind: "activity", title: "Dalış ekipmanı kiralama", place: "Red Sea", anchor: "stay" },
    ],
    questions: [{ id: "gear", text: "Kendi ekipmanın var mı?", chips: [
      { value: "own", label: "Var", aliases: ["var"], effects: [eff({ op: "dropCard", card: "gear" })] },
      { value: "rent", label: "Kiralayacağım", aliases: ["kira"], effects: [] },
    ] }],
    prep: ["Dalış sertifikası"], tip: "Uçuşla son dalış arasında en az 18 saat bırak.",
    musts: [{ id: "level", text: "İleri seviye dalgıç" }],
  });
  const lbText = "Kasımda Kızıldeniz'de bir haftalık liveaboard dalış, ileri seviyeyim, 2 kişiyiz";
  const lbModel = { destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8 };
  run("01a_liveaboard_AI_plan", () => made(from(typed(fresh(), lbText, { ...lbModel, plan: LIVEABOARD }))));
  run("01b_liveaboard_AI_no_plan", () => made(from(typed(fresh(), lbText, lbModel))));
  run("01c_liveaboard_no_AI", () => ({ parsed: parseStartText(lbText, TODAY), made: made(from(typed(fresh(), lbText))) }));

  // Tomorrowland: tablodaki etkinlik → festival; kamp varsayılan; soru cevapları.
  const tl = () => from(typed(fresh(), "Temmuzda Tomorrowland'e gidiyoruz, 2 kişi"));
  run("02a_tomorrowland", () => made(tl()));
  run("02b_tomorrowland_hotel_ticket", () => {
    let s = tl();
    s = applyAnswer(s, { q: "pb", key: "festival:stay", value: "hotel" }, 4);
    s = applyAnswer(s, { q: "pb", key: "festival:ticket", value: "have" }, 5);
    return made(s);
  });

  // Wellness: yoga retreat paketi.
  run("03_yoga_retreat_ubud", () => made(from(typed(fresh(), "Martta Ubud'da 7 gece yoga retreat, tek başıma", { destination: "Ubud", destination_country: "Endonezya", destination_country_code: "ID", start_date: "2027-03-08", duration_days: 8 }))));

  // Kayak
  const ski = () => from(typed(fresh(), "Ocakta Bansko'ya 5 gece kayak, 2 kişi", { destination: "Bansko", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 }));
  run("04a_ski_bansko", () => made(ski()));
  run("04b_ski_advanced_owngear", () => {
    let s = ski();
    s = applyAnswer(s, { q: "pb", key: "ski:level", value: "advanced" }, 4);
    s = applyAnswer(s, { q: "pb", key: "ski:gear", value: "own" }, 5);
    return made(s);
  });
  run("04c_ski_country_only", () => made(from(typed(fresh(), "Şubatta Bulgaristan'da kayak, 4 gece", { destination: "Bulgaristan", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-02-05", duration_days: 5 }))));

  // Yol gezisi: 10 şehir, her gece başka otel (onaylı rota).
  run("05_roadtrip_10_cities", () => {
    let s = applyAnswer(fresh("road"), { q: "where", place: "İtalya", country: "İtalya", code: "IT" }, 2);
    s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 10 } }, 2);
    s = applyAnswer(s, { q: "start", date: "2027-05-01", approx: false }, 2);
    s = from(s);
    const cities = ["Milano", "Verona", "Venedik", "Bologna", "Floransa", "Siena", "Pisa", "Cinque Terre", "Cenova", "Torino"];
    s = { ...s, route: { stops: cities.map((c) => ({ city: c, nights: 1, code: "IT" })), arrive: null, leave: null, confirmed: true, source: "user" as const } };
    return made(s);
  });

  // Kruvaziyer: türü yok (classic); model kendi kalıbını verirse gemi = konaklama.
  const cruiseText = "Ağustosta 7 gece Akdeniz kruvaziyeri, Barselona'dan kalkış";
  const cruiseModel = { destination: "Akdeniz", destination_country: "", destination_country_code: "", start_date: "2027-08-07", duration_days: 8 };
  run("06a_cruise_no_plan", () => made(from(typed(fresh(), cruiseText, cruiseModel))));
  run("06b_cruise_AI_plan", () => made(from(typed(fresh(), cruiseText, { ...cruiseModel, destination: "Barselona", destination_country: "İspanya", destination_country_code: "ES", plan: plan({ label: "Akdeniz kruvaziyeri", stay_type: "boat", stay_port: "Barselona", cards: [{ ref: "port", kind: "transfer", title: "Limana transfer", place: "Barselona", anchor: "arrive" }, { ref: "exc", kind: "activity", title: "Kıyı turları", place: "", anchor: "stay" }] }) }))));

  run("07_business_frankfurt", () => made(from(typed(fresh(), "Önümüzdeki hafta 3 gün Frankfurt'a iş seyahati, tek başıma, fuar için", { destination: "Frankfurt", destination_country: "Almanya", destination_country_code: "DE", start_date: "2026-10-26", duration_days: 3 }))));

  run("08a_safari_kenya_no_plan", () => made(from(typed(fresh(), "Şubatta Kenya'da 6 gece safari, kamp", { destination: "Kenya", destination_country: "Kenya", destination_country_code: "KE", start_date: "2027-02-10", duration_days: 7 }))));
  run("08b_safari_kenya_AI_camp", () => made(from(typed(fresh(), "Şubatta Kenya'da 6 gece safari, kamp", { destination: "Kenya", destination_country: "Kenya", destination_country_code: "KE", start_date: "2027-02-10", duration_days: 7, plan: plan({ label: "Masai Mara safari", stay_type: "camp", stay_port: "Masai Mara", cards: [{ ref: "game", kind: "activity", title: "Safari (game drive) paketi", place: "Masai Mara", anchor: "stay" }, { ref: "fly", kind: "transfer", title: "Nairobi → Masai Mara küçük uçak", place: "Masai Mara", anchor: "arrive" }], prep: ["Sarıhumma aşısı", "Sıtma ilacı"] }) }))));

  // Interrail: 6 durak, 4 para birimi, iki vize rejimi.
  run("09_interrail_6", () => {
    let s = typed(fresh(), "Temmuzda 3 hafta Avrupa Interrail, Londra'dan Budapeşte'ye", { destination: "Avrupa", start_date: "2027-07-01", duration_days: 22 });
    s = from(s);
    const stops = [["Londra", "GB", 3], ["Paris", "FR", 4], ["Amsterdam", "NL", 3], ["Berlin", "DE", 4], ["Prag", "CZ", 3], ["Budapeşte", "HU", 4]] as const;
    s = { ...s, where: s.where ?? { place: "Avrupa", country: null, code: null }, route: { stops: stops.map(([city, code, nights]) => ({ city, code, nights })), arrive: "Londra", leave: "Budapeşte", confirmed: true, source: "user" as const } };
    return made(s);
  });

  run("10_weekend_bursa_bus", () => ({ parsed: parseStartText("Bu hafta sonu Bursa'ya otobüsle, 2 kişi", TODAY), made: made(from(typed(fresh(), "Bu hafta sonu Bursa'ya otobüsle, 2 kişi"))) }));
  run("11_daytrip_sile", () => ({ parsed: parseStartText("Cumartesi günübirlik Şile", TODAY), made: made(from(typed(fresh(), "Cumartesi günübirlik Şile", { destination: "Şile", destination_country: "Türkiye", destination_country_code: "TR", start_date: "2026-10-24", duration_days: 1 }))) }));
  run("12_no_date_summer", () => ({ parsed: parseStartText("Yazın bir ara Portekiz'e gitmek istiyoruz", TODAY), made: made(from(typed(fresh(), "Yazın bir ara Portekiz'e gitmek istiyoruz"))) }));
  run("13_group_8_kids", () => ({ parsed: parseStartText("8 kişiyiz, 4 yetişkin 4 çocuk, Ağustosta 7 gece Antalya", TODAY), made: made(from(typed(fresh(), "8 kişiyiz, 4 yetişkin 4 çocuk, Ağustosta 7 gece Antalya"))) }));
  run("14_solo_lisbon", () => made(from(typed(fresh(), "Tek başıma 5 gece Lizbon, 10 Aralık'tan"))));
  run("16a_long_name", () => ({ parsed: parseStartText("Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch'ta 2 gece", TODAY), made: made(from(typed(fresh(), "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch'ta 2 gece", { destination: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch", destination_country: "Birleşik Krallık", destination_country_code: "GB", start_date: "2027-05-01", duration_days: 3 }))) }));
  run("16b_playa_del_carmen", () => ({ parsed: parseStartText("Playa del Carmen'de 5 gece, Ocak", TODAY), made: made(from(typed(fresh(), "Playa del Carmen'de 5 gece, Ocak", { destination: "Playa del Carmen", destination_country: "Meksika", destination_country_code: "MX", start_date: "2027-01-10", duration_days: 6 }))) }));
  // Açık çene: Tokyo'ya in, Osaka'dan dön.
  run("20_open_jaw_japan", () => {
    let s = typed(fresh(), "1 Nisan'dan 15 gece Japonya, Sabine'yle", { destination: "Japonya", destination_country: "Japonya", destination_country_code: "JP", start_date: "2027-04-01", duration_days: 16 });
    s = from(s);
    s = { ...s, route: { stops: [{ city: "Tokyo", nights: 4, code: "JP" }, { city: "Kyoto", nights: 4, code: "JP" }, { city: "Hakone", nights: 3, code: "JP" }, { city: "Osaka", nights: 4, code: "JP" }], arrive: "Tokyo", leave: "Osaka", confirmed: true, source: "ai" as const } };
    return made(s);
  });
  run("20b_japan_route_unconfirmed", () => made(from(typed(fresh(), "1 Nisan'dan 15 gece Japonya, Sabine'yle", { destination: "Japonya", destination_country: "Japonya", destination_country_code: "JP", start_date: "2027-04-01", duration_days: 16 }))));
  writeFileSync("out-g2a.json", JSON.stringify(out, null, 1));
});
