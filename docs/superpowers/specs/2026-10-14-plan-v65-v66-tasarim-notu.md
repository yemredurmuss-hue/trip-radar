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

## v68 (v67 üstüne ince ayar, yapı aynı) · docs/mockups/plan-v68-vurgu
- Niyet kartı sakinleşti: etiket 19 px / kalın çerçeve yerine 14,5 px / ince çerçeve, ad 30 px yerine 23 px ve 700, ince çizgi, hafif zemin, küçük mühür. Sütun 260 px yerine 236 px.
- Önemli bilgi öne: fiyat 24 px / 800, saat 22 px, rota ve otel adı 20-21 px, "kişi başı" ve "/ gece" okunur gri.
- CTA tek eylem rengi (mor), 42 px, gölgeli, üstüne gelince kalkar: Rezerve et, Klook ↗ gibi dış bağlantılar. İkincil düğmeler (Bunu seç, Plana koy) mor çerçeveli, "Aldım" yeşil çerçeveli.

## v69 (v68 + onaylı "seçenek paneli") · docs/mockups/plan-v69-secenekler
- Onaylanmış "altta açılan diğer öneriler" paneli geri geldi (v67 ve v68'de unutulmuştu): Konaklama Tokyo ve Kyoto'da "Diğer oteller", Uçuş İstanbul → Osaka'da "Diğer uçuşlar". Etkinlik'te "Öneriler" zaten vardı.
- Seçenek kartında kalan: görsel, kaynak ve puan, ad, fiyat, tek düğme ("Bunu seç"). Giden: avatar, ⓘ, ×, menü, klips, "Değiştir n", durum etiketi, yorum sayısı ve konum, uçuşa kalan gün uyarısı, "Rezerve et" (seçmeden rezervasyon yok), iptal notu.
- Uçuş seçenekleri tek sütun (bilet kartı dar sütunda sıkışıyordu).
- Seçenek sayfadaki örnekler canlı örnek gezideki kartların kopyası (ad ve fiyat değiştirildi); gerçek öneri verisi değil.

## v70 · docs/mockups/plan-v70-tek-eylem
- Düğme yazıları ortalandı (satır yüksekliği düzeltildi).
- Eylemler tek yerde: seçili otel/ulaşım kartında "Aldım" ve "Rezerve et" artık altta, fiyatın yanında yan yana (üstteki şeritten indi). Önerimiz kartında "Bunu seç" + "Rezerve et" aynı sırada. Bilet kartı koçanında düğmeler fiyatın altında alt alta.
- Seçenek kartında tek düğme "Bunu seç" fiyatın karşısında.

## v71 · docs/mockups/plan-v71-eylem-hiyerarsi (17 Ekim, v70 üstüne, açık soruların cevabı)
- **Eylem hiyerarşisi:** her kartta tek eylem satırı; solda fiyat, sağda bir dolu bir ikincil düğme, satır kırılmaz (v70'te "Rezerve et" alt satıra düşüyordu). Önerimiz: dolu "Bunu seç", yanında yazı bağlantısı "Rezerve et ↗" (önce seç, sonra rezerve). Seçildi: dolu "Rezerve et ↗", çerçeveli "Aldım". Seçenek kartı: tek dolu "Bunu seç".
- **"Değiştir n" kartta gizli:** altındaki "Diğer oteller / uçuşlar n" paneli aynı işi görüyor (kodda diyalog korunur, giriş noktası panel olur).
- **CTA rengi tek mor** (kategori rengine bağlanmadı: 6 renk eylemi tanınmaz yapar, kategori rengi niyet kartında ve çerçevede kalıyor).
- **Niyet kartı sakinleşti:** görsel 78 px, ad 20 px, ince çizgi, zemin daha açık.
- **Seçenek kartında iptal satırı** ("Ücretsiz iptal · 1 Nis'e kadar" yeşil, "İade yok" kırmızı); yalnız veri varsa gösterilir (çizimde örnek veri).
- **Uzun ad:** niyet kartı adı ve kart başlığı 2 satıra sarar, sonra "…" (Kyoto grubu "Playa del Carmen" ile denendi).
- **Mobil (390 px):** niyet kartı üstte, kart altta; eylem satırı sığmazsa fiyat üstte, iki düğme altta eşit genişlikte.
- **Karanlık mod:** canlı uygulamada karanlık mod yok (app.css'te tema değişkeni yok); kontrol edilecek bir şey yok, istenirse ayrı iş.

## v72 · docs/mockups/plan-v72-derli-toplu (17 Ekim, Emre'nin "app gibi derli toplu" isteği)
Artifact: https://claude.ai/artifact/89dVEm5d6bUs6pAhg1b9x9 · elle yazılmış kaynak `kaynak.html` (canlı yakalama değil).
- **Her ihtiyaç tek kart, tek satır:** solda dar niyet şeridi (tür · yer · gece/tarih/kişi · niyet sözleri, tür rengi şerit), ortada seçili (durum etiketi, marka, ad, tek satır bilgi; uçuşta saatler ve süre), sağda fiyat ve tek eylem satırı. ••• menüsü sağ üstte.
- **Seçenekler kartın altında açılır** ("n seçenek daha · en ucuzu €820"), seçili olsun olmasın. Uçuş ve ulaşım Skyscanner gibi satır (havayolu harfi, kalkış–varış, süre/aktarma, etiket En ucuz/En kısa, fiyat, Seç). Otel fotoğraf önde (4:3 görsel, marka, "En uygun", fotoğraf sayısı, ad, puan, iptal satırı, gece fiyatı, Seç). Etkinlik Viator/Klook fotoğraflı, Yapılacak Haritalar fotoğraflı.
- **Boş ihtiyaç:** tahmini fiyat niyete taşındı; sağda "Kyoto için 4 gece yer bul" + Booking.com'da ara, Airbnb'de ara, "AI önersin", link bırak notu; "Gerek yok" sağda. Resmî site kalktı.
- **Üst özet:** tek çubuk + "16 ihtiyaçtan 9'u hazır: 5 rezerve, 4 seçildi" + "Sıradaki" düğmesi. Plan çubuğundan renk göstergesi ve "+ Ekle" kalktı (Ekle bölüm sonunda).
- **Kart içi ikonlar** (ⓘ, klips, ×) ••• menüsüne; avatar yalnız başkası eklediyse.
- Kaybolmayanlar sayfanın altında listeli. Karanlık mod tokenları çizimde var (canlıda yok).

## v73 · docs/mockups/plan-v73-asistanla (17 Ekim)
- Uygulama kabuğu: solda asistan (sohbet, sonucun ihtiyaca indiği "Planda göster" kartı, hızlı yanıt çipleri, "arıyorum" satırı, yazı kutusu), sağda plan.
- Kategori kutusu geri geldi (Emre: vazgeçme): başlıkta ikon, ad, durum özeti, bütçe çubuğu; içinde ihtiyaçlar ince çizgiyle ayrılmış satırlar; sonda "+ Ekle".
- Niyet: türün illüstrasyonu (48 px) + tür, ad, tek satır bilgi. Seçenekler kendi fotoğrafıyla (otel, etkinlik) ya da logosuyla (eSIM, sigorta, havayolu harfi).
- Seçenekler derli toplu: niyet sütununun hizasından başlayan tek kutu; uçuş/ulaşım sabit sütunlu satırlar (logo, kalkış–süre–varış, etiket, fiyat, Seç); otel ve etkinlik 200 px fotoğraf kartları yatay şeritte.
- Yazı ölçüsü dört basamak (20/16/13,5/12), tek CTA moru, ikincil düğmeler çerçeveli.

## v74 · docs/mockups/plan-v74-standart (17 Ekim)
Sistem (Emre): prompt → AI omurgayı kurar, API'den bulabildiği en iyi seçeneği her niyete SEÇER ("AI seçti"); kullanıcı sohbete link atar, o da o niyetin seçeneği olur ("Senin linkin"); Pano her şeyin biriktiği yer ("Pano"). Seçenekler yalnız AI'nın bulduğu değil, kullanıcının getirdikleri de.
- Üst özet (hero) geri: kapak, şehir sekmeleri, kalan gün, ad, tarih·gece·şehir, sayaçlar, tek ilerleme çubuğu + Sıradaki, sağda bütçe (alındı/seçildi/boşta), kişiler, tercihler.
- Satır 4 sabit sütun: TARİH (ay, gün, haftanın günü, "→ bitiş") | niyet (illüstrasyon, tür, ad, kişi/niyet) | seçili | EYLEM.
- Standart eylem sütunu (her satırda aynı yer, aynı boy): fiyat; dolu "Satın al ↗"; çerçeveli "Değiştir"; altta "Pano'da n kayıt". Alındıysa yeşil tik + "Bilet alındı / Rezerve / Alındı" + "Ayrıntı". Boşsa tahmini fiyat + "AI bulsun" + "Gerek yok".
- Boş ihtiyaç diğerleriyle aynı ağırlıkta (gri başlık, tek satır "Kendin ara" bağlantıları).
- Seçenekler satırın altında tam genişlik: uçuş Skyscanner sütunları (logo, saatler, süre/aktarma, kaynak etiketi En ucuz/Senin linkin/Pano, fiyat, Seç); otel 4 fotoğraf kutusu, marka yazıyla (Booking.com, Airbnb), kaynak etiketi.
- Uçuş ve ulaşımda yayındaki bilet çizimi: şehir büyük, kavisli kesikli rota, ortada daire içinde araç ikonu.
- Etkinlik ve Yapılacaklar kutu kutu (fotoğraf, marka, ✓ planda, AI/Senin linkin etiketi, Satın al / + Plana ekle / Haritada aç).
