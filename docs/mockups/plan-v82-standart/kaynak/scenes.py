# Basit düz illüstrasyon sahneleri (canlıda gerçek fotoğraf gelir). Her çağrı benzersiz id üretir.
N=[0]
def _g(stops,vert=True):
    N[0]+=1; i='g%d'%N[0]
    st=''.join('<stop offset="%s" stop-color="%s"/>'%(o,c) for o,c in stops)
    return i,'<linearGradient id="%s" x1="0" y1="0" x2="%s" y2="%s">%s</linearGradient>'%(i,'0' if vert else '1','1' if vert else '0',st)
def wrap(defs,body,cls='q-scene'): return '<svg class="%s" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>%s</defs>%s</svg>'%(cls,defs,body)
def fuji():
    a,da=_g([(0,'#f6c9b8'),(.6,'#f3dccb'),(1,'#e9e3ef')]); b,db=_g([(0,'#7d6f9a'),(1,'#4c4468')]); c,dc=_g([(0,'#b9b3d3'),(1,'#8f88b0')])
    return wrap(da+db+dc,'<rect width="400" height="300" fill="url(#%s)"/><circle cx="300" cy="80" r="30" fill="#e9655a" opacity=".9"/><path d="M40 230 L170 92 Q192 74 214 92 L360 230 Z" fill="url(#%s)"/><path d="M150 113 L170 92 Q192 74 214 92 L234 113 L218 108 L205 120 L192 106 L178 121 L165 108 Z" fill="#fbf8ff"/><path d="M0 236 Q100 214 200 230 T400 226 L400 300 L0 300 Z" fill="url(#%s)"/><g fill="#d9667a" opacity=".85"><circle cx="350" cy="200" r="14"/><circle cx="370" cy="192" r="11"/><circle cx="382" cy="208" r="12"/></g>'%(a,b,c))
def ramen():
    a,da=_g([(0,'#3b2a2a'),(1,'#20161b')]); b,db=_g([(0,'#f0b35a'),(1,'#d9822f')])
    return wrap(da+db,'<rect width="400" height="300" fill="url(#%s)"/><ellipse cx="200" cy="170" rx="150" ry="52" fill="#c9442f"/><path d="M50 170 Q60 280 200 280 Q340 280 350 170 Z" fill="#a8321f"/><ellipse cx="200" cy="168" rx="134" ry="42" fill="url(#%s)"/><g stroke="#f7e3b0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"><path d="M110 165 q30 -16 60 0 t60 0 t60 0"/><path d="M120 182 q30 -14 60 0 t60 0 t50 0"/></g><circle cx="150" cy="150" r="22" fill="#fff6e8"/><circle cx="150" cy="150" r="10" fill="#f2b33d"/><rect x="232" y="138" width="56" height="30" rx="6" fill="#2f5b3a"/><path d="M280 60 L330 170 M300 50 L340 168" stroke="#d8b98c" stroke-width="6" stroke-linecap="round"/><g fill="#fff" opacity=".18"><path d="M170 120 q-10 -30 10 -60" stroke="#fff" stroke-width="5" fill="none"/><path d="M210 118 q-12 -28 8 -58" stroke="#fff" stroke-width="5" fill="none"/></g>'%(a,b))
def torii():
    a,da=_g([(0,'#f7e7c9'),(1,'#e9cfa6')])
    g=''.join('<g transform="translate(%d %d) scale(%s)"><rect x="-70" y="-8" width="140" height="14" rx="3" fill="#d1452f"/><rect x="-58" y="14" width="116" height="10" fill="#d1452f"/><rect x="-46" y="0" width="12" height="160" fill="#c23a26"/><rect x="34" y="0" width="12" height="160" fill="#c23a26"/></g>'%(200,40+i*44,str(round(1-i*.18,2))) for i in range(4))
    return wrap(da,'<rect width="400" height="300" fill="url(#%s)"/>%s<rect y="262" width="400" height="38" fill="#b9a07a"/><path d="M150 300 L190 200 L210 200 L250 300 Z" fill="#cdb48c"/>'%(a,g))
def onsen():
    a,da=_g([(0,'#cfe3ea'),(1,'#9cc4d1')]); b,db=_g([(0,'#7fb4c4'),(1,'#4f8ea3')])
    return wrap(da+db,'<rect width="400" height="300" fill="url(#%s)"/><path d="M0 120 Q120 80 220 110 T400 90 L400 170 L0 170 Z" fill="#6f8f6e"/><path d="M0 160 L400 160 L400 300 L0 300 Z" fill="#8c7a66"/><ellipse cx="200" cy="215" rx="170" ry="58" fill="url(#%s)"/><g fill="#7a6a58"><ellipse cx="40" cy="200" rx="34" ry="18"/><ellipse cx="360" cy="230" rx="40" ry="20"/><ellipse cx="300" cy="180" rx="24" ry="12"/></g><g stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"><path d="M150 190 q-14 -30 6 -60 q18 -26 0 -54"/><path d="M210 186 q-14 -30 6 -60 q18 -26 0 -54"/><path d="M265 192 q-12 -26 6 -52"/></g>'%(a,b))
def lantern():
    a,da=_g([(0,'#2a1c3d'),(1,'#120d1f')])
    l=''.join('<g transform="translate(%d %d)"><rect x="-1" y="-30" width="2" height="30" fill="#6b5b7d"/><ellipse cx="0" cy="18" rx="22" ry="28" fill="%s"/><rect x="-12" y="-12" width="24" height="6" fill="#2a1c3d"/><rect x="-12" y="42" width="24" height="6" fill="#2a1c3d"/><ellipse cx="0" cy="18" rx="22" ry="28" fill="#fff" opacity=".12"/></g>'%(x,y,c) for x,y,c in [(70,70,'#e8573f'),(150,90,'#f2a33a'),(230,66,'#e8573f'),(310,92,'#f2a33a'),(380,70,'#e8573f')])
    return wrap(da,'<rect width="400" height="300" fill="url(#%s)"/><rect y="0" width="400" height="6" fill="#4b3a5e"/>%s<rect y="210" width="400" height="90" fill="#1d1430"/><g fill="#f2a33a" opacity=".25"><rect x="20" y="220" width="60" height="70"/><rect x="120" y="230" width="80" height="60"/><rect x="250" y="216" width="70" height="74"/></g>'%(a,l))
def train():
    a,da=_g([(0,'#dfe8f5'),(1,'#c4d4ea')])
    return wrap(da,'<rect width="400" height="300" fill="url(#%s)"/><path d="M0 170 Q120 120 200 140 T400 120 L400 200 L0 200 Z" fill="#a8bfdc"/><rect y="200" width="400" height="100" fill="#8b9bb1"/><rect y="226" width="400" height="6" fill="#5d6b80"/><path d="M-20 168 L290 168 Q370 168 392 206 L392 222 L-20 222 Z" fill="#fbfcff"/><path d="M290 168 Q370 168 392 206 L340 206 Q320 182 290 182 Z" fill="#2f4f8a"/><rect x="-20" y="196" width="360" height="8" fill="#2f6fd1"/><g fill="#2f4f8a">%s</g>'%(a,''.join('<rect x="%d" y="176" width="34" height="14" rx="3"/>'%x for x in range(0,280,46))))
def bamboo():
    a,da=_g([(0,'#e3f0d8'),(1,'#b9d6a3')])
    st=''.join('<g><rect x="%d" y="0" width="%d" height="300" fill="%s"/>%s</g>'%(x,w,c,''.join('<rect x="%d" y="%d" width="%d" height="3" fill="#2f5b2a" opacity=".35"/>'%(x,y,w) for y in range(30,300,62))) for x,w,c in [(20,18,'#5f8f45'),(70,24,'#4f7d3a'),(130,16,'#6ea152'),(180,26,'#4a7536'),(250,20,'#5f8f45'),(300,28,'#3f6a30'),(360,18,'#6ea152')])
    return wrap(da,'<rect width="400" height="300" fill="url(#%s)"/>%s<path d="M150 300 L190 220 L210 220 L250 300 Z" fill="#c9b48a"/>'%(a,st))
def skyline():
    a,da=_g([(0,'#2b2a5a'),(.7,'#5b4b8a'),(1,'#d97b8f')])
    b=''.join('<rect x="%d" y="%d" width="%d" height="%d" fill="#1b1838"/>'%(x,y,w,300-y) for x,y,w in [(0,180,40),(40,150,34),(78,200,30),(110,120,26),(140,170,40),(185,90,18),(205,140,36),(245,175,30),(280,130,40),(325,190,30),(358,160,42)])
    w=''.join('<rect x="%d" y="%d" width="4" height="5" fill="#f6d27a" opacity=".8"/>'%(x,y) for x,y in [(50,170),(58,190),(118,140),(150,190),(160,210),(214,160),(222,180),(290,150),(300,170),(366,180)])
    return wrap(da,'<rect width="400" height="300" fill="url(#%s)"/><circle cx="320" cy="60" r="16" fill="#fbe9d0" opacity=".9"/><path d="M192 90 L194 40 L196 90 Z" fill="#e05a4a"/>%s%s'%(a,b,w))
SC={'fuji':fuji,'ramen':ramen,'torii':torii,'onsen':onsen,'lantern':lantern,'train':train,'bamboo':bamboo,'skyline':skyline}
def scene(n,cls='q-scene'): return SC[n]().replace('class="q-scene"','class="%s"'%cls)
