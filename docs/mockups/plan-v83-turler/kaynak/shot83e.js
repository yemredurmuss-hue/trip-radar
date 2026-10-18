const { chromium } = require('/home/user/trip-radar/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const p=await b.newPage({viewport:{width:1440,height:1000}});
 await p.goto('file://'+process.argv[2]+'/v83/turler.html');await p.waitForTimeout(400);
 await p.screenshot({path:process.argv[2]+'/v83/shots/tur-top.png'});
 const nm=await p.$$('.t-card.nm');await nm[0].screenshot({path:process.argv[2]+'/v83/shots/tur-nm.png'});
 await (await p.$('#t-dive')).screenshot({path:process.argv[2]+'/v83/shots/tur-dive2.png'});await b.close();})();
