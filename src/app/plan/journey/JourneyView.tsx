// "Yolculuk sırasıyla" (v81, v82, v83 "gezi sırasında"; z83_build.py trip_html, mk82.js renderTrip): the Plan read in the
// order the trip is lived, from the same boxes (lib/journeyChapters.ts): Yola çıkmadan, the way in, each city, the way
// home; each chapter's steps on one line with their state's dot. A choice made here is the Plan's at once, and "›" goes
// to the box. On the trip (D8) the chapters behind are folded into one line, so the view starts at today's chapter.
import { useId, useState } from "react";
import { L } from "../../../lib/i18n";
import type { JourneyChapter, JourneyView as Journey } from "../../../lib/journeyChapters";
import { ChapterHead } from "./ChapterHead";
import { StepCard, type StepHandlers } from "./StepCard";

/** A chapter's element, for "Yolculuk sırasıyla →" on the Bugün strip. */
export const chapterDomId = (key: string) => `jc-${key.replace(/[^\w-]/g, "_")}`;

function Chapter({ chapter, tripId, on }: { chapter: JourneyChapter; tripId: string; on: StepHandlers }) {
  const headId = useId();
  return (
    <section className={`q-chap${chapter.today ? " now" : ""}`} id={chapterDomId(chapter.key)} data-chapter={chapter.kind} aria-labelledby={headId}>
      <ChapterHead chapter={chapter} headId={headId} />
      {chapter.steps.length > 0 && (
        <div className="q-steps">
          {chapter.steps.map((s) => (
            <StepCard key={s.key} step={s} tripId={tripId} on={on} />
          ))}
        </div>
      )}
    </section>
  );
}

export function JourneyView({ journey, tripId, on }: { journey: Journey; tripId: string; on: StepHandlers }) {
  const [pastOpen, setPastOpen] = useState(false);
  const pastId = useId();
  // On the trip only: before it nothing is behind, after it everything is (the plan is an archive, read whole).
  const past = journey.todayKey ? journey.chapters.filter((c) => c.past && !c.today) : [];
  const ahead = journey.chapters.filter((c) => !past.includes(c));
  return (
    <div className="section trip-plan q-trip" data-pit-children>
      {past.length > 0 && (
        <div className={`q-past${pastOpen ? " open" : ""}`}>
          <button type="button" className="q-pastb" aria-expanded={pastOpen} aria-controls={pastId} onClick={() => setPastOpen(!pastOpen)}>
            <b>{L("Geride kalanlar", "Behind you")}</b>
            <small>{past.map((c) => c.title).join(" · ")}</small>
            <span className="q-pastc" aria-hidden>
              ▾
            </span>
          </button>
          <div id={pastId} className="q-pastl" hidden={!pastOpen}>
            {pastOpen && past.map((c) => <Chapter key={c.key} chapter={c} tripId={tripId} on={on} />)}
          </div>
        </div>
      )}
      {ahead.map((c) => (
        <Chapter key={c.key} chapter={c} tripId={tripId} on={on} />
      ))}
    </div>
  );
}
