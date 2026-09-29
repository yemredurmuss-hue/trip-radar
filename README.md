# Trip Radar

Kişisel seyahat karar panosu. Gezerken gördüğün otel, uçuş, etkinlik ve eSIM sayfalarını tek tıkla
kaydedersin. AI her kaydı okur, doğru geziye ve kategoriye koyar, seçenekleri karşılaştırır.
Sohbetle birlikte karar verirsiniz.

> Kişisel sürüm (v0): sunucu yok. Her şey Chrome eklentisinin içinde çalışır. Veriler yalnız bu
> tarayıcıda (IndexedDB) durur.

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

**Konaklama gece gece planlanır.** Gezinin geceleri (onaylı tarihler, yoksa uçuşlar ve konaklamalar)
sırayla gösterilir: **✓ Rezerve**, **Seçildi**, **Açık** (bu gecelere uyan seçeneklerle) ya da **Boş**
(Booking'de o tarihlerle arama linkiyle). Bir yeri rezerve edince aynı geceleri isteyen diğer seçenekler
**Kapanan seçenekler**e geçer; silinmez, rezervasyonu geri alırsan geri gelir. Seçilen/rezerve edilen iki
konaklama arasında şehir değişiyorsa ve o gün uçuş/ulaşım yoksa "Porto → Funchal ulaşımı yok" uyarısı çıkar.
Konaklamalar yalnız aynı gecelere ait olanlarla karşılaştırılır. Her konuda başka bir seçenek her açıdan
(fiyat dahil) daha iyiyse satırda "Elenebilir" yazar.

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

## Karar zekası: puan nasıl çıkıyor?

Aynı ihtiyaç için kaydettiğin seçenekler (ör. Porto'da 3 gece) 0–100 arası puanlanır. Puanı **kod** hesaplar,
aynı bilgiyle hep aynı sonucu verir ve her sayısı açıklanabilir:

1. **Ölçüm:** Her seçenek için kriterler sayfadan okunur. Konaklamada fiyat (toplam, gerekirse kurla €'ya
   çevrilir), konum, puan/yorum, konfor/temizlik alt puanları, iptal esnekliği ve istediğin olanaklar
   ölçülür. Uçuşta fiyat, süre, aktarma, saatler ve bagaj; eSIM'de fiyat, veri ve geçerlilik süresi.
2. **Konum:** Otelden, gezide kaydettiğin yerlere (müze, restoran…) tipik yürüme süresi hesaplanır.
   Yer kaydetmediysen şehir merkezine uzaklık kullanılır. Adresler OpenStreetMap ile ücretsiz konuma çevrilir.
3. **Adil puan:** Az yorumlu yüksek puan temkinli sayılır (96 yorumla 4,9 ≠ 1.200 yorumla 8,9). Airbnb'nin
   5'lik puanları Booking ölçeğine göre ayarlanır (4,8 ≈ 8,5).
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
6. **Artılar ve eksiler:** Her kaydın altında solda artılar, sağda eksiler önem sırasıyla durur. Bir seçenek
   elendiyse sebebi en üstte kırmızıyla yazar. Detayda her bulgunun "Kanıt"ı (yorum alıntısı ve tarihi)
   açılır; eksilerde "Sorun değil" dersen o bulgu bu yer için artık aleyhine sayılmaz ve asistan bunu öğrenir.
7. **AI değerlendirmesi ve eleme:** AI bulguları, sayıları ve tercihlerini okuyup kararı yazar. Bir
   bulgu senin için bir seçeneği anlamsız kılıyorsa (sessizlik istiyorsun + yan binada inşaat) eler.
   - Eleme hangi bulguya dayandığını söylemek zorunda. Kod, bulgunun sayfada doğrulandığını ve eski
     olmadığını kontrol eder; tutmayan eleme "Kontrol gerekiyor" olarak kalır, karar vermez.
   - Eleme, dayandığı bulgular durdukça geçerlidir; yeni bir seçenek eklenince kaybolmaz.
   - AI'ya ulaşılamazsa son iyi yorumu tarihiyle görünür kalır.
8. **Eksik bilgi durdurmaz:** Fiyatı henüz bilinmeyen seçenek bilinenlerle geçici puan alır ve tam
   bilgili seçeneklerin arkasında sıralanır ("fiyat eksik, gelince yeniden tartılır"). Fark 2 puandan
   azsa "başa baş" denir. Farklı tarih için alınmış fiyat karşılaştırmaya girmez.

9. **Karar kartı ("değer mi?"):** Her açık ihtiyacın altında "Senin için: X" kartı çıkar. Önerilen seçenek
   en iyi daha ucuz alternatifle tartılır ve fark somut birimle yazılır ("€45 fazlasına her yolda ~37 dk
   daha yakın; 3 gecede ~4 saat, saat başı ~€12"). Kartta ayrıca şunlar yer alır: hangi önceliğin bunu
   değerli kıldığı, "Ama konum o kadar önemli değilse Casa Azul: €45 cebinde kalır" ve seçimle kalan bütçe.
10. **Seni böyle anladım:** Söylediklerin (önem, kesin şart, not) ve sezilenler burada kaynağıyla durur.
   Sezilenler iki kaynaktan gelir:
   - Kaydettiklerindeki kalıp: "5 konaklamadan 4'ü ücretsiz iptalli".
   - Motorun önerisinden farklı seçimlerin: "Seçimin Casa Azul, Jardim yerine: €45 daha ucuz".

   Bir sezgi varsayılanı en fazla bir kademe kaydırır ve senin söylediğini asla ezmez. × ile kaldırılır ya
   da yok sayılır.
11. **Kesin şartlar:** "Mutfak şart", "iadesiz olmasın", "direkt uçuş", "merkeze en fazla 15 dk"
   sohbetten kaydedilir. Şarta uymayan seçenek önerilmez. Sayfada görünmeyen bir olanak "yok" sayılmaz,
   "kontrol et" diye yazılır.

Son karar senin: "Plana al" ile seçersin; sistem yalnız nedenleriyle gösterir.

## Doğruluk kuralları

- AI fiyat, puan ve iptal koşulu için sayfadan **birebir alıntı** vermek zorunda. Alıntı sayfada yoksa
  bilgi "doğrulanmadı" diye işaretlenir.
- Bilinmeyen bilgi tahmin edilmez, boş kalır. Detayda "Eksik bilgi" olarak görünür.
- Farklı tarih ya da kişi sayısı için alınmış fiyatlar karşılaştırılmaz; satırda "Farklı tarih" uyarısı çıkar.
- Fiyatın ne zaman görüldüğü tutulur; eskiyen fiyat için uyarı çıkar (konaklamada 3 gün, uçuşta 1 gün).
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
