// Yapılacak şeyler as tiles (v11 phase 4, docs/mockups/2026-10-08-japonya-web-v11.html): things to do and
// restaurants like the activities' ideas, square: the page's photo (else the kind's mark on its tint), "Maps" when
// the map is its page, the face of who saved it, × on hover; its name (to the map), its city and one grey word;
// "+ Plana ekle" ↔ "✓ Planda" in place. Hepsi · Gezilecek yerler · Restoranlar above. No day here: a planned one gets
// its day in Gün gün ("Planda, günü yok"); a day already given shows as a chip. The rest of a row's doings are in
// the tile's •••: Yaptım, Haritada aç, Adını değiştir, Rezerve ettim (a restaurant that takes a table), Etkinliklere
// taşı (a ticket after all), Hazırlık'a taşı (a chore before the trip), Günden çıkar.
import { useState, type ReactNode } from "react";
import { needsBooking } from "../../lib/booking";
import type { CatEntry, CatSection } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { num } from "../../lib/i18nText";
import { ideaKindOf, KIND_TINT, kindLabel } from "../../lib/ideaKinds";
import { dayChip, ideaMapUrl, ideaSource, ideaThumb, isFoodIdea, moveToBookings, setDone, setIdeaDay, setPrep } from "../../lib/ideas";
import { isIdea } from "../../lib/booking";
import { planSectionOfItem } from "../../lib/categories";
import { DayButton } from "./DayPicker";
import { isAiOption } from "../../lib/pano";
import { durationText } from "../../lib/cardFacts";
import { hopBetween, hopWord, type JourneyHop, type JourneyStop } from "../../lib/tripShape";
import { formatDateRange } from "../../lib/items";
import { sameCity } from "../../lib/plan";
import type { Item } from "../../lib/types";
import { KindIcon } from "../cards/Silhouettes";
import { setItemStatus } from "../actions";
import { CardMenu, DeleteX, type MenuEntry } from "../cards/CardShell";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import { SuggestTile } from "../plan/ActivityBoard";
import { useSectionSuggest } from "../plan/sectionSuggest";


type Filter = "all" | "go" | "food";
const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);
/** On the plan: put there ("Plana ekle"), booked (a table), or already on a day. */
export const ideaPlanned = (i: Item): boolean => i.status === "chosen" || i.status === "booked" || Boolean(dayChip(i));

export function IdeaTiles({ section, fallback, journey = null }: { section: CatSection; fallback: (entry: CatEntry) => ReactNode; /** The trip's shape: the way between one city and the next is a line between their rows. */ journey?: { stops: JourneyStop[]; hops: JourneyHop[] } | null }) {
  const env = useCardEnv();
  const suggest = useSectionSuggest();
  const [filter, setFilter] = useState<Filter>("all");
  const rows = section.entries.map((e) => ({ e, item: recordOf(e) }));
  const items = rows.filter((r): r is { e: CatEntry; item: Item } => r.item != null);
  const others = rows.filter((r) => r.item == null).map((r) => r.e);
  const n = (f: Filter) => items.filter(({ item }) => f === "all" || (f === "food") === isFoodIdea(item)).length;
  // What's done goes last; the rest keeps the Plan's order (on a day first, then by city).
  const shown = items.filter(({ item }) => filter === "all" || (filter === "food") === isFoodIdea(item)).sort((a, b) => Number(Boolean(a.item.doneAt)) - Number(Boolean(b.item.doneAt)));
  // v11 revision (Emre 2026-10-09: "plana eklendikten sonra burası tam anlaşılmıyor"): what's on the plan in its own
  // place as rows (its day, or none yet), the ideas and the suggestions apart as tiles, folding away.
  const onPlan = shown.filter(({ item }) => ideaPlanned(item) || Boolean(item.doneAt));
  const ideas = shown.filter(({ item }) => !ideaPlanned(item) && !item.doneAt);
  const sugg = (suggest?.list ?? []).filter((x) => filter === "all" || (filter === "food") === (x.section === "food" || x.template === "food"));
  // v30 (docs/superpowers/specs/2026-10-11-plan-v30-design.md): the trip's places and tables by city, in the order lived: each city one
  // row of tiles of one size, what's on the plan first (✓), the ideas and suggestions after (dashed, +). The corner ✓ / + puts it on
  // the plan and takes it off.
  const groups = new Map<string, { planned: typeof shown; ideas: typeof shown; sugg: typeof sugg }>();
  const order: string[] = [];
  const at = (city: string | null | undefined) => {
    const key = (city ?? "").trim();
    if (!groups.has(key)) {
      groups.set(key, { planned: [], ideas: [], sugg: [] });
      order.push(key);
    }
    return groups.get(key)!;
  };
  onPlan.forEach((r) => at(r.item.city).planned.push(r));
  ideas.forEach((r) => at(r.item.city).ideas.push(r));
  sugg.forEach((x) => at(x.payload?.city).sugg.push(x));
  // A place with no city yet comes last.
  order.sort((a, b) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0));
  return (
    <div className="it-wrap">
      <div className="it-filters" role="group" aria-label={L("Ne", "What")}>
        {(["all", "go", "food"] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? L("Hepsi", "All") : f === "go" ? L("Gezilecek yerler", "Places to see") : L("Restoranlar", "Restaurants")} <i>{n(f)}</i>
          </button>
        ))}
        <span className="it-sp" />
        {env.ask && (
          <button type="button" className="ac-more" onClick={() => env.ask!(L("Bu gezi için gezilecek birkaç yer ve restoran daha öner.", "Suggest a few more places to see and restaurants for this trip."))}>
            ✨ {L("Daha fazla öner", "Suggest more")}
          </button>
        )}
      </div>
      <p className="it-key">
        <span className="it-key-on">✓</span>
        {L("planda", "on the plan")}
        <span className="it-key-add">+</span>
        {L("öneri, basınca plana girer", "an idea, one tap puts it on the plan")}
      </p>
      {order.length === 0 && <p className="il-none">{L("Burada bekleyen bir şey yok.", "Nothing here yet.")}</p>}
      <div className="it-cities" data-pit-children="">
        {order.map((city, k) => {
          const x = groups.get(city)!;
          const waiting = x.ideas.length + x.sugg.length;
          return (
            <section key={city || "none"} className="it-city" aria-label={city || L("Şehri belli değil", "City not set")}>
              <div className="it-city-h">
                <span className="it-city-n" aria-hidden>{k + 1}</span>
                <b>{city || L("Şehri belli değil", "City not set")}</b>
                {(() => {
                  // The city's days and nights, from the stay the trip has there (never guessed).
                  const stay = city ? journey?.stops.find((st) => st.kind === "stay" && sameCity(st.city, city)) : null;
                  return stay?.range ? <span className="it-city-d">{[formatDateRange(stay.range.start, stay.range.end), stay.sub].join(" · ")}</span> : null;
                })()}
                <span className="it-city-c">
                  {x.planned.length > 0 && <i className="ok">✓ {L(`${x.planned.length} planda`, `${x.planned.length} on the plan`)}</i>}
                  {waiting > 0 && <i>+ {L(`${waiting} öneri`, `${waiting} idea${waiting === 1 ? "" : "s"}`)}</i>}
                </span>
              </div>
              <div className="it-grid">
                {x.planned.map(({ e, item }) => (
                  <InlineEdit key={e.key} item={item} only={["name"]}>
                    <IdeaTile item={item} />
                  </InlineEdit>
                ))}
                {x.ideas.map(({ e, item }) => (
                  <InlineEdit key={e.key} item={item} only={["name"]}>
                    <IdeaTile item={item} />
                  </InlineEdit>
                ))}
                {x.sugg.map((sx) => (
                  <SuggestTile key={sx.key} s={sx} note={suggest?.notes[sx.key] ?? null} onAdd={() => suggest?.add(sx)} onDismiss={() => suggest?.dismiss(sx)}
                    art={`illus/${sx.section === "food" || sx.template === "food" ? "restoran" : "yapilacak"}.png`}
                    tag={sx.section === "food" || sx.template === "food" ? L("Restoran", "Restaurant") : L("Gezilecek", "To see")} />
                ))}
              </div>
              {(() => {
                const next = order[k + 1];
                const hop = city && next ? hopBetween(journey, city, next) : null;
                return hop ? (
                  <div className="it-hop">
                    <span className="it-hop-ic" aria-hidden>
                      <KindIcon kind={hop.mode === "other" ? "transport" : hop.mode === "car" ? "car" : hop.mode} size={14} />
                    </span>
                    {L(`${next}'ye`, `To ${next}`)} · {hop.name ?? hopWord(hop.mode)}
                    {hop.minutes ? ` · ~${durationText(hop.minutes)}` : ""}
                  </div>
                ) : null;
              })()}
            </section>
          );
        })}
      </div>
      {others.map((e) => (
        <div key={e.key} className="it-other">{fallback(e)}</div>
      ))}
      <p className="it-note">{L("Eklemek için sohbete yaz (“Kyoto'da iyi bir ramenci ekle”); Google Maps'ten kaydettiklerin kendiliğinden düşer. Plana eklediklerine günü Gün gün'de verirsin.", "To add one, say it in the chat; what you save from Google Maps lands here. Give the planned ones their day in Day by day.")}</p>
    </div>
  );
}

/** A thing to do as a tile (an idea), or as a row (`row`: on the plan, its day beside it). */
function IdeaTile({ item, row = false }: { item: Item; row?: boolean }) {
  const env = useCardEnv();
  const edit = useInlineEdit();
  const myName = useMyName();
  const photoOf = usePhotoOf();
  const food = isFoodIdea(item);
  const kind = ideaKindOf(item);
  const tint = kind ? KIND_TINT[kind] : food ? "#b4532a" : "#5d8a1c";
  const done = Boolean(item.doneAt);
  const planned = ideaPlanned(item);
  const day = dayChip(item);
  const mapUrl = ideaMapUrl(item);
  const from = ideaSource(item);
  const booking = food && needsBooking(item);
  const booked = item.status === "booked";
  const who = isAiOption(item) ? "ai" : (item.addedBy ?? null);
  const rating = item.rating.value != null ? `★ ${num(item.rating.value)}` : null;
  const meta = [item.city, kind ? kindLabel(kind) : null, item.location.area, rating].filter(Boolean).join(" · ");
  const menu: MenuEntry[] = [
    { label: done ? (food ? L("Gidilmedi olarak geri al", "Mark as not been") : L("Yapılmadı olarak geri al", "Mark as not done")) : food ? L("Gittim", "Been there") : L("Yaptım", "Done it"), run: () => void setDone(item, !done) },
    { label: L("Haritada aç", "Open on the map"), run: () => void window.open(mapUrl, "_blank", "noopener") },
    { label: L("Adını değiştir", "Rename"), run: () => edit?.go("name") },
    ...(booking ? [{ label: booked ? L("Rezervasyonu geri al", "Mark as not booked") : L("Rezervasyonu yaptım", "I booked it"), run: () => void setItemStatus(item, booked ? "chosen" : "booked") }] : []),
    ...(day ? [{ label: L("Günden çıkar", "Take off its day"), run: () => void setIdeaDay(item, null, null) }] : []),
    ...(!food ? [{ label: L("Etkinliklere taşı (bileti var)", "Move to activities (has a ticket)"), run: () => void moveToBookings(item) }] : []),
    ...(!food ? [{ label: L("Hazırlık'a taşı", "Move to Prep"), run: () => void setPrep(item, true) }] : []),
  ];
  const tools = (
    <span className="it-tools">
      <DeleteX name={item.name} onDelete={() => env.remove(item)} className="it-x" />
      <CardMenu entries={menu} />
    </span>
  );
  return (
    <div className={`it-tile${row ? " it-row" : ""}${food ? " food" : ""}${done ? " done" : ""}${planned ? " planned" : ""}`} aria-label={item.name} data-item-id={item.id} title={item.summary ?? undefined}>
      <div className="it-pic" style={{ background: `color-mix(in srgb, ${tint} 12%, #fff)` }}>
        <FallbackImg className="it-photo" src={ideaThumb(item)} fallback={<img className="it-illus" src={`illus/${food ? "restoran" : "yapilacak"}.png`} alt="" />} />
        {/* v30: what it is, in the picture's corner. */}
        <span className="it-kindtag">{food ? L("Restoran", "Restaurant") : L("Gezilecek", "To see")}</span>
        {from === "Maps" && <span className="it-maps">Maps</span>}
        <span className="it-who" title={who === "ai" ? L("AI önerisi", "AI pick") : who ?? myName ?? undefined}>
          {who === "ai" ? <span className="it-ai">✨</span> : <WhoAvatar name={who ?? (myName || L("Ben", "Me"))} photo={photoOf(who ?? myName)} />}
        </span>
        {!row && tools}
        {/* v30: the corner ✓ / +: on the plan, or one tap to put it there (its words stay for the reader and the tests; the drawing is the corner mark). */}
        {done ? null : booked ? (
          <span className="it-put on corner">✓ {L("Rezerve", "Booked")}</span>
        ) : (
          <button type="button" className={`it-put corner${planned ? " on" : ""}`} aria-pressed={planned} title={planned ? L("Planda · çıkarmak için bas", "On the plan · tap to take it off") : L("Plana ekle", "Add to the plan")} data-put={planned ? undefined : ""}
            onClick={() => void (planned ? (day ? setIdeaDay(item, null, null).then(() => setItemStatus(item, "saved")) : setItemStatus(item, "saved")) : setItemStatus(item, "chosen"))}>
            {planned ? `✓ ${L("Planda", "On the plan")}` : `+ ${L("Plana ekle", "Add to the plan")}`}
          </button>
        )}
      </div>
      <b className="it-t">
        {edit?.open === "name" ? (
          <Editable field="name">{item.name}</Editable>
        ) : (
          <a href={mapUrl} target="_blank" rel="noreferrer" title={L("Haritada aç", "Open on the map")}>
            {item.name}
          </a>
        )}
      </b>
      {meta && <span className="it-m">{meta}</span>}
      <div className="it-foot">
        {done && <span className="it-done">✓ {food ? L("Gidildi", "Been there") : L("Yapıldı", "Done")}</span>}
        {day && !done ? <span className="it-day">{day}</span> : row && !done ? <span className="it-noday">{L("Günü yok", "No day yet")}</span> : null}
        {row && tools}
      </div>
    </div>
  );
}

/**
 * Gün gün's "Planda, günü yok" (v11 phase 4): the things to do and restaurants put on the plan without a day yet,
 * each with its day button; one given a day leaves the strip for its day.
 */
export function UndatedIdeas({ items, plan }: { items: Item[]; plan: Parameters<typeof DayButton>[0]["plan"] }) {
  const waiting = items.filter((i) => isIdea(i) && !i.doneAt && i.status !== "dismissed" && (i.status === "chosen" || i.status === "booked") && !dayChip(i) && (i.category === "food" || planSectionOfItem(i) === "todo"));
  if (!waiting.length) return null;
  return (
    <section className="ud-strip" aria-label={L("Planda, günü yok", "On the plan, no day yet")}>
      <p className="ud-h">
        <b>{L("Planda, günü yok", "On the plan, no day yet")}</b> <i>{waiting.length}</i>
        <span>{L("bir gün seç, o günün akışına girsin", "pick a day and it joins that day")}</span>
      </p>
      <div className="ud-list">
        {waiting.map((i) => (
          <span key={i.id} className="ud-item" data-item-id={i.id}>
            <span className="ud-name">{i.name}</span>
            {i.city && <span className="ud-city">{i.city}</span>}
            <DayButton item={i} plan={plan} />
          </span>
        ))}
      </div>
    </section>
  );
}
