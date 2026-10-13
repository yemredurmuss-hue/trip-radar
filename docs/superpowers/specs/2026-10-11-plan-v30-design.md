# Plan ve Pano v30: türe göre şekillenen sabit şablon, sakin kartlar, iki sekme (2026-10-11)

Emre onayladı ("Tamam bunu onaylıyorum artık", 2026-10-11).

- **Çizim:** `docs/mockups/plan-v30/index.html`. Tek dosya; illüstrasyonlar içine gömülü.
  - İki gezi var: **Japonya** (klasik tur) ve **Ozora** (festival).
  - Japonya'nın senaryoları: A Yalnız prompt · B Prompt + linkler · C Karar ve rezerve · Pano.
  - Çizimin üstündeki **Zaman** düğmesi (Bugün · Yaklaşınca · Uçuş günü · Rötar · İndi) yalnız çizim içindir. Zamana bağlı gösterimi denemek için konuldu.
- **Ara turlar:** `plan-v12` … `plan-v29`, her biri `devam` dalında ayrı commit. Menü karşılaştırması: `docs/mockups/menu-alternatifleri/index.html`.
- **Önceki spec:** canlıdaki v11, `2026-10-08-plan-pano-v11-design.md`. Bu spec onun yerine geçer; v11'de olup burada yazmayan her şey **"Koda geçerken korunacaklar"** bölümüne tabidir.
- **Kararların tarihçesi:** `docs/urun-yol-haritasi.md` (K1–K75). Bu turun kararları aşağıda; yol haritasına K76 ve sonrası olarak işlenecek.

## Sorun

v11 canlıda çalışıyor ama dört derdi var:

- **Kartlar yazı yığını.** Uzaktaki bir gezide bile check-in, PNR, iptal tarihi gibi satırlar aynı anda görünüyor.
- **Kaynak okunmuyor.** Otel ve ulaşım kartında kaynak küçük bir harf karesi.
- **Seçenekler sıkışık.** Seçim penceresi ya da kartın küçük arka yüzü karar vermeye yetmiyor.
- **Şablon tek kalıp.** Şehir + otel + etkinlik dışında bir gezi (festival, dalış, safari) bu kalıba zorlanıyor: Ozora'ya otel öneriliyor.

Ayrıca üstte dört sekme var, kaydırınca beliren özet şeridi karışık, Pano 57 kartlık tek bir yığın.

## Değişmezler (her fazda korunur)

1. **Bölümler her gezide aynı ad ve sırada:** Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Yapılacaklar ve restoranlar · Belgeler ve internet · Hazırlık · İlham. Gezi türü yeni bölüm açmaz, bölüm adı değiştirmez, sıra değiştirmez.
2. **Gezi türü yalnız içeriği değiştirir** (K33). Türün değiştirdikleri: hangi kartların açılacağı, "Gezinin sebebi" kartı, kapalı öneriler, konaklamanın türü, hazırlık listesi, belgeler.
3. **Aşamalar:**
   - Arıyoruz: renksiz, kesikli.
   - Seçildi: açık yeşil, kesikli.
   - Rezerve: koyu yeşil, düz, damgalı.
   - Ayarlandı (yeni): gri, düz, "Kendin ayarladın".
   - Durum asla yalnız renkle anlatılmaz; yanında hep yazısı olur.
4. **Kart boyu sabit.** Aynı sıradaki kartlar eşit boyda; alt şerit (fiyat · düğme) hep en altta. Uzun metin kartı büyütmez (bkz. Uzun metin).
5. **Fiyat, saat ve gerçek uyarılar asla saklanmaz.** Yalnız hatırlatmalar ve numaralar zamanını bekler (bkz. Zamana göre gösterme).
6. **Kaynaklı ya da AI fikri** (K3). Fiyat, saat ve fotoğraf uydurulmaz. Tahmini fiyat yalnız kaynaklardaki en az 3 gerçek tekliften çıkar.
7. **Kimden:** yüz (E, S) ve "Önerimiz". Kaynak markası okunur etiketle yazılır (bkz. Marka).
8. **Hero** bugünkü v9'un içeriğiyle kalır. Yalnız parçaları gezinin kendi bilgisinden gelir: ülke, şehirler, hava, para birimi, priz, saat farkı, dil, bütçe, tercihler.

## Ekran ekran

### Üst çubuk ve gezinme

- **Sekmeler:** yalnız iki sekme var: **Plan · Pano (sayı)**. "Gün gün" ve "Belgeler" sekmeleri kalkar.
- **Gün gün:** planın üçüncü görünümü olur: Kategoriye göre · Yolculuk sırasıyla · Gün gün.
- **••• gezi menüsü:** sağ üstte; içinde Belgeler (tüm belgeler tek liste) · Paylaş · PDF olarak indir · Geçmiş.
- **Pano'ya kart arkasından gitmek:** kartın arka yüzündeki "Pano'da aç", Pano'yu o ihtiyaca odaklanmış açar ("← Plan'a dön" ile geri). Sağdan açılan çekmece fikri sonraya kaldı (Açık kararlar 3).

### Yapışkan özet şeridi

Hero ekrandan çıkınca sayfanın en tepesine yapışır: tam genişlik, opak, boşluksuz; arkası görünmez. Soldan sağa:

- **Kapak ve ad:** kapak küçük resmi; gezinin adı; tarih ve "N gün kaldı".
- **Halka:** "%77 hazır". Koyu yeşil rezerve, açık yeşil seçildi. Ayrıntısı üstüne gelince görünür: "6 rezerve · 4 seçildi · 3 karar bekliyor".
- **Bütçe:** tek satır: "~€7.347 / €9.000". Bütçeye sığıyorsa yeşil, aşıyorsa kırmızı nokta.
- **Plan | Pano geçişi.**
- **"Sıradaki: Osaka konaklaması →":** o karta götürür. Hepsi bittiyse "✓ Her şey hazır".

Dar ekranda sırayla gizlenir: önce "hazır" yazısı ve ayırıcılar, sonra bütçe ve kapak. "Sıradaki" düğmesi kısalır.

### Gezinin şekli şeridi

Duraklar `LEGS`'ten türer (elle yazılmaz). Aradaki taşıt ikonu ulaşımdan gelir: uçak, tren, araba, gemi.

### Kart şablonları

**Uçuş (bilet):**
- Havayolu logosu, adı ve sefer numarası.
- **Planda şehir büyük**; kod ve saat küçük; ertesi güne geçerse "+1".
- Ortada kavisli kesikli rota ve beyaz dairenin içinde uçak. Aktarmada rotanın tepesinde durak noktası, uçak kenara kayar. Altında süre ve "Direkt / 1 aktarma · Doha".
- Boş uçuşta rotanın yerinde uçak illüstrasyonu.
- **Koçan:**
  - boş: tahmini aralık
  - seçildi: kişi başı ve toplam
  - rezerve: "Rezerve · €1.960 · 2 yolcu"
  - PNR yalnız uçuş günü.
- **Seçenekler karşılaştırılırken** (kartın arkası, Pano) saat büyük kalır.

**Konaklama** (Booking/Airbnb düzeni):
- Üstte kenardan kenara kısa görsel bant (~3:1). Görsel: kaynağın fotoğrafı; yoksa türün illüstrasyonu (otel, ev, çadır, karavan), kırpılmadan.
- **Bilgi sırası:**
  - marka etiketi ve semt
  - büyük ad
  - puan rozeti + söz + yorum sayısı. Booking'de "9,0 Muhteşem · 770 yorum", Airbnb'de "★ 4,9 Misafirler çok sevmiş".
  - tarih, gece sayısı ve bir artı
  - iptal satırı
- **Fiyat:** sağ altta, düğmenin yanında. "€420 / gece" büyük, altında "€840 toplam" küçük.

**Ulaşım:**
- Solda büyük taşıt illüstrasyonu. Seçeneğin adından seçilir: tren, otobüs, araba, taksi, vapur, karavan.
- **Satırlar:**
  - büyük "Hakone → Kyoto"
  - marka etiketi + "Shinkansen Hikari · ~2 sa · 8 Nis"
  - küçük "10:12 Odawara → 12:10 Kyoto istasyonu"
- Kiralık arabada saat yerine "Al 25 Tem 09:45 · Havalimanı → bırak 2 Ağu · Deák tér" satırı.
- **Fiyat ve düğme:** sağda. "Bilet al ↗"; bilet gerekmiyorsa "Bilet gerekmez".

**Boş ulaşım** (model nasıl gidileceğini bilmiyorsa):
- Kartta "Kyoto → Osaka · Nasıl gideceğin belli değil".
- Altında illüstrasyonlu seçimler: Tren · Otobüs · Araba · Uçak · Ben hallettim. Birine basınca o yolla aranır.

**Etkinlik ve turlar:**
- **Kart:** kare görsel; ad (2 satır); marka etiketi + şehir; tek fiyat (2 kişi toplam).
- **Planda (bizim önerilerimiz):** köşede ✓ gelir; ✓'e basınca plandan çıkıp Pano'ya gider. Alt şeritte "✓ Bilet aldım" (yazılı) ve "Bilet al ↗" yan yana.
- **Pano'daki diğerleri:** kesikli, + ile ve "Plana ekle" düğmesiyle.
- **Gezinin sebebi:** bu bölümün ilk kartıdır (bkz. Gezi türü).

**Yapılacaklar ve restoranlar** (yolculuk sırasıyla):
- **Şehir durakları:** her şehir numaralı bir durak. Solda kesikli yolculuk çizgisi; aralarında taşıt ikonu ve "Kyoto'ya · Shinkansen Hikari · ~2 sa". Bu satır ulaşım kartından gelir.
- **Şehir başlığı:** tarih, gece sayısı ve "✓ 2 planda · + 3 öneri".
- **Kartlar:** hepsi aynı boy. Planda olan ✓ ile önde, öneri kesikli ve + ile arkada. Sıra dolunca alt sıraya geçer.
- **Görsel:** Maps'ten gelen kayıtta fotoğraf, yoksa türün illüstrasyonu (restoran · gezilecek yer). Köşede "Restoran / Gezilecek" etiketi, Maps rozeti.

**Belgeler ve internet:**
- **Vize satırı ilk sırada.**
  - Vize gerekmiyorsa yeşil tek satır.
  - Gerekiyorsa amber satır: "Resmî kaynak ↗" ve "Vize alındı".
- **Sonra** sigorta ve eSIM kartları.

**Hazırlık:** kutucuklar, "Hazır", "Hazırları gizle", "Amazon ↗", "Daha fazla öner". Türün kendi listesiyle gelir.

### Kartın sağ üstü

Durum etiketinin yanında, üstüne gelince iki düğme çıkar. Dokunmatik ekranda ikisi de hep görünür; dokunma alanı 30 px.

- **••• menü:** Değiştir · Belge ekle · Kimin için? · (rezervede) İptal ettim.
- **× hızlı kaldırma** (AI'nin kurduğu plandan istemediğini atmak için):
  - Basınca kart kaybolmaz, yerinde ince bir satıra katlanır: "X kaldırıldı · Neden? [Gerek yok] [Ben hallettim] · Geri al".
  - "Gerek yok" → Gizlenenler. Hiçbir şey seçilmezse de "gerek yok" sayılır.
  - "Ben hallettim" → **Ayarlandı** (ör. "arkadaşım alacak"). Yolculuk çizgisi kopmaz; plan o kısmı halledilmiş sayar.
  - Rezerve ya da belgeli kartta × önce sorar (bugünkü onay penceresi).

### Kartı çevirme (seçenekler)

- **Açma ve kapama:** karta basınca kart döner. Arka yüzde boş bir yere basınca geri döner; × da kapatır.
- **Genişlik:** arka yüz satırın tamamını kaplar (yanındaki kart bir satır aşağı kayar; bilerek). Seçenekler okunur büyüklükte bir ızgarada durur.
- **Seçenek kartı:** görsel; ad; marka etiketi + puan (uçuşta aktarma); gece başı fiyat ya da toplam; "Seç". Kimin eklediği görselin köşesinde rozetle.
- **Izgara:** en çok 7 seçenek. Son kare "+N daha · Pano'da büyük aç".
- **Başlık:** "Pano'da aç" düğmesi. Altta "Daha fazla bul" ve küçük "Kendin ara" bağlantıları.
- **Kart yüzünde gezinme:** ‹ › ve klavyedeki sağ/sol oklar (v19 kararı; klavye eksiği kodda kapanacak).

### Rezervasyon ayrıntısı penceresi

- **İçerik:** bugünkü pencere; satırlar, belgeler, Değiştir · İptal ettim · Rezervasyonu geri al · Tüm detaylar · Kapat.
- **Konaklamada ek olarak:**
  - "Haritada aç ↗" ve "Ev sahibine yaz ↗" (otelde "Otele yaz ↗")
  - iptal durumu
  - Airbnb'de kapı kodu ("girişten 1 gün önce gelir") ve ev sahibi

### Yolculuk sırasıyla

- **Sütunlar:** solda tarih sütunu, ortada kesikli çizgi ve düğüm, sağda kart.
- **Tarih kutusu:** ay · gün · haftanın günü · "Gün N". Aynı güne düşen satırda tarih tekrar edilmez. Tarihsiz gezide yalnız "Gün N".
- **Şehir bölümü:**
  - başlık: "5 gece · 1–6 Nis · Per–Sal · Gün 1–6"
  - içerik: konaklama kartı ve "Burada" listesi (etkinlikler ve ✓'li yapılacaklar)

### Gün gün (planın görünümü)

Her gün tek satırda:
- tarih kutusu
- o gün başlayan uçuş, ulaşım ve tarihli etkinlikler, durumlarıyla
- "Gece: Kyoto · Gion Machiya Evi"
- boş günde "Serbest gün · yapılacaklardan seç"

Harita anahtarı (v11 kararı) burada kalır.

### Pano

- **Üst:** başlık, kayıt sayısı, gerçek bir arama kutusu, "+ Link ekle".
- **Solda dikey kategori menüsü**, sayılarıyla: Tümü · Uçuşlar · Konaklama · Ulaşım · Etkinlik · Yapılacak · Belgeler ve internet · İlham · ayırıcı · Beğenilenler. Kaydı olmayan kategori gizlenir.
- **Ana alan:**
  - üstte durum (Hepsi · Karar bekleyen · Planda) ve Sırala
  - altında **ihtiyaç başına bir sıra**, ör. "Osaka · 3 gece · 3 kayıt". Karar bekleyenler en üstte.
- **Sıranın başlığında:** "Karar bekliyor" ya da "Seçildi: X · Plan'da gör →"; ayrıca "Karşılaştır" düğmesi. Sıra o an kartlardan tabloya döner.
- **Kartlar:** yatay kayar. Altında "Senin için" özeti.
- **Yapılacaklar:** şehir şehir sıralar.
- **Pano'nun kart yapısı** (görsel, uyum puanı, kalp, "Neden?", Yedek · Bununla değiştir) değişmez; yalnız kaynak marka etiketiyle yazılır.

## Gezi türü (K33'ün uygulanışı)

- **Gezinin sebebi:** Etkinlik ve turlar bölümünün ilk kartıdır. Geniş ve iğnelidir: görsel, "GEZİNİN SEBEBİ", ad, tarih ve kaynak, fiyat ve bilet durumu. Klasik turda bu kart yoktur.
- **Tür notu:** bölümde kısa bir satır olur, ör. "Festival gezisi: tur önerisi kapalı; sonrası için dinlenme önerdik". Önerilerin üstünde "Festivalden sonra · dinlenme" ara başlığı durur.
- **Konaklama türü sohbette sorulur.** Model türü bilir ve uymayanı önermez; Ozora'da otel önerilmez.
  - Kamp kartı "Çadır kampı · festival alanı · kendi çadırın" der. Fiyat ve rezerve düğmesi yerine "✓ Rezervasyon gerekmez · bilete dahil" yazar. Ayrı bir "Dahil" durumu yok.
  - Sohbet sorar: "Çadır kampı mı, karavan kiralamak ister misiniz?" Seçim karta yerleşir.

| Tür | Gezinin sebebi | Konaklama | Kapalı öneriler | Değişenler |
|---|---|---|---|---|
| Klasik tur (Japonya) | yok | otel / ev | — | — |
| Festival (Ozora) | festival bileti | çadır kampı ya da karavan (sohbet sorar) | tur | araba al/bırak · sonrası hamam · kamp hazırlığı · Schengen |
| Dalış (liveaboard) | tekne turu | teknede (tura dahil) | şehir turu | dalış sertifikası, dalış sigortası |
| Göç izleme (safari) | safari turu | kamp (tura dahil) | — | küçük uçak · sarı humma aşısı |
| Wellness / retreat | program | programa dahil | çoğu etkinlik | sade hazırlık |
| Kayak | kayak pası + merkez | otel | — | ekipman, kayak okulu |

## Zamana göre gösterme

| Bilgi | Ne zaman |
|---|---|
| Canlı şerit: Zamanında · Terminal · Kapı · check-in | yalnız uçuş günü |
| Rötar: kart kırmızı çerçeve, eski saat çizili, yeni saat; "Planı yeni saate göre kaydırdım: …" | olduğu an |
| İndi: saat · terminal · bagaj bandı | inince |
| PNR (koçanda) | yalnız uçuş günü; öncesinde "Rezerve · toplam" |
| İptal süresi, seçildi kartında | her zaman (karar verilirken lazım) |
| İptal süresi, rezerve kartta | yalnız son 14 gün. Son 7 gün turuncu ("İptale 3 gün · son gün 1 Mar"), son gün kırmızı ("İptal bugün biter") |
| "İade yok" | seçildi kartında görünür, rezervede gizli |
| Otel giriş saati (alt şeritte) | konaklamaya 2 gün kala; öncesinde "✓ Rezerve" |
| "Bilet alınmadı · uçuşa N gün" (seçildi uçuşta) | her zaman; 14 gün kala turuncu |

## Uzun metin

- **Plan kartı başlıkları** (otel, uçuş, ulaşım, şehir adları): 1 satır, "…" ile biter.
- **Etkinlik ve yapılacak adları:** en çok 2 satır. Yeri her kartta 2 satırlık ayrılır; kısa ad da aynı yüksekliği tutar.
- **Pano kart adı:** 2 satır.
- **Alt satırlar** (semt, not, saat): 1 satır "…".
- **Düğme ve etiketler kırılmaz;** dar yerde kısa adları kullanılır ("Sıradaki:" düşer).
- **Tam ad** her yerde üstüne gelince görünür (`title`).

## Marka

- **Etiket:** kaynak, kendi renginde okunur bir etiketle yazılır: Booking.com · Airbnb · JR · Klook · Viator · DiscoverCars · Airalo …. Resmî siteden gelende gri "Resmî site"; ulaşımda resmî site etiketi gösterilmez.
- **Havayolları:** logo ve ad (bugünkü gibi).
- **Logo kaynağı:** marka renk ve adları tek tabloda durur. Gerçek logo varsa onun yerine logo konur (havayolunda Kiwi görsel sunucusu).

## Koda geçerken korunacaklar

Canlıda olup çizimde ayrıca çizilmeyenler. Hepsi yeni kartlara taşınır, kaybolmaz.

1. **Uçuşun canlı verisi**, `FlightLive.tsx`, `PlanCard.tsx`: kalkış, check-in masası, kapı, iniş, bant, terminal, rötar ve "Rötar: plan yeni saate göre kaydı". Yeni yeri canlı şerit; yalnız uçuş günü görünür.
2. **Kart menüsü**, `stageMenu.tsx`, `ActionStrip.tsx`: Düzenle, Çıkar, Değiştir, Belge ekle, İptal ettim, Sil (sorarak), Kimin için. Yeni ••• menüsünde toplanır; Düzenle ve Sil de menüye girer.
3. **Kişiye özel rozet**, `WhoseBadge.tsx`: "Sabine'in bileti".
4. **Uyarılar:**
   - iptal ve bilet geri sayımı, `lib/progress.ts`, `CardShell.tsx`; yeni kurallarla
   - iki rezervasyon çakışması, `lib/plan.ts`
   - konaklamanın bir kısmının boş kalması, `PlanEntry.tsx`
   - kısa aktarma uyarısı ve "Anladım", `SuggestionCards.tsx`
   - tek yön uçuşta "Dönüş bileti ara"
5. **Kartta yerinde düzenleme**, `CardDate.tsx`, `InlineEdit.tsx`: ad, tarih, saat, fiyat; boşsa "Tarih ekle", "Fiyat ekle".
6. **Yapılacakların işlemleri**, `ideas/IdeaTiles.tsx`: Gittim, Haritada aç, Adını değiştir, "Rezervasyonu yaptım", Etkinliklere taşı, Hazırlık'a taşı, Günden çıkar. Ayrıca süzgeç (Hepsi · Gezilecek · Restoran) ve gün çipi. ••• menüsüne girer; süzgeç bölüm başlığına.
7. **Hazırlık**, `plan/PrepList.tsx`: maddeyi yerinde düzenleme, × ile silme ve Geri al, "Orada yapılacak".
8. **Ulaşım karar hâlleri**, `EmptyCard.tsx`, `LegRow.tsx`, `LegCard.tsx`: "Ayarlandı / rezerve edildi", uçakla şehir değiştirirken "Uçuş ara ↗", "Planı temizle". Boş ulaşım kartı bunları kapsar.
9. **Etkinlik kaynağı yokken**, `plan/ActivityBoard.tsx`, `SectionTimeline.tsx`: "Canlı tur ve bilet kaynağı bağlı değil; kendin bakabilirsin" ve şehir başına arama bağlantıları. Uydurma kart yok (K75).
10. **Hata ve boş hâller:**
    - okunamayan link: "Okunamadı · Tekrar dene · Kaldır", `arrive/ArriveViews.tsx`, `TripPanel.tsx`
    - boş gezi: "İlk kaydı ekle"
    - boş bölüm: "Ekle:" çipleri
    - ilk açılış kartı `StartGuideCard`
11. **Rezervasyon penceresi**, `BookingSheet.tsx`: "Rezervasyonu geri al" ve "Tüm detaylar".
12. **Ekleme noktaları**, `Section.tsx`, `SectionTimeline.tsx`: bölüm sonundaki "+ Ekle" ve kartlar arasındaki "+" (üstüne gelince).
13. **Gizlenenler'in bütün türleri**, `plan/HiddenList.tsx`: Elendi · Geri al, rezervasyonun kapattığı seçenek, iade notlu iptal, gizlenen transfer ve geceler.
14. **Belgeler**, `DocAccess.tsx`: çoklu belge listesi, silme ("çöp kutusu 30 gün"), sürükle-bırak; eSIM'in "Kurulmadı" hâli.
15. **Hero'nun v9 parçaları:** "Yapılacakları göster" listesi, ikinci düğme (PDF/Paylaş; yeni yeri ••• gezi menüsü), gezi ••• menüsü (Geçmiş).
16. **Erişilebilirlik:** kart gövdesi tıklanır, içindeki düğmeler ayrı (`CardShell.tsx`'teki `.pk-body` ayrımı). `article role="button"` içine düğme konmaz.
17. **İngilizce:** her yeni metin `L("tr","en")` çiftiyle yazılır.

Hareket Dili oturumunun (0.36.78) ricası; yeni markup bunları taşır:

- `plan/Section.tsx`: yalnız kullanıcı açınca `.cat-body.mv-unfold`. Bölüm gövdesi değişirse sınıf yeni gövdeye taşınır.
- `board/Pano.tsx`: boş ya da sonuçsuz durumda maskot (kayıt yok → uykulu, süzgeç boş → "oops").
- `opening.ts` `findPieces()`: bugün `.hx-*`, `.ts-stop`, `.cat-sec`, `.pk-card` sınıflarıyla buluyor. Bekleyen yeni açılış (`hareket-bekleyen`, `41b3782`) parçaları işaretle bulacak; yeni bölümlere, kartlara, bilet satırlarına ve hero'ya bu işaretler konur:
  - `data-pit` (`="bar"` ya da `="line"`)
  - `data-pit-children`
  - `data-pit-photo`
  - `data-count`
- `viewTransition.ts` `withTripPhoto`: gezi kartı fotoğrafı (`.pic`, `data-trip-card`) → hero (`.hx .hx-photo`). Hero fotoğrafının sınıfı değişirse seçici güncellenir.
- `.ch-sheet` giriş animasyonunun dışında kalır.
- Kartlar yayınlanınca "Trip Radar Hareket Dili" oturumuna haber verilir. Bekleyen hareket işleri (bağlantı yapıştırınca iskelet kart, boş kartın nabzı, "Plana koy"da kartın bölümüne uçması) o zaman yeni kartlara oturtulur.

## Veri değişiklikleri (özet)

| Alan | Yeni / değişen | Not |
|---|---|---|
| `trip.intent` ve oyun kitabı | var; yeni alanlar: `reasonRef`, `stayKind` (otel · kamp · tekne · programa dahil), `closedSuggest`, `prepList` | `lib/playbooks/*`; tür yapıyı değil içeriği değiştirir |
| Durum `set` (Ayarlandı) | yeni | "Ben hallettim"; plan hazır sayar; eski sürüm "planned" okur |
| `Item.noBooking?: string` | yeni | "Rezervasyon gerekmez · bilete dahil" |
| `Item.when?: string` | yeni | kiralama "Al … · bırak …" satırı |
| `Item.rating?: { score, count, scale }` | yeni | puan rozeti; kaynaktan gelir, yoksa satır gösterilmez |
| Marka tablosu | yeni | ad + renk; logo varsa logo |
| Görünüm | `view: "plan" \| "board"`; plan içinde `mode: "cat" \| "story" \| "days"` | "Gün gün" ve "Belgeler" sekme olmaktan çıkar |

Hepsi isteğe bağlı alanlar; eski sürüm bilmediği alanı yok sayar.

## Fazlar (her faz kendi sürümü; numara o gün `git log origin/release` ile alınır)

Her fazdan önce dokunulacak dosya listesi Hareket Dili oturumuna gönderilir. Temel dal `origin/gece-giris-0.36.78` ya da daha yenisidir.

1. **Gezinme ve özet:**
   - iki sekme; Gün gün planın görünümü; ••• gezi menüsü
   - yeni yapışkan özet şeridi
   - Yolculuk sırasıyla görünümünde tarih sütunu
2. **Kart şablonları:**
   - uçuş bileti (şehir büyük, kavisli rota, koçan); konaklama (Booking düzeni, marka, puan, gece başı fiyat); ulaşım (illüstrasyon, "A → B", marka)
   - eşit boy ve uzun metin kuralları
   - ••• menü (korunacaklar 2, 5, 6 içine); × katlanma ve Ayarlandı
3. **Zamana göre gösterme:** canlı şerit (korunacaklar 1), iptal ve bilet geri sayımı (4), PNR ve giriş saati kuralları.
4. **Kart çevirme:** satır genişliğinde arka yüz, büyük seçenek kartları, Pano karesi, ‹ › klavye.
5. **Etkinlik ve Yapılacaklar:** ✓ / + ve "Bilet aldım"; yapılacaklar yolculuk sırasıyla şehir sıraları; boş ulaşım kartı.
6. **Pano:** sol menü, ihtiyaç sıraları, sırada Karşılaştır, arama kutusu.
7. **Gezi türü:**
   - Gezinin sebebi kartı ve tür notu
   - kamp / dahil konaklama ("Rezervasyon gerekmez"); sohbetin konaklama türünü sorması
   - Belgeler'de vize satırı ve tür belgeleri
8. **Ayrıntı penceresi:** haritada aç, ev sahibine yaz, Airbnb kapı kodu.

## Test

- **Birim (vitest):**
  - zamana göre gösterme kuralları (bugün / 14 gün / 7 gün / son gün / uçuş günü)
  - `set` durumu ve plan sayımı
  - oyun kitabı: Ozora → otel önerisi yok, kamp; sebep kartı Etkinlik'in ilk kartı
  - uzun ad: kart yüksekliği değişmez
  - marka tablosu
- **e2e (`scripts/e2e.mjs`):**
  - Önce metni değişen her şey `e2e.mjs` içinde aranır: "Gün gün" ve "Belgeler" sekmeleri, "Plana koy" / "Plana ekle", "Aldım" / "Bilet aldım", "Gizlenenler", "Geri getir", "Yapılacak şeyler", "Belgeler ve internet".
  - Seçiciler: `.cat-sec`, `.pk-card`, `.cat-plan`, `.pk-undo`, `.cat-title`, `.cat-card`, `.ch-sheet`, `.cat-count`, `.pn-card`, `.ts-strip`, `.visa-row`.
  - Yeni senaryolar: × → katla → Ben hallettim → Ayarlandı; kart çevir → arka yüzde boşa bas → geri döner; yapışkan şerit → Sıradaki → kart parlar.
  - "Sayfa değil panel kayar" testi `.panel` ve `.cat-sec` üzerinde `position: relative` ister; korunur.
- **Ekran görüntüsü:** her faz `scripts/shots.mjs` ile çizim–canlı yan yana. Ayrıca dar ekran ve İngilizce.

## Açık kararlar

1. **Bir gezide iki sebep** (festival + dalış): iki sebep kartı mı, bir kart iki satır mı? Henüz çizilmedi.
2. **Link yerleştirme belirsizliği:** model bir linkin yerinden emin değilse link Pano'nun gelen kutusuna düşer ve "Bunu nereye koyalım?" diye sorulur. Çizilmedi.
3. **Pano çekmecesi:** kartın arkasındaki "Pano'da aç" sayfa değiştirmek yerine Pano'yu sağdan, o ihtiyaca süzülmüş açsın mı? (menü alternatifleri C'den). Faz 6'da karar.
4. **Gerçek görseller:** otel ve yer fotoğraflarının kaynağı (Booking/Airbnb kaydı, Google Places) ve maliyeti.
5. **Tahmini fiyat:** otelde tarihli fiyatın kaç şehirde geldiği doğrulanmadı (Xotelo / SerpApi).
6. **"Seçildi" ile "Rezerve" yeşil tonları:** yan yana yeterince ayrışıyor mu? Emre teyit etmedi.

## Kararlar (Emre, 2026-10-10 / 11)

- Kart açılışı çevirmek; arka yüzde boşa basınca geri döner; arka yüz satır genişliğinde.
- Uçuş: Skyscanner netliği, logolu; planda şehir büyük, karşılaştırmada saat büyük; ortada kavisli rota ve uçak.
- Otel: görsel üstte, bilgi altta (Booking/Airbnb); marka, puan, gece başı fiyat; boşken illüstrasyon.
- Ulaşım: illüstrasyon + "A → B"; fiyat sağda, düğmenin yanında.
- Yapılacaklar: hepsi dizili; önerimiz ✓, diğerleri +; × siler. Şehirler yolculuk sırasıyla, kartlar tek boy.
- Etkinlik: ✓ / + ve yazılı "Bilet aldım".
- Bölümler sabit; Gezinin sebebi Etkinlik'in ilk kartı; "Dahil" durumu yok, konaklama türünü sohbet sorar.
- × hızlı kalır ama kartı katlar: Gerek yok / Ben hallettim.
- Menü A: Plan · Pano; Gün gün görünüm; Belgeler ••• menüde.
- Yapışkan özet: tepeye yapışık, opak, % halka, tek satır bütçe.
- Bilgi gerektiği an; uzun metin kartı büyütmez.

## Uygulama durumu (2026-10-11 gecesi)

Fazlar `plan-v30` dalında, her sürüm `git log origin/release`'ten alındı. Yayınlananlar: **0.36.79** (Faz 1), sonrası aşağıda.

**Faz 1 · yayında 0.36.79.** İki sekme (Plan · Pano; Belgeler yalnız açıkken üçüncü sekme). "Gün gün" ve "Yolculuk sırasıyla" planın üç görünümünden ikisi (`plan/PlanOrder.tsx`). Yolculuk sırasıyla `timeline.board`'dan tarih kutulu (`plan/StoryView.tsx`, `lib/storyDates.ts`). ••• gezi menüsüne Belgeler ve "Planı PDF olarak indir" (`panelBus.ts`). Yeni yapışkan özet (`StickyBar.tsx`).

**Çizimden bilerek ayrılanlar:**
- **Özet halkası** çizimdeki "%77 hazır" değil, kahramanın kendi sayısı (`Planlananların %X'i rezerve`). Kural: ekranda ikinci bir sayı kümesi yok (DESIGN.md).
- **× katlanması:** hiçbir şey seçilmezse kart katlı kalır, veri değişmez ("gerek yok sayılır" yerine). Yalnız plan kartlarında (`CardShell`); etkinlik satırları ve konaklama araçları (`StayTools`) eskisi gibi.
- **Ayarlandı** ayrı bir durum değil: `noBooking` + yeni `Item.arranged` bayrağı. Sayımlar ve halka mevcut "fikir olarak ayrıldı" yolundan akar; yalnız sözler değişir.
- **Yolculuk çizgisi hop satırı** (Yapılacaklar'da şehirler arası "Kyoto'ya · Shinkansen") yapılmadı; numaralı duraklar ve kesikli çizgi var.
- **Otel giriş saati 2 gün kala** kuralı yapılmadı: canlıda giriş saati karta yazılmıyor, rezervasyon penceresinde duruyor.
- **Pano çekmecesi** yok; kart arkası "Pano'da aç" sayfayı değiştiriyor.
- **Gerçek otel fotoğrafı:** kaynağın görseli varsa o, yoksa türün çizimi.
- **Etkinlikte "Bilet aldım"** yazısı değişmedi (kartın üstündeki "✓ Aldım" duruyor).

## Durum

Çizim onaylandı (v30, `404c755`) ve kodlandı: 0.36.84 (`04436aa`). Sonraki çizimler (v31–v46) ve kod planı: `2026-10-13-plan-v45-kod-plani.md`.
