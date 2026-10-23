# Chrome Web Store kaydı · Trip Radar

## Mağaza sayfası
- **Görünürlük:** Liste dışı (Unlisted): linki olan kurar, aramada çıkmaz.
- **Kategori:** Seyahat (Travel)
- **Dil:** Türkçe (ana), İngilizce

### Kısa açıklama (manifest'ten gelir, ≤132)
TR: Seyahat seçeneklerini tek tıkla kaydet; AI anlamlandırsın, karşılaştırsın, plana koysun.
EN: Save travel options in one click; AI reads them, compares them and puts them in your plan.

### Ayrıntılı açıklama (TR)
Trip Radar, gezini planlarken bulduğun her şeyi tek yerde toplar ve neyin kaldığını bir bakışta gösterir.

• Gezerken kaydet: bir otel sayfası, bir uçuş, bir video, bir blog önerisi… "Kaydet"e bas, gerisini Trip Radar
  okur: fiyat, tarih, konum, puan.
• Gezinin özeti: üstte gezinin fotoğraflarıyla bir kapak; altında tarih, kimler gidiyor, bütçe ve hazırlık
  ("%61 planda · %33 alındı"). "Sıradaki" düğmesi bir sonraki işi gösterir.
• Plan kategori kategori: uçuş, konaklama, ulaşım, etkinlikler, yapılacaklar, belgeler ve hazırlık. Her ihtiyaç aynı
  ölçüde bir kutu: Önerimiz, Seçildi, Alındı tek bakışta. Alınmış olanda fiyat değil, kod, saat ve belge önde.
• Karar ver: seçenekler Pano'da yan yana; uyum puanı, istediklerin, artısı ve eksisi aynı hizada.
• Etkinlikler şehir şehir: "Planında" ve "Öneriler" iki sıra; beğendiğini tek dokunuşla plana al.
• Yolculuk sırasıyla: hazırlıktan dönüşe adım adım, her adımda tek iş. Gezi sırasında "Bugün" şeridi; uçuş günü
  kapı ve rötar. Gün gün akış da yerinde.
• Hazırlık: günü gelen işler sırasıyla, gezine göre hazırlanan bir bavul listesi, ülke için bilmen gerekenler.
• Birlikte planla: geziyi arkadaşınla paylaş; kaydettikleriniz ve beğendikleriniz (♥) ortak olur.
• Belgeler: biletler ve onaylar kendi kartının yanında; eksik olan uyarılır. PDF olarak indir.

Hesap yok, reklam yok. Verilerin bilgisayarında kalır; yalnız AI'ya ve (paylaşırsan) paylaşım sunucusuna gider.

### Detailed description (EN)
Trip Radar collects everything you find while planning a trip in one place, and shows at a glance what's left to do.

• Save as you browse: a hotel page, a flight, a video, a blog tip… press "Save" and Trip Radar reads it: price,
  dates, place, rating.
• The trip at a glance: a cover made of the trip's photos; under it the dates, who's going, the budget and how ready
  you are ("61% planned · 33% booked"). "Next" takes you to the next thing to do.
• The plan, part by part: flights, stays, getting around, activities, things to do, documents and prep. Every need is
  a box of one size: our pick, chosen, booked at a glance. Once booked, the code, the times and the ticket come first,
  not the price.
• Decide: options side by side on the Board, with a fit score, what you asked for, pros and cons lined up.
• Activities city by city: two rows, "On your plan" and "Suggestions"; one tap puts one on the plan.
• In trip order: from getting ready to coming home, step by step, one thing to do at each. During the trip a "Today"
  strip; on a flight's day its gate and delay. The day-by-day view is still there.
• Prep: what's due, by day; a packing list made for the trip; what's good to know about the country.
• Plan together: share a trip with a friend; your saves and likes (♥) are shared.
• Documents: tickets and confirmations sit with their cards; a missing one is flagged. Download the plan as a PDF.

No account, no ads. Your data stays on your computer; it only goes to the AI and (if you share) the sharing server.

## Görseller
- Simge 128×128: `static/icons/icon-128.png`
- Küçük tanıtım 440×280: `store/promo-440x280.png`
- Ekran görüntüleri 1280×800, örnek gezi (Portekiz): `store/screenshot-1-hero.png` (gezinin özeti ve planın başı),
  `-2-plan.png` (Konaklama açık: niyet kutuları), `-3-activities.png` (Etkinlik ve turlar: Planında ve Öneriler),
  `-4-days.png` (Yolculuk sırasıyla).
- Yeniden çekmek: `npm run build`, sonra `CHROMIUM_PATH=… node scripts/store-shots.mjs`. Fotoğraf kaynaklarına
  ulaşılabilen bir makinede hero gerçek şehir fotoğraflarıyla çıkar; `--offline` ile fotoğrafsız kapak.

## Gizlilik sekmesi
- **Tek amaç (single purpose):** Kaydettiğin seyahat sayfalarını toplayıp karşılaştırmak ve bir gezi planına
  dönüştürmek. / Collect the travel pages you save, compare them and turn them into a trip plan.
- **İzin gerekçeleri:**
  - activeTab: "Kaydet"e basılan sekmenin sayfasını okumak (yalnız o an, yalnız o sekme).
  - scripting: o sekmede sayfanın metnini ve görünen bölümünü almak için tek seferlik okuyucu çalıştırmak.
  - storage / unlimitedStorage: gezileri, kayıtları, ekran görüntülerini ve belgeleri bilgisayarda saklamak.
  - alarms: paylaşılan gezileri dakikada bir eşitlemek ve bekleyen kayıtları yeniden denemek.
  - notifications: planındaki, henüz almadığın uçuş ya da otelin fiyatı düşünce tek bir bildirimle haber vermek (günde en çok bir kez); başka bir şey için kullanılmaz.
  - contextMenus: sağ tık menüsüne "Trip Radar'a ekle" koymak; tıklanan sayfa ya da bağlantı araç çubuğundaki "Kaydet" gibi kaydedilir.
  - tabGroups: kullanıcının isteğiyle bir ihtiyacın adaylarını rotanın adıyla tek bir sekme grubunda açmak; sayfaları
    okumaz.
  - İsteğe bağlı host izinleri (kurulumda istenmez): seyahat siteleri listesi (Skyscanner, Kiwi, Kayak, Booking.com,
    Airbnb, GetYourGuide, Viator, Omio ve benzeri, 30 kadar) kullanıcı "Seyahat sitelerinde benle gel" dediğinde tek
    seferde istenir; "https://*/*" yalnız kullanıcının araç çubuğundan "Bu sitede de benle gel" dediği tek site için,
    o sitenin kökeniyle istenir. Bu sitelerde sonuçlara "+", bir yerin sayfasına "Desteye ekle" konur, planındaki bir
    uçuşun aramasında üstte şerit; basılmadan hiçbir şey okunup gönderilmez.
  - Host izinleri: generativelanguage.googleapis.com ve api.anthropic.com (AI), *.supabase.co (paylaşım ve AI
    kapısı), nominatim.openstreetmap.org (adres → konum), api.frankfurter.* (döviz kuru).
- **Uzaktan kod:** Hayır. Tüm kod pakette.
- **Veri kullanımı:** Web sitesi içeriği (kaydedilen sayfalar), kişisel bilgi (paylaşımda profil adı ve fotoğrafı).
  Satılmaz, üçüncü taraflara amaç dışı aktarılmaz, kredi değerlendirmesi için kullanılmaz.
- **Gizlilik politikası:** https://github.com/yemredurmuss-hue/trip-radar/blob/release/PRIVACY.md
