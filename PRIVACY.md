# Trip Radar — Gizlilik politikası / Privacy policy

Son güncelleme / Last updated: 2026-10-09 · Sürüm / Version: 0.36.58

---

## Türkçe

### 1. Kısaca

Trip Radar, gezerken kaydettiğin sayfaları (otel, uçuş, etkinlik, restoran) toplayıp karşılaştıran ve gün gün plana
koyan bir Chrome eklentisidir.

- Hesap açılmaz. Reklam yoktur. Analiz ya da izleme aracı yoktur. Eklenti çerez koymaz. Verilerin satılmaz.
- Verilerin büyük kısmı yalnız senin tarayıcında durur; bize gelmez.
- Bilgisayarından dışarı çıkan veriler şunlardır: yapay zekâya gönderdiklerin, paylaşmayı seçtiğin geziler ve
  harita, kur ve şehir fotoğrafı için gönderilen kısa sorgular. Aşağıda her biri tek tek anlatılıyor.

### 2. Biz kimiz (veri sorumlusu)

Trip Radar'ı Emre Durmuş geliştirir ve yayınlar.

- Veri sorumlusu: Emre Durmuş (bireysel geliştirici)
- E-posta: info@emredurmus.net (gizlilikle ilgili tüm talepler için; posta adresi talep edilirse e-postayla bildirilir)
- Trip Radar ücretsizdir, hiçbir şey satmaz ve kişisel veriyi yalnız aşağıda anlatılan işler için, küçük ölçekte işler.

Bu politika yalnız Trip Radar eklentisi ve onun sunucu tarafı için geçerlidir. Kaydettiğin web sitelerinin, Google'ın,
Anthropic'in ve aşağıda adı geçen diğer hizmetlerin kendi gizlilik politikaları vardır.

### 3. Bilgisayarında kalan veriler

Şunlar yalnız bu tarayıcının yerel deposunda (IndexedDB ve `chrome.storage`) tutulur:

- gezilerin ve ayarları,
- kaydettiğin sayfalardan okunan bilgiler: ad, fiyat, tarihler, adres, puan ve küçük bir ekran görüntüsü,
- notların ve yapay zekâ ile sohbet geçmişin,
- eklediğin belgeler (bilet PDF'leri, görseller),
- tercihlerin, profil adın ve (eklediysen) profil fotoğrafın,
- "Kimler gidiyor?"a yazdığın kişilere eklediğin fotoğraflar (yalnız bu bilgisayarda; kimseye, o kişiye de
  gönderilmez),
- yeni gezi başlatırken yarım bıraktığın taslaklar ve sohbet sürerken onlar için hazırlananlar (yerin fotoğraf
  adresleri, rota önerisi, kural önerilerinin başlıkları; en fazla 8 taslak; dışa aktarıma ve paylaşıma girmez),
- kendi yapay zekâ anahtarını girdiysen o anahtar.

Bu verileri biz görmeyiz, bize gönderilmez. Bunlar üzerindeki denetim tamamen sende: görebilir, düzeltebilir,
silebilirsin.

**Silme:** Sildiğin kayıtlar, belgeler ve geziler 30 gün yalnız bu bilgisayardaki "Çöp kutusu"nda durur, sonra
kendiliğinden silinir. "Kalıcı sil" ya da "Çöp kutusunu boşalt" ile hemen silinir. Eklentiyi kaldırınca bu
tarayıcıdaki tüm Trip Radar verisi silinir.

**Dikkat:** Bu veriler tarayıcının kendi korumasıyla saklanır. Bilgisayarına ya da tarayıcı profiline erişebilen biri
onları da görebilir.

### 4. Sayfa okuma

Eklenti yalnız "Kaydet"e bastığın sekmeyi, yalnız o anda okur. Arka planda sayfa okumaz. Tarama geçmişin,
şifrelerin ve ödeme bilgilerin okunmaz.

Kaydettiğin sayfanın metninde ya da ekran görüntüsünde görünen her şey (örneğin bir rezervasyon sayfasındaki adın)
okunur ve yapay zekâya gönderilir. Kişisel bilgi gösteren bir sayfayı kaydetmek istemiyorsan "Kaydet"e basma.

### 5. Yapay zekâ işlemesi

Ne gönderilir:

- kaydettiğin sayfanın metni ve küçük ekran görüntüsü,
- sohbet mesajların (ve yanıt için gereken gezi bilgileri); yeni bir geziyi sohbetle başlatırken yazdıkların, hızlı
  cevaplarda seçtiğin cevap ve o ana kadar bilinenler (cevabı yazmak için), rota önerisi isteği de buna dahil,
- okutmak istediğin belgeler,
- arka planda, sen ayrıca istemeden: gezinin özeti (şehirler, tarihler, kaç kişi gittiği, kaydettiğin seçenekler
  ve türleri, notların). Seçenekleri karşılaştırma yorumu, gezinin tarz etiketleri ve öneriler bundan çıkar; öneri gözden
  geçirmesi gezi başına günde en fazla bir kez ve yalnız gezide büyük bir değişiklik olduğunda yapılır. Öneriler
  yalnız bu bilgisayarda tutulur, paylaşılmaz.

Kime gönderilir:

- **Google Gemini API** (varsayılan), ya da
- **Anthropic Claude API** (bunu seçip kendi anahtarını eklediysen).

Nasıl gider:

- **Kendi anahtarınla:** tarayıcından doğrudan Google'a ya da Anthropic'e. Arada bizim sunucumuz yoktur. Bu durumda
  Google ya da Anthropic ile ilişkin, kendi hesabının koşullarına tabidir.
- **Biri seni davet ettiyse:** davet edenin Trip Radar sunucusu (Supabase'deki "AI kapısı") üzerinden, davet edenin
  anahtarıyla Google'a. Kapı içerikleri saklamaz. Yalnız davet bileti başına, gün gün, istek sayısını, token sayısını
  ve tahmini maliyeti tutar.

**Açıkça bilmen gereken:** Gemini'nin ücretsiz katmanında Google, gönderilen içeriği ürünlerini geliştirmek için
kullanabilir ve bu içerik insanlar tarafından incelenebilir. Bu yüzden ücretsiz katmanda gizli kalmasını istediğin
bilgileri (ör. pasaport ya da kimlik numarası içeren bir belge) yapay zekâya okutma. Ücretli katmanda ve Anthropic'te
sağlayıcının kendi koşulları geçerlidir.

Biz senin içeriğinle kendi yapay zekâ modelimizi eğitmeyiz; böyle bir modelimiz yoktur.

Yapay zekâ yanıtları yanlış olabilir. Fiyat, tarih ve kuralları her zaman asıl siteden kontrol et. Trip Radar senin
hakkında hukuki ya da benzeri önemli sonuç doğuran otomatik bir karar vermez; yalnız öneri sunar.

### 6. AI kapısı (davet eden taraf)

Arkadaşlarını davet etmek için kendi Gemini anahtarını kullanırsan:

- anahtarın sunucuda (Supabase) saklanır ve yalnız sunucu tarafındaki yetkili servis rolü onu okuyabilir; tarayıcıya
  ya da davet ettiğin kişilere gösterilmez,
- her davet rastgele bir bilet taşır; bileti istediğin an kapatabilirsin,
- bilet başına günlük istek sayısı, token sayısı ve tahmini maliyet tutulur, böylece kullanımı görebilirsin.

Anahtarının sunucudan silinmesini istersen info@emredurmus.net adresine yaz; sileriz ve davetlerin AI'sı durur.

### 7. Paylaşım (isteğe bağlı)

Bir geziyi paylaşırsan paylaşım sunucusuna (Supabase) şunlar gider:

- gezinin ayarları (gezide kimlerin olduğunu söylediğin adlar, "Gidenler", ve farklı yerden gelenlerin kalkış şehri dahil),
- kaydettiğin sayfalar (küçük ekran görüntüsü dahil),
- oylar ve tepkiler,
- üyelerin adları ve (eklediyseler) küçük profil fotoğrafları (128 piksel JPEG).

Gezinin gizli kodunu ya da bağlantısını bilen herkes bu verilere erişebilir. Bağlantıyı yalnız güvendiğin kişilerle
paylaş.

Yanlış bir değişiklik geri alınabilsin diye, paylaşılan gezinin ortak ayarlarının (ad, tarihler, bütçe, öncelikler,
olanaklar, şartlar, gidenlerin adları) son 200 eski hâli, kimin ve ne zaman değiştirdiği bilgisiyle sunucuda tutulur.

"Paylaşımı durdur" yalnız o bilgisayardaki eşitlemeyi durdurur. Sunucudaki paylaşılan gezi (kayıtları, oyları,
profilleri ve geçmişiyle birlikte) senin isteğinle silinir: info@emredurmus.net adresine yazman yeterli.

### 8. Diğer hizmetler

- **OpenStreetMap Nominatim:** bir adresi ya da haritanın tanımadığı bir şehir, kasaba veya havalimanını yerleştirmek
  için yalnız o ad gönderilir; sonuç cihazında saklanır, aynı ad bir daha sorulmaz.
- **OpenFreeMap (tiles.openfreemap.org):** Harita açıldığında yalnız ekranda görünen bölgenin harita parçaları, yazı
  tipleri ve simgeler istenir; gezinin adı, tarihleri, kişiler ya da rezervasyonlar gönderilmez. Her web isteği gibi
  IP adresin ve tarayıcı bilgin görünür.
- **Web araması (Google, sunucumuz üzerinden):** Sohbet canlı bir bilgiyi (ör. etkinlik tarihleri, açılış saatleri) aradığında ya da sen "şunu araştır" dediğinde yalnız arama sorusu gider; bir yer ya da etkinlik adı içerebilir (soru bir yer söylemiyorsa gezinin yer adı eklenir, ör. "karavan kiralama Dahab"). Seninle ya da gezinin geri kalanıyla ilgili hiçbir şey gönderilmez. Sonuç sunucuda soruyla birlikte birkaç gün saklanır (aynı soru tekrar aranmaz); günlük sınır için cihazının rastgele kimliği ve adresinin yalnız tek yönlü özeti (hash) tutulur.
- **Frankfurter:** döviz kuru için yalnız para birimi çifti gönderilir.
- **Wikipedia / Unsplash / Pexels:** gezi fotoğrafı için yalnız yerin ya da etkinliğin adı gönderilir; Wikipedia'ya
  doğrudan, Unsplash ve Pexels'a paylaşım sunucusu üzerinden. Fotoğrafın altında çekenin adı ve kaynağı yazılır.
- **AeroDataBox (RapidAPI üzerinden):** yalnız bileti alınmış (rezerve) uçuşlar için, o uçuşun tarifesi, durumu,
  kapısı, terminali ve bagaj bandı için yalnız uçuş numarası ve günü gönderilir ("KL1577, 7 Ekim"), bizim
  sunucumuz üzerinden. Sunucu bu herkese açık uçuş bilgisini, aynı uçuşu soran herkes için tekrar sormamak adına uçuş
  numarası ve güne göre saklar; kimin sorduğunu saklamaz. Cevap bu bilgisayarda da saklanır.
- **Kiwi.com ve Aviasales görsel sunucuları:** uçuş kartında havayolu logosu için yalnız havayolunun iki harfli kodu
  ("KL") istenir (Kiwi açılmazsa Aviasales'ten).
- **Öneriler (Travelpayouts / Aviasales, Tripadvisor, Xotelo, Viator, Airalo, Omio):** boş bir uçuş ya da konaklama kartının altındaki
  "Senin için N öneri" satırı için, bizim sunucumuz üzerinden yalnız aramanın gerektirdiği gönderilir: uçuşta iki
  havalimanı kodu, gün ve kişi sayısı ("IST, DPS, 10 Kasım, 2 kişi"); konaklamada şehir ve ülke adı, giriş ve çıkış
  günü ve kişi sayısı; etkinlikte şehir, günler, kişi sayısı ve kartın adı ("Tekne turu"); eSIM'de ülke kodu ve gezinin günleri; şehirler
  arası ulaşımda iki şehrin adı ve kişi sayısı ("Lizbon, Porto, 2 kişi"). Sunucu uçuş fiyatlarını Aviasales'in önbellekteki fiyatlarından (Travelpayouts), şehrin
  kimliğini Tripadvisor'dan (RapidAPI üzerinden), otelleri ve platform fiyatlarını Xotelo'dan alır; bunlarda sonuç
  yoksa ya da sohbette canlı fiyat istendiğinde aynı arama bilgisini Google Flights / Google Hotels sonuçları için
  SerpApi'ye gönderir; etkinlikleri Viator'dan (Viator Partner API) alır; eSIM paketlerini Airalo'nun, şehirler
  arası tren, otobüs, uçak ve feribot başlangıç fiyatlarını Omio'nun herkese açık ürün listesinden okur (bu ikisine
  senin araman gönderilmez, liste bütün olarak indirilir); herkese açık bu
  bilgiyi, aynı soruyu soran herkes için tekrar sormamak adına sorulan yere ve güne göre saklar, kimin sorduğunu
  saklamaz. Cevap bu bilgisayarda da birkaç saat saklanır.
- **Travelpayouts ortaklık bağlantıları:** panodan açtığın, Trip Radar'ın ortağı olduğu bir markanın sayfası
  (öneriler, arama düğmeleri, kaydettiğin bir sayfa; Booking, Agoda, Trip.com, GetYourGuide, Viator, Aviasales, Airalo, Omio gibi)
  tıkladığın anda Travelpayouts ortaklık bağlantısından (tp.media) geçer ve aynı sayfaya varır; Travelpayouts o
  sayfanın adresini görür. Orada rezervasyon yaparsan Trip Radar komisyon alabilir; sana ek bir ücret çıkmaz.
  Kendi rezervasyonunu ya da hesabını taşıyabilecek sayfalar (rezervasyon yönetimi, onay, hesap, giriş; içinde
  rezervasyon numarası ya da anahtar olan adresler) hiçbir zaman çevrilmez. Eklenti ziyaret ettiğin sitelerdeki
  bağlantıları değiştirmez. Tıkladığında Travelpayouts ve o site kendi çerezlerini koyar.

Bu hizmetlere ad, e-posta ya da gezi içeriği gönderilmez. Her bağlantıda olduğu gibi, istek yapılan sunucu
IP adresini görebilir.

### 9. Neden işliyoruz (hukuki dayanak)

- **Senin istediğin hizmeti sunmak** (sayfa okuma, yapay zekâ, harita, kur, paylaşım): GDPR md. 6(1)(b);
  KVKK md. 5(2)(c) (sözleşmenin ifası).
- **AI kapısında kullanım sayımı** (kötüye kullanımı ve maliyeti sınırlamak): GDPR md. 6(1)(f); KVKK md. 5(2)(f)
  (meşru menfaat).
- **Paylaşım, profil fotoğrafı ve davetlerin AI kapısı:** yalnız sen başlattığında ve başlattığın sürece; açık
  rızana dayanır (GDPR md. 6(1)(a); KVKK md. 5(1)). Rızanı istediğin an geri çekebilirsin: paylaşımı durdur, fotoğrafı
  kaldır, daveti kapat ya da sunucudaki verinin silinmesi için bize yaz.
- **Yurt dışına aktarım:** bkz. bölüm 10.

### 10. Yurt dışına aktarım

Trip Radar'ın hiçbir sunucusu Türkiye'de değildir:

- Paylaşım sunucusu ve AI kapısı aynı Supabase projesindedir ve **Hindistan'da (Mumbai, ap-south-1)** çalışır.
- Google, Anthropic, OpenStreetMap, OpenFreeMap, Frankfurter, Wikipedia, Unsplash, Pexels, AeroDataBox (RapidAPI), Kiwi.com, Aviasales, Travelpayouts, Tripadvisor (RapidAPI), Xotelo, SerpApi, Viator, Airalo ve Omio kendi sunucularını kullanır; bunlar ABD, AB ya da
  başka ülkelerde olabilir.

Bu aktarımlar yalnız senin başlattığın işlemler (yapay zekâ, paylaşım, davet) için ve o işlem için gerektiği kadar
yapılır; hangi verinin nereye gittiği yukarıda tek tek yazılıdır. Hizmet sağlayıcıların (Supabase, Google, Anthropic)
kendi veri işleme koşulları ve güvenceleri uygulanır. Bir işlemi başlatmadan önce bu aktarımı istemiyorsan o işlemi
kullanmaman yeterlidir; tarayıcında kalan veriler hiçbir yere gitmez.

### 11. Saklama süreleri

| Veri | Nerede | Ne kadar |
| --- | --- | --- |
| Geziler, kayıtlar, notlar, sohbet, belgeler, anahtarın | Tarayıcında | Sen silene ya da eklentiyi kaldırana kadar |
| Silinenler | Tarayıcındaki Çöp kutusu | 30 gün, sonra kendiliğinden silinir |
| Paylaşılan gezi (kayıtlar, oylar, profiller) | Paylaşım sunucusu | Silinmesini isteyene kadar |
| Ortak ayarların eski hâlleri | Paylaşım sunucusu | En yeni 200 sürüm; daha eskisi kendiliğinden silinir |
| AI kapısı sayaçları (içerik yok, yalnız sayı) | Sunucu | Davet var olduğu sürece; silinmesini isteyene kadar |
| Davet edenin Gemini anahtarı | Sunucu | Silinmesini isteyene kadar |
| Uçuş bilgisi (uçuş numarası, gün, tarife ve durum; kişi yok) | Sunucu ve tarayıcın | Sunucuda silinmesini isteyene kadar; tarayıcında eklentiyi kaldırana kadar |
| Öneriler (sorulan yer ve gün, kaynakların fiyat ve otel bilgisi; kişi yok) | Sunucu ve tarayıcın | Sunucuda silinmesini isteyene kadar (fiyatlar 12–24 saatte yenilenir); tarayıcında 6 saat |
| Yapay zekâya gönderilen içerik | Google / Anthropic | Sağlayıcının kendi koşullarına göre |

### 12. Güvenlik

- Tüm bağlantılar şifreli (HTTPS) yapılır.
- Davet edenin anahtarı yalnız sunucu tarafında, yetkili servis rolüyle okunabilir.
- Paylaşılan geziye erişim, tahmin edilmesi zor bir gizli kodla olur.
- Hiçbir sistem tam güvenli değildir. Bir veri ihlali olursa yasaların gerektirdiği şekilde ilgili kuruma ve
  etkilenen kişilere bildirimde bulunuruz.

### 13. Çerezler ve izleme

Eklenti çerez koymaz, reklam ya da analiz aracı kullanmaz, seni siteler arasında izlemez. Ziyaret ettiğin sitelerin
kendi çerezleri o sitelerin politikalarına tabidir; bir öneri bağlantısına tıkladığında Travelpayouts'un ve gittiğin
sitenin çerezleri de böyledir (bkz. 8).

### 14. Çocuklar

Trip Radar seyahat planlayan yetişkinler için yapılmıştır ve 16 yaşından küçüklere yönelik değildir. Bilerek
16 yaşından küçüklerin verisini toplamayız. Böyle bir durum fark edersen info@emredurmus.net adresine yaz;
sunucudaki ilgili veriyi sileriz.

### 15. Hakların

GDPR ve KVKK md. 11 kapsamında şu haklara sahipsin: verilerine erişim, düzeltme, silme, taşınabilirlik, işlemeye
itiraz, rızanı geri çekme ve bir denetim makamına şikâyet.

Pratikte:

- **Tarayıcındaki veriler:** biz bunlara erişemeyiz; her şeyi doğrudan sen yönetirsin. Uygulama içinden görebilir,
  düzeltebilir, silebilirsin; eklentiyi kaldırmak hepsini siler. **Ayarlar → "Verileri dışa aktar (JSON)"** ile hepsinin bir kopyasını
  alabilirsin (taşınabilirlik).
- **Sunucudaki veriler** (paylaşılan geziler, profiller, AI kapısı sayaçları, davet edenin anahtarı): info@emredurmus.net
  adresine yaz. Hangi geziyi kastettiğini anlayabilmemiz için gezinin adını ya da paylaşım bağlantısını ekle.
  En geç 30 gün içinde yanıt veririz.
- **Yapay zekâ sağlayıcısındaki veriler:** kendi anahtarınla gönderdiysen Google'a ya da Anthropic'e doğrudan
  başvurursun.
- **Şikâyet:** Türkiye'de Kişisel Verileri Koruma Kurulu'na (kvkk.gov.tr), AB'de yaşadığın ülkenin veri koruma
  otoritesine başvurabilirsin. Önce bize yazarsan çoğu konuyu hızla çözebiliriz.

### 16. Değişiklikler

Eklenti kendini otomatik günceller. Bu politika değişirse üstteki tarih ve sürüm güncellenir.
Önemli bir değişiklik (yeni bir veri türü ya da yeni bir alıcı gibi), değişikliği getiren sürümle birlikte bu
sayfada açıkça yazılır.

### 17. İletişim

Emre Durmuş · info@emredurmus.net

---

## English

### 1. In short

Trip Radar is a Chrome extension that collects the travel pages you save (stays, flights, activities, restaurants),
compares them and puts them in a day-by-day plan.

- No account. No ads. No analytics or tracking tools. The extension sets no cookies. Your data is never sold.
- Most of your data stays only in your browser and never reaches us.
- What leaves your computer: what you send to the AI, trips you choose to share, and short lookups for maps,
  exchange rates and city photos. Each is explained below.

### 2. Who we are (controller)

Trip Radar is developed and published by Emre Durmuş.

- Controller: Emre Durmuş (individual developer)
- Email: info@emredurmus.net (for every privacy request; a postal address is given by email on request)
- Trip Radar is free, sells nothing, and processes personal data only for the purposes below, on a small scale.

This policy covers only the Trip Radar extension and its server side. The websites you save, Google, Anthropic and
the other services named below have their own privacy policies.

### 3. Data that stays on your computer

The following is kept only in this browser's local storage (IndexedDB and `chrome.storage`):

- your trips and their settings,
- what is read from the pages you save: name, price, dates, address, rating and a small screenshot,
- your notes and your chat history with the AI,
- documents you attach (ticket PDFs, images),
- your preferences, your profile name and (if you added one) your profile photo,
- photos you give the people you name in "Who's going?" (only on this computer; sent to no one, not to that person
  either),
- drafts of a new trip you left unfinished and what is prepared for them while you chat (the place's photo addresses,
  the suggested route, the rules' suggestion titles; at most 8 drafts; not in the export or sharing),
- your own AI key, if you entered one.

We do not see this data and it is not sent to us. You control it fully: you can view, correct and delete it.

**Deleting:** records, documents and trips you delete stay for 30 days only in this computer's "Trash", then are
deleted on their own. "Delete forever" or "Empty trash" deletes them at once. Uninstalling the extension deletes all
Trip Radar data in this browser.

**Note:** this data is protected by the browser's own safeguards. Anyone with access to your computer or browser
profile can see it too.

### 4. Reading pages

The extension reads only the tab where you press "Save", and only at that moment. It does not read pages in the
background. Your browsing history, passwords and payment details are not read.

Whatever appears in the text or the screenshot of a page you save (for example your name on a booking page) is read
and sent to the AI. If you do not want a page showing personal details to be processed, do not press "Save" on it.

### 5. AI processing

What is sent:

- the text and a small screenshot of a page you save,
- your chat messages (and the trip details needed to answer), including what you write when starting a new trip
  by chat, the quick answer you pick and what is known so far (to write the reply), and the request for a suggested
  route,
- documents you ask it to read,
- in the background, without you asking each time: a summary of the trip (cities, dates, how many people go, the
  options you saved and their kinds, your notes). The comparison review, the trip's style words and suggestions come from it; the
  suggestions review runs at most once a day per trip and only after a big change. Suggestions are kept only on this
  computer and are not shared.

Who it goes to:

- **Google Gemini API** (default), or
- **Anthropic Claude API** (if you choose it and add your own key).

How it travels:

- **With your own key:** directly from your browser to Google or Anthropic. Our server is not in between. Your
  relationship with Google or Anthropic is then governed by your own account's terms.
- **If someone invited you:** through the inviter's Trip Radar server (the "AI gate" on Supabase), which forwards it
  to Google using the inviter's key. The gate does not store the contents. It keeps only, per invite ticket and per
  day, the number of requests, the number of tokens and the estimated cost.

**Please know this plainly:** on Gemini's free tier Google may use what is sent to improve its products, and humans
may review it. So on the free tier, do not ask the AI to read anything you need to keep private (for example a
document showing a passport or ID number). On the paid tier and with Anthropic, the provider's own terms apply.

We do not train any AI model on your content; we do not have one.

AI answers can be wrong. Always check prices, dates and rules on the original site. Trip Radar makes no automated
decision about you with legal or similarly significant effect; it only makes suggestions.

### 6. AI gate (inviter's side)

If you use your own Gemini key to invite friends:

- your key is stored on the server (Supabase) and can be read only by the server-side service role; it is not shown
  to the browser or to the people you invite,
- each invite carries a random ticket; you can close a ticket at any time,
- per ticket, the daily number of requests, tokens and estimated cost are kept so that you can see the usage.

To have your key deleted from the server, write to info@emredurmus.net; we delete it and your invites' AI stops.

### 7. Sharing (optional)

When you share a trip, the following goes to the sharing server (Supabase):

- the trip's settings (including the names of who's going that you entered, "Travellers", and the departure city of anyone coming from elsewhere),
- the pages you saved (including the small screenshot),
- votes and reactions,
- members' names and (if they added one) small profile photos (128-pixel JPEG).

Anyone who holds the trip's secret code or link can access this data. Share the link only with people you trust.

So that a wrong change can be undone, the last 200 earlier versions of a shared trip's common settings (name, dates,
budget, priorities, amenities, requirements, travellers' names) are kept on the server with who changed them and when.

"Stop sharing" only stops syncing on that computer. The shared trip on the server (with its saves, votes, profiles
and history) is deleted on request: write to info@emredurmus.net.

### 8. Other services

- **OpenStreetMap Nominatim:** only an address, or the name of a city, town or airport the map doesn't know, to place
  it; the result is stored on your device and not asked again.
- **OpenFreeMap (tiles.openfreemap.org):** when a map opens, only the map tiles, fonts and icons for the area in view
  are requested; nothing about the trip, its dates, travellers or bookings is sent. As with any web request, your IP
  address and browser details are visible.
- **Web search (Google, through our server):** when the chat looks up a live fact (e.g. an event's dates, opening hours) or you ask it to research something, only the search question is sent; it may contain a place or event name (when the question names no place, the trip's place name is added, e.g. "camper van rental Dahab"). Nothing about you or the rest of the trip is sent. The answer is kept on the server with the question for a few days (the same question isn't searched again); for the daily limit, only a one-way hash of your install's random id and of your address is kept.
- **Frankfurter:** only a currency pair, for exchange rates.
- **Wikipedia / Unsplash / Pexels:** only the name of a place or an event, for a trip photo; directly to Wikipedia,
  and to Unsplash and Pexels through the sharing server. The photo shows who took it and where it is from.
- **AeroDataBox (via RapidAPI):** only for flights with a ticket bought (booked), only a flight number and its day
  ("KL1577, 7 October"), for that flight's schedule, status, gate, terminal and baggage belt, through our server. The server keeps
  this public flight information by flight number and day, so the same flight isn't asked about again for everyone
  who has it; it doesn't keep who asked. The answer is also kept on this computer.
- **Kiwi.com and Aviasales image servers:** only the airline's two-letter code ("KL"), for the airline's logo on a
  flight's card (from Aviasales when Kiwi's won't load).
- **Offers (Travelpayouts / Aviasales, Tripadvisor, Xotelo, Viator, Airalo, Omio):** for the "N offers for you" row under an empty flight or
  stay card, only what the search needs is sent, through our server: for a flight the two airport codes, the day and
  the head-count ("IST, DPS, 10 November, 2 people"); for a stay the city and country name, the check-in and
  check-out days and the head-count; for an activity the city, the days, the head-count and the card's name ("Boat
  tour"); for an eSIM the country code and the trip's days; between cities the two cities' names and the head-count
  ("Lisbon, Porto, 2 people"). The server takes flight prices from Aviasales' cached prices (Travelpayouts),
  the city's id from Tripadvisor (via RapidAPI), hotels and each platform's price from Xotelo; when those have nothing,
  or a live price is asked for in the chat, the same search goes to SerpApi for Google Flights / Google Hotels results;
  activities come from Viator (Viator Partner API); eSIM packages from Airalo's, and starting prices for trains, buses,
  flights and ferries between cities from Omio's public product list (your search isn't sent to either: the list is
  downloaded whole); it keeps this public
  information by the place and days asked, so the same question isn't asked again for everyone, and doesn't keep
  who asked. The answer is also kept on this computer for a few hours.
- **Travelpayouts affiliate links:** a page of a brand Trip Radar is a partner of, opened from the board (offers,
  search buttons, a page you saved; Booking, Agoda, Trip.com, GetYourGuide, Viator, Aviasales, Airalo, Omio and the like), goes
  through Travelpayouts' affiliate link (tp.media) as you click it and lands on the same page; Travelpayouts sees
  that page's address. If you book there, Trip Radar may earn a commission; it costs you nothing extra. Pages that
  may carry your own booking or account (managing a booking, confirmations, account, sign-in; addresses with a
  booking number or a key in them) are never turned. The extension doesn't change links on the sites you visit.
  When you click, Travelpayouts and that site set their own cookies.

No name, email or trip content is sent to these services. As with any connection, the server receiving the request
can see your IP address.

### 9. Why we process data (legal bases)

- **Providing the service you ask for** (reading pages, AI, maps, exchange rates, sharing): GDPR Art. 6(1)(b);
  KVKK Art. 5(2)(c) (performance of a contract).
- **Usage counting on the AI gate** (to limit abuse and cost): GDPR Art. 6(1)(f); KVKK Art. 5(2)(f) (legitimate
  interest).
- **Sharing, the profile photo and the AI gate for your invites:** only when and while you start them; based on your
  explicit consent (GDPR Art. 6(1)(a); KVKK Art. 5(1)). You can withdraw it at any time: stop sharing, remove the
  photo, close the invite, or write to us to have the server data deleted.
- **International transfers:** see section 10.

### 10. International transfers

None of Trip Radar's servers are in Turkey:

- The sharing server and the AI gate are in the same Supabase project, in **India (Mumbai, ap-south-1)**.
- Google, Anthropic, OpenStreetMap, OpenFreeMap, Frankfurter, Wikipedia, Unsplash, Pexels, AeroDataBox (RapidAPI), Kiwi.com, Aviasales, Travelpayouts, Tripadvisor (RapidAPI), Xotelo, SerpApi, Viator, Airalo and Omio use their own servers, which may be in the US,
  the EU or other countries.

These transfers happen only for actions you start (AI, sharing, invites) and only as far as that action needs; what
goes where is listed above. The providers' (Supabase, Google, Anthropic) own data processing terms and safeguards
apply. If you don't want a transfer, not using that action is enough; what stays in your browser goes nowhere.

### 11. How long data is kept

| Data | Where | How long |
| --- | --- | --- |
| Trips, saves, notes, chat, documents, your key | Your browser | Until you delete them or uninstall |
| Deleted items | Trash in your browser | 30 days, then erased on their own |
| Shared trip (saves, votes, profiles) | Sharing server | Until you ask for deletion |
| Earlier versions of common settings | Sharing server | The newest 200 versions; older ones are deleted automatically |
| AI gate counters (numbers only, no content) | Server | While the invite exists; until deletion is requested |
| Inviter's Gemini key | Server | Until deletion is requested |
| Flight information (number, day, schedule and status; no person) | Server and your browser | On the server until deletion is requested; in your browser until you uninstall |
| Offers (the place and days asked, the sources' prices and hotels; no person) | Server and your browser | On the server until deletion is requested (prices refreshed every 12–24 hours); in your browser for 6 hours |
| Content sent to the AI | Google / Anthropic | Under the provider's own terms |

### 12. Security

- All connections are encrypted (HTTPS).
- The inviter's key can be read only server-side, by the service role.
- Access to a shared trip requires a secret code that is hard to guess.
- No system is perfectly secure. If a data breach happens, we will notify the relevant authority and the people
  affected as the law requires.

### 13. Cookies and tracking

The extension sets no cookies, uses no advertising or analytics tools, and does not track you across sites. Cookies
set by the websites you visit are governed by those sites' policies; so are Travelpayouts' and the site's cookies
when you click an offer's link (see 8).

### 14. Children

Trip Radar is made for adults planning travel and is not directed at children under 16. We do not knowingly collect
data from children under 16. If you notice this has happened, write to info@emredurmus.net and we will delete the
related data on the server.

### 15. Your rights

Under the GDPR and KVKK Art. 11 you have the right to access your data, correct it, have it deleted, take it with you
(portability), object to processing, withdraw consent, and complain to a supervisory authority.

In practice:

- **Data in your browser:** we cannot reach it; you manage it directly. You can view, correct and delete it inside
  the app; uninstalling removes all of it. **Settings → "Export data (JSON)"** gives you a copy of all of it
  (portability).
- **Data on the server** (shared trips, profiles, AI gate counters, the inviter's key): write to info@emredurmus.net.
  Include the trip's name or share link so we can find it. We answer within 30 days at the latest.
- **Data at the AI provider:** if you sent it with your own key, contact Google or Anthropic directly.
- **Complaints:** in Turkey, the Personal Data Protection Board (KVKK Kurulu, kvkk.gov.tr); in the EU, the data
  protection authority of the country you live in. If you write to us first, we can usually sort things out quickly.

### 16. Changes

The extension updates itself. When this policy changes, the date and version at the top are updated.
A significant change (a new kind of data or a new recipient, say) is stated plainly on this page with the version
that brings it.

### 17. Contact

Emre Durmuş · info@emredurmus.net
