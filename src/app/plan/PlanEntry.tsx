// A block of the plan's front as it was always drawn (spec 0.31–0.33): a flight or a change of city with its
// options, a transfer's card, a stretch of nights (booked, chosen, options, a stay said apart, empty nights),
// a rented car, a booking on its day. The Plan's sections (CategoryPlan) place these; their cards are the
// approved ones, unchanged; what has nothing booked or saved yet is its empty card (cards/EmptyCard.tsx).
import { L } from "../../lib/i18n";
import { formatDateRange, nightsBetween } from "../../lib/items";
import type { StayBlock } from "../../lib/plan";
import type { TimelineEntry } from "../../lib/timeline";
import type { Item } from "../../lib/types";
import { DeleteX } from "../cards/CardShell";
import { EmptyStayBlock, EmptyTravelCard } from "../cards/EmptyCard";
import { useCardEnv } from "../cards/PlanCard";
import type { LegCardFor, RenderGroup, SettledFor } from "../Timeline";

export function PlanEntry({ entry, legCard, renderGroup, settled }: {
  entry: TimelineEntry;
  legCard: LegCardFor;
  renderGroup: RenderGroup;
  settled: SettledFor;
}) {
  switch (entry.kind) {
    case "leg":
      return <>{legCard(entry.leg)}</>;
    case "stay":
      return <Block block={entry.block} renderGroup={renderGroup} settled={settled} />;
    case "travel":
      if (entry.travel) {
        return (
          <div className={`tl-travel role-${entry.role}`}>
            {renderGroup({ ...entry.travel.group, items: entry.travel.items }, null, null, true)}
          </div>
        );
      }
      return (
        <div className={`tl-travel role-${entry.role}`}>
          {entry.role === "move" && entry.leg ? (
            legCard(entry.leg)
          ) : (entry.role === "arrival" || entry.role === "departure") && entry.city ? (
            // Boş kartlar: the way in or home with no flight saved, the flight's empty card.
            <EmptyTravelCard role={entry.role} date={entry.date} city={entry.city} />
          ) : (
            <div className="empty-card">
              <span>
                <b>{entry.subtitle ?? L("Ulaşım", "Transport")}</b>
                <span className="muted">{L(`Henüz eklenmedi · sohbette "7 Ekim'de uçuşumuz var" demen yeter`, `Not added yet · just say "we fly on 7 October" in the chat`)}</span>
              </span>
              {entry.searchUrl && (
                <a className="pill-btn outline" href={entry.searchUrl} target="_blank" rel="noreferrer">
                  {L("Uçuş ara ↗", "Search flights ↗")}
                </a>
              )}
            </div>
          )}
        </div>
      );
    case "rental":
      return <div className="tl-rental">{renderGroup(entry.group, null, null, true)}</div>;
    case "event":
      return <>{settled(entry.item)}</>;
    default:
      // A day and a city's plans are split into their records by the categories (lib/categories.ts).
      return null;
  }
}

/** A stay said apart (in the chat, or added with "+") with options under it: the line saying so, and its × (spec 0.33 §1). */
function SlotNote({ slot }: { slot: Item }) {
  const env = useCardEnv();
  return (
    <p className="slot-note muted">
      <span>{L("Bu geceler ayrı konaklama (sohbette söyledin)", "These nights are a separate stay (you said so in the chat)")}</span>
      <DeleteX name={slot.name} onDelete={() => env.remove(slot)} />
    </p>
  );
}

const blockState = (block: StayBlock) => (block.kind === "open" && !block.groups.length ? "empty" : block.kind);

function Block({ block, renderGroup, settled }: { block: StayBlock; renderGroup: RenderGroup; settled: SettledFor }) {
  const state = blockState(block);
  const label = `${block.city ?? L("Konaklama", "Stay")} ${formatDateRange(block.range.start, block.range.end)}`;
  return (
    <div className={`stay-block ${state}`} id={`block-${block.range.start}`}>
      {block.kind === "booked" && settled(block.item)}
      {block.kind === "booked" && block.clashes?.map((i) => <div key={i.id}>{settled(i)}</div>)}
      {block.kind !== "booked" &&
        block.groups.map((g) =>
          renderGroup(g, null, g.range && g.range.start === block.range.start && g.range.end === block.range.end ? null : g.title, true),
        )}
      {block.kind === "open" && block.slot && block.groups.length > 0 && <SlotNote slot={block.slot} />}
      {block.kind === "chosen" && block.gap && block.gap.length > 0 && (
        <p className="slot-note gap">
          {L(
            `${block.gap.map((r) => `${formatDateRange(r.start, r.end)} (${nightsBetween(r.start, r.end)} gece)`).join(", ")} için yer seçilmedi: bu konaklama tek blok, seçtiğin yer yalnız bir kısmını kapsıyor.`,
            `No place chosen for ${block.gap
              .map((r) => {
                const k = nightsBetween(r.start, r.end);
                return `${formatDateRange(r.start, r.end)} (${k} night${k === 1 ? "" : "s"})`;
              })
              .join(", ")}: this stay is one block and the place you chose covers only part of it.`,
          )}
        </p>
      )}
      {/* Boş kartlar: nights with no place are the stay's empty card (cards/EmptyCard.tsx). */}
      {block.kind === "open" && !block.groups.length && <EmptyStayBlock block={block} label={label} />}
    </div>
  );
}

