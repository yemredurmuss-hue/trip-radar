import { L } from "../lib/i18n";
import type { Capture } from "../lib/types";
import { useLate } from "./motion";
import { useReconnect } from "./reconnect";

/** The board's "İnternet yok · N sn sonra tekrar deniyorum" at the foot of the screen (reconnect.ts); nothing while all is well. */
export function OfflineNotice({ captures }: { captures: Capture[] }) {
  const r = useReconnect(captures);
  // (hareket dili, m-kurallar) a retry that is over within 0.4 s shows no turning mark.
  const spin = useLate(r.state === "trying");
  if (r.state === "idle") return null;
  if (r.state === "saved") {
    return (
      <div className="reconnect ok" role="status">
        {L("Kaydedildi ✓", "Saved ✓")}
      </div>
    );
  }
  if (r.state === "trying") {
    return (
      <div className="reconnect" role="status">
        {spin && <span className="work-spin" aria-hidden />}
        {L("Tekrar deniyorum…", "Trying again…")}
      </div>
    );
  }
  const what = r.offline ? L("İnternet yok", "No internet") : L("Kaydedilemedi", "Couldn't save");
  const waiting = r.count > 1 ? L(` · ${r.count} kayıt bekliyor`, ` · ${r.count} saves waiting`) : "";
  return (
    <div className="reconnect bad" role="status">
      <span>
        {what}
        {waiting}
        {" · "}
        {L(`${r.seconds} sn sonra tekrar deniyorum`, `trying again in ${r.seconds} s`)}
      </span>
      <button type="button" className="small-btn" onClick={r.tryNow}>
        {L("Şimdi dene", "Try now")}
      </button>
    </div>
  );
}
