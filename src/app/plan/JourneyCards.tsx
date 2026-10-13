// The parts "Yolculuk sırasıyla" draws that no other view has (plan v46, F5b): a stay, an event and the to-dos and
// restaurants as small cards in the one column. Flights and rides are the plan's own cards (PlanEntry), so only these are new.
// A small card is a window: it says what the plan says (the picture, the name, the day, the price, where it stands) and a
// press takes the reader to the real card on the Plan (Progress.show), where it is edited and bought. Nothing is made up:
// a stay with no place chosen says it is being looked for, an event with no day says "gün seç".
import type { ReactNode } from "react";
import { brandOf } from "../../lib/brands";
import { cardFacts } from "../../lib/cardFacts";
import { intentOf } from "../../lib/cardView";
import { stayArt, ticketPrices } from "../../lib/cardTicket";
import { isCampStay } from "../../lib/campStay";
import { L } from "../../lib/i18n";
import { nNights, nOptions } from "../../lib/i18nText";
import { clockOf } from "../../lib/legs";
import { stageOf } from "../../lib/lifecycle";
import { isAiOption } from "../../lib/pano";
import { nightsBetween } from "../../lib/items";
import { dateAlert } from "../../lib/progress";
import { lookOf, lookWord, type Look } from "../../lib/stageWords";
import { dayChip, inOut } from "../../lib/storyDates";
import type { StayEntry } from "../../lib/timeline";
import type { Item } from "../../lib/types";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import { BookedBadge } from "../cards/BookedBadge";
import { useCardEnv } from "../cards/PlanCard";
import { BrandPill } from "../cards/RideCard";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { stayPlatform } from "../../lib/cardView";

/** Where a press on a small card goes on the Plan: its record, else the block that holds it. */
export type GoTarget = { item?: string; entry?: string };

/** A small card: one press (or Enter) goes to the real card. It carries no `data-item-id`, so the Plan's finder never takes it for the real one. */
function Jump({ className, label, target, onGo, children }: { className: string; label: string; target: GoTarget; onGo: (t: GoTarget) => void; children: ReactNode }) {
  const go = () => onGo(target);
  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label={L(`${label}: kartına git`, `${label}: go to its card`)}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      {children}
    </div>
  );
}

/** Where it stands, in words (never colour alone): the one green badge when bought, else the stage's word. */
function Stage({ look, as }: { look: Look; as?: "ticket" | "bought" }) {
  if (look === "booked" || look === "arranged") return <BookedBadge look={look} as={as} small />;
  return (
    <span className={`jf-st ${look}`}>
      {look === "chosen" && <UiIcon name="check" size={11} />}
      {lookWord(look)}
    </span>
  );
}

/** The face of whoever found it: ✨ when we did, else the person's own (the picture's corner on the Plan). */
function Who({ item }: { item: Item }) {
  const photoOf = usePhotoOf();
  const myName = useMyName();
  const ai = isAiOption(item);
  const who = item.addedBy ?? (myName || null);
  if (ai) return <span className="jf-who ai" title={L("AI buldu", "AI found")}><span aria-hidden>✨</span></span>;
  if (!who) return null;
  return (
    <span className="jf-who" title={L(`${who} ekledi`, `${who} added`)}>
      <WhoAvatar name={who} photo={photoOf(who)} />
    </span>
  );
}

/** A stay: its picture, "Konaklama · N gece", its name (or "aranıyor"), "Giriş X · Çıkış Y" (no days: "N gece"), the stage, the price a night. */
export function JourneyStay({ stay, onGo }: { stay: StayEntry; onGo: (t: GoTarget) => void }) {
  const env = useCardEnv();
  const block = stay.block;
  const item = block.kind === "open" ? null : block.item;
  const city = block.city;
  const nights = block.nights;
  const camp = Boolean(item && isCampStay(item));
  const facts = item ? cardFacts(item, undefined, env.decisions?.ctx) : null;
  const arranged = Boolean(item && item.arranged && item.noBooking != null && item.status !== "booked");
  const look: Look = item ? (lookOf(stageOf(item, { docs: env.docsFor(item.id).length }), { arranged }) ?? "chosen") : "search";
  const days = inOut(block.range.start, block.range.end);
  const platform = item ? stayPlatform(item) : null;
  const options = block.kind === "open" ? block.groups.reduce((n, g) => n + g.items.length, 0) : 0;
  const name = item?.name ?? (block.kind === "open" && block.slot ? block.slot.name : city ? L(`${city} için konaklama`, `A place to stay in ${city}`) : L("Konaklama", "Stay"));
  const when = camp ? (intentOf(item!)?.city ?? null) : days ? L(`Giriş ${days.in} · Çıkış ${days.out}`, `Check-in ${days.in} · Check-out ${days.out}`) : nights > 0 ? nNights(nights) : null;
  // The real warnings stay: a free cancellation running out, the nights a chosen place doesn't cover.
  const alert = item ? dateAlert(item, env.today) : null;
  const gap = block.kind === "chosen" && block.gap?.length ? block.gap.reduce((n, r) => n + nightsBetween(r.start, r.end), 0) : 0;
  const art = item ? stayArt(item, platform === "Airbnb") : "otel";
  const picture = (
    <FallbackImg
      className="jf-photo"
      src={item?.imageUrl ?? null}
      fallback={art ? <img className="jf-art" src={`illus/${art}.png`} alt="" /> : <KindIcon kind="stay" size={34} />}
    />
  );
  return (
    <Jump className={`jf-c jf-h jf-stay s-${look}`} label={name} target={item ? { item: item.id, entry: stay.key } : { entry: stay.key }} onGo={onGo}>
      <span className="jf-img">{picture}</span>
      <span className="jf-t">
        <small className="jc-k">
          <KindIcon kind="stay" size={12} />
          {camp ? L("Kamp", "Camp") : L("Konaklama", "Stay")}
          {nights > 0 && ` · ${nNights(nights)}`}
        </small>
        <b>{name}</b>
        <small className="num">
          {when}
          {platform && ` · ${platform}`}
          {options > 0 && ` · ${nOptions(options)}`}
        </small>
        {alert && <small className={`jf-warn ${alert.tone}`}>⏳ {alert.text}</small>}
        {gap > 0 && <small className="jf-warn amber">{L(`${nNights(gap)} için yer seçilmedi`, `No place chosen for ${nNights(gap)}`)}</small>}
      </span>
      <span className="jf-r">
        <Stage look={look} />
        {facts?.price?.perNight && !camp && (
          <span className="jm-p">
            <b className="num">{facts.price.perNight.split(" / ")[0]}</b>
            <small>{L("gece", "night")}</small>
          </span>
        )}
      </span>
    </Jump>
  );
}

/** One event as its own card: "Etkinlik" (and "gezinin sebebi"), its name, the day in a capsule or "gün seç", the time, the site, the price a person. */
export function JourneyEvent({ item, date, reason, onGo }: { item: Item; date: string | null; reason: boolean; onGo: (t: GoTarget) => void }) {
  const env = useCardEnv();
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const booked = item.status === "booked";
  const chip = dayChip(date);
  const time = clockOf(item.flight?.departure);
  const brand = brandOf(facts.source?.label, facts.source?.host);
  const prices = ticketPrices(item, facts.price);
  const each = prices?.each ?? null;
  return (
    <Jump className={`jf-c jf-h jf-ev s-${booked ? "booked" : "chosen"}`} label={item.name} target={{ item: item.id }} onGo={onGo}>
      <span className="jf-img ev">
        <FallbackImg className="jf-photo" src={item.imageUrl ?? null} fallback={<img className="jf-art" src="illus/etkinlik-tur.png" alt="" />} />
      </span>
      <span className="jf-t">
        <small className="jc-k">
          <KindIcon kind="activity" size={12} />
          {L("Etkinlik", "Event")}
          {reason && ` · ${L("gezinin sebebi", "the reason for the trip")}`}
        </small>
        <b>{item.name}</b>
        <small className="num">
          {chip ? (
            <span className="jf-dchip">
              <UiIcon name="cal" size={11} />
              {chip}
            </span>
          ) : (
            <span className="jf-flex">{L("gün seç", "pick a day")}</span>
          )}
          {time && ` · ${time}`}
          {brand && <BrandPill brand={brand} />}
        </small>
      </span>
      <span className="jf-r">
        <span className="jf-rs">
          <Who item={item} />
          <Stage look={booked ? "booked" : "chosen"} as="ticket" />
        </span>
        {(each || facts.price) && (
          <span className="jm-p">
            <b className="num">{each ?? facts.price!.text}</b>
            <small>{each ? L("kişi başı", "per person") : (facts.price!.label ?? "")}</small>
          </span>
        )}
      </span>
    </Jump>
  );
}

/** The to-dos and restaurants of a city in one box: a small square each (a table orange, a place to see blue). */
export function JourneyTodo({ items, onGo }: { items: Item[]; onGo: (t: GoTarget) => void }) {
  return (
    <div className="jf-todo">
      <span className="jc-l">
        <UiIcon name="pin" size={13} />
        {L("Yapılacaklar ve restoranlar", "To do and restaurants")}
        <i className="num">{items.length}</i>
      </span>
      <div className="jc-pls">
        {items.map((i) => {
          const food = i.category === "food";
          return (
            <Jump key={i.id} className="jc-pl" label={i.name} target={{ item: i.id }} onGo={onGo}>
              <span className={`jc-pi ${food ? "food" : "go"}`}>
                <img src={`illus/${food ? "restoran" : "yapilacak"}.png`} alt="" />
                <span className="jc-pk">
                  <KindIcon kind={food ? "food" : "activity"} size={11} />
                </span>
                {i.status === "booked" && (
                  <span className="jc-ok" title={lookWord("booked")}>
                    <UiIcon name="check" size={10} />
                    <span className="sr-only">{lookWord("booked")}</span>
                  </span>
                )}
              </span>
              <b>{i.name}</b>
            </Jump>
          );
        })}
      </div>
    </div>
  );
}
