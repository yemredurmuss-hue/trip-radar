// The chips under the strip (v82, C25, D9): the country, the weather, the money, the plug, the time, the language and
// the visa, each saying more on hover or focus (the board's TripFacts, lib/heroStrip.ts factChips). The weather is read
// city by city for each city's own days (useWeather) and shown as one range.
import type { Sky } from "../../lib/climate";
import type { FactChip } from "../../lib/heroStrip";
import { TipOn } from "../HoverTip";
import { HeroIcon } from "../Icons";
import { XIcon, type XIconName } from "./icons";

const ICON: Record<Exclude<FactChip["key"], "weather">, XIconName> = { country: "pin", money: "coin", plug: "plug", time: "clock", lang: "chat", visa: "check" };

export function FactChips({ chips, sky }: { chips: FactChip[]; sky: Sky | null }) {
  if (!chips.length) return null;
  return (
    <div className="x-chips" data-pit-children>
      {chips.map((c, n) => {
        const icon = c.key === "weather" ? <HeroIcon name={sky ?? "sun"} size={15} /> : <XIcon name={c.key === "visa" && c.tone === "warn" ? "alert" : ICON[c.key]} size={15} />;
        const cls = `x-chip c-${c.key}${c.tone ? ` ${c.tone}` : ""}`;
        return (
          <TipOn key={c.key} tip={c.tip} below align={n >= 4 ? "right" : "left"}>
            {(bind) => (
              <span {...bind} className={cls} tabIndex={c.tip ? 0 : undefined}>
                {icon}
                {c.text}
              </span>
            )}
          </TipOn>
        );
      })}
    </div>
  );
}
