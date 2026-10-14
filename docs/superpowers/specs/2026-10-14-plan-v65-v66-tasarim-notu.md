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
