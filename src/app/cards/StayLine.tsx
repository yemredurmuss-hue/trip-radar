// A stay's city and nights on its card, editable where they stand (spec 0.33 §3): "Porto · 8 Ekim – 11 Ekim",
// faint "Şehir ekle" / "Giriş ekle" / "Çıkış ekle" when missing. Outside InlineEdit, plain text.
import { formatDateRange, isoDate } from "../../lib/items";
import type { Item } from "../../lib/types";
import { Editable } from "./InlineEdit";

const day = (d: string | null) => (d ? formatDateRange(d, null) : null);

export function StayLine({ item }: { item: Item }) {
  return (
    <>
      <Editable field="city">{item.city}</Editable> · <Editable field="date">{day(isoDate(item.dates.start))}</Editable> –{" "}
      <Editable field="end">{day(isoDate(item.dates.end))}</Editable>
    </>
  );
}
