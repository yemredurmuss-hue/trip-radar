// A ski trip (Bansko, Uludağ, Chamonix): the flight in, the transfer to the resort, the stay, then the ski pass, the
// equipment and the ski school for the days there.
import { L } from "../i18n";
import { card, daysOf, firstStay, transferTo } from "./cards";
import type { Playbook } from "./index";

export const ski: Playbook = {
  kind: "ski",
  skeleton: (ctx) => {
    const stay = firstStay(ctx);
    const resort = stay?.city ?? ctx.intent?.place ?? null;
    const days = daysOf(stay, ctx.dates);
    const there = (title: string) => card({ kind: "activity", title, city: resort, ...days });
    return [
      ...transferTo(ctx, resort, stay?.date ?? days.date),
      there(L("Kayak pası", "Ski pass")),
      there(L("Ekipman kiralama", "Equipment rental")),
      there(L("Kayak okulu", "Ski school")),
    ];
  },
  blocked: {},
  prep: () => [L("Eldiven", "Gloves"), L("Kayak gözlüğü", "Goggles"), L("Termal içlik", "Thermal layers"), L("Kask", "Helmet"), L("Güneş kremi", "Sunscreen")],
  tip: () => L("Kayak pasını ve ekipmanı önceden çevrim içi ayırırsan sabah kuyruğuna girmezsin.", "Book the ski pass and gear online ahead and you skip the morning queue."),
  questions: () => [
    L("Kayak seviyen ne: yeni mi başlıyorsun, orta mı, ileri mi?", "What's your level: beginner, intermediate or advanced?"),
    L("Aklında hangi kayak merkezi var?", "Which resort do you have in mind?"),
    L("Ekipmanın var mı, yoksa kiralayacak mısın?", "Do you have your own gear, or will you rent?"),
  ],
  tone: () => L("Sportif ve pratik; karı ve pisti sevdiğini belli et.", "Sporty and practical; show you love the snow and the slopes."),
};
