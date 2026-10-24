// The small pieces every Pano card and column shares (plan v81–v83 mk83.js srcB, visual, likes, act, score): where it's from, its
// picture or its carrier's mark, the heart with who liked it, the fit score, and the one button (Seç, + Plana koy, or where it stands).
import { useState, type CSSProperties } from "react";
import { L } from "../../../lib/i18n";
import type { PanoNeed, PanoOption, PanoSource } from "../../../lib/panoBoard";
import type { SectionId } from "../../../lib/categories";
import { cardKind } from "../../../lib/cardKinds";
import { sameName } from "../../../lib/tripSettings";
import { voteKeyOf } from "../../../lib/share/votes";
import { bookingReplaced, pickAria, pickWord, replaceAsk } from "../../../lib/replaceBooking";
import { chooseItem, replaceBooking, toggleLike } from "../../actions";
import { AskWindow, type Ask } from "../../cards/stageMenu";
import { useShare } from "../../Share";
import { useMyName } from "../../Profile";
import { FallbackImg } from "../../FallbackImg";
import { illusOf, stayArtOf } from "../../cards/MediaCard";
import { KindIcon } from "../../cards/Silhouettes";

/** The categories' colours in the approved drawing (v81 data: a square in the side menu, the tint behind a card's picture). */
export const PANO_COLORS: Readonly<Partial<Record<SectionId, string>>> = {
  flight: "#6a4fe0",
  stay: "#23998b",
  transport: "#2563c9",
  activity: "#a8336f",
  todo: "#5d8a1c",
  food: "#5d8a1c",
  other: "#3b6fd1",
};
export const tintOf = (section: SectionId): CSSProperties => ({ "--k": PANO_COLORS[section] ?? "#888" }) as CSSProperties;

const HEART = (
  <svg className="i" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);

/** ✨ Önerimiz · ✨ AI önerisi · Senin linkin · (S) Sabine ekledi. */
export function SourceBadge({ source }: { source: PanoSource | null }) {
  if (!source) return null;
  switch (source.kind) {
    case "ours":
      return <span className="q-src best">✨ {L("Önerimiz", "Our pick")}</span>;
    case "ai":
      return <span className="q-src ai">✨ {L("AI önerisi", "AI pick")}</span>;
    case "link":
      return <span className="q-src mine">{L("Senin linkin", "Your link")}</span>;
    case "person":
      return (
        <span className="q-src mine">
          <i aria-hidden>{source.name.charAt(0).toLocaleUpperCase("tr")}</i>
          {L(`${source.name} ekledi`, `Added by ${source.name}`)}
        </span>
      );
  }
}

/** The option's own page, a web address only: on the Pano its picture and name go there (Emre 2026-10-24: "panoda her şey tıklayınca kaynağına gitsin"). */
export const pageOf = (option: PanoOption): string | null => (option.url && /^https?:\/\//i.test(option.url) ? option.url : null);

/** The picture, going to the option's page when it has one; laid out as the picture alone (pano.css .q-phgo). */
export function PageVisual({ option }: { option: PanoOption }) {
  const go = pageOf(option);
  return go ? (
    <a className="q-phgo" href={go} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
      <Visual option={option} />
    </a>
  ) : (
    <Visual option={option} />
  );
}

/** The option's name, going to its page when it has one. */
export function PageName({ option }: { option: PanoOption }) {
  const go = pageOf(option);
  return (
    <b>
      {go ? (
        <a className="q-pgnm" href={go} target="_blank" rel="noreferrer">
          {option.name}
        </a>
      ) : (
        option.name
      )}
    </b>
  );
}

/** The picture: a page's photo, else the kind's drawing; a ticket its carrier's mark ("TK" on its colour). */
export function Visual({ option }: { option: PanoOption }) {
  if (option.mark) {
    return (
      <span className="q-bigl" style={{ "--bl": option.mark.color ?? "#6b6f80" } as CSSProperties} aria-hidden>
        {option.mark.letters}
      </span>
    );
  }
  const kind = cardKind(option.item);
  const art = kind === "stay" ? stayArtOf(option.item) : illusOf(kind);
  const drawing = art && art !== "tent" ? <img src={`illus/${art}.png`} alt="" /> : <KindIcon kind={kind} size={44} className="q-ic" />;
  return <FallbackImg src={option.image} className="q-photo" fallback={drawing} />;
}

/** The state on the picture: "Alındı", "Planda", "Seçili" (`long`: the comparison's "Şu an seçili"). */
export function StateChip({ option, multi, long = false }: { option: PanoOption; multi: boolean; long?: boolean }) {
  if (option.cancelled) return <span className="q-stc">{L("İptal edildi", "Cancelled")}</span>;
  if (!option.current) return null;
  const word = option.current === "booked" ? L("Alındı", "Booked") : multi ? (long ? L("Şu an planda", "On the plan now") : L("Planda", "On the plan")) : long ? L("Şu an seçili", "Chosen now") : L("Seçili", "Chosen");
  return <span className="q-stc">{word}</span>;
}

/** "91/100 · 1. sırada": the fit score, and in the comparison its place. */
export function Score({ option, ranked = false }: { option: PanoOption; ranked?: boolean }) {
  if (option.score == null) return null;
  return (
    <span className="q-score" title={L("Uyum puanı: niyetine ve tercihlerine göre (AI analizi dahil)", "Fit score: for what you want and prefer (the AI's reading included)")}>
      {option.score}
      <small>/100</small>
      {ranked && option.rank != null && <em>{L(`${option.rank}. sırada`, `#${option.rank}`)}</em>}
    </span>
  );
}

/**
 * ♥ and how many, then who: a like (Beğenilenler of the v11 Pano). On a shared trip the heart is the "Süper" vote, seen on both
 * computers (DOKUNULMAZ #14), and the board owner's own like is kept in step with it.
 */
export function Likes({ option }: { option: PanoOption }) {
  const { item, likes } = option;
  const myName = useMyName();
  const me = myName || "me";
  const share = useShare();
  const liked = likes.some((n) => sameName(n, me) || (share?.me ? sameName(n, share.me) : false));
  const voteKey = share?.me ? voteKeyOf(item) : null;
  const heart = () => {
    if (voteKey && share) share.vote(item, liked ? 0 : 2);
    const mineLocal = (item.likedBy ?? []).some((n) => sameName(n, me));
    if (!voteKey || mineLocal === liked) void toggleLike(item, me);
  };
  const named = likes.map((n) => (n === "me" ? myName || L("Sen", "You") : n));
  return (
    <>
      <button type="button" className={`q-like${liked ? " on" : ""}`} aria-pressed={liked}
        aria-label={liked ? L(`${item.name}: beğeniyi geri al`, `${item.name}: unlike`) : L(`${item.name}: beğen`, `${item.name}: like`)}
        title={named.length ? L(`${named.join(", ")} beğendi`, `Liked by ${named.join(", ")}`) : L("Beğen", "Like")} onClick={heart}>
        {HEART}
        {likes.length}
      </button>
      {named.length > 0 && (
        <span className="q-avs">
          {named.map((n, i) => (
            <i key={`${n}-${i}`} className={sameName(n, me) || (myName && sameName(n, myName)) ? "e" : undefined} title={n}>
              {n.charAt(0).toLocaleUpperCase("tr")}
            </i>
          ))}
        </span>
      )}
    </>
  );
}

/**
 * The one button: "Seç" (one choice: the others of its group go back to options) or "+ Plana koy" (a row of cards); once on the
 * plan, where it stands in its place ("Seçili", "Planda", "✓ Alındı"), not a button. Seçmek planı günceller; bildirim yok (E16).
 */
export function PickButton({ option, need }: { option: PanoOption; need: PanoNeed }) {
  if (option.current) {
    const word = option.current === "booked" ? `✓ ${L("Alındı", "Booked")}` : need.multi ? L("Planda", "On the plan") : L("Seçili", "Chosen");
    return <span className="q-pick">{word}</span>;
  }
  return <Pick option={option} need={need} />;
}

/** "Seç", or with a booking in the need "Bununla değiştir", asked first as on the Plan (replaceBooking.ts). */
function Pick({ option, need }: { option: PanoOption; need: PanoNeed }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const siblings = need.options.filter((o) => o.group === option.group).map((o) => o.item);
  const bookedId = bookingReplaced(need.options.map((o) => o.item), option.item, need.multi);
  const booked = bookedId ? (need.options.find((o) => o.id === bookedId)?.item ?? null) : null;
  const all = need.options.map((o) => o.item);
  const choose = () => {
    if (!booked) return void chooseItem(option.item, need.multi ? [] : siblings);
    setAsk({ ...replaceAsk(booked, option.item), run: () => void replaceBooking(option.item, booked, all) });
  };
  return (
    <>
      <button type="button" className="q-pick" aria-label={booked ? pickAria(option.item.name, true) : undefined} onClick={choose}>
        {need.multi ? `+ ${L("Plana koy", "Add to plan")}` : pickWord(booked != null)}
      </button>
      {ask && <AskWindow ask={ask} onClose={() => setAsk(null)} />}
    </>
  );
}
