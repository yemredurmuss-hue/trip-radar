# Niyet planlayıcı ve yeni gezi başlatma akışı (2026-10-06)

Onaylı taslak (Emre, "müthiş kabul ediyorum"): `docs/mockups/2026-10-06-gezi-baslatma-v5.html`.
Eski denemeler: `2026-10-06-olustur-harita-v2*.png` (statik), `2026-10-06-olustur-animasyon-v3.html`
(MapLibre, ağır bulundu), `2026-10-06-olustur-animasyon-v4.html` (hafif, adımlar küçük kaldı).

## Sorun

1. Mesaj gönderilince ekran "şak diye" açılıyor ama hiçbir şey olmuyormuş gibi bekliyor; model okurken
   bunu göstermiyor.
2. Oluştur ekranında harita küçük, ortada, kenarlar boş; uçak fare imleci gibi; çizgi düz. MapLibre
   sürümü (0.36.29) güzel ama bu ekran için ağır.
3. Asıl sorun: planlayıcı tek kalıptan çalışıyor (şehir + otel + aktivite). "Ozora", "Bulgaristan'da
   kayak", "Maldivler balayı", "İsveç'te wellness festivali" dört ayrı gezi tipi; her birinin planı,
   soruları ve tonu farklı olmalı.

## Bölüm 1 — Giriş ve oluşturma animasyonu (önce bu yapılır)

**Görüşme (oluşturmadan önce):**
- Mesaj gönderildiği an, doldurulabilecek satırlar "okuyor" hâline geçer: dönen halka + değer yerinde
  parlayan şerit. Kodun anında bulduğu (kimle, süre) hemen dolar; modelinkiler geldikçe tek tek dolar.
- Sohbette gerçek işe bağlı adım satırı (zıplayan üç nokta + metin): "Okuyorum…", "Ozora Festivali'ni
  tanıyorum…", "2027 tarihlerini resmî siteden kontrol ediyorum…", "Rotayı düşünüyorum…". Her biri
  gerçekten süren bir çağrıya bağlı; çağrı bitince satır kalkar. Sahte süre yok.
- Halka sayacı (x/6) ve ön izleme fotoğrafları bilgi geldikçe güncellenir.
- Soru kalın, seçenekler çip; tavsiye satırı (💡) ayrı bir kutu.
- Hazır olunca "✨ Oluşturuyorum… 3 · Vazgeç" geri sayımı (start-intent'teki kurallar).

**Oluşturma ekranı:**
- Mor zemin, ortada başlık + alt satır (rota · gece), altında **hafif SVG harita kartı** (2.5:1), altında
  **büyük adımlar** (18 px, 28 px ikon, dönen → yeşil dolu tik), ilerleme çubuğu, "Birkaç saniye…".
- Harita: uygulamaya gömülü `static/map/world.json` (Natural Earth 1:110m, 62 KB) SVG olarak çizilir;
  MapLibre ve karo yok, ağ yok. Sıra: dünyadan rotaya yakınlaş (viewBox tween) → ev simgesi + hedef
  etiketi → uçak kavisli rotada uçar (ortada büyür, gölgesi açılır, arkasında renk geçişli iz) → inişte
  halka → hedefe yakınlaş → duraklar etiketiyle düşer (festival durağı pembe) → yer yolu pembe kesikli
  çizilir → fotoğraflar kartın sağ altında yelpaze. Toplam ~9 sn; adımlar senkron.
- MapLibre yalnız panodaki **Harita** sekmesinde kalır (0.36.29). Oluştur ekranı ondan ayrılır.
- Hareketi azalt: son kare doğrudan.

## Bölüm 2 — Niyet oyun kitapları

**Niyet türleri (ilk sürüm):** festival/etkinlik · kayak · balayı · wellness/retreat · şehir gezisi ·
klasik tur (bugünkü). Model ilk mesajdan türü ve özneyi çıkarır (`intent: {kind, name, place, dates?}`);
kod da bilinen etkinlik tablosundan (start-intent, 40+ etkinlik) anında yakalar.

**Her tür için bir oyun kitabı** (`src/lib/playbooks/*.ts`, saf veri + küçük fonksiyonlar):
- *sorular*: türün gerçekten ihtiyaç duyduğu, en fazla 3–4 soru.
- *iskelet*: planın şekli (bölümler, sıra, hangi yer tutucular açılır).
- *kapalı öneriler*: o türde önerilmeyenler (festivalde tur/aktivite).
- *hazırlık*: türün hazırlık listesi.
- *ton*: sohbetin dili (balayında romantik ve sakin, festivalde enerjik).

Örnekler:
- **Festival (Ozora):** giriş havalimanı (BUD) uçuşu → transfer ya da araç kiralama (teslim/iade satırı)
  → festival bloğu (tarihleri sabit, etkinlik olarak "Festival bileti" önerisi resmî linkle) → isteğe bağlı
  öncesi/sonrası (Budapeşte, Balaton). Tur/aktivite önerisi yok. Hazırlık: çadır, uyku tulumu, kafa lambası,
  nakit, kulak tıkacı. Sorular: nereden · kamp mı otel mi · bilet alındı mı · kaç gün önce gidilecek.
  Tavsiye: "Çoğu kişi 1–2 gün erken gidip iyi kamp yeri kapıyor".
- **Kayak (Bulgaristan):** SOF uçuşu → Bansko/Borovets/Pamporovo transferi → otel → kayak pası,
  ekipman kiralama, kayak okulu (seviyeye göre). Sorular: seviye · hangi merkez · ekipman var mı.
- **Balayı (Maldivler):** MLE uçuşu → deniz uçağı/sürat teknesi transferi → resort (su üstü villa) →
  spa, özel akşam yemeği, dalış. Sorular: bütçe · tek resort mu iki resort mu · tarih.
- **Wellness (İsveç):** programın tarihleri (sabit blok) → ulaşım → sakin konaklama; aktivite önerisi az.

**Sohbet tonu:** model türü ve özneyi tanıdığını gösterir ("Ozora! Macaristan'ın Dádpuszta vadisinde…"),
heyecanı paylaşır, tek kısa tavsiye verir, sonra kalın tek soru. Bilmediği şeyi uydurmaz.

**Pano etkisi:** `trip.intent` saklanır; öneri motoru (kurallar + günlük AI incelemesi) oyun kitabının
kapalı önerilerine uyar; festival gezisinde "Douro tekne turu" gibi öneriler gelmez.

## Bölüm 3 — Canlı bilgi: etkinlik tarihleri (web araması)

- Yeni sunucu fonksiyonu `event-info` (Supabase Edge): girdi etkinlik adı + yıl; Gemini "Grounding with
  Google Search" ile resmî tarih, yer ve resmî site; çıktı + kaynak linkleri.
- Önbellek: `trip_radar.event_cache` (ad+yıl başına; 30 gün; resmî siteden teyitli/teyitsiz bayrağı).
  Aynı festival tüm kullanıcılar için bir kez aranır.
- Sohbet devam ederken arkada çalışır; sonuç gelince "Ne zaman" satırı dolar, sohbet "resmî siteden
  teyit ettim" der. Gelmezse tablodaki tahmini tarih "tahmini" etiketiyle kalır.
- **Maliyet (doğrulandı, 2026-10-06):** Gemini 3.x ücretli katmanda **ayda 5.000 arama ücretsiz**, sonra
  **1.000 aramada 14 $**; ücretsiz katmanda arama yok. Anthropic web araması **1.000 aramada 10 $** +
  token. Önbellekle hacim çok düşük; 5.000/ay bizim için büyük ihtimalle bedava.
- **Emre'den gereken:** sunucudaki Gemini anahtarının projesinde faturalandırmayı (billing) açmak.
  Ücretsiz katmanda arama yapılamıyor.
- Gizlilik: yalnız etkinlik adı ve yıl Google'a gider (sunucumuz üzerinden); kişi ve gezi bilgisi gitmez.
  PRIVACY.md'ye satır eklenir (diğer oturum).

## Sıra

1. **Giriş + oluşturma animasyonu** (Bölüm 1) — start-intent yayınlandıktan sonra, onun üstüne.
2. **Oyun kitapları** (Bölüm 2) — festival ve kayakla başla, balayı ve wellness arkadan.
3. **event-info** (Bölüm 3) — Emre faturalandırmayı açınca.

## Kapsam dışı

- Uçuş/otel fiyatı araması (AI öneri kaynağı ayrı iş).
- Etkinlik biletini bizim satmamız.

## Test

- Animasyon: e2e'de okuma hâli (satır `read` sınıfı, sohbet adım satırı), oluşturma ekranında adımların
  büyük ikonları, harita kartında SVG (canvas yok), hareketi azalt.
- Oyun kitapları: birim testleri (Ozora → festival iskeleti, tur önerisi yok, hazırlık listesi; kayak →
  pas/ekipman; balayı → transfer + resort).
- event-info: sahte yanıtla birim testi; önbellek; teyitsiz durumda "tahmini".
