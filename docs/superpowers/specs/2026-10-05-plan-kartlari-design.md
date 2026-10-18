# Plan kartları: ulaşım, etkinlik, eSIM, sigorta · tasarım

Onaylı görseller (Emre, 2026-10-05):
- Ulaşım: [`docs/mockups/2026-10-05-ulasim-v3.html`](../../mockups/2026-10-05-ulasim-v3.html)
- Etkinlik, eSIM, sigorta: [`docs/mockups/2026-10-05-etkinlik-v4.html`](../../mockups/2026-10-05-etkinlik-v4.html)

Bu belge Plan görünümündeki kararı ve rezervasyonu olan kartların yeni hâlini tanımlar. Günlük akış
görünümü, Karşılaştır ekranı ve konaklama kartları kapsam dışı (konaklama kartı bugünkü hâliyle kalır,
yalnız durum çemberi ve belge erişimi ona da eklenir).

## Ortak kabuk (her kart)

- **Zemin durumu söyler:** sarı-bej `#fbf6ea` (çizgi `#efe2c3`) = alınmadı (seçenek ya da seçildi);
  yeşil `#eef8f1` (çizgi `#cfe8d7`) = alındı/rezerve. Taksi/transfer ve metro gibi rezervasyon istemeyenler
  "Planlandı" olunca yeşil.
- **Üst satır (24 px):** durum çemberi · tür (kendi renginde ikon + ad) · tarih[· saat] | belge erişimi · •••
  - Çember: kesikli boş (karar bekliyor) · amber çember (seçildi, alınmadı) · yeşil dolu + ✓ (alındı/planlandı).
  - Belge erişimi: belge varsa beyaz hap "📄 ad.pdf +N" (dar ekranda yalnız ikon + sayı), basınca açılır;
    yoksa soluk ataç, basınca dosya seçici (PDF, görsel).
- **Gövde:** türe göre (aşağıda).
- **Alt şerit (48 px, yarı saydam beyaz):** solda durum yazısı ya da seçenek gezgini (‹ 1/2 ›), sağda fiyat +
  tek eylem. Durum yazısı yalnız burada; sağ üstte durum hapı yok.
- **Dokununca** kart açılır: ayrıntı paneli (beyaz, kartın içinde): saatler, işletme, fiyat kırılımı, neden
  önerildiği (2.'ye göre farkı), istediklerin (✓/✕/?), artı/eksiler; bağlantılar: Karşılaştır →, Kaydettiğin
  sayfa ↗, Belge ekle, Sil. Mevcut karar kartındaki bilgilerin hiçbiri kaybolmaz; ön yüzden ayrıntıya taşınır.
- **••• menüsü:** Düzenle (yalnız elle eklenen/sohbet planı), Gerek yok (gizle), Ele (yalnız seçenekler), Sil.
- Yazı: 30 şehir (ulaşım) · 20 başlık (medya kartları) · 15 metin · 13 ikincil · fiyat 17.

## Eylemler (türe göre)

| Tür | Seçenekken | Seçilince | Alınınca |
| --- | --- | --- | --- |
| Uçuş, tren, otobüs, minibüs, vapur | Plana seç | Bileti aldım | ✓ Alındı · varsa PNR |
| Araç, motosiklet, karavan, bisiklet kiralama | Plana seç | Rezerve ettim | ✓ Rezerve |
| Taksi · transfer | — | ✓ Planlandı (rezervasyon gerekmez, buton yok) | — |
| Etkinlik | Plana seç | Bileti aldım | ✓ Alındı · buluşma |
| eSIM | Plana seç | Satın aldım | Alındı · kurulmadı → Kurdum → ✓ Kuruldu |
| Sigorta | Plana seç | Poliçe aldım | ✓ Alındı |

"Kurdum" (eSIM) yeni bir alt durum: `Item.installedAt?: number`. Diğer eylemler bugünkü durumlara (saved →
chosen → booked) karşılık gelir.

## Ulaşım kartı

- Gövde: solda kalkış şehri (30, kalın) + altında durak/kod · **saat**; sağda varış şehri, aynı düzen, sağa
  hizalı; ortada türün **noktalı siluet çizimi** (türün renginde, kenarları solan maske) ve altında süre.
- Kiralık türlerde sağ taraf "3 gün" / "Aynı yere iade"; sol taraf teslim yeri · tarih.
- 10 tür ve renkleri: uçuş `#6a4fe0`, tren `#2563c9`, otobüs `#d9480f`, minibüs `#e8890c`, vapur `#0e8fb0`,
  taksi·transfer `#d29a00`, araç kiralama `#475467`, motosiklet `#c0256b`, karavan `#8a6534`, bisiklet `#5d8a1c`.
  Siluetler ve ikonlar onaylı ulaşım taslağındaki SVG'lerin birebir kopyası.
- **Tür tespiti** (veri modeline alan eklemeden, sırayla): `item.plannedKind` → bacak seçimi (`Trip.legs[key].mode`)
  → kategori `flight` → metinden (`travelKinds.ts` kalıpları genişletilir: tren, otobüs, minibüs/dolmuş,
  vapur/feribot, taksi/transfer, araç kiralama, motosiklet/scooter, karavan/kamp aracı, bisiklet) → bilinmiyorsa
  "Ulaşım" (gri `#6e6e73`, genel ok ikonu, siluet yok).

## Medya kartı (etkinlik, eSIM, sigorta)

- Gövde ızgarası: solda 176×128 görsel (dar ekranda tam genişlik, 168 yükseklik), sağda başlık (20) + bilgi
  satırı (yer · **saat** · süre · kişi) + kaynak satırı (★ puan · yorum sayısı · site ↗).
- Görsel: etkinlikte kayıttaki fotoğraf (`imageUrl`), yoksa türün noktalı siluet çizimi (müze/bilet).
  Uyum puanı fotoğrafın sağ üst köşesinde (önerilen seçenekte mavi).
- eSIM: başlık "10 GB · Portekiz" (`metrics.dataGb`, ülke), bilgi "15 gün" (`validityDays`), kaynak satırı sağlayıcı + site.
- Sigorta: başlık "Seyahat sağlık sigortası" (kayıttaki ad), bilgi "2 kişi · 12 gün", kaynak satırı şirket + puan + site.
  Teminat gösterilmez. Sigorta için yeni kategori açılmaz; `ERRAND` kalıbından `isInsurance()` türetilir.
- Renkler: etkinlik `#a8336f`, eSIM `#3b6fd1`, sigorta `#0f8a6a`.

## Belgeler

- Yeni IndexedDB deposu `docs`: `{ id, itemId, tripId, name, type, size, blob, addedAt }`. Yalnız yerel;
  paylaşım eşitlemesine ve dışa aktarmaya girmez (dışa aktarmada adları listelenebilir, içerik yok).
- Ekleme: kartın ataç ikonu ya da ayrıntıdaki "Belge ekle" → dosya seçici (PDF, PNG, JPG, HEIC; 15 MB sınır).
  Sohbete PDF sürüklemek kapsam dışı.
- Açma: hap → tek belge ise yeni sekmede `URL.createObjectURL`; birden fazlaysa küçük liste penceresi
  (ad, boyut, aç, sil).
- Kart silinince belgeleri de silinir.

## Silme ve geri alma

- ••• → Sil her kartta. Onay penceresi yok; 8 saniyelik "… silindi · Geri al" bildirimi.
- Geri al, silinen kaydı ve belgelerini olduğu gibi geri koyar (silmeden önce bellekte tutulur).
- Kaydedilen sayfadan gelen seçeneklerde "Ele" (karşılaştırmadan çıkar, Elenenler'de kalır) ayrıca durur;
  "Sil" kalıcıdır. DESIGN.md'deki "Hiçbir şey silinmez" kuralı buna göre güncellenir.

## Şablondan ekleme

- Plan başlığının sağında "+ Ekle" ve iki kartın arasında üstüne gelince çıkan "+" → "Ne eklemek istersin?" penceresi.
- Pencerede gruplar: Ulaşım (10 tür) · Kalacak yer (Otel, Ev·daire) · Diğer (Etkinlik·tur, Restoran, eSIM, Sigorta, Not).
- Seçince kısa form (türe göre): ulaşımda Nereden, Nereye, Tarih, Saat, Fiyat (isteğe bağlı); kiralıkta Yer,
  Başlangıç, Bitiş, Fiyat; diğerlerinde Ad, Tarih, Fiyat. Bastığın yerin şehri ve tarihi önceden dolu gelir.
- Kaydedince kayıt, sohbette söylenen planlarla aynı yoldan (`plannedItem`, `origin: "chat"` ya da yeni
  `origin: "manual"`) "Planlanıyor" olarak oluşur; sonradan aynı şey için sayfa kaydedilirse birleşir.

## Kapsam dışı (sonraki sürüm)

Fikirler sekmesi (restoranlar ve yapılacaklar; onaylı v1 taslağındaki tasarım), Günlük akış'ın yeni dile
geçmesi, Google Places fotoğrafları.

## Doğrulama

- Birim: tür tespiti (her tür + bilinmeyen), durum çemberi/eylem tablosu, belge deposu (ekle/listele/sil,
  kart silinince belgeler), silme + geri alma, şablon formunun ürettiği kayıt.
- e2e: örnek gezide Plan görünümü ekran görüntüsü (geniş + dar), bir kartı açma, belge ekleme, silme + geri alma.
- Mevcut testler yeşil kalır.
