# Kişiye özel rezervasyon (2026-10-06)

Onaylı taslak: `docs/mockups/2026-10-06-kisiye-ozel-v1.html` (+ `.png`).

## Sorun

Bir gezide herkes aynı yerden gelmeyebilir, herkes aynı bileti almayabilir. Sabine Alicante → Porto uçar,
Emre İstanbul → Porto. Bugün pano her planı "herkesin" sayıyor: Sabine'in bileti Emre'nin kartıyla karışıyor,
fiyat "2 kişi" görünüyor, eksik bilet sayılmıyor.

## Kararlar (Emre, 2026-10-06)

- **Yalnız istisna işaretlenir.** Herkesin olan kartta yüz yok. Bir kişiye (ya da herkesten azına) ait kartta türün
  yanında fotoğraflı rozet: "Sabine'in bileti", "Emre'nin bileti". Tek kişilik gezide hiçbir şey görünmez.
- **Her zaman adla.** "Senin biletin" yazılmaz; paylaşılan gezide iki bilgisayarda da aynı metin okunur.
- **Sohbetle yürür.** "Sabine Alicante'den geliyor", "bu Ryanair bileti Sabine'in" yeter. Menü yedek yoldur.
- Kart tasarımı değişmez; yalnız üst satıra bir öğe girer.

## Veri

- `Item.forWho?: string[]`: planın sahipleri, gezideki adlarla (büyük/küçük harf farksız eşleşir). Yok ya da boş:
  herkesin. "Ben" yazılmaz; sahibin adı (profil/paylaşım adı) yazılır. Ad yoksa sohbet bir kez "Sana ne diyeyim?"
  diye sorar, sonra atar.
- `Travellers.from?: Record<string, string>`: gezinin kalkış yerinden farklı yerden gelen kişiler ve yerleri
  ("Sabine" → "Alicante"). Ayarlarla paylaşılır ve geçmişe girer (settings_history).
- Kişi silinince `forWho`'dan düşer; plan sahipsiz kalırsa herkesin olur ve sohbet bir satırla söyler. Ad
  değişince `forWho` aynı adla güncellenir.

## Görünüm

- **Rozet:** `forWho`, gezideki kişilerin tam alt kümesiyse görünür. Bir kişi: avatar + "Sabine'in bileti"
  (uçuş, ulaşım, etkinlik), "Sabine'in rezervasyonu" (konaklama), "Sabine'in" (diğer). Birden çok ama herkes değil:
  üst üste avatarlar + "Emre ve Ali'nin". İngilizce: "Sabine's ticket / booking".
- **Türkçe iyelik eki:** son ünlüye göre büyük ünlü uyumu, ünlüyle biterse "n" kaynaştırması, kesme işaretiyle:
  Emre'nin, Sabine'in, Ali'nin, Mert'in, Oğuz'un, Ümüt'ün, Duru'nun. Birim test şart.
- **Fotoğraf:** hero ile aynı kaynak (paylaşımda kişinin kendi fotoğrafı, yoksa bu bilgisayarda verilen, benimki
  profilden); yoksa baş harf.
- **Fiyat birimi:** `forWho` varsa kişi sayısı onun uzunluğu ("1 kişi").
- **Boş kart:** kişiye özel boş kartın arama bağlantıları o kişinin kalkış yerinden ve kişi sayısıyla dolar.
- **Günlük akış:** kişiye özel satırın sağında sahibinin avatarı. Aynı gün aynı yere farklı saatlerde iki varış
  varsa "X Havalimanı'nda buluşma" satırı (geç inenin saatiyle; "Sabine 10:35 iner, Emre 10:05").
- **Gidenler penceresi (hero):** farklı yerden gelen kişinin adının altında küçük "Alicante'den".

## Kim olduğu nasıl anlaşılır (sırayla, tahmin yok)

1. **Belge:** bilet/rezervasyon belgesindeki adlar (docReader `travellers`) gezideki kişilerin tam alt kümesiyle
   eşleşirse o kişiler. Ad eşleşmesi: ilk ad, büyük/küçük harf ve aksan farksız ("SABINE MULLER" → Sabine).
2. **Kalkış yeri:** uçuşun kalkışı bir kişinin `from` yeriyle aynıysa ve gezinin kalkış yerinden farklıysa o kişi.
3. **Sohbet:** "bu bilet Sabine'in", "Sabine'in dönüşü Alicante'ye".
4. **Menü:** ••• → "Kimin için?": Herkes / her kişi (çoklu seçim).

Hiçbiri yoksa plan herkesin. Belge iki kişiye işaret edip biri gezide yoksa ya da çelişki varsa atanmaz; sohbet
sorar: "Bu Ryanair bileti kimin?" + ad çipleri + Herkes.

## Sohbet (pano asistanı)

- `set_travellers` her ada `from` alır ("Sabine Alicante'den geliyor").
- Yeni araç `set_owner(item_ids, names | "everyone")`.
- Biri farklı yerden geliyor denince: o kişinin uçuşu yoksa onun için gidiş boş kartı açılır (tarih: gezinin
  başlangıcı), ana uçuş kartlarının kişi sayısı bir azalır, ve dönüş kalın soruyla sorulur: **"Sabine dönüşte de
  Alicante'ye mi?"** (Evet, Alicante · Hayır, {gezinin kalkış yeri}'na · Henüz belli değil).
- Cevaplar dürüst: yalnız gerçekten yapılanı söyler; her değişiklik geri alınabilir (mevcut geri al satırı).

## Sayım

Plan bölümü sayacı kişi başı biletleri sayar (Sabine'in ve Emre'nin gidişi ayrı ayrı: 1/4). Hero sayaçları aynı
mantıkla. Boş kartlar sayaca bugünkü kurala göre girer.

## Kapsam dışı (şimdilik)

- Kişi başı bütçe / masraf bölüşme.
- Başlangıç sohbetinde kişi başı kalkış ("Sabine Alicante'den") — başlangıç sohbeti revizyonu (0.36.21) bittikten
  sonra aynı `Travellers.from` üzerine eklenir.
- Kişi başı belge klasörü.
- Paylaşımda `forWho`: kayıtlar paylaşılmaz (her bilgisayar kayıtlarını paylaşılan sayfalardan kurar; durum,
  `userEdits` ve sohbet planları da yerel kalır), bu yüzden rozet yalnız işaretlendiği bilgisayarda görünür.
  `Travellers.from` ayarlarla paylaşılır. Kayıt düzeyinde bir paylaşım kanalı gelince `forWho` onunla taşınır.
- Kişinin uçuş tarihi ana uçuşun tarihi sonradan değişince onu izlemez (açıldığı günde kalır).

## Sahiplik (iki oturum)

- **Bu oturum:** `types.ts` alanları, `tripSettings` (`from`), yeni `src/lib/whose.ts` (rozet metni, iyelik eki,
  otomatik atama, sayım yardımcıları), asistan araçları, docReader ataması, `EmptyCard.tsx` rozet + aramalar,
  `Travellers.tsx` "Alicante'den" satırı, `WhoseBadge` bileşeni, testler.
- **Diğer oturum (kart ve günler sahibi):** `CardShell`/`PlanCard`/`TransportCard` üst satırına `WhoseBadge`
  yerleştirme, ••• menüsüne "Kimin için?", günlük akış satırı avatarı ve "buluşma" satırı. Arayüz:
  `whoseOf(item, trip) → { names, label, partial } | null` ve `<WhoseBadge item trip />`.

## Test

- Birim: iyelik eki (TR, EN), `whoseOf` (herkes / alt küme / bilinmeyen ad), belge eşleşmesi (aksan, soyad,
  büyük harf), kalkış yeri ataması, kişi silme/ad değiştirme, sayım.
- e2e: iki kişilik gezide sohbetle "Sabine Alicante'den geliyor" → Sabine için boş gidiş kartı, rozet, Alicante
  aramaları "1 kişi"; "bu bilet Sabine'in" → rozet; herkesin olan otel kartında rozet yok; tek kişilik gezide hiç
  rozet yok.
