// A record card's top-line day, editable where it stands (spec 0.33 §3): the day ("Tarih ekle" when
// there's none); a rental's start and end; an activity's or a table's day and hour.
import { RENTAL_MODES, type CardKind } from "../../lib/cardKinds";
import { topDate } from "../../lib/cardView";
import { formatDateRange, isoDate } from "../../lib/items";
import { L } from "../../lib/i18n";
import { clockOf } from "../../lib/legs";
import type { Item } from "../../lib/types";
import { Editable, useInlineEdit } from "./InlineEdit";

const day = (d: string | null) => (d ? formatDateRange(d, null) : null);

export function CardDate({ item, kind }: { item: Item; kind: CardKind }) {
  const fields = useInlineEdit()?.fields ?? [];
  const start = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  if (fields.includes("end") && (RENTAL_MODES as readonly string[]).includes(kind)) {
    return (
      <>
        <Editable field="date">{day(start)}</Editable> – <Editable field="end">{day(isoDate(item.dates.end))}</Editable>
      </>
    );
  }
  if (fields.includes("time") && (kind === "activity" || kind === "food")) {
    return (
      <>
        <Editable field="date">{day(start)}</Editable> · <Editable field="time">{clockOf(item.flight?.departure)}</Editable>
      </>
    );
  }
  // An eSIM or a policy with no days of its own is for the whole trip: said so, not "Tarih ekle" (a day can still
  // be given from its form).
  if ((kind === "esim" || kind === "insurance") && !start) return <>{L("Tüm gezi", "Whole trip")}</>;
  return <Editable field="date">{topDate(item, kind)}</Editable>;
}
