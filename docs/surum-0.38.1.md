# Trip Radar 0.38.1

19 Ekim 2026. 0.38.0'ın üstüne küçük bir sürüm; ayrıntılı not `docs/surum-0.38.0.md`'de.

## Ne değişti
- Gün gün, Ayarlar ve ilk kurulum, popup, Seyahatlerim, bildirimler ve PDF yeni renklerde ve 9 basamaklı yazı ölçeğinde. Yerleşimleri aynı (satır 151, 163).
- Seyahatlerim'deki gezi kartının kapağı hero'nun kapağıyla aynı fotoğraf; fotoğraf yoksa düz renk.
- Boş Seyahatlerim metni yeni başlangıcı anlatıyor ("İlk gezini başlat").
- Biletteki "Bilet alındı" ve şehir adları ölçekte; konaklama, sıra ve Pano kartları üzerine gelince 3 px yükselir.
- Plana konan her şey Planında'da görünür, dörtlü sıralar halinde (Emre, 19 Ekim). "+n Pano'da" yalnız Öneriler'de.
- Hazırlık'ta son günü geçmiş madde abartısız kırmızı ve "geçti" yazar; kapalı satır ve Yolculuk adımı da öyle.
- Öneri taraması modele hiç ulaşamazsa (güncellemede yeniden yükleme, ağ kopması) uyarı yazmaz ve bir gün beklemez; pano bir sonraki açılışta yeniden sorar.
- Havalimanı tablosu genişledi: bilette "KIX" yerine "Osaka".
- Planın eski gövdesi ve eski boş kartlar silindi (0.37.1'de kullanılıp artık hiçbir yerde kullanılmayanlar).

## Doğrulama
- `npx tsc -p .` temiz, `npx vitest run` yeşil, tam e2e 61/61.
