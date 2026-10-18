# Hero fotoğrafı: daha iyi, ücretsiz kaynak var mı? (2026-10-07)

**Kısa cevap:** Pinterest olmaz. Fotoğrafların "dandik" görünmesinin büyük kısmı sağlayıcıdan değil, bizim kullanımımızdan geliyor (`supabase/functions/city-image/index.ts`): Pexels'e ham yer adını soruyoruz, `per_page=1` ile ilk sonucu körlemesine alıyoruz ve `large2x` kullanıyoruz (940×650 kutusu, DPR 2, `auto=compress&cs=tinysrgb` ile sıkıştırılmış). "Ozora Festival" gibi bir sorguda ilk sonuç rastgele bir kalabalık ya da yakın çekim yüz olabiliyor. Ayrıca sadece fotoğrafçı adını saklıyoruz; Pexels'in istediği "Pexels'e link" bilgisi yok. Mevcut kurulum: **3/10**.

## 1. Pinterest: uygun değil (1/10)
- Herkese açık pinlerde arama yapan API (`/search/partner/pins`) beta aşamasında ve "her uygulamaya açık değil". Normal `/search/pins` yalnızca kullanıcının kendi pinlerinde arıyor. Yeni uygulama önce Trial erişimi alıyor, sonra incelemeden geçiyor.
- Pinterest'in "kabul edilen kullanımlar" listesi reklam, zamanlayıcı ve mağaza araçlarından oluşuyor; "başka bir uygulamaya görsel kaynağı olmak" listede yok. İçerik yayınlanırsa pine geri link verilmesi, üstüne filtre ya da yazı konmaması ve pinden yeni içerik üretilmemesi şart (bir hero tam olarak bunu yapar).
- Asıl engel telif. Pinlerin çoğu başka sitelerden kaydedilmiş fotoğraflar. Pinterest bu fotoğrafların sahibi değil ve bize lisans veremez. "Kaynağı göstermek" telifi çözmez.

## 2. Unsplash API (önerilen ana kaynak)
- **Limit:** demo modda saatte 50 istek, onaylanınca (production) saatte 1000. Görsel dosyası istekleri (`images.unsplash.com`) limitten sayılmıyor. Bazı üçüncü taraf siteler 5000/saat yazıyor ama resmi dokümanda 1000 geçiyor.
- **Onay:** uygulama içinde "Apply for Production" ile yapılıyor; kurallara (aşağıdakiler) uyulduğunu gösteren ekran görüntüsü isteniyor. Onayın ne kadar sürdüğünü doğrulayamadım; bir üçüncü taraf "yavaş ve belirsiz" diyor.
- **Zorunlu kurallar:** (1) Hotlink şart. `photo.urls.*` adresleri doğrudan kullanılıyor, kendi depomuza kopyalamıyoruz; URL'yi ise veritabanında saklayabiliriz. (2) Fotoğraf "header olarak seçildiğinde" `links.download_location` adresine bir GET isteği atılıyor. Bunu, fotoğrafı bir yere seçtiğimiz anda sunucudan bir kez yapmak mantıklı görünüyor ama kullanıcı başına mı yapılması gerektiğinden emin değilim. (3) Fotoğrafçıya ve Unsplash'e, `?utm_source=trip_radar&utm_medium=referral` parametreli linklerle atıf veriliyor. (4) Anahtar gizli kalıyor (mevcut edge function deseni buna uygun).
- **Boyut:** `urls.raw` + `&w=2400&h=1200&fit=crop&crop=entropy&q=80&auto=format`. `ixid` parametresi silinmemeli. Resmi olarak desteklenen parametreler: w, h, crop, fit, fm, auto, q, dpr.
- **Arama:** `per_page` (varsayılan 10, en çok 30), `orientation=landscape`, `content_filter=high`, `order_by=relevant`. Her sonuçta `width`, `height`, `color`, `alt_description`, `likes` alanları geliyor. Bir arama tek istek sayılıyor; 30 sonuç almak da aynı maliyette.
- **2025–2026:** Unsplash Getty'ye ait; `source.unsplash.com` kapatıldı, `unsplash-js` arşivlendi. Mart 2026'da bir rakip blog "API öldü" diye yazdı ama resmi rehberler Temmuz 2026'da güncellenmiş, API çalışıyor. Bu iddiayı taraflı kaynak olarak değerlendirdim.
- **Kalite:** şehir ve manzara çekimlerinde Unsplash daha "dergi" havasında, Pexels daha stok fotoğraf havasında. Bu genel kanı; kendimiz test etmedik.

## 3. Diğerleri
| Kaynak | Ücretsiz mi | Hero kalitesi | Atıf | Limit / kural | Kolaylık |
|---|---|---|---|---|---|
| Pexels | Evet | Orta-iyi (doğru seçilirse) | Pexels'e link + "Photo by X on Pexels" | 200/saat, 20.000/ay; `per_page` en çok 80; `size=large` en az 24 MP | Hazır kodumuz var |
| Pixabay | Evet | Orta; çok HDR/stok | Sonuç gösterilirken kaynak belirtilmesi rica ediliyor | 100 istek/60 sn, 24 saat önbellek zorunlu, **kalıcı hotlink yasak** (kendi depomuza indirmemiz gerekiyor), 1280 px üstü için "full API access" onayı | Orta |
| Google Places Photos | 1000 istek/ay ücretsiz, sonrası 1000 istekte 7 $ | Kullanıcı fotoğrafı, kalitesi değişken | `authorAttributions` zorunlu | **Önbellek yasak**: her gösterim yeni istek ve para | Kötü |
| Wikimedia Commons (Featured/Quality) | Evet | Çok iyi ama kapsamı dar | Yazar + lisans adı (çoğu CC BY-SA) + dosya linki | Açıklayıcı User-Agent gerekli; 2026'dan itibaren yalnızca standart küçük resim boyutları (960/1280/1920/3840) | Orta |
| Openverse | Evet | Karışık (Flickr ve Commons toplayıcısı) | Görsele göre CC atfı | Anonim kullanımda çok düşük, kayıtlı uygulamada daha yüksek; `license_type=commercial` filtresi var | Orta |
| Flickr | API anahtarı için Pro üyelik, ticari anahtar için elle inceleme | Değişken | CC lisansına göre | Onay süreci var | Değmez |

## 4. Öneri
1. **Önce kullanımı düzeltin (bugün yapılabilir, yeni hesap gerekmez):** Pexels'ten `per_page=30&size=large` ile 30 sonuç çekin ve en iyisini seçin. Görsel olarak `src.original + ?auto=compress&cs=tinysrgb&w=2400` kullanın. Bu tek başına farkın büyük kısmını kapatabilir.
2. **Ana kaynak Unsplash, yedek Pexels, son çare Wikimedia Commons Quality images ve ardından Wikipedia.** Etkinlik ve yöre sorgularında ("Ozora", "Kapadokya") önce yerin kendisini ya da ünlü noktasını arayın ("Cappadocia balloons", "Ozora Hungary landscape"). Etkinlik adıyla aramak kalabalık fotoğrafı getiriyor.
3. **N sonuç arasından seçim kuralları:**
   - En-boy oranı 1,4–2,2 arasında, genişlik en az 3000 px olmalı.
   - `alt` ya da `alt_description` içinde person/woman/man/portrait/selfie/food/close-up/interior geçenler elenmeli.
   - Ortalama renk aşırı karanlık ya da aşırı parlaksa (parlaklık <35 veya >215) aday elenmeli; aksi halde üstüne yazılan yazı okunmaz.
   - Kalanlar arasında Unsplash'te `likes` değeri yüksek olan seçilmeli.
   - En çok kullanılan ~50 destinasyon için elle seçilmiş fotoğraf ID'lerinden bir "override" tablosu tutulmalı. En yüksek kaliteyi bu sağlar.
4. **Kaynağın gösterilmesi:** hero'nun sağ alt köşesine küçük, yarı saydam bir yazı: "Fotoğraf: [Ad] / [Unsplash]". İki parça da linkli olmalı (Unsplash'te utm parametreleriyle, Pexels'te fotoğraf sayfasına). Wikimedia için: "Fotoğraf: [Ad], CC BY-SA 4.0 / Wikimedia Commons". Bunun için önbellekte yalnızca `by` değil; `source`, `author_url`, `photo_page`, `license` ve `download_location` alanları da tutulmalı.

## Kaynaklar
- Unsplash: [API dokümanı](https://unsplash.com/documentation) · [API rehberi](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) · [Atıf](https://help.unsplash.com/en/articles/2511315-guideline-attribution) · [Download tetikleme](https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download) · [Hotlink](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images) · [Rakip "API öldü" yazısı](https://okslop.com/blog/unsplash-api-migration)
- Pexels: [API dokümanı](https://www.pexels.com/api/documentation/)
- Pixabay: [API dokümanı](https://pixabay.com/api/docs/)
- Pinterest: [Geliştirici kuralları](https://policy.pinterest.com/en/developer-guidelines) · [search/partner/pins](https://developers.pinterest.com/docs/api/v5/search_partner_pins/) · [Erişim seviyeleri](https://developers.pinterest.com/docs/key-concepts/access-tiers/)
- Google: [Places politikaları](https://developers.google.com/maps/documentation/places/web-service/policies) · [Fiyat özeti (Woosmap)](https://www.woosmap.com/blog/google-places-api-pricing)
- Wikimedia: [Standart küçük resim boyutları](https://www.mediawiki.org/wiki/Common_thumbnail_sizes) · [Robot politikası](https://wikitech.wikimedia.org/wiki/Robot_policy)
- Openverse: [Kimlik doğrulama ve limitler](https://docs.openverse.org/api/reference/authentication_and_throttling.html) · Flickr: [API anahtarları](https://www.flickr.com/services/api/misc.api_keys.html)
