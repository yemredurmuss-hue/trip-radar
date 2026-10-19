// Who goes, in the hero's card (0.37): the people by name (the names typed here or said in the chat, the shared
// trip's people, me), else as many as the saves say. A tap opens a small box under it: the names with ×, "İsim
// ekle" (Enter), how many go, and, apart, "Birini davet et (paylaş)" for the share dialog. Naming someone shares
// nothing. Each name's circle takes a photo (0.37, kept only on this computer). Closes on a click outside or Esc.
import { useEffect, useId, useRef, useState } from "react";
import { initials, nChildren, nPeople, travellersTitle } from "../lib/heroInfo";
import { agoText, latestOf, type Action } from "../lib/share/activity";
import { L } from "../lib/i18n";
import { ablative } from "../lib/i18nText";
import { fromOf, sameName, whoGoes, type Who } from "../lib/tripSettings";
import type { Item, Trip } from "../lib/types";
import { changeTravellers } from "./actions";
import { HeroIcon } from "./Icons";
import { TipOn } from "./HoverTip";
import { PersonPhoto, useMyName, useMyPhoto, usePeoplePhotos } from "./Profile";
import { ShareLine, useShare } from "./Share";
import { useAppear } from "./useAppear";

/** Who goes on the trip on screen, as the hero and the budget's level count them. */
export function useWho(trip: Trip, adults: number | null): Who {
  const share = useShare();
  const myName = useMyName();
  return whoGoes({
    travellers: trip.travellers,
    me: share ? share.me : myName,
    members: share?.state?.members ?? [],
    shared: Boolean(share),
    adults,
  });
}

/** Each person's latest action on a shared trip (lib/share/activity.ts): what the votes, the saved pages and the settings changes record. Nothing on a trip that isn't shared. */
export function useLatest(items: Item[]): (name: string | null | undefined) => Action | null {
  const share = useShare();
  return (name) => (share && name ? latestOf(name, { me: share.me, votes: share.votes, notices: share.notices, items }) : null);
}

export function Travellers({ trip, who, onShare, items = [] }: { trip: Trip; who: Who; onShare?: () => void; items?: Item[] }) {
  const share = useShare();
  const latest = useLatest(items);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Profile photos (0.36): the shared trip's people's own, else the one I gave them (0.37); mine in the first circle.
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const { names, count } = who;
  const photoOf = (n: number, name: string | undefined) => (name && share?.photos[name]) || (n === 0 ? myPhoto : peoplePhoto(name)) || null;
  const appear = useAppear(count > 0);
  const title = travellersTitle(names, count);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus(); // back where the keyboard was
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const body =
    count > 0 ? (
      <>
        <span className="hx-avatars" aria-hidden>
          {Array.from({ length: Math.min(count, 4) }, (_, n) => (
            <FaceTip key={n} name={names[n]} action={latest(names[n])} me={n === 0}>
              {(bind) => (
                <i {...bind} className={`p${n % 4}${photoOf(n, names[n]) ? " photo" : ""}`}>
                  {photoOf(n, names[n]) ? <img src={photoOf(n, names[n])!} alt="" /> : names[n] ? initials(names[n]) : <HeroIcon name="user" size={24} />}
                </i>
              )}
            </FaceTip>
          ))}
          {count > 4 && <i className="more">+{count - 4}</i>}
        </span>
        <span className="hx-who-text">
          <b>{title}</b>
          {names.length > 0 ? <small>{nPeople(count)}</small> : onShare && <small className="accent">{L("Birini davet et", "Invite someone")}</small>}
        </span>
      </>
    ) : (
      <>
        <span className="hx-avatars" aria-hidden>
          <i className="dashed">
            <HeroIcon name="user" size={24} />
          </i>
        </span>
        <span className="hx-who-text">
          <b>{L("Kimler gidiyor?", "Who's going?")}</b>
          <small>{L("Kişi sayısı kayıtlardan anlaşılır", "The saves tell how many")}</small>
        </span>
      </>
    );

  return (
    <div className="hx-who-box" ref={box}>
      <button
        key={count > 0 ? "full" : "none"}
        ref={trigger}
        type="button"
        className={`hx-people${appear}`}
        title={L("Kimler gidiyor?", "Who's going?")}
        aria-label={`${count > 0 ? `${title} · ${nPeople(count)}` : L("Kimler gidiyor?", "Who's going?")} · ${L("Düzenle", "Edit")}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        {body}
      </button>
      {open && (
        <WhoPopover
          trip={trip}
          who={who}
          latest={latest}
          isShared={Boolean(share)}
          shared={share ? (share.state?.members ?? []) : []}
          ownPhotos={share?.photos ?? {}}
          onInvite={
            onShare
              ? () => {
                  setOpen(false);
                  onShare();
                }
              : undefined
          }
        />
      )}
      {share && (
        <div className="hx-share">
          <ShareLine />
        </div>
      )}
    </div>
  );
}

/** Over a face: who it is and what they did last, when something is recorded; the same line is in the box a tap opens. */
export function FaceTip({ name, action, me, children }: { name: string | undefined; action: Action | null; me: boolean; children: Parameters<typeof TipOn>[0]["children"] }) {
  const tip = name && action ? (
    <>
      <b className="tipx-h">{me ? L(`${name} (sen)`, `${name} (you)`) : name}</b>
      <span className="tipx-line">
        <span>{action.text}</span>
      </span>
      <span className="tipx-note">{agoText(action.at, Date.now())}</span>
    </>
  ) : null;
  return <TipOn tip={tip} below>{children}</TipOn>;
}

/** Under a name in the box: their latest action and when ("Oy verdi: 👍 Jardim Stay · 2 sa önce"). */
function Latest({ action }: { action: Action | null }) {
  if (!action) return null;
  return (
    <small className="wh-last">
      {action.text} · {agoText(action.at, Date.now())}
    </small>
  );
}

export function WhoPopover({ trip, who, latest, isShared, shared, ownPhotos, onInvite }: { trip: Trip; who: Who; latest: (name: string | null | undefined) => Action | null; isShared: boolean; shared: string[]; ownPhotos: Record<string, string>; onInvite?: () => void }) {
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const said = trip.travellers?.names ?? [];
  const meName = who.me;
  // Me first, never removable; the shared trip's people come from sharing (removed there); the names said, with ×.
  const others = said.filter((n) => !sameName(n, meName) && !shared.some((m) => sameName(m, n)));
  const fromShare = shared.filter((m) => !sameName(m, meName));
  const named = Math.max(1, who.names.length);
  const count = trip.travellers?.count ?? null;
  const titleId = useId();
  const [note, setNote] = useState<string | null>(null);
  const add = () => {
    const value = name.trim();
    if (!value) return;
    setName("");
    // My own name typed: that's "Ben", already counted (never a second me).
    if (sameName(value, meName)) return setNote(L(`${value} sensin: zaten "Ben" olarak sayılıyorsun.`, `${value} is you: you're already counted as "Me".`));
    setNote(null);
    void changeTravellers(trip.id, { add: [value] }, L(`Gidenler: ${value} eklendi`, `Who's going: ${value} added`));
  };
  const remove = (n: string) => void changeTravellers(trip.id, { remove: [n] }, L(`Gidenler: ${n} çıkarıldı`, `Who's going: ${n} taken off`));
  // Said here, the count stands over the saves' ("tek gidiyorum" though the hotel page was for two), never under the names.
  // D12: the adults and the children make the count; the rooms are said apart (the stays' searches take them).
  const kids = who.children;
  const setAdults = (next: number) => {
    const n = Math.max(next + kids, named, kids + 1);
    void changeTravellers(trip.id, { count: n }, L(`Gidenler: ${nPeople(n)}`, `Who's going: ${nPeople(n)}`));
  };
  const setChildren = (next: number) => {
    const c = Math.max(0, next);
    const n = Math.max(who.adults + c, named);
    const said = c ? `${nPeople(n)}, ${nChildren(c)}` : nPeople(n);
    void changeTravellers(trip.id, { count: n, children: c || null }, L(`Gidenler: ${said}`, `Who's going: ${said}`));
  };
  const rooms = who.rooms ?? 1;
  const setRooms = (next: number) => void changeTravellers(trip.id, { rooms: next > 1 ? next : null }, L(`Oda: ${next}`, `Rooms: ${next}`));
  const stepper = (label: string, value: number, set: (n: number) => void, min: number, max: number, words: [string, string, string, string]) => (
    <div className="hx-who-count">
      <span>{label}</span>
      <span className="stepper">
        <button type="button" aria-label={L(words[0], words[1])} disabled={value <= min} onClick={() => set(value - 1)}>
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={L(words[2], words[3])} disabled={value >= max} onClick={() => set(value + 1)}>
          +
        </button>
      </span>
    </div>
  );
  return (
    <div className="hx-pop hx-who-pop" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <h4 id={titleId}>{L("Kimler gidiyor?", "Who's going?")}</h4>
      <ul className="hx-who-list">
        <li>
          <PersonPhoto name={meName || L("Ben", "Me")} photo={myPhoto} me />
          <span className="who-name">
            {meName ? L(`Ben (${meName})`, `Me (${meName})`) : L("Ben", "Me")}
            <From place={fromOf(trip.travellers, meName)} />
            <Latest action={latest(meName)} />
          </span>
        </li>
        {fromShare.map((m) => (
          <li key={`s:${m}`}>
            <PersonPhoto name={m} photo={peoplePhoto(m)} own={ownPhotos[m] ?? null} />
            <span className="who-name">
              {m}
              <From place={fromOf(trip.travellers, m)} />
              <Latest action={latest(m)} />
            </span>
            <small>{L("paylaşımda", "on the share")}</small>
          </li>
        ))}
        {others.map((n) => (
          <li key={n}>
            <PersonPhoto name={n} photo={peoplePhoto(n)} />
            <span className="who-name">
              {n}
              <From place={fromOf(trip.travellers, n)} />
            </span>
            <button type="button" className="who-x" aria-label={L(`${n} çıkar`, `Remove ${n}`)} title={L("Çıkar", "Remove")} onClick={() => remove(n)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="hx-who-add">
        <input
          ref={input}
          type="text"
          value={name}
          maxLength={40}
          placeholder={L("İsim ekle", "Add a name")}
          aria-label={L("İsim ekle", "Add a name")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-small" disabled={!name.trim()} onClick={add}>
          {L("Ekle", "Add")}
        </button>
      </div>
      {note && (
        <p className="hx-who-note" role="status">
          {note}
        </p>
      )}
      {stepper(L("Yetişkin", "Adults"), who.adults, setAdults, Math.max(1, named - kids), 50 - kids, ["Bir yetişkin az", "One adult fewer", "Bir yetişkin fazla", "One more adult"])}
      {stepper(L("Çocuk", "Children"), kids, setChildren, 0, 50 - who.adults, ["Bir çocuk az", "One child fewer", "Bir çocuk fazla", "One more child"])}
      {stepper(L("Oda", "Rooms"), rooms, setRooms, 1, 20, ["Bir oda az", "One room fewer", "Bir oda fazla", "One more room"])}
      {count != null && count > named && (
        <p className="hx-who-note">{L(`${count - named} kişinin adı yok; sayıya dahil.`, `${count - named} without a name, counted.`)}</p>
      )}
      {!isShared && <p className="hx-who-note">{L("İsim eklemek paylaşmaz; davet etmek ayrı.", "Adding a name shares nothing; inviting is separate.")}</p>}
      {onInvite && (
        <button type="button" className="hx-link hx-who-invite" onClick={onInvite}>
          {L("Birini davet et (paylaş)", "Invite someone (share)")}
        </button>
      )}
    </div>
  );
}

/** Under a name: where they come from when it is not where the trip leaves from ("Alicante'den"; kişiye özel rezervasyon). */
function From({ place }: { place: string | null }) {
  if (!place) return null;
  return <small className="wh-from">{L(ablative(place), `from ${place}`)}</small>;
}
