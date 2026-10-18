# D — Gezi türleri ve uç durumlar: omurga kuralları, senaryo testleri, genel ilkeler

Tarih: 18 Ekim 2026 · Kod: `/home/user/trip-radar` (0.37.1, `9f22bae`) · Tasarım: v77–v82 notu ve `plan-v82-standart/kaynak/` (z82.py, data71.py, hero82.py)

## 0. Kısa sonuç

- Canlıda **5 yerleşik gezi türü** var: festival, kayak, balayı, wellness, klasik. Bunlara bir de **"custom"** ekleniyor: AI'nın o gezi için kurduğu kalıp. Başka her şey (kruvaziyer, safari, iş seyahati, Interrail, yol gezisi, hac, maraton, düğün…) **klasik** sayılıyor. Klasik tür yalnız konaklama ve uçuş açar. Custom kalıp yalnız AI etiket döndürürse kuruluyor. AI yoksa ya da etiket gelmezse tür her zaman klasiğe düşüyor.
- **Kategoriler canlıda zaten sabit** ve 8 tane: Uçuş, Konaklama, Ulaşım, Etkinlik ve turlar, Yapılacaklar ve restoranlar, Belgeler ve internet, Hazırlık, İlham. İçinde bir şey olmayan kategori çizilmiyor. Tür kategori eklemiyor; yalnız kart ekliyor, öneri engelliyor ve hazırlık listesi veriyor. Yani v82'nin "sabit 6+1" varsayımı canlıyla uyumlu. Fark yalnız İlham'ın Pano'ya taşınması.
- Asıl kırılma **kategori atamasında**. Bir kaydın Etkinlik'e girmesi için kaydın kendi sözcüklerinde bilet kanıtı gerekiyor ("bilet", "tur", fiyat, satıcı). Bu yüzden türün açtığı şu kartlar **Yapılacaklar'a düşüyor ve "Güne eklendi / done" sayılıyor**: Kayak pası, Ekipman kiralama, Kayak okulu, Wellness programı, Dalış ekipmanı, Safari paketi. Kayak gezisinde Etkinlik bölümü hiç oluşmuyor. Yeni tasarımda bu kartlar karar kutusu olarak görünmez.
- Yeni tasarımın varsayımları canlıyla şu noktalarda çakışıyor:
  - Tek seçim / çoklu toplama ayrımı paket ürünü taşımıyor: liveaboard, retreat, kruvaziyer ve "bilete dahil kamp" birden çok kategoriyi kaplıyor.
  - Niyet = şehir varsayımı tutmuyor: aynı şehirde iki otel, tarihsiz linkler, onaylanmamış rotada tek durak "Japonya".
  - Tek ülkeli hero çok ülkede kırılıyor. Interrail'de yalnız İngiltere vizesi görünüyor, Schengen kayboluyor.
  - Gezi sırasında ve sonrasında ayrı bir mod yok.
  - Canlıda olmayan bir kavram var: "uçakta geçen gece".
- Görev 3'te 12 genel ilke ve her biri için önerilen kural var. Bölüm 5'te Emre'ye sorulacak 14 karar öncelik sırasıyla duruyor. Bölüm 4'te tasarımdan bağımsız 18 canlı hata var.

## 1. Yöntem

- Denemeler yalnız şu dizinde yazıldı ve çalıştırıldı: `/tmp/claude-0/-home-user-trip-radar/71817299-ab28-5f54-8d3b-9ea0ff461203/scratchpad/research/probe/`. Repoda hiçbir dosya değişmedi.
  - `lib.ts`: ortak yardımcılar.
  - `g1.test.ts`: türler.
  - `g2a.test.ts`: başlangıçtan oluşan omurga.
  - `g2b.test.ts`, `g2c.test.ts`: pano durumları.
  - `g2d.test.ts`: çok ülke ve ad anahtarları.
  - `g2e.test.ts`: metin okuma.
  - Çıktılar: `out-*.json`. Okunur döküm: `node show.cjs ./out-g2a.json`.
- Çalıştırma komutu: `node_modules/.bin/vitest run --root <probe> -c vitest.config.mjs`. Repodaki testlerin `typed()` yardımcısı aynen kullanıldı: kodun okuması (`parseStartText`) artı elle verilen "model okuması" (`acceptExtraction`). **AI ve ağ çağrısı yapılmadı.**
- Boru hattı, tests/categories.test.ts ve TripPanel'deki çağrıların aynısıyla kuruldu:
  - `wouldMake` → `buildPlan` → `buildLegs` → `buildTimeline` → `categorize`
  - Yer tutucu ve boş kart bilgisi: `stageCtx` ile
  - Ek olarak: `ruleSuggestions`, `journeyOf` (gezinin şekli), `tripFacts` (hero bilgileri), `budgetBar`.
- Tablolarda "Canlı" sütunu bu çalıştırmaların gerçek çıktısını özetliyor. Satırlar `ad · meta · durum/aşama` biçiminde.

---

## 2. Görev 1 — Omurga kuralları

### 2.1 Omurga nasıl kuruluyor (canlı)

1. **Başlangıç sohbeti** (`startTrip.ts`) şunları okur: nereye, nereden, kim, ne zaman, ne kadar, tarz/bütçe. Bir etkinlik ya da tema varsa onu da okur (`startEvents.ts`: 40'a yakın kayıt, ör. AfrikaBurn, Tomorrowland, Oktoberfest, F1, Hac, Kiraz çiçekleri).
2. **Tür seçimi:** `playbookFor` → `startPlaybook`. Klasik çıkarsa ve AI'nın kalıbında "biçim" varsa tür `custom` olur.
3. **`creationOf`** her gezi için aynı iskeleti kurar:
   - **Konaklama:** onaylı rotada her durağa bir konaklama. Onaysız rotada tek durak; hedefin adı şehir yerine geçer ("Konaklama · Japonya", 15 gece).
   - **Uçuş:** gidiş ve dönüş için iki yer tutucu. Kişi gidilen yerden yola çıkıyorsa uçuş açılmaz. Yol gezisinde uçuş yerine tek "Araç kiralama" açılır.
   - Ayrıca kişi sayısı, durak başına ülke ve türün cevaplarıyla gelen bütçe.
4. **`playbookCards`** türün kartlarını ekler: transfer, bilet, pas vb. Hazırlık maddeleri `prep` olarak eklenir. Kartlar sohbetteki `plan_item` gibi kaydedilir (`planToSave`).
5. **`categorize`** her kaydı 8 sabit bölümden birine koyar (`SECTION_ORDER`). Bölüm türden değil **kaydın kendisinden** gelir (`sectionOfItem`):
   - uçuş → Uçuş
   - konaklama → Konaklama
   - tren, otobüs, feribot, transfer, taksi, kiralık araç → Ulaşım
   - eSIM, sigorta, vize → Belgeler ve internet
   - `prep` → Hazırlık
   - restoran → Yapılacaklar
   - **aktivite: bilet kanıtı varsa Etkinlik, yoksa Yapılacaklar.** Kanıt şunlardan biri: fiyat, bilet satıcısı, "bilet / tur / rezervasyon / ticket / cruise" sözcükleri, gösteri ya da festival sözcüğü (`booking.ts`).
6. **Arayüz** (`CategoryPlan.tsx`) bölümü yalnız içinde bir şey varsa çizer: girdi, öneri, boş kart (etkinlik boşluğu, sigorta, eSIM) ya da vize satırı. Geri kalanlar "Ekle" çipine iner.

Not: `templates.ts` gezi türü şablonu değil, "+ Ekle" sayfasındaki 18 kayıt şablonudur (uçuş, tren, otobüs, minibüs, feribot, taksi, araç, motor, karavan, bisiklet, otel, ev, etkinlik, yapılacak, restoran, eSIM, sigorta, not). `travelKinds.ts` de gezi türü değil, ulaşım türlerini ve kayıt sınıflarını tutar (kiralık mı, yerel transfer mi, sigorta mı, vize mi, iş mi). Gezi türleri `src/lib/playbooks/` altında.

### 2.2 Türler ve gerçek iskeletleri

Ortak bağlam: Boom'da 5 gece, uçuş Brüksel'e iniyor, ülke BE (`out-g1.json → skeletons`).

| Tür | Tetikleyici (`playbookFor`) | Konaklama/uçuşa ek açılan kartlar | Engellenen öneriler | Hazırlık | Sorular (en çok 3) |
|---|---|---|---|---|---|
| **festival** | Tablodaki 12 festival (afrikaburn, burningman, tomorrowland, glastonbury, coachella, sziget, ozora, primavera, roskilde, ultra, edc, lollapalooza). AI'nın adını verdiği ama yarış, fuar, hac ya da konser olmayan etkinlik. Etkinlik yokken "festival / fest / rave" sözcüğü. | Transfer: gateway'den alana, alana varılan gün. "Festival bileti": etkinlik günlerinde, resmî site notuyla. Etkinlikteki geceler varsayılan olarak "Çadır kampı · festival alanı" (stayKind camp, `noBooking`). | Etkinlik bölümü tamamen. Başlıkta tur, tekne, cruise, müze, sightseeing, günübirlik geçenler. | Çadır, Uyku tulumu, Kafa lambası, Nakit, Kulak tıkacı | Kamp / karavan / otel? (`setStay`) · Bileti aldın mı? (`markHandled`) · Kaç gün önce? (`setStartOffsetDays`, yalnız etkinlik tarihi biliniyorsa) |
| **ski** | kayak*, kayağ*, ski, snowboard. Merkez adları: Bansko, Borovets, Pamporovo, Uludağ, Palandöken, Kartalkaya, Sarıkamış, Chamonix, Zermatt, Courchevel, Verbier, Niseko, Whistler, Kitzbühel, Cortina. "sea kayaking" hariç. | Transfer, Kayak pası, Ekipman kiralama, Kayak okulu. Hepsi konaklama günleri boyunca. | — | Eldiven, Gözlük, Termal içlik, Kask, Güneş kremi | Seviye? (ileri → okul düşer) · Hangi merkez? (yalnız hedef ülkeyse; 9 ülkenin merkez listesi) · Ekipman? (kendi → kiralama düşer) |
| **honeymoon** | balayı*, honeymoon* | Transfer: MV, SC, PF, FJ'de "Deniz uçağı ya da sürat teknesi". Çift spası. Özel akşam yemeği. 17 resif ülkesinde Dalış. | — | Evlilik belgesi kopyası, resif dostu krem, şnorkel, şık kıyafet | Bütçe (3.000 / 6.000 / 10.000 € ya da yazılan tutar) · Tek resort mu, iki mi? (`splitStay`) |
| **wellness** | wellness, retreat*, yoga*, meditasyon*, inziva*, detoks*, ayurveda, spa. Tablodaki etkinliklerin adında geçmesi sayılmaz. | Program kartı (etkinliğin adı ya da "Wellness programı") ve transfer | Tur, parti, gece hayatı sözcükleri. Etkinlik en çok 1 (`few`). | Rahat kıyafet, Yoga matı, Matara, Kitap | Programa kaydın var mı? (`markHandled`) |
| **classic** | Geri kalan her şey | Yok. Yalnız "özel araç" şartı varsa "Özel transfer". | — | — | — |
| **custom** (AI) | Tür klasik çıkar ve AI kalıbında biçim varsa (kart, soru, hazırlık, konaklama türü, engel, "yalnız bu deneyim" odağı) | AI'nın en çok 6 kartı. Kart türü yalnız şu listeden olabilir: transfer, taksi, araç / karavan / motor / bisiklet kiralama, minibüs, tren, otobüs, feribot, aktivite, yapılacak, eSIM, sigorta, diğer. **Konaklama, uçuş ve restoran kartı olamaz.** Konaklama türü: otel, tekne, kamp ya da karavan; tekne ve kamp için liman / üs adı (gerçek yer, 50 karakter, deniz adı olamaz). | AI'nın engelleri. "Yalnız bu deneyim" odağında Etkinlik bölümü ve tur sözcükleri. | En çok 8 madde | En çok 3 soru, işlemler doğrulanmış |

**Tür tespiti, 48 ifade** (`out-g1.json → byPhrase`, kodla, AI yok):
- festival: Tomorrowland, Ozora, Glastonbury, Sziget, Coachella, Burning Man, "festival"
- wellness: "Bali'de yoga retreat", "wellness inzivası", "spa hafta sonu", "detoks kampı", "meditasyon"
- ski: "Bansko'da kayak", "Uludağ", "snowboard Niseko", "kayak yapmak"
- honeymoon: "Maldivler balayı", "honeymoon"
- **klasik:**
  - liveaboard dalış, "dalış turu Kaş", Akdeniz kruvaziyeri, MSC cruise
  - iş seyahati, konferans, fuar
  - Kenya safari, Tanzanya kamp
  - Interrail, İtalya yol gezisi, karavan turu
  - düğün, maraton, bekarlığa veda
  - Formula 1 Monako, Oktoberfest, Hac, Umre (tabloda olanlar da)
  - trekking, Kilimanjaro, yemek turu, konser, bisiklet turu, golf, sörf kampı, hafta sonu, günübirlik, aile tatili

### 2.3 Bilinmeyen tür gelince (fallback)

- **AI kalıp verirse** (`validModelPlaybook`) parçalar tek tek doğrulanıyor. Bilinmeyen kart türü, deniz adı olan şehir ve bozuk soru siliniyor; çökme olmuyor. Örnekler:
  - Kruvaziyer kalıbındaki "Kabin" (stay), "Uçuş" (flight) ve "İçecek paketi" (food) kartları siliniyor. Kalanlar: "Limana transfer" ve "Kıyı turları" (`out-g1.json → customCruise`).
  - Etiket boşsa kalıp hiç yok sayılıyor (`customNoLabel: null`). Tür klasik oluyor.
  - Liman adı 50 karakteri aşarsa (Llanfair…) `stayPort` null oluyor.
- **AI kalıp vermezse** tür klasik. Gezi şehir tatili gibi kuruluyor: yalnız konaklama ve uçuş açılıyor. Deniz ya da bölge adı şehir sanılıyor: "Konaklama · Kızıldeniz", "Uçuş · İstanbul → Akdeniz". Ülke kodu yoksa sigorta ve eSIM önerisi de çıkmıyor.
- **AI hiç yoksa** kod "Kızıldeniz", "Akdeniz", "Bursa", "Şile" ve 41 karakterden uzun adları yer olarak okumuyor. **Gezi hiç oluşmuyor** (`creationOf null`).
- `playbookOf("custom", null)` → classic. `playbookOf(null)` → classic.

### 2.4 Kategori (bölüm) atamasında türün etkisi yok

Gerçek çıktı (`out-g1.json → sectionByTitle`):
- Aktivite "Festival bileti" → **Etkinlik**
- Aktivite "Safari turu" → **Etkinlik**
- Aktivite "Kayak pası", "Skipass", "Ekipman kiralama", "Dalış paketi", "Kabin + yemek + dalış paketi", "Yoga dersi" → **Yapılacaklar**
- Aktivite "Vize başvurusu yap" → Belgeler (hazırlık işi)
- "Toplantı · Messe" ve "Fatura" → Yapılacaklar
- Plan türüne göre: `activity` → Yapılacaklar (ad "Etkinlik" değilse). `todo`, `note`, `other` → Yapılacaklar. `esim`, `insurance`, `prep` → Belgeler / Hazırlık. Tren, otobüs, feribot, transfer ve kiralama → Ulaşım.

Sonuç: hangi kategoriler var sorusu canlıda **sabit**. Hangi kayıt hangi kategoride sorusu **kaydın sözcüklerine** bağlı. Tür hiçbir zaman bir kategori açmıyor, kapatmıyor ya da kartın çerçevesini seçmiyor.

---

## 3. Görev 2 — Senaryo testleri

Kısaltmalar:
- Durumlar: `empty/search` = Aranıyor · `decide/options` = Karar · `book/planned` = Seçildi, alınmadı · `done` = alındı ya da ayarlandı.
- **Önerimi** "✅" ile işaretledim.
- Yeni tasarımın parçaları: niyet kutusu (76 px başlık, 196 px gövde) · çerçeve aileleri (konaklama kartı, bilet, kart sırası) · kapalı satır · Yolculuk sırasıyla (şehir bölümleri) · hero mozaik (1 büyük, 6 kare, 4 bölmeli şerit) · Pano.

### 3.A Gezi türleri

| Senaryo | Canlı mantık ne üretiyor (gerçek çıktı) | Yeni tasarımda ne olur | Kırılan / düşünülmemiş | Gereken KARAR |
|---|---|---|---|---|
| **Dalış turu: Kızıldeniz liveaboard** (tekne konaklama, yemek ve dalış tek paket) | **AI kalıplı (custom):** "Liveaboard · Hurgada" (stayKind boat, 7 gece, Seçildi, alınmadı) · Uçuş İst ⇄ Hurgada (Aranıyor) · "Limana transfer" Ulaşım'da "Havalimanı → Otel" diye adlanıyor ve başlık **"✓ 1 alındı"** · "Dalış ekipmanı kiralama" **Yapılacaklar'da done** · Hazırlık "Dalış sertifikası" · şart "İleri seviye dalgıç" · tur önerisi yok ("yalnız bu deneyim").<br>**AI var, kalıp yok:** "Konaklama · Kızıldeniz", "Uçuş · İstanbul → Kızıldeniz".<br>**AI yok:** gezi açılmıyor. | Tekne konaklama kartı çerçevesine oturur (görsel, 4 satır, yan sütun). Dalışlar ve yemek pakette olduğu için Etkinlik boş kalır ya da ayrı niyet olarak tekrar sorar. Yolculuk tek bölüm (Hurgada, 7 gece). Hero: "Kızıldeniz" fotoğrafı ve an kareleri (yemek, doğa). Dalış anı yok. | Paket ürün (konaklama, yemek, aktivite tek fiyat) hiçbir yerde modellenmemiş. AI'nın açtığı transfer "alındı" sayılıyor. Ekipman yanlış bölümde. Bindirme ve iniş günü, liman ve marina bilgisi yok. AI yoksa tür hiç anlaşılmıyor. | **K1 Paket ürün birden çok kategoriyi kaplarsa:**<br>(a) ✅ Paket ana kategoride (burada Konaklama) tek niyet. Kapsadığı ihtiyaçlar diğer kategorilerde gri "Pakete dahil · Liveaboard" satırı olarak durur. Fiyat ve onay kodu yalnız ana kartta. Bütçede tek kez sayılır.<br>(b) Ayrı "Paket" kategorisi (8. kutu).<br>(c) Paket yalnız ana kategoride görünür, diğerlerinde hiçbir şey yok. Kullanıcı "Gerek yok" der. |
| **Festival: Tomorrowland** (bilet, kamp, shuttle) | Tablo kaydı → festival. 6 gece ve tarih onayıyla:<br>· "Çadır kampı · festival alanı" (camp, noBooking → **"✓ 1 alındı"**)<br>· Uçuş İst ⇄ **Brüksel** (gateway)<br>· "Transfer · Brüksel → Boom" (Ulaşım "✓ 1 alındı")<br>· "Festival bileti" (Etkinlik, "1 bilet yok", resmî site notu)<br>· Hazırlık 5 madde<br>· Etkinlik önerileri tümden kapalı<br>"2 gün erken" cevabında Brüksel'de 2 gece açılıyor ve Ulaşım'da **aynı yol iki kez** görünüyor: boş bacak "Brüksel → Boom" ve "Transfer · Brüksel → Boom". Süre söylenmeden tarih yok, uçuş "İstanbul → **Boom**" (gateway kullanılmıyor). | Bilet Etkinlik'te tek kartlık "Planında" sırası. Öneriler sırası festival engeli yüzünden boş yuva. Kamp konaklama kartında yeşil "Alındı" fişi gibi görünür ama alınmış bir şey yok. Shuttle bilet çerçevesinde. Hero: etkinlik fotoğrafı (`eventPhotoQuery`). Etkinlikte an fotoğrafı kapalı, 6 kare dolmaz. | "Bilete dahil" kavramı yok: kamp "alındı" ile "rezervasyon gerekmez" arasında. Shuttle çift sayılıyor. Festival biletinin çerçevesi belirsiz: tekli bilet mi, çoklu etkinlik sırası mı? Mozaik için fotoğraf az. | **K2 "Dahil" durumu:**<br>(a) ✅ Yeni durum "Dahil": kum çerçeve, "bilete dahil · Festival bileti" bağlantısı. Ne karar ne alındı. Bilet alınınca birlikte yeşile döner.<br>(b) Mevcut "Ayarlandı / Sen hallettin".<br>(c) Hiç gösterme.<br>**K2b Festival bileti:**<br>(a) ✅ Türün ana bileti tekli niyet ve bilet çerçevesi (etkinlik kart sırasında değil).<br>(b) Etkinlik kart sırasında ilk kart. |
| **Wellness / yoga retreat** (konaklama, yemek ve ders tek fiyat) | wellness:<br>· "Wellness programı" (8–15 Mart) **Yapılacaklar'da "done / Güne eklendi"**<br>· Ayrıca "Konaklama · Ubud · 7 gece boş" aranıyor<br>· Transfer "✓ alındı"<br>· Uçuş "İstanbul → **Ubud**" (havalimanı DPS değil)<br>· Etkinlik önerisi en çok 1<br>· Hazırlık 4 | Konaklama'da ayrı otel niyeti "Aranıyor" kutusu, paket ise başka bir yerde. Bütçe iki kez sayılır. Program tekli seçim (fiyatı, iptali ve onayı var), kart sırası değil. | Paket konaklamayı kapsıyor ama omurga yine otel arıyor. Program "yapıldı" sayılıp karar listesinden düşüyor. | **K1 ile aynı**, artı **K3 türün ana ürünü:**<br>(a) ✅ Programı türün "ana niyeti" yap: Etkinlik'in başında konaklama kartı çerçevesi. Türün sorusuna ("Konaklama dahil mi?") verilen cevap Konaklama niyetini "Pakete dahil" yapar.<br>(b) Program konaklama sayılsın (Konaklama'da).<br>(c) İki niyet açık kalsın, kullanıcı birini "Gerek yok" yapsın. |
| **Kayak tatili** (skipass, ekipman) | ski:<br>· Transfer (Ulaşım "✓ 1 alındı")<br>· **Kayak pası, Ekipman kiralama, Kayak okulu → Yapılacaklar, üçü de "done"**<br>· Etkinlik bölümü hiç yok<br>· "İleri" cevabı okulu, "kendi ekipmanım" kiralamayı düşürüyor<br>· Uçuş "İstanbul → **Bansko**" (Sofya değil)<br>· BG para birimi tabloda yok<br>· Yalnız ülke söylenirse "Hangi merkez?" sorusu var. Sorulmadan oluşturulursa "Konaklama · Bulgaristan". | Skipass ve ekipman tekli seçim, fiyat kişi × gün. Konaklama kartı çerçevesi uygun. v82'de böyle bir tekli Etkinlik niyeti yok: Etkinlik yalnız çoklu sıra. | Tür kartının kategorisi ve çerçevesi canlıda sözcük sezgisine kalmış. Kişi başı × gün fiyat modeli yok. | **K4 Türün açtığı kartın kategorisi ve çerçevesi nereden gelir:**<br>(a) ✅ İskelet kartı kategorisini ve çerçevesini açıkça taşır (`section: activity`, `frame: card`, `pick: single`). Kanıt sözcüğü beklenmez.<br>(b) Mevcut kanıt sezgisi kalsın (skipass Yapılacaklar'da).<br>(c) Tür kartları ayrı bir "Türe özel" kutuda. |
| **Kruvaziyer** (gemi = konaklama ve ulaşım) | **Kalıpsız:** klasik; "Konaklama · **Akdeniz**", "Uçuş · İstanbul → Akdeniz". Ülke kodu yok, sigorta ve eSIM önerisi de yok.<br>**AI kalıplı (custom boat):** "Tekne · Barselona" 7 gece Barselona'da · "Limana transfer" ("✓ alındı") · "Kıyı turları" Etkinlik'te ("bilet yok") · uğranan limanlar ve ülkeler hiç yok. | Yolculuk'ta şehir bölümleri yerine tek "Barselona 7 gece". Hero mozaikte limanlar yok. Belgeler tek ülke (İspanya), oysa gemi 3–4 ülkeye uğrar. | Gece ile durak arasındaki ayrım yok: gemide uyunur, gündüz limandadır. AI yoksa deniz şehir sanılıyor. | **K5 Kruvaziyer:**<br>(a) ✅ Yerleşik "cruise" türü. Gemi Konaklama'da tek niyet (kabin). Limanlar Yolculuk'ta "gün durağı": gece yok, konaklama niyeti açılmaz. Kıyı turları liman başına Etkinlik'te. Ulaşım'da yalnız limana gidiş ve dönüş.<br>(b) Gemi Ulaşım'da bilet çerçevesiyle, geceler "Gemide" diye kapanır.<br>(c) Sadece AI kalıbına bırak (bugünkü gibi). |
| **İş seyahati** (tek şehir, toplantı, fatura) | Klasik ("fuar", "konferans" tür sayılmıyor): Uçuş İst ⇄ Frankfurt, "Konaklama · Frankfurt 2 gece", sigorta ve eSIM önerisi. Toplantı, fatura ve şirket kartı kavramı yok. | Etkinlik ile Yapılacaklar iki sabit sıra olarak boş yuvalarla yer kaplar. Hero mozaik turistik kareler ister, iş gezisinde anlamsız. Alındı modunda fatura gerekir. | Boş kategorilerin yer kaplaması. Fatura ve masraf alanı yok. | **K6 Boş ya da ilgisiz kategori:**<br>(a) ✅ İçinde niyet olmayan kategori kapalı satır olarak en alta iner ("Etkinlik · ekle"). Sabit sıra bozulmaz ama boş yuva çizilmez. Fatura alanı Alındı ayrıntısına (⋯ › Ayrıntı) eklenir.<br>(b) Yerleşik "iş" türü (toplantı kartı, fatura alanı).<br>(c) Değişiklik yok. |
| **Safari / kamp** | **Kalıpsız:** "Konaklama · **Kenya**", "Uçuş · İstanbul → Kenya". KE vizesi "Resmi kaynağa bak", para birimi tabloda yok.<br>**AI kalıplı (camp):** "Kamp · Masai Mara" **noBooking → "✓ 1 alındı"** (festival çadırı kuralı safari kampına da uygulanıyor) · Uçuş "İstanbul → Masai Mara" · "Havalimanı → Kamp" "✓ alındı" · "Safari (game drive) paketi" Yapılacaklar'da done · Hazırlık: sarıhumma aşısı, sıtma ilacı. | Kamp konaklama kartı çerçevesinde ama yanlışlıkla Alındı fişi. Küçük uçak transferi bilet çerçevesinde. Game drive paketi tekli. | Kamp "kendi çadırın" ile "işletilen lodge" arasında ayrım yok. Uçuş hedefi havalimanı değil. | **K7 Kamp:**<br>(a) ✅ `noBooking` yalnız festival kampında. Diğer kamp, tekne ve karavanlarda normal konaklama niyeti (seç / rezerve et).<br>(b) Bugünkü gibi hepsi "rezervasyon gerekmez".<br>(c) Türün sorusuna bağla ("Kampı sen mi kuruyorsun?"). |

### 3.B Rota şekli

| Senaryo | Canlı mantık ne üretiyor | Yeni tasarımda ne olur | Kırılan / düşünülmemiş | Gereken KARAR |
|---|---|---|---|---|
| **Yol gezisi** (araç kiralama, her gece başka otel, 10 şehir) | `mode: road`: tek "Araç kiralama · Milano 1–11 Mayıs", 10 ayrı 1 gecelik konaklama. **Uçuş bölümünde "Gidiş uçuşu / Dönüş uçuşu · 2 uçuş eklenmedi"** (varış ve dönüş bacakları uçuş sayılıyor). Ulaşım'da 9 şehirler arası bacak "planlanmadı" (araç zaten kapsıyor). Gezinin şeklinde bütün ara yollar **"train"**. Toplam 22 açık karar. | Konaklama'da 10 niyet kutusu (her biri 76 + 196 px, ~2.700 px). Ulaşım'da 9 boş bilet kutusu. Yolculuk'ta 10 bölüm. Mozaikte 6 kare yetmez (canlı da en çok 3 şehre fotoğraf arıyor). | Araç kapsadığı yolları kapatmıyor. Kısa konaklamalar için sabit büyük kutu fazla. "Ana yol araba" bilgisi uçuş ve tren varsayımını ezmiyor. | **K8 Kapsayan ulaşım (araç, pass):**<br>(a) ✅ Araç seçilince şehirler arası bacaklar tek satıra iner ("Araçla · ~2 sa", Ayarlandı). Yol gezisinde uçuş bacağı kullanıcı istemedikçe açılmaz. 1–2 gecelik konaklamalar kategoride kompakt satır olur (seçilince kutuya büyür).<br>(b) Her şey ayrı kutu (v82 aynen).<br>(c) Yol gezisini yalnız Yolculuk görünümüyle göster. |
| **Interrail** (6 ülke, 3–4 para birimi, farklı vize) | Onaylı rota Londra → Paris → Amsterdam → Berlin → Prag → Budapeşte: 6 konaklama, İst → Londra ve Budapeşte → İst (açık çene doğru), 5 tren bacağı boş. eSIM için tek öneri (6 ülke adıyla). Vize ülke başına doğru (GB "BK vizesi", diğerleri Schengen). Para birimleri GBP, EUR, CZK, HUF. **Ama hero (`tripFacts`) tek ülke seçiyor: GB → yalnız "BK vizesi · £ · −2 sa".** Schengen ve CZK/HUF hero'da yok. Fotoğraf anahtarları "Avrupa, Londra, Paris, Amsterdam" ve 2 an; Berlin, Prag ve Budapeşte fotoğrafsız. Gezi adı "Avrupa Gezisi". Pass kavramı yok. | v82 hero çipleri tek ülke için çizildi (Japonya · yen · A/B priz · +6 saat · Vize gerekmiyor). 6 ülkede taşar ya da yanlış olur. Belgeler'de tek vize satırı. | Çok ülke, çok para birimi, çok vize rejimi. Rail pass tek ürün olarak çok bacağı kapsıyor. | **K9 Çok ülke:**<br>(a) ✅ Hero'da tek "6 ülke" çipi; açınca tablo (ülke · vize · para · saat · priz). Belgeler'de vize rejimi başına bir niyet (BK vizesi, Schengen vizesi). Bütçe tek para biriminde, kur çipi "4 para birimi".<br>(b) Hero en çok gece geçirilen ülkeyi gösterir, gerisi Belgeler'de.<br>(c) Ülke başına sekme.<br>**K8 ile birlikte:** "Rail pass" Ulaşım'ın başında tekli niyet. Seçilince tren bacakları "Pass ile · koltuk rezervasyonu?" durumuna geçer. |
| **Hafta sonu tek şehir** (uçuş yok, otobüsle) | Kod "Bursa"yı tanımıyor (AI gerekir). AI okusa da **"otobüsle" yok sayılıyor: "Uçuş · İstanbul → Bursa" ×2** yer tutucu. Hafta sonu doğru: 23–25 Ekim, 2 gece. Yurt içi olduğu için sigorta ve eSIM önerisi yok (doğru). | Uçuş kategorisi 2 boş bilet kutusuyla "karar bekliyor". Otobüs Ulaşım'da olmalı. | Ana ulaşım biçimi (uçak, otobüs, tren, araç) başlangıçta okunmuyor. Yalnız "yol gezisi" düğmesi araç açıyor. | **K10 Ana ulaşım:**<br>(a) ✅ "Nasıl gidiyorsunuz?" okunur ya da sorulur. Uçak değilse Uçuş kategorisi açılmaz; gidiş ve dönüş Ulaşım'da bilet çerçevesinde (otobüs, tren).<br>(b) Uçuş hep açılır, kullanıcı "Gerek yok" der.<br>(c) Mesafeye göre tahmin (400 km altı uçuş açma). |
| **Günübirlik gezi** (konaklama yok) | "günübirlik" okunmuyor. AI "1 gün" dese bile **1 gece konaklama ve 2 uçuş** (İst → Şile) açılıyor. Gece sayısı en az 1. | Konaklama kategorisi boş niyetle "1 gece boş". Yolculuk'ta tek gün yerine 1 gecelik şehir. | 0 gece kavramı yok. | **K11:**<br>(a) ✅ 0 gece desteklenir: konaklama niyeti açılmaz, Konaklama satırı "Gerek yok · günübirlik". Dönüş aynı gün.<br>(b) Günübirlik desteklenmez (en az 1 gece). |
| **Açık çene** (İst → Tokyo, Osaka → İst) | Onaylı rotada (arrive Tokyo, leave Osaka) "Uçuş · İstanbul → Tokyo" ve "Uçuş · Osaka → İstanbul" doğru, 3 tren bacağı. **Rota onaylanmadıysa tek durak "Japonya": "Konaklama · Japonya 15 gece", "Uçuş · İstanbul → Japonya".** | v82'nin dört şehir bölümü ve dört konaklama niyeti yalnız onaylı rotada var. Onaysızsa Yolculuk tek "Japonya" bölümü, mozaik tek ülke. | Tasarım onaylı rota varsayıyor. Onaysız AI rotası hiç kurulmuyor. | **K12 Onaysız rota:**<br>(a) ✅ AI rotası "Önerimiz" durumunda kurulur (şehir niyetleri mor, onayla); onaylanana kadar rezervasyon düğmesi yok.<br>(b) Bugünkü gibi tek durak.<br>(c) Rota onayı zorunlu, onaysız gezi açılmaz. |
| **Aktarmalı / çok bacaklı uçuş** | **İki ayrı kayıt** (IST → DOH, DOH → HND): Uçuş'ta iki satır, "**Kısa aktarma: 50 dk (DOH)**" uyarısı, gece varış için taksi önerisi. **Tek kayıt** (stops = 1): tek satır. | Bilet çerçevesinde "1 aktarma" çipi var ama iki ayrı bilet iki niyet kutusu olur (başlıkta "İstanbul → Doha", "Doha → Tokyo"). | Niyet ile bilet ayrımı: "İstanbul → Tokyo" bir niyet ama iki bilet. | **K13:**<br>(a) ✅ Niyet = yolculuk (İstanbul → Tokyo). Bacaklar aynı kutuda iki koçan. Aktarma uyarısı çipte ve Ayrıntı'da.<br>(b) Her bacak ayrı niyet (bugünkü gibi). |
| **Gece uçuşu ve saat dilimi** (+1 gün) | 31 Mart 23:55 kalkış, 1 Nisan iniş: **31 Mart gecesi "Konaklama yok · 1 gece boş" olarak karar bekliyor.** Varış bacağı "HND havalimanı → Konaklama". Saatler yerel saat olarak saklanıyor. | Prototipte "+1" üst simgesi ve hero'da "+6 saat" çipi var. Ama uçakta geçen gece Konaklama'da "Aranıyor" kutusu olur. | "Uçakta geçen gece" kavramı yok. | **K14:**<br>(a) ✅ Kalkış ile iniş arasına düşen gece "Uçakta" diye kendiliğinden kapanır. Saat her zaman yerel, varış günü farklıysa "+1".<br>(b) Kullanıcı "Gerek yok" der. |
| **Aynı şehirde iki farklı otel** | Tokyo 1–3 (rezerve) ve 3–5 (seçildi) iki ayrı konaklama girdisi. Araya otel değişimi bacağı giriyor (boşken gizli). Gezinin şekli Tokyo'yu tek durak (4 gece) olarak birleştiriyor. | v82'de niyet = şehir ("Tokyo · 3 gece"). İki otel ya iki kutu "Tokyo" ya da bir kutuda iki seçili kart (standart bozulur). | Niyet anahtarı şehir mi, gece aralığı mı? | **K15:**<br>(a) ✅ Konaklama niyeti = gece aralığı. Aynı şehirde ikinci aralık başlıkta tarihle ayrılır ("Tokyo · 3–5 Nis"). Yolculuk'ta şehir bölümü tek, içinde "otel değişimi" adımı.<br>(b) Şehir başına tek niyet, içinde birden çok seçili kart. |

### 3.C Zaman

| Senaryo | Canlı mantık ne üretiyor | Yeni tasarımda ne olur | Kırılan / düşünülmemiş | Gereken KARAR |
|---|---|---|---|---|
| **Tarihi belli değil** ("yazın bir ara") | "yazın" okunmuyor. Tarihsiz "Konaklama · Portekiz" ve 2 tarihsiz uçuş açılıyor ("tarih yok"). Gezinin şekli (`journeyOf`) null. "Ağustos ortası" ay başı (1 Ağustos, yaklaşık) olarak okunuyor. | Hero tarih bölmesi ("16 gün · 178 gün kaldı") boş. Yolculuk sırası tarihsiz. Niyet başlıklarındaki "3 gece · 2–5 Nis" boş. | Mevsim ya da ay aralığı kavramı yok. Uçuş araması tarihsiz anlamsız. | **K16:**<br>(a) ✅ Mevsim ya da ay aralığı kabul edilir ("Haz–Ağu · ~10 gece"). Hero "Yaz 2027 · tarih seçilmedi". Uçuş niyeti "tarih bekliyor" (seçenek aranmaz). Yolculuk "esnek" etiketli şehir sırası.<br>(b) Tarih gelene kadar yalnız "Kategoriye göre" görünüm. |
| **Gezi sırasında** (bugün Kyoto günü) | Geri sayım "7. gün / 16". Biten rezervasyonlar "used" (TK52, Shibuya Sky). **Ama geçmiş Tokyo oteli hâlâ "Seçildi, alınmadı", bugünkü Kyoto hâlâ "karar".** Sigorta ve eSIM önerisi gezi sürerken de çıkıyor. Ayrı bir "bugün" modu yok. | v82 karar odaklı: Seç, Bunu seç, Pano. Gezi sırasında öne çıkması gereken erişim kartları (E-bilet aç, Haritada aç) var ama sıralama karar odaklı. | Gezi sırası modu yok. Geçmişe ait açık kararlar gürültü yapıyor. | **K17 Gezi sırasında mod:**<br>(a) ✅ Gezi başlayınca varsayılan görünüm "Yolculuk sırasıyla", bugüne kaydırılmış. Geçmiş günler katlanır. Geçmişe ait açık kararlar "Kaçtı / Gerek yok"a düşer. Alındı kartları erişim modunda (E-bilet aç, Onay e-postası aç, Haritada aç). Hero şeridi "Bugün: Kyoto · 3. gece · Sıradaki: Fushimi Inari 06:00".<br>(b) Aynı ekran, yalnız "bugün" rozeti.<br>(c) Ayrı "Gezi modu" sekmesi. |
| **Gezi bitti** | Kural önerileri bitiyor, aşamalar "used", geri sayım "Bitti". **Ama açık kalan Kyoto ve Osaka "2 karar", Tokyo "rezerve edilmedi" başlıklarda sürüyor.** | Karar sayıları ve "Sıradaki" anlamını yitirir. | Bitiş durumu yok. | **K18:**<br>(a) ✅ Bitince "anı / arşiv" modu: karar sayıları kalkar. Bütçe "harcanan"a döner (alındıların toplamı). Açık niyetler soluk. Hero "Bitti · 15 gece · €X".<br>(b) Değişmez. |
| **İptal / iade** | Hakone oteli iptal edilince aşama `cancelled`, ihtiyaç "search"e dönüyor, kayıt Gizlenenler'de, iade notu `statusNote`ta. **Ama boşalan geceler komşu açık gecelerle birleşiyor: "Kyoto konaklaması 5–16 Nisan · 11 gece". Osaka da bu bloğa yutuluyor.** Bu birleşme iptalsiz de oluyor: Kyoto seçenekli, Hakone boş, Osaka seçenekli → tek blok "Kyoto 11 gece". | v82 durum listesinde "İptal edildi" yok. Ayrıntıda yalnız "İptal ettim, değiştir / kaldır". İade takibi yok. | İptal sonrası görünür durum. İade takibi. Şehir sınırının korunması. | **K19:**<br>(a) ✅ İptal edilince niyet "Karar bekliyor"a döner. Üstte ince kırmızı şerit: "İptal edildi · iade €900 bekleniyor (14 gün)". İade gelince şerit kalkar. Gece blokları şehir sınırını korur.<br>(b) İptal edilen kart soluk hâlde seçeneklerin başında kalır.<br>(c) Yalnız Gizlenenler'de. |

### 3.D Kişiler ve para

| Senaryo | Canlı mantık ne üretiyor | Yeni tasarımda ne olur | Kırılan / düşünülmemiş | Gereken KARAR |
|---|---|---|---|---|
| **8 kişilik grup ve çocuklar** (oda dağılımı, kişi başı / toplam) | "8 kişiyiz, 4 yetişkin 4 çocuk" → count 8 ve **her kayıtta adults = 8.** Çocuk, yaş ve oda yok. Booking linki `group_adults=8&no_rooms=1`. Kişiye özel kalkış noktası (`travellers.from`) var. Paylaşımda en çok 10 üye. | v82'de "2 kişi" gezi geneliyle aynıysa niyet satırından kalkıyor. Toplam "2 kişi · €1.810". Oda dağılımı ve çocuk fiyatı yok. Pano'daki avatar ve beğeni 8 kişide kalabalıklaşır. | Oda planı. Çocuk ve yaş. Alt gruplar (iki aile). Kişi başı ile toplam fiyat. | **K20 Kalabalık grup:**<br>(a) ✅ Yolcular = yetişkin + çocuk (yaş) + oda planı ("Kimler gidiyor" penceresinde). Konaklama niyetinde "3 oda · 4 + 4". Fiyat toplam büyük, kişi başı küçük. Avatarlar en çok 3 + n.<br>(b) Yalnız kişi sayısı; oda kullanıcıya kalsın.<br>(c) Alt gruplar ayrı niyet (aile A, aile B). |
| **Tek kişi** | count 1, adults 1. Partner olmadığı için romantik an yok. Bütçede kişi başı = toplam. | "Kimler gidiyor"da tek yüz. "kim ekledi" ve beğeni rozetleri anlamsız. "1 kişi · €" tekrar eder. | Çok kişiye göre çizilmiş ögeler. | (a) ✅ Tek kişide kişi başı / toplam ikiliği, "kim ekledi" ve beğeni gizlenir (bilgi değeri yok).<br>(b) Aynen kalır. |
| **Bütçe yok** | Bütçe düzeyi null → para çipi yok. Kategori payı (`sectionAllotments`) null. Bütçe çubuğu yalnız toplamları gösteriyor. | Hero bütçe bölmesi "~€6.900 / €8.000". Kapalı satırda kategori bütçe sütunu var. | Bölme ve sütun neyle dolacak? | **K21:**<br>(a) ✅ Bütçe yokken bölmede "Tahmini ~€6.900" ve "Bütçe koy". Kapalı satırdaki sütun tahmini toplamı gösterir; yoksa "—".<br>(b) Bölme ve sütun gizlenir. |
| **Para birimi TRY / USD / JPY karışık** | Kurla gezi para birimine çevrilip toplanıyor (¥14.000 = €86,4). JPY kuru yoksa "uncounted 1" (toplama girmiyor). Bütçe JPY olabilir (çubuk JPY'de çalışıyor) **ama gösterim para birimi seçici yalnız TRY / EUR / USD / GBP.** Gezi para birimi sırası: bütçe → kullanıcının seçimi → kayıtların en sık birimi → EUR. | Tasarım her yerde € varsayıyor. Seçenekteki fiyatın hangi birimde olduğu belli değil. | Kaynak fiyat mı, çevrilmiş fiyat mı? Kur yokken ne olur? | **K22 Çok para birimi:**<br>(a) ✅ Kartta kaynak fiyat büyük (¥14.000), altında küçük "≈ €86". Bütün toplamlar gezinin tek para biriminde. Kur yoksa "kur bekleniyor" ve toplamda "+1 hesaplanmadı". Gösterim seçicisine gidilen ülkenin parası da eklenir.<br>(b) Her şey tek birime çevrilip yalnız o gösterilir. |
| **Paylaşılan gezide izleyici yetkisi** | **Rol yok.** Şemada: "Kodu bilen, o geziyi okur ve yazar". En çok 10 üye. Beğeni ve "kim ekledi" var. | Seç, Aldım, Değiştir, Rezerve et herkese açık. | İzleyici (ör. aile) için salt okunur görünüm yok. | **K23:**<br>(a) ✅ İlk sürümde rol yok, herkes düzenler. İzleyici ihtiyacı "salt okunur paylaşım bağlantısı / baskı" ile karşılanır (PrintPlan var).<br>(b) Gerçek izleyici rolü: sunucu RPC yetkisi; düğmeler gizli, yalnız "Öner" ve beğeni.<br>(c) Üye başına rol (sahip, düzenleyici, izleyici). |

### 3.E Veri hacmi, boşluk, dil

| Senaryo | Canlı mantık ne üretiyor | Yeni tasarımda ne olur | Kırılan / düşünülmemiş | Gereken KARAR |
|---|---|---|---|---|
| **Bir kategoride 30+ link** | Tokyo için 32 otel: Plan'da tek girdi (seçili Hyatt), seçenekler arkada. Pano'da konaklama 36 (`panoCounts`). Karar motoru sıralıyor (`rank`). | "4 · ilk 3, tümü Pano'da" → 3 kart ve Pano. AI uyum puanı sırası. Karşılaştırma sütunları 280 px (32 sütun yana kayar). | İlk 3'ün seçimi. 30 sütun karşılaştırması okunmaz. Benzerler tekrar eder. | **K24:**<br>(a) ✅ İlk 3 uyum puanı sırasıyla, ama en az biri "senin linkin" (Biriktirdiklerim). Pano 10'dan fazla seçenekte kümeler (bölge, fiyat bandı); karşılaştırma en çok 5 sütun, gerisi "+n".<br>(b) Son eklenen 3.<br>(c) En ucuz 3. |
| **Hiç seçenek yok** | Yer tutucular "Aranıyor", konaklama "15 gece boş". Etkinlik'te şehir başına boş kart (`activityGaps`). Sigorta ve eSIM boş kartları. **Tahmini fiyat yalnız en az 3 gerçek fiyatlı seçenekten çıkıyor** (`estRange`: "tahmin uydurma yok"). | v79 ve v82 "Aranıyor": "tahmini €90–160 / gece" ve bölge çipleri (Namba, Umeda, Shin-Osaka). Bunların veri kaynağı canlıda yok. | Tasarım ile canlı kural çelişiyor (uydurma tahmin). | **K25:**<br>(a) ✅ Tahmin yalnız kaynakla ("Booking'de bu tarihlerde ~€90–160 · 3 sonuç") ya da hiç. Bölge çipleri "✨ AI önerisi" rozetiyle.<br>(b) AI tahmini rozetle gösterilsin.<br>(c) Boş çerçevede yalnız "Kendin ara" ve "AI'dan öner". |
| **Sadece linkler var, tarih yok** | Gezinin tarihi yok → gece blokları yok, gezinin şekli null (rota şeridi yok). Her otel ayrı "1 seçenek · tarih yok" girdisi, uçuş "İstanbul → HND · tarih yok". | Niyet başlığı (şehir · gece · tarih) boş. Yolculuk çizilemez. Hero tarih bölmesi boş. | Niyet şehir ve gece aralığından kuruluyor; tarih yokken niyet ne olacak? | **K26:**<br>(a) ✅ Tarih yokken niyet = şehir (gece "?"). Yolculuk linklerin şehir sırasıyla "tarih yok" etiketli. Tarih söylenince niyetler gece aralığına bölünür.<br>(b) Tarih gelene kadar Yolculuk görünümü kapalı. |
| **Uzun ad / şehir** (Llanfairpwllgwyngyll…, Playa del Carmen) | **Llanfair… (58 harf) hem kodda hem AI okumasında reddediliyor** (`looksLikePlace`: en çok 41 karakter ve 4 kelime) → gezi açılamıyor. Model kalıbında liman en çok 50 karakter. "Playa del Carmen" → **"Playa Del Carmen"** (her kelimeye büyük harf). Uçuş "İstanbul → Playa Del Carmen" (Cancún değil). MX ülke tablosunda yok. | Niyet adı 19 px tek satır, başlık 76 px sabit. Bilet çerçevesinde şehir adı büyük. Uzun ad taşar ya da kırpılır. | Uzunluk sınırları. Büyük harf kuralı. Havalimanı olmayan yerler. | **K27:**<br>(a) ✅ Ad sınırı 80 karakter. Görünümde tek satır ve "…"; tam ad title'da ve Ayrıntı'da. Büyük harf yalnız tamamen küçük yazılmışsa. Bilet çerçevesinde şehir yoksa IATA ya da istasyon kodu.<br>(b) Sınırlar aynen kalsın. |
| **İngilizce arayüz** | Sabit metinler `L()` ile iki dilli (kayakta "Ski pass", "Airport → Hotel", "Whole trip" vb.). Kayıt adları kullanıcının dilinde kalıyor ("Shibuya Sky günbatımı"). Uçuş adında şehir ile IATA karışık ("Istanbul → HND"; Türkçede de "İstanbul → HND"). | v82 metinleri Türkçe sabit. CTA'lar Türkçe eklerle ("Booking.com'da rezerve et", "Klook'ta bilet al"). | Ekli marka cümleleri. Karışık dilde kayıtlar. | **K28:**<br>(a) ✅ CTA dile göre şablon: `{brand}'{da/de}` ↔ "Book on {brand}". Kayıt adları çevrilmez. Uçuş adında şehir adı, kod ikinci satırda (iki dilde aynı kural).<br>(b) Sadece Türkçe tasarla, İngilizceyi sonra çöz. |

---

## 4. Tasarımdan bağımsız canlı hatalar (denemede görüldü)

| # | Bulgu | Kanıt (deneme) | Yer |
|---|---|---|---|
| H1 | Türün kartları (Kayak pası, Ekipman, Okul, Wellness programı, Dalış ekipmanı, Safari paketi) Etkinlik yerine Yapılacaklar'a düşüyor ve "done / Güne eklendi" sayılıyor | 03, 04a, 04c, 01a, 08b | `booking.ts toDoBooking/ticketSays` ← `categories.sectionOfItem` |
| H2 | AI ya da türün açtığı transfer Ulaşım başlığında "✓ 1 alındı" (hiçbir şey alınmadı) | 01a, 03, 04, 06b, 08b, 02d | `categories.legState` (planned + transfer → done) |
| H3 | Festivalde "erken git" cevabında aynı yol Ulaşım'da iki kez | 02e | `playbooks/cards.transferTo` ile `legs` move bacağı |
| H4 | AI'nın "camp" kalıbında her kamp `noBooking` → safari kampı "✓ alındı" | 08b | `startCreate.placedFor` |
| H5 | Yol gezisinde Uçuş'ta "2 uçuş eklenmedi"; 9 ara yol "planlanmadı"; şekilde ara yollar "train" | 05 | `categories.sectionOfEntry` (varış ve dönüş bacağı = uçuş), `tripShape` (varsayılan train) |
| H6 | Gece uçuşunda uçakta geçen gece "Konaklama yok · 1 gece boş" | 18 | `plan.buildPlan` (gezi aralığı) |
| H7 | Sohbetteki konaklama "slot"u yokken farklı şehirlerin açık geceleri tek bloğa birleşiyor ("Kyoto 11 gece", Osaka kayboluyor) | 22, 22b | `plan.buildPlan` açık blokları |
| H8 | Gezi sırasında ve sonrasında geçmiş günlerin açık kararları sayılmaya devam ediyor; gezi sürerken sigorta ve eSIM önerisi | 21a, 21b | `categories` / `lifecycle` (geçmiş açık ihtiyaç) |
| H9 | Hero çok ülkede tek ülkeyi gösteriyor (Interrail'de yalnız BK vizesi, £, −2 sa) | g2d | `tripFacts.ts` (`mostCommon`) |
| H10 | 41 karakterden ya da 4 kelimeden uzun yer adı hem kodda hem AI okumasında reddediliyor → gezi açılamıyor | 16a | `startTrip.looksLikePlace` |
| H11 | "Playa del Carmen" → "Playa Del Carmen" | 16b | `startTrip.capitalizeWords` |
| H12 | Havalimanı olmayan yerlere uçuş yer tutucusu: Ubud, Bansko, Şile, Bursa, Masai Mara, Kızıldeniz, Akdeniz, Japonya, Kenya, Bulgaristan, Playa del Carmen | 03, 04, 11, 10b, 08, 01b, 06a, 20b | `airportsOf` (yalnız KNOWN_PLACES havalimanı) |
| H13 | "otobüsle", "günübirlik", "yazın", cümle sonundaki "2 kişi" okunmuyor; günübirlik 1 gece ve uçuş açıyor | 10b, 11, 12, g2e | `parseStartText` |
| H14 | AI yokken deniz ya da bölge hedefi okunmuyor; AI var kalıp yoksa "Konaklama · Kızıldeniz / Akdeniz"; ülke kodu yoksa sigorta ve eSIM önerisi bile çıkmıyor | 01b, 01c, 06a | `acceptExtraction`, `ruleSuggestions` |
| H15 | 4 yetişkin + 4 çocuk → adults = 8; Booking linki `no_rooms=1` | 13 | `placedFor`, `searchLinks.stayLinks` |
| H16 | Ülke bilgi tablosu 30 ülke; BG, MX, KE yok → para, saat ve priz yok | 04, 16b, 08 | `countries.ts` |
| H17 | Gösterim para birimi yalnız TRY / EUR / USD / GBP (bütçe JPY olabiliyor ama seçilemiyor) | 28 | `displayCurrency.ts` |
| H18 | Yalnız AI kalıbında: konaklama "open" iken bacak adı "Havalimanı → Otel" (tekne ya da kamp sözcüğü yalnız seçili kayıttan geliyor) | 01a | `legs.stayWordOf` |

---

## 5. Görev 3 — Genel ilkeler (önerilen kural ve neden)

| # | İlke | Önerilen kural | Neden |
|---|---|---|---|
| İ1 | **Kategoriler sabit mi, dinamik mi** | **Sabit 6 + 1 kalsın** (Uçuş, Konaklama, Ulaşım, Etkinlik ve turlar, Yapılacaklar ve restoranlar, Belgeler ve internet + Hazırlık). Tür kategori eklemez ya da çıkarmaz. İçinde niyet olmayan kategori kapalı tek satırla en alta iner. Tür ancak bir kategoriyi "Gerek yok" ile kapatabilir (günübirlikte Konaklama, otobüsle gidişte Uçuş). | Canlı zaten 8 sabit bölümle çalışıyor; kullanıcı her gezide aynı yeri bulur. "Binlerce tür" sorunu kategori sayısıyla değil, karta kategori ve çerçeve atamasıyla çözülür. |
| İ2 | **Kartın kategorisi ve çerçevesi nereden gelir** | Öncelik: (1) türün iskeleti açıkça söyler (`section`, `frame`, `pick: single/multi`); (2) kaydın plan türü (uçuş → bilet, konaklama → konaklama kartı, tren / otobüs / transfer → bilet, aktivite → kart sırası, eSIM / sigorta → konaklama kartı); (3) en son sözcük sezgisi. | H1: sezgi tek başına kayak pasını Yapılacaklar'a atıyor. Türü bilen tek yer iskelet; bilgiyi kayda yazmalı. |
| İ3 | **Çerçeve ailesi türden mi gelir** | Hayır, **ihtiyacın biçiminden** gelir. Üç aile yeter: konaklama kartı (bir yerde, bir süre: otel, tekne, kamp, eSIM, sigorta, skipass, ekipman, program); bilet (A'dan B'ye, bir saatte: uçuş, tren, otobüs, feribot, transfer, shuttle); kart sırası (çoklu toplama: etkinlik, yapılacak, restoran). Tür yalnız iskeletinde aileyi seçer. | Binlerce tür ama sınırlı sayıda biçim var. Çerçeve sabit kalırsa v82'nin "aynı boy" standardı her türde korunur. |
| İ4 | **Paket ürün birden çok kategoriyi kaplarsa** | Paket **tek ana niyet**: konaklamayı kapsıyorsa Konaklama'da, yoksa Etkinlik'te. Kapsadığı diğer ihtiyaçlar kendi kategorilerinde **"Dahil" durumu** (kum çerçeve, "Pakete dahil · X" bağlantısı) olarak görünür, bütçede sayılmaz. "Bilete dahil kamp / shuttle" da aynı durum. | Liveaboard, retreat, kruvaziyer, festival kampı ve safari paketi ortak; canlıda ya çift sayılıyor (wellness'ta otel ayrıca aranıyor) ya da yanlış yeşil ("alındı"). |
| İ5 | **Bilinmeyen tür için varsayılan** | Varsayılan **klasik**, ama yeni bir ara katmanla: **"biçim sinyalleri"** kod ya da AI ile okunur, türden bağımsızdır: ana ulaşım (uçak / otobüs / tren / araç), konaklama biçimi (otel / tekne / kamp / karavan / yok), odak (yalnız deneyim / çevresiyle), paket var mı. Klasik iskelet bu sinyallerle şekillenir. Yerleşik türlere **cruise** ve **road** eklenir; iş, safari ve dalış custom'da kalır. | Bugün AI yoksa her şey "şehir tatili". Sinyaller az sayıda ve kodla okunabilir (otobüsle, günübirlik, gemi, kamp). Binlerce tür için kalıp yazmak gerekmez. |
| İ6 | **AI'nın kurduğu şey "seçildi" ya da "alındı" sayılmaz** | Başlangıcın ya da türün açtığı her kart (transfer, kamp, program) "Aranıyor" ya da "Önerimiz" durumunda başlar. "Ayarlandı" ve "Alındı" yalnız kullanıcı eylemiyle olur. | H2 ve H4 güveni bozar: başlık "✓ alındı" diyor ama hiçbir şey alınmadı. |
| İ7 | **Niyetin anahtarı** | Konaklama niyeti = **gece aralığı** (şehir başlıkta). Ulaşım ve uçuş niyeti = **A → B yolculuğu** (bacaklar içinde). Etkinlik niyeti = **şehir** (çoklu). Tarih yokken konaklama niyeti = şehir (gece "?"). | Aynı şehirde iki otel, aktarmalı uçuş, tarihsiz linkler ve onaysız rota bu üç anahtarla tutarlı çözülüyor. H7'deki şehir birleşmesi de engellenir. |
| İ8 | **Hero mozaik fotoğrafı yoksa** | Fotoğraf sırası: (1) plandaki seçili ya da alınmış yerlerin fotoğrafı (Places); (2) biriktirilen linklerin görseli; (3) şehir ve durak fotoğrafı (canlı `photoKeys` en çok 4 yer + 3 an); (4) tür ya da tarz anı (yemek, doğa, festival kalabalığı); (5) çizim. Kare sayısı içeriğe göre: 6 karenin altına inince 3 kare ya da tek büyük kapak. Boş kare bırakılmaz. | Festival, iş seyahati ve günübirlikte 6 anlamlı kare çıkmaz; canlı da en çok 7 anahtar arıyor ve etkinlikte anı kapatıyor. |
| İ9 | **Çok ülke ve çok para birimi** | Ülke bilgisi durak başına tutulur. Hero tek ülkede çipler, çok ülkede "n ülke" çipi ve açılır tablo. Vize **rejim başına** bir niyet (Schengen tek). Fiyat kaynak birimde, toplamlar gezinin tek biriminde, kur eksikse açıkça "hesaplanmadı". | H9 (Schengen gizleniyor) ve H17. Interrail ve kruvaziyer bugünkü tek ülke varsayımını kırıyor. |
| İ10 | **Gezi sırasında mod** | Gezi başlayınca varsayılan görünüm "Yolculuk sırasıyla · bugün". Geçmişe ait açık niyetler "Kaçtı / Gerek yok"a iner. Kart eylemi duruma göre erişime döner (E-bilet aç, Haritada aç). Kurallar gezi sırasında hazırlık önerisi yapmaz. Bitince arşiv modu. | H8. v81'in "alındı = erişim modu" fikrinin gün düzeyine genişlemesi; Gün gün görünümü henüz çizilmediği için Yolculuk görünümü doğal aday. |
| İ11 | **Kalabalık grup** | Yolcular: yetişkin, çocuk (yaş) ve oda planı. Niyet satırında yalnız gezi genelinden farklıysa ("3 oda · 4 + 4", "Sabine Alicante'den"). Fiyatta toplam büyük, kişi başı küçük. Avatarlar en çok 3 + n. Tek kişide kişi ögeleri gizlenir. | H15. v82 "2 kişi"yi gezi geneliyle aynıysa sildi; aynı kural farklılık olduğunda göstermeyi de gerektirir. |
| İ12 | **Kapsayan ulaşım** (araç, rail pass, gemi) | Kapsayan ürün seçilince kapsadığı bacaklar tek satıra iner ("Araçla · ~2 sa", "Pass ile"), ayrı karar sayılmaz. Yol gezisinde uçuş bacakları kullanıcı istemedikçe açılmaz. | H5: 10 şehirlik yol gezisinde 22 karar, bunların 11'i hayalî. |

---

## 6. Emre'ye sorulacak kararlar (öncelik sırasıyla; önerim ✅)

1. **İ2 / K4. Türün açtığı kartın kategorisi ve çerçevesi iskelette yazılı olsun mu?** ✅ Evet, iskelet söyler / Sözcük sezgisi kalsın / Ayrı "Türe özel" kutu.
2. **İ4 / K1 / K2. Paket ve "dahil" durumu:** ✅ Ana niyet + diğer kategorilerde "Dahil" satırı / Ayrı Paket kategorisi / Paket yalnız tek yerde.
3. **İ6. AI ya da türün açtığı kart hangi durumda başlar?** ✅ Aranıyor ya da Önerimiz / Ayarlandı (bugünkü).
4. **İ5 / K10 / K11. Biçim sinyalleri** (ana ulaşım, konaklama biçimi, 0 gece) kodla okunsun ve kategorileri "Gerek yok" ile kapatabilsin mi? ✅ Evet / Hayır, her zaman uçuş ve konaklama açılsın.
5. **K12. Onaylanmamış AI rotası** kurulsun mu? ✅ "Önerimiz" olarak kurulsun / Tek durak (bugünkü) / Onay zorunlu.
6. **İ7 / K15. Konaklama niyetinin anahtarı:** ✅ Gece aralığı / Şehir.
7. **K13. Aktarmalı uçuş:** ✅ Tek niyet, iki koçan / Her bacak ayrı niyet.
8. **İ10 / K17 / K18. Gezi sırasında ve bitince mod:** ✅ Yolculuk · bugün varsayılan, sonra arşiv / Yalnız rozet / Ayrı sekme.
9. **İ9 / K9. Çok ülke hero ve Belgeler:** ✅ "n ülke" çipi, tablo, rejim başına vize / En çok gece geçirilen ülke / Ülke sekmeleri.
10. **İ12 / K8. Kapsayan ulaşım** (araç, pass) bacakları kapatsın mı? ✅ Evet / Hayır.
11. **K5. Kruvaziyer yerleşik tür olsun mu?** ✅ Evet (gemi Konaklama'da, limanlar gün durağı) / Gemi Ulaşım'da / AI'ya bırak.
12. **K25. Seçenek yokken tahmini fiyat:** ✅ Yalnız kaynaklı / AI tahmini rozetle / Hiç.
13. **K20 / İ11. Grup: oda ve çocuk modeli:** ✅ Yetişkin + çocuk + oda / Yalnız sayı / Alt gruplar.
14. **K23. İzleyici rolü:** ✅ Şimdilik yok, salt okunur paylaşım bağlantısı / Gerçek rol / Üye başına rol.

Daha küçük, tasarım içi kararlar: K6 boş kategori, K14 uçakta gece, K16 mevsim tarihi, K19 iptal şeridi, K21 bütçesiz bölme, K22 kaynak fiyat ve ≈ dönüşüm, K24 ilk 3 sırası, K26 tarihsiz niyet, K27 ad sınırı, K28 CTA dil şablonu, K7 kamp rezervasyonu.

## 7. Ek: yeniden çalıştırma

```
cd /tmp/claude-0/-home-user-trip-radar/71817299-ab28-5f54-8d3b-9ea0ff461203/scratchpad/research/probe
/home/user/trip-radar/node_modules/.bin/vitest run --root . -c vitest.config.mjs
node show.cjs ./out-g2a.json            # başlangıç senaryoları (01–20b)
node show.cjs ./out-g2c.json            # festival rotası, açık gece birleşmesi
```

Çıktı dosyaları: `out-g1.json` (türler, ifadeler, iskeletler, bölüm ataması), `out-g2a.json` (başlangıç senaryoları), `out-g2b.json` (pano durumları: aynı şehir, gece uçuşu, aktarma, gezi sırası, iptal, 30+ link, tarihsiz, para, grup, İngilizce), `out-g2c.json`, `out-g2d.json` (çok ülkeli hero), `out-g2e.json` (metin okuma).
