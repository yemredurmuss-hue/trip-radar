# Plan ve Pano v11: kategori kartları, tek fiil, Pano ↔ Plan (2026-10-08)

Emre onayladı ("Onaylıyorum", 2026-10-08): çizim v11 + iki karar (tek sekme çubuğu, her yerde "Plana koy").
Çizim: `docs/mockups/2026-10-08-japonya-web-v11.html` (https://claude.ai/artifact/1N3e2uUJpJRif952stNXSf).
Kararların gerekçesi ve tarihçesi: `docs/urun-yol-haritasi.md` (K1–K72, "Her çizimde değişmezler" listesi).
Bu spec çizimi koda bağlar: neyin zaten var olduğu, neyin değiştiği, neyin yeni olduğu ve hangi sırayla.

## Sorun

Pano bugün yok: linkler ihtiyaçların içinde dağınık, karşılaştırma yalnız tek ihtiyacın penceresinde
(CompareView). Plan'daki kartlar her aşamada farklı görünüyor; seçenekler, AI önerileri ve "rezerve ettim"
aynı alt şeritte yarışıyor. Gezilecek yerler ve restoranlar iki ayrı bölüm, sigorta/eSIM/hazırlık "Diğer"in
içinde. Kartta × kaydı siliyor (geri alınabilir ama "gerek yok" demek değil). Bir de sekmeler hero'nun altında.

## Değişmezler (her fazda korunur)

1. Hero bugünkü v9 (`TripHero`, `TripFacts`); yalnız "Planı tamamla →" etiketi sabit kalır.
2. Bölüm sırası: Uçuş · Konaklama · Ulaşım · Etkinlik ve turlar · Yapılacak şeyler · Sigorta ve internet ·
   Hazırlık · İlham. Bölümler açık gelir; başlığa basınca kapanır (kullanıcının seçimi saklanır).
3. Pahalı ihtiyaç = niyet kartı. Biletli etkinlik/tur = kare fikir → "Plana koy" → "Bilet al ↗ / Aldım".
   Yapılacak şeyler (yer + restoran) = kare, "Plana koy", gün yok. Sigorta ve eSIM = niyet kartı.
4. Boş kart: ne / nerede / neden + istek çipleri + Kendin ara linkleri.
5. Aşama malzemesi: kesikli = Arıyoruz, amber = Seçildi, yeşil + mühür = Rezerve. Alt satır: solda bilgi, sağda tek eylem.
6. Kimden: yüz (E, S) ve "AI önerisi". "Senin linkin" yazısı yok.
7. ✨ ile AI'dan öneri sohbete düşer, bulduklarını kutuya ve Pano'ya ekler. Giriş kanalı sohbet.
8. Kart sabit boy: seçenekler kartın içinde ya da altında açılmaz; "N seçenek ›" seçim penceresini açar.
9. Tek fiil: bir şeyi plana sokan her düğme "Plana koy". Planda olan "Plan'da gör →".
10. Durum asla yalnız renkle anlatılmaz (DESIGN.md): yanında hep yazısı.

## Ekran ekran

### Sekmeler (tek çubuk)

Üstte tek çubuk: **Plan · Gün gün · Pano · Belgeler**. Hero'nun altındaki çubuk kalkar (`TripPanel.tsx`
L757-772 `.view-tabs`). "Günlük akış" adı "Gün gün" olur. Pano yeni görünüm (`view = "board"`).
Çubuk, plan boşken de görünür (bugün `timeline.entries.length > 0` şartı var; Pano'ya link boş planda da düşer).
**Harita**: çizimde yok. Öneri: Gün gün'ün içinde "Liste | Harita" anahtarı (bkz. Açık kararlar).

### Plan bölümleri

Var olan: `lib/categories.ts` (`SECTION_ORDER`, `categorize`, `sectionStatus`, `sectionProgress`),
`plan/sectionMeta.ts`, `plan/CategoryPlan.tsx`, `plan/Section.tsx`.

| Bugün (`SectionId`) | v11 | Not |
|---|---|---|
| flight, stay, transport | aynı | |
| activity "Etkinlikler" | **Etkinlik ve turlar** | ad |
| todo + food | **Yapılacak şeyler** (`todo`) | birleşir; içinde süzgeç Hepsi · Gezilecek yerler · Restoranlar |
| other "Diğer (Sigorta, eSIM)" | **Sigorta ve internet** (`cover`) | yalnız sigorta + eSIM |
| (Diğer'in içindeki Hazırlık) | **Hazırlık** (`prep`) | kendi bölümü; en üstte vize satırı |
| inspo | İlham | en altta, kapalı başlamaz |

- Boş bölüm çizilmez (bugünkü gibi çip olur); ama açılış kuralı değişir: hepsi açık gelir.
- Başlık: ikon · ad · sayı · durum satırı aşama sözleriyle ("1 rezerve · 2 seçildi · 1 aranıyor",
  `CatSection.stages`'ten) · ince çubuk (yeşil rezerve, amber seçildi) · sağda bütçe.
- **Bütçe**: bugün bölüm bütçesi yok (`Trip.budget` tek toplam). Faz 1'de sağda yalnız harcanan
  ("€2.690") yazar; "€3.600 ayrıldı" satırı bölüm payı kararına bağlı (Açık kararlar 2).
- Gizlenenler: bölümün sonunda "Gizlenenler · N göster" (var: `plan/HiddenList.tsx`), "Geri getir".

### Niyet kartı (pahalı ihtiyaç)

Aşama eşlemesi yalnız arayüzde, yeni durum yok (`lib/lifecycle.ts`):
Arıyoruz = `search | options`, Seçildi = `planned`, Rezerve = `booked | ready`. İptal edildi / Gerek yok /
Kullanıldı bugünkü gibi.

**Arıyoruz** (`cards/EmptyCard.tsx`, kesikli):
- Üst satır: ○ · tür ikonu ve adı · tarih · sağda "Arıyoruz" · × (üzerine gelince).
- Gövde: illüstrasyon · başlık (ne) · alt satır (nerede, gece ayları) · istek çipleri (`lib/needs.ts`
  `checkNeeds`'ten, yalnız söylenen/sezilen istekler) · ✨ "neden" satırı · "Kendin ara" linkleri
  (`lib/searchLinks.ts`, tarih ve kişi sayısıyla).
- Alt: solda **"(yüzler) N seçenek ›"** → seçim penceresi; sağda ✨ (AI'dan öneri). Seçenek yoksa
  "Henüz kimse bakmadı" ya da "AI arıyor…".

**Seçim penceresi** (var: `CompareView.tsx`, `board/OptionBoard.tsx`): sırası
"Senin için: X" (FORYOU) → **Kaydettikleriniz · N** → **AI'nın bulduğu alternatif** (ayrı, kesikli lavanta
çerçeve, "Sizin linklerinizin dışında, tercihlerinize göre.") → Kendin ara → alt: "Daha fazla öneri bul" ·
"Pano'da karşılaştır". Satırın düğmesi **"Plana koy"** (bugün "Seç"). Seçili satır: "Rezerve ettim".

**Seçildi** (amber): üst satırda etiketin yerine **"✓ Aldım"** hap düğmesi (linke gitmeden rezerve; belge
zorunlu değil). Alt: fiyat · "Pano'da N alternatif" (N > 0 ise) · sağda **"Rezerve et ↗"** (affiliate
otomatik, `lib/affiliate.ts`). Karta basınca seçim penceresi (fikir değiştirmek için).

**Rezerve** (yeşil + mühür): üst satır "Rezerve"; alt: kanıt satırı (varsa: "Giriş 1 Nis 15:00") · belge çipi
ya da amber **"Belge eksik"** (dosya seçici açar, var: `cards/DocAccess.tsx`) · "Ayrıntı ›". Uçuşta PNR yalnız
koçanda yazar. Karta basınca **Rezervasyon ayrıntısı** penceresi (aşağıda). Mühür dar kartta küçük ve altta.

**× (kaldır)** (bugün `DeleteX` siler):
- Arıyoruz / Seçildi → **Gerek yok**: kayıt silinmez, gizlenir (`dismissed` ya da `Trip.hidden`), sayaç ve
  yüzdeden çıkar, 8 sn "Geri al" (`lib/undo.ts`), bölüm sonunda Gizlenenler'den geri gelir.
- Rezerve → onay penceresi (native `confirm()` kalkar): "Bu rezervasyon onaylı. Kaldırmadan önce: iptal ettin
  mi?" + belgesi varsa "Belgesi Belgeler sekmesinde kalır." Düğmeler: Vazgeç · **İptal ettim, kaldır**
  (`cancelBooking`, `actions.ts:49`).
- Belge hiçbir silmede kaybolmaz.

### Rezervasyon ayrıntısı (yeni pencere)

Bugün `cards/CardDetail.tsx` kartın içinde açılıyor; v11'de pencere (seçim penceresiyle aynı kabuk).
İçerik: marka + ad + saat + "Rezerve · belgeli" · **Rezervasyon ayrıntısı** satırları (PNR, giriş/çıkış,
seans, koltuk, bilet no) · **Belgeler** (Aç ↗ ya da "Belge eksik · ekle"; "Belgeler yalnız bu bilgisayarda
durur") · alt: **Değiştir** (önce "Yeni bir seçeneğe geçmeden önce eskisini iptal ettin mi?") · **İptal ettim**
(kart Arıyoruz'a döner, seçenekler durur, belge Belgeler'de kalır; Geri al) · Kapat.
Etkinlik biletinde aynısı (Değiştir yok).

**Veri (yeni)**: `Item.booking?: { ref?: string; rows: [string, string][] }`. `docReader` bugün PNR'ı yalnız
`statusNote`'a yazıyor (`lib/docReader.ts:202`); bundan sonra `booking`'e de yazar. Yoksa pencere "Ayrıntı
yok; belgeyi eklersen PNR, saat ve tutarı ben okurum." der.

### Etkinlik ve turlar

- Plandakiler satır (bugünkü kart yerine): görsel · ad · aşama noktası + şehir · fiyat · sağda
  Seçildi'de "✓ Aldım" + "Bilet al ↗", Rezerve'de "Bilet alındı" + belge çipi/"Belge eksik" + "Ayrıntı ›" · ×.
  Rezerve satıra basınca ayrıntı penceresi.
- Altında "Fikirler · bilet ya da rezervasyon gerektirenler" + "Daha fazla fikir" (✨) ve kare fikirler:
  görsel · kimden · × · ad · şehir · kaynak · fiyat · **"Plana koy"**.

### Yapılacak şeyler (yer + restoran)

Bugün: `ideas/IdeaList.tsx` satır + sekmeler (Havuzda · Günü var · Kaçtı · Yapıldı) + gün seçici.
v11: **kareler** (etkinlik fikirleriyle aynı kare), üstte süzgeç **Hepsi · Gezilecek yerler · Restoranlar**
(sayılarıyla) + "Daha fazla öner" (✨). Kare: görsel (restoranda sıcak zemin) · Maps'ten geldiyse "Maps"
etiketi · kimden · × · ad · şehir · not · **"Plana koy" ↔ "✓ Planda"** (yerinde kalır, Geri al).
- Gün seçici burada yok: gün Gün gün'de verilir. Ekleme karesi yok: giriş sohbet ("Kyoto'da iyi bir ramenci
  ekle") ve eklenti (Maps linki kendiliğinden düşer, bugünkü `isGoogleMaps` yolu).
- Sayaçlara ve yüzdeye girmez (bugünkü kural).
- Veri: "planda" = `Item.status === "chosen"` (fikir için). Günü olan fikir de planda sayılır.
  "Etkinliklere taşı" ve "Hazırlığa taşı" eylemleri •••'de kalır.

### Sigorta ve internet

İki eşit niyet kartı yan yana (aynı çerçeve, aynı aşamalar): **Seyahat sağlık sigortası** ve
**<Ülke> eSIM · 10 GB**. eSIM seçenekleri bugünkü canlı kaynaktan (`lib/offerSources` `kind:"esim"`: Airalo,
Holafly…). Sigortanın kaynağı yok: Faz 6'da yalnız Kendin ara + AI önerisi (web); kaynak ayrı iş.

### Hazırlık

Kendi bölümü. En üstte vize satırı (`lib/visa.ts` `visaFor`; "✓ Vize gerekmiyor · Türk pasaportuyla 90 güne
kadar"). Liste bugünkü `PrepList`; işaretlenen **yerinde kalır** (yeşil kutu + "Hazır"); "Hazırları gizle" anahtarı;
"Daha fazla öner" (✨). Amazon linki yalnız satın alınacak şeylerde.

### İlham

Bugünkü `InspoGrid`, en altta küçük bölüm. Not: "plana konunca Yapılacak şeyler'e geçer".

### Hero

Değişmez. Yalnız: "Planı tamamla →" sabit (bugün `nextStepText` yalnız title; görünür "Sıradaki" satırı
eklenmeyecek, sırayı sohbet söyler). Yan kart canlıdaki gibi (2×2 küçük bilgiler, ayraçlı hava): bugün zaten öyle.

### Pano (yeni görünüm)

Bütün kayıtların yığıldığı ve seçip plana konduğu yer. Bugün yok; en yakını `board/OptionBoard.tsx`
(tek ihtiyacın kartları) ve `lib/board.ts` (sıralama, rozetler).

- Başlık: "Pano · N kayıt" · Kayıtlarda ara · Kartlar | Karşılaştır · "+ Link ekle". Plan'dan bir ihtiyaçla
  gelindiyse "← Plan'a dön".
- Kategori sekmeleri: Tümü · Uçuşlar · Konaklama · Ulaşım · Etkinlik · Yapılacak · Sigorta ve eSIM · İlham ·
  **Beğenilenler** (sayılarıyla).
- Araçlar: durum **Hepsi · Karar bekleyen · Planda** (sayılarıyla) · **Sırala**: Bize en uygun · En ucuz ·
  En çok beğenilen · En yeni eklenen (`lib/board.ts` sıralamaları genişler).
- Izgara: geniş ekranda 4 sütun, dar ekranda kendiliğinden azalır. Kart: görsel 4:3 (gerçek foto; yoksa
  illüstrasyon kutuya sığar) · sol üst rozet (Önerim / En ucuz) · sağ üst kalp · sağ alt uyum puanı ("Tercihlerinize
  uyum") · planda ise sol altta **"✓ Planda / Rezerve"** etiketi → gövde: ihtiyaç adı · başlık (2 satır,
  tamamı üzerine gelince) · tek satır alt bilgi (marka + kısa) → **fiyat + tek düğme** (Plana koy / Plan'da gör →)
  → alt satır: kimden · beğenenlerin yüzleri · "Neden? ▾" (artılar/eksiler, senin şartların, herkes için;
  "Ele · bunu gösterme"). Fiyat/düğme ve alt satır her kartta aynı hizada.
- Bir kategori seçilince ihtiyaca göre gruplar: grup başlığı "Kyoto · 5 gece · 3 seçenek" + sağda
  "Karar bekliyor" ya da **"Seçildi: X · Plan'da gör →"**; "Senin için" kutusu; Karşılaştır görünümünde
  bugünkü tablo (CompareView Tablo).
- **Pano ↔ Plan**: "Plana koy" → bildirim "X → Kyoto · 5 gece kutusuna kondu · Plan'da gör". "Plan'da gör" →
  Plan sekmesi, kart görünür yere kayar ve parlar (var: `Progress.tsx` `show()` + `.flash`, `showOnPlan`).
  Plan'daki "Pano'da N alternatif" → Pano o kategoriyle açılır, grup ekrana kayar ve çerçevelenir.
- **Beğeni**: kalp = beğen. Kartın altında beğenenlerin yüzleri. Paylaşılan gezide bugünkü oy altyapısına
  yazılır (kalp = `VoteValue` 2 "Süper", kalbi kaldırmak = oyu kaldırmak; `lib/share/votes.ts`); paylaşılmamış
  gezide yerel: `Item.likedBy?: string[]`. Olmaz/Olur'un Pano'da karşılığı yok ("Ele" var). Beğenilenler = en az
  bir kişinin beğendiği.
- **Kim ekledi**: bugün kayıtta yok (yalnız `Capture.sharedBy`). Yeni: `Item.addedBy?: string` (kişi kimliği
  ya da `"ai"`); eklentiden gelen = gezinin sahibi, paylaşımdan gelen = `sharedBy`, öneri = `"ai"`. Eski kayıtlar
  boşsa "AI önerisi" değil, yüz gösterilmez.

## Veri değişiklikleri (özet)

| Alan | Yeni / değişen | Nerede |
|---|---|---|
| `Item.addedBy?: string` | yeni | `lib/types.ts` Item; capture/öneri yolları doldurur |
| `Item.likedBy?: string[]` | yeni (yerel beğeni) | paylaşımda votes'a eşlenir |
| `Item.booking?: { ref?, rows }` | yeni | `docReader` doldurur |
| `SectionId` | `food` → `todo`'ya katılır; `other` → `cover`; `prep` yeni | `lib/categories.ts`; eski kayıtlar okunurken eşlenir |
| Fikir "planda" | `status: "chosen"` | `lib/ideas.ts`, `lib/ideaList.ts` |
| Görünüm | `view: "plan" \| "days" \| "board" \| "docs"` | `TripPanel.tsx` L97 |

Hepsi isteğe bağlı alan; eski sürüm bilmediği alanı yok sayar. Paylaşım şeması değişmez (beğeni oy olarak gider).

## Fazlar (her faz kendi sürümü; sürüm numarası o gün PENDING'den alınır)

1. **İskelet**: tek sekme çubuğu üstte (Plan · Gün gün · Belgeler; Pano sekmesi Faz 5'te eklenir, boş
   "yakında" sekmesi gösterilmez), bölümlerin yeni sırası/adları/birleşmeleri, hepsi açık, aşama sözlü durum satırı, Hazırlık kendi
   bölümü + vize satırı + yerinde kalan işaret + "Hazırları gizle".
2. **Kart**: boş kartın ne/nerede/neden + istek çipleri, "N seçenek ›" + yüzler (`addedBy`), seçim penceresinde
   AI ayrı, "Plana koy" fiili, "✓ Aldım" üstte, "Rezerve et ↗" altta, × = Gerek yok, rezerve × onay penceresi,
   mühür.
3. **Rezervasyon ayrıntısı** penceresi + `Item.booking` + docReader yazması.
4. **Etkinlik ve Yapılacak şeyler kareleri**: fikir kareleri, "Plana koy" ↔ "Planda", süzgeç, gün seçicinin
   Gün gün'e taşınması.
5. **Pano**: yeni görünüm, kategoriler, durum, sıralama, beğeni (`likedBy` + votes), Pano ↔ Plan geçişleri.
6. **Sigorta ve internet** iki kart + (karar çıkarsa) bölüm bütçesi.

## Test

- Birim (vitest): `categories.test.ts` (yeni `SECTION_ORDER`, food→todo, other→cover, prep), `prep.test.ts`,
  `planStages.test.ts`, `board.test.ts` (yeni sıralamalar, durum süzgeci), `share.test.ts` (kalp ↔ oy 2),
  `emptyCards.test.ts`, yeni: `addedBy` doldurma, `booking` okuma, eski kayıt eşlemesi.
- e2e (`scripts/e2e.mjs`): `tab("Günlük akış")` → "Gün gün"; `sec("food"|"other")` → `todo`/`cover`;
  bölüm başlığı kalıpları; "Etkinliklere taşı"/"Hazırlık'a taşı" yerleri; yeni senaryolar: × → Gizlenenler →
  Geri getir; rezerve × → onay → İptal ettim; Pano'da Plana koy → Plan'da gör → kart parlar; Plan'dan "Pano'da N
  alternatif" → grup çerçeveli.
- Her faz: unit + e2e yeşil, Mac'te Emre dener.

## Açık kararlar (Emre)

1. **Harita** sekmesi nereye? Öneri: Gün gün'ün içinde "Liste | Harita" anahtarı.
2. **Bölüm bütçesi** ("€3.600 ayrıldı"): AI gezi kurarken toplam bütçeyi bölümlere dağıtsın mı (düzenlenebilir),
   yoksa yalnız harcanan mı yazsın? Öneri: Faz 1'de yalnız harcanan; dağıtım Faz 6.
3. Faz sırası: öneri 1 → 2 → 5 → 3 → 4 → 6 (Pano asıl iş olduğu için kartlardan hemen sonra).
