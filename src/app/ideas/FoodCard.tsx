// A restaurant idea (fikirler-v1 .eat): a 196×120 picture (the saved page's photo, else the food icon on a
// soft tile; no Google Places), its name, what it is and its rating, "+ Güne ekle" or its day chip, and
// the map. × on hover deletes it with "Geri al".
import { L } from "../../lib/i18n";
import { foodLine } from "../../lib/ideas";
import { placeMapUrl } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
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
      <div className="fk-act">
        <DayButton item={item} plan={plan} />
        <a className="fk-map" href={placeMapUrl(item)} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open in Maps")} aria-label={L(`${item.name}: haritada aç`, `${item.name}: open in Maps`)}>
          <IdeaGlyph name="pin" size={14} />
        </a>
      </div>
    </div>
  );
}
