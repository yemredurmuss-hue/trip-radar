# Plan v30 → v37: çizim farkları ↔ canlı kod (2026-10-13)

Salt okunur çıkarım; kod değişmedi. Canlı: `plan-v30-fix` (0.36.84). Çizimler `origin/plan-v30-wip` dalında:
v30 `docs/mockups/plan-v30/index.html` (canlıya alınmış), v31 `plan-v31-oneri` … v37 `plan-v37-bilet` (hedef).
Her sürüm bir öncekinin kopyası + üstüne eklenen CSS/JS katmanıdır (v37 = v30 + v31…v37 katmanları); fark, ardışık
`diff` ile ve v37'nin son çalışan kodu okunarak çıkarıldı. Yalnız v37'de **geçerli** olanlar tabloda; vazgeçilenler
ayrı bölümde.

Boyut: **S** ≤ yarım gün · **M** 1–2 gün · **L** 3+ gün (testler ve e2e dahil değil, yalnız uygulama).
v30'dan bu yana değişmeyenler (bölümler, hero, yapışkan şerit, ••• menü, × katlama, Pano yapısı) listede yok.

## 1. Sürüm akışı (kısa)

| Sürüm | Ne getirdi | v37'ye ne kaldı |
|-------|-----------|-----------------|
| v31 | Boş uçuş/otel, elde seçenek varsa **Önerimiz** (kesikli, "Bunu seç") ile gelir; seçenekler kenarda (Yan yana · Balon · Çekmece) | Yalnız fikir: öneriyle gelen kart + "Önerimiz" adı. Kenarda açılma, "Bunu seç", "En uygun" balonu gitti |
| v32 | Kart **Seçildi** olarak seçili gelir; değiştirmenin tek kapısı (baloncuk → kutu: seçili üstte, 3 yol: Daha fazla bul · Kendin ara · Pano, "link bırak") | Seçili gelme + tek kapı fikri. Kutu biçimi, link bırak, Pano sayacı gitti |
| v33 | Omurga → Aranıyor → Sonuçlar akışı; seçili kart çerçeveli; seçenekler kartın altında, üstüne gelince şerit | Akış (omurga/aranıyor/sonuç), "indi" animasyonu. Şerit ve alt kutu gitti |
| v34 | **Sade kart** (yalnız karar bilgisi) + **ⓘ**; "Değiştir" kartı **yerinde çevirir**; arka yüz Kaydettikleriniz · Önerimiz · Kendin ara | Sade kart, ⓘ, Değiştir N, köşe yüzü, yerinde biner arka yüz |
| v35 | Arka yüz = v30'un **büyük ızgarası**, satırın tamamı genişliğinde, satırın üstüne biner (kaymaz) | Karo ızgarası, satır genişliği |
| v36 | AI'ın seçtiği kart **taslak**: kesikli mor, beyaz, "Önerimiz"; sen seçince "Seçildi". Arka yüzde Kendin ara ve **AI'a arat** ayrı kutucuklar | Taslak görünümü, iki bölüm + sonda eylem kutucuğu |
| v37 | **Uçuş bileti** (koçanda durum dairesi, kişi başı fiyat), otelde **niyet etiketi**, **Pano** kartları ferah | Hepsi |

## 2. Fark tablosu (yalnız v37'de geçerli olanlar)

Kısaltmalar: `PC` = `src/app/cards/PlanCard.tsx`, `NC` = `cards/NeedCard.tsx`, `CS` = `cards/CardShell.tsx`,
`EC` = `cards/EmptyCard.tsx`, `TP` = `src/app/TripPanel.tsx`, `CSS` = `static/app.css`.

### A. Taslak ("Önerimiz") ve seçili gelme

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| A1 | **Taslak kart.** Uçuş ya da otel ihtiyacının elinde gerçek seçenek varsa en uygunu kartta hazır durur: **kesikli mor çerçeve, beyaz zemin**, etiket "✨ Önerimiz" (durum yalnız renkle değil yazıyla). Sen "Seç" deyince Seçildi'ye (açık yeşil, kesikli) döner; çizimde `auto` bayrağı kalkar. | Seçenekli ama seçilmemiş ihtiyaç tek **boş kart** ("Arıyoruz", "N seçenek ›"). Uçuşta seçenek yoksa EmptyTravelCard. | v31 (fikir) → v32 (Seçildi gibi) → v36 (taslak) | `TP.tsx` ~1030–1065: `group.category !== "stay" \|\| decided` → `NavGroup`, aksi `NeedGroup`; taslak buraya girer (`byRank[0]` / `decision.winner` = `lib/decision.ts`, `lib/choice.ts`). `NeedCard` (boş kart) taslakta yerine `PlanCard` + `draft` kipi. `chooseItem` (`actions.ts`) taslağı "Seçildi" yapar. CSS: `.nd-card` (kesikli) yanına `.pk-draft`. | **L** | Tasarım kararı: taslak kalıcı mı yoksa yalnız görünüm mü (SORU 1–3). Önce A2 ve C (bilet) durumları |
| A2 | **Dördüncü görünüm "Önerimiz"** durum sözlüğüne girer: Arıyoruz · **Önerimiz** · Seçildi · Rezerve · Ayarlandı. Plan anahtarında ayrı örnek kutu; bölüm başlığında "**2 önerimiz** · 1 seçildi · 1 aranıyor". | Anahtar 3 kutu (Arıyoruz, Seçildi, Rezerve); `stageLine` "N rezerve · N seçildi · N aranıyor". | v36 | `plan/PlanOrder.tsx` `PlanKey`; `plan/Section.tsx` + `lib/categories.ts` `stageLine` (745), `StageCounts`/`lifecycle.ts` `Stage` (yeni sayaç ya da türetilmiş); CSS `.pk-sw`, `.pk-ring`, `.pk-lab` (1504, 3660, 3882) | **S–M** | A1; "değişmez 3" (v30 spec) güncellenir; sayım kuralı SORU 2 |
| A3 | **Köşe yüzü** (kim kaydetti / AI): kartın sol üst köşesinde (−9 px) küçük yüz; AI'da ✨. Üstüne gelince "Önerimiz (AI)" / "Sabine kaydetti". | v30 mockup'ta kaynak satırı kartın içinde; canlıda yüz yok (`WhoseBadge` = *kimin için*, başka şey; kaydedeni gösteren `adderOf`/`WhoAvatar` yalnız arka yüz karolarında ve Pano'da) | v33 (etiket) → v34 (köşe yüzü) | `cards/WhoseBadge.tsx` (`WhoAvatar`), `NC.tsx` `adderOf` (42) dışa açılır; `CS.tsx` `CardShell` köşe slotu; CSS yeni `.who-dot` | **S** | — |
| A4 | **"Değiştir [N]"**: kartın alt satırında sol, ikinci planda hap düğme; N = diğer seçenek sayısı. Arka yüzü açar. Sağda fiyat, en sağda koyu "Rezerve et ↗". | Alt şeritte "Pano'da N alternatif" bağlantısı (`CardFoot alt`), ayrıntıda "Diğer N seçenek"; kart gövdesine basınca da döner | v32 (baloncuk) → v34 | `CS.tsx` `CardFoot` (124) `alt` prop; `PC.tsx` 181, 309 (`altCount`, `flips`) | **S** | B (arka yüz) |

### B. Sade ön yüz ve ⓘ

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| B1 | **Sade otel kartı** (Seçildi/Önerimiz): görsel + marka etiketi + puan rozeti + ad + tek satır ("İade yok" kırmızı uyarı yalnız varsa); altta [Değiştir N] · "€210 / gece" · [Rezerve et ↗]. Toplam fiyat, iptal satırı, yorum sayısı, semt, not **ⓘ'de**. | Görsel bant + marka/semt + ad + puan·söz·yorum + tarih·gece + iptal satırı + gece fiyatı üstte, toplam altta (`MediaCardBody`) | v34 (+ v37 tarih satırı çipe taşındı) | `cards/MediaCard.tsx` `MediaCardBody`, `PC.tsx` 298–302 (`rating`, `cancel`, `nights`, `area`), `lib/cardView.ts` `mediaFace`, CSS `article.pk-card .ek-band` (611) | **M** | A4, B3 |
| B2 | **Sade uçuş ön yüzü**: logo + havayolu, şehir büyük, süre·aktarma, fiyat. Sefer no, kalkış/varış kodu ve saati ayrıntısı, bagaj, kimden → ⓘ. | Başlıkta `tag` (havayolu + sefer no), `RouteArc`, canlı kutucuklar (`FlightTiles`), `FlightPeekBox` yalnız hover | v34 → v37 (bilet C1) | `PC.tsx` 213–243, 285–294; `TransportCard.tsx` | (C1 içinde) | C1 |
| B3 | **ⓘ düğmesi** (20 px yuvarlak, sağ üst): üstüne gelince ya da odaklanınca 250 px'lik balon, "etiket · değer" satırları. Uçuş: Sefer · Kalkış · Varış (+1) · Süre · Aktarma · Bagaj · Kimden (rezervede ilk belge satırı, PNR). Otel: Semt · Puan·yorum · İptal · Not · Toplam · Kimden. **Gerçek uyarılar kartta kalır** (iade yok, son 14 gün bilet). | Uçuşta yalnız fare üstü `peek` (450 ms, `tipx-peek`); otelde yok; klavye/dokunma yolu yok | v34 | `CS.tsx` `peek` prop + `TipOn` (288, 307); `cards/Peek.tsx`; `lib/cardPeek.ts` `flightPeek` (genişler: bagaj, kimden), otel için yeni `stayPeek`; yeni `InfoButton` (focus + dokunma) | **M** | — (bağımsız, ilk adım olabilir) |
| B4 | "Rezerve et ↗" birincil düğme (marka işaretiyle) tüm Seçildi/Önerimiz kartlarında altta sağda. | Seçildiyken üstte "✓ Aldım" + altta `go` bağlantı ("Bileti al ↗" / "Satın al ↗" / "Rezerve et ↗") | v34 | `PC.tsx` 143–148 `goLabel`, `CS.tsx` `CardFoot go` | **S** | SORU 5 (etiket, Aldım) |

### C. Uçuş bileti (v37)

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| C1 | **Tek bilet tasarımı**, yatay: sol ana bölüm (başlık: logo · havayolu · "· Gidiş · 1 Nis Çar" · ⓘ; rota: sol şehir 23 px kalın + altında kod·saat, ortada `ucus.png` (84×46) + "11 sa 30 dk · Direkt" (aktarmada amber "1 aktarma"), sağ şehir; alt satır) + sağda **132 px koçan** (kesik sol çizgi, alt/üst yarım daire çentikler). Her aşama aynı bileti sürdürür, yalnız renk/çerçeve/koçan değişir. | Dikey kart: üstte satır, ortada kavisli kesik rota (`RouteArc`, aktarmada nokta), altta şerit; koçan **alt kenarda** (`pk-stub`: rezervede havayolu·PNR·yolcu, seçildide fiyat) | v37 | `PC.tsx` (transport dalı 285–294, stub 328–344), `TransportCard.tsx` `TransportCardBody`, `RideCard.tsx` `RouteArc`, `CS.tsx` `CardShell`, `Silhouettes.tsx`; `EC.tsx` `EmptyTravelCard` (361); CSS `.pk-stub` (3934), `.pk-stubbed`, `.pk-stub-plan` (3331). Yeni `FlightTicket` bileşeni önerilir | **L** | A1, C2; B3 |
| C2 | **Koçanda büyük durum dairesi** (46 px): Arıyoruz/Sırada = boş kesikli gri · Aranıyor = dönen kesikli · Önerimiz = kesikli mor · Seçildi = kesikli yeşil · **Bilet alındı = dolu koyu yeşil + tik**. Altında yazı (Arıyoruz · Sırada · Aranıyor · Önerimiz · Seçildi · **Bilet alındı**) ve küçük satır ("Bilet alınmadı"; uçuşa ≤ 14 gün kala amber "Bilet alınmadı · 9 gün"; rezervede "2 yolcu"). | Üst satırda 22 px `Ring` (kesikli/amber/yeşil) + sağda `pk-lab` ("Arıyoruz/Seçildi/Rezerve"), `dateAlert` | v37 | `CS.tsx` `Ring` (15), `PC.tsx` 268–279 `topAction`; `lib/progress.ts` `dateAlert`; CSS `.pk-ring` | **M** | C1 |
| C3 | **Kişi başı fiyat büyük** (19 px/800), altında "kişi başı", altında küçük "2 kişi · €1.960". Seçildi/Önerimiz/Bilet alındı üçünde de aynı. Boşta: "Tahmini · **~€850–1.000** · kişi başı". | Seçildide koçan "Fiyat €980 · kişi başı · €1.960 toplam" (alt kenar); rezervede toplam ("€1.960 · 2 yolcu"); **boş uçuşta tahmin yok** (`estimatedRange` yalnız otel/eSIM/sigorta için çağrılıyor, `NC.tsx` 102–105) | v33/v34 (koçan fiyatı) → v37 (büyük, rezervede de kişi başı) | `lib/cardTicket.ts` `ticketPrices` (17), `ticketPriceLine`; `lib/estRange.ts` `estimatedRange` (uçuş için `perPerson` zaten var); `PC.tsx` 238 | **S–M** | C1; tahmin kuralı "en az 3 gerçek teklif" (v30 değişmez 6) |
| C4 | Boş uçuş bileti: başlıkta uçak simgesi + "Uçuş", orta metin "**Aradığımız: direkt**"; altta "N seçenek" (varsa) ya da "✨ Seçenek ara"; Sırada/Aranıyor'da çubuk. | `EmptyTravelCard`: `EmptyRoute` + "Bilet yok · 2 kişi" + Kendin ara + ✨ | v37 | `EC.tsx` 361–396; `lib/emptyCards.ts` | **M** | C1; uçuş "aradığımız" kaynağı (SORU 9) |
| C5 | Bilet alındı: alt satırda belge çipi (dosya adı) ya da "Belge eksik", sağda "Ayrıntı ›"; ayrıntıya basınca rezervasyon penceresi. | Aynı (`DocAccess`, `more`, `BookingSheet`) ama PNR koçanda ve **yalnız uçuş günü** | v37 | `PC.tsx` 311–326, `BookingSheet.tsx` | **S** | C1; PNR kuralı SORU 4 |

### D. Otelde niyet etiketi

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| D1 | Görselin sol üstünde **niyet etiketi**: yatak simgesi · **Kyoto** (kalın) · "8–13 Nis · 5 gece". Amaç: seçilen/önerilen otelin hangi ihtiyacın oteli olduğu (otel adı şehri söylemez). Etiket Seçildi/Önerimiz/Rezerve'de; tarih·gece satırı karttan kalkar (yalnız "İade yok" kalır). | Tarih `pk-date` üst satırda, şehir kartta soluk, gece sayısı `st-l` satırında | v37 | `cards/MediaCard.tsx` (stay görsel bant), `CardDate.tsx`, `lib/cardView.ts` `topDate`; CSS `.ek-band` | **S** | B1 |

### E. Kartın arka yüzü (Kaydettikleriniz / Önerimiz / Kendin ara / AI'a arat)

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| E1 | **Arka yüz kartın yerinde biner, düzen kaymaz.** Ön yüz yerini korur (`visibility:hidden`), arka yüz satırın tam genişliğinde mutlak konumlanır (JS `placeBack` ızgara genişliğini ölçer, `resize`'da yeniler), altındakilerin üstüne biner, `z-index` yüksek, gölgeli; boş yere basınca/× ile döner. | Arka yüz satırı kaplar ama **akışta**: yan kart bir satır aşağı kayar (v30 "bilerek"), aşağıdakiler iner | v34 (yerinde) → v35 (satır genişliği) | `NC.tsx` `ChoiceSheet` (198) + `section.ch-back`; CSS `.cat-card:has(.ch-back), .ek-cell:has(.ch-back){grid-column:1/-1}` (4557), `.ch-back` (4558). Yeni sarmal `.fcell` + `ResizeObserver` | **M** | SORU 6 (örtülen içerik, ekran sonu, dar ekran) |
| E2 | **İki bölüm:** "Kaydettikleriniz" (sayı; kişi/eklenti kayıtları) ve "Önerimiz" (sayı; AI). Her biri en çok **3 karo + 1 eylem kutucuğu**. Üstte: durum noktası · başlık "İstanbul → Tokyo" · tarih·kişi · "Pano'da aç · +N" hapı · ×. Boş bölümde: "Henüz kayıt yok. Eklentiyle kaydettiğin buraya düşer." / "Sana uyan başka seçenek bulamadık." | Tek ızgara: önce kayıtlılar sonra bulunanlar (✨ yüzle ayrışır), en çok 7 + sonda "Pano" karosu | v34 (3 bölüm) → v36 (2 bölüm + eylem kutucuğu) | `NC.tsx` `ChoiceSheet`: `mine`/`found` (215–218), `BACK_MAX` (196), ızgara 439; CSS `.ch-grid` (4567) | **M** | E1 |
| E3 | **Karo:** üstte görsel (otel çizimi) ya da uçuşta logo + "01:55 → 19:25", köşede yüz, etiket **Seçili** (seçtiğin) / **Kartta** (taslak, mor) / **Yeni** (yeni kaydedilen); ad; marka + puan ya da süre·aktarma; fiyat (uçuşta **kişi başı**, otelde gece başı) + "Seç". Seçili/taslak karo vurgulu (taslak kesikli mor). | `ch-tile`: görsel/saat, yüz, rozet, **uyum puanı**, marka+puan, ad, kim ekledi, ihtiyaç ✓✕, durum, fiyat, "Seç", "Neden?", "Tarihlerle aç", "Tüm detaylar" | v35 → v36 (Kartta) → v37 (kişi başı) | `NC.tsx` `tile` (247–393) | **M** | A1 (Kartta etiketi), SORU 7 |
| E4 | **"Kendin ara" kutucuğu** (Kaydettikleriniz ızgarasının son karosu): kesikli çerçeve, "Sitede açılır, tarihler dolu", marka bağlantıları (Skyscanner/Google Flights; Booking/Airbnb), alt not "Kaydettiğin buraya düşer". | Altbilgide küçük "Kendin ara" bağlantıları (`SearchRow`, `ch-self`) | v34 (bölüm) → v35 → v36 (kutucuk) | `NC.tsx` 458–463 `SearchRow`, `lib/searchLinks.ts`; `EC.tsx` `SearchRow` | **S** | E2 |
| E5 | **"AI'a arat" kutucuğu** (Önerimiz ızgarasının son karosu): lavanta zemin, ✨ yuvarlak, "Kaynaklarda yeni seçenek bulur, buraya ekler", [Ara]. Çalışırken "Arıyoruz…" çubuğu. | Altbilgide "✨ Daha fazla bul" → sohbete satır gönderir (`env.ask`) | v35 (hap) → v36 (kutucuk) | `NC.tsx` 447–452 `ch-more`, `cards/AskButton.tsx`, `CardEnv.ask` | **S–M** | SORU 8 (sohbet satırı mı, yerinde arama mı) |
| E6 | Seçeneği olan boş **Arıyoruz** kart da seçeneği varsa aynı arka yüzle açılır ("N seçenek" düğmesi). | `NeedCard` → `ChoiceSheet` (aynı iş, eski ızgara) | v37 | `NC.tsx` 110 | **S** | E1–E5 |

### F. Pano kartları (v37 "ferah")

| # | v37'de ne var | v30'da / canlıda ne vardı | Giriş | Canlı kod | Boyut | Bağımlılık |
|---|---|---|---|---|---|---|
| F1 | Daha geniş kart: şerit sütunu **296–316 px** (v30 mock: 264–280; canlı `.pn-strip` 250–272), şerit `align-items:start` (açılan "Neden?" yandakileri uzatmaz), alt satır (`act`) sarar (`row-gap 8`, "Plana ekle"/"Plan'da gör" sağa), "Neden?" ayrıntısı daha sıkı iç boşluk (12/16/14, 13 px). | Dar kart, tek satır `act`, ayrıntı açılınca komşular uzar | v37 | `board/Pano.tsx` `PanoCard` (390), `Pano` şeridi; CSS `.pn-strip` (4633), `.pn-act` (3410), `.pn-whylist` (4047) | **S** | — |
| F2 | **Uçuş karesinde görsel:** kesik yay yerine **iki şehir adı arasında `ucus.png`**. | SVG kesik yay + iki şehir (`PanoArt` `pn-arc`) | v37 | `Pano.tsx` `PanoArt` (350–366); CSS `.pn-arc` (4040–4054) | **S** | — |
| F3 | Uçuşta Pano fiyatı: **kişi başı büyük** + küçük "2 kişi · €1.960". (Çizimde `2` sabit; gerçekte yolcu sayısı.) | Yalnız "€1.960 toplam" | v37 | `Pano.tsx` 460–468 (`facts.price`), `lib/cardTicket.ts` `ticketPrices` | **S** | C3 |
| F4 | Boş "Herkes için" başlığı (satır yoksa) gizlenir. | Canlıda böyle bir başlık yok (yalnız `pn-whylist`); çizim artığı | v37 | — (canlıda karşılığı yok) | — | Gerekmez |

## 3. Sonradan vazgeçilenler (uygulanmayacak)

- **v31:** kenarda açılan seçenekler (Yan yana · Balon · Çekmece) ve seçici; kartta "Bunu seç" + "N seçenek daha / En uygun" balonu; uçuş numarasının gizlenmesi.
- **v32:** "baloncuk → kutu" (seçili üstte, altında satırlar); üç eşit yol düğmesi (Daha fazla bul · Kendin ara ▾ · Pano N); **"bulduğun linki buraya bırak"** kutusu; kartta "kim koydu" satırı (`provl`).
- **v33:** kartın altında açılan `tray2`; üstüne gelince çıkan **alternatif şeridi** (`peek`); karoda **fiyat farkı** ("−€40") ve "yeni" rozeti satırı; kenar okları gizleme; `autosel` düz mor halka (sonra kesikli mor oldu).
- **v34:** kompakt satır listesi arka yüz (`bo-r`); sade uçuş kartının **eski** biçimi (`cleanFlight`: kavisli rota + fiyat alt şeritte). v37'de `ticket3` onun yerine geçti.
- **v35:** "Kendin ara" üçüncü bölüm olarak bağlantı ızgarası; Önerimiz başlığında "Daha fazla bul" hapı (v36 kutucuğa çevirdi); karo üst sınırı 4 (v36'da 3).
- **v36:** kart üst satırındaki durum noktası (`sd.tsk`) uçuşta artık koçan dairesi; "Seçili" etiketi taslak karoda "Kartta" oldu.

## 4. Çizimde görünmeyen ama kaybolmaması gerekenler

v37 uçuş ve otel kartı v30'un şu özelliklerini **çizmiyor** (çizim sadeleşirken düşmüş olabilir); kod tarafında sessizce silinmemeli.
Karar gerekiyorsa SORULAR'da.

- Kartın **••• menüsü, × (katlama), ✓ Aldım, Kimin için?** (v30 `topRight`; v37 `ticket3`/`cleanStay` çizmiyor). Önceki tur kuralı: "Bilinçli korunanlar" (v11 fark listesi).
- **Rötar/canlı uçuş verisi** (kutucuklar, kırmızı saat, `flightAlert`, `FlightTiles`, `ticketDiff`), uçuş günü PNR koçanı; çizimde `late`/`isTravelDay` yalnız v30 kartında vardı.
- **Ayarlandı** (`m:"set"`) uçuşu: v37 bunu eski karta bırakıyor, yani değişmez.
- Tarihe bağlı uyarılar: "⏳ iptal bugün biter", son 14 gün bilet, "İade yok".
- Arka yüzde: uyum puanı, "Neden?", ihtiyaç ✓/✕, "Senin için", "Seçmeden kontrol et", Karşılaştır, ‹ › + klavye okları (v19), Aradığımız çipleri. (v30 spec "Koda geçerken korunacaklar".)
- Yolculuk sırasıyla görünümü de aynı `slotCard`'ı kullanıyor (çizimde) → yeni kartlar orada da görünür; Gün gün ayrı satır standardı.

## 5. Önerilen sıra

1. **Bağımsız ve küçük:** B3 (ⓘ), F1–F3 (Pano), A3 (köşe yüzü), D1 (niyet etiketi).
2. **Kart gövdeleri:** B1 + A4 + B4 (sade otel), C1–C3, C5 (bilet; Önerimiz hali henüz çizilmeden: Arıyoruz/Seçildi/Rezerve), C4.
3. **Arka yüz:** E1 → E2 → E3 → E4 → E5.
4. **Taslak modeli:** A1 + A2 (karar SORU 1–3'e bağlı; en riskli, en son).

## 6. SORULAR (çizimde belirsiz, tasarım kararı gerekiyor)

1. **Taslak nasıl onaylanır?** v37'de taslak kartta "Değiştir" ve "Rezerve et ↗" var; "Bunu seç" (v31) kalktı ve arka yüzde taslağın kendi karosunda "Seç" yerine yalnız "Kartta" etiketi var. Taslağı olduğu gibi kabul etmenin yolu ne? (Öneri: kartta küçük "✓ Bunu seç" ya da "Rezerve et ↗"e basınca otomatik Seçildi.)
2. **Taslak kalıcı mı, görünüm mü?** Önerim: yazmayan görünüm (`byRank[0]`), kullanıcı seçince `chosen`. Sayımlar: taslak "karar bekliyor" mu, "seçildi" mi? (Çizimde bölüm başlığı ayrı "N önerimiz" diyor; ama bütçe/%hazır/halka `plan` sayıyor gibi.) Hero'daki "%77 hazır", yapışkan şeritteki bütçe ve "Sıradaki" taslağı nasıl sayar?
3. **Taslak kimlere?** Çizimde yalnız uçuş ve otel. Ulaşım (tren), eSIM, sigorta da olur mu? Kaç seçenekle (1 yeter mi)? "Gerçek seçenek": yalnız kaynaktan gelen/kayıtlı fiyatlı seçenek (uydurma yok). En uygun = `decision.winner` mı, `choice` sırası mı?
4. **PNR ne zaman görünür?** v30 değişmezi: PNR yalnız uçuş günü. v37 ⓘ rezervede ilk belge satırını (PNR) her zaman gösteriyor. Kural korunsun mu?
5. **Etiket ve düğmeler:** uçuşta "Bileti al ↗" (canlı) mı "Rezerve et ↗" (çizim) mi? "✓ Aldım", ••• ve × sade kartta nerede (hover'da mı kalsın)?
6. **Arka yüz örter:** satırın altındaki kartları kapatıyor. Son satırda/ekran altında, dar ekranda (tek sütun), Yolculuk sırasıyla görünümünde (çizimde `.grid2` bulunamazsa ölçü yok) ve klavyeyle nasıl davranır? Örtülen kartlar tıklanamaz kalsın mı?
7. **Karoda hangi ekler kalır?** Uyum puanı, ✓✕ ihtiyaç çipleri, "Neden?", "Tarihlerle aç", "Tüm detaylar", "Senin için", "Seçmeden kontrol et", Karşılaştır, ‹ ›/klavye okları, Aradığımız çipleri; v35–v37 çiziminde yok (3+1 karo sınırı yer bırakmıyor). Hangileri ⓘ/Pano'ya taşınır?
8. **"AI'a arat" ne yapar?** Canlıda sohbete satır gönderir (cevap sohbette); çizimde yerinde "Arıyoruz…" çubuğu, yeni karo gelir. Yerinde arama için AiGate/kota, hata hali ve sonuçları nereye yazacağı (Pano'ya `addedBy:"ai"`) belirlenmeli.
9. **Boş uçuşta "Aradığımız: direkt" ve tahmin aralığı** nereden gelir? Uçuş için tercih listesi (`wants`) çizimde elle yazılı; canlıda yalnız otel için `useWants`. Tahmin için v30 kuralı (≥ 3 gerçek teklif) aynen mi?
10. **Omurga → Aranıyor → Sonuçlar akışı (v33)** ürün davranışı mı, yalnız çizim kontrolü mü? Ürünse: gezi kurulurken her uçuş/otel ihtiyacı "Sırada", AI arayınca "Aranıyor" (parıltı), sonuç gelince kart "iner". L'lik ayrı iş; mevcut gezi başlatma ve boş kartlarla ilişkisi netleşmeli.
11. **Pano'da taslak:** çizimde taslak seçenek Pano kartında "Planda" şeridi alıyor (`sl.ref`). Taslak için "Plan'da gör" mü yoksa "Önerimiz · kartta" mı?
12. **Yolcu sayısı:** Pano ve bilet "kişi başı = toplam / 2" sabit varsayıyor; gerçekte `item.guests.adults` ya da gezi kişi sayısı, `price.scope`.
13. **Niyet etiketi** kamp/karavan/ayrı konaklama ("Bu geceler ayrı konaklama") ve tarihsiz gezide ne yazar? (Yalnız "Kyoto · 5 gece"?)
14. **Rezerve uçuşta fiyat:** v30 "Rezerve · €1.960 · 2 yolcu"; v37 kişi başı büyük + "2 kişi · €1.960". Rezervede de kişi başı mı?
15. **Kaydettikleriniz tanımı:** `who !== AI` (kişi + eklenti + Pano linki). "Yeni" etiketi ne kadar süre durur, hangi olaya bağlı (canlıda eklenti kaydı `capture.ts`)?
16. **Dil/etiket birliği:** "Seçili" (karo) / "Seçildi" (kart) / "Kartta" (taslak karo) / "Önerimiz" (mevcut `ax-tag` "Önerimiz" ve "AI önerisi"); İngilizce karşılıkları.
17. **Uçuş "Ayrıntı" yolu:** ⓘ balonu yalnız okuma; çizimde belge/yolcu/değişiklik "Ayrıntı"da (rezervede). Taslak/Seçildi uçuşta "Tüm detaylar" nereden açılır (kart gövdesi artık arka yüzü mü açıyor)?
