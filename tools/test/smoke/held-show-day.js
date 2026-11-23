// Held shows during the day (Nick, Nov 22): (1) a "time to head" warning before every held show, tap = walk there;
// (2) Start walks you there even when the plan says you're too far to make it; (3) once the time passes without you the
// plan holds that show's next time today, or drops it when there's no later time.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await lib.startDay(pg,'MK','map',660,{show:true});
await pg.evaluate(()=>WDW.rtAt('MK:front','MK entrance'));await pg.waitForTimeout(300);
const H=`const w=ms=>new Promise(r=>setTimeout(r,ms));const G=WDW.G,d=WDW.orlandoNow().date,items=(WDW.showsFor('MK',d)||{}).items||[];
 const hold=async(it,T)=>{const b=WDW.showBlock(it,'MK',T);G.plan.settings.blocks=[b];G.plan.blkDone={};G.plan.showRem={};document.getElementById('toasts').innerHTML='';WDW.autoReplan([{k:'sync',text:'test'}],true);await w(100);return b};
 const toasts=()=>document.getElementById('toasts').textContent;`;
// (1) leave warning + tap to go
out.warn=await pg.evaluate(new Function(`return (async()=>{${H}
 const it=items.find(i=>!i.p&&i.t.length>=2&&WDW.showNode('MK',i.n));if(!it)return {err:'no multi-time show'};const T=it.t.find(x=>x>=G.t+90);const b=await hold(it,T);
 const walk=WDW.dijkstra(G.node,G.t/60).dist[WDW.NI[b.node]]+(b.extra||0),leave=b.at-(b.pre||0)-walk;
 G.t=leave-25;(WDW.showTick&&WDW.showTick());await w(50);const early=toasts();G.t=leave-5;(WDW.showTick&&WDW.showTick());await w(50);const at=toasts();
 const el=[...document.querySelectorAll('#toasts .toast')].find(x=>/head to/.test(x.textContent));if(el)el.click();await w(100);
 const s=G.segs&&G.segs[G.segs.length-1];return {show:b.name,at:b.at,early,warn:at,trip:(G.segs||[]).map(x=>x.k).join(','),act:s&&s.act,name:s&&s.name}})()`));
ck(!out.warn.err,out.warn.err);ck(!/head to/.test(out.warn.early||''),'warning came too early');ck(/Time to head to/.test(out.warn.warn||''),'no time-to-leave warning: '+out.warn.warn);
ck(out.warn.act==='show'&&/walk/.test(out.warn.trip),'tapping the warning did not walk to the show: '+out.warn.trip);
await lib.startDay(pg,'MK','map',660,{show:true});await pg.evaluate(()=>WDW.rtAt('MK:front','MK entrance'));await pg.waitForTimeout(300);
// (2) Start when the plan says it can't be made (the farthest multi-time show, a minute before it starts)
out.far=await pg.evaluate(new Function(`return (async()=>{${H}
 const D=WDW.dijkstra(G.node,G.t/60);const cand=items.filter(i=>!i.p&&i.t.some(x=>x>=G.t+20)&&WDW.showNode('MK',i.n)).map(i=>({i,d:D.dist[WDW.NI[WDW.showNode('MK',i.n).node]]})).sort((a,b)=>b.d-a.d);
 const it=cand[0].i;const T=it.t.find(x=>x>=G.t+20);const b=await hold(it,T);
 const pb=G.plan.res.steps.flatMap(s=>s.blocks||[]).find(x=>x.id===b.id);
 // too far: pretend it takes longer to get there than there is time (far corner of the park)
 G.t=T-1;WDW.autoReplan([{k:'sync',text:'test'}],true);await w(50);const pb2=G.plan.res.steps.flatMap(s=>s.blocks||[]).find(x=>x.id===b.id);
 WDW.openPlan();const btn=document.querySelector('#sheet #dpBlk');const label=btn&&btn.textContent;if(btn)btn.click();await w(100);
 const s=G.segs&&G.segs[G.segs.length-1];return {missed:!!(pb2&&pb2.missed),label,trip:(G.segs||[]).map(x=>x.k).join(','),act:s&&s.act}})()`));
ck(out.far.missed,'test setup: the plan did not mark the far show missed');ck(out.far.label,'no Start button for the held show');ck(out.far.act==='show'&&/walk/.test(out.far.trip),'Start did not walk to the show when far away: '+out.far.trip);
await lib.startDay(pg,'MK','map',660,{show:true});
// (3) time passes: next time, or dropped
out.passed=await pg.evaluate(new Function(`return (async()=>{${H}
 const it=items.find(i=>!i.p&&i.t.length>=2&&WDW.showNode('MK',i.n));const T=it.t.find(x=>x>=G.t+20);await hold(it,T);
 G.t=T+10;(WDW.showTick&&WDW.showTick());await w(50);const after=G.plan.settings.blocks.map(b=>b.name+'@'+b.at),note=(G.plan.notes[0]||{}).text,t1=toasts();
 const last=it.t[it.t.length-1];await hold(it,last);G.t=last+10;(WDW.showTick&&WDW.showTick());await w(50);
 return {T,times:it.t,after,note,toast:t1,afterLast:G.plan.settings.blocks.map(b=>b.name+'@'+b.at),note2:(G.plan.notes[0]||{}).text}})()`));
ck(out.passed.after.length===1&&+out.passed.after[0].split('@')[1]>out.passed.T,'missed show not moved to a later time: '+JSON.stringify(out.passed.after));
ck(/Missed .* holding/.test(out.passed.note||''),'no plan note for the moved show');
ck(out.passed.afterLast.length===0,'last showtime passed but the show is still held: '+JSON.stringify(out.passed.afterLast));
out.errs=await pg.evaluate(()=>WDW.DBG.n);ck(!out.errs,'errors: '+out.errs);
out.fail=fail;return out
