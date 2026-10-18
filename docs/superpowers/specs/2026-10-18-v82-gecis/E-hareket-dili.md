# E · Hareket Dili: canlıdaki envanter ve yeni plan tasarımı (v77–v82) için hareket önerileri

Salt okunur araştırma (18 Ekim 2026). Repo dosyalarına dokunulmadı. Canlı: `/home/user/trip-radar` **0.37.1** (`9f22bae`). Yeni tasarım: `/home/user/wt-v32/docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md` (v77…v82) ve prototip `/home/user/wt-v32/docs/mockups/plan-v82-standart/kaynak/mk82.js`, `mk81.css`, `mk82.css`.

Kısaltmalar: `app.css` = `static/app.css`; TS yolları `src/app/` altında. Belirteçler: `--t-instant` 120 ms, `--t-quick` 180, `--t-base` 260, `--t-slow` 380, `--t-story` 600; `--e-out` (.16,1,.3,1) giriş, `--e-in` (.5,0,.75,0) çıkış, `--e-move` (.65,0,.35,1) yer değiştirme. "Yay" = zıplayan eğri. **★ = önerim.**

---

## 0. Önce bunlar (bulgular)

1. **Canlıdaki hareket dili altı katmandan oluşuyor:** (a) belirteçler ve ilkeler (`app.css:4214-4237`); (b) "altı hareketlik sözlük" (`motion.ts`, `app.css:4175-4192`); (c) aşama geçişi K29 (`app.css:4724-4745`); (d) F8b Hareket Dili, yani Emre'nin m-* kararları (`hareketDili.ts`, `app.css:5208-5262`); (e) sihirli açılış (`opening.ts`); (f) görünüm geçişleri (`viewTransition.ts`). Hepsi `reducedMotion()` ya da F8 durdurma blokları (`app.css:4746-4774`) ile kapanıyor.
2. **"Hareketi duraklat" görünüm geçişlerini durdurmuyor.** `viewTransition.ts:18-20` (`canTransition`) yalnız `prefers-reduced-motion`'ı okuyor, `reducedMotion()`'ı değil. `body.still *` kuralları da `::view-transition-*` sözde öğelerine ulaşmıyor (bu öğeler `html`'de, `body`'nin içinde değil). Sonuç: Ayarlar'da duraklat açık olsa bile kart fotoğrafının hero'ya geçişi (600/420 ms) ve başlangıç geçişi (620 ms) oynuyor. Bu bir karar değil, kod açığı (§5).
3. **Etkisiz kalmış kurallar:** `.cat-body.mv-unfold` (`app.css:4257`) hiçbir bileşen tarafından verilmiyor; m-bolum ızgara yöntemi yerini aldı. `.view-tabs button.on::after { animation: mv-tab … }` (`app.css:4240`) aynı dosyanın 4326. satırında `display:none` ile gizleniyor; yerini m-sekme'nin kayan vurgusu aldı. `--t-instant` CSS'te tanımlı ama hiçbir yerde `var(--t-instant)` yok, 120 ms yalnız JS'te geçiyor (`GHOST_MS`). Maskotun `wink` hali de ölü kod (Emre: "kalsın").
4. **Testin başlığı bayat:** `tests/hareketDili.test.ts:29` "shut at once" diyor. Oysa `useFold` kapanırken de oynuyor (`motion.ts:206-208`) ve m-bolum kararı "kapanış da animasyonlu".
5. **`docs/envanter/02-hareket-ve-sohbet.md` 0.36.84'e göre yazılmış.** Şu satırlar artık eski: §1.3'teki değerler (parlama artık 1,1 sn / 10 px, nabız 2,4 sn, yükselme −3 px, mühür artık büyükten basılıyor); P4 (Plana koy artık bölüm sayısına uçuyor); K18 (bölüm artık ızgara ile açılıyor); P1 (sekme artık kayan vurgu); W3 (çekmece 380 değil 320/220 ms).
6. **Prototip (v77–v82) neredeyse hiç hareket içermiyor.** Durumlar `hidden` ile anında değişiyor. Hareket olarak yalnız şunlar var: `q-flash` 1,1 sn mor halka (seçince ve "›" ile gidince, `mk81.css:175-176`), yapışkan mini şerit 0,2 sn solma + 8 px (`mk81.css:521-522`), ok dönüşü 0,2 sn, ilerleme çubuğu 0,3 sn, kart üzerine gelince 0,18 sn ve yumuşak kaydırma. Bildirim (toast), Pano, Ayrıntı, ⋯ menü ve hero pencereleri anında açılıp kapanıyor. Azaltılmış harekette hepsi kapalı (`mk81.css:239`). **Yani yeni tasarımın bütün hareketleri hâlâ açık birer karar.**
7. **Yeni tasarımın en büyük kazancı sabit boy çerçeve.** Niyet kutusunun içinde artık yükseklik animasyonu gerekmiyor; her durum geçişi aynı çerçevede içeriklerin çapraz geçişine iniyor. Bu, Hareket Dili'nin "kutunun boyu ya da yeri oynamaz" ilkesine canlıdakinden daha iyi uyuyor (§3).

---

## 1. Canlıdaki hareket dilinin envanteri (0.37.1)

Sütunlar: Ad · Tetikleyici · Süre/eğri · Nerede · Azaltılmış harekette (sistem tercihi ve "Hareketi duraklat") · Emre kararı.

### 1.1 Belirteçler ve genel kurallar

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| A1 | Beş süre, üç eğri; çıkış girişten hızlı; yalnız saydamlık, dönüşüm ve ışık hareket eder | — | 120/180/260/380/600 ms; e-out, e-in, e-move | `app.css:4214-4220`; çizim `docs/mockups/artifact-arsivi/hareket-dili-P2qVN5` "İlkeler" | — | m-kurallar: çizime uy |
| A2 | `reducedMotion()` ve "Hareketi duraklat" | sistem tercihi ya da Ayarlar'daki anahtar (`trip-radar:still`) | — | `motion.ts:14-47`, `Settings.tsx:243-246`, `main.tsx:16`; CSS'te iki kez yazılı (`@media` ve `body.still`), `app.css:4746-4774` | Her şey .01 ms'ye iner. Geri al halkası işlevsel olduğu için döner. Bilet çerçevesinin renk geçişi (.4 s) kalır | v45 §4(c) |
| A3 | 0,4 sn kuralı (`useLate`): hızlı biten iş titremez | her bekleme | 400 ms dolmadan iskelet, dönen işaret ya da üç nokta yok | `motion.ts:155-171`; `WorkPill.tsx:13,30`, `OfflineNotice.tsx:10`, `arrive/ArriveViews.tsx:56,146`; `.thinking` 400 ms gecikme `app.css:5254` | Bu bir zamanlama kuralı: azaltılmışta da geçerli | m-kurallar |
| A4 | Tek odak | açık pencere, çekmece ya da karşılaştırma | arkadaki nabız, canlı nokta ve arama çubuğu duraklar | `app.css:5256` | — | m-kurallar |
| A5 | Ekranda en çok 2 nabız | ekrandaki nabız halkaları, sayfa sırasıyla | 3. ve sonrası `data-np` alır, kıpırdamaz | `hareketDili.ts:20-22,178-221`; `app.css:5255` | — | m-kurallar |
| A6 | Nabız faz kayması | çok sayıda boş kart | −0,8 / −1,6 sn gecikme (kartlar aynı anda yanıp sönmesin) | `app.css:4700-4701` | — | v45 F8 |

### 1.2 Geçişler

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| B1 | **m-sekme kayan vurgu** | Plan \| Pano ve Kategoriye göre \| Yolculuk \| Gün gün sekmeleri | vurgunun konumu ve boyu 260 ms, e-out; yeniden çizilen sekme listesi son konumdan başlar | `hareketDili.ts:12,67-150`; `app.css:5220-5223` | vurgu yerine anında geçer (`app.css:4765`) | m-sekme: "kayan vurgu olarak uyarla; çizgi ekleme" |
| B2 | Görünüm geçişi | aynı | Eski görünümün hareketsiz kopyası (kapalı gölge ağacında) 120 ms, e-in ile 8 px kayarak söner. Yeni görünüm seçilen sekmenin yönünden 12 px, 260 ms, e-out ile gelir (`mv-tab-in`, `--tab-dir`) | `hareketDili.ts:14-18,100-137`; `app.css:4230,4241` | kopya yok, giriş yok | m-sekme |
| B3 | Eski alt çizgi `mv-tab` | — | 260 ms | `app.css:4240` (4326'da `display:none`) | — | etkisiz (bulgu 3) |
| B4 | Gezi kartının fotoğrafı hero'ya büyür, dönüşte küçülür | Seyahatlerim → gezi ve geri | 600 ms / dönüş 420 ms, e-move; ekranın kalanı .22/.42 sn çapraz geçer | `viewTransition.ts:37-80`; `app.css:4243-4245, 2876-2877`; `App.tsx:232,282` | anında; ama yalnız sistem tercihi okunuyor (bulgu 2) | m-cekmece: "hero 600/420" |
| B5 | Giriş kutusu sohbetin ilk mesajına akar, yan panel kayarak gelir | Enter, "Planlamaya başla" | 620 ms e-out; yan panel 700 ms, 80 ms gecikmeyle, 56 px | `app.css:2876-2885`; `App.tsx:266-285` | anında | teyit: canlıdaki gibi kalsın |
| B6 | Karta git ve parla | "Sıradaki", sohbet çipi, "Plan'da gör" | yumuşak kaydırma (ortaya) + `flash` 1,6 sn, 3 px halka | `Progress.tsx:12-15`; `app.css:819-821` | 3 px'lik sabit kenar | — |

### 1.3 Aç / kapa

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| C1 | Pencere açılışı | `.modal`, `.overlay`, `.compare-modal`, `.pk-sheet-back` | arka perde 260 ms e-out ile kararır; pencere %96'dan büyür (260 ms) | `app.css:4249-4250` | yok | çizime uy |
| C2 | Pencere kapanışı (çıkış kopyası) | pencere sayfadan kaldırıldığı an | hareketsiz kopya 180 ms, e-in ile söner; kart %97'ye küçülür; kopya 320 ms sonra kalkar | `exitMotion.ts:9-38`; `app.css:4252-4253`; `main.tsx:18` | kopya yapılmaz | çizime uy |
| C3 | Çekmece | `.drawer` (Tüm detaylar, Geçmiş) | sağdan kayarak 320 ms e-out gelir, 220 ms e-in ile gider (%102) | `app.css:4251,4254` | yok | **m-cekmece: 320/220 ms** |
| C4 | **Bölüm aç/kapa** | bölüm başlığı | Izgara satırları 0fr↔1fr, 260 ms e-out. Kartlar 180 ms'de belirir, açılışta 80 ms geç gelir. Kapanış da oynar: gövde 280 ms daha çizili kalır. Ok 260 ms'de döner. Plan açılırken zaten açık olan bölüm anında görünür | `motion.ts:173-211`; `plan/Section.tsx:48,97-100`; `app.css:4256, 5226-5231` | anında | **m-bolum: ızgara yöntemi, kapanış da animasyonlu; yalnız bölüm başlığı, kart aç/kapaya dokunma** |
| C5 | Eski bölüm belirişi `mv-unfold` | — | — | `app.css:4257` | — | etkisiz (bulgu 3) |
| C6 | Kartın arka yüzü (seçenekler) | karta ya da "N alternatif"e basınca, Değiştir | Açılış: `ch-flip` 380 ms e-out, `rotateY(-80°)`, saydamlık .2'den 1'e, eksen üst ortada. Kapanış: 180 ms e-in (`CLOSE_MS` 190) | `app.css:5003-5009`; `cards/BackFace.tsx:37,133-140` | yok | "v46'da kart aç/kapa iyiyse ona dokunma" |
| C7 | Pano "Neden?" açılışı | basış | ızgara 0,4 sn e-out; ok 0,3 sn | `app.css:4712-4715` | geçiş yok | v45 §4 #8 (yükseklik animasyonunun tek istisnası) |
| C8 | × ile katlanan satır | × | `mv-rise-s` 300 ms, 6 px | `app.css:4707` | yok | v45 §4(b) |
| C9 | Geri al bildirimi | silme ya da gizleme | 300 ms'de 20 px yükselir; halka 8 sn (`UNDO_MS`, işlevsel); kapanışı çıkış kopyasıyla 180 ms | `app.css:4709,4147`; `cards/UndoToast.tsx:18`; `exitMotion.ts:9` | giriş yok, halka döner | Hareket Durumu: menü ve geri al için "hayır"; girişi sonra v45 §4(b) #14 ile eklendi |
| C10 | Kart menüsü ••• | basış | hareket yok, anında | `app.css:1564` | — | **m-menu: "Kodda şimdiki gibi KALSIN"** (satırların 25 ms arayla gelmesi yok) |
| C11 | Profil menüsü | avatar | `hm-pop` .22 sn, 6 px yukarıdan, %97'den | `app.css:2800` | yok | — |
| C12 | Yapışkan şerit | hero ekrandan çıkınca | tepeden iner, .22 sn `ease` (belirteç dışı) | `app.css:4116-4117`; `StickyBar.tsx:54` | yok (`app.css:4126`) | — |
| C13 | İpucu (`HoverTip`) | üzerine gelme, odak, dokunma | `tipx-in` .14 sn, 4 px; 140 ms gecikmeyle kapanır; büyük öğelerde açılış gecikmeli | `app.css:4095-4099, 4670`; `HoverTip.tsx:40-48,135-155` | yok | — |
| C14 | Kartın araç şeridi, "Kendin ara" adı | üzerine gelme | .16 sn; ad .22 sn'de açılır | `app.css:4158-4170` | yok | — |

### 1.4 Kart sözlüğü ve aşama geçişi

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| D1 | **Mühür** | kart rezerve olur (yalnız false→true, açılışta değil) | `mv-stamp` 420 ms, yay (.2,.9,.3,1.3): 1,8 → ,92 → 1 (büyükten basılır) | `app.css:4176,4181,4908`; `cards/PlanCard.tsx:203` (`useJustBecame` 600 ms) | yok | **m-sert: mühür büyükten basılır** |
| D2 | Parlama | kartın verisi değişir (`updatedAt`) | `pk-glow` 1,1 sn, 10 px halka | `app.css:4178,4182`; `motion.ts:9,50-68`; `PlanCard.tsx:204` | yok | v45 §4(a): çizime göre |
| D3 | Düşüş | sohbet karta ekler (en çok 4 sn önce, bir kez) | `pk-drop` .55 sn, −14 px ve %96'dan | `app.css:4179,4183`; `motion.ts:104-108`; `PlanCard.tsx:209` | yok | v45 §4(a) |
| D4 | **Nabız** | boş kartın açık ya da yarım halkası; aranan bilet çerçevesi | `pk-pulse` 2,4 sn, 6 px | `app.css:4180,4184`; `hareketDili.ts:22` | yok | **m-nabiz: 2,4 sn** |
| D5 | Yükselme | tıklanabilir kartın üzerine gelme | −3 px, .18 sn | `app.css:4185-4186`; Pano kartı 3423 | yok | v45 §4(a) |
| D6 | Sayaç | para rakamı değişir (ilk görünüşte değil) | 600 ms, kübik ease-out; sayarken rakamlar eşit genişlikte | `motion.ts:118-153`; `Counted.tsx:5-8`; `TripFacts.tsx:177,187` | anında | — |
| D7 | **Aşama geçişi (K29)** | Seçildi ya da Rezerve olur | Kart `pk-stage-glow` 1,6 sn, halka 0 → 6 → 14 px. Biletteki uçak 1,1 sn'de kalkar, logo .7 sn'de düşer, etiket ve durum .5 sn yayla zıplar | `app.css:4728-4738`; `motion.ts:91-94`; `PlanCard.tsx:208` | yok | v45 F8c |
| D8 | İndi | taslak ("Önerimiz") gelir ya da değişir | 1,1 sn; halka 9 px, %1,5 şişme | `app.css:4734,4742`; `PlanCard.tsx:206` | yok | v45 P7 |
| D9 | Uçağın rotaya süzülmesi | bilet ilk çizildiğinde (oturumda bir kez) | .9 sn, 18 px | `app.css:4732,4739`; `motion.ts:112-116`; `cards/FlightTicket.tsx:90` | yok | v45 #3 |
| D10 | Canlı nokta | "Canlı" uçuş etiketi | 1,6 sn; halka 4 → 7 px | `app.css:4740` | yok | v45 #4 |
| D11 | Bilet çerçevesinin renk geçişi | aşama değişir | kenar ve zemin .4 sn | `app.css:4744` | **kalır** (renk hareket sayılmaz) | ilke (A1) |
| D12 | Aranıyor çubuğu | bilet ya da seçenek kutusu aranırken | `tk-shimmer` 1,4 sn | `app.css:4910-4912` | yok | — |
| D13 | Kalp (Pano) | basış | .25 sn yay; basılıyken %88 | `app.css:4711,3431` | yok | v45 §4(b) |

### 1.5 Yükleniyor

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| E1 | **İskelet kart** | link okunurken (400 ms sonra) | Kesik çizgili iskelet, üstünden 1,3 sn'de ışık geçer. Gerçek kart 380 ms'de yerine oturur (`mv-swap-in`: −6 px ve %98'den), ardından 1,5 sn halka | `app.css:2700, 5236-5242`; `arrive/ArriveViews.tsx:56` | ışık yok; `ar-new` yerine 2 px'lik sabit kenar (`app.css:4770`) | **m-iskelet: çizime uy** |
| E2 | Tik damgası | okunan kart ekrandaysa | `mv-tick` 420 ms yay; 1,3 sn kalır | `hareketDili.ts:230-245`; `arrive/useArrivals.tsx:145`; `app.css:5243` | yok | m-iskelet |
| E3 | **Işık çizgisi ve "N kayıt eklendi ✓"** | arka planda kayıt işlenir | Üstte 3 px'lik ışık 1,2 sn'de akar (e-move). Hap "N kayıt işleniyor…" der (işaret 0,8 sn döner), sonunda "N kayıt eklendi ✓" deyip 2,2 sn'de söner | `WorkPill.tsx:9-68`; `app.css:4267-4268, 5246-5250` | çizgi sabit ve soluk; işaret 2,4 sn'de döner | **m-isik: çizime uy** |
| E4 | Düşünüyor | sohbette cevap beklenir | üç nokta 1,1 sn; satır 400 ms sonra çıkar; 12 sn sonra "Uzun sürüyor…" | `thinking.ts:10-25`; `app.css:4260-4265, 5254` | noktalar 2,4 sn'de oynar | — |
| E5 | Fotoğraf buğudan netleşir | gezi kartının fotoğrafı yüklenince | `mv-blur-up` 600 ms e-out; 16 px buğu, %105'ten | `app.css:4234,4266` (yalnız `.vcard`) | yok | testte 16 px / 1,05 sabitlendi |
| E6 | Hero blokları bilgi geldikçe belirir | boş başlayan blok dolunca | `hx-appear` .3 sn, 4 px | `useAppear.ts:7-11`; `app.css:1139-1141`; `TripHero.tsx:131-132`, `TripFacts.tsx:51-53,135`, `Travellers.tsx:49`, `IntentCard.tsx:195` | yok | hero v9 |
| E7 | Bekleyen link satırında ışık süpürmesi | okunmayı bekleyen satır | 1,6 sn | `app.css:4272-4274` | yok | — |

### 1.6 Boş ekranlar ve maskot

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| F1 | Seyahatlerim boş | hiç gezi yok | maskot, başlık, açıklama ve düğme 60 ms arayla yükselir (380 ms) | `app.css:4289-4292` | yok | Hareket Dili Soru 2: boş ekranda maskot evet |
| F2 | Pano boş | kayıt yok | uyuyan maskot (3 sn nefes, "z") + 380 ms yükselme | `app.css:4294, 4306` | yüz kıpırdamaz | aynı |
| F3 | **Maskotun halleri** | Bekler: 3,2 sn'de bir göz kırpar. Düşünüyor: 1,1 sn salınır, gözleri 2,2 sn gezinir. **Oldu: 900 ms zıplar (5 px, %104, gidip gelir), 1,4 sn sürer.** Olmadı: başı eğik (2,8 sn) | `Mascot.tsx:8-49`; `thinking.ts:12,21`; `Chat.tsx:186`; `app.css:4200-4212, 4302-4306` | yüz hareketsiz | **m-maskot: 'Oldu' zıplaması çizime uy**; sil-wink: kalsın |

### 1.7 Hatalar

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| G1 | **"Asistana bağlanamadım" şeridi** | sohbette düzeltilebilir hata | 380 ms'de iner (−%105). Sorun çözülünce kopyası 200 ms'de, e-in ile yukarı çekilir ve altındaki takip eder | `Chat.tsx:189-195`; `hareketDili.ts:24-25,152-176`; `app.css:4276-4281, 5259` | yok | **m-sert: şerit −%105 iner ve çekilir** |
| G2 | **"İnternet yok · N sn sonra tekrar deniyorum"** | kayıt gönderilemedi | sağ altta 260 ms'de yükselir; geri sayar; "Kaydedildi ✓" deyince yeşile (#16311f) döner (renk 260 ms) | `OfflineNotice.tsx:7-42`; `reconnect.ts`; `app.css:4283-4286` | giriş yok; renk kalır | **m-sert: yeşil #16311f** |
| G3 | Yanlış anahtar | Ayarlar | `mv-shake` 300 ms, 4 px | `app.css:4231, 4298` | sallanmaz; kırmızı kalır | — |
| G4 | Sohbetteki hata satırı | genel hata | 180 ms'de yükselir | `app.css:4297` | yok | — |

### 1.8 Küçük dönütler ve açılış

| # | Ad | Tetikleyici | Süre / eğri | Nerede | Azaltılmış | Emre kararı |
|---|---|---|---|---|---|---|
| H1 | **"Plana koy" uçuşu** | "Plana koy / Plana ekle / Add to plan" düğmesi | Kartın adını taşıyan çip yay çizerek uçar: 420 ms, e-move, ortada 40 px yukarıda, boyu %90'dan %60'a iner. Vardığı bölümün sayısı (`.cat-n`) 380 ms'de 1,35 kat sıçrar (yay). Bölüm görünmüyorsa Plan sekmesine ya da şeritteki Plan düğmesine uçar; o düğme 1,18 kat sıçrar | `putFly.ts:9-76`; `app.css:4270`; `main.tsx:20` | hiç yok | **m-planakoy: çizimdeki gibi bölüme uçsun, bölüm sayısı sıçrasın** |
| H2 | Basınca küçülme (%97) | düğmeye basış | çizimde her düğmede 120 ms; kodda yalnız birkaçında (`.st-go` %98, `.st-gen-btn` %98,5, kalp %88) | `app.css:2830, 2990, 3431` | — | karar kaydı yok |
| I1 | **Sihirli açılış B · Ritim ve sayaçlar** | gezinin Plan'ı (Pano'su ayrıca) bu tarayıcıda ilk kez açılınca, gezi başına bir kez | Parçalar 80 ms arayla gelir, sonuncusu en geç 450 ms'de başlar; her biri 300 ms'de 8 px yükselir (.2,.8,.2,1). Sayaçlar 520 ms'de, çubuklar 600 ms'de dolar. Alttakiler kaydırınca 45 ms arayla gelir. Dokunuş ya da tuş hemen bitirir | `opening.ts:21-30, 88-97, 258-393`; `TripPanel.tsx:133-134` | hiç oynamaz | acilis-v2 B; **m-acilis: ipucu yazıları, "Kart iner", "Sayı yukarı kayar" EKLENMESİN** |
| I2 | Orb, kıvılcım ve ışıltı | açılışla birlikte | toplam 900 ms: orb 260 ms'de kenara gider, 14 kıvılcım 600 ms, ışıltı 560 ms | `opening.ts:32-39, 156-244` | yok (`app.css:5120`) | **r-acilis: GERİ GELSİN** |
| I3 | Diğer | sohbet mesajı 260 ms'de 6 px yükselir (`app.css:4708`); ana ekran girişleri `hm-rise` .7 sn; giriş kutusunda dönen örnek cümleler 9 sn (`phc`, `app.css:4706,4720`) | | | yok | v45 §4(b) |

Testler: `tests/hareketDili.test.ts` (m-sekme, m-bolum, bekleme kuralları, maskot, çekmece, hero, Plana koy, şerit, tik damgası), `tests/motion.test.ts` (sözlük değerleri, K29, duraklat), `tests/reducedMotion.test.ts` (her animasyonlu kuralın durdurma karşılığı var mı), `tests/exitMotion.test.ts`, `tests/viewTransition.test.ts`, `tests/putFly.test.ts`. `DESIGN.md`'de hareket için tek cümle var (`DESIGN.md:51-53`, `hx-appear`); asıl kaynak çizim, kod yorumları ve bu testler.

---

## 2. Yeni tasarım (v77–v82) için hareket önerileri

### 2.0 Mevcut dilden türetilen sekiz kural

Aşağıdaki önerilerin hepsi bu kurallardan çıkıyor:

1. **Sabit çerçevede içerik değişiyorsa çapraz geçiş yapılır.** Eski içerik 120 ms'de e-in ile söner, yeni içerik 260 ms'de e-out ile 4–6 px kayarak gelir. Yükseklik animasyonu yok (m-sekme'nin çerçeve içine uyarlanmış hali).
2. **Kaynak görünüyorsa taşı, görünmüyorsa vardığı yerde parlat.** Görünen kaynaktan taşıma 380–420 ms, e-move. Kaynak görünmüyorsa vardığı kart parlar (`pk-glow` 1,1 sn). Bu, çizimin tezindeki "nereden nereye gittiğini göstermek"tir.
3. **Durum = renk + tek küçük vurgu.** Zemin, kenar ve nokta rengi 400 ms'de değişir (D11 gibi, azaltılmışta da kalır). Durum çipi .5 sn zıplar (K29). Mühür yalnız Alındı'da basılır.
4. **Geri adım sessizdir.** Seçimi kaldırmak, Alındı'yı geri almak ya da Vazgeç: yalnız çapraz geçiş ve renk değişir; parlama, mühür ve zıplama olmaz. Canlıda da `useJustBecame` ve `useStageChange` yalnız ileri adımda tetikleniyor.
5. **Tek odak.** Bir eylemde tek ana hareket olur, gerisi yalnız renk değiştirir. Pencere ya da katman açıkken arkadaki her şey durur (A4).
6. **Açılan, kapanandan yavaştır:** 260/180, çekmece 320/220, fotoğraf 600/420.
7. **0,4 sn kuralı:** 400 ms'den kısa süren beklemede hiçbir bekleme işareti çıkmaz.
8. **Sürekli hareket yalnız "bekliyoruz" demektir** (nabız, ışık). Ekranda en çok 2 nabız olur. Azaltılmış harekette kayma ve zıplama yoktur; renk ve saydamlık durumu kalır. Parlamanın yerini kısa süreli sabit bir kenar alır (canlıdaki `.flash` ve `.ar-new` azaltılmış karşılıkları gibi).

---

### 2.1 Kategori aç/kapa (akordiyon: biri açılınca diğeri kapanır, açılan üste kayar)

*Prototipte:* `.q-sec.open` anında açılıyor, diğeri anında kapanıyor; 20 ms sonra `scrollIntoView` yumuşak kaydırma yapıyor (`mk82.js:221-223`); ok 0,2 sn'de dönüyor.

- **Öneri:** Tıklanan bölüm m-bolum ile birebir açılır: ızgara satırları 260 ms e-out, kartlar 80 ms gecikmeyle 180 ms'de belirir, ok 260 ms'de döner. Kendiliğinden kapanan diğer bölüm de aynı anda m-bolum'un kapanışıyla katlanır (kartlar önce söner). Kapalı satırdaki mini görseller ve "n karar" yazısı (prototipte `visibility:hidden`) 120 ms'de söner, açılınca geri gelir. Açık bölümün gölgesi 260 ms'de belirir.
- **Kaydırma (E-1):** Üstteki bölüm kapanınca açılan bölüm yukarı sıçrar ve aynı anda bir de kaydırma başlar. Bu iki hareket üst üste biner. Önce kaybolan yükseklik kadar kaydırma telafi edilir (görünmez), sonra tek bir kaydırma yapılır.
- **Süre/eğri:** 260/180 ms; kaydırma 380 ms, e-move. Tarayıcının yumuşak kaydırmasının süresi ayarlanamıyor; bu yüzden kaydırma `requestAnimationFrame` ile elle yapılır.
- **Bağ:** AYNI (m-bolum) + UYARLAMA (akordiyon ve kaydırma).
- **Azaltılmış:** anında açılır ve kapanır; kaydırma anında olur; gölge anında görünür.
- **KARAR E-1:** Açılan bölüm üste kaysın mı?
  - (a) Kaymasın: başlık parmağın altında kalır, yalnız yükseklik kaybı telafi edilir (açılış ilkesi H5 "panel kendiliğinden kaymaz" ile uyumlu).
  - **(b) ★ Kaysın ama tek hareketle:** önce telafi edilir, sonra başlık 380 ms'de e-move ile üste gelir. Başlık zaten ekranın üst dörtte birindeyse kaymaz. Bu, v78'de istenen "açılan üste kayar"ın sıçramasız hali.
  - (c) Yalnız açılan gövde ekrana sığmıyorsa, gereken kadar kaysın.
- **KARAR E-2:** Açık başlık büyüsün mü? Prototipte açılınca başlık 18'den 22 px'e, ikon 46 px'e büyüyor, iç boşluk da değişiyor (`mk81.css:421-423`). Bu yerleşimi oynatır ve sabit 78 px satır kuralıyla çelişir.
  - **(a) ★ Büyümesin:** açık ve kapalı başlık aynı boyda olsun; açık bölüm gölge ve ok yönüyle ayrılsın.
  - (b) Büyüsün, ama anında.
  - (c) Büyüsün, 260 ms'de `scale` ile (yazı bulanıklaşabilir).

### 2.2 Niyet kutusu durum değişimi (Karar bekliyor → Önerimiz → Seçildi → Alındı)

Kutunun dört parçası birlikte değişir: (1) zemin ve kenar (kesik → kum → mor → yeşil), (2) sabit gövde (196 px), (3) durum çizgisindeki nokta, (4) durum çipi (`q-st`).

- **Zemin ve kenar:** renk 400 ms'de geçer (D11 ile aynı); azaltılmışta da kalır. Kesik çizgiden düz çizgiye geçiş animasyona uygun değil; kenar türü anında değişir, rengi geçer.
- **Gövde:** kural 1'deki çapraz geçiş (eski 120 ms söner, yeni 260 ms gelir). Kutu büyümez (§3).
- **Nokta:** iki katman olarak çizilir: kesik halka ve içte dolu daire. Durum değişince iç daire 260 ms'de e-out ile sıfırdan büyüyüp dolar, rengi 400 ms'de geçer. Alındı'da halo (3 px) 260 ms'de belirir. Nokta zıplamaz: tek odak karttadır. (YENİ: "nokta dolar")
- **Durum çipi:** metin değişir; ileri adımda çip .5 sn yayla zıplar (aynı: `.pk-stage .pk-state`).

| Geçiş | Gövde / kart | Nokta | Çip | Kenar / zemin |
|---|---|---|---|---|
| Aranıyor → Karar bekliyor (seçenekler geldi) | 2.20'deki gibi seçenekler gelir | kesik kalır | metin değişir, zıplamaz | — |
| Karar bekliyor → Önerimiz (AI seçti) | çapraz geçiş, ardından kartta **İndi** (1,1 sn, 9 px; canlıda taslak kartı için) | mor dolar | zıplar | mor |
| Önerimiz → Seçildi ("Bunu seç") | aynı seçenek yerinde kalır; yalnız yan sütun çapraz geçer ("Bunu seç" yerine "Rezerve et · Aldım · Değiştir"); kartta **K29 parlaması** (1,6 sn) | kum dolar | zıplar | kum |
| Karar bekliyor → Seçildi ("Seç") | 2.3 | kum dolar | zıplar | kum; kesik → düz |
| Seçildi → Alındı ("Aldım") | 2.5 | yeşil dolar + halo | zıplar | yeşil |
| Seçildi → başka seçenek seçildi | çapraz geçiş + **parlama** 1,1 sn ("kart değişti") | — | — | — |
| herhangi → Ayarlandı | çapraz geçiş | gri | zıplar | gri |
| herhangi → Gerek yok | 2.7 | soluk | metin değişir | soluk |
| geri adımlar | yalnız çapraz geçiş | renk değişir | metin değişir | renk değişir |

- **Bağ:** AYNI (K29, İndi, parlama, bilet renk geçişi) + UYARLAMA (çerçeve içi çapraz geçiş) + YENİ (nokta dolar).
- **Azaltılmış:** içerik anında değişir; renkler 400 ms'de geçer; parlama yerine 1,6 sn'lik 2 px sabit kenar.
- **KARAR E-3:** Sabit çerçevede içerik nasıl değişsin?
  - **(a) ★** Eski içerik 120 ms'de söner, yeni 260 ms'de 4 px kayarak gelir (sekme kuralının çerçeve içi hali).
  - (b) Yalnız yeni içerik gelir: 380 ms, iskeletteki "yerine oturur" (`mv-swap-in`); eski anında gider.
  - (c) Anında değişsin; yalnız renk, çip ve nokta hareket etsin.

### 2.3 Seç (seçenekten seçili karta)

*Prototipte:* seçenekler gizlenir, seçili form görünür, `q-flash` 1,1 sn oynar, kutu görünür alana kaydırılır ve "Seçildi" bildirimi çıkar (`mk82.js:107`).

- **Öneri:** Seçilen seçenek kutusu (üçte bir genişlik ya da Skyscanner satırı) çerçeveyi dolduran seçili karta ya da bilete dönüşür. Bu bir paylaşılan öğe geçişidir: 380 ms, e-move. Diğer iki seçenek 120 ms'de söner. Bitince çip zıplar, nokta dolar. Kaynak görünür olduğu için bu yolda **K29 parlaması oynamaz** (kural 2 ve 5). Bilette K29'un uçak kalkışı (1,1 sn) kalır, çünkü uçak biletin parçası; parlama yine oynamaz.
- **Uygulama yolu:** canlıdaki `withTransition` / View Transitions (fotoğraftan hero'ya geçişle aynı mekanizma), seçilen kutuya ve hedef karta geçici `view-transition-name` verilerek. Ekranın kalanı çapraz geçmemeli; yalnız adlandırılmış öğe hareket eder. Tarayıcı desteklemiyorsa (b)'ye düşülür.
- **Seç başka yerden geldiyse** (Pano, Yolculuk sırasıyla, sohbet): kaynak görünmez, bu yüzden kutu vardığı yerde K29 parlamasıyla parlar (aynı).
- **Bağ:** UYARLAMA (B4 fotoğraf → hero mekanizması; "Plana koy"un "nereden nereye" anlamı).
- **Azaltılmış:** anında; renkler geçer; 1,6 sn'lik sabit kenar.
- **KARAR E-4:** Seç hareketi:
  - **(a) ★** Seçilen kutu çerçeveyi doldurarak seçili karta dönüşür (380 ms, e-move).
  - (b) Seçenekler söner, seçili kart yerine oturur (380 ms) ve K29 parlaması oynar.
  - (c) Yalnız K29 parlaması; içerik anında değişir.
- **KARAR E-17:** Seçince bildirim çıksın mı?
  - **(a) ★** Hayır: çip, nokta ve hareket söylüyor; bildirim aynı şeyi ikinci kez söyler (tek odak).
  - (b) "Seçildi · Geri al" (canlıdaki geri al bildirimi: 300 ms giriş, 8 sn halka).
  - (c) Prototipteki gibi 2,4 sn'lik bilgi bildirimi.

### 2.4 Değiştir (seçili kart yerinde seçeneklere döner, Vazgeç)

*Prototipte:* `chg` sınıfı; aynı yükseklikte "Başka bir seçenek seç", şu anki seçenek yeşil çerçeveli ("Seçili"), Vazgeç düğmesi; geçiş anında.

- **Öneri:** v82'nin "kart yerinde seçeneklere döner" tarifi canlıdaki arka yüzün tam karşılığı. Kart çevrilir: `ch-flip` 380 ms, e-out, eksen üst ortada. Fark şu ki artık komşunun üstüne binmeye gerek yok, çevirme sabit çerçevenin içinde olur (§3.3). Şu anki seçeneğin yeşil çerçevesi sabittir.
  - **Vazgeç:** ters çevirme, 180 ms e-in (aynı `ch-flip-out`); renk değişmez, sessiz geri adım.
  - **Başka seçenek seçilirse:** geri dönüş 180 ms, ardından yeni seçili kart parlar (1,1 sn; "kart değişti"). Durum yine "Seçildi" olduğu için çip zıplamaz.
- **Bağ:** AYNI (C6; Emre: "kart aç/kapa iyiyse dokunma").
- **Azaltılmış:** anında; yeşil çerçeve kalır.
- **KARAR E-5:** Değiştir'in hareketi:
  - **(a) ★** Kart yerinde çevrilir (canlıdaki arka yüz, 380/180).
  - (b) Çapraz geçiş (E-3'teki gibi).
  - (c) Seçenekler çerçevenin altından 260 ms'de kayarak gelir.

### 2.5 Aldım (alındı damgası, mühür)

- **Öneri:** Görselin sol altındaki yeşil damga (`z-stamp`, 32 px) büyükten basılır: 420 ms, yay (aynı mühür). Biletin koçanındaki tik de aynı şekilde basılır ve uçak kalkar (K29). Kutunun kenarı, zemini ve noktası yeşile geçer (400 ms); noktada halo belirir; çip zıplar. Yan sütun çapraz geçer: fiyat yerine kod, "Rezerve et" yerine "Belgeyi aç" ya da kesik çizgili "Belgeyi ekle". Fiyat sayarak inmez; yerini kod alır.
  - **Etkinlik kartı:** "Bilet alındı" yeşil şeridi görselin altından 260 ms'de e-out ile yükselir (yalnız transform, yerleşim değişmez); alt satır çapraz geçer.
  - **Tek odak:** kartın K29 parlaması (1,6 sn) canlıdaki gibi mühürle birlikte oynar, çünkü ikisi aynı yerde ve aynı anlamda. İstenirse sadeleştirmek için parlama kaldırılabilir.
- **Bağ:** AYNI (D1 mühür; m-sert "büyükten basılır"; K29) + UYARLAMA (şerit).
- **Azaltılmış:** damga, kenar ve renk anında görünür; renk geçişi kalır.
- **Karar gerekmiyor.**

### 2.6 Plana koy (etkinlik kartı Öneriler sırasından Planında sırasına geçer)

*v82:* iki sabit sıra var, 4 sütun, kartlar 224 px. Planında boşsa aynı boyda boş yuvalar ("Henüz plana koymadın"); fazlası "+n Pano'da" kutusunda. Prototipte kart anında yer değiştiriyor ve "Plana eklendi" bildirimi çıkıyor.

- **Öneri (m-planakoy'un yeni yerleşime uyarlanması):** Kartın kendisi Öneriler'deki yuvasından Planında'daki ilk boş yuvaya uçar (420 ms, e-move; canlı uçuşun süresi ve eğrisi). Hedefteki boş yuva 120 ms'de söner. Planında başlığındaki sayı 1,35 kat sıçrar (380 ms, aynı). Öneriler'de kalan kartlar boşluğu doldurmak için 260 ms'de e-out ile sola kayar (yuvadan yuvaya taşıma). "+n Pano'da" sayısı yalnız değişir.
  - **Planında doluysa:** hedef "+n" kutusudur; kutu sıçrar.
  - **Kategori kapalıysa** (Yolculuk ya da Pano'dan basıldıysa): canlı yedeği kullanılır, yani kapalı satırdaki "n planda" ya da Plan sekmesi.
  - **Plandan çıkar (×):** geri adım sessiz. Kart 180 ms'de söner ve %97'ye küçülür; Planında'daki kalanlar kayar; Öneriler'de yerine anında döner, uçmaz.
- **Bağ:** UYARLAMA (H1 `putFly`: aynı süre, eğri ve sıçrama; hedef bölüm sayısı yerine Planında yuvası ve sayısı).
- **Azaltılmış:** anında yer değiştirir; sayı değişir; yeni kartta 1,6 sn'lik 2 px sabit kenar.
- **KARAR E-6:**
  - **(a) ★** Kartın kendisi Planında'daki yuvasına uçar; Planında sayısı sıçrar.
  - (b) Canlıdaki gibi küçük ad çipi uçar; kart Öneriler'den söner, Planında'da yerine oturur.
  - (c) Yalnız sayı sıçrar; kartlar anında yer değiştirir.

### 2.7 Gerek yok / Geri al

*Prototipte:* `skip` sınıfı: niyet soluklaşır, çip "Gerek yok" der, "Gerek yok dendi · Geri al" bildirimi çıkar (`mk82.js:239-240`).

- **Öneri:** 76 px'lik başlık kalır ve soluklaşır (saydamlık .55, 260 ms; saydamlık değişimi azaltılmışta da durum olarak kalır). Gövde, bölüm aç/kapa ile aynı ızgara yöntemiyle 260 ms'de katlanır (içerik 180 ms'de önce söner); altındaki niyetler yukarı kayar. Nokta soluk griye döner (400 ms). Geri al bildirimi canlıdaki gibidir (300 ms giriş, 8 sn halka, 180 ms çıkış).
  - **Geri al:** tam tersi; gövde 260 ms'de açılır, saydamlık geri gelir. Parlama yok (geri adım).
- **Bağ:** AYNI (geri al bildirimi; m-bolum ızgarası) + UYARLAMA (niyet düzeyinde).
- **Azaltılmış:** anında katlanır; soluk durum kalır; bildirim anında çıkar ve halka döner.
- **KARAR E-7:**
  - (a) Kutu aynı boyda yerinde kalır, soluklaşır; gövde "Gerek yok dedin · Geri al" satırına çapraz geçer (boy değişmez ama 272 px boş yer kalır).
  - **(b) ★** Başlık kalır, gövde ızgara ile katlanır: iki standart boy olur (açık 272 px, gerek yok 76 px).
  - (c) Kutu tamamen katlanır, bölüm sonundaki "Gizlenenler · n" satırına iner (canlıdaki `HiddenList`).

### 2.8 Ayrıntı katmanı (kartın üstünde açılır)

*v82:* `.z-det`, çerçevenin içinde ve üstünde (`inset:0`, z 5); kartı büyütmüyor.

- **Öneri:** Pencere kuralının kart içi hali. Katman 260 ms'de e-out ile %96'dan büyüyerek açılır. Büyüme noktası, basılan ⓘ ya da ⋯ düğmesinin köşesidir (sağ üst). Kapanışta 180 ms'de, e-in ile %97'ye küçülerek söner. Açıkken o kutunun içindeki nabız ve aranıyor çubuğu durur (tek odak, A4'ün kutu içi hali). Esc ve × kapatır.
- **Neden çevirme değil:** çevirme artık "seçenekler" (2.4) anlamına geliyor. "Her hareketin tek anlamı var" (sözlük ilkesi), bu yüzden bilgi katmanı başka bir hareket kullanır.
- **Bağ:** UYARLAMA (C1/C2 pencere 260/180; çıkış kopyası).
- **Azaltılmış:** anında; katmanın gölgesi kalır.
- **Karar gerekmiyor.**

### 2.9 ⋯ menü (Ayrıntı, Gerek yok)

- **Öneri:** Hareket yok, anında açılıp kapanır. Emre'nin m-menu kararı ("Kodda şimdiki gibi KALSIN") ve Hareket Durumu sayfasındaki "Kart menüsü (•••): hayır" yanıtı yeni ⋯ menüyü de kapsıyor. Menüden seçilen iş kendi hareketini yapar (2.7, 2.8).
- **Bağ:** AYNI (C10).
- **Azaltılmış:** zaten hareket yok.
- **Karar gerekmiyor.**

### 2.10 Pano aç/kapa (büyük pencere, kenar menü geçişleri, karşılaştırma sütunları)

*Prototipte:* `q-sheetp` ortada ve sabit (en çok 1240 px × 88vh), telefonda alttan 92vh; perde var; anında açılıp kapanıyor. Esc ve dışarı tıklama kapatıyor; odak ×'e gidiyor; kenar menüde her tıklamada içerik yeniden yazılıyor ve en üste dönüyor.

- **Açılış (masaüstü):** pencere kuralı birebir: perde 260 ms'de kararır, pencere 260 ms'de %96'dan büyür; kapanış 180 ms, e-in, %97'ye küçülerek (çıkış kopyası). Üstteki Plan \| Pano sekmesinin vurgusu 260 ms'de Pano'ya kayar (m-sekme), ama **görünüm kopyası ve yana kayma oynamaz**, çünkü Plan pencerenin arkasında kalıyor (§3.9).
- **Açılış (telefon):** alttan çekmece: 320 ms e-out, `translateY(102%)` → 0; kapanış 220 ms e-in. Bu m-cekmece'nin dikey hali (UYARLAMA).
- **Kenar menü geçişleri** (Tümü, Biriktirdiklerim, AI önerileri, İlham; kategori; niyet): seçili satırın vurgusu dikey olarak 260 ms'de kayar (m-sekme'nin kayan vurgu düzeneği). İçerik m-sekme kuralıyla değişir: eski 120 ms söner, yeni menüdeki yöne göre 12 px aşağıdan ya da yukarıdan 260 ms'de gelir.
- **Karşılaştırma sütunları** (sabit 280 px, AI puanına göre sıralı): pencere açılınca sütunlar birlikte gelir, ayrı ayrı sıralanmaz ("tek imza an sihirli açılış, gerisi hızlı ve sessiz"). Sütunda "Seç"e basınca sütun yeşile döner (400 ms), "Şu an seçili" çipi zıplar. **Sıralama değişmez**, yeniden dizilme hareketi olmaz. Kalp canlıdaki gibidir (.25 sn yay). Yana kaydırma tarayıcının kendi kaydırmasıdır.
- **Pano'da yapılan seçim plana yansır:** pencere açıkken arka plan oynamaz (tek odak). Pencere kapanınca değişen niyet kutusu parlar (1,1 sn), ya da K29 (kaynak görünmüyor, kural 2).
- **Bağ:** AYNI (C1/C2, A4) + UYARLAMA (telefonda çekmece, kenar menüde dikey sekme, kapanışta parlama).
- **Azaltılmış:** anında; perde anında kararır; seçili sütun rengi kalır.
- **KARAR E-8:** Pano penceresi nasıl açılsın?
  - **(a) ★** Ortadan büyür (pencere kuralı, 260/180); telefonda alttan çekmece (320/220).
  - (b) Basılan "Pano n" düğmesinden büyür (büyüme noktası düğme, 380 ms).
  - (c) Eskisi gibi bir görünüm: sekme geçişi gibi yana kayar (pencere olmaz).
- **KARAR E-9:** Kenar menüde içerik nasıl değişsin?
  - **(a) ★** Sekme kuralının dikey hali: vurgu kayar, içerik geldiği yönden 12 px kayar.
  - (b) Yalnız vurgu kayar, içerik 180 ms'de belirir.
  - (c) Hareket olmasın.

### 2.11 Hero mozaik açılışı

*v82:* solda büyük kapak (ad 30 px + şehirler), sağda 3 × 2 kare, altında 4 bölmeli şerit (tarih \| kişiler + hazırlık çubuğu \| bütçe \| Sıradaki), çipler, Tercihler, "Özeti küçült".

- **Öneri:**
  1. Gezi kartından açılınca kartın fotoğrafı mozaiğin büyük kapağına büyür (600 ms; dönüşte 420 ms). Mekanizma aynı (B4); hedef olarak kapak işaretlenir (`data-pit-photo`).
  2. İlk açılışta (gezi başına bir kez) mozaik sihirli açılışa katılır: kapak, ardından 6 kare okuma sırasıyla 80 ms arayla (`data-pit-children`), sonra şeridin 4 bölmesi. "Kaç gün kaldı", "%hazır" ve bütçe 0'dan sayar (`data-count`, 520 ms); hazırlık çubuğu soldan dolar (`data-pit="bar"`, 600 ms). Orb, kıvılcım ve ışıltı canlıdaki gibi üstte oynar.
  3. Fotoğraflar geldikçe 600 ms'de buğudan netleşir. Hareket Dili çiziminde bu "her yere" (hero, kartlar, Pano, şehir kartı) diye çizilmişti; canlıda yalnız gezi kartında var. Fotoğraf gelmezse çizim zemini kalır, kırık görsel işareti çıkmaz.
  4. Sonraki açılışlarda hareket yok; yalnız geç gelen fotoğraf netleşir, boş başlayıp dolan blok belirir (`hx-appear` .3 sn).
- **Tek odak:** fotoğraf karttan geldiyse açılış o fotoğrafı yeniden getirmez (canlıdaki `photoCarried()`).
- **Bağ:** AYNI (I1, I2, B4, E5, E6) + UYARLAMA (yeni işaretler).
- **Azaltılmış:** hepsi anında; sayaçlar son değerde.
- **KARAR E-10:** Mozaik kareleri ilk açılışta nasıl gelsin?
  - **(a) ★** Sihirli açılışa katılır, okuma sırasıyla 80 ms arayla.
  - (b) Birlikte gelir; yalnız fotoğraf buğudan netleşir (600 ms).
  - (c) Hareket olmasın; yalnız fotoğraflar netleşsin.

### 2.12 "Özeti küçült" / "Özeti aç"

*Prototipte:* `x-hero.fold` anında; tek satır (46 px görsel, ad, tarih · kişi · %hazır · bütçe, "Özeti aç").

- **Öneri:** Bölüm aç/kapa ile aynı ızgara yöntemi. Mozaik, şerit ve çipler 180 ms'de söner, hero'nun satırı 260 ms'de e-out ile katlanır. Büyük kapak, ince satırdaki 46 px'lik görsele süzülür (380 ms, e-move; paylaşılan öğe). Altındaki Plan yukarı kayar. "Özeti aç" bunun tam tersidir. Küçültme düğmesi parmağın altında kalır; sayfa yukarıdaysa tarayıcının kaydırma sabitlemesi yeter.
- **Bağ:** AYNI (m-bolum) + UYARLAMA (görselin süzülmesi).
- **Azaltılmış:** anında.
- **KARAR E-11:**
  - **(a) ★** Izgara ile 260 ms'de katlanır, kapak küçük görsele süzülür.
  - (b) Yalnız ızgara ile katlanır; ince satır 180 ms'de belirir.
  - (c) Anında (hareket yok).

### 2.13 Yapışkan mini şerit

- **Öneri:** Canlıdaki mekanizma, belirteçlere bağlanarak: tepeden 260 ms'de e-out ile iner (`translateY(-110%)` → 0), 180 ms'de e-in ile çekilir. Canlıda `.22s ease` belirteç dışında kalmıştı. Titremeyi önlemek için iki eşik kullanılır: hero'nun altı 40 px'in altına inince görünür, 80 px'in üstüne çıkınca gizlenir. Şeritteki "Sıradaki" karta götürür ve kart parlar (B6, 1,6 sn).
- **Bağ:** UYARLAMA (C12; çizimde 0,3 sn e-out olarak çizilmişti).
- **Azaltılmış:** anında.
- **Karar gerekmiyor.**

### 2.14 Bilgi çiplerinin üzerine gelince ipucu

*Prototipte:* CSS `::after` ile anında. v82, canlı hero'daki üzerine gelince açılan bilgilerin korunmasını istiyor (hava, kur, priz, saat farkı, vize, tarih, hazırlık).

- **Öneri:** Canlıdaki `HoverTip` / `TipOn` kullanılır: 140 ms'de 4 px yükselerek açılır, 140 ms gecikmeyle kapanır; klavye odağıyla ve dokunuşla da açılır. İçinde tıklanacak şey olan ipuçları (hava şehir şehir) `interactive` olur. İstenirse süre 120 ms'ye (`--t-instant`) çekilir; çizimdeki "Anında · 120 ms: ipucu" ile tam uyar.
- **Bağ:** AYNI (C13).
- **Azaltılmış:** anında.
- **Karar gerekmiyor.**

### 2.15 Tercihler, Bütçe ve Kimler pencereleri (hero'daki açılır kutular)

*Prototipte:* düğmenin altında açılan kutular (`x-pop`), anında; dışarı tıklama ve Esc kapatıyor.

- **Öneri:** Bunlar ne menü ne tam pencere; düğmeye bağlı küçük pencereler. Canlıdaki profil menüsünün belirteçli hali kullanılır: 180 ms'de, e-out ile 6 px yukarıdan ve %97'den, düğme tarafından açılır; 120 ms'de e-in ile söner (çıkış kopyası).
  - **Tercihler:** "× kaldır" satırı anında kalkar, geri al bildirimi çıkar (canlıdaki silme gibi). AI'nın Evet/Hayır sorusu cevaplanınca kutusu 180 ms'de söner; düğmedeki soru rozeti 120 ms'de söner.
  - **Bütçe:** pencere açıkken değişen rakam sayarak geçer (D6).
  - **Kimler:** davet bağlantısı kopyalanınca canlıdaki "Kopyalandı ✓" işareti.
- **Bağ:** UYARLAMA (C11, C2).
- **Azaltılmış:** anında.
- **KARAR E-12:**
  - **(a) ★** Küçük pencere: 180 ms'de aşağı süzülerek açılır, 120 ms'de söner.
  - (b) Menü gibi hareketsiz (m-menu kararı bunlara da genişletilir).
  - (c) Pencere kuralı (260/180, %96'dan).

### 2.16 Kategoriye göre ↔ Yolculuk sırasıyla

- **Öneri:** m-sekme birebir: görünüm seçicideki vurgu 260 ms'de kayar; eski görünümün kopyası 120 ms'de söner; yeni görünüm seçilen tarafın yönünden 12 px, 260 ms'de gelir. Görünüm seçici yerinde kalır: geçişte kaydırma konumu Plan başlığına sabitlenir, sayfa sıçramaz. "Gün gün" henüz çizilmedi; aynı kural geçerli.
- **"›" ile Yolculuk'tan plandaki niyete gitmek** (prototipte `goInt`, `mk82.js:73`): sekme geçişi, ardından bölüm açılır, ardından kaydırma, en sonda niyet 1,6 sn parlar. Bu yolda bölüm **anında** açılır; böylece arka arkaya üç hareket olmaz. Toplam 1 sn'nin altında kalır.
- **Bağ:** AYNI (B1, B2, B6).
- **Azaltılmış:** vurgu anında yerine geçer; parlama yerine sabit kenar.
- **Karar gerekmiyor.**

### 2.17 Yolculuk zaman çizgisi

*v81/v82:* bölümler (Yola çıkmadan, İstanbul → Tokyo, Tokyo…); her adımda solda tarih, zaman çizgisinde durum noktası, kartta tek eylem; şehir bölümlerinde hero fotoğrafları.

- **Öneri:** Sürekli hareket yok; v80'de rota şeridi ve İstanbul…İstanbul animasyonu kaldırılmıştı (canlıdaki yürüyen uçağın karşılığı yok). Yolculuk ilk açılan görünümse adımlar sihirli açılışa katılır (`data-pit-children`); dikey çizgi yukarıdan aşağı çizilir (`data-pit="line"`'ın dikey uyarlaması, 300 ms). Adımda yapılan iş ("Bunu seç", "Aldım") 2.2'deki gibi işler: kart çapraz geçer, nokta dolar, çip zıplar, Alındı'da mühür. Bölüm başındaki fotoğraflar buğudan netleşir (600 ms). Bölüm özetindeki "n hazır · n karar" yalnız değişir.
- **Bağ:** AYNI (I1, E5) + UYARLAMA (dikey çizgi).
- **Azaltılmış:** anında.
- **Karar gerekmiyor.**

### 2.18 Boş durum

*v82:* "Aranıyor" niyetinde boş görsel (kesik çerçeve), tahmini fiyat, bölge çipleri, "Kendin ara" simgeleri, "AI'dan öner". Planında'da boş yuvalar.

- **Öneri:** Nabız (2,4 sn, 6 px) yalnız "bekliyoruz" anlamında kullanılır: AI gerçekten bir niyet için ararken, o niyetin boş görsel çerçevesi nabız alır. Bu çerçeve nabız listesine eklenir; ekranda en çok 2 nabız kuralı ve pencere açıkken durma kuralı otomatik uygulanır. "Karar bekliyor" (seçenek var, karar kullanıcıda) ve Planında'nın boş yuvaları **nabız almaz**: orada beklenen şey kullanıcının eylemi. Bir kategoride hiç kayıt yoksa Pano'da uyuyan maskot çıkar (F2).
- **Bağ:** AYNI (m-nabiz, m-kurallar) + UYARLAMA (yeni nabız alan öğe).
- **Azaltılmış:** nabız yok; kesik çerçeve kalır.
- **KARAR E-13:** Nabız nerede olsun?
  - **(a) ★** Yalnız "Aranıyor" niyetinin boş görsel çerçevesinde (AI ararken).
  - (b) Durum çizgisindeki tüm kesik noktalarda ("Karar bekliyor" dahil), en çok 2.
  - (c) Yeni tasarımda nabız hiç olmasın.

### 2.19 Yükleniyor / iskelet

- **Öneri:** Sabit çerçeve en iyi iskelet: aynı boyda (76 + 196 px) bir iskelet kutusu. Başlıkta ve gövdede soluk çubuklar, üç kesik seçenek kutusu, üstünden 1,3 sn'de ışık geçer (m-iskelet). Yalnız 400 ms'yi geçen beklemede çıkar. Veri geldikçe her niyet kendi içeriğine 380 ms'de oturur ("kimse kimseyi beklemez"). "Omurga yeni oluştu" ile AI'nın doldurduğu niyetler de böyle gelir. Ekranda çok sayıda iskelet varsa ışık hepsinde aynı anda başlar, tek bir süpürme gibi okunur (faz kaydırılmaz). Kapalı satırdaki mini görseller yüklenirken renkli zemin durur, gelince netleşir. Bir link okunduysa tik damgası canlıdaki gibi basılır.
- **Bağ:** AYNI (E1, E2, A3, E5).
- **Azaltılmış:** ışık yok; iskelet sabit; içerik anında gelir.
- **Karar gerekmiyor.**

### 2.20 AI öneri geldi

- **Öneri:** "AI'dan öner" ya da "Daha fazla öner"e basılınca düğmenin yerinde 400 ms sonra aranıyor çubuğu (1,4 sn) çıkar; sohbetteki maskot "düşünüyor"a geçer. Sonuçlar gelince üç seçenek 60 ms arayla yerine oturur (380 ms; m-iskelet'in hareketi). Yeni olanlarda "Yeni" rozeti görülene kadar durur (canlıdaki K5). Maskot "Oldu" diye zıplar (m-maskot, 1,4 sn). Çip "Aranıyor"dan "Karar bekliyor"a geçer, nabız durur. AI bir seçeneği de seçtiyse kartta "İndi" oynar (1,1 sn, D8). Kategori kapalıysa yalnız kapalı satırdaki mini görsel belirir; sayı sıçramaz, çünkü sıçrama "Plana koy"un anlamı.
- Sohbetin plana kart eklemesi canlıdaki "düşüş" olarak kalır (.55 sn): o hareketin anlamı "sohbet ekledi".
- **m-acilis ile ilişki:** Emre giriş akışındaki "Kart iner"i açılışa eklemedi. Bu öneri açılış değil, iskeletteki "yerine oturur" hareketi.
- **Bağ:** AYNI (D12, F3, E1, D8, D3) + UYARLAMA (60 ms ara).
- **Azaltılmış:** seçenekler anında gelir; "Yeni" rozeti kalır.
- **KARAR E-14:**
  - **(a) ★** Üçü 60 ms arayla yerine oturur ve "Yeni" rozeti görülene kadar kalır.
  - (b) Üçü birlikte 180 ms'de belirir; yalnız "Yeni" rozeti.

### 2.21 Sayı ve bütçe güncellenmesi

- **Öneri:** Para rakamları (hero şeridi, yapışkan şerit, bütçe penceresi, kapalı satırdaki kategori bütçesi, seçili fiyat) değişince 600 ms'de sayarak geçer; sayarken rakamlar eşit genişliktedir (D6 `Counted`). "%hazır" da aynı kancayla sayar (UYARLAMA). Küçük adet sayıları ("7 karar bekliyor", "1 alındı · 1 seçildi") sayarak değil anında değişir: 7'den 6'ya saymak tuhaf durur. İlerleme çubuklarında (koyu yeşil alındı, açık yeşil seçildi) yalnız iç dolgu 600 ms'de e-out ile değişir (canlıda .8 sn); dış boy sabittir. Sıçrama yalnız "Plana koy"da (H1); başka sayıya sıçrama verilmez.
- **Bağ:** AYNI (D6, H1) + UYARLAMA (yüzde).
- **Azaltılmış:** anında.
- **Karar gerekmiyor.**

### 2.22 Hata ve çevrimdışı

- **Öneri:**
  - **Niyet içindeki AI hatası** (arama yapılamadı, fiyat alınamadı): yan sütunda tek satır çıkar ("Şu an arayamadım · Tekrar dene"), 180 ms'de yükselir (G4); aranıyor çubuğu durur, düğme eski haline döner. Kırmızı kullanılmaz: çizimdeki "boş sonuç hata değildir" kuralı.
  - **Anahtar yok ya da bağlanamadım:** sohbetin üstündeki şerit canlıdaki gibi (380 ms'de iner, 200 ms'de çekilir; m-sert).
  - **Çevrimdışı:** Seç, Aldım ve Plana koy yerelde hemen uygulanır, hareketleri de oynar. Gönderilemeyen kayıt için sağ altta "İnternet yok · N sn" bildirimi canlıdaki gibi çıkar; gönderilince yeşile döner (m-sert).
  - Çizimdeki "Okunamadı → Tekrar dene" dönütü Emre'nin kararıyla yapılmadı; yeni tasarımda da eklenmez.
- **Bağ:** AYNI (G1, G2, G4) + UYARLAMA (niyet içi satır).
- **Azaltılmış:** giriş yok; renkler kalır.
- **KARAR E-16:** Niyet içindeki AI hatası nerede görünsün?
  - **(a) ★** O niyetin yan sütununda tek satır + "Tekrar dene", kırmızısız.
  - (b) Yalnız sohbetin üstündeki şeritte; niyet sessiz kalır.

### 2.23 Diğerleri

- **Yükselme (üzerine gelince −3 px, .18 sn):** yalnız tıklanabilir kutularda: seçenek kartları, etkinlik kartları, Pano kartları. Seçili çerçeve ve niyet kutusu yükselmez; onlar yerinde dururlar.
- **"Kendin ara" simgeleri:** ipucu ile açılır (2.14).
- **Basınca küçülme (%97, 120 ms):** canlıda yalnız birkaç düğmede var; yeni ana düğmelerde (Seç, Bunu seç, Rezerve et, Aldım) istenirse eklenebilir. Bunun için bir karar kaydı yok; önerim eklemek, çünkü çizimde "Zaten yayında olanlar" bölümünde yer alıyor.

### 2.24 Özet tablo

| Durum / etkileşim | Hareket | Süre | Bağ | Karar |
|---|---|---|---|---|
| Kategori aç/kapa | ızgara + kaydırma telafisi + tek kaydırma | 260/180 + 380 | AYNI + UYARLAMA | E-1, E-2 |
| Niyet durum değişimi | çapraz geçiş; renk 400; nokta dolar; çip zıplar | 120/260, 400, 260, 500 | AYNI + UYARLAMA + YENİ | E-3 |
| Seç | seçilen kutu karta dönüşür | 380 e-move | UYARLAMA | E-4, E-17 |
| Değiştir / Vazgeç | kart çevrilir | 380 / 180 | AYNI | E-5 |
| Aldım | mühür + K29 + çapraz geçiş | 420 + 1600 | AYNI | — |
| Plana koy | kart yuvaya uçar + sayı sıçrar | 420 + 380 | UYARLAMA | E-6 |
| Gerek yok / Geri al | soluklaşır + gövde ızgarayla katlanır + bildirim | 260 + 300 | AYNI + UYARLAMA | E-7 |
| Ayrıntı katmanı | kart içinde pencere kuralı | 260 / 180 | UYARLAMA | — |
| ⋯ menü | yok | — | AYNI (m-menu) | — |
| Pano | pencere / telefonda çekmece; kenar menüde dikey sekme | 260/180, 320/220 | AYNI + UYARLAMA | E-8, E-9 |
| Hero mozaik | açılış ritmi + fotoğraf hero'ya + buğudan netleşme | 80 vuruş, 600, 600 | AYNI + UYARLAMA | E-10 |
| Özeti küçült / aç | ızgara + görsel süzülür | 260 + 380 | AYNI + UYARLAMA | E-11 |
| Yapışkan şerit | tepeden iner | 260 / 180 | UYARLAMA | — |
| İpucu | `HoverTip` | 140 (120) | AYNI | — |
| Tercihler, Bütçe, Kimler | küçük pencere | 180 / 120 | UYARLAMA | E-12 |
| Kategoriye göre ↔ Yolculuk | m-sekme | 260, 120 | AYNI | — |
| Yolculuk zaman çizgisi | statik; açılışa katılır | — | AYNI | — |
| Boş durum | nabız yalnız Aranıyor'da | 2400 | AYNI | E-13 |
| Yükleniyor | aynı boyda iskelet + ışık | 1300, 380 | AYNI | — |
| AI öneri geldi | 60 ms arayla yerine oturur + Yeni + maskot | 380 | AYNI + UYARLAMA | E-14 |
| Sayı / bütçe | sayaç; küçük adetler anında | 600 | AYNI | — |
| Hata / çevrimdışı | şerit, bildirim, niyet içi satır | 380/200, 260, 180 | AYNI + UYARLAMA | E-16 |

---

## 3. Sabit boy çerçeve kuralının hareketle kesiştiği yerler

1. **Niyet içinde yükseklik animasyonu artık gerekmiyor.** Karar bekliyor, Önerimiz, Seçildi, Alındı, Ayarlandı, Aranıyor ve Değiştir aynı 76 + 196 px'lik çerçevede (`mk82.css:106-108`, v82 notu satır 103-107). Bu yüzden durum geçişlerinin hepsi çapraz geçiş (kural 1). Izgara ya da `useFold` yalnız şu dört yerde kalır: kategori akordiyonu (2.1), Özeti küçült (2.12), Gerek yok (E-7b) ve Pano'nun "Neden?" açılışı (Pano'da kalırsa). Bu, H1 ilkesine ("boyut oynamaz") canlıdakinden daha uygun: istisna sayısı azalıyor.
2. **Çapraz geçişte iki içerik bir an üst üste durur.** Çerçeve `position:relative; overflow:hidden` olmalı; eski içerik mutlak konumlu bir kopya olarak üstte söner. Bu, `hareketDili.ts`'teki kopya tekniği (kapalı gölge ağacı, kimlik yok, `aria-hidden`), ama sayfa yerine çerçeve içinde. Sabit boy sayesinde ölçmeye gerek yok, kopya çerçeveyle aynı boyda.
3. **Kart çevirme için artık komşunun üstüne binmeye gerek yok.** Canlıdaki arka yüz satırın genişliğinde mutlak konumla komşu kartın üstüne biniyor (`[data-bk="over"]`, z 40, `app.css:5002`) ya da telefonda akışa giriyor (`BackFace.tsx` başlığı). Yeni tasarımda arka yüz aynı çerçevenin içinde döner: üç seçenek ve başlık 196 px'e sığar ("tümü Pano'da"). `overflow:hidden` bir çerçevede `rotateY(-80°)` kenarlarda kırpılabilir; dönüş ekseni üst orta kalmalı, perspektif 900 px.
4. **Ayrıntı katmanı kartı büyütmüyor.** Bu yüzden Pano "Neden?"teki gibi yükseklik açılışı (`app.css:4712`) burada kullanılmamalı; katman büyüyerek açılır (2.8). İçerik taşarsa katmanın içi kayar; animasyon sırasında `overflow:hidden` tutulur ki kaydırma çubuğu belirip titremesin.
5. **Işık halkaları kırpılır.** Parlama (10 px), K29 (14 px), İndi (9 px) ve nabız (6 px) dışa doğru gölge (`box-shadow`). `overflow:hidden` taşıyan çerçevede ya da katlanırken `.cat-fold-in`'de (`app.css:5228`; yerine oturunca `visible` olur) kırpılırlar. Çözüm: halka çerçeveye değil niyet kutusuna (`z-int`) verilir; kutular arasındaki 16 px boşluğa sığar. K29'un 14 px'i bu boşluğun sınırında; 10–12 px'e indirmek ya da içe dönük gölge kullanmak gerekebilir.
6. **Telefonda sabit yükseklik yok.** Yapı aynı ama yan sütun alta iniyor (v82 notu satır 122-123). Telefonda çapraz geçiş kutunun boyunu değiştirebilir, alttakiler sıçrar.
   - **KARAR E-15:**
     - **(a) ★** Telefonda da her durum aynı `min-height`'ta olsun (en uzun durum kadar); hareket basit kalır.
     - (b) Telefonda boy değişsin, ızgara yöntemiyle 260 ms'de.
     - (c) Telefonda boy anında değişsin.
7. **Etkinlik sırasının sabit 4 sütunu,** Plana koy'u yuvadan yuvaya taşımaya çeviriyor (2.6). Kalan kartlar sola kayar; bu bir yerleşim değişimi ama `transform` ile yapılır, sayfa yeniden düzenlenmez. Planında doluysa hedef "+n Pano'da" kutusu. v82'nin açık sorusu ("Planında 4'ten fazla kalem olunca ne olacak") bu hedefi doğrudan etkiliyor.
8. **Kapalı satırın sabit 78 px'i ve açık başlığın büyümesi çelişiyor** (prototipte 18'den 22 px'e, ikon 46 px, iç boşluk 12'den 20'ye). Bkz. E-2.
9. **Pano artık pencere.** m-sekme Plan \| Pano sekmesine basılınca Plan görünümünün kopyasını oluşturup söndürüyor (`hareketDili.ts:100-137`, `VIEW_CONTENT` içinde `.panel .pn`) ve yeni görünümü yandan getiriyor (`app.css:4241`). Pano pencere olunca bu iki hareket, perdenin arkasında Plan bir an kaybolup geri geliyormuş gibi görünür. Pano sekmesi için yalnız vurgu kaymalı; kopya ve yandan giriş kapatılmalı.
10. **Sayaç ve sabit yan sütun (232 px):** sayarken rakamlar eşit genişlikte olduğu için genişlik oynamaz (`Counted`); büyük fiyat (24 px) yan sütuna sığmalı, sayarken satır kırılmamalı.
11. **Kapalı satırdaki mini görseller ve özet** (en çok 3 görsel, "n karar") değişince satır boyu sabit kalır. Değişim çapraz geçiş ya da `hx-appear` ile olur; ilerleme çubuğunda yalnız iç dolgu değişir.
12. **View Transitions ile Seç (E-4a):** geçiş sırasında sayfa bir anlık görüntüye donar. Nabızlar ve sayaçlar 380 ms boyunca durur, tıklamalar yutulur. Kabul edilebilir (fotoğraf geçişi zaten 600 ms). Ama kök çapraz geçişi kapatılmalı, yalnız adlandırılmış öğe hareket etmeli. Alternatif: Web Animations ile elle taşıma; sabit boy sayesinde hedef ölçü önceden biliniyor.

---

## 4. Emre'ye sorulacak kararlar (toplu)

| # | Soru | Seçenekler | Önerim |
|---|---|---|---|
| E-1 | Açılan kategori üste kaysın mı? | (a) kaymasın, telafi edilsin · (b) tek hareketle üste kaysın, zaten üstteyse kaymasın · (c) yalnız sığmıyorsa kaysın | **b** |
| E-2 | Açık başlık büyüsün mü (18 → 22 px)? | (a) büyümesin, aynı boy · (b) anında büyüsün · (c) `scale` ile 260 ms | **a** |
| E-3 | Sabit çerçevede içerik nasıl değişsin? | (a) 120 ms söner, 260 ms gelir · (b) yalnız yeni gelir (380) · (c) anında, yalnız renk ve çip | **a** |
| E-4 | Seç hareketi | (a) seçilen kutu karta dönüşür (380 e-move) · (b) yerine oturur + K29 · (c) yalnız K29 | **a** |
| E-5 | Değiştir hareketi | (a) kart çevrilir (380/180) · (b) çapraz geçiş · (c) alttan kayar | **a** |
| E-6 | Plana koy | (a) kart yuvaya uçar, sayı sıçrar · (b) ad çipi uçar (canlıdaki gibi) · (c) yalnız sayı sıçrar | **a** |
| E-7 | Gerek yok | (a) aynı boy, soluk · (b) başlık kalır, gövde katlanır · (c) Gizlenenler'e iner | **b** |
| E-8 | Pano açılışı | (a) ortadan büyür, telefonda alttan çekmece · (b) düğmeden büyür · (c) görünüm geçişi | **a** |
| E-9 | Pano kenar menüsünde içerik | (a) dikey sekme kuralı · (b) vurgu kayar, içerik belirir · (c) hareket yok | **a** |
| E-10 | Mozaik ilk açılış | (a) açılışa katılır, 80 ms arayla · (b) birlikte, yalnız netleşme · (c) yok | **a** |
| E-11 | Özeti küçült | (a) ızgara + görsel süzülür · (b) yalnız ızgara · (c) anında | **a** |
| E-12 | Tercihler, Bütçe, Kimler kutuları | (a) küçük pencere 180/120 · (b) hareketsiz (m-menu gibi) · (c) pencere 260/180 | **a** |
| E-13 | Nabız nerede? | (a) yalnız Aranıyor niyetinde · (b) tüm kesik noktalarda, en çok 2 · (c) hiç | **a** |
| E-14 | AI seçenekleri nasıl gelsin? | (a) 60 ms arayla yerine oturur + Yeni · (b) birlikte + Yeni | **a** |
| E-15 | Telefonda çerçeve boyu | (a) eşit `min-height` · (b) ızgara ile 260 ms · (c) anında | **a** |
| E-16 | Niyet içindeki AI hatası | (a) yan sütunda satır, kırmızısız · (b) yalnız sohbet şeridi | **a** |
| E-17 | Seçince bildirim çıksın mı? | (a) hayır · (b) "Seçildi · Geri al" · (c) 2,4 sn bilgi | **a** |

Karar gerektirmeyen ve mevcut kararla doğrudan aynı olanlar: Aldım (mühür, m-sert), ⋯ menü (m-menu), ipucu, yapışkan şerit (yalnız belirteçlere bağlanıyor), Kategoriye göre ↔ Yolculuk (m-sekme), yükleniyor (m-iskelet, m-kurallar), sayılar (sayaç), çevrimdışı ve bağlanamadım şeritleri (m-sert), maskot (m-maskot).

---

## 5. Kodlamaya geçilirse (kısa notlar, karar değil)

- **Duraklat açığı:** `viewTransition.ts:18-20` `canTransition`, `matchMedia` yerine `reducedMotion()` okumalı (bulgu 2). Test: `tests/viewTransition.test.ts` buna göre genişletilir.
- **`putFly.ts`:** `isPutButton` "+ Plana koy"u zaten tanıyor. Hedef listesine (`SECTION_MARKS`) Planında sayacı eklenir; kartın kendisi uçacaksa (E-6a) çip yerine kartın kopyası kullanılır. Kart seçicisi (`.ev-card, .pn-card`) yeni sınıflara genişletilir.
- **`exitMotion.ts` `LEAVING`:** Pano penceresi, `x-pop` ve Ayrıntı katmanı eklenir; çıkış süreleri yeni sınıflar için CSS'e yazılır.
- **`hareketDili.ts`:** Pano kenar menüsü kayan vurgu listesine (`TABLISTS`) eklenir (E-9a); Pano sekmesi kopya ve yandan girişten muaf tutulur (§3.9); "Aranıyor" çerçevesi nabız listesine (`PULSERS`) eklenir; `VIEW_CONTENT` yeni görünüm sınıflarıyla güncellenir.
- **`opening.ts` işaretleri:** mozaik (`data-pit-photo`, `data-pit-children`), şerit sayıları (`data-count`), hazırlık çubuğu (`data-pit="bar"`), kategori satırları ve Yolculuk adımları (`data-pit-children`). Sınıf adı gerekmez.
- **`useFold`** akordiyonda iki bölümü aynı anda yönetebilir; kaydırma telafisi ve tek kaydırma `requestAnimationFrame` ile yapılır (380 ms, e-move).
- **Azaltılmış hareket:** her yeni animasyonlu seçici F8 durdurma bloklarının ikisine de (`@media` ve `body.still`) eklenir; `tests/reducedMotion.test.ts`'in "her animasyon kuralının durdurması var mı" testi eksik olanı yakalar. Renk geçişleri (zemin, kenar, nokta: 400 ms) bilet çerçevesi gibi azaltılmışta kasıtlı olarak bırakılır.
- **Etkisiz kurallar:** `.cat-body.mv-unfold`, `mv-tab`. Emre'nin "hiçbir tasarlanmış şey silinmez" ilkesi gereği yalnız silme önerisi olarak listelenir, ayrıca onaylanır.

---

## 6. Kaynaklar

**Okunan kod ve testler:** `src/app/hareketDili.ts`, `motion.ts`, `exitMotion.ts`, `viewTransition.ts`, `putFly.ts`, `useAppear.ts`, `Counted.tsx`, `Mascot.tsx`, `opening.ts`, `WorkPill.tsx`, `OfflineNotice.tsx`, `plan/Section.tsx`, `cards/BackFace.tsx`, `thinking.ts`, `Chat.tsx`, `HoverTip.tsx`, `StickyBar.tsx`, `Progress.tsx`, `main.tsx`, `Settings.tsx`; `static/app.css` (keyframes listesi, satır 819-5262); `DESIGN.md`; `tests/hareketDili|motion|reducedMotion|exitMotion|viewTransition|putFly.test.ts`.

**Kararlar:** `/home/user/wt-v32/docs/superpowers/specs/2026-10-13-emre-kararlari.md` (`/home/user/trip-radar/docs/...` altındaki kopyasıyla birebir aynı): m-sekme, m-iskelet, m-isik, m-bolum, m-maskot, m-nabiz, m-kurallar (satır 23-29), m-acilis, m-menu (30-31), m-cekmece, m-planakoy, m-sert (53-55); r-acilis (21), r-mozaik (22).

**"hareket" ya da "motion" geçen belgeler** (`grep -ril "hareket dili\|hareketDili\|motion"`): `trip-radar/docs`'ta 77, `wt-v32/docs`'ta 122 dosya. Çoğu yalnız `prefers-reduced-motion` ya da içine gömülmüş canlı `app.css` yüzünden eşleşiyor (plan-v12…v82 mockup'ları; v82 `index.html` canlı CSS'i taşıyor). İçinde hareket tasarımı olanlar:
- `docs/mockups/artifact-arsivi/hareket-dili-P2qVN5/index.html`: Hareket Dili çizimi; ilkeler, 7 bölüm, 3 soru. m-* kararlarının kaynağı.
- `docs/mockups/artifact-arsivi/hareket-durumu-9zYBic/index.html`: 11 Ekim durumu: ne onaylandı, ne vazgeçildi (menü ve "Okunamadı → Tekrar dene": hayır).
- `docs/mockups/ux-katmanli-arayuz/index.html`: altı hareketlik sözlük.
- `docs/mockups/acilis-v2/index.html`, `docs/mockups/sihirli-acilis/index.html`: açılış seçenekleri (B seçildi).
- `docs/mockups/giris-akisi-v1|v2/index.html`: pıt pıt sözlüğü, Kart iner, Sayı (m-acilis: eklenmesin).
- `docs/envanter/02-hareket-ve-sohbet.md`: 0.36.84 envanteri (bayat satırlar için bulgu 5).
- `docs/superpowers/specs/2026-10-13-plan-v45-kod-plani.md` §4: hareket backlog'u, F8a–F8e.
- `docs/superpowers/specs/2026-10-11-plan-v30-design.md:257-268`.
- `wt-v32/docs/superpowers/specs/2026-10-14-plan-v31-tasarim-notu.md:13-15`: "Seç: seçili kart yerine oturur, yükselme ve mühür".
- `docs/superpowers/specs/2026-10-13-plan-v46-izlenebilirlik.md`, `-ilerleme.md`, `-fark-raporu-2.md`, `-silme-onerileri.md`; `2026-10-05-hero-v9-design.md` (belirme).

**Yeni tasarım:** `/home/user/wt-v32/docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md` (v77–v82); `/home/user/wt-v32/docs/mockups/plan-v82-standart/kaynak/mk82.js` (durum makinesi `render` 14-48, Pano 109-174, olaylar 175-251), `mk81.css` (hareket olarak yalnız 8, 28, 111, 175-176, 239, 418, 521-522), `mk82.css` (niyet kutusu ve durum çizgisi 73-147, seçenekler 160-217; hareket yok).
