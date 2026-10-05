# Chrome Web Store kaydı — Trip Radar

## Mağaza sayfası
- **Görünürlük:** Liste dışı (Unlisted): linki olan kurar, aramada çıkmaz.
- **Kategori:** Seyahat (Travel)
- **Dil:** Türkçe (ana), İngilizce

### Kısa açıklama (manifest'ten gelir, ≤132)
TR: Seyahat seçeneklerini tek tıkla kaydet; AI anlamlandırsın, karşılaştırsın, plana koysun.

### Ayrıntılı açıklama (TR)
Trip Radar, gezini planlarken bulduğun her şeyi tek yerde toplar.

• Gezerken kaydet: Booking'deki otel, uçuş, bir Instagram Reel'i, bir blog önerisi… "Kaydet"e bas, gerisini Trip
  Radar okur: fiyat, tarih, konum, puan.
• Karar ver: Seçenekleri senin önceliklerine göre karşılaştırır, artısını eksisini söyler.
• Gün gün plan: Uçuş, konaklama, ulaşım, etkinlikler ve fikirlerin gün gün akışa yerleşir; saatleri akıllıca
  hesaplar (havalimanına ne zaman çıkmalı, check-out ne zaman).
• Fikir havuzu: Gezilecek yerler ve restoranlar şehir şehir; bir güne koy, yaptıkça işaretle.
• Birlikte planla: Geziyi arkadaşınla paylaş; kaydettikleriniz ve oylarınız ortak olur.
• Belgeler: Biletler ve onaylar gezinin yanında; eksik olan uyarılır.

Hesap yok, reklam yok. Verilerin bilgisayarında kalır; yalnız AI'ya ve (paylaşırsan) paylaşım sunucusuna gider.

### Detailed description (EN)
Trip Radar collects everything you find while planning a trip in one place.

• Save as you browse: a hotel on Booking, a flight, an Instagram Reel, a blog tip… press "Save" and Trip Radar
  reads it: price, dates, place, rating.
• Decide: it compares your options by what matters to you and says the pros and cons.
• Day by day: flights, stays, getting around, activities and ideas fall into a daily plan, with smart times
  (when to leave for the airport, when to check out).
• Idea pool: places to see and restaurants by city; put one on a day, tick it off when done.
• Plan together: share a trip with a friend; your saves and votes are shared.
• Documents: tickets and confirmations sit with the trip; a missing one is flagged.

No account, no ads. Your data stays on your computer; it only goes to the AI and (if you share) the sharing server.

## Görseller
- Simge 128×128: `static/icons/icon-128.png`
- Küçük tanıtım 440×280: `store/promo-440x280.png`
- Ekran görüntüleri 1280×800: `store/screenshot-1-hero.png`, `-2-plan.png`, `-3-activities.png`, `-4-days.png`

## Gizlilik sekmesi
- **Tek amaç (single purpose):** Kaydettiğin seyahat sayfalarını toplayıp karşılaştırmak ve bir gezi planına
  dönüştürmek. / Collect the travel pages you save, compare them and turn them into a trip plan.
- **İzin gerekçeleri:**
  - activeTab: "Kaydet"e basılan sekmenin sayfasını okumak (yalnız o an, yalnız o sekme).
  - scripting: o sekmede sayfanın metnini ve görünen bölümünü almak için tek seferlik okuyucu çalıştırmak.
  - storage / unlimitedStorage: gezileri, kayıtları, ekran görüntülerini ve belgeleri bilgisayarda saklamak.
  - alarms: paylaşılan gezileri dakikada bir eşitlemek ve bekleyen kayıtları yeniden denemek.
  - Host izinleri: generativelanguage.googleapis.com ve api.anthropic.com (AI), *.supabase.co (paylaşım ve AI
    kapısı), nominatim.openstreetmap.org (adres → konum), api.frankfurter.* (döviz kuru).
- **Uzaktan kod:** Hayır. Tüm kod pakette.
- **Veri kullanımı:** Web sitesi içeriği (kaydedilen sayfalar), kişisel bilgi (paylaşımda profil adı ve fotoğrafı).
  Satılmaz, üçüncü taraflara amaç dışı aktarılmaz, kredi değerlendirmesi için kullanılmaz.
- **Gizlilik politikası:** https://github.com/yemredurmuss-hue/trip-radar/blob/release/PRIVACY.md
