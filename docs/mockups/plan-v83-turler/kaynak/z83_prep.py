
# ---- v83 · Hazırlık (Etsy kararları T3, T4 b, T6 a, T8 b) ----
# T3: gezi verisinden çıkan madde kendi gününü taşır, liste güne göre; günü olmayan altta, "tarih yok" yazılmaz.
# T4 b: kalan ödeme sohbette söylenince günlü madde olur; ayrı ödeme alanı yok.
# T6 a: Hazırlık içinde katlı tek "Bavul" satırı; AI bir kez hazırlar, sen şekillendirirsin (kaldır, ekle, her gezide götürdüklerin).
# T8 b: Hazırlık'ın başında ayrı "Bilmen gerekenler" kartı; bilinmeyen satır görünmez (C19).
PI = {'alert': 'M12 3l9.5 17h-19zM12 10v4M12 17h.01', 'cash': 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v.01M18 14v.01',
      'shoe': 'M3 16h18v3H3zM3 16V9l4 1 3 3 5 1 6 2', 'train': 'M6 3h12v12H6zM6 10h12M9 18l-2 3M15 18l2 3M9 13h.01M15 13h.01', 'flag': 'M5 21V4M5 4h11l-2 4 2 4H5',
      'bag': 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', 'card': 'M3 6h18v12H3zM3 10h18', 'hand': 'M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 14'}


def pic_(n, sz=16):
    return '<svg class="i" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>' % (sz, sz, PI[n])


def shop(s_):
    return {'amazon': '<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\'da al ↗</a>',
            'trendyol': '<a class="q-buy1 ty" href="#" onclick="return false"><span class="q-ty" aria-hidden="true">t</span>Trendyol\'da al ↗</a>',
            'hepsiburada': '<a class="q-buy1 hb" href="#" onclick="return false"><span class="q-hb" aria-hidden="true">h</span>Hepsiburada\'da al ↗</a>',
            'site': '<a class="q-buy1" href="#" onclick="return false">Resmî site ↗</a>'}.get(s_, '')


def bilmen_html(b):
    rows = ''.join('<div class="q-bm1"><span class="q-bmi">%s</span><span><b>%s</b><small>%s</small></span></div>' % (pic_(i), E(t), v) for i, t, v in b['rows'])
    return '<div class="q-bm"><div class="q-bmh"><b>Bilmen gerekenler</b><small>%s</small></div><div class="q-bmg">%s</div></div>' % (E(b['sub']), rows)


def bavul_html(bv):
    groups = ''
    tot = done = buy = 0
    for g, items in bv['groups']:
        lis = ''
        for nm, why, st, s_ in items:
            tot += 1
            done += st == 'ok'
            buy += st == 'buy'
            lis += ('<li class="q-bv1%s"><button type="button" class="q-ck q-bvck" role="checkbox" aria-checked="%s" aria-label="%s">%s</button><span class="q-pt1"><b>%s</b>%s</span>%s'
                    '<button type="button" class="q-bvx" aria-label="%s bana göre değil" title="Bana göre değil">%s</button></li>') % (
                ' done' if st == 'ok' else (' buy' if st == 'buy' else ''), 'true' if st == 'ok' else 'false', E(nm), ic('check', 11, 3.2), E(nm), ('<small>%s</small>' % E(why)) if why else '',
                shop(s_) if st == 'buy' else '', E(nm), ic('x', 12, 2.4))
        groups += '<div class="q-bvg"><b>%s</b><ul>%s</ul></div>' % (E(g), lis)
    qs = ''.join(('<span class="q-bvq done"><small>%s</small><b>%s</b></span>' % (E(q), E(a))) if a else
                 ('<span class="q-bvq"><small>%s</small>%s</span>' % (E(q), ''.join('<button type="button" class="q-bva">%s</button>' % E(o) for o in opts))) for q, a, opts in bv['ask'])
    mine = ''.join('<span class="q-bvm">%s</span>' % E(m) for m in bv['mine'])
    head = ('<summary class="q-bvs"><span class="q-bvic">%s</span><span class="q-pt1"><b>Bavul</b><small>%s</small></span><span class="q-bvn" data-tot="%d">%d/%d hazır · %d alınacak</span><span class="q-bvchev">%s</span></summary>') % (
        pic_('bag', 18), E(bv['sub']), tot, done, tot, buy, ic('chev', 16, 2.2))
    body = ('<div class="q-bvb"><div class="q-bvqs">%s</div><div class="q-bvgs">%s</div>'
            '<div class="q-bvf"><span class="q-bvml"><small>Her gezide götürdüklerin</small>%s<button type="button" class="q-bvadd">+ Ekle</button></span>'
            '<small class="q-bvnote">Bu liste sana göre: kaldırdığını bir daha önermem, eklediğin sonraki gezilerde de gelir.</small></div></div>') % (qs, groups, mine)
    return '<li class="q-bvli"><details class="q-bv">%s%s</details></li>' % (head, body)


def prep_section():
    P = PREP83
    items = sorted(P['items'], key=lambda x: (x['k'] is None, x['k'] or ''))
    done = sum(1 for p in items if p.get('done'))
    rows = ''
    for p in items:
        tag = ('<i class="q-ptag">%s</i>' % E(p['src'])) if p.get('src') else ''
        day = ('<span class="q-pday%s">%s</span>' % (' soon' if p.get('soon') else '', E(p['day']))) if p.get('day') else ''
        rows += ('<li class="q-pr1%s"%s><button type="button" class="q-ck" role="checkbox" aria-checked="%s" aria-label="%s">%s</button><span class="q-pt1"><b>%s</b><small>%s%s</small></span>%s%s'
                 '<span class="q-pdone">Hazır</span><button type="button" class="q-ib q-pdel" aria-label="Sil">%s</button></li>') % (
            ' done' if p.get('done') else '', (' data-day="%s"' % E(p['day'])) if p.get('day') else '', 'true' if p.get('done') else 'false', E(p['t']), ic('check', 11, 3.2),
            E(p['t']), E(p['w']), tag, day, shop(p.get('shop', '')), SV['x'])
    n = len(items)
    nx = next((p for p in items if not p.get('done') and p.get('day')), None)
    kw = 'Gezi öncesi %d iş%s' % (n, (' · sıradaki: %s, %s' % (nx['t'], nx['day'])) if nx else '')
    return ('<section class="q-sec q-prep" id="cat-prep" style="--c:#475467"><button type="button" class="q-row1" aria-expanded="false"><span class="q-ic" aria-hidden="true">%s</span><span class="q-tt"><b>Hazırlık</b><small class="q-kw">%s</small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk" style="width:%d%%"></i></span><small class="q-pl1 q-pcount">%d/%d hazır</small></span><span class="q-bud"><b class="q-spent"></b><small>&nbsp;</small></span><span class="q-chev" aria-hidden="true">%s</span></button>'
            '<div class="q-fold">%s<div class="q-ph1"><span class="q-pc2">%d/%d hazır</span><small>güne göre sıralı</small><span class="q-sp"></span><button type="button" class="q-phide">Hazırları gizle</button><button type="button" class="q-ai sm">%s Daha fazla öner</button></div><ul class="q-prows">%s%s</ul></div></section>') % (
        ic('list', 20, 2), E(kw), round(done * 100 / n), done, n, ic('chev', 18, 2.2), bilmen_html(P['bilmen']), done, n, ic('spark', 14, 2), rows, bavul_html(P['bavul']))
