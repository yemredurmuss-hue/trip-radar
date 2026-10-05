// Yapılacak şeyler and Restoranlar as a list by city (0.35.3, lib/ideaList): during the trip "Bugün · 9 Eki"
// first, then where you sleep tonight, then the other cities; what's on a day first in each; done ones folded
// at the end. İlham (InspoGrid): what was saved to look at, tiles with the picture, the platform, the title
// and the city; put on a day it becomes a thing to do.
import type { ReactNode } from "react";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { ideaGroups, type IdeaGroup } from "../../lib/ideaList";
import { shortDay } from "../../lib/ideas";
import { INSPO_LABEL, inspoPlatform } from "../../lib/inspo";
import type { Plan } from "../../lib/plan";
import { entryDomId } from "../../lib/progress";
import type { Item } from "../../lib/types";
import { FallbackImg } from "../FallbackImg";
import { DeleteX } from "../cards/CardShell";
import { useCardEnv } from "../cards/PlanCard";
import { KindIcon } from "../cards/Silhouettes";
import { DayButton } from "./DayPicker";
import { IdeaLine } from "./IdeaLine";

export function IdeaList({ section, plan, today, fallback }: {
  section: CatSection;
  plan: Pick<Plan, "range" | "stayBlocks">;
  today: string;
  /** A block the list can't draw as a row (a group of options): its own card. */
  fallback: (entry: CatEntry) => ReactNode;
}) {
  const groups = ideaGroups(section.entries, plan, today);
  const food = section.id === "food";
  return (
    <div className="il-list">
      {groups.map((g) =>
        g.kind === "done" ? (
          <details key={g.key} className="il-group il-donegroup">
            <summary>
              {food ? L("Gidilenler", "Been there") : L("Yapılanlar", "Done")} <i>{g.rows.length}</i>
            </summary>
            <Rows group={g} plan={plan} fallback={fallback} />
          </details>
        ) : (
          <div key={g.key} className={`il-group${g.kind === "today" ? " today" : ""}`} data-group={g.kind === "today" ? "today" : g.city ?? ""}>
            <div className="il-head">
              <b>{g.kind === "today" ? L(`Bugün · ${shortDay(today)}`, `Today · ${shortDay(today)}`) : g.city ?? L("Şehri belli değil", "No city")}</b>
              {g.here && <span className="il-here">{L("buradasın", "you're here")}</span>}
              <i>{g.rows.length}</i>
            </div>
            <Rows group={g} plan={plan} fallback={fallback} />
          </div>
        ),
      )}
    </div>
  );
}

function Rows({ group, plan, fallback }: { group: IdeaGroup; plan: Pick<Plan, "range" | "stayBlocks">; fallback: (entry: CatEntry) => ReactNode }) {
  return (
    <>
      {group.rows.map((r) => (
        <div key={r.entry.key} id={entryDomId(catDomKey(r.entry))} className="il-wrap">
          {r.item ? <IdeaLine item={r.item} plan={plan} returned={r.returned} showCity={group.kind !== "city"} /> : fallback(r.entry)}
        </div>
      ))}
    </>
  );
}

/** İlham: the saved Reels, pins, videos and blogs as tiles, newest first. */
export function InspoGrid({ section, plan }: { section: CatSection; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const items = section.entries
    .map((e) => ({ e, item: e.piece.kind === "item" ? e.piece.item : null }))
    .filter((x): x is { e: CatEntry; item: Item } => x.item != null)
    .sort((a, b) => b.item.createdAt - a.item.createdAt);
  return (
    <>
      <p className="prep-sub">{L("Kaydettiğin Reels, Pinterest, TikTok, YouTube ve bloglar. Bir güne koyunca Yapılacak şeyler'e geçer.", "Your saved Reels, pins, TikToks, videos and blogs. Put one on a day and it moves to Things to do.")}</p>
      <div className="ins-grid">
        {items.map(({ e, item }) => (
          <div key={e.key} id={entryDomId(catDomKey(e))}>
            <InspoTile item={item} plan={plan} />
          </div>
        ))}
      </div>
    </>
  );
}

function InspoTile({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const env = useCardEnv();
  const platform = inspoPlatform(item.url);
  const tile = (
    <span className="ins-ph-ic">
      <KindIcon kind="inspo" size={30} />
    </span>
  );
  return (
    <div className="ins-tile" aria-label={item.name} data-item-id={item.id}>
      <a className="ins-ph" href={item.url ?? undefined} target="_blank" rel="noreferrer" title={L("Kaynağını aç", "Open it")}>
        <FallbackImg className="ins-img" src={item.imageUrl} fallback={tile} />
        {platform && <span className={`ins-badge p-${platform}`}>{INSPO_LABEL[platform]}</span>}
      </a>
      <DeleteX name={item.name} onDelete={() => env.remove(item)} className="ins-x" />
      <b title={item.name}>{item.name}</b>
      <span className="ins-city">{item.city ?? " "}</span>
      <DayButton item={item} plan={plan} />
    </div>
  );
}
