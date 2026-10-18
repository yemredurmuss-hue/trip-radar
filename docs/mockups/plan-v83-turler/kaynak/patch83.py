s=open('mk82.js').read()
def R(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(n,a[:80])
    s=s.replace(a,b)
# 1) Dahil durumu
R("else it.dataset.st={booked:'ok',sel:'sel',ai:'ai',arr:'arr'}[s.mode]||'todo';",
  "else it.dataset.st={booked:'ok',sel:'sel',ai:'ai',arr:'arr'}[s.mode]||'todo';\n  if(s.mode==='arr'&&isInc(it))it.dataset.st='inc';")
R("else if(ds==='arr'){st.className='q-st arr';st.textContent='Ayarlandı';}",
  "else if(ds==='arr'){st.className='q-st arr';st.textContent='Ayarlandı';}\n  else if(ds==='inc'){st.className='q-st inc';st.innerHTML=CK+' Dahil';}")
R("function render(it){", "function isInc(it){var a=$('.q-arr',it);return !!(a&&a.dataset.st==='inc');}\nfunction arrTh(ar){if(ar.dataset.img)return '<span class=\"q-th\" style=\"--bc:#888\"><img alt=\"\" src=\"'+ar.dataset.img+'\"></span>';var sv=$('.z-m svg',ar);return '<span class=\"q-th\" style=\"--bc:#0e7c66\">'+(sv?sv.outerHTML:'')+'</span>';}\nfunction render(it){")
R("""if(ar0)th.push('<span class="q-th" style="--bc:#888"><img alt="" src="'+ar0.dataset.img+'"></span>');""","""if(ar0)th.push(arrTh(ar0));""")
R("""if(s.mode==='arr'){st.dataset.st='arr';var ar=$('.q-arr',it);return '<div class="q-scard"><span class="q-sth"><span class="q-th" style="--bc:#888"><img alt="" src="'+ar.dataset.img+'"></span></span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · <em class="gr">Ayarlandı</em></span>""",
  """if(s.mode==='arr'){var ar=$('.q-arr',it),inc=ar.dataset.st==='inc';st.dataset.st=inc?'ok':'arr';return '<div class="q-scard"><span class="q-sth">'+arrTh(ar)+'</span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · '+(inc?'<em class="ok">Dahil</em>':'<em class="gr">Ayarlandı</em>')+'</span>""")
# 2) E16: seçince bildirim yok; E6: plana koy uçar, sayı sıçrar
R("""if(!quiet){into(it);toast('Seçildi');}}""","""if(!quiet){into(it);}nextUp();}""")
R("""function pick(it,o){var s=S(it);if(multi(it)){if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);flash($('.q-form[data-o="'+o+'"][data-f="sel"]',it));toast('Plana eklendi');}else select(it,o);}""",
  """function pick(it,o){var s=S(it);if(multi(it)){var src=$('.q-opt[data-o="'+o+'"]',it),r0=src&&src.getBoundingClientRect();if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);var f=$('.q-form[data-o="'+o+'"][data-f="sel"]',it);fly(src,r0,f);flash(f);var pp=$('.q-ppn',it);if(pp){pp.classList.remove('bump');void pp.offsetWidth;pp.classList.add('bump');}nextUp();}else select(it,o);}
function fly(src,r0,dst){if(RM||document.body.classList.contains('still')||!src||!r0||!dst||!r0.width)return;var r1=dst.getBoundingClientRect();if(!r1.width)return;var c=src.cloneNode(true);c.removeAttribute('hidden');c.classList.add('z-fly');c.style.left=r0.left+'px';c.style.top=r0.top+'px';c.style.width=r0.width+'px';c.style.height=r0.height+'px';c.style.margin='0';document.body.appendChild(c);
  requestAnimationFrame(function(){c.style.transform='translate('+(r1.left-r0.left)+'px,'+(r1.top-r0.top)+'px) scale('+(r1.width/r0.width)+','+(r1.height/r0.height)+')';c.style.transformOrigin='0 0';c.style.opacity='.15';});setTimeout(function(){c.remove();},420);}""")
R("""if(multi(it)){pick(it,el.dataset.pk);renderPano();}else{select(it,el.dataset.pk,true);renderPano();toast('Seçildi · plana yansıdı');}return;}""",
  """if(multi(it)){pick(it,el.dataset.pk);renderPano();}else{select(it,el.dataset.pk,true);renderPano();}return;}""")
# 3) Sıradaki kendini günceller (F4), sayılara basınca ilk karar (F5)
R("function all(){", """var WORD={'Konaklama':' oteli','Uçuş':' uçuşu','Tren':' treni','Otobüs':' otobüsü','Karayolu':' yolu','Vapur':' vapuru'};
function nextInt(){var c=$$('.q-int').filter(function(i){return !i.classList.contains('skip')&&!i.closest('.q-hid');});return c.filter(function(i){return i.dataset.st==='ai';})[0]||c.filter(function(i){return i.dataset.st==='todo'&&opts(i).length;})[0]||c.filter(function(i){return i.dataset.st==='todo';})[0]||null;}
function visaOpen(){var v=$('.z-visa.need');return v&&!v.classList.contains('done')?v:null;}
function nextLabel(){if(visaOpen())return 'Sıradaki: vize randevusu';var it=nextInt();if(!it)return 'Omurga hazır';var w=($('.z-kind',it)||{}).textContent||it.closest('.q-sec').querySelector('.q-tt b').textContent;var nm=$('.q-nm',it).textContent.replace(/\\s+/g,' ').trim();
  if(w==='Konaklama'||it.dataset.kind==='stay'&&/Konaklama/.test(it.closest('.q-sec').querySelector('.q-tt b').textContent))return 'Sıradaki: '+nm+' oteli';return 'Sıradaki: '+nm+(WORD[w]||'');}
var NX=0;function nextUp(){NX++;$$('.x-next .f-full,.x-next .f-fresh').forEach(function(x){x.textContent=nextLabel();});var hn=$('.h-mini .h-next');if(hn)hn.firstChild.textContent=nextLabel().replace('Sıradaki: ','Sıradaki ')+' ';}
function goNext(){var v=visaOpen();if(v){var sec=v.closest('.q-sec');goInt(null,sec);setTimeout(function(){into(v);flash(v);},RM?0:260);return;}var it=nextInt();if(it)goInt(it);}
function all(){""")
R("""if(el.classList.contains('h-next')){""","""if(el.classList.contains('h-next')){goNext();return;}if(el.classList.contains('h-next-old')){""")
# goInt: kategori de alabilsin
R("function goInt(it){if(!it)return;","function goInt(it,sec0){if(sec0&&!it){var b0=$$('.q-seg [data-view=\"cat\"]')[0];if(!R.classList.contains('vcat'))b0.click();if(!sec0.classList.contains('open'))$('.q-row1',sec0).click();return;}if(!it)return;var hd=it.closest('.q-hid');if(hd)hd.open=true;")
# 4) Gerek yok → Gizlenenler · n (F3), Geri al ile yerine döner
R("""if(el.classList.contains('q-x2')||el.classList.contains('q-skip')){it.classList.add('skip');it.classList.remove('chg');up(it);toast('Gerek yok dendi · Geri al');return;}""",
  """if(el.classList.contains('q-x2')||el.classList.contains('q-skip')){it.classList.add('skip');it.classList.remove('chg');up(it);hideInt(it);nextUp();return;}""")
R("""if(el.classList.contains('q-undo')){it.classList.remove('skip');up(it);return;}""",
  """if(el.classList.contains('q-undo')){it.classList.remove('skip');unhideInt(it);up(it);nextUp();flash(it);return;}""")
R("function flash(el){", """function hidCount(box){var d=$('.q-hid',box);if(!d)return;var n=$$('.q-int',d).length;if(!n){d.remove();return;}$('summary',d).textContent='Gizlenenler · '+n;}
function hideInt(it){var box=it.closest('.q-ints');if(!box||it.closest('.q-hid'))return;var ph=document.createElement('i');ph.className='q-slot';ph.hidden=true;ph.dataset.for=it.id;it.parentNode.insertBefore(ph,it);var d=$('.q-hid',box);if(!d){d=document.createElement('details');d.className='q-hid';d.innerHTML='<summary></summary>';box.appendChild(d);}d.appendChild(it);hidCount(box);}
function unhideInt(it){var ph=$('.q-slot[data-for="'+it.id+'"]');if(!ph)return;var box=ph.closest('.q-ints');ph.parentNode.insertBefore(it,ph);ph.remove();hidCount(box);}
function unhideAll(){$$('.q-hid .q-int').forEach(function(i){i.classList.remove('skip');unhideInt(i);});}
function flash(el){""")
# 5) Pano > Belgeler (C5)
R("""['ilham','İlham',D.ilham.length,'M8 5v14l11-7z']];""","""['ilham','İlham',D.ilham.length,'M8 5v14l11-7z'],['docs','Belgeler',docN(),'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6']];""")
R("function sideHtml(){", """function docN(){return (D.docs||[]).reduce(function(a,g){return a+g.items.length;},0);}
var DST={ok:'Karta bağlı',wait:'Bekleniyor',add:'Belge eklenmedi',link:'Bir karta bağla'};
function docsHtml(){var DI='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6"/></svg>';
  return '<div class="q-ph2"><div><b>Belgeler</b><small>Biletler, onaylar ve gezi belgeleri · her biri kendi kartına bağlı</small></div></div><div class="q-docs">'+(D.docs||[]).map(function(g){return '<section class="q-dg"><b>'+esc(g.g)+'</b>'+g.items.map(function(x){
    var act=x.goto?'<button type="button" class="q-dgo" data-goto="'+x.goto+'">Kartı göster ›</button>':(x.st==='link'?'<button type="button" class="q-dgo" data-bind="1">Karta bağla</button>':(x.st==='add'?'<button type="button" class="q-dgo" data-add="1">+ Ekle</button>':''));
    return '<div class="q-d1"><span class="q-dic">'+DI+'</span><span class="q-dm"><b>'+esc(x.nm)+'</b><small>'+esc(x.sub)+'</small></span><span class="q-dst '+x.st+'">'+DST[x.st]+'</span>'+act+'</div>';}).join('')+'</section>';}).join('')
   +'<div class="q-d1 drop"><span class="q-dic">+</span><span class="q-dm"><b>Belge ekle</b><small>PDF, görsel ya da e-posta. AI hangi karta ait olduğunu bulur, emin değilse sorar.</small></span></div></div>';}
function sideHtml(){""")
R("""  else if(P.v==='ilham'){""","""  else if(P.v==='docs'){html=docsHtml();}
  else if(P.v==='ilham'){""")
R("""    if(el.dataset.ih){""","""    if(el.dataset.goto){var gt=document.getElementById(el.dataset.goto);closePano();goInt(gt);setTimeout(function(){flash(gt);},RM?0:300);return;}
    if(el.dataset.bind){toast('Hangi karta? Sohbette sorulur ya da kartı seçersin (prototip)');return;}
    if(el.dataset.add){toast('Belge ekle: PDF, görsel (prototip)');return;}
    if(el.dataset.ih){""")
R("function openPano(cat,int){P.v='all';","function openPano(cat,int,v){P.v=v||'all';")
# 6) senaryolar: init, fresh, durum, flight, today (+ SCNSET)
R("""function scenario(k){$$('.q-int').forEach(function(i){""","""var SK0=null;
function scenario(k){unhideAll();R.classList.remove('fresh','durum','flight','today');if(k!=='init')R.classList.add(k);
  var sk=$('.z-skel');if(sk){if(SK0===null)SK0=sk.innerHTML;else sk.innerHTML=SK0;}
  $$('.x-today').forEach(function(t){t.hidden=t.dataset.today!==k;});
  var xh=$('.x-hero');if(xh){var slim=$('.x-slim',xh);if(k==='today'||k==='flight'){slim.hidden=false;}else if(!xh.classList.contains('fold'))slim.hidden=true;}
  $$('.q-chap.now').forEach(function(c){c.classList.remove('now');});
  $$('.q-ctrl [data-arrive]').forEach(function(b){b.hidden=k!=='durum';});
  var vw=(k==='today'||k==='flight')?'trip':'cat';var vb=$('.q-seg [data-view="'+vw+'"]');if(vb&&!vb.classList.contains('on'))vb.click();
  scenario0(k);var X=(window.SCNSET||{})[k];
  if(X){Object.keys(X.ints||{}).forEach(function(id){var i=document.getElementById(id);if(!i)return;var v=X.ints[id];if(v.mode)i.dataset.mode=v.mode;if(v.sel!=null)i.dataset.sel=v.sel;if(v.picked)i.dataset.picked=v.picked.join(',');if(v.booked)i.dataset.booked=v.booked.join(',');});all();
    if(X.chap!=null){var ch=$$('.q-chap')[X.chap];if(ch){ch.classList.add('now');setTimeout(function(){ch.scrollIntoView({block:'start',behavior:RM?'auto':'smooth'});},60);}}}
  nextUp();}
function scenario0(k){$$('.q-int').forEach(function(i){""")
# 7) yeni tıklamalar: gezi menüsü, sohbet, Dahil, vize, hızlı yanıtlar, çekmece, hareketi duraklat, AI sonucu gelsin
R("""  if(el.classList.contains('z-mb')){togglePop(el,el.nextElementSibling);return;}""",
  """  if(el.classList.contains('x-tmb')){togglePop(el,el.nextElementSibling);return;}
  if(el.classList.contains('x-tmi')){closePops();var tm=el.dataset.tm;
    if(tm==='docs'){openPano('','','docs');return;}
    toast({share:'Paylaş: salt okunur bağlantı ya da davet (prototip)',pdf:'Planı PDF olarak indir (prototip)',map:'Rota haritada açılır (prototip)',hist:'Geçmiş ve çöp kutusu: silinenler 30 gün burada (prototip)',chat:'Bu gezi için yeni sohbet başlar, plan aynı kalır (prototip)',link:'Link ekle: sohbete yapıştırmakla aynı (prototip)',set:'Gezi ayarları: tarih, kişiler, bütçe, para birimi (prototip)',del:'Geziyi sil: onay ister, 30 gün çöp kutusunda kalır (prototip)'}[tm]);return;}
  if(el.classList.contains('x-ps')||el.classList.contains('q-pbn')){goNext();return;}
  if(el.classList.contains('xt-go')){var vb2=$('.q-seg [data-view="trip"]');if(vb2)vb2.click();var cn=$('.q-chap.now');if(cn)cn.scrollIntoView({block:'start',behavior:RM?'auto':'smooth'});return;}
  if(el.closest('.x-today')&&el.classList.contains('q-open')){toast('Belge açılıyor (prototip)');return;}
  if(el.classList.contains('c-go')||el.classList.contains('z-goinc')||el.classList.contains('msg-event')){var g=document.getElementById(el.dataset.goto);if(g){closeChat();goInt(g);setTimeout(function(){flash(g);},RM?0:300);}return;}
  if(el.classList.contains('c-pick')){var gi=document.getElementById(el.dataset.goto);if(gi){var x0=JSON.parse(gi.dataset.init),sid=S(gi).sel||x0.best||(opts(gi)[0]||{dataset:{}}).dataset.o;if(sid){closeChat();goInt(gi);setTimeout(function(){select(gi,sid);},RM?0:300);}var dn=document.createElement('span');dn.className='c-done';dn.innerHTML=CK+' Seçildi';el.parentNode.replaceChild(dn,el);}return;}
  if(el.classList.contains('c-q')){toast('Soru sohbete gider: “'+el.textContent+'” (prototip)');return;}
  if(el.classList.contains('c-handle')){var ch2=el.closest('.chat'),op=!ch2.classList.contains('open');ch2.classList.toggle('open',op);el.setAttribute('aria-expanded',String(op));el.setAttribute('aria-label',op?'Sohbeti kapat':'Sohbeti aç');return;}
  if(el.classList.contains('q-still')){var on=!document.body.classList.contains('still');document.body.classList.toggle('still',on);el.setAttribute('aria-pressed',String(on));el.textContent=on?'Hareket duraklatıldı':'Hareketi duraklat';return;}
  if(el.dataset.arrive){arrive();return;}
  if(el.closest('.z-visa')&&el.classList.contains('q-got')){var vz=el.closest('.z-visa');vz.classList.add('done');vz.classList.remove('need');vz.innerHTML=CK+'<b>Vize alındı</b><span>Belgeyi Pano &gt; Belgeler\\'e ekleyebilirsin</span>';nextUp();return;}
  if(el.classList.contains('z-retry')){toast('Yeniden deneniyor (prototip)');return;}
  if(el.classList.contains('z-rmv2')){var bd=el.closest('.z-bad');if(bd)bd.remove();return;}
  if(el.classList.contains('z-mb')){togglePop(el,el.nextElementSibling);return;}""")
R("""document.addEventListener('click',function(e){if(!e.target.closest('.x-pop,.z-mpop,.x-whob,.x-budb,.x-prefb,.z-mb,.x-face'))closePops();},true);""",
  """document.addEventListener('click',function(e){if(!e.target.closest('.x-pop,.z-mpop,.x-whob,.x-budb,.x-prefb,.z-mb,.x-face,.x-tmb'))closePops();},true);
function closeChat(){var c=$('section.chat.open');if(c){c.classList.remove('open');var hb=$('.c-handle',c);if(hb)hb.setAttribute('aria-expanded','false');}}
var ARR=[['Cross Hotel Osaka','Namba · metroya 1 dk','8,9','€128'],['Hotel Royal Classic Osaka','Namba · yeni bina','8,7','€142'],['Namba Oriental Hotel','Sennichimae · sessiz','8,4','€96']];
function arrive(){var sk=$('.z-skel');if(!sk)return;$('.q-ot',sk).textContent='AI 3 seçenek buldu';$('.q-oc',sk).textContent='Namba çevresi · yeni geldi';var pu=$('.z-pulse',sk);if(pu)pu.remove();
  $('.q-cards',sk).innerHTML=ARR.map(function(a){return '<article class="q-card z-oc z-arrive"><div class="z-op" style="background:#fff"><img alt="" src="illus/otel.png"><span class="z-newb">Yeni</span></div><div class="z-ob"><span class="z-l1"><span class="q-brand" style="--bl:#003b95">Booking.com</span><span class="z-rate"><b class="q-rb">'+a[2]+'</b></span></span><h3 class="z-t">'+esc(a[0])+'</h3><div class="z-of"><span class="q-pr"><b>'+a[3]+'</b><small>/ gece</small></span><button type="button" class="q-pick z-demo">Seç</button></div></div></article>';}).join('');}""")
R("""  if(el.classList.contains('q-pick')){e.preventDefault();""","""  if(el.classList.contains('z-demo')){toast('Prototip: canlıda seçilen kart Seçildi haline döner');return;}
  if(el.classList.contains('q-pick')){e.preventDefault();""")
# 8) ilk boyamadan sonra hareketler açılır
R("all();mini();","all();mini();nextUp0();setTimeout(function(){R.classList.add('ready');},450);")
R("window.__q={all:all,openPano:openPano,scenario:scenario};","function nextUp0(){}\nwindow.__q={all:all,openPano:openPano,scenario:scenario,arrive:arrive,nextLabel:nextLabel};")
s=s.replace("var KI={fly:'plane',rail:'arr',stay:'bed',esim:'wifi',ev:'tk',todo:'pin',ride:'car'};","var KI={fly:'plane',rail:'arr',pass:'tk',stay:'bed',esim:'wifi',ev:'tk',todo:'pin',ride:'car'};")

# 9) ilerleme sayıları plan durumundan (B9, F5): planda / alındı / karar, Türkçe ekleriyle
R("function all(){$$('.q-sec').forEach(function(sec){$$('.q-int',sec).forEach(render);renderCat(sec);});prepCount();renderTrip();}",
  "function all(){$$('.q-sec').forEach(function(sec){$$('.q-int',sec).forEach(render);renderCat(sec);});prepCount();renderTrip();progress();}")
R("function up(it){render(it);renderCat(it.closest('.q-sec'));renderTrip();}","function up(it){render(it);renderCat(it.closest('.q-sec'));renderTrip();progress();}")
R("function all(){$$('.q-sec')", """function sfx(n){if(n===0)return 'ı';if(n%100===0)return 'ü';var u=n%10,t=Math.floor(n/10)%10;return u?['','i','si','ü','ü','i','sı','si','i','u'][u]:['','u','si','u','ı','si','ı','i','i','ı'][t];}
function loc(n){var p=sfx(n);return p+(/[ıu]$/.test(p)?'nda':'nde');}
function progress(){var L=$$('.q-int').filter(function(i){return !i.classList.contains('skip')&&!i.closest('.q-hid');}),N=L.length,P=0,A=0,K=0,AI=0;
  L.forEach(function(i){var d=i.dataset.st;if(d==='ok'||d==='inc'||d==='arr'){P++;A++;}else if(d==='sel')P++;else if(d==='plan'){P++;var s=S(i);if(s.booked.length&&s.booked.length===s.picked.length)A++;}else{K++;if(d==='ai')AI++;}});
  var pl=N?Math.round(P/N*100):0,al=N?Math.round(A/N*100):0;
  $$('.x-bar,.h-bar').forEach(function(b){var bk=$('.bk',b),ch=$('.ch',b);if(bk)bk.style.width=al+'%';if(ch)ch.style.width=(pl-al)+'%';});
  var f=$('.x-ps.f-full');if(f)f.innerHTML='<b>%'+pl+' planda</b> · %'+al+' alındı';
  var fr=$('.x-ps.f-fresh');if(fr)fr.textContent=N+' ihtiyaç'+(AI?' · '+AI+"'"+loc(AI)+' önerimiz var':'');
  var pg=$('.x-prog');if(pg)pg.setAttribute('data-tip','Omurganın %'+pl+"'"+sfx(pl)+' planda ('+N+' ihtiyaçtan '+P+"'"+sfx(P)+'), %'+al+"'"+sfx(al)+' alındı ('+A+'). '+(K?K+' karar bekliyor.':'Karar bekleyen yok.'));
  var mb=$('.h-mini small b');if(mb){mb.textContent='%'+pl+' planda';if(mb.nextSibling)mb.nextSibling.textContent=' · '+K+' karar';}
  var pb=$('.q-pbn');if(pb)pb.textContent=K?K+' karar bekliyor':'karar bekleyen yok';
  var sl=$('.x-slim small');if(sl)sl.textContent=sl.textContent.replace(/%\\d+ planda/,'%'+pl+' planda');}
function all(){$$('.q-sec')""")
# 10) durumlar senaryosunda yeni ve okunamadı kartları sıradaki yeri kullanır
R("  var ow=$('.q-opts',it),pw=$('.q-planw',it)","  var ow=$('.q-opts',it);if(ow&&R.classList.contains('durum')){var cap=Math.max(1,lim-$$('.z-new,.z-bad',ow).length);lim=avail.length>cap?Math.max(1,cap-1):cap;}\n  var pw=$('.q-planw',it)")

R("(k==='stay'?'Rezerve edildi':'Bilet alındı')","(k==='stay'?'Rezerve edildi':k==='esim'?'Satın alındı':'Bilet alındı')")
open('mk83.js','w').write(s)
print('ok',len(s))
