// A thing to do there on the Plan's Yapılacak şeyler (0.35.2): an idea, not a booking, so no tick. The same
// card as a restaurant: a 200×124 picture (the saved page's photo, else the idea's icon on a soft tile), its
// name (edited where it stands; two lines at most, so a long one never breaks the row), its city and where it
// came from, then "+ Güne ekle" or its day chip, the map, and its page (or a web search when it has none). One
// whose words say an entry ticket offers "Etkinliklere taşı". × on hover deletes it with "Geri al".
import { L } from "../../lib/i18n";
import { ideaIcon, ideaSource, moveToBookings, todoLine, type IdeaIcon } from "../../lib/ideas";
import { placeMapUrl } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { FallbackImg } from "../FallbackImg";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { DayButton } from "./DayPicker";
import { IdeaGlyph } from "./IdeaIcons";

/** The idea's colour by what it is (its icon): a sight, a view, a walk, shopping, a read, a taste, anything else. */
const TINT: Record<IdeaIcon, string> = { camera: "#3b6fd1", sun: "#d29a00", route: "#23998b", bag: "#c0256b", book: "#6a4fe0", food: "#b4532a", star: "#5d8a1c" };

/** A web search for it, in its city: where to find its own page. */
const searchUrl = (item: Item) => `https://www.google.com/search?q=${encodeURIComponent([item.name, item.city].filter(Boolean).join(" "))}`;

/** Its name is edited where it stands (spec 0.33 §3); its day is the chip. */
export function IdeaCard(props: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <IdeaCardFace {...props} />
    </InlineEdit>
  );
}

function IdeaCardFace({ item, plan }: { item: Item; plan: Pick<Plan, "range" | "stayBlocks"> }) {
  const env = useCardEnv();
  const icon = ideaIcon(item);
  const tile = (
    <span className="fk-ph-ic" style={{ color: TINT[icon], background: `color-mix(in srgb, ${TINT[icon]} 11%, #fff)` }}>
      <IdeaGlyph name={icon} size={34} />
    </span>
  );
  const sub = [item.city, ideaSource(item)].filter(Boolean).join(" · ");
  const promote = todoLine(item).promote;
  return (
    <div className="fk-eat fk-idea" aria-label={item.name} data-item-id={item.id} title={item.summary ?? undefined}>
      <div className="fk-ph">
        {item.imageUrl ? <FallbackImg className="fk-img" src={item.imageUrl} fallback={tile} /> : tile}
        <DeleteX name={item.name} onDelete={() => env.remove(item)} />
      </div>
      <b title={item.name}>
        <Editable field="name">{item.name}</Editable>
      </b>
      <span className="fk-sub">{sub || " "}</span>
      {promote && (
        <button type="button" className="fk-promote" onClick={() => void moveToBookings(item)}>
          {L("Bilet gerekiyor · Etkinliklere taşı", "Needs a ticket · Move to activities")}
        </button>
      )}
      <div className="fk-act">
        <DayButton item={item} plan={plan} />
        <a className="fk-map" href={placeMapUrl(item)} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open in Maps")} aria-label={L(`${item.name}: haritada aç`, `${item.name}: open in Maps`)}>
          <IdeaGlyph name="pin" size={14} />
        </a>
        {item.url ? (
          <a className="fk-map" href={item.url} target="_blank" rel="noreferrer" title={L("Kaynağını aç", "Open its page")} aria-label={L(`${item.name}: kaynağını aç`, `${item.name}: open its page`)}>
            <IdeaGlyph name="link" size={14} />
          </a>
        ) : (
          <a className="fk-map" href={searchUrl(item)} target="_blank" rel="noreferrer" title={L("Web'de ara: kendi sayfasını bul", "Search the web for its page")} aria-label={L(`${item.name}: web'de ara`, `${item.name}: search the web`)}>
            <IdeaGlyph name="search" size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
