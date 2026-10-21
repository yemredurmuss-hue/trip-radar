// What an intent box does (plan v82): the same writes the old cards make (app/actions.ts), named by what the box shows —
// "Seç" and "Bunu seç" choose, "Aldım" books, "Gerek yok" says the need (its nights, its options, its suggestion) not
// needed, "Ben hallettim" sets it aside as arranged (B13), "AI'dan öner" asks the trip's chat. Nothing new is written.
import { groupKeyOf } from "../../../lib/plan";
import type { IntentVM } from "../../../lib/intents";
import { L } from "../../../lib/i18n";
import { formatDateRange } from "../../../lib/items";
import { notNeededRule } from "../../../lib/hiddenIntents";
import { headName } from "../../../lib/intentFrame";
import { needTitleOf } from "../../../lib/pano";
import { addDays } from "../../../lib/plan";
import type { Item } from "../../../lib/types";
import { addArrangedLike, addArrangedPlanned, arrangeSuggested, chooseItem, dismissSuggestion, hideNights, replaceBooking, setArranged, setItemStatus, setNeedNotNeeded } from "../../actions";
import { useCardEnv } from "../../cards/PlanCard";
import { useSearching } from "../../cards/searching";
import { useV82Env } from "./v82Env";

/** The nights a stay intent covers, from its head (its first night and how many). */
export const nightsOf = (vm: Pick<IntentVM, "head">): { start: string; end: string } | null =>
  vm.head.date && vm.head.nights ? { start: vm.head.date, end: addDays(vm.head.date, vm.head.nights) } : null;

export function useIntentActions(vm: IntentVM) {
  const env = useCardEnv();
  const v82 = useV82Env();
  // Every record of the need still on the plan (its options beyond the three shown too).
  const live: Item[] = vm.itemIds.map((id) => v82.byId.get(id)).filter((i): i is Item => i != null && i.status !== "dismissed");
  const lead = vm.chosen?.item ?? vm.options[0]?.item ?? live[0] ?? null;
  const suggestion = vm.suggestions[0] ?? null;
  const nights = vm.section === "stay" ? nightsOf(vm) : null;
  const name = headName(vm);
  const label = nights ? `${vm.head.city ?? L("Konaklama", "Stay")} ${formatDateRange(nights.start, nights.end)}` : name;
  const [searching, startSearch] = useSearching(`intent:${vm.key}`);

  /** `except`: records already gone (a booking just said cancelled). */
  const skip = async (except: readonly string[] = []) => {
    // The one the card shows goes last (setNeedNotNeeded writes the others first): the card never flashes another option
    // as the pick while the need is being set aside.
    const records = live.filter((i) => !except.includes(i.id)).sort((x, y) => Number(y.id === lead?.id) - Number(x.id === lead?.id));
    if (suggestion) return v82.dismissSuggestion?.(suggestion);
    // Nights said not needed take their options with them (they come back together, from Gizlenenler); the toast's
    // "Geri al" brings the options back, and the nights with them.
    if (nights && records.length) {
      const hidden = await hideNights(env.tripId, nights, label);
      const undo = await setNeedNotNeeded(records);
      env.offer(undo.kind === "notNeeded" && hidden.kind === "hidden" ? { ...undo, nights: { tripId: hidden.tripId, key: hidden.key, label } } : undo);
      return;
    }
    if (nights) return env.hideNights(nights, label);
    if (!records.length) return;
    const undo = await setNeedNotNeeded(records);
    const rule = notNeededRule(vm.kind, name);
    if (rule) await dismissSuggestion(env.tripId, rule);
    env.offer(undo);
  };

  const arranged = async () => {
    if (suggestion) return arrangeSuggested(env.tripId, suggestion);
    const chosen = vm.chosen?.item;
    if (chosen && (chosen.status === "chosen" || chosen.status === "booked")) return setArranged(chosen, true);
    if (lead) return addArrangedLike(lead, needTitleOf(lead));
    if (nights) return addArrangedPlanned(env.tripId, { kind: "stay", date: nights.start, end_date: nights.end, time: null, from: null, to: null, city: vm.head.city, title: null, booked: false, note: null }, label);
  };

  return {
    lead,
    suggestion,
    label,
    searching,
    choose: (item: Item) => void chooseItem(item, live),
    /** "Bununla değiştir" said yes to: the booking counts as cancelled, `item` is chosen (actions.replaceBooking). */
    replace: (item: Item, booked: Item) => void replaceBooking(item, booked, live),
    /** "Aldım": the chosen one is booked. */
    got: (item: Item) => void setItemStatus(item, "booked"),
    skip: (except?: readonly string[]) => void skip(except),
    arranged: () => void arranged(),
    unarrange: (item: Item) => void setArranged(item, false),
    pano: lead ? () => env.onPano(groupKeyOf(lead)) : null,
    /** "AI'dan öner": the line goes to the trip's chat, which looks; the box says it is looking (E13). */
    ask: env.ask
      ? () => {
          env.ask!(L(`${name} için öneri bul`, `Find options for ${name}`));
          startSearch();
        }
      : null,
    addSuggestion: suggestion && v82.addSuggestion ? () => v82.addSuggestion!(suggestion) : null,
  };
}
