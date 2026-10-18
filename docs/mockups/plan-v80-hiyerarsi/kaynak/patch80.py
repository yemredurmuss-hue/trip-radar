s=open('gen79.py').read()
def rep(a,b,cnt=1):
    global s
    assert a in s, ('MISSING',a[:80])
    s=s.replace(a,b,cnt)
rep("OUT=SP+'/v79'","OUT=SP+'/v80'")
rep("/mk79.css","/mk80.css"); rep("/mk79.js","/mk80.js")
# --- 1. booked stay/esim: voucher ---
rep("""        else:
            acts='<div class="q-act"><button type="button" class="q-doc">%s Onayı ekle</button><span class="q-sp"></span>%s<span class="q-okc">%s Rezerve edildi</span></div>'%(ic('clip',13,2.2),pr,ic('check',13,3))
        aib=''
""","""        else:
            code=dict((r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2) 
            cd=list(code.items())[0] if code else None
            nm=E(o['name'].split(' · ',1)[1] if o['name'].startswith(o['brand'][0]+' · ') else o['name'])
            v=('<div class="q-vch"><span class="q-vck">%s</span><div class="q-vth"><img alt="" src="%s"></div><div class="q-vb"><span class="q-vst">%s</span><h3>%s</h3><span class="q-sub">%s · %s · %s</span>%s</div>'
               '<div class="q-vr"><span class="q-pr"><b>%s</b><small>toplam · ödendi</small></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div></div>%s')%(ic('check',18,3),img(o['img']),'Rezerve edildi' if k=='stay' else 'Satın alındı',nm,E(o['brand'][0]),E(it['vals'][1]),E(it['vals'][0]),('<span class="q-code">%s <b>%s</b><button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>'%(E(cd[0]),E(cd[1]),ic('copy',12,2.2))) if cd else '<button type="button" class="q-doc">%s Onayı ekle</button>'%ic('clip',13,2.2),tl.split(' · ')[-1],det)
            return w%v
        aib=''
""")
# --- 2. ticket: cities big, time under ---
rep("""            a=(o['ft'],o['fc']); b=(o['tt']+('<sup>+1</sup>' if o['plus'] else ''),o['tc']); mid=(o['dur'],o['stops']); il='ucus'""",
"""            a=(it['name'][0],'%s · <strong>%s</strong>'%(o['fc'],o['ft'])); b=(it['name'][1],'%s · <strong>%s</strong>%s'%(o['tc'],o['tt'],'<sup>+1</sup>' if o['plus'] else '')); mid=(o['dur'],o['stops']); il='ucus'""")
rep("""            a=(o['dep'],o['df']); b=(o['arr'],o['dt']); mid=(dur(o['dep'],o['arr']),'aktarmasız'); il='tren'""",
"""            a=(it['name'][0],'%s · <strong>%s</strong>'%(o['df'],o['dep'])); b=(it['name'][1],'%s · <strong>%s</strong>'%(o['dt'],o['arr'])); mid=(dur(o['dep'],o['arr']),'aktarmasız'); il='tren'""")
rep("""<div class="q-route"><span class="q-tm big"><b>%s</b><small>%s</small></span>""","""<div class="q-route"><span class="q-tm big q-city"><b>%s</b><small>%s</small></span>""")
rep("""<span class="q-tm big r"><b>%s</b><small>%s</small></span></div>%s</div>')""","""<span class="q-tm big q-city r"><b>%s</b><small>%s</small></span></div>%s</div>')""")
# flight booked stub: PNR, ödendi
rep("""            stub='<div class="q-stub done"><span class="q-okc">%s Bilet alındı</span>%s<button type="button" class="q-doc">%s Bileti ekle</button><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(ic('check',13,3),pr,ic('clip',13,2.2))""",
"""            code=[(r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2]
            cdh=('<span class="q-code st">%s <b>%s</b><button type="button" class="q-cp" aria-label="Kopyala">%s</button></span>'%(E(code[0][0]),E(code[0][1]),ic('copy',12,2.2))) if code else ''
            stub='<div class="q-stub done"><span class="q-stamp">%s</span><span class="q-vst">Bilet alındı</span>%s<span class="q-pr"><b>%s</b><small>2 kişi · ödendi</small></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(ic('check',20,3),cdh,eur(num(o['price'])*2))""")
# event booked
rep("""            acts='<div class="q-act"><span class="q-okc">%s Alındı</span><span class="q-sp"></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%ic('check',13,3)""",
"""            code=[(r[0],r[1]) for t_,rows in DET.get(o['id'],[]) for r in rows if len(r)>2]
            acts='<div class="q-act">%s<span class="q-sp"></span><button type="button" class="q-inf2 q-inf">Ayrıntı ›</button></div>'%(('<span class="q-code">Bilet <b>%s</b></span>'%E(code[0][1])) if code else '')""")
rep("""<article class="q-card q-plan%s"><div class="q-ph"><img alt="" src="illus/etkinlik-tur.png"><button""","""<article class="q-card q-plan%s"><div class="q-ph"><img alt="" src="illus/etkinlik-tur.png">%s<button""")
rep("""%(' done' if f=='bk' else '',ic('x',12,2.6),o['brand'][1]""","""%(' done' if f=='bk' else '',('<span class="q-vband">%s Bilet alındı</span>'%ic('check',13,3)) if f=='bk' else '',ic('x',12,2.6),o['brand'][1]""")
# --- 3. head: plate only when differs from category ---
rep("""    return ('<div class="q-head"><span class="q-plate">%s</span>""","""    plate=('<span class="q-plate">%s</span>'%it['word']) if it['word'] not in(CATN,) else ''
    return ('<div class="q-head%s">%s""")
rep("""<button type="button" class="q-pano">%s<span>Pano</span><b class="q-pn">%d</b></button></div></div>')%(it['word'],img(it['img'])""",
"""<button type="button" class="q-pano">%s<span>Pano</span><b class="q-pn">%d</b></button></div></div>')%(' np' if not plate else '',plate,img(it['img'])""")
# --- 4. closed row: meaningful summary + bar ---
rep("""def kw(cat):""","""SUMM={'flight':'gidiş ve dönüş','stay':None,'transport':None,'activity':None,'todo':None,'other':None}
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
def kw_old(cat):""")
rep("""<span class="q-ths"></span><span class="q-need"></span>%s<span class="q-chev" aria-hidden="true">%s</span></button>'""",
"""<span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk"></i><i class="ch"></i></span><small class="q-pl1"></small></span>%s<span class="q-chev" aria-hidden="true">%s</span></button>'""")
rep("""<span class="q-tt"><b>%s</b><small class="q-kw">%s</small></span>""","""<span class="q-tt"><b>%s</b><small class="q-kw">%s<span class="q-ideas"></span></small></span>""")
rep("""def section(cat):
    global CC; CC=cat['c']
""","""CATN=''
def section(cat):
    global CC,CATN; CC=cat['c']; CATN=cat['name']
""")
# --- 5. Hazırlık: no 'orada yapılacak', Amazon logo ---
rep("""<button type="button" class="q-pmv">Orada yapılacak</button>""","")
rep("""('<a class="q-buy1" href="#" onclick="return false">%sAmazon ↗</a>'%logo('Amazon',' sm') if src=='amazon'""","""('<a class="q-buy1 amz" href="#" onclick="return false"><span class="q-amz" aria-hidden="true">a</span>Amazon\\'da al ↗</a>' if src=='amazon'""")
rep("""<small class="q-kw">Yağmurluk · Japan Rail Pass · Yen <span class="q-kwm">+3</span></small></span><span class="q-ths"></span><span class="q-need todo q-pcount">%d/%d hazır</span>""",
"""<small class="q-kw">Gezi öncesi 6 iş · hava durumuna göre</small></span><span class="q-ths"></span><span class="q-prog"><span class="q-bar"><i class="bk" style="width:%d%%"></i></span><small class="q-pl1 q-pcount">%d/%d hazır</small></span>""")
rep("""%(ic('list',20,2),done,len(PREP),ic('chev',18,2.2)""","""%(ic('list',20,2),round(done*100/len(PREP)),done,len(PREP),ic('chev',18,2.2)""")
# --- 6. hero replace + remove strip/sbar ---
rep("""body=body[:a]+'<div class="q-sheet">'+secs+'</div>'+body[b:]""","""body=body[:a]+'<div class="q-sheet">'+secs+'</div>'+body[b:]
def cut(s0,start_pat,tag):
    i=s0.find(start_pat)
    if i<0: return s0
    return s0[:i]+s0[bal(s0,i,tag):]
body=cut(body,'<ol class="ts-strip"','ol')
body=cut(body,'<div class="sbar-slot"','div')
hi=body.index('<section class="hx"'); he=bal(body,hi,'section')
body=body[:hi]+open(SP+'/hero80.html').read()+body[he:]""")
# --- 7. Pano markup: two variants, simpler filters ---
old=s[s.index("sheet='<div class=\\\"q-scrim\\\"") if False else s.index("sheet='<div class=\"q-scrim\""):]
line=old[:old.index("'%ic('x',18,2.4)")]
newline="""sheet='<div class="q-scrim" hidden></div><div class="q-sheetp" role="dialog" aria-modal="true" aria-label="Pano" hidden><div class="q-sh"><div class="q-sht"><b>Pano</b><small>Herkesin biriktirdikleri ve AI önerileri</small></div><div class="q-ctabs" role="tablist"></div><button type="button" class="q-x" aria-label="Kapat">%s</button></div><div class="q-pbody"><nav class="q-side" aria-label="İhtiyaçlar"></nav><div class="q-pmain"><div class="q-sbar"><div class="q-sw"></div><span class="q-sp"></span><label class="q-srcsel"><span>Kaynak</span><select aria-label="Kaynak"><option value="*">Hepsi</option><option value="mine">Biriktirdiklerin</option><option value="ai">AI önerileri</option></select></label></div><div class="q-sc"></div></div></div></div>"""
s=s.replace(line,newline)
open('gen80.py','w').write(s)
print('ok')
