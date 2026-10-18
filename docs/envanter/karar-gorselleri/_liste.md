# Karar görselleri

Kaynak: `/home/user/wt-kgorsel` (plan-v46-kod, tüm fazlar) canlı build; sahte saat 5 Ekim 2026; örnek gezi "Portekiz (örnek)". `-a` = şu an canlıda, `-b` = alternatif. Kod değişmedi, commit yok. Betikler `/tmp/kg/` altında.

| Dosya | Karar | Ne gösteriyor |
|---|---|---|
| ayarlandi-a.png | 1 ayarlandi | Konaklama bölümü: sol kartta gri "Ayarlandı" kapsülü (Jardim Stay "Ben hallettim" ile), sağda yeşil "Rezerve" kapsülü (Lisboa Loft). Aynı karede ayrışma. |
| ayarlandi-b.png | 1 ayarlandi | Aynı kare, CSS enjekte: `.okt.set { background: var(--okb) }` → Ayarlandı rozeti de yeşil; Rezerve ile aynı renk. |
| karsilastir-a.png | 2 karsilastir | Otel ihtiyacının arka yüzü (Değiştir 3 ile çevrilmiş): başlıkta "Karşılaştır" bağlantısı + "Pano'da aç · +2". |
| karsilastir-b.png | 2 karsilastir | Aynı arka yüz, Karşılaştır bağlantısı gizli (yalnız "Pano'da aç"). |
| etk-tik-a.png | 3 etk-tik | Planda olan etkinlik kartı (Douro tekne turu) hover'da: ↻ ✓ × ••• araçları. |
| etk-tik-a2.png | 3 etk-tik | Plana girmemiş öneri kartı (Livraria Lello) hover'da: × ve ••• araçları, altında "+ Plana koy". |
| etk-tik-b.png | 3 etk-tik | Eski build (origin/release 0.36.84): aynı Douro kartı, köşede yeşil ✓ "plandan çıkar" işareti; hover'da × ve •••; diğer kartlarda köşede +. |
| buyuk-harf-a.png | 4 buyuk-harf | Canlı "Yolculuk sırasıyla": kart üst satırı küçük harf ("Konaklama · 3 gece", "Etkinlik"). |
| buyuk-harf-b.png | 4 buyuk-harf | Mockup plan-v46-sira (C Karar ve rezerve + Yolculuk sırasıyla): "KONAKLAMA · 5 GECE", "ETKİNLİK" büyük harf. |
| ayri-konak-a.png | 5 ayri-konak | "+ Ekle → Otel" ile eklenen ayrı konaklama (Casa do Rio, €95, "Henüz otel yok"), kesik çizgili, rozetsiz. |
| ayri-konak-b.png | 5 ayri-konak | Karşılaştırma için normal otel kartı (Jardim Stay): görsel, "Önerimiz · Bunu seç" etiketi, fiyat, Rezerve et. |
| bulamadik-a.png | 6 bulamadik | Uçuş arka yüzü: "✨ Önerimiz 0" altında "Sana uyan başka seçenek bulamadık." |
| bulamadik-b.png | 6 bulamadik | Aynı arka yüz, bu metin CSS ile gizli. |
| hero-pdf-a.png | 7 hero-pdf | Hero: ana düğme "Planı tamamla" + ikinci düğme "PDF indir"; ••• menüsü açık (Bu geziyi paylaş, Planı PDF olarak indir). |
| hero-pdf-b.png | 7 hero-pdf | Aynı, hero'da ikinci düğme (PDF indir) CSS ile gizli; menü açık. |
| aktarma-a.png | 8 aktarma | Uçuş bileti: "4 sa 55 dk · 1 aktarma" (Pegasus kartı, stops=1 verildi). |
| aktarma-b.png | 8 aktarma | Aynı bilet, DOM düzenlendi: "1 aktarma · Madrid". |
| sil-wink-a.png | 9 sil-wink | Maskot (Asistan başlığındaki küre) normal hâl, büyütülmüş (160 px). |
| sil-wink-b.png | 9 sil-wink | Aynı maskot `data-state="wink"`, sağ göz kapalı (animasyon karesi dondurulmuş). |
| paylasim2-a.png | 11 paylasim2 | Canlı paylaşım penceresi ("Bu geziyi paylaş", Paylaş / Vazgeç). |
| paylasim2-b.png | 11 paylasim2 | `docs/mockups/2026-10-05-paylasim-guvenligi-v1.png` kopyası (panoda değişiklik bildirimi, silme uyarısı, Geçmiş). |
| seritler-a.png | 12 seritler | Canlı yapışkan şerit: "Sıradaki: Lizbon Loft →" tek bağlantı. |
| seritler-b.png | 12 seritler | Mockup seritler A: "SIRADAKİ KARAR · Porto oteli" şeridi, aday kartlar yan yana. |
| neden-a.png | 13 neden | Pano uçuş grubu, Pegasus kartında "Neden?" açık (artılar/eksiler; ilk artı "En kısa · 4 sa 55 dk"); üstte şerit. |
| neden-b.png | 13 neden | Aynı grup, kartta DOM ile eklenmiş "Direkt uçuş · lüks dediğin için" satırı (v30 mockup'ında neden satırı yok; spec metni). |
| baslatma-a.png | 14 baslatma | Canlı ana ekran ("Sıradaki gezi nereye?", öneri çipleri, maskotlu ilk kart). |
| baslatma-a2.png | 14 baslatma | "Yeni gezi planla" ile start-by-chat bir adım: "Nereye gidiyoruz?", sağda "Gezin şekilleniyor 0/6" ve Oluştur. |
| yol-gezisi-a.png | 16 yol-gezisi | Canlı çipler: "Yol gezisi" etiketsiz. |
| yol-gezisi-b.png | 16 yol-gezisi | giris-akisi-v3 tamsayfasından kırpma: "Yol gezisi · yakında" soluk etiketli çip. |
| teyit-a.png | 17 teyit | Ana ekran: maskot (ilk küre), link yapıştırma kutusu, çipler. |
| teyit-a2.png | 17 teyit | Oluştur düğmesi ve "Gezin şekilleniyor" paneli. |

## Çekilemeyenler / notlar

- **10 sil-flight**: görüntü yok. Ürün ekranlarında görünmüyor; kullanılacağı yer rev-3 gezi başlatma haritası (uçak sembolü, İstanbul'dan hedefe yay). Çekilemez.
- **15 kucuk**: atlandı (metin kararı).
- **18 hareket-dosya**: görüntü gerekmedi.
- **2 karsilastir**: "+N" örnek gezide çıkmıyor (3 seçenek hepsi sığıyor); -a'da "Pano'da aç · +2" metni DOM ile yazıldı (kodun yazdığı biçimde). Karşılaştır'ın ⓘ balonu bu build'de yok; -b'ye bağlantısız başlık konuldu.
- **3 etk-tik**: canlıda planda olan kartın araçları ↻ ✓ × •••; "+ ve ×" birlikte plana girmemiş öneri kartında (a2) değil, orada yalnız × •••; "+ Plana koy" düğme olarak altta.
- **4 buyuk-harf**: v46 mockup'ta büyük harf tür etiketi "Yolculuk sırasıyla" kartlarında; "Kategoriye göre" kartlarında tür etiketi yok, o yüzden canlı karşılığı da aynı görünümden.
- **5 ayri-konak**: canlıda ayrı konaklama blokunda görsel yok değil, soluk otel illüstrasyonu var; görselsizlik ancak bölüm içi blokta. Gösterilen bu.
- **7 hero-pdf**: örnek gezide paylaşım kapalı; gezi adı "Portekiz" yapılıp (demo bayrağı kalktı) menüde "Bu geziyi paylaş" açıldı. Hero'da ikinci düğme %100'e kadar "PDF indir", %100'de "Paylaş" olur (kod); %67'de "PDF indir" gösterildi.
- **8 aktarma**: örnek verideki Pegasus uçuşuna stops=1 yazıldı (IndexedDB); örnekte aktarmalı bilet yok.
- **9 sil-wink**: Mascot bileşeni canlı sayfada büyütülüp durumu elle değiştirildi.
- **11 paylasim2**: -b mockup PNG'si; HTML'in ayrı ekran görüntüsü alınmadı (PNG aynı sayfa).
- Görüntüler en çok 1000 px genişlik; 1440 px olanlar 1000'e küçültüldü.
