// A chapter's head in "Yolculuk sırasıyla" (v81, v82 "şehir bölümleri hero'daki fotoğraflarla"; z83_build.py trip_html):
// a city with its picture (the hero's own, Trip.cityImages), its name, its days and nights and "2 hazır · 1 karar"; the way
// in or home and "Yola çıkmadan" with their sign. The chapter today is in says "Bugün" (D8).
import { L } from "../../../lib/i18n";
import type { JourneyChapter } from "../../../lib/journeyChapters";
import { KindIcon, UiIcon } from "../../cards/Silhouettes";
import { FallbackImg } from "../../FallbackImg";

/** "2 hazır" in green and "1 karar" in purple; nothing when nothing is counted. */
function Summary({ chapter }: { chapter: JourneyChapter }) {
  const { ready, open } = chapter.summary;
  if (!ready && !open) return null;
  return (
    <span className="q-chap-sum" aria-label={chapter.summary.text}>
      {ready > 0 && <i className="ok">{L(`${ready} hazır`, `${ready} ready`)}</i>}
      {open > 0 && <i>{L(`${open} karar`, `${open} to decide`)}</i>}
    </span>
  );
}

export function ChapterHead({ chapter, headId }: { chapter: JourneyChapter; headId: string }) {
  const now = chapter.today && <span className="q-chap-now">{L("Bugün", "Today")}</span>;
  if (chapter.kind === "city") {
    const pin = (
      <span className="q-chap-ph">
        <UiIcon name="pin" size={22} />
      </span>
    );
    return (
      <div className="q-chap-h city">
        <div className="q-chap-img" aria-hidden>
          {chapter.photo?.url ? <FallbackImg src={chapter.photo.url} className="q-chap-photo" fallback={pin} /> : pin}
        </div>
        <div className="q-chap-t">
          <b id={headId}>{chapter.title}</b>
          {chapter.sub && <small>{chapter.sub}</small>}
          <Summary chapter={chapter} />
        </div>
        {now}
      </div>
    );
  }
  return (
    <div className="q-chap-h">
      <span className="q-chap-ic" aria-hidden>
        <KindIcon kind={chapter.kind === "travel" ? "flight" : "prep"} size={17} />
      </span>
      <div className="q-chap-t">
        <b id={headId}>{chapter.title}</b>
        {chapter.sub && <small>{chapter.sub}</small>}
      </div>
      {now}
    </div>
  );
}
