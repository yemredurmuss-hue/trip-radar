// A ski trip (Bansko, Uludağ, Chamonix): the flight in, the transfer to the resort, the stay, then the ski pass, the
// equipment and the ski school for the days there.
import { L } from "../i18n";
import { card, daysOf, firstStay, transferTo } from "./cards";
import type { Playbook } from "./index";
import type { PbChip } from "./questions";

/** A resort picked: the stay and the ski cards go there instead of the country. */
const resort = (name: string, aliases: string[] = []): PbChip => ({ value: name, label: { tr: name, en: name }, aliases, effects: [{ op: "moveCards", to: "$value" }] });

/** The well-known resorts of a country asked about by name (a country said alone: "Bulgaristan'da kayak"). */
const RESORTS: Record<string, PbChip[]> = {
  BG: [resort("Bansko"), resort("Borovets"), resort("Pamporovo")],
  TR: [resort("Uludağ"), resort("Palandöken"), resort("Kartalkaya"), resort("Erciyes")],
  FR: [resort("Chamonix"), resort("Val Thorens"), resort("Courchevel")],
  AT: [resort("St. Anton", ["st anton", "sankt anton"]), resort("Kitzbühel"), resort("Ischgl")],
  CH: [resort("Zermatt"), resort("Verbier"), resort("St. Moritz", ["st moritz", "sankt moritz"])],
  IT: [resort("Cortina d'Ampezzo", ["cortina"]), resort("Val Gardena"), resort("Livigno")],
  AD: [resort("Soldeu", ["grandvalira"]), resort("Pas de la Casa")],
  GE: [resort("Gudauri"), resort("Bakuriani")],
  JP: [resort("Niseko"), resort("Hakuba")],
};

export const ski: Playbook = {
  kind: "ski",
  skeleton: (ctx) => {
    const stay = firstStay(ctx);
    const resort = stay?.city ?? ctx.intent?.place ?? null;
    const days = daysOf(stay, ctx.dates);
    const there = (ref: string, title: string) => card({ kind: "activity", ref, title, city: resort, ...days });
    return [
      ...transferTo(ctx, resort, stay?.date ?? days.date),
      there("pass", L("Kayak pası", "Ski pass")),
      there("rental", L("Ekipman kiralama", "Equipment rental")),
      there("school", L("Kayak okulu", "Ski school")),
    ];
  },
  blocked: {},
  prep: () => [L("Eldiven", "Gloves"), L("Kayak gözlüğü", "Goggles"), L("Termal içlik", "Thermal layers"), L("Kask", "Helmet"), L("Güneş kremi", "Sunscreen")],
  tip: () => L("Kayak pasını ve ekipmanı önceden çevrim içi ayırırsan sabah kuyruğuna girmezsin.", "Book the ski pass and gear online ahead and you skip the morning queue."),
  questions: [
    {
      id: "level",
      text: { tr: "Kayak seviyen ne: yeni mi başlıyorsun, orta mı, ileri mi?", en: "What's your level: beginner, intermediate or advanced?" },
      chips: [
        { value: "beginner", label: { tr: "Başlangıç", en: "Beginner" }, aliases: ["yeni", "acemi", "ilk kez", "ilk defa", "beginner", "first time", "never"], effects: [] },
        { value: "intermediate", label: { tr: "Orta", en: "Intermediate" }, aliases: ["orta", "intermediate"], effects: [] },
        // An advanced skier needs no school.
        { value: "advanced", label: { tr: "İleri", en: "Advanced" }, aliases: ["ileri", "uzman", "advanced", "expert"], effects: [{ op: "dropCard", card: "school" }] },
      ],
    },
    {
      id: "resort",
      text: { tr: "Aklında hangi kayak merkezi var?", en: "Which resort do you have in mind?" },
      askIf: "countryDestination",
      chips: [],
      byCountry: RESORTS,
    },
    {
      id: "gear",
      text: { tr: "Ekipmanın var mı, yoksa kiralayacak mısın?", en: "Do you have your own gear, or will you rent?" },
      chips: [
        // Their own gear: no rental opened.
        { value: "own", label: { tr: "Var", en: "I have mine" }, aliases: ["kendi", "benim", "var", "own", "mine", "have"], effects: [{ op: "dropCard", card: "rental" }] },
        { value: "rent", label: { tr: "Kiralayacağım", en: "I'll rent" }, aliases: ["kira", "yok", "rent", "renting", "hire"], effects: [] },
      ],
    },
  ],
  tone: () => L("Sportif ve pratik; karı ve pisti sevdiğini belli et.", "Sporty and practical; show you love the snow and the slopes."),
};
