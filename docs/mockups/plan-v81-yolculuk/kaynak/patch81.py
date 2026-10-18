import re
s=open('gen80.py').read()
def rep(a,b,cnt=1):
    global s
    assert a in s,('MISSING',a[:90]); s=s.replace(a,b,cnt)
rep("OUT=SP+'/v80'","OUT=SP+'/v81'"); rep("/mk80.css","/mk81.css"); rep("/mk80.js","/mk81.js"); rep("/hero80.html","/hero81.html")
rep("from data79x import BAG,MATCH,LIKES,HINTS,DET,PREP","from data79x import BAG,MATCH,LIKES,HINTS,DET,PREP\nfrom data81x import SCORE,ACC,ILHAM,TRIP\nfrom scenes import scene")
# odata: score, time summary, brand, kind
rep("""    return 'data-o="%s" data-mine="%d" data-tot="%d" data-nm="%s" data-th="%s"'%(o['id'],1 if mine(o) else 0,t,E(nm),E(th))""",
"""    k=it['kind']
    if k=='fly': tm='%s %s · %s → %s%s · %s'%(o['alname'],o['no'],o['ft'],o['tt'],' +1' if o['plus'] else '',o['stops'])
    elif k=='rail': tm='%s · %s → %s · %s'%(o['line'],o['dep'],o['arr'],o['brand'][0])
    elif k in('stay','esim'): tm='%s · %s %s'%(b,o.get('price',''),o.get('unit',''))
    elif k=='ev': tm='%s · %s · %s kişi başı'%(b,o.get('date',''),o.get('price',''))
    else: tm=o.get('sub','')
    pr=o.get('price','')
    return 'data-o="%s" data-mine="%d" data-tot="%d" data-nm="%s" data-th="%s" data-tm="%s" data-pr="%s" data-sc="%s" data-bn="%s" data-bc="%s" data-bg="%s"'%(o['id'],1 if mine(o) else 0,t,E(nm),E(th),E(tm),E(pr),SCORE.get(o['id'],''),E(b),c[0],E(c[1]))""")
# flight row: carrier name bold, number small
rep("""'<div class="q-row q-opt" %s>%s<span class="q-air">%s<small>%s</small></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="%s">%s</small></span><span class="q-tm r"><b>%s%s</b><small>%s</small></span></span>'
      '<span class="q-buy"><span class="q-pr"><b>%s</b><small>%s</small></span><span class="q-bg">%s%s</span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>')%(odata(it,o),rib(o),logo(o['alname']),o['alname'],""",
"""'<div class="q-row q-opt" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="%s">%s</small></span><span class="q-tm r"><b>%s%s</b><small>%s</small></span></span>'
      '<span class="q-buy"><span class="q-pr"><b>%s</b><small>%s</small></span><span class="q-bg">%s%s</span></span><span class="q-sel">%s<button type="button" class="q-pick">Seç</button></span></div>')%(odata(it,o),rib(o),logo(o['alname']),o['alname'],o['no'],""")
rep("""'<div class="q-row q-opt" %s>%s<span class="q-air">%s<small>%s</small></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="ok">aktarmasız</small></span>""",
"""'<div class="q-row q-opt" %s>%s<span class="q-air">%s<span class="q-an"><b>%s</b><small>%s</small></span></span>'
      '<span class="q-leg"><span class="q-tm"><b>%s</b><small>%s</small></span><span class="q-mid"><small>%s</small><i></i><small class="ok">aktarmasız</small></span>""")
rep("""%(odata(it,o),rib(o),logo(o['brand'][0]),o['line'].replace('Shinkansen ',''),o['dep']""","""%(odata(it,o),rib(o),logo(o['brand'][0]),o['line'].replace('Shinkansen ',''),o['brand'][0]+(' · Shinkansen' if 'Shinkansen' in o['line'] else ''),o['dep']""")
# access block helper
rep("def form(it,o,f):","""def access(o,kind):
    a=ACC.get(o['id'])
    if not a: return '',''
    doc=('<button type="button" class="q-open">%s %s aç</button>'%(ic('clip',14,2.2),E(a['doc']))) if a['doc'] else ('<button type="button" class="q-doc add">%s %s ekle</button>'%(ic('clip',13,2.2),{'fly':'E-bileti','rail':'Bileti','ev':'Bileti'}.get(kind,'Onayı')))
    links=''.join('<a class="q-alk" href="#" onclick="return false">%s ↗</a>'%E(l) for l in a['links'])
    code='<span class="q-code">%s <b>%s</b><button type="button" class="q-cp" aria-label="%s kopyala">%s</button></span>'%(E(a['code'][0]),E(a['code'][1]),E(a['code'][0]),ic('copy',12,2.2))
    info='<span class="q-aw">%s %s</span><span class="q-aw">%s %s</span>'%(ic('cal',13,2),E(a['when']),ic('pin',13,2),E(a['where']))
    return info+code, doc+links
def form(it,o,f):""")
s=s.replace("'chev':'M9 6l6 6-6 6',","'chev':'M9 6l6 6-6 6','pin':'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z','play':'M8 5v14l11-7z',",1)
# stay booked
a=s.index("            code=dict((r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2) "); b=s.index("            return w%v",a)
s=s[:a]+"""            info,acts=access(o,k)
            nm=E(o['name'].split(' · ',1)[1] if o['name'].startswith(o['brand'][0]+' · ') else o['name'])
            v=('<div class="q-vch"><span class="q-vck">%s</span><div class="q-vth"><img alt="" src="%s"></div><div class="q-vb"><span class="q-vst">%s · %s</span><h3>%s</h3>%s</div>'
               '<div class="q-vr">%s<button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div></div>%s')%(ic('check',18,3),img(o['img']),'Rezerve edildi' if k=='stay' else 'Satın alındı',E(o['brand'][0]),nm,info or '<span class="q-aw">%s · %s</span>'%(E(it['vals'][1]),E(it['vals'][0])),acts or '<button type="button" class="q-doc add">%s Onayı ekle</button>'%ic('clip',13,2.2),det)
"""+s[b:]
# flight/rail booked stub
a=s.index("            code=[(r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2]\n            cdh="); b=s.index("        return w%('<div class=\"q-tk\">",a)
s=s[:a]+"""            ac=ACC.get(o['id'],{})
            cdh=('<span class="q-code st">%s <b>%s</b><button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>'%(E(ac['code'][0]),E(ac['code'][1]),ic('copy',12,2.2))) if ac else ''
            doc=('<button type="button" class="q-open full">%s %s aç</button>'%(ic('clip',14,2.2),E(ac['doc']))) if ac.get('doc') else '<button type="button" class="q-doc add">%s Bileti ekle</button>'%ic('clip',13,2.2)
            when=('<small class="q-sw2">%s</small>'%E(ac['when'].split(' · ',1)[-1])) if ac else ''
            stub='<div class="q-stub done"><span class="q-stamp">%s</span><span class="q-vst">Bilet alındı</span>%s%s%s<button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(ic('check',20,3),cdh,when,doc)
"""+s[b:]
# event booked
rep("""            code=[(r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2]
            acts='<div class="q-act">%s<span class="q-sp"></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(('<span class="q-code">Bilet <b>%s</b></span>'%E(code[0][1])) if code else '')""",
"""            info,ac=access(o,'ev')
            acts='<div class="q-acc">%s</div><div class="q-act">%s<span class="q-sp"></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(info,ac)
            pr=''""")
rep("""<h3>%s</h3><span class="q-sub">%s</span>%s%s</div>%s</article>')%(' done' if f=='bk' else ''""","""<h3>%s</h3><span class="q-sub">%s</span>%s%s</div>%s</article>')%(' done' if f=='bk' else ''""")
# pano opt: score + kind
rep("""    return dict(id=o['id'],nm=nm,""","""    return dict(score=SCORE.get(o['id'],0),kind=k,id=o['id'],nm=nm,""")
rep("""PANO={'cats':[]}""","""PANO={'cats':[],'ilham':[]}""")
# plan bar replace + trip view + ilham
rep("""body=cut(body,'<ol class="ts-strip"','ol')""","""body=cut(body,'<ol class="ts-strip"','ol')
pb=body.index('<div class="section-head plan-bar"'); body=body[:pb]+'<div class="q-planbar"><h2>Plan</h2><div class="q-seg" role="tablist" aria-label="Plan görünümü"><button type="button" role="tab" data-view="cat" aria-selected="true" class="on">Kategoriye göre</button><button type="button" role="tab" data-view="trip" aria-selected="false">Yolculuk sırasıyla</button><button type="button" role="tab" data-view="day" aria-selected="false">Gün gün</button></div></div>'+body[bal(body,pb,'div'):]
body=body.replace('<div class="q-sheet">','<div class="q-trip" hidden>'+trip_html()+'</div><div class="q-sheet">',1)""")
rep("""def prep_section():""","""def trip_html():
    CH={'city-tokyo':'skyline','city-kyoto':'torii','city-hakone':'onsen','city-osaka':'lantern'}
    out=''
    for title,sub,key,steps in TRIP:
        hdr=('<div class="q-chap-h city"><div class="q-chap-img">%s</div><div><b>%s</b><small>%s</small></div></div>'%(scene(CH[key]),title,sub)) if key in CH else ('<div class="q-chap-h"><span class="q-chap-ic">%s</span><div><b>%s</b><small>%s</small></div></div>'%(ic('plane',16,2) if key=='ucus' else ic('list',16,2),title,sub))
        rows=''.join('<div class="q-step" data-t="%s" data-int="int-%s" data-o="%s"><span class="q-sdate">%s</span><span class="q-sdot"></span><div class="q-sbody"></div></div>'%(t,i,o,E(d)) if t!='prep' else '<div class="q-step" data-t="prep"><span class="q-sdate"></span><span class="q-sdot"></span><div class="q-sbody"></div></div>' for d,t,i,o in steps)
        out+='<section class="q-chap">%s<div class="q-steps">%s</div></section>'%(hdr,rows)
    return out
def prep_section():""")
# Hazırlık: Trendyol for priz to show dynamic sellers
rep("""('<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\\'da al ↗</a>' if src=='amazon'""","""('<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\\'da al ↗</a>' if src=='amazon' else '<a class="q-buy1 ty" href="#" onclick="return false"><span class="q-ty" aria-hidden="true">t</span>Trendyol\\'da al ↗</a>' if src=='trendyol'""")
# Pano markup: sidebar only
a=s.index("sheet='<div class=\"q-scrim\""); b=s.index("'%ic('x',18,2.4)",a)
s=s[:a]+"""sheet='<div class="q-scrim" hidden></div><div class="q-sheetp" role="dialog" aria-modal="true" aria-label="Pano" hidden><div class="q-sh"><div class="q-sht"><b>Pano</b><small>Biriktirdiklerin, AI önerileri ve ilham</small></div><span class="q-sp"></span><button type="button" class="q-x" aria-label="Pano\\'yu kapat">%s</button></div><div class="q-pbody"><nav class="q-side" aria-label="Pano bölümleri"></nav><div class="q-pmain"><div class="q-sc"></div></div></div></div>"""+s[b:]
rep("for c in CATS:\n    if c['key']=='transport'","PANO['ilham']=[dict(x,svg=scene(x['scene'])) for x in ILHAM]\nfor c in CATS:\n    if c['key']=='transport'")
open('gen81.py','w').write(s); print('ok')
