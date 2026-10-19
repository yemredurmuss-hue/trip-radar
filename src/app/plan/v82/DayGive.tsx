// "Gün ver ›" on a place on the plan (plan v82 aşama 4; the live day picker, ideas/DayPicker): the trip's days, each with
// the city slept in that night, a restaurant's meal above them, and "Günden çıkar" once it has one. The button shows its
// day when it has one ("8 Eki akşam ›"). The window opens over the page (KMenu's popover): Escape closes it, the focus goes
// back to the button.
import { useEffect, useRef, useState } from "react";
import { L } from "../../../lib/i18n";
import { dayChip, dayChoices, isFoodIdea, MEAL_SLOTS, mealLabel, setIdeaDay } from "../../../lib/ideas";
import { isoDate } from "../../../lib/items";
import type { Plan } from "../../../lib/plan";
import type { Item, MealSlot } from "../../../lib/types";
import { Popover, usePopover } from "./KMenu";

export function DayGive({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useRef(() => setOpen(false)).current;
  const style = usePopover(open, close, button, pop);
  const food = isFoodIdea(item);
  const [meal, setMeal] = useState<MealSlot>(item.meal ?? "dinner");
  const days = dayChoices(plan);
  const chip = dayChip(item);
  const current = isoDate(item.dates.start);
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>("li button.on, li button")?.focus();
  }, [open]);
  // No days for the trip yet: nothing to pick from.
  if (!days.length && !chip) return null;
  const pick = (date: string | null) => {
    setOpen(false);
    button.current?.focus();
    void setIdeaDay(item, date, food && date ? meal : null);
  };
  return (
    <>
      <button ref={button} type="button" className={`q-day${chip ? " set" : ""}`} aria-haspopup="dialog" aria-expanded={open}
        aria-label={chip ? L(`${item.name}: günü ${chip}, değiştir`, `${item.name}: on ${chip}, change`) : L(`${item.name}: gün ver`, `${item.name}: give it a day`)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}>
        {chip ?? L("Gün ver", "Give a day")} ›
      </button>
      <Popover open={open}>
        <div className="z-mpop z-kpop z-days" role="dialog" aria-label={L("Hangi gün?", "Which day?")} ref={pop} style={style}>
          {food && (
            <div className="z-meals" role="radiogroup" aria-label={L("Öğün", "Meal")}>
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
                <button type="button" className={d.date === current ? "on" : undefined} aria-current={d.date === current || undefined} onClick={() => pick(d.date)}>
                  <b>{d.label}</b>
                  {d.city && <span>{d.city}</span>}
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <button type="button" className="z-mi bad z-unday" onClick={() => pick(null)}>
              {L("Günden çıkar", "Take off its day")}
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
