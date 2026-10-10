// Who did what on a shared trip (docs/mockups/ux-katmanli-arayuz, "Kim ne yaptı" and "Son ziyaretten beri"): read from what is
// already kept, never made up: the votes (author, time), the pages a fellow traveller saved (Item.addedBy, createdAt), and
// the changes of the shared settings that came from the other traveller (the notices: author, time). Records the traveller
// changed on their own computer aren't shared, so they aren't here. Pure.
import { L } from "../i18n";
import { sameName } from "../tripSettings";
import type { Item } from "../types";
import type { SettingsNotice } from "./notices";
import { changeHeadline } from "./settingsDiff";
import { VOTE_MARK, voteKeyOf, type Vote } from "./votes";

export interface Action {
  /** ms */
  at: number;
  who: string;
  /** "Oy verdi: 👍 Jardim Stay", "Kaydetti: Casa Azul", "Tarihleri değiştirdi". */
  text: string;
}

export interface ActivityInput {
  me: string;
  votes: readonly Vote[];
  notices: readonly SettingsNotice[];
  items: readonly Item[];
}

const ms = (iso: string | null | undefined): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Every action on the trip there is a record of, newest first. */
export function actionsOf({ me, votes, notices, items }: ActivityInput): Action[] {
  const out: Action[] = [];
  const byKey = new Map<string, Item>();
  for (const i of items) {
    const k = voteKeyOf(i);
    if (k && !byKey.has(k)) byKey.set(k, i);
  }
  for (const v of votes) {
    const item = byKey.get(v.itemKey);
    const at = ms(v.updatedAt);
    const mark = VOTE_MARK[v.vote as keyof typeof VOTE_MARK];
    if (!item || at == null || !mark || v.vote === 0) continue;
    out.push({ at, who: v.author, text: L(`Oy verdi: ${mark} ${item.name}`, `Voted ${mark} on ${item.name}`) });
  }
  for (const i of items) {
    if (i.addedBy === "ai" || i.origin === "chat" || i.status === "dismissed") continue;
    // A page the other traveller shared carries their name; my own saves carry none.
    out.push({ at: i.createdAt, who: i.addedBy ?? me, text: L(`Kaydetti: ${i.name}`, `Saved: ${i.name}`) });
  }
  for (const n of notices) {
    const at = ms(n.at);
    if (at == null) continue;
    const said = changeHeadline(n.author, n.fields);
    out.push({ at, who: n.author, text: said.startsWith(n.author) ? said.slice(n.author.length).trim() : said });
  }
  return out.filter((a) => a.who.trim()).sort((a, b) => b.at - a.at);
}

/** One traveller's latest action, or null when nothing is recorded of them. */
export const latestOf = (name: string, input: ActivityInput): Action | null => actionsOf(input).find((a) => sameName(a.who, name)) ?? null;

/** What the others did after `since` (ms), newest first: the Pano tab's dot. */
export const othersSince = (since: number, input: ActivityInput): Action[] => actionsOf(input).filter((a) => a.at > since && !sameName(a.who, input.me));

/** "az önce", "12 dk önce", "3 sa önce", "2 gün önce". */
export function agoText(at: number, now: number): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return L("az önce", "just now");
  if (min < 60) return L(`${min} dk önce`, `${min} min ago`);
  const h = Math.floor(min / 60);
  if (h < 24) return L(`${h} sa önce`, `${h} h ago`);
  const days = Math.floor(h / 24);
  return L(`${days} gün önce`, `${days} day${days === 1 ? "" : "s"} ago`);
}
