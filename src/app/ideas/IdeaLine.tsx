// One idea in the Plan's pool (fikir havuzu v1, docs/mockups/2026-10-05-fikir-havuzu-v1.html): a thing to do or
// a restaurant in a row. Its kind's icon on a soft square (the saved page's photo when it had one), its name —
// a link to the place on the map, renamed with the pencil beside it — and one grey line: its kind (a tap
// changes it), the neighbourhood, a restaurant's rating, where it came from (a small link to the Reel or the
// blog; "Maps'ten" when the map is its page). Then its day ("10 Eki", "Bugün", "+ Gün"; a missed one "Bugüne
// al"), one "Harita", and the circle that ticks it done. × on hover deletes it with "Geri al". A restaurant that
// takes a reservation says where that stands; a to-do whose words say a ticket offers "Etkinliklere taşı", one
// that's really a chore before the trip "Hazırlığa taşı" on hover.
import { useEffect, useState } from "react";
import { needsBooking } from "../../lib/booking";
import { L, locale } from "../../lib/i18n";
import { num } from "../../lib/i18nText";
import { ideaKindOf, KIND_TINT, kindLabel, kindsFor, type IdeaKind } from "../../lib/ideaKinds";
import type { IdeaStatus } from "../../lib/ideaList";
import { ideaMapUrl, ideaSource, isFoodIdea, moveToBookings, setDone, setIdeaDay, setIdeaKind, setPrep, shortDay, todoLine } from "../../lib/ideas";
import { isoDate } from "../../lib/items";
import type { Plan } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { setItemStatus } from "../actions";
import { FallbackImg } from "../FallbackImg";
import { DeleteX } from "../cards/CardShell";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { DayButton } from "./DayPicker";
import { IdeaGlyph } from "./IdeaIcons";

/** The kind's icon (a museum, a tree, a cup…); a thing to do with no kind, a star. */
const GLYPH: Record<IdeaKind, Parameters<typeof IdeaGlyph>[0]["name"]> = {
  view: "sun", culture: "museum", nature: "tree", shop: "bag", walk: "walker", fun: "ticket",
  coffee: "cup", lunch: "food", dinner: "food", sweet: "cupcake", bar: "wine",
};

export interface IdeaLineProps {
  item: Item;
  plan: Pick<Plan, "range" | "stayBlocks">;
  status: IdeaStatus;
  /** The day it was on, gone by without "Yaptım". */
  returned?: string | null;
  /** Today (YYYY-MM-DD): its day is "Bugün", a missed one "Bugüne al". */
  today: string;
  /** During the trip: a missed one offers "Bugüne al". */
  during: boolean;
}

export function IdeaLine(props: IdeaLineProps) {
  return (
    <InlineEdit item={props.item} only={["name"]}>
      <IdeaLineFace {...props} />
    </InlineEdit>
  );
}

function IdeaLineFace({ item, plan, status, returned = null, today, during }: IdeaLineProps) {
  const env = useCardEnv();
  const edit = useInlineEdit();
  const food = isFoodIdea(item);
  const kind = ideaKindOf(item);
  const tint = kind ? KIND_TINT[kind] : "#5d8a1c";
  const tile = (
    <span className="il-ic" style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, #fff)` }}>
      <IdeaGlyph name={kind ? GLYPH[kind] : "star"} size={17} />
    </span>
  );
  const done = status === "done";
  const missed = status === "missed";
  const mapUrl = ideaMapUrl(item);
  const from = ideaSource(item);
  const day = isoDate(item.dates.start);
  const promote = !food && !done && todoLine(item).promote;
  const booking = food && needsBooking(item);
  const booked = item.status === "booked";
  const rating =
    food && item.rating.value != null
      ? `★ ${num(item.rating.value)}${item.rating.count ? ` (${item.rating.count >= 1000 ? `${num(item.rating.count / 1000)} B` : item.rating.count.toLocaleString(locale())})` : ""}`
      : null;
  const doneDay = item.doneAt ? shortDay(new Date(item.doneAt).toISOString().slice(0, 10)) : null;
  return (
    <div className={`il-row${done ? " done" : ""}${returned ? " back" : ""}`} aria-label={item.name} data-item-id={item.id} title={item.summary ?? undefined}>
      {item.imageUrl ? <FallbackImg className="il-img" src={item.imageUrl} fallback={tile} /> : tile}
      <div className="il-main">
        {edit?.open === "name" ? (
          <b>
            <Editable field="name">{item.name}</Editable>
          </b>
        ) : (
          <b className="il-name">
            <a href={mapUrl} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open on the map")}>
              {item.name}
            </a>
            <button type="button" className="il-pen" aria-label={L("Ad: düzenle", "Name: edit")} title={L("Adı düzenle", "Rename")} onClick={() => edit?.go("name")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
              </svg>
            </button>
          </b>
        )}
        <span className={`il-sub${missed ? " missed" : ""}`}>
          {returned ? (
            L(`${shortDay(returned)} için konmuştu · havuza döndü`, `Was on ${shortDay(returned)} · back in the pool`)
          ) : (
            <>
              <KindPicker item={item} kind={kind} food={food} />
              {item.location.area && <span>{item.location.area}</span>}
              {rating && <span>{rating}</span>}
              {done && doneDay && <span>{L(`${doneDay} yapıldı`, `done ${doneDay}`)}</span>}
              {from && item.url && from !== "Maps" && (
                <a className="il-src" href={item.url} target="_blank" rel="noreferrer" title={L("Kaynağını aç", "Open its page")}>
                  {from} ↗
                </a>
              )}
              {from === "Maps" && <span>{L("Maps'ten", "from Maps")}</span>}
            </>
          )}
        </span>
      </div>
      <div className="il-act">
        {/* A chore before the trip after all ("yağmurluk al" to buy at home): one tap to Diğer's Hazırlık. */}
        {!food && !done && (
          <button type="button" className="il-prep" title={L("Yola çıkmadan yapılacak: Hazırlık'a taşı", "Before the trip: move to Prep")}
            aria-label={L(`${item.name}: Hazırlık'a taşı`, `${item.name}: move to Prep`)} onClick={() => void setPrep(item, true)}>
            {L("Hazırlığa taşı", "Move to Prep")}
          </button>
        )}
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
        {missed && during ? (
          <button type="button" className="il-today" onClick={() => void setIdeaDay(item, today, food ? (item.meal ?? null) : null)}>
            {L("Bugüne al", "Today")}
          </button>
        ) : (
          !done && <DayButton item={item} plan={plan} pooled={!!returned} today={during && day === today} />
        )}
        <a className="il-map" href={mapUrl} target="_blank" rel="noreferrer" aria-label={L(`${item.name}: haritada aç`, `${item.name}: open on the map`)}>
          <IdeaGlyph name="pin" size={13} />
          {L("Harita", "Map")}
        </a>
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

/** The kind in the grey line; a tap lists the kinds to pick from ("Otomatik" goes back to the words'). */
function KindPicker({ item, kind, food }: { item: Item; kind: IdeaKind | null; food: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const pick = (k: string | null) => {
    setOpen(false);
    void setIdeaKind(item, k);
  };
  return (
    <span className="il-kindwrap">
      <button type="button" className="il-kind" aria-haspopup="menu" aria-expanded={open} aria-label={L(`${item.name}: tür (${kind ? kindLabel(kind) : "yok"})`, `${item.name}: kind`)}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {kind ? kindLabel(kind) : L("Tür seç", "Pick a kind")}
      </button>
      {open && (
        <span className="il-kinds" role="menu" onClick={(e) => e.stopPropagation()}>
          {kindsFor(food).map((k) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === kind} className={k === kind ? "on" : undefined} onClick={() => pick(k)}>
              {kindLabel(k)}
            </button>
          ))}
          {item.ideaKind && (
            <button type="button" role="menuitem" className="auto" onClick={() => pick(null)}>
              {L("Otomatik", "Automatic")}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
