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
      (geri alınabilir), şehirler arası eksik ulaşım uyarısı, aynı gecelere göre karşılaştırma, "elenebilir" (`src/lib/plan.ts`)
- [x] 0.8: niyet profili (söylenen + kaydedilenlerden/seçimlerden sezilen, kaynağıyla, yok sayılabilir),
      kesin şartlar, "değer mi?" karar kartı (somut birimle fark, "ama … ise", kalan bütçe) (`intent.ts`, `value.ts`)
- [x] 0.9: her sayfa (her site) baştan sona okunur; bulgular kanıtıyla (yorum alıntısı, tarih) saklanır,
      sayımı kod yapar, sayfada olmayan alıntı atılır, eski yorum karar vermez (`reader.ts`, `listing.ts`);
      her kayıtta solda artılar / sağda eksiler (`proscons.ts`); kanıta dayalı eleme ve "sorun değil";
      ilan ≠ teklif (farklı tarih/oda üstüne yazmaz); eksik fiyat kararı durdurmaz; tanı dosyası
- [ ] 0.10: ciddi adaylar için daha çok yorum toplama (süre/yorum sınırlı, kaldığı yerden devam),
      açık sekmeleri toplu kaydetme (booking.com / airbnb izni gerekir), yeni gelen için "2. sırada, çünkü…" notu
- [ ] İlk gerçek gezide kullanım: 20–50 gerçek kayıt, hangi alanların yanlış/eksik geldiğini not et

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
