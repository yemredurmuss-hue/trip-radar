import json,re,os,sys,html,shutil
SP=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,SP)
from data71 import *
DIST='/home/user/trip-radar/dist/'
OUT=SP+'/v71'
SV=json.load(open('/tmp/live_svgs.json'))
P={'moon':'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z','cal':'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4','users':'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
 'plane':'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
 'check':'M5 12.5l4.5 4.5L19 7','search':'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5','link':'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1','ext':'M7 17 17 7M8 7h9v9','spark':'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'}
def ic(n,sz=15,sw=2): return '<svg class="i" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>'%(sz,sz,sw,P[n])
E=html.escape
def icf(t):
    if '→' in t: return 'plane'
    if 'gece' in t or 'gün' in t: return 'moon'
    if 'kişi' in t: return 'users'
    return 'cal'
SRC={'ai':('ai','✨ AI önerisi'),'link':('link','Senin linkin'),'sabine':('who','Sabine ekledi'),'emre':('who','Emre ekledi')}
def srcbadge(o):
    k,t=SRC[o['src']]
    if o.get('best'): k,t='best','✨ Önerimiz'
    lead={'link':ic('link',12,2.4),'who':'<i>%s</i>'%t[0]}.get(k,'')
    return '<span class="ly-srcb %s">%s%s</span>'%(k,lead,t if k!='who' else t)
def brandnm(o): return o['brand'][0] if 'brand' in o else o.get('alname','')
def cta(o): return CTA.get(brandnm(o),'Rezerve et')
def srclink(o): return '<a class="ly-srcl" href="#" onclick="return false" title="Kaynak sayfayı aç">%s ↗</a>'%E(brandnm(o))
def img(n): return 'illus/%s.png'%n
def oattrs(it,o,extra=''):
    nm=o.get('name') or (o.get('alname','')+' '+o.get('no','')) or o.get('line','')
    if it['kind']=='rail': nm=o['line']
    pr=o.get('price','')
    unit=o.get('unit','') if it['kind'] in('stay','esim') else ('kişi başı' if pr else '')
    im=o.get('img') or it['img']
    bc=o['brand'][1] if 'brand' in o else {'TK':'#c8102e','JL':'#cc0000','QR':'#5c0632','PC':'#e8a400'}.get(o.get('al'),'#6a4fe0')
    if 'al' in o: extra+=' data-tx="%s"'%o['al']
    num=int(pr.replace('€','').replace('.','')) if pr else 0
    nights=int(it['vals'][0].split()[0]) if it['kind']=='stay' and 'gece' in it['vals'][0] else 0
    tot=num*nights if nights else num*2
    extra+=' data-tot="%d"'%tot
    return 'data-o="%s" data-src="%s" data-im="%s" data-bc="%s" data-nm="%s" data-pr="%s" data-un="%s"%s'%(o['id'],o['src'],im,bc,E(nm),pr,unit,extra)
X=SV['x'];DOTS=SV['dots'];OKT=SV['okt']
def endtools(lab=''):
    return '<span class="pk-end"><button class="tipx inf ly-inf" type="button" aria-label="Ayrıntı" aria-expanded="false"><i aria-hidden="true">i</i></button>%s<button type="button" class="pk-x" title="Gerek yok">%s</button><span class="pk-menu-wrap"><button type="button" class="pk-ib" aria-label="Kart menüsü">%s</button></span></span>'%(lab,X,DOTS)
def more(rows): return '<div class="ly-more" hidden>%s</div>'%''.join('<span>%s</span>'%r for r in rows if r)
# ---------- option tiles ----------
def tile(it,o):
    k=it['kind']; acts='<span class="ly-act">%s<button type="button" class="ly-pick">Seç</button></span>'%srclink(o)
    if k in('stay','esim'):
        rb=('<span class="pk-rb">%s</span>'%o['rate']) if o.get('rate') else ''
        return ('<article class="pk-card ly-opt" %s style="--mc:%s">%s<div class="pk-body"><div class="pk-media pk-stay"><div class="pk-vis"><img class="pk-illus" alt="" src="%s"></div>'
          '<div class="pk-txt"><div class="pk-srcrow"><span class="brand" style="--bc:%s">%s</span>%s</div><h3 title="%s">%s</h3><div class="ly-sub">%s</div></div></div></div>'
          '<div class="pk-foot"><span class="pk-price"><span class="pk-price2"><b>%s</b><small> %s</small></span></span>%s</div></article>')%(oattrs(it,o),CC,srcbadge(o),img(o['img']),o['brand'][1],E(o['brand'][0]),rb,E(o['name']),E(o['name']),E(o['sub']),o['price'],o['unit'],acts)
    if k=='fly':
        st='direct' if o['stops']=='direkt' else 'stop'
        return ('<article class="pk-card ly-opt ly-fly" %s style="--mc:%s">%s<div class="pk-top"><span class="tk-head"><span class="tk-logo"><span class="tk-ph" aria-hidden="true">%s</span></span><span class="tk-hn"><b>%s <span class="tk-no num">%s</span></b><span class="tk-when num">%s</span></span></span></div>'
          '<div class="pk-body"><div class="pk-mid"><div class="pk-stop"><b>%s</b><span><strong>%s</strong></span></div><div class="pk-route"><img class="tk-plane" alt="" src="illus/ucus.png"><small class="%s">%s · %s</small></div><div class="pk-stop r"><b>%s</b><span><strong>%s</strong>%s</span></div></div></div>'
          '<div class="pk-foot"><span class="pk-price"><span class="pk-price3"><span><b>%s</b> kişi başı</span><small>%s</small></span></span>%s</div></article>')%(oattrs(it,o),CC,srcbadge(o),SV['plane'],o['alname'],o['no'],o['date'],o['fc'],o['ft'],st,o['dur'],o['stops'],o['tc'],o['tt'],'<sup class="pk-plus">+1</sup>' if o['plus'] else '',o['price'],o['total'],acts)
    if k=='rail':
        return ('<article class="pk-card ly-opt pk-rd-card" %s style="--mc:%s">%s<div class="pk-body"><div class="pk-rd"><div class="pk-rd-w"><span class="pk-rd-how"><span class="brand" style="--bc:%s">%s</span><span>%s</span></span></div>'
          '<div class="pk-rd-r"><span class="pk-rd-c"><b class="pk-rd-h">%s</b><small>%s</small></span><span class="pk-rd-mid"><span class="pk-rd-line" aria-hidden="true"><i></i>%s<i></i></span></span><span class="pk-rd-c r"><b class="pk-rd-h">%s</b><small>%s</small></span></div></div></div>'
          '<div class="pk-foot"><span class="pk-price"><span class="pk-price3"><span><b>%s</b> kişi başı</span><small>%s</small></span></span>%s</div></article>')%(oattrs(it,o),CC,srcbadge(o),o['brand'][1],o['brand'][0],o['line'],o['dep'],o['df'],SV['rdarrow'],o['arr'],o['dt'],o['price'],o['total'],acts)
    if k=='ev':
        return ('<div class="ev-card idea ly-opt" %s><span class="ev-img"><img class="ev-art" alt="" src="illus/etkinlik-tur.png">%s</span><span class="ev-body"><b class="ev-n" title="%s">%s</b><span class="ev-s"><span class="brand" style="--bc:%s">%s</span><span>%s</span></span>'
          '<span class="ev-f"><span class="ev-p"><span><b>%s</b> kişi başı</span><small>%s</small></span><span class="ly-act">%s<button type="button" class="ev-put ly-pick">+ Plana koy</button></span></span></span></div>')%(oattrs(it,o),srcbadge(o),E(o['name']),E(o['name']),o['brand'][1],E(o['brand'][0]),o['date'],o['price'],o['total'],srclink(o))
    if k=='todo':
        return ('<div class="it-tile ly-opt" %s><div class="it-pic"><img class="it-illus" alt="" src="%s"><span class="it-kindtag">%s</span>%s<button type="button" class="it-put corner ly-pick" title="Plana koy">+</button></div><b class="it-t">%s</b><span class="it-m">Tokyo · %s</span><a class="ly-srcl it-map" href="#" onclick="return false">Haritada aç ↗</a></div>')%(oattrs(it,o),img(o['img']),o['tag'],srcbadge(o),E(o['name']),E(o['sub']))
# ---------- chosen / booked forms ----------
def chg(n): return '<button type="button" class="pk-alt ly-chg">Değiştir<span class="pk-alt-n">%d</span></button>'%n
def form(it,o,f):
    k=it['kind']; n=max(len(it['opts'])-1,0); kind_svg=SV['kind_stay'] if k in('stay','esim') else SV['ic_transport']
    wrap='<div class="ly-form" data-o="%s" data-f="%s" hidden>%%s</div>'%(o['id'],f)
    if k in('stay','esim'):
        kindl={'stay':it['word'],'esim':'eSIM'}[k] if k=='esim' else it['word']
        rb=('<span class="pk-rb">%s</span>'%o['rate']) if o.get('rate') else ''
        meta='<div class="pk-meta">%s%s</div>'%(('<span class="star">★ %s</span>'%o['rate'].replace('★ ','')) if o.get('rate') else '',('<span>%s</span>'%o['rev']) if o.get('rev') else '')
        body=('<div class="pk-body"><div class="pk-media pk-stay"><div class="pk-vis"><img class="pk-illus" alt="" src="%s"></div><div class="pk-txt"><div class="pk-srcrow"><span class="brand" style="--bc:%s">%s</span>%s</div><h3>%s</h3>%s</div></div></div>')%(img(o['img']),o['brand'][1],E(o['brand'][0]),rb,E(o['name']),meta)
        mr=more([o['sub'],'<span class="cw ok">%s</span>'%o['cancel'] if 'iade yok' not in o['cancel'].lower() else '<span class="cw no">%s</span>'%o['cancel'],o['tot'],srclink(o)])
        if f=='sel':
            h=('<article class="pk-card pk-r-half" style="--mc:%s"><div class="pk-top"><span class="pk-ring half"></span><span class="pk-kind">%s%s</span>%s</div>%s%s<div class="pk-foot">%s<span class="pk-price"><span class="pk-price2"><b>%s</b><small> %s</small></span></span><button type="button" class="pk-aldim ly-got">✓ Aldım</button><a class="pk-cta pk-go" href="#" onclick="return false">%s ↗</a></div></article>')%(CC,kind_svg,kindl,endtools('<span class="pk-lab chosen">Seçildi</span>'),body,mr,chg(n),o['price'],o['unit'],cta(o))
        else:
            h=('<article class="pk-card pk-r-done pk-booked" style="--mc:%s"><div class="pk-top"><span class="pk-kind">%s%s</span>%s</div>%s%s<div class="pk-foot"><span class="pk-price"><span class="pk-price2"><b>%s</b><small> %s</small></span></span><button type="button" class="pk-docmiss">%sbelge yok</button><button type="button" class="pk-more ly-infb">Ayrıntı ›</button></div></article>')%(CC,kind_svg,kindl,endtools('<span class="okt"><i aria-hidden="true">%s</i>Rezerve</span>'%OKT),body,mr,o['price'],o['unit'],SV['docmiss'])
        return wrap%h
    if k=='fly':
        st='direct' if o['stops']=='direkt' else 'stop'
        top=('<div class="pk-top"><span class="tk-head"><span class="tk-logo"><span class="tk-ph" aria-hidden="true">%s</span></span><span class="tk-hn"><b>%s <span class="tk-no num">%s</span></b><span class="tk-when num">%s</span></span></span>%s</div>')%(SV['plane'],o['alname'],o['no'],o['date'],endtools())
        body=('<div class="pk-body"><div class="pk-mid"><div class="pk-stop"><b>%s</b><span>%s · <strong>%s</strong></span></div><div class="pk-route"><img class="tk-plane" alt="" src="illus/ucus.png"><small class="%s">%s · %s</small></div><div class="pk-stop r"><b>%s</b><span>%s · <strong>%s</strong>%s</span></div></div></div>')%(it['name'][0],o['fc'],o['ft'],st,o['dur'],o['stops'],it['name'][1],o['tc'],o['tt'],'<sup class="pk-plus">+1</sup>' if o['plus'] else '')
        if f=='sel':
            stub=('<div class="tk-stub"><span class="tk-lab">%sSeçildi</span><span class="tk-price"><b class="num each">%s</b><small class="num">kişi başı</small><small class="num">%s</small></span><a class="tk-buy" href="#" onclick="return false">%s ↗</a><button type="button" class="pk-aldim ly-got">✓ Aldım</button>%s</div>')%(SV['tkcheck'],o['price'],o['total'],cta(o),chg(n))
            h='<article class="pk-card pk-r-half tk tk-chosen" style="--mc:%s">%s%s%s%s</article>'%(CC,stub,top,body,more(['⏳ Uçuşa 165 gün · bilet alınmadı','Bagaj: 2 × 23 kg',srclink(o)]))
        else:
            stub=('<div class="tk-stub"><span class="tk-chk" aria-hidden="true">%s</span><span class="okt sm"><i aria-hidden="true">%s</i>Bilet alındı</span><span class="tk-price"><b class="num each">%s</b><small class="num">kişi başı</small><small class="num">%s</small></span></div>')%(SV['tkchk'],OKT,o['price'],o['total'])
            h='<article class="pk-card pk-r-done tk tk-booked pk-booked" style="--mc:%s">%s%s%s<div class="pk-foot"><button type="button" class="pk-docmiss">%sbelge yok</button><button type="button" class="pk-more ly-infb">Ayrıntı ›</button></div>%s</article>'%(CC,stub,top,body,SV['docmiss'],more(['PNR K7T2QX · 2 yolcu','Check-in 15 Nis 11:00’de açılır']))
        return wrap%h
    if k=='rail':
        body=('<div class="pk-body"><div class="pk-rd"><h3 class="pk-rd-ttl"><span class="pk-rd-end">%s</span><span class="pk-rd-arr" aria-hidden="true">→</span><span class="pk-rd-end">%s</span></h3><div class="pk-rd-w"><span class="pk-rd-when">%s%s · %s</span><span class="pk-rd-how"><span class="brand" style="--bc:%s">%s</span><span>%s</span></span></div>'
              '<div class="pk-rd-r"><span class="pk-rd-c"><b class="pk-rd-h">%s</b><small>%s</small></span><span class="pk-rd-mid"><span class="pk-rd-line" aria-hidden="true"><i></i>%s<i></i></span></span><span class="pk-rd-c r"><b class="pk-rd-h">%s</b><small>%s</small></span></div></div></div>')%(it['name'][0],it['name'][1],SV['cal'],o['date'],o['dep'],o['brand'][1],o['brand'][0],o['line'],o['dep'],o['df'],SV['rdarrow'],o['arr'],o['dt'])
        pr='<span class="pk-price"><span class="pk-price3"><span><b>%s</b> kişi başı</span><small>%s</small></span></span>'%(o['price'],o['total'])
        if f=='sel':
            h=('<article class="pk-card pk-r-half pk-rd-card" style="--mc:%s"><div class="pk-top"><span class="pk-ring half"></span><span class="pk-kind">Ulaşım</span>%s</div>%s%s<div class="pk-foot">%s%s<button type="button" class="pk-aldim ly-got">✓ Aldım</button><a class="pk-cta pk-go" href="#" onclick="return false">%s ↗</a></div></article>')%(CC,endtools('<span class="pk-lab chosen">Seçildi</span>'),body,more(['Rezervasyonlu koltuk · 2 kişi',srclink(o)]),chg(n),pr,cta(o))
        else:
            h=('<article class="pk-card pk-r-done pk-rd-card pk-booked" style="--mc:%s"><div class="pk-top"><span class="pk-kind">Ulaşım</span>%s</div>%s%s<div class="pk-foot">%s<button type="button" class="pk-docmiss">%sbelge yok</button><button type="button" class="pk-more ly-infb">Ayrıntı ›</button></div></article>')%(CC,endtools('<span class="okt"><i aria-hidden="true">%s</i>Bilet alındı</span>'%OKT),body,more(['Vagon 7 · koltuk 12A, 12B']),pr,SV['docmiss'])
        return wrap%h
    if k=='ev':
        if f=='sel':
            h=('<div class="ev-card chosen"><span class="ev-img"><img class="ev-art" alt="" src="illus/etkinlik-tur.png"><span class="ev-chosen">✓ Seçildi</span><span class="ev-tools"><button type="button" class="pk-x ly-rm" title="Plandan çıkar">%s</button></span></span><span class="ev-body"><b class="ev-n">%s</b><span class="ev-s"><span class="brand" style="--bc:%s">%s</span><span>%s</span></span>'
               '<span class="ev-f"><span class="ev-p"><span><b>%s</b> kişi başı</span><small>%s</small></span><a class="ev-go" href="#" onclick="return false">%s ↗</a></span><span class="ev-d"><button type="button" class="pk-aldim ly-got">✓ Aldım</button></span></span></div>')%(X,E(o['name']),o['brand'][1],E(o['brand'][0]),o['date'],o['price'],o['total'],cta(o))
        else:
            h=('<div class="ev-card booked"><span class="ev-img"><img class="ev-art" alt="" src="illus/etkinlik-tur.png"><span class="okt sm"><i aria-hidden="true">%s</i>Bilet alındı</span></span><span class="ev-body"><b class="ev-n">%s</b><span class="ev-s"><span class="brand" style="--bc:%s">%s</span><span>%s</span></span><span class="ev-f"><span class="ev-p"><span><b>%s</b> kişi başı</span><small>%s</small></span></span><span class="ev-d"><button type="button" class="pk-docmiss">%sbelge yok</button><span class="ev-sp"></span><button type="button" class="ev-detail">Ayrıntı ›</button></span></span></div>')%(OKT,E(o['name']),o['brand'][1],E(o['brand'][0]),o['date'],o['price'],o['total'],SV['docmiss'])
        return wrap%h
    if k=='todo':
        h=('<div class="it-tile planned"><div class="it-pic"><img class="it-illus" alt="" src="%s"><span class="it-kindtag">%s</span><button type="button" class="it-put corner on ly-rm" title="Planda · çıkarmak için bas">✓ Planda</button></div><b class="it-t">%s</b><span class="it-m">Tokyo · %s</span><div class="it-foot"><span class="it-day">Gün ver</span></div></div>')%(img(o['img']),o['tag'],E(o['name']),E(o['sub']))
        return wrap%h
# ---------- intent card (horizontal) ----------
def nname(n):
    if isinstance(n,tuple): return '<h4 class="nm" title="%s → %s"><span>%s</span> <i>→</i> <span>%s</span></h4>'%(n[0],n[1],n[0],n[1])
    return '<h4 class="nm" title="%s"><span>%s</span></h4>'%(n,n)
def niyet(it):
    ln='<div class="ln">'+''.join('<span>%s%s</span>'%(ic(icf(v)),v) for v in it['vals'])+'</div>'
    tg=''.join('<i class="%s">%s%s</i>'%(k,'<s></s>' if k=='req' else '',t) for t,k in it['wants'])
    tgh='<div class="tg">%s</div>'%tg if tg else ''
    lk=''.join('<a class="lyl" href="#" onclick="return false" title="%s ile kendin ara"><span class="bl" style="--bl:%s">%s</span>%s<span class="up">↗</span></a>'%(n,c,g,n) for n,c,g in it['links'])
    return ('<div class="ly-nw"><span class="lab">%s</span><div class="nc"><div class="art"><img src="%s" alt=""></div><div class="bd">%s%s%s</div>'
            '<div class="rt"><span class="ly-st"><span class="seal"></span><b class="ly-stt"></b></span><div class="ly-lk"><small>Kendin ara</small>%s</div></div></div></div>')%(it['word'],img(it['img']),nname(it['name']),ln,tgh,lk)
def empty(it):
    g=it.get('guide',('Ara',''))
    return ('<div class="ly-empty"><div class="ly-e-t"><b>Henüz seçenek yok</b><small>%s</small></div><div class="ly-e-a"><button type="button" class="ly-ai">%s AI\'dan öner</button><span class="ly-e-or">ya da yukarıdan kendin ara</span></div>%s<button type="button" class="ly-skip">Gerek yok</button></div>')%(g[1],ic('spark',15,2),drop())
def drop(): return '<form class="ly-drop"><span>%s</span><input type="url" placeholder="Bulduğun linki buraya yapıştır" aria-label="Link yapıştır"><button type="submit">Ekle</button></form>'%ic('link',14,2.2)
def opts_block(it):
    n=len(it['opts'])
    tiles=''.join(tile(it,o) for o in sorted(it['opts'],key=lambda o:-o.get('best',0)))
    multi=it.get('multi')
    title='Öneriler' if multi else 'Seçenekler'
    return ('<div class="ly-opts"><div class="ly-oh"><b class="ly-ot">%s</b><span class="ly-cnt"></span><div class="ly-flt" hidden><button type="button" class="on" data-f="*">Hepsi</button><button type="button" data-f="ai">AI</button><button type="button" data-f="link">Linklerim</button><button type="button" data-f="who">Ekleyenler</button></div><span class="ly-sp"></span><button type="button" class="ly-cancel" hidden>Vazgeç</button><a class="ly-pano" href="#" onclick="return false" title="Bu niyetin tüm seçeneklerini Pano\'da yan yana karşılaştır">Pano\'da karşılaştır ›</a></div>'
            '<div class="ly-grid">%s</div><div class="ly-of"><button type="button" class="ly-all"></button><span class="ly-sp"></span>%s<button type="button" class="ly-ai sm">%s Daha fazla öner</button></div></div>')%(title,tiles,drop(),ic('spark',14,2))
def intent(it):
    multi=it.get('multi')
    forms=''.join(form(it,o,'sel')+(form(it,o,'bk') if it['kind'] not in('todo',) else '') for o in it['opts'])
    attrs='data-mode="%s" data-sel="%s" data-picked="%s" data-booked="%s"'%(it['state'],it.get('sel',''),','.join(it.get('picked',[])),','.join(it.get('booked',[])))
    inner=('<div class="ly-plan"><div class="ly-ph"><b>Planında</b><span class="ly-pn"></span></div><div class="ly-prow">%s</div></div>'%forms) if multi else ('<div class="ly-cur" hidden><span>Şu an</span><b class="ly-curn"></b><span class="ly-curp"></span><button type="button" class="ly-cancel">Vazgeç</button></div><div class="ly-done" hidden><span class="ly-dk">%s</span><b class="ly-dn"></b><span class="ly-dp"></span><span class="ly-sp"></span><button type="button" class="ly-dopen">Aç ›</button></div><div class="ly-selbox">%s</div>'%(ic('check',13,3),forms))
    body=opts_block(it)+(empty(it) if not it['opts'] or it.get('guide') else '')
    return '<div class="ly-int%s%s" id="int-%s" data-kind="%s" %s data-init=\'%s\'>%s<div class="ly-body">%s%s</div></div>'%(' multi' if multi else '',' it-city' if it['kind']=='todo' else '',it['id'],it['kind'],attrs,json.dumps(dict(mode=it['state'],sel=it.get('sel',''),picked=it.get('picked',[]),booked=it.get('booked',[]))),niyet(it),inner,body)
def summary(cat):
    parts=[]
    for it in cat['intents']:
        n=it['name']; n=('%s → %s'%n) if isinstance(n,tuple) else n
        if cat['key']=='stay': n+=' '+it['vals'][0].split()[0]
        parts.append(n)
    return ' · '.join(parts)+(' gece' if cat['key']=='stay' else '')
def section(cat):
    global CC
    CC=cat['c']
    ints=''.join(intent(it) for it in cat['intents'])
    tabs=''.join('<button type="button" class="ly-tab" data-int="int-%s"><span class="d"></span>%s</button>'%(it['id'],(('%s → %s'%it['name']) if isinstance(it['name'],tuple) else it['name'])) for it in cat['intents'])
    visa='<p class="visa-row ok" data-visa="free"><span class="visa-ic" aria-hidden="true">%s</span><b>Vize gerekmiyor</b><span>· Türk pasaportuyla 90 güne kadar</span></p>'%OKT if cat.get('visa') else ''
    bud=('<span class="tipx cat-bud-tip" tabindex="0"><span class="cat-bud"><b class="cat-spent">%s</b><small class="cat-allot">%s ayrıldı</small></span></span>'%(BUD.get(cat['key'],''),cat['allot'])) if cat['allot'] else ''
    return ('<section class="cat-sec ly-sec" id="cat-%s" aria-label="%s" data-section="%s" style="--c:%s">'
     '<div class="cat-head"><button type="button" class="cat-title" aria-expanded="false"><span class="cat-ic" aria-hidden="true">%s</span><span class="cat-tt"><b>%s<i class="cat-n">%d</i></b><small class="cat-st ly-cst"></small></span></button>'
     '<span class="cat-end"><span class="ly-need" hidden></span><span class="cat-bar" aria-hidden="true"><span class="bk"></span><span class="ch"></span></span>%s<span class="cat-chev" aria-hidden="true">%s</span></span></div>'
     '<div class="ly-prev"><span class="ly-sum">%s</span><span class="ly-thumbs"></span></div>'
     '<div class="ly-fold"><div class="ly-tabs">%s</div>%s<div class="ly-ints">%s</div></div></section>')%(cat['key'],cat['name'],cat['key'],cat['c'],SV['ic_'+cat['key']],cat['name'],len(cat['intents']),bud,SV['chev'],summary(cat),tabs,visa,ints)
BUD={'flight':'€1.580','stay':'€1.539','transport':'€240','activity':'€180'}
CC='#888'
secs=''.join(section(c) for c in CATS)
# ---------- page shell from live body ----------
body=open('/tmp/live-body.html').read()
a=body.index('<div class="cat-sheet"'); 
def bal(s,start,tag):
    d=0
    for m in re.finditer(r'<(/?)'+tag+r'\b[^>]*?(/?)>',s[start:]):
        if m.group(2)=='/':continue
        d+= -1 if m.group(1) else 1
        if d==0:return start+m.end()
b=bal(body,a,'div')
body=body[:a]+'<div class="cat-sheet ly-sheet">'+secs+'</div>'+body[b:]
body=re.sub(r'<script[^>]*src="app.js"[^>]*></script>','',body)
for o,n in [('Durumlar (denetim)','Japonya turu'),('5 uçuş','2 uçuş'),('5 konaklama','4 konaklama'),('4 ulaşım','3 ulaşım'),('4 deneyim','3 deneyim'),('6 ihtiyaç karar bekliyor','7 ihtiyaç karar bekliyor'),('4 rezerve edilecek','3 rezerve edilecek')]:
    body=body.replace(o,n)
body=body.replace('src="https://klook.com/favicon.ico"','hidden')
ctrl=('<div class="ly-ctrl" role="region" aria-label="Prototip ayarları"><b>Prototip</b>'
 '<span class="g"><small>Durum</small><button type="button" data-scn="init" class="on">Plan ilerledi</button><button type="button" data-scn="fresh">Omurga yeni oluştu</button></span>'
 '<span class="g"><small>Açık kategori</small><button type="button" data-v="A" class="on">A · Akış</button><button type="button" data-v="B">B · Odak</button><button type="button" data-v="C">C · Sekme</button></span>'
 '<span class="g"><small>Değiştir</small><button type="button" data-d="1" class="on">1 · Yerinde</button><button type="button" data-d="2">2 · Takas</button><button type="button" data-d="3">3 · Çekmece</button></span></div>'
 '<aside class="ly-drawer" hidden aria-label="Tüm seçenekler"><div class="ly-dh"><div><small class="ly-dk2"></small><b class="ly-dt"></b></div><button type="button" class="ly-dx" aria-label="Kapat">%s</button></div><div class="ly-dflt"></div><div class="ly-dg"></div></aside><div class="ly-scrim" hidden></div>')%X
css=open(DIST+'app.css').read()+'\n'+open(SP+'/mk71.css').read()
js=open(SP+'/mk71.js').read()
page='<title>Katmanlı Plan</title><meta name="claude:viewport-fit-sides" content="cover"><style>'+css+'</style><div id="root" class="vA d1">'+body+'</div>'+ctrl+'<script>'+js+'</script>'
os.makedirs(OUT+'/illus',exist_ok=True)
for f in os.listdir(DIST+'illus'):
    if f.endswith('.png'): shutil.copy(DIST+'illus/'+f,OUT+'/illus/'+f)
open(OUT+'/artifact.html','w').write(page)
open(OUT+'/index.html','w').write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+page.replace('<title>','<title>',1)+'</head><body></body></html>' if False else '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+page+'</body></html>')
print('ok',len(page))
