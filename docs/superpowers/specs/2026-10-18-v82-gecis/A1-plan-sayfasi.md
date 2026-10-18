# A1 · Plan sayfası: canlı (0.37.1) ↔ yeni tasarım (v77–v82) özellik envanteri

Hazırlayan: araştırma ajanı, 18 Ekim 2026. Yalnız okuma yapıldı, hiçbir repo dosyası değişmedi.

**Kaynaklar**
- Canlı kod: `/home/user/trip-radar` (dal `plan-v46-kod`, son commit "Sürüm 0.37.1"). Tablodaki yollar bu köke göre: `src/app/...`, `src/lib/...`, `static/app.css`.
- Yeni tasarım: `docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md` (v77…v82), `2026-10-14-plan-v65-v66-tasarim-notu.md` ("Kodlarsak kaybedeceğimiz şeyler"), `2026-10-13-emre-kararlari.md`; prototip `docs/mockups/plan-v82-standart/kaynak/` (`z82.py` niyet kutuları, `hero82.py` üst özet, `gen82.py` yardımcılar/ayrıntı panelleri, `mk82.js` davranışlar + Pano + Yolculuk, `data*.py` örnek veri) ve `plan-v81-yolculuk/kaynak/mk81.js` (v82 bunun üst kümesi). Hepsi `/home/user/wt-v32` altında.
- Prototip, canlı DOM'u alıp `section.hx` (hero), `.plan-bar`, `.ts-strip` (gezinin şekli), `.sbar-slot` (yapışkan şerit) ve `.cat-sheet` (kategoriler) parçalarını kendi parçalarıyla değiştiriyor (`z82.py` montaj bölümü). Sohbet sütunu ve Plan/Pano sekmeleri canlıdan aynen geliyor.

**Değerlendirme dili**
- **VAR**: yeni tasarımda aynı işi gören bir karşılığı çizilmiş (görünüm farklı olabilir).
- **KISMEN**: bir kısmı çizilmiş; eksik olan "Not" sütununda.
- **YOK**: tasarımda hiç yok (prototipte de yok). "(bilinçli)" yazıyorsa tasarım notunda açıkça kaldırıldığı yazıyor.
- **YENİ**: canlıda olmayan, tasarımla gelen özellik (karşılaştırma için listelendi).

---

## 1. Üst özet (hero)

| Özellik | Canlıda nerede (dosya:satır) | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Şehir fotoğrafları + şehir değiştirici | `src/app/TripHero.tsx:112-118, 182-200`; foto arama `TripPanel.tsx:386-422` | Her ana şehrin fotoğrafı; 2+ şehirde sol üstte şehir düğmeleri; 6 sn'de bir sonraki şehre geçer, dokunuş sayacı sıfırlar; fotoğraf yüklenemezse gizlenir | KISMEN | v82 mozaik: büyük kapak + 6 kare, döngü ve şehir seçimi yok. Kapak altında küçük şehir çipleri ya da kareye tıklayınca o şehir önerilir. |
| Fotoğraf künyesi ⓘ | `TripHero.tsx:32-53, 201`; `lib/cityImages.ts creditLine` | Kapak sağ altında küçük i; üzerine gelince "Fotoğraf: Ad / Unsplash" (bağlantılı). PDF'te tam yazılır | YOK | Lisans gereği zorunlu. Mozaikte her karede de gerekecek (Places API da künye ister). Kapak ve kare köşelerine ⓘ. |
| "N kayıt işleniyor" rozeti | `TripHero.tsx:202-208` | Link/ekran görüntüsü okunurken fotoğraf üstünde dönen halka + sayı | YOK | Kapak köşesine ya da yapışkan şeride. |
| Geri sayım | `TripHero.tsx:209`; `lib/countdown.ts:16-19` | "178 gün kaldı", "Yarın", gezi sırasında "3. gün / 16", sonra "Bitti" | KISMEN | v82 tarih bölmesinde "16 gün · 178 gün kaldı". Gezi sırası ve bitti halleri çizilmedi. |
| Gezi ••• menüsü | `TripHero.tsx:213`; `App.tsx:170-226` | Link ya da ekran görüntüsü ekle · Belgeler · Bu geziyi paylaş / Paylaşım kodu · Planı PDF olarak indir · Rotayı haritada gör ↗ · Bu gezide yeni sohbet başlat · Geçmiş ve çöp kutusu · Ayarlar · Örnek geziyi yükle · Bu geziyi sil | YOK | `hero82.py` menüyü içermiyor (hero bütünüyle değiştirildiği için düştü). Kapak sağ üstüne ⋯ konmalı; Belgeler, PDF, Geçmiş yalnız buradan açılıyor. |
| Gezi adı | `TripHero.tsx:215` | h1 | VAR | Kapak üstünde 30 px. |
| Tarih satırı | `TripHero.tsx:216-233` | "1–16 Nisan · 16 gün"; kayıtlardan çıkarıldıysa başında "~" ve "Tahmini · kayıtlardan" ipucu; tarih yoksa "Tarihler kaydettikçe netleşir" | KISMEN | v82 tarih bölmesi + şehir şehir günler ipucu VAR. "~ tahmini" ve tarihsiz boş hal yok. |
| Lead cümlesi | `TripPanel.tsx:589-597`; `TripHero.tsx:234`; `lib/heroText.ts statusSentence` | Başlangıç sohbetinden "2 uçuş ve 31 gece seni bekliyor", yoksa AI'nın ruh hali cümlesi (gezi başına bir kez sorulur, `TripPanel.tsx:424-446`), yoksa "Uçuşlar hazır, 2 karar bekliyor" | YOK | Kapakta şehirlerin altına tek satır olabilir. |
| Plan hücreleri (4 sayaç) | `TripHero.tsx:124-129, 235-253`; ipucu `66-83` | "2 uçuş · 4 konaklama · 3 ulaşım · 3 deneyim"; üzerine gelince kayıtların adı ve durumu, "Basınca bölüme gider."; tıklayınca o bölüm açılır, kaydırılır | YOK | Kategori satırlarının özeti aynı sayıyı söylüyor; hover listesi kayboluyor. Karar gerek. |
| İlerleme başlığı + iki tonlu çubuk | `TripHero.tsx:139-179, 254-263`; `lib/lifecycle.ts heroNumbers` | "Planlananların %67'si rezerve" / "Her şey hazır" / "Planlama"; çubuk koyu = rezerve, açık = planlanan | KISMEN | v82: "%50 hazır · 7 karar" + çubuk, ipucu "3 alındı · 2 seçildi · 7 karar bekliyor". Yüzde tanımı farklı (canlı karar bekleyenleri yüzdeye katmaz). Karar gerek. |
| İlerleme kelimeleri | `TripHero.tsx:154-178` | "3 ihtiyaç karar bekliyor · 2 rezerve edilecek · 1 belge eksik · 2 ulaşım sorusu" | KISMEN | v82'de yalnız "n karar". "Belge eksik" ve "ulaşım sorusu" yok. |
| Yapılacaklar listesi | `TripHero.tsx:279-285`; `Progress.tsx:49-90`; `TripPanel.tsx:805` | Kelimeler tıklanınca hero altında açılır: Karar bekliyor · Rezerve edilecek · Belge eksik · Ulaşım · nasıl gidilecek · İptal süresi; satıra basınca o karta gider, kart parlar (`Progress.tsx:9-16`) | YOK | "%50 hazır" bölmesine tıklayınca açılan pencere olabilir. |
| ⏳ N (ücretsiz iptal bitiyor) | `TripHero.tsx:264-274` | İptal süresi yaklaşan rezervasyon sayısı; tıklayınca yalnız onlar | YOK | Hazırlık ya da bütçe bölmesine ⏳ rozet. |
| Ana düğme | `TripPanel.tsx:617-635`; `TripHero.tsx:293-300` | Kayıt yoksa "İlk kaydı ekle" (ekleme penceresi); iş varsa "Planı tamamla" (ipucunda "Karar ver: Kyoto konaklama"); %100'de "Planı PDF olarak indir"; hepsi tamamsa "Paylaş" | KISMEN | v82 "Sıradaki: Kyoto oteli →" (kategoriyi açar, niyete kaydırır, parlatır) VAR. Boş gezi, %100 ve tamam halleri yok. |
| İkincil düğme | `TripPanel.tsx:637-644`; `TripHero.tsx:301-305` | Plan bitmeden "PDF indir", bitince "Paylaş" | YOK | Emre kararı (hero-pdf): "İkisinde de dursun". Şeride ikincil düğme. |
| Kimler gidiyor kutusu | `Travellers.tsx:70-118` | Yüzler (foto/baş harf, en çok 4 + "+n"), "Sen, Sabine" + "2 kişi"; kimse yoksa kesikli "Kimler gidiyor? · Kişi sayısı kayıtlardan anlaşılır"; ad yoksa "Birini davet et" | KISMEN | v82 yüzler + "2 kişi" VAR; boş hal yok. |
| Yüz ipucu (son hareket) | `Travellers.tsx:147-158` | Paylaşılan gezide "Sabine · Gora Kadan'ı rezerve etti · dün" | VAR | `hero82.py` x-face data-tip. |
| Kimler gidiyor penceresi | `Travellers.tsx:170-284` | Ben (ad), paylaşımdakiler ("paylaşımda" etiketi), sohbette söylenen adlar ve ×; "İsim ekle" kutusu (Enter); kendi adını yazınca "X sensin" notu; Kişi sayısı −/+; "N kişinin adı yok; sayıya dahil"; "İsim eklemek paylaşmaz; davet etmek ayrı."; "Birini davet et (paylaş)"; kişinin nereden geldiği ("Alicante'den"); son hareketi | KISMEN | v82 pencere: yüz, ad, son hareket, "+ Arkadaşını davet et". Ad ekleme/çıkarma, kişi sayacı, nereden, notlar yok. |
| Kişi fotoğrafı seçme | `Profile.tsx:101-134` | Yüz dairesine tıkla → dosya seç (yalnız bu bilgisayarda), × kaldır; paylaşan kendi fotoğrafını verdiyse kilitli | YOK | Pencere satırlarına eklenebilir. |
| Paylaşım satırı | `Travellers.tsx:137-141`; `Share.tsx:154-174` | "Sabine ile paylaşılıyor · 2 dk önce" / "eşitleniyor…" / hata | YOK | Kişiler bölmesinin altına. |
| Gezinin tarzı çipleri | `TripFacts.tsx:58-75`; `TripPanel.tsx:565-570` | AI'nın sabit listeden seçtiği tarz kelimeleri + bütçe düzeyi, renkli çip; boşsa "Tarzın konuştukça belirir" | KISMEN | v82 Tercihler düğmesindeki "Ekonomik · merkeze yakın · yerel yemek" bunu kısmen karşılıyor; tarz çipi ayrı değil. |
| Bütçe bloğu | `TripFacts.tsx:122-203` | Toplam (değişince sayarak), Rezerve / Planlanan / Boşta / Aşıyor satırları; "Tahmini toplam ~€X · bütçeye sığar · €Y pay" ya da "bütçeyi €Z aşar"; bütçe yoksa bilinen toplam + "Bütçe belirlenmedi"; boş "Fiyatlı kayıtlar geldikçe toplanır" | KISMEN | v82 "~€6.900 / €8.000 bütçe". Aşıyor (kırmızı), bütçesiz ve boş haller çizilmedi. |
| Bütçe penceresi | `TripFacts.tsx:204-229` | Kategori dağılımı, Kalan, "Karar bekleyenler seçilince yaklaşık €X daha eklenir", "N fiyat sayılamadı" | VAR | `hero82.py` bud_pop; "sayılamadı" notu yok. |
| Tercihler etiketleri | `IntentCard.tsx:188-243` | Birkaç etiket (şart/çok önemli koyu), "+N tercih ›" / "Düzenle", "1 soru" işareti; boşsa "Konuştukça ve seçtikçe seni tanıyacağım." | VAR | Boş hal çizilmedi. |
| "Seni böyle anladım" penceresi | `IntentCard.tsx:255-286`; girişler `32-180` | Her giriş: kapsam (Tüm gezi / Konaklama / yer adı), metin, kaynak (söylediğin, onayladığın, not, elendi), × kaldır; AI'nın tahmin sorusu Evet / Hayır; "Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter." | VAR | `hero82.py` pref_pop. |
| Ülke + bayrak | `TripFacts.tsx:79-92` | Bayrak + ülke adı; çok ülkeli gezide hepsi | KISMEN | v82 tek "Japonya" çipi (ipucunda şehirler); bayrak ve çok ülke yok. |
| Şehir şehir hava | `TripFacts.tsx:93-105`; `useWeather.ts`; `lib/climate.ts weatherTitle` | Her şehir: ad, gökyüzü ikonu, en yüksek °; ipucunda tahmin ya da 10 yıllık ortalama, yağışlı gün | KISMEN | v82 tek "6–19°" çipi, ipucunda şehir şehir. İkon ve tahmin/ortalama ayrımı yok. |
| Para / priz / saat / dil | `TripFacts.tsx:235-275` | Para (kur ipucu "€1 = ₺38,20"), priz (uyum: "Adaptör gerekir"), saat farkı ("Sende 12:00 iken orada 18:00. Uçuş saatleri yerel saattir."), dil | VAR | `hero82.py` çipleri. |
| Vize çipi | (canlıda hero'da yok, Belgeler'de) | — | YENİ | v82 hero çipi "Vize gerekmiyor". |
| Hero boş halleri | `TripHero.tsx:184-187`; `TripFacts.tsx:107-110` | "Şehir belli olunca fotoğrafı gelir", "Ülke ve hava, şehir belli olunca gelir" | YOK | Yeni gezi (omurga yeni) için çizilmeli. |
| Bilgi gelince süzülme | `useAppear.ts`; `static/app.css:1140` | Boş blok dolunca bir kez belirir | YOK | Hareket. |
| Yapışkan özet şeridi | `StickyBar.tsx:20-104`; `TripPanel.tsx:749-763` | Hero kaydırılınca üstte: kapak, ad, tarih · kalan gün, halka "%67 rezerve" (ipucu rezerve/seçildi/karar), "~€7.347 / €8.000" + sığar/aşar noktası, Plan / Pano anahtarı, "Sıradaki: X →" ya da "✓ Her şey hazır" | KISMEN | v82 `h-mini`: görsel, ad, tarih · kişi, çubuk, %hazır · karar, bütçe, Sıradaki. Plan/Pano anahtarı, aşıyor işareti, hazır hali yok. |
| Özeti küçült / Özeti aç | — | — | YENİ | `hero82.py` x-fold / x-slim. |
| Mozaik 6 kare | — | — | YENİ | Kare seçimi (plandaki ve biriken yerler + Places foto) kodda yok. |

## 2. Plan çubuğu ve görünümler

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Plan · Pano sekmeleri | `TripPanel.tsx:726-746` | Planda kayıt varken; Pano yanında kayıt sayısı | VAR | Prototip canlı DOM'dan alıyor; Pano'yu açıp kapatıyor (`mk82.js setTab`). |
| Pano haber noktası + ipucu | `TripPanel.tsx:731-738`; `usePanoDot.ts:15-51`; `PanoNewsTip.tsx:8-22` | Paylaşılan gezide diğer kişi son ziyaretten beri bir şey yaptıysa nokta; ipucu "Son ziyaretten beri 3 şey · Sabine · X'i kaydetti · 2 sa" | YOK | Sekme üstüne nokta. |
| Belgeler sekmesi | `TripPanel.tsx:740-744, 925-926` | ••• > Belgeler açılınca üçüncü sekme | YOK | Bkz. bölüm 18. |
| Sekme vurgusunun kayması | `hareketDili.ts:3-5, 12`; `static/app.css:4240-4241` | Plan/Pano ve Kategoriye göre/Yolculuk/Gün gün: vurgu yeni sekmeye kayar (260 ms), yeni görünüm yandan 12 px gelir | YOK | Hareket (m-sekme kararı). |
| Üstte ışık çizgisi | `TripPanel.tsx:748`; `WorkPill.tsx:12-19`; `static/app.css:5249` | Kayıt okunurken sayfanın üstünde koşan ince ışık (0,4 sn'den kısa işte görünmez) | YOK | Hareket (m-isik). |
| "Plan" başlığı | `CategoryPlan.tsx:95-100` | "Plan"; ipucunda gece özeti | VAR | v82 30 px + "Gezinin omurgası · 7 karar bekliyor" (alt satır yeni). |
| Görünüm seçici | `plan/PlanOrder.tsx:23-37` | Kategoriye göre · Yolculuk sırasıyla · Gün gün | VAR | Gün gün prototipte yalnız tost. |
| Plan başı "+ Ekle" | `CategoryPlan.tsx:98`; `cards/AddSheet.tsx:20-27` | Tüm şablonlarla ekleme penceresi | YOK (bilinçli, v81) | Kategori sonundaki "+ X ekle" kalıyor; ama hiç kaydı olmayan türü (ör. ilk araç kiralama) eklemenin yolu kalmıyor. Karar gerek. |
| Renk anahtarı (PlanKey) | `PlanOrder.tsx:10-21` | Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı örnek kutuları | YOK (bilinçli, v81) | Durum çizgisi renkleri (kesik/kum/mor/yeşil/gri) artık hiçbir yerde açıklanmıyor; ipucu ya da ilk kullanımda bir kez açıklama. |
| Gezinin şekli şeridi | `plan/TripShape.tsx:51-82`; şehir ipucu `25-49` | Duraklar resimli halkada (arama kesikli, seçildi kum, rezerve yeşil), aralarında yol boyunca giden uçak/tren + süre ("11 sa"); üzerine gelince günler, seçilen yer, hava, foto; tıklayınca o yerin bölümü | YOK (bilinçli, v80) | Şehir ipucundaki bilgiler kısmen hero ipuçlarında. |
| Plan uyarıları | `CategoryPlan.tsx:102-106`; `TripPanel.tsx:916-920, 929-933` | "⚠ …" satırları (çakışan tarih vb.) | YOK | Plan başlığı altında ince uyarı şeridi. |
| Başlangıç kartı | `start/StartGuideCard.tsx:15-63`; `TripPanel.tsx:858-873` | Yeni gezide bir kez: "X hazır · Üç adımda yola hazır", Uçuşları bul · Konaklamaları seç · Önerilere bak (kendiliğinden tiklenir), ×; "Başlangıç yaklaşık: 3 Mayıs. Bu tarih doğru" | YOK | "Omurga yeni oluştu" halinde Plan başlığı altına. |
| Paylaşım değişiklik bildirimi | `ShareSafety.tsx:47-99`; `TripPanel.tsx:856` | "Sabine bütçeyi değiştirdi: €8.000 → €9.000 · senin panona da geldi" + Geri al / Tamam; eskidiyse "Daha yeni bir değişiklik geldi…" | YOK | Plan başlığı üstünde. |
| Okunan kayıt bekleme kartı | `arrive/useArrivals.tsx:1-20`; `arrive/ArriveViews.tsx:41-100`; `CategoryPlan.tsx:107, 124` | Tahmin edilen bölümün başında (bilinmiyorsa plan başında) site ikonu/küçük resim, ad, aşama, çubuk; 0,4 sn sonra iskelet; okunamazsa "Okunamadı · neden · Tekrar dene / Kaldır" | YOK | İlgili niyetin seçenek sırasında iskelet kart. |
| Diğer görünümlerde hata listesi | `TripPanel.tsx:831-854` | "⚠ başlık · hata · Tekrar dene" | YOK | |
| İnen kartın tostu | `useArrivals.tsx`; `ArriveViews.tsx:103-115` | Görüş dışında inen kart: "Konaklama'ya eklendi: Casa Azul · Göster · ×" | YOK | |
| **Yolculuk sırasıyla** (görünüm) | `plan/StoryView.tsx:23-95`; `plan/JourneyCards.tsx` | Tek sütun, kartlar yaşanış sırasıyla, aralarda noktalı bağ | VAR | v82 bölümler + zaman çizgisi (`mk82.js stepHtml/renderTrip`). |
| · Yola çıkış / Eve dönüş kapsülleri | `StoryView.tsx:32-37, 76-82` | "Yola çıkış · İstanbul", yeşil "Eve dönüş · İstanbul" | KISMEN | v82 bölüm başlıkları (İstanbul → Tokyo … Osaka → İstanbul). |
| · Şehir başlığı | `StoryView.tsx:44-57` | Şehir, tarih · gece; ipucunda "gezinin 2–5. günü" | VAR | v82 foto + tarih/gece + "n hazır · n karar". |
| · Uçuş/ulaşım plan kartı olarak | `StoryView.tsx:38-43` | Tam uçuş/yol kartı, aynı eylemlerle | KISMEN | v82 küçük adım kartı + tek eylem (Seçeneklere bak / Ara / Bunu seç / fiyat + Rezerve et / E-bilet aç). |
| · Konaklama küçük kartı | `JourneyCards.tsx:85-144` | Foto/çizim, "Konaklama · 3 gece" (kamp: "Kamp"), ad ya da "Kyoto için konaklama", Giriş/Çıkış, platform, "N seçenek", ⏳ iptal uyarısı, "2 gece için yer seçilmedi", aşama rozeti, gece fiyatı; basınca plandaki kartına gider | KISMEN | ⏳ ve boşluk uyarıları, platform, kamp yok. |
| · Etkinlik kartı | `JourneyCards.tsx:147-195` | "Etkinlik · gezinin sebebi", gün kapsülü ya da "gün seç", saat, marka, kim buldu, Bilet alındı/Seçildi, kişi başı fiyat | KISMEN | "Gezinin sebebi", "gün seç", kim buldu yok. |
| · Yapılacaklar kutusu | `JourneyCards.tsx:198-230` | Şehrin yapılacak ve restoranları küçük karelerde, rezerve tiki | VAR | v82 her biri ayrı adım. |
| · Yola çıkmadan (hazırlık, eSIM, sigorta) | — | — | YENİ | |
| · "Tokyo için 3 etkinlik önerisi › Önerilere bak" | — | — | YENİ | |
| Gün gün / Harita alt anahtarı | `TripPanel.tsx:874-893`; `days/dayMode.ts` | Gün gün ve Harita'da üstte Plan başlığı + Ekle + anahtar; Kompakt · Liste · Kartlar · Harita (cihaz başına hatırlanır) | YOK | Bkz. bölüm 14-15. |

## 3. Kategori satırı

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Bölüm listesi ve renkleri | `plan/sectionMeta.ts:18-37` | Uçuş, Konaklama, Ulaşım, Etkinlik ve turlar, Yapılacaklar ve restoranlar, Belgeler ve internet, Hazırlık, İlham (Restoranlar kendi bölümü ama Yapılacaklar altında çizilir) | KISMEN | İlham planda yok, Pano'ya taşındı (v81). |
| İlham bölümü | `plan/SectionTimeline.tsx:53`; `ideas/IdeaList.tsx:125-173` | Reels/TikTok/YouTube/Pinterest/blog kartları; oynat simgesi, başlık (kaynağa link), kim kaydetti, platform rozeti, şehir, "+ Gün", × sil; "Bir güne koyunca Yapılacak şeyler'e geçer." | KISMEN | Pano İlham'da kartlar VAR; gün verme ve silme yok. |
| Başlık: ikon, ad, kalem sayısı | `plan/Section.tsx:51-63` | Bölüm renginde çizgi ikon, ad, küçük sayı | KISMEN | v82 ikon + ad; sayı yok. |
| Durum satırı | `Section.tsx:38, 61, 119-125, 179-196` | "1 rezerve · 2 seçildi · 1 aranıyor" (Önerimiz ayrı sayılır); Etkinlik "2 planda · 3 fikir"; Hazırlık "2/6 hazır"; Yapılacaklar "8 planda · 6 öneri · 1 yapıldı"; İlham "kaydettiğin video ve gönderiler" | VAR | v82 "1 alındı · 1 seçildi · 2 karar" + "n fikir". |
| Anahtar kelime özeti | — | — | YENİ | "4 şehir · 14 gece", "2 uçuş · gidiş ve dönüş". |
| Mini görseller (en çok 3, +n) | — | — | YENİ | |
| "N öneri" sayacı | `Section.tsx:65` | Bölümde bekleyen öneri sayısı (3/4'e katılmaz) | YOK | Satırın sağına küçük ✨ n. |
| İki tonlu çubuk | `Section.tsx:40-45, 69-74` | Koyu rezerve + açık seçildi; tamamlanınca "done" | VAR | |
| Bütçe: harcanan + "€500 ayrıldı" | `Section.tsx:80-87`; `TripPanel.tsx:528-530` | Seçilen+rezerve toplam ve gezi bütçesinden düşen pay | VAR | |
| Bütçe ipucu | `Section.tsx:141-173` | "Bu bölümün parası": Rezerve / Seçildi / Boşta ya da Aşıyor + "Ayrılan pay… bölünür." | YOK | Bütçe rakamına hover. |
| Aç/kapa ve ok | `Section.tsx:51-52, 90-94` | Başlığın tamamı tıklanır | VAR | |
| Aç/kapa animasyonu | `Section.tsx:46-48, 97-113`; `motion.ts:174-200` | Izgara 0fr→1fr 260 ms, kartlar 80 ms geç, kapanış da animasyonlu | YOK | Emre kararı m-bolum: "çizime uy". |
| Açık bölümlerin hatırlanması | `sectionMeta.ts:72-100` | Birden çok bölüm açık olabilir; seçim gezi başına bu tarayıcıda saklanır; ilk bakışta iş kalan açık, biten kapalı | KISMEN | v82 akordiyon (bir açık, diğeri kapanır, açılan üste kayar), hatırlama yok. Karar gerek. |
| Otomatik açılma | `TripPanel.tsx:186-216` | Kart bölüm değiştirince (Ulaşım → Uçuş), Gün gün/Yolculuk'tan "Planda göster", to-do'ya basınca bölüm açılır, kart parlar | KISMEN | `mk82.js goInt` var; bölüm değişiminde açılma yok. |
| Bölüm sonu "+ Ekle" | `Section.tsx:104-109`; `TripPanel.tsx:285-290` | Tek şablonlu bölümde anında ekler; çoksa yalnız o bölümün karolarıyla pencere | VAR | v82 "+ Konaklama ekle"; davranış tanımsız (prototipte tost). |
| Gizlenenler · N göster | `Section.tsx:102`; `plan/HiddenList.tsx:16-90` | Elenen ("Elendi · Geri al"), bir rezervasyonun kapattığı seçenek (neden), iptal edilen ("İptal edildi · iade notu"), Gerek yok denen transfer ve geceler ("Geri getir"); adına basınca ayrıntı | YOK | Kategori sonunda sessiz satır. |
| Boş bölüm çipleri | `CategoryPlan.tsx:142-152` | Hiç kaydı olmayan bölümler alttaki "Ekle:" satırında çip olarak | YOK | Kategoriler listesinin altına. |
| Yalnız önerisi olan bölüm | `CategoryPlan.tsx:111-117` | Kapalı çizilir, başlıkta "2 öneri" | YOK | |
| Durum çizgisi ve kutu kenarı | — | — | YENİ | Sol dikey çizgi, noktanın rengi durum. |

## 4. Niyet / ihtiyaç kutusu

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| İhtiyaç kartı (seçenekli, karar bekleyen) | `cards/NeedCard.tsx:74-215` | Tek boy kart: ihtiyaç adı; konaklama/eSIM/sigortada çizim + şehir büyük + "5 gece · istekler"; "€118'den başlıyor"; 3+ gerçek fiyattan "tahmini" aralık (gece/kişi); Kendin ara; ayak: kaydedenlerin yüzleri + "3 seçenek ›" (karta arka yüz açar), ✨ | VAR | v82 niyet başlığı + ilk 3 seçenek açık. "Tahmini" yalnız boş halde. |
| Niyet bilgi satırı | `NeedCard.tsx:189-191`; `MediaCard.tsx:49-73` | Şehir, tarih, gece | VAR | v82 52 px görsel, 19 px ad, ikonlu bilgi; varsayılan kişi sayısı gizli. |
| İstekler ("Aradığımız") | `NeedCard.tsx:61-65, 201-205`; uçuşta `lib/cardTicket.ts flightWants` | Konaklamada tercih notlarından en çok 3; uçuşta "Aradığımız: direkt" | VAR | v82 istek çipleri (şart / istek) her türde. |
| Durum çipi | `CardShell.tsx:16-20`; `pk-lab` | Arıyoruz / Önerimiz / Seçildi / Rezerve / Ayarlandı | VAR | v82 sağ üstte sabit yerde. |
| "Pano n" | `BackFace.tsx:418-421`; `PlanCard.tsx:215-217` | Arka yüzde "Pano'da aç · +N", detayda "Pano'da N alternatif" | VAR | v82 her niyette sabit "Pano n". |
| İhtiyaç ⋯ menüsü | `NeedCard.tsx:125-129` | Değiştir · Ben hallettim · (tek seçenekte) Kimin için? + kart menüsü | KISMEN | v82 ⋯: Ayrıntı · Gerek yok. "Ben hallettim" ve "Kimin için?" yok. |
| × katlama | `CardShell.tsx:244-266, 342` | × kartı silmez, yerinde "X kaldırıldı · Neden? [Gerek yok] [Ben hallettim] · Geri al" satırına döner; 15 sn cevapsız → Gerek yok | KISMEN | v82: Gerek yok → niyet soluklaşır, "Gerek yok dedin. Geri al". "Ben hallettim" yolu yok. |
| Kendin ara | `cards/EmptyCard.tsx:51-71`; `lib/searchLinks.ts:80-94` | Marka harfi kendi renginde; üzerine gelince ad + ↗, yeni sekme | VAR | v82 logolar; sağlayıcılar dinamik kayıttan gelecek (v81 kuralı). Bkz. bölüm 24. |
| ✨ AI'dan öner | `cards/AskButton.tsx:10-19` | Sohbete "X için öneri bul" yazar | KISMEN | v82 yalnız boş niyette "AI'dan öner"; seçenekliyken "daha fazla öner" yok. |
| "Aranıyor" hali | `cards/searching.ts:14-23`; `NeedCard.tsx:115`; `EmptyCard.tsx:294` | ✨ Seçenek ara'ya basınca 60 sn "Aranıyor" + ince çubuk | YOK | |
| Boş niyet çerçevesi | `EmptyCard.tsx:132-235` | Kesikli çerçeve, "Arıyoruz", soluk çizim, ad, gri satır, Kendin ara, durum kelimesi ("Henüz otel yok", "Bilet yok · 2 kişi", "Alınmadı", "Kiralanmadı"), ⏳ tarih uyarısı, "Gerek yok", ✨ | VAR | v82 "Henüz seçenek yok", "tahmini €90–160 / gece", Kendin ara simgeleri, AI'dan öner. Durum kelimeleri ve ⏳ yok. |
| Bölge çipleri | — | — | YENİ | "Namba ~€110" vb.; veri kaynağı yok. |
| "✨ Senin için N öneri ▾" teklif satırı | `cards/OfferRow.tsx:118-185, 307-352`; kaynak `lib/offerSources/index.ts` | Canlı kaynak (Aviasales, Tripadvisor/Xotelo, Viator) teklif getirince; açık/kapalı bölüm başına hatırlanır; uçuşta 3+ fiyattan tahmin; her teklif: rota ya da foto, "✨ neden", kaynak + tazelik ("2 sa önce"), fiyat, "Ekle →", × "Bunun gibileri gösterme" | KISMEN | v82'de AI önerileri seçenek listesinde; "Bunun gibileri gösterme" ve tazelik yok. |
| Konaklama üçlü seçimi | `OfferRow.tsx:193-304` | "Sana en uygun / Daha ekonomik / Daha konforlu"; foto, ad, ★ puan · yorum · semt, fiyat, ✨ neden, "Favorile" → "✓ Favorilendi", "İncele ↗" | KISMEN | v82 "Önerimiz" ve "En ucuz / En hızlı" şeritleri; üçlü etiket yok. |
| Kural önerileri | `plan/SuggestionCards.tsx:7-45`; `lib/suggestions.ts:165-282` | ✨ başlık + neden + "Plana koy" / "Gerek yok"; uyarı ⚠ "Kısa aktarma: 45 dk (IST)" + "Anladım"; kurallar: Konaklama bul · şehir tarih, Havalimanı/İstasyon transferi · Taksi, Aylık motor ya da araç kiralama; AI incelemesi ve sohbet önerileri; reddedilince kartın altında not | YOK | Sigorta ve eSIM önerisi boş kart olarak VAR. Kategori açılınca niyetlerin üstünde ince satır; uyarı ilgili niyete ⚠ çip. |
| Vize satırı | `plan/VisaRow.tsx:8-33` | Gerekmiyorsa yeşil "✓ Vize gerekmiyor · Türk pasaportuyla 90 güne kadar"; gerekiyorsa sarı "! Vize gerekiyor · e-Vize" + "Resmî kaynak ↗" + "✓ Vize alındı" (→ "Geri al"); diğer tür "Vize · …" | KISMEN | v82 yalnız gerekmiyor hali. |
| Boş eSIM | `EmptyCard.tsx:649-675` | "eSIM · Japonya", "tüm gezi için internet", Alınmadı, Airalo/Holafly, Gerek yok ("eSIM gerekmiyor"), ⋯ Plana koy / Ben hallettim / Gerek yok, teklif satırı | KISMEN | v82'de eSIM seçenekli çizildi; seçeneksiz hali yok. |
| Boş sigorta | `EmptyCard.tsx:681-707` | "Seyahat sağlık sigortası", "Japonya · zorunlu değil ama önerilir", Alınmadı, "Sigortaları karşılaştır" (Google), Gerek yok, ⋯ Plana koy / Ben hallettim | VAR | v82: tahmini €25–45, Kendin ara Google, AI'dan öner. "Plana koy" yok. |
| Boş konaklama geceleri | `EmptyCard.tsx:490-539` | Şehir, "4 gece · 2 kişi · otel seçilmedi"; ayrı söylenmiş konaklamada ad/fiyat yerinde düzenlenir; Booking/Airbnb; "Gerek yok" ("Bu geceler için yer gerekmiyor"); tekne/kamp/karavan gecesi "Rezervasyon gerekmez" | KISMEN | v82 Osaka örneği; kendi konaklaman (kamp) hali yok. |
| Eksik varış/dönüş uçuşu | `EmptyCard.tsx:451-483`; `plan/PlanEntry.tsx:52-62` | Uçuş kaydı hiç yoksa boş bilet: "Uçuş · Lizbon" / "Dönüş · Lizbon", karşı uçta ev havalimanı, "Bilet yok · 2 kişi", Google Flights / Skyscanner / Kayak, "✨ Seçenek ara", × Gerek yok / Ben hallettim | YOK | v82 örneğinde iki uçuş da var; boş uçuş niyeti çizilmedi. |
| Şehir başına boş etkinlik | `EmptyCard.tsx:710-725`; `CategoryPlan.tsx:78-81` | "Amsterdam'da tur ve bilet", "tur, müze, gösteri · bilet gereken her şey", Henüz yok, GetYourGuide/Viator/Klook, ⋯ Etkinlik ekle | KISMEN | v82 "Henüz plana koymadın" boş yuvaları + Öneriler. |
| Seçilen yerin kapsamadığı geceler | `PlanEntry.tsx:115-127` | "5–7 Nis (2 gece) için yer seçilmedi: bu konaklama tek blok, seçtiğin yer yalnız bir kısmını kapsıyor." | YOK | Konaklama kutusunun altına uyarı çipi. |
| Ayrı konaklama notu | `PlanEntry.tsx:90-98` | "Bu geceler ayrı konaklama (sohbette söyledin)" + × | YOK | |

## 5. Seçenek kartları (türlere göre)

### 5a. Otel / konaklama

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Seçenek karosu | `cards/BackFace.tsx:204-368` | Foto/çizim, kaydeden yüz, etiket (Seçili / Kartta / Yeni), rozet (En ucuz…), "n uyum" puanı, marka + puan (9,0 / ★ 4,9) + yorum, ad (sayfaya link), alt satır, istek işaretleri ✓ ✕ ?, durum, gece fiyatı + toplam + "geçici", Seç / ✓ Planda, "Neden? ▾", "Tarihlerle aç ↗", "Tüm detaylar" | KISMEN | v82 kart: foto, kaynak rozeti, etiket, marka, puan, ad, fiyat/birim, Seç. Uyum puanı, istek işaretleri, Neden, Tarihlerle aç, Yeni yok (bir kısmı Pano'da). |
| İlk 3 görünür, fazlası Pano'da | — | — | YENİ | "4 · ilk 3, tümü Pano'da". |
| Seçili konaklama kartı | `cards/PlanCard.tsx:358-432`; `cards/MediaCard.tsx:76-153` | Foto + niyet çipi ("Kyoto · 8–13 Nis · 5 gece", düzenlenir), marka, puan, ad (düzenlenir), iptal satırı (son 2 haftada uyarır), gece fiyatı (düzenlenir, yoksa "Fiyat ekle"), üstte "Seçildi" + "✓ Aldım", ayakta "Değiştir N" (yerinde arka yüz), "Rezerve et ↗", neden satırı | VAR | v82 sabit gövde: foto · 4 satır bilgi · yan sütun (fiyat, [logo] Rezerve et ↗, Aldım · Değiştir), iptal + istek uyum çipleri. Düzenleme yok. |
| Önerimiz konaklama | `PlanCard.tsx:375-380` | "✨ Önerimiz" + "✓ Bunu seç"; "Rezerve et ↗" önce seçer sonra sayfayı açar; yeni öneri gelince halka | VAR | v82: "Bunu seç", Değiştir, "Booking.com ↗" (seçmeden kaynak). |
| Rezerve konaklama | `PlanCard.tsx:197-199, 272-287` | "Rezerve" rozeti (mühür), girişten 2 gün önce "Giriş saati 15:00", belge adı (tıklayınca açılır) ya da "belge yok", "Ayrıntı ›" → BookingSheet | VAR | v82 fiş: ✓ Rezerve edildi · Booking.com, Giriş/Çıkış, adres, Onay kodu + kopyala, "Onay e-postası aç" / "Onayı ekle", Haritada aç ↗, Otele yaz ↗. Giriş saati notu yok. |
| Konut türü çizimi | `MediaCard.tsx:28-38` | Otel, ev/daire (Airbnb), karavan, çadır | KISMEN | v82 otel + ev-daire. |
| Kamp gövdesi | `MediaCard.tsx:159-180`; `PlanCard.tsx:106, 405-407` | Festivalin kendi gecesi: çizim, "📍 yer", ad, gece, "kendi çadırın"; fiyat yok, "Rezervasyon gerekmez" | YOK | |
| Tarihsiz kayıtlı konaklama (SwipeCard) | `SwipeCard.tsx:68-210`; `TripPanel.tsx:651-656` | Bloğa oturmayan konaklama kaydı: sıra no, puan, kaynak, en güçlü rozetler ("EN EKONOMİK · EN SESSİZ"), ad ve şehir/tarih düzenlenir, fiyat, karşılaştırma satırı, istekler, artı/eksi, PivotNote, oylar, "Detaylar ▾", Planda ✓ / Geri al / Çıkar / Plana koy | KISMEN | Nadir görünür; tasarımda "tarihsiz kayıt" hali yok. |

### 5b. Uçuş

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Uçuş seçenek satırı | `cards/FlightOption.tsx:11-75` | Kaydeden yüz, havayolu logosu (Kiwi, yedek Aviasales), ad (link), etiket, kalkış saati + kod, süre, uçak, direkt (yeşil) / aktarma (turuncu), varış "+1" (ipucunda tarih), kişi başı + "2 kişi · toplam", Seç / ✓ Planda; altında rozet, uyum, istekler, Neden?, Tarihlerle aç, Tüm detaylar | VAR | v82 Skyscanner satırı: logo, havayolu + sefer, saatler, süre/aktarma, şerit (Önerimiz, En hızlı/En ucuz), fiyat, bagaj ("1 bagaj dahil" / "Yalnız el bagajı"), kim ekledi, Seç. |
| Bilet kartı | `cards/FlightTicket.tsx:66-129`; `PlanCard.tsx:301-357` | Çentikli bilet; baş: logo + havayolu + sefer no + gün (düzenlenir); rota: şehir büyük, kod (kopyalanır) + saat + terminal, ortada uçak (ilk çizimde süzülür); koçan: aşama kelimesi (büyük yeşil tik alındıysa), kişi başı + "2 kişi · toplam" / tahmini / "€x'den"; eylemler | VAR | v82 bilet + koçan: fiyat (kişi başı · 2 kişi), [logo] Satın al ↗, Aldım, Değiştir; alındıda "Bilet alındı", PNR + kopyala, "E-bilet aç". |
| Bilet uyarısı | `lib/cardTicket.ts ticketWarn`; `FlightTicket.tsx:123` | Seçili/önerimiz bilet alınmadıysa "Uçuşa 12 gün · bilet alınmadı" (14 gün içinde turuncu), "Uçuş bugün · bilet alınmadı" | YOK | Koçanın altına. |
| Havalimanı kodu kopyalama | `cards/TransportCard.tsx:37-66`; `CopyButton.tsx:43` | Koda dokun → "Kopyalandı ✓" | YOK | v82 kod düz yazı. |
| Rezervasyon kodu | `FlightTicket.tsx:55-60`; `lib/cardTicket.ts` showBookingRef | Koçanda, yalnız uçuş gününde, kopyalanır | KISMEN | v82 PNR her zaman görünür (karar: erişim modu). |
| Boş uçuş bileti | `NeedCard.tsx:132-160`; `EmptyCard.tsx:242-303` | "Arıyoruz", "Aradığımız: direkt", tahmini aralık, Kendin ara, "✨ Seçenek ara", boş bilet çerçevesi nabız atar | KISMEN | İstek çipi niyette VAR; boş bilet hali çizilmedi. |
| Dönüş bileti ara | `plan/SectionTimeline.tsx:108-127`; `lib/searchLinks.ts:23-44` | Tek yön uçuşta Uçuş bölümünde "Dönüş bileti ara · Porto → İstanbul ↗" | YOK | |

### 5c. Tren, otobüs, vapur, minibüs (bilet gerektiren yol)

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Yol kartı gövdesi | `cards/RideCard.tsx:32-92`; `PlanCard.tsx:262-266, 393-404` | "Hakone → Kyoto" büyük (düzenlenir), kapsülde tarih · saat, marka + hizmet adı ("Keikyu treni"), saat ve istasyon, aralarında aracın çizimi, süre; kişi başı + "2 kişi · €30" | KISMEN | v82 yalnız tren: operatör logosu (JR), kalın hizmet adı ("Nozomi"), "JR · Shinkansen", saatler, istasyonlar, "aktarmasız", tren çizimi. Otobüs, vapur, minibüs çizilmedi. |
| "Bileti al ↗" / "Bilet gerekmez" | `PlanCard.tsx:159-163`; `CardShell.tsx:221` | Bileti olmayan yol (metro vb.) fiyat yerine "Bilet gerekmez" | KISMEN | "Satın al ↗" VAR; "Bilet gerekmez" yok. |
| Tren seçenek satırı | (canlıda uçuş dışında satır yok; arka yüz karosu) | — | VAR | v82 satır. |
| Tren alındı | — | — | VAR | v82: bilet kodu + kopyala, vagon/koltuk notu, kesik "Bileti ekle". |

### 5d. Transfer, şehir değişimi, otel değişimi

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Transfer kartı (LegCard) | `cards/LegCard.tsx:19-68` | Tür (Varış transferi / Şehir değişimi / Otel değişimi / Gidiş transferi), rota, tarih, rozet, ⓘ (gün, hava, kaydedilen seçenekler), ⋯ Gerek yok / Planı temizle / Sil; açınca transfer gövdesi + "Uçuş ara ↗" | KISMEN | v82 yalnız "Ayarlandı" transfer: "Otelin servisi", Havalimanı → Otel, "karşılamalı · otel ayarladı", çip "Çıkış kapısında karşılama", "✓ Ayarlandı · Sen hallettin", Fiyat ekle, Değiştir. |
| Transfer gövdesi (LegBody) | `LegRow.tsx:83-150` | Notlar ⓘ; kaydedilen seçenekler (planlanıyor / seçildi / ✓) + "Kaldır"; nasıl gideceksin çipleri (✈ 🚆 🚌 ⛴ 🚇 🚕 🚐 🚗 🚶); "Ayarlandı / rezerve edildi" kutusu; not; "Sohbette 'metroyla gideceğim' demen de yeter"; "Gerek yok · gizle" | YOK | |
| Belirsiz şehir değişimi | `cards/EmptyCard.tsx:553-646` | "Kyoto → Hakone" büyük + "Nasıl gideceğin belli değil" + çizimli seçim: Tren · Otobüs · Araba · Uçak · Ben hallettim; durum "Seç, ben arayayım"; Uber + Google Maps "Yol tarifi"; "Gerek yok" ("Bu transfer gerekmiyor"); × katlama | YOK | Ulaşım niyetinin "Aranıyor" gövdesinde illüstrasyonlu seçici. |

### 5e. Araç / motosiklet / karavan / bisiklet kiralama

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Kiralama kartı | `RideCard.tsx:32-92` (rental); `lib/cardTicket.ts rentalLine`; `cards/CardDate.tsx:13-22` | Alış yeri, ne ve kaç gün, alış/iade satırı; başlangıç–bitiş yerinde düzenlenir; boşken "Kiralanmadı" | YOK | Prototipin `illus/` klasöründe arac-kiralama, motosiklet, karavan, bisiklet çizimleri var ama kart yok. Bilet gövdesi yerine "alış yeri · n gün · iade" satırı. |
| Ekleme karoları | `lib/templates.ts:29-36` | Araç kiralama, Motosiklet, Karavan, Bisiklet | YOK | |

### 5f. Etkinlik ve turlar

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Üst satır | `plan/ActivityBoard.tsx:115-140` | "✨ AI buldu · (yüz) siz eklediniz · Beğenmediğini ↻ ile değiştir."; "✨ Başka öneriler" (sohbete); "+ Ekle" | KISMEN | Kaynak rozetleri VAR; "Başka öneriler" ve ↻ yok. |
| "Öneriler ve fikirler N" katlanır çubuk | `ActivityBoard.tsx:142-149, 236-256` | Fikirleri gizler/gösterir (bu tarayıcıda hatırlanır), "bilet ya da rezervasyon gerektirenler" | KISMEN | v82 "Öneriler" sırası sabit; katlama yok. |
| Şehir satırı | `ActivityBoard.tsx:151-186` | Şehir, tarih (ya da "3 gece"), "Festivalden sonra · dinlenme", "2 planda · 1 bilet alındı · 1 öneri" / "henüz etkinlik yok", boşsa "✨ AI'a arat"; kartlar yana kayar (4 sığar) | VAR | v82 her şehir bir çoklu niyet: başlıkta "2 planda · 1 alındı", Planında + Öneriler. "AI'a arat" yok. |
| Etkinlik kartı | `ActivityBoard.tsx:263-325, 359-442` | Foto/çizim; köşede bulan (✨/yüz) ya da "Bilet alındı" rozeti; "✓ Seçildi"; "Gezinin sebebi" iğnesi; araçlar: ↻ yerine başkasını öner, ✓ aldım, × Gerek yok/Kaldır, ⋯; ad (düzenlenir); marka + tarih; neden satırı; "€45 kişi başı · 2 kişi · €90"; eylem "+ Plana koy" ya da "Klook ↗" (site ikonu); ayak: belge, "Ayrıntı ›" | KISMEN | v82 kart: çizim, × Plandan çıkar, marka, ad, "4 Nisan · €45 kişi başı", "✓ Aldım" + [logo] Satın al ↗; alındıda yeşil "Bilet alındı" şeridi, ⓘ, tarih-saat, buluşma yeri, kod + kopyala, "Bileti aç"/"Bileti ekle". ↻, Gezinin sebebi, toplam fiyat, düzenleme yok. |
| Kaynak teklifi kartı (Viator) | `ActivityBoard.tsx:445-465, 516-552` | Kaynaktan gerçek tur: foto, ad (sayfaya link), marka + süre, kişi başı + toplam, "+ Plana koy"; foto yoksa kayda kaynak fotoğrafı yazılır | VAR | v82 Öneriler'de AI önerisi kartları. |
| Öneri kartı | `ActivityBoard.tsx:468-486` | ✨, ad, neden, not, × Gerek yok, "+ Plana koy" | VAR | |
| Kaynak bağlı değilse / sonuç yoksa | `ActivityBoard.tsx:190-217` | "Canlı tur ve bilet kaynağı bağlı değil; kendin bakabilirsin:" + şehir başına GetYourGuide/Viator/Klook; festival sonrası dinlenme aramaları | KISMEN | v82 "Kendin ara" Klook/Viator/GetYourGuide. |
| Festival notu | `ActivityBoard.tsx:77, 83, 113`; `lib/reason.ts:40-47` | "Festival gezisi: tur önerisi kapalı; sonrası için dinlenme önerdik" | YOK | Gezi türüne (playbook) özel: classic, festival, honeymoon, ski, wellness. |
| Boş hal | `ActivityBoard.tsx:150` | "Henüz plana bir şey eklenmedi; '+ Plana koy' ile ekle ya da sohbete yaz." | VAR | v82 "Henüz plana koymadın · Önerilerden '+ Plana koy' ile ekle". |
| "+n Pano'da" | — | — | YENİ | Planında 4'ten fazlasında. |
| Etkinlik BookingSheet | `ActivityBoard.tsx:436-439` | Alınan biletin penceresi (bkz. bölüm 7) | VAR | v82 ⓘ ayrıntı. |

### 5g. Yapılacaklar ve restoranlar

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Süzgeçler | `ideas/IdeaTiles.tsx:77-89` | Hepsi · Gezilecek yerler · Restoranlar (sayılarla) | YOK | |
| "✨ Daha fazla öner" | `IdeaTiles.tsx:84-88` | Sohbete yeni yer/restoran isteği | YOK | |
| Anahtar | `IdeaTiles.tsx:90-95` | "✓ planda · + öneri, basınca plana girer" | YOK | |
| Şehir satırları | `IdeaTiles.tsx:97-149` | Sıra no, şehir, tarih · gece, "✓ 2 planda · + 3 öneri"; şehirler arası yol satırı "Kyoto'ya · Shinkansen · ~2 sa" | KISMEN | v82 şehir başına çoklu niyet; yol satırı yok. |
| Yapılacak karosu | `IdeaTiles.tsx:159-226` | Foto ya da çizim (tür rengi zeminde), köşe etiketi Restoran/Gezilecek, "Maps" rozeti, kaydeden yüzü, × sil, ⋯; köşe "✓ Planda" ↔ "+ Plana ekle"; ad haritaya link; alt satır (not, tür, semt, ★ puan); "✓ Yapıldı/Gidildi", gün çipi | KISMEN | v82 karo: görsel, etiket, ad, semt, "✓ Planda", "Gün ver ›", × Plandan çıkar; Öneriler'de "+ Plana koy". Harita linki, puan, Maps rozeti, yapıldı hali yok. |
| Karo menüsü | `IdeaTiles.tsx:175-183` | Yaptım / Gittim (geri al), Haritada aç, Adını değiştir, Rezervasyonu yaptım / geri al (masa ayırtan restoran), Günden çıkar, Etkinliklere taşı (bileti var), Hazırlık'a taşı | YOK | v82 ⋯ yalnız niyet düzeyinde. |
| Gün verme + öğün | `ideas/DayPicker.tsx:15-80` | "+ Gün" → günler listesi (o gece hangi şehirde), restoranda Kahvaltı/Öğle/Akşam, "Günden çıkar" | KISMEN | v82 "Gün ver ›" düğmesi; seçici ve öğün çizilmedi. |
| Not | `IdeaTiles.tsx:153` | "Eklemek için sohbete yaz…; Google Maps'ten kaydettiklerin kendiliğinden düşer. Plana eklediklerine günü Gün gün'de verirsin." | YOK (bilinçli, v82 "Sohbete attığın linkler buraya düşer" notları kalktı) | |
| Kendin ara Google Haritalar | — | — | YENİ | |

### 5h. eSIM

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| eSIM seçenek/seçili | `PlanCard.tsx:159-163` (MediaCard), `cards/MediaCard.tsx` ILLUS esim | Çizim, ad, "Satın al ↗" | VAR | v82 Airalo/Ubigi/Holafly kartları, "Satın alındı · Airalo", ayrıntıda QR kod. |
| Kurulum hali | `lib/cardView.ts:98`; `PlanCard.tsx:168, 226` | Alındıktan sonra "kurulmadı" + "Kurdum"; detayda "Kurulmadı" geri alma | YOK | Alındı yan sütununa ikincil "Kurdum". |

### 5i. Sigorta, 5j. Vize, 5k. Not ve diğerleri

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Sigorta seçili/alındı | `PlanCard.tsx:159-163`; şablon `templates.ts:34` | Seçenekli/seçili sigorta "Satın al ↗", alındıda belge | KISMEN | v82 yalnız boş sigorta; seçenekli ve alındı hali çizilmedi (konaklama çerçevesiyle aynı olacağı notta). |
| Vize | bkz. bölüm 4 | | KISMEN | |
| Not kartı | `MediaCard.tsx:26` (ILLUS note); `templates.ts:34` | Serbest not kaydı | YOK | |
| Restoran rezervasyonu | `IdeaTiles.tsx:179`; `lib/booking.ts needsBooking` | Masa ayırtılan restoranda "Rezervasyonu yaptım" → rezerve rozeti | YOK | |
| Vapur / otobüs / minibüs / taksi | `lib/cardKinds.ts:10-13, 85-92` | Her birinin rengi, çizimi (vapur, otobus, minibus, taksi-transfer) ve kart gövdesi | YOK | Çizimler prototip `illus/`'ta var, kart yok. |

## 6. Seçili / rezerve / alındı halleri

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Arıyoruz | `CardShell.tsx:16-20`; `static/app.css:4184, 4987` | Kesikli halka/çerçeve, 2,4 sn nabız | KISMEN | Kesik kenar VAR, nabız yok (m-nabız kararı 2,4 sn). |
| Önerimiz (taslak) | `PlanCard.tsx:116-118, 149-150, 375-380`; `lib/draft.ts` | AI'nın seçtiği gerçek seçenek kart olarak, hiçbir şey yazılmadan; "✓ Bunu seç" | VAR | v82 "✨ Önerimiz · onayla"; "Omurga yeni" senaryosu. |
| Seçildi | `PlanCard.tsx:156, 288-293, 383-384` | "Seçildi" etiketi, "✓ Aldım" üstte, ayakta sayfaya git | VAR | |
| Rezerve / Bilet alındı / Alındı | `cards/BookedBadge.tsx:7-14`; `lib/stageWords.ts:31-47` | Tek koyu yeşil kapsül, kelime türe göre | VAR | v82 kalın yeşil çerçeve + dolu çip. |
| Ayarlandı | `PlanCard.tsx:145-147, 192`; `CardShell.tsx:244-266` | "Ben hallettim" (× katlaması, ⋯, boş kartlar) → gri, işi yok; ⋯ "Ayarlandı: geri al" | KISMEN | v82'de görünüm VAR (transfer); nasıl ayarlanır ve geri alınır yok. |
| Hazır (belge var) / belge eksik | `cards/DocAccess.tsx:85-125`; `lib/lifecycle.ts` | Rezerve + belge = Hazır; belgesiz rezervasyonda turuncu "belge yok" | KISMEN | v82 "Belgeyi aç" / kesik "Belgeyi ekle". |
| İptal edildi | `stageMenu.tsx:45, 82-83`; `HiddenList.tsx:46-47` | "İptal ettim" → ihtiyaç yeniden aranır, eski kayıt Gizlenenler'de "İptal edildi · iade notu"; Geri al | KISMEN | v82 ayrıntıda "İptal ettim, değiştir/kaldır"; sonrası çizilmedi. |
| Elendi | `stageMenu.tsx:76-77`; `lib/cardView.ts:73` | "Çıkar" → Gizlenenler'de, "Geri al" | YOK | |
| Geçmiş (kullanıldı) | `lib/lifecycle.ts` "used" | Tarihi geçen rezervasyon | YOK | |
| Rezervasyonu geri al | `PlanCard.tsx:225`; `BookingSheet.tsx:150-152` | "Aldım" yanlışlıkla basıldıysa Seçildi'ye döner | YOK | |
| Seçimi geri al | `PlanCard.tsx:224` | Seçili → seçenek | YOK | Değiştir VAR. |
| Tarih uyarısı ⏳ | `CardShell.tsx:168-180`; `lib/progress.ts dateAlert` | "⏳ ücretsiz iptal 3 gün", 14 gün içinde renkli | YOK | |
| İptal satırı | `MediaCard.tsx:138`; `lib/cardTime.ts cancelLineOf` | "Ücretsiz iptal · 20 Mart'a kadar" yeşil/turuncu/kırmızı | VAR | v82 kısa "Ücretsiz iptal", tarih Ayrıntı'da. |
| İkisi de 👎 | `PlanCard.tsx:138, 337` | Paylaşılan gezide herkes istemezse kart geri çekilir | YOK | |
| Rötarlı uçuş kırmızı | `PlanCard.tsx:251, 337` | pk-alert | YOK | |

## 7. Ayrıntı / arka yüz

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| ⓘ balonu | `cards/InfoButton.tsx:9-45`; `lib/cardPeek.ts` | Üzerine gelince/odakta/dokununca; uçuş: Sefer, Kalkış, Varış, Süre, Aktarma, Bagaj, Check-in masası, Kimden, (uçuş günü) kod kopyala; konaklama: Semt, Puan, Uyum puanı, İptal, Not, Toplam, Kimden; yol: Kalkış, Varış, Süre, Rezervasyon, Not; transfer: gün, hava, kaydedilen seçenekler; "Belgeler, yolcular ve değişiklikler Ayrıntı'da." | KISMEN | v82 ⓘ / ⋯ > Ayrıntı kartın üstünde açılır: seçiliyken niyete uyum ✓/✕, artılar, eksiler, iptal; alındıda rezervasyon/belge/yerinde. |
| Kart detayı (karta dokununca) | `cards/CardDetail.tsx:21-90`; eylemler `PlanCard.tsx:210-229` | ⏳ uyarı; rozetler; "Uyum puanı n/100 · n. sırada"; fiyat tam; tavsiye cümlesi; "Seçmeden kontrol et" + "Sayfada bak ↗"; karşılaştırma satırı; bilinmeyen (?); uygunluk notu (Kısmi / Uygun değil); PivotNote; Details (hüküm, olgular, İstediklerin, Artıları, Dikkat, okuma durumu); tarihsiz kayıt notu; 👍 👎; belgeler; eylemler: Karşılaştır →, Tarihlerle aç ↗ / Kaydettiğin sayfa ↗, Tüm detaylar, Pano'da N alternatif / Pano'da gör, Belge ekle, Diğer N seçenek, Seçimi geri al, Rezervasyonu geri al, Kurulmadı, Sil | KISMEN | Uyum puanı Pano'da; diğerlerinin çoğu yok. |
| Arka yüz (seçenekler kartın yerinde) | `cards/BackFace.tsx:43-467` | Satırın üstüne serilir (son satırda yukarı), telefonda akışta; altı tıklanamaz; başlık: ad, tarih · N seçenek, Karşılaştır, "Pano'da aç · +N", ×; istekler; tavsiye; kontrol; "Kaydettikleriniz" (3'e kadar + Kendin ara karosu "Sitede açılır, tarihler dolu. Kaydettiğin buraya düşer.") ve "Önerimiz" (3'e kadar + "✨ AI'a arat · Ara" / "Arıyoruz…"); boş: "Henüz kayıt yok. Eklentiyle kaydettiğin buraya düşer.", arama sonrası "Sana uyan başka seçenek bulamadık."; boşluğa tıklayınca döner; çevirme animasyonu | KISMEN | v82 Değiştir: seçenekler yerinde açılır, şu anki "Seçili" yeşil, "Başka bir seçenek seç", Vazgeç; kutu büyümez. Kaydettikleriniz/Önerimiz ayrımı rozetle; Karşılaştır ve AI'a arat yok. |
| Rezervasyon penceresi (BookingSheet) | `cards/BookingSheet.tsx:25-164` | Ad, sağlayıcı · tarih · kişi, marka/tür, fiyat, rozet; konaklamada Haritada aç ↗, sağlayıcı sayfası ↗, Otele yaz ↗ / Ev sahibine yaz ↗ (yalnız gerçek iletişim linki varsa), iptal satırı; Rezervasyon ayrıntısı (kod kopyala, giriş/çıkış, adres kopyala, ev sahibi, kapı kodu, kişi, ücretsiz iptal tarihi; havalimanı kodu kopyala); "Ayrıntı yok; belgeyi eklersen PNR, saat ve tutarı ben okurum."; "Kapı kodu girişten 1 gün önce gelir."; Belgeler (liste ya da "Belge eksik · ekle", "yalnız bu bilgisayarda"); Değiştir, İptal ettim, Rezervasyonu geri al, Tüm detaylar, Kapat | VAR | v82 booked panel (`gen82.py booked_panel`): kod + kopyala, giriş/çıkış, kişi, belge Ekle, Otele yaz ↗, Haritada aç ↗, İptal ettim değiştir / kaldır, Düzenle. Eksik: sağlayıcı sayfası, ev sahibi/kapı kodu, "belgeyi eklersen ben okurum", Rezervasyonu geri al, Tüm detaylar. |
| Tüm detaylar çekmecesi | `ItemDrawer.tsx` (App.tsx:312-323) | Başka geziye taşı (+ Yeni gezi…); durum düğmeleri Plana al / Rezerve ettim / Çıkar / Seçeneklere geri al; puan ve parçaları, ceza, şart uymuyor, kontrol et, AI değerlendirmesi; fiyat (kapsam, vergi), tarih, kişi/oda, seçenek, uçuş, iptal, puan, konum (adres kopyala, yaklaşık); Yorumlardan (Kanıt); Eksik bilgi; Fiyat geçmişi; "Orijinal sayfayı aç ↗"; "Fiyatı güncellemek için sayfayı açıp eklentiye tekrar tıkla."; "Bu kaydı sil"; her alanın kaynağı (URL'den, sayfada doğrulandı…) | YOK | Ayrıntı panelinin altına "Tüm detaylar ›". |
| Kanıt | `Evidence.tsx:31-124` | Artı/eksi + "Kanıt / Kanıtı gizle", kaynak (olanaklar/kurallar/açıklama), "Sorun değil" / "Önemli, kalsın" / Geri al, "Tekrar oku" | YOK | |
| Sıralama tek şeye bağlı | `PivotNote.tsx:12-41` | "Sıralaman tek bir şeye bağlı: …; Bu olmasa 2. olurdu." + Önemli, kalsın / Sorun değil / "Ev sahibine sor" (mesajı kopyalar) | YOK | |
| Neden satırı (K6) | `cards/WhyLine.tsx:7-15`; `lib/cardWhy.ts` | Kartın altında tek sessiz satır: neden burada, gezginin kendi sözüyle | KISMEN | v82 istek uyum çipleri (✓ merkeze yakın, ✕ az bütçe). Emre kararı "neden: YAP". |
| ★ öncelik | `cards/MineStar.tsx:5-20` | Söylediğin önceliğe dokunan artı/eksinin yanında küçük ★ + açıklama | YOK | Emre kararı r-oncelik "Geri getir". |
| Karşılaştırma satırı | `cards/parts.tsx:253-276` | "2.'ye göre +€30 · bagaj dahil, direkt · eksiği: iade yok" | YOK | |
| Üzerine gelince ikon şeridi | `cards/ActionStrip.tsx:23-35` | Düzenle, Değiştir, Belge ekle, İptal ettim ikonları kartın üst kenarında (dokunmatikte yok) | YOK | |

## 8. Düzenleme (yerinde)

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Yerinde düzenlenen alanlar | `cards/InlineEdit.tsx:28-167`; `lib/inlineEdit.ts` | Ad, şehir, tarih, bitiş, saat, fiyat + para birimi (EUR/TRY/USD/GBP), nereden, nereye; ince alt çizgi + kalem; tıklayınca aynı boy kutu (tarih/saat seçici, sayı) | YOK | v65 notu: korunmalı, niyet kutusundaki şehir/tarih/kişi de düzenlenebilir olmalı. |
| Klavye | `InlineEdit.tsx:121-135` | Enter kaydeder, Esc bırakır, Tab / Shift+Tab sonraki/önceki alan, dışarı tıklama kaydeder | YOK | |
| Soluk yer tutucular | `InlineEdit.tsx:67`; `CardShell.tsx:151` | "Fiyat ekle", "Tarih ekle", "Şehir ekle", "Saat ekle", "Nereden", "Nereye" | KISMEN | v82 Ayarlandı transferde "Fiyat ekle". |
| Sayfa düzeltmesi ipucu | `InlineEdit.tsx:69-74` | Kayıttan farklı girilen alan: "sayfadaki: X · geri al" | YOK | |
| Hata satırı | `InlineEdit.tsx:164` | Geçersiz değer | YOK | |
| Yeni eklenen kartın düzenlemeye açılması | `TripPanel.tsx:274-283`; `InlineEdit.tsx:32-37` | Eklenince bölüm açılır, kart kaydırılır, ilk alan açık | YOK | |
| Düzenle formu | `cards/AddSheet.tsx:112-130`; `stageMenu.tsx:75` | Sohbetten gelen planlarda ⋯ Düzenle: Nereden/Nereye/Tarih/Saat · Yer/Başlangıç/Bitiş · Ad/Şehir/Giriş/Çıkış · Ad/Tarih/Şehir + Fiyat ve para birimi, Kaydet | KISMEN | v82 alındı ayrıntısında "Düzenle" düğmesi. |
| Niyet çipi (şehir, tarih) | `MediaCard.tsx:49-73` | Konaklama fotoğrafındaki "Kyoto · 8–13 Nis" yerinde düzenlenir | YOK | |
| Diğer yerinde düzenlemeler | `PrepList.tsx:44-47`; `IdeaTiles.tsx:178, 209-216`; `ActivityBoard.tsx:93, 410`; `EmptyCard.tsx:77-99, 504-517` | Hazırlık başlığı, fikir/etkinlik adı, boş kartın uçları ve günü, ayrı konaklamanın adı/fiyatı | YOK | |

## 9. Ekleme

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Ekleme penceresi | `cards/AddSheet.tsx:40-135`; `lib/templates.ts:29-36` | "Ne eklemek istersin?" 3 grup: Ulaşım (Uçuş, Tren, Otobüs, Minibüs, Vapur, Taksi · transfer, Araç kiralama, Motosiklet, Karavan, Bisiklet), Kalacak yer (Otel, Ev · daire), Yapılacaklar ve diğer (Etkinlik · tur, Yapılacak, Restoran, eSIM, Sigorta, Not); başlıkta açıldığı yerin şehir · günü; Esc kapatır | YOK | |
| Anında ekleme | `TripPanel.tsx:274-283` | Karo seçilince kayıt hemen eklenir, "Otobüs eklendi · Geri al", kart düzenlemeye açılır | YOK | |
| "+ Buraya ekle" | `plan/SectionTimeline.tsx:73`; `AddSheet.tsx:30-38` | Kartlar arası soluk "+", o kartın günü ve şehrinde ekler | YOK | v65 listesinde "korunmalı". |
| Bölüm sonu "+ Ekle" | `Section.tsx:104-109` | | VAR | |
| Boş bölüm çipleri | `CategoryPlan.tsx:142-152` | | YOK | |
| "+ Bu güne ekle" | `days/DayCards.tsx:163-164` | Gün gün'de | YOK | |
| Sürükle-bırak / yapıştır | `App.tsx:241`; `arrive/ArriveViews.tsx:120-135`; `arrive/useBoardIntake.ts` | Panele link, PDF, ekran görüntüsü bırakılınca kaplama "Bırak, okuyup doğru yere koyayım · Link, PDF ya da ekran görüntüsü" | YOK | |
| ••• "Link ya da ekran görüntüsü ekle" | `App.tsx:187-190` | Sohbet kutusuna odaklar | YOK | Menü yok. |
| Pano "+ Link ekle" | `board/Pano.tsx:205-210, 280-296` | Link yapıştır, hata "https://… ile başlamalı", Ekle / Vazgeç | YOK (bilinçli, v78) | Linkler sohbetten gelir. |
| Karşılaştırma "+ Seçenek ekle" | `board/OptionBoard.tsx:91-96` | | YOK | |
| Öneriyi "Plana koy" | `plan/SuggestionCards.tsx:32-36` | | YOK | |
| "+ Plana koy" | `ActivityBoard.tsx:338-344`; `IdeaTiles.tsx:203-206`; `Pano.tsx:468-470` | Etkinlik/yapılacak fikrini, Pano kartını plana koyar | VAR | |
| Boşluk tespiti | `lib/suggestions.ts:187-195`; `EmptyCard.tsx` (boş geceler, eksik uçuşlar, transferler); `CategoryPlan.tsx:78-81` | Konaklama olmayan geceler, eksik varış/dönüş uçuşu, transfer, şehir başına etkinlik boşluğu kendiliğinden boş kart olur | KISMEN | v82 boş niyetler ve "Henüz plana koymadın"; boşlukta "+ Buraya ekle" yok. |

## 10. Silme, Gerek yok, geri al

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| × katlama | `CardShell.tsx:244-266` | bkz. bölüm 4 | KISMEN | |
| Gerek yok | `stageMenu.tsx:47-57`; `NeedCard.tsx:146, 169`; `EmptyCard.tsx`; `LegCard.tsx:29` | Kart/ihtiyaç/gece/transfer/eSIM/sigorta/öneri gizlenir, Gizlenenler'de durur, 8 sn Geri al | VAR | v82 ⋯ > Gerek yok: niyet soluk, "Gerek yok dedin. Geri al". Çoklu kalemde "× Plandan çıkar". |
| Rezervasyonda × | `stageMenu.tsx:47-57, 105-128` | "Bu rezervasyon onaylı · X rezerve ve belgesi var. Kaldırmadan önce: iptal ettin mi? Belgesi Belgeler sekmesinde kalır." Vazgeç / "İptal ettim, kaldır" | KISMEN | v82 ayrıntıda "İptal ettim, kaldır" (onay penceresi yok). |
| Rezervasyonu değiştir | `stageMenu.tsx:58-70` | "Değiştirmeden önce: eskisini iptal ettin mi? … İptal ettim, değiştir" | KISMEN | v82 ayrıntıda "İptal ettim, değiştir". |
| Sil | `stageMenu.tsx:40-44, 84-85` | Kırmızı menü satırı; rezervasyon/belgeli kayıtta "Yine de sil" onayı | YOK | |
| Çıkar | `stageMenu.tsx:76-77` | Seçeneği ele | YOK | |
| Geri al tostu | `cards/UndoToast.tsx:13-39`; `TripPanel.tsx:240-263, 970-982` | 8 sn, boşalan halka; silme, ekleme, gizleme, iptal, sohbetin yaptığı kaldırma/gizleme/ayar değişikliği, dil değişimi | KISMEN | v82 düz tost "Silindi · Geri al" (düğme ve halka yok). |
| Geri alınamadı | `TripPanel.tsx:976-980` | "Bu ayar sonra yine değişti" aynı yerde | YOK | |
| Gizlenenler | `HiddenList.tsx` | Geri al / Geri getir | YOK | |
| Belge sil | `DocAccess.tsx:66-79`; `docs/DocsTab.tsx:152-155` | Çöp kutusuna, 30 gün; Belgeler'de Geri al | YOK | |
| "Bunun gibileri gösterme" | `OfferRow.tsx:174-176` | Kaynak teklifini bir daha önermez | YOK | |
| Planı temizle | `LegCard.tsx:31` | Transfer seçimini siler | YOK | |
| Sohbet planını kaldır | `LegRow.tsx:103-107` | "12 Ekim'e taksi" gibi planı tek dokunuşla | YOK | |
| Geçmiş ve çöp kutusu | `HistoryDialog.tsx` (TripPanel.tsx:983-985) | Gün gün geçmiş, kim/ben süzgeci, Geri al / Geri getir / Panoda göster / Kalıcı sil / Çöp kutusunu boşalt | YOK | Menü olmadığı için erişim yok. |

## 11. Kim ekledi, oylar, paylaşım izleri

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Kaydeden yüzü | `cards/WhoseBadge.tsx:61-72`; `PlanCard.tsx:336, 369` | Köşede ✨ (AI) ya da kişinin yüzü; ipucu "Sabine kaydetti" / "Sen kaydettin" | VAR | v82 rozet ✨ Önerimiz / AI önerisi / Senin linkin / S ekledi; satırda ✨ · S/E · 🔗. |
| Kimin için rozeti | `WhoseBadge.tsx:43-58` | "Sabine'in bileti" + yüz (kişiye özel rezervasyon) | YOK | Niyet başlığına yüz rozeti. |
| "Kimin için?" menüsü | `PlanCard.tsx:171-191`; `cards/whoMenu.tsx:12-34` | Herkes / kişiler ✓ (2+ kişilik gezide) | YOK | ⋯ menüye. |
| Kişiye göre arama sayısı | `EmptyCard.tsx:334-340` | Kişiye özel uçuşta arama 1 kişilik, kişinin kendi şehrinden | YOK | |
| 👍 / 👎 oylar | `Share.tsx:115-131`; `CardDetail.tsx:85` | Paylaşılan gezide; "Emre 👍 · Sabine 👎" | KISMEN | v82 Pano ♥ beğeni + avatarlar. |
| Pano kalbi = "Süper" oyu | `Pano.tsx:431-440` | Paylaşımda iki bilgisayarda görünür | VAR | |
| Tepkiler (Olmaz / Olur / Süper) | `OptionBoard.tsx:38-42, 244-279` | Karşılaştırma kartında 😕 🙂 🤩 + kim ne dedi | KISMEN | Yalnız ♥. |
| "♥ Favori" rozeti, "n kişi oy verdi" | `OptionBoard.tsx:24-29, 84` | | YOK | |
| İhtiyaç kartı yüzleri | `NeedCard.tsx:40-55` | "3 seçenek ›" yanında kaydedenler (en çok 3) | KISMEN | |
| Pano haber noktası | `usePanoDot.ts`; `PanoNewsTip.tsx` | | YOK | |
| "Yeni" işareti | `Pano.tsx:92-101, 570`; `BackFace.tsx:146-149, 215-217` | Son ziyaretten sonra gelen kayıt | YOK | |
| Gün gün yüzleri | `days/DayCards.tsx` Faces | Kimin satırı | YOK | |
| Paylaşım satırı / değişiklik bildirimi / son hareket | bkz. bölüm 1-2 | | KISMEN | Yalnız son hareket ipucu VAR. |

## 12. Pano

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Açılış biçimi | `TripPanel.tsx:894-913` | Ayrı sekme, hero gizlenir; plan kartından açılınca o ihtiyacın grubu çerçeveli + "← Plan'a dön" | KISMEN | v82 büyük pencere (telefonda alttan tam ekran), × ve dışarı tıklama/Esc kapatır; niyetin "Pano n"i o niyetin karşılaştırmasıyla açar. "Plan'a dön" yerine kapat. |
| Başlık | `Pano.tsx:189-209` | "Pano" + "N kayıt" | VAR | "Biriktirdiklerin, AI önerileri ve ilham". |
| Kayıtlarda ara | `Pano.tsx:198-204` | Arama kutusu | YOK | |
| Kenar menü | `Pano.tsx:212-222, 268-277`; `lib/pano.ts:21` | Tümü, Uçuşlar, Konaklama, Ulaşım, Etkinlik, Yapılacaklar, Diğer, İlham, Beğenilenler (ikon + sayı) | VAR | v82: Tümü · Biriktirdiklerim · AI önerileri · İlham + "İhtiyaçlar" ağacı (kategori > niyet, durum noktası, sayı). Beğenilenler süzgeci yok. |
| Durum süzgeci | `Pano.tsx:224-231` | Hepsi · Karar bekleyen · Planda (sayılarla) | YOK | |
| Sırala | `Pano.tsx:60-65, 233-242` | Bize en uygun · En ucuz · En çok beğenilen · En yeni eklenen | KISMEN | v82 karşılaştırma AI puanına göre sıralı; seçim yok. |
| İhtiyaç grubu başlığı | `Pano.tsx:126-160` | Ad, ne zaman, "Seçildi: X · Plan'da gör →" / "✨ Önerimiz: X · Plan'da gör →" / "Karar bekliyor", "Karşılaştır" ↔ "Kartlar" | KISMEN | v82 başlık + "n kayıt" + "Yan yana karşılaştır ›". "Plan'da gör" yok. |
| "Senin için" özeti | `Pano.tsx:130, 161-166` | "Senin için: Hyatt · merkezde ve ücretsiz iptal" | YOK | |
| Kart | `Pano.tsx:412-605` | Foto/çizim, "Önerim" / "En ucuz" rozeti, ♥, uyum puanı, şerit Rezerve / Planda / "Önerimiz · kartta", ihtiyaç adı (Beğenilenler'de), ad, marka harfi + sağlayıcı · semt · puan, fiyat (uçuşta kişi başı + toplam), "+ Plana koy" / "Plan'da gör →", ayak: kim kaydetti + Yeni + beğenenler + "Neden? ▾" (en çok 3 artı, 2 eksi ★, "Karşılaştır →") | KISMEN | v82 sabit boy kart: görsel, kaynak rozeti, durum, marka, ad, alt satır, fiyat, AI puanı, ♥ + avatarlar, Seç / + Plana koy / Seçili / Planda / ✓ Alındı. "Plan'da gör", Neden, Yeni yok. |
| Uçuş kartı | `Pano.tsx:448-502` | Şerit (durum + ilk artı/eksi) + küçük uçuş kartı + uyum + ♥ | KISMEN | v82'de logo görseli. |
| Karşılaştır tablosu | `Pano.tsx:303-383` | Uyum, Fiyat, Puan, Nerede, Kaynak; şartlar ✓ ✗ ?; yalnız bunda olan artılar; Planda / + Plana koy; satırın en iyisi işaretli | VAR | v82 280 px sütunlar: görsel + kim, ad, fiyat + toplam + AI uyum n/100 · n. sırada, istekler ✓/✕, artılar, eksiler, puan/iptal/bagaj, beğeni + kaynak ↗ + Seç; 3'ten azsa "Daha fazla seçenek · AI'dan öner" yer tutucusu; yalnız konaklama/eSIM/uçuş/trende. |
| Yapılacak/İlham satırları | `Pano.tsx:172-186` | Şehir başına yapılacaklar, İlham tek satır | VAR | v82 etkinlik/yapılacakta kıyas yok, ızgara. |
| İlham kartı | (Pano'da canlıda düz kart) | | VAR | v82: platform rozeti, oynat/oku, süre, şehir, kim ekledi, "✨ İçinden yerleri çıkar", "Aç ↗". |
| Boş haller | `Pano.tsx:244-255` | Maskot uyur/şaşırır; "Henüz kayıt yok. Eklentiyle bir sayfa kaydet ya da sohbette bir link bırak…", "Burada kayıt yok.", süzgeçe göre metin | YOK | |
| Pano açılış animasyonu | `TripPanel.tsx:126-136`; `opening.ts` | Gezi başına bir kez şeritlerin kartları sırayla gelir | YOK | |
| "Plana koy" uçuşu | `putFly.ts:1-31` | Ad çipi kavisle Plan sekmesine uçar, sekme zıplar | YOK | |

## 13. Karşılaştırma penceresi (CompareView)

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Açılış | `App.tsx:327-336`; "Karşılaştır →" düğmeleri (CardDetail, BackFace, Pano) | Modal; Esc / dışarı tıklama | KISMEN | v82'de karşılaştırma Pano'nun içinde. |
| Hüküm satırı + Neden? | `CompareView.tsx:123-139` | "Önerim: X" ya da özet + AI'nın ilk cümlesi; Neden?: gerekçe, "Ama…", bütçe notu, AI yorumu | YOK | AI uyum puanı VAR, metin gerekçe yok. |
| AI yorumu halleri | `CompareView.tsx:397-457` | Tarihli eski yorum + "Yeni bilgiler geldi; yorum güncelleniyor"; anahtar yoksa "Ayarlar'dan ücretsiz Gemini anahtarı ekle"; hata + "Tekrar dene"; "AI yorumu hazırlanıyor…"; ❓ AI sorusu | YOK | |
| Kartlar / Tablo görünümü | `CompareView.tsx:141-176` | ▦ Kartlar · ☰ Tablo · Hepsini göster | KISMEN | v82 tek görünüm (sütunlar). |
| Sırayla karar ver | `CompareView.tsx:153-157`; `board/StepDecide.tsx` | Açık kararlar tek tek ("1 / 3 · Porto · Konaklama"), Seç → sıradaki, Geri, Sonra, son ekranda özet, Tamam | YOK | Emre kararı r-sirayla "Geri getir". |
| Kartlar panosu | `board/OptionBoard.tsx` | Sıralama çipleri (Önerim, Fiyat ↑, Puan, Konum), "Ücretsiz iptal", "Elenenler (n)", sayı; kart: tik (en çok 3) → "Tabloda yan yana gör →", rozet (✦ Önerim, ♥ Favori, € En ucuz, ★ En yüksek puan), puan, ad, fiyat, başka tarih notu, istekler, artı/eksi (★, yalnız bunda), tepkiler, Çıkar, ✓ Seçili / Plana koy, "+ Seçenek ekle" | KISMEN | v82 sütunlarda fiyat, puan, istekler, artı/eksi, Seç VAR; süzgeçler, rozetler, tepkiler, tik yok. |
| Tablo | `CompareView.tsx:178-257` | Seçenekler sütun, kriterler satır; puan + bilgi yüzdesi; Plana al / Planda ✓; artılar · eksiler satırı; kriter başına önem seçici + "notundan / sezgi" notu; hücre değeri + çubuk + not; Eksik bilgi satırı | YOK | Ağırlık ayarı tamamen yok. |
| Açıklama ızgarası | `CompareView.tsx:271-321` | "Neden X?" (+puan), "Karşılığında", "Sonucu ne değiştirir?" (… çok önemli olursa → Y · dene), "Rezervasyondan önce kontrol et" | YOK | |
| Olanak çipleri | `CompareView.tsx:326-337` | "İstediğin olanaklar" (konaklamada) | YOK | |
| Alt bilgi | `CompareView.tsx:341-356` | Puanların nasıl hesaplandığı, "Önemleri varsayılana döndür", "Gezi bütçesi: €X" | YOK | |

## 14. Gün gün

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Görünüm | `Timeline.tsx:25-66`; `days/DayViews.tsx:23-40` | Plan'ın üçüncü okuması | YOK | v82: "Gün gün görünümü ayrı çizilecek" tostu. |
| Kompakt · Liste · Kartlar | `TripPanel.tsx:882-893`; `days/dayMode.ts` | Cihaz başına hatırlanır | YOK | Emre kararı r-gungun: fotoğraflı Liste ve Kartlar kalsın, Kompakt yan yana. |
| Planda, günü yok şeridi | `ideas/IdeaTiles.tsx:232-252` | Plana konmuş ama günü olmayan yapılacaklar + gün düğmesi | YOK | |
| Gün şeridi | `DayViews.tsx:49-53` | Günler arası atlama | YOK | |
| Gün kartı | `DayCards.tsx:91-240`; `DayViews.tsx:106-219` | Tarih, "Gün N", "Bugün", "Yolculuk günü" (Çıkış/Varış), şehir fotoğrafı (Liste/Kartlar), "Günün akışı", "Günün rezervasyonları" (planın kendi kartları, "✓ hazır" / "n bekliyor"), "Gece: Kyoto · Gion Hatanaka" / "konaklama aranıyor", "Eve dönüş", "n satır bekliyor", "+ Bu güne ekle", "Serbest gün · yapılacaklardan seç" | YOK | |
| Satır | `DayCards.tsx:254-305` | İkon, "NE · HANGİSİ", kısa alt satır, saat, yüzler, aşama; transferde yerinde gövde + "Plan'da göster"; başlığa basınca plandaki kart açılır ve parlar | YOK | |
| Saat hücresi | `DayCards.tsx:328-375` | "~" hesaplanan (neden ipucunda), dokun → saat ver (günün geri kalanı uyar), × hesaplanana dön; elle taşınmış satır | YOK | |
| Uyarı | `DayCards.tsx:308-322` | "17:40'ta havalimanında olmalısın" + "Elle girileni sil" / "Hesaplanan saate dön" | YOK | |
| Sürükle-bırak sıralama | `DayCards.tsx:485-550` | Tutamakla sürükle ya da ↑ ↓ ile taşı | YOK | |
| Canlı uçuş satırı, İniş saati? | `DayCards.tsx:420-470` | bkz. bölüm 17 | YOK | |

## 15. Harita

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Harita sekmesi | `map/BoardMap.tsx:19-80`; `TripPanel.tsx:889-891, 923-924` | Gün gün anahtarındaki "Harita"; MapLibre küre, OpenFreeMap | YOK | Emre kararı sil-flight: "Kalsın (harita olacak)". |
| Duraklar ve yollar | `map/TripMap.tsx` | Duraklar foto + gece; ev; yolculuklar büyük daire yayı (rezerve düz, diğerleri kesik) + süre; ipucunda "Porto → Lizbon · Tren · 10:05 · rezerve/planlanıyor" | YOK | |
| Geziyi oynat | `TripMap.tsx:557-562` | ▶ uçak yolları sırayla uçar / Durdur | YOK | |
| Yer arama | `BoardMap.tsx:30-46` | Bilinmeyen yerler Nominatim'le (saniyede bir) aranır; "Yerler haritada aranıyor…" | YOK | |
| Eksik yolculuklar | `BoardMap.tsx:69-74` | "1 yolculuk haritada yok: yeri bilinmiyor · X → Y" | YOK | |
| Hata ve boş | `BoardMap.tsx:57-66` | "Harita şu an açılamıyor (çevrimdışı…)" + Tekrar dene; "Haritada gösterecek yer yok henüz…" | YOK | |
| Rotayı haritada gör | `App.tsx:194-199` | ••• menüde Google Maps rota linki | YOK | Menü yok. |

## 16. Hazırlık

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Sayaç | `plan/PrepList.tsx:25-27`; `Section.tsx:61` | "2/6 hazır" | VAR | Kapalı satırda çubuk + "2/6 hazır". |
| Açıklama cümlesi | `PrepList.tsx:27` | "· gezine göre önerildi, sohbette 'şunu da ekle' diyebilirsin" | YOK (bilinçli, v82) | |
| Hazırları gizle / göster | `PrepList.tsx:29-33` | | VAR | |
| ✨ Daha fazla öner | `PrepList.tsx:34-38` | Sohbete istek | VAR | |
| Tik | `PrepList.tsx:59-64` | Yapıldı ↔ yapılmadı | VAR | |
| Başlık yerinde düzenlenir | `PrepList.tsx:44-47, 66` | | YOK | |
| Neden alt satırı | `PrepList.tsx:67` | "Kyoto'da 7–8 Nisan yağmur bekleniyor" | VAR | |
| "Hazır" etiketi | `PrepList.tsx:69` | İpucunda "Yapıldı · 12 Eki" | KISMEN | Etiket VAR, tarih yok. |
| Satın alma linki | `PrepList.tsx:57, 70-75`; `lib/prepBuy.ts:19-28` | Alınacak bir şeyse "a Amazon ↗" (TR'de amazon.com.tr) | VAR | v82 Amazon'da al ↗, Trendyol'da al ↗, Resmî site ↗ (sağlayıcı kaydından; Trendyol/Hepsiburada ve resmî site yeni). |
| "Orada yapılacak" (Yapılacaklar'a taşı) | `PrepList.tsx:77-80` | | YOK (bilinçli, v80) | Taşıma yolu kayboluyor; ⋯ menüye konabilir. |
| × sil + Geri al | `PrepList.tsx:81` | | VAR | Prototipte tost. |
| Hazırlık'a taşı (yapılacaktan) | `IdeaTiles.tsx:182` | | YOK | |
| Yolculuk'ta "Yola çıkmadan" | — | | YENİ | |

## 17. Uçuş günü canlı

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Canlı kutucuklar | `cards/FlightLive.tsx:18-39`; `lib/flightData.ts:155-193` | Rezerve uçuşta, uçuş gününde/havada/inince: Tahmini kalkış, Yeni kalkış (+25 dk kırmızı), Check-in masası, Kapı (önceki kapı), Tahmini iniş, Kalktı, İndi, Bagaj bandı, Varış terminali; İptal edildi / Başka yere indi | YOK | v79-v82: "ayrı ele alınacak". Emre kararı r-ucusdurum "Geri getir". |
| Canlı noktası | `FlightLive.tsx:24`; `static/app.css:4740` | İlk kutuda yeşil (zamanında) / kırmızı (rötar) nabız | YOK | |
| Durum (biniş vb.) | `lib/flightData.ts:137-153` | "Biniş başladı", "Kapı kapandı", "İnişe geçiyor" (yalnız 90 dk içinde tazeyse) | YOK | |
| Rötar saatleri | `PlanCard.tsx:255-261`; `TransportCard.tsx:24-35` | Yeni saat kırmızı, eski üstü çizili; terminal kodun yanında | YOK | |
| Ayak notu + kaynak | `PlanCard.tsx:267-271`; `lib/flightData.ts:205-228` | "Biletinde kalkış 10:10, tarifede 10:40", "Planı yeni saate göre kaydırdım: iniş 19:55"; "AeroDataBox · 5 dk önce" | YOK | |
| Gün gün canlı satırı | `days/DayCards.tsx:420-431` | "Rötar 25 dk · Terminal 1 · Kapı D5 · Bant 4 · Veri: AeroDataBox" | YOK | |
| İniş saati? | `DayCards.tsx:440-470` | Sayfa iniş saatini vermediyse yazdırır; transfer ve check-in buna göre | YOK | |
| Kod uçuş gününde | bkz. 5b | | KISMEN | |
| Check-in açılış notu | — | | YENİ | "Check-in 15 Nis 11:00'de açılır" (veri kaynağı tanımsız). |

## 18. Belgeler sekmesi

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Sekme | `docs/DocsTab.tsx:51-105`; açılış `App.tsx:191` | Tüm gezi belgeleri; Uçuş · Konaklama · Ulaşım · Etkinlik · Sigorta · İnternet · Diğer grupları; "N belge · yalnız bu bilgisayarda" | YOK | v79'da Pano sekmesi olarak vardı, v81'de düştü. Pano kenar menüsüne "Belgeler" ya da üçüncü sekme. |
| Satır | `DocsTab.tsx:128-158` | Küçük resim/PDF ikonu, ad (aç), eklenme tarihi · boyut, ait olduğu kart "Seyahat sigortası · Allianz →" (plana gider), Aç, × (Geri al) | YOK | |
| Karta bağla | `DocsTab.tsx:161-178` | Kartsız belge için bölüm bölüm seçme listesi | YOK | |
| Boş | `DocsTab.tsx:74-79` | "Henüz belge yok. Bir PDF'i ya da bilet görselini sohbete bırak: okuyup doğru karta koyarım…" | YOK | |
| Kart üstü belge erişimi | `cards/DocAccess.tsx:85-125` | Soluk ataç (ekle), "Belge" / "3 belge" hapı (aç / liste + "Belge ekle"), "belge yok" turuncu | VAR | v82 alındıda "Onay e-postası aç" / "E-bilet aç" / kesik "Bileti ekle"; ayrıntıda belge satırı "Ekle". Birden çok belge listesi yok. |

## 19. Yazdır / PDF

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Tetikleyiciler | `App.tsx:193`; `TripPanel.tsx:617-644` | ••• "Planı PDF olarak indir"; hero ikincil "PDF indir"; %100'de ana düğme; "PDF hazırlanıyor…" | YOK | `mk82.js` h-pdf'i dinliyor ama düğme çizilmemiş. |
| İçerik | `PrintPlan.tsx:1-6, 231-335` | Hero (foto ve künye, tarih, rota, kimler, tarz, plan durumu, içerik, bütçe, ülkenin küçük bilgileri), Rezervasyonlar, Gün gün (saatler, notlar), "Trip Radar ile hazırlandı · tarih"; dosya adı gezi adı; olmazsa Chrome yazdırma penceresi | YOK | Yeni hero ve kartlarla PDF düzeni de güncellenmeli. |

## 20. Boş durumlar (özet)

| Özellik | Canlıda nerede | Ne zaman | Yeni tasarımda | Not |
|---|---|---|---|---|
| Kayıtsız gezi | `TripPanel.tsx:622-624, 726` | Sekmeler gizli, ana düğme "İlk kaydı ekle" | YOK | |
| Hero blokları | bkz. bölüm 1 | Foto, tarih, ülke/hava, kişiler, tarz, bütçe, tercihler | YOK | |
| Yeni omurga | `StartGuideCard.tsx` | | KISMEN | v82 "Omurga yeni" senaryosu (her niyette Önerimiz) VAR; başlangıç kartı yok. |
| Boş niyet / kart | `EmptyCard.tsx` | | VAR | |
| Etkinlik, yapılacak, arka yüz, Pano, Belgeler, Harita boşları | ilgili satırlar | | KISMEN | Etkinlik/Yapılacak boş yuvaları VAR; diğerleri yok. |
| "Sana uyan başka seçenek bulamadık" | `BackFace.tsx:459` | Yalnız arama yapıldıysa (Emre kararı: arama yapılana kadar gizle) | YOK | |

## 21. Hata ve çevrimdışı durumları

| Özellik | Canlıda nerede | Ne yapar / ne zaman görünür | Yeni tasarımda | Not |
|---|---|---|---|---|
| Okunamadı kartı | `ArriveViews.tsx:41-100` | "Okunamadı · neden · Tekrar dene / Kaldır" (planda) | YOK | |
| Çevrimdışı bildirimi | `OfflineNotice.tsx:7-42`; `App.tsx:340` | "İnternet yok · 3 kayıt bekliyor · 12 sn sonra tekrar deniyorum · Şimdi dene", "Tekrar deniyorum…", "Kaydedildi ✓" | YOK | Ekran altında aynen kalabilir. |
| Belge eklenemedi | `DocAccess.tsx:39-47` | Satır içi kırmızı hata | YOK | |
| Yerinde düzenleme hatası | `InlineEdit.tsx:164` | | YOK | |
| Geri alınamadı | `TripPanel.tsx:976-980` | | YOK | |
| Paylaşım eşitleme hatası | `Share.tsx:171`; `ShareSafety.tsx:57, 69-73` | "Olmadı: …" | YOK | |
| Harita açılamadı | `BoardMap.tsx:60-66` | | YOK | |
| AI yorumu alınamadı | `CompareView.tsx:446-454` | + Tekrar dene | YOK | |
| Link biçimi hatalı | `Pano.tsx:285` | | YOK (bilinçli) | |
| Fotoğraf/logo yüklenemedi | `FallbackImg.tsx`; `FlightTicket.tsx:22-31` | Çizime/ikona düşer | KISMEN | v82 görseller çizim; yedek kuralı tasarım notunda ("yoksa bu çizimler yedek"). |

## 22. Hareketler (animasyon)

| Özellik | Canlıda nerede | Ne yapar | Yeni tasarımda | Not |
|---|---|---|---|---|
| Sihirli açılış | `opening.ts:1-40`; `TripPanel.tsx:126-136` | Gezinin Planı ilk açılışta (gezi başına bir kez) parçalar okuma sırasıyla yükselir, sayılar 0'dan sayar, çubuklar dolar; orb + kıvılcım + ışıltı; dokunuş bitirir | YOK | Yeni bileşenler `data-pit` / `data-count` işaretlerini taşımalı. Emre kararı r-acilis "GERİ GELSİN". |
| Mühür | `motion.ts:71`; `static/app.css:4181, 4908` | Kart rezerve olunca rozet/tik büyükten basılır | YOK | |
| Parlama | `motion.ts:50`; `app.css:4182` | Bir cevap kartı değiştirince halka | KISMEN | v82 `q-flash` (seçince/Sıradaki). |
| Aşama geçişi | `motion.ts:91`; `app.css:4735-4738` | Seçildi/Rezerve olunca biletin uçağı kalkar, logo düşer, etiket zıplar | YOK | |
| Düşüş | `motion.ts:104`; `app.css:4183` | Sohbetin eklediği kart yukarıdan düşer | YOK | |
| İniş halkası | `PlanCard.tsx:205-206`; `app.css:4742` | Önerimiz değişince bir kez halka | YOK | |
| Uçak süzülmesi | `motion.ts:112`; `app.css:4739` | Bilet ilk çizildiğinde uçak kartına süzülür | YOK | |
| Nabız (en çok 2) | `hareketDili.ts:19-22`; `app.css:4184, 4987` | Boş kart halkası/boş bilet 2,4 sn | YOK | |
| Sayaç | `motion.ts:119`; `Counted.tsx` | Bütçe rakamları yeni değere sayar | YOK | |
| Kalkma (hover) | `app.css:1531, 2052` | Kart üzerine gelince gölge | VAR | v82 kart hover dönüşümleri. |
| Bölüm aç/kapa | `motion.ts:174-200`; `app.css:4257` | | YOK | |
| Arka yüz çevirme | `app.css:5004-5005`; `BackFace.tsx:36-40` | 380 ms açılış, 180 ms dönüş | YOK | |
| Sekme kayması | bkz. bölüm 2 | | YOK | |
| İskelet + ışık süpürmesi | `ArriveViews.tsx:52-56, 81-86`; `app.css:4273` | 0,4 sn'den uzun beklemede | YOK | |
| Yeni kart halkası + sayaç zıplaması | `useArrivals.tsx:17-19`; `app.css:2700-2701`; `hareketDili.ts:230-232` | İnen kart kayarak gelir, bölüm sayısı zıplar, küçük tik basılır | YOK | |
| Plana koy uçuşu | `putFly.ts` | | YOK | |
| Pencere çıkışı | `exitMotion.ts:1-18`; `app.css:4249-4254` | Pencere/çekmece/tost geldiği gibi gider | YOK | |
| Gezinin şekli taşıtı | `app.css:3931` | Duraklar arası 6 sn yol | YOK (bilinçli) | |
| Işık çizgisi, iş hapı | `WorkPill.tsx`; `app.css:5249-5250` | "N kayıt eklendi ✓" solarak | YOK | |
| Geri al halkası | `UndoToast.tsx:13-21`; `app.css:4147` | 8 sn boşalır | YOK | |
| Hero bilgisi süzülmesi | `app.css:1140` | | YOK | |
| Maskot halleri (Pano boş) | `Pano.tsx:247`; `app.css:4204, 4305` | uyur / şaşırır | YOK | |
| Ekran geçişleri | `viewTransition.ts:23, 51` | Gezi kartının fotoğrafı hero fotoğrafına büyür | KISMEN | Mozaik kapakla eşleşmesi tanımlanmalı. |
| Azaltılmış hareket + "Hareketi duraklat" | `motion.ts:14-47` | Tümü kapanır | KISMEN | v82 CSS `prefers-reduced-motion` VAR; ayar anahtarı yok. |
| Yapışkan ince şerit | — | | YENİ | `h-mini` kaydırınca. |

## 23. Klavye ve erişilebilirlik

| Özellik | Canlıda nerede | Ne yapar | Yeni tasarımda | Not |
|---|---|---|---|---|
| Esc ile kapatma | `CardShell.tsx:55-60`; `stageMenu.tsx:107`; `AddSheet.tsx:56`; `BookingSheet.tsx:42`; `BackFace.tsx:161-165`; `CompareView.tsx:104`; `Travellers.tsx:57-61`; `DayPicker.tsx:22`; `HoverTip.tsx:58` | Menü, pencere, açılır kutu; odak açan düğmeye döner | KISMEN | v82 Esc açılır kutuları ve Pano'yu kapatır. |
| ← → seçenekler arasında | `BackFace.tsx:172-183` | Arka yüzde odak halkası seçenekler arasında; Tab arka yüzde kalır | YOK | |
| Enter/Space kart gövdesi | `CardShell.tsx:346-348`; `EmptyCard.tsx:202-204`; `JourneyCards.tsx:46-51` | Ayrıntı açar / kartına gider | KISMEN | |
| Tab / Shift+Tab düzenleme | `InlineEdit.tsx:278-281` | | YOK | |
| ↑ ↓ satır taşıma | `DayCards.tsx:537-538` | Gün gün | YOK | |
| Tek ••• açık kuralı | `CardShell.tsx:38-49` | Bir menü açılınca diğeri kapanır | VAR | `mk82.js closePops`. |
| Ekran okuyucu metinleri | `Section.tsx:76-79`; `StickyBar.tsx:74`; çoğu `aria-label` | Durum renkle değil sözle | KISMEN | Prototipte aria-label'lar kısmen. |

## 24. Dış bağlantılar (özet)

| Bağlantı | Canlıda nerede | Ne zaman | Yeni tasarımda | Not |
|---|---|---|---|---|
| Booking (tarih, kişi dolu) | `lib/searchLinks.ts:185-218` | Konaklama boş/ihtiyaç, Kendin ara | VAR | v82 Booking.com · Airbnb · Agoda (Agoda yeni). |
| Airbnb | aynı | | VAR | |
| Google Flights · Skyscanner · Kayak | `searchLinks.ts:161-177` | Uçuş boş/ihtiyaç | KISMEN | v82 Skyscanner · Google Uçuşlar; Kayak yok. |
| Uber · Google Maps "Yol tarifi" | `searchLinks.ts:222-228` | Transfer, şehir değişimi | YOK | v82 tren için JR · Rome2rio (yeni). |
| GetYourGuide · Viator · Klook | `searchLinks.ts:231-246`; `SectionTimeline.tsx:117-126` | Etkinlik, dinlenme araması | VAR | |
| Airalo · Holafly (ülke sayfası) | `searchLinks.ts:290-298` | eSIM | VAR | |
| Google "Sigortaları karşılaştır" | `searchLinks.ts:285-288` | Sigorta | VAR | |
| Amazon (TR'de amazon.com.tr) | `lib/prepBuy.ts:19-28` | Hazırlık alışveriş | VAR | v82 + Trendyol/Hepsiburada/ülke Amazon'u, Resmî site. |
| Resmî vize kaynağı | `VisaRow.tsx:20-24` | Vize gerekiyorsa | YOK | |
| Kayıtlı sayfa · "Tarihlerle aç ↗" | `PlanCard.tsx:152-153, 213`; `cards/parts.tsx:70-73` | Tarihsiz kayıt ihtiyacın gecelerine göre yeniden açılır | KISMEN | v82 CTA kaynağa gider; tarih ekleme kuralı korunmalı. |
| Rezerve et ↗ / Bileti al ↗ / Satın al ↗ | `PlanCard.tsx:159-163, 419` | Seçildi/önerimiz | VAR | v82 logolu düğme ("Booking.com'da rezerve et"). |
| Etkinlik sitesi ↗ (favicon) | `ActivityBoard.tsx:416-421` | | VAR | |
| Kaynak teklifleri (Aviasales, Tripadvisor/Xotelo, Viator) | `OfferRow.tsx:102, 158, 249`; `lib/offerSources/index.ts:1-9` | "✨ Senin için" satırı | KISMEN | |
| Haritada aç | `BookingSheet.tsx:97-100`; `IdeaTiles.tsx:177, 213`; `lib/ideas.ts:216-218` | Rezerve konaklama, yapılacak adı/menüsü | KISMEN | v82 alındıda "Haritada aç ↗"; yapılacakta yok. |
| Otele yaz ↗ / Ev sahibine yaz ↗ | `BookingSheet.tsx:72-110` | Yalnız gerçek iletişim linki varsa | VAR | |
| Sağlayıcı sayfası ↗ | `BookingSheet.tsx:101-105` | | YOK | |
| İlham kaynağı | `IdeaList.tsx:154-160` | | VAR | v82 "Aç ↗". |
| Rotayı haritada gör | `App.tsx:194-199` | | YOK | |
| Foto künyesi (Unsplash/Wikipedia/Pexels) | `TripHero.tsx:32-53` | | YOK | |
| Havayolu logosu (Kiwi, Aviasales) / site favicon'ları | `FlightTicket.tsx:22-31`; `cards/parts.tsx:22-26` | | VAR (görsel) | |
| Ortaklık yönlendirmesi (Travelpayouts) | `lib/affiliate.ts:1-40`; `main.tsx:23` | Ortak markaların sayfası yalnız tıklanınca tp.media'dan geçer; kişisel rezervasyon sayfaları asla | VAR (görünmez) | Kodda aynen korunmalı; sağlayıcı kaydındaki "ortaklıkParametresi" ile çakışmamalı. |
| "Check-in yap" | — | | YENİ | v82 örnek veride var (`data81x.py ACC`), kartta çizilmemiş. |

---

## Not: kullanılmayan (ölü) kod ve erişilemeyen yollar

- `src/app/SwipeCard.tsx` içindeki `SettledCard` (≈262-389) hiçbir yerden çağrılmıyor.
- `src/app/Carousel.tsx` hiçbir yerden çağrılmıyor.
- `src/app/ideas/IdeaList.tsx` `IdeaList` bileşeni, `IdeaLine.tsx` ve `QuickAdd.tsx` kullanılmıyor (yalnız `InspoGrid` canlı).
- `TripPanel.tsx:661-663` `leg` (LegRow başlığı) tanımlı ama kullanılmıyor; `LegBody` canlı.
- `TripPanel.tsx:1094-1117` OptionGroupView'in alt yolu (seçenek ızgarası, `Headline`, "+N seçenek daha", "Karşılaştır →/Kriterleri gör →" satırı) pratikte erişilemez: konaklama dışı ve kararlı/taslaklı gruplar NavGroup'a, kararsız konaklama NeedGroup'a gidiyor.
- `PlanEntry.tsx:134-180` `OpenNights` yalnız `plain` olmayan çizimde (Gün gün'deki eski blok) kullanılıyor.

Bunlar "kaybedilecek" sayılmamalı; ama içlerindeki metinlerin bir kısmı (ör. "Kriterleri gör") başka yerde yok.

---

## Özet 1 · Tasarımda HİÇ yok (önem sırasıyla)

1. **Gezi ••• menüsü** (Belgeler, Paylaş/Paylaşım kodu, PDF, Rotayı haritada gör, Geçmiş ve çöp kutusu, Yeni sohbet, Ayarlar, Gezi sil, Link ekle): mozaik kapağın sağ üst köşesine canlıdaki gibi ⋯ koyun; birçok özelliğe tek giriş buradan.
2. **Gün gün görünümü** (Kompakt/Liste/Kartlar, saat verme, sürükle-bırak, uyarılar, "Planda, günü yok"): görünüm seçicideki üçüncü sekmeyi, Yolculuk sırasıyla'nın günlere bölünmüş hali olarak canlı satır standardıyla (NE · HANGİSİ, saat, durum) çizin.
3. **Yerinde düzenleme** (ad, şehir, tarih, saat, fiyat + para birimi, nereden/nereye; Enter/Esc/Tab; "sayfadaki: X · geri al"): niyet başlığındaki bilgi satırı ve kart başlığı/fiyatı tıklanınca aynı yerde kutuya dönüşsün (v65 şartı).
4. **Ekleme penceresi ve "+ Buraya ekle"** (18 şablon, anında ekleme + Geri al, kartlar arası +, boş bölüm çipleri, sürükle-bırak katmanı): kategori sonundaki "+ X ekle"yi bu pencereye bağlayın, plan başlığına tek "+ Ekle" ve kategorilerin altına "Ekle:" çip satırı ekleyin.
5. **Uçuş günü canlı** (kutucuklar, Canlı noktası, rötar kırmızısı, Biniş başladı/Kapı kapandı, "Planı yeni saate kaydırdım", AeroDataBox, İniş saati?): uçuş kutusunun sabit gövdesinde rota altındaki çip satırı uçuş gününde canlı kutucuk şeridine dönsün, yan sütun üstü rötar/kapı göstersin.
6. **Belgeler sekmesi** (gruplu liste, karta bağla, aç, sil + Geri al): Pano kenar menüsüne "Belgeler" girişi ya da Plan/Pano yanına üçüncü sekme (v79'daki gibi).
7. **Harita** (MapLibre, duraklar, yollar, Geziyi oynat, eksik yolculuklar): görünüm seçiciye dördüncü "Harita" ya da Yolculuk sırasıyla'nın üstünde katlanır harita.
8. **Yazdır / PDF** (menü, hero ikincil düğme, %100'de ana düğme): hero şeridine sessiz "PDF" düğmesi; %100 olunca "Sıradaki" yerini "Planı PDF olarak indir"e bıraksın.
9. **Fotoğraf künyesi ⓘ** (lisans zorunluluğu): kapak ve her mozaik karesinin sağ altına küçük ⓘ; Places fotoğrafları da künye ister.
10. **Yapılacaklar listesi ve ⏳ iptal süresi sayacı**: hero'daki "%50 hazır · 7 karar" tıklanınca grup grup liste açılsın; ⏳ n rozeti bütçe/hazırlık bölmesine.
11. **Hata ve çevrimdışı halleri** (okunamadı kartı, internet yok şeridi, belge/düzenleme/eşitleme hataları, harita/AI hatası): ilgili niyet kutusunun gövdesine ince kırmızı şerit + Tekrar dene/Kaldır; ekran altı bildirim şeridini aynen koruyun.
12. **İçerik gelirken** (bekleme kartı/iskelet, üst ışık çizgisi, inen kartın halkası, "Konaklama'ya eklendi · Göster"): tahmin edilen niyetin seçenek sırasında iskelet kart, kategori satırında sayaç zıplaması.
13. **Karar yardımının derinliği** (önem ayarı, "Sonucu ne değiştirir? · dene", AI yorum metni ve halleri, "Sırayla karar ver", olanak çipleri, eksik bilgi, "Önemleri varsayılana döndür"): Pano karşılaştırmasının üstüne "Önemleri ayarla" çekmecesi ve "Sırayla karar ver" düğmesi.
14. **Tüm detaylar çekmecesi** (başka geziye taşı, puan parçaları, fiyat kapsamı/vergi, fiyat geçmişi, kanıt, orijinal sayfa, kaydı sil): ⋯ > Ayrıntı panelinin altına "Tüm detaylar ›".
15. **Paylaşım izleri** (değişiklik bildirimi + Geri al/Tamam, "Sabine ile paylaşılıyor" satırı, Pano haber noktası, "Yeni" işareti, "Sabine'in bileti" rozeti + "Kimin için?" menüsü, kişiye göre arama): Plan başlığı üstüne bildirim şeridi, niyet başlığına yüz rozeti, ⋯ menüye "Kimin için?".
16. **★ öncelik, karşılaştırma satırı, "Seçmeden kontrol et", PivotNote, Kanıt** (Emre "Geri getir/YAP" kararları): Ayrıntı panelindeki artı/eksi satırlarına ★ ve tek satır "2.'ye göre +€30", sonuna "Ev sahibine sor".
17. **Diğer ulaşım ve konaklama türleri** (otobüs, minibüs, vapur, taksi/transfer boş ve seçili, araç/motosiklet/karavan/bisiklet kiralama, kamp/kendi konaklaman, not, restoran rezervasyonu): bilet gövdesini (taşıyıcı + rota + koçan) ortak kullanın; kiralamada rota yerine "alış yeri · n gün · iade"; kampta fiyat yerine "Rezervasyon gerekmez".
18. **Belirsiz şehir değişimi ve transfer gövdesi** (Tren/Otobüs/Araba/Uçak/Ben hallettim seçici, mod çipleri, "Ayarlandı / rezerve edildi" kutusu, notlar, Uber/Yol tarifi): Ulaşım niyetinin "Aranıyor" gövdesinde illüstrasyonlu yol seçici.
19. **Kural önerileri** ("Kısa aktarma · Anladım", "Konaklama bul", "Havalimanı transferi · Taksi", "Aylık kiralama") ve "N öneri" sayacı: kategori açılınca niyetlerin üstünde ince öneri satırı; uyarılar ilgili niyete ⚠ çip.
20. **Gizlenenler listesi** (elenen, kapanan, iptal edilen, gizlenen transfer/geceler; Geri al/Geri getir) ve **Geçmiş ve çöp kutusu**: kategori sonuna "Gizlenenler · n göster"; Geçmiş ⋯ menüden.
21. **Hareket sözlüğü** (sihirli açılış, mühür, düşüş, aşama geçişi, uçak süzülmesi, nabız, sayaç, bölüm aç/kapa, arka yüz çevirme, sekme kayması, plana koy uçuşu, pencere çıkışı): yeni bileşenlere aynı sınıfları ve `data-pit`/`data-count` işaretlerini verin; Emre'nin m-* kararları geçerli.
22. **Başlangıç kartı** (yeni gezide 3 adım, "Başlangıç yaklaşık · Bu tarih doğru"): "Omurga yeni oluştu" halinde Plan başlığının altına tek seferlik kart.
23. **Hero'nun boş/tahmini halleri ve lead cümlesi** (fotoğraf yok, tarih "~", ülke/hava yok, kişi yok, tarz yok, bütçe yok; ruh hali cümlesi): mozaiğin "omurga yeni" sürümünü çizin; lead kapakta şehirlerin altına tek satır.
24. **Yapılacak ayrıntıları** (Hepsi/Gezilecek/Restoranlar süzgeci, Yaptım/Gittim, Haritada aç, Etkinliklere/Hazırlık'a taşı, Maps rozeti, puan, şehirler arası yol satırı, "Daha fazla öner"): yapılacak karosuna ⋯ menü ve ad = harita linki; Planında başlığının sağına süzgeç çipleri.
25. **eSIM kurulum hali, "Rezervasyonu geri al", "Seçimi geri al", "Çıkar", "Sil", "Bunun gibileri gösterme", "Planı temizle"**: alındı/seçili kutularının ⋯ menüsüne bu satırları ekleyin (şu an ⋯ yalnız Ayrıntı ve Gerek yok).
26. **Plan uyarıları (⚠ notices), "Dönüş bileti ara", bilet uyarısı "Uçuşa 12 gün · bilet alınmadı", tarih ⏳ uyarıları, seçilen yerin kapsamadığı geceler notu**: ilgili niyet kutusunun bilgi satırına uyarı çipi; plan başlığı altına ⚠ şerit.

## Özet 2 · Tasarımda kısmen var, karar gerekiyor

1. **Akordiyon (tek kategori açık) ↔ canlıdaki çoklu açık + gezi başına hatırlama + otomatik açılma** (kart bölüm değiştirince, kayıt inince): hangisi kalacak, hatırlama korunacak mı?
2. **"%50 hazır" ↔ "Planlananların %67'si rezerve"**: yüzde neyi sayıyor? Canlı karar bekleyenleri yüzdeye katmıyor; hero, yapışkan şerit ve PDF aynı sayıyı söylemeli.
3. **Bilinçli kaldırılanlar teyidi**: plan başı "+ Ekle" (v81), renk anahtarı PlanKey (v81), gezinin şekli şeridi (v80), Pano "+ Link ekle" (v78), Hazırlık "Orada yapılacak" (v80) ve açıklama cümlesi, "Sohbete attığın linkler buraya düşer" notları (v82). Özellikle "+ Ekle" ve PlanKey kalkınca hiç kaydı olmayan türü ekleme yolu ve renklerin anlamı kayboluyor.
4. **İlham planda değil Pano'da**: canlıdaki İlham bölümünün "+ Gün" (bir güne koy) ve × sil işlevleri Pano İlham kartında yok; "✨ İçinden yerleri çıkar" yeni ve hangi niyete düşeceği açık.
5. **Değiştir: yerinde seçenekler ↔ arka yüz** (Kaydettikleriniz / Önerimiz bölümleri, Kendin ara karosu, "AI'a arat", Karşılaştır, ← → klavye, Pano'da aç · +N): yeni yaklaşımda AI'a arat ve Karşılaştır nereye gidecek?
6. **× katlama "Neden? Gerek yok / Ben hallettim"** ↔ ⋯ > Gerek yok: "Ayarlandı" (Ben hallettim) hali tasarımda var ama ona götüren eylem yok; ⋯ menüye eklenmeli mi, × geri mi gelmeli?
7. **Ayrıntı içeriği**: ⓘ balonu (hover, salt bilgi) ve kart detayı (tap, eylemler) tek "Ayrıntı" panelinde birleşiyor; Uyum puanı, "Tarihlerle aç", "Pano'da gör", "Belge ekle", geri alma eylemleri hangi panele?
8. **Rezervasyon kodu her zaman görünür (v81 erişim modu) ↔ canlıda yalnız uçuş günü**; "Onay e-postası aç" için belge gerekli, yoksa kesik "Onayı ekle": belgesiz rezervasyonun "belge eksik" uyarısı hero sayacına girecek mi?
9. **Fiyatın alındıdan sonra kalkması** (v81) ↔ bütçe, kategori harcaması ve "ödendi" bilgisi: Ayrıntı'daki "€900 ödendi" yeterli mi, bölüm bütçe ipucu geri gelecek mi?
10. **Önerimiz'de "Rezerve et ↗" (önce seç, sonra sayfa) ↔ v82 "Booking.com ↗" (seçmeden kaynak)**: kaynak linkine basmak seçim sayılacak mı?
11. **Beğeni ♥ ↔ 👍/👎 oylar ↔ Olmaz/Olur/Süper tepkileri ↔ "ikisi de 👎 → geri çekil"**: tek bir oy modeli seçilmeli (v79 açık konusu).
12. **Pano**: arama, durum süzgeci (Hepsi/Karar bekleyen/Planda), sıralama seçimi, Beğenilenler süzgeci, "Plan'da gör →", "Senin için" özeti, "Neden?", boş haller ve maskot: hangileri yeni Pano'ya taşınacak?
13. **Karşılaştırma penceresi (CompareView) ↔ Pano karşılaştırma sütunları**: ağırlık ayarı, "Sonucu ne değiştirir?", AI yorumu, "Sırayla karar ver" (Emre "Geri getir") yeni yapıda nerede yaşayacak?
14. **Kendin ara sağlayıcıları**: canlıda Booking/Airbnb, Google Flights/Skyscanner/Kayak, Uber/Maps; v82'de Agoda, Rome2rio, JR, Trendyol, Hepsiburada eklendi, Kayak ve Uber düştü. Dinamik sağlayıcı kaydı (v81 kuralı) ve Travelpayouts ortaklık listesiyle uyumu.
15. **Kimler gidiyor penceresi**: ad ekleme/çıkarma, kişi sayacı, nereden, fotoğraf seçme, paylaşım satırı canlıda var; v82 yalnız liste + davet. Korunacak mı?
16. **Tarz çipleri ↔ Tercihler özeti**: canlıdaki "Gezinin tarzı" (AI tarzı + bütçe düzeyi) ayrı mı kalacak, Tercihler etiketine mi karışacak?
17. **Hava ve ülke**: şehir şehir ikonlu hava ↔ tek "6–19°" çipi; çok ülkeli gezi ve bayrak.
18. **Yapışkan şerit**: canlıdaki Plan/Pano anahtarı, sığar/aşar noktası, "✓ Her şey hazır" hali h-mini'de yok.
19. **Vize**: yalnız "gerekmiyor" çizildi; "Vize gerekiyor + Resmî kaynak + ✓ Vize alındı" hali ve hero çipiyle Belgeler satırının ikisi de mi duracak?
20. **eSIM ve sigorta**: eSIM boş hali, sigortanın seçenekli/alındı hali çizilmedi; "Plana koy" (kural önerisi) yerine "AI'dan öner" mi?
21. **Etkinlik kartı**: ↻ "yerine başkasını öner", "Gezinin sebebi" (festival), toplam fiyat (2 kişi · €90), "Başka öneriler", fikirleri katlama çubuğu; Planında 4'ten fazla olunca ne olacağı (v82 açık konu).
22. **Yolculuk sırasıyla kartları**: canlıdaki ⏳ iptal uyarısı, "N gece için yer seçilmedi", platform, "gezinin sebebi", "gün seç", kim buldu yeni küçük kartlarda yok; uçuş/yol kartının tam kart yerine küçük kart olması.
23. **Bölüm bütçe ipucu ve "N öneri" sayacı**: kategori satırına geri gelecek mi?
24. **Hazırlık**: başlığı yerinde düzenleme, "Yapıldı · 12 Eki" tarihi, Yapılacaklar'a taşıma (Orada yapılacak kalktı) ve Yapılacaklar'dan Hazırlık'a taşıma.
25. **Hero ana düğmesinin halleri**: boş gezide "İlk kaydı ekle", tamamda "Paylaş", %100'de PDF; "Sıradaki" yalnız orta hali karşılıyor.
26. **Mozaik kareler ve bölge çipleri**: veri kaynağı (plandaki ve biriken yerler, Places API, bölge tahmini fiyatları) kodda yok; künye ve yedek çizim kuralıyla birlikte tanımlanmalı.
27. **Telefonda sabit yükseklik** (v82 açık konu) ve arka yüzün telefonda akışa inmesi: yeni kutu standardında telefon davranışı.
