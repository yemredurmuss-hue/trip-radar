# Plan v46 kodlama ilerlemesi

Entegrasyon dalı: `plan-v46-kod` (plan-v30-fix'ten). Plan: `2026-10-13-plan-v45-kod-plani.md` (hedef v46). İzlenebilirlik: `2026-10-13-plan-v46-izlenebilirlik.md`.
Kural: paket bitince bu tabloyu güncelle, commit + push et. Yayın yalnız F10 geçince.

| Paket | Durum | Commit | Not |
|---|---|---|---|
| P0 durum sözlüğü + rozet + belirteçler | bitti | 8019f19 | stageWords.ts, BookedBadge, 5 örnek kutu, F0 belirteçleri; tsc, vitest 1858, build ve tam e2e (56 adım) yeşil |
| P1a ⓘ balonu | bitti | 138f7b2 | InfoButton + HoverTip(button); flightPeek/stayPeek/transferPeek, PNR yalnız uçuş günü; Peek.tsx kalktı |
| P1b niyet etiketi | bitti | 41835e1 | IntentChip + intentOf; tarih yoksa yalnız şehir, kamp/karavan "Kamp · yer"; "ayrı konaklama" bloğu görselsiz olduğundan etiketsiz (F10 bakar) |
| P1c köşe yüzü | bitti | dc63a10 | SavedFace (kart köşesi, arka yüz karosu, fikir karosu, Pano); etkinlik kartındaki minik yüz P6 (ActivityBoard) ile gelir |
| P1d Pano ferah | bitti | 0ebfdf9 (+ ara kayıt ceb22d4) | sütun 296-316, ucus.png, kişi başı fiyat tripPeople ile; uçuş şeridi/seçenek satırı P2'de |
| P8a hareket değerleri | bekliyor | | |
| P8b reduced-motion + Hareketi duraklat | bekliyor | | |
| P8e exitMotion testi | bekliyor | | |
| P9a ölü kod + bayat belgeler | bekliyor | | |
| P2 uçuş bileti + seçenek kartları | bekliyor | | |
| P3 sade otel + Değiştir N | bekliyor | | |
| P4 arka yüz | bekliyor | | |
| P5a ulaşım kartı | bekliyor | | |
| P5b Yolculuk görünümü | bekliyor | | |
| P6 etkinlikler şehre göre | bekliyor | | |
| P7 taslak Önerimiz | bekliyor | | |
| P8c aşama geçişi (K29) | bekliyor | | |
| P8d kalan hareketler | bekliyor | | |
| P9b son temizlik | bekliyor | | |
| P10 bitiş denetimi | bekliyor | | |
| Yayın | bekliyor | | |
