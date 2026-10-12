// "Kimin için?" in a card's ••• (kişiye özel rezervasyon): everyone, or some of the trip's people ticked; only on a trip of
// two or more. The empty cards of a record share it with the plan card's own copy of the same menu (PlanCard.tsx).
import { L } from "../../lib/i18n";
import { sameName } from "../../lib/tripSettings";
import type { Item } from "../../lib/types";
import { isUnnamedMe, peopleOf, whoseOf } from "../../lib/whose";
import { setOwner } from "../actions";
import type { MenuEntry } from "./CardShell";
import { useCardEnv } from "./PlanCard";
import { usePhotoOf, useWhoCtx, WhoAvatar } from "./WhoseBadge";

export function useWhoMenu(item: Item): MenuEntry[] {
  const env = useCardEnv();
  const who = useWhoCtx();
  const photoOf = usePhotoOf();
  const people = peopleOf(env.trip, who);
  if (people.length < 2) return [];
  const whose = whoseOf(item, env.trip, who);
  const owners = whose?.names ?? [];
  const setFor = (names: string[]) => void setOwner(item.id, names.length && names.length < people.length ? names : null);
  return [
    { label: L("Kimin için?", "Who's it for?"), heading: true, run: () => undefined },
    { label: L("Herkes", "Everyone"), checked: !whose, run: () => setFor([]) },
    ...people.map((n) => {
      const on = owners.some((o) => sameName(o, n));
      return {
        label: isUnnamedMe(n, who) ? L("Ben", "Me") : n,
        checked: on,
        lead: <WhoAvatar name={n} photo={photoOf(n)} />,
        run: () => setFor(on ? owners.filter((o) => !sameName(o, n)) : whose ? [...owners, n] : [n]),
      };
    }),
  ];
}
