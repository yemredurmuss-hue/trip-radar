// Profilim's passport (0.39.4, Emre: the visa line asked "Pasaportun hangi ülke?" while Settings showed Türkiye): the
// field shows the passport the visa rules use (passport.ts loadHome), so one not chosen yet reads "Seçilmedi", never a
// Türkiye nothing has saved.
import { useEffect, useState } from "react";
import { L } from "../lib/i18n";
import { loadHome, savePassport } from "../lib/passport";

/** The passports the visa rules can be asked for (Profilim and the visa line's own question). */
export const PASSPORTS: ReadonlyArray<[string, () => string]> = [
  ["TR", () => L("Türkiye", "Turkey")],
  ["DE", () => L("Almanya", "Germany")],
  ["GB", () => L("Birleşik Krallık", "United Kingdom")],
  ["US", () => L("ABD", "USA")],
  ["XX", () => L("Diğer", "Other")],
];

/** The field itself: `value` is the passport saved (null: none chosen). */
export function PassportSelect({ value, onPick }: { value: string | null; onPick: (code: string) => void }) {
  return (
    <label className="field">
      {L("Pasaport", "Passport")}
      <select value={value ?? ""} onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="" disabled>
          {L("Seçilmedi", "Not chosen")}
        </option>
        {PASSPORTS.map(([code, name]) => (
          <option key={code} value={code}>
            {name()}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The passport saved, kept fresh (set here or in the visa line), and how to set it. */
export function PassportField() {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const load = () => void loadHome().then(setValue);
    load();
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handler = (changes: Record<string, unknown>, area: string) => area === "local" && "passport" in changes && load();
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  return <PassportSelect value={value} onPick={(code) => {
    setValue(code);
    void savePassport(code);
  }} />;
}
