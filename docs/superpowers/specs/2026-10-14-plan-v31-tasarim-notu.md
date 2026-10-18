# Plan v31: niyet kartı + seçili kart + seçenekler (tasarım notu, 2026-10-14)

Çizim: `docs/mockups/plan-v31/index.html` (tek dosya, v30'un gerçek kartlarıyla). Durum: **Emre %99 onayladı, son bakışı bekleniyor; onaydan sonra kod, bulutta ayrı dalda (`plan-v31-kod`).** Kod yazılmadı.

## Seçilen yön: D
Kategori içinde her ihtiyaç bir **grup** (tek çerçeve, türün renginde):
- **Solda niyet kartı** (illüstrasyonlu, türün kendi çizimi): tür etiketi, şehir/yol adı, gece, tarih, kişi, niyet etiketleri (sakin, tren yakın, orta bütçe), aşama (Arıyoruz / Seçildi / Rezerve / Ayarlandı).
- **Birlikte hissi:** ortak renkli çerçeve, niyet kartının sağ kenarında kalın renkli şerit, sağ alan aynı tonun hafif tinti, kesikli ayraç, seçeneklerin başlığından niyet kartına bağ çizgisi.
- **Sağda seçili gerçek kart açık** (otelde yatay ve kısa: solda küçük görsel, sağda ad/puan/iptal, altta fiyat ve düğme; yükseklik ~160 px).
- **Seçenekler isteğe bağlı:** seçili kartın altında "X için diğer seçenekler · N · Pano ve AI" başlığı (`details`): dokununca açılır, tekrar dokununca kapanır; açıkken 3 gerçek seçenek karosu (kendi fotoğraflarıyla), "Daha fazla bul", Booking/Resmî site. Seçilmemiş ihtiyaçta seçenekler doğrudan görünür; hiç seçenek yoksa "Seçenek ara".
- **Yolun adı başta:** Ulaşım seçeneklerinde Uçak / Shinkansen / Otobüs / Araç kiralama ikon+etiket; seçili kartta tür rozeti (Tren, Otel).
- **Dönen kart korunur:** seçili kartın "N alternatif" düğmesi v30 arka yüzünü açar.
- **Seç davranışı (çizimde çalışıyor):** karo "Seç" → seçili kart yerine oturur (yükselme + mühür hareketi), aşama Seçildi olur, eski durum "Önceki: … · Geri al" satırına iner, bölüm çubuğu ve üstteki ilerleme yüzdesi güncellenir.
- **İlerleme:** üstte yapışkan şerit (halka %, "2 seçildi · 3 karar bekliyor", "Sıradaki: Hakone konaklaması →"); bölüm başlığında ince çubuk.
- **Hareket:** grup girişi (rise), seçim parlaması, kat açılışı; `prefers-reduced-motion` hepsini kapatır. Hareket Dili oturumunun işaretleri (`data-pit` vb.) koda geçerken eklenecek.

## 4. tur değişiklikleri (Emre geri bildirimi)
- **Niyet kartı sadeleşti:** tür etiketi, ad, TEK satır bilgi (gece · tarih · kişi), en çok 2 niyet etiketi (fazlası "+N", üstüne gelince listelenir), aşama etiketi görselin sağ üstünde.
- **Kendin ara bağlantıları niyet kartında:** üstüne gelince (dokunmatikte hep görünür) Booking.com / Airbnb / Resmî site (konaklama), JR / Rome2rio (ulaşım), Skyscanner / Google Uçuşlar (uçuş), Viator / Klook / GetYourGuide (etkinlik), Haritalar (yapılacak), Airalo (eSIM). Seçenek alanındaki Booking/Resmî site satırı kalktı.
- **Seçenekler her grupta, seçili olsun olmasın altta katlanır** ("Seçenekler · Pano ve AI" + sayı). Seçilmemiş ihtiyaçta büyük kart yerine ince "Henüz seçilmedi" satırı (tahmini aralık yalnız ≥3 gerçek teklifle).
- **Tüm bölümler aynı yapıda:** Konaklama, Ulaşım, Uçuş, Etkinlik ve turlar (✓ planda kartlar + katlanır öneriler), Yapılacaklar ve restoranlar, Belgeler ve internet (eSIM, sigorta).
- İlerleme: 7 karar ihtiyacı (konaklama x3, ulaşım, uçuş, eSIM, sigorta); etkinlik ve yapılacaklar karar sayılmaz.

## Kodlama sırası (onaydan sonra)
1. Niyet kartı + çerçeve grup bileşeni (Plan'ın her bölümü; `PlanEntry`/`CategoryPlan`), seçili otel yatay biçimi.
2. Seçenekler katlanır (arka yüz `ChoiceSheet` ile aynı veri), yolun adı etiketi.
3. Sohbetten "Ekle" (`addChatOffer`) doğru ihtiyacın (needKey) seçeneklerine düşsün, kopya kart açmasın. Önce sebebi bul: şehir adı biçimleri (Meksiko / Mexico City / havalimanı kodu) needKey eşleşmesini bozuyor olabilir.
4. "Değiştirildi · Geri al" satırı (kaybolan seçim).
5. İlerleme şeridi ve bölüm çubukları (yapışkan şerit mevcut).
6. Hatalar: Meksika eSIM'i gelmiyor (ülke eşlemesi), "başka öner"in Viator'a gitmesi, Haritalar fotoğrafı için Places API yok (entegrasyon kararı Emre'de).

## Açık kararlar
- Tepsi (B) ve yan yana liste (C) bırakıldı, çizimde arşivde.
- Otel kartı iki biçim: liste görünümünde yatay, arka yüz karoları dikey kare.
- Haritalar fotoğrafı için Google Places API (anahtar + maliyet) eklensin mi?
