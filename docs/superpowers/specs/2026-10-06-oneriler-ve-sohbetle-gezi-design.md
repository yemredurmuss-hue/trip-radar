# Öneriler ve sohbetle gezi başlatma · tasarım

Kaynak: Emre, 2026-10-06. Görsel: `docs/mockups/2026-10-06-sohbetle-gezi-v1.png` (onaylandı, "kendin kontrol et, daha iyi
nasıl olur, düzelt"). Örnek: Layla.ai (soru-cevap + "Your trip is taking shape" listesi + "Generate my trip" animasyonu).
İki parça: önce **öneriler** (temel), sonra onun üstüne **sohbetle gezi başlatma**.

## Öz eleştiri: v1'den ne değişti

1. **Rota sessizce kararlaştırılmasın.** v1'de "Ubud 12 → Canggu 10 → Uluwatu 9" oluşturma sırasında kendiliğinden
   yazılıyordu; yanlışsa tüm geceler yanlış kurulurdu. Şimdi listeye 6. madde **ROTA** gelir: nereye + kaç gün belli olunca
   asistan bir rota önerir, satır olarak gösterir ("Ubud 12 · Canggu 10 · Uluwatu 9 gece") ve **[Bu olsun] [Değiştir]**
   sorar. Tek şehir ya da kısa gezi için tek durak önerir. Onaylanmadan oluşturulursa tek durakla kurulur, rota sonra
   sohbetten değişir.
2. **Kısa sorgu.** İlk mesajda geçenler sorulmaz ("Sabine'yle 10 Aralık'tan 1 ay Bali" → yalnız "nereden" ve "ne istiyorsun"
   kalır). Her soruda **Atla**. "Nereden" önceki gezilerden ya da pasaport ülkesinden tahminle ilk çip olarak gelir.
3. **Tarih ve süre ayrı.** "1 ay ve üstü" bir tarih değil: süre seçilince başlangıç sorulur (ay çipleri + 📅 tarih seç).
   İkisi de net olunca listede "10 Ara – 10 Oca · 31 gün".
4. **Ekleme mi, yeni gezi mi?** Seyahatlerim kutusuna yazılan şey var olan bir gezinin yerini anıyorsa ("Porto'da bir otel
   daha") önce sorar: "Porto ve Madeira Gezisi'ne mi ekleyeyim, yeni gezi mi?"
5. **Yarıda kalırsa kaybolmasın.** Soru-cevap taslak gezi olarak saklanır; Seyahatlerim'de "Bali · taslak · Devam et" kartı.
6. **Anahtar yoksa da çalışsın.** Model yoksa (anahtar yok, AI kapısı kapalı): sorular ve çipler aynı (kod soruyor),
   rota tek durak, öneriler yalnız kurallardan; oluşturma yine çalışır.
7. **Tek yönlendirme.** v1'de üstte ayrı "sıradaki adım" şeridi vardı, hero'daki "Planı tamamla" ile yarışıyordu. Şimdi:
   yeni gezide bir kerelik **başlangıç kartı** (3 adım: Uçuşları bul · Konaklamaları seç · Önerilere bak; adımlar
   kendiliğinden işaretlenir, hepsi bitince ya da × ile kaybolur); sürekli yönlendirme hero'da kalır.
8. **Sohbet sürer.** Başlatma sohbeti gezinin sohbet geçmişi olur; panoda aynı konuşmadan devam edilir.
9. **Dar ekran.** Liste sohbetin üstünde ince bir ilerleme çubuğuna iner ("4/6 · Gezin şekilleniyor ▾", basınca açılır).

## 1. Öneriler

- **Öneri kartı:** ait olduğu bölümde, kartların üstünde soluk kart: ✨ · başlık · tek cümle neden · **[Plana ekle] [Gerek yok]**.
  Plana girmez, sayılmaz (bölüm başlığı x/y, hero sayaçları, onaylananlar), Günlük akışta görünmez. Bölüm başlığında
  accent renkte "1 öneri". "Plana ekle" o bölümün şablonuyla gerçek kaydı kurar (mevcut şablon/hızlı ekle yolu), öneri biter.
  "Gerek yok" kalıcı (aynı anahtar bir daha önerilmez), Geçmiş'te görünür ve geri alınır.
- **Veri:** `trip.suggestions?: Suggestion[]` — `{ key, section, kind, title, why, source: "rule"|"ai"|"chat", template?, payload?, createdAt, state: "open"|"added"|"dismissed" }`.
  `key` tekilleştirir ("rule:night-arrival-taxi:2026-10-07", "ai:monthly-scooter").
- **Kaynaklar:**
  1. **Kurallar** (kod, anında, ücretsiz, her değişiklikte yeniden hesaplanır; artık geçerli değilse kendiliğinden kalkar):
     gece 22:00 sonrası varış ve transfer planlanmamış → "Havalimanı transferi · Taksi"; 21+ gün tek yerde ve araç yok →
     "Aylık motor/araç kiralama"; seyahat sağlık sigortası yok (yurt dışı) → sigorta; eSIM yok (yurt dışı) → eSIM;
     boş geceler → "Konaklama bul"; aktarma < 60 dk (farklı bilet) → uyarı. Liste kısa ve sabit; her biri test edilir.
  2. **Yapay zekâ gözden geçirmesi**: oluşturmada bir kez; sonra yalnız büyük değişiklikte (yeni şehir, tarih, konaklama)
     ve günde en fazla bir kez; her seferinde en fazla 3 yeni öneri, katı JSON şeması, yalnız izinli bölüm/tür; gerekçe
     tek cümle; fiyat ve saat uydurmaz. Anahtar yoksa çalışmaz.
  3. **Sohbet**: asistan "şunu öneririm" diyeceği şeyi `suggest` aracıyla doğru bölüme kart olarak bırakır (motor kiralama
     → Ulaşım). Kullanıcı açıkça isterse yine `plan_item` ile ekler.
- **Mini ipuçları** ("o saatte metro çalışmaz") Günlük akışta satırın notu olarak kalır; öneri kartı değildir.

## 2. Sohbetle gezi başlatma

- **Giriş:** Seyahatlerim'de tek kutu ("Merhaba Emre, sıradaki gezi nereye?"). Link/dosya → bugünkü okuma. Yazı → ekleme mi
  yeni gezi mi (madde 4) → yeni gezi sohbeti. Altında başlangıç çipleri: Yeni gezi planla · Bana ilham ver · Yol gezisi ·
  Son dakika kaçamağı · Paylaşılan geziye katıl.
- **Soru-cevap ekranı:** solda sohbet, her soruda çipler + Atla + serbest yazı; sağda "Gezin şekilleniyor N/6" listesi:
  NEREYE · NEREDEN · KİMLE · NE ZAMAN (başlangıç + süre) · NE İSTİYORSUN (tarz çipleri, çoklu) · ROTA (öneri + onay).
  Model bir mesajdan birden çok bilgiyi çıkarır (katı şema); kod çipleri ve sırayı yönetir.
- **Gezimi oluştur:** nereye + ne zaman yeterli. Animasyonlu ekran ("Bali Gezisi planlanıyor", hedef fotoğrafları Pexels'ten,
  yoksa degrade); adımlar **gerçek işi** gösterir ve iş bittikçe işaretlenir: gezi kaydı · rota/geceler · uçuş yerleri ·
  kişi ve tarz · kural önerileri · yapay zekâ önerileri (anahtar varsa). Hata olursa o adımda durur, "Yine de aç" der.
- **Sonuç:** pano açılır; başlangıç kartı (madde 7), öneriler bölümlerinde; sohbet aynı konuşmadan devam eder.

## Kapsam dışı

Uçuş/otel fiyat araması (yalnız arama linki), paylaşılan gezide başlatma sohbeti (yalnız kendi gezin).

## Doğrulama

Birim: her kural (tetiklenir/tetiklenmez/kendiliğinden kalkar), öneri tekilleştirme ve "Gerek yok" kalıcılığı, sayılara
girmeme, "Plana ekle" doğru şablonla kurma; soru-cevap durum makinesi (ilk mesajdan çıkarım, atla, eksik zorunlu alan,
rota onayı), oluşturma (tek durak/çok durak, anahtar yok yolu), taslak devam. e2e (penceresiz): kutuya "Sabine'yle 10
Aralık'tan 1 ay Bali" → çiplerle tamamla → oluştur → panoda geceler, uçuş yerleri, öneri kartları; bir öneriyi ekle,
birini "Gerek yok"; ekran görüntüleri.

## Revizyon 2 (2026-10-06, Emre'nin geri bildirimi)

İngilizce panoda "Sabine ile beraber Tayland Kohphandan 1 ay 10 ocak civarları gitmeyi düşünüyorum" yazıldı; sohbet
İngilizce cevap verdi, "Nereden?" sorusuna "İstanbul" denince gezi "Istanbul trip" oldu. Düzeltmeler:

1. **Dil:** sohbet ilk yazılan mesajın dilinde konuşur (Türkçe harf/ek/kelime → TR, İngilizce kelime → EN, yalnız bir
   yer adı → panonun dili). `state.lang` taslakta durur; her satır, çip, liste etiketi, gezinin başlığı ve modele giden
   her istem o dilde ("Yanıtı Türkçe yaz."). Panonun kendi dil ayarı değişmez.
2. **Cevap, sorusunun alanını doldurur:** bekleyen soru hem koda hem modele verilir; "Nereden?"e verilen yer `from`
   olur, `where` yalnız açıkça söylenince değişir ("aslında Bali'ye gidelim", soru yeniden sorulunca, aynı ülkede daha
   belirgin bir yer). En belirgin yer kalır ("Tayland Kohphandan" → Koh Phangan, Tayland); yazım bozukluğu boşluksuz en
   çok 2 harf farkla tanınır (gerçek bir ülke adı asla başka yere çevrilmez). Rota ve "Değiştir" hep varıştan; çıkış
   şehri durak olamaz.
3. **Dürüst oluşturma ekranı:** her adım en az ~600 ms görünür, bitince gerçekte yaptığını söyler ("Koh Phangan'a 31
   gece yazıldı", "İstanbul ⇄ Koh Samui uçuşları için yer açıldı", "2 kişi · Dingin"); tik yumuşak gelir; yüzde yok,
   biten adımlarla dolan akıcı bir çubuk; fotoğraflar yüklenince belirir; azaltılmış hareket tercihinde animasyon yok.
4. **Hep oluşturulabilir:** varış belli olunca düğme açılır: liste doluysa "Gezimi oluştur", değilse "Şimdilik bununla
   oluştur". Tarih yoksa gezi tarihsiz; konaklama ve gidiş uçuşu tarihsiz yer olarak açılır; eksikler pano sohbetinin son
   satırında sorulur. Sağda listenin altında canlı **Gezi önizlemesi**: fotoğraflar, duraklar ve geceler, tarih, kimle,
   tarz, uçuşlar, ülke bilgisi, kural önerileri; her parça bilindiği an yumuşakça belirir.
5. **Zengin sohbet:** anahtar varsa yazılan her mesaj için **tek** model çağrısı hem okur hem cevap yazar (`reply:
   {text, question}`: 1-2 cümle, yere özgü renk, en çok 220 karakter, fiyat ve rezervasyon olgusu yok, sohbetin dilinde;
   tutmazsa kodun satırı kalır). Kodun satırı hemen görünür, modelinki ~6 sn içinde gelirse üstüne yazılır. Anahtarsız:
   kodun satırları + popüler yerler için küçük bir renk tablosu (TR/EN).
6. **Düşünme göstergesi:** sohbette üç nabız noktası ve gerçek aşama: "Düşünüyor…" (kod anlamadığında model okurken),
   "Rotayı çiziyor…", "Yazıyor…"; `role=status`, `aria-live=polite`; azaltılmış harekette durur.
7. **Arka planda hazırlık:** varış ve süre bilinir bilinmez taslağa (yalnız taslağa; listelerde, senkronda, dışa
   aktarımda yok) fotoğraflar, rota önerisi (yer + gece kararlaşınca; her farklı yer+gece için bir kez) ve kural
   önerileri hazırlanır. Yer değişince rota ve fotoğraflar düşer; geri dönülürse saklı rota yeniden sorulmadan gelir.
   Yapay zekâ öneri gözden geçirmesi yine yalnız "Oluştur"da.

**Model bütçesi (bir görüşme):** yazılan her mesaja en çok 1 okuma+cevap çağrısı (zaman aşımında istek iptal edilir,
yeniden denenmez); hızlı cevaplar (çipler) ve "Atla" model çağırmaz (kodun satırı + yer renk tablosu); her farklı (yer,
gece) için en çok 1 rota çağrısı; "Oluştur"da 1 öneri gözden geçirmesi.

**İnceleme düzeltmeleri:** dil tartılarak bulunur (İngilizce kelime/ek sayısı ↔ Türkçe kelime, ek ve büyük harfle
başlamayan kelimelerdeki Türkçe harf; "we've" içindeki "ve" sayılmaz, "Şule", "İstanbul" gibi adlar dil söylemez).
"Nereden?"de fikir değişikliği ("Rome instead", "Hayır, Roma", "Bali değil Roma", "Romaya gidelim") gidilen yeri
değiştirir, nereden'e dokunmaz. "to"/"'e" ile işaretli yer kazanır ("Istanbul to Bali" → Bali); işaretsizse modelin
okuduğu yer. Bozuk yazım yalnız 8+ harfli adlarda, kişi adı yanında ("ile", "and", "&") ve "kimle" sorusunda asla;
tanınınca sorulur: "Koh Phangan mı demek istedin?" [Evet] [Hayır, Kohphandan]. Yurt içi gezide rota çıkış şehrinden
geçebilir. Sohbetin dili gezide durur (`trip.lang`): pano sohbeti ve öneri gözden geçirmesi o dilde. Bütçe çipleri
"Ekonomik · Orta · Yüksek bütçe". Tarihsiz gezinin tarihleri sonra sohbette söylenince (update_trip) başlangıcın
tarihsiz konaklama ve uçuşları o tarihleri alır, yenisi açılmaz.
