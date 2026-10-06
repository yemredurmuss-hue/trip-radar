// A honeymoon (Maldivler, Bali, Santorini): the flight in, the transfer to the resort (a seaplane or a speedboat on
// the islands that need one), the resort, then a spa for two, a private dinner and, by a reef, a dive.
import { L } from "../i18n";
import { card, daysOf, firstStay, transferTo } from "./cards";
import type { Playbook } from "./index";

/** Where the resorts are reached by seaplane or speedboat. */
const BY_SEA = new Set(["MV", "SC", "PF", "FJ"]);
/** Where a dive is part of it (reefs by the resorts). */
const DIVING = new Set(["MV", "SC", "MU", "PF", "FJ", "ID", "TH", "PH", "LK", "TZ", "EG", "MX", "BZ", "CU", "DO", "MY", "AU"]);

export const honeymoon: Playbook = {
  kind: "honeymoon",
  skeleton: (ctx) => {
    const stay = firstStay(ctx);
    const resort = stay?.city ?? ctx.intent?.place ?? null;
    const days = daysOf(stay, ctx.dates);
    // An evening or a dive is one day of the stay, which one is theirs to pick: in the resort's place, undated.
    const there = (title: string) => card({ kind: "activity", title, city: resort });
    const sea = Boolean(ctx.code && BY_SEA.has(ctx.code));
    return [
      ...transferTo(ctx, resort, stay?.date ?? days.date, sea ? L("Deniz uçağı ya da sürat teknesi transferi", "Seaplane or speedboat transfer") : null),
      there(L("Çift spası", "Couples spa")),
      there(L("Özel akşam yemeği", "Private dinner")),
      ...(ctx.code && DIVING.has(ctx.code) ? [there(L("Dalış", "Diving"))] : []),
    ];
  },
  blocked: {},
  prep: () => [L("Evlilik belgesinin kopyası", "Copy of the marriage certificate"), L("Resif dostu güneş kremi", "Reef-safe sunscreen"), L("Şnorkel maskesi", "Snorkel mask"), L("Akşam yemeği için şık kıyafet", "Something smart for dinner")],
  tip: () => L("Rezervasyonda balayı olduğunu söyle; çoğu resort küçük bir sürpriz hazırlıyor.", "Mention it's your honeymoon when booking; many resorts prepare a small surprise."),
  questions: () => [
    L("Aşağı yukarı bütçeniz ne kadar?", "Roughly what's your budget?"),
    L("Tek resort mu, iki farklı resort mu?", "One resort, or two?"),
  ],
  tone: () => L("Romantik ve sakin; çifti kutla ama abartma.", "Romantic and calm; celebrate the couple without overdoing it."),
};
