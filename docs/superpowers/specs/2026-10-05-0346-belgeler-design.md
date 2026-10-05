# 0.34.6: Belgeler sekmesi, PDF'i anlayan asistan, "Yapılacak şeyler" = deneyimler · tasarım

Kaynak: Emre, 2026-10-05 17:31 (ekran görüntüsü: seyahat sağlık sigortası poliçesi sohbete atıldı; görünmedi,
asistan "Travel Health Insurance"ı Things to do'ya koydu).

## Kök sebepler (doğrulandı)

1. Sohbete bırakılan/yapıştırılan dosyalardan yalnız görseller alınıyor (`src/app/capture.ts addImages`
   `image/*` dışını atlıyor, `Chat.tsx` `accept="image/*"`). PDF sessizce kayboluyor.
2. Sohbet aracı `plan_item` sigorta ve eSIM dışı bazı türleri bilmiyor: `insurance` yalnız şablonda
   (`TEMPLATE_ONLY_KINDS`). Asistan en yakın türü seçti → kanıt yok → Yapılacak şeyler.
3. "Yapılacak şeyler" bölümü işler (al, başvur, paketle) ile destinasyon deneyimlerini karıştırıyor.

## 1. Belgeler

- Yeni sekme: **Plan · Günlük akış · Belgeler** (Günlük akış sekmesinin içeriğine dokunulmaz).
- Belgeler sekmesi: gezinin bütün belgeleri (mevcut `docs` deposu; kartlara eklenenler + sohbete bırakılanlar),
  türe göre gruplu: Uçuş · Konaklama · Ulaşım · Etkinlik · Sigorta · İnternet · Diğer; her satır: dosya ikonu/küçük
  önizleme, ad, tarih, bağlı olduğu kart ("Seyahat sağlık sigortası · Allianz →" kartına gider), aç, sil (8 sn geri al).
  Bağlı olmayan belge "Bir karta bağla" seçicisiyle bağlanabilir.
- Sohbete ve panoya **PDF (ve görsel)** bırakmak/yapıştırmak/📎 ile seçmek: dosya `docs`a kaydolur (yerel, 15 MB sınırı
  bugünkü gibi) ve asistana okunması için gönderilir.
- Kartlardaki belge hapı aynı depoyu gösterir; tek kaynak.

## 2. Belgeyi anlayan asistan

- Bırakılan belge LLM'e (Gemini/Claude PDF girişi; görsel için mevcut yol) şu sorularla gider: belge türü (sigorta poliçesi,
  uçak bileti/biniş kartı, otel/konut rezervasyonu, tren/otobüs bileti, etkinlik bileti, eSIM/QR, araç kiralama, vize,
  diğer), sağlayıcı, kişi(ler), tarih aralığı, şehir/güzergâh, rezervasyon no/PNR, tutar ve para birimi.
  Yalnız belgede yazanlar; alıntı doğrulaması mevcut kanıt kuralıyla.
- Sonuç: (a) eşleşen kart varsa (aynı tür + tarih/güzergâh/sağlayıcı) belge ona bağlanır ve kart **Alındı/Rezerve**
  olur, eksik alanları (PNR, saat, tutar) doldurulur — kullanıcı düzeltmesi varsa ezilmez; (b) yoksa doğru türde yeni
  kayıt **alındı** olarak oluşur (sigorta → Diğer bölümü). Sohbette tek cümleyle söyler: "Allianz seyahat sağlık
  sigortası poliçeni Diğer'e ekledim, 7–21 Ekim, 2 kişi. Belgeler'de duruyor."
- `plan_item` sohbet türlerine `insurance` eklenir (ve `esim` zaten var); "sigortam var / poliçe attım" → insurance,
  booked. Sistem yönergesi: kullanıcı "aldım/attım/var" diyorsa ve bir belge/poliçe sözü geçiyorsa kayıt alınmış sayılır;
  sigorta, vize, eSIM asla Yapılacak şeyler'e gitmez.
- Kod tarafında koruma: `insurance`/sigorta sözcükleri → Diğer, kanıttan bağımsız; yanlış türle gelse bile.

## 3. "Yapılacak şeyler" = destinasyonda deneyim

- Tanım: destinasyonda görülecek, yenecek, gezilecek, yapılacak deneyimler (manzara, pazar, müze, yürüyüş, mahalle,
  konser değil ama ücretsiz gösteri, yöresel yemek denemek…). Ad: TR "Yapılacak şeyler" kalır, alt açıklama
  "görülecek, gezilecek, denenecek"; EN "Things to do".
- Hazırlık işleri (al/satın al, başvur, rezervasyon yap, yazdır, paketle, döviz bozdur, sigorta/vize/eSIM işleri) buraya
  girmez: **Diğer** bölümünün altında sessiz bir **"Hazırlık"** listesi (tikli, kısa satır). Sınıflama koddan
  (fiil/anahtar kelime kuralı) + sohbette tür `prep`.
- Mevcut kayıtlar okunurken yeniden sınıflanır (göç yok; kanıt kuralı gibi okurken).

## Doğrulama

Birim: dosya kabulü (pdf, png, jpg; diğerleri reddedilir), belge→tür eşlemesi (taklit LLM yanıtlarıyla), kart eşleme ve
bağlama, yeni kayıt oluşturma (sigorta Diğer'de alındı), deneyim/hazırlık sınıflaması (TR+EN örnekler: "Decathlon'dan
yağmurluk al" → Hazırlık; "Porto Belo Pazarı" → Yapılacak şeyler; "seyahat sigortası" → Diğer).
e2e (headless): sohbete PDF bırak → (taklit LLM) sigorta kartı Diğer'de alındı + belge hapı + Belgeler sekmesinde satır;
Belgeler'den kartına git; bağlı olmayan belgeyi bağla; sil + geri al.
