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
Bundan sonra yeni sürümler saatte bir kendiliğinden iner. Pano kapalıysa eklenti kendini yeniler;
açıksa sağ altta **Yeni sürüm hazır → Şimdi güncelle** çıkar. Kapatmak için:
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
| Satıra tıkla | Fiyatın bağlamı (tarih, kişi, oda, iptal), kaynağı, karşılaştırma, orijinal link. |

**Her gezi ayrı bir pano ve sohbettir.** Açılışta **Seyahatlerim** listesi gelir; bir geziye girince
solda o gezinin kendi sohbeti, sağda panosu olur. **‹ Seyahatlerim** ile listeye dönülür.

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

## Doğruluk kuralları

- AI fiyat, puan ve iptal koşulu için sayfadan **birebir alıntı** vermek zorunda. Alıntı sayfada yoksa
  bilgi "doğrulanmadı" diye işaretlenir.
- Bilinmeyen bilgi tahmin edilmez, boş kalır. Detayda "Eksik bilgi" olarak görünür.
- Farklı tarih ya da kişi sayısı için alınmış fiyatlar karşılaştırılmaz; satırda "Farklı tarih" uyarısı çıkar.
- Fiyatın ne zaman görüldüğü tutulur; eskiyen fiyat için uyarı çıkar (konaklamada 3 gün, uçuşta 1 gün).

## Sağlayıcı ve maliyet

| | Gemini (varsayılan) | Claude |
|---|---|---|
| Ücret | Ücretsiz katman (günlük istek sınırı var) | Kullandıkça ödeme; kayıt başına birkaç sent |
| Gizlilik | Ücretsiz katmanda Google içeriği ürün geliştirmede kullanabilir, insanlar okuyabilir | İçerik model eğitiminde kullanılmaz |
| Sınır dolunca | Kayıt "Tekrar dene" ile sonra işlenir | — |

Her kayıt 1 istek, her sohbet mesajı 1–3 istektir. Sağlayıcı değiştirince sohbet yeni bağlamla başlar;
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
