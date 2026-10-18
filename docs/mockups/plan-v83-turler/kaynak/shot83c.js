const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
const SP=process.argv[2], O=SP+'/v83/', S=O+'shots/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const W of [1440,390]){const p=await b.newPage({viewport:{width:W,height:1000},deviceScaleFactor:W<700?2:1});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+O+'turler.html');await p.waitForTimeout(500);
 await p.screenshot({path:S+'turler-'+W+'.png',fullPage:W>700});
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);console.log(W,'ov',ov,errs);
 if(W>700){for(const k of ['dive','day','cruise']){const el=await p.$('#t-'+k);await el.screenshot({path:S+'turler-'+k+'.png'});}}
 await p.close();}
 await b.close();})();
