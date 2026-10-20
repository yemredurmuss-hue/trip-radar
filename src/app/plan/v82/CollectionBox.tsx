// A city's row of cards as one intent box (plan v82 "niyet kutusu standardı", the collection family; aşama 4): the same head
// as every intent (IntentHead: the city, its days, what was asked for, the state "2 planda · 1 alındı", Pano n, ⋯) over the
// two rows (CollectionRow). Its ⋯ is the row's own: "Daha fazla öner" (the chat looks for the city) and "Gerek yok" (its
// ideas, suggestions and what's on the plan go under Gizlenenler; a bought ticket stays, it was paid for). A row holds many
// records, none of them the box's own, so it isn't IntentBox's one-record shell (its Seç, Değiştir, Ayrıntı); its content
// never crossfades (a card flies into its slot instead, E6).
import { useEffect, useId, useRef, useState } from "react";
import { askMore } from "../../../lib/collectionCards";
import { L } from "../../../lib/i18n";
import { headName, railState, statusChip } from "../../../lib/intentFrame";
import type { IntentStatus, IntentVM } from "../../../lib/intents";
import { entryDomId } from "../../../lib/progress";
import type { Item } from "../../../lib/types";
import { chooseItem, setItemStatus, setNeedNotNeeded } from "../../actions";
import type { MenuEntry } from "../../cards/CardShell";
import { useCardEnv } from "../../cards/PlanCard";
import { FOLD_MS, reducedMotion } from "../../motion";
import { CollectionRow } from "./CollectionRow";
import { IntentHead } from "./IntentHead";
import { artOf } from "./IntentBox";
import { IntentMenu } from "./IntentMenu";
import { useV82Env } from "./v82Env";

/** How far along a state is: the chip springs once on a step forward, never back (hareket dili, kural 4). */
const STEP: Readonly<Record<IntentStatus, number>> = { skipped: -1, searching: 0, deciding: 1, suggested: 2, chosen: 3, arranged: 4, included: 4, booked: 5 };

function useStepPop(status: IntentStatus): boolean {
  const [pop, setPop] = useState(false);
  const was = useRef(status);
  useEffect(() => {
    const forward = STEP[status] > STEP[was.current];
    was.current = status;
    if (!forward || reducedMotion()) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), 520);
    return () => clearTimeout(t);
  }, [status]);
  return pop;
}

export function CollectionBox({ vm, color }: { vm: IntentVM; color: string }) {
  const env = useCardEnv();
  const v82 = useV82Env();
  const [folding, setFolding] = useState(false);
  const chipId = useId();
  const pop = useStepPop(vm.status);
  const name = headName(vm);
  const art = artOf(vm.kind);
  const live = vm.itemIds.map((id) => v82.byId.get(id)).filter((i): i is Item => i != null && i.status !== "dismissed");
  const lead = live[0] ?? null;
  const open = live.filter((i) => i.status !== "booked");

  const notNeeded = async () => {
    for (const s of vm.suggestions) v82.dismissSuggestion?.(s);
    if (open.length) env.offer(await setNeedNotNeeded(open));
  };
  const skip = () => {
    // Nothing bought in it: the body folds away first (E7); with a ticket bought, the row stays for it.
    if (open.length < live.length || reducedMotion()) return void notNeeded();
    setFolding(true);
    setTimeout(() => void notNeeded(), FOLD_MS);
  };
  const menu: MenuEntry[] = [
    ...(env.ask ? [{ label: L("Daha fazla öner", "Suggest more"), run: () => env.ask!(askMore(vm.section, vm.head.city)) }] : []),
    ...(live.length || vm.suggestions.length ? [{ label: L("Gerek yok", "Not needed"), run: skip, danger: true }] : []),
  ];
  // A row says how many are on the plan ("2 planda · 1 alındı"), with no tick (the prototype's many-pick chip). 0.39.14
  // (Emre: "çok buton text var"): Yapılacaklar' city with nothing on its plan says "Karar bekliyor" to a reader only; the
  // category's "1 karar" and the box's dashed edge say it already.
  const waiting = vm.status === "deciding" || vm.status === "searching";
  const chip = { ...statusChip(vm), tick: false, quiet: vm.section === "todo" && waiting };
  return (
    <section
      className={`q-int z-int multi${folding ? " folding" : ""}`}
      id={vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined}
      data-intent={vm.key}
      data-st={railState(vm.status)}
      data-kind={vm.kind}
      data-option-ids={vm.itemIds.join(" ") || undefined}
      style={{ "--k": color } as React.CSSProperties}
      aria-label={name}
      aria-describedby={chipId}
      data-new={L("Yeni", "New")}
    >
      <IntentHead vm={vm} art={{ src: art, photo: false }} chip={chip} chipId={chipId} pop={pop} onPano={lead || vm.optionCount ? () => env.onPano(vm.key) : null} menu={<IntentMenu entries={menu} name={name} />} />
      <div className="q-bwrap">
        <div className="q-body">
          <CollectionRow vm={vm} art={art} onPut={(o) => void chooseItem(o.item, [])} onTakeOff={(o) => void setItemStatus(o.item, "saved")} />
        </div>
      </div>
      {/* The row's other entries: a to-do or a link to one of them finds this box (and flashes it). */}
      {vm.domKeys.slice(1).map((k) => (
        <i key={k} className="q-anchor" id={entryDomId(k)} aria-hidden />
      ))}
    </section>
  );
}
