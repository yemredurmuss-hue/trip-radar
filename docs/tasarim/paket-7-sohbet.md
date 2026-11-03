# Paket 7: Sohbet sütunu

Onay: 3 Kasım 2026, 4. tur. Tasarım sayfası: https://claude.ai/artifact/J9canAGFytxQvyWhQyqpHJ (kaynağı yanındaki `paket-7-sohbet.html`).

Layla.ai'nin sohbetinden alınan derslerle sohbet sütununun yeniden çizimi. Paket 5 (sohbet biçim kuralları, akış durumları) ve Paket 6 (temel ölçüler, tokenlar) temel olarak duruyor; bu paket onların üstüne 7 karar koyar. Burada yazılı olmayan her şey Paket 5-6'daki gibi kalır.

## Değişmeyen (Paket 5-6)

Mor vurgu; Inter gövde, Plus Jakarta Sans başlık; kalınlıklar 400 · 600 · 700; kullanıcı balonu sağda beyaz, asistan balonsuz düz metin; "Düşünüyor… / Web'de arıyorum…" durum satırı; panoda iş yaparken adım adım ilerleme; 4+ değişiklik tek düğmede; PNR mono hap; tablo yok (kartlar yapar); asistan emoji kullanmaz; fiyat `€1.250`; Kopyala / Yeniden yaz; "Gönderilemedi · Tekrar dene"; gün hapı.

## 7 karar

| # | Karar | Bugün | Sonra |
|---|---|---|---|
| 1 | Sütun genişliği | 332 px, ~38 karakter | 432 px, ~60 karakter (14 px'te); kural aşağıda |
| 2 | Gövde yazısı | 15/24, `--h-ink` | **14/22**, `--h-ink2 #34304d`; telefonda 16/24. Paket 6'daki 15/24 yalnız pano gövdesinde kalır |
| 3 | Üst çubuk | "Asistan" başlığı + boşluk | Zemin ve çizgi yok: solda Hadi işareti, sağda avatar + ok. Yeni sohbet ve ayarlar avatar menüsünde |
| 4 | Öneri düğmeleri | Son mesajın altında, sarar | Yazı kutusunun 10 px üstünde tek sıra, yana kayar, en fazla 4 |
| 5 | Sohbet içi kart | 6 satır, fiyat/puan/çip/düğme | 1 satır, 80 px: görsel · ad · tek satır bilgi · "Plana al" hapı; kart gövdesi panoda açar |
| 6 | Etiketli madde | Düz madde | `**Etiket:** metin` biçimi; etiket koyu, metin yumuşak; etiketler kalın sınırına sayılmaz |
| 7 | Yoğun bilgi | 12 satırdan sonra solar | Etiketli listede solma yok; 7 güne kadar tek ekranda |

Ek (onaylı): "en son mesaja in" düğmesi; kutunun altında tek satır uyarı; yazı kutusunun 4 durumu; 1280 altında daraltılabilir sütun.

## Layla'dan alınmayanlar

Lila kullanıcı balonu (mor bizde vurgu için saklı), kutu içi "Connect email", üst çubukta para/bayrak/derece seçici (ayarlarda kalır), emoji ile selam, pazarlama cümlesi, kalem (yeni sohbet) düğmesi.

## Tokenlar

Paket 6 basamaklarından; yeni olan yalnız `--h-ink2` ve `--h-chat-w`.

```css
--h-ink2: #34304d;            /* asistan gövdesi, kart 2. satırı; beyazda 12,5:1, --h-soft'ta 11,7:1 */
--h-chat-w: clamp(384px, 30vw, 432px);   /* ≥1280 */
--h-chat-w-sm: 336px;         /* 1024-1279 ve <1024 panel */
--h-chat-rail: 56px;          /* daraltılmış şerit */
/* yazı: 14/22 masaüstü, 16/24 telefon; kaynak satırı ve uyarı 12/16; kart adı 14/20 600 */
```

## Yerleşim ve genişlik kuralı

Genişlik pencereye göre kendiliğinden; kullanıcı seçmez.

| Pencere | Sohbet | Pano | Not |
|---|---|---|---|
| ≥ 1280 | `clamp(384px, 30vw, 432px)` | kalan | Kenarından 384-520 arası sürüklenebilir; tercih hatırlanır |
| 1024-1279 | 336 px | kalan | Üst çubukta daraltma oku; şerit 56 px; yeni cevapta şeritte mor nokta; tercih hatırlanır |
| < 1024 | 336 px panel, panonun üstüne soldan kayar | tam genişlik | Sol altta sohbet düğmesi |
| Telefon | sekme (Paket 4) | sekme | 16/24 |

Şerit: üstte Hadi işareti (24), sohbet düğmesi 36 (köşe 10, beyaz, nokta `--h-acc` 10 px + 2 px beyaz halka), altta avatar 28.

## Sütun: tek sol kenar 20 px

| Öğe | Ölçü |
|---|---|
| Üst çubuk | yükseklik 56; zemin yok; `background: linear-gradient(var(--h-soft) 60%, transparent)` ki kayan metin logonun altında solsun; sol 20, sağ 20 (okun kenarı); sticky top 0 |
| Logo | gerçek işaret 24 px; yer tutucu "Hadi" Jakarta 800 18 px |
| Avatar | 32 + ok 16; dokunma alanı 40; `aria-haspopup="menu"`, ad "Profil menüsü" |
| Avatar menüsü | 220 px, köşe 16, iç 8, satır 36 köşe 10; başlık: avatar + ad + e-posta; satırlar: Yeni sohbet (⌘N), Profil, Ayarlar (sağda `€ · °C · TR` özeti), Nasıl çalışır, Çıkış |
| Mesaj alanı | iç 12 üst, 20 yan, 8 alt; mesaj arası 16; asistan içi 12 |
| Kullanıcı balonu | sağda, beyaz, köşe 16, iç 10/14, en çok %85, `--h-sh-xs`, 14/22 `--h-ink` |
| Asistan | balonsuz, 14/22 `--h-ink2`; `b` 600 `--h-ink`; bağlantı `--h-acc-d` 500 |
| Kopyala / Yeniden yaz | 28 px, ikon 16; satır `margin-left: -6px` ki ikon çizgisi metinle 20'de |
| Kaynak satırı | 12/16 `--h-mut` |
| Gün hapı | ortalı, 12/16 500, beyaz, çizgi `--h-line` |
| Öneri satırı | hap 32, iç 0 12, köşe 999, beyaz + çizgi; önerilen: `--h-acc-s` zemin, `--h-acc-d` yazı; boşluk 8; iç 12 üst, 20 yan, 10 alt; `overflow-x: auto; scroll-snap-type: x proximity; scroll-padding-inline: 20px` (yoksa ilk hap kenara yapışır); sağ 32 px mask; `::after` 12 px boşluk |
| Yazı kutusu | beyaz, köşe 20, çizgi `--h-line`, iç 12 10 10 16, `--h-sh-xs`; yan 20, alt 8 |
| Kutu düğmeleri | 36 yuvarlak; ataş ve mikrofon `--h-mut`, satır `margin-left: -8px`; gönder sağda `margin-right: -2px` |
| Uyarı satırı | 12/16 `--h-mut`, ortalı, tek satır `nowrap`, kutuya 8: "Yapay zekâ planlar; fiyat ve saatleri bir kez kontrol et." (bağlantı: Nasıl çalışır) |
| En son mesaja in | 32 yuvarlak beyaz, `--h-sh-pop`, sağ 20, öneri satırının 12 üstü; 200 px yukarı kaydırılınca görünür; yeni cevapta mor nokta; `aria-live=polite` "Yeni cevap" |

## Yazı kutusu durumları

| Durum | Görünüm | Davranış |
|---|---|---|
| Boş | yer tutucu `--h-mut`; gönder `--h-acc-s` zemin, `--h-acc-d` ikon, basılamaz | öneriler görünür |
| Odaklı | kenar 1 px `--h-acc` (`box-shadow: 0 0 0 1px`); imleç 2 px `--h-acc`, yanıp söner; yer tutucu kalır; uyarı satırı "Enter gönderir · Shift+Enter yeni satır" olur | öneriler durur, seçilebilir |
| Yazarken | metin `--h-ink`; gönder `--h-acc` zemin beyaz ikon; kutu yukarı büyür, en çok 120 px (5 satır), sonra içinde kaydırır | ilk harfte öneri satırı kapanır |
| Cevap gelirken | kutu boş; üstünde Paket 5 durum satırı (`role=status`, mor nokta + metin + mono süre); gönder yerine Durdur: `--h-ink` zemin, beyaz 14 px kare | bitince öneriler yeni cevaba göre gelir |

Klavye odak halkası (Paket 6: 2 px beyaz + 4 px mor) yalnız sekmeyle; tıklamada tek ince mor çizgi. Enter gönderir, Shift+Enter yeni satır.

## Sohbet içi kart

- 80 px; iç 8; köşe 16; beyaz; çizgi `--h-line`; `--h-sh-xs`; boşluk 12.
- Görsel 64, köşe 12; yoksa kategori ikonu kendi renginde (Paket 6, 4).
- Ad 14/20 600 `--h-ink`, tek satır üç nokta. İkinci satır 13/18 `--h-mut`, tek satır üç nokta; üzerine gelince "Panoda aç ›" `--h-acc-d` 500 olur.
- Tek satır bilgi: konaklama semt · yürüme · fiyat; uçuş saat · süre · fiyat; etkinlik gün · saat · fiyat. Fiyat hep sonda, `€1.250`.
- Kart gövdesi `role="button"`, ad "…, panoda aç": panoda ilgili satırı açar ve işaretler. Üzerine gelince `box-shadow: 0 0 0 2px var(--h-acc-s)`.
- "Plana al" hapı: 32, iç 0 12, köşe 999, `--h-acc-s` zemin, `--h-acc-d` 600 14 px; `stopPropagation`. Plana alınca "✓ Planda": `--oks` zemin, `--ok` yazı, `aria-pressed="true"`; tekrar basınca geri alır.
- Kartta başka düğme yok; iki seçenek alt alta iki kart = karşılaştırma ("tablo yok" kuralı).

## Asistan biçimi: çözücü ve model

Model izinli öğeleri ile çözücünün tanıdıkları aynı listeden üretilir.

| Öğe | Çözücü | Modele talimat |
|---|---|---|
| Paragraf | boş satır = yeni paragraf, arası 12 px | en fazla 3 cümle, genelde 1-2 paragraf |
| Kalın | `**…**` → 600 `--h-ink` | paragrafta en fazla 2; madde etiketleri sayılmaz |
| Etiketli madde | `^- \*\*[^*]{1,40}:\*\*\s` → `li > b` etiket 600 `--h-ink`, metin 400 `--h-ink2`; nokta 5 px `--h-mut` sol 3, iç sol 16, madde arası 6 | birden çok bilgi sıralarken her maddeyi en fazla 3 kelimelik kalın etiket + iki nokta ile başlat |
| Liste | tire ile, iç içe yok, numara yalnız sıra önemliyse; etiketli listede solma yok, en fazla 7 madde | 3+ öğede en fazla 5 madde; 7 güne kadar gün listesi; fazlası panoya yönlendirir |
| PNR | ters tırnak → mono 13/20 hap, dokununca kopyalar | ters tırnak |
| Bağlantı | yalnız o yanıtın kaynakları; `--h-acc-d`; "Kaynak:" satırı 12/16 | sitenin adı bağlantı metni |
| Seçenek adı | plandaki yazılışıyla → kart | adı aynen yaz, fiyatı ve mesafeyi tekrar etme |
| Diğer (başlık, tablo, italik, görsel, emoji) | düz metin olarak gösterilir | kullanma |

### Sistem istemine girecek blok

> Yanıtların orta genişlikte bir sohbet sütununda, küçük yazıyla okunur. Bir arkadaşın yazdığı gibi kısa, düz paragraflarla yaz: genelde iki ile dört cümle, en fazla iki paragraf, paragraflar arasında bir boş satır. Paragraf içinde kararı değiştiren tek bilgiyi iki yıldızla kalın yapabilirsin, bir yanıtta en fazla iki kez. Üç ya da daha fazla ayrı öğeyi sayman gerekirse tire ile en fazla beş kısa maddelik bir liste kur; sırası önemli adımlarda numara kullan; iki öğeyi cümle içinde say. Birden çok bilgiyi sıralarken her maddeyi en fazla üç kelimelik kalın bir etiketle başlat ve iki nokta koy, örneğin **Gidiş (1 Kasım):** SAW → OPO; bu etiketler kalın sayısına girmez. Dörtten fazla bilgi veriyorsan paragraf değil etiketli liste kur; etiket gün, saat ya da konu olsun; her madde tek satır. Rezervasyon kodu ve PNR'ı ters tırnak içine al. Seçenekleri karşılaştırırken farkı tek cümleyle söyle, çünkü ayrıntıyı kartlar gösterir. Bir seçenekten söz ederken adını plandaki yazılışıyla aynen yaz; arayüz onu kart olarak gösterir, sen fiyat ve mesafeyi tekrar etme. Dış bağlantıyı yalnız sana verilen kaynaklardan, sitenin adını bağlantı metni yaparak ver. Fiyatı simge önde ve kuruşsuz yaz (€1.250), tarihi "12 Mart Perşembe" biçiminde yaz, sayıları yalnız araç sonuçlarından al. Sıcaklığı kelime seçiminle ver, emoji kullanma; biçim olarak yalnız paragraf, kalın, etiketli madde, liste ve ters tırnak kullan.

## Erişilebilirlik (WCAG 2.2 AA)

- `--h-ink2` beyazda 12,5:1, `--h-soft`'ta 11,7:1; `--h-mut` 6,6:1; "Plana al" 7,2:1.
- Öneri satırı `role=group` "Hızlı cevaplar"; tek sekme durağı, ok tuşları, Enter seçer, Escape kutuya; sağ solma yalnız görsel.
- Kart gövdesi ve "Plana al" iki ayrı odak durağı; "Planda" `aria-pressed`.
- Avatar hedefi 40 px; haplar 32 px (telefonda satır 44).
- Akan metin ekran okuyucuya bitince tek seferde; durum satırı `role=status`.
- Üst çubuğun solma geçişi `prefers-reduced-motion`'dan etkilenmez (hareket değil); imleç ve nokta yanıp sönmesi reduced-motion'da sabit.

## Dosyalar (Hadi)

`Chat.tsx` (RichText: etiketli madde çözücüsü; kart; öneri satırı; üst çubuk), `ChatFold.tsx` (daraltma şeridi), `lib/chatStatus.ts`, `lib/assistant.ts` (sistem istemi bloğu), `DESIGN.md` (`--h-ink2`, `--h-chat-w`).
