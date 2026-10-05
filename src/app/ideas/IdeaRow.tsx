// A to-do (fikirler-v1 .todo li): the tick (done: green, struck through, "Yapıldı · 12 Eki"), its icon from
// its words, the title and a grey line, then its day chip or "+ Güne ekle". One that turns out to need a
// ticket offers "Rezerve edileceklere taşı". × on hover deletes it with "Geri al".
import { L } from "../../lib/i18n";
import { ideaIcon, moveToBookings, setDone, todoLine } from "../../lib/ideas";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { DayButton } from "./DayPicker";
import { IdeaGlyph } from "./IdeaIcons";

/** Its title is edited where it stands (spec 0.33 §3); its day is the chip. */
export function IdeaRow(props: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <IdeaRowFace {...props} />
    </InlineEdit>
  );
}

function IdeaRowFace({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const env = useCardEnv();
  const done = Boolean(item.doneAt);
  const line = todoLine(item);
  return (
    <li className={`fk-row${done ? " done" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button type="button" className="fk-check" role="checkbox" aria-checked={done}
        aria-label={done ? L(`${item.name}: yapılmadı`, `${item.name}: not done`) : L(`${item.name}: yapıldı`, `${item.name}: done`)}
        onClick={() => void setDone(item, !done)}>
        {done && <IdeaGlyph name="check" size={13} />}
      </button>
      <span className="fk-ic">
        <IdeaGlyph name={ideaIcon(item)} />
      </span>
      <span className="fk-t">
        <b>
          <Editable field="name">{item.name}</Editable>
        </b>
        {line.text && (
          <span>
            {line.text}
            {line.promote && (
              <>
                {" · "}
                <button type="button" className="fk-promote" onClick={() => void moveToBookings(item)}>
                  {L("Rezerve edileceklere taşı", "Move to bookings")}
                </button>
              </>
            )}
          </span>
        )}
      </span>
      {!done && <DayButton item={item} plan={plan} />}
      <DeleteX name={item.name} onDelete={() => env.remove(item)} />
    </li>
  );
}
