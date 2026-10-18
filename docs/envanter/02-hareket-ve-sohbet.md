# 02 · Hareket Dili ve Sohbet envanteri

Salt okunur çıkarım (kaynak koda dokunulmadı). Taranan dallar: `origin/plan-v30-fix` (canlı **0.36.84**; `origin/release` paketinde de aynısı var: `data-pit`, `mv-leaving`, `pk-glow`, `ch-flip`, `startViewTransition` hepsi `extension/app.js|app.css` içinde), `plan-v30-wip` (0.36.83, **plan-v31…v39 çizimleri yalnız burada**), `hareket-0.36.82`, `gece-giris`, `gece-giris-0.36.78`, `plan-v30-0.36.79/80/81`, `plan-v30-denetim-yerel`, `claude/blissful-fermi-4zn4h6`, `main`, `release` (yalnız derlenmiş paket).

## 0. Okuma kılavuzu

**Güncelleme (P9b, plan-v46-temizlik).** v46 hareket ve kart paketleri (P4, P7, P8c, P8d) birleştiği için K5, K9, K12, K13, K16, K17, P9, W16 ve S37 CANLI'ya alındı (commit satırda). Uygulanmayacağı yazılı olanlar (A17, S10, S11, K14'ün dönen halkası) ve emin olunmayanlar değişmedi.

**Durum etiketleri** (her satırın son anlamlı sütunu)

| Etiket | Anlamı |
|---|---|
| CANLI | `plan-v30-fix` (0.36.84) kodunda var ve grep ile doğrulandı |
| YAYINDA DEĞİL | Mockup/spec/roadmap'te tasarlandı, kodda karşılığı yok |
| VAZGEÇİLDİ | Bir sürümde çizildi ya da kodlandı, sonra bilinçle kaldırıldı ya da başka seçenek seçildi |
| ÇELİŞKİ | Çizimle kod (ya da iki belge) birbirinden farklı; Emre'nin karar vermesi gerekir. Fark satırda yazılı |

**Kısaltmalar.** `app.css` = `static/app.css`; kod yolları `src/app/` altındadır (`opening.ts:134` = `src/app/opening.ts` 134. satır). Mockup yolları `docs/mockups/…/index.html`; satır numaraları dosyanın kendi satırlarıdır.

**Mockup'ı nasıl açarım.**
- `plan-v12 … plan-v30`, `acilis-v2`, `sihirli-acilis`, `giris-akisi-v1|v2|v3`, `ux-katmanli-arayuz`, `seritler` bu dalda (`plan-v30-fix`) hazır: dosyayı tarayıcıda aç.
- **`plan-v31-oneri … plan-v39-bilet` yalnız `origin/plan-v30-wip`'te** (her biri ~2 MB). Açmak için: `git show origin/plan-v30-wip:docs/mockups/plan-v39-bilet/index.html > /tmp/v39.html` ve tarayıcıda aç. (Bu belgede "wip" etiketli satır numaraları o dosyalara aittir.)
- Çoğu sayfada üstte **"▶ Oynat"**, **"Yavaş çekim"** (acilis-v2, sihirli-acilis), **"Tekrar"** (giris-akisi "Pıt pıt sözlüğü" kartları), **"Hareketi duraklat"** (plan-v12…v39, japonya/ozora/asamalar-web) düğmesi vardır. v33'ten sonra planda **"1 · Omurga / 2 · Aranıyor / 3 · Sonuçlar / ▶ Baştan oynat"** şeridi çıkar.

### 0.1 Kritik bulgular (önce bunlar)

1. **`docs/mockups/hareket` hiçbir dalda yok.** Kodun yorumları (`motion.ts`, `exitMotion.ts`, `putFly.ts`, `thinking.ts`, `Mascot.tsx`, `app.css:4308`) ve v30 spec'i (`docs/superpowers/specs/2026-10-11-plan-v30-design.md:257-268`) "Hareket Dili oturumunun" bu çizimine ve `hareket-bekleyen` / `41b3782` commit'ine atıf yapıyor; **`41b3782` repoda yok**, `git log --all -- docs/mockups/hareket*` boş. Yani "Hareket Dili"nin (0.36.78) 5 süre / 3 eğri / pencere-çekmece / düşünme noktaları / "Plana koy uçar" kararlarının **tasarım kaynağı kayıp**; elde yalnız kod ve commit mesajı var (bu belgede "kaynak mockup yok" diye işaretli).
2. **Sihirli açılışın üç hâli var**: 0.36.78–0.36.81'de yayınlanan "göz kırpan maskot + aşağı kayma" (VAZGEÇİLDİ), `acilis-v2` A/C yönleri (VAZGEÇİLDİ) ve canlıdaki **B · Ritim ve sayaçlar**. `886cf0e` commit'i "WIP (bekliyor) … tam uçtan uca test edilmedi" diyor; sonradan 0.36.84'e girdi, ama pencere/çekmece çıkışı (`exitMotion`) için **ne birim ne e2e testi var**.
3. **"Plan taslağı"** (başlatma sohbetinde sağda kartlar düşer/parlar) `3ae8672`'de kodlandı, `29b5e74`'te kaldırıldı (VAZGEÇİLDİ), ama `docs/urun-yol-haritasi.md:431-433` hâlâ "var" diye yazıyor ve K5 hâlâ buna yaslanıyor.
4. **"Yazıyor…"** `1f9ef45`'te kodlandı, `d34f0a2`'de (v5) kaldırıldı; spec `2026-10-06-oneriler-ve-sohbetle-gezi-design.md:98` ve `StartChat.tsx:8-9` yorumu hâlâ söylüyor; kodda `Stage = "writing"` durumu var ama ekranda yazı yok.
5. **Hareket sözlüğünün 6 hareketi kodda var ama çizimden farklı değerlerle** (parlama 1,1 sn/10 px → 0,6 sn/4 px; nabız 1,4 sn → 2,8 sn; yükselme −3 px → −2 px; mühür yönü). Tablo §1.3.
6. **K29 "aşama geçiş hareketi"** (uçak silüeti kalkış, çizim düşer, etiket zıplar, mühür basılır, "Hareketi duraklat") ve v33'ün **"iner"** animasyonu kodda **yok**; kodda yalnız kısa parlama + tik zıplaması var.
7. **"Plana koy"** spec'te "kartın bölümüne uçsun" diye bekliyordu (`plan-v30-design.md:268`); kodda **Plan sekmesine** uçuyor (`putFly.ts`).
8. **Reduced-motion boşlukları** (kural bulunamadı, CSS bloklarında tek tek tarandı): `.dc-flash` (app.css:2410), `.cat-bar > span` genişlik geçişi (3855), `.hx-bar i` (1210), `.pn-card` hover kaldırma (3389-3390), `.gm-ring.go` (3067; ama GenMap `still` ile zaten son kareye atlar), `.pk-undo-ring .run` (4240; geri sayım, işlevsel).
9. **Ölü kod:** `Mascot` `wink` durumu, `FlightMap`/`WorldFlight` (rev-3 harita), `--t-instant`, `lp-*` yok ama `st-map-*` CSS'i duruyor.

---

## 1. Genel hareket dili ilkeleri

### 1.1 Kurallar

| # | İlke | Kaynak | Durum |
|---|---|---|---|
| H1 | Beş süre, üç eğri; **çıkışlar girişten hızlıdır**; yalnız `opacity`, `transform`, ışık (`box-shadow`); kutunun boyutu/yeri hiç oynamaz; reduced-motion'da hareket gider, **renk değişimleri kalır** | `app.css:4308-4314` ("Hareket dili" başlığı, `docs/mockups/hareket` kayıp) | CANLI |
| H2 | Her hareketin **tek anlamı** var, başka yerde kullanılmaz; hepsi 0,6 sn altı; hiçbir yerleşim değişmez; azaltılmış harekette kapalı | `ux-katmanli-arayuz/index.html:523-526` ("5 · ONAYLADIN"), `motion.ts:1-4` | CANLI |
| H3 | "Pıt pıt" ritmi: parçalar okuma sırasıyla, bir vuruş arayla, hafifçe yükselerek gelir; ekranda görünen kısım ~0,75 sn'de biter; kimse kimseyi beklemez (fotoğraf, hava, fiyat hazır oldukça kendi belirişiyle) | `acilis-v2/index.html:343-352` ("Neden daha hafif"), `opening.ts:1-12` | CANLI |
| H4 | Hareket **bilgi taşır**, süs değildir: sahte süre yok, adım satırları gerçek bir çağrıya bağlı, çağrı bitince satır kalkar | `2026-10-06-niyet-planlayici-design.md:20-26`, `startTrip.ts:2453-2460` | CANLI |
| H5 | Kullanıcı kaydırırken sayfa kendi kaymaz; panel hiç otomatik kaymaz (eski "aşağı in ve geri dön" kalktı) | `acilis-v2/index.html:343-352`, e2e `scripts/e2e.mjs:5090` | CANLI |
| H6 | Dokunuş/tuş her uzun hareketi hemen bitirir | `opening.ts:238-262`, `acilis-v2` "Tıkla, hemen bitsin" (312) | CANLI |
| H7 | Reduced-motion: CSS `@media (prefers-reduced-motion: reduce)` + JS `reducedMotion()` (matchMedia hata verirse **true** döner = hareket yok) | `motion.ts:9-15`; JS tüketicileri: `opening.ts:135`, `exitMotion.ts:20`, `putFly.ts:19`, `viewTransition.ts:18-21`, `motion.ts` kancaları | CANLI |
| H8 | Mockup'larda reduced-motion tek kural: `*{animation:none!important;transition:none!important}` ve `body.still` ("Hareketi duraklat" düğmesi). Canlıda seçici seçici; **duraklat düğmesi uygulamada yok** (`grep duraklat src` boş) | `plan-v30/index.html:725-726,1665` | ÇELİŞKİ |

### 1.2 Süre ve eğri ölçeği (canlı)

| Belirteç | Değer | Kullanıldığı yerler |
|---|---|---|
| `--t-instant` | 120 ms | tanımlı, kullanılmıyor |
| `--t-quick` | 180 ms | çıkış kopyası, `th-line`, `work-pill`, `chat-error` |
| `--t-base` | 260 ms | sekme çizgisi, panel fade, pencere, bölüm açılışı, `reconnect` |
| `--t-slow` | 380 ms | çekmece, `chat-banner`, kart çevirme (`ch-flip`), `trips-empty` |
| `--t-story` | 600 ms | kart fotoğrafı bulanıklıktan çıkış |
| `--e-out` | `cubic-bezier(.16,1,.3,1)` | tüm girişler (mockup'lardaki "ease"in aynısı) |
| `--e-in` | `cubic-bezier(.5,0,.75,0)` | tüm çıkışlar |
| `--e-move` | `cubic-bezier(.65,0,.35,1)` | taşınan şeyler: kart fotoğrafı→hero (0,5 sn), "Plana koy" uçuşu (420 ms), anahtar sarsıntısı |
| yay (spring) | `(.2,.9,.3,1.3)` tik, `(.2,1.4,.4,1)` mühür, `(.3,1.5,.5,1)` durak düşüşü, `(.3,1.6,.5,1)` ev simgesi | başlatma ekranı ve mühür |
| açılış | `(.2,.8,.2,1)` | `opening.ts:126` |
| rota yürüyüşü | `(.45,0,.55,1)`, 6 sn (tren/otobüs/feribot/araba 5 sn) | `app.css:3966-3968` |

Kaynak: `app.css:4311-4314`. Not: ana ekran kendi `--hm-ease` = `(.16,1,.3,1)` (aynı eğri, ayrı isim, `.hm` bloğu).

### 1.3 "Altı hareketlik sözlük" – çizim ↔ kod

Çizim: `docs/mockups/ux-katmanli-arayuz/index.html` satır 191-214 (CSS), 511-519 ("Oynat" düğmesi `#play`, satır 519). Kod: `motion.ts`, `app.css:4268-4287`, e2e Part 5 `scripts/e2e.mjs:4937-5050`.

| Hareket | Anlamı / tetik | Çizimdeki değer | Koddaki değer | Reduced | Durum |
|---|---|---|---|---|---|
| **Mühür** | Kart "rezerve" olur (false→true, açılışta değil) | 0,5 sn, `scale .4→1.18→1`, `(.2,.9,.3,1.3)`; yeşil tik | `pk-pop` 0,5 sn `(.2,1.4,.4,1)`, `scale .4 rotate(-14°)→1.18 rotate(4°)`, `backwards`; `.pk-seal .pk-stamp, .pk-seal .pk-ring.done`; sınıf 600 ms (`useJustBecame`) | `animation:none` (4285) | ÇELİŞKİ (hafif: eğri, dönme; Ozora çiziminde damga **büyükten küçüğe** basılıyor, bkz. K3) |
| **Parlama** | Bir cevap/düzenleme kartı değiştirir (`item.updatedAt`) | 1,1 sn, halka 0→10 px, `rgba(91,69,224,.6)` + zemin `#ece8ff` | `pk-glow` 0,6 sn ease-out, 0→4 px, `.35` alfa; 600 ms (`useJustChanged`, açılışta parlamaz) | `animation:none` | ÇELİŞKİ (süre ve genlik küçülmüş) |
| **Düşüş** | Sohbet plana kart ekler (`origin:"chat"`, ≤4 sn önce, ilk çizimde bir kez) | 0,55 sn, `translateY(-14px) scale(.96)`, `(.2,.9,.3,1.2)` | `pk-drop` 0,55 sn, `translateY(-14→2px)` (%70 aşım), `(.2,.9,.3,1)`; `dropsIn()` `motion.ts:66` | `animation:none` | ÇELİŞKİ (scale yok, aşım var) |
| **Nabız** | Boş kart bekler (Arıyoruz) | sürekli, `pulse 1.4s`, halka 7 px | `pk-pulse` **2,8 sn** sonsuz, `box-shadow` 5 px `rgba(120,110,160,.16)`; `.ek-card .pk-ring.open/.half` | `animation:none` | ÇELİŞKİ (çizim "yavaş" diyor, 1,4 sn çizilmiş; kod 2 kat yavaş) |
| **Yükselme** | Tıklanabilir kart üstüne gelince | 0,18 sn, `translateY(-3px)` + gölge | `.pk-card` `transform .18s ease`, **−2 px** (e2e `5004` bunu doğruluyor); yalnız `(hover:hover)`, `.pk-open`/`.ek-still` hariç | `transition:none` + hover `transform:none` (4286-4287) | ÇELİŞKİ (−3 → −2 px) |
| **Sayaç** | Bütçe rakamı değişince sayar | 0,6 sn | `useCountUp` 600 ms, kübik ease-out; `Counted.tsx`; `TripFacts.tsx:177,187`; sayarken `tabular-nums` (`.counting`) | anında değer | CANLI |

İzlemek için: `ux-katmanli-arayuz/index.html` → "5 · ONAYLADIN" kartı → **Oynat**.

---

## 2. Sihirli açılış (gezi başına bir kez)

Canlı hâl **B · Ritim ve sayaçlar** (`acilis-v2`, Emre 2026-10-10; kod başlığı `opening.ts:1`). Tetik: `TripPanel.tsx:119-130` (`useLayoutEffect`, `view==="plan"`, `openingTried` ref, `claimOpening(trip.id)`).

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| A1 | **Parça girişi (pıt pıt)** | Bir gezinin Plan'ı bu tarayıcıda **ilk kez** açılınca; görünen parçalar ilk kareden, okuma sırasıyla | Her parça `opacity 0→1` + `translate 0 8px→0`, **300 ms**, `(.2,.8,.2,1)`, `fill:backwards`; vuruş **80 ms** (`GAP`), son görünen parça en geç **450 ms**'de başlar (`MAX_START`, vuruş sıkıştırılır: `schedule()`); toplam ≈ 0,75-1 sn | `playOpening()` hemen `null` döner (135) | Çizim: `acilis-v2` B (`playABC("B")`, 462-488); kod: `opening.ts:17-25,27-32,184-198` | CANLI | `acilis-v2` → "B · Ritim ve sayaçlar" → Oynat |
| A2 | **Gezi başına bir kez** | `trip-radar:opened:<tripId>` localStorage anahtarı; sekme değişimi, yeniden çizim, yenileme, sonraki oturum **oynatmaz**; depolama yoksa sayfa yüklemesi başına bir kez | `opening.ts:39-74`; kapatma anahtarı `trip-radar:opening-off` (sessionStorage/localStorage `"1"`), e2e bunu her bağlamda kuruyor (`e2e.mjs:11-17`) | — | Commit `b86f703` ("once per trip, ever"; Emre: "bir kere ilk açılışta olsa yeterli", `origin/gece-giris-0.36.78:src/app/opening.ts:1-3`); eski karar "oturumda bir kez" (`d7921bc`) | CANLI | — |
| A3 | **Altta kalanlar kaydırınca bir kez** | Panelin görünür alt kenarından (−24 px) aşağıda kalan parçalar `opacity:0` bekler, `IntersectionObserver` (root = `.panel`) görünce girer; birlikte görünenler **45 ms** arayla (`SCROLL_GAP`); bekleyen varsa 30 sn sonra kendiliğinden biter | `opening.ts:200-236,263` | aynı | `acilis-v2` `onScrollIn` (433-448); e2e `5101-5112` | CANLI | `acilis-v2` → kaydır |
| A4 | **Sayaçlar 0'dan sayar** | `data-count` taşıyan parçanın ilk sayısı 0'dan gerçek değere; **520 ms**, kübik ease-out (`countAt`); sayfa metni araya yazarsa karışmaz | `opening.ts:34-35,149-181`; işaretli yerler: `TripHero.tsx:243` (tally düğmeleri), `:258` (yüzde) | aynı | `acilis-v2` `count()` | CANLI | aynı |
| A5 | **Çubuk soldan dolar / çizgi soldan çizilir** | `data-pit="bar"` (çocukları `scale 0 1→1 1`, **600 ms**), `data-pit="line"` (**300 ms**), `transform-origin:left` | `opening.ts:186-195`; `TripHero.tsx:260` (hx-bar) | aynı | `acilis-v2` `pit()` kind=bar/line | CANLI | aynı |
| A6 | **İşaretle bul** (sınıf adı yok) | Parçalar `data-pit`, `data-pit-children`, `data-pit-photo`, `data-count` ile bulunur; hiç işaret yoksa panelin blokları | `opening.ts:6-12,96-122`. İşaretli yerler: `TripHero.tsx:182,214,235,260`, `TripFacts.tsx:55`, `plan/CategoryPlan.tsx:93,109`, `plan/Section.tsx:99`, `plan/TripShape.tsx:53`, `plan/StoryView.tsx:38,110`, `plan/ActivityBoard.tsx:122`, `ideas/IdeaTiles.tsx:96` | — | Spec: `plan-v30-design.md:261-265` (yeni kartlara da işaret konacak) | CANLI | — |
| A7 | **Kartından gelen fotoğraf tekrar girmez** | Gezi kartından açılınca (`withTripPhoto`) `data-pit-photo` atlanır (`photoCarried()`) | `opening.ts:137`, `viewTransition.ts:36-39` | — | `acilis-v2` "Fotoğraf geçişiyle çakışmaz" (346) | CANLI | — |
| A8 | **Kart fotoğrafı → hero fotoğrafı büyür; geri dönerken küçülür** | Ana ekrandaki gezi kartına basınca / panodan "Seyahatlerim"e dönünce; yalnız iki fotoğrafa `view-transition-name:trip-photo` (geçişin süresince); geri kalan ekran crossfade | `app.css:4336-4337`: grup 0,5 sn `(.65,0,.35,1)`; `viewTransition.ts:45-68`; çağrı `App.tsx:228,278` | `canTransition()` false → anında (`viewTransition.ts:18-21`) | Kaynak mockup yok (`hareket`), `d6d524f` | CANLI | Uygulamada: Seyahatlerim → bir gezi kartı |
| A9 | **Hero blokları bilgi geldikçe belirir** | Veri yüklenirken boş durum yerine sessiz yer tutucu; blok boş başlayıp dolunca bir kez `hx-appear` | 0,3 sn ease-out, `opacity + translateY(4px)`; `app.css:1103-1105`; `useAppear.ts:7`; tüketiciler `TripHero.tsx:131-132`, `TripFacts.tsx:51-53,135`, `Travellers.tsx:49`, `IntentCard.tsx:195` | `animation:none` (1105) | Spec `2026-10-05-hero-v9-design.md:16-17` ("Belirme") | CANLI | Yeni gezi: hero'da chip/hava/bütçe sonradan dolar |
| A10 | **Fotoğraf yumuşak gelir** | Hero fotoğrafı yüklenince | `.hx-photo img` `opacity .5s` (app.css:1108) | ayrı reduced kuralı yok (3255 yalnız PDF yerleşimi) | `acilis-v2` `photoArrives` (300 ms solma) | CANLI | — |
| A11 | **ESKİ: göz kırpan maskot + aşağı kayma + geri dönme** (0.36.78–0.36.81) | Maskot sohbetteki koltuğundan çıkıp panelin kenarına uçar, **yavaşça göz kırpar**, kıvılcım saçar; görünen kısım dolar; maskot eve uçar; **panel kendi aşağı kayar**, altta kalanlar "pıt" diye çıkar, sonra en üste döner | `PHASE {out:100, wink:800, burst:1850, fill:1900}`; `GLIDE_SPEED .45 px/ms`, 1200-5000 ms; `GAP` türe göre (fade 70, photo 160, wipe 120, rise 90, pop 80, bar 40, glint 70, stop 90, line 60, card 140), `MAX_START 1700`; fotoğraf `blur(14px)` girişi 700 ms; ilk 1,9 sn her şey gizli | tüm mod kapalı | `origin/gece-giris-0.36.78:src/app/opening.ts` (421 satır); çizim `sihirli-acilis` mod 4 (`play4`, 489); `d7921bc`, `894f9e1` | VAZGEÇİLDİ | `sihirli-acilis` → "Göz kırpar" modu → ▶ Oynat; `acilis-v2` "Şimdiki (0.36.78)" |
| A12 | **acilis-v2 A · Kıvılcım izi** (çizimin önerdiği, 8/10) | Maskot yerinden kalkmaz, her bölüme küçük bir kıvılcım yollar; değdiği parça "pıt" oturur; kaydırmasız bitiş 0,85 sn, sonda maskot bir kez zıplar | `trail()` 260 ms, vuruş 110 ms, `pop` yay | — | `acilis-v2/index.html` `playABC("A")` (462-488), karar kartı 357 | VAZGEÇİLDİ (B seçildi) | `acilis-v2` → A |
| A13 | **acilis-v2 C · Sade** | Yalnız saydamlık, 0,35 sn, vuruş 45 ms | — | — | aynı dosya | VAZGEÇİLDİ | `acilis-v2` → C |
| A14 | **sihirli-acilis mod 0, 1, 2, 3** (maskotsuz, değnek, rehber, serpme) | 1: maskot ortaya iki kat büyüyüp el sallar; 2: her grubun bir adım önünden gider; 3: tepeden her parçaya kıvılcım fırlatır | `play0..play3` (`sihirli-acilis/index.html:432-488`) | `reduce` ise hiç oynamaz | Çizimin 3. turu; ilk iki turun dosyaları repoda yok | VAZGEÇİLDİ | `sihirli-acilis` → modlar |
| A15 | **Maskot seçimi** | Çizim 9 maskot sunuyor; metin "İlk küreyi beğendin; önerim onun sade hali (Sade küre · gülümser)". Kod **"İlk küre · güler yüzlü"** | `Mascot.tsx:1-8`; `sihirli-acilis` karar kartı (342-348) | — | Karar kaydı yok | ÇELİŞKİ | `sihirli-acilis` → "Dokuz maskot" |
| A16 | **Maskot "wink" (göz kırpma) durumu** | `Mascot.tsx` altı durum tanımlıyor (`idle, wink, work, done, oops, sleepy`), CSS `ms-wink .7s` var; **hiçbir bileşen `state="wink"` vermiyor** (grep) = açılışın maskot rolü kalktı | `app.css:4297,4303`; `Mascot.tsx:8` | `app.css:4306` | `sihirli-acilis` | VAZGEÇİLDİ (ölü kod) | — |
| A17 | **İpucu yazıları** ("Tıkla, hemen bitsin"; "Aşağı kaydır: altta kalanlar göründükçe gelir") | Oynarken ilk 0,9 sn sonra çıkar, kaydırınca kaybolur | `acilis-v2/index.html:143-144,312-313,445` | — | Kodda karşılığı yok | YAYINDA DEĞİL | `acilis-v2` → Oynat |
| A18 | **Vuruş değerleri** | Çizim B: vuruş 95 ms, grup içi 38 ms, kaydırınca 45 ms. Kod: `GAP 80`, iç vuruş yok | `acilis-v2` `playABC` (466) ↔ `opening.ts:17` | — | — | ÇELİŞKİ (küçük) | — |
| A19 | **Bölümlerin kaydırınca yükselmesi (`.reveal .sec`)** | Çizimde her bölüm ilk görününce `opacity 0→1`, `translateY(16px)`, **0,7 sn** `(.16,1,.3,1)`, `rootMargin -8%`, **bir kez görünen bir daha oynamaz** (`seenSec`) | `plan-v30/index.html:1070-1073`, `2480-2481` (v18'den beri). Canlıda aynı etki yalnız **ilk açılışta** (A3) | `body.still`/`prefers-reduced` | Kod: yok (`grep reveal app.css` boş) | ÇELİŞKİ | `plan-v30` → kaydır |

Test kapsamı: `tests/opening.test.ts` (vuruş, sayaç, `claimOpening`), e2e Part 6 `scripts/e2e.mjs:5054-5135` (ilk kareden başlama, sayfa kaymaması, 1 sn içinde dolu, aşağıdakiler kaydırınca, yenilemede tekrar yok, tuşla biter).

---

## 3. Plan kartları

Not: kartların hareket sınıfları (`pk-seal`, `pk-glow`, `pk-drop`) yalnız `cards/PlanCard.tsx:188-190,257` içinde bağlı (seçilmiş/rezerve kartlar). v30'un yeni kartları (`NeedCard`, `EmptyCard`, `MediaCard`, `LegCard`) için tek hareket: boş kartın nabzı (`.ek-card .pk-ring`) ve arka yüz çevirme. Spec `plan-v30-design.md:268`: kartlar bitince hareket işlerinin yeni kartlara oturtulması bekleniyordu.

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| K1 | **Düşüş** (sohbetin eklediği kart) | `dropsIn(id, createdAt, fromChat)`: yalnız `origin:"chat"`, ≤4 sn, her kart bir kez | bkz. §1.3 | var | ux-katmanli 208-209; `motion.ts:64-70`; `PlanCard.tsx:190,257`; `app.css:4275,4279`; e2e 5018 | ÇELİŞKİ (§1.3) | ux-katmanli "5" → Oynat |
| K2 | **Nabız** (boş kart bekler) | Kartın halkası `open`/`half` iken sürekli | `pk-pulse` 2,8 sn ease-in-out sonsuz | var | ux-katmanli 211-212; `app.css:4276,4280`; commit `4abf7ed` ("already on v30's empty cards"); e2e 5012 | ÇELİŞKİ (§1.3) | aynı |
| K3 | **Mühür + tik zıplaması** | Kart rezerve olunca; `pk-stamp` (kart köşesinde soluk yeşil tik, `UiIcon check`) ve `pk-ring.done` | bkz. §1.3. Çizimler: `2026-10-08-ozora-web-v5.html:389` `stamp` = damga `rotate(-30°) scale(1.8)` büyükten gelir, `rotate(-12°) scale(1)`, `opacity .4`; `sihirli-acilis` kartta `scale 1.9→.9→1` 380 ms (≈ satır 448) | var | `PlanCard.tsx:188,257,262`; `app.css:4273,4277` | ÇELİŞKİ (yön: kod küçükten büyür, Ozora çizimi büyükten "basılır") | `2026-10-08-ozora-web-v5.html` → bir kartı rezerve et |
| K4 | **Parlama** | Kartın verisi değişince | bkz. §1.3 | var | `PlanCard.tsx:189`; `app.css:4274,4278` | ÇELİŞKİ (§1.3) | — |
| K5 | **"Yeni" parlama + etiket (kalıcı vurgu)** | Pano'ya düşen/yeni işlenen kart: `glow 2.2s ×2`, 5→12 px, sağ üst "Yeni" etiketi 4,4 sn, metin zemin vurgusu (`hl 2.4s`) | `2026-10-08-ilk-ekran-v1.html:233-244`; `asamalar-web-v3` `fresh` (452) | çizimde: 3 px sabit halka (242) | Kodda yok; yakın karşılığı `ar-new` (K19) | CANLI (v46, P8d, `19a2ef6`: Yeni etiketi görülene kadar, ar-ring) | `ilk-ekran-v1` → Oynat |
| K6 | **Yükselme (kart hover)** | `(hover:hover)` | −2 px / .18 sn kod; çizim −3 px / .18 sn. Ayrıca: `.pn-card` .25 sn e-out −2 px (3389-3390); `.it-tile` .25 sn −2 px (3500-3501; 4614'te `.it-tile:hover{transform:none}` geçersiz kılıyor); `.vcard .pic` −3 px .5 sn (3796-3797); `.ts-stop:hover .ts-ring` −3 px + `scale 1.06` .35 sn (3951-3955); `.st-go/.st-start` −1 px | `.pk-card` var; `.pn-card` hover için kural **yok** | ux-katmanli 205-206; e2e 5004 | CANLI (değerler §1.3'te ÇELİŞKİ) | — |
| K7 | **Sayaç (bütçe rakamı)** | Rakam yeni değere değişince | bkz. §1.3 | var | `Counted.tsx`; `TripFacts.tsx:177,187`; e2e 5031-5046 | CANLI | — |
| K8 | **Kart çevirme (seçenekler / arka yüz)** | Karta ya da "N alternatif"e basınca arka yüz kartın yerine, satırın tüm genişliğinde gelir (akışta; yan kart bir satır aşağı kayar: "bilerek") | `ch-flip` **380 ms** (`--t-slow`) `--e-out`, `perspective(900px) rotateY(-78deg)`, `opacity 0→1`, `transform-origin:50% 50%`, `both`. **Kapanış animasyonu yok** (anında). | Yalnız `prefers-reduced-motion: no-preference` içinde tanımlı (`app.css:4559`) | Çizim: plan-v14 "Çevir" (karta basınca dört açılıştan biri: Çevir, Balon, Çekmece, Kart içinde; `dfd61b2`); `plan-v30/index.html:887-888` `flipin .5s (.16,1,.3,1)` `perspective(1000px) rotateY(-80deg)`, `opacity .2→1`. Kod: `cards/NeedCard.tsx` ChoiceSheet; `app.css:4557-4560`. Spec `plan-v30-design.md:133-136` | CANLI (süre/açı farkı küçük) | `plan-v30` → bir karta bas |
| K9 | **Arka yüz kartın yerinde biner, düzen kaymaz** | Çevirirken yan kart kaymaz; arka yüz ızgara genişliğinde mutlak konumlanır, altındakilerin üstüne biner | `.backov` `flipin .45s`, `transform-origin:center top`, `placeBack()` | — | `plan-v39-bilet` (wip) 1644, JS `placeBack`; `docs/superpowers/specs/2026-10-13-plan-v37-fark-listesi.md` E1 (M, SORU 6) | CANLI (v46, P4, `a799601`: arka yüz kartın yerinde biner) | `git show origin/plan-v30-wip:docs/mockups/plan-v39-bilet/index.html` → "Değiştir" |
| K10 | **Çekmece / Balon / Kart-içi seçenek** (v14 alternatifleri) | Çekmece: `slidein .34s` `translateX(36px)+opacity`; Balon (`#layerRoot .pop`): `rise .28s`; scrim `fadein .2s` | `plan-v30/index.html:915-919` | — | Spec ve fark listesi §3 (v31 "Yan yana · Balon · Çekmece" vazgeçildi) | VAZGEÇİLDİ | `plan-v14` |
| K11 | **× → ince satıra katlanma** ("X kaldırıldı · Neden? [Gerek yok] [Ben hallettim] · Geri al") | × ile kart yerinde ince satıra döner | Çizim: `.fold` `rise .3s (.16,1,.3,1)`, `translateY(6px)`. Kod: `.pk-fold` yapısı var (`app.css:4536`), **animasyon yok** | — | `plan-v30/index.html:1508`; spec `plan-v30-design.md:127-132` | ÇELİŞKİ (yapı canlı, giriş animasyonu yok) | `plan-v30` → bir kartta × |
| K12 | **Aşama geçişi (K29): uçak silüeti kalkış, çizim düşer, etiket zıplar, rezervede mühür basılır; "Hareketi duraklat"** | Seçenek seçilince / rezerve olunca | `.arrive`: `drop .7s (.16,1,.3,1)` (art, `translateY(-14px) scale(.85)`), `takeoff 1.1s` (silüet `translate(-40%,8px) rotate(-6°)→…`), `pop .5s (.2,1.6,.4,1)` (etiket), `glow 1.6s` 0→6→14 px | `.still` / `prefers-reduced` | `plan-v30/index.html:621-628`, JS `arrive()` 2483; `docs/urun-yol-haritasi.md:154-155` (K29). Kod: yok (`grep takeoff` boş) | CANLI (v46, P8c, `73da513`: K29 kalkış, düşme, zıplayan etiket) | `plan-v30` / `2026-10-08-japonya-web-v11.html` → bir kartı seç |
| K13 | **"İndi" (landed)** (sonuç gelince kart iner: halka 9 px + `scale 1.015`, 1,1 sn) | v16'dan beri çizimde: link yerleşince / sonuç gelince | `@keyframes landed` | — | `plan-v30/index.html:1006-1007`; v33 akış (`play()`, "Omurga → Aranıyor → Sonuçlar"); fark listesi A (v33) ve **SORU 10** | CANLI (v46, P8c + P7, `73da513`, `67814c3`: pk-landed, taslağa bağlı) | v33+ → "▶ Baştan oynat" |
| K14 | **Aranıyor** (kartta kayan ışık çubuğu / v37'de dönen kesikli halka) | AI arayınca | `.searching .bar` `shimmer 1.4s linear`; `.slot.srch2` `shimmer 1.8s`; `t3-chk` `spin 3s` | still/reduced | plan-v33 `srch2`, plan-v37 `spin` (`plan-v39-bilet/index.html:298-299,1617,1761-1762`, wip) | YAYINDA DEĞİL | v33+ → "2 · Aranıyor" |
| K15 | **Gezinin şekli şeridi: yürüyen uçak/tren** | Şeritteki her durak arası; sürekli | `ts-travel` 6 sn `(.45,0,.55,1)` sonsuz (tren/otobüs/feribot/araba 5 sn), `left:0→calc(100%-18px)`, `opacity` 12-88%; ipucu kutusu `opacity+translate+scale(.96)` .2/.3 sn; halka hover `translateY(-3px) scale(1.06)` .35 sn | `animation:none; left:50%` (3972) | `plan-v30/index.html:196,206-208`; kod `plan/TripShape.tsx:71`, `app.css:3951-3972` | CANLI | `plan-v30` → "Gezinin şekli" |
| K16 | **Uçuş kartında uçağın rotaya süzülmesi** (`rt-fly`) | Her kart çizilişinde | `rt-fly .9s (.16,1,.3,1)`, `margin-left:-18px→0`, `opacity` | `animation:none` | plan-v21'den beri (`plan-v30/index.html:1246-1248`) | CANLI (v46, P8c, `73da513`: pk-fly) | `plan-v30` |
| K17 | **Canlı uçuş noktası nabzı** (`lv-dot`) | "Canlı" etiketi | `lvp 1.6s` ease-in-out sonsuz, halka 4→7 px | `animation:none` | plan-v28 (`plan-v30/index.html:1494-1497`) | CANLI (v46, P8c, `73da513`: Canlı noktası lvp) | `plan-v30` canlı rötar senaryosu |
| K18 | **Bölüm açma/kapama (katla/aç)** | Kullanıcı bir bölümü açınca | Kod: `mv-unfold` 260 ms +40 ms gecikme, `opacity + translateY(-6px)`; ok `transform` 260 ms; **açık gelen bölüm animasyonsuz** (`toggled` ref); kapanış anında. Çizim: `grid-template-rows 0fr↔1fr` **0,45 sn** (yükseklik animasyonu) | `animation:none`, ok geçişi kapalı (4404) | Kod `plan/Section.tsx:44-48,99`, `app.css:4348-4349`; çizim `plan-v30/index.html:249`. Spec `plan-v30-design.md:259` | ÇELİŞKİ (çizim yükseklik kayması, kod yalnız belirme; H1 "kutu boyutu oynamaz" ilkesi kodu haklı kılıyor) | `plan-v30` → bölüm başlığı |
| K19 | **Gelen içerik (arrivals)** | Link/dosya yapıştırılınca: bekleyen kart, yeni kart girişi, sayaç zıplaması, toast, sürükle-bırak çerçevesi, sohbet çipi | `ar-pending` fade .24 sn; şerit `ar-shimmer 1.6s`; ayrıca ışık süpürmesi `mv-sweep 1.6s` (`4abf7ed`); `ar-new` `ar-in .32s` (8 px) + `ar-ring 1.5s` (`RING_MS 1900`); `ar-pop .36s` (sayaç `scale 1.14`, `POP_MS 420`); `ar-toast .22s`; `ar-drop .18s`; `ar-chip .2s` | `app.css:2728-2731` + 4403 | Kod `arrive/useArrivals.tsx:16-17,144-145,177`, `arrive/ArriveViews.tsx`, `app.css:2575-2731`; commit `b4adeb1`. Çizim: `newlink 2.6s ×2` 3 px halka (`plan-v30/index.html:354,460-461`) | CANLI (süreler çizimden farklı: ÇELİŞKİ küçük) | `plan-v30` senaryo B "Prompt + linkler" |
| K20 | **Link yerleştirme sahnesi** (sohbette 5 link: "…" etiketine döner, 520 ms arayla kartlar yerine oturur, Kyoto açılır, toast "5 link yerine oturdu") | `placeLinks()` | `600 + i·520 ms`, `landed`, `scrollIntoView smooth` | still: 0 | `plan-v30/index.html:2451-2468`; kod karşılığı K19 (farklı mekanizma) | ÇELİŞKİ | `plan-v30` → B |
| K21 | **Geri al halkası** | "Geri al" toast'ında kalan süre | `pk-undo-run` stroke-dashoffset, `UNDO_MS = 8000` | kural yok (geri sayım) | `a27b1b8`, `cards/UndoToast.tsx:16-19`, `app.css:4237-4241`; ux-katmanli (Geri al halkası) | CANLI | — |
| K22 | **Karta git + parla (`.flash`)** | Yapılacak listesinden, "Sıradaki"nden, sohbet çipinden, "Plan'da gör"den | `scrollIntoView smooth center` + `flash 1.6s ease-out` 3 px `--accent` halka, 1700 ms sonra sınıf kalkar; gün kartında `dc-flash` 1.6 sn mavi halka | `.flash` reduced'de `outline 3px` (785); `dc-flash` için kural **yok** | `Progress.tsx:9-16`, `app.css:783-785,2410-2411`; e2e 811, 821, 1169, 2045, 2670, 2821 | CANLI | — |
| K23 | **Aşama halkası/çubuk dolumu** | Bölüm çubuğu ve hero çubuğu | `.cat-bar > span` width .8 sn e-out; `.hx-bar i` width .4 sn; çizim: `seg i`, `sec-h .mini i` width .8 sn | kural yok | `app.css:3855,1210`; `plan-v30/index.html:163,245` | CANLI (reduced boşluğu) | — |
| K24 | **Kendin ara çipi, kart araç şeridi, tooltip** | Hover/odak | `ek-nm` `max-width .22s + opacity .18s`; `pk-strip` `opacity/transform .16s`; `tipx-in .14s` (4 px); `cpy-b` etiketi; `ev-fold-list st-in .2s` | var (4219,4235,4256,4263) | `2ecd928`; `app.css:4188-4263` | CANLI | ux-katmanli "Kendin ara" |
| K25 | **ⓘ düğmesi balonu** (v34+: 250 px balon, odakla/dokunmayla) | Hover/odak | `.inf-pop` | — | `plan-v39-bilet` (wip) `infoBtn`; fark listesi B3 | YAYINDA DEĞİL | v34+ |
| K26 | **Kalp/beğeni zıplaması** | Pano kartında kalp | Çizim `.pc .heart` `transform .25s (.2,1.6,.4,1)`; kod `.pn-heart` `transform .15s` | — | `plan-v30/index.html:664`; `app.css:3397` | ÇELİŞKİ (küçük) | `plan-v30` Pano |
| K27 | **Kart fotoğrafı bulanıklıktan çıkar** (gezi kartı) | `FallbackImg` `loaded` sınıfı | `mv-blur-up` 600 ms `--e-out`, `blur(14px) scale(1.04)` | `animation:none` | `FallbackImg.tsx:7-8`, `app.css:4358`; kaynak mockup yok | CANLI | Ana ekran |

---

## 4. Pano ve yapışkan şerit geçişleri

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| P1 | **Plan ⇄ Pano sekme çizgisi ve görünüm geçişi** | Sekmeye basınca | Çizgi `mv-tab` 260 ms (`scaleX .3`, `opacity`); görünüm `mv-fade` 260 ms (**yalnız opacity**: altındaki imleç kaymasın); uygulandığı sınıflar `.cat-plan, .trip-plan, .doc-tab, .tm-tab, .pn` | var | `app.css:4333-4334`; kaynak mockup yok; spec "Plan \| Pano geçişi" (`plan-v30-design.md:56`) hareketsiz | CANLI | — |
| P2 | **Yapışkan şerit girişi** | Hero ekrandan çıkınca şerit tepeden iner | Kod: `.sbar` `transform .22s ease` (`translateY(-110%)→0`) + `visibility 0s .22s` (kapanışta gecikmeli gizleme). Çizim: `.mhero` `translateY(-100%)→0`, **.3 sn `(.16,1,.3,1)`** (v19'da ilk hâl: `opacity + translateY(-10px)` .35 sn) | `transition:none` (4219) | `plan-v39-bilet/index.html:1094,1545` (wip); `app.css:4209-4210`; `StickyBar.tsx`; e2e 547-554 | ÇELİŞKİ (süre/eğri farkı; 220 ms ease ↔ 300 ms e-out) | `plan-v30` → aşağı kaydır |
| P3 | **"Sıradaki: … →" ile karta git ve parla** | Şeritteki düğme | `Progress.show()` (K22) | var | spec `plan-v30-design.md:317`; e2e 547-554 (şerit), 811-821 (flash) | CANLI | — |
| P4 | **"Plana koy/ekle": kartın adı Plan sekmesine uçar; sekme zıplar** | `Plana koy / Plana ekle / Add to plan` düğmesine basınca (Pano, Pano grubunun seçenekleri, kaydırmalı kart) | Çip `mv-fly` (kartın adı, ≤28 karakter, `.ax-c` ise `aria-label`) yay çizerek: başlangıç → ortada `arc = min(y0,y1)−60 px, scale .85` → hedef `scale .4, opacity 0`; **420 ms** `(.65,0,.35,1)`; bitince sekme `scale 1→1.18(%40)→1`, **380 ms** `(.2,.9,.3,1.3)`. Plan sekmesi görünmüyorsa hiçbir şey | `putFly.ts:19` `reducedMotion()` ise hiç | `putFly.ts:8,15,17-57`, `app.css:4362`; `main.tsx:16`; `4abf7ed`; test `tests/putFly.test.ts`; spec **"kartın bölümüne uçması"** (`plan-v30-design.md:268`) | ÇELİŞKİ (spec: kartın bölümü; kod: Plan sekmesi) | Uygulamada Pano → Plana ekle |
| P5 | **"Pano'da N alternatif" → Pano o grubu kaydırır, çerçeveler** | Plan kartından | `scrollIntoView block:start smooth` 60 ms sonra; "← Plan'a dön" | `behavior` hâlâ smooth | `board/Pano.tsx:63-65,88`, `TripPanel.tsx:116`; çizim `plan-v30/index.html:2534-2535` | CANLI | — |
| P6 | **"Plan'da gör →"** Plan'a döner, kart parlar | Pano grubundan | `flash` (K22) | var | `Pano.tsx:65`; `2026-10-08-plan-pano-v11-design.md:170-171` | CANLI | — |
| P7 | **Pano boş/sonuçsuz durumda maskot** | Kayıt yok → `sleepy` (yavaş nefes `ms-breathe 3s`, "z" `ms-zz 3s`); süzgeç boş → `oops` (kafa eğik `ms-oops 2.8s`); `pn-empty` `mv-rise` 380 ms | reduced: yüz hareketi durur (4406) | `board/Pano.tsx:212`, `app.css:4328-4330,4385,4393-4398`; spec `plan-v30-design.md:260` | CANLI | — |
| P8 | **Pano açılışı: iskelet önce, kartlar "tık tık" iner, sayılar 0'dan sayar, öneri şeridi bir kez parlar** (giriş akışı çizimi v1 5. adım) | Oluştur sonrası pano açılırken | İskelet dalgalanma; kartlar 90 ms arayla, 600 ms'de yerine ("Kart iner": köşede nabız); öneri şeridi 600 ms + bir kez parlama; "Planlıyorum" ikonu tike döner | — | `giris-akisi-v1/index.html:404-450` (Pano açılışı). v2 "Pano adımı çizimden çıktı… ayrı çiziliyor"; yerine Sihirli açılış (§2) | VAZGEÇİLDİ (ayrı çizime devredildi, canlıda B açılışı) | `giris-akisi-v1` → "Pano açılışı" |
| P9 | **Pano "Neden?" yükseklik açılışı** (`.detail` `grid-template-rows .4s`, `.why2 svg` ok `.3s`) | Basış | Çizim | — | `plan-v39-bilet/index.html:686-688` (wip); kodda "Neden?" açılış animasyonu için kural yok | CANLI (v46, P8d, `19a2ef6`: Neden? açılışı (.pn-detail), ok dönüşü) | v37+ Pano |
| P10 | **Harita sekmesi: uçuş tekrarı** | Harita sekmesinde (MapLibre) | `FLY_MS = 2300`, `easeTo` kübik; uçak işaretçisi; bitince `fitBounds` 1200 ms; yeniden sığdırma 500 ms | `still` ise `jumpTo`, süre 0 | `map/TripMap.tsx:64,406,476,542`; commit `0e65818` | CANLI | Uygulamada Harita sekmesi |

---

## 5. Pencere ve çekmece girişleri

Hareket dili kararı: pencere/çekmece **giriş + çıkış**; çıkış giriş yönünün tersi, daha hızlı. Çıkış tekniği: uygulama `{open && <Modal/>}` ile pencereyi hemen söküyor; `exitMotion` söküldüğü an üstüne **hareketsiz bir kopya** koyup soldurur.

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| W1 | **Arka perde girişi** | `.modal, .overlay, .compare-modal, .pk-sheet-back` açılınca | `mv-fade` 260 ms `--e-out`, `backwards` | `animation:none !important` | `app.css:4341`; kaynak mockup yok. Çizimler: `seritler/index.html:212` `fade .2s`, `plan-v30/index.html:916-917` scrim `fadein .2s`, picker scrim `opacity .25s` (576) | CANLI (süre çizimde 200-250 ms) | — |
| W2 | **Pencere kartı büyür** | `.modal > .modal-card, .hs-dlg, .hs-hist, .bk-sheet, .compare-card, .pk-sheet` | `mv-pop` 260 ms, `scale .96→1 + opacity`. Çizim: confirm `translateY(12px) scale(.98)` .35 sn; picker `translateY(16px) scale(.98)` .4 sn | var | `app.css:4342`; `plan-v30/index.html:437,578` | ÇELİŞKİ (yükselme yok, ölçek farkı) | `plan-v30` → bir kartın pencere/ayrıntısı |
| W3 | **Çekmece (ItemDrawer) sağdan kayar** | `.drawer` | `mv-drawer` 380 ms `--e-out`, `translateX(100%)→0`. Çizim: `seritler` `slide .28s` `translateX(40px)+opacity`; plan-v30 sheet `slidein .34s` `translateX(36px)` | var | `app.css:4343`; `seritler/index.html:214` | ÇELİŞKİ (kod tam genişlik kayıyor, çizim 40 px) | `seritler` B (çekmece) |
| W4 | **Çıkış kopyası (pencere/çekmece solarak kapanır)** | Bir pencere/çekmece DOM'dan sökülünce (`MutationObserver`, `removedNodes`) | Kopya (`cloneNode`, `id`'ler silinir, `aria-hidden`, `inert`, `.mv-leaving`) body'ye eklenir; **180 ms** `--e-in` solar; kart `scale .97`'e küçülür (180 ms); çekmece **260 ms** `translateX(100%)`; `EXIT_MS = 320` sonra silinir | Reduced: gözlemci hiç kopya yapmaz (`exitMotion.ts:20`) | `exitMotion.ts:9-35`, `app.css:4344-4346`, `main.tsx:14`; `886cf0e`; hata düzeltmesi `c305557` (self-update boşta denetimi kopyayı açık pencere sanıyordu). **Birim/e2e testi yok**; e2e yalnız ekran görüntüsü için `mv-` girişlerini bekliyor (34-45). Çizimlerde yalnız scrim çıkışı var (`plan-v39-bilet/index.html:2583` `closePicker`, wip) | CANLI (testsiz) | Uygulamada bir pencereyi kapat |
| W5 | **Kart seçenek penceresi (ChoiceSheet) bu animasyonların dışında** | v30'da seçenekler kartın arka yüzü (K8) | `.ch-sheet` kuralları kaldırıldı | — | `plan-v30-design.md:267`, `4abf7ed` | CANLI | — |
| W6 | **Profil açılır menüsü** | Ana ekranda avatar | `hm-pop` .22 sn `--hm-ease`, `translateY(-6px) scale(.97)`, `transform-origin: top right` | var (2832) | `app.css:2763-2764` | CANLI | — |
| W7 | **Ayarlar: yanlış anahtar kutusu sarsılır** | Anahtar "bad" | `mv-shake` 300 ms `--e-move` bir kez, kenarlık `#e2789f`, satır `key-bad-line` | var | `Settings.tsx:181`, `app.css:4389` | CANLI | Ayarlar → hatalı anahtar |
| W8 | **Çevrimdışı şeridi** ("İnternet yok · N sn sonra tekrar deniyorum") | Bağlantı kesilince | `mv-rise` 260 ms; 5-10-20-30 sn geri sayım; "Şimdi dene"; "Kaydedildi ✓" | var | `OfflineNotice.tsx`, `reconnect.ts`, `app.css:4374-4378`; `210afed`, `4abf7ed` (App.tsx'e takıldı) | CANLI | — |
| W9 | **"Asistana bağlanamadım · Ayarlar'a git" şeridi** | Sohbette ayarlanabilir hata | `mv-drop` 380 ms (`translateY(-10px)`), üzgün maskot (`oops`) | var | `Chat.tsx:189-194`, `app.css:4368-4372` | CANLI | — |
| W10 | **Sohbet hata satırı** | Genel sohbet hatası | `mv-rise` 180 ms | var | `app.css:4388` | CANLI | — |
| W11 | **"N kayıt işleniyor…" hapı** | Ana ekranda işlenen kayıt | `mv-rise` 180 ms; dönen halka 0,8 sn (reduced 2,4 sn) | yavaşlar | `TripsHome.tsx:404`, `app.css:4359-4360` | CANLI | — |
| W12 | **Boş ekranlarda maskot, sonra yazılar sırayla yükselir** | Seyahatlerim boşken | `mv-rise` 380 ms, çocuklar 0/60/120/180 ms gecikmeli | var | `TripsHome.tsx:432-433`, `app.css:4380-4385` | CANLI | — |
| W13 | **Ana ekran girişleri** (başlık, kutu, çipler, gezi kartları) | Ana ekran açılınca | `hm-rise` 0,7 sn `--hm-ease`, `translateY(14px)`; kutu 80 ms, çipler 160 ms, kart ızgarası 0/60/120/180 ms | var (2832) | `app.css:2780-2782,2795,2818-2822` | CANLI | `giris-akisi-v2` Adım 1 |
| W14 | **Ana ekran arka planı "A · Rota"** (kâğıt uçak 18 sn döngü) | Sürekli | SVG `animateMotion 18 s`, opaklık 0→.9→0; reduced: uçak gizli | `.hm-plane{display:none}` (2835) | `HomeBackdrop.tsx`; çizim `giris-akisi-v2` (B Aurora ve C Topografya seçenekleri: `aur 24 s`, `breathe 16 s`) | CANLI | `giris-akisi-v2` Karar 3 |
| W15 | **Ana ekran arka planı B Aurora, C Topografya** | — | `aur 24s`, `breathe 16s` | — | `giris-akisi-v2/index.html:70-78`; kod yalnız A | VAZGEÇİLDİ | `giris-akisi-v2` Karar 3 |
| W16 | **Yer tutucu cümlelerin dönmesi** | Ana ekran kutusu boşken 3 örnek ("Bali'ye 3 hafta…", "Mayısta Lizbon, babamlarla, merdiven yok…", "Ozora festivaline 3 arkadaş gidiyoruz…") 9 sn'de bir değişir | `phc 9s` `translateY(6px)→-4px` | var | `giris-akisi-v2/index.html:143-152,343`; kod `TripsHome.tsx:342` tek sabit yer tutucu | CANLI (v46, P8d, `19a2ef6`: yer tutucu cümleler (phc)) | `giris-akisi-v2` Adım 1 |

---

## 6. Sohbet ve gezi başlatma akışı

### 6.1 Ekran geçişleri (View Transitions)

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| S1 | **Giriş kutusu → sohbetin ilk mesajı akar** (Enter anı) | Ana ekranda Enter / "Planlamaya başla" / bir başlangıç çipi | Düğme basışı 120 ms; kutu balona akar **620 ms** ("hızlı başlayıp yumuşak biten"): `::view-transition-group(start-prompt)` .62 sn `(.16,1,.3,1)`; **eski ekran** (root old) .22 sn `(.4,0,1,1)` söner; **yeni ekran** (root new) .42 sn `--e-out`, `scale .992 + opacity`; ilk kullanıcı mesajı `view-transition-name: start-prompt` (ana ekranda kutunun adı `.st-prompt`) | `withTransition()` → anında; sönme/belirme bile yok (`viewTransition.ts:18-29`); tarayıcı vazgeçerse promise'ler sessizce yutulur (`386a0b4`) | `app.css:2782,2840-2849`; `viewTransition.ts:23-30`; `App.tsx:262-281`; `StartChat.tsx:761`. Çizim `giris-akisi-v1|v2` Adım "Enter anı" (v2:397-424); notlar "Süreler" | CANLI | `giris-akisi-v2` → Enter anı |
| S2 | **Sağ taraf (plan/kontrol listesi) kayarak gelir** | Aynı geçişte | `::view-transition-new(start-side)` **.7 sn** `(.16,1,.3,1)` **80 ms gecikme**, `translateX(56px)+opacity`; eski `start-side` .25 sn `ease-in` söner (`.st-side` adı) | aynı | `app.css:2844-2849` | CANLI | aynı |
| S3 | **Oluştur sonrası pano yumuşak açılır; sohbetten çıkış** | `onCreated` ve `onClose` | `withTransition` (root crossfade .22/.42 sn) | aynı | `App.tsx:262-270` | CANLI | — |
| S4 | **Yan panel (kontrol listesi/önizleme) kayması** | Başlatma sohbetinde sağ sütun | S2 ile aynı; dar ekranda kontrol listesi ince çubuğa katlanır (`st-bar-track` genişlik .3 sn). Pano içindeki sohbet panelinin açılış/kapanış animasyonu: ne kodda ne mockup'ta tanımlı | var | `app.css:3109` | CANLI (S2'nin parçası) | — |

### 6.2 Sohbet içi hareketler (başlatma sohbeti)

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| S5 | **Asistan mesajı girişi** | Her yeni asistan balonu | `st-in` .35 sn ease-out (`translateY(4px)`) | var | `app.css:2908,2910` | CANLI | — |
| S6 | **Okuyor… satır hâli** | Mesaj gönderilince, doldurulabilecek satırlar | Satırın halkası döner (`st-spin .9 s`), değerin yerinde parlayan şerit (`st-shimmer 1.1 s`, %62 genişlik); kodun hemen bulduğu (kimle, süre) anında dolar | var (3036) | `app.css:3027-3036`; spec `niyet-planlayici-design.md:19-21`; çizim giris-akisi `spin`, `shim` | CANLI | `giris-akisi-v2` Adım 3 |
| S7 | **Satır tamamlanınca tik zıplar + 6 nokta saçılır** | Cevap satırı doldurunca | `st-tick` .45 sn `(.2,.9,.3,1.3)` (`scale .3→1`), değer `st-in .35 s`, `st-burst .55 s` (altı nokta, 10→27 px, 3 renk) | `.st-sp{display:none}` | `app.css:2863-2864,2987,3780-3790`; çizim "Tik 340 ms" (`giris-akisi-v2:505`) | ÇELİŞKİ (çizim 340 ms, kod 450 ms) | `giris-akisi-v2` "Pıt pıt sözlüğü" → Tik → Tekrar |
| S8 | **Halka ilerlemesi (x/6)** | Satır doldukça | `stroke-dasharray` .55 sn `--e-out` | `transition:none` | `app.css:2931,3787`; çizim "Halka 550 ms" | CANLI | aynı → Halka |
| S9 | **Sorulan satır nefes alır** | Sıradaki soru | `st-ask` 1,7 sn sürekli, `box-shadow 0→8px` | var | `app.css:3788-3790`; çizim "Nereye satırı nabız atar" | CANLI | aynı |
| S10 | **"Kart iner" (600 ms, kartlar arası 90 ms, köşede nabız)** | Çizimde sağ panele kart düşer | `rise .6s` + `.mc u` nabız | — | `giris-akisi-v2:507,282`; kodda **yok** (sağda yalnız önizleme şeridi) | YAYINDA DEĞİL | `giris-akisi-v2` → Kart iner |
| S11 | **"Sayı" – rakam yukarı kayarak değişir (450 ms, zıplamaz)** | Çizimde sayaçlar | `.roll` | — | `giris-akisi-v2:508` | YAYINDA DEĞİL | `giris-akisi-v2` → Sayı |
| S12 | **"Satır" – sohbete düşen adım satırı yukarı süzülür, tik kendi "pıt"ını yapar (500 ms)** | Oluştur sırasında | Kod: `st-genline` `st-line-in .5 s (.16,1,.3,1)`, `translateY(10px)`; tik yeşil dolu daire | var (3775) | `StartChat.tsx:766-772`, `app.css:3735,3771,3773-3776`; çizim `giris-akisi-v2:509` | CANLI | `giris-akisi-v2` → Oluştur / Satır |
| S13 | **Düşünme satırı (başlatma sohbeti)** | Yalnız **gerçek bir çağrı** sürerken | Hap `st-in .25 s`, üç nokta `st-bounce 1 s` (−4 px, .4→1 opak), metin `st-stage st-in .3 s`; `role=status aria-live=polite`, sohbet günlüğünün **dışında** (`StartChat.tsx:892-916`). Metinler: **"Okuyorum…"**, **"X'i tanıyorum…"**, **"… tarihlerini kontrol ediyorum…"**, **"Rotayı düşünüyorum…"** | noktalar durur (3022, 3035) | `startTrip.ts:2453-2464`, `startEventDates.ts:78-79`; spec `niyet-planlayici-design.md:22-26`; e2e 4012-4031, 4422 | CANLI | `giris-akisi-v2` Adım 2 (Okuyor) |
| S14 | **"Yazıyor…" aşaması** | Spec: "Düşünüyor… / Rotayı çiziyor… / Yazıyor…" üç gerçek aşama | `Stage = "thinking" \| "writing"` durumu hâlâ var (`StartChat.tsx:63,625`), ama ekranda **yazı yok**: `1f9ef45`'te eklendi, `d34f0a2`'de (v5) gerçek-çağrı satırlarıyla değiştirildi | — | `2026-10-06-oneriler-ve-sohbetle-gezi-design.md:98-99`; `StartChat.tsx:8-9` (bayat yorum); `git log -S'Yazıyor…'` | VAZGEÇİLDİ | — |
| S15 | **"Oluşturuyorum… 3 · Vazgeç" geri sayımı** | Gerekli bilgiler (nereye, ne zaman/süre, nereden, kimle) belli olunca kendiliğinden | Kart `st-in .25 s`; çubuk `st-auto-fill` doğrusal `scaleX 0→1`, süre `autoSeconds()`: **3 sn**, stil/`pb` sorusu görünürken **6 sn**; çip basışı geri sayımı baştan başlatır; yazmak, dokunmak, IME, gizli sekme durdurur; "tamam oluştur / hadi / generate / let's go" hemen oluşturur | çubuk animasyonsuz (2894) | `StartChat.tsx:165,423-460,578,895-904`, `startTrip.ts:1554-1556`, `app.css:2887-2894`; commit'ler `d20fc3d`, `78bf0c5`; spec `2026-10-06-oneriler-ve-sohbetle-gezi-design.md:132-137` | CANLI | `giris-akisi-v2` Adım "Oluştur": "Her şey tamamken" |
| S16 | **Oluştur her adımda basılabilir; tek kelime "Oluştur"** | Kontrol listesi kartı | Düğmenin altında "elde ne var" yazısı; çizimde basış animasyonu `press .5 s` (`scale .975`) | — | `4c4ca01`; `giris-akisi-v2:220,448-455`; kodda basış animasyonu yok (`.st-gen-btn transition: transform .15s`, `app.css:2952`) | ÇELİŞKİ (çizim basış hareketi kodda yok) | `giris-akisi-v2` → "Oluştur: tek kelime" |
| S17 | **Önizleme şeridi** (sağ kartın tepesinde fotoğraflar) | Yer belli olunca | `st-pv-photo` `st-in .4 s`; görüntü `opacity .6 s`; adlı etiketler | var | `Preview.tsx`, `app.css:2914,2919,3021`; `14b86ae` (giris-akisi-v3 "tek panel") | CANLI | `giris-akisi-v3` Revizyon 1 |
| S18 | **Canlı sohbet: soru beklemeden gelir (0 sn), cevaplarken sağ taraf dolar (1 sn), model yetişince söz kenarında ince mor çizgiyle eklenir (3 sn)** | Başlatma sohbeti | Davranış (hareketsiz çizim); model cevabı 6 sn içinde gelirse kodun satırının üstüne yazılır (`REPLY_MS`), okuma 25 sn'ye kadar sürüp doldurur (`READ_MS`); rota sohbeti tutmaz | — | `giris-akisi-v3/index.html:387-427`; `start/model.ts:5-21` | CANLI (davranış). "Her cevaba model sözü" seçenekleri (her cevaba · yalnız yazdıklarıma · her ikinci cevaba) için **karar kaydı yok** | `giris-akisi-v3` Revizyon 2 |
| S19 | **"Plan taslağı"** (sağda kartlar sohbet ilerledikçe düşer, cevap bir kartı değiştirince parlar; kesikli = Arıyoruz) | Başlatma sohbeti | `lp-card` `lp-in .6 s (.16,1,.3,1)` `translateY(10px) scale(.97)` sırayla; `lp-glow 1.4 s` (10 px halka); reduced: sabit çerçeve | var | `3ae8672` `src/app/start/LivePlan.tsx` (152 satır, kod başlığı: Emre "şablonu çıkarsın, sağ tarafta oluşmaya devam etsin, tık tık tık"); `29b5e74` kaldırdı; `giris-akisi-v1` Karar 3, `v2` Karar 6 ("ikisini de kaldırıp bugünkü sıraya dön"). **`urun-yol-haritasi.md:431-433` hâlâ var diye yazıyor** | VAZGEÇİLDİ (belgede ÇELİŞKİ) | `git show 3ae8672:src/app/start/LivePlan.tsx` |
| S20 | **Soru sırası (K4) ve konuşan sorular** | Başlatma sohbeti | Sıra: nereye → (etkinlik/çelişki) → süre → başlangıç → hangi gün → tür soruları → ne istiyorsun → rota → kimle → kaç kişi → nereden en sonda; soru kalın, nedeni soluk; araya soru girerse önce kısa dürüst cevap sonra kendi sorusu; tavsiye 💡 ayrı kutu | — | `startTrip.ts:1411-1421`; `urun-yol-haritasi.md:25` (K4 "KODLANDI 2026-10-09, Emre onayı"). **Aynı belgede 442-446 "Açık karar … uygulanmadı" bayat** | CANLI (belgede ÇELİŞKİ) | `giris-akisi-v2` Adım 3 |
| S21 | **Ana ekran önerileri çalışır** | "Bana ilham ver", "Son dakika kaçamağı", "Yol gezisi", "Paylaşılan geziye katıl" | Kodda `mode: inspire\|lastminute\|road` ve ayrı soru dizileri var; çizimde "Yol gezisi" üstünde **"yakında" etiketi** vardı, kodda etiket yok | — | `TripsHome.tsx:56-59`, `startTrip.ts:1419-1420,2120-2126`; `giris-akisi-v3/index.html:476` | ÇELİŞKİ (etiket) | `giris-akisi-v3` Revizyon 3 |
| S22 | **Kartlarda yüzler yalnız grup gezisinde** | Gezi kartı/önizleme | Kural (hareketsiz) | — | `f332365`; `giris-akisi-v3` Revizyon 4 | CANLI | — |

### 6.3 Oluştur (oluşturma ekranı ve harita)

Kod: `start/Generating.tsx`, `start/GenMap.tsx`, `lib/startMap.ts`; çizim: `docs/mockups/2026-10-06-gezi-baslatma-v5.html` (kod başlığındaki kaynak), eski `2026-10-06-olustur-animasyon-v3.html`, `…-v4.html`, `2026-10-06-olustur-harita-v2(.png/-ucus/-inis)`. Spec: `2026-10-06-niyet-planlayici-design.md:28-38`.

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| S23 | **Oluşturma ekranı iskeleti** | "Oluştur" | Mor-gri zemin (`#eeecf5`), başlık "X planlanıyor", rota·gece satırı, harita kartı (2,1:1), büyük adımlar (18 px, 28 px işaret), ilerleme çubuğu (`st-progress` `transform .7 s (.3,.7,.3,1)`), "Birkaç saniye…". Her adım en az **600 ms** görünür (`MIN_STEP_MS`), tiki **220 ms** (`TICK_MS`) sonra sonraki adım; yüzde yok, akıcı çubuk | `still` → son kare | `Generating.tsx:36-40,228-290`; `app.css:2981-2996`; çizim `gezi-baslatma-v5` | CANLI | `2026-10-06-gezi-baslatma-v5.html` |
| S24 | **Dünya haritası zaman çizelgesi (SVG, MapLibre yok)** | Aynı | `genTimeline`: yakınlaş 0→1200 ms (uçuşsuz 1400); etiketler 1200'de; **uçuş 1750→4250 ms** (`labels+550`, 2500 ms); iniş = uçuş sonu; 2. yakınlaşma iniş→+1400; duraklar ilk durak +100'den **300 ms arayla**; yer yolu **350 ms** bacak; fotoğraflar son +250; bitiş +900; 3 duraklı gezide ≈ **8 sn** (spec "~9 sn"); tüm hareketler `easeInOut` (kübik); **pano**: uçak indikten sonra, en geç harita başladıktan **6 sn** (`OPEN_CAP_MS`), en az 300 ms sonra | `still` → son kare | `startMap.ts:179-199`; `GenMap.tsx:64-70+`; e2e `3169-3179`; `d34f0a2` | CANLI | `gezi-baslatma-v5` |
| S25 | **Ev simgesi pop, hedef etiketi** | Uçuştan önce | `gm-home` `scale 0→1`, .45 sn `(.3,1.6,.5,1)`; etiket `opacity .4s` | var (3101) | `app.css:3057-3060`; v5 çizimi `.home` | CANLI | — |
| S26 | **Uçak** | Uçuş aşaması | Kavisli rota, uçak ortada büyür (çizimde `0.85+0.35·sin(πt)`), gölgesi açılır (blur 2 px, .3), arkasında renk geçişli iz; rotaya göre döner | `still` | `GenMap.tsx:37-45`; v3 çizimi `olustur-animasyon-v3.html:70-79` | CANLI | — |
| S27 | **İniş halkası** | Uçak inince | `gm-ring.go` 1,1 sn `ease-out ×2`, `scale .3→3.4` | `.gm-ring` için kural yok (ama `still`) | `app.css:3067-3068` | CANLI | — |
| S28 | **Duraklar düşer** | İnişten sonra | `gm-stop` .55 sn `opacity+transform` `(.3,1.5,.5,1)`, `translateY(-20px) scale(.6)→none`; festival durağı pembe `#ff3d8b`; yer yolu pembe kesikli | var | `app.css:3069-3080` | CANLI | — |
| S29 | **Fotoğraflar haritanın üstünde büyük açılır; kutu erir** | Duraklardan sonra | `gm-card` `translateY(42px) scale(.88) → none`, `opacity .8 s` + `transform .9 s` `--e-out`, gecikme .16/.32 sn, açı ∓2,5°, orta kart −6 px; kart içi görüntü `scale 1.12→1` **6 sn**; haritanın beyaz kutusu, gölgesi, denizi `.6-.7 sn` eriyip şeffaflaşır, kara çizgiye döner (`.gm-svg` .5, `.gm-ov` .35 opak, `.9 s`), fotoğrafların arkasında mor ışık (`radial-gradient` .9 s); kaynak yazısı solar | `transition:none` (3776) | `app.css:3752-3768`; `giris-akisi-v2` Karar 5 "Fotoğraf sahnesi: kutu kalkıyor"; `29b5e74` | CANLI | `giris-akisi-v2` → Oluştur |
| S30 | **Adım tiki yeşil dolu, `gm-pop`** | Her adım bitince | `gm-pop` .35 sn (`scale .4→1.2→1`); metin `st-in .35 s`; renk geçişi .35 sn | var | `app.css:3095,2983,2986` | CANLI | — |
| S31 | **Her adım sohbette tikli satırla yazılır** | Adım bitince | `st-genline` (S12) | var | `Generating.tsx onLine`, `StartChat.tsx:766-772`; `giris-akisi-v1|v2` Adım 4 | CANLI | `giris-akisi-v2` Adım "Oluştur" |
| S32 | **Yelpaze fotoğraflar (harita yoksa)** | Dünya verisi yüklenmediyse | `st-fan` .6 sn `(.2,.8,.2,1)`, gecikme 0/.08/.16/.24; her kart `rotate` ∓9°/∓3° | var | `Generating.tsx:237-243`, `app.css:2968-2979` | CANLI (yedek yol) | — |
| S33 | **Eski harita sürümleri** | — | `olustur-animasyon-v3`: MapLibre (ağır bulundu: `niyet-planlayici-design.md:4-5`); `…v4`: hafif SVG ("adımlar küçük kaldı"); `olustur-harita-v2`: statik; Rev 3 `FlightMap`/`WorldFlight` (`st-map`, `MAP_TIMES 150-4300 ms`, `st-map-in .5 s`, `st-map-ring 1.5 s ×2`): kodda var, **hiçbir ekrandan çağrılmıyor** (yalnız `loadWorld` kullanılıyor) | — | `FlightMap.tsx:28-52`, `app.css:3001-3016` | VAZGEÇİLDİ (ölü kod) | `olustur-animasyon-v3/v4` |
| S34 | **Dünya haritası sohbet sırasında yüklenir; öneriler beklenmez** | Başlatma | Davranış; pano açılır, öneriler orada gelir | — | `urun-yol-haritasi.md:437-439`; `StartChat.tsx:42` | CANLI | — |

### 6.4 Board sohbeti (gezi açıldıktan sonra)

| ID | Ad | Tetik | Değerler | Reduced | Kaynak | Durum | İzlemek için |
|---|---|---|---|---|---|---|---|
| S35 | **Düşünüyor… satırı + üç nokta** | Cevap beklenirken | `th-dots` `mv-dot` 1,1 sn (−3 px, .25→1 opak, gecikme .15/.3 sn); metin `mv-fade` 180 ms; metinler: **"Düşünüyor…"**, **"Web'de arıyorum…"**, **"Fiyatlara bakıyorum…"**, 12 sn sonra **"Uzun sürüyor; bu arada yazmaya devam edebilirsin."** (`LONG_WAIT 12_000`) | noktalar 2,4 sn'ye yavaşlar | `thinking.ts:1-25`, `Chat.tsx:270-273`, `app.css:4352-4357,4405`; `tests/thinking.test.ts` | CANLI | — |
| S36 | **Maskot yüzü** | Sohbet başlığındaki 34 px koltuk | çalışırken `work` (zıplar `ms-bob 1,1 s`, gözler sağa sola `ms-look 2,2 s`); cevap gelince `done` (gözler iki küçük gülen yay, `DONE_FOR 1_400` ms); hata varken `oops`; beklerken `idle` (`ms-blink 3,2 s`) | `.ms-wrap[data-state] .ms` animasyonsuz (4406) | `Mascot.tsx`, `Chat.tsx:182`, `thinking.ts:20-24`, `app.css:4296-4306,4328-4330` | CANLI | — |
| S37 | **Sohbet mesajı girişi (`.msg rise .45 s`)** | Yeni mesaj | `translateY(6px)`, `(.16,1,.3,1)` | `.msgs .msg{animation:none}` (1012) | `plan-v30/index.html:115-116`; kodda board sohbet mesajına giriş animasyonu yok (yalnız `st-msg-bot`, başlatma sohbeti) | CANLI (v46, P8d, `19a2ef6`: sohbet mesajı girişi (mv-rise-s)) | `plan-v30` |
| S38 | **Sohbet yalnız kendi kutusunu kaydırır** | Her mesajda | `box.scrollTop = scrollHeight` (sayfayı hareket ettiren `scrollIntoView` bırakıldı); başlatma sohbetinde `.st-msgs{scroll-behavior:smooth}` | reduced: `auto` (3774) | `Chat.tsx:98-104`, `app.css:3769-3775`; roadmap "Hatalar" | CANLI | — |
| S39 | **Sohbet adım satırları, katlanan değişiklik satırları, öneri kartları** | Sohbet çalışırken tahta tek tek değişir | `lib/chatStatus.ts` adımları; `ChatFold.tsx`; `ChatOffers.tsx` (en çok 3 kompakt kart + Ekle); `ev-fold` `st-in .2 s`; ağırlıklı işlev (`a47585f`, `b88ffeb`, `847204c`, `f327c49`) | `ev-fold-list`/chevron kapalı | `Chat.tsx`, `ChatFold.tsx`, `ChatOffers.tsx`, `lib/chatStatus.ts` | CANLI | — |
| S40 | **Ana ekrandan gelen satır** (`pending`) "Porto'da bir otel daha" bu gezinin sohbetine yazılmış gibi gider | Ana ekran kutusu bir geziyi hedefleyince | Davranış | — | `Chat.tsx:32-34,133` | CANLI | — |
| S41 | **Link/dosya bırakınca çip, çerçeve, toast** | Sohbete sürükle-bırak | K19 sınıfları | var | `arrive/ArriveViews.tsx` | CANLI | — |

---

## 7. Kodda var ama hiçbir çizimde yok (kaynak kayıp ya da çizilmemiş)

`docs/mockups/hareket` olmadığı için aşağıdakilerin tasarım kaydı yalnız commit mesajı ve kod yorumudur (`d6d524f` "Motion language", `4abf7ed`, `886cf0e`, `210afed`, `386a0b4`, `c305557`).

| # | Hareket | Kod | Not |
|---|---|---|---|
| C1 | Beş süre / üç eğri belirteçleri | `app.css:4311-4314` | tasarım kaynağı kayıp |
| C2 | Sekme çizgisi (`mv-tab`) ve görünüm fade (`mv-fade`) | `app.css:4333-4334` | — |
| C3 | Pencere/çekmece **çıkış kopyası** (`exitMotion`) | `exitMotion.ts`, `app.css:4344-4346` | testi yok; çizimlerde yalnız scrim çıkışı var |
| C4 | Bölüm açılışı `mv-unfold` + ok dönüşü | `Section.tsx:44-48,99` | çizimde farklı (K18) |
| C5 | Kart fotoğrafı → hero (`withTripPhoto`) ve geri | `viewTransition.ts:36-68` | — |
| C6 | Düşünme satırı üç noktası, maskot `oops`/`sleepy`/`zz`, `ms-breathe` | `app.css:4326-4330,4352-4357,4393-4398` | — |
| C7 | Kart fotoğrafı bulanıklıktan çıkış (`mv-blur-up`) | `app.css:4327,4358` | — |
| C8 | "N kayıt işleniyor…" hapı, boş ekran yükselişi, hata girişi, anahtar sarsıntısı, bağlantı şeridi, sohbet bandı | `app.css:4359-4389` | — |
| C9 | "Plana koy" uçuşu | `putFly.ts` | roadmap/spec'te yalnız "bekleyen iş" olarak (`plan-v30-design.md:268`) |
| C10 | Işık süpürmesi (`mv-sweep`) bekleyen link satırında | `app.css:4364-4366` | `4abf7ed` |
| C11 | `pk-undo` halkası | `UndoToast.tsx`, `app.css:4237-4241` | ux-katmanli'da çizili (K21) |
| C12 | `hm-pop` profil menüsü, `hm-rise` ana ekran girişi, `.st-go/.st-start` hover | `app.css:2763,2818-2822,2793,2799` | giris-akisi'nda hareketsiz |
| C13 | `.vcard:hover .pic` −3 px (.5 sn), gezi kartı `st-draft` hover | `app.css:3796-3797,3815` | — |
| C14 | `Mascot` `wink` durumu (ölü), `FlightMap` rev-3 haritası (ölü), `--t-instant` (kullanılmıyor) | §2 A16, §6 S33, §1.2 | temizlenebilir |
| C15 | `exitMotion`/`putFly`/`viewTransition` kurulum çağrıları | `main.tsx:14-16` | — |

---

## 8. Mockup'ta var ama kodda olmayanlar

| # | Hareket | Mockup (dosya:satır) | Not |
|---|---|---|---|
| M1 | K29 aşama geçişi: uçak silüeti kalkış (`takeoff 1.1s`), çizim düşer (`drop .7s`), etiket zıplar (`pop`), `glow 1.6s`; "Hareketi duraklat" | `plan-v30/index.html:621-628,1665`; `docs/urun-yol-haritasi.md:154-155` | §3 K12 |
| M2 | "İndi" (`landed`) ve v33 Omurga → Aranıyor → Sonuçlar akışı | `plan-v39-bilet/index.html:1006-1007,2985-2997` (wip); fark listesi SORU 10 | K13, K14 |
| M3 | `rt-fly` (uçağın karta süzülmesi), `lvp` (canlı nokta) | `plan-v30/index.html:1246-1248,1494-1497` | K16, K17 |
| M4 | Bölümlerin kaydırınca yükselmesi (`.reveal .sec`, 0,7 sn) | `plan-v30/index.html:1070-1073` | A19 |
| M5 | Kart çevirme yerinde biner (`.backov`, `placeBack`) | `plan-v39-bilet/index.html:1644` (wip) | K9 |
| M6 | × katlama satırının girişi (`fold rise .3s`) | `plan-v30/index.html:1508` | K11 |
| M7 | "Yeni" parlama + etiket (4,4 sn) | `2026-10-08-ilk-ekran-v1.html:233-244` | K5 |
| M8 | Pano açılışı "iskelet önce, kartlar tık tık" | `giris-akisi-v1/index.html:404-450` | P8 |
| M9 | "Kart iner" / "Sayı yukarı kayar" / `press` | `giris-akisi-v2/index.html:220,507-508` | S10, S11, S16 |
| M10 | Yer tutucu cümlelerin dönmesi | `giris-akisi-v2/index.html:143-152` | W16 |
| M11 | Açılış ipucu yazıları | `acilis-v2/index.html:143-144,312-313` | A17 |
| M12 | Sohbet mesajı girişi (`rise .45 s`) | `plan-v30/index.html:115-116` | S37 |
| M13 | Toast girişi (`translateY(20px)`, .35 sn); kodda `.pk-undo` girişi animasyonsuz | `plan-v30/index.html:720` | — |
| M14 | ⓘ balonu, Pano "Neden?" yükseklik açılışı, kalp zıplaması | `plan-v39-bilet/index.html:664,686-688` (wip) | K25, P9, K26 |
| M15 | "Hareketi duraklat" / "oynat" düğmesi (ürün özelliği olarak K29'da geçiyor) | `plan-v30/index.html:1665`, `urun-yol-haritasi.md:155` | H8 |
| M16 | Bölüm yükseklik animasyonu (`grid-template-rows`) | `plan-v30/index.html:249` | K18 |
| M17 | "Yazıyor…" aşaması | spec `2026-10-06-oneriler-ve-sohbetle-gezi-design.md:98` | S14 |
| M18 | "Yol gezisi · yakında" etiketi | `giris-akisi-v3/index.html:476` | S21 |

---

## 9. Test kapsamı (hareket ve sohbet)

| Alan | Test | Not |
|---|---|---|
| Sözlük saf kısımları (`countAt`, `dropsIn`) | `tests/motion.test.ts` | — |
| Sözlük e2e (yükselme −2 px, nabız, düşüş, mühür+parlama, sayaç) | `scripts/e2e.mjs:4937-5050` ("Part 5", hareket açık bağlam) | diğer bağlamlar `opening-off` ile çalışır (11-17, 34-45) |
| Sihirli açılış | `tests/opening.test.ts`, e2e Part 6 `5054-5135` | — |
| Plana koy | `tests/putFly.test.ts` (düğme metni, çip adı); uçuşun kendisi testsiz | — |
| View Transitions | `tests/viewTransition.test.ts` (yalnız "vazgeçilen geçiş reddi yutulur") | geçişin görseli testsiz |
| Düşünme satırı/maskot | `tests/thinking.test.ts`; e2e `4012-4031` | — |
| Başlatma haritası | `tests/startFlowV5.test.ts`, e2e `3169-3179` | — |
| **Testsiz** | `exitMotion`, `ch-flip`, `.sbar` animasyonu, `mv-*` girişleri, `hm-*` ana ekran, GenMap fotoğraf açılışının görseli | W4 en riskli (komşu bir hata `c305557` ile çıktı) |
