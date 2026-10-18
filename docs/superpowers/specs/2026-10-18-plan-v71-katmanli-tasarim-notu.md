# Plan v71: katmanlı plan (tasarım, kod yok)

Amaç (Emre, 18 Ekim): prompt ya da linkle omurga oluşunca seyahatin şeklini görmek; her kategoride seçenekleri ve biriken linkleri karışıklık olmadan görmek; her durumda kartın üstündeki eylem değişsin (Seç, Satın al, Değiştir); infolar gerekli yerin arkasında. Kartlar v70'teki onaylı kartlar (canlı sınıflar), yeni olan katmanlar.

Mockup: docs/mockups/plan-v71-katmanli/index.html (etkileşimli; kaynak/ altında üretici). Altta prototip çubuğu: Durum (Plan ilerledi / Omurga yeni oluştu), Açık kategori (A Akış / B Odak / C Sekme), Değiştir (1 Yerinde / 2 Takas / 3 Çekmece).

## Katmanlar
1. Omurga: tüm kategoriler kapalı. Satırda ad, içerik özeti ("5 seçenek · 1 seçildi · 1 rezerve · 1 aranıyor"), niyet özeti ("Tokyo 3 · Kyoto 4 · Hakone 3 · Osaka 4 gece"), en çok 6 mini görsel (+n), kategori bütçesi, "n karar bekliyor". Mini görsel kaynağı rozetle: ✨ AI, 🔗 senin linkin, S/E ekleyen, ✓ seçili/rezerve. Seçeneği olmayan niyet kesikli boş kutu.
2. Kategori açık: her niyet yatay niyet kartı (plaka, çizim, dev ad, ikonlu bilgi, istek/şart, durum mührü, "Kendin ara" okunur marka bağlantıları). Altında ağaç çizgisiyle:
   - seçili yoksa: ilk 3 seçenek (Seç + kaynak ↗), "Hepsini gör (n)", link yapıştır, "Daha fazla öner";
   - seçili varsa: seçenekler gizli, seçili canlı kart büyük; eylemler tek satırda: Değiştir (n) · fiyat · Aldım · "Booking.com'da rezerve et ↗";
   - rezerve: canlı rezerve kartı (belge yok, Ayrıntı);
   - hiç seçenek yoksa: "Henüz seçenek yok" + AI'dan öner + link yapıştır + Gerek yok.
   Etkinlik ve Yapılacak çoklu: "Planında (n)" satırı, altında "Öneriler" (+ Plana koy).
3. Değiştir: seçenekler yeniden açılır, şu anki "Seçili" işaretli. Üç yol: Yerinde, Takas (seçili kart "Şu an" çubuğuna küçülür), Çekmece (sağdan panel, kaynağa göre süzgeç).
4. Ayrıntı: ⓘ / Ayrıntı ile iptal koşulu, konum, toplam, kaynak, uçuş uyarısı açılır.

Hepsini gör = o niyetin küçük panosu: Hepsi / AI / Linklerim / Ekleyenler süzgeci. "Pano'da karşılaştır ›" genel Pano'ya gider (henüz çizilmedi).

## Açık sorular
- Açık kategori: A, B ya da C.
- Değiştir: 1, 2 ya da 3.
- Pano görünümü: bu katmanlı yapıda Pano sekmesi neyi gösterecek.
- Mini görseller canlıda gerçek fotoğraf/logo (Places API kararı verildi); burada çizim.
