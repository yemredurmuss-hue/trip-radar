// Background work (hareket dili, m-isik): a thin light runs along the top of the page while captures are being read, the pill with the
// number still to read sits where it always did, and at the very end it says "N kayıt eklendi ✓" and fades. Neither the light nor the
// turning mark shows for a job that is over within 0.4 s (useLate); with reduced motion the light is a still, faint line.
import { useEffect, useRef, useState } from "react";
import { L } from "../lib/i18n";
import { useLate } from "./motion";

/** The "kayıt eklendi" message stays this long (app.css `mv-pill-bye` runs for the same time). */
export const DONE_MS = 2200;

/** The light along the top: a third of the width, running left to right, 1.2 s a pass. */
export function WorkLine({ on }: { on: boolean }) {
  const shown = useLate(on);
  return (
    <div className={`work-line${shown ? " on" : ""}`} aria-hidden>
      <i />
    </div>
  );
}

/** How many of the `peak` saves were added: those that did not end as failures since the work began. Pure. */
export const addedCount = (peak: number, failedNow: number, failedBefore: number): number => Math.max(0, peak - Math.max(0, failedNow - failedBefore));

export function WorkPill({ count, failed }: { count: number; failed: number }) {
  const [added, setAdded] = useState(0);
  const was = useRef(0);
  const peak = useRef(0);
  const failedBefore = useRef(0);
  const bye = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spin = useLate(count > 0);
  useEffect(() => {
    if (count > 0 && was.current === 0) {
      clearTimeout(bye.current);
      setAdded(0);
      peak.current = count;
      failedBefore.current = failed;
    }
    peak.current = Math.max(peak.current, count);
    if (count === 0 && was.current > 0) {
      const n = addedCount(peak.current, failed, failedBefore.current);
      if (n > 0) {
        setAdded(n);
        bye.current = setTimeout(() => setAdded(0), DONE_MS);
      }
    }
    was.current = count;
  }, [count, failed]);
  useEffect(() => () => clearTimeout(bye.current), []);
  return (
    <>
      <WorkLine on={count > 0} />
      {(count > 0 || added > 0) && (
        <div className="errors work-slot">
          {count > 0 ? (
            <div className="muted work-pill" role="status">
              {spin && <span className="work-spin" aria-hidden />}
              {L(`${count} kayıt işleniyor…`, `Processing ${count} save${count === 1 ? "" : "s"}…`)}
            </div>
          ) : (
            <div className="muted work-pill done" role="status">
              {L(`${added} kayıt eklendi ✓`, `${added} save${added === 1 ? "" : "s"} added ✓`)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
