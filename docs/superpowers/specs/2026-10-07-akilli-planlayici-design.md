# Akıllı planlayıcı: model her gezi için kalıbı kendisi üretir (2026-10-07)

Onay: Emre, 2026-10-07 ("model her gezi için kalıbı kendisi üretsin"; temel sağlam olsun: kafası karışmasın,
akıllı olsun, iş yapabilsin, gerçek hafızası olsun). Araştırma: `docs/arastirma/2026-10-07-ai-ajan-mimarisi.md`.
Önceki iş: `2026-10-06-niyet-planlayici-design.md` (4 sabit kalıp), `docs/arastirma/2026-10-07-layla-gezi-turu-denemesi.md`.

## Sorun (bugün)

1. **Tür listesi sabit.** Festival, kayak, balayı, wellness dışındaki her gezi "klasik": şehir + otel + aktivite.
   Liveaboard dalış, karavan turu, 8 kişilik aile kutlaması, safari, hac için ne iskelet ne soru var.
2. **Kısıtlar yapıya girmiyor.** "Babam merdiven çıkamaz", "ileri seviye dalgıcım", "özel araç olsun" sohbette
   kalıyor; otel seçimi, transfer türü, günlük öneriler bunu bilmiyor. (Layla'da da tutarsız: VIP araç dedi,
   plana paylaşımlı transfer koydu.)
3. **Pano sohbeti web aramasından sonra geziyi unutuyor.** Kök neden (kodda doğrulandı): arama 8 sn'yi geçince
   sonuç `assistant.ts` `landedText()` ile **modelden hiç geçmeden** ham Google cevabı olarak sohbete yazılıyor;
   gezi, kişi, tarih hiç girmiyor. Ayrıca kural "query'ye gezi hakkında bir şey yazma" diyor; model "karavan
   kiralama" diye yer adı olmadan arıyor, sonuç zaten genel geliyor. Üstüne `trip_state` yalnız değişince
   gönderiliyor (uzun sohbette bağlamın çok gerisinde kalıyor) ve `trip.intent` ona hiç girmiyor.

## Mimari (araştırmadan çıkan karar)

Çok ajanlı bir yapı kurmuyoruz. Tek model, her turda **tek çağrı**, etrafında kod katmanları:

```
kullanıcı mesajı
  └─ [kod] hızlı okuma (yer, tarih, kişi, bilinen etkinlik)                 ← bugün var
  └─ [model, TEK çağrı] okuma + cevap + KALIP (yalnız tür ilk anlaşılınca)   ← kalıp yeni
  └─ [kod] doğrulayıcı: kalıbı süzer; bozuk parça atılır, kalıp yoksa sabit kalıba / klasiğe düşer
  └─ [kod] gezi durumu (StartState → Trip.intent): tek doğruluk kaynağı
        ├─ kartlar, sorular, hazırlık, kapalı öneriler (bugünkü oyun kitabı mekanizması)
        ├─ kısıtlar → otel seçimi, transfer türü, öneri incelemesi, pano sohbeti
        └─ pano sohbeti her turda kısa "gezi özeti" + trip_state okur; web sonucu bu bağlamla sentezlenir
```

Neden tek model: hız (Chrome eklentisi, kullanıcının kendi anahtarı), maliyet ve araştırmadaki ortak öneri: önce
en basit yapı, katman ancak ölçülen bir hata gerektirirse. "Eleştirmen" ayrı bir model değil, **kod
doğrulayıcı**: kart türü, yer adı, tarih, efekt, kısıt tutarlılığı.

## Bölüm A — Kalıbı model üretir (başlatma sohbeti)

**Aynı çağrı.** `turnSchema`'ya isteğe bağlı `plan` nesnesi eklenir. Model onu yalnız gezinin türü ilk kez
anlaşıldığında ya da kullanıcı türü değiştirdiğinde doldurur; diğer turlarda `plan.label = ""` (çıktı maliyeti
bir kez). `knownLines` mevcut kalıbı tek satır söyler ("Kalıp: Liveaboard dalış · kısıtlar: ileri seviye").

**Şema** (Claude'un katı gramer sınırları için iç alanlar zorunlu; "" ve [] boş demek; tek dil, sohbetin dili):

| alan | ne |
|---|---|
| `label` | serbest tür adı: "Kızıldeniz liveaboard dalış gezisi", "Babanın 70. yaşı, aile kutlaması" |
| `base` | en yakın sabit tür: festival · ski · honeymoon · wellness · classic |
| `stay_type` | hedefteki gecelerin biçimi: hotel · boat · camp · vehicle |
| `stay_port` | tekne/kamp için kalkış ya da üs yeri ("Hurgada"); şehir olmayan bir ad ("Red Sea") reddedilir |
| `cards[]` | {ref, kind (PLANNED_KINDS; stay/flight hariç), title, place, anchor: arrive · stay · leave} |
| `questions[]` | ≤3, bugünkü PbQuestion biçimi (çip + genel efektler); `questions.ts` doğrulayıcısından geçer |
| `blocked_sections[]`, `blocked_words[]` | o gezide önerilmeyecekler |
| `prep[]` (≤8), `tip`, `tone`, `avoid` | hazırlık listesi, tek tavsiye, ton, "önerme" satırı |
| `musts[]` | {id, text}: yapılandırılmış kısıtlar (Bölüm B) |

**Sabit kalıplar örnek olur, kural olarak kalır.** Festival ve kayağın kısa JSON'u sistem istemine örnek olarak
girer. Kodun tanıdığı tür (Ozora, "Bansko'da kayak") sabit kalıbın test edilmiş iskeletini ve sorularını
kullanır; modelden yalnız `label`, `musts` alınır. Sabit kalıbı olmayan her gezi (bugün "klasik" sayılan uzun
kuyruk) modelin kalıbını kullanır. Model kalıbı yoksa (anahtar yok, zaman aşımı, geçersiz): bugünkü davranış.
Test edilmiş yol bozulmaz, yeni türler açılır.

**Doğrulayıcı** (`playbooks/model.ts`, saf): bilinmeyen kart türü, tekrar eden ref, 80 karakteri aşan başlık,
çip/efekt hatası (mevcut `validQuestion`), yer olmayan yer adı (deniz/okyanus/bölge sözcükleri) atılır; kartın
yeri gezinin hedefi, etkinlik yeri, iniş şehri ya da `stay_port` değilse hedefe çekilir. Atılan parça kalıbı
düşürmez, yalnız o parça gider. `label` yoksa kalıp yok sayılır.

**Türe özel konaklama.** `stay_type` boat/camp/vehicle ise hedefteki konaklama kartı o türle açılır
(`Item.stayKind`'e "boat" · "camp" · "vehicle" eklenir), şehri `stay_port` ya da hedef, başlığı modelin
("Liveaboard · Kızıldeniz"). Bu kartlarda otel önerisi ve otel fiyatı açılmaz (EmptyCard'ın stay Need'i yok).
Layla'nın "Red Sea otelinde 2 gece, 9 sa 49 dk araba" hatası yapısal olarak imkânsız olur. Karavan: `rv_rental`
kartı + geceler "Kamp alanı" (camp).

**Trip.intent genişler:** `{ playbook, label?, name?, url?, custom?, musts? }`. `custom` doğrulanmış model
kalıbıdır; panoda `tripPlaybook(trip)` ondan bir Playbook kurar (kapalı öneriler, avoid, hazırlık). Sabit
türlerde `custom` yok, bugünkü gibi.

## Bölüm B — Kısıtlar: tek kaynak, her yerde aynı

`musts` kapalı bir sözlükle kod tarafından uygulanır; sözlük dışı olan metin olarak modele gider:

| id | örnek | kodun yaptığı |
|---|---|---|
| `step_free` | "babam merdiven çıkamaz", "tekerlekli sandalye" | otel 3 önerisinde asansör/erişilebilir/zemin kat etiketi şart sayılır; transfer notu |
| `private_transfer` | "özel araç olsun" | transfer kartı "Özel transfer" açılır; "paylaşımlı/shared" öneri elenir |
| `kitchen`, `quiet`, `pool`, `pet`, `breakfast` | "mutfak şart" | Trip.requirements amenity (bugünkü mekanizma) |
| `level` | "ileri seviye dalgıç", "kayakta yeniyim" | metin; öneri incelemesi ve sohbet bilir |
| `diet`, `age`, `other` | "glütensiz", "2 yaşında bebek" | metin; aynı yerlere gider |

Tüketenler (hepsi `trip.intent.musts`'u okur, kimse kendi tahminini yapmaz): otel 3 önerisi (stayPicks
`wants`), transfer kartı, öneri kuralları + günlük AI incelemesi, pano sohbetinin her turu, plan özeti.

## Bölüm C — Plan özeti (oluşturmadan önce)

Gerekenler tamamlanınca bugünkü "Hazır" satırının yerine kısa bir özet: **Rota** · **Tarih** · **Kişi** ·
**Konsept** (label) · **Kısıtlar**. Geri sayım (Vazgeç) aynen sürer, ek tık yok; kullanıcı bir şey yazarsa geri
sayım durur (bugünkü kural).

## Bölüm D — Pano sohbeti: hafıza ve web araması bağlamı

1. **Gezi özeti her turda.** Kullanıcı mesajından hemen önce kısa bir `<trip_brief>` (≤400 karakter): rota,
   tarih, kişi, konsept, kısıtlar. trip_state değişmese de gider (bağlamın sonunda durur, kaybolmaz).
2. **tripState'e konsept:** `concept: { label, musts, avoid }`.
3. **Arama sorgusu gezinin yeriyle:** kural "yer adını yaz, kişi adı yazma" olur; kod da sorguda gezinin hiçbir
   yeri geçmiyorsa ana hedefi ekler ("karavan kiralama" → "Dahab karavan kiralama"). Yalnız yer adı gider.
4. **Hızlı sonuç (≤8 sn):** araç sonucuna not: "Bunu kullanıcının sorusuna BU gezi için bağla (yer, tarih, kişi,
   kısıtlar); genel bir yazı yazma."
5. **Yavaş sonuç:** ham metin yerine **sentez çağrısı**: gezi özeti + kullanıcının sorusu + etiketli web sonucu →
   kısa, geziye bağlı cevap + "Kaynak:" satırı. 15 sn içinde gelmezse ya da hata verirse bugünkü ham metin.

## Bölüm E — Kişisel hafıza (küçük, yerel)

Bugün çıkış şehri geçmiş gezilerden tahmin ediliyor (`guessOrigin`). Ek: geçmiş gezilerin yol arkadaşları "kimle"
sorusunda çip olur ("Sabine ile"). Kişiye bağlı kalıcı kısıt ("babam merdiven çıkamaz") yalnız kullanıcı onaylarsa
saklanır, bu bilgisayarda kalır, Ayarlar'dan silinir. A–D'den sonra, Emre ayrıca onaylarsa.

## Sıra ve sürümler

1. **A + B + C** (başlatma sohbeti, kalıp, kısıtlar, plan özeti) → 0.36.50 (0.36.47–0.36.49 diğer oturumların).
2. **D** (pano sohbeti) → 0.36.47 (assistant.ts) yayınlandıktan sonra, ayrı sürüm.
3. **E** → Emre onayından sonra.

Sahiplik: EmptyCard/OfferRow/stayPicks "Trip radar eklentisi geliştirme" oturumunda (dokunulabilir, haber
verilir); kartın yüzü/ikonu "günlük akış" oturumunda; `categories.ts` stay slot'undaki `noBooking` bozulmaz;
`city-image`/`cityImages.ts`'e dokunulmaz.

## Test

- Birim: doğrulayıcı (bozuk kart türü, "Red Sea", 4 soru → 3, bilinmeyen efekt, boş label → yok); liveaboard →
  tekne konaklaması (stayKind boat, şehir Hurgada, otel önerisi yok); karavan → rv_rental + camp geceleri;
  `step_free` → stayPicks'te asansörlü aday öne çıkar; `private_transfer` → transfer kartı özel, paylaşımlı öneri
  elenir; sabit tür (Ozora) model kalıbı gelse de sabit iskeleti kullanır; model yoksa bugünkü davranış.
- Pano: yavaş sonuç sentezden geçer (sahte sağlayıcı), sentez düşerse ham metin; sorguya yer eklenir; trip_brief
  her turda var.
- e2e (headless, tek tek): liveaboard mesajı → özet Konsept satırı, panoda tekne konaklaması, otel önerisi yok.

## Kapsam dışı

Ayrı planlayıcı/eleştirmen modeli, model yönlendirici, vektör hafıza, günlük program üretimi (günlük akış diğer
oturumda), ödeme.
