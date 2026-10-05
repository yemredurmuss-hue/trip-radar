# Trip Radar arayüz kuralları

Bu panonun tek işi karar vermeyi kolaylaştırmak. Her yeni ekran ve bileşen bu kurallara uyar; stiller
`static/app.css` içinde, renkler ve boşluklar oradaki değişkenlerden gelir.

## Önce karar

- Bir bakışta üç şey görünür: **ne kaldı** (hero'da sıradaki adım ve altındaki sessiz satır: Karar ver / Rezerve et / Planla / ⏳), **ne öneriliyor** (tek satır öneri), **neden**
  (kartın solunda artılar, sağında eksiler). Gerisi bir dokunuş ötededir: kartın "Detaylar"ı, sonra
  "Tüm detaylar".
- Aynı şey iki yerde söylenmez. Öneri tek satırdır; uzun gerekçe Karşılaştır'da durur.
- Sıralama kararın omurgası: seçenekler 1, 2, 3, 4… alt alta, bir satırda bir kart (ilk beşi açık). Üstte tek cümle:
  önerin ve nedeni, sonra bir önceliğe göre öne çıkan alternatifler sırasıyla.
- Fotoğraf büyük, sitedeki gibi: geniş kartta solda kartın ~%42'si boyunca, dar kartta üstte tam genişlik. Sıra
  numarası (sol üst), uyum puanı (sağ üst) ve site bağlantısı (sol alt) fotoğrafın üstünde.
- Yanında okunacak yer: neyde en güçlü olduğu (küçük büyük harf etiket, tek vurgu rengi), büyük ad, tür ve puan tek
  gri satır, büyük fiyat; sonra "1.'ye göre" satırı (fark, kazanç, eksik), istek işaretleri (✓/✕/?) ve artı/eksiler.
  Detaylar kartın altında tam genişlik açılır; fotoğraf uzamaz.
- Durum tek satır ve renkli zeminle: Seçmeden kontrol et (amber), Kısmi (gri), Uygun değil (kırmızı, soluk kart).
- Metni kısaltarak değil düzenle okunur yaparız: satırlar tam cümle, 14 px, rahat satır aralığı, kalın yalnız
  eleme sebebinde. Dar sütuna sıkıştırmak yok; artı/eksi yan yana yalnız kart genişse.
- Plan'da her şey kendi kartı: ulaşım kartı (uçuş, tren, otobüs, minibüs, vapur, taksi·transfer, araç/motosiklet/karavan/bisiklet
  kiralama) ve medya kartı (etkinlik, eSIM, sigorta, restoran, not). Konaklama kendi karar kartını korur.
- Seçim yapılınca artı/eksi kalkar: karşılaştırma bitmiştir, kart sade durur.

## Renklerin tek anlamı var

| Renk | Anlamı | Nerede |
| --- | --- | --- |
| Yeşil `#1f8f4e` | Rezerve edildi, bilet alındı; artı | Durum şeridi, ✓ rozeti, artı işareti |
| Amber `#f0a53a` | Seçildi ya da planlanıyor, henüz rezerve değil | Durum şeridi, "rezerve edilmedi" uyarısı |
| Kırmızı `#d9534f` / `--danger` | Eksi, risk, elendi, süresi dolmak üzere | Eksi işareti, eleme sebebi, iptal uyarısı |
| Mavi `--accent` | Yalnız öneri ve link | Öneri satırı, önerilen kartın çerçevesi, linkler |
| Gri, kesikli çizgi | Henüz planlanmadı, boş | "Planlanmadı" kartı, boş gün |
| Kategori renkleri (mor uçuş `#6a4fe0`, turkuaz konaklama `#23998b`, hardal ulaşım `#c58a2e`, bordo etkinlik `#a8336f`) | Yalnız hangi tür | Hero'daki onaylananlar ikonları ve bütçe çubuğu |
| Tür renkleri (uçuş `#6a4fe0`, tren `#2563c9`, otobüs `#d9480f`, minibüs `#e8890c`, vapur `#0e8fb0`, taksi `#d29a00`, araç `#475467`, motosiklet `#c0256b`, karavan `#8a6534`, bisiklet `#5d8a1c`, etkinlik `#a8336f`, eSIM `#3b6fd1`, sigorta `#0f8a6a`, yapılacak `#1f8f4e`) | Yalnız hangi tür | Plan kartının üst satırındaki ikon ve ad, siluet çizgisi, ekleme penceresinin kutuları |
| Sarı-bej `#fbf6ea` / yeşil `#eef8f1` zemin | Alınmadı / alındı-planlandı | Plan kartlarının zemini (çember ve alt şerit yazısıyla birlikte) |

Durum hiçbir yerde yalnız renkle anlatılmaz: yanında hep yazısı olur ("Bilet alındı", "Planlanıyor").
Gezginin istedikleri kartın üstünde ayrı bir satırdır ("İstediklerin"): ✓ var (yeşil), ✕ yok (kırmızı),
? sayfa söylemiyor (gri). Varsayılanlar bu satıra girmez; yalnız söylediği, ayarladığı ya da sezilen öncelik.
Kart satırları somut yazar (kaç dakika, kaç puan, hangi saat); "Yakın", "Zor saat" gibi tek kelime yetmez.
Kartın önünde yalnız karar değiştiren şey durur: seçeneği diğerlerinden ayıran ("yalnız bunda") önce; tek yorumdaki
küçük şey, hepsinde olan şey ve bilgi (giriş saati, "bilgi yok") detaya kalır. Bulgu kendi sözleriyle yazılır; genel
bir konu adı ("Olanak eksik") yazılmaz.

## Hero

Panonun üstü tek blok (v9, referans görsel `docs/mockups/ref/2026-10-05-hero-v9-referans.webp`, öğe öğe
`docs/superpowers/specs/2026-10-05-hero-v9-design.md`): solda hikâye (~%62), sağda kart (~%34); pano 760 px'ten
darsa tek sütun, kart hikâyenin altına iner. Renkler `--hx-` değişkenlerinde (ink, mor-gri muted, accent, lavanta,
mint, kart zemini, çizgi). Her bloğun boş hâli var; bilgi geldikçe blok yumuşakça belirir (`hx-appear`, azaltılmış
hareket tercihinde yok). Uydurma yok.

- **Fotoğraf** şehir başına bir tane, rota sırasıyla (~1,92:1, dar ekranda 220 px). Sol üstte şehir seçici (6 sn'de
  bir geçer), sağ üstte geri sayım hapı ("3 gün kaldı") ve ••• menüsü; iş varken işleniyor hapı. Şehir yoksa lavanta
  zemin + "Şehir belli olunca fotoğrafı gelir".
- **Başlık, tarih, cümle**: 40 px başlık; altında takvim · "8–14 Ekim · 7 gün" (tahminse "~"); tek mor-gri cümle:
  AI'nin ton cümlesi, yoksa koddan durum cümlesi ("3 karar ve 1 rezervasyon bekliyor."). İkisi birden yazılmaz.
- **Plan dört hücrede**: uçuş · konaklama · ulaşım · deneyim, kategori renginde ikon + "2 uçuş"; her ihtiyaç bir kez,
  deneyim = plandaki etkinlik ve restoranlar. Sıfır hücre kalır ama soluk. Hücreye basınca Plan'da o bölüm açılır.
- **Rezervasyonların** (mint kutu): Plan bölüm başlıklarındaki "3/4"lerin toplamı ("2/11 onaylandı · %18") ve çubuk;
  sayıya basınca bütün yapılacaklar hero'nun altında açılır, "⏳ 2" yalnız iptal süresi yaklaşanları. Koyu düğme
  "Planı tamamla →" sıradaki işe gider; hepsi tamamsa "Paylaş →", hiç kayıt yoksa "İlk kaydı ekle →".
- **Sağ kart**, bloklar arasında ince çizgi: **Yolcular** (baş harfli üst üste yuvarlaklar, "Emre & Sabine" ·
  "2 kişi"; ad yoksa kayıtlardaki kişi sayısı; basınca paylaşım) ve **tarz çipleri** (modelin sabit listeden en
  fazla iki kelimesi, her biri kendi ikonu ve renginde; bütçenin kelimesi gri cüzdanlı hap; kişi başı günlük €70
  altı Ekonomik, €180'e kadar Orta bütçe, üstü Yüksek bütçe) · **Bütçe**: rakam (bütçe, yoksa bilinen toplam),
  altında Rezerve / Planlanan / Boşta ya da kırmızı Aşıyor satırları; basınca kategori kırılımı · **Tercihler**
  ("Seni böyle anladım"): en fazla iki satır ("Fiyat + konum · Çok önemli"), "+7 tercih ›"; pencere kartın üstüne
  açılır, sayfayı itmez, her giriş kapsamı ve × ile · **Ülke ve hava**: bayrak + ülke, şehir başına ikon + gündüz
  derecesi (10 gün kala tahmin, öncesinde son 5 yılın aynı günleri) · en altta sessiz sıra: para (kur üstüne
  gelince) · priz · saat farkı ("−2 saat", aynıysa "Aynı saat") · dil.
- **Sekmeler** hero'nun altında, ortalı ve alt çizgili: Plan | Günlük akış | Belgeler; seçili olan ink, 3 px accent çizgi.

## Plan kartları

Uçuş, ulaşım, transfer, etkinlik, eSIM, sigorta, restoran ve not aynı kabuğu paylaşır (onaylı görseller
`docs/mockups/2026-10-05-ulasim-v3.html` ve `docs/mockups/2026-10-05-etkinlik-v4.html`).

- **Kabuk:** zemin durumu söyler (sarı-bej alınmadı, yeşil alındı ya da planlandı). Üst satır 24 px: çember (kesikli
  karar bekliyor · amber seçildi · yeşil ✓ alındı) · renkli tür ikonu ve adı · tarih [· saat] | belge · •••.
  Altta 48 px şerit: solda durum ya da seçenek gezgini, sağda fiyat ve tek koyu eylem. Durum yazısı yalnız altta;
  sağ üstte durum hapı yok. Alt şerit kısa kalır ("Seçildi · bilet alınmadı · ⏳ 4 gün"), "…" ile kesilmez; uzun tarih
  uyarısı ayrıntıda. Her kayıt kartında •••'nin solunda yuvarlak × (24 px, gri, üstüne gelince kırmızı): fare kartın
  üstündeyken ya da kart odaktayken görünür, dar ekranda (≤620 px) ve dokunmatikte hep soluk.
- **Seçenek gezgini:** bir ihtiyacın seçenekleri yan yana kart değil, tek kart + alt şeritte `‹ 1/2 ›`; önerilen
  seçenekte "Önerim". Neden önerildiği, "2.'ye göre" satırı ve rozetler ayrıntıdadır.
- **Ulaşım gövdesi:** solda nereden, sağda nereye: büyük yazı şehir (30 px; uzun ad sütununda sarar, 24 px), altında
  küçük satır kod ya da istasyon · **saat** (iniş başka günse o gün de); orta sütun siluetin genişliğinde, ad siluetin
  altına girmez. Kiralıkta sağ taraf gün sayısı ve iade günü. Ortada türün noktalı silueti, kenarları solar. Çizimi olmayan yolda (metro, yürüyüş) orta satır uçların arasında.
  Transfer ve şehir değişimi kartında uç kısa ad, altında tam ad: konaklama "Airbnb" / "Booking.com" ya da
  "Otel" / "Daire" (altında konaklamanın adı, sarar), havalimanı "Porto Havalimanı" (altında OPO), gar "Porto Garı"
  (altında istasyonun adı).
- **Medya gövdesi:** 176×128 görsel (yoksa türün noktalı silueti), puan köşede; yanında 20 px başlık, bilgi satırı, kaynak.
- **Ayrıntı:** karta dokununca kartın içinde beyaz panel açılır; eski karttaki her bilgi orada (saatler, işletme,
  fiyat kırılımı, neden önerildi, istedikler, artı/eksi, bağlantılar, geri almalar).
- **Belgeler:** yalnız bu bilgisayarda durur. Varsa hap ("bilet.pdf +1", dar ekranda ikon), yoksa soluk ataç.
- **Eklemek:** Plan başlığındaki "+ Ekle" bütün şablonları açar; bir bölümün "+ Ekle"si ve bölüm içindeki kesik
  çizgili "+" (hep soluk görünür, üstüne gelince tam; dar ekranda tam) yalnız o bölümün türünü ekler: tek türü olan
  (Uçuş, Etkinlik, Yapılacak, Restoran) anında, birkaç türü olan (Konaklama, Ulaşım, Diğer) yalnız kendi karolarıyla.
  Günlük akışta her günde "+". Şehir ve tarih bastığın yerden gelir (konaklamanın ardında yalnız şehir). Karoya
  basınca form açılmaz: kayıt hemen oluşur ("Planlanıyor"), bölümü açılır, sayfa yeni karta kayar ve kart ilk boş
  alanı açık gelir (fikirde adı); altta "Otobüs eklendi · Geri al".
- **Kartın üstünde düzenlemek:** her kayıt kartında ad, şehir, tarih, saat, uçlar ve fiyat durdukları yerde
  değişir. Üstüne gelince ince alt çizgi ve kalem; tıklayınca aynı boyda kutu (tarih seçici, saat seçici, fiyatta
  sayı + para birimi). Enter ya da dışarı tıklamak kaydeder, Esc bırakır, Tab sonrakine geçer; "Kaydet" düğmesi yok.
  Boş alan soluk "Tarih ekle" / "Saat ekle" / "Fiyat ekle". Sayfadan kaydedilen kartta değişiklik düzeltme olarak
  durur (sayfa yeniden kaydedilse de kalır); üstüne gelince "sayfadaki: X · geri al".

## İki görünüm: Plan · Günlük akış

- **Plan kategorilere göre** (`docs/mockups/2026-10-05-kategoriler-v4.html`, spec 0.34): yedi bölüm, bu sırayla —
  Uçuş · Konaklama (gece blokları dahil) · Ulaşım (transferler, şehir değişimi, kiralama) · Etkinlikler (rezervasyonlu)
  · Yapılacak şeyler (rezervasyonsuz) · Restoranlar · Diğer (sigorta, eSIM). Her kayıt tam olarak bir bölümde; boş
  bölüm (gizlisi de yoksa) çizilmez, en altta "Ekle:" satırında tek çip olur.
- Bölüm kabuğu: bütün bölümler **tek beyaz yüzeyde** (köşe 22, yumuşak gölge), aralarında 1 px ince çizgi `#e9e6e1`.
  Bölüme ait zemin rengi, renkli çerçeve, ikon karesi, durum hapı yok; renk yalnız ikonda ve çubukta.
- Kapalı başlık her bölümde aynı: tür renginde çizgi ikon (22 px, karesiz) · ad (17 semibold) … sağda ince ilerleme
  çubuğu 96×6 (tür rengi = tamam/hepsi; hepsi tamamsa yeşil `#1f8f4e`; boş iz `#efece7`) · sayı "3/4" (tamam koyu,
  "/4" gri, tabular, sabit genişlik: sayılar alt alta hizalı) · ok (kapalı sağa, açık aşağı). Başka hiçbir şey yok.
  Başlığa basmak açar/kapar; seçim gezi başına hatırlanır. İlk bakışta işi kalan açık, hepsi tamam olan kapalı; bu
  ilk bakış ziyaret boyunca sabit (son bilet alınınca bölüm elinin altından kapanmaz). Kart bölüm değiştirirse yeni
  bölümü açılır ve sayfa ona gider.
- Açık bölüm: aynı başlık, çubuktan önce "+ Ekle"; başlığın altında, yalnız bekleyen bir şey varsa, tek amber satır
  (`#9a6400`, 14 px: "1 bilet yok · 2 karar", "2 gece boş", "2 güne eklenmedi").
- **Gizlenenler bölümün sonunda:** o bölüme ait elenen (Ele), "Gerek yok" denen (transfer, geceler) ve rezervasyonla
  kapanan seçenekler yalnız sessiz bir bağlantının arkasında durur: "Gizlenenler · N göster" (13 px gri, noktalı alt
  çizgi). Açılınca her biri kısa satır: elenen "Geri al" ile seçeneklere döner, transfer ve geceler "Geri getir" ile
  gelir, kapanan seçenek onu kapatan rezervasyonu yazar (rezervasyon geri alınırsa döner; adına basınca ayrıntı açılır).
  Sayfanın altında ayrı "Kapanan seçenekler / Elenenler / Gizlenenler" bloğu yok. Hangisinin hangi bölüme gittiği
  `lib/categories.ts` `hiddenThings` (her biri tam bir bölümde).
- Açık bölüm bir zaman çizelgesi: solda tarih sütunu ("9 Eki", altında hafta günü ve şehir), ince çizgi ve nokta,
  sağda onaylı kartların kendisi (kart iç tasarımı değişmez). Tarihe göre, sonra saate göre; tarihsizler en sonda
  "Tarihsiz", şehre göre. Panel ≤620 px: tarih kartın üstüne tek satır iner. Yapılacak şeyler: başta hızlı yazma
  kutusu, tikli satırlar (alt satır şehir · kaynak); Restoranlar: 200×124 fotoğraflı kartlar, aynı gündekiler yan yana.
- Plan'da check-in/check-out satırı, boş gün, planı olmayan transfer yok.
- **Günlük akış** (0.34.8) tek anahtarla iki görünüm, günler tek tek açılıp kapanmaz. Üstte yapışkan çubuk:
  **Liste | Kartlar** (seçim bu tarayıcıda hatırlanır) ve gün şeridi (1 · 2 · 3 · 4 · 5–6 · 7; bugün mavi), şerit
  o güne kaydırır. İkisinde de aynı satırlar, aynı sıra.
- **Liste**: gün başına kart, solda günün fotoğrafı (öne çıkan kaydın görseli → ona arama, fotoğraf proxy'sinden →
  şehrin), sağda başlık (yer değiştiren günde rota, yoksa şehir), "N iş" / "N fikir" ve günün **tamamı** saat
  çizgisi olarak: saat · nokta · Plan kartlarının tür ikonu kendi renginde (köşede yeşil ✓ alındı, amber nokta
  yapılacak) · ad; check-in, check-out, metro ince satır; güne eklenen fikirler tek tek. Katlanma yok, kart günü kadar
  uzar; kısa günde sağ altta türün soluk silueti. Bir satıra dokunmak Kartlar'a geçip o kartı gösterir (kısa vurgu).
- **Kartlar**: Plan'ın kendisi, gün gün. Her günün başlığı (küçük fotoğraf · "4. gün" · başlık · tarih · haplar)
  kaydırırken çubuğun altında kalır; altında satırlar saatleriyle, her biri Plan'daki kartıyla (giriş günündeki
  check-in konaklamanın kartı, uçuşa giden transfer "nasıl gideceksin"iyle); diğer bilgi satırları ince. Plan'dan
  tek farkı sıralama: kategori değil gün. Her günün altında "+ Bu güne ekle".
- Saat solda: kayıttan gelen düz, alışılmış ya da hesaplanan "~"; bilinmeyen boş.

## Azaltmak

- Sayfadan gelen bir seçenek **Ele** ile önden kalkar; transfer **Gerek yok** ile; ikisi de kendi bölümünün sonundaki
  "Gizlenenler"de durur (Geri al / Geri getir).
  **Sil** her kayıt kartının ••• menüsündedir ve kalıcıdır: onay penceresi yok, 8 saniye "Geri al" durur; kayıt
  belgeleriyle birlikte geri gelir. Kart dışındaki silmeler (çekmece, konaklamanın "Kaldır"ı) da aynı 8 saniyelik
  "Geri al"dan geçer; hiçbir kayıt silmesi onay sormaz. Sayılar ve yapılacaklar yalnız öndekini sayar.
- Konaklamada seçili karta dokunmak diğer seçenekleri açar (ayrıntı ⓘ'da); diğer kartlarda dokunmak ayrıntıyı açar,
  diğer seçenekler ayrıntıdaki 'Diğer N seçenek'te.
- Sohbette söylenen ya da elle eklenen plan yerinde ya da ••• → Düzenle ile değişir, Sil ile gider.
- Ayrı konaklama bloğunda ve boş gece bloğunda da sağ üstte × var: ayrı konaklama silinir (geceleri çevresindeki
  konaklamaya döner), boş geceler "Gerek yok" olur ve Konaklama'nın Gizlenenler'ine gider; ikisinde de 8 saniye "Geri al".
- Bir şehrin söylenen geceleri tek bloktur; seçilen yer bir kısmını kapsıyorsa blok bölünmez, kalan geceler altında yazar.

## Butonlar

- **Ana eylem** (Seç, Rezerve ettim): koyu dolgu (`--ink`), beyaz yazı, yuvarlak. Bir alanda en fazla bir tane.
- **İkincil** (Geri al, Değiştir, Yine de seç): beyaz, ince çerçeve.
- **Link** (Karşılaştır →, Detaylar ▾, Tüm detaylar): mavi yazı, çerçevesiz.
- **Sessiz** (Ele, Gerek yok): gri yazı, üstüne gelince kırmızı; ana butonun yanında küçük durur.

## Yazı

Ölçek: 40 gezi adı · 22 şehir · 17 kart başlığı · 15 metin · 13–14 kart satırı · 12.5 not. Hero: 40 başlık · 22 özet
rakamı · 17 metin/değer · 15 küçük satır · 13 etiket. Plan kartları: 30 şehir (ulaşım) · 20 başlık (medya) · 15 metin ·
13 ikincil · 17 fiyat. Türkçe
büyük harfle etiket yazılmaz (İ/i sorun çıkarır); etiketler küçük ve gri olur.

## Okunurluk

- Gri yazı `--muted` (`#6b665f`); daha açık gri bej zeminde okunmaz, kullanılmaz.
- Kart satırları kesilmez ("…" yok), sarar.
- Sayılar hizalı durur (`font-variant-numeric: tabular-nums`).

## Dil

- Kısa ve şehirlerle: "Porto → Madeira", "Karar ver 3", "Ücretsiz iptal için 6 gün kaldı".
- Özet satırı bilet gibi: ne → ne ("Havalimanı → Otel"), adlar ve saat alt satırda, notlar açınca.
- Artı/eksi birkaç kelimedir; sayfada okunan somut şey kendi sözleriyle yazar ("Karşısında genelev var").
- Uydurma yok: fiyat, saat, süre yalnız kayıttan ya da hesaptan gelir.
