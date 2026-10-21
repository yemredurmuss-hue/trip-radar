# Uçuş, konaklama ve ulaşım satırları: kod planı (21 Eki 2026)

Kaynak: onay paketi `docs/mockups/paket-ucus-konaklama/` (dal `zaman-cizgisi-cizim`, PR #4), kararlar
`docs/mockups/ucus-karti-ozet/KARARLAR.md`. Emre 21 Ekim'de uçuş, konaklama, arama, pano ve ulaşımı onayladı.
Dal `ucus-satiri-kod`, `plan-v82-kod` (0.39.27) üstüne.

## İlke: mantık aynı, yüz yeni

`IntentBox` (seçim, çekmece, Ayrıntı, ⋯ menüsü, yerinde düzenleme, Geri al, Gerek yok katlanması, bacağın yolları)
olduğu gibi kalır. Değişen yalnız kutunun yüzü: 288 px'lik "niyet kutusu" yerine uçuş ve Yol ailesinde 72 px'lik satır,
konaklama ve Kiralama'da 120 px'lik katlanmayan kart. Durumlar `intents.ts`'in `IntentStatus`'u, sözcükler
`intentFrame.ts`'in; yeni saf mantık `src/lib/rowView.ts` ve `src/lib/railDates.ts`'te ve testli.

Dış kabuk korunur (`.q-ints > section.q-int`, `data-st`, `data-intent`, `data-kind`, kimlikler); e2e'nin bulduğu
`.q-nm`, `.q-st`, `.q-take`, `.q-cta`, `.z-carl`, `.q-pr`, `.z-mb` sınıfları anlamı aynı olan yerde kalır.

## Durum eşlemesi

| `IntentStatus` | Çizimdeki hâl | Sağdaki tek şey | Açılınca (Yol) |
| --- | --- | --- | --- |
| searching, seçenek yok | Niyet | "Ara" (çekmece; kaynak yoksa AI) | arama cümlesi, Kendin ara, Ara |
| searching/deciding, seçenek var | Biriken | "Seç" ve köşede sayı (çekmece) | Birikenler ve Yeni bul |
| suggested | Biriken, önerimiz önde | "Bunu seç" (önerimizi alır) | biniş kartı |
| chosen | Seçili | "Bileti al ↗" / "Rezerve et ↗", dönüşte "Aldın mı?" | biniş kartı, Aldım, Değiştir |
| booked | Alınmış | "✓ Alındı" / "✓ Rezerve" hapı | biniş kartı, mühür, kod, belge, check-in |
| arranged | Ayarlandı | gri hap | ne ayarlandığı, Değiştir |
| included | Dahil | gri-yeşil hap | kapsayana git |

Konaklama ve Kiralama kartı katlanmaz: karta basmak çekmeceyi açar (seçilide Değiştir hâli); rezervede Ayrıntı açılır.

## Aşamalar (her biri ayrı commit, typecheck + vitest + build)

1. **Tarih hattı.** `railDates.ts`: niyetin tarih sütunu (tek gün, gece aralığı ve gece sayısı, hafta günleri), boş ve
   çakışan geceler. `TimelineRail` tarihli kategorilerde (`flight`, `stay`, `transport`) `.q-tl`: tarih sütunu 104 px,
   nokta kategori renginde (seçili/alınmış dolu, biriken halka, niyet kesikli), konaklamada dilim ve gece çentiği,
   boş gece amber satır. Telefonda tarih kartın üstüne iner.
2. **Yol satırı.** `IntentRow` (ticket ailesi: uçuş, tren, otobüs, feribot, transfer, pass): işaret 38 px, tür satırı
   (karışık kategoride), rota, bir satır bilgi, tek rakam, 118 px yuva. Açılan gövde `FrameTicket`'in biniş kartı
   hâli (yuvadaki düğme gövdede tekrar edilmez). Aynı anda bir satır açık.
3. **Konaklama ve Kiralama kartı.** `StayRow`: fotoğraf 84 px (kaynağın fotoğrafı, yoksa illüstrasyon), şehir/tür
   satırı (seçili ve rezervede), ad, bilgi, durumun üçüncü satırı, rakam, yuva; rezervede yeşil şerit, kiralamada
   ehliyet şeridi.
4. **Yerinde.** `RouteNote`'un yeni hâli: ince satır, "Yerinde" hapı, yaklaşık fiyat; açılınca yol seçenekleri.
5. **Çekmece standardı.** Başlık üç satır (deste, ölçütler, Seçenekler/Elenen ve sıralama); konaklamada ağırlık satırı;
   konaklama kartı fotoğraf önde, puanın üç parçası, beş etiketli yuva, yorumlardan artılar ve eksiler, belirgin Seç;
   uçuş kartı puan çipi, biniş kartı, beş yuva, "Neden?"; en altta Yeni bul kutusu.
6. **Pano ve uyarılar.** Pano kartı çekmece kartı; uçuşla saat bağı, çakışan gece, Aranıyor.
7. **Doğrulama.** e2e (`scripts/e2e.mjs`) yeni yapıya göre; 1440 ve 390 px görüntüleri pakete karşı; `DESIGN.md`.

## Repo kurallarıyla uzlaşma

- `DESIGN.md`: "Türkçe büyük harfle etiket yazılmaz". Çizimdeki "TREN", "CHIANG MAI · 3 GECE" etiketleri kodda küçük,
  kalın ve renkli yazılır ("Chiang Mai · 3 gece").
- Hattaki noktanın rengi: onaylı çizimde kategori rengi, durum düğmede ve hapta. `DESIGN.md` buna göre güncellenir.
- Niyet kutusunun sabit 288 px kuralı uçuş, konaklama ve ulaşımda kalkar; Belgeler ve internet, Etkinlik, Yapılacaklar
  bu sürümde eski çerçevede kalır.
