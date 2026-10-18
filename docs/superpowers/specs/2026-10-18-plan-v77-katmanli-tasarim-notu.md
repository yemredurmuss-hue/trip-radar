# Plan v77: katmanlı plan (tasarım, kod yok)

Amaç (Emre, 18 Ekim): prompt ya da linkle omurga oluşunca seyahatin şeklini görmek; her kategoride seçenekleri ve biriken linkleri karışıklık olmadan görmek; her durumda kartın üstündeki eylem değişsin (Seç, Satın al, Değiştir); infolar gerekli yerin arkasında. Kartlar v70'teki onaylı kartlar (canlı sınıflar), yeni olan katmanlar. Emre bu turda v70'i temel aldı; 17 Ekim'de Mac'te yapılan v71–v76 (kompakt satır, Biriktirdiklerin | AI önerileri Pano'su) ayrı bir yol olarak duruyor, ikisi karşılaştırılacak.

Mockup: docs/mockups/plan-v77-katmanli/index.html (etkileşimli; kaynak/ altında üretici). Altta prototip çubuğu: Durum (Plan ilerledi / Omurga yeni oluştu), Açık kategori (A Akış / B Odak / C Sekme), Değiştir (1 Yerinde / 2 Takas / 3 Çekmece).

## Katmanlar
1. Omurga: tüm kategoriler kapalı. Satırda ad, içerik özeti ("5 seçenek · 1 seçildi · 1 rezerve · 1 aranıyor"), niyet özeti ("Tokyo 3 · Kyoto 4 · Hakone 3 · Osaka 4 gece"), en çok 6 mini görsel (+n), kategori bütçesi, "n karar bekliyor". Mini görsel kaynağı rozetle: ✨ AI, 🔗 senin linkin, S/E ekleyen, ✓ seçili/rezerve. Seçeneği olmayan niyet kesikli boş kutu.
2. Kategori açık: her niyet yatay niyet kartı (plaka, çizim, dev ad, ikonlu bilgi, istek/şart, durum mührü, "Kendin ara" okunur marka bağlantıları). Altında ağaç çizgisiyle:
   - seçili yoksa: ilk 3 seçenek (Seç + kaynak ↗), "Hepsini gör (n)", link yapıştır, "Daha fazla öner";
   - seçili varsa: seçenekler gizli, seçili canlı kart büyük; eylemler tek satırda: Değiştir (n) · fiyat · Aldım · "Booking.com'da rezerve et ↗";
   - rezerve: canlı rezerve kartı (belge yok, Ayrıntı);
   - hiç seçenek yoksa: "Henüz seçenek yok" + AI'dan öner + link yapıştır + Gerek yok.
   Etkinlik ve Yapılacak çoklu: "Planında (n)" satırı, altında "Öneriler" (+ Plana koy).
3. Değiştir: seçenekler yeniden açılır, şu anki "Seçili" işaretli. Üç yol: Yerinde, Takas (seçili kart "Şu an" çubuğuna küçülür), Çekmece (sağdan panel, kaynağa göre süzgeç).
4. Ayrıntı: ⓘ / Ayrıntı ile iptal koşulu, konum, toplam, kaynak, uçuş uyarısı açılır.

Hepsini gör = o niyetin küçük panosu: Hepsi / AI / Linklerim / Ekleyenler süzgeci. "Pano'da karşılaştır ›" genel Pano'ya gider (henüz çizilmedi).

## Açık sorular
- Açık kategori: A, B ya da C.
- Değiştir: 1, 2 ya da 3.
- Pano görünümü: bu katmanlı yapıda Pano sekmesi neyi gösterecek.
- Mini görseller canlıda gerçek fotoğraf/logo (Places API kararı verildi); burada çizim.

## v78 · docs/mockups/plan-v78-toparlanmis (18 Ekim, v77 üstüne UI toparlama)
Emre'nin geri bildirimi: kapalı hal karışık; Skyscanner gibi bilinen format; tek kategori açık kalsın; niyet ile seçenekler birbirine girmiş; seçili otel çok yatay ince; Pano hep aynı yerde, büyük açılsın, artı/eksi yan yana; ulaşımda niyet ile bilet iki kez yazılmış; etkinlikte "Klook'ta bilet al" uzun, Aldım altta, "belge yok" göze batıyor; link yapıştır ve "Pano'da karşılaştır" kalksın.
- Kapalı satır: hizalı 5 sütun (ikon | ad + en çok 3 anahtar kelime | en çok 3 mini görsel üst üste | tek durum "n karar" ya da "hazır" | bütçe). Sayaçlar, ilerleme çubuğu ve rozetler kalktı.
- Akordiyon: bir kategori açılınca diğeri kapanır, açılan üste kayar.
- Her niyet tek kutu: üstte niyet (plaka, çizim, ad, ikonlu bilgi, istekler), sağ üstte hep aynı yerde durum ve "Pano n" düğmesi; altında seçenekler ya da seçili. Kutunun kenarı durumu söyler: kesik = karar bekliyor, kum = seçildi, yeşil = alındı.
- Uçuş ve tren seçenekleri Skyscanner satırı (logo, kalkış, süre ve aktarma, varış, kaynak, etiket, fiyat, Seç). Otel/eSIM/etkinlik Booking/Airbnb kartı (fotoğraf, marka, ad, konum, puan, fiyat, Seç).
- İlk 3 seçenek görünür ("en iyi 3 · tümü 5, Pano'da"); fazlası Pano'da.
- Seçili otel: fotoğraf solda, bilgi sağda; eylem satırı Değiştir · fiyat · Aldım · [logo] Rezerve et. Rezervede yerinde "✓ Rezerve edildi" ve sessiz "Onayı ekle".
- Uçuş/tren seçilince niyet bilete dönüşür: kutunun alt yarısı bilet (taşıyıcı, saatler ve istasyon/kod, süre), sağda koçan (fiyat, [logo] Satın al, Aldım, Değiştir). Şehir adları yalnız niyette, tekrar yok.
- Etkinlik: plandakilerde Aldım ve [logo] Satın al aynı satırda; alınınca "✓ Alındı" + sessiz "Bileti ekle". Önerilerde "+ Plana koy".
- Pano: büyük pencere (telefonda alttan tam ekran). Üstte aynı kategorideki niyetler arasında geçiş (Tokyo · Kyoto · Hakone · Osaka), süzgeç Hepsi / Biriktirdiklerin / AI önerileri, Daha fazla öner. Gövde yan yana karşılaştırma: görsel ve kaynak, nerede/saat, fiyat ve toplam, puan, iptal, artılar, eksiler, Seç. Seçili sütun yeşil, "Şu an seçili". "Değiştir" de Pano'yu açar.
- Link yapıştırma alanları kalktı (linkler sohbetten gelir, niyetin altında "Sohbete attığın linkler buraya düşer" notu). "Pano'da karşılaştır", "Hepsini gör", "Daha fazla öner" dağınık bağlantıları kalktı.
- Prototip çubuğunda yalnız "Plan ilerledi / Omurga yeni oluştu".

## v79 · docs/mockups/plan-v79-durumlar (18 Ekim, v78 üstüne revize)
Emre: "Amacımız link kaosunu derli toplu, karar verilebilen bir şeye dönüştürmek; gerisi buna destek." v78 "şu ana kadar en beğendiğim".
- **Değiştir artık seçenekleri yerinde açar** (Pano'yu değil): seçili kart üstte kalır, altında "Başka bir seçenek seç", şu anki "Seçili" işaretli, Vazgeç. Pano yalnız Pano düğmesinden açılır.
- **Omurga yeni oluşunca AI seçer:** "Omurga yeni oluştu" halinde her niyette AI'nın seçtiği kart "✨ Önerimiz · onayla" durumuyla gelir; eylem "Bunu seç" (onay), yanında kaynak ↗ ve Değiştir. Rezervasyon onaydan sonra.
- **Uçuş/tren satırı Skyscanner'a yaklaştı:** her seçenek ayrı kart; solda logo ve havayolu, ortada kalkış · süre/aktarma · varış, sağda fiyat ve bagaj ("1 bagaj dahil" / "Yalnız el bagajı"), en sağda kaynak simgesi (✨ AI, S/E ekleyen, 🔗 link) ve Seç. "Önerimiz" ve "En hızlı/En ucuz" kartın üst kenarında şerit.
- **Bilet tasarımı:** seçili uçuş/trende rota çizgisinin ortasında uçak/tren illüstrasyonu (yayındaki bilet gibi), altında bagaj.
- **Boş niyet = yönlendirme:** tahmini fiyat niyet satırına taşındı ("tahmini €90–160 / gece"); altta "Osaka'da 4 gece için nerede kalınır" ve üç bölge kartı (Namba, Umeda, Shin-Osaka: neden, tahmini fiyat, Booking.com'da ara ↗) + AI'dan öner. Sigortada iki paket.
- **Durumlar tamamlandı:** Karar bekliyor · Önerimiz (onayla) · Seçildi · Alındı/Rezerve · Ayarlandı ("Sen hallettin", transfer örneği, Fiyat ekle, Değiştir) · Gerek yok (× ile; niyet soluklaşır, "Geri al").
- **Ayrıntı (ⓘ / Ayrıntı ›) duruma göre:** seçiliyken karar yardımı (niyetine uyuyor mu ✓/✕, artılar, eksiler, iptal); alındıktan sonra yayındaki rezervasyon ayrıntısı (onay/PNR kodu + kopyala, giriş/çıkış ya da koltuk/bagaj/check-in, belge ekle, Otele yaz ↗, Haritada aç ↗, İptal ettim değiştir/kaldır, Düzenle). Uçuş günü canlı şeridi ayrı ele alınacak.
- **Etkinlik alındı:** "✓ Alındı" + Ayrıntı ›; belge ekleme ayrıntının içinde.
- **Hazırlık geri geldi** (yayındaki PrepList): ayrı kapalı satır "Hazırlık · 2/6 hazır"; açılınca tik listesi, her satırda neden (ör. "Kyoto'da 7–8 Nisan yağmur bekleniyor"), Amazon ↗ / Resmî site ↗, üstüne gelince "Orada yapılacak" ve ×, "Hazırları gizle", "Daha fazla öner".
- **Pano:** üst sekmeler Hepsi · Uçuş · Konaklama · Ulaşım · Etkinlik · Yapılacaklar · Belgeler (sayılarıyla); altında niyet süzgeci (Tokyo · Kyoto · Hakone), Kartlar | Karşılaştır, Hepsi | Biriktirdiklerin | AI.
  - Kartlar: niyete göre gruplanmış kare kartlar; kim ekledi, kaç beğeni (♥ + avatarlar), Seç; her grupta "Karşılaştır ›".
  - Karşılaştır: büyük sütunlar yan yana; büyük görsel, ad, fiyat ve toplam, niyetine uyuyor mu, artılar | eksiler yan yana, puan/iptal/bagaj, beğeni, kaynak ↗, Seç. Şu an seçili sütun yeşil.
  - Niyetin Pano düğmesi Pano'yu o niyetin karşılaştırmasıyla açar; plan sekmesindeki "Pano" Hepsi/Kartlar ile açar.
- Açık konular: uçuş günü / iptal takibi (ayrı ele alınacak); artı-eksi ve "niyetine uyuyor mu" verisinin kaynağı (AI özeti mi, kaynak site mi); beğeni ve "kim ne koydu" çok kişili veride nasıl tutulacak.

## v80 · docs/mockups/plan-v80-hiyerarsi (18 Ekim, v79 üstüne)
- **Yazı hiyerarşisi** (kapsayan > kapsanan): kategori 22 (kapalı satırda 18) · niyet 19 · seçili kart başlığı 17–19 · seçenek 15,5 · bilgi 13,5 · küçük 12. Rakam: seçili fiyat 24, seçenek 18. Niyet plakası kategoriyle aynıysa yazılmaz (Konaklama içinde "Konaklama" tekrar etmez; Ulaşım içinde "Tren", "Transfer" kalır).
- **Uçuş/tren bileti:** yayındaki bilet mantığı geri: şehir adı büyük (İstanbul / Tokyo), altında "IST · 01:55", ortada uçak/tren illüstrasyonu, sağda koçan.
- **Alındı artık dönüşüyor:** niyet kutusu kalın yeşil çerçeve, durum çipi dolu yeşil. Otel "fiş"e dönüşür: büyük yeşil tik, küçük görsel, "Rezerve edildi", ad, kaynak · tarih · gece, onay kodu + kopyala, "€900 toplam · ödendi", Ayrıntı. Uçuş koçanı: büyük tik damgası, "Bilet alındı", PNR + kopyala, "€1.580 · ödendi". Etkinlik: kartın üstünde yeşil "Bilet alındı" şeridi ve bilet kodu.
- **Kapalı satır önizlemesi anlamlı:** isim listesi yerine özet ("4 şehir · 14 gece · 10 fikir", "2 uçuş · gidiş ve dönüş · 5 fikir", "4 yolculuk · tren ve transfer"), ilerleme çubuğu (koyu yeşil alındı, açık yeşil seçildi) ve altında "1 alındı · 1 seçildi · 2 karar". Fikir sayısı = o kategoride biriken tüm seçenekler. Görseller varsa (en çok 3).
- **Hazırlık:** "Orada yapılacak" kalktı; Amazon logolu "Amazon'da al ↗". Kapalı satırda çubuk + "2/6 hazır".
- **Rota şeridi (İstanbul … İstanbul animasyonu) ve eski yapışkan özet kalktı.**
- **Sohbet sütunu daraldı:** clamp(300px, 26%, 400px).
- **Üst özet üç seçenek (prototipte seçilir):** A Kart (görsel solda, ad/tarih/şehirler/kişi/hazırlık ortada, bütçe sağda, altta Japonya bilgileri ve tercihler tek satır) · B Kapak (büyük kapak görseli, üstünde ad ve şehirler; altında Hazırlık, Bütçe, Japonya kutuları) · C Katlanır (tek ince satır: ad, hazırlık çubuğu, tahmini toplam, Sıradaki, "Ayrıntılar ▾" ile açılır). Üçünde de aşağı kaydırınca yapışkan ince şerit (ad, %hazır, toplam/bütçe, Sıradaki). Kapak görseli çizim; canlıda şehir fotoğrafı.
- **Pano:** niyete basınca karşılaştırma doğrudan açılır (Kartlar/Karşılaştır düğmesi kalktı). İki seçenek: A Sekme (üstte kategoriler, altında niyet çipleri) · B Kenar menü (solda Tümü > kategori > niyet ağacı, her birinde sayı ve durum noktası; sağda içerik). Kaynak süzgeci tek açılır seçim (Hepsi / Biriktirdiklerin / AI önerileri). Tümü ve kategori seçiliyken kartlar niyete göre gruplu, her grupta "Karşılaştır ›". Uçuşta logo alanı küçüldü.

## v81 · docs/mockups/plan-v81-yolculuk (18 Ekim, v80 üstüne)
Emre'nin istekleri: alınan şeyde fiyat değil ulaşma bilgisi ve belge; hero için yeni seçenekler (büyük görsel, az yazı, belki mozaik, her zaman katlanır); çok fazla yazı boyutu; Pano'da kenar menü kalsın ama daha güzel, seçenekler hep aynı boyda, artı/eksi/fiyat derli toplu, İlham bölümü, tek tıkla Biriktirdiklerim, AI önerileri ayrı belli, AI uyum puanı, etkinlik/yapılacaklarda kıyas yok; hero ile kategoriler arasındaki durum açıklaması ve "Ekle" kalksın; "Kategoriye göre / Yolculuk sırasıyla" net olsun; Layla.ai gibi yolculuk sırası; sağlayıcılar dinamik olsun.

- **Alındı = erişim modu.** Karar bitti, artık ulaşmak önemli. Fiyat kartın önünden kalkar (ayrıntıda "ödendi" olarak durur). Öne çıkanlar:
  - Otel: "Rezerve edildi · Booking.com", ad, giriş/çıkış saati, adres, onay kodu + kopyala; büyük yeşil "Onay e-postası aç", altında Haritada aç ↗, Otele yaz ↗, Ayrıntı ›.
  - Uçuş: koçanda tik, "Bilet alındı", PNR + kopyala, "Check-in 15 Nis 11:00'de açılır", büyük "E-bilet aç", Ayrıntı ›.
  - Tren: bilet kodu, vagon/koltuk; belge yoksa sessiz kesik çizgili "Bileti ekle".
  - Etkinlik: tarih-saat, buluşma yeri, bilet kodu, "Klook bileti aç", Haritada aç ↗.
- **Tren adlandırma kararı:** logo operatörün (JR, Odakyu), kalın ad hizmetin ("Nozomi", "Hikari + Romancecar"), altında küçük "JR · Shinkansen". Kullanıcı "Shinkansen Nozomi" diye arar, ama hangi şirket sorusunun cevabı logoda.
- **Hero üç yeni seçenek** (prototipte "Üst özet" ile seçilir), üçü de katlanır ve aşağı kaydırınca yapışkan ince şeride döner (ad, %hazır, toplam/bütçe, Sıradaki):
  - Mozaik: solda büyük kapak (Fuji, ad, şehirler), sağda 6 kare "yolculuk nasıl olacak" (Shibuya Sky, Fushimi Inari, Ichiran ramen, Gora Kadan onsen, Dotonbori, Arashiyama). Kareler plandaki ve biriken yerlerden seçilir.
  - Şehirler: ad + rota satırı, altında şehir sütunları; sütun genişliği gece sayısına göre.
  - Kapak: tek büyük sinematik görsel, üstünde ad; bilgi şeridi görselin üstünde cam (telefonda görselin altında).
  - Üçünde ortak şerit: tarih · kaç gün kaldı · kişiler · hazır çubuğu · tahmini toplam/bütçe · Sıradaki. Japonya bilgileri tek satır, tıklayınca açılır.
  - Görseller şimdilik çizim (flat SVG). Canlıda Places API fotoğrafı, yoksa bu çizimler yedek.
- **Yazı ölçeği (tek tablo):** 11 rozet · 12 küçük · 13,5 bilgi · 15 düğme/seçenek · 17 kart başlığı · 19 niyet · 22 kategori · 24 fiyat · 30 sayfa başlığı. v80'de 24 farklı boyut vardı, plan sayfasında artık 9. Yayındaki sohbet sütunu (26/16/14) bu tasarımın dışında, ayrıca ele alınmalı.
- **Kategoriler üstü sadeleşti:** durum açıklaması (Arıyoruz/Önerimiz/Seçildi/Rezerve/Ayarlandı) ve "Ekle" kalktı. Yerine "Plan" başlığı + görünüm seçici: Kategoriye göre · Yolculuk sırasıyla · Gün gün (Gün gün henüz çizilmedi).
- **Yolculuk sırasıyla** (Layla.ai benzeri, aynı veriden): bölümler Yola çıkmadan (Hazırlık, eSIM, sigorta) · İstanbul → Tokyo · Tokyo · Kyoto · Hakone · Osaka · Osaka → İstanbul. Şehir bölümünde görsel kare + ad + tarih/gece + "n hazır · n karar". Her adım: solda tarih (yoksa "esnek"), zaman çizgisinde durum noktası (kesik = karar, kum = seçildi, mor = önerimiz, yeşil = alındı), kartta tür · durum, ad, kısa bilgi, sağda duruma göre tek eylem (Seçeneklere bak / Ara / Bunu seç / fiyat + Rezerve et / E-bilet aç / Onay e-postası aç). Şehirdeki kullanılmamış etkinlik önerileri tek satır "Tokyo için 3 etkinlik önerisi › Önerilere bak". Bir görünümde yapılan seçim diğerine anında yansır; "›" planda o niyete götürür.
- **Pano yeniden:** solda kenar menü üstte dört sabit giriş (Tümü · Biriktirdiklerim · AI önerileri · İlham, sayılarıyla), altında "İhtiyaçlar" ağacı (kategori > niyet, durum noktası ve sayı). Biriktirdiklerim tek tık. Kartlar sabit boy (220 px ızgara), tek seçenek de büyümez.
  - Karşılaştırma yalnız konaklama, eSIM, uçuş ve trende. Sütunlar sabit 280 px, satırlar hizalı: görsel + kim ekledi/AI · ad · fiyat + toplam + **AI uyum puanı n/100 · n. sırada** · istekler (✓/✕) · artılar · eksiler · puan/iptal/bagaj · beğeni + kaynak ↗ + Seç. AI puanına göre sıralı; 3'ten fazlaysa yana kaydırılır; 3'ten azsa "Daha fazla seçenek · AI'dan öner" yer tutucusu. Durum etiketi: Şu an seçili / Alındı (AI önerisi seçili sayılmaz).
  - Etkinlik ve yapılacaklar: kıyas yok, toplama ızgarası ("+ Plana koy" / "Planda").
  - İlham: reels, YouTube, TikTok, blog kartları (platform rozeti, oynat/oku simgesi, süre, şehir, kim ekledi) + "✨ İçinden yerleri çıkar" ve "Aç ↗".
  - Pano her yerden açılır: üstteki Plan/Pano sekmesi, her niyetteki "Pano n"; kapatma × ve dışarı tıklama.
- **Sağlayıcılar dinamik olmalı (kod kuralı).** Logolu düğmeler sabit marka yazılmaz; bir sağlayıcı kaydından seçilir:
  - Kayıt: `{id, ad, logo, renk, kategoriler[], ülkeler[] | "global", aramaUrl(şablon), ortaklıkParametresi?}`.
  - Seçim sırası: (1) kullanıcının attığı linkin kaynağı, (2) gidilen ülke ve kullanıcının ülkesinde çalışanlar, (3) kategoriye uygun varsayılanlar.
  - Hazırlık alışverişi: Türkiye'den gidene Trendyol / Hepsiburada / Amazon.com.tr; başka ülkelerde o ülkenin Amazon'u. Prototipte yağmurluk Amazon, priz dönüştürücü Trendyol.
  - Konaklama: Booking.com · Airbnb · Agoda (Asya'da Agoda öne). Uçuş: Skyscanner · Google Uçuşlar. Tren: JR / Rome2rio, ülkeye göre (Trenitalia, SNCF, Renfe…). Etkinlik: Klook (Asya) · GetYourGuide · Viator.
  - "Kendin ara" satırı ve boş durum bölge kartlarındaki "…'da ara" düğmeleri de bu kayıttan gelir.
- Açık konular: Gün gün görünümü; uçuş günü ve iptal takibi; AI uyum puanının nasıl hesaplanacağı (niyetteki isteklere uyum + fiyat + puan; açıklaması ⓘ'de); artı/eksi verisinin kaynağı; beğeni ve "kim ekledi" için ortak gezi verisi; İlham'dan yer çıkarma akışı (hangi niyete düşer).
- Prototipte "Üst özet: Mozaik / Şehirler / Kapak" ve "Plan ilerledi / Omurga yeni" seçicileri var.
