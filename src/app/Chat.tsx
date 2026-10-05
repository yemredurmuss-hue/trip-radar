import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { sendMessage } from "../lib/assistant";
import { L } from "../lib/i18n";
import { describeError } from "../lib/llm";
import type { ChatMessage, Trip } from "../lib/types";
import { DOC_ACCEPT } from "../lib/docs";
import { addLinks, addTripFiles, isTripFile } from "./capture";
import { UiIcon } from "./cards/Silhouettes";
import { ArrowUp, Back } from "./Icons";

interface Props {
  trip: Trip;
  messages: ChatMessage[];
  onBack: () => void;
}

/** The selected trip's own conversation; every trip has its own chat and context. */
export function Chat({ trip, messages, onBack }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const visible = messages.filter((m) => m.text.trim() !== "");
  const last = visible.at(-1);
  const choices = last?.role === "assistant" && !busy ? last.choices : [];

  // Block body on purpose: newer Chrome returns a Promise from scrollIntoView, and a value returned
  // from an effect is treated as its cleanup function (React then crashes calling it).
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [visible.length, busy]);

  async function submit(value = text) {
    const input = value.trim();
    if (!input || busy) return;
    setError(null);
    if (await addLinks(input)) {
      setText("");
      return;
    }
    setText("");
    setBusy(true);
    try {
      await sendMessage(trip.id, input);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  /** PDFs and pictures (0.34.6): kept in Belgeler and read; a page's screenshot goes the old way. */
  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    setReading((n) => n + files.length);
    try {
      const problems = await addTripFiles(trip.id, files);
      if (problems.length) setError(problems.map((p) => p.text).join(" "));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setReading((n) => n - files.length);
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.some(isTripFile)) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <section className="chat" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className="chat-top">
        <button className="trip-switch" onClick={onBack}>
          <Back /> {L("Seyahatlerim", "My trips")}
        </button>
        <div className="chat-title">{L("Asistan", "Assistant")}</div>
        <div className="muted chat-sub">{L(`${trip.title} için`, `For ${trip.title}`)}</div>
      </div>

      <div className="messages">
        {visible.length === 0 && (
          <div className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
            {L(
              'Seçeneklerini kaydettikçe burada birlikte karar veririz. Bütçeni, neyin önemli olduğunu ya da "hangisi daha iyi?" diye sorabilirsin.',
              'Save your options and we\'ll decide here together. Tell me your budget, what matters to you, or ask "which one is better?"',
            )}
          </div>
        )}
        {visible.map((m) => (
          <div key={m.id} className={`msg-${m.role}`}>
            <RichText text={m.text} />
          </div>
        ))}
        {choices.length > 0 && (
          <div className="choices">
            {choices.map((c, i) => (
              <button key={c} className={i === 0 ? "btn-primary" : "btn-link"} onClick={() => void submit(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        {busy && <div className="thinking">{L("Düşünüyor…", "Thinking…")}</div>}
        {reading > 0 && <div className="thinking">{L("Belge okunuyor…", "Reading the document…")}</div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottom} />
      </div>

      <form className={`composer${dragging ? " drag" : ""}`} onSubmit={(e) => (e.preventDefault(), void submit())}>
        <button type="button" className="icon-btn" title={L("Belge ya da görsel ekle (PDF, PNG, JPG)", "Add a document or picture (PDF, PNG, JPG)")}
          aria-label={L("Belge ya da görsel ekle", "Add a document or picture")} onClick={() => fileInput.current?.click()}>
          <UiIcon name="clip" size={18} />
        </button>
        <input
          type="file"
          accept={`${DOC_ACCEPT},image/*`}
          multiple
          hidden
          ref={fileInput}
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          type="text"
          placeholder={L("Bir link bırak, görsel yapıştır veya yaz…", "Drop a link, paste an image or type…")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        <button type="submit" className="send-btn" disabled={!text.trim() || busy} aria-label={L("Gönder", "Send")}>
          <ArrowUp />
        </button>
      </form>
    </section>
  );
}

/** The model's light formatting: **bold** is shown bold, everything else as plain text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}
