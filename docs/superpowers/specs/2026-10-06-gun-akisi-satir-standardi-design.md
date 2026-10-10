# Günlük akış: satır standardı · tasarım

Onaylı görsel (Emre, 2026-10-06, "çok daha iyi"):
[`docs/mockups/2026-10-06-gun-akisi-standart-v2.html`](../../mockups/2026-10-06-gun-akisi-standart-v2.html)
(önceki hâli: `2026-10-06-gun-akisi-standart-v1.html`).

Emre'nin istekleri:
- Sigortanın gün akışında yeri yok.
- Nokta ve çizgi gereksiz.
- Her satırın ne olduğu belli olmalı: "İstanbul > Kopenhag uçuşu", CPH değil.
- Deneyimler kendi adını gösterir.
- "Check-in", "Havaalanı Transfer Taksi"…

## Kural: önce NE, sonra HANGİSİ

Her satırın başlığı iki parça: **NE · HANGİSİ**.
- **NE** sabit sözlükten kalın bir etiket. Kod seçer, yapay zekâ değil; hep aynı kelime.
- **HANGİSİ** yalnız özgül bilgi, normal kalınlıkta.
- Başlığın altında gri bir ayrıntı satırı (13,5 px).

Başlığın tek kaynağı saf bir fonksiyon: `rowTitle(row) → { what, which, detail }`
(`src/lib/dayRowTitle.ts`). Liste de Kartlar da başlığı buradan okur.

## Sözlük (TR / EN)

| NE | HANGİSİ | Gri satır |
| --- | --- | --- |
| Uçuş / Flight | "İstanbul → Kopenhag" (şehir adları, IATA kodu asla) | havalimanı adları ("Sabiha Gökçen → Kastrup") · "varış HH:MM" · uçuş no |
| Aktarma / Layover | "Kopenhag · 3 sa 55 dk" | — |
| Havalimanı transferi / Airport transfer (bir ucu havalimanı) · Transfer | yol: Taksi · Metro · Otobüs · Özel transfer… | nereden → nereye (sade adlar, "havalimanı") · süre · "planlanmadı" |
| Tren / Train · Otobüs / Bus · Vapur / Ferry | "Porto → Lizbon" | istasyonlar · varış · süre · bilet |
| Check-in · Check-out | konaklamanın sade adı | saat kuralı ("15:00'ten itibaren", "11:00'e kadar") · kaç gece |
| Araç teslim alma / Car pick-up · Araç iadesi / Car return | firma (Sixt, Indie Campers…) | yer · kaç gün |
| Tur / Tour · Tekne turu / Boat tour · Müze / Museum · Gösteri / Show · Etkinlik / Event | deneyimin kendi adı | yer · süre · bilet |
| Kahvaltı · Öğle yemeği · Akşam yemeği · Kahve (bilinmiyorsa Yemek) | mekânın adı | semt · puan |
| Fikirler: Manzara · Gezinti · Doğa · Alışveriş · Kültür · Eğlence (`ideaKinds.ts`) | fikrin adı | semt · "fikir" |

- **Aktarma:** aynı gün art arda iki uçuş, ilki ikincinin kalktığı havalimanına iniyorsa aralarına sessiz bir
  satır girer; süre iniş ile kalkış arasından hesaplanır. Sürüklenmez, saati elle verilmez.
- **Transfer:** NE, uçlardan biri havalimanıysa "Havalimanı transferi", değilse "Transfer". Şehirler arası bir
  geçiş biletli bir yolla değilse (taksi, araba) "Transfer · Porto → Lizbon", yol gri satırda.
- **Deneyim:** tür kelimeleri adın içinden okunur (tekne, müze, gösteri/konser/fado, tur/mahzen/tadım);
  hiçbiri değilse "Etkinlik". Tür kelimesi tekrarlanmaz: "Tekne turu · Douro nehri", "Douro nehri tekne turu"
  değil. Kelime adın sonundan (ya da başta bir ayraçla) atılır, kalan en az 2 harf ve bir kelime değilse ad
  olduğu gibi kalır.
- **Yemek:** öğün (öğle/akşam/kahvaltı) seçildiyse o; yoksa saatten (11'den önce kahvaltı, 15'e kadar öğle,
  17:30'a kadar kahve, sonra akşam); yoksa gezginin seçtiği fikir türü; o da yoksa "Yemek".
- **Durum** gri satırın sonunda, yalnız iş kaldıysa: "planlanmadı", "bilet alınmadı", "2 seçenek".
  Alınmış olan ikondaki ✓ ile söylenir.

## Gün akışında olmayanlar

Sigorta, eSIM ve vize (`sectionOfItem === "other"`) gün akışında hiç görünmez: ne Liste'de, ne Kartlar'da,
ne de "Gezi için · sigorta, internet" grubu olarak. Plan → Diğer'de dururlar.

## Ad sadeleştirme

Saf bir yardımcı (`simpleName`), kayıtlı ad hiç değişmez:
- Konaklama ya da mekân adı " – ", " - ", " | ", " · ", ", " ayraçlarının ilkinde kesilir; kesilen baş en az
  3 harfse. Pazarlama kuyrukları ("– Yeni Tasarlanmış…", "with pool") yalnız bu kesimle düşer.

## Havalimanı kodu → şehir

`src/lib/airports.ts` içindeki `cityOfAirport` (tablo CPH, ve uygulamanın gördüğü diğer kodlarla genişler);
gri satırdaki havalimanı adı için `airportName`. Bilinmeyen kod: kayıtta şehir ya da ad varsa o, yoksa kod.

Rotalardaki şehirler hero'nun ana yerleriyle söylenir (`destinations.ts` `mainPlaceOf`, yalnız gösterim):
Funchal ve Gaula Madeira'ya bağlıysa "Porto → Madeira"; gri satırdaki havalimanı adı aynen kalır. Minibüs kendi
kelimesiyle ("Minibüs" / "Minibus"). Saati olmayan satırın saat hücresi boş kalır ("–" yok).

## Yerleşim (Liste)

- Satır: saat · ikon · başlık + gri satır. **Nokta ve kesikli dikey çizgi yok.**
- Sürükleme tutamacı solda, yalnız üstüne gelince ya da odaklanınca görünür.
- Tahmini saat "~" ile, soluk.
- Her türde aynı başlık boyu ve kalınlığı: NE kalın, HANGİSİ normal, gri ayrıntı 13,5 px.

## Kartlar

Kartlar görünümünde Plan kartları yeniden tasarlanmaz; yalnız kartın satır başlığı (`data-title`) ve bilgi
satırları (check-in, metro, araç iadesi) aynı fonksiyondan okunur.
