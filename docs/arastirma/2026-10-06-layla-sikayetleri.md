# Layla.ai şikâyet araştırması ve Trip Radar'ın farkı (2026-10-06)

## Örneklem (dürüst sınır)

- **İncelenen yorum:** yaklaşık 130 benzersiz yorum ve gönderi. Bunlar:
  - iOS: 44 yazılı yorum, 18 ülke, 2026-04 ile 2026-09 arası.
  - Google Play: 39 yorum.
  - Trustpilot: 1-3 yıldızlı yorumların tamamı (14) ve yaklaşık 20 olumlu yorum.
  - Reddit: yaklaşık 12 gerçek, birinci elden deneyim (taranan ~200 gönderinin içinden).
  - Blog testleri: 7 elden test.
- **Olumsuz yorum sayısı küçük:** olumsuz ya da karışık olanlar ~50. Aşağıdaki frekanslar kaba tahmindir.
- **Puanlar yüksek, ama şişik olabilir:** iOS 4.5-4.8, Play 4.7, Trustpilot 4.2.
  - Uygulama açılışta puan istiyor.
  - 5 yıldızlar belli günlerde kümeleniyor.
  - Reddit'te bot benzeri övgüler var.
  - Yine de Layla geniş çapta "çöken" bir ürün değil.
- **Kirlilik uyarısı:**
  - r/layla_ai ve App Store id 6456886656 başka bir ürün: offline LLM sohbet uygulaması.
  - Eleştiri yazan blogların bir kısmı rakip (Stardrift, MonkeyTravel, iMean).
- **Kapsanmayan:** YouTube yorumları ve X.

## Bağlam

- **Kurucular:** Berlin, 2023. Saad Saeed (Flink) ve Jeremy Jauncey (Beautiful Destinations).
- **2024-02:** Roam Around'u aldı.
- **2026-07-31:** Expedia Group Layla'yı satın aldı ([Skift](https://skift.com/2026/07/31/expedia-acquired-ai-trip-planner-layla-exclusive/)).
- **Gelir:** rezervasyon komisyonu (Skyscanner, Booking, GetYourGuide, BudgetAir) ve Premium abonelik.
- **Premium fiyatı:** $9.99/ay ya da $49.99/yıl.
- **Deneme:** 3 günlük deneme kart ister ve yıllık plana döner.

## Şikâyet haritası (sıklık sırasıyla)

| # | Tema | Sıklık | Somut ayrıntı |
|---|---|---|---|
| 1 | **Söyleneni unutuyor / uygulamıyor** | ~14/39 en sık | Rezerve edilmiş otel yerine başka otel koyuyor. Bütçeyi yok sayıyor ("milyoner sanıyor"). 21 gün isteğini 30+ güne çeviriyor. Düzeltmeyi uygulamıyor. Takvim tarihi yerine "1. gün" yazıyor. Uzun sohbette kısıtlar kayıyor. |
| 2 | **Deneme / fatura / iade tuzağı** | Trustpilot olumsuzlarının ~9/13'ü; duygusal olarak en ağır tema | Kartlı 3 günlük deneme 72. saatte yıllık $49.99'a dönüyor. İptal onay maili gelmiyor. Önce %50 "iyi niyet" iadesi öneriliyor, tam iade ancak chargeback ya da halka açık yorumdan sonra. Yıllık iptalde erişim anında kesiliyor. |
| 3 | **Uydurma / yanlış bilgi** | ~13/39 | Kalıcı kapanmış yerler. Başka kıtada otel. Faro isteğine Lizbon. 100 mil uzakta otel. Maliyet toplamında aritmetik hata. Olmayan olanak. 00:05 inişin olduğu ilk geceye "akşam yürüyüşü". |
| 4 | **Uçağa itiyor, ulaşım modunu yok sayıyor** | ~6 | Danimarka-İtalya tren isteğine uçak. Araba gezisine havalimanı. Bölgesel havalimanı yerine 2 saat uzaktaki havalimanı. Bolzano yerine Venedik. Gidişi arabayla, dönüşü trenle kuruyor. |
| 5 | **Değer görmeden paywall** | ~8 | 30 dakikalık sohbetten sonra planı görmek için ödeme isteniyor. PDF dışa aktarma Premium'da. Kayıt zorunlu. (2026 ortasında tam plan ücretsize çekilmiş olabilir; doğrulanmadı.) |
| 6 | **Çökme / donma, her şey kayboluyor** | ~8 | Çökünce sohbet ve plan gidiyor. Saatlerce dönen çember. Ödeme sonrası sonsuz yükleme. Denemenin 2. gününde 403 hatası. |
| 7 | **Bedava ChatGPT, Gemini, Perplexity'den farkı yok** | ~9 | 90 dakikada kullanılabilir plan çıkmamış; aynı iş Google Maps'te 15 dakika. "Gizli yerler" listesi diğer iki araçla aynı. |
| 8 | **Yalnız sohbet: elle düzenleme ve rezervasyon içe aktarma yok** | ~5 | "Gezinin genel görünümü yok, ayar yok." Her düzeltme yeni bir prompt ve başka bir şeyi bozuyor. |
| 9 | **Fiyat ve upsell** | ~3 | Yanlış otel fiyatı. Havalimanı transferi €170 (piyasa ~€50). "Asıl derdi rezervasyondan para." |
| 10 | **Grup ve ortak çalışma yok** | ~3 | Bunu son kullanıcılar değil, çoğunlukla rakip bloglar söylüyor. |

**Övülenler (bu alanlarda rekabet etme):**
- Hız.
- Hiç fikir yokken ilham ve destinasyon videoları.
- Arkadaki insan seyahat acenteleri (Carla, Alex, Fernando). Trustpilot 5 yıldızlarının çoğunu bunlar taşıyor.
- Canlı fiyat ve tek yerden rezervasyon.
- Güzel arayüz.

## Yapılması gereken iş (JTBD) teşhisi

1. "Kısıtlarımı güvenebileceğim bir plana çevir; her satırı yeniden kontrol etmeyeyim." Layla kısıtları sohbet metni olarak tutuyor ve uzun sohbette kaybediyor.
2. "Plan elimde yaşayan bir nesne olsun." İçe aktarma, elle düzenleme, paylaşma ve dışa aktarma isteniyor; Layla'da plan yalnız sohbetin içinde.
3. "Ödemeden önce değeri göreyim, tuzağa düşmeyeyim."
4. "Benim yerime güvenle rezerve et." Layla burada kazanıyor. Expedia'nın satın aldığı da bu: ürün rezervasyon hunisine kayacak.

## Trip Radar karşılaştırması

| Layla şikâyeti | Trip Radar'da bugün | Durum |
|---|---|---|
| Kısıtları unutuyor | Kısıtlar sohbet hafızasında değil, durumda tutuluyor: `set_requirements`, `budget_ceiling`, `save_preference`, "Seni böyle anladım" penceresi. Gezi ataması kodla yapılıyor. | ✅ Güçlü (mimari fark) |
| Rezerve edilmiş oteli eziyor | Onay ekran görüntüsü kartı rezerve işaretliyor ve plan ona göre kuruluyor. `userEdits` sohbetle ezilmiyor. | ✅ |
| Uydurma bilgi / yanlış fiyat | `evidence.ts`: fiyat, puan ve iptal koşulu için sayfadan birebir alıntı şart, yoksa "doğrulanmadı". Eski fiyata uyarı. `claims.ts` yalan "güncelledim" cümlesini yakalıyor. | ✅ Güçlü |
| Gece inişine akşam programı | Akıllı saat motoru ve AeroDataBox iniş saati. | ✅ |
| Çökünce her şey kayboluyor | Yerel IndexedDB, 30 günlük çöp kutusu, Geri al, Gizlenenler, ayar geçmişi. | ✅ |
| Paywall / fatura tuzağı | Ücretsiz, hesap yok. | ✅ (para kazanmaya başlayınca risk) |
| Yalnız sohbet, elle düzenleme yok | Kartta düzenleme, sürükleme, + Ekle şablonları. | ✅ |
| Grup yok | Paylaşım kodu, 👍/👎, profil. | ✅ (kullanıcılar bunu az istiyor) |
| Uçağa itiyor | Komisyon yok, 10 ulaşım türü. Ama gezi düzeyinde "uçaksız / yalnız tren" gibi bir kısıt yok; şartlar seçenek düzeyinde (ör. `direct_flight`). | ⚠️ Açık |
| Mobil uygulama | Yalnız masaüstü Chrome, Geliştirici modu kurulumu. | ❌ En büyük zayıflık |
| Sıfırdan ilham | Yok; İlham yalnız kaydedilen içerik. | ❌ Bilinçli olarak dışarıda |
| Rezervasyon / insan acente | Yok; yalnız arama linkleri. | ❌ Bilinçli olarak dışarıda |
| Kurulum sürtünmesi | Kullanıcı kendi Gemini anahtarını getiriyor ya da AI kapısı kullanılıyor; mağazada değil. | ❌ |

## Konumlandırma

Layla bir **üretici** (planı uydurur, rezervasyona iter). Trip Radar bir **karar ve takip aracı** (senin bulduklarını kanıtla karşılaştırır, söylediğini unutmaz, rezerve ettiğine dokunmaz). "Daha iyi Layla" olarak konumlanmak yanlış olur: Layla'nın güçlü olduğu (ilham, hız, mobil, rezervasyon) her alanda geride kalırız.

Önerilen cümle: **"Layla sana bir plan uydurur. Trip Radar senin bulduklarını, söylediklerini unutmadan bir plana çevirir."**

## Öneriler (10 üzerinden)

1. **"Layla testleri" altın seti: 9/10.**
   - Şikâyetleri e2e / altın set senaryosuna çevir:
     - Faro, Lizbon değil.
     - Danimarka-İtalya trenle.
     - 00:05 iniş.
     - Rezerve otel korunuyor.
     - 21 gün 21 gün kalıyor.
     - Bütçe tavanı.
     - Arkadaş yalnız bir gün geliyor.
     - Kapalı mekân.
   - Hem regresyon koruması sağlar, hem pazarlamada kanıt olur.
2. **Gezi düzeyinde ulaşım kısıtı: 8/10.**
   - "Uçaksız", "yalnız tren", "arabayla" ve kalkış havalimanı tercihi `set_requirements` benzeri bir gezi alanı olsun.
   - Öneri ve transfer üretimi buna uysun.
3. **Kısıt bekçisi: 8/10.**
   - Her sohbet değişikliğinden sonra kod tarihleri, gün sayısını, rezerve kayıtları ve bütçe tavanını kontrol etsin.
   - İhlal varsa değişikliği uygulamasın ve söylesin.
   - "Seni böyle anladım" bunun görünür yüzü.
4. **Telefon için salt okunur gezi sayfası: 8/10.**
   - Layla kullanıcıları telefonda; Trip Radar orada yok.
   - Etsy araştırmasındaki 9/10'luk öneriyle aynı iş.
5. **Mağaza / kurulum sürtünmesini kaldırmak: 7/10.**
   - Yalnız arkadaşlar dışına açılınca anlamlı.
6. **Para kazanınca adil fiyat sözü: 6/10 (şimdilik erken).**
   - Kartsız deneme, aylık ödeme, tek tıkla iptal, planın hiçbir zaman kilitlenmemesi.
7. **İlham videoları, insan acente, rezervasyon: 2/10.** Layla'nın ve Expedia'nın sahası; girme.

## Uyarı: "Layla tarzı" sohbetle başlatma

0.36.12'de eklenen sohbetle başlatma Layla'nın arayüzünü alıyor. Spec'e göre gezi seçilmiş seçeneklerle değil, **boş yuvalarla** kuruluyor; doğru olan da bu. Öneri sistemi ve gelecekteki "AI öneri satırı" (Places/Booking kaynağı kararı) Layla'nın 3 numaralı hatasını (uydurma ve kapalı mekân) geri getirebilir. Öneriye sokulan her mekân bir kaynakla doğrulanmalı.

## Kaynaklar

- [Trustpilot](https://www.trustpilot.com/review/layla.ai)
- [iOS id6758730467](https://apps.apple.com/us/app/layla-ai-trip-planner/id6758730467)
- [Google Play](https://play.google.com/store/apps/details?id=ai.layla.android.app)
- [Skift / Expedia satın alması](https://skift.com/2026/07/31/expedia-acquired-ai-trip-planner-layla-exclusive/)
- [TechCrunch / Roam Around](https://techcrunch.com/2024/02/12/travel-startup-layla-acquires-flyr-backed-ai-itinerary-building-bot)
- [aitravel.tools](https://aitravel.tools/layla-ai-review/)
- [Practical Globetrotters](https://practicalglobetrotters.substack.com/p/we-tested-4-ai-travel-services-to)
- [Endless Travel Plans](https://www.endlesstravelplans.com/guides/planning-tools/layla-ai-review)
- Rakip bloglar: [Stardrift](https://stardrift.ai/resources/layla-ai), [MonkeyTravel](https://monkeytravel.app/blog/layla-ai-review-2026), [iMean](https://www.imean.ai/blog/articles/my-impossible-multi-city-trip-test-how-layla-mindtrip-and-imean-ai-actually-performed/)
- Reddit: r/travelbloggers 1p63631, r/travelwithAI 1l8hbs7, r/traveladvice 1tviizl, r/AI_travel_tips 1pvatxa (pullpush API üzerinden)
