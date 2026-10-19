# Trip Radar 0.39.0

19 Ekim 2026. Emre'nin 0.38.9 notları, genel kod incelemesi ve dil:

- Rezerve konaklamaya sonradan eklenen yer (eklentiyle, geceleri birebir tutmasa da) kutunun "Diğer seçenekler" satırında ve Pano'da görünür; hiçbir kayıt sessizce kaybolmaz. Rezerve kutuda düğme "Bununla değiştir": onaylanınca eski rezervasyon iptal edildi sayılır (Gizlenenler'den geri alınır), yenisi seçilir; Vazgeç hiçbir şeyi değiştirmez.
- Seçenekler her durumda görünür: kutunun üçünden fazlası altında "Diğer seçenekler (n)"; seçili, rezerve, ayarlı ve dahil kutularda hepsi.
- Seçilen konaklama geri alınınca, onun için kenara konan başlangıç ya da sohbet yeri geri gelir.
- Plandaki yerinde ad düzenleme kalemi ve "Adını değiştir" çizilmez (ad sohbetle düzeltilir); kod durur.
- Tripadvisor otellerinin tipik fiyat aralığı kayıtta kalır ("tipik €21–64 / gece"); fiyat hiç yoksa sitenin fiyat sayfasına bağlantı, uydurma tutar yok.
- Kod incelemesi: aynı anda gelen teklif cevapları önbelleği birbirinin üstüne yazıyordu (kayıp cevaplar her açılışta yeniden isteniyordu, kota); yazımlar sıraya girdi. HTML basma, bağlantı doğrulama, izinler, mesaj dinleyicileri temiz.
- Arayüz: bilette uzun istasyon adı saati kesmez; Pano "Yeni" rozeti kendi boyunda; gün gün ay adı büyük harfsiz; küçük düğmelerin dokunma alanı büyüdü.
- Dil: İngilizce başlayan gezinin başlığı "Bali Trip", açılış satırları, bavul ve ruh cümlesi istemleri gezinin dilinde; L() dışında kalan Türkçe metinler sarıldı; kaynakta L() dışı görünür Türkçe için denetim testi.
