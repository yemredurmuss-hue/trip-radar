# v83 üst özet: v82 mozaiği + gezi ⋯ menüsü (C1), fotoğraf künyesi (C7), B9 hazırlık sayısı (planda / alındı),
# olmayan bilginin hiç görünmediği "omurga yeni" hali (C19), gezi sırasında "Bugün" şeridi (D8) ve uçuş günü.
# Aynı yapı iki gezi için: cfg sözlüğü (Japonya, Ozora).
import html
E = html.escape

P = {'cal': 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
     'users': 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
     'wallet': 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13.5h.01',
     'arrow': 'M5 12h14M13 6l6 6-6 6',
     'pin': 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
     'yen': 'M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8',
     'eur': 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9',
     'plug': 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
     'clock': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
     'chat': 'M4 5h16v11H9l-5 4z',
     'sun': 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
     'check': 'M5 12.5l4.5 4.5L19 7',
     'alert': 'M12 3l9.5 17h-19zM12 10v4M12 17h.01',
     'chev': 'M6 9l6 6 6-6',
     'up': 'M6 15l6-6 6 6',
     'dots': 'M5 12h.01M12 12h.01M19 12h.01',
     'x': 'M6 6l12 12M18 6L6 18',
     'doc': 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6',
     'share': 'M12 4v11M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5',
     'pdf': 'M7 3h7l4 4v14H7zM14 3v4h4M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9',
     'map': 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13',
     'hist': 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2',
     'newchat': 'M4 5h16v11H9l-5 4zM12 8v5M9.5 10.5h5',
     'gear': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-2 3.4-1.8-.6a7 7 0 0 1-2.2 1.3L14.6 21h-4l-.4-2.4a7 7 0 0 1-2.2-1.3l-1.8.6-2-3.4 1.6-1a7 7 0 0 1 0-2.6l-1.6-1 2-3.4 1.8.6A7 7 0 0 1 10.2 5.4L10.6 3h4l.4 2.4a7 7 0 0 1 2.2 1.3l1.8-.6 2 3.4-1.6 1a7 7 0 0 1 0 2.6z',
     'link': 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
     'trash': 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
     'plane': 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'}


def ic(n, sz=16, sw=2):
    return '<svg class="i" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>' % (sz, sz, sw, P[n])


def tip(text):
    return ' data-tip="%s"' % E(text)


def chip(icon, label, tiptext=None, cls=''):
    t = tip(tiptext) if tiptext else ''
    tab = ' tabindex="0"' if tiptext else ''
    return '<span class="x-chip%s"%s%s>%s%s</span>' % (' ' + cls if cls else '', t, tab, ic(icon, 15, 2), E(label))


CREDIT = 'Fotoğraf: örnek görsel. Canlıda Google Haritalar fotoğrafı ve çekenin adı burada yazar.'


def pic(src_or_svg):
    return src_or_svg if src_or_svg.startswith('<svg') else '<img alt="" src="%s">' % src_or_svg


def credit():
    return '<button type="button" class="x-cr" aria-label="Fotoğraf künyesi"%s><i>i</i></button>' % tip(CREDIT)


def tiles_html(tiles, cls):
    return '<div class="x-tiles %s n%d">%s</div>' % (cls, len(tiles), ''.join(
        '<figure class="x-t">%s<figcaption><b>%s</b><small>%s</small></figcaption>%s</figure>' % (pic(s), E(n), E(c), credit()) for s, n, c in tiles))


TRIPMENU = [('doc', 'Belgeler', 'docs'), ('share', 'Paylaş', 'share'), ('pdf', 'Planı PDF indir', 'pdf'), ('map', 'Rotayı haritada gör', 'map'),
            ('hist', 'Geçmiş ve çöp kutusu', 'hist'), ('newchat', 'Yeni sohbet', 'chat'), ('link', 'Link ekle', 'link'), ('gear', 'Ayarlar', 'set')]


def hero(cfg):
    big = ('<figure class="x-big">%s<figcaption><h1>%s</h1><span>%s</span></figcaption>%s</figure>' % (pic(cfg['cover']), E(cfg['title']), E(cfg['cities']), credit() if not cfg['cover'].startswith('<svg') else ''))
    tm = ('<div class="x-tmenu"><button type="button" class="x-tmb" aria-label="Gezi menüsü" aria-expanded="false">%s</button><div class="x-pop x-tm-pop" hidden role="menu">%s<div class="x-sep"></div>'
          '<button type="button" class="x-tmi bad" role="menuitem" data-tm="del">%s Geziyi sil</button></div></div>') % (
        ic('dots', 20, 2.6), ''.join('<button type="button" class="x-tmi" role="menuitem" data-tm="%s">%s %s</button>' % (k, ic(i, 16, 1.9), E(t)) for i, t, k in TRIPMENU), ic('trash', 16, 1.9))
    place = tiles_html(cfg['tiles'], 'place') if cfg['tiles'] else ''
    city = tiles_html(cfg['city_tiles'], 'city') if cfg.get('city_tiles') else ''
    mos = '<div class="x-mos%s">%s%s%s%s</div>' % ('' if cfg['tiles'] else ' solo', big, place, city, tm)

    d = cfg['dates']
    s1 = ('<div class="x-seg x-s1"%s tabindex="0"><span class="x-ico">%s</span><span class="x-sv"><b><span class="f-full">%s</span><span class="f-fresh">%s</span></b><small>%s</small></span></div>'
          % (tip(cfg['days_tip']), ic('cal', 20, 1.8), E(d[0]), E(d[1]), E(d[2])))
    who = cfg['who']
    faces = ''.join('<button type="button" class="x-face%s" data-tip="%s · %s · %s">%s</button>' % (' me' if k == cfg['me'] else '', E(n + (' (sen)' if me else '')), E(a), E(w), k) for k, n, me, a, w in who)
    who_pop = ('<div class="x-pop x-who-pop" hidden role="dialog" aria-label="Kimler gidiyor"><b class="x-pt">Kimler gidiyor</b>'
               + ''.join('<div class="x-wl"><span class="x-face%s">%s</span><span><b>%s</b><small>%s · %s</small></span></div>' % (' me' if k == cfg['me'] else '', k, E(n + (' (sen)' if me else '')), E(a), E(w)) for k, n, me, a, w in who)
               + '<button type="button" class="x-invite">+ Arkadaşını davet et</button></div>')
    pr = cfg['prog']  # (planda %, alındı %, karar, ipucu, fresh metni)
    s2 = ('<div class="x-seg x-s2"><span class="x-ico">%s</span><span class="x-avs">%s</span><span class="x-s2b"><button type="button" class="x-sv x-whob" aria-expanded="false"><b>%s</b></button>'
          '<span class="x-prog" tabindex="0"%s><span class="x-bar"><i class="bk" style="width:%d%%"></i><i class="ch" style="width:%d%%"></i></span></span>'
          '<button type="button" class="x-ps f-full" data-tip="İlk karara git"><b>%%%d planda</b> · %%%d alındı</button><small class="x-ps f-fresh">%s</small></span>%s</div>'
          % (ic('users', 20, 1.8), faces, E(cfg['people']), tip(pr[3]), pr[1], pr[0] - pr[1], pr[0], pr[1], E(pr[4]), who_pop))
    segs = [s1, s2]
    if cfg.get('budget'):
        bg = cfg['budget']
        bud_pop = ('<div class="x-pop x-bud-pop" hidden role="dialog" aria-label="Bütçe"><b class="x-pt">Bütçe · %s</b>' % E(bg['total'])
                   + ''.join('<div class="x-bl %s"><span><i></i>%s</span><b>%s</b></div>' % (c, a, b) for c, a, b in bg['lines'])
                   + '<div class="x-sep"></div>' + ''.join('<div class="x-bl"><span>%s</span><b>%s</b></div>' % (a, b) for a, b in bg['cats'])
                   + '<p class="x-pn">%s</p></div>' % E(bg['note']))
        segs.append('<div class="x-seg x-s3 f-full"><span class="x-ico">%s</span><button type="button" class="x-sv x-budb" aria-expanded="false"><b>%s</b><small>/ %s bütçe</small></button>%s</div>'
                    % (ic('wallet', 20, 1.8), E(bg['est']), E(bg['total']), bud_pop))
    nx = '<button type="button" class="h-next x-next"><span class="f-full">%s</span><span class="f-fresh">%s</span> %s</button>' % (E(cfg['next'][0]), E(cfg['next'][1]), ic('arrow', 16, 2.2))
    strip = '<div class="x-strip">%s%s</div>' % ('<i class="x-dv"></i>'.join(segs), nx)

    chips = ''.join(chip(*c) for c in cfg['chips'])
    if cfg.get('prefs'):
        pf = cfg['prefs']
        pref_pop = ('<div class="x-pop x-pref-pop" hidden role="dialog" aria-label="Seni böyle anladım"><b class="x-pt">Seni böyle anladım</b><ul>'
                    + ''.join('<li><span><i class="x-tag">%s</i>%s <small>· %s</small></span><button type="button" class="x-rmv" aria-label="%s kaldır" title="Kaldır / yok say">%s</button></li>' % (E(s), E(t), E(dd), E(t), ic('x', 13, 2.4)) for s, t, dd in pf['list'])
                    + ('</ul><div class="x-ask"><p>%s <small>%s</small></p><button type="button" class="x-yes">Evet</button><button type="button" class="x-no">Hayır</button></div>' % (E(pf['ask'][0]), E(pf['ask'][1])) if pf.get('ask') else '</ul>')
                    + '<small class="x-edit">Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter.</small></div>')
        prefs = ('<div class="x-prefs f-full"><button type="button" class="x-prefb" aria-expanded="false"><span>Tercihler</span><b>%s</b>%s%s%s</button>%s</div>'
                 % (E(pf['short']), ('<em>+%d</em>' % (len(pf['list']) - 3)) if len(pf['list']) > 3 else '', '<i class="x-q" title="1 soru">1</i>' if pf.get('ask') else '', ic('chev', 14, 2.2), pref_pop))
    else:
        prefs = ''
    fold = '<button type="button" class="x-fold" aria-expanded="true" aria-label="Özeti küçült">%s<span>Özeti küçült</span></button>' % ic('up', 15, 2.4)
    row = '<div class="x-chips">%s</div><div class="x-prow">%s%s</div>' % (chips, prefs, fold)
    thumb = pic(cfg['thumb'])
    mini = ('<div class="h-mini" aria-hidden="true"><div class="h-thumb sm">%s</div><b>%s</b><small>%s</small><span class="h-sp"></span>'
            '<span class="h-bar"><i class="bk" style="width:%d%%"></i><i class="ch" style="width:%d%%"></i></span><small><b>%%%d planda</b> · %d karar</small>%s'
            '<button type="button" class="h-next sm" tabindex="-1">Sıradaki %s</button></div>') % (
        thumb, E(cfg['title']), E(cfg['mini']), pr[1], pr[0] - pr[1], pr[0], pr[2], ('<span class="h-mb">%s / %s</span>' % (E(cfg['budget']['est']), E(cfg['budget']['total']))) if cfg.get('budget') else '', ic('arrow', 14, 2.2))
    slim = ('<div class="x-slim" hidden>%s<b>%s</b><small>%s</small><span class="h-sp"></span>'
            '<button type="button" class="x-unfold" aria-expanded="false">Özeti aç %s</button></div>') % (thumb, E(cfg['title']), E(cfg['slim']), ic('chev', 14, 2.4))
    today = ''.join(today_html(t) for t in cfg.get('today', []))
    return mini + '<section class="h-hero x-hero" aria-label="Gezi özeti">%s%s%s%s%s</section>' % (mos, strip, row, slim, today)


def today_html(t):
    # gezi sırasında hero'nun yerine geçen şerit: bugünün saatleri, yarının ilk işi
    rows = ''
    for r in t['rows']:
        tm, kind, nm, sub, act, st = r
        rows += ('<li class="xt-r %s"><time>%s</time><span class="xt-k">%s</span><span class="xt-m"><b>%s</b><small>%s</small></span>%s</li>'
                 % (st, E(tm), E(kind), E(nm), sub, act))
    return ('<section class="x-today" data-today="%s" hidden aria-label="Bugün"><div class="xt-h"><div class="xt-d"><b>Bugün</b><small>%s</small></div>'
            '<span class="xt-w">%s</span><span class="h-sp"></span><button type="button" class="xt-go">Yolculuk sırasıyla %s</button></div>'
            '<ol class="xt-l">%s</ol><div class="xt-next">%s<b>%s</b><span>%s</span></div></section>') % (
        t['key'], E(t['date']), t['weather'], ic('arrow', 14, 2.2), rows, ic('clock', 15, 2), E(t['next'][0]), t['next'][1])
