
# ---- v83 · Japonya verisi ve senaryo ekleri ----
LIVE, EXTRA, FIRST = {}, {}, {}
for c in CATS:
    for it in c['intents']:
        if it['id'] == 's4':
            it['est'] = '€90–160 / gece'
            it.pop('guide', None)
        if it['id'] == 's2':
            it['state'] = 'ai'
            it['sel'] = 's2a'
        if it['id'] == 'd2':
            it['est'] = '€25–45'
            it['etitle'] = 'Japonya için seyahat sağlık sigortası'
            it['enote'] = 'zorunlu değil, önerilir'
            it['nohint'] = True
            it.pop('guide', None)
        if it['id'] == 'd1':
            for o in it['opts']:
                o['cancel'] = ''
            ren = {'d1a': ('Airalo · 10 GB', '15 gün'), 'd1b': ('Ubigi · 20 GB', '30 gün'), 'd1c': ('Holafly · sınırsız', '15 gün')}
            for o in it['opts']:
                o['name'], o['sub'] = ren[o['id']]
LOGO['Amazon'] = ('#111111', 'a')
for c in CATS:
    if c['key'] == 'transport':
        c['kw'] = '6 yolculuk · tren, pass ve vapur'
LOGO['Odakyu'] = ('#1e5aa8', 'O')
LOGO['TableCheck'] = ('#d33a2c', 'T')
for c in CATS:
    if c['key'] == 'transport':
        ids = [i['id'] for i in c['intents']]
        if 'r0' not in ids:
            c['intents'].insert(0, dict(id='r0', kind='ride', word='Transfer', img='taksi-transfer', name=('Havalimanı', 'Otel'), vals=['2 Nis', '2 kişi'], wants=[], links=[('Rome2rio', '#f5503d', 'r')], state='arr', opts=[],
                                        arr=dict(st='arr', img='taksi-transfer', car='Otelin servisi', cars='2 Nisan', ca='Havalimanı', sa='HND · <strong>19:45</strong>', m1='karşılamalı', m2='otel ayarladı', cb='Otel', sb='Hyatt Centric Ginza',
                                                 chips=['Çıkış kapısında karşılama'], name='Otelin servisi · HND → Hyatt Centric Ginza', sub='Otel ayarladı, 19:45 çıkış kapısında')))
        k = [i['id'] for i in c['intents']].index('r2') + 1
        # Hakone Free Pass: Hakone içindeki vapur, teleferik, otobüs onunla "Dahil" (D2, D10)
        c['intents'].insert(k, dict(id='r4', kind='pass', word='Pass', img='tren', name='Hakone Free Pass', vals=['9–11 Nis', '2 kişi'], wants=[], links=[('Odakyu', '#1e5aa8', 'O')], state='booked', sel='r4a',
                                    opts=[dict(id='r4a', src='sabine', brand=('Odakyu', '#1e5aa8'), line='Hakone Free Pass · 3 gün', date='9 Nisan', ca='Odawara', sa='9 Nis · ilk binişte başlar', cb='Hakone', sb='11 Nis sonuna kadar',
                                               mid='3 gün', mid2='tüm Hakone', il='tren', chips=['Vapur, teleferik, otobüs dahil'], dep='09:00', arr='09:00', df='Odawara', dt='Hakone', price='€38', total='2 kişi · €76')]))
        c['intents'].insert(k + 1, dict(id='r5', kind='ride', word='Vapur', img='vapur', name=('Togendai', 'Moto-Hakone'), vals=['10 Nis', '2 kişi'], wants=[], links=[('Hakone Sightseeing Cruise', '#0e8fb0', 'H')], state='arr', opts=[],
                                        arr=dict(st='inc', img='vapur', car='Hakone Sightseeing Cruise', cars='10 Nisan', ca='Togendai', sa='iskele · <strong>10:30</strong>', m1='40 dk', m2='Ashi Gölü', cb='Moto-Hakone', sb='iskele · <strong>11:10</strong>',
                                                 chips=['Korsan gemisi', 'Fuji manzarası'], by='Hakone Free Pass ile', bybtn="Pass'i aç", goto='int-r4', name='Ashi Gölü vapuru · Togendai → Moto-Hakone', sub='Hakone Free Pass ile dahil')))
    if c['key'] == 'todo' and not any(i['id'] == 't2' for i in c['intents']):
        c['intents'].append(dict(id='t2', kind='todo', multi=1, word='Yapılacak', img='restoran', name='Kyoto', vals=['5–9 Nis', '2 kişi'], wants=[('kaiseki', 'want')], links=[('Google Haritalar', '#ea4335', 'G'), ('TableCheck', '#d33a2c', 'T')], state='opts', picked=['t2a', 't2b'], booked=[],
                                 opts=[dict(id='t2a', src='emre', name='Gion Karyo', sub='Gion · kaiseki', tag='Restoran', img='restoran', res=dict(when='6 Nis 19:30 · 2 kişi', code='TC-4471')),
                                       dict(id='t2b', src='emre', name='JR ofisi', sub='Pass değişimi: Kyoto İst. Hachijo çıkışı', tag='Not', img='not'),
                                       dict(id='t2c', src='ai', name='Nishiki pazarı', sub='öğle yemeği için', tag='Gezilecek', img='yapilacak'),
                                       dict(id='t2d', src='ai', name='Pontocho sokağı', sub='akşam yürüyüşü', tag='Gezilecek', img='yapilacak')]))
# gezi sırasında senaryosu için alınmışlar
ACC.update({
    's2a': dict(when='Giriş 5 Nis 15:00 · Çıkış 9 Nis 10:00', where='Gion, Kyoto', code=('Onay', 'GH-5531'), doc='Onay e-postası', links=['Haritada aç', 'Otele yaz'], paid='€720 ödendi'),
    'r1a': dict(when='5 Nis 09:00 · Vagon 8 · 4D, 4E', where='Tokyo İst., peron 14', code=('Bilet', 'JR-30871'), doc='E-bilet', links=['Haritada aç'], paid='€208 ödendi'),
    'e2a': dict(when='6 Nis 06:00', where='Fushimi Inari girişi', code=('Bilet', 'VI-77310'), doc='Viator bileti', links=['Haritada aç'], paid='€76 ödendi'),
    'r4a': dict(when='9–11 Nis · ilk binişte başlar', where='Odawara İst., Odakyu gişesi', code=('Pass', 'HF-2290'), doc='Pass QR', links=['Saatler'], paid='€76 ödendi'),
})
ACC.update({
    'd1a': dict(when='1–16 Nis · 10 GB', where='QR e-postada', code=('QR', 'AIR-5520'), doc='QR kod', links=[]),
    'f1a': dict(when='1 Nis 01:55 · koltuk 32A, 32B', where='İstanbul Havalimanı, T1', code=('PNR', 'TK8Q2L'), doc='E-bilet', links=[]),
    's1a': dict(when='Giriş 2 Nis 15:00 · Çıkış 5 Nis 11:00', where='Ginza, Tokyo', code=('Onay', 'BK-20417'), doc='Onay e-postası', links=['Haritada aç']),
    'r3a': dict(when='12 Nis 09:00 · Vagon 5 · 8A, 8B', where='Odawara İst.', code=('Bilet', 'JR-55120'), doc='E-bilet', links=[]),
})
for k_, v_ in ACC.items():
    v_.setdefault('paid', '')
ACC['s3a']['paid'] = '€900 ödendi'
ACC['f2a']['paid'] = '€1.580 ödendi'
ACC['r2a']['paid'] = '€120 ödendi'
ACC['e1a']['paid'] = '€90 ödendi'
# uçuş günü: biletin çip satırı canlı şeride döner (C4)
LIVE['f2a'] = ('<div class="z-live" aria-live="polite"><span class="z-ldot">Canlı</span><span>Kapı <b>21</b></span><span>Biniş <b>10:45</b></span><span class="bad">Rötar <b>+25 dk</b></span><span>KIX <b>T1</b></span></div>'
               '<span class="z-lst">Biniş başladı</span><small class="z-shift">Yeni kalkış 11:25, varış 18:05. Planı yeni saate kaydırdım.</small>')
# durumlar: AI arıyor (iskelet), yeni gelen, okunamadı (C9, C10, C35)
SK = '<article class="z-oc z-sk" aria-hidden="true"><div class="z-op"></div><div class="z-ob"><i></i><i></i><i></i></div></article>'
EXTRA['s4'] = '<div class="z-skel"><div class="q-oh"><b class="q-ot">AI Osaka için arıyor</b><small class="q-oc">Namba ve Umeda, gecesi €90–160</small><span class="q-sp"></span><span class="z-pulse" aria-hidden="true"></span></div><div class="q-cards z-ocs">%s</div></div>' % (SK * 3)
FIRST['e2'] = ('<article class="q-card z-k z-new"><div class="z-kp" style="background:#ffffff"><img alt="" src="illus/etkinlik-tur.png"><span class="q-src mine"><i>E</i>Sohbetten</span><span class="z-newb">Yeni</span></div>'
               '<div class="z-kb"><span class="z-l1"><span class="q-brand" style="--bl:#b23c00">Klook</span></span><h3 class="z-t">Kiyomizu-dera gece ışıkları</h3><span class="z-l2">6 Nisan · €12 kişi başı</span><div class="z-kf"><button type="button" class="q-pick ghost">+ Plana koy</button></div></div></article>'
               '<article class="z-k z-bad"><div class="z-kp z-badp">%s</div><div class="z-kb"><span class="z-l1"><span class="z-tagc">Okunamadı</span></span><h3 class="z-t">klook.com/activity/91…</h3><span class="z-l2">Sayfa yanıt vermedi</span>'
               '<div class="z-kf"><span class="q-act"><button type="button" class="z-retry">Tekrar dene</button><button type="button" class="z-rmv2">Kaldır</button></span></div></div></article>') % ic('link', 22, 2)
# yolculuk sırası: yeni niyetler
T2 = []
for title, sub, key, steps in TRIP:
    st = list(steps)
    if key == 'city-kyoto':
        st[-1:-1] = [('6 Nis', 'item', 't2', 't2a'), ('esnek', 'item', 't2', 't2b')]
    if key == 'city-hakone':
        st.insert(1, ('9 Nis', 'int', 'r4', ''))
        st.append(('10 Nis', 'int', 'r5', ''))
    T2.append((title, sub, key, st))
TRIP[:] = T2
CHIMG = {'city-tokyo': 'photos/shibuya.jpg', 'city-kyoto': 'photos/inari.jpg', 'city-hakone': 'photos/onsen.jpg', 'city-osaka': 'photos/dotonbori.jpg'}
# Pano > Belgeler (C5)
PANO['docs'] = [
    dict(g='Uçuş', items=[dict(nm='E-bilet · TK49', sub='PDF · Osaka → İstanbul kartına bağlı', st='ok', goto='int-f2'), dict(nm='E-bilet · İstanbul → Tokyo', sub='uçuş alınınca gelir', st='wait')]),
    dict(g='Konaklama', items=[dict(nm='Onay e-postası · Gora Kadan', sub='e-posta · Hakone kartına bağlı', st='ok', goto='int-s3')]),
    dict(g='Ulaşım', items=[dict(nm='Bilet · Kyoto → Hakone', sub='belge eklenmedi · OD-7721', st='add', goto='int-r2'), dict(nm='Pass QR · Hakone Free Pass', sub='görsel · Pass kartına bağlı', st='ok', goto='int-r4')]),
    dict(g='Etkinlik', items=[dict(nm='Klook bileti · Shibuya Sky', sub='PDF · 4 Nis 17:20', st='ok', goto='int-e1')]),
    dict(g='Bağlanmamış', items=[dict(nm='Seyahat sigortası poliçesi.pdf', sub='sohbete attığın dosya · bir karta bağla', st='link')]),
]
HERO = dict(
    title='Japonya turu', cities='Tokyo · Kyoto · Hakone · Osaka', cover='photos/fuji.jpg', thumb='photos/fuji.jpg',
    tiles=[('photos/shibuya.jpg', 'Shibuya Sky', 'Tokyo'), ('photos/inari.jpg', 'Fushimi Inari', 'Kyoto'), ('photos/ramen.jpg', 'Ichiran Ramen', 'Tokyo'),
           ('photos/onsen.jpg', 'Gora Kadan onsen', 'Hakone'), ('photos/dotonbori.jpg', 'Dotonbori', 'Osaka'), ('photos/arashiyama.jpg', 'Arashiyama', 'Kyoto')],
    city_tiles=[('photos/shibuya.jpg', 'Tokyo', '3 gece'), ('photos/inari.jpg', 'Kyoto', '4 gece'), ('photos/onsen.jpg', 'Hakone', '3 gece'), ('photos/dotonbori.jpg', 'Osaka', '4 gece')],
    dates=('1–16 Nisan', '~1–16 Nisan', '16 gün · 178 gün kaldı'), days_tip='Tokyo 2–5 · Kyoto 5–9 · Hakone 9–12 · Osaka 12–16 Nisan',
    me='E', who=[('E', 'Emre', 'sen', "Hyatt Centric Ginza'yı seçti", '1 sa önce'), ('S', 'Sabine', '', "Gora Kadan'ı rezerve etti", 'dün')], people='2 kişi',
    prog=(61, 33, 7, "Omurganın %61'i planda (18 ihtiyaçtan 11'i), %33'ü alındı (6). 7 karar bekliyor.", "18 ihtiyaç · 5'inde önerimiz var"),
    budget=dict(total='€8.000', est='~€6.900', lines=[('bk', 'Rezerve', '€2.766'), ('pl', 'Planlanan', '€849'), ('fr', 'Boşta', '€4.385')],
                cats=[('Uçuş', '€1.580'), ('Konaklama', '€1.539'), ('Ulaşım', '€316'), ('Etkinlik', '€180')],
                note='Karar bekleyenler seçilince yaklaşık €3.280 daha eklenir (Osaka oteli ve sigorta tahmini dahil). Tahmini toplam ~€6.900, bütçeye sığar · €1.100 pay.'),
    next=('Sıradaki: Kyoto oteli', 'Sıradaki: İstanbul → Tokyo uçuşu'),
    chips=[('pin', 'Japonya', 'Tokyo, Kyoto, Hakone, Osaka · 4 şehir'),
           ('sun', '6–19°', 'Nisan ortalaması · Tokyo 19°/10°, yağışlı gün 8/30 · Kyoto 18°/8°, 9/30 · Hakone 14°/6°, 11/30 · Osaka 19°/10°, 8/30'),
           ('yen', 'Yen', '1 € ≈ 162 ¥ · bugünkü kur'), ('plug', 'A/B priz', 'Adaptör gerekir · Türkiye C/F kullanıyor'),
           ('clock', '+6 saat', 'Sende 12:00 iken orada 18:00. Uçuş saatleri yerel saattir.'), ('chat', 'Japonca'),
           ('check', 'Vize gerekmiyor', 'Türk pasaportuyla 90 güne kadar vizesiz', 'ok')],
    prefs=dict(short='Ekonomik · merkeze yakın · yerel yemek', list=[('Tüm gezi', 'Bütçe: ekonomik', 'söylediğin'), ('Konaklama', 'Merkeze yakın', 'söylediğin'), ('Tüm gezi', 'Yerel yemek', 'seçimlerinden'),
                                                                   ('Uçuş', 'Direkt uçuş şart', 'söylediğin'), ('Kyoto', 'Geleneksel konaklama', 'söylediğin')],
               ask=('Sabah erken trenler sorun değil mi?', 'Tokyo → Kyoto için sabah dedin')),
    mini='1–16 Nis · 2 kişi', slim='1–16 Nisan · 2 kişi · %61 planda · ~€6.900 / €8.000',
    today=[dict(key='today', date='6 Nisan Pazartesi · Kyoto · gezinin 6. günü', weather='☀ 18° · yağmur ihtimali %20',
                rows=[('06:00', 'Etkinlik', 'Fushimi Inari gün doğumu', 'Viator · bilet VI-77310', '<button type="button" class="q-open sm">Bileti aç</button>', 'done'),
                      ('12:30', 'Yapılacak', 'Nishiki pazarı', 'öğle yemeği · planda', '<a class="q-alk" href="#" onclick="return false">Haritada aç ↗</a>', 'now'),
                      ('15:00', 'Konaklama', 'Gion Hatanaka · 2. gece', 'onay GH-5531', '<a class="q-alk" href="#" onclick="return false">Otele yaz ↗</a>', ''),
                      ('19:30', 'Restoran', 'Gion Karyo', 'rezervasyon TC-4471 · 2 kişi', '<button type="button" class="q-open sm">Rezervasyonu aç</button>', '')],
                next=('Yarın 08:30', 'Kyoto → Hakone treni · Kyoto İst. peron 12 · bilet OD-7721')),
           dict(key='flight', date='16 Nisan Perşembe · Osaka · eve dönüş', weather='☁ 19°',
                rows=[('08:30', 'Konaklama', 'Otelden çıkış', 'Osaka · check-out 11:00', '', 'done'),
                      ('09:15', 'Transfer', 'Namba → KIX', 'Nankai Rapi:t · 38 dk', '<a class="q-alk" href="#" onclick="return false">Yol tarifi ↗</a>', 'now'),
                      ('11:25', 'Uçuş', 'TK49 · KIX → IST', '<span class="z-bad2">Rötar +25 dk</span> · Kapı 21 · biniş 10:45', '<button type="button" class="q-open sm">E-bileti aç</button>', ''),
                      ('18:05', 'Varış', 'İstanbul', 'IST · yeni saat', '', '')],
                next=('Gezi bitince', 'Harcama özeti ve fotoğraflar burada toplanır'))],
)
CHAT = [
    ('u', '<span class="c-link">booking.com/hotel/jp/hyatt-centric-ginza</span>'),
    ('a', "Hyatt Centric Ginza'yı Tokyo konaklamasına ekledim. Merkeze yakın, ama gecesi €213 ile bütçenin biraz üstünde.",
     dict(img='illus/otel.png', brand=('Booking.com', '#003b95'), rate='9,0', nm='Hyatt Centric Ginza', sub='Ginza · metroya 2 dk', pr='€213', unit='/ gece', goto='int-s1', btn='Seçildi')),
    ('u', 'Kyoto için geleneksel bir yer bul'),
    ('a', "Gion'da 3 ryokan buldum. En uygunu Gion Hatanaka: kahvaltı dahil ve ücretsiz iptal. Diğer ikisi Pano'da yan yana.",
     dict(img='illus/otel.png', brand=('Booking.com', '#003b95'), rate='9,3', nm='Gion Hatanaka', sub='Gion · ryokan, kahvaltı dahil', pr='€180', unit='/ gece', goto='int-s2', btn='Bunu seç')),
]
QUICK = ['Hangisi daha iyi?', 'Bütçeme uyar mı?', 'Osaka için de bak']
SCN = [('init', 'Plan ilerledi'), ('fresh', 'Omurga yeni'), ('durum', 'Durumlar'), ('flight', 'Uçuş günü'), ('today', 'Gezi sırasında')]
# gezi sırasında ve uçuş günü: o güne kadar alınmış olanlar (prototip senaryosu)
_ki = [i for i, t in enumerate(TRIP) if t[2] == 'city-kyoto'][0]
_BK = {'int-f1': dict(mode='booked', sel='f1a'), 'int-s1': dict(mode='booked', sel='s1a'), 'int-s2': dict(mode='booked', sel='s2a'), 'int-r1': dict(mode='booked', sel='r1a'),
       'int-r3': dict(mode='booked', sel='r3a'), 'int-e1': dict(picked=['e1a', 'e1b'], booked=['e1a', 'e1b']), 'int-e2': dict(picked=['e2a'], booked=['e2a']), 'int-d1': dict(mode='booked', sel='d1a')}
SCNSET = {'today': dict(chap=_ki, ints=_BK), 'flight': dict(chap=len(TRIP) - 1, ints=_BK)}
ARRIVE = True
