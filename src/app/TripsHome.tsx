import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { requestProcessing } from "../lib/browser";
import { countdown, countdownText } from "../lib/countdown";
import { initials } from "../lib/heroInfo";
import { L, lang, saveLang, withLang, type Lang } from "../lib/i18n";
import { formatDateRange, nightsBetween, tripDateRange } from "../lib/items";
import { retryCapture } from "../lib/process";
import { listDrafts, onDraftsChanged, removeDraft, saveDraft } from "../lib/startDrafts";
import { askWord, checklist, dative, detectLang, progressOf, splitLinks, tripNamedIn, type StartCtx, type StartMode, type StartState } from "../lib/startTrip";
import { creditLine, creditOf } from "../lib/cityImages";
import { tripCardPhoto } from "../lib/tripBrief";
import { isDemoTrip } from "../lib/trips";
import { getSettings, listMessages, onChanged } from "../lib/db";
import { canPick, CURRENCIES, CURRENCY_SIGN, displayCurrency, saveCurrency, type DisplayCurrency } from "../lib/displayCurrency";
import { getRates, type Rates } from "../lib/currency";
import { HOME_HASH } from "../lib/openingTrip";
import type { Capture, ChatMessage, Item, Settings, Trip } from "../lib/types";
import { RoutingLine } from "./Chat";
import { UiIcon } from "./cards/Silhouettes";
import { UndoRing } from "./cards/UndoToast";
import { addImages, addLinks } from "./capture";
import { HomeBackdrop } from "./HomeBackdrop";
import { Mascot } from "./Mascot";
import { HeroIcon, type HeroIconName } from "./Icons";
import { DiceIcon, HINTS, IDEAS, IdeaArt, ideasFor, ideaTip, inLang, RefreshIcon } from "./homeIdeas";
import { useMyPhoto, usePeoplePhotos } from "./Profile";
import { JoinShared } from "./Share";
import { DraftCard, TripCard } from "./TripCard";
import { joinTr } from "./TripPanel";
import { reducedMotion } from "./motion";
import { WorkPill } from "./WorkPill";

/** What opens the start chat: a mode (an idea chip's, or "Sürpriz bir yer"), what was typed, or a draft to go on with. */
export interface StartLaunch {
  mode: StartMode;
  text?: string;
  label?: string;
  /** Said first by the assistant (links typed with the words were saved). */
  note?: string;
  draft?: StartState;
}

interface Props {
  trips: Trip[];
  items: Item[];
  openCaptures: Capture[];
  onOpen: (tripId: string) => void;
  onDemo: () => void;
  onSettings: () => void;
  /** The start chat (spec 2026-10-06 §2). */
  onStart: (launch: StartLaunch) => void;
  /** "Porto'da bir otel daha" said for a trip there is: that trip opens and its chat gets the line. */
  onAddToTrip: (tripId: string, text: string) => void;
  ctx: StartCtx;
  /** Geçmiş ve çöp kutusu. */
  onTrash: () => void;
  /** A card's × (0.47.0): the trip to the trash for 30 days, "Geri al" on the overview. */
  onDelete: (tripId: string) => void;
}

/** How long the box's placeholder line stays, and its fade out before the next one (app.css `.st-ph.out`). */
const HINT_MS = 3200;
const HINT_FADE_MS = 450;

/** The people's own colours (v11: Emre violet, Sabine teal), then the rest of the set, the same name the same colour. */
const FACES = ["#5b45e0", "#1d8577", "#c0256b", "#b5761c", "#2563c9", "#5d8a1c"];
const faceColour = (name: string, order: string[]) => FACES[Math.max(0, order.indexOf(name)) % FACES.length];

/** A face: the photo when there is one, else the initials on the person's colour. */
function Face({ name, photo, colour, size = 30 }: { name: string; photo: string | null; colour: string; size?: number }) {
  return (
    <span className="hm-face" style={{ width: size, height: size, background: photo ? undefined : colour, fontSize: Math.round(size * 0.4) }} title={name}>
      {photo ? <img src={photo} alt="" /> : initials(name) || <HeroIcon name="user" size={Math.round(size * 0.55)} />}
    </span>
  );
}

/** "Claude Sonnet 5.5", "Gemini 3 Flash": the model in words for the corner card. */
function modelName(s: Settings): string {
  const id = s.provider === "gemini" ? s.geminiModel : s.model;
  const words = id
    .replace(/-preview$|-\d{8}$/g, "")
    .split("-")
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
  // "5 5" → "5.5"; "4 5" → "4.5"
  return words.join(" ").replace(/(\d) (\d)\b/g, "$1.$2");
}

/** Closes on a press outside it or Escape (the focus back on its button). */
function usePopover(): { open: boolean; setOpen: (v: boolean) => void; box: React.RefObject<HTMLDivElement | null>; button: React.RefObject<HTMLButtonElement | null> } {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, box, button };
}

/**
 * A language or money picked here reloads every board tab into it (main.tsx: the stored choice changed); this tab
 * comes back to the home ("#home"), not to the trip another open board was showing last.
 */
const stayHome = () => history.replaceState(null, "", `${location.pathname}${HOME_HASH}`);

/** A small pill in the top bar (₺, TR) opening its list of choices. */
function Picker({ label, shown, current, options, onPick }: { label: string; shown: string; current: string | null; options: { value: string; text: string; off?: string }[]; onPick: (v: string) => void }) {
  const { open, setOpen, box, button } = usePopover();
  return (
    <div className="hm-pick" ref={box}>
      <button ref={button} type="button" className={`hm-pick-btn${open ? " on" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${shown}`} title={label} onClick={() => setOpen(!open)}>
        {shown}
      </button>
      {open && (
        <ul className="hm-pop hm-pop-sm" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.off ? true : undefined}
                disabled={Boolean(o.off)}
                title={o.off}
                className={o.value === current ? "on" : ""}
                onClick={() => (setOpen(false), o.value !== current && onPick(o.value))}
              >
                {o.text}
                {o.value === current && <UiIcon name="check" size={13} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The profile photo in the top bar (Layla's, drawn our way): the face (photo, initials, or the person icon) and a small
 * chevron; its menu gathers what the old ••• held and the settings: who you are and which AI, the trips, the profile,
 * the settings, joining a shared trip, the sample trip, the trash.
 */
function ProfileMenu(p: { name: string | null; photo: string | null; model: string | null; hasDemo: boolean; onSettings: () => void; onTrips: () => void; onJoin: () => void; onDemo: () => void; onTrash: () => void }) {
  const { open, setOpen, box, button } = usePopover();
  const go = (fn: () => void) => () => (setOpen(false), fn());
  const item = (icon: HeroIconName, text: string, fn: () => void, cls = "") => (
    <li>
      <button type="button" role="menuitem" className={cls} onClick={go(fn)}>
        <HeroIcon name={icon} size={17} />
        {text}
      </button>
    </li>
  );
  return (
    <div className="hm-prof" ref={box}>
      <button ref={button} type="button" className={`hm-prof-btn${open ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-label={L("Profil ve ayarlar", "Profile and settings")} onClick={() => setOpen(!open)}>
        <Face name={p.name ?? ""} photo={p.photo} colour={FACES[0]} size={38} />
        <span className="hm-prof-chev" aria-hidden>
          <HeroIcon name="chevDown" size={12} />
        </span>
      </button>
      {open && (
        <div className="hm-pop hm-pop-menu" role="menu" aria-label={L("Profil", "Profile")}>
          <div className="hm-pop-me">
            <Face name={p.name ?? ""} photo={p.photo} colour={FACES[0]} size={44} />
            <div>
              <b>{p.name ?? L("Profilini kur", "Set up your profile")}</b>
              <span>{p.model ? L(`Asistan: ${p.model}`, `Assistant: ${p.model}`) : L("Asistan bağlı değil", "No assistant yet")}</span>
            </div>
          </div>
          <ul>
            {item("pin", L("Seyahatlerim", "My trips"), p.onTrips)}
            {item("user", L("Profil ve fotoğraf", "Profile and photo"), p.onSettings)}
            {item("spark", L("Ayarlar · AI asistanı", "Settings · AI assistant"), p.onSettings)}
          </ul>
          <ul>
            {item("users", L("Paylaşılan geziye katıl", "Join a shared trip"), p.onJoin)}
            {!p.hasDemo && item("star", L("Örnek geziyi yükle", "Load the sample trip"), p.onDemo)}
            {item("hourglass", L("Geçmiş ve çöp kutusu", "History and trash"), p.onTrash)}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * "Seyahatlerim" (Layla-style home, spec §2; v11 look, 2026-10-09): the app frame with its top bar, a big question and
 * one box on the left, the traveller's corner on the right (who they are, who they travel with, how many trips and
 * bookings, which AI), the trips below as v11 cards. A link, a file or a pasted screenshot is read and sorted into its
 * trip as before; typed words start a trip by chat (or, when they name a trip there is, ask which). A half-done
 * interview waits as a dashed draft card. Under the box (ana-sayfa-v1, 2026-10-19): idea chips that write a sentence into
 * it, "Sürpriz bir yer" (the inspire mode) and "Başka fikirler"; joining a shared trip is in the profile menu.
 */
export function TripsHome({ trips, items, openCaptures, onOpen, onDemo, onSettings, onStart, onAddToTrip, ctx, onTrash, onDelete }: Props) {
  const [text, setText] = useState("");
  // (the card whose × was pressed: asked once on the card itself)
  const [asking, setAsking] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ask, setAsk] = useState<{ trip: Trip; text: string } | null>(null);
  const [drafts, setDrafts] = useState<StartState[]>([]);
  const [removed, setRemoved] = useState<StartState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  // D17: the exchange rates, so a money with none known can't be picked.
  const [rates, setRates] = useState<Rates | null>(null);
  useEffect(() => void getRates().then(setRates).catch(() => undefined), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  // The idea chips: which set of six, the mode of the one pressed (until the box is emptied), its sentence being typed in.
  const [ideaSet, setIdeaSet] = useState(0);
  const [ideaMode, setIdeaMode] = useState<StartMode | null>(null);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState(0);
  const [spin, setSpin] = useState(false);
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => clearInterval(typing.current), []);
  // The placeholder line turns while the box is empty and left alone (none under reduced motion: the first stays).
  const [hint, setHint] = useState(0);
  const [hintOut, setHintOut] = useState(false);
  const turning = !text && !focused;
  useEffect(() => {
    if (!turning || reducedMotion()) return;
    let swap: number | undefined;
    const turn = window.setInterval(() => {
      setHintOut(true);
      swap = window.setTimeout(() => (setHint((i) => (i + 1) % HINTS.length), setHintOut(false)), HINT_FADE_MS);
    }, HINT_MS);
    return () => (clearInterval(turn), clearTimeout(swap), setHintOut(false));
  }, [turning]);
  // A sentence written in: the caret at its end (once React has put all of it in), and "Planlamaya başla" pulses once.
  useEffect(() => {
    if (!written) return;
    const ta = box.current;
    if (ta) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    const b = go.current;
    if (b && !reducedMotion()) {
      b.classList.remove("ready");
      void b.offsetWidth;
      b.classList.add("ready");
    }
  }, [written]);
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const working = openCaptures.filter((c) => c.status !== "error");
  const failed = openCaptures.filter((c) => c.status === "error");
  const ordered = [...trips].sort((a, b) => Number(isDemoTrip(a)) - Number(isDemoTrip(b)) || b.updatedAt - a.updatedAt);

  useEffect(() => {
    const load = () => void listDrafts().then(setDrafts);
    load();
    return onDraftsChanged(load);
  }, []);
  useEffect(() => {
    const load = () => void getSettings().then(setSettings, () => setSettings(null));
    load();
    // (only the keys settings are made of: the offers' store, flights and rates write here all the time, 2026-10-25)
    const changed = (ch: Record<string, unknown>, area: string) => {
      if (area === "local" && ["provider", "apiKey", "model", "geminiKey", "geminiModel"].some((k) => k in ch)) load();
    };
    chrome.storage?.onChanged?.addListener(changed);
    return () => chrome.storage?.onChanged?.removeListener(changed);
  }, []);
  // Bekleyen kayıtlar: a page asked about when there was no trip to ask in (placeCheck.ts: lines of no trip, "").
  const [waiting, setWaiting] = useState<ChatMessage[]>([]);
  useEffect(() => {
    const load = () => void listMessages("").then((rows) => setWaiting(rows.filter((m) => m.routing?.kind === "ask" && !m.routing.answer)));
    load();
    return onChanged(load);
  }, []);
  // "Taslak silindi · Geri al" for a few seconds.
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(t);
  }, [removed]);

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addImages(files);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addImages(Array.from(e.dataTransfer.files));
  }

  /** A sentence still being written in stops where it is (the person typed, or sent it). */
  function stopTyping() {
    if (typing.current === undefined) return;
    clearInterval(typing.current);
    typing.current = undefined;
    setWriting(false);
  }

  /** An idea chip: its sentence typed into the box (at once under reduced motion), its mode kept for when it's sent. */
  function writeIdea(say: string, mode: StartMode) {
    clearInterval(typing.current);
    setAsk(null);
    setIdeaMode(mode);
    const done = () => {
      typing.current = undefined;
      setWriting(false);
      setWritten((n) => n + 1);
    };
    if (reducedMotion()) {
      setText(say);
      return done();
    }
    setWriting(true);
    setText("");
    let k = 0;
    typing.current = window.setInterval(() => {
      k += 2;
      setText(say.slice(0, k));
      if (k >= say.length) {
        clearInterval(typing.current);
        done();
      }
    }, 14);
  }

  async function submit(mode: StartMode = ideaMode ?? "plan", label?: string) {
    stopTyping();
    const typed = text.trim();
    // Links: read and sorted into their trips, as always; words typed with them go on to the conversation.
    const { links, words } = splitLinks(typed);
    if (links.length && (await addLinks(links.join(" ")))) {
      setText("");
      if (!words) return;
    }
    const said = links.length ? words : typed;
    // Said in the language the words are written in: the chat goes on in it (revision 2, item 1).
    const note = links.length && said ? withLang(detectLang(said), () => L("Linki kaydettim; geri kalanını konuşalım.", "I've saved the link; let's talk about the rest.")) : undefined;
    if (!said) return onStart({ mode, label });
    const named = mode === "plan" ? tripNamedIn(said, trips, items) : null;
    if (named) return setAsk({ trip: named.trip, text: said });
    setText("");
    setIdeaMode(null);
    onStart({ mode, text: said, label, note });
  }

  // Who they travel with: every name on their trips but their own, the most frequent first.
  const me = ctx.myName?.trim() || null;
  const companions = (() => {
    const count = new Map<string, number>();
    for (const t of trips) for (const n of t.travellers?.names ?? []) if (n.trim() && n.trim().toLocaleLowerCase() !== me?.toLocaleLowerCase()) count.set(n.trim(), (count.get(n.trim()) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  })();
  // The faces' colours follow this order (me first); my face without a name is the person icon.
  const people = [me ?? "", ...companions];
  const today = ctx.today;
  // This month's ideas first (ctx.today is "YYYY-MM-DD").
  const month = Number(today.slice(5, 7)) - 1;
  const ideas = ideasFor(ideaSet, Number.isInteger(month) && month >= 0 ? month : new Date().getMonth());
  // Yaklaşan · Geçmiş (Layla's toggle): a trip whose last day is past is past; one without dates is still ahead.
  const [when, setWhen] = useState<"ahead" | "past">("ahead");
  const rangeOf = (t: Trip) => t.confirmedDates ?? tripDateRange(items.filter((i) => i.tripId === t.id && i.status !== "dismissed"));
  const isPast = (t: Trip) => {
    const r = rangeOf(t);
    return Boolean(r && r.end < today);
  };
  const pastCount = ordered.filter(isPast).length;
  const shownTrips = ordered.filter((t) => (when === "past" ? isPast(t) : !isPast(t)));
  // Each card's cover: its board's hero cover, worked out from the trip as stored (C36, row 163).
  const covers = useMemo(() => new Map(trips.map((t) => [t.id, tripCardPhoto(t, items.filter((i) => i.tripId === t.id && i.status !== "dismissed"))])), [trips, items]);

  return (
    <div className="home st-home hm" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <HomeBackdrop />
      <header className="hm-bar">
        <span className="hm-logo">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
            <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z" fill="currentColor" />
          </svg>
          <span className="st-brand">Trip Radar</span>
        </span>
        <span className="hm-bar-sp" />
        <nav className="hm-prefs" aria-label={L("Tercihler", "Preferences")}>
          <Picker
            label={L("Para birimi", "Currency")}
            shown={CURRENCY_SIGN[displayCurrency() ?? "EUR"]}
            current={displayCurrency()}
            options={CURRENCIES.map((c) => ({
              value: c,
              text: `${CURRENCY_SIGN[c]}  ${c}`,
              off: canPick(c, rates, displayCurrency()) ? undefined : L("Kur bilgisi gelince seçilebilir", "Can be picked once its exchange rate is known"),
            }))}
            onPick={(c) => (stayHome(), void saveCurrency(c as DisplayCurrency))}
          />
          <Picker
            label={L("Dil", "Language")}
            shown={lang().toUpperCase()}
            current={lang()}
            options={[{ value: "tr", text: "Türkçe" }, { value: "en", text: "English" }]}
            onPick={(l) => (stayHome(), void saveLang(l as Lang).then(() => location.reload()))}
          />
        </nav>
        <ProfileMenu
          name={me}
          photo={myPhoto}
          model={settings && (settings.provider === "gemini" ? settings.geminiKey : settings.apiKey) ? modelName(settings) : null}
          hasDemo={trips.some(isDemoTrip)}
          onSettings={onSettings}
          onTrips={() => document.querySelector(".hm-trips")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" })}
          onJoin={() => setJoining(true)}
          onDemo={onDemo}
          onTrash={onTrash}
        />
      </header>

      <section className="st-hero">
        <h1 className="st-hello">{me ? L(`Merhaba ${me}, sıradaki gezi nereye?`, `Hey ${me}, where are we going next?`) : L("Sıradaki gezi nereye?", "Where are we going next?")}</h1>
        {waiting.length > 0 && (
          <section className="home-waiting" aria-label={L("Bekleyen kayıtlar", "Waiting saves")}>
            <div className="home-waiting-h">{L("Bekleyen kayıtlar", "Waiting saves")}</div>
            {waiting.map((m) => m.routing && <RoutingLine key={m.id} m={m} routing={m.routing} trips={trips} />)}
          </section>
        )}
        <form
          className={`st-prompt${dragging ? " drag" : ""}${writing ? " lit" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {/* The hints turn while the box is empty and left alone; focus or typing stops them, and the first stays (reduced motion: app.css). */}
          <div className="st-ta">
            {turning && (
              <span className={`st-ph${hintOut ? " out" : ""}`} aria-hidden>
                {HINTS[hint]()}
              </span>
            )}
            <textarea
              ref={box}
              className={turning ? "rot" : undefined}
              value={text}
              rows={2}
              aria-label={L("Gezi kutusu", "Trip box")}
              placeholder={HINTS[0]()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                // Typing takes over from a sentence still being written in; an emptied box forgets the idea's mode.
                stopTyping();
                setText(e.target.value);
                if (!e.target.value.trim()) setIdeaMode(null);
                setAsk(null);
              }}
              onPaste={onPaste}
              onKeyDown={(e) => {
                // Enter sends; never while an input method is still composing (Japanese, Chinese, Korean…).
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </div>
          <div className="st-prompt-foot">
            <button type="button" className="st-clip" aria-label={L("Ekran görüntüsü ekle", "Add a screenshot")} title={L("Ekran görüntüsü ekle", "Add a screenshot")} onClick={() => fileInput.current?.click()}>
              <UiIcon name="clip" size={18} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addImages(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <span className="st-prompt-hint">{L("link, ekran görüntüsü ya da yazı", "a link, a screenshot or words")}</span>
            <button ref={go} className="st-go" type="submit" onAnimationEnd={(e) => e.currentTarget.classList.remove("ready")}>
              {L("Planlamaya başla", "Start planning")} <span aria-hidden>↗</span>
            </button>
          </div>
        </form>
        {ask && (
          <div className="st-ask" role="group" aria-label={L("Hangi gezi?", "Which trip?")}>
            <span>{L(`${dative(ask.trip.title)} ${askWord(dative(ask.trip.title))} ekleyeyim, yeni gezi mi?`, `Add it to ${ask.trip.title}, or a new trip?`)}</span>
            <button type="button" className="st-primary" onClick={() => (setAsk(null), setText(""), onAddToTrip(ask.trip.id, ask.text))}>
              {L(`${dative(ask.trip.title)} ekle`, `Add to ${ask.trip.title}`)}
            </button>
            <button type="button" className="st-chip" onClick={() => (setAsk(null), setText(""), onStart({ mode: "plan", text: ask.text }))}>
              {L("Yeni gezi", "New trip")}
            </button>
          </div>
        )}
        <div className="hm-ideas-wrap">
          <div className="hm-ideas" role="group" aria-label={L("Gezi fikirleri", "Trip ideas")}>
            {ideas.map((idea, i) => (
              <button key={`${ideaSet}-${idea.art}`} type="button" className="hm-idea" style={{ animationDelay: `${i * 40}ms` }} title={ideaTip(idea)} onClick={() => writeIdea(inLang(idea.say), idea.mode)}>
                <span className="hm-idea-th">
                  <IdeaArt art={idea.art} />
                </span>
                {inLang(idea.title)}
                <small>{inLang(idea.place)}</small>
              </button>
            ))}
            <button type="button" className="hm-idea" style={{ animationDelay: `${ideas.length * 40}ms` }} onClick={() => void submit("inspire", L("Sürpriz bir yer", "Surprise me"))}>
              <span className="hm-idea-th hm-idea-ic">
                <DiceIcon />
              </span>
              {L("Sürpriz bir yer", "Surprise me")}
            </button>
            <button
              type="button"
              className={`hm-idea hm-more${spin ? " spin" : ""}`}
              style={{ animationDelay: `${(ideas.length + 1) * 40}ms` }}
              onClick={() => {
                setIdeaSet((n) => (n + 1) % IDEAS.length);
                setSpin(true);
                setTimeout(() => setSpin(false), 520);
              }}
            >
              <RefreshIcon />
              {L("Başka fikirler", "More ideas")}
            </button>
          </div>
        </div>
        {joining && (
          <div className="st-join">
            <JoinShared startOpen onJoined={onOpen} onCancel={() => setJoining(false)} />
          </div>
        )}
      </section>

      <WorkPill count={working.length} failed={failed.length} />
      {failed.length > 0 && (
        <div className="errors">
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || L("Ekran görüntüsü", "Screenshot")}</span>
                <span className="muted">
                  {" · "}
                  {c.error}
                </span>
              </span>
              <button
                className="small-btn"
                onClick={async () => {
                  await retryCapture(c.id);
                  requestProcessing();
                }}
              >
                {L("Tekrar dene", "Try again")}
              </button>
            </div>
          ))}
        </div>
      )}

      {trips.length === 0 && drafts.length === 0 ? (
        <div className="trips-empty">
          <Mascot size={56} className="empty-mascot" />
          <h2>{L("İlk gezini başlat", "Start your first trip")}</h2>
          <ol>
            {/* P9 (F01): with a key saved the step says it's done, never "bağla" again. */}
            {settings && (settings.provider === "gemini" ? settings.geminiKey : settings.apiKey) ? (
              <li className="done">✓ {L("Yapay zekâ anahtarın bağlı.", "Your AI key is connected.")}</li>
            ) : (
              <li>
                <a href="#settings" onClick={onSettings}>
                  {L("Ücretsiz Gemini anahtarını bağla", "Connect a free Gemini key")}
                </a>{" "}
                {L("(1 dakika, kart gerekmez).", "(1 minute, no card needed).")}
              </li>
            )}
            <li>
              {L(
                "Yukarıdaki kutuya nereye ve ne zaman gideceğini yaz ya da bir link bırak; birkaç soruyla gezinin omurgası kurulur.",
                "Write where and when you're going in the box above, or drop a link: a few questions and the trip's backbone is laid out.",
              )}
            </li>
            <li>
              {L(
                "Bir otel, uçuş ya da etkinlik sayfasındayken araç çubuğundaki Trip Radar simgesine tıkla (veya Alt+Shift+S): kayıt planda yerine düşer, başka bir yer ya da uzak bir tarihse yeni gezi açılır.",
                "On a hotel, flight or activity page, click the Trip Radar icon in the toolbar (or Alt+Shift+S): it lands in its place on the plan; another place or far-off dates start a new trip.",
              )}
            </li>
          </ol>
          <button className="btn-link" style={{ fontSize: 15, marginTop: 12 }} onClick={onDemo}>
            {L("Örnek geziyi yükle →", "Load the sample trip →")}
          </button>
        </div>
      ) : (
        <section className="hm-trips">
          <div className="hm-trips-h">
            <h2 className="st-section">{L("Seyahatlerim", "My trips")}</h2>
            <p className="hm-trips-sub">
              {L(`Şimdiye kadar ${trips.length} gezi planladın`, `You've planned ${trips.length} trip${trips.length === 1 ? "" : "s"} so far`)}
              {drafts.length ? L(` · ${drafts.length} taslak`, ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`) : ""}
            </p>
            {pastCount > 0 && (
              <div className="hm-seg" role="tablist" aria-label={L("Geziler", "Trips")}>
                <button type="button" role="tab" aria-selected={when === "ahead"} className={when === "ahead" ? "on" : ""} onClick={() => setWhen("ahead")}>
                  {L("Yaklaşan", "Upcoming")}
                </button>
                <button type="button" role="tab" aria-selected={when === "past"} className={when === "past" ? "on" : ""} onClick={() => setWhen("past")}>
                  {L("Geçmiş", "Past")} · {pastCount}
                </button>
              </div>
            )}
          </div>
          <div className="trip-grid">
            {when === "ahead" &&
              drafts.map((d) => {
                const p = progressOf(checklist(d, ctx));
                return (
                  <DraftCard
                    key={d.id}
                    place={d.where?.place ?? L("Yeni gezi", "New trip")}
                    done={p.done}
                    total={p.total}
                    onOpen={() => onStart({ mode: d.mode, draft: d })}
                    onRemove={() => void removeDraft(d.id).then((gone) => gone && setRemoved(gone))}
                  />
                );
              })}
            {shownTrips.map((trip) => {
              const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
              const range = trip.confirmedDates ?? tripDateRange(own);
              // The cover its board's hero shows, as stored (none fetched from the list); the gradient without one.
              const image = covers.get(trip.id) ?? null;
              // Too small for the credit line: who took it on hover ("Fotoğraf: Ana Lima / Unsplash"); the board's hero links it.
              const credit = creditOf(image, trip.photoCredits);
              const line = credit ? creditLine(credit) : null;
              const photoBy = line ? `${line.label} ${[line.by?.text, line.source.text].filter(Boolean).join(" / ")}` : undefined;
              // Me first, then the others on the trip (each once).
              const names = [...(me ? [me] : []), ...(trip.travellers?.names ?? []).map((n) => n.trim()).filter((n) => n && n.toLocaleLowerCase() !== me?.toLocaleLowerCase())];
              const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
              const info =
                [range ? formatDateRange(range.start, range.end) : null, days > 1 ? L(`${days} gün`, `${days} days`) : null, isDemoTrip(trip) ? L("Örnek", "Sample") : null].filter(Boolean).join(" · ") ||
                L("Tarih ve yer kaydettikçe netleşir", "Dates and places fill in as you save");
              return (
                <div key={trip.id} className={`st-trip${asking === trip.id ? " asking" : ""}`}>
                <TripCard
                  title={trip.title}
                  info={info}
                  image={image}
                  photoBy={photoBy}
                  left={countdownText(countdown(range, today))}
                  // (a trip of one shows no face: my own picture on every card is noise; two or more show everyone)
                  people={names.length >= 2 ? names.map((n) => ({ name: n, photo: n === me ? myPhoto : peoplePhoto(n) })) : []}
                  order={people}
                  onOpen={() => onOpen(trip.id)}
                  tripId={trip.id}
                />
                {/* 0.47.0 (Emre: "kartın üzerine gelince mini bir X, bir kere sorsun"): asked on the card, to the trash for 30 days. */}
                {asking === trip.id ? (
                  <div className="st-ask" role="alertdialog" aria-label={L(`${trip.title} silinsin mi?`, `Delete ${trip.title}?`)}>
                    <b>{L("Silinsin mi?", "Delete it?")}</b>
                    <span>
                      {trip.shareId
                        ? L("Yalnız bu bilgisayardan; diğerlerinin kopyası kalır. 30 gün Çöp kutusu'nda durur.", "Only on this computer; the others keep theirs. It stays in the trash for 30 days.")
                        : L("Çöp kutusuna gider, 30 gün içinde geri alınır.", "It goes to the trash; you can bring it back within 30 days.")}
                    </span>
                    <span className="st-ask-b">
                      <button type="button" className="st-ask-del" onClick={() => (setAsking(null), onDelete(trip.id))}>
                        {L("Sil", "Delete")}
                      </button>
                      <button type="button" onClick={() => setAsking(null)} autoFocus>
                        {L("Vazgeç", "Cancel")}
                      </button>
                    </span>
                  </div>
                ) : (
                  <button type="button" className="st-trip-x" aria-label={L(`${trip.title}: sil`, `${trip.title}: delete`)} title={L("Sil", "Delete")} onClick={() => setAsking(trip.id)}>
                    ×
                  </button>
                )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {removed && (
        <div className="pk-undo" role="status" aria-live="polite">
          <span>{L("Taslak silindi", "Draft deleted")}</span>
          <button type="button" onClick={() => void saveDraft(removed).then(() => setRemoved(null))}>
            {L("Geri al", "Undo")}
          </button>
          <UndoRing of={removed} />
        </div>
      )}
    </div>
  );
}
