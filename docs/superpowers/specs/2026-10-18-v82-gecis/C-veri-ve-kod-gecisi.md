# C · v82 tasarımı → canlı 0.37.1: veri eşlemesi ve kod geçişi (2026-10-18)

Salt okunur inceleme; hiçbir repo dosyası değişmedi. Canlı kod: `/home/user/trip-radar` @ `9f22bae Sürüm 0.37.1`. Tasarım: `/home/user/wt-v32/docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md` (v77–v82), prototip kaynağı `/home/user/wt-v32/docs/mockups/plan-v82-standart/kaynak/` (z82.py, hero82.py, mk82.js, data71/78x/79x/81x.py). Önceki plan: `2026-10-13-plan-v45-kod-plani.md` (§2.3 DOKUNULMAZ listesi bu raporda da geçerli sayıldı).

## Özet (10 madde)

1. **Şema değişikliği GEREKMEZ.** `DB_VERSION = 5` (`src/lib/db.ts:23`) ve 11 store aynen kalır; yeni store ya da index yok. Önerdiğim hiçbir aşama yeni alan da istemiyor (boşluklar mevcut serbest alanlara, hesaplanan değerlere, `localStorage`/`chrome.storage` önbelleğine yazılıyor). Yeni bir isteğe bağlı TS alanı eklemek gerekse bile IndexedDB JSON sakladığı için sürüm artırmak gerekmez; en küçük aday: `Preference.scope?` (şehir kapsamlı istek için), o da şart değil.
2. **Backend değişikliği GEREKMEZ.** Mozaik kareleri için Places API şart değil: `city-image` fonksiyonu zaten `?q=<herhangi yer adı>` alıyor (Unsplash → Pexels → Wikipedia). İsteğe bağlı iki ek var: uçuşta aktarma yeri (`offers/shape.ts`, v45 FB) ve Places API.
3. **Prototipteki bilginin ~%80'i canlıda hazır ya da türetilebilir.** AI uyum puanı ve sırası, artı/eksi, istek ✓/✕, bagaj, iptal, PNR/onay kodu, belgeler, adres/harita, otele yaz, kim ekledi/beğeni, bütçe dağılımı, hava/kur/priz/saat/vize/dil, "Seni böyle anladım" ve sorusu, yolculuk sırası için veri ve saf fonksiyonlar mevcut.
4. **Gerçekten YOK olanlar** (hepsi istemci tarafında, şemasız çözülür): "En hızlı" rozeti; tek ve ülkeye duyarlı sağlayıcı kaydı (Agoda, tren sağlayıcıları, Trendyol/Hepsiburada); online check-in zamanı ve linki; koltuk/vagon/bagaj kg ayrıştırma; bölge kartının "neden" cümlesi; İlham'da "İçinden yerleri çıkar" akışı; şehir kapsamlı istek; seçeneği olmayan niyet için tahmin (yalnız ≥3 gerçek aday fiyatı varsa türetilebilir; sigortada hiç yok).
5. **Kural çatışmaları (Emre kararı gerekir):** PNR canlıda yalnız uçuş günü görünür (`cardTime.ts:9 PNR_DAYS = 0`, v45 DOKUNULMAZ #4). v81/v82 ise alınmış kartın önünde PNR'yi her zaman gösteriyor. Check-in saati canlıda 2 gün kala görünür (`cardTime.ts:12`). "Önerimiz" yalnız uçuş ve otelde var (`draft.ts:10`). Tahmini fiyatta K3 kuralı geçerli. "?" (bilinmiyor) durumu tasarımda yok. Seçildi'nin rengi değişiyor (kum). Rota şeridi, PlanKey ve "Ekle" kalkıyor. Pano sekme yerine büyük pencere oluyor.
6. **Kritik kod bulgusu:** Gün gün görünümü `PlanEntry` → `PlanCard`/`NeedCard`/`CardShell` ailesini kullanıyor (`src/app/days/DayViews.tsx:16`). v82'de Gün gün çizilmediği için eski kart bileşenleri **silinemez**, iki kart sistemi bir süre yan yana yaşar.
7. **lib katmanı neredeyse dokunulmadan kalır.** Karar motoru, asistan, startTrip, categories, plan, legs, timeline, journey, lifecycle, proscons, needs ve pano değişmez. Küçük kural ayarları: `draft.ts`, `board.ts`, `cardTime.ts`, `prepBuy.ts`, `searchLinks.ts`. Yeni saf dosyalar: `intents.ts`, `providers.ts`, `heroMosaic.ts`, `journeyChapters.ts`, `regionHints.ts` (toplam ~1k satır).
8. **app katmanında başlıca yeniden yazımlar:** hero (TripHero + TripFacts), bölüm içi (SectionTimeline → niyet listesi), StoryView/JourneyCards, Pano. Yaklaşık 4k satır yeni TSX, ~1,5–2k satır yeni CSS. Kalan bileşenler uyarlanır ya da olduğu gibi kalır.
9. **En büyük risk e2e.** `scripts/e2e.mjs` (5.976 satır) sınıf adlarına sıkı bağlı: `.pk-` 194, `.hx` 150, `.cat-` 146, `.ek-` 61, `.pn-` 55, `.ev/.ac-` 43, `.tk-` 34 satır. Yaklaşık 650 satır seçici etkileniyor. Birim testlerinin çoğu (165 dosya) lib'e bağlı olduğundan yeşil kalır.
10. **Aşamalı geçiş, 9 aşama:** her aşamada uygulama çalışır kalır. Bölüm bazında bir anahtar (`V82_SECTIONS`) sayesinde niyet kutuları kategori kategori açılır; uzun ömürlü ikinci bir arayüz bayrağı gerekmez. Toplam ≈ 3 L + 5 M + 1 S–M (v45 ölçeği: S ≤ ½ gün, M 1–2 gün, L 3+ gün).

---

## 1. Görev 1: veri eşlemesi

**Durum anahtarı:**
- **HAZIR:** alan ya da fonksiyon var, doğrudan okunur.
- **TÜRETİLEBİLİR:** mevcut veriden saf bir fonksiyonla çıkar; hangi fonksiyondan çıktığı yazılı.
- **KISMEN:** verinin bir kısmı var.
- **YOK:** veri yok; şemaya dokunmadan nerede tutulacağı Not sütununda.

Satır numaraları 0.37.1 içindir.

### 1.1 Hero (üst özet, v82 mozaik)

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Kapak fotoğrafı + gezi adı + şehirler | `Trip.heroImage` (types.ts:181), `Trip.cityImages` (:225), `photoCredits` (:230); `cityImages.ts:109 findCityPhoto`, yükleme `TripPanel.tsx:374–422`; ana yerler `destinations.ts mainPlaces` | HAZIR | Fotoğraf künyesi ⓘ korunmalı (`creditLine`) |
| 6 kare "yolculuk nasıl olacak" (yer adı + şehir) | `Item.imageUrl` (:512), `name`, `city`; `ideas.ts:50 ideaThumb`; `cityImages.ts:87 proxyQuery` (city-image `?q=` her yer adını arar); `actions.ts:238 setItemPhoto` | TÜRETİLEBİLİR | Yeni saf `mosaicTiles(items, plan)` gerekir: önce rezerve/seçili etkinlik, yapılacak ve otel; farklı şehirlerden; fotoğraflı olanlar. Fotoğrafı yoksa city-image ile çekilip `Item.imageUrl`'e yazılır (alan mevcut). Hiç yoksa şehir fotoğrafı, o da yoksa çizim. Places API şart değil |
| "1–16 Nisan", "16 gün · 178 gün kaldı" | `Trip.confirmedDates`, `items.ts tripDateRange`, `countdown.ts:7/14` | HAZIR | |
| Tarih ipucu: şehir şehir günler | `heroInfo.ts:168 cityRanges` | HAZIR | |
| Kişiler, yüzler, son hareket, "Kimler gidiyor" + davet | `Trip.travellers` (:180), `Travellers.tsx`, `share/activity.ts:13 Action`, `WhoseBadge.tsx usePhotoOf`, `Share.tsx` | HAZIR | Son hareket yalnız paylaşılan gezide var (oylar, kaydedilenler, ayar bildirimleri); paylaşılmamışsa yalnız ad |
| Hazırlık çubuğu "%50 hazır · 7 karar" ve ipucu "3 alındı · 2 seçildi · 7 karar" | `lifecycle.ts:183 heroNumbers`, `categories.ts planStages` | HAZIR | |
| Bütçe "~€6.900 / €8.000" | `progress.ts:353 budgetBar` (booked + chosen + open), `Trip.budget` (:160); tahmini toplam zaten `TripFacts.tsx:193` (`hx-est`) | HAZIR | |
| Bütçe penceresi: Rezerve / Planlanan / Boşta | `TripFacts.tsx:162–167` | HAZIR | |
| Bütçenin kategori dağılımı | `BudgetBar.byCategory`, `expected` (progress.ts:323) | HAZIR | 5 dilim: flight, stay, transport, activity, other |
| "Karar bekleyenler seçilince ~€3.360 eklenir (Osaka oteli ve sigorta tahmini dahil)" | `BudgetBar.open`: yalnız önde gelen seçeneği olan niyetler | KISMEN | Seçeneği olmayan niyetin tahmini yok (K3). Sigorta için kaynak hiç yok, toplama girmemeli. Metin "n niyetin tahmini yok" diyebilir |
| Sıradaki: Kyoto oteli | `progress.ts:314 nextStepShort`, `planList.ts` | HAZIR | |
| Çip: Japonya · 4 şehir | `heroInfo.ts:68 countryNames`, `:132 countryCodesOf` | HAZIR | |
| Çip: hava 6–19°; ipucunda şehir şehir ortalama ve yağışlı gün | `climate.ts:8 CityWeather` (high, low, rainy, days, source), `useWeather.ts` | HAZIR | Aralık = en düşük low – en yüksek high |
| Çip: Yen; ipucunda "1 € ≈ 162 ¥ bugünkü kur" | `currency.ts:9 getRates`, `tripFacts.ts:10 local.rateText`, `heroInfo.ts:113` | HAZIR | |
| Çip: A/B priz; ipucunda "adaptör gerekir" | `countries.ts:3 plugs`, `heroInfo.ts:89 plugFit`, `:97 plugFitText`, `passport.ts` | HAZIR | |
| Çip: +6 saat; ipucunda "Sende 12:00 iken orada 18:00" | `tripFacts.ts:34 utcOffsetHours`, `heroInfo.ts:105 offsetText` | HAZIR | Örnek cümle türetilir |
| Çip: Japonca | `countries.ts CountryInfo.language` | HAZIR | |
| Çip: Vize gerekmiyor + ayrıntı | `visa.ts:14 visaFor` (kind, label, days, link) | HAZIR | |
| Tercihler satırı "Ekonomik · merkeze yakın · yerel yemek +2" ve soru sayısı | `preferences.ts:144 preferenceTags`, `intent.ts:67 pendingSignals` | HAZIR | |
| "Seni böyle anladım" listesi: kapsam (Tüm gezi / Konaklama / Uçuş / Kyoto), kaynak (söylediğin / seçimlerinden), × kaldır | `IntentCard.tsx:32 intentEntries`, `preferences` store (db.ts:11), `Trip.ignoredSignals` / `confirmedSignals` | KISMEN | Gezi ve kategori kapsamı hazır. Şehir kapsamı ("Kyoto") yok; metinden okunabilir (`ideas.ts:62 cityInText`), şema gerekmez |
| AI sorusu Evet / Hayır | `Signal.question`, `IntentCard.tsx:279–281` | HAZIR | |
| "Özeti küçült / aç" ve yapışkan ince şerit | `StickyBar.tsx` (ad, %, sayılar, bütçe, sıradaki) | TÜRETİLEBİLİR | Katlama durumu `localStorage`'da tutulur (kişisel kolaylık) |

### 1.2 Plan başlığı ve kapalı kategori satırı

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| "Plan · Gezinin omurgası · 7 karar bekliyor" | `heroNumbers().open` | HAZIR | |
| Görünüm seçici: Kategoriye göre / Yolculuk sırasıyla / Gün gün | `plan/PlanOrder.tsx` (plan / story / days) | HAZIR | Gün gün olduğu gibi kalır |
| Satır özeti: "4 şehir · 14 gece · 10 fikir", "2 uçuş · gidiş ve dönüş · 5 fikir", "4 yolculuk · tren ve transfer" | `CatSection.entries`, `plan.stayBlocks`, `categories.ts:1035 citiesOfPlan`, `lifecycle.ts:206 nightsSummary` | TÜRETİLEBİLİR | Yeni saf `collectionSummary(section)`. "Fikir" = bölümdeki tüm seçenekler |
| İlerleme çubuğu (koyu yeşil alındı, açık yeşil seçildi) ve "1 alındı · 1 seçildi · 2 karar" | `CatSection.stages`, `categories.ts:772 stageLine`, `:963 sectionProgress` | HAZIR | |
| Mini görseller (en çok 3, üst üste) | Bölüm kayıtlarının `Item.imageUrl` alanı | TÜRETİLEBİLİR | |
| Bütçe: harcanan + "€1.900 ayrıldı" | `progress.ts:343 sectionAllotments`, `Section.tsx spentOf` | HAZIR | |
| Hazırlık satırı "2/6 hazır" | `prep.ts:11 isPrep`, `Item.doneAt` (:591), `PrepList.tsx` | HAZIR | |
| Tek kategori açık, açılan üste kayar | `sectionMeta.ts useSectionOpen` (kişi başına) | TÜRETİLEBİLİR | Akordiyon kuralı eklenir |

### 1.3 Niyet başlığı (her niyet = bir ihtiyaç)

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Niyet adı ("İstanbul → Tokyo", "Tokyo") | `categories.ts:987 Need`, `:60 CatEntry` (need, stage, city, date, nights), `cardView.ts:122 intentOf`, `pano.ts:183 needTitleOf`, `legs.ts:648 legTitle` | HAZIR | |
| Görsel (52 px) | `Item.imageUrl`, kart türünün çizimi (`static/illus`, `cardKind`) | HAZIR | |
| Tek satır bilgi: "IST → HND · 1 Nis", "3 gece · 2–5 Nis" | `Item.flight.from/to`, `dates`; `storyDates.ts:39 rangeText`; `pano.ts:198 needWhenOf` | HAZIR | Gezi geneliyle aynı olan "2 kişi" yazılmaz |
| İstekler: şart (req) / istek (want) | `Trip.requirements` (:192, şart), `wantedAmenities` (:190), not tercihleri (`DecisionContext.preferences`), `cardTicket.ts:109 flightWants`, `NeedCard.tsx:61 useWants` (yalnız konaklama) | TÜRETİLEBİLİR | Uçuş ve konaklamada hazır. Tren, etkinlik ve şehre özel istek kısmen; metinden şehir okunur |
| Durum çipi ve durum çizgisi noktası: Karar bekliyor · Önerimiz · Seçildi · Alındı · Ayarlandı · Aranıyor · Gerek yok | `lifecycle.ts Stage`, `stageWords.ts:8 Look`, `:31 lookWord`, `draft.ts:21 draftOf`, `Item.arranged` (:583), `Trip.hidden` (:219) | HAZIR | Renk token'ları yeni (bkz. 2.5) |
| "Pano n" | Grubun seçenek sayısı, `pano.ts:146 panoGroups` | HAZIR | |
| ⋯ menüsü: Ayrıntı, Gerek yok | `cardView.ts:139 menuFor`, `actions.ts:93 setNotNeeded`, `:74 setNeedNotNeeded`, `:296 hideNights`, `:257 setHidden` | HAZIR | |
| "Gerek yok dedin · Geri al" | `undoables.ts`, `actions.ts:386 undo` | HAZIR | |

### 1.4 Seçenekler: otel, eSIM, sigorta kartı ve uçuş/tren satırı

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Fotoğraf | `Item.imageUrl`, `Offer.photo` | HAZIR | Yoksa çizim |
| Marka çipi (Booking.com rengiyle) | `brands.ts:35 brandOf`, `cardFacts.source` | HAZIR | |
| Puan + yorum ("9,0 · 900 yorum", "★ 4,9") | `Item.rating` (:523), `decision.ts:361 ratingOutOf10`, `offerSource.ts:127 ratingText` | HAZIR | |
| Konum ("Ginza · metroya 2 dk") | `Item.location.area` (:517), `metrics.distanceToCenterKm`, `needs.ts:98 locationText`, ilk kısa artı | TÜRETİLEBİLİR | |
| Gecelik fiyat ve toplam ("3 gece · €639") | `cardFacts.ts:16 price` (perNight), `cardTicket.ts:24 ticketPrices` | HAZIR | |
| İptal çipi "Ücretsiz iptal" (tarihi Ayrıntı'da) | `Item.cancellation` (:522), `cardTime.ts:49 cancelLineOf`, `needs.ts:108 cancellationText` | HAZIR | İstekte "ücretsiz iptal" varsa çip tekrarlanmaz (kural türetilir) |
| eSIM: GB / gün / sınırsız | `metrics.dataGb`, `unlimitedData`, `validityDays` (:122–124) | HAZIR | |
| Kaynak rozeti: ✨ AI · 🔗 senin linkin · S/E ekledi | `Item.addedBy` (:560), `pano.ts:64 isAiOption`, `:67 adderOf`, `:76 saverName`, `SavedFace` | HAZIR | `addedBy` yoksa ve `url` varsa "senin linkin" |
| Etiket: Önerimiz | `GroupDecision.winner`, `draftOf` | HAZIR | |
| Etiket: En ucuz / En iyi puan | `board.ts:66 boardBadges` (pick, fav, cheap, top), `Pano.tsx:444` | HAZIR | |
| **Etiket: En hızlı** | Veri var: `metrics.durationMinutes` (:120), `cardTicket.ts:185 flightLeg` | **YOK** (rozet yok) | `board.ts`'e "fast" eklenir (saf, ~10 satır, `board.test.ts`) |
| Seç | `actions.ts:211 chooseItem` | HAZIR | |
| "4 · ilk 3, tümü Pano'da" | `GroupDecision.options` sırası, `items.ts:368 rankItems` | HAZIR | |
| Havayolu logosu | `FlightTicket.tsx:21` (uçuş numarasından Kiwi/Aviasales logosu), `cardView.ts:181` | HAZIR | |
| Havayolu + uçuş no (TK52) | `Item.flight.carrier`, `flightNumber` (:524–532) | HAZIR | |
| Kalkış ve varış (saat + kod, +1) | `flight.departure/arrival/from/to`; +1 hesabı `cardView.ts` | HAZIR | |
| Süre "11 sa 30" | `metrics.durationMinutes`, `flightLeg`, `cardFacts.ts:84 durationText` | HAZIR | |
| Aktarma "direkt / 1 aktarma · Odawara" | `flight.stops` | KISMEN | Sayı var. Aktarma yeri yok: `Offer.via` yalnız transferde (v45 FB, isteğe bağlı backend ek) |
| Bagaj "1 bagaj dahil / Yalnız el bagajı" | `metrics.checkedBagIncluded` (:121), metinler `needs.ts:166–169` | HAZIR | "2 × 23 kg" yok; serbest metin `optionDetail` (:510; örnek `demo.ts:138`) |
| Tren: operatör logosu (JR), hizmet adı (Nozomi), "JR · Shinkansen" | `Item.provider` (:508), `name`, `brands.ts` JR | TÜRETİLEBİLİR | v81 adlandırma kuralı adın ayrıştırılmasıyla uygulanır |
| Seçenek artıları ("Rail Pass geçer", "En hızlı, 2 sa 15") | `proscons.ts:417 prosCons`, `:527 cardLines`, `Item.highlights` / `concerns` (:536–537) | HAZIR | Veri varsa |

### 1.5 Seçili / Önerimiz / Alındı (erişim modu) / Ayarlandı

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Büyük fiyat + kişi başı / toplam | `ticketPrices`, `cardFacts.price.each` | HAZIR | |
| "Booking.com'da rezerve et ↗" / "THY'de bilet al ↗" | `Item.url` + `affiliate.ts:63 partnerUrl`, `brandOf` | HAZIR | Etiket kalıbı marka adından türetilir |
| ✓ Aldım · Değiştir (yerinde) | `actions.ts:31 setItemStatus`, `BackFace.tsx`, "Değiştir N" (P3) | HAZIR | Markup yeni |
| "Bunu seç" (Önerimiz onayı) | `draftOf` + `chooseItem` (P7, e2e Part 6b) | KISMEN | Yalnız uçuş ve otel (`draft.ts:10 DRAFTED`). v79 her niyet için istiyor; tren ve eSIM'e genişletmek 1 satır + `draft.test.ts` (karar gerekir) |
| İstek uyumu ✓ / ✕ (en çok 2 çip) | `needs.ts:205 checkNeeds` → `NeedCheck.state` yes/no/unknown, `:255 NEED_MARK` | HAZIR | Canlıda "?" de var; tasarım yalnız ✓/✕ çiziyor. "?" kalmalı (DESIGN.md) |
| Ayrıntı (seçiliyken): artılar, eksiler, iptal | `prosCons`, `cardLines`, `cardFacts.ts:442 cardDetails`, `CardDetail.tsx`, `InfoButton.tsx FactsBox` | HAZIR | |
| **AI uyum puanı n/100 · n. sırada** | `decision.ts:1013 OptionResult.score` (0–100), sıralı `GroupDecision.options`, `Analysis.aiScores` (types.ts:892; "ai" kriteri `decision.ts:640`). "Uyum puanı n/100 · n. sırada" bugün `CardDetail.tsx:41` ve `ItemDrawer.tsx:67`'de yazıyor | HAZIR | Puan karar motorunun; AI analizi yalnız bir kriter. "AI uyum puanı" adı yanıltıcı olabilir (etiket kararı) |
| "Rezerve edildi · Booking.com" + ad | `status` = booked, provider / brand | HAZIR | |
| Giriş / çıkış saati | `Item.dates`; `Listing.house.checkInFrom` / `checkOutUntil` (types.ts:868 / 872); `cardTime.ts:68 checkInTimeOf`, `:79 checkInNote` | HAZIR (veri) | **Kural çatışması:** canlıda saat yalnız 2 gün kala görünür (`CHECKIN_DAYS`, cardTime.ts:12); v82'de her zaman |
| Adres + "Haritada aç ↗" | `Item.location.address`, `geo`; `items.ts:463 placeMapUrl`; `BookingSheet.tsx:99` | HAZIR | |
| "Otele yaz ↗" | `Item.host` (:587), `cardTicket.ts:170 safeContactUrl`, `BookingSheet.tsx:108` | HAZIR | Bağlantı yoksa düğme yok (uydurma yok) |
| **Onay kodu / PNR + kopyala** | `Item.bookingRef` (:564), `bookingRows.ts:12 refFromNote`, `:29 bookingCopies`, `CopyButton.tsx`; gösterim `cardTime.ts:9 PNR_DAYS = 0`, `:30 showBookingRef` | HAZIR (veri) | **Kural çatışması:** canlıda PNR yalnız uçuş günü (v45 DOKUNULMAZ #4). v81 "alındı = erişim modu" ile kartın önünde her zaman. Tek sabit + `cardTime.test.ts`, `ticketStub.test.ts`, `cardPeek.test.ts` |
| Belge: "Onay e-postası aç", "E-bilet aç", "Klook bileti aç", eSIM QR | `DocRecord` (types.ts:919, kind :911), `docs.ts:117 listDocMeta`, `:122 getDoc`, `DocAccess.tsx useTripDocs`, `docs.ts:15 needsDoc` | HAZIR | |
| Kesikli "Belgeyi ekle" | `docs.ts:36 addDoc`, `DOC_ACCEPT` (:19; pdf, png, jpg), `docReader.ts:441 readDocument` (okur, kaydı doldurur) | HAZIR | .eml kabul edilmiyor; e-posta PDF ya da ekran görüntüsü olarak eklenir |
| **"Check-in 15 Nis 11:00'de açılır" + "Check-in yap ↗"** | Yok. `flightData.ts:156 flightTiles` yalnız uçuş günü kontuar ve kapı bilgisi verir | **YOK** | Ya havayolu başına online check-in penceresi ve URL'si için statik saf tablo eklenir (bilinmeyen havayolunda gösterilmez, K3), ya da hiç gösterilmez |
| **Koltuk "34A · 34B", vagon "7 · 12A", bagaj "2 × 23 kg"** | `DocFactsSchema` (docReader.ts:34) bunları okumuyor | **YOK** | İsteğe bağlı: şemaya seat/baggage eklenir, okunan değer mevcut serbest alanlara yazılır (`Item.when` :585, `optionDetail` :510). Yeni alan gerekmez |
| Terminal "KIX T1", canlı durum | `FlightLive` (types.ts:608, flightData.ts) | HAZIR | Yalnız uçuş günü; rötar karoları bilette kalmalı (DOKUNULMAZ #4) |
| "€900 ödendi" (Ayrıntı'da) | Fiyat + `status` booked | HAZIR | |
| Etkinlik: tarih-saat, buluşma yeri, kod, "Klook bileti aç", harita | `dates`, `UserEdits.time`, `location.address`, `bookingRef`, event türünde `DocRecord`, `placeMapUrl` | HAZIR | |
| "İptal ettim", "Düzenle" | `actions.ts:50 cancelBooking`, `InlineEdit.tsx` | HAZIR | |
| Ayarlandı: "Otelin servisi · HND → Hyatt", "Sen hallettin", Fiyat ekle, Değiştir | `Item.arranged` + `noBooking`, `Trip.legs` → `LegChoice` (types.ts:394), `actions.ts:109 setArranged`, `:129 addArrangedLike`, `:168 addArrangedPlanned`, `legs.ts:70 Leg` | HAZIR | |

### 1.6 Boş durum (Aranıyor)

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| "Henüz seçenek yok" · "Osaka'da 4 gece için nerede kalınır" | `plan.stayBlocks` (kind open), `EmptyCard.tsx:490 EmptyStayBlock`, `emptyCards.ts` | HAZIR | |
| Tahmini fiyat "€90–160 / gece" | `estRange.ts:37 estimatedRange` (≥3 gerçek fiyatlı seçenek, :9) | KISMEN | Seçenek yoksa canlıda tahmin yok. offers fonksiyonunun adayları (`offerSources/index.ts:24 StayCandidate.nightly` / `priceRange`, `:186 stayCandidates`) ≥3 fiyat verirse aralık türetilebilir; vermezse yazılmaz (K3) |
| Bölge çipleri (Namba / Umeda / Shin-Osaka: neden, ~fiyat, "Booking'de ara") | `StayCandidate.area`, `nightly`, `geo` | KISMEN | Bölge adı ve medyan fiyat adaylardan türetilir (yeni saf `regionHints.ts`). "Neden" cümlesi yok: ya mevcut AI geçidiyle tek kısa istem, ya da hiç yazılmaz. Önbellek offers kv'si / `chrome.storage`, şema yok |
| "Kendin ara" simgeleri | `searchLinks.ts:303 needSearchLinks`, `:185 stayLinks`, `:161 flightLinks`, `:238 activityLinks`, `:290 esimLinks`, `:285 insuranceLinks`, `:222 transferLinks`, `EmptyCard.tsx:51 SearchRow` | HAZIR (statik) | Dinamik seçim için bkz. 1.10 |
| "AI'dan öner" | `AskButton.tsx` (`env.ask` → sohbet), `offerSources/index.ts:183 findOffers`, `OfferRow.tsx` | HAZIR | |
| Sigorta: "Japonya · zorunlu değil, önerilir" | `suggestions.ts:149 ruleSuggestions` ("rule:insurance" why), `EmptyInsuranceCard` (EmptyCard.tsx:681) | HAZIR | |
| Sigorta "tahmini €25–45" | Yok | **YOK** | Kaynak yok; K3 gereği gösterilmemeli (v82 uydurma paketleri zaten kaldırdı) |

### 1.7 Etkinlik ve Yapılacaklar

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Şehir başına niyet; "Planında (n)" ve "Öneriler" sıraları | `categories.ts:1055 eventsByCity`, `EVENT_RANK`, `ActivityBoard.tsx` | HAZIR | |
| Öneri kartı + "+ Plana koy" | `Trip.suggestions` (:249; ai / rule / chat), `findOffers` (activity), `actions.ts:328 addSuggested`, `chooseItem` | HAZIR | |
| Kart: görsel, marka, ad, tarih · kişi başı fiyat | `imageUrl`, `brandOf`, `dates`, `ticketPrices` | HAZIR | |
| Alındı: "Bilet alındı" şeridi + kod + "Bileti aç" | `status` booked, `bookingRef`, `DocRecord` | HAZIR | |
| × Plandan çıkar | `setItemStatus` saved / `removal.ts` | HAZIR | |
| Gezilecek / Restoran etiketi | `category` food, `ideaKind` (:595), `ideaKinds.ts` | HAZIR | |
| "Gün ver ›" | `ideas.ts:146 dayChoices`, `ideas/DayPicker.tsx` | HAZIR | |
| Boş yuvalar ("Henüz plana koymadın"), "+n Pano'da" | Sayımlar | TÜRETİLEBİLİR | |

### 1.8 Hazırlık, Belgeler ve internet

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Satır: ad + neden ("Kyoto'da 7–8 Nisan yağmur bekleniyor") | `Item.name`, `Item.summary` (`PrepList.tsx` zaten gösteriyor) | HAZIR | Neden, AI'ın yazdığı summary'den gelir |
| Alışveriş: Amazon / Trendyol / Hepsiburada / gidilen ülkenin Amazon'u | `prepBuy.ts:19 amazonLink` (dil tr ise amazon.com.tr, değilse .com) | KISMEN | Yalnız Amazon, seçim dile göre. Trendyol/Hepsiburada ve pasaport/ülke kuralı yok → sağlayıcı kaydına. İkisi Travelpayouts ortağı değil (affiliate.ts:23) |
| "Resmî site ↗" (JR Pass, Visit Japan Web) | `Item.url` | HAZIR | Bağlantı varsa |
| "Hazırları gizle", "Daha fazla öner" | `PrepList.tsx` | HAZIR | "Orada yapılacak" düğmesi v80'de kalktı |
| Vize satırı | `plan/VisaRow.tsx`, `Trip.visaDone` (:221) | HAZIR | |

### 1.9 Yolculuk sırasıyla

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Bölümler: Yola çıkmadan · İstanbul → Tokyo · şehirler · Osaka → İstanbul | `journey.ts:554 journeyFlow` (FlowNode), `timeline.ts:87 TimelineSection`, `:165 buildTimeline` | KISMEN | Yol ve şehir bölümleri hazır. "Yola çıkmadan" (Hazırlık, eSIM, sigorta) journeyFlow'da yok; prep ve other bölümlerinden türetilir (yeni saf `journeyChapters.ts`) |
| Şehir bölümü: görsel + ad + tarih/gece + "n hazır · n karar" | `Trip.cityImages`, şehir bölümünün range/nights alanları, `journey.ts:254 stepsReady` | TÜRETİLEBİLİR | |
| Adım: tarih ("esnek"), durum noktası, tür · durum, ad, kısa bilgi, tek eylem | FlowNode + stage/look + `cardView.ts:67 footOf` (choose / book / install / restore) | HAZIR | |
| "Tokyo için 3 etkinlik önerisi › Önerilere bak" | Öneriler / teklifler + `eventsByCity` (fikir sırası) | TÜRETİLEBİLİR | |

### 1.10 Pano, İlham, sağlayıcılar

| Tasarımdaki bilgi | Canlıda kaynak | Durum | Not |
|---|---|---|---|
| Kenar menü: Tümü · Biriktirdiklerim · AI önerileri · İlham (sayılarla) | `pano.ts:43 panoEntries`, `:64 isAiOption`, `:70 savedByMe`, inspo bölümü | HAZIR | |
| İhtiyaçlar ağacı (kategori > niyet, durum noktası, sayı) | `PanoEntry.section/group`, `panoGroups`, `Need.stage` | HAZIR | |
| Kart (220 px ızgara): görsel, kaynak, marka, ad, alt satır, fiyat, puan, beğeni, Seç | `PanoEntry.score`, `pano.ts:88 likersOf`, `cardFacts` | HAZIR | |
| Karşılaştırma sütunu: ✓/✕, artı \| eksi, puan / iptal / bagaj, beğeni, kaynak ↗, Seç; puana göre sıra | `GroupDecision.options`, `checkNeeds`, `cardLines`, `CompareView.tsx` | HAZIR | |
| "Şu an seçili / Alındı" | `PanoEntry.inPlan` | HAZIR | |
| Beğeni ♥ + avatarlar, kim ekledi | `Item.likedBy` (:562), `actions.ts:62 toggleLike`; paylaşılan gezide `share/votes.ts` (Süper) + `pano withLoves`; `addedBy` | HAZIR | DOKUNULMAZ #14: paylaşılan gezide kalp = Süper oyu |
| İlham kartı: platform rozeti, oynat / oku, başlık, şehir, kim ekledi | `inspo.ts:8/11 inspoPlatform`, `:29 INSPO_LABEL`, `:32 isInspiration`; `imageUrl`, `name`, `city`, `addedBy` | HAZIR | |
| İlham süresi "0:48", "8 dk okuma" | `Capture.meta` (og:* , types.ts:414), `Capture.pageText` (:410) | TÜRETİLEBİLİR (kısmen) | Video süresi yalnız og etiketi varsa; okuma süresi kelime sayısından. Yoksa yazılmaz |
| **"✨ İçinden yerleri çıkar"** | Kaydın `pageText` / `meta` (og:description); asistan araçları `search_page`, `suggest`, `plan_item` (assistant.ts) | **YOK** (akış) | En küçük çözüm: `env.ask` ile hazır sohbet istemi (S). Sonuç öneri ya da kayıt olarak yazılır; şema ve backend yok. Hangi niyete düşeceği açık soru |
| "Daha fazla seçenek · AI'dan öner" yer tutucusu | `AskButton`, `findOffers` | HAZIR | |
| **Dinamik sağlayıcı kaydı** `{id, ad, logo, renk, kategoriler, ülkeler, aramaUrl, ortaklık}` | Üç ayrı statik liste: `brands.ts:11` (etiket + renk), `searchLinks.ts:58/80` (Brand + harf işareti + URL kurucular), `affiliate.ts:23` (Travelpayouts kimlikleri) | **YOK** (tek kayıt ve ülke kuralı) | Yeni `src/lib/providers.ts` üçünü sarar; ilk aşamada eskileri silmez |
| Seçim sırası: (1) kullanıcının linkinin kaynağı, (2) gidilen ülke ve ev ülkesi, (3) kategori varsayılanı | `Item.url` host (`url.ts parseUrl`), `Item.countryCode`, `passport.ts loadPassport` / `loadHome` | TÜRETİLEBİLİR | |
| Agoda (Asya'da öne), JR / Rome2rio / Trenitalia / SNCF / Renfe, Klook (Asya), Google Uçuşlar | searchLinks'te Agoda araması yok, tren araması yok, etkinlik sağlayıcılarının sırası sabit | **YOK** | URL şablonları eklenir, saf. `searchLinks.test.ts`, `needSearchLinks.test.ts` |

### 1.11 YOK olanlar: şemaya dokunmadan nerede tutulur

| Eksik | Önerilen yer (şemasız) | Büyüklük |
|---|---|---|
| En hızlı rozeti | `board.ts boardBadges` + "fast" (hesaplanır, saklanmaz) | S |
| Sağlayıcı kaydı ve ülke kuralı | `lib/providers.ts` (kod içinde sabit veri) | S–M |
| Trendyol / Hepsiburada / ülke Amazon'u | `providers.ts` + `prepBuy.ts`; ev ülkesi `passport.ts`'den | S |
| Online check-in zamanı ve linki | Statik havayolu tablosu, ya da hiç gösterme (K3) | S |
| Koltuk / vagon / bagaj kg | `DocFactsSchema` + `Item.when` / `optionDetail` serbest metni | S (isteğe bağlı) |
| Şehir kapsamlı istek | Tercih metninden `cityInText` ile okunur. Gerekirse en küçük ek `Preference.scope?: {city?, category?}` (isteğe bağlı alan, keyPath ve index aynı, DB_VERSION değişmez) | S |
| Bölge kartı ve boş niyet tahmini | `stayCandidates` adaylarından hesaplanır; önbellek offers kv'si (chrome.storage) | M |
| İlham'dan yer çıkarma | Sohbet istemi; sonuç `Trip.suggestions` ya da yeni Item (mevcut store) | S |
| Mozaik fotoğrafları | `Item.imageUrl` (`setItemPhoto`); şehir için `Trip.cityImages` | S |
| Hero katlama, Pano'da son seçim | `localStorage` (kişisel kolaylık; okuma/yazma try/catch içinde) | S |

### 1.12 Canlı kurallarla çatışmalar (kodlamadan önce Emre kararı)

1. **PNR her zaman mı?** Canlıda PNR yalnız uçuş günü görünür (`cardTime.ts:9`, v45 DOKUNULMAZ #4). v81/v82'de alınmış kartın önünde kod + kopyala var. Öneri: v82'ye uy (PNR_DAYS = sonsuz). Etkilenen testler: cardTime, ticketStub, cardPeek, bookingRows.
2. **Giriş saati her zaman mı?** Canlıda 2 gün kala (`CHECKIN_DAYS`). v82'de her zaman. Aynı türden tek sabit.
3. **"Önerimiz" kapsamı.** Canlıda yalnız uçuş ve otel; v79 "her niyette AI seçer" diyor. Öneri: tren ve eSIM'e genişlet, transfer ve sigortaya genişletme (sigortada gerçek seçenek yok).
4. **Tahmin (K3).** Boş niyette tahmin yalnız ≥3 gerçek aday fiyatıyla; sigortada tahmin yok. Bütçe metni buna göre yazılır.
5. **✓ / ✕ / ?** Tasarım yalnız ✓ ve ✕ çiziyor; canlıdaki "?" (sayfa söylemiyor) korunmalı (DESIGN.md "İstediklerin").
6. **"AI uyum puanı" etiketi.** Puan karar motorunun; AI analizi bir kriter. Öneri: "Uyum puanı" kalsın, ⓘ'de "AI analizi dahil" yazsın.
7. **Renk dili.** v82: kesik = karar, kum = seçildi, mor = önerimiz, yeşil = alındı, gri = ayarlandı. Niyet kutusunun zemini durumun açık rengi. v41/v46 "yeşil zemin yalnız alınmışta, Seçildi beyaz" kuralıyla kısmen çatışıyor; DESIGN.md güncellenmeli.
8. **Kalkanlar.** Rota şeridi (`plan/TripShape.tsx`), PlanKey (durum anahtarı) ve üstteki "Ekle" kalkıyor. Ekleme bölüm içindeki "+ Uçuş ekle" düğmesine taşınıyor (z82 `q-add`). Rota şeridi bugün bölüme gitme kısayolu (`onStop`); bu kayıp bilinçli olmalı.
9. **Pano.** Sekme yerine büyük pencere (dialog). Plan/Pano sekmesi kalır, ama artık pencereyi açar.

---

## 2. Görev 2: kod geçişi

### 2.1 Şema kararı (net)

**IndexedDB şeması değişmez.** `DB_VERSION = 5` ve `upgrade()` dokunulmaz. Gerekçe:
- Tasarımdaki her bilgi mevcut 11 store'un (trips, items, docs, captures, messages, preferences, analyses, listings, geocache, trash, trashData) alanlarından okunuyor ya da hesaplanıyor.
- Pano, niyet ve yolculuk görünümleri bellekte `listItems(tripId)` üstünde çalışır; yeni index gerekmez.
- Paylaşılan ayarlar (`share/settings.ts SYNCED_FIELDS`) değişmez.

Yeni TS alanı önerilmiyor. Zorunlu olursa en küçüğü `Preference.scope?` (isteğe bağlı, index'siz, sürüm artırmaz). Okuyucular alanın yokluğuna dayanıklı olmalı; `tests/dbUpgrade.test.ts` aynen geçer.

### 2.2 Backend (`supabase/*`, ~2,9k satır)

| Dosya / grup | Sınıf | Not |
|---|---|---|
| `functions/ai` (ai-gateway), `ai-admin`, `ai-gateway.sql` | (c) dokunulmaz | "Neden" cümlesi ya da yer çıkarma gerekirse mevcut geçitten tek istem |
| `functions/offers` (offers-cache, `offers-cache.sql`) | (c) | Bölge ve tahmin istemcide `candidates`'tan. İsteğe bağlı: uçuşta `via` (v45 FB, S) |
| `functions/flight` (flight-cache) | (c) | Canlı uçuş karoları aynen |
| `functions/web-search` (`web_search*.sql`) | (c) | |
| `functions/city-image` (`city_image_*.sql`) | (c) | `?q=` yer adları için de çalışır (mozaik). Places API yalnız Emre isterse (yeni anahtar, maliyet, politika; M) |
| `profiles.sql`, `history.sql`, `schema.sql` | (c) | |

Sonuç: zorunlu backend işi yok.

### 2.3 lib katmanı (`src/lib`, ~39,6k satır)

| Grup | Satır | Sınıf | Not / risk |
|---|---|---|---|
| Karar ve asistan: `decision.ts` 1731, `assistant.ts` 2825, `analysis.ts`, `choice.ts`, `value.ts`, `reason.ts`, `pivots.ts`, `llm/*` | ~6,5k | (c) | Yer çıkarma sohbet istemiyle yapılırsa asistana dokunulmaz |
| Başlangıç: `startTrip.ts` 3467, `startCreate`, `startEvents`, `startCircuits`, `startDrafts`, `startHooks`, `startMap`, `startEventDates`, `startBoard`, `playbooks/*` | ~6k | (c) | |
| Plan modeli: `categories.ts` 1068, `plan.ts` 868, `legs.ts` 707, `timeline.ts` 536, `journey.ts` 602, `lifecycle.ts`, `stageWords.ts`, `planList.ts`, `planned.ts`, `tripShape.ts` | ~5k | (c) | Niyet görünüm modeli bunların üstüne kurulur |
| Kart görünüm modeli: `cardFacts` 459, `cardView` 415, `cardTicket`, `cardPeek`, `cardKinds`, `cardWhy`, `bookingRows`, `proscons` 540, `needs` 255, `intent`, `preferences`, `progress` 385, `board`, `pano` 320, `estRange`, `stayPicks`, `emptyCards`, `suggestions` | ~5k | (c), küçük (b) | (b): `board.ts` "fast" rozeti; `cardTime.ts` PNR/check-in sabitleri (karara bağlı); `draft.ts:10 DRAFTED` |
| Bilgi: `climate`, `currency`, `heroInfo`, `tripFacts`, `visa`, `countries`, `passport`, `countdown`, `cityImages`, `destinations`, `heroText`, `tripStyle` | ~1,8k | (c) | |
| Sağlayıcılar: `searchLinks.ts` 313, `brands.ts` 42, `affiliate.ts` 99, `prepBuy.ts` 28, `offerSource(s)` | ~0,9k | (b) | Agoda + tren aramaları, ülkeye göre sıra, Trendyol/Hepsiburada. Testler: `searchLinks`, `needSearchLinks`, `brands`, `affiliate`, `prepBuy` |
| Belgeler: `docs.ts`, `docReader.ts` | ~0,65k | (c); isteğe bağlı (b) | Koltuk/bagaj okumak için `DocFactsSchema` (+ `docReader.test.ts`) |
| Paylaşım `share/*`, `db.ts`, `types.ts`, `trash`, `undo*`, `history`, `i18n*` | ~3k | (c) | Şema yok |
| **Yeni** `intents.ts` | ~450 | (a) | Saf görünüm modeli: bölüm ve girdilerden `IntentVM` (başlık, satır, istekler, look, seçenekler: puan, sıra, etiket, bagaj, iptal, ✓/✕, artı/eksi, ekleyen, beğeni; seçili; erişim: kod, ne zaman, nerede, belge, linkler; boş: tahmin, bölge, sağlayıcı) ve `collectionSummary` |
| **Yeni** `providers.ts` | ~250 | (a) | Kayıt + `pickProviders(kind, {linkHost, country, home})` |
| **Yeni** `heroMosaic.ts`, `journeyChapters.ts`, `regionHints.ts` | ~80 + 150 + 100 | (a) | Saf, testli |

### 2.4 app katmanı (`src/app`, ~24,8k satır)

**(a) Baştan yazılmalı.** Yapı ya da markup yeni; mantık lib'den ve atomlardan gelir.

| Dosya | Satır | Yerine | Risk |
|---|---|---|---|
| `TripHero.tsx` | 312 | HeroMosaic + HeroStrip | e2e `.hx` 150 satır; sihirli açılışın `data-pit` işaretleri ve sayaçları korunmalı |
| `TripFacts.tsx` | 280 | FactChips + BudgetPopover (bütçe mantığı taşınır) | `.hx-` seçicileri |
| `plan/SectionTimeline.tsx` | 127 | IntentList (bölüm bazında anahtar; geçişte eskisi durur) | `.cat-`, `.pk-` |
| `plan/StoryView.tsx` + `plan/JourneyCards.tsx` | 95 + 230 | JourneyView + TimelineRail + StepCard | Düşük (e2e'de `.jf-` 0 satır); `journeyFlow.test.ts` aynen |
| `board/Pano.tsx` | 605 | PanoSheet + PanoSidebar + PanoGrid + CompareColumns + IlhamGrid | `.pn-` 55 satır; `pano.test.ts` (lib) aynen |

**(b) Uyarlanmalı.** Yapı kalır, görünüm veya akış değişir.

| Dosya | Satır | Değişiklik |
|---|---|---|
| `TripPanel.tsx` | 1168 | Hero props; Pano'yu pencere olarak açma (`openPano({section, need})`); bölüm anahtarı; görünüm seçici; PlanKey ve AddButton'ın kalkması |
| `plan/CategoryPlan.tsx` | 181 | "Plan" başlığı ve alt satırı; TripShape ve PlanKey'in kalkması; bölüm anahtarı (`V82_SECTIONS`) |
| `plan/Section.tsx` | 196 | CollectionRow (5 sütun), tek açık akordiyon. Test: `farkListeler.test.ts` |
| `plan/sectionMeta.ts` | 100 | Akordiyon kuralı. Testler: `farkListeler`, `suggestions` |
| `plan/PlanOrder.tsx` | 38 | Bölümlü düğme grubu |
| `plan/ActivityBoard.tsx` | 552 | İki sabit sıra (Planında / Öneriler, 224 px kart, 4 sütun), boş yuvalar, "+n Pano'da". Test: `actsV30.test.ts` |
| `ideas/IdeaTiles.tsx`, `ideas/IdeaList.tsx` | 252 + 177 | Yapılacak kartları aynı kalıba; İlham ızgarası Pano'ya taşınır |
| `plan/PrepList.tsx` | 84 | Kapalı satır + sağlayıcı düğmeleri; "Orada yapılacak" kalkar |
| `plan/VisaRow.tsx` | 34 | Görünüm |
| `StickyBar.tsx` | 104 | İnce şerit içeriği (ad, %hazır, toplam/bütçe, Sıradaki) |
| `IntentCard.tsx` (Preferences) | 289 | PrefsPopover içine taşınır. Test: `preferences.test.ts` |
| `Travellers.tsx` | 290 | WhoPopover içinde aynen kullanılır |
| `cards/BookingSheet.tsx`, `DocAccess.tsx`, `CardDetail.tsx`, `InfoButton.tsx` | 164 + 147 + 90 + 50 | Ayrıntı açılır kartı ve erişim yan sütunu bunları kullanır |
| `cards/EmptyCard.tsx` | 725 | `SearchRow`, `EmptyEsim/InsuranceCard` mantığı ve boş-blok kararları niyetin boş haline taşınır; Plan'da çağrılmaz, Gün gün için kalır |
| `cards/OfferRow.tsx` | 352 | AI teklifleri niyetin seçeneklerine dönüşür. Test: `offerSource.test.tsx` |
| `CompareView.tsx` | 457 | Öncelik ayarı ve AI kararı kalır ("Ayrıntılı karşılaştır"); sütunlar Pano'ya geçer |

**(c) Dokunulmadan kalır.**
- Gün gün: `days/*` (931). Eski kart ailesi Gün gün için kalır: `cards/PlanCard` 476, `CardShell` 356, `NeedCard` 250, `FlightTicket` 129, `MediaCard` 180, `TransportCard` 85, `RideCard` 95, `LegCard` 68, `BackFace` 467, `parts` 276, `Silhouettes` 256, `plan/PlanEntry` 180.
- Diğer ekranlar: `map/*` 722, `start/*` 2191, `arrive/*` 828, `docs/DocsTab`, `Chat.tsx`, `ChatOffers`, `Settings`, `Profile`, `Share`, `ShareSafety`, `HistoryDialog`, `TripsHome` 555, `PrintPlan` 403, `SwipeCard`, `ItemDrawer`, `popup.tsx`, `background.ts`.
- Yeni kartların aynen kullanacağı atomlar ve hareket: `actions.ts` 469, `useDecisions`, `useSuggestions`, `motion.ts`, `hareketDili.ts`, `opening.ts`, `putFly`, `viewTransition`, `HoverTip` / `TipOn`, `BookedBadge`, `WhoseBadge` / `SavedFace`, `CopyButton`, `FallbackImg`, `InlineEdit`, `stageMenu` / `CardMenu` / `DeleteX`, `UndoToast`, `AddSheet`, `AskButton`, `FlightLive`, `Icons`.
- Yeni kartlar `dropsIn`, `useJustBecame` ve `useStageChange`'i kullanmalı; mühür/parlama sınıfları (`pk-glow`, `pk-seal`) korunursa e2e Part 5 hareket kontrolleri geçer.

### 2.5 CSS ve DESIGN.md

- **`static/app.css`** (5.377 satır, 462 KB): taban, sohbet (`.ch-` ~161), başlangıç (`.st-` ~336), Gün gün (`.dg-/.dv-` ~133), harita, eski kartlar (`.pk-` ~634, Gün gün kullanıyor) **kalır**.
- **(b) Uyarlanır:**
  - `:root` (satır 1, 3801, 4217): yeni token'lar.
    - Yazı ölçeği 9 boy: 11 · 12 · 13,5 · 15 · 17 · 19 · 22 · 24 · 30. Canlıda 33 farklı font-size var.
    - Durum: `--q-ok #1f7a45`, `--q-sand #f7f0e3`, `--q-acc #5b45e0`.
    - Ölçüler: niyet başlığı 76, gövde 196, yan sütun 232, eylem 42/32; etkinlik kartı 224; Pano kartı 220; karşılaştırma sütunu 280.
    - **Koyu tema karşılıkları** (prototipte yok, ek iş).
  - Sohbet sütunu `.board` (satır 31): `clamp(360px, 34%, 540px)` → v80'deki `clamp(300px, 26%, 400px)`.
- **(a) Yeni blok:** prototipteki `mk81.css` + `mk82.css` 1.042 satır / 100 KB. Koyu tema, 390 px, azaltılmış hareket ve EN taşmaları eklenince üretimde ~1,5–2k satır.
- **Geçişten sonra ölü kalacaklar:** `.hx-` (~225 satır), `.cat-` (~196), `.pn-` (~196), `.ek-`'nin Plan'a ait kısmı, `.ac-/.ev-` (~288), `.jf-/.jc-` (~73). Silinince CSS okuyan testler yeni seçicilere güncellenmeli: `reducedMotion.test.ts` (`.cat-bar > span`, `.hx-bar i`, `.pn-card` arar), `farkKonaklama.test.ts` (`.ek-pick-*`, `.bk-grid`), `motion.test.ts`, `hareketDili.test.ts`.
- **DESIGN.md:** "Renklerin tek anlamı" (kum = seçildi, mor = önerimiz zemini, niyet zemini), yazı ölçeği tablosu, niyet kutusu standardı, "Hero = mozaik" (v9 iki sütun bölümünün yerine) ve sağlayıcı kuralı yazılır. "Durum asla yalnız renkle anlatılmaz" ve "uydurma yok" kuralları aynen kalır.

### 2.6 Testler ve e2e etkisi

- **Yeşil kalanlar:** 165 test dosyasının büyük çoğunluğu (lib'e bağlı: decision, proscons, needs, categories, plan, legs, timeline, journey, journeyFlow, lifecycle, pano, planStages, heroInfo, tripFacts…).
- **lib ayarlarından etkilenenler:** `draft`, `cardTime`, `ticketStub`, `cardPeek`, `bookingRows` (PNR kararı), `board`, `prepBuy`, `searchLinks`, `needSearchLinks`, `brands`, `affiliate`, isteğe bağlı `docReader`.
- **app'ten etkilenenler:** `farkListeler` (Section, sectionMeta), `suggestions` (sectionMeta), `actsV30` (ActivityBoard), `preferences` (IntentCard), `offerSource.test.tsx` (OfferRow, emptyEnv), `backFace` (cards/searching). Eski CSS silinince: `reducedMotion`, `farkKonaklama`, `motion`, `hareketDili`.
- **Yeni testler:** `intents`, `providers`, `heroMosaic`, `journeyChapters`, `regionHints`.
- **e2e (`scripts/e2e.mjs`):**
  - Etkilenen ~650 seçici satırı: `.pk-` 194, `.hx` 150, `.cat-` 146, `.ek-` 61, `.pn-` 55, `.ev/.ac-` 43, `.tk-` 34, `.bk-` 9, `.prep-` 7.
  - Etkilenen bölümler: Part 1 (Plan, hero, Pano ağırlıklı); Part 5 (hareket sözlüğü: `pk-glow`/`pk-seal` vb. korunmalı); Part 6 (uçuş günü: canlı karolar yeni bilette, DOKUNULMAZ #4); Part 6b (Önerimiz, "✓ Bunu seç"); sihirli açılış bölümü (`data-pit`); H2/H3 (390 px'te yatay kaydırma yok).
  - Her aşama yalnız kendi alanının e2e satırlarını günceller.

### 2.7 Yeni React bileşenleri

| Bileşen | Görev | Veri |
|---|---|---|
| `HeroMosaic` | Büyük kapak + 3×2 kare, künye ⓘ | `heroMosaic.mosaicTiles`, `cityImages` |
| `HeroStrip` | 4 bölme: tarih · kişiler + hazırlık · bütçe · Sıradaki | `countdown`, `heroNumbers`, `budgetBar`, `nextStepShort` |
| `FactChips` | Ülke, hava, kur, priz, saat, dil, vize çipleri (HoverTip) | `tripFacts`, `useWeather`, `heroInfo`, `visa` |
| `BudgetPopover`, `PrefsPopover`, `WhoPopover` | Açılır pencereler | `TripFacts` bütçe mantığı, `Preferences`, `Travellers` |
| `HeroFold` | Özeti küçült / aç | `localStorage` |
| `PlanHeader` | "Plan" + alt satır + görünüm seçici | `heroNumbers`, `PlanOrder` |
| `CollectionRow` | Kapalı kategori satırı | `intents.collectionSummary` |
| `IntentList` + `StatusRail` | Açık kategori: dikey durum çizgisi | `intents.intentsOf` |
| `IntentBox`, `IntentHead`, `IntentMenu` | Niyet kutusu (76 px başlık, ⋯) | `IntentVM` |
| `IntentFrame` | Sabit gövde: görsel \| 4 satır bilgi \| 232 px yan sütun | |
| `OptionCompact` | Otel / eSIM seçenek kartı | `OptionVM` |
| `OptionRow` | Uçuş / tren satırı (Skyscanner tarzı) | `OptionVM`, `flightLeg` |
| `TicketFrame` | Seçili / alınmış bilet (rota çizimi, koçan; canlı karolar) | `ticketStub`, `ticketWarn`, `FlightLive` |
| `SideActions` | Duruma göre: fiyat + Rezerve et / Aldım · Değiştir; Bunu seç; kod + Belgeyi aç / ekle | `ticketPrices`, `partnerUrl`, `DocAccess` |
| `AccessFrame` | Alındı: ne zaman / nerede / kod / belge / linkler | `intents.accessOf`, `bookingRows`, `BookingSheet` |
| `EmptyFrame` + `RegionChips` + `ProviderIcons` | Aranıyor | `estRange` / `regionHints` / `providers` |
| `ArrangedFrame` | Ayarlandı | `LegChoice`, `arranged` |
| `ChangeInline` | Yerinde Değiştir + Vazgeç | `GroupDecision.options` |
| `DetailPopover` | Kartın üstünde açılan Ayrıntı | `CardDetail` / `FactsBox` / `bookingRows` |
| `ActivityRows` | Planında + Öneriler | `eventsByCity`, öneriler |
| `JourneyView`, `ChapterHead`, `StepCard`, `IdeasLine` | Yolculuk sırasıyla | `journeyChapters` |
| `PanoSheet`, `PanoSidebar`, `PanoGrid`, `CompareColumns`, `IlhamGrid` | Pano penceresi | `pano.ts`, `decision`, `inspo.ts` |

Yeni TSX toplamı tahminen 3,5–4,5k satır.

---

## 3. Görev 3: büyük iş olmadan aşamalı geçiş

**İlke:** her aşama kendi alanını yerinde değiştirir ve o alanın e2e satırlarını aynı aşamada günceller. Niyet kutuları `CategoryPlan` içindeki `V82_SECTIONS` kümesiyle bölüm bölüm açılır: kümede olmayan bölüm eski `SectionTimeline` ile çizilir. Uzun ömürlü bir arayüz bayrağı yok, iki tam arayüz bakılmaz.

**Her aşamanın çıkış koşulu:** `npx tsc -p .` temiz; `npx vitest run` yeşil; ilgili e2e bölümü yeşil; 1440 / 390 / EN / koyu tema kontrolü.

**Her aşamada korunacak DOKUNULMAZ'lar (v45 §2.3):** ••• menüsü, ×, ✓ Aldım, Kimin için?, Ayarlandı; rötar karoları; 14 gün ve "İade yok" uyarıları, `dateAlert`; Geri al; "?" durumu; yazısız durum yok; uydurma yok; `L(tr, en)`; azaltılmış hareket; sihirli açılış; View Transitions; `putFly`; paylaşılan gezide kalp = Süper.

| # | Aşama | Kapsam | Dokunulan dosyalar | Test / e2e | Büyüklük |
|---|---|---|---|---|---|
| 0 | Temel (görünür değişiklik yok) | Görünüm modeli, sağlayıcı kaydı, token'lar, bölüm anahtarı | yeni `lib/intents.ts`, `lib/providers.ts`; `static/app.css :root` (+ koyu); `CategoryPlan.tsx` (boş `V82_SECTIONS`); DESIGN.md taslağı | yeni `intents.test.ts`, `providers.test.ts`; e2e değişmez | M |
| 1 | Hero mozaik | Mozaik, 4 bölmeli şerit, çipler, açılır pencereler, küçült/aç, yapışkan şerit; sohbet sütunu genişliği | yeni `HeroMosaic`, `HeroStrip`, `FactChips`, `*Popover`, `lib/heroMosaic.ts`; (a) `TripHero.tsx`, `TripFacts.tsx`; (b) `StickyBar.tsx`, `IntentCard.tsx`, `TripPanel.tsx` (hero bölümü), CSS `.board` | `heroMosaic.test.ts`, `preferences.test.ts`; e2e `.hx` (~150 satır), açılış `data-pit`, 390 px | M |
| 2 | Plan başlığı + kapalı satırlar | "Plan" başlığı, görünüm seçici, CollectionRow, tek açık akordiyon, Hazırlık satırı; PlanKey / TripShape / üst "Ekle" kalkar (karar 8) | (b) `CategoryPlan.tsx`, `Section.tsx`, `sectionMeta.ts`, `PlanOrder.tsx`, `PrepList.tsx`; `intents.collectionSummary` | `farkListeler`, `suggestions`; e2e `.cat-` başlık kısmı | S–M |
| 3a | Niyet kutusu: Konaklama + eSIM + Sigorta | Tüm durumlar (Karar · Önerimiz · Seçildi · Alındı-erişim · Aranıyor · Gerek yok), yerinde Değiştir, ⋯ Ayrıntı, durum çizgisi; boş niyette tahmin ve bölge çipleri | yeni `IntentList/Box/Head/Frame`, `OptionCompact`, `SideActions`, `AccessFrame`, `EmptyFrame`, `RegionChips`, `ChangeInline`, `DetailPopover`; `lib/regionHints.ts`; `V82_SECTIONS += stay, other` | `regionHints.test.ts`, `offerSource.test.tsx`; e2e Plan konaklama, belge ve 6b (otel taslağı) satırları | L |
| 3b | Niyet kutusu: Uçuş + Tren + Transfer | OptionRow, TicketFrame (canlı karolar), ArrangedFrame, bacak (leg) niyetleri; En hızlı rozeti; Önerimiz'in trene genişlemesi (karar 3); PNR / check-in sabitleri (karar 1–2) | yeni `OptionRow`, `TicketFrame`, `ArrangedFrame`; (b) `board.ts`, `draft.ts`, `cardTime.ts`; `V82_SECTIONS += flight, transport` | `board`, `draft`, `cardTime`, `ticketStub`, `cardPeek`, `bookingRows`; e2e `.tk-`, Part 6 (uçuş günü), 6b | L |
| 4 | Etkinlik + Yapılacaklar | İki sabit sıra, boş yuvalar, "+n Pano'da", alınan etkinlik şeridi, Gün ver | (b) `ActivityBoard.tsx`, `IdeaTiles.tsx`; `V82_SECTIONS += activity, todo` | `actsV30.test.ts`; e2e `.ev/.ac-` (~43 satır) | M |
| 5 | Yolculuk sırasıyla | Bölümler (Yola çıkmadan · yol · şehir fotoğrafı + "n hazır · n karar"), tarih sütunu, durum noktası, tek eylem, "n öneri ›"; seçim iki görünümde de görünür | (a) `StoryView.tsx`, `JourneyCards.tsx` → `JourneyView`, `StepCard`; yeni `lib/journeyChapters.ts` | `journeyChapters.test.ts`, `journeyFlow` (aynen); e2e Yolculuk adımları | M |
| 6 | Pano penceresi | Dialog (×, dışarı tık, Esc, odak tuzağı); kenar menü (Tümü / Biriktirdiklerim / AI / İlham + İhtiyaçlar ağacı); 220 px kartlar; 280 px karşılaştırma sütunları (puana göre, <3 ise yer tutucu, yalnız konaklama, eSIM, uçuş, tren); İlham ızgarası; "İçinden yerleri çıkar" sohbet istemi; her niyetten "Pano n" | (a) `board/Pano.tsx` → `PanoSheet`, `PanoSidebar`, `PanoGrid`, `CompareColumns`, `IlhamGrid`; (b) `TripPanel.tsx`, `CompareView.tsx`, `IdeaList.tsx` (İlham taşınır) | `pano.test.ts` (aynen), `board`; e2e `.pn-` (~55 satır) | L |
| 7 | Sağlayıcılar ve alışveriş | "Kendin ara", bölge "…'da ara", CTA etiketleri, Hazırlık mağazası (pasaporta göre Trendyol / Hepsiburada / Amazon), Agoda ve tren aramaları; isteğe bağlı check-in tablosu ve DocFacts koltuk/bagaj | (b) `searchLinks.ts`, `brands.ts`, `prepBuy.ts`, isteğe bağlı `docReader.ts`; `providers.ts`'i niyetlere bağlama | `searchLinks`, `needSearchLinks`, `brands`, `affiliate`, `prepBuy`, `docReader` | S–M |
| 8 | Temizlik + bağımsız denetim + yayın | Ölü CSS (`.hx-`, `.cat-`, `.pn-`, `.ac-`, `.jf-`), `SectionTimeline`, `TripShape`, PlanKey; CSS testlerinin seçicileri; DESIGN.md son hali; v82 izlenebilirlik tablosu ve fark raporu (v46 F10 yöntemi); 0.38.0 | Eski kart ailesi **kalır** (Gün gün) | Tam vitest, tam e2e, 390 / EN / koyu, eski IndexedDB yedeğiyle açılış (dbUpgrade) | M |

**Sıra ve paralellik:**
- 0 önce gelir.
- 1 ve 2 paralel gidebilir.
- 3a → 3b sıralı (aynı çerçeve).
- 4, 5 ve 7 aşama 3a'dan sonra paralel gidebilir.
- 6, aşama 3'ün `IntentVM`'ini kullanır; 3a'dan sonra başlar.
- 8 en son.

Kararlar (1.12) aşama 3b'den önce alınmalı. Alınmazsa canlı kural korunur (PNR uçuş günü, check-in 2 gün, taslak uçuş + otel); her biri tek sabittir.

**"Büyük iş olmasın" için kısaltmalar (tasarım eksiksiz kalır):**
- Gün gün'e dokunma (v82 çizmedi). Eski kartlar orada yaşar.
- İş mantığı yazma: niyet görünüm modeli yalnız mevcut saf fonksiyonları birleştirir.
- "İçinden yerleri çıkar" = sohbet istemi (S), yeni araç yok.
- Places API yok; city-image `?q=` yeterli.
- Koltuk/bagaj ayrıştırma ve check-in tablosu isteğe bağlı. Yoksa o satır çizilmez; aynı boyda yer tutucu kalır (v82 standardı).
- Bölge çipinde "neden" cümlesi isteğe bağlı (yalnız ad + fiyat da tasarıma uyar).
- Pano'da `CompareView`'ın öncelik düzenleyicisi kalır; yeni sütunlar ayrı.

**Toplam:** 3 L (3a, 3b, 6) + 5 M (0, 1, 4, 5, 8) + 1 S–M (2, 7 birlikte) ≈ 15–22 iş günü (v45 ölçeği, test dahil değil). Kod hacmi: ~1k satır yeni lib + ~4k satır yeni TSX + ~1,5–2k satır CSS + ~700–1.000 satır e2e güncellemesi.

## 4. Emre'ye sorulacaklar (varsayılanla ilerlenebilir)

1. PNR ve giriş saati her zaman görünsün mü? Varsayılan: evet (v82).
2. "Önerimiz" trende ve eSIM'de de olsun mu? Varsayılan: evet; transfer ve sigortada hayır.
3. Puanın adı: "AI uyum puanı" mı, "Uyum puanı" mı? Varsayılan: "Uyum puanı" + ⓘ.
4. Rota şeridi ve durum anahtarının kalkması onaylı mı? Varsayılan: evet (v80 / v81).
5. Sigorta tahmini gösterilmesin (K3). Boş otelde tahmin yalnız ≥3 aday fiyatıyla.
6. İlham'dan çıkan yerler hangi niyete düşsün? Varsayılan: etkinlik / yapılacak önerisi olarak, şehri metinden okunur.
7. Telefonda niyet çerçeveleri eşit boyda mı olsun (v82 açık konusu)? Varsayılan: yalnız yapı aynı.
