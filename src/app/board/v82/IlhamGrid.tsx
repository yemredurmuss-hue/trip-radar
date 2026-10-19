// Pano > İlham (plan v81 "İlham", mk83.js ilhamCard; C31): the saved Reels, TikToks, videos and blog posts. A card: its picture with
// the platform's badge and a play (or read) mark, the title to its page, what it is and where, who saved it (and its day, once it
// has one); "✨ İçinden yerleri çıkar" (the chat is asked to read it and put its places on the plan), "Aç ↗", and its one ⋯: a day
// for it ("+ Gün": it becomes a thing to do on that day) and Sil (gone, with the 8-second "Geri al").
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { dayChip, dayChoices } from "../../../lib/ideas";
import { L } from "../../../lib/i18n";
import type { InspoPlatform } from "../../../lib/inspo";
import type { PanoIdea } from "../../../lib/panoBoard";
import type { Plan } from "../../../lib/plan";
import { FallbackImg } from "../../FallbackImg";
import type { MenuEntry } from "../../cards/CardShell";
import { KindIcon } from "../../cards/Silhouettes";
import { DayPicker } from "../../ideas/DayPicker";
import { IntentMenu } from "../../plan/v82/IntentMenu";

/** The platforms' own colours on their badge (the approved drawing's: Instagram, YouTube, TikTok, a blog; Pinterest's red). */
const PLATFORM: Record<InspoPlatform, { label: string; color: string }> = {
  reels: { label: "Instagram", color: "#d6249f" },
  instagram: { label: "Instagram", color: "#d6249f" },
  youtube: { label: "YouTube", color: "#ff0000" },
  tiktok: { label: "TikTok", color: "#111111" },
  pinterest: { label: "Pinterest", color: "#e60023" },
  blog: { label: "Blog", color: "#2b2842" },
};

const PLAY = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const READ = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
    <path d="M6 4h9l3 3v13H6zM9 10h6M9 14h6" />
  </svg>
);

export function IlhamCard({ idea, plan, onExtract, onRemove }: {
  idea: PanoIdea;
  plan: Pick<Plan, "range" | "stayBlocks">;
  /** "✨ İçinden yerleri çıkar": absent when there is no chat to ask. */
  onExtract?: (idea: PanoIdea) => void;
  onRemove: (idea: PanoIdea) => void;
}) {
  const p = idea.platform ? PLATFORM[idea.platform] : null;
  const open = idea.url ?? undefined;
  const days = dayChoices(plan);
  const day = dayChip(idea.item);
  // "+ Gün" from the ⋯: the trip's days open under it; Escape or a press outside shut them, the focus back on ⋯.
  const [picking, setPicking] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);
  const shut = (focus: boolean) => {
    setPicking(false);
    if (focus) menuBox.current?.querySelector<HTMLElement>(".z-mb")?.focus();
  };
  useEffect(() => {
    if (!picking) return;
    menuBox.current?.querySelector<HTMLElement>(".fk-picker button")?.focus();
    const onDown = (e: PointerEvent) => !(e.target instanceof Node && menuBox.current?.contains(e.target)) && shut(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && shut(true);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [picking]);
  const menu: MenuEntry[] = [
    // No dates for the trip yet: no day to pick (one it has can still be taken off from the picker, as before).
    ...(days.length || day ? [{ label: day ? L("Günü değiştir", "Change its day") : L("+ Gün", "+ Day"), run: () => setPicking(true) }] : []),
    { label: L("Sil", "Delete"), run: () => onRemove(idea), danger: true, sep: true },
  ];
  return (
    <article className="q-ih" aria-label={idea.title} data-item-id={idea.id} id={`pn-${idea.id}`} style={{ "--pc": p?.color ?? "#c0256b" } as CSSProperties}>
      <a className="q-ihp" href={open} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <FallbackImg src={idea.item.imageUrl} className="q-photo" fallback={<KindIcon kind="inspo" size={40} />} />
        <span className="q-play">{idea.video ? PLAY : READ}</span>
        {p && <span className="q-plat">{p.label}</span>}
      </a>
      <div className="q-ihm" ref={menuBox}>
        <IntentMenu entries={menu} name={idea.title} />
        {picking && (
          <span className="fk-daywrap">
            <DayPicker item={idea.item} days={days} onDone={() => shut(true)} />
          </span>
        )}
      </div>
      <div className="q-ihb">
        <b>{open ? <a href={open} target="_blank" rel="noreferrer">{idea.title}</a> : idea.title}</b>
        {idea.meta && <small>{idea.meta}</small>}
        <div className="q-ihf">
          <span className="q-ihw">{idea.who}</span>
          {day && <span className="q-ihday">{day}</span>}
          <span className="q-sp" />
          {onExtract && (
            <button type="button" className="q-ihx" onClick={() => onExtract(idea)}>
              ✨ {L("İçinden yerleri çıkar", "Pull out its places")}
            </button>
          )}
          {open && (
            <a className="q-srcl" href={open} target="_blank" rel="noreferrer">
              {L("Aç ↗", "Open ↗")}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function IlhamGrid({ ideas, plan, onExtract, onRemove }: {
  ideas: PanoIdea[];
  plan: Pick<Plan, "range" | "stayBlocks">;
  onExtract?: (idea: PanoIdea) => void;
  onRemove: (idea: PanoIdea) => void;
}) {
  return (
    <div className="q-ihg">
      {ideas.map((idea) => (
        <IlhamCard key={idea.id} idea={idea} plan={plan} onExtract={onExtract} onRemove={onRemove} />
      ))}
    </div>
  );
}
