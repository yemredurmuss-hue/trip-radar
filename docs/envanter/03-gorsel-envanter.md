# 03 · Görsel envanter (tüm UI/UX çizimleri ↔ canlı kod)

Tarih: 2026-10-13. Salt okunur çıkarım; kaynak kod değişmedi. Canlı = `plan-v30-fix` dalı (0.36.84, çalışma ağacı).
Çizimler = `docs/mockups/` (tüm uzak dallar `git archive` ile ayrı klasörlere açıldı ve karşılaştırıldı).

## 0. Özet

- **151 üst düzey öğe** (142 dosya/klasör `plan-v30-fix`te; 9 tane daha yalnız `plan-v30-wip`te: v31..v39). Aynı yoldaki dosyalar **dallar arasında birebir aynı** (diff: fark yok); `plan-v30-wip` hepsinin üst kümesi. Hiçbir çizim yalnız eski bir dalda kalmış değil; `main` ve `release` dallarında `docs/mockups` yok.
- **Wip'te v37'den sonra iki sürüm daha var:** `plan-v38-bilet`, `plan-v39-bilet` (uçuş bileti her aşamada gerçek bilet). Mevcut fark listesi (`docs/superpowers/specs/2026-10-13-plan-v37-fark-listesi.md`) v37'yi hedef alıyor; **güncel hedef v39**. Bu belge v30 (canlı), v37 (istenen) ve v39 (en son) için tam görüntü seti içerir; v31..v36, v38 için uçuş ve konaklama bölümü.
- **Alınan görüntü:** img/ altında 197 PNG (~20 MB; renk paleti 256'ya indirildi, 1x). Dökümü §8'de.
- Çizimler tek dosyalık HTML'dir; her plan sürümü bir öncekinin kopyası + katmandır (v37 = v30 + v31..v37 katmanları).
- **Çizim kontrolleri yalnız çizim içindir** (Zaman: Bugün · Yaklaşınca · Uçuş günü · Rötar · İndi; Akış: Omurga · Aranıyor · Sonuçlar [v33+]; "Karta basınca: Çevir/Balon/Çekmece/Kart içinde" [v30–v34], "Hareketi duraklat"; A/B/C senaryo sekmeleri). Bunlar ürüne gitmez; ürün karşılığı olanlar §3 tablosunda.
- Canlı görüntüler **Portekiz (örnek)** gezisiyle alındı (çizim: Japonya 2027 ve Ozora 2027). İçerik farkı (sehir, fiyat, şehir görseli yok → gri yer tutucu, çünkü `city-image` servisi betikte kapalı) fark sayılmadı; yalnız yapı/biçim farkı sayıldı.

## 1. Konu başına envanter

Kısaltma: **SON** = o konunun geçerli/son sürümü. Dal = dosyanın ilk göründüğü dal (tam liste §7).
Tüm yollar `docs/mockups/` altında. Sürüm zinciri sırasıyla yazıldı.

### 1.1 Plan ve Pano (v12 → v39) , ana hat

| | |
|---|---|
| Zincir | `2026-10-08-japonya-web-v6..v11` (v11 canlıya girmiş eski "v11") → `plan-v12` … `plan-v30` (10-10 / 10-11) → `plan-v31-oneri` … `plan-v39-bilet` (10-12 / 10-13). `2026-10-08-ozora-web-v4,v5` festival gezisi plan-v26'dan itibaren "Gezi Planı" içine katıldı (Japonya + Ozora iki gezi tek dosyada). |
| Dallar | v12–13 `gece-giris-0.36.76`, v14–18 `.77`, v19–21 `.78`, v22–30 `hareket-0.36.82`, **v31–v39 yalnız `plan-v30-wip`** |
| Canlıda olan | **v30** (onaylı, 0.36.79–0.36.84) |
| SON | **`plan-v39-bilet/index.html`** (wip). Not: fark listesi v37'yi hedef alıyor; v38/v39 yalnız uçuş biletini inceltiyor |

**Sürüm özeti (v31..v39)**, ayrıntı `plan-v37-fark-listesi.md` §1 ve §3'te: v31 önerili kart ("Önerimiz"), v32 seçili gelen kart, v33 omurga→aranıyor→sonuç akışı, v34 sade kart + ⓘ + yerinde çevirme, v35 büyük arka yüz yerinde biner, v36 taslak kart (kesikli mor) + "AI'a arat", v37 uçuş bileti/niyet etiketi/ferah Pano, **v38** bilette boş daire yok, koçanda aşama etiketi + kişi başı fiyat + "Rezerve et", alınınca büyük yeşil tik; **v39** her durumda gerçek bilet.

#### v30 (canlıda olan)
Plan üstü (senaryo C, 1440): ![v30 plan üstü](img/plan-v30-C-ust.png)

Senaryolar: A Yalnız prompt ![](img/plan-v30-A-ust.png) · B Prompt + linkler ![](img/plan-v30-B-ust.png)

Tam sayfa: ![](img/plan-v30-C-tamsayfa.png)

Bölümler: ![Uçuş](img/plan-v30-bolum-ucus.png) ![Konaklama](img/plan-v30-bolum-konaklama.png) ![Ulaşım](img/plan-v30-bolum-ulasim.png) ![Etkinlik](img/plan-v30-bolum-etkinlik.png) ![Yapılacak](img/plan-v30-bolum-yapilacak.png) ![Belgeler ve internet (Diğer)](img/plan-v30-bolum-belge-internet.png) ![Hazırlık](img/plan-v30-bolum-hazirlik.png) ![İlham](img/plan-v30-bolum-ilham.png)

Yolculuk sırasıyla: ![](img/plan-v30-yolculuk.png)
Gün gün: ![](img/plan-v30-gungun.png)
Pano: ![](img/plan-v30-pano.png)
Kart arka yüzü (Konaklama, "3 seçenek"): ![](img/plan-v30-arka-yuz-konaklama-C.png) ![](img/plan-v30-arka-yuz-ucus-B.png)
Yapışkan şerit: ![](img/plan-v30-yapiskan-serit.png)
Zaman kontrolü, uçuş bölümü: Yaklaşınca ![](img/plan-v30-zaman-yaklasinca-ucus.png) Uçuş günü ![](img/plan-v30-zaman-ucus-gunu-ucus.png) Rötar ![](img/plan-v30-zaman-rotar-ucus.png) İndi ![](img/plan-v30-zaman-indi-ucus.png)
Ozora festival gezisi: ![](img/plan-v30-ozora-ust.png) ![](img/plan-v30-ozora-tamsayfa.png) ![](img/plan-v30-ozora-pano.png) ![](img/plan-v30-ozora-yapiskan.png)
390 px dar: ![](img/plan-v30-dar390-ust.png) ![](img/plan-v30-dar390-yapiskan.png) ![](img/plan-v30-dar390-tamsayfa.png) ![](img/plan-v30-dar390-pano.png)

#### v37 (istenen hedef sürüm)
Üst: ![](img/plan-v37-C-ust.png) Tam: ![](img/plan-v37-C-tamsayfa.png)
Bölümler: ![](img/plan-v37-bolum-ucus.png) ![](img/plan-v37-bolum-konaklama.png) ![](img/plan-v37-bolum-ulasim.png) ![](img/plan-v37-bolum-etkinlik.png) ![](img/plan-v37-bolum-yapilacak.png) ![](img/plan-v37-bolum-belge-internet.png) ![](img/plan-v37-bolum-hazirlik.png) ![](img/plan-v37-bolum-ilham.png)
Yolculuk: ![](img/plan-v37-yolculuk.png) Gün gün: ![](img/plan-v37-gungun.png) Pano: ![](img/plan-v37-pano.png)
Arka yüz (Konaklama): ![](img/plan-v37-arka-yuz-konaklama-C.png) · (Uçuş, senaryo B): ![](img/plan-v37-arka-yuz-ucus-B.png)
Uçuş durumları: A Arıyoruz ![](img/plan-v37-A-bolum-ucus.png) B Önerimiz ![](img/plan-v37-B-bolum-ucus.png) C Bilet alındı ![](img/plan-v37-C-bolum-ucus.png)
Yapışkan şerit ![](img/plan-v37-yapiskan-serit.png) · Ozora ![](img/plan-v37-ozora-ust.png) ![](img/plan-v37-ozora-tamsayfa.png) ![](img/plan-v37-ozora-pano.png)
390 px: ![](img/plan-v37-dar390-ust.png) ![](img/plan-v37-dar390-yapiskan.png) ![](img/plan-v37-dar390-tamsayfa.png) ![](img/plan-v37-dar390-pano.png)
Zaman (uçuş): ![](img/plan-v37-zaman-rotar-ucus.png) ![](img/plan-v37-zaman-ucus-gunu-ucus.png) ![](img/plan-v37-zaman-indi-ucus.png)

#### v39 (en son)
Üst: ![](img/plan-v39-C-ust.png) Tam: ![](img/plan-v39-C-tamsayfa.png)
Bölümler: ![](img/plan-v39-bolum-ucus.png) ![](img/plan-v39-bolum-konaklama.png) ![](img/plan-v39-bolum-ulasim.png) ![](img/plan-v39-bolum-etkinlik.png) ![](img/plan-v39-bolum-yapilacak.png) ![](img/plan-v39-bolum-belge-internet.png) ![](img/plan-v39-bolum-hazirlik.png) ![](img/plan-v39-bolum-ilham.png)
Yolculuk: ![](img/plan-v39-yolculuk.png) Gün gün: ![](img/plan-v39-gungun.png) Pano: ![](img/plan-v39-pano.png)
Arka yüz: ![](img/plan-v39-arka-yuz-konaklama-C.png) ![](img/plan-v39-arka-yuz-ucus-B.png)
Uçuş bileti durumları: A Arıyoruz (boş bilet, tahmin) ![](img/plan-v39-A-bolum-ucus.png) B Önerimiz ![](img/plan-v39-B-bolum-ucus.png) C Bilet alındı ![](img/plan-v39-C-bolum-ucus.png)
Konaklama durumları: A ![](img/plan-v39-A-bolum-konaklama.png) B ![](img/plan-v39-B-bolum-konaklama.png)
Yapışkan şerit ![](img/plan-v39-yapiskan-serit.png) · Ozora ![](img/plan-v39-ozora-ust.png) ![](img/plan-v39-ozora-tamsayfa.png) ![](img/plan-v39-ozora-pano.png) ![](img/plan-v39-ozora-yapiskan.png)
390 px: ![](img/plan-v39-dar390-ust.png) ![](img/plan-v39-dar390-yapiskan.png) ![](img/plan-v39-dar390-tamsayfa.png) ![](img/plan-v39-dar390-pano.png)
Zaman: ![](img/plan-v39-zaman-yaklasinca-ucus.png) ![](img/plan-v39-zaman-ucus-gunu-ucus.png) ![](img/plan-v39-zaman-rotar-ucus.png) ![](img/plan-v39-zaman-indi-ucus.png)

#### Ara sürümler (evrim, uçuş + konaklama bölümü)
v31 ![](img/plan-v31-bolum-ucus.png) ![](img/plan-v31-bolum-konaklama.png)
v32 ![](img/plan-v32-bolum-ucus.png) ![](img/plan-v32-bolum-konaklama.png)
v33 ![](img/plan-v33-bolum-ucus.png) ![](img/plan-v33-bolum-konaklama.png)
v34 ![](img/plan-v34-bolum-ucus.png) ![](img/plan-v34-bolum-konaklama.png)
v35 ![](img/plan-v35-bolum-ucus.png) ![](img/plan-v35-bolum-konaklama.png)
v36 ![](img/plan-v36-bolum-ucus.png) ![](img/plan-v36-bolum-konaklama.png)
v38 ![](img/plan-v38-bolum-ucus.png) ![](img/plan-v38-bolum-konaklama.png)

#### Çizim yapısı notu (v30 → v39)
- v30 `.dd2` "N seçenek/alternatif" düğmesi; v34'ten itibaren `.chg` "Değiştir N". v30'da "Karta basınca" kipi seçilebilir (Çevir/Balon/Çekmece/Kart içinde; yalnız Çevir kaldı v31+; kipler `plan-v30-karta-basinca-*` çekilemedi: seçici gizli düğmeyi tıklatıyor, çizimde yalnız Çevir varsayılan).
- v39'da yalnız **Uçuş** ve **Konaklama** yeniden çizildi; **Ulaşım, Etkinlik, Yapılacak, Belge/İnternet, Hazırlık, İlham v30 ile aynı** (görüntü karşılaştırması: aynı kartlar).

### 1.2 Önceki plan çizimleri (japonya-web / ozora-web / asamalar / ilk-ekran)
| | |
|---|---|
| Dosyalar | `2026-10-08-asamalar-web-v1..v3` (Bali; A–E aşama sekmeleri + "Aşamalar" açıklaması), `2026-10-08-ilk-ekran-v1` (Bali ilk ekran akışı), `2026-10-08-japonya-web-v6..v11`, `2026-10-08-ozora-web-v4,v5` |
| Dal | `claude/blissful-fermi-4zn4h6` (tümü; 12 dalda var) |
| Devam | asamalar-web-v3 → japonya-web-v6 → … → v11 → plan-v12; ozora-web-v5 → plan-v26+ |
| SON | japonya-web-v11 (kendi hattında), ozora-web-v5, asamalar-web-v3: hepsi **plan-v30'a devredildi**; v30 spec: "v11'de olup burada yazmayan her şey Koda geçerken korunacaklar bölümüne tabidir" |

japonya-web-v11 (sekmeler A/B/C/Pano): ![](img/japonya-web-v11-sekme-1-ayalnzpro.png) ![](img/japonya-web-v11-sekme-3-ckararver.png) ![](img/japonya-web-v11-sekme-4-pano.png)
ozora-web-v5: ![](img/ozora-web-v5-sekme-4-dkararver.png) ![](img/ozora-web-v5-sekme-5-pano.png) ![](img/ozora-web-v5-sekme-6-aamalar.png)
asamalar-web-v3: ![](img/asamalar-v3-sekme-5-ekararveri.png) ![](img/asamalar-v3-sekme-7-aamalar.png)
ilk-ekran-v1: ![](img/ilk-ekran-v1-tamsayfa.png)
Diğer sekme görüntüleri img/ içinde: `japonya-web-v11-sekme-2…`, `ozora-web-v5-sekme-1…3`, `asamalar-v3-sekme-1…4,6`.

### 1.3 Giriş akışı (ana ekran → Oluştur → Pano açılır)
Dosyalar: `giris-akisi-v1`, `giris-akisi-v2`, `giris-akisi-v3` (klasör; her biri `index.html` + `img/`). Dal `claude/blissful-fermi-4zn4h6` (10-09). Zincir v1 (beş adım: ana ekran, Enter anı, sohbet, Oluştur, pano açılışı) → v2 (dört adım, Oluştur'a; arka plan A Rota · B Aurora · C Topografya; "Seyahatlerim kartı: Poster") → **v3 "Tek panel, canlı sohbet, çalışan öneriler"** (dört revizyon; Oluştur ekranı gezi listesi + "Gezin şekilleniyor" ilerleme). **SON: v3.** v2'de seçilen arka plan "A · Rota" canlıda (`HomeBackdrop.tsx`).
![v3](img/giris-akisi-v3-tamsayfa.png) ![v2](img/giris-akisi-v2-tamsayfa.png) ![v1](img/giris-akisi-v1-tamsayfa.png)

### 1.4 Açılış / maskot
`sihirli-acilis` (3. tur "Asistanın yüzü: sade maskotlar", 9 maskot adayı: Göz kırpar · Sade · Küre · Radar · Konum · Kağıt uçak · Bulut · Yıldız · Pusula) → `acilis-v2` ("Pıt pıt, ama hafif": A Kıvılcım izi · B Ritim ve sayaçlar · C Sade; saniye saniye açılış). Dallar: `gece-giris-0.36.76` (sihirli), `hareket-0.36.82` (acilis-v2). **SON: acilis-v2** (v2 Önerisi A). Canlı: `Mascot.tsx`, `opening.ts`.
![](img/acilis-v2-tamsayfa.png) ![](img/sihirli-acilis-v1-tamsayfa.png)

### 1.5 Menü alternatifleri
`menu-alternatifleri/index.html` (`hareket-0.36.82`, 10-11): "Menü ve yapışkan özet · üç alternatif": A İki sekme Plan·Pano (Önerilen, 8/10), B Solda menü (6/10), C Plan ve Pano yan yana (7/10); eski yapışkan özet. **Karar: A**, v30'a girdi. B ve C vazgeçildi (kalıcı not: C'nin "Pano'ya git, sağdan çekmece" fikri spec Açık kararlar 3'te ertelendi).
![](img/menu-alternatifleri-v1-tamsayfa.png)

### 1.6 Plan şeritleri
`seritler/index.html` (`gece-giris`, 10-10): "Plan şeritleri A–B": A Şerit planın içinde ("Sıradaki karar" şeridi: aday sayısı, kriter çipleri "Aradığımız", hızlı "X seç" düğmeleri, Karar bekliyor), B Şerit çekmecede; ayrıca Plan/Gün gün/Pano/Belgeler sekmeleri. **SON: tek sürüm**; v30'daki **yapışkan özet şeridi** ("Sıradaki: Osaka konaklaması →") bunun yerini aldı; "Kararlar" bölümü ve adayların şeritte hızlı seçimi yok → bkz. §5.
![](img/seritler-v1-tamsayfa.png)

### 1.7 Katmanlı arayüz
`ux-katmanli-arayuz/index.html` (`claude/blissful-fermi-4zn4h6`, 10-09): "Bugünkü tasarım aynı, üstüne ek bilgi". Onaylananlar: 1 Bütçe çubuğu üstüne gelince; 2 Hero bilgi satırına açıklama kutuları (Euro, C/F priz, −2 saat, Portekizce); 3 Sohbet günlüğü katlanır ("12 değişiklik · 2 geri alındı"); 4 "•••" yerine üstüne gelince ikonlar; 5 Küçük hareket sözlüğü (Mühür, Parlama, Düşüş, Nabız, Yükselme, Sayaç). **SON: tek.** Canlı karşılığı: `HoverTip.tsx`, `ChatFold.tsx`, `motion.ts` (var).
![](img/ux-katmanli-v1-tamsayfa.png)

### 1.8 Kategoriler (plan kategorilere göre)
`2026-10-05-kategoriler-v1..v4.html` + `kategoriler-v2/` (PNG seti c0..c7). v1 plan+günlük akış sekmeli, v2 gerçek kartlarla, v3 sakin, **v4 tek standart (SON)**. Hepsi 10-05, ilk dal `claude/blissful-fermi-4zn4h6`. Plan v30 bu hattın devamıdır (bölüm kabuğu). Eski sürümler içeriği v30'a taşındı.
![v4](img/kategoriler-v4-tamsayfa.png) ![v3](img/kategoriler-v3-tamsayfa.png)

### 1.9 Hero
`2026-10-05-hero-v8.html` (SON çizim; v9 yalnız spec + ref `ref/2026-10-05-hero-v9-referans.webp`, `ref/2026-10-05-hero-canli-gaula.webp`). Hareketli giriş (anlık görüntüler: 0 sn ve 3,5 sn). Canlı hero v9 spec'e göre (`TripHero.tsx`).
![](img/hero-v8-an-1.png) ![](img/hero-v8-an-2.png)

### 1.10 Gün akışı / Gün gün
Zincir: `2026-10-05-gunluk-akis-v1..v3` (fotoğraflı gün kartları, "Gezi öncesi / Gezi sırasında", "Romantik bir Porto günü") → `2026-10-06-gun-akisi-standart-v1,v2` (satır standardı: NE / HANGİSİ, "Porto 1. Gün Varış") + PNG'ler `gun-gruplari`, `gunluk-akis-cizgi-*`, `gunluk-akis-kisa`. **SON: gun-akisi-standart-v2** (canlı "Gün gün" kompakt satır; `days/DayCards.tsx`, `dayRowTitle.ts`). Foto gün kartları kasten bırakıldı, bkz. §5.
![standart v2](img/gun-akisi-standart-v2-tamsayfa.png) ![günlük v3 (eski)](img/gun-akisi-gunluk-v3-tamsayfa.png)

### 1.11 Fikirler / yapılacaklar havuzu
`2026-10-05-fikirler-v1.html` → `2026-10-05-fikir-havuzu-v1.html` (**SON**): durum sekmeleri Havuzda · Günü var · Kaçtı · Yapıldı, tür çipleri, her satırda +Gün/Harita, Gezi öncesi/Gezi sırasında iki sütun. Canlı: `ideas/IdeaList.tsx` (var).
![](img/fikir-havuzu-v1-tamsayfa.png) ![](img/fikirler-v1-tamsayfa.png)

### 1.12 Etkinlik · eSIM · sigorta; Ulaşım
`2026-10-05-etkinlik-v4.html` (SON) ![](img/etkinlik-esim-sigorta-v4-tamsayfa.png)
`2026-10-05-ulasim-v3.html` (SON): ulaşım şablonları (uçak, tren, otobüs, minibüs, vapur…) ![](img/ulasim-v3-tamsayfa.png)

### 1.13 Paylaşım güvenliği
`2026-10-05-paylasim-guvenligi-v1.html` (SON, tek; ilk dal blissful; 10-06 commit): "Karşı taraf değiştirirse", "Sen silerken", "Değişiklik geçmişi / çöp kutusu 30 gün / geri al". Canlı: `ShareSafety.tsx`, `HistoryDialog.tsx` (var).
![](img/paylasim-guvenligi-v1-tamsayfa.png)

### 1.14 Öneriler, arama, karşılaştırma, boş kartlar
- `2026-10-06-ai-oneriler-turler-v1..v3` (SON v3) ![](img/ai-oneriler-v3-tamsayfa.png)
- `2026-10-06-arama-ve-oneriler-v1,v2` (SON v2) ![](img/arama-oneriler-v2-tamsayfa.png)
- `2026-10-06-bos-kartlar-v1` ![](img/bos-kartlar-v1-tamsayfa.png)
- `2026-10-07-plan-oneriler-v1..v9` (+ PNG'ler `-v1-1`…`-v9-3`; **SON v9**: Karşılaştır penceresinin büyüyüşü, kartlar/tablo, "Seçeneklerin sırası") ![](img/plan-oneriler-v9-tamsayfa.png)
- `2026-10-07-plan-pdf-ornek.pdf` (PDF dışa aktarım örneği, canlıda `PrintPlan.tsx`)
Hepsi `claude/blissful-fermi-4zn4h6` dalında; tarihleri 10-06/10-07.

### 1.15 Gezi başlatma / Oluştur / Harita
`2026-10-06-sohbetle-gezi-v1` (Laylo tarzı, sohbetle gezi başlat) ![](img/sohbetle-gezi-v1-tamsayfa.png) · `gezi-baslatma-v5` (SON) ![](img/gezi-baslatma-v5-an-2.png) · `olustur-animasyon-v3→v4` (SON v4, hafif) ![](img/olustur-animasyon-v4-an-2.png) · `olustur-harita-v2` (+ `-inis`, `-ucus` PNG) ![](img/olustur-harita-v2-an-1.png) · `harita-maplibre-v1` (harici harita CDN'i/çiniler gerektirdiğinden betikte boş çıktı; deponun kendi PNG'si: ![](img/harita-maplibre-v1-repo.png)).
Canlı: `start/StartChat.tsx`, `start/Generating.tsx`, `map/TripMap.tsx`.

### 1.16 Kişiye özel rezervasyon · Otel panosu
`2026-10-06-kisiye-ozel-v1` (+ PNG `kisiye-ozel-uygulamada-plan/gun`): "Sabine'nin bileti", kart menüsü "Kimin için?" ![](img/kisiye-ozel-v1-tamsayfa.png)
`2026-10-06-otel-panosu-v1,v2` (SON v2) ![](img/otel-panosu-v2-tamsayfa.png)

### 1.17 Referans ve uygulamadan alınmış ekranlar
`ref/` (hero referansları, `illustrasyon-seti-kategoriler.jpeg`, `illustrasyon-seti-kontak.html/png`) · `2026-10-09-pano-canli-*.png`, `rezervasyon-penceresi-canli.png`, `vize-belgeler-ve-internet.png` (canlıdan alınmış, çizim değil) · `2026-10-06-ucus-karti-v6.png`, `ucus-karti-uygulamada.png`. Görüntüleri yeniden alınmadı (dosyaların kendisi PNG/webp).

## 2. Canlı uygulama görüntüleri (plan-v30-fix, 0.36.84)
`scripts/v30-shots.mjs`, 1440 px, `faketime 2026-10-05`, Portekiz (örnek) gezisi, Türkçe:
![](img/canli-01-plan-top.png) ![](img/canli-02-sticky.png)
Bölümler: ![](img/canli-sec-0-flight.png) ![](img/canli-sec-1-stay.png) ![](img/canli-sec-2-transport.png) ![](img/canli-sec-3-activity.png) ![](img/canli-sec-4-todo.png) ![](img/canli-sec-5-other.png)
Arka yüz: ![](img/canli-back-stay.png) ![](img/canli-back-flight.png) · katlama: ![](img/canli-sec-2-transport-fold.png)
Yolculuk: ![](img/canli-03-story.png) Gün gün: ![](img/canli-04-days.png) Menü: ![](img/canli-05-menu.png) Belgeler: ![](img/canli-06-docs.png) Pano: ![](img/canli-07-pano.png)
390 px: ![](img/canli-dar390-01-plan-top.png) ![](img/canli-dar390-02-sticky.png) ![](img/canli-dar390-sec-1-stay.png) ![](img/canli-dar390-07-pano.png)

## 3. Mockup ↔ canlı karşılaştırma

**Üç kolon:** *çizimde* (v30 = canlıya alınan çizim; v39 = hedef) · *canlıda* (0.36.84) · *fark*. Yapısal eşleşme çok yüksek; v30'da canlıyla tek tek örtüşmeyen şeyler küçük. Asıl büyük fark v31–v39 katmanında (§4).

### 3.1 v30 çizimi ↔ canlı

| Ekran / bileşen | Çizimde (v30) | Canlıda | Fark |
|---|---|---|---|
| Üst çubuk | "Trip Radar" markası, gezi seçici "Japonya 2027 ▾", ortada Plan·Pano (sayı), sağda ••• ve avatarlar | Sol panelde "‹ Seyahatlerim", ortada Plan·Pano (sayı); ••• hero köşesinde; kabuk çubuğu yok | Çizim kabuğu (marka + gezi seçici ▾ + avatarlar) canlıda yok; ••• yeri farklı. Küçük, çizim çerçevesi olabilir |
| Sol sohbet paneli | "Seyahat asistanı" kutusu, kişi/asistan mesajları, "Birlikte değerlendirelim…" | "Asistan" başlığı + mesajlar, "Bir link bırak, görsel yapıştır veya yaz…" | Metin ve düzen eşdeğer |
| Hero | Kapak çizimi + şehir sekmeleri (Tokyo/Hakone/Kyoto/Osaka), "175 gün kaldı", ad, tarih "sakura tahmini" hapı, tek satır; 4 sayaç; ilerleme "Japonya planın şekilleniyor: 6 rezerve · 4 seçildi · 3 aranıyor" + "Planı tamamla →" | Şehir sekmeleri, "3 gün kaldı", ad, tarih, 4 sayaç; ilerleme "Planlananların %50'si rezerve", ⏳ rozeti, "6 ihtiyaç karar bekliyor · 2 rezerve edilecek", "Planı tamamla →", **"PDF indir"** | Metin farklı; canlıda **PDF indir** + ⏳ rozeti var, çizimde yok. Kapak görseli betikte yok (servis kapalı) |
| Sağ bilgi paneli | Kişiler, Bütçe (Rezerve/Seçilen/Henüz), Tahmini toplam, Tercihler "+4 tercih ›", ülke satırı + hava + para/priz/saat/dil | Aynı yapı; "Düzenle ›" ve "1 soru" | Eşdeğer |
| Plan başlığı | "Plan" · Kategoriye göre/Yolculuk sırasıyla/Gün gün · + Ekle · renk anahtarı (Arıyoruz/Seçildi/Rezerve) | Aynı | Aynı |
| Gezinin şekli | 46 px halkalar + hareketli uçak/tren, süre | Aynı (hareket dahil) | Aynı |
| Yapışkan şerit | Kapak küçük · ad · gün · %77 hazır halkası · bütçe · Plan|Pano · "Sıradaki: Osaka konaklaması →" | Aynı (kapak yok, "Sıradaki: Lisboa Loft →") | Aynı; küçük kapak resmi yok (görsel yok) |
| Bölüm kabuğu | Beyaz kart, renkli ikon, "Uçuş 2 ✨", aşama satırı, iki renkli çubuk + harcanan/bütçe, ok | Aynı; ayrıca bölüm altında "+ Ekle" ve "Gizlenenler" | Canlı "Bütçe yok" durumunda "€440 ayrıldı"; çizimde "€3.480 / €3.500" |
| Uçuş kartı | Kavisli rota, havayolu, koçan altta (PNR/yolcu/fiyat), rezerve damgası | Aynı | Aynı |
| Konaklama kartı | Görsel + marka + puan + gece, alt şerit "Pano'da N alternatif · Rezerve et ↗" | Aynı | Aynı |
| Kart arka yüzü ("N seçenek") | Büyük karo ızgarası + "Pano" karosu, "Daha fazla bul", "Kendin ara", kart yerinde döner | Tek ızgara; karolarda uyum puanı, Neden?, Tüm detaylar; ‹ 1/3 › ve klavye okları; "Seçmeden kontrol et" uyarısı; Karşılaştır | Canlı **daha zengin** (uyum puanı, Neden?, ok gezinmesi); çizim karo sayısı sınırlı |
| Ulaşım | Kart + mod seçici (Tren/Otobüs/Araba/Uçak/Ben hallettim) | Aynı | Aynı |
| Etkinlik ve turlar | Tek ızgara: Bilet alındı + Önerimiz kareleri + Sabine ekledi, "Başka öneriler", "Ekle" | **"Planda" + katlanabilir "Öneriler ve fikirler"** (0.36.70 revizesi), "Daha fazla fikir", kaynak yoksa "Kendin ara" | Canlı iki bölüme ayırıyor (Emre'nin revizesi); çizim tek ızgara. Bilinçli fark |
| Yapılacak ve restoranlar | Şehir omurgası (1-4), kare ızgara, aralarda ulaşım satırı | Aynı omurga + Hepsi/Gezilecek yerler/Restoranlar çipleri, ⋯ menü, "Daha fazla öner" | Canlı çip filtreli; kuralı aynı |
| Belge ve internet (Diğer) | Vize yeşil satır, sigorta, eSIM kartları | Aynı (vize amber "Vize gerekiyor · Vize alındı") | Aynı |
| Hazırlık / İlham | 3 sütun onay kutusu / ilham kartları | Aynı (v30-shots.mjs bu bölümleri de çekiyor) | Aynı |
| Yolculuk sırasıyla | İki sütun: şehir omurgası, kart + "BURADA" etkinlik listesi | Tek sütun zaman çizelgesi, geniş kartlar + "BURADA" yan listesi, "Eve dönüş" | Düzen benzer; canlı kartlar daha büyük, çizim sıkı iki sütun |
| Gün gün | Tek satır/gün: tarih kutusu, satırlar, "Gece: Kyoto…", "Serbest gün · yapılacaklardan seç" | Aynı satır standardı + **Liste \| Harita anahtarı** | Canlı **çizimde olmayan harita görünümü** ekledi (ileride) |
| Pano | Sol kategori listesi (+Beğenilenler), arama, "Link ekle", "Hepsi/Karar bekleyen/Planda", sırala, ihtiyaç başına grup, "Senin için:" kutusu, karolar | Aynı yapı (Beğenilenler dahil) | Aynı. v37 Pano "ferah" değişikliği henüz yok |
| Gezi menüsü ••• | Belgeler · Paylaş · PDF · Geçmiş | Aynı (05-menu, 06-docs) | Aynı |
| 390 px | Tek sütun; asistan üstte, Plan/Pano altta; yapışkan şerit kısalır | Aynı | Aynı |
| Ozora (festival) | Festival kapağı, "Gezinin sebebi" bilet kartı, "Festivalden sonra · dinlenme", otel yerine çadır/kamp | Canlıda örnek gezi Portekiz; festival şablonu kodda var (`kamp/festival`, `ActivityBoard`) ama bu betikte çekilmedi | Doğrulanamadı: canlıda Ozora örneği yok |
| Zaman kontrolü (Yaklaşınca/Uçuş günü/Rötar/İndi) | Çizim aracı | Gerçek zamana bağlı: PNR uçuş günü, rötar kutusu, "indi" vb. (`flightAlert`, `FlightTiles`) | Ürün davranışı; çizim bunu v30'da gösteriyor, canlıda zaman gerçek |

### 3.2 v39 (hedef) ↔ canlı (v30)

Ayrıntılı kod eşlemesi (dosya/satır, boyut S/M/L, bağımlılık) ve 17 açık soru: `docs/superpowers/specs/2026-10-13-plan-v37-fark-listesi.md`. Aşağısı görsel özet.

| Ekran / bileşen | Çizimde (v39) | Canlıda | Fark |
|---|---|---|---|
| Plan anahtarı | 4 kutu: Arıyoruz · **Önerimiz** (kesikli mor) · Seçildi · Rezerve; bölüm başlığında "2 önerimiz · 1 seçildi" | 3 kutu | **Yok:** 4. durum "Önerimiz" |
| Taslak kart | Eli dolu uçuş/otel ihtiyacında en uygun hazır: kesikli mor, beyaz, "✨ Önerimiz"; seçince "Seçildi" | Seçenekli ama seçilmemiş ihtiyaç tek boş kart ("Arıyoruz · N seçenek ›") | **Yok** (L) |
| Uçuş bileti | Yatay bilet + 132 px koçan, 46 px durum dairesi (Arıyoruz boş · Aranıyor dönen · Önerimiz mor · Seçildi yeşil · Bilet alındı dolu yeşil tik), kişi başı fiyat büyük, "Rezerve et ↗", ⓘ | Dikey kart, kavisli rota, koçan alt kenarda, rezervede toplam | **Yok** (L) |
| Boş uçuş | Bilet çerçevesi: "Aradığımız: direkt", "~€850–1.000 tahmini · kişi başı", "Seçenek ara" | EmptyTravelCard: "€118'den başlıyor", Kendin ara, ✨ | Tahmin aralığı uçuşta yok |
| Otel kartı | Sade: görsel + **niyet etiketi** ("Hakone · 6–8 Nis · 2 gece"), marka+puan, ad; alt: [Değiştir N] · €/gece · [Rezerve et ↗]; ayrıntı ⓘ'de | Zengin: marka/semt, puan·yorum, tarih·gece, iptal satırı, toplam | **Yok:** sade yüz, ⓘ balonu, niyet etiketi |
| ⓘ düğmesi | Uçuş/otel kartlarında balon (klavye/odak ile) | Yalnız uçuşta fare üstü peek | **Yok** (klavye/dokunma yolu yok) |
| Köşe yüzü | Kartın köşesinde kim kaydetti / AI | Yalnız arka yüz karolarında ve Pano'da | **Yok** |
| Arka yüz | Satır genişliğinde, satırın üstüne biner (kaymaz); iki bölüm: **Kaydettikleriniz** (≤3 karo + "Kendin ara" kutucuğu) ve **Önerimiz** (≤3 karo + "AI'a arat" kutucuğu); etiket Seçili/Kartta/Yeni | Satırı akışta kaplar, yan kart kayar; tek ızgara (≤7) + "Pano" karosu, "Daha fazla bul", "Kendin ara" altbilgide | **Yok** (M+M); uyum puanı/Neden?/✓✕/ok gezinmesi çizimde yok (bkz. §5) |
| Pano kartı | Şerit sütunu 296–316 px, uçuşta şehirler arası `ucus.png`, kişi başı büyük fiyat | 250–272 px, kesik yay, toplam fiyat | **Yok** (S) |
| Zaman anahtarı (Rötar, Uçuş günü, İndi) | Yeni bilette **etkisiz** (v39 görüntüleri "Bugün" ile aynı) | PNR/rötar/"indi" çalışıyor | Çizim bu durumları çizmiyor → kodda kaybolmamalı (§5) |
| Akış (Omurga→Aranıyor→Sonuçlar) | Çizim aracı + öneri akışı fikri | Yok | Ürün kararı bekliyor (soru 10) |

## 4. Yalnız mockup'ta olan / kodda olmayan

(`plan-v37-fark-listesi.md` ile örtüşür; v38/v39 eklendi. Kod karşılığı ve boyut orada.)

**A. v31–v39 katmanından gelen ve canlıda olmayanlar (geçerli):**
1. Taslak / "Önerimiz" kartı ve 4. durum (A1, A2): L.
2. Köşe yüzü (A3), "Değiştir N" (A4), sade otel ön yüzü (B1), ⓘ (B3), "Rezerve et ↗" birincil düğme (B4).
3. Uçuş bileti: tek bilet düzeni, 132 px koçan, 46 px durum dairesi, büyük kişi başı fiyat (C1–C3); boş uçuş "Aradığımız: direkt" + tahmin aralığı (C4); Bilet alındı belge çipi (C5).
4. Otelde niyet etiketi (D1).
5. Arka yüz: yerinde biner, iki bölüm, karo etiketleri, "Kendin ara" ve "AI'a arat" kutucukları (E1–E6).
6. Pano "ferah" (F1–F3).
7. v38/v39: bilette boş daire yok, alınmadan koçanda aşama etiketi; her durumda gerçek bilet. Henüz `fark-listesi`nde değil: C1/C2 ile aynı iş, tek değişiklik durum sözlüğü ve boş durum görseli.

**B. Çizim aracı, ürüne gitmeyecek:** Zaman düğmesi, Akış (Omurga/Aranıyor/Sonuçlar), "Karta basınca" kipleri, "Hareketi duraklat", A/B/C sekmeleri, "Bu ekranda ne var?".

**C. Vazgeçilenler (uygulanmayacak, kayıt için):** kenarda açılan seçenekler (Yan yana · Balon · Çekmece), "Bunu seç" balonu, "bulduğun linki buraya bırak" kutusu (v32), alternatif şeridi/`peek` ve fiyat farkı "−€40" (v33), kompakt satır liste arka yüz (v34), "Kendin ara" üçüncü bölüm (v35), Menü B/C, Şerit çekmecesi.

**D. Eski çizimde var, canlıda yok (kontrol edildi):**
- `japonya-web-v11` / `plan-v30` ölçüsünde eksik yok; v11 fark listesi (2026-10-09) işlendi.
- Çizimde olup canlıda bulunmayan ürün özelliği bulunamadı **v30 için**; canlının çizimde olmayan fazlalıkları: PDF indir bağlantısı, Gün gün **Harita** anahtarı, Etkinlik "Planda / Öneriler ve fikirler" ayrımı, bölüm altı "+ Ekle", "Gizlenenler".
- Ozora (festival) planı: kodda şablon var (`kamp/festival`), canlı örnek gezide gösterilmiyor; çizim `plan-v30-ozora-*`.

## 5. Kaybolmuş olabilir (eski sürümlerde var, son sürümlerde unutulmuş)

Her madde: nerede çizilmiş → son sürümde durumu → öneri. "Bilinçli" = bir spec/commit açıkça bıraktı.

1. **Bilet alındı dışındaki canlı uçuş durumları (rötar, kapı değişti, PNR uçuş günü, "Planı yeni saate göre kaydırdım").** v30'da zaman düğmesiyle çizili (`plan-v30-zaman-rotar-ucus.png`: kırmızı saat, "Rötar 45 dk · Kapı değişti: B14", PNR koçanda). v37/v39 bileti hiçbirini çizmiyor (`plan-v39-zaman-rotar-ucus.png` = bugün ile aynı). Spec §4 de uyarıyor. **En riskli kayıp**; koda geçerken `FlightTiles`, `flightAlert`, `ticketDiff`, PNR-uçuş günü kuralı korunmalı; bilette rötar/kapı satırı çizilmeli.
2. **Kart ••• menüsü, × katlama, ✓ Aldım, "Kimin için?"** v30'da var (kartta hover); v37–v39 sade kart/biletlerde çizilmiyor. Önceki tur kuralı "bilinçli korunanlar". Sorulara bağlı (soru 5).
3. **Arka yüzde uyum puanı, "Neden?", ihtiyaç ✓/✕, "Seçmeden kontrol et", Karşılaştır, ‹ › + klavye okları, "Aradığımız" çipleri** (`plan-oneriler-v9`, v19 klavye okları; canlıda `canli-back-stay.png`). v35–v39 karoları (3+1 sınırı) çizmiyor. Hangisi ⓘ/Pano'ya taşınacak karar bekliyor (soru 7).
4. **Plan şeridi "Sıradaki karar" kartı:** adaylar yan yana, kriter çipleri, kartta hızlı "X seç" (`seritler-v1`). v30 yapışkan şeridi yalnız "Sıradaki: …" bağlantısı; adayların ve kriterlerin şeritte seçimi kayıp. (Karşılaştır penceresi ve arka yüzde karşılığı var.)
5. **Gün gün fotoğraflı gün kartları, günün temalı başlığı ("Romantik bir Porto günü"), "Gezi öncesi / Gezi sırasında" kipi** (`gunluk-akis-v3`). v30 kompakt satır "bilinçli" olarak onların yerini aldı (`DayCards.tsx` yorumu: eski foto kartlar gitti). Güzel fikir: gün başlığına AI'ın yazdığı tema ve gün fotoğrafı; ayrı bir "Gün gün · Kartlar" görünümü olarak geri getirilebilir.
6. **Uyarılar:** "⏳ iptal bugün biter", son 14 gün bilet, "İade yok" (v30 var; v37 uçuş bileti ve sade otel kartı yalnız "İade yok"u tutuyor). Tarihe bağlı uyarılar korunmalı.
7. **"Ayarlandı" (Ben hallettim) uçuşu** v30'da; v37+ eski karta bırakıyor (değişmez). Bilet çizimine karşılığı yok.
8. **Kimin için / kişiye özel** (`kisiye-ozel-v1`: "Sabine'nin bileti", kart menüsünde Herkes/Ben/Sabine) v39 bileti ve sade otelde görünür değil; yalnız köşe yüzü (A3) kim kaydetti diyor, kim için demiyor.
9. **v32 "bulduğun linki buraya bırak"** (arka yüzde link yapıştır) ve **v33 karoda fiyat farkı ("−€40")**: kasıtlı vazgeçildi ama kullanıcıya değerli (kendi bulduğu linki doğrudan kart seçeneği yapmak). Canlıda link bırakma yalnız sohbette/Pano'da.
10. **"Pano'ya git, sağdan çekmece"** (menu-alternatifleri C): ertelendi (spec Açık kararlar 3).
11. **Yapışkan şeritte Plan|Pano geçişi ve bütçe** v39'da var ama "Önerimiz" taslak sayımı belirsiz (soru 2).
12. **Giriş akışı v2 arka plan alternatifleri** (B Aurora, C Topografya): bilinçli elendi; kayıt için `giris-akisi-v2` içinde duruyor.
13. **Hero v9 referans görselleri** (`ref/…hero-v9-referans.webp`): çizim v8; canlı v9 spec'e göre kodlanmış (kaybolmadı, yalnız ayrı dosyada).

## 6. Yöntem ve sınırlar

- Mockup dosyaları file:// ile açıldı (Playwright + Chromium 1194, headless, 1440×1000, 1x; dar 390×1000). Tam sayfa için görüntü yüksekliği sayfa yüksekliğine ayarlandı (en çok 12.000 px). Animasyonlar için 1,2–2,5 sn beklendi; Hero, Gezi başlatma, Oluştur animasyonu için iki ayrı an (0 sn ve +3,5 sn) alındı.
- Çizim içi durumlar: **C = Karar ve rezerve** (A/B kısmen), 5 zaman durumu (uçuş bölümünde), Japonya ve Ozora, 390 px.
- Alınamayanlar: v30 "Karta basınca" kipleri (Balon/Çekmece/Kart içinde; seçici düğmeler gizli), harita-maplibre (CDN/çini; deponun PNG'si kullanıldı), v31–v36 için tam set (yalnız Uçuş ve Konaklama bölümü), canlıda Ozora örneği.
- v30-shots.mjs yerel (canlı) örnek gezi Portekiz; şehir görselleri servisi betikte kapalı olduğundan hero kapağı gri.

## 7. Tam liste (151 öğe)

Sütunlar: konu · öğe · ilk görüldüğü dal · ilk commit tarihi (git log, ekleme commit'i) · çizimin `<title>`'ı · durum. Dosya adındaki tarih (`2026-10-0X-…`) çizimin tasarım gününü, ilk commit tarihi dala girişini gösterir (10-05–10-09 dosyaları 10-09 civarında toplu girmiş olabilir). "ilk dal" sütunu, 12 dalda var olan çizimler için en eski dal olan `claude/blissful-fermi-4zn4h6`'dır.

| Konu | Öğe | İlk dal | İlk commit | Başlık | Durum |
|---|---|---|---|---|---|
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | AI önerileri · her tür v2 | önceki sürüm |
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | AI önerileri · her tür v2 | önceki sürüm |
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | AI önerileri · her tür v3 | SON |
| AI önerileri (her tür) | `2026-10-06-ai-oneriler-turler-v3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Arama ve öneriler | `2026-10-06-arama-ve-oneriler-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Arama ve öneriler v1 | önceki sürüm |
| Arama ve öneriler | `2026-10-06-arama-ve-oneriler-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Arama ve öneriler | `2026-10-06-arama-ve-oneriler-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Arama ve öneriler v2 | SON |
| Arama ve öneriler | `2026-10-06-arama-ve-oneriler-v2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Açılış / maskot | `acilis-v2` | hareket-0.36.82 | 2026-10-10 | Trip Radar Açılış v2 | SON |
| Açılış / maskot | `sihirli-acilis` | gece-giris-0.36.76 | 2026-10-10 | Trip Radar Sihirli Açılış | önceki (acilis-v2 devam) |
| Boş kartlar | `2026-10-06-bos-kartlar-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Boş kartlar v1 | SON |
| Boş kartlar | `2026-10-06-bos-kartlar-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Canlı uygulamadan alınmış ekran (10-09) | `2026-10-09-pano-canli-dar.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Canlı uygulamadan alınmış ekran (10-09) | `2026-10-09-pano-canli-konaklama.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Canlı uygulamadan alınmış ekran (10-09) | `2026-10-09-pano-canli-tumu.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Canlı uygulamadan alınmış ekran (10-09) | `2026-10-09-rezervasyon-penceresi-canli.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Canlı uygulamadan alınmış ekran (10-09) | `2026-10-09-vize-belgeler-ve-internet.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Etkinlik, eSIM, sigorta | `2026-10-05-etkinlik-v4.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Etkinlik, eSIM ve sigorta v4 | SON |
| Fikirler / yapılacaklar havuzu | `2026-10-05-fikir-havuzu-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Fikir havuzu v1 | SON |
| Fikirler / yapılacaklar havuzu | `2026-10-05-fikir-havuzu-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Fikirler / yapılacaklar havuzu | `2026-10-05-fikirler-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Fikirler ve yapılacaklar v1 | önceki sürüm |
| Gezi aşamaları (Bali) | `2026-10-08-asamalar-web-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Bali Planı Aşamaları | önceki sürüm |
| Gezi aşamaları (Bali) | `2026-10-08-asamalar-web-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Bali Planı Aşamaları | önceki sürüm |
| Gezi aşamaları (Bali) | `2026-10-08-asamalar-web-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Bali Planı Aşamaları | SON |
| Gezi başlatma / Oluştur | `2026-10-06-gezi-baslatma-v5.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Gezi başlatma akışı v5 | SON |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-animasyon-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Oluştur animasyonu v3 | önceki sürüm |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-animasyon-v4.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Oluştur animasyonu v4 (hafif) | SON |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-harita-v2-inis.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-harita-v2-ucus.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-harita-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Oluştur ekranı v2 | SON |
| Gezi başlatma / Oluştur | `2026-10-06-olustur-harita-v2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Gezi başlatma / Oluştur | `2026-10-06-sohbetle-gezi-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Sohbetle gezi başlat v1 | tek |
| Gezi başlatma / Oluştur | `2026-10-06-sohbetle-gezi-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gezi haritası | `2026-10-06-harita-maplibre-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Gezi haritası v1 | tek |
| Gezi haritası | `2026-10-06-harita-maplibre-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Giriş akışı | `giris-akisi-v1` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Giriş Akışı Çizimi | önceki sürüm |
| Giriş akışı | `giris-akisi-v2` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Giriş Akışı Çizimi | önceki sürüm |
| Giriş akışı | `giris-akisi-v3` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Giriş Akışı Üçüncü Tur | SON |
| Gün akışı | `2026-10-05-gunluk-akis-v1-acik.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v1-kapali.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Trip Radar · Günlük akış v1 | önceki sürüm |
| Gün akışı | `2026-10-05-gunluk-akis-v2-bugun.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v2-kapali.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Trip Radar · Günlük akış v2 | önceki sürüm |
| Gün akışı | `2026-10-05-gunluk-akis-v3-bugun.png` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v3-kapali.png` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | - | ek görüntü |
| Gün akışı | `2026-10-05-gunluk-akis-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Günlük akış v3 | önceki sürüm |
| Gün akışı | `2026-10-06-gun-akisi-standart-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Gün akışı satır standardı v1 | önceki sürüm |
| Gün akışı | `2026-10-06-gun-akisi-standart-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gün akışı | `2026-10-06-gun-akisi-standart-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Gün akışı satır standardı v2 | SON |
| Gün akışı | `2026-10-06-gun-akisi-standart-v2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gün akışı | `2026-10-06-gunluk-akis-cizgi-sehir.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gün akışı | `2026-10-06-gunluk-akis-cizgi-yolculuk.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gün akışı | `2026-10-06-gunluk-akis-kisa.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Gün akışı (ek görüntüler) | `2026-10-06-gun-gruplari.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Hero | `2026-10-05-hero-v8.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Hero taslağı v8 | SON |
| Katmanlı arayüz (üstüne gelince bilgi) | `ux-katmanli-arayuz` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Trip Radar Katmanlı Arayüz | tek |
| Kişiye özel rezervasyon | `2026-10-06-kisiye-ozel-uygulamada-gun.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Kişiye özel rezervasyon | `2026-10-06-kisiye-ozel-uygulamada-plan.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Kişiye özel rezervasyon | `2026-10-06-kisiye-ozel-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Kişiye özel rezervasyon v1 | tek |
| Kişiye özel rezervasyon | `2026-10-06-kisiye-ozel-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Menü alternatifleri | `menu-alternatifleri` | hareket-0.36.82 | 2026-10-11 | Menü Alternatifleri | tek (karar: A) |
| Otel panosu | `2026-10-06-otel-panosu-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Otel panosu v1 | önceki sürüm |
| Otel panosu | `2026-10-06-otel-panosu-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Otel panosu | `2026-10-06-otel-panosu-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Otel panosu v1 | SON |
| Otel panosu | `2026-10-06-otel-panosu-v2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| PDF örneği | `2026-10-07-plan-pdf-ornek.pdf` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | tek |
| Paylaşım güvenliği | `2026-10-05-paylasim-guvenligi-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | Paylaşım güvenliği v1 | SON |
| Paylaşım güvenliği | `2026-10-05-paylasim-guvenligi-v1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Plan kategorilere göre | `2026-10-05-kategoriler-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Plan kategorilere göre v1 | önceki sürüm |
| Plan kategorilere göre | `2026-10-05-kategoriler-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Plan kategorilere göre v2 (gerçek kartlarla) | önceki sürüm |
| Plan kategorilere göre | `2026-10-05-kategoriler-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Plan kategorilere göre v3 (sakin) | önceki sürüm |
| Plan kategorilere göre | `2026-10-05-kategoriler-v4.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Plan kategorilere göre v4 (tek standart) | SON |
| Plan kategorilere göre | `kategoriler-v2` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | - | png seti |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v10.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | önceki sürüm |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v11.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | SON (plan-v12'ye devretti) |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v6.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | önceki sürüm |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v7.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | önceki sürüm |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v8.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | önceki sürüm |
| Plan ve Pano (Japonya çizimi) | `2026-10-08-japonya-web-v9.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Japonya Planı | önceki sürüm |
| Plan ve Pano (Ozora festival) | `2026-10-08-ozora-web-v4.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Ozora Planı | önceki sürüm |
| Plan ve Pano (Ozora festival) | `2026-10-08-ozora-web-v5.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Ozora Planı | SON (plan-v26+'ya katıldı) |
| Plan ve Pano (v30 hattı) | `plan-v12` | gece-giris-0.36.76 | 2026-10-10 | Japonya Planı v12 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v13` | gece-giris-0.36.76 | 2026-10-10 | Japonya Planı v13 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v14` | gece-giris-0.36.77 | 2026-10-10 | Japonya Planı v14 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v15` | gece-giris-0.36.77 | 2026-10-10 | Japonya Planı v15 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v16` | gece-giris-0.36.77 | 2026-10-10 | Japonya Planı v16 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v17` | gece-giris-0.36.77 | 2026-10-10 | Japonya Planı v17 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v18` | gece-giris-0.36.77 | 2026-10-10 | Japonya Planı v18 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v19` | gece-giris-0.36.78 | 2026-10-10 | Japonya Planı v19 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v20` | gece-giris-0.36.78 | 2026-10-10 | Japonya Planı v20 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v21` | gece-giris-0.36.78 | 2026-10-10 | Japonya Planı v21 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v22` | hareket-0.36.82 | 2026-10-11 | Japonya Planı v22 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v23` | hareket-0.36.82 | 2026-10-11 | Japonya Planı v23 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v24` | hareket-0.36.82 | 2026-10-11 | Japonya Planı v24 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v25` | hareket-0.36.82 | 2026-10-11 | Japonya Planı v25 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v26` | hareket-0.36.82 | 2026-10-11 | Gezi Planı v26 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v27` | hareket-0.36.82 | 2026-10-11 | Gezi Planı v27 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v28` | hareket-0.36.82 | 2026-10-11 | Gezi Planı v28 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v29` | hareket-0.36.82 | 2026-10-11 | Gezi Planı v29 | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v30` | hareket-0.36.82 | 2026-10-11 | Gezi Planı v30 | CANLIDA (v30) |
| Plan ve Pano (v30 hattı) | `plan-v31-oneri` | plan-v30-wip | 2026-10-12 | Gezi Planı v31 · öneriyle gelen kart | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v32-secili` | plan-v30-wip | 2026-10-13 | Gezi Planı v32 · seçili gelen kart | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v33-akis` | plan-v30-wip | 2026-10-13 | Gezi Planı v33 · omurga, arama, seçili | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v34-sade` | plan-v30-wip | 2026-10-13 | Gezi Planı v34 · sade kart, yerinde çevir | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v35-arka` | plan-v30-wip | 2026-10-13 | Gezi Planı v35 · sade kart, büyük arka yüz | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v36-taslak` | plan-v30-wip | 2026-10-13 | Gezi Planı v36 · taslak öneri, net aramalar | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v37-bilet` | plan-v30-wip | 2026-10-13 | Gezi Planı v37 · uçuş bileti, net niyet | hedef (v37) |
| Plan ve Pano (v30 hattı) | `plan-v38-bilet` | plan-v30-wip | 2026-10-13 | Gezi Planı v38 · uçuş bileti | önceki sürüm |
| Plan ve Pano (v30 hattı) | `plan-v39-bilet` | plan-v30-wip | 2026-10-13 | Gezi Planı v39 · uçuş bileti | SON (v37 hedef; v30 canlı) |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v1-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v1-2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v1-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v1-4.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v1 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v2-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v2-2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v2-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v2-4.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v2.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v2 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v3-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v3-2.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v3-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v3-4.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v3 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v4-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v4-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v4.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v4 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v5-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v5-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v5.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v5 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v6-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v6-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v6.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v6 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v7-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v7-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v7.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v7 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v8-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v8-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v8.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v8 | önceki sürüm |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v9-1.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v9-3.png` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | - | ek görüntü |
| Plan ve öneriler (karşılaştırma penceresi) | `2026-10-07-plan-oneriler-v9.html` | claude/blissful-fermi-4zn4h6 | 2026-10-09 | Plan ve öneriler v9 | SON |
| Plan şeritleri | `seritler` | gece-giris | 2026-10-10 | Plan Şeritleri A–B | tek (v30 şeridi yerine geçti) |
| Referans görseller (ref/) | `ref` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | - | önceki sürüm |
| Ulaşım şablonları | `2026-10-05-ulasim-v3.html` | claude/blissful-fermi-4zn4h6 | 2026-10-05 | Trip Radar · Ulaşım şablonları v3 | SON |
| Uçuş kartı (v6 / uygulamada) | `2026-10-06-ucus-karti-uygulamada.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| Uçuş kartı (v6 / uygulamada) | `2026-10-06-ucus-karti-v6.png` | claude/blissful-fermi-4zn4h6 | 2026-10-06 | - | ek görüntü |
| İlk ekran akışı (Bali) | `2026-10-08-ilk-ekran-v1.html` | claude/blissful-fermi-4zn4h6 | 2026-10-08 | Bali İlk Ekran Akışı | tek |

## 8. Görüntü dökümü (img/)

197 PNG, ~20 MB. Adlandırma `<konu>-<sürüm>-<ad>.png`; canlı: `canli-*.png`.
- `plan-v30-*` (38), `plan-v37-*` (37), `plan-v39-*` (37): üst, bölümler (8), tam sayfa, Yolculuk, Gün gün, Pano, arka yüz, yapışkan şerit, zaman (4), Ozora (4), 390 px (4), senaryo A/B/C bölümleri.
- `plan-v31..v36,v38-bolum-{ucus,konaklama}`: evrim.
- `canli-*` (20, bunun 4'ü `canli-dar390-*`).
- Diğer konular: yukarıdaki §1.x'te adıyla.
