# Trip Radar

Kişisel seyahat karar panosu. Gezerken gördüğün otel, uçuş, etkinlik ve eSIM sayfalarını tek tıkla
kaydedersin. AI her kaydı okur, doğru geziye ve kategoriye koyar, seçenekleri karşılaştırır.
Sohbetle birlikte karar verirsiniz.

> Kişisel sürüm (v0): sunucu yok. Her şey Chrome eklentisinin içinde çalışır. Veriler yalnız bu
> tarayıcıda (IndexedDB) durur.

## Kurulum (5 dakika)

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
4. **API anahtarını ekle:**
   - Trip Radar simgesine tıkla → **Ayarları aç**.
   - [console.anthropic.com](https://console.anthropic.com) → API Keys'ten aldığın anahtarı yapıştır.

Kodu güncellediğinde `npm run build` çalıştır, sonra `chrome://extensions`'ta Trip Radar'ın ↻ simgesine bas.

## Kullanım

| Ne yapıyorsun | Ne oluyor |
|---|---|
| Bir sayfadayken simgeye tıkla (ya da **Alt+Shift+S**) | Link, sayfanın tüm yazısı, sayfadaki düzenli veri ve ekranın görüntüsü birlikte kaydedilir. AI arkada işler. |
| Panoda kutuya **link yapıştır** | Linkten tarih/kişi okunur. Ayrıntı için sayfayı açıp simgeye tıkla. |
| Panoya **ekran görüntüsü sürükle/yapıştır** | Telefondan attığın ekran görüntüleri de işlenir. |
| Sohbete yaz | "Merkezi olsun, bütçe €1500", "Hangisi daha iyi?", "Casa Azul'u ele", "Jardim'i rezerve ettim" gibi. |
| Satıra tıkla | Fiyatın bağlamı (tarih, kişi, oda, iptal), kaynağı, karşılaştırma, orijinal link. |

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

## Maliyet

Varsayılan model `claude-opus-5`. Kayıt başına kabaca birkaç sent tutar; sayfa ne kadar uzunsa o kadar
artar. Ayarlardan daha ucuz bir modele (`claude-sonnet-5`, `claude-haiku-4-5`) geçebilirsin.

## Geliştirme

```bash
npm run typecheck      # TypeScript
npm test               # birim + akış testleri (sahte API ile)
npm run build && xvfb-run -a node scripts/e2e.mjs   # eklentiyi Chromium'da yükleyip test eder, ekran görüntüleri e2e-output/
```

Yapı:
- `src/lib/url.ts`: linkten sağlayıcı, ilan kimliği, tarih ve kişi sayısı.
- `src/lib/pagecapture.ts`: tıklanınca sayfada çalışır; yazı, görünen kısım, JSON-LD ve meta verisini toplar.
- `src/lib/extract.ts`: AI çıkarımı (yapılandırılmış çıktı, alıntı zorunlu).
- `src/lib/evidence.ts`: alıntı doğrulama.
- `src/lib/items.ts`: kart oluşturma, tekrar birleştirme, gruplama, etiketler, rota.
- `src/lib/process.ts`: kayıt kuyruğu (arka planda çalışır).
- `src/lib/assistant.ts`: sohbet ve plan güncelleyen araçlar.
- `src/app/`: pano arayüzü. `src/popup.tsx`: eklenti açılır penceresi.

Plan ve sonraki adımlar: [PLAN.md](PLAN.md)
