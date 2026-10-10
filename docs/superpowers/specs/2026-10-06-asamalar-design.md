# Aşamalar: bir ihtiyacın Aranacak'tan Hazır'a yolu (2026-10-06)

Emre onayladı ("Onaylıyorum"): isimler, hero yazısı ve "İptal edildi" aşaması.

## Sorun

Bir kaydın aşaması bugün en az beş yerde ayrı hesaplanıyor (cardView, legs.ts, items.statusOf,
categories.planStages, booking.ts). Sonuç: aynı ekranda farklı sayılar ("3 karar" / "7 karar" / liste 7
ama başka 7). Silme her aşamada aynı; bileti alınmış, belgeli bir kayıt da tek tıkla gidiyor.

## Aşamalar (rezervasyon gerektiren ihtiyaçlar: konaklama, uçuş, tren/otobüs/feribot, araç, transfer,
## biletli etkinlik, eSIM, sigorta)

| Aşama | Ne demek | Yapılabilenler | Silme |
|---|---|---|---|
| **Aranacak** | İhtiyaç var, hiçbir şey yok (boş kart, yer tutucu) | Ara: düğmeleri, link yapıştır, (bağlanınca) AI önerileri, Gerek yok | Hemen; Geri al |
| **Seçenekler (N)** | Kaydedilmiş seçenekler, karar yok | Karşılaştır, **Seç**, daha fazla ara | Hemen; Geri al |
| **Planlandı** | Karar verildi, rezerve edilmedi | **Rezerve ettim / Bileti aldım**, **Değiştir** (seçeneklere dön + ara), iptal/fiyat uyarıları | Hemen; Geri al |
| **Rezerve edildi** | Alındı, belgesi yok | Belge ekle ("Belge eksik"), **İptal ettim**, Değiştir (önce "eskisini iptal ettin mi?") | **Sorar**: "Bu rezervasyon onaylı. İptal ettiysen 'İptal ettim' de." |
| **Hazır** | Alındı + belgesi var | Belgeyi aç; sabit | **Sorar**: belgesiyle çöpe gider (geri alınabilir) |
| **İptal edildi** (yan) | Rezerve edilmişti, iptal edildi | Soluk, geçmişte kalır; iade notu; ihtiyaç yeniden **Aranacak** | Hemen; Geri al |
| **Gerek yok** (yan) | İhtiyaç kapatıldı | Gizlenenler'den geri getir | — |
| **Kullanıldı** (yan) | Tarihi geçti | Sayaçtan çıkar | — |

Kurallar:
- **Kısmi**: bir ihtiyaç birden çok parçadan oluşuyorsa (konaklamada gece blokları, kişiye özel biletler)
  ihtiyacın aşaması en geride olan parçanınkidir; kart parçaları ayrı gösterir.
- **Belge doğrudan gelirse**: planlanan kayda eşleşirse doğrudan Hazır; eşleşmezse yeni kayıt Hazır.
  Aşama atlamak serbest.
- **Uyarılar aşama değildir**: ücretsiz iptal bitiyor/bitti, fiyat eskidi, rötar/kapı değişti; kartın
  üstünde rozet.
- **Rezervasyon gerektirmeyenler** (yürüyüş, pazar, manzara, restoran): Fikir → Plana alındı (tarihli) →
  Yapıldı. Hiçbir yüzdeye girmez.
- **Paylaşılan gezi**: her aşama değişikliği Geçmiş'e "kim, ne zaman"; Rezerve edildi / Hazır silinirken
  uyarıda diğer kişinin de etkileneceği söylenir (mevcut paylaşım uyarısı).

## Veri

- `ItemStatus` bugün: `saved | chosen | booked | dismissed`. Eklenir: `cancelled` (booked → İptal edildi,
  `cancelledAt`, isteğe bağlı `refundNote`). Eski sürümler bilinmeyen durumu `saved` gibi okumamalı:
  paylaşımda/okumada güvenli varsayılan kontrol edilir.
- "Hazır" ayrı durum değil: `booked` + bağlı belge (docsFor(item).length > 0) → Hazır.
- "Aranacak": yer tutucu ya da boş kart (emptyCards.isEmptyRecord) ya da hiç kaydı olmayan ihtiyaç.

## Tek kaynak: `src/lib/lifecycle.ts` (saf)

- `stageOf(item | need, ctx) → "search" | "options" | "planned" | "booked" | "ready" | "cancelled" | "notNeeded" | "used"`
- `needStage(parts)` → kısmi kural (en geride olan).
- `actionsFor(stage) → ["search","pick","book","change","cancel","addDoc",…]`
- `deleteLevel(stage) → "undo" | "confirm"` + uyarı metni (TR/EN).
- `stageLabel(stage, kind)` → "Aranacak", "Seçenekler (3)", "Planlandı · bilet alınmadı" / "rezerve edilmedi",
  "Rezerve edildi", "Hazır", "İptal edildi".
- Kartlar, hero, Plan bölümleri, yapılacaklar listesi, günlük akış, sohbet bağlamı **yalnız buradan** okur.

## Hero

- **% = (Rezerve edildi + Hazır) ÷ (Planlandı + Rezerve edildi + Hazır)** — yalnız plana alınanlar.
- Yazı: **"Planlananların %X'i rezerve · N ihtiyaç karar bekliyor"**. N = Aranacak + Seçenekler
  ihtiyaçları (yüzdeye girmez; 0 ise gizli). Planlanan yoksa yüzde gösterilmez: "N ihtiyaç karar bekliyor".
- Çubuk iki tonlu kalır: koyu = rezerve/hazır, açık = planlandı (yalnız plana alınanların içinde).
- Liste grupları aynı sayılar: "Karar bekliyor (N)" = Aranacak + Seçenekler; "Rezerve edilecek" =
  Planlandı; "Belge eksik" = Rezerve edildi; ayrıca "Ulaşım · nasıl gidilecek" (yüzdeye girmez).

## Sahiplik

- **Bu oturum**: `lifecycle.ts`, hero, yapılacaklar listesi, sohbet (asistan bağlamı + "iptal ettim"
  aracı), `cancelled` durumu ve veri.
- **Diğer oturum**: kart yüzleri ve ••• menü (aşama etiketi, Değiştir, İptal ettim, silme onayı),
  günlük akış, plan.ts kapanış kuralları — hepsi `lifecycle.ts`'ten okuyarak.

## Test

- `lifecycle` birim testleri: her aşama, kısmi kural (gece blokları, kişiye özel), belgeyle doğrudan Hazır,
  iptal → ihtiyaç yeniden Aranacak, silme seviyeleri, etiketler TR/EN.
- Tutarlılık testi: aynı gezide hero sayıları = liste grup sayıları = Plan bölümlerinin toplamı.
- e2e: rezerve edilmiş kartı silmeye çalışınca onay; "İptal ettim" → soluk kayıt + ihtiyaç Aranacak.
