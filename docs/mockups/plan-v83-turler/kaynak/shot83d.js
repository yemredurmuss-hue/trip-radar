const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
const SP=process.argv[2], O=SP+'/v83/', S=O+'shots/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [pg,W] of [['artifact',1440],['ozora',1440],['artifact',390]]){const p=await b.newPage({viewport:{width:W,height:1000},deviceScaleFactor:W<700?2:1});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+O+pg+'-full.html');await p.waitForTimeout(700);await p.evaluate(()=>{document.querySelector('.q-ctrl').style.visibility='hidden';const m=document.querySelector('.h-mini');if(m)m.style.display='none';});
 await p.evaluate(()=>{const s=document.querySelector('#cat-prep');s.querySelector('.q-row1').click();});await p.waitForTimeout(400);
 await (await p.$('#cat-prep')).screenshot({path:S+'prep-'+pg+'-'+W+'.png'});
 await p.evaluate(()=>{document.querySelector('.q-bv').open=true;});await p.waitForTimeout(300);
 await (await p.$('#cat-prep')).screenshot({path:S+'bavul-'+pg+'-'+W+'.png'});
 const k=pg==='ozora'?'stay':'transport';
 await p.evaluate(k=>{const s=document.querySelector('#cat-'+k);s.querySelector('.q-row1').click();},k);await p.waitForTimeout(400);
 await p.screenshot({path:S+'info-'+pg+'-'+W+'.png'});
 if(pg==='artifact'&&W>700){await p.evaluate(()=>{window.scrollTo(0,0);document.querySelector('main.panel').scrollTop=0;document.querySelector('.x-budb').click();});await p.waitForTimeout(300);await p.screenshot({path:S+'bud-'+W+'.png',clip:{x:400,y:300,width:1040,height:600}});}
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);console.log(pg,W,'ov',ov,JSON.stringify(errs));await p.close();}
 await b.close();})();
