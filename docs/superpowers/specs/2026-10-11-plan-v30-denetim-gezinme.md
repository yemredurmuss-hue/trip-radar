# Plan v30 denetimi: gezinme, yapışkan şerit, Yolculuk sırasıyla, Gün gün (2026-10-11, yerel ajan)

Çizim (docs/mockups/plan-v30) ile 0.36.82 canlısı karşılaştırıldı (1000, 1440, 390 px). Diğer üç denetim (kartlar, etkinlik/gezi türü, Pano/zamanlama/korunacaklar) yapılamadan oturum buluta taşındı: yeniden yapılmalı.

## Eksikler (en görünürden)
1. **Gün gün hâlâ eski gün fotoğraflı kartlar** (Liste/Kartlar anahtarı, gün çipleri). Çizim: günde tek satır: tarih kutusu, o gün başlayan uçuş/ulaşım/tarihli etkinlik ve durumları, "Gece: Kyoto · Gion Machiya Evi", boş günde "Serbest gün · yapılacaklardan seç". "Serbest gün" metni kodda hiç yok. Yer: TripPanel.tsx ~892 (TimelineView yerine yeni gün satırı bileşeni; lib/dayCards.ts kullanılabilir).
2. **Yapışkan şerit 860 px altında kayıp olur** (.panel sticky kök olur; app.css ~33/34/3888); Gün gün ve Harita'da hiç yok (TripPanel.tsx:727 `active` yalnız plan|story).
3. **Şerit sayfa tepesine yapışmıyor:** panel dolgusu yüzünden 16 px aşağıda, üstünde içerik görünüyor (.sbar-slot top:-16px ya da negatif margin). 1000 px'te `.sbar-name` çöküp başlık görünmüyor, 1440'ta kesiliyor. "Sıradaki" düğmesi çok uzun ("Next: Lisboa Loft: free cancella…"); olması gereken kısa "Sıradaki: X konaklaması →". Bitince "✓ Her şey hazır" yok. Halka üstüne gelince "6 rezerve · 4 seçildi · 3 karar bekliyor" dökümü yok.
4. Plan | Pano sekmesinde Pano sayısı yok ("Pano 66").
5. Dar ekranda gizleme sırası yanlış (app.css 4110-4111 "hazır", bütçe ve Plan|Pano'yu birden gizliyor; spec: önce "hazır" yazısı ve ayırıcılar, sonra bütçe ve kapak; geçiş kalır).
6. "+ Ekle" ve Aranıyor/Seçildi/Rezerve göstergesi Yolculuk sırasıyla ve Gün gün çubuğunda yok (TripPanel.tsx ~848).
7. Küçük: Yolculuk sırasıyla sonunda "✓ Eve dönüş" satırı yok; 1000 px'te sütunda otel kartı sıkışıp kesiliyor (.sy-cb); ••• menü alt yazıları; hero'da AI sloganı ve "Tahmini toplam · bütçeye sığar" satırı.

## Geçenler
İki sekme, Gün gün'ün planın üçüncü görünümü olması, ••• menü girişleri, PDF girişi, şekil şeridi (duraklar, ikonlar), Yolculuk sırasıyla tarih sütunu ve şehir başlıkları.
