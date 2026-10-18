# 0.32: eksikler, hover ×, yapılacaklar ve Fikirler sekmesi · tasarım

Kaynak: Emre'nin 0.31 sonrası geri bildirimi (2026-10-05) + bağımsız denetim (`/private/tmp/claude-501/audit/gaps.md`,
23 madde). Onaylı görseller: hero-v8, ulasim-v3, etkinlik-v4, **fikirler-v1** (`docs/mockups/2026-10-05-fikirler-v1.html`).
Önceki spec'ler (hero, plan kartları) geçerli; bu belge onları şu maddelerde değiştirir/tamamlar.

## 1. Hatalar

- **Uçuş taksi görünüyor.** Transferin seçilen türü yalnız transferin kendi kayıtlarına (`leg.options`) geçer;
  bağlandığı uçuş/tren (`leg.travel.items`) yalnız `kind === "move"` bacağında bacağın türünü alır.
  `transportMode` önce `category === "flight"` → "flight". Kalkış transferinin türü şehir değişimini ezmez.
  Test: varış transferine taksi → uçuş "flight"; "Otel → Gar" taksi → aradaki tren "train".
- **"+" şehri havalimanı kodu/istasyon dolduruyor.** `insertAt`: önce bacağın şehri, sonra `cityOfAirport(kod)`;
  dönüş uçuşundan sonra şehir boş.
- **Konaklamada "Kaldır"/"Planı kaldır" ve çekmecedeki sil geri alınamıyor; çekmece `confirm()` soruyor.**
  Hepsi aynı geri alınabilir silmeden geçer (8 sn "Geri al"), onay penceresi yok.

## 2. Silme: kartın üstüne gelince ×

- Her kayıt kartında (ulaşım, etkinlik, eSIM, sigorta, konaklama seçenek ve seçili kartları) sağ üst köşede,
  ••• düğmesinin solunda yuvarlak × (24 px, gri, üstüne gelince kırmızı). Fare kartın üstündeyken ya da kart
  odaktayken görünür; dar ekranda (≤620 px, dokunmatik) hep soluk görünür.
- Basınca kart ve belgeleri silinir, 8 sn "… silindi · Geri al" bildirimi. ••• → Sil aynen kalır.
- Transfer kartlarında × yok (silinecek kayıt yok); onlarda ••• → Gerek yok kalır. Transferin rezerve/planlı
  kaydı varsa o kaydın belge erişimi ve "Sil"i ••• menüsünde bulunur.
- Konaklama kartlarına ••• (Ele · Sil) eklenir.

## 3. Ekleme: "+" her yerde ve görünür

- Kesik çizgi + "+" kartların arasında **hep görünür**, düşük opaklıkta (.35), üstüne gelince tam; dar ekranda tam.
- Yerler: planın en başı (Varış'tan önce), her şehir bloğunun başı, her satırdan sonra. Günlük akışta her
  gün başlığında ve boş günde "+" (o günün tarihi ve şehri dolu gelir).
- Plan'da bir konaklamanın ardındaki "+" şehri doldurur, tarihi boş bırakır (gece içinde gün seçimi formda).
- Restoran/etkinlik/not formuna isteğe bağlı "Şehir" alanı (bastığın yerin şehriyle dolu).
- Ekle penceresinde "Diğer" grubuna **"Yapılacak"** karosu (rezervasyonsuz; Fikirler'e düşer).

## 4. Rezerve edilecekler ve yapılacaklar ayrımı

- `Item.booking?: "needed" | "none"` (yeni, isteğe bağlı) ve `Item.doneAt?: number` (yapıldı).
- Karar sırası: alan doluysa o. Yoksa: konaklama/ulaşım/uçuş/eSIM/sigorta → needed; etkinlik → fiyatı ya da
  bilet satan bir sağlayıcı/site (GetYourGuide, Viator, Tiqets, Klook, Musement, resmi bilet sayfası) ya da
  metinde bilet/rezervasyon/giriş ücreti/tur varsa needed, yoksa none; restoran → none (sayfası rezervasyon
  istiyorsa needed); not/yapılacak → none.
- Sayfa okuma (extract şeması) bir alan alır: "giriş bileti ya da rezervasyon gerekiyor mu" (evet/hayır/bilinmiyor).
  Sohbet aracı `plan_item` "todo" türünü tanır ("pazara gidelim" → yapılacak).
- **needed** olanlar Plan'da kart olarak kalır (bugünkü gibi) ve yapılacaklar şeridinde "Rezerve et" sayılır.
  **none** olanlar Plan'a ve "Rezerve et" sayımına girmez; Fikirler sekmesinde görünür.
- Tarihsiz, rezervasyon isteyen etkinlikler Plan'ın altında yana kayan dizi yerine **"Rezerve edilecekler · N ·
  M alındı"** başlıklı alt alta liste (etkinlik-v4 düzeni).

## 5. Fikirler sekmesi (fikirler-v1)

- Sekmeler: **Plan · Günlük akış · Fikirler**.
- İçerik: restoranlar (booking none), rezervasyonsuz etkinlikler, yapılacaklar ve notlar.
- Düzen birebir fikirler-v1: başlık "Fikirler ve yapılacaklar · rezervasyon gerekmez" ve tek satır açıklama;
  hızlı yazma kutusu; filtreler Hepsi · Yeme-içme · Yapılacaklar; şehir şehir gruplar (şehir adı + tarih aralığı;
  şehri olmayanlar en altta "Şehri belli değil").
- **Yeme-içme:** yana kayan küçük kartlar 196×120 fotoğraf; ad; "mutfak/tür · ★ puan" (bilinen kadarı); "+ Güne
  ekle" (eklenince "8 Eki akşam" koyu hap) ve harita düğmesi. Fotoğraf: kaydedilen sayfanın görseli; yoksa
  yemek ikonu karosu (Google Places yok).
- **Yapılacaklar:** tik çemberli liste; tür ikonu (fotoğraf/kamera, yürüyüş/rota, gün doğumu-batımı, alışveriş/pazar,
  müze/kitap, genel yıldız; anahtar kelimeden seçilir); başlık + gri alt satır; sağda gün hapı ya da "+ Güne ekle".
  Tik: `doneAt` dolar, üstü çizili, "Yapıldı · 12 Eki". Bilet gerektirdiği anlaşılan satırda "Rezerve edileceklere
  taşı" (booking → needed, Plan'a geçer).
- **Hızlı yazma:** yazılan cümle → yapılacak kaydı (şehir: sekmenin açık filtresi/ilk şehir değil, metinde geçen
  şehir; yoksa boş). "restoran, kafe, meyhane, yemek, kahvaltı…" geçiyorsa restoran olarak kaydolur. Yapay zekâ çağrısı yok.
- **Güne ekle:** gezinin günlerini listeleyen küçük pencere (+ restoranlarda sabah/öğle/akşam); seçince
  `dates.start` (ve saat dilimi) dolar; o gün Günlük akışta ince satır olarak görünür. Gün hapına basınca değişir/kaldırılır.
- **Harita düğmesi:** Google Haritalar arama linki (konum varsa koordinat, yoksa "ad, şehir"). Anahtar gerekmez.
- Her satırda × (üstüne gelince) → silme + Geri al.

## 6. Diğer düzeltmeler

- Künye "Yerel": ev para birimi pasaporttan (TR→TRY, DE→EUR, GB→GBP, US→USD, diğer → bütçe para birimi).
- "Sıradaki adım" fiil cümlesi: karar → "Karar ver: X", rezerve → "Rezerve et: X", planla → "Planla: X",
  iptal süresi → "X: ücretsiz iptal N gün içinde biter".
- Ulaşım kartı uçları: büyük yazı şehir (`cityOfAirport` ya da bacağın şehri), küçük satır "kod/istasyon · **saat**".
  Uzun ad siluete binmez (sütun içinde sarar, 24 px'e iner).
- Kart alt şeridi kısa kalır ("Seçildi · bilet alınmadı · 4 gün"), "…" ile kesilmez; uzun tarih uyarısı ayrıntıda.
- ulasim-v3 taslağındaki sağ üst durum hapı eski; spec (çember + alt şerit) geçerli.

## Kapsam dışı

Google Places fotoğrafları, Günlük akışın yeni görsel dile geçmesi, Fikirler'de yapay zekâ önerileri.

## Doğrulama

Birim: tür tespiti düzeltmesi, insertAt şehirleri, booking kararı (her kategori + eski kayıtlar), Fikirler gruplama/filtre,
hızlı yazma sınıflaması ve ikon seçimi, güne ekle/done, ev para birimi, sıradaki adım cümleleri.
e2e: hover × + geri al (kart ve konaklama), her "+" yerinin doğru şehir/tarihle açılması, Fikirler sekmesi
(hızlı yazma, filtre, güne ekle → Günlük akışta görünür, tik, taşı), uçuşun taksi seçimi sonrası uçuş kalması.
Ekran görüntüleri onaylı taslaklarla yan yana kontrol edilir.
