# Akıllı saat motoru (Günlük akış) — tasarım

Durum: öneri, Emre onayı bekliyor (2026-10-05).

## Amaç

Günlük akışta her satırın saati olsun. Kesin saatler (bilet, rezervasyon) sabit kalsın; aradakiler (havalimanına
transfer, check-out, check-in, araç alış/iade) bunlardan geriye ve ileriye doğru hesaplansın. Örnek:

- Uçuş 15:00 → havalimanında ~13:00 → transfer ~12:00 → check-out ~11:30.
- İniş 22:00 → havalimanından çıkış ~22:45 → transfer → otelde ~23:30 → check-in ~23:30.

## İlkeler (patlamaması için)

1. **Saati kod hesaplar, AI değil.** Belirli kurallar, testli; AI saat uydurmaz (yalnız öneri yapar).
2. **Hesaplanan saat kaydedilmez.** Her açılışta yeniden hesaplanır: uçuş saati değişince her şey kendiliğinden
   kayar. Kaydedilen yalnız senin seçimlerin (transfer şekli, senin verdiğin saat).
3. **Kaynak sırası:** bilet/rezervasyon (kesin) > senin söylediğin > sayfanın söylediği (check-in 15:00) >
   hesap > alışkanlık. Kesin olan düz yazılır, hesaplanan "~" ile; üstüne gelince/dokununca "neden bu saat":
   "Uçuş 15:00 · havalimanında 13:00 (2 sa önce) · taksi ~40 dk → yola çıkış 12:10".
4. **Kesin saat asla değişmez.** Çakışma olursa motor düzeltmez, kırmızı tek satırla söyler.
5. **Emin değilse saat yazmaz.** Eksik veri = saatsiz satır (sıra korunur), yanlış saat değil.

## Kurallar

| Durum | Kural | Bugün |
|---|---|---|
| Uçuşa gitmek | Havalimanında: kalkış − 2 sa (AB/Schengen içi), − 3 sa (dışı) | hep 2 sa |
| Tren / otobüs / vapur | İstasyonda: −20 dk / −20 dk / −30 dk (araçla vapur −60) | var |
| Transfer süresi | Şekil seçildiyse ona göre (taksi: mesafe ÷ 30 km/s + 10 dk; metro: ÷ 20 + 15; yürüme: mevcut hesap); seçilmediyse mesafeden taksi tahmini; mesafe yoksa 45 dk. +10 dk pay; 10 dk – 2,5 sa arası | sabit 60 dk |
| Yola çıkış | havalimanında olma saati − transfer süresi | yok (yalnız "en geç" yazıyor) |
| Check-out | otelin saati (yoksa 11:00); yola çıkıştan sonra kalıyorsa → çıkış − 15 dk ("erken çıkış"). Arada ≥ 3 sa → "bavul emaneti / geç çıkış" notu | not var, saat yok |
| İniş | inişten +45 dk havalimanından çıkış (yalnız kabin bagajı biliniyorsa +25) | +60 |
| Check-in | max(otele varış, otelin giriş saati). Varış ≥ 2 sa erken → "bavulu bırak" notu. Resepsiyon kapanışı sayfada yazıyor ve varış sonraysa → kırmızı "geç giriş: otele haber ver" | kısmen |
| Gece yarısı sonrası iniş (00–05) | giriş önceki geceye ait; o gece konaklama yoksa kırmızı "inişte kalacak yer yok" | yok |
| Erken kalkış (transfer 06:00 öncesi) | "toplu taşıma çalışmıyor olabilir" notu | var |
| Araç kiralama | alış: iniş + 45 dk; iade: havalimanında olma − 30 dk | yok |
| Aynı gün şehir değişimi | check-out → istasyon transferi → tren → transfer → check-in zinciri, hepsi saatli | kısmen |
| Saatli etkinlikler | sabit; bitişi + yol süresi sonrakinin başlangıcını geçerse kırmızı tek satır | yok |
| Aktarmalı uçuş | transfer yalnız uçlarda; aktarma bilgi satırı | var |
| Saat dilimi | her saat yerel; gece yarısını geçen uçuşta iniş ertesi günün satırı | var |
| Senin saatin | kesin sayılır; motor onun etrafında hesaplar, onu değiştirmez | yok |

## Güvenlik

- Saf fonksiyon: `dayTimes(gün, girdiler) → satır başına { saat, kesin mi, kaynak, neden, uyarılar }`. Veriyi değiştirmez.
- Senaryo testleri (≥ 20): yukarıdaki her satır + gece inişi, sabah 05:00 uçuşu, aktarma, iki uçuşlu gün, saati
  bilinmeyen uçuş, otel seçilmemiş, senin saatin çakışıyor.
- Değişmez kural testleri: hesaplanan yola çıkış hiçbir zaman "havalimanında olma"dan sonra değil; check-out yola
  çıkıştan sonra değil; kesin saat hiç değişmez; hesap yapılamazsa saat boş.
- Yumuşak hata: bir kural hata verirse o gün saatsiz eski görünüme düşer, sayfa kırılmaz.
- Kurallar tek dosyada tablo; yeni kural = yeni satır + kendi testi.

## Karar bekleyenler

1. Uçuş tamponu: AB/Schengen içi 2 sa, dışı 3 sa.
2. Transfer süresi bilinmiyorsa 45 dk (+10 dk pay).
3. İniş sonrası çıkış: 45 dk (kabin bagajı biliniyorsa 25).
