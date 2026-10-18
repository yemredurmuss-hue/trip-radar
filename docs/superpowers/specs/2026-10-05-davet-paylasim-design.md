# Davet, profil ve gezi paylaşımı — plan

Durum: taslak, Emre'nin kararı bekleniyor (2026-10-05).

## İstek (Emre)

- Birini davet etmek çok kolay olsun: tek link, o linkle eklentiyi kurabilsin.
- Üyelik yok; arkadaşlara ve Sabine'e gönderilecek basit bir sistem.
- Bir geziyi (ör. Porto) paylaşabilmek.
- Basit bir profil: adım ve fotoğrafım.

## Bugün olan (0.28/0.29 paylaşım altyapısı)

- Supabase'te `trip_radar` şeması. Hesap yok; gizli bir `shareId` + anon key ile RPC'ler çalışıyor.
- Senkron canlı ve iki yönlü:
  - linkler (capture) iki yönde gider;
  - oylar iki yönde gider;
  - ayarlar için son yazan kazanır.
  - Her taraf AI işini kendi anahtarıyla yapar.
- Katılmak için `TR1:…` kodu yapıştırılıyor (Seyahatlerim → Paylaşılan geziye katıl). Link ya da derin link yok.
- Kurulum:
  - Mac'te `curl … | bash` + Geliştirici modu + "Paketlenmemiş öğe yükle".
  - Diğer sistemlerde zip indirilir; kendini güncellemez.
  - Chrome Web Store yok. manifest'te sabit `key` var.
- Kimlik yalnız serbest bir isim (`shareName`). Hero'daki yolcular baş harflerle çiziliyor, fotoğraf yok.
- Bir arkadaşın bugün yapması gerekenler:
  1. Terminal ya da zip ile kurmak.
  2. Geliştirici modunu açmak.
  3. Gemini anahtarı almak.
  4. Kodu yapıştırmak.
  5. İsim yazmak.

## Asıl sürtünme (dürüst tablo)

1. **Kurulum.** Chrome, mağaza dışındaki eklentiyi tek tıkla kurdurmuyor. "Tek linkle kurulum"un tek gerçek yolu
   Chrome Web Store'da **liste dışı (unlisted)** bir sayfa.
   - Linki olan kurar, aramada çıkmaz.
   - Kendiliğinden güncellenir.
   - Geliştirici modu gerekmez.
2. **AI anahtarı.** Her arkadaşın kendi Gemini anahtarını alması, kurulumdan sonraki en büyük engel.
3. **Kod yapıştırma.** Bir linke tıklamaktan zor.

## Önerilen akış (Porto'yu paylaşmak)

1. Hero'da "Birini davet et" → "Davet linkini kopyala" (bir de WhatsApp ile gönder).
2. Link: `https://<davet sayfası>/j/#TR1:…`. Kod `#`'den sonra durduğu için hiçbir sunucuya gitmez.
3. Arkadaş linki açar. Sayfa eklentinin kurulu olup olmadığını anlar:
   - **Kurulu değilse:** "1. Trip Radar'ı kur" düğmesi (mağaza, liste dışı) çıkar. Kurulunca sayfa kendini yeniler.
   - **Kuruluysa:** "Porto gezisine katıl" düğmesi çıkar. Eklenti kodu alır; `externally_connectable` ile yalnız bu
     sayfadan kabul eder.
4. İlk açılışta tek ekran: "Adın?" + "Fotoğraf ekle (isteğe bağlı)". Profil budur, hesap yok.
5. Gezi Seyahatlerim'de açılır. Hero'da yolcular fotoğraflarıyla görünür ("Emre & Sabine").

## Parçalar

### Faz 1 — link ve profil (mağazasız, hemen yapılabilir)

- **Davet sayfası:**
  - Statik tek HTML, GitHub Pages'te (repo açık, ücretsiz).
  - Supabase Edge Functions HTML sunmuyor (text/plain'e çeviriyor), o yüzden orası olmaz.
  - Eklenti kuruluysa katıl, değilse kurulum adımları:
    - bugün Mac komutu ve zip;
    - Faz 2'den sonra mağaza düğmesi.
- **Eklenti tarafı:**
  - `externally_connectable` (yalnız davet sayfasının adresi) ve `onMessageExternal` → `joinSharedTrip(code, name)`.
  - Kodu doğrulama ve tekrar katılmayı engelleme mevcut `joinSharedTrip` içinde.
- **Paylaş penceresi:** kodun yerine "Davet linkini kopyala" ve WhatsApp. Kod, "gelişmiş" altında kalır.
- **Profil:**
  - `chrome.storage.local`'da `{ name, photo }`.
  - Fotoğraf 128 px JPEG'e küçültülür, ~10 KB.
  - Paylaşılan gezide üyelerin profili sunucuda tutulur. Şemaya `trip_radar.shared_trips.profiles jsonb` ve
    `put_profile` RPC'si eklenir.
  - Hero avatarları fotoğrafı gösterir, yoksa baş harfleri.
  - Ayarlar'da "Profilim" bölümü olur.
- **Güvenlik:**
  - Link, geziyi okuyup yazma yetkisi verir. Arayüz bunu açıkça söyler: "Linki yalnız gezi arkadaşına gönder".
  - "Paylaşımı durdur" bugünkü gibi çalışır.
  - Fotoğraf yalnız paylaşılan gezinin üyelerine gider.

### Faz 2 — tek tıkla kurulum (Chrome Web Store, liste dışı)

- **Emre'nin yapacakları:**
  - Chrome Web Store geliştirici hesabı (tek seferlik 5 $).
  - Gizlilik politikası sayfası. Taslağını ben yazarım, GitHub Pages'te durur.
  - İlk incelemenin bitmesini beklemek (genelde 1–3 gün, garanti değil).
- **Benim yapacaklarım:**
  - Mağaza paketi (zip), açıklama, ekran görüntüleri.
  - Mağaza kimliğiyle Mac kurulumunun kimliği farklı olacağı için davet sayfası iki kimliği de tanıyacak.
  - Mac güncelleyicisi (Emre için) aynen kalır.
- Sonuç: davet linki → "Chrome'a ekle" → "Katıl". Geliştirici modu ve Terminal gerekmez.

### Faz 3 — anahtarsız misafir (isteğe bağlı)

- Misafirin kaydettiği link, AI'si olan tarafta (Emre) işlenir. Misafir kendi anahtarı olmadan da link ekler,
  oylar, planı görür.
- Sohbet ve AI özellikleri anahtar ister; bu bilinçli bir sınır.

## Testler (bozulmasın)

- **Birim:**
  - davet linki ↔ kod dönüşümü;
  - profil fotoğrafının küçültülmesi ve sınırı;
  - `onMessageExternal`'in yalnız izinli adresi kabul etmesi.
- **Uçtan uca:**
  - davet sayfası (yerel dosya) → kurulu eklenti → katıl → gezi açılır, avatar fotoğraflı;
  - kurulu değilse kurulum adımları görünür.
- Şema değişikliği yalnız ekleme (yeni sütun ve yeni RPC). Eski sürümler çalışmaya devam eder.

## Karar bekleyenler (Emre)

1. **Mağaza:** liste dışı Chrome Web Store sayfası açılsın mı? Öneri: evet, gerçek "tek link" bu.
2. **AI anahtarı:** arkadaşlar şimdilik kendi ücretsiz Gemini anahtarını mı alsın, yoksa Faz 3 mü?
3. **Davet sayfasının adresi:** GitHub Pages mi (ücretsiz, hemen), yoksa emredurmus.net altında mı?
