# Karar Masası: kodlanacak kararlar (22 Ekim 2026)

Tuval: "Karar Masası" (https://claude.ai/artifact/J4qBrFAJcocuyNbf7K8V4d), en üstteki "Onay paketi". Ölçüler canlının
kendi CSS'inden (`static/v82/rows.css`, `stages.css`, `drawer.css`); açık bilet ve çekmece canlıdaki gibi kalır.
Önce Uçuş; aynı dil sonra Ulaşım'ın yol satırına ve Konaklama'ya.

## Kararlar

1. **Rota uçakla.** Her yerde "Bangkok ✈ İstanbul": ok yerine uçak simgesi (satırda 15 px adın içinde, çekmecede 22 px).
2. **Tek düğme, hep sağda.** Her hâlin tek eylemi sağdaki 118 px yuvada. Kart açılınca gövdede ikinci düğme yok; yalnız
   bağlantılar (kaynak, Değiştir, Aldım).
3. **Aranıyor.** Kesik çizgili soluk kart; köşede dönen halka ve kesik "+" (bulduğunu ekle); saat ve fiyat yerinde
   yükleniyor çubukları; sağda "Kendin ara ↗".
4. **Seçenekler: deste (C).** Beyaz kart; köşede üç logolu yelpaze (26×34 kartlar, −16°, 0°, 16°), kartın altında iki
   ince lila kat (6 ve 12 px). Söz "7 seçenek"; satırda en iyisinin saati ve fiyatı ("en iyisi"). Sağda "Seç 7"
   (sayı beyaz kutuda).
5. **Seç 7 → çekmece.** Canlının 720 px çekmecesi, biniş kartları, Seç, beş yuva. Kaynak yuvası "↗" ile siteye gider.
   Kullanıcının getirdiği kart altın çerçeveli, "Senin · Kiwi'den kaydettin". En altta "+ Seninkini ekle" (bağlantı,
   ekran görüntüsü) ve dolu aramayla siteler (`providers.ts`).
6. **Seçtin: açık bilet.** Seçince çekmece kapanır, satır kendiliğinden açılır (canlıdaki açık bilet). Mor çerçeve
   (1,5 px), köşe yarım dolu, söz "Seçtin", sağda "Satın al ↗". Gövdenin altında "kaynak · Değiştir · n · ✓ Aldım";
   Değiştir aynı çekmeceyi açar, seçili olan işaretli. Kapatılabilir.
7. **Bilet alındı: koçan ve damga.** Satın al düğmesi gider; sağa yeşil koçan gelir (yırtık çizgi, iki çentik).
   Damga: yuvarlak, çift halka, dik, mürekkep yeşili; tik, "Alındı", alındığı gün; yarısı yırtık çizgiye taşar.
   Koçanda "Bileti ekle" ve ödenen (yalnız kod ya da belge desteklerse). Kart açık gelir, kapanabilir; açıkken damga
   biletin yanında büyük (96 px), altta "Son adım: bileti buraya bırak". Basılırken canlının mühür hareketi
   (`mv-stamp`).
8. **Bilet elde.** Koçanda kod ve koltuk. Açıkken "Bileti aç ↗" ve "Takvime ekle".
9. **Sözler.** Aranıyor · n seçenek · Seçtin · Bilet alındı (damgada "Alındı") · Bilet elde. Konaklamada "Rezerve" ve
   "Onay elde". Büyük harfli etiket yok.
10. **Hat bağlanır.** Tarih hattı durumu çizer: alınan bacak yeşil (4 px) ve bir öncekine kenetli, nokta dolu; seçilen
    düz mor, uçları kopuk, nokta yarım; seçenekler kesik lila; aranan noktalı gri. "Aldım" deyince çizgi uçlara akıp
    kenetlenir. (Bu, DESIGN.md'deki "hat yalnız tarihi taşır" kuralının yerini alır.)
11. **Getirme anları.** Plan'da her yerde yapıştır ve sürükle-bırak; doğru satırı biz buluruz; bırakınca okuyup ne
    düşündüğümüzü söyleriz ("önerimizden €86 pahalı"); bulamazsak Gelenler'de "Nereye koyalım?".
12. **Kategori sayacı.** "2 alındı · 1 seçildi · 2 karar"; çubuk aynı renklerde.

## Kodlama sırası

1. Satırın dili: rota ✈, sözler, tek düğme kuralı, köşe simgeleri (yarım dolu "Seçtin"), kategori sayacı
   (`lib/rowView.ts`, `app/plan/v82/IntentRow.tsx`, `modeIcons.tsx`, `static/v82/stages.css`, `rows.css`).
2. Deste ve çekmece: yelpaze ve kâğıt katları, "Seç n", çekmecede "Senin" ve "+ Seninkini ekle"
   (`IntentDrawer.tsx`, `static/v82/drawer.css`, `lib/drawerCard.ts`).
3. Seçtin ve Alındı: kendiliğinden açık bilet, Değiştir, Aldım; koçan, damga, mühür hareketi (`ProofAsk.tsx`,
   `static/v82/motion.css`).
4. Bağlanan hat: parçalar ve noktalar durumdan, kenetlenme hareketi (`lib/railDates.ts`, `rows.css`).
5. Getirme anları: yapıştır ve sürükle satıra, okuyunca söz, Gelenler.
6. Doğrulama: vitest, e2e, 390 ve 1440 ekran görüntüleri, DESIGN.md.
7. Sürüm ve yayın.

## Sonra

- Benle gezen eklenti (PLAN.md, "Sonra"): arama sayfasında rota, sonuç listesine "+", adaylar sekme grubunda.
- Aynı dil Ulaşım'ın yol satırına ve Konaklama kartına.
