// Yapılacak şeyler as tiles (v11 phase 4, docs/mockups/2026-10-08-japonya-web-v11.html): things to do and
// restaurants like the activities' ideas, square: the page's photo (else the kind's mark on its tint), "Maps" when
// the map is its page, the face of who saved it, × on hover; its name (to the map), its city and one grey word;
// "+ Plana koy" ↔ "✓ Planda" in place. Hepsi · Gezilecek yerler · Restoranlar above. No day here: a planned one gets
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
import type { Item } from "../../lib/types";
import { setItemStatus } from "../actions";
import { CardMenu, DeleteX, type MenuEntry } from "../cards/CardShell";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
import { useCardEnv } from "../cards/PlanCard";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import { SuggestTile, useRemembered } from "../plan/ActivityBoard";
import { useSectionSuggest } from "../plan/sectionSuggest";


type Filter = "all" | "go" | "food";
const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);
/** On the plan: put there ("Plana koy"), booked (a table), or already on a day. */
export const ideaPlanned = (i: Item): boolean => i.status === "chosen" || i.status === "booked" || Boolean(dayChip(i));

export function IdeaTiles({ section, fallback }: { section: CatSection; fallback: (entry: CatEntry) => ReactNode }) {
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
  const [open, setOpen] = useRemembered(`trip-radar:ideasOpen:${env.tripId}:todo`, true);
  return (
    <div className="it-wrap">
      <div className="it-filters" role="group" aria-label={L("Ne", "What")}>
        {(["all", "go", "food"] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? L("Hepsi", "All") : f === "go" ? L("Gezilecek yerler", "Places to see") : L("Restoranlar", "Restaurants")} <i>{n(f)}</i>
          </button>
        ))}
      </div>
      <section className="ac-block it-on-plan" aria-label={L("Planda", "On the plan")}>
        <p className="ac-h">
          <b>{L("Planda", "On the plan")}</b>
          <i>{onPlan.length}</i>
          <span>{onPlan.length ? L("günü olmayanlara günü Gün gün'de verirsin", "give the ones with no day theirs in Day by day") : L("Henüz bir şey yok; aşağıdan “+ Plana koy”.", "Nothing yet; “+ Add to plan” from below.")}</span>
        </p>
        {onPlan.length > 0 && (
          <div className="it-rows">
            {onPlan.map(({ e, item }) => (
              <InlineEdit key={e.key} item={item} only={["name"]}>
                <IdeaTile item={item} row />
              </InlineEdit>
            ))}
          </div>
        )}
      </section>
      <section className={`ac-block ac-ideas${open ? " open" : ""}`} aria-label={L("Fikirler ve öneriler", "Ideas and suggestions")}>
        <div className="ac-ideas-h">
          <button type="button" className="ac-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="ac-chev" aria-hidden>▾</span>
            <b>{L("Fikirler ve öneriler", "Ideas and suggestions")}</b>
            <i>{ideas.length + sugg.length}</i>
          </button>
          <span className="it-sp" />
          {env.ask && (
            <button type="button" className="ac-more" onClick={() => env.ask!(L("Bu gezi için gezilecek birkaç yer ve restoran daha öner.", "Suggest a few more places to see and restaurants for this trip."))}>
              ✨ {L("Daha fazla öner", "Suggest more")}
            </button>
          )}
        </div>
        {open &&
          (ideas.length || sugg.length ? (
            <div className="it-grid">
              {sugg.map((x) => (
                <SuggestTile key={x.key} s={x} note={suggest?.notes[x.key] ?? null} onAdd={() => suggest?.add(x)} onDismiss={() => suggest?.dismiss(x)}
                  art={`illus/${x.section === "food" || x.template === "food" ? "restoran" : "yapilacak"}.png`} />
              ))}
              {ideas.map(({ e, item }) => (
                <InlineEdit key={e.key} item={item} only={["name"]}>
                  <IdeaTile item={item} />
                </InlineEdit>
              ))}
            </div>
          ) : (
            <p className="il-none">{L("Burada bekleyen fikir yok.", "No ideas waiting here.")}</p>
          ))}
      </section>
      {others.map((e) => (
        <div key={e.key} className="it-other">{fallback(e)}</div>
      ))}
      <p className="it-note">{L("Eklemek için sohbete yaz (“Kyoto'da iyi bir ramenci ekle”); Google Maps'ten kaydettiklerin kendiliğinden düşer. Plana koyduklarına günü Gün gün'de verirsin.", "To add one, say it in the chat; what you save from Google Maps lands here. Give the planned ones their day in Day by day.")}</p>
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
        {from === "Maps" && <span className="it-maps">Maps</span>}
        <span className="it-who" title={who === "ai" ? L("AI önerisi", "AI pick") : who ?? myName ?? undefined}>
          {who === "ai" ? <span className="it-ai">✨</span> : <WhoAvatar name={who ?? (myName || L("Ben", "Me"))} photo={photoOf(who ?? myName)} />}
        </span>
        {!row && tools}
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
        {done ? (
          <span className="it-done">✓ {food ? L("Gidildi", "Been there") : L("Yapıldı", "Done")}</span>
        ) : booked ? (
          <span className="it-put on">✓ {L("Rezerve", "Booked")}</span>
        ) : (
          <button type="button" className={`it-put${planned ? " on" : ""}`} aria-pressed={planned}
            onClick={() => void (planned ? (day ? setIdeaDay(item, null, null).then(() => setItemStatus(item, "saved")) : setItemStatus(item, "saved")) : setItemStatus(item, "chosen"))}>
            {planned ? `✓ ${L("Planda", "On the plan")}` : `+ ${L("Plana koy", "Add to plan")}`}
          </button>
        )}
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
