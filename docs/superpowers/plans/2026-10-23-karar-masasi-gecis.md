# Karar Masası: canlıya geçiş planı (23 Ekim 2026)

Kararlar: `docs/superpowers/specs/2026-10-22-karar-masasi-kararlar.md`. Tuval: "Karar Masası", sayfa "Onaylananlar".
Bu belge o kararların canlı koda nasıl gireceğini ve canlıda bugün olan hiçbir şeyin farkında olmadan kaybolmayacağını
yazar.

## İlke: hiçbir şey sessizce gitmez

1. Canlıda bugün görünen ve yapılan her şey aşağıdaki envanterde. Her birinin karşısında **kalır**, **değişir** ya da
   **gider** yazar. "Gider" yalnız bir karar söylediyse ve içindeki iş başka bir yerde zaten yapılıyorsa yazılır; o yer
   de yazılır.
2. Kod değişmeden önce **koruma testleri** gelir: envanterdeki "kalır" satırlarının her biri için ya mevcut bir test
   gösterilir ya da yeni bir test yazılır (vitest; çizime bağlı olanlar e2e'de). Böylece bir aşama bir şeyi düşürürse
   test kırılır.
3. **Önce Uçuş.** Yeni dil yalnız Uçuş kategorisine girer (`vm.kind === "flight"` ve Uçuş'un hattı). Ulaşım ve
   Konaklama bugünkü gibi kalır; aynı dil onlara sonra, ayrı bir adımda geçer. `rowView.ts` üç kategoride ortak olduğu
   için her değişiklik bu koşulla yazılır ve testte Ulaşım ile Konaklama'nın sözleri aynen kaldığı ayrıca denetlenir.
4. Her aşamadan sonra: `npx tsc --noEmit -p .`, vitest, `npm run build`; aşama 3 ve 6'da e2e (61 adım) ve 390 ile 1440
   ekran görüntüleri. Aşama aşama ayrı commit; sürüm yalnız "yayınla" deyince.

## Envanter: Uçuş satırı, bugün ne var, ne olacak

### Kapalı satır, hâl hâl

| Bugün canlıda | Nerede | Karar | Ne olacak |
| --- | --- | --- | --- |
| Tarihi olmayan uçuşta sağda "Tarih ver"; tarih hatta yazılır | `rowView` slot `date`, `IntentRow` `Slot` | yok | **kalır** |
| Aranacak: kesik kenar, söz "Aranacak", sağda "Ara" (AI'ya sorar ya da çekmeceyi açar), fiyat tahmini "yaklaşık" | `rowView`, `IntentBox` `askNow` | 3 | **değişir**: söz, sağda "Kendin ara ↗", köşede "+". AI'ya sorma işi gitmez: aşağıda "Açık sorular 1" |
| Aranıyor (AI arıyor): söz "Aranıyor", sağda "Aranıyor…" hapı ve üç nokta | `whileSearching`, `Searching.tsx` | 3 | **değişir**: köşede dönen halka, saat ve fiyat yerinde yükleniyor çubukları, sağda "Kendin ara ↗"; yalnız gerçekten ararken döner |
| Aranırken açılınca "AI … için arıyor · seçenekler gelince burada" iskeleti | `IntentBox` `ticket` (`z-skel`) | yok | **kalır** |
| Biriken: söz "n seçenek", kesik mor kenar ve altında iki kâğıt katı (gölgeyle), sağda "Seç" ve köşesinde sayı, fiyatta "önerimiz" ya da "ilk sırada" | `rowView` `deciding`, `rows.css:49`, `stages.css:43` | 4 | **değişir**: beyaz kart, köşede üç logolu yelpaze, iki ince lila kat, satırda en iyisinin taşıyıcısı ve saatleri, fiyatın altında "en iyisi", sağda "Seç 7" (sayı beyaz kutuda) |
| Biriken satıra basınca altında iki yarım: "Birikenler" (üç logo, sayı, fiyat, "Seçenekleri aç") ve "Yeni bul" (siteler, "Bağlantı bırak") | `IntentRow` `q-rp2` | 2, 5 | **gider**, içi çekmecede zaten var: adaylar çekmecenin listesi, siteler ve bağlantı bırakma çekmecenin altındaki "+ Seninkini ekle" kutusu. Satıra basmak da çekmeceyi açar |
| Önerimiz (AI'nın tek önerisi): söz "✨ Önerimiz" ya da "Senin kaydın", sağda "Seç" | `rowView` `suggested` | yok | **kalır**, rota ✈ ile |
| Planda: söz "Planda", sağda logolu "Satın al ↗" (sayfası yoksa "✓ Aldım"), köşede mor halka ve ortası dolu | `rowView` `chosen`, `StageGlyph planned` | 6, 9 | **değişir**: söz "Seçtin", mor 1,5 px çerçeve, köşe yarım dolu. Düğme aynı |
| Alındı: söz "Alındı", sağda yeşil "Bileti ekle" | `rowView` `booked` kanıtsız | 7, 9 | **değişir**: söz "Bilet alındı"; düğme yerine yeşil koçan ve dik damga ("Alındı", gün). "Bileti ekle" koçanın içinde bağlantı olarak **kalır** |
| Ödenen tutar yalnız kod ya da belge destekleyince | `rowView` figure, DESIGN.md | 7 | **kalır** (kural aynen) |
| Bilet elde: koçanda kod ve etiketi ("PNR"), kesik yırtık, iki çentik | `Stub`, `rowView` | 8 | **değişir**: koçanda kod ve koltuk (koltuk `ticketFace().note`, kayıtta varsa; yoksa yalnız kod) |
| Ben hallettim: söz "Sen hallettin", sağda "Bileti ekle" | `rowView` `selfArranged` | yok | **kalır** |
| Dahil (paket kapsıyor): gri hap | `rowView` `included` | yok | **kalır** |
| Sol işaret: seçilince havayolunun logosu, yoksa uçak ikonu; köşesinde adımın işareti | `TicketMark`, `StageBadge` | 4, 6 | **kalır**; yalnız köşe işaretleri değişir (yarım dolu "Seçtin", destede yelpaze) |
| Ad "İstanbul → Bangkok" (`<i>→</i>`) | `TicketRow` | 1 | **değişir**: ok yerine 15 px uçak simgesi. Düz metin geçen yerlerde (title, aria, hero ipuçları, "Sıradaki işler") "→" kalır; ekran okuyucu "İstanbul, Bangkok" yerine "İstanbul → Bangkok" okumaya devam eder |
| Satırdaki fiyatı ve tarihi yerinde düzenleme (`Editable`) | `Figure`, `RailCol` | yok | **kalır** |
| "Yeni" rozeti, dışarıdan açılınca boş alanına odaklanma, aynı anda tek satır açık | `data-new`, `focused`, `RowOpenContext` | yok | **kalır** |
| "+ Buraya ekle" (satırlar arası ekleme) | `IntentBox` `q-here` | yok | **kalır** |

### Açık satır (bilet)

| Bugün canlıda | Nerede | Karar | Ne olacak |
| --- | --- | --- | --- |
| Basınca altında bilet: kalkış saati büyük, şehir ve havalimanı, arada kesik çizgide uçak, varış; aktarma ve süre | `FrameTicket` `inRow`, `TicketMain` | 6 | **kalır** (canlıdaki gibi) |
| Altında: "X'dan", "✓ Aldım", "Değiştir" (ya da "Seçenekler (n)"), "Takvime ekle" | `IntentBox` `acts` | 2, 6 | **değişir**: yalnız bağlantılar, tek satır "kaynak · Değiştir · n · ✓ Aldım"; gövdede ikinci "Satın al" yok. Hepsi **kalır**, biçim değişir |
| Seçince satır kapalı kalır | `IntentBox` `pick` | 6 | **değişir**: çekmece kapanır, satır kendiliğinden açılır |
| Alındı açıkken: büyük "Alındı · bileti eklenmedi" işareti ve "Son adım: bileti buraya bırak" alanı | `FrameTicket` `StepSeal`, `DropZone` | 7 | **değişir**: işaretin yerine 96 px damga; bırakma alanı **kalır** |
| Alındıktan sonra satır kapalı | | 7 | **değişir**: açık gelir, kapatılabilir |
| Bilet elde açıkken: "Bileti aç" (belge) ve "Takvime ekle" | `FrameTicket` `primary`, `acts` | 8 | **kalır**, "Bileti aç ↗" |
| Kalkıştan 48 saat önce ana düğme "Online check-in ↗" | `FrameTicket` F2 | yok | **kalır** (koruma testi) |
| Uçuş günü ya da canlı durum: koçanın yerinde kod kopyalama, "Yeni kalkış 20:05" | `FrameTicket` `today`, `live` | yok | **kalır** (koruma testi) |
| "n gün kaldı" ve 14 gün kala amber "Bileti ekle · eksik" | `FrameTicket` `days`, `docMissing` | yok | **kalır** (sarı yalnız sorun için) |
| Adım ilerleyince uçağın kalkış hareketi, adım "pop"u | `useStepPop`, `z-go` | yok | **kalır**; damga basılırken `mv-stamp` eklenir |

### Aldım kutusu ve ⋯ menüsü

| Bugün canlıda | Nerede | Karar | Ne olacak |
| --- | --- | --- | --- |
| "✓ Aldım" satırın altında beyaz kutu açar: PNR, "PDF ya da e-postayı bırak", "Bileti ekle", "Şimdilik yalnız işaretle", "Vazgeç" | `ProofAsk.tsx` | 7 | **kalır**; kayıt olunca damga basılır ve bilet açılır |
| Sitenin "Satın al ↗" düğmesinden sonra "Aldın mı? Aldıysan bileti de ekleyelim." ve "Henüz almadım" | `ProofAsk` `asked` | yok | **kalır** |
| Bırakılan belgenin okunması (koltuk, ödenen) | `docReader` | yok | **kalır** |
| ⋯: Değiştir ya da "Seçenekleri gör (n)", Ayrıntı, "Pano'da aç (n)", Haritada aç, Plana koy, Ben hallettim, "Ayarlandı: geri al", Gerek yok | `IntentBox` `menu` | yok | **kalır**, hepsi |
| Gerek yok: katlanarak gider, Gizlenenler'de durur | `folding`, `hidden` | yok | **kalır** |
| Rezervasyon varken başka seçenek: önce sorar (`AskWindow`) | `replaceBooking.ts` | yok | **kalır** |
| "X yerine Y seçildi · Geri al" | `env.offer picked`, `undoables.ts` | yok | **kalır** |
| Ayrıntı katmanı (`DetailLayer`) | `IntentBox` `detailNode` | yok | **kalır** |

### Çekmece

| Bugün canlıda | Nerede | Karar | Ne olacak |
| --- | --- | --- | --- |
| 720 px çekmece; başlık, alt satır, Büyük Pano, × | `IntentDrawer` | 5, 1 | **kalır**; başlıkta 22 px uçak simgesi |
| Ölçütler (şart ve tercih, "+ ekle"), sıralama ağırlıkları | `IntentDrawer`, `WeightTuner` | yok | **kalır** |
| Sekmeler "Seçenekler n" ve "Elenen n", Kaynak süzgeci, Sırala | `IntentDrawer` | yok | **kalır** |
| Gün bantları ("istenen gün", "komşu gün") | `DayBand` | yok | **kalır** |
| Biniş kartı: sıra, Seç ya da "Seçili", "Neden n?", beş yuva, yorumlar, tazelik ve "Yenile", kalpler (oylar), fiyat ve olağan fiyat farkı, "geçici" | `TicketOption`, `drawerCard.ts` | 5 | **kalır**; Kaynak yuvası "↗" ile siteye bağlanır (bugün adını yazar), seçili olan işaretli |
| Gezginin kendi kaydı | `OptionVM.yours` | 5 | **değişir**: altın çerçeve ve "Senin · Kiwi'den kaydettin" |
| Kaynağın kendiliğinden araması (`OfferRow`) | `IntentDrawer` | yok | **kalır** |
| Alt kutu: "Bulduğun uçuşun bağlantısını buraya bırak", "Bakmak için:" siteler, "AI yeniden arasın" | `dr-new` | 5 | **değişir**: adı "+ Seninkini ekle" ve "Bağlantıyı bırak ya da ekran görüntüsünü sürükle"; siteler ve "AI yeniden arasın" **kalır** |
| Elenenler listesi ve "Geri al"; altta "Pano'da karşılaştır →" | `Dropped`, `dr-foot` | yok | **kalır** |
| Kapanınca odak açıldığı yere döner | `IntentBox` `opener` | yok | **kalır** |

### Tarih hattı, kategori başlığı, hero

| Bugün canlıda | Nerede | Karar | Ne olacak |
| --- | --- | --- | --- |
| Hat tek renk ince çizgi; nokta her adımda aynı sessiz halka | `rows.css:10`, `stages.css:12` | 10 | **değişir** (yalnız Uçuş'ta): parçalar durumdan; alınan yeşil 4 px ve öncekine kenetli, seçilen düz mor uçları açık, seçenekler kesik lila, aranan noktalı gri; "Aldım" deyince çizgi akar |
| Tarih sütunu: gün, haftanın günü; tarihsizler en altta "Tarihi yok" çizgisinin altında | `railDate`, `undatedLast` | yok | **kalır** |
| Konaklamanın gece çentikleri, şehir iğneleri, boş gece, çakışma | `railDates.ts`, `EmptyNight`, `OverlapRow` | yok | **kalır** (Uçuş'a dokunulmaz) |
| Kategori başlığı: dört adım renginde çubuk, "2 alındı · 1 planda · 1 karar", "karar" ilk karara götürür ve üstüne gelince adlarını söyler | `CategoryPlan.datedRow`, `CategoryRow` | 12 | **değişir** (Uçuş'ta): "planda" yerine "seçildi", çubuk aynı renklerde; "karar" düğmesi ve ipucu **kalır** |
| Hero: "Planın durumu" ve "Sıradaki işler" (`planSteps`) | `HeroStrip`, `rowView.planSteps` | yok | **kalır**; adım sayıları aynı mantıktan |
| 700 px altı ve 390 px telefon düzeni | `rows.css` `@media` | yok | **kalır**; yelpaze ve damga 390'da sığacak biçimde |

## Aşamalar

Her aşama ayrı commit. "Koruma" satırları o aşamanın bozmaması gerekenler; testleri aşama 0'da yazılır.

### Aşama 0: koruma testleri (kod değişmeden)

- `rowView` için Ulaşım (tren, otobüs, feribot, transfer, kiralama) ve Konaklama'nın her hâlinde söz, sağdaki şey ve
  rakam bugünkü değerleriyle sabitlenir. Uçuş'a dokunan her değişiklik bunları kırmamalı.
- Uçuş'ta "kalır" yazan hâller sabitlenir: Tarih ver, Önerimiz ve Senin kaydın, Sen hallettin, Dahil, ödenen tutarın
  yalnız kod ya da belgeyle yazılması.
- ⋯ menüsünün her hâldeki girdileri bir listeyle sabitlenir (Değiştir, Ayrıntı, Pano'da aç, Ben hallettim, Gerek yok...).
- `FrameTicket` için: 48 saat kala "Online check-in", uçuş günü kod, canlı durum, "n gün kaldı", "Bileti ekle · eksik".
- `ProofAsk` için: kod, belge, "Şimdilik yalnız işaretle", "Henüz almadım" yolları.
- Çekmece için: sekmeler, Elenen ve Geri al, kaynağın kendi araması, siteler, "AI yeniden arasın", "Pano'da karşılaştır".
- Bugün bu sözlere bağlı testlerin listesi aşağıda "Değişecek testler"de; her biri hangi aşamada güncellenecekse orada.

### Aşama 1: satırın dili (yalnız Uçuş)

- `lib/rowView.ts`: Uçuş'ta sözler "Seçtin", "Bilet alındı", "Bilet elde"; destede satır en iyisinin taşıyıcısı ve
  saatleri, rakamın altı "en iyisi"; aranacakta sağdaki şey "Kendin ara ↗" (yeni slot `self`), köşede "+".
  `planSteps` ve hero aynı adımları sayar, değişmez.
- `app/plan/v82/IntentRow.tsx`: adda ok yerine 15 px uçak simgesi (`ModeIcon plane`); düz metinler "→" ile kalır.
- `app/plan/v82/modeIcons.tsx`: "Seçtin" için yarım dolu işaret (yeni biçim; Ulaşım ve Konaklama eski halkayla kalır).
- `app/plan/CategoryPlan.tsx` `datedRow`: Uçuş'ta "1 planda" yerine "1 seçildi"; çubuk renkleri yeşil, mor, lila.
- `static/v82/stages.css`, `rows.css`: Seçtin'in mor 1,5 px çerçevesi; aranacağın kesik kartı; kurallar
  `[data-kind="flight"]` altında.
- Koruma: Ulaşım ve Konaklama'nın sözleri, Tarih ver, Önerimiz, Sen hallettin, Dahil, fiyat ve tarih düzenleme.

### Aşama 2: deste ve çekmece

- `IntentRow.tsx`: destede köşede üç logolu yelpaze (bugünkü `CarrierDeck` büyür ve döner), iki ince lila kat, "Seç 7"
  (sayı beyaz kutuda). Satıra basmak da çekmeceyi açar; altındaki "Birikenler · Yeni bul" yarımları Uçuş'ta çizilmez.
- `IntentDrawer.tsx`: başlıkta 22 px uçak; gezginin kendi kaydı (`OptionVM.yours`) altın çerçeveli, "Senin · Kiwi'den
  kaydettin"; alt kutu "+ Seninkini ekle" ve "Bağlantıyı bırak ya da ekran görüntüsünü sürükle" (siteler ve "AI yeniden
  arasın" aynı kutuda kalır). Bağlamak aşama 5'te: bugün bu kutuya bırakılan bağlantı geziye gider ve yapay zekâ
  yerini tahmin eder, resim Belgeler'e gider; çekmece açıkken yapıştırma hiç alınmaz.
- `lib/drawerCard.ts`: Kaynak yuvası kaydın adresine "↗" ile bağlanır (bugün adı yazar, `tone: "link"`).
- Koruma: ölçütler, ağırlıklar, sekmeler, gün bantları, Neden n?, yorumlar, tazelik, oylar, olağan fiyat farkı, kaynağın
  kendi araması, Elenen ve Geri al, Pano'da karşılaştır, kapanınca odağın dönmesi.

### Aşama 3: Seçtin ve Alındı

- `IntentBox.tsx` `pick`: çekmeceden seçince çekmece kapanır ve satır açılır (`RowOpenContext`); bugünkü "X yerine Y
  seçildi · Geri al" kalır.
- `acts`: tek satır bağlantı "Skyscanner'dan · Değiştir · 7 · ✓ Aldım"; gövdede ikinci "Satın al" yok. Değiştir aynı
  çekmeceyi seçili olan işaretli açar (bugün de "Seçili" yazıyor).
- Alındı: sağdaki "Bileti ekle" düğmesi gider, yerine yeşil koçan; koçanda dik, çift halkalı damga ("Alındı" ve gün),
  altında "Bileti ekle" bağlantısı ve ödenen (yalnız kod ya da belge varsa). Yeni bileşen `Stamp` (`modeIcons.tsx`
  yanında), hareket `mv-stamp` (`static/app.css:3532`), azaltılmış harekette durur.
- `ProofAsk` kaydedince satır açık gelir; açıkken `StepSeal` yerine 96 px damga, "Son adım: bileti buraya bırak" kalır.
- Bilet elde: koçanda kod ve koltuk (`ticketFace().note`); açıkken "Bileti aç ↗" ve "Takvime ekle".
- Koruma: Aldım kutusunun bütün yolları, Online check-in, uçuş günü, canlı durum, n gün kaldı, eksik belge uyarısı,
  rezervasyon değiştirirken soru, kalkış hareketi.
- e2e ve 390 ile 1440 ekran görüntüleri bu aşamanın sonunda.

### Aşama 4: bağlanan hat (yalnız Uçuş)

- `lib/railDates.ts`: yeni saf işlev `railLinks(list)`: her satır için adımı ve bir öncekiyle kenetli olup olmadığı.
  Testli.
- `CategoryPlan.tsx`: Uçuş satırlarına `data-joined`; `rows.css`: her satır kendi parçasını çizer (alınan yeşil 4 px,
  seçilen düz mor uçları açık, seçenek kesik lila, aranan noktalı gri), nokta dolu, yarım, kesik ya da noktalı.
- "Aldım" deyince çizgi uçlara akar ve kenetlenir; azaltılmış harekette ve `body.still`'de hareket yok.
- DESIGN.md: "Hat tarihi taşır" maddesi Uçuş için değişir (karar 10); Konaklama ve Ulaşım için aynen kalır.
- Koruma: tarih sütunu, tarihsizlerin en altta olması, Konaklama'nın gece çentikleri, şehir iğneleri, boş gece, çakışma.

### Aşama 5: getirme anları

Bugün var olan: Plan'a bağlantı yapıştırma ve bırakma (`useBoardIntake`, geziye bağlar), resim ve belge bırakma, belge
okuyucunun rezervasyonu doğru kayda eşlemesi (`docReader.matchDoc`), bir kutudan eklenen teklifin o kutunun rotasına
katılması (`forNeed`), soru bekleyen kayıtlar (sohbette ve açılır pencerede, gezisiz olanlar ana sayfada "Bekleyen
kayıtlar"). Bunların hepsi **kalır**. Yeni olanlar:

- Satıra ve çekmeceye bırakma: bir satırın ya da açık çekmecenin üstüne bırakılan veya çekmecede yapıştırılan bağlantı
  ve resim o satıra gider (`forNeed = vm.key`). Bugün resim Belgeler'e gidip rezervasyon gibi okunuyor; satıra
  bırakılan resim önce okunur, bir bilet ya da onaysa bugünkü yol (`docReader.matchDoc`, satır "Bilet alındı" olur),
  değilse desteye aday olur. Sürüklerken
  satır parlar: "Bırak: bu satıra". (Tarayıcı dosyanın içini bırakmadan göstermez; çizimdeki "Görüntüyü okuyorum"
  bırakınca gelir.)
- Plan'da her yerde yapıştırma bugünkü gibi; okununca hangi satıra gittiği söylenir: "Kiwi bağlantısı okundu → Bangkok
  ✈ İstanbul, 2 Nis. 5. aday oldu." ve "Başka satıra", "Geri al".
- Söz: yeni saf işlev `verdictOf(option, deck)` (`lib/`), yalnız bilinenle: "önerimizden €86 pahalı ve aktarmalı",
  "önerimizden €38 ucuz, bagaj dahil". Fiyat ya da önerimiz yoksa söz yok. Seninki öne geçerse söylenir.
- Gelenler: Plan'ın başında, bu gezinin yerini bulamadığımız kayıtları (bugün sohbette soruları duran kayıtlar) tek
  yerde gösteren ince bant, "Nereye koyalım?" ve satır seçenekleri. Sohbetteki soru kalır; biri cevaplanınca ikisi de
  kapanır.

### Aşama 6: doğrulama

`npx tsc --noEmit -p .`, vitest, `npm run build`, e2e (61 adım), 390 ve 1440 ekran görüntüleri (Uçuş'un her hâli
kapalı ve açık, çekmece, Ulaşım ve Konaklama'nın değişmediğini gösteren karşılaştırma), DESIGN.md'nin "Planlamanın dört
adımı" ve "Tarih hattı" bölümleri.

### Aşama 7: sürüm

`static/manifest.json`, `package.json`, `PRIVACY.md` sürümü; `scripts/release.sh` yalnız "yayınla" deyince.

## Değişecek testler

Bugün satırı doğrudan çizen birim testi yok; satırın sözleri `tests/rowView.test.ts`, `railDates.test.ts` ve
`drawerCard.test.ts` ile, çizimi e2e ile denetleniyor. Görüntü karşılaştırması (baseline) yok.

**Kural:** sınıf adları aynı kalır (`.q-rrow`, `.q-rslot`, `.q-rsec`, `.q-take`, `.q-cta`, `.q-proof`, `.q-rstub`,
`.q-rp`, `.q-racts`, `.q-rstage`, `data-stage`, `data-st`). e2e'nin yardımcıları (`scripts/e2e.mjs:11-33`: `openRow`,
`pressCard`, `routeOf`) 36 yerde bunlara dayanıyor; yeni görünüm yeni sınıf ekler, eskisini silmez.

| Aşama | Test | Bugün ne bekliyor | Ne olacak |
| --- | --- | --- | --- |
| 1 | `tests/rowView.test.ts:44` | uçuşta "Alındı" | "Bilet alındı" |
| 1 | `tests/rowView.test.ts:72-76` | uçuş destesinde "2 seçenek", `pick`, rakamın altı "önerimiz" ya da "ilk sırada" | söz ve slot aynı; rakamın altı "en iyisi", satırda en iyisinin saatleri |
| 1 | `tests/rowView.test.ts:104-110` | Osaka konaklamasında "Aranacak" ve `ask` | **aynı kalır**; uçuş için yeni test: `self` ("Kendin ara ↗") |
| 1 | `tests/rowView.test.ts:53, 64` | trende "Planda" | **aynı kalır** (Ulaşım'a dokunulmaz) |
| 1 | `tests/rowView.test.ts:26-27` | başlık "İstanbul → Tokyo" | **aynı kalır** (düz metinde ok; simge yalnız çizimde) |
| 1 | `scripts/e2e.mjs:1023, 1044` (adım 4) | uçuşun sözü "Alındı" | "Bilet alındı" |
| 1 | `scripts/e2e.mjs:575` (adım 4) | Uçuş başlığı "1 alındı · 1 karar" | aynı; "planda" olan yerde "seçildi" |
| 1 | `scripts/e2e.mjs:913, 975, 969, 1330` | uçuşta "Seç", "✨ Önerimiz", "Sen hallettin" | **aynı kalır** |
| 2 | `scripts/e2e.mjs:23` `pressCard` | `.q-rslot .q-rsec` | aynı sınıf "Seç 7" düğmesinde kalır |
| 2 | `openRow` ile açılan uçuş destesi | basınca altında `.q-rp` | Uçuş destesinde basınca çekmece açılır; bu çağrılar `pressCard`'a döner |
| 2 | `scripts/e2e.mjs:942-991` | çekmecenin kartları | aynı; Kaynak yuvasında "↗" ve "Senin" için yeni denetim |
| 3 | `scripts/e2e.mjs:1026` | `.q-rslot .q-proof` "Bileti ekle" | uçuşta koçanın içinde; Ulaşım'da aynı kalır |
| 3 | `scripts/e2e.mjs:1065` | `.q-rstub` "ABC123 PNR" | kod aynı; koltuk varsa eklenir |
| 3 | `scripts/e2e.mjs:985, 1069` | `.q-racts .q-chg` "Değiştir"; tek seçenekli rezervasyonda Değiştir yok | aynı sınıf, aynı kural; tek satır bağlantı |
| 3 | `scripts/e2e.mjs:1031` | "Son adım: bileti buraya bırak" | **aynı kalır** |
| 3 | `scripts/e2e.mjs:1038-1043, 1293-1296, 1408-1411` | Aldım kutusu yolları | **aynı kalır**; kayıttan sonra satırın açık geldiği ve damga eklenir |
| 3 | `tests/patagonya0388.test.tsx:168-191` | açık bilette `q-cta` "Bileti al" ve logo | **aynı kalır** |
| 4 | yeni `tests/railDates.test.ts` | | `railLinks`: kenetli, kopuk, kesik, noktalı |
| 5 | yeni testler | | `verdictOf` (yalnız bilinenle), satıra bırakmanın `forNeed`'i, Gelenler |

**Görüntüyle karşılaştırma (yeni):** aşama 0'da `scripts/v82-shots.mjs` ile Uçuş, Ulaşım ve Konaklama'nın bugünkü
görüntüleri 390 ve 1440'ta "önce" olarak alınır. Her aşamadan sonra aynı görüntüler "sonra" olarak alınır; Ulaşım ve
Konaklama birebir aynı kalmalı.

## Benle gezen eklenti: nasıl çalışacak

### Bugün eklenti ne yapıyor

- Sayfayı yalnız simgesine (ya da Alt+Shift+S'ye) basınca, o anda ve o sekmede okur: metni, görünen kısmı,
  ekran görüntüsünü (`popup.tsx` `captureActiveTab`, `lib/pagecapture.ts`). Hiçbir sitede kendiliğinden çalışan bir
  parçası yok, sayfaya bir şey eklemiyor.
- Siteye özgü okuyucu yok; sayfadan anlamı yapay zekâ çıkarıyor. Siteye özgü olan yalnız adres okuma (`lib/url.ts`:
  Booking, Airbnb, Skyscanner, Kayak, Google Flights).
- Sekme grubu izni yok (`tabGroups`), sekmeleri okuma izni yok (`tabs`).
- PRIVACY.md §4 bunu söz olarak yazıyor: "Eklenti yalnız 'Kaydet'e bastığın sekmeyi, yalnız o anda okur. Arka planda
  sayfa okumaz." §8: "Eklenti ziyaret ettiğin sitelerdeki bağlantıları değiştirmez."

Bu yüzden eklentiyi iki seviyede öneriyorum. Birincisi bu sözü hiç değiştirmez; ikincisi açık izinle ve site site gelir.

### Seviye 1: sözü bozmadan (önerim, önce bu)

1. **Adayları sekmelerde aç.** Çekmecede ve destede "Adayları aç (3)": ilk üç aday rotanın adıyla bir Chrome sekme
   grubunda açılır ("Bangkok ✈ İstanbul", mor). Yalnız `tabGroups` izni eklenir; sayfa okunmaz.
2. **Her sekmede "aday 2/3".** Açtığımız sekmeleri biz biliyoruz; eklentinin simgesinde o sekmeye özel "2/3" yazar
   (`chrome.action.setBadgeText`). Sayfaya bir şey eklenmez.
3. **Simgeye basınca (bugünkü kaydetme anı), ne olduğunu bilir:**
   - Bizim açtığımız bir aday sekmesinde: "Aday 2/3 · Qatar Airways €354", "Buna karar ver" (plandaki seçim olur),
     "Burada satın al" (sekme kapanınca plan "Aldın mı?" diye sorar), "Fiyatı tazele" (sayfayı bugünkü gibi yeniden okur).
   - Kendi bulduğun bir arama sayfasında: adresinden rotayı ve günü tanır ("Bu arama planında: Bangkok ✈ İstanbul,
     2 Nis · desten de 7 seçenek"), "Ekrandakileri desteye ekle" (görünen sonuçları bugünkü okuma ile okur, her uçuş
     bir aday olur) ya da "Yalnız bunu ekle".
   - Tek uçuşun sayfasında: "Bu zaten desten de" (bugünkü eşleştirme, `findDuplicate`).
4. **Satın aldıktan sonra.** "Satın al ↗" ile açtığımız sekme kapanınca satır "Aldın mı?" kutusunu açık bekler.
   `tabs.onRemoved` yalnız bizim açtığımız sekmeye bakar; izin gerekmez.

Gerekenler: `tabGroups` izni (Chrome bu izin için kurulumda uyarı göstermiyor; kodlarken doğrulanır), Kiwi ve Google
Flights adres okuyucusu (`lib/url.ts`), okumanın çok sonucu ayrı aday yapması (`extract.ts`), açılır pencerede yeni üç
görünüm. PRIVACY.md §4 doğru kalır; yalnız "sekme grubu" cümlesi eklenir.

### Seviye 2: "Sitede benle gel" (açık izinle, site site)

1. Açılır pencerede bir kez "Skyscanner'da benle gel": Chrome o site için izin sorar (`optional_host_permissions`,
   `chrome.permissions.request`). İstersen kapatırsın; kapatınca izin geri verilir.
2. O sitede, yalnız adres plandaki bir rotaya uyduğunda: sayfanın üstünde ince şerit ("Bangkok ✈ İstanbul, 2 Nis
   planında · 7 seçenek"), her sonucun yanında "+" ve desteye göre yeri ("direktlerin en ucuzu", "desten de var").
   "+" basmadan hiçbir şey kaydedilmez.
3. Her site için ayrı okuyucu (önce Skyscanner, sonra Kiwi, Booking, Agoda), kayıtlı sayfa örnekleriyle testli. Site
   değişip okuyucu bozulursa "+" görünmez, şerit adresle çalışmaya devam eder.
4. İçerik betiği planı kendisi okuyamaz; servis çalışanına sorar, yalnız o rotanın özetini alır. Servis çalışanı
   mesajın kimden geldiğine bakar (bugün bakmıyor; bu eklenir).
5. Gizlilik: §4 yeniden yazılır ("İzin verdiğin sitelerde, plandaki bir rotanın arama sayfasındayken sonuç listesini
   okur..."), mağaza açıklaması güncellenir. §8 aynen kalır: sitelerdeki bağlantılar değiştirilmez; "Burada satın al"
   sitenin kendi düğmesidir.

Seviye 2 site başına iş ve gizlilik sözünü değiştirir; Seviye 1 kullanılıp beğenilince başlamayı öneriyorum.

## Açık sorular

1. **"Ara" nereye gider?** Bugün aranacak satırın düğmesi AI'ya ya da kaynağa sorar. Önerim: sağda "Kendin ara ↗";
   köşedeki "+" çekmeceyi açar, kaynak orada bugünkü gibi kendiliğinden arar, "AI yeniden arasın" da orada; ⋯ menüsüne
   "AI arasın" eklenir. Böylece AI'ya sorma işi kaybolmaz.
2. **"Kendin ara ↗" tek düğme hangi siteyi açsın?** Önerim: rotayla ve günle dolu ilk site (Uçuş'ta Skyscanner,
   adresi kurulamıyorsa Google Flights); öteki siteler çekmecenin "+ Seninkini ekle" kutusunda.
3. **"Aranıyor" ne zaman yazsın?** Kimse aramıyorken "Aranıyor" yazmak doğru olmaz (uydurma yok kuralı). Önerim: söz
   "Aranacak" ve halka durgun; AI ya da kaynak gerçekten ararken "Aranıyor" ve halka döner.
4. **Eklenti:** Seviye 1 ile başlayalım mı, Seviye 2 için gizlilik metnini değiştirmeye razı mısın?
