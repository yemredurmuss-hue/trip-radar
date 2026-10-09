// Hazırlık (spec 0.34.6 §3; its own section since v11): the chores before the trip — buy, apply, print, pack,
// change money — a quiet tick list, what's done staying in its place ("Hazırları gizle" folds it away), one short row each: the tick, the title (edited in place), "Yapıldı ·
// 12 Eki" once done, × on hover (deleted with "Geri al"). No day chip: a chore is done or not.
import { useState } from "react";
import { catDomKey, type CatEntry } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { doneText, setDone, setPrep } from "../../lib/ideas";
import { amazonLink } from "../../lib/prepBuy";
import { entryDomId } from "../../lib/progress";
import type { Item } from "../../lib/types";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { IdeaGlyph } from "../ideas/IdeaIcons";

const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);

export function PrepList({ entries }: { entries: CatEntry[] }) {
  const env = useCardEnv();
  const [hideDone, setHideDone] = useState(false);
  const done = entries.filter((e) => e.state === "done").length;
  const shown = hideDone ? entries.filter((e) => e.state !== "done") : entries;
  return (
    <div className="prep" aria-label={L("Hazırlık", "Prep")}>
      <p className="prep-head">
        <span>{L(`${done}/${entries.length} hazır`, `${done}/${entries.length} ready`)}</span>
        <small className="prep-why">{L("· gezine göre önerildi, sohbette “şunu da ekle” diyebilirsin", "· suggested for this trip; say “add this too” in the chat")}</small>
        <i className="prep-sp" />
        {done > 0 && (
          <button type="button" className="prep-hide" aria-pressed={hideDone} onClick={() => setHideDone(!hideDone)}>
            {hideDone ? L("Hazırları göster", "Show the ready ones") : L("Hazırları gizle", "Hide the ready ones")}
          </button>
        )}
        {env.ask && (
          <button type="button" className="ac-more prep-more" onClick={() => env.ask!(L("Bu gezi için hazırlık listesine eklenecek birkaç şey daha öner (alınacaklar, yapılacak başvurular, yanına alınacaklar).", "Suggest a few more things for this trip's prep list (things to buy, to apply for, to pack)."))}>
            ✨ {L("Daha fazla öner", "Suggest more")}
          </button>
        )}
      </p>
      <ul className="prep-rows">
        {shown.map((e) => {
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
  const buy = done ? null : amazonLink(item.name);
  return (
    <li id={domId} className={`prep-row${done ? " done" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button type="button" className="prep-check" role="checkbox" aria-checked={done}
        aria-label={done ? L(`${item.name}: yapılmadı`, `${item.name}: not done`) : L(`${item.name}: yapıldı`, `${item.name}: done`)}
        onClick={() => void setDone(item, !done)}>
        {done && <IdeaGlyph name="check" size={11} />}
      </button>
      <span className="prep-t">
        <Editable field="name">{item.name}</Editable>
        {item.summary && <small className="prep-sub">{item.summary}</small>}
      </span>
      {done && <span className="prep-done" title={doneText(item) ?? undefined}>{L("Hazır", "Ready")}</span>}
      {buy && (
        <a className="prep-buy" href={buy} target="_blank" rel="noreferrer" title={L("Amazon'da ara", "Search on Amazon")}>
          Amazon ↗
        </a>
      )}
      {/* Not a chore after all ("şemsiye al" to buy there): one tap moves it to Yapılacak şeyler. */}
      <button type="button" className="prep-move" title={L("Gidilen yerde yapılacak: Yapılacak şeyler'e taşı", "Done there: move to Things to do")}
        aria-label={L(`${item.name}: Yapılacak şeyler'e taşı`, `${item.name}: move to Things to do`)} onClick={() => void setPrep(item, false)}>
        {L("Orada yapılacak", "Done there")}
      </button>
      <DeleteX name={item.name} onDelete={() => env.remove(item)} />
    </li>
  );
}
