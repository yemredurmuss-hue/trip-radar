# B · Eski sürümlerden, çalışırken alınmış ekranlar (kayıp envanteri)

Hazırlanma: 2026-10-13. Salt okunur iş: kaynak koda dokunulmadı, commit yok. Görüntüler `img/` altında (PNG, 1x, en çok 1000 px).

## Nasıl çekildi (ve sınırları)

- Eski sürümler iki yoldan çalıştırıldı. (1) `origin/release` commit'lerinin `extension/` klasörü (`git archive`): 0.35.4 `d96c295`, 0.36.23 `cbaeccb`, 0.36.64 `beea585`, 0.36.68 `f621b3f`, 0.36.78 `cda3cd6`, 0.36.82 `9cc2f1d`, 0.36.83 `4fa33da`. (2) Hiçbir sürüme girmemiş ara commit'ler kaynaktan derlendi (geçici worktree): `f0e9be5`, `1f9ef45`, `d34f0a2`, `3ae8672`, `4c4ca01`, `29b5e74`, `14b86ae`.
- Bugünkü canlı = `plan-v46-kod` @ `d47e4e2` (worktree `wt-kayipb`, `npm run build`). Hepsi Playwright + Chromium 1194, `faketime 2026-10-05 10:00`, 1440 px genişlik, TR dili, örnek gezi "Portekiz (örnek)".
- Sandbox dışarı çıkamadığı için fotoğraflar **ikame**: Wikipedia istekleri yakalanıp `docs/mockups/giris-akisi-v2/img/foto-*.jpg` dosyaları verildi (Porto gerçekten Porto, Lizbon ve Bali durakları o klasördeki başka fotoğraflar; ör. Lizbon'da Bali villası görünür). Fotoğrafın yeri ve düzeni gerçek, içeriği değil. Günün kendi fotoğrafı (`dayPhoto`, vurgu araması) çevrimdışı olduğu için şehrin fotoğrafına düştü.
- Yapay zekâ modeli yok: başlatma sohbeti yalnız kodun sorularıyla çalıştı (sonuç ekranları aynı).
- Açılış ve Oluştur şeritleri 100–150 ms'de bir alınmış ekran görüntüleridir (Playwright ekran görüntüsü ~120 ms sürer), video değil.
- **Oluştur "yavaş" görüntüleri** (`olustur-*-yavas`): yeni bir geziyi model olmadan çok hızlı kurduğumuz için pano, uçak inince (≈4,5 sn) açılıyor ve fotoğraf sahnesi görünmüyor. Gerçek kullanımda model beklenirken harita sonuna kadar oynar. Bunu göstermek için derlenmiş kopyada (yalnız `/tmp`'deki kopya, kaynak değil) `openDelay` içindeki 6 sn tavanı +6 sn bekleyecek hâle getirildi. Hangi görüntü yamalı, adında `yavas` yazıyor; `olustur-bugun.png` yamasız gerçek akıştır.

## Özet tablo

| Konu | En iyi eski sürüm | Bugün | Kaldırıldığı commit |
|---|---|---|---|
| 1. Fotoğraflı gün gün, Liste\|Kartlar, gün şeridi | **0.36.83** `4fa33da` (2026-10-11); ilk hâli 0.35.4 `d96c295` (2026-10-05) | **Yok.** Plan > "Gün gün" tek satırlık gün (tarih kutusu + satırlar) | `5d5c7a4` (2026-10-12) |
| 2. Simgeli kontrol listesi / önizleme | **0.36.68** `f621b3f`; en zengini ara commit `4c4ca01`/`3ae8672` (önizleme kartı + Plan taslağı) | **Değişmiş.** Simge satırları gitti; fotoğraf şeridi + tek kart | `14b86ae` (2026-10-09 16:40); taslak: `29b5e74` |
| 3. Fotoğraf mozaiği | **Kodda hiç olmadı.** Yalnız çizim: Seçenek B `49a47ab`. Kodda en yakını: 4'lü fotoğraf şeridi (`1f9ef45`, 0.36.17–0.36.68) | Üstte 3–4'lü fotoğraf şeridi | Mozaik elendi: `b930d39` (çizim); şerit biçimi `14b86ae` |
| 4a. Sihirli açılış, maskot | **0.36.78** `cda3cd6` (göz kırpan maskot, panel kayar) | **Değişmiş:** "Ritim ve sayaçlar" (maskotsuz, hızlı) | `886cf0e` (2026-10-11) |
| 4b. Oluştur haritası, fotoğrafların haritada büyümesi | 0.36.36 `ea232dc` ve sonrası, `29b5e74` | **Var, aynı kod**; ama gezi çabuk kurulunca pano sahneyi kesiyor | Kaldırılmadı |
| 5. Poster gezi kartı | `29b5e74` (0.36.67+) | **Var** (`TripCard.tsx`) | Kaldırılmadı |

## 1. Gün gün: fotoğraflı gün kartları, Liste | Kartlar, gün şeridi

- **Gösterim.** Önce Liste: her gün bir kart, solda günün büyük fotoğrafı ve "1. gün" hapı, sağda başlık ("Porto 1. Gün · Varış"), saat saat satırlar, her satır kendi simgesiyle, zaman çizgisi gibi bağlı. Üstte "Liste | Kartlar" anahtarı ve "Porto 1 2 3 · Lizbon 4 5–6 7" gün şeridi. 0.36.83'te ayrıca fotoğrafın üstünde tarih kutusu ("EKİ 8 PER 1. gün") ve "Gece: konaklama aranıyor" satırı var. Kartlar: aynı günler Plan'ın tam kartlarıyla, solda ray (Varış, Porto 2–3. gün...).
- **Görüntüler.** `img/gun-gun-0.35.4-liste.png` (ilk fotoğraflı liste), `img/gun-gun-0.36.83-liste.png` (en iyisi), `img/gun-gun-0.36.83-kartlar.png`, `img/gun-gun-bugun.png`.
- **Bugün.** Fotoğraf yok, anahtar yok, şerit yok. Plan > "Gün gün": her gün tek sıkı satır, solda tarih kutusu ("EKİ 8 Per Gün 1"), satırlar durum etiketiyle ("Arıyoruz", "Seçildi", "Rezerve"), boş günde "Serbest gün · yapılacaklardan seç".
- **Kaldırılan.** `5d5c7a4` (2026-10-12), "Gün gün: one compact row a day (date box, lines with stage and time, Gece line, free-day line); old photo cards, Liste|Kartlar switch and day strip removed; e2e adapted". Karar kaydı: `docs/envanter/01-kararlar.md` GG02/GG03. Sürümde 0.36.84 ile gitti (0.36.83'te hâlâ var).
- **Geri getirmek için.** Son hâl: `git show 5d5c7a4^:src/app/days/DayCards.tsx` (875 satır; `useDayPhoto`, `dc-seg`, `dc-strip`, `PHOTO_CACHE`), `src/lib/dayCards.ts` (`dayPhoto`, `groupDays`, `tieredRows`), `src/app/days/RowGlyph.tsx`, `static/app.css` (`.dc-*`; `5d5c7a4` 82 satır ekledi/değiştirdi, eski kurallar kendi öncesi sürümde), `src/app/Timeline.tsx` ve `TripPanel.tsx` (çağrı yerleri). Tarihçe: `797cd0a` (fotoğraflı kart, 10-05), `730d119` (tek anahtar + gün şeridi), `667b668`/`22fbecc` (Kartlar ve Liste hiyerarşisi), `311afb1` (Emre'nin referansı `docs/mockups/ref/2026-10-05-gunluk-akis-liste-referans.webp` gibi liste), `fa723c4` (Release 0.35.4), `9ba349b`/`e86da39` (satır simgeleri, zaman çizgisi), `2213434` (gün grupları). Şehir gruplu ray (`875689f`, 0.35.1) da aynı dosyada.

## 2. Başlatma sohbetinin sağ paneli: "Gezin şekilleniyor N/6" ve simgeli önizleme

- **Bulgu (önemli).** Kontrol listesinin kendi satırları (NEREYE, NEREDEN, KİMLE, NE ZAMAN, NE İSTİYORSUN, ROTA) hiçbir sürümde satır simgesi taşımadı: yalnız durum dairesi (kesikli boş, koyu dolu tik, "?" ya da dönen halka). `Checklist.tsx` tarihçesi bunu gösteriyor (f0e9be5'ten bugüne hep `UiIcon check`). **Simge satırları listenin hemen altındaki "Gezi önizlemesi" kartındaydı** (konum pini, takvim, kişiler, uçak, küre, yıldız; `st-pv-row` + `st-pv-icon`). Hatırlanan "simgeli liste" büyük olasılıkla bu.
- **Görüntüler.**
  - `img/kontrol-listesi-f0e9be5.png`: ilk hâl (06 Eki), geniş lavanta sütun, simgesiz.
  - `img/kontrol-listesi-1f9ef45.png`: "Gezi önizlemesi" doğuyor, simgeli satırlar, 2 fotoğraf.
  - `img/kontrol-listesi-0.36.68.png`: **yayınlanmış** son hâl (0.36.17–0.36.68): beyaz kart, "Oluştur", altında 3 fotoğraflı simgeli önizleme.
  - `img/kontrol-listesi-3ae8672.png` ve `img/kontrol-listesi-4c4ca01.png`: gece işi (09 Eki 01:23): büyük kapak fotoğrafı (noktalı gezinti), simgeli önizleme, yanında "Plan taslağı" kartları (Uçuş 2, Konaklama 1); `4c4ca01` daha dolu (Önerilerde satırı, uçuş kartları gerçek rota). **Bu ikisi hiçbir sürüme girmedi** (sürüm `app.js`'lerinde `Plan taslağı`, `st-pv-stage`, `lp-card` yok).
  - `img/kontrol-listesi-cizim-49a47ab-A.png`: aynı gün çizilen "tek kart" taslağı (kapak fotoğrafı + altı çizgili ilerleme + sade liste), kod değil çizim.
  - `img/kontrol-listesi-bugun.png`: bugün (6/6 durumu).
- **Bugün.** Tek kart: üstte 3–4 fotoğraf şeridi (Bali, Doğa, Sidemen, Gün batımı), halka + "Gezin şekilleniyor 6/6", satırlar durum dairesiyle; uçuş, tür ve bütçe artık satırın içinde ("Uçuş: İstanbul ⇄ Denpasar", Doğa/Deniz/Orta bütçe çipleri). Önizleme kartı, simgeler, Plan taslağı yok.
- **Kaldırılan.** `14b86ae` (2026-10-09 16:40): "Start flow: one card, the preview's photos on top of the checklist and its flights and styles in their rows (drawing v3)": `Preview.tsx` −99 satır, `st-pv-row` simgeleri düştü. Plan taslağı: `29b5e74` (10-09 11:47) `LivePlan.tsx` (−152) ve `tests/livePlan.test.ts` (−45) sildi; gerekçe `giris-akisi-v2` Karar 6 ("ikisini de kaldırıp bugünkü sıraya dön").
- **Geri getirmek için.** `git show 3ae8672:src/app/start/LivePlan.tsx`, `git show 4c4ca01:src/app/start/Preview.tsx` (simge satırları `Row` + `HeroIcon`, `st-pv-stage`/`st-pv-dots` kapak sahnesi), CSS `.st-pv-*` ve `.lp-*` (`git show 4c4ca01:static/app.css`), `src/lib/startTrip.ts` (`Preview`, `livePlan` yardımcıları; 3ae8672 +85 satır). Simgeli satırların son yayınlanmış hâli için `git show f621b3f:extension/app.css | grep st-pv`.

## 3. Fotoğraf mozaiği

- **Bulgu.** Gerçek bir "mozaik/kolaj" kod hiçbir commit'te yok (`mosaic`, `mozaik`, `collage` kaynakta geçmiyor). Mozaik, `giris-akisi-v3` çiziminde **Seçenek B "Mozaik fotoğraf + kutucuklar"** olarak vardı (`49a47ab`, 2026-10-09 16:04): bir büyük + iki küçük fotoğraf, altında 2x3 kutucuk. Emre'nin seçimi sonraki çizimde (`b930d39` 16:32) "eski dar liste + fotoğraflar aynı kartta" oldu. Çizimdeki `.mos`/`.tiles` CSS'i `b930d39`'da silindi.
- **Kodda en yakın şeyler.** (a) 3–4'lü fotoğraf şeridi `.st-pv-photos` (`display:grid; grid-auto-flow:column; height:104px`): `1f9ef45`, yayında 0.36.17'den; bugün `PhotoStrip` ile kartın en üstünde. (b) Oluşturma ekranında yelpaze kartlar `st-fan` (0.36.12+, harita yoksa yedek). (c) Kapak sahnesi (kaydıran büyük fotoğraf, noktalar): `3ae8672`, yayına girmedi.
- **Görüntüler.** `img/mozaik-cizim-49a47ab-B.png` (çizim), `img/mozaik-29b5e74.png` (4'lü şerit ve simge satırları, çalışan kod), `img/mozaik-bugun.png`, ayrıca `img/olustur-f0e9be5.png` (yelpaze).
- **Geri getirmek için.** Mozaik düzeni: `git show 49a47ab:docs/mockups/giris-akisi-v3/index.html` (`.mos`, `.tiles`, `.tile`), kodlanmamış. Şerit: `git show 1f9ef45:src/app/start/Preview.tsx`.

## 4a. Açılış: sihirli açılış, maskot

- **Gösterim.** 0.36.78 `cda3cd6` (ilk iki saniye her şey gizli): sohbetteki maskot (mor küre, gülen yüz) panelin kenarına uçar, **yavaşça göz kırpar ve kıvılcım saçar**, görünen bölümler dolar, maskot eve döner; sonra panel kendi aşağı kayar, altta kalanlar "pıt" diye belirir, sonunda en üste döner (sürede toplam ~4–5 sn). Hero fotoğrafı bulanıktan netleşir. 0.36.82 ve bugün: maskotsuz "B · Ritim ve sayaçlar", ~0,8 sn: parçalar okuma sırasıyla belirir, sayaçlar 0'dan sayar, çubuk soldan dolar.
- **Görüntüler (12 kare şeridi, 6 kare her biri).** `img/acilis-0.36.78-a.png` (göz kırpma ve kıvılcım), `img/acilis-0.36.78-b.png` (hero belirir, kayma), `img/acilis-0.36.82.png`, `img/acilis-bugun.png`.
- **Kaldırılan.** `886cf0e` (2026-10-11 00:11, "WIP (bekliyor): açılış B · ritim ve sayaçlar + pencere/çekmece kapanışı"): `opening.ts` 435 satır değişti (409 satırlık maskotlu sürüm gitti). Gezi başına bir kez: `b86f703`. Maskot bileşeni `Mascot.tsx` duruyor (sohbet başlığı, boş Pano); yalnız açılıştaki rolü (`state="wink"`) ölü.
- **Geri getirmek için.** `git show 894f9e1:src/app/opening.ts` (maskotlu, `PHASE {out, wink, burst, fill}`, `GLIDE_SPEED`), `git show d7921bc:src/app/Mascot.tsx`, `src/app/TripPanel.tsx` (çağrı), `static/app.css` (`ms-wink`, kıvılcım kuralları), `tests/opening.test.ts`, çizim `docs/mockups/sihirli-acilis/index.html` (mod 4 "Göz kırpar"), `docs/mockups/acilis-v2`. Yayında: 0.36.76–0.36.81.

## 4b. Oluştur haritası ve fotoğrafların haritanın üzerinde büyümesi

- **Gösterim.** Oluştur'a basınca: dünya haritasında İstanbul'dan Bali'ye uçak (yakınlaşma, etiket, uçuş, iniş halkası), adımlar tikle yazılır (sohbette de), duraklar düşer, ardından **üç fotoğraf haritanın üstüne büyük, hafif eğik açılır; haritanın kutusu erir**.
- **Görüntüler.** `img/olustur-29b5e74-yavas.png` (8 kare: harita, uçuş, duraklar, fotoğraf sahnesi; yamalı kopya, yukarıdaki not), `img/olustur-bugun-yavas.png` (aynı sahne bugünkü kodda: **neredeyse aynı**), `img/olustur-bugun.png` (yamasız, bugünkü gerçek akış: iniş + ilk durak, pano hemen açılır), `img/olustur-f0e9be5.png` ve `img/olustur-1f9ef45.png` (ilk sürümler: fotoğraf yelpazesi).
- **Bugün.** Kod duruyor (`start/GenMap.tsx`, `start/Generating.tsx`, `lib/startMap.ts`, CSS `.gm-card`); fotoğraf sahnesi 0.36.36'dan beri sürümlerde. Değişen davranış: pano, gezi kurulunca ve uçak inince (en geç 6 sn) açılıyor; model beklemeyen/hızlı kurulumda fotoğraf büyüme sahnesi hiç ya da yarım görünüyor (gerçek akışımızda duraklar `stops=1`'e geldiğinde pano açıldı). Bu "kaybolma" bir kaldırma değil, `openDelay` (`startMap.ts:199`, `OPEN_CAP_MS`) kuralı.
- **Geri getirmek için.** Bir şey kaldırılmadı. Tavanı ve beklemeyi gevşetmek: `src/lib/startMap.ts` `openDelay`/`OPEN_CAP_MS`, `Generating.tsx`'te `wait(c ? openDelay(...))` (satır ~159). Sahnenin doğduğu commit'ler: `d34f0a2` (v5 harita), `3ae8672` (fotoğraflar uçuştan sonra büyük açılır), `29b5e74` (kutu erir, "photos without a box"). Eski MapLibre haritası: `0e65818`; kullanılmayan `FlightMap.tsx` ölü kod.

## 5. Poster gezi kartı

- **Gösterim.** Ana ekranda gezi kartı = fotoğrafın kendisi (poster): sol üst kişiler, sağ üst "3 gün kaldı", altta başlık ve tek satır.
- **Görüntüler.** `img/poster-oncesi-4c4ca01.png` (poster öncesi: beyaz kart, ilerleme çubuğu, "2 rezerve · 1 seçildi · 13 kayıt"), `img/poster-29b5e74.png` (poster, ilk hâl), `img/poster-bugun.png`.
- **Bugün.** **Var, aynı** (`src/app/TripCard.tsx`, `HomeBackdrop.tsx`, `useTint.ts`; 29b5e74'te doğdu, Emre'nin seçimi 2026-10-09; sürümlerde 0.36.67'den). Küçük fark: bugünkü örnek gezide tarih satırı "8…" diye kırpılıyor ve yanında yuvarlak bir kişi rozeti sıkışıyor (2 kişilik gezi, 1440 px); 29b5e74'te satır tam görünüyordu ("8–14 Ekim · 7 gün · Örnek"). Bunu `poster-bugun.png`'de görebilirsin; neden olduğu araştırılmadı.
- **Kaldırılan.** Yok.
- **Geri getirmek için.** Gerek yok; ilk sürüm: `git show 29b5e74:src/app/TripCard.tsx`.

## Çekilemeyen / eksik kalan

- Günün kendi (vurgudan aranan) fotoğrafı: çevrimdışı, şehir fotoğrafı ikamesiyle gösterildi.
- 3ae8672'nin Plan taslağı ve kapak sahnesi her adımda: tek cevap sırası (Bali, İstanbul) gösterildi, diğer cevap durumları çekilmedi.
- Hareketler video değil, ~120 ms aralıklı kare serileri; 0.36.78'in kayma evresi (panel inişi) ilk 25 karede (≈4,7 sn) tamamlanmadı, `acilis-0.36.78-b` kaymanın başında bitiyor.
- Dar ekran ve İngilizce arayüz çekilmedi.
