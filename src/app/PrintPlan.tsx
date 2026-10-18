// The plan as a PDF (0.36.51, Emre: "%100 olunca planı PDF olarak indir; hero'daki tüm bilgiler ve gün gün detaylı
// akış"): a page laid out for paper off screen, its picture cut into A4 pages and saved as a PDF file named after the
// trip (0.36.55, Emre: "dosya"); Chrome's print window only when the file can't be made. What it says is what the board says: the hero (photo and
// its credit, dates, route, who goes, style, where the plan stands, the plan line, budget, the country's small
// things), the bookings, then every day's lines in their order with their times, notes and ideas. Pure drawing:
// the board hands it everything already worked out.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { currencyName, offsetText, plugFit, plugFitText, countryNames } from "../lib/heroInfo";
import { creditLine } from "../lib/cityImages";
import { dayCards, dayLinesOf, type DayCard } from "../lib/dayCards";
import { rowTitle, titleText, withLayovers, type Place } from "../lib/dayRowTitle";
import { mainPlaceOf, type MainPlace } from "../lib/destinations";
import { cardKindLabel, cardKind } from "../lib/cardKinds";
import type { HeroTally } from "../lib/heroInfo";
import { L, locale } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import { formatDateRange, formatPrice, nightsBetween } from "../lib/items";
import type { DayRow } from "../lib/journey";
import type { BudgetBar } from "../lib/progress";
import type { RentalEntry, Timeline } from "../lib/timeline";
import type { TripFacts as Facts } from "../lib/tripFacts";
import type { Who } from "../lib/tripSettings";
import type { StyleChip } from "../lib/tripStyle";
import type { Item, Listing, Trip } from "../lib/types";
import { jpegPagesToPdf, pageBreaks, type PdfPage } from "../lib/pdfFile";
import type { HeroCity } from "./TripHero";

export interface PrintPlanProps {
  trip: Trip;
  cities: HeroCity[];
  range: { start: string; end: string } | null;
  estimated: boolean;
  tally: HeroTally;
  /** The hero's own words for where the plan stands ("Planlananların %100'ü rezerve", "5 ihtiyaç karar bekliyor"). */
  progress: { head: string | null; meta: string | null };
  who: Who;
  chips: StyleChip[];
  bar: BudgetBar | null;
  facts: Facts;
  home: string;
  countries: string[];
  items: Item[];
  timeline: Timeline;
  listings?: Map<string, Listing>;
  mainPlaces?: MainPlace[];
  cityImage: (city: string | null) => string | null;
  /** The print window closed (saved or not): the page goes. */
  onDone: (made: "file" | "print" | null) => void;
  /** The board's own hero (section.hx): copied onto the page as it is drawn, photo, faces and all; without it, a summary. */
  hero?: React.RefObject<HTMLElement | null>;
}

/** A photo at the size paper needs (about 1600 px wide), from the sources that can scale it; any other as it is. */
export function paperSize(src: string): string {
  try {
    const u = new URL(src);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", "1600");
      u.searchParams.set("q", "80");
      u.searchParams.set("fm", "jpg");
      return u.toString();
    }
    if (u.hostname === "images.pexels.com") {
      u.searchParams.set("auto", "compress");
      u.searchParams.set("w", "1600");
      return u.toString();
    }
  } catch {
    // not a web address: as it is
  }
  return src;
}

const weekday = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), {
    weekday: "long",
    timeZone: "UTC",
  });
const dayDate = (c: DayCard) => (c.end ? formatDateRange(c.date, c.end) : `${formatDateRange(c.date, null)} · ${weekday(c.date)}`);

/** A4 at 96 px to the inch, the way the page is laid out off screen; its margins top and bottom. */
const PAGE = { width: 794, height: 1123, margin: 53 };

/** The file's name: the trip's title and dates, without what a file name can't hold. */
export const fileNameOf = (title: string): string => `${title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()}.pdf`;

/**
 * Once the page and its photos are there (a photo that doesn't come in 4 s isn't waited for): its picture taken,
 * cut into A4 pages between its blocks (the hero, a booking's row, a day), saved as a PDF file (Emre, 0.36.55:
 * "dosya"). The print window only if the file can't be made.
 */
function useFileWhenReady(root: React.RefObject<HTMLDivElement | null>, title: string, onDone: (made: "file" | "print" | null) => void) {
  useEffect(() => {
    let gone = false;
    const before = document.title;
    const el = root.current;
    const finish = (made: "file" | "print" | null) => {
      if (gone) return;
      gone = true;
      document.title = before;
      document.body.classList.remove("printing");
      onDone(made);
    };
    const imgs = [...(el?.querySelectorAll("img") ?? [])];
    const loaded = Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r()))))));
    void Promise.race([loaded, new Promise((r) => setTimeout(r, 4000))])
      .then(async () => {
        if (gone || !el) return;
        const bytes = await planPdf(el);
        if (gone) return;
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileNameOf(title);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        finish("file");
      })
      .catch((error) => {
        if (gone) return;
        console.warn("[print] the PDF file couldn't be made; the print window instead", error);
        // The print window: its "PDF olarak kaydet" saves the same page.
        document.title = title;
        el?.classList.remove("capturing");
        document.body.classList.add("printing");
        window.print();
        setTimeout(() => finish("print"), (window as unknown as { __printSettleMs?: number }).__printSettleMs ?? 1500);
      });
    return () => {
      gone = true;
      document.title = before;
      document.body.classList.remove("printing");
    };
  }, [root, title, onDone]);
}

/** The page laid out off screen as a PDF: its picture at twice the size, cut into A4 pages, each a JPEG. */
async function planPdf(el: HTMLElement): Promise<Uint8Array> {
  const { toCanvas } = await import("html-to-image");
  const top = el.getBoundingClientRect().top;
  const blocks = [...el.querySelectorAll(".pp-hero-copy, .pp-hero:not([hidden]), h2, .pp-bookings tr, .pp-day, .pp-foot")].map((b) => {
    const r = b.getBoundingClientRect();
    return { top: r.top - top, bottom: r.bottom - top };
  });
  const total = el.scrollHeight;
  const ratio = 2;
  const canvas = await toCanvas(el, { pixelRatio: ratio, backgroundColor: "#ffffff", width: PAGE.width, height: total, style: { left: "0", position: "static" } });
  const scale = canvas.height / total;
  const pages: PdfPage[] = [];
  for (const slice of pageBreaks(blocks, total, PAGE.height - PAGE.margin * 2)) {
    const page = document.createElement("canvas");
    page.width = Math.round(PAGE.width * scale);
    page.height = Math.round(PAGE.height * scale);
    const g = page.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, page.width, page.height);
    const h = (slice.end - slice.start) * scale;
    g.drawImage(canvas, 0, slice.start * scale, canvas.width, h, 0, PAGE.margin * scale, page.width, h);
    const blob = await new Promise<Blob | null>((r) => page.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new Error("a page couldn't be drawn");
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: page.width, height: page.height });
  }
  return jpegPagesToPdf(pages);
}

export function PrintPlan(props: PrintPlanProps) {
  const { trip, range } = props;
  const root = useRef<HTMLDivElement>(null);
  // The hero as the board draws it (Emre: "hero bilgileri olduğu gibi, tasarımda ne varsa"): its own markup copied in,
  // the buttons left out; drawn before the print window opens.
  const heroBox = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useLayoutEffect(() => {
    const from = props.hero?.current;
    const box = heroBox.current;
    if (!from || !box) return;
    const copy = from.cloneNode(true) as HTMLElement;
    // What's only there to tap ("Birini davet et", "Düzenle ›", "1 soru") or an empty block's hint means nothing on paper.
    copy.querySelectorAll(".hx-go, .hx-alt, .hx-menu, .hx-acts, .todo-list, .hx-prefs-link, .ask-mark, .hx-styles .empty, .hx-wait, small.accent").forEach((el) => el.remove());
    // Only the photo shown (its credit is the one drawn): the other cities' photos would only make the file heavy.
    copy.querySelectorAll(".hx-photo img:not(.on)").forEach((img) => img.remove());
    copy.querySelectorAll("img").forEach((img) => {
      img.removeAttribute("loading");
      img.src = paperSize(img.src);
    });
    box.replaceChildren(copy);
    setCopied(true);
  }, [props.hero]);
  const title = `${trip.title}${range ? ` · ${formatDateRange(range.start, range.end)}` : ""} · Trip Radar`;
  useFileWhenReady(root, title, props.onDone);

  const rentals = props.timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  const cards = dayCards(props.timeline.sections, {
    rentals,
    listings: props.listings,
    times: trip.dayTimes ?? undefined,
  });
  const mains = props.mainPlaces;
  const place: Place = (c) => (mains?.length ? (mainPlaceOf(mains, c) ?? c) : c);
  const cover = props.cities.find((c) => c.image) ?? null;
  const credit = cover?.credit ? creditLine(cover.credit) : null;
  const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
  const route = props.cities.map((c) => c.name).filter(Boolean);
  const booked = props.items
    .filter((i) => i.status === "booked")
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "9999").localeCompare(b.flight?.departure ?? b.dates.start ?? "9999"));

  return createPortal(
    <div className="print-plan capturing" ref={root} lang={trip.lang ?? undefined}>
      <div className="pp-hero-copy" ref={heroBox} />
      <header className="pp-hero" hidden={copied}>
        {cover?.image && (
          <figure className="pp-photo">
            <img src={cover.image} alt={cover.name} />
            {credit && (
              <figcaption>
                {credit.label} {credit.by ? `${credit.by.text} / ` : ""}
                {credit.source.text}
              </figcaption>
            )}
          </figure>
        )}
        <h1>{trip.title}</h1>
        <p className="pp-when">
          {range ? (
            <>
              {formatDateRange(range.start, range.end)} · {nDays(days)}
              {props.estimated ? L(" · tahmini", " · estimated") : ""}
            </>
          ) : (
            L("Tarih yok", "No dates yet")
          )}
        </p>
        {route.length > 0 && <p className="pp-route">{route.join(" → ")}</p>}
        <dl className="pp-facts">
          <div>
            <dt>{L("Kimler", "Who")}</dt>
            <dd>
              {props.who.names.length
                ? `${props.who.names.join(", ")}${props.who.count > props.who.names.length ? L(` · ${props.who.count} kişi`, ` · ${props.who.count} people`) : ""}`
                : L(`${props.who.count} kişi`, `${props.who.count} ${props.who.count === 1 ? "person" : "people"}`)}
            </dd>
          </div>
          {props.chips.length > 0 && (
            <div>
              <dt>{L("Tarz", "Style")}</dt>
              <dd>{props.chips.map((c) => c.label).join(" · ")}</dd>
            </div>
          )}
          {props.progress.head && (
            <div>
              <dt>{L("Plan", "Plan")}</dt>
              <dd>
                {props.progress.head}
                {props.progress.meta ? ` · ${props.progress.meta}` : ""}
              </dd>
            </div>
          )}
          <div>
            <dt>{L("İçerik", "In it")}</dt>
            <dd>
              {L(
                `${props.tally.flight} uçuş · ${props.tally.stay} konaklama · ${props.tally.transport} ulaşım · ${props.tally.experience} deneyim`,
                `${props.tally.flight} flights · ${props.tally.stay} stays · ${props.tally.transport} transport · ${props.tally.experience} experiences`,
              )}
            </dd>
          </div>
          {props.bar && (props.bar.booked > 0 || props.bar.chosen > 0 || props.bar.total != null) && (
            <div>
              <dt>{L("Bütçe", "Budget")}</dt>
              <dd>
                {[
                  props.bar.total != null
                    ? L(`${formatPrice(props.bar.total, props.bar.currency)} bütçe`, `${formatPrice(props.bar.total, props.bar.currency)} budget`)
                    : null,
                  L(`${formatPrice(props.bar.booked, props.bar.currency)} rezerve`, `${formatPrice(props.bar.booked, props.bar.currency)} booked`),
                  props.bar.chosen > 0
                    ? L(`${formatPrice(props.bar.chosen, props.bar.currency)} planlandı`, `${formatPrice(props.bar.chosen, props.bar.currency)} planned`)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          )}
          <Country facts={props.facts} home={props.home} countries={props.countries} />
        </dl>
      </header>

      {booked.length > 0 && (
        <section className="pp-bookings">
          <h2>{L("Rezervasyonlar", "Bookings")}</h2>
          <table>
            <tbody>
              {booked.map((i) => (
                <tr key={i.id}>
                  <td className="pp-kind">{cardKindLabel(cardKind(i))}</td>
                  <td>
                    <b>{i.name}</b>
                    {[i.provider, i.statusNote].filter(Boolean).length > 0 && (
                      <span className="pp-sub">{[i.provider, i.statusNote].filter(Boolean).join(" · ")}</span>
                    )}
                  </td>
                  <td className="pp-date">{i.dates.start ? formatDateRange(i.flight?.departure?.slice(0, 10) ?? i.dates.start, i.dates.end) : ""}</td>
                  <td className="pp-price">{i.price.amount != null ? formatPrice(i.price.amount, i.price.currency ?? "EUR") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="pp-days">
        <h2>{L("Gün gün", "Day by day")}</h2>
        {cards.map((card) => (
          <Day
            key={card.key}
            card={card}
            lines={withLayovers(
              dayLinesOf(card, {
                times: trip.dayTimes ?? undefined,
                order: trip.dayOrder ?? undefined,
                loose: trip.dayLoose ?? undefined,
              }),
            )}
            place={place}
          />
        ))}
      </section>

      <footer className="pp-foot">
        {L(`Trip Radar ile hazırlandı · ${new Date().toLocaleDateString(locale())}`, `Made with Trip Radar · ${new Date().toLocaleDateString(locale())}`)}
      </footer>
    </div>,
    document.body,
  );
}

/** The country's small things, as the hero has them: money (its rate), plug, the time against home, language. */
function Country({ facts, home, countries }: { facts: Facts; home: string; countries: string[] }) {
  const local = facts.local;
  const names = countryNames(countries);
  if (!local && !names.length) return null;
  const fit = local ? plugFit(home, facts.country) : null;
  const offset = local ? offsetText(local.hours) : null;
  const parts = local
    ? [
        `${currencyName(local.currency)}${local.rateText ? ` (${local.rateText})` : ""}`,
        local.info.plugs.length
          ? `${L(`${local.info.plugs.join("/")} priz`, `${local.info.plugs.join("/")} plug`)}${fit ? ` · ${plugFitText(fit)}` : ""}`
          : null,
        offset,
        L(local.info.language.tr, local.info.language.en),
      ]
    : [];
  return (
    <div>
      <dt>{names.length ? names.join(", ") : L("Ülke", "Country")}</dt>
      <dd>{parts.filter(Boolean).join(" · ") || "—"}</dd>
    </div>
  );
}

/** One day: its number, date and title, then its lines with their times, what they are and where they stand. */
function Day({ card, lines, place }: { card: DayCard; lines: DayRow[]; place: Place }) {
  return (
    <article className="pp-day">
      <header>
        <b>{card.dayNo ?? dayDate(card)}</b>
        <span>
          {card.dayNo ? `${dayDate(card)} · ` : ""}
          {card.title.replace(/\s*\d+(–\d+)?\. (Gün|Day)$/i, "")}
        </span>
      </header>
      {lines.length ? (
        <ol>
          {lines.map((r) => {
            const t = rowTitle(r, place);
            const time = r.time ? `${r.estimated ? "~" : ""}${r.time}` : "";
            return (
              <li key={r.key} className={r.kind === "idea" || r.kind === "ideas" ? "idea" : r.layover ? "quiet" : undefined}>
                <span className="pp-time">{time}</span>
                <span className="pp-what">
                  <b>{titleText(t)}</b>
                  {t.detail && <span className="pp-sub">{t.detail}</span>}
                  {r.kind === "ideas" && r.items.length > 0 && <span className="pp-sub">{r.items.map((i) => i.name).join(" · ")}</span>}
                  {r.notes.length > 0 && <span className="pp-sub">{r.notes.join(" · ")}</span>}
                  {r.warn && <span className="pp-warn">{r.warn}</span>}
                </span>
                <span className="pp-state">{r.layover ? "" : r.status}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="pp-free">{L("Serbest gün.", "A free day.")}</p>
      )}
    </article>
  );
}
