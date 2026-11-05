# MCP Paketi: Hadi'ye bağlanan zekâ

Taslak spec · 5 Kasım 2026 · Emre ile beyin fırtınasının vardığı yer. Kod yok; uygulanmadan önce akış → UX → UI
çizimi → onay sırası (urun-yol-haritasi.md) bu paket için de geçerli.

## 0. Pusula

> **Hadi'ye bağlanan ChatGPT, düz ChatGPT'den daha iyidir.**

Bu cümle paketin her kararının ölçüsüdür; bir karar onu zayıflatıyorsa yanlıştır. Yapay zekâ modelleriyle yarışmıyoruz.
Milyonlarca insanın zaten ödediği zekâyı (ChatGPT, Claude, Grok, Gemini) Hadi'ye bağlıyoruz. Zekâ onların, tuval bizim.
Kendi sohbetimiz, danışmanımız ve planlayıcımız içeride kalır; dış zekâ onlara rakip değil, aynı prize takılan
ikinci bir beyindir.

## 1. İş bölümü

| Zekâ (ChatGPT, Claude, Grok…) | Hadi |
|---|---|
| Beyin fırtınası, derin web araştırması | Gezinin tek doğru hâli (tuval) |
| Yerel bloglar, forumlar, gizli yerler | Kurallar ve tutarlılık (kod yargıcı) |
| Planı eleştirme, açık bulma, yeniden kurma | Sürekli takip: fiyat, saat, iptal günü, check-in |
| Tur, otel, restoran bulma (Viator, GetYourGuide, bloglar) | Kişiyi tanıma: tercih, hafıza, geçmiş geziler |
| Yolu hesaplama, kapalı yolu görme | Ortak karar: üyeler, oylar, bildirim |
| Rezervasyon (ajan modu olan istemcide) | Belgeler, PNR, rezervasyon kanıtı, telefonda hazır plan |
| | Affiliate linkleri ve rezervasyon akışı |

Zekâ sohbet bittiğinde durur; Hadi gece gündüz çalışır. Bu yüzden **takip her zaman Hadi'dedir.** Dış zekâ fiyat
gözlemi bırakabilir, fiyatı izleyen biziz.

## 2. Kararlar

| # | Karar |
|---|---|
| M1 | **Pusula:** Hadi'ye bağlı zekâ düz zekâdan iyi olmalı. Her araç, düz ChatGPT'nin bilmediği bir şeyi verir ya da onun ürettiğini yaşayan plana çevirir. |
| M2 | **Karar tek yerde verilir.** Kullanıcı sohbette "tamam, uygula" dediyse karar verilmiştir. Hadi ikinci kez onay sormaz; onay sırası, öneri paketi, değerlendirme kuyruğu yok. |
| M3 | **Kontrol onaydan değil, prizden ve geri almadan gelir.** Dış zekâ veriyi doğrudan değiştiremez; yalnız bizim biçimimizde teslim eder, takma işini bizim kodumuz yapar. Her teslimat tek dokunuşla geri alınır. |
| M4 | **İki hakemlik ayrıdır.** Zevki (hangi otel, kaç gece) kullanıcı ve zekâsı belirler; Hadi itiraz etmez. Tutarlılığı (tarih çakışması, eksik yol, rezerve olanın bozulması) Hadi korur: sessizce düzeltir, düzeltemezse nedeniyle reddeder, zekâ aynı sohbette onarır. |
| M5 | **Plan bir bütün olarak teslim edilir (sürüm).** Zekâ planı parça parça komutlarla değil, bütünüyle (ya da bir bölümüyle) yeniden kurup tek seferde verir; gerekçe ve kaynaklar içindedir. |
| M6 | **Her şeyin bir adresi vardır.** Not, kaynak, araştırma, aday: hepsi bir geziye, durağa, güne ya da karta bağlanır. Adressizi Gelenler'e düşer ("Nereye koyalım?"), Pano'ya dağılmaz. |
| M7 | **Araştırma dağılmaz, dosyalanır.** Bir araştırma = tek "Araştırma" kaydı (özet + kaynaklar), 15 ayrı kart değil. |
| M8 | **Zekâ link getirir, Hadi okur.** Dışarıdan gelen her aday bağlantısı eklentiyle kaydedilen sayfa gibi bizim okuyucumuzdan geçer; fiyat, puan, iptal koşulu sayfadan gelir. Zekânın söylediği fiyat sayfayla doğrulanana kadar "AI'ın söylediği" etiketini taşır (K3). |
| M9 | **Geri alınabilen serbesttir, geri alınamayan sohbette onaylanır.** Rezervasyon ve iptal geri dönüşsüz araçlardır; istemci (ChatGPT, Claude) onayı kendi sohbetinde ister. Hadi yalnız bildirir. |
| M10 | **Rezervasyon açıktır** ve bizim linkimizden geçer (Travelpayouts). Ajan onay numarasını geri yazar, kart Rezerve olur, takip başlar. |
| M11 | **Hassas alanlar yazılabilir, okunamaz.** Ajan PNR'ı bize bırakabilir; pasaport, belge, PNR, kapı kodu, ev sahibi iletişimi, üyelerin e-postası hiçbir rolle okunmaz. Silme aracı yoktur (çıkar = geri alınabilir). |
| M12 | **Dış zekâ gezinin üyesidir.** Kendi yüzüyle görünür ("ChatGPT · Emre"), bağlayanın yetkisini aşamaz, getirdiği her şey ona atfedilir (K14). |
| M13 | **Kendi danışmanımız da aynı prizi kullanır.** İç zekâ da planı alır, sürüm verir, aynı kodla takılır. Tek motor, tek kural seti, tek ölçüm seti. |
| M14 | **Bağlı asistanları kullanıcı Hadi'den yönetir.** Hangi gezi, hangi yetki, ne yaptı, bağlantıyı kes: tek ekran. |
| M15 | **Onay zaten sohbette var; sektörden bilerek ayrılıyoruz.** Notion, Canva ve Figma yüksek etkili yazmaları taslak ya da öneri olarak tutuyor (§16). Biz uygulayıp geri alma sunuyoruz, çünkü ChatGPT ve Claude okuma dışındaki her araçta kullanıcıya zaten sohbette onay soruyor: insan onayı orada verilmiş oluyor. Güvenceler: sürüm, tek dokunuşla geri al, günlük. Geri alma oranı yükselirse ya da bir gezi sahibi isterse gezi **öneri moduna** alınır (§9). |
| M16 | **Rezervasyon linkini biz üretiriz.** Araç zekâya `hadi.app/go/{id}` gibi bizim bağlantımızı verir; affiliate kodu sunucuda eklenir, hangi zekâdan geldiği yazılır. Zekâ affiliate bağlantısını kendisi kurmaz. Ödeme her zaman sağlayıcının sitesinde. |
| M17 | **Her çağrı kullanıcının kendi yetkisiyle çalışır.** Sorgular kullanıcının RLS bağlamında; `service_role` yok, kullanıcılar arası önbellek yok. (Asana'nın MCP sızıntısı ve Supabase MCP olayı bu hatadan çıktı.) |
| M18 | **Okuma araçları dünyanın beklediği adlarla.** ChatGPT'nin derin araştırması `search` ve `fetch` bekliyor; okuma araçlarımız bu adları taşır. |

## 3. Fiş: araçlar

Az ve kalın araç. Adlar İngilizce (istemciler küresel; araç adı kullanıcıya pek görünmez), açıklamalar kullanıcının
diline göre. Hepsi yapılı çıktı (`outputSchema`) döner ve sonunda "Hadi'de aç" bağlantısı taşır.

| Araç | Uç | Ne yapar | İşaretler (readOnly · destructive · openWorld) |
|---|---|---|---|
| `search` | Al | Kullanıcının gezilerinde, kartlarında, notlarında ve kaynaklarında arar. "Bali seyahatim" buradan çözülür. Kimlik ve başlık döner. | ✓ · ✗ · ✗ |
| `fetch` | Al | Bir gezinin tamamı ya da bir parçası (`focus`: durak, gün, kart). Plan omurga biçiminde, az token için Markdown; satırlar ve durumları; sabitler; tercihler ve kişiler; bütçe; Pano özeti; notlar; açık sorular; **kurallar** (zekâya ne yapamayacağını söyler). | ✓ · ✗ · ✗ |
| `hadi_add` | Ver | Geziye bir şey getirir: not, kaynak, araştırma dosyası, aday, fikir, fiyat gözlemi. Her öğe bir adrese bağlı. Bir çağrı = bir teslimat = bir geri al. Öğe başına sonuç döner; biri tutmazsa diğerleri geri alınmaz. | ✗ · ✗ · ✗ |
| `hadi_plan_version` | Ver | Planın yeni hâli, bütün ya da bir bölümü (`scope`); her değişiklikte gerekçe ve kaynak. Hadi takar, rapor döner (uygulanan, korunan, reddedilen ve nedeni). | ✗ · ✓ · ✗ |
| `hadi_check_plan` | — | Taslağı kaydetmeden kod yargıcından geçirir: söylenen ülkeler rotada mı, gecelerin yarıdan fazlası tek durakta mı, her değişimin yolu var mı, şehir bir kez mi. Zekâ göndermeden önce kendini sınar. | ✓ · ✗ · ✗ |
| `hadi_booking_link` | Rezerve | Bir aday ya da satır için bizim yönlendirme bağlantımız (M16): tarih ve kişi sayısı dolu, affiliate sunucuda. | ✓ · ✗ · ✓ |
| `hadi_mark_booked` | Rezerve | Rezervasyon yapıldı: hangi aday, onay numarası/PNR, ödenen, iptal koşulu. Kart Rezerve olur. `user_confirmed: true` olmadan yalnız ön izleme döner (onayı sunucu da zorlar, istemciye güvenmez). | ✗ · ✓ · ✓ |

İşaretler ipucudur, güvenlik değildir: her kural sunucuda ayrıca uygulanır. Geri alınabilir olmak tek başına
"destructive değil" demek değildir (OpenAI kuralı); var olanı değiştiren sürüm bu yüzden destructive işaretlidir ve
istemci onay sorar. Bu, M15'teki onayın kendisidir.

Araç açıklamaları ve sunucu talimatları iş kurallarını taşır (Notion, Todoist, Trello böyle yapıyor): "yazmadan önce
`fetch` ile oku", "bir bağlantıyı kaydetmeden önce kartın kaynaklarına bak", "adres uydurma, `search`'ten gelen
kimliği kullan", "kullanıcı söylemeden rezervasyon yapma".

Ayrıca üç **hazır istem** (MCP prompts), istemcinin menüsünde görünür:

- **Hadi usulü planla:** Gezi türünün soru sırasıyla (playbooks/questions.ts, K4) beyin fırtınası yapar, sonunda sürüm verir.
- **Planımı incele:** Planı okur, açıkları bulur (eksik yol, sıkışık gün, mevsim, kapalı yol), kullanıcıyla konuşur, düzeltir.
- **Araştır ve dosyala:** Bir konuyu (bir tur, bir semt, bir festival) araştırır, sonucu ilgili karta tek dosya olarak koyar.

## 4. Getirme (`hadi_add`): türler ve adresler

### Adres

Her öğe şunlardan birine bağlanır, en dardan en genişe:

1. **Kart** (`card`): bir satır ya da kayıt ("El Calafate · buzul turu", "Ubud · otel").
2. **Gün** (`day`): "14 Mart".
3. **Durak** (`stop`): "Ubud".
4. **Gezi** (`trip`): yalnız gezinin geneli için (vize, para, genel not).

Zekâ adresi adla da verebilir ("Bali gezisi, Ubud"); sunucu çözer. Çözemezse ya da iki aday varsa seçenekleri döner,
zekâ kullanıcıya sorar. Hiç adres yoksa öğe Gelenler'e düşer.

### Türler

| Tür | Ne olur | Hadi'deki karşılığı |
|---|---|---|
| `note` | Kısa not (en çok ~600 karakter). "Bali seyahatime şunu kaydet." | Adresindeki notlar; adres gezi ise gezinin notları (`PlannedKind "note"`) |
| `research` | Araştırma dosyası: başlık, 3-6 satırlık özet, en çok 12 kaynak (başlık, bağlantı, bir cümlelik not), isteğe bağlı "bilmen gerekenler" maddeleri | Kartın çekmecesinde "Araştırma" bölümü; tek kayıt, kaynaklar içinde |
| `source` | Tek kaynak (blog, video, harita) | Adresindeki dosyaya eklenir; dosya yoksa "Kaynaklar" dosyası açılır |
| `option` | Bir satırın adayı (tur, otel, uçuş…). Bağlantı zorunlu | Eklentiyle kaydedilmiş gibi okunur (M8), satırın destesine girer ("7 seçenek"); `choose: true` ile doğrudan "Seçtin" olur |
| `idea` | Plana sayılmayan fikir (restoran, gezilecek yer, ipucu) | Fikirler rafı (`Capture.idea`); durak adresi zorunlu |
| `price` | Fiyat gözlemi: aday, tutar, para, kaynak, tarih | Fiyat geçmişine ve fiyat takibine (priceWatch) |

Satır yoksa ve aday bir durağa uyuyorsa (ör. El Calafate durağına bir buzul turu), sunucu satırı açar
("El Calafate · buzul turu"). Durak planda yoksa öğe Gelenler'e düşer; plana durak eklemek sürümün işidir.

### Örnek: Arjantin'de 3 günlük buzul turu

Kullanıcı ChatGPT'de: *"El Calafate'teki buzul turu için araştırma yap, bilmem gerekenleri ve Viator, GetYourGuide'daki
iyi seçenekleri o turun içine koy."*

```json
{
  "trip": "Patagonya",
  "items": [
    {
      "type": "research",
      "to": { "card": "El Calafate · buzul turu" },
      "title": "3 günlük buzul turu: bilmen gerekenler",
      "summary": "Mart sonu sezonun son haftaları; buz yürüyüşü için yaş sınırı 18-50. Kramponlar turda veriliyor, su geçirmez eldiven getir…",
      "facts": ["Yaş sınırı 18-50 (Big Ice)", "Sabah 7:30 otel alımı", "Yemek dahil değil, sandviç götür"],
      "sources": [
        { "title": "…", "url": "https://…", "note": "Rüzgârlı günlerde iptal olabiliyor" }
      ]
    },
    { "type": "option", "to": { "card": "El Calafate · buzul turu" }, "url": "https://www.getyourguide.com/…", "why": "Küçük grup, 12 kişi" },
    { "type": "option", "to": { "card": "El Calafate · buzul turu" }, "url": "https://www.viator.com/…", "why": "En ucuz, ama 40 kişilik grup" }
  ]
}
```

Hadi'de görünen: kartta "2 seçenek · ChatGPT" destesi, çekmecede Araştırma bölümü; teslimat şeridinde
"ChatGPT Patagonya'ya 1 araştırma, 2 tur getirdi · Geri al". Turların fiyatı ve puanı sayfalardan okunur;
"Satın al" basıldığında bağlantı affiliate'e döner (affiliate.ts).

Kullanıcının istemcisinde Viator ya da Tripadvisor uygulaması da bağlıysa (ChatGPT ve Claude'da var) zekâ turu
orada bulur, Hadi'ye kaydeder. Onlar arama yapar, biz gezinin kendisiyiz. Büyük seyahat şirketlerinin hiçbiri zekânın
bir geziye yazmasına izin vermiyor; hepsi aramayı açıp geziyi ve ödemeyi kendinde tutuyor (§16). Boşluk burada.

**Sayfayı okumak:** zekânın getirdiği bağlantıyı sunucu okur (M8). Sunucu kullanıcının verdiği bağlantıya istek
attığı için SSRF koruması şart: yalnız `https`, iç ağ ve üstveri adresleri yasak, yönlendirme sınırı, boyut ve süre
sınırı. Site botu engellerse kart zekânın söyledikleriyle "AI'ın söylediği" etiketiyle açılır; kullanıcı sayfayı
eklentiyle açtığında ya da fiyat kaynağımız (offers) bulduğunda doğrulanır.

## 5. Plan sürümü (`hadi_plan_version`): takma kuralları

Zekâ planın yeni hâlini omurga biçiminde verir (duraklar, geceler, duraklar arası yollar ve nedenleri, konaklama ve
etkinlik satırları, günler). `scope` ile bir bölüm gönderilebilir: `all`, `stops`, `legs`, `days:12-18`,
`stop:Ubud`. Takma işini kod yapar; yapay zekâ yoktur.

1. **Korur.** Rezerve olanlar, kullanıcının kilitledikleri ve elle değiştirdikleri (`userEdits`) değişmez. Sürüm
   bunlara dokunuyorsa o kısım uygulanmaz; rapor nedenini söyler ("Ubud oteli 12-16 Mart rezerve; etrafında kur").
2. **Sınar.** Kod yargıcının genel kuralları (omurga 0.47.60): söylenen ülkeler rotada, gecelerin yarıdan fazlası tek
   durakta değil, her değişimin ve dönüş havalimanına gidişin yolu var, şehir bir kez, ülke durak olmaz. Kırılan kural
   sürümü reddeder; zekâ aynı sohbette onarır (bir sürümde en çok 3 deneme).
3. **Uygular.** Kalan her şey yeni hâline geçer. Bağlı sonuçları motor düzeltir: tarihler kayar, otel niyetinin
   gecesi değişir, yolun günü güncellenir.
4. **Bağlar.** Her değişikliğin gerekçesi kartın "neden" satırına yazılır (K6), kaynağıyla. Uyarılar (kapalı yol,
   grev, festival kalabalığı) ilgili kartın üstünde durur.
5. **Takibe alır.** Yeni adayların fiyatı izlenir, yeni yollar ve iptal günleri hatırlatmalara girer.
6. **Hafızaya yazar.** Kullanıcının istediği ve kabul ettiği tercihlere işlenir (P10).
7. **Kaydeder.** Bir sürüm olur: "ChatGPT sürümü · 6 değişiklik · Karşılaştır · Geri al".

## 6. Çöplük olmasın diye

- Adres zorunlu (M6); adressiz olan Gelenler'de bekler, Pano'ya dağılmaz.
- Araştırma tek dosya (M7); bir dosyada en çok 12 kaynak.
- Bir teslimatta bir satıra en çok 5 aday; satırda dışarıdan gelmiş, seçilmemiş aday en çok 10. Fazlası en eski
  seçilmemiş dış adayı arkaya katlar.
- Aynı bağlantı ya da aynı kayıt (`Item.key`) ikinci kez gelmez; gelirse var olanın notuna eklenir.
- Bir teslimatta en çok 40 öğe; kullanıcı başına günde en çok 30 teslimat (ayar).
- Seçilmemiş dış adaylar ve fikirler 30 gün dokunulmazsa sessizce arkaya katlanır (silinmez, Geçmiş'te durur).
- Teslimat şeridi her zaman tek satır: "ChatGPT 4 şey getirdi · Gör · Geri al".

## 7. Rezervasyon

1. Zekâ `hadi_booking_link` ister; Hadi tarihi ve kişi sayısı dolu, kendi yönlendirme bağlantısını verir
   (`hadi.app/go/{id}`, M16). Affiliate kodu tıklanınca sunucuda eklenir ve hangi zekâdan geldiği yazılır.
2. Rezervasyonu zekâ kendi tarafında yapar (ajan modu) ya da kullanıcıya bağlantıyı verir. Ödeme Hadi'ye uğramaz;
   her zaman sağlayıcının sitesinde olur (Shopify'ın ajan akışı da böyle: ajan hazırlar, kişi satıcının sayfasında öder).
   Hadi bir satıcı değil; ajanla ödeme standartları (OpenAI ACP, Google UCP/AP2, Visa, Mastercard) bize değil
   sağlayıcılara düşer. Rezervasyon zekânın içinde biterse (Google AI Mode otel denemesi gibi) affiliate kaybolur; bu
   yüzden bağlantı hep bizden geçmeli.
3. `hadi_mark_booked` geri dönüşsüz araç olarak işaretlidir; istemci kullanıcıya sohbette onaylatır.
4. Kart Rezerve olur (damga), onay numarası ve PNR kaydedilir ama okunmaz (M11). Takip başlar: iptal günü, check-in,
   fiyat düşüşü ("ücretsiz iptal var, yeniden tutarsan €140 kazanırsın"); zekâ bir dahaki sefere bunu `fetch`
   içinde görür.
5. Paylaşılan gezide herkesi etkileyen konaklama ve uçuşun rezervasyonu diğer üyelere bildirilir (bkz. §9).

## 8. Görünmeyenler

Hiçbir rolde ve hiçbir araçta okunmaz: pasaport (passport.ts), belgeler ve dosyalar (DocRecord), PNR ve rezervasyon
kodu (`bookingRef`), kapı kodu (`doorCode`), ev sahibi iletişimi (`host`), üyelerin e-postası ve telefonu, ödeme
bilgisi, davet kodları. `fetch` bunların yalnız varlığını söyler ("Uçuş biletinin belgesi var").

## 9. Paylaşılan gezi

- Zekâ bağlayan kişinin yetkisiyle çalışır, onu aşamaz; getirdiği her şey "ChatGPT · Emre" yüzüyle görünür.
- Geri alınabilir değişiklikler serbest; diğer üyelere tek satır bildirim gider ("Emre'nin ChatGPT'si Bali planını
  güncelledi · 6 değişiklik").
- **Öneri (onay bekliyor):** Herkesi etkileyen rezervasyonda (ortak konaklama, ortak uçuş) diğer üyeye oy düşer
  ("Emre tutmak istiyor"); var olan oy sistemi kullanılır.
- **Gezi sahibinin anahtarı:** Gezi sahibi o gezi için dış zekâyı Açık · Öneri modu · Yalnız okuma olarak ayarlar
  (Atlassian ve Miro'daki yönetici anahtarı gibi). Öneri modunda sürümler uygulanmaz, "Emre'nin ChatGPT'si bir sürüm
  önerdi · Karşılaştır · Uygula" olarak bekler. Varsayılan Açık.
- Bir üyenin notu başka bir üyenin zekâsına veri olarak gider, talimat olarak değil (§11). Bir üyenin kişisel
  (paylaşılmamış) notu başkasının zekâsına hiç gitmez.

## 10. Hadi'deki yüzler

- **Ayarlar → Bağlı asistanlar:** bağlı her istemci (ChatGPT, Claude…), son kullanım, hangi geziler (hepsi / seçili),
  yetkiler (Oku · Getir · Planı değiştir · Rezerve et), etkinlik günlüğü, Bağlantıyı kes. Varsayılan: hepsi açık;
  kullanıcı kısar.
- **Teslimat şeridi:** planın üstünde tek satır, kim ne getirdi, Gör · Geri al.
- **Canlı varlık:** zekâ çalışırken "ChatGPT Bali gezisinde çalışıyor…" (Supabase realtime).
- **Sürüm karşılaştır:** önceki ve yeni plan yan yana; değişen kartlar parlar (K5).
- **Kartta yüz:** dış zekânın getirdiği her şeyde istemcinin simgesi ve bağlayanın baş harfi (K14, K23).
- **"Asistanına sor" kısayolu:** bir kartta, istemciye yapıştırılacak hazır cümle ("Hadi'deki Patagonya gezimdeki
  buzul turunu araştır ve dosyala").

## 11. Güvenlik

- **Ölümcül üçlü:** dış zekâda aynı anda özel veri, güvenilmez içerik (web) ve dışarı çıkış yolu var. Bizim tarafımızda
  önlem: hassas alanlar hiç verilmez (§8), verilen veri gezi planı düzeyinde kalır.
- **Enjeksiyon ile yazma:** bir web sayfası zekâya "planı boz" diyebilir. Önlem: silme yok, her yazma geri alınabilir,
  geri dönüşsüz araçlar istemcide onay ister, oran sınırları, etkinlik günlüğü.
- **Kullanıcı içeriği veri olarak gider:** not ve yorumlar araç sonucunda ayrı alanda, "kullanıcı içeriği" etiketiyle
  döner; araç açıklamaları bunun talimat olmadığını söyler.
- **Belirteç:** istemcinin belirteci yalnız bizim sunucumuz için geçerli (audience, RFC 8707), başka servise
  aktarılmaz; Viator, SearchAPI, Travelpayouts gibi servislere kendi anahtarlarımızla gideriz. Belirteç süreli,
  kapsamlı, iptal edilebilir.
- **Yetki ve kiracı:** her sorgu kullanıcının RLS bağlamında (M17); pasaport, belge, PNR gibi alanlar araç
  tasarımıyla değil, veritabanı düzeyinde (sütun ve satır kuralları) dışarıda tutulur.
- **Dışarı sızma:** zekânın yazdığı not ve araştırma metni temizlenir: HTML yok, görsel yok, yalnız `https`
  bağlantılar, otomatik yüklenen hiçbir şey yok (görsel bağlantısı en bilinen sızma yoludur).
- **SSRF:** sunucunun okuduğu her dış bağlantı için §4'teki sınırlar.
- **Günlük:** her araç çağrısı kim, hangi istemci, hangi gezi, ne değişti diye yazılır (`mcp_deliveries`).

## 12. Teknik

- **Belirtim:** MCP 2026-07-28. Çekirdek durumsuz (oturum başlığı yok); sunucusuz çalışmaya uygun.
- **Sunucu:** uzak MCP, Streamable HTTP, Supabase Edge Function (`supabase/functions/mcp`), resmî TypeScript SDK.
  Supabase'in yeni MCP yardımcıları her araca giriş yapmış kullanıcının istemcisini verir (RLS kendiliğinden işler) ve
  korunan kaynak üstverisini (RFC 9728) yayımlar. Sınırlar: duvar saati ücretsizde 150 sn, ücretlide 400 sn; istek
  başına ~2 sn CPU. Uzun iş (sayfa okuma, büyük sürüm takma) kuyruğa alınır; araç hemen döner, sonuç gezide belirir.
- **Giriş:** OAuth 2.1 + PKCE. Yetki sunucusu Supabase Auth'un OAuth 2.1 sunucusu (genel beta, şimdilik ücretsiz;
  onay sayfası bizim). İstemci kaydı: belirtim artık Client ID Metadata Documents'ı öneriyor; Supabase'de henüz yok,
  eski yol (dinamik kayıt) hâlâ çalışıyor ve en erken 2027 ortasında kalkacak. Dinamik kaydı açarak başlarız, Supabase
  destekleyince CIMD'ye geçeriz. Kapsamlar: `trips:read`, `trips:add`, `plan:write`, `booking`. Onay ekranında
  gezi seçilir (hepsi ya da seçili geziler).
- **Veri:** geziler bulutta (karar verildi). Yeni tablolar: `plan_versions` (sürüm, kaynak istemci, fark, geri al),
  `mcp_deliveries` (teslimat ve günlük), `mcp_clients` (bağlı istemci, yetkiler, geziler).
- **Mevcut boru hattı:** `option` ve `source` öğeleri `Capture` olarak girer (yeni `kind: "assistant"`), `forNeed`
  ile satıra, `idea` ile fikre gider; okuyucu (process.ts) aynen çalışır. Paylaşım bugün `shared_captures` üzerinden
  aktığı için dış zekânın getirdikleri ortak gezide de aynı yoldan yayılır. Geri al `turnUndo` ile.
- **Arayüz kartı (sonra):** MCP Apps ile ChatGPT ve Claude içinde küçük bir plan kartı (rota şeridi, "Hadi'de aç").

## 13. Ölçüm

- Bağlayan kullanıcı oranı; bağlayanların 4 haftalık kalma oranı (bağlamayanlarla karşılaştırma).
- Teslimat başına geri alma oranı (yüksekse takma kuralları ya da araç açıklamaları kötü).
- Dışarıdan gelen adaylardan seçilen ve rezerve edilen oranı; affiliate tıklaması ve komisyon.
- Sürümlerin reddedilme oranı ve en sık kırılan kural.
- "Hadi'de aç" tıklama oranı.

## 14. Aşamalar

| Aşama | İçerik | Neden bu sırada |
|---|---|---|
| F0 | Geziler bulutta, hesap ve OAuth | Önkoşul |
| F1 | `search`, `fetch`, `hadi_add`, `hadi_check_plan`; Bağlı asistanlar ekranı; teslimat şeridi. Claude ile | En sık kullanım (kaydet, araştır, aday getir), en az risk |
| F2 | `hadi_plan_version`, sürüm karşılaştır, gezi sahibinin anahtarı; iç danışman da aynı prize geçer (M13). ChatGPT dizin başvurusu | Takma motoru F1'in boru hattının üstüne kurulur |
| F3 | `hadi_booking_link`, `hadi_mark_booked`; paylaşılan gezide rezervasyon oyu | Geri dönüşsüz uç en son, günlük ve ölçüm oturunca |
| F4 | Arayüz kartı (MCP Apps), Claude dizini, Gemini ve Grok | Dağıtım, ürün oturunca |

**İstemciler nerede (Kasım 2026, ikinci el kaynaklardan; başlamadan resmî sayfalardan doğrulanmalı):**

| İstemci | Özel bağlantıyla | Not |
|---|---|---|
| Claude | Free (1 bağlayıcı), Pro, Max, Team, Enterprise; okuma ve yazma | Test için en kolay yol; F1 burada başlar. Dizin: OAuth, gizlilik politikası, test hesabı, her araçta başlık ve işaretler, okuma ile yazma ayrı araçlarda |
| ChatGPT | Tam okuma ve yazma yalnız Business ve Enterprise'da; Pro'da yalnız okuma; Plus'ta belirsiz | Bireysel kullanıcıya yazma için **Plugin Directory'de listelenmek** gerekiyor (Temmuz 2026'da "apps" adı "plugins" oldu). Bu yüzden başvuru F2'ye çekildi. Doğrulanmış geliştirici, test hesabı, ülke ayarı, inceleme |
| Gemini | Uygulamada özel MCP ("Connected Apps") yayılıyor; geliştirici önizlemesi 28 Ekim 2026'da açıldı, yalnız ABD | Bekle, izle |
| Grok | API'de uzak MCP var; tüketici uygulamasında tek kaynak var | Doğrula |
| Perplexity | Pro ve üstünde bildiriliyor, yayılım belirsiz | Doğrula |
| Copilot | Tüketici uygulamasında yok; yalnız kurumsal | Şimdilik değil |

Her aşamada önce kendimiz ve yakın çevreyle denenir (Claude özel bağlayıcısı, ChatGPT'de Pro ile okuma).

## 15. Açık sorular

1. Paylaşılan gezide ortak rezervasyon oyu (§9) olsun mu?
2. Dış zekânın kişisel hafızadan (P10) ne kadarını göreceği: tüm tercihler mi, yalnız bu gezininkiler mi?
3. Fiyat gözlemi (`price`) sayfayla doğrulanmadan fiyat takibini tetiklesin mi?
4. Bağlı asistanın kendi kendine çalışması (istemcinin zamanlanmış görevleri) desteklensin mi, yoksa takip yalnız
   Hadi'de mi kalsın?
5. Viator'ın kendi MCP sunucusu ve partner programı var. Doğrudan Viator ortaklığı mı, Travelpayouts üzerinden mi?

## 16. Dünyada nasıl yapılmış

Araştırma 5 Kasım 2026'da iki ayrı ajanla yapıldı. Sayfaların çoğu bu ortamdan doğrudan açılamadı; bulgular arama
sonuçlarının özetlerinden. Notion, Airtable, Todoist ve Trello'nun canlı MCP araçları ise doğrudan incelendi.
Uygulamaya geçmeden önce resmî sayfalardan doğrulanmalı.

### Başka nişler

| Ürün | Ne yapmış | Bizim için ders |
|---|---|---|
| **Notion** | Okumada `search`/`fetch`, yazmada sayfa oluştur/güncelle, öneri olarak düzenleme, sürüme dön. Yer söylenmezse yazdığı şey özel taslak olur. Silme önce ön izleme, `user_confirmed` olmadan çöpe atmaz, "kendiliğinden temizlik yapma" der. İlk sürümde API'yi bire bir araca çevirmiş, beceremeyince az ve kalın araca, az token için Markdown'a geçmiş. | Az ve kalın araç; Markdown; her yazmanın bir adresi; silmeyi sunucu zorlasın |
| **Figma** | Tuvale yazma (beta): tek araç `use_figma`, önce dosyanın düzenini incelemeyi şart koşan bir beceriyle. Dev koltuğu yalnız taslaklara yazar. | Ev kuralları araç sayısıyla değil açıklamayla öğretilir |
| **Canva** | Üretilen tasarımlar aday olarak gelir, kullanıcı seçer. Düzenleme işlem gibi: başlat, yap, onayla ya da vazgeç. Kendi denetim rehberinde "adayı kullanıcı yerine seçme" hatası yazılı. | Biz zekânın seçmesine izin veriyoruz, ama yalnız kullanıcı sohbette söylediyse (`choose`) |
| **Miro** | Panoya diyagram, belge, tablo; çerçeveye yerleştirme. Kurumsalda kapalı gelir, yönetici açar; pano izinlerine uyar. | Gezi sahibinin anahtarı (§9) |
| **tldraw** | Tuval için yalnız üç araç (şekil oluştur, düzenle, sil), sohbet içinde canlı tuval. | Tuval ürünlerinde az araç iyi çalışıyor |
| **Atlassian** | Ürün başına okuma ve yazma ayrı açılıp kapanır; izin yoksa "Yöneticin yazmaya izin vermedi" der. İstemci alan adı listesi, denetim günlüğü. | Net ret mesajı; günlük |
| **Asana** | Her eylem yetkiyi veren kullanıcı adına görünür. 2025'te MCP katmanındaki bir hata bir şirketin verisini başka şirketlere gösterdi (~1.000 müşteri, iki hafta kapalı). | Yeni katman eski yetki kurallarını atlamamalı (M17) |
| **GitHub** | Araç grupları, tam salt okuma modu, kilit modu. Kötü niyetli bir konu (issue), ajana özel depoyu açık bir PR'a sızdırttı. | Ölümcül üçlü gerçek; en az yetki |
| **Supabase** | Proje kapsamı, salt okuma modu. Bir destek talebine gömülü talimat, `service_role` ile çalışan ajana gizli belirteçleri talebe yazdırttı. | `service_role` asla; kullanıcı içeriği veri olarak |
| **Stripe** | Ajanlar için kaynak başına okuma/yazma ayarlı kısıtlı anahtarlar; para hareketinde insan onayı. | Kapsamlı yetki |
| **Shopify** | Ajan sepeti hazırlar, ödeme gerekince kişiyi satıcının ödeme sayfasına yollar. | Rezervasyon akışımız (§7) |
| **Zillow, Spotify** | Sohbette ara, işi ürünün kendisinde bitir; Spotify listeyi oluşturur, Spotify'da açılır. | Her sonuçta "Hadi'de aç" |
| **Trello, Todoist, Airtable** | Trello'da ayrı hızlı kayıt kutusu (Inbox), silme yok. Todoist toplu araçta öğe başına hata döner. Airtable her yazmaya geri alma kimliği verir. | Gelenler; öğe başına sonuç; geri al |
| **Doop** | Açık kaynak (AGPL) çok oyunculu tasarım tuvali; ajanlar kullanıcının kendi Claude Code, Codex ya da Cursor aboneliğiyle bağlanır, onaylayan kullanıcı adına çalışır, kareleri canlı akıtır, yorumlar ajana iş olur (Eylül 2026). ChatGPT desteği ve izin modeli doğrulanamadı. | "Asistanına sor" ve canlı varlık (§10) |

### Seyahatte

- **Expedia, Booking.com, Tripadvisor, Viator:** ChatGPT'de uygulama olarak var (Ekim 2025'ten beri); Claude'da da
  bağlayıcı olarak (2026). Hepsi arama ve karşılaştırma açıyor; rezervasyon kendi sitelerinde bitiyor, gezi kaydı
  kendilerinde kalıyor. Viator'ın OAuth'lu kendi MCP sunucusu da var.
- **Airbnb:** bilerek yok; Ekim 2025'te OpenAI'ın SDK'sını yeterince sağlam bulmadığını söyledi.
- **Mindtrip:** kendi uygulamasında uçuş rezervasyonu (Sabre, PayPal; Mayıs 2026). ChatGPT veya Claude bağlantısı bulunamadı.
- **Layla:** Temmuz 2026'da Expedia aldı.
- **GetYourGuide, Kayak, Hopper, Trip.com:** güncel resmî bağlantı bulunamadı.
- **Sonuç:** kimse zekânın bir geziye yazmasına, planı değiştirmesine izin vermiyor. Hadi'nin boşluğu bu.

### Standartlar ve kurallar

- **MCP 2026-07-28:** durumsuz çekirdek; MCP Apps (sohbet içi arayüz) ve Tasks resmî eklenti. Yetkilendirme: OAuth 2.1
  + PKCE, korunan kaynak üstverisi (RFC 9728), kaynak göstergesi (RFC 8707), CIMD tercih, dinamik kayıt eskidi ama
  çalışıyor.
- **Araç işaretleri:** ChatGPT `readOnlyHint` olmayan her araçta onay soruyor; dizin üç işaretin de açıkça yazılmasını
  istiyor ve geri alınabilirliği "destructive değil" saymıyor. Claude dizini her araçta başlık ve işaret istiyor;
  okuma ile yazmayı karıştıran aracı ayırtıyor; destructive araçta her zaman soruyor.
- **OpenAI kuralları:** ödeme dışarıda, sorumlu olduğun sitede; gömülü üçüncü taraf ödeme yok; reklam aracı olmak yok.
  Hizmetlerin (tur, otel) ve affiliate bağlantılarının nasıl sayıldığına dair resmî metin bulunamadı. Başvurudan önce
  sorulmalı.
- **Ajanla ödeme:** OpenAI'ın Instant Checkout'u Mart 2026'da geri çekildi ("uygulamalara geçiyoruz"). Google
  UCP/AP2 ile AI Mode'da otel rezervasyonunu deniyor (Ağustos 2026, ABD). Hadi satıcı olmadığı için bunlar bize değil
  sağlayıcılara düşer; affiliate için bağlantının bizden geçmesi önemli (M16).
- **Güvenlik:** Simon Willison'ın "ölümcül üçlüsü" (özel veri + güvenilmez içerik + dışarı çıkış yolu): %95 tutan bir
  koruma yetmez, üçlüden birini mimariyle kesmek gerek. MCP güvenlik kuralları: başkası için verilmiş belirteci kabul
  etme, kendi belirtecini başka servise aktarma, kullanıcının verdiği adreslere giderken SSRF'e dikkat.

### Kaynaklar

- Notion hosted MCP: https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look · https://developers.notion.com/docs/mcp-supported-tools
- Figma tuvale yazma: https://developers.figma.com/docs/figma-mcp-server/write-to-canvas
- Canva doğrulama rehberi: https://www.canva.dev/docs/mcp/verify-integration/
- Miro MCP: https://developers.miro.com/docs/miro-mcp
- tldraw MCP App: https://tldraw.dev/blog/tldraw-mcp-app
- Atlassian Rovo MCP ayarları: https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/
- Asana MCP ve olay: https://developers.asana.com/docs/integrating-with-asanas-mcp-server · https://www.bleepingcomputer.com/news/security/asana-warns-mcp-ai-feature-exposed-customer-data-to-other-orgs/
- GitHub MCP ve zehirli akış: https://github.com/github/github-mcp-server · https://invariantlabs.ai/blog/mcp-github-vulnerability
- Supabase MCP ve ölümcül üçlü: https://supabase.com/docs/guides/ai-tools/mcp · https://simonwillison.net/2025/Jul/06/supabase-mcp-lethal-trifecta/ · https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- Shopify ajan ödemesi: https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
- Zillow ChatGPT: https://www.zillowgroup.com/news/zillow-becomes-first-real-estate-app-in-chatgpt
- Doop: https://www.producthunt.com/p/doop/doop
- Seyahat uygulamaları: https://www.phocuswire.com/openai-chatgpt-apps-expedia-booking-tripadvisor · https://claude.com/blog/connectors-for-everyday-life · https://www.phocuswire.com/news/technology/tripadvisor-viator-claude-anthropic-amazon-alexa-ai · https://www.cnbc.com/2025/10/22/airbnb-chatgpt-ai-chesky.html
- Ajanla ödeme: https://www.digitalcommerce360.com/2026/03/06/openai-shifts-checkout-plans-agentic-commerce-strategy/ · https://skift.com/2026/08/07/google-confirms-hotel-agentic-booking-is-now-in-testing/
- İstemciler: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt · https://developers.openai.com/apps-sdk/app-submission-guidelines · https://support.claude.com/en/articles/11175166 · https://claude.com/docs/connectors/building/review-criteria · https://techcrunch.com/2026/10/28/as-ai-agents-reshape-the-web-google-opens-gemini-and-search-to-more-apps/ · https://docs.x.ai/developers/tools/remote-mcp
- MCP belirtimi: https://blog.modelcontextprotocol.io/posts/2026-07-28/ · https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- OpenAI güvenlik rehberi: https://developers.openai.com/apps-sdk/guides/security-privacy
- Supabase: https://supabase.com/changelog/38022-oauth-2-1-server-capabilities-for-supabase-auth · https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication · https://supabase.com/blog/give-your-supabase-app-its-own-mcp-server
- Araç yazma rehberi: https://www.anthropic.com/engineering/writing-tools-for-agents
