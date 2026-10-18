# Etsy karar sunumu: veriler (HTML ve Markdown aynı kaynaktan üretilir).

ETSY_URL = "https://claude.ai/artifact/PhsDXJtcSfkS9GNYxnzmLt"
PROTO_URL = "https://claude.ai/artifact/JsAFTgV3obfjjiwPY87ao1"

# Etsy vitrini, 5 Ekim analizi: ilk sayfadaki 53 ürünün formatı
FORMATS = [
    ("Google Sheets, Excel, Numbers", 24),
    ("Canva rehberi, basılabilir", 12),
    ("Tablet günlüğü", 7),
    ("Notion", 5),
    ("Basılı ürün", 4),
    ("Web uygulaması", 1),
]

WANT = [
    ("Karşılaştırıp karar vermek", "Konaklama, uçuş, etkinlik için araştırma tabloları. Fiyat, puan, iptal elle girilir; \"rezerve\" kutusu satırı rezervasyon listesine taşır."),
    ("Planı birine göstermek", "Canva'da telefon ve baskı boyunda gezi rehberi, arkadaş grubuna davet kartı. ShopRShop 116,4 bin, Euphoric Raw Designs 102,8 bin mağaza satışı."),
    ("Parayı izlemek", "Bütçe, \"daha ödenecek\", son ödeme günü, kişi başı, kim kime borçlu (HeyMorning, CreativeDreamersCo)."),
    ("Hiçbir şeyi unutmamak", "Aşamalı yapılacaklar, bavul listesi, belgeler, acil bilgiler. En çok satılan sayfalardan biri."),
    ("Yolculukta telefonda açmak", "Satıcıların hepsi \"telefonda da çalışır\" diye vurguluyor."),
]

USE = [
    "53 ürünün 24'ü tablo (Sheets, Excel, Numbers), 12'si Canva rehberi ya da basılabilir, yalnız 1'i web uygulaması.",
    "Lider ürün 20 sekme: 6'sı elle doldurulur, 5'i formülle kurulur ve buna \"no manual input\" denir.",
    "Her lider ürün bir video eğitimle satılıyor.",
]

STRUGGLE = [
    ("Karmaşıklık", "\"Biraz bunaltıcı\", \"hiç kullanıcı dostu değil\", \"çok daha sade bir tablo bekliyordum\". Düşük puanlı yorumların neredeyse hepsi bu."),
    ("Elle giriş", "\"Otomatik eşitleme için gereken adımlarla uğraşacağına her şeyi elle daha hızlı yaparsın.\""),
    ("Platform kilidi", "\"Excel istiyordum, Sheets çıktı.\" Sheets'i PDF'e çevirip GoodNotes'a koymak dert."),
]

# Eşleme tablosu: (grup, talep, canlı 0.37.1, yeni tasarım v82/v83, durum, kanıt, karar)
# durum: var | tasarim | kismen | yok
MAP = [
    ("Karar vermek", "Seçenekleri yan yana karşılaştırmak (fiyat, puan, iptal)", "Pano ve karşılaştırma, 0–100 puan", "Pano karşılaştırma sütunları, uyum puanı", "var", "board/Pano.tsx · B3, C12", ""),
    ("Karar vermek", "Kesinleşeni ayırmak (rezerve olanlar listesi)", "Rezerve ettim; onay ekranı görüntüsü kendiliğinden alındı yapar", "Alındı = erişim modu, kod her zaman görünür", "var", "lib/extract.ts booked · B1", ""),
    ("Karar vermek", "\"Nereye gidelim\" karşılaştırması", "Yalnız sohbetle", "Yok", "yok", "Etsy matrisi: sonra", "bilinçli dışarıda"),
    ("Bir bakışta", "Geri sayım, yolculukta kaçıncı gün", "\"N gün kaldı\", \"7. gün / 16\"", "Hero şeridinde", "var", "lib/countdown.ts", ""),
    ("Bir bakışta", "Ne kadarı hazır", "Hazırlık sayısı ve çubuğu", "\"Omurganın %X'i planda, %Y'si alındı\"", "var", "lib/progress.ts · B9", ""),
    ("Bir bakışta", "Kapak fotoğrafı, öne çıkan anlar", "Şehir fotoğrafı", "Mozaik hero, 6 kare", "var", "cityImages.ts · v82 hero", ""),
    ("Bir bakışta", "Rota haritası", "Rotayı haritada gör", "Aynı giriş, yeni dil", "var", "A4", ""),
    ("Gün gün", "Rezervasyonlardan kendiliğinden program", "Gün gün ve günlük akış", "Yolculuk sırasıyla; Gün gün sonra", "var", "lib/journey.ts · A3", ""),
    ("Gün gün", "Kod, saat, adres günün içinde", "bookingRef, adres, giriş saati okunuyor", "Alındı kartında kod ve saat öne çıkar", "var", "types.ts Item.bookingRef · B1", ""),
    ("Gün gün", "Saat yoksa sabah, öğle, akşam; günlere dağıt", "Yalnız yemekte öğün", "Gün gün ayrı iş", "kismen", "types.ts MealSlot · A3", "A3 ile ertelendi"),
    ("Gün gün", "Yolculukta \"Bugün\" ekranı", "Yalnız gün sayacı", "Bugün şeridi, bugünden açılış", "tasarim", "D8 · v83 (yolda)", ""),
    ("Gün gün", "Uçuş günü canlı bilgi (kapı, terminal)", "Uçuş verisi 0.36.15'ten beri", "Uçuş günü canlı", "var", "lib/flightData.ts · C4", ""),
    ("Gün gün", "Hava", "Şehir şehir ortalama, yağışlı gün", "Hero hava çipi", "var", "lib/climate.ts", ""),
    ("Para", "Bütçe ve tahmini toplam", "Bütçe çubuğu", "Bütçe penceresi: Rezerve, Planlanan, Boşta", "var", "progress.ts budgetBar", ""),
    ("Para", "Para birimi ve kur", "Gösterim birimi, \"≈\"", "Kaynak fiyat korunur", "var", "displayCurrency.ts · D17", ""),
    ("Para", "Ödendi", "Kavram yok; alındı fiyatı", "Yan sütunda \"€900 ödendi\" (alındı = ödendi)", "kismen", "B10", "T4"),
    ("Para", "Ödenecek: kalan tutar, girişte ödeme, son gün", "Yok", "Yok", "yok", "types.ts Price: ödeme alanı yok", "T4"),
    ("Para", "Yanına ne kadar nakit", "Yok", "Hazırlık'ta \"Yen bozdur\" maddesi", "kismen", "v82 Hazırlık", "T3, T4"),
    ("Para", "Kişi başı toplam", "Kartlarda kişi başı fiyat; toplamda yok", "Yok", "kismen", "CardShell.tsx", "T5"),
    ("Para", "Kim kime borçlu", "Yok", "Yok", "yok", "share/sync.ts: kayıtlar eşitlenmiyor", "T5"),
    ("Para", "Yolculukta harcama kaydı", "Yok", "\"Gezi bitti: harcama özeti\" backlog", "yok", "F §3", "T9"),
    ("Unutmamak", "Hazırlık listesi", "Hazırlık tik listesi, tarihsiz", "Hazırlık satırı \"2/6 hazır\"", "var", "plan/PrepList.tsx · C29", ""),
    ("Unutmamak", "Tarihli hatırlatma (check-in açılışı, ödeme günü)", "Tarih uyarıları; ⏳ listesi bu sürümde arayüzden düşüyor", "14 gün ve 48 saat kala öne çıkarma", "kismen", "progress.ts dateAlert · C8, F2", "T3, T2"),
    ("Unutmamak", "Bavul listesi", "Hazırlık maddelerinin arasında; festivalde hazır liste", "Hazırlık'ta birkaç alınacak", "kismen", "playbooks/festival.ts", "T6"),
    ("Unutmamak", "Belgeler (bilet, QR, poliçe)", "Belgeler sekmesi, kart ekleri; yalnız bu bilgisayarda", "Belgeler'in yeri", "var", "docs/DocsTab.tsx · C5", ""),
    ("Unutmamak", "Belgeler telefonda", "Yok; yedek dosyasına bile girmiyor", "Hazırlık maddesi \"Biletleri telefona indir\"", "kismen", "db.ts exportAll (blob yok)", "T7"),
    ("Unutmamak", "Vize ve pasaport", "Vize kuralı, pasaport ayarı, \"vize alındı\"", "\"Vize gerekmiyor\" çipi, vize gerekiyor hali", "var", "lib/visa.ts · C25, D9", ""),
    ("Unutmamak", "Acil numara, sigorta bilgisi", "Yok", "Yok", "yok", "heroInfo.ts: acil numara yok", "T8"),
    ("Unutmamak", "Ülke bilgisi (kur, priz, saat farkı, dil)", "Hero çipleri ve açılırları", "Aynı çipler", "var", "lib/heroInfo.ts", ""),
    ("Göstermek", "Yazdırma, PDF", "A4 PDF (sayfa resmi)", "PDF'in yeni hali", "var", "PrintPlan.tsx · C6", ""),
    ("Göstermek", "Birlikte planlama", "Paylaşım kodu, oylar; iki taraf da eklenti kurar", "Paylaşım izleri, tek ♥", "var", "lib/share · C13, B16", ""),
    ("Göstermek", "Kurulumsuz, salt okunur gezi (aile, arkadaş)", "Yok", "\"Salt okunur paylaşım bağlantısı\" yön olarak seçildi; çizim ve kod yok", "kismen", "D13", "T1, T10"),
    ("Göstermek", "Telefonda açılan, internetsiz plan", "Yok; eklenti yalnız masaüstü", "860 px altı; 390 px sonra", "yok", "A7", "T1"),
    ("Göstermek", "Takvime aktarma", "Yok (.ics kodda yok)", "Yok", "yok", "grep: VCALENDAR yok", "T2"),
    ("Göstermek", "Davet kartı (kimler geliyor, kapora)", "Kimler gidiyor", "Kimler gidiyor tam hali", "kismen", "C22", "bilinçli dışarıda"),
    ("Çevrimdışı", "Bilgisayarda internetsiz çalışmak", "Veri yerel (IndexedDB); kayıt kuyruğu", "Hata ve çevrimdışı halleri", "var", "OfflineNotice.tsx · C9", ""),
    ("Hayal ve anı", "Tarihsiz gezi, hayal", "Tarihsiz gezi açılabiliyor", "Tarih \"~\" ile", "var", "D15", ""),
    ("Hayal ve anı", "Anı, günlük, gezi sonrası", "Yok", "Bitince arşiv; anılar backlog", "yok", "D8", "bilinçli dışarıda"),
]

STATUS = {
    "var": "Canlıda var",
    "tasarim": "v82/v83 tasarımında var",
    "kismen": "Kısmen",
    "yok": "Yok",
}

# Kararlar. opts: (anahtar, metin, iş, bayraklar) ; ilk seçenek önerim.
# bayrak: "sema" = yeni isteğe bağlı alan (DB_VERSION 5 kalır), "sema6" = yeni store (DB_VERSION değişir), "backend" = sunucu değişir
D = [
    dict(id="T1", title="Telefonda açılan, salt okunur gezi",
         why="Etsy'nin ikinci büyük kategorisi planı göstermek; yolculukta her şey telefonda. Layla araştırması da aynı işe 8/10 dedi. D13'te yön seçildi, yapılmadı.",
         infra="Bugünkü PDF'e giden hazır veri (hero, rezervasyonlar, gün gün) aynen kullanılır; yeni bir HTML şablonu ve indirme eklenir. Paylaşım sunucusu ve şema değişmez.",
         place="Gezi ⋯ menüsünde \"Telefona gönder\" (C1, v83), PDF'in yanında. Dosyanın içi K1 kısa bilgileri ve Alındı erişim bilgileri; Bugün dili D8 ile aynı.",
         size="orta", mock=["m1", "m4"],
         opts=[
             ("a", "Gezi dosyası: tek .html dosyası. Telefonda tarayıcıda açılır, internetsiz çalışır, açıldığı güne göre Bugün ve Sıradaki'yi kendisi bulur. WhatsApp, AirDrop ya da Drive ile gönderilir. Plan değişince yeniden gönderilir.", "orta", []),
             ("b", "Barındırılan salt okunur link (D13'ün tam hali). Hep güncel; link tahmin edilemez ve kapatılabilir olmalı. Yeni tablo, fonksiyon ve görüntüleyici sayfa ister.", "büyük", ["backend"]),
             ("c", "Yalnız PDF (C6, canlıda var). Yeni iş yok; ama Bugün yok, linkler çalışmaz, sayfa resim olarak gelir.", "yok", []),
         ]),
    dict(id="T2", title="Takvime aktarma (.ics)",
         why="Etsy'de aylık takvim sekmesi var; biz takvim çizmeyiz, telefonun takvimine veririz. Kodda .ics hiç yok.",
         infra="Uçuş saatleri, giriş ve çıkış tarihleri, etkinlik saati, kod ve adres kayıtta var. Saat dilimi kayıtta yok: ilk sürüm gidilen yerin saatini \"yüzen saat\" olarak yazar.",
         place="Gezi ⋯ menüsünde \"Takvime aktar\" (C1). Arayüzde yeni yüzey yok; çıktı bir dosya.",
         size="küçük", mock=["m4"],
         opts=[
             ("a", "Alınmış ve saati belli olanlar tek .ics dosyasında: uçuş, tren, otel giriş ve çıkışı, etkinlik. Notta kod ve adres.", "küçük", []),
             ("b", "a ile birlikte tarihli Hazırlık maddeleri hatırlatıcı olarak (check-in açılışı, ödeme günü).", "küçük", []),
             ("c", "Yapma.", "yok", []),
         ]),
    dict(id="T3", title="Hazırlık maddelerinin günü",
         why="Etsy'de en çok satılan sayfalardan biri aşamalı yapılacaklar. Bugünkü Hazırlık bilerek tarihsiz (\"a chore is done or not\"); ⏳ listesi C8 ile arayüzden düşüyor.",
         infra="Hazırlık kaydında tarih alanı zaten var, kullanılmıyor. Check-in açılışı, eSIM kurulumu gibi günler kayıttan türetilir, saklanmaz. Şema değişmez.",
         place="Hazırlık kapalı satırı (K0): \"2/7 hazır · sıradaki 31 Mar\". Açılınca (K1) her satırın sağında gün; satır yüksekliği aynı. Günü olmayan maddeler altta, \"tarih yok\" yazmadan.",
         size="küçük", mock=["m2"],
         opts=[
             ("a", "Gezi verisinden çıkan maddeler kendi gününü taşır (online check-in açılışı, Visit Japan Web, eSIM kurulumu, otelde ödeme günü). Liste güne göre sıralanır. Elle eklenene gün sohbetten (\"vizeye 1 Mart'a kadar başvur\"). İptal son günü C8 gereği burada değil, Ayrıntı'da kalır.", "küçük", []),
             ("b", "Tarih yok, bugünkü gibi. Yalnız F2 (14 gün ve 48 saat kala öne çıkarma).", "yok", []),
             ("c", "Etsy gibi aşama grupları: 1 ay önce, 1 hafta önce, 1 gün önce.", "küçük", []),
         ]),
    dict(id="T4", title="Ödendi ve ödenecek",
         why="\"Daha ne ödeyeceğiz, ne zaman?\" Etsy'de \"daha ödenecek\" kutusu ve son ödeme günü (CreativeDreamersCo, HeyMorning). Bugün alındı = ödendi sayılıyor (B10).",
         infra="Fiyat ve alındı durumu var; kalan tutar ve ödeme günü yok. Okuma istemi \"girişte ödenir\", \"kalan tutar\" bilgisini zaten görüyor ama bir yere yazmıyor.",
         place="Alındı kartının yan sütununda B10 satırı: \"€600 ödendi · €300 girişte\" (kutu boyu aynı). Tam hali Ayrıntı'da (K2). Bütçe penceresinde Rezerve satırı Ödendi ve Ödenecek diye ikiye ayrılır. Ödeme günü Hazırlık'a gün olarak düşer (T3). Bilgi yoksa hiçbir şey yazmaz (C19).",
         size="orta", mock=["m3", "m2"],
         opts=[
             ("a", "Kayda isteğe bağlı ödeme bilgisi: ödenen, kalan, ne zaman, nakit mi. Onay sayfasından ve sohbetten (\"kalanını otelde ödeyeceğiz\") dolar.", "orta", ["sema"]),
             ("b", "Alan açmadan: alındı = ödendi kalır. Kalan ödeme sohbette söylenince günlü bir Hazırlık maddesi olur (\"Otelde €300 öde · 9 Nis\"). Bütçede ayrım yok.", "küçük", []),
             ("c", "Yapma; B10 olduğu gibi.", "yok", []),
         ]),
    dict(id="T5", title="Kişi başı ve bölüşme",
         why="Grup gezisinde ilk soru \"kişi başı ne tutar\". Etsy'de kişi başı ve kim kime borçlu sayfaları var (HeyMorning).",
         infra="Kişi sayısı Kimler'den geliyor, toplam bütçe penceresinde hazır; kişi başı tek bölme. Paylaşılan gezide kayıtlar ve seçimler eşitlenmiyor: bölüşme her bilgisayarda farklı çıkar.",
         place="Hero bütçe penceresinde (E12) tek satır, yalnız 2 ve daha çok kişide. Gezi dosyasının özetinde de aynı satır.",
         size="küçük", mock=["m3"],
         opts=[
             ("a", "Yalnız kişi başı: \"Kişi başı ~€3.450 · 2 kişi\". Bölüşme yok.", "küçük", []),
             ("b", "a ile birlikte \"kim ödedi\" ve eşit bölüşümle \"Sabine sana €X borçlu\". Doğru çalışması için eşitleme gerekir.", "büyük", ["sema", "backend"]),
             ("c", "Yapma.", "yok", []),
         ]),
    dict(id="T6", title="Bavul listesi",
         why="Etsy'de kişi başı bavul listesi en çok satılan sayfalardan. Bizde bavul maddeleri işlerle karışık; 20 madde gelince vize ve check-in kaybolur.",
         infra="Hazırlık kaydı ve \"Amazon'da al\" bağlantısı var; festival türünde hazır bavul listesi var. Bavul ayrımı maddenin kelimesinden ya da mevcut tür alanından; yeni alan yok.",
         place="Hazırlık listesinde (K1) katlı tek satır \"Bavul · 4/22\"; açılınca tek liste, iki durum: hazır ve alınacak.",
         size="küçük", mock=["m2"],
         opts=[
             ("a", "Hazırlık içinde katlı \"Bavul\" satırı. AI bir kez hazırlar (hava, etkinlik, süre, gezi türü); alınacaklar mağaza bağlantısıyla.", "küçük", []),
             ("b", "Bugünkü gibi: bavul maddeleri diğer Hazırlık maddeleriyle karışık.", "yok", []),
             ("c", "Kişi kişi ayrı bavul listeleri.", "orta", []),
         ]),
    dict(id="T7", title="Belgeler telefonda",
         why="Biletler ve QR'lar yolculukta telefonda lazım. Bugün belgeler yalnız bu bilgisayarda; yedek dosyasına bile girmiyor. v82 Hazırlık'ta \"Biletleri telefona indir\" maddesi var ama bağlı bir düğme yok.",
         infra="Belgeler IndexedDB'de duruyor ve okunabiliyor. PDF'i görüntüye çevirmek için kütüphane yok; önerim bunu gerektirmez.",
         place="Belgeler (C5) üst satırında ve \"Telefona gönder\" penceresinde (T1) tek seçim. Hazırlık'taki madde bu düğmeye bağlanır.",
         size="orta", mock=["m4", "m1"],
         opts=[
             ("a", "Görüntü belgeler (QR ekran görüntüsü, JPG, PNG) gezi dosyasına gömülür; PDF biletler aynı anda ayrı dosya olarak indirilir. Belgelerin bilgisayardan çıkması bilinçli bir kural değişikliği.", "orta", []),
             ("b", "Belgeler yalnız bu bilgisayarda (bugünkü kural). Hazırlık maddesi hatırlatır.", "yok", []),
             ("c", "Belgeler paylaşım sunucusuna şifreli yüklenir, telefondan linkle açılır. Depolama ve güvenlik kararı ister.", "büyük", ["backend"]),
         ]),
    dict(id="T8", title="Acil bilgiler",
         why="Etsy rehberlerinde acil bilgiler sayfası var. Bizde ülke çipleri kur, priz, saat farkı, dil, vize diyor; acil numara yok.",
         infra="Ülke tablosu kodda (countries.ts); acil numara oraya eklenir. Alınmış sigortanın poliçe kodu kayıtta var.",
         place="Hero ülke çipinin açılan penceresinde \"Acil\" satırı (K2). Gezi dosyasında aynı kutu. Bilinmeyen satır görünmez (C19).",
         size="küçük", mock=["m1"],
         opts=[
             ("a", "Ülkenin acil numaraları ve alınmış sigortanın poliçe kodu; ülke çipinin penceresinde ve gezi dosyasında.", "küçük", []),
             ("b", "Hazırlık'ta ayrı \"Bilmen gerekenler\" kartı (Etsy taslağındaki gibi).", "küçük", []),
             ("c", "Yapma.", "yok", []),
         ]),
    dict(id="T9", title="Yolculukta harcama kaydı",
         why="Etsy tablolarında harcama sekmesi var; ama girişi yolculukta telefonda yapılıyor. 5 Ekim analizi de bunu son faza koydu.",
         infra="Harcama için kayıt yeri yok. Plan kayıtlarına karıştırmak planı kirletir; ayrı yer yeni bir depo ister.",
         place="Önerim bir şey eklemez. b seçilirse hero bütçe penceresinde \"Harcanan\" satırı.",
         size="yok", mock=[],
         opts=[
             ("a", "Bu sürümde yok; backlog. Telefon yüzeyi ve eşitleme olmadan değeri düşük.", "yok", []),
             ("b", "Sohbetten \"taksi 3.000 yen\" gibi harcama kaydı; bütçe penceresinde \"Harcanan\". Yalnız bu bilgisayarda.", "orta", ["sema6"]),
             ("c", "Harcanan toplam tek alana elle yazılır.", "küçük", ["sema"]),
         ]),
    dict(id="T10", title="Gezi dosyasında kişisel bilgi",
         why="Gezi dosyası otel adresi, onay kodu ve PNR taşır. 5 Ekim analizi de bunu ürün riski olarak yazmıştı.",
         infra="Kod ve adres kayıtta ayrı alanlar; dosyaya girip girmemesi tek seçim.",
         place="\"Telefona gönder\" penceresinde tek onay kutusu; son seçim hatırlanır.",
         size="küçük", mock=["m4"],
         opts=[
             ("a", "Gönderirken tek seçim: \"Kodlar ve adresler dahil\". Kendin ve gezi arkadaşın için açık, aile için kapatılır.", "küçük", []),
             ("b", "Hep dahil.", "yok", []),
             ("c", "Hiç dahil değil; dosya yalnız program ve özet.", "yok", []),
         ]),
    dict(id="T11", title="Ne zaman yapılsın",
         why="13 Ekim'de üç Etsy önerisi backlog'a alındı (\"bu sürümde yok\"). G2: v82 geçişi tek sürüm. Bu öneriler yeni yüzey açmıyor, yeniden yazılan yüzeylere satır ekliyor.",
         infra="Bütçe penceresi, Hazırlık ve ülke çipi v82 geçişinde zaten yeniden yazılıyor (Aşama 1, 2, 5). Gezi menüsü Aşama 1'de.",
         place="Spec §4 aşamaları.",
         size="yok", mock=[],
         opts=[
             ("a", "Küçükler v82 geçişine (T3, T5, T6, T8: yeniden yazılan yüzeylerde birer satır). Çıktılar ve para (T1, T2, T7, T10, T4) v82 yayınından sonra ayrı küçük sürümde.", "", []),
             ("b", "Hepsi v82 yayınından sonra, ayrı sürümde.", "", []),
             ("c", "Hepsi backlog'da kalsın (13 Ekim kararı olduğu gibi).", "", []),
         ]),
]

FLAGS = {
    "sema": "yeni isteğe bağlı alan · DB_VERSION 5 kalır",
    "sema6": "yeni depo · DB_VERSION değişir",
    "backend": "backend gerekir",
}

OUT = [
    ("Destinasyon karşılaştırma", "Sohbet zaten cevaplıyor; yeni ekran gerekmez."),
    ("Grafikler (pasta, sütun)", "Tek cümle ve tek çubuk daha hızlı okunur."),
    ("Renk temaları, sticker, günlük", "Karar değeri yok; estetik gezi dosyasının kendi tasarımında."),
    ("Kıyafet planı, \"eşyam hangi çantada\"", "Giriş yükü büyük, karar değiştirmiyor."),
    ("Gidilen yerler haritası, anılar", "Planlamaya katkısı yok; D8: bitince arşiv."),
    ("Davet kartı, acente rehberi", "Gezi dosyası oturunca aynı dosyanın bir görünümü olabilir; şimdi değil."),
    ("Saatsiz günler, \"Günlere dağıt\"", "Gün gün işine bağlı (A3); orada ele alınır."),
    ("Kurulum sürtünmesi (AI anahtarı)", "Etsy analizinde 9/10'du; ürün değil dağıtım işi. Gezi dosyası izleyiciler için çözer, planlayan için sürer."),
]

UNSURE = [
    "Gezi dosyasının telefonda açılması: iOS'ta Dosyalar ya da WhatsApp'tan açılan .html dosyası Safari'de betiği çalıştırıyor mu, gömülü görüntüler açılıyor mu, Android'de aynı mı. Denenmedi; T1'den önce yarım günlük bir deneme gerekir.",
    ".ics için kayıtlarda saat dilimi yok. \"Yüzen saat\" telefon yolculukta saat dilimini değiştirince doğru görünür, öncesinde gidilen yerin saatiyle görünür. Kabul edilebilir mi, Emre'ye sorulmalı.",
    "Ödeme bilgisini (\"girişte ödenir\", kalan tutar) sayfalardan ve onay e-postalarından okumanın doğruluğu ölçülmedi.",
    "T4 a, B10'u (\"€900 ödendi\") genişletiyor; Emre'nin B10 seçimiyle çelişmiyor ama satır uzayabilir. Yan sütun genişliği 232 px, iki dilde ölçülmeli (A6).",
    "Etsy satış sayıları mağaza toplamı, ürün satışı değil. Vitrinin yalnız ilk sayfası (53 ürün) tarandı; reklamlı ürünler öne çıkmış olabilir.",
    "v83 kurulurken gezi menüsünün içeriği değişebilir. Taslaktaki menü canlı 0.37.1 menüsünden.",
    "Bugünkü kısa web taraması yeni ve güvenilir sayı vermedi; rakip uygulama karşılaştırmaları çelişkili ve bir kısmı rakip blogu.",
]

SOURCES = [
    ("Trip Radar Etsy Analizi (5 Ekim, tam metni okundu)", ETSY_URL),
    ("Katmanlı Plan, v82 prototipi", PROTO_URL),
    ("v82 geçiş kararları", "https://claude.ai/artifact/1Ww3APTcA7BZ9hGgig9g7k"),
    ("Wanderlog blogu: bütçe ve bölüşme", "https://wanderlog.com/blog/?p=1031"),
    ("TripIt ile Wanderlog karşılaştırması (üçüncü taraf)", "https://travelvient.com/tools/travel-apps/compare/tripit-vs-wanderlog/"),
    ("Pilot ile Wanderlog karşılaştırması (rakip blogu)", "https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison"),
]

FILES = [
    "/home/user/wt-v32/docs/envanter/kayip/C-artifact-arsivi.md §2.14",
    "/home/user/wt-v32/docs/superpowers/specs/2026-10-13-emre-kararlari.md",
    "/home/user/wt-v32/docs/superpowers/specs/2026-10-18-v82-gecis/01-kararlar.md, 02-spec.md, A2, D, F",
    "/home/user/trip-radar/src (plan-v46-kod, 0.37.1): types.ts, db.ts, plan/PrepList.tsx, PrintPlan.tsx, lib/share/, lib/progress.ts",
]
