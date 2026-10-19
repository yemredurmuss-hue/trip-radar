# Trip Radar 0.38.0: yeni plan tasarımı (v82/v83)

19 Ekim 2026. Önceki sürüm 0.37.1. Kod: `git log 9f22bae..0ebcf64` (78 commit, v82 kod geçişinin aşama 0-8'i) ve
birleştirme dalında Emre'nin 19 Ekim kararları (`de60603`). Onaylı tasarım: `docs/mockups/plan-v83-turler/`; kararlar
`docs/superpowers/specs/2026-10-18-v82-gecis/01-kararlar.md`, kapsam `02-spec.md` §1.

Bu sürümde plan sayfası baştan çizildi. Kaydetme, okuma, sohbet ve paylaşım aynı çalışır. Değişmeyenler: IndexedDB
şeması (`DB_VERSION = 5`), sunucu tarafı (`supabase/` 0.37.1 ile aynı), sohbet mantığı, harita ve Gün gün'ün yerleşimi.
Eklentinin izinleri aynı; yalnız sürüm numarası değişti.

## Ne değişti

### Gezinin özeti: mozaik ve şerit
- Hero artık bir mozaik: solda gezinin büyük kapağı (ad ve ana yerler), sağda en çok altı kare. Kareler önce plandaki
  yerlerden, sonra Pano'ya biriken linklerden, sonra şehirlerden ve gezinin anlarından gelir; fotoğrafı olmayan şehir
  için çizim. Hiç fotoğraf yoksa yalnız kapak kalır, boş kare çizilmez. Her karede üzerine gelince fotoğrafın künyesi.
- Altında dört bölmeli şerit: tarih ve kaç gün kaldı · kişiler ve hazırlık çubuğu ("%61 planda · %33 alındı") ·
  bütçe · "Sıradaki" düğmesi. Sayılar plandan hesaplanır, seçince ve "Gerek yok" deyince hemen güncellenir.
- Çipler: ülke, para, priz, saat farkı, dil, vize; çok ülkede "n ülke" ve ülke ülke satırlar. Uyarı çipleri amber:
  "Schengen vizesi gerekiyor", "2 belge yok" (14 gün kala belgesi eklenmemiş rezervasyonlar).
- Küçük pencereler: Tercihler ("Seni böyle anladım"), Bütçe (Rezerve, Planlanan, Boşta, kategori dağılımı, iki ve daha
  çok kişide "Kişi başı"), Kimler gidiyor (yetişkin, çocuk, oda).
- Bütçe yoksa "Bütçe belirle". Tarihi tahmin olan gezide "~", ay ya da mevsimden tahminde "~ · n gece".
- "Sıradaki" gezinin evresine göre: önce vize, sonra Önerimiz onayı, sonra karar bekleyen.
- Kapağın sol üstünde gezi menüsü (⋯): Belgeler, Paylaş, Planı PDF indir, Rotayı haritada gör, Geçmiş ve çöp kutusu,
  Yeni sohbet, Link ekle, Ayarlar ve ayrı satırda kırmızı "Geziyi sil".
- "Özeti küçült" ile tek satır; aşağı kaydırınca planın üstünde ince şerit (ad, %planda, karar sayısı, bütçe,
  Plan | Pano, Sıradaki).

### Plan başlığı ve kategori satırları
- Hero'nun altında 40 px boşluk, sonra "Plan" başlığı: "Gezinin omurgası · n karar bekliyor" (basınca ilk karara
  gider) ve görünüm seçici: Kategoriye göre · Yolculuk sırasıyla · Gün gün.
- Kategoriler: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Yapılacaklar ve restoranlar · Belgeler ve internet ·
  Hazırlık. Kapalı satırda ad, özet ("2 şehir · 6 gece · 4 fikir"), küçük görseller, çubuk ("1 alındı · 1 karar") ve
  bütçe payı. Aynı anda tek kategori açık; açılan üste kayar. Her kategorinin sonunda "+ … ekle", listenin sonunda
  "+ Yeni ihtiyaç ekle".
- Kalkanlar: rota şeridi, durum anahtarı, plan başındaki "+ Ekle", Pano'daki "+ Link ekle", "Orada yapılacak".

### Niyet kutusu
- Her ihtiyaç bir kutu ve her kutu her durumda aynı boyda: başlık 76, gövde 196, yan sütun 232 px; tekli kutu 1440 ve
  860 px'te, iki dilde 288 px.
- Durumlar aynı çerçevede: Aranıyor, Karar bekliyor (en çok 3 seçenek, gerisi Pano'da), Önerimiz ("Bunu seç"), Seçildi
  (kum rengi; Rezerve et, Aldım, Değiştir), Alındı (kod ve kopyala, giriş ve çıkış saati, "Belgeyi aç" ya da kesik
  çizgili "Belgeyi ekle", yanında küçük "€… ödendi"), Ayarlandı, Dahil.
- Açık kategoride kutular soldaki durum çizgisine bağlı; noktanın rengi durumu söyler.
- Değiştir kutuyu büyütmeden seçenekleri yerinde açar; Ayrıntı kutunun üstünde açılır, altında "Tüm detaylar ›".
- ⋯ menüsünde Ayrıntı, Gerek yok, Ben hallettim. Gerek yok denen kutu katlanır, kategori sonundaki "Gizlenenler · n"e
  iner, Geri al ile döner. Ben hallettim'in açtığı kayıt geri alınınca silinir.
- İsteklerde yalnız ✓ ve ✕; sayfanın söylemediği "?" gösterilmiyor.
- "Kendin ara" bağlantıları sabit marka değil, sağlayıcı kaydından (`src/lib/providers.ts`): ülkeye ve türe göre
  (Asya'da Agoda ve Klook önde, Japonya'da JR).

### Bilet ailesi
- Uçuş, tren, transfer, otobüs, vapur, kiralık araç ve pass aynı bilet çerçevesinde: taşıyıcı satırı, iki uç büyük
  yazıyla (havalimanı ya da istasyon ve saat), arada yolun çizimi, altında çipler.
- Aktarmalı uçuş tek kutu, iki koçan. Kişiye özel bilet "1 kişi" der ve bir kişi için aranır.
- Kimsenin planlamadığı şehir değişiminde yolun seçimi: Tren, Otobüs, Araba, Uçak ya da "Ben hallettim" (C15).
  Yolu söylenmiş transfer Ayarlandı olur.
- Telefonda biletin uçları kesilmez; kod ve saat sığmazsa alt alta.
- Havalimanı tablosu büyüdü (Japonya, Kore, Güneydoğu Asya, Hindistan, Körfez, Afrika, Amerika): bilette "KIX" yerine
  "Osaka".

### Etkinlik ve Yapılacaklar sıraları
- Şehir başına iki sıra: "Planında" ve "Öneriler", sırada dört kart (224 px). Planında plana konan her şeyi gösterir,
  dörtlü sıralar halinde; hiçbir şey yoksa aynı boyda boş yuvalar ("Henüz plana koymadın"). Öneriler tek sıra, fazlası
  "+n Pano'da" (Emre, 19 Ekim).
- "+ Plana koy" kartı Planında'daki yuvasına uçurur. Alınan etkinlik kartı büyümez: görselin altında yeşil şerit, kod ve
  "Bileti aç". Kaynağın turları boş şehrin satırında.

### Yolculuk sırasıyla
- Aynı plan gezinin yaşandığı sırayla: Yola çıkmadan (Hazırlık, eSIM, sigorta), gidiş, şehir şehir, dönüş. Her adımda
  durum ve tek eylem (Seçeneklere bak, Ara, Bunu seç, Rezerve et, E-bilet aç); "›" o kutuya götürür.
- Uçakta geçen gece kendi satırı; Dahil olan adım onu kapsayanı söyler; Hazırlık adımı kapalı satırla aynı sayımı söyler.
  Tarihi belli olmayan gezide bu görünüm kapalıdır.

### Bugün ve uçuş günü
- Gezi sırasında hero'nun yerinde "Bugün" şeridi: saat saat kalemler, şu anki satır vurgulu, geçenler soluk, altta
  yarının ilk işi. Plan Yolculuk sırasıyla, bugünden açılır.
- Uçuş günü alınmış biletin çip satırı canlı şerit olur: kapı, biniş, rötar, terminal; rötarda yeni saatler ve
  "Planı yeni saate kaydırdım."

### Pano penceresi
- Pano ayrı sayfa değil, planın üstünde açılan pencere (dar ekranda alttan). Kenar menü: Tümü · Biriktirdiklerim ·
  AI önerileri · İlham · Belgeler, altında ihtiyaç ağacı.
- Karşılaştırma yalnız konaklama, eSIM, uçuş ve trende: 280 px sütunlar, hizalı satırlar, "Uyum puanı n/100". Etkinlik
  ve yapılacaklarda kıyas yok, toplama ızgarası. Ayrıntı'daki "Karşılaştır" Pano'nun karşılaştırmasını açar.
- Beğeni tek ♥; paylaşılan gezideki eski oylar beğeniye çevrildi.
- İlham artık Pano'da: platform rozetli kartlar, "✨ İçinden yerleri çıkar", "Aç ↗".
- Belgeler Pano'da: türe göre gruplar, her belge kendi kartına bağlı ("Kartı göster"), "Bağlanmamış" ("Karta bağla").

### Hazırlık
- En üstte "Bilmen gerekenler": acil numara, para, priz, büyükelçilik (haritada), AI'nın günlük hayat notları.
- Günlü maddeler: online check-in, vize başvurusu, eSIM kurulumu gibi işler kendi gününü taşır ve güne göre sıralanır;
  nereden geldiği küçük etiketle. Yaklaşan gün turuncu; son günü geçmiş ve yapılmamış madde "geçti" der, günü yumuşak
  kırmızı (Emre, 19 Ekim). Günü olmayan altta.
- Listenin sonunda katlı "Bavul": AI gezi için bir kez hazırlar (hava, gün sayısı, plandaki yerler); "bana göre değil"
  (×) bir daha önerilmez; "Her gezide götürdüklerin"; alınacakta mağaza bağlantısı (Türkiye'den Trendyol,
  Hepsiburada, Amazon.com.tr).

### Sohbet ve dar pencere
- AI'nın eklediği kayıt sohbette kart olarak: "Planda göster" kutuya götürüp parlatır, "Bunu seç" orada seçer; altında
  hızlı yanıtlar. Okunamayan link kesik çizgili kart (Tekrar dene, Kaldır).
- 860 px'in altında plan önce, sohbet alttan çekmece (tutamakta son mesaj).

### Sayım ve gezi biçimi
- Hazırlık sayısı: "Omurganın %X'i planda" (alındı, ayarlandı, seçildi; Önerimiz onaylanana kadar sayılmaz), altında
  "%Y'si alındı". Hero, ince şerit ve PDF aynı iki sayıyı kullanır.
- Dahil sayımı: bir alımın kapsadığı kutu (festival biletinin kampı, Hakone Free Pass'in vapuru, kiralık aracın
  yolları) kapsayanın durumunu izler: kapsayan alındıysa alındı, seçildiyse planda, karar bekliyorsa ikisi de değil.
- Gezi biçimi sinyalleri: plan gezinin türünü adından değil biçiminden okur (nerede uyunur, paket, pass ya da araç,
  hareketli üs, yakın havalimanı, günlük hak, odak, ekipman, belge ve sağlık, kimler, zaman). On bir hazır karışım
  (festival, dalış teknesi, kayak, wellness, kruvaziyer, yol gezisi, günübirlik, iş seyahati, safari, balayı, klasik)
  yalnız varsayılan verir; AI'ın gezi için yazdığı sinyal üstün gelir. Biçim bir kategoride bir şeyi değiştirdiyse
  kategorinin başında kısa bilgi satırı.
- AI'ın onaylanmamış rotası "Önerimiz" olarak kurulur; açık geceler şehir şehir, gece aralığı başına bir konaklama.

### Kişiler, para ve PDF
- Kimler gidiyor: yetişkin, çocuk ve oda gezinin geneli için; konaklama aramaları bunlarla yapılır, niyet satırında
  yalnız farklıysa yazar.
- Para birimi: ¥ (JPY) seçilebilir; kuru bilinmeyen birim seçilemez. Çevrilen tutar "≈" ile; kaynak fiyat korunur,
  Ayrıntı'da sayfadaki hali.
- PDF: rezervasyonlarda onay kodu, giriş ve çıkış (ya da kalkış) saati ve adres. Bilinmeyen alan yazılmaz; eskisi gibi çizgi de konmaz.

### Hareket ve yazı
- Kutu içeriği 120 ms'de söner, 260 ms'de gelir; seçilen seçenek 380 ms'de seçili karta dönüşür; mozaik kareleri
  80 ms arayla; seçimden sonra kutu kısa bir an parlar. Seçince bildirim çıkmaz.
- "Hareketi duraklat" ve azaltılmış hareket artık ekran geçişlerini ve kaydırmaları da durdurur.
- Plan sayfasında dokuz yazı boyu: 11, 12, 13,5, 15, 17, 19, 22, 24, 30.

### Belgeler
- `DESIGN.md` yeni kurallarla (renklerin tek anlamı ve kum = Seçildi, yazı ölçeği, niyet kutusu standardı, hero =
  mozaik, sağlayıcı kuralı).
- `PRIVACY.md` §5 ve §8: Bavul için AI'ya giden bilgiler, İlham'dan yer çıkarma, gezi fotoğraflarının kaynakları,
  sunucudaki fotoğraf aramaları, hava için Open-Meteo (önceki sürümlerde de vardı, politikada yazmıyordu), paylaşımda
  çocuk ve oda sayısı.
- `store/listing.md` ve 4 ekran görüntüsü yeni tasarımla; `scripts/store-shots.mjs` görüntüleri yeniden çeker.

## Bu sürümde arayüzden düşenler

Karar A1: tasarımı olmayan bu özellikler bu sürümde arayüzde yok. Kodları silinmedi; sonraki sürümde geri bağlanabilir
(spec §1.1).

| Karar | Ne idi (0.37.1) | Kod nerede |
| --- | --- | --- |
| C8 Yapılacaklar listesi ve ⏳ iptal süresi | Hero'daki ilerleme kutusuna basınca açılan, grup grup açık işler listesi (Karar bekliyor, Rezerve edilecek, Belge eksik, söylenmemiş transferler); "⏳ 2" düğmesi yalnız ücretsiz iptal süresi dolmak üzere olanları gösteriyordu. | `src/app/Progress.tsx` (`TodoList`, artık hiçbir yerden açılmıyor), `src/lib/planList.ts`, `src/lib/progress.ts` (`dateAlert`). "⏳" düğmesi eski hero'yla (`TripHero.tsx`) kalktı. İptal günü Ayrıntı'da durur. |
| C11 Karar yardımı | Eski karşılaştırma penceresi: kriterlerin önem ayarı, "Sonucu ne değiştirir?", AI yorumu, Kartlar ve Tablo görünümü, "Sırayla karar ver". | `src/app/CompareView.tsx`, `src/app/ProsConsView.tsx`, `src/app/board/OptionBoard.tsx`, `src/app/board/StepDecide.tsx`, `src/lib/decideSteps.ts`, `src/lib/proscons.ts`. Karşılaştırma artık Pano'nun sütunları. |
| C18 Başlangıç kartı | Sohbetle yeni kurulan gezide planın üstünde tek seferlik kart: üç adım ve "tarih yaklaşık · doğru mu?". | `src/app/start/StartGuideCard.tsx` (`START_CARD_SHOWN = false`); gezideki işareti (`trip.startGuide`) duruyor. |
| C27 Yolculuk kartı ekleri | Eski Yolculuk görünümünün kartlarında ⏳ iptal uyarısı, "n gece için yer yok" ve tarihsiz etkinlikte "gün seç". | Mantık duruyor: `src/lib/progress.ts` (`dateAlert`), `src/lib/plan.ts` (seçilen yerin kapsamadığı geceler, `gap`). Eski kartın arayüz kodu da depoda: `src/app/plan/JourneyCards.tsx` (temizlikte silinmişti, `06a93a6` ile geri geldi; hiçbir yerden çizilmiyor). |
| C32 Pano ekleri | Eski Pano sayfasında arama, durum süzgeci (Hepsi, Karar bekleyen, Planda), sıralama ve "Plan'da gör". | `src/app/board/Pano.tsx` (çizilmiyor, olduğu gibi duruyor). |

## Etsy kararları: bu sürümde olan ve olmayan (satır 166)

Koddan doğrulandı (0ebcf64).

| Karar | 0.38.0'da | Kanıt |
| --- | --- | --- |
| T3 Hazırlık maddesi kendi gününü taşır | Var | `src/lib/prepDays.ts`: günlü maddeler, güne göre sıra, günü olmayan altta; `src/app/plan/PrepList.tsx` "güne göre sıralı". |
| T5 Kişi başı satırı | Var | `src/lib/heroStrip.ts` `perPerson` (bütçe varken, iki ve daha çok kişide); `src/app/hero/HeroStrip.tsx` "Kişi başı". |
| T6 Bavul | Var | `src/app/plan/prep/Bavul.tsx`, `src/lib/prepPack.ts`, AI isteği `src/app/plan/prep/usePackAi.ts`. |
| T8 Bilmen gerekenler | Var | `src/app/plan/prep/KnowCard.tsx`, `src/lib/prepKnow.ts` (acil numaralar kaynaklı tabloda). |
| T1 PDF dışı gezi dosyası (telefona) | Yok | Gezi menüsünde "Telefona gönder" yok; kodda .html dışa aktarma yok. Yalnız PDF (C6). |
| T2 Takvime aktarma (.ics) | Yok | Kodda `VCALENDAR` ya da `.ics` yok; menüde "Takvime aktar" yok. |
| T4 Ödeme alanı (ödendi, kalan) | Yok | `src/lib/types.ts`'te ödeme alanı yok; yalnız alındı kutusunda "€… ödendi" (B10). |
| T7 Belgeler telefonda | Yok | Belgeler yalnız bu bilgisayarda; dışa aktarmada yok. |
| T10 Gezi dosyasında kişisel bilgi seçimi | Yok | Gezi dosyası olmadığı için seçim de yok. Not: PDF artık onay kodunu ve adresi hep yazıyor (`src/lib/printBookings.ts`); bu, satır 177'nin (T10 b, "sonraki küçük sürüm") istediği davranış ve şimdiden var. |

## Bilinen açıklar

- **Gün gün yeniden çizilmedi** (A3). Yerleşim 0.37.1 ile aynı; yeni renk ve yazı ölçeğine uyarlama (satır 151) bu
  belgenin hazırlandığı noktada (0ebcf64) bitmemişti: eski kartlarda Seçildi hâlâ açık yeşil çizgi (`--plan-line`).
  Ayrı bir iş (G1) sürüyor.
- **Ölçek dışı iki yazı boyu** (satır 155): alınmış kutudaki "Bilet alındı" 16 px, 860 px'te bir başlık 21 px. Ayrı iş
  (G1) sürüyor.
- **390 px'te kutular eşit boyda değil** (A8, sonraki iş). Yapı aynı, yatay kaydırma yok.
- **Kapalı Hazırlık satırı ve Yolculuk'taki Hazırlık adımı**, son günü geçmiş maddeyi "sıradaki" diye yazıyor, "geçti"
  demiyor (`src/lib/prepDays.ts` `prepSummary`); açık listede "geçti" doğru.
- **Gezi bitince** plan arşiv sayılır (karar yok, `src/lib/tripPhase.ts`), ama arşivin ayrı bir çizimi yok.
- **`panelBus.ts` kullanılmıyor**: yeni gezi menüsü hero'nun içinde olduğu için Belgeler ve PDF'i doğrudan açıyor. Dosya
  satır 168 gereği duruyor.
- **Mağaza görüntüleri fotoğrafsız**: bu makineden fotoğraf kaynaklarına ulaşılamadı; görüntüler `--offline` ile
  çekildi, hero düz kapakla. Ağı olan bir makinede `node scripts/store-shots.mjs` gerçek şehir fotoğraflarıyla yeniden
  çeker.
- Spec §2'deki bilgi haritası tablosu (F1) yazılmadı; belge işi.
- Koyu tema yok; `--q-*` değişkenlerinin koyu değerleri yalnız `[data-theme="dark"]` için tanımlı.

## Sonraki sürüme kalanlar

- Sonraki küçük sürüm: T2 .ics (satır 175), T4 b kalan ödeme günlü Hazırlık maddesi olarak (satır 176).
- Track aşaması (gezi sırası ve sonrası): T1 telefonda gezi dosyası (satır 178), T7 belgeler telefonda (satır 179), T9
  harcama kaydı.
- 390 px'te eşit kutu boyu (A8), Gün gün'ün yeni çizimi (A3), C8, C11, C18, C27 ve C32'nin yeni tasarımda yeri.

## İzlenebilirlik (Aşama 8: satır 151-174)

Kaynak: `/home/user/wt-v32/docs/superpowers/specs/2026-10-18-v82-gecis/izlenebilirlik.md`. Durumlar bu belgenin
hazırlandığı noktada (dal `v82-g2`, baş 0ebcf64); "G1'de" diyenler aynı anda süren son kod işinde. Bağımsız denetim
(satır 153) bu tabloyla yapılacak.

| No | Madde | Durum | Kanıt |
| --- | --- | --- | --- |
| 151 | Gün gün yalnız yeni renk ve ölçeğe uyar | Açık (G1'de) | Yerleşim aynı; `static/app.css` eski kartlarda `--plan-line: #8fcca5` (Seçildi açık yeşil) duruyor (`.stay-block.chosen`, `.ev-card.chosen`). |
| 152 | Eski kod ve CSS temizliği | Kısmen (G1'de sürüyor) | `eeeb144`, `9d2e552`: TripHero, TripFacts, StickyBar, StoryView, TripShape, JourneyCards ve ölü CSS silindi. `static/app.css`'te önekler hâlâ var: `.hx-` 44, `.cat-` 125, `.pn-` 196, `.ac-` 15 satır, `.jf-` 0; `SectionTimeline.tsx` ve `PlanKey` duruyor. |
| 153 | İzlenebilirlik ve bağımsız denetim | Açık | Bu bölüm denetimin girdisi. Denetim henüz yapılmadı. |
| 154 | Tam e2e | Geçti | `scripts/e2e.mjs` 61/61 yeşil (birleştirme dalı, 19 Ekim 07:42; aşama 8 dalında da 61/61, 07:21). |
| 155 | Ekran denetimi, yazı boyları ölçekte | Kısmen (G1'de) | 1440, 1280, 860, 390 ve İngilizce görüntüler alındı (`scripts/v82-shots.mjs`); ölçek dışı kalan: `.z-ok` 16 px, 860 px'te `.pk-ed` 21 px. |
| 156 | İki dil; kutular iki dilde ölçülür | Geçti | İngilizcede tekli kutuların hepsi 288 px (1440, 1280, 860; `v82-shots.mjs g2-en en`); e2e İngilizce bölümleri yeşil. |
| 157 | 390 px'te yapı aynı, kırılmaz | Geçti | `heights.json` 390 px `overflow:false` (Türkçe ve İngilizce); e2e "390 px: no sideways scroll". |
| 158 | Canlı hareket sözlüğü yeni bileşenlerde | Geçti | e2e "motion" iki kontrolü yeşil (mühür, parlama, düşüş, sayaç, aşama geçişi, Pano penceresi, seçim sonrası parlama). |
| 159 | DESIGN.md | Geçti | `DESIGN.md`: "Renklerin tek anlamı" (kum = Seçildi), "Yazı ölçeği", "Niyet kutusu standardı", "Hero = mozaik", "Sağlayıcı kuralı" başlıkları; "Seçildi açık yeşil" ifadesi yok. |
| 160 | Şema ve backend değişmez | Geçti | `src/lib/db.ts:23` `DB_VERSION = 5`; `git diff 9f22bae..0ebcf64 -- supabase/` boş; `npx vitest run` 186 dosya, 2318 test yeşil (`tests/dbUpgrade.test.ts` dahil). |
| 161 | Arayüzden düşenler sürüm notunda, kodları depoda | Geçti | Beş düşen özellik yukarıda yazılı; beşinin de kodu depoda (C27'nin `JourneyCards.tsx`'i `06a93a6` ile geri geldi). |
| 162 | Tek sürüm, denetimden sonra birlikte yayın | Bekliyor | Aşamalar mağazaya çıkmadı; `package.json` ve `static/manifest.json` 0.38.0. Yayın denetim raporundan sonra. |
| 163 | Diğer yüzeyler yeni dile uyarlanır | Açık (G1'de) | PDF, bildirimler, ilk kurulum ve Ayarlar, popup, Seyahatlerim bu belgede doğrulanmadı. |
| 164 | PRIVACY §8: fotoğraf kaynağı ve İlham'dan yer çıkarma | Geçti | `PRIVACY.md` §8 Türkçe ve İngilizce: "Gezi fotoğrafları" ve "İlham'dan yer çıkarma"; §5'te Bavul isteği, §11'de fotoğraf aramaları. Kaynak kod: `src/lib/cityImages.ts`, `supabase/functions/city-image/`, `src/lib/heroMosaic.ts`, `src/app/board/v82/PanoDialog.tsx` (`extract`), `src/app/plan/prep/usePackAi.ts`. |
| 165 | Mağaza metni ve 4 ekran görüntüsü | Geçti (fotoğrafsız) | `store/listing.md` yeni tasarımı anlatıyor, "oy" kelimesi yok; `store/screenshot-1-hero`, `-2-plan`, `-3-activities`, `-4-days` 1280×800, `scripts/store-shots.mjs --offline` ile. |
| 166 | Etsy küçükleri bu sürümde, çıktılar ve para sonra | Geçti | Yukarıdaki tablo. |
| 167 | Kabuk: izinler, kısayol, `_locales`, arka plan, sayfa yakalama | Geçti | `git diff 9f22bae..0ebcf64` yalnız `static/manifest.json` sürüm satırı; `src/background.ts`, `src/lib/pagecapture.ts`, `static/_locales` farksız. |
| 168 | Çerçeve: panelBus, ErrorBoundary, dil değişimi, Maskot, ana sayfa çizimi, yeniden bağlanma | Kısmen | Altı dosya 0.37.1 ile farksız. Yeni menü Belgeler ve PDF'i `panelBus` ile değil, `TripPanel`'den doğrudan açıyor; `panelBus.ts` hiçbir yerden kullanılmıyor. |
| 169 | Ayarlar'daki AI kapısı ve Profil | Geçti | `AiGateSettings.tsx`, `Profile.tsx` farksız; hero yüzlerinde profil fotoğrafı (`HeroStrip.tsx:106`). |
| 170 | Paylaş ve katıl, paylaşılan geziyi silme | Geçti | `Share.tsx`, `ShareSafety.tsx` farksız; e2e paylaşım ve "delete: a shared trip asks first" yeşil. |
| 171 | Başlangıç taslakları ve oluşturma haritası | Geçti | `startDrafts.ts`, `GenMap.tsx` farksız; e2e "start by chat" ve "trip map" yeşil. |
| 172 | Çöp kutusu (30 gün) ve Geri al (8 sn) | Geçti | `trash.ts`, `undo.ts` farksız; e2e "trash" ve "delete + undo" yeşil. |
| 173 | Bekleyen kayıtlar, sohbet hata şeridi, yeni sohbet | Geçti | Üçü yerinde: `TripsHome.tsx:353` "Bekleyen kayıtlar", `Chat.tsx` hata satırı (`setError`), gezi menüsünde "Yeni sohbet" (`hero/TripMenu.tsx:38`). Bu üç dosya yeni tasarım için değişti; e2e "capture queue … missing-key error" yeşil. |
| 174 | Panoya bırakma örtüsü | Geçti | `useBoardIntake.ts` farksız; e2e "arrivals: … a drop overlay over the board" yeşil. |

## Doğrulama (bu belgenin hazırlandığı nokta, 0ebcf64)

- `npx tsc -p .` temiz. `npx vitest run`: 186 dosya, 2318 test, hepsi yeşil. `npm run build` tamam.
- `scripts/v82-shots.mjs` Türkçe ve İngilizce: tekli kutuların hepsi 1440, 1280 ve 860 px'te 288 px; Etkinlik ve
  Yapılacaklar kutusu 624 px; hiçbir genişlikte yatay taşma yok.
- e2e (birleştirme dalı): 61/61 yeşil.
