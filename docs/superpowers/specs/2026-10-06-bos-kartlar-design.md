# Boş kartlar · tasarım

Onaylı görsel (Emre, 2026-10-06, iki küçük düzeltmeyle):
[`docs/mockups/2026-10-06-bos-kartlar-v1.html`](../../mockups/2026-10-06-bos-kartlar-v1.html)
(arka plan, öneri kartları: `2026-10-06-arama-ve-oneriler-v2.html`).

## Kural: boş kart = onaylı kartın sade hâli

Bir ihtiyacın henüz ne rezervasyonu ne seçeneği varsa kart, bugünkü onaylı kartın **sade hâlidir**. Yeni kart
icat edilmez. Seçenek ya da bilet gelince kart kendiliğinden bugünkü büyük karta döner (o kart değişmez).

**Aynı kalanlar**
- Üst satır: durum çemberi, tür ikonu ve rengi, tarih, •••.
- Ulaşım kartları: şehir — siluet — şehir düzeni (siluetler `src/app/cards/Silhouettes.tsx`'teki gerçekleri).
- Konaklama, etkinlik, eSIM: siluet karosu + ad.
- Bölümün zaman çizelgesi ve + noktaları.

**Sadeleşenler**
- Kesikli çerçeve, beyaz zemin (sarı-bej yok).
- Şehir adları bir boy küçük (20 → 17 px).
- Siluet yaklaşık %35 soluk ve küçük.
- Fiyat yok, "Bileti aldım" yok (kayıtlı bir boş uçuşta "Bileti aldım" ••• menüsünde kalır, iş kaybolmaz).
- Durum tek gri kelime: "Bilet yok", "Yer yok", "Alınmadı", "Nasıl gideceğin belli değil", "Henüz yok".
- Alt satırın sağı: sessiz markalı arama bağlantıları; **"Ara:"** küçük gri etiketiyle başlar
  (düzeltme 1): `Ara: [G] Google Flights [S] Skyscanner [K] Kayak`. Ayrı "Ara" düğmesi yok.
- "Gerek yok" konaklama (boş geceler), transfer ve eSIM'de.

## Hangi boşluklar boş karta döner

| Bugün | Boş kart | Durum | Arama |
| --- | --- | --- | --- |
| Başlangıç sohbetinin açtığı uçuş yeri (`startGuide.placeholders`), sohbette söylenip uçuşu seçilmemiş uçuş | Uçuş | Bilet yok · N kişi | Google Flights · Skyscanner · Kayak |
| "Henüz eklenmedi · Uçuş ara" (gidiş/dönüş uçuşu hiç yok) | Uçuş | Bilet yok · N kişi | aynı |
| Başlangıç sohbetinin açtığı konaklama yeri | Konaklama | Yer yok | Booking · Airbnb |
| "Planlanmadı · bu geceler için kayıtlı yer yok · Booking'de ara" ve ayrı konaklama (otel seçilmedi) | Konaklama | Yer yok | Booking · Airbnb |
| Planlanmamış transfer / şehir değişimi (LegCard "Planlanmadı") | Havalimanı transferi, Transfer, Şehir değişimi | Nasıl gideceğin belli değil | Uber · Yol tarifi (Google Haritalar) |
| Kural önerisi "eSIM (ülke)" | eSIM | Alınmadı | Airalo · Holafly |
| Etkinliği olmayan her şehir | Etkinlik · "X'te tur ve bilet" | Henüz yok | GetYourGuide · Viator · Klook |

Kart yalnız **Plan** sekmesinde sadeleşir; Günlük akış (LegRow, gün kartları) bu işin dışında.
Belgesi olan bir kayıt (bilet PDF'i) boş sayılmaz. Aynı ihtiyaçta başka bir seçenek varsa bugünkü kart çizilir.
Etkinlik ve eSIM boş kartları bölümün "3/4" sayısına girmez (öneriler gibi), kahramanın sayıları değişmez.

## Arama bağlantıları (`src/lib/searchLinks.ts`, saf)

Yalnız belgelenmiş ya da yıllardır değişmeyen herkese açık adres biçimleri; her değer kodlanır; yer, tarih ve
kişi sayısından başka hiçbir kişisel bilgi girmez. Kişi sayısı gezinin etkin yolcu sayısından gelir
(`trip.travellers` / `whoGoes`).

- **Uçuş:** Google Flights `travel/flights?q=Flights from X to Y on YYYY-MM-DD one way`; Skyscanner
  `transport/flights/{ist}/{ams}/{yymmdd}/?adultsv2=N&rtn=0`; Kayak `flights/IST-AMS/YYYY-MM-DD/Nadults`.
  Skyscanner ve Kayak yalnız iki uçun da IATA kodu biliniyorsa (kod ya da bilinen şehir) ve tarih varsa.
- **Konaklama:** Booking `searchresults.html?ss&checkin&checkout&group_adults&no_rooms=1`; Airbnb
  `s/{yer}/homes?checkin&checkout&adults`.
- **Transfer:** Uber `m.uber.com/ul/?action=setPickup&pickup[formatted_address]&dropoff[formatted_address]`;
  Bolt'un herkese açık bir web derin bağlantısı yok, yerine Google Haritalar `maps/dir/?api=1&origin&destination`
  "Yol tarifi" adıyla.
- **Etkinlik:** GetYourGuide `s/?q=`, Viator `searchResults/all?text=`, Klook `search/result/?query=`.
- **eSIM:** Airalo `{ülke}-esim`, Holafly `esim.holafly.com/esim-{ülke}/`.

## Marka işaretleri

Markanın rengi üstünde tek harf (mockup'taki gibi), eklentinin içinde CSS ile çizilir. Sitelerden favicon
çekilmez, markaya hiçbir istek gitmez. Ticari logo kopyalanmaz. Bağlantılar yeni sekmede,
`rel="noopener noreferrer"`.

## Yapay zekâ önerileri (düzeltme 2)

Yalnız bir yapay zekâ veri kaynağı bağlıyken, kartın altında ince bir satır: **"✨ Senin için N öneri ▾"**.
- Kapalı başlar; açık/kapalı her bölüm için hatırlanır (`localStorage`, try/catch içinde).
- Açılınca seçenek kartlarıyla aynı düzen: fotoğraf, ad, puan, fiyat, gece. Mor zemin, "Öneri" etiketi, mor
  "neden" satırı, "Seçeneklere ekle" ve × ("bunun gibileri gösterme").
- Yeni bir sayı yalnız sayıyı günceller, satırı kendiliğinden açmaz.
- Arayüz `SuggestionSource` (`src/lib/offerSource.ts`): `{ available(): boolean; offers(need): Promise<Offer[]> }`.
  Bugün kaynak bağlı değil (`available()` false), satır hiç çizilmez.
- Model uydurması öneri yok: öneri yalnız gerçek bir veri kaynağından gelir.
- Mevcut `suggestions.ts` (kural/AI öneri kartları) ile birleştirilmez: onlar "plana ne eksik" der ve kendi
  başına kart olur; bunlar bir ihtiyacın altında fiyatlı, fotoğraflı seçeneklerdir. Tek ortak nokta kural
  eSIM önerisidir: o artık eSIM boş kartı olarak çizilir ("Gerek yok" aynı öneriyi kalıcı kapatır).
