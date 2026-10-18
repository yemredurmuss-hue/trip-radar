(function(){
var R=document.getElementById('root');
function $(s,e){return (e||document).querySelector(s);} function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
var CK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
var HEART='<svg class="i" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var ME='Emre';
function S(it){var sp=function(k){return (it.dataset[k]||'').split(',').filter(Boolean);};return {mode:it.dataset.mode,sel:it.dataset.sel,picked:sp('picked'),booked:sp('booked')};}
function setL(it,k,a){it.dataset[k]=a.join(',');}
function opts(it){return $$('.q-opts .q-opt',it);}
function multi(it){return it.classList.contains('multi');}
var LIM={todo:4,ev:4};var FM={sel:'sel',booked:'bk',ai:'ai'};
function isInc(it){var a=$('.q-arr',it);return !!(a&&a.dataset.st==='inc');}
function arrTh(ar){if(ar.dataset.img)return '<span class="q-th" style="--bc:#888"><img alt="" src="'+ar.dataset.img+'"></span>';var sv=$('.z-m svg',ar);return '<span class="q-th" style="--bc:#0e7c66">'+(sv?sv.outerHTML:'')+'</span>';}
function render(it){
  var s=S(it),m=multi(it),os=opts(it),st=$('.q-st',it),k=it.dataset.kind,lim=LIM[k]||3,chg=it.classList.contains('chg'),skip=it.classList.contains('skip');
  var avail=m?os.filter(function(o){return s.picked.indexOf(o.dataset.o)<0;}):os;
  if(m)it.dataset.st=s.picked.length?'plan':'todo';
  else it.dataset.st={booked:'ok',sel:'sel',ai:'ai',arr:'arr'}[s.mode]||'todo';
  if(s.mode==='arr'&&isInc(it))it.dataset.st='inc';
  var ds=it.dataset.st;
  if(skip){st.className='q-st none';st.textContent='Gerek yok';}
  else if(m){st.className='q-st '+(s.picked.length?'sel':(os.length?'todo':'none'));st.innerHTML=s.picked.length?(s.picked.length+' planda'+(s.booked.length?' · '+s.booked.length+' alındı':'')):(os.length?'Karar bekliyor':'Aranıyor');}
  else if(ds==='ok'){st.className='q-st ok';st.innerHTML=CK+(k==='stay'?' Rezerve':' Alındı');}
  else if(ds==='sel'){st.className='q-st sel';st.innerHTML=CK+' Seçildi';}
  else if(ds==='ai'){st.className='q-st ai';st.textContent='✨ Önerimiz · onayla';}
  else if(ds==='arr'){st.className='q-st arr';st.textContent='Ayarlandı';}
  else if(ds==='inc'){st.className='q-st inc';st.innerHTML=CK+' Dahil';}
  else{st.className='q-st '+(os.length?'todo':'none');st.textContent=os.length?'Karar bekliyor':'Aranıyor';}
  $$('.q-form',it).forEach(function(f){var o=f.dataset.o,ff=f.dataset.f;
    if(m){var inP=s.picked.indexOf(o)>-1,bk=s.booked.indexOf(o)>-1;f.hidden=!(inP&&ff!=='ai'&&((ff==='bk')===bk));}
    else f.hidden=chg||!(o===s.sel&&ff===FM[s.mode]);});
  var ow=$('.q-opts',it);if(ow&&R.classList.contains('durum')){var cap=Math.max(1,lim-$$('.z-new,.z-bad',ow).length);lim=avail.length>cap?Math.max(1,cap-1):cap;}
  var pw=$('.q-planw',it),emp=$('.q-empty',it),self=$('.q-self',it),arr=$('.q-arr',it);
  if(arr)arr.hidden=s.mode!=='arr';
  if(pw){pw.hidden=false;$('.q-ppn',pw).textContent=s.picked.length||'';$$('.z-k0',pw).forEach(function(k0){k0.hidden=s.picked.length>0;});}
  var show=false;
  if(ow){
    show=m?avail.length>0:(s.mode==='opts'||chg);
    ow.hidden=!show;
    var n=0;os.forEach(function(o){var out=avail.indexOf(o)<0;o.hidden=out||n>=lim;if(!out&&n<lim)n++;var cur=!m&&chg&&o.dataset.o===s.sel;o.classList.toggle('is-cur',cur);var b=$('.q-pick',o);if(b&&!b.classList.contains('q-plus'))b.textContent=cur?'Seçili':(m?'+ Plana koy':'Seç');});
    if(!m&&chg){var c=os.filter(function(o){return o.dataset.o===s.sel;})[0];if(c&&c.hidden){var vis=os.filter(function(o){return !o.hidden;});if(vis.length){vis[vis.length-1].hidden=true;}c.hidden=false;}}
    $('.q-oc',ow).textContent=chg?'seçtiğin işaretli':(avail.length>lim?(avail.length+' · ilk '+lim+', tümü Pano\'da'):String(avail.length));var mo=$('.z-more',ow);if(mo){var extra=avail.length-lim;mo.hidden=extra<=0;mo.innerHTML='<b>+'+extra+'</b><small>Pano\'da</small>';}
    $('.q-cancel',ow).hidden=!chg;
    $('.q-ot',ow).textContent=chg?'Başka bir seçenek seç':(m?'Öneriler':'Seçenekler');
  }
  if(emp)emp.hidden=os.length>0||s.mode==='arr';
  if(self)self.hidden=!(show||(emp&&!emp.hidden));
  var pn=$('.q-pn',it);if(pn)pn.textContent=os.length;
  var pb=$('.q-pano',it);if(pb)pb.disabled=!os.length;
  $('.q-skipl',it).hidden=!skip;
}
function renderCat(sec){
  if(sec.classList.contains('q-prep'))return;
  var ints=$$('.q-int',sec),th=[],sum=0,bk=0,ch=0,need=0,nb=0,nc=0,ideas=0,tot=0;
  ints.forEach(function(it){if(it.classList.contains('skip'))return;tot++;var s=S(it),os=opts(it),m=multi(it);ideas+=os.length;
    if(s.mode==='arr'){bk++;var ar0=$('.q-arr',it);if(ar0)th.push(arrTh(ar0));return;}
    if(m){s.picked.forEach(function(id){var o=os.filter(function(x){return x.dataset.o===id;})[0];if(o){th.push(o.dataset.th);sum+=+o.dataset.tot;}});
      nb+=s.booked.length;nc+=s.picked.length-s.booked.length;
      if(!s.picked.length){need++;}else if(s.booked.length===s.picked.length)bk++;else ch++;
      return;}
    if(s.mode==='booked'||s.mode==='sel'){var o=os.filter(function(x){return x.dataset.o===s.sel;})[0];if(o){th.push(o.dataset.th);sum+=+o.dataset.tot;}
      if(s.mode==='booked'){bk++;nb++;}else{ch++;nc++;}}
    else{need++;if(os.length)th.push(os[0].dataset.th);}
  });
  var h=th.slice(0,3).join('');if(th.length>3)h+='<span class="q-thm">+'+(th.length-3)+'</span>';
  $('.q-ths',sec).innerHTML=h;
  var T=tot||1;$('.q-bar .bk',sec).style.width=(bk/T*100)+'%';$('.q-bar .ch',sec).style.width=(ch/T*100)+'%';
  var multiCat=ints.some(multi),p=[];
  if(nb)p.push(nb+' alındı');if(nc)p.push(nc+(multiCat?' planda':' seçildi'));if(need)p.push('<em>'+need+' karar</em>');
  if(!need&&!nb&&!nc)p.push('boş');
  $('.q-pl1',sec).innerHTML=p.join(' · ');
  var id=$('.q-ideas',sec);if(id)id.textContent=ideas?(' · '+ideas+' fikir'):'';
  var sp=$('.q-spent',sec);if(sp){var al=(sp.nextElementSibling&&sp.nextElementSibling.textContent.trim())||'';sp.textContent=sum?'€'+sum.toLocaleString('tr-TR'):(al?'€0':'');}
}
function prepNext(){var n=$$('#cat-prep .q-pr1[data-day]').filter(function(x){return !x.classList.contains('done');})[0];return n?' · sıradaki '+n.dataset.day+': '+$('.q-pt1 b',n).textContent:'';}
function bvCount(){var b=$('.q-bv');if(!b)return;var l=$$('.q-bv1',b),d=l.filter(function(x){return x.classList.contains('done');}).length,y=l.filter(function(x){return x.classList.contains('buy')&&!x.classList.contains('done');}).length;$('.q-bvn',b).textContent=d+'/'+l.length+' hazır'+(y?' · '+y+' alınacak':'');}
function prepCount(){var sec=$('#cat-prep');if(!sec)return;var r=$$('.q-pr1',sec),d=r.filter(function(x){return x.classList.contains('done');}).length;var t=d+'/'+r.length+' hazır';$('.q-pcount',sec).textContent=t;$('.q-pc2',sec).textContent=t;$('.q-bar .bk',sec).style.width=(d/r.length*100)+'%';}
function goInt(it,sec0){if(sec0&&!it){var b0=$$('.q-seg [data-view="cat"]')[0];if(!R.classList.contains('vcat'))b0.click();if(!sec0.classList.contains('open'))$('.q-row1',sec0).click();return;}if(!it)return;var hd=it.closest('.q-hid');if(hd)hd.open=true;var b=$$('.q-seg [data-view="cat"]')[0];if(!R.classList.contains('vcat'))b.click();var sec=it.closest('.q-sec');if(!sec.classList.contains('open'))$('.q-row1',sec).click();setTimeout(function(){it.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});flash(it);},80);}
var KI={fly:'plane',rail:'arr',pass:'tk',stay:'bed',esim:'wifi',ev:'tk',todo:'pin',ride:'car'};
function stepHtml(st){
  var t=st.dataset.t;
  if(t==='prep'){var r=$$('#cat-prep .q-pr1'),d=r.filter(function(x){return x.classList.contains('done');}).length;return '<div class="q-scard"><div class="q-sm"><b>Hazırlık</b><small>'+d+'/'+r.length+' hazır'+prepNext()+'</small></div><span class="q-sp"></span><button type="button" class="q-prep-go q-go2">Listeyi aç ›</button></div>';}
  var it=document.getElementById(st.dataset.int);if(!it)return '';
  var s=S(it),os=opts(it),k=it.dataset.kind,nm=$('.q-nm',it).textContent,plate=($('.z-kind',it)||{}).textContent||it.closest('.q-sec').querySelector('.q-tt b').textContent;
  var o,chip,main,actn='';
  if(t==='ideas'){var av=os.filter(function(x){return s.picked.indexOf(x.dataset.o)<0;});if(!av.length)return '';st.dataset.st='todo';
    return '<div class="q-scard idea"><div class="q-sm"><b>'+esc(nm)+' için '+av.length+' etkinlik önerisi</b><small>'+av.slice(0,2).map(function(x){return esc(x.dataset.nm);}).join(' · ')+(av.length>2?' …':'')+'</small></div><span class="q-sp"></span><button type="button" class="q-go q-go2">Önerilere bak ›</button></div>';}
  if(t==='item'){o=os.filter(function(x){return x.dataset.o===st.dataset.o;})[0];if(!o||s.picked.indexOf(o.dataset.o)<0){st.hidden=true;return '';}st.hidden=false;
    var bk=s.booked.indexOf(o.dataset.o)>-1;st.dataset.st=bk?'ok':'sel';
    var f=$('.q-form[data-o="'+o.dataset.o+'"][data-f="'+(bk?'bk':'sel')+'"]',it);
    var acc=f&&$('.q-acc',f);
    return '<div class="q-scard"><span class="q-sth">'+o.dataset.th+'</span><div class="q-sm"><span class="q-skind">'+(k==='todo'?'Yer':'Etkinlik')+(bk?' · <em class="ok">Bilet alındı</em>':' · Planda')+'</span><b>'+esc(o.dataset.nm)+'</b><small>'+esc(o.dataset.tm)+'</small>'+(bk&&acc?'<div class="q-sacc">'+acc.innerHTML+'</div>':'')+'</div><span class="q-sp"></span>'+(bk?(f?$('.q-act',f).innerHTML.replace(/<span class="q-sp"><\/span>.*$/,''):''):(k==='ev'&&f?$('.q-cta',f).outerHTML:''))+'<button type="button" class="q-go q-go2 q-chv" title="Planda göster">›</button></div>';}
  st.hidden=false;
  if(s.mode==='arr'){var ar=$('.q-arr',it),inc=ar.dataset.st==='inc';st.dataset.st=inc?'ok':'arr';return '<div class="q-scard"><span class="q-sth">'+arrTh(ar)+'</span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · '+(inc?'<em class="ok">Dahil</em>':'<em class="gr">Ayarlandı</em>')+'</span><b>'+esc(nm)+'</b><small>'+esc(ar.dataset.nm)+' · '+esc(ar.dataset.sub)+'</small></div><span class="q-sp"></span><button type="button" class="q-go q-go2 q-chv">›</button></div>';}
  o=s.sel?os.filter(function(x){return x.dataset.o===s.sel;})[0]:null;
  if(s.mode==='booked'&&o){st.dataset.st='ok';var fb=$('.q-form[data-o="'+o.dataset.o+'"][data-f="bk"]',it),code=fb&&$('.q-code',fb),op=fb&&($('.q-open',fb)||$('.q-doc',fb)),aw=fb?$$('.q-aw',fb).map(function(x){return x.textContent;}).join(' · '):'';
    return '<div class="q-scard"><span class="q-sth">'+o.dataset.th+'</span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · <em class="ok">'+(k==='stay'?'Rezerve edildi':k==='esim'?'Satın alındı':'Bilet alındı')+'</em></span><b>'+esc(nm)+'</b><small>'+esc(o.dataset.tm.split(' · ')[0]+(aw?' · '+aw:''))+'</small>'+(code?'<div class="q-sacc">'+code.outerHTML+'</div>':'')+'</div><span class="q-sp"></span>'+(op?op.outerHTML:'')+'<button type="button" class="q-go q-go2 q-chv" title="Planda göster">›</button></div>';}
  if((s.mode==='sel'||s.mode==='ai')&&o){var ai=s.mode==='ai';st.dataset.st=ai?'ai':'sel';var fs=$('.q-form[data-o="'+o.dataset.o+'"][data-f="sel"]',it),cta=fs&&($('.q-cta',fs)||$('.tk-buy',fs));
    return '<div class="q-scard"><span class="q-sth">'+o.dataset.th+'</span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · <em class="'+(ai?'ai':'sel')+'">'+(ai?'✨ Önerimiz, onayla':'Seçildi')+'</em></span><b>'+esc(nm)+'</b><small>'+esc(o.dataset.tm)+'</small></div><span class="q-sp"></span><span class="q-spr">'+esc(o.dataset.pr)+'</span>'+(ai?'<button type="button" class="q-pick q-take">Bunu seç</button>':(cta?cta.outerHTML:''))+'<button type="button" class="q-go q-go2 q-chv" title="Değiştir">›</button></div>';}
  st.dataset.st='todo';
  var est=$('.q-est',it);
  return '<div class="q-scard todo"><span class="q-sth"><span class="q-th art"><img alt="" src="'+(($('.q-art img',it)||{}).getAttribute?$('.q-art img',it).getAttribute('src'):'')+'"></span></span><div class="q-sm"><span class="q-skind">'+esc(plate)+' · <em class="todo">'+(os.length?'Karar bekliyor':'Aranıyor')+'</em></span><b>'+esc(nm)+'</b><small>'+(os.length?os.length+' seçenek · en iyi: '+esc(os[0].dataset.nm)+' '+esc(os[0].dataset.pr):(est?esc(est.textContent):'Henüz seçenek yok'))+'</small></div><span class="q-sp"></span><button type="button" class="q-go q-gob">'+(os.length?'Seçeneklere bak':'Ara')+' ›</button></div>';
}
function renderTrip(){if(R.classList.contains('vcat'))return;$$('.q-step').forEach(function(st){st.querySelector('.q-sbody').innerHTML=stepHtml(st);});
  $$('.q-chap').forEach(function(ch){var sm=$('.q-chap-sum',ch);if(!sm)return;var v=$$('.q-step',ch).filter(function(x){return !x.hidden&&x.dataset.t!=='ideas';}),ok=v.filter(function(x){return x.dataset.st==='ok'||x.dataset.st==='arr';}).length,n=v.length-ok;
    sm.innerHTML=(ok?'<i class="ok">'+ok+' hazır</i>':'')+(n?'<i>'+n+' karar</i>':'');});}
var WORD={'Konaklama':' oteli','Uçuş':' uçuşu','Tren':' treni','Otobüs':' otobüsü','Karayolu':' yolu','Vapur':' vapuru'};
function nextInt(){var c=$$('.q-int').filter(function(i){return !i.classList.contains('skip')&&!i.closest('.q-hid');});return c.filter(function(i){return i.dataset.st==='ai';})[0]||c.filter(function(i){return i.dataset.st==='todo'&&opts(i).length;})[0]||c.filter(function(i){return i.dataset.st==='todo';})[0]||null;}
function visaOpen(){var v=$('.z-visa.need');return v&&!v.classList.contains('done')?v:null;}
function nextLabel(){if(visaOpen())return 'Sıradaki: vize randevusu';var it=nextInt();if(!it)return 'Omurga hazır';var w=($('.z-kind',it)||{}).textContent||it.closest('.q-sec').querySelector('.q-tt b').textContent;var nm=$('.q-nm',it).textContent.replace(/\s+/g,' ').trim();
  if(w==='Konaklama'||it.dataset.kind==='stay'&&/Konaklama/.test(it.closest('.q-sec').querySelector('.q-tt b').textContent))return 'Sıradaki: '+nm+' oteli';return 'Sıradaki: '+nm+(WORD[w]||'');}
var NX=0;function nextUp(){NX++;$$('.x-next .f-full,.x-next .f-fresh').forEach(function(x){x.textContent=nextLabel();});var hn=$('.h-mini .h-next');if(hn)hn.firstChild.textContent=nextLabel().replace('Sıradaki: ','Sıradaki ')+' ';}
function goNext(){var v=visaOpen();if(v){var sec=v.closest('.q-sec');goInt(null,sec);setTimeout(function(){into(v);flash(v);},RM?0:260);return;}var it=nextInt();if(it)goInt(it);}
function sfx(n){if(n===0)return 'ı';if(n%100===0)return 'ü';var u=n%10,t=Math.floor(n/10)%10;return u?['','i','si','ü','ü','i','sı','si','i','u'][u]:['','u','si','u','ı','si','ı','i','i','ı'][t];}
function loc(n){var p=sfx(n);return p+(/[ıu]$/.test(p)?'nda':'nde');}
function progress(){var L=$$('.q-int').filter(function(i){return !i.classList.contains('skip')&&!i.closest('.q-hid');}),N=L.length,P=0,A=0,K=0,AI=0;
  L.forEach(function(i){var d=i.dataset.st;if(d==='ok'||d==='inc'||d==='arr'){P++;A++;}else if(d==='sel')P++;else if(d==='plan'){P++;var s=S(i);if(s.booked.length&&s.booked.length===s.picked.length)A++;}else{K++;if(d==='ai')AI++;}});
  var pl=N?Math.round(P/N*100):0,al=N?Math.round(A/N*100):0;
  $$('.x-bar,.h-bar').forEach(function(b){var bk=$('.bk',b),ch=$('.ch',b);if(bk)bk.style.width=al+'%';if(ch)ch.style.width=(pl-al)+'%';});
  var f=$('.x-ps.f-full');if(f)f.innerHTML='<b>%'+pl+' planda</b> · %'+al+' alındı';
  var fr=$('.x-ps.f-fresh');if(fr)fr.textContent=N+' ihtiyaç'+(AI?' · '+AI+' önerimiz var':'');
  var pg=$('.x-prog');if(pg)pg.setAttribute('data-tip','Omurganın %'+pl+"'"+sfx(pl)+' planda ('+N+' ihtiyaçtan '+P+"'"+sfx(P)+'), %'+al+"'"+sfx(al)+' alındı ('+A+'). '+(K?K+' karar bekliyor.':'Karar bekleyen yok.'));
  var mb=$('.h-mini small b');if(mb){mb.textContent='%'+pl+' planda';if(mb.nextSibling)mb.nextSibling.textContent=' · '+K+' karar';}
  var pb=$('.q-pbn');if(pb)pb.textContent=K?K+' karar bekliyor':'karar bekleyen yok';
  var sl=$('.x-slim small');if(sl)sl.textContent=sl.textContent.replace(/%\d+ planda/,'%'+pl+' planda');}
function all(){$$('.q-sec').forEach(function(sec){$$('.q-int',sec).forEach(render);renderCat(sec);});prepCount();renderTrip();progress();}
function up(it){render(it);renderCat(it.closest('.q-sec'));renderTrip();progress();}
function hidCount(box){var d=$('.q-hid',box);if(!d)return;var n=$$('.q-int',d).length;if(!n){d.remove();return;}$('summary',d).textContent='Gizlenenler · '+n;}
function hideInt(it){var box=it.closest('.q-ints');if(!box||it.closest('.q-hid'))return;var ph=document.createElement('i');ph.className='q-slot';ph.hidden=true;ph.dataset.for=it.id;it.parentNode.insertBefore(ph,it);var d=$('.q-hid',box);if(!d){d=document.createElement('details');d.className='q-hid';d.innerHTML='<summary></summary>';box.appendChild(d);}d.appendChild(it);hidCount(box);}
function unhideInt(it){var ph=$('.q-slot[data-for="'+it.id+'"]');if(!ph)return;var box=ph.closest('.q-ints');ph.parentNode.insertBefore(it,ph);ph.remove();hidCount(box);}
function unhideAll(){$$('.q-hid .q-int').forEach(function(i){i.classList.remove('skip');unhideInt(i);});}
function flash(el){if(!el)return;el.classList.remove('q-flash');void el.offsetWidth;el.classList.add('q-flash');}
function into(el){if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',behavior:RM?'auto':'smooth'});}
var tt;function toast(m){var t=$('.q-toast');if(!t){t=document.createElement('div');t.className='q-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true;},2400);}
function select(it,o,quiet){it.dataset.mode='sel';it.dataset.sel=o;it.classList.remove('chg');up(it);var f=$('.q-form[data-o="'+o+'"][data-f="sel"]',it);flash(f);if(!quiet){into(it);}nextUp();}
function pick(it,o){var s=S(it);if(multi(it)){var src=$('.q-opt[data-o="'+o+'"]',it),r0=src&&src.getBoundingClientRect();if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);var f=$('.q-form[data-o="'+o+'"][data-f="sel"]',it);fly(src,r0,f);flash(f);var pp=$('.q-ppn',it);if(pp){pp.classList.remove('bump');void pp.offsetWidth;pp.classList.add('bump');}nextUp();}else select(it,o);}
function fly(src,r0,dst){if(RM||document.body.classList.contains('still')||!src||!r0||!dst||!r0.width)return;var r1=dst.getBoundingClientRect();if(!r1.width)return;var c=src.cloneNode(true);c.removeAttribute('hidden');c.classList.add('z-fly');c.style.left=r0.left+'px';c.style.top=r0.top+'px';c.style.width=r0.width+'px';c.style.height=r0.height+'px';c.style.margin='0';document.body.appendChild(c);
  requestAnimationFrame(function(){c.style.transform='translate('+(r1.left-r0.left)+'px,'+(r1.top-r0.top)+'px) scale('+(r1.width/r0.width)+','+(r1.height/r0.height)+')';c.style.transformOrigin='0 0';c.style.opacity='.15';});setTimeout(function(){c.remove();},420);}
/* ---------- Pano ---------- */
var D=window.PANO||{cats:[],ilham:[]},SH=$('.q-sheetp'),SC=$('.q-scrim'),P={v:'all',cat:'',int:''},last=null;
var CMPK={stay:1,esim:1,fly:1,rail:1};
function catOf(k){return D.cats.filter(function(c){return c.key===k;})[0];}
function intOf(id){var r=null;D.cats.forEach(function(c){c.ints.forEach(function(i){if(i.id===id)r=i;});});return r;}
function catByInt(id){var r=null;D.cats.forEach(function(c){c.ints.forEach(function(i){if(i.id===id)r=c;});});return r;}
function curSet(i){var el=document.getElementById(i.id);if(!el)return [];var s=S(el);return i.multi?s.picked:(s.mode==='sel'||s.mode==='booked'?[s.sel]:[]);}
function bkOf(i,o){var el=document.getElementById(i.id);if(!el)return false;var s=S(el);return i.multi?s.booked.indexOf(o.id)>-1:(s.mode==='booked'&&s.sel===o.id);}
function cnt(c,f){return c.ints.reduce(function(b,i){return b+i.opts.filter(f||function(){return true;}).length;},0);}
function isMine(o){return o.src!=='ai';}
function srcB(o){if(o.best)return '<span class="q-src best">✨ Önerimiz</span>';if(o.src==='ai')return '<span class="q-src ai">✨ AI önerisi</span>';if(o.src==='link')return '<span class="q-src mine">Senin linkin</span>';return '<span class="q-src mine"><i>'+o.who[0]+'</i>'+o.who+' ekledi</span>';}
function visual(o){return o.logo?'<span class="q-bigl" style="--bl:'+o.bc+'">'+esc(o.bg)+'</span>':'<img alt="" src="illus/'+o.img+'.png">';}
function likes(o){var on=o.likes.indexOf(ME)>-1;return '<button type="button" class="q-like'+(on?' on':'')+'" data-like="'+o.id+'" aria-pressed="'+on+'" title="'+(o.likes.length?esc(o.likes.join(', '))+' beğendi':'Beğen')+'">'+HEART+o.likes.length+'</button>'+(o.likes.length?'<span class="q-avs">'+o.likes.map(function(n){return '<i class="'+(n==='Emre'?'e':'')+'" title="'+esc(n)+'">'+n[0]+'</i>';}).join('')+'</span>':'');}
function act(i,o,cur){return '<button type="button" class="q-pick" data-pk="'+o.id+'" data-int="'+i.id+'">'+(cur?(bkOf(i,o)?'✓ Alındı':(i.multi?'Planda':'Seçili')):(i.multi?'+ Plana koy':'Seç'))+'</button>';}
function score(o,rank){return o.score?'<span class="q-score" title="AI uyum puanı: niyetine ve tercihlerine göre">'+o.score+'<small>/100</small>'+(rank?'<em>'+rank+'. sırada</em>':'')+'</span>':'';}
function nmOf(o){return o.brand&&o.nm.indexOf(o.brand+' ')===0?o.nm.slice(o.brand.length+1):o.nm;}
function gridCard(i,o,cs){var cur=cs.indexOf(o.id)>-1;
  return '<article class="q-pg'+(cur?' cur':'')+'" style="--k:'+catByInt(i.id).c+'"><div class="q-ph'+(o.logo?' lg':'')+'">'+visual(o)+srcB(o)+(cur?'<span class="q-stc">'+(bkOf(i,o)?'Alındı':(i.multi?'Planda':'Seçili'))+'</span>':'')+'</div><div class="q-pgb"><span class="q-pgbn">'+esc(o.brand)+'</span><b>'+esc(nmOf(o))+'</b><small>'+esc(o.sub)+'</small><div class="q-pgm"><span class="q-pr"><b>'+esc(o.price||'—')+'</b><small>'+esc(o.unit)+'</small></span>'+score(o)+'</div><div class="q-pgf">'+likes(o)+act(i,o,cur)+'</div></div></article>';}
function cmpCol(i,o,cs,rank){var cur=cs.indexOf(o.id)>-1;
  var mc=o.match.map(function(x){return '<span class="q-mc '+(x[1]?'y':'n')+'">'+(x[1]?'✓ ':'✕ ')+esc(x[0])+'</span>';}).join('');
  var meta=[];if(o.rate)meta.push('<span class="q-rate"><b class="q-rb'+(o.rate.indexOf('★')===0?' star':'')+'">'+esc(o.rate)+'</b><span>'+esc(o.rev)+'</span></span>');if(o.cancel)meta.push('<span class="q-cw '+o.ccls+'">'+esc(o.cancel)+'</span>');if(o.bag)meta.push('<span class="q-bg">'+esc(o.bag)+'</span>');
  var li=function(a){return a.length?a.map(function(x){return '<li>'+esc(x)+'</li>';}).join(''):'<li class="q-na nb">yok</li>';};
  return '<article class="q-col'+(cur?' cur':'')+'" style="--k:'+catByInt(i.id).c+'">'
   +'<div class="q-c1 q-ph'+(o.logo?' lg':'')+'">'+visual(o)+srcB(o)+(cur?'<span class="q-stc">'+(bkOf(i,o)?'Alındı':'Şu an '+(i.multi?'planda':'seçili'))+'</span>':'')+'</div>'
   +'<div class="q-c2"><span class="q-pgbn">'+esc(o.brand)+'</span><b>'+esc(nmOf(o))+'</b><small>'+esc(o.sub)+'</small></div>'
   +'<div class="q-c3"><span class="q-pr big"><b>'+esc(o.price||'—')+'</b><small>'+esc(o.unit)+' · '+esc(o.tot)+'</small></span>'+score(o,rank)+'</div>'
   +'<div class="q-c4">'+(mc||'<span class="q-na">istek yok</span>')+'</div>'
   +'<div class="q-c5"><small class="q-lbl p">Artılar</small><ul class="q-pl p">'+li(o.pros)+'</ul></div>'
   +'<div class="q-c6"><small class="q-lbl m">Eksiler</small><ul class="q-pl m">'+li(o.cons)+'</ul></div>'
   +'<div class="q-c7">'+(meta.join('')||'<span class="q-na">—</span>')+'</div>'
   +'<div class="q-c8">'+likes(o)+'<a class="q-srcl" href="#" onclick="return false">'+esc(o.brand)+' ↗</a>'+act(i,o,cur)+'</div></article>';}
function ilhamCard(x){return '<article class="q-ih"><div class="q-ihp">'+x.svg+'<span class="q-play">'+(x.kind==='blog'?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 4h9l3 3v13H6zM9 10h6M9 14h6"/></svg>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>')+'</span><span class="q-plat" style="--pc:'+x.pc+'">'+esc(x.plat)+'</span></div><div class="q-ihb"><b>'+esc(x.title)+'</b><small>'+esc(x.meta)+' · '+esc(x.city)+'</small><div class="q-ihf"><span class="q-ihw">'+esc(x.who)+'</span><span class="q-sp"></span><button type="button" class="q-ihx" data-ih="'+x.id+'">✨ İçinden yerleri çıkar</button><a class="q-srcl" href="#" onclick="return false">Aç ↗</a></div></div></article>';}
function group(i,cc,os,showCat){var cs=curSet(i),can=CMPK[i.kind]&&i.opts.length>1;
  return '<section class="q-grp"><div class="q-gh"><b>'+esc(i.nm)+'</b><small>'+(showCat?esc(cc.name.split(' ')[0])+' · ':'')+esc(i.vals)+' · '+os.length+' kayıt</small><span class="q-sp"></span>'+(can?'<button type="button" class="q-cmpb" data-int="'+i.id+'" data-cat2="'+cc.key+'">Yan yana karşılaştır ›</button>':'')+'</div><div class="q-pgrid">'+os.map(function(o){return gridCard(i,o,cs);}).join('')+'</div></section>';}
function docN(){return (D.docs||[]).reduce(function(a,g){return a+g.items.length;},0);}
var DST={ok:'Karta bağlı',wait:'Bekleniyor',add:'Belge eklenmedi',link:'Bir karta bağla'};
function docsHtml(){var DI='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6"/></svg>';
  return '<div class="q-ph2"><div><b>Belgeler</b><small>Biletler, onaylar ve gezi belgeleri · her biri kendi kartına bağlı</small></div></div><div class="q-docs">'+(D.docs||[]).map(function(g){return '<section class="q-dg"><b>'+esc(g.g)+'</b>'+g.items.map(function(x){
    var act=x.goto?'<button type="button" class="q-dgo" data-goto="'+x.goto+'">Kartı göster ›</button>':(x.st==='link'?'<button type="button" class="q-dgo" data-bind="1">Karta bağla</button>':(x.st==='add'?'<button type="button" class="q-dgo" data-add="1">+ Ekle</button>':''));
    return '<div class="q-d1"><span class="q-dic">'+DI+'</span><span class="q-dm"><b>'+esc(x.nm)+'</b><small>'+esc(x.sub)+'</small></span><span class="q-dst '+x.st+'">'+DST[x.st]+'</span>'+act+'</div>';}).join('')+'</section>';}).join('')
   +'<div class="q-d1 drop"><span class="q-dic">+</span><span class="q-dm"><b>Belge ekle</b><small>PDF, görsel ya da e-posta. AI hangi karta ait olduğunu bulur, emin değilse sorar.</small></span></div></div>';}
function sideHtml(){var all=D.cats.reduce(function(a,c){return a+cnt(c);},0),mine=D.cats.reduce(function(a,c){return a+cnt(c,isMine);},0),ai=all-mine;
  var top=[['all','Tümü',all,'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],['mine','Biriktirdiklerim',mine,'M6 3h12v18l-6-4-6 4z'],['ai','AI önerileri',ai,'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],['ilham','İlham',D.ilham.length,'M8 5v14l11-7z'],['docs','Belgeler',docN(),'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6']];
  var h='<div class="q-stop">'+top.map(function(t){return '<button type="button" class="q-st1'+(P.v===t[0]&&!P.cat&&!P.int?' on':'')+'" data-v="'+t[0]+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="'+t[3]+'"/></svg>'+t[1]+'<i>'+t[2]+'</i></button>';}).join('')+'</div><div class="q-sdiv">İhtiyaçlar</div>';
  D.cats.forEach(function(c){if(!cnt(c))return;h+='<div class="q-sg"><button type="button" class="q-sgh'+(P.cat===c.key&&!P.int?' on':'')+'" data-cat="'+c.key+'"><span class="d" style="--c:'+c.c+'"></span>'+esc(c.name.split(' ve ')[0])+'<i>'+cnt(c)+'</i></button>'+c.ints.map(function(i){var el=document.getElementById(i.id),st=el?el.dataset.st:'';return '<button type="button" class="q-si'+(P.int===i.id?' on':'')+'" data-int="'+i.id+'" data-cat2="'+c.key+'"><span class="q-sd '+(st==='ok'?'ok':(st==='sel'||st==='plan')?'sel':st==='ai'?'ai':'')+'"></span>'+esc(i.nm)+'<i>'+i.opts.length+'</i></button>';}).join('')+'</div>';});
  return h;}
function renderPano(){
  $('.q-side',SH).innerHTML=sideHtml();
  var sc=$('.q-sc',SH),html='';
  if(P.int){var i=intOf(P.int),cc=catByInt(i.id),cs=curSet(i),os=i.opts.slice();
    if(CMPK[i.kind]){var ranked=os.slice().sort(function(a,b){return b.score-a.score;});
      html='<div class="q-ph2"><div><b>'+esc(i.nm)+'</b><small>'+esc(cc.name.split(' ')[0])+' · '+esc(i.vals)+'</small></div><span class="q-sp"></span><small class="q-hint2">AI uyum puanına göre sıralı · '+os.length+' seçenek'+(os.length>3?' · yana kaydır →':'')+'</small></div>'
        +'<div class="q-cmp3" style="--n:'+ranked.length+'">'+ranked.map(function(o,ix){return cmpCol(i,o,cs,ix+1);}).join('')+(ranked.length<3?'<div class="q-colx"><b>Daha fazla seçenek</b><small>Sohbete bir link at ya da AI\'dan iste; buraya yan yana gelir.</small><button type="button" class="q-ai sm">✨ AI\'dan öner</button></div>':'')+'</div>';}
    else html='<div class="q-ph2"><div><b>'+esc(i.nm)+'</b><small>'+esc(cc.name.split(' ')[0])+' · '+esc(i.vals)+' · biriktirdiklerin</small></div></div>'+group(i,cc,os,false).replace('<section class="q-grp"><div class="q-gh">','<section class="q-grp"><div class="q-gh" hidden>');}
  else if(P.cat){var c=catOf(P.cat);html='<div class="q-ph2"><div><b>'+esc(c.name)+'</b><small>'+cnt(c)+' kayıt</small></div></div>'+c.ints.map(function(i){return i.opts.length?group(i,c,i.opts,false):'';}).join('');}
  else if(P.v==='docs'){html=docsHtml();}
  else if(P.v==='ilham'){html='<div class="q-ph2"><div><b>İlham</b><small>Kaydettiğin videolar, reels ve yazılar</small></div></div><div class="q-ihg">'+D.ilham.map(ilhamCard).join('')+'</div>';}
  else{var f=P.v==='mine'?isMine:P.v==='ai'?function(o){return o.src==='ai';}:null;
    var ttl={all:['Tümü','Herkesin biriktirdikleri ve AI önerileri'],mine:['Biriktirdiklerim','Senin ve arkadaşlarının eklediği linkler'],ai:['AI önerileri','Niyetlerine göre AI\'nın bulduğu seçenekler']}[P.v];
    html='<div class="q-ph2"><div><b>'+ttl[0]+'</b><small>'+ttl[1]+'</small></div></div>';
    D.cats.forEach(function(cc){cc.ints.forEach(function(i){var os=f?i.opts.filter(f):i.opts;if(os.length)html+=group(i,cc,os,true);});});
    if(P.v==='all')html+='<section class="q-grp"><div class="q-gh"><b>İlham</b><small>'+D.ilham.length+' kayıt</small><span class="q-sp"></span><button type="button" class="q-cmpb" data-v="ilham">Hepsi ›</button></div><div class="q-ihg">'+D.ilham.slice(0,3).map(ilhamCard).join('')+'</div></section>';}
  sc.innerHTML=html;sc.scrollTop=0;
}
function openPano(cat,int,v){P.v=v||'all';P.cat=cat||'';P.int=int||'';if(int)P.cat='';last=document.activeElement;renderPano();SH.hidden=false;SC.hidden=false;document.documentElement.style.overflow='hidden';var x=$('.q-x',SH);x&&x.focus();setTab(true);}
function closePano(){SH.hidden=true;SC.hidden=true;document.documentElement.style.overflow='';setTab(false);if(last&&last.focus)last.focus();}
function setTab(on){var t=$$('.view-tabs button');if(t.length>1){t[0].classList.toggle('on',!on);t[1].classList.toggle('on',on);t[0].setAttribute('aria-selected',String(!on));t[1].setAttribute('aria-selected',String(on));}}
var SK0=null;
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
function scenario0(k){$$('.q-int').forEach(function(i){var x=JSON.parse(i.dataset.init);i.classList.remove('chg','skip');
  if(k==='fresh'){if(x.mode==='arr'){i.dataset.mode='arr';}else if(!multi(i)&&x.best){i.dataset.mode='ai';i.dataset.sel=x.best;}else{i.dataset.mode='opts';i.dataset.sel='';}i.dataset.picked='';i.dataset.booked='';}
  else{i.dataset.mode=x.mode;i.dataset.sel=x.sel;i.dataset.picked=x.picked.join(',');i.dataset.booked=x.booked.join(',');}});all();}
function closePops(keep){$$('.x-pop,.z-mpop').forEach(function(p){if(p!==keep&&!p.hidden){p.hidden=true;var b=p.previousElementSibling;if(b&&b.hasAttribute('aria-expanded'))b.setAttribute('aria-expanded','false');var w=p.parentNode.querySelector('[aria-expanded]');if(w)w.setAttribute('aria-expanded','false');}});}
function togglePop(btn,pop){var open=pop.hidden;closePops(pop);pop.hidden=!open;btn.setAttribute('aria-expanded',String(open));}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closePops();});
document.addEventListener('click',function(e){if(!e.target.closest('.x-pop,.z-mpop,.x-whob,.x-budb,.x-prefb,.z-mb,.x-face,.x-tmb'))closePops();},true);
function closeChat(){var c=$('section.chat.open');if(c){c.classList.remove('open');var hb=$('.c-handle',c);if(hb)hb.setAttribute('aria-expanded','false');}}
var ARR=[['Cross Hotel Osaka','Namba · metroya 1 dk','8,9','€128'],['Hotel Royal Classic Osaka','Namba · yeni bina','8,7','€142'],['Namba Oriental Hotel','Sennichimae · sessiz','8,4','€96']];
function arrive(){var sk=$('.z-skel');if(!sk)return;$('.q-ot',sk).textContent='AI 3 seçenek buldu';$('.q-oc',sk).textContent='Namba çevresi · yeni geldi';var pu=$('.z-pulse',sk);if(pu)pu.remove();
  $('.q-cards',sk).innerHTML=ARR.map(function(a){return '<article class="q-card z-oc z-arrive"><div class="z-op" style="background:#fff"><img alt="" src="illus/otel.png"><span class="z-newb">Yeni</span></div><div class="z-ob"><span class="z-l1"><span class="q-brand" style="--bl:#003b95">Booking.com</span><span class="z-rate"><b class="q-rb">'+a[2]+'</b></span></span><h3 class="z-t">'+esc(a[0])+'</h3><div class="z-of"><span class="q-pr"><b>'+a[3]+'</b><small>/ gece</small></span><button type="button" class="q-pick z-demo">Seç</button></div></div></article>';}).join('');}
document.addEventListener('click',function(e){
  var el=e.target.closest('button,a');if(!el)return;
  var xh=el.closest('.x-hero');
  if(xh){
    if(el.classList.contains('x-whob')||el.classList.contains('x-face')){togglePop($('.x-whob',xh),$('.x-who-pop',xh));return;}
    if(el.classList.contains('x-budb')){togglePop(el,$('.x-bud-pop',xh));return;}
    if(el.classList.contains('x-prefb')){togglePop(el,$('.x-pref-pop',xh));return;}
    if(el.classList.contains('x-rmv')){var li=el.closest('li');li.parentNode.removeChild(li);toast('Tercih kaldırıldı · AI artık bunu dikkate almaz');return;}
    if(el.classList.contains('x-yes')||el.classList.contains('x-no')){var ak=el.closest('.x-ask');ak.parentNode.removeChild(ak);var q=$('.x-q',xh);if(q)q.remove();toast(el.classList.contains('x-yes')?'Tamam, sabah trenlerini öne alırım':'Anlaşıldı, sabahı zorlamam');return;}
    if(el.classList.contains('x-invite')){toast('Davet bağlantısı kopyalandı (prototip)');return;}
    if(el.classList.contains('x-fold')){xh.classList.add('fold');$('.x-slim',xh).hidden=false;el.setAttribute('aria-expanded','false');return;}
    if(el.classList.contains('x-unfold')){xh.classList.remove('fold');$('.x-slim',xh).hidden=true;$('.x-fold',xh).setAttribute('aria-expanded','true');return;}
  }
  if(el.classList.contains('x-tmb')){togglePop(el,el.nextElementSibling);return;}
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
  if(el.closest('.z-visa')&&el.classList.contains('q-got')){var vz=el.closest('.z-visa');vz.classList.add('done');vz.classList.remove('need');vz.innerHTML=CK+'<b>Vize alındı</b><span>Belgeyi Pano &gt; Belgeler\'e ekleyebilirsin</span>';nextUp();return;}
  if(el.classList.contains('z-retry')){toast('Yeniden deneniyor (prototip)');return;}
  if(el.classList.contains('z-rmv2')){var bd=el.closest('.z-bad');if(bd)bd.remove();return;}
  if(el.classList.contains('q-bvck')){var bl=el.closest('.q-bv1');bl.classList.toggle('done');el.setAttribute('aria-checked',String(bl.classList.contains('done')));bvCount();return;}
  if(el.classList.contains('q-bvx')){var bx=el.closest('.q-bv1');var g=bx.closest('.q-bvg');bx.remove();if(g&&!$('.q-bv1',g))g.remove();bvCount();toast('Kaldırıldı · bir dahaki gezide önermem');return;}
  if(el.classList.contains('q-bva')){var qq=el.closest('.q-bvq');qq.classList.add('done');var ans=document.createElement('b');ans.textContent=el.textContent;$$('.q-bva',qq).forEach(function(x){x.remove();});qq.appendChild(ans);toast('Listeyi buna göre güncelledim (prototip)');return;}
  if(el.classList.contains('q-bvadd')){toast('Her gezide götürdüğün bir şeyi ekle; sonraki gezilerde de gelir (prototip)');return;}
  if(el.classList.contains('z-mb')){togglePop(el,el.nextElementSibling);return;}
  if(el.classList.contains('z-mi')&&el.dataset.m==='det'){var iq=el.closest('.q-int');closePops();var vf=$$('.q-form',iq).filter(function(f){return !f.hidden;})[0];var dd=vf&&$('.q-det',vf);if(dd){dd.hidden=false;}else toast('Bu ihtiyacın ayrıntısı seçim yapılınca gelir');return;}
  if(el.classList.contains('z-mi'))closePops();
  if(el.closest('.q-ctrl')){var g=el.closest('.g');if(!g)return;$$('button',g).forEach(function(b){b.classList.toggle('on',b===el);});
    if(el.dataset.scn)scenario(el.dataset.scn);
    
    return;}
  if(el.classList.contains('h-next')){goNext();return;}if(el.classList.contains('h-next-old')){var t=document.getElementById('cat-stay');if(t&&!t.classList.contains('open'))$('.q-row1',t).click();setTimeout(function(){var k=document.getElementById('int-s2');k&&k.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});flash(k);},60);return;}
  if(el.closest('.h-hero')&&el.classList.contains('h-lnk')){toast('Prototip');return;}
  if(el.classList.contains('h-pdf')){toast('PDF hazırlanıyor (prototip)');return;}
  if(el.closest('.view-tabs')){e.preventDefault();if(/Pano/.test(el.textContent)){if(SH.hidden)openPano();}else if(!SH.hidden)closePano();return;}
  if(el.closest('.q-sheetp')){
    if(el.classList.contains('q-x')){closePano();return;}
    if(el.dataset.like){var id=el.dataset.like;D.cats.forEach(function(c){c.ints.forEach(function(i){i.opts.forEach(function(o){if(o.id===id){var k=o.likes.indexOf(ME);if(k>-1)o.likes.splice(k,1);else o.likes.push(ME);}});});});renderPano();return;}
    if(el.dataset.pk){var it=document.getElementById(el.dataset.int);if(multi(it)){pick(it,el.dataset.pk);renderPano();}else{select(it,el.dataset.pk,true);renderPano();}return;}
    if(el.dataset.goto){var gt=document.getElementById(el.dataset.goto);closePano();goInt(gt);setTimeout(function(){flash(gt);},RM?0:300);return;}
    if(el.dataset.bind){toast('Hangi karta? Sohbette sorulur ya da kartı seçersin (prototip)');return;}
    if(el.dataset.add){toast('Belge ekle: PDF, görsel (prototip)');return;}
    if(el.dataset.ih){toast('AI bu içerikten yerleri çıkarıp ilgili ihtiyaçlara ekliyor (prototip)');return;}
    if(el.dataset.int){P.int=el.dataset.int;P.cat='';renderPano();return;}
    if(el.dataset.cat){P.cat=el.dataset.cat;P.int='';renderPano();return;}
    if(el.dataset.v){P.v=el.dataset.v;P.cat='';P.int='';renderPano();return;}
    if(el.classList.contains('q-ai'))toast('AI bu ihtiyaç için seçenek arıyor (prototip)');
    return;}
  if(el.closest('.q-seg')&&el.dataset.view){$$('.q-seg button').forEach(function(b){var on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
    R.classList.remove('vcat','vtrip','vday');R.classList.add('v'+el.dataset.view);if(el.dataset.view==='day')toast('Gün gün görünümü ayrı çizilecek; şimdilik Yolculuk sırasıyla');if(el.dataset.view!=='cat')renderTrip();return;}
  var stp=el.closest('.q-step');
  if(stp){var ti=document.getElementById(stp.dataset.int);
    if(el.classList.contains('q-go')){goInt(ti);return;}
    if(el.classList.contains('q-take')){select(ti,S(ti).sel);renderTrip();return;}
    if(el.classList.contains('q-open')){toast('Belge açılıyor (prototip)');return;}
    if(el.classList.contains('q-cp')){toast('Kopyalandı');return;}
    if(el.classList.contains('q-got')){ti.dataset.mode='booked';up(ti);renderTrip();toast('Alındı olarak işaretlendi');return;}
    if(el.classList.contains('q-doc')){toast('Bilet ya da onay dosyasını ekle (PDF, görsel)');return;}
    return;}
  if(el.classList.contains('q-prep-go')){var ps=document.getElementById('cat-prep');$$('.q-seg [data-view="cat"]')[0].click();if(!ps.classList.contains('open'))$('.q-row1',ps).click();return;}
  if(el.classList.contains('q-row1')){var sec=el.closest('.q-sec'),open=!sec.classList.contains('open');
    $$('.q-sec.open').forEach(function(s){if(s!==sec){s.classList.remove('open');$('.q-row1',s).setAttribute('aria-expanded','false');}});
    sec.classList.toggle('open',open);el.setAttribute('aria-expanded',open);if(open)setTimeout(function(){sec.scrollIntoView({block:'start',behavior:RM?'auto':'smooth'});},20);return;}
  var pr=el.closest('.q-pr1');
  if(pr){if(el.classList.contains('q-ck')){pr.classList.toggle('done');el.setAttribute('aria-checked',pr.classList.contains('done'));prepCount();return;}
    if(el.classList.contains('q-pdel')){pr.remove();prepCount();toast('Silindi · Geri al');return;}
    if(el.classList.contains('q-pmv')){toast('Yapılacaklar\'a taşındı (prototip)');return;}return;}
  if(el.classList.contains('q-phide')){var ul=$('.q-prows');ul.classList.toggle('hidedone');el.textContent=ul.classList.contains('hidedone')?'Hazırları göster':'Hazırları gizle';return;}
  var it=el.closest('.q-int');if(!it){if(el.classList.contains('q-add'))toast('Yeni ihtiyaç ekle (prototip)');else if(el.classList.contains('q-ai'))toast('AI hazırlık listesine öneri ekliyor (prototip)');return;}
  var s=S(it);
  if(el.classList.contains('q-pano')){openPano('',it.id);return;}
  if(el.classList.contains('q-chg')){if(!opts(it).length){toast('Bu ihtiyaç için seçenek yok; sohbete link at ya da AI\'dan iste');return;}it.classList.add('chg');up(it);into($('.q-opts',it));return;}
  if(el.classList.contains('q-cancel')){it.classList.remove('chg');up(it);return;}
  if(el.classList.contains('q-take')){var fo=el.closest('.q-form').dataset.o;select(it,fo);return;}
  if(el.classList.contains('z-demo')){toast('Prototip: canlıda seçilen kart Seçildi haline döner');return;}
  if(el.classList.contains('q-pick')){e.preventDefault();pick(it,el.closest('.q-opt').dataset.o);return;}
  if(el.classList.contains('q-got')){var go=el.closest('.q-form').dataset.o;if(multi(it)){if(s.booked.indexOf(go)<0){s.booked.push(go);setL(it,'booked',s.booked);}}else it.dataset.mode='booked';up(it);toast('Alındı olarak işaretlendi');return;}
  if(el.classList.contains('q-rm')){var ro=el.closest('.q-form').dataset.o;setL(it,'picked',s.picked.filter(function(x){return x!==ro;}));setL(it,'booked',s.booked.filter(function(x){return x!==ro;}));up(it);toast('Plandan çıkarıldı');return;}
  if(el.classList.contains('q-inf')){var d=$('.q-det',el.closest('.q-form'));if(d){d.hidden=!d.hidden;el.setAttribute('aria-expanded',String(!d.hidden));}return;}
  if(el.classList.contains('q-x2')||el.classList.contains('q-skip')){it.classList.add('skip');it.classList.remove('chg');up(it);hideInt(it);nextUp();return;}
  if(el.classList.contains('q-undo')){it.classList.remove('skip');unhideInt(it);up(it);nextUp();flash(it);return;}
  if(el.classList.contains('q-cp')){toast('Kopyalandı');return;}
  if(el.classList.contains('q-doc')){toast('Bilet ya da onay dosyasını ekle (PDF, görsel)');return;}
  if(el.classList.contains('q-dact')){toast(el.textContent+' (prototip)');return;}
  if(el.classList.contains('q-ai')){toast('AI bu ihtiyaç için seçenek arıyor (prototip)');return;}
});
SC.addEventListener('click',closePano);

document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!SH.hidden)closePano();});
var MB=$('.h-mini');
function mini(){var hero=$$('.h-hero').filter(function(x){return x.offsetParent!==null;})[0];if(!hero||!MB)return;var r=hero.getBoundingClientRect();MB.classList.toggle('on',r.bottom<40);}
window.addEventListener('scroll',mini,{passive:true});
all();mini();nextUp0();setTimeout(function(){R.classList.add('ready');},450);
var h=(location.hash||'').replace('#','');if(h.indexOf('ac-')===0){var sx=document.getElementById('cat-'+h.slice(3));if(sx)sx.classList.add('open');}
function nextUp0(){}
window.__q={all:all,openPano:openPano,scenario:scenario,arrive:arrive,nextLabel:nextLabel};
})();
