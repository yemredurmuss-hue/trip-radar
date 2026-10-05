// "+ Güne ekle" and the day chip (fikirler-v1 .day / .day.set): a small window listing the trip's days
// (with the city slept in), a restaurant's meals above them; the chip opens it again to change or take
// it off its day.
import { useEffect, useState } from "react";
import { L } from "../../lib/i18n";
import { dayChip, dayChoices, isFoodIdea, MEAL_SLOTS, mealLabel, setIdeaDay } from "../../lib/ideas";
import { isoDate } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item, MealSlot } from "../../lib/types";

export function DayButton({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const [open, setOpen] = useState(false);
  const chip = dayChip(item);
  const days = dayChoices(plan);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  // No dates for the trip yet: nothing to pick from.
  if (!days.length && !chip) return null;
  return (
    <span className="fk-daywrap">
      <button type="button" className={`fk-day${chip ? " set" : ""}`} aria-haspopup="dialog" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {chip ?? L("+ Güne ekle", "+ Add to a day")}
      </button>
      {open && <DayPicker item={item} days={days} onDone={() => setOpen(false)} />}
    </span>
  );
}

function DayPicker({ item, days, onDone }: { item: Item; days: ReturnType<typeof dayChoices>; onDone: () => void }) {
  const food = isFoodIdea(item);
  const [meal, setMeal] = useState<MealSlot>(item.meal ?? "dinner");
  const current = isoDate(item.dates.start);
  const pick = (date: string | null) => {
    onDone();
    void setIdeaDay(item, date, food && date ? meal : null);
  };
  return (
    <div className="fk-picker" role="dialog" aria-label={L("Hangi gün?", "Which day?")} onClick={(e) => e.stopPropagation()}>
      {food && (
        <div className="fk-meals" role="radiogroup" aria-label={L("Öğün", "Meal")}>
          {MEAL_SLOTS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={meal === m} className={meal === m ? "on" : undefined} onClick={() => setMeal(m)}>
              {mealLabel(m)}
            </button>
          ))}
        </div>
      )}
      <ul>
        {days.map((d) => (
          <li key={d.date}>
            <button type="button" className={d.date === current ? "on" : undefined} onClick={() => pick(d.date)}>
              <b>{d.label}</b>
              {d.city && <span>{d.city}</span>}
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <button type="button" className="fk-unday" onClick={() => pick(null)}>
          {L("Günden çıkar", "Take off its day")}
        </button>
      )}
    </div>
  );
}
