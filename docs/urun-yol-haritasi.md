# Trip Radar ürün yol haritası: ilk prompt'tan rezervasyona

Yaşayan belge. Başlangıç: Emre ile 2026-10-08 akış oturumu. Bir parça tasarlanıp onaylandıkça, bir karar
değiştikçe burası güncellenir. Ayrıntılı tasarımlar `docs/superpowers/specs/` altında; bu belge onların
**sırası ve ortak kuralları**.

Çalışma sırası her parça için aynı: **akış → UX → UI çizimi (artifact, sayfa sayfa) → Emre onayı → spec → kod.**
Kod, çizim onaylanmadan başlamaz.

## Tez

İnsanlar sonunda yine Booking'de, Skyscanner'da kıyaslayıp rezerve ediyor. O siteler bu işi milyar dolarlık
arayüzleriyle bizden iyi yapıyor. Trip Radar onlarla yarışmaz, onları kullanır: **niyeti netleştirir, doğru
aramayı hazırlar, bulunanı geri toplar, AI ile karşılaştırır.** AI otel dayatmaz; iyi olduğu yerde (niyet,
semt, fikir, karşılaştırma) konuşur.

## Onaylı kurallar (2026-10-08)

| # | Kural | Not |
|---|---|---|
| K1 | **Pahalı + kişisel + kıyaslanan → niyet kartı. Ucuz + keşif → doğrudan öneri.** | Niyet: uçuş, konaklama, araç kiralama, şehirler arası ulaşım, sigorta. Doğrudan: deneyim, etkinlik, gezilecek yer, restoran, eSIM, ipucu. AI'nın otel adayları niyet kartının altında **kapalı** satırda ("✨ 3 aday ▾"), açık değil. |
| K2 | **Tutulacaklar asla gizlenmez, fikirler kısılır.** | Her ihtiyaç ayrı kart: "Ubud · otel", "Canggu · villa", "Uluwatu · otel". Ekran neyi tutmam gerektiğini söyler. Gizleme ("+N fikir") yalnız önerilerde. |
| K3 | **Öneri iki türlü: kaynaklı ya da AI fikri.** | Kaynaklı: link, fiyat, fotoğraf gerçek. AI fikri: etiketli, fiyatsız, linksiz olabilir ("15 gün tek yerde → aylık motor kirala"). Fiyat, saat, fotoğraf uydurulmaz. |
| K4 | **Soru sırası = en çok kartı açan bilgi.** | Tarih (uçuş + konaklama + etkinlik + eSIM + sigorta açar) → bütçe/tarz → şehir dağılımı → diğerleri. Çelişki varsa önce o ("3 hafta mı 15 gün mü?"). |
| K5 | **Her cevap panoda görünür bir değişiklik yaratır.** | Kart yerinde dönüşür ve kısa parlar; sohbet ne değiştiğini tek satırda söyler ("Uçuşları 12–27 Mart'a tarihledim"). Minik animasyon, azaltılmış harekette yok. |
| K6 | **Her kartta "neden" satırı, kullanıcının kelimesiyle.** | "Direkt uçuş · lüks dediğin için", "Romantik akşam yemeği · Sabine'yle gittiğin için". Varsayım kaynağıyla görünür ve kapatılabilir. |
| K7 | **Fiiller sabit.** | Ekle (öneri → plan) · Ara ↗ (dış site) · Aday ekle (link/eklenti) · Seç · Rezerve ettim. "Onayla" yok. |
| K8 | **Öneri × ile tek tıkla gider; yenisi istenebilir.** | × kalıcı (Geçmiş'ten geri alınır). Bölümde "Yeni öneriler ↻". Eklenen öneri yerine benzer bir yenisi gelebilir. |

## Kartın hayatı

**Niyet kartı:** `Tarihsiz niyet → Tarihli niyet (arama linkleri canlı) → Adaylar (kullanıcının linkleri + ✨ AI
adayları, AI hakem satırı) → Seçildi → Rezerve ettim`.

**Öneri kartı:** `Fikir (soluk, plana sayılmaz) → Ekle (plana girer, güne yerleşebilir)` ya da `× (gider)`.

## Parçalar ve durum

| P | Parça | Durum (2026-10-08) |
|---|---|---|
| P1 | Prompt → niyet okuma (kim, ne zaman, tür, kısıtlar) | ✅ kurulu (başlatma sohbeti, model kalıbı 0.36.50) |
| P2 | Oluşturma animasyonu | ✅ kurulu |
| **P3** | **Pano iskeleti: hangi kart, hangi tip, hangi sırada** | ⬅ **şimdi** |
| **P4** | **Niyet kartı ve durumları** (brief, neden, arama, aday tepsisi) | 🟠 boş kart var; brief, neden, durumlar yok |
| **P5** | **Öneri kartı: Ekle, ×, yeni öneriler, boşalan yer dolar** | 🟠 Viator/eSIM var; ×/yenile standardı yok |
| **P6** | **Sohbet = bilgi toplayıcı** (K4 soru sırası, K5 geri bildirim) | 🟠 sohbet var; soru önceliği ve parlama yok |
| P7 | Fikir standardı: gezilecek · restoran · ipucu · etkinlik · Google Maps | ❌ ayrı tasarım oturumu (Emre: "her biri ayrı konu, bir standart gerek") |
| P8 | Dışarıdan aday getirme (link yapıştır, eklenti) | ✅ eklenti var; niyet kartına bağlanacak |
| P9 | AI hakem: adayları kullanıcının kriterleriyle karşılaştırma | 🟠 CompareView, stayPicks var |
| P10 | Kişisel hafıza (geçmiş yol arkadaşı, kalıcı kısıt) | 🟣 akıllı planlayıcı Bölüm E, Emre onayı bekliyor |
| P11 | İlham birikimi: AI'nın bulduğu blog, YouTube | ❌ sonra |
| T | Veri kaynakları (etkinlik API, yer/restoran fotoğrafı, sigorta) | ❌ teknik iş; akış kararından sonra |

## Sıra

1. **İlk ekran (P3 + P4 + P5 + P6):** sayfa sayfa UI çizimi → onay → spec → kod. Örnek gezi: "Bali'de sevgilimle,
   lüks" (+ "3 hafta / 15 gün" çelişkisi).
2. **Niyet kartının derin hâli (P4 açık + P8 + P9):** aday tepsisi, link ekleme, AI hakem.
3. **Fikir standardı (P7):** her fikir türü için tek kart dili.
4. **Veri kaynakları (T):** etkinlik ve yer kaynakları, sigorta; mevcut `offers` fonksiyonunun envanteri.
5. **Kişisel hafıza (P10)**, sonra **ilham birikimi (P11)**.

## Çizilecek sayfalar (1. adım)

| S | Sayfa | Ne gösterir |
|---|---|---|
| S1 | Görüşme | Soru sırası (K4), çelişki sorusu, kartların arkada belirmesi |
| S2 | Pano ilk açılış, tarihsiz | Tutulacaklar (ayrı niyet kartları) + fikirler; neden satırları; sayaç |
| S3 | Tarih verildi anı | 3 kare: cevap → kartlar dönüşür ve parlar → sohbet satırı |
| S4 | Niyet kartı açık | Brief, arama ↗, aday tepsisi, ✨ AI adayları kapalı satır |
| S5 | Öneri etkileşimi | Ekle, ×, yeni öneriler, boşalan yerin dolması |

## Kararlar (2026-10-08, ikinci tur)

- **K9 · Kategori sırası.** Plan kategori kategori dizilir (uçuşlar, konaklama, ulaşım, deneyimler, eSIM, sigorta).
  Yolculuk/gün sırası tek tıkla geçilen bir görünüm seçeneği; mevcut Gün gün akışı sonra iyileştirilir.
- **K10 · İlerleme hero'da.** Ayrı "Tutulacaklar" şeridi yok. Hero'nun mevcut barı "Bali planın şekilleniyor 0/8"
  gibi aşağıda olanı özetler.
- **K11 · AI bilmediğini değil anladığını yazar.** Kart "direkt yok" gibi eksik vurgulamaz; anladığı niyeti yazar.
  Tahminler sallama değil: gerçek gezilerden (ileride binlercesi incelenir) ve kişinin söylediklerinden çıkarım.
- **Örnek:** Bali'de 3 otel, Konaklama bölümünde 3 ayrı niyet kartı.
- **Çizim:** hero olduğu gibi; kategori bölümleri yeni tasarım. Durumlar artifact'te **yan yana**.
  v1: `docs/mockups/2026-10-08-ilk-ekran-v1.html` (artifact: https://claude.ai/artifact/33PEw3kW1YxgG3doRvtrDt),
  üç kare: prompt sonrası · tarih verildi · adaylar toplandı. **Mobil referans olarak saklandı** (Emre: ürün
  şu an web eklentisi; mobile akış bitince geçilir). Sıradaki çizim web: bugünkü hero aynen + altında yeni bölümler.

## Öneri: aşama modeli (2026-10-08, Emre onayı bekliyor)

Emre'nin taslağı: Niyet kartı → Fikir → Kalan fikirler → Plan → Booked. Öneri: iki katman.

- **İhtiyaç (niyet kartı)** yalnız pahalı/kıyaslanan için: "Ubud'da 5 gece". Bir aşama değil, kabın kendisi.
- **Seçenek** (otel, tur, restoran) üç aşamadan geçer: **Fikir → Plan → Rezerve**.
  - Fikir: AI önerdi ya da sen kaydettin; plana girmedi. Kaynağı yazar (Senin linkin / AI / Viator).
  - Plan: seçtin ya da ekledin; rezerve değil (bugünkü sarı-bej, amber).
  - Rezerve: alındı (yeşil, ✓, belge).
- **Kalan fikirler aşama değil, seçimin sonucu:** biri plana girince diğerleri "Diğer 2 aday" arkasına çekilir, geri alınabilir.
- Pahalıda: niyet kartı fikirleri (adayları) taşır; seçilince kart plan kartına döner. Ucuzda niyet yok: fikir → Ekle → plan.
- Senin kaydettiğin fikir, AI'nınkinden önce gelir.

**Web çizimi v1:** `docs/mockups/2026-10-08-asamalar-web-v1.html` (artifact: https://claude.ai/artifact/82iFjpDPKunLZWuUS4UDnV): bugünkü hero + yeni bölümler, sekmeler A–E + Aşamalar, üstüne gelince açılan arama linkleri ve aday eylemleri, aşama rayı, canlı aşama geçişi, hareketi duraklat.

**Başlangıç yolları** (her biri ayrı sayfa çizilecek): A) yalnız prompt · B) prompt + sohbet · C) biriktirilmiş
linklerle başlama · D) sohbetten sonra link gönderme ("bunları da taslağa koy").

## Kararlar ve öneriler (2026-10-08, üçüncü tur) · web v2

Çizim: `docs/mockups/2026-10-08-asamalar-web-v2.html` (artifact: https://claude.ai/artifact/RNFpDmw5B15yAT6S1jvRiy).

- **K12 · Aşama malzemeyle okunur, yazıyla değil** (Emre isteği). Arıyoruz = kesikli çerçeve + çizim + boş çember;
  Adaylar var = arkada deste (üst üste kart) + lavanta; Seçildi = çizim gerçek fotoğrafa döner + amber;
  Rezerve = yeşil + mühür + ✓ çember. Kart altındaki aşama rayı kalktı.
- **K13 · Uçuş niyeti biniş kartı:** onaylı uçuş kartının (şehir · noktalı uçak silüeti · şehir) biniş kartı hâli;
  sağda yırtık koçan: aradığımız / önde aday / PNR.
- **K14 · Kimden geldiği yüzle:** "Senin linkin" yazısı yerine profil yuvarlağı (E, S); AI ✨ yuvarlağı.
- **K15 · Plan sade, adaylar Pano'da (öneri):** Plan'da her ihtiyaç tek kart; adaylar kartın içinde listelenmez,
  "N aday · önde X · Panoda karşılaştır →" satırı. Pano = karar odası: ihtiyaca göre kolonlar, uyum puanı, kişi
  oyları, "Yerleşmeyenler" (rotada olmayan otel, YouTube/ilham). Eklentiden gelen her link önce Pano'ya düşer.
- **K16 · "Kendin ara" her niyet kartında önde** (farkımız). AI adayı ikincil.
- **K17 · Gezinin şekli şeridi:** hero ile bölümler arasında rota: İstanbul ✈ Ubud · Seminyak · Uluwatu ✈ İstanbul,
  her durak aşama malzemesinde, etkinlikler üstünde. Tek bakışta "nasıl bir seyahat".
- **Fikirler rafı:** deneyim/yapılacak/restoran tek bölümde; planda olanlar satır, fikirlerden 4'ü raf, fazlası Pano'da.

## Kararlar ve öneriler (2026-10-08, dördüncü tur) · web v3

Çizim: `docs/mockups/2026-10-08-asamalar-web-v3.html` (artifact: https://claude.ai/artifact/2MccVeWm8VbLgZpvuZuxvM).

- **K18 · Niyet kartı bir kutucuk.** Öneri ya da Pano kaydı kutunun İÇİNE yerleşir; "3 aday" destesi kalktı.
  Kutuda en fazla **tek** AI önerisi durur (Yerleştir / ×); diğerleri Pano'da. Kutu dolunca kart "Seçildi" olur.
- **K19 · Aşamaya göre bilgi.** Boş: AI'nın anladığı (semt, şartlar, neden) + Kendin ara. Öneri/Seçildi: karar bilgisi
  (toplam, ücretsiz iptal, puan, kaç şart tutuyor). Rezerve: yol bilgisi (giriş-çıkış saati, adres, ödeme, onay; uçuşta
  PNR, koltuk, check-in günü).
- **K20 · Plan ↔ Pano:** Pano'dan sürükle-bırak ya da "Plana ekle"; uyan kutu yanar, kayıt yerleşir, Pano'da "Planda"
  olur. Kutudaki ↩ kaydı Pano'ya geri gönderir. Yan panel iki sekme: Asistan | Pano.
- **K21 · Fikirler (deneyim, yemek):** kare kartlar; × anında atar (geri alınabilir), "Plana ekle" satıra çevirir.
- **K22 · Ulaşım kutuları da öneri alır**; belirsizse sohbet sorar ("villa mı alacak, transfer mi?").
- **K23 · "Senin linkin" kelimesi yok;** yalnız yüz (E, S) ve "AI önerisi".
- **K24 · Pano sayfası Emre'nin onaylı görselini izler** (kategori sekmeleri, kart, oylar, yorum, favori).
- Gezinin şekli: İstanbul ✈ [Bali · Ubud · Seminyak · Uluwatu] ✈ İstanbul.
- İlke: kart her şeyi kendisi yapmaya çalışmaz; ince ayarlar sohbetten ("başka öner", "daha ucuz").

## Kararlar ve öneriler (2026-10-08, beşinci tur) · web v4 · Ozora senaryosu

Çizim: `docs/mockups/2026-10-08-ozora-web-v4.html` (artifact: https://claude.ai/artifact/MqMrbPTUpXRMXvxjupwcES).

- **K25 · Seçim penceresi (K20'nin yerine).** Yan panelden sürükleme yok. Kutuya basınca o kutunun penceresi açılır:
  "Kaydettikleriniz" (kim ekledi yüzüyle) · "AI önerisi" · "Kendin ara" · "Pano'da karşılaştır". Her satırda AI'nın
  yorumlardan çıkardığı tek not. "Seç" kutuyu doldurur; seçiliyken aynı pencerede başka birini seçmek = fikir değiştirmek.
- **K26 · Kutuda kayıt listesi yok;** yalnız "N fikir" + kaydedenlerin yüzleri. Ayrıntılı karşılaştırma Pano'da.
- **K27 · Seçildi ≠ Rezerve, kart sade.** Boş: ne/nerede/neden. Seçildi (amber): kararın adı büyük, tek satır fiyat,
  tek eylem "Rezerve et ↗" + "Değiştir". Rezerve (yeşil + mühür): tek satır kanıt (bilet no, PNR, giriş saati).
  Geri kalanı pencerede.
- **K28 · Yolculuk şeridi sade:** durak, gece sayısı; ayrıntı üstüne gelince açılan kartta. Etkinlik etiketleri kalktı.
  Hop'larda küçük uçak/otobüs yürür.
- **K29 · Aşama geçiş hareketi:** seçince uçak silüeti kalkış yapar, çizim/fotoğraf düşer, etiket zıplar; rezervede
  mühür basılır. Duraklat düğmesi ve azaltılmış hareket tercihine uyar.
- **Ozora (festival oyun kitabı) doğrulaması:** tur yok; festival bileti kutusu; uçuş Budapeşte'ye; Budapeşte → Ozora
  ulaşımı sohbetle (minibüs / festival otobüsü); kamp kutusu otel önermez; Türk pasaportu için Schengen vizesi +
  sigorta (€30.000 teminat) kendiliğinden; "Yanına al" listesi (kimin getirdiği); grup: 6 kişinin yüzü.

## v5 · toparlanmış hâl ve veri sözleşmesi (2026-10-08, altıncı tur)

Çizim: `docs/mockups/2026-10-08-ozora-web-v5.html` (artifact: https://claude.ai/artifact/D1nQqnWR8VXLr4twnVequS).

- **K30 · Kart düzeni tek kural:** üst = tür + tarih + durum etiketi; orta = ne olduğu (boşta niyet, seçilince adı);
  alt = **solda bilgi, sağda tek eylem**. Boş: "N fikir · yüzler" / "Seçenekler ›". Seçildi: fiyat / "Rezerve et ↗".
  Rezerve: tek satır kanıt / "Ayrıntı ›". Kartın kendisine basmak = pencere (fikir değiştirme, rezervasyon ayrıntısı).
- **K31 · Seçim penceresi = küçük karşılaştırma** (bugünkü Karşılaştır'dan): üstte "Senin için" özeti (AI yorumu düşük
  ağırlıklı), her seçenekte uyum puanı, tek rozet (Önerim · Bagajla en ucuz…), yalnız bunda artı/eksi, kim kaydetti
  (yazıyla, fotoğrafın üstünde değil), kim beğendi, toplam fiyat. Rezervede üstte rezervasyon ayrıntısı.
- **K32 · Pano = çalışma masası:** aynı kart dili; kategori seçilince "Senin için" özetleri; tablo görünümü bugünkü
  kriter tablosu. Kişi yüzü fotoğrafın üstünden kalktı, kart altına "X kaydetti" oldu.
- **K33 · Sabit şablon, değişen içerik.** Bölüm türleri hep aynı: Etkinlikler · Uçuş · Konaklama · Ulaşım · Vize ve
  sigorta · Hazırlık · Fikirler. Oyun kitabı yalnız hangi kutuların açılacağını, sırasını ve "Gezinin sebebi" iğnesini
  seçer. Festivalde bilet Etkinlikler'de iğneli; Bali'de aynı bölümde Kecak, Legong. Yeni kutu türü yok.
- **K34 · Hazırlık her gezide var** (öneri listesi, kimin getirdiği, ileride Amazon/ortaklık linki; Pano'da da kayıt
  olabilir).
- **K35 · Yolculuk şeridi kaydırmaz,** en çok 4–5 durak; aradaki taşıt kutulardan türetilir (elle yazılmaz), böylece
  "Ozora → İstanbul otobüs" gibi hata yapısal olarak çıkmaz.
- **K36 · Yalnız prompt sonrası AI arıyor:** kutularda "AI arıyor" ışıltısı, sohbette "bakıyorum…" satırı; bulundukça
  "N fikir" dolar.
- **Rezerveden sonra:** uçuş günü kutuları (tahmini kalkış, check-in masası, kapı; AeroDataBox) aynı kartın içine eklenir.

### Veri sözleşmesi (API'ye bağlarken tasarım değişmesin diye)

Bugünkü tipler zaten buna yakın: `ItemStatus = saved | chosen | booked | dismissed` (`src/lib/types.ts`),
`Need` / `Offer` (`src/lib/offerSource.ts`). Ekranın tek ihtiyacı:

```
Slot (kutucuk = Need)    { id, section, kind: event|flight|stay|move|doc, title, place, dates, people,
                           why, pinned?, selfSearch: [{brand, url}], optionIds[], chosenId?, state }
  state                  türetilir: chosenId yok → "bos" · chosen → "plan" · booked → "rez"
Option (Pano kaydı = Item/Offer)
                         { id, slotId, source: user(personId)|ai|provider, brand, url, name, sub, price,
                           total, unit, score?, badge?, plus?, minus?, reactions{up[],down[]}, status }
Booking (rezervasyon)    { optionId, proof (tek satır), rows[{label, value}], document?, live?{gate, desk, eta} }
ForYou (AI özeti)        { slotId, optionId, text }   // düşük ağırlıklı, kaynağı belli
```

- Kart yalnız `Slot.state` + seçilen `Option` + `Booking.proof` okur; pencere `optionIds` + `ForYou` + `Booking.rows`.
- Yeni bir sağlayıcı (otel API'si, Viator, AeroDataBox) yalnız `Option` ya da `Booking.live` doldurur; bileşen değişmez.
- `score/badge/plus/minus` bugünkü karar motorundan (`decision.ts`, `proscons.ts`) gelir; yoksa satır gizlenir.

## v6 · çok şehirli Japonya (2026-10-08, yedinci tur)

Çizim: `docs/mockups/2026-10-08-japonya-web-v6.html` (artifact: https://claude.ai/artifact/FzeBGBSuCB2d4fR2GTiE6H).

- **K37 · Seçim penceresi sade:** puan, ad/saat, rozet, tek satır bilgi, kim kaydetti, beğenenler, toplam, Seç.
  Artı/eksi pencerede yok; Pano'da.
- **K38 · Pano karşılaştırması:** kayıtlar kutuya göre grupta (aynı ihtiyacın seçenekleri bir arada). Kartta
  "Neden? Artılar ve eksiler ▾" açılır (yalnız bunda etiketi, kriter değerleri, Ele). "Karşılaştır" görünümü aynı
  kutunun seçeneklerini yan yana tabloda gösterir, satırda en iyisi yeşil.
- **K39 · Favoriler:** kalp her kartta çalışır; kategori çubuğunda "Favoriler N" süzgeci.
- **K40 · ✨ AI'dan öneri:** boş kutunun altında küçük ✨ düğmesi, pencerede "Daha fazla öneri bul", Fikirler'de "Daha
  fazla fikir". Basınca soldaki sohbete eylem olarak düşer, AI arar, bulduğunu kutuya ve Pano'ya ekler, sohbette özetler.
- **K41 · Kart tıklanır olduğunu söyler:** altta "Seçenekler ›" + üstüne gelince kalkma; ayrı bir işaret gerekmiyor.
- **Hero önerisi (onay bekliyor):** rota hero'nun omurgası (her durak bir görsel kart, aşama çemberiyle), altında tek ve
  somut "Sıradaki adım" (ör. "Osaka: kalacak yer seç"), plan ve bütçe çubuğu, tek satır ülke bilgisi. Bu seçilirse
  ayrı yolculuk şeridi gerekmez.
- Çok şehirli doğrulama: açık uçlu uçuş (Tokyo'ya git, Osaka'dan dön), 4 konaklama, 5 tren kutusu, JR Pass notu,
  vize gerekmiyor notu, Japonya'ya özel hazırlık (IC kart, A priz, valiz kargosu).

## v7 · düzeltme turu (2026-10-08, sekizinci tur)

Çizim: `docs/mockups/2026-10-08-japonya-web-v7.html` (artifact: https://claude.ai/artifact/786cXmvhkv7NK8rNFpHPL3).
v6'da onaylı kararların bir kısmı kaybolmuştu (ucuz deneyimlerin kare fikir rafı, niyet kartında Kendin ara ve
etiketler, uçuşun en üstte olması). Geri getirildi; aşağıdaki liste bundan sonra her çizimden önce kontrol edilir.

### Her çizimde değişmezler (kontrol listesi)
1. Hero = bugünkü v9 (Emre'nin önerilen hero'yu istemedi). Altında gezinin şekli şeridi.
2. Bölüm sırası: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Gezilecek ve yemek · Belgeler ve internet · Hazırlık.
   Bölümler açık gelir; başlığa basınca kapanır.
3. Pahalı = kutucuk (niyet). Biletli etkinlik/tur = kare fikir + "Plana ekle" → "Bilet al ↗ / Aldım". Gezilecek
   yer ve yemek = şehre göre kayıt listesi ("Güne koy", ×), plana ve sayaçlara girmez. eSIM = doğrudan ekle.
8. Hero bilgi satırı bugünkü gibi ikonlu ve ayraçlı (para · priz · saat farkı · dil); hero değiştirilmez.
9. Kaydettikleriniz kartta görünür; AI önerisi ▾ altında. Seçildi kartında "Aldım" (linke gitmeden rezerve).
4. Boş niyet kartında: ne/nerede/neden + istek etiketleri + Kendin ara linkleri (farkımız).
5. Aşama malzemesi: kesikli = arıyoruz, amber = seçildi, yeşil + mühür = rezerve. Alt satır: solda bilgi, sağda tek eylem.
6. Kimden: yüz (E, S) ve "AI önerisi"; "senin linkin" yazısı yok.
7. ✨ ile AI'dan öneri sohbete düşer, bulduklarını kutuya ve Pano'ya ekler.

### Bu turda eklenenler
- **K42 · Kart içinde açılan seçenekler:** boş kutunun altında "▾ 3 seçenek" (önce sizin kaydettikleriniz, sonra AI);
  hızlı Seç. Karta basmak = hepsinin olduğu pencere ("Hepsini karşılaştır").
- **K43 · Bölümler açılır/kapanır**, başlıkta renkli ikon karesi, sayı, aşama çubuğu ve bütçe ("€2.690 / €3.600 ayrıldı").
  Kapalıyken başlık tek başına durumu söyler.
- **K44 · İlk mesajla gelen linkler:** her link Pano'ya düşer ve kutusuna bağlanır; sohbette linkin yanında "→ Kyoto"
  yazar. Kullanıcı "bunu seçtik" dediyse kutu doğrudan Seçildi olur; demediyse seçenek olarak kartın listesine girer.
- **K45 · Pano:** "Tümü" ilk ve varsayılan (her kartta hangi ihtiyaca ait olduğu yazar). Kategori seçilince 2+
  seçenekli ihtiyaçlar grup, tek seçenekliler tek ızgarada ("alt alta iniyor" sorunu bitti). Buton "Plana koy", altında
  "Gider: Kyoto · 5 gece"; basınca kart amber çerçeve alır ve bildirimde "Plan'da gör" o kutuya götürür.
- **K46 · Karşılaştırma satırları üç parça:** (a) *Herkes için*, türe göre sabit çekirdek (uçuş: toplam, saat, süre,
  aktarma, bagaj; konaklama: toplam, gecelik, puan, semt, ücretsiz iptal; ulaşım: toplam, süre, ayırtma). Sağlayıcı
  bu alanları doldurur; bilinmeyen "—". (b) *Senin şartların*, kişinin tercihlerinden (`intent.musts`): ✓ var · ✕ yok ·
  ? sayfada yok. (c) *Yorumlardan*, artı/eksi, "yalnız bunda". Yeni bir konaklama türü ek alan getirirse (b)'ye düşer,
  tablo bozulmaz.
- **K47 · Hazırlık:** üstü çizilmez; işaretlenen "Hazır" grubuna taşınır. Sohbetten "şunu da ekle" ile büyür;
  izleme (gezi sırasında) ayrıca ele alınacak.

## v8 (2026-10-08, dokuzuncu tur)

Çizim: `docs/mockups/2026-10-08-japonya-web-v8.html` (artifact: https://claude.ai/artifact/FWoTzxBwqMbNwCdKuSEoHR).

- **K48 · Kaydettikleriniz kartta görünür:** "Kaydettikleriniz · 2 · buradan seçip kutuyu doldur" bloğu, ilk gelişte
  kısa parlama. AI önerileri "▾ N AI önerisi" altında. Uçuşta da aynı.
- **K49 · Fiyatı olmayan link:** "Fiyat linkte ↗" (tarihsiz kaydedilmiş sayfa); karşılaştırmada "—", en ucuz hesabına girmez.
- **K50 · "Aldım":** Seçildi kartında ve biletli etkinlikte "Rezerve et ↗"nin yanında. Basınca Rezerve; belge zorunlu
  değil, rezerve kartta "Belge ekle". Onay maili gelirse otomatik bağlanır.
- **K51 · Etkinlik ve turlar ≠ Gezilecek ve yemek:** biletli/rezervasyonlu olanlar (GetYourGuide, Viator, resmî bilet)
  aşama alır ve bütçeye yazılır. Gezilecek yer ve yemek bir kayıt listesi: şehre göre, "Güne koy" yalnız günü
  işaretler (Gün gün'de görünür), plana ve ilerlemeye sayılmaz. Bugünkü DESIGN.md kuralıyla aynı ("günü olmayan fikir
  eksik plan değildir").
- **K52 · Bölümler açık gelir;** kapatmak kullanıcının seçimi.

## v9 · canlıdan denetim + son toparlama (2026-10-08, onuncu tur)

Çizim: `docs/mockups/2026-10-08-japonya-web-v9.html` (artifact: https://claude.ai/artifact/HyPVPBTxmpp1NnkzS7WY9U).
v8'in tasarımı korunarak yalnız aşağıdakiler eklendi.

### Canlıda olup çizimde olmayanlar (denetim: README, DESIGN.md, aşamalar/belgeler/eksikler/hızlı-ekle spec'leri)

| Canlıdaki özellik | Karar |
|---|---|
| Kartta × ile kaldır + 8 sn Geri al; "Gerek yok" / Gizlenenler | **v9'a girdi** (K53) |
| Aşama silme kuralları: rezerve/hazır silerken sor, "İptal ettim", Değiştir uyarısı | **v9'a girdi** (K54, K56) |
| Hazır = rezerve + belge; "Belge eksik"; Belgeler sekmesi | **v9'a girdi** (K55): kartta belge çipi ya da amber "Belge eksik" |
| Rezerve karta basınca ayrıntı (PNR, saat, belge) | **v9'a girdi** (K56), etkinlik biletleri dahil |
| Fikir havuzu: hızlı yazma, durum sekmeleri, Harita, Yaptım, öğünlü + Gün | **v9'a girdi** (K57) |
| Google Maps'ten kaydedilenler panoda | **v9'a girdi** (K58): Pano'da Yerler, Etkinlik, İlham |
| İlham (Reels, TikTok, YouTube, blog) | **v9'a girdi**, küçük bölüm (K59) |
| "+ Ekle" şablonları (uçuş, tren, otel, restoran, not) | **v9'da düğme** var; pencere bugünkü gibi kalır |
| Hazırlıkta işaretlenen aşağı kaçıyordu | **v9'da düzeldi** (K60) |
| Kişiye özel rozet ("Sabine'in bileti") | Sonra: veri sözleşmesine `forWho` eklenir, çizim değişmez |
| Satır içi düzenleme (adı, saati yerinde düzelt) | Sonra: kodda zaten var, ayrıntı penceresine "Düzenle" girer |
| ⏳ ücretsiz iptal son günü uyarısı | Sonra: hero sohbet balonunda var ("ücretsiz iptali 1 Mart'a kadar"), kart rozeti spec'te |
| Oylar (👍/👎) ve paylaşım kodu | Sonra: Pano kartındaki tepkiler zaten var; paylaşım ayrı parça |
| Gece blokları "Gerek yok" | Kapsandı: K53'ün aynısı |
| PDF plan indirme | Kapsandı: hero %100 olunca ana buton (canlıdaki gibi), çizime dokunmadı |
| Aynı şey iki kez kaydedilince "Birleşik kalsın / Ayrı tut" | Kapsandı: sohbette kalır, çizim değişmez |

### Kararlar

- **K53 · Her plan kartında × (üstte, üzerine gelince görünür).** Arıyoruz/Seçildi kart hemen gider → bölüm sonunda
  "Gizlenenler · N göster" → "Geri getir"; ayrıca 8 sn "Geri al". Gizlenen kart sayaçlara ve yüzdeye girmez.
- **K54 · Rezerve şey sormadan silinmez.** × → "Bu rezervasyon onaylı. İptal ettin mi?" (belgesi varsa "Belgesi
  Belgeler sekmesinde kalır"). Biletli etkinlikte de aynı. Belge hiçbir silmede kaybolmaz.
- **K55 · "Aldım" üstte.** Seçildi kartında sağ üstteki etiketin yerine "○ Aldım" hap düğmesi; alttaki satırda yalnız
  fiyat + "Rezerve et ↗". Etkinlikte de aynı. Geri al bildirimi var. Rezerve kartta belge çipi ya da "Belge eksik".
- **K56 · Rezerve karta basınca ayrıntı penceresi** (seçenek penceresi değil): marka + ad + saat, rezervasyon satırları
  (PNR, giriş/çıkış, seans, koltuk, bilet no), belgeler (Aç ↗ / Belge eksik · ekle), alt: Değiştir (önce "eskisini
  iptal ettin mi?"), İptal ettim (kart Arıyoruz'a döner, seçenekler durur, belge Belgeler'de kalır).
- **K57 · Gezilecek ve yemek = canlıdaki fikir havuzu.** Üstte hızlı yazma ("yer yaz ya da Maps linki yapıştır");
  sekmeler Hepsi · Havuzda · Günü var · Yapıldı; Gezilecek/Yemek süzgeci; şehre göre satır: ikon, ad (haritada
  açılır), kimden + "Maps'ten", "+ Gün" (yemekte öğünle), ✓ Yaptım; Harita ve × üzerine gelince.
- **K58 · Pano kategorileri:** Tümü · Uçuşlar · Konaklama · Ulaşım · Etkinlik · Yerler · Belgeler · İlham · Favoriler.
  Maps'ten atılan yer/restoran Yerler'de birikir ve Plan'daki Gezilecek listesiyle aynı kayıttır.
- **K59 · İlham** bölümü (en altta, küçük): video/gönderi kartı; bir güne konunca Gezilecek'e geçer.
- **K60 · Hazırlık:** işaretlenen yerinde kalır (yeşil kutu + "Hazır"); "Hazırları gizle" isteğe bağlı.
- **K61 · Ana buton sabit:** "Planı tamamla →" değişmez; altında küçük değişen ipucu "Sıradaki: Osaka · 3 gece için
  karar". Butona basınca o karta gider ve açar.

### Değişmezler listesine eklenenler
10. Her kartta × var; rezerve olan önce sorar; gizlenen Gizlenenler'den geri gelir.
11. "Aldım" Seçildi kartının üstünde; rezerve karta basınca ayrıntı + belgeler açılır.
12. Gezilecek ve yemek canlıdaki fikir havuzu düzeninde; Maps'ten gelenler Pano'da Yerler'de.

## v10 (2026-10-08, on birinci tur)

Çizim: `docs/mockups/2026-10-08-japonya-web-v10.html` (artifact: https://claude.ai/artifact/DwUUdUtHsswQX1vcWgUuhw).

- **K62 · Kart sabit, seçenekler altında.** Kaydettikleriniz ve AI önerileri artık kartın içinde açılmıyor. Kartın altında
  tek düğme: "(yüzler) 2 kaydettiğiniz · 1 AI önerisi ▾". Basınca kartın bulunduğu satırın altında tam genişlikte bir
  şerit açılır: seçenekler yan yana küçük kartlar (marka, kimden, ad, alt bilgi, fiyat, Seç), çok olunca yana kayar.
  Aynı anda tek şerit açık; açık kartın çevresi mor. 10 link de gelse kartın boyu değişmez. (K48'in yerine geçer.)
- **K63 · "Gezilecek ve yemek" → "Yapılacak şeyler".** Etkinlikler gibi kare (görsel, kimden, ad, şehir · not).
  Süzgeç: Hepsi · Gezilecek yerler · Restoranlar. Karede tek düğme "Plana ekle" → "Planda" (yerinde kalır). Gün
  seçimi burada yok; Gün gün'de yapılır. İlk kare "Yer ya da restoran ekle" (ad yaz ya da Maps linki yapıştır).
  Bilet istemez, sayaçlara girmez. (K57'nin sekme/gün/Yaptım kısmı kalktı.)
- **K64 · "Belgeler ve internet" → "Sigorta ve internet".** Belgelerin kendi sekmesi zaten var. Sigorta ve eSIM aynı
  çerçevede iki kutucuk: ikisi de "birini seç" kararı. eSIM'in de seçenekleri var (Airalo, Ubigi, Holafly).
  "Vize gerekmiyor" bilgisi Hazırlık'ın en üstüne taşındı.
- **K65 · Pano:** geniş ekranda satırda 4 kart; görsel 4:3 ve büyük; kartta yalnız ihtiyaç, ad, tek satır alt bilgi,
  fiyat + tek düğme. Fiyat/düğme satırı ve alt satır (kimden · beğeni · Neden?) her kartta aynı hizada. "Gider: X"
  satırı kalktı; kartın üstündeki ihtiyaç adı aynı işi görüyor. Kategoriler: … Etkinlik · Yapılacak · Sigorta ve eSIM.
- **K66 · Hero yan kartı canlıdaki gibi:** bloklar kartın boyuna eşit dağılır; Yen · priz · saat · dil 2×2, çiftin
  arasında ince çizgi; hava "Tokyo ☀ 17° | Kyoto ☀ 18°" ayraçlı.
- **K67 · "Sıradaki" ipucu kalktı** (K61 geri alındı): sırayı sohbet söyleyecek. "Planı tamamla →" sabit.
- Küçük temizlik: rezerve kartta "· belgeli" etiketi kalktı (belge çipi zaten söylüyor); uçuşta PNR iki kez yazmıyor;
  kanıtı olmayan rezerve kartta altta ikinci "Rezerve" yok; mühür başlığın üstüne binmiyor; dar kartta alt satır kırılıyor.

### Değişmezler listesinde güncellenenler
3. → Biletli etkinlik/tur kare + "Plana ekle" → "Bilet al ↗ / Aldım". Yapılacak şeyler (yer + restoran) kare + "Plana
   ekle", gün yok. Sigorta ve eSIM kutucuk.
8. → Hero yan kartı canlıdaki gibi (2×2 küçük bilgiler, ayraçlı hava).
9. → Kaydettikleriniz ve AI önerileri kartın altında açılan şeritte; kart sabit. Seçildi kartında "Aldım" üstte.

## v11 (2026-10-08, on ikinci tur) · tasarım skill'iyle eleştiri + hızlı kazanımlar

Çizim: `docs/mockups/2026-10-08-japonya-web-v11.html` (artifact: https://claude.ai/artifact/1N3e2uUJpJRif952stNXSf).
Eleştiri: impeccable critique (bağımsız tasarım incelemesi 26/40 + dedektör). Dedektörün yıllardır çıkan iki
"düşük kontrast" uyarısının kaynağı bulundu: koyu temada `.switch h1` ve `.pfoot` için dedektörün rengi çözememesi
(sahte). İki satırla susturuldu (`.switch h1 { color: var(--ink) }`, `.page { background: var(--bg) }`), dedektör temiz.

- **K68 · Kartın altındaki şerit kalktı (K62 geri alındı).** Arıyoruz kartının altında yalnız kimin eklediği (yüzler, AI
  ✨) ve "3 seçenek ›". Basınca onaylı seçim penceresi açılır. Pencerede sizin kaydettikleriniz üstte; AI'nın bulduğu
  "alternatif" ayrı, kesikli lavanta çerçevede ve "sizin linklerinizin dışında" diye açıklanır. Eşit yan yana durmuyorlar.
- **K69 · Yapılacak şeyler'de ekleme karesi yok:** giriş kanalı sohbet. Alttaki not "sohbete yaz" der; Maps'ten
  kaydedilen kendiliğinden düşer.
- **K70 · Pano ↔ Plan çift yönlü:** Pano'da planda olan kartın görselinde "✓ Planda / Rezerve" etiketi, düğmesi
  "Plan'da gör →" (Plan'a geçer, kart parlar). Grup başlığında "Seçildi: X · Plan'da gör →". Plan'da Seçildi kartının
  altında "Pano'da 2 alternatif" → Pano o grupla açılır, grup çerçevelenir, üstte "← Plan'a dön".
- **K71 · Beğeni tek:** kalp = beğen; kartın altında beğenenlerin yüzleri (E, S). Ayrı başparmak sayacı kalktı.
  "Favoriler" sekmesi → "Beğenilenler" (en az bir kişinin beğendiği).
- **K72 · Pano araçları:** üstte durum "Hepsi · Karar bekleyen · Planda" ve "Sırala: Bize en uygun · En ucuz · En çok
  beğenilen · En yeni eklenen". Uzun başlık 2 satırda kesilir, tamamı üzerine gelince; görsel kutuya sığar, beyaz
  zemin karta karışır; uyum puanı kesilmez ve "Tercihlerinize uyum" açıklaması var.
- Küçük: üstteki "Pano N" sayısı sayfadaki kayıt sayısıyla aynı; bölüm başlığında "—" yerine "€0"; uçuş görselinde yay
  iki şehrin arasında; dar ulaşım kartında mühür küçük ve altta.
- **Açık kalan (eleştiriden, Emre'ye sorulacak):** hero altındaki "Plan · Gün gün · Belgeler" sekmeleri ile üstteki
  "Plan · Gün gün · Pano" iki ayrı sekme çubuğu; aynı iş için üç fiil ("Seç", "Plana koy", "Plana ekle").

## v11 onaylandı → spec (2026-10-08)

Emre: "Onaylıyorum" (v11 + tek sekme çubuğu Plan · Gün gün · Pano · Belgeler + her yerde "Plana koy").
Spec: `docs/superpowers/specs/2026-10-08-plan-pano-v11-design.md` (koda bağlama, veri alanları, 6 faz, test).
Spec için Emre'den bekleyen: Harita sekmesinin yeri, bölüm bütçesi, faz sırası.

## Faz 1 yayında: 0.36.56 (2026-10-09)

Tek sekme çubuğu hero'nun üstünde (Plan · Gün gün · Belgeler; Harita Gün gün'ün içinde), bölümler yeni sırada
(Etkinlik ve turlar · Yapılacak şeyler restoranlarla · Sigorta ve internet · Hazırlık kendi bölümü, vize satırı ilk),
hepsi açık gelir, başlıkta aşama sözleri. Unit 1677/1677, e2e yeşil. Sıradaki: Faz 2 (kartlar).

## Faz 2a yayında: 0.36.57 (2026-10-09 gece) + K73

- "Plana koy" her yerde; "✓ Aldım" planlanan kartın üst satırında; × = "Gerek yok" (rezervede önce sorar, panonun
  kendi penceresi).
- **K73 · Vize belgelerin yanında (Emre, 2026-10-09: "Belgeler sanki yerinde daha iyiydi … Vizesiz 90 gün yazması hoşuma
  gitmişti"):** bölümün adı yine "Belgeler ve internet"; ilk satırı vize. Gerekmiyorsa yeşil ve öne çıkan "✓ Vize
  gerekmiyor · Türk pasaportuyla 90 güne kadar"; gerekiyorsa amber, resmi kaynak linki ve işaretlenebilir "Vize alındı".
  K64'ün "vize Hazırlık'a" kısmını geri alır. Değişmezler listesine: vize satırı Belgeler ve internet'in ilk satırı.
