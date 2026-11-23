// Now card (row 70), Nov 22 feedback: (1) walking to a held show the card was blank (a show trip ends in a show, not a ride):
// it now says Head to <show> with "I'm there", then the show with "✓ Show over"; (2) with nothing left in the plan, the Plan
// button only flashed an empty timeline and the card offered a Replan with nothing to reorder: both now open the must-do editor.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
const card=()=>pg.evaluate(()=>{const c=document.querySelector('#pvNow .ncard');if(!c)return null;const b=c.querySelector('.ncgo'),q=s=>{const e=c.querySelector(s);return e?e.textContent:''};
  const s=WDW.G.segs&&WDW.G.segs[WDW.G.seg];return{big:q('.ncb'),sub:q('.ncs'),btn:b?b.textContent:null,nc:b?b.dataset.nc:null,seg:s?s.k:null}});
const tap=async()=>{await pg.evaluate(()=>document.querySelector('#pvNow .ncgo').click());await W(400)};

// (1) held show: Start → Head to <show> · I'm there → the show · ✓ Show over
await lib.startDay(pg,'MK','plan','now',{show:true});
const name=await pg.evaluate(()=>{const pr=WDW.dpProgress();return pr.blk&&pr.blk.name});ck(name,'no held show is next in the plan');
let c=await card();out.c0=c;ck(c&&c.big===name&&c.btn==='Start','held show next: '+JSON.stringify(c));
await tap();c=await card();out.c1=c;
ck(c&&c.big==='Head to '+name&&/^I'm (there|on the )/.test(c.btn)&&/to get there/.test(c.sub),'walking to the show: '+JSON.stringify(c));
for(let k=0;k<3&&c&&c.btn!=="I'm there";k++){await tap();c=await card()}await tap();c=await card();out.c2=c;ck(c&&c.seg==='snack'&&c.big.includes(name)&&/Show over/.test(c.btn||''),'at the show: '+JSON.stringify(c));
await tap();

// (2) nothing left in the plan
await lib.startDay(pg,'MK','plan','now',{must:['dumbo'],bare:true});
await pg.evaluate(async()=>{WDW.rtAt('MK:front','MK entrance');await new Promise(r=>setTimeout(r,300));WDW.G.ridden.push('dumbo');WDW.autoReplan([{k:'manual',text:'test'}],true);WDW.setView('plan')});await W(400);
c=await card();out.c3=c;ck(c&&c.nc==='more'&&/Add must-dos/.test(c.btn),'nothing left: card '+JSON.stringify(c));
out.plan=await pg.evaluate(async()=>{WDW.closeSheet();document.querySelector('#bPlan').click();await new Promise(r=>setTimeout(r,300));const a=!!document.querySelector('#sheet:not([hidden]) #dpGo');
  const bk=document.querySelector('#sheet [data-back]');if(bk)bk.click();await new Promise(r=>setTimeout(r,300));const b=document.getElementById('sheet').hidden;
  document.querySelector('#pvNow .ncgo').click();await new Promise(r=>setTimeout(r,300));const d=!!document.querySelector('#sheet:not([hidden]) #dpGo');WDW.closeSheet();return{editor:a,backCloses:b,cardEditor:d}});
ck(out.plan.editor&&out.plan.backCloses&&out.plan.cardEditor,'nothing left: Plan button / back / card '+JSON.stringify(out.plan));
out.fail=fail;return out
