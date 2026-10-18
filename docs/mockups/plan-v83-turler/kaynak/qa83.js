const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
const O=process.argv[2]+'/v83/';
const AC=new Set(['IST','HND','KIX','BUD','SAW','HRG','PNR','JR','TK','QR','PDF','AI','VFS','ATM','AB','DPS','NRT','OD','GH','TC','VI','HF','BK','AIR','JL','QR','PC','OZ','UTC','ZTL','SOF','NBO','PC331','PC332','TK52','TK49','TK1035','TK1038','W64321','JL44','QR240','IC','KM','XL','GB','SMS','BB','A1B2C3','SC']);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const plan=[['artifact',['init','fresh','durum','flight','today']],['ozora',['init']],['turler',[null]]];
 for(const [pg,scns] of plan) for(const W of [1440,1280,860,390]){
  const p=await b.newPage({viewport:{width:W,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+O+(pg==='turler'?'turler.html':pg+'-full.html'));await p.waitForTimeout(600);
  for(const k of scns){
   if(k&&k!=='init'){await p.evaluate(k=>document.querySelector('.q-ctrl [data-scn="'+k+'"]').click(),k);await p.waitForTimeout(300);}
   // tüm kategorileri aç (denetim için)
   await p.evaluate(()=>{document.querySelectorAll('.q-sec').forEach(s=>s.classList.add('open'));const bv=document.querySelector('.q-bv');if(bv)bv.open=true;});
   await p.waitForTimeout(150);
   const r=await p.evaluate((AC)=>{const AC2=new Set(AC);const vis=e=>{const s=getComputedStyle(e);return e.offsetParent!==null&&s.visibility!=='hidden';};
     const out={};out.ov=document.documentElement.scrollWidth>innerWidth;
     out.broken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&vis(i)).map(i=>i.getAttribute('src')).slice(0,5);
     const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n,txt=[];while(n=walker.nextNode()){const pe=n.parentElement;if(!pe||['SCRIPT','STYLE'].includes(pe.tagName))continue;if(!vis(pe))continue;const t=n.nodeValue.trim();if(t)txt.push(t);}
     const all=txt.join(' | ');
     out.dash=(all.match(/.{0,30}—.{0,30}/g)||[]).slice(0,5);
     out.bad=(all.match(/.{0,20}(undefined|NaN|\bnull\b|\[object).{0,20}/g)||[]).slice(0,5);
     const caps=new Set();(all.match(/\b[A-ZÇĞİÖŞÜ]{3,}\b/g)||[]).forEach(w=>{if(!AC2.has(w)&&!/\d/.test(w))caps.add(w);});out.caps=[...caps].slice(0,20);
     out.noname=[...document.querySelectorAll('button')].filter(x=>vis(x)&&!x.textContent.trim()&&!x.getAttribute('aria-label')&&!x.getAttribute('title')).map(x=>x.className).slice(0,8);
     const ids={};document.querySelectorAll('[id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1;});out.dupid=Object.keys(ids).filter(k=>ids[k]>1).slice(0,8);
     const clip=[];document.querySelectorAll('#root *, .w *').forEach(e=>{if(!vis(e)||e.children.length>0)return;const s=getComputedStyle(e);if((s.overflow==='hidden'||s.textOverflow==='ellipsis')&&e.scrollWidth>e.clientWidth+2&&e.textContent.trim().length>3)clip.push(e.className+': '+e.textContent.trim().slice(0,40));});out.clip=clip.slice(0,14);out.nclip=clip.length;
     const hs=[...document.querySelectorAll('.q-int.z-int:not(.multi):not(.skip)')].filter(vis).map(i=>Math.round(i.getBoundingClientRect().height));out.h=[...new Set(hs)];
     return out;},[...AC]);
   console.log('##',pg,W,k||'',JSON.stringify({errs,...r}));
  }
  await p.close();}
 await b.close();})();
