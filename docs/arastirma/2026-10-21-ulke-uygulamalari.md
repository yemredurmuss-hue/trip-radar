# Ülke uygulamaları tablosu: "Telefonuna kur" kartının verisi

Tarih: 2026-10-20 gecesi araştırıldı, 2026-10-21 sabahı için. Veri: [`src/data/countryApps.json`](../../src/data/countryApps.json).
Denetim: [`scripts/check-country-apps.mjs`](../../scripts/check-country-apps.mjs). Kod henüz bu dosyayı okumuyor; kart
tasarımı ve bağlama başka işlerde yapılacak.

## Kısaca

- **200 ülke**: 105 tam (kademe 1) + 95 asgari (kademe 2). Bütün Avrupa, Asya, Körfez, Kuzey Afrika, Amerikalar,
  Avustralya ve Yeni Zelanda kademe 1'de. Afrika'nın geri kalanı, Pasifik ve Karayipler kademe 2'de.
- **1211 ülke-uygulama satırı**, **573 uygulamalık katalog** (501'i ülke tablosunda, 72'si yalnızca niyet tablosunda).
- **Doğrulanmamış oran**: tümünde %24,8 (300/1211). Kademe 1'de %13,5 (120/892), kademe 2'de %56 (180/319).
  Güven dağılımı: 559 yüksek, 479 orta, 127 düşük.
- **Mağaza linkleri**: kataloğun bütün 1009 linki 2026-10-20'de canlı yanıt verdi (`--net all`, 1009/1009).
  468 uygulamanın iki linki de var, 32'sinin hiç linki yok (çoğu İran'da mağazadan kaldırılmış uygulamalar ya da yalnız
  web üzerinden çalışan hizmetler). Eksik linklerin nedeni `catalog.<id>.store.note`'ta yazıyor.
- **Niyet tablosu** (`intents`): 14 gezi türü, 86 kayıt (65'i dünya geneli, 21'i bölgesel), 1'i doğrulanmamış.
- **eSIM**: Airalo, Holafly ve Yesim kapsamı her ülkede `esim` alanında. 18 ülkede üçü de yok (TM, LY, SY, KP, SO, SS,
  ER, DJ, BI, KM, GQ, ST, SB, KI, MH, FM, PW, TV).

## Dosya biçimi

```jsonc
{
  "updated": "2026-10-20", "schema": 1,
  "categories": { "ride": "Taksi / araç çağırma", "rail": "...", "transit", "food", "pay", "map", "chat", "other", "intent" },
  "esimProviders": { "airalo": { "name", "ios", "android", "source", "countListed" }, "holafly": {…}, "yesim": {…} },
  "catalog": {                       // bir uygulama bir kez: ad, mağaza linkleri, mağazanın gösterdiği başlık
    "grab": { "name": "Grab", "cat": "ride", "ios": "https://apps.apple.com/app/id647268330",
              "android": "https://play.google.com/store/apps/details?id=com.grabtaxi.passenger",
              "store": { "iosTitle", "androidTitle", "checked": "2026-10-20", "note"? } } },
  "countries": {
    "TH": { "name": { "tr": "Tayland", "en": "Thailand" }, "tier": 1, "regionNote": "Bangkok/Phuket...",
            "apps": [ { "id": "grab", "cat": "ride", "why": "…", "source": "https://…", "verified": true, "confidence": "high" } ],
            "notes": ["foodpanda 23 Mayıs 2025'te Tayland'dan çekildi…"],
            "esim": { "airalo": "local", "holafly": "local", "yesim": "local" }, "checked": "2026-10-20" } },
  "intents": {
    "hiking": { "name": {…}, "apps": [ {"id","why","source","verified","confidence"} ],
                "regional": [ {"id": "yamap", "countries": ["JP"], …} ], "notes": ["Çin: …"] } }
}
```

**Neden ortak katalog?** Aynı uygulama çok ülkede geçiyor: WhatsApp 151, Uber 76, Bolt 50, Google Maps 49. Mağaza linki
ve adı uygulamaya ait olduğu için katalogda bir kez tutuluyor. Neden lazım olduğu (`why`), kaynak ve doğrulama ise
ülkeye ait, o yüzden her ülkenin satırında duruyor. Böylece iki ayrı doğrulama ekseni oluşuyor:

1. **Mağaza ekseni (katalog)**: link gerçek mi? Elle değil, betikle kontrol edildi (aşağıda).
2. **Ülke ekseni (satır)**: bu uygulama bu ülkede 2025-2026'da gerçekten çalışıyor mu? `verified` + `confidence` + `source`.

Aynı markanın ülkeye göre ayrı mağaza uygulaması varsa ayrı id verildi: `uber-az`, `uber-kz`, `didi-china`,
`just-eat-uk` / `just-eat-es` / `just-eat-it` / `just-eat-ie` / `just-eat-ch`, `lieferando`. Aynı uygulama iki ayrı adla
gelmişse birleştirildi (`yandex-eats` → `yandex-eda`).

`esim` değerleri: `local` (tek ülke paketi var), `regional` (yalnız bölgesel/küresel paket), `none`, `unknown`.

## Yöntem

1. **Bölge bölge paralel araştırma.** 10 bölge ajanı, 1 eSIM ajanı ve 1 niyet ajanı çalıştı: Batı-Kuzey Avrupa,
   Güney-Orta Avrupa, Doğu Avrupa+Balkanlar+Türkiye, Rusya+Kafkasya+Orta Asya+İran, Doğu Asya, Güneydoğu Asya,
   Güney Asya+Orta Doğu, Kuzey-Doğu-Güney Afrika, Batı-Orta Afrika, Amerikalar, Okyanusya+Karayipler. Kaynak sırası:
   uygulamanın kendi ülke/şehir sayfası (bolt.eu/cities, uber.com/global, yango, inDrive, Cabify, DiDi, Glovo, Wolt,
   PedidosYa…), resmi demiryolu ve ulaşım kurumları, turizm kurumları, 2025-2026 tarihli gezgin rehberleri
   (bento.travel, nomada.tools, Seat61), çıkış ve birleşme haberleri.
2. **Mağaza linkleri iki kez kontrol edildi.** Önce ajan buldu, sonra birleştirme betiği her linki yeniden sordu:
   iOS için iTunes Lookup API (`lookup?id=` / `lookup?bundleId=`), Android için Google Play sayfasının 200 dönmesi ve
   sayfa başlığı. Uygulama adı ile mağaza başlığı uyuşmayınca uyarı verdi. 12 uyarının hepsi yerel dilde başlık çıktı
   (örnek: KakaoMap için `카카오맵`, Tutu için `ЖД билеты`, Ubian için `Dopravná karta v mobile`). Bilerek
   **ada göre mağaza araması kullanılmadı**: hem hız sınırına takılıyor (403/429) hem de aynı adlı başka bir
   uygulamayı seçebiliyor. Kimliği bulunamayan link uydurulmadı, boş bırakıldı.
3. **Birleştirme.** Bölge dosyaları tek katalog + ülke tablosuna döküldü, eSIM kapsamı ve notları ülkelere eklendi.
   Kaynağı olmayan `verified:true` satırlar otomatik olarak `verified:false` / `low` yapıldı.
4. **Boş ülke kuralı.** Hiç kaynak bulunamayan 16 ülkeye (çoğu Pasifik ve Karayip adası) WhatsApp + Google Maps
   satırı `verified:false` / `low` ve "Ülkeye özel kaynak bulunamadı" gerekçesiyle eklendi. Kuzey Kore bilerek boş
   bırakıldı: turiste açık internet yok, yalnız notu var.
5. **Denetim betiği.**
   `node scripts/check-country-apps.mjs` şemayı ve URL biçimini kontrol eder.
   `--net 40` rastgele 40 linki, `--net all` bütün linkleri mağazaya sorar.
   Play, mağaza ülkesi verilmezse bağlantının çıktığı ülkeyi kullanıyor (bu makinede Portekiz). Bu yüzden MAX gibi
   bölgeye kilitli uygulamalar 404 veriyordu. Betik önce ABD mağazasını, sonra uygulamayı listeleyen ülkelerin
   mağazasını dener. Son sonuç: 1009/1009.

## Kapsam istatistiği

| Bölge | Ülke | Kademe 1 | Satır | Doğrulanmamış |
|---|---:|---:|---:|---:|
| Batı-Kuzey Avrupa | 17 | 17 | 149 | 27 |
| Güney-Orta Avrupa | 14 | 14 | 138 | 30 |
| Doğu Avrupa, Balkanlar, Türkiye | 15 | 15 | 124 | 9 |
| Rusya, Kafkasya, Orta Asya, İran | 12 | 10 | 84 | 17 |
| Doğu Asya | 7 | 6 | 52 | 1 |
| Güneydoğu Asya | 11 | 9 | 83 | 15 |
| Güney Asya, Orta Doğu | 20 | 15 | 119 | 18 |
| Kuzey, Doğu, Güney Afrika | 21 | 7 | 108 | 25 |
| Batı ve Orta Afrika | 33 | 0 | 128 | 98 |
| Amerikalar | 25 | 10 | 152 | 8 |
| Okyanusya ve Karayipler | 25 | 2 | 74 | 52 |
| **Toplam** | **200** | **105** | **1211** | **300** |

Kategoriye göre satır sayısı: ride 405, chat 204, food 199, rail 132, transit 115, map 105, pay 34, other 17.

Kademe 1 (105): AD AE AL AM AR AT AU AZ BA BE BG BH BR BY CA CH CL CN CO CU CY CZ DE DK DO DZ EE EG ES FI FR GB GE GR
HK HR HU ID IE IL IN IQ IR IS IT JO JP KE KG KH KR KW KZ LA LB LI LK LT LU LV MA MC MD ME MK MM MO MT MV MX MY NL NO NP
NZ OM PE PH PK PL PT QA RO RS RU SA SE SG SI SK SM TH TJ TM TN TR TW TZ UA US UZ VA VN XK ZA.

## En önemli 10 bulgu

Bunlar ajanların kaynaklı bulguları. Bir kısmı benim bilgi kesimimden (Haziran 2026) sonraki olaylar. Kaynak URL'leri
JSON'daki satırlarda; kartta kullanmadan önce önemli olanlara bir kez daha bakılmalı.

1. **Rusya'da mesajlaşma çöktü.** WhatsApp engelli, Telegram 2026 Nisan'dan beri neredeyse tamamen engelli. Temmuz
   2026'dan beri yabancı SIM/eSIM de bunu aşmıyor. Turistin Rus SIM'i alması pratikte imkânsız (SNILS, Gosuslugi,
   biyometrik kayıt gerekiyor). RZD uygulaması App Store'da yok, yabancı Visa/Mastercard çalışmıyor.
2. **Çin'de uygulamaları evden kurup kaydı orada yap.** Alipay ve WeChat Pay yabancı kartla çalışıyor ama kayıt SMS
   kodu istiyor ve yalnız veri veren eSIM SMS alamıyor. Holafly ve Yesim, Çin sayfalarında WhatsApp ve Google'ın VPN'siz
   açıldığını yazıyor; Airalo bunu yazmıyor. DiDi'nin Çin uygulaması (`didi-china`) global DiDi'den ayrı.
3. **Uber birçok ülkede ya çekildi ya da yalnız taksi çağırıyor.** Uber Tanzanya (Ocak 2026), Uganda ve Nijerya'dan
   (Eylül 2026) çekildi; Uganda çıkışını iki ajan birbirinden bağımsız buldu. Pakistan'dan 2022'de çıkmıştı. Uber şu
   ülkelerde yalnız lisanslı taksi çağırıyor: İtalya (UberX yasak), Yunanistan, Macaristan, Slovenya, Lüksemburg, Fas
   (Kasım 2025'te dönüş), Makao (Şubat 2026'da dönüş), Mauritius, Barbados. Kenya'da Uber Visa kabulünü bıraktı.
4. **Azerbaycan ve Kazakistan'da global Uber uygulaması çalışmıyor.** Ayrı "Uber AZ" ve "Uber KZ" uygulamaları gerekiyor.
   Bu, "uygulamayı kur" kartının en somut faydası.
5. **Careem geri çekiliyor.** Pakistan (Temmuz 2025), Katar (2023), Umman ve Lübnan'da yok. İsrail'de Uber yok,
   Yango 2025'te tamamen çıktı, taksi uygulaması Gett.
6. **Yemek uygulamaları hızla kapanıyor.** Wolt Japonya'da (Mart 2026) ve Özbekistan'da (Mart 2026) kapandı.
   Glovo Bosna'dan çıktı (Ağustos 2026). foodpanda Tayland'dan, Deliveroo Hong Kong, Singapur ve Katar'dan çıktı.
   Menulog Avustralya'da kapandı (Kasım 2025). Just Eat Danimarka'dan, büyük olasılıkla Fransa'dan da çıktı. Uber Eats
   Brezilya, Peru, Kolombiya, Uruguay, Honduras ve Bolivya'da yok. Uber, talabat'ın sahibi Delivery Hero'yu satın alıyor
   (kapanış 2027).
7. **Yerel ödeme uygulamaları turiste kapalı.** TWINT İsviçre numarası, Vipps ve Swish yerel BankID, MobilePay
   Nordik numara istiyor. Hindistan'da Paytm, PhonePe ve GPay turiste kapalı; tek yol UPI One World (Cheq), o da pasaport,
   vize ve yüz yüze kimlik kontrolü istiyor. M-Pesa pasaportla kayıtlı SIM istiyor; Kenya'da Tourist Tap uygulaması bunu
   aşıyor. Kamboçya'nın resmi turist cüzdanı Bakong Tourists, Laos'ta LOCA kartla LAO-QR ödemesi yapabiliyor.
8. **Mesaj ve arama kısıtları.** BAE'de WhatsApp ve FaceTime aramaları 2026'da hâlâ kapalı (botim listede).
   Umman'da Aralık 2024'ten beri resmi olmasa da çalışıyor. Türkmenistan'da VPN yasa dışı ve eSIM yok. İran'da savaş ve
   28 Şubat - 25 Mayıs 2026 arası ülke çapında internet kesintisi oldu. Snapp ve benzerleri mağazalarda yok, İran numarası
   istiyor.
9. **Uygulama mı, başka bir şey mi?** Kore'de Google Maps 2026'da da yürüyüş ve araç rotası vermiyor; Naver Map ve
   KakaoMap gerekli. KorailTalk 3 Ağustos 2026'da Korail+ oldu. Kakao T turiste zor, k.ride ziyaretçi uygulaması.
   Japonya'da GO taksi kısa süreli ziyaretçiden 200 JPY ücret alıyor. Laos-Çin treni biletini yalnız LCR uygulaması
   satıyor. Mısır'da ENR uygulaması yabancıya bilet satmıyor. Zanzibar ayrı ZIC seyahat sigortası istiyor.
10. **Balkanlar ve Bulgaristan'da Uber/Bolt yok.** Sırbistan, Karadağ, Kuzey Makedonya, Arnavutluk, Kosova ve Bosna'da
    ikisi de yok; Bulgaristan'da Bolt yalnız scooter ve yemek için var. Sırbistan'da CarGo ve yerel taksi uygulamaları
    kullanılıyor. Belgrad'da toplu taşıma Ocak 2025'ten beri ücretsiz; Lüksemburg'da tüm toplu taşıma ücretsiz. Bolt
    Tunus'tan çekildi (Mayıs 2025); Botsvana ve Zambiya resmi listesinden düştü.

Ek, kart tasarımına doğrudan dokunanlar:

- **Cancún havalimanında** Uber ile yolcu almak hâlâ yasal değil. **Nijerya havalimanlarında** Ağustos 2026'dan beri yalnız
  Bolt'a izin var. **Phuket havalimanında** taksi kooperatifleri hâkim. Havalimanı transferi önerisi ülkeye göre değişmeli.
- **Küba'ya** gitmeden önce uygulamalar kurulmalı: App Store ve Play orada kısıtlı. La Nave, Play'de ve Küba'nın yerel
  mağazası Apklis'te var. ABD bankası kartı çalışmıyor.
- **Waymo** 15 ABD şehrinde. Austin ve Atlanta'da yalnız Uber uygulamasından çağrılabiliyor.
- **Türkiye eSIM'i**: Airalo'ya göre 120 günde 91 günü aşan kullanımda IMEI kaydı gerekiyor. KKTC'yi kapsamıyor (üç
  sağlayıcıda da ayrı paket var).

## Niyet tablosu (gezi türüne göre)

14 niyet: hiking, camping, diving, surfing, skiing, cycling, festival, birding, nightlife, stargazing, sailing,
road-trip, outdoor-safety, offline-maps. Örnekler: AllTrails, komoot, Wikiloc, Gaia GPS, Park4Night, iOverlander,
Surfline, Windy. Bölgesel karşılıklar `regional` altında ülke listesiyle duruyor: YAMAP ve Yamareco (JP), bergfex (Alpler),
UT.no (NO), OS Maps (GB), NPS ve Recreation.gov (US), Plan My Walk (NZ), White Risk (CH).

Festival niyetinde "festivalin kendi resmi uygulamasını kur" kuralı not olarak yazılı. Etkinliğe özel uygulamayı AI
bulacak; tabloda olmayanı AI getirir. Ücretli özellikler `why` metninde ya da mağaza notunda belirtildi (Gaia GPS'te
çevrimdışı harita Premium; Wikiloc'ta çevrimdışı harita ücretsiz, başkasının izini takip etmek Premium). Magicseaweed
kapandı, sitesi Surfline'a yönleniyor.

## Dikkat edilecekler

- **Arama kotası doldu.** Oturumun ortak WebSearch kotası (200) araştırmanın ortasında bitti. Ajanlar kota
  bildirimindeki talimata uyup başka bir arama servisine geçmedi. Bilinen resmi sayfaları doğrudan açarak
  (WebFetch, firecrawl scrape) ve mağaza kayıtlarına bakarak devam ettiler. Bu yüzden bazı ülkelerde derinlik düşük:
  Kosova, Moldova, Belarus, Kırgızistan, Tacikistan, Afganistan, Suriye, Yemen, Filistin ve küçük ada ülkeleri.
- **iTunes'ta ada göre arama kısıtlandı (403/429).** Yalnız kimlikle ve bundle ile sorgu çalıştı. Bu yüzden 91 uygulamada
  iOS linki, 46 uygulamada Android linki boş. Örnekler: ÖBB, SJ, SL, Vy, DSB, appTaxi, ATM Milano, efood, PassApp,
  SUBE, PedidosYa, Greyhound. Hız sınırı kalkınca ada göre aramayla tamamlanabilir; sonucu yine bu betikle kontrol etmek
  gerekir.
- **Veri tarihi.** Her satır 2026-10-20'de bakılmış durumu gösteriyor. Uygulama pazarı hızlı değişiyor: bir yılda en az
  15 çıkış ve kapanış kaydedildi. JSON'da `checked` alanı var. En az 6 ayda bir `--net all` çalıştırılmalı, kademe 1'in
  ride ve food satırlarına yeniden bakılmalı.
- **"Neden" metinleri** Türkçe, çoğu 90 karakterin altında. Kartta kısaltma gerekirse ilk yan cümle yeterli.
- **Doğrulanmamış satırlar** kartta soluk gösterilmeli ya da yalnız AI teyidinden sonra çıkmalı. Kademe 2'nin yarısından
  fazlası bu durumda.
- **Mesajlaşma satırları** (WhatsApp, Telegram, Viber, Messenger) çoğu ülkede genel bilgiye dayanıyor. Bu yüzden
  doğrulanmamış satırların çoğu chat kategorisinde. Bunlar yanlış olmaktan çok kaynaksız.

## Şüpheli ya da tek kaynaklı kayıtlar

- **Bolt, Angola**: tek ikincil kaynak, Bolt'un resmi şehir listesinde yok. `verified:false`.
- **Beat'in Yunanistan'da FREENOW'a katılması** ve **Ljubljana otobüslerinin nakit almaması**: ajanın hafızasından, kaynak
  yok (`openQuestions`'ta).
- **Uber'in Nijerya'dan çekilmesi (Eylül 2026)**: tek ajan buldu. Uganda için iki ajan aynı tarihi verdi; Nijerya ayrıca
  teyit edilmeli.
- **DiDi, Japonya**: ayrı bir Japonya uygulaması mı, global DiDi mi belirsiz. `verified:false`.
- **Heetch (Fas), Yango (Cezayir), Bolt (Kazakistan, Vietnam)**: kaynaklar çelişkili. Bolt KZ ve VN listeye konmadı;
  diğerleri düşük güvenle duruyor.
- **Grab–GoTo birleşmesi**: 2026 ortası itibarıyla imzalı anlaşma yok, iki uygulama ayrı çalışıyor. Birleşme olursa
  Endonezya'daki Gojek satırları ve Singapur değişir.
- **Robinhood (Tayland yemek)**: bir kaynağa göre 2025'te kapandı. Teyit edilemediği için listeye konmadı.
- **Kuzey Kore notları**: genel bilgi ve Wikipedia'ya dayanıyor, düşük güven.
- **Yerel adla gelen mağaza başlıkları** (`ubian` → "Dopravná karta v mobile", `tutu` → "ЖД билеты…"): kimlik doğru,
  yalnız başlık yerel dilde. Elle bakıldı, sorun yok.

## Bilinen boşluklar

- **Bağımlı topraklar** tabloda yok: Réunion, Guadeloupe, Martinik, Fransız Guyanası, Mayotte, Saint-Martin,
  Yeni Kaledonya, Fransız Polinezyası, Grönland, Faroe, Cebelitarık, Jersey, Guernsey, Man Adası, Aruba, Curaçao,
  Sint Maarten, Bermuda, Cayman, Turks ve Caicos, ABD/İngiliz Virjin Adaları, Guam, Cook Adaları, Batı Sahra ve diğerleri
  (eSIM listesinde 31 kod var). Kod bu durumda bağlı olduğu ülkeye (FR, DK, GB, NL, US) düşebilir ya da AI'a bırakabilir.
  Porto Riko (PR) tabloda var.
- **Okyanusya ve Karayipler**: 12 ülke için ülkeye özel araştırma yapılamadı (SB, KI, TV, NR, FM, MH, PW, GD, VC, AG, DM,
  KN). Yalnız varsayılan ve doğrulanmamış satırları var.
- **Batı-Orta Afrika**: 33 ülkenin hepsi kademe 2 ve satırlarının %77'si doğrulanmamış.
- **Şehir ayrımı** çoğu yerde yalnız `regionNote` ve `notes` metninde. Ayrı bir şehir alanı yok (örnek: Bolt Malezya'da
  yalnız Kuala Lumpur'da, Tayvan'da yalnız Keelung-Taipei-Taoyuan'da, İtalya'da yalnız Milano'da). Kart şehre göre
  süzecekse yeni bir alan gerekir.
- **Ödeme kategorisi** bilerek dar tutuldu (34 satır). Yalnız kartın geçmediği ya da yerel QR'ın şart olduğu yerlerde var.

## Açık sorular (ajanların raporlarından)

Her bölgenin çözülemeyen soruları aşağıda. Ham bölge dosyaları ve birleştirme betiği, oturumlar arası not klasöründe:
`side-session-notes/local_e422274c-…/ulke-uygulamalari/`.

### Batı-Kuzey Avrupa

- Just Eat Fransa: just-eat.fr takeaway.com/be-fr'ye yönleniyor; çıkış tarihi ve resmi duyuru bulunamadı (WebSearch bütçesi bitti).
- foodora (SE/NO/AT/FI): resmi siteler bot korumalı (403); ülke bazında güncel faaliyet teyit edilemedi.
- Uber Monako: Uber'in Monako şehir sayfası yok; Monako içinden araç çağırılabildiği doğrulanmadı.
- MobilePay'i turist (Nordik olmayan numara/kart) kurabiliyor mu: resmi kaynak bulunamadı.
- TWINT: yurt dışı ikametli Prepaid hesaplarının 2025 sonunda kapatıldığı ikincil kaynaktan (ibani.com); twint.ch 403 verdiği için resmi teyit yok.
- Freenow'un hangi şehirlerde çalıştığı (sitede 429/şehir listesi yok); FR/AT/GB'de kapsam medium bırakıldı.
- İzlanda'da yerlilerin işletmelerle asıl kullandığı mesajlaşma (WhatsApp mı Messenger mı) doğrulanmadı.
- Lihtenştayn: LIEmobil otobüs bileti için resmi uygulama doğrulanamadı (liemobil.li SSL hatası).
- Andorra içi otobüs uygulaması (Mobilitat Andorra) ve AndBus/DirectBus'ın resmiyeti doğrulanmadı.
- Pek çok yerel uygulamanın iOS ID'si App Store arama uç noktası 403 verdiği için bulunamadı; storeNote'ta işaretli.

### Güney-Orta Avrupa

- iTunes arama uç noktası 403 (rate limit) verdi, ortak WebSearch kotası doldu; şu yerel uygulamaların iOS ID'si boş kaldı: Anda (Porto), appTaxi, ATM Milano, efood, OASA Telematics, Cyprus Bus, Pyszne.pl, Vonatinfó, HŽPP, foodora.
- FREENOW'un Yunanistan'da Beat'i devralıp 2023'te markayı birleştirdiği bilgisi hafızadan; kaynakla teyit edilmedi.
- Uber Macaristan: Budapeşte şehir sayfası var; Főtaxi ortaklığıyla yalnız taksi olduğu ikincil kaynaktan (2024).
- Bolt Yunanistan ada kapsamı (Santorini/Korfu) kaynaklar arasında çelişkili; bolt.eu yalnız Atina, Girit, Mikonos listeliyor.
- Yango'nun Kıbrıs'ta çalıştığı yalnız ikincil kaynakta; Glovo'nun ülke bazında (PT/IT/PL/HR) 2026 kapsamı merkezi olarak doğrulanmalı.

### Doğu Avrupa, Balkanlar, Türkiye

- BY: Yandex Go'nun 2025-26'da Belarus'ta hizmet verdiği resmi/güncel kaynakla doğrulanamadı (uygulama BY mağazasında mevcut; yerel aggregator'lar var). Yandex Go yabancı kart kabul ediyor mu bilinmiyor.
- BY: Litvanya/Polonya-Belarus kara sınırı geçiş durumu (kapanmalar) bu çalışmada kontrol edilmedi; seyahat uyarısı ayrıca bakılmalı.
- XK: Kosova'ya Arnavutluk/K. Makedonya/havalimanından girip sonra Sırbistan'a geçişte giriş reddi riski ve yerel SIM (IPKO/Vala) önerisi bu oturumda kaynakla doğrulanmadı.
- XK/MD/BY: dominant mesajlaşma uygulaması (Viber/WhatsApp/Telegram) için güncel kaynak bulunamadı; verified:false bırakıldı.
- BG: BDZ'nin resmi mobil uygulaması bulunamadı (yalnızca üçüncü taraf tarife uygulamaları); bdz.bg online satış var.
- TR: Uber ve BiTaksi'nin İstanbul dışındaki şehir listesi resmi sayfadan alınamadı.
- RS: Glovo'nun Sırbistan'da kalıp kalmayacağı (BiH çıkışı sonrası) belirsiz; şu an glovoapp.com/en/rs aktif.
- MD: eBilet Chisinau'nun (Modeshift) belediyenin resmi bilet uygulaması olup olmadığı doğrulanmadı.
- LT: eTAKSI iOS sürümü bulunamadı (yalnızca Android doğrulandı).
- Bu bölgede WebSearch bütçesi bittiği için XK, MD, BY derinliği diğerlerinden düşük; bento.travel (Ağustos 2026) RS/RO/BG/BA/ME/MK/AL/UA/EE/LV/LT/TR için ana ikincil kaynak.

### Rusya, Kafkasya, Orta Asya, İran

- Bolt'un Almatı sayfası (bolt.eu/en/cities/almaty) var ama Kazakistan'da Bolt ride-hailing'in 2026'da gerçekten aktif olduğu teyit edilemedi; KZ listesine eklenmedi.
- MAX iOS'ta App Store'a geri döndü mü (Haziran 2026 kaldırma sonrası) ve yabancı (+90) numara ile kayıt mümkün mü doğrulanamadı.
- RZD 'РЖД Пассажирам' iOS: TestFlight erişiminin Ekim 2026 itibarıyla açık olup olmadığı belirsiz.
- İran'da WhatsApp ve Google Play'in Aralık 2024'teki engel kaldırma kararı sonrası 2026 durumu çelişkili (Ekim 2026 eSIM satıcısı 'engelli' diyor).
- İran uygulamalarının (Snapp, Tapsi, Balad, Snappfood) güncel Android paket adları doğrulanamadı; Play'de yoklar.
- Ermenistan Wolt/Yandex Eats ve Azerbaycan Bolt Food varlığı kontrol edilmedi.
- Moğolistan'da Facebook Messenger'ın baskın olduğu ve Toki'nin turist kullanımı 2025-26 kaynağıyla teyit edilmedi.
- Web arama bütçesi bittiği için bazı kontroller sınırlı yapıldı (KG/TJ/AF ikincil kaynaklara dayanıyor).

### Doğu Asya

- Alipay/WeChat Pay yabancı kart limitleri (tek işlem 5.000 USD, yıllık 50.000 USD) yalnızca ikincil kaynakta; resmi Alipay kaynağıyla doğrulanamadı, bu yüzden nota yazılmadı.
- 12306 Android: Google Play'de resmi paket bulunamadı (com.MobileTicket 404). Uluslararası Play'de yok gibi; doğrulanmalı.
- Taobao Flash Shopping (Ele.me) Android Play paketi bulunamadı.
- Japonya'da DiDi: Japonya'nın ayrı bir DiDi uygulaması mı yoksa global DiDi Rider mı kullanıldığı doğrulanamadı (verified:false bırakıldı). S.RIDE ve Japan Transit Planner (Jorudan) store kimlikleri doğrulanamadığı için eklenmedi.
- Google Maps Kore'de tam hizmet (yürüme/araç rotası) açıldı mı: Ağustos 2026 itibarıyla tarih yok.
- Hong Kong ride-hailing lisans yasasının yürürlük tarihi ve UberX'in yasal durumu doğrulanamadı.
- Tayvan THSR T Express ve TRA e-booking uygulamalarında yabancı kredi kartı kabulü resmi kaynakla doğrulanamadı.
- Grab'in foodpanda Tayvan alımına Tayvan Rekabet Kurulu'nun nihai kararı (inceleme 27 Ekim 2026'ya uzatılmıştı) bilinmiyor.
- Kuzey Kore için 2025-2026 tarihli turist internet kaynağı bulunamadı (web arama kotası doldu); notlar genel bilgi + Wikipedia'ya dayanıyor, düşük güven.
- Oturumda paylaşılan web arama kotası (200) bu bölge sırasında doldu; Kore WOWPASS/Climate Card, Makao Macau Pass detayları ek aramayla teyit edilemedi.

### Güneydoğu Asya

- Grab-GoTo birleşmesi: 2026 ortası itibarıyla imzalı anlaşma görülmedi; Danantara 'olumlu sinyal' diyor. İki uygulama ayrı çalışıyor. Birleşme olursa ID'deki Gojek ve SG'deki Gojek etkilenir.
- Bolt Vietnam: 2025'te lisans başvurusu ve HCMC işe alımı haberleri var, ama bolt.eu şehir listesinde Vietnam yok.
- Robinhood (TH yemek): 2024'te Yip In Tsoi'ye satıldı; bir Thai kaynak 2025 ortasında kapandığını söylüyor, doğrulanamadı; listeye konmadı.
- Grab Myanmar: grab.com/mm sitesi ve Yangon ofis adresi yayında, ama 2021 sonrası haber yok; GrabFood MM durumu bilinmiyor.
- Kamboçya ve Laos'ta baskın mesajlaşma (Telegram/WhatsApp) WebSearch bütçesi bittiği için kaynaklı teyit edilemedi.
- foodpanda: KH, LA, MM, MY, SG, PH siteleri 2026-10'da aktif (firecrawl ile kontrol); TH'den Mayıs 2025'te çıktı. Şehir kapsamı ayrıntılı teyit edilmedi.
- Bali'deki 'online taksi yasak' bölgeleri kaynaklı teyit edilemedi (WebSearch bütçesi bitti); yaygın bilinen durum olarak not düşüldü.
- Touch 'n Go eWallet ve GCash'in yabancı turist kaydı (yabancı numara/pasaport) 2026 koşulları teyit edilemedi.
- inDrive yalnız TH için teyit edildi; MY/ID/PH kapsamı indrive.com 403/404 verdiği için kontrol edilemedi.
- Bazı iOS ID'leri (PassApp, Bakong Tourists, Vexere, ShopeeFood VN, TrueMoney, CDG Zig, Touch 'n Go, MyTransport.SG, Move It, 2GO, MMBusTicket) iTunes search 403/429 nedeniyle bulunamadı; boş bırakıldı.

### Güney Asya, Orta Doğu

- Swiggy'nin uluslararası giriş listesinde (27 ülke) Türkiye var mı?
- IRCTC 2026'da yabancı numaraya OTP gönderiyor mu, yoksa yalnız e-posta mı?
- Pakistan PTA yabancı telefon süresi (turist muafiyeti) güncel değil, doğrulanmadı.
- Keeta Kuveyt ve Bahreyn'de açıldı mı? (Yalnız SA 2024, QA Ağu 2025, AE Eyl 2025 doğrulandı.)
- Deliveroo Kuveyt'te 2026'da hâlâ çalışıyor mu? (Wikipedia ülke listesinde yok.)
- Katar'da WhatsApp/FaceTime arama kısıtı 2026'da sürüyor mu? Resmi kaynak yok.
- Careem'in Irak'taki şehirleri (Bağdat/Erbil/Basra) ve Baly'nin kapsamı doğrulanmadı.
- Suriye (2024 sonrası), Yemen, Filistin için ride-hailing verisi bulunamadı; WebSearch kotası tükendiği için derinleştirilemedi.
- Yango Umman/Irak/Katar'da var mı doğrulanmadı.

### Kuzey, Doğu, Güney Afrika

- Heetch Fas'ta hâlâ çalışıyor mu? Ekim 2026 Play açıklaması Fas'ı saymıyor, Nomada sayıyor.
- Careem Fas'ta: Uber dönüşünde kullanıcılar Uber'e taşındı haberi var, ama Careem Fas sürüş şartları ve rehberler hâlâ aktif diyor.
- Tunus'ta devlet destekli araç çağırma uygulaması çıktı mı; Heetch Tunus durumu.
- Yango Cezayir: Ağustos 2024 çıkış haberi ile Eylül 2026 rehberi çelişiyor.
- Mısır ENR uygulaması yabancılara bilet satıyor mu (Seat61: hayır, 2026 tarihli resmi teyit yok); Swvl Mısır 2026 durumu.
- Kenya SGR (Madaraka Express) için resmi mobil uygulama var mı; yalnız web doğrulandı.
- Tanzanya TRC SGR biletinin Safari Tiketi içinden alınıp alınmadığı netleşmedi.
- Güney Afrika SARS Traveller Management System (SATMS) uygulaması giriş/çıkışta zorunlu mu? Bento 'zorunlu' diyor, SARS sayfası beyanı gönüllü gösteriyor; listeye alınmadı.
- Malavi, Zambiya (inDrive), Zimbabve (Vaya) ve Libya uygulamaları için 2025-26 tarihli bağımsız kaynak bulunamadı.
- Tunus ve Madagaskar'da baskın mesajlaşma WhatsApp mı Messenger mı, doğrulanamadı.

### Batı ve Orta Afrika

- Bolt Angola'da gerçekten çalışıyor mu? Resmi şehir listesinde yok, tek ikincil kaynak var; Uber doğrulanamadı
- inDrive Kamerun/Senegal/DRC/Angola'da çalışıyor mu? Yalnız yatırım kaydı bulundu, hizmet teyit yok
- Yassir Fildişi Sahili'nde hâlâ var mı? yassir.com bölge listesinde yalnız Senegal (SSA) görünüyor
- Wave Gambiya/Mali/Burkina dışında (Kamerun, DRC, Gine, Nijer, Sierra Leone) başladı mı? Kariyer sayfasında ofis var, lansman teyit yok
- TER Dakar resmi mobil uygulaması var mı; AIBD uzantısı tarihi tek haberle (28 Eylül 2026)
- Cabo Verde feribot: resmi uygulama var mı (web bilet doğrulandı)
- Camrail, Sitarail, Angola CFB yolcu hizmeti ve bilet kanalı
- Orange Max it iOS mağaza ID'leri (SN, CI, GN, GW, SL, LR, CF) doğrulanamadı
- Mobil para (MTN MoMo, Orange Money, M-Pesa) için turistlerin pasaportla kayıt olup olamayacağı

### Amerikalar

- Tren Maya'nın resmi mobil uygulaması var mı? trenmaya.gob.mx'te yalnızca web satışı görüldü.
- Pix: yabancı turistin CPF'siz kullanabileceği güvenilir bir uygulama (ör. WanderWallet, PagBrasil Pix Roaming ortakları) 2026'da yaygın mı? Doğrulanmadı, listeye eklenmedi.
- Mercado Pago'da yabancı pasaportla hesap açıp QR ödeme yapılabiliyor mu (Arjantin)?
- PeruRail / Inca Rail resmi uygulamaları bulunamadı (paket tahminleri 404); sadece web.
- Bajanda (Küba) 2026'da çalışıyor mu? Site yanıt vermedi. La Nave iOS app id'si bulunamadı (sitede sadece geliştirici sayfası linki).
- Ridery (Venezuela) mağaza linkleri bulunamadı.
- Greyhound iOS id, SUBE iOS id, PedidosYa iOS id, MUV iOS id bulunamadı: iTunes search uç noktası 429 verdiği için ad ile arama yapılamadı, sadece bundle/id lookup kullanıldı.
- Uber Eats ubereats.com/ar 200 döndü ama genel başlıkla; Arjantin'de aktif olduğu doğrulanmadı, listeye eklenmedi.
- inDrive Venezuela/Uruguay/Kanada sayfaları 404; bu ülkelerde olmadığı varsayıldı.
- Yango'nun Bolivya/Peru varlığı kontrol edilemedi.
- WebSearch bütçesi araştırma ortasında bitti; bazı notlar (Punta Cana taksi sendikası, Kosta Rika gri alan, Arjantin temassız ödeme, Küba ETECSA) genel bilgiye dayanıyor, 2026 kaynağıyla teyit edilmedi.

### Okyanusya ve Karayipler

- WebSearch bütçesi (200/tur, ortak) bitti; Fiji, SB, KI, TV, NR, FM, MH, PW, GD, VC, AG, DM, KN için hiç ülke-özel araştırma yapılamadı.
- iTunes search endpoint'i NZ araştırması sırasında 403 verdi: AT Mobile, Metlink, YourRide, DoorDash/Uber Eats NZ ve Bluebridge/Interislander için mağaza linkleri alınamadı (paket adı tahminleri 404).
- 13cabs, Translink (QLD), PARK'nPAY, V/Line için Android paket adları doğrulanamadı.
- Bolt Avustralya'da gerçekten çalışıyor mu (tek ikincil kaynak 8 şehir diyor); DiDi AU'nun 2026 şehir sayısı (28) ikincil kaynaktan.
- Shebah AU 2026'da hâlâ aktif mi.
- Trinidad ve Tobago'da Uber'in 2026 durumu ve Drop'un yasal statüsü; Jamaika araç çağırma yasası.
- Avustralya'da yerliler hangi mesajlaşma uygulamasını baskın kullanıyor (WhatsApp kaynaksız eklendi).
- NZ'de Uber Eats'in 2026'da aktif olduğu doğrudan teyit edilemedi (yalnızca NZ Herald başlığı).

### Niyet tablosu

- AllTrails ve komoot için offline haritanın hangi ücretli planda olduğu resmi sayfalardan okunamadı (sayfa JS ile yükleniyor). Gaia GPS (Premium) ve Wikiloc (navigasyon Premium, offline harita ücretsiz) resmi sayfadan doğrulandı.
- Çin yerel yürüyüş uygulamaları (两步路 2bulu, 六只脚 foooooot): sitelerden mağaza linki çıkmadı, tahmin edilen paketler 404. Eklenmedi.
- Kore: Tranggle doğrulanamadı. Ramblr (Bientus Inc.) mağazada var, ama Kore odaklı olduğu doğrulanmadı; eklenmedi.
- Yeni Zelanda: DOC'un genel bir uygulaması ve 'NZ Topo' uygulaması doğrulanamadı; sadece Plan My Walk (NZ Mountain Safety Council) eklendi.
- Android linki eksik: UT.no, Recreation.gov, Savvy Navvy, Sky Guide (muhtemelen sadece iOS). iOS linki eksik: onX Backcountry. Navionics'in iki linki de eksik.
- swisstopo uygulaması, Ikon/Epic sezon kartı uygulamaları, Windguru, MySSI (SSI dalış), Shotgun kontrol edilemedi.
- Çin'de Batı outdoor uygulamalarının (AllTrails, komoot, Waze) çalışıp çalışmadığı bu oturumda kaynakla doğrulanmadı; notlar temkinli yazıldı.
