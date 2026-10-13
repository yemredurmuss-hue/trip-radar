# Kayıp dedektörü A: yayınlanmış her sürümdeki metin ve sınıfları bugünkü build ile karşılaştırma

Salt okunur çalışma. Kaynak koda dokunulmadı, commit yok. Araçlar ve ara çıktılar: `/tmp/claude-0/-home-user-trip-radar/71817299-ab28-5f54-8d3b-9ea0ff461203/scratchpad/kayip-a/` (ext.py, an2.py, kw.py, lost4.txt, lostcls.json).

## 1. Yöntem ve sayılar

- Taranan: `origin/release` dalındaki **154 "Release X" commit'i, 149 farklı sürüm etiketi, 0.4.0 (25d077e, 2026-09-28) → 0.36.84 (5ac607a, 2026-10-13)**. (Görev metnindeki "~84" değil, 154 commit. 0.36.81 iki kez, bazı numaralar hiç yok, ör. 0.36.44, 0.36.47.)
- Her sürümden `git show <hash>:extension/app.js` (+ popup.js, background.js, app.html, _locales/*.json) içindeki string literal'ler çıkarıldı (esbuild çıktısı `\xE7`, `ş` kaçışlarını çözerek; uzunluk 4–140, harf içeren, kod olmayan, çok sözcüklü ya da Büyük harfle başlayan tek sözcük; kütüphane/kod parçaları ayrıca elendi). CSS sınıfları `extension/app.css`'ten.
- Bugünkü karşılık: `plan-v46-kod` HEAD `b7beee3` (2026-10-13 20:12), `npm run build` ile `dist/` (app.js 2,7 MB, app.css 411 KB). Not: ilk build'im HEAD'den 3 dk eskiydi (P9b "geri alındı" commit'i CSS'i geri getirmişti); hepsi yeni build ile yeniden hesaplandı.
- Canlı = release 0.36.84 (5ac607a) = `04436aa Bump to 0.36.84` (kaynak commit). Tüm v46 işi (P0..P9, 883b9cc..b7beee3, ~38 commit) bu sürümün ÜSTÜNE biner. `git diff 04436aa HEAD -- src` = 62 dosya, +3736/-1734; tek silinen dosya `src/app/cards/Peek.tsx`.
- Sonuç: **9 287 benzersiz metin** görüldü. Bugünkü build'de birebir bulunmayan ham aday 2 492; kod/kütüphane gürültüsü ve Latin dışı (zod yerelleri) elenince **686 kayıp metin** (bunların 447'si bugünkü build'de alt-metin olarak bile yok; 239'u daha uzun bir cümlenin içinde yaşıyor, işaret `~`). **1 931 sınıftan 538'i** bugünkü CSS'te kuralsız (278'i canlı 0.36.84'ten, 260'ı daha eski sürümlerden).
- Önemli gözlem: 0.36.84'ten bugüne kaybolan metin azdır (≈109 aday, çoğu durum sözlüğü yeniden adlandırması), ama 278 sınıf gitti: v46 görsel dili kartları yeniden çizdi. Fikir/özellik düzeyinde asıl kayıplar son 6 canlı sürümde (0.36.60–0.36.84) ve başlangıç akışında (0.36.66–0.36.69) oldu.

Kanıt nasıl görülür (sürümü çalıştırmadan): `git show <hash>:extension/app.js | grep -o '<metin>'`. Her kümede commit/sürüm hash'leri verildi. Kaybeden "kaynak" commit'ler `git log -S'<metin>' -- src static` ile bulundu (ana geçmiş `plan-v46-kod`, "Release X" commit'leri de orada var).

Sürüm hash tablosu (kullanılanlar): 0.36.84=5ac607a, 0.36.83=4fa33da, 0.36.82=9cc2f1d, 0.36.81=61f5d3a, 0.36.80=f0a236f, 0.36.79=87f4e13, 0.36.78=cda3cd6, 0.36.71=6b6015f, 0.36.69=d1c2470, 0.36.68=f621b3f, 0.36.67=2204d6c, 0.36.66=eab957b, 0.36.63=343a91b, 0.36.59=029f6ce, 0.36.17=4605cfc, 0.34.9=ed51fbd, 0.32.0=c831f58, 0.30.0=c0552d3, 0.4.0=25d077e.

## 2. Beş soruya kısa cevap (Emre'nin hatırladıkları)

| Konu | Sonuç | Ayrıntı |
|---|---|---|
| Gün gün FOTOĞRAFLI akış | **KAYIP (bilinçli, 0.36.84'te)** | K1. Her gün başlığında foto küçük resmi (`dc-thumb`), "Liste / Kartlar" anahtarı ve "Günler" şeridi 0.36.83'te (4fa33da) var, 0.36.84'te (5ac607a) yok. Bugünkü HEAD'de de yok. Daha eski büyük-foto gün kartları (`dc-photo`, `dc-art`) 0.34.1–0.35.0'da vardı. |
| Sihirli açılış, maskot, hareketler | **KISMEN KAYIP (bilinçli, 0.36.82)** | K5. Açılış süs katmanı (`op-orb`, `op-spark`, `op-star`, `op-glint`, `op-fx`) 0.36.81'de son kez; maskotun "göz kırpıp planın kenarında süzülmesi" çıktı. Maskot (Mascot.tsx) ve `wink` durumu KODDA, ama bunu tetikleyen açılış kodu yok. v46 yeni hareket paketleri (P8a–e) eklendi. |
| Açılış KONTROL LİSTESİ ("Gezin şekilleniyor N/6", simgeli, Oluştur) | **VAR, yalnız yan parçaları gitti** | K6/K7. `Checklist.tsx` pakette (bundle) ve "Gezin şekilleniyor" bugünkü dist'te 2 kez geçiyor. Kaybolan: "TRIP CHECKLIST" başlığı, "Gezimi oluştur / Generate my trip", "Şimdilik bununla oluştur", "Draft · Continue", taslak kartları (`st-draft-*`), `st-blob`, ve "Gezi önizlemesi" satırları (`st-pv-*`). |
| Fotoğraf MOZAİĞİ / kolaj | **Hiç yayınlanmadı** | K20. "mozaik/mosaic/kolaj/collage" hiçbir sürümde, hiçbir kaynak/commit mesajında yok. Yalnız `docs/mockups/giris-akisi-v3/index.html` içinde "option B: mosaic + tiles" mockup seçeneği var; kod ona gitmedi (14b86ae "preview's photos on top of the checklist"). Başlangıçtaki "yelpaze foto" (Generating.tsx) ve "Gezi önizlemesi" foto şeridi var/yaşıyor. |
| Poster / foto gezi kartı | **VAR** | `poster` dist'te 2 kez (0.36.55'ten beri). Commit'ler: d7f2e31 (üç yön önerisi: poster, biniş kartı koçanı, kartpostal), 5f607ed "Drawing v2: the poster card chosen" (2026-10-09), 29b5e74 "poster trip card". Kayıp yok. |
| Oluştur haritası | **VAR** | `GenMap.tsx`, `FlightMap.tsx`, `Generating.tsx` pakette; P9b mesajı "FlightMap/WorldFlight ve st-map-* SİLİNMEDİ". |
| Kişiye özel (kişi başı rezervasyon) | **VAR** | `kişiye özel` 0.36.24'ten bugüne; "Kimin için?", "Buluşma", yüz rozetleri yaşıyor (P1c köşe yüzü ek). |
| Fikir havuzu | **KAYIP (bilinçli, 0.36.60)** | K3. Durum sekmeleri Havuzda · Günü var · Kaçtı · Yapıldı, tür çipleri, "Bugüne al", "Bir şey yaz" hızlı satırı. `IdeaList.tsx` dosyası duruyor ama bu arayüz yok; `QuickAdd.tsx` pakette bile değil (ölü kod). |

## 3. Kümeler (önem sırası: kullanıcıya en görünür ve en son kaybolan önce)

Her kümede: ÖNEM = kullanıcıya görünen özellik mi / yeniden adlandırma mı.

### K1. Gün gün foto kartları + Liste/Kartlar anahtarı + gün şeridi
- Son görüldü: **0.36.83** (4fa33da). Kayboldu: **0.36.84** (5ac607a). Bugün: yok.
- Kayıp metinler: `Günler` / `Days` (gün şeridi aria-label), `Görünüm`/`View` + `Liste`/`List` + `Kartlar`/`Cards` düğmeleri (Gün gün'de), `Bu güne ekle`, `Henüz rezerve edilmedi ·` / `Not booked yet ·`, `Fikirler ·` / `Ideas ·` (gün grubu başlıkları), `Serbest gün · yapılacaklardan seç`. (Not: "Kartlar" ve "Liste" sözcükleri başka ekranlarda, ör. Pano "Kartlar | Tablo", yaşıyor; kayıp olan Gün gün'deki kullanımları.)
- Kayıp kod kanıtı (4fa33da app.js): `className:"dc-thumb"` gün başlığında `<img>`; `role:"tab"` ... `c("Liste","List")` / `c("Kartlar","Cards")`; `className:"dc-strip"` `aria-label:c("Günler","Days")`. 5ac607a'da bu üçü yok.
- Kaybeden commit: **5d5c7a4** (2026-10-12) "Gün gün: one compact row a day (date box, lines with stage and time, Gece line, free-day line); **old photo cards, Liste|Kartlar switch and day strip removed**; e2e adapted". DayCards.tsx yorumu: "The old photo cards, their Liste | Kartlar switch and the strip of days are gone: the row is the view."
- Bilinçli mi: EVET (Plan v30; mesajda açıkça "removed"). Ama hatırlanması gereken: gün başına foto bugün hiçbir yerde yok.
- Daha eski nesil: büyük foto gün kartları `dc-photo`, `dc-art`, `dc-head`, `dc-date`, `dc-no`, `dc-ddate` (0.34.1–0.35.0). Kaybeden: 0.35.1 "Günlük akış as the trip goes (rail, city groups, day panels)", commit 22fbecc / 6203308 serisi (2026-10-05). Önce `dc-card-face`, `dc-flow`, `dc-grid`, `dc-back` (0.34.4 son, 0.34.5'te "day cards after the reference, opening in place" 797cd0a ile yenilendi).
- ÖNEM: YÜKSEK (kullanıcıya görünen özellik, Emre'nin saydığı). Yeniden kelimelenmiş karşılık yok.

### K2. Kartlardaki durum sözcükleri (v46 durum sözlüğü)
- Son: 0.36.84. Kayboldu: v46 (bugünkü HEAD). Commit **8019f19** P0 (+ WIP 5e11f56), 2026-10-13.
- Kayıp: `Ayarlandı ✓` / `Arranged ✓`, `Planlandı`, `Planlandı · rezerve edilmedi` / `Planned · not booked`, `Planlandı · bilet alınmadı`, `Aranacak` / `To find`, `Rezerve edildi ya da rezervasyon gerekmiyor` / `Booked, or no booking needed`, `Rezerve ✓` / `Booked ✓` / `✓ Booked` / `Ticket booked`, `✓ booked`.
- Mesaj: "beş görünüm (Arıyoruz, Önerimiz, Seçildi, Rezerve, Ayarlandı) ... 'Planlandı', 'Aranacak', 'Rezerve edildi', 'Hazır' kullanıcıya görünmez." Alt satırdaki "Rezerve/Alındı" tekrarı ve rezerve halkası ve damga (`pk-stamp`) kalktı.
- Bilinçli mi: EVET. ÖNEM: yeniden adlandırma (Seçildi 14×, Arıyoruz, Önerimiz, Ayarlandı bugün dist'te). Kayıp olan: rezervede "damga" görseli ve halka.

### K3. Fikir havuzu (durum sekmeleri) + hızlı "Bir şey yaz"
- Son: **0.36.59** (029f6ce). Kayboldu: 0.36.60. Commit **4a219d9** (2026-10-09 10:35) "Plan v11, phase 4: Yapılacak şeyler as tiles; Gün gün gives a planned idea its day". İlk görüldü: 0.35.12 (83245b5 / abb33b3 "Fikir havuzu v1").
- Kayıp: `Havuzda` · `Günü var` · `Kaçtı` / `Missed` · `Bugüne al` · `Tür seç` / `Pick a kind` · `Adı düzenle` · `from Maps` · `güne konmuştu, yapılmadı` / `was on a day, not done` · `tanesi günde` · `Bir şey yaz` / `Write something… e.g. Sunset from the Dom Luís bridge` (QuickAdd) · `Hazırlık'a eklendi` / `added to Prep` · `Hazırlığa taşı` · `Giriş bileti gerekiyor` / `Needs an entry ticket` · `fikirlere eklendi` / `added to ideas`.
- Sonra: `Fikirler ve öneriler` / `Ideas and suggestions` (son 0.36.79, commit cd0dc5d Plan v30), `Öneriler ve fikirler` (son 0.36.82/83), `No ideas waiting here.` (0.36.70).
- Bugün: Yapılacak şeyler karo ızgarası + `InspoGrid`; `IdeaList.tsx` yalnız InspoGrid için bundle'da; `QuickAdd.tsx` bundle'da DEĞİL (src/app/ideas/QuickAdd.tsx, ölü; b7beee3 "eskiler kaybolmasın" diye dosyayı tuttu). "Havuz" kavramı ve durum sekmeleri yok.
- Bilinçli mi: EVET ama mesajda sekmelerin gitmesi söylenmiyor ("as tiles"). ÖNEM: YÜKSEK, "fikir havuzu" olarak hatırlanan özellik. Yeniden kelimelenme yok ("Havuzda/Günü var" hiçbir yerde).

### K4. Pano ve seçim penceresi: AI önerisi etiketi, karşılaştırma ipuçları, "Neden? Artılar ve eksiler"
- Son: 0.36.79–0.36.84. Commit'ler: cd0dc5d (Plan v30 Faz 2–8, 2026-10-11), v46 P1c/P4/P6 (dc63a10, a799601, 543b2b4).
- Kayıp: `AI pick` / `AI önerisi` (Pano, NeedCard, IdeaTiles, ActivityBoard etiketi, son 0.36.84; v46 köşe yüzü P1c/P6 ile gitti), `Beyond your links, by your preferences.`, `Your saves ·`, `alternatives the AI found` / `An alternative the AI found` (0.36.79), `Neden? Artılar ve eksiler` / `Why? Pros and cons` (0.36.79; "Neden?" kısaltılmış biçimde yaşıyor, 7×), `Comparing makes sense within one need: pick Flights or Stays on the left/above` (0.36.80/83), `Daha fazla öneri bul`.
- ÖNEM: ORTA. "AI önerisi" rozeti (alternatifi AI bulduğunu söyleyen) bugün ayrı etiket olarak yok; kim kaydetti yüzü (köşe yüzü) var.

### K5. Sihirli açılış: orb, kıvılcım, yıldız, ışıltı + maskotun göz kırpması
- Son: **0.36.81** (61f5d3a). Kayboldu: **0.36.82** (9cc2f1d).
- Kayıp sınıflar: `op-orb`, `op-orb-in`, `op-spark`, `op-star`, `op-glint`, `op-fx`, `away`, `ch-sheet`.
- Eklendi: d7921bc / 1d703a0 (2026-10-10) "Sihirli açılış: the Plan builds itself in reading order the first time a trip opens in a session, and the assistant mascot lives in the chat and winks at the border". Kaybeden: **886cf0e** (2026-10-11 00:11) "WIP (bekliyor): açılış B · ritim ve sayaçlar + pencere/çekmece kapanışı": "pieces come in from the first frame in reading order, the counters count up ...; **no wink, no glide**". Dal: `hareket-0.36.82` (8a48fc4 Bump to 0.36.82). Mockup: `docs/mockups/sihirli-acilis/`, `acilis-v2`.
- Bugün: `opening.ts` var (ritim + sayaç sürümü); Mascot.tsx var, 6 durum (idle/wink/work/done/oops/sleepy), `wink` tanımlı ama açılış onu çağırmıyor. P9b: "Mascot wink ... SİLİNMEDİ".
- ÖNEM: ORTA-YÜKSEK. Emre "sihirli açılış" diyorsa kıvılcım/orb/süzülme ve göz kırpma bugün görünmüyor.

### K6. Başlangıç sohbeti: kontrol listesi etiketleri ve taslak parçaları
- Son: **0.36.66** (eab957b). Kayboldu: 0.36.67. İlk: 0.36.12 (ca96021 "start a trip by chat").
- Kayıp metin: `TRIP CHECKLIST`, `Gezimi oluştur` / `Generate my trip`, `Şimdilik bununla oluştur` / `Generate with this for now` / `Generate for now` / `Şimdilik oluştur`, `Draft · Continue`, `bilgi · yarıda kaldı`, `All it needs is`, `Nereye ve ne zaman gerekli.`, `Lüks bütçe`, `Yol gezisi`, `Birkaç saniye · %`, `Düşünüyorum`, `Kişi ve tarz:`, `Uçuşlar için yer açıldı:`.
- Kayıp sınıflar: `st-draft-go`, `st-draft-open`, `st-draft-top`, `st-blob`, `st-blob-a`, `st-blob-b`, `st-hero-top`.
- Kaybeden commit'ler: **4c4ca01** (2026-10-09 11:09) "Oluştur is one word at every step ... always-pressable Oluştur, photos without a box"; **29b5e74** (2026-10-09) "the start side back to its order (no plan draft, preview strip), Oluştur always pressable, route backdrop, poster trip card".
- Bugün: `Checklist.tsx` AKTİF ("Gezin şekilleniyor N/6", dar ekranda "4/6 · Gezin şekilleniyor ▾"), `Oluştur` 16×. Kayıp olan düğme/başlık kelimeleri ve taslak ile "yarıda kalan taslak" kartları. (Home taslakları "Devam et / Geri al": `Devam et` yaşıyor.)
- Bilinçli mi: EVET (mesajlarda açık). ÖNEM: ORTA, çoğu yeniden adlandırma (Gezimi oluştur → Oluştur).

### K7. Başlangıç: canlı "Gezi önizlemesi" satırları + Plan taslağı
- Son: **0.36.68** (f621b3f). Kayboldu: 0.36.69. Commit **14b86ae** (2026-10-09 16:40) "Start flow: one card, the preview's photos on top of the checklist and its flights and styles in their rows (drawing v3)".
- Kayıp: `Gezi önizlemesi` / `Trip preview` / `TRIP PREVIEW`, `Rota önerisi` / `Suggested route`, `Durak`, `Plugs` (fiş tipi satırı), `Say the start and the nights get their dates.`, `Uçuşlar`, `Ülke`. Sınıflar `st-pv`, `st-pv-row(s)`, `st-pv-chip(s)`, `st-pv-icon/label/value/text/note`.
- "Plan taslağı" (Oluştur'un yapacağı kartların kullanıcıya önceden gösterilmesi): 3ae8672 (2026-10-09) ile eklendi, 29b5e74'te aynı gün kaldırıldı; **hiçbir release build'de yok** ("Plan taslağı" 0 sürümde). Yayınlanmadı.
- ÖNEM: ORTA. Önizleme şeridi/fotoğraflar `Preview.tsx` ile yaşıyor, satırlı bilgi tablosu yok.

### K8. Etkinlik kartları (v46 P6) ve satın alındı kısayolları
- Son: 0.36.84. Commit **543b2b4** (2026-10-13 16:11) P6 "Etkinlik ve turlar şehre göre, tek kart bileşeni".
- Kayıp metin: `Bilet aldım` / `Bilet alındı` / `✓ Bilet aldım` / `Bilet al ↗`, `Planda · çıkarınca Pano'ya gider` / `On the plan · taking it off sends it to the Board`, `AI pick/AI önerisi`.
- Kayıp sınıflar (48): `ac-*` (33: ac-row, ac-wrap, ac-photo, ac-pic, ac-reason, ac-tools, ac-offer, ac-self…), `ax-*` (15: ax-grid, ax-idea, ax-tag, ax-tick, ax-tools…), `it-tools`, `it-pic`, `it-tile`.
- Mesajda: "Canlıdan korunanlar: Planda/Öneriler ayrımı ve katlama, canlı kaynak teklifleri, Daha fazla fikir, festival sonrası dinlenme, kapalı tur notu, Kendin ara, **Bilet aldım**." Yani işlev korunmuş, metin `✓ aldım` gibi yeniden kelimelenmiş olabilir (doğrulanmadı).
- ÖNEM: yeniden tasarım. Doğrulanması gereken: "Planda · çıkarınca Pano'ya gider" ipucu bugün yok.

### K9. Uçuş bileti ve rota yayı (P2), ulaşım kartı (P5a)
- Commit **ff4ef9c** P2 (17:51) ve **76cd9d5** P5a (17:04), 2026-10-13.
- Kayıp: `pk-stub*` (koçan), `pk-arc*` (kesik rota yayı, RouteArc), `pk-ride*` (eski ulaşım kartı: `pk-ride-art`, `pk-ride-how`, `pk-ride-ab`…), `pk-stamp` (rezerve damgası), `ek-undec-art`, `ek-undec-t`, `Pano uçuş resmi`, arka yüz saat rozeti. Mesaj: "ölü kod silindi: pk-stub*, RouteArc ve pk-arc*, ticketPriceLine, Pano uçuş resmi" ve "Uçuşun görseli iki şehir arasında ucus.png (kesik yay kalktı)".
- ÖNEM: yeniden tasarım (yatay bilet + koçan geldi). Kesik yay çizgisi gitti.

### K10. Yolculuk (Story) görünümü: mini kartlar sy-*
- Commit **5069224** P5b (2026-10-13 18:33). "Eski sy-* parçaları ve CSS'i silindi."
- Kayıp: `sy-*` 17 sınıf (sy-row, sy-node, sy-city, sy-date, sy-leg, sy-ev, sy-here, sy-end…), `✓ Eve dönüş · İstanbul`, `✓ alındı`. Yerine: yola çıkış hapı, ince şehir başlığı, otel mini kartı, etkinlik kartı, Eve dönüş.
- ÖNEM: yeniden tasarım.

### K11. Pano seçenek mekanizması (P4): ChoiceSheet, ‹ › düğmeleri, "Daha fazla bul"
- Commit **a799601** P4 (18:11). "eski ChoiceSheet ve ‹ › düğmeleri, Pano karosu, Daha fazla bul silindi; ok tuşları korunur".
- Kayıp: `Daha fazla bul` / `Find more`, `Pano'da büyük aç` / `Open large on the Board`, `Seçenekler arasında gez` / `Go through the options`, `ch-more`, `ch-grid`, `ch-nav`, `ch-panotile`, `ch-fl`, `ch-self`, `ch-foot`.
- ÖNEM: yeniden tasarım (kartın arka yüzü yerinde biner). "Daha fazla bul" işlevi için bugün "AI'a arat"/"Kendin ara" var.

### K12. Hover bilgi kutusu (Peek) → ⓘ balonu
- Commit **138f7b2** P1a. Peek.tsx silindi. Kayıp: `Uçuş kartı`, `Transfer kartı` (peek başlıkları), `tipx-peek`. ⓘ balonu geldi.
- ÖNEM: yeniden tasarım.

### K13. Uçuş canlı durum etiketleri
- Son: **0.36.17** (4605cfc); ilk 0.36.14 (4a0271b AeroDataBox). Kaybeden: 0.36.18 / commit 3baf2ba (2026-10-06 14:42) "Booked flight's card with real data (ucus-karti-v6)".
- Kayıp: `Rötarlı`, `Kapı kapandı`/`Gate closed`, `Biniş başladı`/`Boarding`, `İnişe geçiyor`, `Yolda`/`En route`, `Kalktı`, `Check-in açık`/`Check-in open`, `İptal olabilir`/`May be cancelled`, `Başka havalimanına yönlendirildi`, `min late`, `Delayed` (son 0.36.83; 0.36.84'te `Rötar` kaldı).
- Ayrıca `Gidiyoruz: uçuşlar takipte (iniş, rötar, kapı, bant)` / `uçuşu takip et` / `Stop following` anahtarı (0.36.15; 0.36.16: "flights followed when ticket bought, no Gidiyoruz step").
- Bugün: AeroDataBox 3×, `Rötar`, `Bagaj bandı` var. ÖNEM: yeniden tasarım (kartta kutular); durum kelime listesi (Biniş başladı, Kapı kapandı...) yok.

### K14. Kamp mı otel mi sorusu ve festival kampı
- Son: **0.36.83**. Commit **b89d3f5** (2026-10-12 13:34) Plan v30 (etkinlikler): festival kampı çadır/karavan kartı.
- Kayıp: `Kamp mı yapacaksın, otelde mi kalacaksın?` / `Camping, or a hotel?`, `Kamp yeri ayır` / `Book a camping spot`, `Camping`, `Konaklama programın içinde mi?` / `Is the stay part of the programme?` (0.36.43), `Tek resort mu, iki farklı resort mu?` (0.36.43).
- ÖNEM: ORTA (başlangıç sohbetindeki tür soruları). `Kamp yeri`/`çadır` başka cümlelerde yaşıyor.

### K15. İptal süresi cümleleri, boş kart eylemleri, küçük v30 değişiklikleri
- Son 0.36.83: `Ücretsiz iptal bugün bitiyor` / `Free cancellation ends today` (commit 1d08709, v30 "iptal süresi renkler"), `Uçuş ekle` / `Add a flight` (d382390, boş konaklama kartı), `Delayed: the plan moved with it`, `stay still open`, `Nothing planned yet.` (0.36.82), `Bu güne ekle`.
- ÖNEM: DÜŞÜK, yeniden kelimelenme.

### K16. Bütçe parça payı ve çipler (0.36.66–0.36.72)
- `Gezi bütçesinden bu bölüme düşen pay (beklenen maliyete göre)` / `This part's share of the trip's budget`, `ayrıldı` / `set aside`, `What's chosen and booked, added up`, `Against your own time`, `% booked`, `Henüz seçilmedi`, `Plan'da göster` (son 0.36.71–0.36.78). Commit zinciri v30 hero (cd0dc5d). ÖNEM: DÜŞÜK-ORTA. "€X ayrıldı" bölüm başlığı ipucu bugün farklı kelimelerle.

### K17. Plan bölümü adları ve taşıma eylemleri
- `Diğer (Sigorta, eSIM)` (son 0.36.55) → `Sigorta ve internet` (son 0.36.56, v11 yeniden adlandırma 4a5557f), `Etkinlikler / Activities (needs a booking)`, `Yapılacak şeyler / Things to do`, `Restoranlar` (0.34.2–0.36.38), `Hazırlığa taşı`, `Etkinliklere taşı`, `to Restaurants`. ÖNEM: yeniden adlandırma / bölüm sırası (Plan v11, 4a5557f 2026-10-09).

### K18. Ayarlar, paylaşım, model seçici
- `Ayarlar → Paylaşım'da adını yaz.` ve benzeri 5 cümle (son 0.36.52; 0.36.3 "no server setup needed"), `AI kapısı (davet ettiklerin için)` (0.36.1), `Claude Haiku 4.5 · en ucuz`, `Claude Sonnet 5 · daha ucuz`, `Claude Opus 5 · en iyi sonuç` (son 0.36.52/0.36.66), `Modelleri getir` / `Modeller getiriliyor…` (son 0.36.77: model listesini çekme düğmesi), `AIza… (yapıştır)`. ÖNEM: ORTA ("Modelleri getir" işlevi için doğrulama öneririm).

### K19. Hero v9 öncesi: bilinen toplam, hava, sonraki adım
- Son: **0.34.9** (ed51fbd). Kaybeden: 0.35.0 "hero v9, the reference's layout" (00f2ac2, 2026-10-05).
- `Alınan, planlanan ve boşta kalan` / `Booked, planned and free`, `Weather` satırı, `Bilinen toplam`/`Known total`, `Her şey karara bağlandı` / `Everything's decided`, `Sonraki adım`, `See the route on Google Maps`, `Travellers`; sınıflar `hx-meter`, `hx-budget`, `hx-chips`, `hx-intent*`, `hx-tab`, `hx-stats`. Bugün: `Weather` 20×, `Bilinen toplam` 1× yaşıyor (başka bağlamda). ÖNEM: DÜŞÜK (eski nesil, bilinçli).

### K20. Fotoğraf mozaiği, kolaj
- **Kayıp değil, hiç yapılmadı.** Aranan: mozaik, mosaic, kolaj, collage (tüm sürümler, tüm src/static geçmişi `git log --all -S`, commit mesajları). Tek iz `docs/mockups/giris-akisi-v3/index.html` satır 185 `/* option B: mosaic + tiles */` (`.mos` 1.7fr/1fr 2×1 ızgara: büyük kapak foto + iki küçük). Seçilen yön 14b86ae ("the preview's photos on top of the checklist"). Dolayısıyla Emre'nin hatırladığı mozaik bu mockup seçeneği olabilir. Kullanılmayan gerçek koda dönüştürülmedi.

### K21. Fikirler sekmesi, hazırlık, belge (0.31–0.35 dönemi)
- `Fikirler`, `Bir fikir yaz`, `Ideas and to-dos`, `Move to bookings`, `rezerve edileceklere taşındı`, `fikirlere eklendi`, `No city yet`, `Nothing yet. Write above, or save a restaurant's page.` (son 0.33.1). Kaybeden: 0.34.0 plan kategorilere bölündü (838b106). `fk-*` sınıfları (fk-row, fk-promote, fk-check, fk-where…) 0.35.2'de gitti. ÖNEM: eski nesil, K3 ile birlikte "fikir havuzu"nun atası.

### K22. Günlük akış rayı/saat metinleri ve 0.34–0.35 yapıları
- `dc-head/dc-date/dc-photo` (K1), `Onaylananlar`, `Cars rented`, `Flights booked or chosen`, `Stays chosen or booked` (son 0.34.0, "plan by category"), `Spending by category` / `Kategoriye göre harcama`, `Eler`/`Matters less`/`İkinci planda` (Tercihler sınıfları, son 0.35.3), `Nothing with a time yet.`, `without a time` (0.35.5), `Tüm günler` / `All days`, `· boş gün` / `· free days` (0.35.4). ÖNEM: eski nesil.

### K23. Erken dönem (0.4–0.30): karar kartı, yolculuk kartı, kuyruk, ayarlı satır
- Sınıf aileleri: `opt-*` (0.10, seçenek kartı), `settled-*`/`sc-*` (0.11, 0.30), `dc-kicker/dc-chosen/decision-card` (0.14.2 Karar kartı), `queue-*` ve `Karar sırası` (0.15), `jc-*`/`journey-card` (0.16–0.17 yolculuk kartı), `dr-*`/`day-rows`/`tl-journey` (0.18), `intent-*`, `hero-*`, `budget-*`, `todo-*` (0.29, ilk hero/bütçe), `route-*`/`move-card`/`fare-badge` (0.30), `tl-*` zaman çizelgesi (0.33.1), `cat-*` (0.34.x kategori). Hepsi arayüz yenilemeleri ile bilinçli değişti; metinleri: `Fiyat doğrulanmadı`, `Vergiler fiyata dahil değil`, `Bilet alındı ✓`, `Planında ✓`, `En ucuzdan`, `⇄ Değiştir`, `Yorumlar iyi/zayıf`, `En kaliteli`, `En pratik konum`, `Genel olarak en iyi`, `Ciddi sorun:`, `Rahat saatler:`, `Zor saat:`, `AI incelemesi:`. ÖNEM: tarihsel.

## 4. Riskli ek bulgu: kodda kullanılıp CSS kuralı olmayan sınıflar (görsel gerileme adayı)
HEAD kaynağında kullanılan ama bugünkü CSS'te kuralı olmayan, canlı 0.36.84'te kuralı olan sınıflar: `pk-clip` (Belge ekle düğmesi, DocAccess.tsx:104), `ek-ill` (boş kart resmi, EmptyCard.tsx:121 / NeedCard.tsx:184), `nd-chip` (NeedCard.tsx:109), `ch-tile` (BackFace.tsx:215), `pk-sil` (Silhouettes.tsx:233), `ek-missing`, `wh-from`/`wh-last` (Travellers.tsx:289), `mv-unfold` (Section.tsx:100), `hs-toast` (App.tsx:360), `st-open`, `st-style`, `st-row-check`, `has-logo`, `no-map`, `key-bad`, `pk-says`, `pk-plus`, `drop-before`/`drop-after`. Bir kısmı yalnız JS kancası olabilir; stil kaybı olup olmadığı görsel doğrulama ister.

## 5. Özet tablo (önem sırası)

| # | Küme | Son sürüm | Kaybeden | Bilinçli? | Önem |
|---|---|---|---|---|---|
| 1 | K1 Gün gün foto kartları + Liste/Kartlar | 0.36.83 | 5d5c7a4 → 0.36.84 | evet | yüksek |
| 2 | K3 Fikir havuzu sekmeleri + hızlı ekle | 0.36.59 | 4a219d9 → 0.36.60 | evet (sekmeler anılmadı) | yüksek |
| 3 | K5 Sihirli açılış orb/kıvılcım + göz kırpma | 0.36.81 | 886cf0e → 0.36.82 | evet | orta-yüksek |
| 4 | K6 Başlangıç kontrol listesi etiketleri | 0.36.66 | 4c4ca01, 29b5e74 | evet | orta |
| 5 | K7 Gezi önizlemesi satırları, Plan taslağı | 0.36.68 | 14b86ae, 29b5e74 | evet | orta |
| 6 | K4 AI önerisi rozeti, Neden? Artılar/Eksiler | 0.36.79–84 | cd0dc5d, P1c/P4/P6 | kısmen | orta |
| 7 | K2 Durum sözlüğü (Planlandı/Aranacak/Rezerve ✓) | 0.36.84 | 8019f19 | evet | yeniden adlandırma |
| 8 | K8–K12 v46 kart yeniden çizimi (etkinlik, uçuş, ulaşım, Yolculuk, Pano, ⓘ) | 0.36.84 | 543b2b4, ff4ef9c, 76cd9d5, 5069224, a799601, 138f7b2 | evet | yeniden tasarım |
| 9 | K13 Uçuş canlı durum etiketleri | 0.36.17 | 3baf2ba | evet | orta |
| 10 | K14 Kamp mı otel mi sorusu | 0.36.83 | b89d3f5 | evet | orta |

### Kaybolan CSS sınıfları (son görüldüğü sürüme göre; bugünkü static/app.css'te kuralı yok)

- **son 0.36.84** (5ac607a), 278 sınıf: `ac-acts ac-bar ac-block ac-bm ac-chev ac-detail ac-doc ac-docmiss ac-empty ac-empty-note ac-go ac-h ac-hit ac-ideas ac-ideas-h ac-key ac-main ac-name ac-offer ac-on-plan ac-one ac-photo ac-pic ac-planned ac-pp ac-price ac-price-big ac-proof ac-r ac-reason ac-reason-note ac-reason-tag ac-rest ac-row ac-self ac-self-note ac-self-row ac-side ac-sp ac-sub ac-toggle ac-tools ac-type-note ac-wrap ac-x accent accepted active alert alert-amber alert-orange alert-red all-no amber ar-done ar-error ar-ev ar-has-thumb arranged art ax-add ax-c ax-foot ax-foot-idea ax-grid ax-idea ax-meta ax-on ax-price ax-sq ax-tag ax-tick ax-tools ax-where ax-why back bad below best booked bus c-activity c-other calm car ch-ai ch-end ch-fl ch-foot ch-grid ch-list ch-more ch-nav ch-panotile ch-self ch-tile cheaper check chosen closed compact cons corner cover cur dark decisive dg-home draft drag dragging drawing drop-after drop-before ek-ill ek-missing ek-undec-art ek-undec-t embedded est ferry fest first fit-unfit fixed flight focus freed full gap generating half has-logo headline highlight hs-toast html icon idea in-booked in-chosen info key-bad letter level-0 level-3 level-4 liked link loaded long minus missed mv-unfold nd-chip near need-no need-unknown need-yes needs nested next no-map no-photo none now off offline opt orange org out outline over own page partial photo pick-best pk-all-no pk-arc pk-arc-a pk-arc-b pk-arc-pl pk-arc-stop pk-clip pk-green pk-plus pk-r-open pk-ride pk-ride-ab pk-ride-arr pk-ride-art pk-ride-end pk-ride-how pk-ride-t pk-says pk-sil pk-stamp pk-stub pk-stub-k pk-stub-plan pk-stub-st pk-stubbed plain plan plus pn-arc popup printing pros rank-2 rank-3 red rez right sel serious set show soft soon st-booked st-chosen st-decide st-done st-empty st-open st-options st-pending st-planned st-row-check st-style stacked stale static status-insufficient status-single strong sy-c sy-cb sy-ch sy-city sy-d sy-date sy-end sy-endrow sy-ev sy-here sy-lbl sy-leg sy-node sy-none sy-r sy-row sy-same t-date t-number t-time tentative tie tipx-peek todo train tsx undated undone unfit unknown unverified user wait warn wh-from wh-last win yes zero`
- **son 0.36.81** (61f5d3a), 8 sınıf: `away ch-sheet op-fx op-glint op-orb op-orb-in op-spark op-star`
- **son 0.36.68** (f621b3f), 10 sınıf: `st-pv st-pv-chip st-pv-chips st-pv-icon st-pv-label st-pv-note st-pv-row st-pv-rows st-pv-text st-pv-value`
- **son 0.36.66** (eab957b), 7 sınıf: `st-blob st-blob-a st-blob-b st-draft-go st-draft-open st-draft-top st-hero-top`
- **son 0.36.56** (baf8f47), 1 sınıf: `prep-visa`
- **son 0.36.19** (9acc780), 1 sınıf: `with-logo`
- **son 0.36.15** (e149946), 1 sınıf: `hx-going`
- **son 0.36.7** (fd3e3c9), 4 sınıf: `dl-more dl-sub list loose`
- **son 0.35.11** (5a45ff4), 2 sınıf: `il-btn il-donegroup`
- **son 0.35.3** (77c725a), 1 sınıf: `hx-prefs-rows`
- **son 0.35.2** (ddad73e), 18 sınıf: `cat-eat cat-eats fk-act fk-book fk-check fk-eat fk-ic fk-img fk-map fk-ph fk-ph-ic fk-promote fk-row fk-t fk-thumb fk-thumb-img fk-todo fk-where`
- **son 0.35.0** (c42176b), 6 sınıf: `dc-art dc-date dc-ddate dc-head dc-no dc-photo`
- **son 0.34.9** (ed51fbd), 18 sınıf: `hx-budget hx-chips hx-fact hx-intent hx-intent-pop hx-intent-toggle hx-meter hx-next hx-over hx-rows hx-stats hx-tab hx-todo legend meta spark title top`
- **son 0.34.7** (ccec63f), 1 sınıf: `dc-chev`
- **son 0.34.4** (291d95c), 13 sınıf: `dc-back dc-card dc-card-face dc-flow dc-foot dc-grid dc-ideas dc-info dc-lines dc-row ends kind sub`
- **son 0.34.3** (916c6dd), 2 sınıf: `cat-state cat-tile`
- **son 0.34.1** (a96d4db), 5 sınıf: `cat-meta cat-price cat-ring cat-row cat-rows`
- **son 0.34.0** (173b9e7), 2 sınıf: `click hx-row`
- **son 0.33.1** (313d75c), 31 sınıf: `between city-block city-head city-no day-card fk-city fk-eats fk-empty fk-filters fk-label fk-sec fk-sub pk-tobook pk-tobook-row sec timeline tl-badge tl-content tl-day tl-day-no tl-entry tl-head-insert tl-icon tl-insert tl-label tl-leg tl-pill tl-side tl-travel tl-wide trip-line`
- **son 0.30.0** (c0552d3), 16 sınıf: `fare-badge move-card route route-bar route-end route-line route-mid route-mode route-top settled-row sr-actions sr-chip sr-icon sr-main sr-price sr-text`
- **son 0.29.0** (38979c4), 38 sınıf: `b-booked b-chosen b-open budget budget-bar budget-label budget-legend budget-missing budget-sum budget-top estimated hero-img hero-link hero-main hero-row hero-stats intent-answers intent-card intent-head intent-list intent-preview intent-question intent-remove intent-title k-book k-deadline panel-top share-status status-line todo-chip todo-done todo-soon todo-strip todo-wrap trip-hero trip-now trip-sub trip-title`
- **son 0.18.2** (6b73d77), 12 sınıf: `day-rows day-summary day-title day-toggle dr-body dr-info dr-more dr-pin dr-time journey-head st-info tl-journey`
- **son 0.18.1** (08ede58), 1 sınıf: `dr-side`
- **son 0.17.0** (9da8e04), 3 sınıf: `dr-chev dr-line jc-chip`
- **son 0.16.0** (2278eef), 14 sınıf: `jc-day jc-day-label jc-head jc-more jc-node jc-ready jc-row jc-status jc-step jc-steps jc-time jc-what journey-card k-travel`
- **son 0.15.0** (fc5e3c5), 9 sınıf: `due qchip qrem queue queue-bar queue-chips queue-progress queue-reminders queue-top`
- **son 0.14.2** (101e2f7), 9 sınıf: `dc-actions dc-budget dc-check dc-choose dc-chosen dc-kicker dc-out dc-unless decision-card`
- **son 0.14.1** (8666f0d), 6 sınıf: `card-tags hero more-tags tag top-tag top-tags`
- **son 0.14.0** (3b72304), 3 sınıf: `sc-col-head sc-line tick`
- **son 0.11.0** (6d748ea), 12 sınıf: `sc-choose sc-chosen sc-tags settled-actions settled-main settled-name settled-state settled-sub settled-text settled-thumb sign tl-head`
- **son 0.10.0** (9c89051), 6 sınıf: `glance opt-actions opt-card opt-glance opt-head opt-tags`

## Ek B. Kayıp metinlerin tam listesi (son görüldüğü sürüme göre; [ilk görüldüğü sürüm]; `~` = bugün daha uzun bir metnin içinde yaşıyor)
Gürültü süzgeci sonrası, birebir bugünkü build'de bulunmayanlar.


#### son 0.36.84 (5ac607a) n=109
    [0.4.0]~ " ihtivâ etmeli.
    [0.4.0]~ " ile başlamalı.
    [0.4.0]~ " ile bitmeli.
    [0.4.0]~ Fazla küçük:
    [0.4.0]~ Fâsit
    [0.4.0]~ Fâsit giren: umulan
    [0.4.0]~ Fâsit giren: umulan instanceof
    [0.4.0]~ Fâsit metin:
    [0.4.0]~ Fâsit metin: "
    [0.4.0]~ Fâsit sayı:
    [0.4.0]~ Fâsit tercih: mûteberler
    [0.4.0]~ Invalid
    [0.4.0]~ Of lítið: gert er ráð fyrir að
    [0.4.0]~ Rangt
    [0.4.0]~ Rangt gildi í
    [0.4.0]~ Rangur lykill í
    [0.4.0]~ Rezerve edildi
    [0.4.0]~ Röng tala: verður að vera margfeldi af
    [0.4.0]~ Tanınmayan anahtar
    [0.4.0]~ için tanınmayan anahtar var.
    [0.4.0]~ için tanınmayan kıymet var.
    [0.4.0]~ katı olmalıydı.
    [0.4.0]~ nakşına uymalı.
    [0.4.0]~ sahip olmalıydı.
    [0.4.0]~ Ógildur strengur: verður að byrja á "
    [0.4.0]~ Ógildur strengur: verður að enda á "
    [0.4.0]~ Ógildur strengur: verður að fylgja mynstri
    [0.4.0]~ Ógildur strengur: verður að innihalda "
    [0.5.0]~ Tarih ve yer kaydettikçe netleşir
    [0.6.0]  Rezerve ✓
    [0.9.0]~ 2 hafta önce
    [0.9.0]~ e, YYYY-MM halini date
    [0.13.0]  Ayarlandı ✓
    [0.14.0]~ Tarih seçilmeden kaydedildi
    [0.16.0]  Planlandı
    [0.29.0]~ 2 weeks ago
    [0.29.0]  Arranged ✓
    [0.29.0]  Booked ✓
    [0.29.0]~ Get a free key from Google ↗
    [0.29.0]~ On the page that opens, click
    [0.29.0]~ Share "
    [0.29.0]  Ticket booked
    [0.31.0]~ ranked #
    [0.34.0]  ✓ Booked
    [0.34.6]~ Kartına git
    [0.35.10]~ Saat ver
    [0.35.11]~ No document
    [0.35.13]~ ı replaces ile o id
    [0.36.7]~ ✓ Planında
    [0.36.12]~ Bali'ye 3 hafta, Sabine'yle… ya da bir link yapıştır
    [0.36.14]~ Belt
    [0.36.14]~ Terminal
    [0.36.30]  Booked, or no booking needed
    [0.36.30]  Planlandı · rezerve edilmedi
    [0.36.30]  Planlandı, rezerve edilmedi
    [0.36.30]  Planned · not booked
    [0.36.30]  Planned, not booked
    [0.36.30]  Rezerve edildi ya da rezervasyon gerekmiyor
    [0.36.31]~ item_id ile replaces aynı kayıt olamaz.
    [0.36.31]~ item_id: no record on the plan with this id:
    [0.36.31]~ item_id: planda bu id'le kayıt yok:
    [0.36.35]  Aranacak
    [0.36.35]  Planlandı · bilet alınmadı
    [0.36.35]  Planned · no ticket yet
    [0.36.35]  To find
    [0.36.35]~ oteli iptal ettim
    [0.36.35]~ uçuşu iptal ettik, iade 3 güne
    [0.36.36]~ Checking the dates of
    [0.36.36]~ Recognising
    [0.36.36]~ tarihlerini kontrol ediyorum…
    [0.36.43]~ Checked on the official site:
    [0.36.43]~ Resmî siteden teyit ettim:
    [0.36.43]~ Senin tarihlerin bu günlere denk gelmiyor.
    [0.36.50]~ t find. 2-5 short sentences, friendly and plain. Don
    [0.36.59]  AI pick
    [0.36.59]  AI önerisi
    [0.36.59]  Booked · with its file
    [0.36.59]~ Liked by
    [0.36.59]~ beğendi
    [0.36.59]  saved it`):c(
    [0.36.61]~ tanesi bir güne kondu
    [0.36.62]~ Ayrıntı
    [0.36.65]~ Uyum
    [0.36.72]~ değişiklik
    [0.36.74]~ Bagaj bandı
    [0.36.74]~ Rezervasyon kodu
    [0.36.79]~ Henüz bir şey yok
    [0.36.79]~ Here
    [0.36.79]~ Nothing yet
    [0.36.79]  ✓ booked
    [0.36.80]  Daha fazla bul
    [0.36.80]~ Find more
    [0.36.80]  Open large on the Board
    [0.36.80]  Pano'da büyük aç
    [0.36.81]  Bilet aldım
    [0.36.83]~ Estimated
    [0.36.83]~ Tahmini
    [0.36.83]  button, a, input, textarea, label, .ch-tile, .bk-tt, .ch-for, .ch-verify, .ch-wants
    [0.36.84]~ Bilet gerekmez
    [0.36.84]~ Estimate · from
    [0.36.84]~ Gece
    [0.36.84]  Go through the options
    [0.36.84]  On the plan · taking it off sends it to the Board
    [0.36.84]  Planda · çıkarınca Pano'ya gider
    [0.36.84]  Seçenekler arasında gez
    [0.36.84]~ Tahmini · kaynaklardaki
    [0.36.84]~ drop off
    [0.36.84]~ gerçek teklife göre
    [0.36.84]~ real offers in the sources


#### son 0.36.83 (4fa33da) n=24
    [0.29.0]  Free cancellation ends today
    [0.29.0]  Ücretsiz iptal için
    [0.32.0]~ Bu güne ekle
    [0.32.0]  cancel by today
    [0.32.0]  iptal bugün biter
    [0.32.0]~ to cancel
    [0.34.1]~ karar ver
    [0.34.8]  Günler
    [0.36.18]  Delayed: the plan moved with it
    [0.36.21]  Add a flight
    [0.36.21]  Uçuş ekle
    [0.36.23]  Fikirler ·
    [0.36.23]  Henüz rezerve edilmedi ·
    [0.36.23]  Ideas ·
    [0.36.23]  Not booked yet ·
    [0.36.43]  Camping, or a hotel?
    [0.36.43]  Kamp mı yapacaksın, otelde mi kalacaksın?
    [0.36.45]  Book a camping spot
    [0.36.45]  Camping
    [0.36.45]  Kamp yeri ayır
    [0.36.70]~ Öneriler ve fikirler
    [0.36.80]  Comparing makes sense within one need: pick Flights or Stays on the left.
    [0.36.83]  stay still open
    [0.36.83]  Ücretsiz iptal bugün bitiyor


#### son 0.36.82 (9cc2f1d) n=3
    [0.34.0]~ Yapılacak şeyler
    [0.34.1]  Nothing planned yet.
    [0.36.79]~ 'i rezerve`,`


#### son 0.36.81 (61f5d3a) n=1
    [0.29.0]~ diye sorabilirsin.',`Save your options and we'll decide here together. Tell me your budget, what matters to you, or ask


#### son 0.36.80 (f0a236f) n=1
    [0.36.71]  toplam`,`a person ·


#### son 0.36.79 (87f4e13) n=15
    [0.31.0]  ücretsiz iptal:
    [0.35.3]  Open its page
    [0.36.60]  Beyond your links, by your preferences.
    [0.36.60]  `,`Your saves ·
    [0.36.60]  alternatives the AI found
    [0.36.60]  nın bulduğu alternatif","An alternative the AI found"):c(`AI
    [0.36.62]  Neden? Artılar ve eksiler
    [0.36.62]  Why? Pros and cons
    [0.36.63]  Daha fazla öneri bul
    [0.36.63]~ Find more options
    [0.36.65]  Comparing makes sense within one need: pick Flights or Stays above.
    [0.36.70]  Fikirler ve öneriler
    [0.36.70]  Ideas and suggestions
    [0.36.70]  No ideas waiting here.
    [0.36.70]  give the ones with no day theirs in Day by day


#### son 0.36.78 (cda3cd6) n=3
    [0.36.72]  % booked
    [0.36.72]~ % of what
    [0.36.72]~ i rezerve`,`


#### son 0.36.77 (5f516ff) n=4
    [0.4.0]~ Modeller getiriliyor…
    [0.4.0]~ Modelleri getir
    [0.29.0]~ AIza… (yapıştır)
    [0.29.0]~ kayıt işleniyor…`,`Processing


#### son 0.36.72 (ebb990e) n=2
    [0.35.0]~ Plan'da göster
    [0.36.68]~ Henüz seçilmedi


#### son 0.36.71 (6b6015f) n=6
    [0.34.1]  Against your own time
    [0.36.61]  What's chosen and booked, added up
    [0.36.66]  Gezi bütçesinden bu bölüme düşen pay (beklenen maliyete göre)
    [0.36.66]  This part's share of the trip's budget (by what it's likely to cost)
    [0.36.66]~ ayrıldı
    [0.36.66]~ set aside


#### son 0.36.69 (d1c2470) n=4
    [0.29.0]  Ideas
    [0.35.12]  No ideas here.
    [0.36.62]~ bilet ya da rezervasyon gerektirenler
    [0.36.68]  Kaynaktan öneriler


#### son 0.36.68 (f621b3f) n=11
    [0.34.1]~ Ülke
    [0.36.17]  ,e.country.name,r?` ·
    [0.36.17]  Durak
    [0.36.17]  Gezi önizlemesi
    [0.36.17]  Plugs
    [0.36.17]  Rota önerisi
    [0.36.17]  Say the start and the nights get their dates.
    [0.36.17]  Suggested route
    [0.36.17]  TRIP PREVIEW
    [0.36.17]  Trip preview
    [0.36.17]~ Uçuşlar


#### son 0.36.67 (2204d6c) n=2
    [0.29.0]  Trip plan
    [0.36.62]  No ideas waiting.


#### son 0.36.66 (eab957b) n=18
    [0.5.0]  karar verildi`:
    [0.29.0]  Claude Haiku 4.5 · cheapest
    [0.29.0]  Claude Opus 5 · best results
    [0.29.0]  Claude Sonnet 5 · cheaper
    [0.29.0]~ Paylaşılan
    [0.36.12]  All it needs is
    [0.36.12]  Draft · Continue
    [0.36.12]  Generate my trip
    [0.36.12]  Gezimi oluştur
    [0.36.12]  TRIP CHECKLIST
    [0.36.12]~ Yol gezisi
    [0.36.12]  bilgi · yarıda kaldı`,`
    [0.36.17]  Generate for now
    [0.36.17]  Generate with this for now
    [0.36.17]  Şimdilik bununla oluştur
    [0.36.17]  Şimdilik oluştur
    [0.36.52]  Claude Haiku 4.5 · en ucuz
    [0.36.52]  Claude Sonnet 5 · daha ucuz


#### son 0.36.64 (beea585) n=1
    [0.36.63]~ için daha fazla öneri bul`,`Find more options for


#### son 0.36.63 (343a91b) n=6
    [0.13.0]  Sohbette söyledin
    [0.16.0]~ Detaylar
    [0.23.0]  Bu planı panodan kaldır
    [0.29.0]  Remove plan
    [0.29.0]  Remove this plan from the board
    [0.29.0]  You said it in the chat


#### son 0.36.62 (f0302af) n=1
    [0.35.8]~ Gidilen yerde yapılacak: Yapılacak şeyler'e taşı


#### son 0.36.59 (029f6ce) n=39
    [0.7.0]  ✓ Rezerve
    [0.32.0]  Giriş bileti gerekiyor
    [0.32.0]  Needs an entry ticket
    [0.32.0]  added to ideas
    [0.32.0]  fikirlere eklendi
    [0.34.0]  Bir şey yaz
    [0.34.0]  Book a table
    [0.34.0]~ Move to activities
    [0.34.0]  Write something
    [0.34.0]  Write something… e.g. Sunset from the Dom Luís bridge
    [0.34.6]  Hazırlık'a eklendi
    [0.34.6]  What to see, visit and try there
    [0.34.6]  added to Prep
    [0.35.3]~ Etkinliklere taşı
    [0.35.3]~ No city
    [0.35.3]  Was on
    [0.35.3]  için konmuştu · havuza döndü
    [0.35.3]  you're here
    [0.35.3]  · back in the pool
    [0.35.9]  Hazırlığa taşı
    [0.35.12]  Ad: düzenle
    [0.35.12]  Adı düzenle
    [0.35.12]~ Automatic
    [0.35.12]  Bugüne al
    [0.35.12]~ Durum
    [0.35.12]  Günü var
    [0.35.12]  In the pool
    [0.35.12]  Kaçtı
    [0.35.12]~ Kind
    [0.35.12]  Missed
    [0.35.12]  Name: edit
    [0.35.12]  Pick a kind
    [0.35.12]~ Status
    [0.35.12]  Tür seç
    [0.35.12]  from Maps
    [0.35.12]  güne konmuştu, yapılmadı
    [0.35.12]  tanesi günde
    [0.35.12]  was on a day, not done
    [0.36.32]  a taşı","Before the trip: move to Prep"),"aria-label":c(`


#### son 0.36.56 (baf8f47) n=5
    [0.31.0]  Plana seç
    [0.36.56]  Insurance and internet
    [0.36.56]  Sigorta ve internet
    [0.36.56]  Sigorta ve internet'e
    [0.36.56]  to Insurance and internet


#### son 0.36.55 (e992eaf) n=9
    [0.17.0]  iş kaldı
    [0.34.6]  Diğer → Hazırlık / Other → Prep (a chore before the trip, ticked off when done)
    [0.34.6]  all done
    [0.34.6]  hepsi tamam
    [0.35.8]  Diğer (Sigorta, eSIM)
    [0.35.8]  Other (Insurance, eSIM)
    [0.36.6]~ to Activities
    [0.36.6]~ to Other
    [0.36.6]  to Restaurants


#### son 0.36.54 (f2de3d8) n=1
    [0.36.49]  t delete, rule out or remove_from_plan: they stay on the plan. Ask the user about the gaps in the result


#### son 0.36.52 (6443b2d) n=8
    [0.28.0]  Ayarlar → Paylaşım'da adını yaz.
    [0.28.0]  Bu kod başka bir paylaşım sunucusuna ait. Ayarlar → Paylaşım'daki adresi silip tekrar dene.
    [0.28.0]  Önce Ayarlar → Paylaşım'da adını, Supabase adresini ve anahtarını yaz.
    [0.29.0]  Add your name in Settings → Sharing.
    [0.29.0]  First add your name, the Supabase address and key in Settings → Sharing.
    [0.29.0]~ Sharing
    [0.29.0]  This code belongs to another sharing server. Clear the address in Settings → Sharing and try again.
    [0.29.0]  To share, first add your name, the Supabase address and key in Settings → Sharing (once).


#### son 0.36.51 (e1e4537) n=11
    [0.4.0]  — Yeni sohbet —
    [0.6.0]  — karşılaştırmaya alınmadı
    [0.7.0]~ açık
    [0.9.0]~ Portekiz (örnek)
    [0.9.0]  — kaydettiğin sayfaları ve okunanları içerir, anahtarlarını ve sohbetini içermez. Bir şey yanlış okunduysa bu dosyayı paylaşabilir
    [0.13.0]  — Sohbet uzadı, yeni oturum başladı (kararların kayıtlı) —
    [0.29.0]  Claude Haiku 4.5 — en ucuz
    [0.29.0]  Claude Sonnet 5 — daha ucuz
    [0.29.0]~ Free cancellation until 5 Oct
    [0.30.0]  Dates and cities fill in as you save.
    [0.36.21]  Yer yok


#### son 0.36.49 (a23f050) n=1
    [0.36.36]~ query gerekli: kısa bir arama sorusu.


#### son 0.36.46 (bc2c5af) n=5
    [0.15.0]~ aşıyor
    [0.36.39]  a night over your budget's share for stays
    [0.36.39]  bütçenin konaklama payına uyuyor
    [0.36.39]  bütçenin konaklama payını gecelik
    [0.36.39]  fits your budget's share for stays


#### son 0.36.43 (88e1849) n=4
    [0.36.43]  Is the stay part of the programme?
    [0.36.43]  Konaklama programın içinde mi?
    [0.36.43]~ One resort, or two?
    [0.36.43]~ Tek resort mu, iki farklı resort mu?


#### son 0.36.38 (8a61c70) n=6
    [0.34.2]  Etkinlikler / Activities (needs a booking)
    [0.34.2]~ Konaklama / Stays
    [0.34.2]  Restoranlar / Restaurants
    [0.34.2]~ Ulaşım / Getting around
    [0.34.2]~ Uçuş / Flights
    [0.34.2]  Yapılacak şeyler / Things to do (no booking)


#### son 0.36.37 (6334591) n=2
    [0.36.31]~ I updated the
    [0.36.31]~ kartını güncelledim:


#### son 0.36.35 (6539eca) n=5
    [0.13.0]~ Butonlar gösterildi.
    [0.36.22]~ ) rotate(
    [0.36.22]~ ) scale(
    [0.36.22]~ The flight
    [0.36.22]~ uçuşu, haritada


#### son 0.36.34 (75b1b1e) n=9
    [0.30.0]  Confirmed
    [0.32.0]~ Karar ver:
    [0.32.0]~ Rezerve et:
    [0.32.0]~ gün içinde biter
    [0.34.1]  Tarih ve şehir, kaydettikçe netleşir.
    [0.35.0]~ Henüz kayıt yok
    [0.35.0]  Onaylanan
    [0.35.0]  Rezervasyonların
    [0.35.0]  Your bookings


#### son 0.36.32 (708c058) n=1
    [0.13.0]~ Yerine


#### son 0.36.31 (86e90c0) n=7
    [0.36.5]  a taşı","Before the trip: move to Prep"),"aria-label":d(`
    [0.36.12]  , where are we going next?`):d(
    [0.36.12]  I'm ready. Press Generate my trip, or type anything you'd like to add.
    [0.36.12]~ Ne zaman, kaç gün?
    [0.36.12]~ Tamam, rota bu.
    [0.36.17]~ nereye gidileceği
    [0.36.28]  ),children:d(`Yeni gezi:


#### son 0.36.29 (2741f8c) n=8
    [0.13.0]  Planlanıyor
    [0.29.0]  Chosen · not booked
    [0.29.0]  Seçildi · rezerve edilmedi
    [0.31.0]  Alındı ya da planlandı
    [0.31.0]  Booked or planned
    [0.31.0]  Seçildi, alınmadı
    [0.36.15]~ can't be.
    [0.36.15]~ check-in olamaz.


#### son 0.36.23 (cbaeccb) n=4
    [0.4.0]~ Bu id'lerle seçenek yok:
    [0.13.1]~ Geçersiz durum:
    [0.29.0]~ Invalid status:
    [0.29.0]~ No options with these ids:


#### son 0.36.21 (b3d4b7d) n=2
    [0.36.12]~ Atlandı · sonra sohbetten
    [0.36.17]~ Rotayı çiziyor…


#### son 0.36.17 (4605cfc) n=18
    [0.36.14]  Bant
    [0.36.14]  Başka havalimanına yönlendirildi
    [0.36.14]  Biniş başladı
    [0.36.14]  Boarding
    [0.36.14]  Check-in açık
    [0.36.14]  Check-in open
    [0.36.14]  Delayed
    [0.36.14]  En route
    [0.36.14]  Gate closed
    [0.36.14]~ Kalktı
    [0.36.14]  Kapı kapandı
    [0.36.14]  May be cancelled
    [0.36.14]  Rötar
    [0.36.14]  Rötarlı
    [0.36.14]  Yolda
    [0.36.14]  min late
    [0.36.14]  İnişe geçiyor
    [0.36.14]  İptal olabilir


#### son 0.36.16 (bfe5cc9) n=17
    [0.36.12]  A few seconds ·
    [0.36.12]  Birkaç saniye · %
    [0.36.12]  Düşünüyorum
    [0.36.12]  Got it:
    [0.36.12]  Kişi ve tarz:
    [0.36.12]  Luxury budget
    [0.36.12]  Lüks bütçe
    [0.36.12]  Nereye ve ne zaman gerekli.
    [0.36.12]~ Not aldım:
    [0.36.12]  Room made for the flights:
    [0.36.12]~ Rota çizildi:
    [0.36.12]~ Route drawn:
    [0.36.12]~ Thinking
    [0.36.12]  Uçuşlar için yer açıldı:
    [0.36.12]  Where and when are needed.
    [0.36.12]  Where from?
    [0.36.12]  Who and what:


#### son 0.36.15 (e149946) n=8
    [0.36.15]  Bu seyahate gidiyoruz:
    [0.36.15]  Gidiyoruz: uçuşlar takipte (iniş, rötar, kapı, bant)
    [0.36.15]  Stop following
    [0.36.15]  Uçuşların gerçek saatleri, uçuş günü rötar, kapı ve bagaj bandı (Veri: AeroDataBox)
    [0.36.15]  We're going: flights followed (landing, delays, gate, belt)
    [0.36.15]  We're going: follow
    [0.36.15]  Your flights' real times, and on the day delays, gate and baggage belt (Data: AeroDataBox)
    [0.36.15]  uçuşu takip et


#### son 0.36.11 (2f756c9) n=1
    [0.29.0]  Paste a link or drag a screenshot. It finds the right trip on its own.


#### son 0.36.8 (bf80d86) n=4
    [0.25.0]~ Geçersiz tavan:
    [0.29.0]~ Invalid ceiling:
    [0.33.0]~ eklenmedi (geri alındı)
    [0.33.0]~ not added (undone)


#### son 0.36.7 (fd3e3c9) n=4
    [0.35.1]~ t edit
    [0.35.6]  For the trip · insurance, internet
    [0.35.6]  insurance / internet
    [0.35.6]  sigorta / internet


#### son 0.36.4 (95adcf9) n=5
    [0.4.0]~ " ve içindeki her şey silinsin mi?
    [0.29.0]~ " and everything in it?
    [0.29.0]  Claude Opus 5 — en iyi sonuç
    [0.31.0]~ Trip Radar'ın eski bir sürümü hâlâ açık. Diğer Trip Radar sekmelerini kapatıp sayfayı yenile.
    [0.35.12]  a taşı","Before the trip: move to Prep"),"aria-label":f(`


#### son 0.36.2 (957299f) n=1
    [0.36.2]  Önce paylaşım sunucusu gerekli (Ayarlar → Paylaşım).


#### son 0.36.1 (f1a50dd) n=2
    [0.36.0]  AI gate (for the people you invite)
    [0.36.0]  AI kapısı (davet ettiklerin için)


#### son 0.35.11 (5a45ff4) n=6
    [0.32.0]  Open in Maps
    [0.35.3]  Today ·
    [0.35.3]  Yapılanlar
    [0.35.3]  buradasın
    [0.35.3]  de ara: kendi sayfasını bul","Search the web for its page"),"aria-label":p(`
    [0.35.9]  a taşı","Before the trip: move to Prep"),"aria-label":p(`


#### son 0.35.7 (ed5eed8) n=2
    [0.34.0]  Diğer · sigorta ve internet
    [0.34.0]  Other · insurance and internet


#### son 0.35.5 (1594143) n=3
    [0.35.4]  During the day · no time
    [0.35.4]  Nothing with a time yet.
    [0.35.4]  without a time


#### son 0.35.4 (d96c295) n=4
    [0.34.1]  · boş gün
    [0.34.1]  · boş günler
    [0.34.1]  · free day
    [0.34.1]  · free days


#### son 0.35.3 (77c725a) n=5
    [0.35.0]  Eler
    [0.35.0]  Matters less
    [0.35.0]  Rules out
    [0.35.0]  İkinci planda
    [0.35.0]~ Şart


#### son 0.35.2 (ddad73e) n=1
    [0.34.0]  Güne eklenmedi


#### son 0.34.9 (ed51fbd) n=21
    [0.25.0]~ ikinci planda
    [0.29.0]  As you chat and choose, I'll get to know you. What I understand shows up here.
    [0.29.0]  matters less
    [0.29.0]~ you want
    [0.30.0]  Bilinen toplam
    [0.30.0]  Everything's decided
    [0.30.0]  Her şey karara bağlandı
    [0.30.0]  Known total
    [0.30.0]  Next step
    [0.30.0]  See the route on Google Maps
    [0.30.0]  Travellers
    [0.30.0]~ sorun değil`,`
    [0.30.0]  · 1 question
    [0.33.0]  is fine`),text:m(`Sorun değil:
    [0.34.1]  Alınan, planlanan ve boşta kalan
    [0.34.1]  Booked, planned and free
    [0.34.1]~ Countries
    [0.34.1]~ Length
    [0.34.1]~ Places
    [0.34.1]~ Tahmini · kayıtlardan
    [0.34.1]  Weather


#### son 0.34.6 (63f4055) n=2
    [0.34.1]  Open its card on the Plan
    [0.34.1]  Other · no time


#### son 0.34.5 (2a1de0e) n=2
    [0.34.0]~ da Yapılacak şeyler
    [0.34.2]  Diğer / Other


#### son 0.34.4 (291d95c) n=5
    [0.34.1]  All days
    [0.34.1]~ Araç
    [0.34.1]~ Experience
    [0.34.1]  Nothing planned for this day yet.
    [0.34.1]  Tüm günler


#### son 0.34.3 (916c6dd) n=12
    [0.4.0]  Fiyat doğrulanmadı
    [0.4.0]~ Fiyat yok
    [0.4.0]  yer daha
    [0.11.0]~ Sonraki
    [0.11.0]  in c?String(c.key):
    [0.11.0]~ Önceki
    [0.29.0]  )`,`Closed options (
    [0.29.0]  Closed by a booking. Undo the booking and they come back
    [0.29.0]~ No price
    [0.29.0]~ Previous
    [0.29.0]  Price from
    [0.29.0]  Price not verified


#### son 0.34.1 (a96d4db) n=2
    [0.29.0]  Kullanıcı aldığını/rezerve ettiğini söylediyse true
    [0.29.0]  true if the user said they bought/booked it


#### son 0.34.0 (173b9e7) n=27
    [0.17.0]~ plan ·
    [0.17.0]  plan · hepsi hazır
    [0.19.0]  konaklama · planlanmadı
    [0.29.0]  Activities in the plan
    [0.29.0]  Plana alınan etkinlik
    [0.29.0]  Seçilen ya da alınan ulaşım
    [0.29.0]~ free day
    [0.29.0]  konaklama · karar ver
    [0.29.0]  muted num
    [0.29.0]  stay · decide
    [0.29.0]  stay · not planned
    [0.29.0]  · all set
    [0.30.0]  Alınan ya da seçilen uçuş
    [0.30.0]  Cars rented
    [0.30.0]  Flights booked or chosen
    [0.30.0]  Kategoriye göre harcama
    [0.30.0]~ Local
    [0.30.0]  Onaylananlar
    [0.30.0]  Seçilen ya da rezerve konaklama
    [0.30.0]  Spending by category
    [0.30.0]  Stays chosen or booked
    [0.30.0]  Transport chosen or booked
    [0.30.0]~ Yolcu
    [0.30.0]~ araç
    [0.30.0]  pasaportu`,`Visa ·
    [0.30.0]  · checked:
    [0.30.0]  · kontrol:


#### son 0.33.1 (313d75c) n=17
    [0.16.0]~ Planlar
    [0.29.0]  Bir plan kaydet ya da sohbette söyle
    [0.29.0]  Other stays
    [0.29.0]~ Plans
    [0.29.0]  Save a plan or say it in the chat
    [0.29.0]  gece · konaklama gerekmiyor`,`
    [0.32.0]  Bir fikir yaz
    [0.32.0]  Fikirler
    [0.32.0]  Ideas and to-dos
    [0.32.0]  Move to bookings
    [0.32.0]  No city yet
    [0.32.0]  Nothing yet. Write above, or save a restaurant's page.
    [0.32.0]  Write an idea
    [0.32.0]  moved to bookings
    [0.32.0]  rezerve edileceklere taşındı
    [0.33.0]  Fikirler'e eklendi
    [0.33.0]  added to Ideas


#### son 0.32.0 (c831f58) n=7
    [0.15.0]~ Varış transferi
    [0.29.0]  Ayrı olmasın
    [0.29.0]  Don't keep these nights as a separate stay
    [0.29.0]  Merge back
    [0.31.0]  ‹ Back
    [0.32.0]  is fine`),text:p(`Sorun değil:
    [0.32.0]  plandan kaldırıldı`,`


#### son 0.31.0 (b2873d5) n=5
    [0.4.0]  tamamen silinsin mi?
    [0.13.0]  plandan kaldırıldı
    [0.29.0]~ for good?
    [0.29.0]  removed from the plan
    [0.30.0]  is fine`),text:g(`Sorun değil:


#### son 0.30.0 (c0552d3) n=6
    [0.13.0]  Nasıl geçeceksiniz?
    [0.13.0]  Rezerve edilmedi olarak geri al
    [0.13.0]~ de Madeira
    [0.24.0]~ sohbette söyledin
    [0.29.0]  How will you get there?
    [0.29.0]  said in the chat


#### son 0.29.0 (38979c4) n=43
    [0.4.0]~ Anahtar kontrol ediliyor…
    [0.4.0]  Menü
    [0.8.0]  not · tüm geziler
    [0.8.0]  söylediğin · tüm gezi
    [0.15.0]  , açık ihtiyaçlar için tahmini
    [0.15.0]~ , seçilen
    [0.15.0]~ kalıyor
    [0.16.0]  ✓ Her şey karara bağlandı
    [0.24.0]  Gezinin maliyeti
    [0.25.0]~ önemli sayılıyor
    [0.28.0]~ Bu gezide yeni sohbet başlat
    [0.28.0]~ Bu geziyi sil
    [0.28.0]~ Paylaşılıyor
    [0.28.0]~ henüz katılan yok
    [0.28.0]  son eşitleme
    [0.29.0]~ , chosen
    [0.29.0]~ , estimated
    [0.29.0]  Chosen, not booked yet
    [0.29.0]  Cities on the trip
    [0.29.0]  Dates and cities fill in as you save
    [0.29.0]  Estimated total
    [0.29.0]~ Fine by you:
    [0.29.0]~ Menu
    [0.29.0]  See route ↗
    [0.29.0]  Some are within two weeks
    [0.29.0]~ Sorun değil:
    [0.29.0]  Stays with a place / stays needed
    [0.29.0]  Still to decide, estimated
    [0.29.0]  Travel chosen or booked
    [0.29.0]  Trip cost
    [0.29.0]  Yeri seçilen / gereken konaklama
    [0.29.0]~ counted as important
    [0.29.0]  for what's still open
    [0.29.0]~ is fine
    [0.29.0]  kayıt işlenemedi`,`Couldn't process
    [0.29.0]~ no one has joined yet
    [0.29.0]  note · all trips
    [0.29.0]  note · this trip
    [0.29.0]  sayfa okunuyor…
    [0.29.0]~ söylediğin ·
    [0.29.0]~ you said ·
    [0.29.0]  you said · whole trip
    [0.29.0]  ✓ Everything's decided


#### son 0.28.0 (d8f75f6) n=43
    [0.6.0]  daha kısa`:
    [0.6.0]  dk daha yakın`:
    [0.8.0]~ Kalan bütçe
    [0.8.0]~ senin için
    [0.8.0]  senin için önemli görünüyor: `:
    [0.9.0]~ sorun değil dedin
    [0.9.1]~ Şimdi değil
    [0.9.2]~ Başa baş
    [0.9.2]  Ciddi sorun:
    [0.9.2]  Rahat saatler:
    [0.9.2]  Zor saat:
    [0.10.0]  · ayarlandı ✓`:
    [0.10.0]  · rezerve edilmedi`:`
    [0.11.0]  AI incelemesi:
    [0.11.0]  daha iyi`).join(
    [0.13.0]  ,children:`Henüz eklenmedi · sohbette
    [0.14.0]~ Vergiler dahil değil
    [0.14.1]~ Puanı yüksek
    [0.14.1]  her açıdan önde`,tag:
    [0.16.0]  `:e.before?`En geç
    [0.16.0]~ seçenek ·
    [0.16.0]  · Konaklama
    [0.16.0]~ · nasıl?
    [0.16.0]  · rezerve edilmedi
    [0.16.0]  · yer seçilmedi
    [0.16.0]  · Şehir değişimi
    [0.19.0]  · gün belli değil
    [0.20.0]  ,`Puanı düşük ·
    [0.20.0]  ,text:r?`Ücretsiz iptal · son gün
    [0.20.0]  ?`Dönüş uçuşu ·
    [0.20.0]  ?`Gidiş uçuşu ·
    [0.20.0]~ En fazla
    [0.20.0]~ Erken kalkış
    [0.22.0]~ onaylandı
    [0.23.0]~ için yer seçilmedi: bu konaklama tek blok, seçtiğin yer yalnız bir kısmını kapsıyor.
    [0.23.0]  · planlanıyor`:
    [0.24.0]  Karar bekleyen, tahmini
    [0.24.0]  Seçildi, rezerve bekliyor
    [0.25.0]~ fiyatın kapsamı
    [0.26.0]~ konforu daha zayıf
    [0.28.0]  ,children:`Bir geziyi birlikte gezdiğin kişiyle paylaşmak için (ikiniz de kaydedip oy verirsiniz). Kurulumu README'de
    [0.28.0]~ İkiniz de istemiyorsunuz
    [0.28.0]  İkiniz de istemiyorsunuz ·


#### son 0.25.0 (d10ee3b) n=3
    [0.25.0]  Genel olarak en iyi
    [0.25.0]  her açıdan önde:
    [0.25.0]  öne çıkıyor.


#### son 0.24.0 (2336a8b) n=15
    [0.4.0]  Gezinin adını, kesin tarihlerini veya toplam bütçesini günceller. Değişmeyen alanlar için null ver.
    [0.6.0]  fiyat o kadar önemli değil
    [0.6.0]  merkezi olsun
    [0.7.0]~ Önemsiz
    [0.10.0]~ Yürüyüş
    [0.15.0]  biraz önde:`:`Önerim
    [0.15.0]  pahalı ama `:`
    [0.16.0]~ Onay ekranından
    [0.20.0]  karşısında `:
    [0.22.0]  Alternatif
    [0.22.0]  En iyi seçim
    [0.22.0]  En kaliteli
    [0.22.0]  En pratik konum
    [0.22.0]~ en yakın
    [0.22.0]  yorumları en iyi


#### son 0.23.0 (29f13a5) n=4
    [0.15.0]  Açık, tahmini
    [0.15.0]  Seçilen
    [0.15.0]  fiyat hesaba katılamadı
    [0.21.0]~ yalnız


#### son 0.22.0 (db0085f) n=1
    [0.13.0]  Nereye gidildiğini (to) yaz.


#### son 0.21.0 (a0ecd12) n=1
    [0.4.0]  Sayfanın ana görseli (og:image vb.)


#### son 0.19.1 (0d32e56) n=6
    [0.14.1]  Yorumlar iyi
    [0.14.1]  Yorumlar zayıf
    [0.15.0]  Senin için önemli
    [0.15.0]  karşısında
    [0.16.0]  Dönüş uçuşu ·
    [0.16.0]  Gidiş uçuşu ·


#### son 0.18.2 (6b73d77) n=1
    [0.16.0]~ Tarih yok


#### son 0.17.0 (9da8e04) n=2
    [0.16.0]  · planlandı
    [0.17.0]~ Araç teslim


#### son 0.16.0 (2278eef) n=1
    [0.16.0]  saat yok


#### son 0.15.0 (fc5e3c5) n=11
    [0.9.0]~ En ucuz:
    [0.9.0]  En ucuzdan
    [0.9.0]~ daha az
    [0.11.0]  · Şehir değişimi`,subtitle:`
    [0.12.0]  ⇄ Değiştir
    [0.15.0]  Karar sırası
    [0.15.0]  Varış ·
    [0.15.0]  karar kaldı`:
    [0.15.0]  karar verildi
    [0.15.0]  kayıtlı uçuş yok
    [0.15.0]~ seçenek yok


#### son 0.14.2 (101e2f7) n=4
    [0.8.0]  Planında ✓
    [0.8.0]  Rezerve edildi ✓
    [0.8.0]~ plana al
    [0.8.0]  sayfada görünmüyor.


#### son 0.14.0 (3b72304) n=1
    [0.9.0]  her açıdan önde`,detail:


#### son 0.13.1 (ed317f3) n=2
    [0.11.0]  Bilet alındı ✓
    [0.11.0]  Vergiler fiyata dahil değil


#### son 0.12.0 (1299b26) n=1
    [0.9.2]~ Geceler


#### son 0.11.0 (6d748ea) n=1
    [0.11.0]~ Eksiler


#### son 0.10.0 (9c89051) n=1
    [0.7.0]~ Açık


#### son 0.9.3 (7d96d45) n=1
    [0.7.0]  ulaşımı yok


#### son 0.9.1 (65606ff) n=2
    [0.9.0]~ Yeni gezinin adı
    [0.9.0]~ sorun değil


#### son 0.8.0 (ca8d0dc) n=2
    [0.7.0]  her açıdan önde`,tone:
    [0.8.0]  not · bu gezi


#### son 0.7.0 (c6e9bed) n=4
    [0.6.0]  iptal esnek olmalı
    [0.6.0]  mutfak lazım
    [0.6.0]  sabah uçuşu sevmem
    [0.6.0]  €45 fazla ama kaydettiğin 2 yere 6 dk → akşam dönüşleri kolay


#### son 0.5.0 (7f9fc51) n=11
    [0.4.0]  8 Ekim · Direkt
    [0.4.0]  Casa Azul'dan €45 fazla ama kaydettiğin 4 yere yürüme mesafesinde.
    [0.4.0]~ Failed to parse structured output as JSON:
    [0.4.0]  Jardim Stay iyi bir denge.
Casa Azul'dan €45 fazla,
ama gezmek istediğin yerlere daha yakın.

Bunu planına alalım mı?
    [0.4.0]  Kullanıcının tercihini hatırlar (ör. 'Merkezi konum önemli', 'Sabah uçuşu sevmiyor').
    [0.4.0]  Merkeze 25 dk yürüme
    [0.4.0]  Senin için önerilen
    [0.4.0]  Tek cümle gerekçe
    [0.4.0]  thumb icon
    [0.4.0]~ İstanbul → Porto
    [0.4.0]  €45 fazla ama kaydettiğin 4 yere daha yakın
