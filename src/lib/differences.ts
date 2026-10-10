// What the options compared together say differently. Pure: from what was read on each option's pages,
// one row per thing said (clustered like saysSame: "a river view", "noise at night"), one cell per
// option: said there (how many guests, how recent, how likely still so), not said, or the page not read.
// What (nearly) every option has doesn't help choose and moves no ranking; what only some have does.
import { evidenceOf, FADED, saysSame, standing } from "./listing";
import type { Finding, FindingTopic, Listing } from "./types";

export interface DiffCell {
  /** Said on this option's pages; read and not said; or its pages not read (unknown either way). */
  state: "present" | "absent" | "unread";
  /** The finding that says it best here (present only). */
  finding: Finding | null;
  /** Stored reviews behind it. */
  count: number;
  /** Newest review behind it, YYYY-MM. */
  newest: string | null;
  /** How likely it's still so (see stillTrue); 0 when not present. */
  confidence: number;
  /** How much of it stands: backing × confidence (see standing); 0 when not present. */
  standing: number;
}

export interface DiffRow {
  key: string;
  topic: FindingTopic;
  polarity: Finding["polarity"];
  /** The words of the best-backed finding in the row. */
  text: string;
  /** By listing key. */
  cells: Record<string, DiffCell>;
  /** Options where it's said and not faded. */
  present: number;
  /** Options whose pages were read. */
  read: number;
  /** Said for (nearly) every option read: true, but it doesn't help choose ("fark yaratmıyor"). */
  neutral: boolean;
  /** Said for only one of two or more options read: what sets it apart. */
  unique: boolean;
  /** `${listingKey}|${findingId}` of every finding in the row. */
  members: string[];
}

const EMPTY: Omit<DiffCell, "state"> = { finding: null, count: 0, newest: null, confidence: 0, standing: 0 };

export const memberKey = (listing: Pick<Listing, "key">, f: Pick<Finding, "id">) => `${listing.key}|${f.id}`;

/**
 * The difference table for a group of options (their listings, in the group's order; an unread or
 * missing one is "not read"). Verified findings only; history (only guests over a year ago) is left out.
 * Neutral: said for every option read (all but one when four or more were read), by two at least.
 */
export function differencesOf(listings: (Listing | undefined)[], today: string): DiffRow[] {
  const all = [...new Map(listings.filter((l): l is Listing => Boolean(l)).map((l) => [l.key, l])).values()];
  const read = all.filter((l) => l.readAt);
  const rows: { topic: FindingTopic; polarity: Finding["polarity"]; found: Finding[]; members: string[]; cells: Map<string, DiffCell> }[] = [];
  for (const l of read) {
    for (const f of l.findings) {
      if (!f.verified) continue;
      const e = evidenceOf(f, l, today);
      if (e.stale) continue;
      let row = rows.find((r) => r.polarity === f.polarity && r.topic === f.topic && r.found.some((m) => saysSame(f, m)));
      if (!row) {
        row = { topic: f.topic, polarity: f.polarity, found: [], members: [], cells: new Map() };
        rows.push(row);
      }
      row.found.push(f);
      row.members.push(memberKey(l, f));
      const cell: DiffCell = { state: "present", finding: f, count: e.count, newest: e.newest, confidence: e.still.confidence, standing: standing(e) };
      const before = row.cells.get(l.key);
      if (!before || cell.standing > before.standing) row.cells.set(l.key, cell);
    }
  }
  return rows.map((r) => {
    const cells: Record<string, DiffCell> = {};
    for (const l of all) cells[l.key] = r.cells.get(l.key) ?? { state: l.readAt ? "absent" : "unread", ...EMPTY };
    const present = Object.values(cells).filter((c) => c.state === "present" && c.confidence >= FADED).length;
    const best = [...r.cells.values()].sort((a, b) => b.standing - a.standing)[0].finding!;
    const nearlyAll = read.length - (read.length >= 4 ? 1 : 0);
    return {
      key: `${r.topic}:${r.polarity}:${best.id}`,
      topic: r.topic,
      polarity: r.polarity,
      text: best.text,
      cells,
      present,
      read: read.length,
      neutral: read.length >= 2 && present >= 2 && present >= nearlyAll,
      unique: read.length >= 2 && present === 1,
      members: r.members,
    };
  });
}

/** The row a finding of this listing is in, if any. */
export function rowOf(rows: DiffRow[] | undefined, listing: Pick<Listing, "key">, f: Pick<Finding, "id">): DiffRow | undefined {
  const key = memberKey(listing, f);
  return rows?.find((r) => r.members.includes(key));
}
