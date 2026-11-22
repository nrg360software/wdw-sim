const {chromium}=require('/opt/npm-tools/node_modules/playwright');const fs=require('fs'),path=require('path');
const REPO=process.env.REPO||require('path').resolve(__dirname,'../..');const HTML=process.env.HTML||path.join(REPO,'index.html');const {build}=require('./fixture.js');const lib=require('./lib.js');
(async()=>{const [snip,shot]=process.argv.slice(2);const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});const pg=await ctx.newPage();const errs=[];const tpw=[];
 pg.on('pageerror',e=>errs.push(String(e.stack||e).slice(0,600)));pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,200))});
 await ctx.addInitScript(()=>{const RD=Date;let off=+(sessionStorage.getItem('__off')||0);
   class D extends RD{constructor(...a){if(a.length)super(...a);else super(RD.now()+off)}static now(){return RD.now()+off}}
   window.Date=D;window.setOrl=iso=>{off=RD.parse(iso)-RD.now();sessionStorage.setItem('__off',off)};window.adv=m=>{off+=m*60000;sessionStorage.setItem('__off',off)}});
 await ctx.addInitScript(lib.PAGE);
 await ctx.route('**/*',async r=>{const u=r.request().url();
   if(u.startsWith('https://wdw.test/')){let f=u.slice(17).split('?')[0]||'index.html';if(f==='index.html')return r.fulfill({body:fs.readFileSync(HTML),contentType:'text/html'});const fp=path.join(REPO,f);if(fs.existsSync(fp))return r.fulfill({body:fs.readFileSync(fp),contentType:({js:'application/javascript',json:'application/json',webmanifest:'application/manifest+json',png:'image/png'})[f.split('.').pop()]||'application/octet-stream'});return r.fulfill({status:200,body:'<html></html>',contentType:'text/html'})}
   const m=u.match(/three@0\.180\.0\/(.*)$/);if(m)return r.fulfill({body:fs.readFileSync(path.join(process.env.THREE_DIR||'/home/claude/t/node_modules/three',m[1])),contentType:'application/javascript'});
   const t=u.match(/api\.themeparks\.wiki\/v1\/entity\/([0-9a-f-]+)\/live/);if(t){const pk={'75ea578a-adc8-4116-a54d-dccb60765ef9':'MK','47f90d2c-e191-4239-a466-5892ef59a88b':'EP','288747d1-8b4f-4a64-867e-ea7c9b27bad8':'HS','1c84a229-8862-4648-9c71-378ddd2c7693':'AK'}[t[1]];tpw.push(pk);
     if(process.env.TPW==='fail')return r.abort('failed');const date=await pg.evaluate(()=>window.WDW?WDW.orlandoNow().date:null).catch(()=>null)||process.env.TPWDATE||'2026-11-22';
     return r.fulfill({body:JSON.stringify(build(pk,process.env.TPWDATE||date)),contentType:'application/json',headers:{'access-control-allow-origin':'*'}})}
   if(u.includes('workers.dev'))return r.fulfill({status:503,body:''});return r.fulfill({status:200,body:'<html></html>',contentType:'text/html'})});
 if(process.env.ORL){await pg.goto('https://wdw.test/blank');await pg.evaluate(iso=>{window.setOrl(iso)},process.env.ORL)}
 await pg.goto('https://wdw.test/');await pg.waitForFunction(()=>window.WDW&&window.WDW.scene,null,{timeout:120000});
 const fn=new Function('pg','tpw','lib','return (async()=>{'+fs.readFileSync(snip,'utf8')+'})()');let out;try{out=await fn(pg,tpw,lib)}catch(e){out='SNIPPET ERROR '+e.stack}
 console.log(typeof out==='string'?out:JSON.stringify(out,null,1));if(shot)await pg.screenshot({path:shot});const bad=errs.filter(e=>!/503|unknown error occurred when fetching the script|test boom/.test(e));console.log('ERRORS:',bad);
 if(bad.length||(typeof out==='string'&&out.startsWith('SNIPPET ERROR'))||(out&&out.fail&&out.fail.length))process.exitCode=1;await b.close()})();
