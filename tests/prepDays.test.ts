// Hazırlık's dated chores (lib/prepDays.ts, v82 aşama 7, Etsy T3 a): each chore carries its own day, the list goes by day
// with the dayless ones last, a day is only what the trip says (a stored chore's date, a booked flight's check-in, a
// bought eSIM before leaving, the Schengen rule's 15 days, Japan's form before landing), and the closed row says the same.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { dative, prepDayText, prepDayTone, prepFromText, prepHiddenKey, prepSummary, prepTasks, storedTask, type PrepInput } from "../src/lib/prepDays";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const chore = (name: string, over: Partial<Item> = {}) => makeItem({ category: "other", needKey: `other:prep-${name}`, name, plannedKind: "prep", origin: "chat", status: "chosen", booking: "none", ...over });
const flight = (no: string, departure: string, over: Partial<Item> = {}) =>
  makeItem({ category: "flight", needKey: `flight:${no}`, name: no, status: "booked", flight: { from: "LIS", to: "IST", departure, arrival: null, carrier: "TAP", flightNumber: no, stops: 0 }, dates: { start: departure.slice(0, 10), end: null, source: "page" }, ...over });

const input = (over: Partial<PrepInput> = {}): PrepInput => ({
  chores: [],
  items: [],
  trip: {},
  range: { start: "2026-10-08", end: "2026-10-14" },
  passport: "TR",
  countries: [],
  today: "2026-10-01",
  ...over,
});

describe("the days", () => {
  it("a stored chore keeps the day said with it (and its time); without one it has none", () => {
    const pay = chore("Gora Kadan: kalan €300'ü girişte öde", { dates: { start: "2027-04-09", end: null, source: "unverified" } });
    expect(storedTask(pay).day).toEqual({ date: "2027-04-09", time: null, rel: "on" });
    expect(storedTask(pay).from).toBe("chat");
    const timed = chore("Taksi ayarla", { dates: { start: "2027-04-09", end: null, source: "unverified" }, flight: { from: null, to: null, departure: "2027-04-09T08:30", arrival: null, carrier: null, flightNumber: null, stops: null } });
    expect(storedTask(timed).day).toEqual({ date: "2027-04-09", time: "08:30", rel: "at" });
    const plain = chore("Biletleri telefona indir");
    expect(storedTask(plain).day).toBeNull();
    expect(storedTask(plain).from).toBeNull();
    // Typed by hand (no chat): a day, but no "sohbetten".
    expect(storedTask(chore("Döviz bozdur", { origin: undefined, dates: { start: "2027-03-31", end: null, source: "user" } })).from).toBeNull();
  });

  it("an online check-in per booked flight: 24 hours before take-off, from the flight", () => {
    const tp = flight("TP 1760", "2026-10-14T19:40");
    const [t] = prepTasks(input({ items: [tp] }));
    expect(t).toMatchObject({ key: `checkin:${tp.id}`, title: "Online check-in · TP 1760", from: "flight", day: { date: "2026-10-13", time: "19:40", rel: "at" }, tick: "mark" });
    expect(t.sub).toBe("Lizbon → İstanbul · kalkıştan 24 saat önce açılır");
    expect(withLang("en", () => prepDayText(t.day!))).toBe("13 Oct 19:40");
    expect(prepDayText(t.day!)).toBe("13 Eki 19:40");
  });

  it("no check-in for a flight not booked, gone by, cancelled, or without its clock", () => {
    const tasks = prepTasks(
      input({
        today: "2026-10-10",
        items: [flight("A1", "2026-10-14T19:40", { status: "chosen" }), flight("A2", "2026-10-09T10:00"), flight("A3", "2026-10-14T10:00", { cancelledAt: 1, status: "dismissed" }), flight("A4", "2026-10-14")],
      }),
    );
    expect(tasks).toEqual([]);
  });

  it("a bought eSIM is put in before the first flight leaves; its 'Kurdum' ticks it", () => {
    const esim = makeItem({ category: "esim", name: "Airalo Portekiz 5 GB", status: "booked" });
    const out = flight("PC 1201", "2026-10-07T07:10");
    const tasks = prepTasks(input({ items: [esim, out] }));
    const t = tasks.find((x) => x.key === `esim:${esim.id}`)!;
    expect(t).toMatchObject({ title: "eSIM'i kur · Airalo Portekiz 5 GB", day: { date: "2026-10-07", rel: "before" }, from: "esim", done: false, tick: "installed" });
    expect(prepDayText(t.day!)).toBe("7 Eki'den önce");
    const put = prepTasks(input({ items: [{ ...esim, installedAt: 5 }] }))[0];
    expect(put).toMatchObject({ done: true, doneAt: 5 });
    // Not bought yet: Belgeler ve internet's choice, not a chore.
    expect(prepTasks(input({ items: [{ ...esim, status: "chosen" }] }))).toEqual([]);
  });

  it("a Turkish passport to a Schengen country: apply at the latest 15 days ahead, from the visa rule; 'Vize alındı' ticks it", () => {
    const [t] = prepTasks(input({ countries: ["PT"] }));
    expect(t).toMatchObject({ key: "visa:schengen", title: "Schengen vizesine başvur", from: "visa", day: { date: "2026-09-23", rel: "by" }, tick: "visa", done: false });
    expect(t.official).toMatch(/^https:\/\//);
    expect(prepDayText(t.day!)).toBe("23 Eyl'e kadar");
    expect(prepTasks(input({ countries: ["PT"], trip: { visaDone: true } }))[0].done).toBe(true);
    // No visa there, another passport, no dates, or said in the chat already: none worked out.
    expect(prepTasks(input({ countries: ["JP"] })).some((x) => x.key === "visa:schengen")).toBe(false);
    expect(prepTasks(input({ countries: ["PT"], passport: "DE" }))).toEqual([]);
    expect(prepTasks(input({ countries: ["PT"], range: null }))).toEqual([]);
    expect(prepTasks(input({ countries: ["PT"], chores: [chore("Vize başvurusu yap")] })).map((x) => x.key)).toEqual([expect.stringMatching(/^item:/)]);
  });

  it("Indonesia on a Turkish passport (Emre's Bali, 0.39.1): the e-VOA before leaving, or the visa on arrival, with its fee; one mark with Belgeler", () => {
    const t = prepTasks(input({ countries: ["TR", "ID"] })).find((x) => x.key === "visa:ID")!;
    expect(t).toMatchObject({ title: "Endonezya e-VOA'sını al (ya da varışta vize)", sub: "Varışta da alınabilir, ücretli", from: "visa", official: "https://evisa.imigrasi.go.id/", tick: "visa", done: false });
    expect(prepTasks(input({ countries: ["ID"], trip: { visaDone: true } })).find((x) => x.key === "visa:ID")?.done).toBe(true);
    // No passport known: no chore taken for a Turkish one.
    expect(prepTasks(input({ countries: ["ID"], passport: null }))).toEqual([]);
  });

  it("Sri Lanka's ETA (Emre's Ahangama, 19 Ekim): applied for before leaving, from the visa rule, its official page, no lead time made up", () => {
    const out = makeItem({ category: "flight", needKey: "flight:bjv-cmb", name: "Bodrum → Kolombo", status: "chosen", flight: { from: "Bodrum", to: "Kolombo", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }, dates: { start: "2026-11-02", end: null, source: "user" } });
    const tasks = prepTasks(input({ countries: ["LK"], items: [out], range: { start: "2026-11-02", end: "2026-11-20" } }));
    const t = tasks.find((x) => x.key === "visa:LK")!;
    expect(t).toMatchObject({ title: "Sri Lanka ETA başvurusu", from: "visa", day: { date: "2026-11-02", rel: "before" }, official: "https://www.eta.gov.lk/", done: false, tick: "visa" });
    expect(prepDayText(t.day!)).toBe("2 Kas'tan önce");
    expect(prepFromText(t.from!)).toBe("vize kuralından");
    expect(t.sub).toBeNull();
    // Ticked: a mark on the trip, one with Belgeler's "Var" (trip.visaDone).
    expect(prepTasks(input({ countries: ["LK"], trip: { prepDone: { "visa:LK": 7 } } })).find((x) => x.key === "visa:LK")).toMatchObject({ done: true, doneAt: 7 });
    expect(prepTasks(input({ countries: ["LK"], trip: { visaDone: true } })).find((x) => x.key === "visa:LK")).toMatchObject({ done: true });
    // The UK's too; none for a country without a visa, another passport, or said in the chat already.
    expect(prepTasks(input({ countries: ["GB"] })).map((x) => x.title)).toEqual(["Birleşik Krallık vizesine başvur"]);
    expect(prepTasks(input({ countries: ["JP"] })).some((x) => x.key.startsWith("visa:"))).toBe(false);
    expect(prepTasks(input({ countries: ["LK"], passport: "DE" }))).toEqual([]);
    expect(prepTasks(input({ countries: ["LK"], chores: [chore("ETA başvurusu yap")] })).map((x) => x.key)).toEqual([expect.stringMatching(/^item:/)]);
  });

  it("Japan's Visit Japan Web by the day one lands there, with its official page", () => {
    const stay = makeItem({ category: "stay", countryCode: "JP", dates: { start: "2027-04-02", end: "2027-04-05", source: "page" } });
    const t = prepTasks(input({ countries: ["JP"], items: [stay], range: { start: "2027-04-01", end: "2027-04-16" } })).find((x) => x.key === "entry:JP")!;
    expect(t).toMatchObject({ title: "Visit Japan Web'e kaydol", day: { date: "2027-04-02", rel: "by" }, official: "https://www.vjw.digital.go.jp/" });
    expect(prepDayText(t.day!)).toBe("2 Nis'e kadar");
    expect(prepTasks(input({ countries: ["JP"], chores: [chore("Visit Japan Web kaydı yap")] })).some((x) => x.key === "entry:JP")).toBe(false);
  });

  it("a worked-out chore ticked is done (trip.prepDone); taken off stays off (trip.hidden)", () => {
    const tp = flight("TP 1760", "2026-10-14T19:40");
    const key = `checkin:${tp.id}`;
    expect(prepTasks(input({ items: [tp], trip: { prepDone: { [key]: 7 } } }))[0]).toMatchObject({ done: true, doneAt: 7 });
    expect(prepTasks(input({ items: [tp], trip: { hidden: [prepHiddenKey(key)] } }))).toEqual([]);
  });
});

describe("the order", () => {
  it("by day (a day's moments by their clock, then the whole day's), the dayless last in their own order; what's done stays in its place", () => {
    const a = chore("Biletleri telefona indir", { doneAt: 3 });
    const b = chore("Yen bozdur", { dates: { start: "2026-10-07", end: null, source: "unverified" } });
    const c = chore("Kalan ödeme", { dates: { start: "2026-10-13", end: null, source: "unverified" } });
    const d = chore("Pasaportu kontrol et");
    const tp = flight("TP 1760", "2026-10-14T19:40");
    const titles = prepTasks(input({ chores: [a, b, c, d], items: [tp], countries: ["PT"] })).map((t) => t.title);
    expect(titles).toEqual(["Schengen vizesine başvur", "Yen bozdur", "Online check-in · TP 1760", "Kalan ödeme", "Biletleri telefona indir", "Pasaportu kontrol et"]);
  });
});

describe("the words", () => {
  it("the Turkish suffixes go by the month's own sound", () => {
    expect(["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"].map(dative)).toEqual(["Oca'ya", "Şub'a", "Mar'a", "Nis'e", "May'a", "Haz'a", "Tem'e", "Ağu'ya", "Eyl'e", "Eki'ye", "Kas'a", "Ara'ya"]);
    expect(prepDayText({ date: "2027-04-01", time: null, rel: "before" })).toBe("1 Nis'ten önce");
    expect(prepDayText({ date: "2027-07-26", time: null, rel: "before" })).toBe("26 Tem'den önce");
    expect(prepDayText({ date: "2027-11-26", time: null, rel: "before" })).toBe("26 Kas'tan önce");
    expect(prepDayText({ date: "2027-04-09", time: null, rel: "on" })).toBe("9 Nis");
    expect(withLang("en", () => prepDayText({ date: "2027-04-01", time: null, rel: "by" }))).toBe("by 1 Apr");
    expect(withLang("en", () => prepDayText({ date: "2027-04-01", time: null, rel: "before" }))).toBe("before 1 Apr");
  });

  it("where it came from, in both languages", () => {
    expect(prepFromText("flight")).toBe("uçuş kartından");
    expect(prepFromText("chat")).toBe("sohbetten");
    expect(prepFromText("visa")).toBe("vize kuralından");
    expect(withLang("en", () => prepFromText("flight"))).toBe("from the flight");
  });

  it("near and open: orange; gone by: past (never the orange of what is coming); done or far: plain", () => {
    const day = { date: "2026-10-13", time: null, rel: "on" as const };
    expect(prepDayTone({ day, done: false }, "2026-10-01")).toBe("soon");
    expect(prepDayTone({ day, done: false }, "2026-10-13")).toBe("soon");
    expect(prepDayTone({ day, done: false }, "2026-10-20")).toBe("past");
    // Row 144: "23 Eyl'e kadar" on 5 Ekim.
    expect(prepDayTone({ day: { date: "2026-09-23", time: null, rel: "by" }, done: false }, "2026-10-05")).toBe("past");
    expect(prepDayTone({ day, done: true }, "2026-10-20")).toBeNull();
    expect(prepDayTone({ day, done: true }, "2026-10-01")).toBeNull();
    expect(prepDayTone({ day, done: false }, "2026-09-01")).toBeNull();
    expect(prepDayTone({ day: null, done: false }, "2026-10-01")).toBeNull();
  });

  it("the closed row: how many, and the first open one with a day as the next", () => {
    const done = chore("Visit Japan Web'e kaydol", { doneAt: 1, dates: { start: "2027-03-31", end: null, source: "user" } });
    const yen = chore("Yen bozdur", { dates: { start: "2027-04-01", end: null, source: "user" } });
    const tasks = prepTasks(input({ chores: [done, yen, chore("Biletleri telefona indir")], range: { start: "2027-04-01", end: "2027-04-16" } }));
    const s = prepSummary(tasks);
    expect(s).toMatchObject({ total: 3, done: 1 });
    expect(s.next?.title).toBe("Yen bozdur");
    expect(s.line).toBe("Gezi öncesi 3 iş · sıradaki: Yen bozdur, 1 Nis");
    expect(s.nextText).toBe("sıradaki 1 Nis: Yen bozdur");
    expect(withLang("en", () => prepSummary(tasks).line)).toBe("3 things before the trip · next: Yen bozdur, 1 Apr");
    // Nothing with a day: only how many; nothing at all: no line.
    expect(prepSummary(prepTasks(input({ chores: [chore("Biletleri telefona indir")] }))).line).toBe("Gezi öncesi 1 iş");
    expect(prepSummary([]).line).toBeNull();
    // a day gone by says so on the closed row too (Emre, 19 Ekim: like its row, "geçti")
    const late = [{ ...tasks.find((t) => !t.done && t.day)!, day: { date: "2026-09-23", time: null, rel: "by" as const } }];
    expect(prepSummary(late, "2026-10-05").line).toMatch(/23 Eyl'e kadar · geçti$/);
    expect(prepSummary(late, "2026-09-20").line).not.toMatch(/geçti/);
  });
});
