# Trip Radar — Gizlilik politikası / Privacy policy

Son güncelleme / Last updated: 2026-10-05 (0.36.5)

## Türkçe

Trip Radar, gezerken kaydettiğin sayfaları (otel, uçuş, etkinlik, restoran) toplayıp karşılaştıran ve gün gün plana
koyan bir Chrome eklentisidir. Hesap açılmaz, reklam yoktur, veriler satılmaz.

**Bilgisayarında kalan:** Kaydettiğin sayfaların okunan bilgileri (ad, fiyat, tarih, adres, küçük ekran görüntüsü),
gezilerin, notların, sohbetin ve eklediğin belgeler (bilet PDF'leri) yalnız bu tarayıcının yerel deposunda tutulur.
Eklentiyi kaldırınca silinir. Sildiğin kayıtlar, belgeler ve geziler 30 gün yalnız bu bilgisayardaki "Çöp kutusu"nda
durur, sonra kendiliğinden silinir; "Kalıcı sil" ya da "Çöp kutusunu boşalt" ile hemen silebilirsin.

**Nereye gider, neden:**
- **Yapay zekâ (Google Gemini):** Kaydettiğin sayfanın metni ve küçük ekran görüntüsü, sohbet mesajların ve
  okutmak istediğin belgeler, anlamlandırılmak için Google'ın Gemini API'sine gönderilir. Kendi anahtarını
  kullanıyorsan doğrudan Google'a; seni biri davet ettiyse, davet edenin Trip Radar sunucusu (Supabase) üzerinden
  Google'a. Sunucu içerikleri saklamaz; yalnız kaç istek yapıldığını ve tahmini maliyeti sayar. Ücretsiz Gemini
  katmanında Google gönderilenleri ürünlerini geliştirmek için kullanabilir.
- **Paylaşım (isteğe bağlı):** Bir geziyi paylaşırsan o gezinin ayarları, kaydettiğin sayfalar, oylar ve profil
  adın ile (eklediysen) küçük profil fotoğrafın, gezinin gizli kimliğini bilen kişilerin erişebildiği paylaşım
  sunucusuna (Supabase) gider. "Paylaşımı durdur" ile bu bilgisayardan eşitleme durur. Yanlış bir değişiklik geri
  alınabilsin diye paylaşılan gezinin ortak ayarlarının (ad, tarihler, bütçe, öncelikler, olanaklar, şartlar) son 200
  eski hâli, kimin ve ne zaman değiştirdiği bilgisiyle paylaşım sunucusunda tutulur. "Paylaşımı durdur" yalnız bu
  bilgisayardaki eşitlemeyi durdurur; sunucudaki paylaşılan gezi (kayıtları, oyları, profilleri ve bu geçmişiyle
  birlikte) senin isteğinle silinir: info@emredurmus.net adresine yazman yeterli.
- **Harita ve kur:** Adresler konuma çevrilirken OpenStreetMap Nominatim'e, döviz kurları için Frankfurter'a
  yalnız ilgili adres ya da para birimi gönderilir. Şehir fotoğrafları için şehir adı Wikipedia'ya ya da (paylaşım
  sunucusu üzerinden) Pexels'a gönderilir.

**Saklanmayan:** Tarama geçmişin, şifrelerin, ödeme bilgilerin okunmaz. Eklenti yalnız "Kaydet"e bastığın
sekmeyi okur.

**İletişim:** info@emredurmus.net

## English

Trip Radar is a Chrome extension that collects the travel pages you save (stays, flights, activities, restaurants),
compares them and puts them in a day-by-day plan. No account, no ads, data is never sold.

**Stays on your computer:** what is read from the pages you save (name, price, dates, address, a small screenshot),
your trips, notes, chat and documents you add (ticket PDFs) are kept only in this browser's local storage and are
removed when you uninstall the extension. Records, documents and trips you delete stay for 30 days only in this
computer's "Trash", then are deleted on their own; "Delete forever" or "Empty trash" deletes them at once.

**Where it goes, and why:**
- **AI (Google Gemini):** the text and a small screenshot of a page you save, your chat messages and documents you
  ask it to read are sent to Google's Gemini API to be understood: directly with your own key, or, when someone
  invited you, through the inviter's Trip Radar server (Supabase). The server does not store the contents; it only
  counts requests and the estimated cost. On Gemini's free tier Google may use what is sent to improve its products.
- **Sharing (optional):** when you share a trip, its settings, the pages you saved, votes and your profile name and
  (if you added one) small profile photo go to the sharing server (Supabase), reachable only by people who know
  the trip's secret id. "Stop sharing" stops syncing from that computer. So that a wrong change can be undone, the
  last 200 earlier versions of a shared trip's common settings (name, dates, budget, priorities, amenities,
  requirements) are kept on the sharing server with who changed them and when. "Stop sharing" only stops syncing
  on that computer; the shared trip on the server (with its saves, votes, profiles and this history) is deleted on
  request: write to info@emredurmus.net.
- **Maps and currency:** only the address is sent to OpenStreetMap Nominatim to place it on a map, and only the
  currency to Frankfurter for exchange rates. City names are sent to Wikipedia or (through the sharing server)
  Pexels for city photos.

**Not collected:** your browsing history, passwords or payment details. The extension reads only the tab you press
"Save" on.

**Contact:** info@emredurmus.net
