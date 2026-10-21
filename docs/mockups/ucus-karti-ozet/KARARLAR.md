# Uçuş kartı, zaman çizgisi ve çekmece: kararlar ve devir (21 Eki 2026)

Bir günlük tasarım koşusunun çıktısı. Canlı sürüm 0.39.27, canlı kod dalı `plan-v82-kod`.
Çizimler `docs/mockups/` altında, dal `zaman-cizgisi-cizim`, PR yemredurmuss-hue/trip-radar#4.
Ürün kodu değişmedi; bu dosya kodlama ve konaklama çizimleri için devir notudur.

## Onay paketi

Uçuş ve konaklamanın son hâlleri, kararlarıyla birlikte donmuş görüntü olarak: `docs/mockups/paket-ucus-konaklama/index.html` (https://claude.ai/artifact/CiJnEFPom7nGec3J5cn1ww). Emre onaylayınca kod bu pakete göre yazılır; sonraki değişiklik yeni çizim sürümüdür. Panoda kartlar çekmece kartının kendisi (iki sütun, uçuş kendi standart kartıyla).

## Kaynaklar

- Özet sayfası (kararlar ve 13 çizimin bağlantısı): https://claude.ai/artifact/QLjnt4jbdRYXbbSWnum6no
- Son onaylı hâller:
  - Plan satırları (niyet, seçili, alınmış): `docs/mockups/ucus-karti-v6/index.html` (artifact https://claude.ai/artifact/7nHKyBtfuX92qrgQXHUGCj)
  - Biriken kart ve Seç davranışı (Yol 2), dört kart aynı hatta: `docs/mockups/biriken-kart-v9/index.html` (https://claude.ai/artifact/E9CKBJyoKPXw5XFbKNGQ6G)
  - Çekmece standardı: `docs/mockups/cekmece-standart-v12/index.html` (https://claude.ai/artifact/4s45bF1d1BENJmycPp7Arg)
  - Çekmecede tarihler (A, takvim karosu): `docs/mockups/cekmece-tarihler-v13/index.html` (https://claude.ai/artifact/VgnZVxVdT7XQHyb6tmr8X1)
  - Zaman çizgisi ve konaklama dilimleri (ilk çizim, konaklama için başlangıç): `docs/mockups/zaman-cizgisi-v1/index.html` (https://claude.ai/artifact/Aw2kLN9ya87tQoXyyXwNex)
  - Düğme haritası ve kullanım eleştirisi: `docs/mockups/ucus-cekmecesi-v10/index.html`
- Canlı CSS: `static/v82/plan.css` (`.q-sec`, `.q-row1`, `.q-ints`), `static/v82/card13.css` (K79 kart, K82 çekmece `.dr-*`),
  `static/v82/intent.css` (`.q-st` haplar, `.q-src`), `static/v82/ticket.css` (`.z-route`, `.q-tm`, `.q-mid`), renkler `static/app.css` (`--q-*`).
- Kategori renkleri `src/app/plan/sectionMeta.ts` (uçuş #6a4fe0, konaklama #23998b). Bölüm `src/app/plan/Section.tsx`, kart `src/app/IntentCard.tsx`, çekmece `src/app/ItemDrawer.tsx`.
- İllüstrasyonlar: `git show 569d414:docs/mockups/plan-v30/illus/<ad>.png` (otel, ev-daire, ucus, ...).

## Değişmez kurallar

- Fiyat, saat, uyarı ve kaynak bağlantısı hiçbir durumda gizlenmez; ama her durum yalnız kendi aşamasının bilgisini taşır.
- Durum yalnız hapta/düğmede ve alt şeritte; kategori rengi ikon ve hattaki noktalarda. Yeşil rezerve/alındı, sarı-bej seçildi, amber uyarı, kırmızı risk, lila öneri ve uçuş rengi.
- Em-dash yok. Canlı dil (Plus Jakarta Sans, `--q-*` belirteçleri, illüstrasyon seti). Yeni görsel dünya yok.
- Hafta günleri gerçek takvime göre (2027: 20 Mar Cmt, 2 Nis Cum).

## Onaylanan kararlar (uçuş)

1. **Kategori içi zaman çizgisi.** Açık kategoride kartlar tarih sırasıyla tek sütun; solda ince hat (2 px, uçları yumuşak), tarih sütunu 96 px, her tarihin noktası kartın yanında (seçili/alınmış dolu, biriken halka, niyet kesikli). Boş gün satırı yok. Telefonda (390) tarih kartın üstüne iner, hat kartların arkasından akar. Kodda `plan.css`: `.q-ints` yerine `.q-tl` sarmalayıcısı; tarihsiz kategoriler (yapılacaklar, belgeler, hazırlık, ilham) ızgarada kalır; "Yolculuk sırasıyla" görünümü ile çakışmaz (o tüm kategorileri tek hatta koyar).
2. **Her bacak bir kart.** Gidiş-dönüş bile iki tarih, iki kart. Satın alınca iki kart birden "Alındı", PNR ikisine (modelde bağ gerekir).
3. **Satır: 72 px, sağda tek şey.** Izgara: işaret 38 px · rota ve bir satır bilgi · tek rakam · 118 px'lik yuva. Yuvada tek düğme ya da hap, hepsi 36 px: niyet "Ara", biriken "Seç" ve köşede mini "3", seçili "Satın al ↗", alınmış yeşil "✓ Alındı" (hap). Ok yok; satırın kendisi basınca açılır; aynı anda bir satır açık; açılan satır ekrana kaydırılır. Kodda satır ve sağ yuva kardeş eleman (düğme içinde düğme olmaz).
4. **Niyet (todo).** İşaret: canlı uçuş gradyanı (`linear-gradient(160deg,#9cc4ff,#dbe9ff 60%,#fff3e3)`) üstünde uçak illüstrasyonu. Rota "Chiang Mai → Bangkok", satır "30 Mar Sal · sabah · 2 kişi", rakam "€35–60 yaklaşık", düğme "Ara". Kesikli kenar, üstte hafif lila gradyan. Açılınca: bir cümle ne arandığı, "Trip Radar arasın" ve Skyscanner · Kiwi · Google Flights düğmeleri. Bağlantı yapıştırma kartta YOK (sohbette ve çekmecede).
5. **Biriken (dk).** Deste: üç havayolu logosu çapraz üst üste (24 px kareler, 2 px beyaz halka), kart altında iki kart kenarı (box-shadow katmanları). Satır aynı, rakam "€326 en düşük" (önerimizin fiyatı tercih edilir), düğme "Seç" ve mini "3". Hap yok, "karar bekliyor" yazmaz. Açılınca (Yol 2): sağ yuva boşalır (yalnız ok), alan ikiye: solda "Birikenler" (deste, havayolları, kaynaklar, aralık, Seç), sağda "Yeni bul" (üç site). Seçenek listesi kartta YOK; çekmecede.
6. **Seçili (sel).** Satır: logo, rota, "00:35 → 17:05 · 12 sa 30 dk · 1 aktarma", "€276 kişi başı", "Satın al ↗". Hap yok. Açılınca biniş kartı: büyük saatler (26 px), kesikli rota ve uçak illüstrasyonu (`.q-mid` dili), aktarma noktası turuncu, süre ve aktarma; sağda toplam; aksiyon satırı: kaynak ("Skyscanner'dan"), "Değiştir"; varsa amber alt şerit ("Gezi başlangıcından 4 gün önce kalkış"). Karşılaştırma yok.
7. **Alınmış (ok).** Satır: logo, rota, saatler ve direkt, "K7T2QX PNR", yeşil "✓ Alındı". Açılınca biniş kartı, mühür, "€76 ödendi · 2 kişi", "Takvime ekle", "Bileti aç ↗", yeşil şerit: check-in saati, koltuk.
8. **Düğmeler.** Ara → çekmece açılır, Trip Radar arar (kaynak ilerlemesi, satırlar gelir, Durdur). Seç → çekmece, seçenekler. Satın al → kaynağın satın alma sayfası, dönüşte "Aldın mı?". Değiştir → aynı çekmece, seçili işaretli. Alındı → durum; Bileti aç → kaynak. Pano'da aç → derin karşılaştırma.
9. **Çekmece (K82 çerçevesi, sağdan 600 px).** Başlık üç satır: (a) deste/illüstrasyon, "Bangkok → İstanbul", "2 Nis Cum · akşam varış · 2 kişi · tek yön", kapat; (b) "ÖLÇÜTLER" çipleri: şart olanlar lila, tercihler gri, "+ ekle"; (c) Seçenekler/Elenen anahtarı (sayılı) ve "Sırala: Önerimiz ▾". Gövde açık gri zemin, beyaz kartlar.
10. **Çekmece kartı (standart).** Başlık: logo, havayolu, sefer no, kaynak; sağda puan çipi 34 px (dolu daire sayı + "1. sırada"; önerimiz lila, komşu gün amber, diğerleri mürekkep). Gövde: biniş kartı (seçili kartın açık hâliyle aynı çizim) + sağda fiyat (kişi başı, toplam) + "Seç" (önerimizde dolu lila, diğerlerinde ghost). Beş yuva hep aynı sırada, ikonlu: bagaj (çanta, "23 kg"/"Bagaj yok"), el bagajı (sırt çantası, "8 kg"), iade (geri ok, "İade yok"/"İade ücretli"/"İade var"), terminal (bina, "IST · T1"), kaynak (dış bağlantı). Yeşil var, amber yok, gri nötr, boşsa "—". "Neden 91?" satırı kartın altında açılır; önerimizde açık başlar; cümle kalıbı: istenenlerden hangileri var, artı, eksik. Önerimizin lila çerçevesi var; kart bölünmez.
11. **Çekmecede tarihler (A).** Her gün grubu başında 52 px takvim karosu (gün büyük, ay küçük), tam tarih, not, hap "İSTENEN GÜN" / "+1 GÜN"; komşu günün bedeli notta ("konaklama 1 gece uzar, +€64"). Bant kaydırınca üstte yapışır. Altta bırakma kutusu (lila kesikli, dolu ikon: "Bulduğun uçuşun bağlantısını buraya bırak", siteler) ve "Pano'da karşılaştır →".

## Açık sorular (koda geçerken karar ver)

- İç içe açılma hissi (kategori, satır, çekmece): bir satır açık, kaydırma, çekmece kapanınca satır kapanır. Kullanınca değerlendir.
- Seçili ama alınmamış, kapalı satırda yalnız düğmeyle belli; karışık listelerde hattaki nokta sarı-bej olabilir.
- Uyarı kapalı satırda görünmüyor: küçük amber işaret gerekir.
- Beşinci geçici durum "Aranıyor" (Ara'dan sonra çekmece kapatılınca): nokta ve "Aranıyor…".
- Fiyat tazeliği (canlıdaki fiyat geçmişi satıra küçük not), gidiş-dönüş tek bilet bağı, tarihsiz niyet ("Tarihi yok" grubu).

## Konaklama (Çizim 14; plan kartı onaylandı, çekmece v2 onay bekliyor)

Çizim: `docs/mockups/konaklama-karti-v1/index.html` (https://claude.ai/artifact/Tu4oPQQh9WjTKXbscSZqUf). Varsayım olarak yazılan kararlar:

1. **Onaylandı: katlanmasız, fotoğraf solda.** Kart 120 px: fotoğraf 84 px · üç satır · tek rakam · 118 px yuva (uçuş satırıyla aynı sağ kenar). Kartın kendisi çekmeceyi açar; yuvadaki düğme kardeş eleman. B (fotoğraf üstte) ve C (katlanmalı) elendi; ilk sürümü git geçmişinde.
2. **Gün gün.** Tarih sütununda tek aralık ve gece sayısı ("24–27 Mar · Çar → Cmt · 3 GECE"), çıkış ayrıca yazılmaz. Sütun kart boyunca: giriş noktada, gece başına çentikli dilim, çıkış dilimin ucunda; dilim kategori renginde (niyette kesikli, birikende açık). Boş gece kesikli amber dilim ve kendi satırı ("30 Mar gecesi boş", tek düğme "Bangkok'u 1 gece öne al": komşu niyeti uzatır; seçili/rezerve sessizce uzatılmaz). Telefonda dilim kalkar, "● 24–27 Mar · 3 gece".
3. **Durumlar.** Niyet: nerede · kaç gece, kişi, istenen çipleri, tahmini gece, "Ara". Biriken: deste (üç küçük kare, sayı), kaynak dağılımı ve aralık, önerimizin gece fiyatı, "Seç" ve mini sayı. Seçili ve rezervede otel adının üstünde turkuaz şehir satırı ("CHIANG MAI · 3 GECE"). Seçili: otel adı, kaynak rozetiyle puan, iptal tarihi, gece ve toplam, "Rezerve et ↗". Rezerve: mühür, rezervasyon no rakam yerinde, yeşil hap, yeşil şerit (giriş saati, ödenen, "Rezervasyonu aç ↗").
4. **Fotoğraf.** Kaynağın ilk fotoğrafı, yoksa illüstrasyon (otel / ev-daire) açık turkuaz gradyan üstünde; puan rozeti sol üstte, mühür sol altta.
5. **Çekmece (Emre'nin notuyla v2).** Tarih tek ve başlıkta: niyetin tarihi net, başka tarih başka niyet kartı; tarih bandı ve "+1 gece" yok. Başlıkta sıralama ağırlığı (varsayılan yorumlar %40, özellikler %35, fiyat %25; "Ayarla", gezi başına saklanır), sıralama "Ağırlıklı puan". Kart görsel önde (v3): tepede tam genişlik 200 px fotoğraf, köşesinde puan çipi, altında iki küçük ve "+N"; altında ad, kaynak ve bölge, puanın üç parçası tek satır (yorum, özellik, fiyat; 0–100, ağırlıkla toplanır), fiyat ve her kartta dolu, geniş Seç (telefonda tam genişlik; seçili olan "✓ Seçili"). Beş yuva etiketli: kahvaltı, ücretsiz iptal, eski şehre mesafe, puan, kaynak. Altında AI'nın yorumlardan çıkardığı artılar ve eksiler hep açık (en çok üçer madde, yorum sayısıyla). Bırakma kutusu ve "Pano'da karşılaştır".
6. **Düğmeler.** Ara → çekmece ve AI arama; Seç → çekmece; Rezerve et → kaynak, dönüşte "Rezerve ettin mi?"; Rezerve hap, "Rezervasyonu aç" şeritte.

## Arama, pano ve kaçırdıklarımız (Çizim 15, onay bekliyor)

Çizim: `docs/mockups/arama-pano-v1/index.html` (https://claude.ai/artifact/UgbuWmb6ZaoEenuzLK5wTg). Konaklama Emre tarafından onaylandı.

1. **Siteler tek yerde.** Plan kartında yalnız "Ara". Çekmecenin en altında her hâlde "Yeni bul" kutusu: üç site `providers.ts` sırasıyla (Tayland'da Agoda, Booking.com, Airbnb), "Diğer ▾", altında bırakma alanı. Arama şehir, tarih, kişi, odayla dolu ve ortaklık bağlantısıyla açılır. Panoda grup başlığında "Yeni bul ▾"; Asistan'da "Bir link bırak" kalır.
2. **Dönüş eklentiyle.** Otel sayfasında eklenti düğmesi ya da Alt+Shift+S: pencere şehri ve tarihi tutan niyeti kendisi seçer ("✓ şehir ve tarih tuttu"), tek düğme "Desteye ekle"; tutmazsa "Nereye?" listesi, hiçbiri değilse İlham.
3. **Ara hâli çekmecede.** Üstte arama çizgisi (kaynak ilerlemesi, Durdur), gelen kart "Yeni geldi" ve geçici sırası, iskeletler, altta Yeni bul.
4. **Pano = büyümüş çekmece.** İhtiyaç başına grup; grup başı çekmece başı gibi (ölçütler, ağırlık, Yeni bul, Kartlar/Karşılaştır). Kartlar çekmece kartının kendisi (Emre: küçüğü değil), iki sütun; uçuş grubu uçuşun standart kartıyla. Karar verilmiş grup tek satır. Karşılaştır: seçenek başına sütun, her satırda en iyisi yeşil, eksik amber; artılar, eksiler, oylar, Seç.
5. **Kaçırdıklarımız.** Aranıyor (beşinci hâl); uçuşla saat bağı (geç giriş, erken çıkış amber şerit ve tek iş); çakışan gece (kırmızı); fiyat tazeliği ve kaynağın parası; Elenen ve "Geri al"; iptal son günü hatırlatma; rezervasyonun e-posta/onay sayfasından okunması; ortak gezide oylar; kişi/oda değişince yeniden arama; tarihsiz niyet; kapalı kategori satırında boş/çakışan gece; telefonda tam ekran çekmece.

## Ulaşım (Çizim 16, onay bekliyor)

Çizim: `docs/mockups/ulasim-v1/index.html` (https://claude.ai/artifact/45jPAbgmACy2gQnKpzzjbs).

1. **Üç aile.** Yol (tren, otobüs, biletli feribot, minibüs, transfer): uçuş satırı, açılınca bilet, dört durum. Kiralama (araç, motor/scooter, karavan, bisiklet): konaklama kartı, hatta gün dilimi (alış → bırakış), dört durum, Rezerve et ↗. Yerinde (taksi, Grab, metro/raylı, iskele teknesi, songthaew): yeni ince satır, rezervasyon yok.
2. **Her satır önce tür, sonra rota, sonra zaman.** Üstte mavi büyük harf tür ("TREN", "VAPUR · İSKELEDE", "MOTOR KİRALAMA · 3 GÜN"), rota büyük ve oklu, ikinci satır saat · süre · kişi; tarih hatta; illüstrasyon türü tekrarlar.
3. **Yerinde.** Ad tek kelime: "Yerinde"; alt türü üst satırda (iskelede, uygulamadan). Yaklaşık fiyat, düğme yok, sağda gri-mavi "Yerinde" hapı, hatta küçük dolu nokta. Açılınca 2–3 yol seçeneği (taksi, Airport Rail Link, Grab), biri işaretli; "Haritada aç ↗". Feribot biletliyse Yol, gişedense Yerinde.
4. **Omurga.** "Yolculuk sırasıyla"da Yerinde satırları otel ile uçuş arasını bağlar; boşluğu Trip Radar önerir (lila halka), kabul edilince düz satır. Kategori özeti "4 yerinde", bütçede ayrı.
5. **Çekmece yalnız Yol ve Kiralama.** Kiralama: konaklama çekmecesi (fotoğraf önde, ağırlık, artı/eksi, Seç, Yeni bul). Yol: uçuş standart kartı, tren illüstrasyonu. Yuvalar türe göre (tren: sınıf, bagaj, iade, istasyon, kaynak; motor: sigorta, depozito, teslim, kask, kaynak; araç/karavan: sigorta, depozito, teslim, km sınırı, kaynak). Siteler providers.ts: Rome2rio (Tayland için 12Go eklenmeli), DiscoverCars, BikesBooking.
6. **Belge bağı.** Kiralamada ehliyet şartı amber şerit ve "Belgelere ekle".

## Kodlama sırası (öneri)

1. `plan.css`: `.q-tl` sarmalayıcısı (tarih sütunu, nokta, hat, telefon kuralı), tarihli kategorilerde `.q-ints` yerine; `Section.tsx` tarih sıralaması.
2. Uçuş satırı bileşeni (dört durum, açılır gövde), `IntentCard.tsx` uçuş türünde K79 yerine; haplar ve düğmeler `intent.css` dilinde.
3. Çekmece: başlık üç satır, standart kart, beş yuva, "Neden?" katlaması, tarih bantları; `ItemDrawer.tsx` / K82 CSS üstüne.
4. Durum geçişleri: Ara → aranıyor → biriken → seçili → alınmış; Seç/Değiştir/Satın al/Aldın mı akışı.
5. e2e: dört durum, açılma, çekmece, telefon genişliği.
6. Konaklama (onaylandı): `StayRow` (A), `.q-tl .span` dilimi ve boş gece satırı, `Section.tsx`'te gece boşluğu hesabı, çekmecede konaklama kartı.
7. Arama ve pano (onaydan sonra): çekmecede "Yeni bul" kutusu, eklenti penceresinde niyet eşleme, pano grupları ve Karşılaştır görünümü, kaçırdıklarımızdaki uyarılar.
