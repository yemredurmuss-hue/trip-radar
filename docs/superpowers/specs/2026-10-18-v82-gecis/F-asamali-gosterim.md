# Aşamalı gösterim (progressive disclosure) önerileri · v82 üstüne

Amaç: link kaosunu karar verilebilir hale getirmek. Kullanıcı her an yalnız o anki kararı için gereken bilgiyi görür; geri kalanı bir dokunuş ötededir ve hep aynı yerdedir.

## 1. Dört katman, her bilgi tek katmanda
| Katman | Ne zaman görünür | İçerik | Eylem |
|---|---|---|---|
| K0 Omurga (kapalı kategori satırı) | Her zaman | ad, tek satır özet ("4 şehir · 14 gece · 10 fikir"), en çok 3 küçük görsel, durum çubuğu + "1 alındı · 1 seçildi · 2 karar", harcanan / ayrılan | Aç |
| K1 Niyet kutusu (sabit çerçeve) | Kategori açılınca | karar için gerekenler: görsel, ad, tek satır bilgi, en çok 2-3 çip, fiyat ya da kod, tek ana eylem + bir ikincil | Seç / Rezerve et / Aldım / Değiştir / Belgeyi aç |
| K2 Ayrıntı (kartın üstünde açılır) | ⓘ ya da ⋯ > Ayrıntı | artılar/eksiler, istek uyumu, iptal tarihi, kod ve belge listesi, yerinde bilgiler, "İptal ettim", düzenle | Düzenle, belge ekle, iptal |
| K3 Pano (büyük pencere) | Pano düğmesi | bütün seçenekler, yan yana karşılaştırma, AI puanı ve sırası, beğeniler, ilham | Seç, beğen, karşılaştır |

Kural: Bir bilgi iki katmanda tekrar etmez; K1'de kısa hali (Ücretsiz iptal), K2'de tam hali (20 Mart'a kadar ücretsiz iptal). Bilgi haritası (hangi alan hangi katmanda) spec ekinde tablo olur.

## 2. Duruma göre gösterim (aynı çerçeve, farklı içerik)
- Karar bekliyor: seçenekler ve fiyat öne; artı/eksi K2'de.
- Önerimiz: tek seçenek + neden (tek satır, K1), "Bunu seç".
- Seçildi: fiyat + Rezerve et; karşılaştırma bitti, artı/eksi gizli.
- Alındı: fiyat geri çekilir; kod, saat, adres, belge öne (erişim modu).
- Gerek yok: kutu tek satıra iner, kategori sonunda "n gizli" satırında toplanır (yayındaki HiddenList).

## 3. Zamana göre gösterim (gezinin evresi)
- 30+ gün önce: karar ve bütçe öne; Hazırlık kapalı satır.
- 14 gün kala: Hazırlık ve belgeler öne çıkar; alınmış kartta belge yoksa amber "belge yok" görünür (öncesinde görünmez).
- 48 saat kala: uçuş kutusunda check-in, terminal, PNR öne; hero'da "Sıradaki: check-in" olur.
- Gezi sırasında: hero yerine "Bugün" şeridi (bugünün otel, ulaşım, etkinlikleri); Yolculuk sırasıyla bugüne kayar; karar bekleyenler geri planda.
- Gezi bitti: harcama özeti ve anılar (ayrı iş, backlog).

## 4. Odak: tek "Sıradaki"
- Hero'daki "Sıradaki" düğmesi ilgili kategoriyi açar ve o niyete kayar (prototipte var).
- Plan ilk açıldığında hepsi kapalı; yalnız sıradaki kararın kategorisinde küçük nokta.
- Bir karar verilince bir sonrakine geçiş önerisi (toast: "Kyoto oteli seçildi · sıradaki: Tokyo → Kyoto treni ›").

## 5. Sayılar ve özetler açılabilir
- Kategori satırındaki "2 karar" üzerine gelince hangi niyetler olduğunu söyler (ipucu), tıklayınca kategori açılır ve ilk karara kayar.
- Hero'daki "%50 hazır" üzerine gelince alındı / seçildi / karar dağılımı; bütçe tıklayınca dağılım penceresi (prototipte var).

## 6. Seçenek sayısı sınırı
- Tek seçimli niyet: ilk 3 (AI sırasıyla), gerisi "tümü Pano'da".
- Çoklu (etkinlik, yapılacak): sıra başına 4 kart, fazlası "+n Pano'da".
- Pano'da ilk açılış: Tümü; niyetten açılınca doğrudan karşılaştırma.

## 7. İlk kullanım ve boş haller
- Omurga yeni oluştuğunda: her niyet "Önerimiz · onayla" ile gelir (AI seçti), kullanıcı onayladıkça sadeleşir.
- Boş niyet: form değil yönlendirme (tahmini fiyat, bölge çipleri, Kendin ara simgeleri, AI'dan öner).
- Yolculuk sırasıyla: en az 2 şehir ve tarih yoksa görünüm seçicide soluk, üstüne gelince "tarihler belli olunca açılır".

## 8. Dar ekran
- Yan sütun alta iner; ikincil eylemler ⋯ menüsüne; ipuçları dokununca açılır, ikinci dokunuşta kapanır.

## Karar gerektirenler
- P1 Zamana göre gösterim (bölüm 3) bu sürümde mi? Öneri: 14 gün / 48 saat kuralları evet, "gezi sırasında Bugün şeridi" ayrı iş.
- P2 "Gerek yok" denen niyetler: kategori sonunda "n gizli" satırı (öneri) / tamamen kaybolsun / soluk kalsın.
- P3 Karar verince sıradakine geçiş önerisi: toast (öneri) / otomatik kaydır / hiçbiri.
- P4 Bilgi haritası (her alan tek katman) spec ekine tablo olarak girsin mi? Öneri: evet, denetim bununla yapılır.
