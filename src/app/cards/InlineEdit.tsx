// Editing a card where it stands (spec 0.33 §3). <InlineEdit item> around a card says which record its
// <Editable field> pieces belong to; each piece shows its value (or a faint "Tarih ekle"), a thin
// underline and the pencil on hover, and on a click the same-sized box: a date picker, a time picker, a
// number with its currency, or text. Enter or a click outside saves, Esc leaves it as it was, Tab goes to
// the next field (Shift+Tab back). A saved page's corrected field shows "sayfadaki: X · geri al" on hover.
// Which card and field are open lives on the board (CardEnv.focus), so a card that moves to its new day
// keeps its open field and is scrolled to.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { L } from "../../lib/i18n";
import { dropDraft, editableFields, fieldInput, fieldLabel, fieldPlaceholder, fieldValue, nextField, resumeDraft, saveCardField, type FieldKey } from "../../lib/inlineEdit";
import type { Item } from "../../lib/types";
import { clearUserEdit, correctionOf } from "../../lib/userEdits";
import { useCardEnv } from "./PlanCard";

interface EditApi {
  item: Item;
  fields: FieldKey[];
  open: FieldKey | null;
  /** Opens a field (null: closes); `scroll`: follow the card to where it's drawn next. */
  go: (field: FieldKey | null, scroll?: boolean) => void;
}

const EditContext = createContext<EditApi | null>(null);
/** The card's editing, when it's inside <InlineEdit> (null elsewhere: the pieces show their value only). */
export const useInlineEdit = () => useContext(EditContext);

/** `only`: the fields this face shows (an idea's row: its title), so Tab never opens one that isn't drawn. */
export function InlineEdit({ item, only, children }: { item: Item; only?: FieldKey[]; children: ReactNode }) {
  const env = useCardEnv();
  const fields = editableFields(item).filter((k) => !only || only.includes(k));
  const mine = env.focus?.id === item.id ? env.focus : null;
  // Just added, or moved by a new day: bring it into view once it's drawn in its place.
  useEffect(() => {
    if (!mine?.scroll) return;
    document.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    env.setFocus({ ...mine, scroll: false });
  });
  const api: EditApi = {
    item,
    fields,
    open: mine?.field ?? null,
    go: (field, scroll = false) => env.setFocus(field || scroll ? { id: item.id, field, scroll } : null),
  };
  return <EditContext.Provider value={api}>{children}</EditContext.Provider>;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** One field of the card: its value as the card shows it (children), or the box when it's open. */
export function Editable({ field, children }: { field: FieldKey; children?: ReactNode }) {
  const api = useInlineEdit();
  if (!api || !api.fields.includes(field)) return <>{children}</>;
  if (api.open === field) return <InlineField api={api} field={field} />;
  const empty = children == null || children === false || children === "";
  const page = correctionOf(api.item, field);
  const label = fieldLabel(field, api.item);
  return (
    <span className={`pk-ed-wrap${page != null ? " fixed" : ""}`}>
      <span className={`pk-ed${empty ? " empty" : ""}`} role="button" tabIndex={0} aria-label={L(`${label}: düzenle`, `${label}: edit`)}
        onClick={(e) => { e.stopPropagation(); api.go(field); }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          api.go(field);
        }}>
        {empty ? fieldPlaceholder(field, api.item) : children}
      </span>
      {page != null && (
        <span className="pk-ed-hint" onClick={stop}>
          {L(`sayfadaki: ${page}`, `on the page: ${page}`)} ·{" "}
          <button type="button" onClick={() => void clearUserEdit(api.item, field)}>{L("geri al", "undo")}</button>
        </span>
      )}
    </span>
  );
}

const CURRENCIES = ["EUR", "TRY", "USD", "GBP"];

function InlineField({ api, field }: { api: EditApi; field: FieldKey }) {
  const env = useCardEnv();
  const currency = env.decisions?.ctx.currency ?? "EUR";
  // The card moved by the last save is drawn again with a new box: it goes on with what was typed (inlineEdit.ts).
  const [draft] = useState(() => resumeDraft(api.item.id, field, { value: fieldValue(api.item, field, currency), cur: api.item.price.currency ?? currency }));
  const [value, setValue] = useState(draft.value);
  const [cur, setCur] = useState(draft.cur);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  // What the box opened with: untouched, nothing is written (the card may not have caught up with the last save yet).
  const opened = draft.opened;
  // In the same commit that takes the old box away: a key pressed in between would go to the page instead.
  useLayoutEffect(() => {
    const box = input.current;
    box?.focus({ preventScroll: true });
    if (!box || fieldInput(field) !== "text") return;
    // A new box selects its text to type over; one drawn again mid-typing keeps the caret at the end.
    if (box.value === opened.value) box.select();
    else box.setSelectionRange(box.value.length, box.value.length);
  }, [field, opened]);
  const label = fieldLabel(field, api.item);
  /** Saves, then opens `then` (or closes); a new day may move the card, so it's followed. */
  async function commit(then: FieldKey | null) {
    if (settled.current) return;
    settled.current = true;
    if (value === opened.value && (field !== "price" || cur === opened.cur)) {
      dropDraft(draft);
      return api.go(then);
    }
    const out = await saveCardField(api.item, field === "price" ? { price: value, currency: cur } : { [field]: value }, currency);
    if (typeof out === "string") {
      settled.current = false;
      setError(out);
      input.current?.focus({ preventScroll: true });
      return;
    }
    dropDraft(draft);
    api.go(then, out != null && (field === "date" || field === "end"));
  }
  const keys = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      void commit(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      settled.current = true;
      dropDraft(draft);
      api.go(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      void commit(nextField(api.fields, field, e.shiftKey));
    }
  };
  // A click outside saves (moving between the price and its currency doesn't).
  const blur = (e: FocusEvent<HTMLSpanElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit(null);
  };
  const type = fieldInput(field);
  return (
    <span className={`pk-ed-box t-${type}`} onClick={stop} onKeyDown={keys} onBlur={blur}>
      <input
        ref={input}
        className="pk-ed-input"
        type={type}
        value={value}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        placeholder={field === "name" ? api.item.name : fieldPlaceholder(field, api.item)}
        size={type === "text" ? Math.max(6, value.length + 1) : undefined}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        onChange={(e) => {
          setValue((draft.value = e.target.value));
          setError(null);
        }}
      />
      {field === "price" && (
        <select className="pk-ed-cur" value={cur} aria-label={L("Para birimi", "Currency")} onChange={(e) => setCur((draft.cur = e.target.value))}>
          {[...new Set([cur, currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      {error && <span className="pk-ed-err" role="alert">{error}</span>}
    </span>
  );
}
