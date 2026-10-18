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
var LIM={todo:8};var FM={sel:'sel',booked:'bk',ai:'ai'};
function render(it){
  var s=S(it),m=multi(it),os=opts(it),st=$('.q-st',it),k=it.dataset.kind,lim=LIM[k]||3,chg=it.classList.contains('chg'),skip=it.classList.contains('skip');
  var avail=m?os.filter(function(o){return s.picked.indexOf(o.dataset.o)<0;}):os;
  if(m)it.dataset.st=s.picked.length?'plan':'todo';
  else it.dataset.st={booked:'ok',sel:'sel',ai:'ai',arr:'arr'}[s.mode]||'todo';
  var ds=it.dataset.st;
  if(skip){st.className='q-st none';st.textContent='Gerek yok';}
  else if(m){st.className='q-st '+(s.picked.length?'sel':(os.length?'todo':'none'));st.innerHTML=s.picked.length?(s.picked.length+' planda'+(s.booked.length?' · '+s.booked.length+' alındı':'')):(os.length?'Karar bekliyor':'Aranıyor');}
  else if(ds==='ok'){st.className='q-st ok';st.innerHTML=CK+(k==='stay'?' Rezerve':' Alındı');}
  else if(ds==='sel'){st.className='q-st sel';st.innerHTML=CK+' Seçildi';}
  else if(ds==='ai'){st.className='q-st ai';st.textContent='✨ Önerimiz · onayla';}
  else if(ds==='arr'){st.className='q-st arr';st.textContent='Ayarlandı';}
  else{st.className='q-st '+(os.length?'todo':'none');st.textContent=os.length?'Karar bekliyor':'Aranıyor';}
  $$('.q-form',it).forEach(function(f){var o=f.dataset.o,ff=f.dataset.f;
    if(m){var inP=s.picked.indexOf(o)>-1,bk=s.booked.indexOf(o)>-1;f.hidden=!(inP&&ff!=='ai'&&((ff==='bk')===bk));}
    else f.hidden=!(o===s.sel&&ff===FM[s.mode]);});
  var ow=$('.q-opts',it),pw=$('.q-planw',it),emp=$('.q-empty',it),self=$('.q-self',it),arr=$('.q-arr',it);
  if(arr)arr.hidden=s.mode!=='arr';
  if(pw){pw.hidden=!s.picked.length;$('.q-ppn',pw).textContent=s.picked.length;}
  var show=false;
  if(ow){
    show=m?avail.length>0:(s.mode==='opts'||chg);
    ow.hidden=!show;
    var n=0;os.forEach(function(o){var out=avail.indexOf(o)<0;o.hidden=out||n>=lim;if(!out&&n<lim)n++;var cur=!m&&chg&&o.dataset.o===s.sel;o.classList.toggle('is-cur',cur);var b=$('.q-pick',o);if(b&&!b.classList.contains('q-plus'))b.textContent=cur?'Seçili':(m?'+ Plana koy':'Seç');});
    if(!m&&chg){var c=os.filter(function(o){return o.dataset.o===s.sel;})[0];if(c&&c.hidden){var vis=os.filter(function(o){return !o.hidden;});if(vis.length){vis[vis.length-1].hidden=true;}c.hidden=false;}}
    $('.q-oc',ow).textContent=chg?'Seçtiğin işaretli · tümü ve karşılaştırma Pano\'da':(avail.length>lim?('en iyi '+lim+' · tümü '+avail.length+', Pano\'da'):(avail.length+' seçenek'));
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
    if(s.mode==='arr'){bk++;var im=$('.q-arr img',it);if(im)th.push('<span class="q-th" style="--bc:#888"><img alt="" src="'+im.getAttribute('src')+'"></span>');return;}
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
function prepCount(){var sec=$('#cat-prep');if(!sec)return;var r=$$('.q-pr1',sec),d=r.filter(function(x){return x.classList.contains('done');}).length;var t=d+'/'+r.length+' hazır';$('.q-pcount',sec).textContent=t;$('.q-pc2',sec).textContent=t;$('.q-bar .bk',sec).style.width=(d/r.length*100)+'%';}
function all(){$$('.q-sec').forEach(function(sec){$$('.q-int',sec).forEach(render);renderCat(sec);});prepCount();}
function up(it){render(it);renderCat(it.closest('.q-sec'));}
function flash(el){if(!el)return;el.classList.remove('q-flash');void el.offsetWidth;el.classList.add('q-flash');}
function into(el){if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest',behavior:RM?'auto':'smooth'});}
var tt;function toast(m){var t=$('.q-toast');if(!t){t=document.createElement('div');t.className='q-toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true;},2400);}
function select(it,o,quiet){it.dataset.mode='sel';it.dataset.sel=o;it.classList.remove('chg');up(it);var f=$('.q-form[data-o="'+o+'"][data-f="sel"]',it);flash(f);if(!quiet){into(it);toast('Seçildi');}}
function pick(it,o){var s=S(it);if(multi(it)){if(s.picked.indexOf(o)<0){s.picked.push(o);setL(it,'picked',s.picked);}up(it);flash($('.q-form[data-o="'+o+'"][data-f="sel"]',it));toast('Plana eklendi');}else select(it,o);}
/* ---------- Pano ---------- */
var D=window.PANO||{cats:[]},SH=$('.q-sheetp'),SC=$('.q-scrim'),P={cat:'all',int:'',view:'grid',f:'*'},last=null;
function catOf(k){return D.cats.filter(function(c){return c.key===k;})[0];}
function intOf(id){var r=null;D.cats.forEach(function(c){c.ints.forEach(function(i){if(i.id===id)r=i;});});return r;}
function curSet(i){var el=document.getElementById(i.id);if(!el)return [];var s=S(el);return i.multi?s.picked:(s.mode==='sel'||s.mode==='booked'||s.mode==='ai'?[s.sel]:[]);}
function okF(o){return P.f==='*'||(P.f==='mine'?o.src!=='ai':o.src==='ai');}
function srcB(o){if(o.best)return '<span class="q-src best">✨ Önerimiz</span>';if(o.src==='ai')return '<span class="q-src ai">✨ AI önerisi</span>';if(o.src==='link')return '<span class="q-src mine">Senin linkin</span>';return '<span class="q-src mine"><i>'+o.who[0]+'</i>'+o.who+' ekledi</span>';}
function visual(o,big){return o.logo?'<span class="q-bigl" style="--bl:'+o.bc+';width:'+(big?84:72)+'px;height:'+(big?84:72)+'px;border-radius:'+(big?22:20)+'px;font-size:'+(big?22:20)+'px">'+esc(o.bg)+'</span>':'<img alt="" src="illus/'+o.img+'.png">';}
function likes(o){var on=o.likes.indexOf(ME)>-1;return '<button type="button" class="q-like'+(on?' on':'')+'" data-like="'+o.id+'" aria-pressed="'+on+'" title="'+(o.likes.length?esc(o.likes.join(', '))+' beğendi':'Beğen')+'">'+HEART+o.likes.length+'</button>'+(o.likes.length?'<span class="q-avs">'+o.likes.map(function(n){return '<i class="'+(n==='Emre'?'e':'')+'" title="'+esc(n)+'">'+n[0]+'</i>';}).join('')+'</span>':'');}
function act(i,o,cur){return '<button type="button" class="q-pick" data-pk="'+o.id+'" data-int="'+i.id+'">'+(cur?(i.multi?'Planda':'Seçili'):(i.multi?'+ Plana koy':'Seç'))+'</button>';}
function gridCard(i,o,cs){var cur=cs.indexOf(o.id)>-1;
  return '<article class="q-pg'+(cur?' cur':'')+'" style="--k:'+(catByInt(i.id).c)+'"><div class="q-ph'+(o.logo?' lg':'')+'">'+visual(o)+srcB(o)+(cur?'<span class="q-stc">'+(i.multi?'Planda':'Seçili')+'</span>':'')+'</div><div class="q-pgb">'+(o.logo?'':'<span class="q-brand" style="--bl:'+o.bc+';align-self:flex-start">'+esc(o.brand)+'</span>')+'<b>'+esc(o.nm)+'</b><small>'+esc(o.sub)+'</small><span class="q-pr"><b>'+esc(o.price||'—')+'</b><small>'+esc(o.unit)+'</small></span><div class="q-pgf">'+likes(o)+act(i,o,cur)+'</div></div></article>';}
function catByInt(id){var r=null;D.cats.forEach(function(c){c.ints.forEach(function(i){if(i.id===id)r=c;});});return r;}
function cmpCol(i,o,cs){var cur=cs.indexOf(o.id)>-1;
  var mc=o.match.map(function(x){return '<span class="q-mc '+(x[1]?'y':'n')+'">'+(x[1]?'✓ ':'✕ ')+esc(x[0])+'</span>';}).join('');
  var meta=[];if(o.rate)meta.push('<span class="q-rate"><b class="q-rb'+(o.rate.indexOf('★')===0?' star':'')+'">'+esc(o.rate)+'</b><span>'+esc(o.rev)+'</span></span>');if(o.cancel)meta.push('<span class="q-cw '+o.ccls+'">'+esc(o.cancel)+'</span>');if(o.bag)meta.push('<span class="q-bg">'+esc(o.bag)+'</span>');
  return '<article class="q-col'+(cur?' cur':'')+'" style="--k:'+catByInt(i.id).c+'"><div class="q-ph">'+visual(o,1)+srcB(o)+(cur?'<span class="q-stc">Şu an '+(i.multi?'planda':'seçili')+'</span>':'')+'</div><div class="q-colb"><div class="q-colh"><span class="q-brand" style="--bl:'+o.bc+';justify-self:start">'+esc(o.brand)+'</span><b>'+esc(o.nm)+'</b><small>'+esc(o.sub)+'</small></div>'
   +'<div class="q-colp"><span class="q-pr big"><b>'+esc(o.price||'—')+'</b><small>'+esc(o.unit)+' · '+esc(o.tot)+'</small></span>'+(o.tag?'<span class="q-tag">'+esc(o.tag)+'</span>':'')+'</div>'
   +(mc?'<div class="q-mcs" title="Niyetine uyuyor mu">'+mc+'</div>':'')
   +'<div class="q-pc"><div class="pp"><small>Artılar</small><ul class="q-pl p">'+(o.pros.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')||'<li class="q-na">—</li>')+'</ul></div><div class="mm"><small>Eksiler</small><ul class="q-pl m">'+(o.cons.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')||'<li class="q-na">—</li>')+'</ul></div></div>'
   +(meta.length?'<div class="q-colm">'+meta.join('')+'</div>':'')
   +'<div class="q-colf">'+likes(o)+'<a class="q-srcl" href="#" onclick="return false">'+esc(o.brand)+' ↗</a>'+act(i,o,cur)+'</div></div></article>';}
function cnt(c){return c.ints.reduce(function(b,i){return b+i.opts.length;},0);}
function renderPano(){
  var all=D.cats.reduce(function(a,c){return a+cnt(c);},0);
  var tabs='<button type="button" role="tab" data-cat="all" class="'+(P.cat==='all'?'on':'')+'">Tümü <i>'+all+'</i></button>';
  D.cats.forEach(function(c){var n=cnt(c);if(!n)return;tabs+='<button type="button" role="tab" data-cat="'+c.key+'" class="'+(P.cat===c.key?'on':'')+'">'+esc(c.name.split(' ')[0])+' <i>'+n+'</i></button>';});
  $('.q-ctabs',SH).innerHTML=tabs;
  // kenar menü: kategori > niyet
  var side='<button type="button" class="q-si top'+(P.cat==='all'?' on':'')+'" data-cat="all">Tümü <i>'+all+'</i></button>';
  D.cats.forEach(function(c){if(!cnt(c))return;side+='<div class="q-sg"><button type="button" class="q-sgh'+(P.cat===c.key&&!P.int?' on':'')+'" data-cat="'+c.key+'"><span class="d" style="--c:'+c.c+'"></span>'+esc(c.name)+'<i>'+cnt(c)+'</i></button>'+c.ints.map(function(i){var el=document.getElementById(i.id),st=el?el.dataset.st:'';return '<button type="button" class="q-si'+(P.int===i.id?' on':'')+'" data-int="'+i.id+'" data-cat2="'+c.key+'"><span class="q-sd '+(st==='ok'?'ok':(st==='sel'||st==='plan')?'sel':st==='ai'?'ai':'')+'"></span>'+esc(i.nm)+'<i>'+i.opts.length+'</i></button>';}).join('')+'</div>';});
  $('.q-side',SH).innerHTML=side;
  var sw=$('.q-sw',SH),c=catOf(P.cat);
  sw.innerHTML=c?('<button type="button" data-int="" class="'+(P.int?'':'on')+'">Hepsi</button>'+c.ints.map(function(i){var el=document.getElementById(i.id),d=el?el.dataset.st:'';return '<button type="button" data-int="'+i.id+'" class="'+(P.int===i.id?'on':'')+'"><span class="d '+(d==='ok'?'ok':(d==='sel'||d==='plan'||d==='ai')?'sel':'')+'"></span>'+esc(i.nm)+' <i>'+i.opts.length+'</i></button>';}).join('')):'<span class="q-swh">Tüm kategorilerden son eklenenler</span>';
  $('.q-srcsel select',SH).value=P.f;
  var sc=$('.q-sc',SH),html='';
  if(P.int){var i=intOf(P.int),cs=curSet(i),os=i.opts.filter(okF);
    html='<div class="q-gh big"><b>'+esc(i.nm)+'</b><small>'+esc(i.word)+' · '+esc(i.vals)+'</small><span class="q-sp"></span><small>'+os.length+' seçenek yan yana</small></div>'+(os.length?'<div class="q-cmp2">'+os.map(function(o){return cmpCol(i,o,cs);}).join('')+'</div>':'<div class="q-pempty">Bu süzgeçte seçenek yok.</div>');}
  else{var cats=P.cat==='all'?D.cats:[c];
    cats.forEach(function(cc){cc.ints.forEach(function(i){var os=i.opts.filter(okF);if(!os.length)return;var cs=curSet(i);
      html+='<section class="q-grp"><div class="q-gh"><b>'+esc(i.nm)+'</b><small>'+esc(P.cat==='all'?cc.name.split(' ')[0]+' · ':'')+esc(i.vals)+' · '+os.length+' kayıt</small><span class="q-sp"></span>'+(i.opts.length>1?'<button type="button" class="q-dact" data-int="'+i.id+'" data-cat2="'+cc.key+'">Karşılaştır ›</button>':'')+'</div><div class="q-pgrid">'+os.map(function(o){return gridCard(i,o,cs);}).join('')+'</div></section>';});});
    if(!html)html='<div class="q-pempty">Bu süzgeçte kayıt yok.</div>';}
  sc.innerHTML=html;sc.scrollTop=0;
}
function openPano(cat,int,view){P.cat=cat||'all';P.int=int||'';P.f='*';last=document.activeElement;renderPano();SH.hidden=false;SC.hidden=false;document.documentElement.style.overflow='hidden';var x=$('.q-x',SH);x&&x.focus();}
function closePano(){SH.hidden=true;SC.hidden=true;document.documentElement.style.overflow='';if(last&&last.focus)last.focus();}
function scenario(k){$$('.q-int').forEach(function(i){var x=JSON.parse(i.dataset.init);i.classList.remove('chg','skip');
  if(k==='fresh'){if(x.mode==='arr'){i.dataset.mode='arr';}else if(!multi(i)&&x.best){i.dataset.mode='ai';i.dataset.sel=x.best;}else{i.dataset.mode='opts';i.dataset.sel='';}i.dataset.picked='';i.dataset.booked='';}
  else{i.dataset.mode=x.mode;i.dataset.sel=x.sel;i.dataset.picked=x.picked.join(',');i.dataset.booked=x.booked.join(',');}});all();}
document.addEventListener('click',function(e){
  var el=e.target.closest('button,a');if(!el)return;
  if(el.closest('.q-ctrl')){var g=el.closest('.g');if(!g)return;$$('button',g).forEach(function(b){b.classList.toggle('on',b===el);});
    if(el.dataset.scn)scenario(el.dataset.scn);
    if(el.dataset.h){R.classList.remove('hA','hB','hC');R.classList.add('h'+el.dataset.h);mini();}
    if(el.dataset.p){R.classList.remove('pA','pB');R.classList.add('p'+el.dataset.p);if(!SH.hidden)renderPano();}
    return;}
  if(el.classList.contains('h-exp')){var hm=$('.hC .h-more');hm.hidden=!hm.hidden;el.setAttribute('aria-expanded',String(!hm.hidden));el.classList.toggle('on',!hm.hidden);return;}
  if(el.classList.contains('h-next')){var t=document.getElementById('cat-stay');if(t&&!t.classList.contains('open'))$('.q-row1',t).click();setTimeout(function(){var k=document.getElementById('int-s2');k&&k.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});flash(k);},60);return;}
  if(el.closest('.h-hero')&&el.classList.contains('h-lnk')){toast('Prototip');return;}
  if(el.classList.contains('h-pdf')){toast('PDF hazırlanıyor (prototip)');return;}
  if(el.closest('.view-tabs')&&/Pano/.test(el.textContent)){e.preventDefault();openPano('all','', 'grid');return;}
  if(el.closest('.q-sheetp')){
    if(el.classList.contains('q-x')){closePano();return;}
    if(el.dataset.like){var id=el.dataset.like;D.cats.forEach(function(c){c.ints.forEach(function(i){i.opts.forEach(function(o){if(o.id===id){var k=o.likes.indexOf(ME);if(k>-1)o.likes.splice(k,1);else o.likes.push(ME);}});});});renderPano();return;}
    if(el.dataset.pk){var it=document.getElementById(el.dataset.int);if(multi(it)){pick(it,el.dataset.pk);renderPano();}else{select(it,el.dataset.pk,true);renderPano();toast('Seçildi · plana yansıdı');}return;}
    if(el.dataset.int!==undefined){if(el.dataset.int){P.int=el.dataset.int;if(el.dataset.cat2)P.cat=el.dataset.cat2;}else P.int='';renderPano();return;}
    if(el.dataset.cat){P.cat=el.dataset.cat;P.int='';renderPano();return;}
    return;}
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
  if(el.classList.contains('q-pano')){openPano(it.closest('.q-sec').id.replace('cat-',''),it.id,'cmp');return;}
  if(el.classList.contains('q-chg')){if(!opts(it).length){toast('Bu ihtiyaç için seçenek yok; sohbete link at ya da AI\'dan iste');return;}it.classList.add('chg');up(it);into($('.q-opts',it));return;}
  if(el.classList.contains('q-cancel')){it.classList.remove('chg');up(it);return;}
  if(el.classList.contains('q-take')){var fo=el.closest('.q-form').dataset.o;select(it,fo);return;}
  if(el.classList.contains('q-pick')){e.preventDefault();pick(it,el.closest('.q-opt').dataset.o);return;}
  if(el.classList.contains('q-got')){var go=el.closest('.q-form').dataset.o;if(multi(it)){if(s.booked.indexOf(go)<0){s.booked.push(go);setL(it,'booked',s.booked);}}else it.dataset.mode='booked';up(it);toast('Alındı olarak işaretlendi');return;}
  if(el.classList.contains('q-rm')){var ro=el.closest('.q-form').dataset.o;setL(it,'picked',s.picked.filter(function(x){return x!==ro;}));setL(it,'booked',s.booked.filter(function(x){return x!==ro;}));up(it);toast('Plandan çıkarıldı');return;}
  if(el.classList.contains('q-inf')){var d=$('.q-det',el.closest('.q-form'));if(d){d.hidden=!d.hidden;el.setAttribute('aria-expanded',String(!d.hidden));}return;}
  if(el.classList.contains('q-x2')||el.classList.contains('q-skip')){it.classList.add('skip');it.classList.remove('chg');up(it);toast('Gerek yok dendi · Geri al');return;}
  if(el.classList.contains('q-undo')){it.classList.remove('skip');up(it);return;}
  if(el.classList.contains('q-cp')){toast('Kopyalandı');return;}
  if(el.classList.contains('q-doc')){toast('Bilet ya da onay dosyasını ekle (PDF, görsel)');return;}
  if(el.classList.contains('q-dact')){toast(el.textContent+' (prototip)');return;}
  if(el.classList.contains('q-ai')){toast('AI bu ihtiyaç için seçenek arıyor (prototip)');return;}
});
SC.addEventListener('click',closePano);
$('.q-srcsel select',SH).addEventListener('change',function(e){P.f=e.target.value;renderPano();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!SH.hidden)closePano();});
var MB=$('.h-mini');
function mini(){var hero=$$('.h-hero').filter(function(x){return x.offsetParent!==null;})[0];if(!hero||!MB)return;var r=hero.getBoundingClientRect();MB.classList.toggle('on',r.bottom<40);}
window.addEventListener('scroll',mini,{passive:true});
all();mini();
var h=(location.hash||'').replace('#','');if(h.indexOf('ac-')===0){var sx=document.getElementById('cat-'+h.slice(3));if(sx)sx.classList.add('open');}
window.__q={all:all,openPano:openPano,scenario:scenario};
})();
