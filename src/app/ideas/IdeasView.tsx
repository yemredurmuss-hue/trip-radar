// The Fikirler tab (docs/mockups/2026-10-05-fikirler-v1.html): restaurants, activities that need no booking,
// to-dos and notes, city by city. A quick line to add one; filters Hepsi · Yeme-içme · Yapılacaklar;
// restaurants as small picture cards in a row, the rest as a checklist. Lighter than the Plan's cards:
// white, small, a list.
import { useState } from "react";
import { L } from "../../lib/i18n";
import { groupIdeas, type IdeaFilter } from "../../lib/ideas";
import { formatDateRange } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { FoodCard } from "./FoodCard";
import { IdeaRow } from "./IdeaRow";
import { QuickAdd } from "./QuickAdd";

const FILTERS = (): { key: IdeaFilter; label: string }[] => [
  { key: "all", label: L("Hepsi", "All") },
  { key: "food", label: L("Yeme-içme", "Food & drink") },
  { key: "todo", label: L("Yapılacaklar", "To-dos") },
];

export function IdeasView({ tripId, items, plan, cities }: { tripId: string; items: Item[]; plan: Plan; cities: string[] }) {
  const [filter, setFilter] = useState<IdeaFilter>("all");
  const groups = groupIdeas(items, plan, filter);
  return (
    <section className="fk" aria-label={L("Fikirler", "Ideas")}>
      <div className="fk-sec">
        <b>{L("Fikirler ve yapılacaklar", "Ideas and to-dos")}</b>
        <span>{L("rezervasyon gerekmez", "no booking needed")}</span>
      </div>
      <p className="fk-sub">{L("Aklına geleni yaz; istersen bir güne ekle, o zaman günlük akışta görünür.", "Write whatever comes to mind; put it on a day and it shows in the day-by-day view.")}</p>
      <QuickAdd tripId={tripId} cities={cities} />
      <div className="fk-filters" role="group" aria-label={L("Göster", "Show")}>
        {FILTERS().map((f) => (
          <button key={f.key} type="button" className={filter === f.key ? "on" : undefined} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="fk-empty">{L("Henüz bir şey yok. Yukarıya yaz ya da bir restoran sayfası kaydet.", "Nothing yet. Write above, or save a restaurant's page.")}</p>}
      {groups.map((g) => (
        <div key={g.key} className="fk-city-block">
          <div className="fk-city">
            <b>{g.city ?? L("Şehri belli değil", "No city yet")}</b>
            {g.range && <span>{formatDateRange(g.range.start, g.range.end)}</span>}
          </div>
          {g.food.length > 0 && (
            <>
              <p className="fk-label">{L("Yeme-içme", "Food & drink")}</p>
              <div className="fk-eats">
                {g.food.map((i) => (
                  <FoodCard key={i.id} item={i} plan={plan} />
                ))}
              </div>
            </>
          )}
          {g.todos.length > 0 && (
            <>
              {g.food.length > 0 && <p className="fk-label">{L("Yapılacaklar", "To-dos")}</p>}
              <ul className="fk-todo">
                {g.todos.map((i) => (
                  <IdeaRow key={i.id} item={i} plan={plan} />
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
