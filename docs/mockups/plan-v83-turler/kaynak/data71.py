# Japonya turu örneği: 1–16 Nisan, 2 kişi. Görseller canlıda gerçek fotoğraf/logo olacak; burada çizimler.
BK=('Booking.com','#003b95'); AB=('Airbnb','#e0484f'); JRB=('JR','#2a7a46'); KL=('Klook','#b23c00'); VI=('Viator','#00805f'); GY=('GetYourGuide','#d4421a')
LK_STAY=[('Booking.com','#003B95','B'),('Airbnb','#FF5A5F','A'),('Agoda','#5542f6','a')]
LK_FLY=[('Skyscanner','#0770E3','S'),('Google Uçuşlar','#4285f4','G')]
LK_RAIL=[('JR','#0b7a3b','JR'),('Rome2rio','#f5503d','r')]
LK_EV=[('Klook','#ff5b00','K'),('Viator','#00a680','V'),('GetYourGuide','#ff5533','G')]
LK_TODO=[('Google Haritalar','#ea4335','G')]
LK_ESIM=[('Airalo','#111111','a'),('Holafly','#e11d48','H')]
LK_INS=[('Google','#4285f4','G')]
CTA={'Booking.com':"Booking.com'da rezerve et",'Airbnb':"Airbnb'de rezerve et",'Turkish Airlines':"THY'de bilet al",'JAL':"JAL'da bilet al",'Qatar Airways':"Qatar'da bilet al",
 'JR':"JR'de bilet al",'Odakyu':"Odakyu'da bilet al",'Klook':"Klook'ta bilet al",'Viator':"Viator'da bilet al",'GetYourGuide':"GetYourGuide'da bilet al",'Airalo':"Airalo'da satın al",'Ubigi':"Ubigi'de satın al",'Holafly':"Holafly'de satın al",'Resmî site':"Sitede rezerve et"}
CATS=[
 dict(key='flight',name='Uçuş',c='#6a4fe0',allot='€1.900',intents=[
  dict(id='f1',kind='fly',word='Uçuş',img='ucus',name=('İstanbul','Tokyo'),vals=['IST → HND','1 Nis','2 kişi'],wants=[('direkt','req'),('gece uçuşu olur','want')],links=LK_FLY,state='opts',
   opts=[dict(id='f1a',src='ai',best=1,al='TK',alname='Turkish Airlines',no='TK52',date='1 Nisan',fc='IST',ft='01:55',tc='HND',tt='19:25',plus=1,dur='11 sa 30',stops='direkt',price='€905',total='2 kişi · €1.810'),
         dict(id='f1b',src='sabine',al='JL',alname='JAL',no='JL44',date='1 Nisan',fc='IST',ft='10:10',tc='HND',tt='07:00',plus=1,dur='15 sa',stops='1 aktarma',price='€870',total='2 kişi · €1.740'),
         dict(id='f1c',src='ai',al='QR',alname='Qatar Airways',no='QR240',date='1 Nisan',fc='IST',ft='02:10',tc='HND',tt='22:30',plus=1,dur='18 sa',stops='1 aktarma',price='€690',total='2 kişi · €1.380'),
         dict(id='f1d',src='link',al='PC',alname='Pegasus',no='PC1203',date='1 Nisan',fc='SAW',ft='06:40',tc='HND',tt='09:05',plus=1,dur='20 sa',stops='2 aktarma',price='€610',total='2 kişi · €1.220')]),
  dict(id='f2',kind='fly',word='Uçuş',img='ucus',name=('Osaka','İstanbul'),vals=['KIX → IST','16 Nis','2 kişi'],wants=[],links=LK_FLY,state='booked',sel='f2a',
   opts=[dict(id='f2a',src='emre',al='TK',alname='Turkish Airlines',no='TK49',date='16 Nisan',fc='KIX',ft='11:00',tc='IST',tt='17:40',plus=0,dur='15 sa',stops='direkt',price='€790',total='2 kişi · €1.580')]),
 ]),
 dict(key='stay',name='Konaklama',c='#23998b',allot='€2.200',intents=[
  dict(id='s1',kind='stay',word='Konaklama',img='otel',name='Tokyo',vals=['3 gece','2–5 Nis','2 kişi'],wants=[('merkeze yakın','want'),('az bütçe','want')],links=LK_STAY,state='sel',sel='s1a',
   opts=[dict(id='s1a',src='sabine',name='Hyatt Centric Ginza',brand=BK,rate='9,0',sub='Ginza · metroya 2 dk',price='€213',unit='/ gece',tot='3 gece · €639',img='otel',rev='900 yorum',cancel="Ücretsiz iptal · 20 Mart'a kadar"),
         dict(id='s1b',src='ai',best=1,name='Asakusa Ryokan',brand=BK,rate='9,1',sub="Asakusa · Senso-ji'ye 4 dk",price='€120',unit='/ gece',tot='3 gece · €360',img='otel',rev='400 yorum',cancel="Ücretsiz iptal · 25 Mart'a kadar"),
         dict(id='s1c',src='link',name='Shibuya çatı katı',brand=AB,rate='★ 4,9',sub='Shibuya · 2 yatak odası',price='€165',unit='/ gece',tot='3 gece · €495',img='ev-daire',rev='210 yorum',cancel='Kısmi iade'),
         dict(id='s1d',src='ai',name='Shinjuku Granbell',brand=BK,rate='8,7',sub='Shinjuku · istasyona 5 dk',price='€140',unit='/ gece',tot='3 gece · €420',img='otel',rev='1.200 yorum',cancel="Ücretsiz iptal · 28 Mart'a kadar")]),
  dict(id='s2',kind='stay',word='Konaklama',img='otel',name='Kyoto',vals=['4 gece','5–9 Nis','2 kişi'],wants=[('geleneksel','want'),('ücretsiz iptal','req')],links=LK_STAY,state='opts',
   opts=[dict(id='s2a',src='ai',best=1,name='Gion Hatanaka',brand=BK,rate='9,3',sub='Gion · ryokan, kahvaltı dahil',price='€180',unit='/ gece',tot='4 gece · €720',img='otel',rev='640 yorum',cancel="Ücretsiz iptal · 1 Nisan'a kadar"),
         dict(id='s2b',src='link',name='Machiya ahşap ev',brand=AB,rate='★ 4,8',sub='Higashiyama · tüm ev',price='€150',unit='/ gece',tot='4 gece · €600',img='ev-daire',rev='95 yorum',cancel="Ücretsiz iptal · 29 Mart'a kadar"),
         dict(id='s2c',src='ai',name='Kyoto Brighton',brand=BK,rate='9,4',sub='Kamigyo · sakin sokak',price='€210',unit='/ gece',tot='4 gece · €840',img='otel',rev='1.050 yorum',cancel="Ücretsiz iptal · 3 Nisan'a kadar"),
         dict(id='s2d',src='sabine',name='Ryokan Sawaya Honten',brand=BK,rate='8,9',sub='Kyoto istasyonu · 6 dk',price='€95',unit='/ gece',tot='4 gece · €380',img='otel',rev='320 yorum',cancel="Ücretsiz iptal · 2 Nisan'a kadar"),
         dict(id='s2e',src='ai',name='Hotel Kanra',brand=BK,rate='9,2',sub='Shimogyo · onsenli',price='€230',unit='/ gece',tot='4 gece · €920',img='otel',rev='780 yorum',cancel="Ücretsiz iptal · 4 Nisan'a kadar")]),
  dict(id='s3',kind='stay',word='Konaklama',img='otel',name='Hakone',vals=['3 gece','9–12 Nis','2 kişi'],wants=[('onsen','req')],links=LK_STAY,state='booked',sel='s3a',
   opts=[dict(id='s3a',src='sabine',name='Gora Kadan',brand=BK,rate='9,5',sub='Gora · özel onsen',price='€300',unit='/ gece',tot='3 gece · €900',img='otel',rev='300 yorum',cancel='İade yok')]),
  dict(id='s4',kind='stay',word='Konaklama',img='otel',name='Osaka',vals=['4 gece','12–16 Nis','2 kişi'],wants=[],links=LK_STAY,state='opts',opts=[],guide=('Konaklama ara','~€90–160 / gece · Namba ya da Umeda')),
 ]),
 dict(key='transport',name='Ulaşım',c='#2563c9',allot='€400',intents=[
  dict(id='r1',kind='rail',word='Tren',img='tren',name=('Tokyo','Kyoto'),vals=['5 Nis','2 kişi'],wants=[('sabah','want')],links=LK_RAIL,state='opts',
   opts=[dict(id='r1a',src='ai',best=1,brand=JRB,line='Shinkansen Nozomi',date='5 Nisan',dep='09:00',arr='11:15',df='Tokyo',dt='Kyoto',price='€104',total='2 kişi · €208'),
         dict(id='r1b',src='ai',brand=JRB,line='Shinkansen Hikari',date='5 Nisan',dep='09:33',arr='12:11',df='Tokyo',dt='Kyoto',price='€95',total='2 kişi · €190'),
         dict(id='r1c',src='ai',brand=JRB,line='Shinkansen Kodama',date='5 Nisan',dep='08:57',arr='12:40',df='Tokyo',dt='Kyoto',price='€92',total='2 kişi · €184')]),
  dict(id='r2',kind='rail',word='Tren',img='tren',name=('Kyoto','Hakone'),vals=['9 Nis','2 kişi'],wants=[],links=LK_RAIL,state='booked',sel='r2a',
   opts=[dict(id='r2a',src='sabine',brand=JRB,line='Hikari + Romancecar',date='9 Nisan',dep='08:30',arr='11:20',df='Kyoto İst.',dt='Hakone-Yumoto',stops='1 aktarma · Odawara',price='€60',total='2 kişi · €120')]),
  dict(id='r3',kind='rail',word='Tren',img='tren',name=('Hakone','Osaka'),vals=['12 Nis','2 kişi'],wants=[],links=LK_RAIL,state='sel',sel='r3a',
   opts=[dict(id='r3a',src='sabine',brand=JRB,line='Shinkansen Hikari',date='12 Nisan',dep='09:00',arr='11:10',df='Odawara',dt='Shin-Osaka',price='€60',total='2 kişi · €120'),
         dict(id='r3b',src='ai',brand=JRB,line='Shinkansen Nozomi',date='12 Nisan',dep='10:20',arr='12:05',df='Odawara',dt='Shin-Osaka',price='€72',total='2 kişi · €144')]),
 ]),
 dict(key='activity',name='Etkinlik ve turlar',c='#a8336f',allot='€300',intents=[
  dict(id='e1',kind='ev',multi=1,word='Etkinlik',img='etkinlik-tur',name='Tokyo',vals=['2–5 Nis','2 kişi'],wants=[('akşam','want')],links=LK_EV,state='opts',picked=['e1a','e1b'],booked=['e1a'],
   opts=[dict(id='e1a',src='sabine',name='Shibuya Sky günbatımı',brand=KL,date='4 Nisan',price='€45',total='2 kişi · €90'),
         dict(id='e1b',src='ai',name='teamLab Planets',brand=KL,date='3 Nisan',price='€45',total='2 kişi · €90'),
         dict(id='e1c',src='ai',best=1,name='Sumo antrenmanı izleme',brand=GY,date='3 Nisan',price='€80',total='2 kişi · €160'),
         dict(id='e1d',src='ai',name='Tsukiji lezzet turu',brand=VI,date='4 Nisan',price='€68',total='2 kişi · €136'),
         dict(id='e1e',src='link',name='Ghibli Müzesi',brand=('Resmî site','#6b6f80'),date='2 Nisan',price='€14',total='2 kişi · €28')]),
  dict(id='e2',kind='ev',multi=1,word='Etkinlik',img='etkinlik-tur',name='Kyoto',vals=['5–9 Nis','2 kişi'],wants=[('tekne turu','want')],links=LK_EV,state='opts',picked=[],booked=[],
   opts=[dict(id='e2a',src='ai',best=1,name='Fushimi Inari gün doğumu',brand=VI,date='6 Nisan',price='€38',total='2 kişi · €76'),
         dict(id='e2b',src='ai',name='Arashiyama bambu ormanı',brand=GY,date='7 Nisan',price='€45',total='2 kişi · €90'),
         dict(id='e2c',src='ai',name='Hozugawa tekne turu',brand=KL,date='7 Nisan',price='€52',total='2 kişi · €104')]),
 ]),
 dict(key='todo',name='Yapılacaklar ve restoranlar',c='#5d8a1c',allot='',intents=[
  dict(id='t1',kind='todo',multi=1,word='Yapılacak',img='yapilacak',name='Tokyo',vals=['2–5 Nis','2 kişi'],wants=[('yerel yemek','want')],links=LK_TODO,state='opts',picked=['t1a','t1b'],booked=[],
   opts=[dict(id='t1a',src='sabine',name='Sumo antrenmanı',sub='Ryogoku',tag='Gezilecek',img='yapilacak'),
         dict(id='t1b',src='link',name='Omoide Yokocho izakaya',sub='Shinjuku',tag='Restoran',img='restoran'),
         dict(id='t1c',src='ai',name='Yanaka sokakları',sub='yürüyüş',tag='Gezilecek',img='yapilacak'),
         dict(id='t1d',src='ai',name='Ichiran Ramen',sub='Shibuya',tag='Restoran',img='restoran'),
         dict(id='t1e',src='ai',name='Meiji Tapınağı',sub='Harajuku',tag='Gezilecek',img='yapilacak'),
         dict(id='t1f',src='ai',name='Tsukiji sushi',sub='Tsukiji',tag='Restoran',img='restoran')]),
 ]),
 dict(key='other',name='Belgeler ve internet',c='#3b6fd1',allot='',visa=1,intents=[
  dict(id='d1',kind='esim',word='eSIM',img='esim',name='Japonya eSIM',vals=['1–16 Nis','2 kişi'],wants=[],links=LK_ESIM,state='opts',
   opts=[dict(id='d1a',src='ai',best=1,name='Airalo · Japonya 10 GB',brand=('Airalo','#111111'),rate='',sub='15 gün · 10 GB',price='€9',unit='/ kişi',tot='2 kişi · €18',img='esim',rev='',cancel='Kurulumdan önce iade'),
         dict(id='d1b',src='ai',name='Ubigi · Japonya 20 GB',brand=('Ubigi','#1d4ed8'),rate='',sub='30 gün · 20 GB',price='€15',unit='/ kişi',tot='2 kişi · €30',img='esim',rev='',cancel='İade yok'),
         dict(id='d1c',src='ai',name='Holafly · sınırsız',brand=('Holafly','#e11d48'),rate='',sub='15 gün · sınırsız',price='€34',unit='/ kişi',tot='2 kişi · €68',img='esim',rev='',cancel='Kurulumdan önce iade')]),
  dict(id='d2',kind='stay',word='Sigorta',img='sigorta',name='Sağlık sigortası',vals=['1–16 Nis','2 kişi'],wants=[],links=LK_INS,state='opts',opts=[],guide=('Sigorta ara','Japonya · zorunlu değil, önerilir')),
 ]),
]
