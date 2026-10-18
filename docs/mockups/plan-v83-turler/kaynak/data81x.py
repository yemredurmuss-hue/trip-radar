# AI uyum puanı (yayındaki "Uyum puanı n/100 · n. sırada")
SCORE={'s1a':78,'s1b':88,'s1c':71,'s1d':84,'s2a':92,'s2b':86,'s2c':80,'s2d':74,'s2e':69,'s3a':90,
 'f1a':91,'f1b':72,'f1c':76,'f1d':58,'f2a':90,'r1a':89,'r1b':85,'r1c':70,'r2a':88,'r3a':84,'r3b':79,'d1a':87,'d1b':80,'d1c':74}
# alınmış kayıtlar: ulaşılacak bilgi (zaman, yer, belge)
ACC={
 's3a':dict(when='Giriş 9 Nis 15:00 · Çıkış 12 Nis 11:00',where='Gora 1300, Hakone',code=('Onay','GK-48213'),doc='Onay e-postası',links=['Haritada aç','Otele yaz'],paid='€900 ödendi'),
 'f2a':dict(when='16 Nis · Check-in 15 Nis 11:00\'de açılır',where='KIX Terminal 1',code=('PNR','K7T2QX'),doc='E-bilet',links=['Check-in yap'],paid='€1.580 ödendi'),
 'r2a':dict(when='9 Nis 08:30 · Vagon 7 · 12A, 12B',where='Kyoto İst., peron 12 · Odawara’da aktarma',code=('Bilet','OD-7721'),doc='',links=['Haritada aç'],paid='€120 ödendi'),
 'e1a':dict(when='4 Nis 17:20',where='Shibuya Scramble Square, 14. kat',code=('Bilet','KL-90231'),doc='Klook bileti',links=['Haritada aç'],paid='€90 ödendi'),
}
ILHAM=[
 dict(id='i1',kind='reel',plat='Instagram',pc='#d6249f',title='Tokyo\'da 3 günde ne yenir',meta='0:48 · Reels',who='Sabine',city='Tokyo',scene='ramen'),
 dict(id='i2',kind='video',plat='YouTube',pc='#ff0000',title='Fushimi Inari sabah 6\'da: kalabalıksız rota',meta='12:30 · video',who='Emre',city='Kyoto',scene='torii'),
 dict(id='i3',kind='blog',plat='Blog',pc='#2b2842',title='Hakone onsen rehberi: hangi ryokan, ne zaman',meta='8 dk okuma',who='AI buldu',city='Hakone',scene='onsen'),
 dict(id='i4',kind='reel',plat='TikTok',pc='#111111',title='Dotonbori sokak yemekleri',meta='0:35 · video',who='Sabine',city='Osaka',scene='lantern'),
 dict(id='i5',kind='blog',plat='Blog',pc='#2b2842',title='Japan Rail Pass bu rotada değer mi?',meta='6 dk okuma',who='AI buldu',city='Rota',scene='train'),
 dict(id='i6',kind='video',plat='YouTube',pc='#ff0000',title='Arashiyama bambu ormanı gün doğumu',meta='9:12 · video',who='Emre',city='Kyoto',scene='bamboo'),
]
# Yolculuk sırasıyla: (bölüm, [adımlar]); adım: (tarih, tür, niyet id, seçenek id veya '')
TRIP=[
 ('Yola çıkmadan','Gezi öncesi',None,[('', 'prep','',''),('', 'int','d1',''),('', 'int','d2','')]),
 ('İstanbul → Tokyo','1 Nisan','ucus',[('1 Nis','int','f1','')]),
 ('Tokyo','2–5 Nisan · 3 gece','city-tokyo',[('2 Nis','int','r0',''),('2 Nis','int','s1',''),('3 Nis','item','e1','e1b'),('3 Nis','item','t1','t1a'),('4 Nis','item','e1','e1a'),('esnek','item','t1','t1b'),('','ideas','e1','')]),
 ('Kyoto','5–9 Nisan · 4 gece','city-kyoto',[('5 Nis','int','r1',''),('5 Nis','int','s2',''),('','ideas','e2','')]),
 ('Hakone','9–12 Nisan · 3 gece','city-hakone',[('9 Nis','int','r2',''),('9 Nis','int','s3','')]),
 ('Osaka','12–16 Nisan · 4 gece','city-osaka',[('12 Nis','int','r3',''),('12 Nis','int','s4','')]),
 ('Osaka → İstanbul','16 Nisan','ucus',[('16 Nis','int','f2','')]),
]
