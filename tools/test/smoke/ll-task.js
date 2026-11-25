// Lightning Lane task card (row 73, mockup screen "Task"): pinned above the Now card on every tab (Nick, Nov 24), only when booking is allowed. "Book next: X · aim ~time",
// from the plan's due bookings first, else the best free Multi Pass slot. Sim day: books the return shown. Real day: "I booked it"
// → enter the return time (openLLEnter). "Not now" snoozes it until a pass is used or 20 min pass. The old book buttons are gone
// from the plan view; the card's buttons are tappable (not under the Now card).
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);
const card=()=>pg.evaluate(async()=>{WDW.pvRefresh(true);await new Promise(r=>setTimeout(r,150));const c=document.querySelector('#pvNow #llTask');
  const hit=s=>{const b=c&&c.querySelector(s);if(!b)return false;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e===b||b.contains(e)};
  return{on:!!c,txt:c?c.innerText.replace(/\s+/g,' '):'',book:hit('[data-llt="book"]'),later:hit('[data-llt="later"]'),oldBk:!!document.querySelector('#pvIn [data-bk],#pvIn #llTask'),rid:c?c.querySelector('[data-llt="book"]').dataset.rid:null}});
const setup=extra=>pg.evaluate(extra=>{const G=WDW.G;G.segs=null;G.trip=null;G.tripEnd=null;G.LL.passes=[];G.LL.used=0;WDW.LLT.dis={};G.plan.res.steps.forEach(s=>{s.books=[]});new Function('G','WDW',extra)(G,WDW)},extra||'');

// 1) no Multi Pass: no card
await setup("G.LL.mp=null;");let c=await card();out.c1=c;ck(!c.on&&!c.oldBk,'card without a Multi Pass '+JSON.stringify(c));
// 2) Multi Pass, nothing planned: the best free slot, tappable; sim day books the return shown
await setup("G.LL.mp='MK';G.LL.tapped=true;");c=await card();out.c2=c;
out.c2pk=await pg.evaluate(rid=>WDW.RIDE_BY[rid].pk,c.rid);ck(out.c2pk==='MK','free slot suggested a ride outside the plan\'s park (from the resort, MK plan) '+out.c2pk+' '+c.rid);
ck(c.on&&/free Lightning Lane slot/i.test(c.txt)&&/Book .+ Aim for about \d+:\d\d [AP]M/.test(c.txt)&&/Book · ~\d/.test(c.txt)&&c.book&&c.later&&!c.oldBk,'free-slot task card '+JSON.stringify(c));
// sim day too: Book asks for the time actually booked (Nick, Nov 24), prefilled with the prediction; a later time is kept as entered
out.b2=await pg.evaluate(async rid=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),ret=WDW.llNext(WDW.RIDE_BY[rid],WDW.G.t);document.querySelector('#pvNow [data-llt="book"]').click();await w(200);
  const inp=document.querySelector('#sheet:not([hidden]) #llT');if(!inp)return{noSheet:true,passes:WDW.G.LL.passes.length};const pre=inp.value,t=ret+30;inp.value=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  document.querySelector('#sheet #llTok').click();await w(250);const p=WDW.G.LL.passes.find(p=>p.rid===rid);const hh=String(Math.floor(ret/60)).padStart(2,'0')+':'+String(ret%60).padStart(2,'0');
  return{pre,hh,t,p:p&&[p.st,p.start]}},c.rid);
ck(!out.b2.noSheet&&out.b2.pre===out.b2.hh&&out.b2.p&&out.b2.p[0]==='active'&&out.b2.p[1]===out.b2.t,'sim Book: no time box / not prefilled with the prediction / booked time not kept '+JSON.stringify(out.b2));
// 3) booking not allowed (holding 3): no card
await setup("G.LL.mp='MK';G.LL.tapped=true;['tron','sdmt','hm'].forEach((rid,i)=>G.LL.passes.push({id:9900+i,rid,type:WDW.RIDE_BY[rid].llType,start:780+60*i,end:840+60*i,st:'active'}));G.LL.passes.forEach(p=>p.type='mp');G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+150}];");
c=await card();out.c3=c;ck(!c.on,'card while holding 3 '+JSON.stringify(c));
// 4) the plan's own booking comes first, with its aim time
await setup("G.LL.mp='MK';G.LL.tapped=true;G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+150}];");c=await card();out.c4=c;
const aim=await pg.evaluate(()=>{const r=WDW.RIDE_BY.btm,ret=Math.round(WDW.G.t)+150;return Math.max(ret,WDW.llNext(r,WDW.G.t))});
out.aim=aim;ck(c.on&&c.rid==='btm'&&/you can book another/i.test(c.txt)&&/Book Big Thunder/.test(c.txt),'planned booking card '+JSON.stringify(c));
out.aimTxt=await pg.evaluate(a=>{const h=Math.floor(a/60)%12||12,m=String(a%60).padStart(2,'0');return h+':'+m},aim);ck(c.txt.includes('Aim for about '+out.aimTxt),'aim time not the plan\'s return '+JSON.stringify([out.aimTxt,c.txt]));
// 5) Not now: snoozed (falls back to nothing or another ride, never btm), back after a pass is used, and after 20 min
const later=()=>pg.evaluate(()=>{const b=document.querySelector('#pvNow [data-llt="later"]');if(b)b.click();return !!b});
ck(await later(),'no Not now');c=await card();out.c5=c;ck(c.rid!=='btm','Not now did not snooze '+JSON.stringify(c));
await pg.evaluate(()=>{WDW.G.LL.used++});c=await card();out.c5b=c;ck(c.rid==='btm','not back after a pass was used '+JSON.stringify(c));
ck(await later(),'no Not now (2)');await pg.evaluate(()=>{WDW.G.t+=21});c=await card();out.c5c=c;ck(c.rid==='btm','not back after 20 min '+JSON.stringify(c));
// 6) always visible like the Now card: on every tab, right above it, buttons tappable, not under the dock
out.tabs=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),o={};for(const k of ['plan','waits','now']){WDW.pvTab(k);await w(250);const c=document.querySelector('#pvNow #llTask'),n=document.getElementById('ncard'),b=c&&c.querySelector('[data-llt="book"]');
  let hit=false;if(b){const q=b.getBoundingClientRect(),e=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);hit=e===b||b.contains(e)}
  o[k]={on:!!c,above:!!(c&&n&&c.getBoundingClientRect().bottom<=n.getBoundingClientRect().top+1),hit,inPage:!!document.querySelector('#pvIn #llTask')}}return o});
ck(['plan','waits','now'].every(k=>out.tabs[k].on&&out.tabs[k].above&&out.tabs[k].hit&&!out.tabs[k].inPage),'task card not pinned on every tab '+JSON.stringify(out.tabs));
// 6b) purple for using a Lightning Lane too: the Now card for a step that uses a held pass is purple (card + button), standby isn't
out.purple=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G;G.LL.passes=[];WDW.pvRefresh(true);await w(150);
  const rd=()=>{const n=document.getElementById('ncard'),b=n&&n.querySelector('.ncgo');return{ll:!!(n&&n.classList.contains('ll')),btn:b?b.className:'',tag:n?n.querySelector('.nct').innerText:''}};const a=rd();
  const g=document.querySelector('#pvNow [data-nc="go"]'),rid=WDW.G.plan.res.steps[WDW.dpProgress().next].rid;
  G.LL.passes.push({id:9990,rid,type:WDW.RIDE_BY[rid].llType||'mp',start:Math.round(G.t)-5,end:Math.round(G.t)+55,st:'active'});WDW.pvRefresh(true);await w(150);const b=rd();G.LL.passes=[];WDW.pvRefresh(true);
  return{rid,standby:a,ll:b}});
ck(!out.purple.standby.ll&&out.purple.ll.ll&&/\bll\b/.test(out.purple.ll.btn)&&/Lightning Lane/i.test(out.purple.ll.tag),'Now card not purple for a Lightning Lane step '+JSON.stringify(out.purple));
// 7) real day: "I booked it" → enter the return time from Disney's app → pass held at that time
await lib.startDay(pg,'MK','plan','now');
out.real=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G;WDW.setView('plan');G.LL.mp='MK';G.LL.tapped=true;G.LL.passes=[];WDW.LLT.dis={};
  G.plan.res.steps.forEach(s=>{s.books=[]});G.plan.res.steps[0].books=[{rid:'btm',at:G.t,ret:Math.round(G.t)+120}];WDW.pvRefresh(true);await w(200);
  const b=document.querySelector('#pvNow #llTask [data-llt="book"]');if(!b)return{none:document.querySelector('#pvIn').innerText.slice(0,200)};const label=b.innerText;b.click();await w(250);
  const inp=document.querySelector('#sheet #llT');if(!inp)return{label,noSheet:true};const t=Math.ceil((G.t+140)/5)*5;inp.value=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
  document.querySelector('#sheet #llTok').click();await w(250);const p=G.LL.passes.find(p=>p.rid==='btm');WDW.pvRefresh(true);await w(150);
  return{label,t,p:p&&[p.st,p.start],gone:!document.querySelector('#pvNow #llTask [data-rid="btm"]')}});
ck(/^I booked it/.test(out.real.label)&&out.real.p&&out.real.p[0]==='active'&&out.real.p[1]===out.real.t&&out.real.gone,'real-day I booked it '+JSON.stringify(out.real));
return {fail,out};
