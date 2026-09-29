# Trip Radar arayüz kuralları

Bu panonun tek işi karar vermeyi kolaylaştırmak. Her yeni ekran ve bileşen bu kurallara uyar; stiller
`static/app.css` içinde, renkler ve boşluklar oradaki değişkenlerden gelir.

## Önce karar

- Bir bakışta üç şey görünür: **ne kaldı** (yapılacaklar şeridi: Karar ver / Rezerve et / Planla / ⏳), **ne öneriliyor** (tek satır öneri), **neden**
  (kartın solunda artılar, sağında eksiler). Gerisi bir dokunuş ötededir: kartın "Detaylar"ı, sonra
  "Tüm detaylar".
- Aynı şey iki yerde söylenmez. Öneri tek satırdır; uzun gerekçe Karşılaştır'da durur.
- 2–3 seçenek yan yana durur, kaydırılmaz; fazlası "+N seçenek daha" arkasındadır.
- Kapalı kartlar aynı boydadır; ad, fiyat ve artı/eksiler aynı hizada okunur.
- Seçim yapılınca artı/eksi kalkar: karşılaştırma bitmiştir, kart sade durur.

## Renklerin tek anlamı var

| Renk | Anlamı | Nerede |
| --- | --- | --- |
| Yeşil `#1f8f4e` | Rezerve edildi, bilet alındı; artı | Durum şeridi, ✓ rozeti, artı işareti |
| Amber `#f0a53a` | Seçildi ya da planlanıyor, henüz rezerve değil | Durum şeridi, "rezerve edilmedi" uyarısı |
| Kırmızı `#d9534f` / `--danger` | Eksi, risk, elendi, süresi dolmak üzere | Eksi işareti, eleme sebebi, iptal uyarısı |
| Mavi `--accent` | Yalnız öneri ve link | Öneri satırı, önerilen kartın çerçevesi, linkler |
| Gri, kesikli çizgi | Henüz planlanmadı, boş | "Planlanmadı" kartı, boş gün |

Durum hiçbir yerde yalnız renkle anlatılmaz: yanında hep yazısı olur ("Bilet alındı", "Planlanıyor").
★ yalnız gezginin kendi önceliğine dokunan satırı işaretler (söylediği ya da ayarladığı); varsayılanlar
yıldız almaz.

## Gün, saat saat

- Rezervasyon gerektiren her şey (uçuş, tren, taksi/transfer, etkinlik, restoran, araç kiralama) o günün içinde,
  kendi saatinde kendi kartıdır. Rezerve edilince de kart kalır, yeşil olur; satıra küçülmez.
- Bilgi (check-in, check-out, metroyla/yürüyerek gidiş, araç iadesi) ince satırdır; kartı ve düğmesi yoktur.
- Bir şey iki yerde yazılmaz: ayrı bir "akış" listesi yok, gün zaten saat sırasıdır.
- Otel şehrin başında bir kez; araç kiralama alış gününün kartı.
- Saat solda: kayıttan gelen düz, alışılmış ya da hesaplanan "~"; altına açıklama yazılmaz, bilinmeyen boş.
- Hiza: noktası gezinin çizgisinde, saati gün etiketinin hizasında; kartlar panodaki her kartın başladığı
  sütundan başlar, ayrıca içeri girmez.
- Günler açılır, kapanır: işi kalan açık gelir ("3 iş"), hepsi hazır olan tek satıra katlanır.

## Azaltmak

- Hiçbir şey silinmez, önden kalkar: **Ele** (Elenenler), **Gerek yok** (Gizlenenler / Geri al). Sayılar ve
  yapılacaklar yalnız öndekini sayar.
- Seçili karta dokunmak diğer seçenekleri açar; ayrıntı ⓘ'dadır.

## Butonlar

- **Ana eylem** (Seç, Rezerve ettim): koyu dolgu (`--ink`), beyaz yazı, yuvarlak. Bir alanda en fazla bir tane.
- **İkincil** (Geri al, Değiştir, Yine de seç): beyaz, ince çerçeve.
- **Link** (Karşılaştır →, Detaylar ▾, Tüm detaylar): mavi yazı, çerçevesiz.
- **Sessiz** (Ele, Gerek yok): gri yazı, üstüne gelince kırmızı; ana butonun yanında küçük durur.

## Yazı

Ölçek: 40 gezi adı · 22 şehir · 17 kart başlığı · 15 metin · 13–14 kart satırı · 12.5 not. Türkçe
büyük harfle etiket yazılmaz (İ/i sorun çıkarır); etiketler küçük ve gri olur.

## Okunurluk

- Gri yazı `--muted` (`#6b665f`); daha açık gri bej zeminde okunmaz, kullanılmaz.
- Kart satırları kesilmez ("…" yok), sarar; kartlar yan yana yine aynı boyda durur.
- Sayılar hizalı durur (`font-variant-numeric: tabular-nums`).

## Dil

- Kısa ve şehirlerle: "Porto → Madeira", "Karar ver 3", "Ücretsiz iptal için 6 gün kaldı".
- Özet satırı bilet gibi: ne → ne ("Havalimanı → Otel"), adlar ve saat alt satırda, notlar açınca.
- Artı/eksi birkaç kelimedir; sayfada okunan somut şey kendi sözleriyle yazar ("Karşısında genelev var").
- Uydurma yok: fiyat, saat, süre yalnız kayıttan ya da hesaptan gelir.
