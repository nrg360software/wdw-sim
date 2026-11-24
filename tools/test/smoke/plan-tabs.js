// Plan view tabs (row 72): Now · Plan · Waits. Plan tab = 🔒 commitments (held passes, dining reservations), Done (collapsed,
// actual vs planned times from the results log), Now (one row), Later, per-step why / 🔒 / confidence, change log; edit buttons
// on Now and Plan; dock Plan button opens the Plan tab; tab bar stays reachable while scrolling; the change dot shows on the tab.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click()});
const tabs=()=>pg.evaluate(()=>{const t=[...document.querySelectorAll('#pvIn .pvtabs [data-pvtab]')];const q=s=>!!document.querySelector('#pvIn '+s);
  return{tabs:t.map(b=>b.dataset.pvtab+(b.getAttribute('aria-selected')==='true'?'*':'')).join(','),waits:q('.pvw'),edit:q('#dpRe')&&q('#dpEdit')&&q('#dpClr')&&q('#dpAuto'),
    planH:q('#pvPlanH'),nx:document.querySelectorAll('#pvIn .tl.nx').length,up:/Coming up/.test(document.querySelector('#pvIn').textContent),
    secs:[...document.querySelectorAll('#pvIn h3.pvsec')].map(h=>h.childNodes[0].textContent.trim()).join(',')}});
const tab=async k=>{await pg.evaluate(k=>document.querySelector(`#pvIn [data-pvtab="${k}"]`).click(),k);await W(250)};

// 1) Now tab by default: edit buttons, coming up, no waits grid
let t=await tabs();out.now=t;
ck(t.tabs==='now*,plan,waits','tab bar '+t.tabs);ck(t.edit&&t.up&&!t.waits&&!t.planH,'Now tab content '+JSON.stringify(t));
// 2) Waits tab: the grid only
await tab('waits');t=await tabs();out.waits=t;ck(t.tabs==='now,plan,waits*'&&t.waits&&!t.planH&&!t.edit,'Waits tab '+JSON.stringify(t));
// 3) dock Plan → Plan tab: Done / Now / Later, exactly one highlighted Now row, edit buttons
await pg.evaluate(()=>document.querySelector('#bPlan').click());await W(300);t=await tabs();out.plan=t;
ck(t.tabs==='now,plan*,waits'&&t.planH&&t.edit&&!t.waits,'dock Plan did not open the Plan tab '+JSON.stringify(t));
ck(/^Done,Now(,Later)?$/.test(t.secs)&&t.nx===1,'Plan tab sections '+JSON.stringify(t));
out.card=await pg.evaluate(async()=>{const vis=()=>{const n=document.getElementById('pvNow');return !n.hidden&&n.offsetHeight>0};const a=vis();document.querySelector('#pvIn [data-pvtab="now"]').click();await new Promise(r=>setTimeout(r,250));const b=vis();document.querySelector('#bPlan').click();await new Promise(r=>setTimeout(r,250));return{plan:a,now:b}});
ck(!out.card.plan&&out.card.now,'Now card should show on the Now tab only '+JSON.stringify(out.card));

// 4) lock a pass and a dining reservation, replan: both listed as 🔒 and kept, rows carry the badge
out.lock=await pg.evaluate(async()=>{const G=WDW.G,w=ms=>new Promise(r=>setTimeout(r,ms));
  G.LL.passes.push({id:9811,rid:'pp',type:'mp',start:780,end:840,st:'active'});
  G.plan.settings.blocks=(G.plan.settings.blocks||[]).filter(b=>b.id!=='tdin').concat([{id:'tdin',name:'Test Diner',meal:true,at:750,walk:5,dur:45}]);
  document.querySelector('#pvIn #dpRe').click();await w(900);WDW.setView('plan');await w(300);
  const lk=document.querySelector('#pvIn .lock'),txt=lk?lk.innerText.replace(/\s+/g,' '):'';const all=document.querySelector('#pvIn').innerText.replace(/\s+/g,' ');
  const st=G.plan.res.steps,pp=st.find(s=>s.rid==='pp'),din=st.flatMap(s=>s.blocks||[]).find(b=>b.id==='tdin');
  return{txt,pass:/Peter Pan.*planned/.test(txt),din:/Test Diner 12:30 PM/.test(txt),notIn:/not in the plan/.test(txt),badgeP:/🔒 held pass/.test(all),badgeD:/🔒 reservation 12:30 PM/.test(all),
    pp:pp?[pp.how,Math.round(pp.q0)]:null,dinT:din?[Math.round(din.start),din.late]:null,why:document.querySelectorAll('#pvIn .tlx').length}});
ck(out.lock.pass&&out.lock.din&&!out.lock.notIn,'🔒 box '+JSON.stringify(out.lock));
ck(out.lock.badgeP&&out.lock.badgeD,'🔒 badges on plan rows '+JSON.stringify(out.lock));
ck(out.lock.pp&&out.lock.pp[0]!=='standby'&&out.lock.pp[1]>=775&&out.lock.pp[1]<=870,'pass not used in its window '+JSON.stringify(out.lock.pp));
ck(out.lock.dinT&&out.lock.dinT[1]<=15&&out.lock.dinT[0]>=735,'reservation not kept '+JSON.stringify(out.lock.dinT));
ck(out.lock.why>=2,'no why lines on plan steps');

// 5) Done: actual vs planned from the results log, collapsed by default
out.done=await pg.evaluate(async()=>{const G=WDW.G,w=ms=>new Promise(r=>setTimeout(r,ms));G.log=(G.log||[]).concat([{rid:'tron',pk:'MK',q0:600,how:'standby',sb:50,est:50,on:648,end:656,wait:48,done:true,pl:{q0:590,wait:55,how:'standby',leave:580}},
    {rid:'sm',pk:'MK',q0:670,how:'standby',sb:30,est:30,done:true,left:true,end:680}]);
  WDW.setView('plan');await w(300);const d=document.querySelector('#pvIn details.pvdone');if(!d)return{none:document.querySelector('#pvIn').innerText.slice(0,300)};
  const sum=d.querySelector('summary').innerText,open=d.open,body=d.textContent.replace(/\s+/g,' ');return{sum,open,body}});
ck(out.done.sum&&/^1 ride/.test(out.done.sum)&&/last off 10:56/.test(out.done.sum)&&!out.done.open,'Done summary '+JSON.stringify(out.done));
ck(out.done.body&&/in line 10:00 AM \(plan 9:50 AM \+10m\)/.test(out.done.body)&&/waited 48m \(plan 55m\)/.test(out.done.body)&&!/Space Mountain/.test(out.done.body),'Done row (actual vs plan; left lines skipped) '+JSON.stringify(out.done));

// 6) tab bar stays reachable after scrolling the Plan tab
out.sticky=await pg.evaluate(async()=>{const pv=document.getElementById('pv');pv.scrollTop=pv.scrollHeight;await new Promise(r=>setTimeout(r,200));
  const b=document.querySelector('#pvIn [data-pvtab="waits"]'),r=b.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  const pad=parseFloat(getComputedStyle(pv).paddingTop),tb=b.parentElement.getBoundingClientRect();return{scrolled:pv.scrollTop>50,hit:e===b||b.contains(e),top:Math.round(tb.top),pad:Math.round(pad)}});
ck(out.sticky.hit&&Math.abs(out.sticky.top-out.sticky.pad)<=4,'tab bar not reachable after scrolling '+JSON.stringify(out.sticky));

// 7) change log + dot on the Plan tab; opening the tab clears it
out.chg=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));WDW.autoReplan([{k:'test',text:'test change'}]);WDW.AUTO.unseen=true;
  document.querySelector('#pvIn [data-pvtab="now"]').click();await w(250);const dot=!!document.querySelector('#pvIn [data-pvtab="plan"] .pvdot');
  document.querySelector('#pvIn [data-pvtab="plan"]').click();await w(250);const log=[...document.querySelectorAll('#pvIn .chglog .cl')].map(x=>x.innerText.replace(/\s+/g,' '));
  return{dot,cleared:!document.querySelector('#pvIn [data-pvtab="plan"] .pvdot')&&!WDW.AUTO.unseen,log}});
ck(out.chg.dot&&out.chg.cleared,'Plan tab dot '+JSON.stringify(out.chg));ck(out.chg.log.length>=1,'no change log on the Plan tab '+JSON.stringify(out.chg));

// 8) confidence per step when it has run
out.conf=await pg.evaluate(()=>{const c=WDW.G.plan.conf&&WDW.G.plan.conf.last;return{has:!!c,per:!!(c&&c.per),low:c&&c.per?Object.values(c.per).filter(p=>p<0.95).length:0,odds:document.querySelectorAll('#pvIn .tlx .odds').length}});
if(out.conf.has)ck(out.conf.per&&(!out.conf.low||out.conf.odds>0),'confidence ran but no per-step odds '+JSON.stringify(out.conf));
await pg.evaluate(()=>{document.getElementById('pv').scrollTop=0});
return {fail,out};
