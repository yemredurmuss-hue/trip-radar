// Settings → AI kapısı (0.36): who was invited sees that the inviter's gate is theirs to use (no key needed);
// the gate's owner pastes the admin secret once, then sees this month's use and can close an invite.
import { useEffect, useState } from "react";
import { L } from "../lib/i18n";
import { aiGate, aiUsage, claimGate, gateStanding, getAdminSecret, giveGateKey, revokeTicket, saveAdminSecret, type AiUsage, type GateStanding } from "../lib/share/ai";

/**
 * One tick for the owner (0.36.2): "Davet ettiklerim de bu anahtarı kullansın" claims the gate for this computer,
 * waits for the one-time approval on the server, then hands the gate this key. Nothing to do on a dashboard.
 */
function ShareKeyTick({ geminiKey, onReady }: { geminiKey: string; onReady: () => void }) {
  const [standing, setStanding] = useState<GateStanding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // No server yet: the tick still shows, and says what's missing when ticked.
    void gateStanding().then(setStanding).catch(() => setStanding({ owned: false, mine: false, pending: false, hasKey: false }));
  }, []);
  // Waiting for the approval: look again every few seconds; once it's ours, hand over the key.
  useEffect(() => {
    if (!standing?.pending) return;
    const t = setInterval(() => void gateStanding().then(setStanding).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [standing?.pending]);
  // Ours: hand over the key once (again when the key changes); a refusal says so instead of failing silently.
  const [sentKey, setSentKey] = useState<string | null>(null);
  useEffect(() => {
    if (!standing?.mine || standing.hasKey || !geminiKey || sentKey === geminiKey) return;
    setSentKey(geminiKey);
    void giveGateKey(geminiKey)
      .then((ok) => {
        if (!ok) return setError(L("Anahtar sunucuya geçmedi. Anahtarı yeniden yapıştırıp tekrar dene.", "The key didn't reach the server. Paste it again and retry."));
        setStanding({ ...standing, hasKey: true });
        setError(null);
        onReady();
      })
      .catch((err: Error) => setError(err.message));
  }, [standing, geminiKey, onReady, sentKey]);
  if (!standing) return null;
  if (standing.owned && !standing.mine) return null;
  if (standing.mine && standing.hasKey) return <p className="small ai-on">{L("✓ Davet ettiklerin AI'yı senin anahtarınla, sunucun üzerinden kullanıyor.", "✓ The people you invite use AI with your key, through your server.")}</p>;
  if (standing.pending) return <p className="small muted">{L("Onay bekleniyor… (bir kerelik; birkaç dakika sürebilir)", "Waiting for approval… (once; it may take a few minutes)")}</p>;
  if (standing.mine) return error ? <p className="err small">{error}</p> : <p className="small muted">{L("Anahtar sunucuya geçiyor…", "Handing the key to the server…")}</p>;
  return (
    <>
      <label className="check ai-tick">
        <input type="checkbox" disabled={busy || !geminiKey} onChange={async (e) => {
          if (!e.target.checked) return;
          setBusy(true);
          try {
            setStanding(await claimGate());
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
          setBusy(false);
        }} />
        {L("Davet ettiklerim de bu anahtarı kullansın (kendi anahtarları gerekmez)", "Let the people I invite use this key too (they need no key of their own)")}
      </label>
      {error && <p className="err small">{error}</p>}
    </>
  );
}

export function AiGateSettings({ ownKey, geminiKey = "" }: { ownKey: boolean; geminiKey?: string }) {
  const [invited, setInvited] = useState(false);
  const [secret, setSecret] = useState("");
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      setUsage(await aiUsage());
      setStatus(null);
    } catch (error) {
      setUsage(null);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => {
    void aiGate().then((g) => setInvited(g != null));
    void getAdminSecret().then((s) => {
      setSecret(s);
      if (s) {
        setOpen(true);
        void load();
      }
    });
  }, []);

  const total = usage?.tickets.reduce((n, t) => n + Number(t.month_usd), 0) ?? 0;
  const requests = usage?.tickets.reduce((n, t) => n + Number(t.month_requests), 0) ?? 0;
  return (
    <div className="ai-gate">
      {ownKey && <ShareKeyTick geminiKey={geminiKey} onReady={() => void getAdminSecret().then((sec) => { setSecret(sec); void load(); })} />}
      {invited && !ownKey && (
        <p className="note small ai-invited">{L("✓ Davetle geldin: AI, davet edenin sunucusundan çalışıyor. Kendi anahtarın gerekmez.", "✓ You came with an invite: AI runs on the inviter's server. You don't need a key of your own.")}</p>
      )}
      <button type="button" className="link-btn quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {L("AI kapısı · kullanım ve ayrıntılar", "AI gate · usage and details")} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="ai-gate-body">
          <p className="muted small">
            {L(
              "Sunucundaki AI kapısının yönetici anahtarını bir kez yapıştır. Sonra paylaştığın her gezinin kodu bir AI bileti taşır; katılan kişi kendi anahtarı olmadan kullanır.",
              "Paste your server's AI gate admin secret once. From then on each shared trip's code carries an AI ticket; whoever joins uses AI without a key of their own.",
            )}
          </p>
          <label className="field">
            {L("Yönetici anahtarı", "Admin secret")}
            <input type="password" value={secret} placeholder={L("(yapıştır)", "(paste)")} onChange={(e) => setSecret(e.target.value)}
              onBlur={() => void saveAdminSecret(secret).then(() => (secret.trim() ? load() : setUsage(null)))} />
          </label>
          {status && <p className="err small">{status}</p>}
          {usage && (
            <>
              <p className="small">
                {usage.aiReady ? "" : L("⚠ Sunucuda Gemini anahtarı yok (GEMINI_API_KEY). ", "⚠ No Gemini key on the server (GEMINI_API_KEY). ")}
                {L(`Bu ay ${requests} istek · ~$${total.toFixed(2)} / $${usage.capUsd} · kişi başı günde ${usage.dailyRequests} istek`, `This month ${requests} requests · ~$${total.toFixed(2)} / $${usage.capUsd} · ${usage.dailyRequests} requests a day each`)}
              </p>
              {usage.tickets.length > 0 && (
                <ul className="ai-tickets">
                  {usage.tickets.map((t) => (
                    <li key={t.token_tail} className={t.revoked ? "off" : ""}>
                      <span>{t.name}</span>
                      <span className="muted">{L(`${t.month_requests} istek`, `${t.month_requests} requests`)}</span>
                      {t.revoked ? (
                        <span className="muted">{L("kapalı", "closed")}</span>
                      ) : (
                        <button type="button" className="link-btn" onClick={() => void revokeTicket(t.token_tail).then(load)}>
                          {L("Kapat", "Close")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
