# Trip Radar arayüz kuralları

Bu panonun tek işi karar vermeyi kolaylaştırmak. Her yeni ekran ve bileşen bu kurallara uyar.

- Onaylı tasarım v82/v83 prototipidir: `docs/mockups/plan-v83-turler/` (Japonya `index.html`, festival `ozora.html`,
  gezi biçimi `turler.html`). Ölçüler ve davranış `docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md`
  (v81, v82, v83 bölümleri), kararlar `docs/superpowers/specs/2026-10-18-v82-gecis/01-kararlar.md`.
- Renkler, yazı boyları ve kutu ölçüleri `static/app.css` sonundaki `--q-*` değişkenlerinden gelir. Yeni stiller
  `static/v82/` altındaki dosyalara yazılır (hero, plan, intent, ticket, collect, journey, pano, prep, chat, motion);
  prototipin sınıf adları korunur.
- Saf mantık (durum, sayım, sıralama, metin seçimi) `src/lib/` altında ve testlidir; bileşenler ince kalır.

## Önce karar

- Bir bakışta üç şey görünür: **ne kaldı** (hero şeridinde hazırlık sayısı ve "Sıradaki" düğmesi), **ne öneriliyor**
  (niyet kutusundaki "Önerimiz"), **neden** (kutunun Ayrıntı'sı ve Pano'nun karşılaştırması). Gerisi bir dokunuş ötededir.
- Dört katman, her bilgi tek katmanda (F1): kapalı kategori satırı (K0) · niyet kutusu (K1) · kutunun üstünde açılan
  Ayrıntı (K2) · Pano (K3). Ayrıntı'nın altında "Tüm detaylar ›" (başka geziye taşı, puan parçaları, fiyat geçmişi,
  kanıt, asıl sayfa, sil; B14).
- Aynı şey iki yerde söylenmez. Öneri kısadır; uzun gerekçe Ayrıntı'da ve Pano karşılaştırmasında durur.
- Kutunun önünde yalnız karar değiştiren şey durur: seçeneği diğerlerinden ayıran ("yalnız bunda") önce; tek yorumdaki
  küçük şey, hepsinde olan şey ve bilgi (giriş saati, iptal günü) Ayrıntı'ya kalır.
- Seçim yapılınca karşılaştırma bitmiştir: kutu seçili haline döner, artı ve eksi Ayrıntı'da kalır.
- Uydurma yok. Fiyat, saat, süre yalnız kayıttan ya da hesaptan gelir. Bilinmeyen parça görünmez, "yok" diye yazılmaz;
  düzen kalanlara göre kurulur (C19).
- Seçince bildirim çıkmaz (E16). Hero'daki "Sıradaki" ve sayılar kendini günceller (F4).
- Eksik olan (dönüş bileti, transfer, alınmamış bilet) ayrı uyarı satırı değildir: omurgaya niyet olarak gelir, durumu
  tamamlanmadığını söyler (C16).

## Renklerin tek anlamı

Her rengin bir anlamı var; durum hiçbir yerde yalnız renkle anlatılmaz, yanında hep yazısı olur ("Seçildi", "Alındı").

| Renk | Anlamı | Değişkenler | Nerede |
| --- | --- | --- | --- |
| Mor | Eylem ve bizim önerimiz | `--q-acc`, `--q-acc-d`, `--q-acc-s`; kutu `--q-st-pick-bg`, `--q-st-pick-line` | Bunu seç, Rezerve et, AI'dan öner, Plana koy; "Önerimiz" çipi ve kutusu; Değiştir gibi metin düğmeleri |
| Kum | **Seçildi**: karar verildi, henüz alınmadı (B7). Tarih hattında (Uçuş, Konaklama, Ulaşım) ve çekmecede artık kullanılmaz: orada karar mor, "Planda" (onay paketi 2026-10-22) | `--q-sand`, `--q-sand-l`, `--q-sand-ink`; kutu `--q-st-chosen-bg`, `--q-st-chosen-line`, nokta `--q-st-chosen-dot` | Seçili kutunun zemini ve çizgisi, "Seçildi" ve "Planda" çipleri, kart sırasının "Planında" kartı |
| Yeşil | Alındı: rezerve edildi, bilet alındı; artı | `--q-ok`, `--q-ok-s`, `--q-ok-l`; kutu `--q-st-booked-bg` | Alındı kutusu, mühür (✓), "Belgeyi aç", "E-bilet aç", istekte ✓ |
| Yeşilin iki tonu | Yalnız hazırlık çubuğunda: koyu ton alındı, açık ton planda (B9) | `--q-ok`, `--q-ok-l` | Hero şeridi, ince şerit, kategori satırının çubuğu |
| Gri, kesikli çizgi | Karar bekliyor ya da aranıyor | `--q-st-wait-bg`, `--q-st-wait-line`, `--q-st-wait-dot` | Seçeneği olmayan ya da seçilmemiş kutu |
| Gri, düz | Ayarlandı, Dahil, Gerek yok | `--q-st-arranged-dot` | Transferi kendin ayarladın, paketin kapsadığı kutu, katlanan kutu |
| Amber | Süre ve belge uyarısı | `--q-warn` | 14 gün kala "belge yok" (B15), yaklaşan Hazırlık günü, vize gerekiyor |
| Kırmızı | Eksi, şart karşılanmadı, kaçan gün, geziyi sil | `--q-bad` | İstekte ✕, eksi, son günü geçmiş Hazırlık maddesinin günü (yumuşak kırmızı zeminde), "Geziyi sil". AI hatası kırmızı değildir: yan sütunda ince gri satır (E15) |
| Kategori renkleri | Yalnız hangi kategori | `SECTION_META` (`src/app/plan/sectionMeta.ts`): uçuş `#6a4fe0`, konaklama `#23998b`, ulaşım `#2563c9`, etkinlik `#a8336f`, yapılacaklar `#1f7a45`, belgeler ve internet `#0f7a5e`, hazırlık `#475467`, İlham `#c0256b` | Kategori satırının ikonu, kart sırasının çizimi |
| Tür renkleri | Yalnız hangi tür | `cardKindColor` (`src/lib/cardKinds.ts`): tren `#2563c9`, otobüs `#d9480f`, minibüs `#e8890c`, vapur `#0e8fb0`, taksi `#d29a00`, araç `#475467`, motosiklet `#c0256b`, karavan `#8a6534`, bisiklet `#5d8a1c`, eSIM `#3b6fd1`, sigorta `#0f8a6a` | Tür ikonu, siluet çizgisi, ekleme penceresinin kutuları |

- Açık kategoride niyetler soldaki dikey çizgiye bağlıdır; noktanın rengi durumdur: kesikli gri karar, mor önerimiz,
  kum seçildi, yeşil alındı, gri ayarlandı. Kutunun zemini durumun açık rengi, içindeki çerçeve beyazdır. (Tarih hattında
  nokta yalnız tarihi taşır; durum resmin köşesindeki işarettedir: aşağıda "Planlamanın dört adımı". Uçuş'ta hat durumu
  da çizer: aşağıda "Karar Masası".)
- Gezginin istekleri kutunun başlığında: ✓ var (yeşil), ✕ yok (kırmızı). Sayfanın söylemediği ("?") gösterilmez, veride
  kalır (B5). Varsayılanlar bu satıra girmez; yalnız söylediği, ayarladığı ya da sezilen öncelik.
- Satırlar somut yazar (kaç dakika, kaç puan, hangi saat); "Yakın", "Zor saat" gibi tek kelime yetmez. Bulgu kendi
  sözleriyle yazılır; genel bir konu adı ("Olanak eksik") yazılmaz.

## Yazı ölçeği

Plan sayfasında dokuz boy var, başkası yok (v81). Değişkenler `--q-fs-*`:

| Boy | Değişken | Ne için |
| --- | --- | --- |
| 11 | `--q-fs-badge` | rozet, kaynak etiketi, sekme sayısı |
| 12 | `--q-fs-small` | küçük satır, çip, durum çipi |
| 13,5 | `--q-fs-info` | bilgi satırı, ikincil düğme, tarz çipi |
| 15 | `--q-fs-button` | ana düğme, seçenek satırı |
| 17 | `--q-fs-card` | kart başlığı, kategori satırının adı |
| 19 | `--q-fs-intent` | niyetin adı, Yolculuk bölümünün başlığı |
| 22 | `--q-fs-category` | Yolculuk'ta şehir bölümünün başlığı |
| 24 | `--q-fs-price` | büyük fiyat |
| 30 | `--q-fs-page` | sayfa başlığı ("Plan"), kapaktaki gezi adı |

- Sohbet sütunu bu ölçeğin dışındadır (v81 notu). Gün gün yeniden çizilmedi; yalnız bu ölçeğe ve yeni renklere uyar (A3).
- Türkçe büyük harfle etiket yazılmaz (İ/i sorun çıkarır); etiketler küçük ve gri olur. `text-transform: uppercase`
  yeni bir etikete konmaz.
- Sayılar hizalı durur (`font-variant-numeric: tabular-nums`).
- Gri yazı `--q-mut`; daha açık gri zeminde okunmaz, kullanılmaz.

## Niyet kutusu standardı

Her ihtiyaç bir niyet kutusudur ("Porto'da 3 gece", "İstanbul → Porto"). Kutunun boyu içindeki yazıya, bilginin
gelip gelmemesine ve duruma göre değişmez (v82). Plan'da her şeyin kendi kartı olması kuralının yerini bu aldı.

**Sabit ölçüler** (`static/app.css`, `--q-*`):

| Parça | Ölçü | Değişken |
| --- | --- | --- |
| Başlık | 76 px: görsel 52, ad 19 px, tek satır bilgi ve istekler, sağda durum · Pano · ⋯ | `--q-head-h` |
| Gövde | 196 px (masaüstü) | `--q-body-h` |
| Yan sütun | 232 px: üstte fiyat ya da kod, altta ana eylem 42 px ve ikincil satır 32 px | `--q-side-w`, `--q-act-h`, `--q-act2-h` |
| Kart sırasının kartı | 224 px (Etkinlik, Yapılacaklar; 4 sütun) | `--q-card-w` |
| Pano kartı | 220 px ızgara; tek seçenek de büyümez | `--q-pano-w` |
| Karşılaştırma sütunu | 280 px | `--q-col-w` |

- **Tekli kutu 288 px** (Uçuş, Konaklama ve Ulaşım'da artık tarih hattı, aşağıda): 1440 ve 860 px'te her durumda aynı yükseklik, iki dilde (A6). Ölçüm:
  `scripts/v82-shots.mjs` → `heights.json`.
- **Çerçeve aileleri:** konaklama, eSIM ve sigorta: görsel 196 | bilgi dört satır (marka ve puan ya da durum, ad, konum
  ya da tarih, çipler) | yan sütun. Uçuş, tren ve transfer: bilet (taşıyıcı satırı, şehirler ve istasyon ya da saat,
  çipler) | aynı yan sütun; aktarmalı uçuş tek niyet, iki koçan (D7). Etkinlik ve Yapılacaklar: şehir başına iki
  sıra, "Planında" ve "Öneriler", sırada dört kart. Planında plana konan her kartı gösterir, dörtlü sıralar halinde;
  son sıra boş yuvalarla dörde tamamlanır, hiç kart yoksa dört boş yuva ("Henüz plana koymadın"). Öneriler tek sıradır,
  fazlası "+n Pano'da" (Emre, 19 Ekim).
- **Durumlar aynı çerçevede:** Karar bekliyor (aynı yükseklikte en çok 3 seçenek, "4 · ilk 3, tümü Pano'da"),
  Önerimiz (fiyat ve "Bunu seç"; onaylanana kadar planda sayılmaz), Seçildi (fiyat, Rezerve et ya da Satın al, altında
  Aldım · Değiştir), Alındı, Ayarlandı, Dahil, Aranıyor (boş görsel, bölge çipleri, Kendin ara simgeleri, AI'dan öner).
  AI ya da gezinin biçimi bir kutuyu açtıysa kutu Aranıyor ya da Önerimiz başlar, asla Alındı ya da Ayarlandı (D3).
- **Alındı = erişim:** karar bitti, ulaşmak önemli. Fiyat önden kalkar; yan sütunda küçük "€900 ödendi" (B10). Öne
  çıkan: kod ve kopyala, giriş ve çıkış ya da kalkış saati (her zaman, B1), "Belgeyi aç" ya da aynı boyda kesik çizgili
  "Belgeyi ekle". Belgesi eklenmemiş rezervasyon 14 gün kala amber "belge yok" der (B15).
- **Değiştir** kutuyu büyütmez: seçili kart yerinde seçeneklere döner, seçili olan işaretli, "Vazgeç" ile geri.
  Seçenek başlığının sağında "Kendin ara"; karşılaştırma Pano düğmesindedir (B12).
- **Ayrıntı** kutuyu büyütmez: kutunun üstünde açılır, Esc ve × kapatır, odak ⓘ'ye döner.
- **⋯ menüsü:** Ayrıntı, Gerek yok, Ben hallettim (Ayarlandı; B13). Gerek yok denince gövde katlanır, kutu kategorinin
  sonundaki "Gizlenenler · n" altına iner, Geri al ile yerine döner (F3, E7).
- **Dahil:** bir alım başka kutuları kapsıyorsa (festival bileti kampı, Hakone Free Pass vapuru, kiralık araç aradaki
  yolları) kapsanan kutu "Dahil · … ile" der, karar istemez ve kapsayanın durumunu izler (D2, D10; spec §1.3).
- **Kısa bilgi satırı:** gezinin biçimi bir kategoride bir şeyi değiştirdiyse (kamp bilete dahil, yakın havalimanı,
  kapanan öneriler) o kategorinin başında tek satır. Değişiklik yoksa satır yok (spec §1.4).
- Niyetin adı tek satırdır; sığmazsa "…" ile biter, tam hali ipucunda ve Ayrıntı'da.
- 390 px'te yapı aynı kalır: görsel solda, bilgi sağda, yan sütun alta iner, istekler alt satıra kayar. Bu genişlikte
  eşit boy sonraki iştir (A8).

## Planlamanın dört adımı (onay paketi 2026-10-22)

Tarih hattındaki her satır dört adımdan birinde durur; adım satırın resminin (ikon, logo, fotoğraf) köşesindeki işaretle
ve türün kelimesinden sonraki sözle söylenir (konaklamada şehir kartta değil hatta: şehir değiştiği yerde iğneli bir
nokta ve şehrin adı, tarihsiz; tarih ve gece soldaki sütunda), renkle tek başına asla (`lib/rowView.ts` `rowStage`, `app/plan/v82/
modeIcons.tsx` `StageGlyph`, `static/v82/stages.css`). Onaylı çizim: tuval "Plan satırları · onay paketi".

| Adım | Ne demek | İşaret | Kart | Sağdaki tek şey |
| --- | --- | --- | --- | --- |
| Seçenekler | Düşünülüyor, karar yok | kesik halka | kesik kenar, soluk zemin | Seç ve sayı (tek önerimizde "Seç", "Bunu seç" yok), Ara |
| Planda | Karar verildi; önceden alınacak ya da yerinde ödenecek | mor halka, ortası dolu | düz beyaz kart | Satın al ↗ / Rezerve et ↗; rezervasyon gerekmeyende "Yerinde alınır" ("İskelede alınır"), fiyat tahmini ya da "Fiyat yaz" |
| Alındı (konaklamada Rezerve, "Ben hallettim"de Sen hallettin) | Ödendi; geriye yalnız bilet kaldı | yeşil halka içinde tik | düz beyaz kart | sakin yeşil "Bileti ekle" / "Onayı ekle" |
| Bilet elde (konaklamada Onay elde) | Kodu ya da belgesi var | dolu yeşil tik | ince yeşil çizgi | satırın ucunda bilet koçanı: kod ve adı (konaklamada kod değil: "giriş 15:00 · €210 ödendi"; numara Ayrıntı'da), kesik yırtık ve iki çentik |

- **Sarı yalnız sorun için.** Normal ilerlemede kum ya da amber yok; "belge yok, yolculuğa az kaldı" gibi gerçek sorun
  amber kalır. Ödenen tutar bir kod ya da belge desteklemeden yazılmaz (sayfanın fiyatı "ödendi" diye gösterilmez).
- **Aldım bir kutu açar** (`ProofAsk.tsx`): beyaz, satırın altında; "Güzel, alındı. Bileti de ekleyelim mi?", PNR ya da
  rezervasyon no, "PDF ya da e-postayı bırak", "Bileti ekle", "Şimdilik yalnız işaretle", "Vazgeç". Sitenin Satın al ↗
  düğmesinden sonra "Aldın mı? Aldıysan bileti de ekleyelim." ve "Henüz almadım". Kod büyük harfle kayda yazılır,
  bırakılan belge okunur (`docReader`).
- **Hat tarihi taşır:** noktası her adımda aynı sessiz halka; konaklamanın tarihi giriş günü tam ay adıyla ("27 Kasım") ve
  altında gece, ay değişse de iki satır; çıkış günü kartın üçüncü satırının başında ("Çıkış 1 Aralık Salı", rezervede
  saatiyle).
- **Kategori başlığı:** tek çubuk dört adımın renklerinde (koyu yeşil bilet elde, açık yeşil alındı, mor planda, gri
  seçenek) ve tek satır: "2 alındı · 1 planda · 1 karar" ("karar" basınca ilk karara gider), gecenin sorunu ("1 gece
  boş") aynı satırda.
- **Türün ikonu:** MingCute dolu ikonlar (Apache-2.0, `static/licenses`), koyu, açık gri 48 px karoda: tren yandan, taksi
  önden, vapur, otobüs, minibüs, scooter; kategori başlıklarında uçak, otel, tren. Uçuşta havayolunun logosu (uygulamanın
  içinde, `static/logos/airlines`, airlogos MIT; yoksa harfleri ve markanın rengi), konaklamada otel fotoğrafı.
- **Hero'da, yer kaplamadan:** "%71 hazır"ın üstüne gelince "Planın durumu" (dört adımın sayısı, renkli çubuk);
  "Sıradaki"nin üstüne gelince "Sıradaki işler" (önce seçilecekler, sonra alınacaklar, sonra eklenecek biletler;
  `planSteps`). Planın üstünde ayrı kutu yok.

## Karar Masası: Uçuş'un dili (onay paketi 2026-10-22, "Onaylananlar")

Kararlar `docs/superpowers/specs/2026-10-22-karar-masasi-kararlar.md`, geçiş planı
`docs/superpowers/plans/2026-10-23-karar-masasi-gecis.md`; tuval "Karar Masası", sayfa "Onaylananlar". Önce Uçuş
(`lib/rowView.ts` `isDeskRow`, `static/v82/desk.css`, `.q-int[data-desk]`); Ulaşım ve Konaklama aşağıdaki dört adımın
bugünkü sözleriyle kalır, aynı dil onlara ayrı bir adımda geçer.

- **Rota uçakla:** "Bangkok ✈ İstanbul": iki ucun arasında 15 px uçak (çekmecede 22 px); ekran okuyucu ve arama için
  arkasında görünmeyen "→" durur, düz metinlerde (ipucu, hero, Sıradaki işler) "→" kalır.
- **Tek düğme, hep sağda:** her hâlin tek eylemi sağdaki 118 px yuvada. Açık biletin altında yalnız bağlantılar, tek
  satır: "Skyscanner'dan · Değiştir 7 · ✓ Aldım"; alınınca bırakma alanında düğme değil "ya da dosya seç".
- **Aranacak / Aranıyor:** kesik kenarlı soluk kart, beyaz kesik karoda uçak, köşesinde kesik "+" (bulduğunu ekle:
  çekmeceyi ve "+ Seninkini ekle"yi açar), sağda "Kendin ara ↗" (rota ve günle dolu ilk site). "Aranıyor" yalnız AI ya da
  kaynak gerçekten ararken yazar: karoda dönen halka, saat ve fiyatın yerinde yükleniyor çubukları. AI'ya sormak ⋯
  menüsünde "AI arasın" ve çekmecede "AI yeniden arasın".
- **Deste:** beyaz kart, ince lila çerçeve ve altında iki ince lila kat; işaretin yerinde üç logolu yelpaze (en iyisi
  önde); söz "7 seçenek", satırda en iyisinin taşıyıcısı, saatleri ve aktarması, fiyatın altında "en iyisi"; sağda
  "Seç 7" (sayı beyaz kutuda). Desteye basmak da çekmeceyi açar; satırın altında açılan gövde yok.
- **Çekmece:** başlıkta uçak; Kaynak yuvası "↗" ile sitenin sayfasına gider; gezginin kendi kaydı altın çerçeveli,
  "Senin · Kiwi.com'dan kaydettin" (`i18n.fromName`); en altta "+ Seninkini ekle: bağlantıyı bırak ya da ekran görüntüsünü
  sürükle", siteler ve "AI yeniden arasın".
- **Seçtin:** seçince çekmece kapanır, satır kendiliğinden açık bilet olur; mor 1,5 px çerçeve, köşede yarım dolu halka,
  söz "Seçtin", sağda "Satın al ↗". Değiştir aynı çekmeceyi seçili olan işaretli açar.
- **Bilet alındı:** düğme gider; sağda yeşil koçan ve üstünde yuvarlak, çift halkalı, dik damga ("Alındı" ve işaretlendiği
  gün; "Ben hallettim"de "Senin"), yarısı yırtık çizgiye taşar; koçanda "Bileti ekle" bağlantısı. Kart açık gelir; açıkken
  damga biletin yanında 96 px, altında "Son adım: bileti buraya bırak". Basılırken mühür hareketi (`mv-stamp`).
- **Bilet elde:** koçanda kod ve etiketi; açıkken "Bileti aç", "Takvime ekle"; 48 saat kala "Online check-in ↗", uçuş
  günü kodu kopyalama ve canlı durum aynen kalır.
- **Hat bağlanır (Uçuş):** soldaki çizgi yolculuğun kendisi. Her satır noktasının altında kendi parçasını çizer: alınan
  yeşil 4 px ve art arda alınan bacaklar noktadan noktaya tek çizgi, seçilen düz mor uçları açık, deste kesik lila, aranan
  noktalı gri; nokta dolu yeşil, yarım mor, kesik ya da noktalı halka. Alınınca çizgi noktadan akıp kenetlenir. Telefonda
  çizgi yok, nokta adımı söyler. (Konaklama ve Ulaşım'da hat yalnız tarihi taşır.)
- **Kategori sayacı:** "2 alındı · 1 seçildi · 2 karar" (`rowView.stepParts`), çubuk aynı renklerde.
- **Getirme anları:** bir satırın ya da açık çekmecenin üstüne bırakılan, çekmecede yapıştırılan bağlantı ve resim o
  satırın ihtiyacına gider (`Capture.forNeed` → `Item.forNeed`, `lib/bring.ts`); sürüklerken satır "Bırak: bu satıra"
  der. Okunurken satırın altında "… okunuyor; bu satıra koyacağım"; okununca "Kiwi.com bağlantısı okundu · 4. aday oldu"
  ve yalnız bilinenle söz ("Önerimizden €86 pahalı ve aktarmalı.", `deckVerdict`), "Karşılaştır" ve "Geri al" (Elenen'e).
  Bilet ya da onay resmiyse bugünkü yol: belge okunur, kayda bağlanır. Yerini bulamadıklarımız Plan'ın başında
  "Gelenler · Nereye koyalım?" (sohbetin sorusu da kalır; birinde cevaplanınca ikisi kapanır).

## Benle gezen eklenti (onay 2026-10-23)

İki seviye; ikisini de gezgin açar (PRIVACY.md §4).

- **Seviye 1, söz bozulmadan** (`lib/candidateTabs.ts`): çekmecenin altında "Adayları sekmelerde aç · 3": sıralamanın ilk
  üçü (sayfası olanlar) rotanın adıyla ("Bangkok ✈ İstanbul") mor bir Chrome sekme grubunda, ilki önde; her sekmede
  eklentinin simgesi "1/3", "2/3". O sekmede simgeye basınca açılır pencerenin başında "Aday 2/3 · Bangkok ✈ İstanbul",
  adı ve fiyatı, "Buna karar ver" (plandaki seçim olur) ve "Burada satın al" (sekme kapanınca plan satırı açıp "Aldın mı?"
  der). Planındaki bir uçuşun arama sayfasında: "Bu arama planında · Tayland", rota ve gün, "Destende 7 seçenek var";
  kayıt o satıra gider, listedeki öteki uçuşlar da desteye girer.
- **Seviye 2, "Sitede benle gel"** (`src/companion.ts`, `lib/companion.ts`): açılır pencerede "Skyscanner'da benle gel"
  (Chrome o site için izin sorar; "…'da benle gelme" geri alır). Yalnız adres planındaki bir uçuşun aramasıyken sayfanın
  üstünde koyu ince şerit: "Trip Radar · Bangkok ✈ İstanbul", "Tayland planında · destende 7 seçenek", "Ekrandakileri
  desteye ekle", "Planı aç", ×. Her sonucun sağ üstünde mor "+" ve yanında desteye göre yeri: yeşil "Destende var",
  lila "Destedekinden €38 ucuz" ya da "Direktlerin en ucuzu". "+" basılınca yeşil ✓. Çizilen her şey kapalı bir shadow
  kökünde, sitenin kendi öğelerinin içine değil; sitenin bağlantıları değişmez.

## Tarih hattı: Uçuş, Konaklama, Ulaşım (plan v14, onay paketi 2026-10-21)

Bu üç kategoride 288 px kutunun yerini tarih hattı alır (`static/v82/rows.css`, `app/plan/v82/IntentRow.tsx`, saf
mantık `lib/railDates.ts` ve `lib/rowView.ts`). Etkinlik, Yapılacaklar ve Belgeler ve internet yukarıdaki kutuda kalır.

- **Hat:** solda tarih sütunu (yolda gün ve haftanın günü; konaklamada "27 Kasım" ve "4 gece"), her gece bir çentik,
  sessiz nokta. Durum noktada değil, satırın resminin köşesinde (yukarıda "Planlamanın dört adımı").
- **Yol satırı** (uçuş, tren, otobüs, feribot, transfer): ince satır; solda taşıyıcının logosu ya da türün ikonu,
  üstte küçük tür ve adımın sözü ("Tren · Planda", "✨ Önerimiz"), ad iki uç, altında saatler ve aktarma; sağda tek şey
  (Ara · Seç ve sayı · Satın al ↗ · Bileti ekle · koçan). Basınca altında bilet gibi açılır: solda yolun çizimi büyük
  (dar kartta yok), kalkışta saat büyük ve şehir ile istasyon altında, arada kesik çizgide türün ikonu, varış; sağda
  adım büyük (Bilet elde ve belgesi, ya da Alındı); alındıysa altında "Son adım: bileti buraya bırak" alanı (dosya
  sürüklenip bırakılır ya da seçilir); yerinde alınacaksa "Biletini Krabi iskelesinde alırsın", fiyat ve Aldım. Gün,
  süre ve aktarma satırın kendisinde, açılınca tekrar edilmez. Açık hâli kayda bağlıdır, uçlar yazılırken kapanmaz.
- **Konaklama ve Kiralama kartı:** katlanmaz; fotoğraf solda, üstte şehir ve gece ("Bangkok · 3 gece") ya da tür ve gün
  ("Motosiklet kiralama · 3 gün"), ad, site ve semt; sağda gece fiyatı ve toplam, tek düğme. Karta basmak çekmeceyi açar
  (seçilide Değiştir), rezervede Ayrıntı açılır. Altında şeritler: yeşil rezervasyon (giriş, ödenen, onay, sayfa),
  amber saat bağı (Geç giriş bildir / Geç çıkış sor; `lib/stayTiming.ts`, legs.ts'in notlarından), lila "Rotayı onayla".
- **Yerinde:** rezervasyonu olmayan yol (taksi, metro) sade bir satır: "Taksi · Planda", rota, "rezervasyon
  gerekmez", sağda "Yerinde alınır"; açılınca yollar (her biri "rezervasyon gerekmez" ya da "rezervasyon ister · kart olur"), Ben hallettim,
  Haritada aç ↗.
- **Kaçırdıklarımız:** iki konaklama arasında kısa açık gece amber "boş gece" satırı; iki kaydın aynı geceyi tutması
  kırmızı "çakışan gece" satırı ve "Birini kısalt"; kategori kapalıyken de satır özetinde "1 gece boş" (amber),
  "1 gece çakışıyor" (kırmızı).
- **Kaçırdıklarımız, 2. tur:** AI ararken sağdaki yuva lila "Aranıyor…" der (ilk seçenek gelince deste olur).
  Tarihi olmayan niyetler hattın sonunda "Tarihi yok" çizgisinin altında, yuvalarında "Tarih ver" (kendi kaydında tarih
  orada yazılır). Seçili oda sayfadaki kişi sayısından farklı sayıda kişi için seçilmişse amber "Bu oda 3 kişiye uygun
  mu?", çekmecede "fiyat 2 kişi için, yeniden ara". Rezervede "Ücretsiz iptal … dek" ve "Takvime ekle" (`lib/ics.ts`:
  geceler ya da saat, iptalin son günü 3 gün önce alarmla). Karttan eklenen onay okunur (`docReader`): numara, ödenen,
  giriş. Ortak gezide beğenenler çekmece kartının fotoğrafında; ağırlıklı puanı değiştirmez.
- 700 px altında tarih karta tırmanır, satır iki sıraya iner (fiyat görünür kalır).

## Çekmece standardı (onay paketi 2026-10-21)

`app/plan/v82/IntentDrawer.tsx`, `static/v82/drawer.css`, saf mantık `lib/drawerCard.ts`.

- **Başlık üç satır:** deste ve sayı, ad ve "ne zaman · kaç kişi"; Ölçütler (lila şart, gri tercih, "+ ekle");
  Seçenekler / Elenen anahtarı ve Sırala. Konaklama ve kiralamada sıralamanın ağırlığı tek çubuk (Yorumlar · Özellikler ·
  Fiyat yüzdeleri, karar motorunun kendi ağırlıklarından toplanır; uydurma yok) ve yanında "Ayarla" (`WeightTuner.tsx`):
  "Neye göre sıralayalım?", Dengeli · Fiyat önce · Yorumlar önce · Konum önce ve üç kadran (0–4, 2 varsayılan); kadran
  grubunun ölçütlerini bu kategori için gezide değiştirir (`decision.withPriorities`), kartlar hemen yeniden sıralanır.
- **Konaklama / kiralama kartı:** fotoğraf önde ve tam genişlik, üstünde "91 · 1. sırada", köşesinde sayfanın iki fotoğrafı
  daha ve "+n" (galeri: sayfa kaydedilirken ilk sekiz fotoğrafın yalnız adresi saklanır, `items.galleryOf`; basınca
  büyük görünüm, ← → ve Esc); "✓ Seçili" mor; ad, site ve semt, puanın üç
  parçası; sağda fiyat ve büyük Seç ("✓ Seçili"); beş etiketli yuva hep aynı sırada (konaklama: Kahvaltı, İptal,
  Merkez, Puan, Kaynak; kiralama: Sigorta, İptal, Teslim, Puan, Kaynak); yorumlardan artılar ve eksiler hep açık.
  Kaydın söylemediği yuva gri "bilinmiyor" (C19).
- **Bilet kartı:** biniş kartı (saatler büyük, süre ve aktarma arada), fiyat ve Seç, beş yuva (uçuş: Bagaj, El bagajı,
  İade, Varış, Kaynak; tren ve otobüs: Kalkış, Varış, Süre, İade, Kaynak), "Neden 91?" (önerimizde açık). Birden çok
  günde uçuşlar gün bandının altında (52 px karo, "istenen gün", "bir gün sonra"); komşu günün puanı amber.
- Fiyat iki günden eskiyse amber "n gün önce · Yenile"; düştüyse lila "Dün €71 idi".
- Altta "Yeni bul" kutusu (bağlantıyı buraya bırak, bakılacak siteler, AI yeniden arasın) ve "Pano'da karşılaştır →".
- Kart iç yerleşimi kabın genişliğine göre (container query): telefonda ve dar sütunda Seç tam genişlik, yuvalar sarar.

## Hero = mozaik

Gezinin özeti planın üstünde, kendi açık mor zemininde, yuvarlak bir kutuda durur; altında 40 px boşluk, sonra "Plan"
başlığı (v82). Bileşenler `src/app/hero/`, biçim `static/v82/hero.css`, saf mantık `src/lib/heroMosaic.ts` ve
`src/lib/heroStrip.ts`.

- **Mozaik:** solda büyük kapak (gezi adı 30 px, altında ana yerler "Porto · Lizbon"), sağda en çok altı kare (3 × 2;
  beş olursa dört, boşluk kalmaz). Kareler bu sırayla alınır: plandaki yerler (seçilen ya da alınan konaklama, planına
  konan etkinlik, yapılacak, restoran), Pano'ya biriken linklerin fotoğrafları, gezinin şehirleri gece sayılarıyla,
  gezinin anları (sohbetle başlarken: yemek, romantik akşam), en son fotoğrafı henüz olmayan şehir için çizim. Çizim
  fotoğraflardan çok olmaz; hiç fotoğraf yoksa yalnız kapak kalır (C19). Yüklenemeyen fotoğraf çizilmez.
- **Fotoğraf künyesi:** her karede üzerine gelince küçük "i"; çekenin adı ve kaynağı orada (C7). Fotoğraf kaynakları:
  `src/lib/cityImages.ts` (paylaşım sunucusunun `city-image` işlevi, bulamazsa Wikipedia) ve kaydedilen sayfanın kendi
  fotoğrafı. PDF kapağı aynı şehir fotoğraflarını, Seyahatlerim'deki gezi kartı hero kapağının fotoğrafını kullanır.
- **Gezi ⋯ menüsü** kapağın sol üstünde (C1): Belgeler, Paylaş, Planı PDF indir, Rotayı haritada gör, Geçmiş ve çöp
  kutusu, Yeni sohbet, Link ekle, Ayarlar; ayrı satırda kırmızı "Geziyi sil".
- **Şerit, dört bölme:** tarih (tahminse "~", ay ya da mevsimden tahminde "~ · n gece", D15) | kişiler ve hazırlık
  çubuğu ("%61 planda · %33 alındı", B9) | bütçe (bütçe yoksa "Bütçe belirle", D16) | koyu "Sıradaki" düğmesi (önce
  vize, sonra Önerimiz onayı, sonra karar bekleyen; C30). Sayıya basınca ilk karara gider, üzerine gelince hangileri
  olduğunu söyler (F5).
- **Çipler:** ülke (çok ülkede "n ülke" ve ülke tablosu, D9), hava, para, priz, saat farkı, dil, vize; uyarı çipleri
  amber ("Schengen vizesi gerekiyor", "2 belge yok"). Üzerine gelince ya da basınca ayrıntılar açılır (şehir şehir hava,
  kur, priz uyumu, "Sende 12:00 iken orada 18:00", vize ayrıntısı).
- **Küçük pencereler** (180/120 ms, E12): Tercihler "Seni böyle anladım" (kapsam etiketi, kaynak, × kaldır, AI'nın
  sorusu Evet/Hayır), Bütçe (Rezerve · Planlanan · Boşta, kategori dağılımı, iki ve daha çok kişide "Kişi başı ~€3.450 ·
  2 kişi", T5), Kimler gidiyor (yetişkin, çocuk, oda; davet, son hareket; D12).
- **Ana yerler** (revizyon 1): hero'nun şehirleri gezginin gittiği ana yerlerdir (şehir, ada, bölge), gecelediği her
  kasaba değil. Madeira'daki bir köy (Gaula) Madeira'nın içine katlanır. Hangi yerin hangisinin içinde olduğunu
  gezginin modeli söyler (şehir kümesi başına bir kez, gezide saklanır). Kod iki gerçek durağı asla birleştirmez: ülke
  ebeveyn olamaz, bilinen şehir taşınmaz, bilinmeyen iki konaklama kasabası birbirine katlanmaz. Ana yerin adı panonun
  dilinde ("Lizbon"). Plan ve Gün gün yerleri olduğu gibi gösterir.
- **Özeti küçült:** tek satır (görsel, ad, tarih · kişi · %planda · bütçe, "Özeti aç"). Aşağı kaydırınca planın üstünde
  ince şerit kalır: ad, %planda, karar sayısı, bütçe, Plan | Pano, Sıradaki.
- **Omurga yeni:** olmayan bilgi yazılmaz, yeri olmaz: yer kareleri yerine şehir kareleri, tarih "~", hazırlık yerine
  "18 ihtiyaç · 5'inde önerimiz var", tercihler satırı yok (C19).
- **Gezi sırasında** hero'nun yerine "Bugün" şeridi: tarih, hava, saat saat kalemler, şu anki satır vurgulu, geçenler
  soluk, her satırda tek eylem, altta yarının ilk işi (D8). Uçuş günü alınmış biletin çip satırı canlı şeride döner
  (kapı, biniş, rötar; C4).
- Hero'nun üstünde, ortada sekmeler: **Plan | Pano** (Pano'da kayıt sayısı).

- **Fotoğraflar hafif ve saklı** (`lib/photoCache.ts`, `hero/Photo.tsx`): gezide yalnız adresleri durur (Unsplash, Pexels,
  Wikipedia). Her biri çizildiği boyutta istenir (kapak 1280 px, kutu 480 px, renk tonu 64 px; sunucusu sıkıştırır). Gezi
  kartı, kapağın aynı adresini kullanır: Seyahatlerim'de yüklenen fotoğraf, gezi açılınca hero'da hazırdır. Sunucular
  fotoğrafı bir yıl saklanmak üzere gönderir, tarayıcının kendi önbelleği tutar; sonraki açılışta (yeniden yüklemede de)
  hiçbir şey indirilmez. Ziyaret boyunca çizilenler çözülmüş tutulur (son 40), tekrar girişte boş kare olmadan ilk anda
  çizilir. Fotoğraf hiçbir zaman beklenmez, adresinden hemen çizilir.

## Sağlayıcı kuralı

Logolu düğmeler sabit marka yazılmaz; tek kayıttan seçilir: `src/lib/providers.ts` (v81 "Sağlayıcılar dinamik
olmalı"). "Kendin ara" simgeleri, boş şehrin "…'da ara" düğmeleri ve Hazırlık'ın "…'dan al ↗" bağlantıları buradan gelir.

- Kayıt: ad, logo (rengi üstünde tek harf; eklentide çizilir, markadan indirilmez), etiket rengi, hizmet ettiği
  türler (uçuş, konaklama, tren, etkinlik, eSIM, alışveriş), ülkeler ya da "global", öne çıktığı bölge, arama şablonu,
  ortaklık.
- Seçim sırası: (1) gezginin o ihtiyaç için attığı linkin sitesi, (2) gidilen ülkede (alışverişte gezginin kendi
  ülkesinde) çalışanlar, (3) türün varsayılanları kayıttaki sırasıyla.
- Varsayılanlar: konaklama Booking.com · Airbnb · Agoda (Asya'da Agoda öne); uçuş Skyscanner · Google Uçuşlar; tren JR
  (Japonya) · Rome2rio; etkinlik GetYourGuide · Viator · Klook (Asya'da Klook öne); eSIM Airalo · Holafly; Hazırlık
  alışverişi Türkiye'den gidene Trendyol · Hepsiburada · Amazon.com.tr, başka ülkede o ülkenin Amazon'u.
- Arama bilineni taşır (şehir, tarihler, yetişkin, çocuk, oda; D12); bilinmeyeni uydurmaz.
- Yeni düğmeler `<a href>` olur. Ortak bir markanın sayfası yalnız tıklanınca ortaklık bağlantısından (tp.media) geçer;
  gezginin kendi rezervasyonunu ya da hesabını taşıyan sayfa hiç çevrilmez (`src/lib/affiliate.ts`, C33).

## Plan başlığı ve kategoriler

- Başlık: "Plan" (30 px), altında "Gezinin omurgası · n karar bekliyor" (basınca ilk karar), sağda görünüm seçici:
  **Kategoriye göre · Yolculuk sırasıyla · Gün gün**. Hero ile kategoriler arasında durum açıklaması ve "+ Ekle" yok.
- Kategoriler bu sırayla: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Yapılacaklar ve restoranlar · Belgeler ve
  internet · Hazırlık. İçinde niyet olmayan kategori çizilmez (Hazırlık her gezide var). Gezinin biçimi bir kategoriyi
  "Gerek yok" ve nedeniyle kapatabilir (D4). İlham Pano'dadır.
- Kapalı satır en az 78 px: kategori ikonu · ad ve özet ("2 şehir · 6 gece · 4 fikir") · mini görseller · çubuk ve
  "1 alındı · 1 karar" · bütçe ("€390", altında "€990 ayrıldı") · ok. Hazırlık'ta "Gezi öncesi 6 iş · sıradaki: …".
- Aynı anda tek kategori açık; gezi başına son açılan hatırlanır (B8). Açılan tek hareketle üste kayar, zaten üstteyse
  kaymaz (E1); başlık büyümez (E2).
- Ekleme: her kategorinin sonunda "+ <tür> ekle" ve listenin sonunda tek "+ Yeni ihtiyaç ekle" satırı (B6). Rota
  şeridi, durum anahtarı, plan başındaki "+ Ekle", Pano'daki "+ Link ekle" ve "Orada yapılacak" kalktı.
- Konaklama gece aralığına göre ayrılır (D6): açık geceler şehir şehir, her aralık bir kutu. Uçakta geçen gece boşluk
  sayılmaz (D14). Plan'da check-in ve check-out satırı, boş gün yok.
- **Etkinlik asla fikir değildir** (`booking.ts` `showSays`): konser, gösteri, maç, festival, open air, DJ, line-up,
  parti, canlı müzik geçen kayıt, sohbet ya da sayfa "yapılacak, rezervasyon yok" demiş olsa da Etkinlik ve turlar'a
  gider (bilet gerekir).
- Yerinde düzenleme (C2): kutudaki ad, tarih, saat ve fiyat durdukları yerde değişir. Üstüne gelince ince alt çizgi ve
  kalem; tıklayınca aynı boyda kutu. Enter ya da dışarı tıklamak kaydeder, Esc bırakır, Tab sonrakine geçer; "Kaydet"
  düğmesi yok. Sayfadan kaydedilen kayıtta değişiklik düzeltme olarak durur; üstüne gelince "sayfadaki: X · geri al".

## Yolculuk sırasıyla

- Aynı veri, gezinin yaşandığı sırayla (`src/lib/journeyChapters.ts`): Yola çıkmadan (Hazırlık, eSIM, sigorta) ·
  gidiş · şehir şehir · dönüş. Şehir bölümünde hero'daki fotoğraf, ad, tarih ve gece, "n hazır · n karar".
- Her adım: solda tarih, çizgide durum noktası, tür · durum, ad, kısa bilgi, sağda duruma göre tek eylem (Seçeneklere
  bak, Ara, Bunu seç, fiyat ve Rezerve et, E-bilet aç, Onay e-postası aç). "›" planda o niyete götürür; bir görünümde
  yapılan seçim diğerine anında yansır.
- Gezi sırasında bugünden açılır, bugünün bölümünde "Bugün" rozeti (D8). Tarihi belli olmayan gezide kapalıdır (D15).
  Uçakta geçen gece kendi satırıdır (D14).

## Pano

- Pano biriktirme ve karşılaştırma yeridir; plana konan her şey planda görünür.
- Planın üstünde pencere: ortadan büyür, dar ekranda alttan çekmece (E8); × ve dışarı tıklama kapatır, odak geri döner.
  Her yerden açılır: üstteki Plan | Pano sekmesi, her niyetteki "Pano n".
- Solda kenar menü: Tümü · Biriktirdiklerim · AI önerileri · İlham · Belgeler (sayılarıyla), altında "İhtiyaçlar"
  ağacı (kategori > niyet, durum noktası ve sayı). Vurgu kayar, içerik belirir (E9).
- **Çekmecenin büyümüş hâli (onay paketi 11):** uçuş, konaklama ve ulaşım ihtiyaçları çekmecenin kartlarıyla iki
  sütun (`app/board/v82/PanoDeck.tsx`); grubun başı çekmecenin başı gibi (ölçütler, ağırlık, Yeni bul, Kartlar |
  Karşılaştır), sağda "Seçildi: X · Plan'da gör →" ya da "Karar bekliyor". Rezerve grup tek satıra iner ("Aç ▾").
  Karşılaştır: etiket sütunu ve seçenek başına sütun; ağırlıklı puan, üç parça, fiyat, beş yuva, artılar, eksiler,
  oylar, Seç; her satırda en iyi yeşil, en zayıf amber.
- Karşılaştırma (eSIM gibi kalanlar): 280 px sütunlar, satırlar hizalı (görsel ve kim ekledi, ad,
  fiyat ve toplam, "Uyum puanı n/100 · n. sırada" ve ⓘ'de "AI analizi dahil" (B3), istekler, artılar, eksiler, puan,
  iptal, bagaj, ♥, kaynak ↗, Seç). Etkinlik ve yapılacaklarda kıyas yok, toplama ızgarası ("+ Plana koy" / "Planda").
- Beğeni tek ♥; eski oylar beğeniye çevrildi (B16).
- İlham: reels, YouTube, TikTok, blog kartları (platform rozeti, şehir, kim ekledi), "✨ İçinden yerleri çıkar" ve
  "Aç ↗". Belgeler: türe göre gruplar, her belge kendi kartına bağlı ("Kartı göster"), "Bağlanmamış" ("Karta bağla"),
  en altta "Belge ekle" (C5). Belgeler yalnız bu bilgisayarda durur.

## Hazırlık

- Açılınca en üstte "Bilmen gerekenler" (acil numara, para, priz, büyükelçilik, AI'nın günlük hayat notları; bilinmeyen
  satır yok; T8).
- Altında "2/6 hazır · güne göre sıralı" ve günlü maddeler: sağda gün ("1 Nis'e kadar", "15 Nis 11:00"), nereden geldiği
  küçük etiketle ("uçuş kartından", "sohbetten", "vize kuralından"); günü olmayan altta, "tarih yok" yazılmaz; yaklaşan
  gün turuncu, son günü geçmiş ve yapılmamış madde "geçti" der, günü yumuşak kırmızı (T3; Emre, 19 Ekim).
- Listenin sonunda katlı tek "Bavul" satırı: hava, gün sayısı ve plandaki yerlere göre gruplar nedenleriyle, alınacakta
  mağaza bağlantısı, her satırda "bana göre değil" (×), altta "Her gezide götürdüklerin" (T6).

## Sohbet ve dar pencere

- AI'nın eklediği kayıt sohbette kart olarak görünür (marka, puan, fiyat); "Planda göster" kutuya götürüp parlatır,
  "Bunu seç" kutuda seçer; altında hızlı yanıtlar (C34). Okunamayan link kesik çizgili kart: Tekrar dene, Kaldır.
- Hedef genişlik 860–1280 px. 860 px altında plan önce gelir, sohbet alttan çekmece olur (tutamak, "Asistan" ve son
  mesaj); "Planda göster" çekmeceyi kapatıp kutuya gider (A7). 390 px'te yatay kaydırma yok.

## Hareket

- Kutu içeriği durum değişince eskisi 120 ms'de söner, yenisi 260 ms'de gelir (E3). Seçilen seçenek 380 ms'de seçili
  karta dönüşür (E4); Değiştir'de kart çevrilir (E5); Plana koy'da kart "Planında" yuvasına uçar, sayı sıçrar (E6).
- Mozaik kareleri açılışta 80 ms arayla (E10). AI seçenekleri gelince 60 ms arayla yerine oturur, "Yeni" işareti alır
  (E14). Nabız yalnız AI gerçekten ararken, "Aranıyor" kutusunda (E13).
- Canlı hareket sözlüğü korunur: mühür, parlama, düşüş, aşama geçişi, uçak süzülmesi, nabız, sayaç, sekme kayması,
  pencere çıkışı.
- `prefers-reduced-motion` ve uygulamanın "Hareketi duraklat" ayarı (`body.still`) her animasyonu, geçişi ve kaydırmayı
  durdurur (E17).

## Azaltmak

- Elenen seçenek ve "Gerek yok" denen niyet (⋯ menüsü) kendi kategorisinin sonundaki "Gizlenenler · n"de durur;
  oradan Geri al ya da Geri getir ile döner. Bir rezervasyonun kapattığı seçenek onu kapatan rezervasyonu yazar.
- **Sil** kalıcıdır: onay penceresi yok, 8 saniye "Geri al" durur; kayıt belgeleriyle birlikte geri gelir. Hiçbir kayıt
  silmesi onay sormaz; silinenler 30 gün çöp kutusunda (Geçmiş ve çöp kutusu). Yalnız "Geziyi sil" onay ister.
- Sohbette söylenen ya da elle eklenen plan yerinde ya da ⋯ menüsünden değişir, Sil ile gider.
- Sayılar ve yapılacaklar yalnız öndekini sayar.

## Butonlar

- **Ana eylem** (Bunu seç, Rezerve et, Satın al, AI'dan öner, Plana koy): mor dolgu (`--q-acc`), beyaz yazı. Bir
  kutuda en fazla bir tane; yan sütunda 42 px.
- **Alınmışın eylemi** (Belgeyi aç, E-bilet aç, Onay e-postası aç): yeşil dolgu (`--q-ok`). Belge yoksa aynı boyda
  kesik çizgili "Belgeyi ekle".
- **Sıradaki:** koyu dolgu (`--q-ink`); hero şeridinde ve ince şeritte.
- **İkincil** (Aldım, Pano): beyaz, ince çerçeve.
- **Metin düğmesi** (Değiştir, Vazgeç, Tüm detaylar ›, Listeyi aç ›): mor yazı, çerçevesiz.
- **Sessiz** (Gerek yok, Ben hallettim): ⋯ menüsünde.
- Düğmeler gerçek `button` (bağlantılar `<a href>`), metinli ya da `aria-label`'lı. Açılan pencerelerde
  `aria-expanded`; Escape kapatır, odak geri döner.

## Gün gün (bu sürümde yeniden çizilmedi)

Gün gün Plan'ın üçüncü görünümüdür (`plan/PlanOrder.tsx`). Yerleşimi 0.37.1 ile aynı kalır; yalnız yeni renklere ve
dokuz basamaklı yazı ölçeğine uyar (A3). Eski kart ailesi (`.pk-*`, `.tk-*`) yalnız burada kullanılır; durum renkleri
yukarıdaki tablodadır (Seçildi kum, Alındı yeşil).

- **Liste | Kartlar** tek anahtarla iki görünüm (seçim bu tarayıcıda hatırlanır); üstte yapışkan gün şeridi (1 · 2 · 3
  · 4 · 5–6 · 7; bugün vurgulu), şehir adlarıyla gruplu ("Porto 1 2 3 · Lizbon 4 5–6 7"). İkisinde de aynı satırlar,
  aynı sıra.
- **Liste:** her gün bir kart; solda günün büyük fotoğrafı, üstünde "1. gün" hapı; sağda başlık, tarih, aç/kapa oku;
  altında saat saat akış (saat · noktalı çizgide nokta · renkli yumuşak karede ikon · tek satır). Check-in, taksi, uçuş,
  tur aynı boy ve ağırlıkta. Sigorta ve eSIM akışta yok; gün açılınca saatsizlerle birlikte altta "Gün içinde · saatsiz".
  Boş günde "+ Bu güne ekle" açmadan görünür. Satıra dokunmak Kartlar'da o kartı gösterir.
- **Gün başlıkları kodla, standart:** şehir ve gezinin günü ("Porto 1. Gün"); yanında soluk günün türü: Varış,
  Yolculuk (yeni şehrin adıyla), Dönüş, Boş gün. Rota ("Porto → Lizbon") tarih satırında. AI başlık yok.
- **Günün sırası** (`dayCards.ts` `orderRows`): saati olan satırlar saate göre; saati olmayanlar akışta durur ve
  tutamaçtan sürüklenerek (ya da ↑ ↓) yerine taşınır (`trip.dayOrder`). Saatli satır da sürüklenir: bırakıldığı yerde
  kalır, saati gizlenir ("–", `trip.dayLoose`); saate dokunup saat vermek ya da "×" onu saatine geri koyar.
- **Ray** (Kartlar): yolculuk sırasıyla gruplar; yol günü kendi başına (Varış, Yolculuk, Dönüş), aradaki şehir günleri
  birlikte ("2–3. gün", büyük şehir adı ve "N gün"). Her gün kendi panelinde; başlığı kaydırırken çubuğun altında
  kalır; satırlar Plan'daki kartlarıyla. Her günün altında "+ Bu güne ekle".
- **Saatler** (`2026-10-05-akilli-saat-design.md`): kesin olan (bilet, rezervasyon, senin verdiğin) düz; hesaplanan
  "~" ve gri, üstüne gelince nedeni ("En geç 16:40 havalimanında olmalısın; transfer ~1 sa"). Yola çıkış =
  havalimanında olma − 1 sa (Schengen içi uçuşta 2 sa, dışında 3 sa önce orada); check-out ondan önce; inişten +45 dk
  çıkış, +1 sa check-in. Saate dokunup kendi saatini verirsin, günün kalanı ona uyar; sığmazsa kırmızı tek satır.

## Dil

- Her arayüz metni iki dilde: `L("Türkçe", "English")` (`src/lib/i18n`). Kutu boyları iki dilde ölçülür; AI metinleri
  panonun dilinde.
- Türkçede tümü büyük harf yok, uzun tire (—) yok, kısa cümle. İngilizcesi doğal olsun.
- Kısa ve şehirlerle: "Porto → Lizbon", "3 karar bekliyor", "Ücretsiz iptal".
- Bilet gibi: ne → ne ("Havalimanı → Otel"), adlar ve saat alt satırda, notlar Ayrıntı'da.
- Artı ve eksi birkaç kelimedir; sayfada okunan somut şey kendi sözleriyle yazılır ("Karşısında genelev var").
