// hold a show → replan → save → reload → resume: the held show, the plan, Lightning Lane passes, the trip and position all come back
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await pg.evaluate(()=>{const d=WDW.orlandoNow().date;localStorage.setItem('wdwsim.ll.'+d,JSON.stringify({mp:'MK',picks:[{rid:'pp',start:780},{rid:'btm',start:840}],sp:[],prem:null}))});
await lib.startDay(pg,'MK','plan','now');
await pg.evaluate(()=>WDW.rtAt('MK:front','MK entrance'));await pg.waitForTimeout(500);
// hold a show from the Shows sheet (first future time of the first item that has one)
out.held0=await pg.evaluate(async()=>{WDW.openShows('MK');const rows=[...document.querySelectorAll('#sheet [data-sh]')];
 for(const r of rows){r.click();await new Promise(z=>setTimeout(z,60));const c=document.querySelector('#sheet [data-sht]');if(c){c.click();await new Promise(z=>setTimeout(z,300));break}}
 return (WDW.G.plan.settings.blocks||[]).filter(b=>b.user).map(b=>b.name+'@'+b.at)});
ck(out.held0.length===1,'no show held: '+JSON.stringify(out.held0));
// replan from the plan view's ⋯ Edit plan sheet (row 74)
out.replan=await pg.evaluate(async()=>{WDW.closeSheet();WDW.openPlan();WDW.openEditPlan();const b=document.querySelector('#sheet #dpRe');if(!b)return 'no #dpRe';const r0=WDW.G.plan.res;b.click();await new Promise(z=>setTimeout(z,800));return WDW.G.plan.res!==r0?'ok':'plan not remade'});
ck(out.replan==='ok','replan: '+out.replan);
// start walking to the next step (the Now card's Go, row 70), then save
await pg.evaluate(()=>{WDW.closeSheet();WDW.pvTab('now');const b=document.querySelector('#pvNow [data-nc="go"]');if(b)b.click()});await pg.waitForTimeout(800);
await pg.evaluate(()=>window.adv(3));await pg.waitForTimeout(1500);
const snap=()=>pg.evaluate(()=>{const G=WDW.G,P=G.plan;return {held:(P.settings.blocks||[]).filter(b=>b.user).map(b=>b.name+'@'+b.at),showStep:P.res.steps.flatMap(s=>s.blocks||[]).filter(b=>b.user).map(b=>b.name+(b.missed?' missed':'')),
 steps:P.res.steps.filter(s=>s.k==='ride').map(s=>s.rid),ll:G.LL.passes.map(p=>p.rid+':'+p.start+':'+p.st),mp:G.LL.mp,segs:(G.segs||[]).map(s=>s.k),seg:G.seg,node:WDW.NODES[G.node]&&WDW.NODES[G.node].id,date:G.date,real:G.real,trip:G.trip&&G.trip.rid}});
const a=await snap();out.before=a;ck(a.segs.length>0,'no trip in progress before saving');
ck(await pg.evaluate(()=>WDW.runSave()),'runSave returned false');
await lib.reload(pg);
out.box=await pg.evaluate(()=>{const b=document.querySelector('#resumeBox');return b&&!b.hidden?b.textContent.replace(/\s+/g,' ').slice(0,120):null});ck(out.box,'resume card missing after reload');
await pg.evaluate(()=>document.querySelector('#bResume').click());await pg.waitForFunction(()=>WDW.G.started&&WDW.G.plan,null,{timeout:60000});await pg.waitForTimeout(1500);
const b=await snap();out.after=b;
for(const k of ['held','showStep','steps','ll','mp','date','real','trip'])ck(JSON.stringify(a[k])===JSON.stringify(b[k]),k+' changed: '+JSON.stringify(a[k])+' → '+JSON.stringify(b[k]));
ck(JSON.stringify(a.segs)===JSON.stringify(b.segs)&&a.seg===b.seg,'trip changed: '+a.segs+'#'+a.seg+' → '+b.segs+'#'+b.seg);
ck(a.node===b.node,'position changed: '+a.node+' → '+b.node);
out.fail=fail;return out
