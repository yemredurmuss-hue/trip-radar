# v11 çizimi ↔ canlı: fark listesi (2026-10-09 öğleden sonra)

Emre: "çizimlerden farklı bir şeyler çıkmış … ikisini tek tek kıyaslamanı, çıkarmanı ve güncel halini işlemeni istiyorum."
Yöntem: `scripts/shots.mjs` aynı genişlikte (1440) çizimin C durumunu ("Karar ve rezerve") ve canlıdaki örnek geziyi
bölüm bölüm çeker (`e2e-output/shots/mock-*.png`, `live-*.png`). Referans: `docs/mockups/2026-10-08-japonya-web-v11.html`.

| # | Yer | Çizim | Canlı (öncesi) |
|---|-----|-------|----------------|
| 1 | Plan başlığı | Tek satır: kalın "Plan" · küçük gri segment "Kategoriye göre / Yolculuk sırasıyla" · "+ Ekle" · sağda renk anahtarı (26×16 kutular: kesik çizgili, krem, nane) | İki satıra kırılan "Gezi planı", arada "6 gecenin 3'ü rezerve…", büyük segment, anahtar iki satır |
| 2 | Gezinin şekli | 46 px yuvarlaklar içinde çizim görseli (uçak/otel/ev), çerçeve aşamaya göre (kesik gri / amber / yeşil); aralarında noktalı çizgi, üstünde **hareket eden** uçak/tren, altında süre ("11 sa", "1,5 sa"); üstüne gelince ipucu (ne seçildi) | Çizgi ikonlu küçük halkalar, süre yok, hareket yok, ipucu yok |
| 3 | Bölüm kabuğu | Her bölüm ayrı beyaz kart (20 px köşe, ince çerçeve), aralarında boşluk; başlık: renkli kare ikon, ad + sayı ("Uçuş 2"), altında aşama satırı; sağda iki renkli ince çubuk (yeşil rezerve + amber seçildi), üstte harcanan kalın, altında "€X ayrıldı"; ok | Tek beyaz yaprak, kıl çizgilerle bölünmüş; başlıkta "+ Ekle", "1/2" sayacı, tek renkli çubuk |
| 4 | Bölüm içi | Kartlar **ızgarada** (2 sütun; ulaşım 3), tarih sütunu ve zaman çizgisi yok, kartlar arası "+" yok | Solda tarih sütunu + noktalı çizgi, kartlar alt alta, aralarda "+" |
| 5 | Kart durumu | Arıyoruz: beyaz + kesik gri çerçeve · Seçildi: krem `#fbf6ea` + `#e9d29a` çerçeve · Rezerve: nane `#eef8f1` + `#b9e0c7` | Seçildi sarı-bej büyük kutu, alt şeridi ayrı kutu; Arıyoruz da bej |
| 6 | Kart gövdesi | 60×50 çizim görseli + 18 px kalın ad + gri tek satır (konaklamada ay noktaları + gece) | 176×128 büyük görsel, uyum puanı rozeti, puan/yorum satırı, kaynak linki |
| 7 | Kart alt satırı | İnce çizgi; Seçildi: fiyat kalın + "Pano'da N alternatif" + koyu "Rezerve et ↗" (marka logosuyla) · Rezerve: "✓ Giriş 1 Nis 15:00" + belge çipi (dosya adı) / "Belge eksik" + "Ayrıntı ›" · Arıyoruz: "N seçenek ›" + ✨ | Ayrı kutu içinde "Planlandı · bilet alınmadı · ⏳ 3 gün", "Rezerve ettim" vb. |
| 8 | Uçuş kartı | Şehirler büyük, saat + kod küçük, ortada soluk uçak; rezervede kesik çizgiyle ayrılmış **koçan**: havayolu, PNR, yolcu sayısı + damga | Büyük uçak çizimi, logo, süre satırı; koçan yok |
| 9 | Vize | Tam genişlikte yeşil satır "✓ Vize gerekmiyor · Türk pasaportuyla 90 güne kadar" (gerekiyorsa aynı şekil amber) | Kutucuklu amber kutu |
| 10 | Hazırlık | 3 sütun kutucuk ızgarası: kare onay kutusu, ad + gri alt satır, "Hazır" etiketi / "Amazon ↗"; hazır olan beyaz + yeşil çerçeve | Düz liste |
| 11 | Etkinlik fikirleri | Kareler **kaynaktan gerçek teklif** (Viator/Klook logosu, fiyat · kişi), "+ Plana koy" | Kaydedilenler kare; Viator teklifleri boş şehir kartının altında kapalı "✨ N öneri ▾" satırında (AI önerisi gibi duruyor) |
| 12 | Etkinlik karesi | Nötr zemin üstünde görsel, ✨/yüz sol üstte, "📍 Şehir · süre · marka", "€X · kişi" | Pembe zemin, büyük kare |
| 13 | Pano kartları | Görsel yoksa çizim (otel/ev/tren/eSIM), uçuşta iki şehir arası kesik yay; marka logosu meta satırının başında; altta "Neden? ⌄" | Renkli zemin üstünde tek ikon; "Karşılaştır" linki |

Bilinçli korunanlar (çizimde yok ama işlev kaybolmasın): kartın ••• menüsü (Düzenle, Değiştir, Sil, Belge ekle) üstüne
gelince görünür; iptal süresi biten rezervasyonda kırmızı "⏳ iptal bugün biter" uyarısı alt satırda kalır; bölüme ekleme
bölümün sonunda sessiz bir "+ Ekle" ile kalır (çizimde tek "+ Ekle" plan başlığında).

## Emre'nin revizeleri (2026-10-09 akşam, 0.36.70)

Emre gerçek gezisinde (Porto ve Madeira, İngilizce arayüz, canlı uçuş verisiyle beş uçuş) gördüklerini söyledi;
`SHOTS_STRESS=1 SHOTS_LANG=en node scripts/shots.mjs` aynısını örnek geziyle üretir.

- **Taşan, üst üste binen yazılar** → kart içeriğine tek standart: kart hücresinden asla geniş değil, uzun ad
  kelimeden kayar, alt satır en çok iki satır, canlı kutucuklar sığdığı kadar yan yana, üst satır gerekirse alta iner,
  uçak/tren çizimi iki ucun ortasında akışta (hiçbir yazının üstüne binmez), rezerve kartın alt satırı: durum, biten
  tarih (kırmızı), belge adı (kısaltılmış), "Ayrıntı ›". Ulaşım kartları en az 300 px.
- **Sayfa komple kayıyordu** (altta boşluk, sohbet yukarı) → panelin içindeki mutlak konumlu öğeler (ekran okuyucu
  sayacı, ipuçları, kart "+") panele bağlandı (`.panel`, `.cat-sec` position: relative). e2e: "the page doesn't
  scroll, the panel does" (düzeltme kaldırılınca düştüğü doğrulandı).
- **Etkinlik ve turlar karışıktı** (öneri iki yerde: bölüm üstünde sohbetin önerileri, altta kaynağın kareleri; planda
  olan anlaşılmıyor) → iki yer: **Planda** (büyük satırlar, fiyat sağda belirgin) ve katlanabilir **Öneriler ve
  fikirler** (sohbet önerileri, Viator teklifleri, kaydedilen fikirler tek ızgarada kare, "+ Plana koy").
- **Yapılacak şeyler'de plana eklenen anlaşılmıyordu** → aynı kural: Planda satır (günü ya da "Günü yok"), fikirler
  ve öneriler kare, katlanabilir.

## Plana eklenen turun fotoğrafı (0.36.71)

Emre: "fotoğrafları ile önerdiğin şeyleri plana ekleyince fotoğrafları nereye kayboluyor?" Neden (deneyle,
`SHOTS_OFFER=1 node scripts/shots.mjs`): veri fotoğrafı tutuyordu (`offerItem` → `imageUrl`), ama (1) Planda satırı
fotoğrafı 64 px köşeye küçültüyordu, kartın en güzel parçası gidiyordu; fiyat karede "kişi", satırda "toplam" diye
değişiyordu; (2) sohbetin plana koyduğu tur addan kuruluyordu, fotoğrafı yoktu (kaynak aynı turu fotoğraflı
göstermiş olsa da). Şimdi: Planda kartı fotoğrafı solda büyük tutar, fiyat "€89 kişi · €178 toplam"; fotoğrafsız
kayıt, kaynağın aynı turuyla (sayfası ya da adı) eşleşince o fotoğrafı alır ve kayda yazılır (Pano ve ayrıntı da
gösterir); planda olan tur önerilerde tekrar çıkmaz.
