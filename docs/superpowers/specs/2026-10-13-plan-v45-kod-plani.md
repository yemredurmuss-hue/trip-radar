# Plan v30 → v46: tasarım değişikliklerini canlı koda taşıma planı (2026-10-13)

Salt okunur çıkarım; kod değişmedi. Canlı: `plan-v30-fix` @ 0.36.84. Tasarım: `origin/plan-v30-wip` içinde `docs/mockups/plan-v31-oneri … plan-v44-akis`, `plan-v45-durak`, `plan-v46-sira`.
**Emre v46'yı ONAYLADI: FINAL hedef v46** (c61f380). Plan v46'ya göre yazıldı; v45'te denenip v46'da değişen yerler "v46 geçerli" diye §1.2'de ayrıldı. Yeni bir sürüm çıkarsa §1.3 komutları kalır. Dosya adındaki "v45" eski hedeftir, ad değişmedi.
**Eşlik eden belge:** `docs/superpowers/specs/2026-10-13-plan-v46-izlenebilirlik.md` (410 karar + hareket satırı + v46 mockup bileşenleri, her biri bir faza/pakete ya da "YAPILMIYOR + gerekçe" / "zaten canlı" / "KAPSAM AÇIĞI").

Önceki belgeler: `docs/superpowers/specs/2026-10-13-plan-v37-fark-listesi.md` (v31–v37 kod eşlemesi, hâlâ geçerli; A/B/C/D/E/F numaraları buradan atıf alır), `docs/envanter/01-kararlar.md`, `02-hareket-ve-sohbet.md`, `03-gorsel-envanter.md`, `docs/envanter/tasarim-envanteri.html` §1.

> **Hedef donduruldu (v46 onaylı): bütün fazlar başlanabilir.** Bağımlılık sırası §7'dedir; F0, F1, F8, F9a **hiçbir mockup ekranına bağlı olmadığı için** hemen başlar ve paralel gider (ŞİMDİ).
> Bitiş kapısı: **F10 bağımsız denetim** (v46 her ekranı ↔ canlı; izlenebilirlik tablosu doğrulanır). Açık satır kalırsa yayın yok.

---

## 1. Hedef sürüm ve nasıl güncellenir

### 1.1 Hedef
Canlı = v30; hedef = v46 (onaylı, final). Yapılacak iş v30→v46'nın tamamıdır.

### 1.2 v38 → v46 farkları (madde madde) ve geçersiz kılınan kararlar

| Sürüm | Yeni | Eski kararı geçersiz kılıyor mu? |
|---|---|---|
| v38 | Uçuş biletinde boş daire yok; koçanda aşama etiketi + kişi başı fiyat + "Rezerve et"; alınınca büyük yeşil tik | **v37 C2 (46 px durum dairesi) geçersiz** |
| v39 | Bilet her aşamada gerçek bilet: düz çerçeve, yalnız koparma çizgisi kesikli, çentikler; küçük aşama etiketi (yazı); başlık her kartta logo + (havayolu / yön · tarih) iki satır, ⓘ sağ üstte; tahmin kapsülsüz tek satır; rezervede yolcu sayısı tekrarlanmaz; seçili otel dahil **kesikli çizgi hiçbir kartta yok**; isimler hiç kesilmez (360–1440) | **v36/v37 "kesikli mor taslak, kesikli yeşil Seçildi" geçersiz** (düz çerçeve). v30 spec Değişmez 3 ("Seçildi: açık yeşil, **kesikli**") geçersiz. Koçandaki "Bilet alınmadı · N gün" kalktı; yerine alt satırda amber "Uçuşa N gün" (**uyarı korunur**, tam metin için bkz. §2.2) |
| v40 | **Tek "satın alındı" rozeti her yerde** (koyu yeşil `#17723f` kapsül `.okt` + beyaz tik: bilet, otel, ulaşım, etkinlik, gün görünümü); koçan tiki küçüldü, ince halka; alınmış kartta damga (`.stamp`) ve alt satırdaki "Rezerve/Bilet alındı" tekrarı kalktı; "planda" işareti açık yeşil çerçeveli tik; belge yoksa minik amber "belge yok"; ulaşım adı kesilmez. **Etkinlik: şehir şehir tek sıra** (şehir başlığı, kart = foto + ad + site + kişi başı fiyat; sıralama: gezinin sebebi, alınmış, planda, öneri; boş şehirde "AI'a arat"); başlıkta "0 bilet alındı" yazmaz | v30 "Rezerve: damgalı" **geçersiz**; v30 "Etkinlik tek ızgara" **geçersiz** (şehre göre satır); canlı `pk-lab` "Rezerve" yazısı **geçersiz** (rozet) |
| v41 | **Yeşil zemin yalnız alınmışta**; seçilmiş ve önerilmiş beyaz. Etkinlik kartında "Önerimiz" etiketi ve ayrı site çipi kalktı: kimin bulduğu köşede minik yüz, site adı düğmenin içinde ("Viator ↗"). **Uçuş seçenekleri Skyscanner satırı** (havayolu \| kalkış —süre · aktarma— varış \| fiyat + düğme); Pano uçuş satırı üstte tek satır şerit (rozet + ilk artı + uyum puanı) | v37 E3 karo uçuşta **geçersiz**; v30 "Seçildi zemini açık yeşil" **geçersiz** (beyaz) |
| v42 | Uçuş seçeneği satır yerine **derli toplu kart** (arka yüzde en çok 3 yan yana, Pano'da diğer kartlarla aynı genişlik, şerit her kartta: ilk artı yoksa ilk eksi amber). Arama şeritleri ("Kendin ara", "AI'a arat") grubun altında ince şerit. **Ulaşım kartı soldan sağa**: nereden (saat · durak) —araç, süre— nereye; hover'da hiçbir şey kaymaz; tekrar eden durak adı atılır; belirsiz kart aynı düzende, ortada kesikli yol, küçük mod kutucukları; `×` hover'da köşede | v37 ulaşım kartı **geçersiz**; v41 uçuş satırı **geçersiz** (kart); v37 E2 grup yapısı geçerli |
| v43 | **Ulaşım başlığı yine okla** ("Hakone → Kyoto"), hemen altında ne zaman (tarih · saat kapsülü + araç); ortadaki çizim kutusuz, iki yanında yol çizgisi; **Yolculuk sırasıyla**: sıra başına tek mini kart (tarih solda, kesikli yol, şehir başlıkları, aynı rozet), mini karta basınca kategori görünümünde asıl karta gider | v42 ulaşım başlığı (araç ikon+ad) **geçersiz**; v30 Yolculuk (asıl kartlar sağda) **geçersiz** |
| v44 | **Yolculuk görünümü tek sütun, minik kart sütunu noktalı yol üstünde**: her adım asıl kartın küçük hâli ortada (mini bilet koçanlı, mini ulaşım, otel/etkinlik görselli), kartın alt ortasından bir sonrakine noktalı çizgi; **gün değişince yolda koyu tarih kapsülü**; şehir değişince şehir başlığı; sonda "✓ Eve dönüş" | v43 satır düzeni (tarih solda) **geçersiz** |
| v45 | Yolculuk "yol ve duraklar": şehir = bir **durak bloğu** (`.jc`, başlık şehir+tarih; içinde otele giriş "Giriş X · Çıkış Y", etkinlikler yan yana **kare kartlar** 140 px, yapılacak/restoran **minik kareler**); ulaşım = yolun üstünde **planın ulaşım kartı** (alt satırsız); yol "Yola çıkış" (koyu hap) ile başlar, "Eve dönüş" ile biter; bilet başlığında tarih | v44 gün kapsülü (`.jf-day`) **geçersiz** (tarih kartların içinde) |
| v46 | **Yolculuk tek sütun, her şey sırayla alt alta**: Yola çıkış → uçuş → ulaşım → ince şehir başlığı → otel (Giriş/Çıkış) → **her etkinlik kendi kartı** (tarih kapsülü ya da "gün seç") → "Yapılacaklar ve restoranlar" kutusunda minik kareler → sonraki ulaşım … Eve dönüş. Kart kalıpları planınkiyle aynı | **v45 durak bloğu (`.jc`) ve yan yana etkinlik kareleri geçersiz** (yalnız `jcStay` ve `jcPl` yeniden kullanılır); v44 gün kapsülü geri gelmedi |

**v46 geçerli (v45'te denenip değişenler):** Yolculuk = tek sütun alt alta (v45 durak bloğu YOK); etkinlik = kendi kartı (`jsEv`: görsel, "Etkinlik · gezinin sebebi" etiketi, ad, tarih kapsülü ya da "gün seç", site, kişi başı fiyat, köşe yüzü ya da rozet), v45 kare kart YOK; şehir = ince başlık (`.jf-city`: pin + ad + tarih·gece, iki yanda çizgi); otel = `jcStay` ("Giriş X · Çıkış Y"; tarihsizde "N gece"); yapılacak/restoran = tek kutu `jf-todo` içinde minik kareler (`jcPl`, restoran turuncu, gezilecek mavi); uçuş = mini bilet + başlıkta tarih (`jfFly` v45 değişikliği); ulaşım = planın ulaşım kartı alt satırsız (`jfMove` v45); başlangıç hapı "Yola çıkış · {şehir}" koyu, bitiş "Eve dönüş · {şehir}" yeşil. **v44 `jf-day` gün kapsülü kullanılmaz** (v46 çağırmaz). v46'nın yeni keyframe'i yok (§4).

**Hâlâ geçerli (v37 fark listesinden):** A1 taslak "Önerimiz" (düz çerçeveli, v39), A2 beşinci durum, A3 köşe yüzü (etkinlikte v41 ile pekişti), A4 "Değiştir N", B1 sade otel, B3 ⓘ, C1 yatay bilet (C2 dairesi geçersiz), C3 kişi başı fiyat, D1 niyet etiketi, E1–E5 arka yüz (E3 uçuşta karo yerine kart), F1–F3 Pano. v39 bileti **hâlâ geçerli**; v40–v44 üstüne ekler.

**Mockup'ın kendi iç tutarsızlıkları (v46'da da duruyor):** (a) Ayarlandı: v40 `okFix` "Ayarlandı", v42/v43 `mvTicket` "Hallettim" yazar, ikisi de koyu yeşil rozet ve yeşil zemin; (b) Arıyoruz: v39 "kesikli yok" ama v43/v44 Yolculuk mini kartlarında Arıyoruz kesikli; (c) "Bilet al ↗" (ulaşım) ↔ "Rezerve et ↗" (bilet, otel) ↔ site adı (etkinlik). Kararlar §2.

### 1.3 Yeni bir sürüm (v47+) çıkarsa güncelleme komutları (v46 final; yöntem kayıt için)

```bash
git fetch origin
git ls-tree -r --name-only origin/plan-v30-wip docs/mockups | grep -E 'plan-v4[5-9]' | grep index.html   # yeni dizin adlarını bul
git log origin/plan-v30-wip --format='--- %h %s%n%b' 45b5221..origin/plan-v30-wip                          # Emre'nin kararları (commit gövdeleri)
S=$(mktemp -d)                                                                                              # herhangi bir geçici klasör
git show origin/plan-v30-wip:docs/mockups/plan-v44-akis/index.html > $S/v44.html
git show origin/plan-v30-wip:docs/mockups/plan-v45-durak/index.html > $S/v45.html
git show origin/plan-v30-wip:docs/mockups/plan-v46-sira/index.html > $S/v46.html
diff $S/v44.html $S/v45.html | cut -c1-360      # v45 farkı (base64 görsel satırları çok uzun: cut şart)
diff $S/v45.html $S/v46.html | cut -c1-360      # v46 farkı
diff $S/v44.html $S/v46.html | cut -c1-360      # v44'e göre toplam fark (bu planın tabanı)
grep -o '@keyframes [a-zA-Z0-9_-]*' $S/v46.html | sort -u   # yeni hareket var mı (v44: bob drop fadein flipin glow landed lvp newlink pop rise rt-fly shimmer slidein spin takeoff travel)
```

v46 farkı bu belgeye **işlendi** (§1.2). Yöntem aynı kalır: (1) §1.2 tablosuna yeni sürüm satırı ekle; (2) belgedeki `[v46]` işaretli maddeleri tara, her biri için "değişti / aynı" yaz; (3) §2'de "mockup'a göre" kapatılan satırlardan etkilenenleri güncelle; (4) §3'te etkilenen fazın "mockup'tan farkı" listesini yeniden üret; (5) §7 iş paketlerinde ilgili paketi "yeniden aç" işaretle. v45/v46'nın yalnız renk/boşluk değiştirdiği yerler ilgili fazda "ince ayar" paketi olur (yeni faz açılmaz). Yeni bir ekran/kart çıkarsa yeni faz numarası (F10…) açılır, mevcutlar kaymaz.

---

## 2. Açık sorulara varsayılanlar, çelişkiler, DOKUNULMAZLAR

Ölçüt: mockup cevaplıyorsa mockup; cevaplamıyorsa `tasarim-envanteri.html` §1-B'deki Önerim. Karar kodda uygulanacak şeydir; Emre itiraz ederse tek satır değişir.

### 2.1 17 soru (S1–S17)

| # | Soru | Karar | Dayanak |
|---|---|---|---|
| S1 | Taslak nasıl kabul edilir? | Kartta "Bunu seç" çizilmemiş; kabul yolları: (a) arka yüzde "Seç", (b) "Rezerve et ↗"e basınca önce `chooseItem` (Seçildi) sonra bağlantı açılır, (c) taslakta koçanda küçük "✓ Bunu seç" metin düğmesi (Seçildi'ye çevirir) | Mockup yalnız "Rezerve et ↗" gösterir (v39 `t3-buy`), otomatik Seçildi'yi söylemez; Önerim "✓ Bunu seç" + otomatik Seçildi. Birleşik |
| S2 | Taslak kalıcı mı, bütçeye girer mi? | **Yalnız görünüm** (yazılmaz). Seçene kadar "karar bekliyor": bütçe/%hazır/halka seçilmiş saymaz; hero'nun "tahmini toplam"ı zaten "önde gelen seçeneği" sayar (`TripFacts.tsx:193`), değişmez. Bölüm başlığı "2 önerimiz · 1 seçildi · 1 aranıyor" | Mockup bölüm başlığında ayrı sayar (v36–v39); Önerim yalnız görünüm |
| S3 | Taslak hangi kartlara? | **Uçuş ve otel**, tek gerçek fiyatlı seçenek yeter, yalnız kaynaktan/kayıttan; en uygun = `decision.winner`, yoksa `byRank[0]`. Ulaşım (tren), eSIM, sigorta: hayır | Mockup yalnız uçuş+otel çizer; Önerim aynı; K3 |
| S4 | PNR ne zaman? | **Yalnız uçuş günü** (`showBookingRef`, `PNR_DAYS=0`). ⓘ balonu "Rezervasyon kodu" satırını aynı kuralla gizler | Mockup cevaplamıyor; v30 kuralı (dokunulmaz) |
| S5 | "Bileti al" mı "Rezerve et" mi; ••• ve ×? | Uçuş ve otel: **"Rezerve et ↗"** (bilet koçanında); ulaşım (tren, otobüs, feribot): "Bilet al ↗"; etkinlik: **site adı ↗**; eSIM/sigorta "Satın al ↗". ••• ve × **silinmez**: ••• üst köşede kalır, × hover'da köşede (ulaşımda −9 px dış köşe), dokunmatikte × yok, ••• menüsünde "Gerek yok" kalır | Mockup: v39 koçan "Rezerve et ↗", v42 ulaşım "Bilet al ↗", v41 etkinlik site adı, `.mvt-x`; ••• mockup'ta yok → Önerim |
| S6 | Arka yüz alttaki kartları örtüyor | Yerinde biner (mutlak, satır genişliği, `z-index`); **son satırda yukarı doğru**; **dar ekranda (tek sütun) akışta kalır** (örtme yok, tam genişlik, aşağıyı iter); örtülenler arka yüz açıkken `inert`; Esc ve boşa basış kapatır | Mockup `.backov` (v39) geniş ekranı çözer; kalanı Önerim |
| S7 | Karoda hangi ekler kalır? | Seçenek kartında yalnız: kim kaydetti yüzü, etiket (Seçili/Kartta/Yeni), ad, bacak(lar), kişi başı fiyat, "Seç"; **uyum puanı** küçük kalır (mockup Pano şeridi gibi). "Neden?", ✓✕ ihtiyaç, Karşılaştır, ‹ ›, "Tarihlerle aç", "Tüm detaylar", "Senin için", "Seçmeden kontrol et" → **ⓘ balonu ve Pano'ya**; klavye okları kalır | Mockup v42 uçuş kartı puan göstermez, Pano gösterir; kalanı Önerim |
| S8 | "AI'a arat" ne yapar? | Bu fazda **sohbete satır gönderir** (`env.ask`), kartta "Arıyoruz…" çubuğu görünür, yeni seçenek gelince kalkar (en çok 60 sn); yerinde arama ayrı iş (kapsam dışı) | Mockup yerinde arama çizer (görsel uyar); Önerim sohbet |
| S9 | "Aradığımız: direkt" ve tahmin | Uçuş için `wants` tercih listesinden (`useWants` uçuşa genişler); tahmin yalnız ≥3 gerçek teklif (`MIN_PRICED_OFFERS`), yoksa tahmin yazılmaz | Mockup elle yazar; Önerim; v30 Değişmez 6 |
| S10 | Omurga→Aranıyor→Sonuçlar ürün mü? | **Hayır, çizim aracı.** "Aranıyor" durumu (etiket + shimmer çubuğu) AI arama sürerken gösterilir | Mockup v39+ akış şeridi taşır; Önerim |
| S11 | Pano'da taslak ne yazar? | Şeritte "Önerimiz" etiketi, düğme "Plan'da gör →", altyazı "Önerimiz · kartta" ("Planda" **yazılmaz**) | Mockup `on` olanı (auto dahil) "Planda" yazar; Önerim kazanır: Planda seçildi izlenimi verir |
| S12 | Kişi başı = toplam/2 mi? | **Hayır**: `item.guests.adults`, yoksa gezideki kişi sayısı; fiyat `price.scope` | Mockup `s.people.length` kullanır; Önerim |
| S13 | Niyet etiketi kamp/tarihsiz | Tarih yoksa "Kyoto · 5 gece"; kamp "Kamp · Ozora"; ayrı konaklama "Kyoto · ayrı konaklama" | Mockup tarihsiz kipte "N gece" (v40 `s.dated`); kalanı Önerim |
| S14 | Rezerve uçuşta kişi başı mı? | **Evet**: kişi başı büyük, altta küçük "2 kişi · €1.960"; yolcu sayısı koçanda tekrar edilmez | Mockup v39 |
| S15 | "Kaydettikleriniz" kimdir | `who !== AI` (kişi, eklenti, Pano linki). "Yeni": son 48 saatte kaydedilmiş ve bu cihazda henüz görülmemiş (`localStorage trip-radar:seen:<tripId>`; veri modeli değişmez) | Mockup `bfr-tag.new`; olay tanımı Önerim |
| S16 | Etiket birliği | Kart: **Seçildi**. Taslak: **Önerimiz**. Karo: **Seçili** / **Kartta** (taslak) / **Yeni**. "AI önerisi" kalkar. EN: Chosen · Our pick · Selected · On card · New | Mockup v41 karo etiketleri; Önerim |
| S17 | Uçuşta "Tüm detaylar" nereden | Kart gövdesi arka yüzü açar; alt satırdaki **ⓘ** ayrıntı balonu; "Tüm detaylar" ⓘ içinde bağlantı ve arka yüz kartında; rezervede "Ayrıntı ›" BookingSheet'i açar | Mockup (rezerve "Ayrıntı ›"); Önerim |

### 2.2 Çelişkiler

| Konu | Karar | Dayanak |
|---|---|---|
| **Seçildi rengi** | Seçildi = **beyaz zemin, açık yeşil (`--plan-line #8fcca5`) düz çerçeve**, kesikli yok. Önerimiz = beyaz zemin, mor-gri ince düz çerçeve (accent %38). Yeşil zemin + koyu yeşil çerçeve **yalnız Rezerve**. Arıyoruz = hafif gri çerçeve, boş. Canlıdaki krem/amber (`#fbf6ea`, `#e9d29a`) kalkar | Mockup v39 + v41 (cevaplıyor). DESIGN.md amber kuralı geçersiz (F9) |
| **Aşama adları** | Tek sözlük `lib/stageWords.ts` (yeni, F0): kart ve sayım **aynı**: Arıyoruz · Önerimiz · Seçildi · Rezerve (uçuş/ulaşım/etkinlikte rozet "Bilet alındı", konaklama/kiralıkta "Rezerve") · Ayarlandı. `lifecycle.ts` içsel `Stage` adları kod adı olarak kalır; kullanıcıya görünen metin sözlükten: Aranacak→Arıyoruz, Seçenekler→"N seçenek", Planlandı→Seçildi, Rezerve edildi/Hazır→Rezerve | Mockup tüm ekranlarda aynı beşli |
| **Ayarlandı rozeti** | Mockup rozet biçimini ve yeşil zemini paylaştırır ama sözcüğü tutarsız. Karar: sözcük canlıdaki **"Ayarlandı"**, rozet aynı kapsül biçimi, dolgu `--okb-set` (varsayılan **gri `#6b665f`**, v30 "Ayarlandı: gri" korunur; yeşil istenirse tek değişken) | Mockup kısmen; Emre'ye tek onay (§6.1) |
| **6 hareket süresi** | §4(a): parlama, nabız, yükselme, düşüş çizime; mühür çizim süre/eğri + dönme kalsın; sayaç aynı | Envanter C "Önerim" |
| Havalimanı süresi | Emre 07 Ekim kararı (yurt dışı en az 2 sa); akilli-saat spec'i güncellenir (F9) | 01-kararlar Ek A5 |
| PDF/Paylaş hero | v30: ••• menüde kalır, hero'dan kalkar (**kapsam dışı**, ayrı küçük iş) | Önerim |
| "Plana koy"/"Plana ekle" | Tek fiil **"Plana koy"** (EN "Add to plan"); `putFly.isPutButton` ikisini de tanımaya devam eder | Önerim; mockup v41+ "Plana koy" |
| Arıyoruz kesikli mi | Bilet/ulaşım/otel kartlarında düz hafif gri (v39); Yolculuk mini kartında kesikli (v43–v46); boş etkinlik/yapılacak kartları kesikli (canlı) | Mockup'ın kendi ikiliği olduğu gibi |
| "Bilet alınmadı" uyarısı | Uçuşa ≤14 gün kala amber **"Uçuşa N gün · bilet alınmadı"** (mockup yalnız "Uçuşa N gün" yazar; kısaltma uyarıyı zayıflatır) | UX ek kuralı |
| Etkinlik "Planda/Öneriler" ayrımı, Gizlenenler, bölüm altı "+ Ekle", PDF, Gün gün haritası | Canlıda olup çizimde olmayanlar **korunur** | Envanter "Bilinçli sapmalar" |

### 2.3 DOKUNULMAZ liste (hiçbir faz bozamaz)

1. UX ek: **fiyat, saat ve gerçek uyarılar hiçbir zaman gizlenmez**; yalnız hatırlatma ve numaralar zamanını bekler.
2. **Uydurma veri yok** (K3/K3b): fiyat, saat, süre, fotoğraf, tahmin yalnız kayıt/hesap/kaynaktan; tahmini aralık ≥3 gerçek teklif; Yolculuk'ta tarihsiz etkinlik "gün seç" der; taslak yalnız gerçek seçenekle; mockup'taki örnek veri (Kyoto vb., sabit "2 kişi") kodda taşınmaz.
3. **Bölüm sırası sabit**: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Yapılacaklar ve restoranlar · Belgeler ve internet · Hazırlık · İlham. Gezi türü bölüm eklemez/yeniden adlandırmaz; şablon sabit, yalnız içerik değişir.
4. **Rötar/canlı uçuş verisi** (`FlightTiles`, `flightAlert`, `ticketDiff`, `delayShiftNote`, kırmızı saat, kapı değişti) yeni bilette de görünür; **PNR yalnız uçuş günü**.
5. **••• menüsü, × (katlama + "Gerek yok / Ben hallettim / Geri al"), ✓ Aldım, Kimin için? (kişiye özel bilet), Ayarlandı uçuşu** yeni kartlarda yer bulur (S5).
6. Tarihe bağlı uyarılar: "⏳ iptal bugün biter", son 14 gün bilet, "İade yok", `dateAlert`.
7. Durum **asla yalnız renkle**: rozet/etiket yazısı hep var.
8. Arka yüzde uyum puanı, "Neden?", ihtiyaç ✓✕, "Senin için", "Seçmeden kontrol et", Karşılaştır, klavye okları silinmez, yeniden konumlanır (S7).
9. Silme onay sormaz, 8 sn "Geri al" (rezervasyon silme sorar); gezi silme çöp kutusu.
10. Her yeni metin `L("tr","en")` çifti; Türkçe arayüzde em-dash yok (" · " veya ": "); `tests/i18n-content.test.ts`, `english.test.ts`.
11. Renkler: yeşil rezerve, kırmızı risk, gri yazı `#6b665f`; kategori renkleri yalnız tür.
12. Reduced-motion: hareket gider, renk değişimi kalır; hareket yalnız `opacity/transform/box-shadow` (yerleşimi kaydıran yükseklik animasyonu yok; tek istisna Pano "Neden?", §4 #8).
13. Korunur: bağlantı yapıştırınca bekleyen kart/ışık, Geri al halkası, sihirli açılış B, View Transitions, `putFly`.
14. Paylaşılan gezide oylar/kalp = Süper; kişiye özel rezervasyon.

---

## 3. KOD PLANI (fazlar)

Her faz ayrı commit(ler)dir; çıkışında: `npx tsc -p .` temiz, `npx vitest run` yeşil, ilgili e2e bölümü yeşil, "mockup'tan farkı" kontrol listesi (1440 + 390 + EN) doldurulmuş. Entegrasyon dalı: `plan-v46-kod` (plan-v30-fix'ten). Sürüm: F0–F1 → 0.36.85; F2–F7 → 0.37.0 (ya da faz faz patch); F8 → 0.37.1. Kısaltmalar: `CSS` = `static/app.css`, `TP` = `src/app/TripPanel.tsx`. Zorluk: S ≤ ½ gün · M 1–2 gün · L 3+ gün (test dahil değil).

### 3.0 Yeniden kullanım ilkesi ("gereksiz kod yok")

Yeni bileşen yalnız mockup'ta **en az iki yerde** kullanılıyorsa ve canlıda karşılığı yoksa yazılır. Kullanılacak **mevcut** parçalar: `WhoAvatar`/`WhoseBadge` (köşe yüzü, karo yüzü, mini kart yüzü), `HoverTip`/`TipOn` + `Peek.tsx` (ⓘ balonu; yeni yalnız tetikleyici düğme), `lib/cardTicket.ts ticketPrices` (kişi başı fiyat: bilet, seçenek kartı ve Pano hep bunu çağırır), `lib/estRange.ts estimatedRange`, `cardKind`/`cardView` (`transportFace`, `mediaFace`, `topDate`; "+1" bayrağı cardView.ts:158–186'daki mevcut hesap), `DocAccess`/`BookingSheet`/`DocPickButton` (belge çipi, "belge yok"), `SearchRow`/`lib/searchLinks.ts` (Kendin ara), `AskButton` (AI'a arat), `useStageMenu`/`CardMenu`/`FoldLine`/`DeleteX` (menü, ×), `dropsIn`/`useJustChanged`/`useJustBecame`/`useCountUp` (hareket), `FallbackImg`, `KindIcon`/`UiIcon`/`TransportArt` (ikonlar), `lib/storyDates.dateBox`, `timeline.board` ve `hereItems` (Yolculuk), `Progress.show` (karta git + parla), `putFly`, `useAppear`, `opening.ts` işaretleri (`data-pit`), `lib/offerSource.ts` `Offer` alanları (seçenek kartı için ek alan yok). **Tek tanım kuralı:** aynı görünüm iki yerde yazılmaz: bilet/ulaşım/otel kartlarının Yolculuk mini kartı ayrı bileşen değil aynı bileşenin `compact` prop'udur; `BookedBadge`, `InfoButton` tek yerde. Bir faz eski bir bileşenin yerini alırsa eski bileşeni **aynı fazda silmez** (silme önerisi F9'da listelenir ve ayrıca onaylanır); ama yeni kodun eski kodu kopyalaması yasaktır.

### F0 · Temel — **ŞİMDİ BAŞLANABİLİR** (v46'dan bağımsız) · M

**Kapsam.** Durum sözlüğü, tek Seçildi/Önerimiz/Rezerve görsel dili, tek "satın alındı" rozeti, tasarım belirteçleri.
**Dosyalar.**
- Yeni `src/lib/stageWords.ts`: `Look = "search"|"draft"|"chosen"|"booked"|"arranged"`, `lookOf(...)`, `lookWord(look, {kind})`; saf ve testli. `src/lib/lifecycle.ts` `stageLabel` buradan okur. Metin kaynakları sözlüğe bağlanır: `src/lib/cardView.ts` (`ringOf`, `groundOf`, `footOf` ~80–96, ~372), `src/lib/cardFacts.ts:264`, `src/lib/items.ts:388`, `src/lib/legs.ts:273–274`, `src/lib/journey.ts:82`, `src/lib/categories.ts` (`stageLine` ~745, 416–425), `cards/CardShell.tsx` `Ring` etiketi.
- Yeni `src/app/cards/BookedBadge.tsx` (`<BookedBadge word size/>`: yeşil kapsül + tik). Bağlanacak yerler: `CardShell.tsx` (`pk-lab booked`, `Ring done` → rozet; `pk-stamp` kalkar), `PlanCard.tsx` (261 stamp, 275, 328–336 stub), `plan/ActivityBoard.tsx` (218 `ax-tag ok`, 309 `ac-proof`), `board/Pano.tsx` (113, 336, 440 `pn-rib`/`pn-tin`), `days/DayCards.tsx` (`dg-lab`), `plan/StoryView.tsx:88`, `ideas/IdeaTiles.tsx:204`, `plan/Section.tsx:164`, `board/OptionBoard.tsx:176,223`, `CompareView.tsx:188`.
- `plan/PlanOrder.tsx` `PlanKey`: beş örnek kutu (Arıyoruz · Önerimiz · Seçildi · Rezerve · Ayarlandı), düz çerçeve.
- `CSS`: `:root` + koyu tema belirteçleri `--okb #17723f` (koyu `#2b9d5f`), `--okb-ring`, `--okb-set #6b665f`, `--book-bg #e0f1e6`, `--book-line #3f9c66`, `--plan-bg #f5fbf7`, `--plan-line #8fcca5`, `--plan-ink #2b7a4b`, `--draft-line` (accent %38), `--lav #ece8ff`. Üç ayrı Seçildi tanımı (CSS ~2008, 3825, 3876) ve ActivityBoard `#86c9a0` kesikli tek kurala indirilir; zemin: chosen/draft beyaz, booked yeşil.
**Yeni i18n.** "Önerimiz/Our pick", "Ayarlandı/Arranged", "Seçildi/Chosen", "Arıyoruz/Searching", "Rezerve/Booked", "Bilet alındı/Ticket bought".
**Test.** Yeni `tests/stageWords.test.ts`; `tests/lifecycle.test.ts`, `cardView.test.ts`, `categories.test.ts`, `planStages.test.ts` metin güncellemesi. e2e (`scripts/e2e.mjs`): 497 (`.plan-key span` artık 5 öğe), 638 (`dg-lab` "Seçildi" kalır), `pk-ring` (5 yer), `pk-lab` (3), `pk-stamp` (1), `pk-seal` (2), "Planlandı"/"Seçildi · bilet alınmadı" yorum ve beklentileri (1344, 3299).
**Kabul.** Her yüzeyde tek rozet; amber Seçildi kalmadı; beyaz = seçilmiş/önerilmiş, yeşil zemin = yalnız alınmış; durum her yerde yazılı.
**Bağımlılık.** Yok. **Paralel.** F1 ve F8 ile paralel (aşağıdaki dosya notları); F2–F7 F0'dan sonra.
**Mockup'tan farkı.** 5 durumlu anahtar; bilet, otel, ulaşım, etkinlik, Gün gün, Pano'da aynı rozet; koyu tema rozeti.

### F1 · Küçük bağımsızlar — **ŞİMDİ BAŞLANABİLİR** · M (toplam)

- **F1a ⓘ balonu (B3).** Yeni `cards/InfoButton.tsx` (20 px, hover/odak/dokunma, 250 px balon, "etiket · değer"); `CardShell.tsx` `peek` slotu `info` ile birleşir; `Peek.tsx`/`FlightPeekBox` ona taşınır; `lib/cardPeek.ts` `flightPeek` genişler (Sefer · Kalkış · Varış(+1) · Süre · Aktarma · Bagaj · Kimden; PNR yalnız uçuş günü), yeni `stayPeek` (Semt · Puan·yorum · İptal · Not · Toplam · Kimden), `transferPeek` (Kalkış · Varış · Süre · Rezervasyon · Not · Kimden). CSS `.inf`, `.inf-pop`. Gerçek uyarılar kartta kalır.
- **F1b Niyet etiketi (D1).** `cards/MediaCard.tsx` görsel bandı sol üst; `CardDate.tsx`; `lib/cardView.ts topDate`; S13 kuralı.
- **F1c Köşe yüzü (A3).** `WhoseBadge.tsx` (`WhoAvatar`), `NeedCard.tsx adderOf`, `CardShell.tsx` köşe slotu −9 px; etkinlikte minik yüz.
- **F1d Pano ferah (F1–F3 fark listesi).** `board/Pano.tsx` (`PanoCard`, `PanoArt` → `ucus.png` iki şehir arası; kişi başı fiyat `ticketPrices`), CSS `.pn-strip` 296–316 px, `.pn-act` sarar, `.pn-whylist`; `align-items:start`. Uçuş şeridi/kartı (v41–v42) F2'de.
**i18n.** "Semt/Neighbourhood", "Kimden/From", "Bagaj/Baggage", "kişi başı/per person", "{n} kişi · {toplam}/{n} people · {total}", ⓘ `aria-label` "Ayrıntı/Details".
**Test.** `tests/cardPeek.test.ts` genişler (yeni alanlar, PNR kuralı, stay/transfer peek), `cardView.test.ts`, `pano.test.ts`; e2e `tipx-peek` (4 yer, kopyala balonu ⓘ'ye taşınır, 948 civarı; klavye ile açılır), `pn-card` (10 yer).
**Kabul.** ⓘ klavye+dokunma+fare ile; Pano 1440'ta sütun ≥296 px; niyet etiketi tüm Seçildi/Önerimiz/Rezerve otelde.
**Bağımlılık.** F0'a gevşek (rozet); F1a tamamen bağımsız ilk adım olabilir. **Paralel.** F1a/F1b/F1d ayrı worktree; F1c `CardShell`'i F1a ile paylaşır, F1a'dan sonra.

### F2 · Uçuş bileti + uçuş seçenek kartları [v46] · L

**Kapsam.** Yatay bilet (v39 düz çerçeve, çentik, koçan), aşama etiketi, kişi başı fiyat, "Rezerve et ↗", alınınca büyük tik + `BookedBadge`, boş bilet ("Aradığımız: direkt", kapsülsüz tahmin), durumlar Arıyoruz/Aranıyor/Önerimiz/Seçildi/Rezerve/Ayarlandı; **rötar/PNR/uyarılar korunur**; uçuş seçenek kartları (arka yüz 3 yan yana; Pano kartı + şerit).
**Dosyalar.** Yeni `cards/FlightTicket.tsx`; `PlanCard.tsx` transport dalı (285–294) ve stub (328–344) buna geçer; `TransportCard.tsx`, `RideCard.tsx` (`RouteArc` yerine `ucus.png`, aktarmada amber); `EmptyCard.tsx` `EmptyTravelCard` (361–396); `FlightLive.tsx`; `lib/cardTicket.ts` (`ticketPrices` + yeni `ticketStub`); `lib/estRange.ts` uçuş tahmini; `lib/emptyCards.ts` (wants); yeni `cards/FlightOption.tsx` (kart: havayolu · kalkış —süre/aktarma— varış · fiyat · Seç), kullanıcıları `NeedCard.tsx ChoiceSheet` (uçuş dalı) ve `board/Pano.tsx` (uçuş grubu: şerit rozet + ilk artı/eksi + uyum). CSS: `.pk-stub*` yerine `.tk-*` (bilet), `.fo-*` (seçenek), `.fx-*`; çentik `clip-path`; `container-type:inline-size` + `clamp(16px,6.4cqi,23px)`.
**i18n.** "Rezerve et ↗/Book ↗", "Aradığımız: direkt/We're looking for: direct", "tahmini · kişi başı/estimate · per person", "Uçuşa {n} gün · bilet alınmadı/{n} days to the flight · no ticket yet", "{n} aktarma · {yer}", "{n} kişi · {toplam}".
**Test.** `cardTicket.test.ts` (gerçek yolcu sayısı, `scope`), `estRange.test.ts` (<3 teklif → tahmin yok), `flightData.test.ts` (bilete taşınan notlar aynı çıktı), `emptyCards.test.ts`; yeni `tests/ticketStub.test.ts` (PNR yalnız uçuş günü, ≤14 gün amber metin, taslak/Seçildi/Rezerve koçan içeriği). e2e: `pk-stub` (3), "Bileti al" (5 yer → uçuşta "Rezerve et ↗"), `pk-aldim` (5; bilette ⓘ yanında kalır), `pk-alt` (5), rötar senaryosu (korunur, selektör güncellenir), `ch-back` uçuş (F4 ile).
**Kabul.** 360–1440 px isim kesilmez; rötar/kapı/PNR uçuş günü/Ayarlandı görünür; taslakta "Bunu seç" (F7 ile) çalışır; Pano uçuş kartları aynı boy.
**Bağımlılık.** F0, F1a. **Paralel.** F3, F6 ile paralel; F4 ile `NeedCard` ortak → sıralı.
**Mockup'tan farkı.** Bilet 6 durumda + boş + uzun şehir adı; arka yüz uçuş 3 kart; Pano uçuş şeridi. **[v46] v39'dan beri sabit; v46 değiştirirse en çok burası.**

### F3 · Sade otel kartı + "Değiştir N" [v46] · M

**Kapsam.** Görsel + marka + puan rozeti + ad + tek satır ("İade yok" yalnız varsa); alt satır `[Değiştir N] · €210 / gece · [Rezerve et ↗]`; Seçildi/Önerimiz beyaz, Rezerve yeşil + rozet; belge çipi / "belge yok"; toplam/iptal/yorum/semt/not ⓘ'de; tarihli uyarılar kartta kalır.
**Dosyalar.** `cards/MediaCard.tsx` `MediaCardBody` (stay), `cards/CardShell.tsx CardFoot` (`alt` → "Değiştir N" hap), `PlanCard.tsx` 298–326, `StayLine.tsx`, `lib/cardView.ts mediaFace`, `lib/cardTime.ts`; `NeedCard.tsx` stay "N seçenek" kartı (Arıyoruz) aynı dil; CSS `.ek-band`, `.ek-card`.
**i18n.** "Değiştir {n}/Change {n}", "belge yok/no document", "{n} gece/{n} nights".
**Test.** `cardView.test.ts`, `cardTime.test.ts`; e2e `pk-alt` ("Pano'da N alternatif" → "Değiştir N"), `ek-card` (24 yer), 390 px konaklama.
**Kabul.** Kart sabit boy; uyarılar görünür; Değiştir arka yüzü açar.
**Bağımlılık.** F0, F1a, F1b. **Paralel.** F2 ile ayrı worktree (`PlanCard.tsx`'te farklı bölgeler; birleştirme F3→F2).

### F4 · Arka yüz [v46] · L

**Kapsam.** E1 yerinde biner (S6), E2 iki bölüm (Kaydettikleriniz / Önerimiz; her biri ≤3 kart + eylem kutucuğu), E3 kart/karo (S7, S15, S16), E4 "Kendin ara", E5 "AI'a arat" (S8), E6 seçenekli Arıyoruz aynı arka yüz.
**Dosyalar.** `cards/NeedCard.tsx` (`ChoiceSheet` 198–470: `BACK_MAX=7` → 3+3, `mine/found`, `tile`), `PlanCard.tsx NavGroup` (`changing` kolu), `cards/OfferRow.tsx`, `cards/AskButton.tsx`, `cards/EmptyCard.tsx SearchRow`, `lib/searchLinks.ts`, yeni `cards/BackFace.tsx` (`ResizeObserver` konumlama), yeni `lib/backFace.ts` (bölümleme); CSS `.ch-back` (4557–4560), `.ch-grid`; `.cat-card:has(.ch-back){grid-column:1/-1}` kuralı kalkar.
**i18n.** "Kaydettikleriniz/What you saved", "Önerimiz/Our picks", "Kendin ara/Search yourself", "AI'a arat/Ask AI to search", "Kaynaklarda yeni seçenek bulur, buraya ekler/Looks for new options in the sources and adds them here", "Arıyoruz…/Searching…", "Pano'da aç · +{n}/Open on the Board · +{n}", "Henüz kayıt yok. Eklentiyle kaydettiğin buraya düşer./Nothing yet. What you save with the extension lands here.", "Sana uyan başka seçenek bulamadık./No other fitting option found.", "Seçili/Selected", "Kartta/On card", "Yeni/New".
**Test.** Yeni `tests/backFace.test.ts`; e2e `ch-back` (12 yer; "yan kart bir satır aşağı kayar" beklentileri tersine), `ch-tile` (1), "Daha fazla bul"/"Kendin ara" bağlantıları, klavye okları (korunur).
**Kabul.** Arka yüz açılınca kart yerinden oynamaz (1440); 390'da tek sütun ve iter; son satırda yukarı; Esc/boşa basış/× kapatır; örtülenler `inert`.
**Bağımlılık.** F0, F1c, F2, F3. **Paralel.** F5a, F6 ile paralel; F2/F3 ile `NeedCard`/`PlanCard` ortak → sıralı.
**Mockup'tan farkı.** Uçuş, otel, ulaşım arka yüzleri; boş bölümler; "Pano'da aç"; AI'a arat çalışırken. **[v46]**

### F5 · Transfer kartları + Yolculuk görünümü [v43–v46] · L

**F5a Ulaşım kartı (M).** Ok başlık "A → B"; altında kapsül "tarih · saat" + araç; soldan sağa [saat/durak —çizim, süre— saat/durak]; alt satır `[Değiştir N] fiyat Bilet al ↗` / rezervede belge + "Ayrıntı ›"; hover'da kayma yok; tekrar eden durak adı atılır; boş kart aynı düzende (kesikli yol, mod kutucukları); × hover köşede. Dosyalar: `cards/RideCard.tsx` (`RideCardBody`), `TransportCard.tsx`, `cards/LegCard.tsx`, `cards/EmptyCard.tsx EmptyLegCard` (462–552), `lib/cardView.ts transportFace`, `lib/cardKinds.ts legEndsByItem`; `static/illus/*.png` (var; `mix-blend-mode:multiply`, koyu temada normal).
**F5b Yolculuk görünümü (L) — v46.** Tek sütun, sırayla alt alta, kart kalıpları planınkiyle aynı: `Yola çıkış · {şehir}` koyu hap → (her adımın arasında noktalı `jf-link`, 26 px, `border-left:3px dotted`) uçuş (mini bilet, başlıkta tarih) → ulaşım (planın ulaşım kartı, alt satırsız) → ince şehir başlığı (pin + ad + "tarih · N gece", iki yanda çizgi) → otel (`Giriş X · Çıkış Y`; tarihsizde "N gece") → **her etkinlik kendi kartı** (tarih kapsülü ya da "gün seç"; "Etkinlik · gezinin sebebi") → tek kutuda "Yapılacaklar ve restoranlar" minik kareleri → sonraki ulaşım … → `Eve dönüş · {şehir}` yeşil hap. v44 gün kapsülü ve v45 durak bloğu/kare etkinlik **yapılmaz**. Dosyalar: `plan/StoryView.tsx` yeniden yazılır (iskelet: dizi üret + `jf-link` serpiştir); yeni `plan/JourneyCards.tsx` yalnız **gerçekten yeni** parçalar: `JourneyStay` (otel mini), `JourneyEvent`, `JourneyTodo` (+`JourneyPlace`); uçuş/ulaşım mini kartları **F2/F5a bileşenlerinin `compact` kipi** (yeni bileşen yazılmaz); `lib/storyDates.ts` (`dateBox` yeniden kullanılır; kapsül için `dayChip`), `lib/journey.ts`; veri kaynağı **aynı** (`timeline.board`, `hereItems`), ikinci kaynak yok; yapılacak/restoran = canlıdaki `hereItems` süzmesi (category `todo|food`, chosen/booked); mini karta basınca kategori görünümüne geçip asıl karta gider (`Progress.show` + `flash`); sihirli açılış işaretleri (`data-pit`) yeni sütuna. CSS `.sy-*` kalkar, `.jf-*`. Kaldırılan: `sy-ev` "Burada" listesi (yerini etkinlik kartları ve minik kareler alır).
**i18n.** "Eve dönüş · {şehir}/Back home · {city}", "Gün {n}/Day {n}", "gün seç/pick a day", "{n} etkinlik/{n} activities", "etkinlik yok/no activities", "{n} yapılacak/{n} to do".
**Test.** Yeni `tests/journeyFlow.test.ts` (gün kapsülü yalnız gün değişince, şehir başlığı, tarihsiz "gün seç", Gezi sebebi), `storyDates.test.ts`, `legCard.test.ts`; e2e Yolculuk bölümü yeniden yazılır (`.sy-*` selektörü yok), mini karta basınca kart parlar, boş transfer kartı tıklaması (238e9b0 testi).
**Kabul.** Her adım ≥1 mini kart; tarih uydurulmaz; tarihsiz gezide "Gün N"; boş şehir ve dönüş doğru.
**Bağımlılık.** F5a: F0, F1a. F5b: F2, F3, F5a, F6. **Paralel.** F5a F2/F3/F6 ile paralel.
**Mockup'tan farkı.** Yolculuk: Japonya (tarihli) ve Ozora (festival: kamp, araba al/bırak, gezinin sebebi, dinlenme), tarihsiz gezi, 390 px, boş şehir, tarihsiz etkinlik "gün seç". **[v46] final.**

### F6 · Etkinlikler şehre göre [v40–v41] · M

**Kapsam.** Şehir şehir tek sıra (kaydırmalı satır, scroll-snap, 4 kart sığar), şehir başlığı (ad, tarih/gece, "N planda · N bilet alındı · N öneri"), kart = görsel + köşe yüzü + ad + site·zaman + kişi başı fiyat + site adı düğmesi; alınmışta rozet + belge çipi/"belge yok" + "Ayrıntı ›"; sıralama: Gezinin sebebi, alınmış, planda, öneri; boş şehirde "AI'a arat". **Canlıdan korunur:** "Planda/Öneriler ve fikirler" ayrımı, canlı kaynak teklifleri (`useActivityOffers`/`OfferTile`), "Daha fazla fikir", "Festivalden sonra · dinlenme", kapalı tur notu, "Kendin ara" bağlantıları, etkinlikte "Bilet aldım".
**Dosyalar.** `plan/ActivityBoard.tsx` (ana iş; `ActivityCard`, `ActivityTile`, `OfferTile`, `SuggestTile` tek kart bileşenine), `lib/categories.ts` (şehir gruplama; `citiesOfPlan`, `catDomKey`), `cards/WhoseBadge.tsx`; CSS `.ax-*`, `.ac-*` → `.ev-*`; "Gezinin sebebi" kapsülü.
**i18n.** "{n} planda/{n} on the plan", "{n} bilet alındı/{n} tickets bought", "{n} öneri/{n} suggestions", "henüz etkinlik yok/no activities yet", "AI her şehir için buldu/AI found these for every city", "AI buldu · siz eklediniz/AI found · you added".
**Test.** `tests/actsV30.test.ts` (şehir gruplama, sıralama), e2e `ac-shelf`/`ax-grid` (2 yer), "Plana ekle"→"Plana koy", `putFly.test.ts`.
**Kabul.** Fiyat/saat görünür; 390'da yatay kaydırma; uzun ad kesilmez; sebep kartı önde.
**Bağımlılık.** F0, F1c. **Paralel.** Diğerleriyle tam paralel (`ActivityBoard` ayrı dosya).

### F7 · Taslak "Önerimiz" modeli [v46] · L — en riskli, en son

**Kapsam.** Elinde gerçek seçenek varsa uçuş ve otel ihtiyacı kartta hazır **Önerimiz taslağı** (düz mor-gri çerçeve, beyaz, "✨ Önerimiz"); S1 kabul yolları; sayım S2; bölüm başlığı "N önerimiz · N seçildi · N aranıyor"; Pano şeridi S11; Yolculuk mini kartı "Önerimiz"; hero/yapışkan şerit: taslak "karar bekliyor".
**Veri modeli değişmez** (yazmayan görünüm). Dosyalar: yeni `lib/draft.ts` (`draftOf(group, decision)`: yalnız `flight|stay`, gerçek fiyatlı, `decision.winner ?? byRank[0]`), `TP.tsx` ~1030–1065 (`NeedGroup` yerine taslak varsa `PlanCard draft`), `PlanCard.tsx` (`draft` kipi, "Bunu seç" → `chooseItem`), `lib/categories.ts stageLine`/`StageCounts` (türetilmiş `draft` sayacı), `lib/progress.ts`/`planList.ts`, `TripFacts.tsx`/`StickyBar.tsx` (taslak seçilmiş sayılmaz), `board/Pano.tsx`.
**i18n.** "✓ Bunu seç/✓ Pick this", "{n} önerimiz/{n} of our picks", "Önerimiz · kartta/Our pick · on the card".
**Test.** Yeni `tests/draft.test.ts` (kimlere gelir, 1 seçenek yeter, fiyatsız gelmez, kullanıcı seçince kalkar, dismissed olmaz, bütçe/%hazır **saymaz**, start'ın yer tutucusu taslak olmaz), `planStages.test.ts`, `progress.test.ts`; e2e: hero %, "Sıradaki", 3299 civarı yer tutucu beklentisi korunur.
**Kabul.** Seçenekli uçuş/otel ihtiyacında taslak görünür; veri yazılmadan seçince Seçildi; sayımlar S2.
**Bağımlılık.** F0, F2, F3, F4. **Paralel.** Yok (TP.tsx ve çekirdek sayım).

### F8 · HAREKET — **ŞİMDİ BAŞLANABİLİR** (v46'dan bağımsız; §4) · L (toplam)
Alt paketler: F8a sözlük değerleri, F8b reduced-motion + "Hareketi duraklat", F8d kalan 18 madde (uygulananlar), F8e `exitMotion` testi; **F8c aşama geçişi (K29) F2 sonrası** bilete oturur.

### F9 · Temizlik + dokümanlar · S–M — **KISMEN ŞİMDİ BAŞLANABİLİR**
- Şimdi: **ölü kod silme ÖNERİSİ (silmeden önce ayrı onay; grep ile doğrulandı):** `Mascot.tsx` `wink` durumu ve `ms-wink` CSS (hiçbir bileşen `state="wink"` vermiyor); `start/FlightMap.tsx` içinde yalnız **`WorldFlight` bileşeni** ve `st-map-*` CSS (~3001–3016) (dosyadaki `loadWorld`, `PLANE`, `WorldMap` StartChat, Generating, GenMap ve TripMap'te **kullanılıyor**, kalır); `--t-instant` (CSS ~4312, kullanılmıyor); `Stage="writing"` bayat yorumları `StartChat.tsx:8–9`), DESIGN.md, v30 spec bayat "Durum" bölümleri, yol haritası (K76+, "Plan taslağı"/"Yazıyor…" satırları "vazgeçildi", K4 paragrafı), akilli-saat spec'i.
- F2–F7 sonrası: `pk-stub*`, `pk-stamp`, `pk-lab`, `sy-*`, `ax-*`/`ac-*`, `nd-card` artıkları, `RouteArc` (kullanılmıyorsa), eski `ch-tile` CSS'i; envanter durumları.

### FB · Backend (supabase) — **varsayılan: değişmez**; tek isteğe bağlı ek · S

Tek tek inceleme sonucu §5.2'dedir. Zorunlu backend değişikliği **yoktur**. İsteğe bağlı tek ek: uçuş seçenek kartında "1 aktarma · {yer}" için SerpApi bacaklarından aktarma yeri (`serpFlights` zaten `legs` okuyor; `OfferOut.via` alanı vardır ve transferde kullanılıyor, uçuşta boş). Yapılırsa: `supabase/functions/offers/shape.ts` (`serpFlights` → `AviaFlight.via`, `flightOffer` → `via`), `src/lib/offerSources/index.ts` (alanı geçir), `tests/offersShape.test.ts` (aktarma yeri yalnız kaynak verdiyse; verilmezse `null`), dağıtım `supabase functions deploy offers --no-verify-jwt` (diğer fonksiyonlar gibi), SQL yok. Aviasales önbellek verisinde aktarma yeri **yoktur**: o zaman yalnız "1 aktarma" yazılır, yer uydurulmaz. Yapılmazsa hiçbir ekran bozulmaz (mockup'ın "Doha"sı örnek veridir). Karar: Emre onayına bağlı, F2'den bağımsız.

### F10 · BİTİŞ DENETİMİ (bağımsız ajan) · M — yayın kapısı

Kodlamayı yapmamış **bağımsız bir ajan** (yeni oturum, yalnız bu plan + izlenebilirlik tablosu + mockup + canlı build ile):
1. `docs/superpowers/specs/2026-10-13-plan-v46-izlenebilirlik.md` içindeki **her satırı** doğrular: "zaten canlı" ise kodda/test'te kanıt (dosya:satır ya da test adı); faz/paket ise commit'te var ve davranışı çalışıyor; "YAPILMIYOR" ise gerekçe yazılı ve Emre onaylı; **KAPSAM AÇIĞI** satırları Emre'den yazılı karar alır (yap / bu sürümde yapma). Karar çıkmadan ya da açık satır kalırsa **yayın yok**.
2. v46 mockup'ının **her ekranını** canlıyla yan yana karşılaştırır: 1440 px, 390 px ve EN; iki gezi (Japonya klasik tur, **Ozora festival**: Gezinin sebebi, kamp, araba al/bırak, kapalı tur notu, festivalden sonra dinlenme); üç Plan görünümü (Kategoriye göre, Yolculuk sırasıyla, Gün gün); Pano; sohbet paneli; yapışkan şerit; arka yüzler; ⓘ balonları; ayrıntı penceresi (`openDetail`, `openEvDetail`); gezi menüsü; durum anahtarı. Araç: `node scripts/v30-shots.mjs` (genişletilmiş) + mockup'ın Playwright ekran görüntüsü; çıktı `e2e-output/v46/{1440,390,en}/` altında çiftler + `fark-raporu.md` (ekran | fark yok / bilinçli sapma §2 / HATA).
3. Dokunulmaz listeyi (§2.3) tek tek dener: rötar senaryosu, PNR uçuş günü, ••• ve ×, Ayarlandı, fiyat/saat/uyarı görünürlüğü, 14 gün uyarısı, paylaşılan gezi.
4. `npx tsc -p .`, `npx vitest run`, `E2E_OFFLINE=1 faketime -f "@2026-10-05 10:00:00" xvfb-run -a node scripts/e2e.mjs` çalıştırır; yeşil değilse rapor, kod değişikliğini kodlayan ajan yapar (denetçi kod yazmaz).
5. Eski kullanıcı verisiyle açılış: 0.36.84 ile üretilmiş bir IndexedDB yedeği (örnek gezi + Ozora + paylaşılan gezi) yeni build'de açılır, hiçbir kayıt kaybolmaz, "Yeni"/taslak/hareket anahtarı yokken de ekranlar tam.
Çıktı: `fark-raporu.md` + izlenebilirlik tablosunda her satırın "Doğrulandı" sütunu. **Kabul: açık satır 0.**

---

## 4. HAREKET / ANİMASYON BACKLOG'u (hiçbiri kaybolmasın)

Mockup'ın hareketleri (v46 `@keyframes`: bob, drop, fadein, flipin, glow, landed, lvp, newlink, pop, rise, rt-fly, shimmer, slidein, spin, takeoff, travel). **v31–v46 arasında yalnız `spin` yeni keyframe**'dir (`spin 3s linear`: v37 Aranıyor halkası; v39'da bilette halka kalktığı için kodda gerekmez, shimmer çubuğu yeter). Yeni geçişler: `.mvt-x`/`.hz-tools` opacity `.15–.18s`, `.jm` border/shadow `.15s`, Pano `.detail` `grid-template-rows .4s (.16,1,.3,1)`, `.why2 svg` `.3s`, kalp `transform .25s (.2,1.6,.4,1)`. v44 Yolculuk noktalı yolu **statik**. **[v46] v46'da yeni keyframe çıkarsa §1.3'teki `grep @keyframes` ile eklenir.**

### 4(a) Altı hareket (F8a)

| Hareket | Çizim | Kod (0.36.84) | **Karar** | Kod değişikliği |
|---|---|---|---|---|
| Parlama | 1,1 sn, halka 0→10 px, `rgba(91,69,224,.6)` | 0,6 sn, 4 px, .35 | **Çizim: 1,1 sn / 10 px** | `pk-glow` keyframes 35% → 10 px .6; `.pk-glow` `1.1s ease-out`; `motion.ts`: `GLOW_MS=1100` (`useJustChanged` varsayılanı) |
| Nabız | 1,4 sn, halka 7 px | 2,8 sn, 5 px | **Çizim: 1,4 sn / 7 px** (çok boş kartta titreşim dağılsın: kart sırasına göre `animation-delay`) | `pk-pulse`, `.ek-card .pk-ring.open/.half` ve yeni boş bilet/kart sınıfları |
| Yükselme | −3 px, 0,18 sn + gölge | −2 px | **−3 px** | CSS ~4281; e2e 5004 `-2px` → `-3px`; `.pn-card:hover` (3389–3390) −3 px **+ reduced kuralı** |
| Düşüş | 0,55 sn, `translateY(-14px) scale(.96)`, `(.2,.9,.3,1.2)` | 0,55 sn aşımlı, scale yok | **Çizim** | `pk-drop` keyframes + eğri; e2e 5018 |
| Mühür | 0,5 sn `scale .4→1.18→1`, `(.2,.9,.3,1.3)`, dönmesiz | 0,5 sn, dönme −14°→4° | **Dönme kalsın** (Emre onaylı öneri); süre/eğri çizimden; hedef `BookedBadge` ve bilet tik (`pk-stamp` kalktı) | `pk-pop`, `.pk-seal` seçicileri |
| Sayaç | 0,6 sn | 0,6 sn | **Aynı** | — |

### 4(b) Kodda olmayan 18 hareket

| # | Hareket | Karar | Gerekçe / değer |
|---|---|---|---|
| 1 | K29 aşama geçişi: uçak silüeti kalkış, çizim düşer, etiket zıplar, mühür; **"Hareketi duraklat"** | **Uygulanır** (F8c, F2 sonrası) | Silüet = bilette ortadaki `ucus.png`: Seçildi/Rezerve geçişinde `takeoff 1,1 sn (.16,1,.3,1)` (`translate(-40%,8px) rotate(-6deg)→none`), görsel `drop .7s`, etiket `pop .5s (.2,1.6,.4,1)`, kart `glow 1,6 sn` 0→6→14 px; bir kez (`useStageChange`); diğer kartlarda yalnız etiket pop + glow. "Hareketi duraklat": **Ayarlar'da anahtar** (`trip-radar:still`, `body.still`; `reducedMotion()` bunu da okur) |
| 2 | "İndi"/v33 "kart iner": halka 9 px + `scale 1.015`, 1,1 sn | **Uygulanır (dar)** | Taslak "Önerimiz" kartı AI aramasından sonra ilk belirir/değişirse `landed 1.1s`; Omurga→Aranıyor→Sonuçlar akışı (S10) çizim aracı kalır |
| 3 | `rt-fly` uçak karta süzülür `.9s`, `margin-left −18→0` | **Uygulanır** | Bilet ilk çizilişinde, kart başına oturumda bir kez (`dropsIn` deseni) |
| 4 | Canlı uçuş noktası nabzı `lvp 1.6s`, halka 4→7 px | **Uygulanır** | `FlightLive.tsx` "Canlı" noktası; reduced'de yok |
| 5 | Bölümlerin kaydırınca yükselmesi 0,7 sn | **Uygulanmaz** | Sihirli açılış (A3) ilk açılışta zaten yapar; her gezide her bölümü kaydırırken oynatmak H5/H2'ye ters |
| 6 | Kart çevirme yerinde binme `flipin .45–.5s`, origin `center top` | **Uygulanır (F4)** | `ch-flip` korunur (`--t-slow` 380 ms, `rotateY(-80deg)`, `opacity .2→1`); **kapanışta** kısa ters (`--t-quick`, `--e-in`) eklenir (şimdi anında) |
| 7 | × katlama satırı girişi `fold rise .3s` | **Uygulanır** | `.pk-fold` 300 ms `translateY(6px)` + opacity (yükseklik animasyonu yok) |
| 8 | Bölüm yükseklik animasyonu `grid-template-rows .45s` | **Uygulanmaz** (bölüm açma/kapama) | H1: kutu boyutu animasyonu aşağıdaki her şeyi iter; `mv-unfold` kalır. **İstisna uygulanır:** Pano "Neden?" (`.detail .4s (.16,1,.3,1)`, ok `.3s`; şerit `align-items:start` olduğundan komşuyu uzatmaz) |
| 9 | "Yeni" parlama + etiket 4,4 sn | **Uygulanır, uyarlanmış** | Etiket süreli değil **görülene kadar** (S15); parlama mevcut `ar-ring 1,5 sn` (K19) yeniden kullanılır; çizimin `glow 2.2s ×2`'si uygulanmaz (ikinci dil olmasın) |
| 10 | Pano açılışı iskelet→kartlar tık tık | **Uygulanmaz**; küçük hâli uygulanır | Orijinal vazgeçildi (giris-akisi-v2). Yerine Pano şeridi/ızgarasına `data-pit-children` işareti (açılış B, gezi başına bir kez) |
| 11 | "Sayı yukarı kayar" 450 ms | **Uygulanmaz** | `useCountUp` 600 ms zaten var; iki sayaç dili olmaz |
| 12 | Yer tutucu cümlelerin dönmesi 9 sn | **Uygulanır** | `TripsHome.tsx:342`: 3 örnek yazma ipucu (veri değil), `phc 9s`; reduced'de yalnız ilki; kutuya odakta/yazarken durur |
| 13 | Açılış ipucu yazıları | **Uygulanmaz** | Açılış ~0,75 sn'de biter, her dokunuşta biter (H6); ipucu bu süreye sığmaz |
| 14 | Board sohbet mesajı girişi `rise .45s` | **Uygulanır** | `Chat.tsx` mesaj `mv-rise` 260 ms `translateY(6px)`; sohbet kendi kutusunu kaydırır (korunur) |
| 15 | Toast girişi `.35s translateY(20px)` | **Uygulanır** | `cards/UndoToast.tsx` giriş 300 ms `--e-out`, çıkış `--t-quick`; geri sayım halkası değişmez |
| 16 | ⓘ balonu açılışı, "Neden?" açılışı, kalp zıplaması | **Uygulanır** | ⓘ `tipx-in .14s` 4 px; "Neden?" #8 istisnası; `.pn-heart` `.25s (.2,1.6,.4,1)` (şimdi .15 sn) |
| 17 | "Yazıyor…" aşaması | **Uygulanmaz** | Gerçek çağrıya bağlı değil (H4), `d34f0a2`'de bilerek kaldırıldı; bayat spec/yorum F9'da temizlenir |
| 18 | "Plana koy" uçuşunun hedefi: spec "kartın bölümü", kod Plan sekmesi | **Plan sekmesi kalır** | Pano'dayken Plan'daki bölüm görünmeyebilir; sekme tek garantili hedef. Spec F9'da koda göre düzeltilir; Plan'a dönüşte kart `flash` (K22) zaten parlar |

### 4(c) Reduced-motion boşlukları (F8b)
`CSS` sonuna tek blok `@media (prefers-reduced-motion: reduce)` **ve** aynı kurallar `body.still`: `.dc-flash` (~2410), `.cat-bar > span` (~3855), `.hx-bar i` (~1210), `.pn-card` hover (~3389), `.gm-ring.go` (~3067), yeni `.jf-*`, `.tk-*`, `.fo-*` geçişleri, `.pk-fold`, Pano `.detail`. `.pk-undo-ring .run` (~4240) işlevsel geri sayım: halka animasyonu gider, süre/çubuk kalır. Test: yeni `tests/reducedMotion.test.ts` — `static/app.css` metnini okuyup `animation:`/`transition:` içeren her seçicinin reduced bloğunda ya da dışlama listesinde (`pk-undo-run`) olduğunu doğrular (düz metin, jsdom gerekmez; vitest ortamı node).

### 4(d) Ölü kod: F9 (Mascot wink, FlightMap/WorldFlight, `--t-instant` → `ch-flip` kapanışında kullan ya da sil, bayat yorumlar).

### 4(e) `exitMotion` testi (F8e)
Vitest node ortamında: `tests/exitMotion.test.ts` — `leavesWithCopy` (sahte `{matches, classList}`), `LEAVING`/`EXIT_MS`, reduced iken kopya yapılmadığı (sahte `MutationObserver`/`document` ile `installExitMotion`). e2e (Part 5): modal aç→kapat → `.mv-leaving` var, `inert`, `aria-hidden`, id yok, ≤400 ms sonra yok; çekmece için aynı; `c305557` regresyonu (kopya açık pencere sanılmaz).

### 4(f) v39+ yeni hareketler
- **Kart çevirme yerinde:** #6.
- **Taslak→Seçildi:** çerçeve rengi mor-gri→açık yeşil `border-color .4s` (renk geçişi reduced'de kalır), etiket `pop .5s`, kısa `glow`.
- **Bilet durumları:** Arıyoruz→Aranıyor koçanda `shimmer 1.4s` çubuk (`spin` halkası uygulanmaz); Önerimiz→Seçildi etiket pop; Seçildi→Bilet alındı #1 (takeoff + mühür + büyük tik `pk-pop`).
- **Yolculuk noktalı yol:** statik; mini kart hover `border/shadow .15s`; kaydırınca yükselme yok (#5); basınca asıl kartta `flash`.
- **Etkinlik şeridi, ulaşım ×:** `opacity .15–.18s` (dokunmatikte × yok).

---

## 5. RİSKLER ve geri dönüş

**Veri modeli.** IndexedDB şeması **değişmez** (`DB_VERSION = 5`, `src/lib/db.ts`). `Item`'a alan eklenmez: taslak yazmayan görünüm (S2); "Yeni" `localStorage` (`trip-radar:seen:<tripId>`; yoksa "yeni yok", hata fırlatmaz); "Hareketi duraklat" `localStorage` (`trip-radar:still`). Sonuç: 0.36.84'ten gelen kullanıcı verisi için **taşıma gerekmez**; paylaşılan gezi şeması (`supabase`, `src/lib/share`) değişmez; eski sürüm yeni veriyi okur. Emre S2'yi "kalıcı taslak" yaparsa o **ayrı onaylı iş**: `Item.draft?: boolean` isteğe bağlı alan (DB sürümü değişmez) + `tests/dbUpgrade.test.ts` + geri uyumluluk testi.
**Backend (supabase/functions, SQL) — tek tek inceleme.**

| Parça | Yeni tasarımın isteği | Karar |
|---|---|---|
| `ai` (Gemini geçidi, `policy.ts`) | Yeni AI çağrısı yok; "AI'a arat" (S8) sohbet satırı gönderir (mevcut `Chat`/asistan yolu) | **Değişmez** |
| `ai-admin` | Yok | **Değişmez** |
| `city-image` (Unsplash/Pexels, `pick.ts`, `CACHE_VERSION`) | Etkinlik/otel kartları mevcut görsel yolunu (`FallbackImg`, çizim yedeği) kullanır | **Değişmez** |
| `flight` (AeroDataBox, `shape.ts`, `FlightLive`) | Yeni bilet aynı alanları okur: kalkış/varış saatleri, terminal, kapı, durum, `revised`, `minutes` (rötar, kırmızı saat, kapı değişti bilette korunur) | **Değişmez** |
| `offers` (Aviasales, Xotelo, SerpApi, Viator, Airalo, Omio; `OfferOut`) | Uçuş seçenek kartı/Skyscanner satırı için gereken alanlar **zaten dönüyor**: `carrier`, `carrierCode` (logo), `depart`, `arrive`, `fromCode`, `toCode`, `durationMinutes`, `stops`, `price`, `why`, `source`, `fetchedAt`. **Kişi başı fiyat:** `price` herkes için toplamdır (`Math.round(f.price * adults)`), kişi başı = `price / Need.adults` istemcide (`Offer`'da `adults` yok, `Need` taşır) → backend değişmez. "+1" gün: istemcideki mevcut `cardView` hesabı. Bagaj: kaynak vermiyor → yazılmaz. Aktarma yeri: yalnız SerpApi bacaklarında var → isteğe bağlı FB | **Değişmez** (isteğe bağlı: FB) |
| `web-search` (etkinlik tarihleri/olgu) | Yok; "AI'a arat" yerinde arama (S8) kapsam dışı. İleride yapılırsa `offers` + istemci `addOffer` zaten kaydeder (`addedBy:"ai"`); yeni uç gerekmez | **Değişmez** |
| SQL (`schema.sql` paylaşım, `profiles.sql`, `history.sql`, `ai-gateway.sql`, `offers-cache.sql`, `flight-cache.sql`, `web_search*.sql`, `city_image*.sql`) | Yeni tablo/sütun/RPC yok; taslak yazılmaz, "Yeni" ve hareket anahtarı yerel | **Değişmez**, dağıtım adımı yok |
Dağıtım: backend değişmediği için `supabase functions deploy` **çalıştırılmaz**; FB yapılırsa yalnız `offers` (`--no-verify-jwt`, mevcut gibi). Test: `tests/offersShape.test.ts`, `flightShape.test.ts`, `shareSafety.test.ts` zaten yeşil kalmalı (backend sözleşmesi bozulmadı kanıtı).

**Riskler.**
1. Hedef kayması: v46 onaylı final; yine de yeni sürüm gelirse §1.3 ve `[v46]` işaretleri. Bitişte F10 denetimi.
2. Rötar/PNR/uyarıların sade tasarımda sessiz kaybı (en riskli kayıp): F2 kabul testi §2.3-4 ve -6'yı tek tek doğrular.
3. Arka yüz örtme (F4): dar ekran, son satır, odak tuzağı → e2e 390 + klavye.
4. Aşama sözlüğü (F0) çok dosyaya dokunur, e2e metin kırılması → F0 tek commit + hızlı e2e.
5. `PlanCard.tsx`/`NeedCard.tsx`/`CardShell.tsx`/`app.css` çok fazda değişir → dosya sahipliği §7.
6. Performans: Yolculuk mini kartları + `ResizeObserver`.
7. Hareket: nabız 1,4 sn çok boş kartta dikkat dağıtabilir (gecikme dağıtma); `exitMotion` testsiz → F8e erken.
8. Mockup'taki örnek veri kodda taşınmaz (§2.3-2).
**Geri dönüş.** Her faz ayrı commit/PR → tek `git revert`; yayın yalnız temiz çalışma ağacından; sorun olursa `release` dalına yeni numaralı sürümle önceki davranış geri konur (güncelleyiciler yalnız yeni sürümde hareket eder; geri alma da yeni numara ister). Veri değişmediği için eski sürüme dönüş güvenlidir.
**Yayın adımları.** (1) Sürüm: `package.json`, `static/manifest.json`, `PRIVACY.md` (örnek 8a48fc4); (2) `npx tsc -p . && npx vitest run`; (3) `npm run build`; (4) `E2E_OFFLINE=1 faketime -f "@2026-10-05 10:00:00" xvfb-run -a node scripts/e2e.mjs` (tam yeşil); (5) §6 ekran görüntüleri; (6) temiz çalışma ağacından `scripts/release.sh` (`origin/release`'e "Release X"); (7) envanter/yol haritası durum güncellemesi.

---

## 6. "Bitti" tanımı

1. `npx tsc -p .` temiz. 2. `npx vitest run` yeşil (yeni: stageWords, cardPeek+, ticketStub, backFace, journeyFlow, draft, reducedMotion, exitMotion). 3. e2e **tam** yeşil (komut §5). 4. Yan yana ekran görüntüleri: `node scripts/v30-shots.mjs e2e-output/v46` — `SHOTS_WIDTH=1440` ve `390`, `SHOTS_LANG=en` (script yeni görünümleri kapsayacak şekilde genişletilir: Uçuş/Konaklama/Ulaşım/Etkinlik bölümleri, arka yüzler, Yolculuk, Gün gün, Pano, 5 durumlu anahtar); karşıda mockup ekranları (`git show origin/plan-v30-wip:docs/mockups/plan-v46-sira/index.html` → aynı genişlikte Playwright; her iki gezi sekmesi: Japonya ve Ozora). 5. **Her mockup ekranı** (bilet 6 durum + boş, otel 4 durum, ulaşım dolu/boş/rezerve, etkinlik şehir satırı + boş şehir, uçuş arka yüz + Pano şeridi, otel arka yüz, Yolculuk tarihli/tarihsiz, anahtar) için bir karşılaştırma satırı: "fark yok / bilinçli sapma (§2)". 6. F9 dokümanları. 7. **F10 bağımsız denetim: izlenebilirlik tablosunda açık satır 0, fark raporunda HATA 0.**

### 6.1 Emre'ye sorulacak (varsayılanla ilerlenir)
Ayarlandı rozeti gri mi yeşil mi (§2.2); S1 "Bunu seç" düğmesi; S11 Pano'da taslak yazısı; S8 yerinde arama ayrı iş mi.

---

## 7. Ajanlara dağıtılacak iş paketleri

| Paket | Faz | Dosyalar (yazma sahipliği) | Paralel mi | Bağımlılık | Durum |
|---|---|---|---|---|---|
| P0 Durum sözlüğü + rozet + belirteçler | F0 | `lib/stageWords.ts`, `lifecycle.ts`, `cardView.ts`, `cardFacts.ts`, `items.ts`, `legs.ts`, `journey.ts`, `categories.ts`, `cards/BookedBadge.tsx`, `CardShell.tsx`, `PlanCard.tsx`(rozet), `ActivityBoard.tsx`(rozet), `Pano.tsx`(rozet), `DayCards.tsx`, `PlanOrder.tsx`, `app.css`(token+zemin), testler, e2e metinleri | Tek worktree, ilk | — | **ŞİMDİ** |
| P1a ⓘ balonu | F1a | `cards/InfoButton.tsx`, `Peek.tsx`, `CardShell.tsx`(info slotu), `lib/cardPeek.ts`, `tests/cardPeek.test.ts`, CSS `.inf*` | Evet (P1b, P1d ile) | — (P0 ile `CardShell` çakışırsa P0'dan sonra rebase) | **ŞİMDİ** |
| P1b Niyet etiketi | F1b | `MediaCard.tsx`(görsel bandı), `CardDate.tsx`, `cardView.ts`(topDate) | Evet | — | **ŞİMDİ** |
| P1c Köşe yüzü | F1c | `WhoseBadge.tsx`, `NeedCard.tsx`(adderOf), `CardShell.tsx` köşe slotu | P1a'dan sonra | P1a | **ŞİMDİ** |
| P1d Pano ferah | F1d | `board/Pano.tsx`(PanoCard/PanoArt), CSS `.pn-*` | Evet | — | **ŞİMDİ** |
| P8a Hareket değerleri | F8a | `app.css` ~4268–4287 + `.pn-card`, `motion.ts`, `tests/motion.test.ts`, e2e Part 5 | Evet | — (mühür hedefi için P0 sonrası) | **ŞİMDİ** |
| P8b Reduced-motion + Hareketi duraklat | F8b | `app.css`(son blok), `motion.ts reducedMotion`, `Settings.tsx`, `tests/reducedMotion.test.ts` | Evet | — | **ŞİMDİ** |
| P8e exitMotion testi | F8e | `tests/exitMotion.test.ts`, e2e Part 5 küçük ek | Evet | — | **ŞİMDİ** |
| P8d Kalan hareketler (#7, #9, #12, #14, #15, #16) | F8d | `Chat.tsx`, `UndoToast.tsx`, `TripsHome.tsx`, `CardShell.tsx`(FoldLine), `Pano.tsx`(kalp, Neden?), css | Parçalı paralel | P1a (#16 ⓘ) | **ŞİMDİ** |
| P9a Ölü kod + bayat yorum/spec | F9 | `Mascot.tsx`, `FlightMap.tsx`, css `st-map-*`, `StartChat.tsx` yorum, DESIGN.md, v30 spec, yol haritası | Evet | — | **ŞİMDİ** |
| P2 Uçuş bileti + seçenek kartları | F2 | `cards/FlightTicket.tsx`, `FlightOption.tsx`, `PlanCard.tsx`(transport), `TransportCard.tsx`, `RideCard.tsx`, `EmptyCard.tsx`(EmptyTravelCard), `FlightLive.tsx`, `cardTicket.ts`, `estRange.ts`, `emptyCards.ts`, Pano uçuş kartı, css `.tk-*`,`.fo-*` | P3, P6 ile paralel; P4 ile sıralı | P0, P1a | başlanabilir |
| P3 Sade otel + Değiştir N | F3 | `MediaCard.tsx`, `CardShell.tsx CardFoot`, `PlanCard.tsx`(MediaCardBody çağrısı), `StayLine.tsx`, `NeedCard.tsx`(stay Arıyoruz) | P2, P6 ile | P0, P1a, P1b | başlanabilir |
| P4 Arka yüz | F4 | `NeedCard.tsx ChoiceSheet`, `cards/BackFace.tsx`, `lib/backFace.ts`, `OfferRow.tsx`, `AskButton.tsx`, `EmptyCard.tsx SearchRow`, css `.ch-*`, e2e `ch-back` | P5a, P6 ile; P2/P3 sonrası | P0, P1c, P2, P3 | P2, P3 sonrası |
| P5a Ulaşım kartı | F5a | `RideCard.tsx`, `LegCard.tsx`, `EmptyCard.tsx EmptyLegCard`, `transportFace` | P2/P3/P6 ile paralel | P0, P1a | başlanabilir |
| P5b Yolculuk görünümü | F5b | `plan/StoryView.tsx`, `plan/JourneyCards.tsx`, `storyDates.ts`, `journey.ts`, `TripPanel.tsx`(story kolu), css `.jf-*` | Sıralı | P2, P3, P5a, P6 | sıralı |
| P6 Etkinlikler şehre göre | F6 | `plan/ActivityBoard.tsx`, `categories.ts`(şehir grup), css `.ev-*`, `actsV30.test.ts` | Tam paralel | P0, P1c | başlanabilir |
| P7 Taslak modeli | F7 | `lib/draft.ts`, `TripPanel.tsx`, `PlanCard.tsx`(draft), `categories.ts stageLine`, `progress.ts`, `Pano.tsx` şerit, testler | Yalnız | P2, P3, P4 | en son |
| P8c Aşama geçişi (K29) | F8c | `cards/FlightTicket.tsx`, `BookedBadge.tsx`, css | P2 sonrası | P2, P8a | P2 sonrası |
| PB Aktarma yeri (isteğe bağlı) | FB | `supabase/functions/offers/shape.ts`, `offerSources/index.ts`, `tests/offersShape.test.ts` | Evet | Emre onayı | İsteğe bağlı |
| P10 Bitiş denetimi | F10 | yalnız `e2e-output/v46/*`, `docs/superpowers/specs/2026-10-13-plan-v46-izlenebilirlik.md` (doğrulama sütunu), `scripts/v30-shots.mjs` genişletme | Hayır (son) | P0–P9b tümü | **Yayın kapısı** |
| P9b Son temizlik | F9 | eski `pk-stub`, `sy-*`, `ax-*` CSS, kullanılmayan bileşenler, envanter durumları | Yalnız | P2–P7 | Son |

Not: F5b artık v46 kesin tasarımına göre yazılır (mockup beklenmez); F4, F7 de başlanabilir (yalnız bağımlılık sırası).

Çakışma kuralı: `PlanCard.tsx`, `NeedCard.tsx`, `CardShell.tsx`, `static/app.css`, `Pano.tsx`, `TripPanel.tsx` birden çok pakette değişir; her paket kendi bölgesine dokunur, birleştirme sırası P0 → P1 → P3/P2 → P4 → P5/P6 → P7 → P8c → P9b; `app.css` için her paket **kendi bölüm başlığıyla** (`/* -- F2 bilet -- */`) ekler, genel kuralı değiştirmez.
