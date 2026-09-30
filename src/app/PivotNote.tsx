import { useState } from "react";
import type { Pivot } from "../lib/pivots";
import type { Item } from "../lib/types";
import { setFindingVerdict } from "./findingVerdict";

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
      window.prompt("Ev sahibine gönder:", pivot.hostMessage);
    }
  };
  return (
    <div className="opt-pivot" role="note">
      <p>
        <b>Sıralaman tek bir şeye bağlı:</b> {pivot.finding.text} ({pivot.evidence}). Bu olmasa {pivot.to}. olurdu.
      </p>
      <div className="opt-pivot-actions">
        <button className="pill-btn outline" title="Bu seçeneği eler" onClick={() => void setFindingVerdict(item, { key: pivot.listingKey }, pivot.finding, "matters")}>
          Önemli, kalsın
        </button>
        <button className="pill-btn outline" onClick={() => void setFindingVerdict(item, { key: pivot.listingKey }, pivot.finding, "fine")}>
          Sorun değil
        </button>
        <button className="link-btn" title={`${pivot.question}\n\n${pivot.hostMessage}`} onClick={() => void copy()}>
          {copied ? "Kopyalandı ✓" : "Ev sahibine sor"}
        </button>
      </div>
    </div>
  );
}
