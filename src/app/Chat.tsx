import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { sendMessage } from "../lib/assistant";
import { downscale, fileToDataUrl, requestProcessing } from "../lib/browser";
import { describeError } from "../lib/llm";
import { saveImage, savePastedLink } from "../lib/process";
import type { ChatMessage, Trip } from "../lib/types";
import { looksLikeUrl } from "../lib/url";
import { ArrowUp, Back, Plus } from "./Icons";

interface Props {
  trips: Trip[];
  trip: Trip | null;
  messages: ChatMessage[];
  onSelectTrip: (id: string) => void;
}

export function Chat({ trips, trip, messages, onSelectTrip }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const visible = messages.filter((m) => m.text.trim() !== "");
  const last = visible.at(-1);
  const choices = last?.role === "assistant" && !busy ? last.choices : [];

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [visible.length, busy]);

  async function addImages(files: Iterable<File>) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      await saveImage(await downscale(await fileToDataUrl(file)));
    }
    requestProcessing();
  }

  async function submit(value = text) {
    const input = value.trim();
    if (!input || busy) return;
    setError(null);
    const tokens = input.split(/\s+/);
    if (tokens.every(looksLikeUrl)) {
      for (const url of tokens) await savePastedLink(url);
      requestProcessing();
      setText("");
      return;
    }
    if (!trip) {
      setError("Önce bir seçenek kaydet ya da link yapıştır; gezi otomatik oluşur.");
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

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addImages(files);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addImages(Array.from(e.dataTransfer.files));
  }

  return (
    <section className="chat" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className="chat-top">
        <button className="trip-switch" onClick={() => setMenuOpen(!menuOpen)}>
          <Back /> Seyahatlerim
        </button>
        {menuOpen && (
          <div className="trip-menu">
            {trips.length === 0 && <div className="muted" style={{ padding: 10 }}>Henüz gezi yok</div>}
            {trips.map((t) => (
              <button key={t.id} className={t.id === trip?.id ? "active" : ""} onClick={() => (onSelectTrip(t.id), setMenuOpen(false))}>
                {t.title}
              </button>
            ))}
          </div>
        )}
        <div className="chat-title">Asistan</div>
      </div>

      <div className="messages">
        {visible.length === 0 && (
          <div className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
            Seçeneklerini kaydettikçe burada birlikte karar veririz. Bütçeni, neyin önemli olduğunu ya da
            "hangisi daha iyi?" diye sorabilirsin.
          </div>
        )}
        {visible.map((m) => (
          <div key={m.id} className={`msg-${m.role}`}>
            {m.text}
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
        {busy && <div className="thinking">Düşünüyor…</div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottom} />
      </div>

      <form className={`composer${dragging ? " drag" : ""}`} onSubmit={(e) => (e.preventDefault(), void submit())}>
        <button type="button" className="icon-btn" title="Ekran görüntüsü ekle" onClick={() => fileInput.current?.click()}>
          <Plus />
        </button>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          ref={fileInput}
          onChange={(e) => {
            void addImages(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          type="text"
          placeholder="Bir link bırak, görsel yapıştır veya yaz…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        <button type="submit" className="send-btn" disabled={!text.trim() || busy} aria-label="Gönder">
          <ArrowUp />
        </button>
      </form>
    </section>
  );
}
