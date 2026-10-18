import json,re,os,sys,html,shutil
SP=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,SP)
from data71 import CATS
from data78x import LOGO,PC,TAG
from data79x import BAG,MATCH,LIKES,HINTS,DET,PREP
from data81x import SCORE,ACC,ILHAM,TRIP
from scenes import scene
DIST='/home/user/trip-radar/dist/'; OUT=SP+'/v81'
SV=json.load(open('/tmp/live_svgs.json'))
E=html.escape
P={'moon':'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z','cal':'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4','users':'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
 'check':'M5 12.5l4.5 4.5L19 7','search':'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5','spark':'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z','clip':'M21 11.5 12.4 20a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.5a1.7 1.7 0 0 1-2.3-2.3l7.9-7.8',
 'board':'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z','x':'M7 7l10 10M17 7 7 17','plus':'M12 5v14M5 12h14','link':'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1','plane':'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
 'chev':'M9 6l6 6-6 6','pin':'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z','play':'M8 5v14l11-7z','arr':'M5 12h14M13 6l6 6-6 6','bag':'M6 8h12v12H6zM9 8V5h6v3M10 12v4M14 12v4','heart':'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z','list':'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01','copy':'M8 8h11v11H8zM5 16V5h11'}
def ic(n,sz=15,sw=2): return '<svg class="i" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>'%(sz,sz,sw,P[n])
def icf(t): return 'plane' if '→' in t else 'moon' if ('gece' in t or 'gün' in t) else 'users' if 'kişi' in t else 'cal'
def img(n): return 'illus/%s.png'%n
def bname(o): return o['brand'][0] if 'brand' in o else o.get('alname','')
def logo(name,sz=''):
    c,g=LOGO.get(name,('#6b6f80',name[:1]))
    return '<span class="q-logo%s" style="--bl:%s" aria-hidden="true">%s</span>'%(sz,c,E(g))
def ctaword(it): return 'Rezerve et' if it['kind']=='stay' else 'Satın al'
def cta(it,o,cls='q-cta'):
    b=bname(o); return '<a class="%s" href="#" onclick="return false" title="%s sitesinde aç">%s<span>%s</span><span class="q-ext">↗</span></a>'%(cls,E(b),logo(b,' sm'),ctaword(it))
SRCW={'ai':'AI önerisi','link':'Senin linkin','sabine':'Sabine ekledi','emre':'Emre ekledi'}
def src(o):
    if o.get('best'): return '<span class="q-src best">✨ Önerimiz</span>'
    k=o['src']; cls='ai' if k=='ai' else 'mine'
    lead=ic('link',11,2.6) if k=='link' else ('<i>%s</i>'%('S' if k=='sabine' else 'E') if k in('sabine','emre') else '✨ ')
    return '<span class="q-src %s">%s%s</span>'%(cls,lead,SRCW[k])
def nights(it): 
    v=it['vals'][0]; return int(v.split()[0]) if 'gece' in v else 0
def num(p): return int(p.replace('€','').replace('.','')) if p else 0
def eur(n): return '€'+format(n,',').replace(',','.')
def total(it,o):
    n=nights(it); p=num(o.get('price',''))
    if it['kind']=='stay' and n: return n*p, '%d gece · %s'%(n,eur(n*p))
    return p*2, '2 kişi · %s'%eur(p*2)
def rating(o):
    r=o.get('rate','')
    if not r: return ''
    star=r.startswith('★'); v=r.replace('★ ','')
    word='Muhteşem' if not star and float(v.replace(',','.'))>=9 else ('Çok iyi' if not star else 'Misafirler sevmiş')
    return '<span class="q-rate"><b class="q-rb%s">%s</b><span>%s%s</span></span>'%(' star' if star else '',('★ ' if star else '')+v,word,(' · '+o['rev']) if o.get('rev') else '')
def ccls(c):
    c=c.replace('İ','i').replace('I','ı').lower(); return 'no' if 'iade yok' in c else 'warn' if ('kısmi' in c or 'önce' in c) else 'ok'
def mine(o): return o['src'] in('link','sabine','emre')
def odata(it,o):
    t,_=total(it,o); b=bname(o); c=LOGO.get(b,('#6b6f80',b[:1]))
    im=o.get('img') or it['img']
    th='<span class="q-th" style="--bc:%s">%s</span>'%(c[0],('<b>%s</b>'%c[1]) if it['kind']=='fly' else '<img alt="" src="%s">'%img(im))
    nm=o.get('name') or o.get('line') or (o.get('alname','')+' '+o.get('no',''))
    k=it['kind']
    if k=='fly': tm='%s %s · %s → %s%s · %s'%(o['alname'],o['no'],o['ft'],o['tt'],' +1' if o['plus'] else '',o['stops'])
    elif k=='rail': tm='%s · %s → %s · %s'%(o['line'],o['dep'],o['arr'],o['brand'][0])
    elif k in('stay','esim'): tm='%s · %s %s'%(b,o.get('price',''),o.get('unit',''))
    elif k=='ev': tm='%s · %s · %s kişi başı'%(b,o.get('date',''),o.get('price',''))
    else: tm=o.get('sub','')
    pr=o.get('price','')
    return 'data-o="%s" data-mine="%d" data-tot="%d" data-nm="%s" data-th="%s" data-tm="%s" data-pr="%s" data-sc="%s" data-bn="%s" data-bc="%s" data-bg="%s"'%(o['id'],1 if mine(o) else 0,t,E(nm),E(th),E(tm),E(pr),SCORE.get(o['id'],''),E(b),c[0],E(c[1]))
# ---------- option renderers (top 3 inline) ----------
def rib(o):
    tag=TAG.get(o['id'],'')
    bits=[]
    if o.get('best'): bits.append('<span class="q-rb1 best">✨ Önerimiz</span>')
    if tag: bits.append('<span class="q-rb1 tag">%s</span>'%tag)
    return '<span class="q-ribs">%s</span>'%''.join(bits) if bits else ''
def who(o):
    k=o['src']
    if k=='ai': return '<span class="q-who ai" title="AI önerisi">✨</span>'
    if k=='link': return '<span class="q-who link" title="Senin linkin">%s</span>'%ic('link',11,2.6)
    return '<span class="q-who p" title="%s">%s</span>'%(SRCW[k],'S' if k=='sabine' else 'E')
def opt_row_fly(it,o):
    st='ok' if o['stops']=='direkt' else 'warn'
    bag=BAG.get(o['id'],'')
    return ('<div class="q-row q-opt" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="%s">%s</small></span><span class="q-tm r"><b>%s%s</b><small>%s</small></span></span>'
      '<span class="q-buy"><span class="q-pr"><b>%s</b><small>%s</small></span><span class="q-bg">%s%s</span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>')%(odata(it,o),rib(o),logo(o['alname']),o['alname'],o['no'],o['ft'],o['fc'],o['dur'],st,o['stops'],o['tt'],'<sup>+1</sup>' if o['plus'] else '',o['tc'],o['price'],'kişi başı',ic('bag',12,2) if bag else '',bag,who(o))
def opt_row_rail(it,o):
    return ('<div class="q-row q-opt" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="ok">aktarmasız</small></span><span class="q-tm r"><b>%s</b><small>%s</small></span></span>'
      '<span class="q-buy"><span class="q-pr"><b>%s</b><small>kişi başı</small></span><span class="q-bg">%s</span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>')%(odata(it,o),rib(o),logo(o['brand'][0]),o['line'].replace('Shinkansen ',''),o['brand'][0]+(' · Shinkansen' if 'Shinkansen' in o['line'] else ''),o['dep'],o['df'],dur(o['dep'],o['arr']),o['arr'],o['dt'],o['price'],'Rezervasyonlu koltuk',who(o))
def dur(a,b):
    h1,m1=map(int,a.split(':'));h2,m2=map(int,b.split(':'));d=(h2*60+m2)-(h1*60+m1); return '%d sa %02d'%(d//60,d%60)
def opt_card_stay(it,o):
    t,tl=total(it,o); tag=TAG.get(o['id'],'')
    return ('<article class="q-card q-opt" %s><div class="q-ph"><img alt="" src="%s">%s%s</div><div class="q-cb"><span class="q-brand" style="--bl:%s">%s</span><h3>%s</h3><span class="q-sub">%s</span>%s'
      '<div class="q-cf"><span class="q-pr"><b>%s</b><small>%s · %s</small></span><button type="button" class="q-pick">Seç</button></div></div></article>')%(odata(it,o),img(o['img']),src(o),('<span class="q-tag on-ph">%s</span>'%tag) if tag else '',o['brand'][1],E(o['brand'][0]),E(o['name'].split(' · ',1)[1] if o['name'].startswith(o['brand'][0]+' · ') else o['name']),E(o['sub']),rating(o),o['price'],o['unit'],tl.split(' · ')[-1] if it['kind']=='stay' else tl)
def opt_card_ev(it,o):
    return ('<article class="q-card q-opt sm" %s><div class="q-ph"><img alt="" src="illus/etkinlik-tur.png">%s</div><div class="q-cb"><span class="q-brand" style="--bl:%s">%s</span><h3>%s</h3><span class="q-sub">%s</span>'
      '<div class="q-cf"><span class="q-pr"><b>%s</b><small>kişi başı</small></span><button type="button" class="q-pick ghost">+ Plana koy</button></div></div></article>')%(odata(it,o),src(o),o['brand'][1],E(o['brand'][0]),E(o['name']),o['date'],o['price'])
def opt_tile_todo(it,o):
    return ('<article class="q-tile q-opt" %s><div class="q-ph"><img alt="" src="%s"><span class="q-kt">%s</span><button type="button" class="q-pick q-plus" aria-label="%s: plana koy">%s</button></div><b>%s</b><small>%s</small>%s</article>')%(odata(it,o),img(o['img']),o['tag'],E(o['name']),ic('plus',16,2.6),E(o['name']),E(o['sub']),src(o))
def opt_html(it,o):
    k=it['kind']
    return {'fly':opt_row_fly,'rail':opt_row_rail,'stay':opt_card_stay,'esim':opt_card_stay,'ev':opt_card_ev,'todo':opt_tile_todo}[k](it,o)
# ---------- chosen forms ----------
def act_tools(): return '<span class="q-tools"><button type="button" class="q-ib q-inf" aria-label="Ayrıntı" title="Ayrıntı"><i>i</i></button><button type="button" class="q-ib q-x2" aria-label="Gerek yok" title="Gerek yok">%s</button><button type="button" class="q-ib" aria-label="Menü" title="Menü">%s</button></span>'%(SV['x'],SV['dots'])
def match_chips(it,o):
    m=MATCH.get(o['id'],{}); out=''
    for t,k in it['wants']:
        if t in m: out+='<span class="q-mc %s">%s %s</span>'%('y' if m[t] else 'n','✓' if m[t] else '✕',E(t))
    return out
def check_panel(it,o):
    pros,cons=PC.get(o['id'],([],[]))
    mc=match_chips(it,o)
    canc=o.get('cancel','')
    return ('<div class="q-det" hidden><div class="q-dc"><small>Niyetine uyuyor mu</small><div class="q-mcs">%s</div></div><div class="q-dc"><small>Artılar</small><ul class="q-pl p">%s</ul></div><div class="q-dc"><small>Eksiler</small><ul class="q-pl m">%s</ul></div>%s</div>')%(mc or '<span class="q-na">istek yok</span>',''.join('<li>%s</li>'%E(x) for x in pros) or '<li class="q-na">—</li>',''.join('<li>%s</li>'%E(x) for x in cons) or '<li class="q-na">—</li>',('<div class="q-dc"><small>İptal</small><span class="q-cw %s">%s</span></div>'%(ccls(canc),E(canc))) if canc else '')
def booked_panel(o,kindword):
    d=DET.get(o['id'])
    if not d: d=[('Rezervasyon',[('Onay','eklenmedi')]),('Belge',[(kindword,'eklenmedi')])]
    cols=''
    for t,rows in d:
        r=''
        for row in rows:
            k,v=row[0],row[1]; cp=len(row)>2
            if v=='' : r+='<a class="q-dl" href="#" onclick="return false">%s</a>'%E(k)
            elif v=='eklenmedi': r+='<span class="q-dr"><span>%s</span><button type="button" class="q-doc">%s Ekle</button></span>'%(E(k),ic('clip',12,2.2))
            else: r+='<span class="q-dr"><span>%s</span><b>%s%s</b></span>'%(E(k),E(v),(' <button type="button" class="q-cp" title="Kopyala" aria-label="%s kopyala">%s</button>'%(E(k),ic('copy',12,2.2))) if cp else '')
        cols+='<div class="q-dc"><small>%s</small>%s</div>'%(t,r)
    return '<div class="q-det" hidden>%s<div class="q-dfoot"><button type="button" class="q-dact">İptal ettim, değiştir</button><button type="button" class="q-dact">İptal ettim, kaldır</button><span class="q-sp"></span><button type="button" class="q-dact">Düzenle</button></div></div>'%cols
def access(o,kind):
    a=ACC.get(o['id'])
    if not a: return '',''
    doc=('<button type="button" class="q-open">%s %s aç</button>'%(ic('clip',14,2.2),E(a['doc']))) if a['doc'] else ('<button type="button" class="q-doc add">%s %s ekle</button>'%(ic('clip',13,2.2),{'fly':'E-bileti','rail':'Bileti','ev':'Bileti'}.get(kind,'Onayı')))
    links=''.join('<a class="q-alk" href="#" onclick="return false">%s ↗</a>'%E(l) for l in a['links'])
    code='<span class="q-code">%s <b>%s</b><button type="button" class="q-cp" aria-label="%s kopyala">%s</button></span>'%(E(a['code'][0]),E(a['code'][1]),E(a['code'][0]),ic('copy',12,2.2))
    info='<span class="q-aw">%s %s</span><span class="q-aw">%s %s</span>'%(ic('cal',13,2),E(a['when']),ic('pin',13,2),E(a['where']))
    return info+code, doc+links
def form(it,o,f):
    k=it['kind']; w='<div class="q-form" data-o="%s" data-f="%s" hidden>%%s</div>'%(o['id'],f)
    bw={'stay':'Onay','esim':'QR kod','fly':'E-bilet','rail':'Bilet','ev':'Bilet'}.get(k,'Belge')
    det=booked_panel(o,bw) if f=='bk' else check_panel(it,o)
    if k in('stay','esim'):
        t,tl=total(it,o)
        canc=o.get('cancel','')
        cw=('<span class="q-cw %s">%s</span>'%(ccls(canc),E(canc))) if canc else ''
        pr='<span class="q-pr big"><b>%s</b><small>%s · %s</small></span>'%(o['price'],o['unit'],tl.split(' · ')[-1])
        if f=='sel':
            acts='<div class="q-act"><button type="button" class="q-chg">Değiştir</button><span class="q-sp"></span>%s<button type="button" class="q-got">✓ Aldım</button>%s</div>'%(pr,cta(it,o))
        elif f=='ai':
            acts='<div class="q-act"><button type="button" class="q-chg">Değiştir</button><span class="q-sp"></span>%s<a class="q-srcl" href="#" onclick="return false">%s ↗</a><button type="button" class="q-pick q-take">Bunu seç</button></div>'%(pr,E(bname(o)))
        else:
            info,acts=access(o,k)
            nm=E(o['name'].split(' · ',1)[1] if o['name'].startswith(o['brand'][0]+' · ') else o['name'])
            v=('<div class="q-vch"><span class="q-vck">%s</span><div class="q-vth"><img alt="" src="%s"></div><div class="q-vb"><span class="q-vst">%s · %s</span><h3>%s</h3>%s</div>'
               '<div class="q-vr">%s<button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div></div>%s')%(ic('check',18,3),img(o['img']),'Rezerve edildi' if k=='stay' else 'Satın alındı',E(o['brand'][0]),nm,info or '<span class="q-aw">%s · %s</span>'%(E(it['vals'][1]),E(it['vals'][0])),acts or '<button type="button" class="q-doc add">%s Onayı ekle</button>'%ic('clip',13,2.2),det)
            return w%v
        aib=''
        h=('<div class="q-media"><div class="q-ph"><img alt="" src="%s"></div><div class="q-mb"><div class="q-mt"><span class="q-brand" style="--bl:%s">%s</span>%s%s%s</div><h3>%s</h3><span class="q-sub">%s</span>%s%s</div></div>%s')%(img(o['img']),o['brand'][1],E(o['brand'][0]),rating(o),aib,act_tools(),E(o['name'].split(' · ',1)[1] if o['name'].startswith(o['brand'][0]+' · ') else o['name']),E(o['sub']),cw,acts,det)
        return w%h
    if k in('fly','rail'):
        if k=='fly':
            carrier='%s<span><b>%s</b> <small>%s · %s</small></span>'%(logo(o['alname']),o['alname'],o['no'],o['date'])
            a=(it['name'][0],'%s · <strong>%s</strong>'%(o['fc'],o['ft'])); b=(it['name'][1],'%s · <strong>%s</strong>%s'%(o['tc'],o['tt'],'<sup>+1</sup>' if o['plus'] else '')); mid=(o['dur'],o['stops']); il='ucus'
        else:
            carrier='%s<span><b>%s</b> <small>%s · %s</small></span>'%(logo(o['brand'][0]),o['line'],o['brand'][0],o['date'])
            a=(it['name'][0],'%s · <strong>%s</strong>'%(o['df'],o['dep'])); b=(it['name'][1],'%s · <strong>%s</strong>'%(o['dt'],o['arr'])); mid=(dur(o['dep'],o['arr']),o.get('stops','aktarmasız')); il='tren'
        st='ok' if mid[1] in('direkt','aktarmasız') else 'warn'
        bag=BAG.get(o['id'],'')
        main=('<div class="q-tkm"><div class="q-car">%s%s</div><div class="q-route"><span class="q-tm big q-city"><b>%s</b><small>%s</small></span><span class="q-mid big"><small>%s</small><i><img alt="" src="illus/%s.png"></i><small class="%s">%s</small></span><span class="q-tm big q-city r"><b>%s</b><small>%s</small></span></div>%s</div>')%(carrier,act_tools(),a[0],a[1],mid[0],il,st,mid[1],b[0],b[1],('<span class="q-bg">%s%s</span>'%(ic('bag',12,2),bag)) if bag else '')
        pr='<span class="q-pr big"><b>%s</b><small>kişi başı · 2 kişi %s</small></span>'%(o['price'],eur(num(o['price'])*2))
        if f=='sel':
            stub='<div class="q-stub">%s%s<button type="button" class="q-got">✓ Aldım</button><button type="button" class="q-chg">Değiştir</button></div>'%(pr,cta(it,o,'q-cta full'))
        elif f=='ai':
            stub='<div class="q-stub ai"><span class="q-src best">✨ Önerimiz</span>%s<button type="button" class="q-pick q-take full">Bunu seç</button><button type="button" class="q-chg">Değiştir</button></div>'%pr
        else:
            ac=ACC.get(o['id'],{})
            cdh=('<span class="q-code st">%s <b>%s</b><button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>'%(E(ac['code'][0]),E(ac['code'][1]),ic('copy',12,2.2))) if ac else ''
            doc=('<button type="button" class="q-open full">%s %s aç</button>'%(ic('clip',14,2.2),E(ac['doc']))) if ac.get('doc') else '<button type="button" class="q-doc add">%s Bileti ekle</button>'%ic('clip',13,2.2)
            when=('<small class="q-sw2">%s</small>'%E(ac['when'].split(' · ',1)[-1])) if ac else ''
            stub='<div class="q-stub done"><span class="q-stamp">%s</span><span class="q-vst">Bilet alındı</span>%s%s%s<button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(ic('check',20,3),cdh,when,doc)
        return w%('<div class="q-tk">%s%s</div>%s'%(main,stub,det))
    if k=='ev':
        pr='<span class="q-pr"><b>%s</b><small>kişi başı · 2 kişi %s</small></span>'%(o['price'],eur(num(o['price'])*2))
        if f=='sel':
            acts='<div class="q-act"><button type="button" class="q-got sm">✓ Aldım</button>%s</div>'%cta(it,o,'q-cta sm')
        else:
            info,ac=access(o,'ev')
            acts='<div class="q-acc">%s</div><div class="q-act">%s<span class="q-sp"></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(info,ac)
            pr=''
        h=('<article class="q-card q-plan%s"><div class="q-ph"><img alt="" src="illus/etkinlik-tur.png">%s<button type="button" class="q-rm" aria-label="Plandan çıkar" title="Plandan çıkar">%s</button></div><div class="q-cb"><span class="q-brand" style="--bl:%s">%s</span><h3>%s</h3><span class="q-sub">%s</span>%s%s</div>%s</article>')%(' done' if f=='bk' else '',('<span class="q-vband">%s Bilet alındı</span>'%ic('check',13,3)) if f=='bk' else '',ic('x',12,2.6),o['brand'][1],E(o['brand'][0]),E(o['name']),o['date'],pr,acts,det if f=='bk' else '')
        return w%h
    if k=='todo':
        h=('<article class="q-tile q-plan"><div class="q-ph"><img alt="" src="%s"><span class="q-kt">%s</span><button type="button" class="q-rm on" aria-label="Plandan çıkar" title="Planda · çıkarmak için bas">%s</button></div><b>%s</b><small>%s</small><span class="q-day">Gün ver ›</span></article>')%(img(o['img']),o['tag'],ic('check',13,3),E(o['name']),E(o['sub']))
        return w%h
# ---------- Pano verisi ----------
PANO={'cats':[],'ilham':[]}
WHO={'ai':'AI','link':'Emre','sabine':'Sabine','emre':'Emre'}
def pano_opt(it,o):
    k=it['kind']; pros,cons=PC.get(o['id'],([],[])); t,tl=total(it,o)
    b=bname(o); c=LOGO.get(b,('#6b6f80',b[:1]))
    if k=='fly': sub='%s → %s · %s · %s'%(o['ft'],o['tt'],o['dur'],o['stops'])
    elif k=='rail': sub='%s → %s · %s'%(o['dep'],o['arr'],dur(o['dep'],o['arr']))
    else: sub=o.get('sub') or o.get('date','')
    nm=o.get('name') or (o.get('line') if k=='rail' else '%s %s'%(o.get('alname',''),o.get('no','')))
    im=('etkinlik-tur' if k=='ev' else (o.get('img') or it['img']))
    m=MATCH.get(o['id'],{})
    return dict(score=SCORE.get(o['id'],0),kind=k,id=o['id'],nm=nm,brand=b,bc=c[0],bg=c[1],img=im,logo=k in('fly','rail'),price=o.get('price',''),unit=(o.get('unit','') if k in('stay','esim') else 'kişi başı'),tot=tl,sub=sub,rate=o.get('rate',''),rev=o.get('rev',''),cancel=o.get('cancel',''),ccls=ccls(o.get('cancel','')) if o.get('cancel') else '',pros=pros,cons=cons,src=o['src'],who=WHO[o['src']],best=1 if o.get('best') else 0,likes=LIKES.get(o['id'],[]),match=[[t_,m[t_]] for t_,_ in it['wants'] if t_ in m],bag=BAG.get(o['id'],''),tag=TAG.get(o['id'],''))
def pano_cat(cat):
    PANO['cats'].append(dict(key=cat['key'],name=cat['name'],c=cat['c'],ints=[dict(id='int-'+it['id'],nm=(('%s → %s'%it['name']) if isinstance(it['name'],tuple) else it['name']),word=it['word'],vals=' · '.join(it['vals']),multi=1 if it.get('multi') else 0,kind=it['kind'],opts=[pano_opt(it,o) for o in sorted(it['opts'],key=lambda o:-o.get('best',0))]) for it in cat['intents'] if it['opts']]))
# ---------- intent ----------
def head(it):
    nm=it['name']
    nmh=('<h4 class="q-nm" title="%s → %s">%s <i>→</i> %s</h4>'%(nm[0],nm[1],nm[0],nm[1])) if isinstance(nm,tuple) else '<h4 class="q-nm" title="%s">%s</h4>'%(nm,nm)
    ln=''.join('<span>%s%s</span>'%(ic(icf(v),14,2),v) for v in it['vals'])
    if it.get('est'): ln+='<span class="q-est">tahmini %s</span>'%E(it['est'])
    tg=''.join('<i class="%s">%s%s</i>'%(k,'<s></s>' if k=='req' else '',t) for t,k in it['wants'])
    n=len(it['opts'])
    plate=('<span class="q-plate">%s</span>'%it['word']) if it['word'] not in(CATN,) else ''
    return ('<div class="q-head%s">%s<div class="q-art"><img alt="" src="%s"></div><div class="q-hd">%s<div class="q-ln">%s%s</div></div>'
      '<div class="q-hr"><span class="q-st"></span><button type="button" class="q-pano">%s<span>Pano</span><b class="q-pn">%d</b></button></div></div>')%(' np' if not plate else '',plate,img(it['img']),nmh,ln,('<span class="q-tg">%s</span>'%tg) if tg else '',ic('board',14,2),n)
def selfsearch(it):
    return '<div class="q-self"><small>Kendin ara</small>%s<span class="q-sp"></span><small class="q-hint">Sohbete attığın linkler buraya düşer</small></div>'%''.join('<a class="q-sl" href="#" onclick="return false">%s%s<span class="q-ext">↗</span></a>'%(logo(n,' sm'),n) for n,_,_ in it['links'])
def empty_html(it):
    h=HINTS.get(it['id'])
    if not h: return ('<div class="q-empty"><div><b>Henüz seçenek yok</b><small>AI arıyor ya da kendin arayabilirsin</small></div><button type="button" class="q-ai">%s AI\'dan öner</button></div>')%ic('spark',15,2)
    t,rows=h; lk=it['links'][0][0]
    cards=''.join('<div class="q-hint1"><b>%s</b><span>%s</span><small>%s</small><a class="q-hl" href="#" onclick="return false">%s%s\'da ara ↗</a></div>'%(E(n),E(w),E(p),logo(lk,' sm'),{'Booking.com':'Booking.com','Google':'Google'}.get(lk,lk)) for n,w,p in rows)
    return ('<div class="q-empty rich"><div class="q-eh"><div><b>%s</b><small>Henüz seçenek yok. AI arayabilir ya da şu bölgelerden birine bakabilirsin.</small></div><button type="button" class="q-ai">%s AI\'dan öner</button></div><div class="q-hints">%s</div></div>')%(E(t),ic('spark',15,2),cards)
def intent(it):
    k=it['kind']; multi=bool(it.get('multi'))
    os_=sorted(it['opts'],key=lambda o:-o.get('best',0))
    listcls={'fly':'q-rows','rail':'q-rows','stay':'q-cards','esim':'q-cards','ev':'q-cards ev','todo':'q-tiles','ride':'q-rows'}[k]
    opts=('<div class="q-opts"><div class="q-oh"><b class="q-ot">%s</b><small class="q-oc"></small><span class="q-sp"></span><button type="button" class="q-cancel" hidden>Vazgeç</button></div><div class="%s">%s</div></div>')%('Öneriler' if multi else 'Seçenekler',listcls,''.join(opt_html(it,o) for o in os_)) if os_ else ''
    forms=''
    for o in os_:
        forms+=form(it,o,'sel')
        if k!='todo': forms+=form(it,o,'bk')
        if o.get('best') and not multi: forms+=form(it,o,'ai')
    plan=('<div class="q-planw"><div class="q-oh"><b>Planında</b><small class="q-ppn"></small></div><div class="q-prow %s">%s</div></div>'%('q-tiles' if k=='todo' else 'q-cards ev',forms)) if multi else '<div class="q-selbox">%s</div>'%forms
    arr=''
    if it.get('arr'):
        a=it['arr']
        arr='<div class="q-arr"><img alt="" src="%s"><div><span class="q-stl gr">Sen hallettin</span><b>%s</b><small>%s</small></div><span class="q-sp"></span><button type="button" class="q-doc">Fiyat ekle</button><button type="button" class="q-chg">Değiştir</button></div>'%(img(a['img']),E(a['name']),E(a['sub']))
    empty=empty_html(it) if not os_ and not it.get('arr') else ''
    best=[o['id'] for o in os_ if o.get('best')]
    init=dict(mode=it['state'],sel=it.get('sel',''),picked=it.get('picked',[]),booked=it.get('booked',[]),best=best[0] if best else '')
    skip='<div class="q-skipl" hidden><span>Gerek yok dedin.</span><button type="button" class="q-undo">Geri al</button></div>'
    return ('<section class="q-int%s" id="int-%s" data-kind="%s" data-mode="%s" data-sel="%s" data-picked="%s" data-booked="%s" data-init=\'%s\' style="--k:%s">%s%s<div class="q-body">%s%s%s%s%s</div></section>')%(
      ' multi' if multi else '',it['id'],k,it['state'],it.get('sel',''),','.join(it.get('picked',[])),','.join(it.get('booked',[])),json.dumps(init),CC,head(it),skip,arr,plan,opts,empty,selfsearch(it))
SUMM={'flight':'gidiş ve dönüş','stay':None,'transport':None,'activity':None,'todo':None,'other':None}
def kw(cat):
    k=cat['key']; ints=[i for i in cat['intents']]; n=len(ints)
    if k=='flight': return '%d uçuş · gidiş ve dönüş'%n
    if k=='stay':
        g=sum(int(i['vals'][0].split()[0]) for i in ints if 'gece' in i['vals'][0]); return '%d şehir · %d gece'%(n,g)
    if k=='transport': return '%d yolculuk · tren ve transfer'%n
    if k=='activity': return '%d şehir için'%n
    if k=='todo': return 'Gezilecek yerler ve restoranlar'
    if k=='other': return 'Vize gerekmiyor · eSIM ve sigorta'
    return ''
def kw_old(cat):
    xs=[]
    for it in cat['intents']:
        n=it['name']; xs.append(('%s → %s'%n) if isinstance(n,tuple) else n)
    if cat.get('visa'): xs.append('vize yok')
    show=xs[:3]; extra=len(xs)-3
    return ' · '.join(E(x) for x in show)+(' <span class="q-kwm">+%d</span>'%extra if extra>0 else '')
CC='#888'
CATN=''
def section(cat):
    global CC,CATN; CC=cat['c']; CATN=cat['name']
    pano_cat(cat)
    ints=''.join(intent(it) for it in cat['intents'])
    visa='<p class="q-visa">%s<b>Vize gerekmiyor</b><span>Türk pasaportuyla 90 güne kadar</span></p>'%ic('check',14,3) if cat.get('visa') else ''
    bud=('<span class="q-bud"><b class="q-spent"></b><small>%s ayrıldı</small></span>'%cat['allot']) if cat['allot'] else '<span class="q-bud"><b class="q-spent"></b><small>&nbsp;</small></span>'
    return ('<section class="q-sec" id="cat-%s" style="--c:%s"><button type="button" class="q-row1" aria-expanded="false">'
      '<span class="q-ic" aria-hidden="true">%s</span><span class="q-tt"><b>%s</b><small class="q-kw">%s<span class="q-ideas"></span></small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk"></i><i class="ch"></i></span><small class="q-pl1"></small></span>%s<span class="q-chev" aria-hidden="true">%s</span></button>'
      '<div class="q-fold">%s<div class="q-ints">%s</div><button type="button" class="q-add">%s %s ekle</button></div></section>')%(cat['key'],cat['c'],SV['ic_'+cat['key']],cat['name'],kw(cat),bud,ic('chev',18,2.2),visa,ints,ic('plus',14,2.4),{'flight':'Uçuş','stay':'Konaklama','transport':'Ulaşım','activity':'Etkinlik','todo':'Yer','other':'Belge'}[cat['key']])
# veri ekleri: Osaka tahmini, sigorta tahmini, ayarlanmış transfer
for c in CATS:
    for it in c['intents']:
        if it['id']=='s4': it['est']='€90–160 / gece'; it.pop('guide',None)
        if it['id']=='s2': it['state']='ai'; it['sel']='s2a'
        if it['id']=='d2': it['est']='€25–45'; it.pop('guide',None)
PANO['ilham']=[dict(x,svg=scene(x['scene'])) for x in ILHAM]
for c in CATS:
    if c['key']=='transport' and not any(i['id']=='r0' for i in c['intents']):
        c['intents'].insert(0,dict(id='r0',kind='ride',word='Transfer',img='taksi-transfer',name=('Havalimanı','Otel'),vals=['2 Nis','2 kişi'],wants=[],links=[('Rome2rio','#f5503d','r')],state='arr',opts=[],arr=dict(img='taksi-transfer',name='Otelin servisi · HND → Hyatt Centric Ginza',sub='Otel ayarladı, 19:45 çıkış kapısında')))
def trip_html():
    CH={'city-tokyo':'skyline','city-kyoto':'torii','city-hakone':'onsen','city-osaka':'lantern'}
    out=''
    for title,sub,key,steps in TRIP:
        hdr=('<div class="q-chap-h city"><div class="q-chap-img">%s</div><div class="q-chap-t"><b>%s</b><small>%s</small><span class="q-chap-sum"></span></div></div>'%(scene(CH[key]),title,sub)) if key in CH else ('<div class="q-chap-h"><span class="q-chap-ic">%s</span><div><b>%s</b><small>%s</small></div></div>'%(ic('plane',16,2) if key=='ucus' else ic('list',16,2),title,sub))
        rows=''.join('<div class="q-step" data-t="%s" data-int="int-%s" data-o="%s"><span class="q-sdate">%s</span><span class="q-sdot"></span><div class="q-sbody"></div></div>'%(t,i,o,E(d)) if t!='prep' else '<div class="q-step" data-t="prep"><span class="q-sdate"></span><span class="q-sdot"></span><div class="q-sbody"></div></div>' for d,t,i,o in steps)
        out+='<section class="q-chap">%s<div class="q-steps">%s</div></section>'%(hdr,rows)
    return out
def prep_section():
    done=sum(1 for p in PREP if p[3])
    rows=''.join('<li class="q-pr1%s"><button type="button" class="q-ck" role="checkbox" aria-checked="%s" aria-label="%s">%s</button><span class="q-pt1"><b>%s</b><small>%s</small></span>%s<span class="q-pdone">Hazır</span><button type="button" class="q-ib q-pdel" aria-label="Sil">%s</button></li>'%(
        ' done' if d else '','true' if d else 'false',E(t),ic('check',11,3.2),E(t),E(w),('<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\'da al ↗</a>' if src=='amazon' else '<a class="q-buy1 ty" href="#" onclick="return false"><span class="q-ty" aria-hidden="true">t</span>Trendyol\'da al ↗</a>' if src=='trendyol' else '<a class="q-buy1" href="#" onclick="return false">Resmî site ↗</a>' if src=='site' else ''),SV['x']) for t,w,src,d in PREP)
    return ('<section class="q-sec q-prep" id="cat-prep" style="--c:#475467"><button type="button" class="q-row1" aria-expanded="false"><span class="q-ic" aria-hidden="true">%s</span><span class="q-tt"><b>Hazırlık</b><small class="q-kw">Gezi öncesi 6 iş · hava durumuna göre</small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk" style="width:%d%%"></i></span><small class="q-pl1 q-pcount">%d/%d hazır</small></span><span class="q-bud"><b class="q-spent"></b><small>&nbsp;</small></span><span class="q-chev" aria-hidden="true">%s</span></button>'
      '<div class="q-fold"><div class="q-ph1"><span class="q-pc2">%d/%d hazır</span><small>Gezine ve hava durumuna göre önerildi; sohbette “şunu da ekle” diyebilirsin.</small><span class="q-sp"></span><button type="button" class="q-phide">Hazırları gizle</button><button type="button" class="q-ai sm">%s Daha fazla öner</button></div><ul class="q-prows">%s</ul></div></section>')%(ic('list',20,2),round(done*100/len(PREP)),done,len(PREP),ic('chev',18,2.2),done,len(PREP),ic('spark',14,2),rows)
LOGO['Amazon']=('#111111','a')
secs=''.join(section(c) for c in CATS)+prep_section()
body=open('/tmp/live-body.html').read()
def bal(s,start,tag):
    d=0
    for m in re.finditer(r'<(/?)'+tag+r'\b[^>]*?(/?)>',s[start:]):
        if m.group(2)=='/':continue
        d+= -1 if m.group(1) else 1
        if d==0:return start+m.end()
a=body.index('<div class="cat-sheet"'); b=bal(body,a,'div')
body=body[:a]+'<div class="q-sheet">'+secs+'</div>'+body[b:]
def cut(s0,start_pat,tag):
    i=s0.find(start_pat)
    if i<0: return s0
    return s0[:i]+s0[bal(s0,i,tag):]
body=cut(body,'<ol class="ts-strip"','ol')
pb=body.index('<div class="section-head plan-bar"'); body=body[:pb]+'<div class="q-planbar"><h2>Plan</h2><div class="q-seg" role="tablist" aria-label="Plan görünümü"><button type="button" role="tab" data-view="cat" aria-selected="true" class="on">Kategoriye göre</button><button type="button" role="tab" data-view="trip" aria-selected="false">Yolculuk sırasıyla</button><button type="button" role="tab" data-view="day" aria-selected="false">Gün gün</button></div></div>'+body[bal(body,pb,'div'):]
body=body.replace('<div class="q-sheet">','<div class="q-trip" hidden>'+trip_html()+'</div><div class="q-sheet">',1)
body=cut(body,'<div class="sbar-slot"','div')
hi=body.index('<section class="hx"'); he=bal(body,hi,'section')
body=body[:hi]+open(SP+'/hero81.html').read()+body[he:]
body=re.sub(r'<script[^>]*src="app.js"[^>]*></script>','',body)
for o,n in [('Durumlar (denetim)','Japonya turu'),('5 uçuş','2 uçuş'),('5 konaklama','4 konaklama'),('4 ulaşım','3 ulaşım'),('4 deneyim','3 deneyim'),('6 ihtiyaç karar bekliyor','7 ihtiyaç karar bekliyor'),('4 rezerve edilecek','3 rezerve edilecek')]:
    body=body.replace(o,n)
body=body.replace('src="https://klook.com/favicon.ico"','hidden')
ctrl='<div class="q-ctrl" role="region" aria-label="Prototip"><b>Prototip</b><span class="g"><button type="button" data-scn="init" class="on">Plan ilerledi</button><button type="button" data-scn="fresh">Omurga yeni</button></span><span class="g"><small>Üst özet</small><button type="button" data-h="M" class="on">Mozaik</button><button type="button" data-h="S">Şehirler</button><button type="button" data-h="K">Kapak</button></span></div>'
sheet='<div class="q-scrim" hidden></div><div class="q-sheetp" role="dialog" aria-modal="true" aria-label="Pano" hidden><div class="q-sh"><div class="q-sht"><b>Pano</b><small>Biriktirdiklerin, AI önerileri ve ilham</small></div><span class="q-sp"></span><button type="button" class="q-x" aria-label="Pano\'yu kapat">%s</button></div><div class="q-pbody"><nav class="q-side" aria-label="Pano bölümleri"></nav><div class="q-pmain"><div class="q-sc"></div></div></div></div>'%ic('x',18,2.4)+'<script>window.PANO='+json.dumps(PANO,ensure_ascii=False).replace('</','<\\/')+';</script>'
css=open(DIST+'app.css').read()+'\n'+open(SP+'/mk81.css').read()
js=open(SP+'/mk81.js').read()
page='<title>Katmanlı Plan</title><meta name="claude:viewport-fit-sides" content="cover"><style>'+css+'</style><div id="root" class="hM vcat">'+body+'</div>'+sheet+ctrl+'<script>'+js+'</script>'
os.makedirs(OUT+'/illus',exist_ok=True)
for f in os.listdir(DIST+'illus'):
    if f.endswith('.png'): shutil.copy(DIST+'illus/'+f,OUT+'/illus/'+f)
open(OUT+'/artifact.html','w').write(page)
open(OUT+'/index.html','w').write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+page+'</body></html>')
print('ok',len(page))
