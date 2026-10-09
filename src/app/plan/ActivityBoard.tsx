// Etkinlik ve turlar as drawn in v11 (docs/mockups/2026-10-08-japonya-web-v11.html, expBody): what's on the plan
// is a row — the picture, the name, its ring, day, city, source and price; chosen: "✓ Aldım" and "Bilet al ↗";
// booked: "✓ Bilet alındı", its file (or "Belge eksik") and "Ayrıntı ›", the row opening the booking's window;
// × on each. Under them "Fikirler · bilet ya da rezervasyon gerektirenler" with "Daha fazla fikir" (the chat
// looks for more), and the ideas as tiles like Yapılacak şeyler's: the picture, who saved it, ×, the name, city,
// source and price, "+ Plana koy". Whatever isn't one record (a group of options) keeps its card after them.
import { useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { ringOf, topDate } from "../../lib/cardView";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import { entryDomId } from "../../lib/progress";
import { L } from "../../lib/i18n";
import { isAiOption } from "../../lib/pano";
import type { Item } from "../../lib/types";
import { chooseItem, setItemStatus } from "../actions";
import { BookingSheet } from "../cards/BookingSheet";
import { CardMenu, DeleteX, Ring } from "../cards/CardShell";
import { DocAccess } from "../cards/DocAccess";
import { datedLink } from "../cards/parts";
import { useCardEnv } from "../cards/PlanCard";
import { useStageMenu } from "../cards/stageMenu";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";

/** The drawing's picture for a ticket, a tour or a show (static/illus). */
export const ACTIVITY_ART = "illus/etkinlik-tur.png";

const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);
/** On the plan: chosen or booked (an idea is only saved). */
export const activityPlanned = (i: Item): boolean => i.status === "chosen" || i.status === "booked";

export function ActivityBoard({ section, fallback }: { section: CatSection; fallback: (entry: CatEntry) => ReactNode }) {
  const env = useCardEnv();
  const rows = section.entries.map((e) => ({ e, item: recordOf(e) }));
  const records = rows.filter((r): r is { e: CatEntry; item: Item } => r.item != null);
  const planned = records.filter((r) => activityPlanned(r.item));
  const ideas = records.filter((r) => !activityPlanned(r.item));
  const others = rows.filter((r) => r.item == null).map((r) => r.e);
  const more = env.ask;
  return (
    <div className="ac-wrap">
      {planned.length > 0 && (
        <div className="ac-planned">
          {/* The name is edited where it stands (just added from "+ Ekle", a page's title corrected). */}
          {planned.map(({ e, item }) => (
            <InlineEdit key={e.key} item={item} only={["name"]}>
              <ActivityRow item={item} domId={entryDomId(catDomKey(e))} />
            </InlineEdit>
          ))}
        </div>
      )}
      {others.map((e) => (
        <div key={e.key} className="ac-other">{fallback(e)}</div>
      ))}
      <div className="ac-ideas-h">
        <b>{L("Fikirler", "Ideas")}</b>
        <span>{L("bilet ya da rezervasyon gerektirenler", "the ones that take a ticket or a booking")}</span>
        <span className="ac-sp" />
        {more && (
          <button type="button" className="ac-more" onClick={() => more(L("Bu gezi için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur fikri daha öner.", "Suggest a few more activities and tours for this trip, the kind that take a ticket or a booking."))}>
            ✨ {L("Daha fazla fikir", "More ideas")}
          </button>
        )}
      </div>
      {ideas.length ? (
        <div className="it-grid ac-shelf">
          {ideas.map(({ e, item }) => (
            <InlineEdit key={e.key} item={item} only={["name"]}>
              <ActivityTile item={item} domId={entryDomId(catDomKey(e))} />
            </InlineEdit>
          ))}
        </div>
      ) : (
        <p className="il-none">{L("Plana koyulmayı bekleyen fikir yok.", "No ideas waiting.")}</p>
      )}
    </div>
  );
}

function ActivityRow({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const stageMenu = useStageMenu(item);
  const [sheet, setSheet] = useState(false);
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const docs = env.docsFor(item.id);
  const booked = item.status === "booked";
  const page = datedLink(item, undefined).url ?? item.url;
  const date = topDate(item, "activity");
  const open = () => (booked ? setSheet(true) : env.onOpenItem(item));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className={`ac-row${booked ? " booked" : " chosen"}`} aria-label={item.name} data-item-id={item.id} id={domId} role="button" tabIndex={0}
      onClick={(e) => !(e.target as HTMLElement).closest("button, a, input, .pk-menu, .pk-ed-wrap") && open()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), open())}>
      <FallbackImg className="ac-pic" src={item.imageUrl ?? null} fallback={<img className="ac-pic art" src={ACTIVITY_ART} alt="" />} />
      <b className="ac-t">
        <Editable field="name">{item.name}</Editable>
      </b>
      <span className="ac-m">
        <Ring state={ringOf(item, "activity")} />
        {[date, item.city].filter(Boolean).join(" · ")}
        {facts.source && <span className="ac-src">· {facts.source.label}</span>}
        {facts.price && <span className="ac-price">· {facts.price.text}</span>}
      </span>
      <span className="ac-r" onClick={stop}>
        {booked ? (
          <>
            <span className="ac-proof">✓ {L("Bilet alındı", "Ticket bought")}</span>
            <DocAccess item={item} docs={docs} />
            <button type="button" className="ac-detail" onClick={() => setSheet(true)}>{L("Ayrıntı", "Details")} ›</button>
          </>
        ) : (
          <>
            <button type="button" className="pk-aldim" aria-label={L(`${item.name}: aldım`, `${item.name}: got it`)} onClick={() => void setItemStatus(item, "booked")}>
              ✓ {L("Aldım", "Got it")}
            </button>
            {page && (
              <a className="ac-go" href={page} target="_blank" rel="noreferrer">
                {facts.source?.host && <FallbackImg className="sc-favicon" src={`https://${facts.source.host}/favicon.ico`} fallback={null} />}
                {L("Bilet al ↗", "Get the ticket ↗")}
              </a>
            )}
            <DocAccess item={item} docs={docs} />
          </>
        )}
        <DeleteX name={item.name} onDelete={stageMenu.hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} className="ac-x" />
        <CardMenu entries={stageMenu.menu} />
      </span>
      {stageMenu.field}
      {sheet && (
        <BookingSheet item={item} kind="activity" facts={facts} docs={docs} date={date}
          onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

function ActivityTile({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const stageMenu = useStageMenu(item);
  const myName = useMyName();
  const photoOf = usePhotoOf();
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const who = isAiOption(item) ? "ai" : (item.addedBy ?? null);
  const meta = [item.city, facts.source?.label, facts.price?.text].filter(Boolean).join(" · ");
  const edit = useInlineEdit();
  return (
    <div className="it-tile ac-tile" aria-label={item.name} data-item-id={item.id} id={domId} title={item.summary ?? undefined}>
      <div className="it-pic ac-tile-pic">
        <FallbackImg className="it-photo" src={item.imageUrl ?? null} fallback={<img className="ac-art" src={ACTIVITY_ART} alt="" />} />
        <span className="it-who" title={who === "ai" ? L("AI önerisi", "AI pick") : who ?? myName ?? undefined}>
          {who === "ai" ? <span className="it-ai">✨</span> : <WhoAvatar name={who ?? (myName || L("Ben", "Me"))} photo={photoOf(who ?? myName)} />}
        </span>
        <span className="it-tools">
          <DeleteX name={item.name} onDelete={stageMenu.hide} label={L("Gerek yok", "Not needed")} className="it-x" />
          <CardMenu entries={stageMenu.menu} />
        </span>
      </div>
      <b className="it-t">
        {edit?.open === "name" ? (
          <Editable field="name">{item.name}</Editable>
        ) : (
          <button type="button" className="ac-name" onClick={() => env.onOpenItem(item)}>{item.name}</button>
        )}
      </b>
      {meta && <span className="it-m">{meta}</span>}
      <div className="it-foot">
        <button type="button" className="it-put" onClick={() => void chooseItem(item, [])}>+ {L("Plana koy", "Add to plan")}</button>
      </div>
      {stageMenu.field}
    </div>
  );
}
