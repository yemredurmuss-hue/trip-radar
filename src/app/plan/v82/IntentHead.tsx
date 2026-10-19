// An intent's fixed head (76 px; plan v82): its picture (52), its name (19 px, one line; a ticket's two ends), one line of
// what it is (in a mixed category the kind's word first, then the nights, the days; the trip's own head count never) and
// what was asked for (a must solid, a wish dashed), and on the right its state, "Pano n" and ⋯. With a record (inside the
// box's InlineEdit), its days edit where they stand (C2): the dates open the check-in, the nights the check-out.
import type { ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { headName, type StatusChip } from "../../../lib/intentFrame";
import type { IntentVM } from "../../../lib/intents";
import type { FieldKey } from "../../../lib/inlineEdit";
import { Editable } from "../../cards/InlineEdit";
import { Ic, partIcon } from "./icons";

/** The record's field behind a part of the line: a date its start, the nights its end. */
const fieldOf = (part: string): FieldKey | null => {
  const icon = partIcon(part);
  return icon === "cal" ? "date" : icon === "moon" ? "end" : null;
};

export function IntentHead({ vm, art, chip, chipId, pop, onPano, menu }: {
  vm: IntentVM;
  /** The chip's id: the box is described by its state in words, never by its colour alone. */
  chipId: string;
  /** The picture: the intent's own photo, else its kind's drawing. */
  art: { src: string; photo: boolean };
  chip: StatusChip;
  /** The chip springs once on a step forward (K29). */
  pop: boolean;
  onPano: (() => void) | null;
  menu: ReactNode;
}) {
  const h = vm.head;
  const shown = headName(vm);
  const name = h.route && vm.frame === "ticket" ? (
    <h4 className="q-nm" title={`${h.route.from} → ${h.route.to}`}>
      {h.route.from} <i>→</i> {h.route.to}
    </h4>
  ) : (
    <h4 className="q-nm" title={shown}>{shown}</h4>
  );
  return (
    <div className="q-head z-h">
      <div className="q-art">
        <img className={art.photo ? undefined : "art"} src={art.src} alt="" />
      </div>
      <div className="q-hd">
        {name}
        <div className="q-ln">
          {h.kindWord && <span className="z-kind">{h.kindWord}</span>}
          {h.parts.map((p) => {
            const field = fieldOf(p);
            return (
              <span key={p}>
                <Ic name={partIcon(p)} size={14} />
                {field ? <Editable field={field}>{p}</Editable> : p}
              </span>
            );
          })}
          {h.wants.length > 0 && (
            <span className="q-tg">
              {h.wants.map((w) => (
                <i key={w.label} className={w.must ? "req" : "want"} title={w.must ? L("Şart", "A must") : L("İstek", "A wish")}>
                  {w.must && <s />}
                  {w.label}
                </i>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="q-hr">
        <span id={chipId} className={`q-st ${chip.tone}${pop ? " pop" : ""}`}>
          {chip.tick && <Ic name="check" size={12} stroke={3.2} />}
          {chip.text}
        </span>
        <button type="button" className="q-pano" disabled={!onPano || !vm.optionCount} onClick={onPano ?? undefined}
          aria-label={L(`${shown}: Pano'da ${vm.optionCount} seçenek`, `${shown}: ${vm.optionCount} options on the Board`)}>
          <Ic name="board" size={14} />
          <span>{L("Pano", "Board")}</span>
          <b className="q-pn">{vm.optionCount}</b>
        </button>
        {menu}
      </div>
    </div>
  );
}
