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
import { tallyVotes, voteKeyOf, type Vote, type VoteTally, type VoteValue } from "../lib/share/votes";
import type { Item, Trip } from "../lib/types";

// --- the board's view of sharing -----------------------------------------------------------------

interface ShareView {
  trip: Trip;
  me: string;
  votes: Vote[];
  state: SyncState | null;
  tally: (item: Item) => VoteTally;
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
      vote: (item, value) => {
        void castVote(trip, item, value).then(requestShareSync);
      },
    };
  }, [trip, me, votes, state]);

  return <ShareContext.Provider value={view}>{children}</ShareContext.Provider>;
}

// --- votes on a card -----------------------------------------------------------------------------

/** 👍 / 👎 for me, and who said what ("Emre 👍 · Sabine 👎"). Pressing my vote again takes it back. */
export function VoteBar({ item }: { item: Item }) {
  const share = useShare();
  if (!share || !share.me || !voteKeyOf(item) || item.status === "booked") return null;
  const t = share.tally(item);
  const press = (value: 1 | -1) => share.vote(item, t.mine === value ? 0 : value);
  return (
    <div className={`vote-bar${t.allNo ? " all-no" : ""}`}>
      <button className={`vote-btn${t.mine === 1 ? " on" : ""}`} aria-pressed={t.mine === 1} title="Bunu istiyorum" onClick={() => press(1)}>
        👍
      </button>
      <button className={`vote-btn${t.mine === -1 ? " on" : ""}`} aria-pressed={t.mine === -1} title="Bunu istemiyorum" onClick={() => press(-1)}>
        👎
      </button>
      {t.allNo ? <span className="vote-line">İkiniz de istemiyorsunuz · {t.line}</span> : t.line && <span className="vote-line">{t.line}</span>}
    </div>
  );
}

/** The votes in one line, for compact rows ("Emre 👍 · Sabine 👎"). */
export function VoteTallyText({ item }: { item: Item }) {
  const share = useShare();
  const t = share?.me ? share.tally(item) : null;
  if (!t?.line) return null;
  return <span className="vote-line"> · {t.allNo ? "İkiniz de istemiyorsunuz" : t.line}</span>;
}

// --- status on the trip --------------------------------------------------------------------------

const joinTr = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ve ${names.at(-1)}`);

function ago(ms: number, now: number): string {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} sa önce` : `${Math.floor(h / 24)} gün önce`;
}

/** "Paylaşılıyor · Sabine ile · son eşitleme 1 dk önce", or what went wrong. */
export function ShareStatus() {
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
    "Paylaşılıyor",
    others.length ? `${joinTr(others)} ile` : "henüz katılan yok",
    last ? `son eşitleme ${ago(last, now)}` : "eşitleniyor…",
  ];
  return (
    <span className="share-status" title="Kayıtlar, oylar ve gezi ayarları dakikada bir eşitlenir">
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
    setStatus("✓ Kopyalandı. Şimdi mesajla gönder.");
  }

  if (!config) return null;
  const ready = isConfigured(config);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{trip.shareId ? "Paylaşım kodu" : "Bu geziyi paylaş"}</h2>
        {!ready ? (
          <>
            <p>Paylaşmak için önce Ayarlar → Paylaşım'da adını, Supabase adresini ve anahtarını yaz (bir kez).</p>
            <div className="modal-actions">
              <button className="btn-link" style={{ fontSize: 14 }} onClick={onClose}>
                Vazgeç
              </button>
              <button className="btn-primary" onClick={onSettings}>
                Ayarlara git
              </button>
            </div>
          </>
        ) : code ? (
          <>
            <p className="muted small-note">
              Bu kodu birlikte gezdiğin kişiye gönder. Trip Radar'ı kurup <b>Seyahatlerim → Paylaşılan geziye katıl</b>'a yapıştırsın.
              Kaydettikleriniz, oylarınız ve gezinin adı, tarihleri, bütçesi, öncelikleri ikinizde aynı olur; sohbet herkesin kendine.
            </p>
            <textarea className="share-code" readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} />
            <p className="note small">Kodu bilen bu geziyi görür ve ekleme yapabilir; yalnız birlikte gezdiğin kişiye ver.</p>
            {status && <p className="muted small">{status}</p>}
            <div className="modal-actions">
              <button
                className="link-btn quiet"
                onClick={async () => {
                  if (!confirm("Bu bilgisayarda paylaşım dursun mu? Gezi burada olduğu gibi kalır, bundan sonra eşitlenmez.")) return;
                  await stopSharing(trip.id);
                  onClose();
                }}
              >
                Paylaşımı durdur
              </button>
              <button className="btn-primary" onClick={() => void copy()}>
                Kodu kopyala
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              "{trip.title}" paylaşılsın mı? Kaydettiğin sayfalar (küçük ekran görüntüsüyle) paylaşım sunucuna gider; karşı taraf
              bunları kendi AI anahtarıyla işler.
            </p>
            {status && <p className="err small-note">{status}</p>}
            <div className="modal-actions">
              <button className="btn-link" style={{ fontSize: 14 }} onClick={onClose}>
                Vazgeç
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => void share()}>
                {busy ? "Paylaşılıyor…" : "Paylaş"}
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
    setStatus("Katılınıyor…");
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
        Paylaşılan geziye katıl →
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
        Paylaşım kodu
        <textarea value={code} rows={3} placeholder="TR1:… (sana gönderilen kodun tamamını yapıştır)" onChange={(e) => setCode(e.target.value)} autoFocus />
      </label>
      {needsName && (
        <label className="field">
          Adın
          <input type="text" value={name} placeholder="Diğer kişi seni bu adla görür (ör. Sabine)" maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      {status && <p className="muted small">{status}</p>}
      <div className="modal-actions">
        <button type="button" className="btn-link" style={{ fontSize: 14 }} onClick={() => setOpen(false)}>
          Vazgeç
        </button>
        <button className="btn-primary" type="submit" disabled={busy || !code.trim() || (needsName && !name.trim())}>
          Katıl
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
    if (!url) return setStatus("Adres https://….supabase.co biçiminde olmalı.");
    setStatus("Bağlantı deneniyor…");
    try {
      const reply = await rpcClient({ url, anonKey: c.anonKey })<string>("share_ping", {});
      setStatus(reply === "trip-radar-share-1" ? "✓ Sunucu hazır." : "Sunucu cevap verdi ama kurulum farklı görünüyor.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  if (!c) return null;
  return (
    <details className="share-settings" open={Boolean(c.url || c.name)}>
      <summary>Paylaşım</summary>
      <p className="muted small-note">
        Bir geziyi birlikte gezdiğin kişiyle paylaşmak için (ikiniz de kaydedip oy verirsiniz). Kurulumu README'de "Paylaşım"
        bölümünde. Katılan kişinin yalnız adını yazması yeter; adres ve anahtar koddan gelir.
      </p>
      <label className="field">
        Adın
        <input type="text" value={c.name} maxLength={40} placeholder="ör. Emre" onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label className="field">
        Supabase adresi
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
        Supabase anahtarı (publishable / anon)
        <input type="password" value={c.anonKey} placeholder="sb_publishable_… ya da eyJ…" onChange={(e) => update({ anonKey: e.target.value })} />
      </label>
      <p className="muted small">
        <button className="btn-link" style={{ fontSize: 13, padding: 0 }} disabled={!c.url || !c.anonKey} onClick={() => void test()}>
          Bağlantıyı dene
        </button>
        {status && ` — ${status}`}
      </p>
    </details>
  );
}
