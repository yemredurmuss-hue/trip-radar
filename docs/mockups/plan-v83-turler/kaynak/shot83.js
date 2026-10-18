const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
const SP=process.argv[2], W=+(process.argv[3]||1440), PG=process.argv[4]||'artifact', O=SP+'/v83/', S=O+'shots/';
require('fs').mkdirSync(S,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:W,height:1000},deviceScaleFactor:W<700?2:1}); const errs=[];
 p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('file://'+O+PG+'-full.html'); await p.waitForTimeout(900);
 const ev=(f,a)=>p.evaluate(f,a);
 const T=PG+'-'+W;
 await ev(()=>document.querySelector('.q-ctrl').style.visibility='hidden');
 await p.screenshot({path:S+'top-'+T+'.png'});
 const sh=async(n,sel)=>{const el=await p.$(sel);if(!el){console.log('yok',sel);return;}await el.screenshot({path:S+n+'-'+T+'.png'});};
 // menü
 await ev(()=>document.querySelector('.x-tmb').click());await p.waitForTimeout(250);await p.screenshot({path:S+'menu-'+T+'.png',clip:{x:0,y:0,width:W,height:700}});
 await ev(()=>document.body.click());
 const scroller=await ev(()=>{const pn=document.querySelector('main.panel');return pn.scrollHeight>pn.clientHeight+5;});
 for(const k of ['flight','stay','transport','activity','todo','other','prep']){const ok=await ev(k=>{const s=document.querySelector('#cat-'+k);if(!s)return false;if(!s.classList.contains('open'))s.querySelector('.q-row1').click();return true;},k);if(!ok)continue;await p.waitForTimeout(450);await sh('o-'+k,'#cat-'+k);}
 // senaryolar
 const scn=await ev(()=>[...document.querySelectorAll('.q-ctrl [data-scn]')].map(b=>b.dataset.scn));
 for(const k of scn){ if(k==='init')continue;
   await ev(k=>document.querySelector('.q-ctrl [data-scn="'+k+'"]').click(),k);await p.waitForTimeout(500);
   await ev(()=>{document.querySelector('main.panel').scrollTop=0;window.scrollTo(0,0);});await p.waitForTimeout(200);
   await p.screenshot({path:S+'scn-'+k+'-'+T+'.png'});
   if(k==='durum'){for(const id of ['s4','e2','d2']){await ev(id=>{const i=document.getElementById('int-'+id);const s=i.closest('.q-sec');if(!s.classList.contains('open'))s.querySelector('.q-row1').click();},id);await p.waitForTimeout(400);await sh('durum-'+id,'#int-'+id);}
     const ha=await ev(()=>!!document.querySelector('[data-arrive]'));if(ha){await ev(()=>{const s=document.querySelector('#cat-stay');if(!s.classList.contains('open'))s.querySelector('.q-row1').click();document.querySelector('[data-arrive]').click();});await p.waitForTimeout(700);await sh('arrive','#int-s4');}}
   if(k==='flight'){await ev(()=>{document.querySelector('.q-seg [data-view="cat"]').click();const s=document.querySelector('#cat-flight');if(!s.classList.contains('open'))s.querySelector('.q-row1').click();});await p.waitForTimeout(400);await sh('flight-f2','#int-f2');}
   if(k==='today'){await sh('trip-today','.q-trip');}
 }
 await ev(()=>document.querySelector('.q-ctrl [data-scn="init"]').click());await p.waitForTimeout(300);
 // Pano belgeler
 await ev(()=>{document.querySelector('.x-tmb').click();document.querySelector('.x-tmi[data-tm="docs"]').click();});await p.waitForTimeout(500);await p.screenshot({path:S+'docs-'+T+'.png'});
 await ev(()=>document.querySelector('.q-sheetp .q-x').click());
 // Gerek yok → Gizlenenler
 await ev(()=>{const s=document.querySelector('#cat-other');if(!s.classList.contains('open'))s.querySelector('.q-row1').click();document.querySelector('#int-d2 .q-x2').click();});await p.waitForTimeout(400);await sh('hid','#cat-other');
 await ev(()=>{document.querySelector('#cat-other .q-hid').open=true;});await p.waitForTimeout(200);await sh('hid-open','#cat-other');
 await ev(()=>document.querySelector('#int-d2 .q-undo').click());
 // sohbet
 await sh('chat','section.chat');
 const ov=await ev(()=>document.documentElement.scrollWidth>innerWidth);
 const hs=await ev(()=>Array.from(document.querySelectorAll('.q-int.z-int')).filter(i=>!i.classList.contains('multi')).map(i=>{const s=i.closest('.q-sec');const was=s.classList.contains('open');s.classList.add('open');const h=Math.round(i.getBoundingClientRect().height);if(!was)s.classList.remove('open');return i.id+':'+i.dataset.st+':'+h;}));
 const nx=await ev(()=>window.__q.nextLabel());
 console.log(PG,W,'overflow',ov,'errors',JSON.stringify(errs),'next',nx);console.log(hs.join(' '));
 await b.close();})();
