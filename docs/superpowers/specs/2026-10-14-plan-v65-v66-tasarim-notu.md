# Plan v65 ve v66: niyet kartı yerleşimi (tasarım, kod yok)

Kaydedilen karar (Emre, 14 Ekim): v65 onaylandı ("çok daha iyi oldu"). v66 aynı tasarımın sadeleşmiş hali.

## v65 (onaylı yerleşim) · docs/mockups/plan-v65-canli-kartlar
- Kartlar canlıdaki (0.37.1) gerçek kartlar: PlanCard, FlightTicket, ev-card, it-tile, ek-card. Yeni çizilen kart yok.
- Her gerekçe (need) için bir grup: solda niyet kartı (bagaj etiketi, beyaz plaka tür adı, dev ad, ikonlu bilgi, mühür), sağda canlı kart. İkisi aynı satırda ve aynı yükseklikte.
- Seçenekler grubun altında, tam genişlikte açılır panel.
- Etkinlik ve Yapılacak: seçilenlerin hepsi yanda, niyet kartı ortada; öneriler altta ayrı açılır panel.
- Sayfa genişliği canlı panelin genişliği (900 px); niyet kartı 280 px.
- Uzun ad: önce en çok %20 küçülür, sonra satıra sarar, sonra "…".

## v66 (sade hali) · docs/mockups/plan-v66-sade
- Gereksiz bilgi gizli: kaynak avatarı, ⓘ, belge klipsi, resim üstündeki şehir/tarih (niyet kartı zaten söylüyor), bütçe çubuğu, × düğmesi.
- Boş durum artık niyet kartına benzemez: "Henüz seçilmedi" etiketi, ne aranacağı, markalar okunur düğmelerle (Booking.com, Airbnb, Skyscanner, Viator ...), "AI'dan öner" ana düğmesi ve link bırakma satırı.
- Her durumun kendi düğmesi canlı karttan gelir: Önerimiz "Bunu seç", Seçildi "Rezerve et / Aldım", Rezerve "Ayrıntı".

## Kodlamadan önce açık sorular
1. Haritalar fotoğrafları için Google Places API (anahtar ve maliyet).
2. Kategori başına bütçe.
3. Konaklama, Yapılacak, Belgeler yeşillerinin ayrıştırılması.

## Kararlar (Emre, 14 Ekim, akşam)
1. Haritalar fotoğrafları için Google Places API: evet (anahtar ve maliyet kodlama sırasında netleşecek).
2. Kategori başına bütçe canlıda var ve kalacak (başlıkta harcanan, ayrılan, ilerleme çubuğu).
3. Benzer yeşiller ayrışacak: Konaklama turkuaz, Yapılacak zeytin yeşili, Belgeler/Sigorta/eSIM mavi.

## Canlı ile yeni tasarım arasındaki fark (v67 canlı sayfa üstüne kuruldu)
Yeni: her ihtiyaç için niyet kartı (solda, bagaj etiketi), canlı kart yanında aynı yükseklikte; boş durum yönlendirme paneli (okunur marka düğmeleri, AI'dan öner, link bırak, Gerek yok); Etkinlik ve Yapılacak'ta seçilenlerin hepsi niyet kartının yanında.

## Kodlarsak kaybedeceğimiz şeyler (v66'da gizlenmişti, v67'de geri geldi, kodda korunmalı)
- Kategori başlığındaki bütçe (harcanan, ayrılan), ilerleme çubuğu ve sayaç.
- ⓘ ayrıntı balonu, havalimanı kodu kopyalama, belge ekle (klips), × gerek yok / kaldır, kart menüsü, "İptal ettim", "Bu geceler için yer gerekmiyor".
- Kimin eklediği (S, E, AI avatarları).
- Kartın içindeki düzenlenebilir alanlar (şehir, tarih, ad, fiyat). Niyet kartındaki şehir, tarih, kişi alanları da aynı şekilde düzenlenebilir olmalı; yoksa bu özellik kaybolur.
- Boşluk tespiti: "Konaklama 1–2 Nisan, henüz otel yok" gibi günlere göre boş blokları ve aralarına "+ Buraya ekle".
- Kategori sonundaki "+ Ekle".
- Etkinlik: "Öneriler ve fikirler" çubuğu, "Daha fazla fikir", "Beğenmediğini ↻ ile değiştir", kart başına ↻ ve "Aldım", şehir bazlı boş satır ve "Kendin ara".
- Yapılacak: Hepsi / Gezilecek yerler / Restoranlar süzgeçleri, "Daha fazla öner", gösterge, açıklama notu, "Haritada aç" bağlantısı.
- Belgeler: "Vize gerekmiyor · Türk pasaportuyla 90 güne kadar" satırı, "Sigortaları karşılaştır" bağlantısı.
- Ulaşım: taksi/transfer kartı (v65 ve v66'da düşmüştü).
- Kaydırarak seçenek gezme şeridi (pk-strip) ve kart çevirme arkası; "Değiştir n" diyalogu.
- Uçuşa kalan gün uyarısı, rötar, kapı, rezervasyon kodu gibi uçuş günü şeritleri.
- Üst sayfa: hero, bütçe kartı, tercihler, planlama çubuğu, yol şeridi, gün gün ve pano görünümleri (v67'de aynen duruyor).
Bilinen veri farkı: canlıdaki örnek gezide kart yüzleri ile aria etiketleri bazı yerde çelişiyor (Hakone → Osaka / Kyoto → Osaka). Niyet kartı kart yüzünü izledi.
