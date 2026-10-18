p='turler83.py'; s=open(p).read()
def R(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:70]); s=s.replace(a,b)
R("RULES = [", '''SIGNALS = [
    ('Nerede uyunur', 'otel ya da ev · tekne · kamp · gemi kabini · araç · yok', 'Konaklama kutusunun adı ve çerçevesi (Tekne, Kamp, Kabin). "Yok" ise Konaklama "Gerek yok · aynı gün dönüş".'),
    ('Paket', 'bir alım başka kutuları kapsar', 'Kapsanan kutular "Dahil · … ile" gelir, karar istemez: retreat → konaklama ve transfer, tekne → konaklama ve dalış, festival bileti → kamp.'),
    ('Pass ya da kiralık araç', 'aradaki yolculukları kapsar', 'JR, Hakone, Interrail, kiralık araç: aradaki bacaklar "Dahil" (D10).'),
    ('Hareketli üs', 'gemi, araç, tren pass ile durak durak', 'Gece ile durak ayrılır; Yolculuk sırasıyla durak bölümleri, etkinlik durak başına.'),
    ('Yakın havalimanı', 'hedefte havalimanı yok', 'Uçuş en yakın havalimanına, Ulaşım\\'a oradan transfer. Kısa bilgi satırı nedenini söyler.'),
    ('Günlük hak', 'skipass, park bileti, festival günleri', 'Konaklama günleri boyunca tek seçim, fiyat kişi × gün.'),
    ('Odak', 'tek deneyim', 'Festival, dalış, retreat: diğer etkinlik önerileri kapanır; kategorinin başında kısa bilgi.'),
    ('Ekipman', 'kiralanır ya da kendin getirirsin', 'Kayak, dalış, bisiklet, kamp: "kendi ekipmanım" cevabı kutuyu kapatır, Bavul\\'a madde ekler.'),
    ('Belge ve sağlık', 'vize, aşı, sertifika, ehliyet, kayıt', 'Belgeler\\'de kutu, Hazırlık\\'ta günlü madde (T3).'),
    ('Kimler', 'yalnız, çift, aile, ekip', 'Oda sayısı, kişi başı satırı (T5), öneri tonu.'),
    ('Zaman', 'günübirlik, tarihsiz, gece uçuşu', 'Tek gün; "~" tarih ve Yolculuk sırasıyla kapalı (D15); "uçakta" satırı (D14).'),
]
SIG = {'festival': ['uyunur: kamp', 'paket: bilet kampı kapsar', 'odak', 'yakın havalimanı'], 'dive': ['uyunur: tekne', 'paket: konaklama, transfer, dalış', 'odak', 'ekipman', 'belge: sertifika'],
       'ski': ['günlük hak: skipass', 'ekipman', 'yakın havalimanı'], 'wellness': ['paket: program konaklama ve transferi kapsar', 'odak'], 'cruise': ['uyunur: gemi kabini', 'hareketli üs', 'paket: limanlar arası'],
       'road': ['hareketli üs', 'kiralık araç kapsar', 'belge: ehliyet'], 'day': ['uyunur: yok', 'zaman: tek gün'], 'biz': ['kimler: yalnız', 'zaman: kısa'], 'safari': ['uyunur: kamp ya da lodge', 'paket: game drive', 'belge ve sağlık'],
       'honeymoon': ['kimler: çift', 'paket: transfer'], 'classic': ['pass kapsar (Hakone)', 'çok şehir']}
INFO = {'festival': {'stay': 'Festival gezisi: festival günlerinde konaklama bilete dahil kamp olarak kuruldu, otel aranmaz.', 'activity': 'Odak festival: başka tur ve etkinlik önerilmez.'},
        'dive': {'stay': 'Dalış teknesi: konaklama, yemek ve dalışlar tekne paketinde; otel aranmaz.'},
        'ski': {'activity': 'Kayak: skipass konaklama günleri boyunca; ekipman ve okul cevabına göre açılır.'},
        'wellness': {'stay': 'Retreat: program konaklamayı ve transferi kapsıyorsa onlar "Dahil" olur.'},
        'cruise': {'transport': 'Kruvaziyer: limanlar arası yolculuk kabine dahil; yalnız limana transfer karar ister.'},
        'road': {'transport': 'Yol gezisi: kiralık araç şehirler arası yolculukları kapsar.'},
        'day': {'stay': 'Günübirlik: aynı gün dönüş, konaklama kapandı.'},
        'safari': {'stay': 'Safari: işletilen kamp rezervasyon ister; kendiliğinden alındı sayılmaz.'},
        'honeymoon': {'transport': 'Resort transferi çoğu zaman pakette; onay sayfası söylerse "Dahil" olur.'}}
NAMELESS = [
    dict(name='Kapadokya: balon ve mağara otel', sig=['uyunur: otel', 'paket: balon turu otel transferini kapsar', 'zaman: şafak'], spine={
        'stay': [I('Konaklama', 'Göreme · 2 gece · mağara otel', 'stay', 'sug', 'otel')],
        'activity': [I('Balon', 'Balon turu · 05:00', 'stay', 'sug', 'etkinlik-tur', per='tek seçim'), I('Transfer', 'Otel → kalkış alanı', 'ticket', 'inc', 'minibus', 'balon turuyla')]}),
    dict(name='Berlin maratonu', sig=['odak: yarış', 'belge: kayıt ve numara alma', 'kimler: yalnız'], spine={
        'stay': [I('Konaklama', 'Start alanına yakın · 3 gece', 'stay', 'sug', 'otel')],
        'activity': [I('Yarış', 'Maraton kaydı', 'cards', 'srch', 'etkinlik-tur')],
        'todo': [I('Numara', 'Göğüs numarası alma · fuar', 'cards', 'sug', 'not')]}),
    dict(name='Interrail · 3 hafta', sig=['hareketli üs', 'pass kapsar', 'çok ülke'], spine={
        'transport': [I('Pass', 'Interrail · 15 gün', 'ticket', 'sug', 'tren'), I('Tren', 'Viyana → Prag', 'ticket', 'inc', 'tren', 'pass ile'), I('Tren', 'Prag → Berlin', 'ticket', 'inc', 'tren', 'pass ile')],
        'stay': [I('Konaklama', 'Şehir başına gece aralığı', 'stay', 'sug', 'ev-daire', per='gece aralığı')]}),
]

RULES = [''')
R("""        if items:
            rows += '<div class="t-row" style="--c:%s"><span class="t-cat"><i></i>%s</span><div class="t-is">%s</div></div>' % (c, E(nm), ''.join(tile(i) for i in items))""",
  """        inf = INFO.get(t.get('key'), {}).get(k)
        infh = ('<p class="t-inf"><i>i</i>%s</p>' % E(inf)) if inf else ''
        if items:
            rows += '<div class="t-row" style="--c:%s"><span class="t-cat"><i></i>%s</span><div class="t-isw">%s<div class="t-is">%s</div></div></div>' % (c, E(nm), infh, ''.join(tile(i) for i in items))""")
R("""    return ('<article class="t-card" id="t-%s"><header class="t-h"><div><h2>%s</h2><small>%s</small></div>%s</header><p class="t-trig"><b>Tanınır</b> %s</p>%s'
            '<div class="t-rows">%s</div><div class="t-foot">%s</div></article>') % (t['key'], E(t['name']), E(t['ex']), link, E(t['trig']), main, rows, foot)""",
  """    sig = '<p class="t-sig">%s</p>' % ''.join('<i>%s</i>' % E(x) for x in SIG.get(t['key'], []))
    return ('<article class="t-card" id="t-%s"><header class="t-h"><div><h2>%s</h2><small>%s</small></div>%s</header>%s<p class="t-trig"><b>Tanınır</b> %s</p>%s'
            '<div class="t-rows">%s</div><div class="t-foot">%s</div></article>') % (t['key'], E(t['name']), E(t['ex']), link, sig, E(t['trig']), main, rows, foot)


def mini(n):
    rows = ''.join('<div class="t-row" style="--c:%s"><span class="t-cat"><i></i>%s</span><div class="t-is">%s</div></div>' % (c, E(nm), ''.join(tile(i) for i in n['spine'][k])) for k, nm, c in CAT if k in n['spine'])
    return '<article class="t-card nm"><header class="t-h"><div><h2>%s</h2><small>adı tanınmadı · sinyallerden kuruldu</small></div></header><p class="t-sig">%s</p><div class="t-rows">%s</div></article>' % (
        E(n['name']), ''.join('<i>%s</i>' % E(x) for x in n['sig']), rows)""")
R("""SCHEMA = [
    ('TripType', [('key, label', 'tür adı: festival, dalış teknesi, kruvaziyer…'), ('detect', 'tetikleyici sözcükler; yoksa AI kalıbı, o da yoksa klasik'), ('spine', 'sıralı omurga parçaları (aşağıda)'),""",
  """SCHEMA = [
    ('TripShape', [('signals', 'yukarıdaki 11 sinyal; AI her gezi için doldurur, kod doğrular'), ('preset', 'tanıdık türse hazır karışım (festival, kayak…); yalnız varsayılan verir, sinyal ezer'), ('spine', 'sinyallerden kurulan omurga parçaları (aşağıda)'), ('info', 'ilgili kategorinin başındaki kısa bilgi; yalnız biçim bir şeyi değiştirdiyse'),""")
R("""'<p>Yerleşik türler ve AI\\'ın kurduğu türler aynı şemayı kullanır. AI kalıbı parça parça doğrulanır; geçersiz parça düşer, gezi bozulmaz.</p>' if n == 'TripType'""",
  """'<p>Tür adı yalnız bir kısayol. Plan sayfası sinyalleri okur; tanınmayan gezi de aynı yoldan kurulur. AI\\'ın yazdığı sinyaller parça parça doğrulanır; geçersiz parça düşer, gezi bozulmaz.</p>' if n == 'TripShape'""")
R("""    nav = ''.join('<a href="#t-%s">%s</a>' % (t['key'], E(t['name'])) for t in TYPES)""",
  """    nav = ''.join('<a href="#t-%s">%s</a>' % (t['key'], E(t['name'])) for t in TYPES)
    sigs = ''.join('<div class="sg"><b>%s</b><small>%s</small><span>%s</span></div>' % (E(a), E(b), E(c)) for a, b, c in SIGNALS)
    noname = ''.join(mini(n) for n in NAMELESS)""")
R("""'<h1>Gezi türleri ve omurga</h1><p class="lead">Her gezi türü aynı şemayla yazılır. Şema hangi kategorinin açılacağını, her kutunun adını, çerçevesini, kaç tane açılacağını, hangi durumda başlayacağını ve bir paketin neleri "Dahil" ettiğini söyler. Plan sayfası bu şemayı okuyup aynı niyet kutularını kurar. Ozora ve Japonya prototipte çalışıyor; diğerleri aşağıda omurga olarak.</p>'
            '<div class="rules">%s</div><div class="schema">%s</div><div class="legend">Kutu durumu: %s</div><nav class="nav" aria-label="Türler">%s</nav><div class="grid">%s</div>%s%s</div></body></html>') % (CSS, rules, schema, legend, nav, cards, unk, mp)""",
  """'<h1>Gezi biçimi ve omurga</h1><p class="lead">Sistem gezinin adına değil biçimine bakar: nerede uyunur, bir alım neyi kapsar, durak durak mı gidilir, gidilen yere uçak iner mi, odak tek deneyim mi. Omurga bu sinyallerden kurulur; adı ne olursa olsun yeni bir gezi aynı yoldan şekillenir. Tanıdık türler (festival, dalış, balayı…) yalnız hazır bir karışım; onlarda ilgili kategorinin başında kısa bir bilgi satırı çıkar. Ozora ve Japonya prototipte çalışıyor.</p>'
            '<h2 class="sh">Sinyaller</h2><div class="sgs">%s</div>'
            '<div class="rules">%s</div><div class="schema">%s</div>'
            '<h2 class="sh">Adı tanınmayan geziler</h2><p class="lead sm">Hiçbir hazır karışıma uymayan geziler de aynı sinyallerle kurulur.</p><div class="grid">%s</div>'
            '<h2 class="sh">Hazır karışımlar</h2><div class="legend">Kutu durumu: %s</div><nav class="nav" aria-label="Türler">%s</nav><div class="grid">%s</div>%s%s</div></body></html>') % (CSS, sigs, rules, schema, noname, legend, nav, cards, unk, mp)""")
R("('İskelet söyler', 'Türe özel kutunun kategorisi, çerçevesi ve adı tür iskeletinde yazılı. Kaydın sözcüklerine göre tahmin edilmez (D1).'),",
  "('Biçim söyler', 'Kutunun kategorisi, çerçevesi ve adı sinyallerden gelir; kaydın sözcüklerine göre tahmin edilmez (D1).'),")
R("""'<li>AI o gezi için aynı şemayla bir tür yazar (ör. "Hac", "Maraton", "Interrail"). Kart türü, kategori ve çerçeve listeden seçilir; liste dışı parça düşer.</li>'""",
  """'<li>AI gezinin sinyallerini doldurur (ör. Hac, Maraton, Interrail). Kart türü, kategori ve çerçeve listeden seçilir; liste dışı parça düşer.</li>'""")
R("""'<li>AI kalıp vermezse tür klasiktir: uçuş ve konaklama açılır, gerisi linklerle ve sohbetle gelir.</li>'""",
  """'<li>AI yoksa ya da sinyal gelmezse yalnız kesin olanlar kurulur: uçuş, gece aralığına göre konaklama, belgeler. Gerisi linklerle ve sohbetle gelir.</li>'""")
R("<h2>Tanınmayan tür gelince</h2>","<h2>Sinyal eksik ya da yanlış gelince</h2>")
R("""'<tr><td>TripType</td><td><code>PLAYBOOKS</code> (festival, ski, honeymoon, wellness, classic) ve <code>CustomPlaybook</code></td><td>Kruvaziyer ve yol gezisi yerleşik olur (D11). Dalış, safari, iş, günübirlik ilk sürümde AI kalıbı olarak aynı şemayla.</td></tr>'""",
  """'<tr><td>TripShape</td><td><code>PLAYBOOKS</code> (festival, ski, honeymoon, wellness, classic) ve AI\\'ın yazdığı <code>CustomPlaybook</code></td><td>İkisi aynı sinyal kümesini doldurur; yerleşik türler hazır karışım olur (kruvaziyer ve yol gezisi eklenir, D11). Adı tanınmayan gezi AI\\'ın sinyalleriyle kurulur.</td></tr>'""")
R("""'<tr><td>stayType</td><td>hotel, boat, camp, vehicle ve <code>stayPort</code></td><td>Konaklama kutusunun adı ve çerçevesi buradan (Tekne, Kamp, Kabin).</td></tr>'""",
  """'<tr><td>Nerede uyunur</td><td><code>stayType</code> (hotel, boat, camp, vehicle) ve <code>stayPort</code></td><td>Kabin ve "yok" (günübirlik) eklenir. Konaklama kutusunun adı ve çerçevesi buradan.</td></tr>'
          '<tr><td>Yakın havalimanı, hareketli üs, günlük hak</td><td>festival gateway kuralı; diğerleri yok</td><td>İsteğe bağlı alanlar: <code>gateway</code>, <code>movingBase</code>, <code>perDay</code>. Kayıt nesnesine eklenir, DB_VERSION değişmez.</td></tr>'
          '<tr><td>info</td><td>yok</td><td>Kategori başına kısa metin; yalnız biçim bir şeyi değiştirdiyse (kamp, Dahil, kapanan öneri, yakın havalimanı).</td></tr>'""")
R(".unk{", ".sh{font-size:22px;margin:30px 0 10px}.lead.sm{font-size:14px;margin-bottom:12px}\n.sgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;margin:0 0 22px}\n.sg{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:grid;gap:3px}.sg b{font-size:14.5px}.sg small{font-size:12.5px;color:var(--acc);font-weight:700}.sg span{font-size:13px;color:var(--mut)}\n.t-sig{display:flex;gap:6px;flex-wrap:wrap;margin:0}.t-sig i{font-style:normal;font-size:12px;font-weight:700;color:#4a36c9;background:var(--acc-s);border-radius:99px;padding:3px 10px}\n.t-isw{display:grid;gap:8px;min-width:0}.t-inf{display:flex;gap:8px;align-items:flex-start;margin:0;padding:8px 12px;border-radius:12px;background:#f6f4fd;color:#3d3566;font-size:13px}.t-inf i{flex:none;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#e4dcff;color:#4a36c9;font:italic 700 11px/1 Georgia,serif;margin-top:1px}\n.t-card.nm{border-style:dashed;border-color:#cfc9e3}\n.unk{")
open(p,'w').write(s)
print('patched')
