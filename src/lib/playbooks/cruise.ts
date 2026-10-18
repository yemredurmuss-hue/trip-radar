// A cruise (D11, gezi biçimi: a moving base): the nights are in the ship's cabin, never a hotel to find; the sailing
// between the ports comes with the cabin, so only the transfer to the port is a way to decide, and each port's shore
// excursions are things to book there.
import { L } from "../i18n";
import { card, daysOf, firstStay, transferTo } from "./cards";
import type { Playbook } from "./index";

export const cruise: Playbook = {
  kind: "cruise",
  skeleton: (ctx) => {
    const stay = firstStay(ctx);
    const port = stay?.city ?? ctx.intent?.place ?? null;
    const days = daysOf(stay, ctx.dates);
    return [
      ...transferTo(ctx, port, stay?.date ?? days.date, L("Limana transfer", "Transfer to the port")),
      card({ kind: "activity", ref: "shore", title: L("Kıyı turları", "Shore excursions"), city: port, part: { ref: "shore", section: "activity", frame: "collection", word: L("Kıyı turu", "Shore excursion"), pick: "multi" } }),
    ];
  },
  blocked: {},
  prep: () => [L("Deniz tutması ilacı", "Seasickness tablets"), L("Akşam yemeği için kıyafet", "Something for the dinners"), L("Gemi kartı ve kabin numarası", "Cruise card and cabin number")],
  tip: () => L("Limana bir gün önce varırsan geminin kalkışını kaçırma riskin kalmaz.", "Arrive at the port the day before and there's no risk of missing the ship."),
  questions: [],
  tone: () => L("Rahat ve keyifli; denizi ve limanları seven bir arkadaş gibi.", "Relaxed and cheerful, like a friend who loves the sea and the ports."),
};
