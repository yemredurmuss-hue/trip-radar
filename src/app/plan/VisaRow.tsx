// Belgeler ve internet's first line (v11, docs/mockups/2026-10-08-japonya-web-v11.html; plan v83 C25): the visa, said where
// the papers are, on the category's rail. No visa needed is green ("✓ Vize gerekmiyor · Türk pasaportuyla 90 güne kadar");
// one needed is amber with its official source and "✓ Vize alındı" like a plan's "Aldım" (green once ticked); none at home.
import { L } from "../../lib/i18n";
import type { Visa } from "../../lib/visa";
import { IdeaGlyph } from "../ideas/IdeaIcons";

export function VisaRow({ visa, done, onDone }: { visa: Visa | null; done: boolean; onDone: (done: boolean) => void }) {
  if (!visa || visa.kind === "none") return null;
  const free = visa.kind === "free";
  const ok = free || done;
  return (
    <p className={`z-visa${ok ? " ok" : " need"}`} data-visa={visa.kind}>
      {ok ? <IdeaGlyph name="check" size={14} /> : <i className="z-vx" aria-hidden>!</i>}
      <b>{free ? L("Vize gerekmiyor", "No visa needed") : visa.kind === "visa" ? (done ? L("Vize alındı", "Visa got") : L("Vize gerekiyor", "A visa is needed")) : L("Vize", "Visa")}</b>
      <span>{free && visa.days ? L(`Türk pasaportuyla ${visa.days} güne kadar`, `up to ${visa.days} days on a Turkish passport`) : visa.label}</span>
      <i className="q-sp" />
      {!free && (
        <a className="q-alk" href={visa.link} target="_blank" rel="noreferrer">
          {L("Resmî kaynak ↗", "Official source ↗")}
        </a>
      )}
      {visa.kind === "visa" && (
        <button type="button" className={`q-got${done ? " on" : ""}`} role="checkbox" aria-checked={done}
          aria-label={done ? L("Vize alındı: geri al", "Visa got: undo") : L("Vize alındı olarak işaretle", "Mark the visa as got")}
          onClick={() => onDone(!done)}>
          {done ? L("Geri al", "Undo") : <>✓ {L("Vize alındı", "Got it")}</>}
        </button>
      )}
    </p>
  );
}
