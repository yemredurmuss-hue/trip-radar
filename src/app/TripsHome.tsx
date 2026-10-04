import { useState, type ClipboardEvent, type DragEvent } from "react";
import { requestProcessing } from "../lib/browser";
import { L } from "../lib/i18n";
import { formatDateRange, tripDateRange } from "../lib/items";
import { retryCapture } from "../lib/process";
import { isDemoTrip } from "../lib/trips";
import type { Capture, Item, Trip } from "../lib/types";
import { addImages, addLinks } from "./capture";
import { FallbackImg } from "./FallbackImg";
import { JoinShared } from "./Share";
import { joinTr } from "./TripPanel";

interface Props {
  trips: Trip[];
  items: Item[];
  openCaptures: Capture[];
  onOpen: (tripId: string) => void;
  onDemo: () => void;
  onSettings: () => void;
  menu: React.ReactNode;
}

/** "Seyahatlerim": every trip is its own board + chat; captures are sorted into them automatically. */
export function TripsHome({ trips, items, openCaptures, onOpen, onDemo, onSettings, menu }: Props) {
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const working = openCaptures.filter((c) => c.status !== "error");
  const failed = openCaptures.filter((c) => c.status === "error");
  const ordered = [...trips].sort((a, b) => Number(isDemoTrip(a)) - Number(isDemoTrip(b)) || b.updatedAt - a.updatedAt);

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
    <div className="home" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className="home-top">
        <h1>{L("Seyahatlerim", "My trips")}</h1>
        <div className="home-menu">{menu}</div>
      </div>

      <form
        className={`home-add${dragging ? " drag" : ""}`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await addLinks(link)) setLink("");
        }}
      >
        <input
          type="text"
          value={link}
          placeholder={L(
            "Link yapıştır ya da ekran görüntüsü sürükle — doğru geziye kendisi gider",
            "Paste a link or drag a screenshot. It finds the right trip on its own.",
          )}
          onChange={(e) => setLink(e.target.value)}
          onPaste={onPaste}
        />
        <button className="btn-primary" type="submit" disabled={!link.trim()}>
          {L("Ekle", "Add")}
        </button>
      </form>

      {(working.length > 0 || failed.length > 0) && (
        <div className="errors">
          {working.length > 0 && <div className="muted">
              {L(`${working.length} kayıt işleniyor…`, `Processing ${working.length} save${working.length === 1 ? "" : "s"}…`)}
            </div>}
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || L("Ekran görüntüsü", "Screenshot")}</span>
                <span className="muted">
                  {L(" — ", " · ")}
                  {c.error}
                </span>
              </span>
              <button
                className="small-btn"
                onClick={async () => {
                  await retryCapture(c.id);
                  requestProcessing();
                }}
              >
                {L("Tekrar dene", "Try again")}
              </button>
            </div>
          ))}
        </div>
      )}

      <JoinShared onJoined={onOpen} />

      {trips.length === 0 ? (
        <div className="trips-empty">
          <h2>{L("İlk seçeneğini kaydet", "Save your first option")}</h2>
          <ol>
            <li>
              <a href="#settings" onClick={onSettings}>
                {L("Ücretsiz Gemini anahtarını bağla", "Connect a free Gemini key")}
              </a>{" "}
              {L("(1 dakika, kart gerekmez).", "(1 minute, no card needed).")}
            </li>
            <li>
              {L(
                "Bir otel, uçuş, etkinlik ya da eSIM sayfasındayken araç çubuğundaki Trip Radar simgesine tıkla (veya Alt+Shift+S).",
                "On a hotel, flight, activity or eSIM page, click the Trip Radar icon in the toolbar (or Alt+Shift+S).",
              )}
            </li>
            <li>
              {L(
                "Gezi kendiliğinden oluşur: aynı yer ve yakın tarihler aynı geziye, başka yer ya da uzak tarih yeni geziye.",
                "Trips sort themselves: the same place and close dates join one trip, another place or far-off dates start a new one.",
              )}
            </li>
          </ol>
          <button className="btn-link" style={{ fontSize: 15, marginTop: 12 }} onClick={onDemo}>
            {L("Örnek geziyi yükle →", "Load the sample trip →")}
          </button>
        </div>
      ) : (
        <div className="trip-grid">
          {ordered.map((trip) => {
            const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
            const range = trip.confirmedDates ?? tripDateRange(own);
            const cities = [...new Set(own.map((i) => i.city).filter(Boolean) as string[])].slice(0, 3);
            const decided = own.filter((i) => i.status === "chosen" || i.status === "booked").length;
            const image = trip.heroImage ?? own.find((i) => i.imageUrl)?.imageUrl ?? null;
            return (
              <button key={trip.id} className="trip-card" onClick={() => onOpen(trip.id)}>
                <FallbackImg className="trip-card-img" src={image} fallback={<div className="trip-card-img" />} />
                <div className="trip-card-body">
                  <div className="trip-card-title">
                    {trip.title}
                    {isDemoTrip(trip) && <span className="badge">{L("Örnek", "Sample")}</span>}
                    {trip.shareId && <span className="badge">{L("Paylaşılan", "Shared")}</span>}
                  </div>
                  <div className="muted">
                    {[range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null]
                      .filter(Boolean)
                      .join(" · ") || L("Tarih ve yer kaydettikçe netleşir", "Dates and places fill in as you save")}
                  </div>
                  <div className="trip-card-meta">
                    {L(
                      `${own.length} kayıt${decided ? ` · ${decided} karar verildi` : ""}`,
                      `${own.length} save${own.length === 1 ? "" : "s"}${decided ? ` · ${decided} decided` : ""}`,
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
