// "Ne eklemek istersin?" (ulasim-v3 .sheet): the template tiles in three groups. A tile adds its record at
// once, no form (spec 0.33 §2): the board makes it with the city and the day of where the sheet was opened
// and opens the card for editing. "Düzenle" on a plan still opens its short form here. Also the header's
// "+ Ekle" and the "+" between two cards.
import { useEffect, useState, type FormEvent } from "react";
import { cardKindColor } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import { formOf, saveEdit, templateCardKind, templateLabel, TEMPLATES, type FormValues, type InsertAt, type Template } from "../../lib/templates";
import type { Item } from "../../lib/types";
import { KindIcon, UiIcon } from "./Silhouettes";

const groups = () =>
  [
    { key: "move", title: L("Ulaşım", "Getting around") },
    { key: "stay", title: L("Kalacak yer", "Places to stay") },
    { key: "other", title: L("Yapılacaklar ve diğer", "Things to do and more") },
  ] as const;

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="pk-add" onClick={onClick}>
      <UiIcon name="plus" size={16} />
      {L("Ekle", "Add")}
    </button>
  );
}

/** The "+" between two cards of the plan (and at the top of the plan and of each city): always there, faint until hovered. */
export function InsertPoint({ at, onAdd }: { at: InsertAt; onAdd: (at: InsertAt) => void }) {
  return (
    <div className="pk-insert">
      <button type="button" title={L("Buraya ekle", "Add here")} aria-label={L("Buraya ekle", "Add here")} onClick={() => onAdd(at)}>
        +
      </button>
    </div>
  );
}

export function AddSheet({ at, editing, currency, onClose, onPick }: {
  at: InsertAt | null;
  editing: Item | null;
  currency: string;
  onClose: () => void;
  /** A tile picked: the board adds it at once (TripPanel quickAdd). */
  onPick: (tpl: Template) => void;
}) {
  const initial = editing ? formOf(editing, currency) : null;
  const [tpl, setTpl] = useState<Template | null>(initial?.template ?? null);
  const [form, setForm] = useState<FormValues | null>(initial?.values ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const where = [at?.city, at?.date ? formatDateRange(at.date, null) : null].filter(Boolean).join(" · ");
  const pick = (t: Template) => onPick(t);
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tpl || !form || !editing || saving) return;
    setSaving(true);
    try {
      const out = await saveEdit(editing, tpl, form);
      if (typeof out === "string") return setError(out);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }
  const field = (k: keyof FormValues, label: string, type = "text") => (
    <label className="pk-field">
      <span>{label}</span>
      <input type={type} value={form![k]} onChange={set(k)} />
    </label>
  );
  return (
    <div className="pk-sheet-back" onClick={onClose}>
      <div className="pk-sheet" role="dialog" aria-modal="true" aria-label={L("Ne eklemek istersin?", "What would you like to add?")} onClick={(e) => e.stopPropagation()}>
        <header>
          <b>{tpl ? templateLabel(tpl.id) : L("Ne eklemek istersin?", "What would you like to add?")}</b>
          {where && !editing && <span>{where}</span>}
          <button type="button" className="pk-ib" aria-label={L("Kapat", "Close")} onClick={onClose}>×</button>
        </header>
        {!tpl || !form ? (
          groups().map((g) => (
            <section key={g.key}>
              <h4>{g.title}</h4>
              <div className="pk-tiles">
                {TEMPLATES.filter((t) => t.group === g.key).map((t) => (
                  <button key={t.id} type="button" className="pk-tile" onClick={() => pick(t)}>
                    <i style={{ background: cardKindColor(templateCardKind(t.id)) }}>
                      <KindIcon kind={t.id === "home" ? "home" : templateCardKind(t.id)} size={24} />
                    </i>
                    {templateLabel(t.id)}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <form className="pk-form" onSubmit={save}>
            {tpl.form === "trip" && <>{field("from", L("Nereden", "From"))}{field("to", L("Nereye", "To"))}{field("date", L("Tarih", "Date"), "date")}{field("time", L("Saat", "Time"), "time")}</>}
            {tpl.form === "rental" && <>{field("city", L("Yer", "Place"))}{field("date", L("Başlangıç", "Start"), "date")}{field("end", L("Bitiş", "End"), "date")}</>}
            {tpl.form === "stay" && <>{field("name", L("Ad", "Name"))}{field("city", L("Şehir", "City"))}{field("date", L("Giriş", "Check-in"), "date")}{field("end", L("Çıkış", "Check-out"), "date")}</>}
            {tpl.form === "named" && <>{field("name", L("Ad", "Name"))}{field("date", L("Tarih", "Date"), "date")}{field("city", L("Şehir (isteğe bağlı)", "City (optional)"))}</>}
            <div className="pk-price-field">
              {field("price", L("Fiyat (isteğe bağlı)", "Price (optional)"))}
              <label className="pk-field">
                <span>{L("Para birimi", "Currency")}</span>
                <select value={form.currency} onChange={set("currency")}>
                  {[...new Set([currency, "EUR", "TRY", "USD", "GBP"])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="pk-form-error" role="alert">{error}</p>}
            <div className="pk-form-acts">
              <button type="submit" className="pk-cta" disabled={saving}>{L("Kaydet", "Save")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
