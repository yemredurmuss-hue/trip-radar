# v83 · Türler: tür iskeleti sistemi. Her gezi türü aynı şemayla yazılır; niyet kutuları, çerçeveler ve durumlar
# bu şemadan kurulur. Ozora ve Japonya canlı prototipte, diğerleri burada omurga olarak.
import html, os, shutil
E = html.escape
SP = os.path.dirname(os.path.abspath(__file__))
OUT = SP + '/v83'

FR = {'stay': 'konaklama kartı', 'ticket': 'bilet', 'cards': 'kart sırası'}
ST = {'sug': 'Önerimiz', 'srch': 'Aranıyor', 'inc': 'Dahil', 'off': 'Gerek yok', 'ask': 'Soruya bağlı'}
CAT = [('flight', 'Uçuş', '#6a4fe0'), ('stay', 'Konaklama', '#23998b'), ('transport', 'Ulaşım', '#2563c9'), ('activity', 'Etkinlik ve turlar', '#a8336f'),
       ('todo', 'Yapılacaklar ve restoranlar', '#b7791f'), ('other', 'Belgeler ve internet', '#3b6fd1')]


def I(word, name, frame, st, img, by='', per=''):
    return dict(word=word, name=name, frame=frame, st=st, img=img, by=by, per=per)


TYPES = [
    dict(key='festival', name='Festival', ex='Ozora · Macaristan', link='ozora.html', trig='festival tablosu (Ozora, Tomorrowland, Sziget, Glastonbury…) ya da "festival, fest, rave"',
         main='Festival bileti', spine={
             'flight': [I('Uçuş', 'İstanbul → Budapeşte', 'ticket', 'sug', 'ucus', per='bacak'), I('Uçuş', 'Budapeşte → İstanbul', 'ticket', 'sug', 'ucus', per='bacak')],
             'stay': [I('Konaklama', 'Budapeşte · 1 gece', 'stay', 'ask', 'otel', per='gece aralığı'), I('Kamp', 'Festival kampı · 6 gece', 'stay', 'inc', 'cadir', 'festival biletiyle')],
             'transport': [I('Otobüs', 'Budapeşte → festival', 'ticket', 'sug', 'otobus'), I('Otobüs', 'Festival → Budapeşte', 'ticket', 'sug', 'otobus')],
             'activity': [I('Festival', 'Festival bileti · 7 gün', 'cards', 'sug', 'etkinlik-tur')],
             'other': [I('eSIM', 'Avrupa eSIM', 'stay', 'sug', 'esim'), I('Sigorta', 'Seyahat sağlık sigortası', 'stay', 'srch', 'sigorta')]},
         closes=[('todo', 'festival odak: tur, müze, günübirlik önerisi yok')],
         prep=['Çadır', 'Uyku tulumu', 'Kafa lambası', 'Nakit', 'Kulak tıkacı'], ask=['Kendi çadırın mı, hazır kamp mı?', 'Kaç gün erken gideceksin?'],
         hero='Tek kapak (fotoğraf yoksa çizim). Vize gerekiyorsa uyarı çipi.'),
    dict(key='dive', name='Dalış teknesi', ex='Kızıldeniz liveaboard · Hurgada', trig='"liveaboard, dalış turu, dalış teknesi" · AI kalıbı (tekne)',
         main='Tekne paketi', spine={
             'flight': [I('Uçuş', 'İstanbul → Hurgada', 'ticket', 'sug', 'ucus'), I('Uçuş', 'Hurgada → İstanbul', 'ticket', 'sug', 'ucus')],
             'stay': [I('Tekne', 'Liveaboard · 7 gece', 'stay', 'srch', 'vapur', per='gece aralığı')],
             'transport': [I('Transfer', 'Havalimanı → liman', 'ticket', 'inc', 'taksi-transfer', 'tekne paketiyle')],
             'activity': [I('Dalış', 'Günde 3–4 dalış', 'cards', 'inc', 'vapur', 'tekne paketiyle')],
             'todo': [I('Ekipman', 'Ekipman kiralama · kişi × gün', 'stay', 'ask', 'yapilacak')],
             'other': [I('Vize', 'Mısır e-vize', 'stay', 'srch', 'sigorta'), I('Sigorta', 'Dalış sigortası', 'stay', 'srch', 'sigorta')]},
         closes=[('activity', 'yalnız bu deneyim: tur ve şehir önerisi yok')],
         prep=['Dalış sertifikası', 'Log book', 'Son dalış ile uçuş arası 24 saat', 'Deniz tutması ilacı'], ask=['Sertifika seviyen?', 'Kendi ekipmanın var mı?'],
         hero='Tek kapak. Çipler: liman, su sıcaklığı yerine yalnız gerçek veri gelirse.'),
    dict(key='ski', name='Kayak', ex='Bansko · Bulgaristan', trig='"kayak, ski, snowboard" ve merkez adları (Bansko, Uludağ, Zermatt…)',
         main='Skipass', spine={
             'flight': [I('Uçuş', 'İstanbul → Sofya', 'ticket', 'sug', 'ucus', per='en yakın havalimanı'), I('Uçuş', 'Sofya → İstanbul', 'ticket', 'sug', 'ucus')],
             'transport': [I('Transfer', 'Sofya → Bansko', 'ticket', 'srch', 'minibus')],
             'stay': [I('Konaklama', 'Bansko · 5 gece', 'stay', 'sug', 'otel')],
             'activity': [I('Skipass', '5 gün · 2 kişi', 'stay', 'sug', 'etkinlik-tur', per='konaklama günleri'), I('Ekipman', 'Kiralama · kişi × gün', 'stay', 'ask', 'yapilacak'),
                          I('Okul', 'Kayak okulu', 'stay', 'ask', 'yapilacak')],
             'other': [I('Sigorta', 'Kayak kapsamlı sigorta', 'stay', 'srch', 'sigorta')]},
         closes=[('activity', '"kendi ekipmanım" deyince Ekipman, "ileri seviye" deyince Okul kapanır')],
         prep=['Eldiven', 'Gözlük', 'Termal içlik', 'Kask', 'Güneş kremi'], ask=['Seviyen?', 'Ekipmanın var mı?', 'Hangi merkez? (yalnız ülke söylendiyse)'],
         hero='Mozaik: merkez ve pist fotoğrafları gelirse; yoksa tek kapak.'),
    dict(key='wellness', name='Wellness retreat', ex='Ubud yoga retreat · Bali', trig='"retreat, yoga, meditasyon, detoks, inziva, spa"',
         main='Retreat programı', spine={
             'flight': [I('Uçuş', 'İstanbul → Denpasar · aktarmalı', 'ticket', 'sug', 'ucus', per='tek niyet, iki koçan')],
             'stay': [I('Program', 'Retreat · 7 gece, yemek ve dersler', 'stay', 'srch', 'otel'), I('Konaklama', 'Ubud · 7 gece', 'stay', 'inc', 'ev-daire', 'retreat programıyla')],
             'transport': [I('Transfer', 'Havalimanı → Ubud', 'ticket', 'inc', 'taksi-transfer', 'retreat programıyla')],
             'activity': [I('Etkinlik', 'En çok 1 öneri', 'cards', 'sug', 'etkinlik-tur')],
             'other': [I('eSIM', 'Endonezya eSIM', 'stay', 'sug', 'esim')]},
         closes=[('todo', 'gece hayatı ve parti önerisi yok')],
         prep=['Rahat kıyafet', 'Yoga matı', 'Matara', 'Kitap'], ask=['Programa kaydın var mı?'],
         hero='Tek kapak. Program alınınca "Dahil" satırları yeşile döner.'),
    dict(key='cruise', name='Kruvaziyer', ex='Akdeniz · Barselona → Roma', trig='"cruise, kruvaziyer, gemi turu" (yerleşik tür, D11)',
         main='Kabin', spine={
             'flight': [I('Uçuş', 'İstanbul → Barselona', 'ticket', 'sug', 'ucus'), I('Uçuş', 'Roma → İstanbul', 'ticket', 'sug', 'ucus')],
             'stay': [I('Kabin', 'Gemi · 7 gece', 'stay', 'srch', 'vapur', per='gece aralığı')],
             'transport': [I('Transfer', 'Havalimanı → liman', 'ticket', 'srch', 'taksi-transfer'), I('Gemi', 'Limanlar arası', 'ticket', 'inc', 'vapur', 'kabinle')],
             'activity': [I('Kıyı turu', 'Marsilya', 'cards', 'sug', 'etkinlik-tur', per='liman'), I('Kıyı turu', 'Cenova', 'cards', 'sug', 'etkinlik-tur', per='liman')],
             'other': [I('Vize', 'Schengen · 3 ülke', 'stay', 'srch', 'sigorta')]},
         closes=[],
         prep=['Deniz tutması ilacı', 'Akşam kıyafeti', 'Gemi kartı ve kabin numarası'], ask=['İçecek paketi istiyor musun?'],
         hero='"3 ülke" çipi. Yolculuk sırasıyla: gece gemide, gündüz liman bölümü.'),
    dict(key='road', name='Yol gezisi', ex='İtalya · Milano → Roma', trig='"yol gezisi, road trip, araçla, karavan turu" (yerleşik tür, D11)',
         main='Kiralık araç', spine={
             'flight': [I('Uçuş', 'İstanbul → Milano', 'ticket', 'sug', 'ucus'), I('Uçuş', 'Roma → İstanbul', 'ticket', 'sug', 'ucus')],
             'transport': [I('Araç', 'Kiralama · 10 gün', 'ticket', 'sug', 'arac-kiralama'), I('Yol', 'Como → Floransa', 'ticket', 'inc', 'arac-kiralama', 'kiralık araçla'), I('Yol', 'Floransa → Roma', 'ticket', 'inc', 'arac-kiralama', 'kiralık araçla')],
             'stay': [I('Konaklama', 'Como · 2 gece', 'stay', 'sug', 'otel'), I('Konaklama', 'Floransa · 3 gece', 'stay', 'sug', 'otel'), I('Konaklama', 'Roma · 3 gece', 'stay', 'srch', 'otel')],
             'activity': [I('Etkinlik', 'Şehir başına öneri', 'cards', 'sug', 'etkinlik-tur', per='şehir')],
             'other': [I('Belge', 'Uluslararası ehliyet', 'stay', 'srch', 'sigorta')]},
         closes=[],
         prep=['ZTL bölgeleri', 'Otoyol ücreti', 'Otopark', 'Araç teslim saati'], ask=['Aracı aynı yerde mi bırakacaksın?'],
         hero='Rota haritası menüde. Aradaki yolculuklar "Dahil" sayılır, ayrı karar istemez.'),
    dict(key='day', name='Günübirlik', ex='İstanbul → Bursa', trig='tek gün, "günübirlik, hafta sonu" ve gece sayısı 0',
         main='', spine={
             'transport': [I('Feribot', 'İstanbul → Bursa', 'ticket', 'sug', 'vapur'), I('Otobüs', 'Bursa → İstanbul', 'ticket', 'sug', 'otobus')],
             'activity': [I('Etkinlik', 'Bursa', 'cards', 'sug', 'etkinlik-tur')],
             'todo': [I('Yapılacak', 'Bursa', 'cards', 'sug', 'restoran')]},
         closes=[('stay', 'aynı gün dönüş')],
         prep=[], ask=[],
         hero='Tarih tek gün. Belgeler bölümü hiç çizilmez (yurt içi, içinde niyet yok).'),
    dict(key='biz', name='İş seyahati', ex='Frankfurt · fuar', trig='"fuar, konferans, toplantı, iş seyahati"',
         main='', spine={
             'flight': [I('Uçuş', 'İstanbul → Frankfurt', 'ticket', 'sug', 'ucus'), I('Uçuş', 'Frankfurt → İstanbul', 'ticket', 'sug', 'ucus')],
             'stay': [I('Konaklama', 'Messe yakını · 2 gece', 'stay', 'sug', 'otel')],
             'transport': [I('Transfer', 'Havalimanı → otel', 'ticket', 'srch', 'taksi-transfer')],
             'activity': [I('Fuar', 'Fuar bileti', 'cards', 'srch', 'etkinlik-tur')],
             'todo': [I('Toplantı', 'Notlar ve saatler', 'cards', 'sug', 'not')]},
         closes=[],
         prep=['Kartvizit', 'Fatura bilgileri'], ask=['Fatura şirkete mi kesilecek?'],
         hero='Turistik mozaik yerine tek kapak. Fatura, Alındı ayrıntısında belge olarak durur.'),
    dict(key='safari', name='Safari ve kamp', ex='Masai Mara · Kenya', trig='"safari, game drive, lodge" · AI kalıbı (kamp)',
         main='Lodge ya da kamp', spine={
             'flight': [I('Uçuş', 'İstanbul → Nairobi', 'ticket', 'sug', 'ucus')],
             'transport': [I('Uçuş', 'Nairobi → Masai Mara · küçük uçak', 'ticket', 'srch', 'ucus')],
             'stay': [I('Kamp', 'Lodge · 3 gece', 'stay', 'srch', 'cadir', per='gece aralığı')],
             'activity': [I('Safari', 'Game drive', 'stay', 'inc', 'arac-kiralama', 'lodge paketiyle')],
             'other': [I('Vize', 'Kenya eTA', 'stay', 'srch', 'sigorta'), I('Sağlık', 'Sarıhumma aşı kartı', 'stay', 'srch', 'sigorta')]},
         closes=[],
         prep=['Sıtma ilacı', 'Nötr renkli kıyafet', 'Dürbün'], ask=['İşletilen kamp mı, kendi çadırın mı?'],
         hero='Kamp asla kendiliğinden "Alındı" sayılmaz; işletilen kamp rezervasyon ister (D3).'),
    dict(key='honeymoon', name='Balayı', ex='Maldivler', trig='"balayı, honeymoon"',
         main='Resort', spine={
             'flight': [I('Uçuş', 'İstanbul → Malé', 'ticket', 'sug', 'ucus')],
             'transport': [I('Transfer', 'Deniz uçağı ya da sürat teknesi', 'ticket', 'inc', 'vapur', 'resort paketiyle')],
             'stay': [I('Resort', 'Malé atolü · 7 gece', 'stay', 'sug', 'otel')],
             'activity': [I('Etkinlik', 'Çift spası, özel akşam yemeği, şnorkel', 'cards', 'sug', 'etkinlik-tur')]},
         closes=[],
         prep=['Evlilik belgesi kopyası', 'Resif dostu krem', 'Şnorkel'], ask=['Tek resort mu, iki mi?', 'Bütçe?'],
         hero='Mozaik: resort fotoğrafları gelirse.'),
    dict(key='classic', name='Klasik şehir turu', ex='Japonya · 4 şehir', link='./', trig='geri kalan her şey',
         main='', spine={
             'flight': [I('Uçuş', 'İstanbul → Tokyo', 'ticket', 'sug', 'ucus'), I('Uçuş', 'Osaka → İstanbul', 'ticket', 'srch', 'ucus')],
             'stay': [I('Konaklama', 'Tokyo · Kyoto · Hakone · Osaka', 'stay', 'sug', 'otel', per='gece aralığı')],
             'transport': [I('Tren', 'Şehirler arası', 'ticket', 'sug', 'tren', per='bacak'), I('Vapur', 'Ashi Gölü', 'ticket', 'inc', 'vapur', 'Hakone Free Pass ile')],
             'activity': [I('Etkinlik', 'Şehir başına', 'cards', 'sug', 'etkinlik-tur', per='şehir')],
             'todo': [I('Yapılacak', 'Şehir başına', 'cards', 'sug', 'restoran', per='şehir')],
             'other': [I('eSIM', 'Japonya eSIM', 'stay', 'sug', 'esim'), I('Sigorta', 'Seyahat sağlık sigortası', 'stay', 'srch', 'sigorta')]},
         closes=[],
         prep=['Yağmurluk', 'Japan Rail Pass', 'Yen'], ask=['Sabah erken trenler sorun mu?'],
         hero='Mozaik: plandaki yerlerin fotoğrafları.'),
]

RULES = [
    ('İskelet söyler', 'Türe özel kutunun kategorisi, çerçevesi ve adı tür iskeletinde yazılı. Kaydın sözcüklerine göre tahmin edilmez (D1).'),
    ('Paket tek niyettir', 'Tekne, retreat, kabin, festival kampı tek ana niyet. Kapsadığı kategorilerde kutu "Dahil" satırıyla gelir, karar istemez (D2).'),
    ('Pass ve kiralık araç kapsar', 'Aradaki yolculuklar "Dahil · … ile" olarak kurulur (D10).'),
    ('Başlangıç durumu', 'Türün ya da AI\'ın açtığı kutu "Aranıyor" ya da "Önerimiz" başlar. Asla kendiliğinden "Alındı" ya da "Ayarlandı" olmaz (D3).'),
    ('Biçim kapatabilir', 'Günübirlikte konaklama gibi: kategori "Gerek yok" ile kapanır, nedeni yazılır, Geri al ile döner (D4, F3).'),
    ('Kaç kutu açılır', 'Konaklama gece aralığına göre (D6). Uçuş bacak başına, aktarmalı tek niyet iki koçan (D7). Etkinlik ve yapılacak şehir başına.'),
    ('Olmayan yok yazılmaz', 'İçinde niyet olmayan kategori çizilmez. Fotoğraf yoksa mozaik yerine tek kapak (C19).'),
]

SCHEMA = [
    ('TripType', [('key, label', 'tür adı: festival, dalış teknesi, kruvaziyer…'), ('detect', 'tetikleyici sözcükler; yoksa AI kalıbı, o da yoksa klasik'), ('spine', 'sıralı omurga parçaları (aşağıda)'),
                  ('closes', 'kapanan kategori ve nedeni'), ('blocks', 'engellenen öneriler'), ('prep', 'en çok 8 hazırlık maddesi'), ('ask', 'en çok 3 soru; cevap kutuyu açar ya da kapatır'), ('hero', 'kapak biçimi ve çipler')]),
    ('SpinePart', [('cat', 'uçuş, konaklama, ulaşım, etkinlik, yapılacak, belge'), ('word', 'kutu adı: Kamp, Tekne, Skipass, Kabin'), ('frame', 'konaklama kartı · bilet · kart sırası'),
                   ('per', 'gece aralığı · bacak · şehir · liman · gün · gezi'), ('pick', 'tek seçim ya da çoklu'), ('start', 'Aranıyor ya da Önerimiz'), ('covers', 'paket ya da pass: kapsadığı kutular "Dahil"'), ('when', 'bir sorunun cevabına bağlıysa')]),
]


def tile(i):
    src = 'illus/%s.%s' % (i['img'], 'svg' if i['img'] == 'cadir' else 'png')
    by = '<small class="t-by">%s</small>' % E(i['by']) if i['by'] else ''
    per = '<i class="t-per">%s</i>' % E(i['per']) if i['per'] else ''
    return ('<div class="t-i %s"><span class="t-im"><img alt="" src="%s"></span><span class="t-m"><span class="t-w">%s</span><b>%s</b><span class="t-f">%s%s</span></span>'
            '<span class="t-st %s">%s</span>%s</div>') % (i['st'], src, E(i['word']), E(i['name']), FR[i['frame']], per, i['st'], ST[i['st']], by)


def card(t):
    rows = ''
    closed = dict(t['closes'])
    for k, nm, c in CAT:
        items = t['spine'].get(k, [])
        if items:
            rows += '<div class="t-row" style="--c:%s"><span class="t-cat"><i></i>%s</span><div class="t-is">%s</div></div>' % (c, E(nm), ''.join(tile(i) for i in items))
        if k in closed and not items:
            rows += '<div class="t-row off" style="--c:%s"><span class="t-cat"><i></i>%s</span><div class="t-off">Gerek yok · %s</div></div>' % (c, E(nm), E(closed[k]))
        elif k in closed:
            rows += '<div class="t-row note" style="--c:%s"><span class="t-cat"></span><div class="t-off">%s</div></div>' % (c, E(closed[k]))
    foot = ''
    if t['prep']:
        foot += '<div class="t-fl"><b>Hazırlık</b><span>%s</span></div>' % ''.join('<i>%s</i>' % E(p) for p in t['prep'])
    if t['ask']:
        foot += '<div class="t-fl"><b>Sorular</b><span>%s</span></div>' % ''.join('<i class="q">%s</i>' % E(q) for q in t['ask'])
    foot += '<div class="t-fl"><b>Üst özet</b><span class="t-tx">%s</span></div>' % E(t['hero'])
    link = ('<a class="t-go" href="%s">Prototipte aç ›</a>' % t['link']) if t.get('link') else ''
    main = ('<span class="t-main">Ana niyet: <b>%s</b></span>' % E(t['main'])) if t['main'] else ''
    return ('<article class="t-card" id="t-%s"><header class="t-h"><div><h2>%s</h2><small>%s</small></div>%s</header><p class="t-trig"><b>Tanınır</b> %s</p>%s'
            '<div class="t-rows">%s</div><div class="t-foot">%s</div></article>') % (t['key'], E(t['name']), E(t['ex']), link, E(t['trig']), main, rows, foot)


CSS = '''
:root{--ink:#1d1b2e;--mut:#6b6880;--line:#e8e5f0;--acc:#6a4fe0;--acc-s:#efebff;--ok:#1f8a4c;--inc:#0e7c66;--inc-s:#e6f6f1;--bg:#f8f7f4}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1240px;margin:0 auto;padding:28px 24px 80px}
.top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.top a{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:99px;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-size:13px;font-weight:700}
.top a.on{background:var(--ink);color:#fff;border-color:var(--ink)}
h1{font-size:34px;line-height:1.1;margin:6px 0 8px;letter-spacing:-.015em}
.lead{font-size:16px;color:var(--mut);max-width:820px;margin:0 0 22px}
.rules{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin:0 0 22px}
.rule{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px}.rule b{display:block;font-size:14.5px;margin-bottom:4px}.rule span{font-size:13.5px;color:var(--mut)}
.schema{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 30px}
.sc{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px}.sc h3{margin:0 0 10px;font-size:15px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--acc)}
.sc dl{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;margin:0}.sc dt{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-weight:700}.sc dd{margin:0;font-size:13.5px;color:var(--mut)}
.sc p{margin:12px 0 0;font-size:13px;color:var(--mut)}
.legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px;font-size:13px;color:var(--mut)}
.nav{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}.nav a{font-size:13px;font-weight:700;color:var(--acc);text-decoration:none;background:var(--acc-s);border-radius:99px;padding:5px 11px}
.grid{display:grid;grid-template-columns:1fr;gap:16px}
.t-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:18px 20px;display:grid;gap:12px}
.t-h{display:flex;align-items:flex-start;gap:12px}.t-h div{flex:1}.t-h h2{margin:0;font-size:21px}.t-h small{font-size:13.5px;color:var(--mut)}
.t-go{font-size:13.5px;font-weight:700;color:var(--acc);text-decoration:none;white-space:nowrap}
.t-trig{margin:0;font-size:13px;color:var(--mut)}.t-trig b{color:var(--ink);margin-right:6px}
.t-main{font-size:13px;color:var(--mut)}.t-main b{color:var(--ink)}
.t-rows{display:grid;gap:8px}
.t-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;align-items:start}
.t-cat{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;padding-top:16px}.t-cat i{width:9px;height:9px;border-radius:3px;background:var(--c)}
.t-is{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.t-i{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) auto;grid-template-areas:"im m st" "im m by";gap:2px 10px;align-items:center;min-height:66px;padding:9px 10px;border:1px solid var(--line);border-radius:14px;background:#fff}
.t-im{grid-area:im;width:48px;height:48px;border-radius:10px;background:#fbfaf7;display:grid;place-items:center;overflow:hidden}.t-im img{width:44px;height:44px;object-fit:contain}
.t-m{grid-area:m;display:grid;gap:1px;min-width:0}.t-w{font-size:11.5px;font-weight:800;color:var(--mut)}.t-m b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t-f{font-size:11.5px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap}.t-per{font-style:normal;color:var(--acc)}
.t-st{grid-area:st;font-size:11.5px;font-weight:800;border-radius:99px;padding:3px 9px;white-space:nowrap;justify-self:end}
.t-st.sug{background:var(--acc-s);color:#4a36c9}.t-st.srch{background:#f2f4f7;color:#475467}.t-st.inc{background:var(--inc-s);color:var(--inc)}.t-st.ask{background:#fff8eb;color:#7a4b00}.t-st.off{background:#f2f4f7;color:#98a2b3}
.t-by{grid-area:by;justify-self:end;font-size:11px;color:var(--inc);font-weight:700;white-space:nowrap}
.t-i.srch{border-style:dashed}.t-i.inc{background:linear-gradient(180deg,#f3fbf8,#fff);border-color:#cdeee2}.t-i.sug{background:#fbfaff;border-color:#e2dcfb}
.t-row.off .t-cat{color:#98a2b3}.t-off{font-size:13px;color:var(--mut);padding:12px 14px;border:1px dashed var(--line);border-radius:12px;background:#fcfcfd}
.t-row.note .t-off{border:0;padding:0 2px;background:none;font-size:12.5px}
.t-foot{display:grid;gap:6px;border-top:1px solid var(--line);padding-top:10px}
.t-fl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;align-items:baseline}.t-fl b{font-size:12.5px;color:var(--mut)}
.t-fl span{display:flex;gap:6px;flex-wrap:wrap}.t-fl i{font-style:normal;font-size:12.5px;background:#f6f5f2;border-radius:8px;padding:3px 8px}.t-fl i.q{background:#fff8eb;color:#7a4b00}
.t-tx{font-size:13px;color:var(--ink)}
.unk{background:#fff;border:1.5px dashed #cfc9e3;border-radius:22px;padding:18px 20px;margin-top:16px}.unk h2{margin:0 0 6px;font-size:19px}.unk ol{margin:6px 0 0 18px;padding:0;display:grid;gap:4px;font-size:14px}
.map{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:22px;padding:18px 20px}.map h2{margin:0 0 8px;font-size:19px}
.map table{width:100%;border-collapse:collapse;font-size:13.5px}.map th,.map td{text-align:left;padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}.map th{font-size:12px;color:var(--mut);border-top:0}
.map code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:#f6f5f2;border-radius:6px;padding:1px 5px}
@media (max-width:860px){.schema{grid-template-columns:1fr}.t-row,.t-fl{grid-template-columns:1fr;gap:6px}.t-cat{padding-top:0}}
@media (max-width:640px){.map table,.map tbody,.map tr,.map td{display:block}.map tr:first-child{display:none}.map td{border:0;padding:3px 0}.map tr{border-top:1px solid var(--line);padding:8px 0}.map td:first-child{font-weight:800}.map code{word-break:break-word}}
@media (max-width:480px){.w{padding:18px 16px 60px}h1{font-size:27px}.t-is{grid-template-columns:1fr}.sc dl{grid-template-columns:96px 1fr}}
'''


def page():
    rules = ''.join('<div class="rule"><b>%s</b><span>%s</span></div>' % (E(a), E(b)) for a, b in RULES)
    schema = ''.join('<div class="sc"><h3>%s</h3><dl>%s</dl>%s</div>' % (n, ''.join('<dt>%s</dt><dd>%s</dd>' % (E(a), E(b)) for a, b in f),
                                                                          '<p>Yerleşik türler ve AI\'ın kurduğu türler aynı şemayı kullanır. AI kalıbı parça parça doğrulanır; geçersiz parça düşer, gezi bozulmaz.</p>' if n == 'TripType' else '<p>Bir parça bir niyet kutusu açar. Kutunun boyu, çerçeve ailesi ve durumları v82 standardındaki gibidir.</p>') for n, f in SCHEMA)
    legend = ''.join('<span class="t-st %s">%s</span>' % (k, v) for k, v in ST.items() if k != 'off')
    nav = ''.join('<a href="#t-%s">%s</a>' % (t['key'], E(t['name'])) for t in TYPES)
    cards = ''.join(card(t) for t in TYPES)
    unk = ('<section class="unk"><h2>Tanınmayan tür gelince</h2><ol>'
           '<li>AI o gezi için aynı şemayla bir tür yazar (ör. "Hac", "Maraton", "Interrail"). Kart türü, kategori ve çerçeve listeden seçilir; liste dışı parça düşer.</li>'
           '<li>AI kalıp vermezse tür klasiktir: uçuş ve konaklama açılır, gerisi linklerle ve sohbetle gelir.</li>'
           '<li>Yer okunamazsa (deniz ya da bölge adı) gezi yine açılır; rota "Önerimiz" olarak kurulur, şehir sorulur (D5).</li>'
           '<li>Türün açtığı her kutu yine aynı 288 px kutu, aynı durumlar: Aranıyor, Önerimiz, Seçildi, Alındı, Ayarlandı, Dahil, Gerek yok.</li></ol></section>')
    mp = ('<section class="map"><h2>Canlı koda karşılığı</h2><table><tr><th>Şemadaki alan</th><th>Bugün canlıda</th><th>Ne eklenir</th></tr>'
          '<tr><td>TripType</td><td><code>PLAYBOOKS</code> (festival, ski, honeymoon, wellness, classic) ve <code>CustomPlaybook</code></td><td>Kruvaziyer ve yol gezisi yerleşik olur (D11). Dalış, safari, iş, günübirlik ilk sürümde AI kalıbı olarak aynı şemayla.</td></tr>'
          '<tr><td>SpinePart.cat, frame, word</td><td><code>CustomCard {ref, kind, title, place, anchor}</code>; kategori kaydın sözcüklerinden tahmin ediliyor</td><td><code>CustomCard</code>\'a isteğe bağlı <code>section</code>, <code>frame</code>, <code>word</code>, <code>pick</code>. Kayıt nesnesine alan eklemek DB_VERSION değiştirmez.</td></tr>'
          '<tr><td>SpinePart.covers</td><td>Yok; festival kampı <code>noBooking</code> ile "alındı" sayılıyor (hata)</td><td>İsteğe bağlı <code>covers: ref[]</code> ve <code>by</code>. Kapsanan kutu "Dahil" olur, alındı sayılmaz.</td></tr>'
          '<tr><td>stayType</td><td>hotel, boat, camp, vehicle ve <code>stayPort</code></td><td>Konaklama kutusunun adı ve çerçevesi buradan (Tekne, Kamp, Kabin).</td></tr>'
          '<tr><td>closes, blocks</td><td><code>blocked</code>, <code>focus: only</code></td><td>Kategori kapatma "Gerek yok" ve nedeni.</td></tr>'
          '<tr><td>ask, prep</td><td><code>questions</code> (en çok 3), <code>prep</code> (en çok 8)</td><td>Değişmez. Cevap, <code>when</code> ile bağlı kutuyu açar ya da kapatır.</td></tr></table></section>')
    return ('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Gezi Türleri</title><style>%s</style></head><body><div class="w">'
            '<nav class="top"><a href="./">Japonya</a><a href="ozora.html">Ozora</a><a class="on" href="turler.html">Türler</a></nav>'
            '<h1>Gezi türleri ve omurga</h1><p class="lead">Her gezi türü aynı şemayla yazılır. Şema hangi kategorinin açılacağını, her kutunun adını, çerçevesini, kaç tane açılacağını, hangi durumda başlayacağını ve bir paketin neleri "Dahil" ettiğini söyler. Plan sayfası bu şemayı okuyup aynı niyet kutularını kurar. Ozora ve Japonya prototipte çalışıyor; diğerleri aşağıda omurga olarak.</p>'
            '<div class="rules">%s</div><div class="schema">%s</div><div class="legend">Kutu durumu: %s</div><nav class="nav" aria-label="Türler">%s</nav><div class="grid">%s</div>%s%s</div></body></html>') % (CSS, rules, schema, legend, nav, cards, unk, mp)


os.makedirs(OUT + '/illus', exist_ok=True)
shutil.copy('/home/user/trip-radar/dist/illus/cadir.svg', OUT + '/illus/cadir.svg')
open(OUT + '/turler.html', 'w').write(page())
print('ok turler', len(page()))
