// Pano > İlham (plan v81 "İlham", mk83.js ilhamCard; C31): the saved Reels, TikToks, videos and blog posts. A card: its picture with
// the platform's badge and a play (or read) mark, the title to its page, what it is and where, who saved it; "✨ İçinden yerleri
// çıkar" (the chat is asked to read it and put its places on the plan), "Aç ↗", a day for it ("+ Gün": it becomes a thing to do on
// that day) and × (gone, with the 8-second "Geri al").
import type { CSSProperties } from "react";
import { L } from "../../../lib/i18n";
import type { InspoPlatform } from "../../../lib/inspo";
import type { PanoIdea } from "../../../lib/panoBoard";
import type { Plan } from "../../../lib/plan";
import { FallbackImg } from "../../FallbackImg";
import { DeleteX } from "../../cards/CardShell";
import { KindIcon } from "../../cards/Silhouettes";
import { DayButton } from "../../ideas/DayPicker";

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
  return (
    <article className="q-ih" aria-label={idea.title} data-item-id={idea.id} id={`pn-${idea.id}`} style={{ "--pc": p?.color ?? "#c0256b" } as CSSProperties}>
      <a className="q-ihp" href={open} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <FallbackImg src={idea.item.imageUrl} className="q-photo" fallback={<KindIcon kind="inspo" size={40} />} />
        <span className="q-play">{idea.video ? PLAY : READ}</span>
        {p && <span className="q-plat">{p.label}</span>}
      </a>
      <DeleteX name={idea.title} onDelete={() => onRemove(idea)} className="q-ihdel" />
      <div className="q-ihb">
        <b>{open ? <a href={open} target="_blank" rel="noreferrer">{idea.title}</a> : idea.title}</b>
        {idea.meta && <small>{idea.meta}</small>}
        <div className="q-ihf">
          <span className="q-ihw">{idea.who}</span>
          <span className="q-sp" />
          <DayButton item={idea.item} plan={plan} />
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
