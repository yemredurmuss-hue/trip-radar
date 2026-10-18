# v82 üst özet: referanstaki mozaik (fotoğraflar Emre'nin referans görselinden kesildi; canlıda Places API).
# Bilgi şeridi 4 bölme (tarih | kişiler + hazırlık | bütçe | Sıradaki); altında çipler ve Tercihler.
# Yayındaki hero'nun üzerine gelince/tıklayınca açılan bilgileri korunur: hava (şehir şehir), kur, priz uyumu,
# saat farkı, vize, kişilerin son hareketi, bütçe dağılımı, "Seni böyle anladım" tercih listesi.
import html
E = html.escape

P = {'cal': 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
     'users': 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
     'wallet': 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13.5h.01',
     'arrow': 'M5 12h14M13 6l6 6-6 6',
     'pin': 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
     'yen': 'M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8',
     'plug': 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
     'clock': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
     'chat': 'M4 5h16v11H9l-5 4z',
     'sun': 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
     'check': 'M5 12.5l4.5 4.5L19 7',
     'chev': 'M6 9l6 6 6-6',
     'up': 'M6 15l6-6 6 6',
     'x': 'M6 6l12 12M18 6L6 18'}


def ic(n, sz=16, sw=2):
    return '<svg class="i" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>' % (sz, sz, sw, P[n])


TILES = [('shibuya', 'Shibuya Sky', 'Tokyo'), ('inari', 'Fushimi Inari', 'Kyoto'), ('ramen', 'Ichiran Ramen', 'Tokyo'),
         ('onsen', 'Gora Kadan onsen', 'Hakone'), ('dotonbori', 'Dotonbori', 'Osaka'), ('arashiyama', 'Arashiyama', 'Kyoto')]

# örnek değerler (canlıda: hava = son 10 yıl ortalaması ya da tahmin, kur = günlük)
WEATHER = [('Tokyo', '2–5 Nis', 19, 10, 8), ('Kyoto', '5–9 Nis', 18, 8, 9), ('Hakone', '9–12 Nis', 14, 6, 11), ('Osaka', '12–16 Nis', 19, 10, 8)]
PREFS = [('Tüm gezi', 'Bütçe: ekonomik', 'söylediğin'),
         ('Konaklama', 'Merkeze yakın', 'söylediğin'),
         ('Tüm gezi', 'Yerel yemek', 'seçimlerinden'),
         ('Uçuş', 'Direkt uçuş şart', 'söylediğin'),
         ('Kyoto', 'Geleneksel konaklama', 'söylediğin')]
WHO = [('E', 'Emre', 'sen', "Hyatt Centric Ginza'yı seçti", '1 sa önce'),
       ('S', 'Sabine', '', "Gora Kadan'ı rezerve etti", 'dün')]


def tip(text):
    return ' data-tip="%s"' % E(text)


def chip(icon, label, tiptext=None, cls=''):
    t = tip(tiptext) if tiptext else ''
    tab = ' tabindex="0"' if tiptext else ''
    return '<span class="x-chip%s"%s%s>%s%s</span>' % (' ' + cls if cls else '', t, tab, ic(icon, 15, 2), E(label))


def hero():
    big = ('<figure class="x-big"><img alt="Fuji Dağı ve kiraz çiçekleri" src="photos/fuji.jpg">'
           '<figcaption><h1>Japonya turu</h1><span>Tokyo · Kyoto · Hakone · Osaka</span></figcaption></figure>')
    tiles = ''.join('<figure class="x-t"><img alt="" src="photos/%s.jpg"><figcaption><b>%s</b><small>%s</small></figcaption></figure>' % (f, E(n), E(c)) for f, n, c in TILES)
    mos = '<div class="x-mos">%s<div class="x-tiles">%s</div></div>' % (big, tiles)

    days = ' · '.join('%s %s' % (c, d) for c, d, *_ in WEATHER)
    s1 = ('<div class="x-seg x-s1"%s tabindex="0"><span class="x-ico">%s</span><span class="x-sv"><b>1–16 Nisan</b><small>16 gün · 178 gün kaldı</small></span></div>'
          % (tip(days), ic('cal', 20, 1.8)))
    faces = ''.join('<button type="button" class="x-face%s" data-tip="%s · %s · %s">%s</button>' % (' me' if k == 'E' else '', E(n + (' (sen)' if me else '')), E(a), E(w), k) for k, n, me, a, w in WHO)
    who_pop = ('<div class="x-pop x-who-pop" hidden role="dialog" aria-label="Kimler gidiyor"><b class="x-pt">Kimler gidiyor</b>'
               + ''.join('<div class="x-wl"><span class="x-face%s">%s</span><span><b>%s</b><small>%s · %s</small></span></div>' % (' me' if k == 'E' else '', k, E(n + (' (sen)' if me else '')), E(a), E(w)) for k, n, me, a, w in WHO)
               + '<button type="button" class="x-invite">+ Arkadaşını davet et</button></div>')
    s2 = ('<div class="x-seg x-s2"><span class="x-ico">%s</span><span class="x-avs">%s</span><span class="x-s2b"><button type="button" class="x-sv x-whob" aria-expanded="false"><b>2 kişi</b></button>'
          '<span class="x-prog" tabindex="0"%s><span class="x-bar"><i class="bk" style="width:31%%"></i><i class="ch" style="width:19%%"></i></span></span><small class="x-ps"><b>%%50 hazır</b> · 7 karar</small></span>%s</div>'
          % (ic('users', 20, 1.8), faces, tip('3 alındı · 2 seçildi · 7 karar bekliyor'), who_pop))
    bud_pop = ('<div class="x-pop x-bud-pop" hidden role="dialog" aria-label="Bütçe"><b class="x-pt">Bütçe · €8.000</b>'
               '<div class="x-bl bk"><span><i></i>Rezerve</span><b>€2.690</b></div>'
               '<div class="x-bl pl"><span><i></i>Planlanan</span><b>€849</b></div>'
               '<div class="x-bl fr"><span><i></i>Boşta</span><b>€4.461</b></div>'
               '<div class="x-sep"></div>'
               + ''.join('<div class="x-bl"><span>%s</span><b>%s</b></div>' % (a, b) for a, b in [('Uçuş', '€1.580'), ('Konaklama', '€1.539'), ('Ulaşım', '€240'), ('Etkinlik', '€180')])
               + '<p class="x-pn">Karar bekleyenler seçilince yaklaşık €3.360 daha eklenir (Osaka oteli ve sigorta tahmini dahil). Tahmini toplam ~€6.900, bütçeye sığar · €1.100 pay.</p></div>')
    s3 = ('<div class="x-seg x-s3"><span class="x-ico">%s</span><button type="button" class="x-sv x-budb" aria-expanded="false"><b>~€6.900</b><small>/ €8.000 bütçe</small></button>%s</div>'
          % (ic('wallet', 20, 1.8), bud_pop))
    s4 = '<button type="button" class="h-next x-next">Sıradaki: Kyoto oteli %s</button>' % ic('arrow', 16, 2.2)
    strip = '<div class="x-strip">%s<i class="x-dv"></i>%s<i class="x-dv"></i>%s%s</div>' % (s1, s2, s3, s4)

    wtip = 'Nisan ortalaması · ' + ' · '.join('%s %d°/%d°, yağışlı gün %d/30' % (c, h, l, r) for c, _, h, l, r in WEATHER)
    chips = ''.join([
        chip('pin', 'Japonya', 'Tokyo, Kyoto, Hakone, Osaka · 4 şehir'),
        chip('sun', '6–19°', wtip),
        chip('yen', 'Yen', '1 € ≈ 162 ¥ · bugünkü kur'),
        chip('plug', 'A/B priz', 'Adaptör gerekir · Türkiye C/F kullanıyor'),
        chip('clock', '+6 saat', 'Sende 12:00 iken orada 18:00. Uçuş saatleri yerel saattir.'),
        chip('chat', 'Japonca'),
        chip('check', 'Vize gerekmiyor', 'Türk pasaportuyla 90 güne kadar vizesiz', 'ok'),
    ])
    pref_pop = ('<div class="x-pop x-pref-pop" hidden role="dialog" aria-label="Seni böyle anladım"><b class="x-pt">Seni böyle anladım</b><ul>'
                + ''.join('<li><span><i class="x-tag">%s</i>%s <small>· %s</small></span><button type="button" class="x-rmv" aria-label="%s kaldır" title="Kaldır / yok say">%s</button></li>' % (E(s), E(t), E(d), E(t), ic('x', 13, 2.4)) for s, t, d in PREFS)
                + '</ul><div class="x-ask"><p>Sabah erken trenler sorun değil mi? <small>Tokyo → Kyoto için sabah dedin</small></p><button type="button" class="x-yes">Evet</button><button type="button" class="x-no">Hayır</button></div>'
                '<small class="x-edit">Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter.</small></div>')
    prefs = ('<div class="x-prefs"><button type="button" class="x-prefb" aria-expanded="false"><span>Tercihler</span><b>Ekonomik · merkeze yakın · yerel yemek</b><em>+2</em><i class="x-q" title="1 soru">1</i>%s</button>%s</div>'
             % (ic('chev', 14, 2.2), pref_pop))
    fold = '<button type="button" class="x-fold" aria-expanded="true" aria-label="Özeti küçült">%s<span>Özeti küçült</span></button>' % ic('up', 15, 2.4)
    row = '<div class="x-chips">%s</div><div class="x-prow">%s%s</div>' % (chips, prefs, fold)
    mini = ('<div class="h-mini" aria-hidden="true"><div class="h-thumb sm"><img alt="" src="photos/fuji.jpg"></div><b>Japonya turu</b><small>1–16 Nis · 2 kişi</small><span class="h-sp"></span>'
            '<span class="h-bar"><i class="bk" style="width:31%"></i><i class="ch" style="width:19%"></i></span><small><b>%50 hazır</b> · 7 karar</small><span class="h-mb">~€6.900 / €8.000</span>'
            '<button type="button" class="h-next sm" tabindex="-1">Sıradaki ' + ic('arrow', 14, 2.2) + '</button></div>')
    slim = ('<div class="x-slim" hidden><img alt="" src="photos/fuji.jpg"><b>Japonya turu</b><small>1–16 Nisan · 2 kişi · %50 hazır · ~€6.900 / €8.000</small><span class="h-sp"></span>'
            '<button type="button" class="x-unfold" aria-expanded="false">Özeti aç ' + ic('chev', 14, 2.4) + '</button></div>')
    return mini + '<section class="h-hero x-hero" aria-label="Gezi özeti">%s%s%s%s</section>' % (mos, strip, row, slim)


if __name__ == '__main__':
    print(len(hero()))
