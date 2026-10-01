# Trip Radar

## For Sabine (English)

Trip Radar is a Chrome extension for planning a trip together. Save any hotel, flight or activity page with one
click; the AI reads it, compares the options and puts them in a shared plan you can vote on.

**1. Install**

- **Mac** (updates itself): paste this into Terminal once:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/yemredurmuss-hue/trip-radar/release/install.sh | bash
  ```
  Then in Chrome open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and
  pick the `TripRadar` folder in your home folder (`~/TripRadar`).
- **Windows or anything else:** download
  [the release zip](https://github.com/yemredurmuss-hue/trip-radar/archive/refs/heads/release.zip) and unzip it.
  In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the
  `extension` folder inside. This version doesn't update itself: repeat these steps to get a new one.

**2. Get the free Gemini key.** A setup screen opens right after installing and walks you through it
(**Get a free key from Google** → **Create API key** → paste it back). No card needed.

**3. Choose English.** At the top of the setup screen (and later in **••• → Settings**) pick
**Dil / Language → English**.

**4. Join our trip.** Go to **My trips** → **Join a shared trip**, paste the code Emre sends you (it starts with
`TR1:`), add your name and click **Join**. Pages anyone saves show up for everyone within a minute, and you can
👍 / 👎 every option.

---

Kişisel seyahat karar panosu. Gezerken gördüğün otel, uçuş, etkinlik ve eSIM sayfalarını tek tıkla
kaydedersin. AI her kaydı okur, doğru geziye ve kategoriye koyar, seçenekleri karşılaştırır.
Sohbetle birlikte karar verirsiniz.

> Kişisel sürüm (v0): sunucu yok. Her şey Chrome eklentisinin içinde çalışır. Veriler yalnız bu
> tarayıcıda (IndexedDB) durur. İstersen bir geziyi birlikte gezdiğin kişiyle paylaşabilirsin; bunun için
> ücretsiz bir Supabase projesi kurulur (aşağıda "Paylaşım").

## Kurulum: otomatik güncellenen (Mac, önerilen)

Terminal'e bir kez yapıştır:

```bash
curl -fsSL https://raw.githubusercontent.com/yemredurmuss-hue/trip-radar/release/install.sh | bash
```

Sonra Chrome'da `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `~/TripRadar`.
Bundan sonra yeni sürüm yayınlandıktan 1-2 dakika sonra kendiliğinden gelir: güncelleyici dakikada bir
`release` dalının commit'ine bakar (önbellek gecikmesi yok) ve kendini de günceller. Pano açıksa ve
yazılı bir şey ya da açık pencere yoksa kendini yenileyip kaldığı yerde açılır; varsa sağ altta
**Yeni sürüm hazır → Şimdi güncelle** çıkar. Eski (saatlik) kurulumu hızlandırmak için yukarıdaki komutu
bir kez daha çalıştırmak yeter. Kapatmak için:
`curl -fsSL https://raw.githubusercontent.com/yemredurmuss-hue/trip-radar/release/uninstall.sh | bash`

Yayınlama (geliştirici): `static/manifest.json` sürümünü artır → `scripts/release.sh` (`release` dalına gönderir).
Eklenti kimliği `manifest.json`'daki `key` ile sabittir; klasör değişse de ayarlar ve veriler kalır.

## Kurulum: elle (5 dakika)

1. **Derle** (Node 20+ gerekir):
   ```bash
   npm install
   npm run build
   ```
2. **Chrome'a yükle:**
   - `chrome://extensions` sayfasını aç.
   - Sağ üstten **Geliştirici modu**nu aç.
   - **Paketlenmemiş öğe yükle** → `dist/` klasörünü seç.
3. **Sabitle:** Araç çubuğundaki yapboz simgesi → Trip Radar → 📌.
4. **Ücretsiz Gemini anahtarını bağla (ilk kurulumda kurulum ekranı kendiliğinden açılır):**
   - **Google'dan ücretsiz anahtar al** düğmesine bas → açılan sayfada **Create API key** → kopyala (kart gerekmez).
   - Trip Radar sekmesine dön, anahtarı yapıştır. Eklenti anahtarı doğrular, en uygun ücretsiz modeli seçer ve kaydeder.
   - İstersen **Claude · ücretli** sekmesinden Claude anahtarıyla da çalışır.

Kodu güncellediğinde `npm run build` çalıştır, sonra `chrome://extensions`'ta Trip Radar'ın ↻ simgesine bas.

## Kullanım

| Ne yapıyorsun | Ne oluyor |
|---|---|
| Bir sayfadayken simgeye tıkla (ya da **Alt+Shift+S**) | Link, sayfanın tüm yazısı, sayfadaki düzenli veri ve ekranın görüntüsü birlikte kaydedilir. AI arkada işler. |
| Panoda kutuya **link yapıştır** | Linkten tarih/kişi okunur. Ayrıntı için sayfayı açıp simgeye tıkla. |
| Panoya **ekran görüntüsü sürükle/yapıştır** | Telefondan attığın ekran görüntüleri de işlenir. |
| Sohbete yaz | "Merkezi olsun, bütçe €1500", "Hangisi daha iyi?", "Casa Azul'u ele", "Jardim'i rezerve ettim" gibi. |
| Satıra tıkla | Fiyatın bağlamı (tarih, kişi, oda, iptal), kaynağı, puan dökümü, orijinal link. |
| Grubun altındaki **Karşılaştır →** | Seçenekler yan yana: her kriterin değeri, önemi (sen seçersin), nedenler, "ne değişirse sonuç değişir". |

**Her gezi ayrı bir pano ve sohbettir.** Açılışta **Seyahatlerim** listesi gelir; bir geziye girince
solda o gezinin kendi sohbeti, sağda panosu olur. **‹ Seyahatlerim** ile listeye dönülür.

**Söylediğin de panoya gelir, linki olmasa da.** Sohbette "7 Ekim'de İstanbul'dan Porto'ya uçuyoruz", "11 Ekim'de
Madeira'ya uçakla geçeriz", "Madeira'da araba kiralarız" ya da "10–17 Ekim Funchal'da kalacağız" dersen hemen kendi
gününe ve şehrine eklenir, üstünde durumu yazar: "Planlanıyor · bilet alınmadı"; "aldık" dersen "Bilet alındı ✓".
Sonra o gün için bir uçuş (ya da konaklama) sayfası kaydedip seçince, planın yerini o alır. Bir şehir değişimini
kartından da işaretleyebilirsin (✈ Uçak, 🚆 Tren...): uçakla ise uçuş kartı gibi görünür, o günün uçuş araması
ve iki uçtaki havalimanı transferleri açılır. "Bileti aldım"ı yanlışlıkla bastıysan **Geri al** ile dönersin.

**Küçük işler tek satır.** eSIM, taksi, havalimanı transferi, seyahat sigortası gibi şeyler uçak ya da otel kadar yer
kaplamaz: simgesi, adı ve günü, durumu ("Planlanıyor"), fiyatı ve tek eylemi ("Rezerve ettim", "Kaldır") tek satırda.

**Üstte gezinin özeti.** Küçük görsel, ad, "7–18 Ekim · 12 gün · Porto → Funchal" (şehirler gidiş sırasıyla),
yeri seçilen konaklama sayısı ("1/2 konaklama"), ulaşım ve etkinlik (sıfırsa yazmaz). Altında maliyet çubuğu: çubuğun
tamamı tahmini toplamdır (sağ ucunda yazar; bütçe verdiysen bütçe), yeşili rezerve edilen, turuncusu seçilip
rezerve bekleyen, taralısı karar bekleyenlerin tahmini; fiyatı olmayan kalemler ayrıca sayılır.

**Planı sohbetten şekillendirirsin.** "Porto tek blok olsun, 7–12" dersen o şehrin o gecelerdeki eski sohbet
konaklamaları tek bloğa birleşir (seçtiğin yer yalnız bir kısmını kapsıyorsa blok yine tek kalır, kapsanmayan
geceler altında yazar). "12 Ekim'e uçak bileti" nereye gideceği belli olmadan da bir bilet şablonu açar; nereden
nereye, saat ve fiyat söyledikçe aynı kartın üstüne yazılır. "11'ine taksi koyalım" o günün transferine taksi olarak
oturur (transfer yoksa kendi bloğu olur), "eSIM alalım" eSIM bölümüne planlanıyor olarak gelir. Sohbette eklenen her
plan sağda **Kaldır** ile tek dokunuşta silinir; sohbette "taksiyi kaldır" demek de yeter.

**Pano, gezinin kendisi gibi sıralıdır.** Bir çizgi boyunca solda ne ve ne zaman (koyu yuvarlak simge, "Varış ·
8 Ekim", "Konaklama · 1–4. gün · 8–11 Ekim · 3 gece"), sağda büyük yuvarlak kartlar: gidiş uçuşu, havalimanından
otele transfer, konaklama, o günlere tarihli etkinlikler, şehir değişimi (iki uçtaki gar/havalimanı transferleriyle),
sonraki konaklama ve dönüş. Her şehir tek bir blok olur ("1 Porto · 8–11 Ekim · 3 gece"): içinde o şehrin transferleri,
geceleri, günleri ve kiralanan araç; şehirler arasındaki uçuş ya da tren blokların arasında durur. Tarihi olan her
uçuş kendi gününe konur; kayıt sayfaları aynı "ihtiyaç" adını verse de dönüş uçuşu gidiş uçuşunu kapatmaz. Gidiş ya da dönüş için kayıt yoksa "Henüz eklenmedi" yazar ve o günün uçuş aramasına link
verir (arabayla gideceğini söylediysen sormaz). Tarihsiz yerler ve plana oturmayan uçuşlar altta ayrı durur.

**Seçilmemiş her ihtiyaç sıralanır: 1, 2, 3, 4…** Onlarca link atsan da seçenekler en iyiden en kötüye numaralı durur
(ilk beşi açık, gerisi "+N seçenek daha"). Üstte tek cümle: önerin ve nedeni, sonra bir önceliğe göre öne çıkan
alternatifler sırasıyla ("Önerim Casa Ribeira: en iyi konum; €60 fazlasına mutfak var. Tasarruf ve sessizlik için
2. Bonfim Loft (€60 daha ucuz)").
- **Kartta:** büyük fotoğraf (geniş ekranda solda, dar ekranda üstte), üstünde sıra numarası, uyum puanı (0–100) ve
  site bağlantısı; yanında neyde en güçlü olduğu ("EN EKONOMİK · EN SESSİZ"), ad, tür ve puan ("Otel odası · 8,9
  Çok iyi · 1.204 yorum"), fiyat ("€285 · 3 gece toplam · €95 / gece").
- **Neden bu sırada:** 1.'ye göre (1. kartta 2.'ye göre) fark, kazancı ve eksiği: "1.'ye göre +€45 (gecelik +€15) ·
  yorumlar daha iyi · eksiği: hafta sonu gece gürültüsü · 3 yorum, iade yok".
- **İstediklerin** için bir işaret (✓ Sessiz · ? Mutfak), sonra **artılar ve eksiler** tam cümleyle (en önemlisi
  üstte, "yalnız bunda" olanlar işaretli).
- **Durum:** Uygun olanlar önce; sonra **Seçmeden kontrol et** (bir şart sayfada yazmıyor, fiyat toplam mı gecelik
  mi belli değil, tek bir misafir ciddi bir şey bildirmiş), **Kısmi** (gecelerin bir kısmı), en sonda **Uygun
  değil** (şart karşılanmıyor, herkes için olmaz bir sorun, bütçe tavanı). Kararı değiştirebilecek eksik bilgi
  cümlenin altında yazar ("Bonfim Loft: mutfak yazmıyor · Sayfada bak ↗").
**Detaylar** kartın içinde kısa açılır: tek cümleyle neden önde/geride olduğu, karar veren
bilgiler (tarih, yer, puan, iptal, giriş/çıkış saati; uçuşta kalkış, varış, süre, aktarma, bagaj), en fazla dört
artı ve dört "Dikkat". Bütün bulgular kanıtıyla ("Kanıt", "Sorun değil") **Tüm detaylar**da. Duman dedektörü, saç
kurutma makinesi gibi önemsiz ayrıntılar puana ve kartlara girmez. Kartlardaki her şey kayıttan ya da hesaptan
gelir; kart için ayrıca AI çağrılmaz.

**Seçilen şey sade tek bir karta iner.** Uçuş bir rota olarak (IST ——✈—— OPO, süre, direkt/aktarma, paket),
konaklama ve etkinlik resmi, adı, oda/tür, iptal koşulu, puanı ("8,9 · Çok iyi · 1.204 yorum") ve fiyatıyla (toplam
ve gecelik). Durumu kartın üstünde renkli bir şerittir: yeşil **✓ Bilet alındı / Rezerve edildi**, amber
**Planlanıyor / Seçildi · bilet alınmadı**, kesikli **Planlanmadı**; zaman çizgisindeki simge de aynı renktedir.
Altta **Rezerve ettim / Bileti aldım** (yanlışlıkla basıldıysa **Geri al**) ve **⇄ Değiştir** (kartlar geri gelir).
Seçilen kartta artı/eksi yoktur; karşılaştırma seçim yapılana kadar kartlardadır. Karta dokununca ayrıntılar açılır.

**Yapılacaklar şeridi** özetin hemen altında tek satırdır: **Karar ver 3 · Rezerve et 1 · Planla 4 · ⏳ İptal süresi 2**.
Karar ver: seçenekleri olup seçilmemiş şeyler. Rezerve et: seçilen ya da sohbette planlanan ama rezerve edilmeyen
her şey (günü belli olmasa da). Planla: hiç seçeneği olmayanlar (boş geceler, uçuşu olmayan gidiş/dönüş, nasıl
geçileceği söylenmemiş şehir değişimi, boş transferler). ⏳: 14 gün içinde biten ücretsiz iptaller. Çipe dokununca
kısa liste açılır (iki hafta içindekiler işaretli); bir satıra dokununca pano oraya gider ve kart bir an parlar.
"Gerek yok" denen transfer ve geceler şeritte sayılmaz. Özetteki **bütçe çubuğu** rezerve, seçilen ve açık
kararların öndeki seçeneğiyle tahmini toplamı bütçeyle karşılaştırır ("€1.019 / €1.500 · €481 kalıyor").

**Ele ve gerek yok.** Her seçenek kartında **Ele** vardır: kart seçeneklerden çıkar, **Elenenler**de durur (silinmez,
**Geri al**). İstenmeyen bir transferde (açınca) **Gerek yok · gizle**, yer gerekmeyen boş gecelerde **Gerek yok**:
panodan ve yapılacaklardan kalkar; transferler **Gizlenenler**den, geceler yerindeki **Geri al**la döner. Sohbette
"transfere gerek yok" ya da "X'i ele" demek de aynısını yapar. Şehir değişimi gizlenmez.

**Transferler bilet gibi sade.** "Havalimanı → Otel" (alt satırda saat ve adlar: "Varış 10:05 · OPO havalimanı →
Jardim Stay"), sağda durumu ("Metro · planlandı"). Dikkat notları küçük bir ⓘ ile işaretlidir, satıra dokununca
açılır.

**Fiyat neye göre?** Karttaki "pahalı/ucuz", o ihtiyaç için kaydettiğin seçeneklerin ortalamasına göredir
("Ortalamadan €40 pahalı", en ucuzsa "En ucuz: ortalamadan €30 ucuz"); iki seçenekte doğrudan diğerine göre
("Diğerinden €45 ucuz"). Önerideki fark adıyla söylenir ("Ribeira Rooms karşısında").

**Seçili karta dokununca diğer seçenekler** açılır (Apple'daki gibi: dokun = değiştir); ayrıntılar kartın
köşesindeki **ⓘ** ile açılır.

**Sohbet panoyu hemen şekillendirir.** "Madeira'da araba kiralayacağım" denince Madeira bloğunda "Araç kiralama ·
gün belli değil" kartı hemen açılır; günü söyleyince ya da bir kiralama sayfası kaydedince o güne geçer.
Rezervasyon onayının ekran görüntüsünü atınca kayıt rezerve olur ve plan onun tarihlerine göre yeniden kurulur
(4+3 gece iki yer ya da plandan farklı 7 gece tek yer).

**Kartta önce istediklerin.** "Seni böyle anladım"daki her şey (mutfak, ücretsiz iptal, "sessiz bir yer istiyoruz",
önemli dediğin konum ya da fiyat) her kartın üstünde tek tek denetlenir: ✓ "Mutfak var", ✕ "İade yok",
✕ "Hafta sonu gece gürültüsü · 3 yorum", ? "Mutfak yazmıyor" (sayfa söylemiyorsa "yok" denmez). Bunlar puana
da girer: istenen olanak puanlanır (yazmıyorsa yarım, "yok" diyorsa sıfır); notunda istediğin şey ("sessiz bir yer
istiyoruz") kendi kriteri olur ("Sessizlik: Önemli") ve o konuda sayfanın ve misafirlerin söyledikleriyle ölçülür.
Altındaki artı/eksiler somut yazar: "Gezeceğin yerlere 6 dk", "Uzak · merkeze 25 dk", "Puan 8,9/10", "Erken
kalkış 05:40". Kartın üstündeki site adı (Booking.com ↗, Airbnb ↗) sayfayı yeni sekmede açar; pano yerinde kalır.
Tarihsiz kaydedilen bir bilet ya da sayfa için sohbette "o bilet 12 Ekim'di" demen yeter, kart kendi gününe geçer.

**Kiralık araç kendi fotoğrafı ve araba simgesiyle.** Sayfadan kaydedince sayfadaki görünen fotoğraflardan seçeneğin
kendi fotoğrafı seçilir; yalnız ekran görüntüsü atınca fotoğrafın yeri bulunup görüntüden kesilir.

**Okunan her şey ayıklanır.** Kartta bir şey ancak önemliyse görünür:
- **Yalnız bunda:** karşılaştırılan diğer yerlerin sayfalarında hiç geçmeyen artı ya da eksi en başta, "yalnız bunda"
  etiketiyle ("Odadan nehir manzarası", "Asansör yok, 3. kat").
- **Herkes için olmaz:** birkaç misafirin yazdığı ya da sayfanın kendisinin söylediği ciddi bir sorun (yan binada
  inşaat, haşere, güvenlik, ilandan farklı yer) yeri kendiliğinden eler; "sorun değil" dersen geri gelir.
- **Bilgi eksi değildir:** alışılmış giriş/çıkış saati (giriş 14–16, çıkış 10–12) ve "bilgisi yok" türü satırlar
  karara ve karta girmez.
- **Tek yorum manşet olmaz:** tek bir yorumda geçen küçük şikâyet ("giriş zor") detayda kalır; ciddi olan kalmaz.
- **Hepsinde olan** şey karşılaştırmaya bir şey katmaz, kartta tekrar edilmez (istediğin bir şeyse "İstediklerin"de ✓).
- İstediğin konudaki bulgu konusu ne olursa olsun sayılır ("inşaat gürültüsü" sessizlik isteğine ✕ yazar).
Seçilen ya da rezerve edilen kartta zamanı yaklaşan şey yazar: "Ücretsiz iptal için 6 gün kaldı",
"Bilet alınmadı · etkinliğe 10 gün · ücretsiz iptalli, şimdi ayırmak risksiz".

Arayüz kuralları (renklerin anlamı, butonlar, yazı ölçeği, okunurluk) [DESIGN.md](DESIGN.md)'de.

**Gezinin özeti** en üsttedir: resim, ad, tarihler ve "7 gün · 2 şehir · 5 etkinlik · 1 konaklama · 1 ulaşım"
(konaklama ve ulaşım: seçilen ya da rezerve edilenler).

**İki görünüm: Plan ve Günlük akış.** Plan, verdiğin kararların ve rezervasyonların tek bakışta durduğu yerdir:
solda ne olduğu ve ne zaman ("Varış · 8 Ekim", "Konaklama · 1–4. gün · 8–11 Ekim · 3 gece", "Etkinlik · 9 Ekim ·
2. gün"), sağda büyük kartı: uçuşlar, oteller, şehir değişimi, seçtiğin etkinlikler, kiralık araç ve planı olan
transferler. Check-in/check-out satırı, boş gün, planı olmayan transfer burada yer kaplamaz.

**Günlük akış** gün gün, saat saat okunur. Rezervasyon gerektiren her şey (uçuş, tren, taksi/transfer, etkinlik,
restoran, araç kiralama) kendi saatinde **küçük bir bloktur**, durumu yanında ("planlanmadı", "Rezerve edilmedi",
"✓ Bilet alındı"). Check-out, check-in, metroyla ya da yürüyerek gidiş, araç iadesi gibi bilgiler ince satırdır.
Bloğa dokununca Plan'daki kartı açılır; planı olmayan transfer orada açılır (nasıl gideceğin, "Gerek yok").
Saat kayıttan gelirse düz, alışılmış ya da hesaplanmışsa "~" ile yazar. İşi kalan gün açık gelir ("3 iş"), hepsi
hazır olan tek satıra katlanır; şehir değiştirdiğin gün "4. gün · Porto → Lizbon" diye okunur.

Gezi başladıysa özet "Seyahat başladı · 4. gün" der, bugünün kartında **Bugün** yazar.

**Şehir şehir.** Plan'da her şehir bir bloktur: önce konaklamalar tarih sırasıyla (yeri seçilmemiş geceler
"Planlanmadı" kartı), sonra o şehirde seçtiğin etkinlikler ve kiralık araç, günleriyle. Günlük akışta aynı şehir
başlığı konaklamasıyla durur, altında günleri (boş gün de görünür). Aktarmalı gidiş (İstanbul → Kopenhag → Porto) varıştan
önce gelir. Yeri seçilmemiş gecelerin şehri, oraya giden ya da oradan kalkan uçuştan veya o günlerdeki kiralık
araçtan anlaşılır.

**Konaklama gece gece planlanır.** Gezinin geceleri (onaylı tarihler, yoksa uçuşlar ve konaklamalar)
sırayla gösterilir: **✓ Rezerve**, **Seçildi**, **Açık** (bu gecelere uyan seçeneklerle) ya da **Boş**
(Booking'de o tarihlerle arama linkiyle). Bir yeri rezerve edince aynı geceleri isteyen diğer seçenekler
**Kapanan seçenekler**e geçer; silinmez, rezervasyonu geri alırsan geri gelir.
**Aynı yerde, geceleri örtüşen her konaklama tek listede karşılaştırılır**, hangi siteden geldiği önemsiz:
Booking'deki 8–12 Ekim oteli ile Airbnb'deki 9–12 Ekim evi aynı karardır. Fiyatlar gece başına kıyaslanır;
gecelerin bir kısmını kapsayan seçenekte "Yalnız 3/4 gece: kalan 1 gece için ayrıca yer gerekir" yazar. Şehrin
hangi dilde yazıldığı da önemsiz (Lisbon = Lisboa = Lizbon), haritada birbirine çok yakın yerler (Porto ile
nehrin karşısındaki Gaia) aynı yer sayılır. Her konuda başka bir seçenek her açıdan (fiyat dahil) daha iyiyse
"Elenebilir" yazar.

**Geceleri bölmek sohbetle.** "7 Ekim gecesi başka bir otel koy" dersen o gece kendi, boş konaklama bloğu olur
("ayrı konaklama · otel seçilmedi"; o gece için kaydettiğin yerler orada seçenek olarak durur). Önceden seçtiğin yer
kalan gecelerde kalır; asistan senin yerine otel seçmez. Bir yeri o gece için seçince blok dolar; "Ayrı olmasın"
geceleri birleştirir. İki seçim aynı geceyi isterse son seçilen alır. Söylediğin fiyat ("biletim 312 dolardı")
kartta "sen söyledin" diye yazar.

**Transferler kendiliğinden açılır.** Geceler arasına, planın gerektirdiği her yol parçası boş olarak
eklenir; hiçbirini eklemen gerekmez:
- **Varış:** havalimanı/gar → ilk konaklama (uçuş varsa iniş saatiyle).
- **Şehir değişimi:** bir yerden çıkış ile başka şehirde giriş aynı günse. Uçak, tren, otobüs ya da feribotla
  gidiliyorsa iki uçtaki havalimanı/gar transferleri de açılır (arabayla gidiliyorsa açılmaz).
- **Otel değişimi:** aynı şehirde bir yerden diğerine geçerken.
- **Gidiş:** son konaklama → havalimanı (uçuşun kalkış saatinden, havalimanında en geç ne zaman olman gerektiği).

Her transferin yanında durumu yazar: **Boş**, **Metro · planlandı**, **Tren · rezerve edilmedi**, **1 seçenek**,
**Seçildi**, **Rezerve ✓**. Satıra tıklayıp nasıl gideceğini seçebilir ya da sohbete "havalimanından metroyla
gideceğim", "Lizbon'a trenle geçeriz", "transferi ayarladım" yazabilirsin; asistan ilgili transferi işaretler.
Kaydettiğin bir tren bileti ya da havalimanı transferi sayfası, o günün transferine seçenek olarak kendiliğinden
bağlanır; rezerve edince transfer de kapanır.

Gözden kaçan ince detaylar transferin altında not olarak çıkar (konaklamanın sayfasında yazan giriş/çıkış
saatleri okunur, yazmıyorsa genel saatler kullanılır ve bu belirtilir):
- Girişten saatler önce varış → bavulları erken bırakmayı ya da erken girişi sor.
- En geç giriş saatinden sonra varış → geç girişi önceden ayarla (kendi kendine giriş varsa sorun yok).
- Gece yarısından sonra iniş, ama ilk gece o gün → o saatten girişe kadar yerin yok.
- İniş ilk geceden bir gün sonra → bir gece boşa ödeniyor; dönüş uçuşu çıkıştan bir gün sonra → bir gece yersiz.
- Metro çalışmadan kalkan uçuş → taksi/transferi önceden ayarla.
- Çıkışla uçuş arasında saatler var → bavul emaneti (sayfada varsa söylenir) ya da geç çıkış.
- Aynı şehirde otel değişimi → çıkış ve giriş saatleri arasında bavullar.
- Otelin havalimanı servisi sayfada yazıyorsa hatırlatılır.

**Geziler kendiliğinden ayrılır.** Her kaydın ülkesi (PT, TH gibi kodla) ve tarihleri belirlenir:
aynı ülke + yakın tarihler (en fazla ~1 hafta ara) aynı geziye, başka ülke ya da uzak tarih yeni geziye gider.
AI yanlış gezi önerse bile karar bu kurala göre verilir. Açık olan gezi dışında bir yere kayıt düşerse
altta "→ Tayland · Aç" bildirimi çıkar. Örnek gezi kayıt almaz.
- Aynı ülkeye iki ayrı gezi varsa tarihe en yakın olanı seçilir.
- Tarihleri bitişik yeni bir ülke (ör. Portekiz'den sonra İspanya) aynı geziye eklenir.
- Ülkesi belli olmayan kayıtlar (ör. bölgesel eSIM) AI'ın önerdiği ya da en son gezine gider.
- Yanlış yere düşen bir kaydı detay ekranındaki **Gezi** seçiminden taşıyabilirsin. Geziler arasında
  soldaki **Seyahatlerim** menüsünden geçilir.

İpuçları:
- **Fiyat için tarih seç.** Booking/Airbnb tarih seçilmeden fiyat göstermez.
- **Oda seçimi:** Birçok oda varsa istediğin odanın hizasına kaydırıp tıkla; AI ekranda gördüğünü öne alır.
- **Yorumlar:** "Tüm yorumlar" penceresini açıp tıklarsan o yorumlar da okunur.
- **Fiyat güncelleme:** Aynı sayfayı tekrar kaydedince kart güncellenir, fiyat geçmişi tutulur.

## Paylaşım (Sabine ile)

Bir geziyi birlikte gezdiğin kişiyle paylaşırsın: ikiniz de kendi Chrome'unuzdan sayfa kaydedersiniz, kayıtlar
aynı geziye düşer ve her seçeneğe 👍 / 👎 verirsiniz. Gezinin adı, tarihleri, bütçesi ve öncelikleri ikinizde
aynıdır; sohbet herkesin kendine kalır. Paylaşım kurulmadıkça hiçbir şey değişmez, hiçbir şey dışarı gitmez.

**Bir kez: sunucu (Emre, ~5 dakika, ücretsiz)**

1. [supabase.com](https://supabase.com) → hesap aç → **New project** (ad: `trip-radar-paylasim`, bölge: Frankfurt,
   veritabanı şifresini bir yere kaydet). Ücretsiz plan yeter.
2. Proje hazır olunca soldan **SQL Editor** → **New query** → bu repodaki `supabase/schema.sql` dosyasının
   tamamını yapıştır → **Run**. "Success. No rows returned" görmelisin (tekrar çalıştırmak zararsızdır).
3. **Project Settings → API Keys** (ya da üstteki **Connect**): **Project URL** (`https://xxxx.supabase.co`) ve
   **publishable key** (`sb_publishable_…`; eski projelerde **anon** `eyJ…`) kopyala.
   `secret` / `service_role` anahtarını asla yapıştırma.
4. Trip Radar → **•••** → **Ayarlar** → **Paylaşım**: **Adın** (Emre), **Supabase adresi**, **Supabase anahtarı**.
   **Bağlantıyı dene** → "✓ Sunucu hazır."

**Paylaş (Emre)**

5. Geziyi aç → **•••** → **Bu geziyi paylaş** → **Paylaş** → **Kodu kopyala** → Sabine'e mesajla gönder
   (`TR1:…` ile başlayan tek satır; sunucu adresi ve anahtar da içinde). Gezinin mevcut kayıtları sunucuya gider.

**Katıl (Sabine)**

6. Trip Radar'ı kurar (yukarıdaki Mac kurulumu, `install.sh`) ve kendi ücretsiz Gemini anahtarını bağlar.
7. **Seyahatlerim** → **Paylaşılan geziye katıl** → kodu yapıştır, adını yaz (Sabine) → **Katıl**. Gezi açılır;
   Emre'nin kayıtları bir dakika içinde gelir ve Sabine'in kendi AI anahtarıyla işlenir.

**Nasıl çalışır**

- Dakikada bir, bir şey kaydedilince ve pano açılınca eşitlenir. Gezinin üstünde:
  "Paylaşılıyor · Sabine ile · son eşitleme 1 dk önce" (sorun varsa kırmızı, Türkçe sebebiyle).
- Paylaşılan geziye düşen her kayıt sunucuya gider; karşı tarafta ülkesi ya da tarihi farklı olsa da **aynı
  geziye** düşer. Her taraf kendi AI anahtarıyla işler; bir kayıt iki kez işlenmez, geri gönderilmez.
  Gönderilen: link, sayfanın yazısı, düzenli veri ve küçültülmüş ekran görüntüsü (≤150 KB).
- **Oy:** kartta 👍 / 👎; aynı düğmeye tekrar basınca geri alınır. Oylar sıralamayı ve puanı değiştirmez; oy veren
  herkes 👎 dediyse kart soluklaşır (iki kişiyseniz "İkiniz de istemiyorsunuz", daha kalabalıksanız "Hiçbiriniz
  istemiyor"), biri fikrini değiştirince geri gelir. Aynı kodla ikiden fazla kişi de katılabilir; gezinin üstünde
  hepsinin adı yazar ("Sabine ve Ali ile"). Oy,
  seçeneğin sitesindeki ilana verilir (aynı otelin farklı tarihli kayıtları oyu paylaşır).
- Gezi ayarlarında (ad, tarihler, bütçe, öncelikler, şartlar) son değiştiren kazanır. Seç / Ele / Rezerve ettim ve
  sohbet herkesin kendi panosunda kalır.
- İnternet yoksa bekler, gelince gönderir.
- **Güvenlik:** kodu bilen geziyi görür ve ekleme yapabilir; kodu yalnız birlikte gezdiğin kişiye ver.
  Sunucudaki tablolara doğrudan erişim yoktur, yalnız gezi kimliğini isteyen fonksiyonlar çağrılır; gezilerin
  listesi alınamaz. API anahtarların ve sohbetin sunucuya gitmez.
- **Durdurmak:** **•••** → **Paylaşım kodu** → **Paylaşımı durdur** (bu bilgisayarda; gezi olduğu gibi kalır).
- Supabase ücretsiz projeleri bir hafta hiç kullanılmazsa uyur: supabase.com'da projeyi açıp **Restore** de.

## Karar zekası: puan nasıl çıkıyor?

Aynı ihtiyaç için kaydettiğin seçenekler (ör. Porto'da 3 gece) 0–100 arası puanlanır. Puanı **kod** hesaplar,
aynı bilgiyle hep aynı sonucu verir ve her sayısı açıklanabilir:

1. **Ölçüm:** Her seçenek için kriterler sayfadan okunur. Konaklamada fiyat (toplam, gerekirse kurla €'ya
   çevrilir), konum, puan/yorum, konfor/temizlik alt puanları, iptal esnekliği ve istediğin olanaklar
   ölçülür. Uçuşta fiyat, süre, aktarma, saatler ve bagaj; eSIM'de fiyat, veri ve geçerlilik süresi.
2. **Konum:** Otelden, gezide kaydettiğin yerlere (müze, restoran…) tipik yürüme süresi hesaplanır.
   Yer kaydetmediysen şehir merkezine uzaklık kullanılır. Adresler OpenStreetMap ile ücretsiz konuma çevrilir.
3. **Adil puan:** Az yorumlu yüksek puan temkinli sayılır (96 yorumla 4,9 ≠ 1.200 yorumla 8,9). Airbnb'nin
   5'lik puanları Booking ölçeğine göre ayarlanır (4,8 ≈ 8,5); puan, kart ve istek kontrolü aynı ölçeği kullanır
   ("Puan 4,3/5 (≈7,3/10)"). Fiyatı toplam mı gecelik mi belli olmayan konaklama, netleşene kadar fiyatta
   kıyaslanmaz ve bütçeye girmez.
4. **Ağırlık:** Her kriterin önemi senin elinde (Önemsiz → Çok önemli). Karşılaştır ekranından ya da
   sohbette ("merkezi olsun", "fiyat o kadar önemli değil") değiştirirsin, puanlar anında yeniden hesaplanır.
5. **Sayfanın tamamı okunur (Okuyucu, 0.9):** Kaydettiğin her sayfa (hangi site olursa olsun) kayıttan
   sonra arka planda baştan sona ikinci kez okunur: açıklama, oda/ev detayları, olanaklar (olmayanlar dahil),
   kurallar, ücretler, çevre ve görünen bütün yorumlar. Çıkan her bulgu ("Geniş yatak", "Yanında iyi bir
   İtalyan restoranı", "Yan binada inşaat") bir artı ya da eksidir ve arkasındaki yorumlar/metinle saklanır.
   - Alıntı sayfada yoksa atılır; atılan sayısı detayda yazılır.
   - "7 yorum" sayısını AI değil kod, saklanan yorumlardan sayar. Bu, erişilen yorumların sayısıdır;
     sitedeki bütün misafirlerin değil ("48 yorum incelendi (sitede 1.204)").
   - Yalnız bir yıldan eski yorumların söylediği şey "eski" diye işaretlenir ve hiçbir kararı belirlemez.
   - Okuma başarısız olursa kayıt kaybolmaz; birkaç kez kendiliğinden yeniden denenir.
   - Bulgular "Yorum ve detaylar" kriteriyle puana girer.
6. **Kartlar ve artı/eksiler:** Kapalı kartta puan, rozetler ("Fiyat/performans", "En iyi konum", "En iyi
   yorumlar", "En ucuz") ve en önemli bir artı ile bir eksi görünür; elenmişse sebebi. Karta tıklayınca
   içinde solda bütün artılar, sağda bütün eksiler açılır; her bulgunun "Kanıt"ı (yorum alıntısı ve tarihi)
   ve eksilerde "Sorun değil" vardır. "Sorun değil" dersen o bulgu bu yer için artık aleyhine sayılmaz ve
   asistan bunu öğrenir.
   - **Ciddi sorun:** Sayfanın kendisi ya da en az iki misafir söylüyorsa (ör. yan binada inşaat) yer elenir.
     Tek bir misafirin söylediği ciddi şey puan götürmez; "Seçmeden kontrol et: 1 misafir bildirmiş: …" olur.
7. **AI değerlendirmesi ve eleme:** AI bulguları, sayıları ve tercihlerini okuyup kararı yazar. Bir
   bulgu senin için bir seçeneği anlamsız kılıyorsa (sessizlik istiyorsun + yan binada inşaat) eler.
   - Eleme hangi bulguya dayandığını söylemek zorunda. Kod, bulgunun sayfada doğrulandığını ve eski
     olmadığını kontrol eder; tutmayan eleme "Kontrol gerekiyor" olarak kalır, karar vermez.
   - Eleme, dayandığı bulgular durdukça geçerlidir; yeni bir seçenek eklenince kaybolmaz.
   - AI'ya ulaşılamazsa son iyi yorumu tarihiyle görünür kalır.
8. **Sıralama ve neden:** Seçenekler önce durumuna (uygun → kontrol et → kısmi → uygun değil), sonra puana göre
   sıralanır. Her kart 1.'ye göre (1. kart 2.'ye göre) farkını, kazancını ve eksiğini yazar; uygun olanlar içinde
   bir önemli şeyde açıkça en güçlü olan etiketlenir ("En ekonomik", "En sessiz"). Aynı fiyatlılara "en ekonomik"
   denmez.
9. **Eksik bilgi durdurmaz:** Fiyatı henüz belli olmayan seçenek "Seçmeden kontrol et" olur ve kararı
   değiştirebileceği için cümlenin altında yazar. Farklı tarih için alınmış fiyat karşılaştırmaya girmez.
10. **Kısmi konaklama:** Gecelerin yalnız bir kısmını kapsayan yer tamamını kapsayanlarla yarışmaz; "yalnız 2/5
   gece; kalan 3 gece için ayrı yer gerekir" diye ayrı durur.
11. **Seni böyle anladım:** Söylediklerin (önem, kesin şart, not) ve sezilenler burada kaynağıyla durur.
   Sezilenler iki kaynaktan gelir:
   - Kaydettiklerindeki kalıp: "5 konaklamadan 4'ü ücretsiz iptalli".
   - Motorun önerisinden farklı seçimlerin: "Seçimin Casa Azul, Jardim yerine: €45 daha ucuz".

   Sezgi kendiliğinden hiçbir şeyi değiştirmez: önce sorulur ("İptal esnekliği senin için daha mı önemli?"
   Evet / Hayır). "Evet" dersen varsayılanı bir kademe kaydırır; senin söylediğini asla ezmez.
12. **Ne kadar kesin söylediğin:** "şart", "kesinlikle", "... olmasın" kesin şarttır ("Mutfak şart", "iadesiz
   olmasın", "direkt uçuş", "merkeze en fazla 15 dk", "kesinlikle gürültü olmasın"): uymayan "Uygun değil".
   Sayfa bir olanağın olmadığını açıkça söylüyorsa "yok", hiç söylemiyorsa "yazmıyor" (kontrol et) denir.
   "istiyoruz/önemli" bir önceliktir, "olsa iyi olur" hafif bir öncelik.
13. **Bütçe: hedef ve tavan:** "50 bin civarı" hedeftir; "en fazla 60 bin, kesinlikle aşmam" tavandır. Tavanı
   aşacak seçenek "Uygun değil: bütçe tavanını ₺X aşar" olur; tavanı asistan kendiliğinden değiştirmez.

Konaklamanın başında gece gece bir şerit durur (gün, hafta günü, şehir; rezerve / seçildi / açık / boş
renkleriyle). Her gece aralığı kendi bloğunda, tarih başlığıyla gösterilir.

Son karar senin: "Plana al" ile seçersin; sistem yalnız nedenleriyle gösterir.

## Doğruluk kuralları

- AI fiyat, puan ve iptal koşulu için sayfadan **birebir alıntı** vermek zorunda. Alıntı sayfada yoksa
  bilgi "doğrulanmadı" diye işaretlenir.
- Bilinmeyen bilgi tahmin edilmez, boş kalır. Detayda "Eksik bilgi" olarak görünür.
- Farklı tarih ya da kişi sayısı için alınmış fiyatlar karşılaştırılmaz; satırda "Farklı tarih" uyarısı çıkar.
- Fiyatın ne zaman görüldüğü tutulur; eskiyen fiyat için uyarı çıkar (konaklamada 3 gün, uçuşta 1 gün).
- Sayfanın hangi siteden geldiği (Booking, Airbnb, otelin kendi sitesi...) karşılaştırmada önemsizdir: aynı
  geceler için kaydedilen her konaklama aynı karşılaştırmadadır. Tarihsiz kaydedilen bir konaklama (ör. Airbnb'de
  tarih seçmeden), şehrinde tek bir açık gece aralığı varsa o gecelerle geçici olarak karşılaştırılır; kartındaki
  "Tarihlerle aç ↗" sayfayı o gecelerle açar, tekrar kaydedince gerçek fiyat aynı kayda işlenir.
- Aynı yer farklı tarih ya da oda için kaydedilirse ayrı teklif olur; biri diğerinin üstüne yazılmaz. Tarihsiz
  bir kayıt yalnız yer bilgisini (yorumlar, açıklama) tazeler, seçili gecelerin fiyatına dokunmaz.
- Sohbette bir detay sorarsan ("TV var mı?") asistan kayıtlı sayfanın tamamında arar; bulamazsa tahmin
  etmez, "sayfada göremedim" der.
- Ayarlar → "Tanı dosyası indir": kaydettiğin sayfalar ve okunanlar (anahtarlar ve sohbet hariç). Bir şey
  yanlış okunduysa bu dosyayla gerçek sayfa üzerinden düzeltilebilir.

## Sağlayıcı ve maliyet

| | Gemini (varsayılan) | Claude |
|---|---|---|
| Ücret | Ücretsiz katman (günlük istek sınırı var) | Kullandıkça ödeme; kayıt başına birkaç sent |
| Gizlilik | Ücretsiz katmanda Google içeriği ürün geliştirmede kullanabilir, insanlar okuyabilir | İçerik model eğitiminde kullanılmaz |
| Sınır dolunca | Kayıt "Tekrar dene" ile sonra işlenir | — |

Her kayıt 1 istek, her sohbet mesajı 1–3 istektir; karşılaştırılan her grup için bilgiler değiştiğinde
1 analiz isteği daha yapılır. Sağlayıcı değiştirince sohbet yeni bağlamla başlar;
kararlar ve kayıtlar olduğu gibi kalır.

## Geliştirme

```bash
npm run typecheck      # TypeScript
npm test               # birim + akış testleri (sahte API ile)
SCENARIOS=20000 npx vitest run tests/scenarios.test.ts   # rastgele gezilerle stres testi (varsayılan 3000)
npm run build && xvfb-run -a node scripts/e2e.mjs   # eklentiyi Chromium'da yükleyip test eder, ekran görüntüleri e2e-output/
# Proxy arkasında gerçek API kontrolü: E2E_EXPECT_LIVE=1 E2E_CHROMIUM_ARGS="--ignore-certificate-errors-spki-list=<proxy CA SPKI>"
```

Yapı:
- `src/lib/url.ts`: linkten sağlayıcı, ilan kimliği, tarih ve kişi sayısı.
- `src/lib/pagecapture.ts`: tıklanınca sayfada çalışır; yazı, görünen kısım, JSON-LD ve meta verisini toplar.
- `src/lib/extract.ts`: çıkarım şeması ve talimatları (alıntı zorunlu).
- `src/lib/llm/`: sağlayıcılar (Gemini, Claude) ortak arayüzle.
- `src/lib/evidence.ts`: alıntı doğrulama.
- `src/lib/items.ts`: kart oluşturma, veri temizleme, tekrar birleştirme, gruplama, etiketler, rota.
- `src/lib/trips.ts`: kaydın hangi geziye gideceği (ülke kodu + tarih; AI önerisi yalnız ipucu).
- `src/lib/process.ts`: kayıt kuyruğu (arka planda çalışır).
- `src/lib/assistant.ts`: sohbet ve plan güncelleyen araçlar.
- `src/app/`: pano arayüzü. `src/popup.tsx`: eklenti açılır penceresi.

Plan ve sonraki adımlar: [PLAN.md](PLAN.md)
