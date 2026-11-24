// Lightning Lane task card (row 73, mockup screen "Task"): on the Now tab, only when booking is allowed. "Book next: X · aim ~time",
// from the plan's due bookings first, else the best free Multi Pass slot. Sim day: books the return shown. Real day: "I booked it"
// → enter the return time (openLLEnter). "Not now" snoozes it until a pass is used or 20 min pass. The old book buttons are gone
// from the plan view; the card's buttons are tappable (not under the Now card).
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);
const card=()=>pg.evaluate(async()=>{WDW.pvRefresh(true);await new Promise(r=>setTimeout(r,150));const c=document.querySelector('#pvIn #llTask');
  const hit=s=>{const b=c&&c.querySelector(s);if(!b)return false;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e===b||b.contains(e)};
  return{on:!!c,txt:c?c.innerText.replace(/\s+/g,' '):'',book:hit('[data-llt="book"]'),later:hit('[data-llt="later"]'),oldBk:!!document.querySelector('#pvIn [data-bk]'),rid:c?c.querySelector('[data-llt="book"]').dataset.rid:null}});
const setup=extra=>pg.evaluate(extra=>{const G=WDW.G;G.segs=null;G.trip=null;G.tripEnd=null;G.LL.passes=[];G.LL.used=0;WDW.LLT.dis={};G.plan.res.steps.forEach(s=>{s.books=[]});new Function('G','WDW',extra)(G,WDW)},extra||'');

// 1) no Multi Pass: no card
await setup("G.LL.mp=null;");let c=await card();out.c1=c;ck(!c.on&&!c.oldBk,'card without a Multi Pass '+JSON.stringify(c));
// 2) Multi Pass, nothing planned: the best free slot, tappable; sim day books the return shown
await setup("G.LL.mp='MK';G.LL.tapped=true;");c=await card();out.c2=c;
ck(c.on&&/you have a free Lightning Lane slot/i.test(c.txt)&&/Book .+ Aim for about \d+:\d\d [AP]M/.test(c.txt)&&/Book · returns/.test(c.txt)&&c.book&&c.later&&!c.oldBk,'free-slot task card '+JSON.stringify(c));
out.b2=await pg.evaluate(async rid=>{const ret=WDW.llNext(WDW.RIDE_BY[rid],WDW.G.t);document.querySelector('#pvIn [data-llt="book"]').click();await new Promise(r=>setTimeout(r,200));
  const p=WDW.G.LL.passes.find(p=>p.rid===rid);return{p:p&&[p.st,p.start],ret}},c.rid);
ck(out.b2.p&&out.b2.p[0]==='active'&&out.b2.p[1]===out.b2.ret,'sim book did not book the shown return '+JSON.stringify(out.b2));
// 3) booking not allowed (holding 3): no card
await setup("G.LL.mp='MK';G.LL.tapped=true;['tron','sdmt','hm'].forEach((rid,i)=>G.LL.passes.push({id:9900+i,rid,type:WDW.RIDE_BY[rid].llType,start:780+60*i,end:840+60*i,st:'active'}));G.LL.passes.forEach(p=>p.type='mp');G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+150}];");
c=await card();out.c3=c;ck(!c.on,'card while holding 3 '+JSON.stringify(c));
// 4) the plan's own booking comes first, with its aim time
await setup("G.LL.mp='MK';G.LL.tapped=true;G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+150}];");c=await card();out.c4=c;
const aim=await pg.evaluate(()=>{const r=WDW.RIDE_BY.btm,ret=Math.round(WDW.G.t)+150;return Math.max(ret,WDW.llNext(r,WDW.G.t))});
out.aim=aim;ck(c.on&&c.rid==='btm'&&/you can book another/i.test(c.txt)&&/Book Big Thunder/.test(c.txt),'planned booking card '+JSON.stringify(c));
out.aimTxt=await pg.evaluate(a=>{const h=Math.floor(a/60)%12||12,m=String(a%60).padStart(2,'0');return h+':'+m},aim);ck(c.txt.includes('Aim for about '+out.aimTxt),'aim time not the plan\'s return '+JSON.stringify([out.aimTxt,c.txt]));
// 5) Not now: snoozed (falls back to nothing or another ride, never btm), back after a pass is used, and after 20 min
const later=()=>pg.evaluate(()=>{const b=document.querySelector('#pvIn [data-llt="later"]');if(b)b.click();return !!b});
ck(await later(),'no Not now');c=await card();out.c5=c;ck(c.rid!=='btm','Not now did not snooze '+JSON.stringify(c));
await pg.evaluate(()=>{WDW.G.LL.used++});c=await card();out.c5b=c;ck(c.rid==='btm','not back after a pass was used '+JSON.stringify(c));
ck(await later(),'no Not now (2)');await pg.evaluate(()=>{WDW.G.t+=21});c=await card();out.c5c=c;ck(c.rid==='btm','not back after 20 min '+JSON.stringify(c));
// 6) Now tab only
out.plan=await pg.evaluate(async()=>{WDW.pvTab('plan');await new Promise(r=>setTimeout(r,200));const on=!!document.querySelector('#pvIn #llTask');WDW.pvTab('now');return on});ck(!out.plan,'task card on the Plan tab');
// 7) real day: "I booked it" → enter the return time from Disney's app → pass held at that time
await lib.startDay(pg,'MK','plan','now');
out.real=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G;WDW.setView('plan');G.LL.mp='MK';G.LL.tapped=true;G.LL.passes=[];WDW.LLT.dis={};
  G.plan.res.steps.forEach(s=>{s.books=[]});G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+120}];WDW.pvRefresh(true);await w(200);
  const b=document.querySelector('#pvIn #llTask [data-llt="book"]');if(!b)return{none:document.querySelector('#pvIn').innerText.slice(0,200)};const label=b.innerText;b.click();await w(250);
  const inp=document.querySelector('#sheet #llT');if(!inp)return{label,noSheet:true};const t=Math.ceil((G.t+140)/5)*5;inp.value=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  document.querySelector('#sheet #llTok').click();await w(250);const p=G.LL.passes.find(p=>p.rid==='btm');WDW.pvRefresh(true);await w(150);
  return{label,t,p:p&&[p.st,p.start],gone:!document.querySelector('#pvIn #llTask [data-rid="btm"]')}});
ck(out.real.label==='I booked it'&&out.real.p&&out.real.p[0]==='active'&&out.real.p[1]===out.real.t&&out.real.gone,'real-day I booked it '+JSON.stringify(out.real));
return {fail,out};
