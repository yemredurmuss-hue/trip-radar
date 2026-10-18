# Plan v46: silme önerileri (Emre onayı bekliyor)

Kaynak: P9b son temizliği (dal `plan-v46-temizlik`). Plan (`2026-10-13-plan-v45-kod-plani.md` F9) bu üç kalemi "Emre onayına bağlı" bıraktı; Emre onaylamadı. **Hiçbiri silinmedi.** Aşağıda her kalem için kod yolu ve "başka kullanım yok" kanıtı var; onay gelirse ayrı bir commit'te silinir.

Kanıtlar `grep -rn` ile `src`, `tests`, `scripts`, `static` üzerinde alındı (dal `plan-v46-temizlik`, P9b temizliğinden sonra).

## 1. Mascot `wink` durumu ve `ms-wink` CSS

- Kod: `src/app/Mascot.tsx:8` `MascotState = "idle" | "wink" | ...`; açıklama yorumu `Mascot.tsx:2`.
- CSS: `static/app.css` `.ms-wrap[data-state="wink"] .eye.r { animation: ms-wink ... }` (satır ~3931) ve `@keyframes ms-wink` (satır ~3937).
- Kullanım yok kanıtı: `grep -n wink -r src static/app.css tests scripts` yalnız bu iki dosyadaki tanım ve yorumu verir. `<Mascot state=...>` kullanıcıları: `Chat.tsx:182` (`mascotFace(...)` döner), `Chat.tsx:191` (`"oops"`), `board/Pano.tsx:246` (`"oops"` / `"sleepy"`), `TripsHome.tsx:450` (varsayılan `idle`). `mascotFace` hiçbir yerde `"wink"` döndürmez.
- Etki: yalnız bir tip üyesi, bir CSS kuralı ve bir keyframe; görünüm değişmez. (Not: CSS seçicisi `data-state` değerine bağlı olduğundan sınıf taramasıyla yakalanmaz, bu yüzden bu temizlikte dokunulmadı.)

## 2. `start/FlightMap.tsx` içinde `FlightMap` ve `WorldFlight` bileşenleri

- Kod: `src/app/start/FlightMap.tsx` `export function FlightMap` (satır 52, `WorldFlight`'ı yükleyen sarmalayıcı) ve `export function WorldFlight` (satır 70-150), onlara bağlı `FlightMapProps`, `MapLabel`, `MAP_WIDE`.
- Kullanım yok kanıtı: dosyayı içe aktaran yerler yalnız `loadWorld` (`StartChat.tsx:42`, `Generating.tsx:23`), `type WorldMap` (`Generating.tsx:23`, `GenMap.tsx:13`) ve `PLANE` (`map/TripMap.tsx:20`) alır. `FlightMap` ve `WorldFlight` ürün kodunda hiçbir yerde çağrılmaz. Tek dış kullanıcı testtir: `tests/startRev3Review.test.ts:10,190` (`WorldFlight`'ı statik işler; `st-map-land` sayısını 3 bekler, satır 195). Silinirse bu test (ya da ilgili `it`) da silinmeli.
- **Kalacaklar:** `loadWorld`, `WorldMap`, `MAP_TIMES` (`GenMap`, `Generating`, `TripMap`), `PLANE` (`TripMap`). Silme bu dört dışındakilerle sınırlı.

## 3. `st-map-*` CSS

- CSS: `static/app.css` ~2776-2795: `.st-map-sea`, `-land`, `-borders`, `-arc`, `-stops`, `-stop`, `-from`, `-to`, `-ring`, `-plane`, `-label`, `-credit`, `@keyframes st-map-ring`, `@media (prefers-reduced-motion)` içindeki `.st-map-ring`.
- Kullanım kanıtı: bu sınıfları yalnız `WorldFlight` (`FlightMap.tsx:65,117-156`) üretir (madde 2). **Kalacaklar:** `.st-map` (`map/TripMap.tsx:553` `generate` kipinde kullanır), `@keyframes st-map-in` (`static/map.css:6` kullanır), `.st-map svg`.
- Madde 2 silinirse bu kurallar da ölür; madde 2 silinmeyecekse bunlar kalmalı.

## Ek: bu turda silinmeyen, şüpheli bulunanlar

- Yalnız testlerden çağrılan dışa aktarımlar (ürün kodunda kullanım yok, testte var): `resetIntake` (`arrive/intake.ts`), `resetPlanRefused` (`start/model.ts`), `planStages` (`lib/categories.ts`), `rowMark`, `dayPhoto`, `groupDays`, `daysLabel` (`lib/dayCards.ts`), `setDisplayCurrency` (`lib/displayCurrency.ts`), `takeDocsOf`, `deleteTripDocs` (`lib/docs.ts`), `bareChatFlight` (`lib/emptyCards.ts`), `countriesOf` (`lib/heroInfo.ts`), `ideaIcon`, `foodLine` (`lib/ideas.ts`), `rowLabel` (`lib/items.ts`), `journeyTitle`, `stepsReady`, `daySummary` (`lib/journey.ts`). Testi olduğu için silinmedi; silinirse testi de gider.
- `tripPlaces`/`groundQuery` (`lib/tripBrief.ts`): `groundQuery`'nin `trip` parametresi okunmuyor ama çağıranlar geçiriyor; imza değişikliği yapılmadı.
