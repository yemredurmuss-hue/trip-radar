# A2 · Plan sayfası dışındaki yüzeyler (canlı 0.37.1) ve yeni plan tasarımı (v77–v82)

Salt okunur inceleme. Kod: `/home/user/trip-radar` (HEAD `9f22bae Sürüm 0.37.1`). Tasarım notu:
`/home/user/wt-v32/docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md` (v77–v82). Karşılaştırma için
Mac yolundaki `plan-v73-asistanla` (v65–v66 notu, satır 82–87) ve `docs/envanter/02-hareket-ve-sohbet.md` de okundu.

"Plan sayfası" burada `TripPanel` içindeki hero + Plan (Kategoriye göre / Yolculuk sırasıyla) + Pano demek; yeni tasarım
yalnız bunları çiziyor. Aşağıdaki her şey bunun dışında kalıyor ya da plan sayfasının içinde olup v77–v82'de çizilmedi
(bölüm K).

---

## 0. Kısaca

- Eklentinin kabuğu çok yalın: **yan panel yok, sağ tık menüsü yok, ayrı seçenekler sayfası yok, içerik betiği yok**.
  Bir popup (320 px, yalnız "kaydet"), bir kısayol (Alt+Shift+S = popup) ve her zaman **tam sekme** açılan pano
  (`app.html`) var. İlk kurulumda `app.html#settings` açılıyor.
- Tasarımı en çok eksik olan yüzey **gezi sohbeti** (pano sohbeti). v73'te (Mac yolu) asistan için "Planda göster"
  iniş kartı, çipler ve "arıyorum" satırı çizildi; v77–v82 bunu almadı. v81 de açıkça "yayındaki sohbet sütunu (26/16/14)
  bu tasarımın dışında, ayrıca ele alınmalı" diyor.
- İkinci büyük boşluk **dar pencere**: 860 px altında canlıda önce 70vh yüksekliğinde sohbet, altında plan geliyor.
  Yeni hero ilk ekranda hiç görünmüyor. 390 px telefon düzeni pratikte kullanılmayacak (Chrome mobilde eklenti çalışmaz).
- Başlangıç akışı omurgayı (şehir sırası, gece sayıları, tarihler, kişiler, tarz, şartlar, şehir fotoğrafları)
  kuruyor. Ama hero mozaiğinin 6 "yer" karesini ve v79'daki "✨ Önerimiz · onayla" durumunu **besleyemiyor**: adı olan yer
  fotoğrafı yok, AI her niyete seçim yapmıyor.
- Teknik kancalar (PDF'in hero kopyası, kart→hero fotoğraf geçişi, açılış animasyonu, hareket dili, güncelleme şeridi)
  canlıdaki sınıf adlarına bağlı. Yeni bileşenler bu adları korumalı ya da bu dosyalar güncellenmeli.

---

## 1. Kabuk gerçekleri (manifest ve giriş noktaları)

| Konu | Canlıda | Kaynak |
|---|---|---|
| Popup | `action.default_popup = popup.html`, genişlik 320 px | `static/manifest.json:21`, `static/app.css:204` |
| İzinler | activeTab, scripting, storage, unlimitedStorage, alarms | `manifest.json:27-33` |
| Host izinleri | Gemini, Anthropic, Nominatim, Frankfurter (2), `*.supabase.co` | `manifest.json:34-41` |
| Kısayol | yalnız `_execute_action` = Alt+Shift+S (popup'ı açar, yani kaydeder) | `manifest.json:42-49` |
| Yan panel / sağ tık menüsü / seçenekler sayfası / içerik betiği / bildirim | **hiçbiri yok** (grep: `sidePanel`, `contextMenus`, `notifications`, `content_scripts` yok) | — |
| Pano | her zaman tam sekme `app.html`; açık sekme varsa ona odaklanır | `src/lib/browser.ts:57-67` |
| Yönlendirme | yalnız `#trip=<id>` ve `#settings` | `src/app/App.tsx:39-43`, `:145-156` |
| İlk kurulum | `app.html#settings` (Gemini anahtarı) | `src/background.ts:98` |
| Güncelleme sonrası | pano aynı hash'le geri açılır | `src/background.ts:100-112` |

---

## 2. Ana tablo

Sütunlar: **Yüzey / özellik** · **Nerede** · **Ne yapar, hangi durumlar** · **Yeni plan tasarımıyla ilişkisi** ·
**Tasarım gerekli mi?** (EVET = yeni tasarım · UYARLAMA = küçük uyum · DOKUNMA) · **Not**

### A. Eklenti kabuğu ve arka plan

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Manifest izinleri | `static/manifest.json:13-49` | MV3, popup, 5 izin, 6 host izni | Yeni tasarım Places API (fotoğraf, logo) istiyor. Doğrudan çağrılırsa yeni host izni gerekir; Chrome'da bu, kullanıcıdan yeniden onay ve mağaza incelemesi demek. `*.supabase.co` üzerinden giderse izin değişmez. | DOKUNMA (Places'i sunucu üzerinden geçirin) | `supabase/functions/city-image` zaten böyle çalışıyor |
| Kısayol | `manifest.json:42-49` | Alt+Shift+S → popup → kaydet | Doğrudan ilişkisi yok | DOKUNMA | Boş durum metni bu kısayolu anlatıyor (`TripsHome.tsx:461`) |
| `_locales` | `static/_locales/{tr,en}/messages.json` | 3 metin: açıklama, düğme başlığı, komut adı | Yok | DOKUNMA | "karşılaştırsın, plana koysun" vaadi yeni tasarımla uyumlu |
| Popup (kaydetme) | `src/popup.tsx:25-157`, `static/popup.html` | Araç çubuğuna tıklamak = kaydet. Durumlar: kaydediliyor · "✓ Kaydedildi. AI inceliyor…" · "Ad → Gezi · Kategori · Şehir" · yer uyuşmazlığı sorusu (Yine de ekle / Yeni gezi: X / Ekleme) · Eklenmedi · hata · "Burası pano…" ipucu · anahtar yok uyarısı. Düğme: Geziyi aç / Panoyu aç / 1 dakikalık kurulum | Kaydedilen link yeni tasarımda bir **niyetin seçeneği** olur ("Biriktirdiklerim"). Popup kategori söylüyor, niyet söylemiyor. "Geziyi aç" yalnız geziyi açıyor; niyete ya da Pano'ya giden bağlantı yok (`App.tsx` yalnız `#trip=` okuyor). | UYARLAMA | Öneri: "Kyoto · Konaklama seçeneklerine eklendi" ve `#trip=…&item=…` |
| Sayfa yakalama | `src/lib/pagecapture.ts:17-102`, `src/popup.tsx:40-48` | Sayfada bir kez çalışan okuyucu: metin, görünen alan, seçili metin, JSON-LD, meta, koordinat, en çok 8 fotoğraf (görünenler önce). Ayrıca ekran görüntüsü alınıyor. | Kart fotoğrafı (v82 otel görseli 196 px) ve mozaiğin "biriken yer" kareleri `item.imageUrl`'den gelecek; kaynak burası | DOKUNMA | |
| Arka plan işçisi | `src/background.ts:38-148` | Yakalama kuyruğu → sayfayı yakından okuma → AI karşılaştırması; paylaşım eşitlemesi (dakikada bir); 10 dakikada bir yeniden deneme; bağlantı gelince yeniden deneme; kendini güncelleme | Yeni tasarımın "AI uyum puanı n/100", artılar/eksiler, "niyetine uyuyor mu" verisi `analyzeStale` (lib/analysis) ile üretilecek. Tasarım notundaki "verinin kaynağı" açık sorusu burada çözülür. Arayüzü yok. | DOKUNMA (veri işi) | |

### B. Uygulama çerçevesi, yönlendirme, ortak parçalar

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Ekranlar ve yönlendirme | `src/app/App.tsx:89-399`, `main.tsx:28-45` | 3 ekran: gezi açıkken Sohbet + TripPanel (`.board`), başlangıç sohbeti, Seyahatlerim. Üstünde açılanlar: ItemDrawer, CompareView, Settings, HistoryDialog, ShareDialog, DeleteSharedTripDialog, toast'lar. Dil ya da para birimi değişince sayfa yeniden yüklenir (`main.tsx:41-45`). | Yeni tasarım yalnız TripPanel'in içini değiştiriyor; çerçeve (solda sohbet, sağda plan) aynı kalıyor. ItemDrawer ve CompareView'un yeni tasarımdaki karşılıkları "Ayrıntı kartın üstünde açılır" ve "Pano karşılaştırması". Bu ikisi App'ten kalkmalı ya da başka yere yönlendirilmeli (bkz. K). | UYARLAMA | |
| Gezi ••• menüsü | `App.tsx:170-222` (TripHero'ya `menu` olarak gidiyor) | Link ya da ekran görüntüsü ekle (sohbet kutusuna odaklar) · Belgeler · Bu geziyi paylaş / Paylaşım kodu · Planı PDF olarak indir · Rotayı haritada gör · Bu gezide yeni sohbet başlat · Geçmiş ve çöp kutusu · Ayarlar · Örnek geziyi yükle · Bu geziyi sil | v82 mozaik hero'sunda ••• menüsünün yeri çizilmedi (canlıda hero fotoğrafının üstünde duruyor). Menüdeki "Link ekle" sohbete gönderiyor; bu, yeni tasarımın "linkler sohbetten gelir" ilkesiyle uyumlu. | EVET (küçük: menünün hero'daki yeri) | |
| Hata sınırı ve hata şeridi | `ErrorBoundary.tsx:6-62` | Çökünce "Pano açılırken bir hata oldu" + rapor + Yenile / Kopyala; async hatalar için üstte ince şerit | Yok | DOKUNMA | |
| Güncelleme şeridi | `UpdateBanner.tsx:9-70` | Yeni sürüm: "yükleniyor… · Şimdi değil" ya da "Şimdi güncelle". Yazı yazılmışsa ya da pencere açıksa kendiliğinden yüklemez. | `safeToReload` sayfada `[aria-expanded="true"]` görünce bekliyor (satır 15). Akordiyonda hep bir kategori açık kalırsa (v78) otomatik güncelleme hiç olmaz, hep düğmeye kalır. Bugün de açık bölüm varken böyle. | UYARLAMA (teknik: seçici daraltılmalı) | |
| Çevrimdışı bildirimi | `OfflineNotice.tsx:7-42`, `reconnect.ts` | "İnternet yok · N kayıt bekliyor · N sn sonra tekrar deniyorum · Şimdi dene", "Tekrar deniyorum…", "Kaydedildi ✓" (ekranın altında) | Yapışkan ince şerit ve büyük Pano penceresiyle aynı alanı kullanabilir; yeri çizilmedi | UYARLAMA (yer) | |
| İş göstergesi | `WorkPill.tsx:12-68` (ana sayfa), TripPanel `WorkLine` | Üstte koşan ince ışık + "N kayıt işleniyor…" / "N kayıt eklendi ✓" | "Omurga yeni oluştu" sonrası öneriler gelmeye devam ediyor (`Generating.tsx:123-131`); bu bekleme yeni planda görünmüyor | UYARLAMA | |
| Toast ve "Geri al" aileleri | `App.tsx:293-310` (başka geziye düştü · Aç), `:365` (güvenlik notu), `:373` (gezi silindi · Geri al); `arrive/ArriveViews.tsx:104` (Göster); `cards/UndoToast.tsx` | En az 5 ayrı bildirim türü, farklı yerlerde | Yeni tasarımda bildirimlerin yeri çizilmedi. v79 "Gerek yok → niyet soluklaşır, Geri al" kararı, canlıdaki 8 saniyelik toast modeliyle çelişiyor. | EVET (tek bildirim düzeni) | |
| Sihirli açılış | `opening.ts:1-393` | Gezinin Planı ilk açıldığında parçalar sırayla gelir, sayaçlar sayar, maskot küresi kıvılcım saçar. `data-pit`, `data-count`, `data-pit-photo` işaretlerine bakar. | Yeni hero, niyet kutuları ve sayaçlar (n karar, %hazır) bu işaretleri taşımazsa açılış yalnız büyük blokları getirir | UYARLAMA (işaretleme) | |
| Ekran geçişleri | `viewTransition.ts:23-80` | Ana kutu → sohbetin ilk mesajı; gezi kartının fotoğrafı → hero fotoğrafı (`.hx .hx-photo`, satır 48) ve geri | Mozaik hero'nun kapak fotoğrafı bu seçiciyi korumazsa kart→hero büyümesi kırılır | UYARLAMA (seçici) | |
| Hareket dili | `hareketDili.ts:1-224`, `putFly.ts:1-60`, `exitMotion.ts:1-40` | Sekme vurgusu kayar (`.view-tabs`, `.plan-order`); görünüm yandan gelir (`.cat-plan`, `.trip-plan`, `.doc-tab`, `.pn`…); "Plana koy" uçuşu (düğmeyi yazısından bulur, hedef `[data-section]` sayacı ya da Plan sekmesi); pencere çıkış kopyası (`.modal`, `.drawer`, `.compare-modal`, `.pk-undo`) | Yeni Pano büyük pencere, Değiştir yerinde açılıyor, Etkinlikte "+ Plana koy" var. Hepsi bu sınıf ve işaret kancalarına bağlı. | UYARLAMA (teknik) | |
| panelBus | `panelBus.ts` | Menüden "Belgeler" ve "PDF" komutlarını TripPanel'e iletir | Yok | DOKUNMA | |
| Maskot | `Mascot.tsx:10` | 6 durum. Sohbet başlığında 34 px; boş ekranlarda, hata şeridinde ve açılış küresinde | Yeni planda maskot yok; mor küre renk diline uyuyor | DOKUNMA | |

### C. Seyahatlerim (ana sayfa)

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Seyahatlerim ekranı | `TripsHome.tsx:197-555` | Üst çubuk (logo, ₺ ve TR seçici, profil menüsü). "Merhaba Emre, sıradaki gezi nereye?" ve tek kutu: link verilirse kaydedip yerine dağıtır; yazı verilirse başlangıç sohbetini açar; var olan bir gezinin adı geçerse "X'e mi ekleyeyim, yeni gezi mi?" diye sorar. 5 başlangıç çipi, Bekleyen kayıtlar, işlem hapı, hata listesi, Yaklaşan / Geçmiş, taslak kartları, gezi kartları | Kendi tasarımı var (v11 görünümü, 2026-10-09). Lavanta-mor renkler yeni planla uyumlu. Kart→hero geçişi B'de. | UYARLAMA (küçük) | |
| Gezi kartı ve taslak kartı | `TripCard.tsx:54`, `:83` | Poster kart: fotoğraf, yüzler (2 kişi ve fazlasında), kalan gün, başlık (26/22/19 px), tarih · gün. Taslak kesikli: "n/6 bilgi · yarıda kaldı · Devam et" | Kapak `tripCardPhoto` (önce şehir fotoğrafı, sonra heroImage; `lib/tripBrief.ts:56`). Yeni hero'nun büyük kapağıyla aynı fotoğraf olmalı. Kartta "%hazır / n karar" yok; yeni şeritteki bilgi buraya da gelebilir. | UYARLAMA (isteğe bağlı) | |
| Arka plan çizimi | `HomeBackdrop.tsx:4` | Küre, kesikli rota, kağıt uçak | Yok | DOKUNMA | |
| Profil menüsü ve seçiciler | `TripsHome.tsx:118-188` | Para birimi, dil; menü: Seyahatlerim, Profil ve fotoğraf, Ayarlar · AI, Paylaşılan geziye katıl, Örnek gezi, Geçmiş ve çöp kutusu | Para birimi **yalnız burada** seçilebiliyor; gezi panosunda yalnız sohbetten ("bütçeyi euro göster"). Yeni hero'nun bütçe bölmesinde değiştirme yok. | DOKUNMA (not) | |
| Bekleyen kayıtlar | `TripsHome.tsx:334-339` (+ `Chat.tsx:326` RoutingLine) | Gezi yokken sorulan yer soruları | Yok | DOKUNMA | |
| Boş durum (ilk kez) | `TripsHome.tsx:448-475` | Maskot + 3 adım (Gemini anahtarı · simgeye tıkla ya da Alt+Shift+S · gezi kendiliğinden oluşur) + Örnek geziyi yükle | Yeni tasarımın çıkış noktası "prompt ya da linkle omurga"; adımlar hâlâ eski kaydet-önce akışını anlatıyor | UYARLAMA (metin) | |

### D. Yeni gezi başlatma

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Başlangıç sohbeti | `start/StartChat.tsx:110-958` | Solda sohbet: soru + hızlı cevap çipleri, Atla, Başka…, tarih seçici, tarz ve bütçe çipleri, rota önerisi ("Değiştir" ile "Ubud 12, Canggu 19" yazılabilir), etkinlik tarihi canlı aranır (resmî site linki), "Oluşturuyorum… 3 · Vazgeç" geri sayımı, Plan özeti. Sağda kontrol listesi. Dil ilk mesajdan seçilir; görüşme taslak olarak saklanır. | Omurgayı toplayan tek yer: şehirler, geceler, tarihler, kimler, nereden, tarz, şartlar. Yeni hero ve niyetlerin hepsini besler (bkz. b). Görsel dili (`--hx-accent` mor, hap çipler) yeni tasarıma pano sohbetinden daha yakın. Plana geçiş anı ("Omurga yeni oluştu" ilk karesi) çizilmedi. | UYARLAMA | Eski çizimleri var: `giris-akisi-v1..v3`, `2026-10-06-gezi-baslatma-v5` |
| Kontrol listesi kartı | `start/Checklist.tsx:56-185`, `start/Preview.tsx:38`, `:88` | "Gezin şekilleniyor n/6" halkası; satırlar (Nereye, Ne zaman, Nereden, Kimle, Ne istiyorsun, Rota) tıklanınca yeniden sorulur. Üstte fotoğraf mozaiği (1 büyük + 2 küçük) ya da şerit (seçim bu tarayıcıda saklanır). 860 px altında üstte ince çubuk: "4/6 · Gezin şekilleniyor ▾ · ✨ Oluştur". | Buradaki mozaik (1+2) ile yeni hero mozaiği (1 + 3×2) farklı düzende. Aynı fotoğraflar (yer + "an" fotoğrafları) hero'ya taşınabilir. | UYARLAMA (mozaik dilini hero'yla eşle) | |
| Oluşturma ekranı | `start/Generating.tsx:60-319`, `start/GenMap.tsx` | "X planlanıyor", rota · gece satırı, SVG dünya haritası (uçuş, iniş, duraklar düşer, fotoğraflar açılır), adımlar (gezi açıldı · uçuşlar için yer açıldı · geceler duraklara bölündü · kişi ve tarz · öneriler hazırlanıyor), ilerleme çubuğu. Hata olursa: Tekrar dene / Yine de aç / Sohbete dön. Bitince fotoğrafları gezinin `heroImage` ve `cityImages` alanlarına yazar (satır 182-198). | Bu ekranla yeni planın "Omurga yeni oluştu" hali arasında köprü yok. Adımların dili ("yer açıldı") yeni tasarımdaki "Aranıyor" durumuna denk geliyor. | UYARLAMA (son karede hero'ya geçiş) | |
| FlightMap | `start/FlightMap.tsx` | Yalnız `loadWorld` kullanılıyor; Rev 3 harita bileşeni ölü kod (envanter S33) | Yok | DOKUNMA | Temizlenebilir |
| Başlangıç kartı | `start/StartGuideCard.tsx:15-63`; yeri `TripPanel.tsx:859` | Yeni gezinin planının üstünde bir kez görünür: "X hazır · Üç adımda yola hazır" · Uçuşları bul · Konaklamaları seç · Önerilere bak · "Başlangıç yaklaşık: … · Bu tarih doğru" · × | v81 "hero ile kategoriler arasındaki durum açıklaması kalksın" diyor; v82 "hero, 40 px boşluk, sonra Plan başlığı" diyor. Bu kart tam o araya düşüyor ve yeni tasarımda yeri yok. Yaklaşık tarih uyarısının da hero şeridinde karşılığı yok. | EVET (kaldır ya da Plan başlığına / hero şeridine göm) | |
| Başlangıç modları ve gezi türleri | `TripsHome.tsx:62-68`, `lib/startTrip.ts:2120-2126`, `lib/playbooks/` | Yeni gezi planla · Bana ilham ver (yer önerir) · Yol gezisi (uçuş yerine araç kiralama) · Son dakika kaçamağı · Paylaşılan geziye katıl. Gezi türü kalıpları: classic, festival, honeymoon, ski, wellness. | Yeni tasarımın tek örneği klasik Japonya turu. Yol gezisi (uçuş yok, "Araç kiralama" niyeti), festival (etkinliğin kendi durağı 🎪, tahmini tarih + resmî site) ve kayak için niyet kutuları ve hero çizilmedi. | EVET (en az yol gezisi + festival) | |
| Taslaklar | `lib/startDrafts.ts` | Yarım kalan görüşme taslak kart olarak bekler; "Taslak silindi · Geri al" | Yok | DOKUNMA | |
| Omurgayı kuran kod | `lib/startCreate.ts:37-70`, `lib/startTrip.ts` (creationOf), `lib/playbooks/index.ts:190`, `start/registerReview.ts:20-46` | Gezi kaydı; her şehir için konaklama yer tutucusu; gidiş-dönüş uçuş yer tutucusu (`startGuide.placeholders`: "seçim değil, doldurulacak yer"); kişiler; tarz; şartlar (`trip.requirements`, `wantedAmenities`); öneri incelemesi (eSIM, sigorta, vize, hazırlık, etkinlik önerileri) | Yer tutucular yeni tasarımdaki "Aranıyor" durumuna denk. v79'daki "Omurga yeni oluşunca AI seçer: ✨ Önerimiz · onayla" için kodda karşılık **yok**: AI seçim yapmıyor. Boş kartın altındaki "Senin için N öneri" satırı (`cards/OfferRow.tsx`, `lib/stayPicks.ts`) var, ama ancak tıklanınca kayda geçiyor. | Tasarım değil, veri / mantık eksiği | Bkz. (b) |

### E. Gezi sohbeti (pano sohbeti), link bırakma, gelenler

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Sohbet sütunu çerçevesi | `Chat.tsx:176-311`; `static/app.css:31-37`, `:41-104` | Üstte "← Seyahatlerim", maskot + "Asistan" (26 px), "X için". Mesajlar. Yazı kutusu (📎 belge/görsel; "Bir link bırak, görsel yapıştır veya yaz…"). Sütun genişliği `clamp(360px, 34%, 540px)`. | v80 sohbeti `clamp(300px, 26%, 400px)`'e daralttı; canlı hâlâ %34. Yazı ölçeği ve renkler yeni sisteme uymuyor (bkz. a). | EVET (v73'teki asistan çizimi başlangıç noktası) | |
| Asistan cevabı | `Chat.tsx:237-245`, `:440-506` | **Kalın** yazı; yalnız web kaynaklarına link; gezinin seçenek adları "Jardim Stay ↗" düğmesi olur (`chat-ref` → karta gider); "değişiklik yapılmadı" notu; ChatOffers | Ad düğmesi `goToOption` (satır 433) Pano açıksa Pano kartına, değilse `requestReveal` ile plana gidiyor. Yeni tasarımda hedef niyet kutusu ya da (ilk 3'ün dışındaysa) Pano olmalı. | UYARLAMA (gidilecek yer) | |
| Değişiklik satırları ve katlama | `Chat.tsx:228-236`; `ChatFold.tsx:6-45` | "✓ Casa Azul kaydedildi → Konaklama" satırı tıklanınca karta gider (ipucu "Panoda göster"). Art arda 4 ve fazlası "12 değişiklik ▾" altında toplanır. | v73'teki "Planda göster" iniş kartı ("Konaklama · Kyoto · 3 yeni seçenek · Planda göster") bunun yeni hali olmalı. Canlıda kart yok, 12 px soluk bir satır var. | EVET (iniş kartı) | |
| Hızlı yanıtlar | `Chat.tsx:256-264` (`offer_choices`) | Son cevabın 2 seçeneği: ilki koyu dolu düğme, ikincisi mavi bağlantı | v73'te çip olarak çizildi ("Hotel Kanra'yı seç · Daha ucuz · Ryokan olsun"). Niyet kutusundaki "Bunu seç" ile aynı işi yapan bir çip eyleminin kurallara bağlanması gerekir. | EVET (çip) | |
| Sohbetteki öneri kartları (`find_offers`) | `ChatOffers.tsx:15-79`; `app.css:58-76`; `actions.ts:282`; `lib/offerSource.ts:225-247` | Cevabın altında en çok 3 kompakt kart: seçim etiketi (Sana en uygun / Daha ekonomik / Daha konforlu), başlık linki, puan, kaynak, "✨ neden", fiyat (toplam + / gece), "Ekle" → "Eklendi ✓". Eklenen, niyetin seçeneği olur (`addedBy: "ai"`). | Planda aynı teklif uçuşta Skyscanner satırı (logo, saatler, süre/aktarma, bagaj, fiyat, Seç), otelde Booking kartı (fotoğraf, marka, ad, konum, puan, fiyat, Seç) olarak görünecek. Sohbette fotoğraf, logo ve saatler hiç çizilmiyor; oysa `Offer.photo`, `carrier`, `depart/arrive`, `durationMinutes`, `stops` verisi var. Eylem adı farklı (sohbette "Ekle", planda "Seç / Bunu seç"); etiket farklı ("Sana en uygun" ↔ "Önerimiz"). | EVET (sohbetteki kart = niyet seçeneğinin küçük hali) | |
| Yönlendirme satırları | `Chat.tsx:326-430` (RoutingLine) | "↪ … Bali gezine eklendi · Aç · Geri al"; yer uyuşmazlığı sorusu; başka ülkeden kalmış kayıt ("X gezisine taşı / Burada kalsın / Plandan çıkar"); aynı şey iki kez kaydedilmiş ("Birleşik kalsın / Ayrı tut") | "Aynı otel iki kez", "başka gezinin kaydı" gibi durumlar niyet kutusunda ya da Pano'da görünmüyor, yalnız sohbette soruluyor. Kutuyla aynı görsel dilde olmalı. | UYARLAMA (görsel dil) | |
| Adım satırları, düşünme, maskot yüzü | `Chat.tsx:265-279`; `thinking.ts:10-25` | "Lizbon otelini fikre alıyorum…" adımları; "Düşünüyor… / Web'de arıyorum… / Fiyatlara bakıyorum… / Uzun sürüyor…" | Plandaki "AI'dan öner / Daha fazla öner" basılınca bekleme halini kim gösterecek (sohbet mi, kutu mu, ikisi mi) çizilmedi. v73'te "arıyorum" satırı var. | UYARLAMA | |
| Sohbet hata şeridi | `Chat.tsx:193-212` | "Asistana bağlanamadım · Ayarlar'a git" / "İnternete bağlanamadım" | Yok | DOKUNMA | |
| Sohbete link ve dosya bırakma | `Chat.tsx:112-174`; `capture.ts:33-119`; `arrive/ChatArrivals.tsx:86-144`; `arrive/ArriveViews.tsx:121`, `:138` | Yalnız linkten oluşan mesaj kayda dönüşür. PDF ve görsel Belgeler'e gider ve okunur. Sürükle-bırak örtüsü var. Her link ve dosyanın altında çip: site · dönen halka · "→ Konaklama · Ad · göster" / "⚠ Okunamadı · Tekrar dene". | Yeni tasarım "linkler sohbetten gelir" diyor (v78); v82 niyetteki notu da kaldırdı. Çip kategori söylüyor, niyet söylemiyor; "→ Kyoto oteli · 4. seçenek, Pano'da" gibi olmalı. "göster" niyet kutusuna ya da Pano'ya gitmeli. | UYARLAMA (çip metni + hedef) | |
| Panoya bırakma / yapıştırma | `arrive/useBoardIntake.ts:19-48`; `App.tsx:241` | Plan alanına link ya da dosya sürüklenir veya yapıştırılırsa bu geziye girer; "Bırak, okuyup doğru yere koyayım" örtüsü | Yeni tasarım yapıştırma alanlarını kaldırdı; ama sayfa geneline bırakma canlıda var ve tasarımda yok. Hangi niyete düşeceği tahmin edilmiyor, yalnız kategori tahmin ediliyor (`predictSection`). | UYARLAMA | |
| Gelen içerik (bekleyen kart, halka, toast) | `arrive/useArrivals.tsx:50-230`; `ArriveViews.tsx:41-118` | Okunurken bölümün başında kesikli iskelet kart ("Okunuyor… / Bekliyor…"; hata: Tekrar dene · Kaldır) ve bölüm kendiliğinden açılır. Gelen kart halkayla belirir, sayaç zıplar. Görünmüyorsa "Konaklama'ya eklendi: X · Göster". | Akordiyonda (tek açık kategori) bekleyen kartın kategoriyi zorla açması diğerini kapatır. v82'nin sabit yüksekliğinde (76 + 196 px) bekleyen kartın yeri yok. 4. seçenek olarak gelen kart görünmez ("ilk 3, tümü Pano'da"), halkanın hedefi kalmaz. | EVET (niyet içinde "okunuyor" hali + gelen kartın gösterimi) | |
| Dil değişimi | `langSwitch.ts:9-34` | Sohbette "Türkçeye geç" → sayfa yeniden yüklenir, "Geri al" toast'ı çıkar | Yok | DOKUNMA | |
| Yeni sohbet | `App.tsx:201` (`resetConversation`) | Sohbet bağlamını sıfırlar | Yok | DOKUNMA | |

### F. Ayarlar, profil, AI kapısı

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Ayarlar penceresi (ilk kurulum dahil) | `Settings.tsx:53-272` | Dil / Language, Profilim, Pasaport (TR/DE/GB/US/Diğer), Gemini · ücretsiz / Claude · ücretli, anahtar yapıştırılınca otomatik kontrol edip kapanır, model seçimi, ücretsiz katman uyarısı, AI kapısı, Hareketi duraklat, Gelişmiş (paylaşım sunucusu), tanı dosyası, dışa aktarma, Kaydet | Yeni kullanıcının **ilk gördüğü ekran** (`background.ts:98`). Görünüşü genel form: mavi bağlantı, koyu düğme. Yeni planla doğrudan ilişkisi yok, ama ilk izlenim. | EVET (düşük-orta öncelik) | |
| AI kapısı | `AiGateSettings.tsx:11-146` | Davet edenin anahtarını paylaşması, onay bekleme, aylık kullanım, davet kapatma | Yok | DOKUNMA | |
| Profil | `Profile.tsx:36-134` | Ad (paylaşım adı), fotoğraf; yol arkadaşlarına fotoğraf (`PersonPhoto`, "Kimler gidiyor") | Yeni hero şeridindeki kişiler ve yüz halkaları bu veriden geliyor | DOKUNMA | |

### G. Paylaşım

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Paylaş penceresi / katıl | `Share.tsx:178-355` | Kod üret, kopyala, durdur; katıl (kod + ad); sunucu ayarı yoksa "Ayarlar'a git" | Yok | DOKUNMA | |
| Oylar | `Share.tsx:115-151` (kartta VoteBar 👍👎), `lib/share/votes.ts` (Pano'da Olmaz / Olur / Süper 🤩, Favori) | Paylaşılan gezide seçeneklere oy; herkes 👎 derse seçenek geri çekilir | v79/v81 Pano tasarımı "beğeni (♥ + avatarlar)" diyor. Canlıdaki 2–3 seviyeli oyla aynı şey değil. | EVET (karar: ♥ mı, 👍👎🤩 mı) | |
| Değişiklik bildirimi | `ShareSafety.tsx:89-99`; yeri `TripPanel.tsx:856` | "Sabine tarihleri değiştirdi: 7–18 → 8–18 · Geri al · Tamam" | Hero ile plan arasına düşüyor; yeni tasarımda yeri yok | UYARLAMA (yer) | |
| Paylaşılan geziyi silme | `ShareSafety.tsx:102-152` | "Yalnız senin bilgisayarından silinir" uyarısı | Yok | DOKUNMA | |
| Eşitlemenin kapsamı | `lib/share/sync.ts:1-7`, `lib/share/settings.ts:1-3` | Eşitlenen: ad, tarih, bütçe, öncelikler + kayıtlar + oylar. "Her kişinin seçimleri kendi bilgisayarında kalır." | Yeni tasarım paylaşılan gezide "Sabine Gora Kadan'ı rezerve etti", Seçildi/Alındı ve "kim ne koydu" gösteriyor. Seçim ve rezervasyon durumları eşitlenmiyor; iki kişi farklı plan görür. | Tasarım değil: ürün / veri kararı | |
| Son ziyaretten beri | `PanoNewsTip.tsx`, `usePanoDot.ts`, `lib/share/activity.ts` | Pano sekmesinde nokta + ipucu | Yeni Pano tasarımında yok | UYARLAMA | |

### H. Geçmiş, çöp kutusu, geri al

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Geçmiş ve çöp kutusu | `HistoryDialog.tsx:47-309`; `lib/history.ts:192` | Gün gün: ayar değişikliği (Geri al), eklenenler (Panoda göster), çöptekiler (Geri getir, Kalıcı sil), gizlenenler ("Gerek yok" denenler: Geri getir), öneriler; Ben / diğer süzgeci. Gezi açık değilken silinen gezileri gösterir. | v79'da "Gerek yok" denen niyet kutuda soluk kalıyor ve "Geri al" ile dönüyor. Canlıda gizleniyor; ancak bölüm sonundaki "Gizlenenler"den ya da Geçmiş'ten dönüyor. "Panoda göster" niyet kutusuna gitmeli. | UYARLAMA | |
| Çöp kutusu | `lib/trash.ts:47-228` | 30 gün durur, aynı kimliklerle geri gelir; yalnız bu bilgisayarda | Yok | DOKUNMA | |
| Tek "Geri al" yuvası | `lib/undo.ts`, `cards/UndoToast.tsx` | 8 saniyelik halkalı "X silindi · Geri al" | B'deki toast ailesi | UYARLAMA | |

### I. Çıktılar

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| PDF | `PrintPlan.tsx:169-403`; `TripPanel.tsx:807`, `:617-640` | A4 dosya: hero'nun DOM kopyası (`.hx-go, .hx-alt, .hx-menu, .hx-acts…` silinir, yalnız `.hx-photo img.on` kalır; satır 182-184), Rezervasyonlar tablosu, Gün gün | Mozaik hero farklı sınıflarla gelirse PDF'e düğmeler, 7 fotoğraf ve açılır pencereler girer. Plan %100 olunca hero'nun ana düğmesi "Planı PDF olarak indir"di; yeni hero'da bu düğme yok. Rezervasyonlar bölümü yeni "Alındı = erişim modu" (onay kodu, giriş saati, adres) ile aynı bilgiyi vermeli. | EVET (PDF'in yeni sayfası) + UYARLAMA (hero kopyası) | |
| Belgeler | `docs/DocsTab.tsx:51-178`; yeri `TripPanel.tsx:926` | Menüden açılan üçüncü sekme: gruplu dosyalar, karta git, aç, sil (8 sn), "Bir karta bağla…" | v79'da Pano'da "Belgeler" sekmesi vardı, v81'de Pano'dan çıktı. v82'de Alındı kutusunda "Belgeyi aç / Belgeyi ekle" var. Belgelerin toplu görünümünün yeni yeri belli değil. | EVET (küçük: nerede duracak) | |
| Rotayı haritada gör | `App.tsx:194-199` | Google Maps rota bağlantısı | Yok | DOKUNMA | |

### J. İçerik ve iş kuralları

| Yüzey / özellik | Nerede | Ne yapar, hangi durumlar | Yeni tasarımla ilişkisi | Tasarım? | Not |
|---|---|---|---|---|---|
| Ortaklık bağlantıları | `lib/affiliate.ts:19-99`; kurulumu `main.tsx:24` | Tıklanan bağlantı ortak bir markanın sayfasıysa tp.media'dan geçirir (Booking, Agoda, Trip.com, GetYourGuide, Viator, Klook, Aviasales, Kiwi, Omio, Airalo…). Rezervasyon ve hesap sayfaları hiç çevrilmez. | v81'deki dinamik sağlayıcı kaydı (`ortaklıkParametresi?`) bununla birleşmeli. Tasarımda öne çıkan Skyscanner, Google Uçuşlar, Airbnb, JR, Rome2rio, Trendyol, Hepsiburada ve Amazon ortak değil, yani gelir getirmez. Düğmeler `<a href>` olmalı: çevirici yalnız bağlantı tıklamasını yakalıyor. | UYARLAMA (kod kuralı) | PRIVACY §8'deki ortak listesi de güncellenmeli |
| Örnek gezi | `lib/demo.ts:57-426` | "Portekiz (örnek)": Porto + Lizbon, birkaç otel seçeneği, rezerve uçuşlar; fotoğraf yok (`heroImage: null`, `imageUrl: null`) | Yeni tasarımın gösterdiği durumların çoğu örnekte yok: Önerimiz, PNR'li Alındı, Ayarlandı, Gerek yok, Hazırlık, İlham, çok şehir. Yeni kullanıcı yeni tasarımı boş ya da zayıf görür. Mağaza ekran görüntüleri de buradan çekiliyor. | UYARLAMA (içerik: Japonya örneği) | |
| Elle ekleme şablonları | `lib/templates.ts`; `cards/AddSheet.tsx`; `TripPanel.tsx:964` | "+ Ekle": 18 şablon (uçuş, tren, otobüs, minibüs, feribot, taksi, araç / motor / karavan / bisiklet kiralama, otel, ev, etkinlik, yapılacak, restoran, eSIM, sigorta, not) | v81'de "Ekle" kalktı. Elle niyet ekleme (dışarıda alınmış otel, ikinci uçuş) yeni tasarımda yok; yalnız sohbet kalıyor. | EVET (karar: elle ekleme nereden) | |
| İngilizce arayüz | `lib/i18n.ts:18-62`, `lib/i18nText.ts` | Bkz. (c) | | UYARLAMA | |
| Mağaza vaadi | `store/listing.md` | Kaydet · Karar ver · Gün gün plan · Fikir havuzu · Birlikte planla (oylar) · Belgeler; 4 ekran görüntüsü (hero, plan, etkinlikler, gün gün) | Gün gün çizilmedi. "Oylar" ↔ beğeni farkı var. Ekran görüntüleri yeni tasarımla eskiyecek. | UYARLAMA (yayında) | |
| Gizlilik | `PRIVACY.md` §8 (satır 128-166) | Dış hizmetlerin listesi (Nominatim, OpenFreeMap, Wikipedia/Unsplash/Pexels, AeroDataBox, logo sunucuları, öneri kaynakları, Travelpayouts) | Yeni tasarım iki yeni veri akışı istiyor: Places API (fotoğraf ve logo) ve İlham'daki "İçinden yerleri çıkar" (reels, YouTube, TikTok). İkisi de §8'e girmeli. | UYARLAMA (metin; yayından önce zorunlu) | |

### K. Plan sayfasının içinde olup v77–v82'de çizilmeyenler (kısa)

| Yüzey | Nerede | Not |
|---|---|---|
| Gün gün (Kompakt / Liste / Kartlar) | `TripPanel.tsx:883-891`, `:927-937` (TimelineView) | v81: "Gün gün henüz çizilmedi". Eski `gunluk-akis-*` çizimleri var ama yeni yazı ölçeğine uyarlanmadı. |
| Harita sekmesi | `TripPanel.tsx:889`, `:924` (BoardMap, MapLibre + OpenFreeMap) | Yeni görünüm seçicide (Kategoriye göre · Yolculuk sırasıyla · Gün gün) yeri yok. |
| Kart çekmecesi (ItemDrawer) | `App.tsx:312`; `ItemDrawer.tsx` | Kaynak doğrulama (URL'den / sayfada doğrulandı / ekran görüntüsünden), fiyat kapsamı, puan dökümü, Plana al / Rezerve ettim / Çıkar. **"Gezi: başka geziye taşı / + Yeni gezi"** yeni "Ayrıntı" panelinde yok. |
| Eski karşılaştırma penceresi (CompareView) | `App.tsx:327` | Pano karşılaştırmasıyla yer değiştirmeli; iki ayrı karşılaştırma kalmamalı. |
| Yapılacaklar listesi (TodoList) | `TripPanel.tsx:805`; `Progress.tsx` | Hero'daki "Planı tamamla" listesi: karar bekleyenler, rezerve edilecekler, belge eksikleri, iptal süresi dolanlar (⏳). Yeni hero'da tek bir "Sıradaki" var; liste ve iptal son günleri yok. |
| Başlangıç kartı, değişiklik bildirimi | `TripPanel.tsx:856-873` | D ve G'de. |
| Gizlenenler | `plan/HiddenList.tsx` | "Gizlenenler · N göster" bölüm sonunda; v79'daki "soluk niyet + Geri al" ile çelişiyor. |
| Plan uyarıları ve başarısız kayıtlar | `TripPanel.tsx:831-853`, `:916`, `:929` | "⚠" notları ve "Tekrar dene" listesi; yeni tasarımda yeri yok. |
| Tarihsiz fikirler | `TripPanel.tsx:934` (UndatedIdeas) | Gün gün'e bağlı. |
| Renk sözlüğü | `Status.tsx`, `app.css:4633-4643` (`--plan-*`, `--book-*`) | Canlıda Seçildi = beyaz zemin + açık yeşil çizgi (◷); yeni tasarımda Seçildi = kum, Önerimiz = mor. Tek bir renk sözlüğü kararı gerekli. |

---

## 3. Ayrıca istenen sorular

### (a) Sohbet sütunu yeni plan tasarımıyla nerede çakışıyor?

**Yazı ölçeği.** Yeni plan sayfasının 9 basamağı: 11 · 12 · 13,5 · 15 · 17 · 19 · 22 · 24 · 30. Sohbetin canlı değerleri
(`app.css`):

| Öğe | Canlı | Yeni ölçekte |
|---|---|---|
| `.chat-title` "Asistan" | 26 | yok (24 ya da 30) |
| `.msg-assistant` | 16,5 | yok (15 ya da 17) |
| `.msg-user` | 15,5 | yok (15) |
| Boş sohbet ipucu | 16 | yok |
| `.composer input`, `.thinking` | 15 | ✓ |
| `.choices` düğmeleri | 14,5 | yok |
| `.chat-sub`, `.chat-steps`, `.co-title` | 14 | yok |
| `.msg-route`, `.msg-note` | 13,5 | ✓ |
| `.small-btn` | 13 | yok |
| `.co-meta`, `.co-why`, `.ev-fold-btn` | 12,5 | yok |
| `.msg-event`, `.co-per` | 12 | ✓ |
| `.co-pick` | 11 | ✓ |

v73'teki asistan çizimi 4 basamak kullanıyordu (20 / 16 / 13,5 / 12). Bu da v81 ölçeğiyle örtüşmüyor; iki yol birleştirilmeli.

**Renkler.** Sohbette bağlantılar, ad düğmeleri (`.chat-ref`), çip düğmesi ve `btn-link` **mavi** (`--accent #1768ff`).
Birincil düğme koyu (`--ink #2b2230`, 16 px köşe). Yeni tasarımda tek CTA rengi **mor** (`#5b45e0`; v71 kararı), başarı
rengi `#1f7a45` (canlıda `--success #1f8f4e`). Başlangıç sohbeti zaten moru kullanıyor; pano sohbetiyle başlangıç
sohbeti bugün iki ayrı görsel dilde.

**CTA.** Sohbette öneri kartının eylemi "Ekle" (gri küçük düğme) → "Eklendi ✓". Planda aynı seçeneğin eylemleri "Seç /
Bunu seç / Rezerve et / Aldım". Hızlı yanıtların ilki koyu dolu, ikincisi mavi bağlantı. Karar verilmesi gereken soru:
sohbetteki kart "seçeneklere ekle" mi yapacak, doğrudan "seç" mi, yoksa yalnız "Planda göster" mi.

**"Planda göster".** Canlıda bu yazı yok. Yerine üç giriş var, üçü de `requestReveal(itemId)` çağırıyor
(`arrive/intake.ts:136`):

- değişiklik satırı (ipucu "Panoda göster"; `Chat.tsx:232`),
- link / dosya çipindeki "göster" (`ChatArrivals.tsx:106`, `:114`),
- cevaptaki seçenek adı (`chat-ref`, ipucu "Kartta göster"; Pano açıksa önce Pano kartına bakar: `Chat.tsx:433-437`).

İstek `TripPanel.reveal`'e gidiyor (`TripPanel.tsx:221-232`). Sayfada `[data-item-id]` varsa onu parlatıyor. Yoksa
bölümünü açıp görünümü "plan"a çeviriyor. Bulamazsa Gün gün'e geçiyor. Yeni tasarım için açık kalanlar:

1. Akordiyonda hedef kategori açılınca o an açık olan kategori kapanacak mı?
2. Hedef 4. ya da sonraki bir seçenekse kutu yalnız ilk 3'ü gösteriyor. O niyetin Pano'su mu açılacak?
3. Seçili bir seçenek varsa diğer seçenekler gizli. Hedef onlardan biriyse "Değiştir" hali mi açılacak?
4. "Yolculuk sırasıyla" görünümündeyken bugün her zaman "Kategoriye göre"ye geçiyor. Görünüm korunup adım mı gösterilecek?
5. Yeni Pano kartları `pn-<id>` kimliğini korumalı; yoksa sohbet Pano kartını bulamaz.

**Sohbetten gelen seçenek niyet kutusuna nasıl düşüyor.** ChatOffers "Ekle" → `addChatOffer` (`actions.ts:282`) →
`offerItem` (`offerSource.ts:225-247`). Sonuç: `status: "saved"`, `addedBy: "ai"`, sağlayıcı, link, fotoğraf, puan,
toplam fiyat ve uçuş satırı. Kayıt aynı ihtiyaç anahtarıyla o niyetin seçenekleri arasına girer; `useArrivals` halkasını
ve toast'ını gösterir. Yeni tasarımdaki ✨ AI rozeti `isAiOption` (`lib/pano.ts:64`) ile türetilebilir.

Kullanıcının sohbete attığı link ise `paste-link` yakalaması olur. Kaydında `addedBy` boştur ya da paylaşan kişinin adıdır
(`lib/process.ts:215`); 🔗 ya da yüz rozeti buradan türetilebilir. "Önerimiz (AI seçti, onay bekliyor)" için ayrı bir
durum yok: kodda yalnız `saved / chosen / booked / dismissed` var.

**Davranış çakışmaları.**

- Plandaki "AI'dan öner / Daha fazla öner" ile sohbetin `find_offers` aracı aynı işi yapıyor. Sonuç kutuda mı, sohbette mi,
  ikisinde birden mi görünecek kararı gerekli. Bugün boş kartın teklif satırı (`OfferRow`) ve sohbet ayrı ayrı çalışıyor.
- v80'deki daralmayla (300–400 px) sohbetin içeriği yeniden çizilmeli: ChatOffers'ın "başlık | fiyat" düzeni ve
  RoutingLine'ın 3 düğmesi 300 px'de sıkışıyor (`.chat-offer` için 420 px kuralı sohbet genişliğine değil, ekran
  genişliğine bakıyor).

**Mevcut sohbet tasarımı nerede?** v73 (Mac yolu, 17 Ekim) asistanı çizdi: iniş kartı ("Konaklama · Kyoto · 3 yeni seçenek
· Planda göster"), hap çipler, "Kyoto'da yapılacakları arıyorum" satırı, mor gönder düğmesi, 360 px sütun. Emre'nin
"AI sohbet tasarımı var" dediği büyük olasılıkla bu. v77–v82 bunu almadı; iki yol karşılaştırılırken sohbet ayrıca
birleştirilmeli.

### (b) Başlangıç akışı hero mozaiğini ve niyet kutularını besleyebiliyor mu?

**Fotoğraf: kısmen.**

- Başlangıç sohbeti arka planda fotoğraf arıyor (`start/model.ts:135-154`, `findPhotos`). Kaynak, paylaşım sunucusu
  üzerinden Pexels/Unsplash; o yoksa Wikipedia.
- Aranan: yerler (ülke, şehir, duraklar; en çok 4) + "an" fotoğrafları (tarz başına bir sahne: Romantik akşam, Yerel
  lezzetler, Doğa…; en çok 3; etkinlik gezisinde yok). Toplam en çok 7 (`lib/startTrip.ts:2948-2971`).
- `Generating.keepPhotos` (`Generating.tsx:182-198`) ilk fotoğrafı `heroImage`, ötekileri yer adı anahtarıyla
  `cityImages`'a yazıyor. "An" fotoğrafları da etiketleriyle (ör. "romantik akşam") `cityImages`'a giriyor ve panoda
  **hiç kullanılmıyor**.
- Pano açılınca ana şehirlerin eksik fotoğrafları ayrıca aranıyor (`TripPanel.tsx:374-422`).

Mozaiğe denk düşenler:

- Büyük kapak = `heroImage` ✓
- "Şehirler" hero'su ve "Yolculuk sırasıyla" şehir kareleri = `cityImages` ✓
- 6 kare "yolculuk nasıl olacak" (Shibuya Sky, Fushimi Inari…) ✗: adı olan yer fotoğrafı yok. Omurga yeni oluştuğunda
  plan da boş; yalnız yer tutucular var.

Bu kareler zamanla dolabilir: kayıtların `imageUrl`'i (sayfadan 8 fotoğraf toplanıyor), tekliflerin `Offer.photo`'su,
ileride Places API. Öneri: yeni gezide 6 kare için "şehir + an" yedeği kullanılsın, plan doldukça gerçek yerlerle
değişsin. "An" fotoğrafları da `cityImages` yerine ayrı bir alanda tutulsun.

**Şehir sırası: evet.** Rota durakları (şehir, gece) sırayla konaklama kayıtlarına tarihleriyle yazılıyor
(`startCreate.ts:41-48`: "Rota çizildi: Ubud 12 gece → Canggu 10 gece"). Rota ya klasik güzergâh (`startCircuits`) ya
modelin önerisi; aynı şehre dönüş tekrar ediyor (Cape Town → Tankwa → Cape Town). Bu veriyle şunlar kurulabilir: hero'daki
"Tokyo · Kyoto · Hakone · Osaka", niyet özetindeki "Tokyo 3 · Kyoto 4…", gece sayısına göre şehir sütunları ve
"Yolculuk sırasıyla" bölümleri.

**Tarihler: evet, ama üç hal var.**

- kesin (`confirmedDates`),
- yaklaşık (`startGuide.approxStart`; bugün yalnız StartGuideCard söylüyor),
- yalnız süre ("geceler tarihle gelir").

Etkinlikte ayrıca tahmini tarih + resmî site var. Yeni hero şeridinin tarih bölmesinde "yaklaşık / tarih yok / tahmini"
halleri çizilmedi. "Yolculuk sırasıyla"da tarih yoksa "esnek" yazıyor (v81), bu kısmen karşılıyor.

**Niyet kutuları: iskelet evet, seçim hayır.**

| Ne kuruluyor | Nerede |
|---|---|
| Konaklama (şehir başına, yer tutucu) | `startCreate` |
| Uçuş (gidiş/dönüş, yer tutucu; yol gezisinde araç kiralama) | `startCreate` |
| Kişiler, tarz | `startCreate` |
| Şartlar (gezi düzeyinde `requirements` / `wantedAmenities`; niyetin "istek" satırı bunlardan türetilmeli) | `playbooks/index.ts:190` |
| Öneriler (eSIM, sigorta, vize, hazırlık, etkinlik) | `registerReview.ts:20-46` |
| Başlangıç görüşmesi gezinin sohbetine taşınıyor ("Sohbet geziye taşındı") | `startCreate` |

Bunlar yeni tasarımdaki "Aranıyor" durumunu dolduruyor. **Eksik olan**, v79'daki "Omurga yeni oluşunca AI her niyete seçer
(✨ Önerimiz · onayla)". Oluşturma adımları teklif aramıyor; boş kartın teklif satırı kayda geçmiyor. Bunun için oluşturma
ekranına "her niyete en iyi teklifi bul" adımı ve "önerildi" durumu eklenmeli (maliyet: teklif kaynağı ve kota, bekleme
süresi).

### (c) İngilizce arayüz: karşılıklar gerekecek mi?

**Evet.**

- Kayıtlı dil yoksa tarayıcının dili kullanılıyor; Türkçe değilse arayüz İngilizce (`lib/i18n.ts:40-57`). Yani TR dışındaki
  her kullanıcı İngilizce görüyor.
- Dil üç yerden değiştiriliyor: Seyahatlerim üst çubuğu, Ayarlar ("Dil / Language"), sohbet ("switch to English").
- Kural: her metin `L("tr", "en")` (`i18n.ts:18`). 222 dosyada yaklaşık 3.300 `L(` çağrısı var. Tarih ve sayılar `locale()`
  ile (tr-TR / en-GB).
- Türkçe ekler için yardımcılar: `locative`, `ablative` (`lib/i18nText.ts:78-89`), `dative` (startTrip), `nNights`,
  `nOptions`, `nStops`, `count`.
- Test `tests/i18n-content.test.ts` model istemlerinin, şemaların ve örnek gezinin İngilizce olduğunu denetliyor. "Türkçe
  metin L() dışında kaldı mı" diye genel bir tarama **yok**.

Yeni tasarımın getirdiği ve her biri L() isteyen metinler (mockup'lar yalnız Türkçe):

- **Durumlar:** Karar bekliyor · Önerimiz · onayla · Seçildi · Alındı / Rezerve edildi / Bilet alındı · Ayarlandı / Sen
  hallettin · Aranıyor · Gerek yok · Şu an seçili.
- **Eylemler:** Bunu seç · Seç · Değiştir · Vazgeç · Aldım · Rezerve et · Satın al · E-bilet aç · Onay e-postası aç ·
  Belgeyi aç / ekle · Fiyat ekle · Kendin ara · AI'dan öner · + Plana koy · Planda · Daha fazla öner · Özeti küçült / aç ·
  Haritada aç · Otele yaz.
- **Özetler:** "4 şehir · 14 gece · 10 fikir", "1 alındı · 1 seçildi · 2 karar", "4 · ilk 3, tümü Pano'da", "+n Pano'da",
  "Henüz plana koymadın", "2/6 hazır", "%50 hazır · 7 karar".
- **Pano:** Tümü · Biriktirdiklerim · AI önerileri · İlham · İhtiyaçlar · "AI uyum puanı n/100 · n. sırada" (İngilizcede
  sıra sayısı 1st / 2nd / 3rd ister) · "İçinden yerleri çıkar".
- **Türkçe ek isteyen cümleler:** "Osaka'da 4 gece için nerede kalınır" (locative), "Booking.com'da ara" ("Search
  Booking.com"), "Check-in 15 Nis 11:00'de açılır" (ek saate göre değişir: 11:00'de / 10:00'da), "Sende 12:00 iken orada
  18:00", "tahmini €90–160 / gece".

Riskler:

1. v82'nin sabit ölçüleri (başlık 76 px, gövde 196 px, yan sütun 232 px, düğme 42 px) iki dilde ayrı ölçülmeli; düğme
   yazıları dile göre kısalıp uzuyor. e2e'ye İngilizce ölçüm eklenmeli.
2. AI'nın yazacağı metinler (artı/eksi, "niyetine uyuyor mu", uyum puanı açıklaması, bölge kartlarındaki "neden") panonun
   dilinde istenmeli ve `i18n-content` testine eklenmeli.
3. Başlangıç sohbeti ilk mesajın dilinde konuşuyor (`state.lang`), pano kayıtlı dilde. Türkçe arayüzde İngilizce yazan
   kullanıcı İngilizce gezi metinleriyle Türkçe pano görebilir (PDF `trip.lang` kullanıyor).
4. v81'deki sağlayıcı kaydı ("Türkiye'den gidene Trendyol / Hepsiburada") dile değil kullanıcının ülkesine bağlanmalı.
   Kaynak `loadHome` / `loadPassport` olabilir.

### (d) Telefon / dar genişlik: eklenti hangi genişlikte açılıyor, 390 px gerekli mi?

**Açılış şekli.** Yan panel yok. Popup 320 px ve yalnız kaydetmek için. Pano her zaman **tam sekme** (`app.html`); ilk
kurulumda `app.html#settings`.

**Canlı düzen** (`app.css:31-37`):

- 860 px üstünde iki sütun; sohbet `clamp(360px, 34%, 540px)`.
- 860 px ve altında tek sütun: **önce sohbet 70vh yüksekliğinde**, plan onun altında.
- Ek kırılmalar: 700 / 620 / 600 / 560 / 480 / 420 px.
- Başlangıç ekranı 860 px altında sağ sütunu gizliyor, kontrol listesini üst çubuğa indiriyor.

**Telefon gerçekte yok.**

- Chrome Android ve iOS eklenti çalıştırmıyor.
- Yol haritası notu: "ürün şu an web eklentisi; mobile akış bitince geçilir"
  (`/home/user/wt-v32/docs/urun-yol-haritasi.md:84-85`).
- Gerçekçi dar haller: yarım ekran dizüstü (yaklaşık 640–720 px) ve dar masaüstü penceresi (yaklaşık 500–860 px).
- e2e 560 px ve 390 px'de yatay kaydırma olmadığını denetliyor (`scripts/e2e.mjs:188`, `:426`, `:749`, `:776`). 390 px bu
  anlamda "kırılmasın" sınırı olarak kalabilir.

**Asıl dar ekran sorunu.** 860 px altında plan 70vh'lik sohbetin altından başlıyor; yeni hero ilk ekranda hiç görünmüyor.
Telefon düzeni çizmeden önce dar pencerede sohbetin nereye gideceğine karar verilmeli: "Asistan | Plan" sekmesi, alttan
açılan sohbet ya da katlanır sohbet. Bu çizilmedi. Mockup da canlının 70vh kuralını aynen taşıyor
(`plan-v82-standart/kaynak/mk81.css:550`).

**Geniş ekranda da daraltma gerekli.**

| Ekran | Canlı sohbet | Plan içeriği (40+40 px iç boşluk sonrası) |
|---|---|---|
| 1280 px | 435 px | ~765 px |
| 1280 px, v80 daraltmasıyla | 333 px | ~867 px |
| 1440 px | 490 px | ~870 px |

v82 niyet gövdesi görsel 196 + bilgi + yan sütun 232 + durum çizgisi + iç boşluk ile ~780 px istiyor. Yani 1280–1366 px
dizüstülerde v80'deki daraltma şart. Ama o zaman sohbetin içeriği 300–330 px'e göre yeniden çizilmeli.

**Öneri.** 390 px düzenini "kırılmasın" düzeyinde tutun (tek sütun, yan sütun alta). Ayrıntılı telefon tasarımına şimdi
emek vermeyin. Tasarım emeğini 560–860 px aralığına ve sohbetin yerine verin.

---

## 4. Özet

### (1) Tasarımı hiç olmayan yüzeyler (önem sırasıyla)

1. **Gezi sohbeti:** iniş kartı / "Planda göster", sohbetteki seçenek kartları (ChatOffers), hızlı yanıt çipleri,
   değişiklik satırları, link ve dosya çipleri, yazı ölçeği ve renk, 300–400 px genişlik. v73'te çizim var, v77–v82'ye
   uyarlanmadı.
2. **Dar pencere (≤860 px) yerleşimi:** sohbet ve plan birlikte nasıl duracak (bugün 70vh sohbet üstte).
3. **Gelen içerik niyet kutusunda:** okunuyor iskeleti, okunamadı hali, 4. ve sonraki seçenek gelince gösterim, toast;
   sayfaya bırakma örtüsü.
4. **Gezi türleri ve tarih halleri:** yol gezisi (araç kiralama), festival (🎪, tahmini tarih), kayak; hero şeridinde
   yaklaşık / tahmini / tarihsiz.
5. **Başlangıçtan plana geçiş:** "Omurga yeni oluştu" ilk karesi; StartGuideCard'ın yerini ne alacak; oluşturma ekranının
   son karesi.
6. **PDF:** yeni hero ve "Alındı = erişim" bilgileriyle.
7. **Bildirim ve geri al düzeni:** UndoToast, ArriveToast, gezi toast'ı, çevrimdışı, güncelleme, paylaşım değişiklik
   bildirimi; "Gerek yok → soluk + Geri al" kararıyla birlikte.
8. **Ürün ve menü kararları:** gezi ••• menüsünün yeni hero'daki yeri; Belgeler'in yeri; elle ekleme (+ Ekle şablonları)
   nereden yapılacak.
9. **Oy / beğeni modeli** (👍👎🤩 ↔ ♥) ve paylaşılan gezide seçim ve rezervasyonların eşitlenmemesi (ürün kararı).
10. **Ayarlar / ilk kurulum penceresi:** ilk izlenim; görünüşü eski form.
11. **Plan içinde ama çizilmemiş:** Gün gün, Harita, çekmecedeki "başka geziye taşı" ve kaynak bilgisi, iptal son günlü
    yapılacaklar listesi, Gizlenenler.

### (2) Yeni plan tasarımıyla uyum için küçük uyarlama gerekenler

- Popup metni niyet adıyla + derin bağlantı (`#trip=…&item=…`).
- Sohbet çipi ve değişiklik satırı metni niyet adıyla.
- `reveal` hedefi: akordiyon, ilk 3 kuralı, Pano, Yolculuk görünümünün korunması.
- Başlangıç sohbeti ve kontrol listesi mozaiği hero diliyle eşlenmeli; "an" fotoğrafları ayrı alana kaydedilmeli.
- Teknik kancalar:
  - `viewTransition.ts:48` (`.hx .hx-photo`)
  - `PrintPlan.tsx:182-184` (hero kopyası seçicileri)
  - `opening.ts` (`data-pit` / `data-count`)
  - `hareketDili.ts` / `putFly.ts` / `exitMotion.ts` sınıf kancaları
  - `UpdateBanner.tsx:15` (`aria-expanded`)
- Seyahatlerim: kart kapağı hero kapağıyla aynı olmalı; boş durum metni yenilenmeli.
- Renk sözlüğü: Seçildi açık yeşil mi, kum mu (`Status.tsx`, `--plan-*`).
- Ortaklık bağlantıları ile sağlayıcı kaydı birleşmeli; düğmeler `<a href>` olmalı.
- Örnek gezi (Japonya), mağaza metni ve ekran görüntüleri, PRIVACY §8 (Places, İlham'dan yer çıkarma).
- i18n: bütün yeni metinler `L()` ile; İngilizce karşılık listesi; iki dilde yükseklik ölçümü.
- Yer düzeltmeleri: ChangeNotices, OfflineNotice ve WorkPill'in yeri; HistoryDialog'un "Panoda göster" hedefi.

### (3) Dokunmaya gerek olmayanlar

- Kabuk: manifest izinleri (Places sunucu üzerinden giderse), kısayol, `_locales`, `background.ts`, `pagecapture.ts`.
- Çerçeve: `panelBus`, ErrorBoundary, `langSwitch`, Mascot, HomeBackdrop, `reconnect` mantığı.
- Ayarlar ve profil: AiGateSettings, Profile ve kişi fotoğrafları.
- Paylaşım: paylaş / katıl pencereleri, DeleteSharedTripDialog.
- Başlangıç: `startDrafts`, GenMap (oluşturma haritası), FlightMap (ölü kod; yalnız temizlik).
- Geri getirme: `trash.ts` ve `undo.ts` mantığı.
- Küçük parçalar: "Rotayı haritada gör", Bekleyen kayıtlar, sohbet hata şeridi, yeni sohbet başlat.
