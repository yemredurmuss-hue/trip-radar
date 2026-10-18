
# ---- v83 · Ozora festivali: türe göre kurulan omurga (D1–D4, D2 notu) ----
# Festival iskeleti: Konaklama "çadır kampı · bilete dahil" kendiliğinden gelir; Ulaşım festival otobüsü
# (alternatif araç kiralama); dönüş otobüsünü AI ekler (C16); Belgeler'de Schengen vizesi gerekiyor (C25).
# Fotoğraf yok: hero tek kapak, çizimle (C19: olmayan parça hiç görünmez, bütçe belirlenmedi diye bölme yok).
LIVE, EXTRA, FIRST = {}, {}, {}
from data71 import LK_FLY, LK_STAY, LK_ESIM, BK, AB


def fest_svg(uid='f'):
    return ('<svg class="q-scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>'
            '<linearGradient id="%s1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1446"/><stop offset=".55" stop-color="#5a2a7a"/><stop offset="1" stop-color="#e4785a"/></linearGradient>'
            '<radialGradient id="%s2" cx=".5" cy=".9" r=".6"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>'
            '<rect width="400" height="300" fill="url(#%s1)"/><circle cx="200" cy="270" r="190" fill="url(#%s2)"/>'
            '<g fill="#fff" opacity=".7"><circle cx="40" cy="40" r="1.4"/><circle cx="90" cy="70" r="1"/><circle cx="160" cy="30" r="1.2"/><circle cx="260" cy="50" r="1"/><circle cx="330" cy="28" r="1.5"/><circle cx="370" cy="80" r="1"/></g>'
            '<path d="M120 232 L200 130 L280 232 Z" fill="#2a1840"/><path d="M150 232 L200 168 L250 232 Z" fill="#ff9a5c" opacity=".85"/>'
            '<g stroke="#ffd27a" stroke-width="2" opacity=".55"><path d="M200 130 L60 40"/><path d="M200 130 L340 40"/><path d="M200 130 L200 20"/></g>'
            '<path d="M0 250 Q100 226 200 240 T400 236 L400 300 L0 300 Z" fill="#160f2e"/>'
            '<g fill="#160f2e"><path d="M40 252 l14 -22 14 22z"/><path d="M300 248 l16 -26 16 26z"/><path d="M340 254 l12 -18 12 18z"/><path d="M70 256 l10 -16 10 16z"/></g></svg>') % ((uid,) * 4)


def fest_cover():
    # geniş kapak: gece gökyüzü, uzak tepeler, sahne ışıkları, kamp çadırları (fotoğraf yok, çizim)
    tents = ''.join('<path d="M%d 300 l%d -%d %d %dz" fill="%s"/>' % (x, w // 2, h, w // 2, h, c) for x, w, h, c in [(40, 70, 46, '#e9893f'), (130, 56, 36, '#3fa7a0'), (205, 64, 42, '#c8662a'), (880, 72, 48, '#3fa7a0'), (965, 58, 38, '#e9893f'), (1040, 66, 44, '#7a5bd6'), (1120, 52, 34, '#c8662a')])
    stars = ''.join('<circle cx="%d" cy="%d" r="%s" fill="#fff" opacity=".75"/>' % (x, y, r) for x, y, r in [(60, 40, 1.4), (150, 90, 1), (260, 30, 1.2), (340, 70, 1), (470, 24, 1.5), (560, 64, 1), (700, 34, 1.3), (790, 82, 1), (880, 26, 1.4), (980, 60, 1.1), (1080, 30, 1.3), (1150, 86, 1)])
    return ('<svg class="q-scene" viewBox="0 0 1200 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>'
            '<linearGradient id="fc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1242"/><stop offset=".6" stop-color="#55286f"/><stop offset="1" stop-color="#d9704f"/></linearGradient>'
            '<radialGradient id="fc2" cx=".5" cy="1" r=".55"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".95"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient></defs>'
            '<rect width="1200" height="330" fill="url(#fc1)"/>' + stars + '<ellipse cx="600" cy="330" rx="520" ry="210" fill="url(#fc2)"/>'
            '<g stroke="#ffe0a3" stroke-width="3" opacity=".45"><path d="M600 170 L380 20"/><path d="M600 170 L820 20"/><path d="M600 170 L520 0"/><path d="M600 170 L680 0"/></g>'
            '<path d="M0 260 Q180 214 360 236 T720 228 T1200 222 L1200 330 L0 330 Z" fill="#2a1840"/>'
            '<path d="M470 268 L600 160 L730 268 Z" fill="#1d1233"/><path d="M520 268 L600 200 L680 268 Z" fill="#ff9a5c" opacity=".9"/>'
            '<path d="M0 288 Q300 266 600 280 T1200 276 L1200 330 L0 330 Z" fill="#160f2e"/>'
            '<g fill="#160f2e">' + ''.join('<circle cx="%d" cy="%d" r="%d"/>' % (x, 292 - (x * 7) % 9, 7 + (x % 3)) for x in range(330, 880, 22)) + '</g>' + tents + '</svg>')


def tent_svg():
    return ('<svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="200" height="150" fill="#f3f7ee"/>'
            '<path d="M0 118 Q60 108 100 114 T200 112 L200 150 L0 150 Z" fill="#cfe3bd"/><path d="M50 116 L100 46 L150 116 Z" fill="#e9893f"/><path d="M100 46 L84 116 L116 116 Z" fill="#c8662a"/>'
            '<path d="M100 46 L100 116" stroke="#8c4618" stroke-width="2"/><circle cx="160" cy="34" r="12" fill="#f6c453"/></svg>')


CATS = [
    dict(key='flight', name='Uçuş', c='#6a4fe0', allot='', intents=[
        dict(id='f1', kind='fly', word='Uçuş', img='ucus', name=('İstanbul', 'Budapeşte'), vals=['IST → BUD', '26 Tem', '2 kişi'], wants=[('direkt', 'req')], links=LK_FLY, state='ai', sel='f1a',
             opts=[dict(id='f1a', src='ai', best=1, al='TK', alname='Turkish Airlines', no='TK1035', date='26 Temmuz', fc='IST', ft='08:40', tc='BUD', tt='09:40', plus=0, dur='2 sa', stops='direkt', price='€189', total='2 kişi · €378'),
                   dict(id='f1b', src='ai', al='PC', alname='Pegasus', no='PC331', date='26 Temmuz', fc='SAW', ft='13:20', tc='BUD', tt='14:15', plus=0, dur='1 sa 55', stops='direkt', price='€132', total='2 kişi · €264'),
                   dict(id='f1c', src='link', al='W6', alname='Wizz Air', no='W64321', date='26 Temmuz', fc='SAW', ft='06:10', tc='BUD', tt='07:05', plus=0, dur='1 sa 55', stops='direkt', price='€98', total='2 kişi · €196')]),
        dict(id='f2', kind='fly', word='Uçuş', img='ucus', name=('Budapeşte', 'İstanbul'), vals=['BUD → IST', '2 Ağu', '2 kişi'], wants=[], links=LK_FLY, state='opts',
             opts=[dict(id='f2a', src='ai', al='TK', alname='Turkish Airlines', no='TK1038', date='2 Ağustos', fc='BUD', ft='19:10', tc='IST', tt='22:05', plus=0, dur='1 sa 55', stops='direkt', price='€176', total='2 kişi · €352'),
                   dict(id='f2b', src='ai', al='PC', alname='Pegasus', no='PC332', date='2 Ağustos', fc='BUD', ft='15:05', tc='SAW', tt='18:00', plus=0, dur='1 sa 55', stops='direkt', price='€120', total='2 kişi · €240')]),
    ]),
    dict(key='stay', name='Konaklama', c='#23998b', allot='', intents=[
        dict(id='s1', kind='stay', word='Konaklama', img='otel', name='Budapeşte', vals=['1 gece', '26–27 Tem', '2 kişi'], wants=[('merkeze yakın', 'want')], links=LK_STAY, state='sel', sel='s1a',
             opts=[dict(id='s1a', src='emre', name='Hotel Moments Budapest', brand=BK, rate='9,2', sub='Andrássy · metroya 1 dk', price='€140', unit='/ gece', tot='1 gece · €140', img='otel', rev='2.100 yorum', cancel="Ücretsiz iptal · 20 Temmuz'a kadar"),
                   dict(id='s1b', src='ai', best=1, name='Maverick City Lodge', brand=BK, rate='8,9', sub='Kazinczy · hostel, özel oda', price='€70', unit='/ gece', tot='1 gece · €70', img='otel', rev='3.400 yorum', cancel='Ücretsiz iptal'),
                   dict(id='s1c', src='link', name='Andrássy dairesi', brand=AB, rate='★ 4,8', sub='Terézváros · tüm daire', price='€95', unit='/ gece', tot='1 gece · €95', img='ev-daire', rev='160 yorum', cancel='Kısmi iade')]),
        dict(id='s2', kind='stay', word='Kamp', img='otel', art='<span class="z-art-svg">%s</span>' % tent_svg(), name='Ozora · festival kampı', vals=['6 gece', '27 Tem – 2 Ağu', '2 kişi'], wants=[('kendi çadırımız', 'want')], links=[('Ozora', '#7a3fd1', 'O')], state='arr', opts=[],
             arr=dict(family='stay', st='inc', media=tent_svg(), t='Çadır konaklama · festival kampı', l2='27 Tem – 2 Ağu · 6 gece · kendi çadırın', chips=['Duş ve su noktaları', 'Kamp alanı seçimi girişte'],
                      by='festival biletiyle', bybtn='Festival biletini aç', goto='int-e1', row='<a class="q-alk" href="#" onclick="return false">Hazır çadır kirala · +€190 ↗</a>',
                      name='Çadır konaklama · festival kampı', sub='festival biletine dahil')),
    ]),
    dict(key='transport', name='Ulaşım', c='#2563c9', allot='', kw='2 yolculuk · festival otobüsü', intents=[
        dict(id='r1', kind='rail', word='Otobüs', img='otobus', name=('Budapeşte', 'Ozora'), vals=['27 Tem', '2 kişi'], wants=[], links=[('Ozora Shuttle', '#7a3fd1', 'O'), ('Discover Cars', '#2b7a3f', 'D')], state='sel', sel='r1a',
             opts=[dict(id='r1a', src='ai', brand=('Ozora Shuttle', '#7a3fd1'), line='Festival otobüsü', sub2='Ozora Shuttle · resmî', date='27 Temmuz', dep='10:00', arr='13:00', df='Népliget otogarı', dt='Festival girişi', stops='aktarmasız', price='€35', total='2 kişi · €70'),
                   dict(id='r1b', src='ai', brand=('Discover Cars', '#2b7a3f'), line='Araç kiralama', sub2='Discover Cars · 7 gün', date='27 Temmuz', dep='10:00', arr='12:15', df='Budapeşte Havalimanı', dt='Ozora', mid='7 gün', stops='otomatik vites', price='€105', total='2 kişi · €210')]),
        dict(id='r2', kind='rail', word='Otobüs', img='otobus', name=('Ozora', 'Budapeşte'), vals=['2 Ağu', '2 kişi'], wants=[], links=[('Ozora Shuttle', '#7a3fd1', 'O')], state='ai', sel='r2a',
             opts=[dict(id='r2a', src='ai', best=1, brand=('Ozora Shuttle', '#7a3fd1'), line='Festival otobüsü · dönüş', sub2='Ozora Shuttle · resmî', date='2 Ağustos', dep='12:00', arr='15:00', df='Festival girişi', dt='Népliget otogarı', stops='aktarmasız', price='€35', total='2 kişi · €70'),
                   dict(id='r2b', src='ai', brand=('Ozora Shuttle', '#7a3fd1'), line='Havalimanı otobüsü', sub2='Ozora Shuttle · resmî', date='2 Ağustos', dep='13:00', arr='16:30', df='Festival girişi', dt='Budapeşte Havalimanı', stops='aktarmasız', price='€45', total='2 kişi · €90')]),
    ]),
    dict(key='activity', name='Etkinlik ve turlar', c='#a8336f', allot='', kw='Festival bileti · 7 gün', intents=[
        dict(id='e1', kind='ev', multi=1, word='Festival', img='etkinlik-tur', name='Ozora Festival', vals=['27 Tem – 2 Ağu', '2 kişi'], wants=[], links=[('Ozora', '#7a3fd1', 'O')], state='opts', picked=['e1a'], booked=['e1a'],
             opts=[dict(id='e1a', src='emre', name='Festival bileti · 7 gün', brand=('Ozora', '#7a3fd1'), date='27 Tem – 2 Ağu', price='€245', total='2 kişi · €490')]),
    ]),
    dict(key='other', name='Belgeler ve internet', c='#3b6fd1', allot='', kw='Schengen vizesi gerekiyor · eSIM ve sigorta', visa=dict(t='Schengen vizesi gerekiyor', s='Macaristan · randevu en az 15 gün önce'), intents=[
        dict(id='d1', kind='esim', word='eSIM', img='esim', name='Avrupa eSIM', vals=['26 Tem – 2 Ağu', '2 kişi'], wants=[], links=LK_ESIM, state='ai', sel='d1a',
             opts=[dict(id='d1a', src='ai', best=1, name='Airalo · 10 GB', brand=('Airalo', '#111111'), rate='', sub='15 gün · Avrupa', price='€17', unit='/ kişi', tot='2 kişi · €34', img='esim', rev='', cancel=''),
                   dict(id='d1b', src='ai', name='Holafly · sınırsız', brand=('Holafly', '#e11d48'), rate='', sub='7 gün · Avrupa', price='€29', unit='/ kişi', tot='2 kişi · €58', img='esim', rev='', cancel='')]),
        dict(id='d2', kind='stay', word='Sigorta', img='sigorta', name='Sağlık sigortası', vals=['26 Tem – 2 Ağu', '2 kişi'], wants=[], links=[('Google', '#4285f4', 'G')], state='opts', opts=[],
             est='€15–30', etitle='Schengen seyahat sağlık sigortası', enote='vize için zorunlu', nohint=True),
    ]),
]
LOGO.update({'Ozora': ('#7a3fd1', 'O'), 'Ozora Shuttle': ('#7a3fd1', 'O'), 'Discover Cars': ('#2b7a3f', 'D'), 'Wizz Air': ('#c6007e', 'W'), 'Hepsiburada': ('#ff6000', 'h')})
PREP = [('Çadır (2 kişilik)', "Kampta kendi çadırın; hazır çadır istersen Konaklama'da", 'trendyol', 0),
        ('Uyku tulumu', "Geceleri 12°'ye düşebiliyor", 'hepsiburada', 0),
        ('Kafa lambası', 'Kamp alanı gece karanlık', 'amazon', 0),
        ('Forint bozdur', 'Festivalde kart geçiyor, yolda nakit lazım', '', 0),
        ('Vize randevusu', 'VFS İstanbul · en az 15 gün önce', 'site', 1),
        ('Kulak tıkacı', 'Sahneler gece gündüz açık', 'trendyol', 0)]
TRIP = [
    ('Yola çıkmadan', 'Gezi öncesi', None, [('', 'prep', '', ''), ('', 'int', 'd1', ''), ('', 'int', 'd2', '')]),
    ('İstanbul → Budapeşte', '26 Temmuz', 'ucus', [('26 Tem', 'int', 'f1', '')]),
    ('Budapeşte', '26–27 Temmuz · 1 gece', 'city-bud', [('26 Tem', 'int', 's1', ''), ('27 Tem', 'int', 'r1', '')]),
    ('Ozora', '27 Temmuz – 2 Ağustos · 6 gece', 'city-oz', [('27 Tem', 'int', 's2', ''), ('27 Tem', 'item', 'e1', 'e1a'), ('2 Ağu', 'int', 'r2', '')]),
    ('Budapeşte → İstanbul', '2 Ağustos', 'ucus', [('2 Ağu', 'int', 'f2', '')]),
]
CHIMG = {'city-bud': scene('skyline'), 'city-oz': fest_svg('ch')}
HINTS, DET, PC, MATCH, LIKES = {}, {}, {}, {'s1a': {'merkeze yakın': 1}, 's1b': {'merkeze yakın': 1}, 's1c': {'merkeze yakın': 1}}, {'s1a': ['Emre']}
TAG = {'f1c': 'En ucuz', 'f1a': 'En hızlı', 'f2b': 'En ucuz', 's1b': 'En ucuz'}
BAG = {'f1a': '1 bagaj dahil', 'f1b': 'Yalnız el bagajı', 'f1c': 'Yalnız el bagajı', 'f2a': '1 bagaj dahil', 'f2b': 'Yalnız el bagajı'}
SCORE = {'f1a': 90, 'f1b': 84, 'f1c': 71, 'f2a': 86, 'f2b': 80, 's1a': 82, 's1b': 88, 's1c': 79, 'r1a': 91, 'r1b': 74, 'r2a': 92, 'r2b': 85, 'd1a': 88, 'd1b': 76}
ACC = {'e1a': dict(when="27 Tem 12:00'den itibaren", where='Ozora, Dádpuszta', code=('Bilet', 'OZ-26-81442'), doc='Festival bileti', links=['Haritada aç'], paid='€490 ödendi')}
ILHAM = [dict(id='i1', kind='video', plat='YouTube', pc='#ff0000', title='Ozora 2025 · kamp alanı turu', meta='14:20 · video', who='Deniz', city='Ozora', scene='lantern'),
         dict(id='i2', kind='blog', plat='Blog', pc='#2b2842', title='İlk kez Ozora: ne götürmeli', meta='7 dk okuma', who='AI buldu', city='Ozora', scene='bamboo')]
PANO['docs'] = [
    dict(g='Etkinlik', items=[dict(nm='Festival bileti · Ozora', sub='PDF · 2 kişi · kamp dahil', st='ok', goto='int-e1')]),
    dict(g='Belgeler', items=[dict(nm='Schengen vizesi', sub='randevu alınınca buraya ekle', st='add'), dict(nm='Pasaport', sub='geçerlilik 3 ay+ · 2029', st='ok')]),
]
HERO = dict(
    title='Ozora festivali', cities='Budapeşte · Ozora', cover=fest_cover(), thumb=fest_svg('ht'), tiles=[], city_tiles=None,
    dates=('26 Tem – 2 Ağu', '~ Temmuz sonu', '8 gün · 281 gün kaldı'), days_tip='Budapeşte 26–27 · Ozora 27 Tem – 2 Ağu',
    me='E', who=[('E', 'Emre', 'sen', 'Festival biletini aldı', '2 gün önce'), ('D', 'Deniz', '', 'Budapeşte otelini önerdi', 'dün')], people='2 kişi',
    prog=(44, 22, 5, "Omurganın %44'ü planda (9 ihtiyaçtan 4'ü), %22'si alındı (2). 5 karar bekliyor.", '9 ihtiyaç · 5\'inde önerimiz var'),
    budget=None, next=('Sıradaki: vize randevusu', 'Sıradaki: vize randevusu'),
    chips=[('pin', 'Macaristan', "Ozora, Dádpuszta · Budapeşte'ye 2 sa"), ('sun', '15–29°', 'Temmuz ortalaması · gündüz 29°, gece 15° · yağışlı gün 6/31'),
           ('eur', 'Forint', '1 € ≈ 395 Ft · festivalde kart geçer'), ('plug', 'C/F priz', 'Adaptör gerekmez'), ('clock', '−1 saat', 'Sende 12:00 iken orada 11:00.'),
           ('chat', 'Macarca'), ('alert', 'Schengen vizesi gerekiyor', 'Türk pasaportuyla Schengen vizesi gerekir; randevu en az 15 gün önce', 'warn')],
    prefs=dict(short='Kendi çadırımız · festivale erken', list=[('Konaklama', 'Kendi çadırımız', 'söylediğin'), ('Festival', '1 gün erken git', 'söylediğin'), ('Ulaşım', 'Festival otobüsü', 'seçimlerinden')]),
    mini='26 Tem – 2 Ağu · 2 kişi', slim='26 Tem – 2 Ağu · 2 kişi · %44 planda', today=[],
)
CHAT = [
    ('u', "Ozora'ya gidiyoruz, 27 Temmuz – 2 Ağustos. Çadırımızı götüreceğiz."),
    ('a', "Festival omurgasını kurdum: konaklama festival biletine dahil çadır kampı, Budapeşte'den festival otobüsü. Dönüş otobüsünü de ekledim, henüz seçilmedi. Sıradaki iş Schengen vizesi.",
     dict(img='illus/otobus.png', brand=('Ozora Shuttle', '#7a3fd1'), rate='', nm='Festival otobüsü · dönüş', sub='2 Ağustos · 12:00 → 15:00', pr='€35', unit='kişi başı', goto='int-r2', btn='Bunu seç')),
]
QUICK = ['Hazır çadır kiralasak?', 'Araçla gitmek daha mı iyi?', 'Vize için ne lazım?']
SCN = [('init', 'Festival omurgası')]
PREP83 = dict(
    items=[
        dict(t='Vize randevusu al', w='VFS İstanbul · başvuru gezi tarihinden en az 15 gün önce', day='11 Tem\'e kadar', k='2027-07-11', src='vize kuralından', shop='site', soon=True),
        dict(t='Schengen sağlık sigortası', w='Vize başvurusunda isteniyor', day='11 Tem\'e kadar', k='2027-07-11b', src='Belgeler\'den'),
        dict(t='Forint bozdur', w='Festivalde kart geçer, yolda ve Budapeşte\'de nakit lazım', day='26 Tem\'den önce', k='2027-07-25'),
        dict(t='Festival biletini telefona indir', w='Girişte QR okutuluyor', day='', k=None, done=True),
    ],
    bavul=dict(sub='Emre için · festival kampı, 8 gün, gündüz 29° gece 15°', ask=[('Konaklama', 'Kendi çadırımız', []), ('Kamp ocağı götürecek misin?', '', ['Evet', 'Hayır'])],
               groups=[('Kamp', [('Çadır (2 kişilik)', 'kendi çadırın', 'ok', ''), ('Uyku tulumu', 'gece 15°\'ye düşebiliyor', 'buy', 'hepsiburada'), ('Kamp matı', '', '', ''), ('Kafa lambası', 'kamp alanı gece karanlık', 'buy', 'amazon')]),
                       ('Festival', [('Kulak tıkacı', 'sahneler gece gündüz açık', 'buy', 'trendyol'), ('Su matarası', 'su noktalarında doldurulur', 'ok', ''), ('Güneş kremi, şapka', 'gündüz 29°', '', '')]),
                       ('Hava', [('Yağmurluk', 'Temmuzda yağışlı gün 6/31', '', '')]),
                       ('Belgeler ve para', [('Pasaport ve vize', 'vize bekleniyor', '', ''), ('Kart ve biraz Forint', '', '', '')])],
               mine=['Kulaklık', 'Kişisel ilaçlar']),
    bilmen=dict(sub='Macaristan ve festival', rows=[
        ('alert', 'Acil', '112 (AB ortak numara)'),
        ('train', 'Toplu taşıma', 'Budapeşte\'de bilet binince onaylanır, onaysız bilete ceza kesilir'),
        ('card', 'Ödeme', 'Festivalde kart geçer'),
        ('flag', 'Türkiye Büyükelçiliği', 'Budapeşte · <a class="q-alk" href="#" onclick="return false">Haritada aç ↗</a>')]),
)
CATINFO = {'stay': ('festival', 'Festival gezisi: festival günlerinde konaklama bilete dahil kamp olarak kuruldu, otel aranmaz. Öncesi ve sonrası için şehir konaklaması ayrı.'),
           'activity': ('festival', 'Festival gezisi: odak festival, başka tur ve etkinlik önermem. İstersen sohbette söyle.'),
           'transport': ('gateway', 'Ozora\'nın havalimanı yok; uçuş Budapeşte\'ye, oradan festival otobüsü.')}
