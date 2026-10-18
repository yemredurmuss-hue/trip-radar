// Görev 1: hangi türler var, hangi sözcükler hangi türe düşüyor, her yerleşik türün iskeleti (aynı bağlamda).
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { PLAYBOOKS, playbookFor, playbookOf, customPlaybook, validModelPlaybook, playbookQuestions, allowedSuggestions, blockedWords } from "/home/user/trip-radar/src/lib/playbooks";
import { setLang } from "/home/user/trip-radar/src/lib/i18n";
import { findEvent } from "/home/user/trip-radar/src/lib/startEvents";
import { SECTION_ORDER, sectionOfItem } from "/home/user/trip-radar/src/lib/categories";
import { plannedItem } from "/home/user/trip-radar/src/lib/planned";
import { TEMPLATES } from "/home/user/trip-radar/src/lib/templates";
import { plan } from "./lib";

it("g1", () => {
  setLang("tr");
  const out: Record<string, unknown> = {};
  out.kinds = Object.keys(PLAYBOOKS).concat(["custom"]);
  out.sectionOrder = SECTION_ORDER;
  out.templates = TEMPLATES.map((t) => `${t.id}:${t.kind}:${t.group}:${t.form}`);
  const phrases = [
    "Kızıldeniz'de liveaboard dalış", "dalış turu Kaş", "Tomorrowland'e gidiyoruz", "Ozora festivali", "Glastonbury", "festival", "Sziget",
    "Bali'de yoga retreat", "wellness inzivası", "spa hafta sonu", "detoks kampı", "meditasyon",
    "Bansko'da kayak", "Uludağ", "snowboard Niseko", "sea kayaking", "kayak yapmak", "Maldivler balayı", "honeymoon",
    "Akdeniz kruvaziyeri", "MSC cruise", "Frankfurt iş seyahati", "konferans Berlin", "fuar Hannover", "Kenya safari", "Tanzanya kamp",
    "Interrail Avrupa", "İtalya yol gezisi", "karavan turu Norveç", "düğün için Bodrum", "maraton Berlin", "Formula 1 Monako", "Oktoberfest", "Hac",
    "Umre", "hafta sonu Bursa", "günübirlik Şile", "aile tatili Antalya", "bekarlığa veda Prag", "trekking Nepal", "Kilimanjaro tırmanışı",
    "yemek turu Napoli", "konser Londra", "Coachella", "Burning Man", "bisiklet turu Hollanda", "golf tatili Belek", "sörf kampı Portekiz",
  ];
  out.byPhrase = phrases.map((p) => {
    const ev = findEvent(p);
    const intent = ev ? { kind: ev.entry.kind, name: ev.entry.name[0], id: ev.entry.id } : null;
    return `${p} → ${playbookFor(intent as never, p)}${ev ? ` (tablo: ${ev.entry.id})` : ""}`;
  });
  // Aynı bağlam: 5 gece tek konaklama, uçuş Brüksel'e iner, ülke BE.
  const ctx = {
    intent: null, dates: { start: "2027-07-20", end: "2027-07-25" },
    stays: [{ kind: "stay" as const, date: "2027-07-20", end_date: "2027-07-25", time: null, from: null, to: null, city: "Boom", title: null, booked: false, note: null }],
    arrive: "Brüksel", road: false, code: "BE",
  };
  out.skeletons = Object.fromEntries(Object.entries(PLAYBOOKS).map(([k, p]) => [k, {
    cards: p.skeleton(ctx).map((c) => `${c.kind}${c.ref ? "#" + c.ref : ""}: ${c.title ?? "(adsız)"} @${c.city ?? c.to ?? "-"} ${c.date ?? ""}${c.end_date ? "→" + c.end_date : ""}`),
    blocked: { sections: p.blocked.sections ?? [], words: p.blocked.words ? String(p.blocked.words) : null, few: p.blocked.few ?? [] },
    prep: p.prep(), tip: p.tip(), questions: playbookQuestions(k as never),
  }]));
  // Model playbook: kabul edilen/reddedilen parçalar (bilinmeyen tür için yedek).
  const cruise = validModelPlaybook(plan({ label: "Akdeniz kruvaziyeri", stay_type: "boat", stay_port: "Barselona", cards: [
    { ref: "port", kind: "transfer", title: "Limana transfer", place: "Barselona", anchor: "arrive" },
    { ref: "exc", kind: "activity", title: "Kıyı turları", place: "", anchor: "stay" },
    { ref: "pkg", kind: "stay", title: "Kabin", place: "", anchor: "stay" },
    { ref: "fl", kind: "flight", title: "Uçuş", place: "", anchor: "arrive" },
    { ref: "drink", kind: "food", title: "İçecek paketi", place: "", anchor: "stay" },
  ] }));
  out.customCruise = cruise;
  const longPort = validModelPlaybook(plan({ label: "Galler köy evi", stay_type: "camp", stay_port: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch" }));
  out.customLongPort = longPort?.stayPort ?? null;
  out.customNoLabel = validModelPlaybook(plan({ label: "" }));
  // Yedekler: bilinmeyen tür ve model yoksa
  out.fallbackUnknownKind = playbookOf("custom" as never, null).kind;
  out.fallbackNull = playbookOf(null).kind;
  // Bir kayıt hangi bölüme düşer (kategori sabit mi)
  const k = (kind: string, title: string | null = null) => sectionOfItem(plannedItem({ kind: kind as never, date: null, end_date: null, time: null, from: null, to: null, city: "X", title, booked: false, note: null }, "t", "i", 1));
  out.sectionByKind = ["flight", "stay", "train", "bus", "ferry", "transfer", "car_rental", "rv_rental", "activity", "todo", "food", "esim", "insurance", "prep", "note", "other"].map((x) => `${x} → ${k(x)}`);
  out.sectionByTitle = [["activity", "Festival bileti"], ["activity", "Kayak pası"], ["activity", "Ekipman kiralama"], ["activity", "Dalış paketi"], ["activity", "Kabin + yemek + dalış paketi"], ["activity", "Vize başvurusu yap"], ["activity", "Yoga dersi"], ["todo", "Toplantı · Messe"], ["other", "Fatura"], ["activity", "Skipass"], ["activity", "Safari turu"]].map(([a, b]) => `${a} "${b}" → ${k(a, b)}`);
  out.blockedFestival = allowedSuggestions("festival", [
    { key: "a", section: "activity", kind: "add", title: "Dalış turu", why: "", source: "ai", createdAt: 1, state: "open" },
    { key: "b", section: "transport", kind: "add", title: "Festival shuttle", why: "", source: "ai", createdAt: 1, state: "open" },
    { key: "c", section: "todo", kind: "add", title: "Brüksel şehir turu", why: "", source: "ai", createdAt: 1, state: "open" },
  ] as never).map((s: { title: string }) => s.title);
  out.blockedWordsWellness = blockedWords("wellness");
  writeFileSync("out-g1.json", JSON.stringify(out, null, 1));
});
