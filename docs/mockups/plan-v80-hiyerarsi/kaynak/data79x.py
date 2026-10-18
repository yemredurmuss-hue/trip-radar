BAG={'f1a':'1 bagaj dahil','f1b':'1 bagaj dahil','f1c':'1 bagaj dahil','f1d':'Yalnız el bagajı','f2a':'1 bagaj dahil'}
# niyetteki isteğe uyuyor mu (1 uyar, 0 uymaz)
MATCH={'s1a':{'merkeze yakın':1,'az bütçe':0},'s1b':{'merkeze yakın':0,'az bütçe':1},'s1c':{'merkeze yakın':1,'az bütçe':0},'s1d':{'merkeze yakın':1,'az bütçe':1},
 's2a':{'geleneksel':1,'ücretsiz iptal':1},'s2b':{'geleneksel':1,'ücretsiz iptal':1},'s2c':{'geleneksel':0,'ücretsiz iptal':1},'s2d':{'geleneksel':1,'ücretsiz iptal':1},'s2e':{'geleneksel':0,'ücretsiz iptal':1},
 'f1a':{'direkt':1,'gece uçuşu olur':1},'f1b':{'direkt':0,'gece uçuşu olur':0},'f1c':{'direkt':0,'gece uçuşu olur':1},'f1d':{'direkt':0,'gece uçuşu olur':0},
 'r1a':{'sabah':1},'r1b':{'sabah':1},'r1c':{'sabah':1},'e1a':{'akşam':1},'e1b':{'akşam':1},'e1c':{'akşam':0},'e1d':{'akşam':0},'e1e':{'akşam':0},'e2c':{'tekne turu':1},'e2a':{'tekne turu':0},'e2b':{'tekne turu':0}}
LIKES={'s1a':['Sabine'],'s1b':['Emre','Sabine'],'s1c':['Emre'],'s2a':['Emre','Sabine'],'s2b':['Sabine'],'f1a':['Emre'],'f1b':['Sabine'],'e1a':['Sabine','Emre'],'e1c':['Sabine'],'e2a':['Emre'],'t1b':['Sabine','Emre'],'d1a':['Emre']}
HINTS={'s4':('Osaka\'da 4 gece için nerede kalınır',[('Namba','Yemek ve gece hayatı, metro merkezi','~€110 / gece'),('Umeda','Osaka istasyonu, alışveriş','~€140 / gece'),('Shin-Osaka','Shinkansen\'e 2 dk, dönüşe kolay','~€90 / gece')]),
 'd2':('Japonya için seyahat sağlık sigortası',[('Temel','Tedavi ve acil dönüş, 16 gün','~€25'),('Geniş','Bagaj ve iptal dahil','~€45')])}
DET={
 's3a':[('Rezervasyon',[('Onay kodu','GK-48213',1),('Giriş','9 Nis, 15:00'),('Çıkış','12 Nis, 11:00'),('Kişi','2 yetişkin')]),('Belge',[('Onay e-postası','eklenmedi')]),('Yerinde',[('Adres','Gora 1300, Hakone'),('Otele yaz ↗',''),('Haritada aç ↗','')])],
 'f2a':[('Rezervasyon',[('PNR','K7T2QX',1),('Koltuk','34A · 34B'),('Bagaj','2 × 23 kg'),('Check-in','15 Nis 11:00\'de açılır')]),('Belge',[('E-bilet','eklenmedi')]),('Uçuş günü',[('Terminal','KIX T1'),('Canlı durum','uçuş günü burada')])],
 'r2a':[('Rezervasyon',[('Bilet kodu','OD-7721',1),('Vagon','7 · 12A, 12B')]),('Belge',[('Bilet','eklenmedi')]),('Yerinde',[('Kalkış','Odawara, peron 4')])],
 'e1a':[('Bilet',[('Kod','KL-90231',1),('Saat','4 Nis, 17:20')]),('Belge',[('Bilet','eklenmedi')]),('Yerinde',[('Buluşma','Shibuya Scramble Square, 14. kat'),('Haritada aç ↗','')])],
}
PREP=[('Yağmurluk al','Kyoto\'da 7–8 Nisan yağmur bekleniyor','amazon',0),
 ('Japan Rail Pass al','Planda 3 tren var; 7 günlük pass bunlardan ucuz olabilir','site',0),
 ('Yen bozdur','Japonya\'da küçük yerler çoğu zaman nakit istiyor','',0),
 ('Priz dönüştürücü (A tipi)','Japonya A ve B tipi priz kullanıyor','amazon',0),
 ('Visit Japan Web\'e kaydol','Havalimanında girişte QR kod isteniyor','site',1),
 ('Biletleri telefona indir','Uçuş ve tren biletleri çevrimdışı açılsın','',1)]
