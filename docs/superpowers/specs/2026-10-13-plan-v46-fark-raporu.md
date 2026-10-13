# Plan v46: fark raporu (F10 bağımsız denetim, 2026-10-13)

Denetçi: kodlamayı yapmayan ayrı oturum. Dal `plan-v46-denetim` (= `plan-v46-kod`, P0..P9b birleşik, sürüm 0.36.84 etiketli). Kod değiştirilmedi.
Karşılaştırma: v46 mockup'ı (`git show origin/plan-v30-wip:docs/mockups/plan-v46-sira/index.html`, Chromium, mockup'ın düğmeleri tıklanarak: Japonya A/B/C, Ozora, 3 akış aşaması, 5 zaman durumu) ↔ canlı build (dist). Üç gezi: **Portekiz örnek (klasik)**, **Ozora festivali** (Gezinin sebebi, kamp, araba al/bırak, kapalı tur notu, festivalden sonra dinlenme), **Durumlar** (denetim için kurulan gezi: uçuş/otel/ulaşım/etkinlik kartları Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı).
Araç: `scripts/v30-shots.mjs` (genişletildi; canlı: `SHOTS_WIDTH=1440|390 [SHOTS_LANG=en]`; mockup: `SHOTS_MOCKUP=<index.html>`). Çıktı `e2e-output/v46/{1440,390,en,en390}/` (tekil ekranlar) ve `.../pairs/pair-<gezi>-<ekran>.png` (sol mockup, sağ canlı; 69 çift her boyutta), `ozel/` (rötar, uzun ad), `olddata/` (eski veriyle açılış). e2e-output git'e girmez.
Sınır: mockup yalnız Türkçe; EN ekranları canlı için ayrı alındı (arayüz metninde Türkçe sızıntı taraması: yok). 390 px'te mockup'ın sohbet bindirmesi çizim aracı sayıldı, mockup bölüm çekimlerinde gizlendi. Koyu tema ve tarihsiz gezi kipi **denetlenemedi** (yalnız kod/CSS belirteci okundu).
Okuma: **A** = fark yok, **B** = bilinçli sapma (§2'deki karar ya da canlı özellik korunur), **H** = HATA.

## Özet
- HATA: 5 (H1 yayını engeller; H2, H3 yayını engeller (390 px kabulü); H4 engellemez; H5 belge işleri engellemez).
- tsc temiz; vitest 156 dosya / 1956 test yeşil; tam e2e 58 adım yeşil (EXIT 0, `E2E_OFFLINE=1 faketime @2026-10-05`).
- Not: e2e'de Yolculuk sırasıyla görünümü ve Ozora festival gezisi için adım yok (v46 Yolculuk yalnız vitest `journeyFlow` + bu denetimin ekranlarıyla kanıtlı).

## HATA listesi
| # | Ağırlık | Nerede | Kanıt | Önerilen düzeltme |
|---|---|---|---|---|
| H1 | **yayını engeller** (DOKUNULMAZ §2.3-7 "durum asla yalnız renkle", S16 "Kart: Seçildi") | Konaklama, ulaşım ve etkinlik kartlarında Seçildi görünümü | `CardShell.tsx` yalnız yarım halka (`aria-label` "Seçildi, rezerve edilmedi") ve "✓ Aldım" basıyor; `pk-lab` yazısı yalnız Önerimiz (`PlanCard.tsx:376`) ve Arıyoruz (`EmptyCard.tsx:196`, `NeedCard.tsx:172`) için var. Ekran: `1440/states-sec-stay.png` (Hyatt Centric), `states-sec-transport.png` (Hakone → Osaka), `states-sec-activity.png` (teamLab). Mockup'ta aynı kartlarda sağ üstte "Seçildi" yazısı var (`m1440/japonya-karar-sec-stay.png`, `-transport.png`). Uçuş koçanı "Seçildi" yazıyor. Eski karar K55 ("Aldım" etiketin yerine) ile v46 mockup'ı çelişiyor; plan K50 "✓ Aldım ⓘ yanında kalır" der ama yazıyı kaldırmaz. | Seçildi kartlarında "Seçildi" yazısı (`lookWord("chosen")`) halkanın yanına ya da koçan/alt satıra konsun; ✓ Aldım kalsın. |
| H2 | **yayını engeller** (V46-42 dar ekran kabulü) | 390 px bölüm başlığı (`.cat-head`) ve açık arka yüz | (a) Başlıkta ilerleme çubuğu alt satırın üstüne biniyor, "1…" kesiliyor: `390/states-sec-stay.png`, `390/ozora-sec-flight.png`, `390/sample-02-sticky-2200.png`. (b) Arka yüz açıkken sayfa **+94 px** (EN +128) yatay taşıyor: `390/sample-back-flight.png` genişliği 468. Kök neden: `div.cat-head` min-content ≈ 466 px (ad + sayaç + çubuk + bütçe + ok sarmıyor); kapalıyken sıkışıp üst üste biniyor, arka yüz bölümü genişletince `cat-sheet` ızgara izi 468 px'e çıkıyor (`.cat-head` gizlenince 110 px azalıyor; tek öğe gizlemekle başka öğe etkilemiyor). Eski build'de arka yüz yok: bu taşma v46'nın. | `.cat-head`'e dar ekranda (≤640) flex-wrap ya da `min-width:0` + çubuğu ikinci satıra al (`.cat-end` bütçe + çubuk altta); `.cat-sheet`/`.cat-grid` izini `minmax(0,1fr)` yap. Sonra `scripts/v30-shots.mjs` 390 koşusunda `OVERFLOW ... back` satırları 0 olmalı. |
| H3 | **yayını engeller** (V46-42; 0.36.84'ten beri var, v46 getirmedi) | Gezinin şekli şeridi `ol.ts-strip` | 390 px'te 4+ duraklı gezide sayfa yatay taşıyor: Ozora +127 px, Durumlar +174 px (Portekiz, 3 durak, 0). Eski 0.36.84 build'i aynı değerleri veriyor (ölçüm: `/tmp/old-shots`, betik çıktısı). Kök neden: `static/app.css:3644` `.ts-strip{overflow:visible}` satır 3305'teki `overflow-x:auto`'yu eziyor; `.ts-item{flex:1 0 auto}` küçülmüyor; sağdaki duraklar pencereden taşıyor. Mockup'ta aynı yerde taşma yok (`m390` ölçümü 0). | `.ts-strip` dar ekranda `overflow-x:auto` (ya da durak adlarını kısaltıp `flex-shrink:1`) ve tooltip'lerin kesilmemesi için balonu portal'a ya da `overflow-y:visible` ile birlikte ver. |
| H4 | engellemez | Rötarlı uçuş kutucukları (kapı/yeni saat) | `ozel/rotar-flight-1440.png`: "Yeni kalkış" etiketi "Yeni kal…" diye kesiliyor, "+25 dk" kutuya sığmıyor (rötar kırmızı çerçeve, çizili 19:40, 20:05, Kapı 14, "Planı yeni saate kaydırdım" doğru; e2e 5029-5045 metni sınıyor, görsel kesilmeyi sınamıyor). | `.pk-lv` kutucuklarında etiketi sarsın ya da kutucuk genişliği/`min-width` artsın; e2e'ye `scrollWidth<=clientWidth` iddiası. |
| H5 | engellemez (belge) | F9 belgeleri | `docs/superpowers/specs/2026-10-05-akilli-saat-design.md` hâlâ "AB içi 2 sa / dışı 3 sa" (kod Emre'nin 07 Ekim sözüne uyuyor: `lib/legs.ts:42-57`); `docs/urun-yol-haritasi.md`'de K76+ satırı yok; `2026-10-13-plan-v46-ilerleme.md` P7 ve P8c'yi "bekliyor" gösteriyor (commit'ler 67814c3, 73da513 birleşik). | Üç belgeyi güncelle. (İlerleme tablosunu bu denetim güncelledi.) |

## Ekran karşılaştırması (1440 · 390 · EN)
Sütunlar: ekran | sonuç | açıklama (çift dosyaları `e2e-output/v46/<boyut>/pairs/`).

| Ekran | 1440 | 390 | EN | Açıklama |
|---|---|---|---|---|
| Üst çubuk, gezi seçici, Plan · Pano | A/B | A | A | Mockup'ın çizim aracı sıraları (gezi sekmesi, akış, zaman) ürün değil (V46-39/40). Canlıda sol sütun tam yükseklik sohbet, üstte "Seyahatlerim" geri okun. |
| Sohbet paneli | B | B | A | Mockup örnek konuşma ve link taslağı kartı çiziyor; canlı gerçek sohbet, giriş kutusu "Bir link bırak, görsel yapıştır veya yaz…". 390'da canlı sohbet sayfanın üstünde blok (mockup bindirme). |
| Hero (Ozora, Portekiz) | A | A | A | Yapı aynı (iki sütun, 4 sayı hücresi, mint ilerleme kutusu); canlıda "PDF indir" altta (HS22 KAPSAM AÇIĞI, bilinçli sapma), foto yerinde yer tutucu (çevrimdışı test). |
| Yapışkan şerit | A | A | A | `pair-*-02-sticky.png`; 390'da (`390/sample-02-sticky-2200.png`) ad ve "Sıradaki" kısalıyor (HS06 sırayla gizleme beklenen). |
| Gezinin şekli şeridi | A | **H3** | A | 4+ duraklı gezide 390 taşma. |
| Plan görünüm çubuğu, 5 durumlu anahtar | A | A | A | `1440/sample-key.png`: Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı. Mockup'ın "Kararlar / Hazır gelenler" grup etiketleri canlıda yok (PG31, B). |
| Bölüm başlığı | A | **H2** | A | Mockup "2 önerimiz"; canlı "1 rezerve · 1 önerimiz · 1 seçildi · 1 aranıyor" (sayım sözlüğü §2.2, B). Ayarlandı sayıma girmiyor (canlı: 5 kartta 4 sayılı). |
| Uçuş bileti: Arıyoruz · Önerimiz · Seçildi · Bilet alındı · Ayarlandı | A | A | A | `1440/states-sec-flight.png`. "Aranıyor" (6. durum) Seçenek ara/AI'a arat sonrası 60 sn çubuk (EmptyCard.tsx), ekranı alınmadı. Önerimiz koçanında emoji ✨ (mockup ✦ ikon): küçük. "Rezerve et ↗" yalnız URL varsa (seed URL'siz kartta yok, B). |
| Boş uçuş bileti | A | A | A | "Bilet yok · 2 kişi", "Seçenek ara", "Kendin ara"; tahmin yalnız ≥3 teklif (B: uydurma veri yok). |
| Canlı şerit / rötar / PNR / 14 gün | A (davranış) | A | A | Bkz. DOKUNULMAZ bölümü; H4. |
| Otel kartı: Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı | **H1** | A | A | `1440/states-sec-stay.png`: Seçildi'de yazı yok. Önerimiz'de sol üstte yalnız ikon ("Konaklama" adı yok) mockup'la aynı değil (küçük). |
| Kamp / karavan (Ozora) | A | A | A | Kamp kartı çadır çizimiyle, rezerve rozeti; "Kamp · Dádpuszta" etiketi. |
| Ulaşım kartı: dolu, boş, rezerve, Ayarlandı | **H1** | A | A | `states-sec-transport.png`: rezerve ve boş doğru; Seçildi'de yazı yok. Tren için tek kayıtlı seçenek taslak olmuyor ("1 seçenek ›"): S3 gereği doğru. Ayarlandı ulaşım, e2e yolunda (uçuş) doğrulandı; ulaşım için leg yolu elle denenmedi. |
| Kiralık araç (Ozora) | A | A | A | `Al 24 Tem 11:30 · … → bırak 2 Ağu · Deák tér`, €310 toplam; kart boyu mockup'a göre uzun (Yolculuk'ta aynı kart, B). |
| Etkinlik: şehir şehir, boş şehir, kart | A/B | A | A | `states-sec-activity.png`: şehir başlığı, "1 bilet alındı", boş şehir "AI'a arat". B: "Öneriler ve fikirler" katlanır başlığı ve "Kendin ara" şeridi canlı özellik (korunur, §2.2); mockup'taki "siz eklediniz" sayacı yok; site adı düğmede (MD05 teyit). Kart başına 4 sütun (mockup 3). |
| Gezinin sebebi, kapalı tur notu, festivalden sonra dinlenme | A | A | A | `olddata/OzoraFestival2027.png`. |
| Yapılacaklar ve restoranlar | A | A | A | Minik kareler; restoran turuncu. |
| Belgeler ve internet, Hazırlık, İlham | A | A | A | `pair-*-sec-docs/prep/insp.png`. Vize satırı, sigorta + eSIM iki kart. |
| Arka yüz (uçuş, otel, ulaşım) | A | **H2** | A | `sample-back-flight.png`: Kaydettikleriniz / Önerimiz, kendin ara şeridi, AI'a arat, Pano'da aç, ×. B: "Karşılaştır" bağlantısı ve "Önerim …" öneri kutusu canlı özellik (§2.3-8 korunur). Mockup'ta 3 kart yan yana; canlıda sığdığı kadar. Esc/odak doğru. |
| ⓘ balonları (uçuş, otel, ulaşım) | A | A | A | `info-*.png`; klavye ile açılıyor (Tab, Esc). Küçük not: `aria-expanded`/`aria-describedby` yok. |
| Ayrıntı pencereleri (kart, etkinlik) | A | A | A | `sample-detail-booking.png`, `ozora-detail-booking.png`, `ozora-detail-event.png` (Ozora Festival bileti: Bilet alındı, tarih, kişi, "Belge eksik · ekle"). |
| Gezi menüsü | A | A | A | `pair-*-menu.png` (Belgeler · Paylaş · Geçmiş …). |
| Plan: Yolculuk sırasıyla (Ozora, Portekiz) | A | A | A | `pair-ozora-view-story.png`: Yola çıkış → uçuş → ulaşım → şehir başlığı → otel (Giriş/Çıkış) → etkinlik kartları ("gün seç") → yapılacak kutusu → Eve dönüş. B: tür etiketi küçük harf (N9, DESIGN.md:266); ulaşım kartı planın kartı (alt satırsız); kiralık araç kartı mockup'taki mini sürümden büyük. |
| Plan: Gün gün | A/B | A | A | Canlıda Liste/Harita anahtarı ve "Planda, günü yok" uyarısı ek (korunan). |
| Pano | A | A | A | `pair-ozora-view-pano.png`, `states-view-pano.png`: kategori menüsü, "Önerimiz: … · Plan'da gör →", uçuş şeridi ("✨ Önerimiz · kartta", "En ucuz"), kalp, uyum, Neden?, Senin için, Karşılaştır. Rezerve uçuşta şerit yok (karar kalmadı). Plan'da gör bağlantısı amber (mockup yeşil): küçük. |
| Durumlar: boş, aranıyor, önerimiz, seçildi, rezerve, ayarlandı (uçuş/otel/ulaşım/etkinlik) | **H1** | A | A | Etkinlik "Ayarlandı" kartı Yapılacaklar'a gidiyor (noBooking idea sayılıyor, eski kural). Aranıyor yalnız uçuşta; otel/ulaşımda yok. |

## DOKUNULMAZ liste (§2.3), canlı build'de denendi
| # | Sonuç | Kanıt |
|---|---|---|
| 4 Rötar | geçti (H4 kozmetik) | `ozel/rotar-flight-1440.png`: kırmızı çerçeve, eski saat çizili, yeni saat, Kapı 14, kaynak; e2e 5014-5045 |
| 4 PNR yalnız uçuş günü | geçti | uçuş günü "Rezervasyon kodu ABC123" (`ozel/rotar-flight-1440.png`); 2027 uçuşunda yok (`1440/ozora-info-flight.png`: ⓘ'de satır yok); e2e 943/986/1007 |
| 5 ••• / × / ✓ Aldım / Ayarlandı | geçti | e2e 1194-1207 (gri `rgb(107,102,95)`, uyarı ve Aldım yok), 1394-1401; kartlarda ✓ Aldım, ••• görünür |
| 6 14 gün, "iptal bugün biter" | geçti | `1440/sample-sec-stay.png` kırmızı "İptal bugün biter"; "⏳ Uçuşa 3 gün · bilet alınmadı" (amber) |
| 1 fiyat/saat/uyarı gizlenmez | geçti | tüm durum ekranlarında fiyat ve saat görünüyor |
| 2 uydurma veri yok | geçti | URL'siz kartta düğme yok, tahmin ≥3 teklif, "gün seç" |
| 3 bölüm sırası | geçti | Ozora ve sample 6 bölüm aynı sıra |
| 7 durum asla yalnız renkle | **H1** | Seçildi kartları |
| 14 paylaşılan gezi | kısmen | Süper oy kodu `Pano.tsx:87,433`, e2e 4690-4871 sunucusuz; gerçek paylaşım sunucusu denetlenemedi |
| 10 L() çifti, em-dash | geçti | 255 yeni L(), hepsi iki dilli; yeni em-dash 0; U+2013 yalnız tarih aralıklarında |

## Özel kontroller
- **Büyük harf**: yeni `text-transform:uppercase` yok (app.css'te 14 → 10). Mockup'ın büyük harf etiketi uygulanmadı (N9): bilinçli sapma, Emre teyidi açık.
- **TR/EN eşliği**: 255 yeni `L()` çağrısı iki dilli; JSX'te L() dışı Türkçe metin yok; EN ekranlarında kullanıcı verisi dışında Türkçe sözcük yok.
- **Erişilebilirlik**: ⓘ gerçek `<button>` (aria-label "Ayrıntı"), Tab ile ulaşılıyor, odakta açılıyor, Esc kapatıyor; arka yüz `role=group` + `aria-labelledby`, odak içeri alınıyor, diğerleri `inert`, Esc kapatıyor ve odak "Değiştir"e dönüyor; adsız kontrol 0, `alt`'sız görsel 0. Öneri (engellemez): ⓘ'ye `aria-expanded`, arka yüze `aria-modal`.
- **`.pk-card{overflow:visible}` yan etkisi**: kart dışına taşan öğeler yalnız tasarlananlar (köşe yüzü 7-8 px, hover ikon şeridi `pk-strip`); uzun ad/rötar/rezerve otel kartında metin taşması yok (`ozel/`, `scrollWidth` taraması boş). Kartlar yalnız 1440 ve 390'da tarandı.

## 390 px yatay taşma (özet)
Sayfa (`documentElement.scrollWidth > innerWidth`) taşması: **Plan** Portekiz 0, Ozora **+127**, Durumlar **+174** (kök neden H3, 0.36.84'te de aynı); **arka yüz açık** Portekiz **+94** (EN +128), Durumlar +232/+224 (H3 üstüne H2); **Yolculuk, Gün gün, Pano, ayrıntı penceresi** 0 (üç gezide). Öğeler: `ol.ts-strip` > `li.ts-item` (şerit), `div.cat-head` (arka yüz).

## Eski veriyle açılış (0.36.84 → yeni build)
Kalıcı profil `--user-data-dir`, eski build `git archive origin/release extension`: 3 gezi (örnek, Ozora, Durumlar), 46 kayıt (10 rezerve), 3 liste, 1 analiz, 2 mesaj, tercihler, 12 localStorage anahtarı. Aynı profille yeni `dist` yüklendi. Uzantı kimliği aynı (`ohjibcbimgmelhknmnidchpbmgjhkioi`, manifest `key` eşit). IndexedDB sürümü 5 değişmedi; tüm depolar ve sayılar birebir aynı; 3 gezi, tüm bölümler (6) ve Pano sayıları (16/10/20) yerinde; JS hatası 0; "Yeni"/taslak/hareket localStorage anahtarı olmadan ekranlar tam (`olddata/*.png`: plan, Yolculuk, Gün gün, Pano). Kart sayıları (7→11, 10→13, 16→19) kayıp sayılmadı (kayıt sayıları aynı); fark sayım seçicisinin (`.pk-card, .ev-card`) v46'da etkinlik/taslak kartlarını ayrı sınıfla çizmesinden kaynaklanıyor olabilir (nedeni ayrıca doğrulanmadı). Not: paylaşılan gezi kaydı (Supabase) ile açılış denenemedi.
