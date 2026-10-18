const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
const SP=process.argv[2], W=+(process.argv[3]||1440), O=SP+'/v81/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const p=await b.newPage({viewport:{width:W,height:1000}}); const errs=[];
 p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('file://'+O+'index.html'); await p.waitForTimeout(700);
 await p.evaluate(()=>document.querySelector('.q-ctrl').style.visibility='hidden');
 const sh=async(n,sel)=>{const el=await p.$(sel);await el.screenshot({path:O+n+'-'+W+'.png'});};
 const ev=(f,a)=>p.evaluate(f,a);
 for(const h of ['M','S','K']){await ev(h=>{const r=document.getElementById('root');r.classList.remove('hM','hS','hK');r.classList.add('h'+h);},h);await p.waitForTimeout(150);await sh('hero'+h,'.panel');}
 await ev(()=>{const r=document.getElementById('root');r.classList.remove('hS','hK');r.classList.add('hM');});
 for(const k of ['activity','stay','flight','transport']){await ev(k=>document.querySelector('#cat-'+k+' .q-row1').click(),k);await p.waitForTimeout(250);await sh('o-'+k,'#cat-'+k);}
 await ev(()=>{document.querySelector('.h-mini').style.display='none';document.querySelector('.q-seg [data-view="trip"]').click();}); await p.waitForTimeout(300); await sh('trip','.q-trip'); await ev(()=>document.querySelector('.h-mini').style.display='');
 await ev(()=>document.querySelector('.q-seg [data-view="cat"]').click());
 await ev(()=>document.querySelector('.view-tabs button:nth-child(2)').click()); await p.waitForTimeout(300); await p.screenshot({path:O+'pano-all-'+W+'.png'});
 await ev(()=>document.querySelector('.q-side [data-v="mine"]').click()); await p.waitForTimeout(200); await p.screenshot({path:O+'pano-mine-'+W+'.png'});
 await ev(()=>document.querySelector('.q-side [data-int="int-s1"]').click()); await p.waitForTimeout(200); await p.screenshot({path:O+'pano-s1-'+W+'.png'});
 await ev(()=>document.querySelector('.q-side [data-int="int-f2"]').click()); await p.waitForTimeout(200); await p.screenshot({path:O+'pano-f2-'+W+'.png'});
 await ev(()=>document.querySelector('.q-side [data-int="int-e1"]').click()); await p.waitForTimeout(200); await p.screenshot({path:O+'pano-e1-'+W+'.png'});
 await ev(()=>document.querySelector('.q-side [data-v="ilham"]').click()); await p.waitForTimeout(200); await p.screenshot({path:O+'pano-ilham-'+W+'.png'});
 const ov=await ev(()=>document.documentElement.scrollWidth>innerWidth);
 console.log(W,'overflow',ov,'errors',JSON.stringify(errs)); await b.close();})();
