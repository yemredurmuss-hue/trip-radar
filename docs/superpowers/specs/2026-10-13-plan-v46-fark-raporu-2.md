# Plan v46: fark raporu 2 (ikinci bağımsız denetim, 2026-10-13)

Denetçi: kodlamayı yapmayan ayrı oturum. Dal `plan-v46-denetim2` (= `plan-v46-kod` HEAD c9c2ca8, tüm paketler birleşik, 0.36.84 etiketli). Kod değiştirilmedi. İlk denetim: `2026-10-13-plan-v46-fark-raporu.md`; kararlar: `2026-10-13-emre-kararlari.md`; çizimler: `docs/mockups/artifact-arsivi/` (Hareket Dili, Hareket Durumu).
Araçlar: `scripts/v30-shots.mjs` (1440, 390, EN; mevcut hâliyle çalıştı), yeni `scripts/v46b-probe.mjs` + `scripts/probes/*.mjs` (tek tek küçük yoklamalar; tohumlanmış profil üzerinde). Çıktı: `e2e-output/v46b/` (git'e girmez): `1440/`, `390/`, `en/`, `p/` ve `p390/` (yoklama ekranları), `*.log`, `tsc.txt`, `vitest.txt`.
Sınır: TAM E2E KOŞTURULMADI (başka bir tam e2e sürüyordu); e2e iddiaları yalnız okundu, kanıt olarak ekran, DOM/animasyon ölçümü ve vitest kullanıldı. Ağ yok (çevrimdışı): Wikipedia/şehir fotoğrafları, AI cevabı, harita karoları gelmedi (aşağıda "denetlenemedi").

## A. Kabul
- tsc (`npx tsc -p .`): temiz (exit 0). vitest: **163 dosya / 2009 test yeşil** (önceki denetim 156/1956; yeni testler eklenmiş).
- İzlenebilirlik: 41 açık satırdan **40 kapandı**, **☐ kalan 1 (PS11, paylaşım sunucusu denetlenemedi)**.
- HATA: **4 (hiçbiri yayını tek başına engellemez; E1 yayından önce düzeltilmesi önerilir)** + 3 küçük gözlem. İlk denetimin H1 H5'i düzeldi (bkz. §2). Backend: `git diff plan-v30-fix..HEAD -- supabase` boş; DB_VERSION=5; uzantı kimliği aynı.

## B. HATALAR
| # | Ağırlık | Kanıt | Önerilen düzeltme (kodlayan ajan) |
|---|---|---|---|
| E1 | engellemez; Emre varsayılanı uygulanmamış ("Sana uyan başka seçenek bulamadık: arama yapılana kadar gizle") | Arka yüz açılır açılmaz, hiç arama yokken "✨ Önerimiz 0 · Sana uyan başka seçenek bulamadık." yazıyor: `e2e-output/v46b/1440/states-back-stay.png`; kod `src/app/cards/BackFace.tsx:457` (`split.aiTotal === 0 && !searching`) | Bir "arama yapıldı" bayrağı (aranan kart ya da arama sonucu 0) ekle; yalnız ondan sonra göster. |
| E2 | engellemez, kozmetik | 390 px: Durumlar gezisi, "Ayarlandı" konaklama kartı (Arkadaşın evi) başlığı kartı 9 px aşıyor (`scrollWidth 329 > clientWidth 318`), ••• kart kenarına yapışıyor: `p390/armed-card.png`; taşan öğeler `span.pk-end`, `.pk-menu-wrap`, `.pk-ib`. Sayfa taşması 0. Ayrıca "Arıyoruz" kartında tarih "1–…" diye kesiliyor (`390/states-sec-stay.png`) | Başlıkta ⓘ + Ayarlandı rozeti + ataş + × + ••• sığmıyorsa tür adını ya da ataşı dar ekranda gizle / `.pk-end` gap küçült; e2e'ye `.pk-card` `scrollWidth<=clientWidth` iddiası (Ayarlandı kart dahil). |
| E3 | engellemez | Pano'dan "+ Plana koy": uçan çipin yazısı kartın adı değil "€9" (yoklama `p/fly`: `["€9",[420]]`); kod `src/app/putFly.ts` (kart = eylem satırını saran en yakın ≥160 px kutu; Pano kartında bu satır, ilk satır fiyat). Hedef: Pano'da bölüm başlığı çizili olmadığı için yine Plan sekmesi (Emre: "çizimdeki gibi bölüme uçsun", Plan içinden sağlanıyor: `["Livraria Lello",[420]]`) | Pano'da `card.closest(".pn-card")` adını (`aria-label`/başlık) kullan; Pano'da hedef için Plan sekmesi bilinçli kalıyorsa karar kaydına yaz. |
| E4 | engellemez; **v46 öncesi** (0.36.84'te de var: `extension/app.css` aynı kural) | 390 px hero şehir sekmeleri: `.hx-cities{max-width:calc(100% - 282px)}` = 76 px; Ozora'da "Budape" kesik, ikinci şehir yok; Portekiz'de yalnız "Porto": `390/ozora-hero.png`, `390/sample-hero.png`; `static/app.css:1148` | Dar ekranda (`@container panel (max-width:760px)`) `max-width` kalksın, sekmeler tam genişlikte kayarak ya da alt satırda dursun. |
| K1 | küçük gözlem | "Kompakt aynı" kararına rağmen Gün gün Kompakt'ın gün başlığına "Yolculuk günü" etiketi girmiş, "Rezerve" kelimesi "Bilet alındı" olmuş (eski ve yeni build metin farkı: `/tmp/compact-*.json`, 3 gezi, yalnız bu iki fark) | Etiket Kompakt'ta istenmiyorsa kaldır; "Bilet alındı" v46 durum sözlüğü, Emre'nin kararı varsa sorun yok. |
| K2 | küçük gözlem | Mozaik|Şerit anahtarı yalnız iki minik simge (`aria-label` var), ikinci fotoğrafın köşesine biniyor; 390 px'te liste "Gezin şekilleniyor ▾" çubuğunun arkasında, mozaik ancak açınca görünür: `p/start-mosaic.png`, `p390/start390-*.png`. Not: Şerit'e basınca sayaç `.st-pv-mosaic` 1 gösterdi (görsel şerit; nedeni incelenmedi) | İsteğe bağlı: anahtara yazı etiketi. |
| K3 | belge | `2026-10-13-plan-v46-ilerleme.md` bayat: "Düzeltme turu (H1 H5) bekliyor" (birleşti, 8921b50) ve ikinci dalga paketleri (acilis2, gungun2, karar2, ucuskamp, hareket3) tabloda yok | Bu denetim tabloyu güncelledi. |

## C. Kararların uygulanma tablosu
| Karar | Uygulandı mı | Kanıt |
|---|---|---|
| Gün gün Kompakt \| Liste \| Kartlar (\| Harita), tercih hatırlanıyor | evet | Anahtar `Kompakt, Liste, Kartlar, Harita` (`TripPanel.tsx:883`); `localStorage trip-radar:days-view` list/cards/compact, yenilemeden sonra aynı mod (probe `days`); Harita ayrı görünüm, çevrimdışı mesaj + "Tekrar dene" (`p/days-ozora-map.png`); Kompakt eski build ile aynı (K1 farkı hariç) |
| Fotoğraflı Liste / Kartlar, fotoğrafsız demo | evet | `1440/sample-view-days-list.png` (gün resmi yoksa soluk çizim, kırık görsel yok; `DayViews.tsx` `Picture`), `ozora-view-days-cards.png`; gerçek şehir fotoğrafı ağ olmadığı için denetlenemedi |
| Yolculuk günü kartı | evet | Liste: Gün 4 "Yolculuk günü Porto → Lizbon" (çıkış, tren kartı, varış), `sample-view-days-list.png`; kod `JourneyDay.tsx`, `dayView.ts journeyDay` |
| Günün akışı + günün rezervasyonları | evet | iki parça, "2 bekliyor" / hepsi hazırsa "✓ hazır" kapanır (`DayViews.tsx Reservations`); Plan kartları `ozora-view-days-cards.png` |
| Sırayla karar ver | evet | Karşılaştırma penceresi → "Sırayla karar ver": `1 / 3 · Konaklama`, Sonra/Geri, "Bitti"; pencere başlığı sabit (`p/decide-sample-step1.png`); 1440 ve 390 taşma 0 |
| ★ öncelik | evet | Yalnız gerçek şart/notta: Tablo'da 7 ★ ("Sessiz odalar, iyi uyku ★", "sessiz bir yer istiyoruz ★"), varsayılan "Önemli" satırlarında yok, açıklama satırı `.mine-legend` (`p/why-table.png`); Sırayla ekranında 0 (o örnekte dokunan madde yok) |
| Sohbette seçenek adı tıklanır, parlama | evet | `.chat-ref` "Jardim Stay ↗", "Casa Azul ↗"; tıklayınca panel kayar, kart `.flash` alır (150 ms), Pano'da da (`p/chatref-after.png`) |
| Kartta 'neden' satırı, uydurma yok | evet | `WhyLine`/`cardWhy`: yalnız gezinin gerçek notu/şartı/seviyesinden; Portekiz'de 1 satır (Jardim Stay), Ozora ve Durumlar'da 0 (`p` probe `why`) |
| Canlı uçuş etiketleri; veri yokken görünmez | evet | Veri yok → kutucuk yok; Boarding "Biniş başladı" (yeşil rgb 29,116,66), GateClosed "Kapı kapandı" (kırmızı), Approaching "İnişe geçiyor"; bayat (>90 dk) veri → etiket yok; Delayed → etiket yok (`p/live-*.png`, `lib/flightData.ts:143-155`) |
| Kamp mı otel mi sorusu | evet | Başlatma sohbeti: "Çadır kampı mı, karavan mı, otel mi?" + 3 çip (Tent camp, Let's rent a caravan, Hotel) (probe `start`, `p/start-fest-2.png`); kod `playbooks/festival.ts:42` |
| Açılış orb/kıvılcım ≤1,2 sn, B bozulmadan | evet | `.op-fx` 223→1119 ms (~0,9 sn), orb koltuktan çıkıp döndü, kıvılcım 9 + yıldız 5, panel kaymadı, ikinci açılışta yok; B'nin sırayla yükselmesi (`p/opening-300.png`) |
| Fotoğraf mozaiği (Mozaik\|Şerit) | evet | Mozaik 3 foto, Şerit'e geçiş, tercih `trip-radar:photo-layout` yenilemede kalıyor; 1440 ve 390 taşma 0 (K2) |
| m-sekme kayan vurgu | evet | `--ind-x` 3→262 px, geçiş 260 ms; eski görünüm 120 ms'lik gölge kopya (`mv-ghost`), yeni içerik `mv-tab-in` 260 ms, `--tab-dir` ±1 (`hareketDili.ts`, probe `motion2`) |
| m-iskelet | evet | 0,4 sn altında yok (200 ms: 0); sonra kesikli iskelet, ışık 1,3 sn, 2 satır (`p/skeleton.png`); yerleşme 380 ms + tik (`mv-swap-in`, e2e iddiası okundu) |
| m-isik + "N kayıt eklendi ✓" | evet | `.work-line` 3 px, `mv-indet` 1,2 sn; hap "1 kayıt işleniyor…" → "1 kayıt eklendi ✓" → söner (2,2 sn) |
| m-bolum aç/kapa (ızgara, kapanış da) | evet | `grid-template-rows` iki yönde de animasyonlu (0→496 px açılış, 496→0 kapanış 260 ms), altındaki bölüm kayıyor (probe `fold`); kart aç/kapa dokunulmadı |
| m-maskot zıplaması | kodla | `.ms-wrap[data-state=done] .ms {ms-hop 900ms}` (`app.css:4193`); sohbet bitişinde `justDone`; canlı kare alınamadı |
| m-nabız 2,4 sn | evet | `pk-pulse 2.4s` ölçüldü; ekranda en çok 2 halka: uzun ekranda 4 halkadan 2'si `data-np` ile durdu (probe `misc390`) |
| m-çekmece 320/220, hero 600/420 | kısmen ölçüldü | Çekmece açılış `mv-drawer 320` ölçüldü; kapanış 220 ve hero 600/420 CSS satırları okundu (`app.css:4232-4243`), canlı ölçülmedi |
| m-planakoy bölüme uçsun, sayı sıçrasın | kısmen | Plan içinden: çip 420 ms uçuyor (`["Livraria Lello",[420]]`), `.cat-n` 1,35×; Pano'dan hedef Plan sekmesi ve çip "€9" (E3) |
| m-sert: hata şeridi, mühür, internet yeşili | kısmen | Şerit çıkıyor ("Asistana bağlanamadım…", maskot oops, `p/banner.png`), `mv-banner-in/up` CSS 380/200 ms; mühür `mv-stamp 420ms` büyükten (CSS); `.reconnect.ok #16311f` (CSS); şeridin çekilmesi ve internet bildirimi canlı denenemedi |
| m-kurallar (0,4 sn, tek odak, en çok 2 nabız) | evet | 0,4 sn: iskelet ve hap kanıtlı; tek odak `body:has(.modal…)` nabzı durduruyor (CSS); 2 halka kanıtlı |
| Şimdiki gibi kalsın: açılış ipuçları, menü 25 ms | uygulanmadı (doğru) | `grep "Kart iner\|Sayı yukarı"` boş; menü satırı gecikmesi eklenmemiş (css farkında 25 ms yok) |
| Yapma/backlog: telefon gezi sayfası, para/hazırlık çekmecesi, aktarma yeri, paylaşım v2, Plan şeritleri, gezi başlatma/veri/hafıza | uygulanmadı (doğru) | grep boş (Etsy, para çekmecesi, Sıradaki karar, aktarma yeri); supabase diff boş |
| 'Yol gezisi · yakında' etiketi yok | doğru | grep boş, ekranlarda yok |
| Maskot göz kırpması, harita (FlightMap/WorldFlight) duruyor | doğru | `Mascot.tsx` wink durumu, `start/FlightMap.tsx` mevcut |
| Boş bırakılan varsayılanlar | karışık | Ayarlandı gri kapsül, Karşılaştır başlıkta, etkinlik köşe ✓ kalkık, küçük harf tür etiketi (uppercase eklenmedi), ayrı konaklama etiketi yok, hero PDF ikisinde de: doğru. **'bulamadık' mesajı: yanlış (E1)** |

## 2. İlk denetimin H1 H5'i
- H1 Seçildi yazısı: **düzeldi** konaklama, ulaşım, etkinlikte (`1440/states-sec-stay.png`, `states-sec-transport.png`, `states-sec-activity.png`).
- H2 390 px `.cat-head` ve arka yüz: **düzeldi** (`390/states-sec-stay.png`, `states-back-stay.png`; arka yüz açıkken taşma 0; kalan: E2 kozmetik).
- H3 `.ts-strip`: **düzeldi** (`app.css:5088`; Ozora ve Durumlar 390 taşma 0).
- H4 rötar kutucuğu: **düzeldi** ("Yeni kalkış 20:05 +25 dk" sarıyor, hiçbir şey kesilmiyor: `p/live-7-delayed-nostage.png`).
- H5 belgeler: akıllı saat notu (`akilli-saat-design.md:76`), K76 notu (`urun-yol-haritasi.md:456`) **var**; ilerleme tablosu K3'te güncellendi.

## D. Eski veriyle açılış (0.36.84 → yeni build)
Eski build `git archive origin/release extension` (sürüm 0.36.84), kalıcı profil `/tmp/denetim2-old-prof`; `v30-shots` ile 3 gezi tohumlandı, ek olarak **tarihsiz gezi** ("Tarihsiz gezi", Roma, 2 kayıt, tarihsiz, fotoğrafsız). Aynı profille `dist` yüklendi.
- Uzantı kimliği aynı: `ohjibcbimgmelhknmnidchpbmgjhkioi` (manifest `key` eşit).
- IndexedDB: sürüm 5 → 5; depolar ve sayılar açılış öncesi ve sonrası birebir aynı (trips 4, items 48, listings 3, messages 2, preferences 1, analyses 1; captures/docs/trash 0).
- JS hatası 0; sayfa taşması 0 (4 gezi, Plan, Gün gün 4 mod, Yolculuk, Pano).
- Yeni görünümler eski veride boş/bozuk değil: Ozora Gün gün Kompakt 11 gün, Liste/Kartlar 11 gün; Durumlar 17/17; Portekiz 7/7; fotoğrafsız demo'da gün resmi yerine soluk çizim; tarihsiz gezide Gün gün sekmesi kapalı/boş, mesaj "Tarihler kaydettikçe netleşir" (`p/old-Tarihsiz-days-Liste.png`); eski sürümde de aynı (Pano da tarihsiz/az kayıtlı gezide sekmesiz, eski build ile aynı).
- Kart sayısı farkı (önceki denetçi 7→11): kayıp değil. `.pk-card` eski ve yeni build'de aynı (7/10/16); fark yalnız etkinlik kartlarının yeni `.ev-card` sınıfı (4/3/3) ve `.ek-card` (aynı).
- Not: Supabase paylaşılan gezi kaydıyla açılış ve gerçek `chrome.storage` kullanıcı anahtarlarıyla açılış denenemedi (profilde yalnız `flightLive`, `offersSeen`).

## E. 390 px yatay taşma (`scrollWidth - innerWidth`)
| Ekran | Portekiz | Ozora | Durumlar |
|---|---|---|---|
| Plan (Kategori) | 0 | 0 | 0 |
| Yolculuk sırasıyla | 0 | 0 | 0 |
| Gün gün Kompakt / Liste / Kartlar | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Gün gün Harita | 0 | 0 | 0 |
| Pano | 0 | 0 | 0 |
| Arka yüz açık (uçuş, konaklama) | 0, 0 | arka yüz yok | 0, 0 |
| Sırayla karar ver (adımlar + "Bitti") | 0 | n/a | 0 |
| Gezi başlatma: mozaik, şerit | 0 / 0 | n/a | n/a |
| Ayrıntı pencereleri (kart, etkinlik) | 0 | 0 | 0 |
Hepsi 0 (kaynak: `e2e-output/v46b/shots-390.log`, `p390/`). Taşma 0 olsa da E2 (kart başlığı 9 px) ve E4 (hero şehir sekmeleri 76 px) 390 px'te görsel kusur.

## F. Denetlenemedi
- Tam e2e (başka koşu sürüyor); e2e'nin geçtiği iddia edilmedi.
- Gerçek şehir/otel fotoğrafı ile Gün gün Liste (ağ yok; yalnız fotoğrafsız hâl görüldü) ve Hero fotoğraf geçişi 600/420 ms (CSS okundu).
- Çekmece kapanış 220 ms canlı, hata şeridinin yukarı çekilişi, internet yok bildirimi ve "kaydedildi ✓" yeşil #16311f, mühür büyükten basılışı ve maskot zıplamasının kareleri (CSS ve kod okundu, animasyon ekranda izlenmedi).
- Plan taslağı/koyu tema, tarihsiz gezide ayrıntılı kontrol, paylaşılan gezi (Supabase) ve PS11 misafir sınırı.
- Mozaik fotoğrafları gerçek görsellerle (yoklamada gradyan yer tutucu; `img.in` gelmedi), uçuşun gerçek AeroDataBox cevabı (veri elle yazıldı).
- Chrome dışı tarayıcılar, iOS.
