# Rezervasyon maillerini geziye almanın en kolay yolu (2026-10-07)

Kod yazılmadı. Önceki araştırma (Gmail API, `2026-10-06-mail-baglama-arastirma.md`) Google denetimi ve yıllık güvenlik denetimi (CASA) yüzünden ağır bulundu. Burada o kapıdan hiç geçmeyen yollar var. Kaynağı olmayan cümleler tahmin ya da tasarım önerisidir, öyle yazıldı.

## Öneri: her kullanıcıya kendi "mail adresi" (TripIt / Tripsy / Wanderlog modeli) · puan 8/10

**Kullanıcı ne yapar:**
1. Eklentide "Mail adresin" kutusundan kendi adresini kopyalar (ör. `k7x2m9qa@...`).
2. Rezervasyon mailini bu adrese **İlet**ir. Birkaç saniye sonra rezervasyon gezide "onay bekliyor" olarak çıkar.
3. (İsteğe bağlı, tam otomatik) Gmail'de bir kez "yönlendirme adresi" ekler ve bir filtre kurar (ör. `from:(booking.com OR airbnb OR flypgs OR thy ...)` → ilet). Gmail bu adrese bir doğrulama kodu yollar; o kod bize gelir, **eklenti kodu kullanıcıya gösterir**, kullanıcı Gmail'e yapıştırır. Bitti.

**Biz ne kurarız:** Resend'in "gelen mail" (inbound) özelliği + bir Supabase Edge Function. Akış: mail gelir → Resend webhook'u fonksiyonumuzu çağırır → fonksiyon mailin metnini ve eklerini (PDF) Resend API'den çeker (webhook gövdeyi taşımaz, sadece kim/konu/ek adları) → adresteki gizli koddan kullanıcıyı bulur → var olan `docReader`'a verir → gezide onay bekleyen kart. Gmail'in doğrulama mailini tanıyıp içindeki kodu eklentiye düşürmek ek bir küçük parça (Mailparser aynı şeyi yapıyor).
- **Alan adı şart değil:** Resend her hesaba kendi `<id>.resend.app` alt adresini veriyor ve oradaki her adrese gelen maili alıyor. Trip Radar'ın kendi alan adı olunca oraya geçilir.
- **Maliyet:** Ücretsiz plan ayda 3.000, günde 100 mail; bu kota gönderilen + alınan toplamı. Beta için yeter. Sonra Pro ~20 $/ay. Gezgin Sırları'nın gönderim kotasını yememesi için Trip Radar'a **ayrı bir Resend ekibi** açılmalı (tahmin: kota ekip başına).
- **Süre (tahmin):** 2-3 gün (fonksiyon + eklentide adres/onay ekranı), doğrulama kodu ekranı +1 gün.

**Kullanıcıyı doğru eşleştirme ve güvenlik:** Gönderen adrese göre eşleştirme (TripIt, Kayak böyle yapıyor) yerine **kişiye özel gizli adres** seçilmeli. Sebep: Gmail otomatik iletmede maildeki "Kimden" hâlâ havayolu/otel olur, aile üyesi iletirse adres tutmaz. Gizli adresi bilen biri sahte rezervasyon sokabilir; bu yüzden gelen her şey "onay bekliyor" düşer ve adres tek tıkla yenilenebilir. Boyut ve sayı sınırı konur (tasarım önerisi).

**Outlook:** Elle iletme her yerde çalışır. Kişisel Outlook.com kurallarıyla otomatik iletme mümkün; ama Microsoft 365 **iş hesaplarında dışarıya otomatik iletme varsayılan olarak kapalı** (yönetici açmalı).

**8 olması için neden 10 değil:** Elle iletme yine bir hareket ister; tam otomatik filtre kurmak 5 dakikalık, biraz teknik bir iş ve kullanıcıların çoğu kurmaz (tahmin). Eski mailler filtreyle gelmez, elle iletilir.

## İkinci yol: Cloudflare Email Routing + Email Worker · puan 7/10
Kullanıcı tarafı birebir aynı. Fark bizde: gelen mail **sınırsız ve ücretsiz**, 25 MB'a kadar. Ama Trip Radar'ın bir alan adı olmalı ve DNS'i Cloudflare'de durmalı; Worker ham maili (MIME) kendisi çözüp Edge Function'a yollamalı. Süre tahmini 3-4 gün. Ölçek büyüyüp Resend faturası can sıkınca buraya geçilir.

## Bugün, sıfır işle: Gmail'de maili aç, eklenti ikonuna bas · puan 6/10
Eklentinin zaten `activeTab` + `scripting` izni ve sayfa okuyucusu (`src/lib/pagecapture.ts`) var; açık bir Gmail/Outlook web mailinde ikona basınca sayfa metni okunabiliyor. **Yeni izin gerekmez.** Gmail'de büyük ihtimalle bugün bile kısmen çalışıyor; denemedim, rezervasyon mailini `docReader`'a doğru yönlendirip yönlendirmediği test edilmeli. Elle, mail mail; ama kurulum yok.

## Elenenler
- **Gmail'e sürekli içerik betiği (otomatik "Gezine ekle" düğmesi):** `mail.google.com` için kalıcı izin ister; kurulumda "mail.google.com'daki verilerinizi okuyup değiştirebilir" uyarısı çıkar. Chrome Web Store 1 Ağustos 2026'dan beri "sadece açıkça yazılmış tek amaç için gereken veri" kuralını sıkı uyguluyor. Gmail'in sayfa yapısı sık değişiyor (Mixmax "Gmail her eklentiyi bozdu" diye yazdı). Mail açılmadan Gmail aramasını gizlice tarattırmak, Google'ın kısıtlamaya çalıştığı şeyin ta kendisi: risk büyük. Bilgi: maillerin içindeki schema.org JSON-LD (rezervasyon işaretlemesi) Gmail'in sayfasında büyük ihtimalle görünmez, çünkü Gmail mail gövdesindeki `<script>` etiketlerini temizliyor (emin değilim, denenmeli); zaten LLM metni okuyor, gerek yok.
- **Gmail eklentisi (add-on), `gmail.addons.current.message.readonly`:** "Hassas" kapsam, "kısıtlı" değil, yani CASA yok ama yine Google doğrulaması var; ayrı ürün (Apps Script + Workspace Marketplace) ve kullanıcı yine maili tek tek açar. activeTab yolundan farkı yok.
- **Microsoft Graph `Mail.Read` (kişisel hesaplar):** Kişisel hesapta izin alınabiliyor, CASA yok; ama "doğrulanmış yayıncı" kişisel hesapla yapılamıyor, kullanıcı "doğrulanmamış uygulama" uyarısı görür. Sadece Outlook'u çözer. Şimdilik değmez.
- **Apple/Google Wallet kartları:** Okumak için genel bir yol yok; konu dışı.

## Karşılaştırma

| Yol | Kullanıcı kurulumu | Bizim iş | Maliyet | Outlook? | Otomatik mi? |
|---|---|---|---|---|---|
| Kişisel adres + elle ilet (Resend) | Yok, her mailde "İlet" | 2-3 gün | 0 (3.000/ay), sonra ~20 $/ay | Evet | Yarı |
| Aynısı + Gmail filtresi | Bir kez ~5 dk | +1 gün | Aynı | Outlook.com evet, iş hesabı çoğu zaman hayır | Evet (yeni mailler) |
| Cloudflare Email Worker | Aynı | 3-4 gün + alan adı | 0, sınırsız | Evet | Aynı |
| Maili aç + ikon (var olan) | Yok | 0-1 gün test | 0 | Evet (web) | Hayır |
| Gmail içerik betiği | İzin uyarısı | 3-5 gün + sürekli bakım | 0 | Hayır | Hayır |
| Gmail add-on | Marketplace kurulumu | 1 hafta+ + Google doğrulaması | 0 | Hayır | Hayır |
| Gmail API (eski öneri) | 1 tık | Haftalar + CASA | Yıllık denetim ücreti | Hayır | Evet |

Diğer servisler: Postmark'ta gelen mail ücretsiz planda yok (ücretli plan ~16,5 $/ay'dan); Mailgun ücretsiz planda 1 yönlendirme kuralı, günde 100 mail; SendGrid Inbound Parse var ama ücretsiz kalıcı plan yerine artık deneme sunuyor (emin değilim). Hepsi Resend'den zahmetli. Flighty ve Layla'nın nasıl yaptığını doğrulamadım.

## Kaynaklar
- TripIt plans@ ve gönderen eşleşmesi: [help.tripit.com/itinerary-not-displaying](https://help.tripit.com/en/support/solutions/articles/103000063312-itinerary-not-displaying-in-account) · Kayak trips@ gönderen hesapla eşleşmeli: [kayak.com/c/help/account-trips](https://www.kayak.com/c/help/account-trips/) · Wanderlog gezi başına adres: [help.wanderlog.com](https://help.wanderlog.com/hc/en-us/articles/4625693334811-Add-flight-hotel-and-rental-car-details-by-forwarding-an-email) · Tripsy kişiye özel adres: [tripsy.help](https://tripsy.help/article/45-forwarding-emails-to-tripsy)
- Resend gelen mail ve resend.app alt alanı: [resend.com/docs/.../receiving](https://resend.com/docs/dashboard/receiving/introduction) · webhook gövde taşımaz: [resend.com/docs/webhooks/emails/received](https://resend.com/docs/webhooks/emails/received), [get-email-content](https://resend.com/docs/dashboard/receiving/get-email-content) · kota (gönderilen+alınan): [resend.com/docs/.../account-quotas-and-limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [resend.com/pricing](https://resend.com/pricing)
- Cloudflare gelen mail ücretsiz/sınırsız: [developers.cloudflare.com/email-service/platform/pricing](https://developers.cloudflare.com/email-service/platform/pricing/) · sınırlar: [.../limits](https://developers.cloudflare.com/email-service/platform/limits/) · Worker ile işleme: [.../email-handler](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
- Gmail iletme doğrulaması: [support.google.com/mail/answer/10957](https://support.google.com/mail/answer/10957?hl=en) · doğrulama kodunu yakalama örneği: [help.mailparser.io](https://help.mailparser.io/hc/en-us/articles/16253414120980-How-to-forward-emails-automatically-from-Gmail)
- Microsoft 365 dışa otomatik iletme kapalı: [techcommunity.microsoft.com](https://techcommunity.microsoft.com/blog/exchange/all-you-need-to-know-about-automatic-email-forwarding-in-exchange-online/2074888) · Graph izinleri: [learn.microsoft.com/graph/permissions-reference](https://learn.microsoft.com/en-us/graph/permissions-reference), [Mail.Read](https://graphpermissions.merill.net/permission/Mail.Read)
- Gmail kapsamları (add-on = hassas): [developers.google.com/.../gmail/api/auth/scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) · Chrome Web Store 1 Ağustos 2026 kuralları: [gblock.app](https://www.gblock.app/articles/chrome-web-store-data-rules-email-trackers-2026) · Gmail DOM kırılganlığı: [mixmax.com/engineering](https://www.mixmax.com/engineering/gmail-just-broke-every-chrome-extension/)
- Postmark/Mailgun ücretsiz plan: [agentmail.to karşılaştırma](https://www.agentmail.to/blog/free-email-api-for-developers), [costbench.com/mailgun](https://costbench.com/software/email-api/mailgun/free-plan/)
