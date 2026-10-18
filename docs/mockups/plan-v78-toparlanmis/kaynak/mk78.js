(function(){
function $(s,e){return (e||document).querySelector(s);} function $$(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
var CK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function S(it){var sp=function(k){return (it.dataset[k]||'').split(',').filter(Boolean);};return {mode:it.dataset.mode,sel:it.dataset.sel,picked:sp('picked'),booked:sp('booked')};}
function setL(it,k,a){it.dataset[k]=a.join(',');}
function opts(it){return $$('.q-opts .q-opt',it);}
var LIM={todo:8};
function render(it){
  var s=S(it),multi=it.classList.contains('multi'),os=opts(it),st=$('.q-st',it),k=it.dataset.kind,lim=LIM[k]||3;
  var avail=multi?os.filter(function(o){return s.picked.indexOf(o.dataset.o)<0;}):os;
  if(multi){it.dataset.st=s.picked.length?'plan':'todo';}
  else it.dataset.st=s.mode==='booked'?'ok':s.mode==='sel'?'sel':'todo';
  var ds=it.dataset.st;
  if(multi){st.className='q-st '+(s.picked.length?'sel':(os.length?'todo':'none'));st.innerHTML=s.picked.length?(s.picked.length+' planda'+(s.booked.length?' · '+s.booked.length+' alındı':'')):(os.length?'Karar bekliyor':'Aranıyor');}
  else if(ds==='ok'){st.className='q-st ok';st.innerHTML=CK+(k==='stay'?' Rezerve':' Alındı');}
  else if(ds==='sel'){st.className='q-st sel';st.innerHTML=CK+' Seçildi';}
  else{st.className='q-st '+(os.length?'todo':'none');st.textContent=os.length?'Karar bekliyor':'Aranıyor';}
  $$('.q-form',it).forEach(function(f){var o=f.dataset.o,ff=f.dataset.f;
    if(multi){var inP=s.picked.indexOf(o)>-1,bk=s.booked.indexOf(o)>-1;f.hidden=!(inP&&((ff==='bk')===bk));}
    else f.hidden=!(s.mode!=='opts'&&o===s.sel&&ff===(s.mode==='booked'?'bk':'sel'));});
  var ow=$('.q-opts',it),pw=$('.q-planw',it),emp=$('.q-empty',it),self=$('.q-self',it);
  if(pw){pw.hidden=!s.picked.length;$('.q-ppn',pw).textContent=s.picked.length;}
  if(ow){
    var show=multi?avail.length>0:s.mode==='opts';
    ow.hidden=!show;
    var n=0;os.forEach(function(o){var out=avail.indexOf(o)<0;o.hidden=out||n>=lim;if(!out&&n<lim)n++;});
    var oc=$('.q-oc',ow);oc.textContent=avail.length>lim?('en iyi '+lim+' · tümü '+avail.length+', Pano\'da'):(avail.length+' seçenek');
  }
  if(emp)emp.hidden=os.length>0;
  if(self)self.hidden=!multi&&s.mode!=='opts';
  var pn=$('.q-pn',it);if(pn)pn.textContent=os.length;
}
function renderCat(sec){
  var ints=$$('.q-int',sec),th=[],need=0,sum=0;
  ints.forEach(function(it){var s=S(it),os=opts(it),multi=it.classList.contains('multi');
    var chosen=multi?s.picked:(s.mode!=='opts'&&s.sel?[s.sel]:[]);
    chosen.forEach(function(id){var o=os.filter(function(x){return x.dataset.o===id;})[0];if(o){th.push(o.dataset.th);sum+=+o.dataset.tot;}});
    if(!chosen.length){if(os.length){need++;th.push(os[0].dataset.th);}else need++;}
  });
  var h=th.slice(0,3).join('');if(th.length>3)h+='<span class="q-thm">+'+(th.length-3)+'</span>';
  $('.q-ths',sec).innerHTML=h;
  var nd=$('.q-need',sec);nd.className='q-need '+(need?'todo':'ok');nd.innerHTML=need?(need+' karar'):(CK+' hazır');
  var sp=$('.q-spent',sec);if(sp){var al=(sp.nextElementSibling&&sp.nextElementSibling.textContent.trim())||'';sp.textContent=sum?'€'+sum.toLocaleString('tr-TR'):(al?'€0':'');}
}
function all(){$$('.q-sec').forEach(function(sec){$$('.q-int',sec).forEach(render);renderCat(sec);});}
function up(it){render(it);renderCat(it.closest('.q-sec'));}
function flash(el){if(!el)return;el.classList.remove('q-flash');void el.offsetWidth;el.classList.add('q-flash');}
function into(el){if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',behavior:RM?'auto':'smooth'});}
var tt;function toast(m){var t=$('.q-toast');if(!t){t=document.createElement('div');t.className='q-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true;},2400);}
function select(it,o){it.dataset.mode='sel';it.dataset.sel=o;up(it);var f=$('.q-form[data-o="'+o+'"][data-f="sel"]',it);flash(f);into(it);toast('Seçildi');}
function pick(it,o){var s=S(it);if(it.classList.contains('multi')){if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);flash($('.q-form[data-o="'+o+'"][data-f="sel"]',it));toast('Plana eklendi');}else select(it,o);}
/* Pano */
var SH=$('.q-sheetp'),SC=$('.q-scrim'),cur=null,last=null;
function markCur(){if(!cur)return;var s=S(cur),multi=cur.classList.contains('multi'),on=multi?s.picked:(s.mode!=='opts'?[s.sel]:[]);
  $$('.q-cc',SH).forEach(function(c){c.classList.toggle('cur',on.indexOf(c.dataset.o)>-1);var b=$('.q-pick',c);if(b)b.textContent=on.indexOf(c.dataset.o)>-1?(multi?'Planda':'Seçili'):(multi?'+ Plana koy':'Seç');});}
function filt(f){var os=opts(cur),vis=0;os.forEach(function(o){var ok=f==='*'||(f==='mine'?o.dataset.mine==='1':o.dataset.mine==='0');$$('.q-cc[data-o="'+o.dataset.o+'"]',SH).forEach(function(c){c.hidden=!ok;});if(ok)vis++;});var g=$('.q-cmp',SH);if(g)g.style.setProperty('--n',vis);}
function openPano(it){
  var t=$('template.q-pano-t',it);if(!t)return;cur=it;last=document.activeElement;
  var sc=$('.q-sc',SH);sc.innerHTML='';sc.appendChild(t.content.cloneNode(true));sc.style.setProperty('--k',getComputedStyle(it).getPropertyValue('--k'));
  var sec=it.closest('.q-sec'),sw=$('.q-sw',SH);sw.innerHTML='';
  $$('.q-int',sec).forEach(function(x){var b=document.createElement('button');b.type='button';b.dataset.int=x.id;var d=x.dataset.st;b.innerHTML='<span class="d '+(d==='ok'?'ok':(d==='sel'||d==='plan')?'sel':'')+'"></span>'+$('.q-nm',x).textContent;if(x===it)b.className='on';if(!$('template.q-pano-t',x))b.disabled=true;sw.appendChild(b);});
  markCur();SH.hidden=false;SC.hidden=false;document.documentElement.style.overflow='hidden';var x=$('.q-x',SH);x&&x.focus();}
function closePano(){SH.hidden=true;SC.hidden=true;document.documentElement.style.overflow='';cur=null;if(last&&last.focus)last.focus();}
document.addEventListener('click',function(e){
  var el=e.target.closest('button,a');if(!el)return;
  if(el.closest('.q-ctrl')){if(!el.dataset.scn)return;$$('.q-ctrl button').forEach(function(b){b.classList.toggle('on',b===el);});
    $$('.q-int').forEach(function(i){var x=JSON.parse(i.dataset.init);if(el.dataset.scn==='fresh'){i.dataset.mode='opts';i.dataset.sel='';i.dataset.picked='';i.dataset.booked='';}else{i.dataset.mode=x.mode;i.dataset.sel=x.sel;i.dataset.picked=x.picked.join(',');i.dataset.booked=x.booked.join(',');}});all();return;}
  if(el.closest('.q-sheetp')){
    if(el.classList.contains('q-x')){closePano();return;}
    if(el.dataset.int){openPano(document.getElementById(el.dataset.int));return;}
    if(el.dataset.f){$$('.q-pf button[data-f]',SH).forEach(function(b){b.classList.toggle('on',b===el);});filt(el.dataset.f);return;}
    if(el.classList.contains('q-pick')&&cur){var o=el.closest('.q-cc').dataset.o,it=cur;if(it.classList.contains('multi')){pick(it,o);markCur();}else{closePano();select(it,o);}return;}
    if(el.classList.contains('q-more-ai')){toast('AI bu niyet için yeni seçenek arıyor (prototip)');return;}
    return;}
  if(el.classList.contains('q-row1')){var sec=el.closest('.q-sec'),open=!sec.classList.contains('open');
    $$('.q-sec.open').forEach(function(s){if(s!==sec){s.classList.remove('open');$('.q-row1',s).setAttribute('aria-expanded','false');}});
    sec.classList.toggle('open',open);el.setAttribute('aria-expanded',open);if(open)setTimeout(function(){sec.scrollIntoView({block:'start',behavior:RM?'auto':'smooth'});},20);return;}
  var it=el.closest('.q-int');if(!it){if(el.classList.contains('q-add'))toast('Yeni ihtiyaç ekle (prototip)');return;}
  var s=S(it);
  if(el.classList.contains('q-pano')||el.classList.contains('q-chg')){openPano(it);return;}
  if(el.classList.contains('q-pick')){e.preventDefault();pick(it,el.closest('.q-opt').dataset.o);return;}
  if(el.classList.contains('q-got')){var fo=el.closest('.q-form').dataset.o;if(it.classList.contains('multi')){if(s.booked.indexOf(fo)<0){s.booked.push(fo);setL(it,'booked',s.booked);}}else it.dataset.mode='booked';up(it);toast('Alındı olarak işaretlendi');return;}
  if(el.classList.contains('q-rm')){var ro=el.closest('.q-form').dataset.o;setL(it,'picked',s.picked.filter(function(x){return x!==ro;}));setL(it,'booked',s.booked.filter(function(x){return x!==ro;}));up(it);toast('Plandan çıkarıldı');return;}
  if(el.classList.contains('q-inf')){var m=$('.q-more',el.closest('.q-form'));if(m){m.hidden=!m.hidden;el.setAttribute('aria-expanded',String(!m.hidden));}return;}
  if(el.classList.contains('q-doc')){toast('Bilet ya da onay dosyasını ekle (PDF, görsel)');return;}
  if(el.classList.contains('q-ai')){toast('AI bu niyet için seçenek arıyor (prototip)');return;}
  if(el.classList.contains('q-skip')){toast('Bu niyet plandan çıkar (prototip)');return;}
});
SC.addEventListener('click',closePano);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!SH.hidden)closePano();});
all();
var h=(location.hash||'').replace('#','');if(h.indexOf('ac-')===0){var sx=document.getElementById('cat-'+h.slice(3));if(sx)sx.classList.add('open');}
window.__q={all:all,openPano:openPano};
})();
