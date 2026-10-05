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

Panonun üstü tek blok (onaylı görsel `docs/mockups/2026-10-05-hero-v8.html`): solda hikâye, sağda künye sütunu,
ikisi aynı boyda; pano dar olunca tek sütun, künye hikâyenin altına iner.

- **Fotoğraf** şehir başına bir tane, rota sırasıyla; üstte şehir seçici (6 sn'de bir kendiliğinden geçer), sağda
  işleniyor hapı ve ••• menüsü. Altına binen etiket: geri sayım + rota linki. Tarih yoksa geri sayım yok.
- **Açıklama** tek paragraf: AI'nin ton cümlesi (rakamsız) + koddan gelen durum cümlesi, yalnız en acil olan
  ("3 karar ve 1 rezervasyon bekliyor."). Uydurma yok.
- **Onaylananlar** gri tek kutu: seçilen ya da rezerve olan uçuş, konaklama, ulaşım, etkinlik sayısı; sıfır olan yazılmaz.
- **Seni böyle anladım** tek satır; açılan pencere sayfayı itmez. Her giriş kapsamıyla (Tüm gezi / kategori / ilan) ve × ile.
- **Künye**: Tarihler, Kalkış, Yolcu, Vize, Yerel, Bütçe. Bilinmeyen satır gösterilmez. Bütçe ince çok renkli çubuk;
  tıklayınca kırılım, kalan ve karar bekleyenlerin tahmini. Aşınca yalnız orada kırmızı "aşıyor".
- **Sıradaki adım** koyu buton, ne yapılacağını söyler ("Karar ver: Porto konaklama"); altında sessiz satır, sayıya
  tıklamak listeyi hero'nun altında açar. İş kalmadıysa "Bu geziyi paylaş".

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
- **Medya gövdesi:** 176×128 görsel (yoksa türün noktalı silueti), puan köşede; yanında 20 px başlık, bilgi satırı, kaynak.
- **Ayrıntı:** karta dokununca kartın içinde beyaz panel açılır; eski karttaki her bilgi orada (saatler, işletme,
  fiyat kırılımı, neden önerildi, istedikler, artı/eksi, bağlantılar, geri almalar).
- **Belgeler:** yalnız bu bilgisayarda durur. Varsa hap ("bilet.pdf +1", dar ekranda ikon), yoksa soluk ataç.
- **Eklemek:** Plan başlığındaki "+ Ekle" ve kesik çizgili "+" (hep soluk görünür, üstüne gelince tam; dar ekranda tam)
  şablon penceresini açar: planın en başında, her şehir bloğunun başında, her satırdan sonra; Günlük akışta her günde.
  Şehir ve tarih bastığın yerden gelir (konaklamanın ardında yalnız şehir). "Diğer" grubunda "Yapılacak" karosu
  rezervasyonsuz bir şey ekler (Fikirler'e düşer).

## Üç görünüm

- **Plan** kararların ön yüzü: yalnız kararı ya da rezervasyonu olan şeyler, her biri kendi büyük kartı (uçuş, otel,
  şehir değişimi, seçilen etkinlik, kiralık araç, planı olan transfer). Solda simge ve etiket sütunu (ne, ne zaman,
  kaçıncı gün), sağda kart; şehir bloğunun içindekiler dışındakilerle aynı hizada. Yalnız rezervasyon isteyenler
  (konaklama, ulaşım, uçuş, eSIM, sigorta, bileti/rezervasyonu olan etkinlik ve restoran); tarihsiz olanlar altta
  "Rezerve edilecekler · N · M alındı" listesinde alt alta.
- Plan'da check-in/check-out satırı, boş gün, planı olmayan transfer yok.
- **Günlük akış** gün gün, saat saat: rezervasyon gerektiren her şey (uçuş, tren, taksi/transfer, etkinlik,
  restoran, araç kiralama) küçük bir blok, bilgi (check-in, check-out, metro/yürüyüş, araç iadesi) ince satır.
- Blok Plan'daki kartına götürür; bir şey iki görünümde de büyük yazılmaz.
- Saat solda: kayıttan gelen düz, alışılmış ya da hesaplanan "~"; bilinmeyen boş.
- Günler açılır, kapanır: işi kalan açık gelir ("3 iş"), hepsi hazır olan tek satıra katlanır.
- **Fikirler** rezervasyon gerektirmeyenler (restoran, serbest etkinlik, yapılacak, not), şehir şehir
  (`docs/mockups/2026-10-05-fikirler-v1.html`): hızlı yazma kutusu, Hepsi · Yeme-içme · Yapılacaklar, restoranlar küçük
  fotoğraf kartları (fotoğraf kaydedilen sayfadan, yoksa yemek ikonu), yapılacaklar tikli liste. Bir güne eklenen Günlük
  akışta ince satırdır, büyük blok değil.

## Azaltmak

- Sayfadan gelen bir seçenek **Ele** ile önden kalkar (Elenenler); transfer **Gerek yok** ile (Gizlenenler / Geri al).
  **Sil** her kayıt kartının ••• menüsündedir ve kalıcıdır: onay penceresi yok, 8 saniye "Geri al" durur; kayıt
  belgeleriyle birlikte geri gelir. Kart dışındaki silmeler (çekmece, konaklamanın "Kaldır"ı) da aynı 8 saniyelik
  "Geri al"dan geçer; hiçbir kayıt silmesi onay sormaz. Sayılar ve yapılacaklar yalnız öndekini sayar.
- Konaklamada seçili karta dokunmak diğer seçenekleri açar (ayrıntı ⓘ'da); diğer kartlarda dokunmak ayrıntıyı açar,
  diğer seçenekler ayrıntıdaki 'Diğer N seçenek'te.
- Sohbette söylenen ya da elle eklenen plan ••• → Düzenle ile değişir, Sil ile gider.
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
