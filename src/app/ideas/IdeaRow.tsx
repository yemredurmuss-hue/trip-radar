// A to-do on the Plan's Yapılacak şeyler (fikirler-v1 .todo li): the tick (done: green, struck through,
// "Yapıldı · 12 Eki"), its icon from its words — or, from a Maps (or any page) link, a small photo of the
// page — the title and a grey line (city · where it came from · what was said), then its day chip or
// "+ Güne ekle". One that turns out to need a ticket offers "Etkinliklere taşı". × on hover deletes it with
// "Geri al".
import { L } from "../../lib/i18n";
import { ideaIcon, ideaSource, ideaThumb, moveToBookings, setDone, todoLine } from "../../lib/ideas";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { FallbackImg } from "../FallbackImg";
import { DayButton } from "./DayPicker";
import { IdeaGlyph } from "./IdeaIcons";

/** Its title is edited where it stands (spec 0.33 §3); its day is the chip. */
export function IdeaRow(props: { item: Item; plan: Pick<Plan, "range" | "stayBlocks">; domId?: string }) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <IdeaRowFace {...props} />
    </InlineEdit>
  );
}

function IdeaRowFace({ item, plan, domId }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks">; domId?: string }) {
  const env = useCardEnv();
  const done = Boolean(item.doneAt);
  const line = todoLine(item);
  const sub = [item.city, ideaSource(item), line.text].filter(Boolean).join(" · ");
  const thumb = ideaThumb(item);
  const icon = <IdeaGlyph name={ideaIcon(item)} />;
  return (
    <li id={domId} className={`fk-row${done ? " done" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button type="button" className="fk-check" role="checkbox" aria-checked={done}
        aria-label={done ? L(`${item.name}: yapılmadı`, `${item.name}: not done`) : L(`${item.name}: yapıldı`, `${item.name}: done`)}
        onClick={() => void setDone(item, !done)}>
        {done && <IdeaGlyph name="check" size={13} />}
      </button>
      {thumb ? (
        <span className="fk-ic fk-thumb">
          <FallbackImg className="fk-thumb-img" src={thumb} fallback={icon} />
        </span>
      ) : (
        <span className="fk-ic">{icon}</span>
      )}
      <span className="fk-t">
        <b>
          <Editable field="name">{item.name}</Editable>
        </b>
        {(sub || line.promote) && (
          <span>
            {sub}
            {line.promote && (
              <>
                {" · "}
                <button type="button" className="fk-promote" onClick={() => void moveToBookings(item)}>
                  {L("Etkinliklere taşı", "Move to activities")}
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
