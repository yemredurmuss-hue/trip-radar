
# ---- v83 montaj: canlı DOM + niyet kutuları + hero83 + sohbet + Pano + senaryolar ----
from hero83 import pic as hpic
OUT = SP + '/v83'
PAGE = {'jp': 'artifact.html', 'oz': 'ozora.html'}[DATASET]
PANO['ilham'] = [dict(x, svg=scene(x['scene'])) for x in ILHAM]
SCNSET = globals().get('SCNSET', {})


def trip_html():
    out = ''
    for title, sub, key, steps in TRIP:
        if key in CHIMG:
            hdr = '<div class="q-chap-h city"><div class="q-chap-img">%s</div><div class="q-chap-t"><b>%s</b><small>%s</small><span class="q-chap-sum"></span></div></div>' % (hpic(CHIMG[key]), E(title), E(sub))
        else:
            hdr = '<div class="q-chap-h"><span class="q-chap-ic">%s</span><div><b>%s</b><small>%s</small></div></div>' % (ic('plane', 16, 2) if key == 'ucus' else ic('list', 16, 2), E(title), E(sub))
        rows = ''.join('<div class="q-step" data-t="%s" data-int="int-%s" data-o="%s"><span class="q-sdate">%s</span><span class="q-sdot"></span><div class="q-sbody"></div></div>' % (t, i, o, E(d)) if t != 'prep' else '<div class="q-step" data-t="prep"><span class="q-sdate"></span><span class="q-sdot"></span><div class="q-sbody"></div></div>' for d, t, i, o in steps)
        out += '<section class="q-chap">%s<div class="q-steps">%s</div></section>' % (hdr, rows)
    return out


def chat_html():
    # canlıdaki msg-user / msg-assistant sınıfları; AI'nın eklediği kayıt kart olarak gelir, "Planda göster" kutuya götürür (C34)
    out = ''
    for m in CHAT:
        if m[0] == 'u':
            out += '<div class="msg-user">%s</div>' % m[1]
            continue
        card = ''
        if len(m) > 2 and m[2]:
            c = m[2]
            card = ('<div class="c-card"><span class="c-img"><img alt="" src="%s"></span><span class="c-main"><span class="c-l1"><span class="q-brand" style="--bl:%s">%s</span>%s</span><b>%s</b><small>%s</small></span>'
                    '<span class="c-pr"><b>%s</b><small>%s</small></span><span class="c-acts"><button type="button" class="c-go" data-goto="%s">Planda göster</button>%s</span></div>') % (
                c['img'], c['brand'][1], E(c['brand'][0]), (' <b class="q-rb">%s</b>' % E(c['rate'])) if c.get('rate') else '', E(c['nm']), E(c['sub']), E(c['pr']), E(c['unit']), c['goto'],
                ('<span class="c-done">%s Seçildi</span>' % ic('check', 12, 3)) if c['btn'] == 'Seçildi' else '<button type="button" class="c-pick" data-goto="%s">%s</button>' % (c['goto'], E(c['btn'])))
        out += '<div class="msg-assistant" data-who="Asistan">%s%s</div>' % (E(m[1]), card)
    return out


def quick_html():
    return '<div class="c-quick" role="group" aria-label="Hızlı yanıtlar">%s</div>' % ''.join('<button type="button" class="c-q">%s</button>' % E(q) for q in QUICK)


secs = ''.join(section(c) for c in CATS) + prep_section()
body = open('/tmp/live-body.html').read()


def bal(s, start, tag):
    d = 0
    for m in re.finditer(r'<(/?)' + tag + r'\b[^>]*?(/?)>', s[start:]):
        if m.group(2) == '/':
            continue
        d += -1 if m.group(1) else 1
        if d == 0:
            return start + m.end()


def cut(s0, start_pat, tag):
    i = s0.find(start_pat)
    if i < 0:
        return s0
    return s0[:i] + s0[bal(s0, i, tag):]


a = body.index('<div class="cat-sheet"')
b = bal(body, a, 'div')
body = body[:a] + '<div class="q-sheet">' + secs + '</div>' + body[b:]
body = cut(body, '<ol class="ts-strip"', 'ol')
pb = body.index('<div class="section-head plan-bar"')
body = body[:pb] + ('<div class="q-planbar"><div class="q-pbt"><h2>Plan</h2><small>Gezinin omurgası · <button type="button" class="q-pbn">%d karar bekliyor</button></small></div>'
                    '<div class="q-seg" role="tablist" aria-label="Plan görünümü"><button type="button" role="tab" data-view="cat" aria-selected="true" class="on">Kategoriye göre</button>'
                    '<button type="button" role="tab" data-view="trip" aria-selected="false">Yolculuk sırasıyla</button><button type="button" role="tab" data-view="day" aria-selected="false">Gün gün</button></div></div>') % HERO['prog'][2] + body[bal(body, pb, 'div'):]
body = body.replace('<div class="q-sheet">', '<div class="q-trip" hidden>' + trip_html() + '</div><div class="q-sheet">', 1)
body = cut(body, '<div class="sbar-slot"', 'div')
hi = body.index('<section class="hx"')
he = bal(body, hi, 'section')
body = body[:hi] + hero83(HERO) + body[he:]
# sohbet: görüşme, hızlı yanıtlar, dar ekran çekmecesinin tutamağı
mi = body.index('<div class="messages">')
me = bal(body, mi, 'div')
body = body[:mi] + '<div class="messages">' + chat_html() + '</div>' + quick_html() + body[me:]
body = body.replace('<section class="chat">', '<section class="chat"><button type="button" class="c-handle" aria-expanded="false" aria-label="Sohbeti aç"><i></i><span class="c-hl">Asistan</span><small class="c-hs">%s</small></button>' % E(CHAT[-1][1][:64] + ('…' if len(CHAT[-1][1]) > 64 else '')), 1)
body = body.replace('Durumlar (denetim) için', HERO['title'] + ' için').replace('Durumlar (denetim)', HERO['title'])
body = re.sub(r'<script[^>]*src="app.js"[^>]*></script>', '', body)
npano = sum(len(i['opts']) for c in CATS for i in c['intents'])
body = re.sub(r'(<span class="tab-n" aria-hidden="true">)\d+(</span>)', r'\g<1>%d\2' % npano, body)
body = body.replace('src="https://klook.com/favicon.ico"', 'hidden')
# çevrimdışı şeridi (C9): yalnız "Durumlar" senaryosunda görünür
body = body.replace('<div class="q-planbar">', '<div class="q-offline" role="status">%s<b>Çevrimdışısın</b><span>Değişiklikler bu cihazda duruyor, bağlantı gelince eşitlenir. AI ve fiyatlar bağlantı gelince yenilenir.</span></div><div class="q-planbar">' % hic('alert', 15, 2.2), 1)
pages = [('artifact.html', 'Japonya', './'), ('ozora.html', 'Ozora', 'ozora.html'), ('turler.html', 'Türler', 'turler.html')]
plinks = ''.join('<a href="%s"%s>%s</a>' % (h, ' class="on" aria-current="page"' if p == PAGE else '', n) for p, n, h in pages)
ctrl = ('<div class="q-ctrl" role="region" aria-label="Prototip"><b>Prototip</b><span class="g pg">%s</span><span class="g">%s</span>'
        '%s<button type="button" class="q-still" aria-pressed="false">Hareketi duraklat</button></div>') % (
    plinks, ''.join('<button type="button" data-scn="%s"%s>%s</button>' % (k, ' class="on"' if ix == 0 else '', E(n)) for ix, (k, n) in enumerate(SCN)),
    '<button type="button" data-arrive="1" hidden>AI sonucu gelsin</button>' if globals().get('ARRIVE') else '')
sheet = ('<div class="q-scrim" hidden></div><div class="q-sheetp" role="dialog" aria-modal="true" aria-label="Pano" hidden><div class="q-sh"><div class="q-sht"><b>Pano</b><small>Biriktirdiklerin, AI önerileri, belgeler ve ilham</small></div><span class="q-sp"></span><button type="button" class="q-x" aria-label="Pano\'yu kapat">%s</button></div><div class="q-pbody"><nav class="q-side" aria-label="Pano bölümleri"></nav><div class="q-pmain"><div class="q-sc"></div></div></div></div>' % ic('x', 18, 2.4)
         + '<script>window.PANO=' + json.dumps(PANO, ensure_ascii=False).replace('</', '<\\/') + ';window.SCNSET=' + json.dumps(SCNSET, ensure_ascii=False) + ';</script>')
css = open(DIST + 'app.css').read() + '\n' + open(SP + '/mk81.css').read() + '\n' + open(SP + '/mk82.css').read() + '\n' + open(SP + '/mk83.css').read()
js = open(SP + '/mk83.js').read()
body = bgfix(body)
ttl = {'jp': 'Katmanlı Plan', 'oz': 'Ozora Planı'}[DATASET]
page = '<title>%s</title><meta name="claude:viewport-fit-sides" content="cover"><style>' % ttl + css + '</style><div id="root" class="vcat q-app ds-%s">' % DATASET + body + '</div>' + sheet + ctrl + '<script>' + js + '</script>'
os.makedirs(OUT + '/illus', exist_ok=True)
os.makedirs(OUT + '/photos', exist_ok=True)
for f in os.listdir(DIST + 'illus'):
    if f.endswith('.png'):
        shutil.copy(DIST + 'illus/' + f, OUT + '/illus/' + f)
for f in os.listdir(SP + '/photos82'):
    if f.endswith('.jpg'):
        shutil.copy(SP + '/photos82/' + f, OUT + '/photos/' + f)
open(OUT + '/' + PAGE, 'w').write(page)
open(OUT + '/' + PAGE.replace('.html', '-full.html'), 'w').write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>')
print('ok', DATASET, len(page))
