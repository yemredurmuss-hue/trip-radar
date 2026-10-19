// Belgeler ve internet's first line (v11, docs/mockups/2026-10-08-japonya-web-v11.html; plan v83 C25): the visa, said where
// the papers are, on the category's rail. The answer itself, from the visa table (lib/visa.ts visaAnswer): "Vize gerekmez ·
// 90 güne kadar", "Varışta vize ya da e-VOA", "Vize gerekli · başvuru", "e-Vize (ETA) gerekli"; a pair the table doesn't know
// keeps "Resmi kaynağa bak", and with no passport known it asks which. The official page small beside it, and "Var" / "Yok"
// like a plan's "Aldım": "Var" turns the line green ("Vize tamam"), "Yok" takes it back (one mark with Hazırlık's visa chore).
// None at home. Only what the visa table knows is said (no appointment lead time is made up).
import { L } from "../../lib/i18n";
import { savePassport } from "../../lib/passport";
import { visaAnswer, type Visa } from "../../lib/visa";
import { IdeaGlyph } from "../ideas/IdeaIcons";

/** The passports the visa rules can be asked for (as Settings → Pasaport lists them). */
const PASSPORTS: ReadonlyArray<[string, () => string]> = [
  ["TR", () => L("Türkiye", "Turkey")],
  ["DE", () => L("Almanya", "Germany")],
  ["GB", () => L("Birleşik Krallık", "United Kingdom")],
  ["US", () => L("ABD", "USA")],
  ["XX", () => L("Diğer", "Other")],
];

export function VisaRow({ visa, done, onDone }: { visa: Visa | null; done: boolean; onDone: (done: boolean) => void }) {
  if (!visa || visa.kind === "none") return null;
  const { head, sub } = visaAnswer(visa, done);
  const tone = done ? "ok" : visa.kind === "free" ? "ok free" : "need";
  return (
    <p className={`z-visa ${tone}`} data-visa={visa.kind} data-done={done ? "" : undefined}>
      {done || visa.kind === "free" ? <IdeaGlyph name="check" size={14} /> : <i className="z-vx" aria-hidden>!</i>}
      <b>{head}</b>
      {sub && <span>{sub}</span>}
      {visa.ask && !done && (
        <select className="z-vpass" aria-label={L("Pasaportun hangi ülke?", "Which country is your passport?")} defaultValue="" onChange={(e) => e.target.value && void savePassport(e.target.value)}>
          <option value="" disabled>
            {L("Pasaport seç", "Pick a passport")}
          </option>
          {PASSPORTS.map(([code, name]) => (
            <option key={code} value={code}>
              {name()}
            </option>
          ))}
        </select>
      )}
      <i className="q-sp" />
      <a className="q-alk z-vsrc" href={visa.link} target="_blank" rel="noreferrer">
        {L("Resmî kaynak ↗", "Official source ↗")}
      </a>
      <span className="z-vmark" role="group" aria-label={L("Vize", "Visa")}>
        <button type="button" className={`q-got${done ? " on" : ""}`} aria-pressed={done}
          title={L("Vize alındı ya da gerekmediği onaylandı", "Visa got, or confirmed it isn't needed")} onClick={() => !done && onDone(true)}>
          {L("Var", "Have it")}
        </button>
        <button type="button" className={`q-got${done ? "" : " on"}`} aria-pressed={!done}
          title={done ? L("Geri al: henüz yok", "Undo: not yet") : L("Henüz yok", "Not yet")} onClick={() => done && onDone(false)}>
          {L("Yok", "Not yet")}
        </button>
      </span>
    </p>
  );
}
