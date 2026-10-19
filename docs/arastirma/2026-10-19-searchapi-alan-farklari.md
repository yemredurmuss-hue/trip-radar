# SearchApi.io ile SerpApi arasındaki alan farkları (2026-10-19)

Önceki rapor `2026-10-19-ucretsiz-yedek-ve-abonelik-karari.md` "alanlar dokümanda doğrulandı, denenmedi" demişti.
Bu kez **8 canlı çağrı** yapıldı (7'si fixture, 1'i Bearer anahtarının çalıştığını görmek için; 100'lük ücretsiz
krediden **92 kaldı**). Ham cevaplar kırpılıp `tests/fixtures/searchapi/` altında; aynı sorguların SerpApi cevapları
`tests/fixtures/serp/` altında. Çeviri kodu: `supabase/functions/offers/searchapi.ts`.

**Sonuç:** 8 maddenin 8'i de SearchApi'den geliyor ve `shape.ts` ayrıştırıcıları (hiç değiştirilmeden) aynı alanları
üretiyor. Bire bir aynı olan hiçbir motor yok: her birinde alan adı farkı var, `searchapi.ts` bunları SerpApi şekline
çeviriyor. Aşağıdaki iki fark ise çeviriyle kapanmıyor, ürün davranışını etkiliyor (bkz. "Kapanmayan farklar").

## Parametre farkları

| Konu | SerpApi | SearchApi | Not |
|---|---|---|---|
| Adres / anahtar | `serpapi.com/search.json?api_key=` | `www.searchapi.io/api/v1/search`, `Authorization: Bearer` | Bearer çalıştı (canlı denendi); anahtar URL'ye girmiyor |
| Uçuş tipi | `type=2` (tek yön) | `flight_type=one_way` | `type=1` → `round_trip` |
| Etkinlik | `q`, `hl` vb. | yalnız `q` (`hl` sadece `en`; `page`, `chips` reddediliyor) | Ağustos 2026'da Google sayfası değişmiş |
| Otel türü | karışık (otel + `vacation rental`) | varsayılan `property_type=hotel` (yalnız otel) | Ev için ayrı `property_type=vacation_rental` gerekir; şimdilik istenmiyor |
| Aynı kalanlar | `q`, `check_in_date`, `check_out_date`, `adults`, `currency`, `hl`, `gl`, `departure_id`, `arrival_id`, `outbound_date` | aynı adlar | `gl` ikisinde de varsayılan `us` |

## Cevap alanı farkları (SearchApi → SerpApi şekli)

| Motor | SearchApi'de | SerpApi'de (parser bunu okur) |
|---|---|---|
| Otel | `rating` | `overall_rating` |
| Otel | `price_per_night.extracted_price`, `total_price.extracted_price` | `rate_per_night.extracted_lowest`, `total_rate.extracted_lowest` |
| Otel | `images[].original` | `images[].original_image` |
| Otel | `reviews_breakdown[].total` | `reviews_breakdown[].total_mentioned` |
| Otel | `type: "vacation_rental"` | `type: "vacation rental"` |
| Otel | aynı: `name`, `reviews`, `gps_coordinates`, `nearby_places[].transportations[]` (`Walking`/`Taxi`/`Public Transport`, `"8 dk."`) | aynı |
| Uçuş | havalimanında `date` ve `time` ayrı (`"2026-11-12"` + `"19:20"`) | tek alan `"2026-11-12 19:20"` |
| Uçuş içgörüsü | `typical_price_range: {low_price, high_price}` | `[düşük, yüksek]` |
| Uçuş içgörüsü | `price_history: [{price, iso_date}]` | `[[zaman, fiyat], ...]` |
| Uçuş | aynı: `best_flights`/`other_flights`, `flights[]`, `flight_number`, `total_duration`, `price` (**tüm yolcular için**, adults=2'de 441 / 221) | aynı |
| Etkinlik | liste `events` | `events_results` |
| Etkinlik | `date: "Fri, Oct 23"`, `start_time: "Oct 23, 7:30 PM"` | `date.start_date: "Oct 23"`, `date.when` |
| Etkinlik | `venue` ve `address` düz yazı; `link` bilet satıcısının sayfası, `seller` adı | `venue.name`, `address[]`, `ticket_info[]` |
| Airbnb | liste `properties`; `title` = ilan adı, `description` = "Apartment in Santa Maria Maior" | `organic_results`; `name` = ilan adı, `title` = "... in ..." |
| Airbnb | `price.extracted_total_price` (konaklamanın toplamı), `id`, `images[]` (düz URL) | `extracted_price`, `listing_id`, `thumbnail` |
| Gezilecek yer | `things_to_do[]` (`reviews` sayı olarak: 99000) | `top_sights.sights[]` |

## Kapanmayan farklar (ürünü etkiler)

1. **Gezilecek yerlerin ilk dördünün fotoğrafı gelmiyor.** `things_to_do`'nun ilk 4 küçük resmi `data:image/jpeg;base64,…`
   (cevaba gömülü), https değil. Ayrıştırıcı yalnız https fotoğraf aldığı için Porto'da "Luís I Bridge", "Porto Cathedral",
   "Palácio da Bolsa", "Bolhão Market" fotoğrafsız (`photo: null`) çıkıyor; 5-20. sıralar https geliyor. Base64'ü
   önbelleğe/karta koymak şişirir, bu yüzden koymadım. Kart bu durumda fotoğrafsız yer alıyor; istenirse Wikipedia
   yedeği (hero fotoğraf hattı) bağlanabilir, ayrı iş.
2. **İki yetişkinli uçuş cevabında `price_history` yok** (1 yetişkinde 61 gün geliyor; 2'de yalnız aralık ve seviye).
   Fiyat içgörüsü zaten `adults=1` ile soruluyor (`priceInsight`), yani canlıda etkilenmez; uyarı olarak not düşüldü.
3. **Fiyatın vergi durumu iki sağlayıcıda aynı olmayabilir.** SearchApi'de otelin `price` alanı vergili, ayrıca
   `price_before_taxes` var (Porto Palácio: 86 € vergili, 76 € vergisiz; dokümanda Ekim 2026'da "tek fiyat varsa vergili
   `price`'ta" diye kırılma notu var). SerpApi'nin `extracted_lowest` değerinin vergili mi vergisiz mi olduğunu aynı
   gün, aynı tarihte yan yana karşılaştırmadım (fixture tarihleri farklı): **doğrulanamadı**. Airbnb'de dokümana göre
   `airbnb.com` alanında vergi ödeme anında eklenir (`include_taxes` parametresi var), kodda kullanılmıyor.

## Denenmeyenler

- Kullanım şartları (önbellek, ticari kullanım): okunmadı, Emre "sonra" dedi. `searchapi.ts` başında `TODO(terms)` var.
  Önbellek anahtarı sağlayıcıdan bağımsız olduğu için SearchApi cevabı da 24 saat (gezilecek yer 30 gün) saklanıyor.
- Kota bitince / hata olunca SearchApi'nin hata gövdesi: üretilmedi. Kod `!res.ok` veya `error` alanı varsa `null` döner
  (SerpApi hattıyla aynı).
- Sayfalama, `property_type=vacation_rental`, çok şehirli uçuş.

## Canlıya alınca (yayın günü, Emre ile)

- Supabase secret: `SEARCHAPI_KEY` (şimdilik **eklenmedi**; fonksiyon deploy edilmedi).
- Tavan: `OFFERS_CAP_SEARCHAPI` (varsayılan günde 2). Abonelikte yalnız bunu ve anahtarı değiştirmek yeter.
- SearchApi'yi ilk sağlayıcı yapmak isterseniz `SERPAPI_KEY` secret'ını silin: `serp()` doğrudan SearchApi'ye gider.
  O durumda SerpApi'nin tür başına payları (`serp_otel` 5, `serp_fiyat` 1, `serp_yer` 1, `serp_etkinlik` 1) işlemez;
  hepsi tek `searchapi` tavanına bağlı olur, tavanı buna göre seçin.
