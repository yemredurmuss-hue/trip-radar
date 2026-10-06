// Kişiye özel rezervasyon (spec 2026-10-06, docs/mockups/2026-10-06-kisiye-ozel-v1.html): the badge beside a card's
// kind when the plan is some of the trip's people's, never everyone's: their face (20 px, the photo the hero shows,
// else the initial) and "Sabine'in bileti". Nothing for a plan for everyone, or on a one-person trip.
//
// For the cards' top rows (CardShell, PlanCard, TransportCard, the empty cards):
//   <WhoseBadge item={item} trip={trip} />   renders null when whose.ts whoseOf is null
//   useWhoCtx()                             me on this computer, as whoseOf takes it (the sharing name and people)
//   usePhotoOf()                            a person's photo by name, from the hero's sources (Travellers.tsx)
//   <WhoAvatar name photo />                the 20 px face alone (Günlük akış's rows)
import { initials } from "../../lib/heroInfo";
import { sameName } from "../../lib/tripSettings";
import type { Item, Trip } from "../../lib/types";
import { whoseOf, type WhoCtx } from "../../lib/whose";
import { useMyName, useMyPhoto, usePeoplePhotos } from "../Profile";
import { useShare } from "../Share";

/** Me on this computer for whoseOf: the shared trip's me and people, else my profile name. */
export function useWhoCtx(): WhoCtx {
  const share = useShare();
  const myName = useMyName();
  return share ? { me: share.me || null, members: share.state?.members ?? [], shared: true } : myName || null;
}

/** A person's photo, as the hero finds it: the one they share, else mine for me, else the one given here. */
export function usePhotoOf(): (name: string) => string | null {
  const share = useShare();
  const myName = useMyName();
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const me = share ? share.me : myName;
  return (name) => share?.photos[name] || (me && sameName(name, me) ? myPhoto : peoplePhoto(name)) || null;
}

/** The 20 px face: the photo, else the initial on lavender. */
export function WhoAvatar({ name, photo }: { name: string; photo: string | null }) {
  return <span className="wh-av">{photo ? <img src={photo} alt="" /> : initials(name)}</span>;
}

/** "Sabine'in bileti" with her face, or "Emre ve Ali'nin" with both; null when the plan is everyone's. */
export function WhoseBadge({ item, trip }: { item: Item; trip: Pick<Trip, "travellers"> }) {
  const who = useWhoCtx();
  const photoOf = usePhotoOf();
  const whose = whoseOf(item, trip, who);
  if (!whose) return null;
  return (
    <span className="wh-badge" data-whose={whose.names.join(",")} title={whose.label}>
      <span className="wh-faces" aria-hidden>
        {whose.names.slice(0, 3).map((n) => (
          <WhoAvatar key={n} name={n} photo={photoOf(n)} />
        ))}
      </span>
      <span className="wh-label">{whose.label}</span>
    </span>
  );
}
