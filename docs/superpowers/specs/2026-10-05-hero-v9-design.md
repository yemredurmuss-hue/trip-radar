# Hero v9 (0.35.0): referans görsele göre · tasarım

Kaynak: Emre, 2026-10-05, referans ekran görüntüsü (Porto ve Madeira Gezisi; sağda Emre & Sabine kartı).
"Referansta detay kaçırma; bilgi yoksa boş hâlleri de olsun, bilgi geldikçe belirsin."
Bu belge referansı öğe öğe koda bağlar: ne gösterilir, veri nereden gelir, tıklayınca ne olur, boşken ne görünür.
Önceki hero belgesi (`2026-10-05-hero-design.md`) ve DESIGN.md'nin Hero bölümü bununla değişir.

## Genel

- İki sütun aynı kalır: solda hikâye (~%62), sağda kart (~%34), aralarında 24 px; 760 px altında tek sütun.
- Renk değişkenleri (`static/app.css` başına, `--hx-` önekli):
  ink `#1c1a33` · muted `#6b6790` (mor-gri ikincil yazı) · accent `#5b45e0` · lav `#ece8ff` (lavanta zemin) ·
  mint `#eaf7f2` (ilerleme kutusu) · mintBar `#2cc79a` · card `#f7f5f1` (sağ kart) · line `#e7e4dd`.
- Kategori renkleri DESIGN.md'deki gibi kalır (uçuş `#6a4fe0`, konaklama `#23998b`, ulaşım `#c58a2e`, deneyim `#a8336f`).
- Yazı: sistem fontu (SF Pro) kalır. Ölçek: 40 başlık · 20 sağ kart başlıkları ve bütçe rakamı · 17 metin · 15–16 satır · 13–14 küçük.
- **Belirme:** boş hâlden dolu hâle geçen her blok yumuşakça belirir (`hx-appear`: 0,3 sn opaklık + 4 px yukarı kayma);
  `prefers-reduced-motion` ise yok. Bilgiler mevcut akışla gelir (IndexedDB değişince `notifyChanged` → yeniden çizim); yeni sorgu yok.

## Sol sütun

### 1. Fotoğraf
- Oran ~1,92:1 (geniş), dar ekranda 220 px yükseklik; köşe 22. Şehir başına bir fotoğraf (Pexels, Supabase `city-image` → `trip.cityImages`; mevcut).
- **Sol üst şehir seçici:** yarı saydam beyaz hap (`rgba(255,255,255,.82)` + bulanıklık), içinde şehirler; seçili olan
  dolu beyaz, kalın, ink; diğerleri muted. Yükseklik 40, yazı 16. 6 sn'de bir geçer; dokunmak seçer ve süreyi baştan başlatır (mevcut).
  Tek şehirde seçici yok.
- **Sağ üst:** geri sayım hapı (lav zemin, accent yazı, 15 px, yükseklik 40) ve ••• yuvarlak beyaz düğme (40 px).
  Geri sayım: "N gün kaldı" · "Yarın" · "Bugün" · "N. gün / T" · "Bitti" (mevcut `countdownText`). Tarih yoksa hap yok.
  İşleniyor hapı (iş varken) geri sayımın soluna beyaz küçük hap olarak gelir (dönen nokta + "2 kayıt işleniyor"; dar ekranda yalnız nokta).
- **Boş:** şehir/fotoğraf yoksa lavanta-gri yumuşak degrade zemin, ortada soluk manzara ikonu ve muted 14 px
  "Şehir belli olunca fotoğrafı gelir". Fotoğraf yüklenemezse aynı zemin.
- Eski "tarih + geri sayım" etiketi (fotoğrafın altına binen) kalkar.

### 2. Başlık
- 40 px, kalın, ink, `trip.title`. Tarz çipleri artık başlığın altında değil (sağ karta taşındı).

### 3. Tarih satırı
- Takvim ikonu (20, ink) · "7–18 Ekim" · nokta · "12 gün" (17 px, ink). Gün sayısı = gece + 1.
- Tarih tahminse önüne "~", `title`: "Tahmini · kayıtlardan".
- **Boş:** ikon + muted "Tarihler kaydettikçe netleşir".

### 4. Açıklama
- 17 px, muted (mor-gri), tek paragraf. AI'nin ton cümlesi (`trip.mood`; mevcut üretim, rakamsız, ≤120 karakter).
- Ton cümlesi yoksa (anahtar yok, hata, henüz yazılmadı) koddan gelen durum cümlesi (mevcut `statusSentence`);
  tarih de yoksa "Tarih ve şehir, kaydettikçe netleşir." Durum ilerleme kutusunda zaten görünür, ikisi birden yazılmaz.

### 5. Sayaç satırı
- Dört eşit hücre, aralarında ince dikey çizgi (1 px line, 36 px yüksek), zemin yok.
  Hücre: kategori renginde ikon (22) + "3 uçuş" (17 px, ink, rakam kalın değil). Uçuş · konaklama · ulaşım · deneyim, sabit sıra.
- Sayı mevcut `heroTally` (yalnız seçilen/rezerve olanlar; her ihtiyaç bir kez).
- **Tıklama:** hücre düğmedir; görünüm Plan'a geçer, o bölüm açılır (`setOpened`) ve bölüme yumuşak kayılır
  (uçuş → Uçuş, konaklama → Konaklama, ulaşım → Ulaşım, deneyim → Etkinlikler).
- **Boş:** sıfır olan hücre kalır ama soluk (ikon ve yazı muted, "0 uçuş"); dört hücre her zaman görünür, düzen oynamaz.

### 6. İlerleme kutusu "Rezervasyonların"
- Mint zemin, köşe 20, iç boşluk 22. Solda üstte "Rezervasyonların" (17 px, kalın, ink); aynı satırda sağda
  "3/6 onaylandı · %50" (15 px muted, "%50" ink). Altında çubuk: 12 px, tam yuvarlak, iz `#dfe4e8`, dolgu mintBar.
  Sağda dikey ortalı koyu düğme (ink zemin, beyaz, 17 px, yükseklik 52, köşe 14): "Planı tamamla →".
- **Sayı:** Plan bölümlerinin başlıklarındaki "3/4"lerin toplamı (`sectionProgress`: settled / total, bütün bölümler);
  böylece hero ile bölüm başlıkları hep aynı şeyi söyler.
- **Düğme:** sıradaki işe gider (mevcut `progress.todos[0]` → `reveal`); `title`/`aria-label` sıradaki işin metni
  ("Karar ver: Madeira konaklama").
- **"3/6 onaylandı" tıklanır:** hero'nun altında bütün yapılacaklar listesi açılır/kapanır (mevcut `TodoList`, bütün türler;
  satıra basınca karta gider). Eski "Karar ver 3 · Rezerve et 1 · Planla 4" satırı kalkar.
- **İptal süresi:** ücretsiz iptali yaklaşan varsa sayının yanında amber "⏳ 2"; tıklayınca listede yalnız onlar.
- **Hepsi tamam** (total > 0, settled = total): "Her şey hazır", çubuk dolu, düğme "Paylaş →" (paylaşılamayan
  örnek gezide düğme yok).
- **Boş** (total = 0): "Rezervasyonların" + muted "Henüz kayıt yok", boş iz; düğme "İlk kaydı ekle →" Plan'ın
  genel "+ Ekle" penceresini açar.

## Sağ kart

Card zemin, köşe 22, iç boşluk 24. Bloklar arasında 1 px line çizgi, 20 px boşluk.

### 7. Yolcular
- Üst üste binen yuvarlaklar (52 px, 3 px beyaz halka, −12 px bindirme, en fazla 4, fazlası "+N"). Fotoğraf yok:
  baş harf, her kişiye sabit pastel zemin (sıradan).
- Sağında ad satırı (17 px yarı kalın, ink): "Emre & Sabine" (iki kişi), "Emre, Sabine +1" (üç ve üstü); altında "2 kişi" (15 px muted).
  Paylaşılıyorsa altında mevcut `ShareLine` (13 px).
- **Kaynak:** paylaşımdaki adlar (`useShare`: `me` + `members`), yoksa kayıtlardaki yetişkin sayısı (`facts.adults`).
- **Ad yok, sayı var:** yuvarlaklar kişi ikonu; başlık "2 kişi", altında accent "Birini davet et" (paylaşım penceresi).
- **Boş:** tek kesikli yuvarlak + "Kimler gidiyor?" + muted "Kişi sayısı kayıtlardan anlaşılır".
- **Tıklama:** yuvarlaklar ve ad paylaşım penceresini açar (örnek gezide tıklanmaz).

### 8. Tarz çipleri
- Hap (yükseklik 40, yuvarlak, 16 px, ikon 20): her tarzın kendi ikonu ve rengi (aşağıda). Bütçe kelimesi (Ekonomik /
  Orta bütçe / Yüksek bütçe) nötr gri zeminli cüzdan ikonlu hap. En fazla 2 tarz + 1 bütçe (mevcut kural).
- Renk/ikon tablosu (zemin / yazı):
  Macera dağ `#e3f3ea/#1f7a4d` · Lüks ışıltı `#ece8ff/#5b45e0` · Romantik kalp `#fde8ee/#b4235a` · Dingin yaprak `#e6f2f1/#23786f` ·
  Kültür sütunlar `#f3ebe0/#8a5a1c` · Doğa ağaç `#e8f3e0/#3f7a1c` · Gastronomi çatal `#fdeee3/#b4532a` · Deniz dalga `#e3f0fb/#1d63b8` ·
  Şehir binalar `#eceef3/#3d4a63` · Aile kişiler `#fff3dc/#9a6400` · Eğlence nota `#f3e6fb/#7b2fa8` · Aktif koşu `#e6f1fb/#2563c9`.
- **Kaynak:** `trip.style` (LLM, sabit listeden; mevcut) + `budgetLevel` (mevcut).
- **Boş:** tek kesikli muted hap "Tarzın konuştukça belirir".

### 9. Bütçe
- Başlık satırı: "Bütçe" (20 px kalın) solda, rakam (20 px kalın) sağda. Rakam: belirlenen bütçe varsa o, yoksa bilinen
  toplam (rezerve + planlanan); bütçe yoksa `title` "Bütçe belirlenmedi; bilinen toplam".
- Altında satırlar (16 px, nokta 10 px): yeşil "Rezerve" · amber "Planlanan" · (bütçe varsa) gri "Boşta" ya da kırmızı
  "Aşıyor". Sıfır olan satır yazılmaz. Çubuk yok.
- Para birimi bugünkü gibi gezinin bütçe para birimi (`budgetBar.currency`).
- **Tıklama:** mevcut açılır pencere (kategori kırılımı, Kalan, "karar bekleyenler seçilince ~X daha", sayılamayan fiyatlar).
- **Boş:** "Bütçe" + "—", altında muted "Fiyatlı kayıtlar geldikçe toplanır".

### 10. Tercihler ("Seni böyle anladım"ın yeni yeri)
- Başlık "Tercihler" (20 px kalın). Altında en fazla iki satır: solda muted etiket, sağda muted değer (16 px).
- Satırlar (`preferenceRows`, saf fonksiyon, `lib/preferences.ts`): önce söylenen öncelikler, düzeye göre gruplanıp
  yüksekten düşüğe ("Fiyat + konum" → "Çok önemli"; "Konfor/temizlik" → "Önemli"); sonra kategoriye özel öncelikler
  ("Konaklama · konum" → düzey), şartlar (→ "Şart"), istenen olanaklar (→ "İstiyorsun"), onaylanan sezgiler
  (→ "Önemli" / "İkinci planda"), notlar (→ "Not"), "sorun değil" bulguları (→ "Sorun değil"), "önemli" bulguları (→ "Eler").
  Etiket ilk harfi büyük, sonrakiler küçük, " + " ile.
- Altında accent bağlantı "+7 tercih ›" (kalan giriş sayısı); kalan yoksa "Düzenle ›". Bekleyen soru varsa yanında
  mor nokta ve "· 1 soru".
- **Tıklama:** bağlantı (ve başlık) mevcut "Seni böyle anladım" penceresini açar, sayfayı itmez, sağ kartın üstünde:
  her giriş kapsam etiketi + metin + gri kaynak + ×; bekleyen soru Evet/Hayır; alt not "Yanlış olanı × ile kaldır;
  yenisini sohbette söylemen yeter." Mantık `IntentCard.intentEntries` ile aynı.
- **Boş:** muted "Konuştukça ve seçtikçe seni tanıyacağım."; bekleyen soru varsa "1 soru ›" bağlantısı.

### 11. Ülke ve hava
- Bayrak (emoji, ülke kodundan; 26 px, 4 px yuvarlatılmış kutuda) + ülke adı (17 px ink). Birden çok ülke yan yana sarılır.
- Altında hava: şehir başına "Porto ☀ 24°" (şehir 16 px ink, ikon 22 renkli: güneş amber, bulut/yağmur ink çizgi, derece 16 px);
  şehirler arasında dikey çizgi; 2'den fazlası alt satıra sarılır. `title` mevcut `weatherTitle` (tahmin mi geçmiş yıllar mı).
- **Kaynak:** `countriesOf(items)` + ülke kodları; hava Open-Meteo (`useWeather`, mevcut).
- **Boş:** ülke yoksa muted "Ülke ve hava, şehir belli olunca gelir"; hava gelmediyse yalnız bayrak satırı.

### 12. Küçükler satırı
- Dört hücre, aralarında dikey çizgi: € "Euro" · fiş "C/F priz" · saat "−2 saat" · konuşma balonu "Portekizce"
  (ikon 18 ink, yazı 14 muted). `title`'lar mevcut (kur, adaptör, "senin saatine göre").
- Saat farkı: "−2 saat" ("sa" değil); fark yoksa "Aynı saat".
- **Boş:** ülke bilinmiyorsa satır yok.

## Sekmeler
- Kart görünümü yerine alt çizgili sekmeler, ortalı: "Plan | Günlük akış | Belgeler" (17 px; aralarında ince dikey çizgi).
  Seçili ink ve yarı kalın, altında 3 px accent çizgi (yuvarlak uçlu); diğerleri muted.
- Referansta "Gün gün" yazıyor ve Belgeler yok; referans Belgeler'i bilmeden çizildiği için **adlar bugünkü gibi kalır**
  (Emre isterse "Gün gün" tek satırlık değişiklik).

## Taşınanlar (hiçbir bilgi kaybolmaz)

| Eski | Yeni yeri |
| --- | --- |
| Fotoğraf altındaki tarih + geri sayım etiketi | Geri sayım fotoğrafın sağ üstünde, tarih başlığın altında |
| Başlık altındaki tarz çipleri | Sağ kart, renkli ikonlu |
| Künye "Süre" | Tarih satırında "12 gün" |
| Künye "Ülke", "Lokasyonlar" | Bayrak satırı; rota linki ••• menüsünde "Rotayı haritada gör" (yoksa eklenir) |
| "Sıradaki adım" düğmesi | "Planı tamamla →" (aynı hedef) |
| "Karar ver 3 · Rezerve et 1 …" satırı | "3/6 onaylandı" tıklanınca açılan liste; ⏳ ayrı |
| "Seni böyle anladım" satırı | Sağ kartta "Tercihler" |
| Bütçe çubuğu | Rezerve / Planlanan satırları; kırılım tıklayınca |

## Kapsam dışı
Gezilerim listesi, Plan/Günlük akış kartları, kişi fotoğrafları (yalnız baş harf), bütçenin ev para birimine çevrilmesi.

## Doğrulama
- Birim: `preferenceRows` (gruplama, sıralama, etiket biçimi, boş); toplam ilerleme = bölüm "3/4"lerinin toplamı;
  yolcu başlığı ("Emre & Sabine", "A, B +1", sayı, boş); bayrak emojisi (PT → 🇵🇹, geçersiz → boş); `offsetText`
  "saat"/"Aynı saat"; her tarzın ikon ve rengi tanımlı.
- e2e (headless): hero adımları yeni yapıya göre (sayaç dört hücre, ilerleme kutusu "x/y onaylandı", Planı tamamla karta gider,
  sayaç hücresi bölümü açar, Tercihler penceresi açılır, × çalışır); boş gezide boş hâller (fotoğraf yeri, "Henüz kayıt yok",
  "Kimler gidiyor?", tarz boş hapı); TR geniş + dar ekran görüntüsü; dar ekranda yana kayma yok, satırlar kesilmez.
- Mevcut testler yeşil.

## Revizyon 1 (2026-10-05)

Kaynak: Emre, gerçek gezisinde ("Porto & Madeira") hero'ya bakınca üç düzeltme istedi.

### 1. Künye ilerleme kutusuyla aynı hizada biter; Tercihler anahtar kelime
- "Künye aşağı taşmış çünkü tercihlerin detayları özet keyword gibi gözükmek yerine çok bilgi girmiş."
- **Tercihler satırı tek satır anahtar kelimedir** (`preferenceRows`, `lib/preferences.ts`): solda en fazla ~3 kelime, sağda değer.
  - Öncelikler aynı ("Fiyat + konum" → "Çok önemli").
  - Not: kod konusunu tanıyorsa konusuyla (`decision.ts noteCriteria`, `saidTopics`/`WISH_TOPIC` ile aynı tablo):
    "Sessiz bir yer istiyoruz" → "Sessizlik" · "Önemli" (notun o konuyu "Önemli" yaptığı düzey). Aynı ada çıkan iki not tek satır.
  - Tanımıyorsa gezginin modeli 1–3 kelimelik etiket verir, panonun dilinde; bekleyen notlar tek istekte, not başına
    bir kez (`trip.prefLabels`, anahtar = not id + metin özeti; not değişirse yeniden sorulur). Etiket değilse (uzun,
    cümle) "" saklanır, yeniden sorulmaz. Anahtar yoksa ya da hata: sessiz.
  - Etiket gelene kadar ya da hiç gelmezse: ilk üç kelime + "…" ("Odada mutlaka bir…") · "Not".
  - Bulgu ("Sorun değil" / "Eler"): metni üç kelimeyse kendisi, değilse kısa etiketi ("Yan binada inşaat gürültüsü" → "Gürültülü").
  - Tam metin pencerede ("Düzenle" / "+N tercih") değişmeden durur; satırın etiketi son çare olarak "…" ile kesilir, `title`'da tamamı.
- **Hizalama:** hero ızgarasının satırı esner (`align-items: stretch`); kart dikey flex. Kart kendi başına sıkı
  (çizginin iki yanında 14 px; bütçe, tercih ve hava aralıkları daraldı); artan yer her çizginin iki yanına eşit
  dağılır (ortadaki bloklar iki kat büyür ve içeriğini ortalar, ilk blok üstte, son blok altta kalır). 1440×900'de
  örnek gezi ve uzun bir notla kart hikâyeden uzun değildir; uç durumda (dört ülke) kart uzar, hiçbir şey kesilmez.
- e2e: 1440'ta `|kart.alt − ilerleme.alt| ≤ 2 px` (önce uzun not eklenir) ve kart taşmaz; 1280'de de aynı hizada (ölçülüp yazılır).

### 2. Dört plan hücresi
- "Transport taksi vs olmasına rağmen 0 yazıyor. Experience iki satıra düşmüş tek olması gerekirken."
- **Sayı = Plan bölümünün tuttuğu kayıt sayısı** (`sectionTally`, `lib/heroInfo.ts`; eski `heroTally` kalktı): uçuş = Uçuş,
  konaklama = Konaklama, ulaşım = Ulaşım (taksi, transfer, tren, kiralık araç, yol), deneyim = Etkinlikler + Yapılacak
  şeyler + Restoranlar. Bölüm başlığındaki "x/y"nin y'siyle aynı; gizlenen ve "Gerek yok" sayılmaz. Onay ayrı:
  "x/y onaylandı" kutusu. Deneyim hücresi içi dolu ilk bölümü açar (Etkinlikler → Yapılacak şeyler → Restoranlar).
- **Hücre her zaman tek satır:** yazısına göre genişler (`white-space: nowrap`), dördü `space-between` ile yayılır,
  aradaki çizgiler kendi öğeleri (`.hx-sep`) olduğu için boşluğun ortasında durur. Eşik hikâye sütununun container
  query'si, en geniş gerçekçi etiketlerden hesaplandı: İngilizce iki haneli ("12 flights", "12 stays", "12 transport",
  "12 experiences": 17 px'te 335, 16 px'te 316 px yazı) + dört hücrenin ikon/boşluk/iç boşluğu (4 × 38) + üç çizgi
  (3 × 13) → 17 px'te 526, 16 px'te 507. 540'tan itibaren 17 px, 520–539 arası 16 px, altında 2×2 (o da tek satır).
  1440'ta hikâye ~526 px: TR ve EN dört hücre tek sırada, 16 px.
- e2e: 1440'ta tek sıra, her hücre tek satır, satır taşmıyor; aynı ölçüm en geniş EN ("12 experiences") ve TR
  ("12 konaklama") etiketleriyle de yapılır (hücre yazıları ölçüm için yerinde değiştirilip geri konur; e2e'nin
  İngilizce geçişi yok).

### 3. Ana destinasyonlar ve alt yerler
- "Guala diye bi yer gelmiş destinasyona … Daha büyük lokasyonlar ana lokasyonlar olsun, alt lokasyonlar günlük planlarda yer alır."
- **Saf eşleme** (`lib/destinations.ts`): `mainPlaces(cities, parents)` ilk görünme sırasını korur, `cityKeyOf` ile
  büyük/küçük harf ve aksan farkını tekler. Ana yerin adı modelin verdiği addır (gezinin yerlerinden biriyse gezideki yazılışı).
- **Ebeveynler gezginin modelinden**, konaklama şehirleri kümesi başına bir kez (anahtar = sıralı şehir anahtarları),
  `trip.placeParents` içinde; iki şehirden azsa sorulmaz. İstem: sıradaki yerler (biliniyorsa ülkesiyle); daha büyük
  bir destinasyonun içindeki küçük yer ya da bilinen bir ada/bölgedeki yer için o destinasyonun yaygın adı (Gaula →
  Madeira, Funchal → Madeira, Câmara de Lobos → Madeira; Sintra → Lizbon yalnız Lizbon da konaklamaysa); ayrı
  gecelenen iki gerçek şehir asla birleşmez (Porto ve Lizbon ayrı).
- **Denetim** (`acceptParents`): yalnız gezinin yerleri; kendine eşleme, boş ya da 40 karakterden uzun ad atılır;
  zincir (ebeveyni de başka yerin içinde olan) ve döngü atılır. Uygulamanın zaten aynı şehir saydığı başka ad
  (Madeira ≡ Funchal, `CITY_ALIASES`) atılmaz: yeri taşımaz, ana yerin adını verir.
- **Cevap gelmeden** (anahtar yok, hata): konaklamanın adresi ya da bölgesi gezinin başka bir yerini adlandırıyorsa
  ona katlanır (`fallbackParents`), yoksa bugünkü gibi kendisi.
- **Yalnız hero'da:** şehir seçici, fotoğraflar (ana yerin adıyla aranır, `trip.cityImages` ana yerin anahtarıyla),
  hava (üyelerin gecelerini kapsayan aralık, `cityRanges`), ton ve tarz anahtarları, durum cümlesindeki şehir ana yerleri
  kullanır. Fotoğraf, ton ve tarz istekleri ana yerler belli olana kadar bekler (Gaula için foto istenmez). Günlük akışın
  gün kartı kendi şehrinin fotoğrafı yoksa ana yerinkini alır (TripPanel'deki `cityImageOf`; `days/*` değişmedi).
  Plan (`CategoryPlan cities`) ve Günlük akış değişmez. Ülkeler zaten kayıtlardan okunuyor, değişmez.
- Test: `mainPlaces`, denetim ve tahmin için birim testleri; e2e'de sahte modelle sohbetten Funchal ve Gaula
  konaklamaları → hero "Porto | Madeira", Plan'da Gaula ve Funchal duruyor, her şehir kümesi bir kez soruluyor.
