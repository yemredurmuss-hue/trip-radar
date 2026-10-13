# Plan v46 izlenebilirlik tablosu (2026-10-13)

Eşlik eden belge: `docs/superpowers/specs/2026-10-13-plan-v45-kod-plani.md` (faz ve paket numaraları oradadır: F0–F10, FB; §7 iş paketleri). Salt okunur çıkarım; kod değişmedi. Hedef: **v46** (onaylı).

## Nasıl okunur
- **Kimlik:** `docs/envanter/01-kararlar.md` (410 karar satırı, K1–K75 dahil), `02-hareket-ve-sohbet.md` (154 hareket satırı: H/A/K/P/W/S/C/M), v46 mockup'ı (`docs/mockups/plan-v46-sira/index.html`, `origin/plan-v30-wip`; 46 bileşen/ekran) ve v40–v46'nın envanterde olmayan yeni kararları (N1–N15).
- **Karşılık:** `F0…F10`/`FB`/`P…` (kodlanacak), **zaten canlı** (kodda var; "F? dokunur, korunur" = o faz bu davranışa dokunur ve bozmamalı), **YAPILMIYOR: gerekçe**, **KAPSAM AÇIĞI** (karar eksik: aşağıdaki kapanış kuralı).
- **Doğrulandı:** F10 denetçisi (kodlamayı yapmamış bağımsız ajan) her satırı kanıtla (dosya:satır / test / ekran görüntüsü çifti) işaretler. Başlangıçta hepsi ☐.
- **Kapanış kuralı:** `KAPSAM AÇIĞI` satırları için Emre yazılı karar verir (yap → faz/paket atanır; yapma → "YAPILMIYOR: bu sürümde değil, backlog"). Karar çıkmadan ya da herhangi bir satır ☐ iken **yayın yok**. "DOĞRULANAMADI" olan eski kararların "F10 doğrular" dediği satırlar denetçinin kodda arayıp bulmasıyla kapanır; bulunamazsa KAPSAM AÇIĞI'na döner.
- Satır numaraları ve durumlar envanterin 0.36.84 çıkarımından gelir.

## Özet (satır sayıları)
| Karşılık türü | Satır |
|---|---:|
| Faz / paket (kodlanacak ya da denetlenecek) | 167 |
| Zaten canlı (korunur) | 369 |
| YAPILMIYOR + gerekçe | 52 |
| KAPSAM AÇIĞI (Emre kararı bekliyor) | 22 |
| **Toplam (A+B+C)** | 610 (+15 yeni karar satırı D bölümünde) |

### KAPSAM AÇIĞI satırları (22): Emre kararı gereken tam liste
- **PG31**: Plan şeritleri A (planın içinde) / B (çekmecede), hazır gelenler (etkinlik, yapılacak, res
- **HS22**: Hero'nun v9 parçaları korunur: "Yapılacakları göster" listesi, ikinci düğme (PDF / Paylaş)
- **HS24**: Öneri: Pexels'ten 30 sonuç çekip kural-seçimi (oran 1,4–2,2, ≥3000 px, kişi/yemek alt'ı el
- **K6**: Her kartta "neden" satırı, kullanıcının kelimesiyle ("Direkt uçuş · lüks dediğin için"); v
- **KM16**: forWho paylaşılan gezide paylaşılmaz (kayıtlar paylaşılmaz); kişi başı bütçe/masraf bölüşm
- **ZU12**: Akıllı saat: gece yarısı sonrası iniş (00–05) için "inişte kalacak yer yok" kırmızı uyarı;
- **PS08**: Tek link: https://<davet sayfası>/j/#TR1:… (kod #'den sonra, sunucuya gitmez); statik dave
- **PS10**: Chrome Web Store'da liste dışı (unlisted) sayfa ($5 geliştirici hesabı, gizlilik politikas
- **PS15**: Her kullanıcıya kişiye özel gizli mail adresi (Resend gelen mail + Supabase Edge Function)
- **GS01**: Link yerleştirme belirsizliği: model linkin yerinden emin değilse Pano'nun gelen kutusuna 
- **GS02**: Bir gezide iki sebep (festival + dalış): iki sebep kartı mı, bir kart iki satır mı?
- **GS03**: Gerçek otel/yer fotoğraflarının kaynağı ve maliyeti (Booking/Airbnb kaydı, Google Places);
- **GS11**: Kişisel hafıza (geçmiş yol arkadaşları "kimle" çipi; kalıcı kısıt yalnız onaylanırsa, yere
- **GS13**: Gezi düzeyinde "uçaksız / yalnız tren" kısıtı yok (şartlar seçenek düzeyinde, ör. direct_f
- **GS16**: P10 kişisel hafıza (akıllı planlayıcı E), P11 ilham birikimi (AI'nın bulduğu blog/YouTube)
- **GS19**: Veri sözleşmesi: Slot (kutucuk = Need) {id, section, kind, title, place, dates, people, wh
- **VB-O5**: Sıra: 1 ilk ekran (P3-P6), 2 niyet kartı derin hâli (P4-P9), 3 fikir standardı (P7), 4 ver
- **VB-O8**: Sonra: vibe (ışık, teras, yeşillik; fotoğraftan), kısmi konaklama kombinasyonları, "farka 
- **EK-A11**: v30: PDF/Paylaş ikinci düğmesi ••• menüye taşınır; canlı: hem menüde hem hero'da "PDF indi
- **PLAN-06**: Paylaşım: ücretsiz Supabase projesi, tablolara doğrudan erişim yok, her fonksiyon gezinin 
- **S21**: Ana ekran önerileri çalışır
- **M18**: "Yol gezisi · yakında" etiketi

Öneri varsayılanı (Emre itiraz etmezse): bunların hepsi v46 ekranlarının dışındadır (paylaşım v2, kişisel hafıza, gezi başlatma backlog'u, yol haritası sırası, hero PDF düğmesi, "Yol gezisi · yakında" etiketi); bu sürümde **yapılmaz**, backlog'a yazılır; yalnız K6 (kartta "neden" satırı), PG31 (Plan şeritleri) ve HS22 (hero PDF düğmesi) tasarım kararı ister.

## A. Karar satırları (01-kararlar.md, 410)
| Kimlik | Karar (kısa) | Envanter durumu | Karşılık | Doğrulandı |
|---|---|---|---|---|
| PG01 | Bölümler her gezide aynı ad ve sırada: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Ya | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K33 | Gezi türü yalnız içeriği değiştirir (hangi kartlar açılır, Gezinin sebebi, kapalı öneriler | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K9 | Plan kategori kategori dizilir; yolculuk/gün sırası tek tıkla geçilen görünüm seçeneği. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG03 | Yalnız iki sekme: Plan · Pano (sayı). "Gün gün" ve "Belgeler" sekmeleri kalkar; Belgeler y | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG04 | Sağ üstte ••• menü: Belgeler (tüm belgeler tek liste) · Paylaş · PDF olarak indir · Geçmiş | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG05 | Tek sekme çubuğu Plan · Gün gün · Pano · Belgeler (hero altındaki ikinci çubuk kalkar). | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| PG06 | "Gün gün" planın üçüncü görünümü olur; harita anahtarı (v11 kararı: Liste\ | ? | zaten canlı (Gün gün planın üçüncü görünümü: PlanOrder); F5b ile aynı sekme çubuğu; F10 doğrular | ☐ |
| PG07 | Plan başlığı tek satır: kalın "Plan" · küçük gri segment (Kategoriye göre / Yolculuk sıras | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| PG08 | Her bölüm ayrı beyaz kart; başlık: renkli ikon karesi, ad + sayı ("Uçuş 2"), aşama satırı, | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K43 | Bölümler açılır/kapanır; başlıkta renkli ikon karesi, sayı, aşama çubuğu ve bütçe ("€2.690 | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K52 | Bölümler açık gelir; kapatmak kullanıcının seçimi (gezi başına hatırlanır). | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG09 | Bölüm içi kartlar ızgarada (2 sütun; ulaşım 3), tarih sütunu ve zaman çizelgesi yok; kartl | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG10 | Bölüm sonundaki "+ Ekle" ve kartlar arasındaki "+" (üstüne gelince) korunur; "+" basınca f | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG11 | Gizlenenler bölümün sonunda tek sessiz bağlantı ("Gizlenenler · N göster"); bütün türleri: | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG12 | Boş bölüm çizilmez (gizlisi de yoksa); en altta "Ekle:" çipi olur. Kural: tek istisna vize | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG13 | Kart boyu sabit: aynı sıradaki kartlar eşit boyda, alt şerit (fiyat · düğme) hep en altta; | CANLI | zaten canlı; F0, F1, F3, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PG14 | Plan kartı başlıkları (otel, uçuş, ulaşım, şehir) 1 satır "…"; etkinlik/yapılacak adı en ç | CANLI | zaten canlı; F5a, F3 dokunur, korunur (F10 doğrular) | ☐ |
| PG15 | Sayfa değil panel kayar: panel içindeki mutlak konumlu öğeler panele bağlanır (.panel, .ca | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG16 | Kart içeriği tek standart: hücreden geniş olmaz, uzun ad sarar, canlı kutucuklar sığdığı k | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| PG17 | Test kararı: vitest (zamana göre gösterme, set durumu, Ozora oyun kitabı, uzun ad, marka t | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG18 | Emre v30'u onayladı ("Tamam bunu onaylıyorum artık", 2026-10-11). Onaylananlar: kart açılı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG19 | Üç menü alternatifinden A seçildi (Plan · Pano, Gün gün planın görünümü, Belgeler ••• menü | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG20 | Her parça için sıra: akış → UX → UI çizimi (artifact, sayfa sayfa) → Emre onayı → spec → k | ÇELİŞKİ | YAPILMIYOR: süreç kuralı (K74: çizim lehine çözülür); bu plan v46 onayından sonra kodlar; F10 uyumu denetler | ☐ |
| PG21 | Trip Radar Booking/Skyscanner ile yarışmaz, onları kullanır: niyeti netleştirir, doğru ara | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG22 | Etkinlik ve turlar: kaynaktan gerçek teklifler planda kare gelir; kaynak açık ("Pano'dan"  | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| PG23 | "× çıkarır, ↻ yerine başkasını koyar" (etkinlik karelerinde). | YAYINDA DEĞİL | F6 (etkinlik kartı hover araçları: ↻ yerine başkasını öner, ✓ bileti aldım, × çıkar; v40 hz-tools) | ☐ |
| PG24 | v13: sade niyet kartı + altında açılan liste (Pano'dan, sonra Önerimiz), aşama renkleri sa | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG25 | v15: Pano'da çok seçenek kartta ilk 4 + 2 "Pano'da geniş aç"; v16: link atma anı (8 link d | DOĞRULANAMADI | YAPILMIYOR: Pano v46 düzeni (3. kart şeridi, ilk 4 + 2 yerine uçuş kartları şeritte) bu kararın yerini aldı; F1d/F2 | ☐ |
| PG26 | v17: niyet kartında tahmini fiyat aralığı, hero'da tahmini toplam ve bütçeye sığıyor mu; v | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG27 | v20: uçuş bileti Skyscanner netliği (logo, sefer no, saat, süre, aktarma, +1), ulaşım ince | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG28 | v22: illüstrasyonların beyaz zemini karışsın (mix-blend multiply), otel görseli 3:1 kırpma | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG29 | v25: Gezilecek ve yemek = kaydedilen yerler (gidilmesi garanti değil, plana sayılmaz); seç | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG30 | v28: canlı şerit, iptal geri sayımı, ••• menü, katlanan kart, ayarlandı, boş ulaşım; v29:  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PG31 | Plan şeritleri A (planın içinde) / B (çekmecede), hazır gelenler (etkinlik, yapılacak, res | DOĞRULANAMADI | KAPSAM AÇIĞI: Plan şeritleri A/B (seritler mockup'ı) v46 ekranlarında yok; Emre kararı gerekir (yap / bu sürümde yapma) | ☐ |
| HS01 | Hero ekrandan çıkınca sayfanın tepesine yapışır: tam genişlik, opak, boşluksuz; arkası gör | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| HS02 | Halka hazır yüzdesi; koyu yeşil rezerve, açık yeşil seçildi (üç ton); üstüne gelince "6 re | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| HS03 | Halka çizimdeki "%77 hazır" değil, kahramanın kendi sayısı ("Planlananların %X'i rezerve") | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| HS04 | Bütçe tek satır "~€7.347 / €9.000"; bütçeye sığıyorsa yeşil, aşıyorsa kırmızı nokta. | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| HS05 | Plan \ | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| HS06 | Dar ekranda sırayla gizlenir: önce "hazır" yazısı ve ayırıcılar, sonra bütçe ve kapak; Pla | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS07 | Denetim eksikleri (şerit sayfa tepesine yapışsın, Pano sayısı, kısa "Sıradaki", "Her şey h | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS08 | Hero bugünkü v9'un içeriğiyle kalır; parçalar gezinin kendi bilgisinden (ülke, şehirler, h | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS09 | İki sütun: solda hikâye (~%62), sağda kart (~%34), aralarında 24 px; 760 px altında tek sü | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS10 | Fotoğraf ~1,92:1 (dar 220 px), köşe 22; sol üstte şehir seçici (6 sn'de geçer), sağ üstte  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS11 | 40 px başlık; takvim · "7–18 Ekim · 12 gün" (tahmin "~"); tek cümle: AI ton cümlesi (≤120  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS12 | Dört hücre (uçuş · konaklama · ulaşım · deneyim), kategori renginde ikon, tek satır, sıfır | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS13 | Mint kutu "Rezervasyonların": "3/6 onaylandı · %50" + çubuk; "Planı tamamla →" sıradaki iş | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K10 | İlerleme hero'da. Ayrı "Tutulacaklar" şeridi yok; hero barı "Bali planın şekilleniyor 0/8" | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K61 | Ana buton sabit: "Planı tamamla →" değişmez; altında küçük değişen ipucu "Sıradaki: Osaka  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K67 | "Sıradaki" ipucu kalktı (K61 geri alındı): sırayı sohbet söyler; "Planı tamamla →" sabit. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS15 | Üst üste yuvarlaklar (52 px, baş harf, en çok 4 + "+N"); "Emre & Sabine" · "2 kişi"; ad yo | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS16 | Modelin sabit listeden en çok 2 tarzı + bütçe hapı; her tarzın kendi ikonu/rengi; bütçe dü | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS17 | Rakam (bütçe, yoksa bilinen toplam) + Rezerve / Planlanan / Boşta ya da kırmızı Aşıyor sat | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS18 | "Seni böyle anladım" sağ kartta "Tercihler": en çok 2 satır, her biri tek satır anahtar ke | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS19 | Bayrak + ülke; şehir başına gündüz derecesi (10 gün kala tahmin, öncesi son 5 yılın aynı g | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS20 | Sağ kart ilerleme kutusuyla aynı hizada biter (e2e: \ | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS21 | Hero'nun şehirleri ana destinasyonlar (Gaula → Madeira); ebeveynler gezginin modelinden, k | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS22 | Hero'nun v9 parçaları korunur: "Yapılacakları göster" listesi, ikinci düğme (PDF / Paylaş) | ÇELİŞKİ | KAPSAM AÇIĞI: hero ikinci düğme (PDF/Paylaş) v30'da ••• menüye taşınacaktı, canlıda ikisi birlikte; v46 hero'su menü varsayar (topbar ••• "Belgeler · Paylaş · Geçmiş"); küçük ayrı iş, Emre onayı | ☐ |
| HS23 | Fotoğraf: ana kaynak Unsplash (en çok beğenilen 10'dan), yedek Pexels, sonra Wikipedia; et | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS24 | Öneri: Pexels'ten 30 sonuç çekip kural-seçimi (oran 1,4–2,2, ≥3000 px, kişi/yemek alt'ı el | DOĞRULANAMADI | KAPSAM AÇIĞI: hero fotoğraf seçimi kuralı (Pexels 30 sonuç); v46 hero'ya dokunmaz; backlog, Emre kararı | ☐ |
| K17 | Gezinin şekli şeridi: hero ile bölümler arasında rota (İstanbul ✈ Ubud · Seminyak · Uluwat | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K28 | Yolculuk şeridi sade: durak, gece sayısı; ayrıntı üstüne gelince açılan kartta; etkinlik e | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K35 | Yolculuk şeridi kaydırmaz, en çok 4–5 durak; aradaki taşıt kutulardan türetilir (elle yazı | DOĞRULANAMADI | F10 doğrular (TripShape.tsx; v46 `journey()` şeridi ile aynı kural); koda dokunulmaz | ☐ |
| HS25 | Duraklar LEGS'ten türer (elle yazılmaz); aradaki taşıt ikonu ulaşımdan gelir: uçak, tren,  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K66 | Hero yan kartı canlıdaki gibi: bloklar kartın boyuna eşit dağılır; Yen · priz · saat · dil | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS26 | Denetim: hero'da AI sloganı ve "Tahmini toplam · bütçeye sığar" satırı eksikti. | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| HS27 | Gezi ilk kez açılırken Plan kendini okuma sırasıyla kurar (maskot göz kırpar, panel iner,  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| HS28 | Açılış B: parçalar ilk kareden okuma sırasıyla girer, sayaçlar sayarak yükselir, kıvrımın  | CANLI | zaten canlı; F8e, F8 dokunur, korunur (F10 doğrular) | ☐ |
| HS29 | Altı hareket sözlüğü (düşüş, parlama, mühür, uçuş, ışık geçişi, hop), ortak süre/ease toke | CANLI | zaten canlı; F8 dokunur, korunur (F10 doğrular) | ☐ |
| HS30 | "İnternet yok · N sn sonra tekrar deniyorum" (5-10-20-30 sn, "Şimdi dene", "Kaydedildi ✓") | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| HS31 | Hero v8: fotoğraf 300 px, "Onaylananlar" 4 bölmeli gri kutu, "Seni böyle anladım" satırı + | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| HS32 | Hero altında alt çizgili sekmeler "Plan \ | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| YS01 | Sütunlar: solda tarih sütunu, ortada kesikli çizgi ve düğüm, sağda kart. Tarih kutusu ay · | CANLI | zaten canlı; F5b dokunur, korunur (F10 doğrular) | ☐ |
| YS02 | Başlık "5 gece · 1–6 Nis · Per–Sal · Gün 1–6"; içerik: konaklama kartı ve "Burada" listesi | CANLI | zaten canlı; F5b dokunur, korunur (F10 doğrular) | ☐ |
| YS03 | Yolculuk sırasıyla sonunda "✓ Eve dönüş · İstanbul" satırı; 1000 px'te otel kartı sütunda  | CANLI | zaten canlı; F5b dokunur, korunur (F10 doğrular) | ☐ |
| YS04 | Yolculuk sırasıyla görünümü de aynı slotCard'ı kullanır; yeni (v37) kartlar orada da görün | YAYINDA DEĞİL | F5b (Yolculuk v46: kartlar planın kartlarıyla aynı kalıp, mini kipte) | ☐ |
| GG01 | Her gün tek satır: tarih kutusu; o gün başlayan uçuş, ulaşım ve tarihli etkinlikler duruml | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| GG02 | Eski fotoğraflı gün kartları, Liste\ | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| GG03 | Günlük akış Liste: her gün bir kart, solda günün büyük fotoğrafı + "1. gün" hapı, saat saa | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| GG04 | Gün başlıkları kodla, standart: şehir + gezinin günü, yanında soluk gün türü (Varış / Yolc | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| GG05 | Satır başlığı iki parça "NE · HANGİSİ": NE sabit sözlükten kalın (Uçuş, Aktarma, Havaliman | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GG06 | Günün sırası: saatli satırlar saate göre; saatsizler tutamaçtan sürüklenir (trip.dayOrder) | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| GG07 | Günün satırları gruplu: kesinleşmiş (saatiyle) önce, sonra "Henüz rezerve edilmedi", fikir | DOĞRULANAMADI | F10 doğrular (Gün gün gruplu satırlar, dayView; v46 dayView rozeti F0 ile aynı) | ☐ |
| GG08 | Günlük akış Liste zaman çizelgesi: her satır tek renk, yuvarlak düğümler ince çizgiyle bağ | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| GG09 | "Gün gün" satırında Ayarlandı kararı bacağın kendi kartıyla aynı; bileti alınan uçuş "Reze | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GG10 | Kesin saatler (bilet, rezervasyon, senin verdiğin) sabit; aradakiler (transfer, check-out, | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GG11 | Havalimanında ideal süre: Schengen içi 2 sa, dışı 3 sa; en az (minimum) ideal − 1 sa (Emre | ÇELİŞKİ | F9 (akıllı saat spec'i Emre 07 Ekim kararına göre güncellenir; kod zaten canlı) | ☐ |
| GG12 | Tren/otobüs istasyonda −20 dk, vapur −30 (araçla −60); iniş +45 dk çıkış (kabin bagajı bil | DOĞRULANAMADI | F10 doğrular (lib/legs.ts süreleri; v46'dan etkilenmez) | ☐ |
| GG13 | Gün saati inişe demirlenir: havadayken otel saati yok, "gece ~01:25" ve geç check-in notu, | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| GG14 | Aynı gün aynı yere farklı saatlerde iki varış varsa "X Havalimanı'nda buluşma" satırı (geç | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PN01 | Pano üstü: başlık, kayıt sayısı, gerçek bir arama kutusu ("Kayıtlarda ara"), "+ Link ekle" | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN02 | Solda dikey kategori menüsü sayılarıyla: Tümü · Uçuşlar · Konaklama · Ulaşım · Etkinlik ·  | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN03 | Üstte durum (Hepsi · Karar bekleyen · Planda) ve Sırala; altında ihtiyaç başına bir sıra ( | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN04 | Sıra başlığında "Karar bekliyor" ya da "Seçildi: X · Plan'da gör →"; sırada "Karşılaştır"  | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN05 | Pano kartı değişmez (görsel, uyum puanı, kalp, "Neden?", Yedek · Bununla değiştir); yalnız | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN06 | Kartın arka yüzündeki "Pano'da aç", Pano'yu o ihtiyaca odaklı açar ("← Plan'a dön" ile ger | CANLI | zaten canlı; F0, F1d, F2, F4 dokunur, korunur (F10 doğrular) | ☐ |
| PN07 | Pano çekmecesi: kartın arkasındaki "Pano'da aç" sayfa değiştirmek yerine Pano'yu sağdan, o | YAYINDA DEĞİL | YAPILMIYOR: mockup v46 "Pano'da aç" Pano sekmesine geçer (data-go="pano"); sağdan çekmece çizimde yok | ☐ |
| PN08 | Pano'da çok seçenek: kartta ilk 4 + 2, "Pano'da geniş aç". | DOĞRULANAMADI | YAPILMIYOR: Pano v46'da uçuş kartları şeritte yan yana (v42), "ilk 4 + 2" kuralı yerine geçti; F1d/F2 | ☐ |
| K15 | Plan sade, adaylar Pano'da: Plan'da her ihtiyaç tek kart; adaylar kartın içinde listelenme | CANLI | zaten canlı; F0, F1d, F2, F4 dokunur, korunur (F10 doğrular) | ☐ |
| K20 | Plan ↔ Pano: Pano'dan sürükle-bırak ya da "Plana ekle"; uyan kutu yanar; kutudaki ↩ kaydı  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K24 | Pano sayfası Emre'nin onaylı görselini izler (kategori sekmeleri, kart, oylar, yorum, favo | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K32 | Pano = çalışma masası: aynı kart dili; kategori seçilince "Senin için" özetleri; tablo gör | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K38 | Pano karşılaştırması: kayıtlar kutuya göre grupta; kartta "Neden? Artılar ve eksiler ▾" (y | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K39 | Favoriler: kalp her kartta çalışır; kategori çubuğunda "Favoriler N" süzgeci. | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K45 | Pano: "Tümü" ilk ve varsayılan (kartta hangi ihtiyaca ait olduğu yazar); kategori seçilinc | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K46 | Karşılaştırma satırları üç parça: (a) Herkes için, türe göre sabit çekirdek (uçuş: toplam, | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K58 | Pano kategorileri: Tümü · Uçuşlar · Konaklama · Ulaşım · Etkinlik · Yerler · Belgeler · İl | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K65 | Pano: geniş ekranda satırda 4 kart; görsel 4:3 ve büyük; kartta yalnız ihtiyaç, ad, tek sa | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K70 | Pano ↔ Plan çift yönlü: Pano'da planda olan kartta "✓ Planda / Rezerve" ve düğme "Plan'da  | CANLI | zaten canlı; F0, F1d, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K71 | Beğeni tek: kalp = beğen; kartın altında beğenenlerin yüzleri; ayrı başparmak sayacı kalkt | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K72 | Pano araçları: durum "Hepsi · Karar bekleyen · Planda"; Sırala: Bize en uygun · En ucuz ·  | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN09 | Pano sekmesinde "son ziyaretinden beri" noktası; kim ekledi yüzlerle (kişi/AI ✨). | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN10 | Boş ya da sonuçsuz Pano'da maskot (kayıt yok → uykulu, süzgeç boş → "oops"). | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| PN11 | Seçenek panosu (karşılaştırma penceresi): Kartlar ve Tablo; kartta tek rozet (Önerim · Fav | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PN12 | Seyahatlerim: büyük ortalı soru + kutu; köşe kartı kalktı; üst çubukta para birimi (₺ € $  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| UC01 | Havayolu logosu + adı + sefer no; planda şehir büyük (30 px), kod ve saat küçük; ertesi gü | CANLI | zaten canlı; F0, F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| UC02 | Boş uçuşta rotanın yerinde uçak illüstrasyonu; boş koçan: tahmini aralık. | ÇELİŞKİ | F2 (boş bilet: tahmini aralık, kapsülsüz tek satır, ≥3 gerçek teklif) | ☐ |
| UC03 | Koçan: boş → tahmini aralık; seçildi → kişi başı ve toplam; rezerve → "Rezerve · €1.960 ·  | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| UC04 | Seçenekler karşılaştırılırken (kart arkası, Pano) saat büyük kalır. | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K13 | Uçuş niyeti biniş kartı: şehir · noktalı uçak silüeti · şehir; sağda yırtık koçan (aradığı | ÇELİŞKİ | F2 (uçuş niyeti = yatay bilet + koçan; v39/v46) | ☐ |
| UC05 | Rezerve uçuşun gerçek verisi: numarası başlıkta, terminal kodların yanında, bilinen kutucu | CANLI | zaten canlı; F2 dokunur, korunur (F10 doğrular) | ☐ |
| UC06 | Uçuşun canlı verisi (FlightLive, PlanCard): yeni yeri canlı şerit, yalnız uçuş günü; rötar | CANLI | zaten canlı; F0, F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| UC07 | Uçuş kartı: havayolu logosu kalkış şehrinden önce (Kiwi, açılmazsa Aviasales), süre tarife | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| UC08 | Tek yön uçuşta "Dönüş bileti ara"; uçuşta ilk gelen havalimanı ↔ şehir adı (cityOfAirport) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| UC09 | Bilet alınmadı uyarısı: seçilmiş uçuşta her zaman (14 gün kala turuncu); boş yer tutucu uç | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KO01 | Booking/Airbnb düzeni: üstte kenardan kenara kısa görsel bant (~3:1; kaynak fotoğrafı, yok | CANLI | zaten canlı; F0, F1, F3, F2 dokunur, korunur (F10 doğrular) | ☐ |
| KO02 | Item.rating { score, count, scale } — puan rozeti kaynaktan gelir, yoksa satır gösterilmez | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KO03 | Konaklama türü sohbette sorulur; model türü bilir ve uymayanı önermez (Ozora'ya otel öneri | CANLI | zaten canlı; F3 dokunur, korunur (F10 doğrular) | ☐ |
| KO04 | stayKind (otel · kamp · tekne · programa dahil); canlı değerler hotel_room · apartment · h | ÇELİŞKİ | F10 doğrular (stayKind değerleri; F3 niyet etiketi kamp/ayrı konaklama için S13) | ☐ |
| KO05 | stay_type boat/camp/vehicle ise hedefteki konaklama kartı o türle açılır (şehri stay_port, | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KO06 | Konaklamada ek: "Haritada aç ↗", "Ev sahibine yaz ↗" (otelde "Otele yaz ↗"), iptal durumu, | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KO07 | Otel giriş saati alt şeritte konaklamaya 2 gün kala; öncesinde "✓ Rezerve". | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| KO08 | Seçenekli konaklama tek kart ("N seçenek ›"); seçilmiş/rezerve konaklama da v11 kartı (esk | CANLI | zaten canlı; F0, F2, F3, F4 dokunur, korunur (F10 doğrular) | ☐ |
| KO09 | Konaklamanın bir kısmının boş kalması uyarısı (PlanEntry), iki rezervasyon çakışması (lib/ | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KO10 | Görselin sol üstünde niyet etiketi: yatak simgesi · Kyoto · "8–13 Nis · 5 gece"; tarih·gec | YAYINDA DEĞİL | F1b (niyet etiketi) | ☐ |
| UL01 | Solda büyük taşıt illüstrasyonu (tren, otobüs, araba, taksi, vapur, karavan); satırlar: bü | CANLI | zaten canlı; F0, F1, F3, F5a, F2 dokunur, korunur (F10 doğrular) | ☐ |
| UL02 | Kiralık arabada saat yerine "Al 25 Tem 09:45 · Havalimanı → bırak 2 Ağu · Deák tér" satırı | CANLI | zaten canlı; F2 dokunur, korunur (F10 doğrular) | ☐ |
| UL03 | Boş ulaşım (model nasıl gidileceğini bilmiyorsa): "Kyoto → Osaka · Nasıl gideceğin belli d | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| UL04 | Ulaşım karar hâlleri: "Ayarlandı / rezerve edildi", uçakla şehir değiştirirken "Uçuş ara ↗ | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| K22 | Ulaşım kutuları da öneri alır; belirsizse sohbet sorar ("villa mı alacak, transfer mi?"). | DOĞRULANAMADI | F10 doğrular (ulaşım kutusu öneri/soru; F5a boş ulaşım kartı "seç, ben arayayım") | ☐ |
| UL05 | Ulaşım tür tespiti sırayla: plannedKind → bacak seçimi → kategori flight → metin kalıpları | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| UL06 | Transferin seçilen türü yalnız transferin kendi kayıtlarına geçer; uçuş taksi görünmez; "+ | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| UL07 | Transfer/şehir değişimi kartında uçlarda büyük kısa ad (Airbnb/Booking.com/Otel/Daire; "Po | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| ET01 | Tek ızgara, hepsi aynı boy: kare görsel; ad (2 satır); marka etiketi + şehir; tek fiyat (2 | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| K51 | Etkinlik ve turlar ≠ Gezilecek ve yemek: biletli/rezervasyonlu olanlar (GetYourGuide, Viat | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ET03 | Etkinlik ve turlar'ın ilk kartı, geniş ve iğneli: görsel, "GEZİNİN SEBEBİ", ad, tarih ve k | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| ET04 | Bölümde kısa tür notu: "Festival gezisi: tur önerisi kapalı; sonrası için dinlenme önerdik | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| ET05 | Klasik (otel/ev) · Festival (festival bileti; çadır/karavan; tur kapalı; araba al/bırak, s | ÇELİŞKİ | F6 + F10 (Ozora festival gezisi: Gezinin sebebi, kamp, araba al/bırak, kapalı tur notu, dinlenme; v46 ekranı) | ☐ |
| ET06 | Festival: tur/aktivite önerisi yok; hazırlık çadır, uyku tulumu, kafa lambası, nakit, kula | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ET07 | Etkinlik fikirleri artık kaynaktan gerçek teklifler (Viator): "+ Plana koy"/"Plana ekle" i | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| ET08 | Plana eklenen turun fotoğrafı korunur ve büyük kalır; sohbetin plana koyduğu tur (fotoğraf | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| ET09 | Rezerve edilen deneyim aynı şehirde aynı gün/gün belirsiz planlanan veya kaydedileni kapat | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ET10 | Konser, gösteri, maç, festival, open air, DJ, line-up, parti, canlı müzik geçen kayıt "yap | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ET11 | Etkinlik kaynağı yokken "Canlı tur ve bilet kaynağı bağlı değil; kendin bakabilirsin" ve ş | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| YP01 | Yolculuk sırasıyla şehir durakları (numaralı); solda kesikli yolculuk çizgisi, aralarında  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| YP02 | Maps'ten gelen kayıtta fotoğraf, yoksa türün illüstrasyonu (restoran · gezilecek yer); köş | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K63 | "Gezilecek ve yemek" → "Yapılacak şeyler": etkinlikler gibi kare (görsel, kimden, ad, şehi | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K57 | Gezilecek ve yemek = canlıdaki fikir havuzu: hızlı yazma kutusu, sekmeler Hepsi · Havuzda  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K69 | Yapılacak şeyler'de ekleme karesi yok: giriş kanalı sohbet; alttaki not "sohbete yaz" der; | DOĞRULANAMADI | F10 doğrular (Yapılacak'ta ekleme karesi yok; v46 todoBody de yok) | ☐ |
| K21 | Fikirler (deneyim, yemek): kare kartlar; × anında atar (geri alınabilir), "Plana ekle" sat | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| YP03 | Yapılacakların işlemleri (IdeaTiles): Gittim, Haritada aç, Adını değiştir, "Rezervasyonu y | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| YP04 | Restoran asla rezerve edilecek şey değildir: booking "none"; plana konan restoran günün sa | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| YP05 | Yapılacak/Restoran: tik kutusu yok, ilerleme çubuğu yok, "güne eklenmedi" uyarısı yok; gün | ÇELİŞKİ | F5b (Yolculuk "Yapılacaklar ve restoranlar" kutusu: tik/ilerleme yok, günü olmayan eksik değil) + F10 | ☐ |
| YP06 | Durum sekmeleri sayılarıyla (Hepsi · Havuzda · Günü var · Kaçtı · Yapıldı), tür çipleri (M | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| DG01 | Vize satırı ilk sırada: gerekmiyorsa yeşil tek satır; gerekiyorsa amber "Resmî kaynak ↗" v | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K73 | Vize belgelerin yanında: bölümün adı "Belgeler ve internet", ilk satırı vize; "✓ Vize gere | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K64 | "Belgeler ve internet" → "Sigorta ve internet": sigorta ve eSIM aynı çerçevede iki kutucuk | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| DG02 | Sigorta ve eSIM iki eşit niyet kartı yan yana; sigortanın kaynağı yok (Kendin ara + AI öne | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| DG03 | Belgeler: çoklu belge listesi, silme ("çöp kutusu 30 gün"), sürükle-bırak; eSIM'in "Kurulm | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| DG04 | PDF (ve görsel) sohbete/panoya bırakılır, docs deposuna kaydolur (15 MB), LLM belge türünü | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| DG05 | Hazırlık işleri (al, başvur, paketle, döviz bozdur…) Yapılacak şeylerden ayrı kendi listes | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K60 | Hazırlık: işaretlenen yerinde kalır (yeşil kutu + "Hazır"); "Hazırları gizle" isteğe bağlı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K47 | Hazırlık: üstü çizilmez; işaretlenen "Hazır" grubuna taşınır. Sohbetten "şunu da ekle" ile | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K34 | Hazırlık her gezide var (öneri listesi, kimin getirdiği, ileride Amazon/ortaklık linki; Pa | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| DG06 | Hazırlık: maddeyi yerinde düzenleme, × ile silme ve Geri al, "Orada yapılacak". | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K59 | İlham bölümü (en altta, küçük): video/gönderi kartı; bir güne konunca Gezilecek'e geçer. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| DG07 | Trip Radar "daha iyi Layla" değildir: Layla üretici, biz karar ve takip aracı; sıfırdan il | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KM01 | Durum etiketinin yanında, üstüne gelince iki düğme: ••• menü (Değiştir · Belge ekle · Kimi | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| KM02 | × kartı kaybettirmez, yerinde ince satıra katlar: "X kaldırıldı · Neden? [Gerek yok] [Ben  | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| KM03 | × katlanmasında hiçbir şey seçilmezse kart katlı kalır, veri değişmez ("gerek yok sayılır" | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| KM04 | Ayarlandı: gri, düz, "Kendin ayarladın"; ayrı durum değil: noBooking + Item.arranged bayra | ÇELİŞKİ | F0 (Ayarlandı rozeti §2.2: sözcük "Ayarlandı", dolgu --okb-set; Emre onayı §6.1) | ☐ |
| KM05 | Aşamalar: Arıyoruz renksiz kesikli; Seçildi açık yeşil kesikli; Rezerve koyu yeşil düz dam | ÇELİŞKİ | F0 (Seçildi/Önerimiz/Rezerve görsel dili §2.2: beyaz düz, yeşil zemin yalnız Rezerve) | ☐ |
| KM06 | "Seçildi" ile "Rezerve" yeşil tonları yan yana yeterince ayrışıyor mu? Emre teyit etmedi. | YAYINDA DEĞİL | F0 (ayrışma: Seçildi beyaz + açık yeşil çerçeve, Rezerve yeşil zemin + koyu rozet; mockup v41 çözdü) | ☐ |
| K12 | Aşama malzemeyle okunur: Arıyoruz = kesikli çerçeve + çizim + boş çember; adaylar var = ar | ÇELİŞKİ | F0 + F2 (aşama malzemeyle okunur: boş = hafif gri bilet/kart, Seçildi = gerçek görsel) | ☐ |
| KM07 | Aşama renkleri sarısız: boş çizgili, seçildi açık yeşil çizgili, rezerve koyu yeşil (v13 ç | YAYINDA DEĞİL | F0 (sarısız: amber kalkar) | ☐ |
| KM08 | Aşamalar tek kaynaktan (lib/lifecycle.ts): Aranacak → Seçenekler (N) → Planlandı → Rezerve | ÇELİŞKİ | F0 (lib/stageWords.ts tek sözlük) | ☐ |
| KM09 | Orta aşama her yerde "Planlandı" (Seçildi, Planlanıyor, Seçildi · rezerve edilmedi hepsi " | ÇELİŞKİ | F0 (orta aşama her yerde "Seçildi"; "Planlandı" kullanıcıya görünmez) | ☐ |
| KM10 | Aranacak/Seçenekler/Planlandı silme hemen + Geri al; Rezerve edildi/Hazır silme sorar ("Bu | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| K53 | Her plan kartında × (üzerine gelince); Arıyoruz/Seçildi kart hemen gider → bölüm sonunda " | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K54 | Rezerve şey sormadan silinmez: × → "Bu rezervasyon onaylı. İptal ettin mi?" (belgesi varsa | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K55 | "Aldım" üstte: Seçildi kartında sağ üstteki etiketin yerine "○ Aldım" hap düğmesi; alttaki | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K50 | "Aldım": Seçildi kartında ve biletli etkinlikte "Rezerve et ↗"nin yanında; basınca Rezerve | ÇELİŞKİ | F2 + F3 (✓ Aldım ⓘ yanında kalır; "Rezerve et ↗" bilet koçanında/alt satırda; S5) | ☐ |
| K56 | Rezerve karta basınca ayrıntı penceresi: marka + ad + saat, rezervasyon satırları (PNR, gi | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K1 | Pahalı + kişisel + kıyaslanan → niyet kartı (uçuş, konaklama, araç kiralama, şehirler aras | CANLI | zaten canlı; F4, F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| K1b | AI'nın otel adayları niyet kartının altında KAPALI satırda ("✨ 3 aday ▾"). | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K2 | Tutulacaklar asla gizlenmez, fikirler kısılır: her ihtiyaç ayrı kart ("Ubud · otel"); gizl | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| K5 | Her cevap panoda görünür bir değişiklik yaratır: kart yerinde dönüşür ve kısa parlar; sohb | CANLI | zaten canlı; F0, F2, F3, F8 dokunur, korunur (F10 doğrular) | ☐ |
| K6 | Her kartta "neden" satırı, kullanıcının kelimesiyle ("Direkt uçuş · lüks dediğin için"); v | YAYINDA DEĞİL | KAPSAM AÇIĞI: kartta "neden" satırı (kullanıcı kelimesiyle); v46 yalnız Pano uçuş şeridinde "ilk artı" gösterir (F2 kısmen karşılar); kart içi neden satırı Emre kararı | ☐ |
| K8 | Öneri × ile tek tıkla gider, yenisi istenebilir; × kalıcı (Geçmiş'ten geri alınır); bölümd | ÇELİŞKİ | F6 (etkinlikte × ve ↻ başkasını öner) + F10 (Geçmiş'ten geri alma canlı) | ☐ |
| K14 | Kimden geldiği yüzle: "Senin linkin" yerine profil yuvarlağı (E, S); AI ✨ yuvarlağı. | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K23 | "Senin linkin" kelimesi yok; yalnız yüz (E, S) ve "AI önerisi". | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K16 | "Kendin ara" her niyet kartında önde (farkımız); AI adayı ikincil. | CANLI | zaten canlı; F4, F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| K18 | Niyet kartı bir kutucuk: öneri ya da Pano kaydı kutunun içine yerleşir; "3 aday" destesi k | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K19 | Aşamaya göre bilgi: boş → AI'nın anladığı + Kendin ara; öneri/Seçildi → karar bilgisi (top | ÇELİŞKİ | F2 + F3 (aşamaya göre kart bilgisi: boş/Önerimiz/Seçildi/Rezerve içerikleri) | ☐ |
| K25 | Seçim penceresi (K20 yerine): kutuya basınca pencere: Kaydettikleriniz · AI önerisi · Kend | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K26 | Kutuda kayıt listesi yok; yalnız "N fikir" + kaydedenlerin yüzleri; ayrıntılı karşılaştırm | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K27 | Seçildi ≠ Rezerve, kart sade: boş → ne/nerede/neden; Seçildi → kararın adı büyük, tek satı | CANLI | zaten canlı; F0, F2, F3, F1 dokunur, korunur (F10 doğrular) | ☐ |
| K29 | Aşama geçiş hareketi: seçince uçak silüeti kalkış yapar, çizim/fotoğraf düşer, etiket zıpl | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K30 | Kart düzeni tek kural: üst = tür + tarih + durum etiketi; orta = ne olduğu; alt = solda bi | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| K31 | Seçim penceresi = küçük karşılaştırma: "Senin için" özeti, her seçenekte uyum puanı, tek r | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K37 | Seçim penceresi sade: puan, ad/saat, rozet, tek satır bilgi, kim kaydetti, beğenenler, top | ÇELİŞKİ | F4 (S7: karo sade; artı/eksi ⓘ ve Pano'da) | ☐ |
| K40 | ✨ AI'dan öneri: boş kutunun altında küçük ✨ düğmesi, pencerede "Daha fazla öneri bul", Fik | CANLI | zaten canlı; F0, F6, F4 dokunur, korunur (F10 doğrular) | ☐ |
| K41 | Kart tıklanır olduğunu söyler: altta "Seçenekler ›" + üstüne gelince kalkma. | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| K42 | Kart içinde açılan seçenekler: boş kutunun altında "▾ 3 seçenek" (önce sizin kaydettikleri | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K48 | Kaydettikleriniz kartta görünür: "Kaydettikleriniz · 2 · buradan seçip kutuyu doldur" bloğ | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K62 | Kart sabit, seçenekler altında: kartın altında tek düğme "(yüzler) 2 kaydettiğiniz · 1 AI  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| K68 | Kartın altındaki şerit kalktı (K62 geri alındı): Arıyoruz kartının altında yalnız kimin ek | ÇELİŞKİ | F4 (arka yüz iki bölüm; seçenek penceresi/şerit kalktı, "N seçenek ›" arka yüzü çevirir) | ☐ |
| KM11 | Karta ya da "N alternatif"e basınca kart döner; arka yüzde boş yere basınca geri döner, ×  | CANLI | zaten canlı; F0, F2, F3, F4 dokunur, korunur (F10 doğrular) | ☐ |
| KM12 | Izgara en çok 7 seçenek; son kare "+N daha · Pano'da büyük aç"; başlıkta "Pano'da aç"; alt | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| KM13 | Kart menüsü (Düzenle, Çıkar, Değiştir, Belge ekle, İptal ettim, Sil sorarak, Kimin için) • | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| KM14 | Erişilebilirlik: kart gövdesi tıklanır, içindeki düğmeler ayrı (.pk-body ayrımı); article  | CANLI | zaten canlı; F0, F1, F3, F2 dokunur, korunur (F10 doğrular) | ☐ |
| KM15 | Yalnız istisna işaretlenir (herkesin kartında yüz yok); bir kişiye ait kartta türün yanınd | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| KM16 | forWho paylaşılan gezide paylaşılmaz (kayıtlar paylaşılmaz); kişi başı bütçe/masraf bölüşm | YAYINDA DEĞİL | KAPSAM AÇIĞI: forWho paylaşılan gezide paylaşılmaz, kişi başı bütçe/belge klasörü (paylaşım v2); v46 dışı, Emre kararı | ☐ |
| KM17 | Kartın üst kenarında hover ikon şeridi (ActionStrip), uçuş ve transfer kartlarında bakış k | CANLI | zaten canlı; F1a dokunur, korunur (F10 doğrular) | ☐ |
| KM18 | Kim ne yaptı yüzlerde (WhoAvatar/✨), Pano sekmesinde "son ziyaretinden beri" noktası. | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur (F10 doğrular) | ☐ |
| BK01 | Boş kart = onaylı kartın sade hâli: kesikli çerçeve, beyaz zemin; şehir adları bir boy küç | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| BK02 | "Yer yok" (boş konaklama) Türkçede "dolu" gibi okunduğu için "Henüz otel yok" (gece UX den | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| BK03 | Sohbetle açılan gezide startGuide.placeholders (uçuşlar, konaklamalar, araç) hiçbir zaman  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| BK04 | Uçuş (Bilet yok · N kişi: Google Flights/Skyscanner/Kayak) · Konaklama (Booking/Airbnb) ·  | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| BK05 | Yalnız belgelenmiş herkese açık adres biçimleri; yer, tarih, kişi sayısı dışında kişisel b | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| BK06 | Boş konaklama seçenekli kart (bant, "Henüz otel yok"); boş uçuşta rota satırı; eSIM ve sig | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| BK07 | Tahmini fiyat aralığı yalnız kaynaklardaki en az 3 gerçek tekliften çıkar (aksi hâlde gerç | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| BK08 | Çubukta "+ Ekle" ve Arıyoruz/Seçildi/Rezerve göstergesi; menü alt yazıları; hero tahmini t | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| BK09 | Hata ve boş hâller: okunamayan link "Okunamadı · Tekrar dene · Kaldır"; boş gezi "İlk kayd | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| BK10 | Öneri kartı bölümünde kartların üstünde soluk: ✨ · başlık · tek cümle neden · [Plana ekle] | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| BK11 | Kural önerileri: gece 22:00 sonrası varış + transfer yok → havalimanı transferi; 21+ gün t | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| BK12 | Boş kartın altında "✨ Senin için N öneri ▾" (kapalı başlar), açılınca fiyat kartı (kaynak, | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| BK13 | Niyet kartı: Tarihsiz niyet → Tarihli niyet (arama linkleri canlı) → Adaylar (kullanıcının | CANLI | zaten canlı; F4, F2, F3, F5a, F0 dokunur, korunur (F10 doğrular) | ☐ |
| BK14 | "Ayarlandı: geri al" kart menüsünde; eSIM/sigorta önerisinde "Ben hallettim"; kaydı olmaya | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| BK15 | Boş ulaşımda cümle üstte ve soluk taşıt, Ayarlandı geçişte gri, arranged kaydı seçeneklerl | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| ZU01 | Canlı şerit (Zamanında · Terminal · Kapı · check-in) yalnız uçuş günü. | CANLI | zaten canlı; F2 dokunur, korunur (F10 doğrular) | ☐ |
| ZU02 | Rötarda kart kırmızı çerçeve, eski saat çizili, yeni saat; "Planı yeni saate göre kaydırdı | CANLI | zaten canlı; F0, F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| ZU03 | PNR (koçanda) yalnız uçuş günü; öncesinde "Rezerve · toplam". | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| ZU04 | Seçildi kartında iptal süresi her zaman (karar verilirken lazım): ücretsiz iptal tarihi ye | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU05 | Rezerve kartta iptal süresi yalnız son 14 gün; son 7 gün turuncu, son gün kırmızı; "İade y | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU06 | "Bilet alınmadı · uçuşa N gün" (seçildi uçuşta) her zaman; 14 gün kala turuncu; diğer kayı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU07 | Otel giriş saati alt şeritte konaklamaya 2 gün kala; öncesinde "✓ Rezerve". | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU08 | Fiyat, saat ve gerçek uyarılar asla saklanmaz; yalnız hatırlatmalar ve numaralar zamanını  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU09 | Hero'da "⏳ 2" iptal süresi yaklaşanlar (tıklayınca yalnız onlar); sıradaki adım cümlesi: " | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| ZU10 | Hero % = (Rezerve edildi + Hazır) ÷ (Planlandı + Rezerve + Hazır) — yalnız plana alınanlar | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| ZU11 | %100 yanılsaması: open>0 iken başlık "Planlananların hepsi rezerve" yerine "Planlananlar r | DOĞRULANAMADI | F10 doğrular (hero metni "planlananlar rezerve, N karar kaldı"; F7 taslak sayımı bunu bozmamalı) | ☐ |
| ZU12 | Akıllı saat: gece yarısı sonrası iniş (00–05) için "inişte kalacak yer yok" kırmızı uyarı; | DOĞRULANAMADI | KAPSAM AÇIĞI: gece yarısı sonrası iniş uyarısı (doğrulanamadı); v46 dışı, Emre kararı | ☐ |
| FB01 | Fiyat sağ altta düğmenin yanında; konaklamada "€420 / gece" büyük + "€840 toplam" küçük; u | CANLI | zaten canlı; F0, F1, F3, F2 dokunur, korunur (F10 doğrular) | ☐ |
| K49 | Fiyatı olmayan link: "Fiyat linkte ↗" (tarihsiz kaydedilmiş sayfa); karşılaştırmada "—", e | YAYINDA DEĞİL | F2 + F4 (fiyatsız seçenek: "Fiyat linkte ↗", en ucuza girmez; mockup `nolink` "Linkte ↗" çizer) | ☐ |
| FB02 | Fiyat/puan/iptal için sayfadan birebir alıntı şart, yoksa "doğrulanmadı"; bilinmeyen tahmi | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB03 | Kaynaklı ya da AI fikri: fiyat, saat ve fotoğraf uydurulmaz. Tahmini fiyat yalnız kaynakla | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K3 | Öneri iki türlü: kaynaklı (link, fiyat, fotoğraf gerçek) ya da AI fikri (etiketli, fiyatsı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB04 | Yapışkan şerit "~€7.347 / €9.000" = rezerve + seçildi + her açık kararın öndeki seçeneği;  | CANLI | zaten canlı; F0, F7 dokunur, korunur (F10 doğrular) | ☐ |
| FB05 | Bölüm başlığında "€X ayrıldı": bütçe beklenen maliyete göre bölünür; harcanan kalın. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB06 | Bölüm bütçesi: Faz 1'de yalnız harcanan; dağıtım Faz 6. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB07 | Para birimi gezinin bütçe para birimi; bütçe yoksa üst çubuktaki gösterim para birimi (₺ € | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB08 | Puan kod hesaplar (aynı bilgiyle aynı sonuç), 0–100, açıklanabilir: fiyat, konum, puan/yor | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB09 | Komisyon yok; ücretsiz, hesap yok; "paywall/fatura tuzağı" yok. Para kazanmaya başlayınca  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| FB10 | Kaynak sayfaların affiliate kodu otomatik (lib/affiliate.ts); Viator'ın proje ortak kodu b | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS01 | Karşıdan gelen ortak ayar değişikliği bildirimi: pano üstünde sarı şerit "Tarihler: 7–18 E | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS02 | trip_radar.settings_history (gezi başına en çok 200 satır), AFTER UPDATE tetikleyici, sett | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS03 | Yerel çöp kutusu 30 gün: silinen kart (belgeleriyle) ve gezi; "Kalıcı sil" / "Çöp kutusunu | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS04 | Paylaşılan geziyi silerken uyarı: yalnız bu bilgisayardan silinir, Sabine'in kopyası ve or | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS05 | ••• → "Geçmiş ve çöp kutusu": bölmeler Hepsi · ortak yolcular · Ben · Çöp kutusu; satırlar | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS06 | Hiçbir kayıt silmesi onay sormaz; 8 sn "Geri al"; kayıt belgeleriyle geri gelir; kart dışı | ÇELİŞKİ | §2.3-9 (silme onay sormaz, 8 sn Geri al; rezervasyon silme sorar) korunur; F10 doğrular | ☐ |
| PS07 | Hesapsız paylaşım: gizli shareId + anon key RPC; tek kod TR1:…; Seyahatlerim → "Paylaşılan | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS08 | Tek link: https://<davet sayfası>/j/#TR1:… (kod #'den sonra, sunucuya gitmez); statik dave | YAYINDA DEĞİL | KAPSAM AÇIĞI: davet linki / mağaza / kişiye özel mail (paylaşım v2); v46 dışı, Emre kararı | ☐ |
| PS09 | Profil: ad + isteğe bağlı fotoğraf (128 px JPEG, ~10 KB, chrome.storage.local); paylaşılan | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS10 | Chrome Web Store'da liste dışı (unlisted) sayfa ($5 geliştirici hesabı, gizlilik politikas | DOĞRULANAMADI | KAPSAM AÇIĞI: davet linki / mağaza / kişiye özel mail (paylaşım v2); v46 dışı, Emre kararı | ☐ |
| PS11 | Misafir kendi anahtarı olmadan link ekler/oy verir/planı görür; sohbet ve AI anahtar ister | ÇELİŞKİ | zaten canlı (misafir sınırı bilinçli); paylaşım v2 ile ilgili kısmı KAPSAM AÇIĞI; F10 doğrular | ☐ |
| PS12 | Link geziyi okuma ve yazma yetkisi verir ("Linki yalnız gezi arkadaşına gönder"); "Paylaşı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS13 | Gizlilik politikası: AeroDataBox yalnız bileti alınmış uçuşta; Viator ortak kodu; yerel çö | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PS14 | Gmail API ile mail bağlama: ağır bulundu (Google doğrulama + yıllık CASA denetimi, KVKK aç | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| PS15 | Her kullanıcıya kişiye özel gizli mail adresi (Resend gelen mail + Supabase Edge Function) | YAYINDA DEĞİL | KAPSAM AÇIĞI: davet linki / mağaza / kişiye özel mail (paylaşım v2); v46 dışı, Emre kararı | ☐ |
| K4 | Soru sırası = en çok kartı açan bilgi: nereye → kaç gün → ne zaman → hangi gün (yalnız ay  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K36 | Yalnız prompt sonrası AI arıyor: kutularda "AI arıyor" ışıltısı, sohbette "bakıyorum…" sat | DOĞRULANAMADI | F10 doğrular (başlatma sohbetinde AI arıyor ışıltısı; v46 dışı) | ☐ |
| K44 | İlk mesajla gelen linkler: her link Pano'ya düşer ve kutusuna bağlanır; sohbette linkin ya | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS01 | Link yerleştirme belirsizliği: model linkin yerinden emin değilse Pano'nun gelen kutusuna  | YAYINDA DEĞİL | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS02 | Bir gezide iki sebep (festival + dalış): iki sebep kartı mı, bir kart iki satır mı? | YAYINDA DEĞİL | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS03 | Gerçek otel/yer fotoğraflarının kaynağı ve maliyeti (Booking/Airbnb kaydı, Google Places); | YAYINDA DEĞİL | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS04 | Sohbetle gezi başlatma: Seyahatlerim'de tek kutu; liste "Gezin şekilleniyor N/6" (NEREYE · | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS05 | Rota sessizce kararlaştırılmaz: rota önerilir, [Bu olsun] [Değiştir]; ilk mesajda geçenler | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS06 | Sohbet ilk mesajın dilinde konuşur; cevap sorusunun alanını doldurur; oluşturma ekranı dür | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS07 | Oluşturma ekranı: hafif SVG harita kartı (gömülü world.json, MapLibre yalnız Harita sekmes | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS08 | Etkinlik tarihleri için event-info Edge Function (Gemini Grounding, 30 gün önbellek, event | ÇELİŞKİ | zaten canlı (etkinlik tarihi: web-search kind=event_dates; `event-info` adı eski); backend incelemesi §5 "Değişmez" | ☐ |
| GS09 | Model her gezi için kalıbı kendisi üretir (tek çağrı; label, base, stay_type, cards, quest | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS10 | Pano sohbeti hafızası: her turda kısa <trip_brief> (≤400 karakter); arama sorgusuna gezini | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS11 | Kişisel hafıza (geçmiş yol arkadaşları "kimle" çipi; kalıcı kısıt yalnız onaylanırsa, yere | DOĞRULANAMADI | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS12 | Kısıtlar ("merdiven yok", "ileri seviye dalgıç") her kartın seçim ölçütüne bağlanır (otel  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS13 | Gezi düzeyinde "uçaksız / yalnız tren" kısıtı yok (şartlar seçenek düzeyinde, ör. direct_f | YAYINDA DEĞİL | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS14 | Çok ajan yok: tek model, turda tek çağrı; "eleştirmen" model değil kod doğrulayıcı; sorula | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS15 | Planın PDF'i dosya olarak iner (kâğıt düzeninde, A4 sayfalara bölünmüş, kendi küçük PDF ya | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS16 | P10 kişisel hafıza (akıllı planlayıcı E), P11 ilham birikimi (AI'nın bulduğu blog/YouTube) | YAYINDA DEĞİL | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| GS17 | "yap, sabah bakarım": Seyahatlerim v11 çerçevesi; solda soru + kutu + başlangıç çipleri (e | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| GS18 | P1 prompt→niyet okuma, P2 oluşturma animasyonu, P3 Pano iskeleti, P4 niyet kartı ve duruml | CANLI | zaten canlı; F0, F1d, F2, F4, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| GS19 | Veri sözleşmesi: Slot (kutucuk = Need) {id, section, kind, title, place, dates, people, wh | DOĞRULANAMADI | KAPSAM AÇIĞI: gezi başlatma / veri sözleşmesi / kişisel hafıza backlog'u; v46 dışı, Emre kararı | ☐ |
| K7 | Fiiller sabit: Ekle (öneri → plan) · Ara ↗ (dış site) · Aday ekle (link/eklenti) · Seç · R | ÇELİŞKİ | F0 (fiil sözlüğü: Plana koy · Seç · Rezerve et ↗ · Bilet al ↗; §2.2) | ☐ |
| MD01 | Tek fiil: bir şeyi plana sokan her düğme "Plana koy"; planda olan "Plan'da gör →". | ÇELİŞKİ | F6 + F0 (tek fiil "Plana koy"; putFly iki sözcüğü tanır) | ☐ |
| K11 | AI bilmediğini değil anladığını yazar: kart "direkt yok" gibi eksik vurgulamaz; anladığı n | DOĞRULANAMADI | F10 doğrular (üslup ilkesi; yeni metinler "direkt yok" gibi eksik vurgulamaz, S9 "Aradığımız") | ☐ |
| K74 | Tasarımda ne karar verildiyse canlıda o: çizim ile canlı yan yana denetlenir, belirsizlik  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K75 | Karşılaştırma görüntüyle yapılır: "uydu" demeden önce çizim ve canlı aynı genişlikte bölüm | CANLI | zaten canlı; F0, F6 dokunur, korunur (F10 doğrular) | ☐ |
| K3b | Uydurma veri yok: fiyat, saat, süre, ülke/hava, açıklama yalnız kayıttan, hesaptan ya da k | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD02 | Durum asla yalnız renkle anlatılmaz: yanında hep yazısı olur. | CANLI | zaten canlı; F0, F1, F3, F2 dokunur, korunur (F10 doğrular) | ☐ |
| MD03 | Aşama malzemesi kesikli=Arıyoruz; alt satır solda bilgi sağda tek eylem; kimden = yüz (E,S | CANLI | zaten canlı; F4 dokunur, korunur (F10 doğrular) | ☐ |
| MD04 | Kimden: yüz (E, S) ve "Önerimiz"; kaynak markası okunur etiketle yazılır. | ÇELİŞKİ | F0 + F1c (kimden: yüz + "Önerimiz"; S16 etiket birliği) | ☐ |
| MD05 | Marka etiketi: kaynak kendi renginde okunur etiket (Booking.com · Airbnb · JR · Klook · Vi | ÇELİŞKİ | F6 + F10 (marka etiketi: etkinlikte site adı düğmesi; gri "Resmî site" metni yok: KAPSAM AÇIĞI küçük, karar F10'da) | ☐ |
| MD06 | İngilizce: her yeni metin L("tr","en") çiftiyle yazılır. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD07 | Gezi türü yeni bölüm açmaz, bölüm adı değiştirmez, sıra değiştirmez (bölüm sırası sabit). | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD08 | Türkçe arayüzde em-dash (—) yok; " · " ya da ": " kullanılır; sohbet ayraçları tiresiz. | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD09 | Ölçek 40 gezi adı · 22 şehir · 17 kart başlığı · 15 metin · 13–14 kart satırı · 12.5 not;  | ÇELİŞKİ | F9 (DESIGN.md: v46 mini kartlarda tür etiketi büyük harf `text-transform:uppercase`, Türkçe İ/i için `lang="tr"` doğrulanır; kural güncellenir) | ☐ |
| MD10 | Gri yazı --muted #6b665f (daha açık gri kullanılmaz); kart satırları kesilmez ("…" yok), s | ÇELİŞKİ | F5b + F9 (v30 "1 satır …" ile DESIGN.md "kesilmez" çelişkisi: v39+ "isimler hiç kesilmez" kazanır; DESIGN.md güncellenir) | ☐ |
| MD11 | Yeşil #1f8f4e rezerve/artı; Amber #f0a53a seçildi/planlanıyor; Kırmızı #d9534f eksi/risk;  | ÇELİŞKİ | F0 + F9 (renk belirteçleri §F0; DESIGN.md amber kuralı kalkar) | ☐ |
| MD12 | Ana eylem koyu dolgu (--ink) — bir alanda en çok bir; ikincil beyaz çerçeveli; link mavi;  | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| MD13 | Sıralama kararın omurgası: seçenekler 1,2,3… numaralı, tek satır öneri ("Önerim X: neden;  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD14 | Dar uçuş kartında yön ters (has-logo grid) düzeltildi; ••• menüleri tek açık + Esc; süresi | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| MD15 | Sohbet kutusu klavye odağı halkası; "2 kişi" düğmesi ekran okuyucu adı tekrarı; 400 px'te  | DOĞRULANAMADI | F10 doğrular (klavye odak halkası, ekran okuyucu adı, 400 px sekmeler; yeni bileşenler a11y: ⓘ, rozet) | ☐ |
| MD16 | 0.31 boşluk denetimi: uçuş taksi görünüyor (hata), transfer uçları şehir, hover × ve Geri  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD17 | Item.booking?: "needed" \ | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD18 | "+"ya basınca form açılmaz, kayıt oluşur ("Planlanıyor"); bütün kartlarda ad/şehir/tarih/s | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| MD19 | Ayrı konaklama bloğunda ve boş gece bloğunda × (8 sn Geri al); boş geceler "Gerek yok" olu | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| VB-A1 | Boş kart yerine "Önerimiz" taslağı: elinde gerçek seçenek varsa en uygunu kesikli mor çerç | YAYINDA DEĞİL | F7 | ☐ |
| VB-A2 | Dördüncü görünüm "Önerimiz" durum sözlüğüne girer (Arıyoruz · Önerimiz · Seçildi · Rezerve | YAYINDA DEĞİL | F0 + F7 | ☐ |
| VB-A3 | Kartın sol üst köşesinde (−9 px) küçük yüz (kim kaydetti / AI ✨); üstüne gelince "Önerimiz | YAYINDA DEĞİL | F1c | ☐ |
| VB-A4 | Kartın alt satırında sol "Değiştir [N]" hap düğmesi (N = diğer seçenek); sağda fiyat; en s | YAYINDA DEĞİL | F3 (+F2 bilet alt satırı) | ☐ |
| VB-B1 | Sade otel kartı: görsel + marka etiketi + puan rozeti + ad + tek satır ("İade yok" kırmızı | YAYINDA DEĞİL | F3 | ☐ |
| VB-B2 | ⓘ düğmesi (20 px, sağ üst): hover/odak/dokunmada 250 px balon, "etiket · değer"; uçuş: Sef | YAYINDA DEĞİL | F1a | ☐ |
| VB-B3 | "Rezerve et ↗" birincil düğme tüm Seçildi/Önerimiz kartlarında altta sağda (uçuşta "Bileti | ÇELİŞKİ | F2 + F3 (S5) | ☐ |
| VB-C1 | Yatay tek bilet: sol ana bölüm (logo · havayolu · "· Gidiş · 1 Nis Çar" · ⓘ; sol şehir 23  | YAYINDA DEĞİL | F2 | ☐ |
| VB-C2 | Koçan durum göstergesi: v37 46 px durum dairesi (Arıyoruz boş kesikli gri · Aranıyor dönen | ÇELİŞKİ | F2 (v38/v39: daire yok, aşama etiketi + kişi başı + Rezerve et; v37 dairesi geçersiz) | ☐ |
| VB-C3 | Kişi başı fiyat büyük (19 px/800) + "kişi başı" + küçük "2 kişi · €1.960"; boşta "Tahmini  | YAYINDA DEĞİL | F2 | ☐ |
| VB-C4 | Boş uçuş bileti: başlıkta uçak + "Uçuş"; orta metin "Aradığımız: direkt"; altta "N seçenek | YAYINDA DEĞİL | F2 | ☐ |
| VB-C5 | Bilet alındı: alt satırda belge çipi (dosya adı) ya da "Belge eksik", sağda "Ayrıntı ›". | CANLI | zaten canlı (PlanCard.tsx:259-279); F2 korur; F10 doğrular | ☐ |
| VB-D1 | Görselin sol üstünde niyet etiketi: yatak simgesi · Kyoto (kalın) · "8–13 Nis · 5 gece"; e | YAYINDA DEĞİL | F1b | ☐ |
| VB-E1 | Arka yüz kartın yerinde biner, düzen kaymaz (ön yüz visibility:hidden, arka yüz satır geni | ÇELİŞKİ | F4 | ☐ |
| VB-E2 | Arka yüz iki bölüm: "Kaydettikleriniz" (kişi/eklenti) ve "Önerimiz" (AI); her biri en çok  | YAYINDA DEĞİL | F4 | ☐ |
| VB-E3 | Karo: üstte görsel ya da uçuşta logo + "01:55 → 19:25"; köşede yüz; etiket Seçili / Kartta | YAYINDA DEĞİL | F4 | ☐ |
| VB-E4 | "Kendin ara" kutucuğu (Kaydettikleriniz ızgarasının son karosu, marka bağlantıları) ve "AI | YAYINDA DEĞİL | F4 | ☐ |
| VB-E5 | v30: "en çok 7 seçenek, son kare '+N daha · Pano'da büyük aç'"; v37: 3+1 karo. İki sayı çe | ÇELİŞKİ | F4 (3+3 karar) | ☐ |
| VB-F1 | Pano şerit sütunu 296–316 px (v30 mock 264–280; canlı .pn-strip 250–272), "Neden?" yandaki | YAYINDA DEĞİL | F1d (+F2 uçuş kartı) | ☐ |
| VB-S1 | Taslak nasıl onaylanır? (v37'de "Bunu seç" yok.) Öneri: kartta küçük "✓ Bunu seç" ya da "R | YAYINDA DEĞİL | F7 (§2.1 S1) | ☐ |
| VB-S2 | Taslak kalıcı mı görünüm mü? Öneri: yazmayan görünüm (byRank[0]); sayımlar: taslak "karar  | YAYINDA DEĞİL | F7 (S2) | ☐ |
| VB-S3 | Taslak kimlere (yalnız uçuş+otel mi, tren/eSIM/sigorta da)? Kaç seçenekle (1 yeter mi)? "G | YAYINDA DEĞİL | F7 (S3) | ☐ |
| VB-S4 | PNR ne zaman görünür? v30: yalnız uçuş günü; v37 ⓘ rezervede ilk belge satırını (PNR) her  | YAYINDA DEĞİL | F2 (S4, PNR uçuş günü) | ☐ |
| VB-S5 | Etiket ve düğmeler: uçuşta "Bileti al ↗" (canlı) mı "Rezerve et ↗" (çizim) mı? "✓ Aldım",  | YAYINDA DEĞİL | F2 + F3 + F5a + F6 (S5) | ☐ |
| VB-S6 | Arka yüz satırın altındaki kartları örtüyor: son satırda/ekran altında, dar ekranda (tek s | YAYINDA DEĞİL | F4 (S6) | ☐ |
| VB-S7 | Karoda hangi ekler kalır: uyum puanı, ✓✕ ihtiyaç çipleri, "Neden?", "Tarihlerle aç", "Tüm  | YAYINDA DEĞİL | F4 (S7) | ☐ |
| VB-S8 | "AI'a arat" ne yapar? Canlıda sohbete satır gönderir; çizimde yerinde "Arıyoruz…" çubuğu,  | YAYINDA DEĞİL | F4 (S8) | ☐ |
| VB-S9 | Boş uçuşta "Aradığımız: direkt" ve tahmin aralığı nereden gelir? Uçuş için tercih listesi  | YAYINDA DEĞİL | F2 (S9) | ☐ |
| VB-S10 | Omurga → Aranıyor → Sonuçlar akışı ürün davranışı mı, yalnız çizim kontrolü mü? Ürünse: he | YAYINDA DEĞİL | F2 (S10: çizim aracı, ürün değil) | ☐ |
| VB-S11 | Pano'da taslak: çizimde taslak seçenek Pano kartında "Planda" şeridi alıyor; taslak için " | YAYINDA DEĞİL | F7 (S11) | ☐ |
| VB-S12 | Yolcu sayısı: Pano ve bilet "kişi başı = toplam / 2" sabit varsayıyor; gerçekte item.guest | YAYINDA DEĞİL | F2 (S12) | ☐ |
| VB-S13 | Niyet etiketi kamp/karavan/ayrı konaklama ("Bu geceler ayrı konaklama") ve tarihsiz gezide | YAYINDA DEĞİL | F1b (S13) | ☐ |
| VB-S14 | Rezerve uçuşta fiyat: v30 "Rezerve · €1.960 · 2 yolcu"; v37 kişi başı büyük + "2 kişi · €1 | YAYINDA DEĞİL | F2 (S14) | ☐ |
| VB-S15 | "Kaydettikleriniz" tanımı: who !== AI (kişi + eklenti + Pano linki). "Yeni" etiketi ne kad | YAYINDA DEĞİL | F4 (S15) | ☐ |
| VB-S16 | Dil/etiket birliği: "Seçili" (karo) / "Seçildi" (kart) / "Kartta" (taslak karo) / "Önerimi | YAYINDA DEĞİL | F0 + F4 (S16) | ☐ |
| VB-S17 | Uçuş "Ayrıntı" yolu: ⓘ yalnız okuma; taslak/Seçildi uçuşta "Tüm detaylar" nereden açılır ( | YAYINDA DEĞİL | F2 + F4 (S17) | ☐ |
| VB-V1 | v37 çizimleri kartın ••• menüsü, × (katlama), ✓ Aldım, Kimin için?, rötar/canlı uçuş veris | CANLI | §2.3 DOKUNULMAZ 4-8; F2/F3/F4 kabul testleri; F10 doğrular | ☐ |
| VB-V2 | Uygulanmayacak: v31 kenarda açılan seçenekler (Yan yana·Balon·Çekmece), "Bunu seç" + "En u | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (v31–v36 elenenler) | ☐ |
| VB-O1 | 1) ⓘ + Pano ferah + köşe yüzü + niyet etiketi (küçük, bağımsız); 2) kart gövdeleri (sade o | YAYINDA DEĞİL | bu plan §3 sırası (F0→F10) | ☐ |
| VB-O2 | v30 8 faz: 1 gezinme/özet, 2 kart şablonları, 3 zamana göre gösterme, 4 kart çevirme, 5 et | CANLI | zaten canlı (v30 Faz 1-8) | ☐ |
| VB-O3 | Spec sonu "Çizim onaylandı. Kod yok. Sıradaki adım: uygulama planı" ve "Uygulama durumu (2 | ÇELİŞKİ | F9 (v30 spec "Durum" bölümü güncellenir) | ☐ |
| VB-O4 | Bağlantı yapıştırınca iskelet kart, boş kartın nabzı, "Plana koy"da kartın bölümüne uçması | DOĞRULANAMADI | F8 (hareket backlog #1-#18; "Plana koy" hedefi #18) | ☐ |
| VB-O5 | Sıra: 1 ilk ekran (P3-P6), 2 niyet kartı derin hâli (P4-P9), 3 fikir standardı (P7), 4 ver | DOĞRULANAMADI | KAPSAM AÇIĞI: yol haritası sırası (P3-P9 uygulandı, P10-P11, T-sigorta açık); v46 dışı, Emre kararı | ☐ |
| VB-O6 | "Bu turun kararları yol haritasına K76 ve sonrası olarak işlenecek" (v30 spec). | YAYINDA DEĞİL | F9 (K76+ numaraları bu kararlara atanır) | ☐ |
| VB-O7 | v11 spec "Bilinçli dışarıda": konaklamaların kendi karşılaştırma bloğu; paylaşılan gezide  | CANLI | zaten canlı | ☐ |
| VB-O8 | Sonra: vibe (ışık, teras, yeşillik; fotoğraftan), kısmi konaklama kombinasyonları, "farka  | YAYINDA DEĞİL | KAPSAM AÇIĞI: PLAN.md onay bekleyen maddeler (vibe, kısmi konaklama, v1 telefon, v2 ürün); v46 dışı, Emre kararı | ☐ |
| EK-A1 | Seçildi rengi dört yerde dört farklı: v12-v13 mockup ve v30 spec "açık yeşil, kesikli, sar | ÇELİŞKİ | F0 (Seçildi rengi §2.2) | ☐ |
| EK-A2 | DESIGN.md hâlâ şunları söylüyor: sekmeler Plan \ | ÇELİŞKİ | F9 (DESIGN.md) | ☐ |
| EK-A3 | K33: "Etkinlikler · Uçuş · Konaklama · Ulaşım · Vize ve sigorta · Hazırlık · Fikirler"; v7 | ÇELİŞKİ | zaten canlı (sectionMeta.ts); F9 belge notu | ☐ |
| EK-A4 | İki ad kümesi birlikte yaşıyor: lifecycle.ts / asamalar spec / Emre 2026-10-06: Aranacak · | ÇELİŞKİ | F0 (stageWords) | ☐ |
| EK-A5 | akilli-saat spec (onaylı 2026-10-05): AB içi 2 sa / dışı 3 sa tek değer; Emre 2026-10-07:  | ÇELİŞKİ | F9 (akıllı saat spec'i) | ☐ |
| EK-A6 | urun-yol-haritasi.md K4 satırı "KODLANDI (2026-10-09, Emre onayı)" diyor, aynı belgenin so | ÇELİŞKİ | F9 (yol haritası K4 paragrafı) | ☐ |
| EK-A7 | Spec sonu "Kod yok. Sıradaki adım: uygulama planı" ve 0.36.79 sapma listesi (otel giriş sa | ÇELİŞKİ | F9 (v30 spec durum) | ☐ |
| EK-A8 | bb30cd6 (plan-v30-fix) v37'yi hedef alır; plan-v30-wip'te v38 (koçanda boş daire yok) ve v | ÇELİŞKİ | F9 (bu plan fark listesinin yerini aldı; iki dal birleşir) | ☐ |
| EK-A9 | v30 spec "Bu turun kararları yol haritasına K76 ve sonrası olarak işlenecek" der; urun-yol | ÇELİŞKİ | F9 (K76+) | ☐ |
| EK-A10 | origin/plan-v30-denetim-yerel dalındaki docs/…/2026-10-11-plan-v30-denetim-gezinme.md (7 e | ÇELİŞKİ | F9 (denetim-yerel eksikleri: F10 kapsamına alındı) | ☐ |
| EK-A11 | v30: PDF/Paylaş ikinci düğmesi ••• menüye taşınır; canlı: hem menüde hem hero'da "PDF indi | ÇELİŞKİ | KAPSAM AÇIĞI: PDF/Paylaş hero (HS22 ile aynı) | ☐ |
| EK-A12 | v11: her yerde "Plana koy" (Emre onayı); v30 etkinlik/yapılacak "Plana ekle"; canlı ikisi  | ÇELİŞKİ | F0 + F6 (Plana koy) | ☐ |
| EK-A13 | K37: artı/eksi seçim penceresinde yok; 0.36.62 seçim penceresinde "Neden? Artılar ve eksil | ÇELİŞKİ | F4 (seçim: artı/eksi ⓘ ve Pano'da; K37) | ☐ |
| P32-01 | Tür sırası: transportMode önce category === "flight" → uçuş; legModeByItem trip öğelerini  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P32-02 | "+"ın şehri ve tarihi: satır sonrası → bacağın şehri sonra cityOfAirport(kod); dönüş uçuşu | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P32-03 | Kart dışı silme (çekmece, "Ayrı olmasın") announceRemoved ile 8 sn "Geri al"; gezinin tama | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P32-04 | DB sürümü değişmez: booking, doneAt, meal isteğe bağlı alanlar; seçilmiş eSIM ve sigorta d | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P32-05 | Karar fonksiyonu: "diğer" kategori sigorta/eSIM ya da fiyat varsa needed; bilet satıcıları | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P32-06 | Fikirler sekmesine ait kararlar: hızlı satır kaydı saved/chat/none, Yeme-içme etiketi ve r | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| P32-07 | Item.meal (breakfast\ | DOĞRULANAMADI | F10 doğrular (Item.meal canlı; v46 todoBody) | ☐ |
| P32-08 | Ulaşım uçları: büyük yazı legEndsByItem şehri → cityOfAirport, küçük satır kod/istasyon ya | CANLI | zaten canlı; F0, F1, F3, F2, F5a dokunur, korunur (F10 doğrular) | ☐ |
| P33-01 | Varsayılan kayıt: şablonun türü; ulaşım from= basılan şehir, ad "Otobüs · Porto → ?"; adla | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P33-02 | Rezervasyonsuz tür eklenince "Yapılacak Fikirler'e eklendi · Göster · Geri al" bildirimi,  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| P33-03 | Alanlar ve yerleri (ulaşım uçlar/saat, kiralık yer, etkinlik/restoran ad+şehir+gün·saat, k | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P33-04 | Item.userEdits {name, city, start, end, time, price, currency, from, to}; boşaltılan/sayfa | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P33-05 | Kısa uçlar (bilinen platform adı ya da stayKind sözcüğü; "<şehir> Havalimanı + kod", "<şeh | CANLI | zaten canlı; F0 dokunur, korunur (F10 doğrular) | ☐ |
| PK-01 | Noktalı silüet deseni tek kez gizli svg'de (SilhouetteDefs, #1d1d1f); üst satır spec kabuğ | CANLI | zaten canlı; F0, F1, F3 dokunur, korunur (F10 doğrular) | ☐ |
| PK-02 | Bir ihtiyacın seçenekleri (konaklama dışı) tek kart + alt şeritte ‹ 1/2 ›; öneri cümlesi,  | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| PK-03 | Transferler ve şehir değişimi Plan'da ulaşım kartı (LegCard): taksi/transfer/metro/yürüme  | CANLI | zaten canlı; F2, F3, F5a dokunur, korunur (F10 doğrular) | ☐ |
| PK-04 | "Rezervasyonu geri al", "Seçimi geri al" ve eSIM "Kurulmadı" ayrıntı bağlantı satırına taş | CANLI | zaten canlı; F0, F2, F3 dokunur, korunur (F10 doğrular) | ☐ |
| PK-05 | Şablondan eklenen origin: "chat"; plannedKind genişler (minibus, moto_rental, rv_rental, b | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PK-06 | Konaklama kartlarına "Sil" eklenmez (spec: bugünkü hâliyle kalır). | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| PLAN-01 | Niyet profili: söylenen + kaydedilenlerden/seçimlerden sezilen, kaynağıyla, yok sayılabili | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PLAN-02 | Doğruluk: her sayfa baştan sona okunur, bulgular kanıtıyla saklanır (sayfada olmayan alınt | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PLAN-03 | Transferler plandan kendiliğinden açılır (varış, şehir değişimi, iki uçtaki havalimanı/gar | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PLAN-04 | Karar kartları yana kaydırmalı (Carousel/SwipeCard: seç → grup tek satıra iner); geceleri  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| PLAN-05 | Yapılacaklar şeridi: Karar ver / Rezerve et / Planla / ⏳ iptal süresi. | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi; yerine geçen karar canlı ya da mockup v46'da | ☐ |
| PLAN-06 | Paylaşım: ücretsiz Supabase projesi, tablolara doğrudan erişim yok, her fonksiyon gezinin  | ÇELİŞKİ | KAPSAM AÇIĞI: paylaşımın telefon web sayfası (YAYINDA DEĞİL) v46 dışı; oy/kalp davranışı F10 doğrular | ☐ |
| PLAN-07 | "Biz arama yapmayız, sunucudan kazıma yapmayız": kullanıcının gördüğü sayfayı tıklamasıyla | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |


## B. Hareket satırları (02-hareket-ve-sohbet.md, 154)
(H = ilkeler, A = sihirli açılış, K = kartlar, P = Pano/şerit, W = pencere/ana ekran, S = sohbet/başlatma, C = kodda var çizimde yok, M = çizimde var kodda yok. Hareket kararları ayrıntısı: plan §4.)

| Kimlik | Hareket (kısa) | Envanter durumu | Karşılık | Doğrulandı |
|---|---|---|---|---|
| H1 | Beş süre, üç eğri; çıkışlar girişten hızlıdır; yalnız opacity, transform, ışık ( | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| H2 | Her hareketin tek anlamı var, başka yerde kullanılmaz; hepsi 0,6 sn altı; hiçbir | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| H3 | "Pıt pıt" ritmi: parçalar okuma sırasıyla, bir vuruş arayla, hafifçe yükselerek  | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| H4 | Hareket bilgi taşır, süs değildir: sahte süre yok, adım satırları gerçek bir çağ | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| H5 | Kullanıcı kaydırırken sayfa kendi kaymaz; panel hiç otomatik kaymaz (eski "aşağı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| H6 | Dokunuş/tuş her uzun hareketi hemen bitirir | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| H7 | Reduced-motion: CSS @media (prefers-reduced-motion: reduce) + JS reducedMotion() | CANLI | zaten canlı; F8, F8e dokunur, korunur | ☐ |
| H8 | Mockup'larda reduced-motion tek kural: *{animation:none!important;transition:non | ÇELİŞKİ | F8b (Hareketi duraklat anahtarı + reduced-motion tek kural) | ☐ |
| A1 | Parça girişi (pıt pıt) | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A2 | Gezi başına bir kez | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A3 | Altta kalanlar kaydırınca bir kez | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A4 | Sayaçlar 0'dan sayar | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A5 | Çubuk soldan dolar / çizgi soldan çizilir | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A6 | İşaretle bul (sınıf adı yok) | CANLI | zaten canlı; F0, F6, F5b, F8, F7 dokunur, korunur | ☐ |
| A7 | Kartından gelen fotoğraf tekrar girmez | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A8 | Kart fotoğrafı → hero fotoğrafı büyür; geri dönerken küçülür | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| A9 | Hero blokları bilgi geldikçe belirir | CANLI | zaten canlı; F0, F7 dokunur, korunur | ☐ |
| A10 | Fotoğraf yumuşak gelir | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| A11 | ESKİ: göz kırpan maskot + aşağı kayma + geri dönme (0.36.78–0.36.81) | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| A12 | acilis-v2 A · Kıvılcım izi (çizimin önerdiği, 8/10) | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| A13 | acilis-v2 C · Sade | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| A14 | sihirli-acilis mod 0, 1, 2, 3 (maskotsuz, değnek, rehber, serpme) | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| A15 | Maskot seçimi | ÇELİŞKİ | YAPILMIYOR: maskot seçimi canlı (ilk küre); karar kaydı yok, KAPSAM AÇIĞI küçük: Emre teyidi F10'da | ☐ |
| A16 | Maskot "wink" (göz kırpma) durumu | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| A17 | İpucu yazıları ("Tıkla, hemen bitsin"; "Aşağı kaydır: altta kalanlar göründükçe  | YAYINDA DEĞİL | F8 §4(b)#13: uygulanmaz (gerekçe orada) | ☐ |
| A18 | Vuruş değerleri | ÇELİŞKİ | F8 (vuruş değerleri: canlı GAP 80 ms kalır, açılış B Emre onaylı; küçük fark kabul) | ☐ |
| A19 | Bölümlerin kaydırınca yükselmesi (.reveal .sec) | ÇELİŞKİ | F8 §4(b)#5: uygulanmaz | ☐ |
| K1 | Düşüş (sohbetin eklediği kart) | ÇELİŞKİ | F8a (düşüş çizim değeri) | ☐ |
| K2 | Nabız (boş kart bekler) | ÇELİŞKİ | F8a (nabız 1,4 sn / 7 px) | ☐ |
| K3 | Mühür + tik zıplaması | ÇELİŞKİ | F8a (mühür: çizim eğrisi + dönme kalır; hedef BookedBadge) | ☐ |
| K4 | Parlama | ÇELİŞKİ | F8a (parlama 1,1 sn / 10 px) | ☐ |
| K5 | "Yeni" parlama + etiket (kalıcı vurgu) | YAYINDA DEĞİL | F8d #9 (Yeni etiketi görülene kadar + ar-ring) | ☐ |
| K6 | Yükselme (kart hover) | CANLI | zaten canlı; F1d, F0, F2, F3 dokunur, korunur | ☐ |
| K7 | Sayaç (bütçe rakamı) | CANLI | zaten canlı; F0, F7 dokunur, korunur | ☐ |
| K8 | Kart çevirme (seçenekler / arka yüz) | CANLI | zaten canlı; F4, F8 dokunur, korunur | ☐ |
| K9 | Arka yüz kartın yerinde biner, düzen kaymaz | YAYINDA DEĞİL | F4 + F8d #6 (kart çevirme yerinde biner) | ☐ |
| K10 | Çekmece / Balon / Kart-içi seçenek (v14 alternatifleri) | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| K11 | × → ince satıra katlanma ("X kaldırıldı · Neden? [Gerek yok] [Ben hallettim] · G | ÇELİŞKİ | F8d #7 (× katlama girişi) | ☐ |
| K12 | Aşama geçişi (K29): uçak silüeti kalkış, çizim düşer, etiket zıplar, rezervede m | YAYINDA DEĞİL | F8c (K29 aşama geçişi) + F8b (Hareketi duraklat) | ☐ |
| K13 | "İndi" (landed) (sonuç gelince kart iner: halka 9 px + scale 1.015, 1,1 sn) | YAYINDA DEĞİL | F8d #2 (landed, dar) | ☐ |
| K14 | Aranıyor (kartta kayan ışık çubuğu / v37'de dönen kesikli halka) | YAYINDA DEĞİL | F2 + F8 (Aranıyor: shimmer çubuk; spin uygulanmaz) | ☐ |
| K15 | Gezinin şekli şeridi: yürüyen uçak/tren | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K16 | Uçuş kartında uçağın rotaya süzülmesi (rt-fly) | YAYINDA DEĞİL | F8d #3 (rt-fly) | ☐ |
| K17 | Canlı uçuş noktası nabzı (lv-dot) | YAYINDA DEĞİL | F8d #4 (lvp) | ☐ |
| K18 | Bölüm açma/kapama (katla/aç) | ÇELİŞKİ | F8d #8: uygulanmaz (H1); Pano "Neden?" istisnası | ☐ |
| K19 | Gelen içerik (arrivals) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K20 | Link yerleştirme sahnesi (sohbette 5 link: "…" etiketine döner, 520 ms arayla ka | ÇELİŞKİ | F8: link yerleştirme sahnesi canlıdaki mekanizma (K19) kalır; KAPSAM AÇIĞI küçük: çizimin placeLinks sahnesi uygulanmaz, Emre teyidi F10'da | ☐ |
| K21 | Geri al halkası | CANLI | zaten canlı; F0, F2, F3, F8 dokunur, korunur | ☐ |
| K22 | Karta git + parla (.flash) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K23 | Aşama halkası/çubuk dolumu | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| K24 | Kendin ara çipi, kart araç şeridi, tooltip | CANLI | zaten canlı; F0, F2, F3, F6, F8 dokunur, korunur | ☐ |
| K25 | ⓘ düğmesi balonu (v34+: 250 px balon, odakla/dokunmayla) | YAYINDA DEĞİL | F1a + F8d #16 (ⓘ balonu tipx-in .14 sn) | ☐ |
| K26 | Kalp/beğeni zıplaması | ÇELİŞKİ | F8d #16 (kalp .25 sn) | ☐ |
| K27 | Kart fotoğrafı bulanıklıktan çıkar (gezi kartı) | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| P1 | Plan ⇄ Pano sekme çizgisi ve görünüm geçişi | CANLI | zaten canlı; F0, F1d, F2, F8 dokunur, korunur | ☐ |
| P2 | Yapışkan şerit girişi | ÇELİŞKİ | F8: sticky şerit girişi canlı .22 sn ease kalır; çizim .3 sn (.16,1,.3,1); küçük fark → F8a'da çizime çekilir | ☐ |
| P3 | "Sıradaki: … →" ile karta git ve parla | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| P4 | "Plana koy/ekle": kartın adı Plan sekmesine uçar; sekme zıplar | ÇELİŞKİ | F8d #18 (Plana koy hedefi Plan sekmesi kalır) | ☐ |
| P5 | "Pano'da N alternatif" → Pano o grubu kaydırır, çerçeveler | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur | ☐ |
| P6 | "Plan'da gör →" Plan'a döner, kart parlar | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur | ☐ |
| P7 | Pano boş/sonuçsuz durumda maskot | CANLI | zaten canlı; F0, F1d, F2, F8 dokunur, korunur | ☐ |
| P8 | Pano açılışı: iskelet önce, kartlar "tık tık" iner, sayılar 0'dan sayar, öneri ş | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| P9 | Pano "Neden?" yükseklik açılışı (.detail grid-template-rows .4s, .why2 svg ok .3 | YAYINDA DEĞİL | F8d #8/#16 (Pano "Neden?") | ☐ |
| P10 | Harita sekmesi: uçuş tekrarı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| W1 | Arka perde girişi | CANLI | zaten canlı; F0, F2, F3, F8 dokunur, korunur | ☐ |
| W2 | Pencere kartı büyür | ÇELİŞKİ | F8: pencere kartı büyür canlı kalır (260 ms scale .96); çizim farkı küçük, kabul | ☐ |
| W3 | Çekmece (ItemDrawer) sağdan kayar | ÇELİŞKİ | F8: çekmece tam genişlik kayar canlı kalır; kabul | ☐ |
| W4 | Çıkış kopyası (pencere/çekmece solarak kapanır) | CANLI | zaten canlı; F8e, F8 dokunur, korunur | ☐ |
| W5 | Kart seçenek penceresi (ChoiceSheet) bu animasyonların dışında | CANLI | zaten canlı; F4 dokunur, korunur | ☐ |
| W6 | Profil açılır menüsü | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| W7 | Ayarlar: yanlış anahtar kutusu sarsılır | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W8 | Çevrimdışı şeridi ("İnternet yok · N sn sonra tekrar deniyorum") | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W9 | "Asistana bağlanamadım · Ayarlar'a git" şeridi | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W10 | Sohbet hata satırı | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W11 | "N kayıt işleniyor…" hapı | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W12 | Boş ekranlarda maskot, sonra yazılar sırayla yükselir | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| W13 | Ana ekran girişleri (başlık, kutu, çipler, gezi kartları) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| W14 | Ana ekran arka planı "A · Rota" (kâğıt uçak 18 sn döngü) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| W15 | Ana ekran arka planı B Aurora, C Topografya | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| W16 | Yer tutucu cümlelerin dönmesi | YAYINDA DEĞİL | F8d #12 | ☐ |
| S1 | Giriş kutusu → sohbetin ilk mesajı akar (Enter anı) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S2 | Sağ taraf (plan/kontrol listesi) kayarak gelir | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S3 | Oluştur sonrası pano yumuşak açılır; sohbetten çıkış | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S4 | Yan panel (kontrol listesi/önizleme) kayması | CANLI | zaten canlı; F0, F1d, F2 dokunur, korunur | ☐ |
| S5 | Asistan mesajı girişi | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S6 | Okuyor… satır hâli | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S7 | Satır tamamlanınca tik zıplar + 6 nokta saçılır | ÇELİŞKİ | F8: tik 450 ms canlı kalır (çizim 340 ms), küçük fark kabul | ☐ |
| S8 | Halka ilerlemesi (x/6) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S9 | Sorulan satır nefes alır | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S10 | "Kart iner" (600 ms, kartlar arası 90 ms, köşede nabız) | YAYINDA DEĞİL | YAPILMIYOR: başlatma sohbetinde "kart iner" yok (plan taslağı vazgeçildi, S19); F8d #10 | ☐ |
| S11 | "Sayı" – rakam yukarı kayarak değişir (450 ms, zıplamaz) | YAYINDA DEĞİL | YAPILMIYOR: sayı kayması uygulanmaz (#11) | ☐ |
| S12 | "Satır" – sohbete düşen adım satırı yukarı süzülür, tik kendi "pıt"ını yapar (50 | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S13 | Düşünme satırı (başlatma sohbeti) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S14 | "Yazıyor…" aşaması | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| S15 | "Oluşturuyorum… 3 · Vazgeç" geri sayımı | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S16 | Oluştur her adımda basılabilir; tek kelime "Oluştur" | ÇELİŞKİ | F8: basış animasyonu uygulanmaz; KAPSAM AÇIĞI çok küçük, Emre teyidi F10'da | ☐ |
| S17 | Önizleme şeridi (sağ kartın tepesinde fotoğraflar) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S18 | Canlı sohbet: soru beklemeden gelir (0 sn), cevaplarken sağ taraf dolar (1 sn),  | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S19 | "Plan taslağı" (sağda kartlar sohbet ilerledikçe düşer, cevap bir kartı değiştir | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| S20 | Soru sırası (K4) ve konuşan sorular | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S21 | Ana ekran önerileri çalışır | ÇELİŞKİ | KAPSAM AÇIĞI: "Yol gezisi · yakında" etiketi (M18); modlar canlı, etiket kodlanmaz; Emre kararı | ☐ |
| S22 | Kartlarda yüzler yalnız grup gezisinde | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S23 | Oluşturma ekranı iskeleti | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S24 | Dünya haritası zaman çizelgesi (SVG, MapLibre yok) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S25 | Ev simgesi pop, hedef etiketi | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S26 | Uçak | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S27 | İniş halkası | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S28 | Duraklar düşer | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S29 | Fotoğraflar haritanın üstünde büyük açılır; kutu erir | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S30 | Adım tiki yeşil dolu, gm-pop | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S31 | Her adım sohbette tikli satırla yazılır | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S32 | Yelpaze fotoğraflar (harita yoksa) | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S33 | Eski harita sürümleri | VAZGEÇİLDİ | YAPILMIYOR: vazgeçildi (kayıtlı; ölü kod kalıntısı F9 silme önerisinde: A16 Mascot wink, S33 WorldFlight) | ☐ |
| S34 | Dünya haritası sohbet sırasında yüklenir; öneriler beklenmez | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S35 | Düşünüyor… satırı + üç nokta | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| S36 | Maskot yüzü | CANLI | zaten canlı; F8 dokunur, korunur | ☐ |
| S37 | Sohbet mesajı girişi (.msg rise .45 s) | YAYINDA DEĞİL | F8d #14 (board sohbet mesajı girişi) | ☐ |
| S38 | Sohbet yalnız kendi kutusunu kaydırır | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S39 | Sohbet adım satırları, katlanan değişiklik satırları, öneri kartları | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S40 | Ana ekrandan gelen satır (pending) "Porto'da bir otel daha" bu gezinin sohbetine | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| S41 | Link/dosya bırakınca çip, çerçeve, toast | CANLI | zaten canlı (v46'dan etkilenmez) | ☐ |
| C1 | Beş süre / üç eğri belirteçleri | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C2 | Sekme çizgisi (mv-tab) ve görünüm fade (mv-fade) | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C3 | Pencere/çekmece çıkış kopyası (exitMotion) | - | F8e (exitMotion testi) | ☐ |
| C4 | Bölüm açılışı mv-unfold + ok dönüşü | - | F8d #8 (mv-unfold kalır) | ☐ |
| C5 | Kart fotoğrafı → hero (withTripPhoto) ve geri | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C6 | Düşünme satırı üç noktası, maskot oops/sleepy/zz, ms-breathe | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C7 | Kart fotoğrafı bulanıklıktan çıkış (mv-blur-up) | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C8 | "N kayıt işleniyor…" hapı, boş ekran yükselişi, hata girişi, anahtar sarsıntısı, | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C9 | "Plana koy" uçuşu | - | F8d #18 (putFly) | ☐ |
| C10 | Işık süpürmesi (mv-sweep) bekleyen link satırında | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C11 | pk-undo halkası | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C12 | hm-pop profil menüsü, hm-rise ana ekran girişi, .st-go/.st-start hover | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C13 | .vcard:hover .pic −3 px (.5 sn), gezi kartı st-draft hover | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| C14 | Mascot wink durumu (ölü), FlightMap rev-3 haritası (ölü), --t-instant (kullanılm | - | F9 (ölü kod silme önerisi) | ☐ |
| C15 | exitMotion/putFly/viewTransition kurulum çağrıları | - | zaten canlı (kodda var, çizimde yok); F8b reduced kontrolü, F10 doğrular | ☐ |
| M1 | K29 aşama geçişi: uçak silüeti kalkış (takeoff 1.1s), çizim düşer (drop .7s), et | - | F8c | ☐ |
| M2 | "İndi" (landed) ve v33 Omurga → Aranıyor → Sonuçlar akışı | - | F8d #2 | ☐ |
| M3 | rt-fly (uçağın karta süzülmesi), lvp (canlı nokta) | - | F8d #3-#4 | ☐ |
| M4 | Bölümlerin kaydırınca yükselmesi (.reveal .sec, 0,7 sn) | - | F8 #5: uygulanmaz | ☐ |
| M5 | Kart çevirme yerinde biner (.backov, placeBack) | - | F4 + F8d #6 | ☐ |
| M6 | × katlama satırının girişi (fold rise .3s) | - | F8d #7 | ☐ |
| M7 | "Yeni" parlama + etiket (4,4 sn) | - | F8d #9 | ☐ |
| M8 | Pano açılışı "iskelet önce, kartlar tık tık" | - | F8d #10 (küçük hâli) | ☐ |
| M9 | "Kart iner" / "Sayı yukarı kayar" / press | - | F8d #10-#11 (uygulanmaz) | ☐ |
| M10 | Yer tutucu cümlelerin dönmesi | - | F8d #12 | ☐ |
| M11 | Açılış ipucu yazıları | - | F8d #13 (uygulanmaz) | ☐ |
| M12 | Sohbet mesajı girişi (rise .45 s) | - | F8d #14 | ☐ |
| M13 | Toast girişi (translateY(20px), .35 sn); kodda .pk-undo girişi animasyonsuz | - | F8d #15 | ☐ |
| M14 | ⓘ balonu, Pano "Neden?" yükseklik açılışı, kalp zıplaması | - | F8d #16 | ☐ |
| M15 | "Hareketi duraklat" / "oynat" düğmesi (ürün özelliği olarak K29'da geçiyor) | - | F8b | ☐ |
| M16 | Bölüm yükseklik animasyonu (grid-template-rows) | - | F8d #8 (uygulanmaz; Neden? istisna) | ☐ |
| M17 | "Yazıyor…" aşaması | - | F8d #17 (uygulanmaz) | ☐ |
| M18 | "Yol gezisi · yakında" etiketi | - | KAPSAM AÇIĞI: "Yol gezisi · yakında" etiketi (S21 ile aynı) | ☐ |


## C. v46 mockup bileşenleri ve ekranları (46)
Kaynak: v46 HTML'indeki işlevler (`hero`, `secBlock`, `ticket3`, `mvTicket`, `evCard`, `backFace`, `panoPage`, `storyView`…) ve iki gezi sekmesi (Japonya klasik tur, Ozora festival). Ekran görüntüsü çifti (1440 / 390 / EN) F10 çıktısında aranır.

| Kimlik | Bileşen / ekran | Karşılık | Doğrulandı |
|---|---|---|---|
| V46-01 | Üst çubuk: logo, gezi seçici, Plan | Pano (sayı), ••• gezi menüsü (Belgeler · Paylaş · Geçmiş), yüzler (`topbar`, `openTripMenu`) | zaten canlı (App.tsx/TripPanel sekmeleri, gezi menüsü); F0 yalnız sayı rozeti; F10 doğrular | ☐ |
| V46-02 | Sohbet paneli: mesajlar, bağlantı yerleşiyor…, çipler, "Arıyorum…" düşünme noktaları, yapıştırılan link taslağı, giriş kutusu (`chatHtml`, `askAI`) | zaten canlı (Chat.tsx, ChatFold, ChatOffers); F8d #14 (mesaj girişi); S8 "AI'a arat" sohbet satırı yolu | ☐ |
| V46-03 | Hero v9 (ülke, hava, para, priz, saat farkı, dil, bütçe, tercihler; `hero`) | zaten canlı (TripHero/TripFacts); F10 doğrular | ☐ |
| V46-04 | Yapışkan mini hero: halka %, bütçe, "Sıradaki →" (`miniHero`, `watchHero`, `nextOf`) | zaten canlı (StickyBar.tsx); F0 (halka tonları/sayım sözlüğü), F7 (taslak seçilmiş sayılmaz, S2) | ☐ |
| V46-05 | Gezinin şekli şeridi: duraklar + araç ikonları (`journey`) | zaten canlı (TripShape.tsx); F10 doğrular | ☐ |
| V46-06 | Plan görünüm çubuğu: Kategoriye göre · Yolculuk sırasıyla · Gün gün + renk anahtarı 5 durum (`planView`, `sortsw`, anahtar) | F0 (5 durumlu PlanKey) + F5b (sekme içeriği); sekme çubuğu zaten canlı | ☐ |
| V46-07 | Bölüm başlığı: ad, sayaç, "N önerimiz · N seçildi · N aranıyor", bütçe payı, aç/kapa (`secBlock`) | F0 + F7 (başlık cümlesi); bölüm yapısı zaten canlı (Section.tsx) | ☐ |
| V46-08 | Uçuş bileti, 6 durum: Arıyoruz · Aranıyor · Önerimiz · Seçildi · Bilet alındı · Ayarlandı (`ticket3`, `ticketCard`, `cleanFlight`) | F2 | ☐ |
| V46-09 | Boş uçuş bileti: "Aradığımız: direkt", "N seçenek"/"Seçenek ara", kapsülsüz tahmin | F2 | ☐ |
| V46-10 | Canlı uçuş şeridi: rötar, kapı, PNR; "Bilet alınmadı · uçuşa N gün" (`liveStrip`, `buyWarn`) | zaten canlı (FlightTiles/flightAlert/dateAlert); v46 yeni biletinde çizim kısaltılmış, **canlı davranış korunur** (§2.3-4, -6); F2 kabul testi | ☐ |
| V46-11 | Otel kartı sade: görsel + niyet etiketi + marka + puan + ad + "İade yok" + Değiştir N + gece fiyatı + Rezerve et ↗ (`stayCard`, `cleanStay`) | F3 + F1b | ☐ |
| V46-12 | Boş otel kartı (Arıyoruz) ve seçenekli ("N seçenek ›") | F3 + F4 | ☐ |
| V46-13 | Kamp / karavan (Ozora): kamp kartı, "bilete dahil" | zaten canlı (CampBody); F3 korur (S13 niyet etiketi "Kamp") | ☐ |
| V46-14 | Ulaşım kartı dolu: ok başlık, tarih·saat kapsülü, araç, soldan sağa saat/durak, süre, alt satır (`mvTicket`) | F5a | ☐ |
| V46-15 | Ulaşım kartı rezerve / Ayarlandı / belge çipi / "belge yok" | F5a + F0 | ☐ |
| V46-16 | Ulaşım boş kart: ok başlık, "seç, ben arayayım", mod kutucukları (`mvEmptyTop`, `emptyMove`) | F5a | ☐ |
| V46-17 | Kiralık araç / Ozora "araba al-bırak" kartı | zaten canlı (rentalLine); F5a düzene uyar | ☐ |
| V46-18 | Etkinlik bölümü: şehir şehir satırlar, kart, boş şehir "AI'a arat", üst şerit "AI buldu · siz eklediniz" (`expBody`, `evCard`) | F6 | ☐ |
| V46-19 | Etkinlik kartı hover araçları (↻ başkasını öner, ✓ bileti aldım, ×), "Gezinin sebebi" kapsülü, belge çipi | F6 | ☐ |
| V46-20 | Etkinlik ayrıntı penceresi (`openEvDetail`) | zaten canlı (BookingSheet / ItemDrawer); F0 rozet; F10 | ☐ |
| V46-21 | Yapılacaklar ve restoranlar bölümü (`todoBody`) | zaten canlı (IdeaTiles); F0 rozet; F10 | ☐ |
| V46-22 | Belgeler ve internet (`docBody`), Hazırlık (`prepBody`), İlham (`inspBody`) | zaten canlı (docs/, PrepList, ideas); F10 doğrular | ☐ |
| V46-23 | Arka yüz uçuş: Kaydettikleriniz / Önerimiz, 3 kart yan yana, Kendin ara şeridi, AI'a arat şeridi, "Pano'da aç · +N" (`backFace`, `bfRow`, `fo`) | F4 + F2 (FlightOption) | ☐ |
| V46-24 | Arka yüz otel: karo (görsel, yüz, etiket Seçili/Kartta/Yeni, puan, gece fiyatı, Seç) (`tile`) | F4 | ☐ |
| V46-25 | Arka yüz yerinde biner (`placeBack`, `.backov`), kapatma (×, boşa basış) | F4 (S6) + F8d #6 | ☐ |
| V46-26 | Seçenek açma kipleri Çevir/Balon/Çekmece (`OMODES`, `openMode`, `backCard`, `optList`, `swipeFoot`, `trayHtml`, `dropHtml`) | YAPILMIYOR: çizim aracı seçicisi; v31 vazgeçildi (yalnız "Çevir" kalır) | ☐ |
| V46-27 | Seçim penceresi (`openPicker`, `pk`) | zaten canlı (v30 arka yüzü yerini aldı; K25 vazgeçildi); YAPILMIYOR: ayrı pencere | ☐ |
| V46-28 | Onay kutusu (`confirmBox`, `dialog`) rezervasyon silme | zaten canlı (confirm); §2.3-9 | ☐ |
| V46-29 | Kart ayrıntı penceresi rezerve (`openDetail`, `detailHtml`: kimden, belge, değişiklik, İptal ettim) | zaten canlı (BookingSheet.tsx); F0 rozet | ☐ |
| V46-30 | Kart menüsü ••• (`openMenu`: Düzenle, Kimin için?, Gerek yok…) ve ActionStrip | zaten canlı (CardMenu/ActionStrip); §2.3-5 | ☐ |
| V46-31 | Köşe yüzü (kim kaydetti/AI) kartta, karoda, etkinlikte, mini kartta | F1c | ☐ |
| V46-32 | ⓘ bilgi balonu (`infoBtn`) uçuş, otel, ulaşım | F1a | ☐ |
| V46-33 | Tek "satın alındı" rozeti `okt` (bilet, otel, ulaşım, etkinlik, Gün gün, Yolculuk, Pano) | F0 | ☐ |
| V46-34 | Pano sayfası: kategori çipleri, arama, uçuş şeridi/kartı (pfRow), otel/etkinlik kartları, kalp, uyum, "Neden?", Planda/Önerimiz şeridi, Karşılaştır (`panoPage`) | F1d + F2 + F0 + F7 (S11) | ☐ |
| V46-35 | Pano karşılaştırma tablosu | zaten canlı (Pano.tsx table); F0 rozet; F10 | ☐ |
| V46-36 | Yolculuk sırasıyla (v46): Yola çıkış, uçuş, ulaşım, şehir başlığı, otel, etkinlik kartları, yapılacak kutusu, Eve dönüş (`storyView`, `jf*`, `jc*`, `jsEv`) | F5b | ☐ |
| V46-37 | Gün gün görünümü (`dayView`): gün kutusu, o günün satırları, "Gece: şehir" | zaten canlı (DayCards.tsx); F0 rozet (dg-lab → BookedBadge); F10 | ☐ |
| V46-38 | İki gezi sekmesi: Japonya klasik tur ve Ozora festival (`TRIPS`, `useTrip`) | F10 (iki gezi ekran denetimi); canlıda örnek gezi + Ozora şablonu zaten var | ☐ |
| V46-39 | Durum şeridi Omurga · Aranıyor · Sonuçlar ve ▶ Baştan oynat (`stagesUI`, `play`) | YAPILMIYOR: çizim aracı (S10); "Aranıyor" durumu F2/F8 ile ürün tarafında karşılanır | ☐ |
| V46-40 | Çizim araçları: gezi sekme seçici, açılış kipi seçici, "Hareketi duraklat" düğmesi | YAPILMIYOR: çizim aracı; ürün karşılığı yalnız "Hareketi duraklat" Ayarlar anahtarı (F8b) | ☐ |
| V46-41 | Koyu tema (v40+ `--okb` koyu değerleri, `.jc-pi.food/.go` koyu) | F0 (belirteçler) + F5b (minik kare koyu zemin) | ☐ |
| V46-42 | Dar ekran (≤640 px) düzenleri: mini kart, bilet clamp, tek sütun arka yüz | F2 + F4 + F5b + F10 (390 px denetimi) | ☐ |
| V46-43 | Tarihsiz gezi kipi (Nisan · ~2 hafta; "Gün N", "N gece") | F5b + F1b + F6; F10 doğrular | ☐ |
| V46-44 | Hover/odak aracı opaklıkları (`.hz-tools`, `.mvt-x`, `.td-img .hz-ib`) .15–.18 sn | F8d + F6 + F5a | ☐ |
| V46-45 | Sohbet "Plana koy" ile kartın yerleşmesi (`landed`, `arrive()`) | F8d #2 + F8c; link yerleştirme canlı mekanizma (K19) | ☐ |
| V46-46 | v46 hareket CSS/JS: yeni keyframe yok (yalnız `spin`, uygulanmaz); `.jf-link` statik; `.jm` hover .15 sn | §4: F8 kapsamı tamam; yeni hareket satırı yok | ☐ |


## D. v40–v46'nın envanterde olmayan yeni kararları (15)
Envanter (v39'a kadar) bunları içermiyordu; plan §1.2 ve §2'de karara bağlandı.

| Kimlik | Karar | Karşılık | Doğrulandı |
|---|---|---|---|
| N1 | v40: Tek rozet koyu yeşil, damga kalktı | F0 | ☐ |
| N2 | v41: yeşil zemin yalnız alınmışta | F0 | ☐ |
| N3 | v40–v41: etkinlik şehre göre, site adı düğmede, "belge yok" | F6 | ☐ |
| N4 | v42: uçuş seçeneği kartı (3 yan yana; Pano aynı genişlik) | F2 + F4 | ☐ |
| N5 | v42–v43: ulaşım ok başlık + tarih/saat kapsülü, soldan sağa | F5a | ☐ |
| N6 | v43–v46: Yolculuk (v46 final; v44 gün kapsülü ve v45 durak bloğu geçersiz) | F5b | ☐ |
| N7 | v39: kesikli çizgi hiçbir kartta yok (Yolculuk Arıyoruz kesikli istisna) | F0 | ☐ |
| N8 | v39: "Uçuşa N gün" amber uyarı; sözcük korunur (tam metin) | F2 | ☐ |
| N9 | Mockup uppercase tür etiketi (`.jm-k`, `.jc-k`, `.jc-l`) DESIGN.md "büyük harf yok" kuralıyla çelişir | F9 (DESIGN.md) — karar: uppercase + lang="tr" doğrulaması; Emre teyidi F10 | ☐ |
| N10 | v46 "Yola çıkış" koyu hap (başlangıç) — canlı Yolculuk'ta yok | F5b | ☐ |
| N11 | v45–v46 otel "Giriş X · Çıkış Y" (tarihsizde "N gece") | F5b | ☐ |
| N12 | v46 yapılacak/restoran minik kareler: restoran turuncu, gezilecek mavi zemin, koyu tema varyantı | F5b | ☐ |
| N13 | v42 belirsiz ulaşım: ortada kesikli yol + küçük mod kutucukları | F5a | ☐ |
| N14 | v41 Pano uçuş şeridi: rozet + ilk artı/eksi + uyum | F2 | ☐ |
| N15 | v40 etkinlikte "Gezinin sebebi" iğneli kapsül | F6 | ☐ |


## E. F10 denetim protokolü (özet)
1. Bu tablodaki her satır için Doğrulandı sütunu kanıtla doldurulur.
2. v46 mockup'ı her ekran: 1440, 390, EN; Japonya + Ozora; Plan 3 görünüm, Pano, sohbet, arka yüzler, ⓘ, ayrıntı pencereleri; çiftler `e2e-output/v46/`.
3. tsc, vitest, e2e (faketime), eski veriyle açılış (IndexedDB değişmez).
4. Açık satır ya da HATA varsa kodlayan ajana geri; denetçi kod yazmaz. Sonuç: `fark-raporu.md` + bu tablo.
