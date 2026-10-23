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

(aşağıda)

## Benle gezen eklenti: nasıl çalışacak

(aşağıda)

## Açık sorular

(aşağıda)
