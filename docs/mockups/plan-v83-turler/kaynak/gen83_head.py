import json,re,os,sys,html,shutil
SP=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,SP)
from data71 import CATS
from data78x import LOGO,PC,TAG
from data79x import BAG,MATCH,LIKES,HINTS,DET,PREP
from data81x import SCORE,ACC,ILHAM,TRIP
from scenes import scene
DIST='/home/user/trip-radar/dist/'; OUT=SP+'/v82'
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
    elif k in('rail','pass'): tm='%s · %s → %s · %s'%(o['line'],o['dep'],o['arr'],o['brand'][0])
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

def dur(a,b):
    h1,m1=map(int,a.split(':'));h2,m2=map(int,b.split(':'));d=(h2*60+m2)-(h1*60+m1); return '%d sa %02d'%(d//60,d%60)

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

def trip_html():
    CH={'city-tokyo':'skyline','city-kyoto':'torii','city-hakone':'onsen','city-osaka':'lantern'}
    out=''
    for title,sub,key,steps in TRIP:
        hdr=('<div class="q-chap-h city"><div class="q-chap-img">%s</div><div class="q-chap-t"><b>%s</b><small>%s</small><span class="q-chap-sum"></span></div></div>'%(scene(CH[key]),title,sub)) if key in CH else ('<div class="q-chap-h"><span class="q-chap-ic">%s</span><div><b>%s</b><small>%s</small></div></div>'%(ic('plane',16,2) if key=='ucus' else ic('list',16,2),title,sub))
        rows=''.join('<div class="q-step" data-t="%s" data-int="int-%s" data-o="%s"><span class="q-sdate">%s</span><span class="q-sdot"></span><div class="q-sbody"></div></div>'%(t,i,o,E(d)) if t!='prep' else '<div class="q-step" data-t="prep"><span class="q-sdate"></span><span class="q-sdot"></span><div class="q-sbody"></div></div>' for d,t,i,o in steps)
        out+='<section class="q-chap">%s<div class="q-steps">%s</div></section>'%(hdr,rows)
    return out

