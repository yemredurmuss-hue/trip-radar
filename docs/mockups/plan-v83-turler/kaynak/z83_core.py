
# ================= v82: niyet kutusu standardı =================
# Her niyet kutusu = sabit başlık + sabit boy gövde. Gövde her durumda aynı çerçeve:
#  konaklama/eSIM/sigorta: görsel | bilgi (4 satır) | yan sütun (üst bilgi + eylemler)
#  uçuş/tren/transfer: bilet (taşıyıcı, rota, çipler) | koçan (üst bilgi + eylemler)
#  etkinlik/yapılacak: sabit boy kart sırası (Planında + Öneriler)
# Bilgi gelmediyse aynı yerde yer tutucu durur; Ayrıntı kartı büyütmez, kartın üstünde açılır.
from hero83 import hero as hero83, ic as hic
import os as _os
DATASET = _os.environ.get('DATASET', 'jp')
DEFAULT_PPL = '2 kişi'
MIXED = {'transport', 'other'}


def vals_of(it):
    return [v for v in it['vals'] if v != DEFAULT_PPL]


def info_btn():
    return '<button type="button" class="z-ib q-inf" aria-label="Ayrıntı" aria-expanded="false" title="Ayrıntı"><i>i</i></button>'


def det_close():
    return '<button type="button" class="z-dx q-inf" aria-label="Ayrıntıyı kapat">%s</button>' % ic('x', 14, 2.4)


def short_cancel(c):
    if not c:
        return ''
    return '<span class="z-chip %s">%s</span>' % (ccls(c), E(c.split(' · ')[0]))


def score_b(o):
    r = o.get('rate', '')
    if not r:
        return ''
    star = r.startswith('★')
    v = r.replace('★ ', '')
    return '<span class="z-rate"><b class="q-rb%s">%s</b>%s</span>' % (' star' if star else '', ('★ ' if star else '') + v, (' <small>%s</small>' % E(o['rev'])) if o.get('rev') else '')


def brand_chip(o):
    return '<span class="q-brand" style="--bl:%s">%s</span>' % (o['brand'][1], E(o['brand'][0]))


def title_of(o):
    return o['name'].split(' · ', 1)[1] if o['name'].startswith(o['brand'][0] + ' · ') else o['name']


def cancel_chip(it, o):
    if any(t == 'ücretsiz iptal' for t, _ in it['wants']):
        return ''
    return short_cancel(o.get('cancel', ''))


def match2(it, o):
    m = MATCH.get(o['id'], {})
    out = []
    for t, k in it['wants']:
        if t in m:
            out.append('<span class="z-chip %s">%s %s</span>' % ('y' if m[t] else 'n', '✓' if m[t] else '✕', E(t)))
    return ''.join(out[:2])


def provs(it, label=True):
    return ('<span class="z-self">%s%s</span>' % ('<small>Kendin ara</small>' if label else '', ''.join(
        '<a class="z-pl" href="#" onclick="return false" title="%s\'da ara">%s<span>%s</span></a>' % (E(n), logo(n, ' sm'), E(n)) for n, _, _ in it['links'])))


def side(top, primary, row):
    return '<div class="z-s"><div class="z-top">%s</div><div class="z-bt">%s<div class="z-row">%s</div></div></div>' % (top, primary, row)


def zcard(media, l1, t, l2, l3, sd, det='', cls=''):
    return ('<div class="z-f z-c%s">%s<div class="z-m">%s</div><div class="z-i"><span class="z-l1">%s</span><h3 class="z-t">%s</h3>'
            '<span class="z-l2">%s</span><span class="z-l3">%s</span></div>%s%s</div>') % (cls, info_btn() if det else '', media, l1, t, l2, l3, sd, det)


def price_b(it, o):
    k = it['kind']
    if k in ('stay', 'esim'):
        _, tl = total(it, o)
        return '<span class="q-pr big"><b>%s</b><small>%s · %s</small></span>' % (o['price'], o['unit'], tl.split(' · ')[-1] if k == 'stay' else tl)
    return '<span class="q-pr big"><b>%s</b><small>kişi başı · 2 kişi %s</small></span>' % (o['price'], eur(num(o['price']) * 2))


def det_panel(it, o, f):
    bw = {'stay': 'Onay', 'esim': 'QR kod', 'fly': 'E-bilet', 'rail': 'Bilet', 'ev': 'Bilet'}.get(it['kind'], 'Belge')
    d = booked_panel(o, bw) if f == 'bk' else check_panel(it, o)
    return d.replace('<div class="q-det" hidden>', '<div class="q-det z-det" hidden>' + det_close(), 1)


# ---- seçenekler (karar bekliyor) ----
def opt_row_fly(it, o):
    st = 'ok' if o['stops'] == 'direkt' else 'warn'
    bag = BAG.get(o['id'], '')
    return ('<div class="q-row q-opt z-r" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
            '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="%s">%s</small></span><span class="q-tm r"><b>%s%s</b><small>%s</small></span></span>'
            '<span class="z-tags">%s</span><span class="q-buy"><span class="q-pr"><b>%s</b></span><span class="q-bg">%s%s</span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>') % (
        odata(it, o), '', logo(o['alname']), o['alname'], o['no'], o['ft'], o['fc'], o['dur'], st, o['stops'], o['tt'], '<sup>+1</sup>' if o['plus'] else '', o['tc'], rib(o), o['price'], ic('bag', 12, 2) if bag else '', bag, who(o))


def opt_row_rail(it, o):
    return ('<div class="q-row q-opt z-r" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
            '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="ok">%s</small></span><span class="q-tm r"><b>%s</b><small>%s</small></span></span>'
            '<span class="z-tags">%s</span><span class="q-buy"><span class="q-pr"><b>%s</b></span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>') % (
        odata(it, o), '', logo(o['brand'][0]), o['line'].replace('Shinkansen ', ''), o.get('sub2') or (o['brand'][0] + (' · Shinkansen' if 'Shinkansen' in o['line'] else '')), o['dep'], o['df'], o.get('mid') or dur(o['dep'], o['arr']), o.get('stops', 'aktarmasız'), o['arr'], o['dt'], rib(o), o['price'], who(o))


def opt_card_stay(it, o):
    tag = TAG.get(o['id'], '')
    return ('<article class="q-card q-opt z-oc" %s><div class="z-op"><img alt="" src="%s">%s%s</div><div class="z-ob"><span class="z-l1">%s%s</span><h3 class="z-t">%s</h3>'
            '<div class="z-of"><span class="q-pr"><b>%s</b><small>%s</small></span><button type="button" class="q-pick">Seç</button></div></div></article>') % (
        odata(it, o), img(o['img']), src(o), ('<span class="q-tag on-ph">%s</span>' % tag) if tag else '', brand_chip(o), score_b(o), E(title_of(o)), o['price'], o['unit'])


def kcard(cls, data, pic, l1, t, l2, foot, extra=''):
    return ('<article class="%s z-k" %s><div class="z-kp">%s</div><div class="z-kb"><span class="z-l1">%s</span><h3 class="z-t" title="%s">%s</h3><span class="z-l2">%s</span>'
            '<div class="z-kf">%s</div></div>%s</article>') % (cls, data, pic, l1, re.sub('<[^>]+>', '', t), t, l2, foot, extra)


def opt_card_ev(it, o):
    return kcard('q-card q-opt', odata(it, o), '<img alt="" src="illus/etkinlik-tur.png">' + src(o), brand_chip(o), E(o['name']),
                 '%s · %s kişi başı' % (o['date'], o['price']), '<button type="button" class="q-pick ghost">+ Plana koy</button>')


def opt_tile_todo(it, o):
    return kcard('q-tile q-opt', odata(it, o), '<img alt="" src="%s">%s' % (img(o['img']), src(o)), '<span class="z-tagc">%s</span>' % o['tag'], E(o['name']), E(o['sub']),
                 '<button type="button" class="q-pick ghost">+ Plana koy</button>')


def opt_html(it, o):
    return {'fly': opt_row_fly, 'rail': opt_row_rail, 'pass': opt_row_rail, 'stay': opt_card_stay, 'esim': opt_card_stay, 'ev': opt_card_ev, 'todo': opt_tile_todo}[it['kind']](it, o)


# ---- seçilmiş / önerilen / alınmış ----
def form(it, o, f):
    k = it['kind']
    w = '<div class="q-form" data-o="%s" data-f="%s" hidden>%%s</div>' % (o['id'], f)
    det = det_panel(it, o, f)
    if k in ('stay', 'esim'):
        media = '<img alt="" src="%s">%s' % (img(o['img']), src(o) if f != 'bk' else '<span class="z-stamp">%s</span>' % ic('check', 18, 3))
        if f == 'sel':
            sd = side(price_b(it, o), cta(it, o, 'q-cta full'), '<button type="button" class="q-got">✓ Aldım</button><button type="button" class="q-chg">Değiştir</button>')
            return w % zcard(media, brand_chip(o) + score_b(o), E(title_of(o)), E(o['sub']), cancel_chip(it, o) + match2(it, o), sd, det)
        if f == 'ai':
            sd = side(price_b(it, o), '<button type="button" class="q-pick q-take full">Bunu seç</button>', '<button type="button" class="q-chg">Değiştir</button><a class="q-srcl" href="#" onclick="return false">%s ↗</a>' % E(bname(o)))
            return w % zcard(media, brand_chip(o) + score_b(o), E(title_of(o)), E(o['sub']), cancel_chip(it, o) + match2(it, o), sd, det)
        a = ACC.get(o['id'])
        if a:
            l2 = '<span class="q-aw">%s %s</span>' % (ic('cal', 13, 2), E(a['when']))
            l3 = '<span class="q-aw">%s %s</span>' % (ic('pin', 13, 2), E(a['where']))
            top = '<span class="z-lbl">%s kodu</span><span class="q-code st">%s<button type="button" class="q-cp" aria-label="%s kopyala">%s</button></span><small class="z-paid">%s</small>' % (E(a['code'][0]), E(a['code'][1]), E(a['code'][0]), ic('copy', 12, 2.2), E(a.get('paid', '')))
            doc = ('<button type="button" class="q-open full">%s %s aç</button>' % (ic('clip', 14, 2.2), E(a['doc']))) if a['doc'] else '<button type="button" class="q-doc add full">%s Onayı ekle</button>' % ic('clip', 13, 2.2)
            row = ''.join('<a class="q-alk" href="#" onclick="return false">%s ↗</a>' % E(l) for l in a['links'])
        else:
            l2 = '<span class="q-aw">%s %s</span>' % (ic('cal', 13, 2), E(' · '.join(vals_of(it))))
            l3 = '<span class="q-aw">%s adres onayla gelir</span>' % ic('pin', 13, 2)
            top = '<span class="z-lbl">Onay kodu</span><span class="q-code none">eklenmedi</span>'
            doc = '<button type="button" class="q-doc add full">%s Onayı ekle</button>' % ic('clip', 13, 2.2)
            row = ''
        sd = side(top, doc, row)
        return w % zcard(media, '<span class="z-ok">%s %s</span><span class="z-dim">· %s</span>' % (ic('check', 13, 3), 'Rezerve edildi' if k == 'stay' else 'Satın alındı', E(o['brand'][0])), E(title_of(o)), l2, l3, sd, det, ' bk')
    if k in ('fly', 'rail', 'pass'):
        if k == 'pass':
            carrier = '%s<span><b>%s</b> <small>%s · %s</small></span>' % (logo(o['brand'][0]), o['line'], o['brand'][0], o['date'])
            a = (o['ca'], o['sa'])
            b = (o['cb'], o['sb'])
            mid = (o['mid'], o['mid2'])
            il = o.get('il', 'tren')
        elif k == 'fly':
            carrier = '%s<span><b>%s</b> <small>%s · %s</small></span>' % (logo(o['alname']), o['alname'], o['no'], o['date'])
            a = (it['name'][0], '%s · <strong>%s</strong>' % (o['fc'], o['ft']))
            b = (it['name'][1], '%s · <strong>%s</strong>%s' % (o['tc'], o['tt'], '<sup>+1</sup>' if o['plus'] else ''))
            mid = (o['dur'], o['stops'])
            il = 'ucus'
        else:
            carrier = '%s<span><b>%s</b> <small>%s · %s</small></span>' % (logo(o['brand'][0]), o['line'], o['brand'][0], o['date'])
            a = (it['name'][0], '%s · <strong>%s</strong>' % (o['df'], o['dep']))
            b = (it['name'][1], '%s · <strong>%s</strong>' % (o['dt'], o['arr']))
            mid = (dur(o['dep'], o['arr']), o.get('stops', 'aktarmasız'))
            il = o.get('il') or it['img']
        st = 'ok' if mid[1] in ('direkt', 'aktarmasız', 'kendin sür') or k == 'pass' else 'warn'
        bag = BAG.get(o['id'], '')
        ac = ACC.get(o['id'], {})
        chips = ('<span class="z-chip">%s %s</span>' % (ic('bag', 12, 2), bag)) if bag else ''
        chips += ''.join('<span class="z-chip">%s</span>' % E(c) for c in o.get('chips', []))
        if f == 'bk' and ac:
            chips += '<span class="z-chip">%s %s</span>' % (ic('pin', 12, 2), E(ac['where'].split(' · ')[0]))
        main = ('<div class="z-tm"><div class="z-car">%s</div><div class="q-route z-route"><span class="q-tm big q-city"><b>%s</b><small>%s</small></span>'
                '<span class="q-mid big"><small>%s</small><i><img alt="" src="illus/%s.png"></i><small class="%s">%s</small></span><span class="q-tm big q-city r"><b>%s</b><small>%s</small></span></div>'
                '<span class="z-l3">%s</span></div>') % (carrier, a[0], a[1], mid[0], il, st, mid[1], b[0], b[1], chips)
        if f == 'sel':
            sd = side(price_b(it, o), cta(it, o, 'q-cta full'), '<button type="button" class="q-got">✓ Aldım</button><button type="button" class="q-chg">Değiştir</button>')
        elif f == 'ai':
            sd = side(price_b(it, o), '<button type="button" class="q-pick q-take full">Bunu seç</button>', '<button type="button" class="q-chg">Değiştir</button><a class="q-srcl" href="#" onclick="return false">%s ↗</a>' % E(bname(o)))
        else:
            code = ('<span class="q-code st">%s <b>%s</b><button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>' % (E(ac['code'][0]), E(ac['code'][1]), ic('copy', 12, 2.2))) if ac else '<span class="q-code none">Kod <b>eklenmedi</b></span>'
            top = '<span class="z-ok">%s %s</span>%s<small class="z-paid">%s</small>' % (ic('check', 13, 3), 'Alındı' if k == 'pass' else 'Bilet alındı', code, E(ac.get('paid', '')) if ac else '')
            doc = ('<button type="button" class="q-open full">%s %s aç</button>' % (ic('clip', 14, 2.2), E(ac['doc']))) if ac.get('doc') else '<button type="button" class="q-doc add full">%s Bileti ekle</button>' % ic('clip', 13, 2.2)
            note = ac['when'].split(' · ', 1)[-1] if ac else ''
            sd = side(top, doc, '<small class="z-note">%s</small>' % E(note))
        cls = ' bk' if f == 'bk' else ''
        live = LIVE.get(o['id'], '') if f == 'bk' else ''
        return w % ('<div class="z-f z-tk%s">%s%s%s%s%s</div>' % (cls, info_btn(), main, sd, det, live))
    if k == 'ev':
        pic = '<img alt="" src="illus/etkinlik-tur.png"><button type="button" class="q-rm" aria-label="Plandan çıkar" title="Plandan çıkar">%s</button>' % ic('x', 12, 2.6)
        if f == 'sel':
            return w % kcard('q-card q-plan', '', pic, brand_chip(o), E(o['name']), '%s · %s kişi başı' % (o['date'], o['price']),
                             '<span class="q-act"><button type="button" class="q-got sm">✓ Aldım</button>%s</span>' % cta(it, o, 'q-cta sm'))
        a = ACC.get(o['id'], {})
        acc = ('<span class="q-acc"><span class="q-aw">%s %s</span><span class="q-aw">%s %s</span></span>' % (ic('cal', 12, 2), E(a['when']), ic('pin', 12, 2), E(a['where']))) if a else '<span class="q-acc"><span class="q-aw">%s</span></span>' % o['date']
        code = ('<span class="q-code">%s<button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>' % (E(a['code'][1]), ic('copy', 11, 2.2))) if a else ''
        doc = ('<button type="button" class="q-open">%s Bileti aç</button>' % ic('clip', 13, 2.2)) if a.get('doc') else '<button type="button" class="q-doc add">%s Bileti ekle</button>' % ic('clip', 12, 2.2)
        pic = '<img alt="" src="illus/etkinlik-tur.png"><span class="q-vband">%s Bilet alındı</span>%s' % (ic('check', 12, 3), info_btn())
        return w % kcard('q-card q-plan done', '', pic, brand_chip(o), E(o['name']), acc, '<span class="q-act">%s%s</span>' % (code, doc), det)
    if k == 'todo':
        pic = '<img alt="" src="%s"><button type="button" class="q-rm" aria-label="Plandan çıkar" title="Plandan çıkar">%s</button>' % (img(o['img']), ic('x', 12, 2.6))
        if o.get('res'):
            r = o['res']
            pic = '<img alt="" src="%s"><span class="q-vband">%s Rezervasyon</span>' % (img(o['img']), ic('check', 12, 3))
            return w % kcard('q-tile q-plan done', '', pic, '<span class="z-tagc">%s</span>' % o['tag'], E(o['name']),
                             '<span class="q-acc"><span class="q-aw">%s %s</span></span>' % (ic('cal', 12, 2), E(r['when'])),
                             '<span class="q-act"><span class="q-code">%s<button type="button" class="q-cp" aria-label="Kopyala">%s</button></span><button type="button" class="q-open">%s Aç</button></span>' % (E(r['code']), ic('copy', 11, 2.2), ic('clip', 13, 2.2)))
        if o.get('tag') == 'Not':
            return w % kcard('q-tile q-plan note', '', '<img alt="" src="illus/not.png">', '<span class="z-tagc">Not</span>', E(o['name']), E(o['sub']),
                             '<button type="button" class="q-day">Düzenle</button>')
        return w % kcard('q-tile q-plan', '', pic, '<span class="z-tagc">%s</span>' % o['tag'], E(o['name']), E(o['sub']),
                         '<span class="z-okc">%s Planda</span><button type="button" class="q-day">Gün ver ›</button>' % ic('check', 12, 3))


def arr_frame(it):
    # Ayarlandı (kullanıcı halletti) ya da Dahil (bir pass ya da paket kapsıyor): bilet ailesi, karar yok
    a = it['arr']
    inc = a.get('st') == 'inc'
    if a.get('family') == 'stay':
        # konaklama ailesi: çadır kampı festival biletine dahil (D2)
        sd = side('<span class="z-inc">%s Dahil</span><small class="z-note">%s</small>' % (ic('check', 13, 3), E(a['by'])), '<button type="button" class="q-doc add full z-goinc" data-goto="%s">%s ›</button>' % (a['goto'], E(a['bybtn'])), a.get('row', ''))
        card = zcard(a['media'], '<span class="z-inc">%s Dahil</span><span class="z-dim">· %s</span>' % (ic('check', 13, 3), E(a['by'])), E(a['t']), E(a['l2']), ''.join('<span class="z-chip">%s</span>' % E(c) for c in a.get('chips', [])), sd, '', ' inc')
        return '<div class="q-arr" data-st="inc" data-img="%s" data-nm="%s" data-sub="%s">%s</div>' % (a.get('thumb', ''), E(a['name']), E(a['sub']), card)
    main = ('<div class="z-tm"><div class="z-car"><span class="z-lgi" aria-hidden="true"><img alt="" src="%s"></span><span><b>%s</b> <small>%s</small></span></div>'
            '<div class="q-route z-route"><span class="q-tm big q-city"><b>%s</b><small>%s</small></span><span class="q-mid big"><small>%s</small><i><img alt="" src="%s"></i><small class="ok">%s</small></span>'
            '<span class="q-tm big q-city r"><b>%s</b><small>%s</small></span></div><span class="z-l3">%s</span></div>') % (
        img(a['img']), E(a['car']), E(a['cars']), E(a['ca']), a['sa'], E(a['m1']), img(a['img']), E(a['m2']), E(a['cb']), a['sb'], ''.join('<span class="z-chip">%s</span>' % E(c) for c in a.get('chips', [])))
    if inc:
        sd = side('<span class="z-inc">%s Dahil</span><small class="z-note">%s</small>' % (ic('check', 13, 3), E(a['by'])), '<button type="button" class="q-doc add full z-goinc" data-goto="%s">%s ›</button>' % (a['goto'], E(a['bybtn'])), '<a class="q-alk" href="#" onclick="return false">Saatler ↗</a>')
    else:
        sd = side('<span class="z-gr">%s Ayarlandı</span><small class="z-note">Sen hallettin</small>' % ic('check', 13, 3), '<button type="button" class="q-doc add full">Fiyat ekle</button>', '<button type="button" class="q-chg">Değiştir</button>')
    return '<div class="q-arr" data-st="%s" data-img="%s" data-nm="%s" data-sub="%s"><div class="z-f z-tk ar%s">%s%s</div></div>' % ('inc' if inc else 'arr', img(a['img']), E(a['name']), E(a['sub']), ' inc' if inc else '', main, sd)


def empty_frame(it):
    h = HINTS.get(it['id']) if not it.get('nohint') else None
    nm = it['name'] if isinstance(it['name'], str) else '%s → %s' % it['name']
    title = it.get('etitle') or (h[0] if h else '%s için seçenek bekleniyor' % nm)
    est = '<span class="q-est">tahmini %s</span>' % E(it['est']) if it.get('est') else ''
    if it.get('enote'):
        est += '<span class="z-dim"> · %s</span>' % E(it['enote'])
    l3 = ''.join('<a class="z-rg" href="#" onclick="return false" data-tip="%s · %s\'da ara">%s <small>%s</small></a>' % (E(w_), E(it['links'][0][0]), E(n), E(p.replace(' / gece', '').replace('~', ''))) for n, w_, p in (h[1] if h else []))
    media = '<div class="z-ph0"><img alt="" src="%s"><span class="z-srch">%s</span></div>' % (img(it['img']), ic('search', 18, 2.2))
    pv = ''.join('<a class="z-pi" href="#" onclick="return false" data-tip="%s\'da ara" aria-label="%s\'da ara">%s</a>' % (E(n), E(n), logo(n)) for n, _, _ in it['links'])
    sd = side('<small class="z-lbl">Kendin ara</small><span class="z-pis">%s</span>' % pv, '<button type="button" class="q-ai full">%s AI\'dan öner</button>' % ic('spark', 15, 2), '<small class="z-aierr">AI şu an yanıt vermiyor · <button type="button" class="z-retry">Tekrar dene</button></small>')
    return '<div class="q-empty">%s</div>' % zcard(media, '<span class="z-dim">Henüz seçenek yok</span>', E(title), est, l3, sd, '', ' em')


# ---- niyet ----
def head(it, mixed):
    nm = it['name']
    nmh = ('<h4 class="q-nm" title="%s → %s">%s <i>→</i> %s</h4>' % (nm[0], nm[1], nm[0], nm[1])) if isinstance(nm, tuple) else '<h4 class="q-nm" title="%s">%s</h4>' % (nm, nm)
    ln = (('<span class="z-kind">%s</span>' % it['word']) if mixed else '') + ''.join('<span>%s%s</span>' % (ic(icf(v), 14, 2), v) for v in vals_of(it))
    tg = ''.join('<i class="%s">%s%s</i>' % (k, '<s></s>' if k == 'req' else '', t) for t, k in it['wants'])
    menu = ('<div class="z-menu"><button type="button" class="q-ib z-mb" aria-label="Diğer" aria-expanded="false">%s</button><div class="z-mpop" hidden>'
            '<button type="button" class="z-mi" data-m="det">Ayrıntı</button><button type="button" class="z-mi q-x2">Gerek yok</button></div></div>') % SV['dots']
    return ('<div class="q-head np z-h"><div class="q-art">%s</div><div class="q-hd">%s<div class="q-ln">%s%s</div></div>'
            '<div class="q-hr"><span class="q-st"></span><button type="button" class="q-pano">%s<span>Pano</span><b class="q-pn">%d</b></button>%s</div></div>') % (
        it.get('art') or '<img alt="" src="%s">' % img(it['img']), nmh, ln, ('<span class="q-tg">%s</span>' % tg) if tg else '', ic('board', 14, 2), len(it['opts']), menu)


def intent(it, mixed):
    k = it['kind']
    multi = bool(it.get('multi'))
    os_ = sorted(it['opts'], key=lambda o: -o.get('best', 0))
    listcls = {'fly': 'q-rows z-rows', 'rail': 'q-rows z-rows', 'pass': 'q-rows z-rows', 'stay': 'q-cards z-ocs', 'esim': 'q-cards z-ocs', 'ev': 'q-cards z-ks', 'todo': 'q-tiles z-ks'}.get(k, 'q-rows')
    more = '<button type="button" class="z-k z-more q-pano" hidden></button>' if multi else ''
    opts = ('<div class="q-opts"><div class="q-oh"><b class="q-ot">%s</b><small class="q-oc"></small><span class="q-sp"></span>%s<button type="button" class="q-cancel" hidden>Vazgeç</button></div>'
            '<div class="%s">%s%s%s</div></div>') % ('Öneriler' if multi else 'Seçenekler', provs(it), listcls, FIRST.get(it['id'], ''), ''.join(opt_html(it, o) for o in os_), more) if os_ else ''
    forms = ''
    for o in os_:
        forms += form(it, o, 'sel')
        if k != 'todo':
            forms += form(it, o, 'bk')
        if o.get('best') and not multi:
            forms += form(it, o, 'ai')
    if multi:
        ph = '<div class="z-k z-k0"><b>Henüz plana koymadın</b><small>Önerilerden “+ Plana koy” ile ekle</small></div>' + '<div class="z-k z-k0 sl" aria-hidden="true">%s</div>' % ic('plus', 18, 2) * 3
        plan = '<div class="q-planw"><div class="q-oh"><b>Planında</b><small class="q-ppn"></small></div><div class="q-prow z-ks">%s%s</div></div>' % (forms, ph)
    else:
        plan = '<div class="q-selbox">%s</div>' % forms
    arr = arr_frame(it) if it.get('arr') else ''
    empty = empty_frame(it) if not os_ and not it.get('arr') else ''
    best = [o['id'] for o in os_ if o.get('best')]
    init = dict(mode=it['state'], sel=it.get('sel', ''), picked=it.get('picked', []), booked=it.get('booked', []), best=best[0] if best else '')
    skip = '<div class="q-skipl" hidden><span>Gerek yok dedin.</span><button type="button" class="q-undo">Geri al</button></div>'
    return ('<section class="q-int z-int%s" id="int-%s" data-kind="%s" data-mode="%s" data-sel="%s" data-picked="%s" data-booked="%s" data-init=\'%s\' style="--k:%s">%s%s<div class="q-body">%s%s%s%s%s</div></section>') % (
        ' multi' if multi else '', it['id'], k, it['state'], it.get('sel', ''), ','.join(it.get('picked', [])), ','.join(it.get('booked', [])), json.dumps(init), CC, head(it, mixed), skip, arr, plan, opts, empty, EXTRA.get(it['id'], ''))


CC = '#888'


def section(cat):
    global CC
    CC = cat['c']
    pano_cat(cat)
    mixed = cat['key'] in MIXED
    ints = ''.join(intent(it, mixed) for it in cat['intents'])
    v = cat.get('visa')
    if isinstance(v, dict):
        visa = ('<p class="q-visa z-visa need">%s<b>%s</b><span>%s</span><span class="q-sp"></span><a class="q-alk" href="#" onclick="return false">Resmî kaynak ↗</a><button type="button" class="q-got">✓ Vize alındı</button></p>' % (ic('x', 14, 3) if False else '<i class="z-vx">!</i>', E(v['t']), E(v['s'])))
    else:
        visa = '<p class="q-visa z-visa">%s<b>Vize gerekmiyor</b><span>Türk pasaportuyla 90 güne kadar</span></p>' % ic('check', 14, 3) if v else ''
    inf = globals().get('CATINFO', {}).get(cat['key'])
    if inf:
        visa = ('<p class="q-tinfo" data-sig="%s"><i>i</i><span>%s</span></p>' % (inf[0], E(inf[1]))) + visa
    bud = ('<span class="q-bud"><b class="q-spent"></b><small>%s ayrıldı</small></span>' % cat['allot']) if cat['allot'] else '<span class="q-bud"><b class="q-spent"></b><small>&nbsp;</small></span>'
    return ('<section class="q-sec" id="cat-%s" style="--c:%s"><button type="button" class="q-row1" aria-expanded="false">'
            '<span class="q-ic" aria-hidden="true">%s</span><span class="q-tt"><b>%s</b><small class="q-kw">%s<span class="q-ideas"></span></small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk"></i><i class="ch"></i></span><small class="q-pl1"></small></span>%s<span class="q-chev" aria-hidden="true">%s</span></button>'
            '<div class="q-fold"><div class="q-ints">%s%s</div><button type="button" class="q-add">%s %s ekle</button></div></section>') % (
        cat['key'], cat['c'], SV['ic_' + cat['key']], cat['name'], cat.get('kw') or kw(cat), bud, ic('chev', 18, 2.2), visa, ints, ic('plus', 14, 2.4),
        {'flight': 'Uçuş', 'stay': 'Konaklama', 'transport': 'Ulaşım', 'activity': 'Etkinlik', 'todo': 'Yer', 'other': 'Belge'}[cat['key']])


def prep_section():
    done = sum(1 for p in PREP if p[3])
    rows = ''.join('<li class="q-pr1%s"><button type="button" class="q-ck" role="checkbox" aria-checked="%s" aria-label="%s">%s</button><span class="q-pt1"><b>%s</b><small>%s</small></span>%s<span class="q-pdone">Hazır</span><button type="button" class="q-ib q-pdel" aria-label="Sil">%s</button></li>' % (
        ' done' if d else '', 'true' if d else 'false', E(t), ic('check', 11, 3.2), E(t), E(w),
        ('<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\'da al ↗</a>' if s_ == 'amazon' else
         '<a class="q-buy1 ty" href="#" onclick="return false"><span class="q-ty" aria-hidden="true">t</span>Trendyol\'da al ↗</a>' if s_ == 'trendyol' else
         '<a class="q-buy1 hb" href="#" onclick="return false"><span class="q-hb" aria-hidden="true">h</span>Hepsiburada\'da al ↗</a>' if s_ == 'hepsiburada' else
         '<a class="q-buy1" href="#" onclick="return false">Resmî site ↗</a>' if s_ == 'site' else ''), SV['x']) for t, w, s_, d in PREP)
    return ('<section class="q-sec q-prep" id="cat-prep" style="--c:#475467"><button type="button" class="q-row1" aria-expanded="false"><span class="q-ic" aria-hidden="true">%s</span><span class="q-tt"><b>Hazırlık</b><small class="q-kw">Gezi öncesi %d iş</small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk" style="width:%d%%"></i></span><small class="q-pl1 q-pcount">%d/%d hazır</small></span><span class="q-bud"><b class="q-spent"></b><small>&nbsp;</small></span><span class="q-chev" aria-hidden="true">%s</span></button>'
            '<div class="q-fold"><div class="q-ph1"><span class="q-pc2">%d/%d hazır</span><span class="q-sp"></span><button type="button" class="q-phide">Hazırları gizle</button><button type="button" class="q-ai sm">%s Daha fazla öner</button></div><ul class="q-prows">%s</ul></div></section>') % (
        ic('list', 20, 2), len(PREP), round(done * 100 / len(PREP)), done, len(PREP), ic('chev', 18, 2.2), done, len(PREP), ic('spark', 14, 2), rows)



ILL_BG = {'etkinlik-tur': '#ffffff', 'motosiklet': '#fefeff', 'minibus': '#ffffff', 'ev-daire': '#fefefe', 'taksi-transfer': '#ffffff', 'not': '#fdfdfd', 'ucus': '#ffffff', 'otel': '#ffffff', 'vapur': '#fefefe', 'sigorta': '#fefffe', 'restoran': '#ffffff', 'bisiklet': '#ffffff', 'yapilacak': '#fefefd', 'arac-kiralama': '#ffffff', 'karavan': '#fefdfc', 'esim': '#fffefc', 'tren': '#fefefc', 'otobus': '#ffffff'}


def bgfix(page):
    def rep(m):
        cls, name = m.group(1), m.group(2)
        return '<div class="%s" style="background:%s"><img alt="" src="illus/%s.png"' % (cls, ILL_BG.get(name, '#f5f4f8'), name)
    return re.sub(r'<div class="(z-m|z-op|z-kp)"><img alt="" src="illus/([a-z-]+)\.png"', rep, page)



