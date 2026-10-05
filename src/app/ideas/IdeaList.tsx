// Yapılacak şeyler and Restoranlar as a pool of ideas (fikir havuzu v1, lib/ideaList): the tabs on top (Hepsi ·
// Havuzda · Günü var · Kaçtı during the trip · Yapıldı, each with its count) and the kinds there are as chips,
// both filters; then the groups — during the trip "Bugün · 10 Eki", "Kaçtı", the cities (tonight's first), done
// last; before it the cities in the trip's order. İlham (InspoGrid): what was saved to look at, tiles with the
// picture, the platform, the title and the city; put on a day it becomes a thing to do.
import { useState, type ReactNode } from "react";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { kindLabel, kindsFor, type IdeaKind } from "../../lib/ideaKinds";
import { ideaGroups, ideaRows, ideaTabs, isDuringTrip, kindCounts, type IdeaGroup, type IdeaTab } from "../../lib/ideaList";
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

const TAB_LABEL: Record<IdeaTab, [string, string]> = {
  all: ["Hepsi", "All"],
  pool: ["Havuzda", "In the pool"],
  day: ["Günü var", "On a day"],
  missed: ["Kaçtı", "Missed"],
  done: ["Yapıldı", "Done"],
};

export function IdeaList({ section, plan, today, fallback }: {
  section: CatSection;
  plan: Pick<Plan, "range" | "stayBlocks">;
  today: string;
  /** A block the list can't draw as a row (a group of options): its own card. */
  fallback: (entry: CatEntry) => ReactNode;
}) {
  const [tab, setTab] = useState<IdeaTab>("all");
  const [kind, setKind] = useState<IdeaKind | null>(null);
  const food = section.id === "food";
  const during = isDuringTrip(plan, today);
  const rows = ideaRows(section.entries, today);
  const tabs = ideaTabs(rows, plan, today);
  // The chips count what the tab shows; a kind no longer there lets go.
  const inTab = rows.filter((r) => tab === "all" || (r.status === "missed" && !during ? "pool" : r.status) === tab);
  const kinds = kindCounts(inTab, kindsFor(food));
  const activeKind = kind && kinds.some((k) => k.kind === kind) ? kind : null;
  const activeTab = tabs.some((t) => t.tab === tab) ? tab : "all";
  const groups = ideaGroups(section.entries, plan, today, { tab: activeTab, kind: activeKind });
  return (
    <div className="il-list">
      <div className="il-tabs" role="tablist" aria-label={L("Durum", "Status")}>
        {tabs.map((t) => (
          <button key={t.tab} type="button" role="tab" aria-selected={activeTab === t.tab} className={`${activeTab === t.tab ? "on" : ""}${t.tab === "missed" && t.count ? " warn" : ""}`} onClick={() => setTab(t.tab)}>
            {t.tab === "missed" && t.count > 0 && <i className="dot" aria-hidden />}
            {L(...TAB_LABEL[t.tab])} <b>{t.count}</b>
          </button>
        ))}
      </div>
      {kinds.length > 0 && (
        <div className="il-chips" aria-label={L("Tür", "Kind")}>
          <button type="button" className={activeKind ? "" : "on"} aria-pressed={!activeKind} onClick={() => setKind(null)}>
            {L("Hepsi", "All")}
          </button>
          {kinds.map((k) => (
            <button key={k.kind} type="button" className={activeKind === k.kind ? "on" : ""} aria-pressed={activeKind === k.kind} onClick={() => setKind(activeKind === k.kind ? null : k.kind)}>
              {kindLabel(k.kind)} <i>{k.count}</i>
            </button>
          ))}
        </div>
      )}
      {groups.length === 0 && <p className="il-none">{L("Burada fikir yok.", "No ideas here.")}</p>}
      {groups.map((g) => (
        <div key={g.key} className={`il-group ${g.kind}`} data-group={g.kind === "city" ? (g.city ?? "") : g.kind}>
          <div className="il-head">
            <GroupTitle group={g} today={today} />
            {g.here && <span className="il-here">{L("buradasın", "you're here")}</span>}
            <i>{g.rows.length}</i>
          </div>
          {g.rows.map((r) => (
            <div key={r.entry.key} id={entryDomId(catDomKey(r.entry))} className="il-wrap">
              {r.item ? <IdeaLine item={r.item} plan={plan} status={r.status} returned={r.status === "missed" && during ? null : r.returned} today={today} during={during} /> : fallback(r.entry)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "Bugün · 10 Eki Porto", "Kaçtı güne konmuştu, yapılmadı", "Porto · 1 tanesi günde", "Yapıldı". */
function GroupTitle({ group, today }: { group: IdeaGroup; today: string }) {
  switch (group.kind) {
    case "today":
      return (
        <>
          <b>{L(`Bugün · ${shortDay(today)}`, `Today · ${shortDay(today)}`)}</b>
          {group.city && <span className="il-hint">{group.city}</span>}
        </>
      );
    case "missed":
      return (
        <>
          <b>{L("Kaçtı", "Missed")}</b>
          <span className="il-hint">{L("güne konmuştu, yapılmadı", "was on a day, not done")}</span>
        </>
      );
    case "done":
      return <b>{L("Yapıldı", "Done")}</b>;
    case "city": {
      const onDay = group.rows.filter((r) => r.status === "day").length;
      return (
        <>
          <b>{group.city ?? L("Şehri belli değil", "No city")}</b>
          {onDay > 0 && onDay < group.rows.length && <span className="il-hint">{L(`${onDay} tanesi günde`, `${onDay} on a day`)}</span>}
        </>
      );
    }
  }
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
