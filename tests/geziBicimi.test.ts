// Gezi biçimi (v82 geçişi aşama 3b, spec §1.3–1.4, izlenebilirlik 88–118): the Plan reads a trip's shape, not its name. The
// eleven ready mixes (signal → intent list: category, word, name, frame, the state it starts in, what covers it, the short
// line), three trips the code has no name for made from the model's signals alone, the Dahil count (spec §1.3), the
// answers that open and close parts (`when`), a signal that doesn't hold dropped alone, the spine with no signal at all,
// a day out closing Konaklama, a connecting flight as one intent, and the ticket frame's view.
import { describe, expect, it } from "vitest";
import { categorize, type CatSection } from "../src/lib/categories";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang, withLang } from "../src/lib/i18n";
import { bookedShare, CHECKIN_HOURS, collectionsOf, countedStatus, planShare, type IntentInput, type IntentStatus } from "../src/lib/intents";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { SIGNAL_IDS, signalsOf, shapeOf, startPlaybook, validModelPlaybook, planSchema, type RawPlan } from "../src/lib/playbooks";
import { wouldMake } from "../src/lib/startCreate";
import {
  acceptExtraction, agreeRoute, applyAnswer, applyText, creationOf, isPlaceholder, isRouteDraft, looksLikePlace, mergeExtracted, newStart, nextQuestion, parseStartText, placeholderPrint, routeForGenerate, turnSystem, withTypedLang,
  type RawExtraction, type StartState,
} from "../src/lib/startTrip";
import { ruleSuggestions } from "../src/lib/suggestions";
import { buildTimeline } from "../src/lib/timeline";
import type { FlightSeen } from "../src/lib/flightData";
import type { Item, ItemPart, Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-18";
setLang("tr");

// --- the start, as the chat reads it (the code's reading and a given model reading; no AI call) ----------------------

const raw = (over: Partial<RawExtraction> & { plan?: RawPlan }): RawExtraction & { plan?: RawPlan } => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});
const plan = (over: Partial<RawPlan>): RawPlan => ({
  label: "", base: "classic", focus: "around", stay_type: "", stay_port: "", gateway: "", moving_base: false, per_day: "", info: [],
  cards: [], questions: [], blocked_sections: [], blocked_words: [], prep: [], tip: "", tone: "", avoid: "", musts: [], ...over,
});
const card = (over: Partial<RawPlan["cards"][number]> & { ref: string; kind: string; title: string }): RawPlan["cards"][number] => ({
  place: "", anchor: "stay", section: "", frame: "", word: "", pick: "", covers: [], by: "", ...over,
});
function typed(s: StartState, text: string, model: (Partial<RawExtraction> & { plan?: RawPlan }) | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(raw(model), TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}
const fresh = (mode: StartState["mode"] = "plan") => newStart(`s-${Math.random()}`, mode, 1, "tr");
const fromIst = (s: StartState) => applyAnswer(s, { q: "from", city: "İstanbul" }, 3);

/** The board as TripPanel builds it from the records the start makes (the start keeps them as places to fill). */
function board(trip: Trip, items: Item[], extra: Partial<IntentInput> = {}) {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, ...extra };
  const all = collectionsOf(input);
  return { input, plan, legs, timeline, sections, all, intents: all.flatMap((c) => c.intents) };
}

/** What "Oluştur" makes for a start, as a board: its records kept as places to fill, as the start's steps keep them. */
function made(s: StartState) {
  return withLang(s.lang, () => {
    const w = wouldMake(s, 1)!;
    const placeholders = Object.fromEntries(w.items.filter((i) => i.plannedKind !== "prep").map((i) => [i.id, placeholderPrint(i)]));
    const trip: Trip = { ...w.trip, startGuide: { ...w.trip.startGuide!, placeholders } };
    return { ...board(trip, w.items), trip, items: w.items };
  });
}

type Row = [section: string, word: string, name: string, frame: string, status: IntentStatus, by: string];
/** Each intent as the design's tile says it: its category, word, name, frame, state, what covers it. */
const rows = (b: { all: ReturnType<typeof collectionsOf> }): Row[] =>
  b.all.flatMap((c) => c.intents.map((i): Row => [c.section.id, i.head.word ?? i.head.kindWord ?? "", i.head.name, i.frame, i.status, i.cover?.by ?? ""]));
/** Each category's short line (kısa bilgi satırı), only where there is one. */
const infos = (b: { all: ReturnType<typeof collectionsOf> }) => Object.fromEntries(b.all.filter((c) => c.summary.info).map((c) => [c.section.id, c.summary.info!.text]));
const row = (b: { all: ReturnType<typeof collectionsOf> }, id: string) => b.all.find((c) => c.section.id === id)!.summary;

// --- the eleven ready mixes ----------------------------------------------------------------------------------------

describe("gezi biçimi: the eleven ready mixes, signal → intent list", () => {
  it("festival (Ozora): the camp the ticket includes, the bus from the nearest airport, the festival the focus", () => {
    const s = fromIst(typed(fresh(), "Temmuzda Ozora festivaline gidiyoruz, 2 kişi", {
      event: "Ozora Festival", event_kind: "event", event_place: "Ozora", event_country_code: "HU", destination_country: "Macaristan", event_start: "2027-07-27", event_end: "2027-08-02", start_date: "2027-07-27", duration_days: 7,
    }));
    expect(startPlaybook(s)).toBe("festival");
    const b = made(s);
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Budapeşte", "ticket", "searching", ""],
      ["flight", "", "Budapeşte → İstanbul", "ticket", "searching", ""],
      ["stay", "Kamp", "Ozora", "stay", "included", "festival biletiyle"],
      // The festival's route: a night in the gateway after it, and the way back there.
      ["stay", "", "Budapeşte", "stay", "searching", ""],
      ["transport", "Taksi · transfer", "Havalimanı → Kamp", "ticket", "searching", ""],
      ["transport", "Şehir değişimi", "Ozora → Budapeşte", "ticket", "searching", ""],
      ["transport", "Taksi · transfer", "Otel → Havalimanı", "ticket", "searching", ""],
      ["activity", "Festival", "Ozora", "collection", "searching", ""],
    ]);
    expect(infos(b)).toEqual({
      stay: "Festival gezisi: festival günlerinde konaklama bilete dahil kamp olarak kuruldu, otel aranmaz.",
      transport: "Ozora'da havalimanı yok; en yakını Budapeşte.",
      activity: "Odak festival: başka tur ve etkinlik önerilmez.",
    });
    // The camp opens the festival's ticket ("Festival biletini aç"), which is the Etkinlik row.
    const camp = b.intents.find((i) => i.section === "stay")!;
    expect(camp.cover).toMatchObject({ open: "Festival biletini aç", key: "activity:Ozora", status: "searching" });
    // The ticket the start opened is still to find (D3), never "1 planda".
    expect(b.intents.find((i) => i.section === "activity")!.wanted.map((o) => o.title)).toEqual(["Festival bileti"]);
  });

  it("dive (a liveaboard, the model's nearest): the boat holds the transfer and the dives; gear one choice", () => {
    const s = fromIst(typed(fresh(), "Kasımda Kızıldeniz'de bir haftalık liveaboard dalış, 2 kişiyiz", {
      destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8,
      plan: plan({ label: "Kızıldeniz liveaboard", base: "dive", focus: "only", stay_port: "Hurgada" }),
    }));
    expect(startPlaybook(s)).toBe("custom");
    const b = made(s);
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Hurgada", "ticket", "searching", ""],
      ["flight", "", "Hurgada → İstanbul", "ticket", "searching", ""],
      ["stay", "Tekne", "Hurgada", "stay", "searching", ""],
      ["transport", "Transfer", "Havalimanı → Otel", "ticket", "included", "tekne paketiyle"],
      ["transport", "Transfer", "Otel → Havalimanı", "ticket", "included", "tekne paketiyle"],
      ["activity", "Dalış", "Hurgada", "collection", "included", "tekne paketiyle"],
      ["todo", "Ekipman", "Dalış ekipmanı kiralama", "stay", "searching", ""],
      ["other", "Sigorta", "Dalış sigortası", "stay", "searching", ""],
    ]);
    expect(infos(b)).toEqual({ stay: "Dalış teknesi: konaklama, yemek ve dalışlar tekne paketinde; otel aranmaz." });
  });

  it("ski (Bansko): flown to Sofia, the pass, the gear and the school one choice each in Etkinlik", () => {
    const b = made(fromIst(typed(fresh(), "Ocakta Bansko'ya 5 gece kayak, 2 kişi", { destination: "Bansko", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Sofya", "ticket", "searching", ""],
      ["flight", "", "Sofya → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Bansko", "stay", "searching", ""],
      ["transport", "Taksi · transfer", "Havalimanı → Otel", "ticket", "searching", ""],
      ["transport", "Taksi · transfer", "Bansko → Sofya", "ticket", "searching", ""],
      ["activity", "Skipass", "Kayak pası", "stay", "searching", ""],
      ["activity", "Ekipman", "Ekipman kiralama", "stay", "searching", ""],
      ["activity", "Okul", "Kayak okulu", "stay", "searching", ""],
    ]);
    expect(infos(b)).toEqual({
      transport: "Bansko'da havalimanı yok; en yakını Sofya.",
      activity: "Kayak: skipass konaklama günleri boyunca; ekipman ve okul cevabına göre açılır.",
    });
  });

  it("wellness (Ubud): the programme one choice in Konaklama, the nights and the transfer Dahil with it", () => {
    const b = made(fromIst(typed(fresh(), "Martta Ubud'da 7 gece yoga retreat, tek başıma", { destination: "Ubud", destination_country: "Endonezya", destination_country_code: "ID", start_date: "2027-03-08", duration_days: 8 })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Denpasar", "ticket", "searching", ""],
      ["flight", "", "Denpasar → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Ubud", "stay", "included", "retreat programıyla"],
      ["stay", "Program", "Wellness programı", "stay", "searching", ""],
      ["transport", "Taksi · transfer", "Havalimanı → Otel", "ticket", "included", "retreat programıyla"],
      ["transport", "Taksi · transfer", "Ubud → Denpasar", "ticket", "included", "retreat programıyla"],
    ]);
    expect(infos(b)).toEqual({ stay: 'Retreat: program konaklamayı ve transferi kapsıyorsa onlar "Dahil" olur.' });
  });

  it("cruise (built in, D11): the nights in the cabin, the transfer to the port, the shore excursions", () => {
    const s = fromIst(typed(fresh(), "Ağustosta Barselona'dan 7 gece kruvaziyer, 2 kişi", { destination: "Barselona", destination_country: "İspanya", destination_country_code: "ES", start_date: "2027-08-07", duration_days: 8 }));
    expect(startPlaybook(s)).toBe("cruise");
    const b = made(s);
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Barselona", "ticket", "searching", ""],
      ["flight", "", "Barselona → İstanbul", "ticket", "searching", ""],
      ["stay", "Kabin", "Barselona", "stay", "searching", ""],
      ["transport", "Taksi · transfer", "Havalimanı → Otel", "ticket", "searching", ""],
      ["transport", "Taksi · transfer", "Otel → Havalimanı", "ticket", "searching", ""],
      ["activity", "Kıyı turu", "Barselona", "collection", "searching", ""],
    ]);
    expect(infos(b)).toEqual({ transport: "Kruvaziyer: limanlar arası yolculuk kabine dahil; yalnız limana transfer karar ister." });
    expect(b.items.find((i) => i.category === "stay")).toMatchObject({ name: "Kabin · Barselona", metrics: expect.objectContaining({ stayKind: "boat" }) });
  });

  it("road trip (built in, D11): the car, the driving permit; flown there in the plan's way", () => {
    const s = fromIst(typed(fresh(), "Mayısta İtalya'da 10 gece yol gezisi, 2 kişi", { destination: "Milano", destination_country: "İtalya", destination_country_code: "IT", start_date: "2027-05-01", duration_days: 11 }));
    expect(startPlaybook(s)).toBe("road");
    expect(rows(made(s))).toEqual([
      ["flight", "", "İstanbul → Milano", "ticket", "searching", ""],
      ["flight", "", "Milano → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Milano", "stay", "searching", ""],
      ["transport", "Araç", "Araç kiralama", "ticket", "searching", ""],
      ["other", "Belge", "Uluslararası ehliyet", "stay", "searching", ""],
    ]);
  });

  it("day out (by bus): Konaklama closed with why, no Uçuş at all, the bus there and back", () => {
    const s = fromIst(typed(fresh(), "Cumartesi günübirlik Şile'ye otobüsle, 2 kişi", { destination: "Şile", destination_country: "Türkiye", destination_country_code: "TR", start_date: "2026-10-24", duration_days: 1 }));
    const b = made(s);
    expect(b.trip.confirmedDates).toEqual({ start: "2026-10-24", end: "2026-10-24" });
    expect(rows(b)).toEqual([
      ["transport", "Otobüs", "İstanbul → Şile", "ticket", "searching", ""],
      ["transport", "Otobüs", "Şile → İstanbul", "ticket", "searching", ""],
    ]);
    expect(row(b, "stay")).toMatchObject({ closed: "aynı gün dönüş", info: { text: "Günübirlik: aynı gün dönüş, konaklama kapandı." } });
    // No flight on the trip, no Uçuş (omurga Tur 11b, Emre: "hiç uçak yoksa uçuş kategorisinin olması doğru değil").
    expect(b.all.some((c) => c.section.id === "flight")).toBe(false);
  });

  it("business (the model's nearest): the transfer, the fair, the meetings as ideas", () => {
    const b = made(fromIst(typed(fresh(), "Önümüzdeki hafta 3 gün Frankfurt'a fuar için, tek başıma", {
      destination: "Frankfurt", destination_country: "Almanya", destination_country_code: "DE", start_date: "2026-10-26", duration_days: 3, plan: plan({ label: "Frankfurt fuarı", base: "business" }),
    })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Frankfurt", "ticket", "searching", ""],
      ["flight", "", "Frankfurt → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Frankfurt", "stay", "searching", ""],
      ["transport", "Transfer", "Havalimanı → Otel", "ticket", "searching", ""],
      ["transport", "Transfer", "Otel → Havalimanı", "ticket", "searching", ""],
      ["activity", "Fuar", "Frankfurt", "collection", "searching", ""],
      ["todo", "Toplantı", "Frankfurt", "collection", "searching", ""],
    ]);
    expect(infos(b)).toEqual({});
  });

  it("safari (the model's nearest): a run camp to book (never alındı by itself), the drives in its package, the vaccination card", () => {
    const b = made(fromIst(typed(fresh(), "Şubatta Kenya'da 6 gece safari, kamp", {
      destination: "Masai Mara", destination_country: "Kenya", destination_country_code: "KE", start_date: "2027-02-10", duration_days: 7, plan: plan({ label: "Masai Mara safari", base: "safari", stay_port: "Masai Mara" }),
    })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Nairobi", "ticket", "searching", ""],
      ["flight", "", "Nairobi → İstanbul", "ticket", "searching", ""],
      ["stay", "Kamp", "Masai Mara", "stay", "searching", ""],
      ["transport", "Uçuş", "Havalimanı → Kamp", "ticket", "searching", ""],
      ["transport", "Uçuş", "Masai Mara → Nairobi", "ticket", "searching", ""],
      ["activity", "Safari", "Safari (game drive)", "stay", "included", "lodge paketiyle"],
      ["other", "Sağlık", "Sarıhumma aşı kartı", "stay", "searching", ""],
    ]);
    expect(infos(b)).toEqual({ stay: "Safari: işletilen kamp rezervasyon ister; kendiliğinden alındı sayılmaz." });
    // H4: the camp isn't set aside as nothing to book.
    expect(b.items.find((i) => i.category === "stay")?.noBooking).toBeUndefined();
  });

  it("honeymoon (Maldives): the seaplane in the resort's package", () => {
    const b = made(fromIst(typed(fresh(), "Haziranda Maldivler'de 7 gece balayı", { destination: "Maldivler", destination_country: "Maldivler", destination_country_code: "MV", start_date: "2027-06-10", duration_days: 8 })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Malé", "ticket", "searching", ""],
      ["flight", "", "Malé → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Maldivler", "stay", "searching", ""],
      ["transport", "Taksi · transfer", "Havalimanı → Otel", "ticket", "included", "resort paketiyle"],
      ["transport", "Taksi · transfer", "Maldivler → Malé", "ticket", "included", "resort paketiyle"],
      ["activity", "", "Maldivler", "collection", "searching", ""],
    ]);
    expect(infos(b)).toEqual({ transport: 'Resort transferi çoğu zaman pakette; onay sayfası söylerse "Dahil" olur.' });
  });

  it("classic (Japan): a booked Hakone Free Pass covers the boat on the lake, and Ulaşım says so", () => {
    const b = board(japan, [...japanItems()]);
    const transport = b.all.find((c) => c.section.id === "transport")!;
    expect(transport.intents.map((i) => [i.head.kindWord, i.head.name, i.status, i.cover?.by ?? ""])).toEqual([
      ["Tren", "Tokyo → Hakone", "booked", ""],
      ["Vapur", "Togendai → Moto-Hakone", "included", "Hakone Free Pass ile"],
      ["Şehir değişimi", "Hakone → Osaka", "searching", ""],
    ]);
    expect(transport.summary.info?.text).toBe("Hakone Free Pass alındığı için 1 yolculuk Dahil.");
    const boat = transport.intents[1];
    expect(boat.cover).toMatchObject({ open: "Pass'i aç", status: "booked", key: transport.intents[0].key });
    // The pass is booked, so the boat counts as booked too (spec §1.3); nothing else in the trip has a line.
    expect(countedStatus(boat)).toBe("booked");
    expect(b.all.filter((c) => c.summary.info).map((c) => c.section.id)).toEqual(["transport"]);
  });

  it("D3: nothing a mix opens starts booked or arranged; no category says alındı", () => {
    const starts = [
      fromIst(typed(fresh(), "Ocakta Bansko'ya 5 gece kayak, 2 kişi", { destination: "Bansko", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 })),
      fromIst(typed(fresh(), "Martta Ubud'da 7 gece yoga retreat, tek başıma", { destination: "Ubud", destination_country: "Endonezya", destination_country_code: "ID", start_date: "2027-03-08", duration_days: 8 })),
      fromIst(typed(fresh(), "Ağustosta Barselona'dan 7 gece kruvaziyer, 2 kişi", { destination: "Barselona", destination_country: "İspanya", destination_country_code: "ES", start_date: "2027-08-07", duration_days: 8 })),
      fromIst(typed(fresh(), "Şubatta Kenya'da 6 gece safari, kamp", { destination: "Masai Mara", destination_country: "Kenya", destination_country_code: "KE", start_date: "2027-02-10", duration_days: 7, plan: plan({ label: "Masai Mara safari", base: "safari", stay_port: "Masai Mara" }) })),
      fromIst(typed(fresh(), "Kasımda Kızıldeniz'de bir haftalık liveaboard dalış", { destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8, plan: plan({ label: "Kızıldeniz liveaboard", base: "dive", stay_port: "Hurgada" }) })),
    ];
    for (const s of starts) {
      const b = made(s);
      expect(b.intents.filter((i) => i.status === "booked" || i.status === "arranged" || i.status === "chosen")).toEqual([]);
      expect(b.all.map((c) => c.summary.countsText).join(" ")).not.toMatch(/alındı|seçildi|planda/);
      // The old cards' headers too (categories.ts): a transfer the start made is to find, not "✓ alındı" (H2).
      expect(b.sections.map((x: CatSection) => x.status?.text ?? "").join(" ")).not.toMatch(/alındı/);
    }
  });

  it("H1: what a kind opens goes in its part's category and is never done by its day", () => {
    const b = made(fromIst(typed(fresh(), "Ocakta Bansko'ya 5 gece kayak, 2 kişi", { destination: "Bansko", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 })));
    const activity = b.sections.find((x) => x.id === "activity")!;
    expect(activity.entries.map((e) => [e.row.name, e.state])).toEqual([
      ["Kayak pası", "empty"],
      ["Ekipman kiralama", "empty"],
      ["Kayak okulu", "empty"],
    ]);
    expect(b.sections.find((x) => x.id === "todo")!.entries).toEqual([]);
  });
});

// --- trips the code has no name for -------------------------------------------------------------------------------

describe("adı tanınmayan geziler: made from the model's signals alone", () => {
  it("Kapadokya: a balloon flight one choice, the ride to the field Dahil with it, flown to Kayseri", () => {
    const b = made(fromIst(typed(fresh(), "Mayısta Kapadokya'da 2 gece balon turu, 2 kişi", {
      destination: "Göreme", destination_country: "Türkiye", destination_country_code: "TR", start_date: "2027-05-10", duration_days: 3,
      plan: plan({
        label: "Kapadokya balon gezisi",
        cards: [
          card({ ref: "balloon", kind: "activity", title: "Balon turu", section: "activity", frame: "stay", word: "Balon", pick: "single", covers: ["shuttle"] }),
          card({ ref: "shuttle", kind: "transfer", title: "Otel → kalkış alanı", section: "transport", frame: "ticket", word: "Transfer", by: "balloon" }),
        ],
      }),
    })));
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Kayseri", "ticket", "searching", ""],
      ["flight", "", "Kayseri → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Göreme", "stay", "searching", ""],
      ["transport", "Transfer", "Havalimanı → Otel", "ticket", "included", "Balon turu ile"],
      ["transport", "Transfer", "Göreme → Kayseri", "ticket", "included", "Balon turu ile"],
      ["activity", "Balon", "Balon turu", "stay", "searching", ""],
    ]);
  });

  it("Berlin maratonu: the race a ticket to find, the bib an idea in Yapılacaklar; no tours (one experience)", () => {
    const s = fromIst(typed(fresh(), "Eylülde Berlin maratonu koşacağım, 3 gece, tek başıma", {
      destination: "Berlin", destination_country: "Almanya", destination_country_code: "DE", start_date: "2027-09-24", duration_days: 4,
      plan: plan({
        label: "Berlin maratonu", focus: "only", info: [{ section: "activity", text: "Odak yarış: başka tur önerilmez." }],
        cards: [
          card({ ref: "race", kind: "activity", title: "Maraton kaydı", section: "activity", frame: "collection", word: "Yarış", pick: "multi" }),
          card({ ref: "bib", kind: "todo", title: "Göğüs numarası alma · fuar", section: "todo", frame: "collection", word: "Numara" }),
        ],
      }),
    }));
    const b = made(s);
    expect(rows(b)).toEqual([
      ["flight", "", "İstanbul → Berlin", "ticket", "searching", ""],
      ["flight", "", "Berlin → İstanbul", "ticket", "searching", ""],
      ["stay", "", "Berlin", "stay", "searching", ""],
      ["activity", "Yarış", "Berlin", "collection", "searching", ""],
      ["todo", "Numara", "Berlin", "collection", "searching", ""],
    ]);
    expect(infos(b)).toEqual({ activity: "Odak yarış: başka tur önerilmez." });
  });

  it("Interrail: the pass covers the trains between the cities over its days (D10), and Ulaşım says so", () => {
    let s = fromIst(typed(fresh(), "Temmuzda bir hafta Interrail, Viyana'dan Berlin'e", {
      destination: "Viyana", destination_country: "Avusturya", destination_country_code: "AT", start_date: "2027-07-01", duration_days: 8,
      plan: plan({ label: "Interrail", moving_base: true, cards: [card({ ref: "pass", kind: "train", title: "Interrail Global Pass · 15 gün", section: "transport", frame: "ticket", word: "Pass", covers: ["legs"] })] }),
    }));
    s = { ...s, route: { stops: [{ city: "Viyana", code: "AT", nights: 2 }, { city: "Prag", code: "CZ", nights: 3 }, { city: "Berlin", code: "DE", nights: 2 }], arrive: "Viyana", leave: "Berlin", confirmed: true, source: "user" } };
    const b = made(s);
    expect(rows(b).filter((r) => r[0] === "transport")).toEqual([
      ["transport", "Pass", "Interrail Global Pass · 15 gün", "ticket", "searching", ""],
      ["transport", "Şehir değişimi", "Viyana → Prag", "ticket", "included", "Interrail Global Pass ile"],
      ["transport", "Şehir değişimi", "Prag → Berlin", "ticket", "included", "Interrail Global Pass ile"],
    ]);
    expect(row(b, "transport")).toMatchObject({ countsText: "1 karar · 2 dahil", info: { text: "Interrail Global Pass kapsıyor: 2 yolculuk Dahil.", signal: "pass" } });
    expect(signalsOf(b.trip, b.items.map((i) => i.part).filter((p): p is ItemPart => Boolean(p))).find((x) => x.id === "pass")?.value).toBe("pass");
  });
});

// --- the Dahil count (spec §1.3, izlenebilirlik 100) ----------------------------------------------------------------

describe("Dahil sayımı: a Dahil box counts as what covers it", () => {
  const trip: Trip = {
    id: "oz", title: "Ozora", confirmedDates: { start: "2027-07-26", end: "2027-08-02" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
    travellers: { names: [], count: 2 }, intent: { playbook: "festival", name: "Ozora Festival" },
  };
  const camp = makeItem({
    id: "camp", name: "Çadır kampı · festival alanı", category: "stay", city: "Ozora", needKey: "stay:ozora", status: "chosen", origin: "chat", noBooking: 1,
    dates: { start: "2027-07-27", end: "2027-08-02", source: "unverified" }, metrics: { ...EMPTY_METRICS, stayKind: "camp" }, part: { ref: "stay", section: "stay", frame: "stay", word: "Kamp", by: "ticket" },
  });
  const night = makeItem({ id: "bud", name: "Hotel Moments", category: "stay", city: "Budapeşte", needKey: "stay:budapeşte", status: "saved", dates: { start: "2027-07-26", end: "2027-07-27", source: "url" }, price: { amount: 140, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });
  const ticket = (status: Item["status"]) =>
    makeItem({
      id: "ticket", name: "Festival bileti", category: "activity", city: "Ozora", needKey: "activity:festival", status, origin: "chat",
      dates: { start: "2027-07-27", end: "2027-08-02", source: "unverified" }, part: { ref: "ticket", section: "activity", frame: "collection", word: "Festival", pick: "multi", covers: ["stay:event"] },
    });
  const of = (b: ReturnType<typeof board>) => ({
    camp: b.intents.find((i) => i.itemIds.includes("camp"))!,
    stay: b.all.find((c) => c.section.id === "stay")!.summary,
  });

  it("the ticket bought: the camp is alındı in both shares and in Konaklama's bar", () => {
    const b = board(trip, [camp, night, ticket("booked")]);
    const { camp: box, stay } = of(b);
    expect(box).toMatchObject({ status: "included", word: "Dahil", cover: { by: "festival biletiyle", status: "booked", open: "Festival biletini aç" } });
    expect(stay).toMatchObject({ countsText: "1 alındı · 1 karar", bar: { booked: 50, chosen: 0 }, counts: { booked: 1, included: 1 } });
    const flights = b.intents.filter((i) => i.section === "flight");
    // Ticket + camp alındı; the hotel night and two flights wait.
    expect(planShare(b.intents)).toEqual({ count: 2, total: 2 + flights.length + b.intents.filter((i) => i.section === "transport").length + 1, pct: expect.any(Number) });
    expect(bookedShare(b.intents).count).toBe(2);
  });

  it("the ticket chosen: the camp is on the plan, not bought", () => {
    const b = board(trip, [camp, night, ticket("chosen")]);
    const { camp: box, stay } = of(b);
    expect(box.cover?.status).toBe("chosen");
    expect(countedStatus(box)).toBe("chosen");
    expect(stay).toMatchObject({ countsText: "1 seçildi · 1 karar", bar: { booked: 0, chosen: 50 } });
    expect(planShare([box]).count).toBe(1);
    expect(bookedShare([box]).count).toBe(0);
  });

  it("the ticket still to find: the camp is neither on the plan nor a decision, but still one of the needs", () => {
    const placeholders = { ticket: placeholderPrint(ticket("chosen")) };
    const b = board({ ...trip, startGuide: { createdAt: 1, placeholders } }, [camp, night, ticket("chosen")]);
    const { camp: box, stay } = of(b);
    expect(box.cover?.status).toBe("searching");
    expect(countedStatus(box)).toBeNull();
    expect(stay).toMatchObject({ countsText: "1 karar · 1 dahil", bar: { booked: 0, chosen: 0 }, counts: { decide: 1, included: 1 } });
    expect(planShare([box])).toEqual({ count: 0, total: 1, pct: 0 });
  });

  it("the hero, the strip and the category bar read the same counts", () => {
    const b = board(trip, [camp, night, ticket("booked")]);
    const bars = b.all.filter((c) => c.section.id !== "prep");
    const booked = bars.reduce((n, c) => n + c.summary.counts.booked + c.summary.counts.arranged, 0);
    expect(booked).toBe(bookedShare(b.intents).count);
  });
});

// --- the answers that open and close parts (`when`) ------------------------------------------------------------------

describe("when: a kind's answers open and close its parts", () => {
  const ski = () => fromIst(typed(fresh(), "Ocakta Bansko'ya 5 gece kayak, 2 kişi", { destination: "Bansko", destination_country: "Bulgaristan", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 }));
  it("ski: an advanced skier has no school, their own gear no rental", () => {
    let s = applyAnswer(ski(), { q: "pb", key: "ski:level", value: "advanced" }, 4);
    s = applyAnswer(s, { q: "pb", key: "ski:gear", value: "own" }, 5);
    expect(rows(made(s)).filter((r) => r[0] === "activity").map((r) => r[1])).toEqual(["Skipass"]);
  });
  const ozora = () => fromIst(typed(fresh(), "Temmuzda Ozora festivaline gidiyoruz, 2 kişi", {
    event: "Ozora Festival", event_kind: "event", event_place: "Ozora", event_country_code: "HU", destination_country: "Macaristan", event_start: "2027-07-27", event_end: "2027-08-02", start_date: "2027-07-27", duration_days: 7,
  }));
  it("festival: a hotel answer leaves a hotel to find (no camp, no Dahil); the ticket said bought makes the camp alındı", () => {
    const hotel = made(applyAnswer(ozora(), { q: "pb", key: "festival:stay", value: "hotel" }, 4));
    expect(rows(hotel).filter((r) => r[0] === "stay")).toEqual([
      ["stay", "", "Ozora", "stay", "searching", ""],
      ["stay", "", "Budapeşte", "stay", "searching", ""],
    ]);
    expect(infos(hotel).stay).toBeUndefined();
    const bought = made(applyAnswer(ozora(), { q: "pb", key: "festival:ticket", value: "have" }, 4));
    const camp = bought.intents.find((i) => i.section === "stay")!;
    expect(camp).toMatchObject({ status: "included", cover: { status: "booked" } });
    expect(countedStatus(camp)).toBe("booked");
  });
  it("dive: their own gear closes the gear box", () => {
    let s = fromIst(typed(fresh(), "Kasımda Kızıldeniz'de liveaboard", { destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8, plan: plan({ label: "Kızıldeniz liveaboard", base: "dive", stay_port: "Hurgada" }) }));
    s = applyAnswer(s, { q: "pb", key: "custom:gear", value: "own" }, 4);
    expect(rows(made(s)).some((r) => r[1] === "Ekipman")).toBe(false);
  });
});

// --- a signal that doesn't hold is dropped alone ---------------------------------------------------------------------

describe("the model's signals, checked piece by piece", () => {
  const p = validModelPlaybook(plan({
    label: "Karışık bir gezi", base: "yurt", stay_type: "igloo", stay_port: "Hurgada", gateway: "Kızıldeniz", per_day: "nope",
    info: [{ section: "spa", text: "Olmaz" }, { section: "stay", text: "Konaklama tekne paketinde." }, { section: "stay", text: "İkinci satır" }],
    cards: [
      card({ ref: "pass", kind: "activity", title: "Kayak pası", section: "flight", frame: "ticket", word: "Skipass", pick: "single" }),
      card({ ref: "ride", kind: "transfer", title: "Limana transfer", section: "activity", frame: "stay", by: "ghost" }),
      card({ ref: "esim", kind: "esim", title: "eSIM", section: "transport", frame: "collection" }),
      card({ ref: "pkg", kind: "activity", title: "Paket", section: "activity", frame: "collection", pick: "many", covers: ["ghost", "stay", "ride", "pkg"] }),
      card({ ref: "stay2", kind: "stay", title: "Otel" }),
    ],
  }))!;
  it("keeps the card, drops what of it doesn't hold; unknown kinds and signals fall back to the mix", () => {
    expect(p).toMatchObject({ base: "classic", stayType: "hotel", stayPort: null });
    expect(p.gateway).toBeUndefined();
    expect(p.perDay).toBeUndefined();
    expect(p.info).toEqual({ stay: "Konaklama tekne paketinde." });
    expect(p.cards).toEqual([
      { ref: "pass", kind: "activity", title: "Kayak pası", place: null, anchor: "stay", word: "Skipass", pick: "single" },
      { ref: "ride", kind: "transfer", title: "Limana transfer", place: null, anchor: "stay" },
      { ref: "esim", kind: "esim", title: "eSIM", place: null, anchor: "stay" },
      { ref: "pkg", kind: "activity", title: "Paket", place: null, anchor: "stay", section: "activity", frame: "collection", covers: ["stay", "ride"] },
    ]);
  });
  it("a start the model says is never kept: what it opens starts to find (D3)", () => {
    const said = plan({ label: "Balon gezisi", cards: [{ ...card({ ref: "balloon", kind: "activity", title: "Balon turu", section: "activity", frame: "stay", pick: "single" }), start: "booked" } as RawPlan["cards"][number]] });
    const kept = validModelPlaybook(said)!;
    expect(Object.keys(kept.cards[0])).not.toContain("start");
    const s = fromIst(typed(fresh(), "Mayısta Göreme'de 2 gece", { destination: "Göreme", destination_country: "Türkiye", destination_country_code: "TR", start_date: "2027-05-10", duration_days: 3, plan: said }));
    expect(rows(made(s)).find((r) => r[2] === "Balon turu")?.[4]).toBe("searching");
  });
  it("the trip still opens", () => {
    const s = fromIst(typed(fresh(), "Kasımda Hurgada'ya 5 gece", { destination: "Hurgada", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 6 }));
    const b = made({ ...s, playbook: p });
    expect(b.intents.length).toBeGreaterThan(0);
  });
  it("the model's base and fields are asked for in the prompt, and the schema keeps inside the strict limits", () => {
    const system = withLang("tr", () => turnSystem());
    for (const word of ["gateway", "moving_base", "per_day", "info", "section", "frame", "covers", "by", "cabin", "none", "dive", "safari"]) expect(system).toContain(word);
    const shape = planSchema.shape;
    expect(Object.keys(shape)).toEqual(expect.arrayContaining(["gateway", "moving_base", "per_day", "info"]));
  });
});

// --- no signal at all -----------------------------------------------------------------------------------------------

describe("no signal: only what is certain is made", () => {
  it("the flights, a stay per run of nights, the papers the rules ask for", () => {
    let s = typed(fresh(), "10 Mayıs'tan 5 gece Roma, 2 kişi");
    s = fromIst(s);
    expect(startPlaybook(s)).toBe("classic");
    const b = made(s);
    const rules = ruleSuggestions({ trip: b.trip, plan: b.plan, items: b.items, timeline: b.timeline, legs: b.legs, mains: [], home: "TR", today: TODAY });
    const bySection: Partial<Record<Suggestion["section"], Suggestion[]>> = {};
    for (const r of rules) (bySection[r.section] ??= []).push(r);
    const withRules = board(b.trip, b.items, { suggestions: bySection });
    expect(rows(withRules).map((r) => [r[0], r[3], r[4]])).toEqual([
      ["flight", "ticket", "searching"],
      ["flight", "ticket", "searching"],
      ["stay", "stay", "searching"],
      ...rows(withRules).filter((r) => r[0] === "transport").map((r) => [r[0], r[3], r[4]]),
      ["other", "stay", "searching"],
      ["other", "stay", "searching"],
    ]);
    expect(rows(withRules).filter((r) => r[0] === "other").map((r) => r[2])).toEqual(expect.arrayContaining([expect.stringMatching(/eSIM/), expect.stringMatching(/sigorta/i)]));
    expect(infos(withRules)).toEqual({});
    expect(b.items.every((i) => !i.part)).toBe(true);
  });
});

// --- the start's reading of the time and the way (H13), long names (H10) -------------------------------------------

describe("H13 and H10: the way there, a day out, a long name", () => {
  it("reads 'otobüsle' and 'günübirlik'", () => {
    expect(parseStartText("Bu hafta sonu Bursa'ya otobüsle, 2 kişi", TODAY)).toMatchObject({ way: "bus" });
    expect(parseStartText("Cumartesi günübirlik Şile", TODAY)).toMatchObject({ dayTrip: true, duration: { unit: "day", n: 1 } });
    expect(parseStartText("Otobüs bileti ne kadar?", TODAY).way).toBeUndefined();
    expect(parseStartText("Weekend in Bath by train", TODAY).way).toBe("train");
    // D15: a season said alone is a rough start ("~").
    expect(parseStartText("Yazın bir ara Portekiz'e gitmek istiyoruz", TODAY).start).toEqual({ date: "2027-07-01", approx: true });
    expect(parseStartText("In the summer to Rome", TODAY).start).toEqual({ date: "2027-07-01", approx: true });
  });
  it("by bus: no flight made, the buses there and back, no Uçuş", () => {
    const s = fromIst(typed(fresh(), "Bu hafta sonu Bursa'ya otobüsle, 2 kişi", { destination: "Bursa", destination_country: "Türkiye", destination_country_code: "TR" }));
    const c = creationOf(s)!;
    expect(c.travel.map((x) => [x.kind, x.from, x.to])).toEqual([["bus", "İstanbul", "Bursa"], ["bus", "Bursa", "İstanbul"]]);
    const b = made(s);
    expect(b.trip.startGuide?.way).toBe("bus");
    expect(b.all.some((c) => c.section.id === "flight")).toBe(false);
    expect(b.intents.some((i) => i.section === "flight" && i.status !== "skipped")).toBe(false);
  });
  it("H10: a 58-letter name read by the model is a place", () => {
    const name = "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch";
    expect(looksLikePlace(name)).toBe(true);
    const e = acceptExtraction(raw({ destination: name, destination_country: "Birleşik Krallık", destination_country_code: "GB" }), TODAY);
    expect(e.where?.place.toLocaleLowerCase("tr")).toBe(name.toLocaleLowerCase("tr"));
  });
});

// --- D5: the AI's route nobody agreed ------------------------------------------------------------------------------

describe("D5: a route only proposed is built as Önerimiz", () => {
  const lanka = () => fromIst(typed(fresh(), "Sabine ile 20 Kasım'dan 2 hafta Sri Lanka"));
  const generated = (s: StartState) => ({ ...s, route: routeForGenerate(s) });
  const status = (b: ReturnType<typeof made>, section: string) => b.intents.filter((i) => i.section === section).map((i) => [i.head.name, i.status, i.routeDraft ?? false]);

  it("Oluştur with the circuit on screen: its cities' stays, the flights and the ways between are Önerimiz with nothing chosen", () => {
    const s = generated(lanka());
    expect(s.route).toMatchObject({ source: "circuit", confirmed: true, proposed: true });
    const b = made(s);
    expect(isRouteDraft(b.trip)).toBe(true);
    expect(status(b, "stay")).toEqual([
      ["Sigiriya", "suggested", true],
      ["Kandy", "suggested", true],
      ["Ella", "suggested", true],
      ["Mirissa", "suggested", true],
    ]);
    expect(status(b, "flight").map((r) => r.slice(1))).toEqual([["suggested", true], ["suggested", true]]);
    const ways = b.intents.filter((i) => i.section === "transport");
    expect(ways.length).toBeGreaterThan(0);
    expect(ways.every((i) => i.status === "suggested" && i.routeDraft)).toBe(true);
    for (const i of b.intents.filter((x) => x.routeDraft)) {
      expect(i.chosen).toBeNull();
      expect(i.word).toBe("Önerimiz");
      expect(i.note).toBe("Rota AI'ın önerisi; onaylayınca kesinleşir");
    }
    // Still looked for the same way: a change of city keeps its ways to pick (C15).
    expect(ways.some((i) => i.modes.length > 0)).toBe(true);
    // The rest of the trip isn't the route's: the eSIM, the insurance… stay as they are.
    expect(b.intents.filter((i) => !["flight", "stay", "transport"].includes(i.section)).some((i) => i.routeDraft)).toBe(false);
  });

  it("Rotayı onayla: the same boxes, to find", () => {
    const b = made(generated(lanka()));
    const agreed = agreeRoute(b.trip);
    expect(isRouteDraft(agreed)).toBe(false);
    expect(agreed.startGuide?.placeholders).toEqual(b.trip.startGuide?.placeholders);
    const after = board(agreed, b.items);
    expect(after.intents.filter((i) => i.section === "stay").map((i) => [i.head.name, i.status])).toEqual([
      ["Sigiriya", "searching"],
      ["Kandy", "searching"],
      ["Ella", "searching"],
      ["Mirissa", "searching"],
    ]);
    expect(after.intents.some((i) => i.routeDraft)).toBe(false);
  });

  it("a route the traveller agreed, one stop, or a stay with an option of its own is not a proposal", () => {
    const s = lanka();
    const agreed = withLang("tr", () => applyAnswer(s, { q: "route", action: "accept" }, 3));
    expect(routeForGenerate(agreed)?.proposed).toBeUndefined();
    expect(isRouteDraft(made(generated(agreed)).trip)).toBe(false);
    const single = withLang("tr", () => applyAnswer(s, { q: "route", action: "single" }, 3));
    expect(routeForGenerate(single)?.proposed).toBeUndefined();
    const b = made(generated(s));
    const kandy = b.items.find((i) => i.category === "stay" && i.city === "Kandy")!;
    const hotel = makeItem({ id: "kandy-hotel", tripId: b.trip.id, category: "stay", name: "Kandy Hills", city: "Kandy", status: "saved", dates: { ...kandy.dates } });
    const withHotel = board(b.trip, [...b.items, hotel]);
    const box = withHotel.intents.find((i) => i.itemIds.includes("kandy-hotel"))!;
    expect(box.status).toBe("deciding");
    expect(box.routeDraft).toBeUndefined();
  });
});

// --- H7 (D6): a stay is a stretch of nights ------------------------------------------------------------------------

describe("H7: open nights in different cities never merge; two hotels in one city are two stays", () => {
  const trip: Trip = { id: "h7", title: "Japonya", confirmedDates: { start: "2027-04-05", end: "2027-04-16" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  const st = (id: string, name: string, city: string, start: string, end: string, status: Item["status"] = "saved") =>
    makeItem({ id, tripId: "h7", name, category: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "page" }, status });
  const stays = (b: ReturnType<typeof board>) => b.intents.filter((i) => i.section === "stay").map((i) => [i.head.name, i.status, i.head.nights]);

  it("22b: Kyoto's option for the 5th to the 9th, Osaka's for the 12th to the 16th: Kyoto, the nights between, Osaka", () => {
    const b = board(trip, [st("gion", "Gion", "Kyoto", "2027-04-05", "2027-04-09"), st("swiss", "Swiss", "Osaka", "2027-04-12", "2027-04-16")]);
    expect(b.plan.stayBlocks.map((x) => [x.kind, x.city, x.range.start, x.range.end])).toEqual([
      ["open", "Kyoto", "2027-04-05", "2027-04-09"],
      ["open", null, "2027-04-09", "2027-04-12"],
      ["open", "Osaka", "2027-04-12", "2027-04-16"],
    ]);
    const [kyoto, between, osaka] = b.intents.filter((i) => i.section === "stay");
    expect([kyoto.status, kyoto.itemIds, kyoto.head.nights]).toEqual(["deciding", ["gion"], 4]);
    expect([between.status, between.itemIds, between.head.nights]).toEqual(["searching", [], 3]);
    expect([osaka.status, osaka.itemIds, osaka.head.nights]).toEqual(["deciding", ["swiss"], 4]);
  });

  it("the nights an option leaves in its own city stay with it; a choice's uncovered nights are a stay of their own", () => {
    const one = board(trip, [st("gion", "Gion", "Kyoto", "2027-04-05", "2027-04-09")]);
    expect(one.plan.stayBlocks.map((x) => [x.kind, x.range.start, x.range.end])).toEqual([["open", "2027-04-05", "2027-04-16"]]);
    const chosen = board(trip, [st("gion", "Gion", "Kyoto", "2027-04-05", "2027-04-09", "chosen")]);
    expect(stays(chosen).map((r) => r.slice(1))).toEqual([["chosen", 4], ["searching", 7]]);
  });

  it("two hotels in Kyoto, one after the other: two stays", () => {
    const b = board(trip, [st("gion", "Gion", "Kyoto", "2027-04-05", "2027-04-09", "chosen"), st("ryokan", "Ryokan", "Kyoto", "2027-04-09", "2027-04-12", "chosen"), st("swiss", "Swiss", "Osaka", "2027-04-12", "2027-04-16")]);
    expect(stays(b).map((r) => r.slice(1))).toEqual([["chosen", 4], ["chosen", 3], ["deciding", 4]]);
  });
});

// --- the road mode (H5) and a connecting flight (D7) ----------------------------------------------------------------

describe("H5: a road trip's car covers the drives; how one gets there is its own (omurga Tur 11b)", () => {
  const italy = (way?: StartState["way"]) => {
    let s = applyAnswer(fresh("road"), { q: "where", place: "İtalya", country: "İtalya", code: "IT" }, 2);
    s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 4 } }, 2);
    s = applyAnswer(s, { q: "start", date: "2027-05-01", approx: false }, 2);
    s = fromIst(s);
    return { ...s, ...(way ? { way } : {}), route: { stops: ["Milano", "Verona", "Bologna", "Floransa"].map((city) => ({ city, nights: 1, code: "IT" })), arrive: null, leave: null, confirmed: true, source: "user" as const } };
  };

  it("flown to: the flights in and out, the car where one lands, the drives Dahil with it", () => {
    const b = made(italy());
    expect(rows(b).filter((r) => r[0] === "flight")).toHaveLength(2);
    expect(rows(b).filter((r) => r[0] === "transport")).toEqual([
      ["transport", "Araç", "Araç kiralama · Milano", "ticket", "searching", ""],
      ["transport", "Şehir değişimi", "Milano → Verona", "ticket", "included", "kiralık araçla"],
      ["transport", "Şehir değişimi", "Verona → Bologna", "ticket", "included", "kiralık araçla"],
      ["transport", "Şehir değişimi", "Bologna → Floransa", "ticket", "included", "kiralık araçla"],
    ]);
  });

  it("driven from home in one's own car: no flight, no Uçuş, no car to rent", () => {
    const b = made(italy("car"));
    expect(b.all.some((c) => c.section.id === "flight")).toBe(false);
    expect(rows(b).some((r) => r[2].startsWith("Araç kiralama"))).toBe(false);
  });
});

const japan: Trip = { id: "jp", title: "Japonya", confirmedDates: { start: "2027-04-01", end: "2027-04-08" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, travellers: { names: [], count: 2 } };
const eur = (amount: number | null): Item["price"] => ({ amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
const fly = (id: string, from: string, to: string, dep: string, arr: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id, name: `${from}-${to}`, category: "flight", needKey: `flight:${to}`.toLowerCase(), city: to, status, dates: { start: dep.slice(0, 10), end: null, source: "page" }, guests: two, price: eur(800),
    flight: { from, to, departure: dep, arrival: arr, carrier: "Qatar Airways", flightNumber: `QR${id.length}`, stops: 0 }, ...over,
  });
const sleep = (id: string, city: string, start: string, end: string, status: Item["status"]) =>
  makeItem({ id, name: `Otel ${city}`, category: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(600), status });
const ride = (id: string, name: string, kind: Item["plannedKind"], from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id, name, category: "transport", plannedKind: kind, needKey: `transport:${from}-${to}`.toLowerCase(), city: to, status, guests: two, price: eur(100), dates: { start: day, end: null, source: "page" },
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T11:00`, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
function japanItems(): Item[] {
  return [
    sleep("tokyo", "Tokyo", "2027-04-01", "2027-04-04", "booked"),
    sleep("hakone", "Hakone", "2027-04-04", "2027-04-07", "booked"),
    sleep("osaka", "Osaka", "2027-04-07", "2027-04-08", "chosen"),
    ride("pass", "Hakone Free Pass", "train", "Odawara", "Hakone", "2027-04-04", "booked", { city: "Hakone", provider: "Odakyu", dates: { start: "2027-04-04", end: "2027-04-06", source: "page" }, price: eur(76) }),
    ride("boat", "Ashi Gölü vapuru", "ferry", "Togendai", "Moto-Hakone", "2027-04-05", "chosen", { city: "Hakone", price: eur(null), origin: "chat" }),
  ];
}

describe("D7: a connecting flight is one intent with two stubs", () => {
  it("İstanbul → Doha → Tokyo saved as two flights: one box, two legs, one aktarma, the whole way's length", () => {
    const items = [
      fly("ab", "IST", "DOH", "2027-04-01T01:55", "2027-04-01T06:00", "booked", { bookingRef: "QX7K2L", metrics: { ...EMPTY_METRICS, durationMinutes: 245 } }),
      fly("bcd", "DOH", "HND", "2027-04-01T08:00", "2027-04-01T23:30", "booked", { bookingRef: "QX7K2L", metrics: { ...EMPTY_METRICS, durationMinutes: 570 } }),
      ...japanItems(),
    ];
    const b = board(japan, items);
    const flights = b.all.find((c) => c.section.id === "flight")!;
    expect(flights.intents.map((i) => [i.head.name, i.status, i.itemIds.length])).toEqual([
      ["İstanbul → Tokyo", "booked", 2],
      ["Osaka → İstanbul", "searching", 0],
    ]);
    const out = flights.intents[0];
    // 4 sa 5 dk to Doha, 2 hours there, 9 sa 30 dk to Tokyo (each end's clock is its own: never one on the other).
    expect(out.ticket).toMatchObject({ mode: "flight", art: "ucus", stops: { text: "1 aktarma", direct: false }, duration: "15 sa 35 dk" });
    // Each stub: the airport's code small, its city big where the table knows it (Doha), else the code.
    expect(out.ticket!.legs.map((l) => [l.from?.place ?? l.from?.city, l.to?.city])).toEqual([["IST", "Doha"], ["DOH", "Tokyo"]]);
    expect(flights.summary.countsText).toBe("1 alındı · 1 karar");
    expect(out.head.parts[0]).toBe("IST → HND");
  });
  it("the way out and the way home are two", () => {
    const items = [fly("out", "IST", "HND", "2027-04-01T01:55", "2027-04-01T19:25", "booked"), fly("home", "KIX", "IST", "2027-04-08T11:00", "2027-04-08T17:40", "booked"), ...japanItems()];
    expect(board(japan, items).all.find((c) => c.section.id === "flight")!.intents).toHaveLength(2);
  });
});

// --- the ticket frame ----------------------------------------------------------------------------------------------

describe("the ticket frame (bilet ailesi)", () => {
  const train = ride("nozomi", "Shinkansen Nozomi · Tokyo → Kyoto", "train", "Tokyo", "Kyoto", "2027-04-04", "booked", { provider: "JR", statusNote: "Vagon 8 · koltuk 4D, 4E · peron 14", bookingRef: "JR-30871" });
  const kyoto: Trip = { ...japan, confirmedDates: { start: "2027-04-01", end: "2027-04-07" } };
  const stays = [sleep("t", "Tokyo", "2027-04-01", "2027-04-04", "booked"), sleep("k", "Kyoto", "2027-04-04", "2027-04-07", "booked")];
  it("a train: the operator's logo, the service bold, its class and day small; the seats and the platform as chips", () => {
    const box = board(kyoto, [...stays, train]).intents.find((i) => i.itemIds.includes("nozomi"))!;
    expect(box.ticket).toMatchObject({
      mode: "train", art: "tren",
      carrier: { brand: { label: "JR" }, name: "Nozomi", sub: "JR · Shinkansen · 4 Nisan" },
      from: { city: "Tokyo", time: "09:00" }, to: { city: "Kyoto", time: "11:00" },
      chips: [{ kind: "seat", text: "Vagon 8 · 4D, 4E" }, { kind: "platform", text: "Peron 14" }],
    });
    expect(box.access?.code).toEqual({ label: expect.any(String), value: "JR-30871" });
  });
  it("C15: a change of city nobody planned offers its ways", () => {
    const box = board(kyoto, stays).intents.find((i) => i.section === "transport")!;
    expect(box).toMatchObject({ status: "searching", modes: ["train", "bus", "car", "flight"], ticket: { from: { city: "Tokyo" }, to: { city: "Kyoto" }, legs: [] } });
  });
  it("a flight: its bag; a rented car: where it's picked up, for how long, when it goes back", () => {
    const out = fly("tk", "IST", "HND", "2027-04-01T01:55", "2027-04-01T19:25", "chosen", { metrics: { ...EMPTY_METRICS, checkedBagIncluded: true } });
    const car = ride("car", "Araç kiralama", "car_rental", "Kyoto", "Kyoto", "2027-04-04", "chosen", { city: "Kyoto", dates: { start: "2027-04-04", end: "2027-04-07", source: "page" }, location: { address: null, area: "Kyoto İst.", approximate: false } });
    const b = board(kyoto, [...stays, out, car]);
    expect(b.intents.find((i) => i.itemIds.includes("tk"))!.ticket!.chips).toEqual([{ kind: "bag", text: "1 bagaj dahil" }]);
    expect(b.intents.find((i) => i.itemIds.includes("car"))!.ticket).toMatchObject({ mode: "car", art: "arac-kiralama", rental: { pick: "Kyoto İst.", days: 3, back: "7 Nisan" } });
  });
  it("a pass: Alındı, its days and area, and how many ways on the plan it covers", () => {
    const pass = board(japan, japanItems()).intents.find((i) => i.itemIds.includes("pass"))!;
    expect(pass.ticket).toMatchObject({ mode: "pass", art: "tren", carrier: { name: "Hakone Free Pass", sub: "Odakyu · 4 Nisan" }, pass: { days: 3, area: "Hakone", covers: 1 } });
    expect(pass.ticket!.chips).toContainEqual({ kind: "covers", text: "1 yolculuk dahil" });
  });

  const live = (over: Partial<FlightSeen> = {}): FlightSeen => ({
    number: "TK49", airline: "Turkish Airlines", status: "Boarding", minutes: 900, fetchedAt: "2027-04-08T10:30:00Z",
    departure: { iata: "KIX", airport: "Kansai", scheduled: "2027-04-08T11:00", revised: "2027-04-08T11:25", actual: null, terminal: "1", gate: "21", desk: null },
    arrival: { iata: "IST", airport: "Istanbul", scheduled: "2027-04-08T17:40", revised: "2027-04-08T18:05", actual: null, terminal: null, gate: null, belt: null },
    ...over,
  });
  const home = (over: Partial<Item> = {}) =>
    fly("tk49", "KIX", "IST", "2027-04-08T11:00", "2027-04-08T17:40", "booked", { bookingRef: "TK8Q2L", flight: { from: "KIX", to: "IST", departure: "2027-04-08T11:00", arrival: "2027-04-08T17:40", carrier: "Turkish Airlines", flightNumber: "TK49", stops: 0 }, ...over });

  it("C4: on the flight's day the chips become the live strip (gate, delay, terminal, boarding) and the new times", () => {
    const now = new Date("2027-04-08T10:40:00Z");
    const box = board(japan, [...japanItems(), home({ flightLive: live() })], { now }).intents.find((i) => i.itemIds.includes("tk49"))!;
    expect(box.ticket!.live).toMatchObject({
      phase: "before", dot: "late", gate: "21", terminal: "KIX T1", delay: 25,
      stage: { value: "Biniş başladı" },
      shift: "Yeni kalkış 11:25, varış 18:05. Planı yeni saate kaydırdım.",
    });
    // Far off with nothing late, and before it's bought: no strip (a delay shows as soon as it's known: flightData's rule).
    const onTime = live({ status: "Expected", departure: { ...live().departure, revised: "2027-04-08T11:00" }, arrival: { ...live().arrival, revised: "2027-04-08T17:40" } });
    expect(board(japan, [...japanItems(), home({ flightLive: onTime })], { now: new Date("2027-04-01T10:00:00Z") }).intents.find((i) => i.itemIds.includes("tk49"))!.ticket!.live).toBeNull();
    expect(board(japan, [...japanItems(), home({ status: "chosen", flightLive: live() })], { now }).intents.find((i) => i.itemIds.includes("tk49"))!.ticket!.live).toBeNull();
  });

  it(`F2: ${CHECKIN_HOURS} hours before it leaves, a booked flight's main button is its check-in; earlier its document`, () => {
    const at = (iso: string) => board(japan, [...japanItems(), home()], { now: new Date(iso), docsFor: () => [] }).intents.find((i) => i.itemIds.includes("tk49"))!.access!.primary;
    expect(at("2027-04-06T12:00:00Z")).toBe("checkin");
    expect(at("2027-04-06T10:00:00Z")).toBe("addDoc");
  });
});

// --- the night on the plane (D14), what's missing as an intent (C16), the options' carrier ---------------------------

describe("D14, C16 and the option rows", () => {
  it("a night flight's night is no empty night to find (H6)", () => {
    const trip: Trip = { ...japan, confirmedDates: { start: "2027-03-31", end: "2027-04-05" } };
    const items = [fly("night", "IST", "HND", "2027-03-31T23:55", "2027-04-01T19:25", "booked"), sleep("tokyo", "Tokyo", "2027-04-01", "2027-04-05", "booked")];
    const stays = board(trip, items).all.find((c) => c.section.id === "stay")!;
    expect(stays.intents.map((i) => [i.head.name, i.status])).toEqual([["Tokyo", "booked"]]);
    expect(stays.summary.countsText).toBe("1 alındı");
    // Before the flight is chosen it's still a night to plan.
    expect(board(trip, [{ ...items[0], status: "saved" }, items[1]]).all.find((c) => c.section.id === "stay")!.intents).toHaveLength(2);
  });
  it("a one-way trip's way home is an intent to find, never a warning line", () => {
    const b = board(japan, [fly("out", "IST", "HND", "2027-04-01T01:55", "2027-04-01T19:25", "booked"), sleep("tokyo", "Tokyo", "2027-04-01", "2027-04-08", "booked")]);
    const flights = b.all.find((c) => c.section.id === "flight")!;
    expect(flights.intents.map((i) => [i.status, i.ticket?.from?.city ?? null])).toEqual([["booked", "İstanbul"], ["searching", "Tokyo"]]);
    expect(b.intents.some((i) => i.suggestions.some((x) => x.kind === "warning"))).toBe(false);
  });
  it("a flight option's row has its airline and number, a train's its service", () => {
    const options = [fly("o1", "KIX", "IST", "2027-04-08T11:00", "2027-04-08T17:40", "saved"), fly("o2", "KIX", "IST", "2027-04-08T13:00", "2027-04-08T19:40", "saved", { price: eur(700) })];
    const home = board(japan, [...japanItems(), ...options]).intents.find((i) => i.itemIds.includes("o1"))!;
    expect(home.options.map((o) => o.carrier?.name)).toEqual(["Qatar Airways", "Qatar Airways"]);
    expect(home.options[0].carrier?.sub).toMatch(/^QR\d+ · 8 Nisan$/);
  });
  it("H13: a head count said last is read", () => {
    expect(parseStartText("Bu hafta sonu Bursa'ya otobüsle, 2 kişi", TODAY).who).toMatchObject({ count: 2 });
    expect(parseStartText("2 kişilik oda Roma", TODAY).who).toBeNull();
  });
});

// --- the eleven signals ---------------------------------------------------------------------------------------------

describe("the eleven signals", () => {
  it("each one where the trip has it", () => {
    expect(SIGNAL_IDS).toHaveLength(11);
    const dive = made(fromIst(typed(fresh(), "Kasımda Kızıldeniz'de liveaboard, tek başıma", { destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8, plan: plan({ label: "Kızıldeniz liveaboard", base: "dive", focus: "", stay_port: "Hurgada", gateway: "Hurgada" }) })));
    const parts = dive.items.map((i) => i.part).filter((p): p is ItemPart => Boolean(p));
    const signals = Object.fromEntries(signalsOf(dive.trip, parts).map((x) => [x.id, x.value]));
    expect(signals).toEqual({ sleep: "boat", package: "stay", pass: null, movingBase: null, gateway: "Hurgada", perDay: null, focus: "only", gear: "gear", papers: "insurance", who: "solo", time: null });
    expect(shapeOf({ intent: { playbook: "ski" } })).toMatchObject({ preset: "ski", perDay: "pass" });
    expect(shapeOf({ intent: { playbook: "cruise" } })).toMatchObject({ preset: "cruise", sleep: "cabin", movingBase: true });
    expect(shapeOf({ intent: null, startGuide: { createdAt: 1, dayTrip: true } })).toMatchObject({ sleep: "none", closes: { stay: "aynı gün dönüş" } });
  });
  it("in both languages", () => {
    withLang("en", () => {
      const b = board({ ...japan }, japanItems());
      expect(b.all.find((c) => c.section.id === "transport")!.summary.info?.text).toBe("Hakone Free Pass is booked, so 1 way comes with it.");
      expect(b.intents.find((i) => i.itemIds.includes("boat"))!.cover).toMatchObject({ by: "with the Hakone Free Pass", open: "Open the pass" });
      expect(shapeOf({ intent: { playbook: "festival" } }).info.stay?.text).toMatch(/^Festival trip/);
    });
  });
});


describe("a stay asked for in words is its own card under its own name (omurga 2026-10-31, Emre: Tromsø'da kulübe)", () => {
  it("one night 'Cam tavanlı kulübe', the city's four nights 'Tromsø'; the husky tour a card of its own", () => {
    let s = applyAnswer(fresh(), { q: "where", place: "Tromsø", country: "Norveç", code: "NO" }, 2);
    s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 5 } }, 2);
    s = applyAnswer(s, { q: "start", date: "2027-02-15", approx: false }, 2);
    s = { ...fromIst(s), specialStays: [{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }], wanted: [{ city: "Tromsø", what: "husky turu", day: null }] };
    const b = made(s);
    expect(rows(b).filter((r) => r[0] === "stay").map((r) => r[2])).toEqual(["Cam tavanlı kulübe", "Tromsø"]);
    expect(b.all.find((c) => c.section.id === "stay")!.intents.map((i) => i.head.nights)).toEqual([1, 4]);
  });
});


describe("the ring closes: a way in from the airport means a way back to it (omurga 2026-10-31, Emre: 20 Şubat dönüş uçağı var, transfer yok)", () => {
  it("the model gave only the bus in: the bus back is made too, on the day home", () => {
    const s = fromIst(typed(fresh(), "Şubat'ta Tromsø'da 5 gece kuzey ışıkları", {
      destination: "Tromsø", destination_country: "Norveç", destination_country_code: "NO", start_date: "2027-02-15", duration_days: 6,
      plan: plan({ label: "Tromsø kuzey ışıkları gezisi", base: "classic", cards: [
        card({ ref: "bus", kind: "bus", title: "Havalimanı–şehir merkezi otobüsü", anchor: "arrive", section: "transport", frame: "ticket" }),
      ] }),
    }));
    const transport = made(s).all.find((c) => c.section.id === "transport")!;
    expect(transport.intents.map((i) => i.head.parts.join(" "))).toEqual([expect.stringContaining("15"), expect.stringContaining("20")]);
  });
});
