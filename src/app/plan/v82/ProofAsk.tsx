// "Aldım" (onay paketi 2026-10-22, Uçuş adım 3): a white box under the row, never a yellow warning, that asks for what backs
// the booking: its code typed (PNR, booking no.) or its file dropped or picked; "Şimdilik yalnız işaretle" marks it bought
// without one (its row then says "Alındı · bileti eklenmedi", calm, its ticket the last step). Opened from the site's
// "Satın al ↗" it asks first ("Aldın mı?") and can be put off ("Henüz almadım").
import { useRef, useState } from "react";
import { DOC_ACCEPT } from "../../../lib/docs";
import { L } from "../../../lib/i18n";
import { Ic } from "./icons";
import { StageGlyph } from "./modeIcons";

export interface ProofAskProps {
  /** A stay's (or a rented car's) booking: its number and its confirmation, not a ticket. */
  booking: boolean;
  /** Opened from the site's link: whether it was bought at all is asked first. */
  asked: boolean;
  onRef: (code: string) => void;
  onFiles: ((files: File[]) => void) | null;
  onJust: () => void;
  onCancel: () => void;
}

export function ProofAsk({ booking, asked, onRef, onFiles, onJust, onCancel }: ProofAskProps) {
  const [code, setCode] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (files: File[]) => files.length && onFiles?.(files);
  const word = booking ? { code: L("Rezervasyon no", "Booking no."), add: L("Onayı ekle", "Add the confirmation"), doc: L("onay e-postasını ya da PDF'ini bırak", "drop the confirmation email or PDF") } : { code: L("PNR (rezervasyon kodu)", "PNR (booking code)"), add: L("Bileti ekle", "Add the ticket"), doc: L("PDF ya da e-postayı bırak", "drop the PDF or the email") };
  const title = asked
    ? booking
      ? L("Rezerve ettin mi? Ettiysen onayı da ekleyelim.", "Did you book it? If so, let's add the confirmation.")
      : L("Aldın mı? Aldıysan bileti de ekleyelim.", "Did you buy it? If so, let's add the ticket.")
    : booking
      ? L("Güzel, rezerve edildi. Onayı da ekleyelim mi?", "Booked. Shall we add the confirmation?")
      : L("Güzel, alındı. Bileti de ekleyelim mi?", "Bought. Shall we add the ticket?");
  return (
    <div className="q-proofq" role="group" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="q-pqh">
        <StageGlyph stage="bought" size={26} />
        <span>
          <b>{title}</b>
          <small>{booking ? L("Numarası ya da onay e-postası yeter; giriş saati ve ödenen okunur.", "Its number or the email is enough; the check-in and what was paid are read.") : L("PNR ya da bilet e-postası yeter; koltuk ve ödenen tutar okunur, yolculuk günü bilet elinin altında olur.", "The PNR or the ticket email is enough; the seat and what was paid are read, and the ticket is at hand on the day.")}</small>
        </span>
      </div>
      <div className="q-pqf">
        <label className="q-pqc">
          <small>{word.code}</small>
          <input
            type="text"
            value={code}
            placeholder={booking ? "4418223671" : "K7T2QX"}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.trim()) onRef(code.trim());
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        {onFiles && (
          <div className="q-pqd-w">
            <small>{L("ya da belge", "or a file")}</small>
            <button
              type="button"
              className={`q-pqd${over ? " over" : ""}`}
              onClick={() => input.current?.click()}
              onDragOver={(e) => (e.preventDefault(), setOver(true))}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                take([...e.dataTransfer.files]);
              }}
            >
              <Ic name="clip" size={15} stroke={2.2} />
              {word.doc}
            </button>
            <input ref={input} type="file" accept={DOC_ACCEPT} multiple hidden onChange={(e) => (take([...(e.target.files ?? [])]), (e.target.value = ""))} />
          </div>
        )}
      </div>
      <div className="q-pqa">
        <button type="button" className="q-got ok" disabled={!code.trim()} onClick={() => code.trim() && onRef(code.trim())}>
          {word.add}
        </button>
        <button type="button" className="q-chg" onClick={onJust}>
          {L("Şimdilik yalnız işaretle", "Just mark it for now")}
        </button>
        <span className="q-rsp" />
        <button type="button" className="q-chg" onClick={onCancel}>
          {asked ? L("Henüz almadım", "Not yet") : L("Vazgeç", "Cancel")}
        </button>
      </div>
    </div>
  );
}
