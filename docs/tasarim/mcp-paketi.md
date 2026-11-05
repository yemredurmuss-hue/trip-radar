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

## 3. Fiş: araçlar

Az ve kalın araç. Adlar İngilizce (istemciler küresel; araç adı kullanıcıya pek görünmez), açıklamalar kullanıcının
diline göre. Hepsi yapılı çıktı (`outputSchema`) döner ve sonunda "Hadi'de aç" bağlantısı taşır.

| Araç | Uç | Ne yapar | İşaret |
|---|---|---|---|
| `hadi_trips` | Al | Kullanıcının gezileri: ad, tarih, yer, üye sayısı, son değişiklik. "Bali seyahatim" buradan çözülür. | readOnly |
| `hadi_trip` | Al | Bir gezinin tamamı ya da bir parçası (`focus`: durak, gün, kart). Plan omurga biçiminde; satırlar ve durumları; sabitler; tercihler ve kişiler; bütçe; Pano özeti; notlar; açık sorular; **kurallar** (zekâya ne yapamayacağını söyler). | readOnly |
| `hadi_add` | Ver | Geziye bir şey getirir: not, kaynak, araştırma dosyası, aday, fikir, fiyat gözlemi. Her öğe bir adrese bağlı. Bir çağrı = bir teslimat = bir geri al. | yazma, geri alınabilir |
| `hadi_plan_version` | Ver | Planın yeni hâli, bütün ya da bir bölümü (`scope`); her değişiklikte gerekçe ve kaynak. Hadi takar, rapor döner (uygulanan, korunan, reddedilen ve nedeni). | yazma, geri alınabilir |
| `hadi_check_plan` | — | Taslağı kaydetmeden kod yargıcından geçirir: söylenen ülkeler rotada mı, gecelerin yarıdan fazlası tek durakta mı, her değişimin yolu var mı, şehir bir kez mi. Zekâ göndermeden önce kendini sınar. | readOnly |
| `hadi_booking_link` | Rezerve | Bir aday ya da satır için rezervasyon bağlantısı (affiliate, doğru tarih ve kişi sayısıyla dolu). | readOnly |
| `hadi_mark_booked` | Rezerve | Rezervasyon yapıldı: hangi aday, onay numarası/PNR, ödenen, iptal koşulu. Kart Rezerve olur. | yazma, geri dönüşsüz (onay ister) |

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

1. Zekâ `hadi_booking_link` ister; Hadi tarihi, kişi sayısını ve affiliate kodunu dolu bağlantıyı verir.
2. Rezervasyonu zekâ kendi tarafında yapar (ajan modu) ya da kullanıcıya bağlantıyı verir. Ödeme Hadi'ye uğramaz.
3. `hadi_mark_booked` geri dönüşsüz araç olarak işaretlidir; istemci kullanıcıya sohbette onaylatır.
4. Kart Rezerve olur (damga), onay numarası ve PNR kaydedilir ama okunmaz (M11). Takip başlar: iptal günü, check-in,
   fiyat düşüşü ("ücretsiz iptal var, yeniden tutarsan €140 kazanırsın"); zekâ bir dahaki sefere bunu `hadi_trip`
   içinde görür.
5. Paylaşılan gezide herkesi etkileyen konaklama ve uçuşun rezervasyonu diğer üyelere bildirilir (bkz. §9).

## 8. Görünmeyenler

Hiçbir rolde ve hiçbir araçta okunmaz: pasaport (passport.ts), belgeler ve dosyalar (DocRecord), PNR ve rezervasyon
kodu (`bookingRef`), kapı kodu (`doorCode`), ev sahibi iletişimi (`host`), üyelerin e-postası ve telefonu, ödeme
bilgisi, davet kodları. `hadi_trip` bunların yalnız varlığını söyler ("Uçuş biletinin belgesi var").

## 9. Paylaşılan gezi

- Zekâ bağlayan kişinin yetkisiyle çalışır, onu aşamaz; getirdiği her şey "ChatGPT · Emre" yüzüyle görünür.
- Geri alınabilir değişiklikler serbest; diğer üyelere tek satır bildirim gider ("Emre'nin ChatGPT'si Bali planını
  güncelledi · 6 değişiklik").
- **Öneri (onay bekliyor):** Herkesi etkileyen rezervasyonda (ortak konaklama, ortak uçuş) diğer üyeye oy düşer
  ("Emre tutmak istiyor"); var olan oy sistemi kullanılır.
- Bir üyenin notu başka bir üyenin zekâsına veri olarak gider, talimat olarak değil (§11).

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
- **Belirteç:** istemcinin belirteci yalnız bizim sunucumuz için geçerli (audience), başka servise aktarılmaz;
  süreli, kapsamlı, iptal edilebilir.
- **Günlük:** her araç çağrısı kim, hangi istemci, hangi gezi, ne değişti diye yazılır (`mcp_deliveries`).

## 12. Teknik

- **Sunucu:** uzak MCP, Streamable HTTP. Supabase Edge Function (altyapı zaten orada) ya da gerekirse ayrı bir işçi.
- **Giriş:** OAuth 2.1 + PKCE, MCP yetkilendirme belirtimine uygun (korunan kaynak üstverisi). Yetki sunucusu olarak
  Supabase Auth. Kapsamlar: `trips:read`, `trips:add`, `plan:write`, `booking`.
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
| F1 | `hadi_trips`, `hadi_trip`, `hadi_add`, `hadi_check_plan`; Bağlı asistanlar ekranı; teslimat şeridi | En sık kullanım (kaydet, araştır, aday getir), en az risk |
| F2 | `hadi_plan_version`, sürüm karşılaştır; iç danışman da aynı prize geçer (M13) | Takma motoru F1'in boru hattının üstüne kurulur |
| F3 | `hadi_booking_link`, `hadi_mark_booked`; paylaşılan gezide rezervasyon oyu | Geri dönüşsüz uç en son, günlük ve ölçüm oturunca |
| F4 | Arayüz kartı (MCP Apps), ChatGPT ve Claude dizinlerine başvuru, Gemini ve Grok | Dağıtım, ürün oturunca |

Her aşamada önce kendimiz ve yakın çevreyle (Claude özel bağlayıcı, ChatGPT geliştirici modu) denenir.

## 15. Açık sorular

1. Paylaşılan gezide ortak rezervasyon oyu (§9) olsun mu?
2. Dış zekânın kişisel hafızadan (P10) ne kadarını göreceği: tüm tercihler mi, yalnız bu gezininkiler mi?
3. Fiyat gözlemi (`price`) sayfayla doğrulanmadan fiyat takibini tetiklesin mi?
4. Bağlı asistanın kendi kendine çalışması (istemcinin zamanlanmış görevleri) desteklensin mi, yoksa takip yalnız
   Hadi'de mi kalsın?

## 16. Dünyada nasıl yapılmış

(Araştırma özeti aşağıya eklenecek.)
