import type { ProCon, ProsCons } from "../lib/proscons";

/**
 * What speaks for an option (left) and against it (right), most important first. The reason it is
 * out, if any, leads the right column. `limit` shows the top lines only (rows, comparison columns).
 */
export function ProsConsView({ pc, limit, stacked = false }: { pc: ProsCons; limit?: number; stacked?: boolean }) {
  const pros = limit ? pc.pros.slice(0, limit) : pc.pros;
  const cons = limit ? pc.cons.slice(0, limit) : pc.cons;
  if (!pros.length && !cons.length) return null;
  return (
    <span className={`pc${stacked ? " stacked" : ""}`}>
      <span className="pc-col pros">
        {pros.map((line) => (
          <Line key={line.key} line={line} sign="+" compact={Boolean(limit)} />
        ))}
        {limit && pc.pros.length > limit && <span className="pc-more">+{pc.pros.length - limit} artı daha</span>}
      </span>
      <span className="pc-col cons">
        {cons.map((line) => (
          <Line key={line.key} line={line} sign="−" compact={Boolean(limit)} />
        ))}
        {limit && pc.cons.length > limit && <span className="pc-more">+{pc.cons.length - limit} eksi daha</span>}
      </span>
    </span>
  );
}

function Line({ line, sign, compact }: { line: ProCon; sign: string; compact: boolean }) {
  const classes = ["pc-line", line.decisive && "decisive", line.unverified && "unverified", line.stale && "stale", line.accepted && "accepted"]
    .filter(Boolean)
    .join(" ");
  // In compact views only what was read carries its source ("7 yorum"); comparisons speak for themselves.
  const detail = line.detail && (!compact || line.kind === "finding" || line.kind === "elimination") ? line.detail : null;
  return (
    <span className={classes} title={line.detail ?? undefined}>
      <span className="pc-sign" aria-hidden>
        {sign}
      </span>
      <span>
        {line.text}
        {detail && <span className="pc-detail"> · {detail}</span>}
      </span>
    </span>
  );
}
