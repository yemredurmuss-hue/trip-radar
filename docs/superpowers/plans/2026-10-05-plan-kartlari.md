# Plan kartları (0.31) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan görünümündeki uçuş, ulaşım, transfer, etkinlik, eSIM, sigorta (ve restoran/not) kartlarını onaylı iki taslaktaki ortak kabuğa geçirmek (zemin = durum, durum çemberi, tür rengi, noktalı siluet, 48 px alt şerit, dokununca açılan ayrıntı), kartlara belge eklemeyi (yeni `docs` deposu), 8 saniyelik geri almalı silmeyi ve şablondan eklemeyi getirmek; 0.31 olarak yayınlamak.

**Architecture:** Bütün kararlar saf fonksiyonlar olarak `src/lib/` altında ve testli: tür tespiti (`cardKinds.ts`), kartın söyledikleri (`cardView.ts`: çember, zemin, alt şerit, üst satır tarihi, ulaşım uçları, medya satırları, transferin kartı, ••• menüsü), belge deposu (`docs.ts`, DB sürüm 4), silme + geri alma (`removal.ts`, `undo.ts`), şablonlar (`templates.ts`). Görünüm `src/app/cards/` altında küçük dosyalarda: `CardShell.tsx` (kabuk, çember, menü, alt şerit), `CardDetail.tsx`, `TransportCard.tsx`, `MediaCard.tsx`, `LegCard.tsx`, `PlanCard.tsx` (dağıtıcı + seçenek gezgini + `CardEnv` bağlamı), `DocAccess.tsx`, `AddSheet.tsx`, `UndoToast.tsx`, `Silhouettes.tsx`, `parts.tsx` (SwipeCard'tan taşınan ortak parçalar). `TripPanel.tsx` ve `Timeline.tsx` yalnız bağlar; konaklama kartları (`SwipeCard`/`SettledCard`) kalır, yalnız çember ve belge erişimi alır. Günlük akış dokunulmaz.

**Tech Stack:** TypeScript, React 19, idb (IndexedDB), vitest + fake-indexeddb, esbuild (`npm run build`), Playwright (`scripts/e2e.mjs`), Chrome MV3.

**Görsel kaynak:** `docs/mockups/2026-10-05-ulasim-v3.html` (ulaşım: siluetler, gövde, ekleme penceresi, araya ekle, geri al bildirimi) ve `docs/mockups/2026-10-05-etkinlik-v4.html` (ortak kabuk: üst satır, çember, belge hapı, medya gövdesi, alt şerit). SVG path'leri ve CSS değerleri buradan birebir alınır. Spec: `docs/superpowers/specs/2026-10-05-plan-kartlari-design.md`.

**Dil kuralı:** Kullanıcıya görünen her metin `L("türkçe", "english")` ile (ya da `liveLabels`) iki dilde. Testler Türkçe çalışır (`src/lib/i18n.ts` varsayılanı `tr`).

**Ön doğrulama (2026-10-05):** Task 1–17'nin kodu bu plandan birebir, deponun bir kopyasına uygulanıp denendi: `npm run typecheck` temiz, `npx vitest run` 41 dosya / 360 test yeşil (293 + 67 yeni), `npm run build` temiz, `node scripts/e2e.mjs` bütün adımlarıyla geçti; geniş ve dar ekran görüntüleri taslaklarla karşılaştırıldı. Uygularken sapma çıkarsa önce plandaki kodla farkı kontrol et.

**Komutlar:** test `npx vitest run <dosya>` · tip `npm run typecheck` · paket `npm run build` · hepsi `npx vitest run` (başlangıç: 33 dosya, 293 test yeşil). Her görevin sonunda üçü de yeşil kalır.

---

## Spec'te belirsiz olup bu planda karara bağlananlar

1. **Noktalı dolgunun rengi:** taslaklarda desen (`<pattern>`) sayfa düzeyinde tanımlı; Chrome desen içindeki `currentColor`'ı desenin kendi atasından okur, bu yüzden onaylı görselde noktalar mürekkep rengi (`#1d1d1f`), kenar çizgisi tür rengindedir. Aynı görünüm için desenler tek kez, `color: #1d1d1f` olan gizli bir `<svg>` içinde tanımlanır (`SilhouetteDefs`).
2. **Üst satır:** v3'teki renkli kare ikon ve sağ üstteki durum hapı yerine spec'in ortak kabuğu (v4): çember · renkli ikon + ad · tarih | belge · •••. Durum yazısı yalnız alt şeritte.
3. **Bir ihtiyacın seçenekleri:** konaklama dışındaki gruplar yan yana kartlar yerine tek kart + alt şeritte `‹ 1/2 ›` (spec "seçenek gezgini"). Grubun öneri cümlesi (`Choice.headline`), "seçmeden kontrol et" listesi, "2.'ye göre" satırı, rozetler ve puan ayrıntıya taşınır; önerilen seçenekte alt şeritte "Önerim" (v3 `.best`).
4. **Transferler ve şehir değişimi** (`LegRow` başlığı ve `MoveCard`) Plan görünümünde ulaşım kartı olur (`LegCard`): tür bacak seçiminden; taksi, transfer, metro, yürüyüş, şehir içi otobüs/tren "Planlandı" olunca yeşil; şehirler arası uçak/tren/otobüs/vapur seçilince amber + "Bileti aldım". Ayrıntı, bugünkü `LegRow` gövdesidir (notlar, seçenekler, yol seçimi, "Ayarlandı" kutusu, "Gerek yok · gizle"). Günlük akıştaki `LegRow` aynen kalır.
5. **"Gerek yok"** yalnız transfer kartlarının ••• menüsünde (bugünkü gizleme). Kayıt kartlarında "Ele" (sayfadan gelen seçenek) ve "Sil" var; transfer kartında "Sil" yok (transfer konaklamalardan türer, silinecek kaydı yoktur), yerine "Planı temizle" (bacak seçimini siler).
6. **Taksi/transfer seçenekken:** tabloda "—" yazıyor; kaydedilmiş bir transfer sayfası yine "Plana seç" alır (yoksa seçilemez kalırdı).
7. **Geri almalar:** tabloda olmayan ama bugün kartta olan "Rezervasyonu geri al", "Seçimi geri al" ve eSIM için "Kurulmadı" ayrıntının bağlantı satırına taşınır; yanlış dokunuş geri alınabilir kalır.
8. **"✓ Alındı · varsa PNR":** kayıtta PNR alanı yok; alındıktan sonraki alt yazı `statusNote` (sohbette rezervasyonla söylenen not, PNR dahil), yoksa ücretsiz iptalin son günü.
9. **Kiralıkta sağ taraf:** "3 gün" + "iade 15 Ekim". "Aynı yere iade" kayıtta bilinmez; uydurulmaz.
10. **Şablondan eklenenler `origin: "chat"`** olarak kaydedilir (spec ikisine de izin veriyor). Böylece `plan.ts` ve `assistant.ts`'teki "sayfa kaydedilince yerini alır / aynı plan tekrar söylenince güncellenir" yolları değişmeden çalışır. Yeni türler için `plannedKind` birleşimi genişler (`minibus`, `moto_rental`, `rv_rental`, `bike_rental`, `food`, `insurance`, `note`); sohbet aracının listesi (`PLANNED_KINDS`) değişmez.
11. **Kalacak yer formu:** "diğerlerinde Ad, Tarih, Fiyat" konaklama için yetmez (gece sayısı). Otel ve Ev·daire: Ad, Şehir, Giriş, Çıkış, Fiyat.
12. **Restoran ve Not** da medya kartı kullanır (restoran `#b4532a` v3 kutusundan, not/diğer gri `#6e6e73`). eSIM `#3b6fd1`, sigorta `#0f8a6a` spec'ten (v3 kutularındaki gri yerine).
13. **Yerini sayfa alan planın belgeleri:** sohbet planına eklenen bilet, plan kapanıp yerine kaydedilen sayfa seçilince o sayfanın kartında görünür (`Plan.closed[].by` + `inheritedDocs`).
14. **Tek belgeyi silmek:** hap tek belgeyi doğrudan açar; silmek için ayrıntıda belge listesi (ad, boyut, Aç, Sil) durur.
15. **Saat biçimi** uygulamanın bugünkü `19:40` biçimi kalır (taslakta `19.40`).
16. **Konaklama kartlarına "Sil" eklenmez** (spec: bugünkü hâliyle kalır; yalnız çember + belge).

---

## Dosya yapısı

| Dosya | Sorumluluk |
| --- | --- |
| Modify `src/lib/types.ts` | `PlannedKind` birleşimi (yeni türler), `Item.installedAt?`, `DocRecord`, `DocMeta` |
| Modify `src/lib/planned.ts` | `TEMPLATE_ONLY_KINDS`, `ALL_PLANNED_KINDS`, yeni türlerin adı/kategori/ihtiyaç anahtarı, `checkPlanned(input, kinds)`, `planToSave`, `isGeneratedName` |
| Modify `src/lib/travelKinds.ts` | `RENTAL_KINDS`, `isInsurance`, (Task 18'de) `isSmall` ve `ERRAND` silinir |
| Modify `src/lib/legs.ts` | `modeOf`: `minibus` → `bus` |
| Create `src/lib/cardKinds.ts` | `TransportMode`, `CardKind`, `transportMode`, `cardKind`, renk/ad tabloları, `legModeByItem` |
| Create `src/lib/cardView.ts` | `ringOf`, `footOf`, `topDate`, `menuFor`, `transportFace`, `mediaFace`, `legCardView` |
| Modify `src/lib/db.ts` | Sürüm 4: `docs` deposu (`itemId`, `tripId` indeksleri), `blocking` kapatma, `exportAll` belge adları |
| Create `src/lib/docs.ts` | Belge deposu API'si + `checkDoc`, `sizeText`, `docPill`, `inheritedDocs` |
| Modify `src/lib/plan.ts` | `Plan.closed[].by` (yerini alan kaydın id'si) |
| Create `src/lib/removal.ts` | `deleteItem` (kayıt + belgeleri, tek işlemde), `restoreItem` |
| Create `src/lib/undo.ts` | `undoSlot`: 8 sn'lik tek "Geri al" yuvası |
| Create `src/lib/templates.ts` | Şablon listesi, form → `PlannedInput`, `templateItem`, `editedItem`, `formOf`, `insertAt`, `addFromTemplate`, `saveEdit`, `parseAmount` |
| Modify `src/lib/cardFacts.ts` | Ayrıntıya "İşletme" satırı |
| Modify `src/lib/assistant.ts` | `plan_item` → `planToSave`; silinen/birleşen sohbet planlarının belgeleri |
| Modify `src/app/actions.ts` | `removeItem` → `deleteItem`; `setInstalled` |
| Modify `src/app/App.tsx`, `src/app/ItemDrawer.tsx` | Gezi silinince belgeler; çekmecedeki sil → `deleteItem` |
| Create `src/app/cards/parts.tsx` | SwipeCard'tan taşınan: `SourceBadge`, `Needs`, `ProsCons`, `Details`, `Links`, `Price`, `ratingOf`, `datedLink`, yeni `TradeLine` |
| Create `src/app/cards/Silhouettes.tsx` | `SilhouetteDefs`, `KindIcon`, `UiIcon`, `TransportArt` (10 sahne), `MediaSilhouette` |
| Create `src/app/cards/CardShell.tsx` | `CardShell`, `Ring`, `CardMenu`, `CardFoot` |
| Create `src/app/cards/CardDetail.tsx` | Ayrıntı paneli |
| Create `src/app/cards/DocAccess.tsx` | `DocAccess`, `DocPickButton`, `DocList`, `openDoc`, `useTripDocs` |
| Create `src/app/cards/TransportCard.tsx` | `TransportCardBody` |
| Create `src/app/cards/MediaCard.tsx` | `MediaCardBody` |
| Create `src/app/cards/PlanCard.tsx` | `CardEnv` bağlamı, `PlanCard`, `NavGroup` |
| Create `src/app/cards/LegCard.tsx` | Transfer / şehir değişimi kartı |
| Create `src/app/cards/AddSheet.tsx` | `AddSheet`, `AddButton`, `InsertPoint` |
| Create `src/app/cards/UndoToast.tsx` | "… silindi · Geri al" |
| Modify `src/app/LegRow.tsx` | Gövde `LegBody` olarak dışarı; `onRemove` prop |
| Modify `src/app/Timeline.tsx` | `legCard`, `onAdd` prop'ları; araya ekle; `MoveCard` silinir |
| Modify `src/app/TripPanel.tsx` | `CardEnv`, kart dağıtımı, `OptionGroupView` → `NavGroup`, ekleme penceresi, geri al bildirimi |
| Modify `src/app/SwipeCard.tsx` | Parçalar `parts.tsx`'ten; konaklamaya çember + belge; `Route`, `SettledRow` silinir |
| Modify `src/app/Status.tsx`, `src/app/Progress.tsx` | `StatusBar` `ring` prop'u; `findTarget` seçenek gezgini |
| Modify `static/app.css` | `pk-` önekli kart stilleri (taslaklardan); ölü kurallar silinir |
| Modify `scripts/e2e.mjs`, `DESIGN.md`, `README.md`, `PLAN.md` | Doğrulama ve belgeler |
| Tests | `tests/fixtures/makeItem.ts`, `tests/planned.test.ts`, `tests/cardKinds.test.ts`, `tests/cardView.test.ts`, `tests/legCard.test.ts`, `tests/docs.test.ts`, `tests/removal.test.ts`, `tests/undo.test.ts`, `tests/templates.test.ts`, `tests/actions.test.ts` (ek) |

---

### Task 1: Yeni plan türleri, sigorta tespiti, test kaydı yardımcısı

**Files:** Modify `src/lib/types.ts`, `src/lib/planned.ts`, `src/lib/travelKinds.ts`, `src/lib/legs.ts`; Create `tests/fixtures/makeItem.ts`, `tests/planned.test.ts`

- [ ] **Step 1: Test yardımcısı**

```ts
// tests/fixtures/makeItem.ts
// A plain saved record for tests; override what the test is about.
import { EMPTY_METRICS } from "../../src/lib/items";
import type { Item } from "../../src/lib/types";

let seq = 0;
export function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: `i${++seq}`, tripId: "t1", captureIds: [], key: null, category: "transport", needKey: "transport:x", name: "Item",
    provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, city: null, country: null, countryCode: null,
    location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "page" },
    guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
```

- [ ] **Step 2: Failing test**

```ts
// tests/planned.test.ts
import { describe, expect, it } from "vitest";
import { ALL_PLANNED_KINDS, checkPlanned, plannedItem, PLANNED_KINDS, type PlannedInput } from "../src/lib/planned";
import { isInsurance, isLocalTransfer, isRental, isTrip } from "../src/lib/travelKinds";
import { makeItem } from "./fixtures/makeItem";

const said = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "flight", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over,
});

describe("kinds made by the add sheet", () => {
  it("a motorbike, a camper and a bike are rentals in their city", () => {
    const moto = plannedItem(said({ kind: "moto_rental", city: "Funchal", date: "2026-10-12", end_date: "2026-10-15" }), "t1", "m", 1);
    expect(moto).toMatchObject({ category: "transport", name: "Motosiklet kiralama · Funchal", needKey: "transport:moto-funchal", plannedKind: "moto_rental" });
    expect(isRental(moto)).toBe(true);
    expect(isRental(plannedItem(said({ kind: "rv_rental", city: "Madeira" }), "t1", "r", 1))).toBe(true);
    expect(plannedItem(said({ kind: "bike_rental", city: "Porto" }), "t1", "b", 1).name).toBe("Bisiklet kiralama · Porto");
  });
  it("a minibus is a trip between places", () => {
    const m = plannedItem(said({ kind: "minibus", from: "Lagos", to: "Sagres", date: "2026-10-15", time: "09:00" }), "t1", "x", 1);
    expect(m).toMatchObject({ category: "transport", name: "Minibüs · Lagos → Sagres", flight: { from: "Lagos", to: "Sagres", departure: "2026-10-15T09:00" } });
    expect(isTrip(m)).toBe(true);
    expect(isLocalTransfer(m)).toBe(false);
  });
  it("insurance, a restaurant and a note", () => {
    const ins = plannedItem(said({ kind: "insurance", date: "2026-10-07" }), "t1", "i", 1);
    expect(ins).toMatchObject({ category: "other", name: "Seyahat sigortası" });
    expect(isInsurance(ins)).toBe(true);
    expect(plannedItem(said({ kind: "food", title: "Cantinho do Avillez", city: "Porto" }), "t1", "f", 1)).toMatchObject({ category: "food", name: "Cantinho do Avillez" });
    expect(plannedItem(said({ kind: "note", title: "Vize randevusu" }), "t1", "n", 1)).toMatchObject({ category: "other", plannedKind: "note" });
  });
  it("the chat tool still only takes its own kinds", () => {
    expect(PLANNED_KINDS).not.toContain("minibus");
    expect(checkPlanned(said({ kind: "minibus", to: "Sagres" }))).toMatch(/Bilinmeyen tür/);
    expect(checkPlanned(said({ kind: "minibus", to: "Sagres" }), ALL_PLANNED_KINDS)).toBeNull();
    expect(checkPlanned(said({ kind: "moto_rental" }), ALL_PLANNED_KINDS)).toMatch(/şehirde/);
  });
});

describe("insurance from the words on a saved page", () => {
  it("knows a policy, not a lounge pass", () => {
    expect(isInsurance(makeItem({ category: "other", name: "Allianz seyahat sağlık sigortası" }))).toBe(true);
    expect(isInsurance(makeItem({ category: "other", name: "Lounge pass" }))).toBe(false);
    expect(isInsurance(makeItem({ category: "stay", name: "Hotel Seguro" }))).toBe(false);
  });
});
```

- [ ] **Step 3:** `npx vitest run tests/planned.test.ts` → FAIL (`ALL_PLANNED_KINDS`, `isInsurance` yok)

- [ ] **Step 4: `src/lib/types.ts`**

`Item.plannedKind` satırını değiştir ve `installedAt` ekle; dosyanın sonuna belge tiplerini ekle:

```ts
/** What a plan said in the chat, or added from a template, is (a car rental or a transfer can carry any title). */
export type PlannedKind =
  | "flight" | "train" | "bus" | "minibus" | "ferry" | "transfer" | "taxi"
  | "car_rental" | "moto_rental" | "rv_rental" | "bike_rental"
  | "stay" | "activity" | "food" | "esim" | "insurance" | "note" | "other";
```

`Item` içinde:

```ts
  /** What kind of plan was said in the chat or added from a template (a car rental or a transfer can carry any title). */
  plannedKind?: PlannedKind;
  /** eSIM: when the traveller said it's installed ("Kurdum"). */
  installedAt?: number;
```

Dosyanın sonuna:

```ts
/** A file attached to a card (a ticket PDF, a QR screenshot). Kept on this computer only: never shared, never exported. */
export interface DocRecord {
  id: string;
  itemId: string;
  tripId: string;
  name: string;
  /** MIME type (HEIC files often come without one; see docs.docType). */
  type: string;
  size: number;
  blob: Blob;
  addedAt: number;
}
export type DocMeta = Omit<DocRecord, "blob">;
```

- [ ] **Step 5: `src/lib/travelKinds.ts`**

`import type { Item } from "./types";` satırını `import type { Item, PlannedKind } from "./types";` yap. `isRental` gövdesindeki `i.plannedKind === "car_rental"` yerine `RENTAL_KINDS.includes(i.plannedKind)`; `ERRAND`'dan sigortayı ayır:

```ts
/** Kinds rented for days in one place. */
export const RENTAL_KINDS: readonly PlannedKind[] = ["car_rental", "moto_rental", "rv_rental", "bike_rental"];

export const isRental = (i: Item) =>
  i.category === "transport" &&
  (i.plannedKind
    ? RENTAL_KINDS.includes(i.plannedKind)
    : RENTAL.test(itemText(i)) || (!i.flight?.from && !i.flight?.to && span(i) >= 2));

const INSURANCE = /sigorta|insurance|seguro/i;
/** A visa, a lounge pass, an eSIM: a small thing to arrange, not a place or a trip. */
const ERRAND = /vize|visa\b|e-?visa|lounge|fast ?track|esim|e-sim|sim kart/i;

/** Travel insurance: added from the template, or a saved page that says so (no category of its own). */
export const isInsurance = (i: Item) =>
  i.plannedKind === "insurance" || (!i.plannedKind && (i.category === "other" || i.category === "transport") && INSURANCE.test(itemText(i)));

export const isSmall = (i: Item) =>
  i.category === "esim" || isLocalTransfer(i) || ((i.category === "other" || i.category === "transport") && !isRental(i) && (ERRAND.test(itemText(i)) || isInsurance(i)));
```

- [ ] **Step 6: `src/lib/planned.ts`**

```ts
import { L } from "./i18n";
import { liveLabels } from "./i18nText";
import { EMPTY_METRICS, isoDate } from "./items";
import { cityKeyOf } from "./plan";
import { RENTAL_KINDS } from "./travelKinds";
import type { Category, Item, PlannedKind } from "./types";

export type { PlannedKind } from "./types";
/** Kinds the chat's plan_item tool may use. */
export const PLANNED_KINDS = ["flight", "train", "bus", "ferry", "transfer", "taxi", "car_rental", "stay", "activity", "esim", "other"] as const satisfies readonly PlannedKind[];
/** Kinds only the add sheet makes (the chat says them as one of the above). */
export const TEMPLATE_ONLY_KINDS = ["minibus", "moto_rental", "rv_rental", "bike_rental", "food", "insurance", "note"] as const satisfies readonly PlannedKind[];
export const ALL_PLANNED_KINDS: readonly PlannedKind[] = [...PLANNED_KINDS, ...TEMPLATE_ONLY_KINDS];
```

(Eski `export type PlannedKind = (typeof PLANNED_KINDS)[number];` satırını sil.)

`CATEGORY` tablosuna: `minibus: "transport", moto_rental: "transport", rv_rental: "transport", bike_rental: "transport", food: "food", insurance: "other", note: "other"`.

`WORD`'e `minibus: ["Minibüs", "Minibus"]`; `TRAVEL`'a `"minibus"`. Yeni ad tablosu:

```ts
const RENTAL_WORD: Readonly<Partial<Record<PlannedKind, string>>> = liveLabels({
  car_rental: ["Araç kiralama", "Car rental"],
  moto_rental: ["Motosiklet kiralama", "Motorbike rental"],
  rv_rental: ["Karavan kiralama", "Camper van rental"],
  bike_rental: ["Bisiklet kiralama", "Bike rental"],
});
```

`checkPlanned` imzası ve iki satırı:

```ts
export function checkPlanned(input: PlannedInput, kinds: readonly string[] = PLANNED_KINDS): string | null {
  if (!kinds.includes(input.kind)) return L(`Bilinmeyen tür: ${input.kind}`, `Unknown kind: ${input.kind}`);
  // ...diğer kontroller aynı; car_rental satırı:
  if ((RENTAL_KINDS.includes(input.kind) || input.kind === "stay") && !input.city && !input.to) return L("Hangi şehirde olduğunu (city) yaz.", "Give the city it's in (city).");
```

`nameOf` içinde `car_rental` satırını şu üçüyle değiştir:

```ts
  if (RENTAL_WORD[i.kind]) return `${RENTAL_WORD[i.kind]}${at}`;
  if (i.kind === "insurance") return L("Seyahat sigortası", "Travel insurance");
  if (i.kind === "food") return `${L("Restoran", "Restaurant")}${at}`;
  if (i.kind === "note") return L("Not", "Note");
```

`needKeyOf` içinde:

```ts
  if (RENTAL_KINDS.includes(i.kind)) return `transport:${i.kind === "car_rental" ? "car" : i.kind.replace("_rental", "")}-${slug(i.city ?? i.to)}`;
  if (i.kind === "insurance") return `other:insurance-${slug(i.city ?? i.to)}`;
  if (i.kind === "note") return `other:note-${slug(i.title)}`;
```

`GENERATED` düzenli ifadesi ve dışa açılan sarmalayıcısı:

```ts
const GENERATED =
  /^(Uçuş|Tren|Otobüs|Minibüs|Feribot|Transfer|Taksi|Araç kiralama|Motosiklet kiralama|Karavan kiralama|Bisiklet kiralama|Konaklama|Restoran|Seyahat sigortası|Not|eSIM|Plan|Flight|Train|Bus|Minibus|Ferry|Taxi|Car rental|Motorbike rental|Camper van rental|Bike rental|Stay|Restaurant|Travel insurance|Note)( ·|$)/;
/** A name nameOf made (in either language), not one the traveller gave. */
export const isGeneratedName = (name: string) => GENERATED.test(name);
```

(`fillPlanned` içindeki `GENERATED.test(before.name)` aynı kalır.)

- [ ] **Step 7: `src/lib/legs.ts` `modeOf`:** `if (i.plannedKind === "taxi") return "taxi";` satırının altına `if (i.plannedKind === "minibus") return "bus";`.

- [ ] **Step 8:** `npx vitest run tests/planned.test.ts` → PASS · `npm run typecheck` · `npx vitest run` (assistant ve legs testleri yeşil) · `npm run build`
- [ ] **Step 9:** `git add -A && git commit -m "Plan kinds: minibus, motorbike/camper/bike rentals, food, insurance, note"`

---

### Task 2: Tür tespiti (`cardKinds.ts`)

**Files:** Create `src/lib/cardKinds.ts`, Test `tests/cardKinds.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/cardKinds.test.ts
import { describe, expect, it } from "vitest";
import { cardKind, cardKindColor, cardKindLabel, legModeByItem, transportMode } from "../src/lib/cardKinds";
import type { Leg } from "../src/lib/legs";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const t = (name: string, over: Partial<Item> = {}) => makeItem({ category: "transport", name, ...over });

describe("which way of travel a card is", () => {
  it.each([
    ["CP Alfa Pendular · Porto → Lizbon", "train"],
    ["FlixBus Lizbon → Lagos", "bus"],
    ["Dolmuş Lagos → Sagres", "minibus"],
    ["Porto Santo Line feribot", "ferry"],
    ["Havalimanı transferi", "taxi"],
    ["Rentalcars · Funchal", "car"],
    ["Scooter kiralama Funchal", "moto"],
    ["Indie Campers karavan", "rv"],
    ["Bisiklet kiralama Porto", "bike"],
  ])("%s → %s (from its words)", (name, mode) => expect(transportMode(t(name))).toBe(mode));

  it("the planned kind comes first, then the transfer's chosen way, then the flight category", () => {
    expect(transportMode(t("Herhangi bir şey", { plannedKind: "ferry" }), "train")).toBe("ferry");
    expect(transportMode(t("Plan"), "train")).toBe("train");
    expect(transportMode(t("Plan"), "transfer")).toBe("taxi");
    expect(transportMode(makeItem({ category: "flight", name: "Pegasus" }))).toBe("flight");
  });
  it("metro, walking or nothing said: unknown", () => {
    expect(transportMode(t("Plan · Madeira"), "metro")).toBeNull();
    expect(cardKind(t("Plan · Madeira"))).toBe("transport");
  });
  it("a car rented for days without a word that says so is still a car", () => {
    expect(transportMode(t("Funchal", { dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }))).toBe("car");
  });
});

describe("card kinds beyond travel", () => {
  it("by category, insurance and notes by what they are", () => {
    expect(cardKind(makeItem({ category: "activity" }))).toBe("activity");
    expect(cardKind(makeItem({ category: "esim" }))).toBe("esim");
    expect(cardKind(makeItem({ category: "food" }))).toBe("food");
    expect(cardKind(makeItem({ category: "stay" }))).toBe("stay");
    expect(cardKind(makeItem({ category: "other", name: "Seyahat sağlık sigortası" }))).toBe("insurance");
    expect(cardKind(makeItem({ category: "transport", name: "Allianz seyahat sigortası" }))).toBe("insurance");
    expect(cardKind(makeItem({ category: "other", name: "Airalo eSIM Portekiz" }))).toBe("esim");
    expect(cardKind(makeItem({ category: "other", name: "Vize randevusu", plannedKind: "note" }))).toBe("note");
    expect(cardKind(makeItem({ category: "other", name: "Lounge" }))).toBe("other");
  });
  it("colours and names from the approved mockups", () => {
    expect(["flight", "train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike", "transport"].map((k) => cardKindColor(k as never))).toEqual([
      "#6a4fe0", "#2563c9", "#d9480f", "#e8890c", "#0e8fb0", "#d29a00", "#475467", "#c0256b", "#8a6534", "#5d8a1c", "#6e6e73",
    ]);
    expect([cardKindColor("activity"), cardKindColor("esim"), cardKindColor("insurance")]).toEqual(["#a8336f", "#3b6fd1", "#0f8a6a"]);
    expect(cardKindLabel("taxi")).toBe("Taksi · transfer");
    expect(cardKindLabel("transport")).toBe("Ulaşım");
  });
});

describe("the way chosen for a transfer, per record", () => {
  it("reaches the transfer's options and its trip", () => {
    const a = t("A");
    const b = t("B");
    const leg = { choice: { mode: "train", booked: false, note: null, updatedAt: 1 }, options: [a], travel: { items: [b] } } as unknown as Leg;
    const none = { choice: null, options: [t("C")], travel: null } as unknown as Leg;
    expect([...legModeByItem([leg, none])]).toEqual([[a.id, "train"], [b.id, "train"]]);
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: Implement**

```ts
// src/lib/cardKinds.ts
// What kind of thing a plan card shows, for its colour, icon and picture: ten ways to travel (approved
// transport mockup), activities, eSIMs, insurance, restaurants, notes. Read from the record as it is, no
// new field: the planned kind, the way chosen for its transfer, the category, then the words on it. Pure.
import { liveLabels } from "./i18nText";
import type { Leg } from "./legs";
import { isInsurance, isLocalTransfer, isRental, itemText, LOCAL, RENTAL } from "./travelKinds";
import type { Item, LegMode, PlannedKind } from "./types";

export const TRANSPORT_MODES = ["flight", "train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];
/** "transport": a way of travel we couldn't tell (grey, a plain arrow, no picture). */
export type CardKind = TransportMode | "transport" | "activity" | "esim" | "insurance" | "food" | "note" | "other" | "stay";

/** Rented for days in one place: the card's right side is how long, not where to. */
export const RENTAL_MODES: readonly TransportMode[] = ["car", "moto", "rv", "bike"];
/** A ticket is bought for these ("Bileti aldım"). */
export const TICKET_MODES: readonly TransportMode[] = ["flight", "train", "bus", "minibus", "ferry"];

const FROM_PLANNED: Partial<Record<PlannedKind, TransportMode>> = {
  flight: "flight", train: "train", bus: "bus", minibus: "minibus", ferry: "ferry", transfer: "taxi", taxi: "taxi",
  car_rental: "car", moto_rental: "moto", rv_rental: "rv", bike_rental: "bike",
};
/** A transfer's chosen way; metro and walking have no picture of their own. */
const FROM_LEG: Partial<Record<LegMode, TransportMode>> = { flight: "flight", train: "train", bus: "bus", ferry: "ferry", taxi: "taxi", transfer: "taxi", car: "car" };
/** The words on a page or a plan, most specific first (a minibus isn't a bus, a scooter rental isn't a car). */
const BY_TEXT: [RegExp, TransportMode][] = [
  [/karavan|kamp aracı|camper|motorhome|motor home/i, "rv"],
  [/motosiklet|motorsiklet|scooter|moped|motorbike|motorcycle/i, "moto"],
  [/bisiklet|bicycle|\be-?bike\b|\bbike\b/i, "bike"],
  [/minibüs|dolmuş|minibus/i, "minibus"],
  [/vapur|feribot|ferry|ferri/i, "ferry"],
  [/tren|train|comboio|\brail|renfe|trenitalia|sncf|alfa pendular|intercidades/i, "train"],
  [/otobüs|\bbus\b|flixbus|coach|autocarro|rede expressos|\balsa\b/i, "bus"],
  [RENTAL, "car"],
  [LOCAL, "taxi"],
];

export const legTransportMode = (mode: LegMode | null | undefined): TransportMode | null => (mode ? (FROM_LEG[mode] ?? null) : null);

/** The way of travel: planned kind → the transfer's chosen way → a flight → its words → a rental/transfer by shape → unknown. */
export function transportMode(item: Item, legMode: LegMode | null = null): TransportMode | null {
  const planned = item.plannedKind ? FROM_PLANNED[item.plannedKind] : undefined;
  if (planned) return planned;
  const fromLeg = legTransportMode(legMode);
  if (fromLeg) return fromLeg;
  if (item.category === "flight") return "flight";
  const text = itemText(item);
  const said = BY_TEXT.find(([re]) => re.test(text));
  if (said) return said[1];
  if (isRental(item)) return "car";
  if (isLocalTransfer(item)) return "taxi";
  return null;
}

export function cardKind(item: Item, legMode: LegMode | null = null): CardKind {
  switch (item.category) {
    case "stay":
      return "stay";
    case "activity":
      return "activity";
    case "food":
      return "food";
    case "esim":
      return "esim";
    case "flight":
      return transportMode(item, legMode) ?? "flight";
    case "transport":
      return isInsurance(item) ? "insurance" : (transportMode(item, legMode) ?? "transport");
    default:
      if (isInsurance(item)) return "insurance";
      if (item.plannedKind === "note") return "note";
      if (/\besim\b|e-sim|sim kart/i.test(itemText(item))) return "esim";
      return "other";
  }
}

const COLORS: Record<CardKind, string> = {
  flight: "#6a4fe0", train: "#2563c9", bus: "#d9480f", minibus: "#e8890c", ferry: "#0e8fb0", taxi: "#d29a00",
  car: "#475467", moto: "#c0256b", rv: "#8a6534", bike: "#5d8a1c", transport: "#6e6e73",
  activity: "#a8336f", esim: "#3b6fd1", insurance: "#0f8a6a", food: "#b4532a", note: "#6e6e73", other: "#6e6e73", stay: "#23998b",
};
const LABELS = liveLabels({
  flight: ["Uçuş", "Flight"], train: ["Tren", "Train"], bus: ["Otobüs", "Bus"], minibus: ["Minibüs", "Minibus"], ferry: ["Vapur", "Ferry"],
  taxi: ["Taksi · transfer", "Taxi · transfer"], car: ["Araç kiralama", "Car rental"], moto: ["Motosiklet", "Motorbike"],
  rv: ["Karavan", "Camper van"], bike: ["Bisiklet", "Bike"], transport: ["Ulaşım", "Transport"], activity: ["Etkinlik", "Activity"],
  esim: ["eSIM", "eSIM"], insurance: ["Sigorta", "Insurance"], food: ["Restoran", "Restaurant"], note: ["Not", "Note"],
  other: ["Diğer", "Other"], stay: ["Konaklama", "Stay"],
});
export const cardKindColor = (k: CardKind): string => COLORS[k];
export const cardKindLabel = (k: CardKind): string => LABELS[k];
export const isTransportKind = (k: CardKind): k is TransportMode | "transport" => k === "transport" || (TRANSPORT_MODES as readonly string[]).includes(k);

/** The way the traveller chose for each transfer, for the records in it (its options and the trip it meets). */
export function legModeByItem(legs: Leg[]): Map<string, LegMode> {
  const out = new Map<string, LegMode>();
  for (const leg of legs) {
    const mode = leg.choice?.mode;
    if (!mode) continue;
    for (const i of [...leg.options, ...(leg.travel?.items ?? [])]) if (!out.has(i.id)) out.set(i.id, mode);
  }
  return out;
}
```

- [ ] **Step 4:** run → PASS · `npm run typecheck`
- [ ] **Step 5:** commit `"Cards: tell the kind (ten ways to travel, media kinds) and its colour"`

---

### Task 3: Kartın durumu: çember, zemin, alt şerit, tarih, menü (`cardView.ts`, 1. kısım)

**Files:** Create `src/lib/cardView.ts`, Test `tests/cardView.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/cardView.test.ts
import { describe, expect, it } from "vitest";
import { footOf, groundOf, menuFor, ringOf, topDate } from "../src/lib/cardView";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const train = (over: Partial<Item> = {}) => makeItem({ category: "transport", name: "CP Alfa Pendular", ...over });
const state = (f: ReturnType<typeof footOf>) => (f.left.kind === "state" ? [f.left.tone, f.left.text, f.left.sub] : ["nav"]);

describe("the ring and the ground", () => {
  it("dashed while open, amber when chosen, green when done", () => {
    expect(ringOf(train(), "train")).toBe("open");
    expect(ringOf(train({ status: "chosen" }), "train")).toBe("half");
    expect(ringOf(train({ status: "booked" }), "train")).toBe("done");
    expect([groundOf("open"), groundOf("half"), groundOf("done")]).toEqual(["sand", "sand", "green"]);
  });
  it("a taxi or a note needs no booking: planned is done", () => {
    expect(ringOf(train({ status: "chosen" }), "taxi")).toBe("done");
    expect(ringOf(makeItem({ category: "other", status: "chosen" }), "note")).toBe("done");
  });
});

describe("the bottom strip, per the spec's action table", () => {
  it("an option: the navigator with several, 'Karar bekliyor' alone; the action picks it", () => {
    expect(footOf(train(), "train", { options: 2 })).toEqual({ left: { kind: "nav" }, action: { label: "Plana seç", does: "choose" } });
    expect(state(footOf(train(), "train"))).toEqual(["wait", "Karar bekliyor", null]);
  });
  it("chosen: what is still missing and the one action", () => {
    expect(footOf(train({ status: "chosen" }), "train")).toMatchObject({ action: { label: "Bileti aldım", does: "book" } });
    expect(state(footOf(train({ status: "chosen" }), "train"))).toEqual(["wait", "Seçildi", "bilet alınmadı"]);
    expect(state(footOf(train({ status: "chosen", origin: "chat" }), "train"))).toEqual(["wait", "Planlanıyor", "bilet alınmadı"]);
    expect(footOf(train({ status: "chosen" }), "car")).toMatchObject({ left: { sub: "rezerve edilmedi" }, action: { label: "Rezerve ettim" } });
    expect(footOf(makeItem({ category: "activity", status: "chosen" }), "activity")).toMatchObject({ action: { label: "Bileti aldım" } });
    expect(footOf(makeItem({ category: "esim", status: "chosen" }), "esim")).toMatchObject({ left: { sub: "satın alınmadı" }, action: { label: "Satın aldım" } });
    expect(footOf(makeItem({ category: "other", status: "chosen" }), "insurance")).toMatchObject({ left: { sub: "poliçe alınmadı" }, action: { label: "Poliçe aldım" } });
  });
  it("a taxi: planned, no booking, no button", () => {
    expect(footOf(train({ status: "chosen" }), "taxi")).toEqual({
      left: { kind: "state", tone: "done", text: "Planlandı", sub: "rezervasyon gerekmez", alert: null },
      action: null,
    });
  });
  it("booked: done, with the note said with it or the free-cancellation day", () => {
    expect(state(footOf(train({ status: "booked" }), "flight"))).toEqual(["done", "Alındı", null]);
    expect(state(footOf(train({ status: "booked", statusNote: "PNR X7K2LQ" }), "flight"))).toEqual(["done", "Alındı", "PNR X7K2LQ"]);
    expect(state(footOf(train({ status: "booked", cancellation: { summary: null, freeUntil: "2026-10-13", source: "page" } }), "activity"))).toEqual(["done", "Alındı", "ücretsiz iptal: 13 Ekim"]);
    expect(state(footOf(train({ status: "booked" }), "car"))).toEqual(["done", "Rezerve", null]);
  });
  it("an eSIM: bought, then installed", () => {
    const esim = makeItem({ category: "esim", status: "booked" });
    expect(footOf(esim, "esim")).toMatchObject({ left: { tone: "wait", text: "Alındı", sub: "kurulmadı" }, action: { label: "Kurdum", does: "install" } });
    expect(footOf({ ...esim, installedAt: 5 }, "esim")).toMatchObject({ left: { tone: "done", text: "Kuruldu" }, action: null });
  });
  it("ruled out: it can come back", () => {
    expect(footOf(train({ status: "dismissed" }), "train")).toMatchObject({ left: { tone: "plain", text: "Elendi" }, action: { label: "Geri al", does: "restore" } });
  });
  it("time running out replaces the small line", () => {
    const f = footOf(train({ status: "chosen" }), "train", { alert: { tone: "red", text: "Ücretsiz iptal için 2 gün kaldı" } });
    expect(f.left).toMatchObject({ sub: "Ücretsiz iptal için 2 gün kaldı", alert: "red" });
  });
});

describe("the date on the top line", () => {
  it("a day for a trip, a span for a rental or an eSIM, the hour for an activity", () => {
    expect(topDate(makeItem({ category: "flight", dates: { start: "2026-10-12", end: null, source: "page" }, flight: { from: "LIS", to: "FNC", departure: "2026-10-12T08:15", arrival: null, carrier: null, flightNumber: null, stops: 0 } }), "flight")).toBe("12 Ekim");
    expect(topDate(train({ dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }), "car")).toBe("12–15 Ekim");
    expect(topDate(makeItem({ category: "esim", dates: { start: "2026-10-07", end: "2026-10-18", source: "page" } }), "esim")).toBe("7–18 Ekim");
    expect(topDate(makeItem({ category: "activity", dates: { start: "2026-10-09", end: null, source: "page" }, flight: { from: null, to: null, departure: "2026-10-09T16:00", arrival: null, carrier: null, flightNumber: null, stops: null } }), "activity")).toBe("9 Ekim · 16:00");
    expect(topDate(train(), "train")).toBeNull();
  });
});

describe("the ••• menu", () => {
  it("edit a plan made by hand or in the chat, rule out a saved option, delete anything", () => {
    expect(menuFor(train())).toEqual(["dismiss", "delete"]);
    expect(menuFor(train({ origin: "chat", status: "chosen" }))).toEqual(["edit", "delete"]);
    expect(menuFor(train({ status: "chosen" }))).toEqual(["delete"]);
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: Implement (dosyanın ilk kısmı; Task 4 ve 5 aynı dosyaya ekler)**

```ts
// src/lib/cardView.ts
// What a plan card says, from the record: the ring (to decide / chosen / done), the colour of its ground,
// the bottom strip (where it stands or which option, and its one action), the date on its top line, the
// ••• menu, the two ends of a trip, a media card's lines, and a transfer as a card. Pure.
import { L } from "./i18n";
import { formatDateRange, isoDate } from "./items";
import { clockOf } from "./legs";
import { isTrip } from "./travelKinds";
import { RENTAL_MODES, TICKET_MODES, type CardKind } from "./cardKinds";
import type { Item } from "./types";

export type Ring = "open" | "half" | "done";
/** Nothing to book: once planned it's done (a taxi from the rank, a note). */
const NO_BOOKING: readonly CardKind[] = ["taxi", "note"];

export function ringOf(item: Item, kind: CardKind): Ring {
  if (item.status === "booked") return "done";
  if (item.status === "chosen") return NO_BOOKING.includes(kind) ? "done" : "half";
  return "open";
}

/** The ground says what the ring says: sand until it's done, green once it is. */
export const groundOf = (ring: Ring): "sand" | "green" => (ring === "done" ? "green" : "sand");

export type FootAction = "choose" | "book" | "install" | "restore";
export type FootLeft =
  | { kind: "nav" }
  | { kind: "state"; tone: "wait" | "done" | "plain"; text: string; sub: string | null; alert: "red" | "amber" | null };
export interface FootView {
  left: FootLeft;
  action: { label: string; does: FootAction } | null;
}

const state = (tone: "wait" | "done" | "plain", text: string, sub: string | null = null): FootLeft => ({ kind: "state", tone, text, sub, alert: null });

type Words = { not: string; act: string; done: string };
const ticketWords = (): Words => ({ not: L("bilet alınmadı", "no ticket yet"), act: L("Bileti aldım", "I got the ticket"), done: L("Alındı", "Booked") });
const reserveWords = (): Words => ({ not: L("rezerve edilmedi", "not booked"), act: L("Rezerve ettim", "I booked it"), done: L("Rezerve", "Booked") });
function words(item: Item, kind: CardKind): Words {
  if ((TICKET_MODES as readonly string[]).includes(kind) || kind === "activity") return ticketWords();
  if (kind === "transport") return isTrip(item) ? ticketWords() : reserveWords();
  if (kind === "esim") return { not: L("satın alınmadı", "not bought"), act: L("Satın aldım", "I bought it"), done: L("Alındı", "Bought") };
  if (kind === "insurance") return { not: L("poliçe alınmadı", "no policy yet"), act: L("Poliçe aldım", "I got the policy"), done: L("Alındı", "Bought") };
  return reserveWords();
}

/** What a booking keeps on the card: the note said with it (a PNR, a meeting point), else until when it's free to cancel. */
function bookedSub(item: Item): string | null {
  if (item.statusNote) return item.statusNote;
  const until = isoDate(item.cancellation.freeUntil);
  return until ? L(`ücretsiz iptal: ${formatDateRange(until, null)}`, `free cancellation until ${formatDateRange(until, null)}`) : null;
}

/**
 * The bottom strip (spec's action table): an option shows the navigator (or "Karar bekliyor" alone) and
 * "Plana seç"; chosen, what's missing and the one action; done, a ✓ and what was kept. A deadline from
 * progress.dateAlert takes the small line.
 */
export function footOf(item: Item, kind: CardKind, opts: { options?: number; alert?: { tone: "red" | "amber"; text: string } | null } = {}): FootView {
  const w = words(item, kind);
  const alert = opts.alert ?? null;
  const withAlert = (left: FootLeft): FootLeft => (alert && left.kind === "state" ? { ...left, sub: alert.text, alert: alert.tone } : left);
  switch (item.status) {
    case "dismissed":
      return { left: state("plain", L("Elendi", "Ruled out")), action: { label: L("Geri al", "Undo"), does: "restore" } };
    case "saved":
      return {
        left: (opts.options ?? 1) > 1 ? { kind: "nav" } : withAlert(state("wait", L("Karar bekliyor", "To decide"))),
        action: { label: L("Plana seç", "Add to plan"), does: "choose" },
      };
    case "chosen": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), kind === "taxi" ? L("rezervasyon gerekmez", "no booking needed") : null)), action: null };
      const text = item.origin === "chat" ? L("Planlanıyor", "Planning") : L("Seçildi", "Chosen");
      return { left: withAlert(state("wait", text, w.not)), action: { label: w.act, does: "book" } };
    }
    case "booked": {
      if (NO_BOOKING.includes(kind)) return { left: withAlert(state("done", L("Planlandı", "Planned"), bookedSub(item))), action: null };
      if (kind === "esim" && !item.installedAt) {
        return { left: withAlert(state("wait", L("Alındı", "Bought"), L("kurulmadı", "not installed"))), action: { label: L("Kurdum", "Installed it"), does: "install" } };
      }
      if (kind === "esim") return { left: withAlert(state("done", L("Kuruldu", "Installed"), bookedSub(item))), action: null };
      return { left: withAlert(state("done", w.done, bookedSub(item))), action: null };
    }
  }
}

/** The top line's date: a day for a trip, a span for a rental, an eSIM or insurance, the hour too for an activity or a table. */
export function topDate(item: Item, kind: CardKind): string | null {
  const start = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  if (!start) return null;
  const end = isoDate(item.dates.end);
  const ranged = (RENTAL_MODES as readonly string[]).includes(kind) || kind === "esim" || kind === "insurance";
  if (ranged && end && end !== start) return formatDateRange(start, end);
  const time = kind === "activity" || kind === "food" ? clockOf(item.flight?.departure) : null;
  return time ? `${formatDateRange(start, null)} · ${time}` : formatDateRange(start, null);
}

export type MenuAction = "edit" | "dismiss" | "delete";
/** The ••• menu: change a plan made by hand or in the chat, rule out a saved option (it waits under Elenenler), delete. */
export function menuFor(item: Item): MenuAction[] {
  const out: MenuAction[] = [];
  if (item.origin === "chat") out.push("edit");
  if (item.status === "saved" && item.origin !== "chat") out.push("dismiss");
  out.push("delete");
  return out;
}
```

- [ ] **Step 4:** run → PASS · `npm run typecheck`
- [ ] **Step 5:** commit `"Cards: ring, ground, bottom strip, top-line date and menu"`

---

### Task 4: Ulaşım uçları ve medya satırları (`cardView.ts`, 2. kısım)

**Files:** Modify `src/lib/cardView.ts`, Test `tests/cardView.test.ts` (ekle)

- [ ] **Step 1: Failing test** — üstteki cardView importunu `import { footOf, groundOf, mediaFace, menuFor, ringOf, topDate, transportFace } from "../src/lib/cardView";` yap, `import { EMPTY_METRICS } from "../src/lib/items";` ekle; dosyanın sonuna:

```ts
describe("a trip's two ends", () => {
  it("a flight: where from and to, the day and the hour, duration and stops in the middle", () => {
    const f = makeItem({
      category: "flight", name: "TAP · Lizbon → İstanbul", metrics: { ...EMPTY_METRICS, durationMinutes: 295 },
      flight: { from: "LIS", to: "IST", departure: "2026-10-14T19:40", arrival: "2026-10-15T01:35", carrier: "TAP", flightNumber: "TP 1760", stops: 0 },
    });
    expect(transportFace(f, "flight")).toEqual({
      rental: false,
      from: { city: "LIS", sub: "14 Ekim", time: "19:40" },
      to: { city: "IST", sub: "15 Ekim", time: "01:35" },
      middle: "4 sa 55 dk · direkt",
    });
  });
  it("a rental: where it's picked up, then how many days and the return day", () => {
    const car = makeItem({ plannedKind: "car_rental", city: "Funchal", optionDetail: "Otomatik", location: { address: null, area: "Havalimanı", approximate: false }, dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } });
    expect(transportFace(car, "car")).toEqual({
      rental: true,
      from: { city: "Funchal", sub: "Havalimanı", time: "12 Ekim" },
      to: { city: "3 gün", sub: "iade 15 Ekim", time: null },
      middle: "Otomatik",
    });
  });
  it("nothing known of the route: no ends (the card shows its name)", () => {
    expect(transportFace(makeItem({ name: "Tren" }), "train")).toEqual({ rental: false, from: null, to: null, middle: null });
  });
});

describe("a media card's lines", () => {
  it("an activity: place, the hour in bold, duration, people; rating, reviews, the site", () => {
    const tour = makeItem({
      category: "activity", name: "Douro altı köprü tekne turu", imageUrl: "https://img/x.jpg",
      location: { address: null, area: "Ribeira iskelesi", approximate: false }, guests: { adults: 2, children: null, rooms: null },
      metrics: { ...EMPTY_METRICS, durationMinutes: 50 }, rating: { value: 4.8, scale: 5, count: 2140, source: "page" },
      flight: { from: null, to: null, departure: "2026-10-09T16:00", arrival: null, carrier: null, flightNumber: null, stops: null },
    });
    expect(mediaFace(tour, "activity", { label: "GetYourGuide", host: "getyourguide.com", url: "https://www.getyourguide.com/t" })).toEqual({
      title: "Douro altı köprü tekne turu",
      info: [{ text: "Ribeira iskelesi" }, { text: "16:00", strong: true }, { text: "50 dk" }, { text: "2 kişi" }],
      meta: [{ text: "★ 4,8", kind: "star" }, { text: "2.140 yorum", kind: "plain" }, { text: "GetYourGuide ↗", kind: "link", href: "https://www.getyourguide.com/t" }],
      image: "https://img/x.jpg",
      silhouette: null,
    });
  });
  it("an activity without a photo gets the museum drawing", () => {
    expect(mediaFace(makeItem({ category: "activity", name: "Serralves" }), "activity", null).silhouette).toBe("museum");
  });
  it("an eSIM: data and country, days, the shop and its site", () => {
    const esim = makeItem({ category: "esim", name: "Airalo Portekiz", country: "Portekiz", provider: "Airalo", status: "booked", metrics: { ...EMPTY_METRICS, dataGb: 10, validityDays: 15 } });
    expect(mediaFace(esim, "esim", { label: "Airalo", host: "airalo.com", url: "https://www.airalo.com/portugal" })).toEqual({
      title: "10 GB · Portekiz",
      info: [{ text: "15 gün" }, { text: "yola çıkmadan kur" }],
      meta: [{ text: "Airalo", kind: "plain" }, { text: "airalo.com ↗", kind: "link", href: "https://www.airalo.com/portugal" }],
      image: null,
      silhouette: "esim",
    });
  });
  it("insurance: people and days, the company, its rating and site; no cover listed", () => {
    const ins = makeItem({
      category: "other", name: "Seyahat sağlık sigortası", provider: "Allianz", guests: { adults: 2, children: null, rooms: null },
      dates: { start: "2026-10-07", end: "2026-10-18", source: "user" }, rating: { value: 4.4, scale: 5, count: null, source: "page" },
    });
    expect(mediaFace(ins, "insurance", { label: "Allianz", host: "allianz.com.tr", url: "https://www.allianz.com.tr/x" })).toMatchObject({
      title: "Seyahat sağlık sigortası",
      info: [{ text: "2 kişi" }, { text: "12 gün" }],
      meta: [{ text: "Allianz", kind: "plain" }, { text: "★ 4,4", kind: "star" }, { text: "allianz.com.tr ↗", kind: "link" }],
      silhouette: "shield",
    });
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: Implement (cardView.ts'e ekle)**

İmportları genişlet:

```ts
import { durationText, type CardFacts } from "./cardFacts";
import { count, nDays, nReviews, nStops, num } from "./i18nText";
import { formatDateRange, isoDate, metricsOf, nightsBetween } from "./items";
import type { TransportMode } from "./cardKinds";
```

```ts
export interface End {
  city: string;
  sub: string | null;
  /** Shown bold after the sub line. */
  time: string | null;
}
export interface TransportFace {
  from: End | null;
  to: End | null;
  /** Under the drawing: duration and stops, or what's rented ("Otomatik"). */
  middle: string | null;
  rental: boolean;
}

const dayOf = (iso: string | null | undefined) => {
  const d = isoDate(iso?.slice(0, 10));
  return d ? formatDateRange(d, null) : null;
};

/** A trip as two ends (ulasim-v3): from and to with the day and the hour; a rental as where it's picked up and for how long. */
export function transportFace(item: Item, kind: TransportMode | "transport"): TransportFace {
  const m = metricsOf(item);
  if ((RENTAL_MODES as readonly string[]).includes(kind)) {
    const start = isoDate(item.dates.start);
    const end = isoDate(item.dates.end);
    const days = start && end ? nightsBetween(start, end) : 0;
    return {
      rental: true,
      from: item.city ? { city: item.city, sub: item.location.area ?? item.location.address ?? item.provider, time: dayOf(start) } : null,
      to: days > 0 ? { city: nDays(days), sub: end ? L(`iade ${dayOf(end)}`, `return ${dayOf(end)}`) : null, time: null } : null,
      middle: item.optionDetail,
    };
  }
  const f = item.flight;
  const stops = kind === "flight" && f?.stops != null ? (f.stops === 0 ? L("direkt", "direct") : nStops(f.stops)) : null;
  return {
    rental: false,
    from: f?.from ? { city: f.from, sub: dayOf(f.departure ?? item.dates.start), time: clockOf(f.departure) } : null,
    to: f?.to ? { city: f.to, sub: dayOf(f.arrival ?? f.departure ?? item.dates.start), time: clockOf(f.arrival) } : null,
    middle: [m.durationMinutes ? durationText(m.durationMinutes) : null, stops].filter(Boolean).join(" · ") || null,
  };
}

export interface MediaFace {
  title: string;
  /** The info line (place · **hour** · duration · people), joined with " · ". */
  info: { text: string; strong?: boolean }[];
  /** The source line: ★ rating, reviews, the shop, the site ↗. */
  meta: { text: string; kind: "star" | "plain" | "link"; href?: string }[];
  image: string | null;
  silhouette: "museum" | "esim" | "shield" | null;
}

const people = (n: number) => count(n, "kişi", "person", "people");

/** A media card's text (etkinlik-v4): title, info line, source line, and its picture (a photo or a dotted drawing). */
export function mediaFace(item: Item, kind: CardKind, source: CardFacts["source"]): MediaFace {
  const m = metricsOf(item);
  const info: MediaFace["info"] = [];
  const add = (text: string | null | undefined, strong = false) => {
    if (text) info.push(strong ? { text, strong } : { text });
  };
  let title = item.name;
  if (kind === "esim") {
    const data = m.unlimitedData ? L("Sınırsız", "Unlimited") : m.dataGb ? `${num(m.dataGb)} GB` : null;
    const where = item.country ?? item.city;
    if (data) title = where ? `${data} · ${where}` : data;
    add(m.validityDays ? nDays(m.validityDays) : null);
    if (item.status === "booked" && !item.installedAt) add(L("yola çıkmadan kur", "install before you leave"));
  } else if (kind === "insurance") {
    add(item.guests.adults ? people(item.guests.adults) : null);
    const [s, e] = [isoDate(item.dates.start), isoDate(item.dates.end)];
    add(s && e ? nDays(nightsBetween(s, e) + 1) : null);
  } else if (kind === "note" || kind === "other") {
    add(item.summary || item.statusNote);
  } else {
    add(item.location.area ?? item.location.address ?? item.city);
    add(clockOf(item.flight?.departure), true);
    add(m.durationMinutes ? durationText(m.durationMinutes) : null);
    add(item.guests.adults ? people(item.guests.adults) : null);
  }
  const meta: MediaFace["meta"] = [];
  const shop = kind === "esim" || kind === "insurance" ? item.provider : null;
  if (shop) meta.push({ text: shop, kind: "plain" });
  if (item.rating.value != null) meta.push({ text: `★ ${num(item.rating.value)}`, kind: "star" });
  if (item.rating.count) meta.push({ text: nReviews(item.rating.count), kind: "plain" });
  if (source?.url) meta.push({ text: `${shop ? (source.host ?? source.label) : source.label} ↗`, kind: "link", href: source.url });
  else if (source && source.label !== shop) meta.push({ text: source.label, kind: "plain" });
  const image = kind === "esim" || kind === "insurance" ? null : item.imageUrl;
  const silhouette = kind === "esim" ? "esim" : kind === "insurance" ? "shield" : kind === "activity" && !image ? "museum" : null;
  return { title, info, meta, image, silhouette };
}
```

- [ ] **Step 4:** run → PASS · `npm run typecheck`
- [ ] **Step 5:** commit `"Cards: a trip's two ends and a media card's lines"`

---

### Task 5: Transferin kartı (`legCardView`)

**Files:** Modify `src/lib/cardView.ts`, Test `tests/legCard.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/legCard.test.ts
import { describe, expect, it } from "vitest";
import { legCardView } from "../src/lib/cardView";
import type { Leg } from "../src/lib/legs";
import { plannedItem } from "../src/lib/planned";

const leg = (over: Partial<Leg> = {}): Leg => ({
  key: "2026-10-11:move:porto-lizbon", kind: "move", date: "2026-10-11", slot: 1,
  from: { label: "Porto", city: "Porto", item: null }, to: { label: "Lizbon", city: "Lizbon", item: null },
  after: null, before: null, options: [], mode: null, via: null, travel: null, status: "empty", statusText: "", choice: null, notes: [],
  ...over,
});
const choice = (mode: Leg["mode"], booked = false) => ({ mode, booked, note: null, updatedAt: 1 });
const state = (v: ReturnType<typeof legCardView>) => (v.foot.left.kind === "state" ? [v.foot.left.tone, v.foot.left.text, v.foot.left.sub] : ["nav"]);

describe("a transfer or a change of city as a card", () => {
  it("nothing planned: open ring, how will you go", () => {
    const v = legCardView(leg());
    expect([v.kind, v.label, v.ring, v.ariaLabel, v.searchUrl]).toEqual(["transport", "Şehir değişimi", "open", "Porto → Lizbon", null]);
    expect(state(v)).toEqual(["plain", "Planlanmadı", "nasıl geçeceksiniz?"]);
    expect([v.from, v.to]).toEqual([{ city: "Porto", sub: "11 Ekim", time: null }, { city: "Lizbon", sub: "11 Ekim", time: null }]);
  });
  it("by plane between cities: amber until the ticket, with a flight search", () => {
    const v = legCardView(leg({ choice: choice("flight"), status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["flight", "Uçuş", "half"]);
    expect(state(v)).toEqual(["wait", "Planlanıyor", "bilet alınmadı"]);
    expect(v.foot.action).toEqual({ label: "Bileti aldım", does: "book" });
    expect(decodeURIComponent(v.searchUrl!)).toBe("https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11");
    const done = legCardView(leg({ choice: choice("flight", true), status: "booked" }));
    expect([done.ring, done.searchUrl]).toEqual(["done", null]);
    expect(state(done)).toEqual(["done", "Alındı", null]);
  });
  it("by metro from the airport: planned is done, no booking", () => {
    const v = legCardView(leg({ kind: "arrival", from: { label: "OPO havalimanı", city: "Porto", item: null }, to: { label: "Jardim Stay", city: "Porto", item: null }, choice: choice("metro"), status: "planned", after: "10:05" }));
    expect([v.kind, v.label, v.ring, v.middle]).toEqual(["transport", "Metro", "done", "Varış 10:05"]);
    expect(state(v)).toEqual(["done", "Planlandı", "rezervasyon gerekmez"]);
    expect([v.from.city, v.to.city]).toEqual(["OPO havalimanı", "Jardim Stay"]);
  });
  it("a taxi said in the chat: its name on the strip", () => {
    const taxi = plannedItem({ kind: "taxi", date: "2026-10-14", end_date: null, time: null, from: "Otel", to: "Havalimanı", city: "Lizbon", title: null, booked: false, note: null }, "t1", "x1", 1);
    const v = legCardView(leg({ kind: "departure", options: [taxi], mode: "taxi", status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["taxi", "Taksi · transfer", "done"]);
    expect(state(v)).toEqual(["done", "Planlandı", "Taksi · Otel → Havalimanı"]);
  });
  it("saved options, nothing chosen: pick one in the details", () => {
    expect(state(legCardView(leg({ kind: "arrival", status: "options", options: [plannedItem({ kind: "transfer", date: "2026-10-08", end_date: null, time: null, from: null, to: "Otel", city: "Porto", title: null, booked: false, note: null }, "t1", "x2", 1)].map((i) => ({ ...i, status: "saved" as const })) })))).toEqual(["wait", "1 seçenek", "birini seç"]);
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: Implement (cardView.ts'e ekle)**

İmport ekle: `import { cardKindLabel, legTransportMode, transportMode } from "./cardKinds";` (mevcut cardKinds importuna birleştir), `import { nOptions } from "./i18nText";` (mevcut importa), `import { legItem, legTiming, MODE_LABELS, type Leg } from "./legs";` (clockOf ile birleştir), `import { flightSearchUrl } from "./timeline";`.

```ts
export interface LegCardView {
  kind: TransportMode | "transport";
  /** The top line's name: the way of travel, or "Metro", "Yürüyüş", "Şehir değişimi", "Transfer". */
  label: string;
  ring: Ring;
  from: End;
  to: End;
  middle: string | null;
  foot: FootView;
  ariaLabel: string;
  /** A move by plane not booked yet: a flight search for the day. */
  searchUrl: string | null;
}

/** Ways between cities that need a ticket; everything else (taxi, transfer, metro, a city bus) is planned once said. */
const LEG_TICKETS = ["flight", "train", "bus", "ferry"];

/** A transfer (airport ↔ hotel, hotel change) or a change of city, as a transport card. */
export function legCardView(leg: Leg): LegCardView {
  const mode = leg.choice?.mode ?? leg.mode;
  const settled = legItem(leg);
  const kind = legTransportMode(mode) ?? (settled ? transportMode(settled) : null) ?? "transport";
  const move = leg.kind === "move";
  const label = kind !== "transport" ? cardKindLabel(kind) : mode ? MODE_LABELS[mode] : move ? L("Şehir değişimi", "City change") : L("Transfer", "Transfer");
  const ticketed = move && mode != null && LEG_TICKETS.includes(mode);
  const booked = leg.status === "booked" || Boolean(leg.choice?.booked);
  const planned = !booked && (mode != null || leg.status === "chosen" || leg.status === "planned");
  const from = move ? (leg.from.city ?? leg.from.label) : leg.from.label;
  const to = move ? (leg.to.city ?? leg.to.label) : leg.to.label;
  const date = move ? formatDateRange(leg.date, null) : null;
  let foot: FootView;
  if (booked) foot = { left: state("done", ticketed ? L("Alındı", "Booked") : L("Ayarlandı", "Arranged"), settled?.name ?? null), action: null };
  else if (planned && ticketed) foot = { left: state("wait", L("Planlanıyor", "Planning"), L("bilet alınmadı", "no ticket yet")), action: { label: L("Bileti aldım", "I got the ticket"), does: "book" } };
  else if (planned) foot = { left: state("done", L("Planlandı", "Planned"), settled?.name ?? L("rezervasyon gerekmez", "no booking needed")), action: null };
  else if (leg.status === "options") foot = { left: state("wait", nOptions(leg.options.length), L("birini seç", "pick one")), action: null };
  else foot = { left: state("plain", L("Planlanmadı", "Not planned"), move ? L("nasıl geçeceksiniz?", "how will you get there?") : L("nasıl gideceksin?", "how will you go?")), action: null };
  return {
    kind,
    label,
    ring: booked ? "done" : planned ? (ticketed ? "half" : "done") : "open",
    from: { city: from, sub: date, time: null },
    to: { city: to, sub: date, time: null },
    middle: legTiming(leg),
    foot,
    ariaLabel: `${from} → ${to}`,
    searchUrl: move && mode === "flight" && !booked ? flightSearchUrl("from", from, leg.date, to) : null,
  };
}
```

- [ ] **Step 4:** run → PASS · `npx vitest run` · `npm run typecheck`
- [ ] **Step 5:** commit `"Cards: a transfer or a change of city as a card"`

---

### Task 6: Belge deposu (DB sürüm 4) ve `docs.ts`

**Files:** Modify `src/lib/db.ts`, `src/lib/plan.ts`; Create `src/lib/docs.ts`; Test `tests/docs.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/docs.test.ts
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { addDoc, checkDoc, deleteDoc, deleteTripDocs, docPill, getDoc, inheritedDocs, listDocMeta, moveDocs, putDocs, sizeText, takeDocsOf } from "../src/lib/docs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const pdf = (name = "bilet.pdf", body = "%PDF-1.4") => new File([body], name, { type: "application/pdf" });

describe("the docs store", () => {
  it("upgrades a version 3 database without losing anything", async () => {
    const old = await openDB("trip-radar", 3, {
      upgrade(d) {
        d.createObjectStore("trips", { keyPath: "id" });
        d.createObjectStore("captures", { keyPath: "id" }).createIndex("status", "status");
        const items = d.createObjectStore("items", { keyPath: "id" });
        items.createIndex("tripId", "tripId");
        items.createIndex("key", "key");
        d.createObjectStore("messages", { keyPath: "id" }).createIndex("tripId", "tripId");
        d.createObjectStore("preferences", { keyPath: "id" });
        d.createObjectStore("analyses", { keyPath: "key" }).createIndex("tripId", "tripId");
        d.createObjectStore("geocache", { keyPath: "query" });
        d.createObjectStore("listings", { keyPath: "key" });
      },
    });
    await old.put("trips", { id: "t-old", title: "Porto" });
    old.close();
    const d = await db();
    expect(d.version).toBe(4);
    expect([...d.objectStoreNames]).toContain("docs");
    expect(await d.get("trips", "t-old")).toMatchObject({ title: "Porto" });
  });

  it("adds, lists (names only), opens and deletes", async () => {
    const item = makeItem({ tripId: "t1" });
    const a = await addDoc(item, pdf(), 10);
    const b = await addDoc(item, new File(["x"], "QR.HEIC", { type: "" }), 20);
    expect(b.type).toBe("image/heic");
    const meta = await listDocMeta("t1");
    expect(meta.map((m) => m.name)).toEqual(["bilet.pdf", "QR.HEIC"]);
    expect("blob" in meta[0]).toBe(false);
    expect(await (await getDoc(a.id))!.blob.text()).toBe("%PDF-1.4");
    await deleteDoc(a.id);
    expect((await listDocMeta("t1")).map((m) => m.id)).toEqual([b.id]);
  });

  it("refuses other types and files over 15 MB", () => {
    expect(checkDoc({ name: "notlar.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 })).toMatch(/yalnız PDF, PNG, JPG ya da HEIC/);
    expect(checkDoc({ name: "foto.jpg", type: "image/jpeg", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(checkDoc({ name: "foto.png", type: "image/png", size: 1000 })).toBeNull();
  });

  it("a card's files go with it, come back with it, and move to the card that took a plan's place", async () => {
    const card = makeItem({ tripId: "t2" });
    const other = makeItem({ tripId: "t2" });
    await addDoc(card, pdf("a.pdf"));
    await addDoc(other, pdf("b.pdf"));
    const taken = await takeDocsOf(card.id);
    expect(taken.map((d) => d.name)).toEqual(["a.pdf"]);
    expect((await listDocMeta("t2")).map((d) => d.name)).toEqual(["b.pdf"]);
    await putDocs(taken);
    expect((await listDocMeta("t2")).map((d) => d.name).sort()).toEqual(["a.pdf", "b.pdf"]);
    await moveDocs(card.id, other.id);
    expect((await listDocMeta("t2")).every((d) => d.itemId === other.id)).toBe(true);
    await deleteTripDocs("t2");
    expect(await listDocMeta("t2")).toEqual([]);
  });

  it("the pill and sizes", () => {
    const m = (name: string) => ({ id: name, itemId: "i", tripId: "t", name, type: "application/pdf", size: 1, addedAt: 1 });
    expect(docPill([])).toBeNull();
    expect(docPill([m("bilet.pdf")])).toEqual({ name: "bilet.pdf", more: 0 });
    expect(docPill([m("a.pdf"), m("b.pdf"), m("c.pdf")])).toEqual({ name: "a.pdf", more: 2 });
    expect([sizeText(500), sizeText(820 * 1024), sizeText(1.2 * 1024 * 1024)]).toEqual(["1 KB", "820 KB", "1,2 MB"]);
  });
});

describe("files of a plan a saved page replaced", () => {
  it("show on the page's card", () => {
    const trip: Trip = { id: "t1", title: "x", confirmedDates: { start: "2026-10-07", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const said = plannedItem({ kind: "flight", date: "2026-10-08", end_date: null, time: null, from: "IST", to: "OPO", city: null, title: null, booked: false, note: null }, "t1", "plan", 1);
    const real = makeItem({
      id: "real", category: "flight", name: "Pegasus", needKey: said.needKey, status: "chosen", dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: null, stops: 0 },
    });
    const plan = buildPlan(trip, [said, real]);
    expect(plan.closed.find((c) => c.item.id === "plan")?.by).toBe("real");
    expect([...inheritedDocs(plan.closed)]).toEqual([["real", ["plan"]]]);
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: `src/lib/db.ts`**

`import type { … }` satırına `DocRecord` ekle; şemaya:

```ts
  docs: { key: string; value: DocRecord; indexes: { itemId: string; tripId: string } };
```

`openDB` çağrısı:

```ts
  dbPromise ??= openDB<TripRadarDB>("trip-radar", 4, {
    upgrade(d, oldVersion) {
      // ...1–3 aynı...
      if (oldVersion < 4) {
        const docs = d.createObjectStore("docs", { keyPath: "id" });
        docs.createIndex("itemId", "itemId");
        docs.createIndex("tripId", "tripId");
      }
    },
    // A newer version (an update) wants the database: let it go, the next call opens it again.
    blocking() {
      void dbPromise?.then((open) => open.close());
      dbPromise = null;
    },
  });
```

`exportAll` JSON'una `docs: (await d.getAll("docs")).map(({ blob: _blob, ...meta }) => meta),` ekle (içerik yok, yalnız adlar ve boyutlar). Üstündeki yorum: `/** Full JSON backup of everything except screenshots and the contents of attached files (their names are listed). */`. `exportDiagnostics`'e belge eklenmez.

- [ ] **Step 4: `src/lib/plan.ts`**

`Plan.closed` tipi: `closed: { item: Item; reason: string; /** The record that took its place or whose booking closed it. */ by?: string }[];`. Dört `closed.push` çağrısına `by` ekle:
- `closed.push({ item: i, reason: replacedReason(replaced.name), by: replaced.id });` (konaklama, ~satır 501)
- `closed.push({ item: i, reason: L(... blocker ...), by: blocker.id });` (~508)
- slot (~588): `const by = stayBlocks.filter(...)` satırının altına `const byId = stayBlocks.find((b) => b.kind !== "open" && overlaps(b.range, stayRange(slot)!));` ve `closed.push({ item: slot, reason: replacedReason([...new Set(by)].join(", ")), by: byId && byId.kind !== "open" ? byId.item.id : undefined });`
- ulaşım (~719): `closed.push({ item: i, reason: replacedReason(real.name), by: real.id })`
- rezervasyon (~724): `closed.push({ item: i, reason: L(...), by: booked[0].id })`

- [ ] **Step 5: `src/lib/docs.ts`**

```ts
// Files attached to a card (ticket PDFs, QR screenshots): kept in this computer's IndexedDB only. They
// never go to the sharing server and exports carry only their names. A card's files go when the card goes.
import { db, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { num } from "./i18nText";
import type { DocMeta, DocRecord, Item } from "./types";

export const DOC_MAX_BYTES = 15 * 1024 * 1024;
export const DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.heic,.heif,application/pdf,image/png,image/jpeg,image/heic,image/heif";
const BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", heic: "image/heic", heif: "image/heif" };
const KEPT = new Set(Object.values(BY_EXTENSION));

/** The file's type: its MIME type, or (HEIC often comes without one) its extension; null when it isn't one we keep. */
export function docType(file: { name: string; type: string }): string | null {
  if (KEPT.has(file.type)) return file.type;
  return BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function checkDoc(file: { name: string; type: string; size: number }): string | null {
  if (!docType(file)) return L(`${file.name}: yalnız PDF, PNG, JPG ya da HEIC eklenebilir.`, `${file.name}: only PDF, PNG, JPG or HEIC files can be added.`);
  if (file.size > DOC_MAX_BYTES) return L(`${file.name} 15 MB'tan büyük.`, `${file.name} is larger than 15 MB.`);
  if (file.size === 0) return L(`${file.name} boş.`, `${file.name} is empty.`);
  return null;
}

export async function addDoc(item: Pick<Item, "id" | "tripId">, file: Blob & { name: string }, now = Date.now()): Promise<DocRecord> {
  const problem = checkDoc(file);
  if (problem) throw new Error(problem);
  const type = docType(file)!;
  const doc: DocRecord = { id: newId(), itemId: item.id, tripId: item.tripId, name: file.name, type, size: file.size, blob: new Blob([file], { type }), addedAt: now };
  await (await db()).put("docs", doc);
  notifyChanged();
  return doc;
}

const metaOf = ({ blob: _blob, ...meta }: DocRecord): DocMeta => meta;

/** A trip's files, oldest first, without their contents. */
export async function listDocMeta(tripId: string): Promise<DocMeta[]> {
  const rows = await (await db()).getAllFromIndex("docs", "tripId", tripId);
  return rows.sort((a, b) => a.addedAt - b.addedAt).map(metaOf);
}

export async function getDoc(id: string): Promise<DocRecord | undefined> {
  return (await db()).get("docs", id);
}

export async function deleteDoc(id: string): Promise<void> {
  await (await db()).delete("docs", id);
  notifyChanged();
}

/** Removes a card's files and hands them back (kept in memory for "Geri al"). */
export async function takeDocsOf(itemId: string): Promise<DocRecord[]> {
  const tx = (await db()).transaction("docs", "readwrite");
  const docs = await tx.store.index("itemId").getAll(itemId);
  for (const d of docs) await tx.store.delete(d.id);
  await tx.done;
  return docs;
}

export async function putDocs(docs: DocRecord[]): Promise<void> {
  if (!docs.length) return;
  const tx = (await db()).transaction("docs", "readwrite");
  for (const d of docs) await tx.store.put(d);
  await tx.done;
}

/** A plan merged into another one (the chat's "tek blok"): its files go with it. */
export async function moveDocs(fromItemId: string, toItemId: string): Promise<void> {
  const tx = (await db()).transaction("docs", "readwrite");
  for (const d of await tx.store.index("itemId").getAll(fromItemId)) await tx.store.put({ ...d, itemId: toItemId });
  await tx.done;
}

export async function deleteTripDocs(tripId: string): Promise<void> {
  const tx = (await db()).transaction("docs", "readwrite");
  for (const key of await tx.store.index("tripId").getAllKeys(tripId)) await tx.store.delete(key);
  await tx.done;
}

/** The white pill: the first file's name and how many more. */
export const docPill = (docs: DocMeta[]): { name: string; more: number } | null => (docs.length ? { name: docs[0].name, more: docs.length - 1 } : null);

export const sizeText = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${num(bytes / (1024 * 1024))} MB`;

/** A plan said in the chat that a saved page replaced hands its files to that page's card: owner id → the plans' ids. */
export function inheritedDocs(closed: { item: Item; by?: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of closed) if (c.by && c.item.origin === "chat") out.set(c.by, [...(out.get(c.by) ?? []), c.item.id]);
  return out;
}
```

- [ ] **Step 6:** run → PASS · `npx vitest run` (mevcut `closed` beklentileri `item.id`/`item.name`/`reason` eşler ya da boş dizi bekler; yeni `by` alanı onları etkilemez) · `npm run typecheck` · `npm run build`
- [ ] **Step 7:** commit `"Docs: a local store for files on cards (DB v4)"`

---

### Task 7: Silme + geri alma, belge yaşam döngüsü, eSIM "Kurdum"

**Files:** Create `src/lib/removal.ts`, `src/lib/undo.ts`; Modify `src/app/actions.ts`, `src/lib/assistant.ts`, `src/app/App.tsx`, `src/app/ItemDrawer.tsx`; Tests `tests/removal.test.ts`, `tests/undo.test.ts`, `tests/actions.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// tests/removal.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { addDoc, listDocMeta } from "../src/lib/docs";
import { deleteItem, restoreItem } from "../src/lib/removal";
import { makeItem } from "./fixtures/makeItem";

describe("delete and undo", () => {
  it("takes the card and its files, and puts both back exactly", async () => {
    const d = await db();
    const card = makeItem({ tripId: "t1", name: "Douro tekne turu", status: "chosen" });
    const other = makeItem({ tripId: "t1", name: "Tiyatro" });
    await d.put("items", card);
    await d.put("items", other);
    await addDoc(card, new File(["a"], "bilet.pdf", { type: "application/pdf" }));
    await addDoc(card, new File(["b"], "qr.png", { type: "image/png" }));
    await addDoc(other, new File(["c"], "x.pdf", { type: "application/pdf" }));

    const removed = await deleteItem(card);
    expect(await d.get("items", card.id)).toBeUndefined();
    expect(removed.docs.map((x) => x.name).sort()).toEqual(["bilet.pdf", "qr.png"]);
    expect((await listDocMeta("t1")).map((x) => x.name)).toEqual(["x.pdf"]);

    await restoreItem(removed);
    expect(await d.get("items", card.id)).toEqual(card);
    expect((await listDocMeta("t1")).map((x) => x.name).sort()).toEqual(["bilet.pdf", "qr.png", "x.pdf"]);
    expect((await listMessages("t1")).map((m) => m.text)).toEqual(["Douro tekne turu silindi", "Douro tekne turu geri getirildi"]);
  });
  it("says its own line when asked (a plan taken off the board)", async () => {
    const plan = makeItem({ tripId: "t2", name: "Taksi" });
    await (await db()).put("items", plan);
    await deleteItem(plan, "Taksi plandan kaldırıldı");
    expect((await listMessages("t2")).map((m) => m.text)).toEqual(["Taksi plandan kaldırıldı"]);
  });
});
```

```ts
// tests/undo.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNDO_MS, undoSlot } from "../src/lib/undo";

afterEach(() => vi.useRealTimers());

describe("the one 'Geri al' on screen", () => {
  it("lasts 8 seconds", () => {
    vi.useFakeTimers();
    const slot = undoSlot<string>();
    const seen: (string | null)[] = [];
    slot.subscribe((v) => seen.push(v));
    slot.show("a");
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(slot.current()).toBe("a");
    vi.advanceTimersByTime(1);
    expect(slot.current()).toBeNull();
    expect(seen).toEqual(["a", null]);
  });
  it("taking it clears it; a newer deletion takes its place and starts again", () => {
    vi.useFakeTimers();
    const slot = undoSlot<string>();
    slot.show("a");
    vi.advanceTimersByTime(5000);
    slot.show("b");
    vi.advanceTimersByTime(5000);
    expect(slot.current()).toBe("b");
    expect(slot.take()).toBe("b");
    expect(slot.take()).toBeNull();
  });
});
```

`tests/actions.test.ts`: üstteki `import { updateTrip } from "../src/app/actions";` satırını `import { setInstalled, updateTrip } from "../src/app/actions";` yap, `import { makeItem } from "./fixtures/makeItem";` ekle; dosyanın sonuna:

```ts
describe("an eSIM installed", () => {
  it("is marked and can be taken back", async () => {
    const d = await db();
    const esim = makeItem({ category: "esim", status: "booked", tripId: "t9" });
    await d.put("items", esim);
    await setInstalled(esim, true);
    expect((await d.get("items", esim.id))!.installedAt).toEqual(expect.any(Number));
    await setInstalled(esim, false);
    expect((await d.get("items", esim.id))!.installedAt).toBeUndefined();
  });
});
```

- [ ] **Step 2:** run the three → FAIL

- [ ] **Step 3: `src/lib/removal.ts`**

```ts
// "Sil" on a card: the record and its files go at once (one transaction); "Geri al" puts both back
// exactly as they were, from the copy kept in memory until then.
import { addEvent, db, notifyChanged } from "./db";
import { putDocs } from "./docs";
import { L } from "./i18n";
import type { DocRecord, Item } from "./types";

export interface Removed {
  item: Item;
  docs: DocRecord[];
}

export async function deleteItem(item: Item, event?: string): Promise<Removed> {
  const d = await db();
  const tx = d.transaction(["items", "docs"], "readwrite");
  const fresh = (await tx.objectStore("items").get(item.id)) ?? item;
  const docs = await tx.objectStore("docs").index("itemId").getAll(item.id);
  for (const doc of docs) await tx.objectStore("docs").delete(doc.id);
  await tx.objectStore("items").delete(item.id);
  await tx.done;
  await addEvent(item.tripId, event ?? L(`${fresh.name} silindi`, `${fresh.name} deleted`));
  notifyChanged();
  return { item: fresh, docs };
}

export async function restoreItem(removed: Removed): Promise<void> {
  await (await db()).put("items", removed.item);
  await putDocs(removed.docs);
  await addEvent(removed.item.tripId, L(`${removed.item.name} geri getirildi`, `${removed.item.name} restored`));
  notifyChanged();
}
```

- [ ] **Step 4: `src/lib/undo.ts`**

```ts
// The one "Geri al" on screen: the last thing deleted, for 8 seconds. A newer deletion takes its place
// (the one before stays deleted). Framework-free so the timing can be tested.
export const UNDO_MS = 8000;

export interface UndoSlot<T> {
  show(value: T): void;
  /** The value, once: clears the slot. */
  take(): T | null;
  current(): T | null;
  subscribe(listener: (value: T | null) => void): () => void;
}

export function undoSlot<T>(ms = UNDO_MS): UndoSlot<T> {
  let value: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(value: T | null) => void>();
  const set = (next: T | null) => {
    value = next;
    listeners.forEach((l) => l(next));
  };
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    show(next) {
      stop();
      set(next);
      timer = setTimeout(() => {
        timer = null;
        set(null);
      }, ms);
    },
    take() {
      stop();
      const taken = value;
      if (taken !== null) set(null);
      return taken;
    },
    current: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
```

- [ ] **Step 5: `src/app/actions.ts`**

`removeItem` gövdesi:

```ts
/** "Planı kaldır": a plan said in the chat has no page behind it, so it simply goes (its files too). */
export async function removeItem(item: Item): Promise<void> {
  await deleteItem(item, L(`${item.name} plandan kaldırıldı`, `${item.name} removed from the plan`));
}
```

(`import { deleteItem } from "../lib/removal";` ekle.) Yeni:

```ts
/** eSIM "Kurdum" (and "Kurulmadı" to take it back). */
export async function setInstalled(item: Item, installed: boolean): Promise<void> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  const { installedAt: _was, ...rest } = fresh;
  await d.put("items", installed ? { ...fresh, installedAt: Date.now(), updatedAt: Date.now() } : { ...rest, updatedAt: Date.now() });
  await addEvent(item.tripId, installed ? L(`${item.name} kuruldu`, `${item.name} installed`) : L(`${item.name} kurulmadı olarak geri alındı`, `${item.name} marked as not installed`));
  notifyChanged();
}
```

- [ ] **Step 6: Belgelerin silinen/birleşen kayıtları izlemesi**
  - `src/lib/assistant.ts` `import { moveDocs, takeDocsOf } from "./docs";`. `update_items` içinde `await d.delete("items", item.id);` (sohbet planı "dismissed") satırının **önüne** `await takeDocsOf(item.id);`. `plan_item` içinde `for (const i of merged) await d.delete("items", i.id);` satırını `for (const i of merged) { await moveDocs(i.id, saved.id); await d.delete("items", i.id); }` yap.
  - `src/app/App.tsx` `deleteTrip`: `await d.delete("trips", trip.id);` satırının önüne `await deleteTripDocs(trip.id);` (`import { deleteTripDocs } from "../lib/docs";`).
  - `src/app/ItemDrawer.tsx` `remove()`: `await (await db()).delete("items", item.id); notifyChanged();` yerine `await deleteItem(item);` (`import { deleteItem } from "../lib/removal";`; onay penceresi çekmecede kalır, çünkü çekmecede geri al bildirimi yok).

- [ ] **Step 7:** `npx vitest run` → PASS (assistant testleri dahil) · `npm run typecheck` · `npm run build`
- [ ] **Step 8:** commit `"Delete with undo: a card and its files; eSIM installed"`

---

### Task 8: Şablonlar ve `planToSave`

**Files:** Modify `src/lib/planned.ts`, `src/lib/assistant.ts`; Create `src/lib/templates.ts`; Test `tests/templates.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/templates.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { transportMode } from "../src/lib/cardKinds";
import { db, listMessages } from "../src/lib/db";
import { plannedItem } from "../src/lib/planned";
import {
  addFromTemplate, editedItem, emptyForm, formOf, insertAt, parseAmount, templateInput, templateItem, templateLabel, TEMPLATES,
  type FormValues, type TemplateId,
} from "../src/lib/templates";
import type { TimelineEntry } from "../src/lib/timeline";
import { isInsurance, isRental } from "../src/lib/travelKinds";
import { makeItem } from "./fixtures/makeItem";

const tpl = (id: TemplateId) => TEMPLATES.find((x) => x.id === id)!;
const form = (id: TemplateId, over: Partial<FormValues>) => ({ ...emptyForm(tpl(id), null, "EUR"), ...over });

describe("the add sheet's tiles", () => {
  it("ten ways to travel, two places to stay, five others", () => {
    expect(TEMPLATES.filter((x) => x.group === "move").map((x) => templateLabel(x.id))).toEqual([
      "Uçuş", "Tren", "Otobüs", "Minibüs", "Vapur", "Taksi · transfer", "Araç kiralama", "Motosiklet", "Karavan", "Bisiklet",
    ]);
    expect(TEMPLATES.filter((x) => x.group === "stay").map((x) => templateLabel(x.id))).toEqual(["Otel", "Ev · daire"]);
    expect(TEMPLATES.filter((x) => x.group === "other").map((x) => templateLabel(x.id))).toEqual(["Etkinlik · tur", "Restoran", "eSIM", "Sigorta", "Not"]);
  });
  it("the form starts with the city and day of where it was opened", () => {
    const at = { city: "Porto", date: "2026-10-09" };
    expect(emptyForm(tpl("train"), at, "EUR")).toMatchObject({ from: "Porto", city: "Porto", date: "2026-10-09", to: "" });
    expect(emptyForm(tpl("car"), at, "EUR")).toMatchObject({ from: "", city: "Porto", date: "2026-10-09" });
  });
});

describe("what a template makes", () => {
  it("a bus: a plan between two places, planned, with its price", () => {
    const item = templateItem(tpl("bus"), form("bus", { from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18" }), [], "t1", "b1", 5);
    expect(item).toMatchObject({
      id: "b1", name: "Otobüs · Lizbon → Lagos", category: "transport", plannedKind: "bus", status: "chosen", origin: "chat", city: "Lagos",
      flight: { from: "Lizbon", to: "Lagos", departure: "2026-10-13T10:00" },
      price: { amount: 18, currency: "EUR", scope: "total", source: "user" },
    });
  });
  it("a motorbike rental: in its city for its days", () => {
    const item = templateItem(tpl("moto"), form("moto", { city: "Funchal", date: "2026-10-12", end: "2026-10-15" }), [], "t1", "m1", 5);
    expect(typeof item).toBe("object");
    if (typeof item === "string") return;
    expect(item.name).toBe("Motosiklet kiralama · Funchal");
    expect(isRental(item)).toBe(true);
    expect(transportMode(item)).toBe("moto");
  });
  it("named things need a name; insurance and an eSIM can go without", () => {
    expect(templateItem(tpl("activity"), form("activity", { date: "2026-10-09" }), [], "t1", "a", 5)).toBe("Adını yaz.");
    const ins = templateItem(tpl("insurance"), form("insurance", { date: "2026-10-07" }), [], "t1", "s", 5);
    expect(ins).toMatchObject({ name: "Seyahat sigortası", category: "other" });
    expect(isInsurance(ins as never)).toBe(true);
  });
  it("a hotel: its name, city and nights", () => {
    expect(templateItem(tpl("hotel"), form("hotel", { name: "Hotel Ribeira", city: "Porto", date: "2026-10-09", end: "2026-10-11" }), [], "t1", "h", 5)).toMatchObject({
      category: "stay", name: "Hotel Ribeira", dates: { start: "2026-10-09", end: "2026-10-11" },
    });
  });
  it("prices as people type them; anything else is refused", () => {
    expect([parseAmount("68"), parseAmount("1.240"), parseAmount("68,50"), parseAmount("€ 1.240,50"), parseAmount("abc")]).toEqual([68, 1240, 68.5, 1240.5, null]);
    expect(templateInput(tpl("bus"), form("bus", { to: "Lagos", date: "2026-10-13", price: "abc" }))).toMatch(/Fiyat bir sayı olmalı/);
  });
  it("the same plan said before is updated, not doubled", () => {
    const before = plannedItem({ kind: "flight", date: "2026-10-11", end_date: null, time: null, from: null, to: "Madeira", city: null, title: null, booked: false, note: null }, "t1", "old", 1);
    const item = templateItem(tpl("flight"), form("flight", { to: "Madeira", date: "2026-10-11", time: "09:30" }), [before], "t1", "new", 5);
    expect(item).toMatchObject({ id: "old", flight: { departure: "2026-10-11T09:30" } });
  });
});

describe("Düzenle", () => {
  it("a plan's form comes back as it was saved, and an edit keeps the record", () => {
    const bus = templateItem(tpl("bus"), form("bus", { from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18" }), [], "t1", "b1", 5);
    if (typeof bus === "string") throw new Error(bus);
    const back = formOf(bus, "EUR");
    expect(back.template.id).toBe("bus");
    expect(back.values).toMatchObject({ from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18", name: "" });
    const edited = editedItem({ ...bus, status: "booked" }, back.template, { ...back.values, date: "2026-10-14" }, 9);
    expect(edited).toMatchObject({ id: "b1", status: "booked", createdAt: 5, dates: { start: "2026-10-14" } });
  });
  it("a chat transfer or 'other' plan opens as a taxi or a note", () => {
    expect(formOf(makeItem({ origin: "chat", plannedKind: "transfer" }), "EUR").template.id).toBe("taxi");
    expect(formOf(makeItem({ origin: "chat", plannedKind: "other", category: "other" }), "EUR").template.id).toBe("note");
  });
});

describe("the + between two cards", () => {
  it("brings the city and the day of the card above it", () => {
    const stay = { kind: "stay", key: "s", date: "2026-10-08", block: { kind: "open", range: { start: "2026-10-08", end: "2026-10-11" }, nights: 3, city: "Porto", groups: [], searchUrl: "" }, title: "", subtitle: "" } as TimelineEntry;
    const event = { kind: "event", key: "e", date: "2026-10-09", dayNo: 2, item: makeItem({ city: "Porto" }) } as TimelineEntry;
    const leg = { kind: "leg", key: "l", date: "2026-10-11", leg: { to: { city: "Lizbon" }, from: { city: "Porto" } } } as unknown as TimelineEntry;
    expect([insertAt(stay), insertAt(event), insertAt(leg)]).toEqual([
      { city: "Porto", date: "2026-10-08" }, { city: "Porto", date: "2026-10-09" }, { city: "Lizbon", date: "2026-10-11" },
    ]);
  });
});

describe("saving", () => {
  it("writes the plan and a line in the trip's history", async () => {
    const made = await addFromTemplate("t5", tpl("ferry"), form("ferry", { from: "Funchal", to: "Porto Santo", date: "2026-10-16" }), "f1", 7);
    expect(made).toMatchObject({ id: "f1", name: "Feribot · Funchal → Porto Santo" });
    expect(await (await db()).get("items", "f1")).toBeTruthy();
    expect((await listMessages("t5")).map((m) => m.text)).toEqual(["Feribot · Funchal → Porto Santo plana eklendi"]);
  });
});
```

- [ ] **Step 2:** run → FAIL

- [ ] **Step 3: `planToSave` (`src/lib/planned.ts` sonuna)**

```ts
/**
 * What a plan becomes when saved: said again (samePlan), it updates the plan it repeats, keeping its id
 * and what was said before; else a new item. Planned until it's said to be booked.
 */
export function planToSave(said: PlannedInput, items: Item[], tripId: string, id: string, now: number): { item: Item; same: Item | null } {
  const probe = plannedItem(said, tripId, "", 0);
  const same = items.find((i) => samePlan(i, probe)) ?? null;
  const plan = same ? fillPlanned(said, same) : said;
  const fresh = plannedItem(plan, tripId, id, now);
  const status = plan.booked || same?.status === "booked" ? ("booked" as const) : ("chosen" as const);
  return { item: same ? { ...same, ...fresh, id: same.id, createdAt: same.createdAt, status } : { ...fresh, status }, same };
}
```

`src/lib/assistant.ts` `plan_item` başı:

```ts
    case "plan_item": {
      const said = plannedInput(input);
      const problem = checkPlanned(said);
      if (problem) throw new ToolError(problem);
      const { item: saved, same } = planToSave(said, items, tripId, newId(), Date.now());
      await d.put("items", saved);
      // ...result satırından itibaren aynı
```

(İmport satırına `planToSave` ekle; artık kullanılmayan `fillPlanned`/`plannedItem`/`samePlan` importlarını kaldır, `grep -n "fillPlanned\|plannedItem\|samePlan" src/lib/assistant.ts` ile kontrol et.)

- [ ] **Step 4: `src/lib/templates.ts`**

```ts
// "+ Ekle": what can be added by hand, the short form each one asks, and the plan item it makes. The item
// is the one a plan said in the chat makes (plannedItem, origin "chat"), so a page saved for it later
// takes its place and the chat can change it. Pure, except addFromTemplate and saveEdit, which write it.
import { cardKindLabel, type CardKind, type TransportMode } from "./cardKinds";
import { addEvent, db, listItems, notifyChanged } from "./db";
import { L } from "./i18n";
import { liveLabels } from "./i18nText";
import { isoDate } from "./items";
import { ALL_PLANNED_KINDS, checkPlanned, isGeneratedName, plannedItem, planToSave, type PlannedInput } from "./planned";
import type { TimelineEntry } from "./timeline";
import type { Item, PlannedKind } from "./types";

export type TemplateId = TransportMode | "hotel" | "home" | "activity" | "food" | "esim" | "insurance" | "note";
/** trip: from, to, day, time · rental: place, start, end · stay: name, city, check-in, check-out · named: name, day. All with a price. */
export type TemplateFormKind = "trip" | "rental" | "stay" | "named";
export interface Template {
  id: TemplateId;
  kind: PlannedKind;
  group: "move" | "stay" | "other";
  form: TemplateFormKind;
}

const tp = (id: TemplateId, kind: PlannedKind, group: Template["group"], form: TemplateFormKind): Template => ({ id, kind, group, form });
export const TEMPLATES: readonly Template[] = [
  tp("flight", "flight", "move", "trip"), tp("train", "train", "move", "trip"), tp("bus", "bus", "move", "trip"),
  tp("minibus", "minibus", "move", "trip"), tp("ferry", "ferry", "move", "trip"), tp("taxi", "taxi", "move", "trip"),
  tp("car", "car_rental", "move", "rental"), tp("moto", "moto_rental", "move", "rental"), tp("rv", "rv_rental", "move", "rental"),
  tp("bike", "bike_rental", "move", "rental"),
  tp("hotel", "stay", "stay", "stay"), tp("home", "stay", "stay", "stay"),
  tp("activity", "activity", "other", "named"), tp("food", "food", "other", "named"), tp("esim", "esim", "other", "named"),
  tp("insurance", "insurance", "other", "named"), tp("note", "note", "other", "named"),
];

const OTHER_LABELS = liveLabels({
  hotel: ["Otel", "Hotel"], home: ["Ev · daire", "Home · flat"], activity: ["Etkinlik · tur", "Activity · tour"],
  food: ["Restoran", "Restaurant"], esim: ["eSIM", "eSIM"], insurance: ["Sigorta", "Insurance"], note: ["Not", "Note"],
});
export const templateLabel = (id: TemplateId): string =>
  id in OTHER_LABELS ? OTHER_LABELS[id as keyof typeof OTHER_LABELS] : cardKindLabel(id as TransportMode);
/** How a tile is drawn (its colour and icon); "home" has its own icon in the sheet. */
export const templateCardKind = (id: TemplateId): CardKind => (id === "hotel" || id === "home" ? "stay" : id);

export interface FormValues {
  from: string;
  to: string;
  city: string;
  name: string;
  date: string;
  end: string;
  time: string;
  price: string;
  currency: string;
}
/** Where the sheet was opened: the city and day of the card above the "+" (null from the header's "Ekle"). */
export interface InsertAt {
  city: string | null;
  date: string | null;
}

export function emptyForm(tpl: Template, at: InsertAt | null, currency: string): FormValues {
  const city = at?.city ?? "";
  return { from: tpl.form === "trip" ? city : "", to: "", city, name: "", date: at?.date ?? "", end: "", time: "", price: "", currency };
}

/** "68", "1.240", "68,50", "€ 1.240,50": a separator followed by exactly three digits groups thousands, else it's the decimals. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const decimals = last >= 0 && s.length - last - 1 !== 3 ? s.slice(last + 1) : "";
  const whole = (decimals ? s.slice(0, last) : s).replace(/[.,]/g, "");
  const n = Number(`${whole}${decimals ? `.${decimals}` : ""}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface TemplateResult {
  input: PlannedInput;
  price: { amount: number; currency: string } | null;
}

/** The form as a plan (checked like a plan said in the chat), or what's wrong with it. */
export function templateInput(tpl: Template, f: FormValues): TemplateResult | string {
  const v = (s: string) => s.trim() || null;
  const amount = f.price.trim() ? parseAmount(f.price) : null;
  if (f.price.trim() && amount == null) return L("Fiyat bir sayı olmalı (örneğin 68 ya da 1.240).", "The price must be a number (e.g. 68 or 1,240).");
  const base: PlannedInput = { kind: tpl.kind, date: v(f.date), end_date: null, time: null, from: null, to: null, city: v(f.city), title: null, booked: false, note: null };
  const input: PlannedInput =
    tpl.form === "trip"
      ? { ...base, from: v(f.from), to: v(f.to), time: v(f.time) }
      : tpl.form === "rental"
        ? { ...base, end_date: v(f.end) }
        : tpl.form === "stay"
          ? { ...base, end_date: v(f.end), title: v(f.name) }
          : { ...base, title: v(f.name) };
  if (tpl.form === "named" && !input.title && tpl.kind !== "esim" && tpl.kind !== "insurance") return L("Adını yaz.", "Give it a name.");
  const problem = checkPlanned(input, ALL_PLANNED_KINDS);
  if (problem) return problem;
  return { input, price: amount != null ? { amount, currency: f.currency } : null };
}

export function withPrice(item: Item, price: { amount: number; currency: string }, now: number): Item {
  return {
    ...item,
    price: { amount: price.amount, currency: price.currency, scope: "total", taxesIncluded: "unknown", source: "user", observedAt: now },
    priceHistory: [...item.priceHistory, { amount: price.amount, currency: price.currency, observedAt: now }],
  };
}

/** The new plan item (or the plan it repeats, updated), or what's wrong with the form. */
export function templateItem(tpl: Template, f: FormValues, items: Item[], tripId: string, id: string, now: number): Item | string {
  const r = templateInput(tpl, f);
  if (typeof r === "string") return r;
  const { item } = planToSave(r.input, items, tripId, id, now);
  return r.price ? withPrice(item, r.price, now) : item;
}

/** "Düzenle": the same record (id, status, files) with what the form says now. */
export function editedItem(before: Item, tpl: Template, f: FormValues, now: number): Item | string {
  const r = templateInput(tpl, f);
  if (typeof r === "string") return r;
  const fresh = plannedItem(r.input, before.tripId, before.id, now);
  const next: Item = { ...before, ...fresh, id: before.id, createdAt: before.createdAt, status: before.status, statusAt: before.statusAt, captureIds: before.captureIds };
  return r.price ? withPrice(next, r.price, now) : next;
}

const FOR_KIND = new Map<PlannedKind, Template>(TEMPLATES.filter((x) => x.id !== "home").map((x) => [x.kind, x]));
FOR_KIND.set("transfer", TEMPLATES.find((x) => x.id === "taxi")!);
FOR_KIND.set("other", TEMPLATES.find((x) => x.id === "note")!);

/** The form a plan was saved from (a chat plan of a kind with no tile opens as the nearest one). */
export function formOf(item: Item, currency: string): { template: Template; values: FormValues } {
  const template = (item.plannedKind && FOR_KIND.get(item.plannedKind)) || FOR_KIND.get("other")!;
  const time = item.flight?.departure?.slice(11, 16) ?? "";
  return {
    template,
    values: {
      from: item.flight?.from ?? "",
      to: item.flight?.to ?? "",
      city: item.city ?? "",
      name: isGeneratedName(item.name) ? "" : item.name,
      date: isoDate(item.dates.start) ?? "",
      end: isoDate(item.dates.end) ?? "",
      time: /^\d{2}:\d{2}$/.test(time) ? time : "",
      price: item.price.amount != null ? String(item.price.amount) : "",
      currency: item.price.currency ?? currency,
    },
  };
}

/** The "+" under a card of the plan: its city and day. */
export function insertAt(entry: TimelineEntry): InsertAt {
  switch (entry.kind) {
    case "stay":
      return { city: entry.block.city, date: entry.block.range.start };
    case "travel": {
      const f = (entry.travel?.settled ?? entry.travel?.items[0])?.flight;
      return { city: f?.to ?? entry.leg?.to.city ?? null, date: entry.date };
    }
    case "leg":
      return { city: entry.leg.to.city ?? entry.leg.from.city, date: entry.date };
    case "event":
      return { city: entry.item.city, date: entry.date };
    case "day":
      return { city: null, date: entry.date };
    case "plan":
      return { city: entry.city, date: entry.date };
    case "rental":
      return { city: entry.group.items[0]?.city ?? null, date: entry.date };
  }
}

export async function addFromTemplate(tripId: string, tpl: Template, f: FormValues, id: string, now = Date.now()): Promise<Item | string> {
  const made = templateItem(tpl, f, await listItems(tripId), tripId, id, now);
  if (typeof made === "string") return made;
  await (await db()).put("items", made);
  await addEvent(tripId, L(`${made.name} plana eklendi`, `${made.name} added to the plan`));
  notifyChanged();
  return made;
}

export async function saveEdit(before: Item, tpl: Template, f: FormValues, now = Date.now()): Promise<Item | string> {
  const next = editedItem(before, tpl, f, now);
  if (typeof next === "string") return next;
  await (await db()).put("items", next);
  await addEvent(before.tripId, L(`${next.name} güncellendi`, `${next.name} updated`));
  notifyChanged();
  return next;
}
```

Not: "Feribot · Funchal → Porto Santo" testi `WORD.ferry` = "Feribot"tan gelir (plan adı; kartın tür etiketi "Vapur"dur).

- [ ] **Step 5:** run → PASS · `npx vitest run` (assistant'ın plan_item testleri `planToSave` ile aynı sonucu verir) · `npm run typecheck`
- [ ] **Step 6:** commit `"Templates: what '+ Ekle' makes, edits and where the + adds"`

---

### Task 9: Ayrıntıya "İşletme" satırı

**Files:** Modify `src/lib/cardFacts.ts`; Test `tests/cardFacts.test.ts` (ekle)

- [ ] **Step 1: Failing test** — üstteki `import { cardFacts, hostOf } from "../src/lib/cardFacts";` satırını `import { cardDetails, cardFacts, hostOf } from "../src/lib/cardFacts";` yap, `import { makeItem } from "./fixtures/makeItem";` ekle; dosyanın sonuna:

```ts
describe("a trip's operator in the details", () => {
  it("carrier and flight number, else the provider", () => {
    const f = makeItem({ category: "flight", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 } });
    expect(cardDetails(f, undefined, undefined).facts.find((x) => x.label === "İşletme")?.value).toBe("Pegasus · PC 1201");
    const bus = makeItem({ provider: "FlixBus", flight: { from: "Lizbon", to: "Lagos", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
    expect(cardDetails(bus, undefined, undefined).facts.find((x) => x.label === "İşletme")?.value).toBe("FlixBus");
  });
});
```

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** `F` tablosuna `operator: ["İşletme", "Operator"],`; `factsOf` içinde `case "flight": case "transport":` bloğunda `add(F.stops, …)` satırının altına `add(F.operator, join([f?.carrier ?? item.provider, f?.flightNumber]));`. (`tests/audit.test.ts:231`'deki uçuşun `carrier` ve `provider`'ı `null`, satır eklenmez; beklenti değişmez.)
- [ ] **Step 4:** `npx vitest run` → PASS · commit `"Card details: the operator"`

---

### Task 10: SwipeCard'ın ortak parçaları `cards/parts.tsx`'e

**Files:** Create `src/app/cards/parts.tsx`; Modify `src/app/SwipeCard.tsx`

Davranış değişmez; yalnız taşıma.

- [ ] **Step 1:** `src/app/SwipeCard.tsx`'ten şu tanımları **değiştirmeden** `src/app/cards/parts.tsx`'e taşı ve `export` et: `SourceBadge`, `Needs`, `ProsCons`, `Details`, `Links`, `Price`, `datedLink`, `ratingWords`, `ratingOf`. İhtiyaç duydukları importları da taşı (göreli yollar `../../lib/...`, `../FallbackImg`, `./...` → `../...`). Dosyanın başına yorum: `// Pieces every card uses (the decision cards, the stays, the plan cards): where it's from, what was asked for, pros and cons, the opened details, links and the price.`
- [ ] **Step 2:** Yeni bileşen (SwipeCard'daki `opt-trade` JSX'inin birebir aynısı, sınıf adı parametre):

```tsx
/** "2.'ye göre +€30 · bagaj dahil, direkt · eksiği: iade yok": why it stands where it does, against the one it's weighed with. */
export function TradeLine({ ranked, currency, className }: { ranked: Ranked; currency: string; className: string }) {
  const trade = ranked.trade;
  if (!trade || !ranked.vsRank || !(trade.money || trade.gains.length || trade.losses.length)) return null;
  return (
    <p className={className} title={L(`${trade.vs} ile karşılaştırınca: ${tradeText(trade, currency)}`, `Compared with ${trade.vs}: ${tradeText(trade, currency)}`)}>
      <span className="opt-vs">{L(`${ranked.vsRank}.'ye göre`, `vs #${ranked.vsRank}`)}</span>
      {[
        trade.money && (
          <b key="m" className={trade.diff != null && trade.diff < 0 ? "cheaper" : ""}>
            {moneyText(trade, currency)}
          </b>
        ),
        trade.gains.length > 0 && <span key="g">{trade.gains.join(", ")}</span>,
        trade.losses.length > 0 && (
          <span key="l" className="opt-loss">
            {L("eksiği", "lacks")}: {trade.losses.join(", ")}
          </span>
        ),
      ]
        .filter(Boolean)
        .flatMap((node, i) => (i ? [<span key={`s${i}`} className="sep">{" · "}</span>, node] : [node]))}
    </p>
  );
}
```

(İmport: `import { moneyText, tradeText, type Ranked } from "../../lib/choice";`.)
- [ ] **Step 3:** SwipeCard'da `{trade && ranked?.vsRank && (…opt-trade…)}` bloğunu `{ranked && <TradeLine ranked={ranked} currency={currency} className="opt-trade" />}` ile değiştir; taşınanları `./cards/parts`'tan import et; kullanılmayan importları sil (`trade` sabiti kullanılmıyorsa onu da).
- [ ] **Step 4:** `npm run typecheck && npx vitest run && npm run build` → yeşil
- [ ] **Step 5:** commit `"Cards: shared pieces out of SwipeCard"`

---

### Task 11: Siluetler ve ikonlar

**Files:** Create `src/app/cards/Silhouettes.tsx`

Değerler `ulasim-v3.html` (`<symbol id="i-…">`, `SCENES`) ve `etkinlik-v4.html` (`s-museum`, `s-esim`, `s-shield`, `u-*`) dosyalarından birebir.

- [ ] **Step 1: Dosyayı yaz**

```tsx
// The plan cards' pictures, copied from the approved mockups: a line icon per kind (24×24, ulasim-v3
// symbols), a dotted side view per way of travel (400×128, ulasim-v3 SCENES) and a dotted picture for a
// media card without a photo (120×100, etkinlik-v4). The dots are two patterns defined once on the page
// (SilhouetteDefs) in ink, as the approved mockups render them; outlines take the kind's colour.
import type { ReactNode } from "react";
import type { CardKind, TransportMode } from "../../lib/cardKinds";

export function SilhouetteDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", color: "#1d1d1f" }} aria-hidden>
      <defs>
        <pattern id="pk-ht" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.05" fill="currentColor" />
        </pattern>
        <pattern id="pk-ht-s" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".6" fill="currentColor" />
        </pattern>
      </defs>
    </svg>
  );
}

const g = (children: ReactNode, width = 2) => (
  <g fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </g>
);

const KIND_ICONS: Record<CardKind | "home", ReactNode> = {
  flight: <path fill="currentColor" transform="rotate(90 12 12)" d="M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z" />,
  train: g(<><rect x="5" y="3" width="14" height="14" rx="3.5" /><path d="M5 10h14M9 21l1.5-4M15 21l-1.5-4" /><circle cx="9" cy="13.5" r=".9" fill="currentColor" /><circle cx="15" cy="13.5" r=".9" fill="currentColor" /></>),
  bus: g(<><rect x="4" y="3.5" width="16" height="14" rx="3" /><path d="M4 11h16M4 7h16M7 17.5V20M17 17.5V20" /><circle cx="8" cy="14.3" r=".9" fill="currentColor" /><circle cx="16" cy="14.3" r=".9" fill="currentColor" /></>),
  minibus: g(<><path d="M3 16V8.5A2.5 2.5 0 0 1 5.5 6H15l5 5v5H3z" /><path d="M3 12h17M9 6v6M15 6v6" /><circle cx="7" cy="17" r="1.8" fill="currentColor" /><circle cx="16.5" cy="17" r="1.8" fill="currentColor" /></>),
  ferry: g(<><path d="M4 14h16l-2 4H6z" /><path d="M7 14V9h10v5M10 9V6h4v3" /><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" /></>),
  taxi: g(<><path d="M4 16v-3.5l2-5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5l2 5V16" /><rect x="3" y="12.5" width="18" height="5" rx="1.5" /><path d="M10 3.5h4V6h-4z" fill="currentColor" /><path d="M5 17.5V19M19 17.5V19" /></>),
  car: g(<><path d="M4 16v-3.5l2-5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5l2 5V16" /><rect x="3" y="12.5" width="18" height="5" rx="1.5" /><path d="M5 17.5V19M19 17.5V19" /></>),
  moto: g(<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="M5.5 16 9 10h5l4.5 6M14 10l-1.5-3H10M9 10l3 6h6.5" /></>),
  rv: g(<><path d="M2.5 16V7a2 2 0 0 1 2-2H15a2 2 0 0 1 2 2v2h2l2.5 3.5V16z" /><path d="M6 9h3v3H6zM12 9h2" /><circle cx="7" cy="17" r="1.8" fill="currentColor" /><circle cx="17" cy="17" r="1.8" fill="currentColor" /></>),
  bike: g(<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="M5.5 16 9.5 9h6l3 7M9.5 9 12 16h-6.5M15 6h2.5M8.5 6.5h3" /></>),
  transport: g(<path d="M5 12h14m-6-6 6 6-6 6" />),
  activity: g(<><path d="M3 9.5v-2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" /><path d="M14.5 7.5v2M14.5 11.5v1M14.5 14.5v2" /></>),
  food: g(<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v5M17 21V3c-2 1-3 4-3 7s1 3 3 3" />),
  esim: g(<><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><rect x="9" y="11" width="6" height="6" rx="1" /></>),
  insurance: g(<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />),
  note: g(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  other: g(<><path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.6" /></>),
  stay: g(<><path d="M3 18v-6.5A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5V18M3 15h18M3 18v2M21 18v2" /><path d="M5 9V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V9" /></>),
  home: g(<><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></>),
};

export function KindIcon({ kind, size = 17, className }: { kind: CardKind | "home"; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {KIND_ICONS[kind]}
    </svg>
  );
}

const UI_ICONS = {
  doc: g(<><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></>),
  clip: g(<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />, 2.2),
  check: g(<path d="m5 12.5 4.5 4.5L19 7.5" />, 3),
  left: g(<path d="m15 5-7 7 7 7" />, 2.4),
  right: g(<path d="m9 5 7 7-7 7" />, 2.4),
  dots: (
    <g fill="currentColor">
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </g>
  ),
  plus: g(<path d="M12 5v14M5 12h14" />, 2.3),
} as const;

export function UiIcon({ name, size = 16 }: { name: keyof typeof UI_ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {UI_ICONS[name]}
    </svg>
  );
}

// --- the dotted side views (ulasim-v3 SCENES, 400×128) ---------------------------------------------------
const V = (d: string, k: string) => <path key={k} d={d} fill="url(#pk-ht)" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />;
const W = (pts: [number, number][], r = 12) =>
  pts.map(([x, y]) => (
    <g key={`w${x}`}>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="currentColor" strokeWidth={3} />
      <circle cx={x} cy={y} r={r * 0.4} fill="currentColor" />
    </g>
  ));
const ground = (y = 116) => <path key="ground" d={`M20 ${y}H380`} stroke="currentColor" strokeWidth={1.4} strokeDasharray="2 5" strokeLinecap="round" opacity={0.7} />;
const win = (rects: [number, number, number, number][]) =>
  rects.map(([x, y, w, h]) => <rect key={`r${x}-${y}`} x={x} y={y} width={w} height={h} rx={3} fill="#fff" fillOpacity={0.85} stroke="currentColor" strokeWidth={1.2} />);

const SCENES: Record<TransportMode, () => ReactNode> = {
  flight: () => [
    V("M200 34 232 34 214 10 204 10z", "a"),
    V("M104 56C104 48 116 44 132 44H284C304 44 322 50 330 58 322 66 304 72 284 72H132C116 72 104 66 104 56z", "b"),
    V("M112 48 96 16H112L142 44z", "c"),
    V("M108 56 84 50 94 66z", "d"),
    V("M186 62H238L200 104H182z", "e"),
    win([[150, 52, 8, 7], [166, 52, 8, 7], [182, 52, 8, 7], [246, 52, 8, 7], [262, 52, 8, 7], [282, 52, 8, 7]]),
  ],
  train: () => [
    V("M50 100V52Q50 40 62 40H290Q336 40 356 76L364 100z", "a"),
    win([[70, 52, 30, 18], [112, 52, 30, 18], [154, 52, 30, 18], [196, 52, 30, 18], [238, 52, 30, 18]]),
    <path key="nose" d="M300 52H322Q336 56 344 68" stroke="currentColor" strokeWidth={1.4} fill="none" />,
    W([[90, 104], [118, 104], [260, 104], [288, 104]], 7),
    <path key="rails" d="M20 116H380M20 112H380" stroke="currentColor" strokeWidth={1.2} />,
  ],
  bus: () => [
    V("M70 102V44Q70 34 80 34H314Q326 34 328 46L334 78V102z", "a"),
    win([[84, 46, 34, 26], [126, 46, 34, 26], [168, 46, 34, 26], [210, 46, 34, 26], [252, 46, 34, 26], [294, 46, 26, 26]]),
    W([[118, 104], [292, 104]], 14),
    ground(),
  ],
  minibus: () => [
    V("M104 102V60Q106 44 122 44H246Q260 44 270 56L294 80Q306 82 306 94V102z", "a"),
    win([[118, 54, 30, 20], [156, 54, 30, 20], [194, 54, 30, 20], [232, 54, 26, 20]]),
    <path key="front" d="M266 56 286 78H262V56z" fill="#fff" fillOpacity={0.85} stroke="currentColor" strokeWidth={1.2} />,
    W([[142, 104], [268, 104]], 13),
    ground(),
  ],
  ferry: () => [
    V("M80 86H336L316 110H104z", "a"),
    V("M120 86V66H296V86z", "b"),
    V("M150 66V50H268V66z", "c"),
    V("M232 50V30H252V50z", "d"),
    win([[132, 72, 14, 8], [156, 72, 14, 8], [180, 72, 14, 8], [204, 72, 14, 8], [228, 72, 14, 8], [252, 72, 14, 8], [164, 55, 12, 7], [186, 55, 12, 7], [208, 55, 12, 7]]),
    <path key="sea" d="M40 118c20-6 30 6 50 0s30-6 50 0 30 6 50 0 30-6 50 0 30 6 50 0 30-6 50 0" stroke="currentColor" strokeWidth={1.6} fill="none" />,
  ],
  taxi: () => [
    V("M96 100V84Q96 76 106 74L138 70 160 50Q164 46 172 46H238Q246 46 252 52L276 70 304 74Q316 76 316 88V100z", "a"),
    V("M188 34H222V46H188z", "b"),
    win([[170, 54, 32, 16], [210, 54, 32, 16]]),
    W([[140, 102], [274, 102]], 14),
    ground(),
  ],
  car: () => [
    V("M90 100V80Q90 72 100 70L134 64 156 44Q160 40 168 40H252Q260 40 264 46L280 64 306 68Q320 70 320 84V100z", "a"),
    win([[166, 48, 38, 18], [212, 48, 38, 18]]),
    W([[136, 102], [278, 102]], 15),
    ground(),
  ],
  moto: () => [
    W([[136, 96], [272, 96]], 24),
    V("M146 84 186 62H234L258 74 272 96H236L212 82z", "a"),
    V("M178 56H226V64H178z", "b"),
    <path key="bars" d="M246 62 258 42M252 42H268M150 84 136 96" stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none" />,
    ground(124),
  ],
  rv: () => [
    V("M64 102V40Q64 30 74 30H270Q282 30 284 42V56H300Q314 58 322 72L334 92V102z", "a"),
    win([[82, 44, 36, 22], [128, 44, 22, 46], [160, 44, 36, 22], [206, 44, 36, 22], [290, 62, 24, 18]]),
    W([[110, 104], [286, 104]], 14),
    ground(),
  ],
  bike: () => [
    <circle key="w1" cx="134" cy="88" r="28" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={3} />,
    <circle key="w2" cx="270" cy="88" r="28" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={3} />,
    <path key="frame" d="M134 88 178 52H240L270 88M178 52 206 88H134M206 88 240 52M170 42H194M236 46 246 34 262 34" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    ground(124),
  ],
};

/** The way of travel drawn behind a transport card's middle (`.pk-art`: centred, edges fading out). */
export function TransportArt({ mode }: { mode: TransportMode }) {
  return (
    <svg className="pk-art" viewBox="0 0 400 128" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {SCENES[mode]()}
    </svg>
  );
}

// --- media cards without a photo (etkinlik-v4, 120×100) -------------------------------------------------
const MEDIA = {
  museum: (
    <g fill="url(#pk-ht)" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M10 40 60 12l50 28zM16 90h88v8H16z" />
      <path d="M24 44h12v42H24zM48 44h12v42H48zM72 44h12v42H72zM84 44h12v42H84z" />
    </g>
  ),
  esim: (
    <>
      <rect x="38" y="8" width="44" height="84" rx="9" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={2} />
      <rect x="47" y="24" width="26" height="30" rx="3" fill="#fff" stroke="currentColor" strokeWidth={1.6} />
      <path d="M92 34a20 20 0 0 1 0 32M102 26a32 32 0 0 1 0 48M28 34a20 20 0 0 0 0 32M18 26a32 32 0 0 0 0 48" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M60 6 26 18v26c0 22 15 38 34 48 19-10 34-26 34-48V18z" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M47 48h26M60 35v26" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
      <path d="M47 48h26M60 35v26" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
} as const;

export function MediaSilhouette({ name }: { name: keyof typeof MEDIA }) {
  return (
    <svg className="pk-sil" viewBox="0 0 120 100" aria-hidden>
      {MEDIA[name]}
    </svg>
  );
}
```

- [ ] **Step 2:** `npm run typecheck` · `npm run build` · commit `"Cards: icons and dotted drawings from the mockups"`

---

### Task 12: Kabuk, çember, menü, alt şerit, ayrıntı, belge erişimi

**Files:** Create `src/app/cards/CardShell.tsx`, `src/app/cards/CardDetail.tsx`, `src/app/cards/DocAccess.tsx`

- [ ] **Step 1: `src/app/cards/CardShell.tsx`**

```tsx
// The frame every plan card shares (etkinlik-v4): the ground says where it stands (sand: not bought yet,
// green: done), a 24 px top line (ring · kind · date | files · •••), the body, the 48 px bottom strip, and
// the details that open inside the card on a tap.
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import { cardKindColor, cardKindLabel, type CardKind } from "../../lib/cardKinds";
import { groundOf, type FootView, type Ring as RingState } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { nOptions } from "../../lib/i18nText";
import { KindIcon, UiIcon } from "./Silhouettes";

export function Ring({ state }: { state: RingState }) {
  const label = { open: L("Karar bekliyor", "To decide"), half: L("Seçildi, alınmadı", "Chosen, not booked"), done: L("Alındı ya da planlandı", "Booked or planned") }[state];
  return (
    <span className={`pk-ring ${state}`} role="img" aria-label={label} title={label}>
      {state === "done" && <UiIcon name="check" size={13} />}
    </span>
  );
}

export interface MenuEntry {
  label: string;
  run: () => void;
  danger?: boolean;
}

export function CardMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  if (!entries.length) return null;
  return (
    <span className="pk-menu-wrap">
      <button type="button" className="pk-ib" aria-label={L("Kart menüsü", "Card menu")} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <UiIcon name="dots" size={16} />
      </button>
      {open && (
        <div className="pk-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {entries.map((m) => (
            <button key={m.label} type="button" role="menuitem" className={m.danger ? "danger" : undefined} onClick={() => { setOpen(false); m.run(); }}>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export interface Nav {
  index: number;
  total: number;
  go: (step: -1 | 1) => void;
}

/** The bottom strip: where it stands (or ‹ 1/2 ›) on the left, the price and the one action on the right. */
export function CardFoot({ view, nav, best = false, price, onAction }: { view: FootView; nav?: Nav; best?: boolean; price: CardFacts["price"] | null; onAction?: () => void }) {
  const left = view.left;
  return (
    <div className="pk-foot">
      {left.kind === "nav" && nav ? (
        <>
          <span className="pk-state wait pk-opt">{nOptions(nav.total)}</span>
          <span className="pk-nav">
            <button type="button" aria-label={L("Önceki seçenek", "Previous option")} disabled={nav.index === 0} onClick={() => nav.go(-1)}>
              <UiIcon name="left" size={13} />
            </button>
            {nav.index + 1}/{nav.total}
            <button type="button" aria-label={L("Sonraki seçenek", "Next option")} disabled={nav.index === nav.total - 1} onClick={() => nav.go(1)}>
              <UiIcon name="right" size={13} />
            </button>
          </span>
          {best && <span className="pk-best">{L("Önerim", "My pick")}</span>}
        </>
      ) : left.kind === "state" ? (
        <span className={`pk-state ${left.tone}${left.alert ? ` alert-${left.alert}` : ""}`}>
          {left.tone === "done" && <UiIcon name="check" size={13} />}
          {left.text}
          {left.sub && <span className="pk-sub">· {left.alert ? "⏳ " : ""}{left.sub}</span>}
        </span>
      ) : null}
      {price && (
        <span className="pk-price">
          <b>{price.text}</b>
          {price.label ? ` ${price.label}` : ""}
        </span>
      )}
      {view.action && onAction && (
        <button type="button" className="pk-cta" onClick={onAction}>
          {view.action.label}
        </button>
      )}
    </div>
  );
}

export function CardShell(props: {
  kind: CardKind;
  /** The top line's name when it isn't the kind's ("Metro", "Şehir değişimi"). */
  label?: string;
  ring: RingState;
  date: string | null;
  ariaLabel: string;
  itemId?: string;
  domId?: string;
  extraClass?: string;
  art?: ReactNode;
  docs?: ReactNode;
  menu: MenuEntry[];
  open: boolean;
  onToggle: () => void;
  body: ReactNode;
  foot: ReactNode;
  detail: ReactNode;
}) {
  const style = { "--mc": cardKindColor(props.kind) } as CSSProperties;
  // A tap anywhere on the card opens it, except on its controls and inside what's opened.
  const tap = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, label, .pk-detail, .pk-menu, .pk-doclist")) return;
    props.onToggle();
  };
  return (
    <article
      className={`pk-card pk-${groundOf(props.ring)}${props.open ? " pk-open" : ""}${props.extraClass ? ` ${props.extraClass}` : ""}`}
      style={style}
      aria-label={props.ariaLabel}
      data-item-id={props.itemId}
      id={props.domId}
      onClick={tap}
    >
      {props.art}
      <div className="pk-top">
        <Ring state={props.ring} />
        <span className="pk-kind">
          <KindIcon kind={props.kind} size={15} />
          {props.label ?? cardKindLabel(props.kind)}
        </span>
        {props.date && <span className="pk-date">· {props.date}</span>}
        <span className="pk-end">
          {props.docs}
          <CardMenu entries={props.menu} />
        </span>
      </div>
      <div className="pk-body" role="button" tabIndex={0} aria-expanded={props.open}
        aria-label={props.open ? L(`${props.ariaLabel}: ayrıntıyı kapat`, `${props.ariaLabel}: close details`) : L(`${props.ariaLabel}: ayrıntı`, `${props.ariaLabel}: details`)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), props.onToggle())}>
        {props.body}
      </div>
      {props.foot}
      {props.open && props.detail}
    </article>
  );
}
```

- [ ] **Step 2: `src/app/cards/DocAccess.tsx`**

```tsx
// A card's files (top right, etkinlik-v4): a white pill with the first file's name (+N) that opens it, or a
// faint paper clip that picks one. Several files open a small list; the opened card lists them too (so a
// single file can be deleted). Files stay on this computer (see lib/docs.ts).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { onChanged } from "../../lib/db";
import { addDoc, deleteDoc, DOC_ACCEPT, docPill, getDoc, listDocMeta, sizeText } from "../../lib/docs";
import { L } from "../../lib/i18n";
import type { DocMeta, Item } from "../../lib/types";
import { UiIcon } from "./Silhouettes";

/** Opens a stored file in a new tab (the browser shows PDFs and pictures itself). */
export async function openDoc(id: string): Promise<void> {
  const doc = await getDoc(id);
  if (!doc) return;
  const url = URL.createObjectURL(doc.blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function DocPickButton({ item, className, title, children }: { item: Pick<Item, "id" | "tripId">; className?: string; title?: string; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); setError(null); input.current?.click(); }}>
        {children}
      </button>
      <input ref={input} className="pk-file" type="file" accept={DOC_ACCEPT} multiple hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const file of files) {
            try {
              await addDoc(item, file);
            } catch (err) {
              setError((err as Error).message);
            }
          }
        }} />
      {error && <span className="pk-doc-error" role="alert">{error}</span>}
    </>
  );
}

/** Each file: its name and size, open, delete. */
export function DocList({ docs }: { docs: DocMeta[] }) {
  return (
    <ul className="pk-docrows" aria-label={L("Belgeler", "Documents")}>
      {docs.map((d) => (
        <li key={d.id}>
          <span className="name">{d.name}</span>
          <span className="size">{sizeText(d.size)}</span>
          <button type="button" onClick={() => void openDoc(d.id)}>{L("Aç", "Open")}</button>
          <button type="button" className="danger" onClick={() => void deleteDoc(d.id)}>{L("Sil", "Delete")}</button>
        </li>
      ))}
    </ul>
  );
}

export function DocAccess({ item, docs }: { item: Pick<Item, "id" | "tripId">; docs: DocMeta[] }) {
  const [list, setList] = useState(false);
  useEffect(() => {
    if (!list) return;
    const close = () => setList(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [list]);
  const pill = docPill(docs);
  if (!pill) {
    return (
      <DocPickButton item={item} className="pk-ib pk-clip" title={L("Belge ekle (PDF, görsel)", "Add a document (PDF, image)")}>
        <UiIcon name="clip" size={16} />
      </DocPickButton>
    );
  }
  return (
    <span className="pk-docs">
      <button type="button" className="pk-docpill" title={docs.length === 1 ? L("Belgeyi aç", "Open the document") : L("Belgeler", "Documents")}
        onClick={(e) => { e.stopPropagation(); if (docs.length === 1) void openDoc(docs[0].id); else setList(!list); }}>
        <UiIcon name="doc" size={15} />
        <span>{pill.name}</span>
        {pill.more > 0 && <b>+{pill.more}</b>}
      </button>
      {list && (
        <div className="pk-doclist" onClick={(e) => e.stopPropagation()}>
          <DocList docs={docs} />
          <DocPickButton item={item} className="link-btn">{L("Belge ekle", "Add a document")}</DocPickButton>
        </div>
      )}
    </span>
  );
}

/** A trip's files by card (its own and those of the plans it replaced), kept fresh on every change. */
export function useTripDocs(tripId: string, inherited: Map<string, string[]>): (itemId: string) => DocMeta[] {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => void listDocMeta(tripId).then((d) => alive && setDocs(d));
    load();
    const off = onChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, [tripId]);
  return useCallback(
    (itemId: string) => {
      const ids = [itemId, ...(inherited.get(itemId) ?? [])];
      return docs.filter((d) => ids.includes(d.itemId));
    },
    [docs, inherited],
  );
}
```

- [ ] **Step 3: `src/app/cards/CardDetail.tsx`**

```tsx
// What a plan card shows when opened (white panel inside the card, ulasim-v3 .detail): everything the old
// decision card said (badges, score and place, why — against the next one or the group's pick —, what to
// check, the fit note, the pivot, the needs, pros and cons, what was read, votes), the price in full, the
// card's files, and what can be done with it.
import type { ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import type { Choice, Ranked } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import type { DocMeta, Item } from "../../lib/types";
import { PivotNote } from "../PivotNote";
import { VoteBar } from "../Share";
import type { Decisions } from "../useDecisions";
import { DocList } from "./DocAccess";
import { datedLink, Details, TradeLine } from "./parts";

const fitWords = () => ({ check: L("Seçmeden kontrol et", "Check before choosing"), partial: L("Kısmi", "Partial"), unfit: L("Uygun değil", "Doesn't fit") });

export function CardDetail({ item, group, decision, decisions, ranked, headline, facts, alert, docs, actions }: {
  item: Item;
  group: Item[];
  decision?: GroupDecision;
  decisions: Decisions | null;
  ranked?: Ranked;
  /** The group's recommendation, on its first option. */
  headline: Choice | null;
  facts: CardFacts;
  alert: { tone: "red" | "amber"; text: string } | null;
  docs: DocMeta[];
  actions: ReactNode;
}) {
  const option = decision?.options.find((o) => o.item.id === item.id);
  const fit = option?.fit ?? "fit";
  const { nights } = datedLink(item, decision);
  const currency = decisions?.ctx.currency ?? "EUR";
  const price = facts.price;
  const priceText = price && [price.text, price.label, price.perNight, price.note, price.provisional ? L("geçici", "provisional") : null].filter(Boolean).join(" · ");
  const pages = new Map(group.map((i) => [i.id, i.url]));
  const placeLine = [facts.score != null ? L(`Uyum puanı ${facts.score}/100`, `Fit score ${facts.score}/100`) : null, ranked?.rank ? L(`${ranked.rank}. sırada`, `ranked #${ranked.rank}`) : null].filter(Boolean).join(" · ");
  return (
    <div className="pk-detail">
      {alert && <p className={`pk-alert ${alert.tone}`}>⏳ {alert.text}</p>}
      {ranked && ranked.badges.length > 0 && <p className="pk-badges">{ranked.badges.join(" · ")}</p>}
      {placeLine && <p className="pk-score-line">{placeLine}</p>}
      {priceText && (
        <dl className="pk-dl">
          <dt>{L("Fiyat", "Price")}</dt>
          <dd>{priceText}</dd>
        </dl>
      )}
      {headline?.headline && <p className="pk-why headline">{headline.headline}</p>}
      {headline && headline.verify.length > 0 && (
        <ul className="pk-verify" aria-label={L("Seçmeden kontrol et", "Check before choosing")}>
          {headline.verify.map((v) => (
            <li key={`${v.itemId}:${v.what}`}>
              <b>{v.name}:</b> {v.what}
              {pages.get(v.itemId) && <a href={pages.get(v.itemId)!} target="_blank" rel="noreferrer">{" "}{L("Sayfada bak ↗", "See on page ↗")}</a>}
            </li>
          ))}
        </ul>
      )}
      {ranked && <TradeLine ranked={ranked} currency={currency} className="pk-why trade" />}
      {ranked && ranked.unknown.length > 0 && (
        <p className="pk-why unknown">
          ? {ranked.unknown.join(", ")}: {L("diğerlerinin yorumlarında geçiyor, bunda hiç geçmiyor; bilinmiyor, sayfada bak", "mentioned in the others' reviews, never in this one's; unknown, check the page")}
        </p>
      )}
      {fit !== "fit" && option && option.fitNotes.length > 0 && (
        <p className={`opt-status ${fit}`}>
          <b>{fitWords()[fit]}:</b> {option.fitNotes.join(" · ")}
        </p>
      )}
      {ranked?.pivot && item.status === "saved" && <PivotNote item={item} pivot={ranked.pivot} />}
      <Details item={item} decision={decision} decisions={decisions} status={facts.status} />
      {nights && (
        <p className="muted small-note">
          {L(
            `Tarihsiz kaydedildi; ${formatDateRange(nights.start, nights.end)} için geçici karşılaştırılıyor. Tarihlerle açıp tekrar kaydedersen gerçek fiyat işlenir.`,
            `Saved without dates; compared for ${formatDateRange(nights.start, nights.end)} for now. Open it with dates and save again to get the real price.`,
          )}
        </p>
      )}
      <VoteBar item={item} />
      {docs.length > 0 && <DocList docs={docs} />}
      <div className="pk-acts">{actions}</div>
    </div>
  );
}
```

- [ ] **Step 4:** `npm run typecheck` · `npm run build` · commit `"Cards: shell, ring, menu, bottom strip, details, files"`

---

### Task 13: Ulaşım ve medya gövdeleri, `PlanCard`, `NavGroup`, `LegCard`

**Files:** Create `src/app/cards/TransportCard.tsx`, `src/app/cards/MediaCard.tsx`, `src/app/cards/PlanCard.tsx`, `src/app/cards/LegCard.tsx`; Modify `src/app/LegRow.tsx`

- [ ] **Step 1: `src/app/cards/TransportCard.tsx`**

```tsx
// A transport card's body (ulasim-v3): the city it leaves from on the left (30, bold) with its day and
// **hour**, where it goes on the right, aligned right; the way of travel drawn in the middle (.pk-art,
// behind) with the duration under it. A rental: where it's picked up, then how many days.
import type { End, TransportFace } from "../../lib/cardView";

function Stop({ end, right }: { end: End | null; right: boolean }) {
  if (!end) return <div className={`pk-stop${right ? " r" : ""}`} />;
  return (
    <div className={`pk-stop${right ? " r" : ""}`}>
      <b className={end.city.length > 14 ? "long" : undefined}>{end.city}</b>
      <span>
        {end.sub}
        {end.sub && end.time ? " · " : ""}
        {end.time && <strong>{end.time}</strong>}
      </span>
    </div>
  );
}

export function TransportCardBody({ face, title }: { face: TransportFace; title: string }) {
  if (!face.from && !face.to) return <h3 className="pk-title">{title}</h3>;
  return (
    <div className="pk-mid">
      <Stop end={face.from} right={false} />
      <div className="pk-route">{face.middle && <small>{face.middle}</small>}</div>
      <Stop end={face.to} right />
    </div>
  );
}
```

- [ ] **Step 2: `src/app/cards/MediaCard.tsx`**

```tsx
// A media card's body (etkinlik-v4): a 176×128 picture on the left (the photo, else the kind's dotted
// drawing; the fit score on its corner, blue on the pick), the title (20), the info line and the source line.
import { Fragment } from "react";
import type { CardKind } from "../../lib/cardKinds";
import type { MediaFace } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { FallbackImg } from "../FallbackImg";
import { KindIcon, MediaSilhouette } from "./Silhouettes";

export function MediaCardBody({ face, kind, score, best }: { face: MediaFace; kind: CardKind; score: number | null; best: boolean }) {
  const drawing = face.silhouette ? <MediaSilhouette name={face.silhouette} /> : <KindIcon kind={kind} size={56} className="pk-kindbig" />;
  return (
    <div className="pk-media">
      <div className="pk-vis">
        {face.image ? <FallbackImg className="pk-img" src={face.image} fallback={kind === "activity" ? <MediaSilhouette name="museum" /> : drawing} /> : drawing}
        {score != null && (
          <span className={`pk-score${best ? " best" : ""}`} title={L("Uyum puanı (100 üzerinden)", "Fit score (out of 100)")}>
            {score}
          </span>
        )}
      </div>
      <div className="pk-txt">
        <h3>{face.title}</h3>
        {face.info.length > 0 && (
          <p>
            {face.info.map((x, i) => (
              <Fragment key={`${i}:${x.text}`}>
                {i > 0 && " · "}
                {x.strong ? <b>{x.text}</b> : x.text}
              </Fragment>
            ))}
          </p>
        )}
        {face.meta.length > 0 && (
          <div className="pk-meta">
            {face.meta.map((m) =>
              m.kind === "link" ? (
                <a key={m.text} href={m.href} target="_blank" rel="noreferrer">{m.text}</a>
              ) : (
                <span key={m.text} className={m.kind === "star" ? "star" : undefined}>{m.text}</span>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/LegRow.tsx` — gövde dışarı**

`LegRow`'daki `{open && (<div className="leg-body">…</div>)}` içeriğini olduğu gibi yeni bileşene taşı:

```tsx
/** A transfer's body: notes, saved options, how to go, "Ayarlandı", the chat hint, "Gerek yok · gizle". */
export function LegBody({ leg, tripId, onOpenItem, onRemove }: { leg: Leg; tripId: string; onOpenItem: (item: Item) => void; onRemove: (item: Item) => void }) {
  const choice = leg.choice;
  const save = (patch: Parameters<typeof withLegChoice>[2]) => void updateTrip(tripId, (t) => withLegChoice(t, leg.key, patch));
  const settledByItem = leg.options.some((i) => i.status === "booked");
  return <div className="leg-body">{/* LegRow'daki içerik, removeItem(i) yerine onRemove(i) */}</div>;
}
```

`LegRow` prop'larına `onRemove: (item: Item) => void` ekle, `{open && <LegBody leg={leg} tripId={tripId} onOpenItem={onOpenItem} onRemove={onRemove} />}` yaz; `removeItem` importunu ve `LegRow` gövdesinde artık kullanılmayan `choice`, `save`, `settledByItem` sabitlerini kaldır (`LegBody` kendi içinde tanımlar). `ICONS` sabiti ikisinde de kullanılır (dosya içi).

- [ ] **Step 4: `src/app/cards/PlanCard.tsx`**

```tsx
// A plan card for one record (not a stay): a transport card for a way of travel, a media card for an
// activity, an eSIM, insurance, a restaurant or a note. NavGroup shows a need's options as one card with
// ‹ 1/2 › in its bottom strip (stays keep their side-by-side cards). CardEnv carries what every card needs
// from the board (decisions, files, delete with undo, the add sheet) without threading it through Timeline.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { cardKind, isTransportKind } from "../../lib/cardKinds";
import { footOf, mediaFace, menuFor, ringOf, topDate, transportFace } from "../../lib/cardView";
import type { Choice, Ranked } from "../../lib/choice";
import type { GroupDecision } from "../../lib/decision";
import { L } from "../../lib/i18n";
import { dateAlert } from "../../lib/progress";
import type { InsertAt } from "../../lib/templates";
import type { DocMeta, Item, LegMode } from "../../lib/types";
import { chooseItem, setInstalled, setItemStatus } from "../actions";
import { useShare } from "../Share";
import type { Decisions } from "../useDecisions";
import { CardDetail } from "./CardDetail";
import { CardFoot, CardShell, type MenuEntry, type Nav } from "./CardShell";
import { DocAccess, DocPickButton } from "./DocAccess";
import { MediaCardBody } from "./MediaCard";
import { datedLink } from "./parts";
import { TransportArt } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";

export interface CardEnv {
  tripId: string;
  decisions: Decisions | null;
  today: string;
  /** The way chosen for each record's transfer (cardKinds.legModeByItem). */
  legModes: Map<string, LegMode>;
  /** A card's files (its own and those of the plans it replaced). */
  docsFor: (itemId: string) => DocMeta[];
  /** Deletes with an 8-second "Geri al". */
  remove: (item: Item) => void;
  /** Opens the add sheet (null: from the plan's header). */
  add: (at: InsertAt | null) => void;
  /** Opens the add sheet's form for a plan ("Düzenle"). */
  edit: (item: Item) => void;
  onOpenItem: (item: Item) => void;
  onCompare: (groupKey: string) => void;
}

export const CardEnvContext = createContext<CardEnv | null>(null);
export function useCardEnv(): CardEnv {
  const env = useContext(CardEnvContext);
  if (!env) throw new Error("Plan cards need CardEnvContext (TripPanel provides it).");
  return env;
}

export function PlanCard({ item, group, decision, ranked, nav, onChange, changing = false, onCompare, headline = null }: {
  item: Item;
  /** The options it's compared with (a choice replaces another chosen one among them). */
  group: Item[];
  decision?: GroupDecision;
  ranked?: Ranked;
  nav?: Nav;
  /** A decided card whose other options can come back ("Diğer N seçenek"). */
  onChange?: () => void;
  changing?: boolean;
  onCompare?: () => void;
  headline?: Choice | null;
}) {
  const env = useCardEnv();
  const [open, setOpen] = useState(false);
  // Shared trip: both travellers said 👎 → it steps back like "Ele" (a vote undoes it).
  const allNo = useShare()?.tally(item).allNo ?? false;
  const kind = cardKind(item, env.legModes.get(item.id) ?? null);
  const facts = cardFacts(item, decision, env.decisions?.ctx);
  const alert = dateAlert(item, env.today);
  const ring = ringOf(item, kind);
  const foot = footOf(item, kind, { options: nav?.total ?? 1, alert });
  const docs = env.docsFor(item.id);
  const { url: datedUrl } = datedLink(item, decision);
  const page = datedUrl ?? item.url;
  const best = ranked?.rank === 1;
  const act = () => {
    const does = foot.action?.does;
    if (does === "choose") void chooseItem(item, group);
    else if (does === "book") void setItemStatus(item, "booked");
    else if (does === "install") void setInstalled(item, true);
    else if (does === "restore") void setItemStatus(item, "saved");
  };
  const menu: MenuEntry[] = menuFor(item).map((a) =>
    a === "edit"
      ? { label: L("Düzenle", "Edit"), run: () => env.edit(item) }
      : a === "dismiss"
        ? { label: L("Ele", "Rule out"), run: () => void setItemStatus(item, "dismissed") }
        : { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true },
  );
  const alternatives = onChange ? Math.max(0, group.length - 1) : 0;
  const actions = (
    <>
      {onCompare && <button type="button" onClick={onCompare}>{L("Karşılaştır →", "Compare →")}</button>}
      {page && <a href={page} target="_blank" rel="noreferrer">{datedUrl ? L("Tarihlerle aç ↗", "Open with dates ↗") : L("Kaydettiğin sayfa ↗", "Your saved page ↗")}</a>}
      <button type="button" onClick={() => env.onOpenItem(item)}>{L("Tüm detaylar", "All details")}</button>
      <DocPickButton item={item}>{L("Belge ekle", "Add a document")}</DocPickButton>
      {alternatives > 0 && (
        <button type="button" aria-expanded={changing} onClick={onChange}>
          {changing ? L("Kapat", "Close") : L(`Diğer ${alternatives} seçenek`, `${alternatives} other option${alternatives === 1 ? "" : "s"}`)}
        </button>
      )}
      {item.status === "chosen" && item.origin !== "chat" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "saved")}>{L("Seçimi geri al", "Undo choice")}</button>}
      {item.status === "booked" && <button type="button" className="quiet" onClick={() => void setItemStatus(item, "chosen")}>{L("Rezervasyonu geri al", "Mark as not booked")}</button>}
      {kind === "esim" && item.installedAt && <button type="button" className="quiet" onClick={() => void setInstalled(item, false)}>{L("Kurulmadı", "Not installed")}</button>}
      <button type="button" className="del" onClick={() => env.remove(item)}>{L("Sil", "Delete")}</button>
    </>
  );
  const transport = isTransportKind(kind);
  return (
    <CardShell
      kind={kind}
      ring={ring}
      date={topDate(item, kind)}
      ariaLabel={item.name}
      itemId={item.id}
      extraClass={allNo ? "pk-all-no" : undefined}
      art={transport && kind !== "transport" ? <TransportArt mode={kind} /> : null}
      docs={<DocAccess item={item} docs={docs} />}
      menu={menu}
      open={open}
      onToggle={() => setOpen(!open)}
      body={
        transport ? (
          <TransportCardBody face={transportFace(item, kind)} title={item.name} />
        ) : (
          <MediaCardBody face={mediaFace(item, kind, facts.source)} kind={kind} score={facts.score} best={best} />
        )
      }
      foot={<CardFoot view={foot} nav={nav} best={best} price={facts.price} onAction={act} />}
      detail={<CardDetail item={item} group={group} decision={decision} decisions={env.decisions} ranked={ranked} headline={headline} facts={facts} alert={alert} docs={docs} actions={actions} />}
    />
  );
}

/**
 * A need's options (not a stay) as one card: best first, ‹ 1/2 › to go through them. Decided, the chosen
 * one alone (its details bring the others back: "Diğer N seçenek"). The wrapper names every option's id,
 * so a to-do can find the card of one not on screen (Progress.findTarget).
 */
export function NavGroup({ items, heading, nested, decision, choice, decided, onChange, changing, rankedOf, onCompare }: {
  items: Item[];
  heading: ReactNode;
  nested: boolean;
  decision?: GroupDecision;
  choice: Choice | null;
  decided: Item | null;
  onChange?: () => void;
  changing: boolean;
  rankedOf: (item: Item) => Ranked | undefined;
  onCompare?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const ids = items.map((i) => i.id).join(" ");
  useEffect(() => setIndex(0), [ids]);
  // Bringing the options back starts at the chosen one.
  useEffect(() => {
    if (changing && decided) setIndex(Math.max(0, items.findIndex((i) => i.id === decided.id)));
  }, [changing]);
  const single = decided && !changing;
  const shown = single ? decided : items[Math.min(index, items.length - 1)];
  const nav: Nav | undefined =
    !single && items.length > 1 ? { index: Math.min(index, items.length - 1), total: items.length, go: (step) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + step))) } : undefined;
  const ranked = rankedOf(shown);
  return (
    <div className={nested ? "group nested" : "section"} data-option-ids={ids}>
      {heading && <div className={nested ? "group-head" : "section-head"}>{heading}</div>}
      {changing && (
        <button type="button" className="link-btn pk-close" onClick={onChange}>
          {L("Kapat", "Close")}
        </button>
      )}
      <PlanCard
        key={shown.id}
        item={shown}
        group={items}
        decision={decision}
        ranked={ranked}
        nav={nav}
        onChange={single ? onChange : undefined}
        changing={changing}
        onCompare={onCompare}
        headline={ranked?.rank === 1 ? choice : null}
      />
    </div>
  );
}
```


- [ ] **Step 5: `src/app/cards/LegCard.tsx`**

```tsx
// A transfer (airport ↔ hotel, hotel change) or a change of city as a transport card on the plan: its way
// of travel drawn, the two ends, where it stands. Opened, the transfer's own body (LegRow's): notes,
// saved options, how to go, "Ayarlandı", and a flight search when going by plane.
import { useState } from "react";
import { legCardView } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import { withLegChoice, type Leg } from "../../lib/legs";
import { setHidden, updateTrip } from "../actions";
import { kindLabel, LegBody } from "../LegRow";
import { CardFoot, CardShell, type MenuEntry } from "./CardShell";
import { useCardEnv } from "./PlanCard";
import { TransportArt } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";

export function LegCard({ leg }: { leg: Leg }) {
  const env = useCardEnv();
  const [open, setOpen] = useState(false);
  const v = legCardView(leg);
  const book = () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg.key, { booked: true }));
  const menu: MenuEntry[] = [
    ...(leg.kind !== "move" ? [{ label: L("Gerek yok", "Not needed"), run: () => void setHidden(env.tripId, `leg:${leg.key}`, true, kindLabel()[leg.kind]) }] : []),
    ...(leg.choice ? [{ label: L("Planı temizle", "Clear the plan"), run: () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg.key, null)) }] : []),
  ];
  return (
    <CardShell
      kind={v.kind}
      label={v.label}
      ring={v.ring}
      date={formatDateRange(leg.date, null)}
      ariaLabel={v.ariaLabel}
      domId={`leg-${leg.key}`}
      extraClass="pk-leg"
      art={v.kind !== "transport" ? <TransportArt mode={v.kind} /> : null}
      menu={menu}
      open={open}
      onToggle={() => setOpen(!open)}
      body={<TransportCardBody face={{ from: v.from, to: v.to, middle: v.middle, rental: false }} title={v.ariaLabel} />}
      foot={<CardFoot view={v.foot} price={null} onAction={book} />}
      detail={
        <div className="pk-detail">
          <LegBody leg={leg} tripId={env.tripId} onOpenItem={env.onOpenItem} onRemove={env.remove} />
          {v.searchUrl && (
            <div className="pk-acts">
              <a href={v.searchUrl} target="_blank" rel="noreferrer">{L("Uçuş ara ↗", "Search flights ↗")}</a>
            </div>
          )}
        </div>
      }
    />
  );
}
```

- [ ] **Step 6:** `npm run typecheck` · `npx vitest run` · `npm run build` (yeni dosyalar henüz bağlı değil; derlenmeleri yeter) · commit `"Cards: transport and media bodies, plan card, option navigator, transfer card"`

---

### Task 14: Ekleme penceresi, araya ekle, geri al bildirimi

**Files:** Create `src/app/cards/AddSheet.tsx`, `src/app/cards/UndoToast.tsx`

- [ ] **Step 1: `src/app/cards/UndoToast.tsx`**

```tsx
// "Douro tekne turu silindi · Geri al" for 8 seconds after a delete (ulasim-v3 .toast). No confirm dialog.
import { L } from "../../lib/i18n";
import type { Removed } from "../../lib/removal";

export function UndoToast({ removed, onUndo }: { removed: Removed | null; onUndo: () => void }) {
  if (!removed) return null;
  return (
    <div className="pk-undo" role="status" aria-live="polite">
      <span>{L(`${removed.item.name} silindi`, `${removed.item.name} deleted`)}</span>
      <button type="button" onClick={onUndo}>{L("Geri al", "Undo")}</button>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/cards/AddSheet.tsx`**

```tsx
// "Ne eklemek istersin?" (ulasim-v3 .sheet): the template tiles in three groups, then the short form for
// the one picked, filled with the city and the day of where it was opened. Saving makes a plan item
// ("Planlanıyor"); "Düzenle" opens the same form for a plan. Also the header's "+ Ekle" and the "+"
// between two cards.
import { useEffect, useState, type FormEvent } from "react";
import { cardKindColor } from "../../lib/cardKinds";
import { newId } from "../../lib/db";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import { addFromTemplate, emptyForm, formOf, saveEdit, templateCardKind, templateLabel, TEMPLATES, type FormValues, type InsertAt, type Template } from "../../lib/templates";
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

/** The "+" between two cards of the plan: shows on hover, adds there. */
export function InsertPoint({ at, onAdd }: { at: InsertAt; onAdd: (at: InsertAt) => void }) {
  return (
    <div className="pk-insert">
      <button type="button" title={L("Buraya ekle", "Add here")} aria-label={L("Buraya ekle", "Add here")} onClick={() => onAdd(at)}>
        +
      </button>
    </div>
  );
}

export function AddSheet({ tripId, at, editing, currency, onClose }: { tripId: string; at: InsertAt | null; editing: Item | null; currency: string; onClose: () => void }) {
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
  const pick = (t: Template) => {
    setTpl(t);
    setForm(emptyForm(t, at, currency));
    setError(null);
  };
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!tpl || !form || saving) return;
    setSaving(true);
    const out = editing ? await saveEdit(editing, tpl, form) : await addFromTemplate(tripId, tpl, form, newId());
    setSaving(false);
    if (typeof out === "string") return setError(out);
    onClose();
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
            {tpl.form === "named" && <>{field("name", L("Ad", "Name"))}{field("date", L("Tarih", "Date"), "date")}</>}
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
              {!editing && <button type="button" className="link-btn" onClick={() => setTpl(null)}>{L("‹ Geri", "‹ Back")}</button>}
              <button type="submit" className="pk-cta" disabled={saving}>{L("Kaydet", "Save")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** `npm run typecheck` · `npm run build` · commit `"Cards: add sheet, the + between cards, undo toast"`

---

### Task 15: Stiller (`static/app.css`)

**Files:** Modify `static/app.css`

Değerler iki taslaktan; `.panel` zaten `container: panel / inline-size`, dar düzen `@container panel` ile (pano sohbet sütunuyla paylaşıldığı için ekran genişliği değil, panelin genişliği).

- [ ] **Step 1:** Dosyanın sonuna ekle:

```css
/* ---------- plan cards (0.31): docs/mockups/2026-10-05-ulasim-v3.html + 2026-10-05-etkinlik-v4.html ---------- */
.pk-card {
  --pk-ink: #1d1d1f; --pk-gray: #6e6e73; --pk-line: #e8e8ed; --pk-link: #1556d6;
  position: relative; overflow: hidden; border-radius: 20px; padding: 16px; margin: 0 0 6px;
  background: #fbf6ea; border: 1px solid #efe2c3; color: var(--pk-ink); cursor: pointer; transition: box-shadow .15s;
}
.pk-card:hover { box-shadow: 0 6px 22px rgba(0, 0, 0, .06); }
.pk-card.pk-green { background: #eef8f1; border-color: #cfe8d7; }
.pk-card.pk-all-no { opacity: .6; }
.pk-art {
  position: absolute; left: 50%; top: 32px; height: 104px; width: 46%; transform: translateX(-50%); color: var(--mc); opacity: .9; pointer-events: none;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 14%, #000 86%, transparent 100%);
}

/* top line */
.pk-top { position: relative; display: flex; align-items: center; gap: 8px; height: 24px; font-size: 13px; color: var(--pk-gray); }
.pk-ring { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; }
.pk-ring.open { border: 2px dashed #cdb07a; }
.pk-ring.half { border: 2px solid #e0a43a; }
.pk-ring.done { background: #1f8f4e; color: #fff; }
.pk-kind { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--mc); white-space: nowrap; }
.pk-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.pk-end { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.pk-ib { width: 28px; height: 24px; border: 0; border-radius: 8px; background: transparent; color: var(--pk-gray); display: grid; place-items: center; cursor: pointer; }
.pk-ib.pk-clip { color: #b9b3a6; }
.pk-ib:hover { background: rgba(255, 255, 255, .8); color: var(--pk-ink); }
.pk-docs, .pk-menu-wrap { position: relative; }
.pk-docpill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px 0 7px; border: 0; border-radius: 8px; background: #fff; color: var(--pk-ink); font: inherit; font-size: 13px; font-weight: 500; box-shadow: 0 0 0 1px rgba(0, 0, 0, .06); cursor: pointer; }
.pk-docpill b { font-weight: 600; color: var(--pk-gray); }
.pk-menu, .pk-doclist { position: absolute; right: 0; top: 30px; z-index: 6; min-width: 180px; padding: 6px; border-radius: 14px; background: #fff; box-shadow: 0 10px 30px rgba(0, 0, 0, .14); display: flex; flex-direction: column; cursor: auto; }
.pk-doclist { min-width: 280px; padding: 8px 10px; gap: 6px; }
.pk-menu button { text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 15px; color: var(--pk-ink); cursor: pointer; }
.pk-menu button:hover { background: #f5f5f7; }
.pk-menu button.danger, .pk-docrows .danger { color: #c62828; }
.pk-docrows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.pk-docrows li { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; align-items: center; font-size: 14px; }
.pk-docrows .name { min-width: 0; overflow-wrap: anywhere; }
.pk-docrows .size { color: var(--pk-gray); font-variant-numeric: tabular-nums; }
.pk-docrows button { border: 0; background: none; padding: 0; font: inherit; color: var(--pk-link); cursor: pointer; }
.pk-doc-error { position: absolute; right: 0; top: 30px; z-index: 6; width: 260px; padding: 8px 10px; border-radius: 10px; background: #fdecea; color: #b42318; font-size: 13px; }

/* transport body (ulasim-v3) */
.pk-body { position: relative; outline: none; }
.pk-body:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 12px; }
.pk-mid { display: grid; grid-template-columns: 1fr 170px 1fr; align-items: center; gap: 10px; margin: 8px 0 26px; }
.pk-stop b { display: block; font-size: 30px; line-height: 1.1; font-weight: 700; letter-spacing: -.02em; overflow-wrap: anywhere; }
.pk-stop b.long { font-size: 22px; }
.pk-stop span { display: block; margin-top: 3px; font-size: 14px; color: var(--pk-gray); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pk-stop span strong { color: var(--pk-ink); font-weight: 600; }
.pk-stop.r { text-align: right; }
.pk-route { position: relative; height: 78px; }
.pk-route small { position: absolute; left: -20px; right: -20px; bottom: -26px; text-align: center; font-size: 13px; color: #3a3a3c; white-space: nowrap; }
.pk-title { margin: 12px 0 16px; font-size: 20px; line-height: 1.25; font-weight: 700; }
/* No drawing (metro, walking, an unknown way): no empty band for it. */
.pk-card:not(:has(> .pk-art)) .pk-route { height: 28px; }
.pk-card:not(:has(> .pk-art)) .pk-mid { margin-bottom: 20px; }

/* media body (etkinlik-v4) */
.pk-media { display: grid; grid-template-columns: 176px 1fr; gap: 16px; align-items: center; margin: 12px 0 16px; }
.pk-vis { position: relative; width: 176px; height: 128px; border-radius: 16px; overflow: hidden; background: color-mix(in srgb, var(--mc) 10%, #fff); color: var(--mc); }
.pk-vis .pk-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pk-vis svg.pk-sil { position: absolute; inset: 0; margin: auto; width: 116px; height: 96px; }
.pk-vis .pk-kindbig { position: absolute; inset: 0; margin: auto; }
.pk-score { position: absolute; top: 6px; right: 6px; padding: 2px 6px; border-radius: 8px; background: #fff; color: var(--pk-ink); font-size: 13px; font-weight: 700; box-shadow: 0 1px 4px rgba(0, 0, 0, .12); }
.pk-score.best { color: var(--pk-link); }
.pk-txt { min-width: 0; }
.pk-txt h3 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 700; letter-spacing: -.01em; }
.pk-txt p { margin: 4px 0 0; font-size: 15px; color: #3a3a3c; font-variant-numeric: tabular-nums; }
.pk-txt p b { font-weight: 600; color: var(--pk-ink); }
.pk-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 8px; font-size: 13px; color: var(--pk-gray); }
.pk-meta .star { color: var(--pk-ink); font-weight: 600; }
.pk-meta a { color: var(--pk-link); text-decoration: none; }

/* bottom strip */
.pk-foot { position: relative; display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 6px 0 12px; border-radius: 14px; background: rgba(255, 255, 255, .75); }
.pk-state { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; }
.pk-state.wait { color: #8a5a00; }
.pk-state.done { color: #1d7442; }
.pk-state.plain { color: var(--pk-gray); }
.pk-sub { font-weight: 400; color: var(--pk-gray); white-space: normal; }
.pk-state.alert-red .pk-sub { color: #c62828; }
.pk-state.alert-amber .pk-sub { color: #8a5a00; }
.pk-nav { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--pk-gray); white-space: nowrap; font-variant-numeric: tabular-nums; }
.pk-nav button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e3dccb; background: #fff; display: grid; place-items: center; color: var(--pk-ink); cursor: pointer; }
.pk-nav button:disabled { opacity: .4; cursor: default; }
.pk-best { font-size: 13px; color: var(--pk-link); font-weight: 600; }
.pk-price { margin-left: auto; font-size: 13px; color: var(--pk-gray); white-space: nowrap; font-variant-numeric: tabular-nums; }
.pk-price b { font-size: 17px; color: var(--pk-ink); margin-right: 2px; }
.pk-cta { height: 36px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--pk-ink, #1d1d1f); color: #fff; font: inherit; font-size: 15px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.pk-cta:disabled { opacity: .5; }

/* opened (ulasim-v3 .detail) */
.pk-detail { position: relative; margin: 12px 0 0; padding: 14px 16px; border-radius: 14px; background: #fff; font-size: 14px; cursor: auto; }
.pk-detail .card-details { padding: 0; }
.pk-dl { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; margin: 0 0 8px; }
.pk-dl dt { color: var(--pk-gray); }
.pk-dl dd { margin: 0; }
.pk-badges { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--pk-link); }
.pk-score-line { margin: 0 0 8px; font-size: 13px; color: var(--pk-gray); }
.pk-alert { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.pk-alert.red { color: #c62828; }
.pk-alert.amber { color: #8a5a00; }
.pk-why { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--pk-line); line-height: 1.5; }
.pk-why + .pk-why { margin-top: 6px; padding-top: 0; border-top: 0; }
.pk-verify { margin: 6px 0 0; padding-left: 18px; line-height: 1.5; }
.pk-detail .pk-docrows { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--pk-line); }
.pk-acts { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--pk-line); }
.pk-acts a, .pk-acts button { color: var(--pk-link); font: inherit; font-weight: 500; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
.pk-acts .quiet { color: var(--pk-gray); }
.pk-acts .del { margin-left: auto; color: var(--pk-gray); }
.pk-acts .del:hover { color: #c62828; }
.pk-close { display: block; margin: 0 0 6px auto; }

/* in a row of cards (a day's ideas, the places list) */
.carousel-track > .pk-card { flex: 0 0 560px; max-width: 92%; scroll-snap-align: start; margin: 0; }
.carousel-track:has(.pk-card.pk-open) { align-items: flex-start; }

/* add: header button, the + between cards, the sheet (ulasim-v3) */
.pk-add { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; margin-left: auto; border-radius: 999px; border: 1px solid #d2d2d7; background: #fff; font: inherit; font-size: 15px; font-weight: 500; color: #1d1d1f; cursor: pointer; }
.section-head .pk-add { margin-left: auto; }
.pk-insert { position: relative; height: 22px; display: flex; align-items: center; justify-content: center; }
.pk-insert button { opacity: 0; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; font-size: 17px; line-height: 1; cursor: pointer; transition: opacity .15s; }
.pk-insert::before { content: ""; position: absolute; left: 20px; right: 20px; top: 50%; border-top: 1px dashed #d2d2d7; opacity: 0; transition: opacity .15s; }
.pk-insert:hover button, .pk-insert:hover::before, .pk-insert:focus-within button, .pk-insert:focus-within::before { opacity: 1; }
.pk-sheet-back { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, .25); }
.pk-sheet { width: min(620px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; border-radius: 22px; border: 1px solid #e8e8ed; box-shadow: 0 20px 60px rgba(0, 0, 0, .12); padding: 20px; background: #fff; color: #1d1d1f; }
.pk-sheet header { display: flex; align-items: baseline; gap: 12px; }
.pk-sheet header b { font-size: 20px; }
.pk-sheet header span { font-size: 14px; color: #6e6e73; }
.pk-sheet header .pk-ib { margin-left: auto; font-size: 20px; }
.pk-sheet h4 { margin: 18px 0 8px; font-size: 13px; font-weight: 500; color: #6e6e73; }
.pk-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.pk-tile { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border-radius: 14px; border: 1px solid #e8e8ed; background: #fff; font: inherit; font-size: 13px; color: #1d1d1f; cursor: pointer; }
.pk-tile:hover { background: #f5f5f7; }
.pk-tile i { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
.pk-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.pk-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #6e6e73; }
.pk-field input, .pk-field select { height: 40px; padding: 0 12px; border: 1px solid #d2d2d7; border-radius: 10px; font: inherit; font-size: 15px; color: #1d1d1f; background: #fff; }
.pk-price-field { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 120px; gap: 12px; }
.pk-form-error { grid-column: 1 / -1; margin: 0; color: #b42318; font-size: 14px; }
.pk-form-acts { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; }
.pk-form-acts .pk-cta { margin-left: auto; }
.pk-undo { position: fixed; left: 50%; bottom: 24px; z-index: 60; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 14px; background: #1d1d1f; color: #fff; font-size: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, .2); }
.pk-undo button { border: 0; background: none; color: #8fb8ff; font: inherit; font-weight: 600; font-size: 15px; cursor: pointer; }

/* narrow board (ulasim-v3 @620, etkinlik-v4 @560) */
@container panel (max-width: 620px) {
  .pk-mid { grid-template-columns: 1fr 1fr; }
  .pk-route { grid-column: 1 / -1; grid-row: 2; }
  .pk-stop.r { grid-column: 2; grid-row: 1; }
  .pk-stop b { font-size: 24px; }
  .pk-best { display: none; }
  .pk-art { width: 78%; top: 92px; height: 80px; }
  .pk-dl { grid-template-columns: 90px 1fr; }
  .pk-media { grid-template-columns: 1fr; gap: 12px; }
  .pk-vis { width: 100%; height: 168px; }
  .pk-vis svg.pk-sil { width: 140px; height: 116px; }
  .pk-docpill span { display: none; }
  .pk-txt h3 { font-size: 17px; }
  .pk-txt p { font-size: 14px; }
  .pk-sub, .pk-opt { display: none; }
  .pk-foot { gap: 8px; }
  .pk-form { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2:** `npm run build` · commit `"Cards: styles from the approved mockups"`

---

### Task 16: Bağlama: TripPanel, Timeline, konaklamaya çember + belge, ölü kodun silinmesi

**Files:** Modify `src/app/TripPanel.tsx`, `src/app/Timeline.tsx`, `src/app/SwipeCard.tsx`, `src/app/Status.tsx`, `src/app/Progress.tsx`, `src/lib/travelKinds.ts`, `static/app.css`

- [ ] **Step 1: `src/app/Status.tsx`** — `StatusBar`'a isteğe bağlı `ring?: ReactNode`: `{ring ?? <span className="status-mark" aria-hidden>{MARK[standing]}</span>}` (`import type { ReactNode } from "react"`).

- [ ] **Step 2: `src/app/Progress.tsx` `findTarget`** — `card` satırı:

```ts
  const card = target.item
    ? (document.querySelector(`[data-item-id="${CSS.escape(target.item)}"]`) ??
      // An option behind a card's ‹ 1/2 ›: its group's card.
      document.querySelector(`[data-option-ids~="${CSS.escape(target.item)}"]`))
    : null;
```

- [ ] **Step 3: `src/app/TripPanel.tsx`**
  - İmportlar: `import { legModeByItem } from "../lib/cardKinds";`, `import { inheritedDocs } from "../lib/docs";`, `import { deleteItem, restoreItem, type Removed } from "../lib/removal";`, `import { undoSlot } from "../lib/undo";`, `import type { InsertAt } from "../lib/templates";`, `import { AddButton, AddSheet } from "./cards/AddSheet";`, `import { useTripDocs } from "./cards/DocAccess";`, `import { LegCard } from "./cards/LegCard";`, `import { CardEnvContext, NavGroup, PlanCard, type CardEnv } from "./cards/PlanCard";`, `import { SilhouetteDefs } from "./cards/Silhouettes";`, `import { UndoToast } from "./cards/UndoToast";`.
  - `legs` hesaplandıktan sonra:

```tsx
  // --- plan cards: the way chosen per transfer, files, delete with undo, the add sheet ---
  const legModes = useMemo(() => legModeByItem(legs), [legs]);
  const inherited = useMemo(() => inheritedDocs(plan.closed), [plan.closed]);
  const docsFor = useTripDocs(trip.id, inherited);
  const undo = useMemo(() => undoSlot<Removed>(), []);
  const [removed, setRemoved] = useState<Removed | null>(null);
  useEffect(() => undo.subscribe(setRemoved), [undo]);
  // Another trip on screen: the last deletion stays deleted.
  useEffect(() => () => void undo.take(), [trip.id, undo]);
  const [sheet, setSheet] = useState<{ at: InsertAt | null; editing: Item | null } | null>(null);
  const env: CardEnv = {
    tripId: trip.id,
    decisions,
    today,
    legModes,
    docsFor,
    remove: (item) => void deleteItem(item).then((r) => undo.show(r)),
    add: (at) => setSheet({ at, editing: null }),
    edit: (item) => setSheet({ at: null, editing: item }),
    onOpenItem,
    onCompare,
  };
```

  - `card` ve `settled`: konaklama eski karta, gerisi `PlanCard`'a:

```tsx
  const card: CardFor = (item, group, decision, ranked, onCompareGroup) =>
    item.category === "stay" ? (
      <SwipeCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} decisions={decisions} ranked={ranked} onOpen={() => onOpenItem(item)} onCompare={onCompareGroup} />
    ) : (
      <PlanCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} ranked={ranked} onCompare={onCompareGroup} />
    );
  const settled: SettledFor = (item, decision, onChange, changing) =>
    item.category === "stay" ? (
      <SettledCard key={item.id} item={item} decision={decision ?? decisionOf(item)} decisions={decisions} onOpen={() => onOpenItem(item)} onChange={onChange} changing={changing} />
    ) : (
      <PlanCard key={item.id} item={item} group={[item]} decision={decision ?? decisionOf(item)} onChange={onChange} changing={changing} />
    );
  const leg = (l: Leg, opts: { embedded?: boolean; timed?: boolean } = {}) => (
    <LegRow key={l.key} leg={l} tripId={trip.id} onOpenItem={onOpenItem} onRemove={env.remove} embedded={opts.embedded} timed={opts.timed} />
  );
  const legCard = (l: Leg) => <LegCard key={l.key} leg={l} />;
```

  - Dönen JSX'i `<CardEnvContext.Provider value={env}>…</CardEnvContext.Provider>` ile sar; en başa `<SilhouetteDefs />`. `TimelineView`'a `legCard={legCard}` ve `onAdd={env.add}` ver. Zaman çizelgesi boşken (`timeline.entries.length === 0`) görünüm sekmelerinin yerine:

```tsx
      {timeline.entries.length === 0 && (
        <div className="section-head pk-plan-head">
          <span>{L("Gezi planı", "Trip plan")}</span>
          <AddButton onClick={() => env.add(null)} />
        </div>
      )}
```

  - En sona (Provider kapanmadan önce):

```tsx
      {sheet && (
        <AddSheet tripId={trip.id} at={sheet.at} editing={sheet.editing} currency={decisions?.ctx.currency ?? trip.budget?.currency ?? "EUR"} onClose={() => setSheet(null)} />
      )}
      <UndoToast removed={removed} onUndo={() => { const r = undo.take(); if (r) void restoreItem(r); }} />
```

  - `OptionGroupView`: `byRank` ve `rankedOf` tanımlarını `if (decided && !(changing && change))` satırının **üstüne** taşı; hemen ardından (yine o satırın üstünde):

```tsx
  // Not a stay: the options as one card with ‹ 1/2 ›, the pick and the reasons in its details (cards/PlanCard.tsx).
  if (group.category !== "stay") {
    return (
      <NavGroup items={byRank} heading={head} nested={nested} decision={decision} choice={choice} decided={decided ?? null}
        onChange={change} changing={changing} rankedOf={rankedOf} onCompare={comparable || single ? onCompare : undefined} />
    );
  }
```

  (Kalan yol, yani `Headline`, `option-grid`, `+N seçenek daha`, `verdict-line`, artık yalnız konaklamalar için çalışır.)

- [ ] **Step 4: `src/app/Timeline.tsx`**
  - Tipler: `export type LegCardFor = (l: Leg) => ReactNode;` TimelineView prop'larına `legCard: LegCardFor; onAdd: (at: InsertAt | null) => void;`, `render` nesnesine ve `RenderProps`'a ikisini ekle (`import type { InsertAt } from "../lib/templates"; import { insertAt } from "../lib/templates"; import { AddButton, InsertPoint } from "./cards/AddSheet";`).
  - Plan başlığı: `section-head` içinde ikinci span'in ardına `<AddButton onClick={() => onAdd(null)} />`.
  - `Row`: `.tl-content` içinde `<Entry …/>` sonrasına `<InsertPoint at={insertAt(entry)} onAdd={render.onAdd} />`.
  - `Entry` imzası `{ entry, tripId, leg, legCard, renderGroup, card, settled }`; `case "leg": return <>{legCard(entry.leg)}</>;`; `case "travel"` içinde `entry.role === "move" && entry.leg ? <MoveCard leg={entry.leg} tripId={tripId} /> : …` yerine `entry.role === "move" && entry.leg ? legCard(entry.leg) : …`.
  - **Silinenler:** `MoveCard` bileşeni, `MODE_ICONS`, `TICKETED`. Ardından kullanılmayan importları kaldır: `grep -n "withLegChoice\|modesFor\|MODE_LABELS\|flightSearchUrl\|updateTrip" src/app/Timeline.tsx` → yalnız import satırında kalanları sil (`StatusBar`, `Standing`, `removeItem`, `setHidden` kullanılmaya devam eder).

- [ ] **Step 5: `src/app/SwipeCard.tsx` (yalnız konaklamalar)**
  - `import { DocAccess } from "./cards/DocAccess"; import { Ring } from "./cards/CardShell"; import { useCardEnv } from "./cards/PlanCard";`
  - `SwipeCard`: `const env = useCardEnv();`; `.opt-foot` içindeki `<span className="opt-links">` başına `<Ring state={item.status === "booked" ? "done" : item.status === "chosen" ? "half" : "open"} />`, "Detaylar ▾" düğmesinin ardına `<DocAccess item={item} docs={env.docsFor(item.id)} />`.
  - `SettledCard`: `const env = useCardEnv();`; `<StatusBar … ring={<Ring state={booked ? "done" : "half"} />} />`; `.stc-actions` içinde ilk eleman `<DocAccess item={item} docs={env.docsFor(item.id)} />`.
  - **Silinenler:** `if (isSmall(item)) return <SettledRow …/>;` satırı, `SettledRow` bileşeni, `Route` bileşeni, `const route = …` ve `{route ? <Route …/> : <Media …/>}` → `<Media item={item} facts={facts} />`; artık kullanılmayan `clock`, `shortDay`, `metricsOf`, `durationText`, `isSmall` importları (`npm run typecheck` ve `grep -n "clock\|shortDay\|isSmall\|durationText" src/app/SwipeCard.tsx` ile kontrol).
- [ ] **Step 6: `src/lib/travelKinds.ts`** — `isSmall` ve yalnız onun kullandığı `ERRAND` silinir (`grep -rn "isSmall" src tests` boş olmalı).
- [ ] **Step 7: Ölü CSS** — `grep -rn "\"route\|route-\|fare-badge\|move-card\|settled-row\|sr-main\|sr-icon\|sr-text\|sr-price\|sr-chip\|sr-actions" src` boş çıktıktan sonra `static/app.css`'ten şu kuralları sil: `.route`, `.route-top`, `.fare-badge`, `.route-line`, `.route-end*`, `.route-mid*`, `.route-bar*`, `.route-mode`, `.move-card .route`, `.move-card .info-btn`, `.settled-row*`, `.sr-*`, `.settled-row .stc-details`.
- [ ] **Step 8:** `npm run typecheck && npx vitest run && npm run build` → yeşil.
- [ ] **Step 9: Elle kontrol (kısa):** `dist/`'i Chrome'a yükle (README "Kurulum: elle"), "Örnek geziyi yükle", Plan görünümü: uçuş kartı (siluet, ‹ 1/2 ›, Önerim), tren, Douro (medya), eSIM; bir karta dokun → ayrıntı; ••• → Sil → bildirim → Geri al; "+ Ekle". Konaklama kartları eskisi gibi + çember + ataç.
- [ ] **Step 10:** commit `"Plan: new cards for travel, activities, eSIM and insurance; add, delete with undo, files"`

---

### Task 17: e2e ve görsel doğrulama

**Files:** Modify `scripts/e2e.mjs`

Dört eski beklenti grubu yeni seçicilere geçer, yeni bir adım belge/silme/ekleme/dar görünümü doğrular, taslaklar referans olarak çekilir.

- [ ] **Step 1: Uçuş seçenekleri** — `card("Pegasus · direkt").locator(".opt-rank")` ile başlayan üç satırı şununla değiştir:

```js
  // Flights: one card with ‹ 1/2 ›, the pick and its reasons in the details.
  const pk = (name) => app.locator(`.pk-card[aria-label="${name}"]`);
  const pegasus = pk("Pegasus · direkt");
  assert.match(await pegasus.locator(".pk-foot").innerText(), /2 seçenek[\s\S]*1\/2[\s\S]*Önerim[\s\S]*€\d+[\s\S]*Plana seç/);
  await pegasus.locator(".pk-body").click();
  assert.equal(await pegasus.locator(".pk-why.trade").innerText(), "2.'ye göre+€30 · bagaj dahil, direkt, saatleri daha uygun · eksiği: iade yok, ücretli değişiklik");
  await pegasus.locator(".pk-body").click();
  await pegasus.getByRole("button", { name: "Sonraki seçenek" }).click();
  const tap = pk("TAP · Lizbon aktarmalı");
  await tap.locator(".pk-body").click();
  assert.equal(await tap.locator(".pk-badges").innerText(), "En ekonomik");
  await tap.locator(".pk-body").click();
  await tap.getByRole("button", { name: "Önceki seçenek" }).click();
```

- [ ] **Step 2: Douro ve dönüş uçuşu** — `const douro = app.locator(".tl-event .settled-card", …)` satırından `await douro.locator(".stc-main").click();` (ikinci) satırına kadarki bloğu şununla değiştir:

```js
  const douro = app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douro.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  const home = app.locator(".tl-travel.role-departure .pk-card");
  await home.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  // A misclick on "Bileti aldım" can be taken back (in the details), and redone.
  await home.locator(".pk-body").click();
  await home.getByRole("button", { name: "Rezervasyonu geri al" }).click();
  await home.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  await home.getByRole("button", { name: "Bileti aldım" }).click();
  await home.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
  assert.match(await home.locator(".pk-mid").innerText(), /LIS[\s\S]*14 Ekim · 19:40[\s\S]*4 sa 55 dk · direkt[\s\S]*IST[\s\S]*15 Ekim · 01:35/);
  await home.locator(".pk-body").click();
  // Opening a card shows its details on the card.
  await douro.locator(".pk-body").click();
  await douro.locator(".pk-detail").getByRole("button", { name: "Tüm detaylar" }).waitFor();
  await douro.locator(".pk-body").click();
```

- [ ] **Step 3: Pegasus'u seç** — `await card("Pegasus · direkt").getByRole("button", { name: "Seç" }).click();` ve altındaki `.settled-card` satırı:

```js
  await pk("Pegasus · direkt").getByRole("button", { name: "Plana seç" }).click();
  await app.locator(".tl-travel.role-arrival .pk-card", { hasText: "IST" }).locator(".pk-foot").getByText("bilet alınmadı").waitFor();
```

- [ ] **Step 4: Tren "Ele" ve şehir değişimi kartı** — `await card("CP Alfa Pendular …").getByRole("button", { name: "Ele" …` satırından `await move.locator(".status-bar.st-booked", { hasText: "Bilet alındı" }).waitFor();` satırına kadar:

```js
  // "Ele" in the card's menu: it leaves the options and waits under "Elenenler".
  const train = pk("CP Alfa Pendular · Porto → Lizbon");
  await train.getByRole("button", { name: "Kart menüsü" }).click();
  await train.getByRole("menuitem", { name: "Ele" }).click();
  await app.locator(".row-name", { hasText: "Elenenler (1)" }).waitFor();
  const move = app.locator('.pk-leg[aria-label="Porto → Lizbon"]');
  await move.locator(".pk-ring.open").waitFor();
  await move.locator(".pk-foot", { hasText: "Planlanmadı" }).waitFor();
  assert.match(await move.locator(".pk-mid").innerText(), /Porto[\s\S]*Lizbon/);
  await move.locator(".pk-body").click();
  await move.getByRole("button", { name: "✈ Uçak" }).click();
  await move.locator(".pk-ring.half").waitFor();
  await move.locator(".pk-foot").getByText("bilet alınmadı").waitFor();
  assert.equal(
    decodeURIComponent(await move.getByRole("link", { name: "Uçuş ara ↗" }).getAttribute("href")),
    "https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11",
  );
  await move.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await app.screenshot({ path: `${out}/5d-move.png` });
  await move.getByRole("button", { name: "Bileti aldım" }).click();
  await move.locator(".pk-foot .pk-state.done", { hasText: "Alındı" }).waitFor();
```

  Aynı bölümde `await card("Tiyatro").waitFor();` → `await pk("Tiyatro").waitFor();`. Satır 31'deki `".trip-line .tl-day, .trip-line .leg"` beklentisini `".trip-line .tl-day, .trip-line .leg, .trip-line .pk-leg"` yap (başta hiçbir transferin planı yok).

- [ ] **Step 5: Yeni adım (Step 4'ün ekran görüntüsü `5-chosen.png` satırının ardına)**

```js
  // 4b. Plan cards: a file on a card, delete + undo (the file comes back), add from a template, narrow.
  const douroCard = () => app.locator(".tl-event .pk-card", { hasText: "Douro tekne turu" });
  await douroCard().locator("input.pk-file").first().setInputFiles({ name: "bilet.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%e2e\n") });
  const pill = douroCard().locator(".pk-docpill", { hasText: "bilet.pdf" });
  await pill.waitFor();
  const [docTab] = await Promise.all([context.waitForEvent("page"), pill.click()]);
  assert.match(docTab.url(), /^blob:chrome-extension:\/\//);
  await docTab.close();
  await douroCard().getByRole("button", { name: "Kart menüsü" }).click();
  await douroCard().getByRole("menuitem", { name: "Sil" }).click();
  await douroCard().waitFor({ state: "detached" });
  await app.locator(".pk-undo", { hasText: "Douro tekne turu silindi" }).getByRole("button", { name: "Geri al" }).click();
  await douroCard().locator(".pk-docpill", { hasText: "bilet.pdf" }).waitFor();
  await app.getByRole("button", { name: "Ekle", exact: true }).first().click();
  const sheet = app.getByRole("dialog", { name: "Ne eklemek istersin?" });
  await sheet.getByRole("button", { name: "Otobüs", exact: true }).waitFor();
  await app.screenshot({ path: `${out}/4d-add-sheet.png` });
  await sheet.getByRole("button", { name: "Otobüs", exact: true }).click();
  await sheet.getByLabel("Nereden").fill("Lizbon");
  await sheet.getByLabel("Nereye").fill("Lagos");
  await sheet.getByLabel("Tarih").fill("2026-10-13");
  await sheet.getByLabel("Saat").fill("10:00");
  await sheet.getByLabel("Fiyat").fill("18");
  await sheet.getByRole("button", { name: "Kaydet" }).click();
  await sheet.waitFor({ state: "detached" });
  const bus = pk("Otobüs · Lizbon → Lagos");
  await bus.locator(".pk-kind", { hasText: "Otobüs" }).waitFor();
  await bus.locator(".pk-foot", { hasText: "Planlanıyor" }).waitFor();
  // The panel scrolls inside the page, so a tall window shows the whole plan in one picture.
  await app.setViewportSize({ width: 1440, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4b-plan-cards.png` });
  // Below 860 px the board is one column; at 560 px the panel is under 620 px and the narrow card layout applies.
  await app.setViewportSize({ width: 560, height: 2600 });
  await app.locator(".trip-line").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.screenshot({ path: `${out}/4c-plan-cards-narrow.png` });
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways page scroll on a narrow board");
  await app.setViewportSize({ width: 1440, height: 900 });
  // The approved mockups beside the screenshots, for a side-by-side look.
  const ref = await context.newPage();
  for (const name of ["2026-10-05-ulasim-v3", "2026-10-05-etkinlik-v4"]) {
    await ref.goto(pathToFileURL(path.resolve(`docs/mockups/${name}.html`)).href);
    await ref.screenshot({ path: `${out}/ref-${name}.png`, fullPage: true });
  }
  await ref.close();
  console.log("✓ plan cards: a file opens in a tab, delete + undo brings the card and its file back, a bus added from the template, narrow board");
```

  (Pano 860 px altında tek sütuna iner; 560 px pencerede panel 620 px'ten dar olur ve `@container panel (max-width: 620px)` kuralları devreye girer. Panel kendi içinde kaydığı için `fullPage` yerine uzun pencere kullanılır.)

- [ ] **Step 6: Sohbetten gelen plan (akış bölümü)** — `.settled-card[aria-label="Uçuş"]` ve eSIM satırlarını:

```js
  await board.locator('.pk-card[aria-label="Uçuş"]').waitFor();
  await board.getByText("Taksi · Otel → Havalimanı").first().waitFor();
  const esim = board.locator('.pk-card[aria-label="eSIM"]');
  await esim.waitFor();
  await esim.scrollIntoViewIfNeeded();
  await board.screenshot({ path: `${out}/9b-chat-plan.png` });
  await esim.getByRole("button", { name: "Kart menüsü" }).click();
  await esim.getByRole("menuitem", { name: "Sil" }).click();
  await esim.waitFor({ state: "detached" });
  await board.locator(".pk-undo", { hasText: "eSIM silindi" }).getByRole("button", { name: "Geri al" }).click();
  await esim.waitFor();
  await esim.getByRole("button", { name: "Kart menüsü" }).click();
  await esim.getByRole("menuitem", { name: "Sil" }).click();
  await esim.waitFor({ state: "detached" });
```

  Ardındaki `console.log` metninde "a plan removed from the board" → "a plan deleted, undone, deleted".

- [ ] **Step 7:** `npm run build && node scripts/e2e.mjs` (Mac'te Playwright'ın Chrome for Testing'i kendiliğinden bulunur; yoksa `CHROMIUM_PATH=…`) → bütün `✓` satırları; hata çıkarsa seçiciyi gerçek DOM'a göre düzelt, beklenen davranışı değil.
- [ ] **Step 8: Görsel kontrol** — `e2e-output/4b-plan-cards.png`, `4c-plan-cards-narrow.png`, `4d-add-sheet.png`, `5d-move.png`, `9b-chat-plan.png` dosyalarını `ref-2026-10-05-ulasim-v3.png` ve `ref-2026-10-05-etkinlik-v4.png` ile yan yana aç. Kontrol listesi: (1) zemin sarı-bej / yeşil doğru kartlarda; (2) üst satır 24 px, çember üç hâl, tür renkli; (3) uçuş/tren/vapur siluetleri ortada, kenarları solan, noktalar mürekkep rengi; (4) şehir 30 px, saat kalın; (5) medya kartında 176×128 görsel, başlık 20, puan köşede; (6) alt şerit 48 px, sağda fiyat 17 + tek koyu buton; (7) dar görünümde uçlar iki sütun, siluet altta, medya görseli tam genişlik 168; (8) ekleme penceresi üç grup, renkli kutular. Fark varsa `static/app.css`'te düzelt, `npm run build && node scripts/e2e.mjs` yeniden.
- [ ] **Step 9:** commit `"e2e: plan cards (files, delete + undo, add from a template, narrow) and mockup references"`

---

### Task 18: Belgeler: DESIGN.md, README, PLAN.md

**Files:** Modify `DESIGN.md`, `README.md`, `PLAN.md`

- [ ] **Step 1: `DESIGN.md`**
  - "Önce karar" listesinde "Küçük işler (eSIM, taksi, transfer, sigorta) tek satırdır; …" maddesini şununla değiştir: "Plan'da her şey kendi kartı: ulaşım kartı (uçuş, tren, otobüs, minibüs, vapur, taksi·transfer, araç/motosiklet/karavan/bisiklet kiralama) ve medya kartı (etkinlik, eSIM, sigorta, restoran, not). Konaklama kendi karar kartını korur."
  - "Renklerin tek anlamı var" tablosuna satır: `| Tür renkleri (uçuş #6a4fe0, tren #2563c9, otobüs #d9480f, minibüs #e8890c, vapur #0e8fb0, taksi #d29a00, araç #475467, motosiklet #c0256b, karavan #8a6534, bisiklet #5d8a1c, etkinlik #a8336f, eSIM #3b6fd1, sigorta #0f8a6a) | Yalnız hangi tür | Plan kartının üst satırındaki ikon ve ad, siluet çizgisi, ekleme penceresinin kutuları |` ve `| Sarı-bej #fbf6ea / yeşil #eef8f1 zemin | Alınmadı / alındı-planlandı | Plan kartlarının zemini (çember ve alt şerit yazısıyla birlikte) |`.
  - Yeni bölüm "## Plan kartları" (Hero bölümünün ardından): ortak kabuk (zemin, 24 px üst satır: çember · tür · tarih | belge · •••; 48 px alt şerit; durum yazısı yalnız altta), seçenek gezgini (‹ 1/2 ›, "Önerim", gerekçe ayrıntıda), ulaşım gövdesi (30 şehir, saat kalın, ortada noktalı siluet, kiralıkta gün sayısı), medya gövdesi (176×128 görsel, 20 başlık), ayrıntı (kartın içinde beyaz panel, eski karttaki her bilgi), belgeler (yalnız bu bilgisayarda; hap/ataç), "+ Ekle" ve kartların arasındaki "+".
  - "Azaltmak" bölümü: ilk maddeyi "Sayfadan gelen bir seçenek **Ele** ile önden kalkar (Elenenler); transfer **Gerek yok** ile (Gizlenenler / Geri al). **Sil** her kayıt kartının ••• menüsündedir ve kalıcıdır: onay penceresi yok, 8 saniye "Geri al" durur; kayıt belgeleriyle birlikte geri gelir." yap; "Seçili karta dokunmak diğer seçenekleri açar; ayrıntı ⓘ'dadır." maddesini "Konaklamada seçili karta dokunmak diğer seçenekleri açar (ayrıntı ⓘ'da); diğer kartlarda dokunmak ayrıntıyı açar, diğer seçenekler ayrıntıdaki 'Diğer N seçenek'te." yap; "Kaldır" istisna maddesini "Sohbette söylenen ya da elle eklenen plan ••• → Düzenle ile değişir, Sil ile gider." yap.
  - "Yazı" ölçeğine: "Plan kartları: 30 şehir (ulaşım) · 20 başlık (medya) · 15 metin · 13 ikincil · 17 fiyat."
- [ ] **Step 2: `README.md` "Kullanım"** bölümünün sonuna kısa alt başlık "### Plan kartları": kartların zemin/çember anlamı; karta dokununca ayrıntı; ••• → Düzenle / Ele / Sil (8 sn Geri al); ataç ile PDF ya da görsel ekleme (15 MB, yalnız bu bilgisayarda, paylaşılmaz, dışa aktarmada yalnız adı); "+ Ekle" ve kartların arasındaki "+" ile şablondan ekleme. "Geliştirme → Yapı" listesine `src/app/cards/`: plan kartları; `src/lib/cardKinds.ts`, `cardView.ts`, `docs.ts`, `templates.ts` satırları.
- [ ] **Step 3: `PLAN.md`** "## 0.11 uygulama planı…" bölümünün altına "## 0.31: plan kartları (yapıldı)" ve iki satır: spec ve bu plana bağlantı; kapsam dışı kalanlar (Fikirler sekmesi, Günlük akışın yeni dile geçmesi, Google Places fotoğrafları, sohbete PDF sürükleme).
- [ ] **Step 4:** commit `"DESIGN, README, PLAN: plan cards"`

---

### Task 19: Yayın 0.31

**Files:** Modify `static/manifest.json`, `package.json`

- [ ] **Step 1:** `static/manifest.json` `"version": "0.31.0"`, `package.json` `"version": "0.31.0"`.
- [ ] **Step 2:** `npx vitest run && npm run typecheck && npm run build` → hepsi yeşil (beklenen: 293 + yeni testler).
- [ ] **Step 3:** `git add static/manifest.json package.json && git commit -m "Release 0.31.0: plan cards"`
- [ ] **Step 4:** `git push origin devam:claude/blissful-fermi-4zn4h6` (dalın uzak eşi).
- [ ] **Step 5:** `scripts/release.sh` → "released 0.31.0".
- [ ] **Step 6:** Mac güncelleyicisi dakikada bir bakar: 2 dk içinde `grep '"version"' ~/TripRadar/manifest.json` → `"version": "0.31.0"`. Değişmediyse `tail -5 ~/Library/Logs/TripRadar-update.log` (güncelleyicinin günlüğü, `scripts/mac/install.sh`) ve `git ls-remote origin release` ile release commit'inin gittiğini doğrula. Panoda "Yeni sürüm hazır" görünür ya da pano kendini yeniler; açılınca IndexedDB sürüm 4'e geçer (Uygulama → DevTools → Application → IndexedDB → `trip-radar` → `docs` deposu var).

---

## Self-review (spec'e karşı)

| Spec maddesi | Nerede |
| --- | --- |
| Zemin sarı-bej / yeşil; taksi, transfer, metro "Planlandı" olunca yeşil | `ringOf`/`groundOf` (Task 3), `legCardView` (Task 5), CSS `.pk-sand/.pk-green` |
| Üst satır 24 px: çember · tür · tarih[· saat] \| belge · ••• | `CardShell` (Task 12), `topDate` (Task 3), CSS `.pk-top` |
| Çember üç hâl | `Ring`, CSS `.pk-ring.open/half/done` |
| Belge hapı "ad.pdf +N" (dar: ikon + sayı), yoksa soluk ataç | `DocAccess`, CSS `.pk-docpill span` dar görünümde gizli |
| Alt şerit 48 px: durum ya da ‹ 1/2 ›, fiyat + tek eylem; sağ üstte durum hapı yok | `CardFoot`, `footOf`, `NavGroup` |
| Dokununca ayrıntı: saatler, işletme, fiyat kırılımı, neden önerildi, istedikler, artı/eksi, bağlantılar | `CardDetail` (+ `Details` aynen, `operator` satırı Task 9, `TradeLine`, `headline`) |
| ••• Düzenle / Gerek yok / Ele / Sil | `menuFor` + `PlanCard` (Düzenle, Ele, Sil); `LegCard` (Gerek yok, Planı temizle) — karar 5 |
| Yazı 30 / 20 / 15 / 13 / 17 | CSS `.pk-stop b`, `.pk-txt h3`, `.pk-txt p`, `.pk-top`, `.pk-price b` |
| Eylem tablosu (6 satır) + eSIM "Kurdum" `installedAt` | `footOf` testleri (Task 3), `setInstalled` (Task 7) |
| Ulaşım gövdesi, kiralıkta gün sayısı | `transportFace`, `TransportCardBody` — karar 9 |
| 10 tür, renkler, siluetler ve ikonlar birebir | `cardKinds.ts` COLORS, `Silhouettes.tsx` (v3 SCENES ve symbol'ler) — karar 1 |
| Tür tespiti sırası, bilinmeyen gri "Ulaşım" siluetsiz | `transportMode`/`cardKind` testleri (Task 2); `PlanCard` `kind !== "transport"` → siluet yok |
| Medya gövdesi 176×128 (dar 168), başlık + bilgi + kaynak; görsel ya da siluet; puan köşede, önerilende mavi | `mediaFace`, `MediaCardBody`, CSS `.pk-media/.pk-vis/.pk-score.best` |
| eSIM "10 GB · Portekiz", "15 gün", sağlayıcı + site; sigorta "2 kişi · 12 gün", teminat yok, `isInsurance` | `mediaFace` testleri (Task 4), `isInsurance` (Task 1) |
| Renkler etkinlik/eSIM/sigorta | COLORS testi (Task 2) |
| `docs` deposu alanları, yalnız yerel, paylaşıma/dışa aktarıma girmez (adlar listelenir) | `DocRecord`, DB v4, `exportAll` yalnız meta (Task 6); `share/` dokunulmaz |
| Ekleme: ataç ya da "Belge ekle"; PDF/PNG/JPG/HEIC; 15 MB | `DocPickButton`, `checkDoc` testleri |
| Açma: tek → yeni sekme, çok → liste (ad, boyut, aç, sil) | `openDoc`, `DocAccess` listesi, `DocList`; tek belge silme ayrıntıda — karar 14 |
| Kart silinince belgeleri silinir | `deleteItem` (tek işlem), asistan ve gezi silme (Task 7) |
| Sil her kartta, onaysız, 8 sn Geri al, kayıt + belgeler geri | `removal.ts`, `undo.ts`, `UndoToast`; e2e 4b ve sohbet akışı |
| Ele ayrı durur; DESIGN.md kuralı güncellenir | `menuFor` "dismiss"; Task 18 |
| "+ Ekle" başlıkta, iki kart arasında "+"; gruplar; kısa formlar; şehir/tarih önceden dolu | `AddButton`, `InsertPoint`, `insertAt`, `emptyForm`, `AddSheet` — karar 11 |
| Kayıt `plannedItem` yolundan "Planlanıyor"; sonra sayfa kaydedilirse birleşir | `planToSave` + `origin: "chat"` — karar 10; belgeler yerine geçen kartta — karar 13 |
| Konaklama kartı aynı, yalnız çember + belge | Task 16 Step 5 — karar 16 |
| Günlük akış dokunulmaz | `Itinerary`/`ItRow`/`LegRow` aynı; `LegRow` yalnız gövdesini paylaşır |
| Doğrulama: birim (tür, çember/eylem, belge deposu, silme + geri al, şablon); e2e (geniş + dar, kart açma, belge, sil + geri al) | Task 1–9 testleri; Task 17 |

Kontrol edilen boşluklar ve kapatılanlar: tek belgeyi silme (ayrıntıda liste), seçenek gezginindeki görünmeyen seçeneğe yapılacaklardan gitme (`data-option-ids` + `findTarget`), DB yükseltmesinin eski bağlantıda takılması (`blocking`), sohbet planının belgesinin kayıtlı sayfa seçilince kaybolmuş görünmesi (`closed.by` + `inheritedDocs`), boş gezide ekleme düğmesi (`pk-plan-head`), yanlış "Bileti aldım"ın geri alınması (ayrıntıda "Rezervasyonu geri al").
