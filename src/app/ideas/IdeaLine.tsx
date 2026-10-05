// One idea in the Plan's list (0.35.3): a thing to do or a restaurant in a row, not a card. A small picture
// (the saved page's photo, else the idea's icon on a soft tile), its name (edited where it stands, one line),
// one grey line (where it came from or what it is; "9 Eki için konmuştu · havuza döndü" when its day went by),
// then the day chip, the map, its page (or a web search for it), "Yaptım" (optional, one tap) and × on hover.
// A restaurant that takes a reservation says where that stands; a to-do whose words say a ticket offers
// "Etkinliklere taşı".
import { needsBooking } from "../../lib/booking";
import { L } from "../../lib/i18n";
import { foodLine, ideaIcon, ideaSource, isFoodIdea, moveToBookings, setDone, shortDay, todoLine, type IdeaIcon } from "../../lib/ideas";
import { placeMapUrl } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { setItemStatus } from "../actions";
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

export interface IdeaLineProps {
  item: Item;
  plan: Pick<Plan, "range" | "stayBlocks">;
  /** The day it was on, gone by without "Yaptım" (it's back in the pool). */
  returned?: string | null;
  /** Its city is the group's title, so it isn't repeated (the "Bugün" group says it). */
  showCity?: boolean;
}

export function IdeaLine(props: IdeaLineProps) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <IdeaLineFace {...props} />
    </InlineEdit>
  );
}

function IdeaLineFace({ item, plan, returned = null, showCity = false }: IdeaLineProps) {
  const env = useCardEnv();
  const food = isFoodIdea(item);
  const icon = food ? "food" : ideaIcon(item);
  const tile = (
    <span className="il-ic" style={{ color: TINT[icon], background: `color-mix(in srgb, ${TINT[icon]} 12%, #fff)` }}>
      <IdeaGlyph name={icon} size={17} />
    </span>
  );
  const done = !!item.doneAt;
  const said = food ? foodLine(item) : todoLine(item).text;
  const from = ideaSource(item);
  const sub = returned
    ? L(`${shortDay(returned)} için konmuştu · havuza döndü`, `Was on ${shortDay(returned)} · back in the pool`)
    : [showCity ? item.city : null, said && !done ? said : null, from].filter(Boolean).join(" · ");
  const promote = !food && !done && todoLine(item).promote;
  const booking = food && needsBooking(item);
  const booked = item.status === "booked";
  return (
    <div className={`il-row${done ? " done" : ""}${returned ? " back" : ""}`} aria-label={item.name} data-item-id={item.id} title={item.summary ?? undefined}>
      {item.imageUrl ? <FallbackImg className="il-img" src={item.imageUrl} fallback={tile} /> : tile}
      <div className="il-main">
        <b title={item.name}>
          <Editable field="name">{item.name}</Editable>
        </b>
        {sub && <span className="il-sub">{sub}</span>}
      </div>
      <div className="il-act">
        {promote && (
          <button type="button" className="il-promote" onClick={() => void moveToBookings(item)} title={L("Giriş bileti gerekiyor", "Needs an entry ticket")}>
            {L("Etkinliklere taşı", "Move to activities")}
          </button>
        )}
        {booking && (
          <button type="button" className={`il-book${booked ? " on" : ""}`}
            title={booked ? L("Rezervasyonu geri al", "Mark as not booked") : L("Rezervasyonu yaptım", "I booked it")}
            onClick={() => void setItemStatus(item, booked ? "chosen" : "booked")}>
            {booked ? L("✓ Rezerve", "✓ Booked") : L("Rezerve et", "Book a table")}
          </button>
        )}
        {!done && <DayButton item={item} plan={plan} pooled={!!returned} />}
        <a className="il-btn" href={placeMapUrl(item)} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open in Maps")} aria-label={L(`${item.name}: haritada aç`, `${item.name}: open in Maps`)}>
          <IdeaGlyph name="pin" size={14} />
        </a>
        {item.url ? (
          <a className="il-btn" href={item.url} target="_blank" rel="noreferrer" title={L("Kaynağını aç", "Open its page")} aria-label={L(`${item.name}: kaynağını aç`, `${item.name}: open its page`)}>
            <IdeaGlyph name="link" size={14} />
          </a>
        ) : (
          <a className="il-btn" href={searchUrl(item)} target="_blank" rel="noreferrer" title={L("Web'de ara: kendi sayfasını bul", "Search the web for its page")} aria-label={L(`${item.name}: web'de ara`, `${item.name}: search the web`)}>
            <IdeaGlyph name="search" size={14} />
          </a>
        )}
        <button type="button" className={`il-done${done ? " on" : ""}`} aria-pressed={done}
          title={done ? L("Yapılmadı olarak geri al", "Mark as not done") : food ? L("Gittim", "Been there") : L("Yaptım", "Done it")}
          aria-label={done ? L(`${item.name}: geri al`, `${item.name}: undo`) : L(`${item.name}: yaptım`, `${item.name}: done`)}
          onClick={() => void setDone(item, !done)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
      </div>
      <DeleteX name={item.name} onDelete={() => env.remove(item)} className="il-x" />
    </div>
  );
}
