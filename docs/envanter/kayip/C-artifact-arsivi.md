# C · Artifact arşivi: claude.ai'da duran çizimlerin repoya alınması ve canlıyla karşılaştırması

Tarih: 2026-10-13 · dal `plan-v46-kod` · kaynak koda dokunulmadı. Arşiv: `docs/mockups/artifact-arsivi/` (dizin: `_dizin.md`). Görseller: `docs/envanter/kayip/img/c-*.png`.

Yöntem: 30 artifact'ın hepsi `Artifact read` ile (HTML + `img/`, `illus/` ek dosyaları) indirildi. Her `index.html` repodaki `docs/mockups/**` ile satır kümesi karşılaştırıldı (parmak izi). Çıkarılan maddeler `static/app.css`, `src/app/*.ts(x)` ve `src/lib` grep'iyle canlıyla eşlendi. "Hareket Dili" ve "Hareket Durumu" repoda yoktu (önceki envanter `02-hareket-ve-sohbet.md` §0.1 "kaynak mockup yok" diye işaretlemişti); artık `artifact-arsivi/hareket-dili-P2qVN5/` altında. Etiketler: CANLI · ÇİZİLDİ-KODDA YOK · FARKLI (değer farkı) · VAZGEÇİLDİ (Emre kararı yazılı) · KARAR KAYDI YOK.

## 1. Özet

| Ölçü | Sayı |
|---|---|
| Artifact (istenen) | 30 |
| Arşivlenen | 30 (okunamayan 0) |
| Ek dosya (img/illus) | 163 (klasörler toplam 16 MB; sürümler arası yinelenen görseller git'te tek blob) |
| Repoda zaten vardı (satır satır aynı) | 17: Açılış v2, Sihirli Açılış, Katmanlı Arayüz, Giriş Akışı 2. ve 3. tur (`giris-akisi-v2`, `v3`), Japonya ×6 (`japonya-web-v6…v11`), Ozora ×2 (`ozora-web-v4,v5`), Bali Aşamaları ×3 (`asamalar-web-v1…v3`), Bali İlk Ekran (`ilk-ekran-v1`) |
| **REPODA YOKTU** | **13**: Hareket Dili, Hareket Durumu, Hero Fikirleri, Gece Raporu, Kararlar ve akış, Günün akışı ve rezervasyonlar, Rezervasyon kartları, Sade yolculuk günü, Yolculuk günü, Karar Panosu Taslağı, Etsy Analizi, Radar AI Sohbet Ekranları, Sohbet Ekranı Tasarımı |
| Başka proje | 2: "Radar Pro · Seyahat Hack Merkezi" (uçuş fırsatı uygulaması, Ağustos 2026). Trip Radar ile marka/ürün ilişkisi yok; yine de arşivlendi |
| Önem sırasına konan kayıp/fark (§3) | 25 madde: 16 ÇİZİLDİ-KODDA YOK, 7 FARKLI, 2 VAZGEÇİLDİ |
| Hareket Dili tablosu (§4) | 31 satır: 11 CANLI, 13 FARKLI, 3 ÇİZİLDİ-KODDA YOK, 1 VAZGEÇİLDİ, 3 karma (ızgara bölüm, menü, iskelet) |

Not: 17 "zaten vardı" dosyanın repo kopyaları ile artifact arasındaki tek fark artifact platformunun eklediği 3 satırlık üst sarmaldır (`diff` 3 satır, ~550 bayt).

## 2. Artifact artifact: ne diyor, canlıda ne var

### 2.1 Hareket Dili (REPODA YOKTU) · `hareket-dili-P2qVN5`
Tez: hareket süs değil; (1) ne olduğunu söylemek, (2) nereden nereye gittiğini göstermek, (3) beklerken yalnız bırakmamak. "Tek imza an sihirli açılış, geri kalan her şey hızlı ve sessiz."
- Beş süre: Anında 120 · Hızlı 180 · Temel 260 · Yavaş 380 · Anlatı 600 ms. Üç eğri: giriş `(.16,1,.3,1)`, çıkış `(.5,0,.75,0)`, yer değiştirme `(.65,0,.35,1)`; zıplayan eğri yalnız mühür ve maskotta.
- Altı kural: çıkış girişten hızlı (açılış 260, kapanış 160–180); yalnız opacity/scale/translate/ışık oynar, boyut ve konum oynamaz, bölüm aç/kapa ızgara yöntemiyle; azaltılmış harekette renk/saydamlık kalır; 0,4 sn'den kısa işte iskelet ya da döner işaret yok; aynı anda tek odak.
- Örnekler (hepsi §4'te değerleriyle): sekme, gezi kartı→hero, pencere, çekmece, bölüm, menü+bildirim, iskelet kart, asistan düşünüyor, fotoğraf buğudan netleşir, arka planda iş, 4 boş ekran, 4 hata, "Plana koy" uçuşu, "zaten yayında olanlar" (basma %97/120 ms, kopyalandı, mühür, geri al halkası, sayaç, 2 px yükselme, sihirli açılış).
- 5 maskot durumu: Bekler (göz kırpar), Düşünüyor (salınır, gözler gezinir), Oldu (gözler güler, zıplar), Olmadı (başı yana, ağzı düz, yıldız soluk), Bekliyor (gözler kapalı, yavaş nefes, minik z).
- **Üç soru ve kararlar**: (1) Hepsi mi? Öneri "Hepsi, bu sırayla" (aç/kapa+yükleniyor, boş+hata, sekme+gezi kartı); Hareket Durumu'na göre hepsi 0.36.78/.82'de yayına çıktı, yani evet. (2) Maskot hata/boş ekranda? Öneri boş ekranda evet, yalnız büyük hatada evet; **Emre: "boş ekranlarda ve büyük hatada evet"** (Hareket Durumu). (3) Gezi kartı→hero: "önce fotoğraf, sonra maskot": canlıda `photoCarried()` ile açılış fotoğrafı atlıyor, B açılışında maskot yok → karşılanmış.
- Görsel: `img/c-hareket-*.png` (§5).

### 2.2 Hareket Durumu (REPODA YOKTU) · `hareket-durumu-9zYBic` (11 Ekim 00:42)
Filtrelenebilir durum listesi: 5 durum (Yayında/Kodlandı bekliyor/Sırada/Kart tasarımını bekliyor/Vazgeçildi). Satırlar: **Yayında 0.36.78**: gezi başına bir kez açılış, sekme değişimi (sade: alt çizgi belirir, içerik yumuşar; "kayan çizgi/yönden kayma yapılmadı"), gezi kartı→hero, pencere+çekmece açılışı (kart seçenek penceresi bilerek hariç), bölüm aç/kapa, asistan düşünüyor, fotoğraf buğudan (yalnız ana sayfa kartları), arka plan işi ("N kayıt işleniyor" hapı; üstte ışık çizgisi yapılmadı), boş ekranlar ×3, boş kart nabzı (0.36.75), yanlış anahtar, maskotun iki yüzü. **0.36.82**: yeni açılış B · Ritim ve sayaçlar, pencere/çekmece kapanışı, iskelet kart (yalnız ışık geçişi), "bağlanamadım" şeridi, "internet yok" bildirimi, "Plana koy" uçuşu (Plan sekmesine). **VAZGEÇİLDİ (Emre: "Kararın: hayır")**: (a) kart menüsü ••• ve "Geri al" bildirimi, (b) "Okunamadı → Tekrar dene" dönütü. Ayrıca: "Sekme alt çizgisi v30'da tasarım oturumunun kararıyla kalktı."

### 2.3 Açılış v2 (repoda `acilis-v2`) · `acilis-v2-SstEin`
Dördüncü tur "Pıt pıt, ama hafif": Şimdiki (0.36.78, 4/10: 1,9 sn boş, göz kırpma, 1,2–5 sn zorla kaydırma) · **A Kıvılcım izi 8/10 (öneri)** · **B Ritim ve sayaçlar 7/10** · C Sade 6/10. **Emre seçti: B** (Hareket Durumu). İlkeler: boş bekleme yok; kaydırma kullanıcıda, alttakiler görününce bir kez gelir; yalnız opacity/küçük büyüme; kimse kimseyi beklemez (fotoğraf/hava/fiyat); gezi kartından gelen fotoğrafla çakışmaz. B değerleri: vuruş 95 ms, grup içi 38 ms, rise 300 ms `(.2,.7,.2,1)`, sayaç 520 ms, çubuk 600 ms, çizgi 300 ms, kaydırınca 45 ms, ipucu yazıları ("Tıkla, hemen bitsin", "Aşağı kaydır…"). Canlı `opening.ts`: GAP 80, MAX_START 450, RISE 300 `(.2,.8,.2,1)`, COUNT 520, BAR 600, SCROLL_GAP 45, rootMargin −24 px; iç vuruş 38 ms ve ipucu yazıları yok.

### 2.4 Sihirli Açılış (repoda `sihirli-acilis`) · `sihirli-acilis-TRLGQB`
Üçüncü tur: seçilen açılış "göz kırpar" (sonradan VAZGEÇİLDİ), dokuz maskot (İlk küre güler yüzlü, Sade küre, Küre, Radar, Konum iğnesi, Kâğıt uçak, Bulut, Yıldız, Pusula). Çizimin önerisi "Sade küre · gülümser"; **kod "İlk küre · güler yüzlü" kullanıyor** (`Mascot.tsx`): FARKLI, karar kaydı yok. Açılış yönleri A/B/C bu turda değil (v2'de).

### 2.5 Katmanlı Arayüz (repoda `ux-katmanli-arayuz`) · `katmanli-arayuz-BqNdqC`
İkinci tur; kural "hiçbir bilgi saklanmıyor, yalnız ek". Onaylananlar: (1) bütçe çubuğu üstüne gelince rezerve/seçildi/boşta/ayrılan; (2) hero bilgi satırına açıklama kutuları (kur, priz, saat, dil, 3 günlük hava); (3) sohbet günlüğü "12 değişiklik ▾"; (4) "•••" yerine hover eylem ikonları; (5) altı hareketlik sözlük (mühür 0,5 sn · parlama 1 sn · düşüş 0,55 · nabız yavaş · yükselme 0,18 · sayaç 0,6). Yeniden düşünülenler: transfer bakış kutusu, uçuş bakış kutusu (bagaj/koltuk/kod/terminal), "Kendin ara" C (logo hep görünür, ad hover'da). Hızlı kazançlar: yapışkan mini çubuk, fiyat tazeliği noktası, şehir mini kartı, kim ne yaptı, kopyala, geri alma halkası, sekme noktası, hero sayaçları tıklanır. Bırakılanlar: hero akordeon, tek rozet uyarılar, bölüm başlığı özeti, karşılaştırmada çubuk, kartın üç katmanı.
Canlı: **hepsi CANLI** (HoverTip bütçe/hero, ChatFold, ActionStrip, `pk-pop/pk-glow/pk-drop/pk-pulse/yükselme −3 px/useCountUp`, `cardPeek.ts`, `EmptyCard` Kendin ara + `.ek-nm`, StickyBar, OfferRow tazelik, TripShape şehir kartı, `share/activity.ts`, CopyButton, UndoToast halkası 8 sn, usePanoDot). Sözlük değerleri v46'da çizime geri alındı: parlama 1,1 sn/10 px, nabız 1,4 sn/7 px, yükselme −3 px (önceki envanterin "ÇELİŞKİ" dediği farklar kapanmış).

### 2.6 Hero Fikirleri (REPODA YOKTU) · `hero-fikirleri-GJsnyq`
v30 hero "6/10" + **A Tek satır özet 6/10**, **B Kartpostal 7/10** (bütçe halkası, hava pul, arkası döner), **C Fotoğrafa yerleşen bilgiler 8/10 (öneri)**: hava+pratik bilgi fotoğraf altında buzlu şeritte, tercihler başlık altında çipler, sağ kartta yalnız kişiler+bütçe, tek açılır "Kalemler", kutu sayısı 6'dan 2'ye. İki soru: hangi yön (C), kim yapsın (v30 tasarım oturumuyla birlikte). **KARAR KAYDI YOK**; kodda `TripHero`/`TripFacts` hâlâ ayrı bloklu sağ kart (C yok, A/B yok). → ÇİZİLDİ-KODDA YOK. Görsel: `c-hero-fikirleri-A-B-C.png`.

### 2.7 Giriş Akışı Çizimi · 2. tur (repoda `giris-akisi-v2`) · `giris-akisi-cizimi-TtcPxM`
Dört adım: ana ekran, Enter anı, sohbet, Oluştur + "pıt pıt sözlüğü". Kararlar: düğme hep "Oluştur" (altında "elde ne var"); K4 soru sırası gün→ne istediğin→rota→kimle→nereden; ana ekran arka planı A Rota (kâğıt uçak) / B Aurora / C Topografya (canlı: yalnız A; B,C VAZGEÇİLDİ); Poster seyahat kartı (başlık 26/22/19 punto, en çok 3 satır, kişiler sol üst); Enter anı süreleri 120 / 620 / 700 ms +80 gecikme; fotoğraf sahnesinde kutu erir; "Plan taslağı"nı kaldır (Karar 6; canlıda kaldırıldı); sözlük: Tik 340 ms (+6 nokta), Halka 550, **Kart iner 600 ms/90 ms arayla**, **Sayı yukarı kayar 450 ms**, Satır 500 ms. Canlı: Enter anı, sahne, tik/halka/satır CANLI (tik 450 ms: FARKLI küçük); **"Kart iner" ve "Sayı kayar" ÇİZİLDİ-KODDA YOK** (önceki envanter S10/S11); Pano açılışı adımı çizimden çıktı (açılış B'ye devredildi). Yer tutucu cümlelerin dönmesi (phc 9 sn) v46'da CANLI.
**"Kontrol listesi iconlu"**: bu çizimde satırlar çember içinde tik ikonu (`#i-check`) taşıyor; canlı `Checklist.tsx` aynı (UiIcon check, nabızlı "sorulan" halka) → CANLI. Satır başına kategori ikonu (konum/kişi/takvim) çizilmemiş; ikonlu satırlar yalnız Gece Raporu'ndaki eski "Gezi önizlemesi"nde var (aşağıda).

### 2.8 Giriş Akışı Üçüncü Tur (repoda `giris-akisi-v3`) · `giris-akisi-3-tur-BhS7sL`
Dört revizyon: (1) **Tek panel**: fotoğraf kutucukları dar kontrol listesinin üstünde aynı kartta, önizleme satırları listeye katlandı (canlı CANLI: `PhotoStrip` + `Checklist`); (2) **Canlı sohbet**: soru 0 sn, sağ taraf 1 sn, model sözü 3 sn ince mor çizgiyle (CANLI, `start/model.ts`; "her cevaba söz" seçeneği için karar kaydı yok); (3) **Ana ekran önerileri çalışsın**: İlham/Son dakika tek motor, Yol gezisi "yakında" (canlıda çalışıyor, "yakında" etiketi yok: FARKLI küçük); (4) **Kartlarda yüzler yalnız grup gezisinde** (CANLI). **Fotoğraf mozaiği**: dosyada üçüncü taslağın "B · mozaik+kutucuk" (`.mos` 1,7fr/1fr, 250 px) ve "A · hero şerit+küçük kareler" CSS'i duruyor ama sayfada kullanılmıyor (Revizyon 1 "tek kart, üstte fotoğraf kutucukları" onların yerine geçti). Mozaik düzeni kodda yok; fotoğraf sahnesi (Oluştur) ve önizleme şeridi var. → mozaik: ÇİZİLDİ, KULLANILMADI (karar: Revizyon 1).

### 2.9 Gece Raporu (REPODA YOKTU) · `gece-raporu-1BsjvX` (9 Ekim, sürüm 0.36.60)
Gece oturumu raporu: ana ekran (ortada büyük AI kutusu, çip ikonları, lavanta şekiller; profil menüsü, dil ve ₺ € $ £ para birimi); Enter anı view-transition; **sohbet sırasında sağ taraf**: büyük fotoğraf sahnesi + **"Plan taslağı"** (Uçuş/Konaklama/Ulaşım/Yapılacak şeyler/Hazırlık bölümleri, kesik çizgili "Arıyoruz" kartları, 11 kart, cevap gelince kart parlar, K5) + **ikonlu "Gezi önizlemesi"** (konum iğnesi ROTA ÖNERİSİ, takvim TARİH, kişiler KİMLE, kıvılcım TARZ, uçak UÇUŞLAR, küre ÜLKE); fotoğraflar gezinin anları (romantik akşam, havuzlu villa, yerel lezzetler; aynı foto iki kez gelmez; "Lisbon" aramasıyla "TRAVEL THE WORLD" hatası); Oluştur sonrası büyük fotoğraflar, pano ≈4,5 sn; düzeltilen hatalar (Hazırlık'a kayma, sohbet sayfa kaydırma, harita 3 çizim); Claude Sonnet 5.5 varsayılan; senden: yayın onayı, K4 sırası, insan içeren fotoğraflar, Gemini karşılaştırması.
Canlı: ana ekran, profil menüsü/dil/para birimi, view-transition, fotoğraf sahnesi, Sonnet 5.5 CANLI. **Plan taslağı + ikonlu önizleme satırları: VAZGEÇİLDİ** (`3ae8672` kodlandı, `29b5e74` kaldırıldı; giriş akışı çizimi Karar 6 "ikisini kaldır"); `docs/urun-yol-haritasi.md:431-433` hâlâ "var" diyor (belge hatası). Görseller: `c-gece-plan-taslagi-ve-ikonlu-onizleme.png`, `c-gece-buyuk-fotograf-sahnesi.png`.

### 2.10 Japonya Planı ×6 (repoda `japonya-web-v6…v11`)
Plan ekranı evrimi (JS ile çizilen A Yalnız prompt / B Prompt+linkler / C Karar ve rezerve + Pano, "Hareketi duraklat"). v1 hero "Bugünkü / Önerim"; v2 linkler kutuya bağlanır, "▾ seçenek" listesi; v3 "Kaydettikleriniz" kartın içinde + "AI önerisi", "Fiyat linkte"; v4 Yapılacak şeyler/Gezilecek ve yemek, Reels/TikTok linkleri; v5 kart sabit, "2 kaydettiğiniz · 1 AI önerisi ▾" şerit, Restoranlar/Gezilecek yerler, Sigorta ve internet, vize; v6 **kart hep aynı boyda, basınca seçim penceresi, "Pano'da 2 alternatif", "Aldım" ile rezerve**. Canlı karşılığı plan-v30/v46 (kart arka yüzü, Pano grubu, "Aldım"); v6'daki seçim penceresi v30'da kartın arka yüzü oldu (VAZGEÇİLDİ, `plan-v30-design.md:133`).

### 2.11 Ozora ×2 (`ozora-web-v4,v5`) · Bali Aşamaları ×3 (`asamalar-web-v1…v3`) · Bali İlk Ekran (`ilk-ekran-v1`)
Ozora: A Yalnız prompt / B Sohbetle şekillendi / C Arkadaşların linkleri / D Karar ve rezerve; festival bileti gezinin sebebi, Budapeşte uçuşu, kamp, Schengen vizesi, 6 kişi; v2 AI "arka planda arıyor", "Henüz seçilmedi" satırları. Bali Aşamaları: A–E (Yalnız prompt → Karar verildi); kesikli niyet kartları, "Kendin ara", "+8 fikir Pano'da", v3 "Sohbetle şekillendi / Panodan yerleştir", × ile at / Plana ekle. İlk Ekran: tek cümleden pano üç anda (niyet kartı, kaynaklı öneri, AI fikri; cevaptan sonra değişen kart). Hepsi canlıda plan-v30/v46 içinde karşılanmış çizim hattı (Niyet→Fikir→Plan→Rezerve aşamaları, K29 aşama hareketi v46 P8c ile CANLI); ayrı eksik madde çıkmadı. Ozora'ya özgü "mühür büyükten basılır" (stamp 1,8→1) canlı mührün tersi: FARKLI (önceki envanter K3).

### 2.12 Kararlar ve akış · Günün akışı ve rezervasyonlar · Rezervasyon kartları · Yolculuk günü · Sade yolculuk günü (29 Eylül, REPODA YOKTU)
Porto–Madeira örneği, Eylül sonu "gün akışı" tasarım turları:
- **Kararlar ve akış**: iki bölüm: "Kararlar ve rezervasyonlar" (her ihtiyaç bir kart: uçuş, konaklama, transfer, araç, etkinlik; karar bekleyen seçenekleriyle açık, verilen kompakt, rezerve yeşil) ve "Günlük akış" (gün gün/saat saat; uçuş bilet gibi tek satır). İkisi aynı veriden.
- **Günün akışı ve rezervasyonlar**: her gün iki parça: üstte yazı-akış ("okunur, basılmaz"), altta o günün rezervasyonları kendi kartında (rezerve olunca da kalır, yeşil); yürüyüş/metro/check-in akışta kartsız; otel şehrin başında bir kez; gün başlığına dokununca gün kapanır, hazır gün kapalı gelir ("✓ hazır").
- **Rezervasyon kartları**: kart yalnız rezervasyonu olan şeyde; bilgi → ince satır; günlere yayılan (otel/araç) → şehrin başında; kartın dört hali (Planlanmadı kesikli → Karar ver → Rezerve et amber → ✓ Rezerve küçülür).
- **Yolculuk günü**: şehir değiştirme günü ayrı satır değil günün içinde: 1 Geçiş kartı (öneri), 2 Yolculuk şeridi, 3 Tek satır açılır; her gün kartında "4. gün · Cumartesi 10 Eki", Bugün işareti, "~13:00" tahmin işareti.
- **Sade yolculuk günü**: A **Tek bilet (öneri)**: gün = uçuş kartı, üst kenarda çıkış, alt kenarda varış; B Üç satır; C Rayda sıra. "Rozet yağmuru yok: biten küçük ✓, eksik tek kelime."
- **Fotoğraflı Gün gün**: bu beş artifact'ın hiçbiri fotoğraf içermiyor (0 `img`/`url()`). Emre'nin hatırladığı fotoğraflı Gün gün repoda: `docs/mockups/2026-10-05-gunluk-akis-v1…v3` (+png; v3: gün başına büyük şehir fotoğrafı, "Bugün · 9 Eki Cum · Porto" etiketi, "Dünden kalan"), canlı kodda 12 Ekim'e kadar vardı: commit `5d5c7a4` ("old photo cards, Liste|Kartlar switch and day strip removed") onları kaldırdı; geri getirmek için `git show 5d5c7a4^:src/app/days/DayCards.tsx`. Görsel: repodaki `2026-10-05-gunluk-akis-v3-bugun.png`; canlı karşılaştırma görüntüleri aynı klasörde başka çalışmanın `gun-gun-*.png` dosyalarında.
Canlı karşılığı: Gün gün = "gün başına tek kompakt satır" (`DayCards.tsx`: tarih kutusu, aşamalı satırlar, "Gece:" satırı); **bu beş çizimin kartlı "Yolculuk günü/Tek bilet", "iki parçalı gün (akış + rezervasyon kartları)", "gün başlığı kapanır/✓ hazır" kodda yok** → ÇİZİLDİ-KODDA YOK; karar kaydı (hangi seçenek) bulunamadı.

### 2.13 Karar Panosu Taslağı (REPODA YOKTU) · `karar-panosu-taslagi-Hajs4s` (29 Eylül)
On öneri: (1+6) karar sırası + bütçe çubuğu (CANLI: StickyBar/TripHero/progress.ts); (2+4) yan yana seçenekler, öneri tek satır, **★ öncelik** (söylediğin önceliğe dokunan satırlar): ★ yok, canlıda pros/cons'ta öncelik yıldızı yok; (3) UI kuralları: DESIGN.md (CANLI); (5) tarih uyarıları ("girişe 9 gün kaldı", "iptal için 6 gün", `progress.ts:138`) CANLI; **(7) sade karşılaştırma** (yalnız farklı satırlar, kazanan yeşil, "Aynı olanları da göster", "Önemleri ayarla"): canlı `PanoTable` tüm satırları gösterir, en iyi hücreyi işaretler; fark-süzgeci ve geçiş yok; (8) tekrar yok (etiket kalkar): v30 satır başlığıyla karşılanmış; **(9) sohbet↔pano: asistan adı tıklanır, pano karta gider ve parlar**: kod aramasında bulunamadı; **(10) Sırayla karar ver** (her ekranda bir karar, "1/3"): bulunamadı. Karar kaydı yok.

### 2.14 Etsy Analizi (REPODA YOKTU) · `etsy-analizi-PhsDXJ` (5 Ekim)
Rakip araştırması: 53 Etsy planlayıcı ürünü, 16'sı ayrıntılı. Bulgular: talep kanıtlı; "otomatik" aslında elle giriş; en büyük şikâyet karmaşıklık; ikinci büyük kategori sunum (Canva rehberi); yolculukta her şey telefonda. İlkeler: doldurulacak alan yok, yeni sekme yok, grafik yerine cümle, bir yüzeyde bir ana eylem, yeni ekran yerine çekmece, "Yapılacak" tek anlam. Taslaklar: 1 Gezi kapağı (hazır olma halkaları), 2 **Hazırlık çekmecesi** (tarihli maddeler, belgeler: pasaport/Schengen "sor", bavul, Para/Priz/Bahşiş/Acil), 3 **Para çekmecesi** (ödendi/ödenecek/nakit, kişi başı, "Sabine sana €50 borçlu"), 4 **Gezi sayfası** (telefonda salt okunur link, "Bugün/Sıradaki", yazdırılabilir), 5 Günlük akış (sabah/öğle/akşam, "Günlere dağıt"). Yol haritası: Faz 0 kurulum, Faz 1 gezi sayfası 9/10 L, Hazırlık 8/10, Para 7/10; Faz 2 günlere dağıt, .ics, bavul, hava; Faz 3 harcama/hesap.
Canlı: Hazırlık maddeleri kısmen (`PrepList.tsx`, `Hazırlık` bölümü; çekmece, belge/vize "sor" mantığı, "Bilmen gerekenler" yok), Sıradaki şeridi var (`StickyBar`); **gezi sayfası, para çekmecesi (ödenecek/kişi başı/kim kime), .ics, Günlere dağıt, Bugün ekranı: kodda yok.** `docs/arastirma/2026-10-06-layla-sikayetleri.md:104` "telefon için salt okunur gezi sayfası 8/10" diyerek aynı işi önemli buluyor; Etsy araştırma dosyası repoda yok (artık arşivde). Görsel: `c-etsy-ekran-taslaklari.png`.

### 2.15 Radar AI Sohbet Ekranları + Sohbet Ekranı Tasarımı · BAŞKA PROJE
"RADAR PRO · Seyahat Hack Merkezi": uçuş fırsatı/rota tarama uygulaması (krem zemin, lacivert, mint/turuncu; Bangkok, $418 %44 ucuz, lounge, alarm). Trip Radar'ın ürünü, markası ya da kodunda karşılığı yok (repoda "Radar Pro" geçmez). Arşivlendi, karşılaştırma yapılmadı.

## 3. En önemli 25 kayıp / fark

Önem = kullanıcıya etkisi + çizim emeği + karar netliği. Kaynak = artifact · bölüm. Görsel = `img/` dosyası ya da arşivdeki sayfa.

| # | Kayıp/fark | Kaynak | Canlıda | Görsel |
|---|---|---|---|---|
| 1 | Telefonda açılan, salt okunur, kurulumsuz **gezi sayfası** ("Bugün/Sıradaki", yazdırılabilir; Etsy 9/10 L) | Etsy · Taslak 4 | ÇİZİLDİ-KODDA YOK | `c-etsy-ekran-taslaklari.png` |
| 2 | **Para çekmecesi**: ödendi / ödenecek (tarihli) / nakit, kişi başı, kim kime borçlu (7/10) | Etsy · Taslak 3 | ÇİZİLDİ-KODDA YOK | aynı |
| 3 | **Hazırlık çekmecesi**: tarihli maddeler, pasaport/Schengen "sor", bavul, bilmen gerekenler (8/10) | Etsy · Taslak 2 | ÇİZİLDİ-KODDA YOK (yalnız Hazırlık bölümü/PrepList var: kısmen) | aynı |
| 4 | **Yolculuk günü kartı**: şehir değişen gün tek kartta (check-out, taksi, uçuş, taksi, check-in); sade A "Tek bilet" | Yolculuk günü · Sade yolculuk günü | ÇİZİLDİ-KODDA YOK; karar kaydı yok | `c-yolculuk-gunu-sade-A-B-C.png`, `c-yolculuk-gunu-gecis-karti.png` |
| 5 | **Günün akışı + günün rezervasyon kartları** iki parçalı gün; hazır gün kapalı ("✓ hazır"); rezerve kart yeşil kalır | Günün akışı ve rezervasyonlar · Rezervasyon kartları | ÇİZİLDİ-KODDA YOK (canlı: tek kompakt satır) | `c-gunun-akisi-ve-rezervasyonlar.png`, `c-rezervasyon-kartlari.png` |
| 6 | **Hero yön C** "Fotoğrafa yerleşen bilgiler" (kutu 6→2) | Hero Fikirleri | ÇİZİLDİ-KODDA YOK; karar kaydı yok | `c-hero-fikirleri-A-B-C.png` |
| 7 | **Sade karşılaştırma**: yalnız farklı satırlar, "Aynı olanları da göster", "Önemleri ayarla" | Karar Panosu #7 | ÇİZİLDİ-KODDA YOK (canlı tabloda hepsi + en iyi işaretli) | `c-karar-panosu-taslagi.png` |
| 8 | **Sırayla karar ver** (her ekranda tek karar, "1/3") | Karar Panosu #10 | ÇİZİLDİ-KODDA YOK | aynı |
| 9 | **★ öncelik** işareti (söylediğin önceliğe dokunan artı/eksi) | Karar Panosu #2+4 | ÇİZİLDİ-KODDA YOK | aynı |
| 10 | **Sohbette seçenek adı tıklanır**, pano karta gider, kart parlar | Karar Panosu #9 | ÇİZİLDİ-KODDA YOK (kodda bulunamadı) | aynı |
| 11 | **Fotoğraflı Gün gün** (gün başına şehir fotoğrafı, "Dünden kalan", Liste/Kartlar) | repo `2026-10-05-gunluk-akis-v3` (artifact'larda yok) | VAZGEÇİLDİ: 12 Ekim `5d5c7a4` (tasarım oturumu v30 satır kararı); kod geçmişte | `2026-10-05-gunluk-akis-v3-bugun.png` (repoda) |
| 12 | Giriş akışında **"Plan taslağı" + ikonlu Gezi önizlemesi** (satır başına ikon) | Gece Raporu · giriş çizimi Karar 6 | VAZGEÇİLDİ (`29b5e74`; yol haritası belgesi bayat) | `c-gece-plan-taslagi-ve-ikonlu-onizleme.png` |
| 13 | **Sekme alt çizgisi kayması** + içeriğin sekme yönünden 12 px kayması | Hareket Dili 1a | ÇİZİLDİ-KODDA YOK (v30 segmentli çift, çizgi yok; `mv-tab` ölü kural; içerik opacity-only) | `c-hareket-sekme-gecisi.png` |
| 14 | **İskelet kart**: kesikli aynı boy kart, ışık, okununca 380 ms oturma + ✓ | Hareket Dili 3a | ÇİZİLDİ-KODDA YOK (yalnız satır üstünden ışık, 1,6 sn %70) | `c-hareket-iskelet-kart.png` |
| 15 | **Arka planda iş**: üstte akan ışık çizgisi, sayaçlı hap, sonda "3 kayıt eklendi ✓" | Hareket Dili 3d | ÇİZİLDİ-KODDA YOK (hap + döner işaret var; çizgi ve son mesaj yok) | `c-hareket-arka-plan-isi.png` |
| 16 | **Bölüm aç/kapa ızgara yöntemi** (0fr→1fr, altındakiler kayar, kapanış da animasyonlu) | Hareket Dili 2 | FARKLI: yalnız belirme `mv-unfold`; kapanış anında; altındakiler zıplar | `c-hareket-bolum-ac.png` |
| 17 | **"Plana koy"**: kart BÖLÜMÜNE uçar, bölüm sayısı 1,35× sıçrar | Hareket Dili 6 | FARKLI: Plan SEKMESİNE uçar, sekme 1,18× | `c-hareket-plana-koy-ucus.png` |
| 18 | **Maskot "Oldu" zıplaması** (900 ms, −5 px, 1,04×) | Hareket Dili 7 | ÇİZİLDİ-KODDA YOK (yalnız güler gözler) | `c-hareket-maskot-5-hal.png` |
| 19 | Kural: **0,4 sn'den kısa işte iskelet/dönen işaret yok**; **aynı anda tek odak**; en çok 2 nabız halkası | Hareket Dili Beş süre/kurallar, 4 | ÇİZİLDİ-KODDA YOK (kodda gecikmeli gösterim ya da sınır yok) | arşiv sayfası |
| 20 | **Boş kart nabzı** 2,4 sn "çok yavaş nefes", kesikli halka | Hareket Dili 4 | FARKLI: 1,4 sn / 7 px (Katmanlı sözlük değeri) | arşiv sayfası |
| 21 | **Pencere/çekmece/gezi→hero süreleri**: çekmece 320/220 ms, hero 600/420 ms | Hareket Dili 1b, 2 | FARKLI: 380/260 ms; 500 ms | `c-hareket-cekmece.png` |
| 22 | **"Bağlanamadım" şeridi** yukarıdan tam iner (−105 %), çözülünce yukarı çekilir | Hareket Dili 5 | FARKLI: −10 px düşme, çıkış anında | arşiv sayfası |
| 23 | Açılış v2: **ipucu yazıları** ("Tıkla, hemen bitsin", "Aşağı kaydır…"), iç vuruş 38 ms, vuruş 95 ms | Açılış v2 | ÇİZİLDİ-KODDA YOK (ipucu, iç vuruş); GAP 80: FARKLI | `acilis-v2` sayfası |
| 24 | Giriş akışı sözlüğü: **"Kart iner"** 600/90 ms ve **"Sayı yukarı kayar"** 450 ms | Giriş Akışı Çizimi · sözlük | ÇİZİLDİ-KODDA YOK | `giris-akisi-v2` |
| 25 | Maskot seçimi: çizim önerisi "Sade küre" ↔ kod "İlk küre"; maskot idle blink 3,4 sn ↔ 3,2 sn | Sihirli Açılış, Hareket Dili 7 | FARKLI; karar kaydı yok | `sihirli-acilis` |

Sayım: 16 ÇİZİLDİ-KODDA YOK (1–10, 13, 14, 15, 18, 19, 24), 7 FARKLI (16, 17, 20, 21, 22, 23, 25), 2 VAZGEÇİLDİ (11, 12). Ek olarak §2.8 mozaik "çizildi, kullanılmadı".

## 4. Hareket Dili: değerlerin canlı kodla satır satır karşılaştırması

Kaynak çizim: `hareket-dili-P2qVN5/index.html` (CSS + JS). Canlı: `static/app.css` (“Hareket dili” bloğu 4157–4255, v46 ekleri 4640–4710), `src/app/{motion,thinking,putFly,exitMotion,Mascot}`, `viewTransition.ts`.

| # | Madde | Çizim değeri | Canlı değer (dosya) | Durum |
|---|---|---|---|---|
| 1 | Süre belirteçleri | 120/180/260/380/600 ms | aynı (`app.css:4160`); `--t-instant` tanımlı, çok az kullanılıyor | CANLI |
| 2 | Eğriler | giriş (.16,1,.3,1), çıkış (.5,0,.75,0), yer (.65,0,.35,1) | aynı (`app.css:4161`) | CANLI |
| 3 | Sekme alt çizgisi kayması | `left/width` 260 ms e-out | v30'da sekmeler segmentli çift, `::after` gizli (`app.css:4265`); `mv-tab` (scaleX .3→1, 260) ölü kural. Hareket Durumu: "kayan kısım yapılmadı", v30 kaldırdı | ÇİZİLDİ-KODDA YOK |
| 4 | Sekme içeriği | eski 120 ms söner (e-in), yeni ±12 px kayarak 260 ms | `mv-fade` 260 ms yalnız opacity (`app.css:4182`; "imleç kaymasın") | FARKLI |
| 5 | Gezi kartı → hero | fly 600 ms (.65,0,.35,1), ana ekran 180 ms söner, geri 420 ms | View Transition `trip-photo` 0,5 sn aynı eğri (`app.css:4184-4185`), geri aynı | FARKLI (500 ↔ 600/420) |
| 6 | Pencere girişi | arka 260 ms; pencere %96→1, 260 ms e-out | `mv-fade` 260; `mv-pop` .96→1 260 (`app.css:4189-4190`) | CANLI |
| 7 | Pencere çıkışı | 180 ms e-in, scale .96 | `exitMotion` kopyası: opacity 180 ms e-in, kart `scale .97` (`app.css:4192-4193`) | FARKLI (.96 ↔ .97, ihmal edilebilir) |
| 8 | Çekmece | giriş 320 ms, çıkış 220 ms, 102 % | `mv-drawer` 380 ms, çıkış 260 ms, 100 % (`app.css:4191,4194`) | FARKLI |
| 9 | Bölüm aç/kapa | `grid-template-rows 0fr→1fr` 260 ms; içerik opacity 180 ms +80 ms gecikme; ok 180° 260 ms; altındakiler kayar | `mv-unfold` opacity+translateY(−6 px) 260 ms +40 ms; ok 260 ms (`app.css:4196-4197`); açık gelen animasyonsuz, **kapanış anında**; ızgara yöntemi yalnız "Neden?" `.pn-detail` .4 sn (`app.css:4651`) | ÇİZİLDİ-KODDA YOK (ızgara yöntemi) / FARKLI |
| 10 | Menü satırları 25 ms arayla | %96, 180 ms, satır gecikmesi 25/50/75 ms | kart menüsü yok (Emre: hayır); profil menüsü `hm-pop` .22 sn tek parça, satır gecikmesi yok (`app.css:2763`) | VAZGEÇİLDİ (kart menüsü) / ÇİZİLDİ-KODDA YOK (satır gecikmesi) |
| 11 | Silince bildirim + geri alma halkası | toast 260 ms giriş/160 çıkış, halka 8 sn; kart yüksekliğiyle kapanır | `UNDO_MS = 8000`, halka `pk-undo-run` (`app.css:4092`), `mv-toast` 300 ms, çıkışta kopya solar; kart "ince satıra" katlanır (`pk-fold` rise 300 ms), yükseklik kapanışı yok | FARKLI (halka ve süre CANLI; "Geri al bildirimi" kart menüsüne bağlı olarak VAZGEÇİLDİ) |
| 12 | Bildirim sinyali hata | `badpulse` 900 ms halka, `stamp` 420 ms (1,8→.92→1), "Tekrar dene" dönen işaret | "Tekrar dene" düğmesi çalışır (`ArriveViews.tsx:81`); dalgalanma ve yeşil mühür dönütü yok | VAZGEÇİLDİ (Emre: hayır) |
| 13 | İskelet kart | kesikli aynı boy kart, ışık 1,3 sn ease-in-out, %85; swap-in 380 ms (−6 px, .98) + ✓ | `ar-pending` üstünden ışık `mv-sweep` 1,6 sn, %70 (`app.css:4212-4214`); iskelet kart ve swap-in yok; kart `ar-in` .32 sn | ÇİZİLDİ-KODDA YOK / FARKLI |
| 14 | Asistan düşünüyor | 3 nokta `dot` 1,1 sn (−3 px, .25→1, gecikme .15/.3); 4 sn "Web'de arıyorum…", 12 sn "Uzun sürüyor…"; maskot work→done→idle | `mv-dot` 1,1 sn, −3 px aynı (`app.css:4173`); satır gerçek duruma bağlı ("Web'de arıyorum…", "Fiyatlara bakıyorum…"), **12 sn** `LONG_WAIT` aynı (`thinking.ts`); done 1,4 sn | CANLI (4 sn eşiği yerine gerçek durum: bilinçli iyileşme) |
| 15 | Fotoğraf buğudan netleşir | 600 ms (.16,1,.3,1), blur 16 px, scale 1.05; hero, gezi kartı, Pano kartları, şehir mini kartı | `mv-blur-up` 600 ms, blur **14 px**, scale **1.04**; yalnız gezi kartı `.vcard`; hero `opacity .5s`; Pano kartı yok (`app.css:4206`, `FallbackImg.tsx`) | FARKLI |
| 16 | Üstte ışık çizgisi | 3 px, %35 genişlik gradient, 1,2 sn | yok (Hareket Durumu: "yapılmadı") | ÇİZİLDİ-KODDA YOK |
| 17 | İş hapı | sağ üst, spin 12 px 0,8 sn, "3→2→1 sayfa okunuyor", "3 kayıt eklendi ✓", .18 sn/−6 px | `work-pill` rise 180 ms, `work-spin` 12 px 0,8 sn aynı (`app.css:4207-4208`); metin "N kayıt işleniyor…" (`TripsHome.tsx:425`), azalır ama bitiş mesajı yok | FARKLI |
| 18 | Boş ekran girişleri | maskot, başlık, açıklama, düğme 60 ms arayla `rise` 380 ms (8 px) | `.trips-empty > *` `mv-rise` 380 ms, gecikme 60/120/180 (`app.css:4228-4231`); Pano `pn-empty` aynı; sleepy/oops maskotlar | CANLI |
| 19 | Boş kartın nabzı | `pring` 2,4 sn, `box-shadow` 6 px rgba(139,116,255,.15), en çok 2 halka, sayfa gizliyken durur | `pk-pulse` **1,4 sn**, 7 px rgba(120,110,160,.16) (`app.css:4124,4128`); halka sınırı yok | FARKLI |
| 20 | Hata şeridi | üstten −105 % 380 ms e-out; çıkış 200 ms e-in, yukarı çekilir; üzgün maskot 30 px | `chat-banner` `mv-drop` 380 ms (−10 px+opacity), maskot oops 30 px (`app.css:4216-4220`, `Chat.tsx:190`); çıkış anında | FARKLI |
| 21 | Internet yok bildirimi | 5 sn geri sayım, "Şimdi dene", kırmızı #3a1526, yeşil #16311f | `OfflineNotice`: `reconnect` `mv-rise` 260 ms, `.bad` #3a1526 aynı, **`.ok` #1d6b48**; geri sayım 5-10-20-30 sn aralık (`reconnect.ts`) | FARKLI |
| 22 | Sallanma | 300 ms (.65,0,.35,1), ±4/3 px, kırmızı #e2789f, mesaj | `mv-shake` 300 ms (.65,0,.35,1), 20/40/60/80 % −4/4/−3/3 px, #e2789f (`app.css:4175,4237`); mesaj "AIza ile başlar, 39 karakter" yok; tetik biçim değil Google denetimi (`Settings.tsx:76-92`) | CANLI (mesaj metni ÇİZİLDİ-KODDA YOK) |
| 23 | "Plana koy" uçuşu | 420 ms (.65,0,.35,1); yay `min(y)−40`, ölçek .9→.6, opaklık →.2; hedef: bölüm; sayı `bump` 380 ms 1,35× (.2,.9,.3,1.3) | `putFly.ts`: 420 ms aynı eğri; yay `−60`, ölçek .85→.4, opaklık →0; hedef **Plan sekmesi**, sekme `scale 1.18` 380 ms aynı eğri; sayı sıçramaz | FARKLI |
| 24 | Mühür | `stamp` 420 ms, 1,8→.92→1 (okundu tiki) | `pk-pop` 0,5 sn (.2,.9,.3,1.3), scale .4→1.18 + rotate (`app.css:4121,4125`); rezerve olunca | FARKLI |
| 25 | Parlama | (Katmanlı sözlük) 1,1 sn halka 10 px | `pk-glow` 1,1 sn, 10 px .6 (`app.css:4122,4126`), `GLOW_MS 1100` | CANLI |
| 26 | Sayaç | 0,6 sn | `useCountUp` 600 ms kübik (`motion.ts`) | CANLI |
| 27 | Yükselme / düşüş | −3 px 180 ms; düşüş 0,55 sn | −3 px (`app.css:4130`); `pk-drop` 0,55 sn (.2,.9,.3,1.2) | CANLI |
| 28 | Maskot Bekler/Düşünüyor | blink 3,4 sn; bob 1,1 sn; bakış 2,2 sn ±1,6 px | blink **3,2 sn**; bob 1,1; bakış 2,2 sn ±**1,5 px** (`app.css:4144-4153`) | FARKLI (ihmal edilebilir) |
| 29 | Maskot Oldu | gözler güler + `hop` 900 ms alternate −5 px, 1,04× | gözler güler (`.happy`), zıplama yok (`app.css:4148-4149`) | ÇİZİLDİ-KODDA YOK |
| 30 | Maskot Olmadı / Bekliyor | oops −6°↔−2° 2,8 sn, yıldız .35; sleepy nefes 3 sn 1,035×, z 3 sn | aynı (`ms-oops 2.8s`, `ms-breathe 3s`, `ms-zz 3s`; `Mascot.tsx`) | CANLI |
| 31 | Azaltılmış hareket | animasyon/geçiş 1 ms; renk-saydamlık kalır; "hızlı iş titremez"; "tek odak" | `animation:none` seçici seçici (`app.css:4247-4255`), JS `reducedMotion()`; **fazladan** "Hareketi duraklat" (`body.still`); 0,4 sn eşiği ve tek-odak kuralı kodlanmamış | CANLI (fazlalıkla) / kurallar ÇİZİLDİ-KODDA YOK |

Özet (31 satır): CANLI 11 (1, 2, 6, 14, 18, 22, 25, 26, 27, 30, 31), FARKLI 13, ÇİZİLDİ-KODDA YOK 3 (3, 16, 29), VAZGEÇİLDİ 1 (12), karma 3 (9, 10, 13). Sayım elle yapıldı, kodla sınanmadı.

## 5. Görsel kanıt

Hareket Dili HTML'i Chromium ile çalıştırıldı (Playwright, "Oynat" düğmeleri; CSS/WAAPI hareketleri 0,1× yavaş çekimde, JS zamanlayıcılı iskelet ve iş hapı gerçek zamanda örneklendi), kareler tek şeride birleştirildi ve tek tek bakıldı:

- `img/c-hareket-sekme-gecisi.png`: alt çizgi kayar, içerik yönünden gelir (canlıda yok)
- `img/c-hareket-bolum-ac.png`: ızgara yöntemiyle bölüm açılışı
- `img/c-hareket-iskelet-kart.png`: iskelet → kart oturması
- `img/c-hareket-arka-plan-isi.png`: ışık çizgisi + hap sayısı düşer + "3 kayıt eklendi ✓"
- `img/c-hareket-plana-koy-ucus.png`: kart bölüme uçar, sayı sıçrar
- `img/c-hareket-maskot-5-hal.png`: 5 maskot + "Oldu" zıplaması
- `img/c-hareket-menu-25ms.png`, `img/c-hareket-cekmece.png`: menü gecikmesi, çekmece
- Statik sayfalar: `c-hero-fikirleri-A-B-C.png`, `c-etsy-ekran-taslaklari.png`, `c-yolculuk-gunu-*.png`, `c-gunun-akisi-ve-rezervasyonlar.png`, `c-rezervasyon-kartlari.png`, `c-karar-panosu-taslagi.png`, `c-gece-plan-taslagi-ve-ikonlu-onizleme.png`, `c-gece-buyuk-fotograf-sahnesi.png`

Yavaş çekim karelerinde zaman etiketi gerçek animasyon zamanıdır; ekran görüntüsü alma gecikmesi nedeniyle ±30 ms oynar.

## 6. Yapılmayanlar / belirsizler

- Karar kaydı bulunamayanlar: Hero yönü (A/B/C), Yolculuk günü seçeneği (A/B/C), Karar Panosu #7–#10, Sade küre/İlk küre, "model sözü her cevaba". Emre'nin kararı gerekir.
- Canlı taraması grep'tir; çalışan uygulamada tek tek açılıp görülmedi (Karar Panosu #9 ve #10 "bulunamadı" demek "kesin yok" demek değildir).
- `docs/urun-yol-haritasi.md:431-433` "Plan taslağı var" ve `StartChat.tsx:8-9` "Yazıyor…" yorumu bayat (önceki envanterde de var).
- Kaynak koda ve mevcut mockup dosyalarına dokunulmadı; commit edilmedi.
