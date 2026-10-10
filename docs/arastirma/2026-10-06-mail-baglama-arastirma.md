# Mail bağlama (Gmail / Outlook) araştırması

Tarih: 2026-10-06 · Kapsam: Trip Radar'a "posta kutunu bir kez bağla, rezervasyonlar kendiliğinden gezine düşsün" özelliği.
Kod yazılmadı; bu bir karar belgesi. Kaynağı olmayan cümleler tasarım önerisi ya da tahmindir, öyle işaretlendi.

## 10 satırda özet

1. Gmail'de mail gövdesini okumak için gereken her kapsam (`gmail.readonly`, `gmail.metadata`) **"restricted"**. Herkese açık bir ürün için Google doğrulaması + **her yıl yenilenen CASA güvenlik denetimi** şart.
2. CASA Tier 2 bağımsız laboratuvarda yaklaşık **540-1.800 $ / yıl**; doğrulama toplamda kabaca **1-3 ay** sürüyor (bunlar satıcı ve kullanıcı anlatımları, Google'ın resmî süresi yok).
3. "Mail cihazda işleniyor, sunucuya gitmiyor" istisnası **bizim için geçerli değil**: mail parçası Gemini/Anthropic'e (üçüncü taraf sunucu) gidiyor. Google'ın kendi metni "sunucuya aktarırsan denetim zorunlu" diyor.
4. İyi haber: Google'ın politikası **"seyahat planını otomatik çıkaran uygulamaları"** Gmail restricted kapsamı için açıkça izinli kullanım sayıyor. Yani onay alınabilir bir iş.
5. Doğrulamasız yol bugün açık: **"Testing" modunda en fazla 100 test kullanıcısı**. Bedeli: her kullanıcı uyarı ekranı görür ve **izni 7 günde bir düşer**, haftada bir yeniden bağlanmak gerekir.
6. Outlook (Microsoft Graph `Mail.Read`) çok daha hafif: CASA yok, yönetici onayı gerekmiyor; iş hesapları için ücretsiz "publisher verification" yeterli.
7. Rezervasyon bulmada en sağlam yol: önce mailin içindeki **schema.org JSON-LD/Microdata** (Booking.com, Airbnb, Lufthansa, Trainline, Europcar'da kanıtlı), yoksa mevcut `docReader` ile LLM, PDF ek varsa onu da `docReader`'a.
8. Nylas/Unipile gibi aracılar CASA yükünü kendi onaylı projeleriyle taşıyabiliyor ama ayda 49-55 $'dan başlıyor, kullanıcının maili onların sunucusundan geçiyor ve izin ekranında onların adı çıkıyor. Ücretsiz ürün için pahalı ve gizlilik hikâyesini bozuyor.
9. Gerçek zamanlı push (Gmail `watch` + Pub/Sub) sunucuda token tutmayı gerektiriyor; seyahat rezervasyonu için 15-30 dakikalık yoklama yeterli. **Faz 2'yi şimdilik yapma.**
10. Öneri: **Faz 0 = Gmail Testing modunda kapalı beta (≤100 kişi) + Outlook kişisel hesaplar**, eş zamanlı olarak alan adı ve gizlilik politikasını hazırla; 20-30 gerçek kullanıcı "bu işe yarıyor" derse **Faz 1 = CASA'ya para ver.** Fikrin değeri 8/10, bugünkü uygulanabilirliği 5/10 (engel teknik değil, para ve evrak).

---

## 1. Gmail API erişimi

**Restricted ne demek.** Google'ın Gmail kapsam listesinde `gmail.readonly` ("e-postalarını ve ayarlarını gör") ve `gmail.metadata` ("başlıklar, gövde değil") ikisi de restricted. Aynı sayfanın dipnotu: "If you store restricted scope data on servers (or transmit), then you must go through a security assessment." ([Gmail kapsamları](https://developers.google.com/workspace/gmail/api/auth/scopes))

**Doğrulama ve CASA.** İstisnaya girmeyen uygulama "annual security assessment from an independent, third-party assessor" geçmek zorunda; "at least every 12 months" yeniden denetlenir. ([Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Security Assessment yardım sayfası](https://support.google.com/cloud/answer/13465431?hl=en))
- Tier ve fiyat: Gmail için tipik olan Tier 2. TAC Security Tier 2 planları 540-1.800 $, Tier 3 4.500 $ ([DeepStrike rehberi](https://deepstrike.io/blog/google-casa-security-assessment-2025), [TAC Security](https://tacsecurity.com/google-casa-cloud-application-security-assessment/)). Tier'ı Google belirler; biz seçmiyoruz.
- Süre: bir ekip TAC ile 540 $ ve ~1 ayda geçtiğini yazıyor ([Orbis](https://meetorbis.com/blog/how-we-passed-google-casa-tier-2-with-claude), [Reddit deneyimi](https://www.reddit.com/r/googlecloud/comments/1i1dgtm/our_experience_with_google_casa_tier_2/)); Unipile "kendin yaparsan 6-12 hafta" diyor ama aracı sattığı için abartıyor olabilir ([Unipile](https://www.unipile.com/integrating-google-oauth-2-0-user-authentication-into-your-app/)). **Emin değilim**; 1-3 ay gerçekçi aralık.

**İzinli kullanım.** Google Workspace politikası restricted Gmail için izinli türleri sayıyor; biri aynen bizim iş: "applications that automate travel itineraries or track flights or package delivery statuses". ([Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)) Yani reddedilme riski kapsam yüzünden değil, evrak/güvenlik eksikliğinden gelir.

**Testing modu (doğrulamasız).** "Projects configured with a publishing status of Testing are limited to up to 100 test users"; test kullanıcılarının izni "will expire seven days from the time of consent", refresh token da düşer. Doğrulamasız uygulamada ömür boyu 100 yeni kullanıcı sınırı var ve sıfırlanmıyor. ([Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en), [OAuth 2.0 token süreleri](https://developers.google.com/identity/protocols/oauth2))

**Cihazda işleme istisnası.** Resmî metinler çelişkili: kapsam sayfası "store on servers (or transmit)" derken doğrulama sayfası "has the ability to access data from or through a third-party server" diyor; yardım sayfasında hiç koşul yok. Bunu soran geliştiricilerin forum soruları Google'dan yanıt almamış ([Eylül 2026 sorusu](https://discuss.google.dev/t/gmail-restricted-scope-is-the-casa-assessment-required-when-mail-is-processed-on-device-and-only-a-derived-subscription-list-reaches-our-server/398372), [Mart 2026 sorusu](https://discuss.google.dev/t/is-casa-required-for-all-access-restricted-scopes/340650)). Bizim durumda tartışma bile gereksiz: mail metni LLM'e (Google/Anthropic sunucusu) ve davetli kullanıcıda Mumbai'deki AI kapısına gidiyor. Bu "transmit". **Sonuç: istisnaya güvenme.**

**Daha dar kapsam var mı?**
- `gmail.metadata`: hem restricted hem de `q=` aramasına izin vermiyor: "Parameter cannot be used when accessing the api using the gmail.metadata scope." ([messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)) İşe yaramaz.
- `gmail.addons.current.message.*`: restricted değil, ama yalnız kullanıcı Gmail'de o maili açtığında çalışan bir Workspace eklentisi için ([kapsam listesi](https://developers.google.com/workspace/gmail/api/auth/scopes)). Arka planda tarama yok, geçmişi arama yok, ayrı bir ürün ve ayrı yayın süreci. Hedefe uymuyor.
- `gmail.labels` restricted değil ama mail okutmaz. Kısacası: **arama + gövde okuma için `gmail.readonly` tek gerçek seçenek.**

## 2. Chrome eklentisine özgü konular

**getAuthToken mı, launchWebAuthFlow mu?** `chrome.identity.getAuthToken` Chrome'a giriş yapmış hesapla çalışır, token'ı Chrome kendisi saklar ve yeniler; ama yalnız Chrome'da (Brave/Edge'de değil) ve Chrome profilindeki hesapla. `launchWebAuthFlow` herhangi bir sağlayıcıyla `https://<eklenti-id>.chromiumapp.org/` dönüşüyle çalışır; refresh token'ı kendin yönetirsin. ([chrome.identity](https://developer.chrome.com/docs/extensions/reference/api/identity)) Öneri (tasarım): Gmail için `getAuthToken`; refresh token hiç bizde durmaz. Outlook için `launchWebAuthFlow` + PKCE zorunlu.

**Chrome Web Store ek şart koyuyor mu?** CWS kendi denetimini yapmaz; Google Cloud doğrulaması ayrı yürür. CWS'nin istediği: `identity` izni ve yeni host izinleri (`gmail.googleapis.com`, `graph.microsoft.com`) için gerekçe, veri kullanım beyanı ve sitede şu tür bir Limited Use cümlesi: "The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements." ([CWS Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use), [CWS veri SSS](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq))

**Arka plan senkronu.** `chrome.alarms` en sık 30 saniyede bir çalışır, cihaz uyurken kaçan alarm uyanınca bir kez tetiklenir ([chrome.alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)). Manifest'te `alarms` zaten var. Tasarım: 15-30 dakikada bir `users.history.list` ile "son bakıştan beri gelenler", Chrome kapalıyken senkron yok, açılınca yetişir. Push (`users.watch`) bir Pub/Sub konusu ister ve en az 7 günde bir yenilenmelidir ([Gmail push](https://developers.google.com/workspace/gmail/api/guides/push)); bildirimi alan sunucunun maili okuyabilmesi için token'ı sunucuda tutması gerekir. Bu hem CASA kapsamını büyütür hem altyapı ekler. Seyahat maili için dakikalık tazelik gerekmiyor.

## 3. Outlook / Microsoft Graph

- `Mail.Read` delege izni: "AdminConsentRequired: No", hem kişisel (outlook.com/hotmail) hem iş hesaplarında geçerli. ([Graph izinleri](https://learn.microsoft.com/en-us/graph/permissions-reference))
- Publisher verification: 8 Kasım 2020 sonrası kaydedilen, başka kiracılardaki kullanıcılardan temel profil dışı izin isteyen uygulamalara uygulanır; doğrulanmamışsa iş hesaplarının çoğunda kullanıcı onay veremez. Ücretsiz; Microsoft AI Cloud Partner Program hesabı ve doğrulanmış alan adı ister. ([Publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)) Kişisel hesaplarda doğrulanmamış uygulamanın "unverified" etiketiyle çalıştığını düşünüyorum, **ama test edilmeli**. Bireysel geliştiricinin MCPP doğrulamasından geçip geçemeyeceğinden **emin değilim**.
- Webhook vs delta: Outlook mesaj aboneliği en fazla 10.080 dakika (7 gün) yaşar ve herkese açık bir HTTPS uç noktası ister ([abonelik ömrü](https://learn.microsoft.com/en-us/graph/change-notifications-overview)). Eklenti için delta sorgusunu alarmla yoklamak daha basit.
- CASA benzeri zorunlu bir denetim Microsoft tarafında yok. Outlook Türkiye'de Gmail kadar yaygın değil; bu yüzden "önce Outlook" teknik olarak kolay ama kullanıcı etkisi küçük.

## 4. Rezervasyonu güvenilir bulmak

**Schema.org işareti.** Gmail kartları `FlightReservation`, `LodgingReservation` vb. JSON-LD/Microdata ile beslenir ([Gmail markup](https://developers.google.com/workspace/gmail/markup/reference/flight-reservation)). Kimin gerçekten koyduğuna dair en iyi açık kanıt KDE Itinerary'nin sağlayıcı tablosu ([KItinerary Supported Providers](https://community.kde.org/KDE_PIM/KItinerary/Supported_Providers)):

| Gönderen | Mailde yapılı veri |
|---|---|
| Booking.com | JSON-LD, bazen yalnız HTML |
| Airbnb, Trainline, Europcar | JSON-LD |
| Hotels.com | JSON-LD (saatler hatalı, düzeltme gerekiyor) |
| Lufthansa | Microdata (onay + biniş kartı) |
| KLM | Onay HTML + PDF; biniş kartı Microdata |
| Expedia, Hertz | Yapılı veri yok |
| Turkish Airlines, Pegasus, GetYourGuide | Tabloda yok, **bilinmiyor** |

THY/Pegasus için kendi gelen kutusundan birkaç örnek bakılmadan bir şey söylemiyorum.

**Tasarım (kaynak değil, öneri):**
1. Arama: `q=` ile gönderen alan adları (`from:(klm.com OR booking.com OR thy.com OR flypgs.com OR airbnb.com ...)`) VEYA konu kelimeleri (`subject:(rezervasyon OR onay OR "e-bilet" OR booking OR confirmation OR itinerary OR "boarding pass")`), `newer_than:365d`, `-category:promotions`. Liste tamamen cihazda.
2. Sıra: JSON-LD/Microdata varsa LLM'siz çöz. Yoksa yalnız o tek mailin metninden kırpılmış parça `docReader`'a. PDF eki varsa `users.messages.attachments.get` ile indirip `docReader`'a (zaten PDF okuyor).
3. Dedupe: `docReader`'daki mevcut eşleştirme (aynı tür + tarih/rota/sağlayıcı) + Gmail `messageId` ve rezervasyon kodu kaydı.
4. Geziye eşleme: tarih aralığı + şehir örtüşüyorsa otomatik; iki gezi aday ya da hiçbiri yoksa kart "Gelen kutusundan" rafına düşer ve kullanıcıya sorulur. "KLM'yi 7 gün önce aldım, bul" isteği aynı aramanın sohbetten tetiklenmiş hali.

## 5. Gizlilik ve güvenlik

- **Token:** Gmail'de Chrome'un kendi önbelleği; bizim depomuzda refresh token yok. Outlook'ta `chrome.storage.local`'da, sunucuya hiç gitmez.
- **Ne dışarı çıkar:** yalnız eşleşen tek mailin kırpılmış metni ya da PDF'i, yalnız LLM'e. Gelen kutusu listesi, diğer mailler, adres defteri hiç çıkmaz.
- **Kritik engel:** Google'ın kuralı insan okumasını ve kullanıcının kendi modeli dışında yapay zekâ eğitimini yasaklıyor ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), [Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Bizim PRIVACY.md'miz Gemini ücretsiz katmanında içeriğin ürün geliştirmede kullanılabileceğini ve insanlarca okunabileceğini zaten yazıyor ([Gemini API koşulları](https://ai.google.dev/gemini-api/terms)). **Gmail verisi ücretsiz Gemini anahtarına gönderilemez**; yalnız ücretli katman ya da Anthropic.
- **Bağlantıyı kesme:** "Bağlantıyı kes" düğmesi token'ı iptal eder ve önbelleği siler (`removeCachedAuthToken` + Google revoke uç noktası); kullanıcıya myaccount.google.com/permissions bağlantısı verilir.
- **GDPR/KVKK:** dayanak açık rıza (ayrı onay ekranı). KVKK 9. madde Haziran 2024'ten beri yurt dışı aktarımda standart sözleşme + imzadan sonra 5 iş günü içinde Kurum'a bildirim istiyor ([KVKK yurt dışı aktarım](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim), [standart sözleşme duyurusu](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)). Bu zaten mevcut Gemini/Anthropic/Supabase aktarımları için de açık bir soru; mail eklenince ağırlaşır. **Hukukçu değilim; bir KVKK avukatına 1 saatlik danışma öneririm.**
- **PRIVACY.md'ye eklenecek:** hangi kapsam, hangi mailler (arama filtresi), LLM'e giden parça, saklanmayanlar (ham mail, mail listesi), saklananlar (kart + messageId), kesme yolu ve Google'ın Limited Use cümlesi. Layla'nın metni iyi bir örnek ([Layla gizlilik](https://layla.ai/privacypolicy)).

## 6. Alternatifler ve maliyet

- **IMAP + uygulama şifresi:** kullanıcıdan şifre benzeri bir sırrı eklentiye yazmasını istemek demek; bunu bizim saklamamız gerekir, kapsam daraltılamaz (tüm posta kutusu), Google bu yolu adım adım kısıtlıyor. Güven kaybı ve risk büyük. Önerilmez.
- **Nylas:** ücretsiz 5 hesap, Essentials 15 $/ay, Pro 49 $/ay + hesap başı 1,75-2 $ ([Nylas fiyat](https://www.nylas.com/pricing/)). "Google Shared App" ile CASA'yı Nylas'ın onaylı projesi taşıyor, ama yalnız yıllık Pro + Accelerator ya da Enterprise'da, ve izin ekranında "Nylas" yazıyor ([Nylas Shared App](https://developer.nylas.com/docs/provider-guides/google/shared-gcp-app/)).
- **Unipile:** 10 hesaba kadar 49 €/ay, sonra hesap başı 3-5 €/ay ([Unipile fiyat](https://www.unipile.com/pricing-api/)); kendi CASA Tier 2 onaylı anahtarını kullandırıyor, sonra kendi anahtarına geçebiliyorsun ([Unipile Gmail](https://www.unipile.com/communication-api/email-api/gmail-api/)).
- **Aurinko:** paylaşılan onaylı uygulama sunmuyor; kendi Google projen ve doğrulaman şart ([Aurinko SSS](https://docs.aurinko.io/faq/does-aurinko-provide-a-shared-verified-google-oauth-application)).
- **"Aracı da senin doğrulanmış projeni ister" iddiası:** Aurinko için doğru; Nylas ve Unipile için yanlış (paylaşılan uygulama var). Ama paylaşılan uygulamada mail aracının sunucusundan geçer.
- **Seyahat ayrıştırıcıları:** AwardWallet Email Parsing API (fiyat yalnız iletişimle) ([AwardWallet](https://awardwallet.com/api/main)); Traxo günde 25 ücretsiz ayrıştırma ([Traxo](https://developer.traxo.com/docs/public-api/7818ce477c33d-email-parsing)). İkisi de maili kendi sunucularına almayı gerektirir ve Gmail erişim yükünü taşımaz. TripIt API rezervasyon ayrıştırma servisi olarak satılmıyor (bulabildiğim kadarıyla). Bizim `docReader` bu işi zaten yapıyor; ihtiyaç yok.

## 7. Rakipler nasıl yapıyor

- **Layla:** Gmail ve Outlook; son 365 gün; "sender and subject filters"; kişisel bilgileri tarayıcıda ayıklıyor, işlemi kendi sunucularında Vertex AI Gemini ile yapıyor; token'ları sunucuda saklamıyor ([Layla gizlilik](https://layla.ai/privacypolicy)). Kapsam adını yazmıyor; "read-only" ifadesinden `gmail.readonly` olduğu **tahminim**. Sunucuda işlediği için CASA'dan geçmiş olmalı.
- **TripIt Inbox Sync:** Gmail, Outlook, Yahoo; OAuth; başlıkları tarayıp seyahat mailinin içeriğini ayrıştırıyor; ilk bağlanışta yalnız son 7 gün; içe aktarma 24 saate kadar sürebilir; yalnız ana gelen kutusu ([TripIt yetkilendirme](https://help.tripit.com/en/support/solutions/articles/103000063336-authorizing-inbox-sync), [TripIt güvenlik](https://help.tripit.com/en/support/solutions/articles/103000063317-inbox-sync-security)).
- **Wanderlog:** yalnız Gmail; "we regularly pass Google's required security reviews" (yıllık CASA) ([Wanderlog SSS](https://wanderlog.com/blog/faq/)); bir rakip karşılaştırması bunun Pro özelliği olduğunu söylüyor ([Soar](https://joinsoar.co/compare/wanderlog), tek kaynak, doğrulanmadı).

Not: TripIt'in "24 saat" ve "7 gün" sınırı, Trip Radar için bir açık: "365 gün + dakikalar içinde" vaadi ayırt edici olabilir.

---

## Fazlı plan

### Faz 0: bu hafta / 2 hafta, doğrulamasız kapalı beta
- **Ne:** Gmail `gmail.readonly` Testing modunda, `getAuthToken`, cihazda arama + JSON-LD + `docReader` yedek, elle "Tara" düğmesi + 30 dk alarm. İsteğe bağlı: Outlook kişisel hesaplar (`Mail.Read`, PKCE).
- **Efor:** 1-2 hafta geliştirme (tahmin).
- **Maliyet:** 0 $.
- **Riskler:** en fazla 100 kişi, ömür boyu; uyarı ekranı güveni düşürür; **7 günde bir yeniden bağlanma**; ücretsiz Gemini anahtarı olan testçiye Gmail özelliğini kapatmak gerekir.
- **Emre'nin işi:** Google Cloud'da proje + OAuth izin ekranı (External, Testing), Chrome Extension tipi OAuth istemcisi, test kullanıcılarının e-postalarını tek tek eklemek; Azure'da uygulama kaydı (Outlook istenirse).

### Faz 1: doğrulanmış Gmail (beta olumluysa)
- **Ne:** Google OAuth doğrulaması + CASA Tier 2.
- **Efor:** Emre için 3-5 gün evrak; geliştirmede güvenlik taramasının bulgularını kapatmak 1-2 hafta (tahmin).
- **Maliyet:** CASA 540-1.800 $/yıl + alan adı ~10-20 $/yıl. Ücretli Gemini/Anthropic çağrıları kullanım kadar.
- **Süre:** 1-3 ay (emin değilim).
- **Riskler:** ret ve yeniden gönderim döngüsü; her yıl yenileme; yeni kapsam eklenirse yeniden denetim.
- **Emre'nin işi:** kendi alan adı (ör. tripradar.app) ve orada ana sayfa + gizlilik politikası; Search Console alan adı doğrulaması; YouTube'da izin akışını gösteren demo video; kapsam gerekçesi metni; CASA laboratuvarı seçip ödeme (TAC en ucuzu görünüyor); KVKK avukat danışması.

### Faz 2: gerçek zamanlı push (şimdilik yapma)
- **Ne:** `users.watch` + Pub/Sub + Supabase uç noktası, ya da Graph webhook.
- **Maliyet:** Pub/Sub küçük ölçekte neredeyse bedava, ama sunucuda token tutmak gerekir; güvenlik denetimi kapsamı ve sorumluluk büyür.
- **Ne zaman:** kullanıcılar "rezervasyon geç düşüyor" diye şikâyet ederse. 30 dk yoklama seyahat için yeterli.

**Atlanmaması gereken dürüst not:** Nylas/Unipile ile Faz 1'i haftalara indirmek mümkün, ama ücretsiz bir ürün için ayda en az 49-55 $ ve "mailin bizim sunucumuza bile gelmez" iddiasının kaybı demek. Kısa süreli köprü olarak bile önermiyorum.
