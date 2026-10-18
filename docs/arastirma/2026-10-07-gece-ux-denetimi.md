# Gece UX ve hata denetimi (2026-10-07)

Trip Radar 0.36.49'u bir yolcu gibi kullandım: eklenti headless Chromium'da yüklendi, tüm ağ çağrıları
taklit edildi (canlı API yok, AI yok), örnek gezi (Portekiz) açıldı, 1400 / 760 / 560 / 400 px
genişlikte, Türkçe ve İngilizce gezildi. Ayrıca `e2e-output/` içindeki 151 ekran görüntüsüne bakıldı.
Kaynak koda dokunulmadı.

Ekran görüntüleri ve betikler: `/private/tmp/claude-501/-Users-emredurmus-Claude-Folder--N--trip-radar/8d7d1aed-ee62-4b78-8b1c-fcdbe297f25a/scratchpad/audit/`
(`shots/`, `sl/` dilimler, `audit.mjs`, `audit2.mjs`, `audit3.mjs`, `log-*.txt`).

Sahiplik notu: `TripHero.tsx`, `TripPanel.tsx`, `dayCards.ts`, `DayCards.tsx`, `app.css` print stilleri,
`PrintPlan.tsx` (PDF oturumu) ve `startTrip.ts`, `startCreate.ts`, `playbooks/*`, `StartChat.tsx`
(AI planlayıcı oturumu) başka oturumlarda. Bu dosyalara düşen maddeler **[SAHİPLİ]** diye işaretli.

## Öncelik sırası

### 1. HATA: Dar ekranda uçuş kartı yönü ters ve yazılar üst üste
- Gördüğüm: 620 px altındaki panoda havayolu logosu olan uçuşlarda varış şehri solda, kalkış sağda
  çıkıyor ve yazılar, uçak çizimi birbirine biniyor. İstanbul → Porto uçuşu "Porto İstanbul" okunuyor;
  "İstanbu/l" kelime ortasından kırılıyor. Logosu olmayan kartlar (tren) doğru.
  `shots/tr-20-flight-400.png`, `sl/tr-11b-narrow-full-1.png`, e2e `4c-plan-cards-narrow.png`.
- Neden: `static/app.css` 2829'daki `.pk-mid.has-logo` 4 sütun kuruyor (logo + 3); dar container
  kuralı (≈1506-1509) ise `.pk-stop.r`'yi `grid-column: 2`'ye koyuyor. 2. sütun logodan sonra kalkış
  durağının yeri; varış oraya oturuyor, kalkış 3. sütuna kayıyor. Ölçüm (400 px):
  `cols 36px 71px 110px 71px`, varış x=87, kalkış x=168.
- Düzeltme: `@container panel (max-width: 620px)` içine
  `.pk-mid.has-logo { grid-template-columns: 36px 1fr 1fr; } .pk-mid.has-logo .pk-stop.r { grid-column: 3; }`.
  (Satır 2833'teki `@media (max-width: 560px)` viewport'a bakıyor, container'a değil; o da bu kurala bağlanmalı.)
- Dosya: `static/app.css` (print bölümü değil, serbest).

### 2. HATA: Kart ••• menüsü: aynı anda iki menü açık kalıyor, Esc kapatmıyor
- Gördüğüm: Bir kartın •••'sine, sonra başkasınınkine basınca ikisi de açık (`.pk-menu` sayısı 2).
  Esc'ye basınca da ikisi açık kalıyor. `shots/tr-30-two-menus.png`.
- Neden: `src/app/cards/CardShell.tsx` `CardMenu`: kapanma yalnız `document` `click` ile; buton
  `onClick`'te `stopPropagation` yaptığı için ikinci tıklama ilk menünün dinleyicisine ulaşmıyor.
  Klavye dinleyicisi yok.
- Düzeltme: Aynı effect'e `keydown` Escape dinleyicisi ekle ve kapanmayı `pointerdown` (capture) ile
  dinle; böylece başka bir ••• tıklaması öncekini kapatır.
- Dosya: `CardShell.tsx` (serbest).

### 3. HATA: Süresi geçmiş ücretsiz iptal "artı" sayılıyor
- Gördüğüm: Konaklama öneri cümlesi: "Önerim Jardim Stay: en sessiz; €45 daha ucuz, daha konforlu ve
  5 Eki'ye kadar ücretsiz iptal (süresi geçmiş)". Aynı kartın eksilerinde "Ücretsiz iptal süresi geçti"
  yazıyor. Kullanıcı aynı şeyi hem artı hem eksi görüyor. `sl/tr-11b-narrow-full-2.png`.
- Neden: `src/lib/decision.ts` ~518: süresi geçmiş ücretsiz iptal `value = 0.3`, iade yok `0`.
  `choice.ts` `edgeRows` bu farkı "üstünlük" diye alıp metne koyuyor.
- Düzeltme: Süresi geçmişi iade yok ile aynı değere çek (`expired ? 0`), ya da `edgeRows`'ta
  cancellation kriterinde `a` süresi geçmişse satırı atla.
- Dosya: `decision.ts` veya `choice.ts` (serbest).

### 4. UX: Öneri cümlesindeki iki "€45 daha ucuz" çelişkili okunuyor
- Gördüğüm: "Önerim Jardim Stay: … €45 daha ucuz … Tasarruf için 3. Casa Azul (€45 daha ucuz)."
  İlki 2. seçeneğe (Ribeira) göre, ikincisi önerilene göre; cümle hangisine göre olduğunu söylemiyor.
- Neden: `src/lib/choice.ts` `headlineOf` (~473-475): `why` kısmında ikinciye göre fark, isimsiz.
- Düzeltme: Kartlardaki çip diliyle aynı yap: "2.'ye göre €45 daha ucuz". Alternatif kısmında
  "(Jardim'e göre €45 daha ucuz)" ya da "(önerimden €45 ucuz)".
- Dosya: `choice.ts` (serbest).

### 5. HATA: Örnek gezinin tarihleri sabit (8-14 Ekim 2026)
- Gördüğüm: Bugün (7 Ekim) örnek gezi açılınca ücretsiz iptaller zaten "süresi geçmiş"; 14 Ekim'den
  sonra örnek gezi bitmiş bir gezi olarak açılacak (geri sayım "Bitti", her şey geçmiş).
- Neden: `src/lib/demo.ts` `loadDemoTrip`: `confirmedDates`, kayıtların `dates`, `freeUntil` ve
  metinlerdeki "5 Eki'ye kadar" hepsi sabit.
- Düzeltme: Yüklerken bir kaydırma hesapla (bugün + 3 gün − 2026-10-08) ve tüm ISO tarihlerine uygula;
  metinlerdeki tarihleri `formatDate` ile üret. e2e saati 5 Ekim'e dondurduğu için orada kaydırma 0 olur.
- Dosya: `demo.ts` (serbest).

### 6. HATA: Popup, hiçbir şey kaydedilmemişken "Kayıt duruyor" diyor
- Gördüğüm: Anahtar yokken popup her durumda (panoda, hata, "Eklenmedi") "Kayıt duruyor. AI'ın işlemesi
  için ücretsiz Gemini anahtarını bir kez bağla." yazıyor. `shots/tr-17-popup.png`.
- Neden: `src/popup.tsx:110` koşulu yalnız `!hasKey`.
- Düzeltme: `!hasKey && (state.step === "working" || state.step === "done")`; diğer durumlarda
  "AI için ücretsiz Gemini anahtarını bağla" gibi nötr bir cümle.
- Dosya: `popup.tsx` (serbest).

### 7. MARKA: Türkçe arayüzde em-dash (—)
- Gördüğüm: Ayarlar: "Tanı dosyası indir — kaydettiğin sayfaları…"; model listesi "Claude Opus 5 — en iyi
  sonuç". Sohbette ayraç: "— Yeni sohbet —", "— Sohbet uzadı, yeni oturum başladı … —".
- Neden: Türkçe tarafta bilerek em-dash, İngilizce tarafta "·" kullanılmış:
  `Settings.tsx` 15-17 ve 229, `TripsHome.tsx` 218, `Evidence.tsx` 117 ve 123, `ItemDrawer.tsx` 70,
  `lib/value.ts` 301, `lib/decision.ts` 1538 ve 1551, `lib/assistant.ts` 1048 ve 2631,
  `TripPanel.tsx` 671 **[SAHİPLİ]**.
- Düzeltme: Türkçe tarafı İngilizcedeki gibi " · " ya da ": " yap; sohbet ayraçlarını tiresiz yaz.

### 8. HATA: Ayarlar'da iki satır üst üste, açılır düğme kırmızıya dönüyor
- Gördüğüm: "AI kapısı · kullanım ve ayrıntılar ▾" ile "Anahtarlar yalnız bu tarayıcıda saklanır."
  6 px üst üste biniyor (ölçüm: düğme y=861-877, paragraf y=871-887). Düğmenin üzerine gelince rengi
  tehlike kırmızısı oluyor (silme düğmesi gibi). `shots/tr-16-settings.png`, `shots/tr-16c-settings-end.png`.
- Neden: `static/app.css:189` `.small { margin-top: -6px }` paragrafı yukarı çekiyor; `AiGateSettings.tsx:100`
  düğmesi `link-btn quiet`, o da `app.css:557`'de hover'da `var(--danger)`.
- Düzeltme: `.ai-gate { margin-bottom: 12px; }` (ya da düğmeye `display: block`); düğmede `quiet` yerine
  hover'ı kırmızı olmayan bir sınıf.
- Dosya: `app.css` (print değil), `AiGateSettings.tsx` (serbest).

### 9. HATA: Seyahatlerim kartı ev şehrini gezi yeri sayıyor
- Gördüğüm: Örnek gezi kartı "8–14 Ekim · Porto, Lizbon ve İstanbul". İstanbul dönüş uçuşunun varışı.
  `shots/tr-16-settings.png` (arkadaki kart), `shots/tr-15-home.png`.
- Neden: `src/app/TripsHome.tsx` ~296: şehirler her kaydın `city`'sinden (eSIM hariç) toplanıyor;
  uçuşun `city`'si varış.
- Düzeltme: Uçuşları da hariç tut (`i.category !== "flight"`) ya da `lib/tripBrief.ts` `tripPlaces`'i kullan.
- Dosya: `TripsHome.tsx` (serbest).

### 10. UX: Dar ekranda bölüm başlıkları kesiliyor ("Di…", "Konakla…")
- Gördüğüm: 400 px'te "Diğer (Sigorta, eSIM)" başlığı "Di…", "Konaklama" "Konakla…". DESIGN.md "hiçbir
  metin kesilmez" diyor. `sl/tr-11b-narrow-full-5.png`, `sl/tr-11b-narrow-full-1.png`.
- Neden: `static/app.css:1669` `.cat-title b` nowrap + ellipsis; sağdaki grup (Ekle + çubuk + sayaç + ok) sabit.
- Düzeltme: Daha dar container'da (ör. `max-width: 440px`) `.cat-bar { display: none }`; sayı zaten
  aynı bilgiyi veriyor. Ya da `.cat-head` sarılsın (yorumdaki "header wraps under its name" niyeti).
- Dosya: `app.css` (serbest).

### 11. HATA: Dar ekranda kart altında "⏳ 3 gün" fiyatın üstüne biniyor
- Gördüğüm: Douro tekne turu kartında "Planlandı · ⏳ 3 gün" ile "€25 toplam" üst üste.
  `sl/tr-11b-narrow-full-4.png`.
- Neden: `static/app.css` `.pk-foot` tek satır flex, `.pk-when` `white-space: nowrap`.
- Düzeltme: Dar container kuralına `.pk-foot { flex-wrap: wrap; row-gap: 4px; padding-block: 6px; }`.
- Dosya: `app.css` (serbest).

### 12. UX: Fotoğraf künyesi açık renkli fotoğrafta zor okunuyor
- Gördüğüm: Açık (beyaza yakın) fotoğrafta "Fotoğraf: … / Unsplash" gri hap içinde beyaz yazı; karşıtlık
  yaklaşık 2.6:1 (11.5 px yazı için 4.5:1 gerekir). `shots/tr-03-credit.png`.
- Neden: `static/app.css:1061-1063` `.hx-credit` arka planı `rgba(0,0,0,.38)`.
- Düzeltme: `rgba(0,0,0,.55)` (≈4.9:1) ve gerekirse `backdrop-filter: blur(4px)`.
- Dosya: `app.css` hero bölümü; görsel olarak TripHero'ya ait **[SAHİPLİ: TripHero oturumuyla konuş]**.

### 13. UX: Hero ilerleme kutusu: yalnız kalan "·" ve %100 yanılsaması
- Gördüğüm: (a) "7 ihtiyaç karar bekliyor" satırı sarınca ikinci satır "· ● 1 rezerve edilecek" diye
  noktayla başlıyor (1400 px'te bile). (b) Madeira gezisinde "Planlananların %100'ü rezerve" ve tam yeşil
  çubuk, altında "3 ihtiyaç karar bekliyor": bitmiş gibi görünüyor. `s/tr-02-demo-board.png`, e2e `2i-hero-madeira.png`.
- Neden: `src/app/TripHero.tsx` 234-243 parçaları ayraçla yan yana basıyor; yüzde `lib/lifecycle.ts`
  `heroNumbers` yalnız planlananlar üzerinden (spec gereği).
- Düzeltme: (a) Ayracı bir önceki parçanın nowrap span'ine sona koy ya da parçaları `flex-wrap` + `gap`
  ile ayraçsız diz. (b) `open > 0` iken %100 başlığı "Planlananların hepsi rezerve" yerine
  "Planlananlar rezerve, 3 karar kaldı" gibi yaz.
- Dosya: `TripHero.tsx` **[SAHİPLİ]**, `lifecycle.ts` (serbest).

### 14. DİL: Yanlış anlaşılan kısa etiketler
- "Yer yok" (boş konaklama kartı durumu) Türkçede "doluyuz, yer kalmadı" diye okunur; bir satır üstünde
  zaten "otel seçilmedi" yazıyor. `src/app/cards/EmptyCard.tsx` 211 ve 377: "Henüz otel yok" yap ya da kaldır.
  e2e `22a-empty-cards.png`.
- "Ele" (kart menüsü, Karşılaştır, seçenek kartı): tek başına belirsiz. `ItemDrawer.tsx:29`,
  `SwipeCard.tsx:189`, `board/OptionBoard.tsx:219`: "Ele" yerine "Çıkar" ya da "Elendi say".
- "Gezi planı 6 gece · 3 rezerve · 3 açık": hero'daki "7 ihtiyaç karar bekliyor"un yanında farklı sayılar
  gibi duruyor; aslında geceler. `src/app/plan/CategoryPlan.tsx:43`: "6 gecenin 3'ü rezerve, 3'ü boş".
- İngilizce: "7 needs to decide" bozuk. `lib/lifecycle.ts:200` `openNeedsText`: "7 to decide" ya da
  "7 waiting for a decision".

### 15. UX: Aynı cümle iki kez
- Boş gezi hero'su: "Tarihler kaydettikçe netleşir" ve hemen altında "Tarih ve şehir, kaydettikçe
  netleşir." `TripHero.tsx:193` + `TripPanel.tsx:518` **[SAHİPLİ]**: tarih yokken `lead`'i boş bırak.
  e2e `2e-hero-empty.png`.
- Başlangıç sohbeti: "Tamam, rota bu. / Tamam, bekliyorum. …" art arda iki "Tamam".
  `lib/startTrip.ts` 2377 ve 1557 **[SAHİPLİ: AI planlayıcı]**. e2e `20c-start-generating.png`.

## Küçük notlar (listeye girmedi)
- Sohbet kutusunun klavye odağı görünmüyor: `app.css:97` `.composer input { outline: 0 }`, `.composer`'da
  `:focus-within` yok. Bir `box-shadow` halkası yeter.
- "2 kişi" düğmesinin ekran okuyucu adı "2 kişi · 2 kişi · Düzenle" (tekrar); bütçe düğmesinin adı
  boşluksuz "Bütçe€1.500Rezerve€552…".
- 400 px'te sekmeler iki satıra düşüyor ("Harita" tek başına alt satırda, üstünde ayraç çizgisi).
- Tercihler çipi kesiliyor: "Odada mutlaka bir…" (e2e `2b-hero.png`), aynı "metin kesilmez" kuralı. [SAHİPLİ: TripPanel]
- Günlük akışta "Porto 1. Gün · 2 iş" ama altında 3 satır; "iş" sayısının neyi saydığı belirsiz. [SAHİPLİ: DayCards]
- Ayarlar'da iki ayrı "Adın" alanı (Profilim ve Paylaşım) ve sıradan yolcuya "Supabase adresi/anahtarı",
  "README'de 'Paylaşım' bölümü" gösteriliyor; Paylaşım bölümü kapalı başlamalı.
- Seyahatlerim kartları, hero'da şehir fotoğrafı varken renk geçişli boş görsel gösteriyor
  (`TripsHome.tsx` yalnız `trip.heroImage` ve kayıt görsellerine bakıyor).
- Sigorta kartında "Şehir ekle" ipucu (sigortanın şehri olmaz), e2e `27d-web-search-slow.png`.
- e2e'nin 1. bölümü `functions/v1/city-image`'ı taklit etmiyor: hero fotoğrafı canlı sunucudan geliyor
  (2b-hero'daki Unsplash fotoğrafı gerçek). Testler ağdan bağımsız değil.
- Konsolda gerçek uygulama hatası görülmedi (yalnız taklit edilen ağ isteklerinin `ERR_FAILED`'ı ve WebGL uyarısı).
