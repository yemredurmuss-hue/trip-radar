# 0.33: anında ekleme, kartın üstünde düzenleme, gece bloklarını silme · tasarım

Kaynak: Emre, 2026-10-05 (0.31 canlıdayken ekran görüntüsüyle): "Bu stay'in altında başka bir konaklama var,
chatten eklemiştim, silemiyorum." · "+ butonuna basınca soru sormadan şablon hemen eklensin; istersem üzerine
basıp düzenlerim ya da chatten söylerim. Şak diye şablon ekleyebilmem ve kartın üzerinde hemen değiştirebilmem
lazım: tarih, isim vs."

## 1. Gece bloklarını silmek

- **Ayrı konaklama bloğu** (sohbette söylenen, oteli seçilmemiş geceler: `stayBlocks[].slot`): sağ üstte × (diğer
  kartlardaki gibi, üstüne gelince; dar ekranda soluk ama hep görünür). Basınca o kayıt silinir (`deleteItem`),
  8 sn "… silindi · Geri al". "Ayrı olmasın / Merge back" bağlantısı kalkar.
- **Boş gece bloğu** ("Planlanmadı · bu geceler için kayıtlı yer yok"): ×, geceleri "Gerek yok" yapar
  (`trip.hidden` içine `nights:<start>_<end>`), 8 sn "Geri al" (gizlemeyi geri alır). Gizlenenler bugünkü
  "Gizlenenler" bölümünde "Geri getir" ile durur.
- Onay penceresi yok.

## 2. Anında ekleme

- Ekle penceresinde bir şablona ya da kartların arasındaki "+"ya basınca **form açılmaz**: kayıt hemen oluşur.
  - Tür: seçilen şablon. Şehir ve tarih: basılan yerden (bugünkü `insertAt` kuralları). Ad: türün adı
    ("Otobüs", "Restoran", "Yapılacak"…); ulaşımda "Nereden → Nereye" yer tutucusu (şehir biliniyorsa
    "Porto → ?"). Fiyat yok. Durum: "Planlanıyor" (sohbet planlarıyla aynı yol, `origin: "chat"`).
  - Rezervasyonsuz türler (Yapılacak, Restoran) Fikirler'e gider; sekme değişmez, alt bildirim
    "Fikirler'e eklendi · Göster" çıkar.
- Pencere kapanır, sayfa yeni karta kayar, kart **düzenleme modunda** açılır ve imleç başlıkta durur.
- Yanlış eklenirse × ya da "Geri al" (bildirim: "Otobüs eklendi · Geri al").

## 3. Kartın üstünde düzenleme

- Kapsam: **bütün kayıt kartları** (Emre, 2026-10-05: "kartı istediğim gibi customize etmeme izin ver").
  - Elle eklenen / sohbetten gelen planlarda (`origin: "chat"`) düzenleme kaydın kendisini değiştirir (`editedItem`).
  - Sayfadan kaydedilen kartlarda düzenleme **kullanıcı düzeltmesi** olarak ayrı tutulur:
    `Item.userEdits?: Partial<{ name; city; start; end; time; price; currency; from; to }>`. Görünen değer
    düzeltme varsa düzeltmedir; karar motoru ve plan da düzeltilmiş değeri kullanır. Aynı sayfa yeniden
    kaydedilince (`mergeItem`) düzeltmeler korunur, sayfadan gelen değer altta durur. Düzeltilmiş alanın
    üstüne gelince küçük "sayfadaki: X · geri al" ipucu; geri al düzeltmeyi siler.
  - Paylaşılan gezilerde düzeltmeler yereldir (kayıtlar paylaşılmıyor).
- Düzenlenebilir alanlar, kartta durdukları yerde:
  - Ulaşım: nereden, nereye (şehir adları), tarih, saat, fiyat; kiralıkta yer, başlangıç, bitiş.
  - Konaklama: ad, şehir, giriş, çıkış, fiyat.
  - Etkinlik / restoran / not / yapılacak / eSIM / sigorta: ad, şehir, tarih, saat (etkinlik ve restoranda), fiyat.
- Etkileşim: alanın üstüne gelince ince alt çizgi ve kalem imleci; tıklayınca aynı yazı boyutunda kutu
  (tarih için tarih seçici, saat için saat seçici, fiyatta sayı + para birimi). Enter ya da dışarı tıklama kaydeder,
  Esc vazgeçer, Tab sonraki alana geçer. Kayıt anında; ayrı "Kaydet" düğmesi yok.
- Kaydetme bugünkü `editedItem` kuralıyla (not, PNR, saat, tür korunur). Tarih değişince kart yerini plan
  sırasında kendiliğinden bulur ve görünür kalır.
- Boş alan yer tutucu gösterir ("Tarih ekle", "Fiyat ekle") ve tıklanınca düzenlenir.

## 4. Transfer kartında kısa uçlar

- Transfer ve şehir değişimi kartlarında uçlarda büyük yazı **kısa ad**, altında küçük **tam ad**:
  - Konaklama ucu: sağlayıcı (Airbnb, Booking.com, Hotels.com…) ya da tür (Otel, Daire, Pansiyon, Hostel; `stayKind`);
    altında konaklamanın tam adı (sarar, kesilmez).
  - Havalimanı ucu: "<şehir> Havalimanı" (`cityOfAirport` + kod), altında kod. Gar/istasyon: "<şehir> Garı",
    altında istasyon adı.
  - Bir bakışta "Airbnb → Porto Havalimanı" okunur; uzun ad siluete binmez.

## Kapsam dışı

Günlük akış satırlarında yerinde düzenleme.

## Doğrulama

Birim: kısa uç adları (konaklama/havalimanı/gar), kullanıcı düzeltmesinin mergeItem'da korunması ve geri alınması, varsayılan kayıt üretimi (her şablon, yer bağlamıyla), alan düzenlemesinin `editedItem` üzerinden
korunan alanlarla kaydı, gece bloğu silme/gizleme + geri alma.
e2e: "+" → kart anında ve düzenleme modunda; başlık/tarih/fiyat yerinde değişir; Enter/Esc; ayrı konaklama
bloğu × → kaybolur → Geri al → döner; boş gece bloğu × → Gizlenenler'e gider.
