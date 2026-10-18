# Gezi hero'su: tasarım

Onaylı görsel: [`docs/mockups/2026-10-05-hero-v8.html`](../../mockups/2026-10-05-hero-v8.html) (Emre, 2026-10-05).
Bu belge o görseli koda çevirmek için gereken kararları tutar.

## Amaç

Panonun üst kısmı tek bakışta üç şeyi söyler: gezi ne (fotoğraf, ad, açıklama), ne durumda (onaylananlar,
bütçe, sıradaki adım), bilmem gereken ne (tarih, kalkış, yolcu, vize, kur, saat). Bugünkü küçük resim +
hap sayaçları + ayrı bütçe çubuğu + ayrı yapılacaklar şeridi + ayrı "Seni böyle anladım" kartı bu tek
bloğa toplanır. Hiçbir mevcut bilgi kaybolmaz; yeri değişir.

## Yerleşim

İki sütun (geniş ekran): solda hikâye, sağda künye sütunu; ikisi aynı boyda. 760 px altında tek sütun,
künye hikâyenin altına iner.

### Sol sütun

1. **Fotoğraf** (300 px, dar ekranda 200 px, köşe 22): tek yatay fotoğraf.
   - Üstte solda şehir seçici ("Porto | Madeira"), rota sırasıyla; 6 sn'de bir kendiliğinden geçer, dokunmak durdurup yeniden başlatır.
   - Üstte sağda: işleniyor hapı (yalnız iş varken: "2 kayıt işleniyor", dar ekranda yalnız dönen simge) ve ••• menüsü.
   - Fotoğrafçı adı `title`'da (Pexels şartı değil ama nezaket).
2. **Etiket** fotoğrafın altına biner: saat simgesi + geri sayım + rota linki.
   - Geri sayım: başlamadan "N gün kaldı" (0 ise "Bugün"), sürerken "N. gün / T", bittiyse "Bitti". Tarih yoksa geri sayım yazılmaz.
   - Rota: şehirler gece sırasıyla "Porto → Madeira ↗", Google Haritalar rota linki (bugünkü `routeUrl`). Link yoksa düz yazı.
3. **Başlık** 40 px.
4. **Açıklama** 17 px, tek paragraf: AI'nin yazdığı ton cümlesi + koddan gelen durum cümlesi.
   - Ton cümlesi: kullanıcının LLM sağlayıcısıyla, yalnız şehir listesi değişince yeniden yazılır; en fazla 120 karakter, rakam içeremez (içerirse atılır). Anahtar yoksa ya da hata olursa yalnız durum cümlesi kalır.
   - Durum cümlesi: kod kurar ("Uçuşlar hazır, Madeira'da bir konaklama kararın bekliyor."). Uydurma yok.
5. **Onaylananlar kutusu**: gri zemin, 4 eşit bölme, ince ayırıcı. Her bölme: kategori renginde ikon, büyük rakam (22), gri etiket.
   Yalnız seçilen ya da rezerve olanlar sayılır (4/4 değil, "4"). Sıfır olan bölme gösterilmez; hepsi sıfırsa kutu yok.
   Dar ekranda 2×2.
6. **Seni böyle anladım** satırı: kıvılcım simgesi + "Seni böyle anladım" + ilk üç konunun kısa adı + bekleyen soru varsa "· 1 soru" ve mor nokta + aşağı ok.
   Tıklayınca sayfayı itmeyen açılır pencere (dar ekranda satırın altında açılır):
   - Her giriş: kapsam etiketi (Tüm gezi / kategori adı / ilanın adı) + metin + gri kaynak ("söylediğin", "not", "şart", "onayladın") + ×.
   - Bekleyen soru (Evet koyu, Hayır çerçeveli).
   - Alt not: "Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter."
   - Hiç giriş ve soru yoksa satır gri tek cümle: "Konuştukça ve seçtikçe seni tanıyacağım."
   Mantık bugünkü `IntentCard` girişleriyle aynı; yalnız görünüm değişir.

### Sağ sütun (künye)

Gri zemin, köşe 22. Satırlar sütun boyunca eşit dağılır. Her satır: çizgi ikon (tek renk) · küçük gri etiket · büyük değer · gerekirse gri ikinci satır.
Bilinmeyen satır gösterilmez (uydurma yok).

| Satır | Değer | Kaynak | İkinci satır |
| --- | --- | --- | --- |
| Tarihler | "7–18 Ekim 2026 · 12 gün" | `plan.range` / onaylı tarih / kayıtlardan tahmin | Tahminse "~tahmini · kayıtlardan" |
| Kalkış | "İstanbul" | gidiş uçuşunun kalkış şehri | — |
| Yolcu | "2 yetişkin" | kayıtların kişi sayısı (en sık görülen) | Paylaşılıyorsa "Sabine ile paylaşılıyor · 2 dk önce" (bugünkü ShareStatus) |
| Vize | "Schengen vizesi ↗" | Ayarlar'daki pasaport (varsayılan TR) + kodda tarihli tablo | — ; etikette pasaport, `title`'da kontrol tarihi |
| Yerel | "€1 = ₺38,20 · −2 saat" | kur modülü + gezi tarihindeki saat farkı (Intl, yaz saati dahil) | — ; `title`'da dil ve priz |
| Bütçe | "₺79.470 / ₺100.000" | `budgetBar` + kategori kırılımı | İnce çok renkli çubuk |

- **Vize**: TR pasaportu için ülke → kural tablosu (`lib/visa.ts`), her kayıtta kontrol tarihi ve resmi link (konsolosluk.gov.tr). Tabloda olmayan ülke ya da başka pasaport: "Resmi kaynağa bak ↗". Ayarlar'a "Pasaport" alanı eklenir.
- **Dil, priz, saat dilimi**: ülke tablosu (`lib/countries.ts`), iki dilli, kodda sabit.
- **Bütçe çubuğu**: tam genişlik = bütçe (yoksa bilinen toplam). Dilimler kategori renginde, 2 px boşlukla; kalan gri iz. Dilimin `title`'ı tutar.
  Satıra tıklayınca pencere: dört kategori + tutar, ayırıcı, "Kalan ₺X", altında tek gri not (karar bekleyen tahmin varsa "X seçilince yaklaşık ₺Y daha eklenir"; sayılamayan fiyat varsa "N fiyat sayılamadı").
  Bütçe aşılırsa değerin yanında kırmızı "₺X aşıyor". Bütçe yoksa etiket "Bilinen toplam", değer yalnız toplam.
- **Sıradaki adım** (koyu buton, sütunun altı): yapılacaklar listesinin ilki ("Madeira konaklamasını seç →"), tıklayınca o karta gider.
  Hiç iş kalmadıysa "Bu geziyi paylaş". Altında sessiz satır: "Karar ver 3 · Rezerve et 1 · Planla 4 · ⏳ 2"; sayıya tıklamak bugünkü
  yapılacaklar listesini hero'nun altında açar. Sıfır olan yazılmaz.

### ••• menüsü

Link ya da ekran görüntüsü ekle · Bu geziyi paylaş (paylaşılıyorsa "Paylaşım kodu") · Rotayı haritada gör · ayırıcı ·
Bu gezide yeni sohbet başlat · Ayarlar · (örnek gezi yükle, demo yoksa) · ayırıcı · Bu geziyi sil (kırmızı).

## Renk ve yazı

- Yazı ölçeği: 40 başlık · 22 özet rakamı · 17 metin/değer · 15 küçük satır · 13 etiket.
- Metin renkleri: `--ink #1d1d1f`, `--gray #6e6e73`; çizgi `#e8e8ed`; gri zemin `#f5f5f7`.
- Kategori renkleri yalnız onaylananlar ikonlarında ve bütçe çubuğunda: uçuş `#6a4fe0`, konaklama `#23998b`,
  araç/ulaşım `#c58a2e`, etkinlik `#a8336f` (renk körlüğü denetiminden geçti). DESIGN.md renk tablosuna satır eklenir.
- Durum renkleri (yeşil/amber/kırmızı) hero'da kullanılmaz; kırmızı yalnız "aşıyor" ve menüde "sil".

## Fotoğraflar

- Kaynak: Pexels, Supabase'de (`sistem-fabrikasi`) bir aracı fonksiyon üzerinden. Anahtar yalnız sunucuda (repo herkese açık, eklenti paketi okunabilir).
  Fonksiyon şehir adına göre ilk yatay fotoğrafı döndürür ve önbelleğe alır.
- Yedek: Wikipedia özet görseli; bayrak, arma, harita, `.svg` elenir (Madeira özetinin görseli bayrak çıkıyordu).
- Gezi şehir başına fotoğrafı `trip.cityImages` içinde saklar; bir kez çekilir. Fotoğraf yoksa gri zemin.

## Boş ve uç hâller

- Tarih yok: geri sayım yok, Tarihler satırı yok, açıklama "Tarih ve şehir, kaydettikçe netleşir".
- Şehir yok: şehir seçici yok, fotoğraf gri; etiket yalnız geri sayımla ya da hiç gösterilmez.
- Tek şehir: şehir seçici yok, otomatik geçiş yok.
- Gezi sürüyor/bitti: geri sayım hâli değişir; başka şey değişmez.
- Paylaşılan gezide (davetli taraf) her şey aynı; sil yerine "Paylaşımdan ayrıl" bugünkü davranış neyse o.

## Kapsam dışı

Gezilerim listesi kartları, plan/günlük akış kartları, ulaşım kartları (ayrı tasarım), lavanta zeminin uygulamaya yayılması.

## Doğrulama

- Birim testleri: geri sayım üç hâli + tarih yok; künye satırlarının veri yokken gizlenmesi; kategori kırılımı toplamı = bugünkü bilinen toplam;
  ton cümlesinde rakam reddi; Wikipedia görsel elemesi (bayrak/svg); vize tablosu bulunmayan ülke.
- e2e: Türkçe ve İngilizce hero ekran görüntüsü; `scripts/e2e.mjs:159` kırık beklentisi bu turda onarılır.
- Mevcut testler yeşil kalır.
