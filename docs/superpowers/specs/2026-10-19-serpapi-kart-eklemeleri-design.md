# SerpApi kart eklemeleri (8 madde)

Tarih: 2026-10-19 · Dal: `serp-eklemeler` (origin/plan-v82-kod, 0.38.7 üstünden)
Onay: Emre 8 maddenin hepsine evet dedi (2026-10-19).
Çizim: https://claude.ai/artifact/Gm9rQ8RrPUBL4GkW4CH8Dn (canlı 0.38.6 kartlarına gömülü, bugün ve eklenince yan yana)
Sunum: https://claude.ai/artifact/JdTnTq6joau9Wgc25RCxB8

## Kurallar

- **Yalnız ekleme.** Kartın bugünkü düzeni, fiyatı, düğmeleri ve uyarıları yerinde kalır. Yeni bilgi yeni satır,
  rozet ya da sıra olarak eklenir; veri gelmezse kart bugünkü hâline döner, boş kutu çizilmez.
- **Para ortaklık linkinde.** Google'ın yönlendirme linkleri (google.com/travel/clk, aclk) kartta hiç kullanılmaz.
  Otelin linki bugünkü gibi `bookingSearch` ortaklık linki, uçuşun linki bugünkü kaynağının linki kalır.
- **Ücretsiz plan.** SerpApi ayda 250 arama. Test boyunca plan yükseltilmez (Emre, 2026-10-19).
- **Uydurma yok (K3).** Puan, fotoğraf, süre, fiyat yalnız kaynaktan gelir; gelmezse gösterilmez.

## Deneme bulguları (2026-10-19, 7 arama)

| Arama | Sonuç |
|---|---|
| Google Hotels, Porto ve Ubud, `gl=tr hl=tr` | 20/20 otelde fotoğraf, gecelik fiyat, puan, konum puanı, yakın yer + yürüme/taksi/toplu taşıma süresi (havalimanı dahil). Yorum kırılımı 18/20, kategori adları İngilizce. Site site fiyat listede yalnız 2/20 |
| Google Hotels tatil evleri, Lizbon | 18 ilan, fiyat kaynağı yalnız Bluepillow. **Airbnb yok.** Yorum kırılımı yok |
| Google Flights IST→OPO 12 Kas | `price_insights` var: seviye, tipik aralık (110–200), en düşük, **62 noktalık fiyat geçmişi** aynı cevapta |
| Google arama, "Porto gezilecek yerler" `hl=tr` | Top Sights: 20 yer, fotoğraf ve puan var. **Yorum sayısı bozuk** (99 bin → 99000000000), açıklama zayıf ("Açık", "Köprü") |
| Google Events, "Porto etkinlikleri" `hl=tr` | Sonuç yok |
| Google Events, "Events in Porto" | 8 etkinlik, fotoğraf ve bilet linki var; çoğu bar, parti, pub crawl. Gezi tarihine göre süzme belgede yok |

Ham cevaplar oturum klasöründe (`scratchpad/deneme/ham/`); birim testleri için kırpılmış örnekleri `tests/fixtures/serp/` altına kopyalanır.

## Kota bütçesi

Bugünkü `CAPS.serpapi = 8` (günde 8, ayda ≈240) korunur ama kullanım yerine göre bölünür; her biri `offers_take_call`'a
kendi adıyla gider, `OFFERS_CAP_*` ortam değişkeniyle değiştirilebilir.

| Kaynak adı | Günde | Ne için | Önbellek |
|---|---|---|---|
| `serp_otel` | 3 | Google Hotels listesi (şehir + tarih + kişi) | 24 saat |
| `serp_fiyat` | 2 | Uçuş fiyat yargısı + geçmiş (rota + gün) | 24 saat |
| `serp_yer` | 1 | Top Sights (şehir) | 30 gün |
| `serp_etkinlik` | 1 | Google Events (şehir) | 1 gün |
| `serp_airbnb` | 1 | Airbnb (şehir + tarih + kişi), yalnız ev/villa niyetinde | 24 saat |

Önbellek bugünkü `offers_cached` / `offers_store` tablosu; anahtar kişiye değil yere ve tarihe bağlı, herkes paylaşır.
Tavan dolunca: önbellekte eskisi varsa o, yoksa bugünkü kaynak (Xotelo, Wikipedia fotoğrafı) ya da ekleme gösterilmez.

## 1 · Otel kartı: fotoğraf, semte uzaklık, yorum özeti

**Görünüm:** çizimdeki gibi. Çizim yerine otelin fotoğrafı; semt satırının altına "🚶 X’e N dk yürüme · ✈ havalimanına
N dk metro/taksi"; altına "Yorumlarda: A ↑ B ↑ · C ↓".

**Kaynak sırası değişir:** Google Hotels birinci, Xotelo yedek. Bugün: RapidAPI geo → Xotelo → (az fiyat ise) Google.
Yeni: `serp_otel` → Google Hotels; tavan dolu ya da boş → bugünkü Xotelo yolu. `candidates=1` adayları da aynı Google
cevabından çıkar (bugün aday başına bir Xotelo çağrısı).

**Sorgu:** `engine=google_hotels`, `q="{şehir}, {ülke} hotels"`, tarih, kişi, `currency=EUR`, `hl` kullanıcının dili
(bugünkü gibi). Kodlarken görüldü: `hl=tr`'de Google konu adlarını kendisi Türkçe veriyor (`name`: "Hizmet", "Banyo";
`description` İngilizce), süreler "3 dk." / "1 sa. 15 dk." geliyor ve ikisi de okunuyor. Çeviri tablosu gerekmedi.

**Alanlar (`OfferOut` / `StayCandidate`'a eklenir):**
- `photo`: bugün de okunuyor (`images[0]`), değişmez.
- `nearby?: { name: string; mode: "walk" | "taxi" | "transit"; minutes: number }[]`: `nearby_places` içinden en çok
  iki: en kısa yürüme süreli yer (≤ 15 dk) ve havalimanı (önce toplu taşıma, yoksa taksi).
- `reviewTopics?: { topic: string; up: boolean }[]`: `reviews_breakdown`'dan en çok bahsedilen 3 konu; olumlu oranı
  ≥ %65 ise ↑, ≤ %45 ise ↓, arası atlanır. Konu adları sabit bir çeviri tablosundan (Service → hizmet, Cleanliness →
  temizlik…): **uygulamada** Google'ın kendi `name` alanı kullanıldı (hl=tr'de zaten Türkçe); "Property" / "Atmosphere"
  gibi bir şey söylemeyen konular atlanır, en az 10 bahis şartı var.

**Bilinçli dışarıda:** site site fiyat karşılaştırması (liste cevabında yok; otel başına ayrı arama ister).

## 2 · Uçuşta fiyat yargısı rozeti

**Görünüm:** fiyatın altında hap. Seviye kartın **kendi fiyatına** göre, Google'ın tipik aralığıyla:
fiyat < alt sınır → yeşil "↓ Fiyat düşük · normali €A–B"; aralıkta → gri "Fiyat normal · €A–B"; > üst sınır → amber
"↑ Fiyat yüksek · normali €A–B". (Deneme: IST→OPO "yüksek" çıktı; yalnız yeşil hâli çizildi, diğer ikisi aynı kalıpta.)
Hap tıklanabilir, 4–5'i açar.

**Kaynak:** yeni `?kind=price&from=IST&to=OPO&day=2026-11-12&adults=1` → `serp_fiyat` →
`engine=google_flights type=2 hl=en currency=EUR`; cevaptan yalnız `price_insights` saklanır:
`{ level, low, high, lowest, history: [[t, price]] }`.

**Ne zaman çağrılır:** yalnız planda fiyatı görünen bir uçuş kartı ekrana geldiğinde, rota + gün başına bir kez (eklenti
kendi tarafında da 24 saat hatırlar). Pano listesi ve seçenek kareleri çağırmaz.

## 3 · Kaynaklı fikir kartı

**Kaynak:** yeni `?kind=sights&city=Porto&country=Portugal` → `serp_yer` → `engine=google q="{şehir} gezilecek yerler"
hl=tr gl=tr`; `top_sights.sights` saklanır (ad, puan, küçük fotoğraf, açıklama). 30 gün.

**Kullanım:**
- AI'nın Gezilecek önerisinin adı Top Sights'taki bir yerle eşleşirse (küçük harf, aksansız, ilk iki kelime) o
  kartın fotoğrafı Google'ınki olur (bugün Wikipedia), etiket satırına "★ 4,6" eklenir; öneriler başlığında
  "puan ve fotoğraf: Google".
- Gezilecek önerisi 3'ten azsa Top Sights'ın ilk yerleriyle tamamlanır (zaten planda ya da önerilerde olan atlanır).

**Çizimden farkı:** **yorum sayısı gösterilmez** (Türkçe cevapta bozuk geliyor; `hl=en` ikinci arama ister).
**Restoran puanı yok:** Top Sights restoran döndürmüyor; çizimdeki Majestic Café puanı bu aramadan gelmez. Restoran
kartı bugünkü gibi kalır (Wikipedia fotoğrafı). Restoran puanı istenirse sonra: şehir başına bir Google Maps araması.

## 4 · Fiyat geçmişi grafiği (rozete basınca)

**Kaynak:** 2'nin cevabındaki `history` (deneme: 62 nokta, yaklaşık iki ay). Grafik **ilk gün dolu**; haftalarca
beklemek gerekmiyor.

**Kendi kaydımız da başlar:** `offers` her uçuş fiyatını (Aviasales, uçuş servisi, SerpApi) `price_log` tablosuna yazar
(rota, gün, fiyat, kaynak, zaman). Google geçmişi gelmediğinde (tavan) grafik bu kayıttan çizilir; en az 5 nokta
yoksa sol grafik gösterilmez.

**Görünüm:** çizimdeki sol grafik; mor bant = tipik aralık, yeşil nokta = bugün; altında "N hafta önce €X → bugün €Y".

## 5 · "Hangi gün uçarsan" grafiği (rozete basınca)

**Kaynak:** ortak uçuş servisi (Hetzner `/ucus/ara`), `depart: { from: gün−3, to: gün+3 }`; her günün en ucuzu.
SerpApi harcamaz, `ucus` tavanından (günde 450) bir çağrı. 12 saat önbellek.
Servis kurulu değilse ya da boş dönerse sağ grafik gösterilmez.

**Görünüm:** 7 çubuk, seçilen gün mor; altında "Seçtiğin gün en ucuz" ya da "N Ekim €X daha ucuz".

## 6 · Gece aktarması uyarısı

**Kaynak:** arama yok. Uçuşun bacak saatlerinden hesap: aktarmada bekleme ≥ 3 saat ve beklemenin bir kısmı aktarma
şehrinin yerel saatiyle 00:00–06:00 arasında → amber çip "⚠ Gece aktarması · Madrid’de 7 sa (00:55–07:55)".
Bacak saatleri yalnız uçuş servisinden ve SerpApi'den gelir; Aviasales önbelleğindeki uçuşlarda bacak yoksa çip çıkmaz.

## 7 · Airbnb ve tatil evi önerisi

**Bulgu:** Google'ın tatil evi sonuçlarında Airbnb yok (yalnız Bluepillow). Airbnb için ayrı Airbnb API gerekir.

**Önerim:** yalnız **ev / villa / daire niyetinde** (playbook ya da kullanıcının sözü: "villa", "ev", "daire",
kalabalık grup) Seçenekler'e en çok **bir** Airbnb ilanı eklenir. Diğer seçenekler bugünkü gibi. `engine=airbnb`,
`airbnb_domain=airbnb.com.tr`, tarih, kişi, `currency=EUR`; en yüksek puanlı ve "misafir favorisi" olanlardan biri.
Kart: Airbnb markası, puan + yorum + "Misafir favorisi", gecelik fiyat, fotoğraf, ✨ Önerimiz. Link doğrudan
airbnb.com/rooms: **komisyon getirmez**; bunu bilerek kullanıcıyı tutmak için ekliyoruz.
Kodlamadan önce bir deneme araması (Airbnb API henüz denenmedi).

## 8 · "O tarihlerde şehirde neler var"

**Bulgu:** Türkçe sorgu boş; İngilizce sorgu sonuç veriyor ama çoğu gece hayatı; tarih süzgeci yok.

**Önerim:**
- Sorgu İngilizce ve türlü: `"concerts festivals sports in {şehir}"` (deneme araması 1 kez yapılır, sonuç iyi değilse
  "Events in {şehir}").
- Yalnız **gezi tarihleri içindeki** etkinlikler kalır; adında pub crawl, party, club, open bar, VIP, Halloween party
  geçenler atlanır.
- Gezi başlangıcı 60 günden uzaksa arama yapılmaz (liste yakın tarihleri veriyor, kota boşa gider).
- Süzgeçten sonra 0 kalırsa sıra hiç çizilmez.
- İlk iki hafta ölçülür: kaç gezide sıra dolu çıktı. %30'un altındaysa madde kapatılır.

**Görünüm:** çizimdeki gibi, Viator önerilerinin altında "O tarihlerde {şehir}’de", bilet düğmesi bilet sitesine
(Eventbrite, MEO…) gider. Kaynak notu: "Google Etkinlikler".

## Uygulama sırası

1. Otel (1) · 2. Rozet + geçmiş grafiği (2, 4) · 3. Fikir kartı (3) · 4. Gece aktarması (6) ·
5. Hangi gün grafiği (5) · 6. Airbnb (7) · 7. Etkinlikler (8)

Her adım: `offers` fonksiyonu + `shape.ts` saf ayrıştırıcıları (birim testli, deneme cevaplarından örneklerle) →
eklentide kart satırı → `tsc` + `vitest` + e2e (değişen metinler için önce `e2e.mjs` taranır).
Supabase fonksiyonu ve `price_log` tablosu yayınla birlikte gider. **Yayın yalnız Emre "yayınla" deyince**; sürüm
numarası diğer Trip Radar oturumlarıyla paylaşılır, yayından önce sorulur.

## Açık konular

- Anahtar 2026-10-19'da sohbete yazıldı. serpapi.com'da yenilenirse Supabase `SERPAPI_KEY` ve `trip-radar/.env`
  birlikte güncellenmeli, yoksa canlıdaki yedek susar.
- Telefon görünümü ve klasik olmayan gezi (festival, kamp) çizilmedi.
- Restoran puanı (Google Maps araması) bu işin dışında.

## Uygulama durumu

- **Adım 1 (otel) kodlandı, 2026-10-19**, dal `serp-eklemeler`, commit yok, yayın yok. Google Hotels önde (`serp_otel`,
  günde 3; `serpapi` 8 → 5), `nearbyOf` / `topicsOf` / `serpMinutes` (shape.ts), `Item.nearby` / `Item.reviewTopics`,
  kartta `.z-near` ve `.z-tops` satırları, örnek gezide Jardim Stay'e örnek veri. tsc temiz, vitest 2445/2445.
- **e2e:** dalın tabanı (plan-v82-kod, yayınlanmamış 0.38.7) değişikliklerim olmadan da üç yerde kırılıyor: "Kartlar 390"
  yatay kaydırma, havayolu logosu adresi (`/airlines/64/` beklenirken `pics.avs.io/128`), gezi listesinde `.trip-card`
  zaman aşımı. Bu ikisini geçici olarak atlayınca iki taraf da aynı 17 testi geçiyor ve aynı yerde duruyor.
- Supabase `offers` fonksiyonu henüz deploy edilmedi.
- **Adım 2 (fiyat rozeti + geçmiş grafiği) kodlandı, 2026-10-19**, aynı dal, commit yok. Sunucu: `?kind=price`
  (`serp_fiyat` günde 2, `serpapi` 5 → 3; toplam yine 8), sorgu hep 1 kişi (`adults=1`, kişi başı ve paylaşılan önbellek),
  `priceInsightOf` / `logInsight`; uçuş önerileri her bulunduğunda kişi başı en ucuzu `price_log`'a yazılır
  (`supabase/price-log.sql`, **henüz uygulanmadı**; tablo yokken yazma ve okuma sessizce atlanır). Eklenti:
  `lib/priceVerdict.ts`, `liveSource.price` (24 saat `priceSeen`), uçuş kartında `.z-pv` hap ve kartın altında
  `.z-pvp` geçmiş paneli. **Çizimden fark:** grafikte kartın kendi fiyatı kesikli çizgiyle ("bu kart €74"), çünkü Google'ın
  geçmişi Google'daki en ucuzu; kartın fiyatı Kiwi/Aviasales'ten daha ucuz olabiliyor. Hap yalnız EUR fiyatlı kartta.
  vitest 2456/2456; e2e tabanla aynı (17 geçen, aynı bilinen takılma).
- **Adım 3 (kaynaklı fikir kartı) kodlandı, 2026-10-19**, aynı dal, commit yok. Sunucu: `?kind=sights` (`serp_yer`
  günde 1; `serpapi` 3 → 2; toplam yine 8), 30 gün önbellek, `topSights` (en çok 8 yer; yorum sayısı ve açıklama
  alınmıyor). Eklenti: `lib/citySights.ts` (`matchSight`, `sightSuggestion`), `liveSource.sights` (30 gün `sightsSeen`),
  Yapılacaklar satırı Gezilecek 3'ten azsa Google yerleriyle 3'e tamamlanır ("Google" rozeti, resimde "★ 4,8");
  AI'nın yer önerisi şehrin Google listesindeki bir yerle adıyla eşleşirse fotoğrafı ve puanı Google'ınki olur, yoksa
  Wikipedia (bugünkü gibi). Bir yer "Gerek yok" ya da "Plana koy" alınca anahtarı (`sight:şehir:ad`) gezinin önerilerine
  yazılır ve bir daha gelmez. vitest 2463/2463; e2e tabanla aynı.
  **Görülen, dokunulmayan:** 390 px'te yer kartlarında "+ Plana koy" yazısı düğmeden taşıyor (yer kartının düğme düzeni,
  AI yer önerilerinde de aynı; kart tasarım hattının işi). **Denenmeyen:** AI önerisinin Google'la eşleşmesi gerçek
  ekranda görülmedi (örnek gezide AI yer önerisi yok); yalnız birim testi var.
- **Adım 4 (gece aktarması) kodlandı, 2026-10-19**, aynı dal, commit yok. Arama harcamaz. Sunucu: uçuş servisinin
  (Kiwi/Google) ve SerpApi'nin bacak saatlerinden aktarmalar (`stopovers`), `nightStop` kuralı (3 saat ve üstü, bir kısmı
  o havalimanının saatiyle 00:00–06:00), teklifte `nightStop`. Eklenti: `Item.nightStop`, bilet çiplerinde kum rengi
  "⚠ Gece aktarması · Madrid'de 7 sa (00:55–07:55)" (`ticketView.nightChip`); telefonda iki satıra iner. Aviasales
  önbelleğindeki uçuşlarda bacak olmadığı için onlarda çıkmaz. vitest 2468/2468; e2e tabanla aynı.
- **Adım 5 (hangi gün uçarsan) kodlandı, 2026-10-19**, aynı dal, commit yok. SerpApi harcamaz. Sunucu: `?kind=days`
  → ortak uçuş servisi `depart: { on, flex_days: 3 }`, 1 kişi, 30 sonuç, her günün en ucuzu (`dayFares`), 12 saat
  önbellek, `ucus` tavanı. Eklenti: `liveSource.days` (12 saat `daysSeen`), fiyat panelinde ikinci sütun: 7 çubuk,
  kartın günü mor, en ucuzun fiyatı yeşil, altında "Seçtiğin gün bu haftanın en ucuzu" / "12 Kas €28 daha ucuz".
  Google yargısı yokken de hap çıkar ("Günlere göre fiyat") ve yalnız bu sütunla açılır. Panel geniş ekranda iki sütun,
  telefonda alt alta. vitest 2471/2471; e2e tabanla aynı. **Denenmeyen:** uçuş servisinin `flex_days` ile gerçekten
  7 günü döndürüp döndürmediği (yalnız sözleşmeye göre yazıldı; servis canlıda denenmedi).
- **Adım 6 (Airbnb) kodlandı, 2026-10-19**, aynı dal, commit yok. Deneme araması (8. arama): Lizbon 12–15 Kas, 18 ilan;
  ad, puan (5 üzerinden), yorum, "Guest favorite"/"Superhost", toplam fiyat ("for 3 nights") ve gecelik döküm,
  fotoğraf, doğrudan airbnb.com/rooms linki. Sunucu: stay isteğinde `home=1` → `serp_airbnb` (günde 1; `serpapi` 2 → 1;
  toplam yine 8), `airbnbOffer` (4.7+ puan, 20+ yorum, misafir favorisi önce) tekliflerin 3.'sü olur, `airbnbCandidate`
  adaylara da girer; link ortaklık linkine çevrilmez. Eklenti: `Need.home`, `intentFrame.wantsHome` (21+ gece, 5+ kişi ya
  da o şehirde kaydedilmiş daire/ev), hem kutunun araması hem sohbetin `find_offers`'ı bayrağı taşır. Kartta mevcut
  seçenek tasarımıyla çıkar (Airbnb rozeti, ★ 4,9, yorum, fotoğraf, gecelik). vitest 2475+; e2e tabanla aynı.
  **Denenmeyen:** gerçek sohbetle (AI'dan öner) uçtan uca; e2e'de anahtar yok. Yemek/mutfak isteği (`musts: kitchen`)
  ev sinyali sayılmadı.
- **Adım 7 (Google Etkinlikler) kodlandı, 2026-10-19**, aynı dal, commit yok. Deneme araması (9. arama) "concerts
  festivals sports in Lisbon" **boş döndü**; kanıtlı sorgu "Events in {şehir}" kullanıldı, yeni arama yapılmadı. Sunucu:
  `?kind=events` → `serp_etkinlik` (günde 1; `serp_otel` 3 → 2; toplam yine 8), konaklamaya 60 günden fazla varsa
  aranmaz, `cityEvents`: yılı olmayan tarih ("Oct 23") bugünden sonraki ilk güne çevrilir, yalnız konaklama günleri,
  gece hayatı (pub crawl, party, club, Halloween, free entry…) elenir, en çok 3, bilet sayfası önce. Porto deneme
  cevabında 8'in 6'sı elendi. Eklenti: `liveSource.events` (1 gün `eventsSeen`), Etkinlik ve turlar'da şehir başına
  "O tarihlerde Porto'da" sırası, kartta "23 Eki · 19:30 · mekân", "+ Plana koy" tur gibi plana ekler.
  vitest geçti; e2e tabanla aynı. **Ölçülecek:** iki hafta, kaç gezide sıra dolu çıkıyor; %30 altıysa kapatılır.

## Kota durumu (2026-10-19 sonu)

Günlük tavanlar: `serp_otel` 2, `serp_fiyat` 2, `serp_yer` 1, `serp_airbnb` 1, `serp_etkinlik` 1, `serpapi` (uçuş son
çare) 1 = 8 → ayda ≈240, ücretsiz 250'nin altında. Bu ay denemelerle 9 arama harcandı.

## Yayından önce yapılacaklar (hiçbiri yapılmadı)

1. Dalı commit'le (`serp-eklemeler`).
2. `supabase/price-log.sql`'i Supabase'e uygula (yoksa kendi fiyat kaydı sessizce atlanır, gerisi çalışır).
3. `offers` fonksiyonunu deploy et.
4. Eklenti sürümü: tabandaki 0.38.7 henüz yayınlanmadı ve e2e'de üç bilinen kırık var; sürüm numarası diğer
   oturumlarla paylaşılıyor. Yayın yalnız Emre "yayınla" deyince.
