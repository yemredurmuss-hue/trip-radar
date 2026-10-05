// A restaurant on the Plan's Restoranlar (kategoriler spec, fikirler-v1 .eat): a 200×124 picture (the saved
// page's photo, else the food icon on a soft tile; no Google Places), its name (edited where it stands), what
// it is and its rating as far as the page said, its city, "+ Güne ekle" or its day chip, and the map. One that
// takes a reservation says where that stands ("Rezerve et" / "✓ Rezerve"). × on hover deletes it with "Geri al".
import { needsBooking } from "../../lib/booking";
import { L } from "../../lib/i18n";
import { foodLine } from "../../lib/ideas";
import { placeMapUrl } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { setItemStatus } from "../actions";
import { FallbackImg } from "../FallbackImg";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { KindIcon } from "../cards/Silhouettes";
import { DayButton } from "./DayPicker";
import { IdeaGlyph } from "./IdeaIcons";

/** Its name is edited where it stands (spec 0.33 §3); its day is the chip. */
export function FoodCard(props: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <FoodCardFace {...props} />
    </InlineEdit>
  );
}

function FoodCardFace({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const env = useCardEnv();
  const line = foodLine(item);
  const booked = item.status === "booked";
  return (
    <div className="fk-eat" aria-label={item.name} data-item-id={item.id}>
      <div className="fk-ph">
        <FallbackImg className="fk-img" src={item.imageUrl} fallback={<span className="fk-ph-ic"><KindIcon kind="food" size={34} /></span>} />
        <DeleteX name={item.name} onDelete={() => env.remove(item)} />
      </div>
      <b>
        <Editable field="name">{item.name}</Editable>
      </b>
      {line && <span>{line}</span>}
      {item.city && <span className="fk-where">{item.city}</span>}
      {needsBooking(item) && (
        <button type="button" className={`fk-book${booked ? " done" : ""}`}
          title={booked ? L("Rezervasyonu geri al", "Mark as not booked") : L("Rezervasyonu yaptım", "I booked it")}
          onClick={() => void setItemStatus(item, booked ? "chosen" : "booked")}>
          {booked ? L("✓ Rezerve", "✓ Booked") : L("Rezerve et", "Book a table")}
        </button>
      )}
      <div className="fk-act">
        <DayButton item={item} plan={plan} />
        <a className="fk-map" href={placeMapUrl(item)} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open in Maps")} aria-label={L(`${item.name}: haritada aç`, `${item.name}: open in Maps`)}>
          <IdeaGlyph name="pin" size={14} />
        </a>
      </div>
    </div>
  );
}
