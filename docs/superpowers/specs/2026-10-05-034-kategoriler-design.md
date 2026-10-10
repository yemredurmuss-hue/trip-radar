# 0.34: Plan kategorilere göre · tasarım

Kaynak: Emre, 2026-10-05. Görsel: `docs/mockups/2026-10-05-kategoriler-v2.html` (gerçek kartlarla) + bu belgedeki
"kategori içi zaman çizelgesi" eki. Günlük akış bu sürümde değişmez (0.35: `gunluk-akis-v3`).

## Sekmeler

Plan · Günlük akış. Fikirler sekmesi kalkar; içeriği Plan'daki "Yapılacak şeyler" ve "Restoranlar" bölümlerine geçer.

## Bölümler (bu sırayla)

1. **Uçuş** — bütün uçuşlar (gidiş, şehir değişimi, dönüş), seçenekleriyle.
2. **Konaklama** — bütün konaklamalar ve gece blokları (rezerve, seçili, seçenekli, ayrı konaklama, boş geceler).
3. **Ulaşım** — tren, otobüs, minibüs, vapur, taksi/transfer, kiralamalar ve transfer bacakları (leg kartları).
4. **Etkinlikler** — rezervasyonlu deneyimler (booking needed: tur, konser, bilet).
5. **Yapılacak şeyler** — rezervasyonsuz yerler ve işler (booking none: müze, görülecek yer, not, Maps/Reels/Pinterest/blog'dan gelenler).
6. **Restoranlar** — kaydedilen restoranlar (rezervasyonlu restoran da burada; durumu kartında).
7. **Diğer** — sigorta ve internet (eSIM).

Boş bölüm gösterilmez; yalnız başlık satırı + "+ Ekle" olarak en altta "Ekle" menüsüyle ulaşılır (gereksiz kalabalık olmasın).

## Bölüm kabuğu (v2 taslağı)

- Kendi açık renk zemini (`color-mix(var(--c) 7%, #fff)`, çizgi %16), köşe 22. Renkler: uçuş #6a4fe0, konaklama #23998b,
  ulaşım #2563c9, etkinlik #a8336f, yapılacak #5d8a1c, restoran #b4532a, diğer #3b6fd1.
- Başlık: renkli ikon karesi · ad · sayı · durum hapı (amber: "1 karar bekliyor", "1 gece boş", "1 bilet yok",
  "2 güne eklenmedi"; yeşil: "✓ 3 alındı") · sağda "+ Ekle" (o bölümün şablonlarıyla anında ekler) · aç/kapa oku.
- Başlığa tıklamak açar/kapar. İlk açılış: işi kalan bölüm açık, hepsi tamam olan kapalı. Kullanıcının seçimi gezi
  başına hatırlanır (`localStorage`, try/catch).
- **Kapalı:** her kayıt tek ince satır: çember · ad · şehir · tarih · saat · fiyat · durum. Satıra basınca bölüm açılır
  ve o karta kayar. Hiçbir kayıt gizlenmez.

## Bölüm içi zaman çizelgesi

- Açık bölümün içi bir zaman çizelgesidir: solda dar tarih sütunu (gün "9 Eki", altında hafta günü ve şehir), ortada
  ince dikey çizgi ve noktalar, sağda kartlar. Aynı gündeki kayıtlar tek tarih etiketi altında alt alta, saat sırasıyla.
- Sıra: tarihe göre (konaklamada giriş, kiralamada başlangıç), sonra saate göre. Tarihi olmayanlar en sonda
  "Tarihsiz" etiketi altında, şehre göre gruplu.
- Dar ekranda (≤620 px panel) tarih sütunu kartın üstüne tek satır olarak iner.
- İçerideki kartlar onaylı tasarımların kendisidir (siluetli ulaşım, medya kartı, konaklama kartları, leg kartı,
  ×, yerinde düzenleme, belge hapı, seçenek gezgini). Kart iç tasarımı değişmez.
- "+" ara noktaları bölüm içinde kartların arasında kalır ve o bölümün türüyle, o günün tarih/şehriyle anında ekler.

## Yapılacak şeyler

- fikirler-v1'in tikli liste satırları (tik, ikon, ad, gri alt satır: şehir · kaynak, sağda gün hapı / "+ Güne ekle", ×),
  zaman çizelgesi içinde: güne eklenmişler kendi tarihinde, eklenmemişler "Tarihsiz" altında şehre göre.
- Hızlı yazma kutusu bölümün başında ("Bir şey yaz… ör. Dom Luís köprüsünden gün batımı").
- Kaynak alt satırda: Maps / Instagram (Reels) / Pinterest / blog / not (kaydedilen sayfanın alan adından; yoksa yazılmaz).

## Restoranlar

- Fotoğraflı kart (zaman çizelgesi içinde, aynı gündekiler yan yana kaydırılır): 200×124 fotoğraf (kaydedilen sayfanın
  görseli; yoksa yemek ikonu karosu), ad (kalın), "mutfak/tür · ★ puan (yorum sayısı)" (bilinen kadarı, uydurma yok),
  şehir, gün hapı ("8 Eki akşam") ya da "+ Güne ekle", harita düğmesi, ×, ad yerinde düzenlenir.
- Rezervasyonlu restoranda alt satırda durum (Rezerve et / ✓ Rezerve).

## Kapsam dışı

Günlük akış yeniden tasarımı (0.35), Google Places fotoğrafları.

## Doğrulama

Birim: kayıt → bölüm eşlemesi (her tür, eski kayıtlar, leg'ler, gece blokları), bölüm içi sıralama (tarih, saat,
tarihsiz/şehir), başlık durum metni, varsayılan açık/kapalı. e2e (headless): yedi bölüm sırası, aç/kapa + hatırlama,
kapalı satıra basınca açılma ve kaydırma, bölüm "+ Ekle", restoran kartı, yapılacak hızlı yazma, eski özelliklerin
(×+geri al, yerinde düzenleme, belge, seçenek gezgini) bölüm içinde çalışması; 1440 ve 560 ekran görüntüleri.
