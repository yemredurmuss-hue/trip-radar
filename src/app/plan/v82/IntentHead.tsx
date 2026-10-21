// An intent's roof (plan v13, spec 2026-10-21 K79–K81: 58 px): its picture (40; a chosen ticket its carrier's logo), its
// name (a ticket's two ends: "İstanbul → Tromsø"), one line of what it is (a ticket's type and carrier, "Gidiş · Pegasus PC
// 1923", "Vapur bileti · Hurtigbåt"; a stay's days), and on the right its state and ⋯. The options' count and the Pano live
// in the card and in the drawer beside the plan (K82); what was asked for is said in the empty card and in the drawer.
// With a record (inside the box's InlineEdit), its days edit where they stand (C2).
import type { ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { headName, type StatusChip } from "../../../lib/intentFrame";
import type { IntentVM } from "../../../lib/intents";
import type { FieldKey } from "../../../lib/inlineEdit";
import { ticketFace } from "../../../lib/ticketFrame";
import { Editable } from "../../cards/InlineEdit";
import { Ic, partIcon } from "./icons";
import { CarrierLogo } from "./OptionRow";
import { SearchDots } from "./Searching";

/** The record's field behind a part of the line: a date its start, the nights its end. */
const fieldOf = (part: string): FieldKey | null => {
  const icon = partIcon(part);
  return icon === "cal" ? "date" : icon === "moon" ? "end" : null;
};

/** A ticket's type said in its line (K84): a boat, a train, a bus say what they are; a flight says its leg. */
export const ticketWord = (mode: string | null | undefined): string | null =>
  mode === "ferry" ? L("Vapur bileti", "Ferry ticket") : mode === "train" ? L("Tren bileti", "Train ticket") : mode === "bus" ? L("Otobüs bileti", "Bus ticket") : null;

export function IntentHead({ vm, art, chip, busy = false, chipId, pop, onPano, menu }: {
  vm: IntentVM;
  /** The chip's id: the box is described by its state in words, never by its colour alone. */
  chipId: string;
  /** The picture: the intent's own photo, else its kind's drawing. */
  art: { src: string; photo: boolean };
  chip: StatusChip;
  /** A search is out now: the chip's "Aranıyor" has three small dots (0.38.8). */
  busy?: boolean;
  /** The chip springs once on a step forward (K29). */
  pop: boolean;
  onPano: (() => void) | null;
  menu: ReactNode;
}) {
  const h = vm.head;
  const shown = headName(vm);
  const ticket = vm.frame === "ticket";
  const face = ticket ? ticketFace(vm) : null;
  const chosen = ticket && vm.chosen && face && face.mode !== "car" ? face : null;
  const name = h.route && ticket ? (
    <h4 className="q-nm" title={`${h.route.from} → ${h.route.to}`}>
      {h.route.from} <i>→</i> {h.route.to}
    </h4>
  ) : (
    <h4 className="q-nm" title={shown}>{shown}</h4>
  );
  // The line: a ticket's type (or the kind's word) and, once one is chosen, its carrier; then the days (a ticket's route
  // part is its name already).
  const kind = ticket ? (ticketWord(face?.mode) ?? h.kindWord) : h.kindWord;
  const carrier = chosen ? [chosen.name, chosen.sub].filter(Boolean).join(" ") : null;
  const parts = ticket ? h.parts.filter((p) => !/→/.test(p)) : h.parts;
  return (
    <div className="q-head z-h">
      <div className={`q-art${chosen?.mark ? " q-carr" : ""}`}>
        {chosen?.mark ? <CarrierLogo mark={chosen.mark} art={art.src} /> : <img className={art.photo ? undefined : "art"} src={art.src} alt="" />}
      </div>
      <div className="q-hd">
        {name}
        <div className="q-ln">
          {kind && <span className="z-kind">{kind}</span>}
          {carrier && <span className="z-carl" title={carrier}>{carrier}</span>}
          {h.hub && (
            <span title={L(`${h.hub} havalimanı`, `${h.hub} airport`)}>
              <Ic name="plane" size={14} />
              {h.hub}
            </span>
          )}
          {!carrier &&
            parts.map((p) => {
              const field = fieldOf(p);
              return (
                <span key={p}>
                  <Ic name={partIcon(p)} size={14} />
                  {field ? <Editable field={field}>{p}</Editable> : p}
                </span>
              );
            })}
        </div>
      </div>
      <div className="q-hr">
        <span id={chipId} className={`q-st ${chip.tone}${pop ? " pop" : ""}${chip.quiet ? " sr-only" : ""}`}>
          {chip.tick && <Ic name="check" size={12} stroke={3.2} />}
          {busy && <SearchDots />}
          {chip.text}
        </span>
        {menu}
      </div>
    </div>
  );
}
