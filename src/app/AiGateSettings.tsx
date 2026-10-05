// Settings → AI kapısı (0.36): who was invited sees that the inviter's gate is theirs to use (no key needed);
// the gate's owner pastes the admin secret once, then sees this month's use and can close an invite.
import { useEffect, useState } from "react";
import { L } from "../lib/i18n";
import { aiGate, aiUsage, getAdminSecret, revokeTicket, saveAdminSecret, type AiUsage } from "../lib/share/ai";

export function AiGateSettings({ ownKey }: { ownKey: boolean }) {
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
      {invited && !ownKey && (
        <p className="note small ai-invited">{L("✓ Davetle geldin: AI, davet edenin sunucusundan çalışıyor. Kendi anahtarın gerekmez.", "✓ You came with an invite: AI runs on the inviter's server. You don't need a key of your own.")}</p>
      )}
      <button type="button" className="link-btn quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {L("AI kapısı (davet ettiklerin için)", "AI gate (for the people you invite)")} {open ? "▴" : "▾"}
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
