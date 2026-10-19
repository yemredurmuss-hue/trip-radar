# Trip Radar 0.39.1

19 Ekim 2026. Emre'nin 0.39.0 notları (ayrı paket):

- Sohbetin öneri kartı fiyatsız otelde bozulmuyor: fiyat sütunu en fazla %40, metin sarılır, ad ve sağlayıcı ezilmez; dar sütunda alt alta.
- Seyahatlerim'deki dil ve para birimi seçicisi çalışıyor (açılan liste hero'nun altında kalıyordu); açık panolar hemen yeni ayarla.
- AI'ın yeni yazdığı her şey (öneriler, uyarılar, sohbet, bavul, ruh cümlesi) yazıldığı andaki arayüz dilinde; dil değişince açık AI önerileri ve dokunulmamış bavul listesi bir kez yeni dilde yenilenir, plana konanlar kalır.
- Vize satırı doğrudan söyler ("Vize gerekmez · 90 güne kadar", "Varışta vize ya da e-VOA · 30 güne kadar · ücretli", "Vize gerekli · başvuru", "e-Vize (ETA) gerekli"); bilinmeyen çiftte resmî kaynak. "Var / Yok" işareti Hazırlık'la ortak. Ülke seçimi kararlı, satır her zaman görünür; pasaport bilinmiyorsa sorulur.
- Ulaşım: tren/otobüs/feribot kutuları yeniden Omio'ya sorulur (0.38.1'den beri kesikti); araç ve motosiklet kiralamada DiscoverCars / BikesBooking; havalimanı yolu iniş saatiyle dolu, Önerimiz sırası bütçeye ve iniş saatine göre (düşük bütçe toplu taşıma önce); trensiz bilinen yerde (Bali) "Toplu taşıma"; taksi seçilince Hazırlık'a "Uber uygulamasını indir".
- Yer önerileri gezinin niyetiyle (kimle, bütçe, tarz) aranır ve Google Maps'ten gerçek fotoğraf/puanla gelir: sunucu tarafı hazır, yayına alınana kadar Wikipedia yolu çalışır.
