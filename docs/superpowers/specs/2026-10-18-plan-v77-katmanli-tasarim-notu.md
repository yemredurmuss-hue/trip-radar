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

## v82 · docs/mockups/plan-v82-standart (18 Ekim, v81 üstüne)
Emre: kutuların boyu içindeki yazıya ve duruma göre değişmesin, bir standart olsun; bilgi gelse de gelmese de aynı boyda dursun (uçuşta bilet bilgisi varken güzel, yokken kötü duruyordu); küçük gereksiz bilgiler kalksın ya da gizlensin; referans görseldeki hizalamaya bak; hero = mozaik, referansa göre; yayındaki hero'nun üzerine gelince açılan bilgileri (özellikle Tercihler) unutma; hero ile plan güzel bir arayüzle ayrılsın.

- **Niyet kutusu standardı.** Her niyet = sabit başlık (76 px: görsel 52, ad 19, tek satır bilgi + istekler, sağda durum · Pano · ⋯) + sabit gövde (masaüstünde 196 px). Gövde her durumda aynı çerçeve, aynı yerde aynı bilgi:
  - Konaklama, eSIM, sigorta: görsel (196) | bilgi 4 satır (1: marka + puan ya da durum, 2: ad, 3: konum ya da tarih, 4: çipler) | yan sütun 232 (üstte fiyat ya da kod, altta ana eylem 42 px + ikincil satır 32 px).
  - Uçuş, tren, transfer: bilet (taşıyıcı satırı, şehirler + istasyon/saat, çipler) | aynı yan sütun.
  - Durumlar aynı çerçevede: Karar bekliyor (aynı yükseklikte 3 seçenek), Önerimiz (fiyat + Bunu seç), Seçildi (fiyat + Rezerve et/Satın al + Aldım · Değiştir), Alındı (kod + Belgeyi aç ya da kesik çizgili "Belgeyi ekle", aynı boy), Ayarlandı (transfer), Aranıyor (boş görsel, tahmini fiyat, bölge çipleri, Kendin ara simgeleri, AI'dan öner).
  - Değiştir: seçili kart yerinde seçeneklere döner (kutu büyümez), seçili olan yeşil çerçeveli, Vazgeç.
  - Ayrıntı (ⓘ ya da ⋯ > Ayrıntı) kartı büyütmez, kartın üstünde açılır.
  - Etkinlik ve yapılacaklar: iki sabit sıra, Planında ve Öneriler; kart boyu sabit (224 px, 4 sütun). Planında boşsa aynı yükseklikte boş yuvalar ("Henüz plana koymadın"). Fazlası "+n Pano'da". Alınan etkinlik kartı büyümez: görselin altında yeşil "Bilet alındı" şeridi, alt satırda kod + Bileti aç.
  - Prototipte tüm tekli niyetler (12'si) masaüstünde aynı yükseklikte ölçüldü.
- **Açık kategoride durum çizgisi** (referanstaki gibi): niyetler solda dikey çizgiye bağlı, noktanın rengi durum (kesik = karar, kum = seçildi, mor = önerimiz, yeşil = alındı, gri = ayarlandı). Niyet kutusunun zemini durumun açık rengi, içerik beyaz kart.
- **Sadeleştirme (küçük bilgiler):**
  - kalktı: niyet plakaları (Tren, eSIM, Etkinlik etiketi; karışık kategoride tür adı bilgi satırının başında), her niyetteki "Sohbete attığın linkler buraya düşer", "en iyi 3 · tümü 4, Pano'da" (yerine "4 · ilk 3, tümü Pano'da"), puan kelimesi ("Muhteşem"), trende "Rezervasyonlu koltuk", eSIM'de "Kurulumdan önce iade" / "İade yok" ve ad tekrarı ("Japonya 10 GB" + "10 GB"), sigorta boşken uydurma paketler ("Tedavi ve acil dönüş, 16 gün"), niyet satırında gezi geneliyle aynı olan "2 kişi", Hazırlık açıklama cümlesi.
  - kısaldı: iptal "Ücretsiz iptal" (tarih Ayrıntı'da); istekte "ücretsiz iptal" varsa iptal çipi tekrar etmez; seçenek satırında "kişi başı" her satırda değil.
  - yer değiştirdi: "Kendin ara" seçenek başlığının sağına (boşken simge olarak yan sütuna); Önerimiz / En hızlı rozetleri satırda kendi sütununa (adın üstüne binmiyor); ⓘ, × ve ⋯ tek "⋯" menüsünde (Ayrıntı, Gerek yok).
- **Hero = mozaik (referansa göre).** Solda büyük Fuji kapağı (ad 30 px + şehirler), sağda 3 × 2 kare (Shibuya Sky, Fushimi Inari, Ichiran Ramen, Gora Kadan onsen, Dotonbori, Arashiyama). Altında 4 bölmeli şerit: tarih | kişiler + hazırlık çubuğu | bütçe | Sıradaki. Altında çipler: Japonya, hava, yen, A/B priz, +6 saat, Japonca, Vize gerekmiyor; sonra Tercihler ve "Özeti küçült".
  - Yayındaki üzerine gelince/tıklayınca açılanlar korundu: hava (şehir şehir ortalama ve yağışlı gün), kur, priz uyumu (adaptör gerekir), saat farkı ("Sende 12:00 iken orada 18:00"), vize ayrıntısı, tarih (şehir şehir günler), hazırlık (alındı/seçildi/karar sayısı), kişilerin son hareketi ve "Kimler gidiyor" + davet, bütçe penceresi (Rezerve / Planlanan / Boşta, kategori dağılımı, karar bekleyenler eklenince), Tercihler penceresi "Seni böyle anladım" (kapsam etiketi, kaynak, × kaldır, AI'nın sorusu Evet/Hayır, "Yanlış olanı × ile kaldır").
  - Fotoğraflar prototipte Emre'nin referans görselinden kesildi, üstlerine basılı yazılar temizlendi. Canlıda Places API fotoğrafı.
  - Küçültülünce tek satır: görsel, ad, tarih · kişi · %hazır · bütçe, "Özeti aç". Aşağı kaydırınca yapışkan ince şerit (v81'deki gibi) duruyor.
- **Hero ile plan ayrı:** hero kendi açık mor zemininde, yuvarlak bir kutu içinde; altında 40 px boşluk, sonra "Plan" bölüm başlığı (30 px, altında "Gezinin omurgası · 7 karar bekliyor") ve sağda görünüm seçici.
- **Yolculuk sırasıyla:** şehir bölümleri hero'daki fotoğraflarla.
- **Telefonda** sabit yükseklik yerine aynı yapı korunuyor (görsel solda, bilgi sağda, yan sütun alta iniyor); başlıktaki istekler alt satıra kayıyor.
- Açık konular: Gün gün görünümü; telefonda çerçevelerin de eşit boyda olması gerekiyor mu (şimdi yalnız yapı aynı); Planında 4'ten fazla kalem olunca ne olacağı; Pano bu turda değişmedi.

## v83 · docs/mockups/plan-v83-turler (18 Ekim, v82 üstüne)
Emre: tasarımı olmayan canlı özellikler çizilsin (A2 kapsamı); gezi türü değişince omurga ona göre kurulsun; "Ozora dışında da diğer türler için sistem hazır olmalı". Üç sayfa: `index.html` (Japonya), `ozora.html` (festival), `turler.html` (tür iskeleti). Prototip denetim çubuğunda senaryolar: Plan ilerledi, Omurga yeni, Durumlar, Uçuş günü, Gezi sırasında; "Hareketi duraklat".

- **Gezi ⋯ menüsü (C1)** kapağın sol üstünde: Belgeler, Paylaş, Planı PDF indir, Rotayı haritada gör, Geçmiş ve çöp kutusu, Yeni sohbet, Link ekle, Ayarlar, ayrı satırda kırmızı "Geziyi sil".
- **Fotoğraf künyesi (C7):** her karede üzerine gelince küçük "i"; künye orada yazar (canlıda Google Haritalar fotoğrafı ve çekenin adı).
- **Hazırlık sayısı (B9):** şeritte "%61 planda · %33 alındı", çubuk iki ton. Sayılar plan durumundan hesaplanır (18 ihtiyaçtan 11'i planda, 6'sı alındı); seçince, Gerek yok deyince hero, yapışkan şerit ve "n karar bekliyor" birlikte güncellenir. Sayıya basınca ilk karara gider (F5). "Sıradaki" kendini günceller (F4): önce Önerimiz onayı, sonra karar bekleyen; vize gerekiyorsa önce vize.
- **Omurga yeni (C19):** olmayan bilgi yazılmaz, yeri olmaz: mozaikte yer kareleri yerine şehir kareleri, şeritte tarih "~", hazırlık yerine "18 ihtiyaç · 5'inde önerimiz var", tercihler satırı yok.
- **Diğer türler (C14, D2, D10):** Hakone Free Pass (pass bileti, Alındı) ve Ashi Gölü vapuru "Dahil · Hakone Free Pass ile" (karar istemez, "Pass'i aç" ile pass'e gider). Kyoto'da restoran rezervasyonu (kod, saat, Aç) ve not kartı (JR ofisi). Ozora'da festival otobüsü (araç kiralama seçeneğiyle) ve AI'ın eklediği dönüş otobüsü (C16: eksik bilet niyet olarak gelir, Önerimiz).
- **Paket ve Dahil (D2):** Ozora'da Konaklama kendiliğinden "Çadır konaklama · festival kampı", durum "Dahil · festival biletiyle", "Festival biletini aç" ve "Hazır çadır kirala" linki. Dahil kutusu kapsayan niyet alındıysa alındı sayılır.
- **Vize gerekiyor (C25):** Ozora'da kehribar satır: "Schengen vizesi gerekiyor · randevu en az 15 gün önce", Resmî kaynak, "✓ Vize alındı". Hero'da uyarı çipi.
- **Uçuş günü (C4):** alınmış biletin çip satırı canlı şeride döner: Canlı · Kapı 21 · Biniş 10:45 · Rötar +25 dk · KIX T1; "Biniş başladı" rozeti; yan sütunda "Yeni kalkış 11:25, varış 18:05. Planı yeni saate kaydırdım."
- **Gezi sırasında (D8, F2):** hero'nun yerine "Bugün" şeridi (tarih, hava, saat saat kalemler, şu anki satır vurgulu, geçenler soluk, her satırda tek eylem, altta yarının ilk işi). Plan Yolculuk sırasıyla açılır, bugünün bölümünde "Bugün" rozeti.
- **Durumlar (C9, C10, C35, E13–E15):** "AI Osaka için arıyor" iskeleti (nabız yalnız gerçekten ararken), sonuç gelince kartlar 60 ms arayla yerine oturur ve "Yeni" işareti alır; sohbetten gelen yeni kart; okunamayan link kartı (kesik çizgi, Tekrar dene, Kaldır); AI hatası yan sütunda ince satır, kırmızısız; çevrimdışı şeridi plan başlığının üstünde.
- **Sohbet uyumu (C34):** AI'ın eklediği kayıt sohbette kart olarak (marka, puan, fiyat), "Planda göster" kutuya götürüp parlatır, "Bunu seç" kutuda seçer; altında hızlı yanıtlar.
- **Belgeler (C5):** Pano kenar menüsünde "Belgeler": türe göre gruplar, her belge kendi kartına bağlı ("Kartı göster"), bekleyen, eklenmemiş ve "Bağlanmamış" (sohbete atılan poliçe: "Karta bağla"), en altta "Belge ekle".
- **Gerek yok (F3, E7):** kutu katlanır, kategori sonundaki "Gizlenenler · n" altına iner, Geri al ile yerine döner; sayılar güncellenir.
- **860 px altı (A7 sonrası taslak):** önce plan; sohbet alttan çekmece (tutamak, "Asistan" ve son mesaj, altında yazma kutusu), açınca görüşme ve hızlı yanıtlar; "Planda göster" çekmeceyi kapatıp kutuya gider.
- **Hareket (E1–E17):** kutu içeriği 260 ms'de gelir, seçilen kart 380 ms'de seçili karta dönüşür, Değiştir'de seçenekler çevrilerek gelir, Plana koy'da kart yuvasına uçar ve sayı sıçrar, Pano ortadan büyür (dar ekranda alttan), mozaik kareleri 80 ms arayla, küçük pencereler 180 ms. Seçince bildirim yok (E16). "Hareketi duraklat" ve azaltılmış hareket hepsini durdurur.
- **Türler sayfası:** tür iskeleti şeması (TripType, SpinePart) ve 11 tür için omurga: festival, dalış teknesi, kayak, wellness retreat, kruvaziyer, yol gezisi, günübirlik, iş seyahati, safari ve kamp, balayı, klasik şehir turu. Her türde kategori kategori kutular (ad, çerçeve, kaç tane, başlangıç durumu, Dahil olanlar), kapanan kategoriler ve nedeni, hazırlık, sorular, üst özet farkı. Tanınmayan tür ve canlı koda karşılığı tablosu.
- Ölçüm: 1440 ve 860 px'te bütün tekli niyetler 288 px (Japonya 14, Ozora 8); taşma yok, konsol hatası yok. 390 px'te yapı aynı, boy eşit değil (A8: sonraki iş).
- Açık konular: Gün gün görünümü; 390 px'te eşit kutu boyu; "Dahil" kapsayan niyet alınmamışken nasıl sayılacak (öneri: sayılmaz, karar da sayılmaz); kruvaziyer liman günlerinin Yolculuk sırasıyla çizimi.

### v83 ek · Hazırlık (Etsy kararları) ve gezi biçimi (18 Ekim)
Emre: T3 "bu olsun ama nerede duracağını göster", T6 "bavul çok kişisel, nasıl tasarlanacağını görmem gerek"; türler için "kalıp yaparsak tutturamayız, ona göre şekillensin; düşündüklerimiz için ilgili bölümde mini bir bilgi olsun".
- **Hazırlık açılınca:** en üstte "Bilmen gerekenler" kartı (T8 b; acil numara, nakit, bahşiş, ayakkabı, trende, büyükelçilik; bilinmeyen satır yok). Altında "2/6 hazır · güne göre sıralı" ve günlü maddeler (T3): her satırın sağında gün ("1 Nis'e kadar", "15 Nis 11:00"), maddenin nereden geldiği küçük etiketle ("uçuş kartından", "sohbetten", "vize kuralından"); günü olmayan altta, "tarih yok" yazılmaz; yaklaşan gün turuncu. Kapalı satırda "Gezi öncesi 6 iş · sıradaki: Yen bozdur, 1 Nis'ten önce"; Yolculuk sırasıyla'da Hazırlık adımı da sıradakini söyler.
- **Kalan ödeme (T4 b, sonraki küçük sürüm):** "Gora Kadan: kalan €300'ü girişte öde · 9 Nis · sohbetten". Ayrı ödeme alanı yok.
- **Bavul (T6 a):** listenin sonunda katlı tek satır "Bavul · Emre için · Nisan havası, 16 gün ve plandaki yerlere göre · 6/11 hazır · 2 alınacak". Açılınca: üstte bilinen ve sorulan (Bagaj: "Valiz · 23 kg (TK49'da 1 bagaj dahil)", "16 günde çamaşır yıkayacak mısın? Evet / Hayır"); gruplar nedenleriyle (Hava, Plandaki yerler, Elektronik, Belgeler ve para); alınacaklarda mağaza linki; her satırda "bana göre değil" (×); altta "Her gezide götürdüklerin" (kulaklık, uyku maskesi, kişisel ilaçlar, + Ekle) ve "Bu liste sana göre: kaldırdığını bir daha önermem, eklediğin sonraki gezilerde de gelir." Ozora'da kamp ve festival grupları.
- **Kişi başı (T5 a):** bütçe penceresinde "Kişi başı ~€3.450 · 2 kişi"; bütçe yoksa satır yok.
- **Gezi biçimi:** Türler sayfası "Gezi biçimi ve omurga" oldu: 11 sinyal (nerede uyunur, paket, pass ya da kiralık araç, hareketli üs, yakın havalimanı, günlük hak, odak, ekipman, belge ve sağlık, kimler, zaman); adı tanınmayan 3 gezi yalnız sinyallerden (Kapadokya balonu, Berlin maratonu, Interrail); 11 hazır karışım sinyal çipleriyle. Biçim bir şeyi değiştirdiyse ilgili kategorinin başında kısa bilgi satırı: Ozora Konaklama "festival günlerinde konaklama bilete dahil kamp olarak kuruldu, otel aranmaz", Etkinlik "odak festival", Ulaşım "Ozora'nın havalimanı yok"; Japonya Ulaşım "Hakone Free Pass alındığı için… Dahil".
- Açık konu: Bavul tek liste (T6 a); iki kişi için ayrı liste istenirse T6 c (orta iş).
