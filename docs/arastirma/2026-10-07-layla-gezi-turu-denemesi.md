# Layla.ai: alışılmadık gezi türlerini nasıl karşılıyor (2026-10-07)

Emre'nin Chrome'unda, Emre'nin Layla hesabıyla iki deneme. Hesaba iki yeni gezi eklendi ("7 Günlük Dahab ve Kızıldeniz
Dalış Turu", "Kapadokya'da 3 Günlük Aile Kutlaması").

## Deneme 1: "Kasımda Kızıldeniz'de 1 haftalık dalış gezisi, ileri seviye dalgıcım"

- **İlk cevap:** Türü ve seviyeyi tanıyor ("Ras Mohammed, Thistlegorm batığı, güney resifleri"). Tek mesajda 4
  kalın soru soruyor: nereye (Şarm / Dahab / Hurgada / liveaboard), kimle, nereden, bütçe.
- **Çipler:** Modelin o an ürettiği 3 öneri: "Şarm El Şeyh", "Hurgada veya Dahab", "Canlı gemi turu".
- **Bellek:** Emre'yi, Sabine'i ve İstanbul'u biliyor; soruları bunlarla soruyor.
- **Sağdaki kontrol listesi:** Hep aynı 5 kutu var: nereye, nereden, kim, ne zaman, **ne arıyorsun**. Beşinci kutu
  serbest metin ve modelin özeti ("Advanced diving trip" → "Ekonomik, dalış odaklı").
- **Serbest cevabı anlama:** "dahab olsun ama birkac gun liveaboard da dusunurum, yalniz gidiyorum istanbuldan, cok
  pahali olmasin" tek mesajda doğru anlaşıldı; tüm kutular doldu.
- **Oluşturmadan önce:** Bir "Plan Özeti" gösteriyor: Rota, Tarih ve Süre, Yolcu, Konsept. Çipler: "Evet harika",
  "Tarihi değiştir", "Fiyatı düşür".
- **Plan iskeleti genel:** şehir blokları → varış uçuşu → transfer → otel → günlük deneyimler → dönüş.
- **Hata:** Liveaboard anlaşılmadı. "Red Sea" diye bir şehir açtı, Dahab'dan 9 sa 49 dk özel araçla "Red Sea"
  otelinde 2 gece; gün başlığı "Hurgada'ya Varış". Yani türe özel şey (tekne üstünde konaklama) yapıya hiç girmedi,
  yalnız metinde kaldı.

## Deneme 2: "babamın 70. yaş günü için tüm aile 8 kişi Kapadokya'da sürpriz bir hafta sonu, babam yürümekte zorlanıyor"

- **Kısıtı hemen yakalıyor:** Balona binmek yerine balon seyretmeyi, düz ayak teraslar, asansörlü / zemin kat
  odalar ve kapıdan kapıya VIP aracı öneriyor.
- **Sorular kısıta göre:** "Asansörlü veya zemin kat odaları olan lüks/butik bir mağara otel mi…"
- **Çipler:** "Kasım sonu gibi", "Lüks mağara otel", "Özel araçlı tur".
- **Konsept satırı:** Kısıt "Konsept" satırına yazılıyor ("Sıfır yokuş/merdiven stresi; düz ayak teraslar…") ve
  oluşturmaya bu satır gidiyor.
- **Plan:** Otel seçiminin gerekçesi kısıtı söylüyor ("düz ayak girişi ile merdivensiz erişim"). Tek bir "En kritik
  tavsiye" var (özel şoförlü Sprinter). Gün başlıkları kutlamaya göre.
- **Hata 1:** Varış SAW, dönüş IST ("SAW → NAV → IST").
- **Hata 2:** Tavsiye özel VIP araç derken plana "Private-Shared" (paylaşımlı) transfer koymuş.

## Ne öğrendik

1. **Gezi türü yapı değil, metin.** Layla'da sabit kutular ve genel bir iskelet var. Türü serbest bir "ne
   arıyorsun / Konsept" satırı taşıyor; türe özel olan her şey modelin yazdığı metinde ve günlük deneyimlerde.
   Bu yüzden binbir türü karşılıyor, ama türe özel yapıyı kuramıyor: liveaboard bir şehre dönüştü.
2. **Sorular modelden geliyor.** Tek mesajda 3–4 kalın soru, bağlama göre (dalışta liveaboard, Kapadokya'da
   asansör). Çipler de modelin.
3. **Kısıtlar plana taşınıyor.** Otel gerekçesinde görünüyor, ama transfer gibi diğer kalemlerde tutarsız kalıyor.
4. **Oluşturmadan önce "Plan Özeti" onayı var:** rota, tarih, kişi, konsept, tek tık.
5. **Bellek:** kişiler ve çıkış şehri soruların içinde kullanılıyor.

## Bizim fırsatımız

Layla'nın türü anlayışını alıp yapıya çevirmek. Model her gezi için bir oyun kitabı üretir; bizdeki şema bunun
için hazır (iskelet kartlar, kapalı öneriler, hazırlık, sorular ve genel etkileri). Kısıtlar ("merdiven yok",
"ileri seviye dalgıç") her kartın seçim ölçütüne bağlanır: otel önerileri (stayPicks "musts"), transfer türü,
günlük öneriler. Liveaboard gibi türe özel konaklama kendi kartı olur, bir şehre dönüşmez.
