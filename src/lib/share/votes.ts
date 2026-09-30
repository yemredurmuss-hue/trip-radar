// Votes on a shared trip's options: each traveller 👍 / 👎 an option. They don't change the ranking;
// only when everyone who voted said 👎 (and at least two did) the option steps back like "Ele".
import type { Item } from "../types";
import { parseUrl } from "../url";

export type VoteValue = -1 | 0 | 1;

export interface Vote {
  itemKey: string;
  author: string;
  vote: VoteValue;
  note: string | null;
  /** Server time (ISO) of the vote; a local vote not sent yet has the local time. */
  updatedAt: string;
  /** Said here, not on the server yet (sent on the next sync). */
  pending?: boolean;
}

/**
 * The option's key on both computers: the same page gives the same key on each (an item's local id
 * would not). The place's canonical key, else the page address, else the capture both sides share.
 * Chat plans have none: they are personal and not voted on.
 */
export function voteKeyOf(item: Pick<Item, "key" | "url" | "captureIds" | "origin" | "category">): string | null {
  if (item.origin === "chat") return null;
  if (item.key) return item.key;
  // A flight search page lists many flights: its address doesn't name one.
  const byUrl = item.url && item.category !== "flight" ? parseUrl(item.url).key : null;
  if (byUrl) return byUrl;
  return item.captureIds[0] ? `capture:${item.captureIds[0]}` : null;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");

/**
 * The server's votes, with this traveller's votes not sent yet laid over them (so a 👍 given offline
 * doesn't flip back on the next pull). A pending vote the server already has is no longer pending.
 */
export function mergeVotes(local: Vote[], remote: Vote[], me: string): Vote[] {
  const pending = local.filter((v) => v.pending && sameName(v.author, me));
  const merged = new Map<string, Vote>();
  for (const v of remote) merged.set(`${v.itemKey}|${v.author}`, { ...v, pending: undefined });
  for (const p of pending) {
    const id = `${p.itemKey}|${p.author}`;
    const server = merged.get(id);
    if (server && server.vote === p.vote && server.note === p.note) continue; // arrived
    merged.set(id, p);
  }
  return [...merged.values()].map(({ pending: isPending, ...v }) => (isPending ? { ...v, pending: true } : v));
}

/** Records this traveller's vote locally (pending until the next sync sends it). */
export function withVote(votes: Vote[], itemKey: string, me: string, vote: VoteValue, now = new Date()): Vote[] {
  const rest = votes.filter((v) => !(v.itemKey === itemKey && sameName(v.author, me)));
  return [...rest, { itemKey, author: me, vote, note: null, updatedAt: now.toISOString(), pending: true }];
}

export interface VoteTally {
  /** This traveller's vote (0 = none). */
  mine: VoteValue;
  /** Every vote given (not 0), me first: "Emre 👍 · Sabine 👎". */
  line: string | null;
  /** At least two people voted and all of them said 👎. */
  allNo: boolean;
  /** At least two people voted and all of them said 👍. */
  allYes: boolean;
}

export const VOTE_MARK: Record<Exclude<VoteValue, 0>, string> = { 1: "👍", [-1]: "👎" } as Record<Exclude<VoteValue, 0>, string>;

export function tallyVotes(votes: Vote[], itemKey: string | null, me: string): VoteTally {
  const given = itemKey ? votes.filter((v) => v.itemKey === itemKey && v.vote !== 0) : [];
  const mineRow = itemKey ? votes.find((v) => v.itemKey === itemKey && sameName(v.author, me)) : undefined;
  const ordered = [...given].sort((a, b) => Number(sameName(b.author, me)) - Number(sameName(a.author, me)) || a.author.localeCompare(b.author, "tr"));
  const voters = new Set(given.map((v) => v.author.trim().toLocaleLowerCase("tr")));
  return {
    mine: mineRow?.vote ?? 0,
    line: ordered.length ? ordered.map((v) => `${v.author} ${VOTE_MARK[v.vote as 1 | -1]}`).join(" · ") : null,
    allNo: voters.size >= 2 && given.every((v) => v.vote === -1),
    allYes: voters.size >= 2 && given.every((v) => v.vote === 1),
  };
}
