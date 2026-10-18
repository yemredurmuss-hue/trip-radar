import { useState } from "react";
import type { Pivot } from "../lib/pivots";
import type { Item } from "../lib/types";
import { setFindingVerdict } from "./findingVerdict";
import { L } from "../lib/i18n";

/**
 * "Sıralaman tek bir şeye bağlı": the one thing read on this option's page its place hangs on, and what
 * it would be without it. The traveller answers ("Önemli, kalsın" rules it out, "Sorun değil" takes it
 * off) or asks the host first (the message is copied, quoting the guests). Until then: points only.
 */
export function PivotNote({ item, pivot }: { item: Item; pivot: Pivot }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pivot.hostMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(L("Ev sahibine gönder:", "Send to the host:"), pivot.hostMessage);
    }
  };
  return (
    <div className="opt-pivot" role="note">
      <p>
        <b>{L("Sıralaman tek bir şeye bağlı:", "Your ranking hangs on one thing:")}</b> {pivot.finding.text} ({pivot.evidence}).{" "}
        {L(`Bu olmasa ${pivot.to}. olurdu.`, `Without it, this would be #${pivot.to}.`)}
      </p>
      <div className="opt-pivot-actions">
        <button className="pill-btn outline" title={L("Bu seçeneği eler", "Rules this option out")} onClick={() => void setFindingVerdict(item, { key: pivot.listingKey }, pivot.finding, "matters")}>
          {L("Önemli, kalsın", "It matters")}
        </button>
        <button className="pill-btn outline" onClick={() => void setFindingVerdict(item, { key: pivot.listingKey }, pivot.finding, "fine")}>
          {L("Sorun değil", "That's fine")}
        </button>
        <button className="link-btn" title={`${pivot.question}\n\n${pivot.hostMessage}`} onClick={() => void copy()}>
          {copied ? L("Kopyalandı ✓", "Copied ✓") : L("Ev sahibine sor", "Ask the host")}
        </button>
      </div>
    </div>
  );
}
