// The chips under the strip (v82, C25, D9): the country, the weather, the money, the plug, the time, the language and
// the visa, each saying more on hover or focus (the board's TripFacts, lib/heroStrip.ts factChips). The weather is read
// city by city for each city's own days (useWeather) and shown as one range. A trip of several countries says "n ülke",
// and its tip is a row for each country: its money, its clock, its plug, its visa. Beside the visa, in the same amber, the
// bookings in their last two weeks still without their file (B15: "2 belge yok"; a tap goes to the first).
import type { ReactNode } from "react";
import type { Sky } from "../../lib/climate";
import { flagEmoji } from "../../lib/heroInfo";
import { docsWords, type FactChip } from "../../lib/heroStrip";
import { TipOn } from "../HoverTip";
import { HeroIcon } from "../Icons";
import type { HeroDocs } from "./HeroStrip";
import { XIcon, type XIconName } from "./icons";

const ICON: Record<Exclude<FactChip["key"], "weather">, XIconName> = { country: "pin", money: "coin", plug: "plug", time: "clock", lang: "chat", visa: "check" };

/** D9: "n ülke"'s tip, its line and then each country on a row of its own. */
function CountryTable({ chip }: { chip: FactChip }): ReactNode {
  return (
    <span className="x-ctab">
      {chip.tip && <span className="x-ctl">{chip.tip}</span>}
      {chip.rows!.map((r) => (
        <span key={r.code} className="x-ctr">
          <b>
            {flagEmoji(r.code) && <span aria-hidden>{flagEmoji(r.code)} </span>}
            {r.name}
          </b>
          <span>{r.parts.join(" · ")}</span>
        </span>
      ))}
    </span>
  );
}

/** B15: "2 belge yok", amber as the box's own; a tap goes to the first booking without its file. */
function DocsChip({ docs }: { docs: HeroDocs }) {
  const words = docsWords(docs.count);
  return (
    <TipOn tip={words.tip} below align="right">
      {(bind) => (
        <button {...bind} type="button" className="x-chip warn c-docs" aria-label={`${words.text}: ${words.tip}`} onClick={docs.go}>
          <XIcon name="alert" size={15} />
          {words.text}
        </button>
      )}
    </TipOn>
  );
}

export function FactChips({ chips, sky, docs }: { chips: FactChip[]; sky: Sky | null; docs?: HeroDocs | null }) {
  const missing = docs && docs.count > 0 ? docs : null;
  if (!chips.length && !missing) return null;
  return (
    <div className="x-chips" data-pit-children>
      {chips.map((c, n) => {
        const icon = c.key === "weather" ? <HeroIcon name={sky ?? "sun"} size={15} /> : <XIcon name={c.key === "visa" && c.tone === "warn" ? "alert" : ICON[c.key]} size={15} />;
        const cls = `x-chip c-${c.key}${c.tone ? ` ${c.tone}` : ""}`;
        return (
          <TipOn key={c.key} tip={c.rows?.length ? <CountryTable chip={c} /> : c.tip} below align={n >= 4 ? "right" : "left"}>
            {(bind) => (
              <span {...bind} className={cls} tabIndex={c.tip ? 0 : undefined}>
                {icon}
                {c.text}
              </span>
            )}
          </TipOn>
        );
      })}
      {missing && <DocsChip docs={missing} />}
    </div>
  );
}
