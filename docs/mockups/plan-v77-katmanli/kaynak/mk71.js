(function(){
var R=document.getElementById('root');
function $(s,e){return (e||document).querySelector(s);} function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
var ICK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
var ISR='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5"/></svg>';
var ILK='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
function V(){return R.classList.contains('vB')?'B':R.classList.contains('vC')?'C':'A';}
function D(){return R.classList.contains('d2')?2:R.classList.contains('d3')?3:1;}
function S(it){var sp=function(k){return (it.dataset[k]||'').split(',').filter(Boolean);};return {mode:it.dataset.mode,sel:it.dataset.sel,picked:sp('picked'),booked:sp('booked')};}
function setL(it,k,a){it.dataset[k]=a.join(',');}
function tiles(it){return $$('.ly-grid > .ly-opt',it);}
function isWho(t){return t.dataset.src==='sabine'||t.dataset.src==='emre';}
function render(it){
  var s=S(it),multi=it.classList.contains('multi'),ts=tiles(it),opts=$('.ly-opts',it),chg=it.classList.contains('chg'),nw=$('.ly-nw',it),seal=$('.seal',nw),stt;
  if(multi){var p=s.picked.length;nw.dataset.st=p?'ok':'todo';seal.innerHTML=p?String(p):ISR;stt=p?(p+' planda'):(ts.length?ts.length+' öneri':'Aranıyor');}
  else if(s.mode==='booked'){nw.dataset.st='done';seal.innerHTML=ICK;stt='Rezerve';}
  else if(s.mode==='sel'){nw.dataset.st='ok';seal.innerHTML=ICK;stt='Seçildi';}
  else {nw.dataset.st='todo';seal.innerHTML=ISR;stt=ts.length?(ts.length+' seçenek'):'Aranıyor';}
  $('.ly-stt',nw).textContent=stt;
  var empty=$('.ly-empty',it);
  if(multi){
    $$('.ly-form',it).forEach(function(f){var o=f.dataset.o,inP=s.picked.indexOf(o)>-1,bk=s.booked.indexOf(o)>-1;f.hidden=!(inP&&((f.dataset.f==='bk')===bk));});
    $('.ly-plan',it).hidden=!s.picked.length;$('.ly-pn',it).textContent=s.picked.length;
    ts.forEach(function(t){t.dataset.out=s.picked.indexOf(t.dataset.o)>-1?'1':'';});
    if(empty)empty.hidden=ts.length>0;
  }else{
    var selbox=$('.ly-selbox',it),cur=$('.ly-cur',it),done=$('.ly-done',it),d=D();
    $$('.ly-form',it).forEach(function(f){f.hidden=!(s.mode!=='opts'&&f.dataset.o===s.sel&&f.dataset.f===(s.mode==='booked'?'bk':'sel'));});
    var showOpts=(s.mode==='opts'&&ts.length>0)||(chg&&d!==3);
    var v2=chg&&d===2;
    var coll=V()==='B'&&s.mode==='booked'&&!it.classList.contains('exp');
    selbox.hidden=s.mode==='opts'||v2||coll; cur.hidden=!v2; done.hidden=!coll;
    var t0=ts.filter(function(t){return t.dataset.o===s.sel;})[0];
    if(t0){$('.ly-curn',cur).textContent=t0.dataset.nm;$('.ly-curp',cur).textContent=t0.dataset.pr+' '+t0.dataset.un;$('.ly-dn',done).textContent=t0.dataset.nm;$('.ly-dp',done).textContent=(s.mode==='booked'?'Rezerve · ':'')+t0.dataset.pr+' '+t0.dataset.un;}
    if(opts)opts.hidden=!showOpts||coll;
    if(empty)empty.hidden=!(s.mode==='opts'&&ts.length===0);
    ts.forEach(function(t){var c=chg&&t.dataset.o===s.sel;t.classList.toggle('is-cur',c);t.dataset.out='';var b=$('.ly-pick',t);if(b&&!b.classList.contains('it-put'))b.textContent=c?'Seçili':(b.classList.contains('ev-put')?'+ Plana koy':'Seç');});
    if(opts)$('.ly-oh .ly-cancel',opts).hidden=!(chg&&d===1);
  }
  if(opts){
    var all=opts.classList.contains('all'),f=opts.dataset.flt||'*',shown=0,LIM=it.classList.contains('it-city')?4:3;
    var avail=ts.filter(function(t){return t.dataset.out!=='1';});
    ts.forEach(function(t){if(t.dataset.out==='1'){t.hidden=true;return;}var ok=f==='*'||(f==='who'?isWho(t):t.dataset.src===f);if(!ok){t.hidden=true;return;}t.hidden=!all&&shown>=LIM;if(!t.hidden)shown++;});
    var btn=$('.ly-all',opts);btn.hidden=avail.length<=LIM;btn.textContent=all?'Daha az göster':('Hepsini gör ('+avail.length+')');
    $('.ly-flt',opts).hidden=!all;
    $('.ly-cnt',opts).textContent=avail.length?(all||avail.length<=LIM?avail.length:(LIM+' / '+avail.length)):'';
    if(multi){$('.ly-ot',opts).textContent=avail.length?'Öneriler':'Öneri kalmadı';$('.ly-grid',opts).hidden=!avail.length;}
  }
}
function thumb(t,ok){var tx=t.dataset.tx,b=ok?'<i class="b ok">'+ICK+'</i>':(t.dataset.src==='ai'?'<i class="b ai">✨</i>':t.dataset.src==='link'?'<i class="b link">'+ILK+'</i>':'<i class="b who">'+(t.dataset.src==='emre'?'E':'S')+'</i>');
  return '<span class="th" style="--bc:'+t.dataset.bc+'" title="'+t.dataset.nm+'">'+(tx?'<span class="tx">'+tx+'</span>':'<img alt="" src="illus/'+t.dataset.im+'.png">')+b+'</span>';}
function renderCat(sec){
  var ints=$$('.ly-int',sec),th=[],nOpt=0,nSel=0,nBk=0,nSearch=0,need=0,bk=0,ch=0,sum=0;function add(t){if(t)sum+=+(t.dataset.tot||0);}
  ints.forEach(function(it){var s=S(it),ts=tiles(it),multi=it.classList.contains('multi');
    if(multi){s.picked.forEach(function(o){var t=ts.filter(function(x){return x.dataset.o===o;})[0];if(t){th.push(thumb(t,1));add(t);}});
      ts.forEach(function(t){if(s.picked.indexOf(t.dataset.o)<0){th.push(thumb(t,0));nOpt++;}});
      nBk+=s.booked.length;nSel+=s.picked.length-s.booked.length;if(!s.picked.length){need++;}if(s.picked.length)ch+=1;
    }else{
      if(s.mode!=='opts'){var t=ts.filter(function(x){return x.dataset.o===s.sel;})[0];if(t)th.push(thumb(t,1));add(t);if(s.mode==='booked'){nBk++;bk++;}else{nSel++;ch++;}}
      else if(ts.length){need++;ts.forEach(function(t){th.push(thumb(t,0));});nOpt+=ts.length;}
      else{nSearch++;th.push('<span class="th empty" title="Henüz seçenek yok"></span>');}
    }
  });
  var max=6,h=th.slice(0,max).join('');if(th.length>max)h+='<span class="th more">+'+(th.length-max)+'</span>';
  $('.ly-thumbs',sec).innerHTML=h;
  var parts=[];if(nOpt)parts.push(nOpt+' seçenek');if(nSel)parts.push(nSel+' seçildi');if(nBk)parts.push(nBk+' rezerve');if(nSearch)parts.push(nSearch+' aranıyor');
  $('.ly-cst',sec).textContent=parts.join(' · ');
  var sp=$('.cat-spent',sec);if(sp)sp.textContent='€'+sum.toLocaleString('tr-TR');
  var nd=$('.ly-need',sec);nd.hidden=!need;nd.textContent=need+' karar bekliyor';
  var tot=ints.length||1;var b1=$('.cat-bar .bk',sec),b2=$('.cat-bar .ch',sec);if(b1){b1.style.width=(bk/tot*100)+'%';b2.style.width=(ch/tot*100)+'%';}
  $$('.ly-tab',sec).forEach(function(tb){var it=document.getElementById(tb.dataset.int),st=$('.ly-nw',it).dataset.st;tb.className='ly-tab '+st+(it.classList.contains('act')?' act':'');});
}
function ensureAct(sec){if(!$('.ly-int.act',sec)){var p=$$('.ly-int',sec).filter(function(it){return $('.ly-nw',it).dataset.st==='todo';})[0]||$('.ly-int',sec);if(p)p.classList.add('act');}}
function all(){$$('.ly-sec').forEach(function(sec){$$('.ly-int',sec).forEach(render);ensureAct(sec);renderCat(sec);});}
function up(it){render(it);renderCat(it.closest('.ly-sec'));}
function flash(el){if(!el)return;el.classList.remove('ly-flash');void el.offsetWidth;el.classList.add('ly-flash');}
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function scrollTo(el){if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',behavior:RM?'auto':'smooth'});}
function select(it,o){it.dataset.mode='sel';it.dataset.sel=o;it.classList.remove('chg');var op=$('.ly-opts',it);if(op){op.classList.remove('all');op.dataset.flt='*';$$('.ly-flt button',op).forEach(function(b){b.classList.toggle('on',b.dataset.f==='*');});}up(it);var f=$('.ly-form[data-o="'+o+'"][data-f="sel"]',it);flash(f&&f.firstElementChild);scrollTo($('.ly-nw',it));}
var toastT;function toast(m){var t=$('.ly-toast');if(!t){t=document.createElement('div');t.className='ly-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},2600);}
// çekmece
var DR=$('.ly-drawer'),SC=$('.ly-scrim'),drInt=null;
function openDrawer(it){drInt=it;var s=S(it);$('.ly-dk2',DR).textContent=$('.ly-nw .lab',it).textContent+' · tüm seçenekler';$('.ly-dt',DR).textContent=$('.ly-nw .nm',it).textContent;
  var g=$('.ly-dg',DR);g.innerHTML='';tiles(it).forEach(function(t){var c=t.cloneNode(true);c.hidden=false;c.removeAttribute('hidden');c.classList.toggle('is-cur',t.dataset.o===s.sel);var b=$('.ly-pick',c);if(b&&!b.classList.contains('it-put'))b.textContent=t.dataset.o===s.sel?'Seçili':'Seç';g.appendChild(c);});
  var ts=tiles(it),cnt=function(fn){return ts.filter(fn).length;};
  $('.ly-dflt',DR).innerHTML='<div class="ly-flt"><button type="button" class="on" data-f="*">Hepsi '+ts.length+'</button><button type="button" data-f="ai">AI '+cnt(function(t){return t.dataset.src==='ai';})+'</button><button type="button" data-f="link">Linklerim '+cnt(function(t){return t.dataset.src==='link';})+'</button><button type="button" data-f="who">Ekleyenler '+cnt(isWho)+'</button></div>';
  DR.hidden=false;SC.hidden=false;var x=$('.ly-dx',DR);x&&x.focus();}
function closeDrawer(){DR.hidden=true;SC.hidden=true;drInt=null;}
// link ekleme
function host(u){try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return u.replace(/^https?:\/\//,'').split('/')[0]||'link';}}
function addLink(it,url){
  var h=host(url),id='u'+Date.now(),im=($('.ly-nw .art img',it).getAttribute('src')||'').replace('illus/','').replace('.png',''),kind=it.dataset.kind,c=getComputedStyle(it).getPropertyValue('--c');
  var t=document.createElement('article');t.className='pk-card ly-opt';t.dataset.o=id;t.dataset.src='link';t.dataset.im=im;t.dataset.bc='#2b2842';t.dataset.nm=h;t.dataset.pr='';t.dataset.un='Fiyat yok';t.style.setProperty('--mc',c);
  t.innerHTML='<span class="ly-srcb link">'+ILK+'Senin linkin</span><div class="pk-body"><div class="pk-media pk-stay"><div class="pk-vis"><img class="pk-illus" alt="" src="illus/'+im+'.png"></div><div class="pk-txt"><div class="pk-srcrow"><span class="brand" style="--bc:#2b2842">'+h+'</span></div><h3></h3><div class="ly-sub">Ayrıntılar okunuyor…</div></div></div></div><div class="pk-foot"><span class="pk-price"><span class="pk-price2"><b>—</b><small> fiyat yok</small></span></span><span class="ly-act"><a class="ly-srcl" href="#" onclick="return false">'+h+' ↗</a><button type="button" class="ly-pick'+(it.classList.contains('multi')?' ev-put':'')+'">'+(it.classList.contains('multi')?'+ Plana koy':'Seç')+'</button></span></div>';
  $('h3',t).textContent=url.length>60?url.slice(0,57)+'…':url;
  var g=$('.ly-grid',it);g.insertBefore(t,g.firstChild);
  var mk=function(f){var w=document.createElement('div');w.className='ly-form';w.dataset.o=id;w.dataset.f=f;w.hidden=true;
    w.innerHTML='<article class="pk-card '+(f==='sel'?'pk-r-half':'pk-r-done pk-booked')+'" style="--mc:'+c+'"><div class="pk-top"><span class="pk-kind">Senin linkin</span><span class="pk-end">'+(f==='sel'?'<span class="pk-lab chosen">Seçildi</span>':'<span class="okt">Rezerve</span>')+'</span></div><div class="pk-body"><div class="pk-media pk-stay"><div class="pk-vis"><img class="pk-illus" alt="" src="illus/'+im+'.png"></div><div class="pk-txt"><div class="pk-srcrow"><span class="brand" style="--bc:#2b2842">'+h+'</span></div><h3></h3></div></div></div><div class="pk-foot">'+(f==='sel'?'<button type="button" class="pk-alt ly-chg">Değiştir</button><span class="pk-price"><span class="pk-price2"><b>Fiyat ekle</b></span></span><button type="button" class="pk-aldim ly-got">✓ Aldım</button><a class="pk-cta pk-go" href="#" onclick="return false">'+h+' sitesinde aç ↗</a>':'<span class="pk-price"><span class="pk-price2"><b>Fiyat ekle</b></span></span><button type="button" class="pk-more ly-infb">Ayrıntı ›</button>')+'</div></article>';
    $('h3',w).textContent=$('h3',t).textContent;return w;};
  var box=$('.ly-selbox',it)||$('.ly-prow',it);box.appendChild(mk('sel'));box.appendChild(mk('bk'));
  up(it);flash(t);toast('Link '+$('.ly-nw .nm',it).textContent+' için kaydedildi');}
// tıklamalar
document.addEventListener('click',function(e){
  var el=e.target.closest('button,a,.ly-prev'); if(!el)return;
  var it=el.closest('.ly-int'),sec=el.closest('.ly-sec');
  if(el.closest('.ly-ctrl')){var g=el.closest('.g');if(!g)return;$$('button',g).forEach(function(b){b.classList.toggle('on',b===el);});
    if(el.dataset.v){R.classList.remove('vA','vB','vC');R.classList.add('v'+el.dataset.v);$$('.ly-int').forEach(function(i){i.classList.remove('exp');});}
    if(el.dataset.d){R.classList.remove('d1','d2','d3');R.classList.add('d'+el.dataset.d);$$('.ly-int').forEach(function(i){i.classList.remove('chg');});}
    if(el.dataset.scn){$$('.ly-int').forEach(function(i){var x=JSON.parse(i.dataset.init);i.classList.remove('chg','exp');if(el.dataset.scn==='fresh'){i.dataset.mode='opts';i.dataset.sel='';i.dataset.picked='';i.dataset.booked='';}else{i.dataset.mode=x.mode;i.dataset.sel=x.sel;i.dataset.picked=x.picked.join(',');i.dataset.booked=x.booked.join(',');}});}
    all();return;}
  if(el.closest('.ly-drawer')){
    if(el.classList.contains('ly-dx')){closeDrawer();return;}
    if(el.dataset.f){$$('.ly-dflt button',DR).forEach(function(b){b.classList.toggle('on',b===el);});var f=el.dataset.f;$$('.ly-dg .ly-opt',DR).forEach(function(t){t.style.display=(f==='*'||(f==='who'?isWho(t):t.dataset.src===f))?'':'none';});return;}
    if(el.classList.contains('ly-pick')&&drInt){var o=el.closest('.ly-opt').dataset.o,ii=drInt;closeDrawer();select(ii,o);return;}
    return;}
  if(el.classList.contains('cat-title')||el.classList.contains('ly-prev')){var open=!sec.classList.contains('open');sec.classList.toggle('open',open);$('.cat-title',sec).setAttribute('aria-expanded',open);return;}
  if(!it)return;
  var multi=it.classList.contains('multi'),s=S(it),op=$('.ly-opts',it);
  if(el.classList.contains('ly-pick')){e.preventDefault();var o=el.closest('.ly-opt').dataset.o;
    if(multi){if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);var f=$('.ly-form[data-o="'+o+'"][data-f="sel"]',it);flash(f&&f.firstElementChild);toast('Plana eklendi');}
    else select(it,o);return;}
  if(el.classList.contains('ly-chg')){if(D()===3){openDrawer(it);return;}it.classList.add('chg');up(it);scrollTo(op);return;}
  if(el.classList.contains('ly-cancel')){it.classList.remove('chg');up(it);return;}
  if(el.classList.contains('ly-got')){var fo=el.closest('.ly-form').dataset.o;if(multi){if(s.booked.indexOf(fo)<0){s.booked.push(fo);setL(it,'booked',s.booked);}}else{it.dataset.mode='booked';}up(it);toast('Rezerve olarak işaretlendi');return;}
  if(el.classList.contains('ly-rm')){var ro=el.closest('.ly-form').dataset.o;setL(it,'picked',s.picked.filter(function(x){return x!==ro;}));setL(it,'booked',s.booked.filter(function(x){return x!==ro;}));up(it);toast('Plandan çıkarıldı, önerilere döndü');return;}
  if(el.classList.contains('ly-all')){op.classList.toggle('all');up(it);return;}
  if(el.closest('.ly-flt')&&el.dataset.f){op.dataset.flt=el.dataset.f;$$('.ly-flt button',op).forEach(function(b){b.classList.toggle('on',b===el);});up(it);return;}
  if(el.classList.contains('ly-inf')||el.classList.contains('ly-infb')){var card=el.closest('.ly-form');var m=card&&$('.ly-more',card);if(m){m.hidden=!m.hidden;el.setAttribute('aria-expanded',!m.hidden);}return;}
  if(el.classList.contains('ly-dopen')){it.classList.add('exp');up(it);return;}
  if(el.classList.contains('ly-tab')){$$('.ly-int',sec).forEach(function(i){i.classList.toggle('act',i.id===el.dataset.int);});renderCat(sec);return;}
  if(el.classList.contains('ly-ai')){toast('AI bu niyet için seçenek arıyor (prototip)');return;}
  if(el.classList.contains('ly-skip')){toast('"Gerek yok" denince bu niyet plandan çıkar (prototip)');return;}
  if(el.classList.contains('ly-pano')){toast('Pano: tüm niyetlerin seçenekleri yan yana (sonraki adım)');return;}
});
document.addEventListener('submit',function(e){var f=e.target.closest('.ly-drop');if(!f)return;e.preventDefault();var inp=$('input',f),v=(inp.value||'').trim();var it=f.closest('.ly-int');if(!v){inp.focus();toast('Önce bir link yapıştır');return;}addLink(it,v);inp.value='';});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!DR.hidden)closeDrawer();});
SC.addEventListener('click',closeDrawer);
all();
var h=(location.hash||'').replace('#','');if(h.indexOf('ac-')===0){var sx=document.getElementById('cat-'+h.slice(3));if(sx)sx.classList.add('open');}
window.__ly={all:all,select:select,openDrawer:openDrawer};
})();
