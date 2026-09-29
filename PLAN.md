# Plan

## Amaç
Dağınık seyahat linklerini tek bir karar panosuna dönüştürmek. Önce kendi gezimde kullanacağım,
sonra ürünleşecek.

## İlke
Biz arama yapmayız, sunucudan kazıma yapmayız. Kullanıcının gördüğü sayfayı, onun tıklamasıyla
kaydederiz. Her bilgi en güvenilir kaynaktan alınır:

1. **Link:** tarih, kişi, ilan kimliği.
2. **Sayfanın düzenli verisi:** ad, puan, adres (JSON-LD / meta).
3. **Sayfa yazısı + ekranda görünen kısım:** fiyat, oda, iptal, yorumlar.
4. **Ekran görüntüsü:** kullanıcının o an neye baktığı; yazı olmayan bilgiler.

## v0: Kişisel (bu sürüm)
- [x] Chrome eklentisi: tek tıkla kayıt (link + yazı + düzenli veri + ekran görüntüsü)
- [x] AI çıkarımı: kategori, gezi, ihtiyaç grubu; fiyat/puan/iptal için alıntı zorunlu ve doğrulanıyor
- [x] Otomatik gezi oluşturma, tekrar kayıtları birleştirme, fiyat geçmişi
- [x] Pano: solda sohbet, sağda kategoriler (ihtiyaç başına en fazla 3 satır), detay çekmecesi
- [x] Sohbet: seçim / eleme / rezerve / öneri / tercih / bütçe araçları, en fazla bir soru, hızlı yanıt butonları
- [x] Link yapıştırma, ekran görüntüsü sürükleme, Google Maps rota linki, JSON dışa aktarma
- [x] Ücretsiz Gemini varsayılan sağlayıcı; Claude isteğe bağlı (ortak arayüz: `src/lib/llm/`)
- [x] Gezileri ülkeye göre ayırma (Portekiz ≠ Tayland), elle taşıma; hata ekranı (boş sayfa yok)
- [x] Karar zekası: kriter bazlı 0–100 puan, kullanıcının belirlediği önem, nedenler/bedeller,
      "ne değişirse sonuç değişir", ücretsiz konum ve kur, AI yorumu ayrı ve düşük ağırlıklı (`src/lib/decision.ts`, `analysis.ts`)
- [x] Plan iskeleti (0.7): gece gece rezerve / seçildi / açık / boş, rezervasyonla kapanan seçenekler
      (geri alınabilir), aynı gecelere göre karşılaştırma, "elenebilir" (`src/lib/plan.ts`)
- [x] 0.8: niyet profili (söylenen + kaydedilenlerden/seçimlerden sezilen, kaynağıyla, yok sayılabilir),
      kesin şartlar, "değer mi?" karar kartı (somut birimle fark, "ama … ise", kalan bütçe) (`intent.ts`, `value.ts`)
- [x] 0.9: her sayfa (her site) baştan sona okunur; bulgular kanıtıyla (yorum alıntısı, tarih) saklanır,
      sayımı kod yapar, sayfada olmayan alıntı atılır, eski yorum karar vermez (`reader.ts`, `listing.ts`);
      her kayıtta solda artılar / sağda eksiler (`proscons.ts`); kanıta dayalı eleme ve "sorun değil";
      ilan ≠ teklif (farklı tarih/oda üstüne yazmaz); eksik fiyat kararı durdurmaz; tanı dosyası
- [x] 0.9.2: ciddi sorun puandan düşer, başa başta "fiyat/performans" önerisi, rozetler; açılır kartlar
      (kapalıyken özet, açıkken kanıtlı artı/eksi), gece gece gün şeridi ve belirgin tarih blokları;
      güncellemeler 1-2 dakikada gelir
- [x] 0.10: transferler plandan kendiliğinden açılır (varış, şehir değişimi ve iki uçtaki havalimanı/gar,
      otel değişimi, gidiş), durumuyla (boş / planlandı / seçenek / rezerve); sohbetten "metroyla" işaretleme;
      sayfadan okunan giriş/çıkış saatleriyle ince detay notları (`legs.ts`)
- [x] 0.11: karar kartları (seçim yapılmamış her karşılaştırma yana kaydırılan kartlarla) ve tek zaman çizelgesi
      (uçuş → konaklama → transferler → etkinlik → dönüş); ayrıntısı aşağıda
- [x] 0.12: geceleri örtüşen konaklamalar tek karşılaştırma (gece başına fiyat, eksik gece notu), şehir adları
      dilden bağımsız (Lisbon = Lizbon) ve haritada yakın yerler aynı yer; dar sohbet; seçilenler sade yuvarlak
      kartlar (uçuş rota olarak, konaklama resim + puan + toplam/gecelik fiyat), solda simgeli etiket sütunu, şehir etiketleri
- [x] 0.13: sohbette söylenen planlar panoda (uçuş, tren, araç kiralama, konaklama; "planlanıyor" / "bilet alındı"),
      uçuşlar rota ve tarihe göre ayrı ihtiyaç (dönüş gidişi kapatmaz) ve her uçuş kendi gününde, şehir blokları,
      şehir değişimi uçuş kartı olarak, rezervasyonu geri alma, tarih bandı kaldırıldı, sohbet layla ölçüsünde
- [x] 0.13.1: denetim — 20.000 rastgele gezilik stres testi (`tests/scenarios.test.ts`) ve düzeltmeler: Claude'da
      sayfa okuma şema sınırını aşıyordu (talimatla JSON + doğrulama), katı araçlar sınır içinde; havalimanı
      kodları ve istasyon adları şehir sayılır, ters yöndeki uçuş varış/dönüş sayılmaz; transfer planı başka uçuş
      seçilince kaybolmaz; sohbetteki araç kiralama ve transferler kaydedilen sayfayla birleşir; tekrar söylenen
      plan öncekini korur; asistan geçersiz durum/tarih kabul etmez ve seçince öncekini geri alır; kişi başı
      konaklama fiyatı; "Seç" artık sohbet planını silmez (kenara koyar, geri alınınca döner)
- [x] 0.14: gün gün plan — her şehirde önce konaklamalar (tarih sırasıyla; yer yoksa "Planlanmadı"), sonra her gün
      için bir kart ("5. gün · 11 Ekim Cmt"; transferler ve planlar içinde, boş gün de görünür); aktarmalı gidiş
      (İstanbul → Kopenhag → Porto) varıştan önce; rezervasyonu olmayan gecelerin şehri oraya giden uçuştan,
      oradan kalkan uçuştan ya da o günlerdeki kiralık araçtan; "Bilet alındı / Rezerve edildi" yeşil,
      "Planlanıyor / Seçildi" amber şerit kartın üstünde; açılan kart kısa: tek cümle durum, bilgiler, en fazla 4
      artı ve 4 dikkat (kanıt "Tüm detaylar"da); duman dedektörü, saç kurutma makinesi gibi önemsiz ayrıntılar puana
      ve kartlara girmez
- [x] 0.14.1: kart önü sade etiketler — en büyük artı ve eksi en üstte, birkaç kısa etiket daha ("Yakın", "İade yok",
      "Sessiz odalar", "€45 pahalı"); aynı konudaki etiketler teke iner; semt/mahalle adı kart önünden kalktı (detaylarda)
- [x] 0.14.2: kart önünde artılar solda eksiler sağda alt alta (en büyüğü üstte), somut bulgu kendi sözleriyle
      ("Karşısında genelev var"), kapalı kartlar aynı boy, seçilen kartta artı/eksi yok; üstte özet: resim, ad,
      tarih, gün/şehir/etkinlik/konaklama/ulaşım
- [x] 0.15: karar kolaylığı — karar sırası ve ilerleme, bütçe çubuğu, seçenekler yan yana ve tek satır öneri,
      ★ kendi önceliklerin, tarih uyarıları (ücretsiz iptal bitişi, rezerve edilmedi), DESIGN.md arayüz kuralları
      (renk anlamları, tek ana buton, okunur gri, kırmızı eksi)
- [x] 0.16: yapılacaklar şeridi (Karar ver / Rezerve et / Planla / ⏳ iptal süresi; planlanıp rezerve edilmeyen ve
      hiç seçeneği olmayan her şey dahil), kartta Ele, transfer ve boş gecelerde "Gerek yok" (Gizlenenler'den geri),
      sohbette söylenen günü belirsiz plan şehrin bloğunda hemen, rezervasyon onayı ekran görüntüsü planı yeniden
      kurar, seçili karta dokun = diğer seçenekler / ⓘ = detay, fiyat seçeneklerin ortalamasına göre, transferler
      "Havalimanı → Otel" sadeliğinde (notlar açınca)
- [x] 0.16: yolculuk günü tek kart (seçenek 1, geçiş kartı): şehir değiştirilen, varış ve dönüş günü çizgide iki şehrin
      arasında; adımlar saat sırasıyla (check-out, transfer, uçuş/tren, transfer, check-in), her biri durumuyla;
      tahmini saat "~" ile, bilinmeyen "saat yok"; "Bugün" işareti ve "Seyahat başladı · N. gün"
- [x] 0.17: rezervasyon kartları — kendi rezervasyonu olan şey kart (rezerve edilince ✓ satıra küçülür), bilgi
      (check-in/out, araç teslim/iade) ince satır, günler açılır/kapanır (işi kalan açık, "N iş"), yolculuk günü aynı
      satırlarla, kiralık araç kiralamanın başladığı günün üstünde kendi kartı
- [x] 0.18: rezervasyon kartları katlanmaz (rezerve edilince yeşil kart kalır), taksi rezervasyon sayılır, metro/yürüyüş
      bilgi satırı, araç kiralama alış gününün kartı, saat altı açıklamalar kalktı, yolculuk başlığı sade
- [x] 0.18.1: gün satırları hizalı — nokta gezi çizgisinde, saat gün etiketinin altında, kartlar diğer kartlarla aynı sütunda
- [x] 0.18.2: sol sütun kalktı — solda yalnız çizgi, etiketler kartın üstünde başlık, kartlar genişliği kullanıyor
- [x] 0.19: iki görünüm — Plan (Layla gibi: solda etiket, sağda kart; yalnız kararlar ve rezervasyonlar, check-in/out
      ve boş gün yok) ve Günlük akış (gün gün, saat saat; uçuş/taksi/etkinlik küçük blok, bilgi ince satır, bloğa
      dokununca Plan'daki kartı); şehir bloğunun içi dışıyla aynı hizada
- [ ] Sonraki öneriler (onay bekliyor): 7 sade karşılaştırma, 8 zaman çizelgesinde tekrarların kalkması,
      9 sohbet ↔ pano bağlantısı, 10 sırayla karar ver modu
- [ ] 0.17: ciddi adaylar için daha çok yorum toplama (süre/yorum sınırlı, kaldığı yerden devam),
      açık sekmeleri toplu kaydetme (booking.com / airbnb izni gerekir), yeni gelen için "2. sırada, çünkü…" notu
- [ ] İlk gerçek gezide kullanım: 20–50 gerçek kayıt, hangi alanların yanlış/eksik geldiğini not et

## 0.11 uygulama planı: karar kartları ve zaman çizelgesi (yapıldı)

Hedef: seçilmemiş her ihtiyaç (uçuş, konaklama, tren, eSIM...) yana kaydırılan kartlarla karşılaştırılır.
Kartta kaynak, görsel, puan, fiyat ve en fazla iki artı ile iki eksi olur; "Detaylar" kartın içinde nedenleri
açar; "Seç" ile grup tek satıra iner. Sonra bütün gezi tek bir zaman çizelgesinde okunur.

Hazır olan altyapı: sıralama ve puan (`decision.ts`), artı/eksi ve kanıt (`proscons.ts`, `Evidence.tsx`),
karşılaştırılabilir toplam fiyat (`totalPrice`), rozetler (`rolesOf`), geceler ve transferler (`plan.ts`,
`legs.ts`), sayfanın görseli (`imageUrl`) ve sağlayıcı adı (`provider`).

### A. Kart verisi (arayüzsüz, testli)
- [x] `cardFacts.ts` (saf fonksiyon): kaynak rozeti (site adı + sitenin kendi favicon'u, yoksa baş harf), başlık,
      kategoriye göre alt satır, fiyat ve etiketi, puan, en fazla 2 artı + 2 eksi, durum.
  - Alt satır: konaklama "Daire · Baixa · 1 yatak odası"; uçuş "09:00–11:10 · Direkt · 2 sa 10 dk";
    tren/otobüs "13:09–16:04 · 2 sa 55 dk"; etkinlik "9 Ekim 16:00 · 2 saat"; eSIM "5 GB · 7 gün".
  - Fiyat: gezinin para biriminde karşılaştırılabilir tutar + etiket ("3 gece toplam", "kişi başı",
    "2 kişi toplam"); fiyat yoksa "Fiyat için tarih seç"; geçici fiyatsa işaretli.
  - Durum: Elendi (sebebiyle, kart sona ve soluk), Şartına uymuyor, Geçici puan, Seçildi, Rezerve.
- [x] Kısa artı/eksi: karşılaştırma satırlarına 2–4 kelimelik `short` metin ("€45 daha ucuz", "Merkeze yakın",
      "Direkt uçuş", "Ücretsiz iptal", "İade yok", "Uzun yolculuk"). Bulgular zaten kısa. Kartta: belirleyici eksi
      önce; eski ya da doğrulanmamış bulgu kartta gösterilmez (detayda kalır).
- [x] Çıkarım: konaklama türü (otel odası / daire / ev / pansiyon) ve yatak odası sayısı; eski kayıtlar için
      isteğe bağlı alanlar, yoksa oda adı ve bölge kullanılır.
- [x] Görsel kuralı: yalnız sayfanın kendi görseli; uçuş ve trende kategori renginde sade bir zemin ve simge.
      Hazır stok fotoğraf ya da üçüncü taraf görsel servisi yok.

### B. Kaydırmalı kartlar
- [x] `Carousel.tsx`: CSS scroll-snap ile dokunmatik ve trackpad kaydırma, başlıkta ‹ › düğmeleri, klavyede ←/→,
      "2 / 4" göstergesi. Kart ~300 px; sonraki kartın kenarı görünür. Sıra: en iyi puan önce, elenenler sonda.
- [x] `SwipeCard.tsx`: üstte görsel, sol üstte kaynak rozeti, sağ üstte puan dairesi; ad, alt satır, büyük fiyat,
      iki sütun artı | eksi; altta "Detaylar" ve "Seç".
- [x] "Detaylar" kartın içinde açılır: bütün artı/eksiler kanıtıyla, bir sonrakine göre neden önde/geride,
      iptal ve vergi koşulları, okunan yorum sayısı, "Karşılaştır →", "Sayfayı aç ↗" / "Tarihlerle aç ↗".
- [x] Seçilince grup tek satıra iner: "Seçildi · rezerve edilmedi" + "Değiştir" (kartları geri açar).
      Rezervede "Rezerve ✓" / "Bilet alındı ✓".
- [x] "Senin için X" karar kartı kartların altında kalır.
- [x] Testler: `cardFacts` her kategori için, kısa artı/eksi seçimi, kart sırası. e2e: ileri düğmesi, Detaylar,
      Seç → tek satır, Değiştir. Ekran görüntüsü geniş ve dar panelde.

### C. Tek zaman çizelgesi
- [x] `timeline.ts` (saf): gezi günlerine göre sıralı bölümler: "8 Ekim · Uçuş · İstanbul → Porto",
      "8–11 Ekim · Konaklama · Porto", transferler, "11 Ekim · Şehir değişimi", tarihli etkinlikler kendi gününde,
      "14 Ekim · Dönüş". Varış, şehir değişimi ve dönüş eşleştirmesi `legs.ts`'teki mantıktan gelir.
- [x] Boş yerler: kayıt yoksa "Henüz eklenmedi" + o günün uçuş araması. Kalkış şehri kayıtlı uçuşlardan okunur;
      bilinmiyorsa arama konumu kullanır (ayrıca sormaya gerek kalmadı).
- [x] Sol kenarda simgeli çizgi; her bölüm başlığında tarih ve tür. Tarihsiz etkinlikler sonda
      "Tarihi belli değil" altında.
- [x] Testler: sıralama, boş yerler, iç içe tarihler, tek şehirli ve çok şehirli gezi.

Kararlar:
- Puan kartta da 0–100 ve "uyum" etiketiyle gösterilir; diğer ekranlarla tutarlı kalır ve yalnız AI'ın
  verdiği bir not olmadığını belli eder.
- Kartta gösterilen her şey kayıttan ya da kod hesabından gelir; kart metni üretmek için ek AI çağrısı yok.

## v1: Telefon
- Küçük bir sunucu (ör. Supabase) + senkron. Veri modeli buna hazır (`src/lib/types.ts`).
- iPhone/Android'den ekran görüntüsü veya link gönderme: paylaş menüsü kısayolu ya da Telegram botu.
- Onay e-postalarını iletme adresi → "rezerve edildi" otomatik.

## v2: Ürün
- Giriş sistemi, API çağrılarının sunucuya taşınması (anahtar tarayıcıdan çıkar).
- Chrome Web Store yayını, hukuki görüş (TTK 55, FSEK Ek 8, KVKK).
- Ortak gezi / oylama, gün gün plan.

## Açık sorular (gerçek kullanımda cevaplanacak)
- Booking/Airbnb sayfalarında iptal koşulu ve oda fiyatı sayfa yazısında güvenilir geliyor mu?
- Mobil uygulama paylaşım linkleri tarih taşıyor mu?
- Varsayılan önemler (konaklamada fiyat ve konum "önemli") gerçek kararlarımla örtüşüyor mu?
- Gemini ücretsiz modeli gerçek sayfalarda fiyat/iptal/oda bilgisini ne kadar doğru çıkarıyor? Günlük sınır yetiyor mu?
- Okuyucu gerçek Booking/Airbnb/tur sayfalarında yorumları birebir alıntılayabiliyor mu, kaç yorum görünüyor?
  (Tanı dosyasından gerçek sayfalarla test seti kurulacak.)
