# Trip Radar 0.39.2

19 Ekim 2026. 0.38.10'un (Emre'nin diğer oturumu, `serp-eklemeler`) eklentideki özellikleri ana çizgiye geri geldi; 0.39.0 ve 0.39.1 yayınları onları içermiyordu:

- Otel kartı: fotoğraf, en yakın yer ve havalimanına dakika, yorumların övdüğü ve eleştirdiği konular (Google Hotels).
- Uçuş kartı: fiyat düşük/normal/yüksek rozeti, fiyat geçmişi grafiği, ±3 gün çubukları, gece aktarması uyarısı.
- Yapılacaklar: Google'ın gezilecek yerleri, puanlı; Maps yer aramasıyla birlikte, aynı yer iki kez gelmez, satırda en çok 4.
- Etkinlikler: "O tarihlerde {şehir}'de" (Google Events).
- Konaklama: uzun konaklamada ya da kalabalıkta Airbnb seçeneği.

Ve yer fotoğrafları için Google Places API (New): sunucu yer aramasında önce Google Places, sonra SerpApi; fotoğraf `kind=placephoto` ile (Google'ın saklama kuralı gereği fotoğraf adresi bir gün tutulur). Kart künyesi "Fotoğraf: Google Haritalar · yazar".
