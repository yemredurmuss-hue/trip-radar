# Plan v82 → kod geçişi · spec taslağı (18 Ekim 2026)

Durum: TASLAK. Kararlar karar sayfasından okunduktan sonra kesinleşir (https://claude.ai/artifact/1Ww3APTcA7BZ9hGgig9g7k, db koleksiyonu `kararlar`). Kod değişmedi.
Hedef: v77–v82 plan tasarımının **eksiksiz** koda geçmesi; canlı 0.37.1'deki hiçbir özelliğin kaybolmaması; IndexedDB şeması (DB_VERSION 5) ve backend değişmeden.

Kaynak raporlar (bu klasörde):
- `A1-plan-sayfasi.md`: plan sayfasında canlıda olup tasarımda olmayan / yarım olanlar (26 + 27 madde, dosya:satır).
- `A2-diger-yuzeyler.md`: plan dışı yüzeyler (sohbet, başlangıç, ayarlar, paylaşım, PDF, popup, i18n, dar pencere).
- `C-veri-ve-kod-gecisi.md`: veri eşlemesi, baştan yazılacak / uyarlanacak / dokunulmayacak kod, aşamalar.
- `D-gezi-turleri-ve-uc-durumlar.md`: omurga kuralları, 29 senaryonun gerçek çıktısı, 18 canlı hata, 12 ilke.
- `E-hareket-dili.md`: hareket envanteri ve yeni tasarım için 17 karar.
- `F-asamali-gosterim.md`: aşamalı gösterim (dört katman, durum ve zamana göre gösterim).
- `kararlar/`: karar sayfasının kaynağı (`data.py` kararlar, `build.py` sayfa).

## 1. Kararlar ve kapsam
Karar sayfasındaki A–G bölümleri (102 karar). Kesinleşince buraya tablo olarak yazılır: karar · seçim · dayanak (rapor/satır) · etkilediği aşama.
Varsayılan: boş bırakılan karar = önerilen seçenek (sayfada "önerim").

## 2. Bilgi haritası (F1)
Her bilgi tek katmanda: K0 kapalı kategori satırı · K1 niyet kutusu · K2 Ayrıntı (kartın üstünde) · K3 Pano. Tablo: bilgi · kısa hali (K1) · tam hali (K2/K3) · veri kaynağı (C raporu §1) · duruma göre (karar / önerimiz / seçildi / alındı / ayarlandı / aranıyor / gerek yok) · zamana göre (F2).

## 3. Veri ve bileşen eşlemesi
- Veri: C raporu §1 tablosu (HAZIR / TÜRETİLEBİLİR / YOK). YOK olanlar istemci tarafında: "En hızlı" rozeti, sağlayıcı kaydı (`lib/providers.ts`, ülke/kategori/link kaynağına göre), check-in zamanı, koltuk/vagon/bagaj ayrıştırma (isteğe bağlı), bölge kartı nedeni, İlham'dan yer çıkarma (sohbet istemi), şehre özel istek.
- Yeni saf modüller: `intents.ts` (niyet kutusu görünüm modeli: durum, çerçeve ailesi, satırlar, eylemler), `providers.ts`, `heroMosaic.ts`, `journeyChapters.ts`, `regionHints.ts`.
- Yeni bileşenler (C §2.7): HeroMosaic, HeroStrip, FactChips, PrefsPopover, BudgetPopover, WhoPopover, PlanHeader, CategoryRow, TimelineRail, IntentBox, IntentHead, FrameCard, FrameTicket, CollectionRow, OptionRow, OptionCompact, KCard, DetailLayer, IntentMenu, JourneyView, PanoDialog, PanoSidebar, CompareColumns, IlhamGrid …
- Baştan yazılacak: TripHero/TripFacts (hero), SectionTimeline (niyet listesi), StoryView/JourneyCards (Yolculuk), board/Pano. Uyarlanacak: TripPanel, CategoryPlan, Section, sectionMeta, ActivityBoard, IdeaTiles, PrepList, StickyBar, IntentCard, EmptyCard, OfferRow, CompareView. Dokunulmayacak: Gün gün (A3'e bağlı), harita, başlangıç sohbeti, sohbet mantığı, atom bileşenler, lib iş mantığı, backend.

## 4. Aşamalar (G2, G3)
| # | Aşama | Kapsam | Büyüklük |
|---|---|---|---|
| v83 | Çizim turu | A2'de seçilen eksik yüzeyler (gezi menüsü, ekleme, düzenleme, diğer türler, uçuş günü, hata/yükleniyor, sohbet uyumu, dar pencere, hero boş hali, paket/Dahil, Belgeler yeri) | M |
| 0 | Temel | görünüm modeli (`intents.ts`), token'lar ve yazı ölçeği, sağlayıcı kaydı iskeleti; görünür değişiklik yok. v83 sürerken başlar | M |
| 1 | Hero | mozaik, şerit, çipler, pencereler, küçült, mini şerit, gezi menüsü | M |
| 2 | Plan başlığı ve kategori satırları | Plan başlığı, görünüm seçici, kapalı satır (78 px), akordiyon, durum çizgisi | S–M |
| 3a | Konaklama, eSIM, sigorta | sabit çerçeve, bütün durumlar, Değiştir yerinde, Ayrıntı katmanı, ⋯ menü | L |
| 3b | Uçuş, tren, transfer ve diğer türler | bilet çerçevesi, aktarmalı uçuş, uçuş günü, kiralama/kamp | L |
| 4 | Etkinlik ve yapılacaklar | iki sabit sıra, boş yuvalar, +n Pano'da, Plana koy | M |
| 5 | Yolculuk sırasıyla | bölümler, adımlar, tek eylem, gezi sırasında "bugün" (D8) | M |
| 6 | Pano | pencere, kenar menü, karşılaştırma sütunları, İlham, Belgeler girişi | L |
| 7 | Sağlayıcılar ve alışveriş | dinamik sağlayıcı, Amazon/Trendyol/Hepsiburada, Agoda, tren siteleri, ortaklık | S–M |
| 8 | Temizlik, bağımsız denetim, yayın | eski kod/CSS temizliği, izlenebilirlik denetimi, e2e, sürüm | M |
Kabaca 15–22 iş günü (test hariç). Yayın: tek sürüm (G2 a), aşamalar içeride denenir.

## 5. İzlenebilirlik ve bağımsız denetim
- `izlenebilirlik.md`: v77–v82 notlarındaki her madde + karar sayfasındaki her karar + A1/A2'deki her canlı özellik → bir aşama/paket ya da "YAPILMIYOR + gerekçe" ya da "zaten canlı".
- Bitiş kapısı: bağımsız denetim (prototip ekranı ↔ canlı yapı; tablo satır satır). Açık satır kalırsa yayın yok (v46 geçişindeki yöntem).

## 6. Test planı
- lib testleri (165 dosyanın çoğu) yeşil kalır; yeni saf modüllere birim testi.
- e2e (`scripts/e2e.mjs`): yaklaşık 650 seçici satırı sınıf adlarına bağlı; yeni bileşenlere `data-test` işaretleri, e2e aşama aşama güncellenir.
- Ekran görüntüsü karşılaştırması: prototip (v82/v83) ↔ yeni yapı, 1440 / 1280 / 860 / 390 px, iki dil.
- Sabit boy denetimi: her niyet ailesi her durumda aynı yükseklik (prototipteki ölçüm betiği gibi).
- Azaltılmış hareket ve "Hareketi duraklat" (E17).

## 7. Canlı hatalar paketi (A5)
D raporu §4: H1–H18. Yeni tasarıma değenler (A5 a): H1, H2, H4, H5, H6, H7, H8, H9, H10, H12, H13, H15 ilgili aşamaya bağlanır; gerisi ayrı iş listesine.
