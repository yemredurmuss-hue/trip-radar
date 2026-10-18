# Plan v82 → kod geçişi · spec (18 Ekim 2026)

Durum: kararlar verildi (`01-kararlar.md`; karar sayfası https://claude.ai/artifact/1Ww3APTcA7BZ9hGgig9g7k). Açık tek nokta B9 yorumu (§1.3). Kod değişmedi.
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
Tam tablo: `01-kararlar.md`. Önerilenden farklı seçimler ve notların yorumu:

### 1.1 Bu sürümde arayüzden düşenler (A1 c)
Kod silinmez, arayüze bağlanmaz; sonraki sürümde geri bağlanabilir. Değişiklik notunda listelenir.
- C8 Yapılacaklar listesi ve ⏳ iptal süresi sayacı.
- C11 Karar yardımı: önem ayarı, "Sonucu ne değiştirir?", AI yorumu, "Sırayla karar ver" (13 Ekim "geri getir" kararının yerine geçer).
- C18 Başlangıç kartı.
- C27 Yolculuk kartı ekleri (⏳ iptal, "n gece için yer yok", gün seç).
- C32 Pano ekleri (arama, durum süzgeci, sıralama, "Plan'da gör").

### 1.2 Önerilenden farklı seçimler
- B5: isteklerde yalnız ✓ ve ✕; "?" (sayfa söylemiyor) gösterilmez (veride kalır).
- B10: alınmış kartın yan sütununda küçük "€900 ödendi".
- B12 ("yeni tasarım neyse o, gerisini karıştırma"): Değiştir'de yalnız tasarımdakiler: seçenek başlığında "Kendin ara", karşılaştırma Pano düğmesinde. Arka yüz ve "AI'a arat" gelmez.
- C16 ("AI alınmayan bileti kart olarak koyar"): kural önerileri ve uyarılar ayrı satır ya da çip değil; eksik olan (dönüş bileti, transfer, bilet alınmadı) niyet olarak omurgaya eklenir, durumu (Aranıyor / Önerimiz / Karar bekliyor) tamamlanmadığını söyler.
- C19 ("olmayan bilgi 'yok' diye yazılmaz, orada olmaz"): hero'nun boş/tahmini hali v83'te çizilir; eksik parça yer tutucu ya da "yok" yazısı yerine görünmez, düzen kalanlara göre kurulur.
- D2 ("her kategori türe göre açılır, karar değil türe göre gelir; Ozora festivalinde Konaklama 'Çadır konaklama' kendiliğinden gelir"): omurga türe göre kurulur. Tür iskeleti her kategori için niyetin türünü ve başlangıç durumunu verir (ör. festival → Konaklama "Çadır konaklama · festival kampı"; dalış teknesi → Konaklama "Tekne · paket dahil"). Paketin kapsadığı kategorilerde "Dahil" satırı. D1, D3, D4 ile birlikte uygulanır.
- A2 (v83 kapsamı): gezi ⋯ menüsü, diğer türler, uçuş günü, hata/yükleniyor/çevrimdışı, sohbet uyumu, 860 px altı, hero boş hali, paket/Dahil, Belgeler yeri, gezi sırasında "Bugün" şeridi. Ekleme penceresi (C3) ve yerinde düzenleme (C2) çizilmez; kodda C2/C3'teki yerlere konur.
- A7, A8 ("mobil sonra"): 860 px altı düzen v83'te çizilir ve bu sürümde yapılır; 390 px ve dar ekranda eşit kutu boyu sonraki iş.

### 1.3 Açık: B9 yorumu
Not: "omurganın %'si: plana alınmış ama book edilmemiş". Öneri: ana sayı "Omurganın %70'i planda" (alındı + seçildi + ayarlandı / bütün ihtiyaçlar, gerek yok hariç), altında "%50'si alındı"; çubukta iki ton. Emre onaylayınca kesinleşir.

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
| v83 | Çizim turu | gezi ⋯ menüsü, diğer türler (otobüs, vapur, kiralama, kamp), uçuş günü canlı, hata/yükleniyor/çevrimdışı, sohbet uyumu ve "Planda göster", 860 px altı yerleşim, hero boş hali (C19), paket ve "Dahil" (D2, Ozora örneği), Belgeler yeri (Pano kenar menüsü), gezi sırasında "Bugün" şeridi | M |
| 0 | Temel | görünüm modeli (`intents.ts`), token'lar ve yazı ölçeği, sağlayıcı kaydı iskeleti; görünür değişiklik yok. v83 sürerken başlar | M |
| 1 | Hero | mozaik, şerit, çipler, pencereler, küçült, mini şerit, gezi menüsü | M |
| 2 | Plan başlığı ve kategori satırları | Plan başlığı, görünüm seçici, kapalı satır (78 px), akordiyon, durum çizgisi | S–M |
| 3a | Konaklama, eSIM, sigorta | sabit çerçeve, bütün durumlar, Değiştir yerinde, Ayrıntı katmanı, ⋯ menü | L |
| 3b | Uçuş, tren, transfer ve diğer türler | bilet çerçevesi, aktarmalı uçuş, uçuş günü, kiralama/kamp | L |
| 4 | Etkinlik ve yapılacaklar | iki sabit sıra, boş yuvalar, +n Pano'da, Plana koy | M |
| 5 | Yolculuk sırasıyla | bölümler, adımlar, tek eylem, gezi sırasında "Bugün" şeridi ve bugünden açılış (D8, v83) | M |
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
