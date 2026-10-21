// An open v82 category's inside (plan v82 "açık kategoride durum çizgisi"): its intents one under another on a vertical
// rail, each one's dot its state's colour (CSS, `data-st`); first the category's short note when the trip's form changed
// something there (spec §1.4, CategoryInfo: only when said), then what is being read into it and its warnings, then the
// visa (Belgeler ve internet), the intents, and last its "Gizlenenler · n".
import type { ReactNode } from "react";
import { L } from "../../../lib/i18n";

/** The one-line note at a category's start (q-tinfo): drawn only with something to say. */
export function CategoryInfo({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p className="q-tinfo">
      <i aria-hidden>i</i>
      <span>{text}</span>
    </p>
  );
}

export function TimelineRail({ info, lead, children, hidden }: {
  info?: string | null;
  /** Before the intents and off the rail's dots: a link being read, a warning. */
  lead?: ReactNode;
  children: ReactNode;
  /** "Gizlenenler · n", at the end. */
  hidden?: ReactNode;
}) {
  return (
    <div className="q-ints">
      <CategoryInfo text={info} />
      {lead}
      {children}
      {/* The route notes' heading (plan v13, K85): drawn only when the category has one (CSS :has, card13.css). */}
      <p className="z-nh">
        <b>{L("Yol notları", "Route notes")}</b>
        <span>{L("Rezervasyon gerekmez · aracı değiştirmek için dokun", "Nothing to book · tap to change the way")}</span>
      </p>
      {hidden}
    </div>
  );
}
