// Sharing a trip with the person you travel with: settings, the share code, joining, votes, sync status.
// Everything here is inert until sharing is set up in Ayarlar → Paylaşım.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { requestProcessing, requestShareSync } from "../lib/browser";
import { castVote, joinSharedTrip, shareCodeOf, shareTrip, stopSharing } from "../lib/share/actions";
import { rpcClient } from "../lib/share/client";
import { normalizeServerUrl } from "../lib/share/code";
import {
  chromeKV,
  getShareConfig,
  getSyncState,
  getVotes,
  isConfigured,
  saveShareConfig,
  stateKey,
  votesKey,
  type ShareConfig,
  type SyncState,
} from "../lib/share/store";
import { allNoText, joinNames, tallyVotes, voteKeyOf, type Vote, type VoteTally, type VoteValue } from "../lib/share/votes";
import { L } from "../lib/i18n";
import type { Item, Trip } from "../lib/types";

// --- the board's view of sharing -----------------------------------------------------------------

interface ShareView {
  trip: Trip;
  me: string;
  votes: Vote[];
  state: SyncState | null;
  tally: (item: Item) => VoteTally;
  /** How many people are on the shared trip (me included). */
  members: number;
  vote: (item: Item, value: VoteValue) => void;
}

const ShareContext = createContext<ShareView | null>(null);

/** Sharing for the trip on screen; null when it isn't shared (then no vote buttons, no status). */
export const useShare = () => useContext(ShareContext);

function onStorage(keys: string[], listener: () => void): () => void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return () => {};
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && keys.some((k) => k in changes)) listener();
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export function ShareProvider({ trip, children }: { trip: Trip | null; children: ReactNode }) {
  const shareId = trip?.shareId ?? null;
  const tripId = trip?.id ?? null;
  const [me, setMe] = useState("");
  const [votes, setVotesState] = useState<Vote[]>([]);
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    if (!shareId || !tripId) return;
    const load = () => {
      void getShareConfig().then((c) => setMe(c.name));
      void getVotes(shareId).then(setVotesState);
      void getSyncState(tripId).then((s) => setState(s ?? null));
    };
    load();
    requestShareSync(); // the board opened: bring what the other traveller did meanwhile
    return onStorage([votesKey(shareId), stateKey(tripId), "shareName"], load);
  }, [shareId, tripId]);

  const view = useMemo<ShareView | null>(() => {
    if (!trip?.shareId) return null;
    return {
      trip,
      me,
      votes,
      state,
      tally: (item) => tallyVotes(votes, voteKeyOf(item), me),
      members: memberCount(state?.members ?? [], me),
      vote: (item, value) => {
        void castVote(trip, item, value).then(requestShareSync);
      },
    };
  }, [trip, me, votes, state]);

  return <ShareContext.Provider value={view}>{children}</ShareContext.Provider>;
}

/** Everyone on the trip, me included (the server's list may not have me yet). */
function memberCount(members: string[], me: string): number {
  const names = new Set(members.map((m) => m.trim().toLowerCase()).filter(Boolean));
  if (me.trim()) names.add(me.trim().toLowerCase());
  return names.size;
}

/** "İkiniz de istemiyorsunuz" for two, "Hiçbiriniz istemiyor" for more. */
const noText = (t: VoteTally, members: number) => allNoText(t.voters, members);

// --- votes on a card -----------------------------------------------------------------------------

/** 👍 / 👎 for me, and who said what ("Emre 👍 · Sabine 👎"). Pressing my vote again takes it back. */
export function VoteBar({ item }: { item: Item }) {
  const share = useShare();
  if (!share || !share.me || !voteKeyOf(item) || item.status === "booked") return null;
  const t = share.tally(item);
  const press = (value: 1 | -1) => share.vote(item, t.mine === value ? 0 : value);
  return (
    <div className={`vote-bar${t.allNo ? " all-no" : ""}`}>
      <button className={`vote-btn${t.mine === 1 ? " on" : ""}`} aria-pressed={t.mine === 1} title={L("Bunu istiyorum", "I want this")} onClick={() => press(1)}>
        👍
      </button>
      <button className={`vote-btn${t.mine === -1 ? " on" : ""}`} aria-pressed={t.mine === -1} title={L("Bunu istemiyorum", "I don't want this")} onClick={() => press(-1)}>
        👎
      </button>
      {t.allNo ? <span className="vote-line">{noText(t, share.members)} · {t.line}</span> : t.line && <span className="vote-line">{t.line}</span>}
    </div>
  );
}

/** The votes in one line, for compact rows ("Emre 👍 · Sabine 👎"). */
export function VoteTallyText({ item }: { item: Item }) {
  const share = useShare();
  const t = share?.me ? share.tally(item) : null;
  if (!t?.line) return null;
  return <span className="vote-line"> · {t.allNo && share ? noText(t, share.members) : t.line}</span>;
}

// --- status on the trip --------------------------------------------------------------------------

function ago(ms: number, now: number): string {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return L("az önce", "just now");
  if (min < 60) return L(`${min} dk önce`, `${min} min ago`);
  const h = Math.floor(min / 60);
  if (h < 24) return L(`${h} sa önce`, `${h} h ago`);
  const days = Math.floor(h / 24);
  return L(`${days} gün önce`, `${days} day${days === 1 ? "" : "s"} ago`);
}

/** The hero's travellers row, second line: "Sabine ile paylaşılıyor · 2 dk önce"; null when the trip isn't shared. */
export function ShareLine() {
  const share = useShare();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!share) return null;
  const others = (share.state?.members ?? []).filter((m) => m.trim().toLowerCase() !== share.me.trim().toLowerCase());
  const last = share.state?.lastSyncAt;
  const parts = [
    others.length ? L(`${joinNames(others)} ile paylaşılıyor`, `Shared with ${joinNames(others)}`) : L("Paylaşılıyor, henüz katılan yok", "Shared, no one has joined yet"),
    last ? ago(last, now) : L("eşitleniyor…", "syncing…"),
  ];
  return (
    <span title={L("Kayıtlar, oylar ve gezi ayarları dakikada bir eşitlenir", "Saves, votes and trip settings sync every minute")}>
      {parts.join(" · ")}
      {share.state?.error && <span className="err"> · {share.state.error}</span>}
    </span>
  );
}

// --- the share code (from the trip's menu) --------------------------------------------------------

export function ShareDialog({ trip, onClose, onSettings }: { trip: Trip; onClose: () => void; onSettings: () => void }) {
  const [config, setConfig] = useState<ShareConfig | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getShareConfig().then((c) => {
      setConfig(c);
      if (trip.shareId && isConfigured(c)) setCode(shareCodeOf(trip, c));
    });
  }, [trip]);

  async function share() {
    setBusy(true);
    setStatus(null);
    try {
      setCode(await shareTrip(trip.id));
      requestShareSync(); // the trip's pages go up now
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
    setBusy(false);
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => {});
    setStatus(L("✓ Kopyalandı. Şimdi mesajla gönder.", "✓ Copied. Now send it in a message."));
  }

  if (!config) return null;
  const ready = isConfigured(config);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{trip.shareId ? L("Paylaşım kodu", "Share code") : L("Bu geziyi paylaş", "Share this trip")}</h2>
        {!ready ? (
          <>
            <p>{L("Paylaşmak için önce Ayarlar → Paylaşım'da adını, Supabase adresini ve anahtarını yaz (bir kez).", "To share, first add your name, the Supabase address and key in Settings → Sharing (once).")}</p>
            <div className="modal-actions">
              <button className="btn-link" style={{ fontSize: 14 }} onClick={onClose}>
                {L("Vazgeç", "Cancel")}
              </button>
              <button className="btn-primary" onClick={onSettings}>
                {L("Ayarlara git", "Go to Settings")}
              </button>
            </div>
          </>
        ) : code ? (
          <>
            <p className="muted small-note">
              {L("Bu kodu birlikte gezdiğin kişilere gönder. Trip Radar'ı kurup ", "Send this code to the people you travel with. They install Trip Radar and paste it into ")}
              <b>{L("Seyahatlerim → Paylaşılan geziye katıl", "My trips → Join a shared trip")}</b>
              {L(
                "'a yapıştırsınlar. Kaydettikleriniz, oylarınız ve gezinin adı, tarihleri, bütçesi, öncelikleri herkeste aynı olur; sohbet herkesin kendine.",
                ". Your saves, votes and the trip's name, dates, budget and priorities are the same for everyone; each person keeps their own chat.",
              )}
            </p>
            <textarea className="share-code" readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} />
            <p className="note small">{L("Kodu bilen bu geziyi görür ve ekleme yapabilir; yalnız birlikte gezdiğin kişilere ver.", "Anyone with the code can see this trip and add to it. Only give it to the people you travel with.")}</p>
            {status && <p className="muted small">{status}</p>}
            <div className="modal-actions">
              <button
                className="link-btn quiet"
                onClick={async () => {
                  if (!confirm(L("Bu bilgisayarda paylaşım dursun mu? Gezi burada olduğu gibi kalır, bundan sonra eşitlenmez.", "Stop sharing on this computer? The trip stays here as it is, it just won't sync anymore."))) return;
                  await stopSharing(trip.id);
                  onClose();
                }}
              >
                {L("Paylaşımı durdur", "Stop sharing")}
              </button>
              <button className="btn-primary" onClick={() => void copy()}>
                {L("Kodu kopyala", "Copy code")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {L(
                `"${trip.title}" paylaşılsın mı? Kaydettiğin sayfalar (küçük ekran görüntüsüyle) paylaşım sunucuna gider; katılanlar bunları kendi AI anahtarıyla işler.`,
                `Share "${trip.title}"? The pages you saved (with a small screenshot) go to your sharing server; everyone who joins reads them with their own AI key.`,
              )}
            </p>
            {status && <p className="err small-note">{status}</p>}
            <div className="modal-actions">
              <button className="btn-link" style={{ fontSize: 14 }} onClick={onClose}>
                {L("Vazgeç", "Cancel")}
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => void share()}>
                {busy ? L("Paylaşılıyor…", "Sharing…") : L("Paylaş", "Share")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- joining (from Seyahatlerim) ------------------------------------------------------------------

export function JoinShared({ onJoined }: { onJoined: (tripId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) void getShareConfig().then((c) => setNeedsName(!c.name));
  }, [open]);

  async function join() {
    setBusy(true);
    setStatus(L("Katılınıyor…", "Joining…"));
    try {
      const tripId = await joinSharedTrip(code, name);
      requestShareSync(); // bring its pages now
      requestProcessing();
      setOpen(false);
      setCode("");
      setStatus(null);
      onJoined(tripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
    setBusy(false);
  }

  if (!open)
    return (
      <button className="btn-link share-join-link" onClick={() => setOpen(true)}>
        {L("Paylaşılan geziye katıl →", "Join a shared trip →")}
      </button>
    );
  return (
    <form
      className="share-join"
      onSubmit={(e) => {
        e.preventDefault();
        void join();
      }}
    >
      <label className="field">
        {L("Paylaşım kodu", "Share code")}
        <textarea value={code} rows={3} placeholder={L("TR1:… (sana gönderilen kodun tamamını yapıştır)", "TR1:… (paste the whole code you were sent)")} onChange={(e) => setCode(e.target.value)} autoFocus />
      </label>
      {needsName && (
        <label className="field">
          {L("Adın", "Your name")}
          <input type="text" value={name} placeholder={L("Diğer kişiler seni bu adla görür (ör. Sabine)", "The others see you by this name (e.g. Sabine)")} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      {status && <p className="muted small">{status}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-link" style={{ fontSize: 14 }} onClick={() => setOpen(false)}>
          {L("Vazgeç", "Cancel")}
        </button>
        <button className="btn-primary" type="submit" disabled={busy || !code.trim() || (needsName && !name.trim())}>
          {L("Katıl", "Join")}
        </button>
      </div>
    </form>
  );
}

// --- Ayarlar → Paylaşım -------------------------------------------------------------------------------

/** Name, server address and key; saved as typed (nothing changes until a trip is shared). */
export function ShareSettings() {
  const [c, setC] = useState<ShareConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getShareConfig().then(setC);
  }, []);

  const update = useCallback((patch: Partial<ShareConfig>) => {
    setC((prev) => (prev ? { ...prev, ...patch } : prev));
    setStatus(null);
    void saveShareConfig(patch, chromeKV);
  }, []);

  async function test() {
    if (!c) return;
    const url = normalizeServerUrl(c.url);
    if (!url) return setStatus(L("Adres https://….supabase.co biçiminde olmalı.", "The address should look like https://….supabase.co"));
    setStatus(L("Bağlantı deneniyor…", "Testing the connection…"));
    try {
      const reply = await rpcClient({ url, anonKey: c.anonKey })<string>("share_ping", {});
      setStatus(reply === "trip-radar-share-1" ? L("✓ Sunucu hazır.", "✓ Server ready.") : L("Sunucu cevap verdi ama kurulum farklı görünüyor.", "The server answered, but its setup looks different."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  if (!c) return null;
  return (
    <details className="share-settings" open={Boolean(c.url || c.name)}>
      <summary>{L("Paylaşım", "Sharing")}</summary>
      <p className="muted small-note">
        {L(
          `Bir geziyi birlikte gezdiğin kişilerle paylaşmak için (herkes kaydedip oy verir). Kurulumu README'de "Paylaşım" bölümünde. Katılan kişinin yalnız adını yazması yeter; adres ve anahtar koddan gelir.`,
          `To share a trip with the people you travel with (everyone saves pages and votes). Setup is in the README under "Paylaşım". Someone joining only needs to add their name; the address and key come with the code.`,
        )}
      </p>
      <label className="field">
        {L("Adın", "Your name")}
        <input type="text" value={c.name} maxLength={40} placeholder={L("ör. Emre", "e.g. Emre")} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label className="field">
        {L("Supabase adresi", "Supabase address")}
        <input
          type="text"
          value={c.url}
          placeholder="https://xxxx.supabase.co"
          onChange={(e) => update({ url: e.target.value })}
          onBlur={() => {
            const url = normalizeServerUrl(c.url);
            if (url && url !== c.url) update({ url });
          }}
        />
      </label>
      <label className="field">
        {L("Supabase anahtarı (publishable / anon)", "Supabase key (publishable / anon)")}
        <input type="password" value={c.anonKey} placeholder={L("sb_publishable_… ya da eyJ…", "sb_publishable_… or eyJ…")} onChange={(e) => update({ anonKey: e.target.value })} />
      </label>
      <p className="muted small">
        <button className="btn-link" style={{ fontSize: 13, padding: 0 }} disabled={!c.url || !c.anonKey} onClick={() => void test()}>
          {L("Bağlantıyı dene", "Test connection")}
        </button>
        {status && ` · ${status}`}
      </p>
    </details>
  );
}
