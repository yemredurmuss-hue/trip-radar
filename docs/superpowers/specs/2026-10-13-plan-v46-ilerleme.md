# Plan v46 kodlama ilerlemesi

Entegrasyon dalı: `plan-v46-kod` (plan-v30-fix'ten). Plan: `2026-10-13-plan-v45-kod-plani.md` (hedef v46). İzlenebilirlik: `2026-10-13-plan-v46-izlenebilirlik.md`.
Kural: paket bitince bu tabloyu güncelle, commit + push et. Yayın yalnız F10 geçince.

| Paket | Durum | Commit | Not |
|---|---|---|---|
| P0 durum sözlüğü + rozet + belirteçler | bitti | 8019f19 | stageWords.ts, BookedBadge, 5 örnek kutu, F0 belirteçleri; tsc, vitest 1858, build ve tam e2e (56 adım) yeşil |
| P1a ⓘ balonu | bitti | 138f7b2 | InfoButton + HoverTip(button); flightPeek/stayPeek/transferPeek, PNR yalnız uçuş günü; Peek.tsx kalktı |
| P1b niyet etiketi | bitti | 41835e1 | IntentChip + intentOf; tarih yoksa yalnız şehir, kamp/karavan "Kamp · yer"; "ayrı konaklama" bloğu görselsiz olduğundan etiketsiz (F10 bakar) |
| P1c köşe yüzü | bitti | dc63a10 | SavedFace (kart köşesi, arka yüz karosu, fikir karosu, Pano); etkinlik kartındaki minik yüz P6 (ActivityBoard) ile gelir |
| P1d Pano ferah | bitti | 0ebfdf9 (+ ara kayıt ceb22d4; P1 doğrulaması: tsc, vitest 1870, build, tam e2e 56 adım yeşil) | sütun 296-316, ucus.png, kişi başı fiyat tripPeople ile; uçuş şeridi/seçenek satırı P2'de |
| P8a hareket değerleri | bitti (birleşti) | c146c3c | |
| P8b reduced-motion + Hareketi duraklat | bitti (birleşti) | c146c3c | |
| P8e exitMotion testi | bitti (birleşti) | c146c3c | |
| P9a ölü kod + bayat belgeler | bitti (birleşti) | c146c3c (silme önerileri P9b'de) | |
| P2 uçuş bileti + seçenek kartları | bitti (birleşti) | ff4ef9c | |
| P3 sade otel + Değiştir N | bitti (birleşti) | 3e1879b | |
| P4 arka yüz | bitti (birleşti) | a799601 | |
| P5a ulaşım kartı | bitti (birleşti) | 76cd9d5 | |
| P5b Yolculuk görünümü | bitti (birleşti) | 5069224 | |
| P6 etkinlikler şehre göre | bitti (birleşti) | 543b2b4 | |
| P7 taslak Önerimiz | bitti (birleşti) | 67814c3, birleşme d2eff45 | denetimde doğrulandı |
| P8c aşama geçişi (K29) | bitti (birleşti) | 73da513, birleşme eb55e72 | denetimde doğrulandı |
| P8d kalan hareketler | bitti (birleşti) | 19a2ef6 | |
| P9b son temizlik | bitti (birleşti) | 2fe397f | ölü bileşen/export/CSS silindi (176 kural), bayat belgeler ve envanter durumları güncellendi; Mascot wink, WorldFlight, st-map-* silinmedi, `2026-10-13-plan-v46-silme-onerileri.md`; tsc, vitest, build, tam e2e yeşil |
| P10 bitiş denetimi | denetim yapıldı: yayın kapısı KAPALI | dal `plan-v46-denetim` | 41 açık satır, 5 HATA (H1 Seçildi yazısı, H2 ve H3 390 px taşma, H4 rötar kutusu, H5 belgeler): `2026-10-13-plan-v46-fark-raporu.md` |
| Düzeltme turu (H1 H5) | bitti, birleşti (8921b50); 2. denetimde doğrulandı | dal `plan-v46-duzelt` | H1 Seçildi yazısı (otel, ulaşım, etkinlik), H2 bölüm başlığı sarar ve arka yüz 390 px'te taşmaz, H3 şekil şeridi dar ekranda kendi içinde kayar, H4 rötar kutusu sarar, H5 belge notları; ⓘ `aria-expanded`, arka yüz `aria-modal`; e2e'ye Seçildi, rötar taşma ve 390 px iddiaları |
| Karar paketleri (Emre'nin kararları) | bitti, birleşti | acilis2 (a7b8874), gungun2 (3bf511f), karar2 (7062096), ucuskamp (062d5fe), hareket3 (529a2f6) | orb/kıvılcım + mozaik; Gün gün Kompakt/Liste/Kartlar + yolculuk günü + günün rezervasyonları; sırayla karar, ★, sohbette ad, neden satırı; uçuş durum etiketleri + kamp sorusu; Hareket Dili |
| 2. bağımsız denetim | yapıldı: 0 yayını engelleyen, 4 HATA (E1 E4) | dal `plan-v46-denetim2` | tsc temiz, vitest 163/2009 yeşil, ☐ kalan 1 (PS11); `2026-10-13-plan-v46-fark-raporu-2.md`; E1 ('bulamadık' mesajı arama yapılmadan görünüyor) yayından önce düzeltilmeli |
| Yayın | bekliyor | | |
