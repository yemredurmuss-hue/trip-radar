// Belgeler ve internet's first line (v11, docs/mockups/2026-10-08-japonya-web-v11.html): the visa, said where the
// papers are. No visa needed is green and up front ("✓ Vize gerekmiyor · Türk pasaportuyla 90 güne kadar"); one
// needed is amber with its official source and a tick for "got it" (green once ticked); none at home.
import { L } from "../../lib/i18n";
import type { Visa } from "../../lib/visa";
import { IdeaGlyph } from "../ideas/IdeaIcons";

export function VisaRow({ visa, done, onDone }: { visa: Visa | null; done: boolean; onDone: (done: boolean) => void }) {
  if (!visa || visa.kind === "none") return null;
  const free = visa.kind === "free";
  const ok = free || done;
  // v11 as drawn: one full-width line, the word in its colour and the rest plain; a visa to get says where to apply
  // and has its "✓ Vize alındı" like a plan's "Aldım".
  return (
    <p className={`visa-row${ok ? " ok" : ""}`} data-visa={visa.kind}>
      <span className="visa-ic" aria-hidden>{ok ? <IdeaGlyph name="check" size={14} /> : "!"}</span>
      <b>{free ? L("Vize gerekmiyor", "No visa needed") : visa.kind === "visa" ? (done ? L("Vize alındı", "Visa got") : L("Vize gerekiyor", "A visa is needed")) : L("Vize", "Visa")}</b>
      <span>{free && visa.days ? L(`· Türk pasaportuyla ${visa.days} güne kadar`, `· up to ${visa.days} days on a Turkish passport`) : `· ${visa.label}`}</span>
      <i className="visa-sp" />
      {!free && (
        <a href={visa.link} target="_blank" rel="noreferrer">
          {L("Resmi kaynak ↗", "Official source ↗")}
        </a>
      )}
      {visa.kind === "visa" && (
        <button type="button" className={`visa-tick${done ? " on" : ""}`} role="checkbox" aria-checked={done}
          aria-label={done ? L("Vize alındı: geri al", "Visa got: undo") : L("Vize alındı olarak işaretle", "Mark the visa as got")}
          onClick={() => onDone(!done)}>
          {done ? L("Geri al", "Undo") : <>✓ {L("Vize alındı", "Got it")}</>}
        </button>
      )}
    </p>
  );
}
