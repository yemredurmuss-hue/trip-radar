// Diğer's "Hazırlık" (spec 0.34.6 §3): the chores before the trip — buy, apply, print, pack, change money —
// a quiet tick list at the section's end, one short row each: the tick, the title (edited in place), "Yapıldı ·
// 12 Eki" once done, × on hover (deleted with "Geri al"). No day chip: a chore is done or not.
import { catDomKey, type CatEntry } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { doneText, setDone } from "../../lib/ideas";
import { entryDomId } from "../../lib/progress";
import type { Item } from "../../lib/types";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { IdeaGlyph } from "../ideas/IdeaIcons";

const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);

export function PrepList({ entries }: { entries: CatEntry[] }) {
  const open = entries.filter((e) => e.state !== "done").length;
  return (
    <div className="prep" aria-label={L("Hazırlık", "Prep")}>
      <p className="prep-head">
        {L("Hazırlık", "Prep")}
        <span>{open ? L(`${open} iş kaldı`, `${open} left`) : L("hepsi tamam", "all done")}</span>
      </p>
      <ul className="prep-rows">
        {entries.map((e) => {
          const item = recordOf(e);
          return item ? (
            <InlineEdit key={e.key} item={item} only={["name"]}>
              <PrepRow item={item} domId={entryDomId(catDomKey(e))} />
            </InlineEdit>
          ) : null;
        })}
      </ul>
    </div>
  );
}

function PrepRow({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const done = Boolean(item.doneAt);
  return (
    <li id={domId} className={`prep-row${done ? " done" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button type="button" className="prep-check" role="checkbox" aria-checked={done}
        aria-label={done ? L(`${item.name}: yapılmadı`, `${item.name}: not done`) : L(`${item.name}: yapıldı`, `${item.name}: done`)}
        onClick={() => void setDone(item, !done)}>
        {done && <IdeaGlyph name="check" size={11} />}
      </button>
      <span className="prep-t">
        <Editable field="name">{item.name}</Editable>
      </span>
      {done && <span className="prep-done">{doneText(item)}</span>}
      <DeleteX name={item.name} onDelete={() => env.remove(item)} />
    </li>
  );
}
